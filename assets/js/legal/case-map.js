// Sơ đồ vụ việc: từ các biên bản lời khai đã chọn hoặc tài liệu tải lên, dựng nhanh bản chất vụ việc —
// điều luật, hành vi (ai làm, trích dẫn, số tiền), người liên quan và vai trò, quan hệ / dòng tiền giữa các
// người, dòng thời gian. Chạy trên máy; có AI thì phân tích sâu hơn (cùng cấu trúc dữ liệu).
import { findCrime } from './engine.js';
import { analyzeOffline, amountsIn } from './analyze.js';
import { extractJson } from '../lib/ai.js';
import { withCache } from '../lib/cache-mark.js';

const short = (s, n = 160) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t.replace(/[.;,:]$/, '') : `${t.slice(0, n).replace(/\s+\S*$/, '')}…`;
};
const key = (s) => String(s || '').normalize('NFC').toLocaleLowerCase('vi-VN').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const UP = 'A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ';
const TITLE = '(?:ông|bà|anh|chị|em|cô|chú|bác|cháu|đồng chí|đ\\/c|giám đốc|phó giám đốc|chủ tịch|phó chủ tịch|trưởng phòng|phó trưởng phòng|kế toán trưởng|kế toán|thủ quỹ|thủ kho|cán bộ|chuyên viên|bị can|người làm chứng|đối tượng|hộ|ông\\/bà)';
const NAME_RE = new RegExp(`(?<![\\p{L}])${TITLE}\\s+((?:[${UP}][\\p{Ll}]*)(?:\\s+[${UP}][\\p{Ll}]*){0,3})`, 'gu');
const MONEY_V = /(đưa|chuyển khoản|chuyển|giao|trả|chi|nộp|biếu|cho vay|vay|hối lộ|lại quả|chia)/i;
const RECV_V = /(nhận|thu|lấy)/i;
const ORDER_V = /(chỉ đạo|giao cho|yêu cầu|bảo|ép|nhờ|đề nghị|phê duyệt|ký duyệt|duyệt|ra lệnh|quyết định)/i;
const OTHER_V = /(thông đồng|bàn bạc|thống nhất|móc nối|câu kết|gặp|liên hệ|gọi điện|ký|lập)/i;

/** Tách câu, giữ nguồn. */
function sentences(sources) {
  return sources.flatMap((s, si) =>
    String(s.text || '')
      .replace(/\r/g, '')
      .split(/(?<=[.!?;])\s+|\n+/)
      .map((t) => t.replace(/^\s*(?:hỏi|đáp|trả lời|h|đ|tl)\s*[:.\-–]\s*/i, '').trim())
      .filter((t) => t.length > 8)
      .map((t) => ({ t, src: s.label || `Nguồn ${si + 1}`, speaker: s.speaker || '' })),
  );
}

