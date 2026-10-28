// Tải một tệp / trang từ đường dẫn trên mạng về làm File để đọc như tệp người dùng chọn (bản án, án lệ từ cổng của
// Tòa án). Bản cài đặt máy tính tải qua vỏ ứng dụng (không vướng hạn chế tải chéo của trình duyệt, vẫn tuân theo chế độ
// bảo mật); bản web dùng fetch của trình duyệt — trang không cho tải chéo thì báo rõ cách khác.
import { desktop } from './platform.js';

const EXT = { 'application/pdf': '.pdf', 'application/msword': '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx', 'text/plain': '.txt', 'text/html': '.html' };
/** Tên tệp từ Content-Disposition, đuôi đường dẫn hoặc kiểu nội dung. */
export function fileNameFrom(disposition, url, type = '') {
  const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition || '');
  if (m) {
    try {
      return decodeURIComponent(m[1] || m[2]).trim();
    } catch {
      return (m[1] || m[2]).trim();
    }
  }
  let base = '';
  try {
    base = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '');
  } catch {
    base = '';
  }
  const ext = EXT[String(type).split(';')[0].trim()] || '';
  if (base && /\.[a-z0-9]{2,5}$/i.test(base)) return base;
  return `${base || 'tai-ve'}${ext || '.html'}`;
}

/** HTML của trang → chữ (bỏ script, style, menu); giữ xuống dòng theo khối. */
export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script, style, noscript, nav, header, footer, iframe, svg').forEach((n) => n.remove());
  const root = doc.querySelector('main, article, #content, .content') || doc.body || doc.documentElement;
  for (const el of root.querySelectorAll('p, div, br, li, tr, h1, h2, h3, h4, h5, h6, td')) el.append('\n');
  return (root.textContent || '')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/**
 * Tải url → { name, type, file }. Lỗi ném ra có lời giải thích để người dùng biết cách khác (tải tệp về rồi kéo vào).
 */
export async function fetchDocument(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) throw new Error('Đường dẫn phải bắt đầu bằng http:// hoặc https://');
  if (desktop?.net?.fetch) {
    const r = await desktop.net.fetch(u);
    if (!r?.ok) throw new Error(r?.error || `Máy chủ trả về mã ${r?.status || '?'}`);
    const bytes = b64(r.data || '');
    return { name: r.name, type: r.type || '', file: new File([bytes], r.name, { type: (r.type || '').split(';')[0] }) };
  }
  let res;
  try {
    res = await fetch(u, { mode: 'cors', credentials: 'omit' });
  } catch (e) {
    throw new Error(`Trình duyệt không tải được từ địa chỉ này (trang không cho phần mềm khác tải chéo, hoặc mạng đang bị chặn). Cách khác: mở liên kết, tải tệp bản án về máy rồi kéo vào ô “Nạp văn bản”; bản cài đặt máy tính tải thẳng được.${e?.message ? ` (${e.message})` : ''}`);
  }
  if (!res.ok) throw new Error(`Máy chủ trả về mã ${res.status}`);
  const blob = await res.blob();
  const type = (res.headers.get('content-type') || blob.type || '').split(';')[0];
  const name = fileNameFrom(res.headers.get('content-disposition'), u, type);
  return { name, type, file: new File([blob], name, { type }) };
}

export const isHtmlFile = (f) => /text\/html/i.test(f.type || '') || /\.html?$/i.test(f.name || '');
