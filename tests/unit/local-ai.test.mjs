import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLocalBase, isPrivateEndpoint, setLocalEndpoint, PROVIDERS, LOCAL_PRESETS } from '../../assets/js/lib/ai.js';

test('địa chỉ AI trên máy: chuẩn hóa', () => {
  assert.equal(normalizeLocalBase('localhost:11434'), 'http://localhost:11434/v1');
  assert.equal(normalizeLocalBase('http://192.168.1.5:1234/v1/'), 'http://192.168.1.5:1234/v1');
  assert.equal(normalizeLocalBase(' https://ai.noibo.local/ '), 'https://ai.noibo.local/v1');
  assert.equal(normalizeLocalBase(''), '');
  setLocalEndpoint('');
  assert.equal(PROVIDERS.local.base, LOCAL_PRESETS[0].base);
  setLocalEndpoint('127.0.0.1:8080');
  assert.equal(PROVIDERS.local.base, 'http://127.0.0.1:8080/v1');
});

test('địa chỉ AI trên máy: nhận biết máy này / mạng nội bộ', () => {
  for (const u of ['http://localhost:11434', 'http://127.0.0.1:1234/v1', 'http://[::1]:8080', 'http://10.0.0.7:11434', 'http://172.20.1.2:11434', 'http://192.168.1.20:11434', 'http://may-chu.local:11434', 'http://169.254.1.1']) assert.ok(isPrivateEndpoint(u), u);
  for (const u of ['https://api.openai.com/v1', 'http://8.8.8.8:11434', 'http://172.32.0.1', 'https://ai.example.com/v1', 'http://192.169.1.1', 'not a url ::']) assert.ok(!isPrivateEndpoint(u), u);
});

test('cập nhật tại chỗ: phiên bản vỏ ứng dụng khớp giữa updater.cjs và desktop/package.json; danh sách tệp đủ mã web', async () => {
  const { readFileSync } = await import('node:fs');
  const { buildManifest } = await import('../../scripts/web-manifest.mjs');
  const root = new URL('../..', import.meta.url).pathname;
  const api = +readFileSync(`${root}desktop/updater.cjs`, 'utf8').match(/const SHELL_API = (\d+)/)[1];
  assert.equal(api, JSON.parse(readFileSync(`${root}desktop/package.json`, 'utf8')).shellApi);
  const m = buildManifest(root, 'abc1234');
  assert.equal(m.shell, api);
  const paths = m.files.map((f) => f.p);
  for (const p of ['app.html', 'version.json', 'assets/js/app.js', 'assets/js/version.js']) assert.ok(paths.includes(p), p);
  assert.ok(m.files.every((f) => /^[0-9a-f]{64}$/.test(f.h) && !f.p.includes('\\')));
});
