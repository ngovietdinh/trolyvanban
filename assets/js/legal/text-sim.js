// So khớp chuỗi dùng chung (chuẩn hóa tiếng Việt, gộp mục trùng).
export const key = (s) => String(s || '').normalize('NFC').toLocaleLowerCase('vi-VN').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Hai chuỗi gần như cùng nội dung (chung ≥ 80% từ của chuỗi ngắn hơn) — để gộp mục trùng lặp. */
export const similarText = (a, b) => {
  const w = (t) => new Set(key(t).split(' ').filter((x) => x.length > 1));
  const A = w(a);
  const B = w(b);
  // Chuỗi quá ngắn (< 3 từ) chỉ coi là trùng khi giống hệt (xem sameText).
  if (Math.min(A.size, B.size) < 3) return false;
  let i = 0;
  A.forEach((x) => B.has(x) && i++);
  return i / Math.min(A.size, B.size) >= 0.8 && i / Math.max(A.size, B.size) >= 0.6;
};

/** Trùng hệt (sau chuẩn hóa) hoặc gần như cùng nội dung. */
export const sameText = (a, b) => key(a) === key(b) || similarText(a, b);
