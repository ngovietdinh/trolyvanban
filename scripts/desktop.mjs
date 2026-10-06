// Chuẩn bị bản cài đặt máy tính: chép mã web vào desktop/web và đồng bộ số phiên bản.
// Dùng: node scripts/desktop.mjs   (sau đó: cd desktop && npm install && npm run dist:win | dist:mac)
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const out = `${root}desktop/web`;
const FILES = ['app.html', 'index.html', 'manifest.webmanifest', 'version.json', 'assets'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of FILES) {
  if (!existsSync(root + f)) throw new Error(`Thiếu ${f}`);
  cpSync(root + f, `${out}/${f}`, { recursive: true });
}

const { version } = JSON.parse(readFileSync(`${root}version.json`, 'utf8'));
const pkgPath = `${root}desktop/package.json`;
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
if (pkg.version !== version) {
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}
console.log(`Đã chuẩn bị desktop/web (v${version}).`);
