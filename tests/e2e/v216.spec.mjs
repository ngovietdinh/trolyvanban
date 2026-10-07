import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

const BAO_CAO = `Qua thanh tra, ông A đã sử dụng con dấu giả của Sở Tài chính để làm giả hồ sơ quyết toán nhằm hợp thức hóa các khoản chi. Hành vi làm giả có dấu hiệu Điều 341 BLHS.`;

test.describe('Phân tích vụ việc 4 bước + sơ đồ cây', () => {
  test('nhập hành vi + tải tài liệu → đề xuất điều luật → chọn hành vi → câu hỏi & sơ đồ cây', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal');
    await page.locator('.lg-case-hero').click();
    await expect(page).toHaveURL(/#legal\/vu-viec$/);
    await expect(page.locator('.wz-step.active')).toContainText('Hành vi');

    // ① Hành vi: nhập tay + tài liệu.
    await page.fill('[data-manual]', 'Kế toán lập chứng từ chi khống để rút tiền\nThủ quỹ thu tiền nhưng không nhập quỹ\nGiám đốc ký duyệt hồ sơ không kiểm tra theo quy trình');
    await page.locator('[data-file]').setInputFiles({ name: 'ket-luan.txt', mimeType: 'text/plain', buffer: Buffer.from(BAO_CAO, 'utf8') });
    await page.click('[data-analyze]');

    // ② Điều luật đề xuất: nhiều điều, chọn điều chính, bỏ một điều, thêm điều khác.
    await expect(page.locator('.wz-step.active')).toContainText('Điều luật đề xuất');
    const card = (d) => page.locator(`[data-crime-card="${d}"]`);
    for (const d of ['353', '360', '341']) await expect(card(d).locator('[data-pick]')).toBeChecked();
    await expect(card('353').locator('[data-primary]')).toBeChecked();
    await card('360').locator('[data-pick]').uncheck();
    await page.fill('[data-crime-q]', 'nhận hối lộ');
    await page.locator('[data-add-crime="354"]').click();
    await expect(card('354').locator('[data-pick]')).toBeChecked();
    await expect(page.locator('.wz-sum')).toContainText('Đã chọn 3 điều');
    await page.click('[data-next]');

    // ③ Hành vi theo điều: điều bỏ chọn không vào kế hoạch; thêm hành vi có sẵn, hành vi tự nhập.
    await expect(page.locator('.wz-step.active')).toContainText('Hành vi theo điều');
    await expect(page.locator('[data-group="353"] .la-row')).toHaveCount(2);
    await expect(page.locator('[data-group="341"] [data-r-name][value^="Sử dụng con dấu"]')).toHaveCount(1);
    await expect(page.locator('.wz-outside')).toContainText('1 hành vi thuộc điều chưa chọn');
    await page.locator('[data-group="354"] [data-add-known]').first().click();
    await page.locator('[data-add-row="354"]').click();
    const blank = page.locator('[data-group="354"] .la-row').filter({ has: page.locator('[data-r-name][value=""]') });
    await blank.locator('[data-r-name]').fill('Nhận tiền của nhà thầu để cho trúng thầu');
    await blank.locator('[data-r-name]').press('Tab');
    await expect(page.locator('[data-count]')).toHaveText(/^\d+ hành vi đã chọn$/);
    const n = parseInt(await page.locator('[data-count]').innerText(), 10);
    expect(n).toBe((await page.locator('.wz-group .la-row .la-check:checked').count()));
    await page.click('[data-next]');

    // ④ Kế hoạch: thanh bước, sơ đồ cây nhiều điều luật, câu hỏi.
    await expect(page).toHaveURL(/#legal\/353$/);
    await expect(page.locator('.wz-bar .wz-step.active')).toContainText('Câu hỏi & sơ đồ cây');
    await expect(page.locator('[data-tab="map"]')).toHaveAttribute('aria-selected', 'true');
    const tree = page.locator('[data-pt-tree]');
    await expect(tree.locator('[data-node="crime-353"]')).toContainText('Điều chính');
    await expect(tree.locator('[data-node="crime-341"]')).toContainText('Liên quan');
    await expect(tree.locator('[data-node="crime-354"]')).toBeVisible();
    await expect(tree.locator('[data-node="crime-360"]')).toHaveCount(0);
    // Nhánh hành vi của từng điều mở sẵn; mở hành vi tự nhập của Điều 354 → câu hỏi.
    await expect(tree.locator('[data-node="acts-354"]')).toHaveClass(/open/);
    const act = tree.locator('[data-node="acts-354"] .pt-act').filter({ hasText: 'Nhận tiền của nhà thầu' });
    await act.locator('> .pt-node').click();
    await expect(act.locator('.pt-q').first()).toBeVisible();
    // Tìm trong sơ đồ.
    await page.fill('[data-pt-q]', 'con dấu');
    await expect(tree.locator('.pt-li.hit').first()).toBeVisible();
    // Bấm một câu hỏi → sang tab câu hỏi, đúng vấn đề.
    await act.locator('.pt-q > .pt-node').first().click();
    await expect(page.locator('[data-tab="issues"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.lg-issue details[open]').filter({ hasText: 'Nhận tiền của nhà thầu' })).toBeVisible();

    // Quay lại bước 3 từ thanh bước: dữ liệu còn nguyên, hành vi mới không bị tạo trùng.
    await page.locator('.wz-bar [data-wz-go="3"]').click();
    await expect(page.locator('.wz-step.active')).toContainText('Hành vi theo điều');
    await expect(page.locator('[data-group="354"] .la-row')).toHaveCount(2);
    await expect(page.locator('[data-group="354"] .la-row').filter({ hasText: 'Có trong hệ thống' })).toHaveCount(2);
    await page.click('[data-next]');
    await expect(page.locator('.wz-bar')).toBeVisible();
    t.assertClean();
  });

  test('sơ đồ cây ở trang điều luật: mở rộng / thu gọn, nhánh vấn đề chung, phóng to, toàn màn hình', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal/174');
    await page.locator('[data-tab="map"]').click();
    const tree = page.locator('[data-pt-tree]');
    await expect(tree.locator('[data-node="root"]')).toContainText('Kế hoạch hỏi');
    await expect(tree.locator('[data-node="common"]')).toContainText('Vấn đề chung');
    const before = await tree.locator('.pt-li').count();
    await page.click('[data-pt-all]');
    const all = await tree.locator('.pt-li').count();
    expect(all).toBeGreaterThan(before + 20);
    await expect(tree.locator('.pt-q').first()).toBeVisible();
    await page.click('[data-pt-none]');
    await expect(tree.locator('.pt-li')).toHaveCount(1 + (await tree.locator('[data-node="root"] > .pt-kids > ul > .pt-li').count()));
    await page.locator('[data-pt-zoom="1"]').click();
    await expect(page.locator('[data-pt-canvas]')).toHaveAttribute('style', /--zoom: 1\.15/);
    // Toàn màn hình · trình bày: tiêu đề vụ việc, phóng to, làm nổi nhánh, phím tắt.
    await expect(page.locator('[data-pt-full]')).toHaveText(/Toàn màn hình · Trình bày/);
    await page.click('[data-pt-full]');
    const full = page.locator('.pt-wrap.full');
    await expect(full).toBeVisible();
    await expect(full.locator('.pt-present-title')).toContainText('Điều 174');
    await page.locator('[data-pt-spot]').check();
    await tree.locator('[data-node="crime-174"] > .pt-node').click();
    await expect(tree).toHaveClass(/pt-dim/);
    await expect(tree.locator('[data-node="crime-174"]')).toHaveClass(/focus/);
    await page.locator('[data-pt-view]').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('e');
    expect(await tree.locator('.pt-q').count()).toBeGreaterThan(10);
    await page.keyboard.press('Escape');
    await expect(page.locator('.pt-wrap.full')).toHaveCount(0);
    await expect(tree).not.toHaveClass(/pt-dim/);
    t.assertClean();
  });
});

