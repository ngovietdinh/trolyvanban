import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

// Sách mẫu (.txt) theo cấu trúc sách Bình luận: nguyên văn các điều 38, 51, 52, 54, 65, 174 + điều đệm cho đủ ≥ 50 điều.
const BOOK = [
  'BÌNH LUẬN MẪU',
  'PHẦN THỨ NHẤT',
  'NHỮNG QUY ĐỊNH CHUNG',
  'CHƯƠNG VI',
  'HÌNH PHẠT',
  'Điều 38. Tù có thời hạn',
  '1. Tù có thời hạn là buộc người bị kết án phải chấp hành hình phạt tại cơ sở giam giữ trong một thời hạn nhất định.',
  'Tù có thời hạn đối với người phạm một tội có mức tối thiểu là 03 tháng và mức tối đa là 20 năm.',
  'Bình luận',
  'Bình luận mẫu.',
  'CHƯƠNG VIII',
  'QUYẾT ĐỊNH HÌNH PHẠT',
  'Điều 51. Các tình tiết giảm nhẹ trách nhiệm hình sự',
  '1. Các tình tiết sau đây là tình tiết giảm nhẹ trách nhiệm hình sự:',
  'a) Người phạm tội đã ngăn chặn hoặc làm giảm bớt tác hại của tội phạm;',
  'b) Người phạm tội tự nguyện sửa chữa, bồi thường thiệt hại hoặc khắc phục hậu quả;',
  'i) Phạm tội lần đầu và thuộc trường hợp ít nghiêm trọng;',
  'r) Người phạm tội tự thú;',
  's) Người phạm tội thành khẩn khai báo, ăn năn hối cải;',
  'x) Người phạm tội là người có công với cách mạng hoặc là cha, mẹ, vợ, chồng, con của liệt sĩ.',
  '2. Khi quyết định hình phạt, Tòa án có thể coi đầu thú hoặc tình tiết khác là tình tiết giảm nhẹ, nhưng phải ghi rõ lý do giảm nhẹ trong bản án.',
  '3. Các tình tiết giảm nhẹ đã được Bộ luật này quy định là dấu hiệu định tội hoặc định khung thì không được coi là tình tiết giảm nhẹ trong khi quyết định hình phạt.',
  'Bình luận',
  'Bình luận mẫu.',
  'Điều 52. Các tình tiết tăng nặng trách nhiệm hình sự',
  '1. Chỉ các tình tiết sau đây mới là tình tiết tăng nặng trách nhiệm hình sự:',
  'a) Phạm tội có tổ chức;',
  'b) Phạm tội có tính chất chuyên nghiệp;',
  'h) Tái phạm hoặc tái phạm nguy hiểm;',
  '2. Các tình tiết đã được Bộ luật này quy định là dấu hiệu định tội hoặc định khung hình phạt thì không được coi là tình tiết tăng nặng.',
  'Bình luận',
  'Bình luận mẫu.',
  'Điều 54. Quyết định hình phạt dưới mức thấp nhất của khung hình phạt được áp dụng',
  '1. Tòa án có thể quyết định một hình phạt dưới mức thấp nhất của khung hình phạt được áp dụng nhưng phải trong khung hình phạt liền kề nhẹ hơn của điều luật khi người phạm tội có ít nhất hai tình tiết giảm nhẹ quy định tại khoản 1 Điều 51 của Bộ luật này.',
  '2. Tòa án có thể quyết định một hình phạt dưới mức thấp nhất của khung hình phạt được áp dụng nhưng không bắt buộc phải trong khung hình phạt liền kề nhẹ hơn của điều luật đối với người phạm tội lần đầu là người giúp sức trong vụ án đồng phạm nhưng có vai trò không đáng kể.',
  'Bình luận',
  'Bình luận mẫu.',
  'Điều 65. Án treo',
  '1. Khi xử phạt tù không quá 03 năm, căn cứ vào nhân thân của người phạm tội và các tình tiết giảm nhẹ, nếu xét thấy không cần phải bắt chấp hành hình phạt tù, thì Tòa án cho hưởng án treo và ấn định thời gian thử thách từ 01 năm đến 05 năm và thực hiện các nghĩa vụ trong thời gian thử thách theo quy định của Luật thi hành án hình sự.',
  'Bình luận',
  'Bình luận mẫu.',
  ...Array.from({ length: 50 }, (_, i) => `Điều ${100 + i}. Điều mẫu số ${100 + i}\nNội dung điều luật mẫu ${100 + i}.\nBình luận\nBình luận mẫu ${100 + i}.`),
  'PHẦN THỨ HAI',
  'CÁC TỘI PHẠM',
  'CHƯƠNG XVI',
  'CÁC TỘI XÂM PHẠM SỞ HỮU',
  'Điều 174. Tội lừa đảo chiếm đoạt tài sản',
  '1. Người nào bằng thủ đoạn gian dối chiếm đoạt tài sản của người khác trị giá từ 2.000.000 đồng đến dưới 50.000.000 đồng hoặc dưới 2.000.000 đồng nhưng thuộc một trong các trường hợp sau đây, thì bị phạt cải tạo không giam giữ đến 03 năm hoặc phạt tù từ 06 tháng đến 03 năm:',
  'a) Đã bị xử phạt vi phạm hành chính về hành vi chiếm đoạt tài sản mà còn vi phạm;',
  '2. Phạm tội thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 02 năm đến 07 năm:',
  'a) Có tổ chức;',
  'b) Có tính chất chuyên nghiệp;',
  'c) Chiếm đoạt tài sản trị giá từ 50.000.000 đồng đến dưới 200.000.000 đồng;',
  '3. Phạm tội thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 07 năm đến 15 năm:',
  'a) Chiếm đoạt tài sản trị giá từ 200.000.000 đồng đến dưới 500.000.000 đồng;',
  '4. Phạm tội thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 12 năm đến 20 năm hoặc tù chung thân:',
  'a) Chiếm đoạt tài sản trị giá 500.000.000 đồng trở lên;',
  '5. Người phạm tội còn có thể bị phạt tiền từ 10.000.000 đồng đến 100.000.000 đồng.',
  'Bình luận',
  'Bình luận mẫu.',
].join('\n');

