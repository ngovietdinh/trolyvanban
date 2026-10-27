import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBinhLuan } from '../../assets/js/legal/binh-luan.js';
import { parseIndictment } from '../../assets/js/legal/court.js';
import { legalRange, tongHop, chapHanh, penaltyRules, addMonths, fmtDate } from '../../assets/js/legal/court-penalty.js';
import { computeDeadlines, dueDate, mergeRules, upcoming, suggestLoaiToi, DEFAULT_RULES } from '../../assets/js/legal/court-deadlines.js';
import { COURT_FORMS, courtValues, quyetDinhText, buildCourtForm, matchField, tenCoQuan, thoiHanChu, formFields } from '../../assets/js/legal/court-forms.js';
import { courtTplDb } from '../../assets/js/legal/court-tpl-db.js';
import { buildDocx } from '../../assets/js/lib/docx.js';
import { renderDocumentHtml } from '../../assets/js/lib/render-html.js';
import { setScope } from '../../assets/js/lib/store.js';

// Sách mẫu: nguyên văn điều luật (văn bản pháp luật công khai) theo cấu trúc sách Bình luận.
const BOOK = parseBinhLuan(
  [
    'PHẦN THỨ NHẤT',
    'NHỮNG QUY ĐỊNH CHUNG',
    'CHƯƠNG VI',
    'HÌNH PHẠT',
    'Điều 36. Cải tạo không giam giữ',
    '1. Cải tạo không giam giữ được áp dụng từ 06 tháng đến 03 năm đối với người phạm tội ít nghiêm trọng.',
    'Nếu người bị kết án đã bị tạm giữ, tạm giam thì thời gian tạm giữ, tạm giam được trừ vào thời gian chấp hành hình phạt cải tạo không giam giữ, cứ 01 ngày tạm giữ, tạm giam bằng 03 ngày cải tạo không giam giữ.',
    'Bình luận',
    'Bình luận mẫu.',
    'Điều 38. Tù có thời hạn',
    '1. Tù có thời hạn là buộc người bị kết án phải chấp hành hình phạt tại cơ sở giam giữ trong một thời hạn nhất định.',
    'Tù có thời hạn đối với người phạm một tội có mức tối thiểu là 03 tháng và mức tối đa là 20 năm.',
    'Thời gian tạm giữ, tạm giam được trừ vào thời hạn chấp hành hình phạt tù, cứ 01 ngày tạm giữ, tạm giam bằng 01 ngày tù.',
    'Bình luận',
    'Bình luận mẫu.',
    'CHƯƠNG VIII',
    'QUYẾT ĐỊNH HÌNH PHẠT',
    'Điều 54. Quyết định hình phạt dưới mức thấp nhất của khung hình phạt được áp dụng',
    '1. Tòa án có thể quyết định một hình phạt dưới mức thấp nhất của khung hình phạt được áp dụng nhưng phải trong khung hình phạt liền kề nhẹ hơn của điều luật khi người phạm tội có ít nhất hai tình tiết giảm nhẹ quy định tại khoản 1 Điều 51 của Bộ luật này.',
    'Bình luận',
    'Bình luận mẫu.',
    'Điều 55. Quyết định hình phạt trong trường hợp phạm nhiều tội',
    'Khi xét xử cùng 01 lần một người phạm nhiều tội, Tòa án quyết định hình phạt đối với từng tội và tổng hợp hình phạt theo quy định sau đây:',
    '1. Đối với hình phạt chính:',
    'a) Nếu các hình phạt đã tuyên cùng là cải tạo không giam giữ hoặc cùng là tù có thời hạn, thì các hình phạt đó được cộng lại thành hình phạt chung; hình phạt chung không được vượt quá 03 năm đối với hình phạt cải tạo không giam giữ, 30 năm đối với hình phạt tù có thời hạn;',
    'b) Nếu các hình phạt đã tuyên là cải tạo không giam giữ, tù có thời hạn, thì hình phạt cải tạo không giam giữ được chuyển đổi thành hình phạt tù theo tỷ lệ cứ 03 ngày cải tạo không giam giữ được chuyển đổi thành 01 ngày tù để tổng hợp thành hình phạt chung theo quy định tại điểm a khoản 1 Điều này;',
    'Bình luận',
    'Bình luận mẫu.',
    'Điều 57. Quyết định hình phạt trong trường hợp chuẩn bị phạm tội, phạm tội chưa đạt',
    '3. Đối với trường hợp phạm tội chưa đạt, nếu điều luật được áp dụng có quy định hình phạt cao nhất là tù chung thân hoặc tử hình thì áp dụng hình phạt tù không quá 20 năm; nếu là tù có thời hạn thì mức hình phạt không quá ba phần tư mức phạt tù mà điều luật quy định.',
    'Bình luận',
    'Bình luận mẫu.',
    'Điều 101. Tù có thời hạn',
    'Mức phạt tù có thời hạn áp dụng đối với người dưới 18 tuổi phạm tội được quy định như sau:',
    '1. Đối với người từ đủ 16 tuổi đến dưới 18 tuổi khi phạm tội, nếu điều luật được áp dụng quy định hình phạt tù chung thân hoặc tử hình, thì mức hình phạt cao nhất được áp dụng không quá 18 năm tù; nếu là tù có thời hạn thì mức hình phạt cao nhất được áp dụng không quá ba phần tư mức phạt tù mà điều luật quy định;',
    '2. Đối với người từ đủ 14 tuổi đến dưới 16 tuổi khi phạm tội, nếu điều luật được áp dụng quy định hình phạt tù chung thân hoặc tử hình, thì mức hình phạt cao nhất được áp dụng không quá 12 năm tù; nếu là tù có thời hạn thì mức hình phạt cao nhất được áp dụng không quá một phần hai mức phạt tù mà điều luật quy định.',
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
    '4. Phạm tội thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 12 năm đến 20 năm hoặc tù chung thân:',
    'a) Chiếm đoạt tài sản trị giá 500.000.000 đồng trở lên;',
    'Bình luận',
    'Bình luận mẫu.',
  ].join('\n'),
  [],
);
const d = (s) => new Date(s + 'T00:00:00');

