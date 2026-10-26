import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBinhLuan } from '../../assets/js/legal/binh-luan.js';
import { penaltyOf, moneyRanges, parseDuration, articleFrames, generalRules, parseCitations, parseSentence, parseVerdict, checkDefendant, parseComplaint, assessComplaint, buildReviewDocument, analyzeCase, crimeClass, fmtMonths } from '../../assets/js/legal/court.js';

// Sách mẫu: chỉ nguyên văn điều luật (văn bản pháp luật công khai) theo cấu trúc sách Bình luận.
const BOOK_TEXT = [
  'BÌNH LUẬN MẪU',
  'PHẦN THỨ NHẤT',
  'NHỮNG QUY ĐỊNH CHUNG',
  'CHƯƠNG VI',
  'HÌNH PHẠT',
  'Điều 38. Tù có thời hạn',
  '1. Tù có thời hạn là buộc người bị kết án phải chấp hành hình phạt tại cơ sở giam giữ trong một thời hạn nhất định.',
  'Tù có thời hạn đối với người phạm một tội có mức tối thiểu là 03 tháng và mức tối đa là 20 năm.',
  'Bình luận',
  'Bình luận mẫu.',
  'CHƯƠNG VIII',
  'QUYẾT ĐỊNH HÌNH PHẠT',
  'Điều 51. Các tình tiết giảm nhẹ trách nhiệm hình sự',
  '1. Các tình tiết sau đây là tình tiết giảm nhẹ trách nhiệm hình sự:',
  'a) Người phạm tội đã ngăn chặn hoặc làm giảm bớt tác hại của tội phạm;',
  'b) Người phạm tội tự nguyện sửa chữa, bồi thường thiệt hại hoặc khắc phục hậu quả;',
  'i) Phạm tội lần đầu và thuộc trường hợp ít nghiêm trọng;',
  'r) Người phạm tội tự thú;',
  's) Người phạm tội thành khẩn khai báo, ăn năn hối cải;',
  'x) Người phạm tội là người có công với cách mạng hoặc là cha, mẹ, vợ, chồng, con của liệt sĩ.',
  '2. Khi quyết định hình phạt, Tòa án có thể coi đầu thú hoặc tình tiết khác là tình tiết giảm nhẹ, nhưng phải ghi rõ lý do giảm nhẹ trong bản án.',
  '3. Các tình tiết giảm nhẹ đã được Bộ luật này quy định là dấu hiệu định tội hoặc định khung thì không được coi là tình tiết giảm nhẹ trong khi quyết định hình phạt.',
  'Bình luận',
  'Bình luận mẫu.',
  'Điều 52. Các tình tiết tăng nặng trách nhiệm hình sự',
  '1. Chỉ các tình tiết sau đây mới là tình tiết tăng nặng trách nhiệm hình sự:',
  'a) Phạm tội có tổ chức;',
  'b) Phạm tội có tính chất chuyên nghiệp;',
  'h) Tái phạm hoặc tái phạm nguy hiểm;',
  '2. Các tình tiết đã được Bộ luật này quy định là dấu hiệu định tội hoặc định khung hình phạt thì không được coi là tình tiết tăng nặng.',
  'Bình luận',
  'Bình luận mẫu.',
  'Điều 54. Quyết định hình phạt dưới mức thấp nhất của khung hình phạt được áp dụng',
  '1. Tòa án có thể quyết định một hình phạt dưới mức thấp nhất của khung hình phạt được áp dụng nhưng phải trong khung hình phạt liền kề nhẹ hơn của điều luật khi người phạm tội có ít nhất hai tình tiết giảm nhẹ quy định tại khoản 1 Điều 51 của Bộ luật này.',
  '2. Tòa án có thể quyết định một hình phạt dưới mức thấp nhất của khung hình phạt được áp dụng nhưng không bắt buộc phải trong khung hình phạt liền kề nhẹ hơn của điều luật đối với người phạm tội lần đầu là người giúp sức trong vụ án đồng phạm nhưng có vai trò không đáng kể.',
  'Bình luận',
  'Bình luận mẫu.',
  'Điều 65. Án treo',
  '1. Khi xử phạt tù không quá 03 năm, căn cứ vào nhân thân của người phạm tội và các tình tiết giảm nhẹ, nếu xét thấy không cần phải bắt chấp hành hình phạt tù, thì Tòa án cho hưởng án treo và ấn định thời gian thử thách từ 01 năm đến 05 năm và thực hiện các nghĩa vụ trong thời gian thử thách theo quy định của Luật thi hành án hình sự.',
  'Bình luận',
  'Bình luận mẫu.',
  'PHẦN THỨ HAI',
  'CÁC TỘI PHẠM',
  'CHƯƠNG XVI',
  'CÁC TỘI XÂM PHẠM SỞ HỮU',
  'Điều 174. Tội lừa đảo chiếm đoạt tài sản',
  '1. Người nào bằng thủ đoạn gian dối chiếm đoạt tài sản của người khác trị giá từ 2.000.000 đồng đến dưới 50.000.000 đồng hoặc dưới 2.000.000 đồng nhưng thuộc một trong các trường hợp sau đây, thì bị phạt cải tạo không giam giữ đến 03 năm hoặc phạt tù từ 06 tháng đến 03 năm:',
  'a) Đã bị xử phạt vi phạm hành chính về hành vi chiếm đoạt tài sản mà còn vi phạm;',
  '2. Phạm tội thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 02 năm đến 07 năm:',
  'a) Có tổ chức;',
  'b) Có tính chất chuyên nghiệp;',
  'c) Chiếm đoạt tài sản trị giá từ 50.000.000 đồng đến dưới 200.000.000 đồng;',
  '3. Phạm tội thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 07 năm đến 15 năm:',
  'a) Chiếm đoạt tài sản trị giá từ 200.000.000 đồng đến dưới 500.000.000 đồng;',
  '4. Phạm tội thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 12 năm đến 20 năm hoặc tù chung thân:',
  'a) Chiếm đoạt tài sản trị giá 500.000.000 đồng trở lên;',
  '5. Người phạm tội còn có thể bị phạt tiền từ 10.000.000 đồng đến 100.000.000 đồng.',
  'Bình luận',
  'Bình luận mẫu.',
].join('\n');
const book = parseBinhLuan(BOOK_TEXT, []);
const facts = (text) => [{ name: 'Bản án', text }];
const FACTS = 'Bị cáo Nguyễn Văn An đã dùng thủ đoạn gian dối, đưa thông tin sai sự thật về dự án để chị Trần Thị Bình tin tưởng giao tiền, chiếm đoạt số tiền 180.000.000 đồng. Tại phiên tòa bị cáo thành khẩn khai báo, ăn năn hối cải. Gia đình bị cáo đã bồi thường cho bị hại 50.000.000 đồng.';
const ids = (f) => f.map((x) => `${x.level}:${x.id}`);

