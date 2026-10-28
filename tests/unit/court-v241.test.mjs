import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBinhLuan } from '../../assets/js/legal/binh-luan.js';
import { sentencesOf, parseVerdict } from '../../assets/js/legal/court.js';
import { detectType, srcRange, reviewEvidence, elementMatrix, evidenceRows } from '../../assets/js/legal/court-evidence.js';
import { lawNotes, ageChecks, ageAt, DEFAULT_LAWS } from '../../assets/js/legal/court-law-time.js';
import { parseKhoDoc, findSimilar, relatedPrecedents } from '../../assets/js/legal/court-similar.js';
import { thamTra, buildThamTraReport, buildReplyLetter, thamTraWorkbook } from '../../assets/js/legal/court-review.js';
import { courtBaDb } from '../../assets/js/legal/court-ba-db.js';
import { buildXlsx } from '../../assets/js/lib/xlsx.js';
import { readZip, buildDocx } from '../../assets/js/lib/docx.js';
import { renderDocumentHtml } from '../../assets/js/lib/render-html.js';
import { setScope } from '../../assets/js/lib/store.js';

// Sách mẫu: nguyên văn một số điều BLHS (văn bản pháp luật công khai, rút gọn) theo cấu trúc sách Bình luận.
const BOOK = parseBinhLuan(
  [
    'PHẦN THỨ NHẤT',
    'NHỮNG QUY ĐỊNH CHUNG',
    'CHƯƠNG I',
    'ĐIỀU KHOẢN CƠ BẢN',
    'Điều 7. Hiệu lực của Bộ luật hình sự về thời gian',
    '1. Điều luật được áp dụng đối với một hành vi phạm tội là điều luật đang có hiệu lực thi hành tại thời điểm mà hành vi phạm tội được thực hiện.',
    '2. Điều luật quy định một tội phạm mới, một hình phạt nặng hơn, một tình tiết tăng nặng mới thì không được áp dụng đối với hành vi phạm tội đã thực hiện trước khi điều luật đó có hiệu lực thi hành.',
    '3. Điều luật xóa bỏ một tội phạm, một hình phạt, quy định một hình phạt nhẹ hơn và quy định khác có lợi cho người phạm tội, thì được áp dụng đối với hành vi phạm tội đã thực hiện trước khi điều luật đó có hiệu lực thi hành.',
    'Bình luận',
    'Bình luận mẫu.',
    'Điều 12. Tuổi chịu trách nhiệm hình sự',
    '1. Người từ đủ 16 tuổi trở lên phải chịu trách nhiệm hình sự về mọi tội phạm, trừ những tội phạm mà Bộ luật này có quy định khác.',
    '2. Người từ đủ 14 tuổi đến dưới 16 tuổi phải chịu trách nhiệm hình sự về tội phạm rất nghiêm trọng, tội phạm đặc biệt nghiêm trọng quy định tại một trong các điều 123, 134, 141, 142, 143, 144, 150, 151, 168, 169, 170, 171, 173, 178, 248, 249, 250, 251, 252, 265, 266, 286, 287, 289, 290, 299, 303 và 304 của Bộ luật này.',
    'Bình luận',
    'Bình luận mẫu.',
    'CHƯƠNG VIII',
    'QUYẾT ĐỊNH HÌNH PHẠT',
    'Điều 51. Các tình tiết giảm nhẹ trách nhiệm hình sự',
    '1. Các tình tiết sau đây là tình tiết giảm nhẹ trách nhiệm hình sự:',
    'b) Người phạm tội tự nguyện sửa chữa, bồi thường thiệt hại hoặc khắc phục hậu quả;',
    's) Người phạm tội thành khẩn khai báo, ăn năn hối cải;',
    'Bình luận',
    'Bình luận mẫu.',
    'Điều 52. Các tình tiết tăng nặng trách nhiệm hình sự',
    '1. Chỉ các tình tiết sau đây mới là tình tiết tăng nặng trách nhiệm hình sự:',
    'b) Phạm tội có tính chất chuyên nghiệp;',
    'Bình luận',
    'Bình luận mẫu.',
    'PHẦN THỨ HAI',
    'CÁC TỘI PHẠM',
    'CHƯƠNG XVI',
    'CÁC TỘI XÂM PHẠM SỞ HỮU',
    'Điều 174. Tội lừa đảo chiếm đoạt tài sản',
    '1. Người nào bằng thủ đoạn gian dối chiếm đoạt tài sản của người khác trị giá từ 2.000.000 đồng đến dưới 50.000.000 đồng, thì bị phạt cải tạo không giam giữ đến 03 năm hoặc phạt tù từ 06 tháng đến 03 năm:',
    '2. Phạm tội thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 02 năm đến 07 năm:',
    'c) Chiếm đoạt tài sản trị giá từ 50.000.000 đồng đến dưới 200.000.000 đồng;',
    '3. Phạm tội thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 07 năm đến 15 năm:',
    'a) Chiếm đoạt tài sản trị giá từ 200.000.000 đồng đến dưới 500.000.000 đồng;',
    'Bình luận',
    'Bình luận mẫu.',
  ].join('\n'),
  [],
);
const BAN_AN = `TÒA ÁN NHÂN DÂN KHU VỰC 3 - NINH BÌNH
Bản án số: 25/2026/HS-ST
NHÂN DANH NƯỚC CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
NỘI DUNG VỤ ÁN: Bị cáo Nguyễn Văn An, sinh năm 1985, đã dùng thủ đoạn gian dối, đưa thông tin sai sự thật về dự án đất nền để chị Trần Thị Bình tin tưởng giao tiền, chiếm đoạt số tiền 180.000.000 đồng.
NHẬN ĐỊNH CỦA TÒA ÁN: Tại phiên tòa bị cáo thành khẩn khai báo, ăn năn hối cải. Gia đình bị cáo đã bồi thường cho bị hại 50.000.000 đồng. Hành vi của bị cáo phạm tội theo khoản 2 Điều 174. Bị cáo được hưởng tình tiết giảm nhẹ điểm b, s khoản 1 Điều 51.
QUYẾT ĐỊNH: Tuyên bố bị cáo Nguyễn Văn An phạm tội "Lừa đảo chiếm đoạt tài sản".
Áp dụng điểm a khoản 3 Điều 174; điểm s khoản 1 Điều 51; điểm b khoản 1 Điều 52 của Bộ luật Hình sự.
Xử phạt bị cáo Nguyễn Văn An 08 (tám) năm tù, thời hạn tù tính từ ngày bắt tạm giam.`;
const LK_BI_HAI = 'BIÊN BẢN LẤY LỜI KHAI BỊ HẠI\nChị Trần Thị Bình khai: An đã chiếm đoạt của tôi số tiền 200.000.000 đồng, An nói dối là có dự án đất nền nên tôi tin tưởng giao tiền cho An tại nhà tôi vào tháng 5 năm 2025.';
const LK_BI_CAO = 'BIÊN BẢN HỎI CUNG BỊ CAN\nNguyễn Văn An, sinh năm 1986, khai: tôi không thừa nhận hành vi lừa đảo, tôi vay tiền của chị Bình để làm ăn và sẽ trả.';
const caseOf = (extra = {}) => {
  const v = parseVerdict(BAN_AN);
  return {
    cap: 'phuc-tham', ten: 'Vụ Nguyễn Văn An', banAn: { so: '25/2026/HS-ST', ngay: '15/10/2026' }, moc: { ngayHanhVi: '2025-05-10', ngayXetXu: '2026-10-15' },
    sources: [{ name: 'Bản án sơ thẩm', text: BAN_AN, loai: 'ban-an', butLuc: 120 }, { name: 'Lời khai bị hại', text: LK_BI_HAI, loai: 'loi-khai-bi-hai', butLuc: 45 }, { name: 'Hỏi cung bị can', text: LK_BI_CAO, loai: 'loi-khai-bi-cao', butLuc: 30 }],
    defendants: v.defendants.map((d) => ({ ...d, id: 'a', soTien: 180000000, namSinh: '1985' })),
    dons: [],
    ...extra,
  };
};

