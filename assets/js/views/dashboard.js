import { icon, escapeHtml } from '../ui.js';
import { docsRepo, usage } from '../lib/store.js';
import { getDocType } from '../lib/doc-types.js';
import { relativeTime } from '../lib/vn-date.js';
import { deleteWithUndo, repoOps } from '../lib/undo-delete.js';
import { courtRepo } from '../legal/repo.js';
import { upcoming } from '../legal/court-deadlines.js';
import { fmtDate } from '../legal/court-penalty.js';
import { courtRules } from './toa-an-case.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export function docRow(d) {
  const type = getDocType(d.typeId);
  return `<li class="doc-item">
    <span class="doc-icon" aria-hidden="true">${escapeHtml(type?.abbr || 'CV')}</span>
    <div class="doc-meta">
      <a href="#compose/doc/${d.id}">${escapeHtml(d.title)}</a>
      <small>${escapeHtml(type?.name || 'Văn bản')} · ${relativeTime(d.updatedAt)}</small>
    </div>
    <button class="btn btn-ghost btn-sm btn-icon" type="button" data-del-doc="${d.id}" aria-label="Xóa “${escapeHtml(d.title)}”" title="Xóa">${icon('trash', 'ic-sm')}</button>
  </li>`;
}

const THU = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const todayLong = (d = new Date()) => `${THU[d.getDay()]}, ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
const shortcut = (href, ic, title, sub) => `<a class="sc-row" href="${href}">${icon(ic, 'ic-sm')}<span><strong>${title}</strong><small>${sub}</small></span></a>`;
const conHan = (n) => (n < 0 ? `quá ${-n} ngày` : n === 0 ? 'hôm nay' : `còn ${n} ngày`);

/** Thời hạn Tòa án gần nhất (chỉ khi tài khoản có hồ sơ xét xử). */
function courtSoon() {
  const list = courtRepo.list();
  if (!list.length) return '';
  const todo = upcoming(list, { rules: courtRules() }).filter((x) => x.trangThai !== 'moc').slice(0, 5);
  return `<section class="panel dash-court">
    <div class="panel-head"><h2>Thời hạn Tòa án sắp tới</h2><a class="btn btn-ghost btn-sm" href="#toa-an">Sổ vụ án</a></div>
    ${
      todo.length
        ? `<ul class="dash-dl">${todo
            .map((it) => `<li><b class="num">${fmtDate(it.han).slice(0, 5)}</b><a href="#toa-an/${it.rec.id}/vu-an">${escapeHtml(it.ten)}<small>${escapeHtml(it.rec.ten || '')}${it.rec.thuLy?.so ? `, thụ lý số ${escapeHtml(it.rec.thuLy.so)}` : ''}</small></a><span class="badge ${it.trangThai === 'qua-han' ? 'badge-danger' : it.trangThai === 'sap' ? 'badge-warning' : ''}">${conHan(it.con)}</span></li>`)
            .join('')}</ul>`
        : '<p class="dash-none">Không có thời hạn nào đang chạy. Nhập ngày thụ lý trong hồ sơ để theo dõi.</p>'
    }
  </section>`;
}

export function render(ctx) {
  const user = ctx.user();
  const docs = docsRepo.list();
  const u = usage.get();
  const name = user ? user.name.split(/\s+/).pop() : '';

  ctx.view.innerHTML = `
  <div class="page dash">
    <section class="hello">
      <div><h1>${greeting()}${name ? `, ${escapeHtml(name)}` : ''}</h1><p class="page-sub">${todayLong()}</p></div>
      ${
        ctx.can('docs')
          ? `<form class="hello-prompt" data-hello>
        <label for="hello-q">Cần soạn văn bản gì? Mô tả ngắn, trợ lý chuẩn bị bản nháp đúng thể thức.</label>
        <div class="hello-row"><input class="input" id="hello-q" name="q" placeholder="VD: Soạn giấy mời họp tổng kết năm vào sáng thứ Sáu" autocomplete="off" /><button class="btn btn-primary" type="submit">${icon('sparkles', 'ic-sm')}Soạn ngay</button></div>
      </form>`
          : ''
      }
    </section>

    <div class="dash-grid">
      <div class="dash-main">
        ${ctx.can('legal') ? courtSoon() : ''}
        <section class="panel">
          <div class="panel-head"><h2>Tài liệu gần đây</h2><a class="btn btn-ghost btn-sm" href="#docs">Xem tất cả</a></div>
          ${
            docs.length
              ? `<ul class="doc-list">${docs.slice(0, 6).map(docRow).join('')}</ul>`
              : `<div class="empty"><div class="empty-icon">${icon('folder', 'ic-lg')}</div><h3>Chưa có tài liệu</h3><p>Văn bản bạn lưu sẽ xuất hiện tại đây.</p>${ctx.can('docs') ? `<a class="btn btn-primary" href="#compose">${icon('plus')}Soạn văn bản đầu tiên</a>` : ''}</div>`
          }
        </section>
      </div>
      <div class="dash-side">
        <section class="panel">
          <div class="panel-head"><h2>Lối tắt</h2></div>
          <div class="sc-list">
            ${ctx.can('docs') ? `${shortcut('#compose/cong-van', 'mail', 'Công văn', 'Trao đổi, đề nghị, hướng dẫn')}${shortcut('#compose/quyet-dinh', 'gavel', 'Quyết định', 'Bổ nhiệm, thành lập, ban hành')}${shortcut('#templates', 'file', 'Thư viện mẫu', 'Mẫu theo Phụ lục I, Nghị định 30/2020')}` : ''}
            ${ctx.can('legal') ? `<div class="legal-promo">${shortcut('#toa-an', 'gavel', 'Tòa án', 'Sổ vụ án, thẩm tra, biểu mẫu')}${shortcut('#legal', 'layers', 'Cây hỏi đáp pháp luật', 'Lĩnh vực, tội danh, vấn đề cần làm rõ')}${shortcut('#interview', 'message', 'Ghi lời khai', 'Hỏi theo kế hoạch, phát hiện mâu thuẫn')}</div>` : ''}
            ${ctx.can('tools') ? `${shortcut('#spell', 'spell', 'Kiểm tra chính tả', 'Soát lỗi tiếng Việt, từ điển riêng')}${shortcut('#number', 'hash', 'Số thành chữ', 'Đọc số tiền cho chứng từ')}` : ''}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Hoạt động của bạn</h2></div>
          <div class="metric-grid">
            <div class="metric"><strong>${docs.length}</strong><span>Tài liệu đã lưu</span></div>
            <div class="metric"><strong>${u.export || 0}</strong><span>Lượt xuất Word</span></div>
            <div class="metric"><strong>${u.spell || 0}</strong><span>Lượt kiểm tra chính tả</span></div>
            <div class="metric"><strong>${(u.ai || 0) + (u.chat || 0)}</strong><span>Lượt dùng trợ lý</span></div>
          </div>
        </section>
      </div>
    </div>
  </div>`;

  ctx.view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-del-doc]');
    if (!b) return;
    const d = docsRepo.get(b.dataset.delDoc);
    deleteWithUndo(ctx, {
      title: 'Xóa văn bản',
      message: `Xóa “${d?.title}” khỏi Tài liệu của tôi? Có thể hoàn tác ngay sau khi xóa.`,
      items: [{ item: d, ...repoOps(docsRepo) }],
      after: () => {
        document.dispatchEvent(new CustomEvent('docs-changed'));
        render(ctx);
      },
    });
  });

  ctx.view.querySelector('[data-hello]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    if (!q) return e.target.q.focus();
    ctx.handoff = { chatPrompt: q };
    ctx.navigate('#chat');
  });
}
