// v2.49 — Tòa án: hồ sơ mới là bản nháp, chỉ vào sổ khi bấm Lưu; giữ tạm khi rời trang; Hủy; Xóa hồ sơ.
import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

test.describe('v2.49 — Tòa án: lưu hồ sơ có chủ đích', () => {
  test('tạo vụ án → bản nháp (không vào sổ) → rời trang giữ tạm → tiếp tục → Lưu hồ sơ → vào sổ; Hủy và Xóa hồ sơ', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#toa-an', { agency: 'toa-an' });
    await page.click('[data-new="so-tham"]');
    await expect(page).toHaveURL(/#toa-an\/moi\/so-tham\/vu-an$/);
    await expect(page.locator('[data-ct-draft-badge]')).toHaveText('Bản nháp — chưa lưu');
    await expect(page.locator('[data-ct-save]')).toHaveText(/Lưu hồ sơ/);
    // Chưa gõ gì → về danh sách: không có hồ sơ, không có bản nháp.
    await page.click('[data-ct-cancel]');
    await expect(page).toHaveURL(/#toa-an$/);
    await expect(page.locator('.ct-list')).toHaveCount(0);
    await expect(page.locator('[data-ct-draft]')).toHaveCount(0);
    // Gõ nội dung rồi rời trang bằng liên kết → giữ tạm, sổ vẫn trống.
    await page.click('[data-new="phuc-tham"]');
    await page.fill('[data-v="thuLy.so"]', '45/2026/TLPT-HS');
    await page.fill('[data-ct-name]', 'Vụ Nguyễn Văn An kháng cáo');
    await expect(page).toHaveURL(/#toa-an\/nhap\/vu-an$/);
    await page.reload();
    await expect(page.locator('[data-v="thuLy.so"]')).toHaveValue('45/2026/TLPT-HS');
    await expect(page.locator('[data-ct-draft-badge]')).toBeVisible();
    await page.click('.rd-back');
    await expect(page.locator('.ct-list')).toHaveCount(0);
    const bar = page.locator('[data-ct-draft]');
    await expect(bar).toContainText('Bản nháp chưa lưu');
    await expect(bar).toContainText('Vụ Nguyễn Văn An kháng cáo');
    await expect(bar).toContainText('Phúc thẩm');
    await bar.locator('a', { hasText: 'Tiếp tục soạn' }).click();
    await expect(page.locator('[data-v="thuLy.so"]')).toHaveValue('45/2026/TLPT-HS');
    await expect(page.locator('[data-ct-cap]')).toHaveText('Phúc thẩm');
    // Lưu hồ sơ → vào sổ, địa chỉ có mã hồ sơ, không còn bản nháp.
    await page.click('[data-ct-save]');
    await expect(page.locator('.toast').last()).toContainText('Đã lưu hồ sơ “Vụ Nguyễn Văn An kháng cáo” vào sổ vụ án');
    await expect(page).toHaveURL(/#toa-an\/(?!moi|nhap)[^/]+\/vu-an$/);
    await expect(page.locator('[data-ct-draft-badge]')).toHaveCount(0);
    await expect(page.locator('[data-ct-status]')).toContainText('Đã lưu');
    await page.fill('[data-v="hdxx.chuToa"]', 'Phạm Văn Hùng');
    await page.click('[data-ct-save]');
    await expect(page.locator('.toast').last()).toContainText('Đã lưu hồ sơ');
    await page.click('.rd-back');
    await expect(page.locator('[data-ct-draft]')).toHaveCount(0);
    await expect(page.locator('.ct-list')).toContainText('Vụ Nguyễn Văn An kháng cáo');
    await expect(page.locator('.ct-list')).toContainText('Thụ lý số 45/2026/TLPT-HS');
    // Bỏ bản nháp từ danh sách (có hỏi lại).
    await page.click('[data-new="so-tham"]');
    await page.fill('[data-v="thuLy.so"]', '9/2026/TLST-HS');
    await page.click('.rd-back');
    await expect(page.locator('[data-ct-draft]')).toContainText('Sơ thẩm');
    await page.click('[data-draft-drop]');
    await page.locator('.modal button', { hasText: 'Bỏ bản nháp' }).click();
    await expect(page.locator('[data-ct-draft]')).toHaveCount(0);
    // Hủy bản nháp đang soạn có hỏi lại; Xóa hồ sơ đã lưu có hỏi lại.
    await page.click('[data-new="so-tham"]');
    await page.fill('[data-v="thuLy.so"]', '10/2026/TLST-HS');
    await page.click('[data-ct-cancel]');
    await page.locator('.modal button', { hasText: 'Bỏ bản nháp' }).click();
    await expect(page).toHaveURL(/#toa-an$/);
    await expect(page.locator('[data-ct-draft]')).toHaveCount(0);
    await page.locator('.ct-list a', { hasText: 'Vụ Nguyễn Văn An kháng cáo' }).click();
    await page.click('[data-ct-del]');
    await expect(page.locator('.modal')).toContainText('Xóa hồ sơ “Vụ Nguyễn Văn An kháng cáo”');
    await page.locator('.modal button', { hasText: 'Xóa vĩnh viễn' }).click();
    await expect(page).toHaveURL(/#toa-an$/);
    await expect(page.locator('.ct-list')).toHaveCount(0);
    t.assertClean();
  });
});