test('đọc thời hạn, hình phạt, khoảng giá trị trong câu điều luật (kể cả lỗi gõ trong sách)', () => {
  assert.equal(parseDuration('02 năm 06 tháng'), 30);
  assert.equal(fmtMonths(30), '2 năm 6 tháng');
  assert.deepEqual(penaltyOf('thì bị phạt cải tạo không giam giữ đến 03 năm hoặc phạt tù từ 06 tháng đến 03 năm:'), { tuMin: 6, tuMax: 36, caiTaoMax: 36 });
  assert.deepEqual(penaltyOf('thì bị phạt tù 20 năm, tù chung thân hoặc tử hình:'), { tuMin: 240, tuMax: 240, chungThan: true, tuHinh: true });
  assert.deepEqual(penaltyOf('thì bị phạt từ từ 01 năm đến 05 năm.'), { tuMin: 12, tuMax: 60 });
  assert.deepEqual(penaltyOf('thì bị phạt tiền từ 100.000.000 đồng đến 200.000.000 đồng hoặc phạt tù từ 01 năm đến 03 năm:'.normalize('NFD')), { tuMin: 12, tuMax: 36, phatTien: { min: 100000000, max: 200000000 } });
  assert.deepEqual(moneyRanges('Chiếm đoạt tài sản trị giá từ 50.000.000 đồng đến dưới 200.000.000 đồng;'), [{ from: 50000000, to: 200000000 }]);
  assert.deepEqual(moneyRanges('Chiếm đoạt tài sản trị giá 500.000.000 đồng trở lên;'), [{ from: 500000000, to: null }]);
  assert.equal(crimeClass({ tuMax: 36 }), 'ít nghiêm trọng');
  assert.equal(crimeClass({ tuMax: 240, chungThan: true }), 'đặc biệt nghiêm trọng');
});

