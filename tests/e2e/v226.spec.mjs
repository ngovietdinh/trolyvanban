import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

const TEXT = 'Ngày 05/3/2025 ông Nguyễn Văn An kế toán lập chứng từ chi khống để rút tiền chiếm đoạt 300 triệu đồng. Sau đó ông An chuyển cho ông Trần Văn Bình giám đốc 100 triệu đồng. Ông Bình chỉ đạo ông An lập hồ sơ quyết toán khống. Bà Lê Thị Cúc thủ quỹ nhận 20 triệu đồng của ông An.';

async function run(page) {
  await page.click('[data-src="files"]');
  await page.fill('[data-cm-text]', TEXT);
  await page.click('[data-cm-run]');
}

test.describe('v2.26 — sơ đồ hành vi, quan hệ, dòng tiền sửa được', () => {
  test('thêm người, nối quan hệ, sửa số tiền; mỗi sơ đồ lưu riêng; sơ đồ hành vi thêm nhánh', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#so-do');
    await run(page);
    const res = page.locator('[data-result]');
    // Dòng tiền: tổng nhận / đưa trên từng người, thêm người nhận mới bằng Tab, sửa số tiền.
    await page.click('[data-cm-tab="dong-tien"]');
    const dg = res.locator('[data-dg]');
    await expect(dg.locator('[data-dg-lmode]')).toHaveValue('dong');
    // Tổng tiền không ghi lên hình (không phải nguyên văn) — chỉ ở bảng, ghi rõ máy cộng.
    await expect(dg.locator('.dg-node', { hasText: 'Trần Văn Bình' })).not.toContainText('Nhận 100 triệu');
    await expect(res).toContainText('máy cộng');
    await dg.locator('.dg-node', { hasText: 'Trần Văn Bình' }).click();
    await page.keyboard.press('Tab');
    await page.locator('[data-dg-label]').fill('Hoàng Văn Em');
    await expect(dg.locator('.dg-node', { hasText: 'Hoàng Văn Em' })).toHaveClass(/dg-k-person/);
    const edge = dg.locator('.dg-edge.dg-e-tien').last();
    await edge.locator('.dg-hit').click({ force: true });
    await page.locator('[data-dg-elabel]').fill('30 triệu đồng');
    await page.locator('[data-dg-elabel]').blur();
    await expect(dg.locator('.dg-edge.dg-e-tien', { hasText: '30 triệu đồng' })).toHaveCount(1);
    // Quan hệ: sơ đồ riêng, không có người vừa thêm ở dòng tiền.
    await page.click('[data-cm-tab="quan-he"]');
    await expect(res.locator('[data-dg-lmode]')).toHaveValue('vong');
    await expect(res.locator('[data-dg] .dg-node', { hasText: 'Hoàng Văn Em' })).toHaveCount(0);
    await expect(res.locator('[data-dg] .dg-edge.dg-e-chi-dao')).toHaveCount(1);
    await expect(res.locator('.tk-table')).toContainText('Trần Văn Bình');
    // Sơ đồ hành vi: thêm nhánh qua gợi ý trên hình.
    await page.click('[data-cm-tab="cay"]');
    const act = res.locator('[data-dg] .dg-node.dg-k-act').first();
    await act.locator('[data-ideas]').click();
    await res.locator('[data-dg-pop] [data-idea]', { hasText: 'Thủ đoạn, cách thức' }).click();
    await expect(res.locator('[data-dg] .dg-node', { hasText: 'Thủ đoạn, cách thức' })).toHaveCount(1);
    // Mở lại: từng sơ đồ giữ phần đã sửa.
    await page.reload();
    await run(page);
    await page.click('[data-cm-tab="dong-tien"]');
    await expect(page.locator('[data-dg] .dg-node', { hasText: 'Hoàng Văn Em' })).toHaveCount(1);
    await expect(page.locator('[data-dg] .dg-edge', { hasText: '30 triệu đồng' })).toHaveCount(1);
    await page.click('[data-cm-tab="cay"]');
    await expect(page.locator('[data-dg] .dg-node', { hasText: 'Thủ đoạn, cách thức' })).toHaveCount(1);
    t.assertClean();
  });
});
