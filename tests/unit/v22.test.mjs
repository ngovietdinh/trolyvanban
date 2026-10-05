import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan } from '../../assets/js/legal/engine.js';
import { newRecord, prefillQa, parsePastedQa, planPastedQa, applyPastedQa } from '../../assets/js/legal/record.js';
import { learnedBank } from '../../assets/js/legal/repo.js';
import { streamClaude, setAIHooks, hashText, AI_TIMEOUT, AI_RETRY } from '../../assets/js/lib/ai.js';

AI_RETRY.delays = [5, 5];

test('dán văn bản có dấu hiệu Hỏi/Trả lời → cặp hỏi – đáp, nhiều dòng', () => {
  const r = parsePastedQa('Hỏi: Anh tên gì?\nTrả lời: Tôi tên Bình.\nSinh năm 1980.\n\nH: Anh làm nghề gì?\nĐ: Kế toán.\nCâu hỏi 3: Anh có nhận tiền không?\nTL: Không.');
  assert.equal(r.pairs.length, 3);
  assert.deepEqual(r.pairs[0], { q: 'Anh tên gì?', a: 'Tôi tên Bình.\nSinh năm 1980.' });
  assert.equal(r.pairs[1].a, 'Kế toán.');
  assert.equal(r.pairs[2].q, 'Anh có nhận tiền không?');
});

test('dán chỉ các đoạn trả lời → ghép lần lượt với câu hỏi chưa trả lời; câu trùng điền đúng lượt', () => {
  const plan = generatePlan({ dieu: '353', roleId: 'bi-can' });
  const rec = newRecord({ plan });
  prefillQa(rec);
  rec.qa[0].a = 'Đã trả lời.';
  const paras = parsePastedQa('Tôi là kế toán từ năm 2015.\n\nTôi không nhớ rõ.');
  assert.equal(paras.pairs.length, 0);
  const items = planPastedQa(rec, paras);
  assert.equal(items[0].index, 1);
  assert.equal(items[1].index, 2);
  // Cặp có câu hỏi trùng (khác dấu câu/hoa thường) với lượt chưa trả lời → điền vào lượt đó
  const q5 = rec.qa[5].q;
  const items2 = planPastedQa(rec, parsePastedQa(`Hỏi: ${q5.toUpperCase().replace(/[?]/g, '')}\nTrả lời: Có.\nHỏi: Câu hỏi mới hoàn toàn?\nTrả lời: Không.`));
  assert.equal(items2[0].index, 5);
  assert.equal(items2[1].index, -1);
  const n = rec.qa.length;
  const r = applyPastedQa(rec, items2);
  assert.deepEqual(r, { filled: 1, added: 1 });
  assert.equal(rec.qa[5].a, 'Có.');
  assert.equal(rec.qa.length, n + 1);
});

test('tự học: câu hỏi đã dùng xuất hiện lại trong kế hoạch với nhãn Đã học, không trùng', () => {
  learnedBank.clear();
  learnedBank.learn('353', 'dong-pham', 'Ai giữ sổ quỹ đen của đơn vị?');
  learnedBank.learn('353', 'dong-pham', 'ai giữ sổ quỹ đen của đơn vị?'); // trùng → tăng số lần
  learnedBank.learn('353', 'dong-pham', 'Ngắn'); // quá ngắn → bỏ
  assert.equal(learnedBank.count(), 1);
  assert.equal(learnedBank.of('353', 'dong-pham')[0].n, 2);
  const plan = generatePlan({ dieu: '353', roleId: 'bi-can', learned: learnedBank.all() });
  const q = plan.issues.find((i) => i.key === 'dong-pham').cauHoi.find((c) => c.src === 'hoc');
  assert.equal(q.text, 'Ai giữ sổ quỹ đen của đơn vị?');
  assert.equal(q.priority, 'high');
  learnedBank.forget('353', 'dong-pham', q.text);
  assert.equal(learnedBank.count(), 0);
});

