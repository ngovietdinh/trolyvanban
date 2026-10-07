import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

/** Tạo hồ sơ (Điều 353) có một bị can và một người làm chứng, lưu kế hoạch hỏi bị can vào hồ sơ. */
async function setupCase(page) {
  await freshApp(page, '#cases');
  await page.click('[data-new]');
  await page.fill('#c-ten', 'Vụ tham ô tại Ban QLDA');
  await page.fill('#c-td', '353');
  await page.click('[data-f] button[type="submit"]');
  await expect(page).toHaveURL(/#cases\/.+/);
  const caseId = page.url().split('#cases/')[1];
  for (const [name, role] of [['Nguyễn Văn A', 'bi-can'], ['Trần Thị B', 'lam-chung']]) {
    await page.click('[data-add-person]');
    await page.selectOption('#p-role', role);
    await page.fill('#p-hoTen', name);
    await page.click('[data-f] button[type="submit"]');
    await expect(page.locator('.doc-item', { hasText: name })).toBeVisible();
  }
  await page.goto('/app.html#legal/353');
  await page.click('[data-save-plan]');
  await page.fill('#pl-title', 'Hỏi cung bị can A');
  await page.selectOption('#pl-case', caseId);
  await page.click('.modal [data-f] button[type="submit"]');
  await expect(page).toHaveURL(/#legal\/plan\//);
  const planId = page.url().split('#legal/plan/')[1];
  const q1 = await page.locator('[data-issue^="hv-"] .lg-q').first().getAttribute('data-text');
  return { caseId, planId, q1 };
}

test.describe('Theo dõi, báo cáo, trạng thái câu hỏi, tải biên bản', () => {
  test('tải biên bản → trạng thái câu hỏi, tiến độ, cảnh báo, kết luận, báo cáo Word', async ({ page }) => {
    const t = trackErrors(page);
    const { caseId, planId, q1 } = await setupCase(page);
    await expect(page.locator('[data-track]')).toContainText('0 biên bản');

    // Tải biên bản lên từ màn hình Theo dõi (dán nội dung).
    await page.goto('/app.html#theo-doi');
    await expect(page.locator('.tk-table')).toContainText('Vụ tham ô tại Ban QLDA');
    await expect(page.locator('.tk-table')).toContainText('0%');
    await page.click('[data-upload]');
    await page.selectOption('#ru-case', caseId);
    await page.fill('[data-ru-text]', `BIÊN BẢN HỎI CUNG BỊ CAN\nHồi 9 giờ ngày 5 tháng 10 năm 2026\nHọ tên: Nguyễn Văn A\nHỎI VÀ ĐÁP\nHỏi: ${q1}\nĐáp: Tôi lập chứng từ chi khống để rút tiền, chiếm đoạt 300 triệu đồng của Ban quản lý dự án.\nHỏi: Ai là người chỉ đạo?\nĐáp: Tôi không nhớ.\nViệc hỏi cung kết thúc hồi 11 giờ.`);
    await page.click('[data-ru-read]');
    await expect(page.locator('[data-ru-preview]')).toContainText('2 lượt hỏi – đáp');
    await expect(page.locator('[data-ru-preview]')).toContainText('1 khớp câu hỏi của kế hoạch');
    await expect(page.locator('#ru-person option:checked')).toContainText('Nguyễn Văn A');
    await expect(page.locator('#ru-plan option:checked')).toContainText('Hỏi cung bị can A');
    await expect(page.locator('#ru-date')).toHaveValue('2026-10-05');
    await page.click('[data-ru-save]');
    await expect(page.locator('.toast').last()).toContainText('1 khớp kế hoạch');
    await expect(page.locator('.tk-table')).toContainText('Đang thực hiện');
    await expect(page.locator('.tk-table td[data-l="Biên bản"]')).toContainText('1');

    // Một hồ sơ: tổng quan đã làm / chưa làm.
    await page.click(`a[href="#theo-doi/${caseId}"]`);
    await expect(page.locator('.tk-steps li.ok', { hasText: 'Lập kế hoạch hỏi' })).toBeVisible();
    await expect(page.locator('.tk-steps li.ok', { hasText: 'Lấy lời khai người bị buộc tội' })).toBeVisible();
    await expect(page.locator('.tk-steps li.todo', { hasText: 'Lấy lời khai tất cả người tham gia' })).toBeVisible();
    await expect(page.locator('.tk-people')).toContainText('Chưa lấy lời khai');

    // Theo kế hoạch: trạng thái từng câu hỏi, đánh dấu thủ công.
    await page.click('[data-tab="ke-hoach"]');
    const row = page.locator(`.tk-qs > li[data-q="${q1}"]`);
    await expect(row.locator('[data-st]')).toHaveClass(/tk-st-da-ro/);
    await expect(row.locator('.tk-ans')).toContainText('300 triệu');
    const issue = page.locator('.tk-issues > li').filter({ has: page.locator('select.tk-st-chua') }).first();
    await issue.locator('summary').click();
    const other = issue.locator('.tk-qs > li').filter({ has: page.locator('select.tk-st-chua') }).first();
    const otherText = await other.getAttribute('data-q');
    await other.locator('[data-st]').selectOption('bo-qua');
    await expect(page.locator(`.tk-qs > li[data-q="${otherText}"] [data-st]`)).toHaveClass(/tk-st-bo-qua/);

    // Bảng kết quả, cảnh báo, phân tích – kết luận.
    await page.click('[data-tab="ket-qua"]');
    await expect(page.locator('.tk-res')).toContainText('chiếm đoạt 300 triệu');
    await page.click('[data-tab="canh-bao"]');
    await expect(page.locator('.tk-warns')).toContainText('Trần Thị B');
    await expect(page.locator('.tk-warns')).toContainText('mơ hồ');
    await page.click('[data-tab="phan-tich"]');
    await expect(page.locator('.tk-concl')).toContainText('Điều 353');
    await expect(page.locator('.tk-signs')).toBeVisible();

    // Báo cáo Word + bản in.
    const dl = page.waitForEvent('download');
    await page.click('[data-export]');
    expect((await dl).suggestedFilename()).toMatch(/\.docx$/);
    await page.click('[data-preview]');
    await expect(page.locator('.modal-preview .vb-table').first()).toBeVisible();
    await page.keyboard.press('Escape');

    // Cây hỏi đáp: thanh theo dõi, trạng thái câu hỏi, sơ đồ cây.
    await page.goto(`/app.html#legal/plan/${planId}`);
    await expect(page.locator('[data-track]')).toContainText('1 biên bản');
    await expect(page.locator(`.lg-q[data-text="${q1}"]`)).toHaveClass(/q-da-ro/);
    await expect(page.locator(`.lg-q[data-text="${otherText}"]`)).toHaveClass(/q-bo-qua/);
    await page.locator(`.lg-q[data-text="${q1}"] .lg-q-ans summary`).click();
    await expect(page.locator(`.lg-q[data-text="${q1}"] .lg-q-ans`)).toContainText('Nguyễn Văn A');
    await page.locator(`.lg-q[data-text="${q1}"] [data-st]`).selectOption('can-lam-ro');
    await expect(page.locator(`.lg-q[data-text="${q1}"]`)).toHaveClass(/q-can-lam-ro/);
    await page.click('[data-tab="map"]');
    await expect(page.locator('.pt-legend-st')).toBeVisible();
    await page.click('[data-pt-all]');
    await expect(page.locator('.pt-dot.tk-st-can-lam-ro').first()).toBeVisible();

    // Hồ sơ vụ án có lối vào Theo dõi và Tải biên bản.
    await page.goto(`/app.html#cases/${caseId}`);
    await expect(page.locator(`a[href="#theo-doi/${caseId}"]`)).toBeVisible();
    await page.click('[data-tab="records"]');
    await expect(page.locator('[data-upload-rec]')).toBeVisible();
    t.assertClean();
  });

  test('nút Tính năng: danh mục, tìm, ghi chú theo dõi, đề xuất, xuất Word', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#dashboard');
    await page.click('[data-features-open]');
    const items = page.locator('.fc-item');
    expect(await items.count()).toBeGreaterThan(25);
    await page.fill('[data-fc-q]', 'theo dõi báo cáo');
    await expect(page.locator('.fc-item[data-fc="theo-doi"]')).toBeVisible();
    await expect(page.locator('.fc-item[data-fc="theo-doi"]')).toContainText('Ai dùng');
    await page.locator('.fc-item[data-fc="theo-doi"] [data-fc-st]').selectOption('bo-sung');
    await page.locator('.fc-item[data-fc="theo-doi"] [data-fc-note]').fill('Thêm biểu đồ theo tháng');
    await page.locator('.fc-item[data-fc="theo-doi"] [data-fc-note]').press('Tab');
    await page.click('[data-fc-add]');
    await page.fill('#fc-ten', 'Nhắc lịch hỏi cung');
    await page.fill('#fc-lam', 'Nhắc lịch làm việc với bị can');
    await page.click('[data-fc-new] button[type="submit"]');
    await expect(page.locator('.fc-item', { hasText: 'Nhắc lịch hỏi cung' })).toBeVisible();
    const dl = page.waitForEvent('download');
    await page.click('[data-fc-export]');
    expect((await dl).suggestedFilename()).toMatch(/danh-muc-tinh-nang.*\.docx$/);
    await page.keyboard.press('Escape');

    // Mở lại: ghi chú và đề xuất còn nguyên; lọc mục đã ghi chú.
    await page.click('[data-features-open]');
    await page.check('[data-fc-noted]');
    await expect(page.locator('.fc-item[data-fc="theo-doi"] [data-fc-note]')).toHaveValue('Thêm biểu đồ theo tháng');
    await expect(page.locator('.fc-item[data-fc="theo-doi"]')).toHaveClass(/fc-st-bo-sung/);
    await page.uncheck('[data-fc-noted]');
    await page.locator('.fc-item[data-fc="theo-doi"] [data-fc-go]').click();
    await expect(page).toHaveURL(/#theo-doi$/);
    await expect(page.locator('.modal')).toHaveCount(0);
    t.assertClean();
  });
});
