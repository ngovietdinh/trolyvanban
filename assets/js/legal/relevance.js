// Điều luật có thực sự liên quan không? — bộ lọc dùng chung cho phân tích trên máy và cho kết quả AI.
// Một điều chỉ được đưa ra khi có CĂN CỨ trong lời khai / tài liệu:
//   1. Tài liệu viện dẫn điều đó, hoặc đó là điều đang xét của hồ sơ; hoặc
//   2. Có câu khớp NHIỀU cụm từ đặc trưng của tội danh / hành vi (cụm càng hiếm trong Bộ luật càng nặng điểm — nên
//      “lập hồ sơ giả” không kéo theo tội gian lận bảo hiểm, “sử dụng lao động dưới 16 tuổi”…); và
//   3. Chủ thể phù hợp (tội về chức vụ phải có người có chức vụ, quyền hạn trong nội dung).
// Điều không đủ căn cứ không được tự thêm vào sơ đồ; hành vi đó ghi “chưa xác định điều luật”.
import { ALL_CRIMES, findCrime } from './engine.js';
import { termsOf, norm } from './terms.js';
import { splitSentences } from '../lib/summarize.js';

// Các tội “biến thể” khác tội cơ bản bởi một tình tiết trong tên (vô ý, kích động mạnh, vượt quá phòng vệ…):
// chỉ xét khi nội dung có nhắc tình tiết đó.
const QUALIFIERS = [['vô ý'], ['thi hành công vụ'], ['kích động'], ['phòng vệ', 'bắt giữ'], ['quy tắc nghề nghiệp', 'quy tắc hành chính'], ['con mới đẻ']];
const missingQualifier = (name, textNorm) => QUALIFIERS.some((ws) => ws.some((w) => norm(name).includes(w)) && !ws.some((w) => textNorm.includes(w)));

const JOB_CUE = /(giám đốc|chủ tịch|trưởng (?:phòng|ban|đoàn|khoa|bộ phận|công an)|phó (?:giám đốc|chủ tịch|trưởng)|kế toán|thủ quỹ|thủ kho|cán bộ|công chức|viên chức|chuyên viên|bí thư|chỉ huy|chủ đầu tư|thanh tra|điều tra viên|kiểm sát viên|thẩm phán|chức vụ|quyền hạn)/iu;

// Tình huống điển hình → điều thường gặp. Dùng (a) gợi ý ứng viên cho AI, (b) xác nhận điều AI chọn khi cụm từ trong
// danh mục khó khớp từng chữ (“nhận 50 triệu để làm thủ tục” ≠ chữ “hối lộ”). Số điều được kiểm tra với Bộ luật trong phần mềm.
const NUM = '\\d[\\d.,]*\\s*(?:nghìn|ngàn|triệu|tỷ|tỉ|đồng)';
const SEEDS = [
  { d: ['354'], re: new RegExp(`nhận\\b.{0,60}(?:tiền|quà|lợi ích|tài sản|${NUM})|đòi (?:tiền|hối lộ)|hối lộ|lại quả`, 'iu') },
  { d: ['364'], re: new RegExp(`(?:đưa|biếu|tặng)\\b.{0,60}(?:tiền|quà|lợi ích|tài sản|${NUM})|đưa hối lộ|hối lộ`, 'iu') },
  { d: ['365'], re: /môi giới|làm trung gian|trung gian (?:đưa|nhận)/iu },
  { d: ['353'], re: /chi khống|kê khống|khai khống|nâng khống|rút tiền|không nhập quỹ|không hạch toán|chiếm đoạt (?:tiền|tài sản)|tham ô/iu },
  { d: ['355'], re: /lợi dụng chức vụ.{0,50}chiếm đoạt|chiếm đoạt.{0,50}lợi dụng chức vụ/iu },
  { d: ['174'], re: /gian dối|lừa (?:dối|đảo)|thủ đoạn gian/iu },
  { d: ['341'], re: /làm giả (?:con dấu|giấy|tài liệu|chứng từ)|giả (?:con dấu|chữ ký)/iu },
  { d: ['359'], re: /giả mạo|sửa (?:chữa|đổi).{0,30}(?:giấy|chứng từ|hồ sơ|tài liệu)|hợp thức hóa/iu },
  { d: ['222'], re: /đấu thầu|chỉ định thầu|nhà thầu|trúng thầu|hồ sơ dự thầu/iu },
];

