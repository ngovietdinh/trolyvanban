// Hồ sơ vụ án: thông tin vụ án, người tham gia tố tụng, kế hoạch hỏi, biên bản, đối chiếu lời khai.
import { $, $$, icon, toast, escapeHtml } from '../ui.js';
import { deleteWithUndo, repoOps } from '../lib/undo-delete.js';
import { casesRepo, recordsRepo, plansRepo, deleteCase, legalDocsRepo } from '../legal/repo.js';
import { findForm, LOAI } from '../legal/forms-catalog.js';
import { confirmDeleteRecords } from './interview.js';
import { PERSON_FIELDS, newRecord } from '../legal/record.js';
import { ROLES, getRole } from '../legal/roles.js';
import { findCrime, generatePlan } from '../legal/engine.js';
import { localContradictions, aiContradictions } from '../legal/assist.js';
import { relativeTime } from '../lib/vn-date.js';
import { uid } from '../lib/store.js';

function caseForm(ctx, existing, onSaved) {
  const org = ctx.settings().legalOrg || {};
  const c = existing || { coQuanCapTren: org.coQuanCapTren || '', coQuan: org.coQuan || '', dieuTraVien: org.dieuTraVien || '', toiDanh: [] };
  ctx.modal(
    `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
    <h2 class="modal-title">${existing ? 'Sửa hồ sơ vụ án' : 'Tạo hồ sơ vụ án'}</h2>
    <form class="iv-info" data-f novalidate>
      <div class="grid-2">
        <div class="field span-2"><label for="c-ten">Tên vụ án / vụ việc <span class="req">*</span></label><input class="input" id="c-ten" name="ten" value="${escapeHtml(c.ten || '')}" placeholder="VD: Vụ vi phạm quy định về đấu thầu tại Ban QLDA huyện X" /><span class="err">Vui lòng nhập tên vụ án</span></div>
        <div class="field"><label for="c-so">Số hồ sơ / số thụ lý</label><input class="input" id="c-so" name="soHoSo" value="${escapeHtml(c.soHoSo || '')}" /></div>
        <div class="field"><label for="c-ngay">Ngày khởi tố / thụ lý</label><input class="input" type="date" id="c-ngay" name="ngayThuLy" value="${escapeHtml(c.ngayThuLy || '')}" /></div>
        <div class="field span-2"><label for="c-td">Tội danh (số điều, cách nhau bởi dấu phẩy)</label><input class="input" id="c-td" name="toiDanh" value="${escapeHtml((c.toiDanh || []).join(', '))}" placeholder="VD: 222, 356" list="c-td-list" /><span class="hint" data-td-hint></span></div>
        <div class="field"><label for="c-cqct">Cơ quan cấp trên</label><input class="input" id="c-cqct" name="coQuanCapTren" value="${escapeHtml(c.coQuanCapTren || '')}" /></div>
        <div class="field"><label for="c-cq">Cơ quan thụ lý</label><input class="input" id="c-cq" name="coQuan" value="${escapeHtml(c.coQuan || '')}" /></div>
        <div class="field span-2"><label for="c-dtv">Điều tra viên thụ lý</label><input class="input" id="c-dtv" name="dieuTraVien" value="${escapeHtml(c.dieuTraVien || '')}" /></div>
        <div class="field span-2"><label for="c-tt">Tóm tắt nội dung</label><textarea class="textarea" rows="3" id="c-tt" name="tomTat">${escapeHtml(c.tomTat || '')}</textarea></div>
      </div>
      <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit">${icon('save', 'ic-sm')}Lưu hồ sơ</button></div>
    </form>`,
    {
      className: 'modal-wide',
      label: 'Hồ sơ vụ án',
      onMount(box, close) {
        const td = box.querySelector('[name="toiDanh"]');
        const hint = box.querySelector('[data-td-hint]');
        const showHint = () => {
          const parts = td.value.split(/[,;\s]+/).filter(Boolean);
          hint.innerHTML = parts.map((p) => (findCrime(p) ? `Đ.${p}: ${escapeHtml(findCrime(p).ten)}` : `<span style="color:var(--danger)">Đ.${escapeHtml(p)}: chưa có dữ liệu</span>`)).join(' · ');
        };
        td.addEventListener('input', showHint);
        showHint();
        box.querySelector('[data-f]').addEventListener('submit', (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.target));
          if (!f.ten.trim()) {
            box.querySelector('[name="ten"]').closest('.field').classList.add('invalid');
            box.querySelector('[name="ten"]').focus();
            return;
          }
          const saved = casesRepo.save({ ...(existing || { persons: [] }), ...f, ten: f.ten.trim(), toiDanh: f.toiDanh.split(/[,;\s]+/).map((x) => x.replace(/^điều/i, '')).filter((x) => findCrime(x)) });
          close();
          toast(existing ? 'Đã cập nhật hồ sơ' : 'Đã tạo hồ sơ vụ án');
          onSaved(saved);
        });
      },
    },
  );
}

