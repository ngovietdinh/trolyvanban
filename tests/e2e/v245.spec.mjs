import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

test.describe('v2.45 — Giám đốc thẩm, danh mục án lệ, tải bản án từ mạng', () => {
  test('vụ án giám đốc thẩm: thụ lý, bản án bị kháng nghị, kháng nghị, Hội đồng, thời hạn, biểu mẫu riêng', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#toa-an', { agency: 'toa-an' });
    await page.click('[data-new="giam-doc-tham"]');
    await page.click('[data-ct-save]'); // hồ sơ mới là bản nháp — lưu vào sổ
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

  test('án lệ: 90 án lệ kèm toàn văn, lọc hình sự, tìm theo điều luật, xem, nạp tất cả vào kho, gợi ý khi thẩm tra', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#toa-an/an-le', { agency: 'toa-an' });
    await expect(page.locator('.al-table tbody tr')).toHaveCount(90);
    await expect(page.locator('.page-sub')).toContainText('90 án lệ có toàn văn kèm phần mềm');
    await expect(page.locator('[data-al-count]')).toContainText('90/90 án lệ · 0 đã nạp vào kho');
    await expect(page.locator('[data-al-row="47/2021/AL"]')).toContainText('Kèm phần mềm');
    await page.selectOption('[data-al-lv]', 'hs');
    await expect(page.locator('.al-table tbody tr')).toHaveCount(21);
    await expect(page).toHaveURL(/#toa-an\/an-le\/hs$/);
    await page.fill('[data-al-q]', '174');
    await expect(page.locator('.al-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.al-table tbody tr').first()).toContainText('75/2025/AL');
    await page.fill('[data-al-q]', 'hung khi nguy hiem');
    await expect(page.locator('[data-al-row="47/2021/AL"]')).toBeVisible();
    await page.fill('[data-al-q]', '');
    // Hộp xem: tình huống, giải pháp, quy định, toàn văn.
    await page.locator('[data-al-view="47/2021/AL"]').click();
    await expect(page.locator('.modal .al-view')).toContainText('Tình huống án lệ');
    await expect(page.locator('.modal .al-view')).toContainText('hung khí nguy hiểm');
    await expect(page.locator('.modal .al-view')).toContainText('Giải pháp pháp lý');
    await expect(page.locator('.modal .al-meta')).toContainText('594/QĐ-CA');
    await page.locator('.modal [data-close]').last().click();
    // Nạp một án lệ, rồi nạp tất cả.
    await page.locator('[data-al-add="47/2021/AL"]').click();
    await expect(page.locator('[data-al-row="47/2021/AL"]')).toContainText('Trong kho');
    await page.selectOption('[data-al-lv]', '');
    await page.locator('[data-al-add-all]').click();
    await expect(page.locator('.toast').last()).toContainText('Đã nạp 89 án lệ');
    await expect(page.locator('[data-al-count]')).toContainText('90 đã nạp vào kho');
    await page.check('[data-al-thieu]');
    await expect(page.locator('.al-table tbody tr')).toHaveCount(0);
    // Kho ghi nhận; trang kho có khối tìm trên mạng.
    await page.goto('/app.html#toa-an/kho-ban-an');
    await expect(page.locator('[data-kho-count]')).toContainText('90 án lệ');
    await expect(page.locator('[data-kho-net]')).toBeVisible();
    // Vụ án Điều 123: án lệ trong kho hiện với khái quát nội dung.
    await page.goto('/app.html#toa-an');
    await page.click('[data-new="so-tham"]');
    await page.click('[data-ct-save]'); // hồ sơ mới là bản nháp — lưu vào sổ
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
    await expect(page.locator('.tt-wrap')).toContainText('Án lệ 59/2023/AL');
    await expect(page.locator('.tt-wrap')).toContainText('Giải pháp pháp lý');
    t.assertClean();
  });

  test('án lệ → Word đúng cấu trúc (một án lệ, danh sách đang lọc)', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#toa-an/an-le/hs', { agency: 'toa-an' });
    await expect(page.locator('.al-table tbody tr')).toHaveCount(21);
    const dl1 = page.waitForEvent('download');
    await page.locator('[data-al-word="47/2021/AL"]').click();
    const d1 = await dl1;
    expect(d1.suggestedFilename()).toBe('an-le-47-2021-al.docx');
    await expect(page.locator('.toast').last()).toContainText('đúng cấu trúc');
    await page.fill('[data-al-q]', 'giet nguoi');
    // Tìm cả trong từ khóa / tình huống nên số dòng phụ thuộc gói dữ liệu: chỉ cần ít hơn 21 và tên tệp khớp số dòng.
    await expect.poll(() => page.locator('.al-table tbody tr').count()).toBeLessThan(21);
    const n = await page.locator('.al-table tbody tr').count();
    expect(n).toBeGreaterThan(1);
    const dl2 = page.waitForEvent('download');
    await page.locator('[data-al-word-all]').click();
    const d2 = await dl2;
    expect(d2.suggestedFilename()).toBe(`tuyen-tap-${n}-an-le.docx`);
    // Từ hộp xem (xóa bộ lọc để thấy lại 75/2025/AL).
    await page.fill('[data-al-q]', '');
    await expect(page.locator('.al-table tbody tr')).toHaveCount(21);
    await page.locator('[data-al-view="75/2025/AL"]').click();
    const dl3 = page.waitForEvent('download');
    await page.locator('.modal [data-al-word="75/2025/AL"]').click();
    expect((await dl3).suggestedFilename()).toBe('an-le-75-2025-al.docx');
    t.assertClean();
  });

  test('gợi ý án lệ theo nội dung tài liệu vụ án (từ khóa, tình huống), nạp vào kho ngay tại tab, AI nhận khối án lệ', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#toa-an', { agency: 'toa-an' });
    await page.click('[data-new="so-tham"]');
    await page.click('[data-ct-save]'); // hồ sơ mới là bản nháp — lưu vào sổ
    await page.evaluate(async () => {
      const { courtRepo } = await import('/assets/js/legal/repo.js');
      const r = courtRepo.list()[0];
      r.defendants[0].hoTen = 'Nguyễn Văn A';
      r.defendants[0].toiDanh = [{ dieu: '134', khoan: 1 }];
      r.sources = [{ id: 's1', name: 'Cáo trạng số 12', loai: 'cao-trang', text: 'Khoảng 20 giờ, bị cáo dùng dao là hung khí nguy hiểm đâm vào vùng bụng của bị hại là vùng trọng yếu của cơ thể con người. Bị hại không chết là ngoài ý muốn chủ quan của bị cáo.', butLuc: 1 }];
      courtRepo.save(r);
    });
    await page.reload();
    await page.locator('[data-ct-tab="tuong-tu"]').click();
    const box = page.locator('.tt-wrap');
    await expect(box).toContainText('Án lệ gợi ý theo nội dung vụ án');
    await expect(box).toContainText('Án lệ 47/2021/AL');
    await expect(box).toContainText('Khớp từ khóa: “Hung khí nguy hiểm”');
    await expect(box).toContainText('Giải pháp pháp lý: Trường hợp này, Tòa án phải xác định bị cáo chịu trách nhiệm hình sự về tội “Giết người”');
    await page.locator('[data-al-kho="47/2021/AL"]').click();
    await expect(page.locator('.toast').last()).toContainText('Đã nạp án lệ 47/2021/AL');
    await expect(box).toContainText('Trong kho');
    // Khối án lệ trong lời nhắc AI.
    const prompt = await page.evaluate(async () => {
      const { thamTraAiPrompt } = await import('/assets/js/views/toa-an-tham-tra.js');
      const { loadAnLeData } = await import('/assets/js/legal/an-le-data.js');
      const { courtRepo } = await import('/assets/js/legal/repo.js');
      return thamTraAiPrompt({ rec: courtRepo.list()[0], book: null, laws: [], docs: [], anLe: await loadAnLeData() }).content;
    });
    expect(prompt).toContain('ÁN LỆ CÓ THỂ LIÊN QUAN');
    expect(prompt).toContain('Án lệ 47/2021/AL');
    t.assertClean();
  });

  test('án lệ chưa nạp: tab Bản án tương tự vẫn gợi ý tình huống, giải pháp từ gói kèm phần mềm', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#toa-an', { agency: 'toa-an' });
    await page.click('[data-new="so-tham"]');
    await page.click('[data-ct-save]'); // hồ sơ mới là bản nháp — lưu vào sổ
    await page.evaluate(async () => {
      const { courtRepo } = await import('/assets/js/legal/repo.js');
      const r = courtRepo.list()[0];
      r.defendants[0].hoTen = 'Trần B';
      r.defendants[0].toiDanh = [{ dieu: '173', khoan: 1 }];
      courtRepo.save(r);
    });
    await page.reload();
    await page.locator('[data-ct-tab="tuong-tu"]').click();
    await expect(page.locator('.tt-wrap')).toContainText('chưa nạp vào kho');
    await expect(page.locator('.tt-wrap')).toContainText('75/2025/AL');
    await expect(page.locator('.tt-wrap')).toContainText('Tình huống:');
    await expect(page.locator('.tt-wrap')).toContainText('Trộm cắp tài sản');
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
