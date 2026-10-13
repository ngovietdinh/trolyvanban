import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { docToText, docToDocx, sniffDoc, rtfToText, cleanWordText, textToDocx } from '../../assets/js/lib/doc.js';
import { docxToText } from '../../assets/js/lib/docx.js';
import { wordToText } from '../../assets/js/lib/extract.js';
import { parsePastedQa } from '../../assets/js/legal/record.js';
import { parseRecordText } from '../../assets/js/legal/tracking.js';

const fx = (n) => readFileSync(new URL(`../fixtures/doc/${n}`, import.meta.url));

test('.doc Word 97-2003 (Unicode, có bảng) → văn bản đúng nguyên văn, bảng thành dòng có tab', async () => {
  const t = await docToText(fx('bien-ban.doc'), 'bien-ban.doc');
  assert.match(t, /^CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nBIÊN BẢN GHI LỜI KHAI/);
  assert.match(t, /\nHọ tên\tNguyễn Văn An\nChức vụ\tKế toán trưởng\n/);
  assert.ok(t.includes('Đáp: Tôi chuyển 1.250.000.000 đồng vào tài khoản của Trần Thị Bình.'));
  const r = parseRecordText(t, parsePastedQa);
  assert.equal(r.pairs.length, 2);
  assert.equal(r.pairs[1].a, 'Giám đốc Lê Văn Cường chỉ đạo.');
  assert.equal(r.ngay, '2026-03-05');
  assert.equal(r.hoTen, 'Nguyễn Văn An');
});

test('.doc chữ 8 bit (mảnh nén), phông TCVN3 (.VnTime) → Unicode', async () => {
  assert.equal(await docToText(fx('ascii.doc')), 'Plain ASCII only line one\nHoi: Who signed?\nDap: The director signed.');
  const t = await docToText(fx('tcvn3.doc'));
  assert.equal(t, 'Biên bản ghi lời khai\nNgười khai: Trần Thị Bình\nHỏi: Chị nhận bao nhiêu tiền?\nĐáp: Tôi nhận một trăm triệu đồng.');
});

test('tệp đuôi .doc nhưng thực chất là RTF / .docx / HTML → nhận diện theo nội dung', async () => {
  const rtf = fx('bien-ban-rtf.doc');
  assert.equal(sniffDoc(rtf), 'rtf');
  assert.ok((await docToText(rtf)).includes('Hỏi: Ai chỉ đạo anh chuyển tiền?'));
  const docx = textToDocx('Hỏi: Ở đâu?\nĐáp: Hà Nội');
  assert.equal(sniffDoc(docx), 'docx');
  assert.equal(await docToText(docx), 'Hỏi: Ở đâu?\nĐáp: Hà Nội');
  const html = new TextEncoder().encode('<html><head><meta charset="utf-8"></head><body><p>Hỏi: Ai ký?</p><p>Đáp: Giám đốc</p></body></html>');
  assert.equal(await docToText(html), 'Hỏi: Ai ký?\nĐáp: Giám đốc');
  // .docx thực chất là .doc (đổi đuôi) vẫn đọc được.
  assert.ok((await wordToText(fx('bien-ban.doc').buffer.slice(0), 'x.docx')).includes('BIÊN BẢN GHI LỜI KHAI'));
});

test('tệp hỏng / không phải Word → báo lỗi tiếng Việt nói rõ', async () => {
  await assert.rejects(docToText(new TextEncoder().encode('xin chào, đây không phải Word'), 'a.doc'), /“a\.doc” mang đuôi \.doc nhưng không phải tệp Word/);
  const broken = new Uint8Array(fx('bien-ban.doc').subarray(0, 1536));
  await assert.rejects(docToText(broken, 'b.doc'), /b\.doc/);
});

test('ký tự điều khiển Word: bỏ mã trường (giữ kết quả), ảnh; RTF \\u và \\\'hh', () => {
  assert.equal(cleanWordText('Ngày \x13 DATE \\@ "dd/MM" \x1405/03\x15 năm\x01\r'), 'Ngày 05/03 năm');
  assert.equal(rtfToText("{\\rtf1\\ansi\\ansicpg1258{\\fonttbl{\\f0 Times;}}\\uc1 H\\u7887?i: \\'e0? Ai\\par \\u272?\\'e1p: T\\u244?i}"), 'Hỏi: à? Ai\nĐáp: Tôi');
});

test('tự chuyển .doc → .docx: giữ nguyên chữ và đoạn văn; .docx thật trả nguyên', async () => {
  const out = await docToDocx(fx('bien-ban.doc'), 'bien-ban.doc');
  assert.equal(sniffDoc(out), 'docx');
  const back = await docxToText(out.buffer);
  assert.equal(back, await docToText(fx('bien-ban.doc')));
  const real = textToDocx('A');
  assert.equal(await docToDocx(real), real);
});

test('tách Hỏi – Đáp: chung một dòng, chữ dấu tổ hợp (NFD), chữ hoa, ngăn bằng tab', () => {
  const t = 'Hỏi: Anh tên gì? Đáp: Tôi tên An.\nHỎI: Ở đâu?\nTRẢ LỜI: Hà Nội\nHỏi\tChuyển bao nhiêu?\nĐáp\t1.250.000.000 đồng'.normalize('NFD');
  assert.deepEqual(parsePastedQa(t).pairs, [
    { q: 'Anh tên gì?', a: 'Tôi tên An.' },
    { q: 'Ở đâu?', a: 'Hà Nội' },
    { q: 'Chuyển bao nhiêu?', a: '1.250.000.000 đồng' },
  ]);
  // "Đ." viết tắt không bị tách giữa câu.
  assert.deepEqual(parsePastedQa('Hỏi: Ông Đ. Văn A có mặt không?\nĐáp: Có.').pairs, [{ q: 'Ông Đ. Văn A có mặt không?', a: 'Có.' }]);
});

test('họ tên người khai: chỉ lấy theo nhãn rõ ràng, bỏ chữ ở phần ký tên', () => {
  const name = (t) => parseRecordText(t, parsePastedQa).hoTen;
  assert.equal(name('Người khai: Nguyễn Văn An, sinh năm 1980'), 'Nguyễn Văn An');
  assert.equal(name('Họ tên\tTrần Thị Bình\nChức vụ\tKế toán'), 'Trần Thị Bình');
  assert.equal(name('Họ tên: Hoàng Thị Ký'), 'Hoàng Thị Ký');
  assert.equal(name('NGƯỜI KHAI\tĐIỀU TRA VIÊN'), '');
  assert.equal(name('Người khai: (Ký, ghi rõ họ tên)'), '');
  assert.equal(name('Họ tên: ............'), '');
  assert.equal(name('Người khai: (Ký, ghi rõ họ tên)\nHọ và tên: Lê Văn C   Giới tính: Nam'), 'Lê Văn C');
});
