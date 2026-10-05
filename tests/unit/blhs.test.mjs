import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBlhsText, compareWithCatalog } from '../../assets/js/legal/blhs-import.js';
import { CATALOG } from '../../assets/js/legal/blhs-catalog.js';
import { rebuildCatalog, findCrime, ALL_CRIMES, CATALOG_STATUS, generatePlan, DOMAINS } from '../../assets/js/legal/engine.js';
import { recordsRepo, deleteRecords, restoreRecords } from '../../assets/js/legal/repo.js';

const SAMPLE = `PHẦN THỨ HAI
CÁC TỘI PHẠM
Chương XIV
CÁC TỘI XÂM PHẠM TÍNH MẠNG, SỨC KHỎE, NHÂN PHẨM, DANH DỰ CỦA CON NGƯỜI
Điều 123. Tội giết người
1. Người nào giết người thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 12 năm đến 20 năm, tù chung thân hoặc tử hình:
a) Giết 02 người trở lên;
b) Giết người dưới 16 tuổi;
c) Giết phụ nữ mà biết là có thai;
2. Phạm tội không thuộc các trường hợp quy định tại khoản 1 Điều này, thì bị phạt tù từ 07 năm đến 15 năm.
3. Người chuẩn bị phạm tội này, thì bị phạt tù từ 01 năm đến 05 năm.
4. Người phạm tội còn có thể bị cấm hành nghề hoặc làm công việc nhất định từ 01 năm đến 05 năm, phạt quản chế hoặc cấm cư trú từ 01 năm đến 05 năm.
Điều 128. Tội vô ý làm chết người
1. Người nào vô ý làm chết người, thì bị phạt cải tạo không giam giữ đến 03 năm hoặc phạt tù từ 01 năm đến 05 năm.
2. Phạm tội làm chết 02 người trở lên, thì bị phạt tù từ 03 năm đến 10 năm.
Chương XXI
CÁC TỘI XÂM PHẠM AN TOÀN CÔNG CỘNG, TRẬT TỰ CÔNG CỘNG
Mục 1. CÁC TỘI XÂM PHẠM AN TOÀN GIAO THÔNG
Điều 264. Tội vi phạm quy định về duy tu, sửa chữa, quản lý công trình giao thông đường bộ[12]
1. Người nào có trách nhiệm trong việc duy tu, sửa chữa, quản lý các công trình giao thông mà vi phạm quy định gây thiệt hại cho người khác, thì bị phạt tiền.
2. Phạm tội thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 03 năm đến 10 năm:
a) Làm chết người;
b) Gây thiệt hại về tài sản từ 500.000.000 đồng đến dưới 1.500.000.000 đồng.
Điều 292. (được bãi bỏ)
Điều 266. Tội đua xe trái phép
1. Người nào đua trái phép xe ô tô, xe máy hoặc các loại xe khác có gắn động cơ thuộc một trong các trường hợp sau đây, thì bị phạt tiền:
a) Gây thiệt hại cho sức khỏe của người khác;
2. Phạm tội thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 03 năm đến 08 năm:
a) Có tổ chức;
b) Tái phạm về tội này;
Chương XXII
CÁC TỘI XÂM PHẠM TRẬT TỰ QUẢN LÝ HÀNH CHÍNH
Điều 330. Tội chống người thi hành công vụ
1. Người nào dùng vũ lực, đe dọa dùng vũ lực hoặc dùng thủ đoạn khác cản trở người thi hành công vụ thực hiện công vụ của họ, thì bị phạt tù.
Điều 351a. Tội mới bổ sung để thử
1. Người nào thực hiện hành vi thử nghiệm, thì bị phạt tiền.
Điều 426. Hiệu lực thi hành
Bộ luật này có hiệu lực.`;

