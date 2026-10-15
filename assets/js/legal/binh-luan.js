// Sách "Bình luận khoa học Bộ luật Hình sự" — tách theo Phần / Chương / Mục / Điều để đọc trong phần mềm.
//
// Nguyên tắc: GIỮ NGUYÊN 100% NỘI DUNG. Bộ tách chỉ chia các dòng của sách vào đúng chỗ (tiêu đề cấu trúc, nguyên văn
// điều luật, phần "Bình luận"), không thêm, bớt hay sửa chữ nào. rebuild() ghép lại phải ra đúng từng dòng của bản gốc
// (trừ Mục lục cuối sách — chỉ là số trang, phần mềm có mục lục riêng); verify() kiểm tra điều đó khi nạp sách.

const ROMAN = /^[IVXLC]+$/;
const isUpperLine = (s) => {
  const letters = s.replace(/[^\p{L}]/gu, '');
  if (letters.length < 3) return false;
  const up = [...letters].filter((c) => c === c.toLocaleUpperCase('vi') && c !== c.toLocaleLowerCase('vi')).length;
  return up / letters.length > 0.85;
};
/** Khóa so sánh số điều: 217 < 217a < 218. */
export const dieuKey = (so) => {
  const m = /^(\d+)([a-zđ]?)$/i.exec(String(so).trim());
  return m ? +m[1] * 10 + (m[2] ? m[2].toLowerCase().charCodeAt(0) - 96 : 0) : NaN;
};
export const normSo = (so) => String(so).trim().toLowerCase();

const RE_PHAN = /^\s*PHẦN\s+THỨ\s+(NHẤT|HAI|BA|TƯ|NĂM)\b\s*(.*)$/iu;
const RE_CHUONG = /^\s*CHƯƠNG\s+([IVXLC]+)\b\.?\s*(.*)$/iu;
const RE_MUC = /^\s*MỤC\s+(\d{1,2})\s*[.:]?\s*(.*)$/iu;
const RE_DIEU = /^\s*Điều\s+(\d{1,3}[a-zđ]?)\s*(?:[.:]\s*|\s+(?=\p{Lu}))(.+)$/u;
const RE_BL = /^\s*Bình\s+luận\s*:?\s*$/iu;
const RE_TOC = /^\s*MỤC\s+LỤC\s*$/iu;

/**
 * Tách văn bản sách → { title, articles, order, notes, skipped }.
 * articles[i] = { so, ten, head, phan, chuong, muc, vb: [dòng điều luật], bl: [dòng bình luận], fn: [số chú thích] }
 * order: thứ tự gốc các phần tử để ghép lại ({ s: dòng tiêu đề cấu trúc } | { a: chỉ số điều }).
 */
export function parseBinhLuan(text, notes = [], { maxDieu = 426 } = {}) {
  let lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n');
  // Bỏ Mục lục cuối sách (dòng "MỤC LỤC" mà phần lớn các dòng sau có số trang ở cuối).
  let skippedToc = 0;
  for (let i = lines.length - 1; i > lines.length * 0.5; i--) {
    if (!RE_TOC.test(lines[i])) continue;
    const after = lines.slice(i + 1).filter((l) => l.trim());
    if (after.length && after.filter((l) => /\t\s*\d+\s*$/.test(l)).length / after.length > 0.6) {
      skippedToc = lines.length - i;
      lines = lines.slice(0, i);
    }
    break;
  }

  const articles = [];
  const order = [];
  const title = [];
  let cur = null; // điều đang đọc
  let inBl = false;
  let last = 0;
  const ctx = { phan: '', chuong: '', muc: '' };
  let pending = null; // tiêu đề cấu trúc đang chờ dòng tên viết hoa tiếp theo

  const pushStruct = (s) => order.push({ s });
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    // Dòng tên tiếp theo của Phần / Chương / Mục (viết hoa, xuống dòng).
    if (pending && t && isUpperLine(t) && !RE_DIEU.test(t) && !RE_CHUONG.test(t) && !RE_MUC.test(t) && !RE_PHAN.test(t)) {
      ctx[pending] = `${ctx[pending]} ${t}`.replace(/\s+/g, ' ').trim();
      pushStruct(line);
      continue;
    }
    if (t) pending = null;

    let m;
    if ((m = RE_PHAN.exec(t)) && t.length < 120 && (!m[2] || isUpperLine(m[2]))) {
      ctx.phan = t.replace(/\s+/g, ' ');
      ctx.chuong = '';
      ctx.muc = '';
      pending = 'phan';
      cur = null;
      pushStruct(line);
      continue;
    }
    if ((m = RE_CHUONG.exec(t)) && ROMAN.test(m[1].toUpperCase()) && t.length < 160 && (!m[2] || isUpperLine(m[2]))) {
      ctx.chuong = `Chương ${m[1].toUpperCase()}${m[2] ? ` ${m[2].trim()}` : ''}`;
      ctx.muc = '';
      pending = 'chuong';
      cur = null;
      pushStruct(line);
      continue;
    }
    if ((m = RE_MUC.exec(t)) && t.length < 160 && m[2] && isUpperLine(m[2])) {
      ctx.muc = `Mục ${m[1]}. ${m[2].trim()}`;
      pending = 'muc';
      cur = null;
      pushStruct(line);
      continue;
    }
    if ((m = RE_DIEU.exec(t))) {
      const k = dieuKey(m[1]);
      const ten = m[2].trim();
      // Tiêu đề điều: số tăng dần, không quá số điều của Bộ luật, không phải câu dẫn ("Điều 170 quy định…").
      if (k > last && k <= maxDieu * 10 + 9 && !/^(quy định|và|hoặc|của|này|nêu|được|có|thì|là|về|trên)\b/iu.test(ten) && t.length < 260) {
        last = k;
        cur = { so: normSo(m[1]), ten, head: line, phan: ctx.phan, chuong: ctx.chuong, muc: ctx.muc, vb: [], bl: [], fn: [] };
        inBl = false;
        articles.push(cur);
        order.push({ a: articles.length - 1 });
        continue;
      }
    }
    if (!cur) {
      if (articles.length) pushStruct(line);
      else title.push(line);
      continue;
    }
    if (!inBl && RE_BL.test(t)) {
      inBl = true;
      cur.blHead = line;
      continue;
    }
    (inBl ? cur.bl : cur.vb).push(line);
    for (const f of line.matchAll(/\{\{fn:(\d+)\}\}/g)) cur.fn.push(+f[1]);
  }
  for (const a of articles) {
    // Bỏ dòng trống đầu / cuối của từng phần (chỉ khoảng trắng, không phải nội dung).
    for (const k of ['vb', 'bl']) {
      while (a[k].length && !a[k][0].trim()) a[k].shift();
      while (a[k].length && !a[k][a[k].length - 1].trim()) a[k].pop();
    }
  }
  return { title, articles, order, notes, skipped: { toc: skippedToc } };
}