/** Người được nhắc tới: tên có danh xưng / chức danh đứng trước, người khai, người trong hồ sơ. */
export function findPeople(sents, known = []) {
  const map = new Map();
  const put = (ten, extra = {}) => {
    ten = String(ten || '').trim().replace(/\s+/g, ' ');
    if (!ten || ten.length < 2) return null;
    const k = key(ten);
    // Gộp tên ngắn (Bình, Văn Bình) vào tên đầy đủ đã có (Trần Văn Bình).
    const full = [...map.values()].find((p) => p.key === k || p.key.endsWith(` ${k}`) || k.endsWith(` ${p.key}`));
    if (full) {
      if (k.length > full.key.length) Object.assign(full, { ten, key: k });
      Object.assign(full, Object.fromEntries(Object.entries(extra).filter(([, v]) => v)));
      return full;
    }
    const p = { ten, key: k, vaiTro: '', mentions: 0, ...extra };
    map.set(k, p);
    return p;
  };
  known.forEach((p) => put(p.ten, { vaiTro: p.vaiTro || '', known: true }));
  sents.forEach((s) => s.speaker && put(s.speaker, { speaker: true }));
  // Danh xưng viết hoa đầu câu (“Bà Lê Thị Cúc…”) → viết thường để nhận diện tên ngay sau.
  const TITLE_CI = new RegExp(`(?<![\\p{L}])${TITLE}(?=\\s)`, 'giu');
  for (const s of sents) for (const m of s.t.replace(TITLE_CI, (x) => x.toLocaleLowerCase('vi-VN')).matchAll(NAME_RE)) put(m[1]);
  const people = [...map.values()];
  // Bí danh để nhận diện trong câu: tên đầy đủ, 2 chữ cuối, “ông/bà + tên”.
  people.forEach((p) => {
    const w = p.ten.split(' ');
    p.aliases = [...new Set([p.key, w.length >= 3 ? key(w.slice(-2).join(' ')) : null, w.length >= 2 ? `ông ${key(w.at(-1))}` : null, w.length >= 2 ? `bà ${key(w.at(-1))}` : null, w.length >= 2 ? `anh ${key(w.at(-1))}` : null, w.length >= 2 ? `chị ${key(w.at(-1))}` : null].filter(Boolean))];
  });
  return people;
}

/** Vị trí người được nhắc trong câu (theo thứ tự xuất hiện); “tôi” = người khai. */
function actorsIn(s, people) {
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
    const sp = people.find((p) => p.key === key(s.speaker));
    if (sp && !hits.some((h) => h.p === sp)) hits.push({ p: sp, at: t.indexOf(' tôi ') });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.p);
}

const parseDate = (s) => {
  let m = /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/iu.exec(s) || /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/.exec(s);
  if (m) return { ts: Date.UTC(+m[3], +m[2] - 1, +m[1]), label: `${String(m[1]).padStart(2, '0')}/${String(m[2]).padStart(2, '0')}/${m[3]}` };
  m = /tháng\s+(\d{1,2})[/\s]+(?:năm\s+)?(\d{4})/iu.exec(s) || /\b(\d{1,2})\/(\d{4})\b/.exec(s);
  if (m && +m[1] <= 12) return { ts: Date.UTC(+m[2], +m[1] - 1, 1), label: `${String(m[1]).padStart(2, '0')}/${m[2]}` };
  m = /năm\s+(\d{4})/iu.exec(s);
  if (m && +m[1] > 1970 && +m[1] < 2100) return { ts: Date.UTC(+m[1], 0, 1), label: m[1] };
  return null;
};
const fmtMoney = (v) => (v >= 1e9 ? `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} tỷ đồng` : v >= 1e6 ? `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu đồng` : `${v.toLocaleString('vi-VN')} đồng`);

/**
 * Dựng sơ đồ vụ việc trên máy.
 * sources: [{ label, speaker, text }]; known: [{ ten, vaiTro }] (người trong hồ sơ); primary: điều chính (nếu có).
 */
