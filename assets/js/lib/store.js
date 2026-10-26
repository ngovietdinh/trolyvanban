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

// Dữ liệu nghiệp vụ được tách riêng theo từng tài khoản: khóa trong danh sách này được tự động
// gắn tiền tố `u:<mã tài khoản>:`. Tài khoản khác đăng nhập trên cùng máy không đọc được.
export const SCOPED_KEYS = [
  'docs', 'chat', 'settings', 'compose-draft', 'usage', 'spell-text', 'summary-text', 'summary-ratio',
  'number-history', 'number-last', 'number-opts', 'cases', 'records', 'plans', 'legal-custom',
  'legal-selection', 'legal-open', 'zoom', 'legal-custom-acts', 'tpl-custom', 'legal-learned', 'ai-cache', 'ai-log', 'legal-docs', 'forms-open', 'kho-sel', 'kho-case', 'kho-app', 'help-seen', 'help-opened', 'help-hint-off', 'spell-dict', 'chat-threads', 'chat-current', 'kho-chat', 'kho-threads', 'kho-current', 'pdf-opts', 'legal-wizard', 'feature-notes', 'case-map-case', 'diagrams', 'groq-usage', 'groq-limits', 'case-map-saves', 'diagram-library', 'statement-sessions', 'statement-current', 'cm-learned', 'court-cases',
];
/** Dữ liệu bị xóa khi “Xóa toàn bộ dữ liệu” (giữ lại tài khoản, API key, cài đặt). */
export const WIPE_KEYS = SCOPED_KEYS.filter((k) => k !== 'settings' && k !== 'zoom' && k !== 'groq-limits');
const SCOPED = new Set(SCOPED_KEYS);
let scope = null;

export function setScope(userId) {
  scope = userId || null;
}
export const getScope = () => scope;

// Hai MÔI TRƯỜNG dữ liệu tách biệt hoàn toàn: bình thường (`u:<tài khoản>:…`) và bảo mật (`s:<tài khoản>:…`, luôn mã
// hóa). Môi trường được xác định một lần khi mở ứng dụng theo chính sách bảo mật (lib/security.js đăng ký bộ xác định)
// và giữ nguyên tới khi tải lại — đổi chính sách thì ứng dụng tải lại. Dữ liệu tạo ở môi trường này không bao giờ
// được đọc / ghi từ môi trường kia.
let envResolver = () => 'normal';
let env = null;
export function setEnvResolver(fn) {
  envResolver = fn;
}
export const getEnv = () => (env ??= envResolver() === 'secure' ? 'secure' : 'normal');
/** Xác định lại môi trường (tương đương tải lại ứng dụng; dùng khi khởi động / kiểm thử). */
export function refreshEnv() {
  env = null;
  return getEnv();
}
/** Tiền tố khóa dữ liệu của một tài khoản trong môi trường hiện tại (hoặc môi trường chỉ định). */
export const dataPrefix = (id, e = getEnv()) => `${e === 'secure' ? 's' : 'u'}:${id || 'anon'}:`;
/** Chủ sở hữu dữ liệu trong IndexedDB (kho tài liệu, gói mẫu): tách theo tài khoản và môi trường. */
export const dataOwner = () => (getEnv() === 'secure' ? `s:${scope || 'anon'}` : scope || 'anon');
const resolve = (key) => (SCOPED.has(key) ? `${dataPrefix(scope)}${key}` : key);

/** Hộp dữ liệu đã mã hóa trong localStorage: {"$e":1,"iv":"…","ct":"…"} (xem lib/cipher.js). */
export const isEnvelope = (v) => !!v && typeof v === 'object' && v.$e === 1 && typeof v.ct === 'string';

// Lớp mã hóa (lib/cipher.js) gắn vào khi tài khoản đã mở khóa: dữ liệu theo tài khoản được đọc từ bộ nhớ đệm đã
// giải mã, ghi vào thì mã hóa AES-GCM rồi mới lưu xuống máy.
let cipher = null;
export function setCipher(c) {
  cipher = c;
}
const viaCipher = (key, full) => cipher && SCOPED.has(key) && cipher.owns(full);

export const store = {
  get(key, fallback = null) {
    const full = resolve(key);
    if (viaCipher(key, full)) {
      const raw = cipher.get(full);
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    }
    // Môi trường bảo mật mà chưa mở khóa: không đọc gì.
    if (SCOPED.has(key) && getEnv() === 'secure') return fallback;
    const v = rawStore.get(full, fallback);
    // Dữ liệu đã mã hóa mà chưa mở khóa: không trả bản mã cho màn hình.
    return isEnvelope(v) ? fallback : v;
  },
  set(key, value) {
    const full = resolve(key);
    if (viaCipher(key, full)) {
      cipher.set(full, JSON.stringify(value));
      return value;
    }
    // Môi trường bảo mật mà chưa mở khóa: không bao giờ ghi bản rõ.
    if (SCOPED.has(key) && getEnv() === 'secure') return value;
    // Đang khóa: không ghi đè dữ liệu đã mã hóa bằng bản rõ.
    if (SCOPED.has(key) && isEnvelope(rawStore.get(full))) return value;
    return rawStore.set(full, value);
  },
  remove(key) {
    const full = resolve(key);
    if (viaCipher(key, full)) cipher.remove(full);
    else if (!(SCOPED.has(key) && getEnv() === 'secure')) rawStore.remove(full);
  },
  update(key, fn, fallback = null) {
    return this.set(key, fn(this.get(key, fallback)));
  },
};

/** Truy cập trực tiếp theo khóa đầy đủ (không gắn phạm vi tài khoản). */
export const rawStore = {
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
  /** Chuỗi JSON nguyên trạng (không giải mã). */
  getRaw(key) {
    try {
      return ls ? ls.getItem(PREFIX + key) : (memory.get(PREFIX + key) ?? null);
    } catch {
      return null;
    }
  },
  /** Mọi khóa (bỏ tiền tố) đang lưu. */
  keys() {
    try {
      if (ls) return Object.keys(ls).filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length));
    } catch {
      /* bỏ qua */
    }
    return [...memory.keys()].filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length));
  },
  has(key) {
    try {
      return ls ? ls.getItem(PREFIX + key) != null : memory.has(PREFIX + key);
    } catch {
      return false;
    }
  },
};

/** Phiên làm việc: lưu trong sessionStorage — tự hết khi đóng thẻ/trình duyệt. */
const sessMem = new Map();
function sessBackend() {
  try {
    window.sessionStorage.setItem('__p', '1');
    window.sessionStorage.removeItem('__p');
    return window.sessionStorage;
  } catch {
    return null;
  }
}
const ss = typeof window !== 'undefined' ? sessBackend() : null;
export const sessionStore = {
  get(key, fallback = null) {
    try {
      const raw = ss ? ss.getItem(PREFIX + key) : sessMem.get(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    const raw = JSON.stringify(value);
    try {
      if (ss) ss.setItem(PREFIX + key, raw);
      else sessMem.set(key, raw);
    } catch {
      sessMem.set(key, raw);
    }
  },
  remove(key) {
    try {
      ss?.removeItem(PREFIX + key);
    } catch {
      /* bỏ qua */
    }
    sessMem.delete(key);
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
  /** Khôi phục nguyên trạng tài liệu đã xóa (hoàn tác). */
  restore(doc) {
    store.set('docs', [...store.get('docs', []).filter((d) => d.id !== doc.id), doc]);
  },
  toggleStar(id) {
    const all = store.get('docs', []);
    const d = all.find((x) => x.id === id);
    if (d) d.starred = !d.starred;
    store.set('docs', all);
    return d;
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
