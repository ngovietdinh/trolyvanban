// Phân tích vụ việc theo 4 bước (không cần chọn trước điều luật):
// ① Nhập hành vi (thủ công, tải Word / PDF / ảnh) → ② Hệ thống đề xuất điều luật, người dùng chọn (một hoặc nhiều
// điều, chọn điều chính) → ③ Duyệt hành vi theo từng điều (chọn, sửa, thêm) → ④ Kế hoạch câu hỏi và sơ đồ cây
// (màn hình kế hoạch của cây hỏi đáp, có thanh bước để quay lại).
import { $, $$, icon, toast, escapeHtml } from '../ui.js';
import { findCrime, crimeWithCustomActs, searchCrimes } from '../legal/engine.js';
import { analyzeActs, analyzeOffline, mergeResults } from '../legal/analyze.js';
import { store } from '../lib/store.js';
import { aiModeHtml, bindMethod, readMethod, runMethod, METHOD_LABEL } from './legal-analyze.js';
import { dropzoneHtml, bindDropzone, readAll, toRows, newRow, rowHtml, bindRows, commitRows, mountRowsRefine } from './acts-review.js';

export const WIZARD_STEPS = ['Hành vi', 'Điều luật đề xuất', 'Hành vi theo điều', 'Câu hỏi & sơ đồ cây'];

/** Thanh bước tuần tự. done: số bước đã qua; nút bước trước bấm được (data-wz-go). */
export function stepperHtml(active, maxReached = active) {
  return `<ol class="wz-steps" aria-label="Các bước phân tích vụ việc">${WIZARD_STEPS.map((t, i) => {
    const n = i + 1;
    const cls = n === active ? 'active' : n < active ? 'done' : n <= maxReached ? 'done' : '';
    const can = n !== active && n <= maxReached;
    return `<li class="wz-step ${cls}">${can ? `<button type="button" data-wz-go="${n}">` : '<span>'}<b>${n < active ? icon('check', 'ic-sm') : n}</b><span>${t}</span>${can ? '</button>' : '</span>'}</li>`;
  }).join('')}</ol>`;
}

const load = () => store.get('legal-wizard', null);
const save = (s) => store.set('legal-wizard', s);
export const wizardState = load;
export function clearWizard() {
  store.remove('legal-wizard');
}

/**
 * Gắn luồng vào host. opts: { step (bắt đầu ở bước), onPlan({ dieu, hanhViIds, lienQuan, quotes }), onExit() }.
 */
