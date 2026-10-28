import { test, expect } from '@playwright/test';
import { trackErrors, freshApp, SUPER } from './helpers.mjs';

test.describe('v2.43 — Chọn cơ quan: Tòa án / Cảnh sát điều tra', () => {
  test('đăng nhập lần đầu phải chọn cơ quan; mỗi cơ quan chỉ hiện mục của mình; đổi cơ quan giữ dữ liệu', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '', { login: false });
    await page.fill('#g-name', SUPER.name);
    await page.fill('#g-email', SUPER.email);
    await page.fill('#g-pass', SUPER.password);
    await page.click('[data-gate-form] button[type="submit"]');
    // Chưa chọn: màn hình chọn cơ quan, mục tố tụng chưa hiện.
    await expect(page.locator('[data-agency-pick]')).toHaveCount(2);
    await expect(page.locator('[data-nav="cases"]')).toBeHidden();
    await expect(page.locator('[data-nav="toa-an"]')).toBeHidden();
    // Mở thẳng một màn hình riêng: vẫn hỏi trước, chọn xong vào đúng màn hình đó.
    await page.goto('/app.html#toa-an/kho-ban-an');
    await page.click('[data-agency-pick="toa-an"]');
    await expect(page).toHaveURL(/#toa-an\/kho-ban-an$/);
    await expect(page.locator('[data-kho]')).toBeVisible();
    await expect(page.locator('[data-agency-switch]')).toContainText('Tòa án nhân dân');
    await expect(page.locator('.sidebar [data-nav="toa-an/kho-ban-an"]')).toHaveAttribute('aria-current', 'page');
    for (const nav of ['toa-an', 'toa-an/bieu-mau', 'legal', 'binh-luan']) await expect(page.locator(`.sidebar [data-nav="${nav}"]`)).toBeVisible();
    for (const nav of ['cases', 'interview', 'loi-khai', 'so-do', 'forms', 'kho']) await expect(page.locator(`.sidebar [data-nav="${nav}"]`)).toBeHidden();
    // Tổng quan và Tra cứu theo Tòa án.
    await page.goto('/app.html#dashboard');
    await expect(page.locator('.legal-promo')).toContainText('Sổ vụ án');
    await expect(page.locator('.legal-promo')).not.toContainText('Ghi lời khai');
    await expect(page.locator('.dash-court')).toContainText('Sổ vụ án đang trống');
    await page.goto('/app.html#tra-cuu');
    await expect(page.locator('.tc-tiles')).toContainText('Kho bản án, án lệ');
    await expect(page.locator('[data-tc-f="records"]')).toHaveCount(0);
    // Đổi sang Cơ quan Cảnh sát điều tra.
    await page.click('[data-agency-switch]');
    await page.click('[data-agency-pick="cqdt"]');
    await expect(page.locator('[data-agency-switch]')).toContainText('Cảnh sát điều tra');
    for (const nav of ['cases', 'interview', 'loi-khai', 'so-do', 'forms', 'legal', 'binh-luan']) await expect(page.locator(`.sidebar [data-nav="${nav}"]`)).toBeVisible();
    await expect(page.locator('.sidebar [data-nav="toa-an"]')).toBeHidden();
    await expect(page.locator('.dash-cases')).toContainText('Hồ sơ vụ án gần đây');
    // Lựa chọn được nhớ sau khi tải lại.
    await page.reload();
    await expect(page.locator('[data-agency-switch]')).toContainText('Cảnh sát điều tra');
    await expect(page.locator('[data-agency-pick]')).toHaveCount(0);
    t.assertClean();
  });

  test('cán bộ Tòa án tự vào cơ quan Tòa án, không phải chọn', async ({ page }) => {
    await freshApp(page, '#admin');
    await page.click('[data-new-user]');
    await page.fill('#nu-name', 'Thư ký Tòa');
    await page.fill('#nu-email', 'thuky@toaan.vn');
    await page.fill('#nu-pw', 'matkhau-thuky');
    await page.selectOption('#nu-role', 'court');
    await page.click('.modal button[type="submit"]');
    await expect(page.locator('.users-table')).toContainText('thuky@toaan.vn');
    await page.click('.avatar-btn');
    await page.click('[data-logout]');
    if (await page.locator('[data-gate-mode="login"]').isVisible().catch(() => false)) await page.click('[data-gate-mode="login"]');
    await page.fill('#g-email', 'thuky@toaan.vn');
    await page.fill('#g-pass', 'matkhau-thuky');
    await page.click('[data-gate-form] button[type="submit"]');
    await expect(page.locator('[data-agency-switch]')).toContainText('Tòa án nhân dân');
    await expect(page.locator('[data-agency-pick]')).toHaveCount(0);
    await expect(page.locator('.sidebar [data-nav="toa-an"]')).toBeVisible();
    await expect(page.locator('.sidebar [data-nav="cases"]')).toBeHidden();
  });
});
