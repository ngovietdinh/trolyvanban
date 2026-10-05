// Cây hỏi đáp pháp luật: lĩnh vực → nhóm → tội danh → hành vi → vấn đề cần làm rõ → bộ câu hỏi (chỉnh sửa được).
import { $, $$, icon, toast, escapeHtml, copyText, downloadBlob, debounce } from '../ui.js';
import { DOMAINS, findCrime, searchCrimes, generatePlan, planToText, SOURCE_LABELS, LEGAL_DISCLAIMER, ALL_CRIMES } from '../legal/engine.js';
import { ROLES, ROLE_GROUPS, getRole } from '../legal/roles.js';
import { buildPlanDocument, newRecord } from '../legal/record.js';
import { casesRepo, plansRepo, recordsRepo, customBank } from '../legal/repo.js';
import { renderDocumentHtml } from '../lib/render-html.js';
import { buildDocx, safeFileName } from '../lib/docx.js';
import { streamClaude, extractJson } from '../lib/ai.js';
import { INVESTIGATOR_SYSTEM } from '../legal/assist.js';
import { store, uid } from '../lib/store.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function render(ctx, params = []) {
  // Trạng thái lựa chọn (ghi nhớ giữa các lần mở).
  const saved = store.get('legal-selection', {});
  let sel = { dieu: null, hanhViIds: [], dinhKhung: [], roleId: 'bi-can', ...saved };
  let editingPlanId = null;
  if (params[0] === 'plan' && params[1]) {
    const p = plansRepo.get(params[1]);
    if (p) {
      sel = { dieu: p.dieu, hanhViIds: p.hanhViIds, dinhKhung: p.dinhKhung, roleId: p.roleId };
      editingPlanId = p.id;
    }
  } else if (params[0] && findCrime(params[0])) {
    if (sel.dieu !== params[0]) sel = { ...sel, dieu: params[0], hanhViIds: [findCrime(params[0]).hanhVi[0].id], dinhKhung: [] };
  }

  // Lớp chỉnh sửa của người dùng áp lên kế hoạch được sinh tự động.
  let overlay = { removed: [], edited: {}, added: {}, ai: {} };
  if (editingPlanId) overlay = plansRepo.get(editingPlanId).overlay || overlay;
  let tab = 'issues';
  const openIssues = new Map(); // key → true/false (người dùng đã mở/đóng)
  let openTree = new Set(store.get('legal-open', ['kinh-te', 'kinh-te/dau-thau']));
  let plan = null;

  ctx.view.innerHTML = `
  <div class="legal">
    <aside class="lg-side" aria-label="Cây lĩnh vực và tội danh">
      <div class="lg-search">${icon('search', 'ic-sm')}<input type="search" placeholder="Tìm điều luật, tội danh, hành vi…" aria-label="Tìm tội danh" data-q /></div>
      <nav class="lg-tree" data-tree></nav>
    </aside>
    <section class="lg-main" data-main></section>
  </div>`;

  const root = ctx.view;
  const tree = $('[data-tree]', root);
  const main = $('[data-main]', root);

  /* ---------------- Cây bên trái ---------------- */
  function renderTree(q = '') {
    if (q.trim()) {
      const hits = searchCrimes(q);
      tree.innerHTML = hits.length
        ? `<div class="lg-hits">${hits.map((c) => `<button class="lg-leaf ${c.dieu === sel.dieu ? 'active' : ''}" type="button" data-crime="${c.dieu}"><span class="lg-art">Đ.${c.dieu}</span><span>${escapeHtml(c.ten.replace(/^Tội /, ''))}</span></button>`).join('')}</div>`
        : `<p class="lg-empty">Không tìm thấy tội danh phù hợp.</p>`;
      return;
    }
    tree.innerHTML = DOMAINS.map((d) => {
      const dOpen = openTree.has(d.id);
      return `<div class="lg-node lg-domain ${dOpen ? 'open' : ''}">
        <button class="lg-toggle" type="button" data-toggle="${d.id}" aria-expanded="${dOpen}">${icon('chevron-down', 'ic-sm lg-chev')}${icon(d.icon, 'ic-sm')}<span>${d.ten}</span><small>${d.crimes.length}</small></button>
        ${
          dOpen
            ? `<div class="lg-children">${d.groups
                .map((g) => {
                  const key = `${d.id}/${g.id}`;
                  const crimes = d.crimes.filter((c) => c.nhom === g.id);
                  const gOpen = openTree.has(key) || crimes.some((c) => c.dieu === sel.dieu);
                  return `<div class="lg-node lg-group ${gOpen ? 'open' : ''}">
                    <button class="lg-toggle" type="button" data-toggle="${key}" aria-expanded="${gOpen}" title="${escapeHtml(g.moTa)}">${icon('chevron-down', 'ic-sm lg-chev')}<span>${escapeHtml(g.ten)}</span><small>${crimes.length}</small></button>
                    ${gOpen ? `<div class="lg-children">${crimes.map((c) => `<button class="lg-leaf ${c.dieu === sel.dieu ? 'active' : ''}" type="button" data-crime="${c.dieu}" ${c.dieu === sel.dieu ? 'aria-current="true"' : ''}><span class="lg-art">Đ.${c.dieu}</span><span>${escapeHtml(c.ten.replace(/^Tội /, ''))}</span></button>`).join('')}</div>` : ''}
                  </div>`;
                })
                .join('')}</div>`
            : ''
        }
      </div>`;
    }).join('');
  }

  tree.addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (t) {
      const k = t.dataset.toggle;
      openTree.has(k) ? openTree.delete(k) : openTree.add(k);
      store.set('legal-open', [...openTree]);
      renderTree($('[data-q]', root).value);
      return;
    }
    const c = e.target.closest('[data-crime]');
    if (c) selectCrime(c.dataset.crime);
  });
  $('[data-q]', root).addEventListener('input', debounce((e) => renderTree(e.target.value), 120));

  function selectCrime(dieu) {
    const crime = findCrime(dieu);
    sel = { ...sel, dieu, hanhViIds: [crime.hanhVi[0].id], dinhKhung: [] };
    overlay = { removed: [], edited: {}, added: {}, ai: {} };
    editingPlanId = null;
    persistSel();
    history.replaceState(null, '', `#legal/${dieu}`);
    renderTree($('[data-q]', root).value);
    renderMain();
    main.scrollTop = 0;
  }

  const persistSel = () => store.set('legal-selection', sel);

  /* ---------------- Kế hoạch + lớp chỉnh sửa ---------------- */
  function computePlan() {
    const p = generatePlan({ ...sel, custom: customBank.all() });
    for (const is of p.issues) {
      is.cauHoi = is.cauHoi
        .filter((c) => !overlay.removed.includes(c.text))
        .map((c) => (overlay.edited[c.text] ? { ...c, text: overlay.edited[c.text], src: c.src, editedFrom: c.text } : c));
      (overlay.ai[is.key] || []).forEach((t) => is.cauHoi.push({ id: uid(), text: t, src: 'ai', priority: 'normal' }));
      (overlay.added[is.key] || []).forEach((t) => is.cauHoi.push({ id: uid(), text: t, src: 'tuy-chinh', priority: 'high', local: true }));
    }
    p.stats.questions = p.issues.reduce((s, i) => s + i.cauHoi.length, 0);
    return p;
  }

  /* ---------------- Khu chính ---------------- */
  function renderOverview() {
    main.innerHTML = `
      <div class="lg-overview">
        <div class="page-head" style="margin-bottom:18px"><div>
          <h1 class="page-title">Cây hỏi đáp <em>pháp luật</em></h1>
          <p class="page-sub">Chọn lĩnh vực → nhóm → tội danh → hành vi vi phạm. Hệ thống tự liệt kê các vấn đề cần làm rõ và bộ câu hỏi bám sát cấu thành tội phạm.</p>
        </div></div>
        <div class="lg-domains">
          ${DOMAINS.map((d) => `<button class="lg-domain-card" type="button" data-open-domain="${d.id}"><span class="quick-icon">${icon(d.icon)}</span><strong>${d.ten}</strong><span>${escapeHtml(d.moTa)}</span><em>${d.groups.length} nhóm · ${d.crimes.length} tội danh</em></button>`).join('')}
        </div>
        <section class="panel lg-model">
          <div class="panel-head"><h2>${icon('layers', 'ic-sm')}Mô hình kết hợp 4 lớp tri thức</h2></div>
          <div class="lg-layers">
            <div><span>1</span><strong>Luật hình sự</strong><p>Cấu thành tội phạm của ${ALL_CRIMES.length} điều luật: khách thể, chủ thể, mặt khách quan, lỗi; tình tiết định khung; Điều 51, 52.</p></div>
            <div><span>2</span><strong>Luật tố tụng</strong><p>Các vấn đề phải chứng minh (Điều 85 BLTTHS); quyền, nghĩa vụ của từng người tham gia tố tụng.</p></div>
            <div><span>3</span><strong>Nghiệp vụ điều tra</strong><p>Kỹ thuật hỏi 5W1H, làm rõ đồng phạm, dòng tiền, vật chứng, nguyên nhân – điều kiện phạm tội.</p></div>
            <div><span>4</span><strong>Chuyên môn ngành</strong><p>Câu hỏi của chuyên gia tài chính, đấu thầu, xây dựng, ngân hàng, thuế, môi trường, y dược, PCCC…</p></div>
          </div>
        </section>
        <p class="lg-disclaimer">${icon('info', 'ic-sm')}${escapeHtml(LEGAL_DISCLAIMER)}</p>
      </div>`;
    $$('[data-open-domain]', main).forEach((b) =>
      b.addEventListener('click', () => {
        openTree.add(b.dataset.openDomain);
        store.set('legal-open', [...openTree]);
        renderTree();
        tree.querySelector(`[data-toggle="${b.dataset.openDomain}"]`)?.focus();
      }),
    );
  }

  function renderMain() {
    const crime = sel.dieu && findCrime(sel.dieu);
    if (!crime) return renderOverview();
    const domain = DOMAINS.find((d) => d.crimes.some((c) => c.dieu === crime.dieu));
    const group = domain.groups.find((g) => g.id === crime.nhom);
    plan = computePlan();

    main.innerHTML = `
      <nav class="lg-crumbs" aria-label="Đường dẫn">${escapeHtml(domain.ten)} ${icon('chevron-down', 'ic-sm rot')} ${escapeHtml(group.ten)} ${icon('chevron-down', 'ic-sm rot')} <strong>Điều ${crime.dieu}</strong></nav>
      <header class="lg-crime">
        <div class="lg-crime-art">Điều<strong>${crime.dieu}</strong></div>
        <div class="lg-crime-body">
          <h1>${escapeHtml(crime.ten)}</h1>
          <p class="lg-crime-ch">${escapeHtml(crime.chuong)}${crime.phapNhan ? ' · <span class="badge">Pháp nhân thương mại chịu TNHS</span>' : ''}</p>
          <dl class="lg-elements">
            <div><dt>Khách thể</dt><dd>${escapeHtml(crime.khachThe)}</dd></div>
            <div><dt>Chủ thể</dt><dd>${escapeHtml(crime.chuThe)}</dd></div>
            <div><dt>Mặt chủ quan</dt><dd>${escapeHtml(crime.loi)}</dd></div>
          </dl>
          <details class="lg-signs" open><summary>Dấu hiệu định tội cần chứng minh (${crime.dauHieu.length})</summary><ul>${crime.dauHieu.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul></details>
          ${crime.ghiChu ? `<p class="note warn">${icon('alert', 'ic-sm')}<span>${escapeHtml(crime.ghiChu)}</span></p>` : ''}
        </div>
      </header>

      <div class="lg-steps">
        <section class="lg-step">
          <h2><span>1</span>Hành vi vi phạm <small>${sel.hanhViIds.length}/${crime.hanhVi.length} đã chọn</small></h2>
          <div class="lg-acts">${crime.hanhVi.map((h) => `<label class="lg-act ${sel.hanhViIds.includes(h.id) ? 'on' : ''}"><input type="checkbox" data-hv="${h.id}" ${sel.hanhViIds.includes(h.id) ? 'checked' : ''}/><span>${escapeHtml(h.ten)}</span><small>${h.cauHoi.length} câu hỏi đặc thù</small></label>`).join('')}</div>
        </section>
        <section class="lg-step">
          <h2><span>2</span>Tình tiết định khung cần làm rõ <small>tùy chọn</small></h2>
          <div class="chips">${crime.dinhKhung.map((d) => `<button class="chip" type="button" data-dk="${escapeHtml(d)}" aria-pressed="${sel.dinhKhung.includes(d)}">${escapeHtml(d)}</button>`).join('')}</div>
        </section>
        <section class="lg-step">
          <h2><span>3</span>Đối tượng lấy lời khai</h2>
          <div class="lg-roles">${ROLE_GROUPS.map((g) => `<div class="lg-role-group"><small>${escapeHtml(g.ten)}</small><div class="chips">${ROLES.filter((r) => r.nhom === g.id).map((r) => `<button class="chip" type="button" data-role="${r.id}" aria-pressed="${sel.roleId === r.id}">${escapeHtml(r.ten.split('/')[0].trim())}</button>`).join('')}</div></div>`).join('')}</div>
        </section>
      </div>

      <section class="panel lg-result" data-result>
        <div class="lg-result-head">
          <div class="tabs lg-tabs" role="tablist" aria-label="Kết quả">
            <button role="tab" class="tab" data-tab="issues" aria-selected="${tab === 'issues'}">Vấn đề &amp; câu hỏi</button>
            <button role="tab" class="tab" data-tab="map" aria-selected="${tab === 'map'}">Sơ đồ cây</button>
            <button role="tab" class="tab" data-tab="docs" aria-selected="${tab === 'docs'}">Tài liệu &amp; giám định</button>
          </div>
          <div class="lg-stats" data-stats></div>
        </div>
        <div class="lg-actions">
          <button class="btn btn-sm" type="button" data-ai-more title="Gợi ý thêm câu hỏi chuyên sâu bằng AI">${icon('sparkles', 'ic-sm')}AI gợi ý thêm</button>
          <span class="spacer"></span>
          <button class="btn btn-sm btn-ghost" type="button" data-copy-plan>${icon('copy', 'ic-sm')}Sao chép</button>
          <button class="btn btn-sm btn-ghost" type="button" data-preview-plan>${icon('eye', 'ic-sm')}Xem bản in</button>
          <button class="btn btn-sm" type="button" data-export-plan>${icon('download', 'ic-sm')}Xuất Word</button>
          <button class="btn btn-sm" type="button" data-save-plan>${icon('save', 'ic-sm')}${editingPlanId ? 'Cập nhật kế hoạch' : 'Lưu kế hoạch'}</button>
          <button class="btn btn-sm btn-primary" type="button" data-start>${icon('message', 'ic-sm')}Ghi lời khai theo kế hoạch</button>
        </div>
        <div class="lg-tabpanel" data-panel></div>
      </section>
      <p class="lg-disclaimer">${icon('info', 'ic-sm')}${escapeHtml(LEGAL_DISCLAIMER)}</p>`;

    renderStats();
    renderPanel();
    bindMain(crime);
  }

  function renderStats() {
    $('[data-stats]', main).innerHTML = `<span><strong>${plan.issues.length}</strong> vấn đề</span><span><strong>${plan.stats.questions}</strong> câu hỏi</span><span>${escapeHtml(getRole(sel.roleId).ten.split('/')[0])}</span>`;
  }

  function renderPanel() {
    const panel = $('[data-panel]', main);
    if (tab === 'issues') panel.innerHTML = issuesHtml();
    else if (tab === 'map') {
      panel.innerHTML = mapHtml();
      requestAnimationFrame(drawMapLinks);
    } else panel.innerHTML = docsHtml();
  }

  function issuesHtml() {
    return `<ol class="lg-issues">${plan.issues
      .map(
        (is, i) => `
      <li class="lg-issue" data-issue="${is.key}">
        <details ${(openIssues.has(is.key) ? openIssues.get(is.key) : i < 3 || is.key.startsWith('hv-')) ? 'open' : ''}>
          <summary>
            <span class="lg-issue-no">${i + 1}</span>
            <span class="lg-issue-title"><strong>${escapeHtml(is.tieuDe)}</strong><small>${escapeHtml(is.canCu)}</small></span>
            <span class="badge">${is.cauHoi.length}</span>
            ${icon('chevron-down', 'ic-sm lg-chev')}
          </summary>
          <p class="lg-issue-desc">${escapeHtml(is.moTa)}</p>
          <ol class="lg-qs">${is.cauHoi
            .map(
              (c) => `<li class="lg-q ${c.priority === 'high' ? 'hi' : ''}" data-text="${escapeHtml(c.text)}" data-src="${c.src}">
              <div class="lg-q-text">${escapeHtml(c.text)}</div>
              <div class="lg-q-meta">
                <span class="src src-${c.src}">${SOURCE_LABELS[c.src] || c.src}</span>
                <span class="lg-q-tools">
                  <button type="button" class="btn btn-ghost btn-sm btn-icon" data-qedit aria-label="Sửa câu hỏi">${icon('wand', 'ic-sm')}</button>
                  ${c.src === 'tuy-chinh' || c.src === 'ai' ? `<button type="button" class="btn btn-ghost btn-sm btn-icon" data-qkeep aria-label="${c.local || c.src === 'ai' ? 'Lưu vào bộ câu hỏi của tôi' : 'Bỏ khỏi bộ câu hỏi của tôi'}" title="${c.local || c.src === 'ai' ? 'Lưu vào bộ câu hỏi của tôi (dùng lại cho Điều này)' : 'Đã lưu trong bộ câu hỏi của tôi — bấm để bỏ'}">${icon('star', `ic-sm ${c.local || c.src === 'ai' ? '' : 'star-fill'}`)}</button>` : ''}
                  <button type="button" class="btn btn-ghost btn-sm btn-icon" data-qdel aria-label="Xóa câu hỏi">${icon('trash', 'ic-sm')}</button>
                </span>
              </div>
            </li>`,
            )
            .join('')}</ol>
          <form class="lg-add" data-add="${is.key}"><input class="input" placeholder="Thêm câu hỏi cho vấn đề này…" aria-label="Thêm câu hỏi cho ${escapeHtml(is.tieuDe)}" /><button class="btn btn-sm" type="submit">${icon('plus', 'ic-sm')}Thêm</button></form>
        </details>
      </li>`,
      )
      .join('')}</ol>`;
  }

  function mapHtml() {
    const crime = plan.crime;
    const domain = DOMAINS.find((d) => d.crimes.some((c) => c.dieu === crime.dieu));
    const group = domain.groups.find((g) => g.id === crime.nhom);
    return `<div class="lg-map" data-map>
      <svg class="lg-map-links" data-links aria-hidden="true"></svg>
      <div class="lg-map-col">
        <div class="mm-node mm-domain" data-mm="domain">${icon(domain.icon, 'ic-sm')}${escapeHtml(domain.ten)}</div>
        <div class="mm-node mm-group" data-mm="group">${escapeHtml(group.ten)}</div>
        <div class="mm-node mm-root" data-mm="root"><small>Điều ${crime.dieu}</small>${escapeHtml(crime.ten.replace(/^Tội /, ''))}</div>
        <div class="mm-node mm-role" data-mm="role">${icon('user', 'ic-sm')}${escapeHtml(plan.role.ten.split('/')[0])}</div>
      </div>
      <div class="lg-map-col">
        <h4>Hành vi vi phạm</h4>
        ${plan.hanhVi.map((h) => `<div class="mm-node mm-act" data-mm="act">${escapeHtml(h.ten)}</div>`).join('')}
        ${plan.dinhKhung.length ? `<h4>Định khung</h4>${plan.dinhKhung.map((d) => `<div class="mm-node mm-dk" data-mm="act">${escapeHtml(d)}</div>`).join('')}` : ''}
      </div>
      <div class="lg-map-col">
        <h4>Vấn đề cần làm rõ</h4>
        ${plan.issues.map((is, i) => `<button type="button" class="mm-node mm-issue" data-mm="issue" data-jump="${is.key}"><span>${i + 1}</span>${escapeHtml(is.tieuDe)}<em>${is.cauHoi.length}</em></button>`).join('')}
      </div>
    </div>`;
  }

  function drawMapLinks() {
    const map = $('[data-map]', main);
    if (!map) return;
    const svg = $('[data-links]', map);
    const box = map.getBoundingClientRect();
    svg.setAttribute('width', box.width);
    svg.setAttribute('height', map.scrollHeight);
    const pt = (el, side) => {
      const r = el.getBoundingClientRect();
      return { x: (side === 'r' ? r.right : r.left) - box.left, y: r.top + r.height / 2 - box.top };
    };
    const curve = (a, b, cls) => `<path class="${cls}" d="M${a.x},${a.y} C${(a.x + b.x) / 2},${a.y} ${(a.x + b.x) / 2},${b.y} ${b.x},${b.y}"/>`;
    const nodes = (k) => $$(`[data-mm="${k}"]`, map);
    const root = nodes('root')[0];
    let paths = '';
    const vertical = (a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x = ra.left + ra.width / 2 - box.left;
      paths += `<path class="mm-l0" d="M${x},${ra.bottom - box.top} L${x},${rb.top - box.top}"/>`;
    };
    vertical(nodes('domain')[0], nodes('group')[0]);
    vertical(nodes('group')[0], root);
    vertical(root, nodes('role')[0]);
    const acts = nodes('act');
    acts.forEach((n) => (paths += curve(pt(root, 'r'), pt(n, 'l'), 'mm-l1')));
    const src = acts.length ? acts : [root];
    nodes('issue').forEach((n, i) => {
      const from = src[Math.min(src.length - 1, Math.floor((i / nodes('issue').length) * src.length))];
      paths += curve(pt(from, 'r'), pt(n, 'l'), 'mm-l2');
    });
    svg.innerHTML = paths;
  }

  function docsHtml() {
    const crime = plan.crime;
    return `<div class="lg-docs">
      <section><h3>${icon('folder', 'ic-sm')}Tài liệu cần thu thập</h3>${plan.taiLieu.length ? `<ul>${plan.taiLieu.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : '<p class="muted">Không có gợi ý riêng.</p>'}</section>
      <section><h3>${icon('zap', 'ic-sm')}Trưng cầu giám định, định giá</h3>${plan.giamDinh.length ? `<ul>${plan.giamDinh.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : '<p class="muted">Không có gợi ý riêng.</p>'}</section>
      <section><h3>${icon('shield', 'ic-sm')}Quyền, nghĩa vụ của ${escapeHtml(plan.role.ten.toLowerCase())}</h3><p>${escapeHtml(plan.role.quyenTomTat)}</p><p><strong>Nghĩa vụ:</strong> ${escapeHtml(plan.role.nghiaVu)}</p>${plan.role.canhBao ? `<p class="note warn">${icon('alert', 'ic-sm')}<span>${escapeHtml(plan.role.canhBao)}</span></p>` : ''}<p class="muted">Căn cứ: ${escapeHtml(plan.role.quyen)}</p></section>
      <section><h3>${icon('book', 'ic-sm')}Tình tiết định khung của Điều ${crime.dieu}</h3><ul>${crime.dinhKhung.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul></section>
    </div>`;
  }

  function refresh() {
    plan = computePlan();
    renderStats();
    renderPanel();
  }

  function bindMain(crime) {
    $$('[data-hv]', main).forEach((cb) =>
      cb.addEventListener('change', () => {
        const ids = $$('[data-hv]:checked', main).map((x) => x.dataset.hv);
        if (!ids.length) {
          cb.checked = true;
          toast('Cần chọn ít nhất một hành vi', { type: 'info' });
          return;
        }
        sel.hanhViIds = ids;
        cb.closest('.lg-act').classList.toggle('on', cb.checked);
        main.querySelector('.lg-step small').textContent = `${ids.length}/${crime.hanhVi.length} đã chọn`;
        persistSel();
        refresh();
      }),
    );
    $$('[data-dk]', main).forEach((b) =>
      b.addEventListener('click', () => {
        const d = b.dataset.dk;
        sel.dinhKhung = sel.dinhKhung.includes(d) ? sel.dinhKhung.filter((x) => x !== d) : [...sel.dinhKhung, d];
        b.setAttribute('aria-pressed', String(sel.dinhKhung.includes(d)));
        persistSel();
        refresh();
      }),
    );
    $$('[data-role]', main).forEach((b) =>
      b.addEventListener('click', () => {
        sel.roleId = b.dataset.role;
        $$('[data-role]', main).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        persistSel();
        refresh();
      }),
    );
    $$('[data-tab]', main).forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.tab;
        $$('[data-tab]', main).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
        renderPanel();
      }),
    );

    const panel = $('[data-panel]', main);
    panel.addEventListener(
      'toggle',
      (e) => {
        const li = e.target.closest?.('[data-issue]');
        if (li && e.target.tagName === 'DETAILS') openIssues.set(li.dataset.issue, e.target.open);
      },
      true,
    );
    panel.addEventListener('click', (e) => {
      const jump = e.target.closest('[data-jump]');
      if (jump) {
        tab = 'issues';
        $$('[data-tab]', main).forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === 'issues')));
        renderPanel();
        openIssues.set(jump.dataset.jump, true);
        const el = $(`[data-issue="${jump.dataset.jump}"]`, main);
        el.querySelector('details').open = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const li = e.target.closest('.lg-q');
      if (!li) return;
      const key = li.closest('[data-issue]').dataset.issue;
      const text = li.dataset.text;
      const q = plan.issues.find((i) => i.key === key).cauHoi.find((c) => c.text === text);
      if (e.target.closest('[data-qdel]')) {
        removeQuestion(key, q);
        refresh();
        toast('Đã xóa câu hỏi');
      } else if (e.target.closest('[data-qkeep]')) {
        if (q.local || q.src === 'ai') {
          customBank.add(plan.crime.dieu, key, q.text);
          removeQuestion(key, q, true);
          toast('Đã lưu vào bộ câu hỏi của tôi — sẽ tự động xuất hiện cho Điều này');
        } else {
          customBank.remove(plan.crime.dieu, key, q.text);
          toast('Đã bỏ khỏi bộ câu hỏi của tôi');
        }
        refresh();
      } else if (e.target.closest('[data-qedit]')) {
        const box = li.querySelector('.lg-q-text');
        box.innerHTML = `<textarea class="textarea" rows="2" aria-label="Sửa câu hỏi">${escapeHtml(q.text)}</textarea><div class="inline" style="margin-top:6px"><button class="btn btn-sm btn-primary" type="button" data-qsave>Lưu</button><button class="btn btn-sm btn-ghost" type="button" data-qcancel>Hủy</button></div>`;
        const ta = box.querySelector('textarea');
        ta.focus();
        box.querySelector('[data-qcancel]').addEventListener('click', refresh);
        box.querySelector('[data-qsave]').addEventListener('click', () => {
          const v = ta.value.trim();
          if (!v) return;
          if (q.local) overlay.added[key] = overlay.added[key].map((t) => (t === q.text ? v : t));
          else if (q.src === 'ai') overlay.ai[key] = overlay.ai[key].map((t) => (t === q.text ? v : t));
          else overlay.edited[q.editedFrom || q.text] = v;
          refresh();
        });
      }
    });
    panel.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-add]');
      if (!f) return;
      e.preventDefault();
      const v = f.querySelector('input').value.trim();
      if (!v) return;
      const key = f.dataset.add;
      overlay.added[key] = [...(overlay.added[key] || []), v];
      refresh();
      const input = $(`[data-add="${key}"] input`, main);
      input?.focus();
      toast('Đã thêm câu hỏi');
    });

    $('[data-copy-plan]', main).addEventListener('click', async () => {
      await copyText(planToText(plan));
      toast('Đã sao chép kế hoạch hỏi');
    });
    $('[data-export-plan]', main).addEventListener('click', () => {
      const org = ctx.settings().legalOrg || {};
      const doc = buildPlanDocument(plan, org);
      downloadBlob(buildDocx(doc, 'Kế hoạch lấy lời khai'), safeFileName(`ke-hoach-hoi-dieu-${plan.crime.dieu}-${plan.role.id}`), DOCX_MIME);
      toast('Đã xuất kế hoạch hỏi (.docx)');
    });
    $('[data-preview-plan]', main).addEventListener('click', () => {
      const org = ctx.settings().legalOrg || {};
      ctx.modal(`<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button><div class="preview-modal-body print-area">${renderDocumentHtml(buildPlanDocument(plan, org))}</div><div class="modal-actions"><button class="btn" type="button" data-close>Đóng</button><button class="btn btn-dark" type="button" data-print>${icon('printer', 'ic-sm')}In / PDF</button></div>`, {
        className: 'modal-preview',
        label: 'Xem bản in kế hoạch',
        onMount(box) {
          box.querySelector('[data-print]').addEventListener('click', () => window.print());
        },
      });
    });
    $('[data-save-plan]', main).addEventListener('click', () => savePlanDialog());
    $('[data-start]', main).addEventListener('click', () => startDialog());
    $('[data-ai-more]', main).addEventListener('click', aiMore);
  }

  function removeQuestion(key, q, silent) {
    if (q.local) overlay.added[key] = (overlay.added[key] || []).filter((t) => t !== q.text);
    else if (q.src === 'ai') overlay.ai[key] = (overlay.ai[key] || []).filter((t) => t !== q.text);
    else if (q.src === 'tuy-chinh' && !silent) customBank.remove(plan.crime.dieu, key, q.text);
    else if (!silent) overlay.removed.push(q.editedFrom || q.text);
  }

  async function aiMore() {
    if (!ctx.hasAI()) {
      toast('Cần thêm API key Claude trong Cài đặt để dùng gợi ý AI', { type: 'info' });
      return;
    }
    const btn = $('[data-ai-more]', main);
    btn.disabled = true;
    btn.innerHTML = `${icon('refresh', 'ic-sm spin')}Đang phân tích…`;
    try {
      const { apiKey, model } = ctx.settings();
      const issues = plan.issues.map((i) => `- [${i.key}] ${i.tieuDe}: ${i.cauHoi.length} câu`).join('\n');
      const out = await streamClaude({
        apiKey,
        model,
        system: INVESTIGATOR_SYSTEM,
        messages: [{ role: 'user', content: `Tội danh: Điều ${plan.crime.dieu} BLHS — ${plan.crime.ten}\nHành vi: ${plan.hanhVi.map((h) => h.ten).join('; ')}\nĐối tượng lấy lời khai: ${plan.role.ten}\nCác vấn đề hiện có:\n${issues}\n\nĐề xuất bổ sung 6–10 câu hỏi chuyên sâu, sắc bén (đặc biệt về thủ đoạn che giấu, dòng tiền, chứng cứ điện tử, kiến thức chuyên ngành) chưa có trong bộ câu hỏi. Chỉ trả về JSON: {"cauHoi":[{"issueKey":"key vấn đề phù hợp nhất","text":"câu hỏi"}]}` }],
      });
      const j = extractJson(out);
      const list = (j?.cauHoi || []).filter((x) => x.text);
      const keys = plan.issues.map((i) => i.key);
      list.forEach((x) => {
        const k = keys.includes(x.issueKey) ? x.issueKey : keys.find((kk) => kk.startsWith('hv-')) || keys[0];
        overlay.ai[k] = [...(overlay.ai[k] || []), x.text];
      });
      refresh();
      toast(`AI đã gợi ý thêm ${list.length} câu hỏi`);
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 5000 });
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('sparkles', 'ic-sm')}AI gợi ý thêm`;
    }
  }

  function caseOptions(selected = '') {
    return `<option value="">— Không gắn hồ sơ —</option>${casesRepo
      .list()
      .map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${escapeHtml(c.ten)}${c.soHoSo ? ` (${escapeHtml(c.soHoSo)})` : ''}</option>`)
      .join('')}`;
  }

  function snapshot() {
    return { dieu: sel.dieu, hanhViIds: sel.hanhViIds, dinhKhung: sel.dinhKhung, roleId: sel.roleId, overlay };
  }

  function savePlanDialog() {
    const existing = editingPlanId ? plansRepo.get(editingPlanId) : null;
    ctx.modal(
      `<h2 class="modal-title">${existing ? 'Cập nhật kế hoạch hỏi' : 'Lưu kế hoạch hỏi'}</h2>
       <form class="auth-form" data-f>
         <div class="field"><label for="pl-title">Tên kế hoạch</label><input class="input" id="pl-title" name="title" value="${escapeHtml(existing?.title || `Điều ${plan.crime.dieu} — ${plan.role.ten.split('/')[0].trim()}`)}" /></div>
         <div class="field"><label for="pl-case">Gắn vào hồ sơ vụ án</label><select class="select" id="pl-case" name="caseId">${caseOptions(existing?.caseId)}</select></div>
         <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit">${icon('save', 'ic-sm')}Lưu</button></div>
       </form>`,
      {
        label: 'Lưu kế hoạch',
        onMount(box, close) {
          box.querySelector('[data-f]').addEventListener('submit', (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.target));
            const rec = plansRepo.save({ ...(existing || {}), ...snapshot(), title: f.title.trim() || 'Kế hoạch hỏi', caseId: f.caseId || null, stats: plan.stats });
            editingPlanId = rec.id;
            history.replaceState(null, '', `#legal/plan/${rec.id}`);
            close();
            toast('Đã lưu kế hoạch hỏi');
            $('[data-save-plan]', main).innerHTML = `${icon('save', 'ic-sm')}Cập nhật kế hoạch`;
          });
        },
      },
    );
  }

  function startDialog() {
    const cases = casesRepo.list();
    ctx.modal(
      `<h2 class="modal-title">Ghi lời khai theo kế hoạch</h2>
       <p class="hint" style="margin-bottom:14px">${escapeHtml(plan.role.ten)} · Điều ${plan.crime.dieu} · ${plan.stats.questions} câu hỏi</p>
       <form class="auth-form" data-f>
         <div class="field"><label for="st-case">Hồ sơ vụ án</label><select class="select" id="st-case" name="caseId">${caseOptions(cases[0]?.id || '')}</select></div>
         <div class="field"><label for="st-person">Người khai</label><select class="select" id="st-person" name="personId"></select></div>
         <div class="field" data-new-name><label for="st-name">Họ tên người khai</label><input class="input" id="st-name" name="hoTen" placeholder="Có thể bổ sung sau" /></div>
         <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit">${icon('message', 'ic-sm')}Bắt đầu ghi</button></div>
       </form>`,
      {
        label: 'Bắt đầu ghi lời khai',
        onMount(box, close) {
          const caseSel = box.querySelector('[name="caseId"]');
          const personSel = box.querySelector('[name="personId"]');
          const nameField = box.querySelector('[data-new-name]');
          const fillPersons = () => {
            const c = casesRepo.get(caseSel.value);
            const persons = c?.persons || [];
            personSel.innerHTML = `<option value="">— Người khai mới —</option>${persons.map((p) => `<option value="${p.id}" ${p.roleId === sel.roleId ? 'selected' : ''}>${escapeHtml(p.hoTen)} (${escapeHtml(getRole(p.roleId).ten.split('/')[0])})</option>`).join('')}`;
            nameField.hidden = !!personSel.value;
          };
          caseSel.addEventListener('change', fillPersons);
          personSel.addEventListener('change', () => (nameField.hidden = !!personSel.value));
          fillPersons();
          box.querySelector('[data-f]').addEventListener('submit', (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.target));
            const caseItem = casesRepo.get(f.caseId);
            const person = caseItem?.persons?.find((p) => p.id === f.personId) || null;
            const rec = newRecord({ caseItem, person, roleId: sel.roleId, plan, settings: ctx.settings() });
            rec.roleId = person?.roleId || sel.roleId;
            if (!person && f.hoTen) rec.nguoiKhai.hoTen = f.hoTen.trim();
            rec.lan = recordsRepo.list((r) => r.caseId && r.caseId === rec.caseId && r.personId && r.personId === rec.personId).length + 1;
            const saved = recordsRepo.save(rec);
            close();
            ctx.navigate(`#interview/${saved.id}`);
          });
        },
      },
    );
  }

  const onResize = debounce(() => tab === 'map' && drawMapLinks(), 100);
  window.addEventListener('resize', onResize);

  renderTree();
  renderMain();
  return () => window.removeEventListener('resize', onResize);
}
