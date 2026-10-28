// v2.48: bộ tự động bắt thông tin vụ án từ tài liệu → ô của hồ sơ xét xử.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCase, detectKind, parseParticipants, parseDefendantBlocks, properCase, applyExtract, FIELD_RULES } from '../../assets/js/legal/court-extract.js';

const CT = `VIỆN KIỂM SÁT NHÂN DÂN TỈNH NINH BÌNH
VIỆN KIỂM SÁT NHÂN DÂN KHU VỰC 3
Số: 25/CT-VKSKV3
Ninh Bình, ngày 15 tháng 9 năm 2026
CÁO TRẠNG
Bị can: Nguyễn Văn An (tên gọi khác: không), sinh ngày 12/3/1985 tại Ninh Bình; nơi cư trú: thôn Đông, xã Tây, tỉnh Ninh Bình; nghề nghiệp: lao động tự do. Bị bắt tạm giam từ ngày 10/01/2026 đến nay.
Bị hại: chị Trần Thị Bình, sinh năm 1980; địa chỉ: phố Lê Lợi, phường Nam, tỉnh Ninh Bình.
NỘI DUNG VỤ ÁN
Khoảng 14 giờ ngày 05/12/2025, Nguyễn Văn An đã dùng thủ đoạn gian dối chiếm đoạt số tiền 180.000.000 đồng của chị Trần Thị Bình.
Truy tố bị can Nguyễn Văn An ra trước Tòa án nhân dân khu vực 3 - Ninh Bình để xét xử về tội "Lừa đảo chiếm đoạt tài sản" theo điểm c khoản 2 Điều 174 Bộ luật Hình sự.`;
const QD = `TÒA ÁN NHÂN DÂN TỈNH NINH BÌNH
TÒA ÁN NHÂN DÂN KHU VỰC 3
Số: 130/2026/QĐXXST-HS
Ninh Bình, ngày 20 tháng 10 năm 2026
QUYẾT ĐỊNH ĐƯA VỤ ÁN RA XÉT XỬ
Căn cứ Điều 255 Bộ luật Tố tụng hình sự;
Sau khi nghiên cứu hồ sơ vụ án hình sự sơ thẩm thụ lý số 120/2026/TLST-HS ngày 15 tháng 9 năm 2026,
QUYẾT ĐỊNH:
1. Đưa ra xét xử sơ thẩm vụ án hình sự đối với bị cáo: Nguyễn Văn An, sinh năm 1985; nơi cư trú: thôn Đông, xã Tây, tỉnh Ninh Bình; bị Viện kiểm sát nhân dân khu vực 3 truy tố về tội "Lừa đảo chiếm đoạt tài sản" theo điểm c khoản 2 Điều 174 Bộ luật Hình sự.
Thời gian mở phiên tòa: 08 giờ 00 ngày 05 tháng 11 năm 2026.
Địa điểm mở phiên tòa: trụ sở Tòa án nhân dân khu vực 3 - Ninh Bình, số 1 đường Trần Hưng Đạo.
Vụ án được xét xử công khai.
2. Những người tiến hành tố tụng:
Thẩm phán - Chủ tọa phiên tòa: Ông Phạm Văn Hùng
Các Hội thẩm nhân dân: Bà Lê Thị Hoa; Ông Trần Văn Nam
Thư ký phiên tòa: Bà Nguyễn Thị Lan
Kiểm sát viên: Ông Vũ Văn Minh - Viện kiểm sát nhân dân khu vực 3
3. Những người tham gia tố tụng:
Bị hại: Chị Trần Thị Bình; địa chỉ: phố Lê Lợi, phường Nam, tỉnh Ninh Bình.
Người bào chữa cho bị cáo: Luật sư Đỗ Văn Khoa - Văn phòng luật sư Hoa Lư.
Người làm chứng: Anh Bùi Văn Sơn; chị Mai Thị Thu.`;
const BA = `TÒA ÁN NHÂN DÂN KHU VỰC 3 - NINH BÌNH
Bản án số: 25/2026/HS-ST
Ngày: 05-11-2026
NHÂN DANH NƯỚC CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
TÒA ÁN NHÂN DÂN KHU VỰC 3 - NINH BÌNH
Thành phần Hội đồng xét xử sơ thẩm gồm có:
Thẩm phán - Chủ tọa phiên tòa: Ông Phạm Văn Hùng
Các Hội thẩm nhân dân: Bà Lê Thị Hoa; Ông Trần Văn Nam
Thư ký phiên tòa: Bà Nguyễn Thị Lan - Thư ký Tòa án nhân dân khu vực 3
Đại diện Viện kiểm sát nhân dân khu vực 3 tham gia phiên tòa: Ông Vũ Văn Minh - Kiểm sát viên.
Ngày 05 tháng 11 năm 2026, tại trụ sở Tòa án nhân dân khu vực 3 - Ninh Bình xét xử sơ thẩm công khai vụ án hình sự sơ thẩm thụ lý số: 120/2026/TLST-HS ngày 15 tháng 9 năm 2026 theo Quyết định đưa vụ án ra xét xử số: 130/2026/QĐXXST-HS ngày 20 tháng 10 năm 2026 đối với bị cáo:
Nguyễn Văn An, sinh năm 1985; nơi cư trú: thôn Đông, xã Tây, tỉnh Ninh Bình; bị bắt tạm giam từ ngày 10/01/2026.
Bị hại: chị Trần Thị Bình, sinh năm 1980.
NỘI DUNG VỤ ÁN
Khoảng 14 giờ ngày 05/12/2025, An đã lừa chị Bình.
QUYẾT ĐỊNH
Tuyên bố bị cáo Nguyễn Văn An phạm tội "Lừa đảo chiếm đoạt tài sản".
Áp dụng điểm c khoản 2 Điều 174; điểm s khoản 1 Điều 51 Bộ luật Hình sự. Xử phạt bị cáo Nguyễn Văn An 02 (hai) năm 06 (sáu) tháng tù.`;
const KC = `ĐƠN KHÁNG CÁO
Kính gửi: Tòa án nhân dân tỉnh Ninh Bình
Tôi là Nguyễn Văn An, bị cáo trong vụ án theo Bản án hình sự sơ thẩm số 25/2026/HS-ST ngày 05/11/2026 của Tòa án nhân dân khu vực 3 - Ninh Bình.
Tôi kháng cáo xin giảm nhẹ hình phạt và xin được hưởng án treo vì gia đình đã bồi thường toàn bộ thiệt hại.`;
const TB = `TÒA ÁN NHÂN DÂN TỈNH NINH BÌNH
Số: 45/2026/TB-TA
Ninh Bình, ngày 20 tháng 11 năm 2026
THÔNG BÁO VỀ VIỆC THỤ LÝ VỤ ÁN
Tòa án nhân dân tỉnh Ninh Bình đã thụ lý vụ án hình sự phúc thẩm số 45/2026/TLPT-HS ngày 18 tháng 11 năm 2026 đối với bị cáo Nguyễn Văn An do có kháng cáo của bị cáo đối với Bản án hình sự sơ thẩm số 25/2026/HS-ST ngày 05/11/2026 của Tòa án nhân dân khu vực 3 - Ninh Bình.
Ngày 12/11/2026, bị cáo Nguyễn Văn An kháng cáo xin giảm nhẹ hình phạt.`;
const byPath = (R) => Object.fromEntries(R.fields.map((f) => [f.path, f.value]));

