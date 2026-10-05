import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.mjs';

test.describe('Trang giới thiệu', () => {
  test('hiển thị đầy đủ các phần, không lỗi JavaScript', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/Trợ Lý Văn Bản/);
    await expect(page.locator('h1')).toContainText('Văn bản hành chính chuẩn mực');
    for (const id of ['tinh-nang', 'quy-trinh', 'mau-van-ban', 'demo', 'bang-gia', 'hoi-dap', 'lien-he']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
    await expect(page.locator('[data-templates] .tpl')).toHaveCount(8);
    await expect(page.locator('.plan')).toHaveCount(3);
    // Phân hệ tố tụng không được giới thiệu công khai
    await expect(page.locator('#to-tung')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toMatch(/tố tụng|lời khai/i);
    // Phông chữ tiếng Việt đã được tải
    const fontOk = await page.evaluate(async () => {
      await document.fonts.ready;
      const loaded = await Promise.all([
        document.fonts.load('400 16px "Be Vietnam Pro"', 'Tiếng Việt'),
        document.fonts.load('500 40px Newsreader', 'Văn bản hành chính'),
        document.fonts.load('400 16px Tinos', 'Cộng hòa'),
      ]);
      return loaded.every((faces) => faces.length > 0 && faces.every((f) => f.status === 'loaded'));
    });
    expect(fontOk).toBe(true);
    t.assertClean();
  });

  test('chuyển giao diện tối và ghi nhớ lựa chọn', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-theme-toggle]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(10, 18, 31)');
  });

  test('công cụ đọc số tiền dùng thử', async ({ page }) => {
    await page.goto('/#demo');
    const input = page.locator('#demo-number-input');
    await input.fill('2.500.000');
    await expect(page.locator('[data-demo-words]')).toHaveText('Hai triệu năm trăm nghìn đồng chẵn.');
    await input.fill('abc');
    await expect(page.locator('[data-demo-words]')).toContainText('không hợp lệ');
  });

  test('công cụ chính tả dùng thử: phát hiện và sửa tất cả', async ({ page }) => {
    await page.goto('/#demo');
    await page.getByRole('tab', { name: 'Kiểm tra chính tả' }).click();
    await expect(page.locator('#demo-spell')).toBeVisible();
    await expect(page.locator('[data-spell-count]')).toContainText('Phát hiện');
    expect(await page.locator('[data-spell-marked] mark').count()).toBeGreaterThan(3);
    await page.locator('[data-spell-fix]').click();
    await expect(page.locator('[data-spell-count]')).toContainText('Không phát hiện lỗi');
    await expect(page.locator('#demo-spell-input')).toHaveValue(/xử lý hồ sơ, bổ sung tài liệu còn thiếu\. Kết quả gửi về trước ngày 05 tháng 02 năm 2026\./);
  });

  test('tab dùng thử điều khiển được bằng bàn phím', async ({ page }) => {
    await page.goto('/#demo');
    await page.getByRole('tab', { name: 'Đọc số tiền' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Kiểm tra chính tả' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Kiểm tra chính tả' })).toBeFocused();
  });

  test('bảng giá chuyển theo năm', async ({ page }) => {
    await page.goto('/#bang-gia');
    const price = page.locator('[data-price-month]');
    await expect(price).toHaveText('199.000đ');
    await page.locator('[data-billing="year"]').click();
    await expect(price).toHaveText('159.000đ');
    await expect(page.locator('[data-billing="year"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('biểu mẫu liên hệ kiểm tra dữ liệu và gửi thành công', async ({ page }) => {
    await page.goto('/#lien-he');
    const form = page.locator('[data-contact-form]');
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('.field.invalid')).toHaveCount(3);
    await expect(page.locator('#c-name')).toBeFocused();
    await page.fill('#c-name', 'Trần Thị Bình');
    await page.fill('#c-email', 'sai-email');
    await page.fill('#c-msg', 'Tư vấn triển khai cho phường');
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('.field.invalid')).toHaveCount(1);
    await page.fill('#c-email', 'binh@example.vn');
    await form.locator('button[type="submit"]').click();
    await expect(page.locator('.toast').last()).toContainText('Cảm ơn bạn');
    await expect(page.locator('#c-name')).toHaveValue('');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tlvb:contacts')));
    expect(saved).toHaveLength(1);
    expect(saved[0].email).toBe('binh@example.vn');
  });

  test('câu hỏi thường gặp mở/đóng', async ({ page }) => {
    await page.goto('/#hoi-dap');
    const second = page.locator('.faq details').nth(1);
    await expect(second).not.toHaveAttribute('open', '');
    await second.locator('summary').click();
    await expect(second).toHaveAttribute('open', '');
  });

  test('thẻ mẫu văn bản yêu cầu đăng nhập rồi mở đúng trình soạn thảo', async ({ page }) => {
    await page.goto('/#mau-van-ban');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.locator('.tpl', { hasText: 'Tờ trình' }).click();
    await expect(page).toHaveURL(/app\.html#compose\/to-trinh/);
    await expect(page.locator('.gate')).toBeVisible();
    await page.fill('#g-name', 'Quản trị');
    await page.fill('#g-email', 'gsnvbu@gmail.com');
    await page.fill('#g-pass', 'matkhau-toi-cao');
    await page.click('[data-gate-form] button[type="submit"]');
    await expect(page.locator('[data-type="to-trinh"]')).toHaveAttribute('aria-selected', 'true');
  });

});
