import { test, expect } from '@playwright/test';
import { trackErrors, freshApp, mockClaude, setApiKey, loginAs } from './helpers.mjs';

const BASE = 'http://localhost:11434';

/** Giả lập máy chủ AI trên máy (Ollama, giao thức tương thích OpenAI). */
async function mockLocal(page, { reply = () => 'Xin chào từ AI trên máy', fail = false } = {}) {
  const calls = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
  await page.route(`${BASE}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    if (url.pathname === '/v1/models') {
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ object: 'list', data: [{ id: 'qwen2.5:7b' }, { id: 'llama3.2:3b' }, { id: 'nomic-embed-text:latest' }] }) });
    }
    const body = JSON.parse(req.postData() || '{}');
    calls.push({ url: req.url(), headers: req.headers(), body });
    if (fail) return route.fulfill({ status: 500, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ error: { message: 'model runner crashed' } }) });
    const chunks = reply(body).match(/[\s\S]{1,8}/g) || [''];
    const sse = chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`).join('') + 'data: [DONE]\n\n';
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: sse });
  });
  return calls;
}

/** Cấu hình AI trên máy qua màn hình Cài đặt: chọn Ollama → tải danh sách mô hình → kiểm tra kết nối. */
async function connectLocal(page) {
  await page.goto('/app.html#settings');
  const form = page.locator('[data-local-form]');
  await form.locator('[data-local-preset="ollama"]').click();
  await form.locator('[data-local-list]').click();
  await expect(page.locator('.toast', { hasText: 'Đã tìm thấy 2 mô hình' }).last()).toBeVisible();
  await page.selectOption('[data-local-model-sel]', 'qwen2.5:7b');
  await form.locator('[data-local-test]').click();
  await expect(page.locator('.toast', { hasText: 'Kết nối AI trên máy thành công' }).last()).toBeVisible();
}

const aiOf = (page, scope) =>
  page.evaluate(async (s) => {
    const { ctx } = await import('/assets/js/app.js');
    const a = ctx.ai(s);
    return a && { provider: a.provider, model: a.model, local: !!a.local };
  }, scope);

