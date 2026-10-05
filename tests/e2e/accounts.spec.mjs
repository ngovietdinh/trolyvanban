import { test, expect } from '@playwright/test';
import { freshApp, loginAs, setApiKey, mockClaude, mockProviders, trackErrors, SUPER } from './helpers.mjs';

async function createUser(page, { name, email, password, role }) {
  await page.goto('/app.html#admin');
  await page.click('[data-new-user]');
  await page.fill('#nu-name', name);
  await page.fill('#nu-email', email);
  await page.fill('#nu-pw', password);
  await page.selectOption('#nu-role', role);
  await page.click('.modal button[type="submit"]');
  await expect(page.locator('.users-table')).toContainText(email);
}

async function logout(page) {
  await page.click('.avatar-btn');
  await page.click('[data-logout]');
  await expect(page.locator('.gate')).toBeVisible();
}

test.describe('Tài khoản và phân quyền', () => {
  test('lần đầu: màn hình đăng ký không gắn sẵn email; đăng ký bằng email quản trị tối cao → toàn quyền', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '', { login: false });
    await expect(page.locator('.gate h2')).toHaveText('Tạo tài khoản đầu tiên');
    await expect(page.locator('#g-email')).toHaveValue('');
    await expect(page.locator('#g-email')).not.toHaveAttribute('readonly', '');
    await expect(page.locator('.gate')).not.toContainText('gsnvbu');
    await page.fill('#g-name', SUPER.name);
    await page.fill('#g-email', SUPER.email);
    await page.fill('#g-pass', '123');
    await page.click('[data-gate-form] button[type="submit"]');
    await expect(page.locator('.gate .auth-err')).toContainText('tối thiểu 8');
    await page.fill('#g-pass', SUPER.password);
    await page.click('[data-gate-form] button[type="submit"]');
    await expect(page.locator('.shell')).toBeVisible();
    for (const nav of ['legal', 'interview', 'cases', 'admin', 'compose', 'spell']) await expect(page.locator(`[data-nav="${nav}"]`)).toBeVisible();
    // Mật khẩu không lưu dạng rõ
    const raw = await page.evaluate(() => localStorage.getItem('tlvb:users'));
    expect(raw).not.toContain(SUPER.password);
    expect(JSON.parse(raw)[0].role).toBe('superadmin');
    t.assertClean();
  });

  test('người khác đăng ký email khác trước → tài khoản thường; quản trị tối cao đăng ký sau, thấy “chờ cấp quyền” và phân quyền ngay trên máy', async ({ page }) => {
    await freshApp(page, '', { login: false });
    await page.fill('#g-name', 'Phạm Văn Nam');
    await page.fill('#g-email', 'nam@donvi.vn');
    await page.fill('#g-pass', 'matkhau123');
    await page.click('[data-gate-form] button[type="submit"]');
    await expect(page.locator('.shell')).toBeVisible();
    await expect(page.locator('[data-nav="admin"]')).toBeHidden();
    await expect(page.locator('[data-nav="legal"]')).toBeHidden();
    await logout(page);
    await page.click('[data-gate-mode="register"]');
    await page.fill('#g-name', SUPER.name);
    await page.fill('#g-email', SUPER.email);
    await page.fill('#g-pass', SUPER.password);
    await page.click('[data-gate-form] button[type="submit"]');
    await expect(page.locator('.toast', { hasText: '1 tài khoản mới đang chờ cấp quyền' })).toBeVisible();
    await page.goto('/app.html#admin');
    const row = page.locator('tr', { hasText: 'nam@donvi.vn' });
    await expect(row.locator('[data-pending]')).toHaveText('Chờ cấp quyền');
    await row.locator('[data-edit]').click();
    await page.locator('.modal [name="role"]').selectOption('investigator');
    await page.locator('.modal button[type="submit"]').click();
    await expect(row.locator('[data-pending]')).toHaveCount(0);
    await loginAs(page, 'nam@donvi.vn', 'matkhau123');
    await expect(page.locator('[data-nav="legal"]')).toBeVisible();
  });

  test('tài khoản tự đăng ký chỉ có quyền Người dùng: không thấy Tố tụng, không vào được bằng đường dẫn', async ({ page }) => {
    await freshApp(page);
    await logout(page);
    await page.click('[data-gate-mode="register"]');
    await page.fill('#g-name', 'Lê Minh Châu');
    await page.fill('#g-email', 'chau@example.vn');
    await page.fill('#g-pass', 'matkhau123');
    await page.click('[data-gate-form] button[type="submit"]');
    await expect(page.locator('.shell')).toBeVisible();
    for (const nav of ['legal', 'interview', 'cases', 'admin']) await expect(page.locator(`[data-nav="${nav}"]`)).toBeHidden();
    await expect(page.locator('[data-perm-section="legal"]')).toBeHidden();
    await expect(page.locator('.legal-promo')).toHaveCount(0);
    for (const hash of ['#legal/222', '#interview', '#cases', '#admin']) {
      await page.goto('/app.html' + hash);
      await expect(page.locator('#view')).toContainText('chưa được cấp quyền');
    }
    await page.keyboard.press('Control+k');
    await page.keyboard.type('dieu 222');
    await expect(page.locator('.palette-empty')).toBeVisible();
  });

  test('quản trị cấp vai trò Điều tra viên → vào được Tố tụng nhưng mặc định ngoại tuyến', async ({ page }) => {
    const calls = await mockClaude(page, () => '{"cauHoi":[{"issueKey":"dong-pham","text":"Câu hỏi từ AI"}]}');
    await freshApp(page);
    await createUser(page, { name: 'Trần Minh Đức', email: 'duc@ca.vn', password: 'dieutra123', role: 'investigator' });
    await loginAs(page, 'duc@ca.vn', 'dieutra123');
    await expect(page.locator('[data-nav="legal"]')).toBeVisible();
    await expect(page.locator('[data-nav="admin"]')).toBeHidden();
    // Có API key cho văn bản nhưng Tố tụng vẫn ngoại tuyến
    await setApiKey(page, 'anthropic', 'sk-ant-good');
    await expect(page.locator('.note', { hasText: 'luôn chạy ngoại tuyến' })).toBeVisible();
    await page.goto('/app.html#legal/353');
    await page.click('[data-ai-more]');
    await expect(page.locator('.toast').last()).toContainText('ngoại tuyến');
    await page.click('[data-start]');
    await page.fill('#st-name', 'Nguyễn Văn Bình');
    await page.click('.modal button[type="submit"]');
    await expect(page.locator('[data-ai-mode]')).toHaveText('Ngoại tuyến');
    await page.fill('[data-q]', 'Anh nhận bao nhiêu?');
    await page.fill('[data-a]', 'Tôi nhận 50 triệu đồng.');
    await page.click('[data-submit]');
    await page.click('[data-run]');
    await expect(page.locator('.iv-ai-list li').first()).toBeVisible();
    expect(calls.length).toBe(0); // không có dữ liệu nào gửi ra ngoài

    // Quản trị tối cao cấp quyền AI trực tuyến trong Tố tụng
    await loginAs(page, SUPER.email, SUPER.password);
    await page.goto('/app.html#admin');
    await page.locator('tr', { hasText: 'duc@ca.vn' }).locator('[data-edit]').click();
    await page.locator('.modal input[value="legal.ai"]').check();
    await page.click('.modal button[type="submit"]');
    await expect(page.locator('tr', { hasText: 'duc@ca.vn' })).toContainText('AI trực tuyến trong Tố tụng');
    await loginAs(page, 'duc@ca.vn', 'dieutra123');
    await page.goto('/app.html#legal/353');
    await page.click('[data-ai-more]');
    await expect(page.locator('.toast').last()).toContainText('AI đã gợi ý thêm');
    expect(calls.length).toBeGreaterThan(0);
  });

  test('dữ liệu tách riêng theo tài khoản', async ({ page }) => {
    await freshApp(page, '#compose/thong-bao');
    await page.click('[data-sample]');
    await page.click('[data-save]');
    await expect(page.locator('[data-docs-count]')).toHaveText('1');
    await createUser(page, { name: 'Phạm An', email: 'an@vp.vn', password: 'matkhau123', role: 'user' });
    await loginAs(page, 'an@vp.vn', 'matkhau123');
    await expect(page.locator('[data-docs-count]')).toHaveText('0');
    await page.goto('/app.html#docs');
    await expect(page.locator('.empty')).toContainText('Chưa có tài liệu');
    await loginAs(page, SUPER.email, SUPER.password);
    await expect(page.locator('[data-docs-count]')).toHaveText('1');
  });

  test('API key mã hóa theo tài khoản: không lưu dạng rõ, tài khoản khác không thấy, đổi mật khẩu vẫn giữ, đặt lại mật khẩu thì xóa', async ({ page }) => {
    await freshApp(page);
    await setApiKey(page, 'openai', 'sk-test-openai-SECRET');
    const raw = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(raw).not.toContain('sk-test-openai-SECRET');
    await expect(page.locator('[data-ai-status]')).toContainText('ChatGPT');

    // Đổi mật khẩu: khóa vẫn còn
    await page.click('.avatar-btn');
    await page.click('[data-change-pw]');
    await page.fill('#cp-old', SUPER.password);
    await page.fill('#cp-new', 'matkhau-moi-123');
    await page.click('.modal button[type="submit"]');
    await expect(page.locator('.toast').last()).toContainText('Đã đổi mật khẩu');
    await loginAs(page, SUPER.email, 'matkhau-moi-123');
    await expect(page.locator('[data-ai-status]')).toContainText('ChatGPT');

    // Tài khoản khác không thấy khóa
    await createUser(page, { name: 'Phạm An', email: 'an@vp.vn', password: 'matkhau123', role: 'user' });
    await loginAs(page, 'an@vp.vn', 'matkhau123');
    await expect(page.locator('[data-ai-status]')).toContainText('Chế độ cơ bản');
    await setApiKey(page, 'gemini', 'AIzaTEST-KEY-AN');
    await loginAs(page, SUPER.email, 'matkhau-moi-123');
    await page.goto('/app.html#admin');
    await expect(page.locator('#view')).not.toContainText('AIzaTEST');
    // Đặt lại mật khẩu → kho khóa bị xóa
    await page.locator('tr', { hasText: 'an@vp.vn' }).locator('[data-edit]').click();
    await page.click('.modal [data-reset]');
    await page.fill('#rp-pw', 'matkhau-cap-lai');
    await page.click('.modal button[type="submit"]');
    await expect(page.locator('.toast').last()).toContainText('Đã đặt lại mật khẩu');
    await loginAs(page, 'an@vp.vn', 'matkhau-cap-lai');
    await expect(page.locator('[data-ai-status]')).toContainText('Chế độ cơ bản');
  });

  test('khóa tài khoản, tắt tự đăng ký, không thể hạ quyền quản trị tối cao', async ({ page }) => {
    await freshApp(page);
    await createUser(page, { name: 'Quản trị viên', email: 'qtv@ca.vn', password: 'matkhau123', role: 'admin' });
    await createUser(page, { name: 'Lê Văn Khóa', email: 'khoa@ca.vn', password: 'matkhau123', role: 'user' });
    await page.locator('tr', { hasText: 'khoa@ca.vn' }).locator('[data-edit]').click();
    await page.locator('.modal [name="locked"]').check();
    await page.click('.modal button[type="submit"]');
    await expect(page.locator('tr', { hasText: 'khoa@ca.vn' })).toContainText('Đã khóa');
    await page.locator('[data-allow-signup]').uncheck();
    // Tài khoản tối cao: không có lựa chọn vai trò, không khóa, không xóa
    await page.locator('tr', { hasText: SUPER.email }).locator('[data-edit]').click();
    await expect(page.locator('.modal [name="role"]')).toHaveCount(0);
    await expect(page.locator('.modal [name="locked"]')).toHaveCount(0);
    await expect(page.locator('.modal [data-del]')).toHaveCount(0);
    await page.locator('.modal [data-close]').first().click();

    await logout(page);
    await page.fill('#g-email', 'khoa@ca.vn');
    await page.fill('#g-pass', 'matkhau123');
    await page.click('[data-gate-form] button[type="submit"]');
    await expect(page.locator('.gate .auth-err')).toContainText('bị khóa');
    await expect(page.locator('[data-gate-mode="register"]')).toHaveCount(0);
    await expect(page.locator('.gate')).toContainText('Liên hệ quản trị viên');

    // Quản trị viên thường không sửa được tài khoản tối cao và không tạo được quản trị viên
    await loginAs(page, 'qtv@ca.vn', 'matkhau123');
    await page.goto('/app.html#admin');
    await expect(page.locator('tr', { hasText: SUPER.email }).locator('[data-edit]')).toHaveCount(0);
    await page.click('[data-new-user]');
    await expect(page.locator('#nu-role option[value="admin"]')).toHaveCount(0);
    await expect(page.locator('.modal input[value="users"]')).toBeDisabled();
  });

  test('xóa toàn bộ dữ liệu giữ lại tài khoản và API key', async ({ page }) => {
    await freshApp(page, '#compose/bao-cao');
    await page.click('[data-sample]');
    await page.click('[data-save]');
    await setApiKey(page, 'grok', 'xai-test-key');
    await page.goto('/app.html#settings');
    await page.click('[data-wipe]');
    await page.getByRole('button', { name: 'Xóa vĩnh viễn' }).click();
    await expect(page.locator('[data-docs-count]')).toHaveText('0');
    await loginAs(page, SUPER.email, SUPER.password);
    await expect(page.locator('[data-ai-status]')).toContainText('Grok');
    await page.goto('/app.html#admin');
    await expect(page.locator('.users-table tbody tr')).toHaveCount(1);
  });

  test('chuyển dữ liệu từ phiên bản cũ sang tài khoản quản trị tối cao', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('tlvb:docs', JSON.stringify([{ id: 'old1', typeId: 'thong-bao', title: 'Thông báo cũ', values: {}, text: 'x', updatedAt: Date.now() }]));
      localStorage.setItem('tlvb:settings', JSON.stringify({ apiKey: 'sk-ant-old-key', model: 'claude-opus-5-5' }));
    });
    await freshApp(page, '', { login: false }).catch(() => {});
    // freshApp đã xóa dữ liệu; nạp lại dữ liệu cũ rồi thiết lập
    await page.evaluate(() => {
      localStorage.setItem('tlvb:docs', JSON.stringify([{ id: 'old1', typeId: 'thong-bao', title: 'Thông báo cũ', values: {}, text: 'x', updatedAt: Date.now() }]));
      localStorage.setItem('tlvb:settings', JSON.stringify({ apiKey: 'sk-ant-old-key', model: 'claude-opus-5-5' }));
    });
    await page.reload();
    await page.fill('#g-name', SUPER.name);
    await page.fill('#g-email', SUPER.email);
    await page.fill('#g-pass', SUPER.password);
    await page.click('[data-gate-form] button[type="submit"]');
    await expect(page.locator('[data-docs-count]')).toHaveText('1');
    await expect(page.locator('[data-ai-status]')).toContainText('Claude');
    const raw = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(raw).not.toContain('sk-ant-old-key');
  });
});

