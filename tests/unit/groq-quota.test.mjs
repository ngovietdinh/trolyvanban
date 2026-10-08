import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planGroq, groqWaitMs, groqReserve, groqUsageToday, inputTokens, estTokens, resetGroqMinute, GROQ_DEFAULT_LIMITS, setGroqLimits, groqLimits } from '../../assets/js/lib/groq-quota.js';
import { chunkSizeFor, concurrencyFor, ctxFor, isTight } from '../../assets/js/lib/ai-chunk.js';

const L = GROQ_DEFAULT_LIMITS;

test('ước lượng token tiếng Việt và token gửi đi', () => {
  assert.equal(estTokens('a'.repeat(320)), 100);
  const n = inputTokens('hệ thống', [{ role: 'user', content: 'x'.repeat(3200) }, { role: 'user', content: [{ type: 'text', text: 'y'.repeat(32) }, { type: 'image', data: '' }] }]);
  assert.ok(n > 1000 + 1000 && n < 2200);
});

test('max_tokens vừa đủ trong hạn mức phút; gửi đi quá lớn → 413 để phần gọi tự chia nhỏ', () => {
  const small = planGroq({ system: 's', messages: [{ role: 'user', content: 'x'.repeat(1600) }], maxTokens: 4096, model: 'm1' }, L);
  assert.equal(small.maxTokens, 4096);
  const big = planGroq({ system: 's', messages: [{ role: 'user', content: 'x'.repeat(19200) }], maxTokens: 4096, model: 'm1' }, L);
  assert.ok(big.input + big.maxTokens <= L.tpm, 'gửi + trả lời không vượt 8K/phút');
  assert.ok(big.maxTokens >= 512);
  assert.throws(() => planGroq({ system: 's', messages: [{ role: 'user', content: 'x'.repeat(26000) }], model: 'm1' }, L), (e) => e.status === 413 && /chia nhỏ/.test(e.message));
});

test('chờ khi phút này đã dùng gần hết; mỗi mô hình tính riêng', () => {
  resetGroqMinute();
  const now = Date.now();
  groqReserve(6000, 'm-wait', now - 20000);
  const ms = groqWaitMs(3000, 'm-wait', L, now);
  assert.ok(ms > 39000 && ms <= 41000, `chờ ~40 giây, được ${ms}`);
  assert.equal(groqWaitMs(3000, 'm-khac', L, now), 0, 'mô hình khác không phải chờ');
  assert.equal(groqWaitMs(1500, 'm-wait', L, now), 0, 'còn đủ chỗ thì không chờ');
  // Số yêu cầu / phút.
  resetGroqMinute();
  for (let i = 0; i < L.rpm; i++) groqReserve(10, 'm-rpm', now - 1000);
  assert.ok(groqWaitMs(10, 'm-rpm', L, now) > 0);
});

test('thống kê trong ngày theo mô hình; cập nhật số token thật; hết hạn mức ngày → báo, không chờ thử lại', () => {
  const before = groqUsageToday().models['m-day']?.tokens || 0;
  const settle = groqReserve(5000, 'm-day');
  settle(1200);
  const u = groqUsageToday();
  assert.equal(u.models['m-day'].tokens - before, 1200);
  assert.ok(u.requests >= 1);
  const lim = { ...L, tpd: u.models['m-day'].tokens + 100 };
  assert.throws(() => planGroq({ system: 's', messages: [{ role: 'user', content: 'x'.repeat(3200) }], model: 'm-day' }, lim), (e) => e.status === 429 && e.retryAfter > 65 && /hạn mức ngày/.test(e.message));
  // Mô hình khác vẫn dùng được.
  assert.doesNotThrow(() => planGroq({ system: 's', messages: [{ role: 'user', content: 'x'.repeat(3200) }], model: 'm-moi' }, lim));
});

test('hạn mức sửa được; Groq gửi lần lượt từng phần nhỏ, ngữ cảnh gọn', () => {
  setGroqLimits({ ...L, tpm: 12000 });
  assert.equal(groqLimits().tpm, 12000);
  setGroqLimits({ ...L });
  const g = { provider: 'groq' };
  assert.equal(isTight(g), true);
  assert.equal(chunkSizeFor(g), 4000);
  assert.equal(concurrencyFor(g), 1);
  assert.equal(ctxFor(g, 16000, 6000), 6000);
  assert.equal(concurrencyFor({ provider: 'anthropic' }), 2);
  assert.equal(chunkSizeFor({ provider: 'openai' }), 8000);
});