test.describe('AI chạy trên máy (Ollama, LM Studio…)', () => {
  test('kết nối Ollama: tải danh sách mô hình (bỏ mô hình nhúng), kiểm tra, trò chuyện không cần API key', async ({ page }) => {
    const t = trackErrors(page);
    const calls = await mockLocal(page, { reply: () => 'Chào anh, tôi là AI chạy trên máy.' });
    await freshApp(page, '#settings');
    await connectLocal(page);
    const opts = await page.locator('[data-local-model-sel] option').allTextContents();
    expect(opts).toContain('llama3.2:3b');
    expect(opts.join()).not.toContain('nomic-embed');
    await expect(page.locator('[data-ai-state]')).toHaveText('Đang dùng AI trên máy');
    await expect(page.locator('[data-default-prov]')).toHaveValue('local');

    await page.goto('/app.html#chat');
    await expect(page.locator('.composer-note')).toContainText('AI trên máy · qwen2.5:7b');
    await page.fill('[data-input]', 'Xin chào');
    await page.click('[data-send]');
    await expect(page.locator('.msg.bot .msg-content').last()).toContainText('AI chạy trên máy');
    const last = calls.at(-1);
    expect(last.url).toBe(`${BASE}/v1/chat/completions`);
    expect(last.body.model).toBe('qwen2.5:7b');
    expect(last.headers.authorization).toBeUndefined();
    t.assertClean();
  });

  test('AI trên máy lỗi: không tự chuyển sang dịch vụ trực tuyến (dữ liệu không rời khỏi máy)', async ({ page }) => {
    const claude = await mockClaude(page, () => 'Trả lời từ Claude');
    await mockLocal(page, { fail: true });
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    await connectLocal(page).catch(() => {}); // kiểm tra kết nối thất bại vì máy chủ trả lỗi 500
    await page.evaluate(async () => {
      const { ctx } = await import('/assets/js/app.js');
      await ctx.saveAiProviders({ ...ctx.aiProviders(), local: { base: 'http://localhost:11434/v1', model: 'qwen2.5:7b' } });
      ctx.saveSettings({ aiProvider: 'local', aiFallback: true });
    });
    const before = claude.length;
    await page.goto('/app.html#chat');
    await page.fill('[data-input]', 'Tóm tắt lời khai');
    await page.click('[data-send]');
    await expect(page.locator('.toast, .msg.bot').filter({ hasText: /AI trên máy báo lỗi/ }).first()).toBeVisible({ timeout: 15000 });
    expect(claude.length).toBe(before);
  });

  test('phân quyền: Tố tụng dùng được AI trên máy khi chưa có quyền AI trực tuyến; địa chỉ ngoài mạng nội bộ thì không', async ({ page }) => {
    await freshApp(page);
    await page.evaluate(async () => {
      const { accounts } = await import('/assets/js/lib/accounts.js');
      await accounts.createUser({ name: 'Điều tra viên', email: 'dtv@cand.vn', password: 'matkhau-123', role: 'investigator' });
      await accounts.createUser({ name: 'Văn thư', email: 'vt@cand.vn', password: 'matkhau-123', role: 'user', perms: { ai: false } });
    });
    const setLocal = (base) =>
      page.evaluate(async (b) => {
        const { ctx } = await import('/assets/js/app.js');
        await ctx.saveAiProviders({ local: { base: b, model: 'qwen2.5:7b' } });
      }, base);

    // Điều tra viên: có Tố tụng, không có “AI trực tuyến trong Tố tụng”.
    await loginAs(page, 'dtv@cand.vn', 'matkhau-123');
    expect(await aiOf(page, 'legal')).toBeNull();
    await setLocal('http://localhost:11434/v1');
    expect(await aiOf(page, 'legal')).toEqual({ provider: 'local', model: 'qwen2.5:7b', local: true });
    await setLocal('http://192.168.1.20:11434');
    expect((await aiOf(page, 'legal'))?.provider).toBe('local');
    await setLocal('https://ai.example.com/v1');
    expect(await aiOf(page, 'legal')).toBeNull(); // máy chủ ngoài Internet = trực tuyến
    expect((await aiOf(page, 'docs'))?.provider).toBe('local'); // văn bản: có quyền AI trực tuyến

    // Văn thư bị tắt AI trực tuyến: vẫn dùng được AI trên máy cho văn bản, không có Tố tụng.
    await loginAs(page, 'vt@cand.vn', 'matkhau-123');
    await page.goto('/app.html#settings');
    await expect(page.locator('[data-local-form] [data-local-preset="ollama"]')).toBeVisible();
    await setLocal('http://localhost:1234/v1');
    expect((await aiOf(page, 'docs'))?.provider).toBe('local');
    expect(await aiOf(page, 'legal')).toBeNull();
    await setLocal('https://ai.example.com/v1');
    expect(await aiOf(page, 'docs')).toBeNull();
  });
});

