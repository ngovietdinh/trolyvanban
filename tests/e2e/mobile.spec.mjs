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

  for (const view of ['dashboard', 'chat', 'spell', 'summary', 'templates', 'docs', 'settings']) {
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
