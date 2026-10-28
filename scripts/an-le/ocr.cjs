// OCR các án lệ dạng ảnh quét bằng tesseract.js (tiếng Việt), ảnh trang tách bằng pdftoppm.
const { createWorker } = require('/home/user/trolyvanban/node_modules/tesseract.js');
const { execSync } = require('child_process');
const fs = require('fs');
const list = JSON.parse(fs.readFileSync('ocr-list.json', 'utf8'));
(async () => {
  const worker = await createWorker('vie', 1, { langPath: '/home/user/trolyvanban/node_modules/@tesseract.js-data/vie/4.0.0', gzip: true, cachePath: 'ocr' });
  for (const d of list) {
    if (fs.existsSync(`txt/${d}.txt`) && fs.statSync(`txt/${d}.txt`).size > 800) continue;
    execSync(`rm -f ocr/${d}-*.png; pdftoppm -r 220 -png raw/pdf/${d}.bin ocr/${d}`);
    const pages = fs.readdirSync('ocr').filter((f) => f.startsWith(d + '-') && f.endsWith('.png')).sort();
    let out = '';
    for (const p of pages) {
      const t0 = Date.now();
      const { data } = await worker.recognize(`ocr/${p}`);
      out += data.text + '\n\n';
      console.log(d, p, data.text.length, 'chars', Math.round((Date.now() - t0) / 1000) + 's');
    }
    fs.writeFileSync(`txt/${d}.txt`, out);
  }
  await worker.terminate();
  console.log('OCR done');
})().catch((e) => { console.error('ERR', e); process.exit(1); });
