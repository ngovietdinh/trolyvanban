import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCaseMap, mergeAiCaseMap, caseMapToTree, findPeople } from '../../assets/js/legal/case-map.js';
import { relationSvg } from '../../assets/js/views/case-map.js';

const SRC = [
  { label: 'BB Nguyễn Văn An lần 1', speaker: 'Nguyễn Văn An', text: 'Ngày 05/3/2025 tôi lập chứng từ chi khống để rút tiền chiếm đoạt 300 triệu đồng.\nSau đó tôi chuyển cho ông Trần Văn Bình 100 triệu đồng.\nÔng Bình chỉ đạo tôi lập hồ sơ quyết toán.\nBà Lê Thị Cúc thủ quỹ biết, ngày 10/4/2025 bà Cúc nhận 20 triệu đồng của tôi.' },
  { label: 'Kết luận thanh tra', text: 'Tháng 6/2025 Thanh tra tỉnh phát hiện ông Nguyễn Văn An lập chứng từ chi khống.' },
];

test('người liên quan: danh xưng, tên rút gọn gộp vào tên đầy đủ, người khai', () => {
  const ps = findPeople([{ t: 'Bà Lê Thị Cúc biết. Bà Cúc nhận tiền.', speaker: 'Nguyễn Văn An' }]);
  assert.deepEqual(ps.map((p) => p.ten).sort(), ['Lê Thị Cúc', 'Nguyễn Văn An']);
});

test('sơ đồ vụ việc trên máy: điều luật, hành vi, dòng tiền, chỉ đạo, vai trò, dòng thời gian, bản chất', () => {
  const m = buildCaseMap({ sources: SRC, known: [{ ten: 'Nguyễn Văn An', vaiTro: 'Bị can' }], primary: '353' });
  assert.equal(m.crimes[0].dieu, '353');
  assert.deepEqual(m.crimes[0].items[0].nguoi, ['Nguyễn Văn An']);
  assert.equal(m.crimes[0].items[0].soTien, '300 triệu đồng');
  const e = (a, b, t) => m.edges.find((x) => x.tu === a && x.den === b && x.loai === t);
  assert.equal(e('Nguyễn Văn An', 'Trần Văn Bình', 'tien').soTien, '100 triệu đồng');
  assert.ok(e('Trần Văn Bình', 'Nguyễn Văn An', 'chi-dao'));
  assert.ok(e('Nguyễn Văn An', 'Lê Thị Cúc', 'tien'));
  assert.equal(m.people.find((p) => p.ten === 'Trần Văn Bình').vaiTro, 'Người chỉ đạo');
  assert.equal(m.people.find((p) => p.ten === 'Lê Thị Cúc').vaiTro, 'Người nhận tiền');
  assert.deepEqual(m.timeline.map((t) => t.thoiGian), ['05/03/2025', '10/04/2025', '06/2025']);
  assert.ok(m.banChat.some((t) => /Dòng tiền: Nguyễn Văn An → Trần Văn Bình: 100 triệu đồng/.test(t)));
  assert.ok(m.banChat.some((t) => /Điều 353/.test(t)));
  // Cây và sơ đồ quan hệ.
  const tree = caseMapToTree(m, 'Vụ A');
  assert.equal(tree.children[0].label, 'Điều 353');
  assert.ok(tree.children.some((c) => c.id === 'people') && tree.children.some((c) => c.id === 'time'));
  const svg = relationSvg(m);
  assert.equal((svg.match(/class="cm-node/g) || []).length, 3);
  assert.equal((svg.match(/class="cm-edge/g) || []).length, m.edges.length);
});

test('ghép kết quả AI: điều luật kiểm tra với Bộ luật, quan hệ, mốc thời gian', () => {
  const base = buildCaseMap({ sources: SRC });
  const m = mergeAiCaseMap(base, JSON.stringify({ tomTat: 'Tham ô qua chi khống.', banChat: ['A chiếm đoạt 300 triệu'], nguoi: [{ ten: 'Phạm D', vaiTro: 'Người môi giới' }], hanhVi: [{ ten: 'Chi khống', dieu: '353', nguoi: ['Nguyễn Văn An'], soTien: '300 triệu' }, { ten: 'Việc lạ', dieu: '9999' }], quanHe: [{ tu: 'Phạm D', den: 'Nguyễn Văn An', loai: 'chi-dao', noiDung: 'môi giới' }], moc: [{ thoiGian: '01/02/2025', suKien: 'Bắt đầu' }] }));
  assert.ok(m.ai);
  assert.deepEqual(m.crimes.map((c) => c.dieu), ['353', '']);
  assert.ok(m.people.some((p) => p.ten === 'Phạm D' && p.vaiTro === 'Người môi giới'));
  assert.equal(m.edges[0].tu, 'Phạm D');
  assert.equal(m.timeline[0].suKien, 'Bắt đầu');
  assert.throws(() => mergeAiCaseMap(base, 'không phải JSON'));
});
