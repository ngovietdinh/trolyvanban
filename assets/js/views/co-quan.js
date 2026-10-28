// Màn hình chọn cơ quan làm việc: Tòa án nhân dân hoặc Cơ quan Cảnh sát điều tra. Hiện trọn trang (không có thanh
// bên, thanh trên) ngay sau mỗi lần đăng nhập và khi bấm "Đổi cơ quan"; chọn xong mới vào khu vực của cơ quan đó.
import { icon, toast, escapeHtml } from '../ui.js';
import { AGENCIES, AGENCY_IDS, currentAgency, setAgency } from '../lib/agency.js';

export function render(ctx, params = [], { next = '', forced = false } = {}) {
  const cur = currentAgency();
  const user = ctx.user();
  const name = user ? user.name.split(/\s+/).pop() : '';
  ctx.view.innerHTML = `<div class="cq-screen">
    <div class="cq-brand"><span class="logo-mark">VB</span><span>Trợ Lý Văn Bản</span></div>
    <h1 class="cq-title">${name ? `Xin chào, ${escapeHtml(name)}. ` : ''}Chọn khu vực làm việc</h1>
    <p class="cq-sub">Mỗi cơ quan có khu vực riêng, chỉ gồm các chức năng của cơ quan đó. Dữ liệu của bạn giữ nguyên khi đổi.</p>
    <div class="cq-grid">${AGENCY_IDS.map((id) => {
      const a = AGENCIES[id];
      return `<button class="cq-card cq-mark-${id}${cur === id ? ' is-current' : ''}" type="button" data-agency-pick="${id}">
        <span class="cq-mark">${icon(a.mark)}</span>
        <strong>${escapeHtml(a.ten)}</strong>
        <span class="cq-desc">${escapeHtml(a.moTa)}</span>
        <ul>${a.shortcuts.map(([, ic, ten]) => `<li>${icon(ic, 'ic-sm')}${escapeHtml(ten)}</li>`).join('')}</ul>
        <span class="cq-go">Vào khu vực ${escapeHtml(a.ngan)}${icon('arrow-right', 'ic-sm')}</span>
        ${cur === id ? '<span class="cq-last">Lần trước</span>' : ''}
      </button>`;
    }).join('')}</div>
    <div class="cq-foot">${!forced && cur ? `<a class="btn btn-sm" href="#dashboard">${icon('chevron-left', 'ic-sm')}Quay lại khu vực ${escapeHtml(AGENCIES[cur].ngan)}</a>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-cq-logout>${icon('logout', 'ic-sm')}Đăng xuất</button></div>
  </div>`;
  ctx.view.addEventListener('click', (e) => {
    if (e.target.closest('[data-cq-logout]')) return ctx.logout();
    const b = e.target.closest('[data-agency-pick]');
    if (!b) return;
    setAgency(b.dataset.agencyPick);
    toast(`Đang làm việc tại: ${AGENCIES[b.dataset.agencyPick].ten}`);
    ctx.agencyChanged?.();
    ctx.navigate(next && next !== 'co-quan' ? `#${next}` : '#dashboard');
  });
}
