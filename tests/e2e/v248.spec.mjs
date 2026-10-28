// v2.48 — Tòa án: nhập từ tệp, tự điền hồ sơ vụ án (bảng duyệt, câu trích, điền ô trống, bị cáo, người tham gia).
import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';
import { textToDocx } from '../../assets/js/lib/doc.js';

const QD = `TÒA ÁN NHÂN DÂN TỈNH NINH BÌNH
TÒA ÁN NHÂN DÂN KHU VỰC 3
Số: 130/2026/QĐXXST-HS
Ninh Bình, ngày 20 tháng 10 năm 2026
QUYẾT ĐỊNH ĐƯA VỤ ÁN RA XÉT XỬ
Sau khi nghiên cứu hồ sơ vụ án hình sự sơ thẩm thụ lý số 120/2026/TLST-HS ngày 15 tháng 9 năm 2026,
QUYẾT ĐỊNH:
1. Đưa ra xét xử sơ thẩm vụ án hình sự đối với bị cáo: Nguyễn Văn An, sinh năm 1985; nơi cư trú: thôn Đông, xã Tây, tỉnh Ninh Bình; bị Viện kiểm sát nhân dân khu vực 3 truy tố về tội "Lừa đảo chiếm đoạt tài sản" theo điểm c khoản 2 Điều 174 Bộ luật Hình sự.
Thời gian mở phiên tòa: 08 giờ 00 ngày 05 tháng 11 năm 2026.
Địa điểm mở phiên tòa: trụ sở Tòa án nhân dân khu vực 3 - Ninh Bình, số 1 đường Trần Hưng Đạo.
2. Những người tiến hành tố tụng:
Thẩm phán - Chủ tọa phiên tòa: Ông Phạm Văn Hùng
Các Hội thẩm nhân dân: Bà Lê Thị Hoa; Ông Trần Văn Nam
Thư ký phiên tòa: Bà Nguyễn Thị Lan
Kiểm sát viên: Ông Vũ Văn Minh - Viện kiểm sát nhân dân khu vực 3
3. Những người tham gia tố tụng:
Bị hại: Chị Trần Thị Bình; địa chỉ: phố Lê Lợi, phường Nam, tỉnh Ninh Bình.
Người bào chữa cho bị cáo: Luật sư Đỗ Văn Khoa - Văn phòng luật sư Hoa Lư.`;
const CT = `VIỆN KIỂM SÁT NHÂN DÂN KHU VỰC 3
Số: 25/CT-VKSKV3
Ninh Bình, ngày 15 tháng 9 năm 2026
CÁO TRẠNG
Bị can: Nguyễn Văn An, sinh ngày 12/3/1985; nơi cư trú: thôn Đông, xã Tây, tỉnh Ninh Bình. Bị bắt tạm giam từ ngày 10/01/2026 đến nay.
Bị hại: chị Trần Thị Bình, sinh năm 1980.
NỘI DUNG VỤ ÁN
Khoảng 14 giờ ngày 05/12/2025, Nguyễn Văn An đã dùng thủ đoạn gian dối chiếm đoạt số tiền 180.000.000 đồng của chị Trần Thị Bình.
Truy tố bị can Nguyễn Văn An ra trước Tòa án nhân dân khu vực 3 - Ninh Bình để xét xử về tội "Lừa đảo chiếm đoạt tài sản" theo điểm c khoản 2 Điều 174 Bộ luật Hình sự.`;

