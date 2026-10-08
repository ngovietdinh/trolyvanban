import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusText, splitText, runChunks, chunkSizeFor, CHUNK } from '../../assets/js/lib/ai-chunk.js';
import { analyzeWithAi, analyzeOffline } from '../../assets/js/legal/analyze.js';
import { buildCaseMap, mergeAiCaseMap } from '../../assets/js/legal/case-map.js';

const filler = 'Căn cứ Điều 183 Bộ luật Tố tụng hình sự năm 2015.\nNgười tiến hành tố tụng: Điều tra viên.\nHọ tên: Nguyễn Văn An\nQuốc tịch: Việt Nam\n';
const facts = (i) => `Ngày ${(i % 27) + 1}/3/2025 ông Nguyễn Văn An lập chứng từ chi khống lần ${i} để rút tiền chiếm đoạt ${i + 10} triệu đồng.\nThời tiết hôm đó đẹp, mọi người vui vẻ trò chuyện về chuyện gia đình lần ${i}.\n`;
const LONG = filler.repeat(40) + Array.from({ length: 120 }, (_, i) => facts(i)).join('');

test('lọc nội dung: bỏ phần thủ tục, câu không có thông tin; tài liệu ngắn giữ nguyên', () => {
  assert.equal(focusText('ngắn'), 'ngắn');
  const f = focusText(LONG);
  assert.ok(f.length < LONG.length * 0.7, `${f.length} / ${LONG.length}`);
  assert.ok(!/Căn cứ Điều 183/.test(f));
  assert.ok(!/Thời tiết/.test(f));
  assert.match(f, /chi khống lần 119/);
});

test('chia phần ở ranh giới câu, không vượt kích thước', () => {
  const parts = splitText(LONG, 3500);
  assert.ok(parts.length > 3);
  assert.ok(parts.every((p) => p.length <= 3500));
  assert.equal(parts.join('\n').replace(/\s+/g, ''), LONG.replace(/\s+/g, ''));
  assert.equal(chunkSizeFor({ local: true }), CHUNK.local);
  assert.equal(chunkSizeFor({ provider: 'anthropic' }), CHUNK.online);
});

test('chạy theo phần: phần lỗi không làm hỏng cả lượt; tất cả lỗi thì báo lỗi; dừng được', async () => {
  const seen = [];
  const r = await runChunks(['a', 'b', 'c'], async (c, i) => {
    if (i === 1) throw new Error('hết giờ');
    return c.toUpperCase();
  }, { onProgress: (i, n) => seen.push(`${i}/${n}`) });
  assert.deepEqual(r.values, ['A', 'C']);
  assert.equal(r.errors.length, 1);
  assert.deepEqual(seen, ['1/3', '2/3', '3/3']);
  await assert.rejects(runChunks(['a'], async () => { throw new Error('x'); }), /x/);
  const ctl = new AbortController();
  ctl.abort();
  await assert.rejects(runChunks(['a'], async () => 'A', { signal: ctl.signal }), /Đã dừng/);
});

test('phân tích AI tài liệu dài: gửi nhiều phần nhỏ, gộp, bỏ trùng; phần hết giờ bị bỏ qua', async () => {
  const calls = [];
  const call = async (o) => {
    calls.push(o);
    if (calls.length === 2) throw Object.assign(new Error('không phản hồi'), { status: -2 });
    return JSON.stringify({ tomTat: `Phần ${calls.length}.`, hanhVi: [{ ten: 'Lập chứng từ chi khống, chi sai để rút tiền chiếm đoạt', dieu: '353', hanhViId: 'chi-khong', trich: 'chi khống' }] });
  };
  const offline = analyzeOffline(LONG, { primary: '353' });
  const r = await analyzeWithAi(call, LONG, { primary: '353', offline, chunkSize: 3500 });
  assert.ok(calls.length > 2);
  assert.ok(calls.every((o) => o.messages[0].content.length < 3500 + 4000), 'mỗi lần gửi nhỏ');
  assert.ok(calls.every((o) => o.maxTokens <= 3000 && o.timeoutRetry === false));
  assert.match(calls[0].messages[0].content, /ĐÂY LÀ PHẦN 1\//);
  assert.equal(r.items.filter((x) => x.nguon === 'ai').length, 1, 'bỏ trùng giữa các phần');
  assert.equal(r.aiParts.failed, 1);
  // Tài liệu ngắn: một lần gọi như cũ.
  const one = [];
  await analyzeWithAi(async (o) => (one.push(o), '{"tomTat":"x","hanhVi":[]}'), 'Ông A lập chứng từ chi khống.', { primary: '353', offline: analyzeOffline('x') });
  assert.equal(one.length, 1);
  assert.ok(!/ĐÂY LÀ PHẦN/.test(one[0].messages[0].content));
});

test('sơ đồ vụ việc: cộng dồn kết quả AI của nhiều phần', () => {
  const base = buildCaseMap({ sources: [{ text: 'Ông Nguyễn Văn An chuyển cho ông Trần Văn Bình 100 triệu đồng.' }] });
  const a = mergeAiCaseMap(base, { tomTat: 'P1', banChat: ['Ý 1'], nguoi: [], hanhVi: [{ ten: 'Chi khống', dieu: '353', nguoi: ['A'] }], quanHe: [{ tu: 'A', den: 'B', loai: 'tien', soTien: '1 triệu' }], moc: [{ thoiGian: '01/01/2025', suKien: 'E1' }] });
  const b = mergeAiCaseMap(a, { tomTat: 'P2', banChat: ['Ý 2', 'Ý 1'], hanhVi: [{ ten: 'Chi khống', dieu: '353' }, { ten: 'Rút tiền', dieu: '353' }], quanHe: [{ tu: 'A', den: 'B', loai: 'tien', soTien: '1 triệu' }, { tu: 'B', den: 'C', loai: 'chi-dao' }], moc: [{ thoiGian: '01/02/2025', suKien: 'E2' }] }, { append: true });
  assert.equal(b.tomTat, 'P1 P2');
  assert.deepEqual(b.banChat, ['Ý 1', 'Ý 2']);
  assert.deepEqual(b.crimes[0].items.map((x) => x.ten), ['Chi khống', 'Rút tiền']);
  assert.equal(b.edges.length, 2);
  assert.deepEqual(b.timeline.map((t) => t.suKien), ['E1', 'E2']);
});
