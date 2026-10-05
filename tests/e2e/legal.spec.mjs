import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { trackErrors, mockClaude, freshApp, setApiKey, loginAs, SUPER } from './helpers.mjs';
import { docxToText } from '../../assets/js/lib/docx.js';

test.describe('Cây hỏi đáp pháp luật', () => {
  test('điều hướng Kinh tế → Đấu thầu → Điều 222, chọn hành vi, sinh vấn đề và câu hỏi', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal');
    await expect(page.locator('.lg-domain-card')).toHaveCount(4);
    // Nhóm Đấu thầu mở sẵn: thu gọn rồi mở lại
    await page.locator('[data-toggle="kinh-te/dau-thau"]').click();
    await expect(page.locator('.lg-leaf[data-crime="222"]')).toHaveCount(0);
    await page.locator('[data-toggle="kinh-te/dau-thau"]').click();
    await page.locator('.lg-leaf[data-crime="222"]').click();
    await expect(page).toHaveURL(/#legal\/222$/);
    await expect(page.locator('.lg-crime h1')).toHaveText('Tội vi phạm quy định về đấu thầu gây hậu quả nghiêm trọng');
    await expect(page.locator('.lg-crumbs')).toContainText('Đấu thầu');

    const before = await page.locator('.lg-issue').count();
    await page.locator('[data-hv="thong-thau"]').check();
    await expect(page.locator('.lg-issue')).toHaveCount(before + 1);
    await expect(page.locator('[data-issue="hv-thong-thau"]')).toContainText('quân xanh');
    // Chuyên môn đấu thầu
    await page.locator('[data-issue="chuyen-mon"] summary').click();
    await expect(page.locator('[data-issue="chuyen-mon"]')).toContainText('[Đấu thầu');

    // Định khung
    await page.locator('[data-dk="Vì vụ lợi"]').click();
    await expect(page.locator('[data-issue="dinh-khung"]')).toContainText('Vì vụ lợi');

    // Không cho bỏ hết hành vi
    await page.locator('[data-hv="can-thiep"]').uncheck();
    await page.locator('[data-hv="thong-thau"]').click();
    await expect(page.locator('.toast').last()).toContainText('ít nhất một hành vi');
    await expect(page.locator('[data-hv="thong-thau"]')).toBeChecked();
    t.assertClean();
  });

  test('đổi đối tượng lời khai thay đổi bộ vấn đề', async ({ page }) => {
    await freshApp(page, '#legal/354');
    await expect(page.locator('[data-issue="tang-nang-giam-nhe"]')).toHaveCount(1);
    await page.locator('[data-role="lam-chung"]').click();
    await expect(page.locator('[data-issue="tang-nang-giam-nhe"]')).toHaveCount(0);
    await expect(page.locator('[data-issue="nhan-than"]')).toContainText('hoàn cảnh nào');
    await page.locator('[data-role="bi-hai"]').click();
    await expect(page.locator('[data-issue="y-kien-bi-hai"]')).toHaveCount(1);
  });

  test('tìm kiếm không dấu theo hành vi và số điều', async ({ page }) => {
    await freshApp(page, '#legal');
    await page.fill('[data-q]', 'thong thau');
    await expect(page.locator('.lg-hits [data-crime="222"]')).toBeVisible();
    await page.fill('[data-q]', '235');
    await page.locator('.lg-hits [data-crime="235"]').click();
    await expect(page.locator('.lg-crime h1')).toHaveText('Tội gây ô nhiễm môi trường');
  });

  test('tinh chỉnh câu hỏi: thêm, sửa, xóa, lưu vào bộ câu hỏi của tôi', async ({ page }) => {
    await freshApp(page, '#legal/353');
    const issue = page.locator('[data-issue="dong-pham"]');
    await issue.locator('summary').click();
    const n = await issue.locator('.lg-q').count();
    await issue.locator('.lg-add input').fill('Ai là người duyệt cuối cùng các phiếu chi?');
    await issue.locator('.lg-add button[type="submit"]').click();
    await expect(issue.locator('.lg-q')).toHaveCount(n + 1);
    await expect(issue.locator('.lg-q').last()).toContainText('duyệt cuối cùng');

    // Sửa
    await issue.locator('.lg-q').first().hover();
    await issue.locator('.lg-q').first().locator('[data-qedit]').click();
    await issue.locator('.lg-q').first().locator('textarea').fill('Câu hỏi đã sửa về đồng phạm?');
    await issue.locator('.lg-q').first().locator('[data-qsave]').click();
    await expect(issue.locator('.lg-q').first()).toContainText('Câu hỏi đã sửa về đồng phạm?');

    // Xóa
    await issue.locator('.lg-q').nth(1).hover();
    await issue.locator('.lg-q').nth(1).locator('[data-qdel]').click();
    await expect(issue.locator('.lg-q')).toHaveCount(n);

    // Lưu vào bộ của tôi → xuất hiện lại khi mở Điều 353 lần sau
    await issue.locator('.lg-q').last().hover();
    await issue.locator('.lg-q').last().locator('[data-qkeep]').click();
    await page.goto('/app.html#legal/356');
    await page.goto('/app.html#legal/353');
    await page.locator('[data-issue="dong-pham"] summary').click();
    await expect(page.locator('[data-issue="dong-pham"] .lg-q', { hasText: 'duyệt cuối cùng' })).toHaveCount(1);
    await expect(page.locator('[data-issue="dong-pham"] .src-tuy-chinh').first()).toBeVisible();
  });

  test('sơ đồ cây và tài liệu cần thu thập', async ({ page }) => {
    await freshApp(page, '#legal/222');
    await page.locator('[data-tab="map"]').click();
    await expect(page.locator('.mm-root')).toContainText('Điều 222');
    await expect(page.locator('.mm-act').first()).toBeVisible();
    expect(await page.locator('[data-links] path').count()).toBeGreaterThan(5);
    await page.locator('.mm-issue').nth(2).click();
    await expect(page.locator('[data-tab="issues"]')).toHaveAttribute('aria-selected', 'true');
    await page.locator('[data-tab="docs"]').click();
    await expect(page.locator('.lg-docs')).toContainText('mạng đấu thầu quốc gia');
    await expect(page.locator('.lg-docs')).toContainText('Điều 60');
  });

  test('xuất kế hoạch hỏi ra Word và lưu kế hoạch vào hồ sơ', async ({ page }) => {
    await freshApp(page, '#legal/200');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-export-plan]').click()]);
    const text = await docxToText(readFileSync(await dl.path()));
    expect(text).toContain('KẾ HOẠCH LẤY LỜI KHAI');
    expect(text).toContain('Điều 200');
    await page.locator('[data-save-plan]').click();
    await page.locator('.modal [name="title"]').fill('KH hỏi giám đốc công ty');
    await page.locator('.modal button[type="submit"]').click();
    await expect(page).toHaveURL(/#legal\/plan\//);
    await page.goto('/app.html#cases');
    await expect(page.locator('.doc-list')).toContainText('KH hỏi giám đốc công ty');
    await page.locator('a', { hasText: 'KH hỏi giám đốc công ty' }).click();
    await expect(page.locator('.lg-crime h1')).toHaveText('Tội trốn thuế');
  });
});

