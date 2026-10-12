import test from 'node:test';
import assert from 'node:assert/strict';
import { store, rawStore, setScope, isEnvelope, refreshEnv, getEnv } from '../../assets/js/lib/store.js';
import { cipher, importDataKey, randomBytes, passphraseSeal, passphraseOpen } from '../../assets/js/lib/cipher.js';
import { securityPolicy, saveSecurityPolicy, checkUrl, isPrivateHost, aiEndpointAllowed, passwordProblem, loginBlockedFor, recordLoginFail, clearLoginFails, cspFor } from '../../assets/js/lib/security.js';
import { accounts, vault, newRecoveryCode, normRecovery, audit, auditLog } from '../../assets/js/lib/accounts.js';
import { assertAiAllowed, PROVIDERS, setLocalEndpoint } from '../../assets/js/lib/ai.js';
import { khoDb } from '../../assets/js/lib/kho-db.js';

const reset = async () => {
  await cipher.close();
  for (const k of rawStore.keys()) rawStore.remove(k);
  accounts.logout(true);
  refreshEnv();
};
/** Giả lập đổi chính sách rồi tải lại ứng dụng. */
const switchMode = async (on) => {
  await accounts.lock();
  saveSecurityPolicy({ on });
  refreshEnv();
};

test('lớp mã hóa: ghi vào là bản mã AES-GCM, đọc ra đúng bản rõ, khóa lại thì không đọc được', async () => {
  await reset();
  setScope('u1');
  store.set('cases', [{ id: 'c1', ten: 'Vụ tham ô tại Công ty X' }]); // dữ liệu cũ dạng rõ
  const key = await importDataKey(randomBytes(32));
  await cipher.open('u:u1:', key);
  // Dữ liệu cũ được mã hóa ngay khi mở khóa.
  assert.ok(isEnvelope(rawStore.get('u:u1:cases')));
  assert.doesNotMatch(rawStore.getRaw('u:u1:cases'), /tham ô/);
  assert.equal(store.get('cases')[0].ten, 'Vụ tham ô tại Công ty X');
  store.set('records', [{ id: 'r1', loiKhai: 'Tôi nhận 100 triệu đồng' }]);
  await cipher.flush();
  assert.ok(isEnvelope(rawStore.get('u:u1:records')));
  assert.doesNotMatch(rawStore.getRaw('u:u1:records'), /100 triệu/);
  // Đối tượng trả về là bản sao: sửa mà không lưu thì không ảnh hưởng.
  store.get('cases')[0].ten = 'đã sửa';
  assert.equal(store.get('cases')[0].ten, 'Vụ tham ô tại Công ty X');
  await cipher.close();
  // Đang khóa: không trả bản mã cho màn hình, không ghi đè bản mã bằng bản rõ.
  assert.deepEqual(store.get('cases', []), []);
  store.set('cases', [{ id: 'x' }]);
  assert.ok(isEnvelope(rawStore.get('u:u1:cases')));
  // Mở lại bằng đúng khóa → đọc được; bản mã gắn với tên mục (không tráo được giữa các mục).
  await cipher.open('u:u1:', key);
  assert.equal(store.get('records')[0].loiKhai, 'Tôi nhận 100 triệu đồng');
  const box = rawStore.get('u:u1:records');
  await cipher.close();
  rawStore.set('u:u1:cases', box);
  await cipher.open('u:u1:', key);
  assert.deepEqual(store.get('cases', 'hỏng'), 'hỏng', 'bản mã của mục khác không giải mã được');
  await cipher.close();
  // Khóa khác → không giải mã được.
  await cipher.open('u:u1:', await importDataKey(randomBytes(32)));
  assert.equal(store.get('records', null), null);
  await reset();
});

test('kho tài liệu (IndexedDB): nội dung và tệp gốc được mã hóa; đang khóa không đọc được', async () => {
  await reset();
  saveSecurityPolicy({ on: true });
  assert.equal(refreshEnv(), 'secure');
  setScope('u2');
  const key = await importDataKey(randomBytes(32));
  await cipher.open('s:u2:', key);
  const rec = await khoDb.put({ ten: 'Biên bản lời khai Nguyễn Văn An', text: 'nội dung mật', blob: new Blob(['TỆP GỐC'], { type: 'text/plain' }) });
  const got = await khoDb.get(rec.id);
  assert.equal(got.ten, 'Biên bản lời khai Nguyễn Văn An');
  assert.equal(await got.blob.text(), 'TỆP GỐC');
  assert.deepEqual(await khoDb.stats(), { enc: 1, plain: 0 });
  assert.equal((await khoDb.list())[0].hasFile, true);
  await cipher.close();
  assert.equal(await khoDb.get(rec.id), null);
  assert.deepEqual(await khoDb.list(), []);
  await khoDb.clear();
  await reset();
});

