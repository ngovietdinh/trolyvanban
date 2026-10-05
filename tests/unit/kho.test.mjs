import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDoc, chunkText, searchDocs, buildContext, localInterviewPlan, planFromIssues, personFromOlds, localIntent, roleFromText } from '../../assets/js/legal/kho.js';
import { FORMS } from '../../assets/js/legal/forms-catalog.js';
import { khoDb } from '../../assets/js/lib/kho-db.js';
import { setScope } from '../../assets/js/lib/store.js';

const BBLK1 = `Mẫu số: 140
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
BIÊN BẢN GHI LỜI KHAI ()
Hồi 9 giờ 00 phút ngày 5 tháng 10 năm 2026 tại Cơ quan CSĐT Bộ Công an.
Tôi: Nguyễn Bá Nhuận, Điều tra viên thuộc Cơ quan CSĐT Bộ Công an.
Họ tên: Trần Thiên Hà\t\tGiới tính: Nam;
Sinh ngày 26 tháng 05 năm 1971 tại thành phố Hà Nội;
Quốc tịch: Việt Nam; dân tộc: Kinh; Tôn giáo: Không
Nghề nghiệp: Tổng Giám đốc Công ty CP Chứng khoán APG
Thẻ CCCD: 001071023745; cấp ngày: 27/8/2022;
Số điện thoại liên hệ: 0921048011;
Nơi thường trú: Phòng 2306 Chung cư Lancaster, phường Giảng Võ, TP Hà Nội;
Tư cách tham gia tố tụng: Người có quyền lợi, nghĩa vụ liên quan đến vụ án.
HỎI VÀ ĐÁP
Hỏi: Anh ký bao nhiêu hợp đồng cầm cố tiền gửi?
Đáp: Tôi ký 08 hợp đồng, tổng cộng 238 tỷ đồng.
Hỏi: Ai yêu cầu anh ký?
Đáp: Tôi không nhớ rõ, hình như là anh Nguyễn Hồ Hưng.
Hỏi: Anh có nhận tiền không?
Đáp: Tôi có nhận 50 triệu đồng tiền công.`;
const BBLK2 = BBLK1.replace('ngày 5 tháng 10', 'ngày 20 tháng 10').replace('Tôi có nhận 50 triệu đồng tiền công.', 'Tôi có nhận 80 triệu đồng tiền công.');

test('nhận diện biên bản ghi lời khai: loại, ngày, nhân thân, tư cách, hỏi – đáp', () => {
  const a = analyzeDoc(BBLK1);
  assert.equal(a.loai, 'bblk');
  assert.equal(a.ngay, '05/10/2026');
  assert.equal(a.nguoi.hoTen, 'Trần Thiên Hà');
  assert.equal(a.nguoi.gioiTinh, 'Nam');
  assert.equal(a.nguoi.soDinhDanh, '001071023745');
  assert.equal(a.nguoi.ngheNghiep, 'Tổng Giám đốc Công ty CP Chứng khoán APG');
  assert.match(a.nguoi.noiCuTru, /^Phòng 2306/);
  assert.equal(a.roleId, 'lien-quan');
  assert.equal(a.qa.length, 3);
  assert.equal(a.qa[0].a, 'Tôi ký 08 hợp đồng, tổng cộng 238 tỷ đồng.');
  assert.equal(analyzeDoc('CỘNG HÒA\nQUYẾT ĐỊNH\nKhởi tố vụ án').loai, 'qd');
  assert.equal(analyzeDoc('KẾT LUẬN GIÁM ĐỊNH\nChữ ký trên tài liệu').loai, 'kl-giam-dinh');
  assert.equal(analyzeDoc('BIÊN BẢN HỎI CUNG BỊ CAN\nHọ tên: A').roleId, 'bi-can');
  assert.equal(roleFromText('Người làm chứng'), 'lam-chung');
});