export function mountWizard(ctx, host, { step, onPlan, onExit } = {}) {
  let s = load() || { step: 1, maxStep: 1, manual: '', docText: '', result: null, rows: [], chosen: [], primary: null, extra: [] };
  let refineCtl = null;
  const refineState = { history: [], undo: [] };
  if (step) s.step = Math.min(step, s.maxStep || 1);
  const ai = ctx.ai('legal');
  let dz = null;
  let shownStep = 0;
  const persist = () => save(s);

  function render() {
    persist();
    host.innerHTML = `<div class="wz" data-wz>
      <header class="wz-head">
        <div><h1 class="page-title">Phân tích <em>vụ việc</em></h1><p class="page-sub">Nhập hành vi hoặc tải tài liệu → hệ thống đề xuất điều luật → chọn hành vi theo từng điều → kế hoạch câu hỏi và sơ đồ cây.</p></div>
        <button class="btn btn-ghost btn-sm" type="button" data-wz-reset title="Bắt đầu vụ việc mới">${icon('refresh', 'ic-sm')}Làm mới</button>
      </header>
      ${stepperHtml(s.step, s.maxStep)}
      <section class="wz-body panel" data-wz-body></section>
      <footer class="wz-foot" data-wz-foot></footer>
    </div>`;
    $$('[data-wz-go]', host).forEach((b) => b.addEventListener('click', () => go(+b.dataset.wzGo)));
    $('[data-wz-reset]', host).addEventListener('click', async () => {
      if ((s.manual || s.docText || s.rows.length) && !(await ctx.confirm('Xóa dữ liệu đang phân tích và bắt đầu vụ việc mới?', { title: 'Làm mới', okText: 'Làm mới' }))) return;
      clearWizard();
      s = { step: 1, maxStep: 1, manual: '', docText: '', result: null, rows: [], chosen: [], primary: null, extra: [] };
      render();
    });
    [null, step1, step2, step3][s.step]();
    // Hiệu ứng chỉ khi chuyển bước (không chạy lại khi sửa nội dung trong bước).
    if (shownStep !== s.step) host.querySelector('.wz-body')?.classList.add('wz-enter');
    shownStep = s.step;
  }

  function go(n) {
    if (n === 4) return finish();
    s.step = n;
    render();
    host.scrollTop = 0;
    $('[data-wz]', host)?.scrollIntoView({ block: 'start' });
  }

  const foot = (html) => {
    $('[data-wz-foot]', host).innerHTML = html;
  };

  /* ---------- ① Hành vi ---------- */
  function step1() {
    const body = $('[data-wz-body]', host);
    body.innerHTML = `
      <div class="wz-grid">
        <div class="wz-card">
          <h3>${icon('plus', 'ic-sm')}Nhập hành vi thủ công</h3>
          <p class="hint">Mỗi dòng một hành vi (hoặc dán đoạn mô tả vụ việc). Ví dụ:</p>
          <textarea class="textarea" rows="8" data-manual placeholder="Kế toán lập chứng từ chi khống để rút tiền&#10;Thủ quỹ thu tiền nhưng không nhập quỹ&#10;Giám đốc ký duyệt chứng từ không kiểm tra&#10;Dùng con dấu giả hợp thức hóa hồ sơ">${escapeHtml(s.manual)}</textarea>
        </div>
        <div class="wz-card">
          <h3>${icon('upload', 'ic-sm')}Từ tài liệu (Word, PDF, ảnh)</h3>
          ${dropzoneHtml('Đơn tố giác, báo cáo xác minh, kết luận thanh tra, biên bản… PDF quét, ảnh chụp được nhận dạng chữ trên máy.')}
          <details class="wz-paste" ${s.docText ? 'open' : ''}><summary>Hoặc dán nội dung tài liệu</summary><textarea class="textarea" rows="5" data-doc placeholder="Dán nội dung tài liệu…">${escapeHtml(s.docText)}</textarea></details>
        </div>
      </div>
      <div class="la-mode">${aiModeHtml(ai, s.method)}</div>
      <p class="hint" data-progress hidden></p>`;
    dz = bindDropzone(body);
    bindMethod(body, (m) => {
      s.method = m;
      persist();
    });
    foot(`<button class="btn btn-ghost" type="button" data-exit>${icon('chevron-left', 'ic-sm')}Về cây hỏi đáp</button><span class="spacer"></span><button class="btn btn-primary" type="button" data-analyze>${icon('sparkles', 'ic-sm')}Phân tích &amp; đề xuất điều luật</button>`);
    $('[data-exit]', host).addEventListener('click', () => onExit?.());
    $('[data-manual]', body).addEventListener('input', (e) => (s.manual = e.target.value));
    $('[data-doc]', body).addEventListener('input', (e) => (s.docText = e.target.value));
    $('[data-analyze]', host).addEventListener('click', analyze);
  }

  async function analyze() {
    const body = $('[data-wz-body]', host);
    const progress = $('[data-progress]', body);
    const say = (t) => {
      progress.hidden = !t;
      progress.innerHTML = t ? `${icon('refresh', 'ic-sm spin')}${escapeHtml(t)}` : '';
    };
    const btn = $('[data-analyze]', host);
    s.manual = $('[data-manual]', body).value.trim();
    const pasted = $('[data-doc]', body).value.trim();
    if (!s.manual && !pasted && !dz.files().length) return toast('Nhập hành vi hoặc tải tài liệu vụ việc', { type: 'error' });
    btn.disabled = true;
    try {
      const doc = await readAll(dz.files(), pasted, say);
      s.docText = doc;
      say('Đang đối chiếu với các điều luật trong hệ thống…');
      const manualRes = s.manual ? analyzeActs(s.manual) : null;
      const docRes = doc.replace(/\s/g, '').length >= 40 ? analyzeOffline(doc, { primary: manualRes?.crimes[0]?.dieu }) : null;
      const base = mergeResults(manualRes, docRes);
      s.method = readMethod(body);
      const text = [s.manual && `CÁC HÀNH VI ĐƯỢC NÊU:\n${s.manual}`, doc].filter(Boolean).join('\n\n');
      const result = await runMethod(ctx, s.method, { text, base, extraBase: manualRes, role: 'người được hỏi', say });
      say('');
      if (!result.items.length && !result.crimes.length) toast('Chưa xác định được điều luật — tìm và thêm điều luật ở bước sau.', { type: 'info', timeout: 5000 });
      s.result = result;
      s.rows = toRows(result.items);
      // Mặc định chọn các điều có hành vi được chọn; điều chính là điều có nhiều hành vi nhất.
      const count = (d) => s.rows.filter((r) => r.dieu === d && r.checked).length;
      s.chosen = result.crimes.filter((c) => findCrime(c.dieu) && count(c.dieu)).map((c) => c.dieu);
      if (!s.chosen.length && result.crimes[0]) s.chosen = [result.crimes[0].dieu];
      s.primary = [...s.chosen].sort((a, b) => count(b) - count(a))[0] || null;
      s.extra = [];
      s.maxStep = 2;
      go(2);
    } catch (err) {
      say('');
      toast(err.message, { type: 'error', timeout: 6000 });
      btn.disabled = false;
    }
  }

  /* ---------- ② Điều luật đề xuất ---------- */
  function suggested() {
    const list = [...(s.result?.crimes || []), ...s.extra.map((d) => ({ dieu: d, ten: findCrime(d)?.ten, score: 0, reasons: ['Bạn thêm vào'] }))].filter((c) => findCrime(c.dieu));
    const seen = new Set();
    return list.filter((c) => !seen.has(c.dieu) && seen.add(c.dieu));
  }

  /** Đối chiếu dấu hiệu định tội của điều (Bộ luật trong phần mềm) với nội dung vụ việc. */
  function signsHtml(c, crime) {
    const signs = c.signs || crime.dauHieu.map((text) => ({ text, hit: false }));
    const hit = signs.filter((x) => x.hit).length;
    return `<details class="wz-signs" ${hit ? 'open' : ''}><summary>Đối chiếu dấu hiệu định tội: <strong>${hit}/${signs.length}</strong> có trong nội dung</summary>
      <ul>${signs.map((x) => `<li class="${x.hit ? 'hit' : ''}">${icon(x.hit ? 'check-circle' : 'help', 'ic-sm')}<span>${escapeHtml(x.text)}${x.note ? ` <em>— ${escapeHtml(x.note)}</em>` : ''}</span></li>`).join('')}</ul>
      <p class="hint">Chủ thể: ${escapeHtml(crime.chuThe)} · Lỗi: ${escapeHtml(crime.loi)}. Dấu hiệu chưa thấy trong nội dung cần làm rõ khi lấy lời khai.</p></details>`;
  }

  function step2() {
    const body = $('[data-wz-body]', host);
    const list = suggested();
    const max = Math.max(1, ...list.map((c) => c.score || 0));
    const nActs = (d) => s.rows.filter((r) => r.dieu === d).length;
    body.innerHTML = `
      ${s.result?.tomTat ? `<section class="la-sum"><h3>${icon('file', 'ic-sm')}Tóm tắt tài liệu${s.result.ai ? ' <span class="badge">AI</span>' : ''}</h3><p>${escapeHtml(s.result.tomTat)}</p></section>` : ''}
      <p class="la-method-used">${icon('check-circle', 'ic-sm')}Phân tích bằng: <strong>${METHOD_LABEL[s.result?.method] || METHOD_LABEL['doi-chieu']}</strong> <button type="button" class="btn btn-ghost btn-sm" data-redo>${icon('refresh', 'ic-sm')}Đổi cách phân tích</button></p>
      <h3 class="wz-h">${icon('book', 'ic-sm')}Điều luật đề xuất <small>tích các điều áp dụng · chọn một điều chính · có thể chọn nhiều điều</small></h3>
      <div class="wz-crimes">${
        list
          .map((c, i) => {
            const crime = findCrime(c.dieu);
            const on = s.chosen.includes(c.dieu);
            return `<article class="wz-crime ${on ? 'on' : ''} ${s.primary === c.dieu ? 'primary' : ''}" data-crime-card="${c.dieu}" style="--i:${i}">
              <label class="wz-crime-pick"><input type="checkbox" data-pick="${c.dieu}" ${on ? 'checked' : ''} /><span class="wz-art">Điều<strong>${c.dieu}</strong></span></label>
              <div class="wz-crime-body">
                <h4>${escapeHtml(crime.ten)}</h4>
                <div class="wz-meter" title="Mức độ phù hợp"><span style="width:${Math.round(((c.score || 0) / max) * 100)}%"></span></div>
                <ul class="wz-reasons">${(c.reasons || []).map((r) => `<li>${escapeHtml(r)}</li>`).join('')}${nActs(c.dieu) && !(c.reasons || []).some((r) => /hành vi/.test(r)) ? `<li><strong>${nActs(c.dieu)}</strong> hành vi đề xuất</li>` : ''}</ul>
                ${signsHtml(c, crime)}
              </div>
              <label class="wz-primary" title="Điều chính của kế hoạch hỏi"><input type="radio" name="wz-primary" data-primary="${c.dieu}" ${s.primary === c.dieu ? 'checked' : ''} ${on ? '' : 'disabled'} />Điều chính</label>
            </article>`;
          })
          .join('') || '<p class="hint">Chưa có đề xuất — tìm điều luật bên dưới để thêm.</p>'
      }</div>
      <div class="wz-add-crime">
        <div class="lg-search">${icon('search', 'ic-sm')}<input type="search" placeholder="Thêm điều luật khác: số điều hoặc tên tội…" aria-label="Tìm điều luật để thêm" data-crime-q /></div>
        <div class="wz-hits" data-hits></div>
      </div>`;
    const sync = () => {
      s.chosen = $$('[data-pick]:checked', body).map((x) => x.dataset.pick);
      if (!s.chosen.includes(s.primary)) s.primary = s.chosen[0] || null;
      $$('[data-crime-card]', body).forEach((card) => {
        const d = card.dataset.crimeCard;
        card.classList.toggle('on', s.chosen.includes(d));
        card.classList.toggle('primary', s.primary === d);
        const r = $('[data-primary]', card);
        r.disabled = !s.chosen.includes(d);
        r.checked = s.primary === d;
      });
      persist();
      foot2();
    };
    $$('[data-pick]', body).forEach((cb) => cb.addEventListener('change', sync));
    $('[data-redo]', body).addEventListener('click', () => go(1));
    $$('[data-primary]', body).forEach((r) =>
      r.addEventListener('change', () => {
        s.primary = r.dataset.primary;
        sync();
      }),
    );
    const q = $('[data-crime-q]', body);
    q.addEventListener('input', () => {
      const v = q.value.trim();
      const hits = v ? searchCrimes(v).slice(0, 8) : [];
      $('[data-hits]', body).innerHTML = hits.map((c) => `<button type="button" class="wz-hit" data-add-crime="${c.dieu}"><b>Điều ${c.dieu}</b>${escapeHtml(c.ten.replace(/^Tội /, ''))}</button>`).join('');
    });
    $('[data-hits]', body).addEventListener('click', (e) => {
      const b = e.target.closest('[data-add-crime]');
      if (!b) return;
      const d = b.dataset.addCrime;
      if (!s.extra.includes(d) && !suggested().some((c) => c.dieu === d)) s.extra.push(d);
      if (!s.chosen.includes(d)) s.chosen.push(d);
      if (!s.primary) s.primary = d;
      render();
    });
    foot2();
  }
  function foot2() {
    foot(`<button class="btn btn-ghost" type="button" data-back>${icon('chevron-left', 'ic-sm')}Bước 1</button><span class="wz-sum">${s.chosen.length ? `Đã chọn <strong>${s.chosen.length}</strong> điều · điều chính <strong>Điều ${s.primary}</strong>` : 'Chưa chọn điều luật nào'}</span><span class="spacer"></span><button class="btn btn-primary" type="button" data-next ${s.chosen.length ? '' : 'disabled'}>Tiếp tục: chọn hành vi ${icon('arrow-right', 'ic-sm')}</button>`);
    $('[data-back]', host).addEventListener('click', () => go(1));
    $('[data-next]', host).addEventListener('click', () => {
      s.maxStep = Math.max(s.maxStep, 3);
      go(3);
    });
  }

  /* ---------- ③ Hành vi theo điều ---------- */
  function step3() {
    const body = $('[data-wz-body]', host);
    const ds = [s.primary, ...s.chosen.filter((d) => d !== s.primary)];
    const outside = s.rows.filter((r) => !ds.includes(r.dieu));
    body.innerHTML = `
      <h3 class="wz-h">${icon('check-circle', 'ic-sm')}Hành vi theo từng điều <small data-count></small></h3>
      ${ds
        .map((d) => {
          const crime = crimeWithCustomActs(d);
          const rows = s.rows.filter((r) => r.dieu === d);
          const used = new Set(rows.map((r) => r.hanhViId).filter(Boolean));
          const more = crime.hanhVi.filter((h) => !used.has(h.id));
          return `<section class="la-group wz-group" data-group="${d}">
            <h4>Điều ${d} — ${escapeHtml(crime.ten)} ${d === s.primary ? '<em class="badge badge-accent">Điều chính</em>' : '<em class="badge">Liên quan</em>'}</h4>
            ${rows.map((r) => rowHtml(r, ds)).join('') || '<p class="hint">Chưa có hành vi — chọn hành vi có sẵn hoặc thêm hành vi tự nhập.</p>'}
            ${more.length ? `<div class="wz-more"><small>Hành vi có sẵn của Điều ${d}:</small>${more.map((h) => `<button type="button" class="chip" data-add-known="${d}|${h.id}">${icon('plus', 'ic-sm')}${escapeHtml(h.ten)}</button>`).join('')}</div>` : ''}
            <button class="btn btn-ghost btn-sm" type="button" data-add-row="${d}">${icon('plus', 'ic-sm')}Thêm hành vi tự nhập vào Điều ${d}</button>
          </section>`;
        })
        .join('')}
      ${outside.length ? `<details class="wz-outside"><summary>${outside.length} hành vi thuộc điều chưa chọn (không đưa vào kế hoạch)</summary>${outside.map((r) => `<p>Điều ${escapeHtml(r.dieu)} — ${escapeHtml(r.ten)}</p>`).join('')}<p class="hint">Quay lại bước 2 để chọn thêm điều luật.</p></details>` : ''}
      <section class="la-refine" data-la-refine></section>`;
    bindRows(body, s.rows, { rerender: render, onCount: count3 });
    if (s.result && (s.docText || s.manual)) {
      refineCtl?.destroy();
      refineCtl = mountRowsRefine($('[data-la-refine]', body), ctx, { text: [s.manual && `CÁC HÀNH VI ĐƯỢC NÊU:\n${s.manual}`, s.docText].filter(Boolean).join('\n\n'), primary: s.primary, role: 'người được hỏi', candidates: [...new Set([...ds, ...(s.result.crimes || []).map((c) => c.dieu)])].slice(0, 12), rows: s.rows, result: s.result, rerender: render, state: refineState });
    }
    $$('[data-add-row]', body).forEach((b) =>
      b.addEventListener('click', () => {
        const r = newRow(s.rows, b.dataset.addRow);
        s.rows.push(r);
        render();
        $(`[data-row="${r.idx}"] [data-r-name]`, host)?.focus();
      }),
    );
    $$('[data-add-known]', body).forEach((b) =>
      b.addEventListener('click', () => {
        const [d, id] = b.dataset.addKnown.split('|');
        const h = crimeWithCustomActs(d).hanhVi.find((x) => x.id === id);
        s.rows.push({ ...newRow(s.rows, d), ten: h.ten, tenGoc: h.ten, hanhViId: h.id, nguon: 'he-thong' });
        render();
      }),
    );
    count3();
  }
  function count3() {
    const ds = s.chosen;
    const n = s.rows.filter((r) => r.checked && r.ten.trim() && ds.includes(r.dieu)).length;
    const c = $('[data-count]', host);
    if (c) c.textContent = `${n} hành vi đã chọn`;
    persist();
    foot(`<button class="btn btn-ghost" type="button" data-back>${icon('chevron-left', 'ic-sm')}Bước 2</button><span class="spacer"></span><button class="btn btn-primary" type="button" data-next ${n ? '' : 'disabled'}>Lập câu hỏi &amp; sơ đồ cây ${icon('arrow-right', 'ic-sm')}</button>`);
    $('[data-back]', host).addEventListener('click', () => go(2));
    $('[data-next]', host).addEventListener('click', finish);
  }

  /* ---------- ④ → kế hoạch hỏi ---------- */
  function finish() {
    const ds = s.chosen;
    const { byDieu, quotes, created, skipped } = commitRows(s.rows.filter((r) => ds.includes(r.dieu)));
    if (skipped) toast(`Bỏ qua ${skipped} hành vi chưa chọn được điều luật`, { type: 'info' });
    if (!byDieu.size) return toast('Chọn ít nhất một hành vi', { type: 'error' });
    // Hành vi mới đã lưu: đánh dấu là có sẵn để quay lại không tạo trùng.
    s.rows.forEach((r) => {
      if (!r.checked || !ds.includes(r.dieu)) return;
      const ids = byDieu.get(r.dieu) || [];
      const h = crimeWithCustomActs(r.dieu)?.hanhVi.find((x) => ids.includes(x.id) && x.ten.trim().toLowerCase() === r.ten.trim().toLowerCase());
      if (h) Object.assign(r, { hanhViId: h.id, tenGoc: h.ten });
    });
    const primary = byDieu.has(s.primary) ? s.primary : [...byDieu.keys()][0];
    s.maxStep = 4;
    persist();
    onPlan?.({
      dieu: primary,
      hanhViIds: byDieu.get(primary),
      lienQuan: [...byDieu].filter(([d]) => d !== primary).map(([dieu, hanhViIds]) => ({ dieu, hanhViIds })),
      quotes,
      created,
    });
  }

  render();
  return { go };
}
