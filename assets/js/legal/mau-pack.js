// Gói biểu mẫu chính thức (Thông tư 128/2025/TT-BCA): dựng gói từ thư mục Word (công cụ dòng lệnh),
// nạp gói vào máy (IndexedDB, tách theo tài khoản), tự điền từ hồ sơ vụ án và xuất bằng đúng bố cục mẫu gốc.
// Nội dung biểu mẫu KHÔNG nằm trong mã nguồn hay bản cài đặt: chỉ gói do người dùng nạp mới có.
import { createZip, readZip } from '../lib/docx.js';
import { parseTemplateDocx } from '../lib/tpl-docx.js';
import { fillMauDocx } from '../lib/mau-docx.js';
import { getScope } from '../lib/store.js';
import { analyzeMau, isFrameForm, loaiOf, norm } from './mau-analyze.js';

export const PACK_VERSION = 1;
const GROUP_HEAD = /^(\d{1,2})\.\s+(Biểu mẫu|Sổ|Bìa)/u;

const normKy = (k) => String(k || '').replace(/^0+(?=\d)/, '').toUpperCase();
const kyNum = (k) => parseInt(String(k).replace(/\D/g, ''), 10) || 0;

/** Đọc "Danh mục biểu mẫu": nhóm, số thứ tự, tên mẫu, ký hiệu (số mẫu); danh sách mẫu Công an cấp xã được dùng. */
export function parseIndex(paragraphs) {
  const ps = paragraphs.filter((p) => p.part.includes('document')).map((p) => p.text.trim());
  const items = [];
  let group = 0;
  let xa = [];
  for (let i = 0; i < ps.length; i++) {
    const head = GROUP_HEAD.exec(ps[i]);
    if (head && ps[i].length > 12) {
      group = +head[1];
      continue;
    }
    if (/^\d+$/.test(ps[i]) && ps[i + 1] && ps[i + 2] && /^\d{1,3}[A-ZĐa-z]*$/.test(ps[i + 2]) && !/^\d+$/.test(ps[i + 1])) {
      items.push({ group, stt: +ps[i], ten: ps[i + 1].replace(/\s+/g, ' '), ky: ps[i + 2] });
      i += 2;
      continue;
    }
    const m = /Công an cấp xã được sử dụng.*?Biểu mẫu số:\s*(.+?)\./u.exec(ps[i]);
    if (m) xa = m[1].split(/[,\s]+/).filter(Boolean).map(normKy);
  }
  return { items, xa };
}

/**
 * Dựng gói từ danh sách tệp Word [{ name, data }] (tên tệp dạng "27. Quyết định khởi tố vụ án hình sự.docx").
 * Trả về { bytes (ZIP), report }.
 */