test('địa chỉ được phép trong chế độ bảo mật: chỉ máy này, máy chủ AI nội bộ và danh sách khai báo', async () => {
  await reset();
  assert.equal(securityPolicy().on, false);
  assert.ok(checkUrl('https://api.anthropic.com/v1/messages').ok, 'chưa bật: không chặn');
  saveSecurityPolicy({ on: true, aiBase: 'http://10.0.0.5:11434/v1', allowHosts: ['*.noibo.ca', 'may-chu.ca'] });
  const p = securityPolicy();
  assert.equal(p.on, true);
  assert.equal(checkUrl('https://api.anthropic.com/v1/messages').ok, false);
  assert.equal(checkUrl('https://api.groq.com/openai/v1').ok, false);
  assert.ok(checkUrl('http://localhost:11434/v1/models').ok);
  assert.ok(checkUrl('http://127.0.0.1:8080/v1').ok);
  assert.ok(checkUrl('http://10.0.0.5:11434/v1/chat/completions').ok);
  assert.ok(checkUrl('https://ai.noibo.ca/v1').ok);
  assert.ok(checkUrl('http://may-chu.ca/x').ok);
  assert.equal(checkUrl('http://192.168.1.20:11434/v1').ok, false, 'máy nội bộ chưa khai báo bị chặn khi bật “chỉ máy chủ khai báo”');
  saveSecurityPolicy({ strictHosts: false });
  assert.ok(checkUrl('http://192.168.1.20:11434/v1').ok);
  assert.equal(checkUrl('http://8.8.8.8/').ok, false);
  assert.ok(isPrivateHost('fd12:3456::1') && isPrivateHost('ai.local') && !isPrivateHost('example.com'));
  // AI: phải đúng máy chủ đã khai báo; dịch vụ công cộng bị khóa ở lớp gọi AI.
  assert.ok(aiEndpointAllowed('http://10.0.0.5:11434/v1'));
  assert.equal(aiEndpointAllowed('http://10.0.0.6:11434/v1'), false);
  assert.throws(() => assertAiAllowed('anthropic'), /Chế độ bảo mật đã chặn/);
  assert.throws(() => assertAiAllowed('groq'), /SEC_BLOCK|chặn/);
  setLocalEndpoint('http://10.0.0.5:11434/v1');
  assert.doesNotThrow(() => assertAiAllowed('local'));
  setLocalEndpoint('http://10.0.0.9:11434/v1');
  assert.throws(() => assertAiAllowed('local'));
  assert.match(cspFor(), /connect-src 'self'.*http:\/\/10\.0\.0\.5:\*/);
  assert.match(cspFor(), /https:\/\/\*\.noibo\.ca:\*/);
  assert.equal(PROVIDERS.local.base, 'http://10.0.0.9:11434/v1');
  setLocalEndpoint('');
  assert.throws(() => saveSecurityPolicy({ aiBase: 'không phải địa chỉ' }), /không hợp lệ/);
  await reset();
});

test('mật khẩu mạnh và tạm khóa đăng nhập khi sai nhiều lần (chỉ trong chế độ bảo mật)', async () => {
  await reset();
  assert.equal(passwordProblem('12345678'), '');
  saveSecurityPolicy({ on: true });
  assert.match(passwordProblem('abcdefgh12'.slice(0, 9)), /10 ký tự/);
  assert.match(passwordProblem('abcdefghijk'), /chữ và số/);
  assert.equal(passwordProblem('matkhau2026'), '');
  for (let i = 0; i < 4; i++) recordLoginFail('a@b.vn', 1000);
  assert.equal(loginBlockedFor('a@b.vn', 1000), 0);
  recordLoginFail('a@b.vn', 1000);
  assert.equal(loginBlockedFor('a@b.vn', 1000), 5);
  assert.equal(loginBlockedFor('a@b.vn', 1000 + 6 * 60000), 0);
  clearLoginFails('a@b.vn');
  await reset();
});

