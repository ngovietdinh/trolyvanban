// Biểu mẫu văn bản tố tụng hình sự: chọn mẫu theo giai đoạn → điền (tự điền từ hồ sơ vụ án) → xem trước A4 → xuất Word / lưu vào hồ sơ.
import { $, $$, icon, toast, escapeHtml, downloadBlob, debounce } from '../ui.js';
import { STAGES, FORMS, FIELDS, LOAI, findForm, formKeys } from '../legal/forms-catalog.js';
import { buildFormDocument, prefillFromCase } from '../legal/forms-build.js';
import { casesRepo, legalDocsRepo } from '../legal/repo.js';
import { renderDocumentHtml } from '../lib/render-html.js';
import { buildDocx, safeFileName } from '../lib/docx.js';
import { streamClaude } from '../lib/ai.js';
import { INVESTIGATOR_SYSTEM } from '../legal/assist.js';
import { store } from '../lib/store.js';
import { mobilePanes } from '../lib/panes.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const AI_KEYS = new Set(['tomTat', 'lyDo', 'noiDung', 'dienBien', 'chungCu', 'tinhTiet', 'deNghi', 'noiDungGiamDinh', 'ketQua']);

export function render(ctx, params = []) {
  let form = null;
  let values = {};
  let docId = null;
  let caseId = '';
  let personId = '';
  let q = '';
  let openStages = new Set(store.get('forms-open', ['khoi-to']));
  const org = () => ctx.settings().legalOrg || {};

  if (params[0] === 'doc' && params[1]) {
    const d = legalDocsRepo.get(params[1]);
    if (d && findForm(d.formId)) {
      form = findForm(d.formId);
      values = { ...d.values };
      docId = d.id;
      caseId = d.caseId || '';
      personId = d.personId || '';
    }
  } else if (params[0] && findForm(params[0])) {
    form = findForm(params[0]);
  }

  ctx.view.innerHTML = `
  <div class="tt">
    <aside class="tt-side" aria-label="Danh mục biểu mẫu">
      <div class="lg-search">${icon('search', 'ic-sm')}<input type="search" placeholder="Tìm biểu mẫu: khám xét, tạm giam…" aria-label="Tìm biểu mẫu" data-q /></div>
      <div class="tt-list" data-list></div>
    </aside>
    <section class="tt-main" data-main></section>
  </div>`;
  const root = ctx.view;
  const list = $('[data-list]', root);
  const main = $('[data-main]', root);
  const panes = mobilePanes($('.tt', root), [
    { id: 'side', el: $('.tt-side', root), label: 'Danh mục mẫu', icon: 'layers' },
    { id: 'main', el: main, label: form ? 'Biểu mẫu' : 'Giai đoạn', icon: 'file' },
  ], { initial: form ? 'main' : 'side' });

  /* ---------------- Danh mục ---------------- */
  function renderList() {
    const n = norm(q).trim();
    const docs = legalDocsRepo.list().slice(0, 8);
    let html = '';
    if (!n && docs.length) {
      html += `<div class="tt-stage open"><div class="tt-stage-h">${icon('clock', 'ic-sm')}<span>Văn bản đã lập gần đây</span></div><div class="tt-forms">${docs
        .map((d) => `<a class="tt-form-item ${d.id === docId ? 'active' : ''}" href="#forms/doc/${d.id}"><span class="tt-loai">${escapeHtml(LOAI[findForm(d.formId)?.loai] || '')}</span><span>${escapeHtml(d.title)}</span></a>`)
        .join('')}</div></div>`;
    }
    html += `<div class="tt-stage ${n || openStages.has('interview') ? 'open' : ''}"><button type="button" class="tt-stage-h" data-stage="interview">${icon('chevron-down', 'ic-sm lg-chev')}${icon('message', 'ic-sm')}<span>Biên bản ghi lời khai, hỏi cung (Mẫu 140)</span></button>${
      n || openStages.has('interview') ? `<div class="tt-forms"><a class="tt-form-item" href="#interview"><span class="tt-loai">Biên bản</span><span>Biên bản ghi lời khai / hỏi cung bị can — mở màn hình Ghi lời khai</span></a></div>` : ''
    }</div>`;
    for (const s of STAGES) {
      const forms = FORMS.filter((f) => f.giaiDoan === s.id && (!n || norm(f.ten + ' ' + LOAI[f.loai]).includes(n)));
      if (!forms.length) continue;
      const open = n || openStages.has(s.id) || forms.some((f) => f.id === form?.id);
      html += `<div class="tt-stage ${open ? 'open' : ''}"><button type="button" class="tt-stage-h" data-stage="${s.id}" aria-expanded="${!!open}">${icon('chevron-down', 'ic-sm lg-chev')}${icon(s.icon, 'ic-sm')}<span>${escapeHtml(s.ten)}</span><small>${forms.length}</small></button>${
        open ? `<div class="tt-forms">${forms.map((f) => `<a class="tt-form-item ${f.id === form?.id && !docId ? 'active' : ''}" href="#forms/${f.id}" data-form="${f.id}"><span class="tt-loai l-${f.loai}">${escapeHtml(LOAI[f.loai])}</span><span>${escapeHtml(f.ten)}</span></a>`).join('')}</div>` : ''
      }</div>`;
    }
    list.innerHTML = html || '<p class="lg-empty">Không tìm thấy biểu mẫu.</p>';
  }
  list.addEventListener('click', (e) => {
    const s = e.target.closest('[data-stage]');
    if (s) {
      const id = s.dataset.stage;
      openStages.has(id) ? openStages.delete(id) : openStages.add(id);
      store.set('forms-open', [...openStages]);
      renderList();
    }
  });
  $('[data-q]', root).addEventListener('input', debounce((e) => {
    q = e.target.value;
    renderList();
  }, 120));

  /* ---------------- Tổng quan ---------------- */
  function renderOverview() {
    main.innerHTML = `<div class="page tt-overview">
      <div class="page-head"><div><h1 class="page-title">Biểu mẫu <em>tố tụng hình sự</em></h1><p class="page-sub">${FORMS.length + 1} biểu mẫu dùng trong tiếp nhận, giải quyết nguồn tin và điều tra: quyết định, lệnh, biên bản, thông báo, giấy triệu tập, đề nghị, bản kết luận điều tra. Tự điền từ hồ sơ vụ án, xem trước và xuất Word.</p></div></div>
      <div class="tt-stage-grid">${STAGES.map((s) => `<button type="button" class="tt-stage-card" data-open-stage="${s.id}"><span class="quick-icon">${icon(s.icon)}</span><strong>${escapeHtml(s.ten)}</strong><em>${FORMS.filter((f) => f.giaiDoan === s.id).length} mẫu</em></button>`).join('')}</div>
      <p class="lg-disclaimer">${icon('info', 'ic-sm')}Nội dung biểu mẫu theo cấu trúc văn bản tố tụng thông dụng và Bộ luật Tố tụng hình sự 2015 (sửa đổi, bổ sung 2021, 2025). Số hiệu mẫu theo Thông tư 128/2025/TT-BCA nhập tại ô “Mẫu số” của từng mẫu (được ghi nhớ). Cần đối chiếu biểu mẫu chính thức trước khi ban hành; có thể tải biểu mẫu Word chính thức lên tại “Thư viện mẫu → Tạo mẫu từ file Word”.</p>
    </div>`;
    $$('[data-open-stage]', main).forEach((b) =>
      b.addEventListener('click', () => {
        openStages.add(b.dataset.openStage);
        store.set('forms-open', [...openStages]);
        renderList();
        panes.go('side');
        list.querySelector(`[data-stage="${b.dataset.openStage}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }),
    );
  }

  /* ---------------- Soạn biểu mẫu ---------------- */
  function caseOptions() {
    return `<option value="">— Không gắn hồ sơ —</option>${casesRepo
      .list()
      .map((c) => `<option value="${c.id}" ${c.id === caseId ? 'selected' : ''}>${escapeHtml(c.ten)}</option>`)
      .join('')}`;
  }
  function personOptions() {
    const c = caseId ? casesRepo.get(caseId) : null;
    return `<option value="">— Chọn người —</option>${(c?.persons || []).map((p) => `<option value="${p.id}" ${p.id === personId ? 'selected' : ''}>${escapeHtml(p.hoTen)}</option>`).join('')}`;
  }

  function renderEditor() {
    const o = org();
    if (!docId && values.mauSo === undefined) values.mauSo = o.formNos?.[form.id] || '';
    if (!values.ngayVb) values.ngayVb = today();
    const keys = formKeys(form);
    const isBB = form.loai === 'bb';
    main.innerHTML = `
      <div class="tt-editor">
        <div class="tt-head">
          <div><div class="tt-crumb">${escapeHtml(STAGES.find((s) => s.id === form.giaiDoan)?.ten || '')}</div><h1>${escapeHtml(form.ten)}</h1></div>
          <div class="inline">
            <button class="btn btn-sm btn-ghost" type="button" data-print>${icon('printer', 'ic-sm')}In</button>
            <button class="btn btn-sm" type="button" data-save>${icon('save', 'ic-sm')}${docId ? 'Lưu thay đổi' : 'Lưu vào hồ sơ'}</button>
            <button class="btn btn-sm btn-primary" type="button" data-export>${icon('download', 'ic-sm')}Xuất Word</button>
          </div>
        </div>
        <div class="tt-body">
          <form class="tt-fields" data-fields autocomplete="off">
            <fieldset class="fieldset"><legend>Tự điền từ hồ sơ</legend>
              <div class="field"><label for="tt-case">Hồ sơ vụ án</label><select class="select" id="tt-case" data-case>${caseOptions()}</select></div>
              <div class="field"><label for="tt-person">Người liên quan</label><select class="select" id="tt-person" data-person>${personOptions()}</select></div>
            </fieldset>
            <fieldset class="fieldset"><legend>Thông tin văn bản</legend><div class="grid-2">
              <div class="field"><label for="tt-mau">Mẫu số (TT 128/2025)</label><input class="input" id="tt-mau" name="mauSo" value="${escapeHtml(values.mauSo || '')}" placeholder="Để trống: không in" /></div>
              <div class="field"><label for="tt-ngay">Ngày ${isBB ? 'lập' : 'ban hành'}</label><input class="input" type="date" id="tt-ngay" name="ngayVb" value="${escapeHtml(values.ngayVb || '')}" /></div>
              ${isBB ? `<div class="field"><label for="tt-bd">Giờ bắt đầu</label><input class="input" type="time" id="tt-bd" name="gioBatDau" value="${escapeHtml(values.gioBatDau || '')}" /></div><div class="field"><label for="tt-kt">Giờ kết thúc</label><input class="input" type="time" id="tt-kt" name="gioKetThuc" value="${escapeHtml(values.gioKetThuc || '')}" /></div>` : ''}
            </div></fieldset>
            <fieldset class="fieldset"><legend>Nội dung</legend>
              ${keys
                .filter((k) => k !== 'so' || !isBB)
                .map((k) => {
                  const f = FIELDS[k];
                  const v = escapeHtml(values[k] || '');
                  const ai = AI_KEYS.has(k) ? `<button type="button" class="btn btn-ghost btn-sm tt-ai" data-ai="${k}" title="AI soạn nội dung">${icon('sparkles', 'ic-sm')}AI soạn</button>` : '';
                  return `<div class="field ${f.short ? 'tt-short' : ''}"><label for="tt-${k}">${escapeHtml(f.label)}${ai}</label>${
                    f.type === 'textarea' ? `<textarea class="textarea" id="tt-${k}" name="${k}" rows="${f.rows || 3}" placeholder="${escapeHtml(f.hint || '')}">${v}</textarea>` : `<input class="input" id="tt-${k}" name="${k}" value="${v}" placeholder="${escapeHtml(f.hint || '')}" />`
                  }</div>`;
                })
                .join('')}
            </fieldset>
          </form>
          <div class="tt-preview" data-stage><div class="cp-scale print-area" data-paper></div></div>
        </div>
      </div>`;
    const fieldsEl = $('[data-fields]', main);
    const paper = $('[data-paper]', main);
    const stage = $('[data-stage]', main);
    const readValues = () => $$('[name]', fieldsEl).forEach((el) => (values[el.name] = el.value));
    const preview = () => {
      paper.innerHTML = renderDocumentHtml(buildFormDocument(form, values, org()));
      const page = $('.vb-page', paper);
      const s = Math.min(1, Math.max(0.35, (stage.clientWidth - 32) / page.offsetWidth));
      paper.style.width = `${page.offsetWidth * s}px`;
      paper.style.height = `${page.offsetHeight * s}px`;
      page.style.transform = `scale(${s})`;
      page.style.transformOrigin = '0 0';
    };
    const update = debounce(() => {
      readValues();
      preview();
    }, 150);
    fieldsEl.addEventListener('input', update);
    fieldsEl.addEventListener('submit', (e) => e.preventDefault());
    $('#tt-mau', main).addEventListener('change', (e) => {
      const formNos = { ...(org().formNos || {}), [form.id]: e.target.value.trim() };
      ctx.saveSettings({ legalOrg: { ...org(), formNos } });
    });
    $('[data-case]', main).addEventListener('change', (e) => {
      caseId = e.target.value;
      personId = '';
      $('[data-person]', main).innerHTML = personOptions();
      applyPrefill();
    });
    $('[data-person]', main).addEventListener('change', (e) => {
      personId = e.target.value;
      applyPrefill();
    });
    $$('[data-ai]', main).forEach((b) => b.addEventListener('click', () => aiFill(b.dataset.ai, b)));
    $('[data-export]', main).addEventListener('click', () => {
      readValues();
      const doc = buildFormDocument(form, values, org());
      downloadBlob(buildDocx(doc, form.ten), safeFileName(`${form.ten}${values.hoTen ? '-' + values.hoTen : ''}`), DOCX_MIME);
      toast('Đã xuất tệp Word');
    });
    $('[data-print]', main).addEventListener('click', () => window.print());
    $('[data-save]', main).addEventListener('click', () => {
      readValues();
      const c = caseId ? casesRepo.get(caseId) : null;
      const rec = legalDocsRepo.save({ id: docId, formId: form.id, caseId: caseId || null, personId: personId || null, values: { ...values }, title: `${form.ten}${values.hoTen ? ' — ' + values.hoTen : ''}${c ? ' (' + c.ten + ')' : ''}` });
      const first = !docId;
      docId = rec.id;
      if (first) history.replaceState(null, '', `#forms/doc/${rec.id}`);
      $('[data-save]', main).innerHTML = `${icon('save', 'ic-sm')}Lưu thay đổi`;
      renderList();
      toast(first ? 'Đã lưu văn bản' : 'Đã lưu thay đổi');
    });
    const ro = new ResizeObserver(() => preview());
    ro.observe(stage);
    cleanups.push(() => ro.disconnect());
    preview();
  }

  function applyPrefill() {
    const c = caseId ? casesRepo.get(caseId) : null;
    const p = c?.persons?.find((x) => x.id === personId) || null;
    const pre = prefillFromCase({ caseItem: c, person: p, org: org() });
    let n = 0;
    for (const [k, v] of Object.entries(pre)) {
      if (!v) continue;
      const el = main.querySelector(`[name="${k}"]`);
      if (!el) continue;
      if (!el.value.trim() || personId || k === 'tenVu' || k === 'toiDanh') {
        el.value = v;
        values[k] = v;
        n++;
      }
    }
    main.querySelector('[data-fields]').dispatchEvent(new Event('input'));
    if (n) toast(`Đã điền ${n} trường từ hồ sơ`);
  }

  async function aiFill(key, btn) {
    if (!ctx.hasAI('legal')) {
      toast(ctx.can('legal.ai') ? 'Thêm API key trong Cài đặt để dùng AI' : 'Phân hệ Tố tụng đang ngoại tuyến — chưa được cấp quyền dùng AI trực tuyến', { type: 'info', timeout: 4500 });
      return;
    }
    const el = main.querySelector(`[name="${key}"]`);
    const known = Object.entries(values)
      .filter(([k, v]) => v && FIELDS[k] && k !== key)
      .map(([k, v]) => `- ${FIELDS[k].label}: ${v}`)
      .join('\n');
    btn.disabled = true;
    btn.innerHTML = `${icon('refresh', 'ic-sm spin')}Đang soạn…`;
    try {
      const out = await streamClaude({
        ...ctx.ai('legal'),
        system: INVESTIGATOR_SYSTEM,
        cache: true,
        messages: [{ role: 'user', content: `Soạn phần “${FIELDS[key].label}” cho văn bản tố tụng: ${form.ten}. Văn phong văn bản tố tụng hình sự, chính xác, khách quan; không bịa đặt sự kiện, số liệu ngoài thông tin đã có — chỗ nào thiếu để dạng [...]. Chỉ trả về nội dung phần đó, không tiêu đề.\n\nThông tin đã có:\n${known || '(chưa có)'}\n\nNội dung hiện tại của phần này: ${el.value || '(trống)'}` }],
      });
      el.value = out.trim();
      main.querySelector('[data-fields]').dispatchEvent(new Event('input'));
      toast('AI đã soạn nội dung — kiểm tra lại trước khi ban hành');
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 6000 });
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('sparkles', 'ic-sm')}AI soạn`;
    }
  }

  const cleanups = [];
  renderList();
  if (form) renderEditor();
  else renderOverview();
  return () => cleanups.forEach((f) => f());
}
