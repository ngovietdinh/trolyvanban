// Ghi lời khai / hỏi cung trực tiếp theo kế hoạch, có trợ lý phân tích (AI hoặc cục bộ) và xuất biên bản.
import { $, $$, icon, toast, escapeHtml, copyText, downloadBlob, debounce } from '../ui.js';
import { recordsRepo, casesRepo } from '../legal/repo.js';
import { buildRecordDocument, PERSON_FIELDS, newRecord } from '../legal/record.js';
import { ROLES, getRole } from '../legal/roles.js';
import { findCrime, generatePlan } from '../legal/engine.js';
import { aiSuggest, aiContradictions, aiCoverage, aiNormalize, localSuggest, localContradictions, localCoverage, localNormalize } from '../legal/assist.js';
import { renderDocumentHtml } from '../lib/render-html.js';
import { buildDocx, safeFileName } from '../lib/docx.js';
import { relativeTime } from '../lib/vn-date.js';
import { uid } from '../lib/store.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const COV = { ro: ['Đã rõ', 'ok'], 'mot-phan': ['Một phần', 'part'], chua: ['Chưa rõ', 'no'] };

/* ---------------- Danh sách biên bản ---------------- */
function renderList(ctx) {
  const recs = recordsRepo.list();
  ctx.view.innerHTML = `
  <div class="page">
    <div class="page-head">
      <div><h1 class="page-title">Biên bản <em>ghi lời khai</em></h1><p class="page-sub">Biên bản hỏi cung bị can, ghi lời khai người làm chứng, bị hại, người liên quan.</p></div>
      <div class="inline"><a class="btn" href="#legal">${icon('layers', 'ic-sm')}Lập kế hoạch hỏi</a><button class="btn btn-primary" type="button" data-new>${icon('plus', 'ic-sm')}Biên bản mới</button></div>
    </div>
    <section class="panel">${
      recs.length
        ? `<ul class="doc-list">${recs
            .map((r) => {
              const c = r.caseId ? casesRepo.get(r.caseId) : null;
              const crime = r.plan?.dieu ? findCrime(r.plan.dieu) : null;
              return `<li class="doc-item"><span class="doc-icon">${r.roleId === 'bi-can' ? 'HC' : 'LK'}</span>
                <div class="doc-meta"><a href="#interview/${r.id}">${escapeHtml(r.nguoiKhai?.hoTen || 'Chưa ghi tên')} — ${escapeHtml(getRole(r.roleId).ten.split('/')[0])}</a>
                <small>${c ? escapeHtml(c.ten) + ' · ' : ''}${crime ? `Điều ${crime.dieu} · ` : ''}${(r.qa || []).length} lượt hỏi – đáp · ${r.status === 'hoan-thanh' ? 'Đã hoàn thành' : 'Đang ghi'} · ${relativeTime(r.updatedAt)}</small></div>
                <span class="badge ${r.status === 'hoan-thanh' ? 'badge-success' : 'badge-warning'}">${r.status === 'hoan-thanh' ? 'Hoàn thành' : 'Đang ghi'}</span></li>`;
            })
            .join('')}</ul>`
        : `<div class="empty"><div class="empty-icon">${icon('message', 'ic-lg')}</div><h3>Chưa có biên bản</h3><p>Lập kế hoạch hỏi từ Cây hỏi đáp pháp luật rồi bắt đầu ghi lời khai.</p><a class="btn btn-primary" href="#legal">${icon('layers')}Mở cây hỏi đáp</a></div>`
    }</section>
  </div>`;
  $('[data-new]', ctx.view).addEventListener('click', () => {
    const rec = recordsRepo.save(newRecord({ settings: ctx.settings() }));
    ctx.navigate(`#interview/${rec.id}`);
  });
}

