import test from 'node:test';
import assert from 'node:assert/strict';
import { createZip, docxToText, readZip } from '../../assets/js/lib/docx.js';
import { W, run, para, DOTS, templateDocx, indexDocx } from '../fixtures/mau-synth.mjs';
import { parseTemplateDocx, scanPart } from '../../assets/js/lib/tpl-docx.js';
import { fillMauDocx } from '../../assets/js/lib/mau-docx.js';
import { analyzeMau, isFrameForm, loaiOf } from '../../assets/js/legal/mau-analyze.js';
import { buildPack, readPack, mauDb, mauOps, mauPrefill, matchMau, parseDate, fillMau, parseIndex } from '../../assets/js/legal/mau-pack.js';

const find = (a, key) => a.fields.find((f) => f.key === key);

test('đọc đoạn tab dẫn chấm và nút xuống dòng không bị nhầm là chữ đậm', async () => {
  const doc = templateDocx();
  const t = await parseTemplateDocx(doc);
  assert.ok(!t.paragraphs.some((p) => p.text === '\t'), 'mặc định bỏ đoạn chỉ có tab');
  const t2 = await parseTemplateDocx(doc, { blankLeader: true });
  assert.ok(t2.paragraphs.filter((p) => p.text === '\t').length >= 2);
  const paras = scanPart('<w:p><w:r><w:t>a</w:t><w:br/><w:t>b</w:t></w:r></w:p>');
  assert.equal(paras[0].bold, false);
  assert.equal(paras[0].nodes.map((n) => n.text).join(''), 'a\nb');
});

test('nhận diện cơ quan, số, ngày, người, tội danh và dòng chấm nối tiếp', async () => {
  const t = await parseTemplateDocx(templateDocx(), { blankLeader: true });
  const a = analyzeMau(t.paragraphs);
  assert.ok(find(a, 'coQuanCapTren') && find(a, 'coQuan'), 'hai dòng chấm đầu mẫu');
  assert.equal(find(a, 'so').kind, 'text');
  assert.ok(find(a, 'kyHieuCq'));
  assert.ok(find(a, 'diaDanh'));
  const ngay = find(a, 'ngayVb');
  assert.deepEqual(ngay.slots.map((s) => s.role), ['d', 'm', 'y']);
  assert.equal(ngay.kind, 'date');
  // Giờ – ngày của đoạn "Hồi … giờ … ngày …".
  const gio = a.fields.find((f) => f.kind === 'time');
  assert.deepEqual(gio.slots.map((s) => s.role), ['h', 'min']);
  // Họ tên mở một người; thuộc tính đi theo người đó.
  assert.equal(a.persons.length, 1);
  assert.ok(find(a, 'p0.hoTen') && find(a, 'p0.gioiTinh') && find(a, 'p0.ngaySinh') && find(a, 'p0.noiSinh') && find(a, 'p0.ngheNghiep'));
  assert.equal(find(a, 'p0.ngaySinh').kind, 'date');
  // "Điều … Bộ luật Hình sự" → điều luật.
  assert.ok(find(a, 'dieuBLHS'));
  // "Căn cứ \t" + hai dòng tab trống → một trường, các dòng sau bị bỏ khi điền.
  const canCu = a.fields.find((f) => f.label === 'Căn cứ');
  assert.equal(canCu.kind, 'long');
  assert.equal(canCu.slots.length, 3);
  assert.deepEqual(canCu.slots.map((s) => !!s.drop), [false, true, true]);
  // Chức danh người ký lấy theo chú thích (1).
  assert.equal(find(a, 'chucDanhKy').slots.length, 1);
  // Danh sách "1.", "2." → một trường nhiều dòng.
  const ds = a.fields.find((f) => f.kind === 'lines');
  assert.equal(ds.slots.length, 2);
  // Dòng chấm kẻ cuối mẫu (trước chú thích) không phải chỗ điền.
  const deco = t.paragraphs.find((p) => p.text === '.'.repeat(80));
  assert.ok(!a.fields.some((f) => f.slots.some((s) => s.i === deco.i)));
  // Chú thích: 2 đoạn ở cuối và các dấu (1), (2) trong thân.
  assert.equal(a.notes.count, 2);
  assert.equal(a.notes.paras.length, 2);
  assert.equal(a.notes.marks.length, 2);
});

