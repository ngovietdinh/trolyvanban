import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

test.describe('v2.45 — Giám đốc thẩm, danh mục án lệ, tải bản án từ mạng', () => {
  test('vụ án giám đốc thẩm: thụ lý, bản án bị kháng nghị, kháng nghị, Hội đồng, thời hạn, biểu mẫu riêng', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#toa-an', { agency: 'toa-an' });
    await page.click('[data-new="giam-doc-tham"]');
    await expect(page).toHaveURL(/#toa-an\/.+\/vu-an$/);
    await expect(page.locator('[data-v="cap"]')).toHaveValue('giam-doc-tham');
    await expect(page.locator('[data-v="thuLy.so"]')).toHaveAttribute('placeholder', /TLGĐT/);
    // Chưa có ngày hiệu lực → báo thiếu.
    await expect(page.locator('[data-dl="kn-gdt-bat-loi"]')).toContainText('Thiếu dữ liệu');
    await page.fill('[data-v="banAn.ngayHieuLuc"]', '2026-03-02');
    await page.selectOption('[data-v="banAn.cap"]', 'phuc-tham');
    await page.fill('[data-v="banAn.so"]', '12/2026/HS-PT');
    await page.selectOption('[data-v="khangNghi.nguoi"]', 'ca-tinh');
    await page.check('[data-v="khangNghi.cc3"]');
    await page.selectOption('[data-v="hdxx.hoiDong"]', 'ubtp-3');
    await page.fill('[data-v="moc.ngayNhanKhangNghi"]', '2026-09-01');
    await expect(page.locator('[data-dl="kn-gdt-bat-loi"]')).toContainText('02/03/2027');
    await expect(page.locator('[data-dl="phien-toa-gdt"]')).toContainText('01/01/2027');
    await expect(page.locator('[data-dl="kn-gdt-bat-loi"] small').first()).toContainText('Điều 379');
    // Quyết định hủy để xét xử lại → thêm hạn chuyển hồ sơ.
    await page.fill('[data-v="moc.ngayTuyenAn"]', '2026-10-20');
    await page.selectOption('[data-v="gdt.ketQua"]', 'huy-xet-xu');
    await expect(page.locator('[data-dl="chuyen-ho-so-lai"]')).toBeVisible();
    await expect(page.locator('[data-v="moc.ngayChuyenHoSoLai"]')).toBeVisible();
    // Danh sách sổ vụ án ghi cấp.
    await page.goto('/app.html#toa-an');
    await expect(page.locator('.ct-list tbody tr').first()).toContainText('Giám đốc thẩm');
    // Tab Biểu mẫu: chỉ mẫu giám đốc thẩm + sau xét xử.
    const href = await page.locator('.ct-list tbody tr a').first().getAttribute('href');
    await page.goto(`/app.html${href}/bieu-mau`);
    await expect(page.locator('.cf-group h4').first()).toContainText('Giám đốc thẩm');
    await page.locator('[data-cf-pick="gdt-quyet-dinh"]').click();
    await expect(page.locator('.cf-head h3')).toContainText('Quyết định giám đốc thẩm');
    await expect(page.locator('[data-cf="ketQuaGdt"]')).toHaveValue(/xét xử lại/);
    t.assertClean();
  });

  test('danh mục án lệ: 90 án lệ, lọc hình sự, tìm theo điều luật, nạp toàn văn vào kho, gợi ý khi thẩm tra', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#toa-an/an-le', { agency: 'toa-an' });
    await expect(page.locator('.al-table tbody tr')).toHaveCount(90);
    await expect(page.locator('[data-al-count]')).toContainText('90/90 án lệ · 0 có toàn văn');
    await page.selectOption('[data-al-lv]', 'hs');
    await expect(page.locator('.al-table tbody tr')).toHaveCount(21);
    await expect(page).toHaveURL(/#toa-an\/an-le\/hs$/);
    await page.fill('[data-al-q]', '174');
    await expect(page.locator('.al-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.al-table tbody tr').first()).toContainText('75/2025/AL');
    await page.fill('[data-al-q]', 'giet nguoi');
    await expect(page.locator('.al-table tbody tr')).toHaveCount(6);
    await page.fill('[data-al-q]', '');
    // Nạp toàn văn bằng cách dán.
    await page.locator('[data-al-add="47/2021/AL"]').click();
    await page.fill('[data-al-paste]', 'ÁN LỆ SỐ 47/2021/AL\nVề việc xác định tội danh trong trường hợp bị cáo dùng hung khí nguy hiểm đâm vào vùng trọng yếu của cơ thể bị hại\nKhái quát nội dung của án lệ:\nBị cáo dùng dao đâm vào vùng bụng bị hại thì phải chịu trách nhiệm về tội giết người.\n\nGiải pháp pháp lý:\nTrường hợp này, Tòa án phải xác định bị cáo phạm tội giết người.\n\nQuy định của pháp luật liên quan đến án lệ:\nĐiều 123 Bộ luật Hình sự năm 2015.\n');
    await page.locator('[data-al-save]').click();
    await expect(page.locator('.toast').last()).toContainText('Đã nạp toàn văn 47/2021/AL');
    await expect(page.locator('[data-al-row="47/2021/AL"]')).toContainText('Có trong kho');
    await expect(page.locator('[data-al-count]')).toContainText('1 có toàn văn');
    await page.check('[data-al-thieu]');
    await expect(page.locator('.al-table tbody tr')).toHaveCount(20);
    // Kho ghi nhận án lệ; trang kho có khối tìm trên mạng.
    await page.goto('/app.html#toa-an/kho-ban-an');
    await expect(page.locator('[data-kho-count]')).toContainText('1 án lệ');
    await expect(page.locator('[data-kho-net]')).toBeVisible();
    // Tab Bản án tương tự của vụ án Điều 123: án lệ trong kho hiện, án lệ chưa có toàn văn được gợi ý.
    await page.goto('/app.html#toa-an');
    await page.click('[data-new="so-tham"]');
    await page.evaluate(async () => {
      const { courtRepo } = await import('/assets/js/legal/repo.js');
      const r = courtRepo.list()[0];
      r.defendants[0].hoTen = 'Nguyễn Văn A';
      r.defendants[0].toiDanh = [{ dieu: '123', khoan: 1 }];
      courtRepo.save(r);
    });
    await page.reload();
    await page.locator('[data-ct-tab="tuong-tu"]').click();
    await expect(page.locator('.tt-wrap')).toContainText('Án lệ 47/2021/AL');
    await expect(page.locator('.tt-wrap')).toContainText('chưa có toàn văn trong kho');
    await expect(page.locator('.tt-wrap')).toContainText('59/2023/AL');
    t.assertClean();
  });

  test('kho: tải bản án từ đường dẫn (tệp văn bản cùng máy chủ) vào kho, đọc được số bản án và bị cáo', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#toa-an/kho-ban-an', { agency: 'toa-an' });
    await page.route('**/ban-an-mang/12-2026-HS-ST.txt', (route) => route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: 'TÒA ÁN NHÂN DÂN KHU VỰC 3 - NINH BÌNH\nBản án số: 12/2026/HS-ST\nNgày: 15/03/2026\nÁp dụng khoản 1 Điều 173 Bộ luật Hình sự. Xử phạt bị cáo Trần Văn B 09 (chín) tháng tù.' }));
    await page.fill('[data-kho-url]', `${new URL(page.url()).origin}/ban-an-mang/12-2026-HS-ST.txt`);
    await page.click('[data-kho-fetch]');
    await expect(page.locator('.toast').last()).toContainText('bản án 12/2026/HS-ST');
    await expect(page.locator('[data-kho-list]')).toContainText('12/2026/HS-ST');
    await expect(page.locator('[data-kho-list]')).toContainText('Trần Văn B');
    // Đường dẫn không hợp lệ → báo rõ.
    await page.fill('[data-kho-url]', 'ftp://x');
    await page.click('[data-kho-fetch]');
    await expect(page.locator('.toast').last()).toContainText('http://');
    t.assertClean();
  });
});
