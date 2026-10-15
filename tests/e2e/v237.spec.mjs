import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

// Sách mẫu tự tạo theo cấu trúc sách Bình luận (≥ 50 điều), dạng .txt.
const BOOK = [
  'BÌNH LUẬN KHOA HỌC',
  'BỘ LUẬT HÌNH SỰ MẪU',
  'PHẦN THỨ HAI',
  'CÁC TỘI PHẠM',
  'CHƯƠNG XVI',
  'CÁC TỘI XÂM PHẠM SỞ HỮU',
  ...Array.from({ length: 55 }, (_, i) => {
    const so = 168 + i;
    if (so === 173) return 'Điều 173. Tội trộm cắp tài sản\n1. Người nào trộm cắp tài sản của người khác trị giá từ 2.000.000 đồng, thì bị phạt tù từ 06 tháng đến 03 năm.\na) Đã bị xử phạt vi phạm hành chính;\nBình luận\nKhách thể của tội phạm là quyền sở hữu tài sản.\n- Mặt khách quan: hành vi lén lút chiếm đoạt tài sản (xem Bình luận Điều 174).';
    return `Điều ${so}. Tội mẫu số ${so}\nNội dung điều luật mẫu ${so}.\nBình luận\nBình luận mẫu của điều ${so}.`;
  }),
].join('\n');

async function importBook(page) {
  await page.goto('/app.html#binh-luan');
  await expect(page.locator('.bl-empty')).toContainText('Chưa nạp sách Bình luận');
  await page.locator('[data-bl-file]').setInputFiles({ name: 'binh-luan-mau.txt', mimeType: 'text/plain', buffer: Buffer.from(BOOK) });
  await expect(page.locator('.toast').last()).toContainText('Đã nạp 55 điều');
  await expect(page.locator('.toast').last()).toContainText('đối chiếu khớp');
}

test.describe('v2.37 — Bình luận khoa học Bộ luật Hình sự', () => {
  test('nạp sách → mục lục, đọc từng điều (nguyên văn + bình luận), cỡ chữ, tìm kiếm, điều trước / sau', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#dashboard');
    await importBook(page);
    await page.goto('/app.html#binh-luan/173');
    await expect(page.locator('.bl-title')).toHaveText('Điều 173. Tội trộm cắp tài sản');
    await expect(page.locator('.bl-crumbs')).toContainText('Chương XVI CÁC TỘI XÂM PHẠM SỞ HỮU');
    await expect(page.locator('.bl-vb')).toContainText('1. Người nào trộm cắp tài sản của người khác trị giá từ 2.000.000 đồng');
    await expect(page.locator('.bl-vb p.d')).toHaveText('a) Đã bị xử phạt vi phạm hành chính;');
    await expect(page.locator('.bl-bl')).toContainText('Khách thể của tội phạm là quyền sở hữu tài sản.');
    await expect(page.locator('.bl-toc [aria-current="true"]')).toContainText('Điều 173.');
    // Liên kết "Điều 174" trong bình luận → sang điều 174.
    await page.locator('.bl-bl .law-link', { hasText: 'Điều 174' }).click();
    await expect(page).toHaveURL(/#binh-luan\/174$/);
    await page.click('[data-bl-prev] >> nth=0');
    await expect(page.locator('.bl-title')).toContainText('Điều 173.');
    // Cỡ chữ.
    await page.click('[data-bl-size="1"]');
    await expect(page.locator('[data-bl-size-v]')).toHaveText('20');
    // Tìm không dấu.
    await page.fill('[data-bl-q]', 'quyen so huu');
    await expect(page.locator('.bl-results h2')).toContainText('1 điều');
    await page.click('.bl-results a');
    await expect(page.locator('.bl-article mark').first()).toHaveText('quyền sở hữu');
    // Lọc mục lục.
    await page.fill('[data-bl-filter]', 'trom cap');
    await expect(page.locator('.bl-toc li:not([hidden])')).toHaveCount(1);
    // Tải lại: sách vẫn còn trên máy.
    await page.reload();
    await expect(page.locator('.bl-title')).toContainText('Điều 173.');
    t.assertClean();
  });

  test('bấm “Điều N” ở màn hình khác → hộp đọc bình luận; nút Bình luận ở trang tội danh', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#dashboard');
    // Chưa nạp sách: nút Bình luận hướng dẫn nạp.
    await page.goto('/app.html#legal/173');
    await page.click('.lg-crime-ch [data-bl-dieu="173"]');
    await expect(page.locator('.modal')).toContainText('Chưa nạp sách Bình luận');
    await page.click('.modal [data-bl-open]');
    await expect(page).toHaveURL(/#binh-luan$/);
    await page.locator('[data-bl-file]').setInputFiles({ name: 'binh-luan-mau.txt', mimeType: 'text/plain', buffer: Buffer.from(BOOK) });
    await expect(page.locator('.bl-title')).toBeVisible();
    // Trang tội danh: "Điều 173" ở đường dẫn tự thành liên kết.
    await page.goto('/app.html#legal/173');
    const link = page.locator('.lg-crumbs .law-link');
    await expect(link).toHaveText('Điều 173');
    await link.click();
    await expect(page.locator('.bl-modal .bl-title')).toHaveText('Điều 173. Tội trộm cắp tài sản');
    // Trong hộp: bấm Điều 174 → chuyển ngay trong hộp; sang điều trước.
    await page.locator('.bl-modal .law-link', { hasText: 'Điều 174' }).click();
    await expect(page.locator('.bl-modal .bl-title')).toContainText('Điều 174.');
    await page.click('.bl-modal [data-bl-go="173"]');
    await expect(page.locator('.bl-modal .bl-title')).toContainText('Điều 173.');
    await page.click('.bl-modal [data-bl-open]');
    await expect(page).toHaveURL(/#binh-luan\/173$/);
    await expect(page.locator('.modal')).toHaveCount(0);
    // Ô số điều ở đầu trang tội danh cũng mở được bình luận.
    await page.goto('/app.html#legal/173');
    await page.click('.lg-crime-art');
    await expect(page.locator('.bl-modal .bl-title')).toContainText('Điều 173.');
    t.assertClean();
  });

  test('tệp không phải sách Bình luận → báo rõ, không lưu', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#binh-luan');
    await page.locator('[data-bl-file]').setInputFiles({ name: 'van-ban.txt', mimeType: 'text/plain', buffer: Buffer.from('Công văn số 12\nĐiều 1. Phạm vi\nNội dung.') });
    await expect(page.locator('.toast.error').last()).toContainText('Không nhận ra cấu trúc sách Bình luận');
    await expect(page.locator('.bl-empty')).toBeVisible();
    t.assertClean();
  });
});