export async function buildPack(files, { built = new Date().toISOString() } = {}) {
  const indexFile = files.find((f) => /Danh mục/iu.test(f.name.normalize('NFC')));
  if (!indexFile) throw new Error('Không thấy tệp “Danh mục” biểu mẫu trong thư mục');
  const idx = parseIndex((await parseTemplateDocx(indexFile.data.buffer.slice(indexFile.data.byteOffset, indexFile.data.byteOffset + indexFile.data.byteLength))).paragraphs);
  const byKy = new Map(idx.items.map((it) => [normKy(it.ky), it]));
  const xa = new Set(idx.xa);
  const out = [];
  const forms = [];
  const report = [];
  const seen = new Set();
  const sorted = files.filter((f) => f !== indexFile).sort((a, b) => kyNum(a.name) - kyNum(b.name) || a.name.localeCompare(b.name, 'vi'));
  for (const f of sorted) {
    const name = f.name.normalize('NFC');
    const m = /^(\d+[A-Za-zĐđ]*)\.\s*(.*?)(?:\.docx?)+$/u.exec(name);
    if (!m) continue;
    const ky = normKy(m[1]);
    if (seen.has(ky)) continue;
    seen.add(ky);
    const item = byKy.get(ky);
    const near = [...idx.items].filter((it) => kyNum(it.ky) <= kyNum(ky)).sort((a, b) => kyNum(b.ky) - kyNum(a.ky))[0];
    const ten = item?.ten || m[2].replace(/\s+/g, ' ').trim();
    // Mẫu có tệp nhưng thiếu trong Danh mục: bìa hồ sơ thuộc nhóm 12, còn lại theo mẫu liền trước.
    const group = item?.group || (/^bìa/iu.test(ten) ? 12 : near?.group || 1);
    const buf = f.data.buffer.slice(f.data.byteOffset, f.data.byteOffset + f.data.byteLength);
    const parsed = await parseTemplateDocx(buf, { blankLeader: true });
    const frame = isFrameForm(ten);
    const a = analyzeMau(parsed.paragraphs, { ten, frame });
    const id = `m${ky.toLowerCase()}`;
    forms.push({ id, so: item?.ky || m[1], ten, nhom: group, stt: item?.stt || 0, loai: loaiOf(ten), frame, xa: xa.has(ky), fields: a.fields, persons: a.persons, notes: a.notes });
    out.push({ name: `docx/${id}.docx`, data: f.data });
    report.push({ id, so: item?.ky || m[1], ten, nhom: group, fields: a.stats.fields, slots: a.stats.slots, persons: a.persons.length, marks: a.notes.marks.length, frame, inIndex: !!item });
  }
  const missing = idx.items.filter((it) => !seen.has(normKy(it.ky))).map((it) => ({ so: it.ky, ten: it.ten, nhom: it.group }));
  const meta = { v: PACK_VERSION, tt: '128/2025/TT-BCA', built, count: forms.length, missing, forms };
  const bytes = createZip([{ name: 'mau-pack.json', data: JSON.stringify(meta) }, ...out]);
  return { bytes, report, missing, meta };
}

/* ---------------- Nạp, lưu trên máy ---------------- */

/** Đọc gói ZIP → { meta, files: { id: Uint8Array } }. */
export async function readPack(buffer) {
  const zip = await readZip(buffer);
  const raw = await zip.read('mau-pack.json');
  if (!raw) throw new Error('Không phải gói biểu mẫu (thiếu mau-pack.json)');
  const meta = JSON.parse(new TextDecoder().decode(raw));
  if (meta.v !== PACK_VERSION || !Array.isArray(meta.forms)) throw new Error('Gói biểu mẫu không đúng phiên bản');
  const files = {};
  for (const f of meta.forms) {
    const d = await zip.read(`docx/${f.id}.docx`);
    if (d) files[f.id] = d;
  }
  return { meta, files };
}

const DB = 'tlvb-mau';
const STORE = 'pack';
let dbp = null;
const mem = new Map();
const hasIDB = () => typeof indexedDB !== 'undefined';
const owner = () => getScope() || 'anon';
const open = () => {
  if (!hasIDB()) return null;
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
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Không lưu được gói biểu mẫu (có thể trình duyệt đã hết dung lượng)'));
  });
}
const kMeta = () => `${owner()}|meta`;
const kFile = (id) => `${owner()}|f|${id}`;

export const mauDb = {
  /** Lưu gói đã đọc (thay thế gói cũ của tài khoản). */
  async save({ meta, files }) {
    await this.clear();
    if (!hasIDB()) {
      mem.set(kMeta(), meta);
      for (const [id, data] of Object.entries(files)) mem.set(kFile(id), data);
      return;
    }
    await tx('readwrite', (s) => {
      s.put({ k: kMeta(), meta });
      for (const [id, data] of Object.entries(files)) s.put({ k: kFile(id), data });
    });
  },
  async meta() {
    if (!hasIDB()) return mem.get(kMeta()) || null;
    return (await tx('readonly', (s) => s.get(kMeta())))?.meta || null;
  },
  async docx(id) {
    if (!hasIDB()) return mem.get(kFile(id)) || null;
    return (await tx('readonly', (s) => s.get(kFile(id))))?.data || null;
  },
  async clear() {
    const prefix = `${owner()}|`;
    if (!hasIDB()) {
      for (const k of [...mem.keys()]) if (k.startsWith(prefix)) mem.delete(k);
      return;
    }
    await tx('readwrite', (s) => {
      const req = s.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        if (String(c.key).startsWith(prefix)) c.delete();
        c.continue();
      };
    });
  },
};

