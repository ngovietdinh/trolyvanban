import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECOGNIZERS, jobNames } from '../../assets/js/legal/recognizers.js';
import { assessCrime, lawGate } from '../../assets/js/legal/relevance.js';
import { findCrime } from '../../assets/js/legal/engine.js';
import { analyzeOffline } from '../../assets/js/legal/analyze.js';
import { analyzeStatements, questionsByPerson } from '../../assets/js/legal/statements.js';

const NAMES = { 354: /nhận hối lộ/, 364: /đưa hối lộ/, 365: /môi giới hối lộ/, 353: /tham ô/, 355: /lạm dụng chức vụ, quyền hạn chiếm đoạt/, 356: /lợi dụng chức vụ, quyền hạn trong khi thi hành công vụ/, 357: /lạm quyền/, 359: /giả mạo trong công tác/, 360: /thiếu trách nhiệm/, 174: /lừa đảo/, 175: /lạm dụng tín nhiệm/, 173: /trộm cắp/, 200: /trốn thuế/, 222: /đấu thầu/, 219: /quản lý, sử dụng tài sản nhà nước/, 229: /quản lý đất đai/, 341: /làm giả con dấu/, 321: /đánh bạc/, 322: /tổ chức đánh bạc/, 134: /cố ý gây thương tích/, 123: /giết người/, 249: /tàng trữ.*ma túy/, 250: /vận chuyển.*ma túy/, 251: /mua bán.*ma túy/ };