test('đọc văn bản Bộ luật: chương, mục, điều, khoản, điểm, bãi bỏ; bỏ chú thích; chỉ lấy Phần các tội phạm', () => {
  const p = parseBlhsText(SAMPLE);
  assert.deepEqual(Object.keys(p.articles).sort(), ['123', '128', '264', '266', '292', '330', '351a']);
  assert.equal(p.articles['123'].ten, 'Tội giết người');
  assert.equal(p.articles['123'].chuong, 'XIV');
  assert.equal(p.chapters.XIV, 'CÁC TỘI XÂM PHẠM TÍNH MẠNG, SỨC KHỎE, NHÂN PHẨM, DANH DỰ CỦA CON NGƯỜI');
  assert.equal(p.articles['264'].ten, 'Tội vi phạm quy định về duy tu, sửa chữa, quản lý công trình giao thông đường bộ');
  assert.equal(p.articles['264'].muc, 'Mục 1. CÁC TỘI XÂM PHẠM AN TOÀN GIAO THÔNG');
  assert.equal(p.articles['292'].baiBo, true);
  // khoản 1 → dấu hiệu; điểm khoản 2+ → định khung; bỏ khoản hình phạt bổ sung
  assert.match(p.articles['123'].dauHieu[0], /^Người nào giết người thuộc một trong các trường hợp sau đây$/);
  assert.ok(p.articles['123'].dauHieu.includes('Giết 02 người trở lên'));
  assert.ok(p.articles['123'].dinhKhung.includes('Chuẩn bị phạm tội (khoản 3)'));
  assert.ok(!p.articles['123'].dinhKhung.some((d) => /cấm hành nghề/.test(d)));
  assert.deepEqual(p.articles['266'].dinhKhung, ['Có tổ chức (khoản 2)', 'Tái phạm về tội này (khoản 2)']);
  assert.match(p.articles['123'].text, /^1\. Người nào giết người/);
  const cmp = compareWithCatalog(p, CATALOG, { 123: 'Tội giết người' });
  assert.deepEqual(cmp.repealed, ['292']);
  assert.ok(cmp.added.some((x) => x.dieu === '264'), 'điều chưa có tên trong dữ liệu tích hợp được bổ sung');
  assert.ok(cmp.added.some((x) => x.dieu === '351a'));
});

test('áp dụng nguyên văn: điều ẩn hiện ra, định khung theo văn bản, điều mới vào đúng lĩnh vực; gỡ thì quay lại', () => {
  const before = ALL_CRIMES.length;
  assert.equal(findCrime('264'), null);
  assert.ok(CATALOG_STATUS.hidden.includes('264'));
  const p = parseBlhsText(SAMPLE);
  rebuildCatalog({ importedAt: 1, source: 'mẫu thử', ...p });
  const c264 = findCrime('264');
  assert.equal(c264.linhVuc, 'giao-thong');
  assert.equal(c264.kiemTra, false);
  assert.ok(c264.nguyenVan.includes('duy tu'));
  assert.ok(c264.dinhKhung.includes('Làm chết người (khoản 2)'));
  assert.equal(findCrime('351a').linhVuc, 'hanh-chinh');
  assert.equal(findCrime('266').dinhKhung[0], 'Có tổ chức (khoản 2)');
  assert.ok(findCrime('123').nguyenVan, 'tội có dữ liệu sinh theo mẫu cũng gắn nguyên văn');
  assert.ok(ALL_CRIMES.length >= before + 2);
  assert.ok(DOMAINS.find((d) => d.id === 'giao-thong').crimes.some((c) => c.dieu === '264'));
  const plan = generatePlan({ dieu: '264', roleId: 'bi-can', dinhKhung: ['Làm chết người (khoản 2)'] });
  assert.ok(plan.issues.some((i) => i.key === 'dinh-khung'));
  rebuildCatalog(null);
  assert.equal(findCrime('264'), null);
  assert.equal(ALL_CRIMES.length, before);
});

test('xóa biên bản và hoàn tác khôi phục nguyên trạng', () => {
  const a = recordsRepo.save({ nguoiKhai: { hoTen: 'A' }, qa: [{ q: 'x', a: 'y' }] });
  const b = recordsRepo.save({ nguoiKhai: { hoTen: 'B' }, qa: [] });
  const removed = deleteRecords([a.id, b.id]);
  assert.equal(removed.length, 2);
  assert.equal(recordsRepo.get(a.id), null);
  restoreRecords(removed);
  assert.deepEqual(recordsRepo.get(a.id), a);
  assert.equal(recordsRepo.get(b.id).updatedAt, b.updatedAt);
});
