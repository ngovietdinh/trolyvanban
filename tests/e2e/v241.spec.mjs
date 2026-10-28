import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { trackErrors, freshApp } from './helpers.mjs';
import { COURT_BOOK } from './court-book.mjs';
import { readZip, docxToText } from '../../assets/js/lib/docx.js';

const BAN_AN = `TÒA ÁN NHÂN DÂN KHU VỰC 3 - NINH BÌNH
Bản án số: 25/2026/HS-ST
NHÂN DANH NƯỚC CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
NỘI DUNG VỤ ÁN: Bị cáo Nguyễn Văn An, sinh năm 1985, đã dùng thủ đoạn gian dối, đưa thông tin sai sự thật về dự án đất nền để chị Trần Thị Bình tin tưởng giao tiền, chiếm đoạt số tiền 180.000.000 đồng.
NHẬN ĐỊNH CỦA TÒA ÁN: Tại phiên tòa bị cáo thành khẩn khai báo, ăn năn hối cải. Gia đình bị cáo đã bồi thường cho bị hại 50.000.000 đồng.
QUYẾT ĐỊNH: Tuyên bố bị cáo Nguyễn Văn An phạm tội "Lừa đảo chiếm đoạt tài sản".
Áp dụng điểm a khoản 3 Điều 174; điểm s khoản 1 Điều 51 của Bộ luật Hình sự.
Xử phạt bị cáo Nguyễn Văn An 08 (tám) năm tù, thời hạn tù tính từ ngày bắt tạm giam.`;
const LK = 'BIÊN BẢN LẤY LỜI KHAI BỊ HẠI\nChị Trần Thị Bình khai: An đã chiếm đoạt của tôi số tiền 200.000.000 đồng, An nói dối là có dự án đất nền nên tôi tin tưởng giao tiền cho An tại nhà tôi vào tháng 5 năm 2025.';
const AN_LE = 'TÒA ÁN NHÂN DÂN TỐI CAO\nÁN LỆ SỐ 99/2026/AL\nVề xác định giá trị tài sản bị chiếm đoạt\nÁn lệ số 99/2026/AL\nKhái quát nội dung của án lệ:\nBị cáo nhiều lần chiếm đoạt tài sản thì giá trị tài sản bị chiếm đoạt là tổng giá trị các lần.\n\nQuy định của pháp luật liên quan đến án lệ:\nĐiều 174 Bộ luật Hình sự năm 2015.\n';
const DON = 'ĐƠN KHÁNG CÁO\nTôi tên là: Nguyễn Văn An, sinh năm 1985\nLà bị cáo trong vụ án theo Bản án số 25/2026/HS-ST ngày 15/10/2026.\nTòa án áp dụng khoản 3 Điều 174 là không đúng, số tiền chỉ 180.000.000 đồng nên phải xử theo khoản 2 Điều 174.\nHà Nội, ngày 20 tháng 10 năm 2026';

