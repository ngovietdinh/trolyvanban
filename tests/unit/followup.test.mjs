import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan, BUOC } from '../../assets/js/legal/engine.js';
import { followUpPlan, previousRecords, followUpPrompt } from '../../assets/js/legal/followup.js';
import { getRole } from '../../assets/js/legal/roles.js';

const plan = generatePlan({ dieu: '353', roleId: 'bi-can', hanhViIds: ['chi-khong'] });
const hv = plan.issues.find((i) => i.key.startsWith('hv-'));
const mk = (id, lan, ngay, qa, o = {}) => ({ id, caseId: 'c1', personId: 'p1', roleId: 'bi-can', lan, ngay, nguoiKhai: { hoTen: 'Nguyễn Văn A' }, plan: { dieu: '353', issues: plan.issues, hanhViIds: ['chi-khong'] }, qa, ...o });

test('lần đầu: câu hỏi bài bản theo trình tự tự trình bày → cụ thể hóa → kiểm chứng → đối chiếu → chốt lại', () => {
  const order = Object.keys(BUOC);
  for (const is of plan.issues) for (const c of is.cauHoi) assert.ok(BUOC[c.buoc], `${is.key}: thiếu bước hỏi`);
  assert.equal(hv.cauHoi[0].buoc, 'mo');
  const idx = hv.cauHoi.map((c) => order.indexOf(c.buoc));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b), 'câu hỏi trong vấn đề phải theo trình tự');
  assert.ok(hv.cauHoi.length >= 9);
  assert.ok(hv.cauHoi.some((c) => /quy định.*phải được thực hiện/.test(c.text)));
  assert.equal(plan.issues.at(-1).key, 'ket-thuc');
  assert.ok(plan.issues.find((i) => i.key === 'chu-quan').cauHoi.some((c) => /che giấu, hợp thức hóa/.test(c.text)));
  assert.ok(plan.stats.questions > 55);
  const w = generatePlan({ dieu: '353', roleId: 'lam-chung' });
  assert.ok(w.issues.find((i) => i.key === 'nhan-than').cauHoi.some((c) => /tác động/.test(c.text)));
});

test('lần tiếp theo: bám sát biên bản trước — mơ hồ, tiền, người, thay đổi lời khai, mâu thuẫn với người khác, còn bỏ ngỏ', () => {
  const r1 = mk('r1', 1, '2026-10-01', [
    { q: hv.cauHoi[0].text, a: 'Tôi lập chứng từ chi khống, rút 300 triệu đồng rồi đưa cho ông Trần Văn Bình.', issueId: hv.key },
    { q: hv.cauHoi[1].text, a: 'Tôi không nhớ', issueId: hv.key },
    { q: 'Anh nhận bao nhiêu tiền?', a: 'Tôi nhận 50 triệu đồng.' },
  ]);
  const r2 = mk('r2', 2, '2026-10-05', [{ q: 'Anh nhận bao nhiêu tiền?', a: 'Tôi không nhận tiền của ai cả, chỉ làm theo chỉ đạo.' }]);
  const other = { id: 'o1', caseId: 'c1', personId: 'p2', nguoiKhai: { hoTen: 'Lê C' }, lan: 1, qa: [{ q: 'A nhận bao nhiêu?', a: 'A nhận 80 triệu đồng.' }] };
  const r0 = mk('r0', 1, '2026-09-01', [{ q: 'x', a: 'y' }], { caseId: 'c2' });
  const prev = previousRecords({ caseId: 'c1', personId: 'p1' }, [r2, r1, other, r0]);
  assert.deepEqual(prev.map((r) => r.id), ['r1', 'r2']);
  const { plan: fp, summary } = followUpPlan({ prev, others: [other] });
  assert.equal(summary.lan, 3);
  assert.equal(fp.issues[0].key, 'tiep-noi');
  assert.equal(fp.issues.at(-1).key, 'ket-thuc');
  const all = fp.issues.flatMap((i) => i.cauHoi);
  const txt = all.map((c) => c.text).join('\n');
  assert.match(txt, /Tại biên bản lần 1 ngày 01\/10\/2026, khi được hỏi .* trả lời: “Tôi không nhớ”/);
  assert.match(txt, /làm rõ khoản 300 triệu/);
  assert.match(txt, /nhắc đến Trần Văn Bình/);
  assert.match(txt, /lần 1 ngày 01\/10\/2026 anh\/chị khai: “Tôi nhận 50 triệu đồng”; nhưng tại biên bản lần 2 ngày 05\/10\/2026 lại khai/);
  assert.match(txt, /50 triệu \/ 80 triệu/);
  assert.match(txt, /đối chất/);
  assert.ok(all.every((c) => c.lyDo && BUOC[c.buoc]));
  // Câu hỏi kế hoạch đã có trả lời không lặp lại; câu chưa hỏi được đưa vào.
  const open = fp.issues.filter((i) => i.key.startsWith('con-lai:')).flatMap((i) => i.cauHoi.map((c) => c.text));
  assert.ok(!open.includes(hv.cauHoi[0].text));
  assert.ok(open.some((t) => /che giấu, hợp thức hóa/.test(t)));
  assert.ok(fp.issues.some((i) => i.key === 'dau-hieu'));
  // AI bổ sung + lời nhắc dẫn chiếu biên bản.
  const withAi = followUpPlan({ prev, others: [other], extra: [{ text: 'Câu hỏi AI?', lyDo: 'x' }] }).plan;
  assert.equal(withAi.issues.find((i) => i.key === 'bo-sung').cauHoi[0].text, 'Câu hỏi AI?');
  const prompt = followUpPrompt({ prev, others: [other], crime: fp.crime, role: getRole('bi-can'), plan: fp });
  assert.match(prompt, /lần 3/);
  assert.match(prompt, /Tôi không nhận tiền/);
});
