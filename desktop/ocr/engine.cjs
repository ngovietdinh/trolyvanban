// Bộ nhận dạng chữ tiếng Việt chạy tại chỗ trong bản cài đặt máy tính: PaddleOCR (phát hiện vùng chữ + hướng chữ) +
// VietOCR (nhận dạng từng dòng), suy luận bằng onnxruntime-node. Chạy trong tiến trình chính của Electron (không cần Python).
//
// Mô hình:
//   ppocr-det.onnx  (PP-OCRv4 DBNet, ~4,7 MB, kèm bộ cài)   ppocr-cls.onnx (hướng 0°/180°, ~0,6 MB, kèm bộ cài)
//   vietocr-encoder.onnx + vietocr-decoder.onnx + vietocr.json (VietOCR vgg_transformer, tải lần đầu; xem scripts/ocr-vietocr/export.py)
// Ảnh vào/ra: bitmap RGBA (width, height, data) — Electron giải mã bằng nativeImage; kiểm thử Node truyền bitmap trực tiếp.
// Giấy phép: PaddleOCR, VietOCR, onnxruntime đều Apache-2.0.
const fs = require('node:fs');
const path = require('node:path');

let ort = null;
const loadOrt = () => (ort ??= require('onnxruntime-node'));

const DET = { limit: Number(process.env.TLVB_OCR_DET_LIMIT) || 1600, thresh: 0.3, boxThresh: 0.5, unclip: 1.6, minSize: 3, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] };
const CLS = { w: 192, h: 48, thresh: 0.9, samples: 12 };
// VietOCR được huấn luyện với ảnh dòng rộng tối đa 512 px ở cao 32 px (tỉ lệ 16:1) nhưng vẫn đọc tốt khi ép ngang tới ~1,8 lần
// (đo thực tế trên bản quét). Dòng dài hơn mức đó mới tách tại khoảng trắng thành số đoạn ít nhất có thể; mỗi mép cắt là một
// chỗ mô hình dễ "bịa" chữ nên lề hai đầu để rất nhỏ.
const REC = { maxRatio: Number(process.env.TLVB_OCR_CHUNK_RATIO) || 10, pad: 2, vpad: process.env.TLVB_OCR_VPAD ? Number(process.env.TLVB_OCR_VPAD) : 0.4, fill: Number(process.env.TLVB_OCR_FILL) || 0.42, tight: !!process.env.TLVB_OCR_TIGHT };
const SKEW = { max: 3, coarse: 0.25, fine: 0.05, min: 0.15, width: 1000 };

/* ---------------- Ảnh ---------------- */
/** Co giãn bitmap RGBA (nội suy song tuyến). */
function resizeRgba(img, w, h) {
  const { width: W, height: H, data } = img;
  const out = new Uint8ClampedArray(w * h * 4);
  const sx = W / w;
  const sy = H / h;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(H - 1, (y + 0.5) * sy - 0.5);
    const y0 = Math.max(0, Math.floor(fy));
    const y1 = Math.min(H - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(W - 1, (x + 0.5) * sx - 0.5);
      const x0 = Math.max(0, Math.floor(fx));
      const x1 = Math.min(W - 1, x0 + 1);
      const wx = fx - x0;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const p00 = data[(y0 * W + x0) * 4 + c];
        const p01 = data[(y0 * W + x1) * 4 + c];
        const p10 = data[(y1 * W + x0) * 4 + c];
        const p11 = data[(y1 * W + x1) * 4 + c];
        out[o + c] = (p00 * (1 - wx) + p01 * wx) * (1 - wy) + (p10 * (1 - wx) + p11 * wx) * wy;
      }
      out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}
