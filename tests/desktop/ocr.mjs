// Bản cài đặt: bộ nhận dạng chữ tại chỗ (desktop/ocr/engine.cjs) — phát hiện dòng chữ bằng PaddleOCR (ONNX) chạy trong
// tiến trình chính; nhận dạng VietOCR chỉ chạy khi có mô hình (tải lần đầu). Kiểm thử: trạng thái, phát hiện dòng trên ảnh
// trang văn bản, IPC từ giao diện, và bộ máy trực tiếp bằng Node (không cần Electron) trên ảnh PNG.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { _electron as electron } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(root, 'desktop/package.json'));
const tmp = mkdtempSync(join(tmpdir(), 'tlvb-ocr-'));
const EXE = process.env.TLVB_EXE || join(root, 'desktop/node_modules/electron/dist/electron');
const launchArgs = () => [...(process.env.TLVB_EXE ? [] : [join(root, 'desktop')]), '--no-sandbox', `--user-data-dir=${join(tmp, 'profile')}`];

/**
 * Ảnh trang văn bản mẫu (PNG 1588×2246, tỉ lệ 2×) từ tests/fixtures/van-ban-mau.html — vẽ bằng chính Electron (cửa sổ ẩn,
 * capturePage) nên chạy được cả trên CI không có trình duyệt Playwright và với bản đã đóng gói.
 */
async function pagePng() {
  const url = pathToFileURL(join(root, 'tests/fixtures/van-ban-mau.html')).href;
  const b64 = await app.evaluate(async ({ BrowserWindow }, u) => {
    const w = new BrowserWindow({ show: false, width: 1588, height: 2246, enableLargerThanScreen: true, webPreferences: { offscreen: true, sandbox: true } });
    try {
      await w.loadURL(u);
      await w.webContents.insertCSS('body{padding:76px 57px 76px 113px}');
      w.webContents.setZoomFactor(2);
      await new Promise((r) => setTimeout(r, 600));
      const img = await w.webContents.capturePage();
      return img.toPNG().toString('base64');
    } finally {
      w.destroy();
    }
  }, url);
  const png = Buffer.from(b64, 'base64');
  writeFileSync(join(tmp, 'page.png'), png);
  return png;
}

let app;
let page;
before(async () => {
  app = await electron.launch({ executablePath: EXE, args: launchArgs() });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await pagePng();
});
after(async () => {
  await app?.close();
});