test('khung hình phạt từ sách: khoản, điểm, mức tù, giá trị; bỏ khoản bổ sung; quy định chung Điều 38, 51, 52, 54, 65', () => {
  const fr = articleFrames(book, '174');
  assert.deepEqual(fr.filter((x) => !x.boSung).map((x) => [x.k, x.penalty.tuMin, x.penalty.tuMax]), [[1, 6, 36], [2, 24, 84], [3, 84, 180], [4, 144, 240]]);
  assert.deepEqual(fr[1].money, [{ from: 50000000, to: 200000000, d: 'c' }]);
  assert.equal(fr[4].boSung, true);
  assert.equal(articleFrames(book, '999'), null);
  const R = generalRules(book);
  assert.equal(R.a38.min, 3);
  assert.equal(R.a38.max, 240);
  assert.equal(R.a65.maxTu, 36);
  assert.deepEqual([R.a65.thuThachMin, R.a65.thuThachMax], [12, 60]);
  assert.deepEqual(R.a51.k1.map((p) => p.d), ['a', 'b', 'i', 'r', 's', 'x']);
  assert.match(R.a51.k2, /đầu thú/);
  assert.equal(R.a54.length, 2);
});

test('đọc bản án: viện dẫn điều / khoản / điểm, hình phạt, án treo, tình tiết từng bị cáo', () => {
  assert.deepEqual(parseCitations('Áp dụng điểm b, s khoản 1, khoản 2 Điều 51; Điều 54; điểm a, c khoản 2 Điều 174'), [
    { dieu: '51', khoan: 1, diem: ['b', 's'] },
    { dieu: '51', khoan: 2, diem: [] },
    { dieu: '54', khoan: null, diem: [] },
    { dieu: '174', khoan: 2, diem: ['a', 'c'] },
  ]);
  assert.deepEqual(parseSentence('Xử phạt bị cáo Lê Văn Cường 02 (hai) năm 06 (sáu) tháng tù nhưng cho hưởng án treo, thời gian thử thách là 05 (năm) năm'), { loai: 'tu', thang: 30, anTreo: true, thuThach: 60 });
  assert.deepEqual(parseSentence('Phạt bị cáo B 18 (mười tám) tháng cải tạo không giam giữ'), { loai: 'cai-tao', thang: 18 });
  const v = parseVerdict(`Tuyên bố bị cáo Nguyễn Văn An và Lê Văn Cường phạm tội "Lừa đảo chiếm đoạt tài sản".
Áp dụng điểm a khoản 3 Điều 174; điểm s khoản 1 Điều 51; điểm b khoản 1 Điều 52 của Bộ luật Hình sự. Xử phạt bị cáo Nguyễn Văn An 08 (tám) năm tù.
Áp dụng điểm c khoản 2 Điều 174; điểm b, s khoản 1, khoản 2 Điều 51; Điều 54; Điều 65 Bộ luật Hình sự. Xử phạt bị cáo Lê Văn Cường 02 (hai) năm tù nhưng cho hưởng án treo, thời gian thử thách 04 (bốn) năm. Bị cáo đã chiếm đoạt số tiền 180.000.000 đồng.`);
  assert.equal(v.defendants.length, 2);
  const [an, cuong] = v.defendants;
  assert.deepEqual([an.hoTen, an.toiDanh, an.giamNhe, an.tangNang, an.hinhPhat], ['Nguyễn Văn An', [{ dieu: '174', khoan: 3, diem: ['a'] }], ['s'], ['b'], { loai: 'tu', thang: 96 }]);
  assert.equal(an.tenToi, 'Lừa đảo chiếm đoạt tài sản');
  assert.deepEqual([cuong.toiDanh[0].khoan, cuong.giamNhe, cuong.giamNheK2, cuong.dieu54, cuong.dieu65, cuong.hinhPhat], [2, ['b', 's'], true, true, true, { loai: 'tu', thang: 24, anTreo: true, thuThach: 48 }]);
  assert.equal(v.money[0].v, 180000000);
});