test('nhận loại tài liệu: cáo trạng, quyết định đưa vụ án ra xét xử, bản án, đơn kháng cáo, thông báo thụ lý', () => {
  assert.equal(detectKind('ct.txt', CT), 'cao-trang');
  assert.equal(detectKind('qd.txt', QD), 'qd-xet-xu');
  assert.equal(detectKind('ba.txt', BA), 'ban-an');
  assert.equal(detectKind('kc.txt', KC), 'khang-cao');
  assert.equal(detectKind('tb.txt', TB), 'thong-bao-thu-ly');
  assert.equal(properCase('TÒA ÁN NHÂN DÂN THÀNH PHỐ HỒ CHÍ MINH'), 'Tòa án nhân dân thành phố Hồ Chí Minh');
  assert.equal(properCase('Tòa án nhân dân khu vực 3'), 'Tòa án nhân dân khu vực 3');
});

test('quyết định đưa vụ án ra xét xử: thụ lý, Tòa án, Hội đồng xét xử, mốc phiên tòa, người tham gia, bị cáo — mỗi giá trị có câu trích', () => {
  const R = extractCase([{ name: 'QĐ xét xử.txt', text: QD }]);
  const v = byPath(R);
  assert.equal(v['thuLy.so'], '120/2026/TLST-HS');
  assert.equal(v['thuLy.ngay'], '2026-09-15');
  assert.equal(v.cap, 'so-tham');
  assert.equal(v['toa.ten'], 'Tòa án nhân dân khu vực 3');
  assert.equal(v['toa.capTren'], 'Tòa án nhân dân tỉnh Ninh Bình');
  assert.equal(v['toa.diaDanh'], 'Ninh Bình');
  assert.equal(v['hdxx.chuToa'], 'Phạm Văn Hùng');
  assert.equal(v['hdxx.hoiTham'], 'Lê Thị Hoa\nTrần Văn Nam');
  assert.equal(v['hdxx.thuKy'], 'Nguyễn Thị Lan');
  assert.equal(v['hdxx.kiemSatVien'], 'Vũ Văn Minh');
  assert.equal(v['hdxx.vks'], 'Viện kiểm sát nhân dân khu vực 3');
  assert.equal(v['moc.soQdXetXu'], '130/2026/QĐXXST-HS');
  assert.equal(v['moc.ngayQdXetXu'], '2026-10-20');
  assert.equal(v['moc.ngayXetXu'], '2026-11-05');
  assert.equal(v['moc.gioXetXu'], '08 giờ 00');
  assert.equal(v['moc.diaDiem'], 'trụ sở Tòa án nhân dân khu vực 3 - Ninh Bình, số 1 đường Trần Hưng Đạo');
  assert.equal(v['moc.xuKin'], undefined);
  assert.ok(R.fields.every((f) => f.quote && f.src === 'QĐ xét xử.txt'));
  assert.match(R.fields.find((f) => f.path === 'hdxx.chuToa').quote, /Chủ tọa phiên tòa: Ông Phạm Văn Hùng/);
  assert.deepEqual(
    R.people.map((p) => [p.vaiTro, p.hoTen, p.diaChi]),
    [
      ['bi-hai', 'Trần Thị Bình', 'phố Lê Lợi, phường Nam, tỉnh Ninh Bình'],
      ['nguoi-bao-chua', 'Đỗ Văn Khoa', ''],
      ['nguoi-lam-chung', 'Bùi Văn Sơn', ''],
      ['nguoi-lam-chung', 'Mai Thị Thu', ''],
    ],
  );
  assert.equal(R.defendants.length, 1);
  const d = R.defendants[0];
  assert.equal(d.hoTen, 'Nguyễn Văn An');
  assert.equal(d.namSinh, '1985');
  assert.equal(d.noiCuTru, 'thôn Đông, xã Tây, tỉnh Ninh Bình');
  assert.deepEqual(d.toiDanh, [{ dieu: '174', khoan: 2, diem: ['c'] }]);
  assert.equal(d.tenToi, 'Lừa đảo chiếm đoạt tài sản');
  assert.equal(v.ten, 'Lừa đảo chiếm đoạt tài sản — Nguyễn Văn An');
});

