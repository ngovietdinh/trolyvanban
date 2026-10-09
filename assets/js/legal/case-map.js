// Sơ đồ vụ việc: từ các biên bản lời khai đã chọn hoặc tài liệu tải lên, dựng nhanh bản chất vụ việc —
// điều luật, hành vi (ai làm, trích dẫn, số tiền), người liên quan và vai trò, quan hệ / dòng tiền giữa các
// người, dòng thời gian. Chạy trên máy; có AI thì phân tích sâu hơn (cùng cấu trúc dữ liệu).
import { findCrime } from './engine.js';
import { analyzeOffline, amountsIn } from './analyze.js';
import { extractJson } from '../lib/ai.js';
import { withCache } from '../lib/cache-mark.js';
import { lawGate, citedArticles, lawCandidates, lawCatalog } from './relevance.js';
import { rules } from './ai-rules.js';
import { key, similarText, sameText } from './text-sim.js';
export { key, similarText, sameText };

export const short = (s, n = 160) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t.replace(/[.;,:]$/, '') : `${t.slice(0, n).replace(/\s+\S*$/, '')}…`;
};
/** Tổng số mục AI nêu nhưng bị bỏ / hạ cấp (để báo cho người dùng). */
export const sumDropped = (d) => Object.values(d || {}).reduce((n, v) => n + (typeof v === 'number' ? v : 0), 0);
const UP = 'A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ';
const TITLE = '(?:ông|bà|anh|chị|em|cô|chú|bác|cháu|đồng chí|đ\\/c|giám đốc|phó giám đốc|chủ tịch|phó chủ tịch|trưởng phòng|phó trưởng phòng|kế toán trưởng|kế toán|thủ quỹ|thủ kho|cán bộ|chuyên viên|bị can|người làm chứng|đối tượng|hộ|ông\\/bà)';
const NAME_RE = new RegExp(`(?<![\\p{L}])${TITLE}\\s+((?:[${UP}][\\p{Ll}]*)(?:\\s+[${UP}][\\p{Ll}]*){0,3})`, 'gu');
// Quy tắc tên: chỉ đưa vào sơ đồ khi là HỌ TÊN ĐẦY ĐỦ (≥ 2 chữ, không tính danh xưng) có nguyên văn trong lời khai.
// Tên gọi trơ (“ông Bình”), tên có thể bị cắt, tên trùng nhiều người → “chưa rõ”, không đưa vào sơ đồ.
const TITLE_WORDS = new Set(['ông', 'bà', 'anh', 'chị', 'em', 'cô', 'chú', 'bác', 'cháu', 'đồng', 'chí', 'đ/c', 'hộ']);
const ORG_CAP = new Set(['Ban', 'Phòng', 'Sở', 'UBND', 'HĐND', 'Cục', 'Tổng', 'Huyện', 'Xã', 'Tỉnh', 'Bộ', 'Viện', 'Bệnh', 'Đảng', 'Đoàn']);
const wordsOf = (t) => String(t || '').trim().split(/\s+/).filter(Boolean);
/** Bỏ danh xưng đứng đầu (“Ông Nguyễn Văn An” → “Nguyễn Văn An”). */
export const stripTitle = (t) => {
  const w = wordsOf(t);
  while (w.length && TITLE_WORDS.has(w[0].toLowerCase())) w.shift();
  return w.join(' ');
};
/** Họ tên đầy đủ: sau khi bỏ danh xưng còn ≥ 2 chữ, chỉ gồm chữ cái. */
export const isFullName = (t) => {
  const w = wordsOf(stripTitle(t));
  return w.length >= 2 && w.every((x) => /^[\p{L}'’.-]+$/u.test(x));
};
/** Tên có nguyên văn trong nguồn (hoặc đã là tên rõ ràng trong sơ đồ: allow)? Không có nguồn thì chỉ cần đủ họ tên. */
export const nameVerbatim = (t, source = '', allow = new Set()) => {
  const n = stripTitle(t);
  if (!isFullName(n)) return false;
  const k = key(n);
  return allow.has(k) || !source || key(source).includes(k);
};
// Chức vụ (chỉ lấy khi có NGUYÊN VĂN trong lời khai: đứng trước tên, hoặc ngay sau tên).
const JOB = '(?:phó giám đốc|giám đốc|phó chủ tịch|chủ tịch|phó trưởng phòng|trưởng phòng|trưởng ban|phó trưởng ban|kế toán trưởng|kế toán viên|kế toán|thủ quỹ|thủ kho|cán bộ|chuyên viên|nhân viên|cán bộ địa chính|chánh văn phòng|phó chánh văn phòng|bí thư|phó bí thư|thanh tra viên|nhà thầu|chủ đầu tư|chỉ huy trưởng|đội trưởng|tổ trưởng)';
const JOB_RE = new RegExp(`^${JOB}$`, 'i');
const ORG_TAIL = '(?:\\s+(?:của\\s+)?(?:Ban|Phòng|phòng|Công ty|công ty|UBND|Sở|Trung tâm|Chi cục|Cục|xã|huyện|tỉnh|Hợp tác xã|Doanh nghiệp|doanh nghiệp|Văn phòng)[^,.;:()\\n]{0,60})?';
const JOB_AFTER = new RegExp(`^\\s*(?:,|\\(|–|-)?\\s*(?:là\\s+)?(${JOB}${ORG_TAIL})`, 'iu');
// Phần tên đơn vị sau chức vụ: dừng ở động từ / từ nối, tối đa 8 từ (“kế toán Ban QLDA huyện X lập…” → “kế toán Ban QLDA huyện X”).
const STOP_WORD = /^(lập|rút|chuyển|nhận|đưa|ký|đã|đang|sẽ|có|là|và|cùng|chỉ|khai|biết|được|bị|không|nói|cho|gặp|bàn|thống|giao|trả|chi|nộp|yêu|đề|thì|nhưng|vì|nên|để|với|tại|vào|năm|ngày|tháng|lúc|khi|sau|trước|thông|móc|câu|ép|bảo|nhờ|thu|lấy|làm|tổ|ra|duyệt|phê|quyết|trực|tiếp|tôi|anh|chị|ông|bà|họ|mình)$/i;
function trimJob(t) {
  const w = String(t || '').trim().replace(/\s+/g, ' ').split(' ');
  const out = [];
  for (const x of w) {
    if (out.length && STOP_WORD.test(x.replace(/[^\p{L}]/gu, ''))) break;
    out.push(x);
    if (out.length >= 9) break;
  }
  return out.join(' ').replace(/[,;:.(–-]+$/, '');
}
const JOB_BEFORE = new RegExp(`(${JOB}${ORG_TAIL})\\s*$`, 'iu');
const SELF_JOB = new RegExp(`^\\s*(?:tôi|bản thân tôi)\\s+(?:hiện\\s+|đang\\s+|lúc đó\\s+)?(?:là|giữ chức(?:\\s+vụ)?|làm|công tác(?:\\s+là)?)\\s+(${JOB}${ORG_TAIL})`, 'iu');
const MONEY_V = /(đưa|chuyển khoản|chuyển|giao|trả|chi|nộp|biếu|cho vay|vay|hối lộ|lại quả|chia)/i;
const RECV_V = /(nhận|thu|lấy)/i;
const ORDER_V = /(chỉ đạo|giao cho|yêu cầu|bảo|ép|nhờ|đề nghị|phê duyệt|ký duyệt|duyệt|ra lệnh|quyết định)/i;
const OTHER_V = /(thông đồng|bàn bạc|thống nhất|móc nối|câu kết|gặp|liên hệ|gọi điện|ký|lập)/i;

// Câu phủ nhận (“tôi không nhận tiền của ông Bình”, “chưa bao giờ chỉ đạo”): không dựng thành quan hệ.
const DENY_RE = /(?:^| )(?:không|chưa|không hề|chưa hề|chưa bao giờ|chưa từng|không bao giờ)(?: \S+){0,2}? (?:đưa|nhận|chuyển|giao|trả|chi|nộp|biếu|lấy|thu|chỉ đạo|yêu cầu|bảo|ép|nhờ|gặp|bàn bạc|thông đồng|thống nhất|ký|cho)(?= |$)|phủ nhận|không thừa nhận|không có (?:việc|chuyện)|không đúng sự thật/;
export const isDenial = (t) => DENY_RE.test(key(t));

/** Tách câu, giữ nguồn. */
export function sentences(sources) {
  return sources.flatMap((s, si) =>
    String(s.text || '')
      .replace(/\r/g, '')
      .split(/(?<=[.!?;])\s+|\n+/)
      .map((t) => t.replace(/^\s*(?:hỏi|đáp|trả lời|h|đ|tl)\s*[:.\-–]\s*/i, '').trim())
      .filter((t) => t.length > 8)
      .map((t) => ({ t, src: s.label || `Nguồn ${si + 1}`, speaker: s.speaker || '' })),
  );
}

/**
 * Người được nhắc tới: tên có danh xưng / chức danh đứng trước, người khai, người trong hồ sơ.
 * Tên gọi ngắn (“Bình”, “Văn Bình”) chỉ gộp vào họ tên đầy đủ khi chỉ khớp ĐÚNG MỘT người; khớp nhiều người → ambiguous.
 */
export function findPeople(sents, known = []) {
  const reg = new Map();
  const put = (ten, extra = {}) => {
    ten = String(ten || '').trim().replace(/\s+/g, ' ');
    if (!ten || ten.length < 2) return null;
    const k = key(ten);
    const e = reg.get(k) || { ten, key: k, keys: new Set([k]), vaiTro: '', mentions: 0, idx: reg.size };
    reg.set(k, e);
    Object.assign(e, Object.fromEntries(Object.entries(extra).filter(([, v]) => v)));
    return e;
  };
  known.forEach((p) => put(p.ten, { vaiTro: p.vaiTro || '', known: true }));
  sents.forEach((s) => s.speaker && put(s.speaker, { speaker: true }));
  // Danh xưng viết hoa đầu câu (“Bà Lê Thị Cúc…”) → viết thường để nhận diện tên ngay sau; giữa câu giữ nguyên
  // (tránh “Hoàng Thị Em” bị đọc “em” là danh xưng rồi cắt mất chữ “Em”).
  const TITLE_START = new RegExp(`^(\\s*)(${TITLE})(?=\\s)`, 'iu');
  // Chức danh (không phải cách xưng hô) viết hoa giữa câu vẫn là chức danh: “chuyển cho Giám đốc Trần Văn Bình”.
  const TITLE_JOB = new RegExp(`(?<![\\p{L}])(?:đồng chí|đ\\/c|giám đốc|phó giám đốc|chủ tịch|phó chủ tịch|trưởng phòng|phó trưởng phòng|kế toán trưởng|kế toán|thủ quỹ|thủ kho|cán bộ|chuyên viên|bị can|người làm chứng|đối tượng)(?=\\s)`, 'giu');
  for (const s of sents) {
    const low = s.t.replace(TITLE_START, (_, sp, t) => sp + t.toLocaleLowerCase('vi-VN')).replace(TITLE_JOB, (t) => t.toLocaleLowerCase('vi-VN'));
    for (const m of low.matchAll(NAME_RE)) {
      const title = m[0].slice(0, m[0].length - m[1].length).trim();
      // Tên viết hoa dính liền tên đơn vị (“ông Nguyễn Văn An Ban QLDA”) → cắt ở chữ chỉ đơn vị.
      let nm = m[1];
      const nw = nm.split(' ');
      const cut = nw.findIndex((w, i) => i > 0 && ORG_CAP.has(w));
      if (cut > 0) nm = nw.slice(0, cut).join(' ');
      // Chức vụ nguyên văn: “Giám đốc Trần Văn Bình”, “ông An, kế toán Ban QLDA”, “bà Cúc (thủ quỹ)”.
      const after = s.t.slice(m.index + m[0].length).match(JOB_AFTER);
      const before = JOB_RE.test(title) ? title : (s.t.slice(Math.max(0, m.index - 70), m.index).match(JOB_BEFORE) || [])[1];
      const chucVu = trimJob(after?.[1] || before || '');
      const p = put(nm, chucVu ? { chucVu: chucVu.charAt(0).toLocaleUpperCase('vi-VN') + chucVu.slice(1), chucVuTrich: short(s.t, 200) } : {});
      if (p && chucVu && p.chucVu !== chucVu && !p.chucVu) p.chucVu = chucVu;
      // Tên 4 chữ mà liền sau vẫn là chữ viết hoa → có thể còn dài hơn, chưa chắc đã đủ.
      if (p && cut < 0 && nw.length >= 4) {
        const nx = s.t.slice(m.index + m[0].length).match(new RegExp(`^\\s+([${UP}][\\p{Ll}]*)`, 'u'));
        if (nx) p.nghiNgo = nx[1];
      }
    }
  }
  // Người khai tự nêu chức vụ: “Tôi là kế toán Ban QLDA huyện X”, “tôi giữ chức Giám đốc…”.
  for (const s of sents) {
    const m = s.speaker && s.t.match(SELF_JOB);
    if (!m) continue;
    const chucVu = trimJob(m[1]);
    const p = put(s.speaker, { speaker: true });
    if (p && chucVu && !p.chucVu) Object.assign(p, { chucVu: chucVu.charAt(0).toLocaleUpperCase('vi-VN') + chucVu.slice(1), chucVuTrich: short(s.t, 200) });
  }
  // Gộp tên ngắn vào họ tên đầy đủ khi chỉ có một khả năng; nhiều khả năng → giữ riêng, đánh ambiguous.
  const canon = [];
  for (const e of [...reg.values()].sort((a, b) => wordsOf(b.ten).length - wordsOf(a.ten).length)) {
    const cands = canon.filter((c) => !c.ambiguous && c.key.endsWith(` ${e.key}`));
    if (cands.length === 1) {
      const c = cands[0];
      c.keys.add(e.key);
      c.idx = Math.min(c.idx, e.idx);
      for (const [f, v] of Object.entries(e)) if (!['key', 'keys', 'ten', 'mentions', 'idx', 'aliases'].includes(f) && v && !c[f]) c[f] = v;
      continue;
    }
    if (cands.length > 1) e.ambiguous = cands.map((c) => c.ten);
    canon.push(e);
  }
  const people = canon.sort((a, b) => a.idx - b.idx);
  // Cách gọi để nhận diện trong câu: họ tên đầy đủ, 2 chữ cuối, danh xưng + tên. Tên gọi trơ chỉ nhận dạng khi có danh xưng.
  const TT = ['ông', 'bà', 'anh', 'chị', 'em', 'cô', 'chú', 'bác', 'cháu'];
  people.forEach((p) => {
    const w = p.ten.split(' ');
    p.aliases = [...new Set([w.length >= 2 ? p.key : null, w.length >= 3 ? key(w.slice(-2).join(' ')) : null, ...[...p.keys].filter((x) => x.includes(' ')), ...TT.map((t) => `${t} ${key(w.at(-1))}`)].filter(Boolean))];
  });
  return people;
}

/**
 * Phân loại người: rõ (họ tên đầy đủ, có nguyên văn) / chưa rõ (lyDo). Chỉ người rõ mới được đưa vào sơ đồ.
 * Cách gọi dùng chung cho nhiều người (“ông Bình” khi có hai người tên Bình) bị bỏ khỏi người rõ.
 */
export function classifyPeople(sents, known = []) {
  const all = findPeople(sents, known);
  const text = key(sents.map((x) => x.t).join(' '));
  for (const p of all) {
    let why = '';
    if (p.ambiguous?.length) why = `“${p.ten}” có thể là ${p.ambiguous.join(' hoặc ')} — lời khai không nói rõ là ai`;
    else if (!isFullName(p.ten)) why = `Chỉ có tên gọi “${p.ten}”, chưa có họ tên đầy đủ trong lời khai`;
    else if (p.nghiNgo) why = `Tên “${p.ten}” có thể chưa đầy đủ (liền sau là “${p.nghiNgo}”)`;
    else if (!p.known && !p.speaker && !text.includes(key(p.ten))) why = 'Họ tên không có nguyên văn trong lời khai';
    p.clear = !why;
    p.lyDo = why;
  }
  const cnt = new Map();
  all.filter((p) => p.clear).forEach((p) => p.aliases.forEach((a) => cnt.set(a, (cnt.get(a) || 0) + 1)));
  all.filter((p) => p.clear).forEach((p) => (p.aliases = p.aliases.filter((a) => cnt.get(a) === 1)));
  return all;
}

/** Vị trí người được nhắc trong câu (theo thứ tự xuất hiện); “tôi” = người khai. */
export function actorsIn(s, people) {
  const t = ` ${key(s.t)} `;
  const hits = [];
  for (const p of people) {
    let at = -1;
    for (const a of p.aliases) {
      const i = t.indexOf(` ${a} `);
      if (i >= 0 && (at < 0 || i < at)) at = i;
    }
    if (at >= 0) hits.push({ p, at });
  }
  if (s.speaker && /(^|\s)tôi(\s|$)/.test(t)) {
    const sp = people.find((p) => p.keys?.has(key(s.speaker)) || p.key === key(s.speaker));
    if (sp && !hits.some((h) => h.p === sp)) hits.push({ p: sp, at: t.indexOf(' tôi ') });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.p);
}

export const parseDate = (s) => {
  let m = /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/iu.exec(s) || /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/.exec(s);
  if (m) return { ts: Date.UTC(+m[3], +m[2] - 1, +m[1]), label: `${String(m[1]).padStart(2, '0')}/${String(m[2]).padStart(2, '0')}/${m[3]}` };
  m = /tháng\s+(\d{1,2})[/\s]+(?:năm\s+)?(\d{4})/iu.exec(s) || /\b(\d{1,2})\/(\d{4})\b/.exec(s);
  if (m && +m[1] <= 12) return { ts: Date.UTC(+m[2], +m[1] - 1, 1), label: `${String(m[1]).padStart(2, '0')}/${m[2]}` };
  m = /năm\s+(\d{4})/iu.exec(s);
  if (m && +m[1] > 1970 && +m[1] < 2100) return { ts: Date.UTC(+m[1], 0, 1), label: m[1] };
  return null;
};

/**
 * Một câu → ai (theo thứ tự), loại quan hệ (tien / chi-dao / khac), chiều (người đưa → người nhận), động từ,
 * số tiền lớn nhất nêu trong câu, có phải câu phủ nhận không.
 */
export function classifySentence(s, people) {
  const hits = actorsIn(s, people);
  const actors = hits.filter((p) => p.clear !== false);
  const unclear = hits.filter((p) => p.clear === false);
  const money = amountsIn(s.t).sort((x, y) => y.v - x.v)[0] || null;
  const type = MONEY_V.test(s.t) || (RECV_V.test(s.t) && (money || /tiền|tài sản|vàng|quà/i.test(s.t))) ? 'tien' : ORDER_V.test(s.t) ? 'chi-dao' : OTHER_V.test(s.t) ? 'khac' : null;
  let [from, to] = hits;
  // “B nhận … của / từ A” → A → B; “nhận” đứng trước người thứ hai.
  const tk = key(s.t);
  if (type === 'tien' && RECV_V.test(s.t) && !MONEY_V.test(s.t)) [from, to] = [to, from];
  if (hits.length >= 2 && /(của|từ)\s/.test(tk) && RECV_V.test(s.t) && tk.indexOf(' của ') > -1) [from, to] = [hits[1], hits[0]];
  // Mũi tên luôn đi từ người đưa → người nhận, nên “nhận” được ghi thành “đưa”.
  let verb = type ? (s.t.match(type === 'tien' ? MONEY_V : type === 'chi-dao' ? ORDER_V : OTHER_V) || [''])[0].toLowerCase() : '';
  if (type === 'tien' && !verb) verb = 'đưa';
  // ok: cả hai đầu mũi tên đều là người rõ họ tên → mới vẽ được.
  return { hits, actors, unclear, from, to, ok: !!(from && to && from.clear !== false && to.clear !== false), type, verb, money, deny: isDenial(s.t), date: parseDate(s.t) };
}

/**
 * Dựng sơ đồ vụ việc trên máy.
 * sources: [{ label, speaker, text }]; known: [{ ten, vaiTro }] (người trong hồ sơ); primary: điều chính (nếu có).
 */
export function buildCaseMap({ sources = [], known = [], primary = null } = {}) {
  const sents = sentences(sources);
  const text = sents.map((s) => s.t).join('\n');
  const an = text ? analyzeOffline(text, { primary }) : { tomTat: '', crimes: [], items: [] };
  const all = classifyPeople(sents, known);
  const people = all.filter((p) => p.clear);

  // Quan hệ, dòng tiền giữa các người.
  const edges = [];
  for (const s of sents) {
    const c = classifySentence(s, all);
    c.hits.forEach((p) => p.mentions++);
    // Người chưa rõ tên: ghi lại câu nguyên văn có nhắc (không đưa vào sơ đồ).
    c.unclear.forEach((p) => {
      p.cau = p.cau || [];
      if (p.cau.length < 3) p.cau.push({ t: short(s.t, 200), speaker: s.speaker || '' });
    });
    // Câu phủ nhận không dựng thành quan hệ (Phân tích lời khai nêu riêng thành điểm cần làm rõ).
    if (c.hits.length < 2 || !c.type || c.deny || !c.ok) continue;
    const { from, to, type, verb, money } = c;
    const dup = edges.find((e) => e.from === from && e.to === to && e.type === type && (e.amount?.v || 0) === (money?.v || 0));
    if (dup) {
      dup.n++;
      continue;
    }
    edges.push({ from, to, type, verb, amount: money, trich: short(s.t, 200), src: s.src, n: 1 });
  }

  // vaiTro: CHỈ chức vụ nguyên văn trong lời khai (hoặc tư cách trong hồ sơ). Vai trò suy ra từ quan hệ để riêng
  // (suyRa) và luôn ghi rõ là suy ra — không trộn với chức vụ.
  people.forEach((p) => {
    p.vaiTro = p.chucVu || p.vaiTro || '';
    const out = edges.filter((e) => e.from === p);
    const inn = edges.filter((e) => e.to === p);
    p.suyRa = out.some((e) => e.type === 'chi-dao') ? 'Người chỉ đạo' : inn.some((e) => e.type === 'tien') && !out.some((e) => e.type === 'tien') ? 'Người nhận tiền' : out.some((e) => e.type === 'tien') ? 'Người đưa / chuyển tiền' : p.speaker ? 'Người khai' : '';
  });

  // Hành vi theo điều luật: ai thực hiện (người được nhắc trong đoạn trích), số tiền.
  const crimes = an.crimes
    .filter((c) => findCrime(c.dieu))
    .slice(0, 5)
    .map((c) => ({
      dieu: c.dieu,
      ten: findCrime(c.dieu).ten,
      canCu: (c.reasons || []).join('; '),
      can: c.can || null,
      // Ưu tiên hành vi khớp Bộ luật; câu mô tả rời chỉ dùng khi điều đó chưa có hành vi khớp.
      items: (an.items.some((x) => x.dieu === c.dieu && x.hanhViId) ? an.items.filter((x) => x.dieu === c.dieu && x.hanhViId) : an.items.filter((x) => x.dieu === c.dieu))
        .slice(0, 8)
        .map((x) => {
          const s = sents.find((y) => x.trich && y.t.includes(x.trich.slice(0, 40))) || { t: x.trich, speaker: '' };
          const m = amountsIn(x.trich || '').sort((a, b) => b.v - a.v)[0];
          return { ten: x.ten, trich: short(x.trich, 220), nguoi: actorsIn(s, all).filter((p) => p.clear).map((p) => p.ten), soTien: m ? m.raw : '' };
        }),
    }))
    // Điều đã được bộ nhận diện xác nhận nhưng chưa có hành vi mẫu khớp: lấy chính các câu làm căn cứ thành hành vi.
    .map((c) => {
      if (c.items.length || !c.can?.yeuTo?.length) return c;
      const quotes = [...new Set(c.can.yeuTo.filter((y) => y.ok && y.quote && y.id !== 'chu-the').map((y) => y.quote))].slice(0, 3);
      return {
        ...c,
        items: quotes.map((q) => {
          const s = sents.find((y) => y.t.includes(q.slice(0, 40))) || { t: q, speaker: '' };
          const m = amountsIn(q).sort((a, b) => b.v - a.v)[0];
          return { ten: short(q, 120), trich: short(q, 220), nguoi: actorsIn(s, all).filter((p) => p.clear).map((p) => p.ten), soTien: m ? m.raw : '' };
        }),
      };
    })
    .filter((c) => c.items.length);

  // Dòng thời gian.
  const timeline = sents
    .map((s) => ({ s, d: parseDate(s.t) }))
    .filter((x) => x.d)
    .sort((a, b) => a.d.ts - b.d.ts)
    .filter((x, i, arr) => i === 0 || key(x.s.t) !== key(arr[i - 1].s.t))
    .slice(0, 30)
    .map((x) => ({ ts: x.d.ts, thoiGian: x.d.label, suKien: short(x.s.t, 200), src: x.s.src }));

  const amounts = [...new Map(amountsIn(text).map((m) => [m.v, m])).values()].sort((a, b) => b.v - a.v);
  const main = people.filter((p) => p.mentions).sort((a, b) => b.mentions - a.mentions);
  const banChat = [];
  if (crimes.length) banChat.push(`Vụ việc có dấu hiệu ${crimes.map((c) => `${c.ten.toLowerCase()} (Điều ${c.dieu} BLHS)`).join('; ')}.`);
  crimes.forEach((c) => c.items.slice(0, 3).forEach((it) => banChat.push(`${it.nguoi.length ? `${it.nguoi.join(', ')}: ` : ''}${it.ten.charAt(0).toLowerCase() + it.ten.slice(1)}${it.soTien ? ` (${it.soTien})` : ''}.`)));
  edges.filter((e) => e.type === 'tien').slice(0, 4).forEach((e) => banChat.push(`Dòng tiền: ${e.from.ten} → ${e.to.ten}${e.amount ? `: ${e.amount.raw}` : ''}${e.n > 1 ? ` (${e.n} lần nêu)` : ''}.`));
  edges.filter((e) => e.type === 'chi-dao').slice(0, 3).forEach((e) => banChat.push(`${e.from.ten} ${e.verb} ${e.to.ten}.`));
  if (main.length) banChat.push(`Người được nhắc đến nhiều nhất: ${main.slice(0, 4).map((p) => `${p.ten} (${p.mentions} lần)`).join(', ')}.`);
  if (amounts.length) banChat.push(`Số tiền lớn nhất được nêu: ${amounts[0].raw}${amounts.length > 1 ? `; các mức khác: ${amounts.slice(1, 5).map((m) => m.raw).join(', ')}` : ''}.`);
  if (timeline.length) banChat.push(`Khoảng thời gian: ${timeline[0].thoiGian}${timeline.length > 1 ? ` – ${timeline.at(-1).thoiGian}` : ''} (${timeline.length} mốc).`);

  return {
    tomTat: short(an.tomTat, 700),
    banChat,
    crimes,
    people: people.filter((p) => p.mentions || p.known).map(({ ten, vaiTro, chucVu, chucVuTrich, suyRa, mentions, speaker, known: k }) => ({ ten, vaiTro, chucVu: chucVu || '', chucVuTrich: chucVuTrich || '', suyRa: suyRa || '', mentions, speaker: !!speaker, known: !!k })),
    unclear: all.filter((p) => !p.clear && (p.mentions || p.known || p.speaker)).map((p) => ({ ten: p.ten, lyDo: p.lyDo, cau: (p.cau || []).map((x) => x.t), nguoiKhai: [...new Set((p.cau || []).map((x) => x.speaker).filter(Boolean))] })),
    edges: edges.map((e) => ({ tu: e.from.ten, den: e.to.ten, loai: e.type, noiDung: e.verb, soTien: e.amount?.raw || '', trich: e.trich, src: e.src, n: e.n })),
    timeline,
    amounts: amounts.map((m) => m.raw),
    canLamRo: an.canLamRo || [],
    sentences: sents.length,
    ai: false,
  };
}

/* ---------------- AI ---------------- */

export const CASE_MAP_SYSTEM = `Bạn là điều tra viên cao cấp. Đọc tài liệu, lời khai và dựng sơ đồ bản chất vụ việc: ai làm gì, với ai, khi nào, bao nhiêu tiền, thuộc điều luật nào. Kết quả sẽ được máy đối chiếu lại với nguồn: mục nào không có nguyên văn / không đủ căn cứ sẽ bị loại.
QUY TẮC (bắt buộc):
${rules('nguon', 'nguyenVan', 'trung', 'tien', 'luat', 'banChat', 'gon')}`;

/** Ứng viên điều luật + danh mục gọn gửi AI, tính một lần từ toàn bộ nội dung (giống nhau giữa các phần → đọc lại từ cache). */
export function lawContext(full, { primary = null } = {}) {
  const cands = lawCandidates(full, { primary, cited: citedArticles(full) });
  return { cands, catalog: cands.length ? lawCatalog(cands) : '' };
}

const SCHEMA = `{"tomTat":"bản chất vụ việc 3–5 câu",
 "banChat":["ý then chốt, mỗi ý một câu ngắn"],
 "nguoi":[{"ten":"họ tên đầy đủ nguyên văn","vaiTro":"chức vụ nguyên văn, không có thì rỗng"}],
 "hanhVi":[{"ten":"hành vi","dieu":"số điều trong DANH MỤC, không đủ căn cứ thì rỗng","nguoi":["ai thực hiện"],"soTien":"nguyên văn hoặc rỗng","trich":"nguyên văn ≤ 40 từ làm căn cứ"}],
 "quanHe":[{"tu":"người đưa / chỉ đạo","den":"người nhận / được chỉ đạo","loai":"tien|chi-dao|khac","noiDung":"làm gì","soTien":"nguyên văn hoặc rỗng","trich":"nguyên văn câu nói về quan hệ / khoản tiền này"}],
 "moc":[{"thoiGian":"dd/mm/yyyy hoặc mô tả","suKien":"sự kiện"}],
 "chuaRo":["điểm còn thiếu hoặc mâu thuẫn giữa các lời khai"]}`;

export function caseMapPrompt(text, { known = [], primary = null, part = null, law = '' } = {}) {
  // Phần cố định trước (giống nhau giữa các phần của cùng tài liệu → đọc lại từ cache), nội dung đặt cuối.
  const stable = `${primary ? `Điều luật đang xem xét: Điều ${primary} BLHS.\n` : ''}${known.length ? `Người trong hồ sơ: ${known.map((p) => `${p.ten}${p.vaiTro ? ` (${p.vaiTro})` : ''}`).join('; ')}\n` : ''}${law ? `DANH MỤC ĐIỀU LUẬT (chỉ chọn trong này):\n${law}\n` : 'Chưa có điều luật nào đủ căn cứ trong nội dung: để "dieu" rỗng.\n'}Đọc NỘI DUNG ở cuối, trả về JSON:
${SCHEMA}
`;
  return withCache(stable, `${part ? `\nĐÂY LÀ PHẦN ${part[0]}/${part[1]} CỦA NỘI DUNG — chỉ trích xuất những gì có trong phần này, không nhắc lại phần khác, trả lời ngắn gọn.\n` : ''}
NỘI DUNG:
"""
${String(text).slice(0, 18000)}
"""`);
}

/** Sơ đồ hiện tại → JSON cùng định dạng AI trả về (gửi kèm khi yêu cầu AI làm tiếp). */
export function caseMapToAiJson(m) {
  return {
    tomTat: m.tomTat || '',
    banChat: m.banChat || [],
    nguoi: (m.people || []).map((p) => ({ ten: p.ten, vaiTro: p.vaiTro || '' })),
    hanhVi: (m.crimes || []).flatMap((c) => c.items.map((it) => ({ ten: it.ten, dieu: c.dieu || '', nguoi: it.nguoi || [], soTien: it.soTien || '', trich: it.trich || '' }))),
    quanHe: (m.edges || []).map((e) => ({ tu: e.tu, den: e.den, loai: e.loai, noiDung: e.noiDung || '', soTien: e.soTien || '' })),
    moc: (m.timeline || []).map((t) => ({ thoiGian: t.thoiGian, suKien: t.suKien })),
  };
}

/**
 * Yêu cầu AI làm tiếp trên sơ đồ đang có: gửi sơ đồ (JSON) + yêu cầu của người dùng + đoạn tài liệu liên quan;
 * AI trả về TOÀN BỘ sơ đồ sau khi sửa (cùng định dạng) để thay thế.
 */
export function caseMapRefinePrompt(m, request, { source = '', primary = null, max = 12000, law = '' } = {}) {
  const cur = JSON.stringify(caseMapToAiJson(m));
  const stable = `${primary ? `Điều luật đang xem xét: Điều ${primary} BLHS.\n` : ''}${law ? `DANH MỤC ĐIỀU LUẬT (chỉ chọn trong này):\n${law}\n` : ''}Nhiệm vụ: thực hiện YÊU CẦU CỦA ĐIỀU TRA VIÊN (ở cuối) trên SƠ ĐỒ VỤ VIỆC HIỆN TẠI: giữ nguyên những gì đúng, sửa / bổ sung / bỏ theo yêu cầu, không suy diễn ngoài tài liệu, không tạo mục trùng với mục đã có.
Trả về TOÀN BỘ sơ đồ sau khi sửa, cùng định dạng JSON:
${SCHEMA.replace('"chuaRo":["điểm còn thiếu hoặc mâu thuẫn giữa các lời khai"]', '"chuaRo":["…"],\n "ghiChu":"1 câu: đã thay đổi gì"')}
`;
  return withCache(stable, `
SƠ ĐỒ VỤ VIỆC HIỆN TẠI (JSON):
${cur.slice(0, 14000)}
${source ? `\nTÀI LIỆU, LỜI KHAI GỐC (để đối chiếu, bổ sung — chỉ dùng nội dung có trong này):\n"""\n${String(source).slice(0, max)}\n"""\n` : ''}
YÊU CẦU CỦA ĐIỀU TRA VIÊN:
"""
${String(request).slice(0, 2000)}
"""`);
}

/**
 * Ghép kết quả AI vào cấu trúc sơ đồ; điều luật được kiểm tra với Bộ luật trong phần mềm.
 * append = true: cộng dồn kết quả của phần tài liệu tiếp theo vào sơ đồ AI đã có (tài liệu dài chia nhiều phần).
 */
export function mergeAiCaseMap(base, raw, { append = false, replace = false, source = '', primary = null } = {}) {
  const j = typeof raw === 'string' ? extractJson(raw) : raw;
  if (!j || (!Array.isArray(j.hanhVi) && !Array.isArray(j.quanHe))) throw new Error('AI trả về kết quả không đúng định dạng — đang dùng sơ đồ phân tích trên máy');
  const clearKeys = new Set((base.people || []).map((p) => key(p.ten)));
  verifyAiAgainstSource(j, source, clearKeys);
  const verifyDropped = j._dropped;
  const uniqU = new Map([...(base.unclear || []), ...(j._unclear || [])].filter((u) => !clearKeys.has(key(u.ten))).map((u) => [key(u.ten), u]));
  const unclear = [...uniqU.values()];
  const uniq = (list, f) => [...new Map(list.map((x) => [f(x), x])).values()];
  // Điều luật: chỉ gán khi đủ căn cứ (đoạn trích nguyên văn khớp dấu hiệu của điều, chủ thể phù hợp); không thì
  // để “chưa xác định điều luật”. Hành vi trùng nhau (cùng điều, gần như cùng nội dung / cùng trích dẫn) chỉ giữ một.
  const cited = citedArticles(source);
  const byDieu = new Map();
  (j.hanhVi || []).forEach((h) => {
    if (!h?.ten) return;
    const d = String(h.dieu || '').replace(/\D+$/, '').replace(/^Điều\s*/i, '').trim();
    let c = findCrime(d);
    let canCu = '';
    let gateInfo = null;
    if (c) {
      const g = lawGate(c.dieu, { trich: h.trich, source, primary, cited });
      if (g.ok) {
        canCu = g.why;
        gateInfo = g;
      } else {
        verifyDropped.dieu++;
        c = null;
      }
    }
    const k = c ? c.dieu : 'khac';
    if (!byDieu.has(k)) byDieu.set(k, { dieu: c ? c.dieu : '', ten: c ? c.ten : 'Hành vi chưa xác định điều luật', canCu: c ? `AI xác định; ${canCu.charAt(0).toLocaleLowerCase('vi-VN')}${canCu.slice(1)}` : 'Chưa đủ căn cứ để gán điều luật — cần xác định thêm', can: c && gateInfo ? { nguon: gateInfo.nguon, muc: gateInfo.muc, yeuTo: gateInfo.yeuTo, thieu: gateInfo.thieu, vs: gateInfo.vs, ai: true } : null, items: [] });
    const item = { ten: String(h.ten || '').trim(), trich: short(h.trich || '', 220), nguoi: (h.nguoi || []).filter(Boolean), soTien: h.soTien || '' };
    const items = byDieu.get(k).items;
    if (!items.some((x) => sameText(x.ten, item.ten) || (item.trich && x.trich === item.trich))) items.push(item);
  });
  // replace: sơ đồ AI trả về (khi làm tiếp theo yêu cầu) thay thế hoàn toàn — người bị AI bỏ thì bỏ.
  const people = new Map(replace ? [] : base.people.map((p) => [key(p.ten), p]));
  const before = new Map(base.people.map((p) => [key(p.ten), p]));
  (j.nguoi || []).forEach((p) => p?.ten && people.set(key(p.ten), { ...(people.get(key(p.ten)) || before.get(key(p.ten)) || { mentions: 1 }), ten: p.ten, vaiTro: p.vaiTro || people.get(key(p.ten))?.vaiTro || before.get(key(p.ten))?.vaiTro || '' }));
  // AI không ghi (hoặc ghi sai) số tiền → giữ số tiền nguyên văn, căn cứ của cùng quan hệ đã có từ phân tích trên máy.
  const baseEdge = (e) => (base.edges || []).find((x) => key(x.tu) === key(e.tu) && key(x.den) === key(e.den) && x.loai === e.loai);
  const amtV = (e) => amountsIn(e.soTien || '')[0]?.v || 0;
  const ek = (e) => `${key(e.tu)}|${key(e.den)}|${e.loai}|${amtV(e)}`;
  const edges = [];
  (j.quanHe || []).forEach((e) => {
    if (!e?.tu || !e?.den) return;
    const loai = ['tien', 'chi-dao'].includes(e.loai) ? e.loai : 'khac';
    const b0 = baseEdge({ ...e, loai });
    const trich = e.trich ? short(e.trich, 220) : b0?.trich || '';
    // Dòng tiền AI nêu mà không có câu nguyên văn làm căn cứ (và máy cũng chưa thấy) → không đưa vào sơ đồ.
    if (loai === 'tien' && !trich) {
      verifyDropped.dongTien++;
      return;
    }
    edges.push({ tu: e.tu, den: e.den, loai, noiDung: e.noiDung || b0?.noiDung || '', soTien: e.soTien || b0?.soTien || '', trich, src: b0 ? b0.src : 'AI', n: 1 });
  });
  const edgesU = uniq(edges, ek);
  edgesU.forEach((e) => [e.tu, e.den].forEach((t) => !people.has(key(t)) && people.set(key(t), { ten: t, vaiTro: '', mentions: 1 })));
  const timeline = (j.moc || []).filter((m) => m?.suKien).map((m) => ({ ts: parseDate(String(m.thoiGian || ''))?.ts ?? Number.MAX_SAFE_INTEGER, thoiGian: m.thoiGian || '', suKien: m.suKien, src: 'AI' })).sort((a, b) => a.ts - b.ts);
  const chuaRo = (j.chuaRo || []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8);
  const tk = (t) => `${t.thoiGian}|${key(t.suKien).slice(0, 60)}`;
  const dedupeBan = (list) => list.filter((t, i) => list.findIndex((u) => sameText(u, t)) === i);
  if (append && base.ai) {
    const crimes = base.crimes.map((c) => ({ ...c, items: [...c.items] }));
    for (const c of byDieu.values()) {
      const have = crimes.find((x) => x.dieu === c.dieu && x.ten === c.ten);
      if (!have) crimes.push(c);
      else c.items.forEach((it) => !have.items.some((x) => sameText(x.ten, it.ten) || (it.trich && x.trich === it.trich)) && have.items.push(it));
    }
    return {
      ...base,
      tomTat: [base.tomTat, j.tomTat].filter(Boolean).join(' ').slice(0, 900),
      banChat: dedupeBan([...base.banChat, ...(j.banChat || [])]).slice(0, 16),
      crimes,
      people: [...people.values()],
      edges: uniq([...base.edges, ...edgesU], ek),
      timeline: uniq([...base.timeline, ...timeline], tk).sort((a, b) => a.ts - b.ts),
      chuaRo: dedupeBan([...(base.chuaRo || []), ...chuaRo]).slice(0, 10),
      ai: true,
      unclear,
      verifyDropped,
    };
  }
  if (replace) {
    return { ...base, tomTat: j.tomTat || '', banChat: dedupeBan(j.banChat || []), crimes: [...byDieu.values()], people: [...people.values()], edges: edgesU, timeline, chuaRo, ai: true, note: String(j.ghiChu || '').slice(0, 300), unclear, verifyDropped };
  }
  return {
    ...base,
    tomTat: j.tomTat || base.tomTat,
    banChat: (j.banChat || []).length ? dedupeBan(j.banChat) : base.banChat,
    crimes: byDieu.size ? [...byDieu.values()] : base.crimes,
    people: [...people.values()],
    edges: edgesU.length ? edgesU : base.edges,
    timeline: timeline.length ? timeline : base.timeline,
    chuaRo: chuaRo.length ? chuaRo : base.chuaRo || [],
    ai: true,
    unclear,
    verifyDropped,
  };
}

/**
 * Đối chiếu kết quả AI với lời khai / tài liệu gốc (sửa trực tiếp j): chức vụ, số tiền, trích dẫn chỉ giữ khi có
 * NGUYÊN VĂN trong nguồn; số tiền khớp giá trị thì dùng đúng cách ghi trong nguồn. Ghi lại số mục đã bỏ (j._dropped).
 */
export function verifyAiAgainstSource(j, source, allow = new Set()) {
  const src = key(source);
  const has = !!source;
  const amounts = has ? amountsIn(source) : [];
  const dropped = { chucVu: 0, soTien: 0, trich: 0, ten: 0, dieu: 0, dongTien: 0 };
  const unclear = new Map();
  // Tên: phải là họ tên đầy đủ, có nguyên văn trong lời khai (hoặc đã là tên rõ trong sơ đồ); không thì bỏ khỏi sơ đồ, ghi “chưa rõ”.
  const name = (t) => {
    const n = stripTitle(String(t || '').trim());
    if (!n) return '';
    if (nameVerbatim(n, source, allow)) return n;
    dropped.ten++;
    const k = key(n);
    if (!unclear.has(k)) unclear.set(k, { ten: n, lyDo: isFullName(n) ? 'AI nêu tên nhưng không có nguyên văn trong lời khai' : `Chỉ có tên gọi “${n}”, chưa có họ tên đầy đủ`, cau: [], nguoiKhai: [] });
    return '';
  };
  const money = (v) => {
    if (!v || !has) return v || '';
    const val = amountsIn(String(v))[0]?.v;
    const hit = val ? amounts.find((a) => a.v === val) : null;
    if (!hit) dropped.soTien++;
    return hit ? hit.raw : '';
  };
  j.nguoi = (j.nguoi || []).filter((p) => p?.ten && (p.ten = name(p.ten)));
  j.nguoi.forEach((p) => {
    if (has && p.vaiTro && !src.includes(key(p.vaiTro))) {
      dropped.chucVu++;
      p.vaiTro = '';
    }
  });
  (j.hanhVi || []).forEach((h) => {
    if (!h) return;
    h.nguoi = (h.nguoi || []).map(name).filter(Boolean);
    h.soTien = money(h.soTien);
    if (has && h.trich && !src.includes(key(h.trich).slice(0, 80))) {
      dropped.trich++;
      h.trich = '';
    }
  });
  j.quanHe = (j.quanHe || []).filter((e) => {
    if (!e) return false;
    e.tu = name(e.tu);
    e.den = name(e.den);
    e.soTien = money(e.soTien);
    // Trích dẫn của quan hệ / khoản tiền phải có nguyên văn; số tiền phải nằm trong chính câu trích đó.
    if (has && e.trich && !src.includes(key(e.trich).slice(0, 80))) {
      dropped.trich++;
      e.trich = '';
    }
    const v = e.soTien ? amountsIn(e.soTien)[0]?.v : 0;
    if (v && e.trich && !amountsIn(e.trich).some((a) => a.v === v)) {
      dropped.soTien++;
      e.soTien = '';
    }
    return e.tu && e.den && key(e.tu) !== key(e.den);
  });
  j._dropped = dropped;
  j._unclear = [...unclear.values()];
  return j;
}

/* ---------------- Sơ đồ cây ---------------- */

/** Cây: Vụ việc → Điều luật → Hành vi → người thực hiện / số tiền / trích dẫn; Người liên quan → quan hệ; Dòng thời gian. */
export function caseMapToTree(m, title = 'Vụ việc') {
  let n = 0;
  const id = (p) => `${p}-${++n}`;
  const crimes = m.crimes.map((c) => ({
    id: id('crime'),
    kind: 'crime',
    label: c.dieu ? `Điều ${c.dieu}` : 'Chưa xác định điều luật',
    sub: c.ten.replace(/^Tội /, ''),
    count: c.items.length,
    children: c.items.map((it) => ({
      id: id('act'),
      kind: 'act',
      label: it.ten,
      sub: it.soTien || '',
      children: [...it.nguoi.map((p) => ({ id: id('who'), kind: 'person', label: p, sub: 'Người thực hiện / liên quan' })), ...(it.trich ? [{ id: id('q'), kind: 'q', label: `“${it.trich}”` }] : [])],
    })),
  }));
  const people = m.people.length
    ? [
        {
          id: 'people',
          kind: 'common',
          label: 'Người liên quan',
          sub: `${m.people.length} người`,
          count: m.people.length,
          children: m.people.map((p) => {
            const rel = m.edges.filter((e) => e.tu === p.ten || e.den === p.ten);
            return {
              id: id('person'),
              kind: 'person',
              label: p.ten,
              sub: p.vaiTro || '',
              count: rel.length || null,
              children: rel.map((e) => ({ id: id('rel'), kind: e.loai === 'tien' ? 'money' : 'q', label: e.tu === p.ten ? `→ ${e.noiDung || 'liên quan'} ${e.den}${e.soTien ? `: ${e.soTien}` : ''}` : `← ${e.tu} ${e.noiDung || 'liên quan'}${e.soTien ? `: ${e.soTien}` : ''}` })),
            };
          }),
        },
      ]
    : [];
  const time = m.timeline.length ? [{ id: 'time', kind: 'docs', label: 'Dòng thời gian', sub: `${m.timeline.length} mốc`, count: m.timeline.length, children: m.timeline.map((t) => ({ id: id('t'), kind: 'time', label: t.suKien, sub: t.thoiGian })) }] : [];
  return { id: 'root', kind: 'root', label: title, sub: m.tomTat ? short(m.tomTat, 90) : '', count: m.crimes.reduce((s, c) => s + c.items.length, 0), children: [...crimes, ...people, ...time] };
}

/**
 * Chọn đoạn tài liệu liên quan nhất tới yêu cầu (gửi kèm khi AI làm tiếp): câu có từ khóa của yêu cầu / tên người
 * được nhắc được ưu tiên, giữ thứ tự gốc, không vượt quá max ký tự.
 */
export function relevantText(full, request, max = 12000) {
  const t = String(full || '').trim();
  if (t.length <= max) return t;
  const words = [...new Set(key(request).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2))];
  const sents = t.split(/(?<=[.!?;\n])\s+/).filter((x) => x.trim());
  const scored = sents.map((s, i) => {
    const k = key(s);
    return { i, s, score: words.reduce((n, w) => n + (k.includes(w) ? 1 : 0), 0) + (/\d/.test(s) ? 0.3 : 0) };
  });
  const pick = new Set();
  let len = 0;
  for (const x of [...scored].sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (len + x.s.length + 1 > max) continue;
    pick.add(x.i);
    len += x.s.length + 1;
  }
  return scored.filter((x) => pick.has(x.i)).map((x) => x.s).join(' ');
}

/** Kết quả đã lưu từ phiên bản cũ (chưa có “tên chưa rõ”): bỏ người chưa đủ họ tên khỏi sơ đồ và ghi vào danh sách chưa rõ. */
export function sanitizeNames(m) {
  if (!m || Array.isArray(m.unclear)) return m;
  const bad = (m.people || []).filter((p) => !isFullName(p.ten));
  const badK = new Set(bad.map((p) => key(p.ten)));
  const ok = (n) => !badK.has(key(n));
  return {
    ...m,
    people: (m.people || []).filter((p) => ok(p.ten)),
    edges: (m.edges || []).filter((e) => ok(e.tu) && ok(e.den)),
    crimes: (m.crimes || []).map((c) => ({ ...c, items: c.items.map((it) => ({ ...it, nguoi: (it.nguoi || []).filter(ok) })) })),
    unclear: bad.map((p) => ({ ten: p.ten, lyDo: `Chỉ có tên gọi “${p.ten}”, chưa có họ tên đầy đủ trong lời khai`, cau: [], nguoiKhai: [] })),
  };
}
