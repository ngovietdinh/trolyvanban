// Kho bản án đã xét xử và án lệ của người dùng (để tìm bản án tương tự, đối chiếu án lệ): lưu trên máy bằng IndexedDB,
// tách riêng theo tài khoản và môi trường; môi trường bảo mật mã hóa toàn bộ bản ghi.
import { getEnv, dataOwner } from '../lib/store.js';
import { cipher } from '../lib/cipher.js';

const DB = 'tlvb-court-ba';
const STORE = 'docs';
let dbp = null;
const mem = new Map();
const hasIDB = () => typeof indexedDB !== 'undefined';
const open = () => {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'k' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
};
async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(typeof IDBRequest !== 'undefined' && out instanceof IDBRequest ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Không lưu được vào kho bản án (có thể trình duyệt đã hết dung lượng)'));
  });
}
const prefix = () => `${dataOwner()}|`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function seal(doc) {
  if (getEnv() !== 'secure') return { k: prefix() + doc.id, doc };
  if (!cipher.active()) throw new Error('Dữ liệu đang khóa — mở khóa để tiếp tục');
  return { k: prefix() + doc.id, $e: await cipher.sealJson(doc, `ct-ba:${doc.id}`) };
}
async function unseal(r) {
  if (!r) return null;
  if (r.$e) return cipher.active() ? cipher.openJson(r.$e, `ct-ba:${r.k.split('|').pop()}`) : null;
  return r.doc;
}

export const courtBaDb = {
  async put(doc) {
    const d = { ...doc, id: doc.id || uid(), at: doc.at || Date.now() };
    const r = await seal(d);
    if (!hasIDB()) mem.set(r.k, r);
    else await tx('readwrite', (s) => s.put(r));
    return d;
  },
  async list() {
    const p = prefix();
    const all = !hasIDB() ? [...mem.values()] : await tx('readonly', (s) => s.getAll());
    const out = [];
    for (const r of (all || []).filter((x) => String(x.k).startsWith(p))) {
      const d = await unseal(r).catch(() => null);
      if (d) out.push(d);
    }
    return out.sort((a, b) => (b.at || 0) - (a.at || 0));
  },
  async remove(id) {
    const k = prefix() + id;
    if (!hasIDB()) mem.delete(k);
    else await tx('readwrite', (s) => s.delete(k));
  },
};
