// Trợ lý AI dạng hội thoại: nhiều cuộc trò chuyện (lịch sử, xóa từng cuộc / tất cả), sao chép, tạo văn bản chuẩn.
import { $, $$, icon, toast, escapeHtml, copyText, renderMarkdown, debounce } from '../ui.js';
import { store, usage, uid } from '../lib/store.js';
import { streamClaude, localChat, composePrompt, extractJson, localCompose } from '../lib/ai.js';
import { isTight, chunkSizeFor } from '../lib/ai-chunk.js';
import { DOC_TYPES, getDocType } from '../lib/doc-types.js';
import { relativeTime } from '../lib/vn-date.js';
import { deleteWithUndo } from '../lib/undo-delete.js';
import { openMakeDoc } from './make-doc.js';

const SUGGESTIONS = [
  { icon: 'mail', title: 'Soạn công văn', text: 'Soạn công văn về việc đề nghị báo cáo kết quả chuyển đổi số quý III' },
  { icon: 'ticket', title: 'Soạn giấy mời', text: 'Soạn giấy mời họp sơ kết công tác 9 tháng đầu năm' },
  { icon: 'hash', title: 'Đọc số tiền', text: 'Đọc số 1.250.000.000 thành chữ' },
  { icon: 'book', title: 'Hỏi về thể thức', text: 'Căn lề văn bản hành chính theo Nghị định 30 là bao nhiêu?' },
];
const MAX_THREADS = 50;
const MAX_MSGS = 80;

function detectCompose(text) {
  const lower = text.toLocaleLowerCase('vi-VN');
  if (!/(soạn|viết|lập|làm|tạo)/.test(lower)) return null;
  return DOC_TYPES.find((t) => lower.includes(t.name.toLocaleLowerCase('vi-VN'))) || null;
}

