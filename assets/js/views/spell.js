// Kiểm tra chính tả – dấu câu – thể thức.
import { $, $$, icon, toast, escapeHtml, copyText, debounce } from '../ui.js';
import { checkText, applyFixes, fixAll, qualityScore, ISSUE_LABELS } from '../lib/spellcheck.js';
import { store, usage } from '../lib/store.js';
import { docxToText } from '../lib/docx.js';

const SAMPLE = 'Kính gửi  các phòng ban ,\nThực hiện chỉ đạo của UBND quận, đề nghị các đơn vị khẩn trương sử lý hồ sơ tồn đọng và bổ xung tài liệu còn thiếu. kết quả gửi về Văn phòng trước ngày 5 tháng 2 năm 2026.\nĐề nghị các đơn vị nghiêm túc thực hiện thực hiện.';

export function render(ctx) {
  let text = store.get('spell-text', '');
  let issues = [];
  let filter = 'all';

  ctx.view.innerHTML = `
  <div class="page">
    <div class="page-head">
      <div><h1 class="page-title">Kiểm tra <em>chính tả</em></h1><p class="page-sub">Phát hiện lỗi chính tả, dấu câu, viết hoa và thể thức theo NĐ 30/2020.</p></div>
      <div class="inline">
        <button class="btn" type="button" data-sample>${icon('wand', 'ic-sm')}Văn bản mẫu</button>
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
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>${icon('spell', 'ic-sm')}Kết quả</h2>
          <div class="chips" role="group" aria-label="Lọc loại lỗi" data-filters></div>
        </div>
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

  function renderAll() {
    text = input.value;
    store.set('spell-text', text);
    issues = checkText(text);
    const counts = issues.reduce((a, i) => ((a[i.type] = (a[i.type] || 0) + 1), a), {});
    $('[data-filters]', root).innerHTML = [['all', `Tất cả ${issues.length}`], ...Object.entries(ISSUE_LABELS).filter(([k]) => counts[k]).map(([k, l]) => [k, `${l} ${counts[k]}`])]
      .map(([k, l]) => `<button class="chip" type="button" data-filter="${k}" aria-pressed="${filter === k}">${l}</button>`)
      .join('');
    if (filter !== 'all' && !counts[filter]) filter = 'all';

    // Văn bản có đánh dấu lỗi.
    let html = '';
    let pos = 0;
    issues.forEach((it) => {
      html += escapeHtml(text.slice(pos, it.start));
      const seg = escapeHtml(text.slice(it.start, it.end)).replace(/ /g, '&nbsp;') || '&nbsp;';
      html += `<mark class="err-mark t-${it.type}" data-id="${it.id}" title="${escapeHtml(it.message)}" tabindex="0">${seg}</mark>`;
      pos = it.end;
    });
    html += escapeHtml(text.slice(pos));
    marked.innerHTML = text.trim() ? html : '<span style="color:var(--text-3)">Kết quả kiểm tra sẽ hiển thị tại đây.</span>';

    const shown = issues.filter((i) => filter === 'all' || i.type === filter);
    issueList.innerHTML = shown.length
      ? shown
          .map(
            (it) => `<li class="issue" data-issue="${it.id}">
          <span class="issue-type t-${it.type}">${ISSUE_LABELS[it.type]}</span>
          <div class="issue-main"><p>${escapeHtml(it.message)}</p>
            ${it.suggestion != null ? `<div class="issue-fix"><del>${escapeHtml(it.original.replace(/ /g, '·'))}</del> → <ins>${escapeHtml(it.suggestion.replace(/ /g, '·')) || '∅'}</ins></div>` : ''}
          </div>
          ${it.suggestion != null ? `<button class="btn btn-sm" type="button" data-fix="${it.id}">Sửa</button>` : ''}
        </li>`,
          )
          .join('')
      : `<li class="empty"><div class="empty-icon">${icon('check-circle', 'ic-lg')}</div><h3>${text.trim() ? 'Không phát hiện lỗi' : 'Chưa có nội dung'}</h3><p>${text.trim() ? 'Văn bản của bạn đã chuẩn chỉnh.' : 'Nhập văn bản để bắt đầu kiểm tra.'}</p></li>`;

    const score = qualityScore(text, issues);
    const color = score >= 90 ? 'var(--success)' : score >= 70 ? 'var(--warning)' : 'var(--danger)';
    $('[data-score]', root).innerHTML = text.trim()
      ? `<div class="score-ring" style="--p:${score};--c:${color}"><span>${score}</span></div><div><strong>Điểm chất lượng văn bản</strong><small>${issues.length} vấn đề · ${text.trim().split(/\s+/).length} từ</small></div>`
      : '';
  }

  const track = debounce(() => text.trim() && usage.track('spell'), 1500);
  input.addEventListener('input', () => {
    renderAll();
    track();
  });

  root.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filter]');
    if (f) {
      filter = f.dataset.filter;
      renderAll();
      return;
    }
    const fix = e.target.closest('[data-fix]');
    if (fix) {
      const it = issues.find((i) => i.id === fix.dataset.fix);
      input.value = applyFixes(input.value, [it]);
      renderAll();
      return;
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

  $('[data-fixall]', root).addEventListener('click', () => {
    const before = issues.filter((i) => i.suggestion != null).length;
    if (!before) return toast('Không có lỗi nào có thể sửa tự động', { type: 'info' });
    input.value = fixAll(input.value);
    renderAll();
    usage.track('spell');
    toast(`Đã sửa ${before} lỗi`);
  });
  $('[data-sample]', root).addEventListener('click', () => {
    input.value = SAMPLE;
    renderAll();
  });
  $('[data-clear]', root).addEventListener('click', () => {
    input.value = '';
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
}
