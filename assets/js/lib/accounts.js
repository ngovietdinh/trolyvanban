// Tài khoản, vai trò, phân quyền và kho API key mã hóa — toàn bộ lưu trên máy người dùng.
//
// Bảo mật:
// - Mật khẩu: PBKDF2-SHA256 (310.000 vòng, muối ngẫu nhiên). Kết quả 512 bit được tách đôi:
//   256 bit đầu băm SHA-256 để xác thực, 256 bit sau làm khóa AES-GCM của kho API key.
//   => Không lưu mật khẩu; không có mật khẩu thì không giải mã được kho khóa (kể cả quản trị viên).
// - Phiên đăng nhập và khóa giải mã chỉ nằm trong sessionStorage của thẻ trình duyệt hiện tại.
// - Quản trị đặt lại mật khẩu → kho API key của tài khoản đó bị xóa (không thể khôi phục).

import { rawStore, sessionStore, setScope, uid, SCOPED_KEYS } from './store.js';
import { isDesktop } from './platform.js';

export const SUPER_EMAIL = 'gsnvbu@gmail.com';
const ITER = 310000;

export const PERMS = [
  { id: 'docs', label: 'Văn bản hành chính', desc: 'Soạn văn bản, thư viện mẫu, tài liệu của tôi, trợ lý cơ bản' },
  { id: 'tools', label: 'Công cụ văn bản', desc: 'Kiểm tra chính tả, tóm tắt văn bản, đọc số thành chữ' },
  { id: 'ai', label: 'AI trực tuyến cho văn bản', desc: 'Gửi nội dung tới ChatGPT, Gemini, Grok, Groq, Claude bằng API key của mình' },
  { id: 'legal', label: 'Phân hệ Tố tụng hình sự', desc: 'Cây hỏi đáp pháp luật, ghi lời khai, hồ sơ vụ án (chạy cục bộ)' },
  { id: 'legal.ai', label: 'AI trực tuyến trong Tố tụng', desc: 'Cho phép gửi nội dung lời khai, hồ sơ tới dịch vụ AI bên ngoài' },
  { id: 'users', label: 'Quản lý tài khoản & phân quyền', desc: 'Tạo, khóa, đặt lại mật khẩu, cấp quyền cho tài khoản khác' },
];

/**
 * Vai trò mặc định khi tự đăng ký.
 * - Web: Người dùng, chờ quản trị cấp quyền (Tố tụng ẩn, không AI trực tuyến trong Tố tụng).
 * - Bản cài đặt trên máy (Windows/macOS): toàn quyền. Tài khoản đầu tiên trên máy là quản trị tối cao,
 *   các tài khoản sau là quản trị viên có đủ mọi quyền (kể cả Tố tụng và AI trong Tố tụng).
 */
export function signupDefaults({ superAcc = false, firstUser = false, desktop = isDesktop } = {}) {
  if (superAcc) return { role: 'superadmin', perms: {}, pending: false };
  if (!desktop) return { role: 'user', perms: {}, pending: true };
  if (firstUser) return { role: 'superadmin', perms: {}, pending: false };
  const base = new Set(ROLES.admin.perms);
  return { role: 'admin', perms: Object.fromEntries(PERMS.filter((p) => !base.has(p.id)).map((p) => [p.id, true])), pending: false };
}

export const ROLES = {
  superadmin: { label: 'Quản trị tối cao', perms: PERMS.map((p) => p.id) },
  admin: { label: 'Quản trị viên', perms: ['docs', 'tools', 'ai', 'legal', 'users'] },
  investigator: { label: 'Điều tra viên', perms: ['docs', 'tools', 'ai', 'legal'] },
  user: { label: 'Người dùng', perms: ['docs', 'tools', 'ai'] },
};

/* ---------------- Tiện ích mã hóa ---------------- */
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const randomB64 = (n) => b64(crypto.getRandomValues(new Uint8Array(n)));

async function deriveMaterial(password, saltB64, iterations = ITER) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations }, base, 512));
  const authHash = b64(await crypto.subtle.digest('SHA-256', bits.slice(0, 32)));
  return { authHash, vaultKey: b64(bits.slice(32)) };
}

const aesKey = (keyB64, usage) => crypto.subtle.importKey('raw', unb64(keyB64), 'AES-GCM', false, usage);

async function encryptJson(obj, keyB64) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyB64, ['encrypt']), enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}

