// Biểu mẫu chính thức (TT 128/2025/TT-BCA) trong màn hình Biểu mẫu tố tụng: danh mục theo 13 nhóm,
// nạp gói mẫu (lưu trên máy), soạn có tự điền từ hồ sơ, xem nhanh và xuất Word đúng bố cục mẫu gốc.
import { $, $$, icon, toast, escapeHtml, downloadBlob, debounce } from '../ui.js';
import { MAU_GROUPS } from '../legal/mau-analyze.js';
import { mauDb, readPack, mauPrefill, fillMau, matchMau, parseDate, isoOf } from '../legal/mau-pack.js';
import { parseTemplateDocx } from '../lib/tpl-docx.js';
import { casesRepo, legalDocsRepo } from '../legal/repo.js';
import { findCrime } from '../legal/engine.js';
import { safeFileName } from '../lib/docx.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const LOAI_MAU = { qd: 'Quyết định', lenh: 'Lệnh', bb: 'Biên bản', tb: 'Thông báo', giay: 'Giấy', yc: 'Yêu cầu', dn: 'Đề nghị', kl: 'Kết luận', khac: 'Mẫu' };
const HEADER_SEMS = ['coQuanCapTren', 'coQuan', 'so', 'kyHieuCq', 'diaDanh', 'ngayVb', 'chucDanhKy', 'kinhGui', 'vks'];
/** Khóa trường gắn với hồ sơ vụ án/người: đổi hồ sơ hoặc người thì ghi đè; các trường khác chỉ điền khi còn trống. */
const CASE_KEYS = /^(p\d+\.|tenVu$|toiTen$|dieuBLHS$)/;

export const isMauId = (id) => /^m\d/.test(String(id || ''));

/** Trang gói mẫu đã nạp của tài khoản hiện tại (null nếu chưa nạp). */
export const loadMauMeta = () => mauDb.meta().catch(() => null);

export function mauFormOf(meta, id) {
  return meta?.forms?.find((f) => f.id === id) || null;
}

/** Nút/ô nạp gói mẫu: chọn tệp .zip do công cụ dựng gói tạo ra. */
export function importButtonHtml(label = 'Nạp gói mẫu chính thức') {
  return `<label class="btn btn-sm btn-primary tt-import">${icon('upload', 'ic-sm')}${escapeHtml(label)}<input type="file" accept=".zip,application/zip" hidden data-mau-import /></label>`;
}

/** Danh mục chính thức trong thanh bên: 13 nhóm theo Danh mục ban hành kèm Thông tư. */
export function mauListHtml({ meta, q, open, activeId, xaOnly }) {
  const head = `<div class="tt-mau-title">${icon('file', 'ic-sm')}<span>Mẫu chính thức TT 128/2025/TT-BCA</span>${meta ? `<small>${meta.count}</small>` : ''}</div>`;
  if (!meta) {
    return `${head}<div class="tt-mau-empty"><p>Chưa nạp bộ mẫu Word chính thức. Gói mẫu được lưu <b>trên máy bạn</b> (không nằm trong phần mềm hay kho mã nguồn công khai).</p>${importButtonHtml()}</div>`;
  }
  const filter = `<label class="tt-mau-xa"><input type="checkbox" data-mau-xa ${xaOnly ? 'checked' : ''} />Chỉ mẫu Công an cấp xã được dùng</label>`;
  let html = head + filter;
  for (const g of MAU_GROUPS) {
    const forms = meta.forms.filter((f) => f.nhom === g.id && matchMau(f, q) && (!xaOnly || f.xa)).sort((a, b) => a.stt - b.stt || a.so.localeCompare(b.so, 'vi', { numeric: true }));
    if (!forms.length) continue;
    const id = `mg${g.id}`;
    const isOpen = q || open.has(id) || forms.some((f) => f.id === activeId);
    html += `<div class="tt-stage ${isOpen ? 'open' : ''}"><button type="button" class="tt-stage-h" data-stage="${id}" aria-expanded="${!!isOpen}">${icon('chevron-down', 'ic-sm lg-chev')}${icon(g.icon, 'ic-sm')}<span>${g.id}. ${escapeHtml(g.ten)}</span><small>${forms.length}</small></button>${
      isOpen ? `<div class="tt-forms">${forms.map((f) => `<a class="tt-form-item ${f.id === activeId ? 'active' : ''}" href="#forms/${f.id}"><span class="tt-loai l-${f.loai}">Mẫu ${escapeHtml(f.so)}</span><span>${escapeHtml(f.ten)}</span></a>`).join('')}</div>` : ''
    }</div>`;
  }
  return html;
}

