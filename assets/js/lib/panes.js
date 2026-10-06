// Màn hình nhiều cột trên điện thoại: thêm thanh thẻ phía trên và chỉ hiện một cột tại một thời điểm.
// Trên màn hình rộng thanh thẻ ẩn và mọi cột hiện như bình thường (xem .pane-tabs, .mp-hide trong app.css).
import { icon, escapeHtml } from '../ui.js';

/**
 * @param {HTMLElement} host  Khung lưới chứa các cột.
 * @param {{id: string, el: HTMLElement, label: string, icon?: string}[]} panes
 * @param {{initial?: string, onChange?: (id: string) => void}} opts
 */
export function mobilePanes(host, panes, { initial, onChange } = {}) {
  const bar = document.createElement('div');
  bar.className = 'pane-tabs';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Chuyển vùng hiển thị');
  bar.innerHTML = panes
    .map((p) => `<button type="button" role="tab" data-mp-tab="${p.id}">${p.icon ? icon(p.icon, 'ic-sm') : ''}<span data-mp-label>${escapeHtml(p.label)}</span><em class="pane-badge" data-mp-badge hidden></em></button>`)
    .join('');
  host.prepend(bar);
  host.classList.add('has-panes');
  let current = null;
  const show = (id) => {
    if (!panes.some((p) => p.id === id)) id = panes[0].id;
    if (id === current) return;
    current = id;
    for (const p of panes) {
      const on = p.id === id;
      p.el.classList.toggle('mp-hide', !on);
      const b = bar.querySelector(`[data-mp-tab="${p.id}"]`);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    onChange?.(id);
  };
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mp-tab]');
    if (!b) return;
    show(b.dataset.mpTab);
    // Trên điện thoại cuộn cột mới về đầu để người dùng thấy ngay nội dung.
    const p = panes.find((x) => x.id === b.dataset.mpTab);
    if (p && isNarrow()) p.el.scrollTop = 0;
  });
  bar.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = panes.findIndex((p) => p.id === current);
    const next = panes[(i + (e.key === 'ArrowRight' ? 1 : panes.length - 1)) % panes.length];
    show(next.id);
    bar.querySelector(`[data-mp-tab="${next.id}"]`).focus();
  });
  show(initial || panes[0].id);
  return {
    show,
    /** Chỉ chuyển cột khi đang ở màn hình hẹp (tránh nhảy cột vô ích trên máy tính). */
    go(id) {
      if (isNarrow()) show(id);
    },
    get current() {
      return current;
    },
    label(id, text) {
      const el = bar.querySelector(`[data-mp-tab="${id}"] [data-mp-label]`);
      if (el) el.textContent = text;
    },
    badge(id, n) {
      const el = bar.querySelector(`[data-mp-tab="${id}"] [data-mp-badge]`);
      if (!el) return;
      el.hidden = !n;
      el.textContent = n > 99 ? '99+' : String(n || '');
    },
  };
}

export const isNarrow = () => window.matchMedia('(max-width: 980px)').matches;
