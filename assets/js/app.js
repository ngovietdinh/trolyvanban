// Ứng dụng chính: khung giao diện, điều hướng theo hash, tài khoản, bảng lệnh.
import { $, $$, icon, toast, bindThemeToggles, escapeHtml } from './ui.js';
import { store, docsRepo } from './lib/store.js';
import { PROVIDERS, setAIHooks } from './lib/ai.js';
import { accounts, vault, systemConfig } from './lib/accounts.js';
import { initUpdates } from './update.js';
import { DOC_TYPES } from './lib/doc-types.js';
import { ALL_CRIMES } from './legal/engine.js';

import * as dashboard from './views/dashboard.js';
import * as compose from './views/compose.js';
import * as chat from './views/chat.js';
import * as spell from './views/spell.js';
import * as summary from './views/summary.js';
import * as number from './views/number.js';
import * as templates from './views/templates.js';
import * as tpl from './views/tpl.js';
import * as forms from './views/forms.js';
import * as kho from './views/kho.js';
import * as docs from './views/docs.js';
import * as settings from './views/settings.js';
import * as legal from './views/legal.js';
import * as interview from './views/interview.js';
import * as cases from './views/cases.js';
import * as admin from './views/admin.js';
import { casesRepo } from './legal/repo.js';

// perm: quyền cần có để mở màn hình.
const ROUTES = {
  dashboard: { mod: dashboard, title: 'Tổng quan' },
  compose: { mod: compose, title: 'Soạn văn bản', perm: 'docs' },
  legal: { mod: legal, title: 'Cây hỏi đáp pháp luật', perm: 'legal' },
  interview: { mod: interview, title: 'Ghi lời khai', perm: 'legal' },
  cases: { mod: cases, title: 'Hồ sơ vụ án', perm: 'legal' },
  forms: { mod: forms, title: 'Biểu mẫu tố tụng', perm: 'legal' },
  kho: { mod: kho, title: 'Kho hồ sơ & Trợ lý AI', perm: 'legal' },
  chat: { mod: chat, title: 'Trợ lý AI', perm: 'docs' },
  spell: { mod: spell, title: 'Kiểm tra chính tả', perm: 'tools' },
  summary: { mod: summary, title: 'Tóm tắt văn bản', perm: 'tools' },
  number: { mod: number, title: 'Số thành chữ', perm: 'tools' },
  templates: { mod: templates, title: 'Thư viện mẫu', perm: 'docs' },
  tpl: { mod: tpl, title: 'Mẫu từ file Word', perm: 'docs' },
  docs: { mod: docs, title: 'Tài liệu của tôi', perm: 'docs' },
  admin: { mod: admin, title: 'Quản trị tài khoản', perm: 'users' },
  settings: { mod: settings, title: 'Cài đặt' },
};

let view = $('#view');
let cleanup = null;
let currentRoute = null;
let aiCache = { providers: {} }; // Kho API key đã giải mã của tài khoản hiện tại (chỉ trong bộ nhớ).

/* ---------- Độ tin cậy AI: dự phòng nhà cung cấp, ghi nhớ kết quả, nhật ký ---------- */
const AI_CACHE_MAX = 300;
function aiLog(entry) {
  store.set('ai-log', [{ at: Date.now(), ...entry }, ...store.get('ai-log', [])].slice(0, 60));
}
setAIHooks({
  chain() {
    const order = Object.keys(PROVIDERS);
    return order.filter((p) => aiCache.providers?.[p]?.key).map((p) => ({ provider: p, apiKey: aiCache.providers[p].key, model: aiCache.providers[p].model || PROVIDERS[p].defaultModel, label: PROVIDERS[p].label }));
  },
  options() {
    const st = ctx.settings();
    return { fallback: st.aiFallback !== false, cache: st.aiCache !== false };
  },
  cacheGet(key) {
    return store.get('ai-cache', {})[key] || null;
  },
  cacheSet(key, value) {
    const all = store.get('ai-cache', {});
    all[key] = value;
    const keys = Object.keys(all);
    if (keys.length > AI_CACHE_MAX) keys.sort((a, b) => all[a].at - all[b].at).slice(0, keys.length - AI_CACHE_MAX).forEach((k) => delete all[k]);
    store.set('ai-cache', all);
  },
  event(e) {
    const name = (p) => PROVIDERS[p]?.label || p;
    if (e.type === 'error') aiLog({ type: 'error', provider: e.provider, message: e.message });
    if (e.type === 'retry') {
      aiLog({ type: 'retry', provider: e.provider, message: e.message });
      toast(`${name(e.provider)}: ${e.message}…`, { type: 'info', timeout: 3500 });
    }
    if (e.type === 'switch' && e.from === e.to) {
      aiLog({ type: 'switch', provider: e.to, message: `Đổi mô hình: ${e.message}` });
      toast(`${name(e.to)}: ${e.message}`, { type: 'info', timeout: 5000 });
    } else if (e.type === 'switch') {
      aiLog({ type: 'switch', provider: e.to, message: `${name(e.from)} lỗi → chuyển sang ${name(e.to)}` });
      toast(`${name(e.from)} lỗi (${e.message}) — tự chuyển sang ${name(e.to)}`, { type: 'info', timeout: 6000 });
    }
  },
});

