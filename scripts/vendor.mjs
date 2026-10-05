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
console.log('Vendored fonts + Anthropic SDK.');
