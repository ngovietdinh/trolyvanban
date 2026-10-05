// Thư viện mẫu văn bản với ảnh xem trước thu nhỏ.
import { icon, escapeHtml } from '../ui.js';
import { DOC_TYPES, buildDocument, sampleValues } from '../lib/doc-types.js';
import { renderDocumentHtml } from '../lib/render-html.js';
import { isoToday } from '../lib/vn-date.js';
import { store } from '../lib/store.js';

export function render(ctx) {
  const today = isoToday();
  ctx.view.innerHTML = `
  <div class="page">
    <div class="page-head">
      <div><h1 class="page-title">Thư viện <em>mẫu văn bản</em></h1><p class="page-sub">Tám loại văn bản hành chính theo Phụ lục I, Nghị định 30/2020/NĐ-CP — chọn mẫu để bắt đầu với dữ liệu minh họa.</p></div>
    </div>
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

  ctx.view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-use]');
    if (!b) return;
    const id = b.dataset.use;
    const org = ctx.settings().org || {};
    store.set('compose-draft', { typeId: id, values: { ...sampleValues(id, today), ...Object.fromEntries(Object.entries(org).filter(([, v]) => v)) }, docId: null });
    ctx.navigate(`#compose/${id}`);
  });
}
