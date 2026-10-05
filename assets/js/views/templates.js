// Thư viện mẫu văn bản với ảnh xem trước thu nhỏ.
import { icon, escapeHtml } from '../ui.js';
import { DOC_TYPES, buildDocument, sampleValues } from '../lib/doc-types.js';
import { renderDocumentHtml } from '../lib/render-html.js';
import { isoToday } from '../lib/vn-date.js';
import { store } from '../lib/store.js';
import { customTemplates } from './tpl.js';

export function render(ctx) {
  const today = isoToday();
  ctx.view.innerHTML = `
  <div class="page">
    <div class="page-head">
      <div><h1 class="page-title">Thư viện <em>mẫu văn bản</em></h1><p class="page-sub">Tám loại văn bản hành chính theo Phụ lục I, Nghị định 30/2020/NĐ-CP — hoặc tải file Word của bạn lên để tạo mẫu riêng.</p></div>
      <a class="btn btn-primary" href="#tpl/new" data-new-tpl>${icon('upload', 'ic-sm')}Tạo mẫu từ file Word</a>
    </div>
    <section class="tpl-mine" data-mine></section>
    <h2 class="section-label">Mẫu chuẩn theo Nghị định 30/2020/NĐ-CP</h2>
    <div class="tpl-grid">
      ${DOC_TYPES.map(
        (t) => `
        <article class="tpl-card">
          <div class="tpl-thumb" aria-hidden="true">${renderDocumentHtml(buildDocument(t.id, sampleValues(t.id, today)))}</div>
          <div class="tpl-card-body">
            <h3>${icon(t.icon, 'ic-sm')}${escapeHtml(t.name)}${t.abbr ? ` <span class="badge">${t.abbr}</span>` : ''}</h3>
            <p>${escapeHtml(t.tagline)}</p>
            <div class="inline">
              <button class="btn btn-primary btn-sm" type="button" data-use="${t.id}">${icon('wand', 'ic-sm')}Dùng mẫu này</button>
              <a class="btn btn-sm" href="#compose/${t.id}">Bản trống</a>
            </div>
          </div>
        </article>`,
      ).join('')}
    </div>
  </div>`;

  function renderMine() {
    const mine = customTemplates.list();
    const host = ctx.view.querySelector('[data-mine]');
    host.innerHTML = mine.length
      ? `<h2 class="section-label">Mẫu của tôi <span class="badge">${mine.length}</span></h2>
        <div class="tpl-mine-grid">${mine
          .map(
            (t) => `<article class="tpl-mine-card" data-tid="${t.id}">
              <span class="quick-icon">${icon('file')}</span>
              <div><h3>${escapeHtml(t.ten)}</h3><p>${escapeHtml(t.moTa || t.fileName || '')}</p><small>${(t.fields || []).length} trường cần điền · ${Math.max(1, Math.round((t.size || 0) / 1024))} KB</small></div>
              <div class="inline"><a class="btn btn-primary btn-sm" href="#tpl/${t.id}">${icon('wand', 'ic-sm')}Dùng mẫu</a><button class="btn btn-ghost btn-sm btn-icon" type="button" data-del-tpl aria-label="Xóa mẫu ${escapeHtml(t.ten)}">${icon('trash', 'ic-sm')}</button></div>
            </article>`,
          )
          .join('')}</div>`
      : `<a class="tpl-mine-empty" href="#tpl/new">${icon('upload')}<span><strong>Tạo mẫu từ file Word của bạn</strong><small>Tải lên .docx → AI chắt lọc các trường cần điền → xem trước → lưu dùng lại</small></span></a>`;
  }
  renderMine();

  ctx.view.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del-tpl]');
    if (del) {
      const t = customTemplates.get(del.closest('[data-tid]').dataset.tid);
      if (t && (await ctx.confirm(`Xóa mẫu “${t.ten}”?`, { title: 'Xóa mẫu', okText: 'Xóa', danger: true }))) {
        customTemplates.remove(t.id);
        renderMine();
      }
      return;
    }
    const b = e.target.closest('[data-use]');
    if (!b) return;
    const id = b.dataset.use;
    const org = ctx.settings().org || {};
    store.set('compose-draft', { typeId: id, values: { ...sampleValues(id, today), ...Object.fromEntries(Object.entries(org).filter(([, v]) => v)) }, docId: null });
    ctx.navigate(`#compose/${id}`);
  });
}
