import { test, expect } from '@playwright/test';
import { trackErrors, freshApp, mockClaude, setApiKey } from './helpers.mjs';

const TEXT = 'Ngày 05/3/2025 ông Nguyễn Văn An, kế toán Ban QLDA huyện X lập chứng từ chi khống rút 300 triệu đồng. Sau đó ông An chuyển cho ông Bình 100 triệu đồng. Bà Lê Thị Cúc nhận 20 triệu đồng của ông An.';

test.describe('v2.29 — tên chính xác 100%, tên chưa rõ không vào sơ đồ', () => {
  test('Sơ đồ vụ việc: tên chưa rõ ghi riêng, không có trên sơ đồ; AI bịa tên bị bỏ', async ({ page }) => {
    const t = trackErrors(page);
    await mockClaude(page, () => JSON.stringify({ tomTat: 'A', banChat: [], nguoi: [{ ten: 'Phạm Văn Dũng', vaiTro: '' }, { ten: 'Ông Hải', vaiTro: '' }], hanhVi: [], quanHe: [{ tu: 'Nguyễn Văn An', den: 'Phạm Văn Dũng', loai: 'tien', noiDung: 'đưa', soTien: '20 triệu đồng' }, { tu: 'Nguyễn Văn An', den: 'Lê Thị Cúc', loai: 'tien', noiDung: 'đưa', soTien: '20 triệu đồng' }], moc: [] }));
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    await page.goto('/app.html#so-do');
    await page.click('[data-src="files"]');
    await page.fill('[data-cm-text]', TEXT);
    await page.check('[data-cm-ai]');
    await page.click('[data-cm-run]');
    const res = page.locator('[data-result]');
    await expect(res).toContainText('AI kết hợp');
    await expect(page.locator('.toast', { hasText: 'tên người' }).first()).toBeVisible();
    // Bản chất: người rõ chỉ gồm họ tên đầy đủ; “Bình” nằm ở mục chưa rõ.
    const chips = res.locator('.cm-people');
    await expect(chips.locator('.cm-chip', { hasText: 'Nguyễn Văn An' })).toBeVisible();
    await expect(chips.locator('.cm-chip', { hasText: 'Bình' })).toHaveCount(0);
    await expect(chips.locator('.cm-chip', { hasText: 'Dũng' })).toHaveCount(0);
    const un = res.locator('.cm-unclear');
    await expect(un.locator('li', { hasText: 'Bình' })).toContainText('chưa rõ');
    await expect(un.locator('li', { hasText: 'Bình' })).toContainText('chưa có họ tên đầy đủ');
    // Mọi sơ đồ đều không có người chưa rõ.
    for (const tab of ['ve', 'cay', 'quan-he', 'dong-tien']) {
      await page.click(`[data-cm-tab="${tab}"]`);
      await expect(res.locator('[data-dg] .dg-node').first()).toBeVisible();
      if (tab === 'quan-he' || tab === 'dong-tien') await expect(res.locator('[data-dg] .dg-node', { hasText: 'Lê Thị Cúc' }).first()).toBeVisible();
      await expect(res.locator('[data-dg] .dg-node', { hasText: /Bình|Dũng|Hải/ })).toHaveCount(0);
      await expect(res.locator('.cm-dg-unclear')).toContainText('tên chưa rõ');
    }
    t.assertClean();
  });

  test('Phân tích lời khai: điểm Tên chưa rõ, xác nhận họ tên → vào sơ đồ, bỏ xác nhận → ra khỏi sơ đồ', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page);
    await page.goto('/app.html#loi-khai');
    const box = page.locator('[data-stmt]').first();
    await box.locator('[data-lk-name]').fill('Nguyễn Văn An');
    await box.locator('[data-lk-text]').fill('Tôi chuyển cho ông Bình 100 triệu đồng. Tôi đưa cho bà Lê Thị Cúc 20 triệu đồng.');
    const issue = page.locator('.lk-issue', { hasText: 'Tên chưa rõ' });
    await expect(issue).toContainText('“Bình”');
    await expect(issue.locator('[data-lk-show]')).toHaveCount(0);
    await expect(page.locator('[data-lk-dg] .dg-node', { hasText: 'Bình' })).toHaveCount(0);
    await expect(page.locator('.cm-dg-unclear')).toContainText('“Bình”');
    // Xác nhận sai (không kết thúc bằng “Bình”) bị từ chối.
    await issue.locator('[data-lk-fullname]').fill('Trần Văn Hải');
    await issue.locator('[data-lk-confirm]').click();
    await expect(page.locator('.toast', { hasText: 'kết thúc bằng' }).first()).toBeVisible();
    await issue.locator('[data-lk-fullname]').fill('Trần Văn Bình');
    await issue.locator('[data-lk-confirm]').click();
    await expect(page.locator('.lk-issue', { hasText: 'Tên chưa rõ' })).toHaveCount(0);
    await expect(page.locator('[data-lk-dg] .dg-node', { hasText: 'Trần Văn Bình' }).first()).toBeVisible();
    await expect(page.locator('[data-lk-names]')).toContainText('Trần Văn Bình');
    await page.reload();
    await expect(page.locator('[data-lk-names]')).toContainText('Trần Văn Bình');
    await page.click('[data-lk-unname="0"]');
    await expect(page.locator('.lk-issue', { hasText: 'Tên chưa rõ' })).toBeVisible();
    await expect(page.locator('[data-lk-dg] .dg-node', { hasText: 'Trần Văn Bình' })).toHaveCount(0);
    t.assertClean();
  });
});
