// Phát hành phiên bản mới: node scripts/release.mjs 2.1.0 "Ghi chú 1" "Ghi chú 2"
// Cập nhật đồng bộ version.json, sw.js, assets/js/version.js.
import { readFileSync, writeFileSync } from 'node:fs';

const [version, ...notes] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('Cách dùng: npm run release -- <x.y.z> "ghi chú"…');
  process.exit(1);
}
const root = new URL('..', import.meta.url).pathname;
const today = new Date().toISOString().slice(0, 10);
writeFileSync(`${root}version.json`, JSON.stringify({ version, date: today, notes }, null, 2) + '\n');
for (const [file, re, rep] of [
  ['sw.js', /const VERSION = '[^']+';/, `const VERSION = '${version}';`],
  ['assets/js/version.js', /APP_VERSION = '[^']+';/, `APP_VERSION = '${version}';`],
]) {
  const p = root + file;
  writeFileSync(p, readFileSync(p, 'utf8').replace(re, rep));
}
// Bản cài đặt máy tính dùng chung số phiên bản.
const deskPkg = `${root}desktop/package.json`;
const pkg = JSON.parse(readFileSync(deskPkg, 'utf8'));
pkg.version = version;
writeFileSync(deskPkg, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Đã cập nhật phiên bản ${version}.`);
