// Lời khai lần tiếp theo của cùng một người: phân tích các biên bản trước để đặt câu hỏi bám sát những gì
// còn chưa rõ — theo cách làm của điều tra viên: xác nhận lời khai cũ → làm rõ chi tiết đã khai (tiền, thời
// gian, người, câu trả lời mơ hồ, quá ngắn) → hỏi nội dung kế hoạch còn bỏ ngỏ → làm rõ dấu hiệu định tội còn
// thiếu → đối chiếu mâu thuẫn (trong lời khai của chính người đó và với người khác) → chốt lại.
// Chạy hoàn toàn trên máy.
import { findCrime, generatePlan } from './engine.js';
import { getRole } from './roles.js';
import { extractFacts, localContradictions } from './assist.js';
import { signCoverage } from './analyze.js';
import { trackPlan, similar, qKey, answerQuality } from './tracking.js';
import { withCache } from '../lib/cache-mark.js';

const vnDate = (d) => (d ? String(d).split('-').reverse().join('/') : '');
const short = (s, n = 140) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t.replace(/[.;,:]$/, '') : `${t.slice(0, n).replace(/\s+\S*$/, '')}…`;
};
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const OPEN_Q = /(trình bày|diễn biến|như thế nào|thế nào|cụ thể|vì sao|tại sao|mục đích|ai là|những ai|bao nhiêu|ở đâu|khi nào)/i;
const DENY = /(không biết|không nhớ|không rõ|không có|không liên quan|không tham gia|không nhận|quên)/i;

/** Các biên bản trước của cùng một người (cùng hồ sơ + cùng người tham gia, hoặc cùng họ tên). Cũ → mới. */
export function previousRecords(target, records = []) {
  const name = qKey(target.nguoiKhai?.hoTen || target.hoTen || '');
  return records
    .filter((r) => r.id !== target.id && (r.qa || []).some((x) => String(x.a || '').trim()))
    .filter((r) => (target.personId && r.personId ? r.personId === target.personId && (r.caseId || null) === (target.caseId || null) : !!name && qKey(r.nguoiKhai?.hoTen) === name && (r.caseId || null) === (target.caseId || null)))
    .sort((a, b) => (a.lan || 1) - (b.lan || 1) || String(a.ngay || '').localeCompare(String(b.ngay || '')) || (a.createdAt || 0) - (b.createdAt || 0));
}

const recTag = (r) => `lần ${r.lan || 1}${r.ngay ? ` ngày ${vnDate(r.ngay)}` : ''}`;

/**
 * Kế hoạch hỏi cho lần khai tiếp theo.
 * prev: biên bản trước của người đó (cũ → mới); others: biên bản của người khác trong cùng hồ sơ;
 * base: kế hoạch gốc (có issues) — mặc định lấy từ biên bản gần nhất hoặc sinh theo dieu.
 * Trả về { plan (giống generatePlan, issues có câu hỏi kèm lyDo), summary }.
 */
