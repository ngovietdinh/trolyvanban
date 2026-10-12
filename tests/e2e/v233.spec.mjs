import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';
import { docxToText } from '../../assets/js/lib/docx.js';
import { buildPack } from '../../assets/js/legal/mau-pack.js';
import { templateDocx, indexDocx } from '../fixtures/mau-synth.mjs';

// Gói mẫu tổng hợp (không phải biểu mẫu chính thức): kiểm thử nạp, tìm, điền, xuất, lưu trên máy.
async function syntheticPack() {
  const { bytes } = await buildPack([
    { name: '2. Danh mục 315 mẫu.docx', data: indexDocx() },
    { name: '27. Quyết định mẫu thử.docx', data: templateDocx() },
    { name: '2A. Biên bản mẫu thử.docx', data: templateDocx() },
    { name: '300. Biên bản nhóm hai.docx', data: templateDocx() },
  ]);
  return { name: 'goi-mau-thu.zip', mimeType: 'application/zip', buffer: Buffer.from(bytes) };
}

test.describe('v2.33 — biểu mẫu chính thức TT 128/2025/TT-BCA nạp từ gói riêng, lưu trên máy', () => {
  test('chưa nạp: giải thích gói riêng; nạp gói → danh mục 13 nhóm, tìm theo số mẫu, soạn, xuất Word đúng chỗ điền', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#forms');
    const card = page.locator('.tt-mau-card').first();
    await expect(card).toContainText('chỉ lưu trên máy');
    await expect(card).toContainText('không đưa lên GitHub');
    await page.setInputFiles('[data-mau-import]', await syntheticPack());
    await expect(page.locator('.toast').filter({ hasText: 'Đã nạp 3 biểu mẫu chính thức' })).toBeVisible();
    await expect(page.locator('.tt-mau-title').first()).toContainText('Mẫu chính thức TT 128/2025/TT-BCA');
    await expect(page.locator('.tt-stage-h[data-stage="mg1"]')).toContainText('Tiếp nhận, giải quyết nguồn tin');
    await expect(page.locator('.tt-stage-h[data-stage="mg2"]')).toContainText('Phân công điều tra');
    // Tìm theo số mẫu: gõ 27 chỉ ra đúng mẫu 27.
    await page.fill('[data-q]', '27');
    await expect(page.locator('a.tt-form-item[href="#forms/m27"]')).toContainText('Mẫu 27');
    await expect(page.locator('a.tt-form-item[href="#forms/m2a"]')).toHaveCount(0);
    await page.locator('a.tt-form-item[href="#forms/m27"]').click();
    await expect(page.locator('.tt-head h1')).toHaveText('Quyết định mẫu thử');
    // Ngày ban hành tự điền hôm nay; số văn bản để trống.
    await expect(page.locator('[data-key="ngayVb"]')).not.toHaveValue('');
    await expect(page.locator('[data-key="so"]')).toHaveValue('');
    await page.fill('[data-key="so"]', '12');
    await page.fill('[data-key="diaDanh"]', 'Ninh Bình');
    await page.fill('[data-key="ngayVb"]', '2026-03-05');
    await page.fill('[data-key="p0.hoTen"]', 'Nguyễn Văn An');
    await page.fill('[data-key="p0.ngaySinh"]', '1971-05-26');
    await expect(page.locator('[data-sheet]')).toContainText('Ninh Bình, ngày 05 tháng 3 năm 2026');
    await expect(page.locator('[data-sheet]')).toContainText('Số: 12');
    await expect(page.locator('[data-sheet]')).not.toContainText('Chức danh tư pháp của người ký ban hành');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-export]')]);
    expect(dl.suggestedFilename()).toMatch(/\.docx$/);
    const path = await dl.path();
    const { readFileSync } = await import('node:fs');
    const text = await docxToText(new Uint8Array(readFileSync(path)));
    expect(text).toContain('Họ tên: Nguyễn Văn An');
    expect(text).toContain('Sinh ngày 26 tháng 5 năm 1971');
    expect(text).toContain('Ninh Bình, ngày 05 tháng 3 năm 2026');
    expect(text).not.toContain('(1) Chức danh tư pháp');
    t.assertClean();
  });

  test('gói mẫu còn sau khi tải lại trang; lọc mẫu Công an cấp xã; lưu văn bản và mở lại; gỡ gói', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#forms');
    await page.setInputFiles('[data-mau-import]', await syntheticPack());
    await expect(page.locator('.tt-stage-h[data-stage="mg1"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('.tt-stage-h[data-stage="mg1"]')).toBeVisible();
    await page.check('[data-mau-xa]');
    await page.locator('.tt-stage-h[data-stage="mg1"]').click();
    await expect(page.locator('a.tt-form-item[href="#forms/m2a"]')).toBeVisible();
    await expect(page.locator('a.tt-form-item[href="#forms/m27"]')).toHaveCount(0);
    await page.uncheck('[data-mau-xa]');
    await page.locator('a.tt-form-item[href="#forms/m27"]').click();
    await page.fill('[data-key="p0.hoTen"]', 'Trần Văn Bình');
    await page.click('[data-save]');
    await expect(page.locator('.toast').filter({ hasText: 'Đã lưu văn bản' })).toBeVisible();
    await expect(page.locator('.tt-doc-row')).toContainText('Mẫu 27');
    await page.reload();
    await expect(page.locator('[data-key="p0.hoTen"]')).toHaveValue('Trần Văn Bình');
    // Gỡ gói khỏi máy.
    page.once('dialog', (d) => d.accept());
    await page.goto('/app.html#forms');
    await page.click('[data-mau-remove]');
    await expect(page.locator('.tt-mau-card').first()).toContainText('chỉ lưu trên máy');
    t.assertClean();
  });
});
