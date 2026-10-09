import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCaseMap } from '../../assets/js/legal/case-map.js';
import { analyzeMoney, personProfile, essenceOf, applyFlowAction, edgeId, formatVnd } from '../../assets/js/legal/money-flow.js';
import { emptyLearn, learnVerb, learnIgnore, forgetRule, learnCount, sentKey } from '../../assets/js/legal/learn.js';
import { analyzeStatements } from '../../assets/js/legal/statements.js';

const SRC = [
  { label: 'BB An', speaker: 'Nguyễn Văn An', text: 'Tôi là kế toán Ban QLDA huyện X. Ngày 05/3/2025 tôi lập chứng từ chi khống rút 300 triệu đồng. Sau đó tôi chuyển cho ông Trần Văn Bình 100 triệu đồng để ký duyệt thanh toán. Tôi đưa cho bà Lê Thị Cúc 20 triệu đồng.' },
  { label: 'BB Bình', speaker: 'Trần Văn Bình', text: 'Tôi là Giám đốc Ban QLDA. Ngày 05/3/2025 tôi nhận 100 triệu đồng của ông Nguyễn Văn An.' },
];

test('mỗi khoản ghi ai nêu, hai bên có tự khai không, thời điểm, mục đích — nguyên văn', () => {
  const m = buildCaseMap({ sources: SRC });
  const ab = m.edges.find((e) => e.den === 'Trần Văn Bình');
  assert.deepEqual(ab.nguon.sort(), ['Nguyễn Văn An', 'Trần Văn Bình']);
  assert.deepEqual(ab.khai, { dua: true, nhan: true });
  assert.equal(ab.thoiGian, '05/03/2025');
  assert.equal(ab.mucDich, 'để ký duyệt thanh toán');
  const ac = m.edges.find((e) => e.den === 'Lê Thị Cúc');
  assert.deepEqual(ac.khai, { dua: true, nhan: false });
  assert.equal(ac.mucDich, '');
  assert.equal(m.rut.length, 1);
  assert.equal(m.rut[0].soTien, '300 triệu đồng');
  // Số tiền nêu ở đâu / đã gắn vào đâu.
  const by = Object.fromEntries(m.soTien.map((a) => [a.raw, a]));
  assert.equal(by['300 triệu đồng'].loai, 'rut');
  assert.equal(by['100 triệu đồng'].loai, 'dong-tien');
  assert.equal(by['100 triệu đồng'].n, 2);
  assert.ok(by['100 triệu đồng'].quotes.length >= 1);
});

test('phân tích dòng tiền: xác nhận mấy phía, tổng máy cộng, vai trò, đối chiếu tiền vào – ra', () => {
  const mo = analyzeMoney(buildCaseMap({ sources: SRC }));
  assert.equal(mo.flows.length, 2);
  assert.equal(mo.flows[0].xacNhan, 'hai-phia', 'khoản có ngày xếp trước');
  assert.equal(mo.flows[1].xacNhan, 'dua-khai');
  assert.equal(mo.tong, 120e6);
  const an = mo.persons.get('nguyễn văn an');
  assert.equal(an.rutTong, 300e6);
  assert.equal(an.dua, 120e6);
  assert.equal(an.conLai, 180e6);
  assert.equal(an.vaiTro, 'nguon-tien');
  assert.equal(mo.persons.get('trần văn bình').vaiTro, 'nguoi-nhan-cuoi');
  const g = mo.gaps.find((x) => x.kind === 'chua-di');
  assert.match(g.text, /còn 180 triệu đồng chưa rõ đi đâu/);
  assert.ok(mo.gaps.some((x) => x.kind === 'mot-phia'));
  assert.equal(formatVnd(1.5e9), '1,5 tỷ đồng');
});

test('chuyển nhiều hơn số đã biết nguồn; người đưa chưa rõ nguồn; trung gian', () => {
  const m = buildCaseMap({ sources: [{ label: 'x', speaker: 'Nguyễn Văn An', text: 'Tôi nhận 50 triệu đồng của ông Trần Văn Bình. Tôi đưa cho bà Lê Thị Cúc 80 triệu đồng.' }] });
  const mo = analyzeMoney(m);
  assert.equal(mo.persons.get('nguyễn văn an').vaiTro, 'trung-gian');
  assert.match(mo.gaps.find((g) => g.kind === 'thieu-nguon').text, /thiếu nguồn 30 triệu đồng/);
});

