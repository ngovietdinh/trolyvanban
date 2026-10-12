// Kho tài liệu hồ sơ: lưu trên máy bằng IndexedDB (dung lượng lớn hơn localStorage), tách riêng theo tài khoản.
// Môi trường không có IndexedDB (kiểm thử Node) → lưu tạm trong bộ nhớ.
import { getScope } from './store.js';
import { cipher } from './cipher.js';

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
    t.oncomplete = () => resolve(typeof IDBRequest !== 'undefined' && out instanceof IDBRequest ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Không lưu được vào kho (có thể đã hết dung lượng trình duyệt)'));
  });
}

const owner = () => getScope() || 'anon';

// Chế độ bảo mật: nội dung tài liệu (thông tin + tệp gốc) được mã hóa AES-GCM; chỉ id, chủ sở hữu, thời gian để rõ
// (cần cho chỉ mục). Bản ghi đã mã hóa mà đang khóa → không trả về.
const SEALED = (d) => !!d?.$e;
async function seal(rec) {
  if (!cipher.active()) return rec;
  const { id, owner: o, createdAt, updatedAt, blob, ...meta } = rec;
  const out = { id, owner: o, createdAt, updatedAt, $e: await cipher.sealJson(meta, `kho:${id}`) };
  if (blob) out.$b = { ...(await cipher.sealBytes(new Uint8Array(await blob.arrayBuffer()), `kho-tep:${id}`)), type: blob.type || '' };
  return out;
}
async function unseal(rec, { file = true } = {}) {
  if (!SEALED(rec)) return rec;
  if (!cipher.active()) return null;
  const meta = await cipher.openJson(rec.$e, `kho:${rec.id}`);
  const out = { ...meta, id: rec.id, owner: rec.owner, createdAt: rec.createdAt, updatedAt: rec.updatedAt };
  if (rec.$b) out.blob = file ? new Blob([await cipher.openBytes(rec.$b, `kho-tep:${rec.id}`)], { type: rec.$b.type }) : true;
  return out;
}
const rawAll = async (o) => (!hasIDB() ? [...mem.values()].filter((d) => d.owner === o) : await tx('readonly', (s) => s.index('owner').getAll(o)));
const rawPut = async (rec) => (!hasIDB() ? mem.set(rec.id, rec) : await tx('readwrite', (s) => s.put(rec)));

// Mở khóa dữ liệu → mã hóa các tài liệu cũ còn dạng rõ của tài khoản.
cipher.onOpen(async () => {
  for (const d of await rawAll(owner())) if (!SEALED(d)) await rawPut(await seal(d));
});
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const khoDb = {
  /** Danh sách tài liệu của tài khoản (không kèm tệp gốc để nhẹ). */
  async list() {
    const out = [];
    for (const r of await rawAll(owner())) {
      const d = await unseal(r, { file: false }).catch(() => null);
      if (!d) continue;
      const { blob, ...rest } = d;
      out.push({ ...rest, hasFile: !!blob });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async get(id) {
    const d = hasIDB() ? await tx('readonly', (s) => s.get(id)) : mem.get(id);
    return d && d.owner === owner() ? unseal(d).catch(() => null) : null;
  },
  async put(doc) {
    const now = Date.now();
    const rec = { ...doc, id: doc.id || uid(), owner: owner(), createdAt: doc.createdAt || now, updatedAt: now };
    await rawPut(await seal(rec));
    return rec;
  },
  /** Cập nhật một phần (giữ nguyên tệp gốc). */
  async patch(id, patch) {
    const d = await this.get(id);
    if (!d) return null;
    return this.put({ ...d, ...patch });
  },
  async remove(id) {
    const d = hasIDB() ? await tx('readonly', (s) => s.get(id)) : mem.get(id);
    if (!d || d.owner !== owner()) return;
    if (!hasIDB()) mem.delete(id);
    else await tx('readwrite', (s) => s.delete(id));
  },
  /** Xóa toàn bộ kho của tài khoản hiện tại (dùng khi “Xóa toàn bộ dữ liệu”). */
  async clear() {
    const items = await rawAll(owner());
    for (const d of items) await this.remove(d.id);
    return items.length;
  },
  /** Thống kê: số tài liệu đã mã hóa / còn dạng rõ của tài khoản hiện tại. */
  async stats() {
    const all = await rawAll(owner());
    return { enc: all.filter(SEALED).length, plain: all.filter((d) => !SEALED(d)).length };
  },
};
