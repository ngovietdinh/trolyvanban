import { test, expect } from '@playwright/test';
import { trackErrors, freshApp, SUPER } from './helpers.mjs';

/** Quản trị tối cao bật chế độ bảo mật (máy chủ AI nội bộ 10.0.0.5), mở khóa, ghi nhận mã khôi phục. */
async function enableSecure(page, { idleMin = 10 } = {}) {
  await page.goto('/app.html#bao-mat');
  await expect(page.locator('.sec-hero h2')).toContainText('ĐANG TẮT');
  await page.check('[data-policy] [name="on"]');
  await page.fill('[data-policy] [name="aiBase"]', 'http://10.0.0.5:11434/v1');
  await page.fill('[data-policy] [name="aiModel"]', 'qwen2.5:14b');
  await page.fill('[data-policy] [name="idleMin"]', String(idleMin));
  await page.click('[data-policy] button[type="submit"]');
  await page.click('.modal [data-yes]');
  await expect(page.locator('[data-gate-form="unlock"]')).toBeVisible();
  await page.fill('#g-pass', SUPER.password);
  await page.click('[data-gate-form="unlock"] button[type="submit"]');
  const code = await page.locator('[data-rec-code]').innerText();
  expect(code).toMatch(/^([2-9A-Z]{4}-){5}[2-9A-Z]{4}$/);
  await expect(page.locator('[data-rec-done]')).toHaveAttribute('aria-disabled', 'true');
  await page.check('[data-rec-ok]');
  await page.click('[data-rec-done]');
  await expect(page.locator('.shell')).toBeVisible();
  return code;
}