/** Tổng quan khi chưa mở mẫu nào. */
export function mauOverviewHtml(meta) {
  if (!meta) {
    return `<div class="tt-mau-card"><h2>Bộ biểu mẫu Word chính thức (Thông tư 128/2025/TT-BCA)</h2>
      <p>Nạp một lần gói mẫu để dùng toàn bộ biểu mẫu điều tra hình sự theo đúng bố cục file gốc. Phần mềm tự nhận diện các dòng chấm “……”, điền từ hồ sơ vụ án (cơ quan, người, tội danh, ngày tháng) rồi xuất Word.</p>
      <ul><li>Gói mẫu <b>chỉ lưu trên máy</b>, tách theo từng tài khoản; không đưa lên GitHub, không nằm trong bản cài đặt.</li><li>Tạo gói từ thư mục các tệp Word bằng <code>node scripts/build-mau-pack.mjs</code> (xem hướng dẫn trong README), hoặc nhận tệp gói đã dựng sẵn.</li></ul>
      <div class="inline">${importButtonHtml()}</div></div>`;
  }
  const missing = (meta.missing || []).map((m) => m.so).join(', ');
  return `<div class="tt-mau-card"><h2>Biểu mẫu chính thức đã nạp: ${meta.count} mẫu</h2>
    <p>Chọn mẫu ở danh mục bên trái (13 nhóm theo Danh mục của Thông tư), hoặc gõ số mẫu / tên mẫu vào ô tìm kiếm. Phần mềm giữ nguyên bố cục, phông chữ, khung và bảng của file gốc; chỉ thay các chỗ chấm bằng nội dung bạn điền.</p>
    ${missing ? `<p class="lg-disclaimer">${icon('info', 'ic-sm')}Gói chưa có ${(meta.missing || []).length} mẫu trong danh mục (số ${escapeHtml(missing)}).</p>` : ''}
    <div class="inline"><label class="btn btn-sm btn-ghost tt-import">${icon('refresh', 'ic-sm')}Nạp lại gói khác<input type="file" accept=".zip,application/zip" hidden data-mau-import /></label><button type="button" class="btn btn-sm btn-ghost" data-mau-remove>${icon('trash', 'ic-sm')}Gỡ gói khỏi máy này</button></div></div>`;
}

/** Đọc tệp gói người dùng chọn và lưu vào máy. */
export async function importPackFile(file) {
  const pack = await readPack(await file.arrayBuffer());
  await mauDb.save(pack);
  return pack.meta;
}

const inputFor = (f, v) => {
  const key = escapeHtml(f.key);
  const ph = escapeHtml(f.hint || '');
  const val = escapeHtml(v || '');
  const id = `mf-${key}`;
  if (f.kind === 'long' || f.kind === 'lines') return `<textarea class="textarea" id="${id}" data-key="${key}" rows="${f.kind === 'lines' ? Math.max(3, f.slots.length) : 3}" placeholder="${ph}">${val}</textarea>`;
  if (f.kind === 'date') return `<input class="input" type="date" id="${id}" data-key="${key}" value="${escapeHtml(isoOf(parseDate(v)) || '')}" />`;
  if (f.kind === 'time') return `<input class="input" type="time" id="${id}" data-key="${key}" value="${val}" />`;
  return `<input class="input" id="${id}" data-key="${key}" value="${val}" placeholder="${ph}" />`;
};
const fieldHtml = (f, v) => `<div class="field ${f.kind === 'text' || f.kind === 'date' || f.kind === 'time' ? 'tt-short' : ''}"><label for="mf-${escapeHtml(f.key)}">${escapeHtml(f.label)}</label>${inputFor(f, v)}${f.hint && f.sem !== 'so' ? `<small class="mau-hint">${escapeHtml(f.hint)}</small>` : ''}</div>`;

/**
 * Soạn một biểu mẫu chính thức trong vùng main. env: { ctx, main, form, values, docId, caseId, personIds, cleanups, renderList, navigate }.
 * Trả về đối tượng { docId } cập nhật khi lưu.
 */
