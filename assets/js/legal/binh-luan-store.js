// Lưu sách Bình luận khoa học BLHS trên máy này (IndexedDB) — nạp một lần, dùng chung cho mọi tài khoản trên máy.
// Sách là tài liệu tham khảo có bản quyền: KHÔNG nằm trong mã nguồn phần mềm, người dùng tự nạp tệp của mình.
import { parseBinhLuan, verify, findArticle } from './binh-luan.js';

const DB = 'tlvb-binh-luan';
const STORE = 'book';
const KEY = 'book';
const hasIDB = () => typeof indexedDB !== 'undefined';
let mem = null; // dùng khi không có IndexedDB (kiểm thử)
let book = null; // sách đã nạp (trong bộ nhớ)
let loading = null;
const listeners = new Set();

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Không lưu được sách (trình duyệt hết dung lượng?)'));
  });
}

export const bookReady = () => !!book;
export const currentBook = () => book;
export const onBookChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach((fn) => fn(book));

/** Nạp sách đã lưu trên máy vào bộ nhớ (gọi khi mở ứng dụng). */
export function loadBook() {
  loading ??= (async () => {
    try {
      const rec = hasIDB() ? await idb('readonly', (s) => s.get(KEY)) : mem;
      book = rec?.book || null;
      if (book) book.meta = rec.meta;
    } catch {
      book = null;
    }
    emit();
    return book;
  })();
  return loading;
}

/** Từ văn bản sách (đã trích từ tệp) → tách, đối chiếu 100% với bản gốc, lưu. Ném lỗi nếu không đạt. */
export async function importBookText(text, notes, meta = {}) {
  const parsed = parseBinhLuan(text, notes);
  if (parsed.articles.length < 50) throw new Error(`Không nhận ra cấu trúc sách Bình luận Bộ luật Hình sự (chỉ thấy ${parsed.articles.length} điều). Cần tệp có các dòng “Điều N. Tên điều” và “Bình luận”.`);
  const check = verify(text, parsed);
  if (!check.ok) throw new Error(`Không nạp: kiểm tra giữ nguyên nội dung không đạt — ${check.reason}.`);
  const withBl = parsed.articles.filter((a) => a.bl.length).length;
  const rec = { meta: { ...meta, at: Date.now(), articles: parsed.articles.length, withBl, lines: check.lines, notes: parsed.notes.length, tocSkipped: parsed.skipped.toc }, book: parsed };
  if (hasIDB()) await idb('readwrite', (s) => s.put(rec, KEY));
  else mem = rec;
  book = { ...parsed, meta: rec.meta };
  loading = Promise.resolve(book);
  emit();
  return rec.meta;
}

/** Đọc tệp người dùng chọn (.doc, .docx, .txt) rồi nạp. */
export async function importBookFile(file) {
  const name = file.name || 'tệp';
  const buf = new Uint8Array(await file.arrayBuffer());
  let text;
  let notes = [];
  if (/\.(txt|md)$/i.test(name)) text = new TextDecoder().decode(buf);
  else {
    const { docToTextWithNotes } = await import('../lib/doc.js');
    ({ text, notes } = await docToTextWithNotes(buf, name));
  }
  return importBookText(text, notes, { file: name, size: file.size });
}

export async function removeBook() {
  if (hasIDB()) await idb('readwrite', (s) => s.delete(KEY));
  else mem = null;
  book = null;
  loading = Promise.resolve(null);
  emit();
}

export const article = (so) => findArticle(book, so);
