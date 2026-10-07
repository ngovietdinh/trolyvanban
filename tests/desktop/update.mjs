// Kiểm thử cập nhật tại chỗ của bản cài đặt với máy chủ phát hành giả lập (thay GitHub Releases / raw).
// Chạy: node scripts/desktop.mjs && xvfb-run -a node --test tests/desktop/update.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { _electron as electron } from '@playwright/test';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';
import { buildManifest } from '../../scripts/web-manifest.mjs';

const root = new URL('../..', import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), 'tlvb-update-'));
const profile = join(tmp, 'profile');
const releases = new Map(); // commit → thư mục mã web
let manifest = null;
const requests = [];
let corrupt = null; // đường dẫn tệp trả nội dung sai (kiểm tra sha256)

/** Tạo “bản phát hành” mới từ desktop/web: đổi phiên bản, sửa thêm tệp tùy chọn. */
function release(version, commit, edits = {}, shell = 1) {
  const dir = join(tmp, commit);
  cpSync(join(root, 'desktop/web'), dir, { recursive: true });
  const vj = JSON.parse(readFileSync(join(dir, 'version.json'), 'utf8'));
  writeFileSync(join(dir, 'version.json'), JSON.stringify({ ...vj, version, notes: [`Bản thử ${version}`] }));
  const vjs = join(dir, 'assets/js/version.js');
  writeFileSync(vjs, readFileSync(vjs, 'utf8').replace(/APP_VERSION = '[^']+'/, `APP_VERSION = '${version}'`));
  for (const [p, fn] of Object.entries(edits)) writeFileSync(join(dir, p), fn(readFileSync(join(dir, p), 'utf8')));
  releases.set(commit, dir);
  manifest = buildManifest(dir, commit, shell);
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/manifest.json') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(manifest));
  const m = url.match(/^\/raw\/([^/]+)\/(.+)$/);
  if (m && releases.has(m[1])) {
    requests.push(m[2]);
    if (corrupt === m[2]) return res.writeHead(200).end('noi dung bi thay doi');
    const f = join(releases.get(m[1]), m[2]);
    if (existsSync(f)) return res.writeHead(200).end(readFileSync(f));
  }
  res.writeHead(404).end();
});

let app;
let page;
async function launch() {
  app = await electron.launch({
    executablePath: join(root, 'desktop/node_modules/electron/dist/electron'),
    args: [join(root, 'desktop'), '--no-sandbox', `--user-data-dir=${profile}`],
    env: { ...process.env, TLVB_UPDATE_MANIFEST: `${base}/manifest.json`, TLVB_UPDATE_RAW: `${base}/raw/`, TLVB_UPDATE_WATCHDOG_MS: '6000' },
  });
  page = await app.firstWindow();
  await page.locator('.gate, .shell:not([hidden])').first().waitFor();
}
const version = () => page.evaluate(async () => (await import('/assets/js/version.js')).APP_VERSION);
const state = () => JSON.parse(readFileSync(join(profile, 'web-updates/state.json'), 'utf8'));
let base;

before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  await launch();
});
after(async () => {
  await app?.close();
  server.close();
  rmSync(tmp, { recursive: true, force: true });
});

test('có bản mới: chỉ tải các tệp thay đổi, khởi động lại lên bản mới, dữ liệu giữ nguyên', async () => {
  const packaged = await version();
  await page.evaluate(() => localStorage.setItem('tlvb:thu-du-lieu', 'con nguyen'));
  release('9.9.1', 'aaa1111', { 'app.html': (s) => s.replace('</body>', '<i data-ban-moi hidden></i></body>') });
  const c = await page.evaluate(() => window.tlvbDesktop.update.check());
  assert.equal(c.current, packaged);
  assert.equal(c.latest, '9.9.1');
  assert.equal(c.available, true);
  assert.equal(c.needInstaller, false);
  const r = await page.evaluate(() => window.tlvbDesktop.update.apply());
  assert.equal(r.ok, true);
  assert.equal(r.changed, 3); // version.json, assets/js/version.js, app.html
  assert.deepEqual(requests.sort(), ['app.html', 'assets/js/version.js', 'version.json']);
  await page.reload();
  await page.locator('.gate, .shell:not([hidden])').first().waitFor();
  assert.equal(await version(), '9.9.1');
  assert.equal(await page.locator('[data-ban-moi]').count(), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('tlvb:thu-du-lieu')), 'con nguyen');
  await page.waitForTimeout(500);
  assert.equal(state().pending, false); // mã web đã báo sẵn sàng → xác nhận
});

test('vẫn dùng bản đã cập nhật sau khi tắt mở lại ứng dụng', async () => {
  await app.close();
  await launch();
  assert.equal(await version(), '9.9.1');
});

test('tệp tải về sai mã kiểm tra: hủy cập nhật, giữ nguyên bản đang dùng', async () => {
  release('9.9.2', 'bbb2222', { 'assets/css/base.css': (s) => `${s}\n/* 9.9.2 */` });
  corrupt = 'assets/css/base.css';
  await assert.rejects(page.evaluate(() => window.tlvbDesktop.update.apply()), /không khớp mã kiểm tra/);
  corrupt = null;
  assert.equal(state().version, '9.9.1');
  assert.ok(!existsSync(join(profile, 'web-updates/9.9.2.part')));
});

test('bản cập nhật hỏng (không khởi động được): tự quay về bản trước', async () => {
  release('9.9.3', 'ccc3333', { 'assets/js/app.js': (s) => `${s}\nthis is not javascript (` });
  const r = await page.evaluate(() => window.tlvbDesktop.update.apply());
  assert.equal(r.version, '9.9.3');
  app.on('window', () => {});
  await page.reload().catch(() => {});
  // Hết thời gian chờ (6 giây khi kiểm thử) mà mã web không báo sẵn sàng → quay về 9.9.1, tải lại trang.
  await page.waitForTimeout(9000);
  await page.locator('.gate, .shell:not([hidden])').first().waitFor({ timeout: 15000 });
  assert.equal(await version(), '9.9.1');
  assert.equal(state().version, '9.9.1');
  assert.equal(state().failed, '9.9.3');
});

test('bản mới cần vỏ ứng dụng mới hơn: báo phải tải bộ cài', async () => {
  release('9.9.4', 'ddd4444', {}, 2);
  const c = await page.evaluate(() => window.tlvbDesktop.update.check());
  assert.equal(c.needInstaller, true);
  const r = await page.evaluate(() => window.tlvbDesktop.update.apply());
  assert.equal(r.needInstaller, true);
  assert.equal(await version(), '9.9.1');
});

test('người dùng: thanh thông báo “Cập nhật ngay” → tải phần thay đổi → tự khởi động lại lên bản mới', async () => {
  release('9.9.5', 'eee5555', { 'app.html': (s) => s.replace('</body>', '<i data-ban-995 hidden></i></body>') });
  await page.reload();
  const bar = page.locator('.update-banner');
  await bar.waitFor({ timeout: 15000 });
  assert.match(await bar.innerText(), /v9\.9\.5/);
  const btn = bar.locator('[data-do-update]');
  assert.equal((await btn.innerText()).trim(), 'Cập nhật ngay');
  await btn.click();
  await page.locator('[data-ban-995]').waitFor({ state: 'attached', timeout: 20000 });
  assert.equal(await version(), '9.9.5');
});
