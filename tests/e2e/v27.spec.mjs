import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

test.describe('Trung tâm hướng dẫn', () => {
  test('nút ? mở hướng dẫn đúng màn hình, “Thử ngay” điền sẵn ví dụ vào Kho hồ sơ', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#kho');
    // Gợi ý “Lần đầu dùng?” hiện trên máy tính, ẩn trên điện thoại.
    const hint = page.locator('[data-help-hint]');
    if ((page.viewportSize()?.width || 0) > 640) await expect(hint).toBeVisible();
    await page.click('[data-help-open]');
    const drawer = page.locator('.modal-drawer');
    await expect(drawer.getByRole('heading', { name: 'Kho hồ sơ & Trợ lý AI' })).toBeVisible();
    await expect(drawer.locator('.gd-steps > li')).toHaveCount(6);
    // Mở hướng dẫn rồi thì không nhắc nữa.
    await expect(hint).toBeHidden();
    await drawer.locator('.gd-ex').filter({ hasText: 'Biên bản lời khai mới để làm rõ' }).getByRole('button', { name: 'Thử ngay' }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.locator('.kho [data-input]')).toHaveValue(/Tạo biên bản lời khai mới cho Nguyễn Văn A/);
    t.assertClean();
  });

  test('trang hướng dẫn: danh mục, tìm kiếm không dấu, đánh dấu đã nắm, phím F1', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#help');
    await expect(page.getByRole('heading', { name: /Trung tâm/ })).toBeVisible();
    await expect(page.locator('.help-path li')).toHaveCount(9);
    await page.fill('.help [data-q]', 'phieu hoi');
    await expect(page.locator('.help-group small')).toHaveCount(1);
    await expect(page.locator('.help-group small')).toHaveText(/Kết quả/);
    await page.locator('.help [data-q]').press('Enter');
    await expect(page).toHaveURL(/#help\/(interview|legal)$/);
    await page.goto('/app.html#help/interview');
    await expect(page.locator('.gd-head h1')).toHaveText('Ghi lời khai');
    await expect(page.locator('.gd-mk')).toHaveCount(2);
    await page.click('[data-seen]');
    await expect(page.locator('[data-seen]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.help-progress small')).toContainText('Đã nắm 1/');
    await page.getByRole('link', { name: 'Mở chức năng' }).click();
    await expect(page).toHaveURL(/#interview$/);
    // Đã nắm → không hiện gợi ý; F1 mở đúng hướng dẫn.
    await expect(page.locator('[data-help-hint]')).toBeHidden();
    await page.keyboard.press('F1');
    await expect(page.locator('.modal-drawer .modal-title')).toHaveText('Ghi lời khai');
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal-drawer')).toHaveCount(0);
    t.assertClean();
  });

  test('ẩn gợi ý, tìm hướng dẫn trong bảng lệnh', async ({ page }) => {
    test.skip((page.viewportSize()?.width || 0) <= 640, 'Gợi ý chỉ hiện trên màn hình rộng');
    await freshApp(page, '#compose');
    await page.click('[data-help-hint-x]');
    await expect(page.locator('[data-help-hint]')).toBeHidden();
    await page.goto('/app.html#spell');
    await expect(page.locator('[data-help-hint]')).toBeHidden();
    await page.keyboard.press('Control+k');
    await page.fill('[data-palette-input]', 'huong dan so thanh chu');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#help\/number$/);
    await expect(page.locator('.gd-head h1')).toHaveText('Số thành chữ');
  });
});
