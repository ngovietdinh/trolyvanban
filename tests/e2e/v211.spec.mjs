import { test, expect } from '@playwright/test';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { trackErrors, freshApp, mockClaude, setApiKey } from './helpers.mjs';

const dir = mkdtempSync(join(tmpdir(), 'p2w-'));
const TRUTH_SNIPPETS = ['ỦY BAN NHÂN DÂN', 'HUYỆN ĐÔNG ANH', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc', 'KẾ HOẠCH', 'Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020', 'Thể thức văn bản hành chính', 'Nguyễn Văn An'];

/** Tạo PDF có lớp chữ và PDF ảnh quét (~200 dpi) từ văn bản mẫu. */
async function fixtures(browser) {
  const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 794, height: 1123 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4174/tests/fixtures/van-ban-mau.html');
  await page.waitForTimeout(500);
  writeFileSync(join(dir, 'van-ban.pdf'), await page.pdf({ format: 'A4', preferCSSPageSize: true }));
  await page.addStyleTag({ content: 'body{padding:76px 57px 76px 113px}' });
  const png = await page.screenshot();
  await page.setContent(`<style>@page{size:A4;margin:0}body{margin:0}img{width:210mm;height:297mm;display:block}</style><img src="data:image/png;base64,${png.toString('base64')}">`);
  writeFileSync(join(dir, 'ban-scan.pdf'), await page.pdf({ format: 'A4', printBackground: true }));
  // Văn bản gõ phông TCVN3 (.VnTime) — chữ trích ra bị “méo”.
  await page.setContent(`<style>@page{size:A4;margin:20mm 15mm 20mm 30mm}body{font:13pt Tinos,serif}</style><link rel="stylesheet" href="http://localhost:4174/assets/css/fonts.css"><p style="text-align:center"><b>Céng hßa x· héi chñ nghÜa ViÖt Nam</b></p><p style="text-align:center">§éc lËp - Tù do - H¹nh phóc</p><p>Biªn b¶n ghi lêi khai lËp t¹i trô së C¬ quan C¶nh s¸t ®iÒu tra, cã mÆt §¹i diÖn ViÖn kiÓm s¸t.</p>`);
  await page.waitForTimeout(400);
  writeFileSync(join(dir, 'phong-cu.pdf'), await page.pdf({ format: 'A4', preferCSSPageSize: true }));
  await ctx.close();
}

const convert = async (page, file) => {
  await page.locator('.pw [data-file]').setInputFiles(join(dir, file));
  await expect(page.locator('[data-go]')).toBeEnabled();
  await page.locator('[data-go]').click();
  await expect(page.locator('.pw-page').first()).toBeVisible({ timeout: 120000 });
};
const docxXml = async (page) => {
  const dl = page.waitForEvent('download');
  await page.locator('[data-dl]').click();
  const d = await dl;
  const p = await d.path();
  const { execFileSync } = await import('node:child_process');
  return execFileSync('python3', ['-c', 'import sys,zipfile;print(zipfile.ZipFile(sys.argv[1]).read("word/document.xml").decode())', p]).toString();
};

test.describe('PDF sang Word', () => {
  test.beforeAll(async ({ browser }) => fixtures(browser));

  test('PDF có lớp chữ: giữ nguyên chữ, dựng phần đầu 2 cột, tiêu đề, bảng có kẻ, chữ đậm/nghiêng; tải .docx', async ({ page }) => {
    const t = trackErrors(page);
    await freshApp(page, '#pdf');
    await convert(page, 'van-ban.pdf');
    await expect(page.locator('.pw-file .badge')).toHaveText('Có lớp chữ');
    const pv = page.locator('.pw-page');
    for (const s of TRUTH_SNIPPETS) await expect(pv).toContainText(s);
    await expect(pv.locator('table.pw-table.grid tr')).toHaveCount(4);
    await expect(pv.locator('table.pw-table:not(.grid)')).toHaveCount(2); // phần đầu văn bản + nơi nhận/chữ ký
    await expect(pv.locator('b', { hasText: 'KẾ HOẠCH' })).toHaveCount(1);
    await expect(pv.locator('i', { hasText: 'gửi danh sách về Văn phòng' })).toHaveCount(1);
    await expect(page.locator('.pw-res-head')).toContainText('1 trang giữ chữ gốc');
    const xml = await docxXml(page);
    expect((xml.match(/<w:tbl>/g) || []).length).toBe(3);
    expect(xml).toContain('Thể thức văn bản hành chính');
    expect(xml).toMatch(/<w:pgMar w:top="\d+" w:right="8\d\d" w:bottom="\d+" w:left="1[67]\d\d"/); // lề 15 mm / 30 mm
    t.assertClean();
  });

  test('PDF ảnh quét: nhận dạng chữ tiếng Việt trên máy, độ chính xác ≥ 98%, giữ bố cục bảng', async ({ page }) => {
    test.setTimeout(180000);
    const t = trackErrors(page);
    await freshApp(page, '#pdf');
    await convert(page, 'ban-scan.pdf');
    await expect(page.locator('.pw-file .badge')).toHaveText('Ảnh quét');
    await expect(page.locator('.pw-res-head')).toContainText('1 trang OCR');
    const got = (await page.locator('.pw-page').innerText()).replace(/\s+/g, ' ');
    let hit = 0;
    for (const s of TRUTH_SNIPPETS) if (got.includes(s)) hit++;
    expect(hit).toBeGreaterThanOrEqual(TRUTH_SNIPPETS.length - 1);
    await expect(page.locator('.pw-page table.pw-table.grid tr')).toHaveCount(4);
    // So từng ký tự với bản có lớp chữ.
    await page.locator('.pw [data-file]').setInputFiles(join(dir, 'van-ban.pdf'));
    await page.locator('[data-go]').click();
    await expect(page.locator('.pw-res-head')).toContainText('giữ chữ gốc');
    const ref = (await page.locator('.pw-page').innerText()).replace(/\s+/g, ' ');
    const acc = await page.evaluate(([a, b]) => import('/assets/js/lib/pdf-ai.js').then((m) => m.similarity(a, b)), [ref, got]);
    expect(acc).toBeGreaterThan(0.98);
    t.assertClean();
  });

  test('văn bản phông cũ TCVN3: tự chuyển sang Unicode', async ({ page }) => {
    await freshApp(page, '#pdf');
    await convert(page, 'phong-cu.pdf');
    const pv = page.locator('.pw-page');
    await expect(pv).toContainText('Cộng hòa xã hội chủ nghĩa Việt Nam');
    await expect(pv).toContainText('Biên bản ghi lời khai lập tại trụ sở Cơ quan Cảnh sát điều tra, có mặt Đại diện Viện kiểm sát.');
    await expect(pv).toContainText('Độc lập - Tự do - Hạnh phúc');
  });

  test('AI đọc ảnh và AI soát lỗi OCR (AI giả lập)', async ({ page }) => {
    test.setTimeout(180000);
    const calls = await mockClaude(page, (body) => {
      const c = body.messages[0].content;
      if (Array.isArray(c) && c.some((p) => p.type === 'image')) return JSON.stringify({ blocks: [{ t: 'cols', l: ['ỦY BAN NHÂN DÂN', '**HUYỆN ĐÔNG ANH**'], r: ['**CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**'] }, { t: 'p', a: 'center', x: '**KẾ HOẠCH**', s: 14 }, { t: 'table', rows: [['STT', 'Nội dung'], ['1', 'Thể thức văn bản hành chính']] }] });
      const lines = JSON.parse(String(c).slice(String(c).lastIndexOf('\n\n') + 2));
      return JSON.stringify({ lines: lines.map((l) => l.replace('PHAN', 'PHẦN').replace(/[PDĐ]I[AẠ] ĐIỂM/, 'ĐỊA ĐIỂM').replace(/Nguyen Van/, 'Nguyễn Văn')) });
    });
    await freshApp(page, '');
    await setApiKey(page, 'anthropic', 'sk-ant-test');
    await page.goto('/app.html#pdf');
    // AI soát lỗi OCR (bật mặc định khi có AI).
    await expect(page.locator('[data-opt="aiFix"]')).toBeChecked();
    await convert(page, 'ban-scan.pdf');
    await expect(page.locator('.pw-res-head')).toContainText('AI đã soát lỗi 1 trang');
    expect(calls.some((c) => /OCR/.test(c.body.system))).toBe(true);
    await expect(page.locator('.pw-page')).toContainText('ĐỊA ĐIỂM');
    // AI đọc ảnh.
    await page.locator('.pw-mode', { hasText: 'AI đọc ảnh' }).click();
    await page.locator('[data-go]').click();
    await expect(page.locator('.pw-res-head')).toContainText('1 trang AI đọc ảnh', { timeout: 60000 });
    const img = calls.find((c) => Array.isArray(c.body.messages[0].content));
    expect(img.body.messages[0].content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg' } });
    await expect(page.locator('.pw-page table.pw-table.grid tr')).toHaveCount(2);
    await expect(page.locator('.pw-page b', { hasText: 'KẾ HOẠCH' })).toHaveCount(1);
  });

  test('Kho hồ sơ: tải PDF ảnh quét → tự nhận dạng chữ để tìm kiếm, hỏi đáp', async ({ page }) => {
    test.setTimeout(180000);
    await freshApp(page, '#kho');
    await page.locator('.kho [data-file]').setInputFiles(join(dir, 'ban-scan.pdf'));
    await expect(page.locator('.kho-item')).toHaveCount(1, { timeout: 120000 });
    await page.fill('.kho [data-q]', 'Thể thức văn bản');
    await expect(page.locator('.kho-item')).toHaveCount(1);
    await page.locator('.kho-item [data-view]').click();
    await expect(page.locator('.modal')).toContainText('Thể thức văn bản hành chính');
    await expect(page.locator('.modal')).toContainText('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
  });
});
