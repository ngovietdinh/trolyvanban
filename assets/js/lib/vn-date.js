// Tiện ích ngày tháng theo thể thức văn bản hành chính (Nghị định 30/2020/NĐ-CP).
// Quy tắc: ngày nhỏ hơn 10 và tháng 1, 2 phải thêm số 0 ở trước.

export function toDate(input) {
  if (input instanceof Date) return input;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return input ? new Date(input) : new Date();
}

export function formatAdminDate(input, place = '') {
  const d = toDate(input);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const dd = day < 10 ? `0${day}` : `${day}`;
  const mm = month <= 2 ? `0${month}` : `${month}`;
  const core = `ngày ${dd} tháng ${mm} năm ${d.getFullYear()}`;
  return place ? `${place.trim()}, ${core}` : core;
}

export function isoToday(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function relativeTime(ts, now = Date.now()) {
  const s = Math.round((now - ts) / 1000);
  if (s < 45) return 'vừa xong';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} ngày trước`;
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
