// Biểu mẫu Tòa án: điền, xem trước, xuất Word từ hồ sơ xét xử (tab "Biểu mẫu"); thư viện biểu mẫu với ô tải mẫu Word của
// đơn vị lên thay mẫu soạn sẵn (lưu riêng từng tài khoản).
import { $, icon, toast, escapeHtml, downloadBlob, warnMissing, debounce } from '../ui.js';
import { COURT_FORMS, CAP_FORMS, courtForm, formFields, courtValues, matchField, wordTag, COURT_FIELDS, ngayChu, ngaySo } from '../legal/court-forms.js';
import { courtTplDb } from '../legal/court-tpl-db.js';
import { parseIso, isoDate } from '../legal/court-penalty.js';
import { parseTemplateDocx, detectFields, fillTemplateDocx } from '../lib/tpl-docx.js';
import { docToDocx, sniffDoc } from '../lib/doc.js';
import { buildDocx, safeFileName } from '../lib/docx.js';
import { renderDocumentHtml } from '../lib/render-html.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_SIZE = 3 * 1024 * 1024;
const capOf = (rec) => (rec.cap === 'phuc-tham' ? ['pt', 'tha'] : ['so', 'tha']);

/** Đọc, kiểm tra tệp Word người dùng chọn và lưu làm mẫu của đơn vị cho biểu mẫu formId. */
export async function uploadTemplate(formId, file) {
  if (!/\.(docx?|rtf|dot)$/i.test(file.name)) throw new Error(`“${file.name}” không phải tệp Word — chọn tệp .docx hoặc .doc`);
  if (file.size > MAX_SIZE) throw new Error('Tệp lớn hơn 3 MB — xóa bớt hình ảnh trong văn bản rồi thử lại');
  let bytes = new Uint8Array(await file.arrayBuffer());
  let name = file.name;
  if (sniffDoc(bytes) !== 'docx') {
    bytes = await docToDocx(bytes, file.name);
    name = file.name.replace(/\.(doc|rtf|dot)$/i, '.docx');
    toast(`Đã tự chuyển “${file.name}” sang .docx (giữ chữ và đoạn; phông, bảng có thể khác bản gốc — nên dùng tệp .docx)`, { type: 'info', timeout: 7000 });
  }
  await parseTemplateDocx(bytes); // báo lỗi sớm nếu tệp hỏng
  await courtTplDb.put(formId, name, bytes);
  return name;
}

/** Mẫu Word của đơn vị đã đọc: đoạn văn, ô cần điền (gắn với trường dữ liệu nếu nhận ra). */
async function loadTemplate(formId) {
  const t = await courtTplDb.get(formId);
  if (!t) return null;
  const parsed = await parseTemplateDocx(t.data);
  const fields = detectFields(parsed.paragraphs).map((f) => ({ ...f, map: /dia danh|ngay thang nam/.test(f.label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()) && /ngày/.test(f.find) ? 'placeDate' : matchField(f.label) }));
  return { ...t, paragraphs: parsed.paragraphs, fields };
}
/** Giá trị chữ để điền vào mẫu Word (ngày dạng 15/10/2026, dòng nhiều người nối bằng “; ”). */
function wordValue(key, v) {
  if (key === 'placeDate') return `${v.diaDanh || '……'}, ${ngayChu(v.ngayVb)}`;
  const f = COURT_FIELDS.find((x) => x.key === key);
  const val = v[key] ?? '';
  if (f?.kind === 'date') return val ? ngaySo(val) : '';
  if (f?.kind === 'lines') return String(val).split('\n').filter(Boolean).join('; ');
  return String(val);
}

