// Hạn mức Groq (gói miễn phí): canh số yêu cầu / token mỗi phút và mỗi ngày ngay trên máy để không bị Groq từ chối.
// - Trước mỗi yêu cầu: ước lượng token gửi đi, chọn max_tokens vừa đủ (không vượt hạn mức phút), chờ nếu phút này
//   đã dùng gần hết; vượt hạn mức ngày thì báo rõ (hệ thống tự chuyển nhà cung cấp khác nếu có).
// - Sau mỗi yêu cầu: ghi số token thật (Groq trả về trong x_groq.usage) để thống kê trong ngày.
// Mặc định theo gói miễn phí: 30 yêu cầu/phút, 1.000 yêu cầu/ngày, 8.000 token/phút, 200.000 token/ngày — sửa được
// trong Cài đặt → Groq nếu tài khoản / mô hình có hạn mức khác.
import { store } from './store.js';

export const GROQ_DEFAULT_LIMITS = { rpm: 30, rpd: 1000, tpm: 8000, tpd: 200000 };
/** Tiếng Việt: khoảng 3,2–3,5 ký tự một token — lấy 3,2 để ước lượng hơi dư, an toàn. */
export const CHARS_PER_TOKEN = 3.2;
const MIN_OUT = 512;

export const estTokens = (text) => Math.ceil(String(text || '').length / CHARS_PER_TOKEN);
/** Token gửi đi của một yêu cầu (hệ thống + tin nhắn; ảnh tính ~1.000 token). */
export function inputTokens(system, messages = []) {
  let n = estTokens(system) + 8;
  for (const m of messages) {
    if (Array.isArray(m.content)) for (const p of m.content) n += p.type === 'image' ? 1000 : estTokens(p.text);
    else n += estTokens(m.content);
    n += 6;
  }
  return n;
}

export const groqLimits = () => ({ ...GROQ_DEFAULT_LIMITS, ...(store.get('groq-limits', {}) || {}) });
export const setGroqLimits = (l) => store.set('groq-limits', l);

const today = (now = Date.now()) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
// Groq tính hạn mức riêng cho từng mô hình: nhật ký trong phút (bộ nhớ) và tổng trong ngày (lưu lại) theo mô hình.
let minute = [];
function dayAll(now = Date.now()) {
  const s = store.get('groq-usage', null);
  return s && s.day === today(now) && s.models ? s : { day: today(now), models: {} };
}
function dayStat(model, now = Date.now()) {
  return dayAll(now).models[model || '?'] || { tokens: 0, requests: 0 };
}
function addDay(model, tokens, requests, now = Date.now(), cached = 0) {
  const all = dayAll(now);
  const cur = all.models[model || '?'] || { tokens: 0, requests: 0 };
  all.models[model || '?'] = { tokens: Math.max(0, cur.tokens + tokens), requests: cur.requests + requests, cached: (cur.cached || 0) + cached };
  store.set('groq-usage', all);
}
/** Thống kê hôm nay: { tokens, requests, models: { [mô hình]: { tokens, requests } } }. */
export function groqUsageToday() {
  const all = dayAll();
  const v = Object.values(all.models);
  return { tokens: v.reduce((s, x) => s + x.tokens, 0), requests: v.reduce((s, x) => s + x.requests, 0), cached: v.reduce((s, x) => s + (x.cached || 0), 0), models: all.models };
}

function windowUse(model, now) {
  minute = minute.filter((x) => now - x.t < 60000);
  const mine = minute.filter((x) => x.model === model);
  return { tokens: mine.reduce((s, x) => s + x.tokens, 0), requests: mine.length, list: mine };
}

export class GroqQuotaError extends Error {
  constructor(message, status, daily = false) {
    super(message);
    this.status = status;
    // Hết hạn mức ngày: không chờ thử lại (tryWithRetry bỏ qua khi retryAfter quá dài).
    if (daily) this.retryAfter = 86400;
  }
}

/**
 * Tính max_tokens và kiểm tra hạn mức ngày (không chờ). Trả { maxTokens, input }.
 * Gửi đi đã vượt hạn mức phút → lỗi 413 (phần gọi đã chia nhỏ sẽ tự chia đôi rồi gửi lại).
 */
export function planGroq({ system, messages, maxTokens, model }, limits = groqLimits(), now = Date.now()) {
  const input = inputTokens(system, messages);
  if (input > limits.tpm - MIN_OUT) throw new GroqQuotaError(`Nội dung gửi đi (~${fmt(input)} token) vượt hạn mức ${fmt(limits.tpm)} token/phút của Groq — cần chia nhỏ hơn hoặc rút gọn.`, 413);
  const day = dayStat(model, now);
  if (day.tokens + input > limits.tpd) throw new GroqQuotaError(`Groq (${model}): đã dùng ~${fmt(day.tokens)}/${fmt(limits.tpd)} token hôm nay — hết hạn mức ngày. Dùng mô hình / nhà cung cấp khác hoặc chờ sang ngày mới.`, 429, true);
  if (day.requests >= limits.rpd) throw new GroqQuotaError(`Groq (${model}): đã gửi ${day.requests}/${limits.rpd} yêu cầu hôm nay — hết hạn mức ngày.`, 429, true);
  // Chừa đủ chỗ trong phút cho cả phần trả lời (Groq có thể tính cả max_tokens khi xét hạn mức).
  const room = limits.tpm - input - 200;
  return { input, maxTokens: Math.max(MIN_OUT, Math.min(maxTokens || 8192, room)) };
}

/** Số mili giây phải chờ để phút hiện tại còn đủ chỗ cho yêu cầu cần `need` token. */
export function groqWaitMs(need, model, limits = groqLimits(), now = Date.now()) {
  const use = windowUse(model, now);
  if (use.tokens + need <= limits.tpm && use.requests < limits.rpm) return 0;
  // Chờ tới khi các yêu cầu cũ nhất ra khỏi cửa sổ 60 giây.
  let tokens = use.tokens;
  let reqs = use.requests;
  for (const x of [...use.list].sort((a, b) => a.t - b.t)) {
    tokens -= x.tokens;
    reqs -= 1;
    if (tokens + need <= limits.tpm && reqs < limits.rpm) return Math.max(0, x.t + 60000 - now) + 250;
  }
  return 60250;
}

/**
 * Ghi nhận một yêu cầu (đặt chỗ ngay khi gửi, cập nhật số thật khi xong). Trả về hàm cập nhật(actual, cached):
 * actual = token tính vào hạn mức (đã trừ phần đọc từ cache), cached = token đọc từ cache (tiết kiệm được).
 */
export function groqReserve(tokens, model, now = Date.now()) {
  const entry = { t: now, tokens, model };
  minute.push(entry);
  addDay(model, tokens, 1, now);
  return (actual, cached = 0) => {
    if (actual == null) return;
    addDay(model, actual - entry.tokens, 0, Date.now(), cached);
    entry.tokens = actual;
  };
}

/** Chờ đủ chỗ trong phút (có thể dừng). onWait(giây) để báo cho người dùng. */
export async function groqAdmit(need, { model, signal, onWait } = {}) {
  for (let i = 0; i < 4; i++) {
    const ms = groqWaitMs(need, model);
    if (!ms) return;
    onWait?.(Math.ceil(ms / 1000));
    await new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
    });
    if (signal?.aborted) return;
  }
}

export const resetGroqMinute = () => (minute = []);
const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
