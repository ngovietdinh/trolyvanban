import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBinhLuan, verify, rebuild, searchBook, tocTree, findArticle, dieuKey } from '../../assets/js/legal/binh-luan.js';
import { splitLawRefs } from '../../assets/js/lib/law-links.js';
import { docToTextWithNotes } from '../../assets/js/lib/doc.js';
import { importBookText, currentBook, removeBook, article } from '../../assets/js/legal/binh-luan-store.js';

// Sách mẫu tự tạo, mô phỏng cấu trúc sách Bình luận (không dùng nội dung sách thật).
const BOOK = [
  'BÌNH LUẬN KHOA HỌC',
  'BỘ LUẬT HÌNH SỰ MẪU',
  '',
  'PHẦN THỨ NHẤT',
  ' NHỮNG QUY ĐỊNH CHUNG',
  'CHƯƠNG I',
  'ĐIỀU KHOẢN CƠ BẢN',
  'Điều 1. Nhiệm vụ của Bộ luật hình sự',
  'Bộ luật hình sự có nhiệm vụ bảo vệ chủ quyền quốc gia.',
  'Bình luận',
  '1. Nhiệm vụ của pháp luật hình sự là những việc đặt ra.',
  'Điều 1 quy định hai nhiệm vụ: bảo vệ và giáo dục{{fn:1}}.',
  '- Bảo vệ: chống mọi hành vi phạm tội;',
  'Chương II',
  'HIỆU LỰC CỦA BỘ LUẬT HÌNH SỰ',
  'Điều 2: Cơ sở của trách nhiệm hình sự',
  '1. Chỉ người nào phạm một tội đã được Bộ luật hình sự quy định mới phải chịu trách nhiệm hình sự.',
  'a) Điểm thứ nhất;',
  'Bình luận',
  'Chương này quy định về hiệu lực, xem thêm Điều 1 của Bộ luật này.',
  'PHẦN THỨ HAI',
  'CÁC TỘI PHẠM',
  'CHƯƠNG XVI',
  'CÁC TỘI XÂM PHẠM SỞ HỮU',
  'Mục 1. CÁC TỘI PHẠM VỀ',
  'TÀI SẢN MẪU',
  'Điều 173 Tội trộm cắp tài sản',
  '1. Người nào trộm cắp tài sản trị giá từ 2.000.000 đồng, thì bị phạt tù.',
  'Bình luận',
  'Điều 173 quy định 4 khung hình phạt:',
  '+ Khung 1: phạt tù đến 03 năm;',
  'Điều 217a. Tội vi phạm quy định về kinh doanh theo phương thức đa cấp',
  'Nội dung điều 217a.',
  'Bình luận',
  'Điều luật được bổ sung năm 2017.',
  'Điều 292. Tội cung cấp dịch vụ trái phép trên mạng máy tính*',
  'Tội này đã được bãi bỏ.',
  '',
  'MỤC LỤC',
  'PHẦN THỨ NHẤT  NHỮNG QUY ĐỊNH CHUNG\t5',
  'Điều 1. Nhiệm vụ của Bộ luật hình sự\t5',
  'Điều 2: Cơ sở của trách nhiệm hình sự\t7',
  'Điều 173: Tội trộm cắp tài sản\t225',
].join('\n');
const NOTES = ['Xem: Nghị quyết mẫu số 01.'];

test('tách sách: Phần / Chương / Mục / Điều, nguyên văn điều luật và bình luận; bỏ Mục lục cuối sách', () => {
  const b = parseBinhLuan(BOOK, NOTES);
  assert.deepEqual(
    b.articles.map((a) => a.so),
    ['1', '2', '173', '217a', '292'],
  );
  assert.equal(b.skipped.toc, 5);
  const [d1, d2, d173, d217a, d292] = b.articles;
  assert.equal(d1.ten, 'Nhiệm vụ của Bộ luật hình sự');
  assert.equal(d1.phan, 'PHẦN THỨ NHẤT NHỮNG QUY ĐỊNH CHUNG');
  assert.equal(d1.chuong, 'Chương I ĐIỀU KHOẢN CƠ BẢN');
  assert.deepEqual(d1.vb, ['Bộ luật hình sự có nhiệm vụ bảo vệ chủ quyền quốc gia.']);
  assert.equal(d1.bl.length, 3, '"Điều 1 quy định…" trong bình luận không bị nhầm là tiêu đề điều');
  assert.deepEqual(d1.fn, [1]);
  assert.equal(d2.ten, 'Cơ sở của trách nhiệm hình sự');
  assert.equal(d2.chuong, 'Chương II HIỆU LỰC CỦA BỘ LUẬT HÌNH SỰ');
  assert.deepEqual(d2.bl, ['Chương này quy định về hiệu lực, xem thêm Điều 1 của Bộ luật này.'], '"Chương này…" không bị nhầm là tiêu đề chương');
  assert.equal(d173.ten, 'Tội trộm cắp tài sản');
  assert.equal(d173.muc, 'Mục 1. CÁC TỘI PHẠM VỀ TÀI SẢN MẪU');
  assert.equal(d173.chuong, 'Chương XVI CÁC TỘI XÂM PHẠM SỞ HỮU');
  assert.equal(d173.bl[0], 'Điều 173 quy định 4 khung hình phạt:');
  assert.equal(d217a.ten, 'Tội vi phạm quy định về kinh doanh theo phương thức đa cấp');
  assert.equal(d292.blHead, undefined);
  assert.deepEqual(d292.vb, ['Tội này đã được bãi bỏ.']);
  assert.ok(dieuKey('217') < dieuKey('217a') && dieuKey('217a') < dieuKey('218'));
});

