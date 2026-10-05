import { test, expect } from '@playwright/test';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { trackErrors, freshApp, mockClaude, setApiKey } from './helpers.mjs';

const BBLK = (ngay, tien, vague = 'Tôi không nhớ rõ, hình như là anh Nguyễn Hồ Hưng.') => [
  'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc', 'BIÊN BẢN GHI LỜI KHAI',
  `Hồi 9 giờ 00 phút ngày ${ngay} tháng 10 năm 2026 tại Cơ quan CSĐT Bộ Công an.`,
  'Họ tên: Trần Thiên Hà\tGiới tính: Nam;', 'Sinh ngày 26 tháng 05 năm 1971 tại thành phố Hà Nội;', 'Thẻ CCCD: 001071023745; cấp ngày: 27/8/2022;',
  'Nơi thường trú: Phòng 2306 Chung cư Lancaster, phường Giảng Võ, TP Hà Nội;', 'Tư cách tham gia tố tụng: Người có quyền lợi, nghĩa vụ liên quan đến vụ án.',
  'HỎI VÀ ĐÁP', 'Hỏi: Anh ký bao nhiêu hợp đồng cầm cố tiền gửi?', 'Đáp: Tôi ký 08 hợp đồng, tổng cộng 238 tỷ đồng.',
  'Hỏi: Ai yêu cầu anh ký?', `Đáp: ${vague}`, 'Hỏi: Anh có nhận tiền không?', `Đáp: Tôi có nhận ${tien} triệu đồng tiền công.`,
];

