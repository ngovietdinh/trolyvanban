import { test, expect } from '@playwright/test';
import { trackErrors, freshApp } from './helpers.mjs';

const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe('Giao diện di động', () => {
  test('trang giới thiệu: menu di động và không tràn ngang', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto('/');
    expect(await noHorizontalScroll(page)).toBe(true);
    await expect(page.locator('.main-nav')).toBeHidden();
    await page.locator('[data-menu-toggle]').click();
    await expect(page.locator('#mobile-nav')).toBeVisible();
    await page.locator('#mobile-nav a', { hasText: 'Bảng giá' }).click();
    await expect(page.locator('#mobile-nav')).toBeHidden();
    // Cuộn hết trang để kích hoạt mọi hiệu ứng, kiểm tra lại tràn ngang.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(await noHorizontalScroll(page)).toBe(true);
    t.assertClean();
  });

  test('ứng dụng: mở/đóng thanh bên và điều hướng', async ({ page }) => {
    await freshApp(page);
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).not.toHaveClass(/open/);
    await page.locator('[data-sidebar-open]').click();
    await expect(sidebar).toHaveClass(/open/);
    await sidebar.locator('[data-nav="number"]').click();
    await expect(sidebar).not.toHaveClass(/open/);
    await expect(page.locator('[data-view-title]')).toHaveText('Số thành chữ');
    expect(await noHorizontalScroll(page)).toBe(true);
  });

  test('trình soạn thảo: chuyển giữa biểu mẫu và xem trước', async ({ page }) => {
    await freshApp(page, '#compose/cong-van');
    await expect(page.locator('.compose-form')).toBeVisible();
    await expect(page.locator('.compose-preview')).toBeHidden();
    await page.locator('[data-sample]').click();
    await page.locator('[data-pane-btn="preview"]').click();
    await expect(page.locator('.compose-preview')).toBeVisible();
    await expect(page.locator('.compose-form')).toBeHidden();
    const box = await page.locator('.vb-page').boundingBox();
    const vw = page.viewportSize().width;
    expect(box.width).toBeLessThanOrEqual(vw);
    // Xuất khi thiếu dữ liệu tự quay về biểu mẫu
    await page.locator('[data-pane-btn="form"]').click();
    await page.fill('[name="trichYeu"]', '');
    await page.locator('[data-pane-btn="preview"]').click();
    await page.locator('[data-export]').click();
    await expect(page.locator('.compose-form')).toBeVisible();
    await expect(page.locator('[name="trichYeu"]')).toBeFocused();
  });

  for (const view of ['dashboard', 'chat', 'spell', 'summary', 'templates', 'docs', 'settings', 'legal', 'legal/222', 'cases', 'interview', 'help', 'help/kho', 'help/interview', 'pdf', 'legal/vu-viec', 'theo-doi', 'so-do']) {
    test(`màn hình ${view} không tràn ngang`, async ({ page }) => {
      const t = trackErrors(page);
      await freshApp(page, `#${view}`);
      await page.waitForTimeout(200);
      expect(await noHorizontalScroll(page)).toBe(true);
      const viewScroll = await page.locator('#view').evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
      expect(viewScroll).toBe(true);
      t.assertClean();
    });
  }
});