async function setup(page) {
  await freshApp(page, '#binh-luan');
  await page.locator('[data-bl-file]').setInputFiles({ name: 'binh-luan-mau.txt', mimeType: 'text/plain', buffer: Buffer.from(COURT_BOOK) });
  await expect(page.locator('.toast').last()).toContainText('Đã nạp');
  // Kho: 2 bản án đã xét xử + 1 án lệ.
  await page.goto('/app.html#toa-an/kho-ban-an');
  await page.fill('[data-kho-paste]', BAN_AN.replace('25/2026', '11/2025').replace('08 (tám) năm', '03 (ba) năm').replace('khoản 3 Điều 174;', 'khoản 2 Điều 174;'));
  await page.click('[data-kho-add]');
  await expect(page.locator('[data-kho-count]')).toHaveText('1 bản án · 0 án lệ');
  await page.fill('[data-kho-paste]', BAN_AN.replace('25/2026', '12/2025').replace('08 (tám) năm', '04 (bốn) năm').replace('khoản 3 Điều 174;', 'khoản 2 Điều 174;'));
  await page.click('[data-kho-add]');
  await page.fill('[data-kho-paste]', AN_LE);
  await page.click('[data-kho-add]');
  await expect(page.locator('[data-kho-count]')).toHaveText('2 bản án · 1 án lệ');
  await expect(page.locator('[data-kho-list]')).toContainText('Nguyễn Văn An: khoản 2 Điều 174 — 3 năm tù');
  await page.fill('[data-kho-q]', '99/2026');
  await expect(page.locator('[data-kho-row]')).toHaveCount(1);
  // Hồ sơ phúc thẩm: ngày hành vi, bản án sơ thẩm (BL 120), lời khai bị hại (BL 45).
  await page.goto('/app.html#toa-an');
  await page.click('[data-new="phuc-tham"]');
  await page.fill('[data-v="moc.ngayHanhVi"]', '2025-05-10');
  await page.click('[data-ct-tab="tai-lieu"]');
  await page.fill('[data-ct-paste]', BAN_AN);
  await page.click('[data-ct-add]');
  await page.fill('[data-ct-paste]', LK);
  await page.click('[data-ct-add]');
  await expect(page.locator('[data-src-loai="0"]')).toHaveValue('ban-an');
  await expect(page.locator('[data-src-loai="1"]')).toHaveValue('loi-khai-bi-hai');
  await page.locator('[data-src-bl="0"]').fill('120');
  await page.locator('[data-src-bl="0"]').press('Tab');
  await expect(page.locator('[data-src-range="0"]')).toHaveText('BL 120');
  await page.locator('[data-src-bl="1"]').fill('45');
  await page.locator('[data-src-bl="1"]').press('Tab');
  await page.click('[data-ct-parse]');
  await expect(page.locator('.toast').last()).toContainText('Đã đọc 1 bị cáo');
}