test('bộ máy Node: phát hiện dòng chữ bằng PaddleOCR trên ảnh trang; trạng thái báo thiếu VietOCR khi chưa tải', async () => {
  const { Engine, cropRgba } = require(join(root, 'desktop/ocr/engine.cjs'));
  const { PNG } = require(join(root, 'node_modules/pngjs'));
  const png = PNG.sync.read(readFileSync(join(tmp, 'page.png')));
  const img = { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length) };
  const eng = new Engine({ modelDir: join(root, 'desktop/ocr/models'), userDir: join(tmp, 'models') });
  const st = eng.status();
  assert.equal(st.det, true);
  assert.equal(st.cls, true);
  assert.equal(st.available, st.rec, 'sẵn sàng khi và chỉ khi có VietOCR');
  const t0 = Date.now();
  const boxes = await eng.detect(img);
  const ms = Date.now() - t0;
  assert.ok(boxes.length >= 10 && boxes.length <= 80, `số dòng phát hiện: ${boxes.length}`);
  assert.ok(ms < 15000, `phát hiện quá chậm: ${ms} ms`);
  // Hộp nằm trong ảnh, sắp xếp từ trên xuống, có điểm tin cậy.
  for (const b of boxes) {
    assert.ok(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= img.width && b.y1 <= img.height && b.x1 > b.x0 && b.y1 > b.y0);
    assert.ok(b.score >= 0.5);
  }
  for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i].y0 >= boxes[i - 1].y0 - (boxes[i - 1].y1 - boxes[i - 1].y0), 'thứ tự đọc');
  // page() không chữ vẫn trả về hộp. Chưa có VietOCR → nhận dạng báo lỗi rõ; có (thư mục mô hình đã chép sẵn) → đọc được chữ.
  const r = await eng.page(img, { withText: false });
  assert.equal(r.lines.length, boxes.length);
  if (!st.rec) await assert.rejects(() => eng.recognize({ width: 10, height: 10, data: new Uint8ClampedArray(400) }), /VietOCR/);
  else {
    const line = await eng.recognizeLine(cropRgba(img, boxes[1].x0, boxes[1].y0 - (boxes[1].y1 - boxes[1].y0) * 0.4, boxes[1].x1, boxes[1].y1 + (boxes[1].y1 - boxes[1].y0) * 0.4));
    assert.ok(line.text.length >= 5 && line.conf > 0.5, JSON.stringify(line));
  }
  eng.dispose();
  // Tiền xử lý: khử nghiêng, tách dòng dài tại khoảng trắng, ký tự ngoài bộ chữ, ngoặc kép cong.
  const { rotateRgba, estimateSkew, splitLine, fixUnknownChars, curlyQuotes } = require(join(root, 'desktop/ocr/engine.cjs'));
  assert.equal(Math.abs(estimateSkew(img)) < 0.2, true, 'trang thẳng → góc ≈ 0');
  const tilted = rotateRgba(img, 1.5);
  const est = estimateSkew(tilted);
  assert.ok(Math.abs(est + 1.5) <= 0.15, `góc ước lượng ${est} (xoay 1,5°)`);
  const wide = boxes.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a));
  const crop = cropRgba(img, wide.x0, wide.y0, wide.x1, wide.y1);
  const parts = splitLine(crop);
  assert.ok(parts.length >= 2 && parts.every(([a, b]) => b - a <= crop.height * 10 + 8), JSON.stringify(parts));
  assert.equal(parts[0][0], 0);
  assert.equal(parts[parts.length - 1][1], crop.width);
  assert.equal(fixUnknownChars('Độc lập ? Tự do ? Hạnh phúc'), 'Độc lập – Tự do – Hạnh phúc');
  assert.equal(fixUnknownChars('nói: ?Em đã say chưa?'), 'nói: “Em đã say chưa”');
  assert.equal(curlyQuotes('T trả lời: "Có anh Hai ạ". Đ nói "Các ông"'), 'T trả lời: “Có anh Hai ạ”. Đ nói “Các ông”');
});

test('giao diện: tlvbDesktop.ocr.status() và page() qua IPC; Cài đặt hiện hàng Bộ nhận dạng với nút tải mô hình', async () => {
  const st = await page.evaluate(() => window.tlvbDesktop.ocr.status());
  assert.equal(st.det, true);
  assert.equal(typeof st.modelBase, 'string');
  const png = readFileSync(join(tmp, 'page.png'));
  const r = await page.evaluate(async (b64) => {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return window.tlvbDesktop.ocr.page(u8.buffer, { withText: false });
  }, png.toString('base64'));
  assert.ok(!r.error, r.error);
  assert.ok(r.lines.length >= 10, `dòng: ${r.lines.length}`);
  // Kích thước trả về đúng bằng ảnh đã gửi (màn hình ảo nhỏ có thể làm cửa sổ chụp hẹp hơn 1588).
  assert.equal(r.width, png.readUInt32BE(16));
  assert.ok(r.width >= 1200, `ảnh trang quá hẹp: ${r.width}`);
  // Đăng ký tài khoản → Cài đặt → hàng Bộ nhận dạng.
  const form = page.locator('[data-gate-form="register"]');
  await form.waitFor();
  await page.fill('#g-name', 'Người Dùng Máy');
  await page.fill('#g-email', 'ocr@example.com');
  await page.fill('#g-pass', 'matkhau-123');
  await form.locator('button[type="submit"]').click();
  await page.locator('.shell:not([hidden])').waitFor({ timeout: 30000 });
  const pick = page.locator('[data-agency-pick="cqdt"]');
  if (await pick.isVisible().catch(() => false)) await pick.click();
  await page.evaluate(() => (location.hash = '#settings'));
  await page.locator('[data-ocr-engine-row]').waitFor();
  const status = page.locator('[data-ocr-engine-status]');
  await status.filter({ hasText: /VietOCR|sẵn sàng/ }).waitFor({ timeout: 10000 });
  const txt = await status.innerText();
  assert.match(txt, /VietOCR/);
  const dlVisible = await page.locator('[data-ocr-download]').isVisible();
  assert.equal(dlVisible, !/đã sẵn sàng/.test(txt), 'nút tải mô hình hiện khi chưa có VietOCR');
  // Mặc định Tesseract; chọn VietOCR khi chưa có mô hình → vẫn Tesseract (không lỗi).
  const pickEngine = () => page.evaluate(async () => (await import('/assets/js/lib/pdf-convert.js')).pickOcrEngine());
  assert.equal(await pickEngine(), 'tesseract');
  assert.equal(await page.getAttribute('[data-ocr-engine="tesseract"]', 'aria-pressed'), 'true');
  await page.click('[data-ocr-engine="vietocr"]');
  assert.equal(await pickEngine(), (await page.evaluate(() => window.tlvbDesktop.ocr.status())).available ? 'vietocr' : 'tesseract');
  await page.click('[data-ocr-engine="tesseract"]');
  assert.equal(await pickEngine(), 'tesseract');
  assert.ok(existsSync(join(tmp, 'page.png')));
});

