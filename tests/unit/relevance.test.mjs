import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessCrime, lawCandidates, lawGate, lawCatalog, citedArticles, pickShown } from '../../assets/js/legal/relevance.js';
import { analyzeOffline, aiItems, analyzePrompt, ANALYZE_SYSTEM } from '../../assets/js/legal/analyze.js';
import { buildCaseMap, caseMapPrompt, caseMapRefinePrompt, lawContext, mergeAiCaseMap, CASE_MAP_SYSTEM, similarText } from '../../assets/js/legal/case-map.js';
import { stripCache } from '../../assets/js/lib/cache-mark.js';

const CHI_KHONG = 'Ngày 05/3/2025 ông Nguyễn Văn An, kế toán Ban QLDA huyện X lập chứng từ chi khống rút 300 triệu đồng. Sau đó ông An chuyển cho Giám đốc Trần Văn Bình 100 triệu đồng. Bà Lê Thị Cúc nhận 20 triệu đồng của ông An.';
const DAT = 'Ông Lê Văn Hải, cán bộ địa chính xã Y nhận của bà Phạm Thị Lan 50 triệu đồng để làm thủ tục cấp giấy chứng nhận quyền sử dụng đất trái quy định. Ông Hải lập hồ sơ giả mạo chữ ký của chủ đất cũ.';

test('điều luật chỉ được đưa ra khi có căn cứ: không kéo theo điều gần nghĩa không liên quan', () => {
  const r = analyzeOffline(CHI_KHONG, {});
  assert.deepEqual(r.crimes.map((c) => c.dieu), ['353']);
  assert.ok(r.crimes[0].reasons.join(' ').includes('Câu'), 'có căn cứ');
  // “lập hồ sơ giả” không phải gian lận bảo hiểm; “sử dụng lao động dưới 16 tuổi” không liên quan.
  const d = analyzeOffline(DAT, {});
  assert.ok(d.crimes.some((c) => c.dieu === '229'));
  assert.ok(!d.crimes.some((c) => ['214', '296', '213', '263'].includes(c.dieu)));
  // Không có điều nào đủ căn cứ → không lấy tạm vài điều điểm cao nhất.
  assert.deepEqual(analyzeOffline('Ông A và ông B gặp nhau ở quán cà phê rồi cùng đi ăn tối với gia đình.', {}).crimes, []);
});

test('chủ thể đặc biệt: tội về chức vụ cần người có chức vụ, quyền hạn trong nội dung', () => {
  assert.equal(assessCrime('359', 'Ông Nam lập hồ sơ giả mạo chữ ký của chủ đất cũ để sang tên.').show, false);
  assert.equal(assessCrime('359', 'Ông Nam, cán bộ địa chính, lập hồ sơ giả mạo chữ ký của chủ đất cũ để sang tên.').show, true);
  // Viện dẫn hoặc điều đang xét thì luôn được giữ.
  assert.equal(assessCrime('354', 'Nội dung bất kỳ', { primary: '354' }).show, true);
  assert.deepEqual([...citedArticles('Theo Điều 354 BLHS và Điều 9999, Điều 12 Luật phòng chống tham nhũng')], ['354']);
});

test('cổng điều luật cho kết quả AI: cần trích dẫn, đủ dấu hiệu, đúng chủ thể', () => {
  assert.equal(lawGate('353', { trich: 'lập chứng từ chi khống rút 300 triệu đồng', source: CHI_KHONG }).ok, true);
  assert.equal(lawGate('353', { trich: '', source: CHI_KHONG }).ok, false, 'không có trích dẫn');
  assert.equal(lawGate('353', { trich: '', source: CHI_KHONG, primary: '353' }).ok, true, 'điều đang xét');
  assert.equal(lawGate('214', { trich: 'Ông Hải lập hồ sơ giả mạo chữ ký của chủ đất cũ', source: DAT }).ok, false, 'gian lận BHXH không liên quan');
  assert.equal(lawGate('200', { trich: 'lập chứng từ chi khống rút 300 triệu đồng', source: CHI_KHONG }).ok, false, 'chỉ trùng từ “chứng từ”');
  assert.equal(lawGate('354', { trich: 'cán bộ địa chính xã Y nhận của bà Phạm Thị Lan 50 triệu đồng để làm thủ tục', source: DAT }).ok, true, 'đúng tình huống nhận tiền để làm thủ tục');
  assert.equal(lawGate('354', { trich: 'Bà Lan nhận 50 triệu đồng', source: 'Bà Lan nhận 50 triệu đồng' }).ok, false, 'thiếu chủ thể có chức vụ');
  assert.equal(lawGate('9999', { trich: 'x', source: 'x' }).ok, false);
});

