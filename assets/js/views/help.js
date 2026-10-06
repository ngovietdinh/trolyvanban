// Trung tâm hướng dẫn: danh mục theo nhóm, tìm kiếm, lộ trình làm quen và trang hướng dẫn chi tiết từng mục.
import { $, $$, icon, escapeHtml, debounce } from '../ui.js';
import { GROUPS, findGuide, visibleGuides, searchGuides, inline } from '../guide/guides.js';
import { mobilePanes } from '../lib/panes.js';
import { guideBodyHtml, bindGuide, isSeen, setSeen, seenMap } from '../guide/render.js';

// Thứ tự gợi ý cho người mới.
const PATH = ['batdau', 'settings', 'compose', 'quytrinh', 'cases', 'legal', 'interview', 'kho', 'forms'];

export function render(ctx, params = []) {
  const guides = visibleGuides(ctx.can);
  let current = params[0] && guides.some((g) => g.id === params[0]) ? findGuide(params[0]) : null;
  let q = '';

  ctx.view.innerHTML = `
  <div class="help">
    <aside class="help-side" aria-label="Danh mục hướng dẫn">
      <div class="lg-search">${icon('search', 'ic-sm')}<input type="search" placeholder="Tìm hướng dẫn: xuất Word, mâu thuẫn…" aria-label="Tìm hướng dẫn" data-q /></div>
      <div class="help-progress" data-progress></div>
      <nav class="help-nav" data-nav></nav>
    </aside>
    <section class="help-main" data-main tabindex="-1"></section>
  </div>`;
  const root = ctx.view;
  const nav = $('[data-nav]', root);
  const main = $('[data-main]', root);
  mobilePanes($('.help', root), [
    { id: 'side', el: $('.help-side', root), label: 'Danh mục', icon: 'layers' },
    { id: 'main', el: main, label: current ? 'Nội dung' : 'Trang chủ', icon: 'book' },
  ], { initial: 'main' });

  function renderProgress() {
    const seen = seenMap();
    const n = guides.filter((g) => seen[g.id]).length;
    const pct = Math.round((n / guides.length) * 100);
    $('[data-progress]', root).innerHTML = `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ đọc hướng dẫn"><span style="width:${pct}%"></span></div><small>Đã nắm ${n}/${guides.length} hướng dẫn</small>`;
  }

  function renderNav() {
    const list = q ? searchGuides(q, guides) : guides;
    if (!list.length) {
      nav.innerHTML = `<p class="lg-empty">Không tìm thấy hướng dẫn phù hợp. Thử từ khóa khác, ví dụ “Word”, “AI”, “biên bản”.</p>`;
      return;
    }
    const item = (g) =>
      `<a href="#help/${g.id}" class="help-link ${current?.id === g.id ? 'active' : ''}" ${current?.id === g.id ? 'aria-current="page"' : ''}>${icon(g.icon, 'ic-sm')}<span>${escapeHtml(g.title)}</span>${isSeen(g.id) ? `<span class="help-done" title="Đã nắm" aria-label="Đã nắm">${icon('check', 'ic-sm')}</span>` : ''}</a>`;
    nav.innerHTML = q
      ? `<div class="help-group"><small>Kết quả (${list.length})</small>${list.map(item).join('')}</div>`
      : GROUPS.map((gr) => {
          const items = list.filter((g) => g.group === gr.id);
          return items.length ? `<div class="help-group"><small>${gr.ten}</small>${items.map(item).join('')}</div>` : '';
        }).join('');
  }

  function renderHome() {
    const path = PATH.map(findGuide).filter((g) => g && guides.includes(g));
    const next = path.find((g) => !isSeen(g.id));
    main.innerHTML = `
      <div class="help-home">
        <header class="help-hero">
          <span class="quick-icon">${icon('help')}</span>
          <div>
            <h1 class="page-title">Trung tâm <em>hướng dẫn</em></h1>
            <p class="page-sub">Hướng dẫn từng bước, có ví dụ minh họa cho mọi chức năng. Ở bất kỳ màn hình nào, bấm nút ${inline('[[?]]')} trên cùng hoặc phím <kbd class="kbd">F1</kbd> để xem đúng hướng dẫn của màn hình đó.</p>
          </div>
        </header>
        ${
          next
            ? `<section class="panel help-next"><div><small>Gợi ý tiếp theo</small><strong>${escapeHtml(next.title)}</strong><span>${escapeHtml(next.summary)}</span></div><a class="btn btn-primary" href="#help/${next.id}">${icon('arrow-right', 'ic-sm')}Xem hướng dẫn</a></section>`
            : `<p class="note">${icon('check-circle', 'ic-sm')}<span>Bạn đã xem hết lộ trình làm quen. Tra cứu thêm theo nhóm bên dưới khi cần.</span></p>`
        }
        <section class="panel">
          <div class="panel-head"><h2>${icon('layers', 'ic-sm')}Lộ trình làm quen</h2><span class="hint">${path.filter((g) => isSeen(g.id)).length}/${path.length} bước</span></div>
          <ol class="help-path">${path
            .map((g, i) => `<li class="${isSeen(g.id) ? 'done' : ''}"><a href="#help/${g.id}"><span class="gd-num">${isSeen(g.id) ? icon('check', 'ic-sm') : i + 1}</span><span><strong>${escapeHtml(g.title)}</strong><small>${escapeHtml(g.time)} · ${g.steps.length} bước</small></span></a></li>`)
            .join('')}</ol>
        </section>
        ${GROUPS.map((gr) => {
          const items = guides.filter((g) => g.group === gr.id);
          return items.length
            ? `<section class="help-cards-sec"><h2 class="section-label">${gr.ten}</h2><div class="help-cards">${items
                .map((g) => `<a class="help-card" href="#help/${g.id}"><span class="quick-icon">${icon(g.icon)}</span><strong>${escapeHtml(g.title)}</strong><span>${escapeHtml(g.summary)}</span><em>${icon('clock', 'ic-sm')}${escapeHtml(g.time)}${isSeen(g.id) ? ` · ${icon('check', 'ic-sm')}Đã nắm` : ''}</em></a>`)
                .join('')}</div></section>`
            : '';
        }).join('')}
      </div>`;
  }

  function renderGuide(g) {
    const i = guides.indexOf(g);
    const prev = guides[i - 1];
    const next = guides[i + 1];
    const group = GROUPS.find((x) => x.id === g.group);
    main.innerHTML = `
      <article class="gd">
        <nav class="lg-crumbs" aria-label="Đường dẫn"><a href="#help">Hướng dẫn</a> ${icon('chevron-down', 'ic-sm rot')} ${escapeHtml(group.ten)} ${icon('chevron-down', 'ic-sm rot')} <strong>${escapeHtml(g.title)}</strong></nav>
        <header class="gd-head">
          <span class="quick-icon">${icon(g.icon)}</span>
          <div class="gd-head-body">
            <h1>${escapeHtml(g.title)}</h1>
            <p>${escapeHtml(g.summary)}</p>
            <div class="gd-meta"><span>${icon('clock', 'ic-sm')}${escapeHtml(g.time)} đọc</span><span>${icon('check-circle', 'ic-sm')}${g.steps.length} bước</span>${g.examples.length ? `<span>${icon('quote', 'ic-sm')}${g.examples.length} ví dụ</span>` : ''}</div>
          </div>
          <div class="gd-head-actions">
            ${g.route && g.id !== 'batdau' ? `<a class="btn btn-primary" href="${g.route}">${icon('arrow-right', 'ic-sm')}Mở chức năng</a>` : ''}
            <button class="btn" type="button" data-seen aria-pressed="${isSeen(g.id)}">${icon('check', 'ic-sm')}<span data-seen-label>${isSeen(g.id) ? 'Đã nắm' : 'Đánh dấu đã nắm'}</span></button>
          </div>
        </header>
        ${guideBodyHtml(g, { can: ctx.can })}
        <nav class="gd-pager" aria-label="Hướng dẫn trước, sau">
          ${prev ? `<a href="#help/${prev.id}">${icon('chevron-left', 'ic-sm')}<span><small>Trước</small>${escapeHtml(prev.title)}</span></a>` : '<span></span>'}
          ${next ? `<a href="#help/${next.id}" class="next"><span><small>Tiếp theo</small>${escapeHtml(next.title)}</span>${icon('chevron-left', 'ic-sm flip')}</a>` : '<span></span>'}
        </nav>
      </article>`;
    bindGuide(main, g, ctx);
    $('[data-seen]', main).addEventListener('click', (e) => {
      const on = !isSeen(g.id);
      setSeen(g.id, on);
      e.currentTarget.setAttribute('aria-pressed', String(on));
      $('[data-seen-label]', main).textContent = on ? 'Đã nắm' : 'Đánh dấu đã nắm';
      renderNav();
      renderProgress();
      ctx.refreshChrome();
    });
  }

  function show() {
    renderNav();
    renderProgress();
    if (current) renderGuide(current);
    else renderHome();
  }

  $('[data-q]', root).addEventListener(
    'input',
    debounce((e) => {
      q = e.target.value.trim();
      renderNav();
    }, 120),
  );
  $('[data-q]', root).addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = $('.help-link', nav);
    if (first) first.click();
  });
  show();
  if (current) main.focus({ preventScroll: true });
}
