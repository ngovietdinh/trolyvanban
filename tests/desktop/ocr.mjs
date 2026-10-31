// Bản cài đặt: bộ nhận dạng chữ tại chỗ (desktop/ocr/engine.cjs) — phát hiện dòng chữ bằng PaddleOCR (ONNX) chạy trong
// tiến trình chính; nhận dạng VietOCR chỉ chạy khi có mô hình (tải lần đầu). Kiểm thử: trạng thái, phát hiện dòng trên ảnh
// trang văn bản, IPC từ giao diện, và bộ máy trực tiếp bằng Node (không cần Electron) trên ảnh PNG.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { _electron as electron, chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(root, 'desktop/package.json'));
const tmp = mkdtempSync(join(tmpdir(), 'tlvb-ocr-'));
const EXE = process.env.TLVB_EXE || join(root, 'desktop/node_modules/electron/dist/electron');
const launchArgs = () => [...(process.env.TLVB_EXE ? [] : [join(root, 'desktop')]), '--no-sandbox', `--user-data-dir=${join(tmp, 'profile')}`];

/** Ảnh trang văn bản mẫu (PNG) từ tests/fixtures/van-ban-mau.html. */
async function pagePng() {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 794, height: 1123 } });
  await p.goto(pathToFileURL(join(root, 'tests/fixtures/van-ban-mau.html')).href);
  await p.waitForTimeout(300);
  await p.addStyleTag({ content: 'body{padding:76px 57px 76px 113px}' });
  const png = await p.screenshot();
  await b.close();
  writeFileSync(join(tmp, 'page.png'), png);
  return png;
}

test('bộ máy Node: phát hiện dòng chữ bằng PaddleOCR trên ảnh trang; trạng thái báo thiếu VietOCR khi chưa tải', async () => {
  const { Engine } = require(join(root, 'desktop/ocr/engine.cjs'));
  const { PNG } = require(join(root, 'node_modules/pngjs'));
  const png = PNG.sync.read(await pagePng());
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
  // Chưa có VietOCR → page() không chữ vẫn trả về hộp; nhận dạng báo lỗi rõ.
  const r = await eng.page(img, { withText: false });
  assert.equal(r.lines.length, boxes.length);
  await assert.rejects(() => eng.recognize({ width: 10, height: 10, data: new Uint8ClampedArray(400) }), /VietOCR/);
  eng.dispose();
});

let app;
let page;
before(async () => {
  app = await electron.launch({ executablePath: EXE, args: launchArgs() });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});
after(async () => {
  await app?.close();
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
  assert.equal(r.width, 1588);
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
  // Chọn Tesseract → bộ đọc PDF dùng Tesseract.
  await page.click('[data-ocr-engine="tesseract"]');
  const eng = await page.evaluate(async () => (await import('/assets/js/lib/pdf-convert.js')).pickOcrEngine());
  assert.equal(eng, 'tesseract');
  assert.ok(existsSync(join(tmp, 'page.png')));
});
