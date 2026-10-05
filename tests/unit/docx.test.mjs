import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDocx, docxToText, crc32, readZip, safeFileName, buildDocumentXml } from '../../assets/js/lib/docx.js';
import { buildDocument, sampleValues, DOC_TYPES } from '../../assets/js/lib/doc-types.js';

test('crc32 chuẩn', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('docx tạo ra đọc lại được và giữ tiếng Việt', async () => {
  const doc = buildDocument('quyet-dinh', sampleValues('quyet-dinh', '2026-10-05'));
  const bytes = buildDocx(doc, 'Quyết định');
  const zip = await readZip(bytes);
  assert.deepEqual(zip.names.sort(), ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/styles.xml'].sort());
  const text = await docxToText(bytes);
  assert.match(text, /CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/);
  assert.match(text, /Điều 1\./);
  assert.match(text, /Nguyễn Văn An/);
});

test('XML hợp lệ cho mọi loại văn bản (kiểm tra bằng python xml parser)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'docx-'));
  for (const t of DOC_TYPES) {
    const xml = buildDocumentXml(buildDocument(t.id, sampleValues(t.id, '2026-10-05')));
    const f = join(dir, `${t.id}.xml`);
    writeFileSync(f, xml);
    execFileSync('python3', ['-c', 'import sys,xml.dom.minidom as m; m.parse(sys.argv[1])', f]);
  }
});

test('zip hợp lệ với công cụ unzip của hệ thống', () => {
  const dir = mkdtempSync(join(tmpdir(), 'docx-'));
  const f = join(dir, 'a.docx');
  writeFileSync(f, buildDocx(buildDocument('cong-van', sampleValues('cong-van', '2026-10-05'))));
  const out = execFileSync('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(z.testzip()); print(len(z.namelist()))', f]).toString();
  assert.match(out, /None\s+6/);
});

test('đọc docx nén DEFLATE (tạo bằng python zipfile)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'docx-'));
  const f = join(dir, 'b.docx');
  execFileSync('python3', ['-c', `import zipfile,sys
z=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED)
z.writestr('word/document.xml','<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>Xin chào</w:t></w:r><w:r><w:t xml:space="preserve"> Việt Nam &amp; thế giới</w:t></w:r></w:p><w:p><w:r><w:t>Dòng hai</w:t></w:r></w:p></w:body></w:document>')
z.close()`, f]);
  const { readFileSync } = await import('node:fs');
  const text = await docxToText(readFileSync(f));
  assert.equal(text, 'Xin chào Việt Nam & thế giới\nDòng hai');
});

test('tên tệp bỏ dấu', () => {
  assert.equal(safeFileName('Quyết định thành lập Tổ công tác'), 'quyet-dinh-thanh-lap-to-cong-tac.docx');
  assert.equal(safeFileName(''), 'van-ban.docx');
});