// Có bộ mô hình VietOCR thật (TLVB_OCR_TEST_MODELS=<thư mục chứa vietocr-*.onnx + vietocr.json>): nhận dạng cả trang qua IPC
// và chọn được bộ VietOCR trong Cài đặt. CI không có mô hình → bỏ qua.
// Bộ cài đóng gói sẵn mô hình (TLVB_EXE trỏ tới bản đã đóng gói) → chạy luôn; không có mô hình và không có env → bỏ qua.
test('có mô hình VietOCR: nhận dạng trang qua IPC ra đúng chữ, Cài đặt chọn được PaddleOCR + VietOCR', async (t) => {
  const src = process.env.TLVB_OCR_TEST_MODELS;
  if (src) {
    const dest = join(tmp, 'profile', 'ocr-models');
    mkdirSync(dest, { recursive: true });
    for (const f of ['vietocr-encoder.onnx', 'vietocr-decoder.onnx', 'vietocr.json']) copyFileSync(join(src, f), join(dest, f));
  }
  const st = await page.evaluate(() => window.tlvbDesktop.ocr.status());
  if (!st.rec && !src) return t.skip('bộ cài không kèm mô hình VietOCR và không có TLVB_OCR_TEST_MODELS');
  assert.equal(st.available, true, `bộ nhận dạng phải sẵn sàng: ${JSON.stringify(st)}`);
  const png = readFileSync(join(tmp, 'page.png'));
  const r = await page.evaluate(async (b64) => {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return window.tlvbDesktop.ocr.page(u8.buffer, {});
  }, png.toString('base64'));
  assert.ok(!r.error, r.error);
  const text = r.lines.map((l) => l.text).join('\n');
  assert.match(text, /CỘNG HÒA XÃ HỘI CHỦ/); // màn hình ảo hẹp có thể ngắt dòng tiêu đề
  assert.match(text, /Độc lập [-–] Tự do [-–] Hạnh phúc/);
  assert.ok(r.lines.every((l) => l.conf > 0.5), 'độ tin cậy từng dòng');
  await page.evaluate(() => (location.hash = '#pdf'));
  await page.waitForTimeout(300);
  await page.evaluate(() => (location.hash = '#settings'));
  await page.locator('[data-ocr-engine-row]').waitFor();
  await page.locator('[data-ocr-engine-status]').filter({ hasText: /đã sẵn sàng/ }).waitFor({ timeout: 10000 });
  await page.click('[data-ocr-engine="vietocr"]');
  assert.equal(await page.evaluate(async () => (await import('/assets/js/lib/pdf-convert.js')).pickOcrEngine()), 'vietocr');
});
