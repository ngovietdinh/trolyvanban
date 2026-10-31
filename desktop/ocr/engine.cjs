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

const DET = { limit: 960, thresh: 0.3, boxThresh: 0.5, unclip: 1.6, minSize: 3, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] };
const CLS = { w: 192, h: 48, thresh: 0.9 };

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
    const small = resizeRgba(img, w, h);
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
    const img = resizeRgba(crop, w, H);
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
  /**
   * Cả trang: bitmap RGBA → { width, height, lines: [{ x0, y0, x1, y1, text, conf }] } (đã sắp theo thứ tự đọc).
   * onProgress(i, n) theo từng dòng.
   */
  async page(img, { onProgress = null, withText = true } = {}) {
    const boxes = await this.detect(img);
    const lines = [];
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      let crop = cropRgba(img, b.x0, b.y0, b.x1, b.y1);
      let text = '';
      let conf = 0;
      if (withText) {
        if (this.file('ppocr-cls.onnx') && crop.width > crop.height * 1.5) {
          try {
            if (await this.upsideDown(crop)) crop = rotate180(crop);
          } catch {}
        }
        const r = await this.recognize(crop);
        text = r.text;
        conf = r.conf;
      }
      lines.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, score: b.score, text, conf });
      onProgress?.(i + 1, boxes.length);
    }
    return { width: img.width, height: img.height, lines };
  }
  dispose() {
    for (const s of Object.values(this.sessions)) s.release?.();
    this.sessions = {};
  }
}

module.exports = { Engine, resizeRgba, cropRgba, rotate180, dbBoxes, sortBoxes, toTensor };
