// v2.50: mô hình cụm từ có nghĩa — không luận tội bằng từ đơn. Bộ câu bẫy (phải KHÔNG nhận) và câu thật (phải nhận).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessCrime } from '../../assets/js/legal/relevance.js';
import { analyzeOffline } from '../../assets/js/legal/analyze.js';
import { findPhrase, pctInjury, isActionSentence, EXCLUDE, ASSAULT, groupRe } from '../../assets/js/legal/lexicon.js';
import { chunksOf, namePhrases, conductText, extractLawPhrases, PROCEDURAL } from '../../assets/js/legal/law-phrases.js';
import { LAW_PHRASES } from '../../assets/js/legal/law-phrases-generated.js';
import { phraseEvidence, lawPhrasesOf } from '../../assets/js/legal/relevance.js';

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

test('bộ quét Bộ luật: rút cụm định tội từ khoản 1 và tên điều (bỏ chủ ngữ, định lượng, hình phạt; tách theo liên từ)', () => {
  const vb = ['1. Người nào dùng vũ lực, đe dọa dùng vũ lực ngay tức khắc hoặc có hành vi khác làm cho người bị tấn công lâm vào tình trạng không thể chống cự được nhằm chiếm đoạt tài sản, thì bị phạt tù từ 03 năm đến 10 năm.', '2. Phạm tội thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 07 năm đến 15 năm:', 'a) Có tổ chức;'];
  assert.deepEqual(conductText(vb).length, 1);
  const ch = chunksOf(conductText(vb)[0]);
  assert.ok(ch.includes('dùng vũ lực') && ch.includes('đe dọa dùng vũ lực ngay tức khắc') && ch.includes('chiếm đoạt tài sản'), ch.join(' | '));
  assert.ok(!ch.some((c) => /thì bị|năm|người nào/.test(c)), 'không còn hình phạt, chủ ngữ');
  // "và" không bị tách trong "vào"; đuôi "trở lên", "có khối lượng" bị bỏ; số lượng bị bỏ.
  assert.ok(chunksOf('lâm vào tình trạng không thể chống cự được').some((c) => c.endsWith('tình trạng không thể chống cự')), 'không tách “và” trong “vào”');
  assert.deepEqual(chunksOf('giết 02 người trở lên'), []);
  assert.deepEqual(chunksOf('nhựa thuốc phiện có khối lượng từ 01 gam đến dưới 500 gam'), ['nhựa thuốc phiện']);
  assert.deepEqual(namePhrases('Tội sản xuất, buôn bán hàng cấm'), ['sản xuất hàng cấm', 'buôn bán hàng cấm']);
  assert.deepEqual(namePhrases('Tội bắt, giữ hoặc giam người trái pháp luật'), ['bắt người trái pháp luật', 'giữ người trái pháp luật', 'giam người trái pháp luật']);
  assert.deepEqual(namePhrases('Tội làm nhục người khác'), ['làm nhục']);
  assert.deepEqual(namePhrases('Tội giết người'), ['giết người']);
  // Tên gồm động từ + đối tượng chung: không đứng một mình ("tài liệu của cơ quan" không phải cụm định tội).
  const n341 = namePhrases('Tội làm giả con dấu, tài liệu của cơ quan, tổ chức; tội sử dụng con dấu hoặc tài liệu giả của cơ quan, tổ chức');
  assert.ok(n341.includes('làm giả con dấu') && !n341.includes('tài liệu của cơ quan'), n341.join(' | '));
  const P = extractLawPhrases([{ so: '168', ten: 'Tội cướp tài sản', vb }, { so: '170', ten: 'Tội cưỡng đoạt tài sản', vb: ['1. Người nào đe dọa sẽ dùng vũ lực hoặc có thủ đoạn khác uy hiếp tinh thần người khác nhằm chiếm đoạt tài sản, thì bị phạt tù từ 01 năm đến 05 năm.'] }]);
  assert.equal(P['168'][0][0], 'cướp tài sản');
  assert.ok(P['168'].some((x) => x[0] === 'đe dọa dùng vũ lực ngay tức khắc' && x[1] === 3 && x[2] === 1));
  assert.ok(P['168'].some((x) => x[0] === 'chiếm đoạt tài sản' && x[1] <= 2 && x[2] === 0), 'cụm hai điều cùng dùng không tự đủ');
});