test.describe('v2.48 — Tòa án: nhập từ tệp, tự điền hồ sơ', () => {
  test('tải quyết định đưa vụ án ra xét xử (Word) + dán cáo trạng → bảng duyệt có câu trích → điền ô trống, bị cáo, người tham gia; ô đã có không bị ghi đè', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#toa-an', { agency: 'toa-an' });
    await page.click('[data-new="so-tham"]');
    await page.click('[data-ct-save]'); // hồ sơ mới là bản nháp — lưu vào sổ
    await expect(page).toHaveURL(/\/vu-an$/);
    // Ô đã có giá trị khác: không ghi đè.
    await page.fill('[data-v="hdxx.chuToa"]', 'Thẩm phán Khác');
    const ex = page.locator('[data-ex]');
    await expect(ex).toContainText('Nhập từ tệp');
    await expect(ex.locator('[data-ex-sources]')).toBeDisabled();
    await ex.locator('input[type=file]').setInputFiles({ name: 'QD dua vu an ra xet xu.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(textToDocx(QD)) });
    await page.fill('[data-ex-paste]', CT);
    await page.click('[data-ex-read]');
    const sum = ex.locator('.ct-ex-sum');
    await expect(sum).toContainText('Đã đọc 2 tài liệu');
    await expect(sum).toContainText('Quyết định đưa vụ án ra xét xử (QD dua vu an ra xet xu.docx)');
    await expect(sum).toContainText('Cáo trạng (Nội dung dán 1)');
    await expect(sum).toContainText('1 bị cáo');
    await expect(sum).toContainText('2 người tham gia tố tụng');
    const table = ex.locator('.ct-ex-table');
    await expect(table).toContainText('120/2026/TLST-HS');
    await expect(table).toContainText('“Thẩm phán - Chủ tọa phiên tòa: Ông Phạm Văn Hùng”');
    // Chủ tọa: hồ sơ đã có "Thẩm phán Khác" → đánh dấu khác, bỏ chọn sẵn.
    await expect(table.locator('tr.ct-ex-conflict')).toHaveCount(1, { timeout: 3000 });
    const chuToa = table.locator('tr.ct-ex-conflict').first();
    await expect(chuToa).toContainText('Thẩm phán – Chủ tọa phiên tòa');
    await expect(chuToa).toContainText('khác — chọn để thay');
    await expect(chuToa.locator('input[type=checkbox]')).not.toBeChecked();
    // Tòa án: lựa chọn khác từ cáo trạng (có "- Ninh Bình").
    await expect(table).toContainText('Hoặc:');
    await table.locator('[data-ex-alt]').first().click();
    await expect(table.locator('[data-ex-row] input[aria-label="Tòa án"]')).toHaveValue('Tòa án nhân dân khu vực 3 - Ninh Bình');
    // Sửa giá trị trước khi điền.
    await table.locator('input[aria-label="Giờ mở phiên tòa"]').fill('08 giờ 30');
    await page.click('[data-ex-apply]');
    await expect(page.locator('.toast').last()).toContainText('Đã điền');
    await expect(page.locator('.toast').last()).toContainText('bỏ qua 1 ô đã có giá trị khác');
    await expect(page.locator('[data-v="thuLy.so"]')).toHaveValue('120/2026/TLST-HS');
    await expect(page.locator('[data-v="thuLy.ngay"]')).toHaveValue('2026-09-15');
    await expect(page.locator('[data-v="toa.ten"]')).toHaveValue('Tòa án nhân dân khu vực 3 - Ninh Bình');
    await expect(page.locator('[data-v="hdxx.chuToa"]')).toHaveValue('Thẩm phán Khác');
    await expect(page.locator('[data-v="hdxx.hoiTham"]')).toHaveValue('Lê Thị Hoa\nTrần Văn Nam');
    await expect(page.locator('[data-v="hdxx.thuKy"]')).toHaveValue('Nguyễn Thị Lan');
    await expect(page.locator('[data-v="hdxx.kiemSatVien"]')).toHaveValue('Vũ Văn Minh');
    await expect(page.locator('[data-v="caoTrang.so"]')).toHaveValue('25/CT-VKSKV3');
    await expect(page.locator('[data-v="caoTrang.ngay"]')).toHaveValue('2026-09-15');
    await expect(page.locator('[data-v="moc.soQdXetXu"]')).toHaveValue('130/2026/QĐXXST-HS');
    await expect(page.locator('[data-v="moc.ngayXetXu"]')).toHaveValue('2026-11-05');
    await expect(page.locator('[data-v="moc.gioXetXu"]')).toHaveValue('08 giờ 30');
    await expect(page.locator('[data-v="moc.ngayHanhVi"]')).toHaveValue('2025-12-05');
    await expect(page.locator('[data-tg="0"] [data-tgf="hoTen"]')).toHaveValue('Trần Thị Bình');
    await expect(page.locator('[data-tg="0"] [data-tgf="diaChi"]')).toHaveValue('phố Lê Lợi, phường Nam, tỉnh Ninh Bình');
    await expect(page.locator('[data-tg="1"] [data-tgf="vaiTro"]')).toHaveValue('nguoi-bao-chua');
    await expect(page.locator('[data-ct-name]')).toHaveValue('Lừa đảo chiếm đoạt tài sản — Nguyễn Văn An');
    // Thời hạn tính ngay từ ngày thụ lý + loại tội phạm chưa chọn → nhắc chọn.
    await expect(page.locator('[data-dl="chuan-bi"]')).toContainText('Chọn loại tội phạm');
    // Bị cáo và tài liệu sang tab Tài liệu & bị cáo (tệp lưu với loại đúng).
    await page.click('[data-ct-tab="tai-lieu"]');
    const def = page.locator('[data-def="0"]');
    await expect(def.locator('[data-f="hoTen"]')).toHaveValue('Nguyễn Văn An');
    await expect(def.locator('[data-f="namSinh"]')).toHaveValue('1985');
    await expect(def.locator('[data-n="loai"]')).toHaveValue('tam-giam');
    await expect(def.locator('[data-t="dieu"]')).toHaveValue('174');
    await expect(page.locator('[data-src-loai="0"]')).toHaveValue('khac');
    await expect(page.locator('[data-src-loai="1"]')).toHaveValue('cao-trang');
    // Nút "Bắt từ tài liệu đã nạp" dùng lại tài liệu; chạy lại không nhân đôi bị cáo, người tham gia.
    await page.click('[data-ct-tab="vu-an"]');
    await expect(page.locator('[data-ex-sources]')).toContainText('Bắt từ 2 tài liệu đã nạp');
    await page.click('[data-ex-sources]');
    await expect(page.locator('.ct-ex-sum')).toContainText('Đã đọc 2 tài liệu');
    await expect(page.locator('.ct-ex-table')).toContainText('trùng');
    await page.click('[data-ex-apply]');
    await expect(page.locator('[data-tg-rows] .ct-tg-row')).toHaveCount(2);
    await page.reload();
    await expect(page.locator('[data-v="thuLy.so"]')).toHaveValue('120/2026/TLST-HS');
    await expect(page.locator('[data-tg-rows] .ct-tg-row')).toHaveCount(2);
    t.assertClean();
  });

  test('văn bản không có thông tin vụ án → báo không bắt được, nêu dạng câu cần có; chưa chọn tệp → nhắc', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#toa-an', { agency: 'toa-an' });
    await page.click('[data-new="phuc-tham"]');
    await page.click('[data-ct-save]'); // hồ sơ mới là bản nháp — lưu vào sổ
    await page.click('[data-ex-read]');
    await expect(page.locator('.toast').last()).toContainText('Chưa có tài liệu');
    await page.fill('[data-ex-paste]', 'Hôm nay trời đẹp, chúng tôi họp tổ dân phố về việc thu gom rác và trồng cây xanh.');
    await page.click('[data-ex-read]');
    await expect(page.locator('[data-ex-out]')).toContainText('không bắt được thông tin nào');
    await expect(page.locator('[data-ex-out]')).toContainText('thụ lý số');
    t.assertClean();
  });
});
