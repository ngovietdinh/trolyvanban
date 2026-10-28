// v2.45: giám đốc thẩm (thời hạn, giá trị biểu mẫu, biểu mẫu), danh mục án lệ, tên tệp tải về.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDeadlines, DEFAULT_RULES } from '../../assets/js/legal/court-deadlines.js';
import { courtValues, buildCourtForm, COURT_FORMS, CAP_FORMS, NGUOI_KN, HOI_DONG_GDT, KET_QUA_GDT } from '../../assets/js/legal/court-forms.js';
import { AN_LE, LINH_VUC, findAnLe, anLeForDieu, withKho } from '../../assets/js/legal/an-le-catalog.js';
import { parseKhoDoc } from '../../assets/js/legal/court-similar.js';
import { fileNameFrom } from '../../assets/js/lib/net-fetch.js';
import { fmtDate } from '../../assets/js/legal/court-penalty.js';

const text = (doc) => doc.body.map((p) => p.runs.map((r) => r.text).join('')).join('\n');

test('giám đốc thẩm: thời hạn kháng nghị (1 năm bất lợi, 3 năm dân sự), mở phiên tòa 4 tháng, gửi quyết định 10 ngày, chuyển hồ sơ 15 ngày', () => {
  const today = new Date(2026, 9, 28);
  const rec = { cap: 'giam-doc-tham', banAn: { ngayHieuLuc: '2026-03-02' }, khangNghi: {}, moc: { ngayNhanKhangNghi: '2026-09-01' }, gdt: {}, defendants: [{ id: 'd1', hoTen: 'Trần B', nganChan: { loai: 'tam-giam', den: '2026-12-01' } }] };
  let it = computeDeadlines(rec, { today });
  const by = (id) => it.find((x) => x.id === id);
  assert.equal(fmtDate(by('kn-gdt-bat-loi').han), '02/03/2027');
  assert.equal(by('kn-gdt-bat-loi').trangThai, 'moc');
  assert.equal(fmtDate(by('kn-gdt-dan-su').han), '02/03/2029');
  assert.equal(fmtDate(by('phien-toa-gdt').han), '01/01/2027');
  assert.equal(by('phien-toa-gdt').trangThai, 'con');
  // Tạm giam theo lệnh (không phải "tạm giam sau tuyên án" của sơ thẩm).
  assert.equal(by('tam-giam-d1').trangThai, 'con');
  assert.equal(by('gui-qd-gdt'), undefined);
  // Có kháng nghị, đã mở phiên tòa và ra quyết định hủy để xét xử lại.
  Object.assign(rec.khangNghi, { ngay: '2026-08-20' });
  Object.assign(rec.moc, { ngayXetXu: '2026-10-20', ngayTuyenAn: '2026-10-20' });
  rec.gdt.ketQua = 'huy-xet-xu';
  it = computeDeadlines(rec, { today });
  assert.equal(by('kn-gdt-bat-loi').trangThai, 'xong');
  assert.equal(by('phien-toa-gdt').trangThai, 'xong');
  assert.equal(fmtDate(by('gui-qd-gdt').han), '30/10/2026');
  assert.equal(by('gui-qd-gdt').trangThai, 'sap');
  assert.equal(fmtDate(by('chuyen-ho-so-lai').han), '04/11/2026');
  // Không chấp nhận kháng nghị → không có hạn chuyển hồ sơ.
  rec.gdt.ketQua = 'khong-chap-nhan';
  assert.equal(computeDeadlines(rec, { today }).find((x) => x.id === 'chuyen-ho-so-lai'), undefined);
  // Thiếu ngày hiệu lực → báo thiếu, không tính.
  const thieu = computeDeadlines({ cap: 'giam-doc-tham', moc: {}, defendants: [] }, { today });
  assert.equal(thieu.find((x) => x.id === 'kn-gdt-bat-loi').trangThai, 'thieu');
  assert.match(thieu.find((x) => x.id === 'kn-gdt-bat-loi').ghiChu, /ngày bản án bị kháng nghị có hiệu lực/);
  for (const k of ['kn-gdt-bat-loi', 'phien-toa-gdt', 'gui-qd-gdt', 'chuyen-ho-so-lai', 'chuyen-ho-so-gdt']) assert.ok(DEFAULT_RULES[k].canCu.includes('BLTTHS'), k);
});