function personForm(ctx, caseItem, existing, onSaved) {
  const p = existing || { roleId: 'lam-chung', quocTich: 'Việt Nam' };
  ctx.modal(
    `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
    <h2 class="modal-title">${existing ? 'Sửa thông tin người tham gia tố tụng' : 'Thêm người tham gia tố tụng'}</h2>
    <form class="iv-info" data-f novalidate>
      <div class="grid-2">
        <div class="field span-2"><label for="p-role">Tư cách tham gia tố tụng</label><select class="select" id="p-role" name="roleId">${ROLES.map((r) => `<option value="${r.id}" ${r.id === p.roleId ? 'selected' : ''}>${escapeHtml(r.ten)}</option>`).join('')}</select></div>
        ${PERSON_FIELDS.map(([k, l, req]) => `<div class="field ${k === 'noiCuTru' || k === 'hoTen' ? 'span-2' : ''}"><label for="p-${k}">${l}${req ? ' <span class="req">*</span>' : ''}</label><input class="input" id="p-${k}" name="${k}" value="${escapeHtml(p[k] || '')}" />${req ? '<span class="err">Vui lòng nhập họ tên</span>' : ''}</div>`).join('')}
        <div class="field span-2"><label for="p-gc">Ghi chú (vai trò trong vụ án)</label><input class="input" id="p-gc" name="ghiChu" value="${escapeHtml(p.ghiChu || '')}" /></div>
      </div>
      <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit">${icon('save', 'ic-sm')}Lưu</button></div>
    </form>`,
    {
      className: 'modal-wide',
      label: 'Người tham gia tố tụng',
      onMount(box, close) {
        box.querySelector('[data-f]').addEventListener('submit', (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.target));
          if (!f.hoTen.trim()) {
            box.querySelector('[name="hoTen"]').closest('.field').classList.add('invalid');
            box.querySelector('[name="hoTen"]').focus();
            return;
          }
          const person = { ...(existing || { id: uid() }), ...f, hoTen: f.hoTen.trim() };
          const persons = (caseItem.persons || []).filter((x) => x.id !== person.id);
          const saved = casesRepo.save({ ...caseItem, persons: existing ? (caseItem.persons || []).map((x) => (x.id === person.id ? person : x)) : [...persons, person] });
          close();
          toast('Đã lưu người tham gia tố tụng');
          onSaved(saved);
        });
      },
    },
  );
}

