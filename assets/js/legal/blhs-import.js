// Đọc nguyên văn Bộ luật Hình sự (văn bản hợp nhất) từ văn bản thuần — tệp Word đã trích chữ,
// tệp .txt hoặc nội dung dán từ cổng văn bản pháp luật — để cập nhật danh mục tội danh:
// tên điều chính thức, nội dung từng khoản, dấu hiệu định tội (khoản 1), tình tiết định khung (khoản 2 trở đi).

const ROMAN = /^(?:CHƯƠNG|Chương)\s+([IVXLCDM]+)\b\.?\s*(.*)$/;
const MUC = /^(?:MỤC|Mục)\s+(\d+)\.?\s*(.*)$/;
const DIEU = /^Điều\s+(\d{1,3}[a-zđ]?)\s*[.:]\s*(.*)$/i;
const KHOAN = /^(\d{1,2})\.\s+(.*)$/;
const DIEM = /^([a-zđ])\)\s*(.*)$/;

const clean = (s) =>
  String(s || '')
    .replace(/\[\d+\]/g, '') // chú thích của văn bản hợp nhất
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const strip = (s) => clean(s).replace(/[;,.:]+$/, '').trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Tách nội dung một điều thành các khoản và điểm. */
export function splitClauses(lines) {
  const khoan = [];
  let cur = null;
  for (const raw of lines) {
    const line = clean(raw);
    if (!line) continue;
    let m;
    if ((m = KHOAN.exec(line))) {
      cur = { so: +m[1], text: m[2], diem: [] };
      khoan.push(cur);
    } else if ((m = DIEM.exec(line)) && cur) {
      cur.diem.push({ ky: m[1], text: m[2] });
    } else if (cur) {
      if (cur.diem.length) cur.diem.at(-1).text += ' ' + line;
      else cur.text += ' ' + line;
    } else {
      cur = { so: 0, text: line, diem: [] };
      khoan.push(cur);
    }
  }
  return khoan;
}

/** Dấu hiệu định tội (khoản 1) và tình tiết định khung (khoản 2 trở đi). */
export function deriveElements(khoan) {
  const k1 = khoan.find((k) => k.so === 1) || khoan[0];
  const dauHieu = [];
  if (k1) {
    const intro = strip(k1.text.replace(/,?\s*thì bị phạt.*$/i, '').replace(/,?\s*bị phạt.*$/i, ''));
    if (intro) dauHieu.push(cap(intro.length > 420 ? intro.slice(0, 417) + '…' : intro));
    k1.diem.slice(0, 10).forEach((d) => {
      const t = strip(d.text);
      if (t) dauHieu.push(cap(t));
    });
  }
  const dinhKhung = [];
  for (const k of khoan) {
    if (k.so < 2) continue;
    if (/^(pháp nhân thương mại|người phạm tội còn (có thể )?bị)/i.test(k.text)) continue;
    if (/chuẩn bị phạm tội/i.test(k.text) && !k.diem.length) {
      dinhKhung.push(`Chuẩn bị phạm tội (khoản ${k.so})`);
      continue;
    }
    for (const d of k.diem) {
      const t = strip(d.text);
      if (t && !/^(đã bị xử phạt|đã bị kết án)/i.test(t)) dinhKhung.push(`${cap(t)} (khoản ${k.so})`);
    }
  }
  return { dauHieu, dinhKhung: [...new Set(dinhKhung)].slice(0, 40) };
}

/**
 * Phân tích văn bản Bộ luật → { articles: { [dieu]: { ten, chuong, muc, text, baiBo, dauHieu, dinhKhung } }, chapters }.
 * Chỉ lấy Phần thứ hai (Điều 108 – 425).
 */
export function parseBlhsText(text) {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n');
  const articles = {};
  const chapters = {};
  let chuong = null;
  let muc = null;
  let cur = null;
  let pendingChapterTitle = false;
  const flush = () => {
    if (!cur) return;
    const n = parseInt(cur.dieu, 10);
    if (n >= 108 && n <= 425) {
      const body = cur.lines.map(clean).filter(Boolean);
      const ten = strip(cur.ten.replace(/\((được |đã được )?bãi bỏ\)/i, ''));
      const baiBo = /bãi bỏ/i.test(cur.ten) || (body.join(' ').length < 220 && /bãi bỏ/i.test(body.join(' '))) || (!ten && /bãi bỏ/i.test(body.join(' ')));
      const khoan = splitClauses(body);
      const { dauHieu, dinhKhung } = deriveElements(khoan);
      articles[cur.dieu] = { ten: ten ? (/^tội/i.test(ten) ? cap(ten) : ten) : '', chuong, muc, text: body.join('\n'), baiBo, dauHieu, dinhKhung };
    }
    cur = null;
  };
  for (const raw of lines) {
    const line = clean(raw);
    if (!line) continue;
    let m;
    if ((m = ROMAN.exec(line))) {
      flush();
      chuong = m[1];
      muc = null;
      chapters[chuong] = m[2] ? strip(m[2]) : '';
      pendingChapterTitle = !m[2];
      continue;
    }
    if (pendingChapterTitle && line === line.toLocaleUpperCase('vi-VN') && !DIEU.test(line)) {
      chapters[chuong] = strip(line);
      pendingChapterTitle = false;
      continue;
    }
    pendingChapterTitle = false;
    if ((m = MUC.exec(line)) && !cur?.lines.length) {
      flush();
      muc = `Mục ${m[1]}${m[2] ? '. ' + strip(m[2]) : ''}`;
      continue;
    }
    if ((m = DIEU.exec(line))) {
      flush();
      cur = { dieu: m[1].toLowerCase(), ten: m[2], lines: [] };
      continue;
    }
    if (/^PHẦN THỨ/i.test(line)) {
      flush();
      continue;
    }
    if (cur) cur.lines.push(line);
  }
  flush();
  return { articles, chapters };
}

/**
 * So sánh với danh mục tích hợp: điều mới, điều khác tên, điều bị bãi bỏ.
 * catalog: [[dieu, ten, …]]
 */
export function compareWithCatalog(parsed, catalog, curatedNames = {}) {
  const norm = (s) => clean(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const known = new Map(catalog.map((e) => [e[0], e[1]]));
  for (const [d, t] of Object.entries(curatedNames)) known.set(d, t);
  const added = [];
  const renamed = [];
  const repealed = [];
  for (const [dieu, a] of Object.entries(parsed.articles)) {
    if (a.baiBo) {
      repealed.push(dieu);
      continue;
    }
    if (!known.has(dieu) || !known.get(dieu)) added.push({ dieu, ten: a.ten });
    else if (norm(known.get(dieu)) !== norm(a.ten)) renamed.push({ dieu, cu: known.get(dieu), moi: a.ten });
  }
  return { total: Object.keys(parsed.articles).length, added, renamed, repealed };
}
