import { test, expect } from '@playwright/test';
import { trackErrors, freshApp, mockClaude, setApiKey } from './helpers.mjs';

const TEXT = 'Ngày 05/3/2025 ông Nguyễn Văn An kế toán lập chứng từ chi khống để rút tiền chiếm đoạt 300 triệu đồng. Sau đó ông An chuyển cho ông Trần Văn Bình giám đốc 100 triệu đồng. Ông Bình chỉ đạo ông An lập hồ sơ quyết toán khống. Bà Lê Thị Cúc thủ quỹ nhận 20 triệu đồng của ông An.';

async function openMindmap(page) {
  await page.goto('/app.html#so-do');
  await page.click('[data-src="files"]');
  await page.fill('[data-cm-text]', TEXT);
  await page.click('[data-cm-run]');
  await page.click('[data-cm-tab="ve"]');
  const dg = page.locator('[data-dg]');
  await expect(dg.locator('.dg-k-root')).toBeVisible();
  return dg;
}

test.describe('v2.25 — sơ đồ tư duy', () => {
  test('mindmap, gợi ý trên hình, thêm nhánh, thu gọn, cỡ chữ, kéo to nhỏ, đổi kiểu sơ đồ', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page);
    const dg = await openMindmap(page);
    await expect(dg.locator('[data-dg-lmode]')).toHaveValue('mindmap');
    await expect(dg.locator('.dg-branch').first()).toBeAttached();
    // Gợi ý ngay trên hình hành vi → thêm nhánh con.
    const act = dg.locator('.dg-node.dg-k-act').first();
    await act.locator('[data-ideas]').click();
    const pop = dg.locator('[data-dg-pop]');
    await expect(pop).toBeVisible();
    await expect(pop).toContainText('Thời gian, địa điểm');
    const n0 = await dg.locator('.dg-node').count();
    await pop.locator('[data-idea]', { hasText: 'Thời gian, địa điểm' }).click();
    await expect(dg.locator('.dg-node')).toHaveCount(n0 + 1);
    await expect(dg.locator('.dg-node', { hasText: 'Thời gian, địa điểm' })).toHaveCount(1);
    await expect(pop.locator('[data-idea]', { hasText: 'Thời gian, địa điểm' })).toHaveCount(0);
    // Tự thêm nhánh trong bảng gợi ý.
    await pop.locator('[data-pop-add] input').fill('Ai ký duyệt chứng từ');
    await pop.locator('[data-pop-add] input').press('Enter');
    await expect(dg.locator('.dg-node', { hasText: 'Ai ký duyệt chứng từ' })).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();
    // Thu gọn nhánh hành vi → ẩn các nhánh con; mở lại.
    await act.locator('[data-toggle]').click();
    await expect(dg.locator('.dg-node', { hasText: 'Thời gian, địa điểm' })).toHaveCount(0);
    await expect(dg.locator('[data-dg-stat]')).toContainText('đang thu gọn');
    await act.locator('[data-toggle]').click();
    await expect(dg.locator('.dg-node', { hasText: 'Thời gian, địa điểm' })).toHaveCount(1);
    // Chọn hình → cỡ chữ to hơn, kéo ô góc để đổi kích thước.
    const leaf = dg.locator('.dg-node', { hasText: 'Ai ký duyệt chứng từ' });
    await leaf.click();
    const w0 = (await leaf.locator('rect').first().boundingBox()).width;
    await page.click('[data-dg-fs="1"]');
    await expect(page.locator('.dg-fs strong')).toHaveText('120%');
    const w1 = (await dg.locator('.dg-node', { hasText: 'Ai ký duyệt chứng từ' }).locator('rect').first().boundingBox()).width;
    expect(w1).toBeGreaterThan(w0);
    const h = dg.locator('[data-resize]');
    const hb = await h.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 120, hb.y + 40, { steps: 6 });
    await page.mouse.up();
    const w2 = (await dg.locator('.dg-node', { hasText: 'Ai ký duyệt chứng từ' }).locator('rect').first().boundingBox()).width;
    expect(w2).toBeGreaterThan(w1 + 40);
    await expect(page.locator('[data-dg-autosize]')).toBeVisible();
    // Tab: thêm nhánh con, gõ nội dung.
    await dg.locator('.dg-node', { hasText: 'Ai ký duyệt chứng từ' }).click();
    await page.keyboard.press('Tab');
    await page.locator('[data-dg-label]').fill('Kế toán trưởng');
    await expect(dg.locator('.dg-node', { hasText: 'Kế toán trưởng' })).toHaveCount(1);
    // Thu gọn tất cả / mở hết; ẩn quan hệ chéo.
    await page.click('[data-dg-collapse="all"]');
    await expect(dg.locator('.dg-node', { hasText: 'Kế toán trưởng' })).toHaveCount(0);
    await page.click('[data-dg-collapse="none"]');
    await expect(dg.locator('.dg-node', { hasText: 'Kế toán trưởng' })).toHaveCount(1);
    const cross = await dg.locator('.dg-cross').count();
    if (cross) {
      await page.click('[data-dg-cross]');
      await expect(dg.locator('.dg-cross')).toHaveCount(0);
      await page.click('[data-dg-cross]');
    }
    // Đổi kiểu: cây ngang (mọi nhánh sang phải), theo tầng.
    await dg.locator('[data-dg-lmode]').selectOption('cay');
    const rootBox = await dg.locator('.dg-k-root rect').boundingBox();
    for (const r of await dg.locator('.dg-node:not(.dg-k-root) rect').all()) expect((await r.boundingBox()).x).toBeGreaterThan(rootBox.x);
    await dg.locator('[data-dg-lmode]').selectOption('tang');
    await expect(dg.locator('.dg-branch')).toHaveCount(0);
    // Lưu lại: mở lại vẫn đúng kiểu và đủ hình.
    await page.reload();
    await page.click('[data-src="files"]');
    await page.fill('[data-cm-text]', TEXT);
    await page.click('[data-cm-run]');
    await page.click('[data-cm-tab="ve"]');
    await expect(page.locator('[data-dg-lmode]')).toHaveValue('tang');
    await expect(page.locator('[data-dg] .dg-node', { hasText: 'Kế toán trưởng' })).toHaveCount(1);
    t.assertClean();
  });

  test('AI gợi ý thêm nhánh cho một hình (Claude giả lập)', async ({ page }) => {
    const t = trackErrors(page);
    const calls = await mockClaude(page, (body) => (JSON.stringify(body.messages).includes('Ý ĐANG XÉT') ? '{"nhanh":["Đối chiếu sao kê ngân hàng","Xác minh chữ ký trên chứng từ"]}' : '{}'));
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    const dg = await openMindmap(page);
    await dg.locator('.dg-node.dg-k-act [data-ideas]').first().click();
    const pop = dg.locator('[data-dg-pop]');
    await pop.locator('[data-pop-ai]').click();
    await expect(pop.locator('[data-idea-ai]')).toHaveCount(2);
    const req = calls.at(-1);
    expect(req.body.messages[0].content).toContain('Ý ĐANG XÉT');
    expect(req.raw.messages[0].content[0].cache_control).toEqual({ type: 'ephemeral' });
    await pop.locator('[data-idea-ai]', { hasText: 'Đối chiếu sao kê' }).click();
    await expect(dg.locator('.dg-node[aria-label*="Đối chiếu sao kê ngân hàng"]')).toHaveCount(1);
    await expect(pop.locator('[data-idea-ai]')).toHaveCount(1);
    t.assertClean();
  });
});
