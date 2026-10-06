import { test, expect } from '@playwright/test';
import { trackErrors, freshApp, mockClaude, setApiKey } from './helpers.mjs';

const TEXT = 'Đề nghị các phòng ban khẩn trương thôngg báo cho Ngưòi dân. Việc này rất quan trọng cho cơ quan, công ty Lancaster đã đươc mời.';

test.describe('Kiểm tra chính tả: từ ngữ, từ không có nghĩa, AI', () => {
  test('phát hiện từ không có nghĩa trên máy, chọn cách sửa, thêm tên riêng vào từ điển cá nhân', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#spell');
    await page.fill('[data-input]', TEXT + ' Ông Smithh có mặt và xác nhận viềc này.');
    await expect(page.locator('[data-filter="word"]')).toBeVisible();
    const word = (w) => page.locator('.issue', { hasText: `“${w}”` });
    await expect(word('thôngg')).toHaveCount(1);
    await expect(word('Ngưòi')).toHaveCount(1);
    await expect(word('Lancaster')).toHaveCount(0); // tên riêng không dấu không bị báo
    // Nhiều cách sửa → hiện nút cho từng cách.
    await expect(word('viềc').locator('[data-fix]')).toHaveCount(2);
    await word('viềc').locator('[data-alt="việc"]').click();
    await expect(page.locator('[data-input]')).toHaveValue(/xác nhận việc này/);
    // Từ điển cá nhân.
    await word('thôngg').locator('[data-learn]').click();
    await expect(word('thôngg')).toHaveCount(0);
    await expect(page.locator('[data-dict-n]')).toContainText('1 từ');
    await page.click('[data-dict]');
    await expect(page.locator('.dict-list li')).toHaveText(['thôngg']);
    await page.locator('.dict-list [data-rm]').click();
    await page.locator('.modal [data-close]').last().click();
    await expect(word('thôngg')).toHaveCount(1);
    // Sửa tất cả: sửa từ chắc chắn (Ngưòi → Người, thôngg → thông), giữ từ nhiều cách (đươc) để người dùng chọn.
    await page.click('[data-fixall]');
    await expect(page.locator('[data-input]')).toHaveValue(/thông báo cho Người dân/);
    await expect(word('đươc')).toHaveCount(1);
    t.assertClean();
  });

  test('chưa có AI: nút Kiểm tra bằng AI hướng dẫn vào Cài đặt', async ({ page }) => {
    await freshApp(page, '#spell');
    await page.fill('[data-input]', TEXT);
    await page.click('[data-ai-check]');
    await expect(page.locator('.toast', { hasText: 'API key' })).toBeVisible();
    await expect(page).toHaveURL(/#settings$/);
  });

  test('kiểm tra bằng AI: góp ý ngữ pháp, dùng từ, nhận xét chung; sửa góp ý AI', async ({ page }) => {
    const t = trackErrors(page);
    const calls = await mockClaude(page, () =>
      JSON.stringify({
        loi: [
          { sai: 'cho cơ quan', sua: 'đối với cơ quan', loai: 'ngu-phap', giaiThich: 'Dùng quan hệ từ “đối với” cho đúng nghĩa.' },
          { sai: 'phòng ban', sua: 'phòng, ban', loai: 'tu-ngu', giaiThich: 'Văn bản hành chính viết “phòng, ban”.' },
          { sai: 'không tồn tại', sua: 'x', loai: 'chinh-ta', giaiThich: 'bỏ' },
        ],
        nhanXet: 'Văn bản rõ ràng, còn một số lỗi chính tả và dùng từ.',
      }),
    );
    await freshApp(page, '');
    await setApiKey(page, 'anthropic', 'sk-ant-test');
    await page.goto('/app.html#spell');
    await page.fill('[data-input]', TEXT);
    await page.click('[data-ai-check]');
    await expect(page.locator('.spell-ai-note')).toContainText('Văn bản rõ ràng');
    await expect(page.locator('[data-filter="ai"]')).toHaveText('AI 2');
    expect(calls[0].body.system).toContain('biên tập viên');
    expect(calls[0].body.messages[0].content).toContain('thôngg');
    const g = page.locator('.issue', { hasText: 'đối với' });
    await expect(g.locator('.issue-type')).toContainText('Ngữ pháp');
    await expect(g.locator('.issue-type em')).toHaveText('AI');
    await g.locator('[data-fix]').click();
    await expect(page.locator('[data-input]')).toHaveValue(/rất quan trọng đối với cơ quan/);
    await expect(page.locator('[data-filter="ai"]')).toHaveText('AI 1');
    // Bỏ góp ý AI.
    await page.click('[data-ai-clear]');
    await expect(page.locator('.spell-ai-note')).toHaveCount(0);
    await expect(page.locator('[data-filter="ai"]')).toHaveCount(0);
    t.assertClean();
  });
});
