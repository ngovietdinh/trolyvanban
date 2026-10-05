import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { trackErrors, mockClaude, freshApp, setApiKey } from './helpers.mjs';
import { docxToText } from '../../assets/js/lib/docx.js';

/** Tạo tệp .docx nén DEFLATE (giống Word thật) bằng zipfile của Python. */
function makeDocx() {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const P = (...runs) => `<w:p><w:pPr><w:jc w:val="both"/></w:pPr>${runs.map((r) => `<w:r><w:rPr><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">${r}</w:t></w:r>`).join('')}</w:p>`;
  const body = [
    P('CÔNG TY TNHH AN PHÁT'),
    P('Số: 08/2026/GGT'),
    P('Hà Nội, ngày 02 tháng ', '03 năm 2026'),
    P('GIẤY GIỚI THIỆU'),
    P('Kính gửi: Ủy ban nhân dân phường Ba Đình'),
    P('Công ty giới thiệu ông: ', 'Lê Minh Tuấn'),
    P('Chức vụ: Trưởng phòng hành chính'),
    P('Được cử đến liên hệ công tác về việc: cấp phép sửa chữa trụ sở.'),
    P('Giấy giới thiệu có giá trị đến hết ngày 30/3/2026.'),
  ].join('');
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr/></w:body></w:document>`,
  };
  const dir = mkdtempSync(join(tmpdir(), 'tpl-'));
  writeFileSync(join(dir, 'files.json'), JSON.stringify(files));
  const out = join(dir, 'giay-gioi-thieu.docx');
  execFileSync('python3', ['-c', 'import json,sys,zipfile\nf=json.load(open(sys.argv[1]))\nz=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED)\n[z.writestr(k,v) for k,v in f.items()]\nz.close()', join(dir, 'files.json'), out]);
  return out;
}

test.describe('Cây hỏi đáp: hành vi thủ công, gợi ý câu hỏi, phiếu hỏi', () => {
  test('thêm hành vi thủ công (gợi ý ngoại tuyến), sinh vấn đề, sửa và xóa', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal/222');
    await page.locator('[data-act-add]').click();
    const modal = page.locator('.modal');
    await modal.locator('[name="ten"]').fill('Chia nhỏ gói thầu để chỉ định thầu');
    await modal.locator('[data-act-ai]').click();
    await expect(modal.locator('[name="cauHoi"]')).toHaveValue(/chia nhỏ gói thầu để chỉ định thầu: thời gian/);
    await modal.locator('[name="cauHoi"]').evaluate((el) => (el.value += '\nVì sao không tổ chức đấu thầu rộng rãi?'));
    await modal.locator('button[type="submit"]').click();
    const act = page.locator('.lg-act.custom');
    await expect(act).toContainText('Chia nhỏ gói thầu');
    await expect(act).toContainText('Tự thêm');
    await expect(act.locator('input')).toBeChecked();
    const issue = page.locator('.lg-issue[data-issue^="hv-tt-"]');
    await expect(issue).toContainText('Vì sao không tổ chức đấu thầu rộng rãi?');
    // Sửa
    await act.hover();
    await act.locator('[data-act-edit]').click();
    await modal.locator('[name="ten"]').fill('Chia nhỏ gói thầu trái quy định');
    await modal.locator('button[type="submit"]').click();
    await expect(page.locator('.lg-act.custom')).toContainText('trái quy định');
    // Lưu lại sau khi tải lại trang
    await page.reload();
    await expect(page.locator('.lg-act.custom')).toContainText('trái quy định');
    // Xóa
    await page.locator('.lg-act.custom').hover();
    await page.locator('[data-act-del]').click();
    await page.locator('.modal [data-yes]').click();
    await expect(page.locator('.lg-act.custom')).toHaveCount(0);
    t.assertClean();
  });

  test('gợi ý câu hỏi truy tiếp ngoại tuyến cho từng câu hỏi, thêm vào vấn đề', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal/353');
    const issue = page.locator('.lg-issue').nth(1);
    const n = await issue.locator('.lg-q').count();
    await issue.locator('.lg-q').first().hover();
    await issue.locator('.lg-q [data-qai]').first().click();
    const box = issue.locator('.lg-sugg');
    await expect(box).toContainText('Câu hỏi truy tiếp');
    await expect(box).toContainText('Gợi ý ngoại tuyến');
    await box.locator('[data-sugg-add]').first().click();
    await expect(issue.locator('.lg-q')).toHaveCount(n + 1);
    await expect(box.locator('li em').first()).toContainText('Đã thêm');
    await box.locator('[data-sugg-all]').click();
    await expect(issue.locator('.lg-q')).toHaveCount(n + 5);
    await box.locator('[data-sugg-close]').click();
    await expect(issue.locator('.lg-sugg')).toHaveCount(0);
    t.assertClean();
  });

  test('gợi ý AI cho vấn đề (Claude giả lập)', async ({ page }) => {
    const calls = await mockClaude(page, () => '{"cauHoi":["Ai ký duyệt chứng từ chi khống?","Tiền chi khống được chuyển vào tài khoản nào?"]}');
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test');
    await page.goto('/app.html#legal/353');
    const issue = page.locator('.lg-issue').nth(1);
    await issue.locator('[data-issue-ai]').click();
    const box = issue.locator('.lg-sugg');
    await expect(box.locator('li')).toHaveCount(2);
    await expect(box).toContainText('Ai ký duyệt chứng từ chi khống?');
    await box.locator('[data-sugg-all]').click();
    await expect(issue.locator('.lg-q', { hasText: 'Tiền chi khống được chuyển' })).toHaveCount(1);
    await expect(issue.locator('.lg-q', { hasText: 'Tiền chi khống được chuyển' })).toContainText('AI gợi ý');
    expect(calls.at(-1).body.messages[0].content).toContain('Vấn đề cần làm rõ');
  });

  test('xuất phiếu hỏi Word: toàn bộ câu hỏi, chưa có câu trả lời', async ({ page }) => {
    await freshApp(page, '#legal/222');
    const total = Number((await page.locator('[data-stats] strong').nth(1).textContent()).trim());
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-export-blank]').click()]);
    expect(dl.suggestedFilename()).toMatch(/^phieu-hoi-dieu-222/);
    const text = await docxToText(readFileSync(await dl.path()));
    expect(text).toContain('BIÊN BẢN HỎI CUNG BỊ CAN');
    expect(text).toContain('Bộ luật Tố tụng hình sự, tiến hành hỏi cung bị can:');
    expect((text.match(/^Hỏi: /gm) || []).length).toBe(total);
    expect(text).toMatch(/Đáp: …{10,}/);
    expect(text).not.toContain('[Chưa có nội dung');
  });

  test('ghi lời khai với câu hỏi đưa sẵn: ghi trả lời lần lượt, xuất Word', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#legal/353');
    await page.locator('[data-start]').click();
    await page.locator('.modal [name="hoTen"]').fill('Nguyễn Văn Bình');
    await page.locator('.modal [name="prefill"]').check();
    await page.locator('.modal button[type="submit"]').click();
    await expect(page).toHaveURL(/#interview\//);
    const pending = page.locator('.iv-qa.pending');
    await expect(pending.first()).toBeVisible();
    const total = await pending.count();
    expect(total).toBeGreaterThan(10);
    await expect(page.locator('[data-prefill]')).toHaveCount(0);
    // Bấm câu hỏi đầu tiên → ghi trả lời → tự chuyển câu chưa trả lời kế tiếp
    await pending.first().click();
    await expect(page.locator('[data-submit]')).toContainText('Ghi trả lời lượt 1');
    await page.fill('[data-a]', 'Tôi tên là Nguyễn Văn Bình, sinh năm 1980.');
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('.iv-qa.pending')).toHaveCount(total - 1);
    await expect(page.locator('[data-submit]')).toContainText('Ghi trả lời lượt 2');
    // Chọn câu hỏi từ kế hoạch → sửa đúng lượt đã đưa sẵn, không tạo bản trùng
    const count = await page.locator('.iv-qa').count();
    await page.locator('.iv-pq').nth(2).click();
    await page.fill('[data-a]', 'Có.');
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('.iv-qa')).toHaveCount(count);
    await expect(page.locator('.iv-qa.pending')).toHaveCount(total - 2);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-export]').click()]);
    const text = await docxToText(readFileSync(await dl.path()));
    expect(text).toContain('Đáp: Tôi tên là Nguyễn Văn Bình, sinh năm 1980.');
    expect(text).toMatch(/Đáp: …{10,}/);
    t.assertClean();
  });

  test('biên bản trống: thêm tất cả câu hỏi kế hoạch; mẫu số cấu hình trong Cài đặt', async ({ page }) => {
    await freshApp(page, '#settings');
    await page.fill('#lo-mauSo', '140');
    await page.fill('#lo-thongTu', 'Thông tư số 01/2025/TT-BCA');
    await page.locator('#lo-mauSo').evaluate((el) => el.form.requestSubmit());
    await page.goto('/app.html#legal/235');
    await page.locator('[data-role="lam-chung"]').click();
    await page.locator('[data-start]').click();
    await page.locator('.modal [name="hoTen"]').fill('Phạm Văn Đông');
    await page.locator('.modal button[type="submit"]').click();
    await expect(page.locator('.iv-qa')).toHaveCount(0);
    await page.locator('[data-prefill]').click();
    await expect(page.locator('.iv-qa.pending').first()).toBeVisible();
    await page.locator('[data-preview]').click();
    const doc = page.locator('.modal .vb-page');
    await expect(doc.locator('.vb-form-no')).toContainText('Mẫu số: 140');
    await expect(doc.locator('.vb-form-no')).toContainText('BH theo Thông tư số 01/2025/TT-BCA');
    await expect(doc).toContainText('Tư cách tham gia tố tụng: Người làm chứng');
    await expect(doc).toContainText('Điều 178, Điều 185, Điều 186, Điều 187');
  });
});

test.describe('Mẫu văn bản từ file Word', () => {
  test('tải lên → nhận diện → tạo trường bằng bôi đen → lưu → điền → xuất Word', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#templates');
    await page.locator('[data-new-tpl]').click();
    await expect(page).toHaveURL(/#tpl\/new$/);
    await page.locator('[data-file]').setInputFiles(makeDocx());
    await expect(page.locator('[data-ten]')).toHaveValue('giay-gioi-thieu');
    const marks = page.locator('.tpl-doc mark');
    await expect(page.locator('.tpl-doc')).toContainText('GIẤY GIỚI THIỆU');
    await expect(page.locator('.tpl-field', { has: page.locator('[data-label][value="Số, ký hiệu văn bản"]') })).toHaveCount(1);
    await expect(marks.filter({ hasText: 'Hà Nội, ngày 02 tháng 03 năm 2026' })).toHaveCount(1);
    await expect(marks.filter({ hasText: 'Ủy ban nhân dân phường Ba Đình' })).toHaveCount(1);
    await expect(marks.filter({ hasText: 'Lê Minh Tuấn' })).toHaveCount(1);
    // Bôi đen nội dung công tác để tạo trường
    const W = 'cấp phép sửa chữa trụ sở';
    await page.locator('.tpl-doc p', { hasText: W }).evaluate((p, W) => {
      const node = [...p.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes(W));
      const k = node.textContent.indexOf(W);
      const r = document.createRange();
      r.setStart(node, k);
      r.setEnd(node, k + W.length);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }, W);
    await page.locator('[data-make]').click();
    await page.locator('.modal [name="label"]').fill('Nội dung công tác');
    await page.locator('.modal button[type="submit"]').click();
    await expect(marks.filter({ hasText: W })).toHaveCount(1);
    await page.fill('[data-ten]', 'Giấy giới thiệu công tác');
    await page.locator('[data-save]').click();
    await expect(page).toHaveURL(/#tpl\/[\w-]+$/);
    // Thư viện hiển thị “Mẫu của tôi”
    await page.goto('/app.html#templates');
    const card = page.locator('.tpl-mine-card');
    await expect(card).toContainText('Giấy giới thiệu công tác');
    await card.locator('a', { hasText: 'Dùng mẫu' }).click();
    // Chế độ điền nội dung
    await page.locator('.tpl-fields').getByLabel('Họ và tên').fill('Phạm Thu Hà');
    await page.locator('.tpl-fields').getByLabel('Nội dung công tác').fill('nhận bàn giao mặt bằng');
    await page.locator('.tpl-fields').getByLabel('Số, ký hiệu văn bản').fill('15/2026/GGT');
    await expect(page.locator('.tpl-doc mark.filled', { hasText: 'Phạm Thu Hà' })).toHaveCount(1);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-export]').click()]);
    const text = await docxToText(readFileSync(await dl.path()));
    expect(text).toContain('Công ty giới thiệu ông: Phạm Thu Hà');
    expect(text).toContain('Số: 15/2026/GGT');
    expect(text).toContain('liên hệ công tác về việc: nhận bàn giao mặt bằng.');
    expect(text).toContain('Hà Nội, ngày 02 tháng 03 năm 2026'); // không điền → giữ nguyên
    // Xóa mẫu
    await page.goto('/app.html#templates');
    await page.locator('[data-del-tpl]').click();
    await page.locator('.modal [data-yes]').click();
    await expect(page.locator('.tpl-mine-card')).toHaveCount(0);
    t.assertClean();
  });

  test('AI chắt lọc mẫu (Claude giả lập): đặt tên, thêm trường hợp lệ, bỏ trường bịa', async ({ page }) => {
    await mockClaude(page, () =>
      JSON.stringify({
        ten: 'Giấy giới thiệu',
        moTa: 'Giới thiệu cán bộ đi liên hệ công tác',
        truong: [
          { label: 'Nội dung công tác', find: 'cấp phép sửa chữa trụ sở', para: 7, hint: 'Việc cần liên hệ' },
          { label: 'Thời hạn', find: '30/3/2026', para: 8 },
          { label: 'Bịa', find: 'không tồn tại', para: 1 },
        ],
      }),
    );
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test');
    await page.goto('/app.html#tpl/new');
    await page.locator('[data-file]').setInputFiles(makeDocx());
    const before = await page.locator('.tpl-field').count();
    await page.locator('[data-ai]').click();
    await expect(page.locator('.tpl-field')).toHaveCount(before + 2);
    await expect(page.locator('.toast').last()).toContainText('AI chắt lọc thêm 2 trường');
    await expect(page.locator('[data-ten]')).toHaveValue('Giấy giới thiệu');
    await expect(page.locator('[data-mota]')).toHaveValue('Giới thiệu cán bộ đi liên hệ công tác');
    await expect(page.locator('.tpl-doc mark', { hasText: 'cấp phép sửa chữa trụ sở' })).toHaveCount(1);
  });

  test('từ chối tệp không phải .docx', async ({ page }) => {
    await freshApp(page, '#tpl/new');
    await page.locator('[data-file]').setInputFiles({ name: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
    await expect(page.locator('.toast').last()).toContainText('.docx');
  });
});
