// Ứng dụng chính: khung giao diện, điều hướng theo hash, tài khoản, bảng lệnh.
import { $, $$, icon, toast, bindThemeToggles, escapeHtml, need, needAttr } from './ui.js';
import { store, docsRepo, getEnv, sessionStore } from './lib/store.js';
import { isPhone, viewMode, PHONE_QUERY } from './lib/phone.js';
import { PROVIDERS, setAIHooks, setLocalEndpoint, isPrivateEndpoint, isOffline, normalizeLocalBase } from './lib/ai.js';
import { accounts, vault, systemConfig, audit } from './lib/accounts.js';
import { applyNetworkGuard, secureOn, securityPolicy, aiEndpointAllowed, setSecurityBlockHook } from './lib/security.js';
import { initUpdates } from './update.js';
import { desktop, isDesktop } from './lib/platform.js';
import { openDownloadApp } from './download-app.js';
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
import * as help from './views/help.js';
import * as pdf from './views/pdf.js';
import * as tracking from './views/tracking.js';
import * as caseMap from './views/case-map.js';
import * as statements from './views/statements.js';
import * as security from './views/security.js';
import * as binhLuan from './views/binh-luan.js';
import * as traCuu from './views/tra-cuu.js';
import * as toaAn from './views/toa-an.js';
import * as coQuan from './views/co-quan.js';
import { AGENCIES, currentAgency, setAgency, agencyInfo, routeBelongsElsewhere } from './lib/agency.js';
import { openBlPopup } from './views/bl-popup.js';
import { loadBook, onBookChange } from './legal/binh-luan-store.js';
import { startLawLinks, stopLawLinks } from './lib/law-links.js';
import { makeResizable } from './lib/resizer.js';
import { openFeatureCatalog } from './features.js';
import { guideForRoute, visibleGuides, findGuide } from './guide/guides.js';
import { guideBodyHtml, bindGuide, isSeen } from './guide/render.js';
import { casesRepo } from './legal/repo.js';

// perm: quyền cần có để mở màn hình.
const ROUTES = {
  dashboard: { mod: dashboard, title: 'Tổng quan' },
  'tra-cuu': { mod: traCuu, title: 'Tra cứu' },
  compose: { mod: compose, title: 'Soạn văn bản', perm: 'docs' },
  legal: { mod: legal, title: 'Cây hỏi đáp pháp luật', perm: 'legal' },
  interview: { mod: interview, title: 'Ghi lời khai', perm: 'legal' },
  cases: { mod: cases, title: 'Hồ sơ vụ án', perm: 'legal' },
  'theo-doi': { mod: tracking, title: 'Theo dõi & báo cáo', perm: 'legal' },
  'loi-khai': { mod: statements, title: 'Phân tích lời khai', perm: 'legal' },
  'so-do': { mod: caseMap, title: 'Sơ đồ vụ việc', perm: 'legal' },
  forms: { mod: forms, title: 'Biểu mẫu tố tụng', perm: 'legal' },
  'binh-luan': { mod: binhLuan, title: 'Bình luận Bộ luật Hình sự', perm: 'legal' },
  'toa-an': { mod: toaAn, title: 'Tòa án — hồ sơ xét xử', perm: 'legal' },
  kho: { mod: kho, title: 'Kho hồ sơ & Trợ lý AI', perm: 'legal' },
  chat: { mod: chat, title: 'Trợ lý AI', perm: 'docs' },
  spell: { mod: spell, title: 'Kiểm tra chính tả', perm: 'tools' },
  summary: { mod: summary, title: 'Tóm tắt văn bản', perm: 'tools' },
  number: { mod: number, title: 'Số thành chữ', perm: 'tools' },
  pdf: { mod: pdf, title: 'PDF sang Word', perm: 'tools' },
  templates: { mod: templates, title: 'Thư viện mẫu', perm: 'docs' },
  tpl: { mod: tpl, title: 'Mẫu từ file Word', perm: 'docs' },
  docs: { mod: docs, title: 'Tài liệu của tôi', perm: 'docs' },
  admin: { mod: admin, title: 'Quản trị tài khoản', perm: 'users' },
  settings: { mod: settings, title: 'Cài đặt' },
  'bao-mat': { mod: security, title: 'Bảo mật & an toàn thông tin' },
  help: { mod: help, title: 'Hướng dẫn sử dụng' },
  'co-quan': { mod: coQuan, title: 'Chọn cơ quan làm việc', perm: 'legal' },
};
// Màn hình mở được khi chưa chọn cơ quan (cài đặt tài khoản, bảo mật, hướng dẫn, quản trị).
const NO_AGENCY_OK = new Set(['co-quan', 'settings', 'bao-mat', 'help', 'admin']);
/** Điều tra viên, cán bộ Tòa án: cơ quan mặc định theo vai trò, không cần hỏi. */
const ROLE_AGENCY = { investigator: 'cqdt', court: 'toa-an' };
/**
 * Cần hiện màn hình chọn cơ quan: mỗi lần đăng nhập (cờ `agency-ask` của phiên) hoặc chưa từng chọn. Vai trò có sẵn
 * cơ quan (điều tra viên, cán bộ Tòa án) chỉ có một khu vực nên vào thẳng.
 */
function agencyNeeded() {
  const u = accounts.current();
  if (!u?.permSet.has('legal')) return false;
  if (ROLE_AGENCY[u.role]) {
    if (!currentAgency()) setAgency(ROLE_AGENCY[u.role]);
    sessionStore.remove('agency-ask');
    return false;
  }
  return !currentAgency() || !!sessionStore.get('agency-ask');
}

