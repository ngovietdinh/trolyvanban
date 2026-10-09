import { test, expect } from '@playwright/test';
import { trackErrors, freshApp, mockClaude, setApiKey } from './helpers.mjs';

const ST = [
  ['Nguyễn Văn An', 'Tôi là kế toán Ban QLDA huyện X. Ngày 05/3/2025 tôi lập chứng từ chi khống rút 300 triệu đồng. Sau đó tôi chuyển cho ông Trần Văn Bình 100 triệu đồng. Tôi đưa cho bà Lê Thị Cúc 20 triệu đồng.'],
  ['Trần Văn Bình', 'Tôi là Giám đốc Ban QLDA huyện X. Tôi không nhận tiền của ông An.'],
  ['Lê Thị Cúc', 'Tôi nhận của ông An khoảng 30 triệu đồng. Hình như ông Phạm Văn Dũng có mặt. Ông Dũng nhận 5 triệu đồng từ ông An.'],
  ['Hoàng Văn Tư', 'Tôi đi công tác Hà Nội suốt tháng 3, không liên quan dự án.'],
];

async function fill(page, n = 3) {
  for (let i = 0; i < n; i++) {
    if (i >= 2) await page.click('[data-lk-add]');
    const box = page.locator('[data-stmt]').nth(i);
    await box.locator('[data-lk-name]').fill(ST[i][0]);
    await box.locator('[data-lk-text]').fill(ST[i][1]);
  }
}