/** Nút xóa kế hoạch hỏi và văn bản tố tụng (có hoàn tác). */
function bindDeletes(ctx, after) {
  $$('[data-del-plan]', ctx.view).forEach((b) =>
    b.addEventListener('click', () => {
      const p = plansRepo.get(b.dataset.delPlan);
      deleteWithUndo(ctx, { title: 'Xóa kế hoạch hỏi', message: `Xóa kế hoạch “${p?.title}”? Các biên bản đã ghi theo kế hoạch vẫn được giữ lại.`, items: [{ item: p, ...repoOps(plansRepo) }], log: 'Xóa kế hoạch hỏi', after });
    }),
  );
  $$('[data-del-ldoc]', ctx.view).forEach((b) =>
    b.addEventListener('click', () => {
      const d = legalDocsRepo.get(b.dataset.delLdoc);
      deleteWithUndo(ctx, { title: 'Xóa văn bản tố tụng', message: `Xóa văn bản “${d?.title}”? Có thể hoàn tác ngay sau khi xóa.`, items: [{ item: d, ...repoOps(legalDocsRepo) }], log: 'Xóa văn bản tố tụng', after });
    }),
  );
}

function renderList(ctx) {
  const cases = casesRepo.list();
  const loosePlans = plansRepo.list((p) => !p.caseId);
  ctx.view.innerHTML = `
  <div class="page">
    <div class="page-head">
      <div><h1 class="page-title">Hồ sơ <em>vụ án</em></h1><p class="page-sub">Quản lý người tham gia tố tụng, kế hoạch hỏi và biên bản lời khai theo từng vụ án.</p></div>
      <button class="btn btn-primary" type="button" data-new>${icon('plus', 'ic-sm')}Tạo hồ sơ</button>
    </div>
    ${
      cases.length
        ? `<div class="case-grid">${cases
            .map((c) => {
              const recs = recordsRepo.list((r) => r.caseId === c.id);
              return `<a class="case-card" href="#cases/${c.id}">
                <div class="case-top"><span class="case-no">${escapeHtml(c.soHoSo || 'Chưa có số')}</span><span class="muted">${relativeTime(c.updatedAt)}</span></div>
                <h3>${escapeHtml(c.ten)}</h3>
                <div class="chips">${(c.toiDanh || []).map((d) => `<span class="kw">Đ.${d} ${escapeHtml(findCrime(d)?.ten.replace(/^Tội /, '').slice(0, 42) || '')}</span>`).join('')}</div>
                <div class="case-stats"><span>${icon('user', 'ic-sm')}${(c.persons || []).length} người</span><span>${icon('message', 'ic-sm')}${recs.length} biên bản</span><span>${icon('layers', 'ic-sm')}${plansRepo.list((p) => p.caseId === c.id).length} kế hoạch</span></div>
              </a>`;
            })
            .join('')}</div>`
        : `<section class="panel"><div class="empty"><div class="empty-icon">${icon('folder', 'ic-lg')}</div><h3>Chưa có hồ sơ vụ án</h3><p>Tạo hồ sơ để quản lý người tham gia tố tụng và các biên bản lời khai.</p><button class="btn btn-primary" type="button" data-new2>${icon('plus')}Tạo hồ sơ đầu tiên</button><a class="btn btn-ghost" href="#help/quytrinh">${icon('help')}Xem quy trình mẫu</a></div></section>`
    }
    ${loosePlans.length ? `<section class="panel" style="margin-top:18px"><div class="panel-head"><h2>${icon('layers', 'ic-sm')}Kế hoạch hỏi chưa gắn hồ sơ</h2></div><ul class="doc-list">${loosePlans.map(planRow).join('')}</ul></section>` : ''}
  </div>`;
  const open = () => caseForm(ctx, null, (c) => ctx.navigate(`#cases/${c.id}`));
  bindDeletes(ctx, () => renderList(ctx));
  $('[data-new]', ctx.view).addEventListener('click', open);
  $('[data-new2]', ctx.view)?.addEventListener('click', open);
}

