// Mẫu Word của đơn vị cho từng biểu mẫu Tòa án (người dùng tải lên thay mẫu soạn sẵn): lưu trên máy bằng IndexedDB,
// tách riêng theo tài khoản và môi trường (bình thường / bảo mật); môi trường bảo mật mã hóa cả tên tệp và nội dung.
import { getEnv, dataOwner } from '../lib/store.js';
import { cipher } from '../lib/cipher.js';

const DB = 'tlvb-court-tpl';
const STORE = 'tpl';
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
    t.onabort = () => reject(t.error || new Error('Không lưu được mẫu Word (có thể trình duyệt đã hết dung lượng)'));
  });
}
const key = (formId) => `${dataOwner()}|${formId}`;
const mustSeal = () => {
  if (getEnv() !== 'secure') return false;
  if (!cipher.active()) throw new Error('Dữ liệu đang khóa — mở khóa để tiếp tục');
  return true;
};
const rawGet = async (k) => (!hasIDB() ? mem.get(k) || null : (await tx('readonly', (s) => s.get(k))) || null);
const rawAll = async () => {
  const prefix = `${dataOwner()}|`;
  const all = !hasIDB() ? [...mem.values()] : await tx('readonly', (s) => s.getAll());
  return (all || []).filter((r) => String(r.k).startsWith(prefix));
};

export const courtTplDb = {
  /** Lưu (thay) mẫu Word của một biểu mẫu. */
  async put(formId, name, bytes) {
    const k = key(formId);
    const info = { name, size: bytes.length, at: Date.now() };
    const rec = mustSeal() ? { k, formId, $e: await cipher.sealJson(info, `ct-tpl:${formId}`), $b: await cipher.sealBytes(bytes, `ct-tpl-f:${formId}`) } : { k, formId, info, data: bytes };
    if (!hasIDB()) mem.set(k, rec);
    else await tx('readwrite', (s) => s.put(rec));
    return info;
  },
  async info(rec) {
    if (!rec) return null;
    if (rec.$e) return cipher.active() ? cipher.openJson(rec.$e, `ct-tpl:${rec.formId}`) : null;
    return rec.info;
  },
  /** { formId: { name, size, at } } của tài khoản hiện tại. */
  async list() {
    const out = {};
    for (const r of await rawAll()) {
      const info = await this.info(r).catch(() => null);
      if (info) out[r.formId] = info;
    }
    return out;
  },
  /** { name, data: Uint8Array } hoặc null. */
  async get(formId) {
    const r = await rawGet(key(formId));
    if (!r) return null;
    const info = await this.info(r);
    if (!info) return null;
    const data = r.$b ? await cipher.openBytes(r.$b, `ct-tpl-f:${formId}`) : r.data;
    return { ...info, data: data instanceof Uint8Array ? data : new Uint8Array(data) };
  },
  async remove(formId) {
    const k = key(formId);
    if (!hasIDB()) mem.delete(k);
    else await tx('readwrite', (s) => s.delete(k));
  },
};
