// Ứng dụng chính: khung giao diện, điều hướng theo hash, tài khoản, bảng lệnh.
import { $, $$, icon, toast, bindThemeToggles, escapeHtml } from './ui.js';
import { store, auth, docsRepo } from './lib/store.js';
import { DEFAULT_MODEL } from './lib/ai.js';
import { DOC_TYPES } from './lib/doc-types.js';

import * as dashboard from './views/dashboard.js';
import * as compose from './views/compose.js';
import * as chat from './views/chat.js';
import * as spell from './views/spell.js';
import * as summary from './views/summary.js';
import * as number from './views/number.js';
import * as templates from './views/templates.js';
import * as docs from './views/docs.js';
import * as settings from './views/settings.js';

const ROUTES = {
  dashboard: { mod: dashboard, title: 'Tổng quan' },
  compose: { mod: compose, title: 'Soạn văn bản' },
  chat: { mod: chat, title: 'Trợ lý AI' },
  spell: { mod: spell, title: 'Kiểm tra chính tả' },
  summary: { mod: summary, title: 'Tóm tắt văn bản' },
  number: { mod: number, title: 'Số thành chữ' },
  templates: { mod: templates, title: 'Thư viện mẫu' },
  docs: { mod: docs, title: 'Tài liệu của tôi' },
  settings: { mod: settings, title: 'Cài đặt' },
};

let view = $('#view');
let cleanup = null;
let currentRoute = null;

/* ---------- Context chia sẻ cho các màn hình ---------- */
export const ctx = {
  view,
  settings() {
    return { apiKey: '', model: DEFAULT_MODEL, ...store.get('settings', {}) };
  },
  saveSettings(patch) {
    const next = { ...this.settings(), ...patch };
    store.set('settings', next);
    refreshChrome();
    return next;
  },
  hasAI() {
    return !!this.settings().apiKey;
  },
  user: () => auth.current(),
  navigate(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  },
  handoff: null, // Dữ liệu chuyển giữa các màn hình (vd: bản nháp từ Trợ lý sang Soạn thảo).
  refreshChrome: () => refreshChrome(),
  modal,
  confirm,
  openAuth,
};

/* ---------- Router ---------- */
function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [name, ...rest] = raw.split('/');
  return { name: name || 'dashboard', params: rest };
}

function route() {
  let { name, params } = parseHash();
  if (name === 'login' || name === 'register') {
    openAuth(name);
    name = currentRoute || 'dashboard';
    history.replaceState(null, '', `#${name}`);
    if (currentRoute) return;
  }
  const r = ROUTES[name] || ROUTES.dashboard;
  if (!ROUTES[name]) name = 'dashboard';
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  currentRoute = name;
  // Thay vùng hiển thị bằng nút mới để loại bỏ mọi listener của màn hình trước.
  const fresh = view.cloneNode(false);
  view.replaceWith(fresh);
  view = ctx.view = fresh;
  document.title = `${r.title} — Trợ Lý Văn Bản AI`;
  $('[data-view-title]').textContent = r.title;
  $$('[data-nav]').forEach((a) => {
    const active = a.dataset.nav === name;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  closeSidebar();
  try {
    cleanup = r.mod.render(ctx, params) || null;
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="page"><div class="empty"><div class="empty-icon">${icon('alert')}</div><h3>Đã xảy ra lỗi</h3><p>${escapeHtml(err.message)}</p></div></div>`;
  }
}

/* ---------- Chrome: sidebar, user menu, AI status ---------- */
function refreshChrome() {
  $('[data-docs-count]').textContent = docsRepo.list().length;
  const st = $('[data-ai-status]');
  const on = ctx.hasAI();
  st.classList.toggle('on', on);
  st.querySelector('strong').textContent = on ? 'AI Claude đã bật' : 'Chế độ cơ bản';
  st.querySelector('small').textContent = on ? ctx.settings().model : 'Thêm API key để bật AI';
  renderUserMenu();
}

function renderUserMenu() {
  const host = $('[data-user-menu]');
  const user = auth.current();
  if (!user) {
    host.innerHTML = `<button class="btn btn-sm" type="button" data-login>${icon('user', 'ic-sm')}<span>Đăng nhập</span></button>`;
    host.querySelector('[data-login]').addEventListener('click', () => openAuth('login'));
    return;
  }
  const initials = user.name
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  host.innerHTML = `
    <button class="avatar-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Tài khoản ${escapeHtml(user.name)}"><span class="avatar">${escapeHtml(initials)}</span></button>
    <div class="dropdown" role="menu" hidden>
      <div class="dropdown-head"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></div>
      <a href="#docs" role="menuitem">${icon('folder')}Tài liệu của tôi</a>
      <a href="#settings" role="menuitem">${icon('settings')}Cài đặt</a>
      <button type="button" role="menuitem" data-logout>${icon('logout')}Đăng xuất</button>
    </div>`;
  const btn = host.querySelector('.avatar-btn');
  const dd = host.querySelector('.dropdown');
  const close = () => {
    dd.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dd.hidden = !dd.hidden;
    btn.setAttribute('aria-expanded', String(!dd.hidden));
  });
  document.addEventListener('click', (e) => {
    if (!host.contains(e.target)) close();
  });
  dd.addEventListener('click', (e) => {
    if (e.target.closest('a,button')) close();
  });
  host.querySelector('[data-logout]').addEventListener('click', () => {
    auth.logout();
    refreshChrome();
    toast('Đã đăng xuất');
  });
}

const sidebar = $('#sidebar');
function closeSidebar() {
  sidebar.classList.remove('open');
}
$('[data-sidebar-open]').addEventListener('click', () => sidebar.classList.add('open'));
$$('[data-sidebar-close]').forEach((el) => el.addEventListener('click', closeSidebar));
$('[data-ai-status]').addEventListener('click', () => ctx.navigate('#settings'));

/* ---------- Modal ---------- */
function modal(html, { onMount, className = '', label = 'Hộp thoại' } = {}) {
  const prevFocus = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal ${className}" role="dialog" aria-modal="true" aria-label="${escapeHtml(label)}">${html}</div>`;
  document.body.append(backdrop);
  const box = backdrop.firstElementChild;
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    prevFocus?.focus?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', box).filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f.at(-1).focus();
      } else if (!e.shiftKey && document.activeElement === f.at(-1)) {
        e.preventDefault();
        f[0].focus();
      }
    }
  };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close();
  });
  $$('[data-close]', box).forEach((b) => b.addEventListener('click', close));
  onMount?.(box, close);
  setTimeout(() => ($('[autofocus]', box) || $('input, textarea, button:not(.modal-close)', box))?.focus(), 30);
  return { close, box };
}

