// Toàn văn 90 án lệ kèm phần mềm (assets/data/an-le.json) — lấy từ Cổng thông tin điện tử về án lệ của Tòa án nhân dân
// tối cao (anle.toaan.gov.vn): số, tên, lĩnh vực, ngày thông qua / công bố / áp dụng, nguồn án lệ, vị trí nội dung, tình
// huống, giải pháp pháp lý, quy định pháp luật liên quan, từ khóa và toàn văn. Án lệ là văn bản của Nhà nước, không thuộc
// phạm vi bảo hộ quyền tác giả. Tệp ~2 MB nên chỉ tải khi cần (trang Án lệ, tab Bản án tương tự) và giữ trong bộ nhớ.
let cache = null;
let pending = null;

/** Tải một lần: Map số án lệ → bản ghi. Lỗi mạng / thiếu tệp → Map rỗng (giao diện tự ghi "chưa có"). */
export function loadAnLeData() {
  if (cache) return Promise.resolve(cache);
  pending ??= fetch(new URL('../../data/an-le.json', import.meta.url))
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((arr) => {
      cache = new Map((Array.isArray(arr) ? arr : []).map((a) => [a.so, a]));
      return cache;
    });
  return pending;
}

/** Bản ghi đã tải (đồng bộ) hoặc null khi chưa tải. */
export const anLeDataSync = () => cache;

/** Bản ghi kho (loại 'an-le') dựng từ dữ liệu kèm phần mềm — cùng dạng với parseKhoDoc để thẩm tra dùng chung. */
export function khoDocFromData(a, dieu = []) {
  return {
    loai: 'an-le',
    so: a.so,
    ten: a.ten,
    khaiQuat: a.khaiQuat || [a.tinhHuong && `Tình huống án lệ: ${a.tinhHuong}`, a.giaiPhap && `Giải pháp pháp lý: ${a.giaiPhap}`].filter(Boolean).join('\n'),
    giaiPhap: a.giaiPhap || '',
    dieu: [...new Set([...(dieu || []), ...(a.dieu || [])])],
    name: `Án lệ ${a.so} (TANDTC)`,
    nguon: 'tandtc',
    url: a.url || '',
    text: a.text || '',
  };
}

/* ---------------- Cấu trúc án lệ, xuất Word ---------------- */
const SEC_RE = [
  ['nguon', /^Nguồn án lệ\s*:?\s*$/i],
  ['viTri', /^Vị trí nội dung (?:của )?án lệ\s*:?\s*$/i],
  ['khaiQuat', /^Khái quát nội dung (?:của )?án lệ\s*:?\s*$/i],
  ['tinhHuong', /^-?\s*Tình huống án lệ\s*:?\s*$/i],
  ['giaiPhap', /^-?\s*Giải pháp pháp lý\s*:?\s*$/i],
  ['quyDinh', /^Quy định của pháp luật liên quan đến án lệ\s*:?\s*$/i],
  ['tuKhoa', /^Từ kh(?:óa|oá) của án lệ\s*:?\s*$/i],
  ['noiDung', /^NỘI DUNG (?:VỤ ÁN|VỤ VIỆC|VIỆC DÂN SỰ)\s*:?\s*$/],
  ['nhanDinh', /^NHẬN ĐỊNH CỦA (?:T[ÒO][AÀ] ÁN|HỘI ĐỒNG[^:]*)\s*:?\s*$/],
  ['quyetDinh', /^QUYẾT ĐỊNH\s*:?\s*$/],
  ['noiDungAnLe', /^NỘI DUNG ÁN LỆ\s*:?\s*$/],
];
const SEC_TITLE = { nguon: 'Nguồn án lệ:', viTri: 'Vị trí nội dung án lệ:', khaiQuat: 'Khái quát nội dung án lệ:', tinhHuong: '- Tình huống án lệ:', giaiPhap: '- Giải pháp pháp lý:', quyDinh: 'Quy định của pháp luật liên quan đến án lệ:', tuKhoa: 'Từ khóa của án lệ:', noiDung: 'NỘI DUNG VỤ ÁN:', nhanDinh: 'NHẬN ĐỊNH CỦA TÒA ÁN:', quyetDinh: 'QUYẾT ĐỊNH:', noiDungAnLe: 'NỘI DUNG ÁN LỆ:' };
const OLD_NHAN_DINH = /^Hội đồng (?:Thẩm phán|giám đốc thẩm|xét xử)[^:.]{0,80}nhận định\s*:$/i;
const SEC_ORDER = ['nguon', 'viTri', 'khaiQuat', 'tinhHuong', 'giaiPhap', 'quyDinh', 'tuKhoa', 'noiDung', 'nhanDinh', 'quyetDinh', 'noiDungAnLe'];

