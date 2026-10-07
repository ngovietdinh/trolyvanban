// Theo dõi & báo cáo: nhìn nhanh tình trạng từng hồ sơ vụ án (đã làm / chưa làm), tiến độ theo kế hoạch hỏi,
// trạng thái từng câu hỏi, bảng tổng hợp kết quả lời khai, cảnh báo, phân tích – kết luận sơ bộ, xuất báo cáo Word.
import { $, $$, icon, toast, escapeHtml, downloadBlob, renderMarkdown } from '../ui.js';
import { casesRepo, recordsRepo, plansRepo, customBank, learnedBank } from '../legal/repo.js';
import { findCrime } from '../legal/engine.js';
import { qaToText } from '../legal/record.js';
import { INVESTIGATOR_SYSTEM } from '../legal/assist.js';
import { streamClaude } from '../lib/ai.js';
import { buildDocx, safeFileName } from '../lib/docx.js';
import { renderDocumentHtml } from '../lib/render-html.js';
import { relativeTime } from '../lib/vn-date.js';
import { Q_STATUS, Q_STATUS_ORDER, STAGES, caseReport, overviewReport, planFromSaved, qKey, buildCaseReportDocument, buildOverviewDocument } from '../legal/tracking.js';
import { openRecordUpload } from './record-upload.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const LEVEL = { cao: ['Cao', 'tk-lv-cao'], 'trung-binh': ['Trung bình', 'tk-lv-tb'], thap: ['Thấp', 'tk-lv-thap'] };
let tab = 'tong-quan';
let qFilter = 'all';
const openIssues = new Set(); // nhánh vấn đề đang mở ở tab Theo kế hoạch

const planOf = (saved) => planFromSaved(saved, { custom: customBank.all(), learned: learnedBank.all() });
const ring = (p, size = '') => `<span class="tk-ring ${size}" style="--p:${p}" role="img" aria-label="Tiến độ ${p}%"><b>${p}%</b></span>`;
const bar = (p) => `<span class="tk-bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></span>`;
const stagePill = (s) => `<span class="tk-stage tk-stage-${s}">${STAGES[s].label}</span>`;
const stPill = (s) => `<span class="tk-st tk-st-${s}">${Q_STATUS[s].short}</span>`;
const dots = (items) => `<span class="tk-dots" aria-hidden="true">${items.map((x) => `<i class="tk-dot tk-st-${x.status}" title="${escapeHtml(Q_STATUS[x.status].label)}"></i>`).join('')}</span>`;
const warnHtml = (w, caseName) => `<li class="tk-warn ${LEVEL[w.level][1]}"><span class="tk-lv">${LEVEL[w.level][0]}</span><span>${caseName ? `<strong>${escapeHtml(caseName)}:</strong> ` : ''}${escapeHtml(w.text)}</span>${w.href ? `<a class="btn btn-ghost btn-sm" href="${w.href}">Xử lý${icon('arrow-right', 'ic-sm')}</a>` : ''}</li>`;

/** Đổi trạng thái thủ công của một câu hỏi trong kế hoạch đã lưu ('' = tự động theo biên bản). */
export function setQuestionStatus(planId, text, status) {
  const p = plansRepo.get(planId);
  if (!p) return;
  const overlay = { removed: [], edited: {}, added: {}, ai: {}, ...(p.overlay || {}) };
  const track = { ...(overlay.track || {}) };
  if (status) track[qKey(text)] = status;
  else delete track[qKey(text)];
  plansRepo.save({ ...p, overlay: { ...overlay, track } });
}

