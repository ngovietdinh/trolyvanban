#!/usr/bin/env node
// Dựng gói biểu mẫu chính thức (TT 128/2025/TT-BCA) từ thư mục các tệp Word (.docx).
//   node scripts/build-mau-pack.mjs <thư-mục-docx> <gói-đầu-ra.zip>
// Thư mục cần có tệp “Danh mục …” và các mẫu đặt tên “27. Quyết định khởi tố vụ án hình sự.docx”.
// Gói là dữ liệu riêng của người dùng: KHÔNG commit lên kho mã nguồn công khai. Nạp gói trong ứng dụng:
// Biểu mẫu tố tụng → “Nạp gói mẫu chính thức”. Tệp .doc cần đổi sang .docx trước (Word hoặc LibreOffice).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPack } from '../assets/js/legal/mau-pack.js';

const [dir, out] = process.argv.slice(2);
if (!dir || !out) {
  console.error('Cách dùng: node scripts/build-mau-pack.mjs <thư-mục-docx> <gói-đầu-ra.zip>');
  process.exit(1);
}
const files = readdirSync(dir)
  .filter((f) => /\.docx$/i.test(f) && !f.startsWith('~$'))
  .map((name) => ({ name, data: new Uint8Array(readFileSync(join(dir, name))) }));
const { bytes, report, missing } = await buildPack(files);
writeFileSync(out, bytes);
const weak = report.filter((r) => !r.frame && r.fields < 4);
console.log(`Đã dựng ${report.length} mẫu → ${out} (${(bytes.length / 1048576).toFixed(1)} MB)`);
console.log(`Trường điền nhận diện: ${report.reduce((t, r) => t + r.fields, 0)} (${report.reduce((t, r) => t + r.slots, 0)} chỗ điền); mẫu dạng khung: ${report.filter((r) => r.frame).length}`);
if (missing.length) console.log(`Có trong danh mục nhưng thiếu tệp (${missing.length}): ${missing.map((m) => m.so).join(', ')}`);
if (weak.length) console.log(`Mẫu ít chỗ điền (<4), nên kiểm tra: ${weak.map((r) => r.so).join(', ')}`);
writeFileSync(`${out}.report.json`, JSON.stringify(report, null, 1));
