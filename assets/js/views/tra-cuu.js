// Trang "Tra cứu": một ô tìm cho mọi dữ liệu trên máy — trang đầu khi dùng điện thoại (điện thoại chủ yếu để xem, tìm).
import { $, $$, icon, escapeHtml, debounce } from '../ui.js';
import { docsRepo } from '../lib/store.js';
import { casesRepo, recordsRepo, plansRepo, legalDocsRepo, courtRepo } from '../legal/repo.js';
import { currentAgency } from '../lib/agency.js';
import { getRole } from '../legal/roles.js';
import { ALL_CRIMES } from '../legal/engine.js';
import { FORMS } from '../legal/forms-catalog.js';
import { getDocType } from '../lib/doc-types.js';
import { searchAll, foldKeep, tokens, matchAt, GROUPS } from '../lib/universal-search.js';
import { loadBook } from '../legal/binh-luan-store.js';

let lastQ = '';
let lastFilter = 'all';

/** Tô sáng các từ khóa (không dấu) trong chuỗi, trả HTML đã thoát. */
function mark(text, toks) {
  const chars = [...String(text || '')];
  const f = foldKeep(text);
  const hit = new Array(chars.length).fill(false);
  for (const t of toks) for (const i of matchAt(f, t)) for (let k = i; k < i + t.length; k++) hit[k] = true;
  let out = '';
  let open = false;
  chars.forEach((c, i) => {
    if (hit[i] && !open) (out += '<mark>'), (open = true);
    if (!hit[i] && open) (out += '</mark>'), (open = false);
    out += escapeHtml(c);
  });
  return open ? `${out}</mark>` : out;
}

const relDate = (t) => (t ? new Date(t).toLocaleDateString('vi-VN') : '');

