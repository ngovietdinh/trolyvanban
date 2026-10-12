// Mã hóa dữ liệu lưu trên máy (AES-256-GCM, Web Crypto API của trình duyệt — không tự cài đặt thuật toán).
//
// - Mỗi tài khoản có một khóa dữ liệu ngẫu nhiên 256 bit (DEK). DEK được "bọc" (mã hóa) bằng khóa sinh từ mật khẩu
//   (PBKDF2-SHA256, 310.000 vòng — accounts.js) và bằng mã khôi phục; không lưu DEK dạng rõ ở bất kỳ đâu.
// - Khi mở khóa, DEK được nạp thành CryptoKey KHÔNG xuất được (non-extractable), chỉ nằm trong bộ nhớ.
// - Dữ liệu theo tài khoản trong localStorage: giải mã một lần vào bộ nhớ đệm (đọc đồng bộ như trước), mỗi lần ghi
//   thì mã hóa lại rồi lưu. Dữ liệu gắn với tên khóa (AAD) nên không tráo được bản mã giữa các mục.
// - Khóa / đăng xuất / tự khóa: ghi nốt dữ liệu, xóa khóa và bộ nhớ đệm.
import { rawStore, setCipher, SCOPED_KEYS, isEnvelope } from './store.js';

const te = new TextEncoder();
const td = new TextDecoder();
export const b64 = (buf) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const subtle = () => globalThis.crypto.subtle;
export const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** Nạp khóa dữ liệu (32 byte) thành CryptoKey AES-GCM không xuất được. */
export const importDataKey = (raw) => subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

async function encRaw(key, bytes, aad) {
  const iv = randomBytes(12);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(aad) }, key, bytes);
  return { iv, ct: new Uint8Array(ct) };
}
async function decRaw(key, iv, ct, aad) {
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: te.encode(aad) }, key, ct));
}

/* ---------------- Mã hóa bằng cụm mật khẩu (tệp sao lưu) ---------------- */
const PASS_ITER = 310000;
async function passKey(pass, salt, iter, usage) {
  const base = await subtle().importKey('raw', te.encode(String(pass).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, usage);
}
/** Mã hóa văn bản bằng cụm mật khẩu → hộp JSON tự mô tả (thuật toán, số vòng, muối). */
export async function passphraseSeal(text, pass) {
  const salt = randomBytes(16);
  const key = await passKey(pass, salt, PASS_ITER, ['encrypt']);
  const { iv, ct } = await encRaw(key, te.encode(text), 'tlvb-backup');
  return { alg: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iter: PASS_ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}
export async function passphraseOpen(box, pass) {
  try {
    const key = await passKey(pass, unb64(box.salt), box.iter || PASS_ITER, ['decrypt']);
    return td.decode(await decRaw(key, unb64(box.iv), unb64(box.ct), 'tlvb-backup'));
  } catch {
    throw new Error('Mật khẩu tệp sao lưu không đúng hoặc tệp đã bị sửa');
  }
}

/* ---------------- Lớp mã hóa dữ liệu tài khoản ---------------- */
let key = null;
let owner = null;
const cache = new Map(); // khóa đầy đủ → chuỗi JSON (bản rõ, chỉ trong bộ nhớ)
const dirty = new Set();
let chain = Promise.resolve();
let scheduled = false;
const openHooks = [];
let listening = false;

async function sealText(text, aad) {
  const { iv, ct } = await encRaw(key, te.encode(text), aad);
  return { $e: 1, iv: b64(iv), ct: b64(ct) };
}
async function openText(box, aad, k = key) {
  return td.decode(await decRaw(k, unb64(box.iv), unb64(box.ct), aad));
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    cipher.flush().catch(() => {});
  });
}

