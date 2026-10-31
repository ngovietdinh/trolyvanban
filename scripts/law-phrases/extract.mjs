#!/usr/bin/env node
// Sinh assets/js/legal/law-phrases-generated.js từ nguyên văn Bộ luật Hình sự.
// Cách chạy: node scripts/law-phrases/extract.mjs <articles.json>
//   articles.json: [{ so, ten, vb: [dòng nguyên văn điều luật] }] hoặc [{ so, ten, text }] (vd. xuất từ Cài đặt Bộ luật).
// Chỉ dùng phần nguyên văn điều luật (văn bản pháp luật công khai); không dùng và không ghi nội dung bình luận.
import { readFileSync, writeFileSync } from 'node:fs';
import { extractLawPhrases } from '../../assets/js/legal/law-phrases.js';

const src = process.argv[2];
if (!src) {
  console.error('Thiếu tệp articles.json');
  process.exit(1);
}
const raw = JSON.parse(readFileSync(src, 'utf8'));
const articles = (Array.isArray(raw) ? raw : raw.articles || []).map((a) => ({ so: String(a.so ?? a.dieu), ten: a.ten || '', vb: a.vb, text: a.text })).filter((a) => /^\d+[a-z]?$/.test(a.so) && parseInt(a.so, 10) >= 108); // chỉ Phần thứ hai "Các tội phạm" (Điều 108 trở đi)
const P = extractLawPhrases(articles);
const n = Object.keys(P).length;
const total = Object.values(P).reduce((s, l) => s + l.length, 0);
const body = Object.entries(P)
  .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10) || a[0].localeCompare(b[0]))
  .map(([so, list]) => `  '${so}': ${JSON.stringify(list).replace(/","/g, '", "').replace(/\],\[/g, '], [')},`)
  .join('\n');
writeFileSync(
  new URL('../../assets/js/legal/law-phrases-generated.js', import.meta.url),
  `// SINH TỰ ĐỘNG bởi scripts/law-phrases/extract.mjs từ nguyên văn Bộ luật Hình sự (khoản 1 + tên điều) — không sửa tay.\n// Mỗi điều: [[cụm định tội, trọng số 1–3, tự đủ (1) hay cần thêm cụm khác (0)]]. ${n} điều, ${total} cụm.\nexport const LAW_PHRASES = {\n${body}\n};\n`,
);
console.log(`Đã sinh cụm cho ${n} điều, ${total} cụm.`);
