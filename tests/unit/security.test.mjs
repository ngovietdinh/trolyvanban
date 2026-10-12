import test from 'node:test';
import assert from 'node:assert/strict';
import { store, rawStore, setScope, isEnvelope } from '../../assets/js/lib/store.js';
import { cipher, importDataKey, randomBytes, passphraseSeal, passphraseOpen } from '../../assets/js/lib/cipher.js';
import { securityPolicy, saveSecurityPolicy, checkUrl, isPrivateHost, aiEndpointAllowed, passwordProblem, loginBlockedFor, recordLoginFail, clearLoginFails, cspFor } from '../../assets/js/lib/security.js';
import { accounts, vault, newRecoveryCode, normRecovery } from '../../assets/js/lib/accounts.js';
import { assertAiAllowed, PROVIDERS, setLocalEndpoint } from '../../assets/js/lib/ai.js';
import { khoDb } from '../../assets/js/lib/kho-db.js';

const reset = async () => {
  await cipher.close();
  for (const k of rawStore.keys()) rawStore.remove(k);
  accounts.logout(true);
};

test('lớp mã hóa: ghi vào là bản mã AES-GCM, đọc ra đúng bản rõ, khóa lại thì không đọc được', async () => {
  await reset();
  setScope('u1');
  store.set('cases', [{ id: 'c1', ten: 'Vụ tham ô tại Công ty X' }]); // dữ liệu cũ dạng rõ
  const key = await importDataKey(randomBytes(32));
  await cipher.open('u1', key);
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
  await cipher.open('u1', key);
  assert.equal(store.get('records')[0].loiKhai, 'Tôi nhận 100 triệu đồng');
  const box = rawStore.get('u:u1:records');
  await cipher.close();
  rawStore.set('u:u1:cases', box);
  await cipher.open('u1', key);
  assert.deepEqual(store.get('cases', 'hỏng'), 'hỏng', 'bản mã của mục khác không giải mã được');
  await cipher.close();
  // Khóa khác → không giải mã được.
  await cipher.open('u1', await importDataKey(randomBytes(32)));
  assert.equal(store.get('records', null), null);
  await reset();
});

test('kho tài liệu (IndexedDB): nội dung và tệp gốc được mã hóa; đang khóa không đọc được', async () => {
  await reset();
  setScope('u2');
  const key = await importDataKey(randomBytes(32));
  await cipher.open('u2', key);
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

test('tài khoản: bật chế độ bảo mật → mã hóa dữ liệu, mã khôi phục; đổi mật khẩu; quản trị đặt lại → mở bằng mã khôi phục', async () => {
  await reset();
  const admin = await accounts.register({ name: 'Quản trị', email: 'gsnvbu@gmail.com', password: 'matkhau-toi-cao1' });
  assert.equal(admin.recoveryCode, undefined, 'chưa bật chế độ bảo mật: chưa mã hóa');
  store.set('cases', [{ id: 'c1', ten: 'Vụ A' }]);
  await vault.write({ providers: { local: { base: 'http://localhost:11434/v1', model: 'qwen' } } });
  saveSecurityPolicy({ on: true });
  // Chế độ bảo mật: khóa phiên chỉ trong bộ nhớ; sau khi "tải lại" phải mở khóa.
  assert.equal(accounts.needsUnlock(), true);
  const r = await accounts.unlock('matkhau-toi-cao1');
  assert.match(r.recoveryCode, /^([2-9A-HJKMNP-TV-Z]{4}-){5}[2-9A-HJKMNP-TV-Z]{4}$/);
  assert.equal(accounts.current().encrypted, true);
  assert.equal(store.get('cases')[0].ten, 'Vụ A');
  await cipher.flush();
  assert.ok(isEnvelope(rawStore.get(`u:${admin.id}:cases`)));
  assert.equal((await vault.read()).providers.local.model, 'qwen');
  // Khóa → không đọc được; mở bằng mật khẩu sai bị từ chối.
  await accounts.lock();
  assert.equal(accounts.needsUnlock(), true);
  assert.deepEqual(store.get('cases', []), []);
  await assert.rejects(() => accounts.unlock('sai-mat-khau-1'), /không đúng/);
  await accounts.unlock('matkhau-toi-cao1');
  assert.equal(store.get('cases')[0].ten, 'Vụ A');
  // Đổi mật khẩu: dữ liệu vẫn mở được bằng mật khẩu mới.
  await accounts.changePassword('matkhau-toi-cao1', 'matkhaumoi2026');
  await accounts.lock();
  await accounts.unlock('matkhaumoi2026');
  assert.equal(store.get('cases')[0].ten, 'Vụ A');

  // Tài khoản thứ hai, bị quản trị đặt lại mật khẩu.
  await accounts.createUser({ name: 'Điều tra viên', email: 'dtv@ca.vn', password: 'dieutra2026', role: 'investigator' });
  accounts.logout(true);
  const u = await accounts.login({ email: 'dtv@ca.vn', password: 'dieutra2026' });
  assert.ok(u.recoveryCode, 'đăng nhập lần đầu khi đã bật chế độ bảo mật → mã hóa và cấp mã khôi phục');
  store.set('records', [{ id: 'r', noiDung: 'lời khai mật' }]);
  await cipher.flush();
  accounts.logout(true);
  await accounts.login({ email: 'gsnvbu@gmail.com', password: 'matkhaumoi2026' });
  const dtv = accounts.list().find((x) => x.email === 'dtv@ca.vn');
  await accounts.resetPassword(dtv.id, 'matkhaucap2026');
  assert.equal(accounts.list().find((x) => x.email === 'dtv@ca.vn').needsRecovery, true);
  accounts.logout(true);
  await assert.rejects(() => accounts.login({ email: 'dtv@ca.vn', password: 'matkhaucap2026' }), (e) => e.code === 'NEED_RECOVERY');
  await assert.rejects(() => accounts.recover('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF'), /không đúng/);
  await accounts.recover(u.recoveryCode.toLowerCase().replace(/-/g, ' '));
  assert.equal(store.get('records')[0].noiDung, 'lời khai mật');
  // Mã khôi phục mới: mã cũ hết hiệu lực.
  const code2 = await accounts.regenerateRecovery('matkhaucap2026');
  assert.notEqual(normRecovery(code2), normRecovery(u.recoveryCode));
  assert.equal(newRecoveryCode().length, 29);
  // Tạm khóa sau 5 lần sai.
  accounts.logout(true);
  for (let i = 0; i < 5; i++) await accounts.login({ email: 'dtv@ca.vn', password: 'sai' }).catch(() => {});
  await assert.rejects(() => accounts.login({ email: 'dtv@ca.vn', password: 'matkhaucap2026' }), /tạm khóa/);
  await reset();
});

test('tệp sao lưu mã hóa bằng mật khẩu riêng', async () => {
  const box = await passphraseSeal('{"docs":[1,2,3]}', 'matkhau-sao-luu');
  assert.equal(box.alg, 'AES-256-GCM');
  assert.doesNotMatch(JSON.stringify(box), /docs/);
  assert.equal(await passphraseOpen(box, 'matkhau-sao-luu'), '{"docs":[1,2,3]}');
  await assert.rejects(() => passphraseOpen(box, 'sai'), /không đúng/);
});
