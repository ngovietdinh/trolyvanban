// Kiểm tra chính tả – từ ngữ – dấu câu – thể thức; kiểm tra sâu bằng AI (ngữ pháp, dùng từ sai ngữ cảnh).
import { $, $$, icon, toast, escapeHtml, copyText, debounce } from '../ui.js';
import { checkText, applyFixes, fixAll, qualityScore, ISSUE_LABELS } from '../lib/spellcheck.js';
import { SPELL_AI_SYSTEM, spellAiPrompt, splitChunks, locateAiIssues, mergeIssues } from '../lib/spell-ai.js';
import { streamClaude, extractJson, PROVIDERS } from '../lib/ai.js';
import { store, usage } from '../lib/store.js';
import { docxToText } from '../lib/docx.js';

const SAMPLE =
  'Kính gửi  các phòng ban ,\nThực hiện chỉ đạo của UBND quận, đề nghị các đơn vị khẩn trương sử lý hồ sơ tồn đọng và bổ xung tài liệu còn thiếu. kết quả gửi về Văn phòng trước ngày 5 tháng 2 năm 2026.\nĐề nghị các đơn vị nghiêm túc thực hiện thực hiện, bảo đãm tiến độ. Ngưòi đứng đầu chịu trách nhiệm về viềc tổ chức thưc hiện cuả đơn vị mình, không để sự việc được diễn ra tái diễn lại.';

