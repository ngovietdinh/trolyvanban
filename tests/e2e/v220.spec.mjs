import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

test.describe('Câu hỏi theo trình tự điều tra, lời khai lần tiếp theo', () => {
  test('cây hỏi đáp: câu hỏi có bước hỏi, có phần chốt lại cuối buổi', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal/353');
    const hv = page.locator('[data-issue^="hv-"]').first();
    await expect(hv.locator('.lg-q').first().locator('.q-buoc')).toHaveText('Tự trình bày');
    await expect(hv.locator('.q-buoc', { hasText: 'Kiểm chứng' }).first()).toBeAttached();
    await expect(page.locator('[data-issue="ket-thuc"]')).toContainText('Chốt lại, xác nhận lời khai');
    t.assertClean();
  });

  test('ghi lời khai lần 2: câu hỏi làm rõ từ biên bản lần 1 (mơ hồ, tiền, người), có lý do từng câu', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#cases');
    await page.click('[data-new]');
    await page.fill('#c-ten', 'Vụ tham ô tại Ban QLDA');
    await page.fill('#c-td', '353');
    await page.click('[data-f] button[type="submit"]');
    await expect(page).toHaveURL(/#cases\/.+/);
    const caseId = page.url().split('#cases/')[1];
    await page.click('[data-add-person]');
    await page.selectOption('#p-role', 'bi-can');
    await page.fill('#p-hoTen', 'Nguyễn Văn A');
    await page.click('[data-f] button[type="submit"]');

    // Lần 1: tải biên bản lên.
    await page.click('[data-tab="records"]');
    await page.click('[data-upload-rec]');
    await page.fill('[data-ru-text]', 'Họ tên: Nguyễn Văn A\nHỏi: Anh trình bày diễn biến việc lập chứng từ chi khống?\nĐáp: Tôi lập chứng từ chi khống rút 300 triệu đồng rồi đưa cho ông Trần Văn Bình.\nHỏi: Việc này bắt đầu từ khi nào, thực hiện bao nhiêu lần?\nĐáp: Tôi không nhớ.');
    await page.click('[data-ru-read]');
    await expect(page.locator('#ru-person option:checked')).toContainText('Nguyễn Văn A');
    await page.click('[data-ru-save]');
    await expect(page.locator('.doc-item', { hasText: 'lần 1' })).toBeVisible();

    // Hồ sơ → Ghi lời khai: mặc định chọn “lần tiếp theo”.
    await page.click('[data-tab="persons"]');
    await page.locator('[data-pid] [data-interview]').click();
    await expect(page.locator('#si-plan option:checked')).toContainText('Lời khai lần 2');
    await page.click('.modal [data-f] button[type="submit"]');
    const ns = page.locator('.ns-modal');
    await expect(ns.locator('.modal-title')).toContainText('Ghi lời khai lần 2: Nguyễn Văn A');
    await expect(ns.locator('[data-g="tiep-noi"]')).toBeVisible();
    await ns.locator('[data-g="lam-ro"] summary').click();
    const lamRo = ns.locator('[data-g="lam-ro"]');
    await expect(lamRo).toContainText('trả lời: “Tôi không nhớ”');
    await expect(lamRo).toContainText('làm rõ khoản 300 triệu');
    await expect(lamRo).toContainText('Trần Văn Bình');
    await expect(lamRo.locator('small').first()).toContainText('Câu trả lời mơ hồ');
    await expect(ns.locator('[data-g="ket-thuc"]')).toBeVisible();
    // Bỏ một nhóm, bắt đầu.
    await ns.locator('[data-g-on="dau-hieu"]').uncheck();
    await ns.locator('[data-ns-start]').click();
    await expect(page).toHaveURL(/#interview\//);
    await expect(page.locator('[data-whosub]')).toContainText('Lần 2');
    await expect(page.locator('.iv-issue').first()).toContainText('Xác nhận lời khai các lần trước');
    await expect(page.locator('.iv-pq-why').first()).toBeVisible();
    expect(await page.locator('.iv-issue[data-issue="dau-hieu"]').count()).toBe(0);
    expect(await page.locator('.iv-qa').count()).toBeGreaterThan(5);

    // Từ màn hình ghi lời khai: nút lần tiếp theo → lần 3 (sau biên bản lần 2 đang ghi).
    await page.click('[data-next]');
    await expect(page.locator('.ns-modal .modal-title')).toContainText('lần 3');
    await page.keyboard.press('Escape');

    // Theo dõi: nút lần tiếp theo cho người đã có lời khai.
    await page.goto(`/app.html#theo-doi/${caseId}`);
    await page.click('[data-next-person]');
    await expect(page.locator('.ns-modal')).toBeVisible();
    t.assertClean();
  });
});
