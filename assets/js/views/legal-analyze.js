// Thêm hành vi từ tài liệu (trong một điều cụ thể): tải đơn tố giác, báo cáo, kết luận thanh tra, biên bản… → đọc,
// tóm tắt, liệt kê hành vi có dấu hiệu tội phạm theo điều luật trong hệ thống (một vụ việc có thể liên quan nhiều điều).
// Người dùng chọn / bỏ chọn, sửa tên, đổi điều luật, xem câu hỏi sẽ sinh → bấm “Thêm hành vi”.
import { chunkSizeFor } from '../lib/ai-chunk.js';
import { $, $$, icon, toast, escapeHtml } from '../ui.js';
import { findCrime } from '../legal/engine.js';
import { getRole } from '../legal/roles.js';
import { analyzeOffline, analyzeWithAi, annotateResult, mergeResults } from '../legal/analyze.js';
import { streamAI } from '../lib/ai.js';
import { store } from '../lib/store.js';
import { dropzoneHtml, bindDropzone, readAll, toRows, newRow, rowHtml, bindRows, commitRows } from './acts-review.js';

export const METHOD_LABEL = { 'doi-chieu': 'Đối chiếu Bộ luật trong phần mềm', ai: 'AI phân tích', 'ket-hop': 'Kết hợp AI + đối chiếu Bộ luật' };

/** Chọn cách phân tích: đối chiếu Bộ luật trong phần mềm (luôn có, chạy trên máy), AI, hoặc kết hợp. */
export function aiModeHtml(ai, mode) {
  const m = mode || (ai ? 'ket-hop' : 'doi-chieu');
  const name = ai ? (ai.local ? 'AI trên máy' : ai.label) : '';
  const opt = (id, title, desc, ok = true) => `<label class="la-method ${m === id && ok ? 'on' : ''} ${ok ? '' : 'off'}"><input type="radio" name="la-method" value="${id}" data-method ${m === id && ok ? 'checked' : ''} ${ok ? '' : 'disabled'} /><strong>${title}</strong><small>${desc}</small></label>`;
  return `<fieldset class="la-methods"><legend>Cách phân tích</legend>
    ${opt('doi-chieu', `${icon('book', 'ic-sm')}Đối chiếu Bộ luật`, 'So nội dung với các điều luật, hành vi, dấu hiệu định tội có trong phần mềm. Chạy trên máy, không gửi dữ liệu.')}
    ${opt('ai', `${icon('sparkles', 'ic-sm')}AI phân tích`, ai ? `${escapeHtml(name)} đọc và suy luận; điều luật AI nêu được kiểm tra với Bộ luật trong phần mềm.${ai.local ? '' : ' Nội dung được gửi tới dịch vụ AI.'}` : 'Chưa kết nối AI — vào Cài đặt để thêm API key hoặc AI chạy trên máy.', !!ai)}
    ${opt('ket-hop', `${icon('layers', 'ic-sm')}Kết hợp`, ai ? `AI phân tích, bổ sung hành vi đối chiếu được mà AI bỏ sót. Chính xác nhất.` : 'Cần kết nối AI.', !!ai)}
  </fieldset>`;
}
export function readMethod(box) {
  return $('[data-method]:checked', box)?.value || 'doi-chieu';
}
export function bindMethod(box, onChange = () => {}) {
  $$('[data-method]', box).forEach((r) =>
    r.addEventListener('change', () => {
      $$('.la-method', box).forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
      onChange(r.value);
    }),
  );
}

/**
 * Chạy phân tích theo cách đã chọn. base: kết quả đối chiếu (luôn tính — dùng làm danh mục ứng viên cho AI).
 * Trả về kết quả đã gắn đối chiếu dấu hiệu định tội.
 */
export async function runMethod(ctx, method, { text, base, extraBase = null, primary, role, signal, say }) {
  let result = base;
  if (method !== 'doi-chieu' && ctx.ai('legal')) {
    const ai = ctx.ai('legal');
    const who = ai.local ? 'AI trên máy' : ai.label;
    say?.(`${who} đang phân tích…`);
    try {
      const offline = method === 'ai' ? { ...base, items: [] } : base;
      const r = await analyzeWithAi((o) => streamAI({ ...ctx.ai('legal'), ...o }), text, {
        primary: primary || base.crimes[0]?.dieu || '',
        offline,
        role,
        signal,
        chunkSize: chunkSizeFor(ai),
        concurrency: ai.local ? 1 : 2,
        onProgress: (i, n) => say?.(n > 1 ? `${who} đang phân tích phần ${i}/${n} — tài liệu dài được chia nhỏ, phần nào lỗi tự chia nhỏ hơn và gửi lại để kết quả về đủ…` : `${who} đang phân tích…`),
      });
      if (r.aiParts?.failed) toast(`AI không trả lời ${r.aiParts.failed}/${r.aiParts.total} phần của tài liệu — các phần đó dùng kết quả đối chiếu Bộ luật.`, { type: 'info', timeout: 6000 });
      result = method === 'ket-hop' ? mergeResults(r, extraBase) : r;
    } catch (err) {
      if (!signal?.aborted) toast(`${err.message} — dùng kết quả đối chiếu Bộ luật.`, { type: 'info', timeout: 6000 });
      method = 'doi-chieu';
    }
  }
  return annotateResult(result, text, method);
}