/* ---------- Context chia sẻ cho các màn hình ---------- */
export const ctx = {
  view,
  settings() {
    return { ...store.get('settings', {}) };
  },
  saveSettings(patch) {
    const next = { ...this.settings(), ...patch };
    store.set('settings', next);
    refreshChrome();
    return next;
  },
  /**
   * Cấu hình AI đang dùng: { provider, apiKey, model, label } hoặc null nếu chưa có key / không có quyền.
   * scope = 'legal' yêu cầu quyền “AI trực tuyến trong Tố tụng” (mặc định tắt).
   */
  ai(scope = 'docs') {
    const user = accounts.current();
    if (!user || !user.permSet.has(scope === 'legal' ? 'legal.ai' : 'ai')) return null;
    const configured = Object.keys(PROVIDERS).filter((p) => aiCache.providers?.[p]?.key);
    const pref = this.settings().aiProvider;
    const provider = configured.includes(pref) ? pref : configured[0];
    if (!provider) return null;
    const cfg = aiCache.providers[provider];
    return { provider, apiKey: cfg.key, model: cfg.model || PROVIDERS[provider].defaultModel, label: PROVIDERS[provider].label };
  },
  hasAI(scope) {
    return !!this.ai(scope);
  },
  aiProviders: () => aiCache.providers || {},
  async saveAiProviders(providers) {
    aiCache = { ...aiCache, providers };
    await vault.write(aiCache);
    refreshChrome();
  },
  user: () => accounts.current(),
  can: (perm) => accounts.can(perm),
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
  if (!accounts.current()) return showGate();
  let { name, params } = parseHash();
  if (name === 'login' || name === 'register') {
    name = currentRoute || 'dashboard';
    history.replaceState(null, '', `#${name}`);
    if (currentRoute) return;
  }
  let r = ROUTES[name] || ROUTES.dashboard;
  if (!ROUTES[name]) name = 'dashboard';
  const denied = r.perm && !accounts.can(r.perm);
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
    const active = a.dataset.nav === name || (name === 'tpl' && a.dataset.nav === 'templates');
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  closeSidebar();
  refreshChrome();
  if (denied) {
    view.innerHTML = `<div class="page"><div class="empty"><div class="empty-icon">${icon('lock', 'ic-lg')}</div><h3>Bạn chưa được cấp quyền truy cập</h3><p>Chức năng “${escapeHtml(r.title)}” cần được quản trị viên cấp quyền cho tài khoản của bạn.</p><a class="btn btn-primary" href="#dashboard">${icon('home')}Về Tổng quan</a></div></div>`;
    return;
  }
  try {
    cleanup = r.mod.render(ctx, params) || null;
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="page"><div class="empty"><div class="empty-icon">${icon('alert')}</div><h3>Đã xảy ra lỗi</h3><p>${escapeHtml(err.message)}</p></div></div>`;
  }
}

/* ---------- Chrome: sidebar, user menu, AI status ---------- */
function refreshChrome() {
  const user = accounts.current();
  if (!user) return;
  $('[data-docs-count]').textContent = docsRepo.list().length;
  $('[data-cases-count]').textContent = casesRepo.list().length;
  // Ẩn mục điều hướng không có quyền.
  $$('[data-nav]').forEach((a) => {
    const r = ROUTES[a.dataset.nav];
    a.hidden = !!(r?.perm && !user.permSet.has(r.perm));
  });
  $$('[data-perm-section]').forEach((el) => (el.hidden = !user.permSet.has(el.dataset.permSection)));
  $$('[data-need-perm]').forEach((el) => (el.hidden = !user.permSet.has(el.dataset.needPerm)));
  const st = $('[data-ai-status]');
  const ai = ctx.ai();
  st.classList.toggle('on', !!ai);
  st.querySelector('strong').textContent = ai ? `AI ${ai.label} đã bật` : user.permSet.has('ai') ? 'Chế độ cơ bản' : 'AI trực tuyến bị tắt';
  st.querySelector('small').textContent = ai ? ai.model : user.permSet.has('ai') ? 'Thêm API key để bật AI' : 'Chưa được cấp quyền';
  renderUserMenu();
}

function renderUserMenu() {
  const host = $('[data-user-menu]');
  const user = accounts.current();
  if (!user) return;
  const initials = user.name
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  host.innerHTML = `
    <button class="avatar-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Tài khoản ${escapeHtml(user.name)}"><span class="avatar">${escapeHtml(initials)}</span></button>
    <div class="dropdown" role="menu" hidden>
      <div class="dropdown-head"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small><span class="badge badge-accent role-badge" data-role-badge>${escapeHtml(user.roleLabel)}</span></div>
      ${user.permSet.has('docs') ? `<a href="#docs" role="menuitem">${icon('folder')}Tài liệu của tôi</a>` : ''}
      ${user.permSet.has('users') ? `<a href="#admin" role="menuitem">${icon('shield')}Quản trị tài khoản</a>` : ''}
      <a href="#settings" role="menuitem">${icon('settings')}Cài đặt</a>
      <button type="button" role="menuitem" data-change-pw>${icon('key')}Đổi mật khẩu</button>
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
    accounts.logout();
    aiCache = { providers: {} };
    toast('Đã đăng xuất');
    showGate();
  });
  host.querySelector('[data-change-pw]').addEventListener('click', changePasswordDialog);
}

