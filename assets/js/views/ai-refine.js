// Hộp “Yêu cầu AI làm tiếp”: sau khi AI phân tích / vẽ sơ đồ / kết luận, người dùng gõ thêm yêu cầu (bổ sung, sửa,
// làm rõ, rút gọn…) để AI hoàn thiện tiếp trên kết quả đang có. Dùng chung cho Sơ đồ vụ việc, Thêm hành vi từ tài liệu,
// Nhận định AI ở Theo dõi hồ sơ. Có gợi ý yêu cầu theo nội dung, dừng giữa chừng, lịch sử yêu cầu, hoàn tác.
import { $, icon, toast, escapeHtml } from '../ui.js';
import { attachSuggest, aiRequestSuggestions } from '../lib/suggest.js';

/**
 * Trả về HTML hộp yêu cầu. Gắn sự kiện bằng bindRefine(box, …).
 * opts: { title, placeholder, hint, ai (cấu hình AI hoặc null), offlineHint }
 */
export function refineHtml({ title = 'Yêu cầu AI làm tiếp', placeholder = 'Ví dụ: bổ sung dòng tiền giữa A và B, làm rõ vai trò của C…', hint = '', ai = null, offlineHint = 'Kết nối AI trong Cài đặt để yêu cầu AI làm tiếp trên kết quả này.' } = {}) {
  if (!ai) return `<div class="rf rf-off"><p class="hint">${icon('sparkles', 'ic-sm')}${escapeHtml(offlineHint)}</p></div>`;
  return `<form class="rf" data-rf>
    <div class="rf-head">${icon('sparkles', 'ic-sm')}<strong>${escapeHtml(title)}</strong><small>${escapeHtml(ai.local ? 'AI trên máy' : ai.label || 'AI')}</small><span class="spacer"></span><button type="button" class="btn btn-ghost btn-sm" data-rf-undo hidden>${icon('undo', 'ic-sm')}Hoàn tác lần trước</button></div>
    ${hint ? `<p class="hint rf-hint">${escapeHtml(hint)}</p>` : ''}
    <div class="rf-row"><div class="rf-in"><textarea class="textarea" rows="2" data-rf-text aria-label="${escapeHtml(title)}" placeholder="${escapeHtml(placeholder)}"></textarea></div><button class="btn btn-primary" type="submit" data-rf-send>${icon('send', 'ic-sm')}Gửi</button></div>
    <p class="hint rf-say" data-rf-say aria-live="polite" hidden></p>
    <ol class="rf-hist" data-rf-hist hidden></ol>
  </form>`;
}

/**
 * opts:
 * - run(request, { signal, say }) → Promise<string | void>: thực hiện yêu cầu, trả về ghi chú ngắn (vd “thêm 3 quan hệ”);
 * - context() → { people, extra }: ngữ cảnh cho gợi ý yêu cầu;
 * - snapshot() / restore(s): chụp – khôi phục kết quả trước mỗi yêu cầu để hoàn tác;
 * - history: mảng lịch sử dùng lại giữa các lần vẽ lại [{ text, note, ok }];
 * - onDone(): gọi sau khi xong một yêu cầu / hoàn tác (lịch sử đã cập nhật) — nơi vẽ lại kết quả nếu hộp nằm trong đó.
 */
export function bindRefine(box, { run, context = () => ({}), snapshot, restore, history = [], undo = [], onDone } = {}) {
  const form = box?.matches?.('[data-rf]') ? box : $('[data-rf]', box);
  if (!form) return null;
  const ta = $('[data-rf-text]', form);
  const send = $('[data-rf-send]', form);
  const sayEl = $('[data-rf-say]', form);
  const histEl = $('[data-rf-hist]', form);
  const undoBtn = $('[data-rf-undo]', form);
  let ctl = null;
  const say = (t) => {
    sayEl.hidden = !t;
    sayEl.innerHTML = t ? `${icon('refresh', 'ic-sm spin')}${escapeHtml(t)}` : '';
  };
  const drawHist = () => {
    histEl.hidden = !history.length;
    histEl.innerHTML = history.map((h) => `<li class="${h.ok ? 'ok' : 'err'}"><span>${escapeHtml(h.text)}</span>${h.note ? `<small>${escapeHtml(h.note)}</small>` : ''}</li>`).join('');
    undoBtn.hidden = !undo.length;
  };
  drawHist();
  const detach = attachSuggest(ta, (t) => aiRequestSuggestions(t, context()));
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (ctl) {
      ctl.abort();
      return;
    }
    const text = ta.value.trim();
    if (!text) {
      ta.focus();
      return toast('Nhập yêu cầu cho AI (hoặc bấm một gợi ý)', { type: 'info' });
    }
    ctl = new AbortController();
    send.innerHTML = `${icon('stop', 'ic-sm')}Dừng`;
    ta.disabled = true;
    const before = snapshot?.();
    try {
      const note = await run(text, { signal: ctl.signal, say });
      if (before !== undefined) undo.push(before);
      history.push({ text, note: note || 'Đã cập nhật', ok: true });
      ta.value = '';
    } catch (err) {
      if (ctl.signal.aborted) history.push({ text, note: 'Đã dừng', ok: false });
      else {
        history.push({ text, note: err.message, ok: false });
        toast(err.message, { type: 'error', timeout: 6000 });
      }
    }
    ctl = null;
    say('');
    onDone?.();
    if (!form.isConnected) return;
    ta.disabled = false;
    send.innerHTML = `${icon('send', 'ic-sm')}Gửi`;
    drawHist();
  });
  undoBtn.addEventListener('click', () => {
    if (!undo.length) return;
    history.push({ text: 'Hoàn tác', note: 'Đã trở lại kết quả trước yêu cầu gần nhất', ok: true });
    restore?.(undo.pop());
    onDone?.();
    if (form.isConnected) drawHist();
  });
  return { destroy: () => (ctl?.abort(), detach()) };
}
