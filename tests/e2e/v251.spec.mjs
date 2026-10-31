// v2.50 — OCR bản quét: cài đặt chế độ nhận dạng (trên máy / + AI soát lỗi / AI đọc ảnh) lưu riêng tài khoản; ảnh chụp văn bản
// được nhận dạng và tự sửa dấu bằng mô hình ngôn ngữ pháp lý.
import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

test.describe('v2.51 — nhận dạng chữ bản quét', () => {
  test('Cài đặt: chọn chế độ OCR, nút AI khóa khi chưa có AI, lựa chọn được ghi nhớ', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#settings');
    const seg = page.locator('[data-ocr-mode]');
    await expect(seg).toHaveCount(3);
    await expect(page.locator('[data-ocr-mode="may"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-ocr-mode="ai"]')).toBeDisabled();
    await expect(page.locator('[data-ocr-mode="may-ai"]')).toBeDisabled();
    const mode = await page.evaluate(async () => (await import('/assets/js/lib/extract.js')).ocrMode());
    expect(mode).toBe('may');
    // Có AI → bật được; chọn AI đọc ảnh → extract.js thấy chế độ 'ai'.
    await page.evaluate(async () => {
      const { store } = await import('/assets/js/lib/store.js');
      store.set('ocr-mode', 'ai');
    });
    expect(await page.evaluate(async () => (await import('/assets/js/lib/extract.js')).ocrMode())).toBe('ai');
    await page.reload();
    await expect(page.locator('[data-ocr-mode="ai"]')).toHaveAttribute('aria-pressed', 'true');
    await page.click('[data-ocr-mode="may"]');
    await expect(page.locator('.toast').last()).toContainText('trên máy');
    expect(await page.evaluate(async () => (await import('/assets/js/lib/extract.js')).ocrMode())).toBe('may');
    t.assertClean();
  });

  test('mô hình sửa lỗi OCR nạp được trong trình duyệt và sửa dấu chữ hoa', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#settings');
    const out = await page.evaluate(async () => {
      const { correctText, correctLine } = await import('/assets/js/lib/vi-correct.js');
      const a = await correctText('TOA ÁN NHÂN DÂN TOI CAO\nQuyét định số 162/QĐ-CA');
      // Chữ hợp lệ sai dấu ("so") chỉ sửa khi OCR cho độ tin cậy dưới 95 và tạo cụm cố định ("định số").
      const b = correctLine('Quyết định so 162/QĐ-CA', { words: [{ text: 'Quyết', confidence: 97 }, { text: 'định', confidence: 97 }, { text: 'so', confidence: 88 }, { text: '162/QĐ-CA', confidence: 95 }] }).text;
      return `${a}\n${b}`;
    });
    expect(out).toBe('TÒA ÁN NHÂN DÂN TỐI CAO\nQuyết định số 162/QĐ-CA\nQuyết định số 162/QĐ-CA');
    t.assertClean();
  });
});
