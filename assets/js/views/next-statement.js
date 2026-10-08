// Ghi lời khai lần tiếp theo của cùng một người: phân tích các biên bản trước, đề xuất câu hỏi làm rõ những
// điểm chưa rõ (có lý do cho từng câu), chọn nhóm câu hỏi, có thể nhờ AI đề xuất thêm, rồi mở biên bản mới.
import { $, $$, icon, toast, escapeHtml } from '../ui.js';
import { casesRepo, recordsRepo, plansRepo, customBank, learnedBank } from '../legal/repo.js';
import { newRecord, prefillQa } from '../legal/record.js';
import { getRole } from '../legal/roles.js';
import { BUOC } from '../legal/engine.js';
import { previousRecords, followUpPlan, followUpPrompt } from '../legal/followup.js';
import { planFromSaved } from '../legal/tracking.js';
import { INVESTIGATOR_SYSTEM } from '../legal/assist.js';
import { streamClaude, extractJson } from '../lib/ai.js';
import { ctxFor } from '../lib/ai-chunk.js';
import { uid } from '../lib/store.js';

/** Có biên bản trước (đã có câu trả lời) của người này không. */
export function hasPrevious(target) {
  return previousRecords(target, recordsRepo.list()).length > 0;
}

/**
 * target: { caseId, personId, nguoiKhai: { hoTen }, roleId } — hoặc một biên bản (lấy người khai của biên bản đó).
 */