/* ---------------- Giá trị, tự điền ---------------- */

const p2 = (n) => String(n).padStart(2, '0');
const upper = (s) => String(s || '').trim().toLocaleUpperCase('vi-VN');

/** "2026-10-05" | "05/10/2026" | "05-10-2026" → { d, m, y } hoặc null. */
export function parseDate(v) {
  const s = String(v || '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return { d: +m[1], m: +m[2], y: +m[3] };
  m = /^(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})$/iu.exec(s);
  if (m) return { d: +m[1], m: +m[2], y: +m[3] };
  return null;
}
export const isoOf = (d) => (d ? `${d.y}-${p2(d.m)}-${p2(d.d)}` : '');
const dayText = (n) => p2(n);
const monthText = (n) => (n <= 2 ? p2(n) : String(n));

const SINGLE = { gioiTinh: 'gioiTinh', tenKhac: 'tenKhac', noiSinh: 'noiSinh', quocTich: 'quocTich', danToc: 'danToc', tonGiao: 'tonGiao', ngheNghiep: 'ngheNghiep', soDinhDanh: 'soDinhDanh', noiCap: 'noiCap', noiCuTru: 'noiCuTru', noiTamTru: 'noiTamTru', noiOHienTai: 'noiOHienTai', noiLamViec: 'noiLamViec', chucVu: 'chucVu', hoTen: 'hoTen' };

/** Giá trị gợi ý cho các trường của mẫu từ cơ quan, vụ án và người được chọn cho từng "Người n". Số văn bản luôn để trống. */
export function mauPrefill(form, { org = {}, caseItem = null, persons = [], findCrime = null, now = new Date() } = {}) {
  const v = {};
  const has = new Set(form.fields.map((f) => f.key));
  const put = (k, val) => {
    const t = String(val ?? '').trim();
    if (t && has.has(k)) v[k] = t;
  };
  put('coQuanCapTren', upper(org.coQuanCapTren));
  put('coQuan', upper(org.coQuan));
  put('kyHieuCq', org.kyHieu);
  put('diaDanh', org.diaDanh);
  put('ngayVb', `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`);
  put('vks', org.vks);
  put('diaDiem', org.diaDiem);
  put('chucDanhKy', upper(org.thamQuyen || (org.coQuan ? `THỦ TRƯỞNG ${org.coQuan}` : '')));
  put('coQuanDT', String(org.coQuan || '').replace(/^cơ quan\s+/iu, ''));
  put('dtv1', org.dieuTraVien);
  if (org.dieuTraVien) {
    const line = `${org.dieuTraVien}, ${org.chucDanh || 'Điều tra viên'}`;
    put('dtv', line);
    put('thanhPhan', line);
  }
  if (caseItem) {
    put('tenVu', caseItem.ten);
    const crimes = (caseItem.toiDanh || []).map((d) => (findCrime ? findCrime(d) : null)).filter(Boolean);
    if (crimes.length) {
      put('toiTen', crimes.map((c) => c.ten.replace(/^Tội\s+/iu, '').toLocaleLowerCase('vi-VN')).join('; '));
      put('dieuBLHS', [...new Set(crimes.map((c) => c.dieu))].join(', '));
    }
  }
  persons.forEach((p, n) => {
    if (!p) return;
    for (const [sem, prop] of Object.entries(SINGLE)) put(`p${n}.${sem}`, p[prop]);
    const d = parseDate(p.ngaySinh);
    if (d) put(`p${n}.ngaySinh`, isoOf(d));
    else put(`p${n}.ngaySinh`, p.ngaySinh);
    if (p.ngayCap) put(`p${n}.ngayCap`, isoOf(parseDate(p.ngayCap)) || p.ngayCap);
  });
  return v;
}

