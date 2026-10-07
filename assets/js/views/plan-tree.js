// Sơ đồ cây kế hoạch hỏi: Vụ việc → Điều luật (chính, liên quan) → Hành vi / vấn đề theo cấu thành → Câu hỏi,
// kèm nhánh vấn đề chung (Điều 85 BLTTHS) và tài liệu, giám định. Mở / thu gọn từng nhánh, hiệu ứng hiện dần,
// làm nổi đường đi khi rê chuột, tìm trong sơ đồ, phóng to / thu nhỏ, toàn màn hình.
import { $, $$, icon, escapeHtml } from '../ui.js';

const COMMON = ['nhan-than', 'dong-pham', 'tai-lieu', 'tang-nang-giam-nhe', 'loai-tru', 'nguyen-nhan'];

/** Dữ liệu cây từ kế hoạch (generatePlan + lớp chỉnh sửa). */
export function planToTree(plan) {
  const issueNode = (is, kind) => ({
    id: is.key,
    kind,
    label: is.tieuDe.replace(/^\[Điều \d+\w*\]\s*/, '').replace(/^Hành vi:\s*/, ''),
    sub: is.canCu,
    count: is.cauHoi.length,
    jump: is.key,
    children: is.cauHoi.map((c, i) => ({ id: `${is.key}#${i}`, kind: 'q', label: c.text, src: c.src, high: c.priority === 'high', jump: is.key })),
  });
  const crimeNode = (crime, keys, primary) => {
    const its = plan.issues.filter((is) => keys(is.key));
    const acts = its.filter((is) => /(^|:)hv-/.test(is.key));
    const others = its.filter((is) => !/(^|:)hv-/.test(is.key));
    return {
      id: `crime-${crime.dieu}`,
      kind: primary ? 'crime' : 'crime-rel',
      label: `Điều ${crime.dieu}`,
      sub: crime.ten.replace(/^Tội /, ''),
      badge: primary ? 'Điều chính' : 'Liên quan',
      count: its.reduce((s, i) => s + i.cauHoi.length, 0),
      children: [
        ...(acts.length ? [{ id: `acts-${crime.dieu}`, kind: 'group', label: 'Hành vi vi phạm', count: acts.length, children: acts.map((is) => issueNode(is, 'act')) }] : []),
        ...(others.length ? [{ id: `cau-thanh-${crime.dieu}`, kind: 'group', label: 'Cấu thành, định khung, chuyên môn', count: others.length, children: others.map((is) => issueNode(is, 'issue')) }] : []),
      ],
    };
  };
  const common = plan.issues.filter((is) => COMMON.includes(is.key));
  const docs = [...(plan.taiLieu || []).map((t) => ({ t, k: 'Tài liệu' })), ...(plan.giamDinh || []).map((t) => ({ t, k: 'Giám định' }))];
  return {
    id: 'root',
    kind: 'root',
    label: 'Kế hoạch hỏi',
    sub: plan.role.ten.split('/')[0].trim(),
    count: plan.stats?.questions ?? plan.issues.reduce((s, i) => s + i.cauHoi.length, 0),
    children: [
      crimeNode(plan.crime, (k) => !k.includes(':') && !COMMON.includes(k), true),
      ...(plan.lienQuan || []).map((r) => crimeNode(r.crime, (k) => k.startsWith(`d${r.crime.dieu}:`), false)),
      ...(common.length ? [{ id: 'common', kind: 'common', label: 'Vấn đề chung phải chứng minh', sub: 'Điều 85 BLTTHS', count: common.length, children: common.map((is) => issueNode(is, 'issue')) }] : []),
      ...(docs.length ? [{ id: 'docs', kind: 'docs', label: 'Tài liệu, giám định', sub: 'Thu thập, trưng cầu', count: docs.length, children: docs.map((d, i) => ({ id: `doc-${i}`, kind: 'doc', label: d.t, sub: d.k })) }] : []),
    ].filter(Boolean),
  };
}

const KIND_ICON = { root: 'user', crime: 'gavel', 'crime-rel': 'layers', group: 'folder', act: 'zap', issue: 'help', common: 'shield', docs: 'clipboard', doc: 'file' };

