// “Tạo văn bản chuẩn” từ một câu trả lời AI: chọn loại văn bản (NĐ 30/2020), trích yếu → mở trình soạn thảo
// với nội dung đã điền sẵn đúng thể thức. Có AI thì chuẩn hóa nội dung theo cấu trúc loại văn bản.
import { $, $$, icon, toast, escapeHtml } from '../ui.js';
import { DOC_TYPES, getDocType } from '../lib/doc-types.js';
import { streamClaude, composePrompt, extractJson } from '../lib/ai.js';

/** Bỏ định dạng Markdown, giữ đề mục, đánh số, gạch đầu dòng. */
export function mdToPlain(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, ''))
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[*•]\s+/gm, '- ')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\|?\s*-{3,}.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const KEYWORDS = {
  'quyet-dinh': /quyết định|điều 1\.|bổ nhiệm|thành lập|ban hành kèm theo/i,
  'to-trinh': /tờ trình|kính trình|đề nghị (phê duyệt|xem xét)|xin chủ trương/i,
  'bao-cao': /báo cáo|kết quả đạt được|tồn tại, hạn chế|phương hướng/i,
  'thong-bao': /thông báo/i,
  'ke-hoach': /kế hoạch|mục đích, yêu cầu|tổ chức thực hiện/i,
  'giay-moi': /giấy mời|trân trọng kính mời|kính mời/i,
  'bien-ban': /biên bản|thành phần tham dự|cuộc họp kết thúc/i,
  'cong-van': /công văn|kính gửi|đề nghị quý/i,
};

/** Đoán loại văn bản phù hợp từ câu hỏi và câu trả lời. */
export function guessDocType(question = '', answer = '') {
  const q = String(question);
  for (const t of DOC_TYPES) if (new RegExp(`(soạn|viết|lập|làm|tạo)[^.\\n]{0,20}${t.name}`, 'i').test(q)) return t.id;
  const text = `${q}\n${answer}`;
  let best = 'cong-van';
  let score = 0;
  for (const [id, re] of Object.entries(KEYWORDS)) {
    const n = (text.match(new RegExp(re.source, 'gi')) || []).length;
    if (n > score) {
      score = n;
      best = id;
    }
  }
  return best;
}

/** Gợi ý trích yếu từ câu hỏi (bỏ “soạn công văn về việc …”) hoặc dòng đầu câu trả lời. */
export function guessTrichYeu(question = '', answer = '') {
  const q = String(question)
    .trim()
    .replace(/[.?!]+$/, '')
    .replace(/^(hãy\s+)?(soạn|viết|lập|làm|tạo|giúp tôi soạn)\s+(giúp\s+)?(một\s+)?(bản\s+)?(công văn|quyết định|tờ trình|báo cáo|thông báo|kế hoạch|giấy mời|biên bản|văn bản)?\s*(về việc|về|v\/v)?\s*/i, '');
  if (q && q.length <= 140) return q;
  const first = mdToPlain(answer).split('\n').find((l) => l.trim().length > 8) || '';
  return first.replace(/^(V\/v|Về việc)\s*/i, '').slice(0, 120);
}

/**
 * Mở hộp thoại tạo văn bản chuẩn.
 * @param ctx
 * @param {string} answer  nội dung câu trả lời (Markdown)
 * @param {{ question?: string }} opts
 */
export function openMakeDoc(ctx, answer, { question = '' } = {}) {
  if (!ctx.can('docs')) return toast('Tài khoản chưa được cấp quyền soạn văn bản hành chính', { type: 'error' });
  const typeId = guessDocType(question, answer);
  const trich = guessTrichYeu(question, answer);
  const hasAI = ctx.hasAI();
  ctx.modal(
    `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
     <h2 class="modal-title">Tạo văn bản chuẩn</h2>
     <p class="hint" style="margin-bottom:14px">Đưa nội dung câu trả lời vào trình soạn thảo theo đúng thể thức Nghị định 30/2020 — sửa tiếp, xem trước A4 và xuất Word.</p>
     <form data-mk novalidate>
       <div class="field"><span class="label">Loại văn bản</span>
         <div class="mk-types" role="radiogroup" aria-label="Loại văn bản">${DOC_TYPES.map((t) => `<label class="mk-type"><input type="radio" name="type" value="${t.id}" ${t.id === typeId ? 'checked' : ''} />${icon(t.icon, 'ic-sm')}<span>${t.name}</span></label>`).join('')}</div>
       </div>
       <div class="field"><label for="mk-trich">Trích yếu (V/v…)</label><input class="input" id="mk-trich" name="trich" value="${escapeHtml(trich)}" placeholder="vd: đề nghị báo cáo kết quả chuyển đổi số quý III" /></div>
       <label class="check" ${hasAI ? '' : 'title="Cần quyền AI và API key"'}><input type="checkbox" name="ai" ${hasAI ? 'checked' : 'disabled'} />AI chuẩn hóa nội dung theo cấu trúc loại văn bản (khuyên dùng)</label>
       <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit" data-go>${icon('file', 'ic-sm')}Mở trong trình soạn thảo</button></div>
     </form>`,
    {
      label: 'Tạo văn bản chuẩn',
      onMount(box, close) {
        const f = $('[data-mk]', box);
        f.addEventListener('submit', async (e) => {
          e.preventDefault();
          const typeId = f.type.value;
          const type = getDocType(typeId);
          const trichYeu = f.trich.value.trim();
          let draft = { trichYeu, noiDung: mdToPlain(answer) };
          if (f.ai.checked && ctx.hasAI()) {
            const btn = $('[data-go]', box);
            btn.disabled = true;
            btn.innerHTML = `<span class="typing"><span></span><span></span><span></span></span>Đang chuẩn hóa…`;
            try {
              const out = await streamClaude({
                ...ctx.ai(),
                cache: true,
                messages: [{ role: 'user', content: composePrompt(typeId, `Chuyển nội dung dưới đây thành ${type.name.toLowerCase()} đúng thể thức, giữ nguyên ý chính và số liệu${trichYeu ? `; trích yếu: ${trichYeu}` : ''}:\n\n${mdToPlain(answer)}`, ctx.settings().org || {}) }],
              });
              const j = extractJson(out);
              if (j?.noiDung) draft = { ...j, trichYeu: trichYeu || j.trichYeu };
            } catch (err) {
              toast(`AI chưa chuẩn hóa được (${err.message}) — dùng nguyên nội dung câu trả lời`, { type: 'info', timeout: 5000 });
            }
          }
          close();
          ctx.handoff = { compose: { typeId, draft } };
          ctx.navigate(`#compose/${typeId}`);
        });
        $$('.mk-type input', box).forEach((r) => r.addEventListener('change', () => r.closest('.mk-type').parentElement.querySelectorAll('.mk-type').forEach((l) => l.classList.toggle('on', l.querySelector('input').checked))));
        $$('.mk-type', box).forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
      },
    },
  );
}
