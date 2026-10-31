#!/usr/bin/env node
// Sinh assets/data/vi-lm.json — mô hình ngôn ngữ âm tiết tiếng Việt (văn bản pháp lý) để sửa lỗi OCR:
//   { n: tổng số âm tiết, u: { âm tiết: số lần }, b: { "trước sau": số lần } }
// Nguồn: toàn văn 90 án lệ (assets/data/an-le.json) + nguyên văn điều luật (articles.json, nếu có) + chữ của phần mềm.
// Chỉ ghi bảng thống kê, không ghi văn bản. Cách chạy: node scripts/ocr-lm/build.mjs [articles.json] [nguồn-âm-tiết.json]
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const texts = [];
const anLe = JSON.parse(readFileSync(new URL('assets/data/an-le.json', root), 'utf8'));
// Bỏ án lệ chỉ có bản quét (chữ do OCR, có lỗi) để từ điển không nhiễm lỗi ("chêt", "só").
for (const a of anLe) if (!a.ocr) texts.push(a.text, a.ten, a.khaiQuat || '', a.tinhHuong || '', a.giaiPhap || '');
if (process.argv[2]) {
  const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  for (const a of Array.isArray(raw) ? raw : raw.articles || []) texts.push(a.ten || '', ...(Array.isArray(a.vb) ? a.vb : [a.text || '']));
}
const syl = texts
  .join('\n')
  .normalize('NFC')
  .toLocaleLowerCase('vi-VN')
  .replace(/[^\p{L}\s]/gu, ' ')
  .split(/\s+/)
  .filter((w) => w && w.length <= 7);
const u = new Map();
const b = new Map();
for (let i = 0; i < syl.length; i++) {
  u.set(syl[i], (u.get(syl[i]) || 0) + 1);
  if (i) {
    const k = `${syl[i - 1]} ${syl[i]}`;
    b.set(k, (b.get(k) || 0) + 1);
  }
}
const U = Object.fromEntries([...u].filter(([, c]) => c >= 3));
const B = Object.fromEntries([...b].filter(([k, c]) => c >= 2 && k.split(' ').every((w) => U[w])));
// Tập âm tiết HỢP LỆ rộng hơn (chỉ là danh sách âm tiết, không phải văn bản): lấy từ tệp thứ hai nếu có (mọi chữ của một
// nguồn tiếng Việt lớn, vd. sách đã tách) + từ điển trên. Chữ hợp lệ không bị coi là lỗi OCR dù hiếm trong văn bản pháp lý.
const validSet = new Set(Object.keys(U));
if (process.argv[3]) {
  const raw = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  const all = [];
  for (const a of Array.isArray(raw) ? raw : raw.articles || []) for (const k of Object.keys(a)) if (Array.isArray(a[k])) all.push(...a[k].map(String));
  const cnt = new Map();
  for (const w of all.join('\n').normalize('NFC').toLocaleLowerCase('vi-VN').replace(/[^\p{L}\s]/gu, ' ').split(/\s+/)) if (w && w.length <= 7) cnt.set(w, (cnt.get(w) || 0) + 1);
  for (const [w, c] of cnt) if (c >= 2 && /^[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+$/u.test(w)) validSet.add(w);
}
const out = { n: syl.length, u: U, b: B, v: [...validSet].filter((w) => !U[w]).join(' ') };
writeFileSync(new URL('assets/data/vi-lm.json', root), JSON.stringify(out));
console.log(`vi-lm.json: ${syl.length} âm tiết, ${Object.keys(U).length} từ điển, ${Object.keys(B).length} cặp, ${validSet.size} âm tiết hợp lệ, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
