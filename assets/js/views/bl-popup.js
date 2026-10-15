// Hộp đọc nhanh bình luận một điều — mở khi bấm "Điều N" ở bất kỳ màn hình nào.
import { icon, escapeHtml } from '../ui.js';
import { currentBook } from '../legal/binh-luan-store.js';
import { articleHtml } from './bl-render.js';

export function openBlPopup(ctx, so) {
  const book = currentBook();
  const show = (key) => {
    const a = book?.articles.find((x) => x.so === String(key).toLowerCase());
    const i = a ? book.articles.indexOf(a) : -1;
    const prev = book?.articles[i - 1];
    const next = book?.articles[i + 1];
    return `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
      <div class="bl-modal-tabs">
        ${prev ? `<button class="btn btn-sm btn-ghost" type="button" data-bl-go="${escapeHtml(prev.so)}">${icon('chevron-left', 'ic-sm')}Điều ${escapeHtml(prev.so)}</button>` : ''}
        ${next ? `<button class="btn btn-sm btn-ghost" type="button" data-bl-go="${escapeHtml(next.so)}">Điều ${escapeHtml(next.so)}${icon('arrow-right', 'ic-sm')}</button>` : ''}
        <span class="spacer"></span>
        ${a ? `<a class="btn btn-sm" href="#binh-luan/${encodeURIComponent(a.so)}" data-bl-open>${icon('book', 'ic-sm')}Mở trong mục Bình luận</a>` : ''}
      </div>
      <div class="bl-modal-body" tabindex="0">${a ? articleHtml(book, a) : `<p class="note warn">${icon('alert', 'ic-sm')}<span>Sách Bình luận không có Điều ${escapeHtml(key)}.</span></p>`}</div>`;
  };
  if (!book) {
    return ctx.modal(
      `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
      <h2 class="modal-title">Chưa nạp sách Bình luận</h2>
      <p>Để đọc bình luận Điều ${escapeHtml(so)}, vào mục <strong>Bình luận BLHS</strong> và nạp tệp sách (một lần cho máy này).</p>
      <div class="modal-actions"><button class="btn" type="button" data-close>Đóng</button><a class="btn btn-primary" href="#binh-luan" data-bl-open>${icon('book', 'ic-sm')}Đến mục Bình luận BLHS</a></div>`,
      { label: 'Chưa nạp sách Bình luận', onMount: (box, close) => box.querySelector('[data-bl-open]').addEventListener('click', close) },
    );
  }
  ctx.modal(show(so), {
    className: 'modal-wide bl-modal',
    label: `Bình luận Điều ${so} Bộ luật Hình sự`,
    onMount(box, close) {
      const wire = () => {
        box.querySelectorAll('[data-bl-go]').forEach((b) =>
          b.addEventListener('click', () => {
            box.innerHTML = show(b.dataset.blGo);
            box.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', close));
            wire();
          }),
        );
        box.querySelector('[data-bl-open]')?.addEventListener('click', close);
        box.querySelector('.bl-modal-body')?.focus({ preventScroll: true });
      };
      // Bấm "Điều N" trong nội dung hộp → chuyển sang điều đó ngay trong hộp.
      box.addEventListener('bl-go', (e) => {
        box.innerHTML = show(e.detail);
        box.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', close));
        wire();
      });
      // Chú thích và liên kết điều khác bên trong hộp.
      box.addEventListener('click', (e) => {
        const fn = e.target.closest('[data-fn]');
        if (fn) {
          e.preventDefault();
          box.querySelector(`#${CSS.escape(fn.getAttribute('href').slice(1))}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      });
      wire();
    },
  });
}