/** Chuyển giá trị người dùng nhập thành danh sách thao tác thay thế trên mẫu gốc. */
export function mauOps(form, values = {}, { stripNotes = true } = {}) {
  const ops = [];
  const drops = [];
  const slotOp = (s, value, size) => {
    const o = { part: s.part, i: s.i, s: s.s, e: s.e, value: value ? `${s.sp ? ' ' : ''}${value}${s.sa ? ' ' : ''}` : value };
    if (size) o.size = size;
    ops.push(o);
  };
  // Đoạn căn đều hai bên: ngắt dòng cưỡng bức sẽ giãn chữ → nối các dòng bằng dấu chấm phẩy.
  const flat = (v) =>
    v
      .split(/\n+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x, k, a) => (k < a.length - 1 ? (/[.;:!?]$/.test(x) ? `${x} ` : `${x}; `) : x))
      .join('');
  for (const f of form.fields) {
    const raw = values[f.key];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    const v = String(raw).trim();
    if (f.kind === 'date') {
      const d = parseDate(v);
      f.slots.forEach((s, k) => {
        if (!d) return slotOp(s, k === 0 ? v : '');
        slotOp(s, s.role === 'd' ? dayText(d.d) : s.role === 'm' ? monthText(d.m) : String(d.y));
      });
    } else if (f.kind === 'time') {
      const m = /^(\d{1,2}):(\d{2})/.exec(v);
      f.slots.forEach((s, k) => {
        if (!m) return slotOp(s, k === 0 ? v : '');
        slotOp(s, s.role === 'h' ? String(+m[1]) : p2(+m[2]));
      });
    } else if (f.kind === 'lines') {
      const lines = v.split('\n').map((x) => x.trim());
      f.slots.forEach((s, k) => {
        const line = k === f.slots.length - 1 ? lines.slice(k).filter(Boolean).join('; ') : lines[k];
        if (line) slotOp(s, line);
      });
    } else {
      const text = f.kind === 'long' ? v : v.replace(/\s*\n\s*/g, ', ');
      const size = f.sem === 'coQuanCapTren' || f.sem === 'coQuan' ? 24 : 0; // dòng đầu mẫu nằm trong cột hẹp
      // Trường dùng chung có nhiều chỗ điền → cùng một nội dung; dòng chấm nối tiếp bị bỏ khi đã có nội dung.
      f.slots.forEach((s) => (s.drop ? drops.push({ part: s.part, i: s.i }) : slotOp(s, s.j ? flat(text) : text, size)));
    }
  }
  if (stripNotes && form.notes) {
    for (const m of form.notes.marks || []) ops.push({ part: m.part, i: m.i, s: m.s, e: m.e, value: '' });
    drops.push(...(form.notes.paras || []));
  }
  return { ops, drops, stripFootnotes: !!stripNotes };
}

/** Điền biểu mẫu: trả về Uint8Array .docx giữ nguyên bố cục mẫu. */
export function fillMau(form, buffer, values, opts) {
  const { ops, drops, stripFootnotes } = mauOps(form, values, opts);
  return fillMauDocx(buffer, ops, drops, { stripFootnotes });
}

/** Tìm kiếm tên mẫu hoặc số mẫu (không dấu). */
export function matchMau(form, q) {
  const n = norm(q).trim().replace(/^mau\s+(?=\d)/, '');
  if (!n) return true;
  // Gõ số mẫu (27, 02a…) → khớp đúng số mẫu; còn lại tìm trong tên mẫu.
  if (/^\d+[a-z]?$/.test(n) && normKy(form.so).toLowerCase() === n.replace(/^0+(?=\d)/, '')) return true;
  return norm(form.ten).includes(n);
}