export function followUpPlan({ prev = [], others = [], base = null, dieu = null, roleId = null, extra = [], lan = null } = {}) {
  let n = 0;
  const q = (text, lyDo, priority = 'high', buoc = 'cu-the', src = 'tiep-theo') => ({ id: `f${++n}`, text, lyDo, priority, buoc, src });
  const last = prev.at(-1) || {};
  roleId = roleId || last.roleId || base?.roleId || 'bi-can';
  const role = getRole(roleId);
  const suspect = role.nhom === 'nghi-pham';
  const ban = suspect ? 'anh/chị' : 'anh/chị';
  dieu = String(dieu || base?.crime?.dieu || base?.dieu || last.plan?.dieu || '');
  const crime = findCrime(dieu);
  if (!base) base = last.plan?.issues?.length ? last.plan : crime ? generatePlan({ dieu, roleId }) : null;
  const baseIssues = base?.issues || [];
  const lanMoi = lan || Math.max(0, ...prev.map((r) => r.lan || 1)) + 1;
  const lines = prev.flatMap((r) => (r.qa || []).filter((x) => String(x.q || '').trim() || String(x.a || '').trim()).map((x) => ({ ...x, rec: r })));
  const answered = lines.filter((x) => String(x.a || '').trim());
  const issues = [];
  const add = (key, tieuDe, canCu, moTa, cauHoi) => cauHoi.length && issues.push({ id: key, key, tieuDe, canCu, moTa, cauHoi });
  const seen = new Set();
  const uniq = (list) => list.filter((x) => x && !seen.has(qKey(x.text)) && seen.add(qKey(x.text)));

  // ① Xác nhận lời khai trước.
  add('tiep-noi', 'Xác nhận lời khai các lần trước', 'Điều 183, 186 BLTTHS', `Trước khi hỏi tiếp: người khai giữ nguyên hay thay đổi ${prev.length} lời khai đã ghi; ghi nhận lý do nếu thay đổi.`, uniq([
    q(`${prev.length > 1 ? 'Các lời khai' : 'Lời khai'} ${prev.map(recTag).join('; ')} của ${ban} đã được đọc lại, ký xác nhận. Đến nay ${ban} có giữ nguyên ${prev.length > 1 ? 'các lời khai đó' : 'lời khai đó'} không? Có nội dung nào cần thay đổi, bổ sung, đính chính không; vì sao?`, 'Chốt giá trị các lời khai trước, phát hiện sớm việc thay đổi lời khai.', 'high', 'mo'),
    q(`Từ lần làm việc trước đến nay, ${ban} có gặp gỡ, trao đổi với ai về nội dung vụ việc không (ai, khi nào, ở đâu, nội dung trao đổi)? Có ai tác động, đề nghị ${ban} khai theo hướng nào không?`, 'Phát hiện thông cung, tác động làm sai lệch lời khai.', 'high', 'kiem-chung'),
    q(`Sau lần làm việc trước, ${ban} có nhớ thêm hoặc có thêm tài liệu, chứng cứ nào liên quan muốn cung cấp không?`, 'Tạo điều kiện để người khai chủ động bổ sung.', 'normal', 'mo'),
  ]));

  // ② Làm rõ chi tiết đã khai: câu trả lời mơ hồ, chối bỏ, quá ngắn; số tiền, mốc thời gian, người được nhắc tới.
  const clarify = [];
  for (const x of answered) {
    const a = String(x.a).trim();
    const where = `Tại biên bản ${recTag(x.rec)}, khi được hỏi “${short(x.q, 110)}”, ${ban} trả lời: “${short(a, 160)}”.`;
    if (answerQuality(a) === 'vague' || (DENY.test(a) && x.issueId && /hv-|chu-quan|hau-qua|dong-pham/.test(x.issueId) && a.length < 120)) {
      clarify.push(q(`${where} Đề nghị ${ban} suy nghĩ kỹ và trình bày lại cụ thể: những chi tiết nào ${ban} nhớ chắc chắn, chi tiết nào không nhớ và vì sao không nhớ? Có tài liệu, sự kiện nào giúp ${ban} xác định lại không?`, 'Câu trả lời mơ hồ, né tránh hoặc chối bỏ ở nội dung quan trọng.', 'high', 'cu-the'));
    } else if (a.length < 40 && OPEN_Q.test(x.q) && !/\d/.test(a) && !/^(có|không|đúng|chưa|rồi)\b/i.test(a)) {
      clarify.push(q(`${where} Câu trả lời còn chung chung — đề nghị trình bày đầy đủ, cụ thể: thời gian, địa điểm, những người có mặt, diễn biến từng bước.`, 'Câu trả lời quá ngắn so với câu hỏi mở.', 'high', 'cu-the'));
    }
  }
  const facts = { money: new Map(), names: new Map(), dates: new Map() };
  for (const x of answered.slice().reverse()) {
    const f = extractFacts(x.a);
    const sentOf = (raw) => short(String(x.a).split(/(?<=[.;!?])\s+|\n/).find((s) => s.includes(raw)) || x.a, 170);
    f.money.forEach((m) => !facts.money.has(m.value) && facts.money.set(m.value, { raw: m.raw, sent: sentOf(m.raw), rec: x.rec }));
    f.names.forEach((nm) => !facts.names.has(nm) && facts.names.set(nm, { sent: sentOf(nm), rec: x.rec }));
    f.dates.forEach((d) => !facts.dates.has(d) && facts.dates.set(d, { sent: sentOf(d), rec: x.rec }));
  }
  [...facts.money.values()].slice(0, 5).forEach((m) =>
    clarify.push(q(`${ban.charAt(0).toUpperCase() + ban.slice(1)} đã khai (biên bản ${recTag(m.rec)}): “${m.sent}”. Đề nghị làm rõ khoản ${m.raw}: gồm những lần nào, mỗi lần bao nhiêu; giao nhận ở đâu, khi nào, bằng hình thức gì (tiền mặt hay chuyển khoản — số tài khoản, ngân hàng); ai giao, ai nhận, ai chứng kiến; có giấy tờ, tin nhắn nào ghi nhận không; số tiền đó sau đó được sử dụng vào việc gì?`, 'Cụ thể hóa dòng tiền đã được khai — căn cứ định tội, định khung, thu hồi tài sản.', 'high', 'cu-the')),
  );
  [...facts.names.entries()].slice(0, 4).forEach(([nm, v]) =>
    clarify.push(q(`Trong lời khai ${recTag(v.rec)}, ${ban} có nhắc đến ${nm}: “${v.sent}”. Đề nghị trình bày rõ ${nm} là ai (nhân thân, chức vụ, nơi làm việc), quan hệ với ${ban} thế nào, vai trò của ${nm} trong sự việc; ${ban} trao đổi với ${nm} những gì, khi nào, bằng phương tiện gì?`, 'Xác định người liên quan được nhắc đến để mở rộng điều tra, lấy lời khai đối chứng.', 'high', 'cu-the')),
  );
  [...facts.dates.entries()].slice(0, 3).forEach(([d, v]) =>
    clarify.push(q(`${ban.charAt(0).toUpperCase() + ban.slice(1)} khai sự việc diễn ra vào ${d} (“${v.sent}”). Căn cứ vào đâu ${ban} xác định chính xác thời điểm đó? Trước và sau thời điểm đó đã diễn ra những sự việc gì liên quan?`, 'Kiểm tra độ tin cậy của mốc thời gian, xâu chuỗi diễn biến.', 'normal', 'kiem-chung')),
  );
  add('lam-ro', 'Làm rõ những nội dung đã khai còn chưa rõ', 'Điều 85 BLTTHS', 'Câu trả lời mơ hồ, chối bỏ, quá ngắn; số tiền, người, mốc thời gian đã được nhắc tới nhưng chưa được cụ thể hóa.', uniq(clarify).slice(0, 18));

  // ③ Nội dung kế hoạch còn bỏ ngỏ (theo từng vấn đề của kế hoạch gốc).
  const tr = baseIssues.length ? trackPlan({ issues: baseIssues }, prev) : null;
  let openCount = 0;
  (tr?.issues || []).forEach((ti, i) => {
    if (ti.key === 'ket-thuc') return;
    const is = baseIssues[i];
    // Giữ trình tự logic của kế hoạch; mỗi vấn đề tối đa 6 câu, ưu tiên câu quan trọng.
    const open = ti.items.map((x, k) => ({ ...x, k })).filter((x) => x.status === 'chua' || x.status === 'da-hoi');
    const keep = new Set([...open.filter((x) => x.priority === 'high'), ...open.filter((x) => x.priority !== 'high')].slice(0, 6).map((x) => x.k));
    const list = open
      .filter((x) => keep.has(x.k))
      .map((x) => q(x.text, x.status === 'da-hoi' ? 'Đã hỏi ở lần trước nhưng chưa có câu trả lời.' : 'Kế hoạch có, các lần trước chưa hỏi.', x.priority, x.status === 'da-hoi' ? 'cu-the' : 'mo', 'chua-hoi'));
    openCount += list.length;
    add(`con-lai:${is.key}`, `Còn bỏ ngỏ — ${is.tieuDe.replace(/^Hành vi:\s*/, 'hành vi ')}`, is.canCu, `${ti.done}/${ti.total} câu đã có trả lời ở các lần trước; tiếp tục hỏi các nội dung chưa làm rõ.`, uniq(list));
  });

  // ④ Dấu hiệu định tội chưa có lời khai đề cập.
  const text = answered.map((x) => `${x.q}\n${x.a}`).join('\n');
  const missSigns = crime && text ? signCoverage(crime, text).filter((s) => !s.hit) : [];
  add('dau-hieu', `Dấu hiệu định tội Điều ${dieu} chưa được làm rõ`, crime ? `Điều ${crime.dieu} BLHS — ${crime.ten}` : '', 'Các dấu hiệu cấu thành mà lời khai các lần trước chưa đề cập — cần hỏi để chứng minh hoặc loại trừ.', uniq(missSigns.slice(0, 6).map((s) => q(suspect ? `Về nội dung “${short(lc(s.text), 150)}”: ${ban} trình bày cụ thể sự việc liên quan (ai, khi nào, ở đâu, như thế nào), căn cứ, tài liệu nào thể hiện?` : `Về nội dung “${short(lc(s.text), 150)}”: ${ban} biết những gì, biết trong hoàn cảnh nào, ai có thể xác nhận?`, 'Dấu hiệu định tội chưa có lời khai đề cập.', 'high', 'cu-the'))));

  // ⑤ Đối chiếu mâu thuẫn: giữa các lần khai của chính người đó, và với lời khai người khác.
  const contra = [];
  for (let i = 0; i < answered.length; i++) {
    for (let j = i + 1; j < answered.length; j++) {
      const x = answered[i];
      const y = answered[j];
      if (x.rec.id === y.rec.id || similar(x.q, y.q) < 0.7 || similar(x.a, y.a) >= 0.35) continue;
      contra.push(q(`Cùng một nội dung (“${short(x.q, 90)}”), tại biên bản ${recTag(x.rec)} ${ban} khai: “${short(x.a, 130)}”; nhưng tại biên bản ${recTag(y.rec)} lại khai: “${short(y.a, 130)}”. Hai lời khai không thống nhất — nội dung nào đúng sự thật? Vì sao có sự thay đổi?`, 'Lời khai thay đổi giữa các lần.', 'high', 'doi-chieu'));
    }
  }
  const merged = { qa: prev.flatMap((r) => r.qa || []), nguoiKhai: last.nguoiKhai };
  localContradictions(merged, others).forEach((m) => contra.push(q(`${m.moTa} ${(m.trichDan || []).slice(0, 3).map((t) => t.replace(/^Biên bản này/, `Lời khai của ${ban}`)).join('; ')}. ${m.cauHoiLamRo || `Đề nghị ${ban} giải thích sự khác nhau.`}`, 'Phát hiện khi đối chiếu số liệu giữa các lời khai.', 'high', 'doi-chieu')));
  if (others.length && contra.length) contra.push(q(`Lời khai của ${ban} có điểm khác với lời khai của những người khác trong vụ việc. ${ban.charAt(0).toUpperCase() + ban.slice(1)} có đề nghị cơ quan điều tra tổ chức đối chất để làm rõ không?`, 'Chuẩn bị đối chất (Điều 189 BLTTHS).', 'normal', 'doi-chieu'));
  add('mau-thuan', 'Đối chiếu mâu thuẫn', 'Điều 85, 189 BLTTHS', 'Mâu thuẫn trong các lần khai của chính người khai và với lời khai của người khác — hỏi sau khi đã chốt các chi tiết.', uniq(contra).slice(0, 10));

  // ⑥ Câu hỏi bổ sung (AI hoặc người dùng).
  add('bo-sung', 'Câu hỏi bổ sung', 'Điều 85 BLTTHS', 'Câu hỏi đề xuất thêm để làm rõ.', uniq(extra.map((x) => q(x.text, x.lyDo || 'Đề xuất bổ sung.', 'high', x.buoc || 'cu-the', x.src || 'ai'))));

  // ⑦ Chốt lại.
  add('ket-thuc', 'Chốt lại, xác nhận lời khai', 'Điều 183, 186, 188 BLTTHS', 'Cho người khai bổ sung, đính chính; ghi nhận tính tự nguyện.', [
    q(`Ngoài những nội dung đã trình bày hôm nay và các lần trước, ${ban} còn khai bổ sung, đính chính nội dung nào không?`, 'Chốt nội dung lời khai.', 'high', 'chot', 'tu-tung'),
    q(suspect ? 'Trong quá trình hỏi cung, anh/chị có bị ép buộc, đe dọa, dụ dỗ, mớm cung không? Lời khai trên có phải do anh/chị tự nguyện khai báo không?' : 'Trong buổi làm việc, anh/chị có bị ép buộc, gợi ý nội dung khai không? Lời khai trên có đúng sự thật, do anh/chị tự nguyện trình bày không?', 'Bảo đảm giá trị pháp lý của lời khai.', 'high', 'chot', 'tu-tung'),
  ]);

  const total = issues.reduce((s, i) => s + i.cauHoi.length, 0);
  const plan = {
    crime: crime || null,
    dieu,
    role,
    roleId,
    hanhVi: base?.hanhVi || (base?.hanhViIds || []).map((id) => ({ id })),
    hanhViIds: base?.hanhViIds || (base?.hanhVi || []).filter((h) => !h.dieu).map((h) => h.id),
    lienQuan: base?.lienQuan || [],
    dinhKhung: base?.dinhKhung || [],
    issues,
    taiLieu: base?.taiLieu || [],
    giamDinh: base?.giamDinh || [],
    stats: { issues: issues.length, questions: total },
    followUp: { lan: lanMoi, from: prev.map((r) => r.id) },
  };
  return {
    plan,
    summary: {
      lan: lanMoi,
      prev: prev.length,
      answered: answered.length,
      clarify: issues.find((i) => i.key === 'lam-ro')?.cauHoi.length || 0,
      open: openCount,
      signs: missSigns.length,
      contra: issues.find((i) => i.key === 'mau-thuan')?.cauHoi.length || 0,
      total,
    },
  };
}

