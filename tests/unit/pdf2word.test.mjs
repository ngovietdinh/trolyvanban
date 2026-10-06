import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tcvn3ToUnicode, vniToUnicode, detectLegacy, fixLegacy } from '../../assets/js/lib/vn-legacy.js';
import { buildFlowDocumentXml, flowToText, buildFlowDocx } from '../../assets/js/lib/docx-flow.js';
import { inlineRuns, aiBlocksToFlow, similarity } from '../../assets/js/lib/pdf-ai.js';
import { fixOcrText } from '../../assets/js/lib/pdf-convert.js';
import { buildLines, layoutPage, ruledTables } from '../../assets/js/lib/pdf2word.js';

test('phông cũ TCVN3 (.VnTime, .VnTimeH) và VNI-Windows → Unicode, tự nhận diện', () => {
  assert.equal(tcvn3ToUnicode('Céng hßa x· héi chñ nghÜa ViÖt Nam'), 'Cộng hòa xã hội chủ nghĩa Việt Nam');
  assert.equal(tcvn3ToUnicode('§éc lËp - Tù do - H¹nh phóc'), 'Độc lập - Tự do - Hạnh phúc');
  assert.equal(tcvn3ToUnicode('CéNG HßA', { upper: true }), 'CỘNG HÒA');
  assert.equal(vniToUnicode('Coäng hoøa xaõ hoäi chuû nghóa Vieät Nam'), 'Cộng hòa xã hội chủ nghĩa Việt Nam');
  assert.equal(vniToUnicode('ñöôïc giao nhieäm vuï, ngöôøi khai, ñaêng kyù'), 'được giao nhiệm vụ, người khai, đăng ký');
  assert.equal(detectLegacy('Biªn b¶n ghi lêi khai ng­êi lµm chøng'), 'tcvn3');
  assert.equal(detectLegacy('Bieân baûn ghi lôøi khai ngöôøi laøm chöùng'), 'vni');
  assert.equal(detectLegacy('Biên bản ghi lời khai'), null);
  assert.equal(detectLegacy('Report of the meeting'), null);
  assert.equal(detectLegacy('x', 'ABCDEF+.VnTime'), 'tcvn3');
  assert.equal(fixLegacy('Cộng hòa'), 'Cộng hòa');
});

test('sửa lỗi OCR: chữ hoa mất mũ, chữ dính, số 0/O', () => {
  assert.equal(fixOcrText('BIEN BẢN GHI LỜI KHAI'), 'BIÊN BẢN GHI LỜI KHAI');
  assert.equal(fixOcrText('HUYỆN ĐÔNGANH'), 'HUYỆN ĐÔNG ANH');
  assert.equal(fixOcrText('ngày 2O/1O/2026'), 'ngày 20/10/2026');
  assert.equal(fixOcrText('Lancaster file'), 'Lancaster file');
});

const it = (str, x0, base, size = 13, o = {}) => ({ str, x0, x1: x0 + str.length * size * 0.5, base, size, bold: false, italic: false, font: 'Times New Roman', ...o });

