import { test, expect } from '@playwright/test';
import { trackErrors, freshApp, mockClaude, setApiKey } from './helpers.mjs';

const TEXT = 'Ngày 05/3/2025 ông Nguyễn Văn An, kế toán Ban QLDA huyện X lập chứng từ chi khống rút 300 triệu đồng. Sau đó ông An chuyển cho Giám đốc Trần Văn Bình 100 triệu đồng. Bà Lê Thị Cúc nhận 20 triệu đồng của ông An.';

async function drag(page, handle, dx, dy) {
  const b = await handle.boundingBox();
  const x = b.x + b.width / 2;
  const y = b.y + Math.min(b.height / 2, 60);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
}

test.describe('v2.30 — chính xác điều luật, dòng tiền; kéo tùy biến không gian làm việc', () => {
  test('kéo đổi độ rộng thanh menu, khung Cần làm rõ, khung vẽ sơ đồ; nhớ sau khi tải lại; bấm đúp về mặc định', async ({ page, isMobile }) => {
    test.skip(isMobile, 'kéo chuột chỉ trên máy tính');
    const t = trackErrors(page);
    await freshApp(page);
    await page.goto('/app.html#loi-khai');
    // Thanh menu
    const sb = page.locator('.sidebar');
    const w0 = (await sb.boundingBox()).width;
    await drag(page, page.locator('.sb-grip'), 90, 0);
    await expect.poll(async () => (await sb.boundingBox()).width).toBeGreaterThan(w0 + 60);
    await page.reload();
    await expect.poll(async () => (await sb.boundingBox()).width).toBeGreaterThan(w0 + 60);
    await page.locator('.sb-grip').dblclick();
    await expect.poll(async () => Math.round((await sb.boundingBox()).width)).toBe(Math.round(w0));
    // Khung Cần làm rõ
    const box = page.locator('[data-stmt]').first();
    await box.locator('[data-lk-name]').fill('Nguyễn Văn An');
    await box.locator('[data-lk-text]').fill('Tôi chuyển cho ông Bình 100 triệu đồng. Tôi đưa cho bà Lê Thị Cúc 20 triệu đồng.');
    const issues = page.locator('[data-lk-issues]');
    await expect(issues).toBeVisible();
    const i0 = (await issues.boundingBox()).width;
    await drag(page, page.locator('[data-lk-split]'), 110, 0);
    await expect.poll(async () => (await issues.boundingBox()).width).toBeGreaterThan(i0 + 70);
    // Khung vẽ sơ đồ: chiều cao + khung thuộc tính
    const canvas = page.locator('[data-lk-dg] [data-dg-canvas]');
    await expect(canvas).toBeVisible();
    const h0 = (await canvas.boundingBox()).height;
    await page.locator('[data-lk-dg] [data-dg-grip]').scrollIntoViewIfNeeded();
    await drag(page, page.locator('[data-lk-dg] [data-dg-grip]'), 0, -120);
    await expect.poll(async () => (await canvas.boundingBox()).height).toBeLessThan(h0 - 80);
    await page.locator('[data-lk-dg] [data-dg-vsplit]').scrollIntoViewIfNeeded();
    const p0 = (await page.locator('[data-lk-dg] [data-dg-props]').boundingBox()).width;
    await drag(page, page.locator('[data-lk-dg] [data-dg-vsplit]'), -35, 0);
    await expect.poll(async () => (await page.locator('[data-lk-dg] [data-dg-props]').boundingBox()).width).toBeGreaterThan(p0 + 20);
    await page.reload();
    await expect.poll(async () => (await page.locator('[data-lk-dg] [data-dg-canvas]').boundingBox())?.height).toBeLessThan(h0 - 80);
    t.assertClean();
  });

  test('AI gán điều luật không đủ căn cứ → “chưa xác định điều luật”; dòng tiền không có câu nguyên văn bị bỏ; lời nhắc có quy tắc + danh mục', async ({ page }) => {
    const t = trackErrors(page);
    const calls = await mockClaude(page, () => JSON.stringify({
      tomTat: 'An chi khống rút tiền.', banChat: ['An rút 300 triệu đồng bằng chứng từ chi khống', 'An chi khống rút 300 triệu đồng bằng chứng từ'],
      nguoi: [], chuaRo: ['Chưa rõ Bình dùng 100 triệu đồng vào việc gì'],
      hanhVi: [
        { ten: 'Lập chứng từ chi khống rút tiền', dieu: '353', nguoi: ['Nguyễn Văn An'], trich: 'lập chứng từ chi khống rút 300 triệu đồng' },
        { ten: 'Lập hồ sơ giả hưởng bảo hiểm', dieu: '214', nguoi: ['Nguyễn Văn An'], trich: 'lập chứng từ chi khống rút 300 triệu đồng' },
      ],
      quanHe: [
        { tu: 'Nguyễn Văn An', den: 'Trần Văn Bình', loai: 'tien', noiDung: 'chuyển', soTien: '100 triệu đồng', trich: 'ông An chuyển cho Giám đốc Trần Văn Bình 100 triệu đồng' },
        { tu: 'Lê Thị Cúc', den: 'Trần Văn Bình', loai: 'tien', noiDung: 'đưa', soTien: '20 triệu đồng' },
      ],
      moc: [],
    }));
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    await page.goto('/app.html#so-do');
    await page.click('[data-src="files"]');
    await page.fill('[data-cm-text]', TEXT);
    await page.check('[data-cm-ai]');
    await page.click('[data-cm-run]');
    const res = page.locator('[data-result]');
    await expect(res).toContainText('AI kết hợp');
    await expect(page.locator('.toast', { hasText: 'chưa đủ căn cứ' }).first()).toBeVisible();
    // Bản chất: điều luật có căn cứ; điều 214 không có; điểm còn thiếu do AI nêu; ý trùng gộp một.
    const law = res.locator('.cm-law');
    await expect(law).toContainText('Điều 353');
    await expect(law).not.toContainText('Điều 214');
    await expect(res).toContainText('Điểm còn thiếu');
    await expect(res.locator('.cm-points li', { hasText: 'rút 300 triệu đồng bằng chứng từ' })).toHaveCount(1);
    // Sơ đồ hành vi: hành vi gán đại được xếp vào “chưa xác định điều luật”.
    await page.click('[data-cm-tab="cay"]');
    await expect(res.locator('[data-dg] .dg-node', { hasText: 'Điều 353' }).first()).toBeVisible();
    await expect(res.locator('[data-dg] .dg-node', { hasText: 'Điều 214' })).toHaveCount(0);
    await expect(res.locator('[data-dg] .dg-node', { hasText: 'chưa xác định điều luật' }).first()).toBeVisible();
    // Dòng tiền Cúc → Bình (không có câu nguyên văn) không có.
    await page.click('[data-cm-tab="dong-tien"]');
    await expect(res.locator('[data-dg] .dg-edge', { hasText: '100 triệu' })).toHaveCount(1);
    await expect(res.locator('[data-dg] .dg-edge', { hasText: '20 triệu' })).toHaveCount(0); // Cúc → Bình không có câu nguyên văn: không có
    // Lời nhắc gửi AI: quy tắc + danh mục điều luật + yêu cầu trích nguyên văn.
    const sys = JSON.stringify(calls[0].raw.system);
    expect(sys).toContain('QUY TẮC');
    expect(sys).toContain('KHÔNG TRÙNG LẶP');
    const user = String(calls[0].body.messages[0].content);
    expect(user).toContain('DANH MỤC ĐIỀU LUẬT');
    expect(user).toContain('Điều 353');
    expect(user.indexOf('DANH MỤC ĐIỀU LUẬT')).toBeLessThan(user.indexOf('NỘI DUNG:'));
    t.assertClean();
  });
});