export function buildCaseMap({ sources = [], known = [], primary = null } = {}) {
  const sents = sentences(sources);
  const text = sents.map((s) => s.t).join('\n');
  const an = text ? analyzeOffline(text, { primary }) : { tomTat: '', crimes: [], items: [] };
  const people = findPeople(sents, known);

  // Quan hệ, dòng tiền giữa các người.
  const edges = [];
  for (const s of sents) {
    const a = actorsIn(s, people);
    const money = amountsIn(s.t).sort((x, y) => y.v - x.v)[0] || null;
    const type = MONEY_V.test(s.t) || (RECV_V.test(s.t) && money) ? 'tien' : ORDER_V.test(s.t) ? 'chi-dao' : OTHER_V.test(s.t) ? 'khac' : null;
    a.forEach((p) => p.mentions++);
    if (a.length < 2 || !type) continue;
    let [from, to] = a;
    // “B nhận … của / từ A” → A → B; “nhận” đứng trước người thứ hai.
    const tk = key(s.t);
    if (type === 'tien' && RECV_V.test(s.t) && !MONEY_V.test(s.t)) [from, to] = [to, from];
    if (/(của|từ)\s/.test(tk) && RECV_V.test(s.t) && tk.indexOf(' của ') > -1) [from, to] = [a[1], a[0]];
    // Mũi tên luôn đi từ người đưa → người nhận, nên “nhận” được ghi thành “đưa”.
    let verb = (s.t.match(type === 'tien' ? MONEY_V : type === 'chi-dao' ? ORDER_V : OTHER_V) || [''])[0].toLowerCase();
    if (type === 'tien' && !verb) verb = 'đưa';
    const dup = edges.find((e) => e.from === from && e.to === to && e.type === type && (e.amount?.v || 0) === (money?.v || 0));
    if (dup) {
      dup.n++;
      continue;
    }
    edges.push({ from, to, type, verb, amount: money, trich: short(s.t, 200), src: s.src, n: 1 });
  }

  // Vai trò suy ra từ quan hệ.
  people.forEach((p) => {
    if (p.vaiTro) return;
    const out = edges.filter((e) => e.from === p);
    const inn = edges.filter((e) => e.to === p);
    p.vaiTro = out.some((e) => e.type === 'chi-dao') ? 'Người chỉ đạo' : inn.some((e) => e.type === 'tien') && !out.some((e) => e.type === 'tien') ? 'Người nhận tiền' : out.some((e) => e.type === 'tien') ? 'Người đưa / chuyển tiền' : p.speaker ? 'Người khai' : 'Người liên quan';
  });

  // Hành vi theo điều luật: ai thực hiện (người được nhắc trong đoạn trích), số tiền.
  const crimes = an.crimes
    .filter((c) => findCrime(c.dieu) && (c.strong || String(c.dieu) === String(primary) || an.items.some((x) => x.dieu === c.dieu && x.hanhViId && x.score >= 0.6)))
    .slice(0, 5)
    .map((c) => ({
      dieu: c.dieu,
      ten: findCrime(c.dieu).ten,
      // Ưu tiên hành vi khớp Bộ luật; câu mô tả rời chỉ dùng khi điều đó chưa có hành vi khớp.
      items: (an.items.some((x) => x.dieu === c.dieu && x.hanhViId) ? an.items.filter((x) => x.dieu === c.dieu && x.hanhViId && (x.score >= 0.55 || String(c.dieu) === String(primary))) : an.items.filter((x) => x.dieu === c.dieu))
        .slice(0, 8)
        .map((x) => {
          const s = sents.find((y) => x.trich && y.t.includes(x.trich.slice(0, 40))) || { t: x.trich, speaker: '' };
          const m = amountsIn(x.trich || '').sort((a, b) => b.v - a.v)[0];
          return { ten: x.ten, trich: short(x.trich, 220), nguoi: actorsIn(s, people).map((p) => p.ten), soTien: m ? m.raw : '' };
        }),
    }))
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
  if (amounts.length) banChat.push(`Số tiền lớn nhất được nêu: ${fmtMoney(amounts[0].v)}${amounts.length > 1 ? `; các mức khác: ${amounts.slice(1, 5).map((m) => m.raw).join(', ')}` : ''}.`);
  if (timeline.length) banChat.push(`Khoảng thời gian: ${timeline[0].thoiGian}${timeline.length > 1 ? ` – ${timeline.at(-1).thoiGian}` : ''} (${timeline.length} mốc).`);

  return {
    tomTat: short(an.tomTat, 700),
    banChat,
    crimes,
    people: people.filter((p) => p.mentions || p.known).map(({ ten, vaiTro, mentions, speaker, known: k }) => ({ ten, vaiTro, mentions, speaker: !!speaker, known: !!k })),
    edges: edges.map((e) => ({ tu: e.from.ten, den: e.to.ten, loai: e.type, noiDung: e.verb, soTien: e.amount?.raw || '', trich: e.trich, src: e.src, n: e.n })),
    timeline,
    amounts: amounts.map((m) => m.raw),
    sentences: sents.length,
    ai: false,
  };
}

