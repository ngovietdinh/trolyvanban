import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan } from '../../assets/js/legal/engine.js';
import { parsePastedQa } from '../../assets/js/legal/record.js';
import { trackPlan, similar, answerQuality, planFromSaved, recordsForPlan, caseReport, overviewReport, parseRecordText, linkPairsToPlan, buildCaseReportDocument, buildOverviewDocument, qKey } from '../../assets/js/legal/tracking.js';
import { buildDocumentXml } from '../../assets/js/lib/docx.js';
import { renderDocumentHtml } from '../../assets/js/lib/render-html.js';

const plan = generatePlan({ dieu: '353', roleId: 'bi-can' });
const hv = plan.issues.find((i) => i.key.startsWith('hv-'));
const cq = plan.issues.find((i) => i.key === 'chu-quan');

const rec = (over = {}) => ({ id: 'r1', caseId: 'c1', personId: 'p1', roleId: 'bi-can', lan: 1, ngay: '2026-10-01', status: 'hoan-thanh', plan: { dieu: '353' }, coverage: {}, nguoiKhai: { hoTen: 'Nguyễn Văn A' }, qa: [], ...over });

test('so khớp câu hỏi: trùng hẳn, sửa nhẹ, khác hẳn', () => {
  assert.equal(similar('Anh/chị trình bày diễn biến?', 'anh chị trình bày diễn biến'), 1);
  assert.ok(similar(hv.cauHoi[0].text, hv.cauHoi[0].text.replace('cụ thể', '')) > 0.7);
  assert.ok(similar(hv.cauHoi[0].text, 'Tình trạng sức khỏe hiện nay?') < 0.3);
  assert.equal(answerQuality(''), 'empty');
  assert.equal(answerQuality('Tôi không nhớ rõ'), 'vague');
  assert.equal(answerQuality('Không'), 'ok');
});

test('trạng thái từng câu hỏi theo biên bản + đánh dấu thủ công', () => {
  const r = rec({
    qa: [
      { q: hv.cauHoi[0].text, a: 'Ngày 5/3/2025 tôi lập chứng từ chi khống 300 triệu đồng tại phòng kế toán.', issueId: hv.key },
      { q: hv.cauHoi[1].text, a: 'Tôi không nhớ rõ', issueId: hv.key },
      { q: cq.cauHoi[0].text, a: '', issueId: cq.key },
    ],
  });
  const t = trackPlan(plan, [r], { [qKey(hv.cauHoi[2].text)]: 'bo-qua' });
  const ih = t.issues.find((i) => i.key === hv.key);
  assert.equal(ih.items[0].status, 'da-ro');
  assert.equal(ih.items[0].answers[0].who, 'Nguyễn Văn A — lần 1, 01/10/2026');
  assert.equal(ih.items[1].status, 'can-lam-ro');
  assert.equal(ih.items[2].status, 'bo-qua');
  assert.ok(ih.items[2].manual);
  assert.equal(ih.done, 2);
  assert.equal(ih.level, 'mot-phan');
  assert.equal(t.issues.find((i) => i.key === 'chu-quan').items[0].status, 'da-hoi');
  assert.equal(t.issues.find((i) => i.key === 'nhan-than').items[0].status, 'chua');
  assert.equal(t.totals.done, 2);
  assert.ok(t.totals.pct > 0 && t.totals.pct < 100);
});

test('kế hoạch đã lưu: dựng lại kèm lớp chỉnh sửa; biên bản thuộc kế hoạch', () => {
  const saved = { id: 'pl1', caseId: 'c1', dieu: '353', roleId: 'bi-can', hanhViIds: [], overlay: { removed: [hv.cauHoi[0].text], edited: {}, added: { [hv.key]: ['Câu hỏi riêng của tôi?'] }, ai: {} } };
  const p = planFromSaved(saved);
  const is = p.issues.find((i) => i.key === hv.key);
  assert.ok(!is.cauHoi.some((c) => c.text === hv.cauHoi[0].text));
  assert.ok(is.cauHoi.some((c) => c.text === 'Câu hỏi riêng của tôi?'));
  const recs = [rec(), rec({ id: 'r2', roleId: 'lam-chung' }), rec({ id: 'r3', planId: 'pl1', roleId: 'lam-chung' }), rec({ id: 'r4', caseId: 'c2' })];
  assert.deepEqual(recordsForPlan(saved, recs).map((r) => r.id), ['r1', 'r3']);
  assert.equal(planFromSaved({ dieu: '9999' }), null);
});

