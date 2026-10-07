// Hộp thoại “Danh mục tính năng” (nút nhỏ ở góc phải trên cùng): tất cả tính năng hiện có — làm gì, ai dùng, mục đích,
// quyền, ở đâu, có từ phiên bản nào; ghi chú theo dõi, đánh giá tình trạng, đề xuất tính năng mới; xuất Word.
import { $, $$, icon, toast, escapeHtml, downloadBlob, debounce } from './ui.js';
import { store, uid } from './lib/store.js';
import { PERMS } from './lib/accounts.js';
import { APP_VERSION } from './version.js';
import { buildDocx, safeFileName } from './lib/docx.js';
import { FEATURES, FEATURE_GROUPS, FEATURE_STATUS } from './feature-list.js';

const KEY = 'feature-notes';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const notes = () => store.get(KEY, { items: {}, custom: [] });
const saveNotes = (n) => store.set(KEY, n);
const permLabel = (p) => (p ? PERMS.find((x) => x.id === p)?.label || p : 'Mọi tài khoản');
const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();

/** Tất cả tính năng: có sẵn + đề xuất do người dùng thêm. */
export function allFeatures() {
  const n = notes();
  return [...FEATURES, ...(n.custom || []).map((c) => ({ ...c, custom: true, nhom: c.nhom || 'de-xuat' }))].map((f) => ({ ...f, note: n.items?.[f.id] || {} }));
}

function featureDoc(list) {
  const groups = [...FEATURE_GROUPS, { id: 'de-xuat', ten: 'Đề xuất bổ sung' }];
  const body = [{ runs: [{ text: `Phiên bản phần mềm: ${APP_VERSION}. Tổng số ${list.length} tính năng.` }], align: 'justify', indent: true }];
  groups.forEach((g) => {
    const xs = list.filter((f) => f.nhom === g.id);
    if (!xs.length) return;
    body.push({ runs: [{ text: g.ten.toLocaleUpperCase('vi-VN'), bold: true }], align: 'left', spaceBefore: true });
    body.push({ table: { widths: [0.17, 0.33, 0.16, 0.16, 0.18], header: ['Tính năng', 'Làm gì', 'Ai dùng', 'Mục đích', 'Quyền · phiên bản · đánh giá'], rows: xs.map((f) => [f.ten, f.lam, f.ai || '', f.mucDich || '', `${permLabel(f.perm)}\nTừ v${f.tu || '—'}\n${FEATURE_STATUS[f.note.status || '']}${f.note.text ? `\nGhi chú: ${f.note.text}` : ''}`]) } });
  });
  return {
    typeId: 'danh-muc-tinh-nang',
    header: { parent: '', org: 'TRỢ LÝ VĂN BẢN AI', number: '', subject: null, placeDate: '' },
    title: { name: 'DANH MỤC TÍNH NĂNG', subject: `Phiên bản ${APP_VERSION}` },
    authority: null,
    recipients: null,
    body,
    sign: null,
    dualSign: null,
    signers: [],
  };
}

