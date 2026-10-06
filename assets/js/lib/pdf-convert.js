// Điều phối chuyển PDF / ảnh sang doc model Word: chọn cách đọc từng trang (lớp chữ, OCR, AI đọc ảnh),
// sửa lỗi nhận dạng, gom kết quả. Giao diện ở views/pdf.js; bộ xuất .docx ở docx-flow.js.
import { openPdf, pageItems, pageRules, ruledTables, buildLines, layoutPage, ocrToLines, isScanned, renderPage } from './pdf2word.js';
import { ocrImage } from './ocr.js';
import { syllableProblem, suggestSyllable } from './vn-syllable.js';

/** Sửa lỗi OCR hay gặp bằng quy tắc âm tiết: chữ in hoa mất mũ (BIEN → BIÊN), chữ dính số 0/O, l/1… */
export function fixOcrText(text) {
  return String(text)
    .normalize('NFC')
    .replace(/[\p{L}]+/gu, (w) => {
      if (w.length < 2 || !syllableProblem(w)) return w;
      const hasMark = /[À-ỹđĐ]/.test(w);
      const upper = w === w.toLocaleUpperCase('vi-VN');
      if (!hasMark && !upper) return w; // từ nước ngoài / tên riêng không dấu
      // Hai chữ bị dính (ĐÔNGANH → ĐÔNG ANH): tách tại vị trí cho hai âm tiết hợp lệ.
      if (w.length >= 5) {
        for (let k = w.length - 2; k >= 2; k--) {
          const a = w.slice(0, k);
          const b = w.slice(k);
          if (!syllableProblem(a) && !syllableProblem(b) && a.length <= 7 && b.length <= 7) return `${a} ${b}`;
        }
      }
      const alts = suggestSyllable(w);
      if (alts.length !== 1) return w;
      const a = alts[0];
      return upper ? a.toLocaleUpperCase('vi-VN') : w[0] === w[0].toLocaleUpperCase('vi-VN') ? a[0].toLocaleUpperCase('vi-VN') + a.slice(1) : a;
    })
    .replace(/(?<=\d)[Oo](?=[\d/.,-])|(?<=[\d/.-])[Oo](?=\d)/g, '0')
    .replace(/\s+([,.;:])/g, '$1');
}

function fixLineRuns(line) {
  for (const s of line.segments) {
    for (const r of s.runs) r.text = fixOcrText(r.text);
    s.text = s.runs.map((r) => r.text).join('');
  }
  line.text = line.segments.map((s) => s.text).join('\t');
  return line;
}

const canvasToBlob = (c) => new Promise((res) => c.toBlob(res, 'image/png'));
async function canvasB64(canvas, maxW = 1600) {
  let c = canvas;
  if (canvas.width > maxW) {
    c = document.createElement('canvas');
    c.width = maxW;
    c.height = Math.round((canvas.height * maxW) / canvas.width);
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  }
  return c.toDataURL('image/jpeg', 0.88).split(',')[1];
}