/**
 * opts: { crime (điều đang mở), roleId, selected (id hành vi đã chọn), onAdd({ primaryIds, related: [{ dieu, hanhViIds }], quotes: [{ dieu, id, text }] }) }
 */
export function openAnalyzeDialog(ctx, { crime, roleId, selected = [], onAdd }) {
  const ai = ctx.ai('legal');
  let result = null;
  let rows = [];
  let controller = null;

  ctx.modal(
    `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
    <h2 class="modal-title">Thêm hành vi từ tài liệu</h2>
    <p class="hint">Điều đang làm việc: <strong>Điều ${crime.dieu}</strong> — ${escapeHtml(crime.ten)}. Hệ thống đọc tài liệu, tóm tắt và đối chiếu từng hành vi với các điều luật đang có; một vụ việc có thể thuộc nhiều điều cùng lúc.</p>
    <div class="la-body" data-step="input">
      ${dropzoneHtml()}
      <div class="field"><label for="la-text">Hoặc dán nội dung</label><textarea class="textarea" rows="5" id="la-text" data-text placeholder="Dán nội dung đơn, báo cáo, lời khai…"></textarea></div>
      <div class="la-mode">${aiModeHtml(ai, store.get('legal-method', null))}</div>
      <p class="hint" data-progress hidden></p>
    </div>
    <div class="la-body" data-step="review" hidden></div>
    <div class="modal-actions" data-actions>
      <button class="btn" type="button" data-close>Hủy</button>
      <button class="btn btn-primary" type="button" data-analyze>${icon('sparkles', 'ic-sm')}Phân tích</button>
    </div>`,
    {
      className: 'modal-wide la-modal',
      label: 'Thêm hành vi từ tài liệu',
      onMount(box, close) {
        const dz = bindDropzone(box);
        bindMethod(box, (m) => store.set('legal-method', m));
        const progress = $('[data-progress]', box);
        const say = (t) => {
          progress.hidden = !t;
          progress.innerHTML = t ? `${icon('refresh', 'ic-sm spin')}${escapeHtml(t)}` : '';
        };
        const actions = $('[data-actions]', box);
        const setActions = (html) => {
          actions.innerHTML = html;
          $$('[data-close]', actions).forEach((b) => b.addEventListener('click', close));
        };
        const inputActions = () => {
          setActions(`<button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="button" data-analyze>${icon('sparkles', 'ic-sm')}Phân tích</button>`);
          $('[data-analyze]', actions).addEventListener('click', analyze);
        };

        async function analyze() {
          const btn = $('[data-analyze]', box);
          const pasted = $('[data-text]', box).value.trim();
          if (!dz.files().length && !pasted) return toast('Chọn tài liệu hoặc dán nội dung cần phân tích', { type: 'error' });
          btn.disabled = true;
          try {
            const text = await readAll(dz.files(), pasted, say);
            if (text.replace(/\s/g, '').length < 40) throw new Error('Tài liệu quá ngắn hoặc không đọc được chữ.');
            say('Đang đối chiếu với các điều luật trong hệ thống…');
            const offline = analyzeOffline(text, { primary: crime.dieu });
            const method = readMethod(box);
            if (method !== 'doi-chieu') {
              controller = new AbortController();
              setActions(`<span class="spacer"></span><button class="btn" type="button" data-stop>${icon('stop', 'ic-sm')}Dừng, dùng kết quả đối chiếu</button>`);
              $('[data-stop]', actions).addEventListener('click', () => controller.abort());
            }
            result = await runMethod(ctx, method, { text, base: offline, primary: crime.dieu, role: getRole(roleId).ten, signal: controller?.signal, say });
            say('');
            rows = toRows(result.items, { [crime.dieu]: selected });
            $('[data-step="input"]', box).hidden = true;
            renderReview();
          } catch (err) {
            say('');
            toast(err.message, { type: 'error', timeout: 6000 });
            inputActions();
          }
        }
        $('[data-analyze]', box).addEventListener('click', analyze);

        const dieuOptions = () => [...new Set([crime.dieu, ...result.crimes.map((c) => c.dieu), ...rows.map((r) => r.dieu)])].filter((d) => findCrime(d));

        function renderReview() {
          const step = $('[data-step="review"]', box);
          step.hidden = false;
          const ds = dieuOptions();
          const groups = ds.map((d) => ({ d, items: rows.filter((r) => r.dieu === d) })).filter((g) => g.items.length);
          const orphan = rows.filter((r) => !ds.includes(r.dieu));
          step.innerHTML = `
            <p class="la-method-used">${icon('check-circle', 'ic-sm')}Phân tích bằng: <strong>${METHOD_LABEL[result.method] || METHOD_LABEL['doi-chieu']}</strong></p>
            ${result.tomTat ? `<section class="la-sum"><h3>${icon('file', 'ic-sm')}Tóm tắt tài liệu${result.ai ? ' <span class="badge">AI</span>' : ''}</h3><p>${escapeHtml(result.tomTat)}</p></section>` : ''}
            <section class="la-crimes"><h3>${icon('book', 'ic-sm')}Điều luật liên quan (${result.crimes.length})</h3>
              <div class="la-chips">${result.crimes.map((c) => `<span class="la-chip ${c.dieu === crime.dieu ? 'primary' : ''}" title="${escapeHtml((c.reasons || []).join(' · '))}"><strong>Điều ${c.dieu}</strong> ${escapeHtml(c.ten.replace(/^Tội /, ''))}${c.dieu === crime.dieu ? ' <em>(đang mở)</em>' : ''}</span>`).join('') || '<small class="hint">Chưa xác định được điều luật nào — chọn điều cho từng hành vi bên dưới.</small>'}</div>
            </section>
            <section class="la-list"><h3>${icon('check-circle', 'ic-sm')}Hành vi phát hiện <small data-count></small></h3>
              ${rows.length ? '' : '<p class="hint">Không tìm thấy hành vi nào phù hợp. Thêm hành vi tự nhập bên dưới.</p>'}
              ${[...groups, ...(orphan.length ? [{ d: null, items: orphan }] : [])]
                .map((g) => `<div class="la-group"><h4>${g.d ? `Điều ${g.d} — ${escapeHtml(findCrime(g.d).ten)}${g.d === crime.dieu ? ' <em>(điều đang mở)</em>' : ' <em>(sẽ thêm làm điều liên quan)</em>'}` : 'Cần chọn điều luật'}</h4>${g.items.map((r) => rowHtml(r, ds)).join('')}</div>`)
                .join('')}
              <button class="btn btn-ghost btn-sm" type="button" data-add-row>${icon('plus', 'ic-sm')}Thêm hành vi tự nhập</button>
            </section>`;
          bindRows(box, rows, { rerender: renderReview, onCount: updateCount });
          $('[data-add-row]', box).addEventListener('click', () => {
            const r = newRow(rows, crime.dieu);
            rows.push(r);
            renderReview();
            $(`[data-row="${r.idx}"] [data-r-name]`, box)?.focus();
          });
          updateCount();
        }

        function updateCount() {
          const n = rows.filter((r) => r.checked && r.ten.trim()).length;
          $('[data-count]', box).textContent = `${n}/${rows.length} đã chọn`;
          setActions(`<button class="btn btn-ghost" type="button" data-back>${icon('chevron-left', 'ic-sm')}Tài liệu khác</button><span class="spacer"></span><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="button" data-commit ${n ? '' : 'disabled'}>${icon('plus', 'ic-sm')}Thêm ${n} hành vi</button>`);
          $('[data-back]', actions).addEventListener('click', () => {
            $('[data-step="review"]', box).hidden = true;
            $('[data-step="input"]', box).hidden = false;
            inputActions();
          });
          $('[data-commit]', actions).addEventListener('click', commit);
        }

        function commit() {
          const { byDieu, quotes, created, skipped } = commitRows(rows);
          if (skipped) toast(`Bỏ qua ${skipped} hành vi chưa chọn được điều luật trong hệ thống`, { type: 'info' });
          if (!byDieu.size) return;
          const primaryIds = byDieu.get(crime.dieu) || [];
          const related = [...byDieu].filter(([d]) => d !== crime.dieu).map(([dieu, hanhViIds]) => ({ dieu, hanhViIds }));
          onAdd({ primaryIds, related, quotes });
          close();
          const parts = [...byDieu].map(([d, ids]) => `Điều ${d}: ${ids.length}`);
          toast(`Đã thêm ${[...byDieu.values()].flat().length} hành vi (${parts.join(', ')})${created ? ` — ${created} hành vi mới đã sinh câu hỏi` : ''}`, { timeout: 6000 });
        }
      },
    },
  );
}
