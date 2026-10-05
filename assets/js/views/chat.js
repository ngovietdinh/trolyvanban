// Trợ lý AI dạng hội thoại: Claude (streaming) hoặc trợ lý cơ bản chạy cục bộ.
import { $, icon, toast, escapeHtml, copyText, renderMarkdown } from '../ui.js';
import { store, usage } from '../lib/store.js';
import { streamClaude, localChat, composePrompt, extractJson, localCompose } from '../lib/ai.js';
import { DOC_TYPES, getDocType } from '../lib/doc-types.js';

const SUGGESTIONS = [
  { icon: 'mail', title: 'Soạn công văn', text: 'Soạn công văn về việc đề nghị báo cáo kết quả chuyển đổi số quý III' },
  { icon: 'ticket', title: 'Soạn giấy mời', text: 'Soạn giấy mời họp sơ kết công tác 9 tháng đầu năm' },
  { icon: 'hash', title: 'Đọc số tiền', text: 'Đọc số 1.250.000.000 thành chữ' },
  { icon: 'book', title: 'Hỏi về thể thức', text: 'Căn lề văn bản hành chính theo Nghị định 30 là bao nhiêu?' },
];

function detectCompose(text) {
  const lower = text.toLocaleLowerCase('vi-VN');
  if (!/(soạn|viết|lập|làm|tạo)/.test(lower)) return null;
  return DOC_TYPES.find((t) => lower.includes(t.name.toLocaleLowerCase('vi-VN'))) || null;
}

