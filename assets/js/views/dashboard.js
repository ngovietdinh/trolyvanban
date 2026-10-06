import { icon, escapeHtml } from '../ui.js';
import { docsRepo, usage } from '../lib/store.js';
import { getDocType } from '../lib/doc-types.js';
import { relativeTime } from '../lib/vn-date.js';
import { deleteWithUndo, repoOps } from '../lib/undo-delete.js';

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

export function render(ctx) {
  const user = ctx.user();
  const docs = docsRepo.list();
  const u = usage.get();
  const name = user ? user.name.split(/\s+/).pop() : '';

  ctx.view.innerHTML = `
  <div class="page">
    <section class="hello">
      <h1>${greeting()}${name ? `, <em>${escapeHtml(name)}</em>` : ''}.</h1>
      <p>Hôm nay bạn cần soạn văn bản gì? Mô tả ngắn gọn, trợ lý sẽ chuẩn bị bản nháp đúng thể thức cho bạn.</p>
      <form class="hello-prompt" data-hello>
        <input name="q" placeholder="VD: Soạn giấy mời họp tổng kết năm vào sáng thứ Sáu…" aria-label="Mô tả văn bản cần soạn" autocomplete="off" />
        <button class="btn btn-primary" type="submit">${icon('sparkles')}Soạn ngay</button>
      </form>
    </section>

    ${ctx.can('legal') ? `<div class="legal-promo">
      <a href="#legal"><span class="quick-icon">${icon('layers')}</span><span><strong>Cây hỏi đáp pháp luật</strong><span>Chọn lĩnh vực → tội danh → hành vi để sinh bộ vấn đề cần làm rõ và câu hỏi theo BLHS.</span></span></a>
      <a href="#interview"><span class="quick-icon">${icon('message')}</span><span><strong>Ghi lời khai thông minh</strong><span>Ghi hỏi – đáp theo kế hoạch, gợi ý câu hỏi truy tiếp và phát hiện mâu thuẫn.</span></span></a>
    </div>` : ''}

    <div class="quick-grid">
      ${ctx.can('docs') ? `<a class="quick" href="#compose/cong-van"><span class="quick-icon">${icon('mail')}</span><strong>Công văn</strong><span>Trao đổi, đề nghị</span></a>
      <a class="quick" href="#compose/quyet-dinh"><span class="quick-icon">${icon('gavel')}</span><strong>Quyết định</strong><span>Bổ nhiệm, thành lập</span></a>` : ''}
      ${ctx.can('tools') ? `
      <a class="quick" href="#spell"><span class="quick-icon">${icon('spell')}</span><strong>Kiểm tra chính tả</strong><span>Soát lỗi trong 1 giây</span></a>
      <a class="quick" href="#number"><span class="quick-icon">${icon('hash')}</span><strong>Số thành chữ</strong><span>Chuẩn chứng từ</span></a>` : ''}
    </div>

    <div class="dash-grid">
      <section class="panel">
        <div class="panel-head"><h2>${icon('clock', 'ic-sm')}Tài liệu gần đây</h2><a class="btn btn-ghost btn-sm" href="#docs">Xem tất cả</a></div>
        ${
          docs.length
            ? `<ul class="doc-list">${docs.slice(0, 6).map(docRow).join('')}</ul>`
            : `<div class="empty"><div class="empty-icon">${icon('folder', 'ic-lg')}</div><h3>Chưa có tài liệu</h3><p>Văn bản bạn lưu sẽ xuất hiện tại đây.</p><a class="btn btn-primary" href="#compose">${icon('plus')}Soạn văn bản đầu tiên</a></div>`
        }
      </section>
      <section class="panel">
        <div class="panel-head"><h2>${icon('chart', 'ic-sm')}Hoạt động của bạn</h2></div>
        <div class="metric-grid">
          <div class="metric"><strong>${docs.length}</strong><span>Tài liệu đã lưu</span></div>
          <div class="metric"><strong>${u.export || 0}</strong><span>Lượt xuất Word</span></div>
          <div class="metric"><strong>${u.spell || 0}</strong><span>Lượt kiểm tra chính tả</span></div>
          <div class="metric"><strong>${(u.ai || 0) + (u.chat || 0)}</strong><span>Lượt dùng trợ lý</span></div>
        </div>
      </section>
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

  ctx.view.querySelector('[data-hello]').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    if (!q) return e.target.q.focus();
    ctx.handoff = { chatPrompt: q };
    ctx.navigate('#chat');
  });
}
