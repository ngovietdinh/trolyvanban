// v2.50: mô hình cụm từ có nghĩa — không luận tội bằng từ đơn. Bộ câu bẫy (phải KHÔNG nhận) và câu thật (phải nhận).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessCrime } from '../../assets/js/legal/relevance.js';
import { analyzeOffline } from '../../assets/js/legal/analyze.js';
import { findPhrase, pctInjury, isActionSentence, EXCLUDE, ASSAULT, groupRe } from '../../assets/js/legal/lexicon.js';

// Câu bẫy: có từ nhạy cảm (đánh, đâm, chém, đá, chết, giết, %, nhập viện…) nhưng KHÔNG mô tả hành vi phạm tội.
const BAY = [
  'Hội đồng đánh giá hồ sơ dự thầu và chấm điểm 10% cho tiêu chí kỹ thuật.',
  'Công ty chia cổ tức 10% và đánh giá lại tài sản cố định, tổn thất 200 triệu đồng.',
  'Kế toán đánh máy văn bản, đánh số trang, đánh dấu các mục cần sửa rồi gửi lãnh đạo đánh giá.',
  'Anh ta đâm đơn kiện và chém gió về kết quả bóng đá, tỷ lệ đặt cược 10%.',
  'Sau khi đánh bạc thua, A đánh xe về nhà, xe bị chết máy giữa đường.',
  'Máy tính chết máy nên tôi đánh máy lại, giết thời gian bằng cách đánh cờ với bạn.',
  'Xe ô tô đâm vào cột điện làm hư hỏng đầu xe, tài xế được đưa đi kiểm tra sức khỏe.',
  'Lãi suất cho vay là 10% một năm, bên vay đã trả đủ gốc và lãi.',
  'Bị hại không chết là ngoài ý muốn chủ quan của bị cáo; về mặt chủ quan bị cáo có lỗi cố ý.',
  'Trận bóng đá kết thúc, đội khách đá phạt hỏng, khán giả ném rác xuống sân.',
  'Doanh nghiệp khai thác đá tại mỏ đá Đồng Giao, đập đá để làm vật liệu xây dựng.',
  'Ông A nhập viện điều trị bệnh tim, chi phí được bảo hiểm thanh toán 80%.',
  'Chị B đánh giày cho khách, mỗi ngày đánh được 30 đôi.',
  'Con lừa kéo xe chở 10 bao xi măng; trộm vía cháu bé rất ngoan.',
  'Người làm chứng nhìn trộm qua khe cửa thấy hai người đang đánh cờ.',
];
// Câu thật: cụm có nghĩa → phải nhận đúng điều.
const THAT = [
  ['134', 'Bị cáo dùng dao đâm vào bụng anh B gây thương tích, tỷ lệ tổn thương cơ thể 35%.'],
  ['134', 'A đánh vào mặt chị C làm chị C gãy mũi phải nhập viện.'],
  ['134', 'Nguyễn Văn A đánh anh B nhiều cái vào đầu, anh B bị chấn thương sọ não.'],
  ['134', 'Bị cáo cầm tuýp sắt vụt liên tiếp vào đầu bị hại khiến bị hại ngất xỉu, kết luận giám định tỷ lệ tổn thương 12%.'],
  ['134', 'Hai bên xô xát, T dùng mũ bảo hiểm đập vào đầu H, H bị rách da đầu phải khâu 5 mũi.'],
  ['134', 'B bị A đánh gây thương tích 21% theo kết luận giám định pháp y.'],
  ['123', 'A dùng dao đâm B, B tử vong.'],
  ['123', 'Bị cáo dùng dao nhọn đâm một nhát vào ngực trái của anh H, anh H chết trên đường đi cấp cứu.'],
  ['123', 'Đ cầm dao đâm liên tiếp vào vùng bụng, ngực của anh T1 — là vùng trọng yếu của cơ thể — anh T1 tử vong do mất máu cấp.'],
  ['173', 'Lê Văn C đột nhập vào nhà anh D lấy trộm chiếc xe máy trị giá 30 triệu đồng.'],
];

test('câu bẫy: từ nhạy cảm trong cụm vô hại không làm phát sinh tội danh (134, 123, 173, 360)', () => {
  for (const t of BAY) {
    for (const d of ['134', '123', '173', '360']) {
      const a = assessCrime(d, t);
      assert.equal(a.show, false, `Điều ${d} không được nhận: “${t}” → ${a.yeuTo.filter((y) => y.ok).map((y) => `${y.id}=${y.khop}`).join(', ')}`);
    }
    assert.equal(analyzeOffline(t, {}).crimes.filter((c) => ['134', '123'].includes(c.dieu)).length, 0, `phân tích trên máy không được ra 134/123: ${t}`);
  }
});

test('câu thật: cụm có nghĩa → nhận đúng điều, nêu đúng cụm đã khớp (khop) để giải thích', () => {
  for (const [d, t] of THAT) {
    const a = assessCrime(d, t);
    assert.equal(a.show, true, `Điều ${d} phải nhận: “${t}” → ${a.why}`);
    const hv = a.yeuTo.find((y) => y.id === 'hanh-vi');
    assert.ok(hv?.ok && hv.khop && hv.khop.split(/\s+/).length >= 2, `cụm khớp phải có ≥ 2 từ: ${hv?.khop}`);
  }
  const a = assessCrime('134', THAT[0][1]);
  assert.equal(a.yeuTo.find((y) => y.id === 'hanh-vi').khop, 'dùng dao đâm');
  assert.equal(a.yeuTo.find((y) => y.id === 'ty-le').khop, '35%');
  // 134 và 123 phân biệt: đâm chết → 123, không phải 134 kèm theo; thương tích không chết → 134.
  assert.equal(assessCrime('134', 'A dùng dao đâm B, B tử vong.').show, false);
  assert.equal(assessCrime('123', THAT[0][1]).show, false);
});

test('tỷ lệ % chỉ là tổn thương cơ thể khi đi cùng ngữ cảnh thương tích', () => {
  assert.deepEqual(pctInjury('chia cổ tức 10%, lãi suất 12%/năm'), []);
  assert.deepEqual(pctInjury('tỷ lệ tổn thương cơ thể 35%'), [35]);
  assert.deepEqual(pctInjury('kết luận giám định pháp y: thương tích 21,5 %'), [21.5]);
  assert.deepEqual(pctInjury('45% tỷ lệ tổn thương cơ thể'), [45]);
});

test('findPhrase bỏ khớp nằm trong cụm vô hại; isActionSentence chỉ nhận cụm hành vi', () => {
  const re = groupRe(ASSAULT);
  assert.equal(findPhrase('lãnh đạo đánh giá nhân viên', re), null);
  assert.deepEqual(findPhrase('A đánh vào mặt B', re), { index: 2, khop: 'đánh vào mặt' });
  assert.equal(isActionSentence('Tổ chức họp đánh giá, các thành viên tham gia đầy đủ, nâng cao chất lượng.'), false);
  assert.equal(isActionSentence('Bị cáo lợi dụng chức vụ để chiếm đoạt tiền của dự án.'), true);
  assert.equal(isActionSentence('A xông vào đánh B.'), true);
  // Danh sách cụm vô hại không rỗng, không trùng.
  const all = Object.values(EXCLUDE).flat();
  assert.ok(all.length > 100);
  assert.equal(new Set(all).size, all.length, 'cụm vô hại trùng nhau');
});
