import { test, expect } from '@playwright/test';
import { trackErrors, freshApp, mockProviders, setApiKey } from './helpers.mjs';

const CAU = 'Ngày 05/3/2025 ông Nguyễn Văn An lập chứng từ chi khống để rút tiền chiếm đoạt 300 triệu đồng của Ban quản lý dự án huyện. ';

test.describe('v2.24.1 — Groq gói miễn phí', () => {
  test('canh hạn mức: tóm tắt văn bản dài theo từng phần, max_tokens vừa đủ, thống kê token trong ngày', async ({ page }) => {
    const t = trackErrors(page);
    const calls = await mockProviders(page, (p, body) => (JSON.stringify(body.messages).includes('ĐÂY LÀ PHẦN') || JSON.stringify(body.messages).includes('Đây là phần') ? '- Ý chính của phần.' : '- Tổng hợp: ông An chi khống 300 triệu đồng.'));
    await freshApp(page);
    await setApiKey(page, 'groq', 'gsk_test_1234567890');
    // Khối hạn mức Groq trong Cài đặt.
    await page.click('[data-prov="groq"]');
    const q = page.locator('.groq-quota');
    await expect(q).toBeVisible();
    await expect(q.locator('#gq-tpm')).toHaveValue('8000');
    await expect(q.locator('#gq-tpd')).toHaveValue('200000');
    // Sửa hạn mức (nới hạn mức phút để kiểm thử không phải chờ đủ 1 phút).
    await page.locator('#gq-tpm').fill('60000');
    await page.locator('#gq-tpm').blur();
    await expect(page.locator('.toast').last()).toContainText('Đã lưu hạn mức Groq');
    await expect(page.locator('#gq-tpm')).toHaveValue('60000');
    // Văn bản ~36.000 ký tự: Groq không gửi một khối mà tóm tắt từng phần.
    await page.goto('/app.html#summary');
    await page.locator('[data-input]').fill(CAU.repeat(300));
    await page.click('[data-ai]');
    await expect(page.locator('[data-ai-out]')).toContainText('Tổng hợp');
    const groq = calls.filter((c) => c.provider === 'groq');
    expect(groq.length).toBeGreaterThan(2);
    for (const c of groq) {
      const chars = JSON.stringify(c.body.messages).length;
      expect(chars).toBeLessThan(20000);
      expect(c.body.max_tokens).toBeLessThanOrEqual(4096);
    }
    // Phần tóm tắt từng phần chỉ xin câu trả lời ngắn.
    expect(groq[0].body.max_tokens).toBeLessThanOrEqual(900);
    // Thống kê token hôm nay.
    await page.goto('/app.html#settings');
    await page.click('[data-prov="groq"]');
    await expect(page.locator('[data-groq-use]')).not.toContainText('khoảng 0 token');
    await page.click('[data-groq-reset]');
    await expect(page.locator('#gq-tpm')).toHaveValue('8000');
    t.assertClean();
  });

  test('Groq hết hạn mức phút (429 + Retry-After): chờ đúng số giây rồi gửi lại', async ({ page }) => {
    const t = trackErrors(page);
    let n = 0;
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'retry-after' };
    await page.route('https://api.groq.com/**', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      n++;
      if (n === 1) return route.fulfill({ status: 429, headers: { ...cors, 'retry-after': '2', 'content-type': 'application/json' }, body: JSON.stringify({ error: { message: 'Rate limit reached for model on tokens per minute (TPM): Limit 8000', type: 'tokens', code: 'rate_limit_exceeded' } }) });
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: `data: ${JSON.stringify({ choices: [{ delta: { content: '- Đã tóm tắt sau khi chờ.' } }] })}\n\ndata: [DONE]\n\n` });
    });
    await freshApp(page);
    await setApiKey(page, 'groq', 'gsk_test_1234567890');
    await page.goto('/app.html#summary');
    await page.locator('[data-input]').fill(CAU.repeat(3));
    const t0 = Date.now();
    await page.click('[data-ai]');
    await expect(page.locator('.toast', { hasText: 'sau 2 giây' }).first()).toBeVisible();
    await expect(page.locator('[data-ai-out]')).toContainText('Đã tóm tắt sau khi chờ');
    expect(Date.now() - t0).toBeGreaterThan(1900);
    expect(n).toBe(2);
    // Trình duyệt tự ghi lỗi tải tài nguyên cho phản hồi 429 giả lập — bỏ qua dòng đó.
    expect(t.errors.filter((e) => !/status of 429/.test(e))).toEqual([]);
  });
});