function changePasswordDialog() {
  modal(
    `<h2 class="modal-title">Đổi mật khẩu</h2>
     <p class="hint" style="margin-bottom:12px">API key đã lưu sẽ được mã hóa lại bằng mật khẩu mới.</p>
     <form class="auth-form" data-f novalidate>
       <div class="field"><label for="cp-old">Mật khẩu hiện tại</label><input class="input" type="password" id="cp-old" name="old" autocomplete="current-password" /></div>
       <div class="field"><label for="cp-new">Mật khẩu mới</label><input class="input" type="password" id="cp-new" name="pw" autocomplete="new-password" /><span class="hint">Tối thiểu 8 ký tự</span></div>
       <div class="auth-err" role="alert" hidden></div>
       <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit">Đổi mật khẩu</button></div>
     </form>`,
    {
      label: 'Đổi mật khẩu',
      onMount(box, close) {
        box.querySelector('[data-f]').addEventListener('submit', async (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.target));
          const err = box.querySelector('.auth-err');
          try {
            await accounts.changePassword(f.old, f.pw);
            close();
            toast('Đã đổi mật khẩu');
          } catch (ex) {
            err.textContent = ex.message;
            err.hidden = false;
          }
        });
      },
    },
  );
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

/* ---------- Màn hình đăng nhập bắt buộc ---------- */
const shell = $('.shell');
let gateEl = null;

function gateHtml(mode) {
  const first = !accounts.hasUsers();
  const signup = systemConfig().allowSignup || !accounts.superExists();
  if (mode === 'register' && !signup) mode = 'login';
  if (first) mode = 'register';
  const isLogin = mode === 'login';
  const title = isLogin ? 'Đăng nhập' : first ? 'Tạo tài khoản đầu tiên' : 'Tạo tài khoản';
  const sub = isLogin
    ? 'Dữ liệu và API key của mỗi tài khoản được lưu, mã hóa riêng trên máy này.'
    : 'Tài khoản mới có quyền Người dùng. Quản trị viên đăng nhập trên máy này để cấp thêm quyền (Tố tụng, AI…).';
  return `
    <div class="gate-card">
      <div class="auth-head">
        <span class="logo-mark">VB</span>
        <h2>${title}</h2>
        <p>${sub}</p>
      </div>
      <form class="auth-form" data-gate-form="${mode}" novalidate>
        ${isLogin ? '' : `<div class="field"><label for="g-name">Họ và tên</label><input class="input" id="g-name" name="name" autocomplete="name" /></div>`}
        <div class="field"><label for="g-email">Email</label><input class="input" id="g-email" name="email" type="email" autocomplete="email" /></div>
        <div class="field"><label for="g-pass">Mật khẩu</label><input class="input" id="g-pass" name="password" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" />${isLogin ? '' : '<span class="hint">Tối thiểu 8 ký tự. Không có cách khôi phục mật khẩu — hãy ghi nhớ cẩn thận.</span>'}</div>
        <div class="auth-err" role="alert" hidden></div>
        <button class="btn btn-primary btn-lg" type="submit">${isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
      </form>
      <p class="auth-switch">
        ${isLogin && signup ? `Chưa có tài khoản? <button type="button" data-gate-mode="register">Đăng ký</button>` : ''}
        ${isLogin && !signup ? 'Liên hệ quản trị viên để được cấp tài khoản.' : ''}
        ${!isLogin && !first ? `Đã có tài khoản? <button type="button" data-gate-mode="login">Đăng nhập</button>` : ''}
      </p>
      <p class="gate-foot">${icon('lock', 'ic-sm')}Chạy cục bộ trên máy · <a href="index.html">Về trang giới thiệu</a></p>
    </div>`;
}

