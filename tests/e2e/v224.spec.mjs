import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { trackErrors, freshApp, mockClaude, setApiKey } from './helpers.mjs';

/** Khung của phần tử sau khi trang cuộn xong (cuộn mượt). */
async function stableBox(page, loc) {
  await loc.scrollIntoViewIfNeeded();
  let prev = null;
  for (let i = 0; i < 40; i++) {
    const b = await loc.boundingBox();
    if (prev && b && Math.abs(b.y - prev.y) < 0.5) return b;
    prev = b;
    await page.waitForTimeout(50);
  }
  return prev;
}

const LOI_KHAI = 'Ngày 05/3/2025 ông Nguyễn Văn An, kế toán Ban QLDA lập chứng từ chi khống để rút tiền chiếm đoạt 300 triệu đồng. Sau đó ông An chuyển cho ông Trần Văn Bình 100 triệu đồng. Ông Bình chỉ đạo ông An lập hồ sơ quyết toán. Bà Lê Thị Cúc thủ quỹ nhận 20 triệu đồng của ông An.';

test.describe('v2.24 — thu gọn menu, câu hỏi gợi ý, gợi ý đầu mục', () => {
  test('thanh menu thu gọn / mở rộng, nhớ trạng thái, phím tắt Ctrl+B', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal');
    await page.click('[data-sidebar-toggle]');
    await expect(page.locator('body')).toHaveClass(/sb-collapsed/);
    // Có hiệu ứng thu gọn: chờ đến khi đạt bề rộng cuối.
    await expect.poll(() => page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width)).toBeLessThan(80);
    await expect(page.locator('.sb-nav a[href="#legal"]')).toHaveAttribute('title', /.+/);
    await page.reload();
    await expect(page.locator('body')).toHaveClass(/sb-collapsed/);
    await page.keyboard.press('Control+b');
    await expect(page.locator('body')).not.toHaveClass(/sb-collapsed/);
    t.assertClean();
  });

  test('câu hỏi sinh ra là gợi ý: thêm, sửa rồi thêm, bỏ, đưa về gợi ý; gợi ý đầu mục khi nhập', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal/353');
    await expect(page.locator('.lg-pickbar')).toContainText('0 câu trong kế hoạch');
    await expect(page.locator('.lg-q')).toHaveCount(0);
    const issue = page.locator('[data-issue="dong-pham"]');
    await issue.locator('.lg-is-sum').click();
    const goiy = issue.locator('[data-goiy]');
    if (!(await goiy.evaluate((el) => el.open))) await goiy.locator('summary').click();
    const nSug = await goiy.locator('.lg-sq').count();
    expect(nSug).toBeGreaterThan(2);
    // Thêm một câu.
    const first = await goiy.locator('.lg-sq').first().getAttribute('data-sq');
    await goiy.locator('.lg-sq').first().locator('[data-sq-add]').click();
    await expect(issue.locator('.lg-q')).toHaveCount(1);
    await expect(issue.locator('.lg-q').first()).toHaveAttribute('data-text', first);
    // Sửa rồi thêm.
    const g2 = issue.locator('[data-goiy]');
    if (!(await g2.evaluate((el) => el.open))) await g2.locator('summary').click();
    await g2.locator('.lg-sq').first().locator('[data-sq-edit]').click();
    await g2.locator('.lg-sq textarea').fill('Câu hỏi gợi ý đã sửa lại?');
    await g2.locator('.lg-sq button', { hasText: 'Lưu & thêm' }).click();
    await expect(issue.locator('.lg-q', { hasText: 'Câu hỏi gợi ý đã sửa lại?' })).toHaveCount(1);
    // Bỏ một gợi ý.
    const g3 = issue.locator('[data-goiy]');
    if (!(await g3.evaluate((el) => el.open))) await g3.locator('summary').click();
    const before = await g3.locator('.lg-sq').count();
    await g3.locator('.lg-sq').first().locator('[data-sq-x]').click();
    await expect(issue.locator('[data-goiy] .lg-sq')).toHaveCount(before - 1);
    // Xóa câu trong kế hoạch → về lại gợi ý.
    await issue.locator('.lg-q').first().hover();
    await issue.locator('.lg-q').first().locator('[data-qdel]').click();
    await expect(issue.locator('.lg-q')).toHaveCount(1);
    // Thêm tất cả / bỏ hết.
    await page.click('[data-pick-all]');
    await expect(page.locator('[data-pick-all]')).toHaveCount(0);
    const all = await page.locator('.lg-q').count();
    expect(all).toBeGreaterThan(20);
    await page.click('[data-pick-none]');
    await expect(page.locator('.lg-q')).toHaveCount(0);
    // Gợi ý đầu mục khi nhập câu hỏi.
    const input = page.locator('[data-issue="dong-pham"] .lg-add input');
    await input.focus();
    const row = page.locator('[data-issue="dong-pham"] .sg-row');
    await expect(row).toBeVisible();
    await row.locator('.sg-chip', { hasText: 'Ai là người' }).click();
    await expect(input).toHaveValue('Ai là người ');
    await input.pressSequentially('nhận tiền');
    await expect(row.locator('.sg-chip').first()).toContainText('+');
    t.assertClean();
  });

  test('ghi lời khai khi kế hoạch còn trống: tự đưa câu gợi ý vào kế hoạch; gợi ý đầu mục ở ô Hỏi', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal/353');
    await page.click('[data-start]');
    await expect(page.locator('.modal [name="pickAll"]')).toBeChecked();
    await page.fill('#st-name', 'Nguyễn Văn An');
    await page.click('.modal button[type="submit"]');
    await expect(page).toHaveURL(/#interview\//);
    expect(await page.locator('.iv-pq').count()).toBeGreaterThan(10);
    await page.locator('[data-q]').focus();
    await expect(page.locator('.iv-q .sg-row')).toBeVisible();
    await page.locator('.iv-q .sg-chip').first().click();
    await expect(page.locator('[data-q]')).not.toHaveValue('');
    t.assertClean();
  });
});