test('nhiều tài liệu: ưu tiên loại phù hợp cho từng ô, giá trị khác nhau thành lựa chọn; cáo trạng + bản án bổ sung ngày hành vi, hình phạt, tình tiết', () => {
  const R = extractCase([
    { name: 'Cáo trạng 25.txt', text: CT },
    { name: 'QĐ xét xử.txt', text: QD },
    { name: 'Bản án.txt', text: BA },
  ]);
  assert.deepEqual(
    R.docs.map((d) => d.kind),
    ['cao-trang', 'qd-xet-xu', 'ban-an'],
  );
  const f = Object.fromEntries(R.fields.map((x) => [x.path, x]));
  assert.equal(f['caoTrang.so'].value, '25/CT-VKSKV3');
  assert.equal(f['caoTrang.ngay'].value, '2026-09-15');
  assert.equal(f['caoTrang.vks'].value, 'Viện kiểm sát nhân dân khu vực 3');
  assert.equal(f['moc.ngayHanhVi'].value, '2025-12-05');
  assert.equal(f['moc.ngayHanhVi'].conf, 'vua');
  assert.equal(f['moc.ngayTuyenAn'].value, '2026-11-05');
  assert.equal(f['banAn.so'].value, '25/2026/HS-ST');
  assert.equal(f['banAn.ngay'].value, '05/11/2026');
  // Tòa án: QĐ (ưu tiên) ghi "khu vực 3", bản án ghi đủ "khu vực 3 - Ninh Bình" → thành lựa chọn khác.
  assert.equal(f['toa.ten'].src, 'QĐ xét xử.txt');
  assert.ok(f['toa.ten'].alts.some((a) => a.value === 'Tòa án nhân dân khu vực 3 - Ninh Bình'));
  // Số thụ lý: bản án ưu tiên hơn QĐ (có cùng giá trị, không sinh lựa chọn).
  assert.equal(f['thuLy.so'].alts.length, 0);
  // Bị cáo gộp từ ba tài liệu: nhân thân từ cáo trạng, hình phạt + tình tiết từ bản án.
  assert.equal(R.defendants.length, 1);
  const d = R.defendants[0];
  assert.equal(d.ngaySinh, '12/3/1985');
  assert.deepEqual(d.nganChan, { loai: 'tam-giam', tu: '2026-01-10', den: '' });
  assert.deepEqual(d.hinhPhat, { loai: 'tu', thang: 30 });
  assert.deepEqual(d.giamNhe, ['s']);
  // Người tham gia không trùng dù xuất hiện ở cả ba tài liệu.
  assert.equal(R.people.filter((p) => p.hoTen === 'Trần Thị Bình').length, 1);
});

