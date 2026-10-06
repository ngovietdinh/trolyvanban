import { test, expect } from '@playwright/test';
import { trackErrors, freshApp, mockClaude, setApiKey } from './helpers.mjs';

const ask = async (page, text) => {
  await page.fill('.chat [data-input]', text);
  await page.keyboard.press('Enter');
  await expect(page.locator('.msg.bot .msg-tools').last()).toBeVisible();
};

test.describe('Lịch sử trò chuyện, xóa, sao chép, tạo văn bản chuẩn', () => {
  test('nhiều cuộc trò chuyện: lịch sử, chuyển qua lại, xóa từng cuộc (hoàn tác), xóa tất cả, xóa tin nhắn', async ({ page, context }) => {
    const t = trackErrors(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await freshApp(page, '#chat');
    await ask(page, 'Căn lề văn bản hành chính theo Nghị định 30 là bao nhiêu?');
    await page.locator('.chat-history [data-new]').click();
    await ask(page, 'Đọc số 1.250.000 thành chữ');
    const items = page.locator('.chat-history .ch-item');
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText('Đọc số 1.250.000');
    // Mở lại cuộc cũ.
    await items.nth(1).locator('[data-open-thread]').click();
    await expect(page.locator('.chat-title')).toContainText('Căn lề');
    await expect(page.locator('.msg.user')).toHaveCount(1);
    // Sao chép câu trả lời.
    await page.locator('.msg.bot [data-copy]').first().click();
    await expect(page.locator('.toast', { hasText: 'Đã sao chép câu trả lời' })).toBeVisible();
    expect((await page.evaluate(() => navigator.clipboard.readText())).length).toBeGreaterThan(10);
    // Xóa một tin nhắn → hoàn tác.
    await page.locator('.msg.user [data-del-msg]').click();
    await expect(page.locator('.msg.user')).toHaveCount(0);
    await page.locator('.toast', { hasText: 'Đã xóa tin nhắn' }).getByRole('button', { name: 'Hoàn tác' }).click();
    await expect(page.locator('.msg.user')).toHaveCount(1);
    // Xóa cuộc đang mở → hoàn tác.
    await page.locator('[data-del-thread]').click();
    await page.locator('.modal [data-yes]').click();
    await expect(items).toHaveCount(1);
    await page.locator('.toast', { hasText: 'Đã xóa' }).last().getByRole('button', { name: 'Hoàn tác' }).click();
    await expect(items).toHaveCount(2);
    // Lịch sử được lưu khi mở lại trang.
    await page.reload();
    await expect(page.locator('.chat-history .ch-item')).toHaveCount(2);
    // Xóa tất cả.
    await page.locator('[data-clear-all]').click();
    await page.locator('.modal [data-yes]').click();
    await expect(page.locator('.chat-history .ch-item')).toHaveCount(0);
    await expect(page.locator('.chat-welcome')).toBeVisible();
    t.assertClean();
  });

  test('câu trả lời AI → Tạo văn bản chuẩn (AI chuẩn hóa) → mở trình soạn thảo đúng loại, có nội dung', async ({ page }) => {
    const t = trackErrors(page);
    await mockClaude(page, (body) => {
      const c = body.messages.at(-1).content;
      if (/Chỉ trả về đúng một đối tượng JSON/.test(c)) return JSON.stringify({ trichYeu: 'tổ chức tập huấn nghiệp vụ văn thư', noiDung: ['Nhằm nâng cao kỹ năng soạn thảo văn bản, Văn phòng thông báo tổ chức tập huấn.', 'Thời gian: 8 giờ ngày 20/10/2026.'] });
      return '## Tập huấn văn thư\n\n- **Thời gian:** 8 giờ ngày 20/10/2026\n- Địa điểm: Hội trường A';
    });
    await freshApp(page, '');
    await setApiKey(page, 'anthropic', 'sk-ant-test');
    await page.goto('/app.html#chat');
    await ask(page, 'Gợi ý nội dung thông báo tập huấn văn thư');
    await page.locator('.msg.bot [data-make]').click();
    const m = page.locator('.modal');
    await expect(m.getByRole('heading', { name: 'Tạo văn bản chuẩn' })).toBeVisible();
    await expect(m.locator('input[name="type"][value="thong-bao"]')).toBeChecked();
    await expect(m.locator('input[name="ai"]')).toBeChecked();
    await m.locator('[data-go]').click();
    await expect(page).toHaveURL(/#compose\/thong-bao/);
    await expect(page.locator('[name="noiDung"]')).toHaveValue(/tổ chức tập huấn/);
    await expect(page.locator('[name="trichYeu"]')).toHaveValue(/tập huấn/);
    t.assertClean();
  });

  test('không có AI: tạo văn bản chuẩn dùng nguyên câu trả lời (bỏ định dạng Markdown)', async ({ page }) => {
    await freshApp(page, '#chat');
    await ask(page, 'Căn lề văn bản hành chính theo Nghị định 30 là bao nhiêu?');
    await page.locator('.msg.bot [data-make]').click();
    await expect(page.locator('.modal input[name="ai"]')).toBeDisabled();
    await page.locator('.modal .mk-type', { hasText: 'Công văn' }).click();
    await page.locator('.modal [data-go]').click();
    await expect(page).toHaveURL(/#compose\/cong-van/);
    const v = await page.locator('[name="noiDung"]').inputValue();
    expect(v.length).toBeGreaterThan(20);
    expect(v).not.toMatch(/\*\*|^#/m);
  });

  test('văn bản đã tạo đều xóa được: soạn thảo, tổng quan, biểu mẫu tố tụng, kế hoạch hỏi — có hoàn tác', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#compose/thong-bao');
    await page.locator('[data-sample]').click();
    await page.locator('[data-save]').click();
    await expect(page.locator('.cf-foot [data-del-doc]')).toBeVisible();
    await page.locator('.cf-foot [data-del-doc]').click();
    await page.locator('.modal [data-yes]').click();
    await expect(page).toHaveURL(/#docs$/);
    await expect(page.locator('.doc-item')).toHaveCount(0);
    await page.locator('.toast', { hasText: 'Đã xóa' }).getByRole('button', { name: 'Hoàn tác' }).click();
    await page.goto('/app.html#dashboard');
    await expect(page.locator('.doc-item')).toHaveCount(1);
    await page.locator('.doc-item [data-del-doc]').click();
    await page.locator('.modal [data-yes]').click();
    await expect(page.locator('.doc-item')).toHaveCount(0);

    // Biểu mẫu tố tụng.
    await page.goto('/app.html#forms');
    await page.locator('.tt-form-item[data-form]').first().click();
    await page.locator('[data-save]').click();
    await expect(page.locator('[data-del-this]')).toBeVisible();
    await expect(page.locator('.tt-doc-row')).toHaveCount(1);
    await page.locator('[data-del-this]').click();
    await page.locator('.modal [data-yes]').click();
    await expect(page.locator('.tt-doc-row')).toHaveCount(0);

    // Kế hoạch hỏi chưa gắn hồ sơ.
    await page.goto('/app.html#legal/353');
    await page.locator('[data-save-plan]').click();
    await page.locator('.modal button[type="submit"]').click();
    await page.goto('/app.html#cases');
    await expect(page.locator('[data-del-plan]')).toHaveCount(1);
    await page.locator('[data-del-plan]').click();
    await page.locator('.modal [data-yes]').click();
    await expect(page.locator('[data-del-plan]')).toHaveCount(0);
    t.assertClean();
  });

  test('trợ lý hồ sơ (Kho): lưu cuộc trò chuyện, sao chép, xóa câu trả lời, xóa cả cuộc', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#kho');
    await page.fill('.kho [data-input]', 'Tóm tắt hồ sơ');
    await page.keyboard.press('Enter');
    await expect(page.locator('.kho-msg.bot .msg-tools')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('.kho-msg')).toHaveCount(2);
    await page.locator('.kho-msg.bot [data-copy]').click();
    await expect(page.locator('.toast', { hasText: 'Đã sao chép' })).toBeVisible();
    await page.locator('.kho-msg.bot [data-del-msg]').click();
    await expect(page.locator('.kho-msg')).toHaveCount(0);
    await page.locator('.toast', { hasText: 'Đã xóa' }).getByRole('button', { name: 'Hoàn tác' }).click();
    await expect(page.locator('.kho-msg')).toHaveCount(2);
    await page.locator('[data-clear-chat]').click();
    await page.locator('.modal [data-yes]').click();
    await expect(page.locator('.kho-msg')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.kho-welcome')).toBeVisible();
    t.assertClean();
  });
});
