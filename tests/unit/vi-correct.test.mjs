// v2.50: sửa lỗi OCR tiếng Việt bằng mô hình ngôn ngữ pháp lý (dấu bị mất ở chữ hoa, chữ sai dấu), không sửa bừa chữ hợp lệ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadViLm, correctLine, correctText, correctOcr } from '../../assets/js/lib/vi-correct.js';

const LM = JSON.parse(readFileSync(new URL('../../assets/data/vi-lm.json', import.meta.url), 'utf8'));
await loadViLm(LM);

test('mô hình ngôn ngữ: đủ từ điển, không nhiễm lỗi OCR, có cặp từ pháp lý thường gặp', () => {
  assert.ok(Object.keys(LM.u).length >= 2000 && Object.keys(LM.b).length >= 20000);
  for (const bad of ['chêt', 'só', 'quyét']) assert.ok(!LM.u[bad], `từ điển không được chứa “${bad}”`);
  for (const [a, b] of [['tòa', 'án'], ['tối', 'cao'], ['thẩm', 'phán'], ['quyết', 'định'], ['cộng', 'hòa'], ['bị', 'cáo']]) assert.ok(LM.b[`${a} ${b}`] > 20, `${a} ${b}`);
});

test('khôi phục dấu cho chữ hoa / chữ sai dấu theo ngữ cảnh (lỗi OCR thật trên bản quét án lệ)', async () => {
  // Văn bản thuần (không có độ tin cậy từng chữ): sửa chữ hoa không dấu và chữ không có trong từ điển.
  const out = await correctText(['TOA ÁN NHÂN DÂN TOI CAO CONG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'ÁN LỆ SO 84/2026/AL', 'Toa án nhân dân tối cao thông qua ngày 21 tháng 5 năm 2026 theo Quyét định số 162/QĐ-CA', 'khi người nhận con nuôi là người độc thân chêt'].join('\n'));
  const l = out.split('\n');
  assert.equal(l[0], 'TÒA ÁN NHÂN DÂN TỐI CAO CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
  assert.equal(l[1], 'ÁN LỆ SỐ 84/2026/AL');
  assert.match(l[2], /^Tòa án nhân dân tối cao thông qua .* theo Quyết định số 162\/QĐ-CA$/);
  assert.match(l[3], /độc thân chết$/);
  // Có độ tin cậy từng chữ (OCR thật): chữ hợp lệ nhưng sai dấu, OCR khá tin (85–94) → sửa khi tạo cụm cố định với chữ bên cạnh.
  const line = 'Được Hội đồng Tham phán Toa án nhân dân tôi cao thông qua và được công bo theo Quyết định so 162/QĐ-CA';
  const words = line.split(' ').map((w) => ({ text: w, confidence: ['Tham', 'Toa', 'tôi', 'bo', 'so'].includes(w) ? 90 : 97 }));
  const r = correctLine(line, { words });
  assert.equal(r.text, 'Được Hội đồng Thẩm phán Tòa án nhân dân tối cao thông qua và được công bố theo Quyết định số 162/QĐ-CA');
});

test('không sửa bừa: tên riêng, từ đời thường hợp lệ, số, dấu câu giữ nguyên; chữ OCR kém tin mới được xét lại', () => {
  const keep = 'Khoảng 19 giờ ngày 09/12/2013, Nguyễn Đình Đ đến nhà anh Hà Đăng H tại thôn L, xã T, huyện C, thành phố Hà Nội ăn cơm, uống rượu cùng Đặng Hùng T và Phùng Xuân S. S gọi T ra ngoài sân và tát T.';
  const r = correctLine(keep);
  assert.deepEqual(r.changes, [], JSON.stringify(r.changes));
  assert.equal(r.text, keep);
  // Chữ hợp lệ nhưng OCR kém tin và ngữ cảnh rất rõ → sửa; OCR tin cậy → giữ.
  const low = correctLine('Hội đồng Thẩm phán Tòa án nhân dân tôi cao', { words: 'Hội đồng Thẩm phán Tòa án nhân dân tôi cao'.split(' ').map((w) => ({ text: w, confidence: w === 'tôi' ? 55 : 95 })) });
  assert.match(low.text, /tối cao$/);
  const hi = correctLine('tôi cao 1m70', { words: [{ text: 'tôi', confidence: 96 }, { text: 'cao', confidence: 96 }] });
  assert.equal(hi.text, 'tôi cao 1m70');
  // Ð (Eth) do OCR → Đ.
  assert.equal(correctLine('Nguyễn Ðình Ð').text, 'Nguyễn Đình Đ');
});

test('correctOcr sửa tại chỗ cả dòng lẫn từng chữ, giữ tọa độ; đếm số chữ sửa', async () => {
  const ocr = { text: '', lines: [{ text: 'Quyét định so 162/QĐ-CA', x0: 0, y0: 0, x1: 10, y1: 1, confidence: 90, words: [{ text: 'Quyét', x0: 0, x1: 2, confidence: 80 }, { text: 'định', x0: 2, x1: 4, confidence: 95 }, { text: 'so', x0: 4, x1: 5, confidence: 60 }, { text: '162/QĐ-CA', x0: 5, x1: 9, confidence: 90 }] }] };
  const n = await correctOcr(ocr);
  assert.equal(n, 2);
  assert.equal(ocr.lines[0].text, 'Quyết định số 162/QĐ-CA');
  assert.deepEqual(ocr.lines[0].words.map((w) => w.text), ['Quyết', 'định', 'số', '162/QĐ-CA']);
  assert.equal(ocr.lines[0].words[0].x1, 2);
});