export function openFeatureCatalog(ctx) {
  let group = 'all';
  let q = '';
  let onlyNotes = false;
  ctx.modal(
    `<div class="fc-head">
      <span class="quick-icon">${icon('grid')}</span>
      <div><small>Phiên bản ${APP_VERSION}</small><h2 class="modal-title">Danh mục tính năng</h2></div>
      <button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
    </div>
    <p class="hint">Mọi tính năng hiện có: làm gì, ai dùng, mục đích, quyền cần có, nằm ở đâu, có từ phiên bản nào. Ghi chú, đánh giá tình trạng từng tính năng và thêm đề xuất mới để theo dõi, bổ sung, cập nhật (lưu trên máy theo tài khoản).</p>
    <div class="fc-tools">
      <div class="lg-search fc-search">${icon('search', 'ic-sm')}<input type="search" placeholder="Tìm tính năng, việc cần làm, người dùng…" aria-label="Tìm tính năng" data-fc-q /></div>
      <label class="check"><input type="checkbox" data-fc-noted />Chỉ hiện mục đã ghi chú / đánh giá</label>
      <span class="spacer"></span>
      <button class="btn btn-sm" type="button" data-fc-add>${icon('plus', 'ic-sm')}Đề xuất tính năng</button>
      <button class="btn btn-sm btn-ghost" type="button" data-fc-export>${icon('download', 'ic-sm')}Xuất Word</button>
    </div>
    <div class="chips fc-groups" data-fc-groups></div>
    <form class="fc-new" data-fc-new hidden>
      <div class="grid-2">
        <div class="field"><label for="fc-ten">Tên tính năng đề xuất</label><input class="input" id="fc-ten" name="ten" required /></div>
        <div class="field"><label for="fc-ai">Ai dùng</label><input class="input" id="fc-ai" name="ai" placeholder="VD: Điều tra viên" /></div>
        <div class="field span-2"><label for="fc-lam">Làm gì</label><textarea class="textarea" rows="2" id="fc-lam" name="lam"></textarea></div>
        <div class="field span-2"><label for="fc-md">Mục đích</label><input class="input" id="fc-md" name="mucDich" /></div>
      </div>
      <div class="inline"><button class="btn btn-sm btn-primary" type="submit">${icon('save', 'ic-sm')}Lưu đề xuất</button><button class="btn btn-sm btn-ghost" type="button" data-fc-cancel>Hủy</button></div>
    </form>
    <div class="fc-list" data-fc-list></div>`,
    {
      className: 'modal-wide fc-modal',
      label: 'Danh mục tính năng',
      onMount(box, close) {
        const draw = () => {
          const all = allFeatures();
          const groups = [...FEATURE_GROUPS, ...(all.some((f) => f.nhom === 'de-xuat') ? [{ id: 'de-xuat', ten: 'Đề xuất bổ sung' }] : [])];
          $('[data-fc-groups]', box).innerHTML = [{ id: 'all', ten: 'Tất cả' }, ...groups].map((g) => `<button class="chip" type="button" data-fc-g="${g.id}" aria-pressed="${group === g.id}">${escapeHtml(g.ten)} (${g.id === 'all' ? all.length : all.filter((f) => f.nhom === g.id).length})</button>`).join('');
          const words = norm(q).split(/\s+/).filter(Boolean);
          const shown = all.filter((f) => (group === 'all' || f.nhom === group) && (!onlyNotes || f.note.status || f.note.text) && words.every((w) => norm(`${f.ten} ${f.lam} ${f.ai} ${f.mucDich} ${f.noi || ''}`).includes(w)));
          $('[data-fc-list]', box).innerHTML = shown.length
            ? shown
                .map((f) => {
                  const can = !f.perm || ctx.can(f.perm);
                  return `<article class="fc-item ${f.note.status ? `fc-st-${f.note.status}` : ''}" data-fc="${escapeHtml(f.id)}">
                <header><h3>${escapeHtml(f.ten)}</h3>${f.moi ? '<span class="badge badge-accent">Mới</span>' : ''}${f.custom ? '<span class="badge">Đề xuất</span>' : `<span class="badge" title="Có từ phiên bản">v${escapeHtml(f.tu || '')}</span>`}${!can ? '<span class="badge badge-warning">Chưa được cấp quyền</span>' : ''}<span class="spacer"></span>${f.route && can && !f.custom ? `<a class="btn btn-ghost btn-sm" href="${f.route}" data-fc-go>Mở${icon('arrow-right', 'ic-sm')}</a>` : ''}</header>
                <dl>
                  <div><dt>Làm gì</dt><dd>${escapeHtml(f.lam || '')}</dd></div>
                  <div><dt>Ai dùng</dt><dd>${escapeHtml(f.ai || '—')}</dd></div>
                  <div><dt>Mục đích</dt><dd>${escapeHtml(f.mucDich || '—')}</dd></div>
                  ${f.custom ? '' : `<div><dt>Quyền · vị trí</dt><dd>${escapeHtml(permLabel(f.perm))}${f.noi ? ` · ${escapeHtml(f.noi)}` : f.route ? ` · ${escapeHtml(f.route)}` : ''}</dd></div>`}
                </dl>
                <div class="fc-track">
                  <select class="select" data-fc-st aria-label="Đánh giá tình trạng ${escapeHtml(f.ten)}">${Object.entries(FEATURE_STATUS).map(([k, l]) => `<option value="${k}" ${(f.note.status || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
                  <input class="input" data-fc-note value="${escapeHtml(f.note.text || '')}" placeholder="Ghi chú theo dõi: cần bổ sung gì, lỗi gì…" aria-label="Ghi chú cho ${escapeHtml(f.ten)}" />
                  ${f.custom ? `<button class="btn btn-ghost btn-sm btn-icon" type="button" data-fc-del aria-label="Xóa đề xuất ${escapeHtml(f.ten)}">${icon('trash', 'ic-sm')}</button>` : ''}
                </div>
                ${f.note.at ? `<small class="hint">Cập nhật ${new Date(f.note.at).toLocaleString('vi-VN')}</small>` : ''}
              </article>`;
                })
                .join('')
            : '<p class="muted">Không có tính năng phù hợp.</p>';
        };
        const setNote = (id, patch) => {
          const n = notes();
          n.items = { ...(n.items || {}), [id]: { ...(n.items?.[id] || {}), ...patch, at: Date.now() } };
          saveNotes(n);
        };
        $('[data-fc-q]', box).addEventListener('input', debounce((e) => ((q = e.target.value), draw()), 120));
        $('[data-fc-noted]', box).addEventListener('change', (e) => ((onlyNotes = e.target.checked), draw()));
        box.addEventListener('click', (e) => {
          const g = e.target.closest('[data-fc-g]');
          if (g) return (group = g.dataset.fcG), draw();
          if (e.target.closest('[data-fc-go]')) return close();
          if (e.target.closest('[data-fc-del]')) {
            const id = e.target.closest('[data-fc]').dataset.fc;
            const n = notes();
            n.custom = (n.custom || []).filter((c) => c.id !== id);
            delete n.items?.[id];
            saveNotes(n);
            toast('Đã xóa đề xuất');
            draw();
          }
        });
        box.addEventListener('change', (e) => {
          const el = e.target.closest('[data-fc-st], [data-fc-note]');
          if (!el) return;
          const id = el.closest('[data-fc]').dataset.fc;
          setNote(id, el.matches('[data-fc-st]') ? { status: el.value } : { text: el.value.trim() });
          toast('Đã lưu ghi chú theo dõi');
          if (el.matches('[data-fc-st]')) draw();
        });
        const form = $('[data-fc-new]', box);
        $('[data-fc-add]', box).addEventListener('click', () => {
          form.hidden = false;
          form.ten.focus();
        });
        $('[data-fc-cancel]', box).addEventListener('click', () => (form.hidden = true));
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(form));
          if (!f.ten.trim()) return form.ten.focus();
          const n = notes();
          n.custom = [...(n.custom || []), { id: `de-xuat-${uid()}`, nhom: 'de-xuat', ten: f.ten.trim(), lam: f.lam.trim(), ai: f.ai.trim(), mucDich: f.mucDich.trim(), at: Date.now() }];
          saveNotes(n);
          form.reset();
          form.hidden = true;
          group = 'de-xuat';
          q = '';
          $('[data-fc-q]', box).value = '';
          toast('Đã thêm đề xuất tính năng');
          draw();
        });
        $('[data-fc-export]', box).addEventListener('click', () => {
          downloadBlob(buildDocx(featureDoc(allFeatures()), 'Danh mục tính năng'), safeFileName(`danh-muc-tinh-nang-v${APP_VERSION}`), DOCX_MIME);
          toast('Đã xuất danh mục tính năng (.docx)');
        });
        draw();
        $$('[data-fc-q]', box)[0].focus();
      },
    },
  );
}
