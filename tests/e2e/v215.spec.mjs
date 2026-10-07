import { test, expect } from '@playwright/test';
import { trackErrors, freshApp, mockClaude, setApiKey } from './helpers.mjs';

const HO_SO = `BÁO CÁO KẾT QUẢ XÁC MINH
Qua thanh tra tại Ban quản lý dự án huyện X, đoàn thanh tra phát hiện ông Nguyễn Văn A, Kế toán trưởng, đã lập chứng từ chi khống để rút tiền chiếm đoạt tổng số 1,2 tỷ đồng trong năm 2023.
Bà Trần Thị B, thủ quỹ, thu tiền phí của các nhà thầu nhưng không nhập quỹ, không hạch toán số tiền 300 triệu đồng.
Ngoài ra, ông A đã sử dụng con dấu giả của Sở Tài chính để làm giả hồ sơ quyết toán nhằm hợp thức hóa các khoản chi.
Ông Lê Văn C, Giám đốc Ban, đã ký duyệt các chứng từ trên mà không kiểm tra, thiếu trách nhiệm gây thất thoát.
Hành vi của ông A có dấu hiệu tội Tham ô tài sản theo Điều 353 Bộ luật Hình sự; hành vi làm giả có dấu hiệu Điều 341 BLHS. Việc khởi tố thực hiện theo Điều 143 BLTTHS.`;

const row = (page, text) => page.locator('.la-row').filter({ has: page.locator(`[data-r-name][value*="${text}"]`) });