test('khoảng hình phạt hợp pháp: khung, Điều 54 (khung liền kề), chưa đạt (Điều 57), người dưới 18 tuổi (Điều 101)', () => {
  const r = legalRange({ book: BOOK, dieu: '174', khoan: 2, giamNheK1: 2 });
  assert.equal(r.min, 24);
  assert.equal(r.max, 84);
  assert.match(r.lines[1].t, /trong khung liền kề nhẹ hơn \(khoản 1: từ 6 tháng đến 3 năm\)/);
  assert.equal(r.lines[1].law[0].ref, 'khoản 1 Điều 54 BLHS');
  assert.equal(r.anTreo, true);
  // Khoản 4 có tù chung thân: người 15 tuổi → tối đa 12 năm; chưa đạt → tối đa 20 năm, không còn chung thân.
  const u = legalRange({ book: BOOK, dieu: '174', khoan: 4, tuoi: 15 });
  assert.equal(u.max, 144);
  assert.equal(u.chungThan, false);
  assert.equal(u.lines[1].law[0].ref, 'khoản 2 Điều 101 BLHS');
  const c = legalRange({ book: BOOK, dieu: '174', khoan: 3, chuaDat: true });
  assert.equal(c.max, 135); // 3/4 của 15 năm
  assert.equal(legalRange({ book: null, dieu: '174', khoan: 2 }).frame, null);
  assert.deepEqual(
    (({ tongHop: t, tamGiam: g }) => [t.tuMax, t.caiTaoMax, t.tyLe, g.tu, g.caiTao])(penaltyRules(BOOK)),
    [360, 36, 3, 1, 3],
  );
});