export async function mountMauEditor(env) {
  const { ctx, main, form, cleanups } = env;
  const org = () => ctx.settings().legalOrg || {};
  let values = { ...(env.values || {}) };
  let docId = env.docId || null;
  let caseId = env.caseId || '';
  let personIds = Array.isArray(values._persons) ? [...values._persons] : [];
  delete values._persons;
  let keepNotes = false;
  const docx = await mauDb.docx(form.id);
  const group = MAU_GROUPS.find((g) => g.id === form.nhom);
  if (!docx) {
    main.innerHTML = `<div class="page"><p class="lg-empty">Không đọc được tệp mẫu ${escapeHtml(form.so)} trong gói đã nạp. Hãy nạp lại gói mẫu.</p></div>`;
    return;
  }

  const info = form.fields.filter((f) => f.person === undefined && HEADER_SEMS.includes(f.sem));
  const people = form.persons || [];
  const content = form.fields.filter((f) => f.person === undefined && !HEADER_SEMS.includes(f.sem));
  const caseItem = () => (caseId ? casesRepo.get(caseId) : null);
  const personOpts = (n) => `<option value="">— Nhập tay —</option>${(caseItem()?.persons || []).map((p) => `<option value="${p.id}" ${p.id === personIds[n] ? 'selected' : ''}>${escapeHtml(p.hoTen)}</option>`).join('')}`;

  main.innerHTML = `
    <div class="tt-editor">
      <div class="tt-head">
        <div><div class="tt-crumb">${escapeHtml(group ? `${group.id}. ${group.ten}` : '')} · Mẫu số ${escapeHtml(form.so)}</div><h1>${escapeHtml(form.ten)}</h1></div>
        <div class="inline">
          <button class="btn btn-sm btn-ghost" type="button" data-del-this ${docId ? '' : 'hidden'}>${icon('trash', 'ic-sm')}Xóa</button>
          <button class="btn btn-sm" type="button" data-save>${icon('save', 'ic-sm')}${docId ? 'Lưu thay đổi' : 'Lưu vào hồ sơ'}</button>
          <button class="btn btn-sm btn-primary" type="button" data-export>${icon('download', 'ic-sm')}Xuất Word</button>
        </div>
      </div>
      <div class="tt-body">
        <form class="tt-fields" data-fields autocomplete="off">
          ${form.frame ? `<p class="lg-disclaimer">${icon('info', 'ic-sm')}Mẫu dạng khung/bảng: chỉ điền phần đầu mẫu, phần còn lại xuất ra đúng như bản gốc để in và viết tay.</p>` : ''}
          <fieldset class="fieldset"><legend>Tự điền từ hồ sơ</legend>
            <div class="field"><label for="mf-case">Hồ sơ vụ án</label><select class="select" id="mf-case" data-case><option value="">— Không gắn hồ sơ —</option>${casesRepo.list().map((c) => `<option value="${c.id}" ${c.id === caseId ? 'selected' : ''}>${escapeHtml(c.ten)}</option>`).join('')}</select></div>
            ${people.map((p, n) => `<div class="field"><label for="mf-person-${n}">${escapeHtml(p.label)}${p.ctx ? ` — <em>${escapeHtml(p.ctx)}</em>` : ''}</label><select class="select" id="mf-person-${n}" data-person="${n}">${personOpts(n)}</select></div>`).join('')}
            <label class="tt-mau-xa"><input type="checkbox" data-keep-notes />Giữ dấu chú thích (1), (2)… và phần chú thích cuối mẫu</label>
          </fieldset>
          ${info.length ? `<fieldset class="fieldset"><legend>Thông tin văn bản</legend><div class="grid-2">${info.map((f) => fieldHtml(f, values[f.key])).join('')}</div></fieldset>` : ''}
          ${people
            .map((p, n) => {
              const fs = form.fields.filter((f) => f.person === n);
              return fs.length ? `<fieldset class="fieldset"><legend>${escapeHtml(p.label)}</legend><div class="grid-2">${fs.map((f) => fieldHtml(f, values[f.key])).join('')}</div></fieldset>` : '';
            })
            .join('')}
          ${content.length ? `<fieldset class="fieldset"><legend>Nội dung (${content.length} chỗ điền)</legend>${content.map((f) => fieldHtml(f, values[f.key])).join('')}</fieldset>` : ''}
          <p class="lg-disclaimer">${icon('info', 'ic-sm')}Chỗ để trống giữ nguyên dòng chấm “……” của mẫu để điền tay. Số văn bản không tự sinh: nhập số thứ tự nếu cần.</p>
        </form>
        <div class="tt-preview"><div class="mau-sheet" data-sheet aria-label="Xem nhanh nội dung"></div><p class="mau-note">Xem nhanh nội dung. Bố cục, phông chữ, khung và bảng đầy đủ nằm trong tệp Word xuất ra.</p></div>
      </div>
    </div>`;

  const fieldsEl = $('[data-fields]', main);
  const sheet = $('[data-sheet]', main);
  const readValues = () => $$('[data-key]', fieldsEl).forEach((el) => (values[el.dataset.key] = el.value));
  const writeValues = () => $$('[data-key]', fieldsEl).forEach((el) => (el.value = el.type === 'date' ? isoOf(parseDate(values[el.dataset.key])) : values[el.dataset.key] || ''));

  let token = 0;
  const preview = async () => {
    const t = ++token;
    try {
      const bytes = await fillMau(form, docx, values, { stripNotes: !keepNotes });
      const parsed = await parseTemplateDocx(bytes, { blankLeader: true });
      if (t !== token) return;
      const paras = parsed.paragraphs.filter((p) => p.part.includes('document'));
      const seen = new Set();
      sheet.innerHTML = paras
        .filter((p) => {
          const k = p.text.trim();
          // Khung "Mẫu số / BH theo TT" được lặp trong tệp gốc (khung + bản dự phòng): chỉ hiện một lần.
          if (/^(Mẫu số|BH theo TT|ngày 19\/12\/2025)/.test(k)) {
            if (seen.has(k)) return false;
            seen.add(k);
          }
          return k;
        })
        .map((p) => `<p class="${p.align === 'center' ? 'c' : p.align === 'right' ? 'r' : ''} ${p.bold ? 'b' : ''}">${escapeHtml(p.text.replace(/\t+/g, ' ').replace(/\s{3,}/g, '  ').trim())}</p>`)
        .join('');
    } catch (err) {
      if (t === token) sheet.innerHTML = `<p class="lg-empty">${escapeHtml(err.message)}</p>`;
    }
  };
  const update = debounce(() => {
    readValues();
    preview();
  }, 220);
  fieldsEl.addEventListener('input', update);
  fieldsEl.addEventListener('submit', (e) => e.preventDefault());
  $('[data-keep-notes]', main).addEventListener('change', (e) => {
    keepNotes = e.target.checked;
    preview();
  });

  /** Điền từ cơ quan, hồ sơ, người: trường thuộc hồ sơ/người ghi đè khi đổi lựa chọn; trường khác chỉ điền khi còn trống. */
  function applyPrefill({ overwriteCase = false } = {}) {
    readValues();
    const c = caseItem();
    const persons = people.map((_, n) => c?.persons?.find((x) => x.id === personIds[n]) || null);
    const pre = mauPrefill(form, { org: org(), caseItem: c, persons, findCrime });
    let n = 0;
    for (const [k, v] of Object.entries(pre)) {
      if (!v) continue;
      const mine = CASE_KEYS.test(k);
      if (values[k] && !(overwriteCase && mine)) continue;
      values[k] = v;
      n++;
    }
    writeValues();
    preview();
    return n;
  }

  $('[data-case]', main).addEventListener('change', (e) => {
    caseId = e.target.value;
    personIds = [];
    $$('[data-person]', main).forEach((sel) => (sel.innerHTML = personOpts(+sel.dataset.person)));
    const n = applyPrefill({ overwriteCase: true });
    if (n) toast(`Đã điền ${n} chỗ từ hồ sơ`);
  });
  $$('[data-person]', main).forEach((sel) =>
    sel.addEventListener('change', () => {
      personIds[+sel.dataset.person] = sel.value;
      const n = applyPrefill({ overwriteCase: true });
      if (n) toast(`Đã điền ${n} chỗ từ hồ sơ`);
    }),
  );

  const nameOf = () => {
    const first = values['p0.hoTen'] ? ` - ${values['p0.hoTen']}` : '';
    return `Mẫu ${form.so} - ${form.ten}${first}`;
  };
  $('[data-export]', main).addEventListener('click', async () => {
    readValues();
    try {
      const bytes = await fillMau(form, docx, values, { stripNotes: !keepNotes });
      downloadBlob(bytes, safeFileName(nameOf()), DOCX_MIME);
      toast('Đã xuất tệp Word theo bố cục mẫu gốc');
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 6000 });
    }
  });
  $('[data-save]', main).addEventListener('click', () => {
    readValues();
    const c = caseItem();
    const rec = legalDocsRepo.save({ id: docId, formId: form.id, caseId: caseId || null, personId: personIds[0] || null, values: { ...values, _persons: personIds }, title: `Mẫu ${form.so} — ${form.ten}${values['p0.hoTen'] ? ' — ' + values['p0.hoTen'] : ''}${c ? ' (' + c.ten + ')' : ''}` });
    const first = !docId;
    docId = rec.id;
    env.setDocId?.(docId);
    if (first) history.replaceState(null, '', `#forms/doc/${rec.id}`);
    $('[data-save]', main).innerHTML = `${icon('save', 'ic-sm')}Lưu thay đổi`;
    $('[data-del-this]', main).hidden = false;
    env.renderList?.();
    toast(first ? 'Đã lưu văn bản' : 'Đã lưu thay đổi');
  });
  $('[data-del-this]', main).addEventListener('click', () => docId && env.deleteDoc?.(docId));

  // Mở mới: tự điền cơ quan, ngày, hồ sơ đã chọn sẵn.
  if (!docId) applyPrefill();
  else {
    writeValues();
    preview();
  }
  cleanups.push(() => {
    token++;
  });
}