test('hai môi trường tách biệt: dữ liệu tạo trong chế độ bảo mật không hiện ở chế độ bình thường và ngược lại', async () => {
  await reset();
  assert.equal(getEnv(), 'normal');
  const admin = await accounts.register({ name: 'Quản trị', email: 'gsnvbu@gmail.com', password: 'matkhau-toi-cao1' });
  assert.equal(admin.recoveryCode, undefined, 'chế độ bình thường: không tạo môi trường bảo mật');
  store.set('cases', [{ id: 'n1', ten: 'Vụ ở chế độ bình thường' }]);
  store.set('settings', { org: { coQuan: 'CÔNG AN TỈNH A' }, aiProvider: 'groq' });
  await khoDb.put({ ten: 'Tài liệu bình thường' });
  audit('Xóa biên bản lời khai', 'Trần Văn Bình');

  // Bật chế độ bảo mật → tải lại → phải mở khóa → môi trường bảo mật TRỐNG (chỉ chép thông tin đơn vị).
  await switchMode(true);
  assert.equal(getEnv(), 'secure');
  assert.equal(accounts.needsUnlock(), true);
  assert.deepEqual(store.get('cases', []), [], 'đang khóa: không đọc gì');
  const r = await accounts.unlock('matkhau-toi-cao1');
  assert.match(r.recoveryCode, /^([2-9A-HJKMNP-TV-Z]{4}-){5}[2-9A-HJKMNP-TV-Z]{4}$/);
  assert.deepEqual(store.get('cases', []), [], 'không thấy dữ liệu của chế độ bình thường');
  assert.equal(store.get('settings').org.coQuan, 'CÔNG AN TỈNH A', 'chỉ chép thông tin đơn vị');
  assert.equal(store.get('settings').aiProvider, undefined, 'không chép cấu hình AI');
  assert.deepEqual(await khoDb.list(), [], 'kho tài liệu riêng');
  assert.ok(!auditLog().some((x) => x.detail === 'Trần Văn Bình'), 'nhật ký riêng');
  store.set('cases', [{ id: 's1', ten: 'Vụ MẬT tạo trong chế độ bảo mật' }]);
  store.set('records', [{ id: 'r1', noiDung: 'Lời khai MẬT' }]);
  await khoDb.put({ ten: 'Tài liệu MẬT', blob: new Blob(['TỆP MẬT']) });
  audit('Xóa biên bản lời khai', 'Nguyễn Văn MẬT');
  await cipher.flush();
  assert.ok(isEnvelope(rawStore.get(`s:${admin.id}:cases`)));
  // Không có dữ liệu mật dạng rõ ở bất kỳ đâu trên máy.
  const everything = rawStore.keys().map((k) => rawStore.getRaw(k)).join('\n');
  assert.doesNotMatch(everything, /MẬT/);
  assert.equal(rawStore.get(`u:${admin.id}:cases`)[0].ten, 'Vụ ở chế độ bình thường', 'dữ liệu bình thường giữ nguyên');

  // Tắt chế độ bảo mật → tải lại → môi trường bình thường: không thấy gì của môi trường bảo mật.
  await switchMode(false);
  assert.equal(getEnv(), 'normal');
  assert.equal(await accounts.resume(), true);
  assert.equal(accounts.needsUnlock(), false);
  assert.equal(cipher.active(), false);
  assert.deepEqual(store.get('cases').map((c) => c.ten), ['Vụ ở chế độ bình thường']);
  assert.deepEqual(store.get('records', []), []);
  assert.deepEqual((await khoDb.list()).map((d) => d.ten), ['Tài liệu bình thường']);
  assert.ok(!auditLog().some((x) => /MẬT/.test(x.detail)), 'nhật ký chế độ bình thường không chứa nội dung mật');
  // Ghi ở chế độ bình thường không đụng tới vùng bảo mật.
  store.set('cases', [{ id: 'n2', ten: 'Vụ bình thường 2' }]);
  assert.ok(isEnvelope(rawStore.get(`s:${admin.id}:cases`)));

  // Bật lại → thấy lại đúng dữ liệu của môi trường bảo mật.
  await switchMode(true);
  await accounts.unlock('matkhau-toi-cao1');
  assert.deepEqual(store.get('cases').map((c) => c.ten), ['Vụ MẬT tạo trong chế độ bảo mật']);
  assert.equal(store.get('records')[0].noiDung, 'Lời khai MẬT');
  const docs = await khoDb.list();
  assert.deepEqual(docs.map((d) => d.ten), ['Tài liệu MẬT']);
  assert.equal(await (await khoDb.get(docs[0].id)).blob.text(), 'TỆP MẬT');
  assert.ok(auditLog().some((x) => x.action === 'Xóa biên bản lời khai' && /không ghi/.test(x.detail)), 'nhật ký bảo mật không ghi tên người');
  await khoDb.clear();
  await reset();
});

