import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeOffline, mentionedArticles, questionsForAct } from '../../assets/js/legal/analyze.js';
import { generatePlan, findCrime, planToText } from '../../assets/js/legal/engine.js';

const HO_SO = `Qua thanh tra phát hiện ông A, Kế toán trưởng, đã lập chứng từ chi khống để rút tiền chiếm đoạt 1,2 tỷ đồng.
Bà B, thủ quỹ, thu tiền phí của các nhà thầu nhưng không nhập quỹ, không hạch toán.
Ông A đã sử dụng con dấu giả của Sở Tài chính để làm giả hồ sơ quyết toán.
Ông C, Giám đốc, đã ký duyệt các chứng từ trên mà không kiểm tra, thiếu trách nhiệm gây thất thoát.
Hành vi của ông A có dấu hiệu tội Tham ô tài sản theo Điều 353 Bộ luật Hình sự; làm giả có dấu hiệu Điều 341 BLHS. Khởi tố theo Điều 143 BLTTHS.`;

test('điều luật được viện dẫn: chỉ BLHS, bỏ qua BLTTHS', () => {
  const m = mentionedArticles(HO_SO);
  assert.ok(m.has('353') && m.has('341'));
  assert.ok(!m.has('143'));
});

test('phân tích trên máy: nhiều điều luật, hành vi khớp hệ thống kèm đoạn trích', () => {
  const r = analyzeOffline(HO_SO, { primary: '353' });
  const ds = r.crimes.map((c) => c.dieu);
  for (const d of ['353', '341', '360']) assert.ok(ds.includes(d), `thiếu Điều ${d}: ${ds}`);
  const by = (id) => r.items.find((x) => x.hanhViId === id);
  assert.ok(by('chi-khong')?.checked && /chi khống/.test(by('chi-khong').trich));
  assert.ok(by('thu-khong-nhap-quy')?.checked);
  assert.equal(r.items.find((x) => x.dieu === '341')?.checked, true);
  // Không bắt nhầm tội không liên quan chỉ vì trùng cụm “tài sản”, “chiếm đoạt”.
  assert.ok(!ds.includes('168') && !ds.includes('153'), ds.join());
  assert.ok(r.tomTat.length > 20);
});

test('câu hỏi cho hành vi mới bám đoạn trích và dấu hiệu định tội', () => {
  const qs = questionsForAct(findCrime('353'), 'Chỉ đạo thủ quỹ không lập phiếu thu', 'B thu tiền nhưng không lập phiếu thu');
  assert.match(qs[0], /Tài liệu ghi nhận: “B thu tiền/);
  assert.ok(qs.some((q) => /Làm rõ dấu hiệu/.test(q)));
});

test('kế hoạch nhiều điều luật: vấn đề riêng từng điều, không lặp vấn đề chung', () => {
  const p = generatePlan({ dieu: '353', hanhViIds: ['chi-khong'], lienQuan: [{ dieu: '341', hanhViIds: [] }, { dieu: '353', hanhViIds: [] }] });
  assert.equal(p.lienQuan.length, 1);
  const keys = p.issues.map((i) => i.key);
  assert.ok(keys.some((k) => k.startsWith('d341:hv-')));
  assert.ok(keys.includes('d341:chu-quan') || keys.some((k) => k.startsWith('d341:')));
  assert.equal(new Set(keys).size, keys.length, 'khóa vấn đề không trùng');
  assert.equal(keys.filter((k) => k === 'nhan-than' || k.endsWith('nhan-than')).length <= 1, true);
  assert.match(planToText(p), /Điều liên quan: Điều 341/);
  assert.ok(p.hanhVi.some((h) => /\(Điều 341\)$/.test(h.ten)));
});

test('hành vi nhập tay: mỗi dòng một hành vi, khớp hành vi có sẵn hoặc điều gần nhất; không nhầm tội “biến thể”', async () => {
  const { analyzeActs, mergeResults } = await import('../../assets/js/legal/analyze.js');
  const r = analyzeActs('Kế toán lập chứng từ chi khống để rút tiền\nThủ quỹ thu tiền nhưng không nhập quỹ\nDùng dao đâm người khác gây thương tích\nVô ý gây thương tích cho người đi đường\nLén lút trộm cắp xe máy của hàng xóm');
  const by = (s) => r.items.find((x) => x.trich.includes(s) || x.ten.includes(s));
  assert.equal(by('chi khống').hanhViId, 'chi-khong');
  assert.equal(by('không nhập quỹ').dieu, '353');
  assert.equal(by('dao đâm').dieu, '134'); // cố ý — không phải Điều 137 (khi thi hành công vụ)
  assert.equal(by('Vô ý').dieu, '138');
  assert.equal(by('trộm cắp').dieu, '173');
  assert.ok(r.items.every((x) => x.checked));
  assert.equal(r.crimes[0].dieu, '353');
  const m = mergeResults(r, analyzeActs('Kế toán lập chứng từ chi khống để rút tiền'));
  assert.equal(m.items.filter((x) => x.hanhViId === 'chi-khong').length, 1);
});

test('sơ đồ cây: điều chính, điều liên quan, vấn đề chung, tài liệu; đủ câu hỏi', async () => {
  const { planToTree } = await import('../../assets/js/views/plan-tree.js');
  const p = generatePlan({ dieu: '353', hanhViIds: ['chi-khong'], lienQuan: [{ dieu: '341', hanhViIds: [] }] });
  const t = planToTree(p);
  const ids = t.children.map((c) => c.id);
  assert.deepEqual(ids.slice(0, 2), ['crime-353', 'crime-341']);
  assert.ok(ids.includes('common') && ids.includes('docs'));
  const count = (n) => (n.kind === 'q' ? 1 : (n.children || []).reduce((s, c) => s + count(c), 0));
  assert.equal(count(t), p.issues.reduce((s, i) => s + i.cauHoi.length, 0));
});

test('đối chiếu dấu hiệu định tội: số tiền trong nội dung so với ngưỡng của điều luật', async () => {
  const { amountsIn, signCoverage, annotateResult, analyzeActs } = await import('../../assets/js/legal/analyze.js');
  assert.deepEqual(amountsIn('chiếm đoạt 1,2 tỷ đồng, thêm 50.000.000 đồng và 300 triệu').map((x) => x.v), [1.2e9, 5e7, 3e8]);
  assert.deepEqual(amountsIn('Điều 353 năm 2023'), []);
  const s1 = signCoverage(findCrime('353'), 'Kế toán chiếm đoạt 1,2 tỷ đồng');
  assert.ok(s1.some((x) => x.hit && /1,2 tỷ đồng ≥ 2 triệu đồng/.test(x.note)));
  const s2 = signCoverage(findCrime('353'), 'chiếm đoạt 500 nghìn đồng');
  assert.ok(s2.some((x) => !x.hit && /Chưa đủ/.test(x.note || '')));
  const r = annotateResult(analyzeActs('Kế toán lập chứng từ chi khống để rút tiền'), 'Kế toán lập chứng từ chi khống để rút tiền', 'doi-chieu');
  assert.equal(r.method, 'doi-chieu');
  assert.equal(r.items[0].doiChieu, 'khop');
  assert.ok(Array.isArray(r.crimes[0].signs));
});
