import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FORMS, STAGES, FIELDS, formKeys, findForm } from '../../assets/js/legal/forms-catalog.js';
import { buildFormDocument, fill, prefillFromCase, nhanThanText } from '../../assets/js/legal/forms-build.js';
import { renderDocumentHtml } from '../../assets/js/lib/render-html.js';
import { buildDocx, buildDocumentXml, docxToText } from '../../assets/js/lib/docx.js';

const ORG = { coQuanCapTren: 'Công an tỉnh Ninh Bình', coQuan: 'Cơ quan Cảnh sát điều tra', kyHieu: 'CSĐT', diaDanh: 'Ninh Bình', quyenKy: 'KT. THỦ TRƯỞNG', chucVuKy: 'Phó Thủ trưởng', nguoiKy: 'Nguyễn Văn Nam', thongTu: 'TT số 128/2025/TT-BCA ngày 19/12/2025' };

test('danh mục biểu mẫu: trên 120 mẫu, đủ giai đoạn, id không trùng, mọi chỗ điền đều có định nghĩa', () => {
  assert.ok(FORMS.length >= 120, `chỉ có ${FORMS.length} mẫu`);
  assert.equal(new Set(FORMS.map((f) => f.id)).size, FORMS.length);
  for (const s of STAGES) assert.ok(FORMS.some((f) => f.giaiDoan === s.id), `giai đoạn ${s.id} rỗng`);
  for (const f of FORMS) {
    for (const m of JSON.stringify(f).matchAll(/\{([a-zA-Z0-9]+)\}/g)) assert.ok(FIELDS[m[1]], `${f.id}: thiếu định nghĩa trường {${m[1]}}`);
    assert.ok(formKeys(f).length >= 1, f.id);
  }
});

test('mọi biểu mẫu dựng được bản xem trước và tệp Word hợp lệ (XML đúng cú pháp)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forms-'));
  const files = [];
  for (const f of FORMS) {
    const doc = buildFormDocument(f, { hoTen: 'Nguyễn Văn A', vks: 'tỉnh Ninh Bình', ngayVb: '2026-10-05', noiDung: 'Dòng 1\nHỏi: câu hỏi?\nĐáp: trả lời.' }, ORG);
    assert.ok(renderDocumentHtml(doc).includes('vb-page'), f.id);
    const p = join(dir, `${f.id}.xml`);
    writeFileSync(p, buildDocumentXml(doc));
    files.push(p);
    buildDocx(doc);
  }
  execFileSync('python3', ['-c', 'import sys,xml.dom.minidom as m\n[m.parse(p) for p in sys.argv[1:]]', ...files]);
});

test('quyết định: thể thức số hiệu, thẩm quyền, căn cứ, Xét thấy, các Điều, nơi nhận, người ký', async () => {
  const f = findForm('qd-khoi-to-vu-an');
  const doc = buildFormDocument(f, { so: '15', tenVu: 'Tham ô tài sản tại Công ty X', toiDanh: 'Tham ô tài sản quy định tại Điều 353 Bộ luật Hình sự', noiXayRa: 'phường A', thoiGianXayRa: 'năm 2025', tomTat: 'Kết quả xác minh xác định ông B chiếm đoạt 2 tỷ đồng.', vks: 'tỉnh Ninh Bình', ngayVb: '2026-10-05', mauSo: '02' }, ORG);
  const text = await docxToText(buildDocx(doc));
  assert.match(text, /Số: 15\/QĐ-CSĐT/);
  assert.match(text, /Ninh Bình, ngày 05 tháng 10 năm 2026/);
  assert.match(text, /QUYẾT ĐỊNH\nKhởi tố vụ án hình sự/);
  assert.match(text, /THỦ TRƯỞNG CƠ QUAN CẢNH SÁT ĐIỀU TRA CÔNG AN TỈNH NINH BÌNH/);
  assert.match(text, /Căn cứ Điều 36, Điều 143, Điều 153, Điều 154 Bộ luật Tố tụng hình sự\./);
  assert.match(text, /Xét thấy: Kết quả xác minh .* Hành vi trên có dấu hiệu tội Tham ô tài sản quy định tại Điều 353 Bộ luật Hình sự\./);
  assert.match(text, /Điều 1\. Khởi tố vụ án hình sự: Tham ô tài sản tại Công ty X, xảy ra tại phường A/);
  assert.match(text, /Điều 3\. Điều tra viên được phân công/);
  assert.match(text, /- Viện kiểm sát nhân dân tỉnh Ninh Bình;/);
  assert.match(text, /KT\. THỦ TRƯỞNG\nPHÓ THỦ TRƯỞNG/);
  assert.match(text, /Mẫu số: 02/);
});