/** Thu nhỏ bằng trung bình vùng (giữ nét mảnh, dấu thanh); phóng to thì nội suy song tuyến. */
function resizeArea(img, w, h) {
  const { width: W, height: H, data } = img;
  if (w >= W || h >= H) return resizeRgba(img, w, h);
  const out = new Uint8ClampedArray(w * h * 4);
  const sx = W / w;
  const sy = H / h;
  for (let y = 0; y < h; y++) {
    const ya = y * sy;
    const yb = Math.min(H, (y + 1) * sy);
    const y0 = Math.floor(ya);
    const y1 = Math.ceil(yb);
    for (let x = 0; x < w; x++) {
      const xa = x * sx;
      const xb = Math.min(W, (x + 1) * sx);
      const x0 = Math.floor(xa);
      const x1 = Math.ceil(xb);
      let r = 0;
      let g = 0;
      let b = 0;
      let wsum = 0;
      for (let yy = y0; yy < y1; yy++) {
        const wy = Math.min(yb, yy + 1) - Math.max(ya, yy);
        if (wy <= 0) continue;
        for (let xx = x0; xx < x1; xx++) {
          const wx = Math.min(xb, xx + 1) - Math.max(xa, xx);
          if (wx <= 0) continue;
          const k = wx * wy;
          const i = (yy * W + xx) * 4;
          r += data[i] * k;
          g += data[i + 1] * k;
          b += data[i + 2] * k;
          wsum += k;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = r / wsum;
      out[o + 1] = g / wsum;
      out[o + 2] = b / wsum;
      out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}
/** Xoay bitmap quanh tâm một góc (độ, dương = ngược chiều kim đồng hồ), nội suy song tuyến, nền trắng, giữ kích thước. */
function rotateRgba(img, deg) {
  const { width: W, height: H, data } = img;
  const out = new Uint8ClampedArray(W * H * 4).fill(255);
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const cx = W / 2;
  const cy = H / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const sxf = cos * dx - sin * dy + cx;
      const syf = sin * dx + cos * dy + cy;
      const x0 = Math.floor(sxf);
      const y0 = Math.floor(syf);
      if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) continue;
      const wx = sxf - x0;
      const wy = syf - y0;
      const o = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        const p00 = data[(y0 * W + x0) * 4 + c];
        const p01 = data[(y0 * W + x0 + 1) * 4 + c];
        const p10 = data[((y0 + 1) * W + x0) * 4 + c];
        const p11 = data[((y0 + 1) * W + x0 + 1) * 4 + c];
        out[o + c] = (p00 * (1 - wx) + p01 * wx) * (1 - wy) + (p10 * (1 - wx) + p11 * wx) * wy;
      }
    }
  }
  return { width: W, height: H, data: out };
}
/** Ảnh xám + ngưỡng Otsu → mảng 0/1 (1 = mực). */
function inkMask(img) {
  const { width: w, height: h, data } = img;
  const gray = new Uint8Array(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0; i < w * h; i++) {
    const g = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
    gray[i] = g;
    hist[g | 0]++;
  }
  let total = w * h;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > best) (best = v), (thr = t);
  }
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = gray[i] < thr ? 1 : 0;
  return { mask, thr, gray };
}
/**
 * Ước lượng góc nghiêng của trang (độ) bằng biên dạng hàng: xoay thử các góc, góc nào cho biên dạng hàng "sắc" nhất
 * (tổng bình phương lớn nhất) là góc nghiêng. Trả về góc cần xoay để dựng thẳng.
 */