test('chú thích nằm ở chân trang cũng được nhận ra', async () => {
  const doc = templateDocx('', para(run('(1) Cơ quan, tổ chức;', 16)), false);
  const t = await parseTemplateDocx(doc, { blankLeader: true });
  const a = analyzeMau(t.paragraphs);
  assert.equal(a.notes.paras.length, 1);
  assert.ok(a.notes.paras[0].part.includes('footer'));
});

test('mẫu khung/bảng chỉ lấy phần đầu mẫu; phân loại theo tên', () => {
  assert.equal(isFrameForm('Bìa hồ sơ'), true);
  assert.equal(isFrameForm('Sơ đồ hiện trường'), true);
  assert.equal(isFrameForm('Quyết định khởi tố vụ án hình sự'), false);
  assert.equal(loaiOf('Quyết định khởi tố vụ án hình sự'), 'qd');
  assert.equal(loaiOf('Biên bản bắt người'), 'bb');
  assert.equal(loaiOf('Lệnh khám xét'), 'lenh');
  assert.equal(loaiOf('Thông báo về việc tạm giữ'), 'tb');
});

test('điền mẫu: thay đúng chỗ chấm, cỡ chữ theo thân văn bản, bỏ chú thích; phần còn lại giữ nguyên', async () => {
  const doc = templateDocx();
  const t = await parseTemplateDocx(doc, { blankLeader: true });
  const form = { id: 'm1', so: '1', ten: 'Mẫu thử', fields: analyzeMau(t.paragraphs).fields, notes: analyzeMau(t.paragraphs).notes };
  const values = {
    coQuan: 'CƠ QUAN ĐIỀU TRA',
    so: '12',
    kyHieuCq: 'PC01',
    diaDanh: 'Ninh Bình',
    ngayVb: '2026-03-05',
    chucDanhKy: 'THỦ TRƯỞNG',
    'p0.hoTen': 'Nguyễn Văn An',
    'p0.gioiTinh': 'Nam',
    'p0.ngaySinh': '1971-05-26',
    'p0.noiSinh': 'Ninh Bình',
    dieuBLHS: '353',
  };
  const canCu = form.fields.find((f) => f.label === 'Căn cứ');
  values[canCu.key] = 'quy định của pháp luật';
  const out = await fillMau(form, doc, values, { stripNotes: true });
  const text = await docxToText(out);
  assert.match(text, /CƠ QUAN ĐIỀU TRA/);
  assert.match(text, /Số: 12 \/QĐ- PC01/);
  assert.match(text, /Ninh Bình, ngày 05 tháng 3 năm 2026/);
  assert.match(text, /Họ tên: Nguyễn Văn An Giới tính: Nam/);
  assert.match(text, /Sinh ngày 26 tháng 5 năm 1971 tại: Ninh Bình/);
  assert.match(text, /Điều 353 Bộ luật Hình sự/);
  assert.match(text, /Căn cứ quy định của pháp luật/);
  assert.doesNotMatch(text, /\(1\) Chức danh|\(2\) Căn cứ vào/, 'đoạn chú thích bị bỏ');
  assert.doesNotMatch(text, /Điều ?\(2\)/, 'dấu chú thích bị bỏ');
  // Dòng chấm thừa của trường "Căn cứ" bị bỏ, trường chưa điền giữ nguyên dòng chấm.
  const t2 = await parseTemplateDocx(out, { blankLeader: true });
  assert.ok(t2.paragraphs.length < t.paragraphs.length);
  assert.match(text, /Nghề nghiệp:/);
  assert.ok(t2.paragraphs.some((p) => /^Hồi \.\.\.\./.test(p.text)), 'giờ chưa điền giữ nguyên chấm');
  // Cỡ chữ: chữ điền vào lấy cỡ thân văn bản (26), không phải cỡ 8pt của dòng chấm.
  const xml = new TextDecoder().decode(await (await (await import('../../assets/js/lib/docx.js')).readZip(out)).read('word/document.xml'));
  const sizeOf = (txt) => new RegExp(`<w:r><w:rPr><w:sz w:val="(\\d+)"/><w:szCs w:val="(\\d+)"/></w:rPr><w:t xml:space="preserve">${txt}</w:t>`).exec(xml)?.[1];
  assert.equal(sizeOf('Nguyễn Văn An'), '26', 'chữ điền lấy cỡ thân văn bản');
  assert.equal(sizeOf('CƠ QUAN ĐIỀU TRA'), '24', 'dòng đầu mẫu (cột hẹp) cỡ 12pt');
  // Dùng "giữ chú thích": chú thích còn nguyên.
  const keep = await fillMau(form, doc, {}, { stripNotes: false });
  assert.match(await docxToText(keep), /\(1\) Chức danh tư pháp/);
  // Không có giá trị và không bỏ chú thích → tệp giống hệt về nội dung văn bản.
  assert.equal(await docxToText(keep), await docxToText(doc));
});

