// Trình soạn thảo văn bản: biểu mẫu + xem trước A4 trực tiếp + AI + xuất Word/PDF.
import { $, $$, icon, toast, escapeHtml, copyText, downloadBlob, debounce } from '../ui.js';
import { DOC_TYPES, getDocType, buildDocument, documentToText, validate, sampleValues, withPlaceholders } from '../lib/doc-types.js';
import { renderDocumentHtml } from '../lib/render-html.js';
import { buildDocx, safeFileName } from '../lib/docx.js';
import { isoToday } from '../lib/vn-date.js';
import { store, docsRepo, usage } from '../lib/store.js';
import { streamClaude, composePrompt, extractJson, localCompose } from '../lib/ai.js';

const HEAD_KEYS = ['coQuanChuQuan', 'coQuan', 'vietTat', 'so', 'diaDanh', 'ngay'];
const SIGN_KEYS = ['quyenHan', 'tapThe', 'chucVu', 'nguoiKy', 'noiNhan'];
const SHARED_KEYS = [...HEAD_KEYS, ...SIGN_KEYS.filter((k) => k !== 'noiNhan')];
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function fieldHtml(f, value) {
  const id = `f-${f.key}`;
  const v = value ?? '';
  const req = f.required ? ' <span class="req" aria-hidden="true">*</span>' : '';
  let control;
  if (f.type === 'textarea') {
    control = `<textarea class="textarea" id="${id}" name="${f.key}" rows="${f.rows || 3}" placeholder="${escapeHtml(f.placeholder || '')}"${f.required ? ' aria-required="true"' : ''}>${escapeHtml(v)}</textarea>`;
  } else if (f.type === 'select') {
    control = `<select class="select" id="${id}" name="${f.key}">${f.options.map((o) => `<option value="${o}"${o === v ? ' selected' : ''}>${o || '— Không —'}</option>`).join('')}</select>`;
  } else {
    control = `<input class="input" id="${id}" name="${f.key}" type="${f.type === 'date' ? 'date' : 'text'}" value="${escapeHtml(v)}" placeholder="${escapeHtml(f.placeholder || '')}"${f.required ? ' aria-required="true"' : ''} autocomplete="off" />`;
  }
  return `<div class="field ${f.span === 2 || f.type === 'textarea' ? 'span-2' : ''}" data-field="${f.key}">
    <label for="${id}">${escapeHtml(f.label)}${req}</label>${control}
    ${f.hint ? `<span class="hint">${escapeHtml(f.hint)}</span>` : ''}
    <span class="err">Vui lòng nhập ${escapeHtml(f.label.toLowerCase().replace(/\s*\(.*\)/, ''))}</span>
  </div>`;
}