test('hồ sơ người: chức vụ nguyên văn, dòng tiền, hành vi; tóm lược bản chất từ dữ liệu có nguyên văn', () => {
  const m = buildCaseMap({ sources: SRC });
  const pr = personProfile(m, 'Nguyễn Văn An');
  assert.equal(pr.person.vaiTro, 'Kế toán Ban QLDA huyện X');
  assert.equal(pr.money.out.length, 2);
  assert.ok(pr.acts.some((a) => a.dieu === '353'));
  const ess = essenceOf(m);
  assert.ok(ess.some((x) => x.nhom === 'Hành vi, điều luật' && /353/.test(x.text)));
  assert.ok(ess.some((x) => x.nhom === 'Dòng tiền' && /máy cộng/.test(x.text)));
  assert.ok(ess.some((x) => x.nhom === 'Chưa rõ' && /180 triệu/.test(x.text)));
  assert.ok(ess.find((x) => x.nhom === 'Đường đi của tiền').nguoi.includes('Nguyễn Văn An'));
});

test('thao tác trên khoản: đảo chiều, đổi loại, bỏ — và máy học để lần sau tự áp dụng', () => {
  const m = buildCaseMap({ sources: SRC });
  const f = analyzeMoney(m).flows.find((x) => x.den === 'Lê Thị Cúc');
  const r = applyFlowAction(m, f.id, 'dao');
  assert.equal(r.map.edges.find((e) => e.tu === 'Lê Thị Cúc').den, 'Nguyễn Văn An');
  assert.equal(r.verb, 'đưa');
  assert.equal(applyFlowAction(m, f.id, 'bo').map.edges.length, m.edges.length - 1);
  assert.equal(applyFlowAction(m, f.id, 'loai:chi-dao').map.edges.find((e) => e.den === 'Lê Thị Cúc').loai, 'chi-dao');
  assert.equal(applyFlowAction(m, 'khong-co', 'dao'), null);
  // Học: động từ “đưa” đảo chiều.
  const L = learnVerb(emptyLearn(), 'đưa', { dao: true });
  const m2 = buildCaseMap({ sources: SRC, learn: L });
  const e2 = m2.edges.find((e) => e.den === 'Nguyễn Văn An' && e.tu === 'Lê Thị Cúc');
  assert.ok(e2 && e2.hoc, 'khoản áp dụng quy tắc đã học');
  // Học: loại hẳn một câu.
  const L2 = learnIgnore(emptyLearn(), f.trich);
  assert.ok(!buildCaseMap({ sources: SRC, learn: L2 }).edges.some((e) => e.den === 'Lê Thị Cúc'));
  assert.ok(buildCaseMap({ sources: SRC, learn: L2 }).edges.some((e) => e.den === 'Trần Văn Bình'), 'các khoản khác không đổi');
  // Học: đổi loại động từ.
  const L3 = learnVerb(emptyLearn(), 'đưa', { loai: 'khac' });
  assert.ok(!buildCaseMap({ sources: SRC, learn: L3 }).edges.some((e) => e.loai === 'tien' && e.den === 'Lê Thị Cúc'));
  assert.equal(learnCount(L), 1);
  assert.equal(learnCount(forgetRule(L, 'verb', 'đưa')), 0);
  assert.equal(learnCount(forgetRule(L2, 'ignore', sentKey(f.trich))), 0);
  assert.equal(edgeId(m.edges[0]).split(':')[1], 'tien');
});

test('Phân tích lời khai dùng quy tắc đã học', () => {
  const st = SRC.map((s) => ({ speaker: s.speaker, text: s.text }));
  const base = analyzeStatements(st);
  assert.ok(base.map.edges.some((e) => e.tu === 'Nguyễn Văn An' && e.den === 'Lê Thị Cúc'));
  const learned = analyzeStatements(st, { learn: learnVerb(emptyLearn(), 'đưa', { dao: true }) });
  assert.ok(learned.map.edges.some((e) => e.tu === 'Lê Thị Cúc' && e.den === 'Nguyễn Văn An'));
});