function onStorage(e) {
  // Thẻ khác của ứng dụng vừa ghi dữ liệu đã mã hóa → cập nhật bộ nhớ đệm của thẻ này.
  if (!key || !e.key?.startsWith(`tlvb:u:${owner}:`) || e.newValue == null) return;
  const full = e.key.slice(5);
  let v;
  try {
    v = JSON.parse(e.newValue);
  } catch {
    return;
  }
  if (!isEnvelope(v)) return;
  const k = key;
  openText(v, full, k)
    .then((pt) => k === key && !dirty.has(full) && cache.set(full, pt))
    .catch(() => {});
}

export const cipher = {
  active: () => !!key,
  owner: () => owner,
  owns: (full) => !!key && full.startsWith(`u:${owner}:`),
  get: (full) => (cache.has(full) ? cache.get(full) : null),
  set(full, json) {
    cache.set(full, json);
    dirty.add(full);
    schedule();
  },
  remove(full) {
    cache.delete(full);
    dirty.delete(full);
    rawStore.remove(full);
  },

  /** Mở khóa dữ liệu của tài khoản: giải mã vào bộ nhớ đệm; dữ liệu cũ chưa mã hóa được mã hóa ngay. */
  async open(userId, cryptoKey) {
    await this.close();
    key = cryptoKey;
    owner = userId;
    for (const k of SCOPED_KEYS) {
      const full = `u:${userId}:${k}`;
      const raw = rawStore.getRaw(full);
      if (raw == null) continue;
      let v;
      try {
        v = JSON.parse(raw);
      } catch {
        continue;
      }
      if (isEnvelope(v)) {
        try {
          cache.set(full, await openText(v, full));
        } catch {
          // Không giải mã được (hỏng hoặc bị sửa): giữ nguyên bản mã, không ghi đè.
        }
      } else {
        cache.set(full, raw);
        dirty.add(full);
      }
    }
    setCipher(this);
    if (typeof window !== 'undefined' && !listening) {
      listening = true;
      window.addEventListener('storage', onStorage);
      const flushNow = () => this.flush().catch(() => {});
      window.addEventListener('pagehide', flushNow);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushNow());
    }
    await this.flush();
    for (const fn of openHooks) await Promise.resolve(fn()).catch(() => {});
  },

  /** Ghi mọi thay đổi đang chờ (đã mã hóa) xuống máy. */
  flush() {
    chain = chain.then(async () => {
      while (key && dirty.size) {
        const list = [...dirty];
        dirty.clear();
        const k = key;
        for (const full of list) {
          if (!cache.has(full)) continue;
          const box = await sealText(cache.get(full), full);
          if (k !== key) return;
          rawStore.set(full, box);
        }
      }
    });
    return chain;
  },

  /** Khóa: ghi nốt dữ liệu rồi xóa khóa và bộ nhớ đệm. */
  async close() {
    if (!key) return;
    await this.flush();
    key = null;
    owner = null;
    cache.clear();
    dirty.clear();
    setCipher(null);
  },

  /** Các kho khác (IndexedDB) đăng ký để mã hóa dữ liệu cũ khi mở khóa. */
  onOpen(fn) {
    openHooks.push(fn);
  },

  /* Mã hóa nhị phân / JSON cho IndexedDB (bản mã giữ dạng nhị phân, không base64). */
  async sealBytes(bytes, aad) {
    if (!key) throw new Error('Dữ liệu đang khóa');
    return encRaw(key, bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), aad);
  },
  async openBytes(box, aad) {
    if (!key) throw new Error('Dữ liệu đang khóa');
    return decRaw(key, box.iv, box.ct, aad);
  },
  async sealJson(obj, aad) {
    return this.sealBytes(te.encode(JSON.stringify(obj)), aad);
  },
  async openJson(box, aad) {
    return JSON.parse(td.decode(await this.openBytes(box, aad)));
  },

  /** Thống kê mục dữ liệu của một tài khoản trên máy: đã mã hóa / còn dạng rõ. */
  stats(userId) {
    let enc = 0;
    let plain = 0;
    for (const k of SCOPED_KEYS) {
      const v = rawStore.get(`u:${userId}:${k}`);
      if (v == null) continue;
      if (isEnvelope(v)) enc++;
      else plain++;
    }
    return { enc, plain };
  },
};
