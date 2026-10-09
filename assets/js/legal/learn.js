// Máy “học” từ chỉnh sửa của điều tra viên: khi đảo chiều, đổi loại hoặc loại một khoản khỏi dòng tiền, quy tắc được ghi nhớ
// (theo động từ, hoặc theo đúng câu đó) và áp dụng cho các lần phân tích sau. Quy tắc nhìn thấy, xóa được — không âm thầm.
import { key } from './text-sim.js';

export const emptyLearn = () => ({ v: 1, verbs: {}, ignore: [] });
/** Khóa của một câu nguyên văn (để nhận lại đúng câu đó ở lần phân tích sau). */
export const sentKey = (t) => key(t).slice(0, 90);
const clone = (L) => ({ v: 1, verbs: { ...(L?.verbs || {}) }, ignore: [...(L?.ignore || [])] });

/** Ghi nhớ cách hiểu một động từ: patch = { loai?: 'tien' | 'chi-dao' | 'khac', dao?: boolean }. */
export function learnVerb(L, verb, patch) {
  const k = key(verb);
  if (!k) return L;
  const out = clone(L);
  const old = out.verbs[k] || { ten: String(verb).trim(), n: 0 };
  out.verbs[k] = { ...old, ...patch, n: old.n + 1, at: Date.now() };
  return out;
}

/** Ghi nhớ: câu này không tạo quan hệ / dòng tiền. */
export function learnIgnore(L, trich) {
  const k = sentKey(trich);
  const out = clone(L);
  if (k && !out.ignore.includes(k)) out.ignore.push(k);
  return out;
}

export function forgetRule(L, kind, k) {
  const out = clone(L);
  if (kind === 'verb') delete out.verbs[k];
  else out.ignore = out.ignore.filter((x) => x !== k);
  return out;
}

export const learnCount = (L) => Object.keys(L?.verbs || {}).length + (L?.ignore || []).length;

/** Mô tả quy tắc cho người dùng. */
export function describeVerb(v) {
  const loai = { tien: 'tiền, tài sản', 'chi-dao': 'chỉ đạo, yêu cầu', khac: 'quan hệ khác' }[v.loai];
  return `“${v.ten}” → ${[loai && `loại ${loai}`, v.dao && 'đảo chiều (người nhận đứng trước)'].filter(Boolean).join(', ') || 'đã chỉnh'}`;
}
