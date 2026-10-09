import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeStatements, splitByHeading, clarifyPrompt, parseClarify, withExtraEdges, questionsByPerson, contextFor } from '../../assets/js/legal/statements.js';
import { buildCaseMap, isDenial } from '../../assets/js/legal/case-map.js';
import { stripCache } from '../../assets/js/lib/cache-mark.js';

const ST = [
  { speaker: 'Nguyễn Văn An', text: 'Tôi là kế toán Ban QLDA huyện X. Ngày 05/3/2025 tôi lập chứng từ chi khống rút 300 triệu đồng. Sau đó tôi chuyển cho ông Trần Văn Bình 100 triệu đồng. Tôi đưa cho bà Lê Thị Cúc 20 triệu đồng.' },
  { speaker: 'Trần Văn Bình', text: 'Tôi là Giám đốc Ban QLDA huyện X. Tôi không nhận tiền của ông An.' },
  { speaker: 'Lê Thị Cúc', text: 'Tôi nhận của ông An khoảng 30 triệu đồng. Hình như ông Phạm Văn Dũng có mặt. Ông Dũng nhận 5 triệu đồng từ ông An.' },
  { speaker: 'Hoàng Văn Tư', text: 'Tôi đi công tác Hà Nội suốt tháng 3, không liên quan dự án.' },
];

test('câu phủ nhận không dựng thành quan hệ', () => {
  assert.ok(isDenial('Tôi không nhận tiền của ông An.'));
  assert.ok(isDenial('Tôi chưa bao giờ chỉ đạo ông An rút tiền'));
  assert.ok(!isDenial('Tôi không biết việc ông An đưa tiền cho ông Bình'));
  const m = buildCaseMap({ sources: [{ label: 'x', speaker: 'Trần Văn Bình', text: 'Tôi không nhận tiền của ông Nguyễn Văn An.' }] });
  assert.equal(m.edges.length, 0);
});

test('người khai tự nêu chức vụ (“Tôi là …”) được lấy nguyên văn', () => {
  const r = analyzeStatements(ST);
  const p = (n) => r.map.people.find((x) => x.ten === n);
  assert.equal(p('Nguyễn Văn An').vaiTro, 'Kế toán Ban QLDA huyện X');
  assert.equal(p('Trần Văn Bình').vaiTro, 'Giám đốc Ban QLDA huyện X');
  assert.equal(p('Lê Thị Cúc').vaiTro, '');
});

test('phát hiện điểm cần làm rõ giữa các lời khai', () => {
  const r = analyzeStatements(ST);
  const kinds = (k) => r.issues.filter((x) => x.kind === k);
  const tn = kinds('trai-nguoc')[0];
  assert.equal(tn.level, 'cao');
  assert.match(tn.title, /Trần Văn Bình phủ nhận.*Nguyễn Văn An/);
  assert.equal(tn.excerpts.length, 2);
  const lt = kinds('lech-tien')[0];
  assert.equal(lt.level, 'cao');
  assert.match(lt.title, /20 triệu đồng \/ 30 triệu đồng/);
  assert.ok(kinds('chua-khai').some((x) => x.people[0] === 'Phạm Văn Dũng'));
  assert.ok(kinds('mot-chieu').some((x) => /Nguyễn Văn An chưa khai/.test(x.title) && /Phạm Văn Dũng/.test(x.title)));
  assert.ok(kinds('mo-ho').some((x) => x.people[0] === 'Lê Thị Cúc'));
  assert.ok(!r.issues.some((x) => x.people.includes('Hoàng Văn Tư') && x.kind !== 'mo-ho'));
  // Xếp theo mức: cần làm rõ ngay trước.
  const rank = { cao: 0, vua: 1, thap: 2 };
  assert.deepEqual(r.issues.map((x) => rank[x.level]), [...r.issues.map((x) => rank[x.level])].sort());
  const bin = r.speakers.find((x) => x.ten === 'Trần Văn Bình');
  assert.equal(bin.phuNhan, 1);
});

test('tách biên bản nhiều người khai theo tiêu đề', () => {
  const parts = splitByHeading('Lời khai của Nguyễn Văn An (bị can):\nTôi chuyển 100 triệu đồng.\nBiên bản ghi lời khai của bà Lê Thị Cúc\nTôi nhận tiền.\nNgười khai: Trần Văn Bình\nTôi không nhận.');
  assert.deepEqual(parts.map((x) => x.speaker), ['Nguyễn Văn An', 'Lê Thị Cúc', 'Trần Văn Bình']);
  assert.equal(parts[0].role, 'bị can');
  assert.deepEqual(splitByHeading('Tôi là An. Lời khai của tôi là đúng sự thật.'), []);
});

