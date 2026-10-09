import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { trackErrors, freshApp, mockClaude, setApiKey } from './helpers.mjs';

const TEXT = 'Ngày 05/3/2025 ông Nguyễn Văn An, kế toán Ban QLDA huyện X lập chứng từ chi khống rút 300 triệu đồng. Sau đó ông An chuyển cho Giám đốc Trần Văn Bình 100 triệu đồng. Bà Lê Thị Cúc nhận 20 triệu đồng của ông An.';

async function run(page) {
  await page.click('[data-src="files"]');
  await page.fill('[data-cm-text]', TEXT);
  await page.click('[data-cm-run]');
}

test.describe('v2.27 — chức vụ, số tiền nguyên văn; lưu / mở lại', () => {
  test('chức vụ chỉ lấy nguyên văn, vai trò suy ra ghi riêng; AI bịa chức vụ / số tiền bị bỏ', async ({ page }) => {
    const t = trackErrors(page);
    await mockClaude(page, () => JSON.stringify({ tomTat: 'A', banChat: [], nguoi: [{ ten: 'Lê Thị Cúc', vaiTro: 'Thủ quỹ' }, { ten: 'Trần Văn Bình', vaiTro: 'Chủ tịch' }], hanhVi: [], quanHe: [{ tu: 'Nguyễn Văn An', den: 'Trần Văn Bình', loai: 'tien', noiDung: 'chuyển', soTien: '150 triệu đồng' }], moc: [] }));
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    await page.goto('/app.html#so-do');
    await page.click('[data-src="files"]');
    await page.fill('[data-cm-text]', TEXT);
    await page.check('[data-cm-ai]');
    await page.click('[data-cm-run]');
    await expect(page.locator('.toast', { hasText: 'không có nguyên văn' }).first()).toBeVisible();
    const res = page.locator('[data-result]');
    await expect(res).toContainText('AI kết hợp');
    const chips = res.locator('.cm-people');
    await expect(chips.locator('.cm-chip', { hasText: 'Trần Văn Bình' })).toContainText('Giám đốc');
    await expect(chips.locator('.cm-chip', { hasText: 'Trần Văn Bình' })).not.toContainText('Chủ tịch');
    await expect(chips.locator('.cm-chip', { hasText: 'Lê Thị Cúc' })).toContainText('chưa có chức vụ trong lời khai');
    await expect(chips.locator('.cm-chip', { hasText: 'Lê Thị Cúc' })).toContainText('theo quan hệ: người nhận tiền');
    await expect(chips.locator('.cm-chip', { hasText: 'Nguyễn Văn An' })).toContainText('Kế toán Ban QLDA huyện X');
    await page.click('[data-cm-tab="dong-tien"]');
    await expect(res.locator('[data-dg] .dg-edge', { hasText: '150 triệu' })).toHaveCount(0);
    await expect(res.locator('.tk-table').first()).not.toContainText('150 triệu');
    await expect(res).toContainText('máy cộng');
    t.assertClean();
  });

  test('lưu kết quả phân tích, mở lại không cần phân tích; lưu bản sơ đồ có tên, mở lại, tải ra / mở từ tệp', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#so-do');
    await run(page);
    await page.click('[data-cm-save]');
    await page.fill('.modal [name="ten"]', 'Vụ chi khống Ban QLDA');
    await page.click('.modal button[type="submit"]');
    // Sửa sơ đồ dòng tiền, lưu bản có tên.
    await page.click('[data-cm-tab="dong-tien"]');
    const dg = page.locator('[data-dg]');
    await dg.locator('.dg-node', { hasText: 'Trần Văn Bình' }).click();
    await page.keyboard.press('Tab');
    await page.locator('[data-dg-label]').fill('Người nhận cuối');
    await page.locator('[data-dg-label]').blur();
    await page.click('[data-dg-lib]');
    const lib = dg.locator('[data-dg-libp]');
    await lib.locator('[data-lib-save] input').fill('Phương án 1');
    await lib.locator('[data-lib-save] button').click();
    await expect(lib.locator('[data-lib-id]', { hasText: 'Phương án 1' })).toHaveCount(1);
    // Tải tệp sơ đồ.
    const [dl] = await Promise.all([page.waitForEvent('download'), lib.locator('[data-lib-export]').click()]);
    const file = await dl.path();
    expect(JSON.parse(readFileSync(file, 'utf8')).diagram.nodes.some((n) => n.label === 'Người nhận cuối')).toBe(true);
    // Xóa hình rồi mở lại bản đã lưu.
    await lib.locator('[data-lib-x]').click();
    await dg.locator('.dg-node', { hasText: 'Người nhận cuối' }).click();
    await page.keyboard.press('Delete');
    await expect(dg.locator('.dg-node', { hasText: 'Người nhận cuối' })).toHaveCount(0);
    await page.click('[data-dg-lib]');
    await lib.locator('[data-lib-id]', { hasText: 'Phương án 1' }).locator('[data-lib-open]').click();
    await expect(dg.locator('.dg-node', { hasText: 'Người nhận cuối' })).toHaveCount(1);
    // Mở từ tệp.
    await dg.locator('.dg-node', { hasText: 'Người nhận cuối' }).click();
    await page.keyboard.press('Delete');
    await page.click('[data-dg-lib]');
    await dg.locator('[data-dg-file]').setInputFiles(file);
    await expect(dg.locator('.dg-node', { hasText: 'Người nhận cuối' })).toHaveCount(1);
    // Mở lại trang: kết quả đã lưu mở ngay, không cần phân tích lại, sơ đồ đã sửa còn nguyên.
    await page.reload();
    const saved = page.locator('[data-cm-saved]');
    await saved.locator('summary').click();
    await saved.locator('[data-save-id]', { hasText: 'Vụ chi khống Ban QLDA' }).locator('[data-save-open]').click();
    await expect(page.locator('[data-result] h2')).toContainText('Vụ chi khống Ban QLDA');
    await page.click('[data-cm-tab="dong-tien"]');
    await expect(page.locator('[data-dg] .dg-node', { hasText: 'Người nhận cuối' })).toHaveCount(1);
    t.assertClean();
  });
});