test('loại tài liệu, bút lục theo trang, nguồn trích dẫn kèm bút lục', () => {
  assert.equal(detectType('Nội dung dán 1', BAN_AN), 'ban-an');
  assert.equal(detectType('ct.docx', 'VIỆN KIỂM SÁT\nCÁO TRẠNG'), 'cao-trang');
  assert.equal(detectType('x', LK_BI_CAO), 'loi-khai-bi-cao');
  assert.equal(detectType('x', LK_BI_HAI), 'loi-khai-bi-hai');
  assert.equal(detectType('Lời khai: A (lần 1)', 'BIÊN BẢN BỊ CAN: A'), 'loi-khai-bi-cao');
  const s = { name: 'KLĐT', butLuc: 10, pages: ['Trang một có câu thứ nhất dài đủ.', 'Trang hai: bị can khai đã nhận 50.000.000 đồng.'], text: '' };
  assert.equal(srcRange(s), 'BL 10–11');
  const sents = sentencesOf([s]);
  assert.equal(sents[1].src, 'KLĐT, BL 11');
  assert.equal(sentencesOf([{ name: 'Bản án', text: 'Câu đủ dài để tính là một câu.', butLuc: 7 }])[0].src, 'Bản án, BL 7');
  assert.equal(sentencesOf([{ name: 'Bản án', text: 'Câu đủ dài để tính là một câu.' }])[0].src, 'Bản án');
});