/* ---------------- Ghi lời khai ---------------- */
export function render(ctx, params = []) {
  if (!params[0]) return renderList(ctx);
  let rec = recordsRepo.get(params[0]);
  if (!rec) {
    toast('Không tìm thấy biên bản', { type: 'error' });
    return renderList(ctx);
  }
  const crime = rec.plan?.dieu ? findCrime(rec.plan.dieu) : null;
  let current = { q: '', issueId: null, editIndex: null };
  let aiTab = 'suggest';
  let aiResults = { suggest: null, contra: null, cover: null };
  let controller = null;
  const role = () => getRole(rec.roleId);
  const openIssues = new Map();

  const save = debounce(() => {
    rec = recordsRepo.save(rec);
  }, 250);

  ctx.view.innerHTML = `
  <div class="iv" data-iv>
    <aside class="iv-plan" aria-label="Kế hoạch hỏi">
      <div class="iv-plan-head">
        <strong>Kế hoạch hỏi</strong>
        <div class="iv-progress" data-progress></div>
      </div>
      <div class="iv-plan-body" data-plan></div>
    </aside>

    <section class="iv-main" aria-label="Biên bản">
      <header class="iv-head">
        <div class="iv-who">
          <span class="avatar">${icon('user', 'ic-sm')}</span>
          <div><strong data-who></strong><small data-whosub></small></div>
        </div>
        <div class="inline">
          <button class="btn btn-sm btn-ghost" type="button" data-info title="Thông tin biên bản" aria-label="Thông tin biên bản">${icon('clipboard', 'ic-sm')}<span class="btn-label">Thông tin biên bản</span></button>
          <button class="btn btn-sm btn-ghost" type="button" data-preview title="Xem biên bản" aria-label="Xem biên bản">${icon('eye', 'ic-sm')}<span class="btn-label">Xem biên bản</span></button>
          <button class="btn btn-sm" type="button" data-export title="Xuất Word" aria-label="Xuất biên bản Word">${icon('download', 'ic-sm')}<span class="btn-label">Xuất Word</span></button>
          <button class="btn btn-sm btn-dark" type="button" data-finish title="Kết thúc biên bản" aria-label="Kết thúc biên bản">${icon('check', 'ic-sm')}<span class="btn-label" data-finish-label>Kết thúc</span></button>
        </div>
      </header>
      <div class="iv-transcript" data-transcript aria-live="polite"></div>
      <form class="iv-composer" data-composer>
        <div class="iv-q">
          <label for="iv-q">Hỏi</label>
          <textarea id="iv-q" rows="2" placeholder="Chọn câu hỏi từ kế hoạch bên trái hoặc nhập câu hỏi…" data-q></textarea>
        </div>
        <div class="iv-a">
          <label for="iv-a">Trả lời</label>
          <textarea id="iv-a" rows="4" placeholder="Ghi lời khai… (Ctrl + Enter để lưu)" data-a></textarea>
        </div>
        <div class="iv-composer-actions">
          <span class="hint" data-issue-hint></span>
          <span class="spacer"></span>
          <button class="btn btn-sm" type="button" data-normalize title="Chuẩn hóa văn phong biên bản">${icon('wand', 'ic-sm')}Chuẩn hóa</button>
          <button class="btn btn-sm btn-ghost" type="button" data-cancel-edit hidden>Hủy sửa</button>
          <button class="btn btn-primary btn-sm" type="submit" data-submit>${icon('check', 'ic-sm')}Ghi vào biên bản</button>
        </div>
      </form>
    </section>

    <aside class="iv-ai" aria-label="Trợ lý phân tích lời khai">
      <div class="iv-ai-head">
        <strong>${icon('sparkles', 'ic-sm')}Trợ lý phân tích</strong>
        <span class="badge ${ctx.hasAI('legal') ? 'badge-success' : ''}" data-ai-mode title="${ctx.hasAI('legal') ? 'Nội dung lời khai sẽ được gửi tới dịch vụ AI bên ngoài' : 'Phân tích chạy hoàn toàn trên máy, không gửi dữ liệu ra ngoài'}">${ctx.hasAI('legal') ? escapeHtml(ctx.ai('legal').label) : 'Ngoại tuyến'}</span>
      </div>
      <div class="tabs iv-ai-tabs" role="tablist">
        <button class="tab" role="tab" data-aitab="suggest">Gợi ý hỏi</button>
        <button class="tab" role="tab" data-aitab="contra">Mâu thuẫn</button>
        <button class="tab" role="tab" data-aitab="cover">Mức độ rõ</button>
      </div>
      <div class="iv-ai-body" data-aibody></div>
    </aside>
  </div>`;

  const root = ctx.view;
  const qBox = $('[data-q]', root);
  const aBox = $('[data-a]', root);

  /* ----- Đầu biên bản ----- */
  function renderHead() {
    $('[data-who]', root).textContent = rec.nguoiKhai?.hoTen || 'Chưa ghi tên người khai';
    const c = rec.caseId ? casesRepo.get(rec.caseId) : null;
    $('[data-whosub]', root).textContent = [role().ten.split('/')[0].trim(), crime ? `Điều ${crime.dieu}` : null, c?.ten, rec.lan > 1 ? `Lần ${rec.lan}` : null].filter(Boolean).join(' · ');
    $('[data-finish-label]', root).textContent = rec.status === 'hoan-thanh' ? 'Đã kết thúc' : 'Kết thúc';
  }

  /* ----- Kế hoạch bên trái ----- */
  function askedSet() {
    return new Set((rec.qa || []).map((x) => x.planQ).filter(Boolean));
  }
  function renderPlan() {
    const issues = rec.plan?.issues || [];
    const host = $('[data-plan]', root);
    if (!issues.length) {
      host.innerHTML = `<div class="empty" style="padding:24px 12px"><p>Biên bản chưa gắn kế hoạch hỏi.</p><button class="btn btn-sm btn-primary" type="button" data-attach>${icon('layers', 'ic-sm')}Tạo kế hoạch</button></div>`;
      host.querySelector('[data-attach]').addEventListener('click', attachPlanDialog);
      $('[data-progress]', root).innerHTML = '';
      return;
    }
    const asked = askedSet();
    const cov = rec.coverage || {};
    const done = issues.filter((i) => cov[i.id] === 'ro').length;
    const pct = Math.round((done / issues.length) * 100);
    $('[data-progress]', root).innerHTML = `<div class="bar"><span style="width:${pct}%"></span></div><small>${done}/${issues.length} vấn đề đã rõ</small>`;
    host.innerHTML = issues
      .map((is, i) => {
        const st = cov[is.id] || 'chua';
        const askedN = is.cauHoi.filter((c) => asked.has(c.id)).length;
        const isOpen = openIssues.has(is.id) ? openIssues.get(is.id) : current.issueId === is.id || (i === 1 && !current.issueId);
        return `<details class="iv-issue" ${isOpen ? 'open' : ''} data-issue="${is.id}">
          <summary><span class="cov cov-${COV[st][1]}" title="${COV[st][0]}"></span><span class="iv-issue-t">${i + 1}. ${escapeHtml(is.tieuDe)}</span><small>${askedN}/${is.cauHoi.length}</small></summary>
          <ul>${is.cauHoi.map((c) => `<li><button type="button" class="iv-pq ${asked.has(c.id) ? 'asked' : ''} ${c.priority === 'high' ? 'hi' : ''}" data-pq="${c.id}" data-issue-id="${is.id}">${asked.has(c.id) ? icon('check', 'ic-sm') : '<span class="dot"></span>'}<span>${escapeHtml(c.text)}</span></button></li>`).join('')}</ul>
          <div class="iv-cov-set" role="group" aria-label="Đánh dấu mức độ làm rõ">${Object.entries(COV).map(([k, [l]]) => `<button type="button" class="chip" data-cov="${k}" aria-pressed="${st === k}">${l}</button>`).join('')}</div>
        </details>`;
      })
      .join('');
  }

  $('[data-plan]', root).addEventListener(
    'toggle',
    (e) => {
      if (e.target.matches?.('details[data-issue]')) openIssues.set(e.target.dataset.issue, e.target.open);
    },
    true,
  );
  $('[data-plan]', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-pq]');
    if (b) {
      const is = rec.plan.issues.find((x) => x.id === b.dataset.issueId);
      const c = is.cauHoi.find((x) => x.id === b.dataset.pq);
      setQuestion(c.text, is.id, c.id);
      return;
    }
    const cv = e.target.closest('[data-cov]');
    if (cv) {
      const id = cv.closest('[data-issue]').dataset.issue;
      rec.coverage = { ...(rec.coverage || {}), [id]: cv.dataset.cov };
      save();
      current.issueId = id;
      renderPlan();
    }
  });

  function setQuestion(text, issueId = null, planQ = null) {
    cancelEdit();
    current = { q: text, issueId, planQ, editIndex: null };
    qBox.value = text;
    autoGrow(qBox);
    const is = rec.plan?.issues?.find((x) => x.id === issueId);
    $('[data-issue-hint]', root).textContent = is ? `Vấn đề: ${is.tieuDe}` : '';
    aBox.focus();
  }

  /* ----- Hỏi – đáp ----- */
  function renderTranscript() {
    const host = $('[data-transcript]', root);
    const qa = rec.qa || [];
    if (!qa.length) {
      host.innerHTML = `<div class="iv-empty">${icon('message', 'ic-lg')}<h3>Bắt đầu ghi lời khai</h3><p>Trước khi hỏi, thông báo và giải thích quyền, nghĩa vụ cho người khai (mục <strong>Thông tin biên bản</strong>). Chọn câu hỏi trong kế hoạch bên trái, ghi câu trả lời rồi bấm <kbd class="kbd">Ctrl Enter</kbd>.</p>${rec.daThongBaoQuyen ? '' : `<button class="btn btn-sm" type="button" data-rights>${icon('shield', 'ic-sm')}Thông báo quyền và nghĩa vụ</button>`}</div>`;
      host.querySelector('[data-rights]')?.addEventListener('click', rightsDialog);
      return;
    }
    host.innerHTML = qa
      .map((x, i) => {
        const is = rec.plan?.issues?.find((y) => y.id === x.issueId);
        return `<article class="iv-qa" data-i="${i}">
          <div class="iv-qa-n">${i + 1}</div>
          <div class="iv-qa-body">
            <p class="iv-qa-q"><strong>Hỏi:</strong> ${escapeHtml(x.q)}</p>
            <p class="iv-qa-a"><strong>Trả lời:</strong> ${escapeHtml(x.a || '…')}</p>
            <div class="iv-qa-meta">${is ? `<span class="src">${escapeHtml(is.tieuDe)}</span>` : ''}<span>${x.at ? new Date(x.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              <span class="iv-qa-tools">
                <button type="button" class="btn btn-ghost btn-sm btn-icon" data-edit aria-label="Sửa lượt hỏi – đáp ${i + 1}">${icon('wand', 'ic-sm')}</button>
                <button type="button" class="btn btn-ghost btn-sm btn-icon" data-up aria-label="Đưa lên" ${i === 0 ? 'disabled' : ''}>${icon('chevron-down', 'ic-sm rot180')}</button>
                <button type="button" class="btn btn-ghost btn-sm btn-icon" data-del aria-label="Xóa lượt hỏi – đáp ${i + 1}">${icon('trash', 'ic-sm')}</button>
              </span>
            </div>
          </div>
        </article>`;
      })
      .join('');
    host.scrollTop = host.scrollHeight;
  }

  $('[data-transcript]', root).addEventListener('click', async (e) => {
    const art = e.target.closest('[data-i]');
    if (!art) return;
    const i = +art.dataset.i;
    if (e.target.closest('[data-del]')) {
      if (!(await ctx.confirm('Xóa lượt hỏi – đáp này khỏi biên bản?', { title: 'Xóa', okText: 'Xóa', danger: true }))) return;
      rec.qa.splice(i, 1);
      save();
      renderTranscript();
      renderPlan();
    } else if (e.target.closest('[data-up]') && i > 0) {
      [rec.qa[i - 1], rec.qa[i]] = [rec.qa[i], rec.qa[i - 1]];
      save();
      renderTranscript();
    } else if (e.target.closest('[data-edit]')) {
      const x = rec.qa[i];
      current = { q: x.q, issueId: x.issueId, planQ: x.planQ, editIndex: i };
      qBox.value = x.q;
      aBox.value = x.a;
      autoGrow(qBox);
      autoGrow(aBox);
      $('[data-cancel-edit]', root).hidden = false;
      $('[data-submit]', root).innerHTML = `${icon('save', 'ic-sm')}Cập nhật lượt ${i + 1}`;
      aBox.focus();
    }
  });

  function cancelEdit() {
    current.editIndex = null;
    $('[data-cancel-edit]', root).hidden = true;
    $('[data-submit]', root).innerHTML = `${icon('check', 'ic-sm')}Ghi vào biên bản`;
  }
  $('[data-cancel-edit]', root).addEventListener('click', () => {
    cancelEdit();
    qBox.value = '';
    aBox.value = '';
  });

  $('[data-composer]', root).addEventListener('submit', (e) => {
    e.preventDefault();
    const q = qBox.value.trim();
    const a = aBox.value.trim();
    if (!q) {
      qBox.focus();
      toast('Nhập câu hỏi trước khi ghi', { type: 'error' });
      return;
    }
    if (current.editIndex !== null) {
      rec.qa[current.editIndex] = { ...rec.qa[current.editIndex], q, a };
      toast(`Đã cập nhật lượt ${current.editIndex + 1}`);
    } else {
      const planText = rec.plan?.issues?.find((x) => x.id === current.issueId)?.cauHoi.find((c) => c.id === current.planQ)?.text;
      rec.qa = [...(rec.qa || []), { id: uid(), q, a, issueId: current.issueId, planQ: planText === q || planText ? current.planQ : null, at: Date.now() }];
      // Tự động đánh dấu “một phần” cho vấn đề vừa hỏi nếu chưa đánh giá.
      if (current.issueId && !(rec.coverage || {})[current.issueId]) rec.coverage = { ...(rec.coverage || {}), [current.issueId]: 'mot-phan' };
    }
    if (rec.status === 'hoan-thanh') rec.status = 'dang-ghi';
    save();
    cancelEdit();
    qBox.value = '';
    aBox.value = '';
    autoGrow(qBox);
    autoGrow(aBox);
    renderTranscript();
    renderPlan();
    renderHead();
    // Gợi ý câu hỏi tiếp theo trong cùng vấn đề.
    const is = rec.plan?.issues?.find((x) => x.id === current.issueId);
    const asked = askedSet();
    const next = is?.cauHoi.find((c) => !asked.has(c.id));
    if (next) setQuestion(next.text, is.id, next.id);
    else {
      current = { q: '', issueId: null, planQ: null, editIndex: null };
      $('[data-issue-hint]', root).textContent = '';
      qBox.focus();
    }
    if (aiTab === 'suggest' && !ctx.hasAI('legal')) runAnalysis('suggest');
  });

  [qBox, aBox].forEach((el) => {
    el.addEventListener('input', () => autoGrow(el));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        $('[data-composer]', root).requestSubmit();
      }
    });
  });
  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el === aBox ? 260 : 120, el.scrollHeight + 2)}px`;
  }

  $('[data-normalize]', root).addEventListener('click', async (e) => {
    const a = aBox.value.trim();
    if (!a) return toast('Chưa có nội dung trả lời để chuẩn hóa', { type: 'info' });
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      if (ctx.hasAI('legal')) {
        aBox.value = await aiNormalize({ ...ctx.ai('legal'), question: qBox.value, answer: a });
      } else aBox.value = localNormalize(a);
      autoGrow(aBox);
      toast('Đã chuẩn hóa văn phong — hãy đọc lại cho người khai xác nhận');
    } catch (err) {
      toast(err.message, { type: 'error' });
    } finally {
      btn.disabled = false;
    }
  });

  /* ----- Trợ lý phân tích ----- */
  function renderAi() {
    $$('[data-aitab]', root).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aitab === aiTab)));
    const host = $('[data-aibody]', root);
    const label = { suggest: 'Gợi ý câu hỏi truy tiếp', contra: 'Phát hiện mâu thuẫn', cover: 'Đánh giá mức độ làm rõ' }[aiTab];
    const desc = { suggest: 'Đọc câu trả lời gần nhất để đề xuất câu hỏi đào sâu: ai, khi nào, ở đâu, tiền đi đâu, ai biết.', contra: 'Đối chiếu các câu trả lời trong biên bản và với các biên bản khác của cùng hồ sơ.', cover: 'Đánh giá từng vấn đề cần chứng minh đã được làm rõ đến đâu, còn thiếu gì.' }[aiTab];
    const res = aiResults[aiTab];
    let body = '';
    if (res === 'loading') body = `<div class="iv-ai-loading"><span class="typing"><span></span><span></span><span></span></span> Đang phân tích lời khai…</div>`;
    else if (res?.error) body = `<p class="note warn">${icon('alert', 'ic-sm')}<span>${escapeHtml(res.error)}</span></p>`;
    else if (aiTab === 'suggest' && res) body = res.length ? `<ul class="iv-ai-list">${res.map((s, i) => `<li><p>${escapeHtml(s.text)}</p>${s.lyDo ? `<small>${escapeHtml(s.lyDo)}</small>` : ''}<button class="btn btn-sm" type="button" data-use="${i}">${icon('arrow-right', 'ic-sm')}Dùng câu hỏi</button></li>`).join('')}</ul>` : '<p class="muted">Chưa có gợi ý — hãy ghi thêm lời khai.</p>';
    else if (aiTab === 'contra' && res) body = res.length ? `<ul class="iv-ai-list">${res.map((m, i) => `<li class="lvl-${m.mucDo || 'trung-binh'}"><p><strong>${escapeHtml(m.moTa)}</strong></p>${(m.trichDan || []).map((t) => `<blockquote>${escapeHtml(t)}</blockquote>`).join('')}${m.cauHoiLamRo ? `<button class="btn btn-sm" type="button" data-use-contra="${i}">${icon('arrow-right', 'ic-sm')}Hỏi làm rõ</button>` : ''}</li>`).join('')}</ul>` : `<p class="note">${icon('check-circle', 'ic-sm')}<span>Chưa phát hiện mâu thuẫn.</span></p>`;
    else if (aiTab === 'cover' && res) {
      const issues = rec.plan?.issues || [];
      body = `${res.tongQuan ? `<p class="iv-ai-sum">${escapeHtml(res.tongQuan)}</p>` : ''}<ul class="iv-ai-list">${res.danhGia
        .map((d) => {
          const is = issues.find((x) => x.id === d.issueId);
          if (!is) return '';
          const k = COV[d.mucDo] ? d.mucDo : 'chua';
          return `<li><p><span class="cov cov-${COV[k][1]}"></span><strong>${escapeHtml(is.tieuDe)}</strong> — ${COV[k][0]}</p>${d.nhanXet ? `<small>${escapeHtml(d.nhanXet)}</small>` : ''}${d.conThieu ? `<small class="miss">Còn thiếu: ${escapeHtml(d.conThieu)}</small>` : ''}</li>`;
        })
        .join('')}</ul><button class="btn btn-sm" type="button" data-apply-cov>${icon('check', 'ic-sm')}Cập nhật vào kế hoạch</button>`;
    }
    host.innerHTML = `<p class="iv-ai-desc"><strong>${label}.</strong> ${desc}</p>${body}<button class="btn btn-primary btn-sm iv-ai-run" type="button" data-run>${icon(res === 'loading' ? 'stop' : 'sparkles', 'ic-sm')}${res === 'loading' ? 'Dừng' : res ? 'Phân tích lại' : 'Phân tích'}</button>`;
  }

  $$('[data-aitab]', root).forEach((b) =>
    b.addEventListener('click', () => {
      aiTab = b.dataset.aitab;
      renderAi();
    }),
  );

  $('[data-aibody]', root).addEventListener('click', (e) => {
    if (e.target.closest('[data-run]')) {
      if (controller) return controller.abort();
      return runAnalysis(aiTab);
    }
    const u = e.target.closest('[data-use]');
    if (u) {
      const s = aiResults.suggest[+u.dataset.use];
      setQuestion(s.text, s.issueId || current.issueId || null);
      return;
    }
    const uc = e.target.closest('[data-use-contra]');
    if (uc) {
      setQuestion(aiResults.contra[+uc.dataset.useContra].cauHoiLamRo, current.issueId);
      return;
    }
    if (e.target.closest('[data-apply-cov]')) {
      const cov = { ...(rec.coverage || {}) };
      aiResults.cover.danhGia.forEach((d) => COV[d.mucDo] && (cov[d.issueId] = d.mucDo));
      rec.coverage = cov;
      save();
      renderPlan();
      toast('Đã cập nhật mức độ làm rõ vào kế hoạch');
    }
  });

  async function runAnalysis(kind) {
    const others = rec.caseId ? recordsRepo.list((r) => r.caseId === rec.caseId && r.id !== rec.id) : [];
    if (!ctx.hasAI('legal')) {
      aiResults[kind] = kind === 'suggest' ? localSuggest(rec) : kind === 'contra' ? localContradictions(rec, others) : localCoverage(rec);
      renderAi();
      return;
    }
    controller = new AbortController();
    aiResults[kind] = 'loading';
    renderAi();
    try {
      const args = { ...ctx.ai('legal'), rec, crime, signal: controller.signal };
      aiResults[kind] = kind === 'suggest' ? await aiSuggest(args) : kind === 'contra' ? await aiContradictions({ ...args, others }) : await aiCoverage(args);
    } catch (err) {
      aiResults[kind] = { error: err.message };
    } finally {
      controller = null;
      renderAi();
    }
  }

  /* ----- Thông tin biên bản ----- */
  function infoDialog() {
    const nk = rec.nguoiKhai || {};
    const nth = rec.nguoiTienHanh?.length ? rec.nguoiTienHanh : [{ hoTen: '', chucDanh: 'Điều tra viên' }];
    const tg = rec.thamGia || [];
    ctx.modal(
      `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
      <h2 class="modal-title">Thông tin biên bản</h2>
      <form class="iv-info" data-f>
        <fieldset class="fieldset"><legend>Thời gian, địa điểm</legend><div class="grid-2">
          <div class="field"><label for="i-ngay">Ngày</label><input class="input" type="date" id="i-ngay" name="ngay" value="${escapeHtml(rec.ngay)}" /></div>
          <div class="field"><label for="i-lan">Lần ghi</label><input class="input" type="number" min="1" id="i-lan" name="lan" value="${rec.lan || 1}" /></div>
          <div class="field"><label for="i-bd">Giờ bắt đầu</label><input class="input" type="time" id="i-bd" name="gioBatDau" value="${escapeHtml(rec.gioBatDau)}" /></div>
          <div class="field"><label for="i-kt">Giờ kết thúc</label><input class="input" type="time" id="i-kt" name="gioKetThuc" value="${escapeHtml(rec.gioKetThuc)}" /></div>
          <div class="field span-2"><label for="i-dd">Địa điểm</label><input class="input" id="i-dd" name="diaDiem" value="${escapeHtml(rec.diaDiem)}" placeholder="Trụ sở Cơ quan Cảnh sát điều tra…" /></div>
        </div></fieldset>
        <fieldset class="fieldset"><legend>Cơ quan, người tiến hành</legend><div class="grid-2">
          <div class="field"><label for="i-cqct">Cơ quan cấp trên</label><input class="input" id="i-cqct" name="coQuanCapTren" value="${escapeHtml(rec.coQuanCapTren)}" placeholder="CÔNG AN TỈNH…" /></div>
          <div class="field"><label for="i-cq">Cơ quan tiến hành</label><input class="input" id="i-cq" name="coQuan" value="${escapeHtml(rec.coQuan)}" placeholder="CƠ QUAN CẢNH SÁT ĐIỀU TRA" /></div>
          <div class="field"><label for="i-dtv">Người tiến hành (họ tên)</label><input class="input" id="i-dtv" name="nth_hoTen" value="${escapeHtml(nth[0].hoTen)}" /></div>
          <div class="field"><label for="i-cd">Chức danh</label><input class="input" id="i-cd" name="nth_chucDanh" value="${escapeHtml(nth[0].chucDanh)}" /></div>
          <div class="field"><label for="i-ng">Người ghi biên bản</label><input class="input" id="i-ng" name="nguoiGhi" value="${escapeHtml(rec.nguoiGhi)}" /></div>
          <div class="field"><label for="i-vu">Vụ án / vụ việc</label><input class="input" id="i-vu" name="tenVu" value="${escapeHtml(rec.tenVu || '')}" /></div>
          <div class="field span-2"><label for="i-tg">Người tham gia khác (mỗi dòng: Họ tên — Tư cách, vd: Lê Văn A — Người bào chữa)</label><textarea class="textarea" rows="2" id="i-tg" name="thamGia">${escapeHtml(tg.map((x) => `${x.hoTen} — ${x.tuCach}`).join('\n'))}</textarea></div>
        </div></fieldset>
        <fieldset class="fieldset"><legend>Người khai</legend><div class="grid-2">
          <div class="field span-2"><label for="i-role">Tư cách tham gia tố tụng</label><select class="select" id="i-role" name="roleId">${ROLES.map((r) => `<option value="${r.id}" ${r.id === rec.roleId ? 'selected' : ''}>${escapeHtml(r.ten)}</option>`).join('')}</select></div>
          ${PERSON_FIELDS.map(([k, l]) => `<div class="field ${k === 'noiCuTru' ? 'span-2' : ''}"><label for="i-${k}">${l}</label><input class="input" id="i-${k}" name="nk_${k}" value="${escapeHtml(nk[k] || '')}" /></div>`).join('')}
        </div></fieldset>
        <fieldset class="fieldset"><legend>Thủ tục</legend>
          <label class="check"><input type="checkbox" name="daThongBaoQuyen" ${rec.daThongBaoQuyen ? 'checked' : ''}/>Đã thông báo, giải thích quyền và nghĩa vụ</label>
          <label class="check" style="margin-top:8px"><input type="checkbox" name="ghiAmGhiHinh" ${rec.ghiAmGhiHinh ? 'checked' : ''}/>Có ghi âm, ghi hình có âm thanh</label>
          <div class="field" style="margin-top:12px;max-width:200px"><label for="i-sb">Số bản</label><input class="input" type="number" min="1" id="i-sb" name="soBan" value="${rec.soBan || 2}" /></div>
        </fieldset>
        <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit">${icon('save', 'ic-sm')}Lưu thông tin</button></div>
      </form>`,
      {
        className: 'modal-wide',
        label: 'Thông tin biên bản',
        onMount(box, close) {
          box.querySelector('[data-f]').addEventListener('submit', (e) => {
            e.preventDefault();
            const f = new FormData(e.target);
            const g = (k) => String(f.get(k) || '').trim();
            Object.assign(rec, {
              ngay: g('ngay'),
              lan: Math.max(1, parseInt(g('lan'), 10) || 1),
              gioBatDau: g('gioBatDau'),
              gioKetThuc: g('gioKetThuc'),
              diaDiem: g('diaDiem'),
              coQuanCapTren: g('coQuanCapTren'),
              coQuan: g('coQuan'),
              nguoiGhi: g('nguoiGhi'),
              tenVu: g('tenVu'),
              roleId: g('roleId'),
              nguoiTienHanh: [{ hoTen: g('nth_hoTen'), chucDanh: g('nth_chucDanh') || 'Điều tra viên' }],
              thamGia: g('thamGia')
                .split('\n')
                .map((l) => l.split(/\s+[—–-]\s+/))
                .filter((p) => p[0]?.trim())
                .map(([hoTen, tuCach]) => ({ hoTen: hoTen.trim(), tuCach: (tuCach || 'Người tham gia').trim() })),
              nguoiKhai: Object.fromEntries(PERSON_FIELDS.map(([k]) => [k, g(`nk_${k}`)])),
              daThongBaoQuyen: f.get('daThongBaoQuyen') === 'on',
              ghiAmGhiHinh: f.get('ghiAmGhiHinh') === 'on',
              soBan: Math.max(1, parseInt(g('soBan'), 10) || 2),
            });
            rec = recordsRepo.save(rec);
            close();
            renderHead();
            renderTranscript();
            toast('Đã lưu thông tin biên bản');
          });
        },
      },
    );
  }

  function rightsDialog() {
    const r = role();
    ctx.modal(
      `<h2 class="modal-title">Quyền và nghĩa vụ của ${escapeHtml(r.ten.toLowerCase())}</h2>
       <p class="hint">Căn cứ ${escapeHtml(r.quyen)}</p>
       <div class="iv-rights"><p><strong>Quyền:</strong> ${escapeHtml(r.quyenTomTat)}</p><p><strong>Nghĩa vụ:</strong> ${escapeHtml(r.nghiaVu)}</p>${r.canhBao ? `<p class="note warn">${icon('alert', 'ic-sm')}<span>${escapeHtml(r.canhBao)}</span></p>` : ''}</div>
       <div class="modal-actions"><button class="btn" type="button" data-close>Đóng</button><button class="btn btn-primary" type="button" data-ok>${icon('check', 'ic-sm')}Đã thông báo, người khai đã hiểu</button></div>`,
      {
        label: 'Quyền và nghĩa vụ',
        onMount(box, close) {
          box.querySelector('[data-ok]').addEventListener('click', () => {
            rec.daThongBaoQuyen = true;
            save();
            close();
            renderTranscript();
            toast('Đã ghi nhận việc thông báo quyền, nghĩa vụ');
          });
        },
      },
    );
  }

  function attachPlanDialog() {
    ctx.modal(
      `<h2 class="modal-title">Tạo kế hoạch hỏi cho biên bản</h2>
       <form class="auth-form" data-f>
         <div class="field"><label for="ap-dieu">Điều luật (số điều)</label><input class="input" id="ap-dieu" name="dieu" placeholder="VD: 222, 353, 235…" required /></div>
         <p class="hint">Bộ câu hỏi đầy đủ theo tất cả hành vi của điều luật sẽ được tạo. Để chọn hành vi cụ thể, dùng màn hình Cây hỏi đáp pháp luật.</p>
         <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit">Tạo</button></div>
       </form>`,
      {
        label: 'Tạo kế hoạch',
        onMount(box, close) {
          box.querySelector('[data-f]').addEventListener('submit', (e) => {
            e.preventDefault();
            const dieu = new FormData(e.target).get('dieu').trim().replace(/^điều\s*/i, '');
            if (!findCrime(dieu)) return toast(`Chưa có dữ liệu Điều ${dieu}`, { type: 'error' });
            const plan = generatePlan({ dieu, roleId: rec.roleId });
            rec.plan = { dieu, roleId: rec.roleId, hanhViIds: plan.hanhVi.map((h) => h.id), dinhKhung: [], issues: plan.issues };
            rec = recordsRepo.save(rec);
            close();
            ctx.navigate(`#interview/${rec.id}`);
          });
        },
      },
    );
  }

  function previewDialog() {
    ctx.modal(`<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button><div class="preview-modal-body print-area">${renderDocumentHtml(buildRecordDocument(rec))}</div><div class="modal-actions"><button class="btn" type="button" data-close>Đóng</button><button class="btn" type="button" data-copy>${icon('copy', 'ic-sm')}Sao chép</button><button class="btn btn-dark" type="button" data-print>${icon('printer', 'ic-sm')}In / PDF</button></div>`, {
      className: 'modal-preview',
      label: 'Xem biên bản',
      onMount(box) {
        box.querySelector('[data-print]').addEventListener('click', () => window.print());
        box.querySelector('[data-copy]').addEventListener('click', async () => {
          await copyText(box.querySelector('.vb-page').innerText);
          toast('Đã sao chép biên bản');
        });
      },
    });
  }

  function exportDocx() {
    if (!rec.nguoiKhai?.hoTen) {
      toast('Chưa có họ tên người khai — bổ sung trong Thông tin biên bản', { type: 'error' });
      infoDialog();
      return;
    }
    const doc = buildRecordDocument(rec);
    downloadBlob(buildDocx(doc, doc.title.name), safeFileName(`${doc.title.name}-${rec.nguoiKhai.hoTen}-${rec.ngay}`), DOCX_MIME);
    toast('Đã xuất biên bản (.docx)');
  }

  $('[data-info]', root).addEventListener('click', infoDialog);
  $('[data-preview]', root).addEventListener('click', previewDialog);
  $('[data-export]', root).addEventListener('click', exportDocx);
  $('[data-finish]', root).addEventListener('click', async () => {
    if (rec.status === 'hoan-thanh') return previewDialog();
    if (!rec.daThongBaoQuyen && !(await ctx.confirm('Biên bản chưa ghi nhận việc thông báo quyền, nghĩa vụ cho người khai. Vẫn kết thúc?', { title: 'Kết thúc biên bản', okText: 'Vẫn kết thúc' }))) return;
    const now = new Date();
    rec.gioKetThuc = rec.gioKetThuc || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    rec.status = 'hoan-thanh';
    rec = recordsRepo.save(rec);
    renderHead();
    toast(`Đã kết thúc lúc ${rec.gioKetThuc.replace(':', ' giờ ')} phút`);
    previewDialog();
  });

  renderHead();
  renderPlan();
  renderTranscript();
  renderAi();
  if (!rec.nguoiKhai?.hoTen) setTimeout(infoDialog, 60);
  return () => controller?.abort();
}
