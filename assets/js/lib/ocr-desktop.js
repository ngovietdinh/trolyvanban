// Bộ nhận dạng chữ tại chỗ của bản cài đặt máy tính (PaddleOCR phát hiện + VietOCR nhận dạng, chạy trong vỏ Electron —
// xem desktop/ocr/engine.cjs). Bản web không có → dùng Tesseract (ocr.js). Kết quả được đưa về cùng dạng với ocrImage()
// để bộ dựng bố cục (pdf2word.ocrToLines) và lớp sửa dấu (vi-correct) dùng chung.
const api = () => (typeof window !== 'undefined' ? window.tlvbDesktop?.ocr : null) || null;

/** Có vỏ ứng dụng với bộ nhận dạng tại chỗ không (chưa chắc đã có mô hình). */
export const hasDesktopOcr = () => !!api();

/** Tình trạng mô hình: { det, cls, rec, available, dir } hoặc null (bản web). */
export async function desktopOcrStatus() {
  const a = api();
  if (!a) return null;
  try {
    return await a.status();
  } catch {
    return null;
  }
}

/** Tải mô hình VietOCR (lần đầu). onProgress({ file, received, total }). */
export async function desktopOcrDownload(onProgress) {
  const a = api();
  if (!a) throw new Error('Chỉ có ở bản cài đặt máy tính');
  return a.download(onProgress);
}

/** Xóa mô hình đã tải. */
export const desktopOcrRemove = () => api()?.remove();

const canvasPng = (canvas) =>
  new Promise((res, rej) => canvas.toBlob((b) => (b ? b.arrayBuffer().then(res, rej) : rej(new Error('Không tạo được ảnh trang'))), 'image/png'));

/**
 * Nhận dạng một canvas bằng bộ tại chỗ. Trả về dạng của ocrImage(): { text, confidence (0–100), lines: [{ text, x0, y0, x1,
 * y1, confidence, words: [...] }], engine: 'vietocr' }. Từng chữ được chia đều theo chiều ngang dòng (VietOCR chỉ trả cả dòng)
 * để bộ dựng bố cục có vị trí tương đối; độ tin cậy từng chữ = độ tin cậy dòng.
 */
export async function ocrImageDesktop(canvas, { onProgress } = {}) {
  const a = api();
  if (!a) throw new Error('Bộ nhận dạng tại chỗ chưa sẵn sàng');
  const png = await canvasPng(canvas);
  const r = await a.page(png, { onProgress: onProgress ? (p) => onProgress({ status: 'recognizing text', progress: p.total ? p.done / p.total : 0 }) : null });
  if (!r || r.error) throw new Error(r?.error || 'Bộ nhận dạng tại chỗ không trả lời');
  if (!Array.isArray(r.lines)) throw new Error('Kết quả nhận dạng không hợp lệ');
  const lines = [];
  for (const l of r.lines || []) {
    const text = String(l.text || '').replace(/\s+$/, '');
    if (!text.trim()) continue;
    const conf = Math.round((l.conf || 0) * 100);
    const toks = text.split(/\s+/).filter(Boolean);
    const total = toks.reduce((n, t) => n + t.length, 0) + Math.max(0, toks.length - 1);
    const W = l.x1 - l.x0;
    let pos = 0;
    const words = toks.map((t) => {
      const x0 = l.x0 + (W * pos) / Math.max(1, total);
      pos += t.length;
      const x1 = l.x0 + (W * pos) / Math.max(1, total);
      pos += 1;
      return { text: t, x0, x1, y0: l.y0, y1: l.y1, confidence: conf };
    });
    lines.push({ text, x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1, confidence: conf, words });
  }
  const confidence = lines.length ? Math.round(lines.reduce((n, l) => n + l.confidence, 0) / lines.length) : 0;
  return { text: lines.map((l) => l.text).join('\n'), confidence, lines, engine: 'vietocr' };
}