test('rà soát chứng cứ: thiếu tài liệu, yếu tố chỉ dựa vào lời nhận tội, mâu thuẫn số tiền / năm sinh, nhận định – quyết định, lời khai không nhận tội', () => {
  const rec = caseOf();
  const ev = reviewEvidence(rec, { book: BOOK });
  const ids = ev.map((f) => `${f.muc}:${f.id}`);
  assert.ok(ids.includes('thieu:thieu-cao-trang'));
  assert.ok(!ids.some((x) => x.includes('thieu-loi-khai-bi-hai')));
  const tien = ev.find((f) => f.id === 'mau-thuan-tien');
  assert.match(tien.title, /200\.000\.000 đồng; 180\.000\.000 đồng/);
  assert.ok(tien.facts.some((f) => f.src === 'Lời khai bị hại, BL 45'));
  const ns = ev.find((f) => f.id === 'nhan-than-Nguyễn Văn An');
  assert.equal(ns.muc, 'mau-thuan');
  assert.ok(ns.facts.some((f) => f.src === 'Hỏi cung bị can, BL 30'));
  assert.ok(ev.some((f) => f.id === 'nd-qd-174' && /nhận định nêu khoản 2 nhưng phần quyết định áp dụng khoản 3/.test(f.title)));
  assert.ok(ev.some((f) => f.id === 'nd-qd-51' && /điểm b/.test(f.title)));
  assert.ok(ev.some((f) => f.id.startsWith('go-toi-')));
  // Chỉ có lời khai bị cáo chứng minh một yếu tố → cảnh báo khoản 2 Điều 98 BLTTHS.
  const only = reviewEvidence({ defendants: [{ hoTen: 'A', toiDanh: [{ dieu: '174', khoan: 1 }] }], sources: [{ name: 'Tự khai', loai: 'loi-khai-bi-cao', text: 'Tôi đã dùng thủ đoạn gian dối, nói dối là có dự án để chị B tin tưởng giao tiền cho tôi 30.000.000 đồng.' }] }, { book: BOOK });
  assert.ok(only.some((f) => f.id.startsWith('chi-nhan-toi-174-') && /khoản 2 Điều 98 BLTTHS/.test(f.detail)));
  assert.equal(reviewEvidence({ sources: [] })[0].id, 'khong-tai-lieu');
  const m = elementMatrix('174', rec.sources);
  assert.equal(m.find((e) => e.id === 'thu-doan').support[0].src, 'Bản án sơ thẩm, BL 120');
});

test('bảng chứng cứ theo bút lục: yếu tố, dấu hiệu định khung theo giá trị, tình tiết đã / chưa áp dụng', () => {
  const rows = evidenceRows(caseOf(), { book: BOOK });
  const dk = rows.find((r) => r.van.startsWith('Dấu hiệu định khung: điểm a khoản 3 Điều 174'));
  assert.equal(dk.src, 'Lời khai bị hại, BL 45'); // chỉ lời khai bị hại nêu 200 triệu (thuộc khoản 3)
  assert.equal(rows.find((r) => /giảm nhẹ điểm b/.test(r.van)).ghiChu, 'Chưa được áp dụng');
  assert.equal(rows.find((r) => /tăng nặng điểm b/.test(r.van)).ghiChu, 'Đã áp dụng nhưng CHƯA THẤY CĂN CỨ');
  const only180 = caseOf({ sources: [{ name: 'Bản án sơ thẩm', text: BAN_AN, loai: 'ban-an', butLuc: 120 }] });
  assert.match(evidenceRows(only180, { book: BOOK }).find((r) => r.van.startsWith('Dấu hiệu định khung')).ghiChu, /180\.000\.000 đồng\) KHÔNG thuộc khoảng/);
});