test('giám đốc thẩm: giá trị tự điền và 5 biểu mẫu', () => {
  const rec = {
    cap: 'giam-doc-tham',
    toa: { ten: 'Tòa án nhân dân tỉnh Ninh Bình', diaDanh: 'Ninh Bình' },
    banAn: { cap: 'phuc-tham', so: '12/2026/HS-PT', ngay: '2026-03-01', toa: 'Tòa án nhân dân tỉnh Ninh Bình', ngayHieuLuc: '2026-03-01' },
    khangNghi: { nguoi: 'ca-tinh', so: '05/2026/KN-HS', ngay: '2026-09-01', cc3: true, noiDung: 'Hủy bản án phúc thẩm để xét xử phúc thẩm lại' },
    hdxx: { hoiDong: 'ubtp-3', chuToa: 'Nguyễn Văn A', thamPhan: 'Lê Thị B\nPhạm Văn C', thuKy: 'Đỗ D', kiemSatVien: 'Vũ E', vks: 'Viện kiểm sát nhân dân tỉnh Ninh Bình' },
    gdt: { ketQua: 'huy-xet-xu' },
    moc: { ngayXetXu: '2026-10-20', diaDiem: 'Trụ sở Tòa án' },
    defendants: [{ hoTen: 'Trần B', namSinh: 1990, toiDanh: [{ dieu: '174', khoan: 2 }], hinhPhat: { loai: 'tu', thang: 30 } }],
  };
  const v = courtValues(rec, { org: {} });
  assert.equal(v.khangNghiNguoi, NGUOI_KN['ca-tinh']);
  assert.equal(v.hoiDong, HOI_DONG_GDT['ubtp-3']);
  assert.equal(v.ketQuaGdt, KET_QUA_GDT['huy-xet-xu']);
  assert.equal(v.banAnCap, 'phúc thẩm');
  assert.equal(v.ngayHieuLuc, '2026-03-01');
  assert.match(v.khangNghiCanCu, /điểm c khoản 1 Điều 371/);
  assert.equal(v.quyetDinh, '');
  assert.equal(v.anPhi, '');
  assert.equal(CAP_FORMS.gdt, 'Giám đốc thẩm');
  const ids = COURT_FORMS.filter((f) => f.cap === 'gdt').map((f) => f.id);
  assert.deepEqual(ids, ['gdt-qd-khang-nghi', 'gdt-thong-bao-khang-nghi', 'gdt-thong-bao-phien-toa', 'gdt-giay-trieu-tap', 'gdt-quyet-dinh']);
  const kn = buildCourtForm('gdt-qd-khang-nghi', v);
  assert.equal(kn.authority, 'CHÁNH ÁN TÒA ÁN NHÂN DÂN CẤP TỈNH');
  assert.match(text(kn), /Kháng nghị Bản án hình sự phúc thẩm số 12\/2026\/HS-PT/);
  assert.match(text(kn), /Điều 371, Điều 373/);
  const qd = buildCourtForm('gdt-quyet-dinh', v);
  assert.equal(qd.title.subject, 'Về vụ án hình sự đối với người bị kết án Trần B');
  assert.equal(qd.header.placeDate, null);
  assert.match(text(qd), /Hủy bản án, quyết định đã có hiệu lực pháp luật để xét xử lại/);
  assert.match(text(qd), /- Thẩm phán: Lê Thị B\./);
  assert.equal(qd.sign.authority, 'TM. HỘI ĐỒNG GIÁM ĐỐC THẨM');
  for (const id of ids) assert.ok(buildCourtForm(id, v).body.length > 2, id);
});

