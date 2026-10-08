// Theo dõi tiến độ điều tra: trạng thái từng câu hỏi của kế hoạch theo các biên bản đã ghi (hoặc tải lên),
// tiến độ từng kế hoạch / hồ sơ vụ án, cảnh báo, phân tích – kết luận sơ bộ, báo cáo Word.
// Chạy hoàn toàn trên máy; không phụ thuộc giao diện để kiểm thử được.
import { generatePlan, findCrime } from './engine.js';
import { applyPlanOverlay } from './plan-overlay.js';
import { getRole } from './roles.js';
import { signCoverage, amountsIn } from './analyze.js';
import { localContradictions } from './assist.js';

/* ---------------- Trạng thái câu hỏi ---------------- */

export const Q_STATUS = {
  chua: { label: 'Chưa hỏi', short: 'Chưa hỏi' },
  'da-hoi': { label: 'Đã hỏi, chưa có trả lời', short: 'Đã hỏi' },
  'can-lam-ro': { label: 'Cần làm rõ thêm', short: 'Cần làm rõ' },
  'da-ro': { label: 'Đã có trả lời', short: 'Đã trả lời' },
  'bo-qua': { label: 'Không cần hỏi', short: 'Bỏ qua' },
};
export const Q_STATUS_ORDER = ['chua', 'da-hoi', 'can-lam-ro', 'da-ro', 'bo-qua'];
const DONE = new Set(['da-ro', 'bo-qua']);

/** Khóa so khớp câu hỏi: chữ thường, bỏ dấu câu, gộp khoảng trắng. */
export const qKey = (t) =>
  String(t || '')
    .normalize('NFC')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const wordSet = (t) => new Set(qKey(t).split(' ').filter((w) => w.length > 1));

