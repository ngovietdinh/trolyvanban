import { expect } from '@playwright/test';

/** Theo dõi lỗi JavaScript/console trên trang; gọi `assertClean()` cuối mỗi test. */
export function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return { errors, assertClean: () => expect(errors, errors.join('\n')).toEqual([]) };
}

/** Giả lập Anthropic Messages API (streaming SSE) để kiểm thử luồng AI mà không cần khóa thật. */
export async function mockClaude(page, replyFor) {
  const calls = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() });
    const body = JSON.parse(req.postData() || '{}');
    calls.push({ url: req.url(), headers: req.headers(), body });
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

export async function freshApp(page, hash = '') {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/app.html' + hash);
}