test('chân trang chỉ chứa chú thích: xóa chữ nhưng giữ đoạn (tệp Word vẫn hợp lệ)', async () => {
  const doc = templateDocx('', para(run('(1) Cơ quan, tổ chức;', 16)), false);
  const t = await parseTemplateDocx(doc, { blankLeader: true });
  const a = analyzeMau(t.paragraphs);
  const out = await fillMauDocx(doc, [], a.notes.paras);
  const { readZip } = await import('../../assets/js/lib/docx.js');
  const zip = await readZip(out);
  const ftr = new TextDecoder().decode(await zip.read('word/footer1.xml'));
  assert.match(ftr, /<w:p>/);
  assert.doesNotMatch(ftr, /Cơ quan, tổ chức/);
});

test('ngày, giờ, danh sách nhiều dòng và xuống dòng trong trường dài', () => {
  const form = {
    fields: [
      { key: 'd', kind: 'date', slots: [{ part: 'p', i: 0, s: 0, e: 1, role: 'd' }, { part: 'p', i: 0, s: 2, e: 3, role: 'm' }, { part: 'p', i: 0, s: 4, e: 5, role: 'y' }] },
      { key: 't', kind: 'time', slots: [{ part: 'p', i: 1, s: 0, e: 1, role: 'h' }, { part: 'p', i: 1, s: 2, e: 3, role: 'min' }] },
      { key: 'l', kind: 'lines', slots: [{ part: 'p', i: 2, s: 0, e: 1 }, { part: 'p', i: 3, s: 0, e: 1 }] },
      { key: 'x', kind: 'text', slots: [{ part: 'p', i: 4, s: 0, e: 1, sp: 1, sa: 1 }] },
    ],
  };
  const { ops } = mauOps(form, { d: '2026-10-05', t: '08:05', l: 'Một\nHai\nBa', x: 'a\nb' });
  assert.deepEqual(ops.slice(0, 3).map((o) => o.value), ['05', '10', '2026']);
  assert.deepEqual(ops.slice(3, 5).map((o) => o.value), ['8', '05']);
  assert.equal(ops[5].value, 'Một');
  assert.equal(ops[6].value, 'Hai; Ba', 'dòng dư gộp vào mục cuối');
  assert.equal(ops[7].value, ' a, b ', 'khoảng cách với chữ liền kề; trường ngắn nối dòng bằng dấu phẩy');
  assert.deepEqual(parseDate('26/05/1971'), { d: 26, m: 5, y: 1971 });
  assert.deepEqual(parseDate('2026-10-05'), { y: 2026, m: 10, d: 5 });
  assert.equal(parseDate('không rõ'), null);
  // Ngày không đúng dạng → ghi nguyên văn vào chỗ đầu tiên, xóa chấm các chỗ còn lại.
  const odd = mauOps(form, { d: 'khoảng năm 1990' }).ops;
  assert.deepEqual(odd.map((o) => o.value), ['khoảng năm 1990', '', '']);
});