test('danh mục án lệ: 90 án lệ, số duy nhất, đủ đợt công bố, tìm theo số, án lệ hình sự theo điều luật, ghép kho', () => {
  assert.equal(AN_LE.length, 90);
  assert.equal(new Set(AN_LE.map((a) => a.so)).size, 90);
  assert.equal(AN_LE[0].so, '01/2016/AL');
  assert.equal(AN_LE.at(-1).so, '90/2026/AL');
  for (const a of AN_LE) {
    assert.ok(LINH_VUC[a.linhVuc], a.so);
    assert.ok(a.thongQua && a.qdCongBo && a.ngayCongBo, `${a.so} thiếu đợt công bố`);
    assert.ok(a.linhVuc !== 'hs' || a.dieu.length, `${a.so} là án lệ hình sự phải có điều luật`);
  }
  assert.equal(AN_LE.filter((a) => a.linhVuc === 'hs').length, 21);
  assert.match(findAnLe('47/2021/AL').tenNgan, /^Về việc xác định tội danh/);
  assert.equal(findAnLe('Án lệ số 7/2016/AL').so, '07/2016/AL');
  assert.equal(findAnLe('73').qdCongBo, '339a/QĐ-CA');
  assert.equal(findAnLe('99/2030/AL'), null);
  assert.deepEqual(anLeForDieu(['174', '123']).map((a) => a.num), [1, 17, 18, 30, 45, 47, 59, 73, 75]);
  assert.deepEqual(anLeForDieu([]), []);
  const joined = withKho([{ loai: 'an-le', so: '47/2021/AL', text: 'x' }, { loai: 'ban-an', so: '1/2026/HS-ST' }]);
  assert.equal(joined.filter((a) => a.doc).length, 1);
  assert.equal(joined.find((a) => a.so === '47/2021/AL').doc.text, 'x');
});

test('toàn văn án lệ dán vào được đọc số, tên, điều luật; tên tệp tải về theo Content-Disposition / đường dẫn / kiểu', () => {
  const d = parseKhoDoc('ÁN LỆ SỐ 75/2025/AL\nVề thủ đoạn gian dối để trộm cắp tài sản\nQuy định của pháp luật liên quan đến án lệ:\nĐiều 173 Bộ luật Hình sự năm 2015.\n\nKhái quát nội dung của án lệ:\nBị cáo dùng thủ đoạn gian dối để tiếp cận rồi lén lút chiếm đoạt tài sản thì phạm tội trộm cắp tài sản.\n\nGiải pháp pháp lý:\nTrường hợp này, Tòa án phải xác định bị cáo phạm tội trộm cắp tài sản.\n\nQuy định của pháp luật liên quan đến án lệ:\nĐiều 173 Bộ luật Hình sự năm 2015.\n', 'al75.txt');
  assert.equal(d.loai, 'an-le');
  assert.equal(d.so, '75/2025/AL');
  assert.ok(d.dieu.includes('173'));
  assert.equal(fileNameFrom('attachment; filename="ban an 25.pdf"', 'https://x.vn/a'), 'ban an 25.pdf');
  assert.equal(fileNameFrom("attachment; filename*=UTF-8''b%E1%BA%A3n-%C3%A1n.docx", 'https://x.vn/a'), 'bản-án.docx');
  assert.equal(fileNameFrom('', 'https://congbobanan.toaan.gov.vn/files/12-2026-HS-ST.pdf?x=1'), '12-2026-HS-ST.pdf');
  assert.equal(fileNameFrom('', 'https://x.vn/chi-tiet', 'text/html; charset=utf-8'), 'chi-tiet.html');
  assert.equal(fileNameFrom('', 'https://x.vn/', 'application/pdf'), 'tai-ve.pdf');
});