test('báo cáo hồ sơ: tiến độ, cảnh báo, kết luận; tổng hợp nhiều hồ sơ', () => {
  const now = Date.parse('2026-10-07');
  const c1 = { id: 'c1', ten: 'Vụ tham ô tại Ban QLDA', toiDanh: ['353'], persons: [{ id: 'p1', hoTen: 'Nguyễn Văn A', roleId: 'bi-can' }, { id: 'p2', hoTen: 'Trần Thị B', roleId: 'bi-can' }, { id: 'p3', hoTen: 'Lê C', roleId: 'lam-chung' }], updatedAt: now };
  const c2 = { id: 'c2', ten: 'Vụ chưa làm gì', toiDanh: [], persons: [], updatedAt: now - 40 * 86400000 };
  const plans = [{ id: 'pl1', title: 'Hỏi cung bị can', caseId: 'c1', dieu: '353', roleId: 'bi-can', hanhViIds: [] }];
  const records = [
    rec({ qa: [{ q: hv.cauHoi[0].text, a: 'Tôi lập chứng từ chi khống, chiếm đoạt 300 triệu đồng tiền ngân sách.' }, { q: 'Anh nhận bao nhiêu tiền?', a: 'Tôi nhận 300 triệu đồng.' }] }),
    rec({ id: 'r2', personId: 'p3', roleId: 'lam-chung', status: 'dang-ghi', updatedAt: now - 5 * 86400000, nguoiKhai: { hoTen: 'Lê C' }, qa: [{ q: 'Anh A nhận bao nhiêu?', a: 'A nhận 500 triệu đồng.' }, { q: 'Ai chứng kiến?', a: 'Tôi không nhớ' }] }),
  ];
  const r = caseReport({ caseItem: c1, plans, records, now });
  assert.equal(r.totals.persons, 3);
  assert.equal(r.totals.personsDone, 2);
  assert.equal(r.totals.records, 2);
  assert.equal(r.stage, 'dang-lam');
  assert.ok(r.plans[0].track.totals.done >= 1);
  const texts = r.warnings.map((w) => w.text).join('\n');
  assert.match(texts, /Chưa lấy lời khai Trần Thị B \(Bị can\)/);
  assert.match(texts, /đang ghi dở 5 ngày/);
  assert.match(texts, /mơ hồ/);
  assert.match(texts, /Mâu thuẫn: Số tiền liên quan đến việc “nhận”/);
  assert.equal(r.warnings[0].level, 'cao');
  assert.ok(r.analysis.crimes[0].crime.dieu === '353');
  assert.ok(r.analysis.money.some((m) => m.v === 5e8));
  assert.ok(r.conclusions.some((t) => /Điều 353/.test(t)));
  assert.ok(r.conclusions.at(-1).startsWith('Đánh giá'));

  const o = overviewReport({ cases: [c1, c2], plans, records, now });
  assert.equal(o.totals.cases, 2);
  assert.equal(o.reports[1].stage, 'moi');
  assert.match(o.reports[1].warnings.map((w) => w.text).join('\n'), /Chưa xác định tội danh/);
  assert.match(o.reports[1].warnings.map((w) => w.text).join('\n'), /không có hoạt động 40 ngày/);
  assert.ok(o.totals.high >= 2);

  // Báo cáo Word / bản xem trước có bảng kẻ ô.
  const doc = buildCaseReportDocument(r, { coQuan: 'Cơ quan CSĐT' });
  const xml = buildDocumentXml(doc);
  assert.match(xml, /<w:tblHeader\/>/);
  assert.match(xml, /BÁO CÁO TIẾN ĐỘ/);
  assert.match(renderDocumentHtml(doc), /<table class="vb-table">/);
  assert.match(buildDocumentXml(buildOverviewDocument(o)), /BẢNG TỔNG HỢP/);
});

test('đọc biên bản tải lên: họ tên, ngày, lần, hỏi – đáp, gắn với kế hoạch', () => {
  const text = `BIÊN BẢN HỎI CUNG BỊ CAN
Hồi 9 giờ 00 phút ngày 5 tháng 10 năm 2026 tại trụ sở.
Họ tên: Nguyễn Văn A\t\tGiới tính: Nam;
Đây là lần hỏi cung thứ 2.
HỎI VÀ ĐÁP
Hỏi: ${hv.cauHoi[0].text}
Đáp: Tôi lập chứng từ chi khống.
Hỏi: Ai chỉ đạo?
Đáp: Không ai chỉ đạo.
Việc hỏi cung kết thúc hồi 11 giờ cùng ngày. Biên bản này đã cho bị can tự đọc lại.`;
  const info = parseRecordText(text, parsePastedQa);
  assert.equal(info.hoTen, 'Nguyễn Văn A');
  assert.equal(info.ngay, '2026-10-05');
  assert.equal(info.lan, 2);
  assert.equal(info.roleId, 'bi-can');
  assert.equal(info.pairs.length, 2);
  assert.equal(info.pairs[1].a, 'Không ai chỉ đạo.');
  const qa = linkPairsToPlan(info.pairs, plan);
  assert.equal(qa[0].issueId, hv.id);
  assert.equal(qa[0].planQ, hv.cauHoi[0].id);
  assert.equal(qa[1].planQ, null);
});