export function render(ctx, params = []) {
  const root = ctx.view;
  const legal = ctx.can('legal');
  const docsOk = ctx.can('docs');
  // Tòa án: tìm trong văn bản, điều luật, bình luận; dữ liệu điều tra (hồ sơ, biên bản, kho…) thuộc Cơ quan điều tra.
  const police = legal && currentAgency() !== 'toa-an';
  const src = {
    roleName: (id) => getRole(id).ten.split('/')[0].trim(),
    formName: (id) => getDocType(id)?.name || '',
    cases: police ? casesRepo.list() : [],
    records: police ? recordsRepo.list() : [],
    plans: police ? plansRepo.list() : [],
    ldocs: police ? legalDocsRepo.list() : [],
    docs: docsOk ? docsRepo.list() : [],
    crimes: legal ? ALL_CRIMES : [],
    forms: police ? FORMS : [],
    kho: [],
    mauForms: [],
    book: null,
  };
  if (params[0]) lastQ = decodeURIComponent(params[0]);
  const COURT_GROUPS = ['docs', 'crimes', 'binhluan'];
  const filters = [['all', 'Tất cả'], ...GROUPS.filter((g) => (police ? true : legal ? COURT_GROUPS.includes(g.id) : g.id === 'docs')).map((g) => [g.id, g.label.replace(/ \(.*\)$/, '')])];
  const court = legal && currentAgency() === 'toa-an';
  const courtCases = court ? courtRepo.list() : [];
  const tiles = court ? [
    ['#toa-an', 'folder', 'Sổ vụ án', `${courtCases.length} hồ sơ xét xử`],
    ['#toa-an/kho-ban-an', 'book', 'Kho bản án, án lệ', 'Bản án tương tự'],
    ['#toa-an/bieu-mau', 'clipboard', 'Biểu mẫu Tòa án', 'Mẫu soạn sẵn'],
    ['#binh-luan', 'book', 'Bình luận BLHS', 'Đọc từng điều'],
    ['#legal', 'layers', 'Cây hỏi đáp', 'Tội danh, cấu thành'],
    docsOk && ['#docs', 'file', 'Tài liệu của tôi', `${src.docs.length} văn bản`],
  ].filter(Boolean) : [
    legal && ['#cases', 'folder', 'Hồ sơ vụ án', `${src.cases.length} hồ sơ`],
    legal && ['#binh-luan', 'book', 'Bình luận BLHS', 'Đọc từng điều'],
    legal && ['#forms', 'clipboard', 'Biểu mẫu tố tụng', 'Xem, tìm mẫu'],
    legal && ['#legal', 'layers', 'Cây hỏi đáp', 'Tội danh, cấu thành'],
    legal && ['#interview', 'message', 'Biên bản', `${src.records.length} biên bản`],
    legal && ['#kho', 'sparkles', 'Kho hồ sơ', 'Tài liệu đã nạp'],
    docsOk && ['#docs', 'file', 'Tài liệu của tôi', `${src.docs.length} văn bản`],
    docsOk && ['#templates', 'grid', 'Thư viện mẫu', 'Mẫu văn bản'],
  ].filter(Boolean);

  root.innerHTML = `<div class="page tc-page">
    <h1 class="tc-title">Tra cứu</h1>
    <label class="tc-search">${icon('search')}<input type="search" class="input" enterkeyhint="search" autocomplete="off" placeholder="Tên người, vụ án, nội dung lời khai, số điều, mẫu…" value="${escapeHtml(lastQ)}" data-tc-q aria-label="Tra cứu mọi dữ liệu" /></label>
    <div class="tc-filters" role="tablist" aria-label="Lọc kết quả">${filters.map(([id, l]) => `<button type="button" role="tab" class="chip ${id === lastFilter ? 'on' : ''}" data-tc-f="${id}" aria-selected="${id === lastFilter}">${escapeHtml(l)}</button>`).join('')}</div>
    <div class="tc-out" data-tc-out aria-live="polite"></div>
  </div>`;
  const out = $('[data-tc-out]', root);
  const input = $('[data-tc-q]', root);

  function homeHtml() {
    const recentCases = src.cases.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 4);
    const recentRecs = src.records.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 4);
    const recentDocs = src.docs.slice(0, 4);
    const list = (title, ic, items) =>
      items.length
        ? `<section class="tc-group"><h2>${icon(ic, 'ic-sm')}${title}</h2><ul class="tc-list">${items.map((x) => `<li><a href="${x.href}"><strong>${escapeHtml(x.title)}</strong>${x.sub ? `<small>${escapeHtml(x.sub)}</small>` : ''}</a></li>`).join('')}</ul></section>`
        : '';
    return `<nav class="tc-tiles" aria-label="Mở nhanh">${tiles.map(([h, ic, l, s]) => `<a class="tc-tile" href="${h}">${icon(ic)}<strong>${l}</strong><small>${escapeHtml(s)}</small></a>`).join('')}</nav>
      ${court ? list('Hồ sơ xét xử gần đây', 'folder', courtCases.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 4).map((c) => ({ title: c.ten || 'Hồ sơ xét xử', sub: [c.thuLy?.so ? `Thụ lý số ${c.thuLy.so}` : '', relDate(c.updatedAt)].filter(Boolean).join(', '), href: `#toa-an/${c.id}` }))) : ''}
      ${court ? '' : list('Hồ sơ gần đây', 'folder', recentCases.map((c) => ({ title: c.ten, sub: [c.soHoSo, relDate(c.updatedAt)].filter(Boolean).join(' · '), href: `#cases/${c.id}` })))}
      ${court ? '' : list('Biên bản gần đây', 'message', recentRecs.map((r) => ({ title: `${r.nguoiKhai?.hoTen || 'Chưa ghi tên'} — lần ${r.lan || 1}`, sub: [src.roleName(r.roleId), r.ngay?.split('-').reverse().join('/')].filter(Boolean).join(' · '), href: `#interview/${r.id}` })))}
      ${list('Văn bản gần đây', 'file', recentDocs.map((d) => ({ title: d.title || '(không tên)', sub: relDate(d.updatedAt), href: `#compose/doc/${d.id}` })))}`;
  }

  const draw = (expand = null) => {
    const q = input.value.trim();
    lastQ = q;
    if (!q) {
      out.innerHTML = homeHtml();
      return;
    }
    const toks = tokens(q);
    const groups = searchAll(q, src, { limit: expand ? 200 : lastFilter === 'all' ? 5 : 60 }).filter((g) => lastFilter === 'all' || g.id === lastFilter);
    if (!groups.length) {
      out.innerHTML = `<p class="tc-empty">${icon('search')}<span>Không tìm thấy “${escapeHtml(q)}”. Thử bỏ bớt từ, gõ không dấu hoặc chỉ gõ tên riêng / số điều.</span></p>`;
      return;
    }
    const total = groups.reduce((s, g) => s + g.total, 0);
    out.innerHTML =
      `<p class="tc-count">${total} kết quả</p>` +
      groups
        .map(
          (g) => `<section class="tc-group"><h2>${icon(g.icon, 'ic-sm')}${escapeHtml(g.label)} <span class="badge">${g.total}</span></h2>
        <ul class="tc-list">${g.items.map((x) => `<li><a href="${x.href}"><strong>${mark(x.title, toks)}</strong>${x.sub ? `<small>${escapeHtml(x.sub)}</small>` : ''}${x.snippet ? `<span class="tc-snip">${mark(x.snippet, toks)}</span>` : ''}</a></li>`).join('')}</ul>
        ${g.total > g.items.length ? `<button type="button" class="btn btn-sm btn-ghost tc-more" data-tc-more="${g.id}">Xem tất cả ${g.total} kết quả ${icon('arrow-right', 'ic-sm')}</button>` : ''}</section>`,
        )
        .join('');
  };

  const run = debounce(() => draw(), 180);
  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      draw();
      input.blur(); // điện thoại: ẩn bàn phím để xem kết quả
    }
  });
  $$('[data-tc-f]', root).forEach((b) =>
    b.addEventListener('click', () => {
      lastFilter = b.dataset.tcF;
      $$('[data-tc-f]', root).forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-selected', String(x === b));
      });
      draw();
    }),
  );
  out.addEventListener('click', (e) => {
    const m = e.target.closest('[data-tc-more]');
    if (!m) return;
    lastFilter = m.dataset.tcMore;
    $$('[data-tc-f]', root).forEach((x) => x.classList.toggle('on', x.dataset.tcF === lastFilter));
    draw(true);
    root.scrollIntoView({ block: 'start' });
  });

  draw();
  if (!matchMedia('(max-width: 760px)').matches) input.focus();
  // Nguồn đọc chậm (IndexedDB): kho tài liệu, gói biểu mẫu chính thức, sách Bình luận — có thì tìm lại.
  (async () => {
    const jobs = [];
    if (legal) {
      if (police) jobs.push(import('../lib/kho-db.js').then((m) => m.khoDb.list()).then((l) => (src.kho = l)).catch(() => {}));
      if (police) jobs.push(import('./forms-mau.js').then((m) => m.loadMauMeta()).then((meta) => (src.mauForms = meta?.forms || [])).catch(() => {}));
      jobs.push(loadBook().then((b) => (src.book = b)).catch(() => {}));
    }
    await Promise.all(jobs);
    if (root.isConnected && input.value.trim()) draw();
  })();
}