test.describe('Mất mạng → tự chuyển sang AI trên máy', () => {
  const setup = async (page) => {
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    await page.evaluate(async () => {
      const { ctx } = await import('/assets/js/app.js');
      await ctx.saveAiProviders({ ...ctx.aiProviders(), local: { base: 'http://localhost:11434/v1', model: 'qwen2.5:7b' } });
      ctx.saveSettings({ aiProvider: 'anthropic' });
    });
  };

  test('trình duyệt báo mất mạng: dùng ngay AI trên máy, không gọi Claude (kể cả khi tắt tự chuyển)', async ({ page }) => {
    const claude = await mockClaude(page, () => 'Trả lời từ Claude');
    const local = await mockLocal(page, { reply: () => 'Trả lời khi mất mạng.' });
    await setup(page);
    await page.evaluate(async () => (await import('/assets/js/app.js')).ctx.saveSettings({ aiFallback: false }));
    expect((await aiOf(page, 'docs'))?.provider).toBe('anthropic');
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false }));
    await page.goto('/app.html#chat');
    await page.reload();
    await expect(page.locator('[data-ai-status] strong')).toHaveText('Mất mạng · AI trên máy');
    expect((await aiOf(page, 'docs'))?.provider).toBe('local');
    const before = claude.length;
    await page.fill('[data-input]', 'Xin chào bạn');
    await page.click('[data-send]');
    await expect(page.locator('.msg.bot .msg-content').last()).toContainText('Trả lời khi mất mạng');
    expect(claude.length).toBe(before);
    expect(local.length).toBe(1);
  });

  test('gọi dịch vụ trực tuyến bị lỗi mạng: chuyển ngay sang AI trên máy, không chờ thử lại', async ({ page }) => {
    let claudeTries = 0;
    await page.route('https://api.anthropic.com/**', (route) => {
      if (route.request().method() !== 'OPTIONS') claudeTries++;
      return route.abort('internetdisconnected');
    });
    await mockLocal(page, { reply: () => 'AI trên máy trả lời thay.' });
    await setup(page);
    await page.goto('/app.html#chat');
    const t0 = Date.now();
    await page.fill('[data-input]', 'Xin chào');
    await page.click('[data-send]');
    await expect(page.locator('.msg.bot .msg-content').last()).toContainText('AI trên máy trả lời thay');
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(claudeTries).toBe(1);
    await expect(page.locator('.toast', { hasText: 'tự chuyển sang AI chạy trên máy' }).first()).toBeVisible();
  });
});

test('BionicGPT: bắt buộc khóa truy cập, gửi khóa khi tải mô hình và trò chuyện', async ({ page }) => {
  const t = trackErrors(page);
  const BIONIC = 'http://192.168.1.10:3000';
  const seen = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
  await page.route(`${BIONIC}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    seen.push({ url: req.url(), auth: req.headers().authorization });
    if (req.headers().authorization !== 'Bearer bn-khoa-123') return route.fulfill({ status: 401, headers: cors, body: '{"error":"unauthorized"}' });
    if (req.url().endsWith('/v1/models')) return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ data: [{ id: 'llama-3-70b' }, { id: 'text-embedding-ada-002' }] }) });
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: `data: ${JSON.stringify({ choices: [{ delta: { content: 'Trả lời từ BionicGPT của cơ quan.' } }] })}\n\ndata: [DONE]\n\n` });
  });
  await freshApp(page, '#settings');
  const form = page.locator('[data-local-form]');
  await form.locator('[data-local-preset="bionic"]').click();
  await expect(form.locator('details.local-more')).toHaveAttribute('open', '');
  await form.locator('[data-local-base]').fill(`${BIONIC}/v1`);
  await form.locator('[data-local-list]').click();
  await expect(page.locator('.toast', { hasText: 'BionicGPT cần khóa truy cập' }).last()).toBeVisible();
  expect(seen).toHaveLength(0);
  await form.locator('[data-local-key]').fill('bn-khoa-123');
  await form.locator('[data-local-list]').click();
  await expect(page.locator('.toast', { hasText: 'Đã tìm thấy 1 mô hình' }).last()).toBeVisible();
  await form.locator('[data-local-test]').click();
  await expect(page.locator('.toast', { hasText: 'Kết nối AI trên máy thành công' }).last()).toBeVisible();
  expect((await aiOf(page, 'legal'))?.provider).toBe('local'); // máy chủ nội bộ → dùng được trong Tố tụng
  await page.goto('/app.html#chat');
  await page.fill('[data-input]', 'Xin chào');
  await page.click('[data-send]');
  await expect(page.locator('.msg.bot .msg-content').last()).toContainText('BionicGPT của cơ quan');
  expect(seen.every((x) => x.auth === 'Bearer bn-khoa-123')).toBe(true);
  t.assertClean();
});
