import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';
import { COURT_BOOK } from './court-book.mjs';
import fs from 'node:fs';
import { textToDocx } from '../../assets/js/lib/doc.js';
import { docxToText } from '../../assets/js/lib/docx.js';

const CAO_TRANG = `VIỆN KIỂM SÁT NHÂN DÂN TỈNH NINH BÌNH
VIỆN KIỂM SÁT NHÂN DÂN KHU VỰC 3
Số: 25/CT-VKSKV3
Ninh Bình, ngày 15 tháng 9 năm 2026
CÁO TRẠNG
Bị can: Nguyễn Văn An (tên gọi khác: không), sinh ngày 12/3/1985 tại Ninh Bình; nơi cư trú: thôn Đông, xã Tây, tỉnh Ninh Bình; nghề nghiệp: lao động tự do. Bị bắt tạm giam từ ngày 10/01/2026 đến nay.
Bị hại: chị Trần Thị Bình, sinh năm 1980.
Nguyễn Văn An đã dùng thủ đoạn gian dối chiếm đoạt số tiền 180.000.000 đồng của chị Trần Thị Bình.
Truy tố bị can Nguyễn Văn An ra trước Tòa án nhân dân khu vực 3 - Ninh Bình để xét xử về tội "Lừa đảo chiếm đoạt tài sản" theo điểm c khoản 2 Điều 174 Bộ luật Hình sự.`;