test.describe('v2.34 — chế độ bảo mật: chạy nội bộ, AI nội bộ, mã hóa dữ liệu', () => {
  test('bật chế độ bảo mật → dữ liệu mã hóa AES-GCM trên máy, kiểm tra an toàn đạt, chặn kết nối ra Internet', async ({ page }) => {
    const t = trackErrors(page);
    // Máy chủ AI nội bộ giả định không có trong môi trường kiểm thử: trả lỗi ngay thay vì chờ hết giờ.
    await page.route('http://10.0.0.5:11434/**', (r) => r.abort());
    await freshApp(page, '#cases');
    await page.evaluate(async () => {
      const { casesRepo } = await import('/assets/js/legal/repo.js');
      casesRepo.save({ ten: 'Vụ tham ô tại Ban quản lý dự án X', persons: [] });
    });
    await enableSecure(page);
    await expect(page.locator('[data-sec-chip]')).toContainText('Môi trường bảo mật');
    // Môi trường bảo mật riêng: không thấy dữ liệu của chế độ bình thường.
    await page.goto('/app.html#cases');
    await expect(page.locator('.view')).not.toContainText('Ban quản lý dự án X');
    await page.evaluate(async () => {
      const { casesRepo } = await import('/assets/js/legal/repo.js');
      casesRepo.save({ ten: 'Vụ MẬT tạo trong chế độ bảo mật', persons: [] });
    });
    await page.waitForTimeout(300);
    // Trên máy chỉ có bản mã của dữ liệu bảo mật.
    const raw = await page.evaluate(() => Object.entries(localStorage).map(([k, v]) => `${k}=${v}`).join('\n'));
    expect(raw).toContain('tlvb:s:');
    expect(raw).toContain('"$e":1');
    expect(raw).not.toContain('Vụ MẬT');
    // Kiểm tra an toàn.
    await page.goto('/app.html#bao-mat');
    const checks = page.locator('[data-checks]');
    await expect(checks).toContainText('Chặn kết nối ra Internet (trong ứng dụng)');
    await expect(page.locator('.sec-check.s-ok', { hasText: 'Mã hóa dữ liệu tài khoản' })).toBeVisible();
    await expect(page.locator('.sec-check.s-ok', { hasText: 'Chặn kết nối ra Internet' })).toBeVisible();
    await expect(page.locator('.sec-check.s-ok', { hasText: 'Dịch vụ AI công cộng' })).toBeVisible();
    await expect(page.locator('.sec-check.s-ok', { hasText: 'Chính sách bảo mật nội dung' })).toContainText('10.0.0.5');
    await expect(page.locator('.sec-check', { hasText: 'Kết nối AI nội bộ' })).toContainText('Chưa kết nối được');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-export]')]);
    expect(dl.suggestedFilename()).toMatch(/^bao-cao-kiem-tra-an-toan-.*\.txt$/);
    // Trang không gọi được Internet công cộng.
    const msg = await page.evaluate(async () => {
      try {
        await fetch('https://api.openai.com/v1/models');
        return 'không chặn';
      } catch (e) {
        return e.message;
      }
    });
    expect(msg).toContain('Chế độ bảo mật đã chặn');
    // Cài đặt: chỉ còn AI nội bộ, địa chỉ cố định theo chính sách; không còn ô nhập API key dịch vụ công cộng.
    await page.goto('/app.html#settings');
    await expect(page.locator('[data-ai-panel]')).toContainText('Chế độ bảo mật');
    await expect(page.locator('[data-prov]')).toHaveCount(0);
    await expect(page.locator('[data-local-base]')).toHaveValue('http://10.0.0.5:11434/v1');
    await expect(page.locator('[data-local-base]')).toHaveAttribute('readonly', '');
    // Lỗi tải duy nhất là máy chủ AI nội bộ giả định (đã chủ động chặn ở trên).
    expect(t.errors.filter((e) => !/net::ERR_FAILED/.test(e))).toEqual([]);
  });

  test('tải lại trang / khóa ngay → phải nhập lại mật khẩu; tự khóa khi không thao tác; sao lưu bắt buộc đặt mật khẩu', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#dashboard');
    await enableSecure(page, { idleMin: 1 });
    // Tải lại: khóa chỉ nằm trong bộ nhớ → màn hình khóa.
    await page.reload();
    await expect(page.locator('[data-gate-form="unlock"]')).toBeVisible();
    await page.fill('#g-pass', 'sai-mat-khau');
    await page.click('[data-gate-form="unlock"] button[type="submit"]');
    await expect(page.locator('.auth-err')).toContainText('không đúng');
    await page.fill('#g-pass', SUPER.password);
    await page.click('[data-gate-form="unlock"] button[type="submit"]');
    await expect(page.locator('.shell')).toBeVisible();
    // Khóa ngay.
    await page.click('[data-sec-lock]');
    await expect(page.locator('[data-gate-form="unlock"]')).toBeVisible();
    await page.fill('#g-pass', SUPER.password);
    await page.click('[data-gate-form="unlock"] button[type="submit"]');
    await expect(page.locator('.shell')).toBeVisible();
    // Sao lưu: hỏi mật khẩu tệp, tệp tải về là bản mã.
    await page.goto('/app.html#settings');
    await page.click('[data-backup]');
    await page.fill('#bk-p1', 'saoluu-2026');
    await page.fill('#bk-p2', 'saoluu-2026');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.modal button[type="submit"]')]);
    expect(dl.suggestedFilename()).toMatch(/\.tlvb$/);
    const { readFileSync } = await import('node:fs');
    const file = JSON.parse(readFileSync(await dl.path(), 'utf8'));
    expect(file.encrypted).toBe(true);
    expect(file.enc.alg).toBe('AES-256-GCM');
    expect(JSON.stringify(file)).not.toContain('"docs"');
    // Tự khóa sau 1 phút không thao tác.
    await page.evaluate(() => {
      const realNow = Date.now.bind(Date);
      const start = realNow();
      Date.now = () => start + (realNow() - start) + 2 * 60000;
    });
    await expect(page.locator('[data-gate-form="unlock"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.gate')).toContainText('Phiên làm việc đã khóa');
    t.assertClean();
  });

  test('hai môi trường tách biệt: tắt chế độ bảo mật thì không còn thấy dữ liệu đã tạo ở đó; bật lại thấy lại', async ({ page }) => {
    const t = trackErrors(page);
    await page.route('http://10.0.0.5:11434/**', (r) => r.abort());
    await freshApp(page, '#cases');
    await page.evaluate(async () => (await import('/assets/js/legal/repo.js')).casesRepo.save({ ten: 'Vụ BÌNH THƯỜNG', persons: [] }));
    await enableSecure(page);
    await page.evaluate(async () => (await import('/assets/js/legal/repo.js')).casesRepo.save({ ten: 'Vụ MẬT', persons: [] }));
    await page.goto('/app.html#cases');
    await expect(page.locator('.view')).toContainText('Vụ MẬT');
    await expect(page.locator('.view')).not.toContainText('Vụ BÌNH THƯỜNG');
    // Tắt chế độ bảo mật → quay về môi trường bình thường (không cần mở khóa).
    await page.goto('/app.html#bao-mat');
    await page.uncheck('[data-policy] [name="on"]');
    await page.click('[data-policy] button[type="submit"]');
    await expect(page.locator('.modal')).toContainText('KHÔNG hiện');
    await page.click('.modal [data-yes]');
    await expect(page.locator('.shell')).toBeVisible();
    await expect(page.locator('[data-sec-chip]')).toHaveCount(0);
    await page.goto('/app.html#cases');
    await expect(page.locator('.view')).toContainText('Vụ BÌNH THƯỜNG');
    await expect(page.locator('.view')).not.toContainText('Vụ MẬT');
    const names = await page.evaluate(async () => (await import('/assets/js/legal/repo.js')).casesRepo.list().map((c) => c.ten));
    expect(names).toEqual(['Vụ BÌNH THƯỜNG']);
    // Nhật ký của chế độ bình thường không có gì từ môi trường bảo mật.
    await page.goto('/app.html#admin');
    await expect(page.locator('.audit-list')).not.toContainText('Vụ MẬT');
    // Bật lại → mở khóa → thấy lại dữ liệu của môi trường bảo mật.
    await page.goto('/app.html#bao-mat');
    await page.check('[data-policy] [name="on"]');
    await page.click('[data-policy] button[type="submit"]');
    await page.click('.modal [data-yes]');
    await page.fill('#g-pass', SUPER.password);
    await page.click('[data-gate-form="unlock"] button[type="submit"]');
    await expect(page.locator('.shell')).toBeVisible();
    await page.goto('/app.html#cases');
    await expect(page.locator('.view')).toContainText('Vụ MẬT');
    await expect(page.locator('.view')).not.toContainText('Vụ BÌNH THƯỜNG');
    expect(t.errors.filter((e) => !/net::ERR_FAILED/.test(e))).toEqual([]);
  });
});