function sseResponse(text) {
  const body = text.match(/[\s\S]{1,5}/g).map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`).join('') + 'data: [DONE]\n\n';
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

test('AI tự chuyển nhà cung cấp khi lỗi, báo sự kiện; ghi nhớ kết quả để không gọi lại', async () => {
  const events = [];
  const cache = new Map();
  const calls = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('api.openai.com')) return new Response('{"error":"quota"}', { status: 429 });
    return sseResponse('Xin chào từ Grok');
  };
  setAIHooks({
    chain: () => [
      { provider: 'openai', apiKey: 'sk-a', model: 'gpt-4o' },
      { provider: 'grok', apiKey: 'xai-b', model: 'grok-3' },
    ],
    options: () => ({ fallback: true, cache: true }),
    event: (e) => events.push(e),
    cacheGet: (k) => cache.get(k) || null,
    cacheSet: (k, v) => cache.set(k, v),
  });
  try {
    const meta = {};
    const out = await streamClaude({ provider: 'openai', apiKey: 'sk-a', model: 'gpt-4o', messages: [{ role: 'user', content: 'Chào' }], cache: true, meta });
    assert.equal(out, 'Xin chào từ Grok');
    assert.equal(meta.provider, 'grok');
    assert.equal(meta.switched, true);
    assert.ok(events.some((e) => e.type === 'switch' && e.from === 'openai' && e.to === 'grok'));
    assert.ok(events.some((e) => e.type === 'error' && /quá tải|hạn mức/.test(e.message)));
    // Lần 2: dùng kết quả đã ghi nhớ, không gọi mạng
    const n = calls.length;
    const meta2 = {};
    const out2 = await streamClaude({ provider: 'openai', apiKey: 'sk-a', messages: [{ role: 'user', content: 'Chào' }], cache: true, meta: meta2 });
    assert.equal(out2, 'Xin chào từ Grok');
    assert.equal(meta2.cached, true);
    assert.equal(calls.length, n);
    // fresh = true → bỏ qua bộ nhớ
    await streamClaude({ provider: 'openai', apiKey: 'sk-a', messages: [{ role: 'user', content: 'Chào' }], cache: true, fresh: true });
    assert.ok(calls.length > n);
    // Tất cả lỗi → thông báo gộp rõ ràng
    globalThis.fetch = async () => new Response('', { status: 500 });
    await assert.rejects(streamClaude({ provider: 'openai', apiKey: 'sk-a', messages: [{ role: 'user', content: 'X' }] }), /AI đều lỗi sau khi thử lại.*ChatGPT.*Grok/);
  } finally {
    globalThis.fetch = origFetch;
    setAIHooks({ chain: () => [], options: () => ({ fallback: true, cache: false }) });
  }
});

test('AI không phản hồi → hết thời gian chờ, báo lỗi (không treo)', async () => {
  const origFetch = globalThis.fetch;
  const saved = { ...AI_TIMEOUT };
  AI_TIMEOUT.first = 50;
  globalThis.fetch = (url, init) =>
    new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  setAIHooks({ chain: () => [], options: () => ({ fallback: false, cache: false }) });
  try {
    await assert.rejects(streamClaude({ provider: 'grok', apiKey: 'xai-1', messages: [{ role: 'user', content: 'X' }] }), /Grok không phản hồi/);
  } finally {
    globalThis.fetch = origFetch;
    Object.assign(AI_TIMEOUT, saved);
  }
});

test('dán hỗn hợp: đoạn trả lời rời phía trước + cặp Hỏi/Trả lời phía sau đều được giữ', () => {
  const plan = generatePlan({ dieu: '353', roleId: 'bi-can' });
  const rec = newRecord({ plan });
  prefillQa(rec);
  const parsed = parsePastedQa('em tên bình\n\nem làm kế toán\n\nHỏi: Anh có nhận tiền không?\nTrả lời: Không.');
  assert.deepEqual(parsed.paragraphs, ['em tên bình', 'em làm kế toán']);
  const items = planPastedQa(rec, parsed);
  assert.deepEqual(items.map((x) => x.index), [0, 1, -1]);
});

test('Gemini 503: tự thử lại, rồi chuyển mô hình Gemini dự phòng — chỉ có một key vẫn chạy được', async () => {
  const origFetch = globalThis.fetch;
  const urls = [];
  const events = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes('gemini-2.5-flash:')) return new Response('{"error":{"code":503,"message":"The model is overloaded.","status":"UNAVAILABLE"}}', { status: 503 });
    const body = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Trả lời từ gemini-2.0-flash' }] } }] })}\r\n\r\n`;
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  setAIHooks({ chain: () => [{ provider: 'gemini', apiKey: 'AIza-1', model: 'gemini-2.5-flash' }], options: () => ({ fallback: true, cache: false }), event: (e) => events.push(e) });
  try {
    const meta = {};
    const out = await streamClaude({ provider: 'gemini', apiKey: 'AIza-1', model: 'gemini-2.5-flash', messages: [{ role: 'user', content: 'X' }], meta });
    assert.equal(out, 'Trả lời từ gemini-2.0-flash');
    assert.equal(meta.model, 'gemini-2.0-flash');
    assert.equal(urls.filter((u) => u.includes('gemini-2.5-flash:')).length, 3, '1 lần + 2 lần thử lại');
    assert.equal(events.filter((e) => e.type === 'retry').length, 2);
    assert.ok(events.some((e) => e.type === 'switch' && /gemini-2\.5-flash lỗi → thử gemini-2\.0-flash/.test(e.message)));
    assert.ok(events.some((e) => e.type === 'error' && /quá tải \(503/.test(e.message)));
    // Lỗi 503 nằm trong luồng SSE cũng được nhận diện
    globalThis.fetch = async () => new Response(`data: ${JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE' } })}\r\n\r\n`, { status: 200 });
    setAIHooks({ options: () => ({ fallback: false, cache: false }) });
    await assert.rejects(streamClaude({ provider: 'gemini', apiKey: 'AIza-1', messages: [{ role: 'user', content: 'X' }] }), /Gemini đang quá tải \(503/);
    // 401: không thử lại, không đổi mô hình
    urls.length = 0;
    globalThis.fetch = async (url) => (urls.push(String(url)), new Response('{"error":{"status":"PERMISSION_DENIED"}}', { status: 403 }));
    setAIHooks({ options: () => ({ fallback: true, cache: false }) });
    await assert.rejects(streamClaude({ provider: 'gemini', apiKey: 'AIza-1', messages: [{ role: 'user', content: 'X' }] }), /API key Gemini không hợp lệ/);
    assert.equal(urls.length, 1);
  } finally {
    globalThis.fetch = origFetch;
    setAIHooks({ chain: () => [], options: () => ({ fallback: true, cache: false }), event: () => {} });
  }
});

test('hashText ổn định', () => {
  assert.equal(hashText('abc'), hashText('abc'));
  assert.notEqual(hashText('abc'), hashText('abd'));
});