test('tổng hợp hình phạt (Điều 55, 56), trừ tạm giam và ngày chấp hành xong', () => {
  const t = tongHop([{ loai: 'tu', thang: 96 }, { loai: 'tu', thang: 36 }, { loai: 'cai-tao', thang: 12 }, { loai: 'phat-tien', tien: 20000000 }], { book: BOOK, daChapHanh: { thang: 5 } });
  assert.equal(t.loai, 'tu');
  assert.deepEqual(t.dur, { thang: 136, ngay: 0 });
  assert.equal(t.tien, 20000000);
  assert.deepEqual(t.conLai, { thang: 131, ngay: 0 });
  assert.match(t.lines[0], /chuyển thành 4 tháng tù/);
  assert.match(tongHop([{ loai: 'tu', thang: 240 }, { loai: 'tu', thang: 180 }], { book: BOOK }).lines[0], /vượt quá 30 năm → hình phạt chung là 30 năm tù/);
  assert.equal(tongHop([{ loai: 'tu', thang: 240 }, { loai: 'chung-than' }]).loai, 'chung-than');
  // Tạm giam 01/03–30/04/2026 (61 ngày), được tại ngoại, chấp hành từ 01/09/2026 → trừ 61 ngày.
  const c = chapHanh({ loai: 'tu', dur: { thang: 24 }, tamGiam: [{ tu: '2026-03-01', den: '2026-04-30' }], batDau: '2026-09-01', book: BOOK });
  assert.equal(c.giam, 61);
  assert.equal(fmtDate(c.ketThuc), '29/06/2028'); // 720 − 61 = 659 ngày = 21 tháng 29 ngày
  // Thời hạn tính từ ngày bắt tạm giam (tạm giam liên tục): không trừ thêm.
  const c2 = chapHanh({ loai: 'tu', dur: { thang: 96 }, tamGiam: [{ tu: '2026-01-10', den: '2026-10-15' }], batDau: '2026-01-10' });
  assert.equal(c2.giam, 0);
  assert.equal(fmtDate(c2.ketThuc), '09/01/2034');
  assert.equal(chapHanh({ loai: 'cai-tao', dur: { thang: 12 }, tamGiam: [{ tu: '2026-01-01', den: '2026-01-10' }] }).tru, 30);
  assert.equal(fmtDate(addMonths(d('2026-01-31'), 1)), '28/02/2026');
});

