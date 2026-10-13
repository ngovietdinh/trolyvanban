import { test, expect } from '@playwright/test';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackErrors, freshApp } from './helpers.mjs';

const fx = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/doc');
const warn = (page) => page.locator('.toast.warn').last();

test.describe('v2.36 — đọc tệp Word cũ (.doc), báo rõ còn thiếu gì', () => {
  test('tải biên bản .doc: tự đọc ngay khi chọn tệp; bấm Lưu khi chưa có gì thì báo thiếu; đủ thì lưu', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#theo-doi');
    await page.click('[data-upload]');
    // Chưa có gì → bấm Lưu: báo thiếu biên bản (không còn nút khóa im lặng).
    await expect(page.locator('[data-ru-save]')).toBeEnabled();
    await page.click('[data-ru-save]');
    await expect(warn(page)).toContainText('Chưa có biên bản để lưu');
    // Chọn tệp Word cũ .doc → tự đọc, không cần bấm “Đọc biên bản”.
    await page.locator('.modal [data-file]').setInputFiles(join(fx, 'bien-ban.doc'));
    await expect(page.locator('[data-ru-preview]')).toContainText('2 lượt hỏi – đáp');
    await expect(page.locator('[data-ru-preview]')).toContainText('1.250.000.000 đồng');
    await expect(page.locator('#ru-date')).toHaveValue('2026-03-05');
    await expect(page.locator('#ru-name')).toHaveValue('Nguyễn Văn An');
    await page.click('[data-ru-save]');
    await expect(page.locator('.toast').last()).toContainText('Đã lưu biên bản (2 lượt hỏi – đáp');
    t.assertClean();
  });

  test('dán nội dung không có Hỏi – Đáp / thiếu họ tên → Lưu báo rõ lý do; tệp lạ báo loại tệp chưa đọc được', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#theo-doi');
    await page.click('[data-upload]');
    await page.fill('[data-ru-text]', 'Hôm nay tôi đến cơ quan làm việc, không có câu hỏi nào.');
    await page.click('[data-ru-save]');
    await expect(warn(page)).toContainText('chưa tách được lượt Hỏi – Đáp nào');
    await page.locator('.modal [data-file]').setInputFiles({ name: 'bang-tinh.xlsx', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('PK') });
    await expect(page.locator('.toast.error').last()).toContainText('Chưa đọc được loại tệp “bang-tinh.xlsx”');
    // Có Hỏi – Đáp (cả kiểu chung một dòng) nhưng không ghi họ tên → báo thiếu họ tên, đưa con trỏ tới ô đó.
    await page.fill('[data-ru-text]', 'Hỏi: Chị nhận bao nhiêu tiền? Đáp: Tôi nhận một trăm triệu đồng.');
    await page.click('[data-ru-save]');
    await expect(warn(page)).toContainText('chưa có họ tên người khai');
    await expect(page.locator('#ru-name')).toBeFocused();
    await page.fill('#ru-name', 'Trần Thị Bình');
    await page.click('[data-ru-save]');
    await expect(page.locator('.toast').last()).toContainText('Đã lưu biên bản (1 lượt hỏi – đáp');
    t.assertClean();
  });

  test('tạo mẫu từ file Word .doc: tự chuyển sang .docx rồi nhận diện trường cần điền', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#tpl/new');
    await page.locator('[data-file]').setInputFiles(join(fx, 'bien-ban.doc'));
    await expect(page.locator('.toast').filter({ hasText: 'Đã tự chuyển “bien-ban.doc” sang .docx' })).toBeVisible();
    await expect(page.locator('.page-sub')).toContainText('bien-ban.docx');
    await expect(page.locator('.tpl-editor')).toContainText('BIÊN BẢN GHI LỜI KHAI');
    t.assertClean();
  });

  test('kho tài liệu, tóm tắt đọc được .doc (kể cả phông TCVN3)', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#kho');
    await page.locator('.kho [data-file]').setInputFiles(join(fx, 'tcvn3.doc'));
    await expect(page.locator('.kho-item')).toHaveCount(1);
    await page.fill('.kho [data-q]', 'một trăm triệu');
    await expect(page.locator('.kho-item')).toHaveCount(1);
    await page.goto('/app.html#summary');
    await page.locator('[data-file]').setInputFiles(join(fx, 'bien-ban.doc'));
    await expect(page.locator('[data-input]')).toHaveValue(/Giám đốc Lê Văn Cường chỉ đạo/);
    t.assertClean();
  });

  test('nút chưa dùng được vẫn bấm được và nói rõ thiếu gì', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#pdf');
    await page.click('[data-go]', { force: true });
    await expect(warn(page)).toContainText('Chưa chọn tệp');
    await page.goto('/app.html#settings');
    await page.locator('[data-clear-chats]').click({ force: true });
    await expect(warn(page)).toContainText('Chưa có cuộc trò chuyện nào để xóa');
    await page.goto('/app.html#compose/cong-van');
    await page.locator('[data-export]').click();
    await expect(warn(page)).toContainText('còn thiếu');
    await expect(warn(page)).toContainText('“');
    t.assertClean();
  });
});