test('pháp luật theo thời điểm và tuổi chịu trách nhiệm hình sự', () => {
  const n = lawNotes({ ngayHanhVi: '2025-05-10', ngayXetXu: '2026-10-15', book: BOOK });
  assert.match(n[0].text, /áp dụng Bộ luật Hình sự năm 2015/);
  const sd = n.find((x) => /Luật số 86\/2025\/QH15/.test(x.text) && /sau ngày thực hiện hành vi/.test(x.text));
  assert.equal(sd.level, 'canh');
  assert.equal(sd.law[1].ref, 'khoản 3 Điều 7 BLHS');
  assert.ok(n.some((x) => /sách Bình luận đã nạp có thể chưa gồm sửa đổi/.test(x.text)));
  assert.ok(lawNotes({ ngayHanhVi: '2016-03-01', book: BOOK }).some((x) => /Nghị quyết số 41\/2017\/QH14/.test(x.text)));
  assert.equal(lawNotes({})[0].level, 'thieu');
  assert.deepEqual(ageAt('12/03/2010', '', new Date(2025, 2, 11)), { min: 14, max: 14, exact: true });
  assert.deepEqual(ageAt('', '2010', new Date(2025, 5, 1)), { min: 14, max: 15, exact: false });
  const rec = { moc: { ngayHanhVi: '2025-05-10' }, defendants: [{ hoTen: 'Lê C', ngaySinh: '01/01/2010', toiDanh: [{ dieu: '174', khoan: 2 }] }, { hoTen: 'Lê D', namSinh: '1990', toiDanh: [{ dieu: '174', khoan: 2 }] }] };
  const a = ageChecks(rec, { book: BOOK });
  assert.equal(a[0].level, 'loi'); // 15 tuổi, khoản 2 Điều 174 là tội nghiêm trọng
  assert.match(a[0].text, /15 tuổi.*tội nghiêm trọng/);
  assert.equal(a[1].level, 'dung');
  assert.equal(DEFAULT_LAWS.find((l) => l.id === 'luat-86-2025').kiemTra, true);
});

test('kho bản án, án lệ: đọc văn bản, bản án tương tự, thống kê mức án, án lệ liên quan', () => {
  const b1 = parseKhoDoc(BAN_AN.replace('25/2026', '11/2025').replace('08 (tám) năm', '03 (ba) năm').replace('khoản 3 Điều 174;', 'khoản 2 Điều 174;'), 'BA 11');
  const b2 = parseKhoDoc(BAN_AN.replace('25/2026', '12/2025').replace('08 (tám) năm', '04 (bốn) năm').replace('khoản 3 Điều 174;', 'khoản 2 Điều 174;').replace('180.000.000', '90.000.000'), 'BA 12');
  assert.equal(b1.loai, 'ban-an');
  assert.equal(b1.so, '11/2025/HS-ST');
  assert.deepEqual([b1.bc[0].dieu, b1.bc[0].khoan, b1.bc[0].hinhPhat.thang], ['174', 2, 36]);
  const al = parseKhoDoc('TÒA ÁN NHÂN DÂN TỐI CAO\nÁN LỆ SỐ 99/2026/AL\nVề xác định giá trị tài sản bị chiếm đoạt\nÁn lệ số 99/2026/AL\nKhái quát nội dung của án lệ:\nBị cáo nhiều lần chiếm đoạt tài sản thì giá trị tài sản bị chiếm đoạt là tổng giá trị các lần.\n\nQuy định của pháp luật liên quan đến án lệ:\nĐiều 174 Bộ luật Hình sự năm 2015.\n', 'AL 99');
  assert.equal(al.loai, 'an-le');
  assert.equal(al.so, '99/2026/AL');
  assert.deepEqual(al.dieu, ['174']);
  assert.match(al.khaiQuat, /tổng giá trị các lần/);
  const d = { toiDanh: [{ dieu: '174', khoan: 2 }], soTien: 180000000, giamNhe: ['s'] };
  const s = findSimilar(d, [b1, b2, al]);
  assert.equal(s.items[0].doc.so, '11/2025/HS-ST'); // cùng khoản, giá trị gần
  assert.deepEqual(s.stats, { n: 2, pham: 'khoan', min: 36, max: 48, median: 36, anTreo: 0 });
  assert.equal(findSimilar({ toiDanh: [{ dieu: '174', khoan: 3 }] }, [b1, b2]).stats.pham, 'dieu');
  assert.deepEqual(relatedPrecedents(['174'], [b1, al]).map((x) => x.so), ['99/2026/AL']);
  assert.deepEqual(findSimilar({ toiDanh: [{ dieu: '' }] }, [b1]), { items: [], stats: null });
});

