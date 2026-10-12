// Chế độ bảo mật (dùng trong cơ quan): mọi xử lý chạy nội bộ, chỉ dùng AI nội bộ, chặn mọi kết nối ra Internet,
// bắt buộc mã hóa dữ liệu, tự khóa khi không dùng, mật khẩu mạnh, tạm khóa khi nhập sai nhiều lần.
//
// Chính sách là cấu hình của THIẾT BỊ (quản trị tối cao đặt), áp cho mọi tài khoản trên máy. Bản cài đặt "bảo mật"
// (SECURE_BUILD) luôn bật chế độ này. Chặn kết nối nhiều lớp:
//   1. ai.js kiểm tra địa chỉ trước mỗi lần gọi AI;
//   2. bọc fetch / XMLHttpRequest / WebSocket / EventSource / sendBeacon của trang;
//   3. Content-Security-Policy connect-src chỉ cho phép chính ứng dụng và máy chủ được khai báo;
//   4. bản máy tính: vỏ ứng dụng hủy mọi yêu cầu mạng ra ngoài (desktop/main.cjs).
import { rawStore } from './store.js';
import { SECURE_BUILD } from '../security-build.js';

const KEY = 'security';
const DEFAULTS = { on: false, aiBase: '', aiModel: '', allowHosts: [], strictHosts: true, idleMin: 10, updatedAt: 0, by: '' };

/** Chính sách hiện hành. forced = bản cài bảo mật (không tắt được). */
export function securityPolicy() {
  const p = { ...DEFAULTS, ...(rawStore.get(KEY, {}) || {}) };
  p.allowHosts = (Array.isArray(p.allowHosts) ? p.allowHosts : []).map((h) => String(h).trim().toLowerCase()).filter(Boolean);
  p.idleMin = Math.min(120, Math.max(1, Math.round(+p.idleMin || DEFAULTS.idleMin)));
  p.forced = !!SECURE_BUILD;
  if (p.forced) p.on = true;
  return p;
}
export const secureOn = () => securityPolicy().on;

/** Lưu chính sách (người gọi phải kiểm tra quyền quản trị tối cao). */
export function saveSecurityPolicy(patch, by = '') {
  if (SECURE_BUILD && patch.on === false) throw new Error('Bản cài đặt bảo mật: không thể tắt chế độ bảo mật');
  const cur = { ...DEFAULTS, ...(rawStore.get(KEY, {}) || {}) };
  const next = { ...cur, ...patch, updatedAt: Date.now(), by };
  if (next.aiBase) {
    let u = null;
    try {
      u = new URL(String(next.aiBase).trim());
    } catch {
      /* không hợp lệ */
    }
    if (!u || !/^https?:$/.test(u.protocol) || !u.hostname) throw new Error('Địa chỉ máy chủ AI nội bộ không hợp lệ (vd: http://10.0.0.5:11434/v1)');
  }
  rawStore.set(KEY, next);
  syncDesktopSecurity();
  return securityPolicy();
}

/* ---------------- Địa chỉ được phép ---------------- */

function parseUrl(url, base) {
  try {
    return new URL(String(url), base || (typeof location !== 'undefined' ? location.href : 'http://localhost/'));
  } catch {
    return null;
  }
}
const cleanHost = (h) => String(h || '').replace(/^\[|\]$/g, '').toLowerCase();

/** Máy này (loopback). */
export function isLoopback(host) {
  host = cleanHost(host);
  return host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127\.\d+\.\d+\.\d+$/.test(host);
}

/** Dải địa chỉ mạng nội bộ (RFC 1918, link-local, IPv6 ULA) và tên miền nội bộ. */
export function isPrivateHost(host) {
  host = cleanHost(host);
  if (isLoopback(host)) return true;
  if (/\.(local|lan|internal|intranet|home\.arpa)$/.test(host)) return true;
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  return /^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host);
}

/** Máy chủ khớp danh sách khai báo: "may-chu-ai.ca", "*.noibo.ca" / ".noibo.ca" (cả tên miền con). */
function hostListed(host, list) {
  host = cleanHost(host);
  return list.some((e) => {
    const x = cleanHost(e).replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
    if (!x) return false;
    if (x.startsWith('*.') || x.startsWith('.')) {
      const s = x.replace(/^\*/, '');
      return host.endsWith(s) || host === s.slice(1);
    }
    return host === x;
  });
}

