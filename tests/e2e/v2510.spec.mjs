// v2.51: PDF sang Word nhiều tệp — chọn nhiều tệp, chuyển lần lượt, thanh tiến độ từng tệp, mỗi tệp ra một Word (tự tải về), gói .zip.
import { test, expect } from '@playwright/test';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { trackErrors, freshApp } from './helpers.mjs';

const dir = mkdtempSync(join(tmpdir(), 'p2w-batch-'));

test.describe('v2.51 — PDF sang Word nhiều tệp', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 794, height: 1123 } });
    const page = await ctx.newPage();
    await page.goto('http://localhost:4174/tests/fixtures/van-ban-mau.html');
    await page.waitForTimeout(400);
    const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true });
    writeFileSync(join(dir, 'ke-hoach-1.pdf'), pdf);
    writeFileSync(join(dir, 'ke-hoach-2.pdf'), pdf);
    writeFileSync(join(dir, 'hong.pdf'), Buffer.from('%PDF-1.4 hong'));
    await ctx.close();
  });

  test('chọn 3 tệp: danh sách, chuyển lần lượt có tiến độ từng tệp, tệp hỏng báo lỗi, 2 Word tự tải về, tải tất cả .zip', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#pdf');
    const downloads = [];
    page.on('download', (d) => downloads.push(d.suggestedFilename()));
    await page.locator('.pw [data-file]').setInputFiles([join(dir, 'ke-hoach-1.pdf'), join(dir, 'hong.pdf'), join(dir, 'ke-hoach-2.pdf')]);
    await expect(page.locator('.pw-files-head strong')).toHaveText('3 tệp');
    await expect(page.locator('.pw-batch-row')).toHaveCount(3);
    await expect(page.locator('[data-batch-head] strong')).toHaveText('3 tệp chờ chuyển');
    // Tệp hỏng báo lỗi ngay khi đọc, không chặn các tệp khác.
    await expect(page.locator('.pw-batch-row').nth(1).locator('.badge')).toHaveText('Lỗi', { timeout: 15000 });
    await expect(page.locator('[data-go]')).toBeEnabled();
    await page.locator('[data-go]').click();
    await expect(page.locator('[data-go-label]')).toHaveText('Dừng');
    // Hàng nào cũng có thanh tiến độ riêng; lần lượt chuyển sang Xong.
    await expect(page.locator('.pw-batch-row .bar[role="progressbar"]')).toHaveCount(3);
    await expect(page.locator('.pw-batch-row').nth(0).locator('.badge')).toHaveText('Xong', { timeout: 120000 });
    await expect(page.locator('.pw-batch-row').nth(2).locator('.badge')).toHaveText('Xong', { timeout: 120000 });
    await expect(page.locator('[data-go-label]')).toHaveText('Chuyển sang Word');
    await expect(page.locator('[data-batch-head] strong')).toHaveText('Đã chuyển 2/3 tệp · 1 lỗi');
    await expect(page.locator('.pw-batch-row').nth(0)).toContainText('100%');
    await expect(page.locator('[data-dl-row]')).toHaveCount(2);
    // Tự tải về từng tệp Word khi xong.
    await expect.poll(() => downloads.filter((n) => n.endsWith('.docx')).length).toBe(2);
    // Tải tất cả: một tệp .zip chứa 2 Word.
    const dl = page.waitForEvent('download');
    await page.locator('[data-zip]').click();
    const zip = await dl;
    expect(zip.suggestedFilename()).toBe('word-da-chuyen.zip');
    const { execFileSync } = await import('node:child_process');
    const names = execFileSync('python3', ['-c', 'import sys,zipfile;print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', await zip.path()]).toString().trim().split('\n');
    expect(names.length).toBe(2);
    expect(names.every((n) => n.endsWith('.docx'))).toBe(true);
    // Bỏ một tệp khỏi danh sách khi không chạy; còn một tệp → về luồng một tệp.
    await page.locator('[data-rm="1"]').click();
    await expect(page.locator('.pw-files-head strong')).toHaveText('2 tệp');
    await page.locator('[data-rm="1"]').click();
    await expect(page.locator('.pw-file')).toBeVisible();
    await expect(page.locator('.pw-files')).toHaveCount(0);
    t.assertClean();
  });

  test('tắt tự tải về: xong không tải, bấm Tải Word từng hàng', async ({ page }) => {
    await freshApp(page, '#pdf');
    const downloads = [];
    page.on('download', (d) => downloads.push(d.suggestedFilename()));
    await page.locator('.pw [data-file]').setInputFiles([join(dir, 'ke-hoach-1.pdf'), join(dir, 'ke-hoach-2.pdf')]);
    await page.locator('[data-auto-save]').uncheck();
    await page.locator('[data-go]').click();
    await expect(page.locator('.pw-batch-row .badge', { hasText: 'Xong' })).toHaveCount(2, { timeout: 120000 });
    expect(downloads.length).toBe(0);
    const dl = page.waitForEvent('download');
    await page.locator('[data-dl-row="1"]').click();
    expect((await dl).suggestedFilename()).toMatch(/\.docx$/);
    // Lựa chọn được ghi nhớ.
    await page.reload();
    await page.locator('.pw [data-file]').setInputFiles([join(dir, 'ke-hoach-1.pdf'), join(dir, 'ke-hoach-2.pdf')]);
    await expect(page.locator('[data-auto-save]')).not.toBeChecked();
  });
});
