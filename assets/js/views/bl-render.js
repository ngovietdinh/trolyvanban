// Hiển thị một điều của sách Bình luận BLHS: nguyên văn điều luật + phần Bình luận + chú thích.
// Chỉ định dạng để dễ đọc (đoạn, thụt lề khoản / điểm / gạch đầu dòng) — KHÔNG sửa, thêm, bớt chữ nào.
import { escapeHtml } from '../ui.js';

// Bỏ dấu từng ký tự, giữ nguyên độ dài chuỗi → tìm không dấu và tô sáng đúng vị trí trong bản gốc.
const foldChar = (c) => (c === 'đ' || c === 'Đ' ? 'd' : c.normalize('NFD')[0].toLowerCase());
const foldKeep = (s) => [...s].map(foldChar).join('');

/** Tô sáng mọi chỗ khớp (không dấu) trong một dòng đã cắt theo ký tự; trả HTML đã thoát. */
function highlight(line, q) {
  if (!q) return escapeHtml(line);
  const chars = [...line];
  const folded = chars.map(foldChar).join('');
  const fq = foldKeep(q);
  let out = '';
  let i = 0;
  let at = folded.indexOf(fq);
  while (at >= 0 && fq) {
    out += escapeHtml(chars.slice(i, at).join('')) + `<mark>${escapeHtml(chars.slice(at, at + fq.length).join(''))}</mark>`;
    i = at + fq.length;
    at = folded.indexOf(fq, i);
  }
  return out + escapeHtml(chars.slice(i).join(''));
}

function lineHtml(raw, { so, q, kind }) {
  const html = highlight(raw, q).replace(/\{\{fn:(\d+)\}\}/g, (_, n) => `<sup class="bl-fn"><a href="#bl-fn-${so}-${n}" data-fn="${n}" aria-label="Chú thích ${n}">${n}</a></sup>`);
  const t = raw.trim();
  let cls = '';
  if (kind === 'vb') {
    if (/^\d{1,2}\.\s/.test(t)) cls = 'k';
    else if (/^[a-zđ]\)\s/.test(t)) cls = 'd';
  } else if (/^[-+•–]\s/.test(t)) cls = 'li';
  else if (/^[a-zđ][).]\s/.test(t)) cls = 'd';
  else if (/^\d{1,2}(\.\d{1,2})*\.\s/.test(t)) cls = 'num';
  else if (t.length < 140 && /:$/.test(t)) cls = 'lead';
  return `<p${cls ? ` class="${cls}"` : ''}>${html || '&nbsp;'}</p>`;
}

/** HTML một điều. q: từ khóa cần tô sáng (tùy chọn). */
export function articleHtml(book, a, { q = '' } = {}) {
  const crumbs = [a.phan, a.chuong, a.muc].filter(Boolean);
  const notes = [...new Set(a.fn)];
  return `<article class="bl-article" data-bl-article="${escapeHtml(a.so)}">
    ${crumbs.length ? `<p class="bl-crumbs">${crumbs.map((c) => `<span>${escapeHtml(c)}</span>`).join('<span aria-hidden="true">›</span>')}</p>` : ''}
    <h2 class="bl-title" data-no-law-link>${highlight(a.head.trim(), q)}</h2>
    ${a.vb.length ? `<section class="bl-vb" aria-label="Nội dung điều luật"><h3>Nội dung điều luật</h3>${a.vb.map((l) => lineHtml(l, { so: a.so, q, kind: 'vb' })).join('')}</section>` : ''}
    ${
      a.blHead != null
        ? `<section class="bl-bl" aria-label="Bình luận"><h3>${escapeHtml(a.blHead.trim())}</h3>${a.bl.map((l) => lineHtml(l, { so: a.so, q, kind: 'bl' })).join('')}</section>`
        : '<p class="bl-none">Sách không có phần bình luận cho điều này.</p>'
    }
    ${notes.length ? `<section class="bl-notes" aria-label="Chú thích"><h3>Chú thích</h3><ol>${notes.map((n) => `<li id="bl-fn-${a.so}-${n}" value="${n}">${escapeHtml(book.notes?.[n - 1] ?? '')}</li>`).join('')}</ol></section>` : ''}
  </article>`;
}