export function render(ctx) {
  let messages = store.get('chat', []);
  let controller = null;

  ctx.view.innerHTML = `
  <div class="chat">
    <div class="chat-scroll" data-scroll><div class="chat-inner" data-list></div></div>
    <div class="chat-composer">
      <form class="composer-box" data-composer>
        <textarea rows="1" placeholder="Nhập yêu cầu… (Enter để gửi, Shift + Enter xuống dòng)" aria-label="Tin nhắn" data-input></textarea>
        <button class="btn btn-ghost btn-icon" type="button" title="Cuộc trò chuyện mới" aria-label="Cuộc trò chuyện mới" data-new>${icon('plus')}</button>
        <button class="btn btn-primary btn-icon" type="submit" aria-label="Gửi" data-send>${icon('send')}</button>
      </form>
      <p class="composer-note">${ctx.hasAI() ? `Đang dùng <strong>${escapeHtml(ctx.settings().model)}</strong>. AI có thể sai sót — hãy rà soát trước khi ban hành.` : 'Chế độ cơ bản — <a class="link" href="#settings">thêm API key</a> để trò chuyện tự do với AI Claude.'}</p>
    </div>
  </div>`;

  const list = $('[data-list]', ctx.view);
  const scroller = $('[data-scroll]', ctx.view);
  const input = $('[data-input]', ctx.view);
  const sendBtn = $('[data-send]', ctx.view);

  const persist = () => store.set('chat', messages.slice(-60));
  const scrollDown = () => (scroller.scrollTop = scroller.scrollHeight);

  function msgHtml(m, i) {
    if (m.role === 'user') {
      return `<div class="msg user"><span class="msg-avatar">${icon('user', 'ic-sm')}</span><div class="msg-body"><div class="msg-content">${escapeHtml(m.content)}</div></div></div>`;
    }
    const action = m.action?.tool === 'compose' ? `<button class="btn btn-sm btn-primary" type="button" data-open="${i}">${icon('file', 'ic-sm')}Mở trong trình soạn thảo</button>` : m.action?.tool && m.action.tool !== 'compose' ? `<a class="btn btn-sm" href="#${m.action.tool}">${icon('arrow-right', 'ic-sm')}Mở công cụ</a>` : '';
    return `<div class="msg bot"><span class="msg-avatar">VB</span><div class="msg-body">
      <div class="msg-content">${m.pending && !m.content ? '<span class="typing"><span></span><span></span><span></span></span>' : renderMarkdown(m.content)}</div>
      ${m.pending ? '' : `<div class="msg-tools">${action}<button class="btn btn-ghost btn-sm" type="button" data-copy="${i}">${icon('copy', 'ic-sm')}Sao chép</button></div>`}
    </div></div>`;
  }

  function renderList() {
    if (!messages.length) {
      list.innerHTML = `
        <div class="chat-welcome">
          <span class="logo-mark seal-xl">VB</span>
          <h1>Tôi có thể giúp gì cho bạn?</h1>
          <p>Soạn thảo, rà soát, tóm tắt văn bản hay giải đáp thể thức — chỉ cần hỏi.</p>
          <div class="suggest-grid">
            ${SUGGESTIONS.map((s) => `<button class="suggest" type="button" data-suggest="${escapeHtml(s.text)}">${icon(s.icon)}<span><strong>${s.title}</strong>${escapeHtml(s.text)}</span></button>`).join('')}
          </div>
        </div>`;
      return;
    }
    list.innerHTML = messages.map(msgHtml).join('');
    scrollDown();
  }

  function updateLast() {
    const last = list.lastElementChild;
    const i = messages.length - 1;
    if (last) last.outerHTML = msgHtml(messages[i], i);
    scrollDown();
  }

  function setBusy(busy) {
    sendBtn.innerHTML = busy ? icon('stop') : icon('send');
    sendBtn.setAttribute('aria-label', busy ? 'Dừng' : 'Gửi');
    sendBtn.type = busy ? 'button' : 'submit';
  }

  async function send(text) {
    text = text.trim();
    if (!text || controller) return;
    usage.track('chat');
    messages.push({ role: 'user', content: text });
    const bot = { role: 'assistant', content: '', pending: true };
    messages.push(bot);
    renderList();
    input.value = '';
    input.style.height = 'auto';

    const type = detectCompose(text);
    if (!ctx.hasAI()) {
      const r = localChat(text);
      bot.content = r.text;
      bot.action = r.action;
      bot.pending = false;
      persist();
      updateLast();
      return;
    }

    const { apiKey, model } = ctx.settings();
    controller = new AbortController();
    setBusy(true);
    try {
      if (type) {
        const out = await streamClaude({
          apiKey,
          model,
          signal: controller.signal,
          messages: [{ role: 'user', content: composePrompt(type.id, text) }],
          onText: (_, all) => {
            bot.content = `_Đang soạn ${type.name.toLowerCase()}… (${all.length} ký tự)_`;
            updateLast();
          },
        });
        const draft = extractJson(out) || localCompose(type.id, text);
        bot.content = `Tôi đã soạn bản nháp **${type.name}** với trích yếu: *${draft.trichYeu || ''}*.\n\n${Array.isArray(draft.noiDung) ? draft.noiDung.join('\n') : draft.noiDung}\n\nNhấn **Mở trong trình soạn thảo** để hoàn thiện thể thức và xuất Word.`;
        bot.action = { tool: 'compose', typeId: type.id, draft };
      } else {
        const history = messages
          .filter((m) => !m.pending && m.content)
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content }));
        await streamClaude({
          apiKey,
          model,
          signal: controller.signal,
          messages: history,
          onText: (_, all) => {
            bot.content = all;
            updateLast();
          },
        });
      }
    } catch (err) {
      bot.content = (bot.content && !bot.content.startsWith('_Đang') ? bot.content + '\n\n' : '') + `⚠️ ${err.message}`;
    } finally {
      bot.pending = false;
      controller = null;
      setBusy(false);
      persist();
      updateLast();
    }
  }

  list.addEventListener('click', async (e) => {
    const sug = e.target.closest('[data-suggest]');
    if (sug) return send(sug.dataset.suggest);
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      await copyText(messages[+cp.dataset.copy].content);
      return toast('Đã sao chép câu trả lời');
    }
    const op = e.target.closest('[data-open]');
    if (op) {
      const a = messages[+op.dataset.open].action;
      if (!getDocType(a.typeId)) return;
      ctx.handoff = { compose: { typeId: a.typeId, draft: a.draft } };
      ctx.navigate(`#compose/${a.typeId}`);
    }
  });

  $('[data-composer]', ctx.view).addEventListener('submit', (e) => {
    e.preventDefault();
    send(input.value);
  });
  sendBtn.addEventListener('click', () => {
    if (controller) controller.abort();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send(input.value);
    }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(200, input.scrollHeight)}px`;
  });
  $('[data-new]', ctx.view).addEventListener('click', async () => {
    if (!messages.length) return;
    if (!(await ctx.confirm('Xóa cuộc trò chuyện hiện tại và bắt đầu mới?', { title: 'Cuộc trò chuyện mới', okText: 'Bắt đầu mới' }))) return;
    controller?.abort();
    messages = [];
    persist();
    renderList();
    input.focus();
  });

  renderList();
  input.focus();

  if (ctx.handoff?.chatPrompt) {
    const p = ctx.handoff.chatPrompt;
    ctx.handoff = null;
    send(p);
  }

  return () => controller?.abort();
}