test('giữ nguyên 100%: ghép lại đúng từng dòng bản gốc; sửa / thêm / bớt một chữ đều bị phát hiện', () => {
  const b = parseBinhLuan(BOOK, NOTES);
  assert.deepEqual(verify(BOOK, b), { ok: true, lines: 36 });
  const lines = rebuild(b).filter((l) => l.trim());
  assert.equal(lines.join('\n'), BOOK.split('\n').slice(0, -5).filter((l) => l.trim()).join('\n'));
  const edited = structuredClone(b);
  edited.articles[2].bl[1] = '+ Khung 1: phạt tù đến 05 năm;';
  assert.equal(verify(BOOK, edited).ok, false);
  const dropped = structuredClone(b);
  dropped.articles[0].bl.pop();
  assert.match(verify(BOOK, dropped).reason, /Số dòng khác nhau/);
  assert.match(verify(BOOK, parseBinhLuan(BOOK, [])).reason, /chú thích không khớp/);
});

test('tìm toàn văn không dấu, theo số điều; mục lục cây', () => {
  const b = parseBinhLuan(BOOK, NOTES);
  assert.deepEqual(searchBook(b, '173').map((r) => r.so), ['173']);
  assert.deepEqual(searchBook(b, 'dieu 217A').map((r) => r.so), ['217a']);
  const r = searchBook(b, 'khung hinh phat');
  assert.deepEqual(r.map((x) => [x.so, x.where]), [['173', 'bl']]);
  assert.match(r[0].snippet, /4 khung hình phạt/);
  assert.equal(searchBook(b, 'trom cap')[0].where, 'ten');
  assert.equal(findArticle(b, '217A').so, '217a');
  const t = tocTree(b);
  assert.equal(t.length, 2);
  assert.deepEqual(t[1].chuongs[0].mucs.map((m) => [m.muc, m.items.map((i) => i.so)]), [['Mục 1. CÁC TỘI PHẠM VỀ TÀI SẢN MẪU', ['173', '217a', '292']]]);
});

test('nạp sách: từ chối tệp không phải sách Bình luận; nạp được thì tra cứu theo số điều', async () => {
  await assert.rejects(importBookText('Một văn bản bình thường.\nĐiều 5. Không phải sách', []), /Không nhận ra cấu trúc sách Bình luận/);
  const many = [BOOK.split('\nMỤC LỤC')[0], ...Array.from({ length: 60 }, (_, i) => `Điều ${300 + i}. Tội mẫu ${i}\nNội dung.\nBình luận\nBình luận mẫu ${i}.`)].join('\n');
  const meta = await importBookText(many, NOTES, { file: 'mau.doc' });
  assert.equal(meta.articles, 65);
  assert.equal(meta.withBl, 64);
  assert.equal(article('173').ten, 'Tội trộm cắp tài sản');
  assert.equal(currentBook().meta.file, 'mau.doc');
  await removeBook();
  assert.equal(currentBook(), null);
});

test('chú thích chân trang trong tệp .doc: giữ vị trí {{fn:n}} và nội dung từng chú thích', async () => {
  const r = await docToTextWithNotes(readFileSync(new URL('../fixtures/doc/chu-thich.doc', import.meta.url)), 'chu-thich.doc');
  assert.equal(r.text, 'BÌNH LUẬN KHOA HỌC MẪU\nĐiều 1. Nhiệm vụ\nBình luận\nĐoạn có chú thích thứ nhất{{fn:1}} và tiếp theo.\nĐoạn chú thích thứ hai{{fn:2}}.');
  assert.deepEqual(r.notes, ['Xem: Nghị quyết 01/2006.', 'Bộ luật hình sự 1999, Điều 53.']);
});

test('tự gắn liên kết “Điều N” của BLHS; bỏ qua luật khác, BLHS 1999', () => {
  const refs = (s) => splitLawRefs(s).filter((x) => typeof x !== 'string').map((x) => x.so);
  assert.deepEqual(refs('khoản 2 Điều 353 Bộ luật Hình sự'), ['353']);
  assert.deepEqual(refs('Áp dụng điểm s khoản 1 Điều 51, 52 và 54 BLHS'), ['51', '52', '54']);
  assert.deepEqual(refs('Đ.174: Tội lừa đảo chiếm đoạt tài sản'), ['174']);
  assert.deepEqual(refs('xem Điều 51 của Bộ luật này'), ['51']);
  assert.deepEqual(refs('Điều 88 BLTTHS; Điều 9 Bộ luật Tố tụng hình sự; Điều 584 Bộ luật Dân sự'), []);
  assert.deepEqual(refs('Điều 4 Luật Phòng, chống tham nhũng; Điều 3 Nghị quyết 02/2003; Điều 2 Luật số 12/2017/QH14'), []);
  assert.deepEqual(refs('Điều 52 Bộ luật hình sự năm 1999'), []);
  assert.deepEqual(refs('Điều 47 BLHS; Điều 106 BLTTHS'), ['47']);
  assert.deepEqual(splitLawRefs('Điều 999 và Điều 173', (so) => so === '173').filter((x) => typeof x !== 'string').map((x) => x.so), ['173']);
  const parts = splitLawRefs('Theo Điều 173 BLHS.');
  assert.equal(parts.map((x) => (typeof x === 'string' ? x : x.text)).join(''), 'Theo Điều 173 BLHS.', 'chữ hiển thị giữ nguyên');
});