/** Danh sách máy chủ được phép theo chính sách (máy chủ AI nội bộ + danh sách khai báo). */
export function allowedHosts(p = securityPolicy()) {
  const out = [...p.allowHosts];
  const ai = p.aiBase && parseUrl(p.aiBase);
  if (ai) out.unshift(ai.hostname.toLowerCase());
  return [...new Set(out)];
}

/**
 * Kiểm tra một địa chỉ khi chế độ bảo mật bật: { ok, host, reason }.
 * Cho phép: chính ứng dụng (cùng origin), máy này (localhost), máy chủ AI nội bộ và danh sách khai báo; nếu không bật
 * "chỉ máy chủ khai báo" thì cho phép mọi địa chỉ trong mạng nội bộ.
 */
export function checkUrl(url, p = securityPolicy()) {
  const u = parseUrl(url);
  if (!u) return { ok: false, host: String(url), reason: 'Địa chỉ không hợp lệ' };
  if (/^(data|blob|app|about|chrome-extension):$/.test(u.protocol)) return { ok: true, host: u.protocol };
  const host = cleanHost(u.hostname);
  if (typeof location !== 'undefined' && u.origin === location.origin) return { ok: true, host };
  if (!p.on) return { ok: true, host };
  if (isLoopback(host)) return { ok: true, host };
  if (hostListed(host, allowedHosts(p))) return { ok: true, host };
  if (!p.strictHosts && isPrivateHost(host)) return { ok: true, host };
  return { ok: false, host, reason: isPrivateHost(host) ? 'Máy chủ nội bộ chưa được quản trị khai báo' : 'Địa chỉ Internet công cộng' };
}

export class SecurityBlockError extends Error {
  constructor(host, reason) {
    super(`Chế độ bảo mật đã chặn kết nối tới ${host} (${reason}). Chỉ dùng được máy chủ nội bộ do quản trị khai báo.`);
    this.name = 'SecurityBlockError';
    this.code = 'SEC_BLOCK';
    this.host = host;
  }
}

let onBlock = null;
/** Ứng dụng đăng ký để ghi nhật ký mỗi lần chặn. */
export const setSecurityBlockHook = (fn) => (onBlock = fn);

/** Ném lỗi nếu địa chỉ không được phép (dùng trước mỗi lần gọi AI). */
export function assertAllowedUrl(url) {
  const r = checkUrl(url);
  if (r.ok) return;
  onBlock?.(r);
  throw new SecurityBlockError(r.host, r.reason);
}

/** Địa chỉ máy chủ AI có được dùng trong chế độ bảo mật không (khi chính sách đã khai báo máy chủ AI thì phải đúng máy đó). */
export function aiEndpointAllowed(base, p = securityPolicy()) {
  if (!p.on) return true;
  if (!base) return false;
  const u = parseUrl(base);
  if (!u) return false;
  if (p.aiBase) {
    const a = parseUrl(p.aiBase);
    return !!a && a.origin === u.origin;
  }
  return checkUrl(u.href, p).ok;
}

/* ---------------- Chặn kết nối trong trình duyệt ---------------- */

let guarded = false;
let cspApplied = false;

function guardUrl(url) {
  if (!secureOn()) return;
  assertAllowedUrl(typeof url === 'string' ? url : url?.url || String(url));
}

/** Bọc các API mạng của trang và gắn CSP. Gọi một lần khi khởi động (an toàn nếu gọi lại). */
export function applyNetworkGuard() {
  if (typeof window === 'undefined') return;
  if (!guarded) {
    guarded = true;
    const origFetch = window.fetch?.bind(window);
    if (origFetch) {
      window.fetch = (input, init) => {
        try {
          guardUrl(input);
        } catch (err) {
          return Promise.reject(err);
        }
        return origFetch(input, init);
      };
    }
    const X = window.XMLHttpRequest;
    if (X) {
      const open = X.prototype.open;
      X.prototype.open = function (method, url, ...rest) {
        guardUrl(url);
        return open.call(this, method, url, ...rest);
      };
    }
    for (const name of ['WebSocket', 'EventSource']) {
      const C = window[name];
      if (!C) continue;
      window[name] = new Proxy(C, {
        construct(target, args) {
          guardUrl(args[0]);
          return new target(...args);
        },
      });
    }
    if (navigator.sendBeacon) {
      const beacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = (url, data) => {
        if (secureOn() && !checkUrl(url).ok) return false;
        return beacon(url, data);
      };
    }
  }
  if (secureOn()) applyCsp();
  syncDesktopSecurity();
}