const BAN_AN = `NHẬN THẤY: Bị cáo Nguyễn Văn An đã dùng thủ đoạn gian dối, đưa thông tin sai sự thật về dự án đất nền để chị Trần Thị Bình tin tưởng giao tiền, chiếm đoạt số tiền 180.000.000 đồng.
Tại phiên tòa bị cáo thành khẩn khai báo, ăn năn hối cải. Gia đình bị cáo đã bồi thường cho bị hại 50.000.000 đồng.
QUYẾT ĐỊNH: Tuyên bố bị cáo Nguyễn Văn An phạm tội "Lừa đảo chiếm đoạt tài sản".
Áp dụng điểm a khoản 3 Điều 174; điểm s khoản 1 Điều 51; điểm b khoản 1 Điều 52 của Bộ luật Hình sự.
Xử phạt bị cáo Nguyễn Văn An 08 (tám) năm tù, thời hạn tù tính từ ngày bắt tạm giam.`;

const DON = `ĐƠN KHÁNG CÁO
Kính gửi: Tòa án nhân dân thành phố Hà Nội
Tôi tên là: Nguyễn Văn An, sinh năm 1985
Nơi cư trú: thôn Đông, xã Tây, huyện Nam, tỉnh Bắc
Là bị cáo trong vụ án theo Bản án hình sự sơ thẩm số 25/2026/HS-ST ngày 15/10/2026 của Tòa án nhân dân huyện X.
1. Tòa án áp dụng khoản 3 Điều 174 là không đúng, số tiền chỉ 180.000.000 đồng nên phải xử theo khoản 2 Điều 174.
2. Gia đình tôi đã bồi thường toàn bộ thiệt hại cho bị hại.
Vì vậy tôi kính đề nghị Tòa án cấp phúc thẩm xem xét giảm nhẹ hình phạt.
Tôi bị điều tra viên ép cung trong quá trình điều tra.
Hà Nội, ngày 20 tháng 10 năm 2026`;