test('thời hạn tố tụng sơ thẩm: chuẩn bị xét xử theo loại tội, gia hạn, trả hồ sơ, mở phiên tòa, sau tuyên án, tạm giam', () => {
  const rules = mergeRules();
  // 30 ngày kể từ 01/10/2026 (thứ Năm) → 31/10/2026 là thứ Bảy → lùi sang thứ Hai 02/11/2026.
  assert.equal(fmtDate(dueDate(d('2026-10-01'), rules['chuan-bi-it'])), '02/11/2026');
  assert.equal(fmtDate(dueDate(d('2026-01-31'), rules['chuan-bi-rnt'])), '31/03/2026');
  const rec = { cap: 'so-tham', loaiToi: 'nt', thuLy: { ngay: '2026-09-20' }, moc: {}, defendants: [{ id: 'a', hoTen: 'Nguyễn Văn An', nganChan: { loai: 'tam-giam', tu: '2026-01-10', den: '2026-11-03' } }] };
  const today = d('2026-10-30');
  let it = computeDeadlines(rec, { today });
  const cb = it.find((x) => x.id === 'chuan-bi');
  assert.equal(fmtDate(cb.han), '04/11/2026');
  assert.equal(cb.trangThai, 'sap');
  assert.equal(cb.con, 5);
  assert.equal(it.find((x) => x.id === 'tam-giam-a').trangThai, 'sap');
  rec.moc.giaHan = true;
  assert.equal(fmtDate(computeDeadlines(rec, { today }).find((x) => x.id === 'chuan-bi').han), '19/11/2026');
  rec.moc = { ngayTraHoSo: '2026-10-20', ngayNhanLaiHoSo: '2026-12-01' };
  it = computeDeadlines(rec, { today });
  assert.equal(fmtDate(it.find((x) => x.id === 'nhan-lai-ho-so').han), '16/12/2026');
  rec.moc = { ngayQdXetXu: '2026-10-26', ngayXetXu: '2026-11-05', ngayTuyenAn: '2026-11-05' };
  it = computeDeadlines(rec, { today: d('2026-11-06') });
  assert.equal(it.find((x) => x.id === 'chuan-bi').trangThai, 'xong');
  assert.equal(it.find((x) => x.id === 'mo-phien-toa').trangThai, 'xong');
  assert.equal(fmtDate(it.find((x) => x.id === 'khang-cao').han), '20/11/2026');
  assert.equal(it.find((x) => x.id === 'khang-cao').trangThai, 'moc');
  assert.equal(fmtDate(it.find((x) => x.id === 'giao-ban-an').han), '16/11/2026');
  assert.match(it.find((x) => x.id === 'thi-hanh').ghiChu, /có hiệu lực ngày 07\/12\/2026/);
  assert.equal(fmtDate(it.find((x) => x.id === 'tam-giam-sau-a').han), '20/12/2026');
  // Thiếu loại tội → báo cần chọn; người dùng sửa thời hạn → dùng số đã sửa.
  const r2 = computeDeadlines({ cap: 'so-tham', thuLy: { ngay: '2026-09-20' }, moc: {} }, { today });
  assert.equal(r2[0].trangThai, 'thieu');
  assert.match(r2[0].ghiChu, /Chọn loại tội phạm/);
  assert.equal(mergeRules({ 'khang-cao': { n: 20 }, 'mo-phien-toa': { n: -1 } })['khang-cao'].n, 20);
  assert.equal(mergeRules({ 'mo-phien-toa': { n: -1 } })['mo-phien-toa'].n, DEFAULT_RULES['mo-phien-toa'].n);
});

test('thời hạn phúc thẩm; việc cần làm trên nhiều hồ sơ; loại tội phạm theo khung truy tố', () => {
  const pt = { id: 'p', cap: 'phuc-tham', moc: { ngayNhanHoSo: '2026-09-01' }, defendants: [] };
  const so = { id: 's', cap: 'so-tham', loaiToi: 'it', thuLy: { ngay: '2026-10-20' }, moc: {}, defendants: [] };
  const it = computeDeadlines(pt, { today: d('2026-10-30') });
  assert.equal(fmtDate(it[0].han), '02/11/2026'); // 31/10 là thứ Bảy
  const up = upcoming([so, pt], { today: d('2026-10-30') });
  assert.deepEqual(up.map((x) => `${x.rec.id}:${x.id}:${x.trangThai}`), ['p:phuc-tham:sap', 's:chuan-bi:con']);
  assert.equal(suggestLoaiToi([{ toiDanh: [{ dieu: '174', khoan: 3 }] }, { toiDanh: [{ dieu: '174', khoan: 1 }] }], BOOK), 'rnt');
  assert.equal(suggestLoaiToi([{ toiDanh: [{ dieu: '174', khoan: 4 }] }], BOOK), 'dbnt');
});

