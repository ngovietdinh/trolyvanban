import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streamClaude, setAIHooks, PROVIDERS, isReasoningModel } from '../../assets/js/lib/ai.js';
import { CACHE_BREAK, splitCache, stripCache, withCache } from '../../assets/js/lib/cache-mark.js';
import { analyzePrompt } from '../../assets/js/legal/analyze.js';
import { caseMapPrompt } from '../../assets/js/legal/case-map.js';
import { isTight } from '../../assets/js/lib/ai-chunk.js';
import { groqUsageToday } from '../../assets/js/lib/groq-quota.js';

async function capture(opts, reply = 'OK', usage = null) {
  const orig = globalThis.fetch;
  let req;
  globalThis.fetch = async (url, init) => {
    req = { url: String(url), body: JSON.parse(init.body), headers: init.headers };
    const chunks = [`data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\n`];
    if (usage) chunks.push(`data: ${JSON.stringify({ choices: [], x_groq: { usage } })}\n\n`);
    return new Response(chunks.join('') + 'data: [DONE]\n\n', { status: 200 });
  };
  setAIHooks({ chain: () => [], options: () => ({ fallback: false, cache: false }) });
  try {
    await streamClaude(opts);
  } finally {
    globalThis.fetch = orig;
  }
  return req;
}

test('lời nhắc phân tích: phần cố định giống hệt giữa các phần tài liệu, tài liệu ở sau dấu cache', () => {
  const a = splitCache(analyzePrompt('Nội dung phần 1', { primary: '353', candidates: ['353'], role: 'bị can', part: [1, 3] }));
  const b = splitCache(analyzePrompt('Nội dung phần 2 khác hẳn', { primary: '353', candidates: ['353'], role: 'bị can', part: [2, 3] }));
  assert.ok(a && b);
  assert.equal(a[0], b[0], 'phần đầu giữ nguyên từng ký tự');
  assert.match(a[0], /DANH MỤC ĐIỀU LUẬT/);
  assert.match(a[1], /PHẦN 1\/3/);
  assert.match(b[1], /Nội dung phần 2/);
  const m1 = splitCache(caseMapPrompt('x', { primary: '353', part: [1, 2] }));
  const m2 = splitCache(caseMapPrompt('y', { primary: '353', part: [2, 2] }));
  assert.equal(m1[0], m2[0]);
  assert.equal(stripCache(withCache('A', 'B')), 'AB');
});

test('Groq gpt-oss: bỏ dấu cache (Groq tự cache phần đầu), mức suy nghĩ thấp; phần đọc từ cache không tính hạn mức', async () => {
  const req = await capture({ provider: 'groq', apiKey: 'gsk_1', model: 'openai/gpt-oss-120b', messages: [{ role: 'user', content: withCache('CỐ ĐỊNH', 'THAY ĐỔI') }], effort: 'medium' }, 'OK', { total_tokens: 900, prompt_tokens_details: { cached_tokens: 600 } });
  assert.equal(req.body.messages[1].content, 'CỐ ĐỊNHTHAY ĐỔI');
  assert.ok(!JSON.stringify(req.body).includes(CACHE_BREAK));
  assert.equal(req.body.reasoning_effort, 'medium');
  assert.ok(groqUsageToday().cached >= 600, 'ghi nhận token đọc từ cache');
  const plain = await capture({ provider: 'groq', apiKey: 'gsk_1', model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'Chào' }] });
  assert.equal(plain.body.reasoning_effort, undefined, 'mô hình không suy luận thì không gửi');
});

test('OpenRouter: địa chỉ, mô hình mặc định gpt-oss-120b, mức suy nghĩ, thống kê usage; Claude/Gemini qua OpenRouter có cache_control', async () => {
  assert.equal(PROVIDERS.openrouter.base, 'https://openrouter.ai/api/v1');
  assert.ok(PROVIDERS.openrouter.keyPrefix.test('sk-or-v1-abc'));
  const r1 = await capture({ provider: 'openrouter', apiKey: 'sk-or-1', messages: [{ role: 'user', content: withCache('CỐ ĐỊNH', 'MỚI') }] });
  assert.equal(r1.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(r1.headers.authorization, 'Bearer sk-or-1');
  assert.equal(r1.body.model, 'openai/gpt-oss-120b');
  assert.deepEqual(r1.body.reasoning, { effort: 'low' });
  assert.deepEqual(r1.body.usage, { include: true });
  assert.equal(r1.body.messages[1].content, 'CỐ ĐỊNHMỚI');
  const r2 = await capture({ provider: 'openrouter', apiKey: 'sk-or-1', model: 'anthropic/claude-sonnet-4.5', messages: [{ role: 'user', content: withCache('CỐ ĐỊNH', 'MỚI') }] });
  const parts = r2.body.messages[1].content;
  assert.deepEqual(parts[0], { type: 'text', text: 'CỐ ĐỊNH', cache_control: { type: 'ephemeral' } });
  assert.deepEqual(parts[1], { type: 'text', text: 'MỚI' });
  assert.equal(r2.body.reasoning, undefined);
  // Hội thoại: lượt trả lời gần nhất được đánh dấu cache.
  const r3 = await capture({ provider: 'openrouter', apiKey: 'sk-or-1', model: 'anthropic/claude-sonnet-4.5', cacheHistory: true, messages: [{ role: 'user', content: 'Hỏi 1' }, { role: 'assistant', content: 'Đáp 1' }, { role: 'user', content: 'Hỏi 2' }] });
  assert.deepEqual(r3.body.messages[2].content, [{ type: 'text', text: 'Đáp 1', cache_control: { type: 'ephemeral' } }]);
  assert.equal(r3.body.messages[3].content, 'Hỏi 2');
});

test('mô hình suy luận và mô hình miễn phí OpenRouter', () => {
  assert.equal(isReasoningModel('groq', 'openai/gpt-oss-120b'), true);
  assert.equal(isReasoningModel('openai', 'gpt-4o'), false);
  assert.equal(isReasoningModel('openai', 'o4-mini'), true);
  assert.equal(isTight({ provider: 'openrouter', model: 'openai/gpt-oss-20b:free' }), true);
  assert.equal(isTight({ provider: 'openrouter', model: 'openai/gpt-oss-120b' }), false);
});
