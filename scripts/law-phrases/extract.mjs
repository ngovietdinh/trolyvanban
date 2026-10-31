#!/usr/bin/env node
// Sinh assets/js/legal/law-phrases-generated.js từ nguyên văn Bộ luật Hình sự.
// Cách chạy: node scripts/law-phrases/extract.mjs <articles.json> [an-le.json] [book.json]
//   book.json (tùy chọn, tệp sách Bình luận khoa học BLHS trên máy người dùng — KHÔNG commit): chỉ rút cụm động từ + đối tượng
//   2–6 âm tiết từ phần mô tả hành vi, gắn nhãn 'bl', trọng số 2, không tự đủ. Không ghi câu chữ của sách vào gói.
//   an-le.json (mặc định assets/data/an-le.json): kho án lệ để đo cụm nào là ngôn ngữ chung của hồ sơ (có ở ≥ 20% án lệ) → không tự đủ làm căn cứ.
//   articles.json: [{ so, ten, vb: [dòng nguyên văn điều luật] }] hoặc [{ so, ten, text }] (vd. xuất từ Cài đặt Bộ luật).
// Chỉ dùng phần nguyên văn điều luật (văn bản pháp luật công khai); không dùng và không ghi nội dung bình luận.
import { readFileSync, writeFileSync } from 'node:fs';
import { extractLawPhrases, commentaryPhrases } from '../../assets/js/legal/law-phrases.js';

const src = process.argv[2];
if (!src) {
  console.error('Thiếu tệp articles.json');
  process.exit(1);
}
const raw = JSON.parse(readFileSync(src, 'utf8'));
const articles = (Array.isArray(raw) ? raw : raw.articles || []).map((a) => ({ so: String(a.so ?? a.dieu), ten: a.ten || '', vb: a.vb, text: a.text })).filter((a) => /^\d+[a-z]?$/.test(a.so) && parseInt(a.so, 10) >= 108); // chỉ Phần thứ hai "Các tội phạm" (Điều 108 trở đi)
const corpusPath = process.argv[3] || new URL('../../assets/data/an-le.json', import.meta.url);
let corpus = [];
try {
  const al = JSON.parse(readFileSync(corpusPath, 'utf8'));
  corpus = (Array.isArray(al) ? al : Object.values(al)).map((x) => x.text || '').filter((t) => t.length > 500);
} catch {}
let bigrams = null;
try {
  bigrams = JSON.parse(readFileSync(new URL('../../assets/data/vi-lm.json', import.meta.url), 'utf8')).b; // tần suất cặp âm tiết trong văn bản pháp lý
} catch {}
const P = extractLawPhrases(articles, { corpus, bigrams });
console.log(`Kho đối chiếu: ${corpus.length} văn bản.`);
let nBl = 0;
if (process.argv[4]) {
  const book = JSON.parse(readFileSync(process.argv[4], 'utf8'));
  const arts = (Array.isArray(book) ? book : book.articles || []).filter((a) => /^\d+[a-z]?$/.test(String(a.so)) && parseInt(a.so, 10) >= 108 && Array.isArray(a.bl));
  const BL = commentaryPhrases(arts, { existing: P, corpus, bigrams });
  for (const [so, list] of Object.entries(BL)) {
    if (!P[so]) continue; // chỉ bổ sung cho điều đã có cụm từ Bộ luật
    P[so] = [...P[so], ...list];
    nBl += list.length;
  }
  console.log(`Cụm bổ sung từ bình luận: ${nBl} (cho ${Object.keys(BL).length} điều).`);
}
const n = Object.keys(P).length;
const total = Object.values(P).reduce((s, l) => s + l.length, 0);
const body = Object.entries(P)
  .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10) || a[0].localeCompare(b[0]))
  .map(([so, list]) => `  '${so}': ${JSON.stringify(list).replace(/","/g, '", "').replace(/\],\[/g, '], [')},`)
  .join('\n');
writeFileSync(
  new URL('../../assets/js/legal/law-phrases-generated.js', import.meta.url),
  `// SINH TỰ ĐỘNG bởi scripts/law-phrases/extract.mjs từ nguyên văn Bộ luật Hình sự (khoản 1 + tên điều) — không sửa tay.\n// Mỗi điều: [[cụm định tội, trọng số 1–3, tự đủ (1) hay cần thêm cụm khác (0), nguồn 'bl' nếu là cụm hành vi rút từ phần mô tả\n// hành vi của Bình luận khoa học BLHS (chỉ cụm từ 2–6 âm tiết, không có câu chữ của sách)]]. ${n} điều, ${total} cụm${nBl ? ` (trong đó ${nBl} cụm từ bình luận)` : ''}.\nexport const LAW_PHRASES = {\n${body}\n};\n`,
);
console.log(`Đã sinh cụm cho ${n} điều, ${total} cụm.`);
