// Chuẩn bị bản cài đặt máy tính: chép mã web vào desktop/web và đồng bộ số phiên bản.
// Dùng: node scripts/desktop.mjs   (sau đó: cd desktop && npm install && npm run dist:win | dist:mac)
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WEB_FILES as FILES } from './web-manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}desktop/web`;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of FILES) {
  if (!existsSync(root + f)) throw new Error(`Thiếu ${f}`);
  cpSync(root + f, `${out}/${f}`, { recursive: true });
}

// Bản cài "bảo mật" (TLVB_SECURE=1): chế độ bảo mật luôn bật ở cả mã web lẫn vỏ ứng dụng.
const SECURE = process.env.TLVB_SECURE === '1';
if (SECURE) writeFileSync(`${out}/assets/js/security-build.js`, readFileSync(`${out}/assets/js/security-build.js`, 'utf8').replace('SECURE_BUILD = false', 'SECURE_BUILD = true'));
writeFileSync(`${root}desktop/security-forced.json`, JSON.stringify({ on: SECURE }) + '\n');

const { version } = JSON.parse(readFileSync(`${root}version.json`, 'utf8'));
const pkgPath = `${root}desktop/package.json`;
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
if (pkg.version !== version) {
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}
console.log(`Đã chuẩn bị desktop/web (v${version})${SECURE ? ' — BẢN BẢO MẬT (chế độ bảo mật luôn bật)' : ''}.`);