test('dựng bố cục: phần đầu hai cột, tiêu đề căn giữa, đoạn thụt đầu dòng, tab', () => {
  const page = { width: 595, height: 842 };
  const items = [
    it('ỦY BAN NHÂN DÂN', 120, 80), it('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 300, 80, 13, { bold: true }),
    it('HUYỆN ĐÔNG ANH', 122, 96, 13, { bold: true }), it('Độc lập - Tự do - Hạnh phúc', 330, 96, 13, { bold: true }),
    it('KẾ HOẠCH', 290, 150, 14, { bold: true }),
    it('Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về', 113, 180),
    it('công tác văn thư, Ủy ban nhân dân huyện xây dựng kế hoạch tập huấn như sau:', 85, 196),
  ];
  // Mở rộng dòng đầu cho chạm lề phải (đoạn căn đều).
  items[5].x1 = 552;
  items[6].x1 = 552;
  const { blocks, margins } = layoutPage(buildLines(items), page);
  assert.equal(blocks[0].type, 'table');
  assert.equal(blocks[0].borders, false);
  assert.equal(blocks[0].rows[0].length, 2);
  assert.equal(blocks[1].align, 'center');
  assert.equal(blocks[1].runs[0].bold, true);
  assert.equal(blocks[2].align, 'justify');
  assert.ok(blocks[2].indentFirst > 20);
  assert.ok(Math.abs(margins.left - 85) < 5);
});

test('bảng có đường viền: dựng lưới ô từ nét kẻ, ô gộp khi thiếu nét dọc', () => {
  const rules = { h: [{ y: 100, x0: 85, x1: 505 }, { y: 120, x0: 85, x1: 505 }, { y: 140, x0: 85, x1: 505 }], v: [{ x: 85, y0: 100, y1: 140 }, { x: 155, y0: 100, y1: 140 }, { x: 505, y0: 100, y1: 140 }, { x: 330, y0: 120, y1: 140 }] };
  const items = [it('STT', 90, 115), it('Nội dung gộp', 170, 115), it('1', 90, 135), it('Thể thức', 170, 135), it('8 giờ', 340, 135), it('Ngoài bảng', 85, 200)];
  const { tables, rest } = ruledTables(items, rules);
  assert.equal(tables.length, 1);
  const t = tables[0].block;
  assert.equal(t.borders, true);
  assert.deepEqual(t.cols.length, 3);
  assert.equal(t.rows[0][1].span, 2); // hàng 1 không có nét dọc ở x=330 → gộp
  assert.equal(t.rows[1].length, 3);
  assert.equal(rest.length, 1);
});

test('xuất .docx dạng tự do: nhiều trang, khổ giấy, bảng, tab, đậm/nghiêng, chỉ số trên', () => {
  const doc = {
    pages: [
      { width: 595, height: 842, margins: { top: 56, right: 42, bottom: 56, left: 85 }, blocks: [{ type: 'p', align: 'center', runs: [{ text: 'KẾ HOẠCH', bold: true, size: 14 }] }, { type: 'p', tabs: [250], runs: [{ text: 'Số: 1\tHà Nội' }, { text: '1', sup: true }] }] },
      { width: 842, height: 595, blocks: [{ type: 'table', borders: true, cols: [100, 200], rows: [[{ blocks: [{ type: 'p', runs: [{ text: 'A & <B>', italic: true }] }] }, { blocks: [] }]] }] },
    ],
  };
  const xml = buildFlowDocumentXml(doc);
  assert.match(xml, /<w:b\/>/);
  assert.match(xml, /<w:tab w:val="left" w:pos="5000"\/>/);
  assert.match(xml, /<w:vertAlign w:val="superscript"\/>/);
  assert.match(xml, /A &amp; &lt;B&gt;/);
  assert.match(xml, /w:orient="landscape"/);
  assert.equal((xml.match(/<w:sectPr>/g) || []).length, 2);
  assert.match(xml, /<\/w:tbl><w:p>/); // có đoạn sau bảng cuối
  assert.equal(flowToText(doc), 'KẾ HOẠCH\nSố: 1\tHà Nội1\n\nA & <B>');
  assert.ok(buildFlowDocx(doc).length > 1000);
});

test('AI đọc ảnh: JSON khối → doc model; đánh giá độ giống để chặn AI viết lại', () => {
  assert.deepEqual(inlineRuns('a **đậm** *nghiêng* ***cả hai***', 13).map((r) => [r.text, !!r.bold, !!r.italic]), [['a ', false, false], ['đậm', true, false], [' ', false, false], ['nghiêng', false, true], [' ', false, false], ['cả hai', true, true]]);
  const blocks = aiBlocksToFlow({ blocks: [{ t: 'cols', l: ['ỦY BAN'], r: ['**CỘNG HÒA**'] }, { t: 'p', a: 'center', x: '**KẾ HOẠCH**', s: 14 }, { t: 'table', rows: [['STT', 'Nội dung'], ['1']] }] });
  assert.equal(blocks[0].type, 'table');
  assert.equal(blocks[0].borders, false);
  assert.equal(blocks[1].runs[0].bold, true);
  assert.equal(blocks[2].rows[1].length, 2);
  assert.ok(similarity('THÀNH PHAN', 'THÀNH PHẦN') > 0.95);
  assert.ok(similarity('Đề nghị các đơn vị', 'Tôi không biết gì hết') < 0.5);
});