/** Độ giống nhau 0–1 giữa hai câu hỏi (trùng hẳn = 1, còn lại theo tỷ lệ âm tiết chung). */
export function similar(a, b) {
  const ka = qKey(a);
  const kb = qKey(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  const A = wordSet(a);
  const B = wordSet(b);
  let n = 0;
  A.forEach((w) => B.has(w) && n++);
  return n / Math.max(1, A.size + B.size - n);
}

const VAGUE = /(không nhớ|không rõ|không biết|quên rồi|chắc là|hình như|có lẽ|không để ý|không chắc|từ chối khai|không khai|không trả lời)/i;
/** Chất lượng câu trả lời: 'empty' (chưa trả lời), 'vague' (mơ hồ, né tránh), 'ok'. */
export function answerQuality(a) {
  const s = String(a || '').trim();
  if (!s) return 'empty';
  return VAGUE.test(s) && s.length < 160 ? 'vague' : 'ok';
}

/** Nguồn lời khai gọn: “Nguyễn Văn A — lần 2, 05/10/2026”. */
export const recLabel = (r) => `${r.nguoiKhai?.hoTen || 'Chưa ghi tên'} — lần ${r.lan || 1}${r.ngay ? `, ${String(r.ngay).split('-').reverse().join('/')}` : ''}`;

/**
 * Trạng thái từng câu hỏi của kế hoạch theo các biên bản. Lượt hỏi – đáp khớp câu hỏi khi cùng nội dung
 * (giống ≥ 70%) hoặc cùng vấn đề và giống ≥ 55%. manual: { [qKey]: trạng thái do người dùng đánh dấu }.
 */
export function trackPlan(plan, records = [], manual = {}) {
  const lines = records.flatMap((r) => (r.qa || []).filter((x) => String(x.q || '').trim()).map((x) => ({ ...x, rec: r, w: qKey(x.q) })));
  const issues = (plan?.issues || []).map((is) => {
    const items = is.cauHoi.map((c) => {
      const hits = lines.filter((x) => similar(c.text, x.q) >= (x.issueId === is.key || x.issueId === is.id ? 0.55 : 0.7));
      const answers = hits
        .filter((x) => String(x.a || '').trim())
        .map((x) => ({ recId: x.rec.id, who: recLabel(x.rec), a: String(x.a).trim(), quality: answerQuality(x.a) }));
      const auto = answers.some((x) => x.quality === 'ok') ? 'da-ro' : answers.length ? 'can-lam-ro' : hits.length ? 'da-hoi' : 'chua';
      const m = manual[qKey(c.text)];
      const status = Q_STATUS[m] ? m : auto;
      return { text: c.text, priority: c.priority, src: c.src, status, auto, manual: !!Q_STATUS[m], answers, asked: hits.length };
    });
    const counts = countBy(items);
    const done = items.filter((x) => DONE.has(x.status)).length;
    const cov = records.map((r) => r.coverage?.[is.key] || r.coverage?.[is.id]).filter(Boolean);
    const level = cov.includes('ro') || (items.length && done === items.length) ? 'ro' : done || counts['can-lam-ro'] || counts['da-hoi'] || cov.length ? 'mot-phan' : 'chua';
    return { key: is.key, tieuDe: is.tieuDe, canCu: is.canCu, total: items.length, done, pct: pct(done, items.length), counts, level, items };
  });
  const all = issues.flatMap((i) => i.items);
  const done = all.filter((x) => DONE.has(x.status)).length;
  return { issues, totals: { total: all.length, done, pct: pct(done, all.length), counts: countBy(all), highOpen: all.filter((x) => x.priority === 'high' && !DONE.has(x.status)).length } };
}

const countBy = (items) => Object.fromEntries(Q_STATUS_ORDER.map((k) => [k, items.filter((x) => x.status === k).length]));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/* ---------------- Kế hoạch đã lưu ---------------- */

/** Dựng lại kế hoạch đã lưu (kèm lớp chỉnh sửa: câu đã xóa, sửa, AI gợi ý, tự thêm) như ở Cây hỏi đáp. */
export function planFromSaved(saved, { roleId, custom = {}, learned = {} } = {}) {
  if (!saved || !findCrime(saved.dieu)) return null;
  let p;
  try {
    p = generatePlan({ dieu: saved.dieu, hanhViIds: saved.hanhViIds || [], dinhKhung: saved.dinhKhung || [], roleId: roleId || saved.roleId, lienQuan: saved.lienQuan || [], custom, learned });
  } catch {
    return null;
  }
  applyPlanOverlay(p, saved.overlay || {});
  p.stats.questions = p.issues.reduce((s, i) => s + i.cauHoi.length, 0);
  return p;
}

/** Biên bản thuộc kế hoạch: gắn trực tiếp (planId), hoặc cùng hồ sơ + cùng điều luật + cùng tư cách người khai. */
export function recordsForPlan(saved, records = []) {
  return records.filter((r) => (r.planId ? r.planId === saved.id : (r.caseId || null) === (saved.caseId || null) && r.plan && String(r.plan.dieu) === String(saved.dieu) && r.roleId === saved.roleId));
}

/* ---------------- Hồ sơ vụ án ---------------- */

export const STAGES = {
  moi: { label: 'Chưa bắt đầu', tone: 'mute' },
  'dang-lam': { label: 'Đang thực hiện', tone: 'info' },
  'gan-xong': { label: 'Gần hoàn thành', tone: 'warn' },
  'hoan-thanh': { label: 'Đã hoàn thành', tone: 'ok' },
};
const DAY = 86400000;
const isSuspect = (roleId) => getRole(roleId).nhom === 'nghi-pham';
const ts = (r) => r.updatedAt || r.createdAt || (r.ngay ? Date.parse(r.ngay) : 0) || 0;

/**
 * Báo cáo tổng quan một hồ sơ: người tham gia, tiến độ từng kế hoạch, cảnh báo, phân tích – kết luận sơ bộ.
 * planOf(saved) → kế hoạch dựng lại (mặc định planFromSaved).
 */
export function caseReport({ caseItem, plans = [], records = [], planOf = planFromSaved, now = Date.now() }) {
  const c = caseItem;
  const recs = records.filter((r) => r.caseId === c.id);
  const persons = (c.persons || []).map((p) => {
    const mine = recs.filter((r) => r.personId === p.id);
    const done = mine.filter((r) => r.status === 'hoan-thanh').length;
    return { person: p, role: getRole(p.roleId), records: mine.length, done, last: Math.max(0, ...mine.map(ts)), status: !mine.length ? 'chua-lay' : done ? 'da-lay' : 'dang-ghi' };
  });
  const planRows = plans
    .filter((p) => p.caseId === c.id)
    .map((saved) => {
      const plan = planOf(saved);
      const linked = recordsForPlan(saved, recs);
      return { saved, plan, records: linked, track: plan ? trackPlan(plan, linked, saved.overlay?.track || {}) : null };
    });
  const tracked = planRows.filter((r) => r.track);
  const questions = tracked.reduce((s, r) => s + r.track.totals.total, 0);
  const qDone = tracked.reduce((s, r) => s + r.track.totals.done, 0);
  const totals = {
    persons: persons.length,
    personsDone: persons.filter((p) => p.records).length,
    records: recs.length,
    recordsDone: recs.filter((r) => r.status === 'hoan-thanh').length,
    plans: planRows.length,
    questions,
    qDone,
    pct: pct(qDone, questions),
    answers: recs.reduce((s, r) => s + (r.qa || []).filter((x) => String(x.a || '').trim()).length, 0),
  };
  const analysis = analyzeRecords(c, recs);
  const warnings = caseWarnings({ c, persons, planRows, recs, analysis, now });
  const stage = !recs.length && !planRows.length ? 'moi' : totals.pct >= 100 && totals.personsDone === totals.persons && recs.every((r) => r.status === 'hoan-thanh') ? 'hoan-thanh' : totals.pct >= 80 ? 'gan-xong' : recs.length || planRows.length ? 'dang-lam' : 'moi';
  const lastActivity = Math.max(c.updatedAt || 0, ...recs.map(ts), ...planRows.map((r) => r.saved.updatedAt || 0));
  const report = { caseItem: c, persons, plans: planRows, totals, analysis, warnings, stage, lastActivity };
  report.conclusions = conclusions(report);
  return report;
}

/** Phân tích nội dung các biên bản: dấu hiệu định tội đã được lời khai đề cập, số tiền, mâu thuẫn, câu trả lời mơ hồ. */
export function analyzeRecords(c, recs) {
  const answered = recs.flatMap((r) => (r.qa || []).filter((x) => String(x.a || '').trim()).map((x) => ({ ...x, rec: r })));
  const text = answered.map((x) => `${x.q}\n${x.a}`).join('\n');
  const dieus = [...new Set([...(c.toiDanh || []), ...recs.map((r) => r.plan?.dieu).filter(Boolean)].map(String))];
  const crimes = dieus
    .map(findCrime)
    .filter(Boolean)
    .map((crime) => {
      const signs = text ? signCoverage(crime, text) : (crime.dauHieu || []).map((d) => ({ text: d, hit: false }));
      return { crime, signs, hit: signs.filter((s) => s.hit).length, total: signs.length };
    });
  const money = [...new Map(amountsIn(answered.map((x) => x.a).join('\n')).map((m) => [m.v, m])).values()].sort((a, b) => b.v - a.v);
  const contradictions = recs.length ? localContradictions(recs[0], recs.slice(1)) : [];
  const vague = answered.filter((x) => answerQuality(x.a) === 'vague').map((x) => ({ q: x.q, a: x.a, who: recLabel(x.rec), recId: x.rec.id }));
  return { crimes, money, contradictions, vague, answered: answered.length };
}

function caseWarnings({ c, persons, planRows, recs, analysis, now }) {
  const w = [];
  const add = (level, text, href = null) => w.push({ level, text, href });
  if (!(c.toiDanh || []).length) add('cao', 'Chưa xác định tội danh (điều luật) cho hồ sơ.', `#cases/${c.id}`);
  if (!persons.length) add('trung-binh', 'Chưa có người tham gia tố tụng trong hồ sơ.', `#cases/${c.id}`);
  const noRecSuspects = persons.filter((p) => !p.records && isSuspect(p.person.roleId));
  const noRecOthers = persons.filter((p) => !p.records && !isSuspect(p.person.roleId));
  if (noRecSuspects.length) add('cao', `Chưa lấy lời khai ${noRecSuspects.map((p) => `${p.person.hoTen} (${p.role.ten.split('/')[0].trim()})`).join(', ')}.`, `#cases/${c.id}`);
  if (noRecOthers.length) add('thap', `${noRecOthers.length} người chưa được lấy lời khai: ${noRecOthers.map((p) => p.person.hoTen).join(', ')}.`, `#cases/${c.id}`);
  if (!planRows.length) add('trung-binh', 'Chưa lập kế hoạch hỏi cho hồ sơ.', `#legal${c.toiDanh?.[0] ? `/${c.toiDanh[0]}` : ''}`);
  for (const r of planRows) {
    const href = `#legal/plan/${r.saved.id}`;
    if (!r.plan) {
      add('trung-binh', `Kế hoạch “${r.saved.title}”: điều luật không còn trong hệ thống.`, href);
      continue;
    }
    if (!r.records.length) {
      add('thap', `Kế hoạch “${r.saved.title}” chưa được dùng để ghi lời khai.`, href);
      continue;
    }
    const key = r.track.issues.filter((is) => /(^|:)(hv-|chu-quan|hau-qua)/.test(is.key) && !is.done && !is.counts['can-lam-ro'] && !is.counts['da-hoi']);
    if (key.length) add('cao', `Kế hoạch “${r.saved.title}”: chưa làm rõ ${key.map((is) => is.tieuDe.replace(/^Hành vi:\s*/, 'hành vi ')).join('; ')}.`, href);
    if (r.track.totals.highOpen) add('trung-binh', `Kế hoạch “${r.saved.title}”: ${r.track.totals.highOpen} câu hỏi quan trọng chưa có trả lời rõ.`, href);
  }
  recs
    .filter((r) => r.status !== 'hoan-thanh' && now - ts(r) > 3 * DAY)
    .forEach((r) => add('thap', `Biên bản ${recLabel(r)} đang ghi dở ${Math.floor((now - ts(r)) / DAY)} ngày.`, `#interview/${r.id}`));
  if (analysis.vague.length) add('trung-binh', `${analysis.vague.length} câu trả lời mơ hồ, né tránh cần hỏi làm rõ.`);
  analysis.contradictions.slice(0, 3).forEach((m) => add(m.mucDo === 'cao' ? 'cao' : 'trung-binh', `Mâu thuẫn: ${m.moTa}`));
  if (analysis.answered)
    analysis.crimes.filter((x) => x.total && x.hit < x.total).forEach((x) => add(x.hit ? 'trung-binh' : 'cao', `Điều ${x.crime.dieu}: ${x.total - x.hit}/${x.total} dấu hiệu định tội chưa được lời khai đề cập.`));
  const last = Math.max(c.updatedAt || 0, ...recs.map(ts));
  if (last && now - last > 30 * DAY) add('thap', `Hồ sơ không có hoạt động ${Math.floor((now - last) / DAY)} ngày.`, `#cases/${c.id}`);
  const rank = { cao: 0, 'trung-binh': 1, thap: 2 };
  return w.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** Kết luận sơ bộ (đánh giá trên máy theo dữ liệu đã nhập — chỉ để tham khảo). */
function conclusions(r) {
  const t = r.totals;
  const a = r.analysis;
  const out = [];
  out.push(`Đã lấy lời khai ${t.personsDone}/${t.persons} người tham gia tố tụng; ${t.records} biên bản (${t.recordsDone} đã hoàn thành), ${t.answers} lượt trả lời.`);
  if (t.questions) out.push(`Tiến độ theo kế hoạch hỏi: ${t.qDone}/${t.questions} câu hỏi đã có trả lời hoặc không cần hỏi (${t.pct}%).`);
  for (const x of a.crimes) {
    const hit = x.signs.filter((s) => s.hit).map((s) => s.text);
    const miss = x.signs.filter((s) => !s.hit).map((s) => s.text);
    out.push(`Điều ${x.crime.dieu} (${x.crime.ten}): lời khai đã đề cập ${x.hit}/${x.total} dấu hiệu định tội${hit.length ? ` — ${hit.map(shortSign).join('; ')}` : ''}.${miss.length ? ` Còn phải chứng minh: ${miss.map(shortSign).join('; ')}.` : ''}`);
  }
  if (a.money.length) out.push(`Số tiền được nêu trong lời khai: ${a.money.slice(0, 5).map((m) => m.raw).join('; ')}${a.money.length > 5 ? '…' : ''}.`);
  out.push(a.contradictions.length ? `Phát hiện ${a.contradictions.length} điểm mâu thuẫn giữa các lời khai — cần đối chất hoặc hỏi làm rõ.` : t.records > 1 ? 'Chưa phát hiện mâu thuẫn rõ rệt về số tiền, diễn biến giữa các lời khai.' : '');
  const signRatio = a.crimes.length ? a.crimes.reduce((s, x) => s + (x.total ? x.hit / x.total : 0), 0) / a.crimes.length : 0;
  if (!t.records) out.push('Đánh giá: chưa có biên bản lời khai — chưa đủ cơ sở đánh giá.');
  else if (signRatio >= 0.6 && t.pct >= 70 && !a.contradictions.some((m) => m.mucDo === 'cao')) out.push('Đánh giá sơ bộ: lời khai cơ bản đã làm rõ các dấu hiệu cấu thành; cần đối chiếu với tài liệu, chứng cứ khác trước khi kết luận.');
  else out.push(`Đánh giá sơ bộ: chưa đủ căn cứ kết luận; cần tiếp tục làm rõ${t.questions && t.pct < 70 ? ` các câu hỏi còn lại của kế hoạch (${100 - t.pct}%)` : ''}${signRatio < 0.6 && a.crimes.length ? `${t.questions && t.pct < 70 ? ' và' : ''} các dấu hiệu định tội chưa được đề cập` : ''}${a.contradictions.length ? ', các điểm mâu thuẫn' : ''}.`);
  return out.filter(Boolean);
}
const shortSign = (s) => (s.length > 90 ? `${s.slice(0, 88).replace(/\s+\S*$/, '')}…` : s).replace(/[.;]$/, '');

/** Tổng hợp toàn bộ hồ sơ + kế hoạch chưa gắn hồ sơ. */
export function overviewReport({ cases = [], plans = [], records = [], planOf = planFromSaved, now = Date.now() }) {
  const reports = cases.map((caseItem) => caseReport({ caseItem, plans, records, planOf, now }));
  const loose = plans
    .filter((p) => !p.caseId)
    .map((saved) => {
      const plan = planOf(saved);
      const linked = recordsForPlan(saved, records);
      return { saved, plan, records: linked, track: plan ? trackPlan(plan, linked, saved.overlay?.track || {}) : null };
    });
  const q = reports.reduce((s, r) => s + r.totals.questions, 0) + loose.reduce((s, r) => s + (r.track?.totals.total || 0), 0);
  const d = reports.reduce((s, r) => s + r.totals.qDone, 0) + loose.reduce((s, r) => s + (r.track?.totals.done || 0), 0);
  const stages = Object.fromEntries(Object.keys(STAGES).map((k) => [k, reports.filter((r) => r.stage === k).length]));
  return {
    reports,
    loose,
    totals: { cases: cases.length, plans: plans.length, records: records.length, recordsDone: records.filter((r) => r.status === 'hoan-thanh').length, questions: q, qDone: d, pct: pct(d, q), warnings: reports.reduce((s, r) => s + r.warnings.length, 0), high: reports.reduce((s, r) => s + r.warnings.filter((w) => w.level === 'cao').length, 0), stages },
  };
}

/* ---------------- Tải biên bản lên ---------------- */

/**
 * Đọc thông tin từ văn bản biên bản (Word / PDF / ảnh đã nhận dạng): họ tên, ngày, lần, tư cách, nội dung hỏi – đáp.
 * parseQa(text) → { pairs: [{ q, a }] } (dùng parsePastedQa của record.js).
 */
export function parseRecordText(text, parseQa) {
  const s = String(text || '').replace(/\r/g, '');
  const hoTen = (/(?:^|\n)\s*(?:Họ và tên|Họ tên)\s*[:：]\s*([^\n;,\t]+?)(?:\s{2,}|\t|;|,|\n|Giới tính|$)/iu.exec(s)?.[1] || '').trim().replace(/[.…]+$/, '');
  let ngay = '';
  const m = /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/iu.exec(s) || /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s);
  if (m) ngay = `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  const lan = +(/lần\s+(?:ghi lời khai|hỏi cung)?\s*thứ\s+(\d+)/iu.exec(s)?.[1] || /lần thứ\s+(\d+)/iu.exec(s)?.[1] || 0) || null;
  const hoiCung = /hỏi cung|bị can/i.test(s.slice(0, 1500));
  const body = s.replace(/\n\s*Việc (?:ghi lời khai|hỏi cung|lấy lời khai)[^\n]*kết thúc[\s\S]*$/iu, '');
  const pairs = (parseQa(body).pairs || []).filter((p) => String(p.q || '').trim() || String(p.a || '').trim());
  return { hoTen, ngay, lan, roleId: hoiCung ? 'bi-can' : null, pairs };
}

/** Gắn từng cặp hỏi – đáp với câu hỏi tương ứng trong kế hoạch (issueId, planQ). */
export function linkPairsToPlan(pairs, plan, uidFn = () => Math.random().toString(36).slice(2, 10)) {
  const qs = (plan?.issues || []).flatMap((is) => is.cauHoi.map((c) => ({ is, c })));
  return pairs.map((p) => {
    let best = null;
    let score = 0;
    for (const x of qs) {
      const s = similar(p.q, x.c.text);
      if (s > score) [best, score] = [x, s];
    }
    const hit = best && score >= 0.6 ? best : null;
    return { id: uidFn(), q: String(p.q || '').trim() || '[Câu hỏi]', a: String(p.a || '').trim(), issueId: hit?.is.id || null, planQ: hit?.c.id || null, at: Date.now() };
  });
}

/* ---------------- Báo cáo Word ---------------- */

const run = (text, o = {}) => ({ text, ...o });
const para = (runs, o = {}) => ({ runs: Array.isArray(runs) ? runs : [run(runs)], align: 'justify', indent: true, ...o });
const head = (t) => para([run(t, { bold: true })], { indent: false, spaceBefore: true });
const LEVEL = { cao: 'Cao', 'trung-binh': 'Trung bình', thap: 'Thấp' };
const vnDate = (d = new Date()) => `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;

function caseBody(r, { detail = true } = {}) {
  const c = r.caseItem;
  const body = [];
  body.push(para([run('Vụ án/vụ việc: ', { bold: true }), run(`${c.ten}${c.soHoSo ? ` (số ${c.soHoSo})` : ''}.`)]));
  if ((c.toiDanh || []).length) body.push(para([run('Tội danh: ', { bold: true }), run(`${c.toiDanh.map((d) => `Điều ${d} BLHS — ${findCrime(d)?.ten || ''}`).join('; ')}.`)]));
  body.push(para([run('Tình trạng: ', { bold: true }), run(`${STAGES[r.stage].label}; tiến độ câu hỏi ${r.totals.pct}%; ${r.totals.records} biên bản; ${r.warnings.length} cảnh báo.`)]));
  if (!detail) return body;
  body.push(head('1. Người tham gia tố tụng'));
  if (r.persons.length)
    body.push({ table: { widths: [0.06, 0.34, 0.26, 0.14, 0.2], header: ['TT', 'Họ tên', 'Tư cách', 'Biên bản', 'Tình trạng'], rows: r.persons.map((p, i) => [String(i + 1), p.person.hoTen, p.role.ten.split('/')[0].trim(), String(p.records), { 'chua-lay': 'Chưa lấy lời khai', 'dang-ghi': 'Đang ghi', 'da-lay': 'Đã lấy lời khai' }[p.status]]) } });
  else body.push(para('Chưa có người tham gia tố tụng.'));
  body.push(head('2. Tiến độ theo kế hoạch hỏi'));
  if (!r.plans.length) body.push(para('Chưa lập kế hoạch hỏi.'));
  r.plans.forEach((p) => {
    if (!p.track) return body.push(para(`Kế hoạch “${p.saved.title}”: không dựng lại được (điều luật không còn trong hệ thống).`));
    body.push(para([run(`Kế hoạch “${p.saved.title}”: `, { bold: true }), run(`${p.track.totals.done}/${p.track.totals.total} câu hỏi (${p.track.totals.pct}%), ${p.records.length} biên bản.`)]));
    body.push({ table: { widths: [0.46, 0.1, 0.11, 0.11, 0.11, 0.11], header: ['Vấn đề cần làm rõ', 'Số câu', 'Đã trả lời', 'Cần làm rõ', 'Đã hỏi', 'Chưa hỏi'], rows: p.track.issues.map((is) => [is.tieuDe, String(is.total), String(is.counts['da-ro'] + is.counts['bo-qua']), String(is.counts['can-lam-ro']), String(is.counts['da-hoi']), String(is.counts.chua)]) } });
  });
  body.push(head('3. Tổng hợp kết quả lời khai theo vấn đề'));
  const rows = r.plans.flatMap((p) => (p.track?.issues || []).flatMap((is) => is.items.filter((x) => x.answers.length).map((x) => [is.tieuDe.replace(/^Hành vi:\s*/, ''), x.text, x.answers.map((a) => `${a.who}: ${a.a.length > 260 ? `${a.a.slice(0, 258)}…` : a.a}`).join('\n'), Q_STATUS[x.status].short])));
  if (rows.length) body.push({ table: { widths: [0.18, 0.3, 0.4, 0.12], header: ['Vấn đề', 'Câu hỏi', 'Nội dung trả lời (người khai)', 'Trạng thái'], rows } });
  else body.push(para('Chưa có câu trả lời khớp với kế hoạch hỏi.'));
  body.push(head('4. Cảnh báo'));
  if (r.warnings.length) body.push({ table: { widths: [0.16, 0.84], header: ['Mức độ', 'Nội dung'], rows: r.warnings.map((w) => [LEVEL[w.level], w.text]) } });
  else body.push(para('Không có cảnh báo.'));
  body.push(head('5. Phân tích, kết luận sơ bộ'));
  r.conclusions.forEach((t) => body.push(para(`- ${t}`)));
  if (c.aiConclusion?.text) {
    body.push(para([run('Nhận định của trợ lý AI: ', { bold: true, italic: true })]));
    String(c.aiConclusion.text)
      .split(/\n+/)
      .map((l) => l.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim())
      .filter(Boolean)
      .forEach((l) => body.push(para(l)));
  }
  return body;
}

/** Báo cáo tiến độ một hồ sơ (doc model). */
export function buildCaseReportDocument(r, org = {}) {
  return reportDoc('BÁO CÁO TIẾN ĐỘ, KẾT QUẢ LẤY LỜI KHAI', r.caseItem.ten, caseBody(r), org, r.caseItem.dieuTraVien);
}

/** Báo cáo tổng hợp tất cả hồ sơ (doc model). */
export function buildOverviewDocument(o, org = {}) {
  const body = [];
  const t = o.totals;
  body.push(para(`Tổng số ${t.cases} hồ sơ vụ án, ${t.plans} kế hoạch hỏi, ${t.records} biên bản (${t.recordsDone} đã hoàn thành). Tiến độ câu hỏi chung: ${t.qDone}/${t.questions} (${t.pct}%). Có ${t.warnings} cảnh báo, trong đó ${t.high} cảnh báo mức cao.`));
  body.push(head('I. BẢNG TỔNG HỢP'));
  body.push({ table: { widths: [0.05, 0.33, 0.14, 0.1, 0.1, 0.1, 0.18], header: ['TT', 'Hồ sơ', 'Tội danh', 'Biên bản', 'Tiến độ', 'Cảnh báo', 'Tình trạng'], rows: o.reports.map((r, i) => [String(i + 1), r.caseItem.ten, (r.caseItem.toiDanh || []).map((d) => `Đ.${d}`).join(', '), String(r.totals.records), `${r.totals.pct}%`, String(r.warnings.length), STAGES[r.stage].label]) } });
  o.reports.forEach((r, i) => {
    body.push(head(`${['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'][i] || i + 2}. ${r.caseItem.ten.toLocaleUpperCase('vi-VN')}`));
    body.push(...caseBody(r, { detail: false }));
    r.warnings.filter((w) => w.level !== 'thap').forEach((w) => body.push(para(`- Cảnh báo (${LEVEL[w.level].toLowerCase()}): ${w.text}`)));
    r.conclusions.slice(-1).forEach((x) => body.push(para(`- ${x}`)));
  });
  return reportDoc('BÁO CÁO TỔNG HỢP TIẾN ĐỘ ĐIỀU TRA', `Tính đến ${vnDate()}`, body, org, org.dieuTraVien);
}

function reportDoc(name, subject, body, org = {}, signer = '') {
  const up = (s) => String(s || '').toLocaleUpperCase('vi-VN');
  return {
    typeId: 'bao-cao-theo-doi',
    header: { parent: up(org.coQuanCapTren), org: up(org.coQuan), number: '', subject: null, placeDate: `${org.diaDanh ? `${org.diaDanh}, ` : ''}${vnDate()}` },
    title: { name, subject },
    authority: null,
    recipients: null,
    body,
    sign: null,
    dualSign: null,
    signers: [{ title: 'NGƯỜI BÁO CÁO', hint: '(Ký, ghi rõ họ tên)', name: signer || '' }],
  };
}