test('đơn kháng cáo, thông báo thụ lý phúc thẩm: bản án sơ thẩm, Tòa án đã xét xử, kháng cáo, cấp phúc thẩm', () => {
  const v = byPath(extractCase([{ name: 'Đơn kháng cáo.txt', text: KC }]));
  assert.equal(v['banAn.so'], '25/2026/HS-ST');
  assert.equal(v['banAn.ngay'], '05/11/2026');
  assert.equal(v['banAn.toa'], 'Tòa án nhân dân khu vực 3 - Ninh Bình');
  assert.match(v.khangCao, /kháng cáo xin giảm nhẹ hình phạt và xin được hưởng án treo/);
  const t = byPath(extractCase([{ name: 'Thông báo thụ lý.txt', text: TB }]));
  assert.equal(t['thuLy.so'], '45/2026/TLPT-HS');
  assert.equal(t['thuLy.ngay'], '2026-11-18');
  assert.equal(t.cap, 'phuc-tham');
  assert.equal(t['toa.ten'], 'Tòa án nhân dân tỉnh Ninh Bình');
  assert.equal(t['banAn.so'], '25/2026/HS-ST');
  assert.match(t.khangCao, /Ngày 12\/11\/2026, bị cáo Nguyễn Văn An kháng cáo xin giảm nhẹ hình phạt/);
});

test('không bịa: văn bản không liên quan không cho ra ô nào; khối người tham gia bỏ qua chữ không phải tên', () => {
  const R = extractCase([{ name: 'thu.txt', text: 'Kính gửi Ủy ban nhân dân xã. Hôm nay trời đẹp, chúng tôi họp tổ dân phố về việc thu gom rác.' }]);
  assert.deepEqual(R.fields, []);
  assert.deepEqual(R.people, []);
  assert.deepEqual(R.defendants, []);
  assert.deepEqual(parseParticipants('Bị hại: Không có. Người làm chứng: Vắng mặt.'), []);
  assert.deepEqual(parseDefendantBlocks('Bị cáo: không có mặt tại phiên tòa.'), []);
  // Luật nào cũng có nhãn, nhóm, regex.
  for (const r of FIELD_RULES) assert.ok(r.path && r.label && r.group && r.re.length, r.path);
});

test('điền vào hồ sơ: chỉ ô trống, ghi đè khi chọn; người tham gia và bị cáo gộp theo tên, không nhân đôi', () => {
  const R = extractCase([{ name: 'QĐ xét xử.txt', text: QD }]);
  const rec = { cap: 'so-tham', thuLy: { so: '999/2026/TLST-HS' }, toa: {}, hdxx: {}, moc: {}, caoTrang: {}, nguoiThamGia: [{ vaiTro: 'bi-hai', hoTen: 'Trần Thị Bình', diaChi: '' }], defendants: [{ id: 'd1', hoTen: '', toiDanh: [{ dieu: '', khoan: null, diem: [] }] }] };
  const r1 = applyExtract(rec, R);
  assert.equal(rec.thuLy.so, '999/2026/TLST-HS', 'ô đã có giá trị khác không bị ghi đè');
  assert.equal(r1.skipped, 1);
  assert.equal(rec.thuLy.ngay, '2026-09-15');
  assert.equal(rec.hdxx.chuToa, 'Phạm Văn Hùng');
  assert.equal(rec.moc.ngayXetXu, '2026-11-05');
  assert.equal(rec.nguoiThamGia.length, 4, 'bị hại đã có → bổ sung địa chỉ, không thêm dòng');
  assert.equal(rec.nguoiThamGia[0].diaChi, 'phố Lê Lợi, phường Nam, tỉnh Ninh Bình');
  assert.equal(rec.defendants.length, 1, 'bị cáo điền vào dòng trống sẵn có');
  assert.equal(rec.defendants[0].id, 'd1');
  assert.equal(rec.defendants[0].hoTen, 'Nguyễn Văn An');
  assert.deepEqual(rec.defendants[0].toiDanh, [{ dieu: '174', khoan: 2, diem: ['c'] }]);
  const r2 = applyExtract(rec, { fields: R.fields.filter((f) => f.path === 'thuLy.so') }, { overwrite: true });
  assert.equal(rec.thuLy.so, '120/2026/TLST-HS');
  assert.equal(r2.filled, 1);
  // Chạy lại không thay đổi gì thêm.
  const r3 = applyExtract(rec, R);
  assert.equal(r3.filled, 0);
  assert.equal(rec.defendants.length, 1);
});
