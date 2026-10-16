import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

test.describe('v2.38 — Tra cứu một ô cho mọi dữ liệu', () => {
  test('máy tính: Ctrl K gõ từ khóa → “Tra cứu …” mở trang kết quả; lọc theo nhóm; máy tính không bật chế độ xem', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#dashboard');
    await expect(page.locator('body')).not.toHaveClass(/view-mode/);
    await expect(page.locator('[data-mode-toggle]')).toBeHidden();
    await page.evaluate(async () => {
      const { casesRepo } = await import('/assets/js/legal/repo.js');
      casesRepo.save({ ten: 'Vụ lừa đảo chiếm đoạt tài sản qua mạng', soHoSo: '07/2026', toiDanh: ['174'], persons: [{ id: 'p', hoTen: 'Phạm Minh Đức', roleId: 'bi-can' }] });
    });
    await page.keyboard.press('Control+k');
    await page.fill('.palette input', 'minh duc');
    await page.locator('.palette-item', { hasText: 'Tra cứu “minh duc”' }).click();
    await expect(page).toHaveURL(/#tra-cuu\/minh%20duc$/);
    await expect(page.locator('[data-tc-q]')).toHaveValue('minh duc');
    await expect(page.locator('.tc-group', { hasText: 'Người tham gia' })).toContainText('Phạm Minh Đức');
    await page.click('[data-tc-f="cases"]');
    await expect(page.locator('.tc-group')).toHaveCount(1);
    await expect(page.locator('.tc-group')).toContainText('Vụ lừa đảo chiếm đoạt tài sản qua mạng');
    await page.click('.tc-group a');
    await expect(page).toHaveURL(/#cases\//);
    t.assertClean();
  });
});
