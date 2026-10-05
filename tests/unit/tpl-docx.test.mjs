import test from 'node:test';
import assert from 'node:assert/strict';
import { createZip, docxToText } from '../../assets/js/lib/docx.js';
import { parseTemplateDocx, fillTemplateDocx, detectFields, addField, fieldsFromAi, numberedText, bytesToBase64, base64ToBytes } from '../../assets/js/lib/tpl-docx.js';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const P = (...runs) => `<w:p><w:pPr><w:jc w:val="both"/></w:pPr>${runs.map((r) => (typeof r === 'string' ? `<w:r><w:t xml:space="preserve">${r}</w:t></w:r>` : `<w:r><w:rPr><w:b/></w:rPr><w:t>${r.b}</w:t></w:r>`)).join('')}</w:p>`;

function sampleDocx() {
  const body = [
    P('ỦY BAN NHÂN DÂN PHƯỜNG AN BÌNH'),
    P('Số: 12/TB-UBND'),
    P('An Bình, ngày 05 tháng ', '10 năm 2026'), // ngày tháng tách nhiều nút
    P({ b: 'THÔNG BÁO' }),
    P('Kính gửi: Ông Nguyễn Văn A'),
    P('Họ và tên: ', 'Nguyễn Văn ', 'A', '; Số điện thoại: 0912 345 678'),
    P('Địa chỉ: ……………………'),
    P('Số tiền phải nộp: 1.500.000 đồng. Người nhận: [Tên người nhận]'),
    P('Ông Nguyễn Văn A có trách nhiệm thực hiện.'),
  ].join('');
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr/></w:body></w:document>`;
  const hdr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${W}>${P('Mẫu số 01 &amp; phụ lục')}</w:hdr>`;
  return createZip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
    { name: 'word/document.xml', data: docXml },
    { name: 'word/header1.xml', data: hdr },
  ]);
}

test('đọc đoạn văn từ thân và tiêu đề trang, giải mã ký tự', async () => {
  const t = await parseTemplateDocx(sampleDocx());
  assert.equal(t.paragraphs[0].text, 'Mẫu số 01 & phụ lục');
  assert.equal(t.paragraphs[0].part, 'word/header1.xml');
  assert.ok(t.paragraphs.some((p) => p.text === 'An Bình, ngày 05 tháng 10 năm 2026'));
  assert.equal(t.paragraphs.find((p) => p.text === 'THÔNG BÁO').bold, true);
  assert.match(numberedText(t.paragraphs), /^\[0\] Mẫu số 01/);
});

test('nhận diện trường bằng quy tắc', async () => {
  const t = await parseTemplateDocx(sampleDocx());
  const f = detectFields(t.paragraphs);
  const by = (l) => f.find((x) => x.label === l);
  assert.equal(by('Số, ký hiệu văn bản').find, '12/TB-UBND');
  assert.equal(by('Địa danh, ngày tháng năm').find, 'An Bình, ngày 05 tháng 10 năm 2026');
  assert.equal(by('Kính gửi').find, 'Ông Nguyễn Văn A');
  assert.equal(by('Họ và tên').find, 'Nguyễn Văn A');
  assert.equal(by('Số điện thoại').find, '0912 345 678');
  assert.equal(by('Địa chỉ').find, '……………………');
  assert.equal(by('Số tiền').find, '1.500.000 đồng');
  assert.equal(by('Tên người nhận').find, '[Tên người nhận]');
});

test('điền mẫu: thay qua nhiều nút chữ, giữ định dạng, mọi lần xuất hiện, trường trống giữ nguyên', async () => {
  const buf = sampleDocx();
  const t = await parseTemplateDocx(buf);
  const fields = detectFields(t.paragraphs);
  const kg = fields.find((x) => x.label === 'Kính gửi');
  assert.equal(kg.locs.length, 2, 'chuỗi lặp lại được thay ở mọi nơi');
  const out = await fillTemplateDocx(buf, fields, {
    'so-ky-hieu-van-ban': '45/TB-UBND',
    'dia-danh-ngay-thang-nam': 'An Bình, ngày 20 tháng 11 năm 2026',
    'ho-va-ten': 'Trần Thị B',
    'dia-chi': 'Số 3 phố Huế, <Hà Nội> & lân cận',
  });
  const text = await docxToText(out);
  assert.match(text, /Số: 45\/TB-UBND/);
  assert.match(text, /An Bình, ngày 20 tháng 11 năm 2026/);
  assert.match(text, /Họ và tên: Trần Thị B; Số điện thoại: 0912 345 678/);
  assert.match(text, /Ông Nguyễn Văn A có trách nhiệm/);
  assert.match(text, /Địa chỉ: Số 3 phố Huế, <Hà Nội> & lân cận/);
  assert.match(text, /Kính gửi: Ông Nguyễn Văn A/); // trường Kính gửi chưa điền
  assert.match(text, /1\.500\.000 đồng/);
  const t2 = await parseTemplateDocx(out);
  assert.equal(t2.paragraphs.find((p) => p.text === 'THÔNG BÁO').bold, true);
  assert.equal(t2.paragraphs[0].text, 'Mẫu số 01 & phụ lục');
});

test('kết quả AI được kiểm chứng với văn bản thật; trường trùng vị trí bị loại', async () => {
  const t = await parseTemplateDocx(sampleDocx());
  const base = [];
  addField(base, t.paragraphs, { label: 'Số văn bản', find: '12/TB-UBND' });
  const { fields, added } = fieldsFromAi(t.paragraphs, {
    truong: [
      { label: 'Người nhận', find: 'Ông Nguyễn Văn A', para: 5, hint: 'Họ tên người nhận' },
      { label: 'Bịa đặt', find: 'không có trong văn bản', para: 2 },
      { label: 'Trùng', find: '12/TB-UBND', para: 2 },
    ],
  }, base);
  assert.equal(added.length, 1);
  assert.equal(fields.length, 2);
  assert.equal(added[0].hint, 'Họ tên người nhận');
});

test('base64 hai chiều', () => {
  const b = new Uint8Array(70000).map((_, i) => i % 251);
  assert.deepEqual(base64ToBytes(bytesToBase64(b)), b);
});
