import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

const AN = 'Tôi là kế toán Ban QLDA huyện X. Ngày 05/3/2025 tôi lập chứng từ chi khống rút 300 triệu đồng. Sau đó tôi chuyển cho ông Trần Văn Bình 100 triệu đồng để ký duyệt thanh toán. Tôi đưa cho bà Lê Thị Cúc 20 triệu đồng.';
const BINH = 'Tôi là Giám đốc Ban QLDA. Ngày 05/3/2025 tôi nhận 100 triệu đồng của ông Nguyễn Văn An.';

async function fillTwo(page) {
  await page.goto('/app.html#loi-khai');
  const a = page.locator('[data-stmt]').nth(0);
  await a.locator('[data-lk-name]').fill('Nguyễn Văn An');
  await a.locator('[data-lk-text]').fill(AN);
  const b = page.locator('[data-stmt]').nth(1);
  await b.locator('[data-lk-name]').fill('Trần Văn Bình');
  await b.locator('[data-lk-text]').fill(BINH);
  await expect(page.locator('[data-lk-status]')).toContainText('2 lời khai');
}

test.describe('v2.32 — xem chi tiết ngay khi bấm; dòng tiền thông minh, biết học', () => {
  test('Phân tích lời khai: bấm số liệu, tên người, tổng tiền xem ngay chi tiết; đối chiếu tiền vào – ra', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page);
    await fillTwo(page);
    const kpi = page.locator('[data-lk-kpi] .cm-kpis');
    await expect(kpi.locator('[data-kpi="dong-tien"] strong')).toHaveText('2');
    await expect(kpi.locator('[data-kpi="tong"] strong')).toContainText('120 triệu đồng');
    // Dòng tiền: bảng khoản, xác nhận mấy phía, đối chiếu chưa rõ đi đâu.
    await kpi.locator('[data-kpi="dong-tien"]').click();
    const panel = page.locator('[data-drill-host] .cm-drill');
    await expect(panel).toContainText('Dòng tiền');
    await expect(panel.locator('.cm-gaps')).toContainText('còn 180 triệu đồng chưa rõ đi đâu');
    const row = panel.locator('tr.cm-fl', { hasText: 'Trần Văn Bình' });
    await expect(row).toContainText('✓ 2 phía');
    await expect(row).toContainText('để ký duyệt thanh toán');
    await expect(row).toContainText('05/03/2025');
    await expect(panel.locator('tr.cm-fl', { hasText: 'Lê Thị Cúc' })).toContainText('1 phía');
    // Chi tiết một khoản: câu trích + nguồn khai.
    await row.locator('[data-flow-toggle]').click();
    await expect(panel.locator('[data-flow-detail]').first()).toContainText('nguồn: Nguyễn Văn An, Trần Văn Bình');
    // Tổng theo người: bấm số → các khoản tạo nên con số.
    const totals = panel.locator('.cm-totals');
    await totals.locator('tr', { hasText: 'Nguyễn Văn An' }).locator('[data-tot="out"]').click();
    await expect(panel.locator('[data-tot-detail]:not([hidden])')).toContainText('100 triệu đồng + 20 triệu đồng = 120 triệu đồng (máy cộng)');
    await totals.locator('tr', { hasText: 'Nguyễn Văn An' }).locator('[data-tot="rut"]').click();
    await expect(panel.locator('[data-tot-detail]:not([hidden])').last()).toContainText('rút / lấy');
    // Bấm tên người → hồ sơ: chức vụ nguyên văn, dòng tiền, hành vi.
    await panel.locator('.cm-pn', { hasText: 'Nguyễn Văn An' }).first().click();
    const pf = page.locator('[data-drill-host] .cm-drill');
    await expect(pf).toContainText('Hồ sơ người liên quan');
    await expect(pf).toContainText('Kế toán Ban QLDA huyện X');
    await expect(pf).toContainText('rút / lấy 300 triệu đồng');
    await expect(pf).toContainText('còn 180 triệu đồng chưa rõ đi đâu');
    await expect(pf).toContainText('Điều 353');
    // Số tiền: mỗi mức nằm ở đâu.
    await kpi.locator('[data-kpi="so-tien"]').click();
    await expect(page.locator('[data-drill-host] .cm-drill')).toContainText('khoản rút / lấy (nguồn tiền)');
    await kpi.locator('[data-kpi="so-tien"]').click();
    await expect(page.locator('[data-drill-host] .cm-drill')).toHaveCount(0);
    // Người liên quan / điều luật / hành vi.
    await kpi.locator('[data-kpi="nguoi"]').click();
    await expect(page.locator('[data-drill-host] .cm-drill table')).toContainText('Lê Thị Cúc');
    await kpi.locator('[data-kpi="dieu"]').click();
    await expect(page.locator('[data-drill-host] .cm-drill .lr').first()).toBeVisible();
    await kpi.locator('[data-kpi="hanh-vi"]').click();
    await expect(page.locator('[data-drill-host] .cm-drill')).toContainText('Điều 353');
    t.assertClean();
  });

  test('sơ đồ dòng tiền: nguồn tiền, thời điểm, nét đứt khi chỉ một bên khai; chọn người hiện hồ sơ', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page);
    await fillTwo(page);
    await page.click('[data-lk-tab="dong-tien"]');
    const dg = page.locator('[data-lk-dg]');
    await expect(dg.locator('.dg-node', { hasText: '300 triệu đồng' })).toContainText('rút / lấy');
    await expect(dg.locator('.dg-edge', { hasText: '100 triệu đồng · 05/03/2025' })).toHaveCount(1);
    const strong = await dg.locator('.dg-edge', { hasText: '100 triệu đồng · 05/03/2025' }).locator('path[stroke-dasharray]').count();
    const weak = await dg.locator('.dg-edge', { hasText: '20 triệu đồng' }).locator('path[stroke-dasharray]').count();
    expect(strong).toBe(0);
    expect(weak).toBeGreaterThan(0);
    await dg.locator('.dg-node', { hasText: 'Nguyễn Văn An' }).click();
    await expect(dg.locator('.dg-prof')).toContainText('Kế toán Ban QLDA huyện X');
    await expect(dg.locator('.dg-prof')).toContainText('rút / lấy 300 triệu đồng');
    t.assertClean();
  });

  test('máy học: đảo chiều một khoản → ghi nhớ cho động từ, phân tích lại vẫn đúng; quên quy tắc', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page);
    await fillTwo(page);
    await page.click('[data-lk-kpi] [data-kpi="dong-tien"]');
    const panel = page.locator('[data-drill-host] .cm-drill');
    const cuc = panel.locator('tr.cm-fl', { hasText: 'Lê Thị Cúc' });
    await expect(cuc.locator('td').nth(1)).toHaveText(/Nguyễn Văn An → Lê Thị Cúc/);
    await cuc.locator('[data-flow-toggle]').click();
    await panel.locator('[data-flow-detail]:not([hidden]) [data-flow-act="dao"]').click();
    await expect(page.locator('.toast', { hasText: 'ghi nhớ' }).first()).toBeVisible();
    await expect(panel.locator('tr.cm-fl', { hasText: 'Lê Thị Cúc' }).locator('td').nth(1)).toHaveText(/Lê Thị Cúc → Nguyễn Văn An/);
    await expect(panel.locator('.cm-learned')).toContainText('Máy đã học 1 quy tắc');
    // Sửa lại lời khai → phân tích lại vẫn áp dụng quy tắc đã học.
    await page.locator('[data-stmt]').nth(0).locator('[data-lk-text]').fill(`${AN} Tôi hứa sẽ trả lại.`);
    await expect(panel.locator('tr.cm-fl', { hasText: 'Lê Thị Cúc' }).locator('td').nth(1)).toHaveText(/Lê Thị Cúc → Nguyễn Văn An/);
    // Quy tắc còn sau khi tải lại trang; quên → phân tích lại về mặc định.
    await page.reload();
    await page.click('[data-lk-kpi] [data-kpi="dong-tien"]');
    await expect(page.locator('[data-drill-host] .cm-learned')).toContainText('Máy đã học 1 quy tắc');
    await page.locator('[data-drill-host] .cm-learned summary').click();
    await page.locator('[data-forget="verb"]').click();
    await expect(page.locator('[data-drill-host] tr.cm-fl', { hasText: 'Lê Thị Cúc' }).locator('td').nth(1)).toHaveText(/Nguyễn Văn An → Lê Thị Cúc/);
    // “Không phải dòng tiền” → loại câu đó và nhớ.
    const row = page.locator('[data-drill-host] tr.cm-fl', { hasText: 'Lê Thị Cúc' });
    await row.locator('[data-flow-toggle]').click();
    await page.locator('[data-drill-host] [data-flow-detail]:not([hidden]) [data-flow-act="bo"]').click();
    await expect(page.locator('[data-drill-host] tr.cm-fl', { hasText: 'Lê Thị Cúc' })).toHaveCount(0);
    await expect(page.locator('[data-drill-host] .cm-learned')).toContainText('Bỏ qua câu');
    t.assertClean();
  });

  test('Sơ đồ vụ việc: bấm số liệu, chip người, mô hình vụ việc; sửa khoản học cho lần sau', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page);
    await page.goto('/app.html#so-do');
    await page.click('[data-src="files"]');
    await page.fill('[data-cm-text]', `Ngày 05/3/2025 ông Nguyễn Văn An, kế toán Ban QLDA huyện X lập chứng từ chi khống rút 300 triệu đồng. Sau đó ông An chuyển cho ông Trần Văn Bình 100 triệu đồng. Bà Lê Thị Cúc nhận 20 triệu đồng của ông An.`);
    await page.click('[data-cm-run]');
    const res = page.locator('[data-result]');
    await expect(res.locator('.cm-ess')).toContainText('Điều 353');
    await expect(res.locator('.cm-ess')).toContainText('còn 180 triệu đồng chưa rõ đi đâu');
    await res.locator('[data-kpi="nguoi"]').click();
    await expect(res.locator('.cm-drill table')).toContainText('Kế toán Ban QLDA huyện X');
    await res.locator('.cm-drill .cm-pn', { hasText: 'Lê Thị Cúc' }).click();
    await expect(res.locator('.cm-drill')).toContainText('Hồ sơ người liên quan');
    await expect(res.locator('.cm-drill')).toContainText('20 triệu đồng');
    // Chip người trong Bản chất cũng bấm được.
    await res.locator('.cm-chip', { hasText: 'Trần Văn Bình' }).click();
    await expect(res.locator('.cm-drill')).toContainText('Trần Văn Bình');
    // Tab dòng tiền: bảng khoản + tổng bấm được; đảo chiều → sơ đồ cập nhật.
    await page.click('[data-cm-tab="dong-tien"]');
    await res.locator('tr.cm-fl', { hasText: 'Lê Thị Cúc' }).locator('[data-flow-toggle]').click();
    await res.locator('[data-flow-detail]:not([hidden]) [data-flow-act="dao"]').click();
    await expect(res.locator('[data-dg] .dg-edge', { hasText: '20 triệu' })).toHaveCount(1);
    await expect(res.locator('tr.cm-fl', { hasText: 'Lê Thị Cúc' }).locator('td').nth(1)).toHaveText(/Lê Thị Cúc → Nguyễn Văn An/);
    // Lần phân tích sau áp dụng quy tắc đã học.
    await page.click('[data-cm-run]');
    await page.click('[data-cm-tab="dong-tien"]');
    await expect(res.locator('tr.cm-fl', { hasText: 'Lê Thị Cúc' }).locator('td').nth(1)).toHaveText(/Lê Thị Cúc → Nguyễn Văn An/);
    t.assertClean();
  });
});