async function decryptJson(box, keyB64) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, await aesKey(keyB64, ['decrypt']), unb64(box.ct));
  return JSON.parse(dec.decode(pt));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ---------------- Lưu trữ tài khoản ---------------- */
const users = () => rawStore.get('users', []);
const saveUsers = (list) => rawStore.set('users', list);
const normEmail = (e) => String(e || '').trim().toLowerCase();
const isSuperEmail = (e) => normEmail(e) === SUPER_EMAIL;

export function audit(action, detail = '') {
  const s = sessionStore.get('session');
  const list = rawStore.get('audit', []);
  list.unshift({ at: Date.now(), by: s?.email || 'hệ thống', action, detail });
  rawStore.set('audit', list.slice(0, 300));
}
export const auditLog = () => rawStore.get('audit', []);

export function systemConfig() {
  return { allowSignup: true, ...rawStore.get('system', {}) };
}
export function setSystemConfig(patch) {
  rawStore.set('system', { ...systemConfig(), ...patch });
}

/** Quyền thực tế của tài khoản: mặc định theo vai trò, ghi đè từng quyền lẻ. */
export function effectivePerms(user) {
  if (!user) return new Set();
  if (user.role === 'superadmin') return new Set(ROLES.superadmin.perms);
  const set = new Set(ROLES[user.role]?.perms || []);
  for (const [p, on] of Object.entries(user.perms || {})) on ? set.add(p) : set.delete(p);
  return set;
}

function publicUser(u) {
  if (!u) return null;
  const { pwHash, pwSalt, iter, vault, ...rest } = u;
  return { ...rest, hasVault: !!vault, roleLabel: ROLES[u.role]?.label || u.role, permSet: effectivePerms(u) };
}

function validatePassword(pw) {
  if (String(pw || '').length < 8) throw new Error('Mật khẩu tối thiểu 8 ký tự');
}

async function buildCredentials(password) {
  const pwSalt = randomB64(16);
  const m = await deriveMaterial(password, pwSalt);
  return { pwSalt, pwHash: m.authHash, iter: ITER, vaultKey: m.vaultKey };
}

/* ---------------- Phiên đăng nhập ---------------- */
function startSession(user, vaultKey) {
  sessionStore.set('session', { id: user.id, email: user.email, at: Date.now() });
  sessionStore.set(`vk:${user.id}`, vaultKey);
  setScope(user.id);
}

/** Chuyển dữ liệu của phiên bản cũ (chưa có tài khoản) sang tài khoản quản trị tối cao đầu tiên. */
async function migrateLegacy(user, vaultKey) {
  if (rawStore.get('legacy-migrated')) return;
  rawStore.set('legacy-migrated', true);
  for (const k of SCOPED_KEYS) {
    if (rawStore.has(k) && !rawStore.has(`u:${user.id}:${k}`)) rawStore.set(`u:${user.id}:${k}`, rawStore.get(k));
    rawStore.remove(k);
  }
  const old = rawStore.get(`u:${user.id}:settings`, {});
  if (old.apiKey) {
    await writeVault(user.id, vaultKey, { providers: { anthropic: { key: old.apiKey, model: old.model || '' } } });
    delete old.apiKey;
    rawStore.set(`u:${user.id}:settings`, { ...old, aiProvider: 'anthropic' });
  }
  rawStore.remove('session');
  rawStore.remove('users-legacy');
}