/** Lời nhắc cho AI: đọc các biên bản trước, đề xuất câu hỏi lần tiếp theo theo tư duy điều tra viên cao cấp. */
export function followUpPrompt({ prev, others = [], crime, role, plan, max = 22000 }) {
  const qa = (r) => (r.qa || []).filter((x) => x.q || x.a).map((x, i) => `[${i + 1}] Hỏi: ${x.q}\nĐáp: ${x.a || '(chưa trả lời)'}`).join('\n');
  const body = `Tội danh: ${crime ? `Điều ${crime.dieu} BLHS — ${crime.ten}\nDấu hiệu định tội: ${(crime.dauHieu || []).join('; ')}` : 'chưa xác định'}
Người khai: ${prev.at(-1)?.nguoiKhai?.hoTen || ''} — ${role.ten}
Sắp lấy lời khai lần ${plan.followUp.lan}.

CÁC BIÊN BẢN TRƯỚC CỦA NGƯỜI NÀY:
${prev.map((r) => `--- Biên bản ${recTag(r)}:\n${qa(r)}`).join('\n')}
${others.length ? `\nLỜI KHAI CỦA NGƯỜI KHÁC TRONG VỤ (để đối chiếu):\n${others.slice(0, 6).map((r) => `--- ${r.nguoiKhai?.hoTen || 'Người khác'} (${recTag(r)}):\n${qa(r)}`).join('\n')}` : ''}

CÂU HỎI ĐÃ CHUẨN BỊ (không lặp lại):
${plan.issues.flatMap((i) => i.cauHoi.map((c) => `- ${c.text}`)).join('\n').slice(0, 6000)}`;
  // Hướng dẫn cố định đặt trước (đọc lại từ cache), nội dung biên bản đặt sau.
  return withCache(`Với tư duy của điều tra viên cao cấp, đề xuất 8–15 câu hỏi BỔ SUNG cho lần khai tới, bám sát những điểm còn chưa rõ, chưa hợp lý, mâu thuẫn, né tránh trong các biên bản bên dưới; câu hỏi phải dẫn chiếu cụ thể nội dung đã khai (“Tại lời khai ngày…, anh/chị khai…”), đi từ cụ thể hóa → kiểm chứng → đối chiếu, không mớm cung, không trùng câu hỏi đã chuẩn bị.
Chỉ trả về JSON: {"cauHoi":[{"text":"câu hỏi","lyDo":"vì sao cần hỏi","buoc":"cu-the|kiem-chung|doi-chieu"}]}

`, body.slice(0, max));
}