function confirm(message, { title = 'Xác nhận', okText = 'Đồng ý', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(
      `<h2 class="modal-title">${escapeHtml(title)}</h2><p class="muted" style="color:var(--text-2)">${escapeHtml(message)}</p>
       <div class="modal-actions"><button class="btn" type="button" data-no>Hủy</button><button class="btn ${danger ? 'btn-primary' : 'btn-dark'}" type="button" data-yes>${escapeHtml(okText)}</button></div>`,
      {
        label: title,
        onMount(box, close) {
          box.querySelector('[data-no]').addEventListener('click', () => {
            done = true;
            close();
            resolve(false);
          });
          box.querySelector('[data-yes]').addEventListener('click', () => {
            done = true;
            close();
            resolve(true);
          });
        },
      },
    );
    const obs = new MutationObserver(() => {
      if (!document.body.contains(m.box)) {
        obs.disconnect();
        if (!done) resolve(false);
      }
    });
    obs.observe(document.body, { childList: true });
  });
}

/* ---------- Đăng nhập / Đăng ký ---------- */
function openAuth(mode = 'login') {
  if ($('.auth-modal')) return;
  const isLogin = mode === 'login';
  modal(
    `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
    <div class="auth-head">
      <span class="logo-mark">VB</span>
      <h2>${isLogin ? 'Chào mừng trở lại' : 'Tạo tài khoản'}</h2>
      <p>${isLogin ? 'Đăng nhập để đồng bộ tên người soạn và tài liệu.' : 'Miễn phí — chỉ mất 20 giây.'}</p>
    </div>
    <form class="auth-form" novalidate>
      ${isLogin ? '' : `<div class="field"><label for="a-name">Họ và tên</label><input class="input" id="a-name" name="name" autocomplete="name" autofocus /></div>`}
      <div class="field"><label for="a-email">Email</label><input class="input" id="a-email" name="email" type="email" autocomplete="email" ${isLogin ? 'autofocus' : ''} /></div>
      <div class="field"><label for="a-pass">Mật khẩu</label><input class="input" id="a-pass" name="password" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" />${isLogin ? '' : '<span class="hint">Tối thiểu 8 ký tự</span>'}</div>
      <div class="auth-err" role="alert" hidden></div>
      <button class="btn btn-primary btn-lg" type="submit">${isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
    </form>
    <p class="auth-switch">${isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'} <button type="button" data-switch>${isLogin ? 'Đăng ký miễn phí' : 'Đăng nhập'}</button></p>`,
    {
      label: isLogin ? 'Đăng nhập' : 'Đăng ký',
      className: 'auth-modal',
      onMount(box, close) {
        const form = box.querySelector('form');
        const err = box.querySelector('.auth-err');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(form));
          const btn = form.querySelector('[type="submit"]');
          btn.disabled = true;
          try {
            const user = isLogin ? await auth.login(data) : await auth.register(data);
            close();
            refreshChrome();
            toast(`Xin chào, ${user.name}!`);
            if (currentRoute === 'dashboard') route();
          } catch (ex) {
            err.textContent = ex.message;
            err.hidden = false;
          } finally {
            btn.disabled = false;
          }
        });
        box.querySelector('[data-switch]').addEventListener('click', () => {
          close();
          openAuth(isLogin ? 'register' : 'login');
        });
      },
    },
  );
}