function planRow(p) {
  const crime = findCrime(p.dieu);
  return `<li class="doc-item"><span class="doc-icon">KH</span><div class="doc-meta"><a href="#legal/plan/${p.id}">${escapeHtml(p.title)}</a><small>Điều ${p.dieu} — ${escapeHtml(crime?.ten || '')} · ${escapeHtml(getRole(p.roleId).ten.split('/')[0])} · ${p.stats?.questions || '?'} câu hỏi · ${relativeTime(p.updatedAt)}</small></div><button class="btn btn-ghost btn-sm btn-icon" type="button" data-del-plan="${p.id}" aria-label="Xóa kế hoạch “${escapeHtml(p.title)}”" title="Xóa kế hoạch">${icon('trash', 'ic-sm')}</button></li>`;
}

export function render(ctx, params = []) {
  if (!params[0]) return renderList(ctx);
  let c = casesRepo.get(params[0]);
  if (!c) {
    toast('Không tìm thấy hồ sơ', { type: 'error' });
    return renderList(ctx);
  }
  let tab = 'persons';

  function draw() {
    c = casesRepo.get(c.id);
    const recs = recordsRepo.list((r) => r.caseId === c.id);
    const plans = plansRepo.list((p) => p.caseId === c.id);
    const ldocs = legalDocsRepo.list((d) => d.caseId === c.id);
    ctx.view.innerHTML = `
    <div class="page">
      <a class="btn btn-ghost btn-sm" href="#cases" style="margin-bottom:10px">${icon('chevron-left', 'ic-sm')}Hồ sơ vụ án</a>
      <header class="case-head panel">
        <div>
          <span class="case-no">${escapeHtml(c.soHoSo || 'Chưa có số')}</span>
          <h1 class="page-title" style="margin-top:6px">${escapeHtml(c.ten)}</h1>
          <p class="page-sub">${[c.coQuan, c.dieuTraVien ? `ĐTV: ${c.dieuTraVien}` : '', c.ngayThuLy ? `Thụ lý: ${c.ngayThuLy.split('-').reverse().join('/')}` : ''].filter(Boolean).map(escapeHtml).join(' · ')}</p>
          <div class="chips" style="margin-top:10px">${(c.toiDanh || []).map((d) => `<a class="kw" href="#legal/${d}">Đ.${d} ${escapeHtml(findCrime(d)?.ten || '')}</a>`).join('') || '<span class="muted">Chưa xác định tội danh</span>'}</div>
          ${c.tomTat ? `<p style="margin-top:12px;color:var(--text-2)">${escapeHtml(c.tomTat)}</p>` : ''}
        </div>
        <div class="inline" style="align-self:flex-start">
          <button class="btn btn-sm" type="button" data-edit>${icon('wand', 'ic-sm')}Sửa</button>
          <button class="btn btn-sm btn-ghost" type="button" data-del>${icon('trash', 'ic-sm')}Xóa</button>
        </div>
      </header>
      <div class="tabs case-tabs" role="tablist">
        <button class="tab" role="tab" data-tab="persons" aria-selected="${tab === 'persons'}">Người tham gia (${(c.persons || []).length})</button>
        <button class="tab" role="tab" data-tab="records" aria-selected="${tab === 'records'}">Biên bản (${recs.length})</button>
        <button class="tab" role="tab" data-tab="plans" aria-selected="${tab === 'plans'}">Kế hoạch hỏi (${plans.length})</button>
        <button class="tab" role="tab" data-tab="ldocs" aria-selected="${tab === 'ldocs'}">Văn bản tố tụng (${ldocs.length})</button>
        <button class="tab" role="tab" data-tab="cross" aria-selected="${tab === 'cross'}">Đối chiếu lời khai</button>
      </div>
      <section class="panel" data-body></section>
    </div>`;

    const body = $('[data-body]', ctx.view);
    if (tab === 'persons') {
      const persons = c.persons || [];
      body.innerHTML = `<div class="panel-head"><h2>${icon('user', 'ic-sm')}Người tham gia tố tụng</h2><button class="btn btn-sm btn-primary" type="button" data-add-person>${icon('plus', 'ic-sm')}Thêm người</button></div>
        ${
          persons.length
            ? `<ul class="doc-list">${persons
                .map((p) => {
                  const n = recs.filter((r) => r.personId === p.id).length;
                  return `<li class="doc-item" data-pid="${p.id}"><span class="avatar">${escapeHtml((p.hoTen.split(/\s+/).pop() || '?')[0])}</span>
                  <div class="doc-meta"><strong>${escapeHtml(p.hoTen)}</strong><small>${escapeHtml(getRole(p.roleId).ten)}${p.ghiChu ? ' · ' + escapeHtml(p.ghiChu) : ''} · ${n} biên bản</small></div>
                  <div class="doc-actions" style="opacity:1">
                    <button class="btn btn-sm btn-primary" type="button" data-interview>${icon('message', 'ic-sm')}Ghi lời khai</button>
                    <button class="btn btn-ghost btn-sm btn-icon" type="button" data-edit-person aria-label="Sửa ${escapeHtml(p.hoTen)}">${icon('wand', 'ic-sm')}</button>
                    <button class="btn btn-ghost btn-sm btn-icon" type="button" data-del-person aria-label="Xóa ${escapeHtml(p.hoTen)}">${icon('trash', 'ic-sm')}</button>
                  </div></li>`;
                })
                .join('')}</ul>`
            : `<div class="empty"><p>Chưa có người tham gia tố tụng. Thêm bị can, người làm chứng, bị hại…</p></div>`
        }`;
    } else if (tab === 'records') {
      body.innerHTML = `<div class="panel-head"><h2>${icon('message', 'ic-sm')}Biên bản lời khai</h2></div>${
        recs.length
          ? `<ul class="doc-list">${recs
              .map((r) => `<li class="doc-item"><span class="doc-icon">${r.roleId === 'bi-can' ? 'HC' : 'LK'}</span><div class="doc-meta"><a href="#interview/${r.id}">${escapeHtml(r.nguoiKhai?.hoTen || 'Chưa ghi tên')} — lần ${r.lan || 1}</a><small>${escapeHtml(getRole(r.roleId).ten.split('/')[0])} · ${r.ngay ? r.ngay.split('-').reverse().join('/') : ''} · ${(r.qa || []).length} lượt hỏi – đáp</small></div><span class="badge ${r.status === 'hoan-thanh' ? 'badge-success' : 'badge-warning'}">${r.status === 'hoan-thanh' ? 'Hoàn thành' : 'Đang ghi'}</span><button class="btn btn-ghost btn-sm btn-icon" type="button" data-del-rec="${r.id}" aria-label="Xóa biên bản ${escapeHtml(r.nguoiKhai?.hoTen || '')}" title="Xóa biên bản">${icon('trash', 'ic-sm')}</button></li>`)
              .join('')}</ul>`
          : `<div class="empty"><p>Chưa có biên bản. Chọn “Ghi lời khai” ở tab Người tham gia.</p></div>`
      }`;
    } else if (tab === 'ldocs') {
      body.innerHTML = `<div class="panel-head"><h2>${icon('file', 'ic-sm')}Văn bản tố tụng</h2><a class="btn btn-sm" href="#forms">${icon('plus', 'ic-sm')}Lập văn bản</a></div>${
        ldocs.length
          ? `<ul class="doc-list">${ldocs.map((d) => `<li class="doc-item"><span class="doc-icon">${escapeHtml((LOAI[findForm(d.formId)?.loai] || 'VB').slice(0, 2).toUpperCase())}</span><div class="doc-meta"><a href="#forms/doc/${d.id}">${escapeHtml(d.title)}</a><small>${escapeHtml(findForm(d.formId)?.ten || '')}</small></div><button class="btn btn-ghost btn-sm btn-icon" type="button" data-del-ldoc="${d.id}" aria-label="Xóa văn bản “${escapeHtml(d.title)}”" title="Xóa văn bản">${icon('trash', 'ic-sm')}</button></li>`).join('')}</ul>`
          : `<div class="empty"><p>Chưa có văn bản. Mở “Biểu mẫu tố tụng”, chọn mẫu, chọn hồ sơ này để tự điền rồi lưu.</p></div>`
      }`;
    } else if (tab === 'plans') {
      body.innerHTML = `<div class="panel-head"><h2>${icon('layers', 'ic-sm')}Kế hoạch hỏi</h2><a class="btn btn-sm" href="#legal${c.toiDanh?.[0] ? '/' + c.toiDanh[0] : ''}">${icon('plus', 'ic-sm')}Lập kế hoạch</a></div>${plans.length ? `<ul class="doc-list">${plans.map(planRow).join('')}</ul>` : `<div class="empty"><p>Chưa có kế hoạch hỏi gắn với hồ sơ này.</p></div>`}`;
    } else {
      body.innerHTML = `<div class="panel-head"><h2>${icon('alert', 'ic-sm')}Đối chiếu mâu thuẫn giữa các lời khai</h2><button class="btn btn-sm btn-primary" type="button" data-cross>${icon('sparkles', 'ic-sm')}Phân tích</button></div><div class="panel-body" data-cross-out><p class="muted">So sánh số tiền, thời gian, diễn biến giữa ${recs.length} biên bản trong hồ sơ để tìm điểm không thống nhất.</p></div>`;
    }
    bind(recs);
  }

  function bind(recs) {
    const v = ctx.view;
    $$('[data-tab]', v).forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.tab;
        draw();
      }),
    );
    $('[data-edit]', v).addEventListener('click', () => caseForm(ctx, c, () => draw()));
    $$('[data-del-rec]', v).forEach((b) => b.addEventListener('click', () => confirmDeleteRecords(ctx, [b.dataset.delRec], () => draw())));
    bindDeletes(ctx, () => draw());
    $('[data-del]', v).addEventListener('click', async () => {
      if (!(await ctx.confirm(`Xóa hồ sơ “${c.ten}” cùng toàn bộ biên bản và kế hoạch hỏi?`, { title: 'Xóa hồ sơ', okText: 'Xóa vĩnh viễn', danger: true }))) return;
      deleteCase(c.id);
      toast('Đã xóa hồ sơ');
      ctx.navigate('#cases');
    });
    $('[data-add-person]', v)?.addEventListener('click', () => personForm(ctx, c, null, () => draw()));
    v.querySelectorAll('[data-pid]').forEach((li) => {
      const p = c.persons.find((x) => x.id === li.dataset.pid);
      li.querySelector('[data-edit-person]').addEventListener('click', () => personForm(ctx, c, p, () => draw()));
      li.querySelector('[data-del-person]').addEventListener('click', async () => {
        if (!(await ctx.confirm(`Xóa ${p.hoTen} khỏi hồ sơ? Các biên bản đã ghi vẫn được giữ lại.`, { title: 'Xóa người tham gia', okText: 'Xóa', danger: true }))) return;
        casesRepo.save({ ...c, persons: c.persons.filter((x) => x.id !== p.id) });
        draw();
      });
      li.querySelector('[data-interview]').addEventListener('click', () => startInterview(p));
    });
    $('[data-cross]', v)?.addEventListener('click', async (e) => {
      const out = $('[data-cross-out]', v);
      if (recs.length < 1) return (out.innerHTML = '<p class="muted">Chưa có biên bản để đối chiếu.</p>');
      const btn = e.currentTarget;
      btn.disabled = true;
      out.innerHTML = '<p><span class="typing"><span></span><span></span><span></span></span> Đang đối chiếu…</p>';
      try {
        let items;
        if (ctx.hasAI('legal')) {
          const crime = findCrime(c.toiDanh?.[0]);
          items = await aiContradictions({ ...ctx.ai('legal'), rec: recs[0], crime, others: recs.slice(1) });
        } else items = localContradictions(recs[0], recs.slice(1));
        out.innerHTML = items.length ? `<ul class="iv-ai-list">${items.map((m) => `<li class="lvl-${m.mucDo || 'trung-binh'}"><p><strong>${escapeHtml(m.moTa)}</strong></p>${(m.trichDan || []).map((t) => `<blockquote>${escapeHtml(t)}</blockquote>`).join('')}${m.cauHoiLamRo ? `<small>Câu hỏi làm rõ: ${escapeHtml(m.cauHoiLamRo)}</small>` : ''}</li>`).join('')}</ul>` : `<p class="note">${icon('check-circle', 'ic-sm')}<span>Chưa phát hiện mâu thuẫn rõ rệt giữa các lời khai.</span></p>`;
      } catch (err) {
        out.innerHTML = `<p class="note warn">${icon('alert', 'ic-sm')}<span>${escapeHtml(err.message)}</span></p>`;
      } finally {
        btn.disabled = false;
      }
    });
  }

  function startInterview(person) {
    const plans = plansRepo.list((p) => p.caseId === c.id && p.roleId === person.roleId);
    const crimes = (c.toiDanh || []).map(findCrime).filter(Boolean);
    ctx.modal(
      `<h2 class="modal-title">Ghi lời khai: ${escapeHtml(person.hoTen)}</h2>
       <p class="hint" style="margin-bottom:14px">${escapeHtml(getRole(person.roleId).ten)}</p>
       <form class="auth-form" data-f>
         <div class="field"><label for="si-plan">Kế hoạch hỏi</label><select class="select" id="si-plan" name="plan">
           ${plans.map((p) => `<option value="plan:${p.id}">Kế hoạch đã lưu: ${escapeHtml(p.title)}</option>`).join('')}
           ${crimes.map((cr) => `<option value="auto:${cr.dieu}">Tự động — Điều ${cr.dieu} ${escapeHtml(cr.ten.replace(/^Tội /, ''))} (tất cả hành vi)</option>`).join('')}
           <option value="">Không dùng kế hoạch</option>
         </select></div>
         <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit">${icon('message', 'ic-sm')}Bắt đầu</button></div>
       </form>`,
      {
        label: 'Bắt đầu ghi lời khai',
        onMount(box, close) {
          box.querySelector('[data-f]').addEventListener('submit', (e) => {
            e.preventDefault();
            const v = new FormData(e.target).get('plan');
            let plan = null;
            if (v.startsWith('plan:')) {
              const sp = plansRepo.get(v.slice(5));
              plan = generatePlan({ dieu: sp.dieu, hanhViIds: sp.hanhViIds, dinhKhung: sp.dinhKhung, roleId: person.roleId, lienQuan: sp.lienQuan || [] });
              applyOverlay(plan, sp.overlay);
            } else if (v.startsWith('auto:')) plan = generatePlan({ dieu: v.slice(5), roleId: person.roleId });
            const rec = newRecord({ caseItem: c, person, plan, settings: ctx.settings() });
            rec.lan = recordsRepo.list((r) => r.caseId === c.id && r.personId === person.id).length + 1;
            const saved = recordsRepo.save(rec);
            close();
            ctx.navigate(`#interview/${saved.id}`);
          });
        },
      },
    );
  }

  draw();
}

/** Áp lớp chỉnh sửa đã lưu của kế hoạch lên kế hoạch sinh mới. */
export function applyOverlay(plan, overlay) {
  if (!overlay) return plan;
  for (const is of plan.issues) {
    is.cauHoi = is.cauHoi.filter((x) => !(overlay.removed || []).includes(x.text)).map((x) => (overlay.edited?.[x.text] ? { ...x, text: overlay.edited[x.text] } : x));
    [...(overlay.ai?.[is.key] || []), ...(overlay.added?.[is.key] || [])].forEach((t) => is.cauHoi.push({ id: uid(), text: t, src: 'tuy-chinh', priority: 'high' }));
  }
  return plan;
}
