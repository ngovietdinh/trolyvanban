import { expect } from '@playwright/test';

/** Theo dõi lỗi JavaScript/console trên trang; gọi `assertClean()` cuối mỗi test. */
export function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // Bỏ qua cảnh báo nội bộ của bộ nhận dạng chữ (tesseract) — không phải lỗi ứng dụng.
    if (m.type() === 'error' && !/Parameter not found/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return { errors, assertClean: () => expect(errors, errors.join('\n')).toEqual([]) };
}

/** Giả lập Anthropic Messages API (streaming SSE) để kiểm thử luồng AI mà không cần khóa thật. */
export async function mockClaude(page, replyFor) {
  const calls = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() });
    const raw = JSON.parse(req.postData() || '{}');
    // body: nội dung tin nhắn dạng chuỗi cho dễ kiểm tra (khối có cache_control được ghép lại); raw: nguyên bản.
    const body = { ...raw, messages: (raw.messages || []).map((m) => (Array.isArray(m.content) && m.content.every((p) => p.type === 'text') ? { ...m, content: m.content.map((p) => p.text).join('') } : m)) };
    calls.push({ url: req.url(), headers: req.headers(), body, raw });
    if (req.headers()['x-api-key'] === 'sk-ant-bad') {
      return route.fulfill({ status: 401, headers: { ...cors(), 'content-type': 'application/json' }, body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
    }
    const text = replyFor(body);
    if (!body.stream) {
      return route.fulfill({ status: 200, headers: { ...cors(), 'content-type': 'application/json' }, body: JSON.stringify(message(body.model, text)) });
    }
    return route.fulfill({ status: 200, headers: { ...cors(), 'content-type': 'text/event-stream' }, body: sse(body.model, text) });
  });
  return calls;
}

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
}

function message(model, text) {
  return { id: 'msg_test', type: 'message', role: 'assistant', model, content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 20 } };
}

function sse(model, text) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const chunks = text.match(/[\s\S]{1,12}/g) || [''];
  return [
    ev('message_start', { message: { ...message(model, ''), content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 1 } } }),
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }),
    ...chunks.map((c) => ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: c } })),
    ev('content_block_stop', { index: 0 }),
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 20 } }),
    ev('message_stop', {}),
  ].join('');
}

export const SUPER = { name: 'Quản trị hệ thống', email: 'gsnvbu@gmail.com', password: 'matkhau-toi-cao' };

/** Xóa dữ liệu, tạo tài khoản quản trị tối cao (toàn quyền) rồi mở màn hình cần kiểm thử. */
export async function freshApp(page, hash = '', { login = true } = {}) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/app.html' + hash);
  if (!login) return;
  await page.fill('#g-name', SUPER.name);
  await page.fill('#g-email', SUPER.email);
  await page.fill('#g-pass', SUPER.password);
  await page.click('[data-gate-form] button[type="submit"]');
  await page.waitForSelector('.shell:not([hidden])');
  if (hash) await page.goto('/app.html' + hash);
}

/** Đăng nhập bằng tài khoản có sẵn qua màn hình đăng nhập. */
export async function loginAs(page, email, password) {
  await page.goto('/app.html');
  if (await page.locator('.avatar-btn').isVisible().catch(() => false)) {
    await page.click('.avatar-btn');
    await page.click('[data-logout]');
  }
  if (await page.locator('[data-gate-mode="login"]').isVisible().catch(() => false)) await page.click('[data-gate-mode="login"]');
  await page.fill('#g-email', email);
  await page.fill('#g-pass', password);
  await page.click('[data-gate-form] button[type="submit"]');
  await page.waitForSelector('.shell:not([hidden])');
}

/** Lưu API key (mã hóa trong kho của tài khoản) qua màn hình Cài đặt. */
export async function setApiKey(page, provider, key, model) {
  await page.goto('/app.html#settings');
  await page.click(`[data-prov="${provider}"]`);
  await page.fill('[data-key]', key);
  if (model) {
    await page.selectOption('[data-model-sel]', '__custom');
    await page.fill('[data-model]', model);
  }
  await page.click('[data-save-key]');
  await page.locator('.toast', { hasText: 'Đã lưu API key' }).last().waitFor();
  await page.selectOption('[data-default-prov]', provider);
}

/** Giả lập API tương thích OpenAI (ChatGPT, Grok) và Gemini ở chế độ streaming SSE. */
export async function mockProviders(page, reply = () => 'Xin chào từ AI') {
  const calls = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  const handler = (provider) => async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData() || '{}');
    calls.push({ provider, url: req.url(), headers: req.headers(), body });
    const text = reply(provider, body);
    const chunks = text.match(/[\s\S]{1,10}/g) || [''];
    const sse =
      provider === 'gemini'
        ? chunks.map((c) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: c }], role: 'model' } }] })}\r\n\r\n`).join('')
        : chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`).join('') + 'data: [DONE]\n\n';
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: sse });
  };
  await page.route('https://api.openai.com/**', handler('openai'));
  await page.route('https://api.x.ai/**', handler('grok'));
  await page.route('https://api.groq.com/**', handler('groq'));
  await page.route('https://openrouter.ai/**', handler('openrouter'));
  await page.route('https://generativelanguage.googleapis.com/**', handler('gemini'));
  return calls;
}

/** Kế hoạch hỏi ở chế độ chọn: đưa mọi câu gợi ý vào kế hoạch (bấm “Thêm tất cả gợi ý”). */
export async function pickAll(page) {
  const b = page.locator('[data-pick-all]');
  await b.waitFor();
  await b.click();
  await expect(page.locator('[data-pick-all]')).toHaveCount(0);
}