// [điều, câu ĐÚNG (nhận diện), câu SAI (không nhận diện)]
const CASES = [
  ['354', 'Ông Trần Văn Bình, Giám đốc Ban QLDA nhận của Công ty Hoàng Long 200 triệu đồng để ký duyệt thanh toán.', 'Bà Lê Thị Cúc nhận 20 triệu đồng của ông An, kế toán Ban QLDA.'],
  ['364', 'Ông Hải đưa cho ông Bình, Giám đốc Ban QLDA 100 triệu đồng để được trúng thầu.', 'Ông Hải mua một chiếc xe máy.'],
  ['365', 'Bà Lan làm trung gian chuyển tiền 50 triệu đồng của ông Hải cho ông Bình.', 'Ông Hải nhận 50 triệu đồng.'],
  ['353', 'Ông Nguyễn Văn An, kế toán Ban QLDA lập chứng từ chi khống rút 300 triệu đồng tiền dự án.', 'Công ty K dùng hóa đơn giả kê khai khống chi phí để trốn thuế 1,2 tỷ đồng, kế toán trưởng Nguyễn Thị L lập hồ sơ khai thuế.'],
  ['355', 'Ông Nam, phó chủ tịch xã, lợi dụng chức vụ để chiếm đoạt 80 triệu đồng của bà Hoa.', 'Ông Nam chiếm đoạt 80 triệu đồng của bà Hoa.'],
  ['356', 'Ông Nam, chủ tịch xã, lợi dụng chức vụ ký quyết định trái quy định để nhận 50 triệu đồng, gây thiệt hại cho ngân sách.', 'Ông Nam, chủ tịch xã, ký quyết định trái quy định.'],
  ['357', 'Ông Nam, trưởng phòng, vượt quá thẩm quyền ký quyết định trái quy định gây thiệt hại 200 triệu đồng.', 'Ông Nam, trưởng phòng, ký quyết định đúng quy định.'],
  ['359', 'Ông Nam, cán bộ địa chính, sửa chữa hồ sơ đất để vụ lợi.', 'Ông Nam sửa chữa hồ sơ đất.'],
  ['360', 'Ông Nam, trưởng phòng, không kiểm tra việc thanh toán, gây thất thoát 500 triệu đồng.', 'Ông Nam, trưởng phòng, kiểm tra kỹ việc thanh toán.'],
  ['174', 'Bà H giả danh cán bộ để chiếm đoạt của chị G 500 triệu đồng.', 'Bà H vay chị G 500 triệu đồng.'],
  ['175', 'Ông K vay của ông M 100 triệu đồng rồi bỏ trốn không trả.', 'Ông K trả nợ cho ông M 100 triệu đồng.'],
  ['173', 'Lê Văn C đột nhập vào nhà anh D trộm cắp chiếc xe máy trị giá 30 triệu đồng.', 'Lê Văn C đến nhà anh D chơi.'],
  ['200', 'Công ty K dùng hóa đơn giả kê khai khống chi phí để trốn thuế 1,2 tỷ đồng.', 'Công ty K nộp đủ thuế GTGT 1,2 tỷ đồng đúng hạn.'],
  ['222', 'Ông Nam, giám đốc ban, chỉ định thầu cho Công ty X dù không đủ năng lực, gây thiệt hại 300 triệu đồng.', 'Công ty X trúng thầu hợp pháp.'],
  ['219', 'Ông Nam, giám đốc, cho thuê trụ sở nhà nước trái quy định gây thất thoát 200 triệu đồng.', 'Ông Nam quản lý trụ sở nhà nước.'],
  ['229', 'Ông Nam, cán bộ địa chính xã, cấp giấy chứng nhận quyền sử dụng đất sai đối tượng gây thiệt hại.', 'Ông Nam, cán bộ địa chính, cấp giấy chứng nhận quyền sử dụng đất đúng quy định.'],
  ['341', 'Ông Nam làm giả con dấu của UBND xã để đóng vào giấy tờ.', 'Ông Nam xin con dấu của UBND xã.'],
  ['321', 'Trần Văn F cùng 4 người đánh bạc bằng xóc đĩa, tổng số tiền 30 triệu đồng.', 'Trần Văn F chơi cờ vua cùng bạn.'],
  ['322', 'Trần Văn F tổ chức xóc đĩa tại nhà, thu tiền xâu, tổng số tiền đánh bạc 80 triệu đồng.', 'Trần Văn F chơi cờ vua cùng bạn.'],
  ['134', 'A dùng dao đâm B gây thương tích tỷ lệ tổn thương cơ thể 35%.', 'A và B cãi nhau.'],
  ['123', 'A dùng dao đâm B, B tử vong.', 'A và B cãi nhau.'],
  ['249', 'Phạm Văn E tàng trữ trái phép 5 gam heroin trong người.', 'Phạm Văn E tàng trữ sách báo trong nhà.'],
  ['250', 'Phạm Văn E vận chuyển 20 gam heroin bằng xe máy.', 'Phạm Văn E vận chuyển 20 kg gạo bằng xe máy.'],
  ['251', 'Phạm Văn E bán 3 gam heroin cho con nghiện lấy 2 triệu đồng.', 'Phạm Văn E bán 3 kg gạo cho hàng xóm.'],
];

test('số điều trong bộ nhận diện khớp tên trong Bộ luật của phần mềm', () => {
  for (const r of RECOGNIZERS) assert.match(findCrime(r.d)?.ten || '', NAMES[r.d], `Điều ${r.d}`);
  assert.equal(RECOGNIZERS.length, Object.keys(NAMES).length);
  for (const r of RECOGNIZERS) {
    assert.ok(r.el.some((e) => e.req), `Điều ${r.d} cần có yếu tố bắt buộc`);
    assert.ok(r.vs.length > 20, `Điều ${r.d} có mục phân biệt`);
    r.el.forEach((e) => assert.ok(e.hoi, `Điều ${r.d} / ${e.id} có câu hỏi làm rõ`));
  }
});

for (const [d, pos, neg] of CASES) {
  test(`bộ nhận diện Điều ${d}: nhận đúng tình huống, bỏ qua tình huống không đủ yếu tố`, () => {
    const a = assessCrime(d, pos);
    assert.equal(a.show, true, `phải nhận diện: ${pos} → ${a.why}`);
    assert.equal(a.nguon, 'bo-nhan-dien');
    assert.ok(a.yeuTo.filter((y) => y.ok && y.quote).length >= 2, 'nêu yếu tố đã có kèm câu trích');
    assert.equal(assessCrime(d, neg).show, false, `không được nhận diện: ${neg}`);
  });
}

