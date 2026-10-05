// Kho tài liệu hồ sơ: lưu trên máy bằng IndexedDB (dung lượng lớn hơn localStorage), tách riêng theo tài khoản.
// Môi trường không có IndexedDB (kiểm thử Node) → lưu tạm trong bộ nhớ.
import { getScope } from './store.js';

const DB = 'tlvb-kho';
const STORE = 'docs';
let dbp = null;
const mem = new Map();
const hasIDB = () => typeof indexedDB !== 'undefined';

function open() {
  if (!hasIDB()) return null;
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: 'id' });
      s.createIndex('owner', 'owner');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    const out = fn(s);
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Không lưu được vào kho (có thể đã hết dung lượng trình duyệt)'));
  });
}

const owner = () => getScope() || 'anon';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const khoDb = {
  /** Danh sách tài liệu của tài khoản (không kèm tệp gốc để nhẹ). */
  async list() {
    const o = owner();
    let all;
    if (!hasIDB()) all = [...mem.values()].filter((d) => d.owner === o);
    else all = await tx('readonly', (s) => s.index('owner').getAll(o));
    return all.map(({ blob, ...d }) => ({ ...d, hasFile: !!blob })).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async get(id) {
    const d = hasIDB() ? await tx('readonly', (s) => s.get(id)) : mem.get(id);
    return d && d.owner === owner() ? d : null;
  },
  async put(doc) {
    const now = Date.now();
    const rec = { ...doc, id: doc.id || uid(), owner: owner(), createdAt: doc.createdAt || now, updatedAt: now };
    if (!hasIDB()) mem.set(rec.id, rec);
    else await tx('readwrite', (s) => s.put(rec));
    return rec;
  },
  /** Cập nhật một phần (giữ nguyên tệp gốc). */
  async patch(id, patch) {
    const d = await this.get(id);
    if (!d) return null;
    return this.put({ ...d, ...patch });
  },
  async remove(id) {
    const d = await this.get(id);
    if (!d) return;
    if (!hasIDB()) mem.delete(id);
    else await tx('readwrite', (s) => s.delete(id));
  },
  /** Xóa toàn bộ kho của tài khoản hiện tại (dùng khi “Xóa toàn bộ dữ liệu”). */
  async clear() {
    const items = await this.list();
    for (const d of items) await this.remove(d.id);
    return items.length;
  },
};
