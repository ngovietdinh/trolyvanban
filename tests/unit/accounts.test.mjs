import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accounts, vault, effectivePerms, ROLES, PERMS, SUPER_EMAIL, setSystemConfig, auditLog } from '../../assets/js/lib/accounts.js';
import { rawStore, store, getScope } from '../../assets/js/lib/store.js';

const PW = 'matkhau-toi-cao';

test('luồng đầy đủ: tối cao, vai trò, quyền, kho khóa mã hóa, quản trị', async () => {
  // Quản trị tối cao
  const sup = await accounts.register({ name: 'Quản trị', email: 'GSNVBU@gmail.com', password: PW });
  assert.equal(sup.role, 'superadmin');
  assert.equal(sup.email, SUPER_EMAIL);
  assert.deepEqual([...sup.permSet].sort(), PERMS.map((p) => p.id).sort());
  assert.equal(getScope(), sup.id);
  const raw = JSON.stringify(rawStore.get('users'));
  assert.ok(!raw.includes(PW), 'không lưu mật khẩu rõ');

  // Kho API key mã hóa
  await vault.write({ providers: { openai: { key: 'sk-secret-123', model: 'gpt-4o' } } });
  assert.ok(!JSON.stringify(rawStore.get('users')).includes('sk-secret-123'));
  assert.equal((await vault.read()).providers.openai.key, 'sk-secret-123');

  // Dữ liệu theo tài khoản
  store.set('docs', [{ id: 'd1' }]);
  assert.ok(rawStore.has(`u:${sup.id}:docs`));
  assert.ok(!rawStore.has('docs'));

  // Đổi mật khẩu giữ kho khóa
  await assert.rejects(accounts.changePassword('sai', 'moi-123456'), /không đúng/);
  await accounts.changePassword(PW, 'moi-123456');
  accounts.logout();
  assert.equal(accounts.current(), null);
  assert.deepEqual((await vault.read()).providers, {});
  await assert.rejects(accounts.login({ email: SUPER_EMAIL, password: PW }), /không đúng/);
  await accounts.login({ email: SUPER_EMAIL, password: 'moi-123456' });
  assert.equal((await vault.read()).providers.openai.key, 'sk-secret-123');

  // Tạo tài khoản, phân quyền
  const inv = await accounts.createUser({ name: 'Điều tra viên', email: 'dtv@ca.vn', password: 'matkhau123', role: 'investigator' });
  assert.ok(inv.permSet.has('legal'));
  assert.ok(!inv.permSet.has('legal.ai'), 'AI trong tố tụng mặc định tắt');
  await assert.rejects(accounts.createUser({ name: 'X', email: SUPER_EMAIL, password: 'matkhau123' }), /dành riêng/);
  const upd = accounts.updateUser(inv.id, { perms: { 'legal.ai': true, ai: false } });
  assert.ok(upd.permSet.has('legal.ai') && !upd.permSet.has('ai'));
  assert.throws(() => accounts.updateUser(sup.id, { role: 'user' }), /Không thể hạ quyền/);
  assert.throws(() => accounts.updateUser(sup.id, { locked: true }), /Không thể/);
  assert.throws(() => accounts.deleteUser(sup.id), /Không thể xóa/);

  // Quản trị viên thường bị giới hạn
  const adm = await accounts.createUser({ name: 'QTV', email: 'qtv@ca.vn', password: 'matkhau123', role: 'admin' });
  accounts.logout();
  await accounts.login({ email: 'qtv@ca.vn', password: 'matkhau123' });
  assert.throws(() => accounts.updateUser(sup.id, { name: 'Đổi tên' }), /quản trị tối cao/);
  await assert.rejects(accounts.createUser({ name: 'A2', email: 'a2@ca.vn', password: 'matkhau123', role: 'admin' }), /Chỉ quản trị tối cao/);
  assert.throws(() => accounts.updateUser(inv.id, { perms: { users: true } }), /Chỉ quản trị tối cao/);
  assert.throws(() => accounts.updateUser(adm.id, { locked: true }), /tự khóa|Chỉ quản trị tối cao/);

  // Khóa tài khoản và đặt lại mật khẩu
  accounts.updateUser(inv.id, { locked: true });
  accounts.logout();
  await assert.rejects(accounts.login({ email: 'dtv@ca.vn', password: 'matkhau123' }), /bị khóa/);
  await accounts.login({ email: SUPER_EMAIL, password: 'moi-123456' });
  accounts.updateUser(inv.id, { locked: false });
  accounts.logout();
  await accounts.login({ email: 'dtv@ca.vn', password: 'matkhau123' });
  await vault.write({ providers: { gemini: { key: 'AIza-dtv' } } });
  assert.equal(store.get('docs', []).length, 0, 'không thấy dữ liệu tài khoản khác');
  accounts.logout();
  await accounts.login({ email: SUPER_EMAIL, password: 'moi-123456' });
  await accounts.resetPassword(inv.id, 'cap-lai-123');
  accounts.logout();
  await accounts.login({ email: 'dtv@ca.vn', password: 'cap-lai-123' });
  assert.deepEqual((await vault.read()).providers, {}, 'đặt lại mật khẩu xóa kho khóa');

  // Tắt tự đăng ký
  setSystemConfig({ allowSignup: false });
  accounts.logout();
  await assert.rejects(accounts.register({ name: 'Mới', email: 'moi@x.vn', password: 'matkhau123' }), /Đăng ký đang tắt/);
  assert.ok(auditLog().some((a) => a.action === 'Đặt lại mật khẩu'));
});

test('quyền thực tế = mặc định vai trò + ghi đè', () => {
  assert.deepEqual([...effectivePerms({ role: 'user', perms: {} })].sort(), [...ROLES.user.perms].sort());
  const p = effectivePerms({ role: 'user', perms: { legal: true, ai: false } });
  assert.ok(p.has('legal') && !p.has('ai'));
  assert.equal(effectivePerms({ role: 'superadmin', perms: { legal: false } }).has('legal'), true);
  assert.equal(effectivePerms(null).size, 0);
});