test('AI làm rõ: chỉ gửi câu liên quan; quan hệ không có nguyên văn bị bỏ, số tiền khớp nguyên văn', () => {
  const r = analyzeStatements(ST);
  const tn = r.issues.find((x) => x.kind === 'trai-nguoc');
  const ctx = contextFor(tn, ST);
  assert.match(ctx, /không nhận tiền/);
  assert.doesNotMatch(ctx, /công tác Hà Nội/);
  const prompt = stripCache(clarifyPrompt([tn], ST));
  assert.match(prompt, new RegExp(`id: ${tn.id}`));
  const source = ST.map((x) => x.text).join('\n');
  const { answers, dropped } = parseClarify(JSON.stringify({ ketQua: [{ id: tn.id, nhanDinh: 'A', cauHoi: ['Hỏi gì?', { hoi: 'Ở đâu?', ai: 'Trần Văn Bình' }], xacMinh: ['Sao kê'], quanHe: [{ tu: 'Trần Văn Bình', den: 'Hoàng Văn Tư', loai: 'tien', soTien: '9 tỷ', trich: 'bịa ra' }, { tu: 'Nguyễn Văn An', den: 'Phạm Văn Dũng', loai: 'tien', soTien: '5.000.000 đồng', trich: 'Ông Dũng nhận 5 triệu đồng từ ông An' }, { tu: 'Ông Bình', den: 'Lê Thị Cúc', loai: 'tien', soTien: '', trich: 'Tôi nhận của ông An khoảng 30 triệu đồng' }] }] }), [tn], source, r.map.people.map((x) => x.ten));
  assert.equal(dropped, 2, 'tên không có nguyên văn, tên gọi trơ (ông Bình) → bỏ');
  const a = answers[tn.id];
  assert.equal(a.cauHoi.length, 2);
  assert.equal(a.cauHoi[1].ai, 'Trần Văn Bình');
  assert.equal(a.quanHe.length, 1);
  assert.equal(a.quanHe[0].soTien, '');
  const m2 = withExtraEdges({ people: [], edges: [] }, a.quanHe);
  assert.equal(m2.people.length, 2);
  const q = questionsByPerson([tn], answers);
  assert.ok(q.some((g) => g.ai === 'Trần Văn Bình' && g.list.includes('Ở đâu?')));
  assert.deepEqual(questionsByPerson([tn], {}, { [tn.id]: 1 }), []);
});

import { classifyPeople, sentences, isFullName, stripTitle, nameVerbatim, sanitizeNames } from '../../assets/js/legal/case-map.js';

test('tên phải chính xác 100%: tên gọi trơ / trùng nhiều người / bị cắt → chưa rõ, không vào sơ đồ', () => {
  const r = analyzeStatements([
    { speaker: 'Nguyễn Văn An', text: 'Tôi chuyển cho ông Bình 100 triệu đồng. Tôi đưa cho bà Lê Thị Cúc 20 triệu đồng.' },
  ]);
  assert.ok(!r.map.people.some((p) => /Bình/.test(p.ten)), 'ông Bình chưa rõ họ tên → không có trong sơ đồ');
  assert.equal(r.map.edges.length, 1);
  assert.equal(r.map.edges[0].den, 'Lê Thị Cúc');
  const u = r.map.unclear.find((x) => x.ten === 'Bình');
  assert.match(u.lyDo, /chưa có họ tên đầy đủ/);
  assert.equal(u.nguoiKhai[0], 'Nguyễn Văn An');
  assert.ok(r.issues.some((x) => x.kind === 'chua-ro-ten' && x.level === 'cao' && x.rawName === 'Bình'));
  // Xác nhận họ tên → vào sơ đồ.
  const r2 = analyzeStatements([{ speaker: 'Nguyễn Văn An', text: 'Tôi chuyển cho ông Bình 100 triệu đồng.' }], { confirmed: ['Trần Văn Bình'] });
  assert.ok(r2.map.edges.some((e) => e.den === 'Trần Văn Bình' && e.soTien === '100 triệu đồng'));
  assert.equal(r2.map.unclear.length, 0);
  // Hai người cùng tên Bình, câu chỉ nói “ông Bình” → chưa rõ là ai, không gán cho ai.
  const r3 = analyzeStatements([{ speaker: 'Nguyễn Văn An', text: 'Ông Trần Văn Bình là giám đốc. Bà Lê Thị Bình là kế toán. Tôi chuyển cho ông Bình 50 triệu đồng.' }]);
  assert.equal(r3.map.edges.length, 0);
  assert.match(r3.map.unclear.find((x) => x.ten === 'Bình').lyDo, /Trần Văn Bình hoặc Lê Thị Bình/);
});

test('tên không bị cắt: “Hoàng Thị Em”, tên dính tên đơn vị', () => {
  const sents = sentences([{ label: 'x', speaker: '', text: 'Bà Hoàng Thị Em đưa cho ông Nguyễn Văn An Ban QLDA huyện X 10 triệu đồng.' }]);
  const ps = classifyPeople(sents, []).filter((p) => p.clear).map((p) => p.ten);
  assert.ok(ps.includes('Hoàng Thị Em'));
  assert.ok(ps.includes('Nguyễn Văn An'));
});

test('quy tắc tên dùng chung: danh xưng, nguyên văn, bản lưu cũ', () => {
  assert.equal(stripTitle('Ông Nguyễn Văn An'), 'Nguyễn Văn An');
  assert.ok(!isFullName('Ông An'));
  assert.ok(isFullName('Lê Thị Cúc'));
  assert.ok(nameVerbatim('Lê Thị Cúc', 'Bà LÊ THỊ CÚC nhận tiền'));
  assert.ok(!nameVerbatim('Lê Thị Cúc', 'Bà Cúc nhận tiền'));
  const m = sanitizeNames({ people: [{ ten: 'An' }, { ten: 'Lê Thị Cúc' }], edges: [{ tu: 'An', den: 'Lê Thị Cúc' }, { tu: 'Lê Thị Cúc', den: 'Lê Thị Cúc' }], crimes: [{ items: [{ nguoi: ['An', 'Lê Thị Cúc'] }] }] });
  assert.deepEqual(m.people.map((p) => p.ten), ['Lê Thị Cúc']);
  assert.equal(m.edges.length, 1);
  assert.deepEqual(m.crimes[0].items[0].nguoi, ['Lê Thị Cúc']);
  assert.equal(m.unclear[0].ten, 'An');
});