function showGate(mode = 'login') {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  currentRoute = null;
  shell.hidden = true;
  document.title = 'Đăng nhập — Trợ Lý Văn Bản AI';
  if (!gateEl) {
    gateEl = document.createElement('main');
    gateEl.className = 'gate';
    document.body.append(gateEl);
  }
  gateEl.hidden = false;
  gateEl.innerHTML = gateHtml(mode);
  const form = $('[data-gate-form]', gateEl);
  ($('input:not([readonly])', form) || form.querySelector('input'))?.focus();
  gateEl.querySelectorAll('[data-gate-mode]').forEach((b) => b.addEventListener('click', () => showGate(b.dataset.gateMode)));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const err = $('.auth-err', form);
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      const user = form.dataset.gateForm === 'login' ? await accounts.login(data) : await accounts.register(data);
      await enterApp();
      toast(`Xin chào, ${user.name}!`);
      const pending = accounts.can('users') ? accounts.pendingCount() : 0;
      if (pending) toast(`Có ${pending} tài khoản mới đang chờ cấp quyền — vào Quản trị tài khoản để phân quyền`, { type: 'info', timeout: 6000 });
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

async function enterApp() {
  aiCache = await vault.read();
  if (gateEl) gateEl.hidden = true;
  shell.hidden = false;
  refreshChrome();
  if (/^#(login|register)$/.test(location.hash)) history.replaceState(null, '', '#dashboard');
  route();
}

function openAuth() {
  showGate('login');
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
  const can = (p) => accounts.can(p);
  const nav = Object.entries(ROUTES)
    .filter(([, r]) => !r.perm || can(r.perm))
    .map(([k, r]) => ({ group: 'Điều hướng', label: r.title, icon: { dashboard: 'home', compose: 'file', legal: 'layers', interview: 'message', cases: 'folder', forms: 'file', kho: 'sparkles', chat: 'sparkles', spell: 'spell', summary: 'book', number: 'hash', templates: 'layers', docs: 'folder', admin: 'shield', settings: 'settings' }[k], run: () => ctx.navigate(`#${k}`) }));
  const crimes = (can('legal') ? ALL_CRIMES : []).map((c) => ({ group: 'Tội danh — cây hỏi đáp', label: `Điều ${c.dieu}. ${c.ten}`, icon: 'gavel', run: () => ctx.navigate(`#legal/${c.dieu}`) }));
  const types = (can('docs') ? DOC_TYPES : []).map((t) => ({ group: 'Soạn mới', label: `Soạn ${t.name.toLowerCase()}`, icon: t.icon, hint: t.abbr, run: () => ctx.navigate(`#compose/${t.id}`) }));
  const recent = (can('docs') ? docsRepo.list() : [])
    .slice(0, 8)
    .map((d) => ({ group: 'Tài liệu', label: d.title, icon: 'file', run: () => ctx.navigate(`#compose/doc/${d.id}`) }));
  const actions = [
    { group: 'Thao tác', label: 'Chuyển giao diện sáng/tối', icon: 'moon', run: () => $('[data-theme-toggle]').click() },
    { group: 'Thao tác', label: 'Đăng xuất', icon: 'logout', run: () => $('[data-logout]')?.click() },
  ];
  return [...nav, ...types, ...crimes, ...recent, ...actions];
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
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && accounts.current()) {
    e.preventDefault();
    if (palette.hidden) openPalette();
    else closePalette();
  }
});

/* ---------- Khởi động ---------- */
bindThemeToggles();
window.addEventListener('hashchange', route);
window.addEventListener('storage', () => accounts.current() && refreshChrome());
document.addEventListener('docs-changed', refreshChrome);
initUpdates();
if (accounts.current()) enterApp();
else showGate(/^#register/.test(location.hash) ? 'register' : 'login');