// Các điều dễ nhầm nhau: gửi kèm khi ≥ 2 điều trong nhóm cùng là ứng viên, để AI phân biệt đúng.
const CONFUSABLE = [
  { d: ['353', '355', '174', '175'], t: 'Tham ô (353): người có chức vụ chiếm đoạt tài sản MÌNH có trách nhiệm quản lý. Lạm dụng chức vụ chiếm đoạt (355): lợi dụng chức vụ, quyền hạn chiếm đoạt tài sản mình KHÔNG có trách nhiệm quản lý. Lừa đảo (174): dùng thủ đoạn gian dối để người khác giao tài sản. Lạm dụng tín nhiệm (175): nhận tài sản hợp pháp (vay, mượn, thuê, hợp đồng) rồi chiếm đoạt hoặc không trả.' },
  { d: ['354', '364', '365'], t: 'Nhận hối lộ (354): người có chức vụ nhận / sẽ nhận lợi ích để làm hoặc không làm việc vì người đưa. Đưa hối lộ (364): người đưa lợi ích. Môi giới hối lộ (365): người trung gian, không phải người nhận hay đưa.' },
  { d: ['356', '357', '358', '360'], t: 'Lợi dụng chức vụ khi thi hành công vụ (356): làm trái công vụ vì vụ lợi / động cơ cá nhân. Lạm quyền (357): vượt quá quyền hạn làm trái công vụ. Thiếu trách nhiệm (360): vô ý, không làm / làm không đúng nhiệm vụ gây hậu quả nghiêm trọng.' },
  { d: ['341', '359'], t: 'Làm giả con dấu, tài liệu của cơ quan, tổ chức (341): tạo ra giấy tờ giả. Giả mạo trong công tác (359): người có chức vụ sửa chữa, làm sai lệch nội dung giấy tờ vì vụ lợi / động cơ cá nhân.' },
];

let IDX = null;
function index() {
  if (IDX) return IDX;
  const N = ALL_CRIMES.length;
  const df = new Map();
  const dfName = new Map();
  const prof = new Map();
  for (const c of ALL_CRIMES) {
    const nameBi = termsOf(c.ten.replace(/^Tội\s+/i, '')).bi;
    const all = new Set(nameBi);
    c.hanhVi.forEach((h) => termsOf(h.ten).bi.forEach((t) => all.add(t)));
    all.forEach((t) => df.set(t, (df.get(t) || 0) + 1));
    nameBi.forEach((t) => dfName.set(t, (dfName.get(t) || 0) + 1));
    // Vế đầu của tên (trước “hoặc” / “và” / dấu phẩy) là phần định danh tội: “cố ý gây thương tích” trong “… hoặc gây tổn hại sức khỏe…”.
    const head = c.ten.replace(/^Tội\s+/i, '').split(/\s+(?:hoặc|và)\s+|[,;]/)[0];
    prof.set(c.dieu, { ten: c.ten, nameBi, headBi: termsOf(head).bi, nameCore: null, all, thin: c.hanhVi.length <= 1, needJob: /^Người có chức vụ/i.test(c.chuThe || '') });
  }
  // Cụm đặc trưng của tên tội danh: bỏ cụm chung chung xuất hiện ở nhiều tên (“quy định”, “sử dụng”, “tài sản”…).
  prof.forEach((p) => (p.nameCore = new Set([...p.headBi].filter((t) => (dfName.get(t) || 0) < 15))));
  IDX = { prof, idf: (t) => Math.log(N / (df.get(t) || 1)), nidf: (t) => Math.log(N / (dfName.get(t) || 1)) };
  return IDX;
}

