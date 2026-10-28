// Màn hình chọn cơ quan làm việc: Tòa án nhân dân hoặc Cơ quan Cảnh sát điều tra. Hiện ngay sau khi đăng nhập (nếu
// tài khoản có phân hệ tố tụng mà chưa chọn) và khi bấm "Đổi cơ quan".
import { icon, toast, escapeHtml } from '../ui.js';
import { AGENCIES, AGENCY_IDS, currentAgency, setAgency } from '../lib/agency.js';

export function render(ctx, params = [], { next = '' } = {}) {
  const cur = currentAgency();
  ctx.view.innerHTML = `<div class="page cq-page">
    <div class="page-head"><div><h1 class="page-title">Chọn cơ quan làm việc</h1><p class="page-sub">Ứng dụng chỉ hiện các mục dùng cho cơ quan bạn chọn. Đổi lại bất cứ lúc nào ở đầu thanh bên hoặc trong menu tài khoản; dữ liệu của bạn giữ nguyên.</p></div></div>
    <div class="cq-grid">${AGENCY_IDS.map((id) => {
      const a = AGENCIES[id];
      return `<button class="cq-card${cur === id ? ' is-current' : ''}" type="button" data-agency-pick="${id}" aria-pressed="${cur === id}">
        <span class="cq-mark cq-mark-${id}">${icon(a.mark)}</span>
        <span class="cq-body"><strong>${escapeHtml(a.ten)}</strong><span>${escapeHtml(a.moTa)}</span>
        <ul>${a.shortcuts.map(([, ic, ten]) => `<li>${icon(ic, 'ic-sm')}${escapeHtml(ten)}</li>`).join('')}</ul></span>
        <span class="cq-go">${cur === id ? 'Đang dùng' : 'Chọn'}${icon('arrow-right', 'ic-sm')}</span>
      </button>`;
    }).join('')}</div>
  </div>`;
  ctx.view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-agency-pick]');
    if (!b) return;
    setAgency(b.dataset.agencyPick);
    toast(`Đang làm việc tại: ${AGENCIES[b.dataset.agencyPick].ten}`);
    ctx.agencyChanged?.();
    ctx.navigate(next && next !== 'co-quan' ? `#${next}` : '#dashboard');
  });
}