test.describe('v2.41 — Thẩm tra: 5 câu hỏi, chứng cứ theo bút lục, bản án tương tự, báo cáo', () => {
  test('5 câu hỏi nghiệp vụ, đề xuất theo loại thẩm tra, báo cáo thẩm tra (Word), bảng đối chiếu (Excel)', async ({ page }) => {
    const t = trackErrors(page);
    await setup(page);
    await page.click('[data-ct-tab="tham-tra"]');
    await expect(page.locator('.tt-control')).toContainText('không xác định một người có tội');
    const q1 = page.locator('[data-q="q1"]');
    await expect(q1.locator('[data-q-kl]')).toHaveText('Có dấu hiệu vi phạm');
    await expect(q1).toContainText('thuộc khoản 2, không phải khoản 3 Điều 174');
    await expect(q1).toContainText('Luật số 86/2025/QH15');
    await expect(page.locator('[data-q="q2"]')).toContainText('Hồ sơ đã nạp chưa có: Cáo trạng');
    await expect(page.locator('[data-q="q2"] .ct-fact').first()).toContainText(/BL (120|45)/);
    await expect(page.locator('[data-q="q4"]')).toContainText('Chưa có đơn');
    await expect(page.locator('[data-q="q5"]')).toContainText('Có căn cứ xem xét sửa bản án sơ thẩm');
    await page.locator('[data-tt="loai"]').selectOption('giam-doc-tham');
    await expect(page.locator('[data-q="q5"]')).toContainText('Có căn cứ đề xuất kháng nghị theo thủ tục giám đốc thẩm');
    await expect(page.locator('[data-q="q5"]')).toContainText('Điều 371 BLTTHS');
    await page.fill('[data-tt="nguoi"]', 'Phạm Thẩm Tra');
    await page.locator('[data-tt="nguoi"]').press('Tab');
    await page.click('[data-tt-preview]');
    const modal = page.locator('.preview-modal');
    await expect(modal).toContainText('BÁO CÁO THẨM TRA');
    await expect(modal).toContainText('8. ĐỀ XUẤT PHƯƠNG ÁN GIẢI QUYẾT');
    await expect(modal).toContainText('PHỤ LỤC: BẢNG ĐỐI CHIẾU CHỨNG CỨ THEO BÚT LỤC');
    await expect(modal).toContainText('Phạm Thẩm Tra');
    await modal.locator('.modal-actions [data-close]').click();
    let [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-tt-report]')]);
    expect(dl.suggestedFilename()).toMatch(/\.docx$/);
    const txt = await docxToText(new Uint8Array(fs.readFileSync(await dl.path())));
    expect(txt).toContain('6. PHÂN TÍCH CĂN CỨ PHÁP LUẬT, ÁN LỆ VÀ BẢN ÁN TƯƠNG TỰ');
    expect(txt).toContain('Án lệ 99/2026/AL');
    [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-tt-xlsx]').first().click()]);
    expect(dl.suggestedFilename()).toMatch(/\.xlsx$/);
    const zip = await readZip(new Uint8Array(fs.readFileSync(await dl.path())));
    expect(new TextDecoder().decode(await zip.read('xl/workbook.xml'))).toContain('Chứng cứ theo bút lục');
    expect(new TextDecoder().decode(await zip.read('xl/worksheets/sheet1.xml'))).toContain('Nội dung dán 2, BL 45');
    t.assertClean();
  });

  test('chứng cứ theo bút lục, bản án tương tự và án lệ, dự thảo văn bản trả lời kiến nghị, văn bản theo thời điểm', async ({ page }) => {
    const t = trackErrors(page);
    await setup(page);
    await page.click('[data-ct-tab="chung-cu"]');
    const out = page.locator('[data-ct-out]');
    await expect(out).toContainText('Số tiền / giá trị được nêu khác nhau giữa các tài liệu: 200.000.000 đồng; 180.000.000 đồng');
    await expect(out.locator('.tt-table')).toContainText('Nội dung dán 2, BL 45');
    await expect(out.locator('.tt-table')).toContainText('Dấu hiệu định khung: điểm a khoản 3 Điều 174');
    await page.click('[data-ct-tab="tuong-tu"]');
    await expect(out).toContainText('2 bản án cùng Điều 174 (khác khoản)');
    await expect(out.locator('.ct-range')).toContainText('mức tù từ 3 năm đến 4 năm');
    await expect(out).toContainText('Án lệ 99/2026/AL');
    // Dự thảo văn bản trả lời đơn kháng cáo.
    await page.click('[data-ct-tab="khieu-nai"]');
    await page.fill('[data-don-paste]', DON);
    await page.click('[data-don-add]');
    await page.click('[data-don-reply]');
    const modal = page.locator('.preview-modal');
    await expect(modal).toContainText('V/v trả lời đơn kháng cáo');
    await expect(modal).toContainText('Kính gửi: Ông/Bà Nguyễn Văn An');
    const [dl] = await Promise.all([page.waitForEvent('download'), modal.locator('[data-reply-export]').click()]);
    expect(dl.suggestedFilename()).toMatch(/\.docx$/);
    await modal.locator('.modal-actions [data-close]').click();
    await page.click('[data-ct-tab="tham-tra"]');
    await expect(page.locator('[data-q="q4"]')).toContainText('Đơn kháng cáo “Đơn dán 1” của Nguyễn Văn An');
    // Cài đặt: văn bản pháp luật theo thời điểm, sửa được.
    await page.goto('/app.html#toa-an/cai-dat');
    const row = page.locator('.ct-laws tr', { hasText: 'cần kiểm tra' }).first();
    await expect(row.locator('[data-lf="ten"]')).toHaveValue(/Luật số 86\/2025\/QH15/);
    await row.locator('[data-lf="tu"]').fill('2025-07-01');
    await page.reload();
    await expect(page.locator('.ct-laws tr').nth(3).locator('[data-lf="tu"]')).toHaveValue('2025-07-01');
    t.assertClean();
  });
});