const sentencesOf = (text) =>
  splitSentences(String(text || ''))
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter((t) => t.length >= 8)
    .map((t) => ({ t, bi: termsOf(t).bi }));

const seedHit = (dieu, text) => SEEDS.some((s) => s.d.includes(String(dieu)) && s.re.test(text));

/**
 * Căn cứ của một điều với nội dung: câu khớp tốt nhất (số cụm đặc trưng, điểm), tên tội danh có xuất hiện không,
 * chủ thể có phù hợp không, và kết luận show (đủ để tự đưa ra) / candidate (đáng để AI xem xét).
 */
export function crimeEvidence(dieu, text, { sentences = null, primary = null, cited = null } = {}) {
  const ix = index();
  const d = String(dieu);
  const p = ix.prof.get(d);
  if (!p) return null;
  const sents = sentences || sentencesOf(text);
  let best = { ev: 0, n: 0, s: '' };
  const union = new Set();
  for (const s of sents) {
    let ev = 0;
    let n = 0;
    p.all.forEach((t) => {
      if (s.bi.has(t)) {
        ev += ix.idf(t);
        n++;
      }
    });
    if (ev > best.ev) best = { ev, n, s: s.t };
    s.bi.forEach((t) => union.add(t));
  }
  // Tên tội danh “có mặt” trong nội dung: ≥ một nửa cụm đặc trưng của tên xuất hiện (và ít nhất một cụm).
  let hit = 0;
  p.nameCore.forEach((t) => union.has(t) && hit++);
  const nameHit = hit >= 1 && p.nameCore.size > 0 && hit / p.nameCore.size >= 0.4;
  const isCited = !!cited?.has(d);
  const isPrimary = primary != null && String(primary) === d;
  const subjectOk = !p.needJob || JOB_CUE.test(text || '');
  const seed = seedHit(d, text || '');
  const qualOk = !missingQualifier(p.ten, norm(text || ''));
  const strong = (nameHit && best.ev >= 4) || (!p.thin && best.n >= 3 && best.ev >= 12);
  const show = isCited || isPrimary || (subjectOk && qualOk && strong);
  const candidate = show || (nameHit && qualOk) || (seed && subjectOk) || (!p.thin && best.n >= 3 && best.ev >= 8);
  const why = isCited ? `Tài liệu viện dẫn Điều ${d}` : isPrimary ? 'Điều đang xét của hồ sơ' : nameHit ? 'Nội dung nêu đúng tên tội danh' : strong ? `Câu khớp ${best.n} cụm từ đặc trưng của hành vi trong điều này` : '';
  return { dieu: d, ev: Math.round(best.ev * 10) / 10, n: best.n, trich: best.s, nameHit, subjectOk, thin: p.thin, seed, isCited, isPrimary, show, candidate, why };
}

/**
 * Trong các điều “đủ căn cứ”, chỉ giữ điều được viện dẫn / đang xét và tối đa 3 điều có điểm cao nhất, mỗi điều
 * phải đạt ≥ 35% điểm của điều cao nhất (tránh kéo theo các điều chỉ gần nghĩa).
 */
export function pickShown(list) {
  const pinned = list.filter((e) => e.isCited || e.isPrimary);
  const rest = list.filter((e) => e.show && !e.isCited && !e.isPrimary).sort((a, b) => b.ev - a.ev);
  const top = Math.max(rest[0]?.ev || 0, ...pinned.map((e) => e.ev));
  return [...pinned, ...rest.filter((e) => e.ev >= 0.35 * top).slice(0, 3)];
}