let view = $('#view');
let cleanup = null;
let currentRoute = null;
let aiCache = { providers: {} }; // Kho API key đã giải mã của tài khoản hiện tại (chỉ trong bộ nhớ).
/** Đã cấu hình nhà cung cấp: dịch vụ trực tuyến cần API key; AI trên máy chỉ cần địa chỉ và mô hình. */
const aiConfigured = (p) => {
  const c = aiCache.providers?.[p];
  // Chế độ bảo mật: chỉ AI nội bộ, đúng máy chủ quản trị khai báo.
  if (secureOn()) return p === 'local' && !!(c?.base && c?.model) && aiEndpointAllowed(c.base);
  return p === 'local' ? !!(c?.base && c?.model) : !!c?.key;
};
const aiEntry = (p) => {
  const c = aiCache.providers[p];
  return { provider: p, apiKey: c.key || (p === 'local' ? 'local' : ''), model: c.model || PROVIDERS[p].defaultModel, label: PROVIDERS[p].label, ...(p === 'local' ? { local: true } : {}) };
};
function loadAiCache(data) {
  aiCache = data && typeof data === 'object' ? { providers: {}, ...data } : { providers: {} };
  // Chế độ bảo mật có khai báo máy chủ AI nội bộ: mọi tài khoản dùng đúng máy chủ đó (mô hình mặc định do quản trị đặt).
  const sp = securityPolicy();
  if (sp.on && sp.aiBase && data) {
    const l = aiCache.providers.local || {};
    aiCache.providers = { ...aiCache.providers, local: { ...l, base: normalizeLocalBase(sp.aiBase), model: l.model || sp.aiModel || '' } };
  }
  setLocalEndpoint(aiCache.providers?.local?.base);
}