test('chủ thể phải là chính người thực hiện hành vi (đứng trước động từ), không phải người khác trong đoạn', () => {
  const t = 'Ông Nguyễn Văn An, kế toán Ban QLDA lập chứng từ chi khống. Bà Lê Thị Cúc nhận 20 triệu đồng của ông An để làm thủ tục.';
  assert.equal(assessCrime('354', t).show, false, 'Cúc không có chức vụ; An (có chức vụ) là người đưa');
  assert.deepEqual([...jobNames('Ông Trần Văn Bình, Giám đốc Ban QLDA chỉ định thầu. Ông Bình nhận tiền.')], ['Bình']);
  const t2 = 'Ông Trần Văn Bình, Giám đốc Ban QLDA chỉ định thầu cho Công ty X. Ông Bình nhận 200 triệu đồng của Công ty X để ký duyệt thanh toán.';
  const a = assessCrime('354', t2);
  assert.equal(a.show, true, a.why);
  assert.ok(a.yeuTo.find((y) => y.id === 'chu-the').ok);
  // “Tôi” + chức danh nêu trong cảnh.
  assert.equal(assessCrime('353', 'Tôi là thủ quỹ Công ty X. Tôi lấy 200 triệu đồng tiền quỹ chi tiêu cá nhân, không nhập quỹ.').show, true);
});

test('lời phủ nhận không phải căn cứ; yếu tố còn thiếu được nêu kèm câu hỏi', () => {
  assert.equal(assessCrime('354', 'Ông Bình, Giám đốc Ban QLDA, khai: tôi không hề nhận 200 triệu đồng của Công ty X.').show, false);
  const a = assessCrime('354', 'Ông Trần Văn Bình, Giám đốc Ban QLDA nhận tiền của Công ty X để ký duyệt thanh toán.');
  assert.equal(a.show, true);
  assert.equal(a.muc, 'cao');
  assert.deepEqual(a.thieu.map((y) => y.id), ['gia-tri']);
  // Thiếu mục đích (bắt buộc) → chưa kết luận, chỉ báo cần làm rõ.
  const b = assessCrime('354', 'Ông Trần Văn Bình, Giám đốc Ban QLDA nhận tiền của Công ty X.');
  assert.equal(b.show, false);
  assert.equal(b.muc, 'gan');
  assert.ok(b.thieu.some((y) => y.id === 'vi-viec' && y.hoi));
  assert.ok(a.thieu.every((y) => y.hoi));
  assert.match(a.why, /chưa rõ/);
  assert.ok(assessCrime('354', 'Ông Trần Văn Bình, Giám đốc Ban QLDA nhận của Công ty X 200 triệu đồng để ký duyệt thanh toán.').muc === 'cao');
});

test('cổng AI dùng bộ nhận diện: xét câu chứa trích dẫn trong nội dung gốc', () => {
  const src = 'Ông Nguyễn Văn An, kế toán Ban QLDA huyện X lập chứng từ chi khống rút 300 triệu đồng. Sau đó ông An chuyển cho Giám đốc Trần Văn Bình 100 triệu đồng.';
  const g = lawGate('353', { trich: 'lập chứng từ chi khống rút 300 triệu đồng', source: src });
  assert.equal(g.ok, true);
  assert.ok(g.yeuTo.some((y) => y.id === 'hanh-vi' && y.ok && /rút 300 triệu/.test(y.quote)));
  const g2 = lawGate('354', { trich: 'ông An chuyển cho Giám đốc Trần Văn Bình 100 triệu đồng', source: src });
  assert.equal(g2.ok, false, 'không có hành vi nhận / chủ thể nhận');
  assert.ok(g2.thieu.length > 0);
});

