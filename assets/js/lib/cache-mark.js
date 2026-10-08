// Đánh dấu ranh giới “phần cố định | phần thay đổi” trong lời nhắc gửi AI để tận dụng prompt caching:
// phần trước dấu (vai trò, danh mục điều luật, hướng dẫn định dạng, nội dung hồ sơ dùng lại nhiều lần) giữ NGUYÊN
// từng ký tự giữa các lần gửi; phần sau dấu (phần i/n của tài liệu, yêu cầu mới…) thay đổi.
// - Claude, OpenRouter (mô hình Claude / Gemini): gắn cache_control vào phần cố định.
// - Groq, OpenAI, Gemini, DeepSeek…: tự cache phần đầu giống nhau — chỉ cần thứ tự đúng; dấu được bỏ trước khi gửi.
export const CACHE_BREAK = '⁣⁣';

/** Ghép lời nhắc: phần cố định trước, phần thay đổi sau. */
export const withCache = (stable, variable) => `${stable}${CACHE_BREAK}${variable}`;

/** Tách lời nhắc theo dấu → [phần cố định, phần thay đổi] (không có dấu → null). */
export function splitCache(text) {
  const s = String(text ?? '');
  const i = s.indexOf(CACHE_BREAK);
  return i < 0 ? null : [s.slice(0, i), s.slice(i + CACHE_BREAK.length)];
}

/** Bỏ dấu (gửi cho nhà cung cấp tự cache theo phần đầu, hoặc hiển thị). */
export const stripCache = (text) => String(text ?? '').split(CACHE_BREAK).join('');