export function render(ctx) {
  let text = store.get('spell-text', '');
  let issues = [];
  let filter = 'all';
  let dict = new Set(store.get('spell-dict', []));
  const skipped = new Set(); // “Bỏ qua” trong phiên: type|original
  let aiRaw = []; // góp ý AI dạng { sai, sua, loai, giaiThich }
  let aiNote = null; // { text, provider, cached, count }
  let aiController = null;
  let aiProgress = '';
  const aiOk = () => ctx.hasAI();

  ctx.view.innerHTML = `
  <div class="page">
    <div class="page-head">
      <div><h1 class="page-title">Kiểm tra <em>chính tả</em></h1><p class="page-sub">Chính tả, từ không có nghĩa, dùng từ sai, dấu câu, viết hoa và thể thức theo NĐ 30/2020 — kiểm tra sâu bằng AI.</p></div>
      <div class="inline">
        <button class="btn" type="button" data-sample>${icon('wand', 'ic-sm')}Văn bản mẫu</button>
        <button class="btn" type="button" data-ai-check title="${aiOk() ? 'AI rà soát ngữ pháp, dùng từ sai ngữ cảnh, từ không có nghĩa' : 'Cần quyền AI và API key — xem Cài đặt'}">${icon('sparkles', 'ic-sm')}<span data-ai-label>Kiểm tra bằng AI</span></button>
        <button class="btn btn-primary" type="button" data-fixall>${icon('check', 'ic-sm')}Sửa tất cả</button>
      </div>
    </div>
    <div class="tool-grid">
      <section class="panel">
        <div class="panel-head"><h2>${icon('file', 'ic-sm')}Văn bản cần kiểm tra</h2>
          <div class="inline"><button class="btn btn-ghost btn-sm" type="button" data-copy>${icon('copy', 'ic-sm')}Sao chép</button><button class="btn btn-ghost btn-sm" type="button" data-clear>${icon('trash', 'ic-sm')}Xóa</button></div>
        </div>
        <div class="panel-body" style="display:grid;gap:14px">
          <label class="dropzone">
            <input type="file" accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" data-file aria-label="Tải lên tệp .docx hoặc .txt" />
            <span class="dz-icon">${icon('upload')}</span>
            <span><strong>Tải lên tệp .docx hoặc .txt</strong><small>Hoặc kéo thả tệp vào đây</small></span>
          </label>
          <textarea class="textarea" rows="12" placeholder="Dán hoặc nhập văn bản tại đây…" aria-label="Văn bản cần kiểm tra" data-input>${escapeHtml(text)}</textarea>
          <div class="score" data-score></div>
          <div class="spell-dict-bar"><span class="hint">${icon('book', 'ic-sm')}<span data-dict-n></span></span><button class="btn btn-ghost btn-sm" type="button" data-dict>Quản lý từ điển</button></div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>${icon('spell', 'ic-sm')}Kết quả</h2>
          <div class="chips" role="group" aria-label="Lọc loại lỗi" data-filters></div>
        </div>
        <div class="spell-ai" data-ai-box hidden></div>
        <div class="panel-body"><div class="spell-text" data-marked aria-live="polite"></div></div>
        <hr class="divider" />
        <ul class="issue-list" data-issues></ul>
      </section>
    </div>
  </div>`;

  const root = ctx.view;
  const input = $('[data-input]', root);
  const marked = $('[data-marked]', root);
  const issueList = $('[data-issues]', root);

  const keyOf = (it) => `${it.type}|${it.original.toLocaleLowerCase('vi-VN')}`;

  function computeIssues() {
    const local = checkText(text, { ignore: dict });
    const ai = locateAiIssues(text, aiRaw);
    return mergeIssues(local, ai).filter((it) => !skipped.has(keyOf(it)));
  }

  function renderAiBox() {
    const box = $('[data-ai-box]', root);
    if (aiController) {
      box.hidden = false;
      box.innerHTML = `<div class="spell-ai-run"><span class="typing"><span></span><span></span><span></span></span><span>AI đang rà soát văn bản${aiProgress ? ` (${aiProgress})` : ''}…</span></div>`;
      return;
    }
    if (!aiNote) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    const left = issues.filter((i) => i.ai).length;
    box.innerHTML = `<div class="spell-ai-note">
      <span class="quick-icon">${icon('sparkles', 'ic-sm')}</span>
      <div><strong>Nhận xét của AI</strong><p>${escapeHtml(aiNote.text || 'Đã rà soát xong.')}</p>
      <small>${aiNote.count} góp ý${left !== aiNote.count ? ` · còn ${left}` : ''} · ${escapeHtml(PROVIDERS[aiNote.provider]?.label || aiNote.provider || '')}${aiNote.cached ? ' · kết quả đã ghi nhớ' : ''}</small></div>
      <button class="btn btn-ghost btn-sm btn-icon" type="button" data-ai-clear aria-label="Bỏ góp ý của AI" title="Bỏ góp ý của AI">${icon('x', 'ic-sm')}</button>
    </div>`;
  }

  function renderAll() {
    text = input.value;
    store.set('spell-text', text);
    issues = computeIssues();
    const counts = issues.reduce((a, i) => ((a[i.type] = (a[i.type] || 0) + 1), a), {});
    const aiN = issues.filter((i) => i.ai).length;
    if (filter === 'ai' ? !aiN : filter !== 'all' && !counts[filter]) filter = 'all';
    $('[data-filters]', root).innerHTML = [['all', `Tất cả ${issues.length}`], ...Object.entries(ISSUE_LABELS).filter(([k]) => counts[k]).map(([k, l]) => [k, `${l} ${counts[k]}`]), ...(aiN ? [['ai', `AI ${aiN}`]] : [])]
      .map(([k, l]) => `<button class="chip" type="button" data-filter="${k}" aria-pressed="${filter === k}">${l}</button>`)
      .join('');

    // Văn bản có đánh dấu lỗi.
    let html = '';
    let pos = 0;
    issues.forEach((it) => {
      html += escapeHtml(text.slice(pos, it.start));
      const seg = escapeHtml(text.slice(it.start, it.end)).replace(/ /g, '&nbsp;') || '&nbsp;';
      html += `<mark class="err-mark t-${it.type}${it.ai ? ' is-ai' : ''}" data-id="${it.id}" title="${escapeHtml(it.message)}" tabindex="0">${seg}</mark>`;
      pos = it.end;
    });
    html += escapeHtml(text.slice(pos));
    marked.innerHTML = text.trim() ? html : '<span style="color:var(--text-3)">Kết quả kiểm tra sẽ hiển thị tại đây.</span>';

    const shown = issues.filter((i) => filter === 'all' || (filter === 'ai' ? i.ai : i.type === filter));
    issueList.innerHTML = shown.length
      ? shown.map(issueHtml).join('')
      : `<li class="empty"><div class="empty-icon">${icon('check-circle', 'ic-lg')}</div><h3>${text.trim() ? 'Không phát hiện lỗi' : 'Chưa có nội dung'}</h3><p>${text.trim() ? (aiNote ? 'Văn bản đã được kiểm tra trên máy và bằng AI.' : 'Bấm “Kiểm tra bằng AI” để rà soát sâu ngữ pháp, cách dùng từ.') : 'Nhập văn bản để bắt đầu kiểm tra.'}</p></li>`;

    const score = qualityScore(text, issues);
    const color = score >= 90 ? 'var(--success)' : score >= 70 ? 'var(--warning)' : 'var(--danger)';
    $('[data-score]', root).innerHTML = text.trim()
      ? `<div class="score-ring" style="--p:${score};--c:${color}"><span>${score}</span></div><div><strong>Điểm chất lượng văn bản</strong><small>${issues.length} vấn đề · ${text.trim().split(/\s+/).length} từ${aiNote ? ' · đã kiểm tra bằng AI' : ''}</small></div>`
      : '';
    $('[data-dict-n]', root).textContent = dict.size ? `Từ điển cá nhân: ${dict.size} từ được bỏ qua` : 'Từ điển cá nhân: chưa có từ nào';
    renderAiBox();
  }

  function issueHtml(it) {
    const alts = it.alts?.length > 1 ? it.alts : null;
    const fix = it.suggestion != null ? `<div class="issue-fix"><del>${escapeHtml(it.original.replace(/ /g, '·'))}</del> → <ins>${escapeHtml(String(it.suggestion).replace(/ /g, '·')) || '∅'}</ins>${alts ? ` <span class="hint">hoặc ${alts.slice(1).map((a) => `“${escapeHtml(a)}”`).join(', ')}</span>` : ''}</div>` : '';
    const fixBtns = alts
      ? alts.map((a, i) => `<button class="btn btn-sm ${i ? 'btn-ghost' : ''}" type="button" data-fix="${it.id}" data-alt="${escapeHtml(a)}">${escapeHtml(a)}</button>`).join('')
      : it.suggestion != null
        ? `<button class="btn btn-sm" type="button" data-fix="${it.id}">Sửa</button>`
        : '';
    return `<li class="issue" data-issue="${it.id}">
      <span class="issue-type t-${it.type}">${ISSUE_LABELS[it.type] || 'Khác'}${it.ai ? '<em>AI</em>' : ''}</span>
      <div class="issue-main"><p>${escapeHtml(it.message)}</p>${fix}
        <div class="issue-more">
          <button class="link-btn" type="button" data-skip="${it.id}">Bỏ qua</button>
          ${it.type === 'word' && !it.ai && !/\s/.test(it.original) ? `<button class="link-btn" type="button" data-learn="${it.id}">Thêm “${escapeHtml(it.original)}” vào từ điển</button>` : ''}
        </div>
      </div>
      <div class="issue-actions">${fixBtns}</div>
    </li>`;
  }

  const track = debounce(() => text.trim() && usage.track('spell'), 1500);
  input.addEventListener('input', () => {
    renderAll();
    track();
  });

  function applyOne(it, value) {
    input.value = applyFixes(input.value, [{ ...it, suggestion: value ?? it.suggestion }]);
    if (it.ai) aiRaw = aiRaw.filter((r) => String(r.sai).trim() !== it.original);
    renderAll();
  }

  root.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filter]');
    if (f) {
      filter = f.dataset.filter;
      return renderAll();
    }
    const fix = e.target.closest('[data-fix]');
    if (fix) {
      const it = issues.find((i) => i.id === fix.dataset.fix);
      return it && applyOne(it, fix.dataset.alt);
    }
    const sk = e.target.closest('[data-skip]');
    if (sk) {
      const it = issues.find((i) => i.id === sk.dataset.skip);
      if (it) skipped.add(keyOf(it));
      return renderAll();
    }
    const learn = e.target.closest('[data-learn]');
    if (learn) {
      const it = issues.find((i) => i.id === learn.dataset.learn);
      if (!it) return;
      dict.add(it.original.toLocaleLowerCase('vi-VN'));
      store.set('spell-dict', [...dict]);
      toast(`Đã thêm “${it.original}” vào từ điển cá nhân — sẽ không báo lỗi từ này nữa`);
      return renderAll();
    }
    if (e.target.closest('[data-ai-clear]')) {
      aiRaw = [];
      aiNote = null;
      return renderAll();
    }
    const mk = e.target.closest('mark[data-id]');
    if (mk) {
      const row = $(`[data-issue="${mk.dataset.id}"]`, root);
      $$('.issue.focus', root).forEach((x) => x.classList.remove('focus'));
      row?.classList.add('focus');
      row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
  issueList.addEventListener('mouseover', (e) => {
    const row = e.target.closest('[data-issue]');
    $$('mark.focus', root).forEach((m) => m.classList.remove('focus'));
    if (row) $(`mark[data-id="${row.dataset.issue}"]`, root)?.classList.add('focus');
  });

  /* ---------------- Kiểm tra bằng AI ---------------- */
  async function runAI() {
    if (aiController) return aiController.abort();
    if (!aiOk()) {
      toast(ctx.can('ai') ? 'Thêm API key (ChatGPT, Gemini, Grok, Groq, OpenRouter hoặc Claude) trong Cài đặt để kiểm tra bằng AI' : 'Tài khoản chưa được cấp quyền dùng AI trực tuyến — liên hệ quản trị viên', { type: 'info' });
      if (ctx.can('ai')) ctx.navigate('#settings');
      return;
    }
    const src = input.value;
    if (src.trim().length < 10) {
      toast('Nhập văn bản cần kiểm tra trước', { type: 'error' });
      return input.focus();
    }
    const { provider, apiKey, model } = ctx.ai();
    const btnLabel = $('[data-ai-label]', root);
    aiController = new AbortController();
    btnLabel.textContent = 'Dừng';
    const chunks = splitChunks(src);
    const items = [];
    const notes = [];
    const meta = {};
    let cachedAll = true;
    usage.track('ai');
    try {
      for (let i = 0; i < chunks.length; i++) {
        aiProgress = chunks.length > 1 ? `đoạn ${i + 1}/${chunks.length}` : '';
        renderAiBox();
        const reply = await streamClaude({ provider, apiKey, model, signal: aiController.signal, cache: true, meta, system: SPELL_AI_SYSTEM, maxTokens: 4096, messages: [{ role: 'user', content: spellAiPrompt(chunks[i].text) }] });
        cachedAll = cachedAll && !!meta.cached;
        const data = extractJson(reply);
        if (!data || !Array.isArray(data.loi)) throw new Error('AI trả về dữ liệu không đúng định dạng — thử lại hoặc đổi mô hình trong Cài đặt.');
        items.push(...data.loi);
        if (data.nhanXet) notes.push(String(data.nhanXet));
      }
      if (input.value !== src) toast('Văn bản đã thay đổi trong lúc AI kiểm tra — góp ý được định vị lại theo nội dung mới', { type: 'info' });
      aiRaw = items;
      const located = locateAiIssues(input.value, items);
      aiNote = { text: notes.join(' '), provider: meta.provider || provider, cached: cachedAll, count: located.length };
      aiController = null;
      renderAll();
      toast(located.length ? `AI có ${located.length} góp ý` : 'AI không phát hiện thêm lỗi', { type: located.length ? 'info' : 'success' });
    } catch (err) {
      if (/^Đã dừng/.test(err.message || '')) toast('Đã dừng kiểm tra bằng AI', { type: 'info' });
      else toast(err.message || 'Không kiểm tra được bằng AI', { type: 'error', timeout: 6000 });
    } finally {
      aiController = null;
      aiProgress = '';
      btnLabel.textContent = 'Kiểm tra bằng AI';
      renderAiBox();
    }
  }
  $('[data-ai-check]', root).addEventListener('click', runAI);

  /* ---------------- Từ điển cá nhân ---------------- */
  function dictDialog() {
    const listHtml = () =>
      dict.size
        ? `<ul class="dict-list">${[...dict].sort((a, b) => a.localeCompare(b, 'vi')).map((w) => `<li><span>${escapeHtml(w)}</span><button class="btn btn-ghost btn-sm btn-icon" type="button" data-rm="${escapeHtml(w)}" aria-label="Xóa “${escapeHtml(w)}” khỏi từ điển">${icon('trash', 'ic-sm')}</button></li>`).join('')}</ul>`
        : '<p class="hint">Chưa có từ nào. Bấm “Thêm vào từ điển” ở một lỗi “Từ ngữ” để không báo lỗi tên riêng, thuật ngữ, từ nước ngoài.</p>';
    ctx.modal(
      `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
       <h2 class="modal-title">Từ điển cá nhân</h2>
       <p class="hint" style="margin-bottom:12px">Các từ dưới đây không bị báo là “từ không có nghĩa”. Lưu trên máy, riêng tài khoản của bạn.</p>
       <form class="inline" data-add style="margin-bottom:12px"><input class="input" name="w" placeholder="Thêm từ, vd: Lancaster" aria-label="Từ cần thêm" /><button class="btn" type="submit">${icon('plus', 'ic-sm')}Thêm</button></form>
       <div data-list>${listHtml()}</div>
       <div class="modal-actions"><button class="btn btn-primary" type="button" data-close>Xong</button></div>`,
      {
        label: 'Từ điển cá nhân',
        onMount(box) {
          const save = () => {
            store.set('spell-dict', [...dict]);
            box.querySelector('[data-list]').innerHTML = listHtml();
            renderAll();
          };
          box.querySelector('[data-add]').addEventListener('submit', (e) => {
            e.preventDefault();
            const words = e.target.w.value.split(/[\s,;]+/).map((w) => w.trim().toLocaleLowerCase('vi-VN')).filter(Boolean);
            words.forEach((w) => dict.add(w));
            e.target.w.value = '';
            save();
          });
          box.addEventListener('click', (e) => {
            const rm = e.target.closest('[data-rm]');
            if (!rm) return;
            dict.delete(rm.dataset.rm);
            save();
          });
        },
      },
    );
  }
  $('[data-dict]', root).addEventListener('click', dictDialog);

  $('[data-fixall]', root).addEventListener('click', () => {
    const fixable = issues.filter((i) => i.suggestion != null && !i.ambiguous);
    if (!fixable.length) return toast('Không có lỗi nào có thể sửa tự động', { type: 'info' });
    // Sửa góp ý AI trước (theo vị trí hiện tại), rồi chạy bộ sửa trên máy cho đến khi ổn định.
    const aiFix = fixable.filter((i) => i.ai);
    let out = applyFixes(input.value, aiFix);
    aiRaw = aiRaw.filter((r) => !aiFix.some((a) => a.original === String(r.sai).trim()));
    out = fixAll(out, 4, { ignore: dict });
    input.value = out;
    const left = fixable.length;
    renderAll();
    usage.track('spell');
    const unsure = issues.filter((i) => i.ambiguous).length;
    toast(`Đã sửa ${left} lỗi${unsure ? ` · còn ${unsure} từ cần bạn chọn cách sửa` : ''}`);
  });
  $('[data-sample]', root).addEventListener('click', () => {
    input.value = SAMPLE;
    aiRaw = [];
    aiNote = null;
    renderAll();
  });
  $('[data-clear]', root).addEventListener('click', () => {
    input.value = '';
    aiRaw = [];
    aiNote = null;
    renderAll();
    input.focus();
  });
  $('[data-copy]', root).addEventListener('click', async () => {
    await copyText(input.value);
    toast('Đã sao chép văn bản');
  });

  async function loadFile(file) {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      input.value = /\.docx$/i.test(file.name) ? await docxToText(buf) : new TextDecoder().decode(buf);
      aiRaw = [];
      aiNote = null;
      renderAll();
      toast(`Đã tải “${file.name}”`);
    } catch (err) {
      toast(err.message || 'Không đọc được tệp', { type: 'error' });
    }
  }
  const dz = $('.dropzone', root);
  $('[data-file]', root).addEventListener('change', (e) => loadFile(e.target.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, () => dz.classList.add('drag')));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, () => dz.classList.remove('drag')));

  renderAll();
  return () => aiController?.abort();
}