function makeDocx(name, lines) {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const body = lines.map((l) => `<w:p><w:r><w:t xml:space="preserve">${esc(l).replace(/\t/g, '</w:t><w:tab/><w:t xml:space="preserve">')}</w:t></w:r></w:p>`).join('');
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`,
  };
  const dir = mkdtempSync(join(tmpdir(), 'kho-'));
  writeFileSync(join(dir, 'f.json'), JSON.stringify(files));
  const out = join(dir, name);
  execFileSync('python3', ['-c', 'import json,sys,zipfile\nf=json.load(open(sys.argv[1]))\nz=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED)\n[z.writestr(k,v) for k,v in f.items()]\nz.close()', join(dir, 'f.json'), out]);
  return out;
}

async function uploadSamples(page) {
  await page.goto('/app.html#kho');
  await page.locator('[data-file]').setInputFiles([makeDocx('BBLK-lan-1.docx', BBLK('5', '50')), makeDocx('BBLK-lan-2.docx', BBLK('20', '80'))]);
  await expect(page.locator('.kho-item')).toHaveCount(2);
}

test.describe('Kho hồ sơ & Trợ lý AI', () => {
  test('tải lên Word và PDF, nhận diện loại tài liệu và người khai, tìm kiếm, xem nội dung, xóa', async ({ page, context }) => {
    const t = trackErrors(page);
    await freshApp(page);
    await uploadSamples(page);
    await expect(page.locator('.kho-item').first()).toContainText('Biên bản ghi lời khai');
    await expect(page.locator('.kho-item').first()).toContainText('Trần Thiên Hà');
    await expect(page.locator('.kho-item').first()).toContainText('3 lượt hỏi – đáp');
    // PDF có lớp chữ
    const pdfPage = await context.newPage();
    await pdfPage.setContent('<html><body style="font-family:serif"><h2>KẾT LUẬN GIÁM ĐỊNH</h2><p>Chữ ký đứng tên Trần Thiên Hà trên hợp đồng cầm cố là do cùng một người ký ra.</p></body></html>');
    const pdf = await pdfPage.pdf({ format: 'A4' });
    await pdfPage.close();
    await page.locator('[data-file]').setInputFiles({ name: 'KL-giam-dinh.pdf', mimeType: 'application/pdf', buffer: pdf });
    await expect(page.locator('.kho-item')).toHaveCount(3);
    await expect(page.locator('.kho-item', { hasText: 'KL-giam-dinh' })).toContainText('Kết luận giám định');
    // Tìm kiếm không dấu
    await page.fill('[data-q]', 'chu ky hop dong');
    await expect(page.locator('.kho-item').first()).toContainText('KL-giam-dinh');
    await expect(page.locator('.kho-snip').first()).toContainText('Chữ ký');
    await page.fill('[data-q]', '');
    await page.locator('.kho-item', { hasText: 'BBLK-lan-1' }).locator('[data-view]').click();
    await expect(page.locator('.modal .kho-text')).toContainText('Hỏi: Anh ký bao nhiêu hợp đồng');
    await page.locator('.modal [data-close]').first().click();
    await page.reload();
    await expect(page.locator('.kho-item')).toHaveCount(3);
    await page.locator('.kho-item', { hasText: 'KL-giam-dinh' }).locator('[data-del]').click();
    await page.locator('.modal [data-yes]').click();
    await expect(page.locator('.kho-item')).toHaveCount(2);
    t.assertClean();
  });

  test('ngoại tuyến: tạo biên bản lời khai mới từ BBLK cũ → mở biên bản có sẵn câu hỏi làm rõ mâu thuẫn', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page);
    await uploadSamples(page);
    await expect(page.locator('[data-mode]')).toHaveText('Ngoại tuyến');
    await page.fill('[data-input]', 'Tạo biên bản lời khai mới dựa vào các bblk cũ để làm rõ việc nhận tiền công');
    await page.keyboard.press('Enter');
    const bot = page.locator('.kho-msg.bot').last();
    await expect(bot).toContainText('ghi lời khai lần 3 — Trần Thiên Hà');
    await expect(bot).toContainText('Làm rõ điểm mâu thuẫn giữa các lần khai');
    await bot.locator('a', { hasText: 'Mở biên bản' }).click();
    await expect(page).toHaveURL(/#interview\//);
    await expect(page.locator('[data-who]')).toHaveText('Trần Thiên Hà');
    await expect(page.locator('.iv-qa.pending').first()).toContainText('tình trạng sức khỏe');
    await expect(page.locator('.iv-qa', { hasText: '50 triệu' }).first()).toBeVisible();
    await page.locator('[data-preview]').click();
    await expect(page.locator('.modal .vb-page')).toContainText('001071023745');
    t.assertClean();
  });

  test('ngoại tuyến: tạo văn bản theo mẫu từ yêu cầu → điền họ tên, nhân thân từ tài liệu', async ({ page }) => {
    await freshApp(page);
    await uploadSamples(page);
    await page.fill('[data-input]', 'Lập giấy triệu tập người làm chứng Trần Thiên Hà');
    await page.keyboard.press('Enter');
    const bot = page.locator('.kho-msg.bot').last();
    await expect(bot).toContainText('Giấy triệu tập người làm chứng');
    await bot.locator('a', { hasText: 'Mở văn bản' }).click();
    await expect(page).toHaveURL(/#forms\/doc\//);
    await expect(page.locator('[name="hoTen"]')).toHaveValue('Trần Thiên Hà');
    await expect(page.locator('[name="nhanThan"]')).toHaveValue(/001071023745/);
  });

  test('AI (giả lập): hỏi đáp có trích dẫn; lập biên bản theo kế hoạch AI', async ({ page }) => {
    const calls = await mockClaude(page, (body) => {
      const c = JSON.stringify(body.messages);
      if (c.includes('buổi lấy lời khai TIẾP THEO')) return '{"tomTat":"Hai lần khai số tiền khác nhau","vanDe":[{"tieuDe":"Số tiền công","canCu":"BBLK 05/10 và 20/10","cauHoi":["Anh nhận 50 hay 80 triệu đồng tiền công?"]}]}';
      return 'Anh Hà khai đã ký 08 hợp đồng cầm cố [1].';
    });
    await freshApp(page);
    await setApiKey(page, 'anthropic', 'sk-ant-test');
    await uploadSamples(page);
    await expect(page.locator('[data-mode]')).toContainText('AI');
    await page.fill('[data-input]', 'Anh Hà đã ký bao nhiêu hợp đồng cầm cố?');
    await page.keyboard.press('Enter');
    const bot = page.locator('.kho-msg.bot').last();
    await expect(bot).toContainText('08 hợp đồng cầm cố [1]');
    await expect(bot.locator('.kho-cites summary')).toContainText('Nguồn trích dẫn');
    expect(JSON.stringify(calls.at(-1).body.messages)).toContain('TÀI LIỆU TRÍCH DẪN');
    expect(JSON.stringify(calls.at(-1).body.messages)).toContain('BBLK-lan-');
    await page.fill('[data-input]', 'Tạo biên bản lời khai mới từ các bblk cũ');
    await page.keyboard.press('Enter');
    await expect(page.locator('.kho-msg.bot').last()).toContainText('Số tiền công');
    await page.locator('.kho-msg.bot').last().locator('a').click();
    await expect(page.locator('.iv-qa', { hasText: 'Anh nhận 50 hay 80 triệu đồng tiền công?' })).toHaveCount(1);
  });
});