test('thẩm tra 5 câu hỏi và đề xuất theo loại thẩm tra (phúc thẩm, giám đốc thẩm, tái thẩm, sơ thẩm)', () => {
  const R = thamTra(caseOf(), { book: BOOK });
  assert.deepEqual(R.qs.map((q) => q.id), ['q1', 'q2', 'q3', 'q4', 'q5']);
  assert.equal(R.qs[0].muc, 'do'); // sai khoản theo giá trị
  assert.ok(R.qs[0].items.some((x) => /thuộc khoản 2, không phải khoản 3/.test(x.text)));
  assert.equal(R.qs[1].muc, 'xam'); // thiếu cáo trạng
  assert.ok(R.qs[2].items.some((x) => /điểm b khoản 1 Điều 51/.test(x.text)));
  assert.equal(R.qs[3].muc, 'xam'); // chưa có đơn
  assert.equal(R.deXuat.ma, 'sua-an');
  assert.ok(R.deXuat.boSung.includes('Cáo trạng'));
  // Giám đốc thẩm: sai lầm áp dụng pháp luật → đề xuất kháng nghị, tính thời hạn 01 năm.
  const g = thamTra(caseOf({ thamTra: { loai: 'giam-doc-tham' }, moc: { ngayHanhVi: '2025-05-10', ngayHieuLuc: '2026-11-15' } }), { book: BOOK });
  assert.equal(g.deXuat.ma, 'khang-nghi-gdt');
  assert.ok(g.deXuat.canCu[0].startsWith('Điều 371 BLTTHS'));
  assert.ok(g.deXuat.lyDo.some((x) => /đến 14\/11\/2027/.test(x.text)));
  // Tái thẩm: có tình tiết mới do người dùng nhập.
  const t = thamTra(caseOf({ thamTra: { loai: 'tai-tham', tinhTietMoi: 'Bị hại xác nhận đã nhận lại đủ tiền trước khi khởi tố (giấy xác nhận ngày 01/3/2025)' } }), { book: BOOK });
  assert.equal(t.deXuat.ma, 'xem-xet-tt');
  assert.equal(thamTra(caseOf({ thamTra: { loai: 'tai-tham' } }), { book: BOOK }).deXuat.ma, 'khong-tt');
  // Sơ thẩm: yếu tố bắt buộc chưa có chứng cứ → trả hồ sơ điều tra bổ sung.
  const st = thamTra({ cap: 'so-tham', defendants: [{ hoTen: 'A', toiDanh: [{ dieu: '174', khoan: 1 }] }], sources: [{ name: 'Cáo trạng', loai: 'cao-trang', text: 'Bị can A đã nhận của chị B số tiền 30.000.000 đồng để làm thủ tục nhưng không làm.' }] }, { book: BOOK });
  assert.equal(st.deXuat.ma, 'tra-ho-so');
  assert.match(st.deXuat.ten, /Điều 280 BLTTHS/);
});