/** Điều đáng đưa cho AI xem xét (ưu tiên: viện dẫn, điều đang xét, đủ căn cứ, rồi theo điểm); tối đa limit. */
export function lawCandidates(text, { primary = null, cited = null, limit = 8 } = {}) {
  const sents = sentencesOf(text);
  const out = [];
  for (const c of ALL_CRIMES) {
    const e = crimeEvidence(c.dieu, text, { sentences: sents, primary, cited });
    if (e?.candidate) out.push({ ...e, ten: c.ten, rank: (e.isCited ? 100 : 0) + (e.isPrimary ? 90 : 0) + (e.show ? 50 : 0) + (e.seed ? 8 : 0) + e.ev });
  }
  return out.sort((a, b) => b.rank - a.rank).slice(0, limit);
}

/**
 * Điều AI chọn cho một hành vi có đủ căn cứ không? Cần đoạn trích nguyên văn, và: điều được viện dẫn / đang xét, hoặc
 * đoạn trích khớp ≥ 2 cụm đặc trưng (hoặc tên tội danh, hoặc đúng tình huống điển hình), và chủ thể phù hợp.
 */
export function lawGate(dieu, { trich = '', source = '', primary = null, cited = null } = {}) {
  const d = String(dieu || '').replace(/\D+$/, '').replace(/^Điều\s*/i, '').trim();
  if (!d || !findCrime(d)) return { ok: false, why: 'Điều không có trong Bộ luật của phần mềm' };
  if (cited?.has(d) || (primary != null && String(primary) === d)) return { ok: true, why: 'Tài liệu viện dẫn / điều đang xét' };
  if (!String(trich).trim()) return { ok: false, why: 'Không có đoạn trích nguyên văn làm căn cứ' };
  const e = crimeEvidence(d, trich, { primary, cited });
  if (/^Người có chức vụ/i.test(findCrime(d).chuThe || '') && !JOB_CUE.test(`${source} ${trich}`)) return { ok: false, why: 'Điều này cần chủ thể là người có chức vụ, quyền hạn — nội dung chưa nêu' };
  const lex = (e.nameHit && e.ev >= 4) || (!e.thin && e.n >= 3 && e.ev >= 10);
  if (lex || (e.seed && (!e.thin || e.nameHit))) return { ok: true, why: e.why || 'Đoạn trích khớp dấu hiệu của điều này' };
  return { ok: false, why: 'Đoạn trích chưa đủ dấu hiệu của điều này' };
}

/** Điều được viện dẫn trong văn bản (“Điều 354”, “điểm a khoản 1 Điều 353 BLHS”). */
export function citedArticles(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(/Điều\s+(\d{1,3}[a-zđ]?)\b(?!\s*(?:Luật|Nghị|Thông))/giu)) if (findCrime(m[1])) out.add(findCrime(m[1]).dieu);
  return out;
}

/** Danh mục gọn gửi cho AI: số điều, tên, chủ thể, dấu hiệu chính — không kèm danh sách hành vi (tiết kiệm token). */
export function lawCatalog(cands) {
  const cut = (s, n) => {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    return t.length <= n ? t : `${t.slice(0, n).replace(/\s+\S*$/, '')}…`;
  };
  const lines = cands
    .map((x) => findCrime(x.dieu || x))
    .filter(Boolean)
    .map((c) => `Điều ${c.dieu} — ${c.ten.replace(/^Tội\s+/i, '')} | chủ thể: ${cut(c.chuThe, 70)} | dấu hiệu: ${(c.dauHieu || []).slice(0, 2).map((x) => cut(x, 90)).join('; ')}`);
  return `${lines.join('\n')}${confusableHints(cands)}`;
}

/** Mục “PHÂN BIỆT” cho các điều dễ nhầm (chỉ khi ≥ 2 điều trong nhóm cùng là ứng viên); rỗng nếu không có. */
export function confusableHints(cands) {
  const have = new Set(cands.map((x) => String(x.dieu || x)));
  const hints = CONFUSABLE.filter((g) => g.d.filter((x) => have.has(x)).length >= 2).map((g) => `- ${g.t}`);
  return hints.length ? `\nPHÂN BIỆT CÁC ĐIỀU DỄ NHẦM:\n${hints.join('\n')}` : '';
}
