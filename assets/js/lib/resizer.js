// Kéo để đổi kích thước vùng làm việc (thanh menu, khung điểm cần làm rõ, khung vẽ sơ đồ…): chuột / cảm ứng / bàn phím,
// bấm đúp để về mặc định, ghi nhớ trên máy (localStorage, không lỗi khi bị chặn).
const read = (key) => {
  try {
    const v = parseFloat(localStorage.getItem(key));
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
};
const write = (key, v) => {
  try {
    if (v == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(Math.round(v)));
  } catch {}
};

/**
 * handle: phần tử để kéo. axis 'x' | 'y'; dir 1 = kéo sang phải / xuống thì tăng, -1 = ngược lại.
 * apply(value | null): áp kích thước (null = mặc định); current(): kích thước hiện tại (px) khi bắt đầu kéo.
 * Trả về { destroy, set }.
 */
export function makeResizable(handle, { axis = 'x', dir = 1, min = 200, max = 600, step = 16, key = '', apply, current }) {
  const clamp = (v) => Math.max(min, Math.min(typeof max === 'function' ? max() : max, v));
  const set = (v, save = true) => {
    const val = v == null ? null : clamp(v);
    apply(val);
    if (save && key) write(key, val);
    handle.setAttribute('aria-valuenow', String(Math.round(val ?? current())));
  };
  const saved = key ? read(key) : null;
  if (saved != null) set(saved, false);
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', axis === 'x' ? 'vertical' : 'horizontal');
  handle.tabIndex = 0;
  handle.setAttribute('aria-valuemin', String(min));
  let start = null;
  const down = (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    start = { p: axis === 'x' ? e.clientX : e.clientY, v: current() };
    handle.setPointerCapture?.(e.pointerId);
    handle.classList.add('dragging');
    document.body.classList.add('is-resizing');
    document.body.classList.toggle('is-resizing-y', axis === 'y');
  };
  const move = (e) => {
    if (!start) return;
    set(start.v + dir * ((axis === 'x' ? e.clientX : e.clientY) - start.p), false);
  };
  const up = () => {
    if (!start) return;
    start = null;
    handle.classList.remove('dragging');
    document.body.classList.remove('is-resizing', 'is-resizing-y');
    if (key) write(key, current());
  };
  const keydown = (e) => {
    const k = axis === 'x' ? { ArrowLeft: -1, ArrowRight: 1 }[e.key] : { ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (k) {
      e.preventDefault();
      set(current() + dir * k * step * (e.shiftKey ? 4 : 1));
    } else if (e.key === 'Home' || e.key === 'Escape') set(null);
  };
  const dbl = () => set(null);
  handle.addEventListener('pointerdown', down);
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', up);
  handle.addEventListener('keydown', keydown);
  handle.addEventListener('dblclick', dbl);
  return {
    set,
    destroy() {
      handle.removeEventListener('pointerdown', down);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      handle.removeEventListener('keydown', keydown);
      handle.removeEventListener('dblclick', dbl);
      document.body.classList.remove('is-resizing', 'is-resizing-y');
    },
  };
}
