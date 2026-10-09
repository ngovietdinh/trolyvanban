import { test, expect } from '@playwright/test';
import { trackErrors, freshApp, mockClaude, setApiKey } from './helpers.mjs';

const THAU = 'Ông Trần Văn Bình, Giám đốc Ban QLDA chỉ định thầu cho Công ty Hoàng Long dù không đủ điều kiện năng lực. Ông Bình nhận 200 triệu đồng của Công ty Hoàng Long để ký duyệt thanh toán.';

test.describe('v2.31 — bộ nhận diện điều khoản, lý do và trích dẫn chọn điều luật', () => {
  test('Sơ đồ vụ việc: mỗi điều luật kèm độ chắc chắn, yếu tố cấu thành đã có (câu trích) / còn thiếu; điều không đủ yếu tố không xuất hiện', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page);
    await page.goto('/app.html#so-do');
    await page.click('[data-src="files"]');
    await page.fill('[data-cm-text]', `${THAU} Ông Bình lập hồ sơ giả mạo chữ ký của nhà thầu khác.`);
    await page.click('[data-cm-run]');
    const law = page.locator('[data-result] .cm-law');
    const card = (n) => law.locator('.lr').filter({ has: page.locator('.lr-h strong', { hasText: `Điều ${n}` }) });
    const a354 = card(354);
    await expect(a354).toContainText('nhận hối lộ');
    await expect(a354.locator('.lr-badge')).toContainText('Độ chắc chắn');
    await expect(card(222)).toBeVisible();
    await expect(card(214)).toHaveCount(0);
    await a354.locator('summary').click();
    const els = a354.locator('.lr-el li');
    await expect(els.first()).toBeVisible();
    await expect(a354.locator('.lr-el li.ok', { hasText: 'Nhận (hoặc sẽ nhận) tiền, tài sản, lợi ích' })).toContainText('Ông Bình nhận 200 triệu đồng');
    await expect(a354.locator('.lr-el li.ok', { hasText: 'Chủ thể là người có chức vụ' })).toBeVisible();
    await expect(a354.locator('.lr-vs')).toContainText('Điều 364');
    t.assertClean();
  });

  test('Phân tích lời khai: tab Điều luật + điểm “Thiếu yếu tố cấu thành” kèm câu hỏi', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page);
    await page.goto('/app.html#loi-khai');
    const box = page.locator('[data-stmt]').first();
    await box.locator('[data-lk-name]').fill('Trần Văn Bình');
    await box.locator('[data-lk-role]').fill('Giám đốc');
    await box.locator('[data-lk-text]').fill('Tôi là Giám đốc Ban QLDA. Tôi nhận tiền của Công ty Hoàng Long.');
    const issue = page.locator('.lk-issue', { hasText: 'Thiếu yếu tố cấu thành' });
    await expect(issue).toContainText('Điều 354');
    await expect(issue.locator('.lk-ask')).toContainText('việc gì');
    await page.click('[data-lk-tab="dieu-luat"]');
    const c = page.locator('.cm-law .lr').filter({ has: page.locator('.lr-h strong', { hasText: 'Điều 354' }) });
    await expect(c.locator('.lr-more[open] .lr-el li.no').first()).toContainText('chưa có trong lời khai');
    await expect(c.locator('.lr-el li.ok').first()).toContainText('Tôi nhận tiền của Công ty Hoàng Long');
    // Bổ sung lời khai → yếu tố được lấp, điểm biến mất.
    await box.locator('[data-lk-text]').fill('Tôi là Giám đốc Ban QLDA. Tôi nhận 200 triệu đồng của Công ty Hoàng Long để ký duyệt thanh toán.');
    await expect(page.locator('.lk-issue', { hasText: 'Thiếu yếu tố cấu thành' })).toHaveCount(0);
    await expect(page.locator('.cm-law .lr').filter({ has: page.locator('.lr-h strong', { hasText: 'Điều 354' }) }).locator('.lr-badge')).toContainText('cao');
    t.assertClean();
  });

  test('AI gán điều luật: hiện yếu tố đối chiếu đạt; điều không đạt chuyển “chưa xác định”', async ({ page }) => {
    const t = trackErrors(page);
    await mockClaude(page, () => JSON.stringify({ tomTat: 'x', banChat: [], nguoi: [], hanhVi: [
      { ten: 'Nhận tiền ký duyệt thanh toán', dieu: '354', nguoi: ['Trần Văn Bình'], trich: 'Ông Bình nhận 200 triệu đồng của Công ty Hoàng Long để ký duyệt thanh toán' },
      { ten: 'Lập chứng từ khống', dieu: '353', nguoi: ['Trần Văn Bình'], trich: 'Ông Bình nhận 200 triệu đồng của Công ty Hoàng Long để ký duyệt thanh toán' },
    ], quanHe: [], moc: [] }));
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    await page.goto('/app.html#so-do');
    await page.click('[data-src="files"]');
    await page.fill('[data-cm-text]', THAU);
    await page.check('[data-cm-ai]');
    await page.click('[data-cm-run]');
    const law = page.locator('[data-result] .cm-law');
    await expect(law.locator('.lr').filter({ has: page.locator('.lr-h strong', { hasText: 'Điều 354' }) }).locator('.lr-badge')).toContainText('AI xác định');
    await expect(law.locator('.lr-h strong', { hasText: 'Điều 353' })).toHaveCount(0);
    await expect(page.locator('.toast', { hasText: 'chưa đủ căn cứ' }).first()).toBeVisible();
    t.assertClean();
  });
});