function nodeHtml(n, depth, open, idx) {
  const kids = n.children || [];
  const isOpen = open.has(n.id);
  const leaf = !kids.length;
  return `<li class="pt-li pt-${n.kind} ${isOpen ? 'open' : ''} ${leaf ? 'leaf' : ''}" data-node="${escapeHtml(n.id)}" style="--i:${idx}">
    <div class="pt-node" ${leaf ? '' : `role="button" tabindex="0" aria-expanded="${isOpen}"`} ${n.jump && n.kind !== 'q' ? `data-jump-key="${escapeHtml(n.jump)}"` : ''} title="${escapeHtml(n.kind === 'q' ? n.label : `${n.label}${n.sub ? ` — ${n.sub}` : ''}`)}">
      ${n.kind === 'q' ? `<span class="pt-dot ${n.high ? 'hi' : ''}"></span>` : KIND_ICON[n.kind] ? icon(KIND_ICON[n.kind], 'ic-sm') : ''}
      <span class="pt-text"><span class="pt-label">${escapeHtml(n.label)}</span>${n.sub ? `<small>${escapeHtml(n.sub)}</small>` : ''}</span>
      ${n.badge ? `<em class="pt-badge">${escapeHtml(n.badge)}</em>` : ''}
      ${n.count != null && !leaf ? `<span class="pt-count">${n.count}</span>` : ''}
      ${!leaf ? `<span class="pt-toggle">${icon('chevron-down', 'ic-sm')}</span>` : ''}
    </div>
    ${leaf ? '' : `<div class="pt-kids"><ul>${isOpen ? kids.map((k, i) => nodeHtml(k, depth + 1, open, i)).join('') : ''}</ul></div>`}
  </li>`;
}

/**
 * Gắn sơ đồ vào host. Trả về { destroy }. onJump(issueKey) khi bấm vào vấn đề / câu hỏi (chuyển sang tab câu hỏi).
 */
