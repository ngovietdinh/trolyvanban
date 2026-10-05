// Tạo mẫu văn bản từ tệp Word: tải lên → nhận diện trường (quy tắc hoặc AI chắt lọc) → xem trước → lưu → điền và xuất Word.
import { $, $$, icon, toast, escapeHtml, downloadBlob } from '../ui.js';
import { store, uid, usage } from '../lib/store.js';
import { safeFileName } from '../lib/docx.js';
import { streamClaude, extractJson } from '../lib/ai.js';
import { parseTemplateDocx, fillTemplateDocx, detectFields, addField, fieldsFromAi, numberedText, TEMPLATE_AI_PROMPT, bytesToBase64, base64ToBytes } from '../lib/tpl-docx.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_SIZE = 1.5 * 1024 * 1024;
const KEY = 'tpl-custom';

/** Kho mẫu Word của tài khoản hiện tại (lưu trên máy). */
export const customTemplates = {
  list: () => store.get(KEY, []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
  get: (id) => store.get(KEY, []).find((t) => t.id === id) || null,
  save(t) {
    const all = store.get(KEY, []);
    const now = Date.now();
    const rec = { ...t, id: t.id || uid(), createdAt: t.createdAt || now, updatedAt: now };
    const i = all.findIndex((x) => x.id === rec.id);
    if (i >= 0) all[i] = rec;
    else all.push(rec);
    store.set(KEY, all);
    // store.set nuốt lỗi hết dung lượng — kiểm tra lại để báo người dùng.
    if (!store.get(KEY, []).some((x) => x.id === rec.id && x.updatedAt === now)) throw new Error('Không đủ dung lượng lưu trữ trên trình duyệt. Hãy xóa bớt mẫu cũ hoặc dùng tệp nhỏ hơn.');
    return rec;
  },
  remove(id) {
    store.set(
      KEY,
      store.get(KEY, []).filter((t) => t.id !== id),
    );
  },
};

export function render(ctx, params = []) {
  const id = params[0] && params[0] !== 'new' ? params[0] : null;
  let state = null; // { id, ten, moTa, fileName, bytes, paragraphs, fields, values, mode }
  let busy = null;

  if (id) {
    const t = customTemplates.get(id);
    if (!t) {
      toast('Không tìm thấy mẫu', { type: 'error' });
      ctx.navigate('#templates');
      return;
    }
    ctx.view.innerHTML = `<div class="page"><p class="hint">Đang mở mẫu…</p></div>`;
    const bytes = base64ToBytes(t.docx);
    parseTemplateDocx(bytes)
      .then((parsed) => {
        state = { ...t, bytes, paragraphs: parsed.paragraphs, fields: t.fields || [], values: {}, mode: 'fill' };
        renderEditor();
      })
      .catch((err) => {
        ctx.view.innerHTML = `<div class="page"><p class="note warn">${escapeHtml(err.message)}</p></div>`;
      });
  } else renderUpload();

  function renderUpload() {
    ctx.view.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1 class="page-title">Tạo mẫu từ <em>file Word</em></h1><p class="page-sub">Tải lên văn bản .docx có sẵn — hệ thống nhận diện các phần cần điền (số, ngày tháng, họ tên, địa chỉ, số tiền…), AI chắt lọc thành mẫu, xem trước rồi lưu để dùng lại.</p></div>
        <a class="btn" href="#templates">${icon('chevron-left', 'ic-sm')}Thư viện mẫu</a>
      </div>
      <section class="panel tpl-upload">
        <div class="panel-body">
          <label class="dropzone dropzone-lg" data-drop>
            <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" data-file aria-label="Chọn tệp Word (.docx)" />
            <span class="dz-icon">${icon('upload')}</span>
            <span><strong>Chọn hoặc kéo thả tệp Word (.docx)</strong><small>Tối đa 1,5 MB · tệp được xử lý và lưu ngay trên máy của bạn</small></span>
          </label>
          <ul class="tpl-steps">
            <li><span>1</span>Tải lên văn bản mẫu</li>
            <li><span>2</span>Nhận diện trường tự động hoặc bằng AI</li>
            <li><span>3</span>Xem trước, chỉnh sửa trường</li>
            <li><span>4</span>Lưu mẫu, điền và xuất Word</li>
          </ul>
        </div>
      </section>
    </div>`;
    const input = $('[data-file]', ctx.view);
    input.addEventListener('change', () => input.files[0] && loadFile(input.files[0]));
    const drop = $('[data-drop]', ctx.view);
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('drag');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('drag');
      const f = e.dataTransfer.files[0];
      if (f) loadFile(f);
    });
  }

  async function loadFile(file) {
    if (!/\.docx$/i.test(file.name)) return toast('Chỉ hỗ trợ tệp Word định dạng .docx', { type: 'error' });
    if (file.size > MAX_SIZE) return toast('Tệp lớn hơn 1,5 MB — hãy xóa bớt hình ảnh trong văn bản rồi thử lại', { type: 'error', timeout: 5000 });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = await parseTemplateDocx(bytes);
      if (!parsed.paragraphs.length) throw new Error('Văn bản không có nội dung chữ');
      const fields = detectFields(parsed.paragraphs);
      state = { id: null, ten: file.name.replace(/\.docx$/i, ''), moTa: '', fileName: file.name, bytes, paragraphs: parsed.paragraphs, fields, values: {}, mode: 'setup' };
      renderEditor();
      toast(`Đã đọc ${parsed.paragraphs.length} đoạn · nhận diện ${fields.length} trường cần điền`);
    } catch (err) {
      toast(err.message || 'Không đọc được tệp', { type: 'error' });
    }
  }

  /* ---------------- Trình chỉnh sửa ---------------- */
  function renderEditor() {
    ctx.view.innerHTML = `
    <div class="page tpl-editor">
      <div class="page-head">
        <div><h1 class="page-title">${state.id ? 'Mẫu' : 'Mẫu mới'}: <em data-title>${escapeHtml(state.ten)}</em></h1><p class="page-sub">${escapeHtml(state.fileName || '')} · ${state.paragraphs.length} đoạn văn</p></div>
        <div class="inline">
          <a class="btn btn-ghost" href="#templates">${icon('chevron-left', 'ic-sm')}Thư viện</a>
          <button class="btn" type="button" data-save>${icon('save', 'ic-sm')}${state.id ? 'Lưu thay đổi' : 'Lưu mẫu'}</button>
          <button class="btn btn-primary" type="button" data-export>${icon('download', 'ic-sm')}Xuất Word</button>
        </div>
      </div>
      <div class="tpl-layout">
        <section class="panel tpl-side">
          <div class="panel-body tpl-meta">
            <div class="field"><label for="tpl-ten">Tên mẫu</label><input class="input" id="tpl-ten" data-ten value="${escapeHtml(state.ten)}" /></div>
            <div class="field"><label for="tpl-mota">Mô tả</label><input class="input" id="tpl-mota" data-mota value="${escapeHtml(state.moTa || '')}" placeholder="Dùng khi nào, cho ai…" /></div>
            <div class="inline">
              <button class="btn btn-sm" type="button" data-ai title="AI đọc văn bản và chắt lọc các trường cần điền">${icon('sparkles', 'ic-sm')}AI chắt lọc mẫu</button>
              <button class="btn btn-sm btn-ghost" type="button" data-detect title="Nhận diện lại bằng quy tắc (không dùng AI)">${icon('refresh', 'ic-sm')}Nhận diện lại</button>
            </div>
          </div>
          <div class="tpl-fields-head">
            <strong>Trường cần điền <span class="badge" data-count></span></strong>
            <div class="seg" role="group" aria-label="Chế độ">
              <button type="button" data-mode="setup">Thiết lập</button>
              <button type="button" data-mode="fill">Điền nội dung</button>
            </div>
          </div>
          <div class="tpl-fields" data-fields></div>
          <p class="hint tpl-tip">${icon('info', 'ic-sm')}Bôi đen chữ trong bản xem trước để tạo trường mới.</p>
        </section>
        <section class="tpl-preview-wrap">
          <div class="tpl-preview-bar"><span data-preview-label></span><button class="btn btn-ghost btn-sm" type="button" data-clear-values>${icon('trash', 'ic-sm')}Xóa nội dung đã điền</button></div>
          <div class="tpl-preview" data-preview><article class="tpl-doc" data-doc></article></div>
          <button class="btn btn-dark btn-sm tpl-make-field" type="button" data-make hidden>${icon('plus', 'ic-sm')}Tạo trường</button>
        </section>
      </div>
    </div>`;
    const root = ctx.view;
    $('[data-ten]', root).addEventListener('input', (e) => {
      state.ten = e.target.value;
      $('[data-title]', root).textContent = state.ten || 'Chưa đặt tên';
    });
    $('[data-mota]', root).addEventListener('input', (e) => (state.moTa = e.target.value));
    $('[data-save]', root).addEventListener('click', saveTemplate);
    $('[data-export]', root).addEventListener('click', exportDocx);
    $('[data-ai]', root).addEventListener('click', aiExtract);
    $('[data-detect]', root).addEventListener('click', async () => {
      if (state.fields.length && !(await ctx.confirm('Thay danh sách trường hiện tại bằng kết quả nhận diện tự động?', { title: 'Nhận diện lại', okText: 'Nhận diện lại' }))) return;
      state.fields = detectFields(state.paragraphs);
      renderFields();
      renderPreview();
      toast(`Nhận diện ${state.fields.length} trường`);
    });
    $$('[data-mode]', root).forEach((b) =>
      b.addEventListener('click', () => {
        state.mode = b.dataset.mode;
        renderFields();
        renderPreview();
      }),
    );
    $('[data-clear-values]', root).addEventListener('click', () => {
      state.values = {};
      renderFields();
      renderPreview();
    });
    bindFields();
    bindSelection();
    renderFields();
    renderPreview();
  }

  function renderFields() {
    const root = ctx.view;
    $$('[data-mode]', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
    $('[data-count]', root).textContent = state.fields.length;
    const host = $('[data-fields]', root);
    if (!state.fields.length) {
      host.innerHTML = `<div class="tpl-empty">${icon('wand', 'ic-lg')}<p>Chưa có trường nào. Dùng <strong>AI chắt lọc mẫu</strong> hoặc bôi đen chữ trong bản xem trước để tạo trường.</p></div>`;
      return;
    }
    host.innerHTML = state.fields
      .map((f) =>
        state.mode === 'setup'
          ? `<div class="tpl-field" data-key="${f.key}">
              <div class="tpl-field-row"><input class="input input-sm" data-label value="${escapeHtml(f.label)}" aria-label="Tên trường" /><button type="button" class="btn btn-ghost btn-sm btn-icon" data-locate aria-label="Xem vị trí trường ${escapeHtml(f.label)}">${icon('eye', 'ic-sm')}</button><button type="button" class="btn btn-ghost btn-sm btn-icon" data-del aria-label="Xóa trường ${escapeHtml(f.label)}">${icon('trash', 'ic-sm')}</button></div>
              <small class="tpl-find" title="${escapeHtml(f.find)}">“${escapeHtml(f.find.length > 60 ? `${f.find.slice(0, 57)}…` : f.find)}” · ${f.locs.length} vị trí</small>
              <input class="input input-sm" data-hint value="${escapeHtml(f.hint || '')}" placeholder="Gợi ý cách điền (tùy chọn)" aria-label="Gợi ý cách điền ${escapeHtml(f.label)}" />
            </div>`
          : `<div class="tpl-field" data-key="${f.key}">
              <label for="tf-${f.key}">${escapeHtml(f.label)}</label>
              ${f.find.length > 70 ? `<textarea class="textarea" rows="3" id="tf-${f.key}" data-value placeholder="${escapeHtml(f.hint || f.find)}">${escapeHtml(state.values[f.key] || '')}</textarea>` : `<input class="input" id="tf-${f.key}" data-value value="${escapeHtml(state.values[f.key] || '')}" placeholder="${escapeHtml(f.hint || f.find)}" />`}
            </div>`,
      )
      .join('');
  }

  function bindFields() {
    const host = $('[data-fields]', ctx.view);
    const fieldOf = (el) => state.fields.find((f) => f.key === el.closest('[data-key]')?.dataset.key);
    host.addEventListener('input', (e) => {
      const f = fieldOf(e.target);
      if (!f) return;
      if (e.target.matches('[data-label]')) f.label = e.target.value;
      else if (e.target.matches('[data-hint]')) f.hint = e.target.value;
      else if (e.target.matches('[data-value]')) {
        state.values[f.key] = e.target.value;
        renderPreview();
      }
    });
    host.addEventListener('focusin', (e) => {
      const f = fieldOf(e.target);
      if (f) highlight(f.key);
    });
    host.addEventListener('click', (e) => {
      const f = fieldOf(e.target);
      if (!f) return;
      if (e.target.closest('[data-del]')) {
        state.fields = state.fields.filter((x) => x !== f);
        delete state.values[f.key];
        renderFields();
        renderPreview();
      } else if (e.target.closest('[data-locate]')) highlight(f.key, true);
    });
  }

  function highlight(key, scroll) {
    const doc = $('[data-doc]', ctx.view);
    $$('mark.on', doc).forEach((m) => m.classList.remove('on'));
    const marks = $$(`mark[data-f="${key}"]`, doc);
    marks.forEach((m) => m.classList.add('on'));
    if (scroll) marks[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderPreview() {
    const fill = state.mode === 'fill';
    $('[data-preview-label]', ctx.view).textContent = fill ? 'Bản xem trước sau khi điền' : 'Mẫu gốc — phần tô màu là trường cần điền';
    $('[data-clear-values]', ctx.view).hidden = !fill;
    const doc = $('[data-doc]', ctx.view);
    let lastPart = null;
    doc.innerHTML = state.paragraphs
      .map((p, idx) => {
        const locs = state.fields
          .flatMap((f) => f.locs.filter((l) => l.part === p.part && l.i === p.i).map((l) => ({ ...l, f })))
          .sort((a, b) => a.s - b.s);
        let html = '';
        let pos = 0;
        for (const l of locs) {
          if (l.s < pos) continue;
          html += escapeHtml(p.text.slice(pos, l.s));
          const v = state.values[l.f.key];
          const shown = fill && v ? v : p.text.slice(l.s, l.e);
          html += `<mark data-f="${l.f.key}" class="${fill && v ? 'filled' : ''}" title="${escapeHtml(l.f.label)}">${escapeHtml(shown)}</mark>`;
          pos = l.e;
        }
        html += escapeHtml(p.text.slice(pos));
        const sep = lastPart && p.part !== lastPart ? '<hr class="tpl-part-sep" />' : '';
        lastPart = p.part;
        const cls = [`al-${p.align === 'center' ? 'center' : p.align === 'right' || p.align === 'end' ? 'right' : p.align === 'both' ? 'justify' : 'left'}`, p.bold ? 'b' : '', p.part.includes('document') ? '' : 'hf'].filter(Boolean).join(' ');
        return `${sep}<p class="${cls}" data-p="${idx}">${html}</p>`;
      })
      .join('');
  }

  /* ----- Bôi đen để tạo trường ----- */
  function bindSelection() {
    const doc = $('[data-doc]', ctx.view);
    const btn = $('[data-make]', ctx.view);
    const wrap = $('.tpl-preview-wrap', ctx.view);
    let pending = null;
    const update = () => {
      const s = window.getSelection();
      pending = null;
      btn.hidden = true;
      if (!s || s.isCollapsed || !s.rangeCount) return;
      const r = s.getRangeAt(0);
      const pa = r.startContainer.parentElement?.closest('[data-p]');
      const pb = r.endContainer.parentElement?.closest('[data-p]');
      if (!pa || pa !== pb || !doc.contains(pa)) return;
      const text = s.toString();
      if (!text.trim() || text.length > 300) return;
      const pre = document.createRange();
      pre.selectNodeContents(pa);
      pre.setEnd(r.startContainer, r.startOffset);
      pending = { para: +pa.dataset.p, start: pre.toString().length, text };
      const rect = r.getBoundingClientRect();
      const box = wrap.getBoundingClientRect();
      btn.style.top = `${rect.bottom - box.top + 6}px`;
      btn.style.left = `${Math.max(0, Math.min(box.width - 140, rect.left - box.left))}px`;
      btn.hidden = false;
    };
    doc.addEventListener('mouseup', () => setTimeout(update, 0));
    doc.addEventListener('keyup', () => setTimeout(update, 0));
    document.addEventListener('selectionchange', onSel);
    function onSel() {
      if (!document.body.contains(btn)) return document.removeEventListener('selectionchange', onSel);
      const s = window.getSelection();
      if (!s || s.isCollapsed) btn.hidden = true;
    }
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      if (!pending) return;
      const sel = pending;
      const p = state.paragraphs[sel.para];
      // Tránh lệch vị trí khi đang ở chế độ điền: luôn tạo trường dựa trên văn bản gốc.
      const find = state.mode === 'fill' ? sel.text : p.text.slice(sel.start, sel.start + sel.text.length) === sel.text ? sel.text : sel.text.trim();
      fieldDialog(find, sel.para);
      btn.hidden = true;
    });
  }

  function fieldDialog(find, para) {
    const many = state.paragraphs.reduce((n, p) => n + p.text.split(find).length - 1, 0);
    ctx.modal(
      `<h2 class="modal-title">Tạo trường cần điền</h2>
       <form class="auth-form" data-f>
         <p class="tpl-find-box">“${escapeHtml(find)}”</p>
         <div class="field"><label for="nf-label">Tên trường</label><input class="input" id="nf-label" name="label" required placeholder="VD: Họ và tên người nhận" /></div>
         <div class="field"><label for="nf-hint">Gợi ý cách điền</label><input class="input" id="nf-hint" name="hint" placeholder="Tùy chọn" /></div>
         ${many > 1 ? `<label class="check"><input type="checkbox" name="all" checked />Thay ở cả ${many} vị trí xuất hiện</label>` : ''}
         <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit">${icon('plus', 'ic-sm')}Tạo trường</button></div>
       </form>`,
      {
        label: 'Tạo trường',
        onMount(box, close) {
          box.querySelector('[name="label"]').focus();
          box.querySelector('[data-f]').addEventListener('submit', (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.target));
            const made = addField(state.fields, state.paragraphs, { label: f.label.trim(), hint: f.hint, find, para, all: many > 1 ? f.all === 'on' : false });
            if (!made) return toast('Đoạn chữ này trùng với trường đã có', { type: 'error' });
            close();
            window.getSelection()?.removeAllRanges();
            renderFields();
            renderPreview();
            highlight(made.key);
            toast(`Đã tạo trường “${made.label}”`);
          });
        },
      },
    );
  }

  /* ----- AI chắt lọc ----- */
  async function aiExtract() {
    if (!ctx.hasAI()) {
      toast(ctx.can('ai') ? 'Thêm API key (ChatGPT, Gemini, Grok hoặc Claude) trong Cài đặt để dùng AI chắt lọc mẫu' : 'Tài khoản chưa được cấp quyền dùng AI trực tuyến — dùng “Nhận diện lại” hoặc bôi đen để tạo trường', { type: 'info', timeout: 4500 });
      return;
    }
    if (busy) return;
    const btn = $('[data-ai]', ctx.view);
    btn.disabled = true;
    btn.innerHTML = `${icon('refresh', 'ic-sm spin')}AI đang đọc văn bản…`;
    busy = true;
    try {
      const { provider, apiKey, model } = ctx.ai();
      usage.track('ai');
      const out = await streamClaude({ provider, apiKey, model, cache: true, messages: [{ role: 'user', content: `${TEMPLATE_AI_PROMPT}\n\n---\n${numberedText(state.paragraphs)}` }] });
      const j = extractJson(out);
      if (!j) throw new Error('AI không trả về kết quả đúng định dạng. Thử lại.');
      const { fields, added } = fieldsFromAi(state.paragraphs, j, state.fields);
      state.fields = fields;
      if (j.ten && (!state.id || !state.ten.trim())) state.ten = String(j.ten).trim();
      if (j.moTa && !String(state.moTa || '').trim()) state.moTa = String(j.moTa).trim();
      $('[data-ten]', ctx.view).value = state.ten;
      $('[data-title]', ctx.view).textContent = state.ten;
      $('[data-mota]', ctx.view).value = state.moTa;
      state.mode = 'setup';
      renderFields();
      renderPreview();
      toast(added.length ? `AI chắt lọc thêm ${added.length} trường — kiểm tra lại trong bản xem trước` : 'AI không tìm thấy trường mới', { timeout: 4000 });
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 5000 });
    } finally {
      busy = null;
      btn.disabled = false;
      btn.innerHTML = `${icon('sparkles', 'ic-sm')}AI chắt lọc mẫu`;
    }
  }

  /* ----- Lưu, xuất ----- */
  function saveTemplate() {
    if (!state.ten.trim()) {
      $('[data-ten]', ctx.view).focus();
      return toast('Đặt tên cho mẫu trước khi lưu', { type: 'error' });
    }
    try {
      const rec = customTemplates.save({
        id: state.id,
        createdAt: state.createdAt,
        ten: state.ten.trim(),
        moTa: String(state.moTa || '').trim(),
        fileName: state.fileName,
        size: state.bytes.length,
        docx: state.docx || bytesToBase64(state.bytes),
        fields: state.fields.map(({ key, label, find, hint, locs }) => ({ key, label, find, hint, locs: locs.map(({ part, i, s, e }) => ({ part, i, s, e })) })),
      });
      const first = !state.id;
      state.id = rec.id;
      state.createdAt = rec.createdAt;
      state.docx = rec.docx;
      if (first) {
        history.replaceState(null, '', `#tpl/${rec.id}`);
        $('[data-save]', ctx.view).innerHTML = `${icon('save', 'ic-sm')}Lưu thay đổi`;
      }
      toast(first ? 'Đã lưu mẫu vào “Mẫu của tôi”' : 'Đã lưu thay đổi');
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 6000 });
    }
  }

  async function exportDocx() {
    try {
      const out = await fillTemplateDocx(state.bytes, state.fields, state.values);
      downloadBlob(new Blob([out], { type: DOCX_MIME }), safeFileName(state.ten || 'van-ban'), DOCX_MIME);
      usage.track('export');
      toast('Đã xuất tệp Word');
    } catch (err) {
      toast(err.message || 'Không xuất được tệp', { type: 'error' });
    }
  }
}