test('môi trường bảo mật: khóa / mở khóa, đổi mật khẩu, quản trị đặt lại → mở bằng mã khôi phục, tạm khóa khi sai', async () => {
  await reset();
  await accounts.register({ name: 'Quản trị', email: 'gsnvbu@gmail.com', password: 'matkhau-toi-cao1' });
  await vault.write({ providers: { local: { base: 'http://localhost:11434/v1', model: 'qwen' } } });
  await switchMode(true);
  await accounts.unlock('matkhau-toi-cao1');
  store.set('cases', [{ id: 'c1', ten: 'Vụ A' }]);
  assert.equal((await vault.read()).providers.local.model, 'qwen');
  await accounts.lock();
  assert.deepEqual(store.get('cases', []), []);
  await assert.rejects(() => accounts.unlock('sai-mat-khau-1'), /không đúng/);
  await accounts.unlock('matkhau-toi-cao1');
  assert.equal(store.get('cases')[0].ten, 'Vụ A');
  await accounts.changePassword('matkhau-toi-cao1', 'matkhaumoi2026');
  await accounts.lock();
  await accounts.unlock('matkhaumoi2026');
  assert.equal(store.get('cases')[0].ten, 'Vụ A');

  await accounts.createUser({ name: 'Điều tra viên', email: 'dtv@ca.vn', password: 'dieutra2026', role: 'investigator' });
  accounts.logout(true);
  const u = await accounts.login({ email: 'dtv@ca.vn', password: 'dieutra2026' });
  assert.ok(u.recoveryCode);
  store.set('records', [{ id: 'r', noiDung: 'lời khai mật' }]);
  await cipher.flush();
  accounts.logout(true);
  await accounts.login({ email: 'gsnvbu@gmail.com', password: 'matkhaumoi2026' });
  assert.deepEqual(store.get('records', []), [], 'tài khoản khác không thấy');
  const dtv = accounts.list().find((x) => x.email === 'dtv@ca.vn');
  await accounts.resetPassword(dtv.id, 'matkhaucap2026');
  accounts.logout(true);
  await assert.rejects(() => accounts.login({ email: 'dtv@ca.vn', password: 'matkhaucap2026' }), (e) => e.code === 'NEED_RECOVERY');
  await assert.rejects(() => accounts.recover('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF'), /không đúng/);
  await accounts.recover(u.recoveryCode.toLowerCase().replace(/-/g, ' '));
  assert.equal(store.get('records')[0].noiDung, 'lời khai mật');
  const code2 = await accounts.regenerateRecovery('matkhaucap2026');
  assert.notEqual(normRecovery(code2), normRecovery(u.recoveryCode));
  assert.equal(newRecoveryCode().length, 29);
  accounts.logout(true);
  for (let i = 0; i < 5; i++) await accounts.login({ email: 'dtv@ca.vn', password: 'sai' }).catch(() => {});
  await assert.rejects(() => accounts.login({ email: 'dtv@ca.vn', password: 'matkhaucap2026' }), /tạm khóa/);
  await reset();
});

test('dữ liệu mã hóa kiểu cũ (v2.34, mã hóa tại chỗ) được chuyển sang vùng bảo mật khi mở khóa', async () => {
  await reset();
  const key = await importDataKey(randomBytes(32));
  await cipher.open('u:x1:', key);
  setScope('x1');
  store.set('cases', [{ ten: 'Vụ cũ đã mã hóa' }]);
  await cipher.close();
  assert.ok(isEnvelope(rawStore.get('u:x1:cases')));
  await cipher.open('s:x1:', key, { legacy: 'u:x1:' });
  assert.equal(JSON.parse(cipher.get('s:x1:cases'))[0].ten, 'Vụ cũ đã mã hóa');
  await cipher.close();
  assert.equal(rawStore.getRaw('u:x1:cases'), null, 'bản cũ đã gỡ');
  assert.ok(isEnvelope(rawStore.get('s:x1:cases')));
  await reset();
});

test('tệp sao lưu mã hóa bằng mật khẩu riêng', async () => {
  const box = await passphraseSeal('{"docs":[1,2,3]}', 'matkhau-sao-luu');
  assert.equal(box.alg, 'AES-256-GCM');
  assert.doesNotMatch(JSON.stringify(box), /docs/);
  assert.equal(await passphraseOpen(box, 'matkhau-sao-luu'), '{"docs":[1,2,3]}');
  await assert.rejects(() => passphraseOpen(box, 'sai'), /không đúng/);
});