test('tự điền từ cơ quan, vụ án, người; số văn bản luôn để trống', () => {
  const form = { fields: ['coQuanCapTren', 'coQuan', 'so', 'kyHieuCq', 'diaDanh', 'ngayVb', 'vks', 'toiTen', 'dieuBLHS', 'tenVu', 'p0.hoTen', 'p0.ngaySinh', 'p1.hoTen', 'dtv', 'coQuanDT'].map((key) => ({ key, kind: 'text', slots: [] })) };
  const org = { coQuanCapTren: 'Công an tỉnh A', coQuan: 'Cơ quan CSĐT', kyHieu: 'PC01', diaDanh: 'A', vks: 'tỉnh A', dieuTraVien: 'Trần Minh Đức', chucDanh: 'Điều tra viên' };
  const v = mauPrefill(form, {
    org,
    caseItem: { ten: 'Vụ A', toiDanh: ['353'] },
    persons: [{ hoTen: 'Nguyễn Văn An', ngaySinh: '26/05/1971' }, null],
    findCrime: () => ({ ten: 'Tội tham ô tài sản', dieu: 353 }),
    now: new Date(2026, 9, 5),
  });
  assert.equal(v.coQuanCapTren, 'CÔNG AN TỈNH A');
  assert.equal(v.coQuan, 'CƠ QUAN CSĐT');
  assert.equal(v.so, undefined);
  assert.equal(v.kyHieuCq, 'PC01');
  assert.equal(v.ngayVb, '2026-10-05');
  assert.equal(v.toiTen, 'tham ô tài sản');
  assert.equal(v.dieuBLHS, '353');
  assert.equal(v.tenVu, 'Vụ A');
  assert.equal(v['p0.hoTen'], 'Nguyễn Văn An');
  assert.equal(v['p0.ngaySinh'], '1971-05-26');
  assert.equal(v['p1.hoTen'], undefined);
  assert.equal(v.dtv, 'Trần Minh Đức, Điều tra viên');
  assert.equal(v.coQuanDT, 'CSĐT');
});

test('tìm mẫu theo số hoặc tên (không dấu)', () => {
  const f = { so: '27', ten: 'Quyết định khởi tố vụ án hình sự' };
  assert.ok(matchMau(f, '27'));
  assert.ok(matchMau(f, 'mẫu 27'));
  assert.ok(!matchMau({ so: '127', ten: 'Lệnh khám xét' }, '27'), 'gõ số mẫu chỉ khớp đúng số');
  assert.ok(matchMau(f, 'khoi to'));
  assert.ok(matchMau({ so: '02A', ten: 'x' }, '2a'));
});

