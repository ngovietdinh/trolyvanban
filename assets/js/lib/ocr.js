// Nhận dạng chữ (OCR) tiếng Việt chạy hoàn toàn trên trình duyệt bằng tesseract.js (mô hình LSTM, dữ liệu vie + eng).
// Dùng cho PDF ảnh quét và ảnh chụp văn bản. Tài nguyên được tải khi cần (lần đầu ~5 MB) và trình duyệt ghi nhớ.

let workerPromise = null;
let progressCb = null;

const asset = (p) => new URL(`../../vendor/tesseract/${p}`, import.meta.url).href;

async function getWorker() {
  workerPromise ??= (async () => {
    const mod = await import('../../vendor/tesseract/tesseract.esm.min.js');
    const T = mod.default || mod;
    return T.createWorker(['vie', 'eng'], 1, {
      workerPath: asset('worker.min.js'),
      corePath: asset('core/'),
      langPath: asset('lang'),
      gzip: true,
      workerBlobURL: false,
      logger: (m) => progressCb?.(m),
      errorHandler: () => {},
    });
  })().catch((err) => {
    workerPromise = null;
    throw new Error(`Không khởi động được bộ nhận dạng chữ: ${err?.message || err}`);
  });
  return workerPromise;
}

/**
 * Nhận dạng một ảnh (canvas, Blob, ImageData…). Trả về các dòng có toạ độ:
 * { width, height, confidence, text, lines: [{ text, x0, y0, x1, y1, confidence, words: [{ text, x0, x1, confidence }] }] }
 */
export async function ocrImage(image, { onProgress } = {}) {
  const worker = await getWorker();
  progressCb = onProgress || null;
  try {
    // Giữ khoảng trắng giữa các từ; tách trang tự động (PSM 3) cho bố cục văn bản hành chính.
    await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: '3', user_defined_dpi: '300' });
    const { data } = await worker.recognize(image, {}, { text: true, blocks: true });
    const lines = [];
    for (const b of data.blocks || [])
      for (const p of b.paragraphs || [])
        for (const l of p.lines || []) {
          const text = l.text.replace(/\s+$/, '');
          if (!text.trim()) continue;
          lines.push({
            text,
            x0: l.bbox.x0,
            y0: l.bbox.y0,
            x1: l.bbox.x1,
            y1: l.bbox.y1,
            confidence: l.confidence,
            para: p,
            words: (l.words || []).map((w) => ({ text: w.text, x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1, confidence: w.confidence })),
          });
        }
    return { text: data.text, confidence: data.confidence, lines };
  } finally {
    progressCb = null;
  }
}

/** Giải phóng bộ nhận dạng (khi rời màn hình). */
export async function disposeOcr() {
  if (!workerPromise) return;
  const p = workerPromise;
  workerPromise = null;
  try {
    (await p).terminate();
  } catch {}
}