/**
 * Tách toàn văn (mỗi dòng một đoạn) thành các mục theo đúng bố cục án lệ của TANDTC:
 * { head: [dòng mở đầu], secs: [{ key, title, paras: [] }] }. Mục không có trong văn bản thì bỏ qua.
 */
export function anLeSections(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const head = [];
  const secs = [];
  const notes = [];
  let cur = null;
  for (const l of lines) {
    // Số trang của bản PDF lọt vào giữa chữ; chú thích cuối trang "Án lệ này do Hội đồng xét xử … đề xuất." đưa lên phần mở đầu.
    if (/^\d{1,3}$/.test(l)) continue;
    if (/^Án lệ này do Hội đồng/.test(l)) {
      notes.push(l);
      continue;
    }
    const hit = SEC_RE.find(([, re]) => re.test(l));
    if (hit) {
      cur = { key: hit[0], title: SEC_TITLE[hit[0]], paras: [] };
      secs.push(cur);
      continue;
    }
    // Tiêu đề và nội dung trên cùng một dòng ("Nguồn án lệ: Quyết định…").
    const inline = SEC_RE.find(([, re]) => re.test(l.split(':')[0] + ':')) && l.includes(':');
    if (inline && !cur?.paras.length && l.split(':')[0].length < 60) {
      const key = SEC_RE.find(([, re]) => re.test(l.split(':')[0] + ':'))[0];
      cur = { key, title: SEC_TITLE[key], paras: [l.slice(l.indexOf(':') + 1).trim()].filter(Boolean) };
      secs.push(cur);
      continue;
    }
    // Án lệ công bố năm 2016 không có đề mục "NHẬN ĐỊNH CỦA TÒA ÁN": phần nhận định bắt đầu bằng câu
    // "Hội đồng Thẩm phán Tòa án nhân dân tối cao nhận định:" (giữ câu đó làm đoạn đầu của mục).
    if (cur?.key === 'noiDung' && OLD_NHAN_DINH.test(l)) {
      cur = { key: 'nhanDinh', title: SEC_TITLE.nhanDinh, paras: [l] };
      secs.push(cur);
      continue;
    }
    // Đoạn bị ngắt trang (dòng sau bắt đầu bằng chữ thường, dòng trước chưa kết câu) → nối lại.
    const list = cur ? cur.paras : head;
    if (list.length && /^\p{Ll}/u.test(l) && !/[.;:!?”"…)]$/.test(list[list.length - 1])) list[list.length - 1] += ' ' + l;
    else list.push(l);
  }
  return { head, secs, notes };
}

const run = (text, o = {}) => ({ text, ...o });
const P = (text, o = {}) => ({ runs: Array.isArray(text) ? text : [run(text)], align: 'justify', indent: true, ...o });

/** Doc model (layout 'plain') của một án lệ theo đúng cấu trúc công bố; `brief` = chỉ phần khái quát (không nội dung vụ án). */
export function anLeDoc(a, { brief = false } = {}) {
  const { head, secs, notes } = anLeSections(a.text);
  const body = [];
  // Dòng mở đầu: bỏ số và tên án lệ đã đưa lên tiêu đề (tên có thể bị ngắt thành 2–3 dòng), giữ câu "Được Hội đồng Thẩm phán … thông qua…".
  const fold = (x) => String(x || '').toLowerCase().replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
  const ten = fold(a.ten);
  const intro = head.filter((x) => !/^(ÁN LỆ SỐ|Án lệ số)\s/i.test(x) && !(fold(x).length >= 8 && ten.includes(fold(x))));
  for (const l of intro) body.push(P(l));
  if (!head.some((x) => /thông qua/i.test(x))) body.push(P(`Được Hội đồng Thẩm phán Tòa án nhân dân tối cao thông qua ngày ${a.thongQua || '……'} và được công bố theo Quyết định số ${a.qdCongBo || '……'} ngày ${a.ngayCongBo || '……'} của Chánh án Tòa án nhân dân tối cao.`));
  for (const n of notes) body.push(P([run(n, { italic: true })]));
  const want = brief ? SEC_ORDER.slice(0, 7) : SEC_ORDER;
  const bySec = Object.fromEntries(secs.map((s) => [s.key, s]));
  for (const key of want) {
    let s = bySec[key];
    // Thiếu trong toàn văn (bản quét) nhưng có trong dữ liệu đã tách.
    if (!s && a[key]) s = { key, title: SEC_TITLE[key], paras: String(a[key]).split('\n').filter(Boolean) };
    if (!s) continue;
    const big = ['noiDung', 'nhanDinh', 'quyetDinh', 'noiDungAnLe'].includes(key);
    body.push(P([run(s.title, { bold: true })], { indent: !big && key !== 'khaiQuat', align: big ? 'center' : 'justify', spaceBefore: true }));
    for (const pr of s.paras) body.push(P(pr, { indent: true }));
  }
  if (a.ocr) body.push(P([run('Ghi chú: Cổng án lệ đăng bản quét; chữ trong văn bản này do phần mềm nhận dạng tự động, có thể sai chính tả — đối chiếu bản gốc trên anle.toaan.gov.vn khi trích dẫn.', { italic: true })], { spaceBefore: true }));
  if (a.url) body.push(P([run(`Nguồn: ${a.url}`, { italic: true })], { indent: false }));
  return { typeId: 'an-le', layout: 'plain', titles: [`ÁN LỆ SỐ ${a.so}`, a.ten || ''], title: { name: `Án lệ ${a.so}`, subject: a.ten || '' }, header: null, body, sign: null, dualSign: null, signers: null };
}

/** Nhiều án lệ trong một tệp Word: mỗi án lệ một phần, ngắt trang giữa các án lệ. */
export function anLeDocMany(list, { brief = false } = {}) {
  const body = [];
  list.forEach((a, i) => {
    const d = anLeDoc(a, { brief });
    if (i) body.push({ pageBreak: true });
    body.push(P([run(`ÁN LỆ SỐ ${a.so}`, { bold: true })], { align: 'center', indent: false, size: 30, spaceBefore: !!i }));
    body.push(P([run(a.ten || '', { bold: true })], { align: 'center', indent: false }));
    body.push(...d.body);
  });
  return { typeId: 'an-le-tuyen-tap', layout: 'plain', titles: [`TUYỂN TẬP ${list.length} ÁN LỆ`, 'Hội đồng Thẩm phán Tòa án nhân dân tối cao'], title: { name: `Tuyển tập ${list.length} án lệ`, subject: '' }, header: null, body, sign: null, dualSign: null, signers: null };
}

/* ---------------- Gợi ý án lệ theo nội dung vụ án ---------------- */
const STOP = new Set('va la cua co khong duoc trong voi cho de bi tai ve nguoi nay cac mot nhung tu theo khi thi do nhu da se con den tren ra vao lam bang nen hoac vi toi an le tinh huong giai phap phap ly truong hop phai bi cao toa chiu trach nhiem hinh su nam dieu bo luat ve viec cua tai san'.split(' '));
const foldChar = (c) => (c === 'đ' || c === 'Đ' ? 'd' : c.normalize('NFD')[0].toLowerCase());
const fold = (s) => [...String(s || '')].map(foldChar).join('');
const words = (s) =>
  fold(s)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
const bigrams = (ws) => {
  const out = new Set();
  for (let i = 0; i + 1 < ws.length; i++) out.add(`${ws[i]} ${ws[i + 1]}`);
  return out;
};
/** Cụm từ khóa của án lệ: các cụm trong ngoặc kép ở "Từ khóa", tên án lệ (sau "Về"), bỏ cụm quá ngắn / chỉ là tên tội chung. */
function phrasesOf(a) {
  const out = new Set();
  for (const m of String(a.tuKhoa || '').matchAll(/[“"]([^”"]{4,80})[”"]/g)) out.add(m[1].trim());
  for (const part of String(a.tuKhoa || '').split(/[;\n]/)) {
    const t = part.replace(/[“”"]/g, '').trim();
    if (t.length >= 8 && t.length <= 80) out.add(t);
  }
  return [...out].filter((x) => words(x).length >= 2);
}
/**
 * Chấm điểm án lệ theo nội dung vụ án (chữ của tài liệu, tội danh…): cụm từ khóa xuất hiện nguyên văn (không dấu) được
 * 4 điểm; cặp từ liền nhau của tình huống án lệ có trong vụ án được 1 điểm (tối đa 6). Trả về [{ a, score, why }] ≥ 4 điểm.
 */
export function suggestAnLe(caseText, data, { limit = 5, minScore = 4, linhVuc = null } = {}) {
  const text = fold(String(caseText || '').slice(0, 120000)).replace(/\s+/g, ' ');
  if (text.length < 40 || !data) return [];
  const caseBi = bigrams(words(text));
  const out = [];
  for (const a of data.values()) {
    if (linhVuc && a.linhVuc !== linhVuc) continue;
    let score = 0;
    const why = [];
    for (const ph of phrasesOf(a)) {
      if (text.includes(fold(ph).replace(/\s+/g, ' '))) {
        score += 4;
        why.push(ph);
      }
    }
    const th = bigrams(words(`${a.ten || ''} ${a.tinhHuong || a.khaiQuat || ''}`));
    let hit = 0;
    for (const b of th) if (caseBi.has(b)) hit++;
    score += Math.min(6, hit);
    if (score >= minScore) out.push({ a, score, why: why.slice(0, 4), hit });
  }
  return out.sort((x, y) => y.score - x.score || x.a.num - y.a.num).slice(0, limit);
}
