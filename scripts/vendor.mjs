// Đóng gói tài nguyên bên thứ ba vào assets/ để website chạy độc lập, không phụ thuộc CDN.
// Chạy: npm run vendor
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const root = new URL('..', import.meta.url).pathname;
const fontsDir = join(root, 'assets/fonts');
rmSync(fontsDir, { recursive: true, force: true });
mkdirSync(fontsDir, { recursive: true });

const families = {
  'be-vietnam-pro': ['300', '400', '500', '600', '700', '800'],
  newsreader: ['400', '500', '600', '400-italic', '500-italic'],
  tinos: ['400', '700', '400-italic', '700-italic'],
};
const SUBSETS = /(vietnamese|latin-ext|latin)-\d/;

let css = '/* Tự động sinh bởi scripts/vendor.mjs — không sửa tay */\n';
for (const [pkg, weights] of Object.entries(families)) {
  const base = join(root, 'node_modules/@fontsource', pkg);
  for (const w of weights) {
    const src = readFileSync(join(base, `${w}.css`), 'utf8');
    for (const block of src.split(/(?=\/\* )/)) {
      if (!SUBSETS.test(block)) continue;
      const files = [...block.matchAll(/url\(\.\/files\/([^)]+\.woff2)\)/g)].map((m) => m[1]);
      files.forEach((f) => copyFileSync(join(base, 'files', f), join(fontsDir, f)));
      css += block
        .replace(/, url\(\.\/files\/[^)]+\.woff\) format\('woff'\)/g, '')
        .replace(/url\(\.\/files\//g, 'url(../fonts/');
    }
  }
}
writeFileSync(join(root, 'assets/css/fonts.css'), css);

await build({
  stdin: { contents: "export { default } from '@anthropic-ai/sdk';", resolveDir: root },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  minify: true,
  outfile: join(root, 'assets/vendor/anthropic-sdk.mjs'),
  legalComments: 'eof',
});
// pdf.js — đọc chữ từ tệp PDF ngay trên trình duyệt (Kho hồ sơ).
const pdfDir = join(root, 'assets/vendor/pdfjs');
mkdirSync(pdfDir, { recursive: true });
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) copyFileSync(join(root, 'node_modules/pdfjs-dist/legacy/build', f), join(pdfDir, f));
copyFileSync(join(root, 'node_modules/pdfjs-dist/LICENSE'), join(pdfDir, 'LICENSE'));
// tesseract.js — nhận dạng chữ (OCR) tiếng Việt cho PDF ảnh quét, ảnh chụp văn bản (PDF sang Word, Kho hồ sơ).
const ocrDir = join(root, 'assets/vendor/tesseract');
rmSync(ocrDir, { recursive: true, force: true });
mkdirSync(join(ocrDir, 'core'), { recursive: true });
mkdirSync(join(ocrDir, 'lang'), { recursive: true });
for (const f of ['tesseract.esm.min.js', 'worker.min.js']) copyFileSync(join(root, 'node_modules/tesseract.js/dist', f), join(ocrDir, f));
copyFileSync(join(root, 'node_modules/tesseract.js/LICENSE.md'), join(ocrDir, 'LICENSE.md'));
for (const f of ['tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js']) copyFileSync(join(root, 'node_modules/tesseract.js-core', f), join(ocrDir, 'core', f));
for (const l of ['vie', 'eng']) copyFileSync(join(root, `node_modules/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`), join(ocrDir, 'lang', `${l}.traineddata.gz`));
console.log('Vendored fonts + Anthropic SDK + pdf.js + tesseract.js.');