/* ---------------- AI ---------------- */

export const CASE_MAP_SYSTEM = 'Bạn là điều tra viên cao cấp. Đọc tài liệu, lời khai và dựng sơ đồ bản chất vụ việc: ai làm gì, với ai, khi nào, bao nhiêu tiền, thuộc điều luật nào. Chỉ dựa trên nội dung được cung cấp, không suy diễn. Chỉ trả về JSON hợp lệ.';

export function caseMapPrompt(text, { known = [], primary = null, part = null } = {}) {
  // Phần cố định trước (giống nhau giữa các phần của cùng tài liệu → đọc lại từ cache), nội dung đặt cuối.
  const stable = `${primary ? `Điều luật đang xem xét: Điều ${primary} BLHS.\n` : ''}${known.length ? `Người trong hồ sơ: ${known.map((p) => `${p.ten}${p.vaiTro ? ` (${p.vaiTro})` : ''}`).join('; ')}\n` : ''}Đọc NỘI DUNG ở cuối, trả về JSON:
{"tomTat":"bản chất vụ việc 3–5 câu",
 "banChat":["các ý then chốt, mỗi ý một câu ngắn"],
 "nguoi":[{"ten":"họ tên","vaiTro":"vai trò trong vụ việc"}],
 "hanhVi":[{"ten":"hành vi","dieu":"số điều BLHS","nguoi":["ai thực hiện"],"soTien":"nếu có","trich":"trích nguyên văn ngắn"}],
 "quanHe":[{"tu":"người A","den":"người B","loai":"tien|chi-dao|khac","noiDung":"A làm gì với B","soTien":"nếu có"}],
 "moc":[{"thoiGian":"dd/mm/yyyy hoặc mô tả","suKien":"sự kiện"}]}
`;
  return withCache(stable, `${part ? `\nĐÂY LÀ PHẦN ${part[0]}/${part[1]} CỦA NỘI DUNG — chỉ trích xuất những gì có trong phần này, trả lời ngắn gọn.\n` : ''}
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
export function caseMapRefinePrompt(m, request, { source = '', primary = null, max = 12000 } = {}) {
  const cur = JSON.stringify(caseMapToAiJson(m));
  const stable = `${primary ? `Điều luật đang xem xét: Điều ${primary} BLHS.\n` : ''}Nhiệm vụ: thực hiện YÊU CẦU CỦA ĐIỀU TRA VIÊN (ở cuối) trên SƠ ĐỒ VỤ VIỆC HIỆN TẠI: giữ nguyên những gì đúng, sửa / bổ sung / bỏ theo yêu cầu, không suy diễn ngoài tài liệu.
Trả về TOÀN BỘ sơ đồ sau khi sửa, cùng định dạng JSON:
{"tomTat":"…","banChat":["…"],"nguoi":[{"ten":"…","vaiTro":"…"}],"hanhVi":[{"ten":"…","dieu":"…","nguoi":["…"],"soTien":"…","trich":"…"}],"quanHe":[{"tu":"…","den":"…","loai":"tien|chi-dao|khac","noiDung":"…","soTien":"…"}],"moc":[{"thoiGian":"…","suKien":"…"}],"ghiChu":"1 câu: đã thay đổi gì"}
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
export function mergeAiCaseMap(base, raw, { append = false, replace = false } = {}) {
  const j = typeof raw === 'string' ? extractJson(raw) : raw;
  if (!j || (!Array.isArray(j.hanhVi) && !Array.isArray(j.quanHe))) throw new Error('AI trả về kết quả không đúng định dạng — đang dùng sơ đồ phân tích trên máy');
  const byDieu = new Map();
  (j.hanhVi || []).forEach((h) => {
    const d = String(h.dieu || '').replace(/\D+$/, '').replace(/^Điều\s*/i, '').trim();
    const c = findCrime(d);
    const k = c ? c.dieu : 'khac';
    if (!byDieu.has(k)) byDieu.set(k, { dieu: c ? c.dieu : '', ten: c ? c.ten : 'Hành vi khác (chưa xác định điều luật)', items: [] });
    byDieu.get(k).items.push({ ten: String(h.ten || '').trim(), trich: short(h.trich || '', 220), nguoi: (h.nguoi || []).filter(Boolean), soTien: h.soTien || '' });
  });
  // replace: sơ đồ AI trả về (khi làm tiếp theo yêu cầu) thay thế hoàn toàn — người bị AI bỏ thì bỏ.
  const people = new Map(replace ? [] : base.people.map((p) => [key(p.ten), p]));
  const before = new Map(base.people.map((p) => [key(p.ten), p]));
  (j.nguoi || []).forEach((p) => p?.ten && people.set(key(p.ten), { ...(people.get(key(p.ten)) || before.get(key(p.ten)) || { mentions: 1 }), ten: p.ten, vaiTro: p.vaiTro || people.get(key(p.ten))?.vaiTro || '' }));
  const edges = (j.quanHe || []).filter((e) => e?.tu && e?.den).map((e) => ({ tu: e.tu, den: e.den, loai: ['tien', 'chi-dao'].includes(e.loai) ? e.loai : 'khac', noiDung: e.noiDung || '', soTien: e.soTien || '', trich: '', src: 'AI', n: 1 }));
  edges.forEach((e) => [e.tu, e.den].forEach((t) => !people.has(key(t)) && people.set(key(t), { ten: t, vaiTro: 'Người liên quan', mentions: 1 })));
  const timeline = (j.moc || []).filter((m) => m?.suKien).map((m) => ({ ts: parseDate(String(m.thoiGian || ''))?.ts ?? Number.MAX_SAFE_INTEGER, thoiGian: m.thoiGian || '', suKien: m.suKien, src: 'AI' })).sort((a, b) => a.ts - b.ts);
  if (append && base.ai) {
    const crimes = base.crimes.map((c) => ({ ...c, items: [...c.items] }));
    for (const c of byDieu.values()) {
      const have = crimes.find((x) => x.dieu === c.dieu && x.ten === c.ten);
      if (!have) crimes.push(c);
      else c.items.forEach((it) => !have.items.some((x) => key(x.ten) === key(it.ten)) && have.items.push(it));
    }
    const ek = (e) => `${key(e.tu)}|${key(e.den)}|${e.loai}|${key(e.soTien)}`;
    const tk = (t) => `${t.thoiGian}|${key(t.suKien).slice(0, 60)}`;
    const uniq = (list, f) => [...new Map(list.map((x) => [f(x), x])).values()];
    return {
      ...base,
      tomTat: [base.tomTat, j.tomTat].filter(Boolean).join(' ').slice(0, 900),
      banChat: uniq([...base.banChat, ...(j.banChat || [])], key).slice(0, 16),
      crimes,
      people: [...people.values()],
      edges: uniq([...base.edges, ...edges], ek),
      timeline: uniq([...base.timeline, ...timeline], tk).sort((a, b) => a.ts - b.ts),
      ai: true,
    };
  }
  if (replace) {
    return { ...base, tomTat: j.tomTat || '', banChat: j.banChat || [], crimes: [...byDieu.values()], people: [...people.values()], edges, timeline, ai: true, note: String(j.ghiChu || '').slice(0, 300) };
  }
  return {
    ...base,
    tomTat: j.tomTat || base.tomTat,
    banChat: (j.banChat || []).length ? j.banChat : base.banChat,
    crimes: byDieu.size ? [...byDieu.values()] : base.crimes,
    people: [...people.values()],
    edges: edges.length ? edges : base.edges,
    timeline: timeline.length ? timeline : base.timeline,
    ai: true,
  };
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