/** Ảnh (jpg, png…) → canvas. */
async function imageToCanvas(file) {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  // Phóng ảnh nhỏ cho OCR chính xác hơn.
  const scale = bmp.width < 1600 ? Math.min(3, 2000 / bmp.width) : 1;
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Đếm trang và loại trang (có lớp chữ / ảnh quét) để hiển thị trước khi chuyển. */
export async function inspectFile(file) {
  if (/^image\//.test(file.type) || /\.(jpe?g|png|webp|bmp|gif|tiff?)$/i.test(file.name)) return { kind: 'image', pages: 1, scanned: 1, text: 0 };
  const pdf = await openPdf(await file.arrayBuffer());
  let scanned = 0;
  const n = pdf.numPages;
  const sample = Math.min(n, 5);
  for (let i = 1; i <= sample; i++) {
    const page = await pdf.getPage(i);
    const c = await page.getTextContent();
    const chars = c.items.reduce((s, it) => s + (it.str || '').replace(/\s/g, '').length, 0);
    if (chars < 25) scanned++;
  }
  const ratio = scanned / sample;
  pdf.destroy?.();
  return { kind: ratio === 0 ? 'text' : ratio === 1 ? 'scan' : 'mixed', pages: n };
}

/**
 * Chuyển tệp (PDF hoặc ảnh) sang doc model.
 * opts: { mode: 'auto' | 'ocr' | 'ai', from, to, fixFonts, dropPageNumbers, signal,
 *         onProgress({ page, total, stage, pct }), aiPage(b64, pageNo) → Promise<blocks|null>, aiFix(lines) → Promise<lines> }
 */
export async function convertFile(file, opts = {}) {
  const { mode = 'auto', fixFonts = true, dropPageNumbers = true, onProgress, signal, aiPage, aiFix } = opts;
  const isImage = /^image\//.test(file.type) || /\.(jpe?g|png|webp|bmp|gif|tiff?)$/i.test(file.name);
  const out = { title: file.name.replace(/\.[^.]+$/, ''), pages: [] };
  const stats = { text: 0, ocr: 0, ai: 0, aiFixed: 0, confidence: [], warnings: [] };
  const check = () => {
    if (signal?.aborted) throw new Error('Đã dừng chuyển đổi.');
  };

  const handleImage = async (canvas, scale, pageW, pageH, pageNo, total) => {
    if (mode === 'ai' && aiPage) {
      onProgress?.({ page: pageNo, total, stage: 'AI đang đọc trang', pct: 0.3 });
      try {
        const blocks = await aiPage(await canvasB64(canvas), pageNo);
        if (blocks?.length) {
          stats.ai++;
          return { blocks, margins: { top: 56.7, bottom: 56.7, left: 85, right: 42.5 }, kind: 'ai' };
        }
      } catch (err) {
        if (/^Đã dừng/.test(err.message)) throw err;
        stats.warnings.push(`Trang ${pageNo}: AI không đọc được ảnh (${err.message}) — đã dùng OCR trên máy.`);
      }
    }
    onProgress?.({ page: pageNo, total, stage: 'Nhận dạng chữ (OCR)', pct: 0 });
    const ocr = await ocrImage(canvas, { onProgress: (m) => m.status === 'recognizing text' && onProgress?.({ page: pageNo, total, stage: 'Nhận dạng chữ (OCR)', pct: m.progress }) });
    check();
    let lines = ocrToLines(ocr, scale).map(fixLineRuns);
    if (aiFix && lines.length) {
      onProgress?.({ page: pageNo, total, stage: 'AI soát lỗi nhận dạng', pct: 0.95 });
      try {
        lines = await aiFix(lines, pageNo);
        stats.aiFixed++;
      } catch (err) {
        if (/^Đã dừng/.test(err.message)) throw err;
        stats.warnings.push(`Trang ${pageNo}: AI chưa soát lỗi được (${err.message}).`);
      }
    }
    stats.ocr++;
    if (ocr.confidence) stats.confidence.push(ocr.confidence);
    return { ...layoutPage(lines, { width: pageW, height: pageH }, { dropPageNumbers }), kind: 'ocr' };
  };

  if (isImage) {
    const canvas = await imageToCanvas(file);
    // Quy ước khổ A4 theo chiều rộng ảnh.
    const pageW = 595.3;
    const scale = canvas.width / pageW;
    const pageH = canvas.height / scale;
    const r = await handleImage(canvas, scale, pageW, pageH, 1, 1);
    out.pages.push({ width: pageW, height: Math.max(pageH, 300), margins: r.margins, blocks: r.blocks, kind: r.kind });
    return { doc: out, stats: summarize(stats) };
  }

  const pdf = await openPdf(await file.arrayBuffer());
  const from = Math.max(1, opts.from || 1);
  const to = Math.min(pdf.numPages, opts.to || pdf.numPages);
  const total = to - from + 1;
  try {
    for (let n = from; n <= to; n++) {
      check();
      const page = await pdf.getPage(n);
      const pageNo = n - from + 1;
      onProgress?.({ page: pageNo, total, stage: 'Đọc trang', pct: 0 });
      const { items, width, height } = await pageItems(page, { fixFonts });
      let r;
      let kind;
      if (mode === 'auto' && !isScanned(items)) {
        // Bảng có đường viền: dựng theo nét kẻ; phần chữ còn lại dựng thành đoạn văn.
        const { tables, rest } = ruledTables(items, await pageRules(page));
        r = layoutPage(buildLines(rest), { width, height }, { dropPageNumbers, tables });
        kind = 'text';
        stats.text++;
      } else {
        const { canvas, scale } = await renderPage(page, 3000);
        r = await handleImage(canvas, scale, width, height, pageNo, total);
        kind = r.kind;
        canvas.width = canvas.height = 0;
      }
      out.pages.push({ width, height, margins: r.margins, blocks: r.blocks, kind });
      page.cleanup();
      onProgress?.({ page: pageNo, total, stage: 'Xong', pct: 1 });
    }
  } finally {
    pdf.destroy?.();
  }
  return { doc: out, stats: summarize(stats) };
}

function summarize(s) {
  return { text: s.text, ocr: s.ocr, ai: s.ai, aiFixed: s.aiFixed, warnings: s.warnings, confidence: s.confidence.length ? Math.round(s.confidence.reduce((a, b) => a + b, 0) / s.confidence.length) : null };
}

export { canvasToBlob };