test('kiểm tra: khung theo giá trị, tình tiết không có căn cứ, tình tiết bị bỏ sót, đề nghị Điều 54', () => {
  const d = { hoTen: 'Nguyễn Văn An', toiDanh: [{ dieu: '174', khoan: 3, diem: ['a'] }], soTien: 180000000, giamNhe: ['s'], tangNang: ['b'], hinhPhat: { loai: 'tu', thang: 96 } };
  const f = checkDefendant(d, { book, sources: facts(FACTS) });
  const has = (id) => f.find((x) => x.id === id);
  assert.equal(has('khung-tien').level, 'loi');
  assert.match(has('khung-tien').title, /thuộc khoản 2, không phải khoản 3/);
  assert.equal(has('khung-tien').law[0].quote, 'Chiếm đoạt tài sản trị giá từ 50.000.000 đồng đến dưới 200.000.000 đồng;');
  assert.equal(has('trong-khung').level, 'dung');
  assert.equal(has('can-cu-52-b').level, 'canh', 'tăng nặng “chuyên nghiệp” không có câu nào trong tài liệu');
  const b = has('bo-sot-51-b');
  assert.equal(b.level, 'goi');
  assert.equal(b.facts[0].quote, 'Gia đình bị cáo đã bồi thường cho bị hại 50.000.000 đồng.');
  assert.ok(!has('bo-sot-51-s'), 'đã áp dụng thì không đề nghị lại');
  assert.ok(!has('bo-sot-51-i'), 'điểm i chỉ cho tội ít nghiêm trọng');
  assert.equal(has('de-nghi-54').level, 'goi');
});

test('kiểm tra: dưới khung không có / không đủ điều kiện Điều 54; án treo quá 3 năm, thử thách sai; trùng định khung', () => {
  const base = { hoTen: 'Lê Văn Cường', toiDanh: [{ dieu: '174', khoan: 2, diem: ['b'] }], soTien: null, giamNhe: [], tangNang: [], hinhPhat: { loai: 'tu', thang: 18 } };
  assert.ok(ids(checkDefendant(base, { book })).includes('loi:duoi-khung-khong-54'));
  assert.ok(ids(checkDefendant({ ...base, dieu54: true, giamNhe: ['s'] }, { book })).includes('loi:dieu-54-thieu'));
  assert.ok(ids(checkDefendant({ ...base, dieu54: true, giamNhe: ['b', 's'] }, { book })).includes('dung:dieu-54-ok'));
  assert.ok(ids(checkDefendant({ ...base, dieu54: true, giamNhe: ['b', 's'], hinhPhat: { loai: 'tu', thang: 4 } }, { book })).includes('canh:dieu-54-lien-ke'));
  const at = checkDefendant({ ...base, hinhPhat: { loai: 'tu', thang: 48, anTreo: true, thuThach: 72 } }, { book });
  assert.ok(ids(at).includes('loi:an-treo-qua-3'));
  assert.ok(ids(at).includes('loi:thu-thach'));
  assert.ok(ids(checkDefendant({ ...base, hinhPhat: { loai: 'tu', thang: 30 }, tangNang: ['b'] }, { book, sources: facts('Bị cáo lừa đảo nhiều lần, lấy đó làm nguồn sống chính.') })).includes('loi:trung-52-b'), '“chuyên nghiệp” đã là điểm b khoản 2');
  assert.ok(ids(checkDefendant({ ...base, hinhPhat: { loai: 'tu', thang: 300 } }, { book })).includes('loi:dieu-38'));
  assert.ok(ids(checkDefendant({ ...base, khoan: 2, hinhPhat: { loai: 'chung-than' } }, { book })).includes('loi:chung-than'));
  // Chưa nạp sách: không kiểm tra khung, báo rõ.
  assert.ok(ids(checkDefendant(base, { book: null })).includes('canh:chua-co-sach'));
  // Án treo đề nghị: tù ≤ 3 năm, ≥ 2 giảm nhẹ, không tăng nặng.
  assert.ok(ids(checkDefendant({ ...base, toiDanh: [{ dieu: '174', khoan: 1, diem: [] }], giamNhe: ['b', 's'], hinhPhat: { loai: 'tu', thang: 24 } }, { book })).includes('goi:de-nghi-an-treo'));
});