test('lệnh có ô phê chuẩn của Viện kiểm sát; giấy triệu tập; biên bản bố cục biểu mẫu; kết luận điều tra', async () => {
  const lenh = await docxToText(buildDocx(buildFormDocument(findForm('lenh-bat-tam-giam'), { vks: 'tỉnh Ninh Bình' }, ORG)));
  assert.match(lenh, /Số: +\/LBTG-CSĐT/);
  assert.match(lenh, /PHÊ CHUẨN CỦA VIỆN KIỂM SÁT NHÂN DÂN TỈNH NINH BÌNH/);
  const gtt = await docxToText(buildDocx(buildFormDocument(findForm('giay-trieu-tap-lam-chung'), { hoTen: 'Trần Thị B', diaDiemHen: 'Trụ sở Cơ quan CSĐT', gioHen: '08 giờ 00', ngayHen: '10/10/2026' }, ORG)));
  assert.match(gtt, /GIẤY TRIỆU TẬP\nNgười làm chứng/);
  assert.match(gtt, /Căn cứ Điều 185 Bộ luật Tố tụng hình sự, Cơ quan yêu cầu: Ông\/Bà Trần Thị B/);
  assert.match(gtt, /Điều 127/);
  const bb = buildFormDocument(findForm('bb-kham-xet'), { thanhPhan: 'Lê Văn C — Điều tra viên\nPhạm D — Cán bộ điều tra', noiDung: 'Thu giữ 01 điện thoại.', gioBatDau: '09:00', gioKetThuc: '10:30', ngayVb: '2026-10-05', mauSo: '75' }, ORG);
  assert.equal(bb.layout, 'form');
  const bbText = await docxToText(buildDocx(bb));
  assert.match(bbText, /BIÊN BẢN KHÁM XÉT/);
  assert.match(bbText, /Hồi 9 giờ 00 phút ngày 5 tháng 10 năm 2026/);
  assert.match(bbText, /- Lê Văn C — Điều tra viên;/);
  assert.match(bbText, /kết thúc hồi 10 giờ 30 phút/);
  assert.match(bbText, /Mẫu số: 75/);
  assert.equal(bb.signers.find((s) => s.title === 'ĐIỀU TRA VIÊN').name, 'Lê Văn C');
  const kl = await docxToText(buildDocx(buildFormDocument(findForm('kl-de-nghi-truy-to'), { dienBien: 'Đoạn 1\nĐoạn 2' }, ORG)));
  assert.match(kl, /BẢN KẾT LUẬN ĐIỀU TRA VỤ ÁN HÌNH SỰ\nĐề nghị truy tố/);
  assert.match(kl, /I\. DIỄN BIẾN HÀNH VI PHẠM TỘI\nĐoạn 1\nĐoạn 2/);
});

test('điền chỗ trống, tự điền từ hồ sơ vụ án và người tham gia tố tụng', () => {
  assert.equal(fill('Ông {hoTen}, {nhanThan}', { hoTen: 'A' }), 'Ông A, …………');
  assert.equal(fill('{doVat}', { doVat: 'x\ny' }), 'x; y');
  const v = prefillFromCase({
    caseItem: { ten: 'Vụ tham ô tại Công ty X', toiDanh: ['353'] },
    person: { hoTen: 'Nguyễn Văn Bình', roleId: 'bi-can', ngaySinh: '01/02/1980', noiCuTru: 'Hà Nội', soDinhDanh: '001' },
    org: { vks: 'tỉnh Ninh Bình', dieuTraVien: 'Trần Minh Đức' },
  });
  assert.equal(v.tenVu, 'Vụ tham ô tại Công ty X');
  assert.equal(v.toiDanh, 'tham ô tài sản quy định tại Điều 353 Bộ luật Hình sự');
  assert.equal(v.hoTen, 'Nguyễn Văn Bình');
  assert.match(v.nhanThan, /sinh ngày: 01\/02\/1980; số định danh cá nhân: 001; nơi thường trú: Hà Nội/);
  assert.equal(v.quanHe, 'Bị can');
  assert.equal(v.dtv, 'Trần Minh Đức — Điều tra viên');
  assert.equal(nhanThanText({}), '');
});
