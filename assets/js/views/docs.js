// Tài liệu đã lưu: tìm kiếm, lọc, gắn sao, nhân bản, xuất Word, xóa.
import { $, icon, toast, escapeHtml, downloadBlob } from '../ui.js';
import { docsRepo } from '../lib/store.js';
import { DOC_TYPES, getDocType, buildDocument } from '../lib/doc-types.js';
import { buildDocx, safeFileName } from '../lib/docx.js';
import { relativeTime } from '../lib/vn-date.js';
import { deleteWithUndo, repoOps } from '../lib/undo-delete.js';

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();

export function render(ctx) {
  let q = '';
  let type = 'all';

  ctx.view.innerHTML = `
  <div class="page">
    <div class="page-head">
      <div><h1 class="page-title">Tài liệu <em>của tôi</em></h1><p class="page-sub">Lưu trữ trên trình duyệt này. Sao lưu hoặc chuyển thiết bị trong mục Cài đặt.</p></div>
      <a class="btn btn-primary" href="#compose">${icon('plus', 'ic-sm')}Văn bản mới</a>
    </div>
    <div class="toolbar">
      <div class="search-box">${icon('search', 'ic-sm')}<input class="input" type="search" placeholder="Tìm theo tiêu đề hoặc nội dung…" aria-label="Tìm tài liệu" data-q /></div>
      <div class="chips" role="group" aria-label="Lọc theo loại" data-chips></div>
    </div>
    <section class="panel" data-list-wrap></section>
  </div>`;

  const root = ctx.view;

  function renderChips() {
    const all = docsRepo.list();
    const counts = all.reduce((a, d) => ((a[d.typeId] = (a[d.typeId] || 0) + 1), a), {});
    const starred = all.filter((d) => d.starred).length;
    const chips = [['all', `Tất cả (${all.length})`], ...(starred ? [['starred', `★ Gắn sao (${starred})`]] : []), ...DOC_TYPES.filter((t) => counts[t.id]).map((t) => [t.id, `${t.name} (${counts[t.id]})`])];
    if (!chips.some(([k]) => k === type)) type = 'all';
    $('[data-chips]', root).innerHTML = chips.map(([k, l]) => `<button class="chip" type="button" data-type="${k}" aria-pressed="${type === k}">${escapeHtml(l)}</button>`).join('');
  }

  function renderList() {
    const all = docsRepo.list();
    const nq = norm(q);
    const items = all.filter((d) => (type === 'all' || (type === 'starred' ? d.starred : d.typeId === type)) && (!nq || norm(d.title + ' ' + d.text).includes(nq)));
    const wrap = $('[data-list-wrap]', root);
    if (!all.length) {
      wrap.innerHTML = `<div class="empty"><div class="empty-icon">${icon('folder', 'ic-lg')}</div><h3>Chưa có tài liệu nào</h3><p>Soạn và nhấn “Lưu văn bản” để lưu trữ tại đây.</p><a class="btn btn-primary" href="#compose">${icon('plus')}Soạn văn bản</a></div>`;
      return;
    }
    if (!items.length) {
      wrap.innerHTML = `<div class="empty"><div class="empty-icon">${icon('search', 'ic-lg')}</div><h3>Không tìm thấy</h3><p>Thử từ khóa khác hoặc bỏ bộ lọc.</p></div>`;
      return;
    }
    wrap.innerHTML = `<ul class="doc-list">${items
      .map((d) => {
        const t = getDocType(d.typeId);
        return `<li class="doc-item" data-id="${d.id}">
          <span class="doc-icon" aria-hidden="true">${escapeHtml(t?.abbr || 'CV')}</span>
          <div class="doc-meta"><a href="#compose/doc/${d.id}">${escapeHtml(d.title)}</a><small>${escapeHtml(t?.name || '')} · Cập nhật ${relativeTime(d.updatedAt)}</small></div>
          <div class="doc-actions">
            <button class="btn btn-ghost btn-sm btn-icon ${d.starred ? 'star-on' : ''}" type="button" data-act="star" aria-label="${d.starred ? 'Bỏ gắn sao' : 'Gắn sao'}" aria-pressed="${!!d.starred}">${icon('star', 'ic-sm')}</button>
            <button class="btn btn-ghost btn-sm btn-icon" type="button" data-act="dup" aria-label="Nhân bản">${icon('copy', 'ic-sm')}</button>
            <button class="btn btn-ghost btn-sm btn-icon" type="button" data-act="export" aria-label="Xuất Word">${icon('download', 'ic-sm')}</button>
            <button class="btn btn-ghost btn-sm btn-icon" type="button" data-act="del" aria-label="Xóa">${icon('trash', 'ic-sm')}</button>
          </div>
        </li>`;
      })
      .join('')}</ul>`;
  }

  const changed = () => {
    document.dispatchEvent(new CustomEvent('docs-changed'));
    renderChips();
    renderList();
  };

  $('[data-q]', root).addEventListener('input', (e) => {
    q = e.target.value;
    renderList();
  });
  root.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-type]');
    if (chip) {
      type = chip.dataset.type;
      renderChips();
      renderList();
      return;
    }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('[data-id]').dataset.id;
    const d = docsRepo.get(id);
    if (!d) return;
    switch (btn.dataset.act) {
      case 'star':
        docsRepo.toggleStar(id);
        changed();
        break;
      case 'dup': {
        const { id: _omit, createdAt, updatedAt, starred, ...rest } = d;
        docsRepo.save({ ...rest, title: `${d.title} (bản sao)` });
        changed();
        toast('Đã nhân bản tài liệu');
        break;
      }
      case 'export':
        downloadBlob(buildDocx(buildDocument(d.typeId, d.values), d.title), safeFileName(d.title), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        toast('Đã xuất tệp Word');
        break;
      case 'del':
        await deleteWithUndo(ctx, {
          title: 'Xóa tài liệu',
          message: `Xóa “${d.title}”? Có thể hoàn tác ngay sau khi xóa.`,
          items: [{ item: d, ...repoOps(docsRepo) }],
          after: changed,
        });
        break;
    }
  });

  renderChips();
  renderList();
}
