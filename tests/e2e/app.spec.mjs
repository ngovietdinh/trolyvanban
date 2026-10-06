import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { trackErrors, mockClaude, freshApp, setApiKey, loginAs, SUPER } from './helpers.mjs';
import { docxToText, buildDocx } from '../../assets/js/lib/docx.js';
import { buildDocument, sampleValues } from '../../assets/js/lib/doc-types.js';

test.describe('Không gian làm việc', () => {
  test('tổng quan và điều hướng thanh bên', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page);
    await expect(page.locator('.hello h1')).toContainText('Chào buổi');
    for (const [nav, title] of [
      ['compose', 'Soạn văn bản'],
      ['chat', 'Trợ lý AI'],
      ['spell', 'Kiểm tra chính tả'],
      ['summary', 'Tóm tắt văn bản'],
      ['number', 'Số thành chữ'],
      ['templates', 'Thư viện mẫu'],
      ['docs', 'Tài liệu của tôi'],
      ['settings', 'Cài đặt'],
      ['dashboard', 'Tổng quan'],
    ]) {
      await page.locator(`.sidebar [data-nav="${nav}"]`).click();
      await expect(page.locator('[data-view-title]')).toHaveText(title);
      await expect(page.locator(`.sidebar [data-nav="${nav}"]`)).toHaveAttribute('aria-current', 'page');
    }
    t.assertClean();
  });

  test('soạn quyết định: dữ liệu mẫu → xem trước đúng thể thức → xuất Word hợp lệ', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#compose/quyet-dinh');
    await expect(page.locator('[data-status]')).toContainText('trường bắt buộc');
    await page.locator('[data-sample]').click();
    await expect(page.locator('[data-status]')).toContainText('Đúng thể thức');
    const paper = page.locator('.vb-page');
    await expect(paper.locator('.vb-qh')).toHaveText('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
    await expect(paper.locator('.vb-tn')).toHaveText('Độc lập - Tự do - Hạnh phúc');
    await expect(paper.locator('.vb-number')).toContainText('/QĐ-UBND');
    await expect(paper.locator('.vb-title')).toHaveText('QUYẾT ĐỊNH');
    await expect(paper).toContainText('Điều 3.');
    await expect(paper.locator('.vb-sign-auth')).toHaveText('TM. ỦY BAN NHÂN DÂN');

    // Chỉnh sửa cập nhật xem trước tức thì
    await page.fill('[name="so"]', '125');
    await expect(paper.locator('.vb-number')).toHaveText('Số: 125/QĐ-UBND');
    await page.fill('[name="ngay"]', '2026-02-03');
    await expect(paper.locator('.vb-date')).toHaveText('Hà Nội, ngày 03 tháng 02 năm 2026');

    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-export]').click()]);
    expect(download.suggestedFilename()).toMatch(/^quyet-dinh-thanh-lap-to-cong-tac.*\.docx$/);
    const text = await docxToText(readFileSync(await download.path()));
    expect(text).toContain('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
    expect(text).toContain('Số: 125/QĐ-UBND');
    expect(text).toContain('Hà Nội, ngày 03 tháng 02 năm 2026');
    expect(text).toContain('Điều 1.');
    t.assertClean();
  });

  test('chặn xuất tệp khi thiếu trường bắt buộc và chỉ rõ trường lỗi', async ({ page }) => {
    await freshApp(page, '#compose/cong-van');
    await page.locator('[data-export]').click();
    await expect(page.locator('.toast.error').last()).toContainText('trường bắt buộc');
    expect(await page.locator('.field.invalid').count()).toBeGreaterThan(2);
    await expect(page.locator('.field.invalid [name]').first()).toBeFocused();
    await expect(page.locator('.vb-page .vb-ph').first()).toBeVisible();
  });

  test('soạn nội dung bằng trợ lý cơ bản (không cần API key)', async ({ page }) => {
    await freshApp(page, '#compose/to-trinh');
    await page.fill('[data-brief]', 'mua sắm 10 bộ máy tính cho Bộ phận Một cửa');
    await page.locator('[data-ai-run]').click();
    await expect(page.locator('[name="trichYeu"]')).toHaveValue('mua sắm 10 bộ máy tính cho Bộ phận Một cửa');
    await expect(page.locator('[name="noiDung"]')).toHaveValue(/SỰ CẦN THIẾT/);
    await expect(page.locator('.vb-title-sub')).toContainText('Về việc mua sắm 10 bộ máy tính');
  });

  test('đổi loại văn bản giữ lại thông tin cơ quan', async ({ page }) => {
    await freshApp(page, '#compose/cong-van');
    await page.fill('[name="coQuan"]', 'Sở Nội vụ');
    await page.fill('[name="vietTat"]', 'SNV');
    await page.locator('[data-type="thong-bao"]').click();
    await expect(page.locator('[name="coQuan"]')).toHaveValue('Sở Nội vụ');
    await expect(page.locator('.vb-org')).toHaveText('SỞ NỘI VỤ');
    await expect(page.locator('.vb-number')).toContainText('/TB-SNV');
    await expect(page).toHaveURL(/#compose\/thong-bao$/);
  });

  test('nháp tự động được khôi phục sau khi tải lại', async ({ page }) => {
    await freshApp(page, '#compose/bao-cao');
    await page.fill('[name="trichYeu"]', 'Kết quả công tác tháng 10');
    await page.waitForTimeout(450);
    await page.goto('/app.html#compose');
    await expect(page.locator('[name="trichYeu"]')).toHaveValue('Kết quả công tác tháng 10');
  });

  test('lưu, tìm kiếm, gắn sao, nhân bản, mở lại và xóa tài liệu', async ({ page }) => {
    await freshApp(page, '#compose/thong-bao');
    await page.locator('[data-sample]').click();
    await page.keyboard.press('Control+s');
    await expect(page.locator('.toast').last()).toContainText('Đã lưu');
    await expect(page.locator('[data-docs-count]')).toHaveText('1');
    await expect(page).toHaveURL(/#compose\/doc\//);

    await page.goto('/app.html#docs');
    await expect(page.locator('.doc-item')).toHaveCount(1);
    await page.fill('[data-q]', 'tiep cong dan'); // tìm không dấu
    await expect(page.locator('.doc-item')).toHaveCount(1);
    await page.fill('[data-q]', 'không có gì');
    await expect(page.locator('.empty')).toContainText('Không tìm thấy');
    await page.fill('[data-q]', '');

    await page.locator('[data-act="star"]').click();
    await expect(page.locator('[data-act="star"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-type="starred"]')).toBeVisible();

    await page.locator('[data-act="dup"]').click();
    await expect(page.locator('.doc-item')).toHaveCount(2);
    await expect(page.locator('[data-docs-count]')).toHaveText('2');

    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="export"]').first().click()]);
    expect(download.suggestedFilename()).toMatch(/\.docx$/);

    await page.locator('.doc-meta a').first().click();
    await expect(page.locator('[data-view-title]')).toHaveText('Soạn văn bản');
    await expect(page.locator('[name="trichYeu"]')).toHaveValue(/Lịch tiếp công dân/);

    await page.goto('/app.html#docs');
    await page.locator('[data-act="del"]').first().click();
    await page.locator('.modal').getByRole('button', { name: 'Xóa', exact: true }).click();
    await expect(page.locator('.doc-item')).toHaveCount(1);
    await page.locator('[data-act="del"]').first().click();
    await page.getByRole('button', { name: 'Hủy' }).click();
    await expect(page.locator('.doc-item')).toHaveCount(1);
  });

  test('quay lại một màn hình nhiều lần không nhân đôi thao tác', async ({ page }) => {
    await freshApp(page, '#compose/thong-bao');
    await page.locator('[data-sample]').click();
    await page.locator('[data-save]').click();
    for (const v of ['docs', 'dashboard', 'docs', 'templates', 'docs']) {
      await page.locator(`.sidebar [data-nav="${v}"]`).click();
    }
    await page.locator('[data-act="dup"]').click();
    await expect(page.locator('.doc-item')).toHaveCount(2);
    await page.locator('[data-act="del"]').first().click();
    await expect(page.locator('.modal')).toHaveCount(1);
  });

  test('in / lưu PDF gọi hộp thoại in với trang A4', async ({ page }) => {
    await freshApp(page, '#compose/giay-moi');
    await page.locator('[data-sample]').click();
    await page.evaluate(() => {
      window.__printed = 0;
      window.print = () => window.__printed++;
    });
    await page.locator('[data-print]').click();
    expect(await page.evaluate(() => window.__printed)).toBe(1);
    await page.emulateMedia({ media: 'print' });
    const box = await page.locator('.print-area .vb-page').boundingBox();
    expect(Math.round(box.width)).toBe(794); // 210 mm ở 96 dpi
    await page.emulateMedia({ media: 'screen' });
  });

  test('thu phóng bản xem trước', async ({ page }) => {
    await freshApp(page, '#compose/cong-van');
    const label = page.locator('[data-zoom-label]');
    await expect(label).toContainText('Vừa');
    await page.locator('[data-zoom="+"]').click();
    await expect(label).not.toContainText('Vừa');
    const z1 = await label.textContent();
    await page.locator('[data-zoom="-"]').click();
    await page.locator('[data-zoom="-"]').click();
    expect(parseInt(await label.textContent())).toBeLessThan(parseInt(z1));
  });

  test('thư viện mẫu điền sẵn dữ liệu minh họa', async ({ page }) => {
    await freshApp(page, '#templates');
    await expect(page.locator('.tpl-card')).toHaveCount(8);
    await page.locator('[data-use="bien-ban"]').click();
    await expect(page).toHaveURL(/#compose\/bien-ban/);
    await expect(page.locator('[name="chuTri"]')).toHaveValue(/Nguyễn Văn An/);
    await expect(page.locator('.vb-sign-pos').first()).toHaveText('THƯ KÝ');
  });

  test('kiểm tra chính tả: phát hiện, sửa từng lỗi, sửa tất cả, tải tệp .docx', async ({ page }) => {
    await freshApp(page, '#spell');
    await page.locator('[data-sample]').click();
    const issues = page.locator('.issue[data-issue]');
    const n = await issues.count();
    expect(n).toBeGreaterThan(5);
    await expect(page.locator('.score-ring')).toBeVisible();
    await page.locator('.issue', { hasText: 'sai chính tả' }).first().locator('[data-fix]').click();
    await expect(issues).toHaveCount(n - 1);
    await page.locator('[data-fixall]').click();
    // Còn lại các từ có nhiều cách sửa (viềc → việc/viếc…): người dùng chọn.
    const left = page.locator('.issue[data-issue]');
    while ((await left.count()) > 0) await left.first().locator('[data-fix]').first().click();
    await expect(issues).toHaveCount(0);
    await expect(page.locator('[data-input]')).toHaveValue(/xử lý hồ sơ tồn đọng và bổ sung tài liệu còn thiếu\. Kết quả/);
    await expect(page.locator('[data-input]')).toHaveValue(/Người đứng đầu chịu trách nhiệm về việc tổ chức thực hiện của đơn vị/);

    const dir = mkdtempSync(join(tmpdir(), 'tlvb-'));
    const file = join(dir, 'van-ban.docx');
    writeFileSync(file, buildDocx(buildDocument('cong-van', { ...sampleValues('cong-van', '2026-10-05'), noiDung: 'Đề nghị sử lý ngay.' })));
    await page.locator('[data-file]').setInputFiles(file);
    await expect(page.locator('[data-input]')).toHaveValue(/CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/);
    await expect(page.locator('.issue', { hasText: 'sử lý' })).toHaveCount(1);
  });

  test('tóm tắt văn bản cục bộ và từ tệp .txt', async ({ page }) => {
    await freshApp(page, '#summary');
    await page.locator('[data-sample]').click();
    const items = page.locator('.summary-list li');
    expect(await items.count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.stats-row')).toBeVisible();
    await expect(page.locator('.kw').first()).toBeVisible();

    await page.fill('[data-input]', 'Ngắn quá.');
    await page.locator('[data-run]').click();
    await expect(page.locator('.toast.error').last()).toContainText('quá ngắn');

    const dir = mkdtempSync(join(tmpdir(), 'tlvb-'));
    const file = join(dir, 'bao-cao.txt');
    writeFileSync(file, 'Năm 2026, phường hoàn thành 100% chỉ tiêu chuyển đổi số. Tỷ lệ hồ sơ trực tuyến đạt 80%. Người dân hài lòng với dịch vụ công. Tuy nhiên vẫn còn hạn chế về thiết bị. Đề nghị cấp trên hỗ trợ kinh phí mua sắm máy tính mới cho Bộ phận Một cửa.');
    await page.locator('[data-file]').setInputFiles(file);
    await expect(page.locator('.summary-list li').first()).toBeVisible();
  });

  test('đọc số thành chữ, xử lý số không hợp lệ và lưu lịch sử', async ({ page }) => {
    await freshApp(page, '#number');
    const input = page.locator('[data-input]');
    await input.fill('1.234.567');
    await expect(page.locator('[data-words]')).toHaveText('Một triệu hai trăm ba mươi tư nghìn năm trăm sáu mươi bảy đồng chẵn.');
    await expect(page.locator('[data-formatted]')).toHaveText('1.234.567 đ');
    await page.locator('[data-opt="money"]').uncheck();
    await expect(page.locator('[data-words]')).toHaveText('Một triệu hai trăm ba mươi tư nghìn năm trăm sáu mươi bảy.');
    await page.locator('[data-keep]').click();
    await expect(page.locator('.hist-list li button')).toHaveCount(1);
    await input.fill('12abc');
    await expect(page.locator('[data-words]')).toContainText('không hợp lệ');
    await page.locator('.hist-list li button').first().click();
    await expect(input).toHaveValue('1.234.567');
  });

  test('trợ lý cơ bản: trả lời, soạn nháp và chuyển sang trình soạn thảo', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#chat');
    await page.locator('[data-suggest]').filter({ hasText: 'Đọc số tiền' }).click();
    await expect(page.locator('.msg.bot').last()).toContainText('Một tỷ hai trăm năm mươi triệu đồng chẵn');

    await page.fill('[data-input]', 'Soạn kế hoạch tổ chức Ngày hội đọc sách');
    await page.keyboard.press('Enter');
    await expect(page.locator('.msg.bot').last()).toContainText('Kế hoạch');
    await page.locator('[data-open]').last().click();
    await expect(page).toHaveURL(/#compose\/ke-hoach/);
    await expect(page.locator('[name="trichYeu"]')).toHaveValue(/tổ chức Ngày hội đọc sách/);

    // Lịch sử hội thoại được lưu
    await page.goto('/app.html#chat');
    await expect(page.locator('.msg')).toHaveCount(4);
    // Cuộc trò chuyện mới: cuộc cũ vẫn nằm trong lịch sử.
    await page.locator('.chat-composer [data-new]').click();
    await expect(page.locator('.chat-welcome')).toBeVisible();
    await expect(page.locator('.chat-history .ch-item')).toHaveCount(1);
    t.assertClean();
  });

  test('ô "Soạn ngay" ở trang tổng quan chuyển yêu cầu sang trợ lý', async ({ page }) => {
    await freshApp(page);
    await page.fill('.hello-prompt input', 'Soạn giấy mời họp tổng kết năm');
    await page.locator('.hello-prompt button').click();
    await expect(page).toHaveURL(/#chat/);
    await expect(page.locator('.msg.user')).toContainText('Soạn giấy mời họp tổng kết năm');
    await expect(page.locator('[data-open]')).toBeVisible();
  });

  test('bảng lệnh Ctrl + K', async ({ page }) => {
    await freshApp(page);
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-palette]')).toBeVisible();
    await page.keyboard.type('bien ban'); // tìm không dấu
    await expect(page.locator('.palette-item[aria-selected="true"]')).toContainText('Soạn biên bản');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#compose\/bien-ban/);
    await expect(page.locator('[data-palette]')).toBeHidden();
    await page.keyboard.press('Control+k');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-palette]')).toBeHidden();
  });

  test('đăng xuất, đăng nhập sai và đúng mật khẩu', async ({ page }) => {
    await freshApp(page);
    await expect(page.locator('.avatar')).toHaveText('HT');
    await page.locator('.avatar-btn').click();
    await expect(page.locator('[data-role-badge]')).toHaveText('Quản trị tối cao');
    await page.locator('[data-logout]').click();
    await expect(page.locator('.gate')).toBeVisible();
    await expect(page.locator('.shell')).toBeHidden();
    await page.fill('#g-email', SUPER.email);
    await page.fill('#g-pass', 'sai-mat-khau');
    await page.click('[data-gate-form] button[type="submit"]');
    await expect(page.locator('.gate .auth-err')).toContainText('không đúng');
    await page.fill('#g-pass', SUPER.password);
    await page.click('[data-gate-form] button[type="submit"]');
    await expect(page.locator('.hello h1')).toContainText('thống');
  });

  test('cài đặt: thông tin đơn vị mặc định được điền vào văn bản mới', async ({ page }) => {
    await freshApp(page, '#settings');
    await page.fill('#o-coQuan', 'SỞ TƯ PHÁP TỈNH NINH BÌNH');
    await page.fill('#o-vietTat', 'STP');
    await page.fill('#o-diaDanh', 'Ninh Bình');
    await page.locator('[data-org] button[type="submit"]').click();
    await expect(page.locator('.toast').last()).toContainText('Đã lưu thông tin đơn vị');
    await page.goto('/app.html#compose/ke-hoach');
    await expect(page.locator('[name="coQuan"]')).toHaveValue('SỞ TƯ PHÁP TỈNH NINH BÌNH');
    await expect(page.locator('.vb-date')).toContainText('Ninh Bình, ngày');
    await expect(page.locator('.vb-number')).toContainText('/KH-STP');
  });

  test('cài đặt: giao diện, sao lưu và khôi phục dữ liệu', async ({ page }) => {
    await freshApp(page, '#compose/thong-bao');
    await page.locator('[data-sample]').click();
    await page.locator('[data-save]').click();
    await page.goto('/app.html#settings');
    await page.locator('.seg [data-theme="dark"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('.seg [data-theme="light"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-backup]').click()]);
    const backupPath = await download.path();
    const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
    expect(backup.docs).toHaveLength(1);

    await page.locator('[data-wipe]').click();
    await page.getByRole('button', { name: 'Xóa vĩnh viễn' }).click();
    await expect(page.locator('[data-docs-count]')).toHaveText('0');
    // Xóa dữ liệu không xóa tài khoản: vẫn đăng nhập, đăng xuất rồi đăng nhập lại được
    await expect(page.locator('.avatar')).toBeVisible();
    await loginAs(page, SUPER.email, SUPER.password);

    await page.goto('/app.html#settings');
    const dir = mkdtempSync(join(tmpdir(), 'tlvb-'));
    const f = join(dir, 'backup.json');
    writeFileSync(f, JSON.stringify(backup));
    await page.locator('[data-restore]').setInputFiles(f);
    await expect(page.locator('.toast').last()).toContainText('Đã khôi phục 1 tài liệu');
    await expect(page.locator('[data-docs-count]')).toHaveText('1');

    writeFileSync(f, '{"foo": 1}');
    await page.locator('[data-restore]').setInputFiles(f);
    await expect(page.locator('.toast.error').last()).toContainText('không hợp lệ');
  });

  test('cài đặt: kiểm tra định dạng API key theo nhà cung cấp', async ({ page }) => {
    await freshApp(page, '#settings');
    await page.fill('[data-key]', 'abc');
    await page.locator('[data-save-key]').click();
    await expect(page.locator('.toast.error').last()).toContainText('sk-ant-');
    await page.fill('[data-key]', 'sk-ant-test-123');
    await page.locator('[data-save-key]').click();
    await expect(page.locator('[data-ai-status]')).toHaveClass(/on/);
    await expect(page.locator('[data-ai-state]')).toHaveText('Đang dùng Claude');
    await page.click('[data-prov="gemini"]');
    await page.fill('[data-key]', 'sk-sai-dinh-dang');
    await page.locator('[data-save-key]').click();
    await expect(page.locator('.toast.error').last()).toContainText('AIza');
    await page.click('[data-prov="anthropic"]');
    await page.locator('[data-remove-key]').click();
    await expect(page.locator('[data-ai-status]')).not.toHaveClass(/on/);
  });
});

test.describe('Tích hợp AI Claude (API giả lập)', () => {
  test('kiểm tra kết nối báo lỗi khóa sai và thành công với khóa đúng', async ({ page }) => {
    const calls = await mockClaude(page, () => 'Xin chào');
    await freshApp(page, '#settings');
    await page.fill('[data-key]', 'sk-ant-bad');
    await page.locator('[data-test-key]').click();
    await expect(page.locator('.toast.error').last()).toContainText('API key không hợp lệ');
    await page.fill('[data-key]', 'sk-ant-good');
    await page.locator('[data-test-key]').click();
    await expect(page.locator('.toast').last()).toContainText('Kết nối Claude thành công');
    expect(calls.at(-1).headers['x-api-key']).toBe('sk-ant-good');
    expect(calls.at(-1).headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(calls.at(-1).body.model).toBe('claude-opus-5-5');
  });

  test('trò chuyện streaming với Claude', async ({ page }) => {
    const t = trackErrors(page);
    const calls = await mockClaude(page, () => 'Theo **Nghị định 30/2020/NĐ-CP**, lề trái từ 30 đến 35 mm.\n- Lề trên: 20–25 mm\n- Lề phải: 15–20 mm');
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-good', 'claude-sonnet-5-5');
    await page.goto('/app.html#chat');
    await expect(page.locator('.composer-note')).toContainText('claude-sonnet-5-5');
    await page.fill('[data-input]', 'Lề văn bản bao nhiêu?');
    await page.keyboard.press('Enter');
    const bot = page.locator('.msg.bot').last();
    await expect(bot.locator('strong')).toHaveText('Nghị định 30/2020/NĐ-CP');
    await expect(bot.locator('li')).toHaveCount(2);
    const req = calls.at(-1);
    expect(req.body.stream).toBe(true);
    expect(req.body.messages.at(-1)).toEqual({ role: 'user', content: 'Lề văn bản bao nhiêu?' });
    expect(req.body.system).toContain('Nghị định 30/2020/NĐ-CP');
    expect(req.body.fallbacks).toBe('default');
    t.assertClean();
  });

  test('soạn văn bản bằng Claude: JSON được áp vào biểu mẫu', async ({ page }) => {
    await mockClaude(page, () => '```json\n{"trichYeu": "tổ chức tập huấn kỹ năng số cho cán bộ", "noiDung": "Nhằm nâng cao kỹ năng số cho đội ngũ cán bộ, công chức.\\nThời gian: [...]"}\n```');
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-good', 'claude-opus-5-5');
    await page.goto('/app.html#compose/thong-bao');
    await expect(page.locator('[data-ai-badge]')).toHaveText('Claude');
    await page.fill('[data-brief]', 'thông báo tập huấn kỹ năng số');
    await page.locator('[data-ai-run]').click();
    await expect(page.locator('[name="trichYeu"]')).toHaveValue('tổ chức tập huấn kỹ năng số cho cán bộ');
    await expect(page.locator('[name="noiDung"]')).toHaveValue(/Nhằm nâng cao kỹ năng số/);
    await expect(page.locator('.vb-page .vb-ph', { hasText: '[...]' })).toBeVisible();
  });

  test('tóm tắt bằng Claude', async ({ page }) => {
    await mockClaude(page, () => '- Ý chính thứ nhất\n- Ý chính thứ hai\n\n**Từ khóa:** chuyển đổi số');
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-good', 'claude-opus-5-5');
    await page.goto('/app.html#summary');
    await page.locator('[data-sample]').click();
    await page.locator('[data-ai]').click();
    await expect(page.locator('[data-ai-out] li')).toHaveCount(2);
    await expect(page.locator('[data-ai-out]')).toContainText('chuyển đổi số');
  });
});