test.describe('Hồ sơ vụ án và ghi lời khai', () => {
  async function setupCase(page) {
    await freshApp(page, '#cases');
    await page.locator('[data-new]').click();
    await page.fill('#c-ten', 'Vụ tham ô tại Ban QLDA huyện Yên Mô');
    await page.fill('#c-so', '125/2026');
    await page.fill('#c-td', '353, 222');
    await expect(page.locator('[data-td-hint]')).toContainText('tham ô');
    await page.locator('.modal button[type="submit"]').click();
    await expect(page.locator('.case-head h1')).toHaveText('Vụ tham ô tại Ban QLDA huyện Yên Mô');
    await page.locator('[data-add-person]').click();
    await page.selectOption('#p-role', 'bi-can');
    await page.fill('#p-hoTen', 'Nguyễn Văn Bình');
    await page.fill('#p-ngaySinh', '12/03/1980');
    await page.fill('#p-noiCuTru', 'Yên Mô, Ninh Bình');
    await page.locator('.modal button[type="submit"]').click();
    await page.locator('[data-add-person]').click();
    await page.selectOption('#p-role', 'lam-chung');
    await page.fill('#p-hoTen', 'Trần Thị Hoa');
    await page.locator('.modal button[type="submit"]').click();
    await expect(page.locator('[data-pid]')).toHaveCount(2);
  }

  test('tạo hồ sơ, thêm người, hỏi cung theo kế hoạch, xuất biên bản Word', async ({ page }) => {
    const t = trackErrors(page);
    await setupCase(page);
    await page.locator('[data-pid]', { hasText: 'Nguyễn Văn Bình' }).locator('[data-interview]').click();
    await page.selectOption('#si-plan', 'auto:353');
    await page.locator('.modal button[type="submit"]').click();
    await expect(page).toHaveURL(/#interview\//);
    await expect(page.locator('[data-who]')).toHaveText('Nguyễn Văn Bình');
    await expect(page.locator('[data-whosub]')).toContainText('Điều 353');

    // Thông báo quyền
    await page.locator('[data-rights]').click();
    await expect(page.locator('.modal')).toContainText('Điều 60');
    await page.locator('.modal [data-ok]').click();

    // Hỏi theo kế hoạch (vấn đề số 2 được mở sẵn)
    await expect(page.locator('.iv-issue').nth(1)).toHaveAttribute('open', '');
    const firstQ = page.locator('.iv-issue').nth(1).locator('[data-pq]').first();
    const qText = (await firstQ.textContent()).trim();
    await firstQ.click();
    await expect(page.locator('[data-q]')).toHaveValue(qText);
    await page.fill('[data-a]', 'Tôi đã lập 05 phiếu chi khống theo chỉ đạo của ông Lê Văn Cường.');
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('.iv-qa')).toHaveCount(1);
    await expect(page.locator('.iv-issue').nth(1).locator('.iv-pq.asked')).toHaveCount(1);
    // Câu tiếp theo của cùng vấn đề được nạp sẵn
    await expect(page.locator('[data-q]')).not.toHaveValue('');

    // Câu hỏi ngoài kế hoạch
    await page.fill('[data-q]', 'Anh nhận bao nhiêu tiền?');
    await page.fill('[data-a]', 'em nhận 50 triệu đồng ,không nhớ ngày');
    await page.locator('[data-normalize]').click();
    await expect(page.locator('[data-a]')).toHaveValue('Tôi nhận 50 triệu đồng, không nhớ ngày.');
    await page.locator('[data-submit]').click();
    await expect(page.locator('.iv-qa')).toHaveCount(2);

    // Sửa lượt 2
    await page.locator('.iv-qa').nth(1).locator('[data-edit]').click();
    await page.fill('[data-a]', 'Tôi nhận 70 triệu đồng tại quán cà phê.');
    await page.locator('[data-submit]').click();
    await expect(page.locator('.iv-qa').nth(1)).toContainText('70 triệu');

    // Trợ lý cục bộ
    await page.locator('[data-run]').click();
    await expect(page.locator('.iv-ai-list li').first()).toBeVisible();
    await page.locator('[data-aitab="cover"]').click();
    await page.locator('[data-run]').click();
    await expect(page.locator('.iv-ai-sum')).toContainText('vấn đề');

    // Đánh dấu đã rõ
    await page.locator('.iv-issue').nth(1).locator('[data-cov="ro"]').click();
    await expect(page.locator('[data-progress]')).toContainText('1/');

    // Kết thúc + xuất Word
    await page.locator('[data-finish]').click();
    await expect(page.locator('.modal .vb-page')).toContainText('BIÊN BẢN HỎI CUNG BỊ CAN');
    await page.locator('.modal [data-close]').first().click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-export]').click()]);
    const text = await docxToText(readFileSync(await dl.path()));
    expect(text).toContain('BIÊN BẢN HỎI CUNG BỊ CAN');
    expect(text).toContain('NGUYỄN VĂN BÌNH');
    expect(text).toContain('Trả lời: Tôi nhận 70 triệu đồng tại quán cà phê.');
    expect(text).toContain('Điều 178, Điều 183 và Điều 184 Bộ luật Tố tụng hình sự năm 2015');

    // Danh sách biên bản trong hồ sơ
    await page.goto('/app.html#cases');
    await page.locator('.case-card').click();
    await page.locator('[data-tab="records"]').click();
    await expect(page.locator('.doc-item')).toContainText('Nguyễn Văn Bình — lần 1');
    await expect(page.locator('.doc-item .badge')).toHaveText('Hoàn thành');
    t.assertClean();
  });

  test('đối chiếu mâu thuẫn giữa lời khai bị can và người làm chứng', async ({ page }) => {
    await setupCase(page);
    // Biên bản người làm chứng
    await page.locator('[data-pid]', { hasText: 'Trần Thị Hoa' }).locator('[data-interview]').click();
    await page.locator('.modal button[type="submit"]').click();
    await page.fill('[data-q]', 'Chị biết gì về việc giao tiền?');
    await page.fill('[data-a]', 'Tôi thấy ông Bình nhận 100 triệu đồng từ ông Cường.');
    await page.keyboard.press('Control+Enter');
    // Biên bản bị can
    await page.goto('/app.html#cases');
    await page.locator('.case-card').click();
    await page.locator('[data-pid]', { hasText: 'Nguyễn Văn Bình' }).locator('[data-interview]').click();
    await page.locator('.modal button[type="submit"]').click();
    await page.fill('[data-q]', 'Anh nhận bao nhiêu tiền?');
    await page.fill('[data-a]', 'Tôi chỉ nhận 50 triệu đồng.');
    await page.keyboard.press('Control+Enter');
    await page.locator('[data-aitab="contra"]').click();
    await page.locator('[data-run]').click();
    await expect(page.locator('.iv-ai-list')).toContainText('không thống nhất');
    await expect(page.locator('.iv-ai-list')).toContainText('Trần Thị Hoa');
    await page.locator('[data-use-contra]').first().click();
    await expect(page.locator('[data-q]')).toHaveValue(/khác nhau/);
    // Tab đối chiếu trong hồ sơ
    await page.goto('/app.html#cases');
    await page.locator('.case-card').click();
    await page.locator('[data-tab="cross"]').click();
    await page.locator('[data-cross]').click();
    await expect(page.locator('[data-cross-out]')).toContainText('không thống nhất');
  });

  test('biên bản người làm chứng: thông tin biên bản, cảnh báo khai báo gian dối', async ({ page }) => {
    await freshApp(page, '#interview');
    await page.locator('[data-new]').click();
    const modal = page.locator('.modal');
    await expect(modal).toContainText('Thông tin biên bản');
    await modal.locator('[name="roleId"]').selectOption('lam-chung');
    await modal.locator('[name="nk_hoTen"]').fill('Phạm Văn Đông');
    await modal.locator('[name="diaDiem"]').fill('Trụ sở Công an huyện');
    await modal.locator('[name="nth_hoTen"]').fill('Trần Minh Đức');
    await modal.locator('[name="thamGia"]').fill('Lê Thị Mai — Người phiên dịch');
    await modal.locator('[name="daThongBaoQuyen"]').check();
    await modal.locator('button[type="submit"]').click();
    await expect(page.locator('[data-who]')).toHaveText('Phạm Văn Đông');
    await page.locator('[data-preview]').click();
    const doc = page.locator('.modal .vb-page');
    await expect(doc).toContainText('BIÊN BẢN GHI LỜI KHAI');
    await expect(doc).toContainText('Điều 382 và Điều 383');
    await expect(doc).toContainText('NGƯỜI PHIÊN DỊCH');
    await expect(doc).toContainText('Trần Minh Đức — Điều tra viên');
    await expect(doc).toContainText('người khai xác nhận đã được nghe, hiểu rõ quyền và nghĩa vụ');
  });

  test('xóa hồ sơ xóa luôn biên bản', async ({ page }) => {
    await setupCase(page);
    await page.locator('[data-pid]').first().locator('[data-interview]').click();
    await page.locator('.modal button[type="submit"]').click();
    await page.goto('/app.html#cases');
    await page.locator('.case-card').click();
    await page.locator('[data-del]').click();
    await page.locator('.modal').getByRole('button', { name: 'Xóa vĩnh viễn' }).click();
    await expect(page).toHaveURL(/#cases$/);
    await page.goto('/app.html#interview');
    await expect(page.locator('.empty')).toContainText('Chưa có biên bản');
  });
});

