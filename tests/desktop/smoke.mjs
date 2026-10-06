// Kiểm thử bản cài đặt máy tính (Electron): mở ứng dụng thật qua app://, tài khoản mặc định toàn quyền,
// Tố tụng hiện sẵn, đọc PDF quét bằng OCR (Worker + WASM chạy được trong giao thức app://).
// Chạy: node scripts/desktop.mjs && (cd desktop && npm install) && xvfb-run -a node --test tests/desktop/smoke.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { _electron as electron, chromium } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const root = new URL('../..', import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), 'tlvb-desktop-'));
let app;
let page;
// TLVB_EXE=<đường dẫn tệp chạy đã đóng gói> để kiểm thử bản build thật thay vì mã nguồn desktop/.
const EXE = process.env.TLVB_EXE || join(root, 'desktop/node_modules/electron/dist/electron');
const launchArgs = () => [...(process.env.TLVB_EXE ? [] : [join(root, 'desktop')]), '--no-sandbox', `--user-data-dir=${join(tmp, 'profile')}`];

async function scannedPdf() {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 794, height: 1123 } });
  await p.goto(pathToFileURL(join(root, 'tests/fixtures/van-ban-mau.html')).href);
  await p.waitForTimeout(400);
  await p.addStyleTag({ content: 'body{padding:76px 57px 76px 113px}' });
  const png = await p.screenshot();
  await p.setContent(`<style>@page{size:A4;margin:0}body{margin:0}img{width:210mm;height:297mm;display:block}</style><img src="data:image/png;base64,${png.toString('base64')}">`);
  writeFileSync(join(tmp, 'scan.pdf'), await p.pdf({ format: 'A4', printBackground: true }));
  await b.close();
}

async function register(name, email) {
  const form = page.locator('[data-gate-form="register"]');
  await form.waitFor();
  await page.fill('#g-name', name);
  await page.fill('#g-email', email);
  await page.fill('#g-pass', 'matkhau-123');
  await form.locator('button[type="submit"]').click();
  await page.locator('.shell:not([hidden])').waitFor({ timeout: 30000 });
}

const me = () =>
  page.evaluate(async () => {
    const { accounts } = await import('/assets/js/lib/accounts.js');
    const u = accounts.current();
    return { role: u.role, pending: !!u.pending, perms: [...u.permSet].sort() };
  });

before(async () => {
  await scannedPdf();
  app = await electron.launch({ executablePath: EXE, args: launchArgs() });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

after(async () => {
  await app?.close();
});

test('mở bằng giao thức app:// và nhận biết bản cài đặt', async () => {
  assert.ok(page.url().startsWith('app://trolyvanban/'), page.url());
  assert.equal(await page.evaluate(() => window.tlvbDesktop?.platform), process.platform);
  assert.match(await page.locator('.gate').innerText(), /toàn quyền/);
});

test('tài khoản đầu tiên: quản trị tối cao, toàn quyền, Tố tụng hiện sẵn', async () => {
  await register('Người Dùng Máy', 'may1@example.com');
  const u = await me();
  assert.equal(u.role, 'superadmin');
  assert.deepEqual(u.perms, ['ai', 'docs', 'legal', 'legal.ai', 'tools', 'users']);
  assert.ok(await page.locator('a[href="#legal"]').count());
});

test('tài khoản thứ hai tự đăng ký: đủ mọi quyền, không phải chờ cấp quyền', async () => {
  await page.evaluate(() => {
    sessionStorage.clear();
    location.reload();
  });
  await page.locator('[data-gate-mode="register"]').click();
  await register('Đồng Nghiệp', 'may2@example.com');
  const u = await me();
  assert.equal(u.role, 'admin');
  assert.equal(u.pending, false);
  assert.deepEqual(u.perms, ['ai', 'docs', 'legal', 'legal.ai', 'tools', 'users']);
});

test('PDF quét → nhận dạng chữ trên máy chạy được trong bản cài đặt', async () => {
  await page.evaluate(() => (location.hash = '#pdf'));
  await page.locator('.pw [data-file]').setInputFiles(join(tmp, 'scan.pdf'));
  await page.locator('[data-go]:not([disabled])').click();
  const pv = page.locator('.pw-page').first();
  await pv.waitFor({ timeout: 180000 });
  const text = await pv.innerText();
  for (const s of ['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc', 'Nguyễn Văn An']) assert.ok(text.includes(s), `thiếu “${s}”`);
});

test('dữ liệu lưu bền sau khi khởi động lại ứng dụng', async () => {
  await app.close();
  app = await electron.launch({ executablePath: EXE, args: launchArgs() });
  page = await app.firstWindow();
  await page.locator('[data-gate-form="login"]').waitFor();
  const n = await page.evaluate(() => JSON.parse(localStorage.getItem('tlvb:users') || '[]').length);
  assert.equal(n, 2);
});