test.describe('v2.28 — Phân tích lời khai', () => {
  test('máy phân tích ngay khi gõ: điểm cần làm rõ, sơ đồ, đối chiếu, câu hỏi; lưu phiên', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page);
    await page.goto('/app.html#loi-khai');
    await expect(page.locator('.page-title')).toContainText('Phân tích');
    await fill(page);
    await expect(page.locator('[data-lk-status]')).toContainText('Máy đã phân tích 3 lời khai');
    const issues = page.locator('[data-lk-issues]');
    await expect(issues.locator('.lk-issue.lv-cao', { hasText: 'Lời khai trái ngược' })).toContainText('Trần Văn Bình phủ nhận');
    await expect(issues.locator('.lk-issue', { hasText: 'Số tiền khác nhau' })).toContainText('20 triệu đồng / 30 triệu đồng');
    await expect(issues.locator('.lk-issue', { hasText: 'Chưa có lời khai của Phạm Văn Dũng' })).toBeVisible();
    await expect(issues.locator('.lk-issue', { hasText: 'Trả lời mơ hồ' }).first()).toBeVisible();
    // Không có AI: vẫn có câu hỏi gợi ý, không có nút hỏi AI.
    await expect(issues.locator('.lk-ask').first()).toBeVisible();
    await expect(issues.locator('[data-lk-ai]')).toHaveCount(0);
    // Sơ đồ quan hệ dựng sẵn; “Xem trên sơ đồ” làm nổi người liên quan.
    await expect(page.locator('[data-lk-dg] .dg-node', { hasText: 'Trần Văn Bình' }).first()).toBeVisible();
    await issues.locator('.lk-issue', { hasText: 'Số tiền khác nhau' }).locator('[data-lk-show]').click();
    await expect(page.locator('[data-lk-tab="dong-tien"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-lk-dg] .dg-node.hl').first()).toBeVisible();
    // Đối chiếu lời khai: phủ nhận được đánh dấu.
    await page.click('[data-lk-tab="doi-chieu"]');
    const binh = page.locator('.lk-sp', { hasText: 'Trần Văn Bình' });
    await expect(binh.locator('.lk-claims .deny')).toHaveCount(1);
    // Câu hỏi làm rõ gom theo người được hỏi; đánh dấu đã rõ thì bỏ ra.
    await page.click('[data-lk-tab="cau-hoi"]');
    await expect(page.locator('.lk-q').filter({ has: page.locator('h3', { hasText: 'Phạm Văn Dũng' }) })).toContainText('Triệu tập');
    const before = await issues.locator('.lk-is-head .badge').textContent();
    await issues.locator('.lk-issue', { hasText: 'Chưa có lời khai của Phạm Văn Dũng' }).locator('[data-lk-done]').click();
    await expect(issues.locator('.lk-is-head .badge')).toHaveText(String(Number(before) - 1));
    await expect(page.locator('.lk-q', { hasText: 'Triệu tập' })).toHaveCount(0);
    // Sửa lời khai → cập nhật ngay.
    await page.locator('[data-stmt]').nth(1).locator('[data-lk-text]').fill('Tôi là Giám đốc Ban QLDA huyện X. Tôi có nhận 100 triệu đồng của ông An.');
    await expect(issues.locator('.lk-issue', { hasText: 'Lời khai trái ngược' })).toHaveCount(0);
    // Mở lại trang: phiên còn nguyên.
    await page.reload();
    await expect(page.locator('[data-stmt]')).toHaveCount(3);
    await expect(page.locator('[data-lk-status]')).toContainText('3 lời khai');
    await expect(issues.locator('.lk-issue.done', { hasText: 'Phạm Văn Dũng' })).toBeVisible();
    // Mở trong Sơ đồ vụ việc.
    await page.click('[data-lk-open-map]');
    await expect(page).toHaveURL(/#so-do\/saved-lk-/);
    await expect(page.locator('[data-result]')).toContainText('Trần Văn Bình');
    t.assertClean();
  });

  test('dán biên bản nhiều người tự tách theo người khai', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page);
    await page.goto('/app.html#loi-khai');
    const text = `Lời khai của Nguyễn Văn An:\n${ST[0][1]}\nLời khai của Trần Văn Bình:\n${ST[1][1]}\nNgười khai: Lê Thị Cúc\n${ST[2][1]}`;
    await page.locator('[data-lk-text]').first().evaluate((el, txt) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', txt);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, text);
    await expect(page.locator('[data-lk-name]').nth(2)).toHaveValue('Lê Thị Cúc');
    await expect(page.locator('[data-lk-name]').first()).toHaveValue('Nguyễn Văn An');
    await expect(page.locator('[data-lk-status]')).toContainText('3 lời khai');
    t.assertClean();
  });

  test('AI chỉ làm rõ điểm được hỏi, chỉ gửi câu liên quan; quan hệ AI bịa bị bỏ', async ({ page }) => {
    const t = trackErrors(page);
    const calls = await mockClaude(page, (body) => {
      const ids = [...String(body.messages[0].content).matchAll(/\(id: ([^)]+)\)/g)].map((m) => m[1]);
      return JSON.stringify({ ketQua: ids.map((id) => ({ id, nhanDinh: 'Lời khai của An có cơ sở hơn vì nêu cụ thể số tiền.', cauHoi: [{ hoi: 'Ông nhận tiền ở đâu, ai chứng kiến?', ai: 'Trần Văn Bình' }], xacMinh: ['Sao kê tài khoản'], quanHe: [{ tu: 'Trần Văn Bình', den: 'Hoàng Văn Tư', loai: 'tien', noiDung: 'đưa', soTien: '999 triệu đồng', trich: 'Ông Bình đưa ông Tư 999 triệu đồng' }] })) });
    });
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    await page.goto('/app.html#loi-khai');
    await fill(page, 4);
    const issue = page.locator('.lk-issue', { hasText: 'Lời khai trái ngược' });
    await issue.locator('[data-lk-ai]').click();
    await expect(issue.locator('[data-lk-ans]')).toContainText('có cơ sở hơn');
    await expect(issue.locator('[data-lk-ans]')).toContainText('Hỏi Trần Văn Bình');
    await expect(page.locator('.toast', { hasText: 'không có nguyên văn' }).first()).toBeVisible();
    expect(calls).toHaveLength(1);
    const sent = String(calls[0].body.messages[0].content);
    expect(sent).toContain('không nhận tiền');
    expect(sent).not.toContain('công tác Hà Nội');
    await page.click('[data-lk-tab="quan-he"]');
    await expect(page.locator('[data-lk-dg] .dg-edge', { hasText: '999' })).toHaveCount(0);
    await page.click('[data-lk-tab="cau-hoi"]');
    await expect(page.locator('.lk-q').filter({ has: page.locator('h3', { hasText: 'Trần Văn Bình' }) })).toContainText('Ông nhận tiền ở đâu');
    // Gộp các điểm quan trọng còn lại vào một lần gọi.
    await page.click('[data-lk-ai-all]');
    await expect.poll(() => calls.length).toBe(2);
    expect(String(calls[1].body.messages[0].content).match(/### ĐIỂM/g).length).toBeGreaterThan(1);
    t.assertClean();
  });
});
