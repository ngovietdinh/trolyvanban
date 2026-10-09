import { test, expect } from '@playwright/test';
import { trackErrors, freshApp, mockClaude, setApiKey } from './helpers.mjs';

const LOI_KHAI = 'Họ tên: Nguyễn Văn An\nHỏi: Anh trình bày diễn biến?\nĐáp: Ngày 05/3/2025 tôi lập chứng từ chi khống để rút tiền chiếm đoạt 300 triệu đồng. Sau đó tôi chuyển cho ông Trần Văn Bình 100 triệu đồng.\nHỏi: Ai chỉ đạo?\nĐáp: Ông Bình chỉ đạo tôi lập hồ sơ quyết toán. Ngày 10/4/2025 bà Lê Thị Cúc nhận 20 triệu đồng của tôi.';

test.describe('Sơ đồ vụ việc', () => {
  test('từ biên bản đã chọn: bản chất, sơ đồ hành vi, quan hệ – dòng tiền, dòng thời gian, xuất Word', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#cases');
    await page.click('[data-new]');
    await page.fill('#c-ten', 'Vụ tham ô tại Ban QLDA');
    await page.fill('#c-td', '353');
    await page.click('[data-f] button[type="submit"]');
    await expect(page).toHaveURL(/#cases\/.+/);
    await page.click('[data-add-person]');
    await page.selectOption('#p-role', 'bi-can');
    await page.fill('#p-hoTen', 'Nguyễn Văn An');
    await page.click('[data-f] button[type="submit"]');
    await page.click('[data-tab="records"]');
    await page.click('[data-upload-rec]');
    await page.fill('[data-ru-text]', LOI_KHAI);
    await page.click('[data-ru-read]');
    await page.click('[data-ru-save]');

    await page.click('a[href^="#so-do/"]');
    await expect(page.locator('[data-cm-rec]')).toHaveCount(1);
    await expect(page.locator('[data-cm-rec]')).toBeChecked();
    await page.click('[data-cm-run]');
    const res = page.locator('[data-result]');
    await expect(res.locator('h2')).toContainText('Vụ tham ô tại Ban QLDA');
    await expect(res.locator('.cm-points')).toContainText('Dòng tiền: Nguyễn Văn An → Trần Văn Bình: 100 triệu đồng');
    await expect(res.locator('.cm-points')).toContainText('Điều 353');
    await expect(res.locator('.cm-people')).toContainText('Người chỉ đạo');

    // Sơ đồ hành vi, quan hệ, dòng tiền: đều là sơ đồ sửa được.
    await page.click('[data-cm-tab="cay"]');
    await expect(res.locator('[data-dg] .dg-node.dg-k-crime')).toContainText('Điều 353');
    await expect(res.locator('[data-dg] .dg-node.dg-k-act').first()).toBeVisible();
    await expect(res.locator('[data-dg-lmode]')).toHaveValue('cay');

    await page.click('[data-cm-tab="quan-he"]');
    await expect(res.locator('[data-dg] .dg-node.dg-k-person')).toHaveCount(3);
    await expect(res.locator('[data-dg] .dg-edge.dg-e-tien')).toHaveCount(2);
    await expect(res.locator('[data-dg-lmode]')).toHaveValue('vong');
    await page.click('[data-cm-tab="dong-tien"]');
    await expect(res.locator('[data-dg] .dg-edge.dg-e-tien')).toHaveCount(2);
    await expect(res.locator('[data-dg] .dg-edge:not(.dg-e-tien)')).toHaveCount(0);

    await page.click('[data-cm-tab="thoi-gian"]');
    await expect(res.locator('.cm-time li')).toHaveCount(2);
    await expect(res.locator('.cm-time time').first()).toHaveText('05/03/2025');

    const dl = page.waitForEvent('download');
    await page.click('[data-cm-export]');
    expect((await dl).suggestedFilename()).toMatch(/so-do-vu-viec.*\.docx$/);
    t.assertClean();
  });

  test('từ tài liệu tải lên, có AI phân tích sâu', async ({ page }) => {
    const t = trackErrors(page);
    const calls = await mockClaude(page, () => JSON.stringify({ tomTat: 'Ông A tham ô 300 triệu, chuyển cho ông B.', banChat: ['A chi khống 300 triệu', 'B nhận 100 triệu'], nguoi: [{ ten: 'Nguyễn Văn An', vaiTro: 'Kế toán, người thực hiện' }, { ten: 'Trần Văn Bình', vaiTro: 'Giám đốc, người nhận tiền' }], hanhVi: [{ ten: 'Lập chứng từ chi khống', dieu: '353', nguoi: ['Nguyễn Văn An'], soTien: '300 triệu đồng' }], quanHe: [{ tu: 'Nguyễn Văn An', den: 'Trần Văn Bình', loai: 'tien', noiDung: 'chuyển', soTien: '100 triệu đồng' }], moc: [{ thoiGian: '05/03/2025', suKien: 'Lập chứng từ chi khống' }] }));
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    await page.goto('/app.html#so-do');
    await page.click('[data-src="files"]');
    await page.locator('[data-file]').setInputFiles({ name: 'ket-luan.txt', mimeType: 'text/plain', buffer: Buffer.from(LOI_KHAI, 'utf8') });
    await page.check('[data-cm-ai]');
    await page.click('[data-cm-run]');
    const res = page.locator('[data-result]');
    await expect(res.locator('h2')).toContainText('ket-luan');
    await expect(res).toContainText('AI kết hợp phân tích trên máy');
    await expect(res.locator('.cm-sum')).toContainText('tham ô 300 triệu');
    expect(calls.length).toBe(1);
    await page.click('[data-cm-tab="quan-he"]');
    await expect(res.locator('[data-dg] .dg-node', { hasText: 'Trần Văn Bình' })).toHaveCount(1);
    await expect(res.locator('[data-dg] .dg-edge.dg-e-tien')).toHaveCount(1);
    t.assertClean();
  });

  test('tài liệu dài: gửi AI theo từng phần, sơ đồ trên máy hiện ngay, AI bổ sung dần', async ({ page }) => {
    const t = trackErrors(page);
    const calls = await mockClaude(page, (body) => {
      const m = /PHẦN (\d+)\/(\d+)/.exec(body.messages[0].content);
      return JSON.stringify({ tomTat: `Phần ${m ? m[1] : 1}.`, banChat: [`Ý phần ${m ? m[1] : 1}`], nguoi: [], hanhVi: [], quanHe: [{ tu: 'Nguyễn Văn An', den: `Người ${m ? m[1] : 1}`, loai: 'tien', noiDung: 'đưa', soTien: '1 triệu' }], moc: [] });
    });
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    await page.goto('/app.html#so-do');
    await page.click('[data-src="files"]');
    const long = Array.from({ length: 160 }, (_, i) => `Ngày ${(i % 27) + 1}/3/2025 ông Nguyễn Văn An chuyển cho ông Trần Văn Bình ${i + 5} triệu đồng tại văn phòng lần thứ ${i}.`).join('\n');
    await page.fill('[data-cm-text]', long);
    await page.check('[data-cm-ai]');
    await page.click('[data-cm-run]');
    const res = page.locator('[data-result]');
    // Kết quả trên máy hiện ngay (AI giả lập trả lời rất nhanh nên chỉ kiểm tra khung kết quả đã có).
    await expect(res.locator('.cm-points')).toBeVisible();
    // Chờ AI xong mọi phần: nhãn cuối không còn “(đã xong phần i/n)”, nút Dừng biến mất.
    await expect(res.locator('.cm-res-head small')).toHaveText(/^AI kết hợp phân tích trên máy ·/, { timeout: 30000 });
    await expect(page.locator('[data-cm-stop]')).toHaveCount(0);
    expect(calls.length).toBeGreaterThan(1);
    expect(calls.every((c) => c.body.messages[0].content.length < 12000)).toBe(true);
    await expect(res.locator('.cm-points')).toContainText('Ý phần 2');
    t.assertClean();
  });
});
