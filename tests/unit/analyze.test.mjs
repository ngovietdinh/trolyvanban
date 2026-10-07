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