function estimateSkew(img) {
  const scale = Math.min(1, SKEW.width / img.width);
  const small = scale < 1 ? resizeArea(img, Math.round(img.width * scale), Math.round(img.height * scale)) : img;
  const { width: w, height: h } = small;
  const { mask } = inkMask(small);
  const xs = [];
  const ys = [];
  const step = Math.max(1, Math.floor((w * h) / 400000));
  for (let i = 0; i < w * h; i += step) if (mask[i]) (xs.push(i % w), ys.push((i / w) | 0));
  if (xs.length < 200) return 0;
  const score = (deg) => {
    const t = Math.tan((deg * Math.PI) / 180);
    const rows = new Float64Array(h + w + 2);
    const off = w;
    for (let i = 0; i < xs.length; i++) rows[Math.round(ys[i] - xs[i] * t) + off]++;
    let sq = 0;
    for (let i = 0; i < rows.length; i++) sq += rows[i] * rows[i];
    return sq;
  };
  let best = 0;
  let bestScore = -1;
  for (let a = -SKEW.max; a <= SKEW.max + 1e-9; a += SKEW.coarse) {
    const sc = score(a);
    if (sc > bestScore) (bestScore = sc), (best = a);
  }
  for (let a = best - SKEW.coarse; a <= best + SKEW.coarse + 1e-9; a += SKEW.fine) {
    const sc = score(a);
    if (sc > bestScore) (bestScore = sc), (best = a);
  }
  return Math.round(best * 100) / 100;
}
/** Cắt sát dòng chữ trong hộp phát hiện (bỏ phần nền thừa trên/dưới, hai đầu), chừa lề REC.margin theo chiều cao chữ. */
function tightLine(crop) {
  const { width: w, height: h } = crop;
  const { mask } = inkMask(crop);
  const rows = new Uint32Array(h);
  const cols = new Uint32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) (rows[y]++, cols[x]++);
  let maxRow = 0;
  for (let y = 0; y < h; y++) if (rows[y] > maxRow) maxRow = rows[y];
  if (!maxRow) return crop;
  const thr = Math.max(1, maxRow * 0.04);
  // Dải hàng có mực quanh hàng có nhiều mực nhất gần tâm.
  let c = h >> 1;
  let bestC = -1;
  for (let y = Math.floor(h * 0.25); y < Math.ceil(h * 0.75); y++) if (rows[y] > bestC) (bestC = rows[y]), (c = y);
  const tol = Math.max(2, Math.round(h * 0.12));
  let y0 = c;
  let gap = 0;
  for (let y = c; y >= 0; y--) {
    if (rows[y] >= thr) (y0 = y), (gap = 0);
    else if (++gap > tol) break;
  }
  let y1 = c;
  gap = 0;
  for (let y = c; y < h; y++) {
    if (rows[y] >= thr) (y1 = y), (gap = 0);
    else if (++gap > tol) break;
  }
  const bh = y1 - y0 + 1;
  if (bh < h * 0.3 || bh < 6) return crop;
  const m = Math.round((bh * (1 / REC.fill - 1)) / 2); // dải chữ chiếm REC.fill chiều cao ảnh đưa vào mô hình
  let x0 = 0;
  while (x0 < w - 1 && cols[x0] === 0) x0++;
  let x1 = w - 1;
  while (x1 > x0 && cols[x1] === 0) x1--;
  const mx = Math.round(bh * (Number(process.env.TLVB_OCR_HPAD) || 0.05));
  return cropRgba(crop, Math.max(0, x0 - mx), Math.max(0, y0 - m), Math.min(w, x1 + 1 + mx), Math.min(h, y1 + 1 + m));
}

/** Cắt vùng [x0,y0,x1,y1] (đã kẹp trong ảnh). */
function cropRgba(img, x0, y0, x1, y1) {
  const X0 = Math.max(0, Math.floor(x0));
  const Y0 = Math.max(0, Math.floor(y0));
  const X1 = Math.min(img.width, Math.ceil(x1));
  const Y1 = Math.min(img.height, Math.ceil(y1));
  const w = Math.max(1, X1 - X0);
  const h = Math.max(1, Y1 - Y0);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) out.set(img.data.subarray(((Y0 + y) * img.width + X0) * 4, ((Y0 + y) * img.width + X0 + w) * 4), y * w * 4);
  return { width: w, height: h, data: out };
}
/** Xoay 180°. */
function rotate180(img) {
  const n = img.width * img.height;
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) out.set(img.data.subarray(i * 4, i * 4 + 4), (n - 1 - i) * 4);
  return { ...img, data: out };
}
/** RGBA → tensor NCHW float32 (RGB), chuẩn hóa (x/255 - mean)/std. */
function toTensor(img, mean = [0, 0, 0], std = [1, 1, 1], scale = 1 / 255) {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const f = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    f[i] = (data[i * 4] * scale - mean[0]) / std[0];
    f[n + i] = (data[i * 4 + 1] * scale - mean[1]) / std[1];
    f[2 * n + i] = (data[i * 4 + 2] * scale - mean[2]) / std[2];
  }
  return new (loadOrt().Tensor)('float32', f, [1, 3, h, w]);
}

