import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkText, applyFixes, fixAll, qualityScore, matchCase } from '../../assets/js/lib/spellcheck.js';
import { summarize, splitSentences, textStats, keywords } from '../../assets/js/lib/summarize.js';
import { localChat, localCompose, extractJson, composePrompt } from '../../assets/js/lib/ai.js';

test('phát hiện lỗi chính tả phổ biến, giữ kiểu chữ', () => {
  const issues = checkText('Đề nghị sử lý dứt điểm. Bổ xung hồ sơ.');
  const sug = issues.map((i) => i.suggestion);
  assert.ok(sug.includes('xử lý'));
  assert.ok(sug.includes('Bổ sung'));
  assert.equal(matchCase('SỬ LÝ', 'xử lý'), 'XỬ LÝ');
});

test('dấu câu và khoảng trắng', () => {
  assert.equal(fixAll('Kính gửi  các đơn vị ,đề nghị thực hiện .'), 'Kính gửi các đơn vị, đề nghị thực hiện.');
  assert.equal(fixAll('Hoàn thành.tiếp tục triển khai'), 'Hoàn thành. Tiếp tục triển khai');
});

test('không báo nhầm số thập phân, ký hiệu văn bản, dấu ./.', () => {
  assert.equal(checkText('Đạt 99,6% kế hoạch theo Nghị định số 30/2020/NĐ-CP./.').length, 0);
  assert.equal(checkText('Tỷ lệ 1.234 hồ sơ.').length, 0);
});

test('thể thức ngày tháng và quốc hiệu', () => {
  assert.equal(fixAll('Hà Nội, ngày 5 tháng 2 năm 2026'), 'Hà Nội, ngày 05 tháng 02 năm 2026');
  assert.equal(checkText('Hà Nội, ngày 05 tháng 10 năm 2026').length, 0);
  assert.equal(fixAll('CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM'), 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
  assert.equal(fixAll('Độc lập – Tự do – Hạnh phúc'), 'Độc lập - Tự do - Hạnh phúc');
});

test('lặp từ và viết hoa đầu câu', () => {
  assert.equal(fixAll('Báo cáo của của đơn vị. kết quả tốt.'), 'Báo cáo của đơn vị. Kết quả tốt.');
});

test('applyFixes bỏ qua lỗi không có gợi ý; điểm chất lượng', () => {
  const t = 'Thiếu ngoặc (chưa đóng';
  const issues = checkText(t);
  assert.equal(issues.length, 1);
  assert.equal(applyFixes(t, issues), t);
  assert.equal(qualityScore('Văn bản tốt.', []), 100);
  assert.ok(qualityScore('a b c', [{ type: 'spelling' }]) < 100);
});

const LONG = `Thực hiện Kế hoạch số 45/KH-UBND của Ủy ban nhân dân phường về chuyển đổi số năm 2026. Trong quý III, phường tiếp nhận 1.245 hồ sơ thủ tục hành chính. Tỷ lệ giải quyết đúng hạn đạt 99,6%, tăng so với quý trước. Công tác chuyển đổi số được quan tâm chỉ đạo. Tỷ lệ hồ sơ trực tuyến toàn trình đạt 78%. Tuy nhiên, một số tổ dân phố chưa cập nhật dữ liệu dân cư kịp thời. Đề nghị các đơn vị tiếp tục đẩy mạnh chuyển đổi số, hoàn thành chỉ tiêu năm.`;

test('tách câu và thống kê', () => {
  assert.equal(splitSentences(LONG).length, 7);
  const s = textStats(LONG);
  assert.equal(s.sentences, 7);
  assert.ok(s.words > 60);
});

test('tóm tắt giữ thứ tự và rút gọn', () => {
  const r = summarize(LONG, { maxSentences: 3 });
  assert.equal(r.sentences.length, 3);
  const all = splitSentences(LONG);
  const idx = r.sentences.map((x) => all.indexOf(x));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
  assert.ok(keywords(LONG).some((k) => k.includes('chuyển đổi')));
});

test('trợ lý cục bộ: đọc số, soạn văn bản, chính tả, kiến thức', () => {
  assert.match(localChat('Đọc số 1.500.000 thành chữ').text, /Một triệu năm trăm nghìn đồng chẵn/);
  const c = localChat('Soạn công văn về việc tổ chức tập huấn chuyển đổi số');
  assert.equal(c.action.tool, 'compose');
  assert.equal(c.action.typeId, 'cong-van');
  assert.match(c.action.draft.trichYeu, /tổ chức tập huấn/);
  assert.match(localChat('Kiểm tra chính tả: Cần sử lý ngay').text, /xử lý/);
  assert.match(localChat('Lề trang văn bản là bao nhiêu?').text, /30–35 mm/);
  assert.match(localChat('xin chào').text, /Trợ Lý Văn Bản/);
});

test('soạn cục bộ cho mọi loại & JSON', () => {
  for (const id of ['cong-van', 'quyet-dinh', 'to-trinh', 'bao-cao', 'thong-bao', 'ke-hoach', 'giay-moi', 'bien-ban']) {
    const r = localCompose(id, 'tổ chức hội nghị tổng kết', { coQuan: 'ỦY BAN NHÂN DÂN PHƯỜNG A' });
    assert.ok(r.noiDung.length > 10 && r.trichYeu === 'tổ chức hội nghị tổng kết');
  }
  assert.deepEqual(extractJson('Đây: {"a": "x}y", "b": {"c": 1}} xong'), { a: 'x}y', b: { c: 1 } });
  assert.equal(extractJson('không có'), null);
  assert.match(composePrompt('quyet-dinh', 'bổ nhiệm'), /canCu/);
});

test('không tách dấu chấm trong tên miền, email', () => {
  assert.equal(checkText('Truy cập dichvucong.gov.vn hoặc gửi thư tới vanthu@hanoi.gov.vn để biết thêm.').length, 0);
});
