// Cây hỏi đáp pháp luật: lĩnh vực → nhóm → tội danh → hành vi → vấn đề cần làm rõ → bộ câu hỏi (chỉnh sửa được).
import { $, $$, icon, toast, escapeHtml, copyText, downloadBlob, debounce } from '../ui.js';
import { DOMAINS, findCrime, searchCrimes, generatePlan, planToText, SOURCE_LABELS, LEGAL_DISCLAIMER, ALL_CRIMES, crimeWithCustomActs, localFollowUps, CATALOG_STATUS } from '../legal/engine.js';
import { CATALOG } from '../legal/blhs-catalog.js';
import { parseBlhsText, compareWithCatalog } from '../legal/blhs-import.js';
import { docxToText } from '../lib/docx.js';
import { audit } from '../lib/accounts.js';
import { ROLES, ROLE_GROUPS, getRole } from '../legal/roles.js';
import { buildPlanDocument, buildRecordDocument, newRecord, prefillQa } from '../legal/record.js';
import { casesRepo, plansRepo, recordsRepo, customBank, customActs, learnedBank, officialBlhs } from '../legal/repo.js';
import { renderDocumentHtml } from '../lib/render-html.js';
import { buildDocx, safeFileName } from '../lib/docx.js';
import { streamClaude, extractJson, PROVIDERS } from '../lib/ai.js';
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
  /** Hộp gợi ý đang mở: { key, q (câu hỏi gốc hoặc null = cả vấn đề), items: [{ text, added }], loading, offline, error } */
  let sugg = null;

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
                    ${gOpen ? `<div class="lg-children">${crimes.map((c) => `<button class="lg-leaf ${c.dieu === sel.dieu ? 'active' : ''} ${c.kiemTra ? 'unverified' : ''}" type="button" data-crime="${c.dieu}" ${c.dieu === sel.dieu ? 'aria-current="true"' : ''} ${c.kiemTra ? 'title="Tên/số điều cần đối chiếu nguyên văn"' : ''}><span class="lg-art">Đ.${c.dieu}</span><span>${escapeHtml(c.ten.replace(/^Tội /, ''))}</span></button>`).join('')}</div>` : ''}
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
    sugg = null;
    persistSel();
    history.replaceState(null, '', `#legal/${dieu}`);
    renderTree($('[data-q]', root).value);
    renderMain();
    main.scrollTop = 0;
  }

  const persistSel = () => store.set('legal-selection', sel);

  /* ---------------- Kế hoạch + lớp chỉnh sửa ---------------- */
  function computePlan() {
    const p = generatePlan({ ...sel, custom: customBank.all(), learned: learnedBank.all() });
    for (const is of p.issues) {
      is.cauHoi = is.cauHoi
        .filter((c) => !overlay.removed.includes(c.text))
        .map((c) => (overlay.edited[c.text] ? { ...c, text: overlay.edited[c.text], src: c.src, editedFrom: c.text } : c));
      // Câu đã có (vd: vừa được học) thì không thêm trùng — nhưng vẫn giữ để sửa/xóa theo lớp chỉnh sửa.
      const dup = (t) => is.cauHoi.findIndex((c) => c.text.toLowerCase() === t.toLowerCase());
      const put = (t, item) => {
        const i = dup(t);
        if (i >= 0 && is.cauHoi[i].src === 'hoc') is.cauHoi[i] = item;
        else if (i < 0) is.cauHoi.push(item);
      };
      (overlay.ai[is.key] || []).forEach((t) => put(t, { id: uid(), text: t, src: 'ai', priority: 'normal' }));
      (overlay.added[is.key] || []).forEach((t) => put(t, { id: uid(), text: t, src: 'tuy-chinh', priority: 'high', local: true }));
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
          ${DOMAINS.filter((d) => d.crimes.length).map((d) => `<button class="lg-domain-card" type="button" data-open-domain="${d.id}"><span class="quick-icon">${icon(d.icon)}</span><strong>${d.ten}</strong><span>${escapeHtml(d.moTa)}</span><em>${d.groups.length} nhóm · ${d.crimes.length} tội danh</em></button>`).join('')}
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
        <section class="panel lg-blhs" data-blhs>${blhsPanelHtml()}</section>
        <p class="lg-disclaimer">${icon('info', 'ic-sm')}${escapeHtml(LEGAL_DISCLAIMER)}</p>
      </div>`;
    $('[data-blhs-update]', main).addEventListener('click', blhsDialog);
    $('[data-blhs-clear]', main)?.addEventListener('click', async () => {
      if (!(await ctx.confirm('Gỡ nguyên văn Bộ luật đã nạp và quay về dữ liệu tích hợp?', { title: 'Gỡ dữ liệu Bộ luật', okText: 'Gỡ', danger: true }))) return;
      officialBlhs.clear();
      audit('Gỡ nguyên văn Bộ luật Hình sự', '');
      renderTree($('[data-q]', root).value);
      renderOverview();
      toast('Đã quay về dữ liệu tích hợp');
    });
    $$('[data-open-domain]', main).forEach((b) =>
      b.addEventListener('click', () => {
        openTree.add(b.dataset.openDomain);
        store.set('legal-open', [...openTree]);
        renderTree();
        tree.querySelector(`[data-toggle="${b.dataset.openDomain}"]`)?.focus();
      }),
    );
  }

  function blhsPanelHtml() {
    const off = CATALOG_STATUS.official;
    const verified = ALL_CRIMES.filter((c) => c.nguyenVan).length;
    const unverified = ALL_CRIMES.filter((c) => c.kiemTra).length;
    return `<div class="panel-head"><h2>${icon('book', 'ic-sm')}Dữ liệu Bộ luật Hình sự</h2><span class="badge ${off ? 'badge-success' : ''}">${off ? 'Đã nạp nguyên văn' : 'Dữ liệu tích hợp'}</span></div>
      <div class="lg-blhs-body">
        <div class="mem-stats lg-blhs-stats"><div><strong>${ALL_CRIMES.length}</strong><span>tội danh trong cây</span></div><div><strong>${DOMAINS.filter((d) => d.crimes.length).length}</strong><span>lĩnh vực</span></div><div><strong>${off ? verified : unverified}</strong><span>${off ? 'điều có nguyên văn' : 'điều cần đối chiếu tên'}</span></div><div><strong>${CATALOG_STATUS.hidden.length}</strong><span>điều chờ cập nhật tên</span></div></div>
        <p class="hint">${
          off
            ? `Nguồn: ${escapeHtml(off.source || 'văn bản đã nạp')} · ${off.count} điều · nạp ${new Date(off.importedAt).toLocaleDateString('vi-VN')}. Tên điều, khoản, tình tiết định khung theo văn bản đã nạp.`
            : `Phần các tội phạm (Chương XIII – XXVI) Bộ luật Hình sự 2015, sửa đổi, bổ sung 2017, 2025, tự phân chia theo lĩnh vực. Nạp nguyên văn Văn bản hợp nhất (tệp Word hoặc dán nội dung) để xác thực tên điều, hiển thị nguyên văn từng điều và lấy tình tiết định khung theo đúng khoản, điểm.${CATALOG_STATUS.repealed.length ? ` Điều đã bãi bỏ: ${CATALOG_STATUS.repealed.join(', ')}.` : ''}`
        }</p>
        <div class="inline"><button class="btn btn-sm btn-primary" type="button" data-blhs-update>${icon('upload', 'ic-sm')}Cập nhật Bộ luật từ văn bản chính thức</button>${off ? `<button class="btn btn-sm btn-ghost" type="button" data-blhs-clear>${icon('trash', 'ic-sm')}Gỡ dữ liệu đã nạp</button>` : ''}</div>
      </div>`;
  }

  function blhsDialog() {
    let parsed = null;
    let source = '';
    ctx.modal(
      `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
      <h2 class="modal-title">Cập nhật Bộ luật Hình sự</h2>
      <p class="hint" style="margin-bottom:12px">Chọn tệp Word (.docx) hoặc .txt của Văn bản hợp nhất Bộ luật Hình sự (vd: 135/VBHN-VPQH năm 2025), hoặc sao chép toàn văn từ cổng văn bản pháp luật rồi dán vào ô dưới. Dữ liệu được xử lý và lưu trên máy này.</p>
      <div class="field"><label class="btn btn-sm" style="position:relative;overflow:hidden;width:max-content">${icon('upload', 'ic-sm')}Chọn tệp .docx / .txt<input type="file" accept=".docx,.txt" data-blhs-file style="position:absolute;inset:0;opacity:0;cursor:pointer" aria-label="Chọn tệp Bộ luật" /></label></div>
      <div class="field"><label for="blhs-text">Hoặc dán toàn văn</label><textarea class="textarea" rows="8" id="blhs-text" data-blhs-text placeholder="Điều 123. Tội giết người&#10;1. Người nào giết người thuộc một trong các trường hợp sau đây…"></textarea></div>
      <div class="inline"><button class="btn btn-sm" type="button" data-blhs-parse>${icon('refresh', 'ic-sm')}Phân tích</button></div>
      <div class="lg-blhs-out" data-blhs-out></div>
      <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="button" data-blhs-apply disabled>${icon('check', 'ic-sm')}Áp dụng vào cây hỏi đáp</button></div>`,
      {
        className: 'modal-wide',
        label: 'Cập nhật Bộ luật',
        onMount(box, close) {
          const out = box.querySelector('[data-blhs-out]');
          const apply = box.querySelector('[data-blhs-apply]');
          const analyse = (text) => {
            parsed = parseBlhsText(text);
            const n = Object.keys(parsed.articles).length;
            if (n < 20) {
              parsed = null;
              apply.disabled = true;
              out.innerHTML = `<p class="note warn">${icon('alert', 'ic-sm')}<span>Chỉ nhận diện được ${n} điều thuộc Phần các tội phạm. Hãy dùng toàn văn Bộ luật (mỗi điều bắt đầu bằng “Điều N. Tên điều”).</span></p>`;
              return;
            }
            const curated = Object.fromEntries(ALL_CRIMES.filter((c) => !c.generic).map((c) => [c.dieu, c.ten]));
            const cmp = compareWithCatalog(parsed, CATALOG, curated);
            const li = (x) => `<li><strong>Điều ${escapeHtml(x.dieu)}</strong> ${escapeHtml(x.moi || x.ten || '')}${x.cu ? `<br><small>Dữ liệu tích hợp: ${escapeHtml(x.cu)}</small>` : ''}</li>`;
            out.innerHTML = `<div class="mem-stats lg-blhs-stats"><div><strong>${cmp.total}</strong><span>điều nhận diện</span></div><div><strong>${Object.keys(parsed.chapters).length}</strong><span>chương</span></div><div><strong>${cmp.renamed.length}</strong><span>điều khác tên</span></div><div><strong>${cmp.added.length}</strong><span>điều bổ sung</span></div></div>
              ${cmp.renamed.length ? `<details open><summary>Điều có tên khác dữ liệu tích hợp (${cmp.renamed.length}) — sẽ dùng tên theo văn bản</summary><ul class="lg-blhs-list">${cmp.renamed.slice(0, 80).map(li).join('')}</ul></details>` : ''}
              ${cmp.added.length ? `<details><summary>Điều bổ sung vào cây (${cmp.added.length})</summary><ul class="lg-blhs-list">${cmp.added.slice(0, 80).map(li).join('')}</ul></details>` : ''}
              ${cmp.repealed.length ? `<p class="hint">Điều đã bãi bỏ (không đưa vào cây): ${cmp.repealed.join(', ')}.</p>` : ''}`;
            apply.disabled = false;
          };
          box.querySelector('[data-blhs-file]').addEventListener('change', async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            try {
              const buf = await f.arrayBuffer();
              const text = /\.docx$/i.test(f.name) ? await docxToText(buf) : new TextDecoder().decode(buf);
              source = f.name;
              analyse(text);
            } catch (err) {
              toast(err.message || 'Không đọc được tệp', { type: 'error' });
            }
          });
          box.querySelector('[data-blhs-parse]').addEventListener('click', () => {
            const t = box.querySelector('[data-blhs-text]').value;
            if (!t.trim()) return toast('Dán toàn văn Bộ luật hoặc chọn tệp', { type: 'error' });
            source = 'Văn bản dán vào';
            analyse(t);
          });
          apply.addEventListener('click', () => {
            if (!parsed) return;
            try {
              officialBlhs.save(parsed, source);
            } catch (err) {
              return toast(err.message, { type: 'error' });
            }
            audit('Nạp nguyên văn Bộ luật Hình sự', `${source} — ${Object.keys(parsed.articles).length} điều`);
            close();
            renderTree($('[data-q]', root).value);
            if (sel.dieu && findCrime(sel.dieu)) renderMain();
            else renderOverview();
            toast(`Đã cập nhật cây hỏi đáp theo ${Object.keys(parsed.articles).length} điều của văn bản`);
          });
        },
      },
    );
  }

  function renderMain() {
    const crime = sel.dieu && crimeWithCustomActs(sel.dieu);
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
          <p class="lg-crime-ch">${escapeHtml(crime.chuong)}${crime.phapNhan ? ' · <span class="badge">Pháp nhân thương mại chịu TNHS</span>' : ''}${crime.generic ? ' · <span class="badge" title="Cấu thành và câu hỏi sinh theo mẫu của chương">Theo mẫu chương</span>' : ' · <span class="badge badge-success">Dữ liệu chuyên sâu</span>'}${crime.kiemTra ? ' · <span class="badge badge-warning">Cần đối chiếu tên điều</span>' : ''}${crime.nguyenVan ? ' · <span class="badge badge-success">Có nguyên văn</span>' : ''}</p>
          ${crime.tenChinhThuc && crime.tenChinhThuc.toLowerCase() !== crime.ten.toLowerCase() ? `<p class="note warn">${icon('info', 'ic-sm')}<span>Tên điều theo văn bản đã nạp: <strong>${escapeHtml(crime.tenChinhThuc)}</strong></span></p>` : ''}
          <dl class="lg-elements">
            <div><dt>Khách thể</dt><dd>${escapeHtml(crime.khachThe)}</dd></div>
            <div><dt>Chủ thể</dt><dd>${escapeHtml(crime.chuThe)}</dd></div>
            <div><dt>Mặt chủ quan</dt><dd>${escapeHtml(crime.loi)}</dd></div>
          </dl>
          <details class="lg-signs" open><summary>Dấu hiệu định tội cần chứng minh (${crime.dauHieu.length})</summary><ul>${crime.dauHieu.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul></details>
          ${crime.ghiChu ? `<p class="note warn">${icon('alert', 'ic-sm')}<span>${escapeHtml(crime.ghiChu)}</span></p>` : ''}
          ${crime.nguyenVan ? `<details class="lg-signs lg-nguyen-van"><summary>Nguyên văn Điều ${crime.dieu}</summary><div>${crime.nguyenVan.split('\n').map((l) => `<p>${escapeHtml(l)}</p>`).join('')}</div></details>` : ''}
        </div>
      </header>

      <div class="lg-steps">
        <section class="lg-step">
          <h2><span>1</span>Hành vi vi phạm <small>${sel.hanhViIds.length}/${crime.hanhVi.length} đã chọn</small></h2>
          <div class="lg-acts">${crime.hanhVi
            .map(
              (h) => `<label class="lg-act ${sel.hanhViIds.includes(h.id) ? 'on' : ''} ${h.custom ? 'custom' : ''}"><input type="checkbox" data-hv="${h.id}" ${sel.hanhViIds.includes(h.id) ? 'checked' : ''}/><span>${escapeHtml(h.ten)}</span><small>${h.custom ? '<em class="badge">Tự thêm</em> ' : ''}${h.cauHoi.length} câu hỏi đặc thù</small>${
                h.custom ? `<span class="lg-act-tools"><button type="button" class="btn btn-ghost btn-sm btn-icon" data-act-edit="${h.id}" aria-label="Sửa hành vi ${escapeHtml(h.ten)}">${icon('wand', 'ic-sm')}</button><button type="button" class="btn btn-ghost btn-sm btn-icon" data-act-del="${h.id}" aria-label="Xóa hành vi ${escapeHtml(h.ten)}">${icon('trash', 'ic-sm')}</button></span>` : ''
              }</label>`,
            )
            .join('')}<button type="button" class="lg-act lg-act-add" data-act-add>${icon('plus', 'ic-sm')}<span>Thêm hành vi thủ công</span><small>Tự định nghĩa hành vi và câu hỏi đặc thù</small></button></div>
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
          <button class="btn btn-sm btn-ghost" type="button" data-export-blank title="Xuất biên bản Word có sẵn toàn bộ câu hỏi, phần trả lời để trống">${icon('file', 'ic-sm')}Phiếu hỏi Word</button>
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
                  <button type="button" class="btn btn-ghost btn-sm btn-icon" data-qai aria-label="Gợi ý câu hỏi truy tiếp" title="Gợi ý câu hỏi truy tiếp (AI)">${icon('sparkles', 'ic-sm')}</button>
                  <button type="button" class="btn btn-ghost btn-sm btn-icon" data-qedit aria-label="Sửa câu hỏi">${icon('wand', 'ic-sm')}</button>
                  ${c.src === 'tuy-chinh' || c.src === 'ai' ? `<button type="button" class="btn btn-ghost btn-sm btn-icon" data-qkeep aria-label="${c.local || c.src === 'ai' ? 'Lưu vào bộ câu hỏi của tôi' : 'Bỏ khỏi bộ câu hỏi của tôi'}" title="${c.local || c.src === 'ai' ? 'Lưu vào bộ câu hỏi của tôi (dùng lại cho Điều này)' : 'Đã lưu trong bộ câu hỏi của tôi — bấm để bỏ'}">${icon('star', `ic-sm ${c.local || c.src === 'ai' ? '' : 'star-fill'}`)}</button>` : ''}
                  <button type="button" class="btn btn-ghost btn-sm btn-icon" data-qdel aria-label="Xóa câu hỏi">${icon('trash', 'ic-sm')}</button>
                </span>
              </div>
            </li>${sugg && sugg.key === is.key && sugg.q === c.text ? suggHtml() : ''}`,
            )
            .join('')}</ol>
          ${sugg && sugg.key === is.key && !sugg.q ? suggHtml('div') : ''}
          <form class="lg-add" data-add="${is.key}"><input class="input" placeholder="Thêm câu hỏi cho vấn đề này…" aria-label="Thêm câu hỏi cho ${escapeHtml(is.tieuDe)}" /><button class="btn btn-sm" type="submit">${icon('plus', 'ic-sm')}Thêm</button><button class="btn btn-sm btn-ghost" type="button" data-issue-ai title="Gợi ý thêm câu hỏi cho vấn đề này">${icon('sparkles', 'ic-sm')}Gợi ý AI</button></form>
        </details>
      </li>`,
      )
      .join('')}</ol>`;
  }

  function suggHtml(tag = 'li') {
    const head = `<div class="lg-sugg-head">${icon('sparkles', 'ic-sm')}<strong>${sugg.q ? 'Câu hỏi truy tiếp' : 'Gợi ý thêm cho vấn đề'}</strong>${sugg.offline ? '<span class="badge" title="Tạo trên máy, không gửi dữ liệu ra ngoài">Gợi ý ngoại tuyến</span>' : sugg.loading ? '' : `<span class="badge badge-success">${escapeHtml(sugg.label || 'AI')}</span>`}<span class="spacer"></span>${sugg.items?.some((x) => !x.added) ? '<button type="button" class="btn btn-ghost btn-sm" data-sugg-all>Thêm tất cả</button>' : ''}<button type="button" class="btn btn-ghost btn-sm btn-icon" data-sugg-close aria-label="Đóng gợi ý">${icon('x', 'ic-sm')}</button></div>`;
    let bodyHtml;
    if (sugg.loading) bodyHtml = `<p class="lg-sugg-wait">${icon('refresh', 'ic-sm spin')}Đang phân tích…</p>`;
    else bodyHtml = `${sugg.error ? `<p class="lg-sugg-err" role="alert">${icon('alert', 'ic-sm')}${escapeHtml(sugg.error)}</p>` : ''}${sugg.cached ? `<p class="lg-sugg-note">${icon('clock', 'ic-sm')}Kết quả đã ghi nhớ trên máy, không gửi lại AI. <button type="button" class="link-btn" data-sugg-fresh>Hỏi lại AI</button></p>` : ''}${sugg.switched ? `<p class="lg-sugg-note">${icon('refresh', 'ic-sm')}Nhà cung cấp mặc định lỗi — đã tự chuyển sang ${escapeHtml(sugg.label)}.</p>` : ''}<ul>${sugg.items.map((x, i) => `<li><span>${escapeHtml(x.text)}</span>${x.added ? `<em>${icon('check', 'ic-sm')}Đã thêm</em>` : `<button type="button" class="btn btn-sm" data-sugg-add="${i}">${icon('plus', 'ic-sm')}Thêm</button>`}</li>`).join('')}</ul>`;
    return `<${tag} class="lg-sugg" data-sugg aria-live="polite">${head}${bodyHtml}${sugg.offline && !ctx.hasAI('legal') ? `<p class="lg-sugg-note">${ctx.can('legal.ai') ? 'Thêm API key trong Cài đặt để dùng gợi ý AI.' : 'Phân hệ Tố tụng đang ngoại tuyến — cần quản trị cấp quyền để dùng AI trực tuyến.'}</p>` : ''}</${tag}>`;
  }

  /** Gợi ý câu hỏi cho một câu hỏi (truy tiếp) hoặc cho cả vấn đề. */
  /** Gợi ý ngoại tuyến: ưu tiên câu hỏi đã học từ các lần ghi lời khai trước, sau đó là mẫu truy tiếp. */
  function offlineItems(is, qText) {
    const have = new Set(is.cauHoi.map((c) => c.text));
    const learned = learnedBank.of(plan.crime.dieu, is.key).map((x) => x.text);
    return [...new Set([...learned, ...localFollowUps(qText || is.tieuDe, sel.roleId)])].filter((t) => !have.has(t)).slice(0, 8);
  }

  async function suggest(key, qText = null, fresh = false) {
    const is = plan.issues.find((i) => i.key === key);
    if (!is) return;
    if (!ctx.hasAI('legal')) {
      sugg = { key, q: qText, items: offlineItems(is, qText).map((text) => ({ text })), offline: true };
      return renderPanel();
    }
    const { provider, apiKey, model, label } = ctx.ai('legal');
    const token = {};
    sugg = { key, q: qText, loading: true, token, label };
    renderPanel();
    try {
      const meta = {};
      const out = await streamClaude({
        provider,
        apiKey,
        model,
        system: INVESTIGATOR_SYSTEM,
        cache: true,
        fresh,
        meta,
        messages: [
          {
            role: 'user',
            content: `Tội danh: Điều ${plan.crime.dieu} BLHS — ${plan.crime.ten}\nHành vi: ${plan.hanhVi.map((h) => h.ten).join('; ')}\nĐối tượng lấy lời khai: ${plan.role.ten}\nVấn đề cần làm rõ: ${is.tieuDe} (${is.canCu})\nCác câu hỏi đã có:\n${is.cauHoi.map((c) => `- ${c.text}`).join('\n')}\n\n${qText ? `Đề xuất 4–6 câu hỏi truy tiếp, đào sâu câu hỏi: "${qText}"` : 'Đề xuất 5–8 câu hỏi bổ sung, sắc bén, chưa có trong danh sách trên'} — đúng tư cách tố tụng của người khai, không mớm cung. Chỉ trả về JSON: {"cauHoi":["câu hỏi", "..."]}`,
          },
        ],
      });
      if (sugg?.token !== token) return;
      const j = extractJson(out);
      const list = (j?.cauHoi || []).map((x) => (typeof x === 'string' ? x : x?.text)).filter((t) => t && t.trim());
      const used = PROVIDERS[meta.provider]?.label || label;
      sugg = { key, q: qText, label: used, cached: meta.cached, switched: meta.switched, items: list.map((text) => ({ text: text.trim() })) };
      if (!list.length) sugg = { key, q: qText, offline: true, error: 'AI không trả về gợi ý đúng định dạng — đang dùng gợi ý ngoại tuyến.', items: offlineItems(is, qText).map((text) => ({ text })) };
    } catch (err) {
      if (sugg?.token !== token) return;
      // Không để trống: báo lỗi rõ ràng và chuyển sang gợi ý ngoại tuyến.
      sugg = { key, q: qText, offline: true, error: `${err.message} — đang dùng gợi ý ngoại tuyến.`, items: offlineItems(is, qText).map((text) => ({ text })) };
      toast(err.message, { type: 'error', timeout: 6000 });
    }
    renderPanel();
  }

  function addSuggestion(i) {
    const x = sugg?.items?.[i];
    if (!x || x.added) return;
    const bucket = sugg.offline ? overlay.added : overlay.ai;
    bucket[sugg.key] = [...(bucket[sugg.key] || []), x.text];
    learnedBank.learn(plan.crime.dieu, sugg.key, x.text);
    x.added = true;
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
    $('[data-act-add]', main).addEventListener('click', () => actDialog(crime));
    $$('[data-act-edit]', main).forEach((b) =>
      b.addEventListener('click', (e) => {
        e.preventDefault();
        actDialog(crime, customActs.of(crime.dieu).find((h) => h.id === b.dataset.actEdit));
      }),
    );
    $$('[data-act-del]', main).forEach((b) =>
      b.addEventListener('click', async (e) => {
        e.preventDefault();
        const h = customActs.of(crime.dieu).find((x) => x.id === b.dataset.actDel);
        if (!h || !(await ctx.confirm(`Xóa hành vi tự thêm “${h.ten}”?`, { title: 'Xóa hành vi', okText: 'Xóa', danger: true }))) return;
        customActs.remove(crime.dieu, h.id);
        sel.hanhViIds = sel.hanhViIds.filter((x) => x !== h.id);
        if (!sel.hanhViIds.length) sel.hanhViIds = [findCrime(crime.dieu).hanhVi[0].id];
        persistSel();
        renderMain();
        toast('Đã xóa hành vi');
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
      if (e.target.closest('[data-sugg-fresh]')) return suggest(sugg.key, sugg.q, true);
      if (e.target.closest('[data-sugg-close]')) {
        sugg = null;
        return renderPanel();
      }
      const sa = e.target.closest('[data-sugg-add]');
      if (sa || e.target.closest('[data-sugg-all]')) {
        if (sa) addSuggestion(+sa.dataset.suggAdd);
        else sugg.items.forEach((_, i) => addSuggestion(i));
        refresh();
        toast(sa ? 'Đã thêm câu hỏi' : 'Đã thêm tất cả câu hỏi gợi ý');
        return;
      }
      const ia = e.target.closest('[data-issue-ai]');
      if (ia) return suggest(ia.closest('[data-issue]').dataset.issue);
      const li = e.target.closest('.lg-q');
      if (!li) return;
      const key = li.closest('[data-issue]').dataset.issue;
      const text = li.dataset.text;
      const q = plan.issues.find((i) => i.key === key).cauHoi.find((c) => c.text === text);
      if (e.target.closest('[data-qai]')) return suggest(key, q.text);
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
      learnedBank.learn(plan.crime.dieu, key, v);
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
    $('[data-export-blank]', main).addEventListener('click', () => {
      const rec = newRecord({ roleId: sel.roleId, plan, settings: ctx.settings() });
      rec.gioBatDau = '';
      prefillQa(rec, uid);
      downloadBlob(buildDocx(buildRecordDocument(rec), 'Phiếu hỏi'), safeFileName(`phieu-hoi-dieu-${plan.crime.dieu}-${plan.role.id}`), DOCX_MIME);
      toast(`Đã xuất phiếu hỏi Word (${rec.qa.length} câu hỏi, chưa trả lời)`);
    });
    $('[data-save-plan]', main).addEventListener('click', () => savePlanDialog());
    $('[data-start]', main).addEventListener('click', () => startDialog());
    $('[data-ai-more]', main).addEventListener('click', aiMore);
  }

  function removeQuestion(key, q, silent) {
    if (q.local) overlay.added[key] = (overlay.added[key] || []).filter((t) => t !== q.text);
    else if (q.src === 'ai') overlay.ai[key] = (overlay.ai[key] || []).filter((t) => t !== q.text);
    else if (q.src === 'tuy-chinh' && !silent) customBank.remove(plan.crime.dieu, key, q.text);
    else if (q.src === 'hoc' && !silent) learnedBank.forget(plan.crime.dieu, key, q.text);
    else if (!silent) overlay.removed.push(q.editedFrom || q.text);
  }

  async function aiMore() {
    if (!ctx.hasAI('legal')) {
      toast(ctx.can('legal.ai') ? 'Cần thêm API key AI trong Cài đặt để dùng gợi ý AI' : 'Phân hệ Tố tụng đang ở chế độ ngoại tuyến. Liên hệ quản trị để được cấp quyền dùng AI trực tuyến.', { type: 'info', timeout: 4500 });
      return;
    }
    const btn = $('[data-ai-more]', main);
    btn.disabled = true;
    btn.innerHTML = `${icon('refresh', 'ic-sm spin')}Đang phân tích…`;
    try {
      const { provider, apiKey, model } = ctx.ai('legal');
      const issues = plan.issues.map((i) => `- [${i.key}] ${i.tieuDe}: ${i.cauHoi.length} câu`).join('\n');
      const out = await streamClaude({
        provider,
        apiKey,
        model,
        system: INVESTIGATOR_SYSTEM,
        cache: true,
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

  /** Thêm / sửa hành vi vi phạm do người dùng tự định nghĩa. */
  function actDialog(crime, act = null) {
    const lines = (v) => String(v || '').split('\n').map((x) => x.replace(/^\s*[-•\d.)]+\s*/, '').trim()).filter(Boolean);
    ctx.modal(
      `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
      <h2 class="modal-title">${act ? 'Sửa hành vi' : 'Thêm hành vi vi phạm'}</h2>
      <p class="hint" style="margin-bottom:14px">Điều ${crime.dieu} — ${escapeHtml(crime.ten)}. Hành vi tự thêm được lưu trên máy, theo tài khoản của bạn.</p>
      <form class="auth-form" data-f>
        <div class="field"><label for="act-ten">Tên hành vi</label><input class="input" id="act-ten" name="ten" required value="${escapeHtml(act?.ten || '')}" placeholder="VD: Lập hồ sơ khống để rút tiền tạm ứng" /></div>
        <div class="field"><label for="act-q">Câu hỏi đặc thù (mỗi dòng một câu)</label><textarea class="textarea" rows="6" id="act-q" name="cauHoi">${escapeHtml((act?.cauHoi || []).join('\n'))}</textarea></div>
        <div class="field"><label for="act-tl">Tài liệu cần thu thập (mỗi dòng một mục)</label><textarea class="textarea" rows="3" id="act-tl" name="taiLieu">${escapeHtml((act?.taiLieu || []).join('\n'))}</textarea></div>
        <div class="modal-actions"><button class="btn btn-ghost" type="button" data-act-ai>${icon('sparkles', 'ic-sm')}Gợi ý câu hỏi</button><span class="spacer"></span><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit">${icon('save', 'ic-sm')}Lưu hành vi</button></div>
      </form>`,
      {
        label: act ? 'Sửa hành vi' : 'Thêm hành vi',
        onMount(box, close) {
          const form = box.querySelector('[data-f]');
          const aiBtn = box.querySelector('[data-act-ai]');
          aiBtn.addEventListener('click', async () => {
            const ten = form.ten.value.trim();
            if (!ten) {
              form.ten.focus();
              return toast('Nhập tên hành vi trước', { type: 'error' });
            }
            let list;
            if (ctx.hasAI('legal')) {
              aiBtn.disabled = true;
              aiBtn.innerHTML = `${icon('refresh', 'ic-sm spin')}Đang gợi ý…`;
              try {
                const { provider, apiKey, model } = ctx.ai('legal');
                const out = await streamClaude({
                  provider,
                  apiKey,
                  model,
                  system: INVESTIGATOR_SYSTEM,
                  cache: true,
                  messages: [{ role: 'user', content: `Tội danh: Điều ${crime.dieu} BLHS — ${crime.ten}\nHành vi vi phạm cần làm rõ: ${ten}\nĐối tượng lấy lời khai: ${getRole(sel.roleId).ten}\nĐề xuất 6–10 câu hỏi đặc thù bám sát hành vi này và 3–5 tài liệu cần thu thập. Chỉ trả về JSON: {"cauHoi":["..."],"taiLieu":["..."]}` }],
                });
                const j = extractJson(out) || {};
                list = { cauHoi: (j.cauHoi || []).filter(Boolean), taiLieu: (j.taiLieu || []).filter(Boolean) };
              } catch (err) {
                toast(err.message, { type: 'error', timeout: 5000 });
              } finally {
                aiBtn.disabled = false;
                aiBtn.innerHTML = `${icon('sparkles', 'ic-sm')}Gợi ý câu hỏi`;
              }
            } else {
              const t = ten.charAt(0).toLowerCase() + ten.slice(1);
              list = {
                cauHoi: [
                  `Anh/chị trình bày cụ thể việc ${t}: thời gian, địa điểm, cách thức thực hiện?`,
                  `Ai chỉ đạo, ai cùng tham gia việc ${t}; vai trò của từng người?`,
                  `Việc ${t} nhằm mục đích gì; lợi ích thu được là gì, ai được hưởng?`,
                  `Việc ${t} đã gây ra hậu quả, thiệt hại gì; giá trị cụ thể?`,
                  `Những tài liệu, chứng từ, dữ liệu điện tử nào phản ánh việc ${t}; hiện ai lưu giữ?`,
                  `Có ai biết hoặc chứng kiến việc ${t} không?`,
                ],
                taiLieu: [`Tài liệu, chứng từ liên quan đến việc ${t}`, 'Dữ liệu điện tử, tin nhắn, thư điện tử liên quan'],
              };
              toast('Đã tạo gợi ý ngoại tuyến (không dùng AI)', { type: 'info' });
            }
            if (!list) return;
            const merge = (el, xs) => (el.value = [...new Set([...lines(el.value), ...xs])].join('\n'));
            merge(form.cauHoi, list.cauHoi);
            merge(form.taiLieu, list.taiLieu);
          });
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            const ten = form.ten.value.trim();
            if (!ten) return;
            const rec = customActs.save(crime.dieu, { ...(act || {}), ten, cauHoi: lines(form.cauHoi.value), taiLieu: lines(form.taiLieu.value) });
            if (!sel.hanhViIds.includes(rec.id)) sel.hanhViIds = [...sel.hanhViIds, rec.id];
            persistSel();
            close();
            renderMain();
            toast(act ? 'Đã cập nhật hành vi' : 'Đã thêm hành vi — hệ thống tự sinh vấn đề cần làm rõ');
          });
        },
      },
    );
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
         <label class="check"><input type="checkbox" name="prefill" />Đưa sẵn toàn bộ ${plan.stats.questions} câu hỏi vào biên bản (chưa trả lời)</label>
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
            if (f.prefill) prefillQa(rec, uid);
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
