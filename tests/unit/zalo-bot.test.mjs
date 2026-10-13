import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker, { parseName, expand, search, makeToken, readToken, reply, extractMessage, resetCache } from '../../zalo-bot/worker.js';

const FILES = ['140. Biên bản ghi lời khai.doc', '52. Quyết định khởi tố bị can.doc', '53. Quyết định bổ sung Quyết định khởi tố bị can.doc', '66. Lệnh bắt người bị giữ trong trường hợp khẩn cấp.doc', '98. Quyết định truy nã (sử dụng trong giai đoạn điều tra, truy tố, xét xử).doc', '99. Quyết định truy nã (sử dụng trong giai đoạn thi hành án).doc', '257A. Quyết định không áp dụng biện pháp chuyển hướng.doc', '238. Thong bao ve viec ket thuc dieu tra vu an hinh su.docx', '196.Thông báo không chấp nhận đề nghị định giá lại tài sản.doc', 'README.md'];
const env = { ZALO_BOT_TOKEN: 'zt', WEBHOOK_SECRET: 'wh-secret', LINK_SECRET: 'link-secret-0123456789abcdef', MAU_GITHUB_TOKEN: 'gh', MAU_REPO: 'chu/mau', ALLOWED_IDS: 'u1, u2' };
let calls;
let aiAnswer;
const realFetch = globalThis.fetch;

beforeEach(() => {
  resetCache();
  calls = [];
  aiAnswer = null;
  globalThis.fetch = async (url, opt = {}) => {
    url = String(url);
    calls.push({ url, opt, body: opt.body ? JSON.parse(opt.body) : null });
    if (url.startsWith('https://api.github.com/repos/chu/mau/contents/?')) return Response.json(FILES.map((name) => ({ type: 'file', name, path: name, size: 1000 })));
    if (url.startsWith('https://api.github.com/repos/chu/mau/contents/')) return new Response(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]));
    if (url.includes('/chat/completions')) return Response.json({ choices: [{ message: { content: JSON.stringify(aiAnswer) } }] });
    if (url.startsWith('https://bot-api.zaloplatforms.com/botzt/')) return Response.json({ ok: true, result: {} });
    throw new Error(`fetch lạ: ${url}`);
  };
});
afterEach(() => (globalThis.fetch = realFetch));

const sent = () => calls.filter((c) => c.url.endsWith('/sendMessage')).map((c) => c.body);

test('đọc tên tệp mẫu: số có chữ (257A), thiếu dấu cách sau dấu chấm, .docx; bỏ tệp khác', () => {
  assert.deepEqual(parseName('257A. Quyết định không áp dụng biện pháp chuyển hướng.doc'), { so: '257A', ten: 'Quyết định không áp dụng biện pháp chuyển hướng', ext: 'doc' });
  assert.equal(parseName('196.Thông báo không chấp nhận.doc').so, '196');
  assert.equal(parseName('238. Thong bao.docx').ext, 'docx');
  assert.equal(parseName('README.md'), null);
  assert.deepEqual(expand('QĐ khởi tố BC'), ['quyet', 'dinh', 'khoi', 'to', 'bi', 'can']);
});

test('link tải: mã hóa, giải mã đúng; sửa một ký tự hay hết hạn đều bị từ chối', async () => {
  const t = await makeToken(env, { p: '140. Biên bản ghi lời khai.doc' }, 1000);
  assert.ok(!t.includes('140') && !/Bi/.test(t), 'đường dẫn tệp không lộ trong link');
  assert.equal((await readToken(env, t, 2000)).p, '140. Biên bản ghi lời khai.doc');
  assert.deepEqual(await readToken(env, t, 1000 + 16 * 60000), { expired: true });
  const bad = t.slice(0, 20) + (t[20] === 'A' ? 'B' : 'A') + t.slice(21);
  assert.equal(await readToken(env, bad, 2000), null);
  assert.equal(await readToken({ ...env, LINK_SECRET: 'khac-hoan-toan-0123456789' }, t, 2000), null);
});

test('nhắn số mẫu → link tải; số không có → gợi ý; ds → danh sách', async () => {
  const r = await reply(env, 'mẫu 257a', 'https://bot.example');
  assert.match(r, /Mẫu 257A\. Quyết định không áp dụng biện pháp chuyển hướng\n⬇️ https:\/\/bot\.example\/f\/[\w-]+/);
  assert.match(await reply(env, '140', 'https://b'), /Mẫu 140\. Biên bản ghi lời khai/);
  assert.match(await reply(env, '257', 'https://b'), /Không có mẫu số 257\.\nCó thể là:\n• 257A/);
  const ds = await reply(env, 'ds 60', 'https://b');
  assert.match(ds, /Có 9 mẫu\. Từ số 60:\n• 66\./);
  assert.ok(!ds.includes('• 52.'));
});