test('gói cụm sinh sẵn: đủ các điều, không cụm một âm tiết, không chứa số, không trùng cụm vô hại; tên điều khác không làm căn cứ', () => {
  const ds = Object.keys(LAW_PHRASES);
  assert.ok(ds.length >= 300, `chỉ ${ds.length} điều`);
  for (const [d, list] of Object.entries(LAW_PHRASES)) {
    assert.ok(list.length >= 1, d);
    for (const [ph, w, solo] of list) {
      assert.ok(ph.split(' ').length >= 2, `${d}: cụm một âm tiết “${ph}”`);
      assert.ok(!/^\d|\d\s*%|\d\s*đồng$|khối lượng$/.test(ph), `${d}: cụm mang định lượng “${ph}”`); // số tuổi trong tên điều ("người dưới 16 tuổi") được giữ
      assert.ok([1, 2, 3].includes(w) && [0, 1].includes(solo), `${d}: trọng số ${ph}`);
      assert.ok(!/^(?:đánh giá|đánh dấu|đánh máy|chém gió|chết máy)$/.test(ph), `${d}: cụm vô hại “${ph}”`);
    }
  }
  assert.ok(LAW_PHRASES['168'].some((x) => x[0] === 'cướp tài sản'));
  assert.ok(LAW_PHRASES['330'].some((x) => x[0] === 'chống người thi hành công vụ'));
  assert.ok(!LAW_PHRASES['118'].some((x) => x[0] === 'chống người thi hành công vụ'), 'cụm là tên Điều 330 không làm căn cứ cho Điều 118');
  // Điều không có trong gói → dùng tên điều.
  assert.ok(lawPhrasesOf('256a').length >= 1);
  // Cụm định tội trùng một cụm trong danh sách vô hại của nghĩa khác ("đánh bạc" vs "đánh" người) vẫn khớp được.
  assert.equal(phraseEvidence('321', [{ t: 'Nhóm này tổ chức đánh bạc bằng hình thức xóc đĩa.' }])?.hits.some((h) => h.khop === 'đánh bạc'), true);
  assert.equal(findPhrase('lãnh đạo đánh giá nhân viên', groupRe(ASSAULT)), null);
});

test('nhận diện theo cụm định tội cho điều chưa có bộ yếu tố cấu thành: đúng điều, không lan sang điều có cụm chung', () => {
  const pos = [
    ['168', 'A dùng dao khống chế, đe dọa dùng vũ lực ngay tức khắc buộc chị B đưa túi xách rồi chiếm đoạt tài sản.'],
    ['318', 'Nhóm thanh niên gây rối trật tự công cộng trước cổng chợ, đập phá hàng quán.'],
    ['330', 'Khi tổ công tác yêu cầu dừng xe, H đã chống người thi hành công vụ, giật áo và xô ngã Thượng úy T.'],
    ['155', 'B lột quần áo, quay phim và làm nhục chị C trước đám đông.'],
    ['170', 'T nhắn tin đe dọa sẽ dùng vũ lực, uy hiếp tinh thần anh K để buộc anh K đưa 20 triệu đồng.'],
  ];
  for (const [d, t] of pos) {
    const a = assessCrime(d, t);
    assert.equal(a.show, true, `Điều ${d}: ${t} → ${a.why}`);
    assert.equal(a.nguon, 'tu-khoa');
    assert.match(a.why, /Khớp cụm định tội/);
    assert.ok(a.yeuTo[0]?.khop, 'nêu cụm đã khớp');
  }
  const r330 = analyzeOffline(pos[2][1], {}).crimes.map((c) => c.dieu);
  assert.ok(r330.includes('330') && !r330.includes('118'), r330.join());
  for (const t of ['Hội đồng đánh giá hồ sơ dự thầu; các tài liệu của cơ quan được lưu trữ đúng quy định; tổ chức họp đánh giá.', 'Ông Hải lập hồ sơ giả mạo chữ ký của chủ đất cũ để sang tên.', 'Công ty mua bán hàng hóa thông thường, nộp thuế đầy đủ, an toàn xã hội được bảo đảm.', 'Bị cáo mua bán trái phép chất ma túy: bán 2 gói heroin cho T lấy 500.000 đồng.']) {
    const got = analyzeOffline(t, {}).crimes.map((c) => c.dieu);
    assert.ok(got.every((d) => d === '251'), `${t} → ${got.join()}`);
  }
  assert.equal(phraseEvidence('214', [{ t: 'Ông Hải lập hồ sơ giả mạo chữ ký.' }])?.strong, false, 'một cụm 4 âm tiết chưa tự đủ');
});