test.describe('Thêm hành vi từ tài liệu (Tố tụng)', () => {
  test('tải tài liệu → tóm tắt, liệt kê hành vi theo nhiều điều luật → chọn, sửa → thêm, câu hỏi tự sinh', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal/353');
    await page.click('[data-act-file]');
    const dlg = page.locator('.la-modal');
    await dlg.locator('[data-file]').setInputFiles({ name: 'bao-cao-xac-minh.txt', mimeType: 'text/plain', buffer: Buffer.from(HO_SO, 'utf8') });
    await expect(dlg.locator('[data-files]')).toContainText('bao-cao-xac-minh.txt');
    await dlg.locator('[data-analyze]').click();

    await expect(dlg.locator('.la-sum')).toContainText('Ban quản lý dự án');
    const chips = dlg.locator('.la-chip');
    await expect(chips.filter({ hasText: 'Điều 353' })).toHaveCount(1);
    await expect(chips.filter({ hasText: 'Điều 341' })).toHaveCount(1);
    await expect(chips.filter({ hasText: 'Điều 360' })).toHaveCount(1);
    // Không bắt nhầm điều không liên quan (vd: Điều 143 BLTTHS).
    await expect(chips.filter({ hasText: 'Điều 143' })).toHaveCount(0);

    // Hành vi đã có trong kế hoạch (hành vi đầu tiên của Điều 353) → không chọn lại.
    await expect(row(page, 'Lập chứng từ chi khống').locator('[data-r-check]')).not.toBeChecked();
    await expect(row(page, 'Lập chứng từ chi khống')).toContainText('Đã có trong kế hoạch');
    await expect(row(page, 'Thu tiền nhưng không nhập quỹ').locator('[data-r-check]')).toBeChecked();
    await expect(row(page, 'Sử dụng con dấu').locator('[data-r-check]')).toBeChecked();
    await expect(row(page, 'Lập chứng từ chi khống')).toContainText('Có trong hệ thống');
    await expect(row(page, 'Lập chứng từ chi khống').locator('.la-quote')).toContainText('chi khống');

    // Điều 360: hành vi ký duyệt không kiểm tra — chọn thêm.
    await row(page, 'Ký duyệt hồ sơ').locator('[data-r-check]').check();
    // Thêm một hành vi tự nhập, sửa tên → câu hỏi tự sinh theo dấu hiệu Điều 353.
    await dlg.locator('[data-add-row]').click();
    const blank = dlg.locator('.la-row').filter({ has: page.locator('[data-r-name][value=""]') });
    await blank.locator('[data-r-name]').fill('Chỉ đạo thủ quỹ không lập phiếu thu');
    await blank.locator('[data-r-name]').press('Tab');
    const fresh = row(page, 'Chỉ đạo thủ quỹ');
    await expect(fresh).toContainText('Hành vi mới');
    await fresh.locator('.la-qs summary').click();
    await expect(fresh.locator('[data-r-q]')).toHaveValue(/Làm rõ dấu hiệu/);
    await expect(dlg.locator('[data-commit]')).toHaveText(/Thêm 4 hành vi/);
    await dlg.locator('[data-commit]').click();
    await expect(page.locator('.toast').filter({ hasText: 'Đã thêm 4 hành vi' })).toBeVisible();

    // Điều đang mở có thêm hành vi; điều liên quan hiện thành khối riêng, câu hỏi sinh theo từng điều.
    await expect(page.locator('.lg-act.on').filter({ hasText: 'Chỉ đạo thủ quỹ không lập phiếu thu' })).toHaveCount(1);
    const rel = page.locator('[data-related]');
    await expect(rel.locator('[data-lq="341"]')).toBeVisible();
    await expect(rel.locator('[data-lq="360"]')).toBeVisible();
    const res = page.locator('[data-result]');
    await expect(res).toContainText('[Điều 341] Hành vi: Sử dụng con dấu');
    await expect(res).toContainText('[Điều 360] Hành vi: Ký duyệt hồ sơ');
    await expect(res).toContainText('[Điều 360] Lỗi');
    // Hành vi có sẵn được thêm câu hỏi bám nội dung tài liệu.
    await expect(res).toContainText('Tài liệu ghi nhận: “Ngoài ra, ông A đã sử dụng con dấu giả');

    // Bỏ một điều liên quan → câu hỏi của điều đó biến mất.
    await rel.locator('[data-lq-del="360"]').click();
    await expect(res).not.toContainText('[Điều 360]');
    // Lưu lại khi tải lại trang.
    await page.reload();
    await expect(page.locator('[data-lq="341"]')).toBeVisible();
    t.assertClean();
  });

  test('có AI: dùng kết quả AI (điều luật, đoạn trích, câu hỏi), kiểm tra điều luật có trong hệ thống', async ({ page }) => {
    const calls = await mockClaude(page, () =>
      JSON.stringify({
        tomTat: 'Kế toán trưởng lập chứng từ khống chiếm đoạt 1,2 tỷ; làm giả hồ sơ quyết toán.',
        hanhVi: [
          { ten: 'Lập chứng từ chi khống để rút tiền', dieu: '353', hanhViId: 'chi-khong', trich: 'lập chứng từ chi khống để rút tiền chiếm đoạt', lyDo: 'Kế toán trưởng có trách nhiệm quản lý tài sản' },
          { ten: 'Làm giả hồ sơ quyết toán', dieu: '341', hanhViId: null, trich: 'làm giả hồ sơ quyết toán', lyDo: 'Tài liệu giả của cơ quan', cauHoi: ['Hồ sơ quyết toán giả do ai lập, lập ở đâu?', 'Con dấu giả của Sở Tài chính có từ đâu?'] },
          { ten: 'Hành vi ở điều không có', dieu: '999', hanhViId: null, trich: '', lyDo: '' },
        ],
      }),
    );
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test-1234');
    await page.goto('/app.html#legal/353');
    await page.click('[data-act-file]');
    const dlg = page.locator('.la-modal');
    await expect(dlg.locator('[data-method][value="ket-hop"]')).toBeChecked();
    await dlg.locator('[data-text]').fill(HO_SO);
    await dlg.locator('[data-analyze]').click();
    await expect(dlg.locator('.la-sum')).toContainText('Kế toán trưởng lập chứng từ khống');
    const req = calls.at(-1).body;
    expect(JSON.stringify(req.messages)).toContain('[chi-khong]'); // danh mục hành vi của hệ thống gửi kèm
    await expect(row(page, 'Lập chứng từ chi khống')).toContainText('Có trong hệ thống');
    const fake = row(page, 'Làm giả hồ sơ quyết toán');
    await expect(fake).toContainText('Hành vi mới');
    await fake.locator('.la-qs summary').click();
    await expect(fake.locator('[data-r-q]')).toHaveValue(/Con dấu giả của Sở Tài chính/);
    const bad = row(page, 'Hành vi ở điều không có');
    await expect(bad).toContainText('chưa có trong hệ thống');
    await expect(bad.locator('[data-r-check]')).not.toBeChecked();
    await dlg.locator('[data-commit]').click();
    await expect(page.locator('[data-lq="341"]')).toContainText('Làm giả hồ sơ quyết toán');
    await expect(page.locator('[data-result]')).toContainText('Con dấu giả của Sở Tài chính có từ đâu?');
  });
});
