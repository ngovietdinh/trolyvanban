// Phân tích lời khai: dán / tải / lấy từ biên bản nhiều lời khai → máy phân tích ngay (không cần bấm, không cần AI):
// sơ đồ quan hệ, dòng tiền, hành vi, tư duy; đối chiếu ai khai gì về ai; danh sách điểm cần làm rõ (mâu thuẫn,
// phủ nhận, chỉ một bên khai, thiếu số tiền / thời gian / chức vụ, người chưa lấy lời khai, trả lời mơ hồ).
// AI chỉ dùng khi cần làm rõ: gửi đúng các câu liên quan tới điểm đó, kết quả đối chiếu nguyên văn.
import { $, $$, icon, toast, escapeHtml, downloadBlob, copyText } from '../ui.js';
import { casesRepo, recordsRepo } from '../legal/repo.js';
import { getRole } from '../legal/roles.js';
import { isFullName, stripTitle, key as nameKey } from '../legal/case-map.js';
import { analyzeStatements, splitByHeading, clarifyPrompt, parseClarify, withExtraEdges, questionsByPerson, CLARIFY_SYSTEM, LEVELS, KINDS } from '../legal/statements.js';
import { lawReasonHtml } from './law-reason.js';
import { diagramFromCaseMap, syncFromCaseMap, PRESETS } from '../legal/diagram.js';
import { findCrime } from '../legal/engine.js';
import { mountDiagram } from './diagram-editor.js';
import { streamClaude } from '../lib/ai.js';
import { isTight, ctxFor } from '../lib/ai-chunk.js';
import { buildDocx, safeFileName } from '../lib/docx.js';
import { store, uid } from '../lib/store.js';
import { makeResizable } from '../lib/resizer.js';
import { extractText } from '../lib/extract.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const SESS = 'statement-sessions';
const TABS = [
  ['quan-he', 'Quan hệ'],
  ['dong-tien', 'Dòng tiền'],
  ['hanh-vi', 'Hành vi'],
  ['tong-hop', 'Tư duy'],
  ['dieu-luat', 'Điều luật'],
  ['doi-chieu', 'Đối chiếu lời khai'],
  ['cau-hoi', 'Câu hỏi làm rõ'],
];
const DIAGRAM_TABS = new Set(['quan-he', 'dong-tien', 'hanh-vi', 'tong-hop']);
const newItem = (o = {}) => ({ id: uid(), speaker: '', role: '', text: '', ...o });
const newSession = () => ({ id: `lk-${uid()}`, title: '', items: [newItem(), newItem()], done: {}, answers: {}, extra: [], at: Date.now() });

/** Chữ cuối (tên) của tên gọi trong lời khai, dạng đã chuẩn hóa. */
const nameVerbatimLast = (t) => nameKey(stripTitle(t)).split(' ').at(-1) || '';

