import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchAll, matchAt, foldKeep, snippetOf, tokens } from '../../assets/js/lib/universal-search.js';

const src = {
  roleName: (id) => ({ 'bi-can': 'Bị can', 'nguoi-lam-chung': 'Người làm chứng' })[id] || '',
  cases: [{ id: 'c1', ten: 'Vụ tham ô tài sản tại Ban QLDA', soHoSo: '12/2026', toiDanh: ['353'], persons: [{ hoTen: 'Nguyễn Văn An', roleId: 'bi-can' }, { hoTen: 'Trần Thị Bình', roleId: 'nguoi-lam-chung' }], updatedAt: 2 }],
  records: [{ id: 'r1', caseId: 'c1', roleId: 'bi-can', lan: 2, ngay: '2026-03-05', nguoiKhai: { hoTen: 'Nguyễn Văn An' }, qa: [{ q: 'Anh chuyển bao nhiêu?', a: 'Tôi chuyển 100 triệu đồng cho Lê Văn Cường' }] }],
  docs: [{ id: 'd1', title: 'Công văn đề nghị cung cấp tài liệu', text: 'Kính gửi Ngân hàng Agribank chi nhánh huyện X' }],
  kho: [{ id: 'k1', ten: 'Kết luận thanh tra số 05', text: 'Phát hiện sai phạm trong thanh toán khối lượng', caseId: 'c1' }, { id: 'rec:r1', app: true, ten: 'BB trùng', text: 'Văn An' }],
  crimes: [{ dieu: '353', ten: 'Tội tham ô tài sản' }, { dieu: '174', ten: 'Tội lừa đảo chiếm đoạt tài sản' }],
  book: { articles: [{ so: '353', ten: 'Tội tham ô tài sản', vb: ['1. Người nào lợi dụng chức vụ…'], bl: ['Khách thể của tội tham ô là sở hữu{{fn:3}}.'] }] },
  mauForms: [{ id: 'm140', so: '140', ten: 'Biên bản ghi lời khai', nhom: 'Khởi tố, điều tra' }],
  forms: [{ id: 'qd-khoi-to', ten: 'Quyết định khởi tố vụ án' }],
};
const ids = (r) => Object.fromEntries(r.map((g) => [g.id, g.items.map((i) => i.title)]));

test('khớp đầu từ, không dấu: "an" khớp An/Anh, không khớp Ban/sản/Văn', () => {
  const f = foldKeep('Nguyễn Văn An ở Ban QLDA, anh ấy');
  assert.deepEqual(matchAt(f, 'an').map((i) => f.slice(i, i + 3)), ['an ', 'anh']);
  assert.deepEqual(tokens('  Trần  Văn, BÌNH '), ['tran', 'van', 'binh']);
  assert.equal(foldKeep('Đặng').length, 'Đặng'.length);
});

test('tìm chung: người, hồ sơ, nội dung lời khai, văn bản, kho; bỏ bản trùng của kho', () => {
  const r = ids(searchAll('van an', src));
  assert.deepEqual(r.persons, ['Nguyễn Văn An']);
  assert.deepEqual(r.records, ['Nguyễn Văn An — lần 2']);
  assert.deepEqual(r.cases, ['Vụ tham ô tài sản tại Ban QLDA']);
  assert.equal(r.kho, undefined, 'biên bản trong phần mềm không lặp lại ở nhóm Kho');
  const lk = searchAll('le van cuong', src).find((g) => g.id === 'records');
  assert.match(lk.items[0].snippet, /Lê Văn Cường/);
  assert.equal(lk.items[0].href, '#interview/r1');
  assert.deepEqual(ids(searchAll('agribank', src)).docs, ['Công văn đề nghị cung cấp tài liệu']);
  const k = searchAll('sai pham', src).find((g) => g.id === 'kho');
  assert.equal(k.items[0].href, '#kho/xem/k1');
  assert.match(k.items[0].snippet, /sai phạm/);
  assert.deepEqual(searchAll('xyz khong co', src), []);
});

test('số điều / số mẫu → đúng điều luật, bình luận, biểu mẫu; cụm từ trong bình luận có trích đoạn', () => {
  const r = ids(searchAll('353', src));
  assert.deepEqual(r.crimes, ['Điều 353. Tội tham ô tài sản']);
  assert.deepEqual(r.binhluan, ['Điều 353. Tội tham ô tài sản']);
  assert.deepEqual(ids(searchAll('140', src)).forms, ['Mẫu 140. Biên bản ghi lời khai']);
  const bl = searchAll('khach the', src).find((g) => g.id === 'binhluan');
  assert.equal(bl.items[0].snippet, 'Khách thể của tội tham ô là sở hữu.');
  assert.deepEqual(ids(searchAll('khoi to', src)).forms, ['Quyết định khởi tố vụ án', 'Mẫu 140. Biên bản ghi lời khai'], 'khớp tên trước, khớp nhóm mẫu sau');
});

test('trích đoạn quanh chỗ khớp, giới hạn độ dài', () => {
  const long = `${'a '.repeat(100)}Trần Văn Bình nhận tiền ${'b '.repeat(100)}`;
  const s = snippetOf(long, ['binh'], 60);
  assert.match(s, /^….*Trần Văn Bình.*…$/);
  assert.ok(s.length <= 62);
});