test('đọc cáo trạng: số, ngày, Viện kiểm sát, bị can, tội danh, nhân thân, biện pháp ngăn chặn, bị hại', () => {
  const ct = parseIndictment(`VIỆN KIỂM SÁT NHÂN DÂN TỈNH NINH BÌNH
VIỆN KIỂM SÁT NHÂN DÂN KHU VỰC 3
Số: 25/CT-VKSKV3
Ninh Bình, ngày 15 tháng 9 năm 2026
CÁO TRẠNG
Bị can: Nguyễn Văn An (tên gọi khác: không), sinh ngày 12/3/1985 tại Ninh Bình; nơi cư trú: thôn Đông, xã Tây, tỉnh Ninh Bình; nghề nghiệp: lao động tự do. Bị bắt tạm giam từ ngày 10/01/2026 đến nay.
Bị can: Trần Văn Bảo, sinh năm 1990; nơi cư trú: xã Bắc, tỉnh Ninh Bình. Bị can đang bị áp dụng biện pháp cấm đi khỏi nơi cư trú.
Bị hại: chị Lê Thị Cúc, sinh năm 1980.
Nguyễn Văn An đã chiếm đoạt số tiền 180.000.000 đồng của chị Lê Thị Cúc.
Truy tố bị can Nguyễn Văn An ra trước Tòa án nhân dân khu vực 3 - Ninh Bình để xét xử về tội "Lừa đảo chiếm đoạt tài sản" theo điểm c khoản 2 Điều 174 Bộ luật Hình sự.
Truy tố bị can Trần Văn Bảo về tội "Tiêu thụ tài sản do người khác phạm tội mà có" theo khoản 1 Điều 323 Bộ luật Hình sự.`);
  assert.equal(ct.so, '25/CT-VKSKV3');
  assert.equal(ct.ngay, '2026-09-15');
  assert.equal(ct.vks, 'VIỆN KIỂM SÁT NHÂN DÂN KHU VỰC 3');
  assert.deepEqual(ct.defendants.map((x) => [x.hoTen, x.toiDanh, x.tenToi, x.namSinh, x.noiCuTru, x.nganChan]), [
    ['Nguyễn Văn An', [{ dieu: '174', khoan: 2, diem: ['c'] }], 'Lừa đảo chiếm đoạt tài sản', '1985', 'thôn Đông, xã Tây, tỉnh Ninh Bình', { loai: 'tam-giam', tu: '2026-01-10', den: '' }],
    ['Trần Văn Bảo', [{ dieu: '323', khoan: 1, diem: [] }], 'Tiêu thụ tài sản do người khác phạm tội mà có', '1990', 'xã Bắc, tỉnh Ninh Bình', { loai: 'cam-di-khoi' }],
  ]);
  assert.deepEqual(ct.biHai, ['Lê Thị Cúc']);
  assert.equal(ct.money[0].v, 180000000);
});