export function render(ctx, params = []) {
  const settings = ctx.settings();
  const orgDefaults = settings.org || {};
  const draft = store.get('compose-draft', null);

  // Xác định trạng thái ban đầu.
  let state;
  if (params[0] === 'doc' && params[1]) {
    const saved = docsRepo.get(params[1]);
    if (!saved) {
      toast('Không tìm thấy tài liệu', { type: 'error' });
      ctx.navigate('#docs');
      return;
    }
    state = { typeId: saved.typeId, values: { ...saved.values }, docId: saved.id };
  } else if (params[0] && getDocType(params[0])) {
    const carry = draft ? Object.fromEntries(SHARED_KEYS.map((k) => [k, draft.values[k]]).filter(([, v]) => v)) : {};
    state = { typeId: params[0], values: { ngay: isoToday(), diaDanh: 'Hà Nội', ...orgDefaults, ...carry }, docId: null };
    if (draft && draft.typeId === params[0] && !draft.docId) state.values = { ...state.values, ...draft.values };
  } else if (draft) {
    state = { typeId: draft.typeId, values: draft.values, docId: draft.docId || null };
  } else {
    state = { typeId: 'cong-van', values: { ngay: isoToday(), diaDanh: 'Hà Nội', ...orgDefaults }, docId: null };
  }
  if (!state.values.ngay) state.values.ngay = isoToday();
  if (!state.values.nguoiKy && ctx.user()) state.values.nguoiKy = '';

  let zoom = store.get('zoom', 'fit');
  let aiController = null;

  ctx.view.innerHTML = `
  <div class="compose" data-pane="form">
    <div class="mobile-tabs" role="tablist" aria-label="Chế độ xem">
      <button role="tab" aria-selected="true" data-pane-btn="form">${'Biểu mẫu'}</button>
      <button role="tab" aria-selected="false" data-pane-btn="preview">Xem trước</button>
    </div>
    <section class="compose-form" aria-label="Biểu mẫu văn bản">
      <div class="cf-head">
        <div class="type-tabs" role="tablist" aria-label="Loại văn bản">
          ${DOC_TYPES.map((t) => `<button class="type-tab" role="tab" type="button" data-type="${t.id}" aria-selected="${t.id === state.typeId}">${icon(t.icon, 'ic-sm')}${t.name}</button>`).join('')}
        </div>
        <div class="ai-box">
          <div class="ai-box-label">
            <span>${icon('sparkles', 'ic-sm')}Soạn nội dung bằng AI</span>
            <span class="badge ${ctx.hasAI() ? 'badge-success' : ''}" data-ai-badge>${ctx.hasAI() ? 'Claude' : 'Cơ bản'}</span>
          </div>
          <div class="ai-box-row">
            <textarea rows="1" placeholder="Mô tả ngắn: mục đích, đối tượng, thời gian…" aria-label="Mô tả yêu cầu cho AI" data-brief></textarea>
            <button class="btn btn-primary btn-icon" type="button" aria-label="Soạn bằng AI" title="Soạn bằng AI (Ctrl + Enter)" data-ai-run>${icon('send')}</button>
          </div>
        </div>
      </div>
      <form class="cf-body" novalidate data-form></form>
      <div class="cf-foot">
        <button class="btn btn-icon" type="button" title="Điền dữ liệu mẫu" aria-label="Điền dữ liệu mẫu" data-sample>${icon('wand')}</button>
        <button class="btn btn-icon" type="button" title="Văn bản mới" aria-label="Văn bản mới" data-reset>${icon('refresh')}</button>
        <button class="btn btn-primary" type="button" data-save>${icon('save')}Lưu văn bản <kbd class="kbd" style="background:rgba(255,255,255,.15);color:#fff;border-color:transparent">Ctrl S</kbd></button>
      </div>
    </section>
    <section class="compose-preview" aria-label="Xem trước văn bản">
      <div class="cp-bar">
        <span class="status-pill" data-status></span>
        <span class="spacer"></span>
        <div class="zoom-ctl" role="group" aria-label="Thu phóng">
          <button type="button" aria-label="Thu nhỏ" data-zoom="-">${icon('zoom-out', 'ic-sm')}</button>
          <span data-zoom-label>100%</span>
          <button type="button" aria-label="Phóng to" data-zoom="+">${icon('zoom-in', 'ic-sm')}</button>
        </div>
        <button class="btn btn-sm" type="button" data-copy title="Sao chép nội dung">${icon('copy', 'ic-sm')}<span class="btn-label">Sao chép</span></button>
        <button class="btn btn-sm" type="button" data-print title="In hoặc lưu PDF">${icon('printer', 'ic-sm')}<span class="btn-label">In / PDF</span></button>
        <button class="btn btn-sm btn-dark" type="button" data-export>${icon('download', 'ic-sm')}<span class="btn-label">Xuất Word</span></button>
      </div>
      <div class="cp-stage" data-stage><div class="cp-scale print-area" data-paper></div></div>
    </section>
  </div>`;

  const root = ctx.view;
  const form = $('[data-form]', root);
  const paper = $('[data-paper]', root);
  const stage = $('[data-stage]', root);
  const status = $('[data-status]', root);
  const brief = $('[data-brief]', root);

  /* ----- Biểu mẫu ----- */
  function renderForm() {
    const type = getDocType(state.typeId);
    const head = type.fields.filter((f) => HEAD_KEYS.includes(f.key));
    const sign = type.fields.filter((f) => SIGN_KEYS.includes(f.key));
    const body = type.fields.filter((f) => !HEAD_KEYS.includes(f.key) && !SIGN_KEYS.includes(f.key));
    const group = (title, fields) => (fields.length ? `<fieldset class="fieldset"><legend>${title}</legend><div class="grid-2">${fields.map((f) => fieldHtml(f, state.values[f.key])).join('')}</div></fieldset>` : '');
    form.innerHTML = group('Nội dung văn bản', body) + group('Cơ quan ban hành', head) + group('Người ký &amp; nơi nhận', sign);
  }

  function readForm() {
    $$('[name]', form).forEach((el) => (state.values[el.name] = el.value));
  }

  /* ----- Xem trước ----- */
  function applyZoom() {
    const page = $('.vb-page', paper);
    if (!page) return;
    const pageW = page.offsetWidth;
    const avail = stage.clientWidth - 48;
    const s = zoom === 'fit' ? Math.min(1.2, Math.max(0.3, avail / pageW)) : zoom;
    paper.style.setProperty('--s', s);
    paper.style.width = `${pageW * s}px`;
    paper.style.height = `${page.offsetHeight * s}px`;
    page.style.transform = `scale(${s})`;
    page.style.transformOrigin = '0 0';
    $('[data-zoom-label]', root).textContent = zoom === 'fit' ? `Vừa (${Math.round(s * 100)}%)` : `${Math.round(s * 100)}%`;
  }

  function currentDoc() {
    return buildDocument(state.typeId, state.values);
  }

  function renderPreview() {
    paper.innerHTML = renderDocumentHtml(buildDocument(state.typeId, withPlaceholders(state.typeId, state.values)));
    applyZoom();
    const missing = validate(state.typeId, state.values);
    status.className = `status-pill ${missing.length ? 'warn' : 'ok'}`;
    status.innerHTML = missing.length ? `${icon('alert', 'ic-sm')}Còn ${missing.length} trường bắt buộc` : `${icon('check-circle', 'ic-sm')}Đúng thể thức NĐ 30`;
  }

  const saveDraft = debounce(() => store.set('compose-draft', { typeId: state.typeId, values: state.values, docId: state.docId }), 300);

  function refresh() {
    readForm();
    renderPreview();
    saveDraft();
  }

  function markInvalid(missing) {
    $$('.field', form).forEach((f) => f.classList.remove('invalid'));
    missing.forEach((m) => {
      const fld = $(`[data-field="${m.key}"]`, form);
      fld?.classList.add('invalid');
      fld?.querySelector('[name]')?.setAttribute('aria-invalid', 'true');
    });
    if (missing.length) {
      setPane('form');
      const first = $('.field.invalid [name]', form);
      first?.focus();
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function requireValid(action) {
    readForm();
    const missing = validate(state.typeId, state.values);
    if (missing.length) {
      markInvalid(missing);
      toast(`Vui lòng điền ${missing.length} trường bắt buộc trước khi ${action}`, { type: 'error' });
      return false;
    }
    return true;
  }

  form.addEventListener('input', (e) => {
    const fld = e.target.closest('.field');
    if (fld?.classList.contains('invalid') && e.target.value.trim()) {
      fld.classList.remove('invalid');
      e.target.removeAttribute('aria-invalid');
    }
    refresh();
  });
  form.addEventListener('change', refresh);
  form.addEventListener('submit', (e) => e.preventDefault());

  /* ----- Đổi loại văn bản ----- */
  $$('[data-type]', root).forEach((btn) =>
    btn.addEventListener('click', () => {
      if (btn.dataset.type === state.typeId) return;
      readForm();
      const shared = Object.fromEntries(SHARED_KEYS.map((k) => [k, state.values[k]]));
      state = { typeId: btn.dataset.type, values: { ...shared }, docId: null };
      $$('[data-type]', root).forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      renderForm();
      renderPreview();
      saveDraft();
      history.replaceState(null, '', `#compose/${state.typeId}`);
    }),
  );

  /* ----- AI ----- */
  const aiBtn = $('[data-ai-run]', root);
  function setAiBusy(busy) {
    aiBtn.innerHTML = busy ? icon('stop') : icon('send');
    aiBtn.setAttribute('aria-label', busy ? 'Dừng' : 'Soạn bằng AI');
    $('.vb-page', paper)?.classList.toggle('generating', busy);
    brief.disabled = busy;
  }

  function applyDraft(r) {
    if (!r) return false;
    if (r.trichYeu) state.values.trichYeu = String(r.trichYeu).replace(/^(v\/v|về việc)\s*/i, '');
    if (r.noiDung) state.values.noiDung = Array.isArray(r.noiDung) ? r.noiDung.join('\n') : String(r.noiDung);
    if (r.canCu && state.typeId === 'quyet-dinh') state.values.canCu = Array.isArray(r.canCu) ? r.canCu.join('\n') : String(r.canCu);
    renderForm();
    renderPreview();
    saveDraft();
    ['trichYeu', 'noiDung', 'canCu'].forEach((k) => {
      const el = $(`[name="${k}"]`, form);
      el?.animate([{ boxShadow: '0 0 0 4px color-mix(in srgb, var(--accent) 30%, transparent)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1200 });
    });
    return true;
  }

  async function runAI() {
    if (aiController) {
      aiController.abort();
      return;
    }
    const text = brief.value.trim();
    if (!text) {
      brief.focus();
      toast('Hãy mô tả ngắn gọn văn bản bạn cần soạn', { type: 'info' });
      return;
    }
    readForm();
    usage.track('ai');
    if (!ctx.hasAI()) {
      applyDraft(localCompose(state.typeId, text, state.values));
      toast('Đã tạo bản nháp từ mẫu cơ bản. Thêm API key để AI soạn chi tiết hơn.', { type: 'info', timeout: 4200 });
      return;
    }
    const { apiKey, model } = ctx.settings();
    aiController = new AbortController();
    setAiBusy(true);
    try {
      const out = await streamClaude({
        apiKey,
        model,
        messages: [{ role: 'user', content: composePrompt(state.typeId, text, state.values) }],
        signal: aiController.signal,
        onText: (_, all) => {
          aiBtn.title = `Đang soạn… ${all.length} ký tự`;
        },
      });
      const parsed = extractJson(out);
      if (!applyDraft(parsed || { noiDung: out })) throw new Error('Không đọc được kết quả từ AI');
      toast('AI đã soạn xong nội dung. Hãy rà soát trước khi ban hành.');
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 5000 });
    } finally {
      aiController = null;
      setAiBusy(false);
      aiBtn.title = 'Soạn bằng AI (Ctrl + Enter)';
    }
  }
  aiBtn.addEventListener('click', runAI);
  brief.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
      e.preventDefault();
      runAI();
    }
  });
  brief.addEventListener('input', () => {
    brief.style.height = 'auto';
    brief.style.height = `${Math.min(140, brief.scrollHeight)}px`;
  });

  /* ----- Thao tác ----- */
  function title() {
    const type = getDocType(state.typeId);
    const ty = String(state.values.trichYeu || '').trim();
    return ty ? `${type.name} ${ty.replace(/^(v\/v|về việc)\s*/i, '')}` : `${type.name} chưa đặt tên`;
  }

  function save() {
    if (!requireValid('lưu')) return;
    const doc = currentDoc();
    const rec = docsRepo.save({ id: state.docId || undefined, typeId: state.typeId, title: title(), values: { ...state.values }, text: documentToText(doc), createdAt: state.docId ? docsRepo.get(state.docId)?.createdAt : undefined });
    state.docId = rec.id;
    store.set('compose-draft', { typeId: state.typeId, values: state.values, docId: state.docId });
    history.replaceState(null, '', `#compose/doc/${rec.id}`);
    document.dispatchEvent(new CustomEvent('docs-changed'));
    toast('Đã lưu vào Tài liệu của tôi');
  }

  $('[data-save]', root).addEventListener('click', save);

  $('[data-export]', root).addEventListener('click', () => {
    if (!requireValid('xuất tệp')) return;
    const bytes = buildDocx(currentDoc(), title());
    downloadBlob(bytes, safeFileName(title()), DOCX_MIME);
    usage.track('export');
    toast('Đã xuất tệp Word (.docx)');
  });

  $('[data-print]', root).addEventListener('click', () => {
    readForm();
    renderPreview();
    usage.track('print');
    window.print();
  });

  $('[data-copy]', root).addEventListener('click', async () => {
    readForm();
    await copyText(documentToText(currentDoc()));
    toast('Đã sao chép nội dung văn bản');
  });

  $('[data-sample]', root).addEventListener('click', () => {
    state.values = { ...sampleValues(state.typeId, isoToday()), ...Object.fromEntries(Object.entries(orgDefaults).filter(([, v]) => v)) };
    renderForm();
    renderPreview();
    saveDraft();
    toast('Đã điền dữ liệu mẫu');
  });

  $('[data-reset]', root).addEventListener('click', async () => {
    if (!(await ctx.confirm('Bắt đầu văn bản mới? Nội dung chưa lưu sẽ bị xóa (thông tin cơ quan được giữ lại).', { title: 'Văn bản mới', okText: 'Tạo mới' }))) return;
    readForm();
    const shared = Object.fromEntries(SHARED_KEYS.map((k) => [k, state.values[k]]));
    state = { typeId: state.typeId, values: { ...shared, ngay: isoToday(), so: '' }, docId: null };
    renderForm();
    renderPreview();
    saveDraft();
    history.replaceState(null, '', `#compose/${state.typeId}`);
  });

  /* ----- Thu phóng ----- */
  $$('[data-zoom]', root).forEach((b) =>
    b.addEventListener('click', () => {
      const cur = parseFloat(paper.style.getPropertyValue('--s')) || 1;
      zoom = Math.round(Math.min(1.6, Math.max(0.3, cur + (b.dataset.zoom === '+' ? 0.1 : -0.1))) * 10) / 10;
      store.set('zoom', zoom);
      applyZoom();
    }),
  );
  $('[data-zoom-label]', root).addEventListener('dblclick', () => {
    zoom = 'fit';
    store.set('zoom', zoom);
    applyZoom();
  });
  const ro = new ResizeObserver(() => applyZoom());
  ro.observe(stage);

  /* ----- Mobile: chuyển giữa biểu mẫu và xem trước ----- */
  function setPane(p) {
    $('.compose', root).dataset.pane = p;
    $$('[data-pane-btn]', root).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.paneBtn === p)));
    if (p === 'preview') requestAnimationFrame(applyZoom);
  }
  $$('[data-pane-btn]', root).forEach((b) => b.addEventListener('click', () => setPane(b.dataset.paneBtn)));

  /* ----- Phím tắt ----- */
  const onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  };
  document.addEventListener('keydown', onKey);

  renderForm();
  renderPreview();

  // Nhận bản nháp chuyển từ Trợ lý AI.
  if (ctx.handoff?.compose) {
    const h = ctx.handoff.compose;
    ctx.handoff = null;
    if (h.typeId !== state.typeId) $(`[data-type="${h.typeId}"]`, root)?.click();
    applyDraft(h.draft);
  }

  return () => {
    document.removeEventListener('keydown', onKey);
    ro.disconnect();
    aiController?.abort();
  };
}
