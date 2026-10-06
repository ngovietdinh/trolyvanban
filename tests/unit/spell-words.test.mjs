import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syllableProblem, suggestSyllable, misplacedTone, telexDecode, vniDecode, applyTone } from '../../assets/js/lib/vn-syllable.js';
import { checkText, checkWords, fixAll } from '../../assets/js/lib/spellcheck.js';
import { locateAiIssues, mergeIssues, splitChunks, spellAiPrompt } from '../../assets/js/lib/spell-ai.js';

test('âm tiết hợp lệ: không báo nhầm từ đúng, kể cả quy tắc gi/qu/k/gh/ngh/yê', () => {
  for (const w of 'người được việc nghiêm nghĩa ghế kiểm quyết quốc khuyên giữ gì giếng yêu yên uyển thuở hoà hòa khuya oanh xoăn quý kỷ ạ ừ ở ấy'.split(' ')) {
    assert.equal(syllableProblem(w), null, w);
  }
});

test('phát hiện từ không có nghĩa và gợi ý đúng', () => {
  const cases = { đươc: 'được', viềc: 'việc', thôngg: 'thông', côgn: 'công', nghành: 'ngành', ghà: 'gà', ngiêm: 'nghiêm', iêu: 'yêu', nguời: 'người', đuợc: 'được', trườg: 'trường' };
  for (const [bad, good] of Object.entries(cases)) {
    assert.ok(syllableProblem(bad), `${bad} phải bị phát hiện`);
    assert.ok(suggestSyllable(bad).includes(good), `${bad} → ${good}, nhận: ${suggestSyllable(bad)}`);
  }
});

test('giải mã kiểu gõ Telex/VNI còn sót, đặt dấu thanh', () => {
  assert.equal(telexDecode('dduowcj'), 'được');
  assert.equal(telexDecode('thoongs'), 'thống');
  assert.equal(vniDecode('d9u7o75c'), 'được');
  assert.equal(applyTone('hoa', 1), 'hoà');
  assert.equal(applyTone('quyên', 2), 'quyến');
});

test('dấu thanh đặt sai vị trí', () => {
  assert.equal(misplacedTone('cuả'), 'của');
  assert.equal(misplacedTone('nghiã'), 'nghĩa');
  assert.equal(misplacedTone('gìơ'), 'giờ');
  for (const ok of ['hoà', 'hòa', 'thuý', 'thúy', 'khoẻ', 'khỏe', 'của', 'quý']) assert.equal(misplacedTone(ok), null, ok);
});

test('kiểm tra từ trong văn bản: bỏ qua viết tắt, tên riêng, email, web, từ mượn, từ điển cá nhân', () => {
  const t = 'Căn cứ Nghị định 30/2020/NĐ-CP, UBND huyện gửi email nva@hanoi.gov.vn, website https://dichvucong.gov.vn, công ty Lancaster nộp file PDF qua Zalo.';
  assert.deepEqual(checkWords(t), []);
  const w = checkWords('Ông Smithh đươc mời họp.');
  assert.deepEqual(w.map((i) => i.original), ['đươc']);
  assert.deepEqual(checkWords('Thông tin côgn khai.', { ignore: new Set(['côgn']) }), []);
});

test('văn bản gõ không dấu hoàn toàn không bị báo từng từ', () => {
  assert.deepEqual(checkWords('de nghi cac don vi thuc hien nghiem tuc'), []);
  // Văn bản có dấu nhưng lẫn từ không dấu → báo “có thể thiếu dấu”.
  const r = checkWords('Kết quả kiểm tra rất tot và đúng hạn.');
  assert.equal(r.length, 1);
  assert.match(r[0].message, /thiếu dấu/);
});

test('dùng từ thừa, sai kết hợp; “Sửa tất cả” không tự sửa từ còn nhiều khả năng', () => {
  const issues = checkText('Sự việc được diễn ra và tái diễn lại.');
  assert.ok(issues.some((i) => i.type === 'word' && i.suggestion === 'diễn ra'));
  assert.ok(issues.some((i) => i.suggestion === 'tái diễn'));
  assert.equal(fixAll('Cán bộ thưc hiện, người dân đươc hỗ trợ cuả xã.'), 'Cán bộ thưc hiện, người dân đươc hỗ trợ của xã.');
  assert.equal(fixAll('Thông tin côgn khai.'), 'Thông tin công khai.');
});

test('AI: tách đoạn, định vị góp ý, gộp với lỗi trên máy', () => {
  const text = 'Đề nghị các đơn vị thực hiện nghiêm. Việc này rất là quan trọng cho cơ quan.';
  const ai = locateAiIssues(text, [
    { sai: 'rất là', sua: 'rất', loai: 'van-phong', giaiThich: 'Văn nói' },
    { sai: 'cho cơ quan', sua: 'đối với cơ quan', loai: 'ngu-phap', giaiThich: 'Quan hệ từ' },
    { sai: 'không có trong văn bản', sua: 'x' },
    { sai: 'nghiêm', sua: 'nghiêm' },
  ]);
  assert.deepEqual(ai.map((a) => [a.original, a.type]), [['rất là', 'style'], ['cho cơ quan', 'grammar']]);
  const merged = mergeIssues(checkText(text), ai);
  assert.equal(merged.filter((m) => m.original === 'rất là').length, 1); // trùng với lỗi trên máy → giữ một
  assert.ok(merged.some((m) => m.ai && m.type === 'grammar'));
  const long = Array.from({ length: 300 }, (_, i) => `Câu thứ ${i} trong văn bản dài.`).join('\n');
  const chunks = splitChunks(long, 2000);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.map((c) => c.text).join(''), long);
  assert.match(spellAiPrompt('abc'), /"loi"/);
});
