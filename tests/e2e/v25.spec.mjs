import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { trackErrors, freshApp } from './helpers.mjs';
import { docxToText } from '../../assets/js/lib/docx.js';

async function setupCase(page) {
  await freshApp(page, '#cases');
  await page.locator('[data-new]').click();
  await page.fill('#c-ten', 'Vụ tham ô tại Ban QLDA huyện Yên Mô');
  await page.fill('#c-td', '353');
  await page.locator('.modal button[type="submit"]').click();
  await page.locator('[data-add-person]').click();
  await page.selectOption('#p-role', 'bi-can');
  await page.fill('#p-hoTen', 'Nguyễn Văn Bình');
  await page.fill('#p-ngaySinh', '12/03/1980');
  await page.fill('#p-noiCuTru', 'Yên Mô, Ninh Bình');
  await page.locator('.modal button[type="submit"]').click();
  await expect(page.locator('[data-pid]')).toHaveCount(1);
}

test.describe('Biểu mẫu tố tụng', () => {
  test('danh mục theo giai đoạn, tìm kiếm, mở mẫu', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#forms');
    await expect(page.locator('[data-nav="forms"]')).toBeVisible();
    await expect(page.locator('.tt-stage-card')).toHaveCount(15);
    await page.fill('[data-q]', 'kham xet');
    await expect(page.locator('.tt-form-item', { hasText: 'Lệnh khám xét người' })).toBeVisible();
    await page.locator('.tt-form-item', { hasText: 'Biên bản khám xét' }).click();
    await expect(page).toHaveURL(/#forms\/bb-kham-xet$/);
    await expect(page.locator('.tt-preview .vb-page')).toContainText('BIÊN BẢN KHÁM XÉT');
    t.assertClean();
  });

  test('tự điền từ hồ sơ, xem trước, xuất Word, lưu vào hồ sơ và mở lại từ hồ sơ', async ({ page }) => {
    const t = trackErrors(page);
    await setupCase(page);
    await page.goto('/app.html#settings');
    await page.fill('#lo-kyHieu', 'CSĐT');
    await page.fill('#lo-diaDanh', 'Ninh Bình');
    await page.fill('#lo-vks', 'tỉnh Ninh Bình');
    await page.locator('#lo-kyHieu').evaluate((el) => el.form.requestSubmit());
    await page.goto('/app.html#forms/qd-khoi-to-bi-can');
    await page.selectOption('[data-case]', { label: 'Vụ tham ô tại Ban QLDA huyện Yên Mô' });
    await page.selectOption('[data-person]', { label: 'Nguyễn Văn Bình' });
    await expect(page.locator('[name="hoTen"]')).toHaveValue('Nguyễn Văn Bình');
    await expect(page.locator('[name="toiDanh"]')).toHaveValue(/Điều 353 Bộ luật Hình sự/);
    await expect(page.locator('[name="nhanThan"]')).toHaveValue(/12\/03\/1980/);
    await page.fill('[name="mauSo"]', '04');
    await page.locator('[name="mauSo"]').blur();
    await page.fill('[name="tomTat"]', 'Nguyễn Văn Bình đã lập 05 phiếu chi khống, chiếm đoạt 700 triệu đồng.');
    const pv = page.locator('.tt-preview .vb-page');
    await expect(pv).toContainText('Khởi tố bị can đối với: Nguyễn Văn Bình');
    await expect(pv).toContainText('Mẫu số: 04');
    await expect(pv).toContainText('/QĐ-CSĐT');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-export]').click()]);
    const text = await docxToText(readFileSync(await dl.path()));
    expect(text).toContain('QUYẾT ĐỊNH\nKhởi tố bị can');
    expect(text).toContain('Viện kiểm sát nhân dân tỉnh Ninh Bình (để phê chuẩn)');
    await page.locator('[data-save]').click();
    await expect(page).toHaveURL(/#forms\/doc\//);
    // Mẫu số được ghi nhớ cho lần sau
    await page.goto('/app.html#forms/qd-khoi-to-bi-can');
    await expect(page.locator('[name="mauSo"]')).toHaveValue('04');
    // Mở lại từ hồ sơ vụ án
    await page.goto('/app.html#cases');
    await page.locator('.case-card').click();
    await page.locator('[data-tab="ldocs"]').click();
    await page.locator('.doc-item a', { hasText: 'Quyết định khởi tố bị can' }).click();
    await expect(page.locator('[name="tomTat"]')).toHaveValue(/05 phiếu chi khống/);
    t.assertClean();
  });
});
