import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { trackErrors, mockClaude, mockProviders, freshApp, setApiKey } from './helpers.mjs';
import { docxToText } from '../../assets/js/lib/docx.js';

test.describe('Cài đặt AI: chọn mô hình, tự chuyển nhà cung cấp, nhật ký', () => {
  test('chọn mô hình từ danh sách, tải danh sách mô hình của tài khoản, lưu ngay', async ({ page }) => {
    const t = trackErrors(page);
    await page.route('https://api.openai.com/v1/models', (route) =>
      route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify({ data: [{ id: 'gpt-5' }, { id: 'gpt-4o' }, { id: 'whisper-1' }, { id: 'gpt-4o-realtime-preview' }] }) }),
    );
    await freshApp(page);
    await setApiKey(page, 'openai', 'sk-test-openai');
    const sel = page.locator('[data-model-sel]');
    await expect(sel).toHaveValue('gpt-4o');
    await sel.selectOption('gpt-4.1-mini');
    await expect(page.locator('.toast').last()).toContainText('Đã chọn mô hình gpt-4.1-mini');
    await page.locator('[data-list-models]').click();
    await expect(page.locator('.toast').last()).toContainText('Đã tải 2 mô hình');
    await expect(sel.locator('option[value="gpt-5"]')).toHaveCount(1);
    await expect(sel.locator('option[value="whisper-1"]')).toHaveCount(0);
    await sel.selectOption('gpt-5');
    await page.reload();
    await page.click('[data-prov="openai"]');
    await expect(page.locator('[data-model-sel]')).toHaveValue('gpt-5');
    // Tự nhập mô hình khác
    await page.locator('[data-model-sel]').selectOption('__custom');
    await page.fill('[data-model]', 'gpt-5-mini-2026');
    await page.locator('[data-model]').press('Enter');
    await page.locator('[data-model]').blur();
    await expect(page.locator('.toast').last()).toContainText('gpt-5-mini-2026');
    t.assertClean();
  });

  test('nhà cung cấp mặc định lỗi → tự chuyển sang nhà cung cấp khác, báo rõ, ghi nhật ký', async ({ page }) => {
    await mockClaude(page, () => 'không dùng');
    const calls = await mockProviders(page, () => '- Ý chính từ ChatGPT');
    await freshApp(page);
    await setApiKey(page, 'openai', 'sk-test-openai');
    await setApiKey(page, 'anthropic', 'sk-ant-bad'); // khóa Claude sai → 401
    await page.goto('/app.html#summary');
    await page.locator('[data-sample]').click();
    await page.locator('[data-ai]').click();
    await expect(page.locator('[data-ai-out]')).toContainText('Ý chính từ ChatGPT');
    await expect(page.locator('.toast', { hasText: 'tự chuyển sang ChatGPT' })).toBeVisible();
    expect(calls.filter((c) => c.provider === 'openai').length).toBe(1);
    await page.goto('/app.html#settings');
    await expect(page.locator('.ai-log')).toContainText('Claude');
    await expect(page.locator('.ai-log')).toContainText('chuyển sang ChatGPT');
  });

  test('Gemini 503 (quá tải): tự thử lại rồi chuyển mô hình Gemini dự phòng, vẫn ra kết quả', async ({ page }) => {
    const urls = [];
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    await page.route('https://generativelanguage.googleapis.com/**', (route) => {
      const url = route.request().url();
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      urls.push(url);
      if (url.includes('gemini-2.5-flash:')) return route.fulfill({ status: 503, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":{"code":503,"message":"The model is overloaded. Please try again later.","status":"UNAVAILABLE"}}' });
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: '- Ý chính từ Gemini dự phòng' }] } }] })}\r\n\r\n` });
    });
    await freshApp(page);
    await setApiKey(page, 'gemini', 'AIza-test');
    await page.goto('/app.html#summary');
    await page.locator('[data-sample]').click();
    await page.locator('[data-ai]').click();
    await expect(page.locator('[data-ai-out]')).toContainText('Ý chính từ Gemini dự phòng', { timeout: 20000 });
    expect(urls.filter((u) => u.includes('gemini-2.5-flash:')).length).toBe(3);
    expect(urls.some((u) => u.includes('gemini-2.0-flash:'))).toBe(true);
    await page.goto('/app.html#settings');
    await expect(page.locator('.ai-log')).toContainText('quá tải (503');
    await expect(page.locator('.ai-log')).toContainText('thử gemini-2.0-flash');
  });

  test('tắt tự chuyển → báo lỗi rõ ràng, không im lặng', async ({ page }) => {
    await mockClaude(page, () => 'x');
    await mockProviders(page);
    await freshApp(page);
    await setApiKey(page, 'openai', 'sk-test-openai');
    await setApiKey(page, 'anthropic', 'sk-ant-bad');
    await page.locator('[data-ai-fallback]').uncheck();
    await page.goto('/app.html#summary');
    await page.locator('[data-sample]').click();
    await page.locator('[data-ai]').click();
    await expect(page.locator('[data-ai-out]')).toContainText('API key không hợp lệ');
  });
});

test.describe('Ghi lời khai: dán & chuyển đổi, tự học, ghi nhớ', () => {
  async function startInterview(page) {
    await page.goto('/app.html#legal/353');
    await page.locator('[data-start]').click();
    await page.locator('.modal [name="hoTen"]').fill('Nguyễn Văn Bình');
    await page.locator('.modal [name="prefill"]').check();
    await page.locator('.modal button[type="submit"]').click();
    await expect(page.locator('.iv-qa.pending').first()).toBeVisible();
  }

  test('dán đoạn trả lời → ghép vào câu hỏi chưa trả lời; dán Hỏi/Trả lời → thêm lượt; xuất Word', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page);
    await startInterview(page);
    const pending = await page.locator('.iv-qa.pending').count();
    await page.locator('[data-paste]').click();
    const modal = page.locator('.modal');
    await modal.locator('[data-ps-text]').fill('em tên là nguyễn văn bình sinh năm 1980\n\nem làm kế toán ở ban quản lý dự án');
    await modal.locator('[data-ps-run]').click();
    await expect(modal.locator('.ps-list li')).toHaveCount(2);
    await expect(modal.locator('.ps-list li').first()).toContainText('Điền vào lượt 1');
    await expect(modal.locator('.ps-list li').first()).toContainText('Tôi tên là');
    await modal.locator('[data-ps-apply]').click();
    await expect(page.locator('.iv-qa.pending')).toHaveCount(pending - 2);
    await page.locator('[data-paste]').click();
    await modal.locator('[data-ps-text]').fill('Hỏi: Anh có nhận tiền của nhà thầu không?\nTrả lời: Tôi có nhận 50 triệu đồng.');
    await modal.locator('[data-ps-run]').click();
    await expect(modal.locator('.ps-list li')).toContainText('Thêm lượt mới');
    await modal.locator('[data-ps-apply]').click();
    await expect(page.locator('.iv-qa').last()).toContainText('Tôi có nhận 50 triệu đồng.');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-export]').click()]);
    const text = await docxToText(readFileSync(await dl.path()));
    expect(text).toMatch(/Đáp: Tôi tên là/);
    expect(text).toContain('Hỏi: Anh có nhận tiền của nhà thầu không?');
    t.assertClean();
  });

  test('chuyển đổi bằng AI (Claude giả lập)', async ({ page }) => {
    await mockClaude(page, () => '{"qa":[{"q":"Anh cho biết nhân thân?","a":"Tôi là Nguyễn Văn Bình, sinh năm 1980."}]}');
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test');
    await startInterview(page);
    await page.locator('[data-paste]').click();
    await page.locator('.modal [data-ps-text]').fill('bình, 1980');
    await page.locator('.modal [data-ps-ai]').click();
    await expect(page.locator('.modal .ps-list li')).toContainText('Tôi là Nguyễn Văn Bình, sinh năm 1980.');
  });

  test('câu hỏi đã hỏi được tự học, lần sau xuất hiện trong cây với nhãn “Đã học”', async ({ page }) => {
    await freshApp(page);
    await page.goto('/app.html#legal/353');
    await page.locator('[data-start]').click();
    await page.locator('.modal [name="hoTen"]').fill('Nguyễn Văn Bình');
    await page.locator('.modal button[type="submit"]').click();
    await page.locator('details[data-issue="dong-pham"] summary').click();
    await page.locator('details[data-issue="dong-pham"] .iv-pq').first().click();
    await page.fill('[data-q]', 'Ai là người giữ sổ quỹ đen của ban quản lý?');
    await page.fill('[data-a]', 'Bà Lan kế toán trưởng giữ.');
    await page.keyboard.press('Control+Enter');
    await page.goto('/app.html#legal/353');
    const issue = page.locator('[data-issue="dong-pham"]');
    await issue.locator('summary').click();
    const learned = issue.locator('.lg-q', { hasText: 'sổ quỹ đen của ban quản lý' });
    await expect(learned).toHaveCount(1);
    await expect(learned).toContainText('Đã học');
    await page.goto('/app.html#settings');
    await expect(page.locator('[data-mem-learn]')).not.toHaveText('0');
  });

  test('gợi ý AI được ghi nhớ: lần sau không gửi lại, có thể “Hỏi lại AI”', async ({ page }) => {
    const calls = await mockClaude(page, () => '{"cauHoi":["Ai ký duyệt chứng từ chi khống?"]}');
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test');
    await page.goto('/app.html#legal/353');
    const issue = page.locator('.lg-issue').nth(1);
    await issue.locator('[data-issue-ai]').click();
    await expect(issue.locator('.lg-sugg li')).toHaveCount(1);
    const n = calls.length;
    await issue.locator('[data-sugg-close]').click();
    await issue.locator('[data-issue-ai]').click();
    await expect(issue.locator('.lg-sugg')).toContainText('Kết quả đã ghi nhớ');
    expect(calls.length).toBe(n);
    await issue.locator('[data-sugg-fresh]').click();
    await expect(issue.locator('.lg-sugg li')).toHaveCount(1);
    expect(calls.length).toBe(n + 1);
  });
});
