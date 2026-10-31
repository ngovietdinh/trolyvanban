// Trích văn bản thuần từ tệp người dùng tải lên: .docx, .doc (Word cũ, tự chuyển), .rtf, .pdf (có lớp chữ), .txt, .md, .html.
import { docxToText } from './docx.js';
import { docToText, sniffDoc } from './doc.js';
import { fixLegacy } from './vn-legacy.js';

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
    const content = await page.getTextContent({ disableNormalization: true });
    // Văn bản phông cũ (TCVN3, VNI) → Unicode.
    pages.push(fixLegacy(pageText(content.items)));
  }
  return { text: pages.join('\n\n'), pages: doc.numPages, pageTexts: pages };
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

/* ---------------- Nhận dạng chữ bản quét: chế độ và nguồn AI ----------------
 * Cài đặt 'ocr-mode' (riêng tài khoản): 'may' (mặc định — Tesseract + mô hình ngôn ngữ pháp lý trên máy, không gửi gì ra ngoài),
 * 'may-ai' (như trên, rồi AI soát lỗi từng dòng chữ — chỉ gửi chữ đã nhận dạng), 'ai' (AI đọc ảnh từng trang — chính xác nhất
 * với bản quét mờ, chữ hoa có dấu; gửi ảnh trang tới dịch vụ AI). Hai chế độ sau chỉ chạy khi có AI và không bị chế độ bảo mật chặn.
 * Ứng dụng đăng ký nguồn AI bằng setOcrAi(() => ({ call, hasAI })). */
export const OCR_MODES = { may: 'Trên máy', 'may-ai': 'Trên máy + AI soát lỗi', ai: 'AI đọc ảnh trang' };
let ocrAi = () => null;
export const setOcrAi = (fn) => (ocrAi = typeof fn === 'function' ? fn : () => null);
let ocrModeGetter = () => 'may';
export const setOcrModeGetter = (fn) => (ocrModeGetter = typeof fn === 'function' ? fn : () => 'may');
export const ocrMode = () => (OCR_MODES[ocrModeGetter()] ? ocrModeGetter() : 'may');
/** Bộ nhận dạng trên máy: 'tesseract' (mặc định, kèm sẵn + sửa dấu theo mô hình ngôn ngữ) | 'vietocr' (bản cài đặt: PaddleOCR + VietOCR, cần tải mô hình). */
let ocrEngineGetter = () => 'tesseract';
export const setOcrEngineGetter = (fn) => (ocrEngineGetter = typeof fn === 'function' ? fn : () => 'tesseract');
export const ocrEngine = () => (ocrEngineGetter() === 'vietocr' ? 'vietocr' : 'tesseract');

/** Nhận dạng chữ (OCR) cho PDF ảnh quét / ảnh chụp — dùng bộ chuyển PDF sang Word; theo chế độ đã cài. */
async function ocrText(file, onProgress, { mode = ocrMode() } = {}) {
  const [{ convertFile }, { flowToText }] = await Promise.all([import('./pdf-convert.js'), import('./docx-flow.js')]);
  const ai = mode !== 'may' ? ocrAi() : null;
  let aiPage = null;
  let aiFix = null;
  if (ai?.call) {
    const { aiReadPage, aiFixLines } = await import('./pdf-ai.js');
    if (mode === 'ai') aiPage = (b64) => aiReadPage(ai.call, b64);
    else if (mode === 'may-ai') aiFix = (lines) => aiFixLines(ai.call, lines);
  }
  const used = aiPage ? 'ai' : aiFix ? 'may-ai' : 'may';
  const { doc, stats } = await convertFile(file, { mode: aiPage ? 'ai' : 'auto', onProgress, aiPage, aiFix });
  return { text: flowToText(doc), pages: doc.pages.length, ocr: true, confidence: stats.confidence, ocrMode: used, fixed: stats.fixed || 0, aiFixed: stats.aiFixed || 0 };
}

/**
 * Tệp Word bất kỳ (.docx, .doc Word 97-2003/Word 95, .rtf, kể cả tệp bị đổi đuôi) → văn bản thuần.
 * Nhận diện theo nội dung tệp, không theo đuôi.
 */
export async function wordToText(buf, name = 'tệp') {
  const bytes = new Uint8Array(buf);
  if (sniffDoc(bytes) === 'docx') {
    try {
      return fixLegacy(await docxToText(buf));
    } catch {
      throw new Error(`Không đọc được “${name}” (tệp Word hỏng?) — mở bằng Word, lưu lại rồi tải lên`);
    }
  }
  return docToText(bytes, name);
}

/** Đọc văn bản từ tệp người dùng chọn cho ô nhập (Word mọi loại, .txt, .md, .html). */
export async function fileToText(file) {
  const name = file.name || '';
  const buf = await file.arrayBuffer();
  if (/\.(docx?|rtf|dot)$/i.test(name)) return wordToText(buf, name);
  const text = new TextDecoder().decode(buf);
  return /\.html?$/i.test(name) ? htmlToText(text) : text;
}

/** Trả về { text, pages?, kind, ocr? } hoặc ném lỗi tiếng Việt. PDF ảnh quét, ảnh chụp được nhận dạng chữ (OCR) trên máy. */
export async function extractText(file, { onProgress } = {}) {
  const name = file.name || '';
  if (/^image\//.test(file.type) || /\.(jpe?g|png|webp|bmp|gif|tiff?)$/i.test(name)) {
    const r = await ocrText(file, onProgress);
    if (r.text.replace(/\s/g, '').length < 10) throw new Error(`Không nhận dạng được chữ trong ảnh “${name}”.`);
    return { ...r, kind: 'image' };
  }
  const buf = await file.arrayBuffer();
  if (/\.(docx?|rtf|dot)$/i.test(name)) return { text: await wordToText(buf, name), kind: /\.docx$/i.test(name) ? 'docx' : 'doc' };
  if (/\.pdf$/i.test(name)) {
    const r = await pdfToText(buf);
    if (r.text.replace(/\s/g, '').length < 30 * r.pages) {
      // Ảnh quét (toàn bộ hoặc phần lớn) → nhận dạng chữ.
      const o = await ocrText(file, onProgress);
      if (o.text.replace(/\s/g, '').length < 30) throw new Error(`Không nhận dạng được chữ trong “${name}” (ảnh quá mờ?).`);
      return { ...o, kind: 'pdf' };
    }
    return { ...r, kind: 'pdf' };
  }
  if (/\.(txt|md|csv)$/i.test(name)) return { text: new TextDecoder().decode(buf), kind: 'txt' };
  if (/\.html?$/i.test(name)) return { text: htmlToText(new TextDecoder().decode(buf)), kind: 'html' };
  throw new Error(`Chưa hỗ trợ định dạng tệp “${name}”. Dùng Word (.doc, .docx), .pdf, ảnh chụp hoặc .txt.`);
}
