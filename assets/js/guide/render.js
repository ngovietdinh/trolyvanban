// Dựng nội dung một hướng dẫn (dùng chung cho Trung tâm hướng dẫn và ngăn trợ giúp theo ngữ cảnh).
import { $$, icon, toast, escapeHtml, copyText } from '../ui.js';
import { store } from '../lib/store.js';
import { inline, findGuide } from './guides.js';

const fmt = (s) => inline(escapeHtml(s || ''));

export const seenMap = () => store.get('help-seen', {});
export const isSeen = (id) => !!seenMap()[id];
export function setSeen(id, on = true) {
  const m = seenMap();
  if (on) m[id] = Date.now();
  else delete m[id];
  store.set('help-seen', m);
}

/**
 * HTML thân hướng dẫn. compact = bản rút gọn trong ngăn trợ giúp (ẩn hỏi đáp, liên quan).
 * Ví dụ có nút Sao chép / Thử ngay (gắn sự kiện bằng bindGuide).
 */
export function guideBodyHtml(g, { compact = false, can = () => true } = {}) {
  const steps = `<section class="gd-sec" aria-labelledby="gd-steps-${g.id}">
      <h2 id="gd-steps-${g.id}">${icon('check-circle', 'ic-sm')}Các bước thực hiện</h2>
      <ol class="gd-steps">${g.steps
        .map(
          (s, i) => `<li><span class="gd-num" aria-hidden="true">${i + 1}</span><div><h3>${fmt(s.t)}</h3><p>${fmt(s.d)}</p>${s.tip ? `<p class="gd-tip">${icon('zap', 'ic-sm')}<span><strong>Mẹo:</strong> ${fmt(s.tip)}</span></p>` : ''}</div></li>`,
        )
        .join('')}</ol>
    </section>`;
  const when = g.when?.length
    ? `<section class="gd-sec gd-when"><h2>${icon('info', 'ic-sm')}Dùng khi nào?</h2><ul>${g.when.map((w) => `<li>${fmt(w)}</li>`).join('')}</ul></section>`
    : '';
  const examples = g.examples?.length
    ? `<section class="gd-sec"><h2>${icon('quote', 'ic-sm')}Ví dụ minh họa</h2><div class="gd-examples">${g.examples
        .map(
          (e, i) => `<figure class="gd-ex">
            <figcaption>${fmt(e.title)}</figcaption>
            <pre class="gd-ex-text">${escapeHtml(e.text)}</pre>
            ${e.note ? `<p class="gd-ex-note">${fmt(e.note)}</p>` : ''}
            <div class="gd-ex-actions">
              <button class="btn btn-sm btn-ghost" type="button" data-ex-copy="${i}">${icon('copy', 'ic-sm')}Sao chép</button>
              ${e.fill ? `<button class="btn btn-sm btn-primary" type="button" data-ex-try="${i}">${icon('arrow-right', 'ic-sm')}Thử ngay</button>` : ''}
            </div>
          </figure>`,
        )
        .join('')}</div></section>`
    : '';
  const tips = g.tips?.length ? `<section class="gd-sec"><h2>${icon('star', 'ic-sm')}Mẹo hay</h2><ul class="gd-tips">${g.tips.map((t) => `<li>${fmt(t)}</li>`).join('')}</ul></section>` : '';
  const mistakes = g.mistakes?.length
    ? `<section class="gd-sec"><h2>${icon('alert', 'ic-sm')}Lỗi thường gặp</h2><div class="gd-mistakes">${g.mistakes
        .map(([bad, good]) => `<div class="gd-mk"><p class="gd-bad"><span>${icon('x', 'ic-sm')}Tránh</span>${fmt(bad)}</p><p class="gd-good"><span>${icon('check', 'ic-sm')}Nên</span>${fmt(good)}</p></div>`)
        .join('')}</div></section>`
    : '';
  const shortcuts = g.shortcuts?.length
    ? `<section class="gd-sec"><h2>${icon('command', 'ic-sm')}Phím tắt</h2><dl class="gd-keys">${g.shortcuts.map(([k, d]) => `<div><dt>${k.split(' ').map((x) => `<kbd class="kbd">${escapeHtml(x)}</kbd>`).join(' ')}</dt><dd>${escapeHtml(d)}</dd></div>`).join('')}</dl></section>`
    : '';
  const faq =
    !compact && g.faq?.length
      ? `<section class="gd-sec"><h2>${icon('message', 'ic-sm')}Hỏi – đáp</h2><div class="gd-faq">${g.faq.map(([q, a]) => `<details><summary>${fmt(q)}</summary><p>${fmt(a)}</p></details>`).join('')}</div></section>`
      : '';
  const rel = (g.related || []).map(findGuide).filter((r) => r && (!r.perm || can(r.perm)));
  const related =
    !compact && rel.length
      ? `<section class="gd-sec"><h2>${icon('layers', 'ic-sm')}Xem tiếp</h2><div class="gd-related">${rel.map((r) => `<a class="gd-rel" href="#help/${r.id}">${icon(r.icon, 'ic-sm')}<span><strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.summary)}</small></span></a>`).join('')}</div></section>`
      : '';
  return `${when}${steps}${examples}${mistakes}${tips}${shortcuts}${faq}${related}`;
}

/** Gắn sự kiện cho ví dụ: sao chép, hoặc mở màn hình và điền sẵn ví dụ vào ô nhập. */
export function bindGuide(root, g, ctx, { onNavigate } = {}) {
  $$('[data-ex-copy]', root).forEach((b) =>
    b.addEventListener('click', async () => {
      await copyText(g.examples[+b.dataset.exCopy].text);
      toast('Đã sao chép ví dụ');
    }),
  );
  $$('[data-ex-try]', root).forEach((b) =>
    b.addEventListener('click', () => {
      const ex = g.examples[+b.dataset.exTry];
      onNavigate?.();
      ctx.handoff = { prefill: ex.text };
      ctx.navigate(ex.fill);
    }),
  );
}