/* ---------------- Lưu trữ cuộc trò chuyện ---------------- */
export const chatStore = {
  all() {
    let threads = store.get('chat-threads', null);
    if (!threads) {
      // Chuyển dữ liệu kiểu cũ (một cuộc trò chuyện) sang danh sách cuộc trò chuyện.
      const legacy = store.get('chat', []);
      threads = legacy.length ? [{ id: uid(), title: titleOf(legacy), createdAt: Date.now(), updatedAt: Date.now(), messages: legacy }] : [];
      store.set('chat-threads', threads);
      store.set('chat', []);
    }
    return threads.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  save(threads) {
    store.set('chat-threads', threads.slice(0, MAX_THREADS).map((t) => ({ ...t, messages: t.messages.filter((m) => !m.pending).slice(-MAX_MSGS) })));
  },
};
function titleOf(messages) {
  const first = messages.find((m) => m.role === 'user')?.content || 'Cuộc trò chuyện mới';
  return first.length > 60 ? first.slice(0, 57) + '…' : first;
}

export function render(ctx) {
  let threads = chatStore.all();
  let currentId = store.get('chat-current', null);
  if (!threads.some((t) => t.id === currentId)) currentId = threads[0]?.id || null;
  let controller = null;
  let q = '';
  const current = () => threads.find((t) => t.id === currentId) || null;
  const messages = () => current()?.messages || [];

  ctx.view.innerHTML = `
  <div class="chat-wrap">
    <aside class="chat-history" aria-label="Lịch sử trò chuyện">
      <div class="ch-head">
        <button class="btn btn-primary ch-new" type="button" data-new>${icon('plus', 'ic-sm')}Cuộc trò chuyện mới</button>
        <div class="lg-search ch-search">${icon('search', 'ic-sm')}<input type="search" placeholder="Tìm trong lịch sử…" aria-label="Tìm cuộc trò chuyện" data-hq /></div>
      </div>
      <nav class="ch-list" data-threads></nav>
      <div class="ch-foot"><button class="btn btn-ghost btn-sm" type="button" data-clear-all>${icon('trash', 'ic-sm')}Xóa toàn bộ lịch sử</button></div>
    </aside>
    <div class="chat">
      <div class="chat-bar">
        <button class="btn btn-ghost btn-sm" type="button" data-history-open>${icon('clock', 'ic-sm')}Lịch sử <span class="sb-count" data-thread-n></span></button>
        <strong class="chat-title" data-title></strong>
        <button class="btn btn-ghost btn-sm btn-icon" type="button" data-del-thread aria-label="Xóa cuộc trò chuyện này" title="Xóa cuộc trò chuyện này">${icon('trash', 'ic-sm')}</button>
      </div>
      <div class="chat-scroll" data-scroll><div class="chat-inner" data-list></div></div>
      <div class="chat-composer">
        <form class="composer-box" data-composer>
          <textarea rows="1" data-ph-short="Nhập yêu cầu…" placeholder="Nhập yêu cầu… (Enter để gửi, Shift + Enter xuống dòng)" aria-label="Tin nhắn" data-input></textarea>
          <button class="btn btn-ghost btn-icon" type="button" title="Cuộc trò chuyện mới" aria-label="Cuộc trò chuyện mới" data-new>${icon('plus')}</button>
          <button class="btn btn-primary btn-icon" type="submit" aria-label="Gửi" data-send>${icon('send')}</button>
        </form>
        <p class="composer-note">${ctx.hasAI() ? `Đang dùng <strong>${escapeHtml(ctx.ai().label)} · ${escapeHtml(ctx.ai().model)}</strong>. AI có thể sai sót — hãy rà soát trước khi ban hành.` : ctx.can('ai') ? 'Chế độ cơ bản — <a class="link" href="#settings">thêm API key</a> (ChatGPT, Gemini, Grok, Groq hoặc Claude) để trò chuyện tự do với AI.' : 'Chế độ cơ bản — tài khoản chưa được cấp quyền dùng AI trực tuyến.'}</p>
      </div>
    </div>
  </div>`;

  const root = ctx.view;
  const list = $('[data-list]', root);
  const scroller = $('[data-scroll]', root);
  const input = $('[data-input]', root);
  const sendBtn = $('[data-send]', root);

  const persist = () => {
    chatStore.save(threads);
    store.set('chat-current', currentId);
  };
  const scrollDown = () => (scroller.scrollTop = scroller.scrollHeight);

  /* ---------------- Lịch sử ---------------- */
  function threadsHtml(compact = false) {
    const n = q.trim().toLocaleLowerCase('vi-VN');
    const shown = threads.filter((t) => !n || (t.title + ' ' + t.messages.map((m) => m.content).join(' ')).toLocaleLowerCase('vi-VN').includes(n));
    if (!threads.length) return `<p class="ch-empty">Chưa có cuộc trò chuyện nào.</p>`;
    if (!shown.length) return `<p class="ch-empty">Không tìm thấy cuộc trò chuyện phù hợp.</p>`;
    return shown
      .map(
        (t) => `<div class="ch-item ${t.id === currentId ? 'active' : ''}" data-thread="${t.id}">
          <button type="button" class="ch-open" data-open-thread="${t.id}" ${t.id === currentId ? 'aria-current="true"' : ''}><strong>${escapeHtml(t.title)}</strong><small>${relativeTime(t.updatedAt)} · ${t.messages.filter((m) => m.role === 'user').length} câu hỏi</small></button>
          <button type="button" class="btn btn-ghost btn-sm btn-icon ch-del" data-del-thread-id="${t.id}" aria-label="Xóa cuộc trò chuyện “${escapeHtml(t.title)}”" title="Xóa">${icon('trash', 'ic-sm')}</button>
        </div>`,
      )
      .join('');
  }
  function renderThreads() {
    $('[data-threads]', root).innerHTML = threadsHtml();
    $('[data-thread-n]', root).textContent = threads.length || '';
    $('[data-clear-all]', root).hidden = !threads.length;
    const t = current();
    $('[data-title]', root).textContent = t ? t.title : 'Cuộc trò chuyện mới';
    $('[data-del-thread]', root).hidden = !t;
  }

  function openThread(id) {
    if (controller) controller.abort();
    currentId = id;
    persist();
    renderThreads();
    renderList();
  }
  function newThread() {
    if (controller) controller.abort();
    // Cuộc hiện tại còn trống thì dùng lại.
    if (current() && !current().messages.length) return input.focus();
    currentId = null;
    persist();
    renderThreads();
    renderList();
    input.focus();
  }
  async function deleteThreads(ids, { all = false } = {}) {
    const items = threads.filter((t) => ids.includes(t.id));
    const before = currentId;
    await deleteWithUndo(ctx, {
      title: all ? 'Xóa toàn bộ lịch sử' : 'Xóa cuộc trò chuyện',
      message: all ? `Xóa toàn bộ ${items.length} cuộc trò chuyện? Có thể hoàn tác ngay sau khi xóa.` : `Xóa cuộc trò chuyện “${items[0]?.title}”? Có thể hoàn tác ngay sau khi xóa.`,
      items: items.map((item) => ({
        item,
        remove: (x) => (threads = threads.filter((t) => t.id !== x.id)),
        restore: (x) => (threads = [...threads.filter((t) => t.id !== x.id), x].sort((a, b) => b.updatedAt - a.updatedAt)),
      })),
      after: (undone) => {
        if (controller && ids.includes(currentId)) controller.abort();
        if (undone) currentId = before;
        else if (ids.includes(currentId)) currentId = threads[0]?.id || null;
        persist();
        renderThreads();
        renderList();
      },
    });
  }

  /* ---------------- Tin nhắn ---------------- */
  function msgHtml(m, i) {
    const del = `<button class="btn btn-ghost btn-sm btn-icon" type="button" data-del-msg="${i}" aria-label="Xóa tin nhắn" title="Xóa tin nhắn">${icon('trash', 'ic-sm')}</button>`;
    if (m.role === 'user') {
      return `<div class="msg user"><span class="msg-avatar">${icon('user', 'ic-sm')}</span><div class="msg-body"><div class="msg-content">${escapeHtml(m.content)}</div>
        <div class="msg-tools msg-tools-user"><button class="btn btn-ghost btn-sm btn-icon" type="button" data-copy="${i}" aria-label="Sao chép câu hỏi" title="Sao chép">${icon('copy', 'ic-sm')}</button>${del}</div></div></div>`;
    }
    const action = m.action?.tool === 'compose' ? `<button class="btn btn-sm btn-primary" type="button" data-open="${i}">${icon('file', 'ic-sm')}Mở trong trình soạn thảo</button>` : m.action?.tool && m.action.tool !== 'compose' ? `<a class="btn btn-sm" href="#${m.action.tool}">${icon('arrow-right', 'ic-sm')}Mở công cụ</a>` : '';
    const makeDoc = m.action?.tool || !ctx.can('docs') ? '' : `<button class="btn btn-sm" type="button" data-make="${i}">${icon('file', 'ic-sm')}Tạo văn bản chuẩn</button>`;
    return `<div class="msg bot"><span class="msg-avatar">VB</span><div class="msg-body">
      <div class="msg-content">${m.pending && !m.content ? '<span class="typing"><span></span><span></span><span></span></span>' : renderMarkdown(m.content)}</div>
      ${m.pending ? '' : `<div class="msg-tools">${action}${makeDoc}<button class="btn btn-ghost btn-sm" type="button" data-copy="${i}">${icon('copy', 'ic-sm')}Sao chép</button>${del}</div>`}
    </div></div>`;
  }

  function renderList() {
    const msgs = messages();
    if (!msgs.length) {
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
    list.innerHTML = msgs.map(msgHtml).join('');
    scrollDown();
  }

  function updateLast() {
    const last = list.lastElementChild;
    const msgs = messages();
    const i = msgs.length - 1;
    if (last && msgs[i]) last.outerHTML = msgHtml(msgs[i], i);
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
    let t = current();
    if (!t) {
      t = { id: uid(), title: '', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
      threads.unshift(t);
      currentId = t.id;
    }
    t.messages.push({ role: 'user', content: text });
    if (!t.title) t.title = titleOf(t.messages);
    t.updatedAt = Date.now();
    const bot = { role: 'assistant', content: '', pending: true };
    t.messages.push(bot);
    persist();
    renderThreads();
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

    const { provider, apiKey, model } = ctx.ai();
    controller = new AbortController();
    setBusy(true);
    try {
      if (type) {
        const out = await streamClaude({
          provider,
          apiKey,
          model,
          signal: controller.signal,
          messages: [{ role: 'user', content: composePrompt(type.id, text) }],
          onText: (_, all) => {
            bot.content = `_Đang soạn ${type.name.toLowerCase()}… (${all.length} ký tự)_`;
            if (currentId === t.id) updateLast();
          },
        });
        const draft = extractJson(out) || localCompose(type.id, text);
        bot.content = `Tôi đã soạn bản nháp **${type.name}** với trích yếu: *${draft.trichYeu || ''}*.\n\n${Array.isArray(draft.noiDung) ? draft.noiDung.join('\n') : draft.noiDung}\n\nNhấn **Mở trong trình soạn thảo** để hoàn thiện thể thức và xuất Word.`;
        bot.action = { tool: 'compose', typeId: type.id, draft };
      } else {
        let history = t.messages
          .filter((m) => !m.pending && m.content)
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content }));
        // Groq / AI trên máy: chỉ gửi phần lịch sử gần nhất vừa hạn mức (Groq miễn phí ~8K token/phút).
        if (isTight(ctx.ai())) {
          const budget = chunkSizeFor(ctx.ai()) * 3;
          let used = 0;
          let keep = history.length;
          while (keep > 0 && used + history[keep - 1].content.length <= budget) used += history[--keep].content.length;
          history = history.slice(Math.min(keep, history.length - 1));
          if (history[0]?.role === 'assistant') history = history.slice(1);
          const last = history[history.length - 1];
          if (last && last.content.length > budget) history = [{ ...last, content: last.content.slice(0, budget) }];
        }
        await streamClaude({
          provider,
          apiKey,
          model,
          signal: controller.signal,
          messages: history,
          onText: (_, all) => {
            bot.content = all;
            if (currentId === t.id) updateLast();
          },
        });
      }
    } catch (err) {
      bot.content = (bot.content && !bot.content.startsWith('_Đang') ? bot.content + '\n\n' : '') + `⚠️ ${err.message}`;
    } finally {
      bot.pending = false;
      controller = null;
      setBusy(false);
      t.updatedAt = Date.now();
      if (threads.includes(t)) persist();
      if (currentId === t.id) updateLast();
      renderThreads();
    }
  }

  /* ---------------- Sự kiện ---------------- */
  list.addEventListener('click', async (e) => {
    const msgs = messages();
    const sug = e.target.closest('[data-suggest]');
    if (sug) return send(sug.dataset.suggest);
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      await copyText(msgs[+cp.dataset.copy].content);
      return toast(msgs[+cp.dataset.copy].role === 'user' ? 'Đã sao chép câu hỏi' : 'Đã sao chép câu trả lời');
    }
    const mk = e.target.closest('[data-make]');
    if (mk) {
      const i = +mk.dataset.make;
      const question = [...msgs.slice(0, i)].reverse().find((m) => m.role === 'user')?.content || '';
      return openMakeDoc(ctx, msgs[i].content, { question });
    }
    const dm = e.target.closest('[data-del-msg]');
    if (dm) {
      const t = current();
      const i = +dm.dataset.delMsg;
      const m = t.messages[i];
      t.messages.splice(i, 1);
      persist();
      renderList();
      toast('Đã xóa tin nhắn', {
        timeout: 6000,
        action: {
          label: 'Hoàn tác',
          onClick: () => {
            t.messages.splice(i, 0, m);
            persist();
            if (currentId === t.id) renderList();
          },
        },
      });
      return;
    }
    const op = e.target.closest('[data-open]');
    if (op) {
      const a = msgs[+op.dataset.open].action;
      if (!getDocType(a.typeId)) return;
      ctx.handoff = { compose: { typeId: a.typeId, draft: a.draft } };
      ctx.navigate(`#compose/${a.typeId}`);
    }
  });

  const historyClick = (e, closeSheet) => {
    const o = e.target.closest('[data-open-thread]');
    if (o) {
      openThread(o.dataset.openThread);
      closeSheet?.();
      return;
    }
    const d = e.target.closest('[data-del-thread-id]');
    if (d) {
      closeSheet?.();
      deleteThreads([d.dataset.delThreadId]);
    }
  };
  $('[data-threads]', root).addEventListener('click', (e) => historyClick(e));
  $$('[data-new]', root).forEach((b) => b.addEventListener('click', newThread));
  $('[data-del-thread]', root).addEventListener('click', () => currentId && deleteThreads([currentId]));
  $('[data-clear-all]', root).addEventListener('click', () => deleteThreads(threads.map((t) => t.id), { all: true }));
  $('[data-hq]', root).addEventListener(
    'input',
    debounce((e) => {
      q = e.target.value;
      renderThreads();
    }, 120),
  );
  // Điện thoại: lịch sử mở dạng tấm trượt.
  $('[data-history-open]', root).addEventListener('click', () => {
    ctx.modal(
      `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
       <h2 class="modal-title">Lịch sử trò chuyện</h2>
       <div class="ch-list ch-list-sheet">${threadsHtml()}</div>
       <div class="modal-actions">${threads.length ? `<button class="btn" type="button" data-sheet-clear>${icon('trash', 'ic-sm')}Xóa tất cả</button>` : ''}<button class="btn btn-primary" type="button" data-sheet-new>${icon('plus', 'ic-sm')}Cuộc trò chuyện mới</button></div>`,
      {
        label: 'Lịch sử trò chuyện',
        onMount(box, close) {
          box.querySelector('.ch-list').addEventListener('click', (e) => historyClick(e, close));
          box.querySelector('[data-sheet-new]').addEventListener('click', () => {
            close();
            newThread();
          });
          box.querySelector('[data-sheet-clear]')?.addEventListener('click', () => {
            close();
            deleteThreads(threads.map((t) => t.id), { all: true });
          });
        },
      },
    );
  });

  $('[data-composer]', root).addEventListener('submit', (e) => {
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

  renderThreads();
  renderList();
  input.focus();

  if (ctx.handoff?.chatPrompt) {
    const p = ctx.handoff.chatPrompt;
    ctx.handoff = null;
    newThread();
    send(p);
  }

  return () => controller?.abort();
}