test('ứng viên gửi AI: gọn, đủ các điều thường gặp, có mục phân biệt điều dễ nhầm', () => {
  const thau = 'Ông Trần Văn Bình, Giám đốc Ban QLDA chỉ định thầu cho Công ty Hoàng Long. Công ty đã đưa cho ông Bình 200 triệu đồng sau khi trúng thầu. Ông Bình nhận tiền và ký duyệt thanh toán.';
  const c = lawCandidates(thau, {}).map((x) => x.dieu);
  assert.ok(['222', '354', '364'].every((d) => c.includes(d)), c.join(','));
  assert.ok(c.length <= 8);
  const cat = lawCatalog(lawCandidates(thau, {}));
  assert.match(cat, /PHÂN BIỆT/);
  assert.match(cat, /Nhận hối lộ \(354\)/);
  assert.ok(cat.length < 3000, 'danh mục gọn');
});

test('lời nhắc AI chứa quy tắc + danh mục; phần cố định tách khỏi nội dung để cache', () => {
  assert.match(CASE_MAP_SYSTEM, /QUY TẮC/);
  for (const k of ['NGUỒN', 'NGUYÊN VĂN', 'KHÔNG TRÙNG LẶP', 'DÒNG TIỀN', 'ĐIỀU LUẬT', 'BẢN CHẤT', 'GỌN']) assert.match(CASE_MAP_SYSTEM, new RegExp(k));
  assert.match(ANALYZE_SYSTEM, /ĐIỀU LUẬT/);
  assert.doesNotMatch(ANALYZE_SYSTEM, /liệt kê đủ|chỉ nêu khi chắc chắn/);
  const law = lawContext(CHI_KHONG, {});
  assert.match(law.catalog, /Điều 353/);
  const p = stripCache(caseMapPrompt('nội dung X', { law: law.catalog }));
  assert.ok(p.indexOf('DANH MỤC ĐIỀU LUẬT') < p.indexOf('NỘI DUNG:'));
  assert.match(p, /"chuaRo"/);
  assert.match(p, /trich":"nguyên văn câu nói về quan hệ/);
  assert.match(stripCache(caseMapPrompt('x', {})), /để "dieu" rỗng/);
  const m = buildCaseMap({ sources: [{ label: 'x', text: CHI_KHONG }] });
  assert.match(stripCache(caseMapRefinePrompt(m, 'bổ sung', { law: law.catalog })), /DANH MỤC ĐIỀU LUẬT/);
  assert.match(stripCache(analyzePrompt('tài liệu', { primary: '353', candidates: ['353', '355', '174'], role: 'bị can' })), /PHÂN BIỆT/);
});