test('báo cáo thẩm tra 8 mục, dự thảo trả lời kiến nghị, sổ Excel đối chiếu', async () => {
  const don = { name: 'Đơn kháng cáo', text: 'ĐƠN KHÁNG CÁO\nTôi tên là: Nguyễn Văn An, sinh năm 1985\nLà bị cáo trong vụ án theo Bản án số 25/2026/HS-ST ngày 15/10/2026.\nTòa án áp dụng khoản 3 Điều 174 là không đúng, số tiền chỉ 180.000.000 đồng nên phải xử theo khoản 2 Điều 174.\nHà Nội, ngày 20 tháng 10 năm 2026' };
  const rec = caseOf({ dons: [don] });
  const doc = buildThamTraReport(rec, { book: BOOK, org: { toaAn: 'Tòa án nhân dân tỉnh Ninh Bình', diaDanh: 'Ninh Bình' }, nguoi: 'Phạm Thẩm Tra' });
  const text = doc.body.map((p) => (p.runs || []).map((r) => r.text).join('')).join('\n');
  for (const h of ['1. TÓM TẮT VỤ ÁN', '2. NỘI DUNG ĐƠN', '3. KẾT QUẢ KIỂM TRA CHỨNG CỨ', '4. ĐÁNH GIÁ TỘI DANH', '5. ĐÁNH GIÁ KHUNG HÌNH PHẠT', '6. PHÂN TÍCH CĂN CỨ PHÁP LUẬT', '7. ĐÁNH GIÁ TỪNG NỘI DUNG KIẾN NGHỊ', '8. ĐỀ XUẤT PHƯƠNG ÁN', 'PHỤ LỤC: BẢNG ĐỐI CHIẾU CHỨNG CỨ THEO BÚT LỤC']) assert.ok(text.includes(h), h);
  assert.match(text, /Tài liệu đã nghiên cứu: Bản án sơ thẩm \(Bản án, BL 120\)/);
  assert.match(text, /Đề xuất: Có căn cứ xem xét sửa bản án sơ thẩm/);
  assert.match(text, /không thay thế kết luận của người có thẩm quyền/);
  assert.equal(doc.sign.position, 'THẨM TRA VIÊN');
  assert.equal(doc.sign.name, 'Phạm Thẩm Tra');
  assert.ok(doc.body.some((p) => p.table?.rows.length));
  assert.ok(buildDocx(doc, 'x').length > 5000);
  assert.ok(renderDocumentHtml(doc).includes('BÁO CÁO THẨM TRA'));
  const reply = buildReplyLetter(rec, don, { book: BOOK, org: { toaAn: 'Tòa án nhân dân tỉnh Ninh Bình' } });
  const rt = reply.body.map((p) => (p.runs || []).map((r) => r.text).join('')).join('\n');
  assert.match(rt, /Kính gửi: Ông\/Bà Nguyễn Văn An/);
  assert.match(rt, /Về nội dung áp dụng khoản \(khung hình phạt\) khác: có căn cứ/);
  assert.equal(reply.header.subject, 'V/v trả lời đơn kháng cáo');
  assert.ok(buildDocx(reply, 'x').length > 3000);
  const zip = await readZip(thamTraWorkbook(rec, { book: BOOK }));
  const wb = new TextDecoder().decode(await zip.read('xl/workbook.xml'));
  assert.deepEqual([...wb.matchAll(/name="([^"]+)"/g)].map((m) => m[1]), ['Chứng cứ theo bút lục', 'Rà soát chứng cứ', '5 câu hỏi', 'Bản án tương tự']);
  const s1 = new TextDecoder().decode(await zip.read('xl/worksheets/sheet1.xml'));
  assert.match(s1, /Lời khai bị hại, BL 45/);
  const x = await readZip(buildXlsx([{ name: 'A/B?', header: ['x'], rows: [[1, '<&>']] }]));
  assert.match(new TextDecoder().decode(await x.read('xl/worksheets/sheet1.xml')), /<v>1<\/v>.*&lt;&amp;&gt;/s);
});

test('kho bản án lưu riêng từng tài khoản', async () => {
  setScope('tt1');
  const d = await courtBaDb.put({ loai: 'ban-an', so: '1/2026/HS-ST', text: 'x' });
  assert.equal((await courtBaDb.list()).length, 1);
  setScope('tt2');
  assert.equal((await courtBaDb.list()).length, 0);
  setScope('tt1');
  await courtBaDb.remove(d.id);
  assert.equal((await courtBaDb.list()).length, 0);
  setScope(null);
});