test.describe('AI đa nhà cung cấp (API giả lập)', () => {
  for (const [provider, key, label, host] of [
    ['openai', 'sk-openai-test', 'ChatGPT', 'api.openai.com'],
    ['gemini', 'AIza-gemini-test', 'Gemini', 'generativelanguage.googleapis.com'],
    ['grok', 'xai-grok-test', 'Grok', 'api.x.ai'],
  ]) {
    test(`trò chuyện streaming với ${label}`, async ({ page }) => {
      const t = trackErrors(page);
      const calls = await mockProviders(page, () => `Trả lời từ **${label}**.`);
      await freshApp(page);
      await setApiKey(page, provider, key);
      await page.goto('/app.html#chat');
      await expect(page.locator('.composer-note')).toContainText(label);
      await page.fill('[data-input]', 'Xin chào');
      await page.keyboard.press('Enter');
      await expect(page.locator('.msg.bot').last().locator('strong')).toHaveText(label);
      const c = calls.at(-1);
      expect(c.url).toContain(host);
      if (provider === 'gemini') {
        expect(c.headers['x-goog-api-key']).toBe(key);
        expect(c.url).toContain('streamGenerateContent');
        expect(c.body.contents.at(-1).parts[0].text).toBe('Xin chào');
        expect(c.body.systemInstruction.parts[0].text).toContain('Trợ Lý Văn Bản');
      } else {
        expect(c.headers.authorization).toBe(`Bearer ${key}`);
        expect(c.body.stream).toBe(true);
        expect(c.body.messages[0].role).toBe('system');
        expect(c.body.messages.at(-1)).toEqual({ role: 'user', content: 'Xin chào' });
      }
      t.assertClean();
    });
  }

  test('báo lỗi khóa không hợp lệ của ChatGPT', async ({ page }) => {
    await page.route('https://api.openai.com/**', (r) => r.fulfill({ status: 401, headers: { 'access-control-allow-origin': '*' }, body: '{"error":{"message":"Incorrect API key"}}' }));
    await freshApp(page, '#settings');
    await page.click('[data-prov="openai"]');
    await page.fill('[data-key]', 'sk-sai');
    await page.click('[data-test-key]');
    await expect(page.locator('.toast.error').last()).toContainText('API key ChatGPT không hợp lệ');
  });
});

test.describe('Cập nhật phiên bản', () => {
  test('thông báo và kiểm tra khi có phiên bản mới', async ({ page }) => {
    await page.route('**/version.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: '9.9.9', notes: ['Bản thử nghiệm'] }) }));
    await freshApp(page, '#settings');
    await expect(page.locator('.update-banner')).toContainText('v9.9.9');
    await page.click('[data-check-update]');
    await expect(page.locator('[data-update-out]')).toContainText('v9.9.9');
    await expect(page.locator('[data-update-out]')).toContainText('Bản thử nghiệm');
    await expect(page.locator('[data-apply-update]')).toBeVisible();
  });

  test('báo đang dùng bản mới nhất', async ({ page }) => {
    await freshApp(page, '#settings');
    await expect(page.locator('.update-banner')).toHaveCount(0);
    await page.click('[data-check-update]');
    await expect(page.locator('[data-update-out]')).toContainText('mới nhất');
  });
});
