import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

const BLHS = `Chương XXI
CÁC TỘI XÂM PHẠM AN TOÀN CÔNG CỘNG, TRẬT TỰ CÔNG CỘNG
Điều 264. Tội vi phạm quy định về duy tu, sửa chữa, quản lý công trình giao thông đường bộ
1. Người nào có trách nhiệm trong việc duy tu, sửa chữa, quản lý các công trình giao thông mà vi phạm quy định gây thiệt hại cho người khác, thì bị phạt tiền.
2. Phạm tội thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 03 năm đến 10 năm:
a) Làm chết người;
b) Gây thiệt hại về tài sản từ 500.000.000 đồng đến dưới 1.500.000.000 đồng.
${Array.from({ length: 25 }, (_, i) => `Điều ${123 + i}. Tội thử nghiệm số ${i}\n1. Người nào thực hiện hành vi thử, thì bị phạt tiền.`).join('\n')}
`;

async function makeRecords(page, names) {
  await page.goto('/app.html#interview');
  for (const n of names) {
    await page.goto('/app.html#interview');
    await page.locator('[data-new]').click();
    await expect(page).toHaveURL(/#interview\/.+/);
    const modal = page.locator('.modal', { hasText: 'Thông tin biên bản' });
    await expect(modal.locator('[name="nk_hoTen"]')).toBeVisible();
    await modal.locator('[name="nk_hoTen"]').fill(n);
    await modal.locator('button[type="submit"]').click();
    await expect(modal).toHaveCount(0);
    await expect(page.locator('[data-who]')).toHaveText(n);
  }
  await page.goto('/app.html#interview');
}

test.describe('Xóa lời khai', () => {
  test('xóa từng biên bản, chọn nhiều để xóa, hoàn tác', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page);
    await makeRecords(page, ['Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C']);
    await expect(page.locator('.doc-item')).toHaveCount(3);
    // Xóa một biên bản rồi hoàn tác
    await page.locator('.doc-item', { hasText: 'Nguyễn Văn A' }).locator('[data-del-rec]').click();
    await page.locator('.modal [data-yes]').click();
    await expect(page.locator('.doc-item')).toHaveCount(2);
    await page.locator('.toast-action', { hasText: 'Hoàn tác' }).click();
    await expect(page.locator('.doc-item')).toHaveCount(3);
    // Chọn nhiều
    await page.locator('.doc-item', { hasText: 'Trần Thị B' }).locator('[data-sel]').check();
    await page.locator('.doc-item', { hasText: 'Lê Văn C' }).locator('[data-sel]').check();
    await expect(page.locator('[data-sel-n]')).toHaveText('Đã chọn 2');
    await page.locator('[data-del-sel]').click();
    await expect(page.locator('.modal')).toContainText('2 biên bản lời khai');
    await page.locator('.modal [data-yes]').click();
    await expect(page.locator('.doc-item')).toHaveCount(1);
    await expect(page.locator('.doc-item')).toContainText('Nguyễn Văn A');
    // Chọn tất cả
    await page.locator('[data-sel-all]').check();
    await page.locator('[data-del-sel]').click();
    await page.locator('.modal [data-yes]').click();
    await expect(page.locator('.empty')).toContainText('Chưa có biên bản');
    t.assertClean();
  });

  test('xóa ngay trong màn hình ghi lời khai (không bị lưu lại sau khi xóa)', async ({ page }) => {
    await freshApp(page);
    await makeRecords(page, ['Phạm Văn D']);
    await page.locator('.doc-item a').click();
    await page.fill('[data-q]', 'Câu hỏi');
    await page.fill('[data-a]', 'Trả lời');
    await page.keyboard.press('Control+Enter');
    await page.locator('[data-del-this]').click();
    await page.locator('.modal [data-yes]').click();
    await expect(page).toHaveURL(/#interview$/);
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.locator('.doc-item')).toHaveCount(0);
  });
});

test.describe('Toàn bộ Bộ luật Hình sự trong cây hỏi đáp', () => {
  test('lĩnh vực mới: Ma túy → Điều 251, sinh vấn đề và câu hỏi; tìm kiếm điều ngoài 4 lĩnh vực cũ', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal');
    await expect(page.locator('.lg-blhs')).toContainText('tội danh trong cây');
    await page.locator('[data-toggle="ma-tuy"]').click();
    await page.locator('[data-toggle="ma-tuy/san-xuat-mua-ban"]').click();
    await page.locator('.lg-leaf[data-crime="251"]').click();
    await expect(page.locator('.lg-crime h1')).toHaveText('Tội mua bán trái phép chất ma túy');
    await expect(page.locator('.lg-crime')).toContainText('Theo mẫu chương');
    await expect(page.locator('[data-issue="hv-hv-chinh"]')).toContainText('Nguồn gốc chất ma túy');
    await page.fill('[data-q]', 'giet nguoi');
    await expect(page.locator('.lg-hits [data-crime="123"]')).toBeVisible();
    await page.fill('[data-q]', '330');
    await page.locator('.lg-hits [data-crime="330"]').click();
    await expect(page.locator('.lg-crime h1')).toHaveText('Tội chống người thi hành công vụ');
    t.assertClean();
  });

  test('cập nhật Bộ luật từ văn bản dán vào: điều chưa có tên hiện ra, nguyên văn, định khung theo khoản; gỡ quay lại', async ({ page }) => {
    await freshApp(page, '#legal');
    await page.locator('[data-blhs-update]').click();
    await page.locator('[data-blhs-text]').fill(BLHS);
    await page.locator('[data-blhs-parse]').click();
    await expect(page.locator('.lg-blhs-out')).toContainText('điều nhận diện');
    await page.locator('[data-blhs-apply]').click();
    await expect(page.locator('.lg-blhs .badge')).toHaveText('Đã nạp nguyên văn');
    await page.goto('/app.html#legal/264');
    await expect(page.locator('.lg-crime h1')).toHaveText('Tội vi phạm quy định về duy tu, sửa chữa, quản lý công trình giao thông đường bộ');
    await page.locator('.lg-nguyen-van summary').click();
    await expect(page.locator('.lg-nguyen-van')).toContainText('duy tu, sửa chữa');
    await expect(page.locator('[data-dk="Làm chết người (khoản 2)"]')).toBeVisible();
    // Giữ sau khi tải lại
    await page.reload();
    await expect(page.locator('.lg-crime h1')).toContainText('duy tu');
    await page.goto('/app.html#legal');
    await page.locator('[data-blhs-clear]').click();
    await page.locator('.modal [data-yes]').click();
    await expect(page.locator('.lg-blhs .badge')).toHaveText('Dữ liệu tích hợp');
  });
});