const DON_BI_CAO = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
Hà Nội, ngày 20 tháng 10 năm 2026
ĐƠN KHÁNG CÁO
Kính gửi: Tòa án nhân dân thành phố Hà Nội
Tôi tên là: Nguyễn Văn An, sinh năm 1985
Nơi cư trú: thôn Đông, xã Tây, huyện Nam, tỉnh Bắc
Là bị cáo trong vụ án theo Bản án hình sự sơ thẩm số 25/2026/HS-ST ngày 15/10/2026 của Tòa án nhân dân huyện X.
1. Tòa án áp dụng khoản 3 Điều 174 là không đúng, số tiền chỉ 180.000.000 đồng nên phải xử theo khoản 2 Điều 174.
2. Tình tiết tăng nặng "có tính chất chuyên nghiệp" là không có căn cứ.
3. Gia đình tôi đã bồi thường toàn bộ thiệt hại cho bị hại. Tôi đã thành khẩn khai báo, ăn năn hối cải.
4. Bố tôi là người có công với cách mạng được tặng Huân chương kháng chiến.
Vì vậy tôi kính đề nghị Tòa án cấp phúc thẩm xem xét giảm nhẹ hình phạt và cho tôi được hưởng án treo.
Tôi bị điều tra viên ép cung trong quá trình điều tra.`;
const BI_CAO = { hoTen: 'Nguyễn Văn An', toiDanh: [{ dieu: '174', khoan: 3, diem: ['a'] }], soTien: 180000000, giamNhe: ['s'], tangNang: ['b'], hinhPhat: { loai: 'tu', thang: 96 } };
const item = (r, type) => r.items.find((x) => x.type === type);

test('đọc đơn nhận được: loại đơn, người gửi, ngày, bản án, từng yêu cầu (câu nguyên văn), tình tiết đơn nêu', () => {
  const p = parseComplaint(DON_BI_CAO, { book });
  assert.equal(p.loai, 'khang-cao');
  assert.deepEqual(p.nguoi, { hoTen: 'Nguyễn Văn An', namSinh: '1985', diaChi: 'thôn Đông, xã Tây, huyện Nam, tỉnh Bắc', tuCach: 'Bị cáo' });
  assert.equal(p.ngay, '20/10/2026');
  assert.deepEqual(p.banAn, { so: '25/2026/HS-ST', ngay: '15/10/2026' });
  assert.deepEqual(p.yeuCau.map((x) => x.type).sort(), ['an-treo', 'bo-tang-nang', 'doi-khoan', 'giam-an', 'them-giam-nhe', 'thu-tuc']);
  assert.equal(p.yeuCau.find((x) => x.type === 'thu-tuc').quotes[0], 'Tôi bị điều tra viên ép cung trong quá trình điều tra.');
  assert.deepEqual(p.giamNhe.map((g) => g.d), ['b', 's']);
  assert.match(p.k2, /Bố tôi là người có công/);
});

test('xem xét đơn của bị cáo: từng yêu cầu có căn cứ / không / cần xác minh, căn cứ lấy từ tài liệu vụ án (không lấy lời đơn)', () => {
  const r = assessComplaint({ text: DON_BI_CAO, defendants: [BI_CAO], sources: facts(FACTS), book });
  assert.equal(item(r, 'doi-khoan').kl, 'co');
  assert.match(item(r, 'doi-khoan').co[0].law[0].quote, /từ 50\.000\.000 đồng đến dưới 200\.000\.000 đồng/);
  assert.equal(item(r, 'bo-tang-nang').kl, 'co');
  // Điểm b (bồi thường): có trong tài liệu, chưa áp dụng → có căn cứ; điểm s đã áp dụng → không; khoản 2 (bố có công) chỉ có trong đơn → xác minh.
  const g = item(r, 'them-giam-nhe');
  assert.equal(g.kl, 'mot-phan');
  assert.match(g.co[0].text, /điểm b khoản 1 Điều 51/);
  assert.equal(g.co[0].facts[0].quote, 'Gia đình bị cáo đã bồi thường cho bị hại 50.000.000 đồng.');
  assert.match(g.khong[0].text, /điểm s khoản 1 Điều 51\) mà đơn nêu đã được bản án áp dụng/);
  assert.match(g.xacMinh[0].text, /khoản 2 Điều 51 nhưng tài liệu đã nạp chưa có chứng cứ/);
  // 8 năm tù > 3 năm: án treo chưa xét được, phụ thuộc việc giảm hình phạt.
  assert.equal(item(r, 'an-treo').kl, 'xac-minh');
  assert.equal(item(r, 'thu-tuc').kl, 'xac-minh');
  assert.equal(r.overall, 'mot-phan');
  assert.match(r.notes[0].text, /5 ngày sau ngày tuyên án — trong thời hạn kháng cáo 15 ngày/);
});

test('xem xét đơn của bị hại (tăng hình phạt) và đơn kêu oan; quá hạn kháng cáo; phiếu xem xét đơn (Word)', () => {
  const ok = { ...BI_CAO, toiDanh: [{ dieu: '174', khoan: 2, diem: ['c'] }], tangNang: [], giamNhe: ['b', 's'], hinhPhat: { loai: 'tu', thang: 36 } };
  const donBiHai = 'ĐƠN KHÁNG CÁO\nTôi là Trần Thị Bình, là người bị hại. Bản án số 25/2026/HS-ST ngày 15/10/2026.\nTôi đề nghị tăng hình phạt đối với bị cáo Nguyễn Văn An vì mức án quá nhẹ.\nHà Nội, ngày 10 tháng 11 năm 2026';
  const r = assessComplaint({ text: donBiHai, defendants: [ok], sources: facts(FACTS), book });
  assert.equal(r.parsed.nguoi.tuCach, 'Người bị hại');
  assert.equal(item(r, 'tang-an').kl, 'khong');
  assert.match(item(r, 'tang-an').khong[0].text, /nằm trong khung khoản 2/);
  assert.equal(r.overall, 'khong');
  assert.match(r.notes[0].text, /26 ngày — quá thời hạn kháng cáo 15 ngày/);
  // Kêu oan khi tài liệu thể hiện đủ yếu tố cấu thành → không có căn cứ.
  const r2 = assessComplaint({ text: 'Tôi Nguyễn Văn An kêu oan, tôi không phạm tội.', defendants: [ok], sources: facts(FACTS), book });
  assert.equal(item(r2, 'keu-oan').kl, 'khong');
  // Phiếu xem xét đơn.
  const doc = buildReviewDocument(assessComplaint({ text: DON_BI_CAO, defendants: [BI_CAO], sources: facts(FACTS), book }), { banAn: { toa: 'Tòa án nhân dân huyện X' }, org: { coQuan: 'TÒA ÁN NHÂN DÂN THÀNH PHỐ HÀ NỘI' } });
  assert.equal(doc.title.name, 'PHIẾU XEM XÉT ĐƠN');
  assert.equal(doc.header.org, 'TÒA ÁN NHÂN DÂN THÀNH PHỐ HÀ NỘI');
  const text = doc.body.map((p) => (p.runs || []).map((x) => x.text).join('')).join('\n');
  assert.match(text, /Người gửi: Nguyễn Văn An, sinh năm 1985/);
  assert.match(text, /Đơn có căn cứ một phần/);
  assert.match(text, /Nội dung đơn: “Tôi bị điều tra viên ép cung trong quá trình điều tra\.”/);
  assert.match(text, /Căn cứ thực tế: “Gia đình bị cáo đã bồi thường cho bị hại 50\.000\.000 đồng\.” \(Bản án\)/);
});

test('phân tích hành vi & hướng giải quyết: tội danh có căn cứ, khung theo giá trị, tình tiết, biện pháp tư pháp', () => {
  const a = analyzeCase({ sources: facts(FACTS), book });
  assert.equal(a.crimes[0].dieu, '174');
  assert.equal(a.crimes[0].khung, 2);
  assert.deepEqual(a.mitig.map((x) => x.d), ['b', 's']);
  assert.deepEqual(a.aggr, []);
  const t = a.huong.map((h) => `${h.t}: ${h.d}`).join('\n');
  assert.match(t, /Định tội danh: .*Điều 174 BLHS/);
  assert.match(t, /Khung hình phạt: Khoản 2 Điều 174 \(giá trị 180\.000\.000 đồng\) — phạt tù từ 2 năm đến 7 năm/);
  assert.match(t, /Điều 54/);
  assert.match(t, /Điều 48 BLHS/);
  assert.match(analyzeCase({ sources: facts('Hôm nay trời đẹp, mọi người đi làm bình thường.'), book }).huong[0].t, /Chưa xác định được tội danh/);
});