/** Content-Security-Policy: chỉ kết nối tới chính ứng dụng, máy này và máy chủ được khai báo. */
export function cspFor(p = securityPolicy()) {
  const hosts = allowedHosts(p).flatMap((h) => (h.startsWith('*.') || h.startsWith('.') ? [`http://*${h.replace(/^\*/, '')}:*`, `https://*${h.replace(/^\*/, '')}:*`] : [`http://${h.includes(':') ? `[${h}]` : h}:*`, `https://${h.includes(':') ? `[${h}]` : h}:*`]));
  const connect = ["'self'", 'blob:', 'data:', 'http://localhost:*', 'http://127.0.0.1:*', ...hosts];
  return [`connect-src ${connect.join(' ')}`, "img-src 'self' data: blob:", "object-src 'none'", "frame-src 'self' blob: data:", "form-action 'self'", "base-uri 'self'"].join('; ');
}

function applyCsp() {
  if (cspApplied || typeof document === 'undefined') return;
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = cspFor();
  document.head.prepend(meta);
  cspApplied = true;
}
export const cspActive = () => cspApplied;

/** Thử gọi một địa chỉ Internet công cộng: chế độ bảo mật phải chặn ngay, không có gói tin nào đi ra. */
export async function selfTestBlock(url = 'https://api.anthropic.com/v1/models') {
  if (typeof window === 'undefined') return { blocked: false };
  try {
    await window.fetch(url, { method: 'HEAD', cache: 'no-store' });
    return { blocked: false };
  } catch (err) {
    return { blocked: err?.code === 'SEC_BLOCK' || /chặn|Content Security|blocked/i.test(String(err?.message)), message: err?.message || String(err) };
  }
}

/* ---------------- Bản máy tính ---------------- */

const desktopApi = () => (typeof window !== 'undefined' ? window.tlvbDesktop?.security : null);

/** Báo cho vỏ ứng dụng máy tính để chặn mạng ở tầng ứng dụng (vỏ cũ không có API này thì bỏ qua). */
export function syncDesktopSecurity() {
  const api = desktopApi();
  if (!api?.set) return;
  const p = securityPolicy();
  api.set({ on: p.on, hosts: allowedHosts(p), strict: p.strictHosts }).catch?.(() => {});
}

/** Trạng thái chặn mạng ở vỏ ứng dụng: { supported, on, forced, blocked } (bản web: supported = false). */
export async function desktopSecurityStatus() {
  const api = desktopApi();
  if (!api?.status) return { supported: false };
  try {
    return { supported: true, ...(await api.status()) };
  } catch {
    return { supported: false };
  }
}

/* ---------------- Mật khẩu ---------------- */

/** Chính sách mật khẩu: chế độ bảo mật cần ≥ 10 ký tự, có chữ và số. */
export function passwordProblem(pw) {
  const s = String(pw || '');
  if (s.length < 8) return 'Mật khẩu tối thiểu 8 ký tự';
  if (secureOn()) {
    if (s.length < 10) return 'Chế độ bảo mật: mật khẩu tối thiểu 10 ký tự';
    if (!/\p{L}/u.test(s) || !/\d/.test(s)) return 'Chế độ bảo mật: mật khẩu phải có cả chữ và số';
  }
  return '';
}

/** Tạm khóa đăng nhập sau nhiều lần sai (chế độ bảo mật): 5 lần sai → khóa 5 phút, mỗi lần tiếp theo gấp đôi. */
const FAILS = 'auth-fails';
export function loginBlockedFor(email, now = Date.now()) {
  if (!secureOn()) return 0;
  const f = (rawStore.get(FAILS, {}) || {})[email];
  return f?.until > now ? Math.ceil((f.until - now) / 60000) : 0;
}
export function recordLoginFail(email, now = Date.now()) {
  if (!secureOn()) return;
  const all = rawStore.get(FAILS, {}) || {};
  const f = all[email] || { n: 0, until: 0, rounds: 0 };
  f.n++;
  if (f.n >= 5) {
    f.until = now + 5 * 60000 * 2 ** f.rounds;
    f.rounds++;
    f.n = 0;
  }
  all[email] = f;
  rawStore.set(FAILS, all);
}
export function clearLoginFails(email) {
  const all = rawStore.get(FAILS, {}) || {};
  if (!all[email]) return;
  delete all[email];
  rawStore.set(FAILS, all);
}
