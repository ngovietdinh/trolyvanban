// v2.47: án lệ → Word đúng cấu trúc; gợi ý án lệ theo nội dung vụ án.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { anLeSections, anLeDoc, anLeDocMany, suggestAnLe } from '../../assets/js/legal/an-le-data.js';
import { buildDocx, buildDocumentXml } from '../../assets/js/lib/docx.js';
import { thamTra, buildThamTraReport } from '../../assets/js/legal/court-review.js';

const data = JSON.parse(readFileSync(new URL('../../assets/data/an-le.json', import.meta.url), 'utf8'));
const map = new Map(data.map((a) => [a.so, a]));
const text = (doc) => doc.body.map((p) => (p.runs ? p.runs.map((r) => r.text).join('') : p.pageBreak ? '<<trang>>' : '')).join('\n');

test('tách án lệ thành các mục đúng bố cục công bố; mọi án lệ có chữ đều tách được nội dung vụ án / nhận định / quyết định', () => {
  const s = anLeSections(map.get('75/2025/AL').text);
  assert.deepEqual(
    s.secs.map((x) => x.key),
    ['nguon', 'viTri', 'khaiQuat', 'tinhHuong', 'giaiPhap', 'quyDinh', 'tuKhoa', 'noiDung', 'nhanDinh', 'quyetDinh', 'noiDungAnLe'],
  );
  assert.ok(s.secs.find((x) => x.key === 'noiDung').paras.length > 10);
  assert.match(s.secs.find((x) => x.key === 'giaiPhap').paras[0], /Trộm cắp tài sản/);
  const ok = data.filter((a) => !a.ocr).filter((a) => {
    const keys = anLeSections(a.text).secs.map((x) => x.key);
    return keys.includes('noiDung') && keys.includes('nhanDinh') && keys.includes('quyetDinh');
  });
  assert.equal(ok.length, data.filter((a) => !a.ocr).length, `chỉ ${ok.length}/82 án lệ có chữ tách đủ ba mục lớn`);
});

test('Word một án lệ: tiêu đề, các mục theo thứ tự, ghi chú bản quét, nguồn; tệp .docx dựng được; nhiều án lệ ngắt trang', () => {
  const a = map.get('47/2021/AL');
  const doc = anLeDoc(a);
  assert.equal(doc.layout, 'plain');
  assert.deepEqual(doc.titles, ['ÁN LỆ SỐ 47/2021/AL', a.ten]);
  const t = text(doc);
  const idx = ['Được Hội đồng Thẩm phán', 'Nguồn án lệ:', 'Vị trí nội dung án lệ:', 'Khái quát nội dung án lệ:', '- Tình huống án lệ:', '- Giải pháp pháp lý:', 'Quy định của pháp luật liên quan đến án lệ:', 'Từ khóa của án lệ:', 'NỘI DUNG VỤ ÁN:', 'NHẬN ĐỊNH CỦA TÒA ÁN:', 'QUYẾT ĐỊNH:', 'NỘI DUNG ÁN LỆ:', 'Nguồn: https://anle.toaan.gov.vn'].map((h) => t.indexOf(h));
  assert.ok(idx.every((i) => i >= 0), `thiếu mục: ${idx}`);
  assert.deepEqual([...idx].sort((x, y) => x - y), idx);
  assert.ok(!/Ghi chú: Cổng án lệ đăng bản quét/.test(t));
  // Bản PDF của cổng: số trang, chú thích cuối trang, đoạn bị ngắt trang, tên án lệ bị ngắt dòng → dọn sạch.
  assert.ok(!/^\d{1,3}$/m.test(t), 'số trang lọt vào chữ');
  assert.equal(t.split(a.ten).length, 1, 'tên án lệ không lặp lại dưới tiêu đề');
  assert.match(t, /^Án lệ này do Hội đồng xét xử gồm 05 Thẩm phán/m);
  assert.match(t, /anh C nói với S: “Nó là cháu tao đấy/);
  const xml = buildDocumentXml(doc);
  assert.ok(!xml.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA'), 'văn bản án lệ không có quốc hiệu, phần đầu công văn');
  assert.ok(xml.includes('ÁN LỆ SỐ 47/2021/AL'));
  const bytes = buildDocx(doc, doc.title.name);
  assert.ok(bytes.length > 5000);
  // Bản quét có ghi chú; bản rút gọn không có nội dung vụ án.
  const ocr = anLeDoc(map.get('90/2026/AL'));
  assert.match(text(ocr), /Ghi chú: Cổng án lệ đăng bản quét/);
  assert.ok(!/NỘI DUNG VỤ ÁN:/.test(text(anLeDoc(a, { brief: true }))));
  const many = anLeDocMany([map.get('47/2021/AL'), map.get('75/2025/AL')]);
  assert.equal(many.titles[0], 'TUYỂN TẬP 2 ÁN LỆ');
  assert.equal(text(many).split('<<trang>>').length, 2);
  assert.match(text(many), /ÁN LỆ SỐ 75\/2025\/AL/);
});

test('gợi ý án lệ theo nội dung: khớp từ khóa và tình huống, không gợi ý khi tài liệu không liên quan; đưa vào thẩm tra, báo cáo', () => {
  const sug = suggestAnLe('Bị cáo dùng dao là hung khí nguy hiểm đâm vào vùng bụng của bị hại là vùng trọng yếu của cơ thể; bị hại không chết là ngoài ý muốn của bị cáo.', map);
  assert.equal(sug[0].a.so, '47/2021/AL');
  assert.ok(sug[0].why.includes('Hung khí nguy hiểm'));
  assert.ok(sug[0].score >= 12);
  assert.deepEqual(suggestAnLe('Hôm nay trời đẹp, chúng tôi đi dã ngoại ở công viên thành phố và chụp ảnh kỷ niệm cùng gia đình.', map), []);
  assert.deepEqual(suggestAnLe('ngắn', map), []);
  const sugHs = suggestAnLe('Bị cáo dùng thủ đoạn gian dối để chủ sở hữu tài sản tin tưởng giao tài sản rồi chiếm đoạt; chủ sở hữu tài sản không trông coi, quản lý tài sản.', map, { linhVuc: 'hs' });
  assert.ok(sugHs.some((g) => g.a.so === '75/2025/AL'));
  assert.ok(sugHs.every((g) => g.a.linhVuc === 'hs'));
  const rec = { defendants: [{ hoTen: 'Nguyễn Văn A', toiDanh: [{ dieu: '123', khoan: 1 }] }], sources: [{ name: 'Cáo trạng', loai: 'cao-trang', text: 'Bị cáo dùng dao là hung khí nguy hiểm đâm vào vùng bụng của bị hại là vùng trọng yếu của cơ thể. Bị hại không chết.' }], moc: {} };
  const R = thamTra(rec, { docs: [], anLe: map });
  assert.equal(R.anLeGoiY[0].a.so, '47/2021/AL');
  assert.deepEqual(thamTra(rec, { docs: [] }).anLeGoiY, []);
  const doc = buildThamTraReport(rec, { docs: [], anLe: map });
  assert.match(text(doc), /Án lệ 47\/2021\/AL .* gợi ý theo nội dung vụ án, khớp từ khóa: “Hung khí nguy hiểm”/);
});