export const accounts = {
  hasUsers: () => users().length > 0,
  superExists: () => users().some((u) => u.role === 'superadmin'),
  list: () => users().map(publicUser),
  /** Số tài khoản tự đăng ký đang chờ quản trị cấp quyền. */
  pendingCount: () => users().filter((u) => u.pending).length,

  current() {
    const s = sessionStore.get('session');
    if (!s) return null;
    const u = users().find((x) => x.id === s.id);
    if (!u || u.locked) {
      this.logout(true);
      return null;
    }
    setScope(u.id);
    return publicUser(u);
  },

  can(perm) {
    const u = this.current();
    return !!u && u.permSet.has(perm);
  },

  async register({ name, email, password }) {
    email = normEmail(email);
    if (!String(name || '').trim()) throw new Error('Vui lòng nhập họ tên');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Email không hợp lệ');
    validatePassword(password);
    const all = users();
    if (all.some((u) => u.email === email)) throw new Error('Email đã được đăng ký');
    const superAcc = isSuperEmail(email);
    if (!superAcc && !systemConfig().allowSignup) throw new Error('Đăng ký đang tắt. Liên hệ quản trị viên để được cấp tài khoản.');
    const cred = await buildCredentials(password);
    const def = signupDefaults({ superAcc, firstUser: !all.length });
    const user = { id: uid(), name: name.trim(), email, pwHash: cred.pwHash, pwSalt: cred.pwSalt, iter: cred.iter, vault: null, role: def.role, perms: def.perms, locked: false, pending: def.pending, createdAt: Date.now(), lastLogin: Date.now() };
    saveUsers([...all, user]);
    startSession(user, cred.vaultKey);
    if (user.role === 'superadmin') await migrateLegacy(user, cred.vaultKey);
    audit('Đăng ký tài khoản', `${user.email} (${ROLES[user.role].label})`);
    return publicUser(user);
  },

  async login({ email, password }) {
    email = normEmail(email);
    const all = users();
    const u = all.find((x) => x.email === email);
    const fail = () => new Error('Email hoặc mật khẩu không đúng');
    if (!u) throw fail();
    const m = await deriveMaterial(password, u.pwSalt, u.iter || ITER);
    if (!safeEqual(m.authHash, u.pwHash)) {
      audit('Đăng nhập thất bại', email);
      throw fail();
    }
    if (u.locked) throw new Error('Tài khoản đã bị khóa. Liên hệ quản trị viên.');
    u.lastLogin = Date.now();
    saveUsers(all);
    startSession(u, m.vaultKey);
    if (u.role === 'superadmin') await migrateLegacy(u, m.vaultKey);
    audit('Đăng nhập', email);
    return publicUser(u);
  },

  logout(silent = false) {
    const s = sessionStore.get('session');
    if (s) {
      sessionStore.remove(`vk:${s.id}`);
      if (!silent) audit('Đăng xuất', s.email);
    }
    sessionStore.remove('session');
    setScope(null);
  },

  async changePassword(oldPw, newPw) {
    const me = this.current();
    if (!me) throw new Error('Chưa đăng nhập');
    validatePassword(newPw);
    const all = users();
    const u = all.find((x) => x.id === me.id);
    const m = await deriveMaterial(oldPw, u.pwSalt, u.iter || ITER);
    if (!safeEqual(m.authHash, u.pwHash)) throw new Error('Mật khẩu hiện tại không đúng');
    const data = u.vault ? await decryptJson(u.vault, m.vaultKey) : null;
    const cred = await buildCredentials(newPw);
    Object.assign(u, { pwHash: cred.pwHash, pwSalt: cred.pwSalt, iter: cred.iter, vault: data ? await encryptJson(data, cred.vaultKey) : null });
    saveUsers(all);
    sessionStore.set(`vk:${u.id}`, cred.vaultKey);
    audit('Đổi mật khẩu', u.email);
  },

  /* ----- Quản trị ----- */
  assertManage(target, { role } = {}) {
    const me = this.current();
    if (!me?.permSet.has('users')) throw new Error('Bạn không có quyền quản lý tài khoản');
    if (target?.role === 'superadmin' && me.role !== 'superadmin') throw new Error('Không thể thay đổi tài khoản quản trị tối cao');
    if (me.role !== 'superadmin' && (target?.role === 'admin' || role === 'admin' || role === 'superadmin')) throw new Error('Chỉ quản trị tối cao mới quản lý được quản trị viên');
    if (role === 'superadmin') throw new Error('Không thể cấp vai trò quản trị tối cao');
    return me;
  },

  async createUser({ name, email, password, role = 'user', perms = {} }) {
    this.assertManage(null, { role });
    email = normEmail(email);
    if (!String(name || '').trim()) throw new Error('Vui lòng nhập họ tên');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Email không hợp lệ');
    if (isSuperEmail(email)) throw new Error('Email này được dành riêng cho quản trị tối cao');
    validatePassword(password);
    const all = users();
    if (all.some((u) => u.email === email)) throw new Error('Email đã tồn tại');
    const me = this.current();
    if (me.role !== 'superadmin' && perms.users) throw new Error('Chỉ quản trị tối cao mới cấp quyền quản lý tài khoản');
    const cred = await buildCredentials(password);
    const user = { id: uid(), name: name.trim(), email, pwHash: cred.pwHash, pwSalt: cred.pwSalt, iter: cred.iter, vault: null, role, perms, locked: false, createdAt: Date.now(), lastLogin: null };
    saveUsers([...all, user]);
    audit('Tạo tài khoản', `${email} — ${ROLES[role].label}`);
    return publicUser(user);
  },

  updateUser(id, { name, role, perms, locked }) {
    const all = users();
    const u = all.find((x) => x.id === id);
    if (!u) throw new Error('Không tìm thấy tài khoản');
    const me = this.assertManage(u, { role: role && role !== u.role ? role : undefined });
    if (u.role === 'superadmin') {
      if ((role && role !== 'superadmin') || locked) throw new Error('Không thể hạ quyền hoặc khóa tài khoản quản trị tối cao');
    }
    if (u.id === me.id && locked) throw new Error('Không thể tự khóa tài khoản của mình');
    if (me.role !== 'superadmin' && perms && perms.users !== undefined && !!perms.users !== effectivePerms(u).has('users')) throw new Error('Chỉ quản trị tối cao mới cấp quyền quản lý tài khoản');
    const changes = [];
    if (name !== undefined && name.trim() && name.trim() !== u.name) {
      u.name = name.trim();
      changes.push('họ tên');
    }
    if (role && role !== u.role && u.role !== 'superadmin') {
      changes.push(`vai trò ${ROLES[u.role].label} → ${ROLES[role].label}`);
      u.role = role;
    }
    if (perms) {
      // Chỉ lưu những quyền khác với mặc định của vai trò.
      const base = new Set(ROLES[u.role].perms);
      const clean = Object.fromEntries(Object.entries(perms).filter(([p, on]) => base.has(p) !== !!on));
      if (JSON.stringify(clean) !== JSON.stringify(u.perms || {})) changes.push('quyền chi tiết');
      u.perms = clean;
    }
    if (locked !== undefined && !!locked !== !!u.locked) {
      u.locked = !!locked;
      changes.push(locked ? 'khóa tài khoản' : 'mở khóa tài khoản');
    }
    u.pending = false;
    saveUsers(all);
    if (changes.length) audit('Cập nhật tài khoản', `${u.email}: ${changes.join(', ')}`);
    return publicUser(u);
  },

  async resetPassword(id, newPw) {
    const all = users();
    const u = all.find((x) => x.id === id);
    if (!u) throw new Error('Không tìm thấy tài khoản');
    this.assertManage(u);
    validatePassword(newPw);
    const cred = await buildCredentials(newPw);
    Object.assign(u, { pwHash: cred.pwHash, pwSalt: cred.pwSalt, iter: cred.iter, vault: null });
    saveUsers(all);
    audit('Đặt lại mật khẩu', `${u.email} (kho API key đã bị xóa)`);
  },

  deleteUser(id) {
    const all = users();
    const u = all.find((x) => x.id === id);
    if (!u) return;
    const me = this.assertManage(u);
    if (u.role === 'superadmin') throw new Error('Không thể xóa tài khoản quản trị tối cao');
    if (u.id === me.id) throw new Error('Không thể tự xóa tài khoản của mình');
    saveUsers(all.filter((x) => x.id !== id));
    for (const k of SCOPED_KEYS) rawStore.remove(`u:${id}:${k}`);
    audit('Xóa tài khoản', u.email);
  },
};

/* ---------------- Kho API key mã hóa ---------------- */
async function writeVault(userId, vaultKey, data) {
  const all = users();
  const u = all.find((x) => x.id === userId);
  u.vault = await encryptJson(data, vaultKey);
  saveUsers(all);
}

export const vault = {
  /** Đọc kho khóa của tài khoản đang đăng nhập (giải mã trong bộ nhớ). */
  async read() {
    const s = sessionStore.get('session');
    if (!s) return { providers: {} };
    const u = users().find((x) => x.id === s.id);
    const key = sessionStore.get(`vk:${s.id}`);
    if (!u?.vault || !key) return { providers: {} };
    try {
      return await decryptJson(u.vault, key);
    } catch {
      return { providers: {} };
    }
  },
  async write(data) {
    const s = sessionStore.get('session');
    const key = s && sessionStore.get(`vk:${s.id}`);
    if (!key) throw new Error('Phiên đã hết hạn, vui lòng đăng nhập lại');
    await writeVault(s.id, key, data);
  },
};