test.describe('AI phân tích lời khai (API giả lập)', () => {
  test('gợi ý câu hỏi, mâu thuẫn, mức độ làm rõ, chuẩn hóa và gợi ý thêm cho cây', async ({ page }) => {
    const calls = await mockClaude(page, (body) => {
      const p = JSON.stringify(body.messages);
      if (p.includes('câu hỏi truy tiếp')) return '{"cauHoi":[{"text":"Ông Cường đưa tiền cho anh bằng phong bì hay chuyển khoản?","lyDo":"Làm rõ phương thức","issueId":null}]}';
      if (p.includes('mâu thuẫn')) return '{"mauThuan":[{"moTa":"Số tiền nhận khai khác nhau","trichDan":["[1] 50 triệu","[2] 70 triệu"],"mucDo":"cao","cauHoiLamRo":"Vì sao anh khai hai số tiền khác nhau?"}]}';
      if (p.includes('Đánh giá từng vấn đề')) return '{"tongQuan":"Mới làm rõ một phần hành vi.","danhGia":[{"issueId":"nhan-than","mucDo":"ro","nhanXet":"Đủ","conThieu":""}]}';
      if (p.includes('Chuẩn hóa')) return 'Tôi nhận 50 triệu đồng từ ông Cường.';
      if (p.includes('bổ sung 6–10 câu hỏi')) return '{"cauHoi":[{"issueKey":"dong-pham","text":"Ai là người giữ sổ quỹ đen của ban?"}]}';
      return '{}';
    });
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-good', 'claude-opus-5-5');

    // Cây: AI gợi ý thêm
    await page.goto('/app.html#legal/353');
    await page.locator('[data-ai-more]').click();
    await page.locator('[data-issue="dong-pham"] summary').click();
    await expect(page.locator('[data-issue="dong-pham"] .src-ai')).toHaveCount(1);
    await expect(page.locator('[data-issue="dong-pham"]')).toContainText('quỹ đen');

    // Ghi lời khai
    await page.locator('[data-start]').click();
    await page.fill('#st-name', 'Nguyễn Văn Bình');
    await page.locator('.modal button[type="submit"]').click();
    await expect(page).toHaveURL(/#interview\//);
    await page.fill('[data-q]', 'Anh nhận bao nhiêu?');
    await page.fill('[data-a]', 'em nhận 50 triệu của ông cường');
    await page.locator('[data-normalize]').click();
    await expect(page.locator('[data-a]')).toHaveValue('Tôi nhận 50 triệu đồng từ ông Cường.');
    await page.locator('[data-submit]').click();
    await expect(page.locator('.iv-qa')).toHaveCount(1);
    await page.locator('[data-run]').click();
    await expect(page.locator('.iv-ai-list')).toContainText('phong bì');
    await page.locator('[data-use]').first().click();
    await expect(page.locator('[data-q]')).toHaveValue(/phong bì/);
    await page.locator('[data-aitab="contra"]').click();
    await page.locator('[data-run]').click();
    await expect(page.locator('.iv-ai-list')).toContainText('khai khác nhau');
    await page.locator('[data-aitab="cover"]').click();
    await page.locator('[data-run]').click();
    await expect(page.locator('.iv-ai-sum')).toContainText('Mới làm rõ');
    await page.locator('[data-apply-cov]').click();
    await expect(page.locator('.iv-issue').first().locator('.cov-ok')).toBeVisible();

    const analysis = calls.filter((c) => JSON.stringify(c.body.messages).includes('câu hỏi truy tiếp')).at(-1);
    expect(analysis.body.system).toContain('điều tra viên cao cấp');
    expect(JSON.stringify(analysis.body.messages)).toContain('Tôi nhận 50 triệu đồng từ ông Cường.');
  });
});