/* ---------- Bảng lệnh (Ctrl + K) ---------- */
const palette = $('[data-palette]');
const pInput = $('[data-palette-input]');
const pList = $('[data-palette-list]');
let pItems = [];
let pIndex = 0;

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();

function paletteCommands() {
  const nav = Object.entries(ROUTES).map(([k, r]) => ({ group: 'Điều hướng', label: r.title, icon: { dashboard: 'home', compose: 'file', chat: 'sparkles', spell: 'spell', summary: 'book', number: 'hash', templates: 'layers', docs: 'folder', settings: 'settings' }[k], run: () => ctx.navigate(`#${k}`) }));
  const types = DOC_TYPES.map((t) => ({ group: 'Soạn mới', label: `Soạn ${t.name.toLowerCase()}`, icon: t.icon, hint: t.abbr, run: () => ctx.navigate(`#compose/${t.id}`) }));
  const recent = docsRepo
    .list()
    .slice(0, 8)
    .map((d) => ({ group: 'Tài liệu', label: d.title, icon: 'file', run: () => ctx.navigate(`#compose/doc/${d.id}`) }));
  const actions = [
    { group: 'Thao tác', label: 'Chuyển giao diện sáng/tối', icon: 'moon', run: () => $('[data-theme-toggle]').click() },
    auth.current() ? { group: 'Thao tác', label: 'Đăng xuất', icon: 'logout', run: () => $('[data-logout]')?.click() } : { group: 'Thao tác', label: 'Đăng nhập', icon: 'user', run: () => openAuth('login') },
  ];
  return [...nav, ...types, ...recent, ...actions];
}

function renderPalette() {
  const q = norm(pInput.value.trim());
  pItems = paletteCommands().filter((c) => !q || norm(c.label + ' ' + c.group).includes(q));
  pIndex = Math.min(pIndex, Math.max(0, pItems.length - 1));
  if (!pItems.length) {
    pList.innerHTML = `<li class="palette-empty">Không tìm thấy kết quả phù hợp</li>`;
    return;
  }
  let html = '';
  let group = '';
  pItems.forEach((c, i) => {
    if (c.group !== group) {
      group = c.group;
      html += `<li class="palette-group" role="presentation">${escapeHtml(group)}</li>`;
    }
    html += `<li class="palette-item" role="option" id="pi-${i}" data-i="${i}" aria-selected="${i === pIndex}">${icon(c.icon || 'arrow-right')}<span>${escapeHtml(c.label)}</span>${c.hint ? `<small>${escapeHtml(c.hint)}</small>` : ''}</li>`;
  });
  pList.innerHTML = html;
  pInput.setAttribute('aria-activedescendant', `pi-${pIndex}`);
  $(`#pi-${pIndex}`)?.scrollIntoView({ block: 'nearest' });
}

function openPalette() {
  palette.hidden = false;
  pInput.value = '';
  pIndex = 0;
  renderPalette();
  pInput.focus();
}
function closePalette() {
  palette.hidden = true;
}
function runPalette(i) {
  const c = pItems[i];
  if (!c) return;
  closePalette();
  c.run();
}
$('[data-palette-open]').addEventListener('click', openPalette);
pInput.addEventListener('input', () => {
  pIndex = 0;
  renderPalette();
});
pInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    pIndex = (pIndex + 1) % Math.max(1, pItems.length);
    renderPalette();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    pIndex = (pIndex - 1 + pItems.length) % Math.max(1, pItems.length);
    renderPalette();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    runPalette(pIndex);
  } else if (e.key === 'Escape') closePalette();
});
pList.addEventListener('click', (e) => {
  const li = e.target.closest('[data-i]');
  if (li) runPalette(+li.dataset.i);
});
palette.addEventListener('mousedown', (e) => {
  if (e.target === palette) closePalette();
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (palette.hidden) openPalette();
    else closePalette();
  }
});

/* ---------- Khởi động ---------- */
bindThemeToggles();
window.addEventListener('hashchange', route);
window.addEventListener('storage', refreshChrome);
document.addEventListener('docs-changed', refreshChrome);
refreshChrome();
route();