export const statusSelectHtml = (x) =>
  `<select class="tk-st-sel tk-st-${x.status}" data-st aria-label="Trạng thái câu hỏi">${[['', `Tự động: ${Q_STATUS[x.auto].short}`], ...Q_STATUS_ORDER.map((k) => [k, Q_STATUS[k].label])].map(([k, l]) => `<option value="${k}" ${(x.manual ? x.status : '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`;

function exportDoc(ctx, doc, name) {
  downloadBlob(buildDocx(doc, doc.title.name), safeFileName(name), DOCX_MIME);
  toast('Đã xuất báo cáo Word (.docx)');
}
function previewDoc(ctx, doc) {
  ctx.modal(`<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button><div class="preview-modal-body print-area">${renderDocumentHtml(doc)}</div><div class="modal-actions"><button class="btn" type="button" data-close>Đóng</button><button class="btn btn-dark" type="button" data-print>${icon('printer', 'ic-sm')}In / PDF</button></div>`, {
    className: 'modal-preview',
    label: 'Xem bản in báo cáo',
    onMount(box) {
      box.querySelector('[data-print]').addEventListener('click', () => window.print());
    },
  });
}

export function render(ctx, params = []) {
  if (params[0]) {
    const c = casesRepo.get(params[0]);
    if (c) return renderCase(ctx, c.id);
    toast('Không tìm thấy hồ sơ', { type: 'error' });
  }
  return renderOverview(ctx);
}

/* ---------------- Tổng hợp tất cả hồ sơ ---------------- */
function renderOverview(ctx) {
  const o = overviewReport({ cases: casesRepo.list(), plans: plansRepo.list(), records: recordsRepo.list(), planOf });
  const t = o.totals;
  const warns = o.reports.flatMap((r) => r.warnings.map((w) => ({ ...w, caseName: r.caseItem.ten }))).sort((a, b) => ['cao', 'trung-binh', 'thap'].indexOf(a.level) - ['cao', 'trung-binh', 'thap'].indexOf(b.level));
  ctx.view.innerHTML = `
  <div class="page tk">
    <div class="page-head">
      <div><h1 class="page-title">Theo dõi &amp; <em>báo cáo</em></h1><p class="page-sub">Nhìn nhanh tình trạng từng hồ sơ: đã làm gì, còn thiếu gì, câu hỏi nào đã có trả lời, cảnh báo cần xử lý và kết luận sơ bộ từ các biên bản đã ghi.</p></div>
      <div class="inline tk-actions">
        <button class="btn btn-sm" type="button" data-upload>${icon('upload', 'ic-sm')}Tải biên bản lên</button>
        <button class="btn btn-sm btn-ghost" type="button" data-preview>${icon('eye', 'ic-sm')}Xem bản in</button>
        <button class="btn btn-sm btn-primary" type="button" data-export>${icon('download', 'ic-sm')}Báo cáo Word</button>
      </div>
    </div>
    <div class="tk-kpis">
      <div class="tk-kpi">${ring(t.pct, 'lg')}<span><strong>Tiến độ câu hỏi</strong><small>${t.qDone}/${t.questions} câu đã có trả lời hoặc không cần hỏi</small></span></div>
      <div class="tk-kpi"><strong>${t.cases}</strong><span>Hồ sơ vụ án<small>${Object.entries(t.stages).filter(([, n]) => n).map(([k, n]) => `${n} ${STAGES[k].label.toLowerCase()}`).join(' · ') || 'Chưa có hồ sơ'}</small></span></div>
      <div class="tk-kpi"><strong>${t.records}</strong><span>Biên bản<small>${t.recordsDone} đã hoàn thành · ${t.plans} kế hoạch hỏi</small></span></div>
      <div class="tk-kpi ${t.high ? 'alert' : ''}"><strong>${t.warnings}</strong><span>Cảnh báo<small>${t.high} mức cao</small></span></div>
    </div>
    ${
      o.reports.length
        ? `<section class="panel"><div class="panel-head"><h2>${icon('chart', 'ic-sm')}Bảng tổng hợp hồ sơ</h2><div class="chips tk-stage-filter">${['all', ...Object.keys(STAGES)].map((k) => `<button class="chip" type="button" data-stage="${k}" aria-pressed="${k === 'all'}">${k === 'all' ? 'Tất cả' : STAGES[k].label} (${k === 'all' ? o.reports.length : t.stages[k]})</button>`).join('')}</div></div>
          <div class="tk-table-wrap"><table class="tk-table">
            <thead><tr><th>Hồ sơ</th><th>Tội danh</th><th>Người đã lấy lời khai</th><th>Biên bản</th><th>Tiến độ</th><th>Cảnh báo</th><th>Tình trạng</th></tr></thead>
            <tbody>${o.reports
              .map((r) => {
                const hi = r.warnings.filter((w) => w.level === 'cao').length;
                return `<tr data-row-stage="${r.stage}">
                <td data-l="Hồ sơ"><a class="tk-case" href="#theo-doi/${r.caseItem.id}"><strong>${escapeHtml(r.caseItem.ten)}</strong><small>${escapeHtml(r.caseItem.soHoSo || 'Chưa có số')} · ${r.lastActivity ? relativeTime(r.lastActivity) : ''}</small></a></td>
                <td data-l="Tội danh">${(r.caseItem.toiDanh || []).map((d) => `<span class="kw" title="${escapeHtml(findCrime(d)?.ten || '')}">Đ.${d}</span>`).join(' ') || '<span class="muted">—</span>'}</td>
                <td data-l="Người đã lấy lời khai">${r.totals.personsDone}/${r.totals.persons}</td>
                <td data-l="Biên bản">${r.totals.records}${r.totals.records ? ` <small class="muted">(${r.totals.recordsDone} xong)</small>` : ''}</td>
                <td data-l="Tiến độ"><span class="tk-prog">${bar(r.totals.pct)}<b>${r.totals.pct}%</b></span></td>
                <td data-l="Cảnh báo">${r.warnings.length ? `<span class="badge ${hi ? 'tk-badge-hi' : 'badge-warning'}">${r.warnings.length}${hi ? ` · ${hi} cao` : ''}</span>` : '<span class="badge badge-success">Không</span>'}</td>
                <td data-l="Tình trạng">${stagePill(r.stage)}</td>
              </tr>`;
              })
              .join('')}</tbody></table></div></section>`
        : `<section class="panel"><div class="empty"><div class="empty-icon">${icon('activity', 'ic-lg')}</div><h3>Chưa có hồ sơ để theo dõi</h3><p>Tạo hồ sơ vụ án, lập kế hoạch hỏi và ghi (hoặc tải lên) biên bản — tiến độ, cảnh báo và kết luận sẽ tự tổng hợp tại đây.</p><a class="btn btn-primary" href="#cases">${icon('folder')}Mở Hồ sơ vụ án</a></div></section>`
    }
    ${warns.length ? `<section class="panel"><div class="panel-head"><h2>${icon('alert', 'ic-sm')}Cảnh báo cần xử lý (${warns.length})</h2></div><ul class="tk-warns">${warns.slice(0, 15).map((w) => warnHtml(w, w.caseName)).join('')}</ul>${warns.length > 15 ? `<p class="hint tk-more">Còn ${warns.length - 15} cảnh báo — mở từng hồ sơ để xem đầy đủ.</p>` : ''}</section>` : ''}
    ${
      o.loose.length
        ? `<section class="panel"><div class="panel-head"><h2>${icon('layers', 'ic-sm')}Kế hoạch hỏi chưa gắn hồ sơ</h2></div><ul class="tk-plans">${o.loose
            .map((p) => `<li><a href="#legal/plan/${p.saved.id}"><strong>${escapeHtml(p.saved.title)}</strong><small>${p.records.length} biên bản · Điều ${escapeHtml(p.saved.dieu)}</small></a>${p.track ? `<span class="tk-prog">${bar(p.track.totals.pct)}<b>${p.track.totals.pct}%</b></span>` : ''}</li>`)
            .join('')}</ul></section>`
        : ''
    }
  </div>`;
  const v = ctx.view;
  $('[data-upload]', v).addEventListener('click', () => openRecordUpload(ctx, { onSaved: () => renderOverview(ctx) }));
  $('[data-export]', v).addEventListener('click', () => exportDoc(ctx, buildOverviewDocument(o, ctx.settings().legalOrg || {}), 'bao-cao-tong-hop-tien-do'));
  $('[data-preview]', v).addEventListener('click', () => previewDoc(ctx, buildOverviewDocument(o, ctx.settings().legalOrg || {})));
  $$('[data-stage]', v).forEach((b) =>
    b.addEventListener('click', () => {
      $$('[data-stage]', v).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $$('[data-row-stage]', v).forEach((tr) => (tr.hidden = b.dataset.stage !== 'all' && tr.dataset.rowStage !== b.dataset.stage));
    }),
  );
}

/* ---------------- Một hồ sơ ---------------- */
function renderCase(ctx, id) {
  const c = casesRepo.get(id);
  const r = caseReport({ caseItem: c, plans: plansRepo.list(), records: recordsRepo.list(), planOf });
  const t = r.totals;
  const hi = r.warnings.filter((w) => w.level === 'cao').length;
  const TABS = [
    ['tong-quan', 'Tổng quan'],
    ['ke-hoach', `Theo kế hoạch (${r.plans.length})`],
    ['ket-qua', 'Bảng kết quả'],
    ['canh-bao', `Cảnh báo (${r.warnings.length})`],
    ['phan-tich', 'Phân tích & kết luận'],
  ];
  if (!TABS.some(([k]) => k === tab)) tab = 'tong-quan';
  ctx.view.innerHTML = `
  <div class="page tk">
    <a class="btn btn-ghost btn-sm" href="#theo-doi" style="margin-bottom:10px">${icon('chevron-left', 'ic-sm')}Tất cả hồ sơ</a>
    <header class="panel tk-head">
      ${ring(t.pct, 'lg')}
      <div class="tk-head-body">
        <div class="inline"><span class="case-no">${escapeHtml(c.soHoSo || 'Chưa có số')}</span>${stagePill(r.stage)}</div>
        <h1 class="page-title">${escapeHtml(c.ten)}</h1>
        <div class="chips">${(c.toiDanh || []).map((d) => `<a class="kw" href="#legal/${d}">Đ.${d} ${escapeHtml(findCrime(d)?.ten.replace(/^Tội /, '') || '')}</a>`).join('') || '<span class="muted">Chưa xác định tội danh</span>'}</div>
      </div>
      <div class="inline tk-actions">
        <a class="btn btn-sm btn-ghost" href="#cases/${c.id}">${icon('folder', 'ic-sm')}Mở hồ sơ</a>
        <button class="btn btn-sm" type="button" data-upload>${icon('upload', 'ic-sm')}Tải biên bản lên</button>
        <button class="btn btn-sm btn-ghost" type="button" data-preview>${icon('eye', 'ic-sm')}Xem bản in</button>
        <button class="btn btn-sm btn-primary" type="button" data-export>${icon('download', 'ic-sm')}Báo cáo Word</button>
      </div>
    </header>
    <div class="tk-kpis">
      <div class="tk-kpi"><strong>${t.personsDone}/${t.persons}</strong><span>Người đã lấy lời khai</span></div>
      <div class="tk-kpi"><strong>${t.records}</strong><span>Biên bản<small>${t.recordsDone} đã hoàn thành</small></span></div>
      <div class="tk-kpi"><strong>${t.qDone}/${t.questions}</strong><span>Câu hỏi đã xong<small>${t.answers} lượt trả lời</small></span></div>
      <div class="tk-kpi ${hi ? 'alert' : ''}"><strong>${r.warnings.length}</strong><span>Cảnh báo<small>${hi} mức cao</small></span></div>
    </div>
    <div class="tabs tk-tabs" role="tablist">${TABS.map(([k, l]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
    <section class="panel tk-body" data-body></section>
  </div>`;
  const v = ctx.view;
  const body = $('[data-body]', v);
  const redraw = () => renderCase(ctx, id);
  const org = ctx.settings().legalOrg || {};
  $('[data-upload]', v).addEventListener('click', () => openRecordUpload(ctx, { caseId: id, onSaved: redraw }));
  $('[data-export]', v).addEventListener('click', () => exportDoc(ctx, buildCaseReportDocument(r, org), `bao-cao-${c.soHoSo || c.ten}`));
  $('[data-preview]', v).addEventListener('click', () => previewDoc(ctx, buildCaseReportDocument(r, org)));
  $$('[data-tab]', v).forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.tab;
      redraw();
    }),
  );

  if (tab === 'tong-quan') body.innerHTML = overviewTab(r);
  else if (tab === 'ke-hoach') body.innerHTML = plansTab(r);
  else if (tab === 'ket-qua') body.innerHTML = resultsTab(r);
  else if (tab === 'canh-bao') body.innerHTML = r.warnings.length ? `<ul class="tk-warns">${r.warnings.map((w) => warnHtml(w)).join('')}</ul>` : `<div class="empty"><div class="empty-icon">${icon('check-circle', 'ic-lg')}</div><h3>Không có cảnh báo</h3></div>`;
  else body.innerHTML = analysisTab(ctx, r);

  body.addEventListener(
    'toggle',
    (e) => {
      const d = e.target.closest?.('[data-is]');
      if (d) d.open ? openIssues.add(d.dataset.is) : openIssues.delete(d.dataset.is);
    },
    true,
  );
  // Đổi trạng thái câu hỏi thủ công.
  body.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-st]');
    if (sel) {
      const li = sel.closest('[data-q]');
      setQuestionStatus(li.dataset.plan, li.dataset.q, sel.value);
      toast(sel.value ? `Đã đánh dấu: ${Q_STATUS[sel.value].label}` : 'Trạng thái tự động theo biên bản');
      return redraw();
    }
    const qf = e.target.closest('[data-qfilter]');
    if (qf) {
      qFilter = qf.value;
      redraw();
    }
  });
  $('[data-ai-conclude]', body)?.addEventListener('click', (e) => aiConclude(ctx, c, r, e.currentTarget, redraw));
}