test('dựng gói từ thư mục Word, đọc lại, lưu trên máy và báo mẫu còn thiếu', async () => {
  const files = [
    { name: '2. Danh mục 315 mẫu.docx', data: indexDocx() },
    { name: '27. Quyết định mẫu thử.docx', data: templateDocx() },
    { name: '2A. Biên bản mẫu thử.docx', data: templateDocx() },
    { name: '300. Biên bản nhóm hai.docx', data: templateDocx() },
  ];
  const { bytes, report, missing, meta } = await buildPack(files);
  assert.equal(report.length, 3);
  assert.deepEqual(missing.map((m) => m.so), ['294']);
  assert.equal(meta.forms.find((f) => f.id === 'm27').nhom, 1);
  assert.equal(meta.forms.find((f) => f.id === 'm300').nhom, 2, 'nhóm lấy theo tiêu đề nhóm trong Danh mục');
  assert.equal(meta.forms.find((f) => f.id === 'm300').stt, 2);
  assert.equal(missing[0].nhom, 2);
  assert.equal(meta.forms.find((f) => f.id === 'm2a').xa, true);
  assert.equal(meta.forms.find((f) => f.id === 'm27').xa, false);
  assert.equal(meta.forms.find((f) => f.id === 'm27').loai, 'qd');
  assert.equal(meta.forms.find((f) => f.id === 'm2a').loai, 'bb');
  const pack = await readPack(bytes);
  assert.equal(pack.meta.count, 3);
  assert.ok(pack.files.m27.length > 100);
  await mauDb.save(pack);
  assert.equal((await mauDb.meta()).count, 3);
  assert.ok((await mauDb.docx('m27')).length > 100);
  await mauDb.clear();
  assert.equal(await mauDb.meta(), null);
  assert.ok(parseIndex(await (async () => (await parseTemplateDocx(indexDocx())).paragraphs)()).xa.includes('294'));
  await assert.rejects(() => readPack(templateDocx()), /mau-pack\.json/);
});

test('chú thích dạng footnote của Word: bỏ dấu tham chiếu và nội dung chú thích', async () => {
  const W2 = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const body = para(run('Tiêu đề ', 26) + run('(', 26) + '<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="2"/></w:r>' + run(')', 26)) + para(run('(1)', 16) + run('.....', 16));
  const notes = `<w:footnotes ${W2}><w:footnote w:type="separator" w:id="0"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:id="2"><w:p><w:r><w:footnoteRef/></w:r>${run('(1) Ghi chú thử', 16)}</w:p></w:footnote></w:footnotes>`;
  const doc = createZip([
    { name: '[Content_Types].xml', data: '<Types/>' },
    { name: 'word/document.xml', data: `<w:document ${W2}><w:body>${body}</w:body></w:document>` },
    { name: 'word/footnotes.xml', data: notes },
  ]);
  const t = await parseTemplateDocx(doc, { blankLeader: true });
  const a = analyzeMau(t.paragraphs);
  assert.equal(a.notes.count, 1, 'nhận ra chú thích trong footnotes.xml');
  const form = { id: 'x', fields: a.fields, notes: a.notes };
  const out = await fillMau(form, doc, {}, { stripNotes: true });
  const zip = await readZip(out);
  const d = new TextDecoder().decode(await zip.read('word/document.xml'));
  const f = new TextDecoder().decode(await zip.read('word/footnotes.xml'));
  assert.doesNotMatch(d, /footnoteReference/);
  assert.doesNotMatch(await docxToText(out), /\(\)/, 'không còn cặp ngoặc rỗng');
  assert.doesNotMatch(f, /Ghi chú thử/);
  assert.match(f, /w:type="separator"/, 'giữ dòng phân cách');
  const keep = await fillMau(form, doc, {}, { stripNotes: false });
  assert.match(new TextDecoder().decode(await (await readZip(keep)).read('word/footnotes.xml')), /Ghi chú thử/);
});

test('đoạn căn đều hai bên: xuống dòng được nối bằng dấu chấm phẩy để không giãn chữ', () => {
  const form = { fields: [{ key: 'a', kind: 'long', slots: [{ part: 'p', i: 0, s: 0, e: 1, j: 1 }] }, { key: 'b', kind: 'long', slots: [{ part: 'p', i: 1, s: 0, e: 1 }] }] };
  const { ops } = mauOps(form, { a: 'Một\nHai.\nBa', b: 'Một\nHai' });
  assert.equal(ops[0].value, 'Một; Hai. Ba');
  assert.equal(ops[1].value, 'Một\nHai', 'đoạn không căn đều giữ xuống dòng thật');
});