export function render(ctx) {
  const all = () => store.get(SESS, []) || [];
  let s = all().find((x) => x.id === store.get('statement-current', '')) || newSession();
  const st = { tab: 'quan-he', lv: 'all', res: null, map: null, sig: '', busy: new Set() };
  let dgCtl = null;
  let timer = 0;
  const ai = () => (ctx.hasAI('legal') ? ctx.ai('legal') : null);
  const dkey = (preset) => (preset === 'tong-hop' ? s.id : `${s.id}#${preset}`);
  const loadD = (preset) => store.get('diagrams', {})[dkey(preset)] || null;
  const saveD = (d, preset) => store.set('diagrams', { ...store.get('diagrams', {}), [dkey(preset)]: { ...d, preset, at: Date.now(), title: titleOf() } });
  const titleOf = () => s.title || (s.items.filter((x) => x.speaker).length ? `Lời khai ${s.items.filter((x) => x.speaker).map((x) => x.speaker).slice(0, 3).join(', ')}` : 'Phân tích lời khai');
  const filled = () => s.items.filter((x) => String(x.text || '').trim());

  function persist() {
    if (!filled().length && !s.title) return;
    s.at = Date.now();
    store.set(SESS, [s, ...all().filter((x) => x.id !== s.id)].slice(0, 30));
    store.set('statement-current', s.id);
  }

  ctx.view.innerHTML = `
  <div class="page lk">
    <div class="page-head"><div><h1 class="page-title">Phân tích <em>lời khai</em></h1><p class="page-sub">Dán, tải tệp hoặc lấy từ biên bản các lời khai — máy phân tích ngay khi gõ: sơ đồ quan hệ, dòng tiền, hành vi; đối chiếu ai khai gì về ai; chỉ ra điểm mâu thuẫn, còn thiếu. Điểm nào cần làm rõ mới hỏi AI (chỉ gửi đoạn liên quan).</p></div></div>
    <section class="panel lk-in">
      <div class="lk-bar">
        <select class="select" data-lk-case aria-label="Hồ sơ để lấy biên bản"><option value="">Biên bản của tất cả hồ sơ</option>${casesRepo.list().map((c) => `<option value="${c.id}" ${c.id === s.caseId ? 'selected' : ''}>${escapeHtml(c.ten)}</option>`).join('')}</select>
        <button class="btn btn-sm" type="button" data-lk-import>${icon('message', 'ic-sm')}Lấy từ biên bản</button>
        <label class="btn btn-sm" title="Word, PDF, ảnh, .txt — tệp có nhiều lời khai (“Lời khai của …”) tự tách theo người">${icon('upload', 'ic-sm')}Tải tệp<input type="file" hidden multiple accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp" data-lk-file /></label>
        <button class="btn btn-sm btn-ghost" type="button" data-lk-add>${icon('plus', 'ic-sm')}Thêm lời khai</button>
        <span class="spacer"></span>
        <button class="btn btn-sm btn-ghost" type="button" data-lk-new title="Bắt đầu phân tích mới (phiên hiện tại vẫn được lưu)">${icon('file', 'ic-sm')}Phiên mới</button>
      </div>
      <div class="lk-stmts" data-lk-stmts></div>
      <div class="lk-names" data-lk-names></div>
      <p class="hint lk-status" data-lk-status aria-live="polite"></p>
      <div data-lk-sessions></div>
    </section>
    <section class="lk-out" data-lk-out hidden>
      <aside class="panel lk-issues" data-lk-issues></aside>
      <div class="lk-split" data-lk-split title="Kéo để đổi độ rộng khung Cần làm rõ · bấm đúp: mặc định" aria-label="Kéo để đổi độ rộng khung Cần làm rõ"></div>
      <div class="panel lk-main">
        <div class="lk-main-head"><input class="input lk-title" data-lk-title aria-label="Tên phiên phân tích" placeholder="Tên vụ việc / phiên phân tích" /><span class="spacer"></span><button class="btn btn-sm btn-ghost" type="button" data-lk-open-map title="Mở kết quả trong Sơ đồ vụ việc (bản chất, dòng thời gian, xuất Word, AI làm tiếp)">${icon('chart', 'ic-sm')}Mở trong Sơ đồ vụ việc</button><button class="btn btn-sm" type="button" data-lk-word>${icon('download', 'ic-sm')}Xuất Word</button></div>
        <div class="tabs lk-tabs" role="tablist" data-lk-tabs></div>
        <div class="lk-body" data-lk-body></div>
      </div>
    </section>
  </div>`;
  const v = ctx.view;

  /* ---------- Nhập lời khai ---------- */
  function drawItems() {
    $('[data-lk-stmts]', v).innerHTML = s.items
      .map(
        (x, i) => `<div class="lk-stmt" data-stmt="${x.id}">
        <div class="lk-stmt-head"><span class="lk-no">${i + 1}</span><input class="input" data-lk-name value="${escapeHtml(x.speaker)}" placeholder="Người khai (họ tên)" aria-label="Người khai ${i + 1}" /><input class="input" data-lk-role value="${escapeHtml(x.role || '')}" placeholder="Tư cách (bị can, người làm chứng…)" aria-label="Tư cách người khai ${i + 1}" /><button type="button" class="btn btn-ghost btn-sm btn-icon" data-lk-del aria-label="Bỏ lời khai ${i + 1}">${icon('x', 'ic-sm')}</button></div>
        <textarea class="textarea" data-lk-text rows="4" placeholder="Dán nội dung lời khai (xưng “tôi”)… Dán cả biên bản có nhiều người (“Lời khai của …”) sẽ tự tách." aria-label="Nội dung lời khai ${i + 1}">${escapeHtml(x.text)}</textarea>
        ${x.src ? `<small class="hint">${escapeHtml(x.src)}</small>` : ''}
      </div>`,
      )
      .join('');
    const nm = $('[data-lk-names]', v);
    if (nm) nm.innerHTML = (s.names || []).length ? `<span class="hint">Họ tên đã xác nhận:</span>${s.names.map((n, i) => `<span class="chip">${escapeHtml(n)} <button type="button" class="btn btn-ghost btn-sm btn-icon" data-lk-unname="${i}" aria-label="Bỏ xác nhận ${escapeHtml(n)}">${icon('x', 'ic-sm')}</button></span>`).join('')}` : '';
  }
  function drawSessions() {
    const list = all().filter((x) => x.id !== s.id);
    const host = $('[data-lk-sessions]', v);
    if (!list.length) return (host.innerHTML = '');
    const when = (t) => new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    host.innerHTML = `<details class="cm-saved-box"><summary>${icon('save', 'ic-sm')}Phiên phân tích đã lưu (${list.length})</summary><ul class="cm-saved-list">${list.map((x) => `<li data-sess="${x.id}"><span><strong>${escapeHtml(x.title || x.items.map((y) => y.speaker).filter(Boolean).join(', ') || 'Chưa đặt tên')}</strong><small>${when(x.at)} · ${x.items.filter((y) => y.text).length} lời khai</small></span><button type="button" class="btn btn-sm" data-sess-open>Mở</button><button type="button" class="btn btn-ghost btn-sm btn-icon" data-sess-del aria-label="Xóa phiên">${icon('trash', 'ic-sm')}</button></li>`).join('')}</ul></details>`;
  }

  /** Thêm các lời khai mới: điền vào ô trống trước, thừa thì thêm ô. */
  function addItems(list) {
    for (const it of list) {
      const empty = s.items.find((x) => !x.text.trim() && !x.speaker.trim());
      if (empty) Object.assign(empty, it);
      else s.items.push(newItem(it));
    }
    drawItems();
    analyze(true);
  }

  /* ---------- Phân tích (trên máy, tức thì) ---------- */
  function analyze(now = false) {
    clearTimeout(timer);
    if (!now) return void (timer = setTimeout(() => analyze(true), 350));
    const items = filled();
    const out = $('[data-lk-out]', v);
    const say = $('[data-lk-status]', v);
    if (!items.length) {
      out.hidden = true;
      say.textContent = 'Nhập ít nhất một lời khai — máy phân tích ngay khi gõ.';
      return;
    }
    const known = [];
    const c = s.caseId && casesRepo.get(s.caseId);
    if (c) (c.persons || []).forEach((p) => known.push({ ten: p.hoTen, vaiTro: getRole(p.roleId).ten.split('/')[0].trim() }));
    st.res = analyzeStatements(items.map((x) => ({ speaker: x.speaker, role: x.role, text: x.text, label: x.speaker ? `Lời khai của ${x.speaker}` : '' })), { known, primary: c?.toiDanh?.[0] || null, confirmed: s.names || [] });
    st.map = withExtraEdges(st.res.map, s.extra || []);
    const open = st.res.issues.filter((x) => !s.done[x.id]);
    const cao = open.filter((x) => x.level === 'cao').length;
    say.textContent = `Máy đã phân tích ${items.length} lời khai trong ${Math.max(1, st.res.ms).toLocaleString('vi-VN')} ms: ${st.map.people.length} người, ${st.map.edges.length} quan hệ, ${open.length} điểm cần làm rõ${cao ? ` (${cao} cần làm rõ ngay)` : ''} — tự cập nhật khi sửa.`;
    out.hidden = false;
    persist();
    drawIssues();
    const sig = JSON.stringify([st.map.people.map((p) => [p.ten, p.vaiTro]), st.map.edges.map((e) => [e.tu, e.den, e.loai, e.soTien]), st.map.crimes.map((c2) => [c2.dieu, c2.items.length])]);
    if (sig !== st.sig || !$('[data-lk-tabs]', v).innerHTML) {
      st.sig = sig;
      syncDiagrams();
      drawMain();
    } else if (!DIAGRAM_TABS.has(st.tab)) drawMain();
  }

  /** Các sơ đồ đã lưu cập nhật theo phân tích mới, giữ phần đã sửa / tự thêm. */
  function syncDiagrams() {
    for (const p of ['quan-he', 'dong-tien', 'hanh-vi', 'tong-hop']) {
      const d = loadD(p);
      if (d) saveD(syncFromCaseMap({ preset: p, ...d }, st.map, { title: titleOf() }), p);
    }
  }

  /* ---------- Điểm cần làm rõ ---------- */
  function issueHtml(x) {
    const a = s.answers[x.id];
    const busy = st.busy.has(x.id);
    const done = !!s.done[x.id];
    return `<li class="lk-issue lv-${x.level}${done ? ' done' : ''}" data-issue="${escapeHtml(x.id)}">
      <div class="lk-i-tags"><span class="lk-lv">${LEVELS[x.level]}</span><span class="lk-kind">${KINDS[x.kind]}</span></div>
      <strong class="lk-i-title">${escapeHtml(x.title)}</strong>
      <p class="lk-i-detail">${escapeHtml(x.detail)}</p>
      ${x.excerpts.length ? `<details class="lk-ex"><summary>Trích lời khai (${x.excerpts.length})</summary><ul>${x.excerpts.map((e) => `<li><b>${escapeHtml(e.speaker)}:</b> “${escapeHtml(e.t)}”</li>`).join('')}</ul></details>` : ''}
      ${
        a
          ? `<div class="lk-ai-ans" data-lk-ans><div class="lk-ai-h">${icon('sparkles', 'ic-sm')}AI làm rõ</div>${a.nhanDinh ? `<p>${escapeHtml(a.nhanDinh)}</p>` : ''}${a.cauHoi.length ? `<b>Câu hỏi</b><ol>${a.cauHoi.map((q) => `<li>${q.ai ? `<em>Hỏi ${escapeHtml(q.ai)}:</em> ` : ''}${escapeHtml(q.hoi)}</li>`).join('')}</ol>` : ''}${a.xacMinh.length ? `<b>Xác minh</b><ul>${a.xacMinh.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ul>` : ''}${a.quanHe.length ? `<p class="hint">Đã bổ sung lên sơ đồ ${a.quanHe.length} quan hệ có nguyên văn trong lời khai.</p>` : ''}</div>`
          : `<div class="lk-ask"><b>Câu hỏi gợi ý</b><ol>${x.ask.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ol></div>`
      }
      ${x.kind === 'chua-ro-ten' ? `<div class="lk-confirm"><input class="input" data-lk-fullname placeholder="Họ tên đầy đủ của “${escapeHtml(x.rawName)}”" aria-label="Họ tên đầy đủ của ${escapeHtml(x.rawName)}" /><button type="button" class="btn btn-sm" data-lk-confirm>${icon('check', 'ic-sm')}Xác nhận tên</button></div><small class="hint">Chỉ xác nhận khi chắc chắn đúng 100% (theo lời khai, giấy tờ). Tên được xác nhận mới vào sơ đồ.</small>` : ''}
      <div class="lk-i-act">
        ${ai() && x.kind !== 'chua-ro-ten' ? `<button type="button" class="btn btn-sm" data-lk-ai ${busy ? 'disabled' : ''}>${icon('sparkles', 'ic-sm')}${busy ? 'AI đang làm rõ…' : a ? 'Hỏi AI lại' : 'Hỏi AI làm rõ'}</button>` : ''}
        ${x.people.length ? `<button type="button" class="btn btn-sm btn-ghost" data-lk-show>${icon('eye', 'ic-sm')}Xem trên sơ đồ</button>` : ''}
        <button type="button" class="btn btn-sm btn-ghost" data-lk-done aria-pressed="${done}">${icon('check', 'ic-sm')}${done ? 'Đã rõ' : 'Đánh dấu đã rõ'}</button>
      </div>
    </li>`;
  }
  function drawIssues() {
    const host = $('[data-lk-issues]', v);
    const list = st.res.issues;
    const open = list.filter((x) => !s.done[x.id]);
    const shown = [...open, ...list.filter((x) => s.done[x.id])].filter((x) => st.lv === 'all' || x.level === st.lv);
    const cnt = (lv) => open.filter((x) => x.level === lv).length;
    const pend = open.filter((x) => x.level !== 'thap' && !s.answers[x.id]).length;
    const keepOpen = new Set($$('.lk-ex[open]', host).map((d) => d.closest('[data-issue]')?.dataset.issue));
    host.innerHTML = `<div class="lk-is-head"><h2>${icon('alert', 'ic-sm')}Cần làm rõ <span class="badge">${open.length}</span></h2>
      ${ai() ? `<button type="button" class="btn btn-sm btn-primary" data-lk-ai-all ${pend && !st.busy.size ? '' : 'disabled'} title="Gửi một lần các điểm quan trọng chưa hỏi — chỉ kèm câu lời khai liên quan">${icon('sparkles', 'ic-sm')}AI làm rõ ${pend ? `${Math.min(pend, isTight(ai()) ? 3 : 6)} điểm quan trọng` : 'các điểm quan trọng'}</button>` : `<small class="hint">Kết nối AI trong Cài đặt để AI làm rõ từng điểm (chỉ gửi đoạn liên quan). Không có AI vẫn dùng được câu hỏi gợi ý.</small>`}</div>
      <div class="lk-lvs" role="group" aria-label="Lọc theo mức">${[['all', `Tất cả (${list.length})`], ['cao', `Ngay (${cnt('cao')})`], ['vua', `Nên (${cnt('vua')})`], ['thap', `Bổ sung (${cnt('thap')})`]].map(([k, l]) => `<button type="button" class="chip" data-lk-lv="${k}" aria-pressed="${st.lv === k}">${l}</button>`).join('')}</div>
      ${shown.length ? `<ul class="lk-issue-list">${shown.map(issueHtml).join('')}</ul>` : `<p class="muted">${list.length ? 'Không có điểm nào ở mức này.' : 'Chưa phát hiện mâu thuẫn hay điểm còn thiếu giữa các lời khai.'}</p>`}`;
    keepOpen.forEach((id) => id && $(`[data-issue="${CSS.escape(id)}"] .lk-ex`, host)?.setAttribute('open', ''));
  }

  /* ---------- Sơ đồ, đối chiếu, câu hỏi ---------- */
  function drawMain() {
    dgCtl?.destroy();
    dgCtl = null;
    const m = st.map;
    const money = m.edges.filter((e) => e.loai === 'tien').length;
    const count = { 'dieu-luat': m.crimes.filter((c) => c.dieu).length, 'quan-he': m.edges.length, 'dong-tien': money, 'doi-chieu': st.res.speakers.length, 'cau-hoi': questionsByPerson(st.res.issues, s.answers, s.done).reduce((n, g) => n + g.list.length, 0) };
    $('[data-lk-title]', v).value = s.title || '';
    $('[data-lk-title]', v).placeholder = titleOf();
    $('[data-lk-tabs]', v).innerHTML = TABS.map(([k, l]) => `<button class="tab" role="tab" data-lk-tab="${k}" aria-selected="${st.tab === k}">${l}${count[k] != null ? ` (${count[k]})` : ''}</button>`).join('');
    const body = $('[data-lk-body]', v);
    if (DIAGRAM_TABS.has(st.tab)) {
      const preset = st.tab;
      let d = loadD(preset);
      if (!d) {
        d = diagramFromCaseMap(m, { title: titleOf(), preset });
        saveD(d, preset);
      }
      body.innerHTML = `${(m.unclear || []).length ? `<p class="hint cm-dg-unclear">${icon('alert', 'ic-sm')}${m.unclear.length} tên chưa rõ nên chưa đưa vào sơ đồ: ${m.unclear.map((u) => `“${escapeHtml(u.ten)}”`).join(', ')} — làm rõ ở mục “Cần làm rõ”.</p>` : ''}<div data-lk-dg></div>`;
      dgCtl = mountDiagram($('[data-lk-dg]', body), {
        diagram: d,
        title: `${PRESETS[preset].label} — ${titleOf()}`,
        map: m,
        onChange: (x) => saveD(x, preset),
        onRebuild: () => syncFromCaseMap(dgCtl.get(), st.map, { title: titleOf() }),
        crimeOf: findCrime,
      });
      if (st.hl) dgCtl.highlight(st.hl);
      return;
    }
    if (st.tab === 'dieu-luat') {
      body.innerHTML = m.crimes.length
        ? `<p class="hint">Điều luật chỉ được nêu khi lời khai đủ yếu tố cấu thành bắt buộc của điều đó (cùng một đoạn). Mở “Căn cứ” để xem từng yếu tố: đã có (kèm câu trích) hoặc còn thiếu (kèm câu cần hỏi).</p><ul class="cm-law">${m.crimes.map((c) => lawReasonHtml(c, { open: true })).join('')}</ul>`
        : '<p class="muted">Chưa có điều luật nào đủ yếu tố cấu thành trong lời khai — hành vi chưa được gán điều luật nào. Bổ sung lời khai (hành vi, chủ thể, số tiền, mục đích) rồi xem lại.</p>';
      return;
    }
    if (st.tab === 'doi-chieu') {
      body.innerHTML = st.res.speakers.length
        ? `<p class="hint">Mỗi người khai: khai có bao nhiêu việc (đưa / nhận tiền, chỉ đạo…), phủ nhận gì, bao nhiêu câu mơ hồ, nhắc tới ai.</p><div class="lk-speakers">${st.res.speakers
            .map(
              (p) => `<article class="lk-sp"><h3>${icon('user', 'ic-sm')}${escapeHtml(p.ten)}${p.ro ? '' : ' <span class="lk-sp-unclear">chưa rõ họ tên</span>'}</h3><div class="lk-sp-kpi"><span><b>${p.khai}</b>khai có</span><span class="${p.phuNhan ? 'neg' : ''}"><b>${p.phuNhan}</b>phủ nhận</span><span class="${p.moHo ? 'warn' : ''}"><b>${p.moHo}</b>mơ hồ</span></div>${p.nhacToi.length ? `<p class="lk-sp-ppl">Nhắc tới: ${p.nhacToi.map((x) => `<span class="chip">${escapeHtml(x.ten)} · ${x.n}</span>`).join(' ')}</p>` : ''}<ul class="lk-claims">${p.claims
                .slice(0, 12)
                .map((c) => `<li class="${c.deny ? 'deny' : 'ok'}"><span class="lk-cl-ic" aria-label="${c.deny ? 'Phủ nhận' : 'Khai có'}">${c.deny ? '✗' : '✓'}</span>${escapeHtml(c.t.length > 200 ? `${c.t.slice(0, 198)}…` : c.t)}</li>`)
                .join('')}</ul></article>`,
            )
            .join('')}</div>`
        : '<p class="muted">Ghi tên người khai ở từng lời khai để đối chiếu ai khai gì về ai.</p>';
      return;
    }
    const groups = questionsByPerson(st.res.issues, s.answers, s.done);
    body.innerHTML = groups.length
      ? `<div class="lk-q-head"><p class="hint">Câu hỏi để lấy lời khai bổ sung / đối chất, gom theo người được hỏi (câu của AI thay câu gợi ý của máy khi đã hỏi AI). Điểm đánh dấu “đã rõ” được bỏ ra.</p><button type="button" class="btn btn-sm" data-lk-copy>${icon('copy', 'ic-sm')}Sao chép</button></div>${groups.map((g) => `<section class="lk-q"><h3>${icon('user', 'ic-sm')}${escapeHtml(g.ai)}</h3><ol>${g.list.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ol></section>`).join('')}`
      : '<p class="muted">Không còn câu hỏi cần làm rõ.</p>';
  }

  /* ---------- AI làm rõ ---------- */
  async function clarify(issues) {
    const a = ai();
    if (!a || !issues.length) return;
    issues.forEach((x) => st.busy.add(x.id));
    drawIssues();
    const stmts = filled().map((x) => ({ speaker: x.speaker, text: x.text }));
    const source = stmts.map((x) => x.text).join('\n');
    try {
      const out = await streamClaude({ provider: a.provider, apiKey: a.apiKey, model: a.model, system: CLARIFY_SYSTEM, effort: 'medium', cache: true, maxTokens: issues.length > 1 ? 2800 : 1200, messages: [{ role: 'user', content: clarifyPrompt(issues, stmts, { max: ctxFor(a, 3500 * Math.min(issues.length, 3), 2400), primary: casesRepo.get(s.caseId || '')?.toiDanh?.[0] || null }) }] });
      const { answers, dropped } = parseClarify(out, issues, source, st.map.people.map((p) => p.ten));
      Object.assign(s.answers, answers);
      const extra = Object.values(answers).flatMap((x) => x.quanHe);
      if (extra.length) s.extra = [...(s.extra || []), ...extra];
      const n = Object.keys(answers).length;
      toast(n ? `AI đã làm rõ ${n} điểm${extra.length ? `, bổ sung ${extra.length} quan hệ lên sơ đồ` : ''}` : 'AI chưa trả lời được điểm nào', { type: n ? 'success' : 'info' });
      if (dropped) toast(`Đã bỏ ${dropped} quan hệ AI nêu nhưng không có nguyên văn (họ tên, trích dẫn) trong lời khai.`, { type: 'info', timeout: 6000 });
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 6000 });
    }
    issues.forEach((x) => st.busy.delete(x.id));
    st.sig = '';
    analyze(true);
  }

  /* ---------- Xuất Word ---------- */
  function exportWord() {
    const org = ctx.settings().legalOrg || {};
    const up = (t) => String(t || '').toLocaleUpperCase('vi-VN');
    const p = (text, o = {}) => ({ runs: [{ text, ...o.r }], align: 'justify', indent: !o.noIndent });
    const head = (t) => ({ runs: [{ text: t, bold: true }], align: 'left', spaceBefore: true });
    const body = [];
    const open = st.res.issues.filter((x) => !s.done[x.id]);
    body.push(p(`Phân tích ${filled().length} lời khai: ${filled().map((x) => x.speaker || 'Chưa ghi tên').join(', ')}.`));
    body.push(head('I. ĐIỂM CẦN LÀM RÕ'));
    body.push(open.length ? { table: { widths: [0.14, 0.16, 0.36, 0.34], header: ['Mức', 'Loại', 'Nội dung', 'Căn cứ (trích lời khai)'], rows: open.map((x) => [LEVELS[x.level], KINDS[x.kind], `${x.title}. ${s.answers[x.id]?.nhanDinh || x.detail}`, x.excerpts.map((e) => `${e.speaker}: “${e.t}”`).join('\n')]) } } : p('Chưa phát hiện điểm cần làm rõ.'));
    body.push(head('II. CÂU HỎI LÀM RÕ THEO NGƯỜI ĐƯỢC HỎI'));
    questionsByPerson(st.res.issues, s.answers, s.done).forEach((g) => {
      body.push({ runs: [{ text: g.ai, bold: true, italic: true }], align: 'left' });
      g.list.forEach((q, i) => body.push(p(`${i + 1}. ${q}`)));
    });
    body.push(head('III. QUAN HỆ, DÒNG TIỀN THEO LỜI KHAI'));
    body.push(st.map.edges.length ? { table: { widths: [0.2, 0.2, 0.16, 0.16, 0.28], header: ['Từ', 'Đến', 'Nội dung', 'Số tiền (nguyên văn)', 'Căn cứ'], rows: st.map.edges.map((e) => [e.tu, e.den, e.noiDung || '', e.soTien || '', e.trich || e.src || '']) } } : p('Chưa xác định được quan hệ.'));
    if ((st.map.unclear || []).length) {
      body.push(head('III-b. TÊN CHƯA RÕ (KHÔNG ĐƯA VÀO SƠ ĐỒ)'));
      body.push({ table: { widths: [0.2, 0.4, 0.4], header: ['Tên gọi', 'Lý do chưa rõ', 'Nguyên văn lời khai'], rows: st.map.unclear.map((u) => [u.ten, u.lyDo || '', (u.cau || []).slice(0, 2).join(' | ')]) } });
    }
    body.push(head('IV. ĐỐI CHIẾU LỜI KHAI'));
    body.push(st.res.speakers.length ? { table: { widths: [0.26, 0.12, 0.12, 0.12, 0.38], header: ['Người khai', 'Khai có', 'Phủ nhận', 'Mơ hồ', 'Nhắc tới'], rows: st.res.speakers.map((x) => [x.ten, String(x.khai), String(x.phuNhan), String(x.moHo), x.nhacToi.map((y) => y.ten).join(', ')]) } } : p('Chưa ghi tên người khai.'));
    body.push(p('Phân tích bằng máy (AI chỉ dùng ở các điểm đã hỏi) — để tham khảo, cần đối chiếu với biên bản, chứng cứ.', { r: { italic: true } }));
    const doc = { typeId: 'phan-tich-loi-khai', header: { parent: up(org.coQuanCapTren), org: up(org.coQuan), number: '', subject: null, placeDate: '' }, title: { name: 'PHÂN TÍCH LỜI KHAI', subject: titleOf() }, authority: null, recipients: null, body, sign: null, dualSign: null, signers: [{ title: 'NGƯỜI LẬP', hint: '(Ký, ghi rõ họ tên)', name: org.dieuTraVien || '' }] };
    downloadBlob(buildDocx(doc, 'Phân tích lời khai'), safeFileName(`phan-tich-loi-khai-${titleOf()}`), DOCX_MIME);
    toast('Đã xuất phân tích lời khai (.docx)');
  }

  /** Mở trong Sơ đồ vụ việc: lưu như một kết quả phân tích (dùng chung các sơ đồ đã sửa). */
  function openInMap() {
    const saves = store.get('case-map-saves', []) || [];
    const sources = filled().map((x) => ({ label: x.speaker ? `Lời khai của ${x.speaker}` : 'Lời khai', speaker: x.speaker, text: String(x.text).slice(0, 40000) }));
    const item = { id: s.id, title: titleOf(), map: st.map, sources, known: [], primary: null, at: Date.now(), manual: true };
    store.set('case-map-saves', [item, ...saves.filter((x) => x.id !== s.id)].slice(0, 40));
    ctx.navigate(`#so-do/saved-${s.id}`);
  }

  /* ---------- Sự kiện ---------- */
  v.addEventListener('input', (e) => {
    const box = e.target.closest('[data-stmt]');
    if (e.target.matches('[data-lk-title]')) {
      s.title = e.target.value.trim();
      return persist();
    }
    if (!box) return;
    const it = s.items.find((x) => x.id === box.dataset.stmt);
    if (e.target.matches('[data-lk-name]')) it.speaker = e.target.value.trim();
    if (e.target.matches('[data-lk-role]')) it.role = e.target.value.trim();
    if (e.target.matches('[data-lk-text]')) it.text = e.target.value;
    analyze();
  });
  // Dán biên bản có nhiều người khai → tự tách theo người.
  v.addEventListener('paste', (e) => {
    const ta = e.target.closest('[data-lk-text]');
    if (!ta || ta.value.trim()) return;
    const parts = splitByHeading(e.clipboardData?.getData('text') || '');
    if (parts.length < 2) return;
    e.preventDefault();
    const it = s.items.find((x) => x.id === ta.closest('[data-stmt]').dataset.stmt);
    Object.assign(it, parts[0]);
    addItems(parts.slice(1));
    toast(`Đã tách ${parts.length} lời khai theo người khai`);
  });
  v.addEventListener('change', async (e) => {
    if (e.target.matches('[data-lk-case]')) {
      s.caseId = e.target.value;
      return analyze(true);
    }
    if (e.target.matches('[data-lk-file]')) {
      const files = [...e.target.files];
      e.target.value = '';
      const say = $('[data-lk-status]', v);
      const got = [];
      for (const f of files) {
        try {
          say.textContent = `Đang đọc “${f.name}”…`;
          const r = await extractText(f, { onProgress: (p) => (say.textContent = `Nhận dạng chữ “${f.name}” — trang ${p.page}/${p.total}`) });
          const parts = splitByHeading(r.text);
          if (parts.length >= 2) parts.forEach((x) => got.push({ ...x, src: f.name }));
          else got.push({ speaker: '', text: r.text, src: f.name });
        } catch (err) {
          toast(`“${f.name}”: ${err.message}`, { type: 'error', timeout: 5000 });
        }
      }
      if (got.length) {
        addItems(got);
        toast(`Đã thêm ${got.length} lời khai từ tệp${got.some((x) => !x.speaker) ? ' — ghi tên người khai để đối chiếu' : ''}`);
      }
    }
  });
  v.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-lk-add]')) {
      s.items.push(newItem());
      drawItems();
      return $$('[data-lk-name]', v).at(-1)?.focus();
    }
    if (t.closest('[data-lk-del]')) {
      const id = t.closest('[data-stmt]').dataset.stmt;
      s.items = s.items.filter((x) => x.id !== id);
      if (!s.items.length) s.items.push(newItem());
      drawItems();
      return analyze(true);
    }
    if (t.closest('[data-lk-import]')) {
      const recs = recordsRepo.list((r) => (!s.caseId || r.caseId === s.caseId) && (r.qa || []).some((x) => String(x.a || '').trim()));
      if (!recs.length) return toast('Chưa có biên bản lời khai có nội dung trả lời', { type: 'error' });
      const have = new Set(s.items.map((x) => x.recId).filter(Boolean));
      const add = recs.filter((r) => !have.has(r.id)).map((r) => ({ recId: r.id, speaker: r.nguoiKhai?.hoTen || '', role: getRole(r.roleId).ten.split('/')[0].trim(), text: (r.qa || []).filter((x) => String(x.a || '').trim()).map((x) => x.a).join('\n'), src: `Biên bản lần ${r.lan || 1}${r.ngay ? ` ngày ${String(r.ngay).split('-').reverse().join('/')}` : ''}` }));
      if (!add.length) return toast('Các biên bản đã có trong phân tích');
      addItems(add);
      return toast(`Đã lấy ${add.length} biên bản lời khai`);
    }
    if (t.closest('[data-lk-new]')) {
      persist();
      s = newSession();
      Object.assign(st, { sig: '', hl: null, tab: 'quan-he' });
      drawItems();
      drawSessions();
      return analyze(true);
    }
    const se = t.closest('[data-sess]');
    if (se && t.closest('[data-sess-open]')) {
      persist();
      s = all().find((x) => x.id === se.dataset.sess) || s;
      Object.assign(st, { sig: '', hl: null });
      store.set('statement-current', s.id);
      drawItems();
      drawSessions();
      return analyze(true);
    }
    if (se && t.closest('[data-sess-del]')) {
      store.set(SESS, all().filter((x) => x.id !== se.dataset.sess));
      return drawSessions();
    }
    const tab = t.closest('[data-lk-tab]');
    if (tab) {
      st.tab = tab.dataset.lkTab;
      return drawMain();
    }
    const lv = t.closest('[data-lk-lv]');
    if (lv) {
      st.lv = lv.dataset.lkLv;
      return drawIssues();
    }
    if (t.closest('[data-lk-ai-all]')) {
      const pend = st.res.issues.filter((x) => !s.done[x.id] && x.level !== 'thap' && !s.answers[x.id]);
      return clarify(pend.slice(0, isTight(ai()) ? 3 : 6));
    }
    const card = t.closest('[data-issue]');
    const issue = card && st.res.issues.find((x) => x.id === card.dataset.issue);
    if (issue && t.closest('[data-lk-ai]')) return clarify([issue]);
    if (issue && t.closest('[data-lk-done]')) {
      if (s.done[issue.id]) delete s.done[issue.id];
      else s.done[issue.id] = Date.now();
      persist();
      drawIssues();
      if (st.tab === 'cau-hoi') drawMain();
      return;
    }
    if (issue && t.closest('[data-lk-show]')) {
      st.hl = issue.people;
      if (!DIAGRAM_TABS.has(st.tab) || (['lech-tien', 'thieu-tien', 'thieu-ngay'].includes(issue.kind) && st.tab !== 'dong-tien')) st.tab = ['lech-tien', 'thieu-tien', 'thieu-ngay'].includes(issue.kind) ? 'dong-tien' : 'quan-he';
      drawMain();
      $('[data-lk-body]', v).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    if (t.closest('[data-lk-copy]')) {
      const txt = questionsByPerson(st.res.issues, s.answers, s.done).map((g) => `${g.ai}:\n${g.list.map((q, i) => `${i + 1}. ${q}`).join('\n')}`).join('\n\n');
      return copyText(txt).then(() => toast('Đã sao chép câu hỏi làm rõ'));
    }
    if (t.closest('[data-lk-unname]')) {
      s.names = (s.names || []).filter((_, i) => i !== Number(t.closest('[data-lk-unname]').dataset.lkUnname));
      drawItems();
      return analyze(true);
    }
    if (issue && t.closest('[data-lk-confirm]')) {
      const raw = $('[data-lk-fullname]', card).value.trim();
      const full = stripTitle(raw).replace(/\s+/g, ' ');
      if (!isFullName(full)) return toast('Cần nhập họ tên đầy đủ (ít nhất họ và tên)', { type: 'error' });
      // Họ tên xác nhận phải chứa đúng tên gọi trong lời khai (“Bình” → “… Bình”), tránh gán nhầm người.
      const last = nameVerbatimLast(issue.rawName);
      if (last && !nameKey(full).endsWith(last)) return toast(`Họ tên phải kết thúc bằng “${last}” như trong lời khai`, { type: 'error' });
      s.names = [...new Set([...(s.names || []), full])];
      drawItems();
      toast(`Đã xác nhận “${full}” — đưa vào sơ đồ`);
      return analyze(true);
    }
    if (t.closest('[data-lk-word]')) return exportWord();
    if (t.closest('[data-lk-open-map]')) return openInMap();
  });

  // Kéo thanh giữa để đổi độ rộng khung “Cần làm rõ” (nhớ trên máy).
  const out = $('[data-lk-out]', v);
  const split = makeResizable($('[data-lk-split]', v), { axis: 'x', min: 260, max: () => Math.max(300, out.clientWidth - 360), key: 'tlvb:lk-w', current: () => $('[data-lk-issues]', v).getBoundingClientRect().width, apply: (w) => out.style.setProperty('--lk-w', w == null ? '' : `${w}px`) });
  drawItems();
  drawSessions();
  analyze(true);
  return () => {
    split.destroy();
    clearTimeout(timer);
    persist();
    dgCtl?.destroy();
  };
}