test.describe('Cách phân tích và tải ứng dụng', () => {
  const VU_VIEC = 'Kế toán trưởng lập chứng từ chi khống để rút tiền chiếm đoạt 1,2 tỷ đồng\nThủ quỹ thu tiền nhưng không nhập quỹ';

  test('chưa có AI: chỉ đối chiếu Bộ luật; bước 2 đối chiếu dấu hiệu định tội, ngưỡng số tiền', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal/vu-viec');
    await expect(page.locator('[data-method][value="doi-chieu"]')).toBeChecked();
    await expect(page.locator('[data-method][value="ai"]')).toBeDisabled();
    await expect(page.locator('[data-method][value="ket-hop"]')).toBeDisabled();
    await page.fill('[data-manual]', VU_VIEC);
    await page.click('[data-analyze]');
    await expect(page.locator('.la-method-used')).toContainText('Đối chiếu Bộ luật trong phần mềm');
    const signs = page.locator('[data-crime-card="353"] .wz-signs');
    await expect(signs.locator('summary')).toContainText(/\d\/\d có trong nội dung/);
    await expect(signs.locator('li.hit').filter({ hasText: '1,2 tỷ đồng ≥ 2 triệu đồng' })).toHaveCount(1);
    await page.click('[data-next]');
    await expect(page.locator('.la-row').first()).toContainText('Đối chiếu Bộ luật');
    t.assertClean();
  });

  test('chọn “AI phân tích”: chỉ dùng kết quả AI (điều luật vẫn kiểm tra với Bộ luật trong phần mềm)', async ({ page }) => {
    const { mockClaude, setApiKey } = await import('./helpers.mjs');
    await mockClaude(page, () => JSON.stringify({ tomTat: 'Kế toán trưởng chi khống.', hanhVi: [{ ten: 'Lập chứng từ chi khống', dieu: '353', hanhViId: 'chi-khong', trich: 'lập chứng từ chi khống', lyDo: 'Có trách nhiệm quản lý' }] }));
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    await page.goto('/app.html#legal/vu-viec');
    await page.reload();
    await page.locator('[data-method][value="ai"]').check();
    await page.fill('[data-manual]', VU_VIEC);
    await page.click('[data-analyze]');
    await expect(page.locator('.la-method-used')).toContainText('AI phân tích');
    await page.click('[data-next]');
    // Chỉ hành vi AI xác định (không thêm “thu tiền không nhập quỹ” từ đối chiếu); có nhãn đã khớp Bộ luật.
    await expect(page.locator('.la-row')).toHaveCount(1);
    await expect(page.locator('.la-row')).toContainText('AI · khớp Bộ luật');
  });

  test('nút tải ứng dụng: bản phát hành mới nhất, đủ Windows / macOS chip Apple / Intel, hướng dẫn cài', async ({ page }) => {
    await page.route('https://api.github.com/repos/ngovietdinh/trolyvanban/releases/latest', (r) =>
      r.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({
          tag_name: 'v9.1.0',
          html_url: 'https://github.com/ngovietdinh/trolyvanban/releases/tag/v9.1.0',
          assets: ['win-x64.exe', 'mac-arm64.dmg', 'mac-x64.dmg', 'web-manifest.json'].map((x) => ({ name: `TroLyVanBan-9.1.0-${x}`, size: 125829120, browser_download_url: `https://github.com/ngovietdinh/trolyvanban/releases/download/v9.1.0/TroLyVanBan-9.1.0-${x}` })),
        }),
      }),
    );
    await freshApp(page);
    const btn = page.locator('.sidebar [data-download-app], [data-download-app]').first();
    await expect(btn).toBeVisible();
    await btn.click();
    const dlg = page.locator('.dl-modal');
    await expect(dlg).toContainText('v9.1.0');
    await expect(dlg.locator('[data-dl="win"]')).toHaveAttribute('href', /TroLyVanBan-9\.1\.0-win-x64\.exe$/);
    await expect(dlg.locator('[data-dl="macArm"]')).toHaveAttribute('href', /mac-arm64\.dmg$/);
    await expect(dlg.locator('[data-dl="macIntel"]')).toHaveAttribute('href', /mac-x64\.dmg$/);
    await expect(dlg.locator('[data-dl="win"]')).toContainText('120 MB');
    await expect(dlg.locator('.dl-help')).toContainText('xattr -cr');
    // Cài đặt cũng mở cùng hộp thoại.
    await page.keyboard.press('Escape');
    await page.goto('/app.html#settings');
    await page.locator('[data-desktop-dl]').click();
    await expect(page.locator('.dl-modal')).toBeVisible();
  });
});