function overviewTab(r) {
  const c = r.caseItem;
  const suspects = r.persons.filter((p) => p.role.nhom === 'nghi-pham');
  const signs = r.analysis.crimes.reduce((s, x) => [s[0] + x.hit, s[1] + x.total], [0, 0]);
  const steps = [
    [!!(c.toiDanh || []).length, 'Xác định tội danh (điều luật)', (c.toiDanh || []).map((d) => `Điều ${d}`).join(', ') || 'Chưa có', `#cases/${c.id}`],
    [r.persons.length > 0, 'Thêm người tham gia tố tụng', `${r.persons.length} người`, `#cases/${c.id}`],
    [r.plans.length > 0, 'Lập kế hoạch hỏi', `${r.plans.length} kế hoạch`, `#legal${c.toiDanh?.[0] ? `/${c.toiDanh[0]}` : ''}`],
    [suspects.length > 0 && suspects.every((p) => p.records), 'Lấy lời khai người bị buộc tội', suspects.length ? `${suspects.filter((p) => p.records).length}/${suspects.length} người` : 'Chưa có trong hồ sơ', `#cases/${c.id}`],
    [r.persons.length > 0 && r.persons.every((p) => p.records), 'Lấy lời khai tất cả người tham gia', `${r.totals.personsDone}/${r.totals.persons} người`, `#cases/${c.id}`],
    [r.totals.records > 0 && r.totals.recordsDone === r.totals.records, 'Hoàn thành, ký biên bản', `${r.totals.recordsDone}/${r.totals.records} biên bản`, `#cases/${c.id}`],
    [r.totals.questions > 0 && r.totals.pct >= 100, 'Trả lời đủ câu hỏi theo kế hoạch', `${r.totals.qDone}/${r.totals.questions} (${r.totals.pct}%)`, null],
    [signs[1] > 0 && signs[0] === signs[1], 'Làm rõ dấu hiệu định tội', `${signs[0]}/${signs[1]} dấu hiệu đã có lời khai đề cập`, null],
    [!r.analysis.contradictions.length && r.totals.records > 0, 'Không còn mâu thuẫn giữa các lời khai', r.analysis.contradictions.length ? `${r.analysis.contradictions.length} điểm mâu thuẫn` : r.totals.records ? 'Chưa phát hiện' : 'Chưa có biên bản', null],
  ];
  const done = steps.filter((s) => s[0]).length;
  return `<div class="tk-grid">
    <section><h3 class="tk-h">${icon('check-circle', 'ic-sm')}Đã làm / chưa làm <small>${done}/${steps.length}</small></h3>
      <ol class="tk-steps">${steps.map(([ok, label, sub, href]) => `<li class="${ok ? 'ok' : 'todo'}"><span class="tk-step-ic">${icon(ok ? 'check' : 'clock', 'ic-sm')}</span><span><strong>${label}</strong><small>${escapeHtml(sub)}</small></span>${!ok && href ? `<a class="btn btn-ghost btn-sm" href="${href}">Làm ngay</a>` : ''}</li>`).join('')}</ol>
    </section>
    <section><h3 class="tk-h">${icon('user', 'ic-sm')}Người tham gia tố tụng</h3>
      ${r.persons.length ? `<ul class="tk-people">${r.persons.map((p) => `<li><span class="avatar">${escapeHtml((p.person.hoTen.split(/\s+/).pop() || '?')[0])}</span><span><strong>${escapeHtml(p.person.hoTen)}</strong><small>${escapeHtml(p.role.ten.split('/')[0].trim())} · ${p.records} biên bản${p.last ? ` · ${relativeTime(p.last)}` : ''}</small></span><span class="tk-pst tk-pst-${p.status}">${{ 'chua-lay': 'Chưa lấy lời khai', 'dang-ghi': 'Đang ghi', 'da-lay': 'Đã lấy lời khai' }[p.status]}</span></li>`).join('')}</ul>` : '<p class="muted">Chưa có người tham gia tố tụng.</p>'}
      <h3 class="tk-h">${icon('layers', 'ic-sm')}Kế hoạch hỏi</h3>
      ${r.plans.length ? `<ul class="tk-plans">${r.plans.map((p) => `<li><a href="#legal/plan/${p.saved.id}"><strong>${escapeHtml(p.saved.title)}</strong><small>${p.records.length} biên bản${p.track ? ` · ${p.track.totals.done}/${p.track.totals.total} câu` : ''}</small></a>${p.track ? `<span class="tk-prog">${bar(p.track.totals.pct)}<b>${p.track.totals.pct}%</b></span>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Chưa có kế hoạch hỏi gắn với hồ sơ.</p>'}
      ${r.warnings.length ? `<h3 class="tk-h">${icon('alert', 'ic-sm')}Cảnh báo quan trọng</h3><ul class="tk-warns">${r.warnings.slice(0, 4).map((w) => warnHtml(w)).join('')}</ul>` : ''}
    </section>
  </div>`;
}

function legendHtml() {
  return `<div class="tk-legend">${Q_STATUS_ORDER.map((k) => `<span><i class="tk-dot tk-st-${k}"></i>${Q_STATUS[k].label}</span>`).join('')}</div>`;
}

function plansTab(r) {
  if (!r.plans.length) return `<div class="empty"><p>Chưa có kế hoạch hỏi gắn với hồ sơ. Lập kế hoạch ở Cây hỏi đáp rồi “Lưu kế hoạch” vào hồ sơ này để theo dõi từng câu hỏi.</p><a class="btn btn-primary" href="#legal">${icon('layers')}Mở Cây hỏi đáp</a></div>`;
  return `${legendHtml()}${r.plans
    .map((p) => {
      if (!p.track) return `<p class="note warn">${icon('alert', 'ic-sm')}<span>Kế hoạch “${escapeHtml(p.saved.title)}”: điều luật không còn trong hệ thống.</span></p>`;
      const tt = p.track.totals;
      return `<details class="tk-plan" open><summary><span><strong>${escapeHtml(p.saved.title)}</strong><small>${p.records.length} biên bản · ${Q_STATUS_ORDER.filter((k) => tt.counts[k]).map((k) => `${tt.counts[k]} ${Q_STATUS[k].short.toLowerCase()}`).join(' · ')}</small></span><span class="tk-prog">${bar(tt.pct)}<b>${tt.pct}%</b></span><a class="btn btn-ghost btn-sm" href="#legal/plan/${p.saved.id}">Cây hỏi đáp</a></summary>
        <ol class="tk-issues">${p.track.issues
          .map(
            (is) => `<li><details data-is="${p.saved.id}|${escapeHtml(is.key)}" ${openIssues.has(`${p.saved.id}|${is.key}`) ? 'open' : ''}><summary><span class="tk-is-t"><strong>${escapeHtml(is.tieuDe)}</strong>${dots(is.items)}</span><span class="tk-is-n">${is.done}/${is.total}</span></summary>
              <ol class="tk-qs">${is.items
                .map(
                  (x) => `<li data-q="${escapeHtml(x.text)}" data-plan="${p.saved.id}" class="${x.priority === 'high' ? 'hi' : ''}"><div class="tk-q-row"><span class="tk-q-text">${escapeHtml(x.text)}</span>${statusSelectHtml(x)}</div>${x.answers.length ? `<ul class="tk-ans">${x.answers.map((a) => `<li><a href="#interview/${a.recId}">${escapeHtml(a.who)}</a>: ${escapeHtml(a.a.length > 320 ? `${a.a.slice(0, 318)}…` : a.a)}${a.quality === 'vague' ? ' <span class="badge badge-warning">Mơ hồ</span>' : ''}</li>`).join('')}</ul>` : ''}</li>`,
                )
                .join('')}</ol></details></li>`,
          )
          .join('')}</ol></details>`;
    })
    .join('')}`;
}

function resultsTab(r) {
  const rows = r.plans.flatMap((p) => (p.track?.issues || []).flatMap((is) => is.items.map((x) => ({ p, is, x }))));
  const shown = rows.filter(({ x }) => (qFilter === 'all' ? x.status !== 'chua' : x.status === qFilter));
  return `<div class="tk-res-head"><label class="hint" for="tk-qf">Lọc theo trạng thái</label><select class="select" id="tk-qf" data-qfilter><option value="all" ${qFilter === 'all' ? 'selected' : ''}>Đã hỏi (mọi trạng thái)</option>${Q_STATUS_ORDER.map((k) => `<option value="${k}" ${qFilter === k ? 'selected' : ''}>${Q_STATUS[k].label} (${rows.filter(({ x }) => x.status === k).length})</option>`).join('')}</select></div>
  ${
    shown.length
      ? `<div class="tk-table-wrap"><table class="tk-table tk-res"><thead><tr><th>Vấn đề</th><th>Câu hỏi</th><th>Nội dung trả lời (người khai)</th><th>Trạng thái</th></tr></thead><tbody>${shown
          .map(({ is, x }) => `<tr><td data-l="Vấn đề">${escapeHtml(is.tieuDe.replace(/^Hành vi:\s*/, ''))}</td><td data-l="Câu hỏi">${escapeHtml(x.text)}</td><td data-l="Trả lời">${x.answers.length ? x.answers.map((a) => `<p><a href="#interview/${a.recId}">${escapeHtml(a.who)}</a>: ${escapeHtml(a.a)}</p>`).join('') : '<span class="muted">—</span>'}</td><td data-l="Trạng thái">${stPill(x.status)}</td></tr>`)
          .join('')}</tbody></table></div>`
      : `<p class="muted">${rows.length ? 'Không có câu hỏi nào ở trạng thái này.' : 'Chưa có kế hoạch hỏi để tổng hợp. Câu trả lời của các biên bản không theo kế hoạch xem ở tab Phân tích & kết luận.'}</p>`
  }`;
}

function analysisTab(ctx, r) {
  const a = r.analysis;
  const c = r.caseItem;
  return `<div class="tk-grid">
    <section>
      <h3 class="tk-h">${icon('gavel', 'ic-sm')}Dấu hiệu định tội đã có lời khai đề cập</h3>
      ${a.crimes.length ? a.crimes.map((x) => `<div class="tk-signs"><p><strong>Điều ${x.crime.dieu}. ${escapeHtml(x.crime.ten)}</strong> <span class="badge ${x.hit === x.total ? 'badge-success' : 'badge-warning'}">${x.hit}/${x.total}</span></p><ul>${x.signs.map((s) => `<li class="${s.hit ? 'hit' : 'miss'}">${icon(s.hit ? 'check' : 'x', 'ic-sm')}<span>${escapeHtml(s.text)}${s.note ? ` <small>(${escapeHtml(s.note)})</small>` : ''}</span></li>`).join('')}</ul></div>`).join('') : '<p class="muted">Hồ sơ chưa có tội danh để đối chiếu.</p>'}
      ${a.money.length ? `<h3 class="tk-h">${icon('hash', 'ic-sm')}Số tiền được nêu trong lời khai</h3><div class="chips">${a.money.slice(0, 12).map((m) => `<span class="kw">${escapeHtml(m.raw)}</span>`).join('')}</div>` : ''}
    </section>
    <section>
      <h3 class="tk-h">${icon('book', 'ic-sm')}Kết luận sơ bộ (phân tích trên máy)</h3>
      <ul class="tk-concl">${r.conclusions.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
      <div class="tk-ai">
        <div class="inline"><strong>${icon('sparkles', 'ic-sm')}Nhận định của trợ lý AI</strong><span class="spacer"></span><button class="btn btn-sm ${c.aiConclusion ? '' : 'btn-primary'}" type="button" data-ai-conclude>${c.aiConclusion ? 'Phân tích lại' : 'AI phân tích, kết luận'}</button></div>
        <div data-ai-out>${c.aiConclusion ? `<div class="md">${renderMarkdown(c.aiConclusion.text)}</div><p class="hint">${relativeTime(c.aiConclusion.at)} · ${escapeHtml(c.aiConclusion.model || '')} — chỉ để tham khảo.</p>` : `<p class="hint">${ctx.hasAI('legal') ? 'AI đọc toàn bộ biên bản trong hồ sơ, đối chiếu với dấu hiệu cấu thành để nhận định những gì đã/chưa chứng minh, mâu thuẫn và việc cần làm tiếp.' : ctx.can('legal.ai') ? 'Thêm API key (hoặc AI trên máy) trong Cài đặt để dùng nhận định AI.' : 'Phân hệ Tố tụng đang ngoại tuyến — dùng kết luận sơ bộ trên máy; cần quản trị cấp quyền để dùng AI trực tuyến (AI trên máy vẫn dùng được).'}</p>`}</div>
      </div>
      <h3 class="tk-h">${icon('alert', 'ic-sm')}Mâu thuẫn giữa các lời khai</h3>
      ${a.contradictions.length ? `<ul class="iv-ai-list">${a.contradictions.map((m) => `<li class="lvl-${m.mucDo || 'trung-binh'}"><p><strong>${escapeHtml(m.moTa)}</strong></p>${(m.trichDan || []).map((t) => `<blockquote>${escapeHtml(t)}</blockquote>`).join('')}${m.cauHoiLamRo ? `<small>Câu hỏi làm rõ: ${escapeHtml(m.cauHoiLamRo)}</small>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Chưa phát hiện mâu thuẫn rõ rệt về số tiền, diễn biến.</p>'}
      <h3 class="tk-h">${icon('help', 'ic-sm')}Câu trả lời mơ hồ, né tránh (${a.vague.length})</h3>
      ${a.vague.length ? `<ul class="tk-ans">${a.vague.slice(0, 12).map((x) => `<li><a href="#interview/${x.recId}">${escapeHtml(x.who)}</a> — <em>${escapeHtml(x.q)}</em>: ${escapeHtml(x.a)}</li>`).join('')}</ul>` : '<p class="muted">Không có.</p>'}
    </section>
  </div>`;
}

async function aiConclude(ctx, c, r, btn, redraw) {
  const ai = ctx.ai('legal');
  if (!ai) return toast(ctx.can('legal.ai') ? 'Cần thêm API key AI (hoặc AI trên máy) trong Cài đặt' : 'Phân hệ Tố tụng đang ngoại tuyến — liên hệ quản trị để được cấp quyền AI trực tuyến', { type: 'info', timeout: 4500 });
  const recs = recordsRepo.list((x) => x.caseId === c.id);
  if (!recs.length) return toast('Hồ sơ chưa có biên bản để phân tích', { type: 'info' });
  btn.disabled = true;
  btn.innerHTML = `${icon('refresh', 'ic-sm spin')}Đang phân tích…`;
  const out = $('[data-ai-out]', ctx.view);
  try {
    const crimes = r.analysis.crimes.map((x) => `Điều ${x.crime.dieu} — ${x.crime.ten}\n  Dấu hiệu: ${x.crime.dauHieu.join('; ')}`).join('\n');
    const qa = recs.map((x) => `--- Biên bản ${x.nguoiKhai?.hoTen || ''} (lần ${x.lan || 1}):\n${qaToText(x)}`).join('\n').slice(0, 16000);
    const text = await streamClaude({
      provider: ai.provider,
      apiKey: ai.apiKey,
      model: ai.model,
      system: INVESTIGATOR_SYSTEM,
      maxTokens: 3000,
      messages: [{ role: 'user', content: `Hồ sơ: ${c.ten}\nTội danh và dấu hiệu định tội:\n${crimes || '(chưa xác định)'}\n\nTỔNG HỢP TIẾN ĐỘ:\n${r.conclusions.join('\n')}\n\nNỘI DUNG CÁC BIÊN BẢN:\n${qa}\n\nViết nhận định ngắn gọn (Markdown, tiếng Việt) gồm các mục: 1) Kết quả đã làm rõ; 2) Dấu hiệu cấu thành đã/chưa có căn cứ; 3) Mâu thuẫn, điểm nghi vấn; 4) Việc cần làm tiếp (câu hỏi, đối chất, tài liệu, giám định). Chỉ dựa trên nội dung biên bản, không suy diễn.` }],
      onText: (d, all) => out && (out.innerHTML = `<div class="md">${renderMarkdown(all)}</div>`),
    });
    casesRepo.save({ ...casesRepo.get(c.id), aiConclusion: { text, at: Date.now(), model: ai.model } });
    toast('Đã lưu nhận định AI vào hồ sơ (có trong báo cáo Word)');
    redraw();
  } catch (err) {
    toast(err.message, { type: 'error', timeout: 6000 });
    btn.disabled = false;
    btn.innerHTML = 'AI phân tích, kết luận';
  }
}