test.describe('v2.24 — sơ đồ logic tùy chỉnh, AI làm tiếp', () => {
  test('tự vẽ sơ đồ: thêm, sửa, nối, vẽ tay, tẩy, hoàn tác, toàn màn hình, xuất SVG, lưu lại', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#so-do');
    await page.click('[data-cm-blank]');
    const dg = page.locator('[data-dg]');
    await expect(dg).toBeVisible();
    const canvas = page.locator('[data-dg-canvas]');
    const box = await stableBox(page, canvas);
    // Thêm hai nút.
    await page.click('[data-dg-mode="node"]');
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4);
    await page.locator('[data-dg-label]').fill('Nguyễn Văn An');
    await page.locator('[data-dg-sub]').fill('Kế toán');
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.4);
    // Sơ đồ trống có sẵn chủ đề trung tâm + 2 hình vừa thêm.
    await expect(dg.locator('.dg-node')).toHaveCount(3);
    await page.locator('[data-dg-label]').fill('Trần Văn Bình');
    await expect(dg.locator('.dg-node', { hasText: 'Nguyễn Văn An' })).toContainText('Kế toán');
    // Nối mũi tên.
    await page.click('[data-dg-mode="connect"]');
    await dg.locator('.dg-node', { hasText: 'Nguyễn Văn An' }).click();
    await dg.locator('.dg-node', { hasText: 'Trần Văn Bình' }).click();
    await expect(dg.locator('.dg-edge')).toHaveCount(1);
    await page.locator('[data-dg-elabel]').fill('đưa 100 triệu');
    await page.locator('[data-dg-ek]').selectOption('tien');
    await expect(dg.locator('.dg-edge')).toContainText('đưa 100 triệu');
    // Kéo thả nút.
    await page.click('[data-dg-mode="select"]');
    const nb = await dg.locator('.dg-node', { hasText: 'Trần Văn Bình' }).boundingBox();
    await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2);
    await page.mouse.down();
    await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2 + 80, { steps: 5 });
    await page.mouse.up();
    const nb2 = await dg.locator('.dg-node', { hasText: 'Trần Văn Bình' }).boundingBox();
    expect(nb2.y).toBeGreaterThan(nb.y + 20);
    // Ghi chú.
    await page.click('[data-dg-mode="text"]');
    const bt = await stableBox(page, canvas);
    await page.mouse.click(bt.x + bt.width * 0.5, bt.y + bt.height * 0.15);
    await page.locator('[data-dg-label]').fill('Cần làm rõ nguồn tiền');
    await expect(dg.locator('.dg-k-note')).toContainText('Cần làm rõ');
    // Vẽ tay rồi tẩy.
    // Khung vẽ cao: bấm thanh công cụ có thể cuộn trang → đo lại vị trí khung trước khi vẽ / tẩy.
    await page.click('[data-dg-mode="pen"]');
    const bp = await stableBox(page, canvas);
    await page.mouse.move(bp.x + 40, bp.y + bp.height - 60);
    await page.mouse.down();
    await page.mouse.move(bp.x + 140, bp.y + bp.height - 50, { steps: 8 });
    await page.mouse.up();
    await expect(dg.locator('.dg-stroke')).toHaveCount(1);
    await page.click('[data-dg-mode="erase"]');
    const be = await stableBox(page, canvas);
    await page.mouse.click(be.x + 90, be.y + be.height - 55);
    await expect(dg.locator('.dg-stroke')).toHaveCount(0);
    // Hoàn tác lấy lại nét vẽ, làm lại xóa đi.
    await page.click('[data-dg-undo]');
    await expect(dg.locator('.dg-stroke')).toHaveCount(1);
    await page.click('[data-dg-redo]');
    await expect(dg.locator('.dg-stroke')).toHaveCount(0);
    // Xóa nút bằng phím Delete.
    await page.click('[data-dg-mode="select"]');
    await dg.locator('.dg-k-note').click();
    await page.keyboard.press('Delete');
    await expect(dg.locator('.dg-k-note')).toHaveCount(0);
    // Toàn màn hình.
    await page.click('[data-dg-full]');
    await expect(dg).toHaveClass(/is-full/);
    const full = await dg.boundingBox();
    expect(full.width).toBeGreaterThan(1000);
    await page.click('[data-dg-full]');
    await expect(dg).not.toHaveClass(/is-full/);
    // Xuất SVG.
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-dg-svgx]')]);
    const svg = readFileSync(await dl.path(), 'utf8');
    expect(svg).toContain('Nguyễn Văn An');
    expect(svg).toContain('đưa 100 triệu');
    // Lưu lại: mở lại vẫn còn.
    await page.reload();
    await page.click('[data-cm-blank]');
    await expect(page.locator('[data-dg] .dg-node')).toHaveCount(3);
    await expect(page.locator('[data-dg] .dg-edge')).toContainText('đưa 100 triệu');
    t.assertClean();
  });

  test('sơ đồ từ tài liệu → tab Vẽ & chỉnh sửa; AI làm tiếp theo yêu cầu, hoàn tác', async ({ page }) => {
    const t = trackErrors(page);
    const calls = await mockClaude(page, (body) => {
      const p = JSON.stringify(body.messages);
      if (p.includes('YÊU CẦU CỦA ĐIỀU TRA VIÊN')) return JSON.stringify({ tomTat: 'Bổ sung bà Cúc thủ quỹ nhận 20 triệu.', banChat: ['An chi khống 300 triệu', 'Cúc nhận 20 triệu'], nguoi: [{ ten: 'Nguyễn Văn An', vaiTro: 'Kế toán' }, { ten: 'Trần Văn Bình', vaiTro: 'Giám đốc' }, { ten: 'Lê Thị Cúc', vaiTro: 'Thủ quỹ, người nhận tiền' }], hanhVi: [{ ten: 'Lập chứng từ chi khống', dieu: '353', nguoi: ['Nguyễn Văn An'], soTien: '300 triệu đồng', trich: 'lập chứng từ chi khống để rút tiền chiếm đoạt 300 triệu đồng' }, { ten: 'Nhận tiền của ông An', dieu: '354', nguoi: ['Lê Thị Cúc'], soTien: '20 triệu đồng', trich: 'Bà Lê Thị Cúc thủ quỹ nhận 20 triệu đồng của ông An' }], quanHe: [{ tu: 'Nguyễn Văn An', den: 'Trần Văn Bình', loai: 'tien', noiDung: 'chuyển', soTien: '100 triệu đồng', trich: 'ông An chuyển cho ông Trần Văn Bình 100 triệu đồng' }, { tu: 'Nguyễn Văn An', den: 'Lê Thị Cúc', loai: 'tien', noiDung: 'đưa', soTien: '20 triệu đồng', trich: 'thủ quỹ nhận 20 triệu đồng của ông An' }], moc: [], ghiChu: 'Đã thêm bà Cúc và dòng tiền 20 triệu' });
      return '{}';
    });
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    await page.goto('/app.html#so-do');
    await page.click('[data-src="files"]');
    await page.fill('[data-cm-text]', LOI_KHAI);
    await page.click('[data-cm-run]');
    const res = page.locator('[data-result]');
    await expect(res.locator('.cm-sum, .cm-points').first()).toBeVisible();
    // Tab vẽ: dựng sẵn từ sơ đồ vụ việc.
    await page.click('[data-cm-tab="ve"]');
    await expect(res.locator('[data-dg] .dg-node.dg-k-crime', { hasText: 'Điều 353' })).toHaveCount(1);
    const n0 = await res.locator('[data-dg] .dg-node').count();
    // AI làm tiếp.
    const rf = page.locator('[data-cm-refine]');
    await expect(rf).toBeVisible();
    await rf.locator('[data-rf-text]').focus();
    await expect(rf.locator('.sg-row')).toBeVisible();
    await rf.locator('[data-rf-text]').fill('Bổ sung bà Cúc thủ quỹ và dòng tiền 20 triệu');
    await rf.locator('[data-rf-send]').click();
    await expect(rf.locator('.rf-hist li')).toContainText('Đã thêm bà Cúc');
    const req = calls.at(-1).body.messages[0].content;
    expect(req).toContain('SƠ ĐỒ VỤ VIỆC HIỆN TẠI');
    expect(req).toContain('Bổ sung bà Cúc thủ quỹ');
    expect(req).toContain('TÀI LIỆU, LỜI KHAI GỐC');
    // Sơ đồ tự vẽ cập nhật theo.
    await expect(res.locator('[data-dg] .dg-node', { hasText: 'Lê Thị Cúc' })).toHaveCount(1);
    // Hành vi mẫu từ máy (nhiều câu căn cứ) được AI gộp thành một hành vi mỗi điều → số nút có thể giảm nhẹ, không mất điều luật / người.
    expect(await res.locator('[data-dg] .dg-node').count()).toBeGreaterThanOrEqual(n0 - 3);
    await page.click('[data-cm-tab="quan-he"]');
    await expect(res.locator('[data-dg] .dg-node', { hasText: 'Lê Thị Cúc' })).toHaveCount(1);
    await page.click('[data-cm-tab="ban-chat"]');
    await expect(res.locator('.cm-sum')).toContainText('Bổ sung bà Cúc');
    // Hoàn tác.
    await rf.locator('[data-rf-undo]').click();
    await expect(res.locator('[data-cm-body]')).not.toContainText('Bổ sung bà Cúc');
    await expect(rf.locator('.rf-hist li').last()).toContainText('Hoàn tác');
    t.assertClean();
  });

  test('thêm hành vi từ tài liệu: AI làm tiếp thêm hành vi theo yêu cầu', async ({ page }) => {
    const t = trackErrors(page);
    const calls = await mockClaude(page, (body) => {
      const p = JSON.stringify(body.messages);
      if (p.includes('YÊU CẦU CỦA ĐIỀU TRA VIÊN')) return JSON.stringify({ hanhVi: [{ ten: 'Lập hồ sơ quyết toán khống theo chỉ đạo', tenCu: null, dieu: '353', hanhViId: null, trich: 'Ông Bình chỉ đạo ông An lập hồ sơ quyết toán', lyDo: 'Hợp thức hóa', cauHoi: ['Ai chỉ đạo lập hồ sơ quyết toán?'] }], bo: [], tomTat: null, ghiChu: 'Thêm 1 hành vi' });
      return JSON.stringify({ tomTat: 'An chi khống.', hanhVi: [{ ten: 'Lập chứng từ chi khống rút tiền', dieu: '353', hanhViId: null, trich: 'lập chứng từ chi khống', lyDo: 'Chiếm đoạt', cauHoi: ['Anh lập chứng từ thế nào?'] }] });
    });
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    await page.goto('/app.html#legal/353');
    await page.click('[data-act-file]');
    await page.fill('.modal [data-text]', LOI_KHAI);
    await page.locator('.modal [data-method][value="ai"]').check();
    await page.click('.modal [data-analyze]');
    await expect(page.locator('.modal .la-row')).toHaveCount(1);
    const rf = page.locator('.modal [data-la-refine]');
    await rf.locator('[data-rf-text]').fill('Tìm thêm hành vi lập hồ sơ quyết toán');
    await rf.locator('[data-rf-send]').click();
    await expect(page.locator('.modal .la-row')).toHaveCount(2);
    await expect(page.locator('.modal [data-la-refine] .rf-hist li')).toContainText('thêm 1');
    expect(calls.at(-1).body.messages[0].content).toContain('CÁC HÀNH VI ĐÃ XÁC ĐỊNH');
    t.assertClean();
  });
});