test('AI gán điều luật: không đủ căn cứ → “chưa xác định điều luật”; hành vi trùng gộp một; dòng tiền cần câu nguyên văn', () => {
  const base = buildCaseMap({ sources: [{ label: 'x', text: CHI_KHONG }] });
  const out = mergeAiCaseMap(base, JSON.stringify({
    hanhVi: [
      { ten: 'Lập chứng từ chi khống rút tiền', dieu: '353', trich: 'lập chứng từ chi khống rút 300 triệu đồng' },
      { ten: 'Lập chứng từ chi khống để rút tiền', dieu: '353', trich: 'lập chứng từ chi khống rút 300 triệu đồng' },
      { ten: 'Lập hồ sơ giả', dieu: '214', trich: 'lập chứng từ chi khống rút 300 triệu đồng' },
    ],
    quanHe: [
      { tu: 'Nguyễn Văn An', den: 'Trần Văn Bình', loai: 'tien', soTien: '100 triệu đồng', trich: 'ông An chuyển cho Giám đốc Trần Văn Bình 100 triệu đồng' },
      { tu: 'Nguyễn Văn An', den: 'Trần Văn Bình', loai: 'tien', soTien: '100 triệu', trich: 'ông An chuyển cho Giám đốc Trần Văn Bình 100 triệu đồng' },
      { tu: 'Lê Thị Cúc', den: 'Trần Văn Bình', loai: 'tien', soTien: '20 triệu đồng' },
      { tu: 'Nguyễn Văn An', den: 'Lê Thị Cúc', loai: 'tien', soTien: '999 triệu đồng', trich: 'Bà Lê Thị Cúc nhận 20 triệu đồng của ông An' },
    ],
  }), { replace: true, source: CHI_KHONG });
  assert.deepEqual(out.crimes.map((c) => c.dieu), ['353', '']);
  assert.equal(out.crimes[0].items.length, 1, 'trùng → một');
  assert.match(out.crimes[0].canCu, /AI xác định/);
  assert.equal(out.verifyDropped.dieu, 1);
  assert.equal(out.verifyDropped.dongTien, 1, 'Cúc → Bình không có câu nguyên văn');
  const tien = out.edges.filter((e) => e.loai === 'tien');
  assert.equal(tien.filter((e) => e.den === 'Trần Văn Bình').length, 1, 'cùng khoản nêu hai cách ghi → một');
  assert.equal(tien.find((e) => e.den === 'Lê Thị Cúc').soTien, '20 triệu đồng', 'số tiền không nằm trong câu trích → bỏ, giữ số tiền nguyên văn của máy');
});

test('hành vi AI (phân tích vụ án): điều chưa đủ căn cứ hiện nhưng không chọn sẵn; trích dẫn không nguyên văn bị bỏ', () => {
  const items = aiItems([
    { ten: 'Chi khống', dieu: '353', hanhViId: null, trich: 'lập chứng từ chi khống rút 300 triệu đồng' },
    { ten: 'Lập hồ sơ giả', dieu: '214', trich: 'lập chứng từ chi khống rút 300 triệu đồng' },
    { ten: 'Việc gì đó', dieu: '', trich: 'câu bịa không có trong tài liệu' },
    { ten: 'Chi khống', dieu: '353', trich: 'lập chứng từ chi khống rút 300 triệu đồng' },
  ], '354', { source: CHI_KHONG });
  assert.equal(items.length, 3, 'trùng gộp');
  assert.equal(items[0].checked, true);
  assert.equal(items[1].checked, false);
  assert.match(items[1].luatYeu, /chưa đủ dấu hiệu/);
  assert.equal(items[2].trich, '');
  assert.equal(items[2].dieu, '354');
  assert.match(items[2].luatYeu, /chưa xác định/);
});

test('similarText: gộp câu gần như cùng nội dung, không gộp việc khác nhau', () => {
  assert.ok(similarText('Lập chứng từ chi khống rút tiền', 'Lập chứng từ chi khống để rút tiền'));
  assert.ok(!similarText('Lập chứng từ chi khống rút tiền', 'Nhận tiền của nhà thầu'));
});

test('nhiều loại vụ việc: đúng điều chính, không kéo theo biến thể / điều gần nghĩa', () => {
  const dieus = (t) => analyzeOffline(t, {}).crimes.map((c) => c.dieu);
  assert.deepEqual(dieus('Do mâu thuẫn, Nguyễn Văn A dùng dao đâm vào ngực anh B gây thương tích tỷ lệ tổn thương cơ thể 35%.'), ['134'], 'không kéo 135 (kích động), 136 (phòng vệ), 137 (bắt giữ)');
  assert.deepEqual(dieus('Lợi dụng đêm khuya, Lê Văn C đột nhập vào nhà anh D trộm cắp một chiếc xe máy trị giá 30 triệu đồng.'), ['173']);
  assert.deepEqual(dieus('Hoàng Thị G dùng thủ đoạn gian dối giả danh cán bộ để chiếm đoạt của chị H số tiền 500 triệu đồng.'), ['174']);
  assert.deepEqual(dieus('Ông Nguyễn Văn I là thủ quỹ Công ty X đã lấy 200 triệu đồng tiền quỹ của công ty chi tiêu cá nhân, không nhập quỹ, không hạch toán.'), ['353']);
  assert.ok(dieus('Phạm Văn E tàng trữ trái phép 5 gam heroin trong người để bán cho con nghiện.').includes('249'));
});
