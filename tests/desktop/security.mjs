// Kiểm thử bản cài đặt "bảo mật" (TLVB_SECURE=1): chế độ bảo mật luôn bật, vỏ ứng dụng chặn mọi yêu cầu mạng ra
// ngoài (kể cả yêu cầu lọt qua lớp chặn của trang), tắt cập nhật qua Internet, dữ liệu mã hóa ngay khi đăng ký.
// Chạy: xvfb-run -a node --test tests/desktop/security.mjs   (tự dựng bản bảo mật rồi trả lại bản thường)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'tlvb-secure-'));
// Đường dẫn tệp chạy Electron lấy qua chính gói electron → chạy được trên Linux, macOS, Windows.
const EXE = process.env.TLVB_EXE || createRequire(import.meta.url)(join(root, 'desktop/node_modules/electron'));
let app;
let page;
const prep = (secure) => execFileSync(process.execPath, [join(root, 'scripts/desktop.mjs')], { env: { ...process.env, TLVB_SECURE: secure ? '1' : '' }, stdio: 'ignore' });

before(async () => {
  if (!process.env.TLVB_EXE) prep(true);
  app = await electron.launch({ executablePath: EXE, args: [...(process.env.TLVB_EXE ? [] : [join(root, 'desktop')]), '--no-sandbox', `--user-data-dir=${join(tmp, 'profile')}`] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

after(async () => {
  await app?.close();
  if (!process.env.TLVB_EXE) prep(false);
});

test('bản bảo mật: chế độ bảo mật luôn bật, mật khẩu mạnh, mã hóa dữ liệu và cấp mã khôi phục khi đăng ký', async () => {
  assert.match(await page.locator('.gate').innerText(), /Chế độ bảo mật/);
  const form = page.locator('[data-gate-form="register"]');
  await form.waitFor();
  await page.fill('#g-name', 'Cán bộ');
  await page.fill('#g-email', 'canbo@example.com');
  await page.fill('#g-pass', 'matkhau-123'); // 11 ký tự, có số
  await form.locator('button[type="submit"]').click();
  await page.locator('[data-rec-code]').waitFor({ timeout: 30000 });
  assert.match(await page.locator('[data-rec-code]').innerText(), /^([2-9A-Z]{4}-){5}[2-9A-Z]{4}$/);
  await page.check('[data-rec-ok]');
  await page.click('[data-rec-done]');
  await page.locator('.shell:not([hidden])').waitFor();
  const st = await page.evaluate(async () => {
    const s = await import('/assets/js/lib/security.js');
    const { accounts } = await import('/assets/js/lib/accounts.js');
    return { policy: s.securityPolicy(), desk: await window.tlvbDesktop.security.status(), enc: accounts.current().encrypted };
  });
  assert.equal(st.policy.on, true);
  assert.equal(st.policy.forced, true);
  assert.equal(st.desk.on, true);
  assert.equal(st.desk.forced, true);
  assert.equal(st.enc, true);
  // Không tắt được từ giao diện / mã web.
  const off = await page.evaluate(async () => {
    const s = await import('/assets/js/lib/security.js');
    try {
      s.saveSecurityPolicy({ on: false });
      return 'đã tắt';
    } catch (e) {
      return e.message;
    }
  });
  assert.match(off, /không thể tắt/);
  assert.equal((await page.evaluate(() => window.tlvbDesktop.security.set({ on: false }))).on, true);
});

test('chặn kết nối ra Internet ở cả trang và vỏ ứng dụng; máy này (localhost) vẫn dùng được', async () => {
  const web = await page.evaluate(async () => {
    try {
      await fetch('https://api.anthropic.com/v1/models');
      return 'không chặn';
    } catch (e) {
      return e.message;
    }
  });
  assert.match(web, /Chế độ bảo mật đã chặn/);
  // Yêu cầu không đi qua fetch/XHR (prefetch) → vỏ ứng dụng hủy.
  const before = (await page.evaluate(() => window.tlvbDesktop.security.status())).blocked;
  await page.evaluate(() => {
    const l = document.createElement('link');
    l.rel = 'prefetch';
    l.href = 'https://example.com/ro-ri.js';
    document.head.append(l);
  });
  await page.waitForTimeout(1500);
  const afterN = (await page.evaluate(() => window.tlvbDesktop.security.status())).blocked;
  assert.ok(afterN > before, `vỏ ứng dụng phải hủy yêu cầu ra ngoài (${before} → ${afterN})`);
  // AI trên chính máy này vẫn kết nối được.
  const srv = http.createServer((req, res) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data: [{ id: 'qwen-noi-bo' }] })));
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try {
    const models = await page.evaluate(async (b) => {
      const m = await import('/assets/js/lib/ai.js');
      m.setLocalEndpoint(b);
      return m.listModels('local', 'local');
    }, `http://127.0.0.1:${srv.address().port}/v1`);
    assert.deepEqual(models, ['qwen-noi-bo']);
  } finally {
    srv.close();
  }
  // Không kiểm tra / tải bản cập nhật qua Internet.
  assert.equal((await page.evaluate(() => window.tlvbDesktop.update.check())).disabled, true);
});

test('tự khóa / khóa ngay: phải nhập lại mật khẩu, dữ liệu trên máy là bản mã', async () => {
  await page.evaluate(async () => {
    const { casesRepo } = await import('/assets/js/legal/repo.js');
    casesRepo.save({ ten: 'Vụ thử nghiệm bảo mật', persons: [] });
  });
  await page.click('[data-sec-lock]');
  await page.locator('[data-gate-form="unlock"]').waitFor();
  const raw = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes(':cases')).map((k) => localStorage.getItem(k)).join(''));
  assert.ok(raw.includes('"$e":1'));
  assert.ok(!raw.includes('Vụ thử nghiệm bảo mật'));
  await page.fill('#g-pass', 'matkhau-123');
  await page.click('[data-gate-form="unlock"] button[type="submit"]');
  await page.locator('.shell:not([hidden])').waitFor();
  const name = await page.evaluate(async () => (await import('/assets/js/legal/repo.js')).casesRepo.list()[0]?.ten);
  assert.equal(name, 'Vụ thử nghiệm bảo mật');
});