async function importBook(page) {
  await page.goto('/app.html#binh-luan');
  await page.locator('[data-bl-file]').setInputFiles({ name: 'binh-luan-mau.txt', mimeType: 'text/plain', buffer: Buffer.from(COURT_BOOK) });
  await expect(page.locator('.toast').last()).toContainText('Đã nạp');
}
const isoIn = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test.describe('v2.40 — Tòa án: sổ vụ án, thời hạn, tính hình phạt, biểu mẫu', () => {
  test('cài đặt Tòa án → vụ án sơ thẩm: thụ lý, đọc cáo trạng, thời hạn và việc cần làm', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#dashboard');
    await importBook(page);
    await page.goto('/app.html#toa-an/cai-dat');
    await page.fill('[data-org="toaAn"]', 'Tòa án nhân dân khu vực 3 - Ninh Bình');
    await page.fill('[data-org="diaDanh"]', 'Ninh Bình');
    await page.fill('[data-rule="canh-bao"]', '10');
    await page.goto('/app.html#toa-an');
    await page.click('[data-new="so-tham"]');
    await page.click('[data-ct-save]'); // hồ sơ mới là bản nháp — lưu vào sổ
    await expect(page).toHaveURL(/#toa-an\/.+\/vu-an$/);
    await expect(page.locator('[data-v="toa.ten"]')).toHaveValue('Tòa án nhân dân khu vực 3 - Ninh Bình');
    await page.fill('[data-v="thuLy.so"]', '120/2026/TLST-HS');
    await page.fill('[data-v="thuLy.ngay"]', isoIn(-40));
    await page.fill('[data-v="hdxx.chuToa"]', 'Phạm Văn Hùng');
    await expect(page.locator('[data-dl="chuan-bi"]')).toContainText('Chọn loại tội phạm');
    // Đọc cáo trạng ở tab Tài liệu & bị cáo.
    await page.click('[data-ct-tab="tai-lieu"]');
    await page.fill('[data-ct-paste]', CAO_TRANG);
    await page.click('[data-ct-indict]');
    await expect(page.locator('.toast').last()).toContainText('Đã đọc cáo trạng số 25/CT-VKSKV3: 1 bị cáo, 1 bị hại');
    const def = page.locator('[data-def="0"]');
    await expect(def.locator('[data-f="hoTen"]')).toHaveValue('Nguyễn Văn An');
    await expect(def.locator('[data-f="namSinh"]')).toHaveValue('1985');
    await expect(def.locator('[data-f="noiCuTru"]')).toHaveValue('thôn Đông, xã Tây, tỉnh Ninh Bình');
    await expect(def.locator('[data-n="loai"]')).toHaveValue('tam-giam');
    await expect(def.locator('[data-t="dieu"]')).toHaveValue('174');
    await expect(page.locator('[data-ct-name]')).toHaveValue('Lừa đảo chiếm đoạt tài sản — Nguyễn Văn An');
    await def.locator('[data-n="den"]').fill(isoIn(3));
    // Vụ án: cáo trạng, bị hại, loại tội phạm theo khung truy tố (khoản 2 Điều 174 → nghiêm trọng, 45 ngày).
    await page.click('[data-ct-tab="vu-an"]');
    await expect(page.locator('[data-v="caoTrang.so"]')).toHaveValue('25/CT-VKSKV3');
    await expect(page.locator('[data-tg="0"] [data-tgf="hoTen"]')).toHaveValue('Trần Thị Bình');
    await expect(page.locator('[data-v="loaiToi"]')).toHaveValue('nt');
    const cb = page.locator('[data-dl="chuan-bi"]');
    await expect(cb).toContainText('Chuẩn bị xét xử (nghiêm trọng)');
    await expect(cb).toContainText('khoản 1 Điều 277 BLTTHS');
    await expect(cb.locator('.badge')).toContainText(/Sắp đến hạn · còn \d+ ngày/);
    await expect(page.locator('[data-dl^="tam-giam-"] .badge')).toContainText('còn 3 ngày');
    // Có quyết định đưa vụ án ra xét xử → chuẩn bị xét xử xong, phát sinh hạn mở phiên tòa.
    await page.fill('[data-v="moc.ngayQdXetXu"]', isoIn(-2));
    await expect(page.locator('[data-dl="chuan-bi"] .badge')).toHaveText('Đã xong');
    await expect(page.locator('[data-dl="mo-phien-toa"]')).toContainText('khoản 3 Điều 277 BLTTHS');
    // Danh sách: việc cần làm theo thời hạn, hạn gần nhất.
    await page.goto('/app.html#toa-an');
    await expect(page.locator('.ct-todo')).toContainText('Hết hạn tạm giam — bị cáo Nguyễn Văn An');
    await expect(page.locator('.ct-list')).toContainText('Thụ lý số 120/2026/TLST-HS');
    await page.locator('.ct-todo a').first().click();
    await expect(page).toHaveURL(/\/vu-an$/);
    t.assertClean();
  });

  test('tính hình phạt: khoảng hợp pháp (Điều 54), tổng hợp (Điều 55), trừ tạm giam và ngày chấp hành xong', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#dashboard');
    await importBook(page);
    await page.goto('/app.html#toa-an');
    await page.click('[data-new="so-tham"]');
    await page.click('[data-ct-save]'); // hồ sơ mới là bản nháp — lưu vào sổ
    await page.click('[data-ct-tab="tai-lieu"]');
    const def = page.locator('[data-def="0"]');
    await def.locator('[data-f="hoTen"]').fill('Nguyễn Văn An');
    await def.locator('[data-t="dieu"]').fill('174');
    await def.locator('[data-t="khoan"]').fill('2');
    await page.click('[data-ct-tab="hinh-phat"]');
    await page.fill('[data-r="giamNhe"]', '2');
    const range = page.locator('[data-out="range"]');
    await expect(range).toContainText('Khoảng tù hợp pháp: từ 2 năm đến 7 năm');
    await expect(range).toContainText('trong khung liền kề nhẹ hơn (khoản 1: từ 6 tháng đến 3 năm)');
    await expect(range.locator('.ct-law').first()).toContainText('khoản 2 Điều 174 BLHS');
    await page.fill('[data-r="tuoi"]', '15');
    await expect(range).toContainText('mức cao nhất không quá 3 năm 6 tháng tù');
    // Tổng hợp: 8 năm + 3 năm tù + 1 năm cải tạo không giam giữ.
    await page.locator('[data-th="0"] [data-thf="nam"]').fill('8');
    await page.locator('[data-th="1"] [data-thf="nam"]').fill('3');
    await page.click('[data-th-add]');
    await page.locator('[data-th="2"] [data-thf="loai"]').selectOption('cai-tao');
    await page.locator('[data-th="2"] [data-thf="nam"]').fill('1');
    await expect(page.locator('[data-out="th"]')).toContainText('Hình phạt chung: 11 năm 4 tháng tù');
    await expect(page.locator('[data-out="th"]')).toContainText('chuyển thành 4 tháng tù');
    // Chấp hành: 2 năm tù từ 01/09/2026, đã tạm giam 01/03–30/04/2026.
    await page.locator('[data-chd="nam"]').fill('2');
    await page.fill('[data-ch="batDau"]', '2026-09-01');
    await page.locator('[data-g="0"] [data-gf="tu"]').fill('2026-03-01');
    await page.locator('[data-g="0"] [data-gf="den"]').fill('2026-04-30');
    await expect(page.locator('[data-out="ch"]')).toContainText('Đã tạm giữ, tạm giam 61 ngày');
    await expect(page.locator('[data-ch-end]')).toContainText('hết ngày 29/06/2028');
    // Lưu trong hồ sơ.
    await page.reload();
    await expect(page.locator('[data-out="th"]')).toContainText('Hình phạt chung: 11 năm 4 tháng tù');
    t.assertClean();
  });

  test('biểu mẫu: mẫu soạn sẵn tự điền, xem trước, xuất Word; tải mẫu Word của đơn vị lên thay; vụ án phúc thẩm', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#dashboard');
    await page.goto('/app.html#toa-an');
    await page.click('[data-new="so-tham"]');
    await page.click('[data-ct-save]'); // hồ sơ mới là bản nháp — lưu vào sổ
    await page.fill('[data-v="toa.ten"]', 'Tòa án nhân dân khu vực 3 - Ninh Bình');
    await page.fill('[data-v="thuLy.so"]', '120/2026/TLST-HS');
    await page.fill('[data-v="hdxx.chuToa"]', 'Phạm Văn Hùng');
    await page.click('[data-ct-tab="tai-lieu"]');
    await page.fill('[data-ct-paste]', CAO_TRANG);
    await page.click('[data-ct-indict]');
    await page.click('[data-ct-tab="bieu-mau"]');
    await expect(page.locator('.cf-list')).toContainText('Quyết định đưa vụ án ra xét xử');
    await expect(page.locator('.cf-list')).not.toContainText('Bản án hình sự phúc thẩm');
    await page.click('[data-cf-pick="so-qd-xet-xu"]');
    await expect(page.locator('[data-cf="soThuLy"]')).toHaveValue('120/2026/TLST-HS');
    await expect(page.locator('[data-cf="biCaoChiTiet"]')).toHaveValue(/Nguyễn Văn An; sinh năm 1985/);
    await page.fill('[data-cf="diaDiemXetXu"]', 'Trụ sở Tòa án nhân dân khu vực 3');
    await page.click('[data-cf-preview]');
    const modal = page.locator('.preview-modal');
    await expect(modal).toContainText('ĐƯA VỤ ÁN RA XÉT XỬ');
    await expect(modal).toContainText('Bị cáo bị Viện kiểm sát nhân dân khu vực 3 truy tố về tội “Lừa đảo chiếm đoạt tài sản”');
    await expect(modal).toContainText('Địa điểm mở phiên tòa: Trụ sở Tòa án nhân dân khu vực 3.');
    await modal.locator('.modal-actions [data-close]').click();
    let [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-cf-export]')]);
    expect(dl.suggestedFilename()).toMatch(/\.docx$/);
    // Mẫu Word của đơn vị có ô {{Bị cáo}}, {{Số thụ lý}}.
    const word = Buffer.from(textToDocx('TÒA ÁN NHÂN DÂN KHU VỰC 3\nQUYẾT ĐỊNH ĐƯA VỤ ÁN RA XÉT XỬ (MẪU ĐƠN VỊ)\nThụ lý số: {{Số thụ lý}}\nĐưa ra xét xử bị cáo {{Bị cáo}} về tội {{Tội danh}}.'));
    await page.locator('[data-cf-upload]').setInputFiles({ name: 'qd-xet-xu-don-vi.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: word });
    await expect(page.locator('.toast').last()).toContainText('Đã lưu mẫu Word “qd-xet-xu-don-vi.docx”');
    await expect(page.locator('[data-cf-pick="so-qd-xet-xu"] .badge')).toHaveText('Mẫu đơn vị');
    await expect(page.locator('.cf-head')).toContainText('mẫu Word của đơn vị');
    await page.click('[data-cf-preview]');
    await expect(modal).toContainText('MẪU ĐƠN VỊ');
    await expect(modal).toContainText('Thụ lý số: 120/2026/TLST-HS');
    await expect(modal).toContainText('Đưa ra xét xử bị cáo Nguyễn Văn An về tội Lừa đảo chiếm đoạt tài sản.');
    await modal.locator('.modal-actions [data-close]').click();
    [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-cf-export]')]);
    expect(dl.suggestedFilename()).toMatch(/\.docx$/);
    const filled = await docxToText(new Uint8Array(fs.readFileSync(await dl.path())));
    expect(filled).toContain('Thụ lý số: 120/2026/TLST-HS');
    expect(filled).toContain('Đưa ra xét xử bị cáo Nguyễn Văn An về tội Lừa đảo chiếm đoạt tài sản.');
    // Thư viện biểu mẫu: thấy mẫu đơn vị, gỡ được; danh sách ô điền.
    await page.goto('/app.html#toa-an/bieu-mau');
    await expect(page.locator('[data-row="so-qd-xet-xu"]')).toContainText('qd-xet-xu-don-vi.docx');
    await expect(page.locator('.cf-tags')).toContainText('{{Nhân thân bị cáo}}');
    await page.click('[data-rm="so-qd-xet-xu"]');
    await expect(page.locator('[data-row="so-qd-xet-xu"]')).toContainText('Mẫu soạn sẵn');
    // Vụ án phúc thẩm: bản án sơ thẩm, kháng cáo, hạn xét xử phúc thẩm, biểu mẫu phúc thẩm.
    await page.goto('/app.html#toa-an');
    await page.click('[data-new="phuc-tham"]');
    await page.click('[data-ct-save]'); // hồ sơ mới là bản nháp — lưu vào sổ
    await expect(page.locator('[data-ct-cap]')).toHaveText('Phúc thẩm');
    await page.fill('[data-v="banAn.so"]', '25/2026/HS-ST');
    await page.fill('[data-v="moc.ngayNhanHoSo"]', isoIn(-10));
    await expect(page.locator('[data-dl="phuc-tham"]')).toContainText('Mở phiên tòa phúc thẩm');
    await page.click('[data-ct-tab="bieu-mau"]');
    await expect(page.locator('.cf-list')).toContainText('Bản án hình sự phúc thẩm');
    await expect(page.locator('.cf-list')).not.toContainText('Bản án hình sự sơ thẩm');
    await page.click('[data-cf-pick="pt-qd-xet-xu"]');
    await expect(page.locator('[data-cf="banAnSo"]')).toHaveValue('25/2026/HS-ST');
    t.assertClean();
  });
});