export function mountPlanTree(host, plan, { onJump, initialOpen } = {}) {
  const tree = planToTree(plan);
  const byId = new Map();
  const parent = new Map();
  (function index(n, p) {
    byId.set(n.id, n);
    if (p) parent.set(n.id, p.id);
    (n.children || []).forEach((c) => index(c, n));
  })(tree, null);
  // Mặc định mở: gốc, các điều luật, nhóm hành vi.
  const open = new Set(initialOpen || ['root', ...tree.children.filter((c) => /crime/.test(c.kind)).map((c) => c.id), ...tree.children.flatMap((c) => (c.children || []).filter((g) => g.id.startsWith('acts-')).map((g) => g.id))]);
  let zoom = 1;

  host.innerHTML = `<div class="pt-wrap" data-pt>
    <div class="pt-toolbar">
      <div class="pt-search">${icon('search', 'ic-sm')}<input type="search" placeholder="Tìm trong sơ đồ…" aria-label="Tìm trong sơ đồ" data-pt-q /></div>
      <button class="btn btn-ghost btn-sm" type="button" data-pt-all>${icon('layers', 'ic-sm')}Mở rộng tất cả</button>
      <button class="btn btn-ghost btn-sm" type="button" data-pt-none>${icon('chevron-left', 'ic-sm')}Thu gọn</button>
      <span class="spacer"></span>
      <button class="btn btn-ghost btn-sm btn-icon" type="button" data-pt-zoom="-1" aria-label="Thu nhỏ">${icon('zoom-out', 'ic-sm')}</button>
      <button class="btn btn-ghost btn-sm btn-icon" type="button" data-pt-zoom="1" aria-label="Phóng to">${icon('zoom-in', 'ic-sm')}</button>
      <button class="btn btn-ghost btn-sm btn-icon" type="button" data-pt-full aria-label="Toàn màn hình">${icon('panel', 'ic-sm')}</button>
    </div>
    <div class="pt-legend">
      <span class="lg-k pt-k-crime">Điều chính</span><span class="lg-k pt-k-rel">Điều liên quan</span><span class="lg-k pt-k-act">Hành vi</span><span class="lg-k pt-k-issue">Vấn đề</span><span class="lg-k pt-k-q">Câu hỏi <i class="pt-dot hi"></i> quan trọng</span>
      <small>Bấm vào nút để mở / thu gọn · bấm câu hỏi để đến bộ câu hỏi</small>
    </div>
    <div class="pt-viewport" data-pt-view><div class="pt-canvas" data-pt-canvas><ul class="pt-tree" data-pt-tree></ul></div></div>
  </div>`;
  const wrap = $('[data-pt]', host);
  const treeEl = $('[data-pt-tree]', host);
  const canvas = $('[data-pt-canvas]', host);
  let query = '';

  const draw = (animateFrom = null) => {
    treeEl.innerHTML = nodeHtml(tree, 0, open, 0);
    // Chỉ nhánh vừa mở có hiệu ứng hiện dần; các nhánh khác hiện ngay.
    $$('.pt-li', treeEl).forEach((li) => li.classList.add('shown'));
    if (animateFrom) {
      const li = treeEl.querySelector(`[data-node="${CSS.escape(animateFrom)}"]`);
      li?.querySelectorAll(':scope > .pt-kids > ul > .pt-li').forEach((c) => {
        c.classList.remove('shown');
        c.classList.add('enter');
      });
    } else if (animateFrom === null && !draw.done) {
      $$('.pt-li', treeEl).forEach((li, i) => {
        li.classList.remove('shown');
        li.classList.add('enter');
        li.style.setProperty('--i', Math.min(i, 40));
      });
      draw.done = true;
    }
    if (query) highlight();
  };
  const toggle = (id) => {
    if (open.has(id)) {
      open.delete(id);
      draw(false);
    } else {
      open.add(id);
      draw(id);
      // Đưa nhánh vừa mở vào tầm nhìn (cây rộng theo chiều ngang).
      requestAnimationFrame(() => treeEl.querySelector(`[data-node="${CSS.escape(id)}"] > .pt-kids .pt-li`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }));
    }
  };
  const ancestors = (id) => {
    const out = [];
    for (let p = parent.get(id); p; p = parent.get(p)) out.push(p);
    return out;
  };
  function highlight() {
    $$('.pt-li.hit, .pt-li.path', treeEl).forEach((x) => x.classList.remove('hit', 'path'));
    if (!query) return;
    const q = query.toLowerCase();
    $$('.pt-li', treeEl).forEach((li) => {
      const n = byId.get(li.dataset.node);
      if (n && `${n.label} ${n.sub || ''}`.toLowerCase().includes(q)) li.classList.add('hit');
    });
  }

  treeEl.addEventListener('click', (e) => {
    const node = e.target.closest('.pt-node');
    if (!node) return;
    const li = node.parentElement;
    const n = byId.get(li.dataset.node);
    if (!n) return;
    if (n.kind === 'q' && n.jump) return onJump?.(n.jump, n.label);
    if (n.children?.length) toggle(n.id);
  });
  treeEl.addEventListener('dblclick', (e) => {
    const node = e.target.closest('[data-jump-key]');
    if (node) onJump?.(node.dataset.jumpKey);
  });
  treeEl.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.pt-node[role="button"]')) {
      e.preventDefault();
      toggle(e.target.parentElement.dataset.node);
      treeEl.querySelector(`[data-node="${CSS.escape(e.target.parentElement.dataset.node)}"] > .pt-node`)?.focus();
    }
  });
  // Rê chuột: làm nổi đường đi từ gốc tới nút.
  treeEl.addEventListener('mouseover', (e) => {
    const li = e.target.closest('.pt-li');
    $$('.pt-li.trail', treeEl).forEach((x) => x.classList.remove('trail'));
    if (!li) return;
    li.classList.add('trail');
    ancestors(li.dataset.node).forEach((id) => treeEl.querySelector(`[data-node="${CSS.escape(id)}"]`)?.classList.add('trail'));
  });
  treeEl.addEventListener('mouseleave', () => $$('.pt-li.trail', treeEl).forEach((x) => x.classList.remove('trail')));

  $('[data-pt-all]', host).addEventListener('click', () => {
    byId.forEach((n, id) => n.children?.length && open.add(id));
    draw(false);
  });
  $('[data-pt-none]', host).addEventListener('click', () => {
    open.clear();
    open.add('root');
    draw(false);
  });
  $('[data-pt-q]', host).addEventListener('input', (e) => {
    query = e.target.value.trim();
    if (query) {
      // Mở các nhánh chứa kết quả.
      const q = query.toLowerCase();
      byId.forEach((n, id) => {
        if (`${n.label} ${n.sub || ''}`.toLowerCase().includes(q)) ancestors(id).forEach((a) => open.add(a));
      });
      draw(false);
      treeEl.querySelector('.pt-li.hit')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    } else highlight();
  });
  $$('[data-pt-zoom]', host).forEach((b) =>
    b.addEventListener('click', () => {
      zoom = Math.max(0.6, Math.min(1.6, zoom + +b.dataset.ptZoom * 0.15));
      canvas.style.setProperty('--zoom', zoom);
    }),
  );
  $('[data-pt-full]', host).addEventListener('click', () => {
    wrap.classList.toggle('full');
    document.body.classList.toggle('pt-fullscreen', wrap.classList.contains('full'));
  });
  const onKey = (e) => e.key === 'Escape' && wrap.classList.contains('full') && (wrap.classList.remove('full'), document.body.classList.remove('pt-fullscreen'));
  document.addEventListener('keydown', onKey);

  draw(null);
  return {
    destroy() {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('pt-fullscreen');
    },
    open,
  };
}