const inputHtml = (f, val) => {
  const id = `cf-${f.key}`;
  const v = escapeHtml(val ?? '');
  if (f.kind === 'long' || f.kind === 'lines') return `<textarea class="textarea" id="${id}" data-cf="${f.key}" rows="${f.kind === 'long' ? 5 : 3}">${v}</textarea>`;
  if (f.kind === 'date') return `<input class="input" type="date" id="${id}" data-cf="${f.key}" value="${escapeHtml(isoDate(parseIso(val)) || '')}" />`;
  return `<input class="input" id="${id}" data-cf="${f.key}" value="${v}" />`;
};

/**
 * Tab "Biểu mẫu" trong hồ sơ xét xử. host: phần tử chứa; save(): lưu hồ sơ.
 * Giá trị: tự điền từ hồ sơ (courtValues) + phần đã sửa của từng mẫu (rec.formVals[formId]).
 */
export function mountFormsPane(host, { ctx, rec, save }) {
  let sel = rec.formSel || null;
  let all = false;
  let uploads = {};
  let tpl = null;
  const org = () => ctx.settings?.().courtOrg || {};
  const values = (form) => ({ ...courtValues(rec, { org: org() }), ...(rec.formVals?.[form.id] || {}) });

  async function draw() {
    uploads = await courtTplDb.list().catch(() => ({}));
    const caps = all ? Object.keys(CAP_FORMS) : capOf(rec);
    const forms = COURT_FORMS.filter((f) => caps.includes(f.cap));
    const groups = [...new Set(forms.map((f) => `${f.cap}|${f.nhom}`))];
    if (sel && !forms.some((f) => f.id === sel)) sel = null;
    host.innerHTML = `<div class="cf-wrap">
      <aside class="cf-list" aria-label="Danh mục biểu mẫu">
        <label class="check cf-all"><input type="checkbox" data-cf-all ${all ? 'checked' : ''} />Hiện cả mẫu ${rec.cap === 'phuc-tham' ? 'sơ thẩm' : 'phúc thẩm'}</label>
        ${groups
          .map((g) => {
            const [cap, nhom] = g.split('|');
            return `<div class="cf-group"><h4>${escapeHtml(CAP_FORMS[cap])} · ${escapeHtml(nhom)}</h4>${forms
              .filter((f) => f.cap === cap && f.nhom === nhom)
              .map((f) => `<button type="button" class="cf-item ${f.id === sel ? 'on' : ''}" data-cf-pick="${f.id}" aria-pressed="${f.id === sel}"><span>${escapeHtml(f.ten)}</span>${uploads[f.id] ? `<small class="badge badge-success">Mẫu đơn vị</small>` : ''}</button>`)
              .join('')}</div>`;
          })
          .join('')}
        <a class="btn btn-sm btn-ghost" href="#toa-an/bieu-mau">${icon('settings', 'ic-sm')}Quản lý mẫu Word của đơn vị</a>
      </aside>
      <div class="cf-edit" data-cf-edit>${sel ? '' : `<p class="note">${icon('info', 'ic-sm')}<span>Chọn biểu mẫu ở danh mục bên trái. Mẫu tự điền từ thông tin vụ án, bị cáo, Hội đồng xét xử; sửa được trước khi xuất Word.</span></p>`}</div>
    </div>`;
    if (sel) await drawEdit();
  }

  async function drawEdit() {
    const form = courtForm(sel);
    const box = $('[data-cf-edit]', host);
    tpl = uploads[sel] ? await loadTemplate(sel).catch((e) => (toast(e.message, { type: 'error' }), null)) : null;
    const v = values(form);
    const fields = formFields(form);
    const extra = tpl ? tpl.fields.filter((f) => !f.map) : [];
    const unmatchedKeys = tpl ? fields.filter((f) => !tpl.fields.some((t) => t.map === f.key)).length : 0;
    box.innerHTML = `<div class="cf-head"><h3>${escapeHtml(form.ten)}</h3>
        <p class="hint">${tpl ? `${icon('check', 'ic-sm')}Dùng <b>mẫu Word của đơn vị</b>: ${escapeHtml(tpl.name)} — nhận ra ${tpl.fields.length} ô cần điền.` : `${icon('file', 'ic-sm')}Mẫu soạn sẵn của phần mềm. Đơn vị có mẫu riêng thì tải lên để thay.`}</p>
        <div class="inline">
          <label class="btn btn-sm">${icon('upload', 'ic-sm')}${tpl ? 'Thay mẫu Word' : 'Tải mẫu Word của đơn vị lên'}<input type="file" hidden accept=".docx,.doc,.rtf" data-cf-upload /></label>
          ${tpl ? `<button class="btn btn-sm btn-ghost" type="button" data-cf-remove>${icon('trash', 'ic-sm')}Gỡ mẫu đơn vị (dùng mẫu soạn sẵn)</button>` : ''}
          <button class="btn btn-sm btn-ghost" type="button" data-cf-reset>${icon('refresh', 'ic-sm')}Lấy lại từ hồ sơ</button>
        </div></div>
      ${tpl && unmatchedKeys ? `<p class="hint">Mẫu Word chỉ điền được các ô có trong tệp. Ghi ô dạng <code>${escapeHtml(wordTag('biCao'))}</code> trong tệp Word để phần mềm điền đúng chỗ (xem danh sách ở <a href="#toa-an/bieu-mau">Quản lý mẫu Word</a>).</p>` : ''}
      <div class="cf-fields">${fields.map((f) => `<div class="field ${f.kind === 'long' || f.kind === 'lines' ? 'span-2' : ''}"><label for="cf-${f.key}">${escapeHtml(f.label)}</label>${inputHtml(f, v[f.key])}</div>`).join('')}
      ${extra.map((f) => `<div class="field"><label for="cfx-${f.key}">${escapeHtml(f.label)} <small>(ô trong mẫu Word)</small></label><input class="input" id="cfx-${f.key}" data-cfx="${escapeHtml(f.key)}" value="${escapeHtml(rec.formVals?.[sel]?.[`x:${f.key}`] || '')}" /></div>`).join('')}</div>
      <div class="inline cf-actions"><button class="btn" type="button" data-cf-preview>${icon('eye', 'ic-sm')}Xem trước</button><button class="btn btn-primary" type="button" data-cf-export>${icon('download', 'ic-sm')}Xuất Word</button></div>`;
  }

  const setVal = (key, val) => {
    rec.formVals = { ...(rec.formVals || {}) };
    rec.formVals[sel] = { ...(rec.formVals[sel] || {}), [key]: val };
    save();
  };
  const filledTpl = () => {
    const v = values(courtForm(sel));
    const out = {};
    for (const f of tpl.fields) out[f.key] = f.map ? wordValue(f.map, v) : rec.formVals?.[sel]?.[`x:${f.key}`] || '';
    return out;
  };
  // Đọc ngay các ô đang sửa (trước khi bộ hẹn giờ lưu kịp chạy) để xem trước / xuất đúng nội dung vừa gõ.
  function syncInputs() {
    host.querySelectorAll('[data-cf]').forEach((el) => {
      if (el.value !== String(values(courtForm(sel))[el.dataset.cf] ?? '')) setVal(el.dataset.cf, el.value);
    });
    host.querySelectorAll('[data-cfx]').forEach((el) => setVal(`x:${el.dataset.cfx}`, el.value));
  }
  async function exportDoc() {
    syncInputs();
    const form = courtForm(sel);
    const name = safeFileName(`${form.ten}-${rec.ten || ''}`);
    if (tpl) {
      const bytes = await fillTemplateDocx(tpl.data, tpl.fields, filledTpl());
      downloadBlob(new Blob([bytes], { type: DOCX_MIME }), name, DOCX_MIME);
    } else {
      const doc = form.build(values(form));
      downloadBlob(buildDocx(doc, doc.title.name), name, DOCX_MIME);
    }
    toast(`Đã xuất “${form.ten}” (.docx)`);
  }
  function preview() {
    syncInputs();
    const form = courtForm(sel);
    let body;
    if (tpl) {
      const vals = filledTpl();
      const byPara = new Map();
      for (const f of tpl.fields) for (const l of f.locs || []) (byPara.get(`${l.part}|${l.i}`) || byPara.set(`${l.part}|${l.i}`, []).get(`${l.part}|${l.i}`)).push({ ...l, value: vals[f.key] });
      body = `<div class="cf-tpl-preview">${tpl.paragraphs
        .map((p) => {
          let t = p.text;
          for (const l of (byPara.get(`${p.part}|${p.i}`) || []).sort((a, b) => b.s - a.s)) if (l.value) t = t.slice(0, l.s) + l.value + t.slice(l.e);
          return `<p class="${p.align === 'center' ? 'c' : ''} ${p.bold ? 'b' : ''}">${escapeHtml(t)}</p>`;
        })
        .join('')}</div><p class="hint">Xem trước dạng chữ — tệp Word xuất ra giữ nguyên bố cục, phông chữ, bảng của mẫu đơn vị.</p>`;
    } else body = renderDocumentHtml(form.build(values(form)));
    ctx.modal(`<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button><div class="preview-modal-body print-area">${body}</div><div class="modal-actions"><button class="btn" type="button" data-close>Đóng</button></div>`, { className: 'modal-wide preview-modal', label: `Xem trước ${form.ten}` });
  }

  const onInput = debounce((el) => {
    if (el.matches('[data-cf]')) setVal(el.dataset.cf, el.value);
    else if (el.matches('[data-cfx]')) setVal(`x:${el.dataset.cfx}`, el.value);
  }, 200);
  host.addEventListener('input', (e) => onInput(e.target));
  host.addEventListener('change', async (e) => {
    if (e.target.matches('[data-cf-all]')) {
      all = e.target.checked;
      draw();
    } else if (e.target.matches('[data-cf-upload]') && e.target.files[0]) {
      try {
        const name = await uploadTemplate(sel, e.target.files[0]);
        toast(`Đã lưu mẫu Word “${name}” cho “${courtForm(sel).ten}” (chỉ tài khoản này dùng)`);
        draw();
      } catch (err) {
        toast(err.message, { type: 'error', timeout: 6000 });
      }
    }
  });
  host.addEventListener('click', async (e) => {
    const pick = e.target.closest('[data-cf-pick]');
    if (pick) {
      sel = rec.formSel = pick.dataset.cfPick;
      save();
      draw();
      return;
    }
    if (e.target.closest('[data-cf-remove]')) {
      await courtTplDb.remove(sel);
      toast('Đã gỡ mẫu Word của đơn vị — dùng lại mẫu soạn sẵn');
      draw();
    } else if (e.target.closest('[data-cf-reset]')) {
      rec.formVals = { ...(rec.formVals || {}), [sel]: {} };
      save();
      drawEdit();
    } else if (e.target.closest('[data-cf-export]')) {
      if (!sel) return warnMissing('Chưa chọn biểu mẫu');
      exportDoc().catch((err) => toast(err.message, { type: 'error' }));
    } else if (e.target.closest('[data-cf-preview]')) preview();
  });
  draw();
  return { refresh: () => draw() };
}

