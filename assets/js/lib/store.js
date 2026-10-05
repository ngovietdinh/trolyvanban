// Lưu trữ cục bộ an toàn: localStorage có thể bị chặn (chế độ ẩn danh, chính sách trình duyệt),
// khi đó tự động dùng bộ nhớ tạm để ứng dụng vẫn hoạt động bình thường.

const PREFIX = 'tlvb:';
const memory = new Map();

function backend() {
  try {
    const k = '__tlvb_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}
const ls = typeof window !== 'undefined' ? backend() : null;

export const store = {
  get(key, fallback = null) {
    try {
      const raw = ls ? ls.getItem(PREFIX + key) : memory.get(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    const raw = JSON.stringify(value);
    try {
      if (ls) ls.setItem(PREFIX + key, raw);
      else memory.set(PREFIX + key, raw);
    } catch {
      memory.set(PREFIX + key, raw);
    }
    return value;
  },
  remove(key) {
    try {
      ls?.removeItem(PREFIX + key);
    } catch {
      /* bỏ qua */
    }
    memory.delete(PREFIX + key);
  },
  update(key, fn, fallback = null) {
    return this.set(key, fn(this.get(key, fallback)));
  },
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- Tài liệu đã lưu ---------- */
export const docsRepo = {
  list() {
    return store.get('docs', []).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id) {
    return store.get('docs', []).find((d) => d.id === id) || null;
  },
  save(doc) {
    const now = Date.now();
    const all = store.get('docs', []);
    const idx = all.findIndex((d) => d.id === doc.id);
    const rec = { ...doc, id: doc.id || uid(), updatedAt: now, createdAt: doc.createdAt || now };
    if (idx >= 0) all[idx] = rec;
    else all.push(rec);
    store.set('docs', all);
    return rec;
  },
  remove(id) {
    store.set(
      'docs',
      store.get('docs', []).filter((d) => d.id !== id),
    );
  },
  toggleStar(id) {
    const all = store.get('docs', []);
    const d = all.find((x) => x.id === id);
    if (d) d.starred = !d.starred;
    store.set('docs', all);
    return d;
  },
};

/* ---------- Tài khoản (bản dùng thử lưu trên thiết bị) ---------- */
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const auth = {
  current() {
    return store.get('session', null);
  },
  async register({ name, email, password }) {
    email = String(email || '').trim().toLowerCase();
    if (!name?.trim()) throw new Error('Vui lòng nhập họ tên');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Email không hợp lệ');
    if (String(password || '').length < 8) throw new Error('Mật khẩu tối thiểu 8 ký tự');
    const users = store.get('users', []);
    if (users.some((u) => u.email === email)) throw new Error('Email đã được đăng ký');
    const user = { id: uid(), name: name.trim(), email, hash: await sha256(email + ':' + password), plan: 'free', createdAt: Date.now() };
    users.push(user);
    store.set('users', users);
    return this._login(user);
  },
  async login({ email, password }) {
    email = String(email || '').trim().toLowerCase();
    const user = store.get('users', []).find((u) => u.email === email);
    if (!user || user.hash !== (await sha256(email + ':' + password))) throw new Error('Email hoặc mật khẩu không đúng');
    return this._login(user);
  },
  _login(user) {
    const session = { id: user.id, name: user.name, email: user.email, plan: user.plan };
    store.set('session', session);
    return session;
  },
  logout() {
    store.remove('session');
  },
};

/* ---------- Thống kê sử dụng ---------- */
export const usage = {
  track(kind) {
    store.update('usage', (u) => ({ ...u, [kind]: (u[kind] || 0) + 1, last: Date.now() }), {});
  },
  get() {
    return store.get('usage', {});
  },
};