test('không kết tội từ ngôn ngữ thủ tục lời khai (“khai báo”, “tự nguyện”) hay cụm 2 âm tiết thông dụng; tội của quân nhân cần bối cảnh quân đội', () => {
  // Gói cụm: không chứa từ thủ tục; vế 2 âm tiết tự đủ chỉ là thuật ngữ tội danh riêng.
  for (const [d, list] of Object.entries(LAW_PHRASES)) {
    for (const [ph, , solo] of list) {
      assert.ok(!PROCEDURAL.test(ph), `Điều ${d}: cụm thủ tục “${ph}” không được là cụm định tội`);
      if (solo && ph.split(' ').length < 3) assert.ok(!/^(khai báo|cấp bậc|doanh nghiệp|hỗ trợ|phiên họp|làm mất|điều động|ứng phó|thăm dò|chữa cháy|tiền chất|một chồng|biết|làm việc)$/.test(ph), `Điều ${d}: “${ph}” không được tự đủ`);
    }
  }
  assert.ok(!LAW_PHRASES['400'].some((x) => x[0] === 'khai báo'));
  // Lời khai thủ tục: không ra điều nào; đặc biệt không ra Điều 400 (khai báo … cho địch).
  const khai = 'Tôi tự nguyện khai báo, lời khai khách quan, đúng sự thật. Tôi đã đọc lại biên bản và ký tên.';
  assert.equal(assessCrime('400', khai).show, false);
  assert.ok(!analyzeOffline(khai, {}).crimes.some((c) => c.dieu === '400'));
  // Vụ sửa dữ liệu quan trắc: không được gợi ý Điều 400 chỉ vì chữ “khai báo”.
  const quanTrac = 'Trong lúc chờ duyệt, tôi chỉ đạo anh Lân liên hệ Công ty Việt An hỏi cách chỉnh sửa dữ liệu luôn dưới ngưỡng cho phép. Tôi biết chỉnh sửa dữ liệu quan trắc là trái pháp luật nhưng không ngăn chặn. Tôi tự nguyện khai báo, lời khai khách quan, đúng sự thật.';
  const r = analyzeOffline(quanTrac, {}).crimes.map((c) => c.dieu);
  assert.ok(!r.includes('400'), r.join());
  // Tội của quân nhân: cùng câu “đào ngũ”, có bối cảnh quân đội thì xét, nội dung dân sự không.
  assert.equal(assessCrime('402', 'Binh nhất T rời đơn vị, đào ngũ 2 tháng dù đã bị kỷ luật.').show, true);
  assert.equal(assessCrime('409', 'Ông H bỏ ca trực đêm ở công ty, không bàn giao.').show, false);
});