/** Trang "Biểu mẫu Tòa án": tải / thay / gỡ mẫu Word của đơn vị cho từng biểu mẫu; danh sách ô dùng trong tệp Word. */
export async function renderFormsLibrary(ctx) {
  const root = ctx.view;
  const uploads = await courtTplDb.list().catch(() => ({}));
  if (!root.isConnected) return;
  root.innerHTML = `<div class="page ct-page" data-cf-lib>
    <a class="rd-back" href="#toa-an">${icon('chevron-left', 'ic-sm')}Tòa án</a>
    <div class="page-head"><div><h1 class="page-title">Biểu mẫu <em>Tòa án</em></h1><p class="page-sub">${COURT_FORMS.length} biểu mẫu hình sự soạn sẵn (sơ thẩm, phúc thẩm, thi hành án) tự điền từ hồ sơ xét xử. Đơn vị có mẫu Word riêng thì tải lên để thay — mẫu lưu trên máy, <b>riêng tài khoản của bạn</b>.</p></div></div>
    <section class="panel ct-sec"><h2>${icon('file', 'ic-sm')}Danh mục biểu mẫu</h2>
      <table class="cf-table"><thead><tr><th>Biểu mẫu</th><th>Đang dùng</th><th></th></tr></thead><tbody>
      ${Object.entries(CAP_FORMS)
        .map(([cap, ten]) => `<tr class="cf-cap"><th colspan="3">${escapeHtml(ten)}</th></tr>${COURT_FORMS.filter((f) => f.cap === cap)
          .map((f) => `<tr data-row="${f.id}"><td>${escapeHtml(f.ten)}<small>${escapeHtml(f.nhom)}</small></td><td>${uploads[f.id] ? `<span class="badge badge-success">Mẫu đơn vị</span> <small>${escapeHtml(uploads[f.id].name)}</small>` : '<span class="badge">Mẫu soạn sẵn</span>'}</td><td class="cf-row-act"><label class="btn btn-sm">${icon('upload', 'ic-sm')}${uploads[f.id] ? 'Thay' : 'Tải Word lên'}<input type="file" hidden accept=".docx,.doc,.rtf" data-up="${f.id}" /></label>${uploads[f.id] ? `<button class="btn btn-sm btn-ghost btn-icon" type="button" data-rm="${f.id}" aria-label="Gỡ mẫu đơn vị của ${escapeHtml(f.ten)}">${icon('trash', 'ic-sm')}</button>` : ''}</td></tr>`)
          .join('')}`)
        .join('')}
      </tbody></table>
    </section>
    <section class="panel ct-sec"><h2>${icon('hash', 'ic-sm')}Ô điền trong mẫu Word của đơn vị</h2>
      <p class="hint">Trong tệp Word, gõ tên ô trong dấu <code>{{ }}</code> đúng như dưới đây — phần mềm thay bằng dữ liệu của hồ sơ, giữ nguyên định dạng. Ngày điền dạng 15/10/2026; ô nhiều dòng (Hội thẩm, nhân thân…) nối bằng dấu “;”. Các dòng “Nhãn: ……” quen thuộc (Họ tên, Địa chỉ, Số…) và dòng “Địa danh, ngày … tháng … năm …” cũng được nhận ra.</p>
      <div class="cf-tags">${COURT_FIELDS.map((f) => `<button type="button" class="chip" data-copy="${escapeHtml(wordTag(f.key))}" title="${escapeHtml(f.label)} — bấm để sao chép">${escapeHtml(wordTag(f.key))}</button>`).join('')}</div>
    </section>
  </div>`;
  // Nghe trên phần tử trang (thay mới mỗi lần vẽ lại) để không gắn trùng sự kiện.
  const page = $('[data-cf-lib]', root);
  page.addEventListener('change', async (e) => {
    const up = e.target.closest('[data-up]');
    if (!up?.files[0]) return;
    try {
      const name = await uploadTemplate(up.dataset.up, up.files[0]);
      toast(`Đã lưu mẫu Word “${name}”`);
      renderFormsLibrary(ctx);
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 6000 });
    }
  });
  page.addEventListener('click', async (e) => {
    const rm = e.target.closest('[data-rm]');
    const cp = e.target.closest('[data-copy]');
    if (rm) {
      await courtTplDb.remove(rm.dataset.rm);
      toast('Đã gỡ mẫu Word của đơn vị');
      renderFormsLibrary(ctx);
    } else if (cp) {
      try {
        await navigator.clipboard.writeText(cp.dataset.copy);
        toast(`Đã sao chép ${cp.dataset.copy}`);
      } catch {
        toast(cp.dataset.copy);
      }
    }
  });
}