export function openNextStatement(ctx, target) {
  const all = recordsRepo.list();
  const prev = previousRecords(target, all);
  if (target.id && !prev.some((r) => r.id === target.id) && (target.qa || []).some((x) => String(x.a || '').trim())) prev.push(target);
  prev.sort((a, b) => (a.lan || 1) - (b.lan || 1));
  if (!prev.length) return toast('Người này chưa có biên bản nào có nội dung trả lời — hãy ghi lời khai lần đầu', { type: 'info', timeout: 4500 });
  const last = prev.at(-1);
  const caseItem = last.caseId ? casesRepo.get(last.caseId) : null;
  const person = caseItem?.persons?.find((p) => p.id === (target.personId || last.personId)) || null;
  const roleId = person?.roleId || last.roleId;
  const ids = new Set(prev.map((r) => r.id));
  const others = caseItem ? all.filter((r) => r.caseId === caseItem.id && !ids.has(r.id) && r.personId !== (person?.id || '§')) : [];
  const saved = [...prev].reverse().map((r) => r.planId && plansRepo.get(r.planId)).find(Boolean) || null;
  const base = saved ? planFromSaved(saved, { roleId, custom: customBank.all(), learned: learnedBank.all() }) : null;
  const dieu = saved?.dieu || last.plan?.dieu || caseItem?.toiDanh?.[0] || null;
  // Lần mới = sau mọi biên bản của người này (kể cả biên bản đang ghi dở chưa có trả lời).
  const mine = all.filter((r) => r.caseId === last.caseId && (person ? r.personId === person.id : r.nguoiKhai?.hoTen === last.nguoiKhai?.hoTen));
  const lan = Math.max(0, ...mine.map((r) => r.lan || 1), ...prev.map((r) => r.lan || 1)) + 1;
  let extra = [];
  let result = followUpPlan({ prev, others, base, dieu, roleId, extra, lan });
  const off = new Set();
  const who = person?.hoTen || last.nguoiKhai?.hoTen || 'người khai';

  const groupsHtml = () =>
    result.plan.issues
      .map(
        (is) => `<details class="ns-group" data-g="${escapeHtml(is.key)}">
        <summary><input type="checkbox" class="ns-on" data-g-on="${escapeHtml(is.key)}" ${off.has(is.key) ? '' : 'checked'} aria-label="Dùng nhóm: ${escapeHtml(is.tieuDe)}" /><span><strong>${escapeHtml(is.tieuDe)}</strong><small>${escapeHtml(is.moTa || '')}</small></span><span class="badge">${is.cauHoi.length}</span></summary>
        <ol>${is.cauHoi.map((c) => `<li><p>${escapeHtml(c.text)}</p><small><em class="q-buoc buoc-${c.buoc}">${BUOC[c.buoc] || ''}</em>${escapeHtml(c.lyDo || '')}</small></li>`).join('')}</ol>
      </details>`,
      )
      .join('');
  const sumHtml = () => {
    const s = result.summary;
    return `<div class="ns-sum">
      <span><strong>${s.prev}</strong> biên bản trước</span>
      <span><strong>${s.answered}</strong> lượt đã trả lời</span>
      <span class="${s.clarify ? 'warn' : ''}"><strong>${s.clarify}</strong> điểm cần làm rõ</span>
      <span><strong>${s.open}</strong> câu kế hoạch còn bỏ ngỏ</span>
      <span class="${s.signs ? 'warn' : ''}"><strong>${s.signs}</strong> dấu hiệu định tội chưa rõ</span>
      <span class="${s.contra ? 'bad' : ''}"><strong>${s.contra}</strong> câu đối chiếu mâu thuẫn</span>
    </div>`;
  };

  ctx.modal(
    `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
    <h2 class="modal-title">Ghi lời khai lần ${result.summary.lan}: ${escapeHtml(who)}</h2>
    <p class="hint">${escapeHtml(getRole(roleId).ten.split('/')[0].trim())}${caseItem ? ` · ${escapeHtml(caseItem.ten)}` : ''}. Hệ thống đã đọc ${prev.length} biên bản trước (${prev.map((r) => `lần ${r.lan || 1}${r.ngay ? ` ngày ${r.ngay.split('-').reverse().join('/')}` : ''}`).join(', ')}) và lập câu hỏi theo trình tự: xác nhận lời khai cũ → làm rõ chi tiết đã khai → nội dung còn bỏ ngỏ → dấu hiệu định tội → đối chiếu mâu thuẫn → chốt lại. Mỗi câu có ghi lý do cần hỏi.</p>
    <div data-ns-sum>${sumHtml()}</div>
    <div class="ns-groups" data-ns-groups>${groupsHtml()}</div>
    <div class="ns-opts">
      <label class="check"><input type="checkbox" data-ns-prefill checked />Đưa sẵn các câu hỏi đã chọn vào biên bản (chưa trả lời) — xuất Word làm phiếu hỏi được</label>
      ${ctx.hasAI('legal') ? `<button class="btn btn-sm" type="button" data-ns-ai>${icon('sparkles', 'ic-sm')}AI đề xuất thêm câu hỏi</button>` : `<small class="hint">${ctx.can('legal.ai') ? 'Thêm API key (hoặc AI trên máy) trong Cài đặt để AI đề xuất thêm câu hỏi.' : 'Câu hỏi được lập trên máy, không gửi dữ liệu ra ngoài.'}</small>`}
    </div>
    <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="button" data-ns-start>${icon('message', 'ic-sm')}Bắt đầu lời khai lần ${result.summary.lan}</button></div>`,
    {
      className: 'modal-wide ns-modal',
      label: 'Ghi lời khai lần tiếp theo',
      onMount(box, close) {
        const redraw = () => {
          $('[data-ns-sum]', box).innerHTML = sumHtml();
          $('[data-ns-groups]', box).innerHTML = groupsHtml();
        };
        box.addEventListener('change', (e) => {
          const g = e.target.closest('[data-g-on]');
          if (g) g.checked ? off.delete(g.dataset.gOn) : off.add(g.dataset.gOn);
        });
        $('[data-ns-ai]', box)?.addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          const ai = ctx.ai('legal');
          btn.disabled = true;
          btn.innerHTML = `${icon('refresh', 'ic-sm spin')}AI đang đọc các biên bản…`;
          try {
            const out = await streamClaude({ provider: ai.provider, apiKey: ai.apiKey, model: ai.model, system: INVESTIGATOR_SYSTEM, effort: 'medium', maxTokens: 4000, messages: [{ role: 'user', content: followUpPrompt({ prev, others, crime: result.plan.crime, role: getRole(roleId), plan: result.plan, max: ctxFor(ai, 22000, 8000) }) }] });
            const list = (extractJson(out)?.cauHoi || []).map((x) => (typeof x === 'string' ? { text: x } : x)).filter((x) => x?.text?.trim());
            if (!list.length) throw new Error('AI không trả về câu hỏi đúng định dạng');
            extra = list.map((x) => ({ text: x.text.trim(), lyDo: x.lyDo ? `AI: ${x.lyDo}` : 'AI đề xuất.', buoc: BUOC[x.buoc] ? x.buoc : 'cu-the', src: 'ai' }));
            result = followUpPlan({ prev, others, base, dieu, roleId, extra, lan });
            redraw();
            $('[data-g="bo-sung"]', box)?.setAttribute('open', '');
            toast(`AI đề xuất thêm ${extra.length} câu hỏi (nhóm “Câu hỏi bổ sung”)`);
            btn.innerHTML = `${icon('sparkles', 'ic-sm')}AI đề xuất lại`;
          } catch (err) {
            toast(`${err.message} — vẫn dùng bộ câu hỏi lập trên máy`, { type: 'error', timeout: 5000 });
            btn.innerHTML = `${icon('sparkles', 'ic-sm')}AI đề xuất thêm câu hỏi`;
          } finally {
            btn.disabled = false;
          }
        });
        $('[data-ns-start]', box).addEventListener('click', () => {
          const plan = { ...result.plan, issues: result.plan.issues.filter((is) => !off.has(is.key)) };
          plan.stats = { issues: plan.issues.length, questions: plan.issues.reduce((s, i) => s + i.cauHoi.length, 0) };
          if (!plan.issues.length) return toast('Chọn ít nhất một nhóm câu hỏi', { type: 'error' });
          const rec = newRecord({ caseItem, person, roleId, plan, settings: ctx.settings() });
          rec.roleId = roleId;
          // Giữ nhân thân đã ghi ở lần trước (đầy đủ hơn danh sách người tham gia nếu có).
          rec.nguoiKhai = { ...(last.nguoiKhai || {}), ...Object.fromEntries(Object.entries(rec.nguoiKhai || {}).filter(([, v]) => String(v || '').trim())) };
          rec.lan = result.summary.lan;
          rec.planId = saved?.id || last.planId || null;
          rec.followUp = { from: prev.map((r) => r.id), at: Date.now() };
          if (!rec.plan.dieu && dieu) rec.plan.dieu = String(dieu);
          if ($('[data-ns-prefill]', box).checked) prefillQa(rec, uid);
          const out = recordsRepo.save(rec);
          close();
          toast(`Đã lập biên bản lần ${rec.lan} với ${plan.stats.questions} câu hỏi làm rõ`);
          ctx.navigate(`#interview/${out.id}`);
        });
      },
    },
  );
}