test('biểu mẫu Tòa án: tự điền từ hồ sơ, phần quyết định, dựng đủ các mẫu, xuất Word, nhận ô trong mẫu Word', () => {
  const rec = {
    cap: 'so-tham', thuLy: { so: '120/2026/TLST-HS', ngay: '2026-09-20' }, toa: { ten: 'Tòa án nhân dân khu vực 3 - Ninh Bình', diaDanh: 'Ninh Bình' },
    hdxx: { chuToa: 'Phạm Văn Hùng', hoiTham: 'Nguyễn Thị Lan\nTrần Văn Minh', thuKy: 'Lê Thu Hà', kiemSatVien: 'Đỗ Văn Nam', vks: 'VIỆN KIỂM SÁT NHÂN DÂN KHU VỰC 3' },
    caoTrang: { so: '25/CT-VKSKV3', ngay: '2026-09-15' }, moc: { ngayXetXu: '2026-10-15', gioXetXu: '08 giờ 00' },
    defendants: [{ hoTen: 'Nguyễn Văn An', namSinh: '1985', noiCuTru: 'thôn Đông, xã Tây', toiDanh: [{ dieu: '174', khoan: 2, diem: ['c'] }], giamNhe: ['b', 's'], hinhPhat: { loai: 'tu', thang: 30 }, nganChan: { loai: 'tam-giam', tu: '2026-01-10' } }],
    nguoiThamGia: [{ vaiTro: 'bi-hai', hoTen: 'Lê Thị Cúc' }, { vaiTro: 'nguoi-bao-chua', hoTen: 'Hoàng Văn Bình' }],
  };
  const v = courtValues(rec, { now: d('2026-10-27') });
  assert.equal(v.biCaoChiTiet, 'Nguyễn Văn An; sinh năm 1985; nơi cư trú: thôn Đông, xã Tây; bị tạm giam từ ngày 10/01/2026.');
  assert.equal(v.dieuLuat, 'điểm c khoản 2 Điều 174 Bộ luật Hình sự');
  assert.equal(v.biHai, 'Lê Thị Cúc');
  assert.equal(v.nguoiThamGia, 'Người bào chữa: Hoàng Văn Bình');
  assert.equal(quyetDinhText(rec.defendants), 'Tuyên bố bị cáo Nguyễn Văn An phạm tội “Lừa đảo chiếm đoạt tài sản”.\nCăn cứ điểm c khoản 2 Điều 174; điểm b, s khoản 1 Điều 51; Điều 38 của Bộ luật Hình sự.\nXử phạt bị cáo Nguyễn Văn An 02 (hai) năm 06 (sáu) tháng tù. Thời hạn tù tính từ ngày bắt tạm giam 10/01/2026.');
  assert.equal(thoiHanChu(96), '08 (tám) năm');
  assert.equal(tenCoQuan('VIỆN KIỂM SÁT NHÂN DÂN TỈNH NINH BÌNH'), 'Viện kiểm sát nhân dân tỉnh Ninh Bình');
  assert.ok(COURT_FORMS.length >= 25);
  assert.ok(COURT_FORMS.some((f) => f.cap === 'pt') && COURT_FORMS.some((f) => f.cap === 'tha'));
  for (const f of COURT_FORMS) {
    const doc = f.build(v);
    assert.ok(renderDocumentHtml(doc).includes(doc.title.name), f.id);
    assert.ok(buildDocx(doc, doc.title.name).length > 3000, f.id);
    assert.ok(formFields(f).every(Boolean), f.id);
  }
  const html = renderDocumentHtml(buildCourtForm('so-qd-xet-xu', v)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(html, /Số: ……\/2026\/QĐXXST-HS/);
  assert.match(html, /Bị cáo bị Viện kiểm sát nhân dân khu vực 3 truy tố về tội “Lừa đảo chiếm đoạt tài sản” theo điểm c khoản 2 Điều 174 Bộ luật Hình sự \(Cáo trạng số 25\/CT-VKSKV3 ngày 15 tháng 09 năm 2026\)/);
  assert.match(html, /Thời gian mở phiên tòa: 08 giờ 00, ngày 15 tháng 10 năm 2026/);
  assert.match(html, /Hội thẩm nhân dân: Trần Văn Minh\./);
  assert.match(html, /THẨM PHÁN – CHỦ TỌA PHIÊN TÒA Phạm Văn Hùng/);
  assert.deepEqual(['Bị cáo', 'Họ tên bị cáo', 'Thời gian mở phiên tòa', 'Số thụ lý', 'Nhân thân bị cáo', 'Không rõ'].map(matchField), ['biCao', 'biCao', 'ngayXetXu', 'soThuLy', 'biCaoChiTiet', null]);
});

test('mẫu Word của đơn vị lưu riêng từng tài khoản', async () => {
  setScope('tp1');
  await courtTplDb.put('so-qd-xet-xu', 'mau-don-vi.docx', new Uint8Array([1, 2, 3]));
  assert.deepEqual(Object.keys(await courtTplDb.list()), ['so-qd-xet-xu']);
  assert.deepEqual([...(await courtTplDb.get('so-qd-xet-xu')).data], [1, 2, 3]);
  setScope('tp2');
  assert.deepEqual(await courtTplDb.list(), {});
  assert.equal(await courtTplDb.get('so-qd-xet-xu'), null);
  setScope('tp1');
  await courtTplDb.remove('so-qd-xet-xu');
  assert.deepEqual(await courtTplDb.list(), {});
  setScope(null);
});
