// Danh sách tệp mã web kèm sha256 cho cập nhật tại chỗ của bản cài đặt (desktop/updater.cjs).
// GitHub Actions chạy khi phát hành: node scripts/web-manifest.mjs <commit> > web-manifest.json
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEB_FILES = ['app.html', 'index.html', 'manifest.webmanifest', 'version.json', 'assets'];

export function buildManifest(root, commit, shell) {
  const files = [];
  const walk = (p) => {
    const st = statSync(p);
    if (st.isDirectory()) return readdirSync(p).sort().forEach((n) => walk(join(p, n)));
    files.push({ p: relative(root, p).split(sep).join('/'), h: createHash('sha256').update(readFileSync(p)).digest('hex'), s: st.size });
  };
  WEB_FILES.forEach((f) => walk(join(root, f)));
  const { version, notes = [] } = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8'));
  const shellApi = shell ?? JSON.parse(readFileSync(join(root, 'desktop/package.json'), 'utf8')).shellApi ?? 1;
  return { version, notes, commit, shell: shellApi, files };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const commit = process.argv[2];
  if (!/^[0-9a-f]{7,40}$/.test(commit || '')) {
    console.error('Cách dùng: node scripts/web-manifest.mjs <commit sha>');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(buildManifest(fileURLToPath(new URL('..', import.meta.url)), commit)) + '\n');
}
