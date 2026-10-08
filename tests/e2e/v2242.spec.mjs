import { test, expect } from '@playwright/test';
import { trackErrors, freshApp, mockClaude, mockProviders, setApiKey } from './helpers.mjs';

const CAU = 'Ngày 05/3/2025 ông Nguyễn Văn An lập chứng từ chi khống để rút tiền chiếm đoạt 300 triệu đồng của Ban quản lý dự án huyện. ';

test.describe('v2.24.2 — tiết kiệm token (prompt caching), OpenRouter', () => {
  test('Claude: sơ đồ vụ việc nhiều phần — phần cố định gắn cache_control, giống hệt giữa các phần', async ({ page }) => {
    const t = trackErrors(page);
    const calls = await mockClaude(page, () => JSON.stringify({ tomTat: 'A', banChat: [], nguoi: [], hanhVi: [], quanHe: [], moc: [] }));
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    await page.goto('/app.html#so-do');
    await page.click('[data-src="files"]');
    // Lặp câu có số liệu khác nhau để bộ lọc không gộp trùng → nhiều phần.
    await page.fill('[data-cm-text]', Array.from({ length: 220 }, (_, i) => CAU.replace('300', String(100 + i))).join(''));
    await page.check('[data-cm-ai]');
    await page.click('[data-cm-run]');
    await expect(page.locator('[data-result]')).toContainText('AI kết hợp');
    await expect.poll(() => calls.length).toBeGreaterThan(1);
    const firsts = calls.map((c) => c.raw.messages[0].content);
    for (const parts of firsts) {
      expect(Array.isArray(parts)).toBe(true);
      expect(parts[0].cache_control).toEqual({ type: 'ephemeral' });
    }
    expect(new Set(firsts.map((p) => p[0].text)).size).toBe(1);
    expect(firsts[0][1].text).toContain('PHẦN 1/');
    t.assertClean();
  });

  test('OpenRouter: nhập key, mặc định gpt-oss-120b, trợ lý AI gửi qua openrouter.ai với mức suy nghĩ thấp', async ({ page }) => {
    const t = trackErrors(page);
    const calls = await mockProviders(page, () => 'Xin chào từ OpenRouter');
    await freshApp(page);
    await setApiKey(page, 'openrouter', 'sk-or-v1-test-1234567890');
    await page.click('[data-prov="openrouter"]');
    await expect(page.locator('[data-model-sel]')).toHaveValue('openai/gpt-oss-120b');
    await page.goto('/app.html#chat');
    await page.fill('[data-input]', 'Chào bạn');
    await page.keyboard.press('Enter');
    await expect(page.locator('.msg').last()).toContainText('Xin chào từ OpenRouter');
    const c = calls.find((x) => x.provider === 'openrouter');
    expect(c.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(c.body.model).toBe('openai/gpt-oss-120b');
    expect(c.body.reasoning).toEqual({ effort: 'low' });
    t.assertClean();
  });
});
