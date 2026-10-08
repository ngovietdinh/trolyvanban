import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streamClaude, stitch, extractJson, CONTINUE_PROMPT } from '../../assets/js/lib/ai.js';

const sse = (chunks, finish) =>
  new Response(
    [...chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`), `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: finish }] })}\n\n`, 'data: [DONE]\n\n'].join(''),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );

test('câu trả lời bị cắt (chạm giới hạn độ dài) → tự viết tiếp và ghép đủ', async () => {
  const bodies = [];
  const replies = [sse(['{"hanhVi":[{"ten":"A"},', '{"ten":"B"'], 'length'), sse([',"dieu":"353"},{"ten":"C"}]}'], 'stop')];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return replies.shift();
  };
  try {
    let shown = '';
    const out = await streamClaude({ provider: 'groq', apiKey: 'gsk_test', model: 'm', messages: [{ role: 'user', content: 'liệt kê' }], onText: (d, all) => (shown = all) });
    assert.equal(bodies.length, 2);
    const last = bodies[1].messages;
    assert.equal(last.at(-2).role, 'assistant');
    assert.equal(last.at(-1).content, CONTINUE_PROMPT);
    assert.deepEqual(extractJson(out).hanhVi.map((h) => h.ten), ['A', 'B', 'C']);
    assert.equal(shown, out);
  } finally {
    globalThis.fetch = orig;
  }
});

test('ghép phần viết tiếp bỏ đoạn lặp lại ở chỗ nối', () => {
  assert.equal(stitch('Ông A đã chuyển cho ông B số tiền', 'chuyển cho ông B số tiền 100 triệu đồng.'), 'Ông A đã chuyển cho ông B số tiền 100 triệu đồng.');
  assert.equal(stitch('abc', ' def'), 'abc def');
});