/* ---------- Độ tin cậy AI: dự phòng nhà cung cấp, ghi nhớ kết quả, nhật ký ---------- */
const AI_CACHE_MAX = 300;
function aiLog(entry) {
  store.set('ai-log', [{ at: Date.now(), ...entry }, ...store.get('ai-log', [])].slice(0, 60));
}
setAIHooks({
  chain() {
    return Object.keys(PROVIDERS).filter(aiConfigured).map(aiEntry);
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
    if (e.type === 'offline') {
      aiLog({ type: 'switch', provider: 'local', message: `Mất kết nối mạng — ${name(e.from)} → AI trên máy` });
      toast('Mất kết nối mạng — tự chuyển sang AI chạy trên máy', { type: 'info', timeout: 5000 });
      return;
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
   * Cấu hình AI đang dùng: { provider, apiKey, model, label, local? } hoặc null nếu chưa có / không có quyền.
   * - Dịch vụ trực tuyến: cần quyền “AI trực tuyến” ('ai'); scope = 'legal' cần “AI trực tuyến trong Tố tụng”.
   * - AI trên máy (địa chỉ máy này / mạng nội bộ): dữ liệu không ra Internet nên chỉ cần quyền dùng phân hệ
   *   ('docs' hoặc 'legal'). Địa chỉ ngoài mạng nội bộ được coi như dịch vụ trực tuyến.
   */
  ai(scope = 'docs') {
    const user = accounts.current();
    if (!user) return null;
    const online = user.permSet.has(scope === 'legal' ? 'legal.ai' : 'ai');
    const localPrivate = aiConfigured('local') && (secureOn() || isPrivateEndpoint(aiCache.providers.local.base));
    const allowed = Object.keys(PROVIDERS).filter((p) => aiConfigured(p) && (online || (p === 'local' && localPrivate && user.permSet.has(scope === 'legal' ? 'legal' : 'docs'))));
    const pref = this.settings().aiProvider;
    // Mất mạng: dùng ngay AI trên máy (nếu có) thay cho dịch vụ trực tuyến.
    const provider = isOffline() && allowed.includes('local') ? 'local' : allowed.includes(pref) ? pref : allowed[0];
    return provider ? aiEntry(provider) : null;
  },
  hasAI(scope) {
    return !!this.ai(scope);
  },
  aiProviders: () => aiCache.providers || {},
  async saveAiProviders(providers) {
    loadAiCache({ ...aiCache, providers });
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
  agencyChanged: () => {
    sessionStore.remove('agency-ask');
    refreshChrome();
  },
  lock: (reason) => lockApp(reason),
  logout() {
    accounts.logout();
    loadAiCache(null);
    toast('Đã đăng xuất');
    showGate();
  },
  modal,
  confirm,
  openAuth,
};

/* ---------- Router ---------- */
/* ---------- Điện thoại: chủ yếu để xem, tra cứu ---------- */
// Chế độ xem: ẩn nút sửa / xóa / thêm, mở biên bản, văn bản dạng bản đọc. Người dùng bật "Sửa" khi thật cần.
function applyViewMode() {
  document.body.classList.toggle('view-mode', viewMode());
  document.body.classList.toggle('is-phone', isPhone());
  const b = $('[data-mode-toggle]');
  if (b) {
    const on = viewMode();
    b.hidden = !isPhone();
    b.setAttribute('aria-pressed', String(!on));
    b.title = on ? 'Đang ở chế độ xem — bấm để bật chỉnh sửa' : 'Đang chỉnh sửa — bấm để về chế độ xem';
    b.innerHTML = `${icon(on ? 'eye' : 'wand', 'ic-sm')}<span>${on ? 'Xem' : 'Sửa'}</span>`;
  }
}
matchMedia(PHONE_QUERY).addEventListener?.('change', () => {
  applyViewMode();
  renderBottomNav();
});

function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [name, ...rest] = raw.split('/');
  return { name: name || (isPhone() ? 'tra-cuu' : 'dashboard'), params: rest };
}

function route() {
  if (!accounts.current()) return showGate();
  if (accounts.needsUnlock()) return showGate('unlock');
  let { name, params } = parseHash();
  if (name === 'login' || name === 'register') {
    name = currentRoute || 'dashboard';
    history.replaceState(null, '', `#${name}`);
    if (currentRoute) return;
  }
  let r = ROUTES[name] || ROUTES.dashboard;
  if (!ROUTES[name]) name = 'dashboard';
  // Chưa chọn cơ quan: hỏi trước, chọn xong tiếp tục vào đúng màn hình đang mở.
  let agencyNext = null;
  // Gọi trước để vai trò có sẵn cơ quan (điều tra viên, cán bộ Tòa án) được gán ngay cả khi đang ở Cài đặt, Quản trị…
  if (agencyNeeded() && !NO_AGENCY_OK.has(name)) {
    agencyNext = name === 'dashboard' && !params.length ? '' : [name, ...params].join('/');
    r = ROUTES['co-quan'];
  }
  // Màn hình chọn cơ quan chiếm trọn trang: ẩn thanh bên, thanh trên, thanh dưới.
  document.body.classList.toggle('agency-picking', agencyNext != null || (name === 'co-quan' && accounts.can('legal')));
  const denied = r.perm && !accounts.can(r.perm);
  // Tổng quan là màn hình nhìn kiểu kính: thanh trên trong suốt nổi lên trên nền.
  document.body.classList.toggle('glass-dash', name === 'dashboard' && agencyNext == null && !denied);
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  currentRoute = name;
  // Thay vùng hiển thị bằng nút mới để loại bỏ mọi listener của màn hình trước.
  const fresh = view.cloneNode(false);
  view.replaceWith(fresh);
  view = ctx.view = fresh;
  document.title = `${r.title} — Trợ Lý Văn Bản AI`;
  $('[data-view-title]').textContent = r.title;
  // Mục con có đường dẫn riêng (vd. toa-an/kho-ban-an); còn lại tô sáng theo tên màn hình.
  const subKey = params[0] && $(`[data-nav="${name}/${params[0]}"]`) ? `${name}/${params[0]}` : name;
  $$('[data-nav]').forEach((a) => {
    const active = a.dataset.nav === subKey || (name === 'tpl' && a.dataset.nav === 'templates');
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
    cleanup = (agencyNext != null ? coQuan.render(ctx, [], { next: agencyNext, forced: true }) : r.mod.render(ctx, params)) || null;
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="page"><div class="empty"><div class="empty-icon">${icon('alert')}</div><h3>Đã xảy ra lỗi</h3><p>${escapeHtml(err.message)}</p></div></div>`;
  }
  // Màn hình hẹp: dùng chữ gợi ý ngắn để không bị cắt trong ô nhập.
  if (window.matchMedia('(max-width: 760px)').matches) $$('[data-ph-short]', view).forEach((el) => (el.placeholder = el.dataset.phShort));
  // Ví dụ “Thử ngay” từ hướng dẫn: điền sẵn vào ô nhập của màn hình đích.
  if (ctx.handoff?.prefill) {
    const box = $('[data-input]', view);
    if (box) {
      box.value = ctx.handoff.prefill;
      box.dispatchEvent(new Event('input', { bubbles: true }));
      box.focus();
      toast('Đã điền sẵn ví dụ — chỉnh lại tên, nội dung rồi gửi', { type: 'info' });
    }
    ctx.handoff = null;
  }
  refreshHelpHint();
}

/* ---------- Hướng dẫn theo ngữ cảnh ---------- */
const helpOpened = () => store.get('help-opened', {});
function markHelpOpened(id) {
  store.set('help-opened', { ...helpOpened(), [id]: Date.now() });
  refreshHelpHint();
}
function refreshHelpHint() {
  const hint = $('[data-help-hint]');
  if (!hint) return;
  const g = accounts.current() && currentRoute && currentRoute !== 'help' ? guideForRoute(currentRoute) : null;
  hint.hidden = !g || (g.perm && !accounts.can(g.perm)) || !!store.get('help-hint-off', false) || isSeen(g.id) || !!helpOpened()[g.id];
}
/** Mở ngăn hướng dẫn bên phải cho màn hình hiện tại (hoặc hướng dẫn có id). */
function openHelp(id) {
  if (!id && currentRoute === 'help') id = parseHash().params[0];
  const g = (id && findGuide(id)) || guideForRoute(currentRoute) || findGuide('batdau');
  markHelpOpened(g.id);
  const others = visibleGuides(ctx.can).filter((x) => x.id !== g.id && x.group === g.group).slice(0, 4);
  modal(
    `<div class="hd-head">
       <span class="quick-icon">${icon(g.icon)}</span>
       <div><small>Hướng dẫn nhanh · ${escapeHtml(g.time)}</small><h2 class="modal-title" tabindex="-1" autofocus>${escapeHtml(g.title)}</h2></div>
       <button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng hướng dẫn" data-close>${icon('x')}</button>
     </div>
     <p class="hd-sum">${escapeHtml(g.summary)}</p>
     <div class="hd-body">${guideBodyHtml(g, { compact: true, can: ctx.can })}</div>
     ${others.length ? `<div class="hd-more"><small>Hướng dẫn cùng nhóm</small>${others.map((o) => `<a href="#help/${o.id}" data-close>${icon(o.icon, 'ic-sm')}${escapeHtml(o.title)}</a>`).join('')}</div>` : ''}
     <div class="hd-foot"><a class="btn btn-primary" href="#help/${g.id}" data-close>${icon('book', 'ic-sm')}Xem đầy đủ (hỏi – đáp, liên quan)</a><a class="btn btn-ghost" href="#help" data-close>Tất cả hướng dẫn</a></div>`,
    {
      className: 'modal-drawer',
      label: `Hướng dẫn: ${g.title}`,
      onMount(box, close) {
        box.parentElement.classList.add('is-drawer');
        bindGuide(box, g, ctx, { onNavigate: close });
      },
    },
  );
}
ctx.openHelp = openHelp;
$('[data-help-open]').addEventListener('click', () => openHelp());
$('[data-help-hint-open]').addEventListener('click', () => openHelp());
$('[data-help-hint-x]').addEventListener('click', () => {
  store.set('help-hint-off', true);
  refreshHelpHint();
  toast('Đã ẩn gợi ý. Vẫn có thể bấm nút ? hoặc phím F1 để xem hướng dẫn.', { type: 'info' });
});
document.addEventListener('keydown', (e) => {
  if (!accounts.current() || document.querySelector('.modal-backdrop')) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if (e.key === 'F1' || (e.key === '?' && !typing && !e.ctrlKey && !e.metaKey)) {
    e.preventDefault();
    openHelp();
  }
});

/* ---------- Chrome: sidebar, user menu, AI status ---------- */
function refreshChrome() {
  const user = accounts.current();
  if (!user) return;
  $('[data-docs-count]').textContent = docsRepo.list().length;
  $('[data-cases-count]').textContent = casesRepo.list().length;
  // Ẩn mục điều hướng không có quyền.
  $$('[data-nav]').forEach((a) => {
    const r = ROUTES[a.dataset.nav.split('/')[0]];
    a.hidden = !!(r?.perm && !user.permSet.has(r.perm));
  });
  $$('[data-perm-section]').forEach((el) => (el.hidden = !user.permSet.has(el.dataset.permSection)));
  // Mục riêng của từng cơ quan: chỉ hiện mục của cơ quan đang chọn.
  const ag = user.permSet.has('legal') ? currentAgency() : null;
  $$('.sidebar [data-agency]').forEach((el) => {
    if (!ag || !el.dataset.agency.split(' ').includes(ag)) el.hidden = true;
  });
  const sw = $('[data-agency-switch]');
  sw.hidden = !ag;
  if (ag) {
    $('[data-agency-mark]', sw).className = `sb-agency-mark cq-mark-${ag}`;
    $('[data-agency-mark]', sw).innerHTML = icon(AGENCIES[ag].mark);
    $('[data-agency-name]', sw).textContent = AGENCIES[ag].nhan;
    sw.title = `${AGENCIES[ag].ten} — bấm để đổi cơ quan`;
  }
  document.body.dataset.currentAgency = ag || '';
  document.documentElement.dataset.agency = ag || '';
  $$('[data-need-perm]').forEach((el) => (el.hidden = !user.permSet.has(el.dataset.needPerm)));
  const st = $('[data-ai-status]');
  const ai = ctx.ai();
  st.classList.toggle('on', !!ai);
  const sec = secureOn();
  st.querySelector('strong').textContent = ai ? (sec ? 'AI nội bộ đã bật' : ai.local ? (isOffline() ? 'Mất mạng · AI trên máy' : 'AI trên máy đã bật') : `AI ${ai.label} đã bật`) : sec ? 'Chưa kết nối AI nội bộ' : user.permSet.has('ai') ? 'Chế độ cơ bản' : 'AI trực tuyến bị tắt';
  st.querySelector('small').textContent = ai ? ai.model : sec ? 'Chế độ bảo mật: chỉ AI nội bộ' : user.permSet.has('ai') ? 'Thêm API key để bật AI' : 'Có thể dùng AI trên máy';
  renderSecurityChip(getEnv() === 'secure');
  renderUserMenu();
  renderBottomNav();
}

/** Huy hiệu “Bảo mật” trên thanh trên cùng: bấm để khóa ngay / xem trung tâm bảo mật. */
function renderSecurityChip(on) {
  const bar = $('.topbar-actions');
  let chip = $('[data-sec-chip]', bar);
  if (!on) return chip?.remove();
  if (!chip) {
    chip = document.createElement('div');
    chip.className = 'sec-chip';
    chip.dataset.secChip = '';
    chip.innerHTML = `<a href="#bao-mat" class="sec-chip-link" title="Chế độ bảo mật đang bật: dữ liệu mã hóa, chỉ AI nội bộ, chặn kết nối ra Internet">${icon('shield', 'ic-sm')}<span>Môi trường bảo mật</span></a><button type="button" class="btn btn-ghost btn-icon btn-sm" data-sec-lock aria-label="Khóa ngay" title="Khóa ngay">${icon('lock', 'ic-sm')}</button>`;
    bar.prepend(chip);
    chip.querySelector('[data-sec-lock]').addEventListener('click', () => lockApp('Khóa phiên làm việc'));
  }
}

/* ---------- Thanh điều hướng dưới (điện thoại) ---------- */
function renderBottomNav() {
  const host = $('[data-bottom-nav]');
  const user = accounts.current();
  if (!host || !user) return;
  const has = (p) => user.permSet.has(p);
  // Điện thoại chủ yếu để xem, tra cứu: thanh dưới theo cơ quan (Tra cứu, Hồ sơ / Sổ vụ án, Bình luận, Biểu mẫu).
  const ag = has('legal') ? agencyInfo() : null;
  const items = ag ? ag.bottom : [['tra-cuu', 'search', 'Tra cứu'], ['docs', 'folder', 'Tài liệu'], ['templates', 'grid', 'Mẫu'], ['chat', 'sparkles', 'Trợ lý AI']];
  const shown = items.filter(([k]) => { const r = ROUTES[k.split('/')[0]]; return !r.perm || has(r.perm); });
  const { name: cur, params: cp } = parseHash();
  const curKey = cp[0] && shown.some(([k]) => k === `${cur}/${cp[0]}`) ? `${cur}/${cp[0]}` : cur;
  const main = new Set(shown.map(([k]) => k));
  host.style.gridTemplateColumns = `repeat(${shown.length + 1}, minmax(0, 1fr))`;
  host.innerHTML =
    shown.map(([k, ic, label]) => `<a href="#${k}" data-bn="${k}"${curKey === k ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('') +
    `<button type="button" data-bn-more aria-label="Mở menu đầy đủ"${currentRoute && !main.has(curKey) ? ' aria-current="page"' : ''}>${icon('menu')}<span>Thêm</span></button>`;
  host.querySelector('[data-bn-more]').addEventListener('click', () => sidebar.classList.add('open'));
}
// Bàn phím ảo mở (chiều cao vùng nhìn giảm mạnh) → ẩn thanh dưới để rộng chỗ nhập liệu.
if (window.visualViewport) {
  const onVV = () => document.body.classList.toggle('kb-open', window.visualViewport.height < window.innerHeight * 0.72);
  window.visualViewport.addEventListener('resize', onVV);
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
      ${user.permSet.has('legal') ? `<a href="#co-quan" role="menuitem" data-agency-menu>${icon(agencyInfo()?.mark || 'layers')}Đổi cơ quan${agencyInfo() ? ` (đang: ${escapeHtml(agencyInfo().ngan)})` : ''}</a>` : ''}
      <a href="#settings" role="menuitem">${icon('settings')}Cài đặt</a>
      <a href="#bao-mat" role="menuitem">${icon('shield')}Bảo mật &amp; an toàn thông tin</a>
      ${getEnv() === 'secure' ? `<button type="button" role="menuitem" data-lock-now>${icon('lock')}Khóa ngay</button>` : ''}
      <a href="#help" role="menuitem">${icon('help')}Hướng dẫn sử dụng</a>
      <button type="button" role="menuitem" data-theme-menu>${icon('moon')}Giao diện sáng / tối</button>
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
    loadAiCache(null);
    toast('Đã đăng xuất');
    showGate();
  });
  host.querySelector('[data-change-pw]').addEventListener('click', changePasswordDialog);
  host.querySelector('[data-lock-now]')?.addEventListener('click', () => lockApp('Khóa phiên làm việc'));
  host.querySelector('[data-theme-menu]').addEventListener('click', () => $('[data-theme-toggle]').click());
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

/* ---------- Thu gọn thanh menu (máy tính): chỉ còn biểu tượng, rê chuột hiện tên; ghi nhớ trên máy ---------- */
const SB_KEY = 'tlvb:sb-collapsed';
function setSidebarCollapsed(on) {
  document.body.classList.toggle('sb-collapsed', on);
  const t = $('[data-sidebar-toggle]');
  t?.setAttribute('aria-expanded', String(!on));
  t?.setAttribute('aria-label', on ? 'Mở rộng thanh menu (Ctrl B)' : 'Thu gọn thanh menu (Ctrl B)');
  // Khi thu gọn, tên chức năng hiện dưới dạng chú thích khi rê chuột.
  $$('.sb-nav a, .sb-link, .sb-new', sidebar).forEach((a) => {
    if (on) a.title = a.textContent.replace(/\s+\d+$/, '').trim();
    else a.removeAttribute('title');
  });
  try {
    localStorage.setItem(SB_KEY, on ? '1' : '0');
  } catch {}
}
$('[data-sidebar-toggle]').addEventListener('click', () => setSidebarCollapsed(!document.body.classList.contains('sb-collapsed')));
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'b' && accounts.current() && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !e.target.isContentEditable) {
    e.preventDefault();
    setSidebarCollapsed(!document.body.classList.contains('sb-collapsed'));
  }
});
try {
  if (localStorage.getItem(SB_KEY) === '1') setSidebarCollapsed(true);
} catch {}
// Kéo mép phải thanh menu để đổi độ rộng (bấm đúp: về mặc định; phím ← → khi đang chọn tay nắm).
const sbGrip = document.createElement('div');
sbGrip.className = 'sb-grip';
sbGrip.setAttribute('aria-label', 'Kéo để đổi độ rộng thanh menu (bấm đúp: mặc định)');
sbGrip.title = 'Kéo để đổi độ rộng thanh menu · bấm đúp: mặc định';
$('.shell')?.append(sbGrip);
makeResizable(sbGrip, { axis: 'x', min: 200, max: () => Math.min(460, window.innerWidth * 0.4), key: 'tlvb:sb-w', current: () => sidebar.getBoundingClientRect().width, apply: (v) => document.documentElement.style.setProperty('--sb-w', v == null ? '' : `${v}px`) });
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
  const sec = secureOn();
  if (mode === 'unlock' || mode === 'recover') return lockHtml(mode);
  if (mode === 'register' && !signup) mode = 'login';
  if (first) mode = 'register';
  const isLogin = mode === 'login';
  const title = isLogin ? 'Đăng nhập' : first ? 'Tạo tài khoản đầu tiên' : 'Tạo tài khoản';
  const sub = isLogin
    ? sec
      ? 'Chế độ bảo mật: dữ liệu mỗi tài khoản được mã hóa AES-256-GCM trên máy này, chỉ dùng AI nội bộ, chặn kết nối ra Internet.'
      : 'Dữ liệu và API key của mỗi tài khoản được lưu, mã hóa riêng trên máy này.'
    : isDesktop
      ? 'Bản cài đặt trên máy: tài khoản mới có toàn quyền (văn bản, công cụ, AI, Tố tụng). Dữ liệu chỉ lưu trên máy này.'
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
        <div class="field"><label for="g-pass">Mật khẩu</label><input class="input" id="g-pass" name="password" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" />${isLogin ? '' : `<span class="hint">${sec ? 'Tối thiểu 10 ký tự, có cả chữ và số.' : 'Tối thiểu 8 ký tự.'} Không có cách khôi phục mật khẩu — hãy ghi nhớ cẩn thận.</span>`}</div>
        <div class="auth-err" role="alert" hidden></div>
        <button class="btn btn-primary btn-lg" type="submit">${isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
      </form>
      <p class="auth-switch">
        ${isLogin && signup ? `Chưa có tài khoản? <button type="button" data-gate-mode="register">Đăng ký</button>` : ''}
        ${isLogin && !signup ? 'Liên hệ quản trị viên để được cấp tài khoản.' : ''}
        ${!isLogin && !first ? `Đã có tài khoản? <button type="button" data-gate-mode="login">Đăng nhập</button>` : ''}
      </p>
      <p class="gate-foot">${icon(sec ? 'shield' : 'lock', 'ic-sm')}${sec ? '<strong>Chế độ bảo mật</strong> · ' : ''}Chạy cục bộ trên máy${isDesktop ? ` · Bản cài đặt ${desktop.os}` : sec ? '' : ' · <a href="index.html">Về trang giới thiệu</a>'}</p>
    </div>`;
}

/** Màn hình khóa (tự khóa / tải lại trang ở chế độ bảo mật) và nhập mã khôi phục. */
function lockHtml(mode) {
  const s = accounts.current();
  const rec = mode === 'recover';
  return `
    <div class="gate-card" data-lock-card>
      <div class="auth-head">
        <span class="logo-mark lock-mark">${icon(rec ? 'key' : 'lock')}</span>
        <h2>${rec ? 'Nhập mã khôi phục' : 'Phiên làm việc đã khóa'}</h2>
        <p>${rec ? 'Mật khẩu của tài khoản đã được quản trị đặt lại. Dữ liệu đã mã hóa chỉ mở được bằng <strong>mã khôi phục</strong> (24 ký tự) được cấp khi bật mã hóa.' : 'Dữ liệu đã được mã hóa và khóa lại. Nhập mật khẩu để tiếp tục làm việc.'}</p>
      </div>
      <form class="auth-form" data-gate-form="${mode}" novalidate>
        <div class="field"><label>Tài khoản</label><div class="lock-user"><strong>${escapeHtml(s?.name || '')}</strong><small>${escapeHtml(s?.email || '')}</small></div></div>
        ${rec ? `<div class="field"><label for="g-rec">Mã khôi phục</label><input class="input mono" id="g-rec" name="code" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" /></div>` : `<div class="field"><label for="g-pass">Mật khẩu</label><input class="input" id="g-pass" name="password" type="password" autocomplete="current-password" /></div>`}
        <div class="auth-err" role="alert" hidden></div>
        <button class="btn btn-primary btn-lg" type="submit">${rec ? 'Mở dữ liệu' : 'Mở khóa'}</button>
      </form>
      <p class="auth-switch"><button type="button" data-gate-logout>Đăng xuất / đổi tài khoản</button></p>
      <p class="gate-foot">${icon('shield', 'ic-sm')}${secureOn() ? '<strong>Chế độ bảo mật</strong> · ' : ''}AES-256-GCM · khóa chỉ nằm trong bộ nhớ khi đang mở</p>
    </div>`;
}

/** Mã khôi phục chỉ hiện một lần (ngay trên màn hình đăng nhập): bắt buộc xác nhận đã ghi lại. */
function showRecoveryCode(code) {
  return new Promise((resolve) => {
    gateEl.innerHTML = `
      <div class="gate-card" data-rec-card>
        <div class="auth-head"><span class="logo-mark lock-mark">${icon('key')}</span><h2>Mã khôi phục dữ liệu</h2>
        <p>Dữ liệu của tài khoản đã được <strong>mã hóa AES-256-GCM</strong>. Nếu quên mật khẩu và quản trị đặt lại, chỉ mã này mở được dữ liệu cũ — <strong>không ai khác khôi phục được</strong>. Mã chỉ hiện một lần.</p></div>
        <div class="rec-code" data-rec-code>${escapeHtml(code)}</div>
        <ul class="hint rec-tips"><li>Ghi ra giấy hoặc in, cất nơi an toàn theo quy định bảo mật của đơn vị.</li><li>Không lưu trong máy tính, không gửi qua mạng.</li><li>Tạo mã mới tại <em>Bảo mật &amp; an toàn thông tin</em> (mã cũ hết hiệu lực).</li></ul>
        <label class="check"><input type="checkbox" data-rec-ok /> Tôi đã ghi lại mã khôi phục</label>
        <div class="modal-actions"><button class="btn" type="button" data-rec-print>${icon('printer', 'ic-sm')}In mã</button><button class="btn btn-primary" type="button" data-rec-done ${needAttr('Hãy ghi lại (hoặc in) mã khôi phục, rồi tích ô “Tôi đã ghi lại mã khôi phục” để tiếp tục', '[data-rec-ok]')}>Tiếp tục</button></div>
      </div>`;
    const ok = gateEl.querySelector('[data-rec-ok]');
    const done = gateEl.querySelector('[data-rec-done]');
    ok.addEventListener('change', () => need(done, ok.checked ? '' : 'Hãy ghi lại (hoặc in) mã khôi phục, rồi tích ô “Tôi đã ghi lại mã khôi phục” để tiếp tục', '[data-rec-ok]'));
    gateEl.querySelector('[data-rec-print]').addEventListener('click', () => {
      const w = window.open('', '_blank', 'width=600,height=400');
      if (!w) return;
      w.document.write(`<title>Mã khôi phục</title><body style="font-family:serif;padding:40px"><h2>Mã khôi phục dữ liệu — Trợ Lý Văn Bản AI</h2><p>Tài khoản: ${escapeHtml(accounts.current()?.email || '')}</p><p style="font:700 22px monospace;letter-spacing:2px">${escapeHtml(code)}</p><p>Ngày tạo: ${new Date().toLocaleString('vi-VN')}</p></body>`);
      w.document.close();
      w.print();
    });
    done.addEventListener('click', () => resolve());
  });
}

function showGate(mode = 'login') {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  currentRoute = null;
  shell.hidden = true;
  document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
  document.title = mode === 'unlock' ? 'Đã khóa — Trợ Lý Văn Bản AI' : 'Đăng nhập — Trợ Lý Văn Bản AI';
  if (!gateEl) {
    gateEl = document.createElement('main');
    gateEl.className = 'gate';
    document.body.append(gateEl);
  }
  gateEl.hidden = false;
  gateEl.innerHTML = gateHtml(mode);
  const form = $('[data-gate-form]', gateEl);
  form.querySelector('input')?.focus();
  gateEl.querySelectorAll('[data-gate-mode]').forEach((b) => b.addEventListener('click', () => showGate(b.dataset.gateMode)));
  gateEl.querySelector('[data-gate-logout]')?.addEventListener('click', () => {
    accounts.logout();
    loadAiCache(null);
    showGate('login');
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const err = $('.auth-err', form);
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    err.hidden = true;
    try {
      const kind = form.dataset.gateForm;
      let res = {};
      if (kind === 'unlock') res = await accounts.unlock(data.password);
      else if (kind === 'recover') await accounts.recover(data.code);
      else res = kind === 'login' ? await accounts.login(data) : await accounts.register(data);
      // Mỗi lần đăng nhập: hỏi chọn cơ quan trước khi vào khu vực làm việc.
      if (kind === 'login' || kind === 'register') sessionStore.set('agency-ask', true);
      if (res?.recoveryCode) await showRecoveryCode(res.recoveryCode);
      await enterApp();
      if (kind === 'login' || kind === 'register') toast(`Xin chào, ${res.name}!`);
      else toast(kind === 'recover' ? 'Đã mở dữ liệu bằng mã khôi phục — nên tạo mã khôi phục mới' : 'Đã mở khóa');
      const pending = accounts.can('users') ? accounts.pendingCount() : 0;
      if (pending && (kind === 'login' || kind === 'register')) toast(`Có ${pending} tài khoản mới đang chờ cấp quyền — vào Quản trị tài khoản để phân quyền`, { type: 'info', timeout: 6000 });
    } catch (ex) {
      if (ex.code === 'NEED_RECOVERY') return showGate('recover');
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

// Mất mạng / có mạng trở lại: cập nhật trạng thái AI (tự dùng AI trên máy khi mất mạng).
for (const ev of ['online', 'offline']) window.addEventListener(ev, () => accounts.current() && refreshChrome());

async function enterApp() {
  loadAiCache(await vault.read());
  if (gateEl) gateEl.hidden = true;
  shell.hidden = false;
  touchActivity();
  refreshChrome();
  if (/^#(login|register)$/.test(location.hash)) history.replaceState(null, '', '#dashboard');
  route();
}

/* ---------- Chế độ bảo mật: khóa ngay, tự khóa khi không thao tác ---------- */
let lastActivity = Date.now();
const touchActivity = () => (lastActivity = Date.now());
for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, touchActivity, { passive: true, capture: true });
async function lockApp(reason = 'Khóa phiên làm việc') {
  if (!accounts.current() || accounts.needsUnlock()) return;
  showGate('unlock');
  await accounts.lock(reason);
  loadAiCache(null);
}
setInterval(() => {
  const p = securityPolicy();
  if (getEnv() !== 'secure' || !accounts.current() || accounts.needsUnlock() || shell.hidden) return;
  if (Date.now() - lastActivity >= p.idleMin * 60000) lockApp(`Tự khóa sau ${p.idleMin} phút không thao tác`);
}, 15000);

/** Khởi động: phiên còn hiệu lực → mở dữ liệu (chế độ bảo mật: luôn hỏi lại mật khẩu sau khi tải lại trang). */
async function boot() {
  if (!accounts.current()) return showGate(/^#register/.test(location.hash) ? 'register' : 'login');
  try {
    if (await accounts.resume()) return enterApp();
    showGate('unlock');
  } catch (ex) {
    showGate(ex.code === 'NEED_RECOVERY' ? 'recover' : 'unlock');
  }
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
    .filter(([k, r]) => (!r.perm || can(r.perm)) && !routeBelongsElsewhere(k))
    .map(([k, r]) => ({ group: 'Điều hướng', label: r.title, icon: { dashboard: 'home', compose: 'file', legal: 'layers', interview: 'message', cases: 'folder', 'theo-doi': 'activity', 'loi-khai': 'quote', 'so-do': 'chart', forms: 'file', kho: 'sparkles', chat: 'sparkles', spell: 'spell', summary: 'book', number: 'hash', templates: 'layers', docs: 'folder', admin: 'shield', settings: 'settings', help: 'help', pdf: 'refresh' }[k], run: () => ctx.navigate(`#${k}`) }));
  const guides = visibleGuides(can).map((g) => ({ group: 'Hướng dẫn', label: `Hướng dẫn: ${g.title}`, icon: 'help', run: () => ctx.navigate(`#help/${g.id}`) }));
  const crimes = (can('legal') ? ALL_CRIMES : []).map((c) => ({ group: 'Tội danh — cây hỏi đáp', label: `Điều ${c.dieu}. ${c.ten}`, icon: 'gavel', run: () => ctx.navigate(`#legal/${c.dieu}`) }));
  const types = (can('docs') ? DOC_TYPES : []).map((t) => ({ group: 'Soạn mới', label: `Soạn ${t.name.toLowerCase()}`, icon: t.icon, hint: t.abbr, run: () => ctx.navigate(`#compose/${t.id}`) }));
  const recent = (can('docs') ? docsRepo.list() : [])
    .slice(0, 8)
    .map((d) => ({ group: 'Tài liệu', label: d.title, icon: 'file', run: () => ctx.navigate(`#compose/doc/${d.id}`) }));
  const actions = [
    { group: 'Thao tác', label: 'Chuyển giao diện sáng/tối', icon: 'moon', run: () => $('[data-theme-toggle]').click() },
    { group: 'Thao tác', label: 'Đăng xuất', icon: 'logout', run: () => $('[data-logout]')?.click() },
  ];
  return [...nav, ...guides, ...types, ...crimes, ...recent, ...actions];
}

function renderPalette() {
  const q = norm(pInput.value.trim());
  const words = q.split(/\s+/).filter(Boolean);
  pItems = paletteCommands().filter((c) => {
    const t = norm(c.label + ' ' + c.group);
    return words.every((w) => t.includes(w));
  });
  // Gõ từ khóa → thêm lựa chọn tra cứu trong toàn bộ dữ liệu (hồ sơ, biên bản, điều luật, bình luận, biểu mẫu…).
  const raw = pInput.value.trim();
  if (raw.length >= 2) pItems.push({ group: 'Tra cứu dữ liệu', icon: 'search', label: `Tra cứu “${raw}” trong hồ sơ, biên bản, điều luật, biểu mẫu…`, run: () => ctx.navigate(`#tra-cuu/${encodeURIComponent(raw)}`) });
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
$('[data-palette-open]').addEventListener('click', () => (isPhone() ? ctx.navigate('#tra-cuu') : openPalette()));
$('[data-mode-toggle]')?.addEventListener('click', () => {
  store.set('phone-mode', viewMode() ? 'sua' : 'xem');
  applyViewMode();
  toast(viewMode() ? 'Chế độ xem: ẩn nút sửa, xóa; biên bản, văn bản mở dạng bản đọc' : 'Đã bật chỉnh sửa trên điện thoại', { type: 'info' });
  route();
});
applyViewMode();
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

/* ---------- Bản cài đặt cần cài lại bộ cài: mở đúng bộ cài theo máy (Windows / Mac chip Apple / Mac Intel) ---------- */
window.addEventListener('tlvb:need-installer', (e) => {
  e.preventDefault();
  openDownloadApp(ctx, { reason: e.detail?.reason || '' });
});

/* ---------- Tải ứng dụng máy tính (chỉ hiện trên bản web) ---------- */
$$('[data-download-app]').forEach((el) => {
  el.hidden = isDesktop;
  el.addEventListener('click', (e) => {
    e.preventDefault();
    openDownloadApp(ctx);
  });
});

/* ---------- Danh mục tính năng (nút nhỏ ở góc màn hình) ---------- */
$('[data-features-open]')?.addEventListener('click', () => openFeatureCatalog(ctx));

/* ---------- Khởi động ---------- */
// Chặn kết nối ra ngoài (chế độ bảo mật) trước mọi thao tác khác; ghi nhật ký mỗi lần chặn.
applyNetworkGuard();

// Nút "Bình luận Điều N" đặt sẵn ở các màn hình (vd đầu trang tội danh) — mở được cả khi chưa nạp sách (hướng dẫn nạp).
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-bl-dieu]');
  if (!b) return;
  e.preventDefault();
  openBlPopup(ctx, b.dataset.blDieu);
});
document.addEventListener('keydown', (e) => {
  const b = (e.key === 'Enter' || e.key === ' ') && e.target.closest?.('[data-bl-dieu][role="button"]');
  if (!b) return;
  e.preventDefault();
  openBlPopup(ctx, b.dataset.blDieu);
});