test('phân tích trên máy: điều luật kèm yếu tố cấu thành, trích dẫn và phân biệt', () => {
  const r = analyzeOffline('Ông Trần Văn Bình, Giám đốc Ban QLDA chỉ định thầu cho Công ty Hoàng Long dù không đủ điều kiện năng lực. Ông Bình nhận 200 triệu đồng của Công ty Hoàng Long để ký duyệt thanh toán.', {});
  const ds = r.crimes.map((c) => c.dieu);
  assert.ok(ds.includes('354') && ds.includes('222'), ds.join());
  const c = r.crimes.find((x) => x.dieu === '354');
  assert.equal(c.can.nguon, 'bo-nhan-dien');
  assert.ok(c.can.yeuTo.every((y) => y.label) && c.can.yeuTo.some((y) => y.ok && y.quote));
  assert.match(c.can.vs, /364/);
});

test('Phân tích lời khai: điều luật đủ yếu tố bắt buộc nhưng thiếu yếu tố → điểm cần làm rõ kèm câu hỏi', () => {
  const r = analyzeStatements([{ speaker: 'Trần Văn Bình', role: 'Giám đốc', text: 'Tôi là Giám đốc Ban QLDA. Tôi nhận tiền của Công ty Hoàng Long để ký duyệt thanh toán.' }]);
  const c = r.map.crimes.find((x) => x.dieu === '354');
  assert.ok(c, 'nhận diện 354');
  const is = r.issues.find((x) => x.kind === 'thieu-yeu-to' && /354/.test(x.title));
  assert.ok(is, 'có điểm thiếu yếu tố');
  assert.match(is.title, /lợi ích từ 2 triệu/);
  // Chưa nêu mục đích → chưa kết luận 354, báo cần làm rõ ngay.
  const r2 = analyzeStatements([{ speaker: 'Trần Văn Bình', role: 'Giám đốc', text: 'Tôi là Giám đốc Ban QLDA. Tôi nhận 200 triệu đồng của Công ty Hoàng Long.' }]);
  assert.ok(!r2.map.crimes.some((x) => x.dieu === '354'));
  const is2 = r2.issues.find((x) => x.kind === 'thieu-yeu-to' && /354/.test(x.title));
  assert.ok(is2 && is2.level === 'cao' && /để làm hoặc không làm/.test(is2.title));
  assert.ok(is.ask.length >= 1);
  assert.ok(questionsByPerson([is]).some((g) => /Điều 354/.test(g.ai)));
});

test('hành vi đã rõ nhưng chưa rõ chủ thể có chức vụ: không đưa vào sơ đồ, báo “cần làm rõ” kèm câu hỏi', () => {
  const t = 'Ngày 05/3/2025 ông Nguyễn Văn An lập chứng từ chi khống để rút tiền chiếm đoạt 300 triệu đồng của dự án.';
  const r = analyzeOffline(t, {});
  assert.ok(!r.crimes.some((c) => c.dieu === '353'), 'chưa rõ An có chức vụ → chưa kết luận tham ô');
  const g = r.canLamRo.find((c) => c.dieu === '353');
  assert.ok(g, 'nêu Điều 353 cần làm rõ');
  assert.equal(g.can.muc, 'gan');
  assert.ok(g.can.thieu.some((y) => y.id === 'chu-the' && y.hoi));
  const s = analyzeStatements([{ speaker: 'Nguyễn Văn An', text: t.replace('ông Nguyễn Văn An', 'tôi') }]);
  const is = s.issues.find((x) => x.kind === 'thieu-yeu-to' && /353/.test(x.title));
  assert.ok(is && is.level === 'cao', 'điểm cần làm rõ ngay');
  assert.match(is.title, /chủ thể/);
  // Có chức vụ → được chọn.
  assert.ok(analyzeOffline(t.replace('ông Nguyễn Văn An', 'ông Nguyễn Văn An, kế toán Ban QLDA'), {}).crimes.some((c) => c.dieu === '353'));
});
