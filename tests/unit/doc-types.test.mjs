import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOC_TYPES, buildDocument, documentToText, validate, sampleValues, buildNumber, getDocType, textToParagraphs } from '../../assets/js/lib/doc-types.js';
import { formatAdminDate } from '../../assets/js/lib/vn-date.js';
import { renderDocumentHtml, escapeHtml } from '../../assets/js/lib/render-html.js';

test('ngày tháng theo NĐ 30: thêm số 0 cho ngày < 10 và tháng 1, 2', () => {
  assert.equal(formatAdminDate('2026-02-05', 'Hà Nội'), 'Hà Nội, ngày 05 tháng 02 năm 2026');
  assert.equal(formatAdminDate('2026-03-05'), 'ngày 05 tháng 3 năm 2026');
  assert.equal(formatAdminDate('2026-12-25', 'Huế'), 'Huế, ngày 25 tháng 12 năm 2026');
  assert.equal(formatAdminDate('2026-01-15'), 'ngày 15 tháng 01 năm 2026');
});

test('số, ký hiệu văn bản', () => {
  assert.equal(buildNumber(getDocType('quyet-dinh'), { so: '12', vietTat: 'ubnd' }), 'Số: 12/QĐ-UBND');
  assert.equal(buildNumber(getDocType('cong-van'), { so: '7', vietTat: 'UBND', donVi: 'vp' }), 'Số: 7/UBND-VP');
  assert.match(buildNumber(getDocType('to-trinh'), { vietTat: 'SYT' }), /^Số: \s+\/TTr-SYT$/);
});

for (const t of DOC_TYPES) {
  test(`mẫu ${t.name} hợp lệ và dựng được văn bản`, () => {
    const v = sampleValues(t.id, '2026-10-05');
    assert.deepEqual(validate(t.id, v), []);
    const doc = buildDocument(t.id, v);
    const text = documentToText(doc);
    assert.match(text, /CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/);
    assert.match(text, /Độc lập - Tự do - Hạnh phúc/);
    assert.match(text, /Hà Nội, ngày 05 tháng 10 năm 2026/);
    const html = renderDocumentHtml(doc);
    assert.match(html, /class="vb-page"/);
    if (t.id !== 'cong-van') assert.ok(doc.title.name.length > 0);
  });
}

test('thiếu trường bắt buộc', () => {
  const missing = validate('cong-van', {}).map((m) => m.key);
  assert.ok(missing.includes('coQuan') && missing.includes('noiDung') && missing.includes('kinhGui'));
});

test('công văn: trích yếu V/v, kính gửi, kết thúc ./.', () => {
  const doc = buildDocument('cong-van', { ...sampleValues('cong-van', '2026-10-05'), trichYeu: 'V/v tổ chức tập huấn' });
  assert.equal(doc.header.subject, 'V/v tổ chức tập huấn');
  assert.equal(doc.recipients.length, 2);
  const last = doc.body.at(-1).runs.at(-1).text;
  assert.ok(last.endsWith('./.'));
});

test('quyết định: căn cứ nghiêng, Điều đánh số, QUYẾT ĐỊNH:', () => {
  const doc = buildDocument('quyet-dinh', sampleValues('quyet-dinh', '2026-10-05'));
  const texts = doc.body.map((p) => p.runs.map((r) => r.text).join(''));
  assert.ok(texts[0].startsWith('Căn cứ') && texts[0].endsWith(';'));
  assert.ok(doc.body[0].runs[0].italic);
  assert.ok(texts.includes('QUYẾT ĐỊNH:'));
  assert.ok(texts.some((t) => t.startsWith('Điều 1. ')));
  assert.ok(texts.some((t) => t.startsWith('Điều 3. ')));
  assert.equal(doc.sign.authority, 'TM. ỦY BAN NHÂN DÂN');
});

test('biên bản: chữ ký hai bên', () => {
  const doc = buildDocument('bien-ban', sampleValues('bien-ban', '2026-10-05'));
  assert.equal(doc.sign, null);
  assert.equal(doc.dualSign.left.title, 'THƯ KÝ');
  assert.match(renderDocumentHtml(doc), /Trần Thị Bình/);
});

test('nhận diện đề mục để in đậm', () => {
  const ps = textToParagraphs('I. MỤC ĐÍCH\nNội dung thường.\n1. Ý thứ nhất');
  assert.equal(ps[0].runs[0].bold, true);
  assert.equal(ps[1].runs[0].bold, undefined);
  assert.equal(ps[2].runs[0].bold, true);
});

test('chống chèn mã HTML', () => {
  assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;');
  const doc = buildDocument('thong-bao', { ...sampleValues('thong-bao', '2026-10-05'), noiDung: '<img src=x onerror=alert(1)>' });
  assert.ok(!renderDocumentHtml(doc).includes('<img'));
});