test('chia đoạn, tìm kiếm không dấu có xếp hạng, ngữ cảnh đánh số trích dẫn', () => {
  assert.ok(chunkText('a'.repeat(3000)).length >= 3);
  const docs = [
    { id: 'd1', ten: 'BBLK lần 1', text: BBLK1 },
    { id: 'd2', ten: 'Kết luận giám định', text: 'KẾT LUẬN GIÁM ĐỊNH\nChữ ký đứng tên Trần Thiên Hà trên hợp đồng cầm cố là do cùng một người ký ra.' },
  ];
  const hits = searchDocs('chu ky hop dong cam co', docs);
  assert.equal(hits[0].docId, 'd2');
  assert.ok(searchDocs('Nguyễn Hồ Hưng', docs).some((h) => h.docId === 'd1'));
  const ctx = buildContext(hits);
  assert.match(ctx, /^\[1\] \(Kết luận giám định — đoạn 1\)/);
  assert.equal(searchDocs('xyzabc qwerty', docs).length, 0);
});

test('lập kế hoạch biên bản lời khai mới từ các biên bản cũ (ngoại tuyến): mâu thuẫn, khai chưa cụ thể, số liệu, trọng tâm', () => {
  const olds = [BBLK1, BBLK2].map((t, i) => ({ ten: `BBLK ${i + 1}`, ...analyzeDoc(t) }));
  const p = localInterviewPlan(olds, { focus: 'việc nhận tiền công', roleId: 'lien-quan' });
  const titles = p.issues.map((i) => i.tieuDe);
  assert.equal(titles[0], 'Mở đầu, xác nhận lời khai trước');
  assert.ok(titles.includes('Làm rõ điểm mâu thuẫn giữa các lần khai'));
  assert.ok(p.issues.find((i) => i.tieuDe.startsWith('Làm rõ điểm mâu thuẫn')).cauHoi.some((q) => /50 triệu|80 triệu/.test(q)));
  assert.ok(p.issues.find((i) => i.tieuDe === 'Làm rõ nội dung khai chưa cụ thể').cauHoi[0].includes('không nhớ rõ'));
  assert.ok(titles.some((t) => t.includes('việc nhận tiền công')));
  assert.match(titles.at(-1), /Kết thúc/);
  let n = 0;
  const plan = planFromIssues(p.issues, () => `q${++n}`);
  assert.equal(plan.issues[0].cauHoi[0].id, 'q1');
  assert.equal(personFromOlds(olds).soDinhDanh, '001071023745');
});

test('nhận diện yêu cầu khi không có AI: lập biên bản lời khai, tạo văn bản theo mẫu, hỏi đáp', () => {
  assert.equal(localIntent('Tạo biên bản lời khai mới dựa vào các bblk cũ để làm rõ việc nhận tiền', FORMS).action, 'bblk');
  assert.equal(localIntent('tạo bblk mới cho Trần Thiên Hà', FORMS).action, 'bblk');
  const f = localIntent('Tạo quyết định trưng cầu giám định chữ ký', FORMS);
  assert.equal(f.action, 'form');
  assert.equal(f.formId, 'qd-trung-cau-giam-dinh');
  assert.equal(localIntent('Lập giấy triệu tập người làm chứng Lê Văn C', FORMS).formId, 'giay-trieu-tap-lam-chung');
  assert.equal(localIntent('Ai yêu cầu ký hợp đồng?', FORMS).action, 'answer');
});

test('kho tài liệu tách riêng theo tài khoản', async () => {
  setScope('u1');
  const d = await khoDb.put({ ten: 'Tài liệu A', text: 'x' });
  assert.equal((await khoDb.list()).length, 1);
  setScope('u2');
  assert.equal((await khoDb.list()).length, 0);
  assert.equal(await khoDb.get(d.id), null);
  setScope('u1');
  await khoDb.patch(d.id, { loai: 'qd' });
  assert.equal((await khoDb.get(d.id)).loai, 'qd');
  assert.equal(await khoDb.clear(), 1);
  setScope(null);
});