test('tìm theo mô tả: rõ thì trả thẳng link; mơ hồ thì hỏi AI chọn trong danh sách (không bịa số)', async () => {
  assert.match(await reply(env, 'biên bản ghi lời khai người làm chứng', 'https://b'), /Mẫu 140\./);
  assert.match(await reply(env, 'lenh bat khan cap', 'https://b'), /Mẫu 66\./);
  // Mơ hồ: AI chọn 1 mẫu → trả link.
  aiAnswer = { so: ['99', '999'], hoi: '' };
  const r = await reply({ ...env, AI_API_KEY: 'k' }, 'quyết định truy nã', 'https://b');
  assert.match(r, /Mẫu 99\. Quyết định truy nã \(sử dụng trong giai đoạn thi hành án\)/);
  const ai = calls.find((c) => c.url.includes('/chat/completions'));
  assert.equal(ai.body.model, 'openai/gpt-oss-120b');
  assert.ok(ai.body.messages[1].content.includes('98. Quyết định truy nã'));
  assert.ok(!ai.body.messages[1].content.includes('140.'), 'chỉ gửi mẫu ứng viên, không gửi cả danh mục');
  // AI hỏi lại → liệt kê để chọn.
  aiAnswer = { so: ['98', '99'], hoi: 'Giai đoạn điều tra hay thi hành án?' };
  assert.match(await reply({ ...env, AI_API_KEY: 'k' }, 'quyết định truy nã', 'https://b'), /^Giai đoạn điều tra hay thi hành án\?\n• 98\. .*\n• 99\./);
  // Không có AI → liệt kê.
  assert.match(await reply(env, 'quyết định truy nã', 'https://b'), /^Có thể là:\n/);
});

test('webhook: sai mã bí mật → 403; người lạ chỉ nhận mã tài khoản; người được phép nhận link', async () => {
  const req = (body, secret = 'wh-secret') => new Request('https://bot.example/webhook', { method: 'POST', headers: { 'X-Bot-Api-Secret-Token': secret, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const ctx = () => {
    const jobs = [];
    return { waitUntil: (p) => jobs.push(p), done: () => Promise.all(jobs) };
  };
  const msg = (from, text) => ({ ok: true, result: { event_name: 'message.text.received', message: { message_id: 'm1', date: 1, chat: { id: `c-${from}`, chat_type: 'PRIVATE' }, from: { id: from, display_name: 'X' }, text } } });

  assert.equal((await worker.fetch(req(msg('u1', '140'), 'sai'), env, ctx())).status, 403);

  let c = ctx();
  await worker.fetch(req(msg('lạ', '140')), env, c);
  await c.done();
  assert.deepEqual(sent(), [{ chat_id: 'c-lạ', text: 'Bot riêng — tài khoản chưa được cấp quyền.\nMã tài khoản Zalo của bạn: lạ' }]);
  assert.ok(!calls.some((x) => x.url.includes('api.github.com')), 'người lạ không chạm được kho mẫu');

  calls = [];
  c = ctx();
  await worker.fetch(req(msg('u2', '140')), env, c);
  await c.done();
  assert.equal(sent()[0].chat_id, 'c-u2');
  assert.match(sent()[0].text, /Mẫu 140\. Biên bản ghi lời khai\n⬇️ https:\/\/bot\.example\/f\//);
  assert.deepEqual(extractMessage({ message: { chat: { id: 9 }, from: { id: 8 }, text: ' a ' } }), { chatId: '9', userId: '8', name: '', text: 'a' });
});

test('tải tệp qua link: đúng tệp, tên tiếng Việt; link hết hạn / giả → không tải được', async () => {
  const t = await makeToken(env, { p: '140. Biên bản ghi lời khai.doc' });
  const res = await worker.fetch(new Request(`https://bot.example/f/${t}`), env, {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'application/msword');
  assert.match(res.headers.get('Content-Disposition'), /filename="140-bien-ban-ghi-loi-khai\.doc"; filename\*=UTF-8''140\.%20Bi%C3%AAn/);
  assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [0xd0, 0xcf, 0x11, 0xe0]);
  const gh = calls.find((c) => c.url.includes('contents/140.'));
  assert.equal(gh.opt.headers.Authorization, 'Bearer gh');
  assert.equal((await worker.fetch(new Request('https://bot.example/f/abc'), env, {})).status, 403);
  const old = await makeToken(env, { p: 'x.doc' }, Date.now() - 20 * 60000);
  assert.equal((await worker.fetch(new Request(`https://bot.example/f/${old}`), env, {})).status, 410);
});

test('search không trả kết quả với câu không có từ khóa', () => {
  assert.deepEqual(search([], 'cho tao mẫu'), []);
});