test.describe('v2.39 — Tòa án: phân tích, kiểm tra bản án, xem xét đơn khiếu nại', () => {
  test('chưa nạp sách: báo thiếu; nút đọc bản án báo thiếu tài liệu', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#toa-an');
    await expect(page.locator('.empty')).toContainText('Chưa có hồ sơ xét xử');
    await page.click('[data-new="so-tham"]');
    await expect(page).toHaveURL(/#toa-an\/.+\/vu-an$/);
    await page.click('[data-ct-tab="tai-lieu"]');
    await expect(page.locator('[data-ct-book]')).toBeVisible();
    await page.click('[data-ct-parse]');
    await expect(page.locator('.toast').last()).toContainText('Chưa có tài liệu');
    t.assertClean();
  });

  test('nạp sách → dán bản án → đọc quyết định, phân tích, kiểm tra khung/mức, xem xét đơn kháng cáo nhận được, xuất phiếu Word', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#binh-luan');
    await page.locator('[data-bl-file]').setInputFiles({ name: 'binh-luan-mau.txt', mimeType: 'text/plain', buffer: Buffer.from(BOOK) });
    await expect(page.locator('.toast').last()).toContainText('Đã nạp');
    await page.goto('/app.html#toa-an');
    await page.click('[data-new="so-tham"]');
    await page.click('[data-ct-tab="tai-lieu"]');
    await expect(page.locator('[data-ct-book]')).toBeHidden();
    await page.fill('[data-ct-paste]', BAN_AN);
    await page.click('[data-ct-parse]');
    await expect(page.locator('.toast').last()).toContainText('Đã đọc 1 bị cáo');
    await expect(page.locator('[data-ct-sources]')).toContainText('Nội dung dán 1');
    await expect(page.locator('[data-def="0"] [data-f="hoTen"]')).toHaveValue('Nguyễn Văn An');
    await expect(page.locator('[data-def="0"] [data-t="dieu"]')).toHaveValue('174');

    // Tab phân tích hành vi, hướng giải quyết.
    await page.click('[data-ct-tab="phan-tich"]');
    await expect(page.locator('.ct-crime h4').first()).toContainText('Điều 174');
    await expect(page.locator('.ct-huong li').first()).toBeVisible();

    // Tab 2: kiểm tra — 180 triệu thuộc khoản 2, không phải khoản 3; Điều 52 b không có căn cứ; bỏ sót điểm b khoản 1 Điều 51.
    await page.click('[data-ct-tab="kiem-tra"]');
    const check = page.locator('[data-ct-out]');
    await expect(check.locator('.ct-f.lv-loi').first()).toContainText('khoản 2');
    await expect(check).toContainText('Có dấu hiệu sai');
    await expect(check.locator('.ct-f.lv-canh', { hasText: 'điểm b khoản 1 Điều 52' }).first()).toBeVisible();
    await expect(check.locator('.ct-f.lv-goi', { hasText: 'điểm b khoản 1 Điều 51' }).first()).toBeVisible();
    await expect(check.locator('.ct-law').first()).toBeVisible();
    await expect(check.locator('.ct-fact', { hasText: '180.000.000 đồng' }).first()).toBeVisible();

    // Tab 3: xem xét đơn người khác gửi đến — chưa có đơn thì báo thiếu; dán đơn → từng yêu cầu có kết luận, căn cứ.
    await page.click('[data-ct-tab="khieu-nai"]');
    await expect(page.locator('[data-ct-don]')).toBeVisible();
    await page.click('[data-don-add]');
    await expect(page.locator('.toast').last()).toContainText('Chưa có đơn');
    await page.fill('[data-don-paste]', DON);
    await page.click('[data-don-add]');
    await expect(page.locator('[data-don-list]')).toContainText('Đơn dán 1');
    const review = page.locator('[data-ct-out] .ct-review');
    await expect(review.locator('.ct-don-meta')).toContainText('Đơn kháng cáo');
    await expect(review.locator('.ct-don-meta')).toContainText('Nguyễn Văn An, sinh năm 1985');
    await expect(review.locator('.ct-don-meta')).toContainText('25/2026/HS-ST ngày 15/10/2026');
    await expect(review.locator('[data-don-overall]')).toHaveText('Đơn có căn cứ một phần');
    await expect(review.locator('[data-yc="doi-khoan"] .badge').first()).toHaveText('Có căn cứ');
    await expect(review.locator('[data-yc="thu-tuc"] .badge').first()).toHaveText('Cần xác minh thêm');
    await expect(review.locator('[data-yc="thu-tuc"] .ct-don-q')).toContainText('Tôi bị điều tra viên ép cung');
    await expect(review.locator('[data-yc="them-giam-nhe"] .ct-fact').first()).toContainText('Gia đình bị cáo đã bồi thường cho bị hại 50.000.000 đồng.');
    await expect(review.locator('.ct-notes')).toContainText('trong thời hạn kháng cáo 15 ngày');
    await page.click('[data-don-preview]');
    const modal = page.locator('.preview-modal');
    await expect(modal).toContainText('PHIẾU XEM XÉT ĐƠN');
    await expect(modal).toContainText('Đơn có căn cứ một phần');
    await expect(modal).toContainText('Căn cứ pháp lý');
    await expect(modal).toContainText('Căn cứ thực tế');
    await modal.locator('.modal-actions [data-close]').click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-don-export]')]);
    expect(dl.suggestedFilename()).toMatch(/\.docx$/);
    // Đổi tab rồi quay lại: đơn vẫn còn; bỏ đơn → báo chưa có đơn.
    await page.click('[data-ct-tab="kiem-tra"]');
    await expect(page.locator('[data-ct-don]')).toBeHidden();
    await page.click('[data-ct-tab="khieu-nai"]');
    await expect(review.locator('[data-don-overall]')).toBeVisible();
    await page.click('[data-don-del]');
    await expect(page.locator('[data-ct-out]')).toContainText('Tải đơn khiếu nại / kháng cáo đã nhận');
    await page.fill('[data-don-paste]', DON);
    await page.click('[data-don-add]');

    // Lưu trên máy: quay lại danh sách thấy hồ sơ.
    await page.goto('/app.html#toa-an');
    await expect(page.locator('.ct-list')).toContainText('Nguyễn Văn An');
    await expect(page.locator('.ct-list')).toContainText('1 đơn');
    t.assertClean();
  });
});
