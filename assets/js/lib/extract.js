// Trích văn bản thuần từ tệp người dùng tải lên: .docx (Word), .pdf (có lớp chữ), .txt, .md, .html.
import { docxToText } from './docx.js';

let pdfjsPromise = null;
async function loadPdfjs() {
  pdfjsPromise ??= import('../../vendor/pdfjs/pdf.min.mjs').then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    return m;
  });
  return pdfjsPromise;
}

/** Ghép các mẩu chữ của một trang PDF thành dòng theo tọa độ. */
function pageText(items) {
  const lines = [];
  let cur = null;
  for (const it of items) {
    if (!('str' in it)) continue;
    const y = Math.round(it.transform[5]);
    if (!cur || Math.abs(cur.y - y) > 3) {
      cur = { y, parts: [] };
      lines.push(cur);
    }
    cur.parts.push(it.str);
    if (it.hasEOL) cur = null;
  }
  return lines
    .map((l) => l.parts.join('').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export async function pdfToText(buffer) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(pageText(content.items));
  }
  return { text: pages.join('\n\n'), pages: doc.numPages };
}

const htmlToText = (s) =>
  s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

/** Trả về { text, pages?, kind } hoặc ném lỗi tiếng Việt. */
export async function extractText(file) {
  const name = file.name || '';
  const buf = await file.arrayBuffer();
  if (/\.docx$/i.test(name)) return { text: await docxToText(buf), kind: 'docx' };
  if (/\.pdf$/i.test(name)) {
    const r = await pdfToText(buf);
    if (r.text.replace(/\s/g, '').length < 30) throw new Error(`“${name}” là PDF dạng ảnh quét (không có lớp chữ) — cần chuyển sang Word hoặc PDF có chữ (OCR) trước khi tải lên.`);
    return { ...r, kind: 'pdf' };
  }
  if (/\.(txt|md|csv)$/i.test(name)) return { text: new TextDecoder().decode(buf), kind: 'txt' };
  if (/\.html?$/i.test(name)) return { text: htmlToText(new TextDecoder().decode(buf)), kind: 'html' };
  if (/\.doc$/i.test(name)) throw new Error(`“${name}” là định dạng Word cũ (.doc) — mở bằng Word và lưu lại dạng .docx rồi tải lên.`);
  throw new Error(`Chưa hỗ trợ định dạng tệp “${name}”. Dùng .docx, .pdf, .txt.`);
}
