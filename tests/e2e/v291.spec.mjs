import { test, expect } from '@playwright/test';
import { freshApp } from './helpers.mjs';

test('thông báo cập nhật: “Để sau” không nhắc lại bản đó khi tải lại trang; bản mới hơn nữa vẫn báo', async ({ page }) => {
  let latest = '99.0.0';
  await page.route('**/version.json*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: latest, notes: ['Bản thử nghiệm'] }) }));
  await freshApp(page, '#dashboard');
  const banner = page.locator('.update-banner');
  await expect(banner).toContainText('v99.0.0');
  await banner.locator('[data-dismiss]').click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await page.waitForSelector('.shell:not([hidden])');
  await page.waitForTimeout(800);
  await expect(banner).toHaveCount(0);
  latest = '99.1.0';
  await page.reload();
  await expect(banner).toContainText('v99.1.0');
});

test('không báo cập nhật khi đang dùng bản mới nhất', async ({ page }) => {
  await freshApp(page, '#dashboard');
  await page.waitForTimeout(800);
  await expect(page.locator('.update-banner')).toHaveCount(0);
});