/** Số điểm mực theo từng cột (ảnh xám, ngưỡng giữa nền và mực). */
function inkColumns(img) {
  const { width: w, height: h, data } = img;
  const gray = new Uint8Array(w * h);
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < w * h; i++) {
    const g = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
    gray[i] = g;
    if (g < lo) lo = g;
    if (g > hi) hi = g;
  }
  const thr = (lo + hi) / 2;
  const cols = new Uint16Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (gray[y * w + x] < thr) cols[x]++;
  return cols;
}
/**
 * Tách ảnh dòng thành các đoạn [x0, x1) có tỉ lệ rộng/cao ≤ ratio, cắt tại khoảng trắng rộng nhất trong nửa sau của mỗi đoạn
 * (không có khoảng trắng thì cắt cứng). Dòng ngắn trả về một đoạn.
 */
function splitLine(img, maxRatio = REC.maxRatio) {
  const { width: w, height: h } = img;
  const limit = Math.max(h * 2, Math.floor(h * maxRatio));
  if (w <= limit) return [[0, w]];
  const n = Math.ceil(w / limit);
  const target = w / n;
  const cols = inkColumns(img);
  const gaps = [];
  for (let x = 0; x < w; ) {
    if (cols[x] === 0) {
      let e = x;
      while (e < w && cols[e] === 0) e++;
      if (e - x >= Math.max(2, h * 0.12)) gaps.push([x, e]);
      x = e;
    } else x++;
  }
  const parts = [];
  let start = 0;
  for (let k = 1; k < n; k++) {
    const aim = Math.round(k * target);
    const lo = Math.max(start + h * 2, aim - target * 0.35);
    const hi = Math.min(w - h * 2, aim + target * 0.35);
    let best = null;
    let bestScore = -Infinity;
    for (const g of gaps) {
      const mid = (g[0] + g[1]) >> 1;
      if (mid < lo || mid > hi) continue;
      const score = (g[1] - g[0]) - Math.abs(mid - aim) / h; // khoảng trắng rộng, gần mốc
      if (score > bestScore) (bestScore = score), (best = g);
    }
    const cut = best ? (best[0] + best[1]) >> 1 : aim;
    if (cut - start > limit) {
      // Đoạn vẫn quá dài (không có khoảng trắng): cắt cứng tại giới hạn.
      parts.push([start, start + limit]);
      start += limit;
    } else {
      parts.push([start, cut]);
      start = cut;
    }
  }
  parts.push([start, w]);
  return parts.map(([a, b]) => [Math.max(0, a - REC.pad), Math.min(w, b + REC.pad)]);
}
/** Ký tự ngoài bộ chữ VietOCR (ra “?”): “ ? ” giữa hai dấu cách là gạch ngang; “?” dính trước chữ là mở ngoặc kép; “?” sau chữ khi đang mở ngoặc là đóng ngoặc kép. */
function fixUnknownChars(text) {
  let t = text.replace(/(^|\s)\?(?=\s|$)/g, '$1–');
  t = t.replace(/(^|[\s(\[])\?(?=[\p{L}\p{N}])/gu, '$1“');
  let open = false;
  let out = '';
  for (const ch of t) {
    if (ch === '“') open = true;
    if (ch === '?' && open) {
      out += '”';
      open = false;
    } else out += ch;
  }
  return out;
}
/** Ngoặc kép thẳng " → cong “ ” theo vị trí (mở khi đứng trước chữ, đóng khi đứng sau chữ/dấu câu), như Word tự sửa. */
function curlyQuotes(text) {
  let open = false;
  let out = '';
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch !== '"') {
      out += ch;
      continue;
    }
    const prev = i ? chars[i - 1] : ' ';
    const next = i + 1 < chars.length ? chars[i + 1] : ' ';
    const before = /[\s(\[{–—-]/.test(prev);
    const after = /[\p{L}\p{N}]/u.test(next);
    if (!open && before && after) (out += '“'), (open = true);
    else if (open) (out += '”'), (open = false);
    else if (before && after) (out += '“'), (open = true);
    else out += '”';
  }
  return out;
}

/* ---------------- Phát hiện vùng chữ (DBNet) ---------------- */
/** Bản đồ xác suất → các hộp dòng chữ [x0, y0, x1, y1, score] theo tọa độ ảnh đã co giãn. */
function dbBoxes(prob, w, h) {
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bin[i] = prob[i] > DET.thresh ? 1 : 0;
  const seen = new Uint8Array(w * h);
  const boxes = [];
  const stack = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (!bin[s] || seen[s]) continue;
    let top = 0;
    stack[top++] = s;
    seen[s] = 1;
    let minX = w;
    let maxX = -1;
    let minY = h;
    let maxY = -1;
    let area = 0;
    let sum = 0;
    while (top) {
      const p = stack[--top];
      const y = (p / w) | 0;
      const x = p - y * w;
      area++;
      sum += prob[p];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && bin[p - 1] && !seen[p - 1]) (seen[p - 1] = 1), (stack[top++] = p - 1);
      if (x < w - 1 && bin[p + 1] && !seen[p + 1]) (seen[p + 1] = 1), (stack[top++] = p + 1);
      if (y > 0 && bin[p - w] && !seen[p - w]) (seen[p - w] = 1), (stack[top++] = p - w);
      if (y < h - 1 && bin[p + w] && !seen[p + w]) (seen[p + w] = 1), (stack[top++] = p + w);
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    if (bw < DET.minSize || bh < DET.minSize) continue;
    const score = sum / area;
    if (score < DET.boxThresh) continue;
    // Nới hộp (unclip): DB thu nhỏ vùng chữ khi huấn luyện; nới theo diện tích / chu vi như PaddleOCR.
    const d = (bw * bh * DET.unclip) / (2 * (bw + bh));
    boxes.push([minX - d, minY - d, maxX + 1 + d, maxY + 1 + d, score]);
  }
  return boxes;
}
/** Sắp xếp dòng: trên xuống, cùng dòng thì trái sang phải. */
function sortBoxes(boxes) {
  boxes.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (let i = 1; i < boxes.length; i++) {
    const a = boxes[i - 1];
    const b = boxes[i];
    const ha = a[3] - a[1];
    if (Math.abs(b[1] - a[1]) < ha * 0.5 && b[0] < a[0]) {
      boxes[i - 1] = b;
      boxes[i] = a;
    }
  }
  return boxes;
}

class Engine {
  constructor({ modelDir, userDir = null } = {}) {
    this.modelDir = modelDir;
    this.userDir = userDir || modelDir;
    this.sessions = {};
    this.meta = null;
  }
  file(name) {
    for (const d of [this.userDir, this.modelDir]) {
      const p = path.join(d, name);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }
  /** Tình trạng mô hình. */
  status() {
    const det = !!this.file('ppocr-det.onnx');
    const cls = !!this.file('ppocr-cls.onnx');
    const rec = !!(this.file('vietocr-encoder.onnx') && this.file('vietocr-decoder.onnx') && this.file('vietocr.json'));
    return { det, cls, rec, available: det && rec, dir: this.userDir };
  }
  async session(name) {
    if (this.sessions[name]) return this.sessions[name];
    const p = this.file(name);
    if (!p) throw new Error(`Thiếu mô hình ${name}`);
    const s = await loadOrt().InferenceSession.create(p, { executionProviders: ['cpu'], graphOptimizationLevel: 'all', intraOpNumThreads: Math.max(1, Math.min(4, require('node:os').cpus().length - 1)) });
    this.sessions[name] = s;
    return s;
  }
  /** Phát hiện dòng chữ trên bitmap RGBA → [{ x0, y0, x1, y1, score }] theo tọa độ ảnh gốc. */
  async detect(img) {
    const s = await this.session('ppocr-det.onnx');
    const ratio = Math.min(1, DET.limit / Math.max(img.width, img.height));
    const w = Math.max(32, Math.round((img.width * ratio) / 32) * 32);
    const h = Math.max(32, Math.round((img.height * ratio) / 32) * 32);
    const small = resizeArea(img, w, h);
    const out = await s.run({ [s.inputNames[0]]: toTensor(small, DET.mean, DET.std) });
    const prob = out[s.outputNames[0]].data;
    const sx = img.width / w;
    const sy = img.height / h;
    return sortBoxes(dbBoxes(prob, w, h)).map(([x0, y0, x1, y1, score]) => ({ x0: Math.max(0, x0 * sx), y0: Math.max(0, y0 * sy), x1: Math.min(img.width, x1 * sx), y1: Math.min(img.height, y1 * sy), score }));
  }
  /** Dòng bị ngược (180°)? */
  async upsideDown(crop) {
    const s = await this.session('ppocr-cls.onnx');
    const out = await s.run({ [s.inputNames[0]]: toTensor(resizeRgba(crop, CLS.w, CLS.h), [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]) });
    const p = out[s.outputNames[0]].data;
    return p[1] > p[0] && p[1] > CLS.thresh;
  }
  loadMeta() {
    if (this.meta) return this.meta;
    const p = this.file('vietocr.json');
    this.meta = p ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
    return this.meta;
  }
  /** Nhận dạng một dòng (bitmap RGBA) bằng VietOCR → { text, conf }. */
  async recognize(crop) {
    const meta = this.loadMeta();
    if (!meta) throw new Error('Chưa có mô hình VietOCR');
    const H = meta.image_height || 32;
    let w = Math.round((crop.width * H) / Math.max(1, crop.height));
    w = Math.min(meta.image_max_width || 512, Math.max(meta.image_min_width || 32, Math.ceil(w / 10) * 10));
    const img = resizeArea(crop, w, H);
    const enc = await this.session('vietocr-encoder.onnx');
    const dec = await this.session('vietocr-decoder.onnx');
    const O = loadOrt();
    const encOut = await enc.run({ [enc.inputNames[0]]: toTensor(img) });
    const memory = encOut[enc.outputNames[0]];
    const hidden0 = enc.outputNames[1] ? encOut[enc.outputNames[1]] : null;
    const vocab = [...meta.vocab];
    const go = meta.go ?? 1;
    const eos = meta.eos ?? 2;
    const maxLen = meta.max_seq_length || 128;
    const ids = [go];
    const confs = [];
    let hidden = hidden0;
    for (let step = 0; step < maxLen; step++) {
      let logits;
      if (meta.seq_modeling === 'transformer') {
        const tgt = new O.Tensor('int64', BigInt64Array.from(ids.map((x) => BigInt(x))), [ids.length, 1]);
        const out = await dec.run({ [dec.inputNames[0]]: tgt, [dec.inputNames[1]]: memory });
        const t = out[dec.outputNames[0]];
        const V = t.dims[2];
        logits = t.data.subarray((ids.length - 1) * V, ids.length * V);
      } else {
        const tgt = new O.Tensor('int64', BigInt64Array.from([BigInt(ids[ids.length - 1])]), [1, 1]);
        const out = await dec.run({ [dec.inputNames[0]]: tgt, [dec.inputNames[1]]: memory, [dec.inputNames[2]]: hidden });
        logits = out[dec.outputNames[0]].data;
        hidden = out[dec.outputNames[1]];
      }
      // softmax → ký tự có xác suất cao nhất
      let max = -Infinity;
      let arg = 0;
      for (let i = 0; i < logits.length; i++) if (logits[i] > max) (max = logits[i]), (arg = i);
      let sum = 0;
      for (let i = 0; i < logits.length; i++) sum += Math.exp(logits[i] - max);
      ids.push(arg);
      if (arg === eos) break;
      confs.push(1 / sum);
    }
    const text = ids
      .slice(1)
      .filter((i) => i >= 4)
      .map((i) => vocab[i - 4] || '')
      .join('');
    const conf = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;
    return { text, conf };
  }
  /** Nhận dạng một dòng dài: tách đoạn tại khoảng trắng, nhận dạng từng đoạn, nối bằng dấu cách. */
  async recognizeLine(crop) {
    if (REC.tight) crop = tightLine(crop);
    const parts = splitLine(crop);
    if (parts.length === 1) return this.recognize(crop);
    const texts = [];
    let conf = 0;
    let n = 0;
    for (const [a, b] of parts) {
      const r = await this.recognize(cropRgba(crop, a, 0, b, crop.height));
      const t = r.text.trim();
      if (!t) continue;
      texts.push(t);
      conf += r.conf * t.length;
      n += t.length;
    }
    return { text: texts.join(' '), conf: n ? conf / n : 0 };
  }
  /** Cả trang có bị lật ngược 180° không: bỏ phiếu bộ phân loại hướng trên các đoạn đầu dòng (tỉ lệ ≈ 4:1). */
  async pageUpsideDown(img, boxes) {
    if (!this.file('ppocr-cls.onnx')) return false;
    const picks = boxes.filter((b) => b.y1 - b.y0 >= 8 && b.x1 - b.x0 >= (b.y1 - b.y0) * 2);
    const step = Math.max(1, Math.floor(picks.length / CLS.samples));
    let up = 0;
    let down = 0;
    for (let i = 0; i < picks.length && up + down < CLS.samples; i += step) {
      const b = picks[i];
      const h = b.y1 - b.y0;
      const w = Math.min(b.x1 - b.x0, h * 4);
      try {
        if (await this.upsideDown(cropRgba(img, b.x0, b.y0, b.x0 + w, b.y1))) down++;
        else up++;
      } catch {}
    }
    return up + down >= 3 && down > up;
  }
  /**
   * Cả trang: bitmap RGBA → { width, height, lines: [{ x0, y0, x1, y1, text, conf }] } (đã sắp theo thứ tự đọc).
   * onProgress(i, n) theo từng dòng.
   */
  async page(img, { onProgress = null, withText = true, deskew = true } = {}) {
    let skew = 0;
    if (deskew && !process.env.TLVB_OCR_NO_DESKEW) {
      skew = estimateSkew(img);
      if (Math.abs(skew) >= SKEW.min) img = rotateRgba(img, skew);
      else skew = 0;
    }
    let boxes = await this.detect(img);
    let rotated = false;
    if (withText && (await this.pageUpsideDown(img, boxes))) {
      // Trang quét bị lật ngược: xoay cả trang rồi phát hiện lại; tọa độ trả về theo trang đã dựng đứng.
      img = rotate180(img);
      boxes = await this.detect(img);
      rotated = true;
    }
    const lines = [];
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      let text = '';
      let conf = 0;
      if (withText) {
        const vp = REC.vpad * (b.y1 - b.y0); // nới hộp theo chiều dọc: VietOCR đọc tốt nhất khi chữ chiếm ~45% chiều cao ảnh dòng
        const r = await this.recognizeLine(cropRgba(img, b.x0, b.y0 - vp, b.x1, b.y1 + vp));
        text = this.fixText(r.text);
        conf = r.conf;
      }
      lines.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, score: b.score, text, conf });
      onProgress?.(i + 1, boxes.length);
    }
    return { width: img.width, height: img.height, rotated, skew, lines };
  }
  /** Sửa ký tự ngoài bộ chữ khi bộ chữ không có ngoặc kép cong. */
  fixText(text) {
    const meta = this.loadMeta();
    if ((meta?.vocab || '').includes('“')) return text;
    let t = text.includes('?') ? fixUnknownChars(text) : text;
    if (t.includes('"')) t = curlyQuotes(t);
    return t;
  }
  dispose() {
    for (const s of Object.values(this.sessions)) s.release?.();
    this.sessions = {};
  }
}

module.exports = { Engine, resizeRgba, resizeArea, rotateRgba, cropRgba, rotate180, dbBoxes, sortBoxes, toTensor, splitLine, tightLine, estimateSkew, fixUnknownChars, curlyQuotes };