test('ghi lời khai trên điện thoại: kế hoạch, ghi hỏi – đáp, không tràn ngang', async ({ page }) => {
  await freshApp(page, '#legal/354');
  // Điện thoại mặc định ở chế độ xem → bật "Sửa" để ghi lời khai trực tiếp.
  await page.click('[data-mode-toggle]');
  await expect(page.locator('body')).not.toHaveClass(/view-mode/);
  await page.locator('[data-start]').click();
  await page.fill('#st-name', 'Lê Văn Cường');
  await page.locator('.modal button[type="submit"]').click();
  await expect(page).toHaveURL(/#interview\//);
  // Điện thoại: biên bản mở ở thẻ “Biên bản”; chuyển sang thẻ “Kế hoạch” để chọn câu hỏi, chọn xong tự quay lại.
  await page.locator('[data-mp-tab="plan"]').click();
  await page.locator('.iv-issue[open] [data-pq]').first().click();
  await expect(page.locator('[data-mp-tab="main"]')).toHaveAttribute('aria-selected', 'true');
  await page.fill('[data-a]', 'Tôi không nhận tiền của ai.');
  await page.locator('[data-submit]').click();
  await expect(page.locator('.iv-qa')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test.describe('Điều hướng và bố cục điện thoại', () => {
  test('thanh điều hướng dưới: đúng mục theo quyền, đánh dấu màn hình đang mở, nút Thêm mở menu', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#cases');
    const nav = page.locator('[data-bottom-nav]');
    await expect(nav).toBeVisible();
    await expect(nav.locator('[data-bn]')).toHaveText(['Tra cứu', 'Hồ sơ', 'Bình luận', 'Biểu mẫu']);
    await expect(nav.locator('[data-bn="cases"]')).toHaveAttribute('aria-current', 'page');
    await nav.locator('[data-bn="binh-luan"]').click();
    await expect(page).toHaveURL(/#binh-luan$/);
    await expect(nav.locator('[data-bn="binh-luan"]')).toHaveAttribute('aria-current', 'page');
    await page.goto('/app.html#spell');
    await expect(nav.locator('[data-bn-more]')).toHaveAttribute('aria-current', 'page');
    await nav.locator('[data-bn-more]').click();
    await expect(page.locator('#sidebar')).toHaveClass(/open/);
    t.assertClean();
  });

  test('màn hình nhiều cột chia thẻ: cây hỏi đáp tự chuyển sang nội dung khi chọn tội danh', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal');
    const tabs = page.locator('.legal .pane-tabs');
    await expect(tabs).toBeVisible();
    await expect(page.locator('.lg-side')).toBeVisible();
    await expect(page.locator('.lg-main')).toBeHidden();
    await page.fill('.lg-side [data-q]', '353');
    await page.locator('[data-crime="353"]').click();
    await expect(page.locator('.lg-main')).toBeVisible();
    await expect(page.locator('.lg-side')).toBeHidden();
    await expect(tabs.locator('[data-mp-tab="main"]')).toContainText('Điều 353');
    // Kho hồ sơ: hai thẻ Tài liệu / Trợ lý.
    await page.goto('/app.html#kho');
    await page.locator('[data-mp-tab="ai"]').click();
    await expect(page.locator('.kho-ai [data-input]')).toBeVisible();
    await expect(page.locator('.kho-lib')).toBeHidden();
    t.assertClean();
  });

  test('hộp thoại hiện dạng tấm trượt từ dưới lên, nút thao tác vừa tay', async ({ page }) => {
    await freshApp(page, '#cases');
    await page.click('[data-mode-toggle]'); // chế độ Sửa: hiện nút Tạo hồ sơ
    await page.locator('[data-new]').first().click();
    await page.waitForTimeout(500); // chờ hiệu ứng trượt lên kết thúc
    const box = await page.locator('.modal').boundingBox();
    const vp = page.viewportSize();
    expect(Math.round(box.x)).toBe(0);
    expect(Math.round(box.width)).toBe(vp.width);
    expect(Math.abs(box.y + box.height - vp.height)).toBeLessThan(2);
    const btn = await page.locator('.modal .modal-actions .btn').first().boundingBox();
    expect(btn.height).toBeGreaterThanOrEqual(40);
  });

  test('sơ đồ tự vẽ trên điện thoại: không tràn ngang, thêm nút bằng chạm, toàn màn hình', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#so-do');
    await page.locator('[data-cm-blank]').click();
    const dg = page.locator('[data-dg]');
    await expect(dg).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.locator('[data-dg-mode="node"]').click();
    await page.locator('[data-dg-canvas]').click({ position: { x: 120, y: 120 } });
    await expect(dg.locator('.dg-node')).toHaveCount(2);
    await page.locator('[data-dg-label]').fill('Nguyễn Văn An');
    await expect(dg.locator('.dg-node', { hasText: 'Nguyễn Văn An' })).toHaveCount(1);
    // Gợi ý trên hình: bảng gợi ý nằm gọn trong màn hình.
    await dg.locator('.dg-k-root [data-ideas]').click();
    const pop = dg.locator('[data-dg-pop]');
    await expect(pop).toBeVisible();
    const pb = await pop.boundingBox();
    expect(pb.x).toBeGreaterThanOrEqual(0);
    expect(pb.x + pb.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    await pop.locator('[data-idea]').first().click();
    await expect(dg.locator('.dg-node')).toHaveCount(3);
    await pop.locator('[data-pop-x]').click();
    await page.locator('[data-dg-full]').click();
    await expect(dg).toHaveClass(/is-full/);
    const box = await dg.boundingBox();
    const vp = page.viewportSize();
    expect(Math.round(box.width)).toBe(vp.width);
    await page.locator('[data-dg-full]').click();
    await expect(dg).not.toHaveClass(/is-full/);
    expect(await noHorizontalScroll(page)).toBe(true);
    t.assertClean();
  });
});

test.describe('Điện thoại để xem, tra cứu', () => {
  async function seed(page) {
    return page.evaluate(async () => {
      const { casesRepo, recordsRepo } = await import('/assets/js/legal/repo.js');
      const { newRecord } = await import('/assets/js/legal/record.js');
      const c = casesRepo.save({ ten: 'Vụ tham ô tại Ban QLDA huyện X', soHoSo: '12/2026', toiDanh: ['353'], persons: [{ id: 'p1', hoTen: 'Nguyễn Văn An', roleId: 'bi-can' }] });
      const r = newRecord({ caseItem: c, person: c.persons[0], roleId: 'bi-can', plan: null, settings: {} });
      r.qa = [{ id: 'q1', q: 'Anh chuyển tiền cho ai?', a: 'Tôi chuyển 100 triệu đồng cho ông Trần Văn Bình.' }];
      recordsRepo.save(r);
      return c.id;
    });
  }

  test('mở ứng dụng vào trang Tra cứu; tìm theo nội dung lời khai, số điều; bấm kết quả mở bản đọc biên bản', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#dashboard');
    await seed(page);
    await page.goto('/app.html');
    await expect(page.locator('[data-view-title]')).toHaveText('Tra cứu');
    await expect(page.locator('body')).toHaveClass(/view-mode/);
    await expect(page.locator('.tc-tile')).not.toHaveCount(0);
    await expect(page.locator('.tc-group', { hasText: 'Hồ sơ gần đây' })).toContainText('Vụ tham ô tại Ban QLDA huyện X');
    // Tìm không dấu theo nội dung trả lời trong biên bản.
    await page.fill('[data-tc-q]', 'tran van binh');
    const rec = page.locator('.tc-group', { hasText: 'Biên bản lời khai' });
    await expect(rec).toContainText('Nguyễn Văn An — lần 1');
    await expect(rec.locator('.tc-snip mark').first()).toHaveText('Trần');
    await rec.locator('a').first().click();
    // Bản đọc: không có khung nhập, có Hỏi – Đáp, tải Word được.
    await expect(page.locator('.rd-page h1')).toHaveText('Nguyễn Văn An');
    await expect(page.locator('.rd-qa')).toContainText('Tôi chuyển 100 triệu đồng cho ông Trần Văn Bình.');
    await expect(page.locator('[data-a]')).toHaveCount(0);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-rd-export]')]);
    expect(dl.suggestedFilename()).toMatch(/\.docx$/);
    // Số điều → điều luật.
    await page.goto('/app.html#tra-cuu');
    await page.fill('[data-tc-q]', '353');
    await expect(page.locator('.tc-group', { hasText: 'Điều luật' })).toContainText('Điều 353.');
    // Biểu tượng tìm trên thanh trên cùng mở trang Tra cứu.
    await page.goto('/app.html#cases');
    await page.click('[data-palette-open]');
    await expect(page).toHaveURL(/#tra-cuu$/);
    t.assertClean();
  });

  test('chế độ xem ẩn nút tạo / sửa / xóa; bấm “Xem” → “Sửa” để hiện lại; ghi nhớ lựa chọn', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#dashboard');
    const id = await seed(page);
    await page.goto(`/app.html#cases/${id}`);
    await expect(page.locator('[data-mode-toggle]')).toContainText('Xem');
    await expect(page.locator('[data-edit]')).toBeHidden();
    await expect(page.locator('[data-interview]')).toBeHidden();
    await expect(page.locator('#view')).toContainText('Vụ tham ô tại Ban QLDA huyện X');
    await page.click('[data-mode-toggle]');
    await expect(page.locator('[data-mode-toggle]')).toContainText('Sửa');
    await expect(page.locator('[data-edit]')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-edit]')).toBeVisible();
    await page.click('[data-mode-toggle]');
    await expect(page.locator('[data-edit]')).toBeHidden();
    t.assertClean();
  });
});