// Sách Bình luận BLHS: nạp từ máy; có sách thì mọi chỗ ghi "Điều N" bấm được để đọc bình luận.
loadBook();
onBookChange((b) => {
  if (!b) return stopLawLinks();
  startLawLinks({
    has: (so) => !!b.articles.find((a) => a.so === so),
    open: (so, el) => {
      const modalBox = el.closest('.bl-modal');
      if (modalBox) return modalBox.dispatchEvent(new CustomEvent('bl-go', { detail: so }));
      if (el.closest('.bl-page')) return ctx.navigate(`#binh-luan/${encodeURIComponent(so)}`);
      openBlPopup(ctx, so);
    },
  });
});

// Lưới an toàn: thao tác nào gặp lỗi ngoài dự kiến cũng phải báo cho người dùng biết lý do (không im lặng).
{
  let last = '';
  let lastAt = 0;
  const report = (err) => {
    if (!err || err.name === 'AbortError') return;
    const msg = String(err.message || err || '').trim();
    if (!msg || /ResizeObserver|Script error|Loading chunk|Failed to fetch dynamically/i.test(msg)) return;
    const now = Date.now();
    if (msg === last && now - lastAt < 4000) return;
    last = msg;
    lastAt = now;
    toast(`Không thực hiện được: ${msg}`, { type: 'error', timeout: 7000 });
  };
  window.addEventListener('unhandledrejection', (e) => report(e.reason));
  window.addEventListener('error', (e) => e.error && report(e.error));
}
const blockSeen = new Map();
setSecurityBlockHook((r) => {
  // Mỗi máy chủ ghi nhật ký tối đa một lần mỗi phút.
  if (Date.now() - (blockSeen.get(r.host) || 0) < 60000) return;
  blockSeen.set(r.host, Date.now());
  audit('Chặn kết nối ra ngoài', `${r.host} — ${r.reason}`);
});
bindThemeToggles();
// Bộ đọc tệp (lib/extract.js): chế độ OCR theo cài đặt và nguồn AI của tài khoản hiện tại.
import('./lib/extract.js').then(({ setOcrAi, setOcrModeGetter }) => {
  setOcrModeGetter(() => store.get('ocr-mode', 'may'));
  setOcrAi(() => {
    const ai = ctx.hasAI() ? ctx.ai() : null;
    return ai ? { call: (o) => streamClaude({ ...ai, ...o }), label: ai.label } : null;
  });
});
window.addEventListener('hashchange', route);
window.addEventListener('storage', () => accounts.current() && refreshChrome());
document.addEventListener('docs-changed', refreshChrome);
initUpdates();
boot();
// Bản cài đặt: mã web khởi động được → xác nhận bản cập nhật tại chỗ (không báo thì vỏ ứng dụng tự quay về bản trước).
desktop?.ready?.();