/** Ghép lại toàn bộ dòng nội dung theo thứ tự gốc (để đối chiếu với bản gốc). */
export function rebuild(book) {
  const out = [...book.title];
  for (const o of book.order) {
    if ('s' in o) out.push(o.s);
    else {
      const a = book.articles[o.a];
      out.push(a.head, ...a.vb);
      if (a.blHead != null) out.push(a.blHead);
      out.push(...a.bl);
    }
  }
  return out;
}

/** Đối chiếu: mọi dòng có chữ của bản gốc (trừ Mục lục) phải có mặt đúng thứ tự, không thêm, không đổi. */
export function verify(text, book) {
  let lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n');
  if (book.skipped?.toc) lines = lines.slice(0, lines.length - book.skipped.toc);
  const a = lines.filter((l) => l.trim());
  const b = rebuild(book).filter((l) => l.trim());
  if (a.length !== b.length) return { ok: false, reason: `Số dòng khác nhau: gốc ${a.length}, sau khi tách ${b.length}` };
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return { ok: false, reason: `Dòng ${i + 1} khác bản gốc`, at: i };
  const nRefs = (String(text).match(/\{\{fn:\d+\}\}/g) || []).length;
  if (nRefs !== (book.notes || []).length) return { ok: false, reason: `Số chú thích không khớp: ${nRefs} dấu, ${(book.notes || []).length} nội dung` };
  return { ok: true, lines: a.length };
}

/* ---------------- Tra cứu ---------------- */
const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();

export function findArticle(book, so) {
  if (!book) return null;
  const k = normSo(so);
  return book.articles.find((a) => a.so === k) || null;
}

/** Tìm toàn văn (không dấu): trả về [{ so, ten, where: 'ten'|'vb'|'bl', snippet }] — tối đa limit kết quả. */
export function searchBook(book, query, limit = 60) {
  const q = fold(query).trim();
  if (!book || q.length < 2) return [];
  const num = /^(?:dieu\s*)?(\d{1,3}[a-z]?)$/.exec(q);
  if (num) {
    const a = findArticle(book, num[1]);
    return a ? [{ so: a.so, ten: a.ten, where: 'ten', snippet: '' }] : [];
  }
  const out = [];
  const snip = (line, idx) => {
    const s = Math.max(0, idx - 60);
    return `${s ? '…' : ''}${line.slice(s, idx + q.length + 80).replace(/\{\{fn:\d+\}\}/g, '')}${idx + q.length + 80 < line.length ? '…' : ''}`;
  };
  for (const a of book.articles) {
    if (fold(a.ten).includes(q)) {
      out.push({ so: a.so, ten: a.ten, where: 'ten', snippet: '' });
      continue;
    }
    let hit = null;
    for (const where of ['vb', 'bl']) {
      for (const line of a[where]) {
        const i = fold(line).indexOf(q);
        if (i >= 0) {
          hit = { so: a.so, ten: a.ten, where, snippet: snip(line, i) };
          break;
        }
      }
      if (hit) break;
    }
    if (hit) out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

/** Cây mục lục: [{ phan, chuongs: [{ chuong, mucs: [{ muc, items: [{so, ten}] }] }] }]. */
export function tocTree(book) {
  const tree = [];
  for (const a of book?.articles || []) {
    let p = tree.at(-1);
    if (!p || p.phan !== a.phan) tree.push((p = { phan: a.phan, chuongs: [] }));
    let c = p.chuongs.at(-1);
    if (!c || c.chuong !== a.chuong) p.chuongs.push((c = { chuong: a.chuong, mucs: [] }));
    let m = c.mucs.at(-1);
    if (!m || m.muc !== a.muc) c.mucs.push((m = { muc: a.muc, items: [] }));
    m.items.push({ so: a.so, ten: a.ten });
  }
  return tree;
}
