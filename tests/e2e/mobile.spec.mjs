import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe('Giao diện di động', () => {
  test('trang giới thiệu: menu di động và không tràn ngang', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto('/');
    expect(await noHorizontalScroll(page)).toBe(true);
    await expect(page.locator('.main-nav')).toBeHidden();
    await page.locator('[data-menu-toggle]').click();
    await expect(page.locator('#mobile-nav')).toBeVisible();
    await page.locator('#mobile-nav a', { hasText: 'Bảng giá' }).click();
    await expect(page.locator('#mobile-nav')).toBeHidden();
    // Cuộn hết trang để kích hoạt mọi hiệu ứng, kiểm tra lại tràn ngang.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(await noHorizontalScroll(page)).toBe(true);
    t.assertClean();
  });

  test('ứng dụng: mở/đóng thanh bên và điều hướng', async ({ page }) => {
    await freshApp(page);
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).not.toHaveClass(/open/);
    await page.locator('[data-sidebar-open]').click();
    await expect(sidebar).toHaveClass(/open/);
    await sidebar.locator('[data-nav="number"]').click();
    await expect(sidebar).not.toHaveClass(/open/);
    await expect(page.locator('[data-view-title]')).toHaveText('Số thành chữ');
    expect(await noHorizontalScroll(page)).toBe(true);
  });

  test('trình soạn thảo: chuyển giữa biểu mẫu và xem trước', async ({ page }) => {
    await freshApp(page, '#compose/cong-van');
    await expect(page.locator('.compose-form')).toBeVisible();
    await expect(page.locator('.compose-preview')).toBeHidden();
    await page.locator('[data-sample]').click();
    await page.locator('[data-pane-btn="preview"]').click();
    await expect(page.locator('.compose-preview')).toBeVisible();
    await expect(page.locator('.compose-form')).toBeHidden();
    const box = await page.locator('.vb-page').boundingBox();
    const vw = page.viewportSize().width;
    expect(box.width).toBeLessThanOrEqual(vw);
    // Xuất khi thiếu dữ liệu tự quay về biểu mẫu
    await page.locator('[data-pane-btn="form"]').click();
    await page.fill('[name="trichYeu"]', '');
    await page.locator('[data-pane-btn="preview"]').click();
    await page.locator('[data-export]').click();
    await expect(page.locator('.compose-form')).toBeVisible();
    await expect(page.locator('[name="trichYeu"]')).toBeFocused();
  });

  for (const view of ['dashboard', 'chat', 'spell', 'summary', 'templates', 'docs', 'settings', 'legal', 'legal/222', 'cases', 'interview', 'help', 'help/kho', 'help/interview', 'pdf', 'legal/vu-viec', 'theo-doi', 'so-do']) {
    test(`màn hình ${view} không tràn ngang`, async ({ page }) => {
      const t = trackErrors(page);
      await freshApp(page, `#${view}`);
      await page.waitForTimeout(200);
      expect(await noHorizontalScroll(page)).toBe(true);
      const viewScroll = await page.locator('#view').evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
      expect(viewScroll).toBe(true);
      t.assertClean();
    });
  }
});

test('ghi lời khai trên điện thoại: kế hoạch, ghi hỏi – đáp, không tràn ngang', async ({ page }) => {
  await freshApp(page, '#legal/354');
  await page.locator('[data-start]').click();
  await page.fill('#st-name', 'Lê Văn Cường');
  await page.locator('.modal button[type="submit"]').click();
  await expect(page).toHaveURL(/#interview\//);
  // Điện thoại: biên bản mở ở thẻ “Biên bản”; chuyển sang thẻ “Kế hoạch” để chọn câu hỏi, chọn xong tự quay lại.
  await page.locator('[data-mp-tab="plan"]').click();
  await page.locator('.iv-issue[open] [data-pq]').first().click();
  await expect(page.locator('[data-mp-tab="main"]')).toHaveAttribute('aria-selected', 'true');
  await page.fill('[data-a]', 'Tôi không nhận tiền của ai.');
  await page.locator('[data-submit]').click();
  await expect(page.locator('.iv-qa')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test.describe('Điều hướng và bố cục điện thoại', () => {
  test('thanh điều hướng dưới: đúng mục theo quyền, đánh dấu màn hình đang mở, nút Thêm mở menu', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#cases');
    const nav = page.locator('[data-bottom-nav]');
    await expect(nav).toBeVisible();
    await expect(nav.locator('[data-bn]')).toHaveText(['Tổng quan', 'Hồ sơ', 'Lời khai', 'Trợ lý hồ sơ']);
    await expect(nav.locator('[data-bn="cases"]')).toHaveAttribute('aria-current', 'page');
    await nav.locator('[data-bn="interview"]').click();
    await expect(page).toHaveURL(/#interview$/);
    await expect(nav.locator('[data-bn="interview"]')).toHaveAttribute('aria-current', 'page');
    await page.goto('/app.html#spell');
    await expect(nav.locator('[data-bn-more]')).toHaveAttribute('aria-current', 'page');
    await nav.locator('[data-bn-more]').click();
    await expect(page.locator('#sidebar')).toHaveClass(/open/);
    t.assertClean();
  });

  test('màn hình nhiều cột chia thẻ: cây hỏi đáp tự chuyển sang nội dung khi chọn tội danh', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal');
    const tabs = page.locator('.legal .pane-tabs');
    await expect(tabs).toBeVisible();
    await expect(page.locator('.lg-side')).toBeVisible();
    await expect(page.locator('.lg-main')).toBeHidden();
    await page.fill('.lg-side [data-q]', '353');
    await page.locator('[data-crime="353"]').click();
    await expect(page.locator('.lg-main')).toBeVisible();
    await expect(page.locator('.lg-side')).toBeHidden();
    await expect(tabs.locator('[data-mp-tab="main"]')).toContainText('Điều 353');
    // Kho hồ sơ: hai thẻ Tài liệu / Trợ lý.
    await page.goto('/app.html#kho');
    await page.locator('[data-mp-tab="ai"]').click();
    await expect(page.locator('.kho-ai [data-input]')).toBeVisible();
    await expect(page.locator('.kho-lib')).toBeHidden();
    t.assertClean();
  });

  test('hộp thoại hiện dạng tấm trượt từ dưới lên, nút thao tác vừa tay', async ({ page }) => {
    await freshApp(page, '#cases');
    await page.locator('[data-new]').first().click();
    await page.waitForTimeout(500); // chờ hiệu ứng trượt lên kết thúc
    const box = await page.locator('.modal').boundingBox();
    const vp = page.viewportSize();
    expect(Math.round(box.x)).toBe(0);
    expect(Math.round(box.width)).toBe(vp.width);
    expect(Math.abs(box.y + box.height - vp.height)).toBeLessThan(2);
    const btn = await page.locator('.modal .modal-actions .btn').first().boundingBox();
    expect(btn.height).toBeGreaterThanOrEqual(40);
  });
});
