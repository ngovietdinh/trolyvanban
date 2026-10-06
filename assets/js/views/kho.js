// Kho hồ sơ & Trợ lý AI: tải lên hồ sơ, tài liệu (Word, PDF, txt) → làm dữ liệu cho hỏi đáp AI có trích dẫn,
// lập biên bản lời khai mới dựa vào các biên bản cũ, tạo văn bản tố tụng theo mẫu có sẵn.
import { $, $$, icon, toast, escapeHtml, renderMarkdown, downloadBlob, copyText } from '../ui.js';
import { openMakeDoc, mdToPlain } from './make-doc.js';
import { mobilePanes } from '../lib/panes.js';
import { khoDb } from '../lib/kho-db.js';
import { extractText } from '../lib/extract.js';
import { streamClaude, extractJson } from '../lib/ai.js';
import { casesRepo, recordsRepo, legalDocsRepo, deleteRecords, restoreRecords } from '../legal/repo.js';
import { qaToText, newRecord, prefillQa } from '../legal/record.js';
import { getRole } from '../legal/roles.js';
import { FORMS, FIELDS, findForm, formKeys } from '../legal/forms-catalog.js';
import { buildFormDocument, prefillFromCase, nhanThanText } from '../legal/forms-build.js';
import { LOAI_TL, analyzeDoc, searchDocs, buildContext, localInterviewPlan, planFromIssues, personFromOlds, localIntent, KHO_SYSTEM, answerPrompt, intentPrompt, interviewPrompt, formPrompt } from '../legal/kho.js';
import { store, uid } from '../lib/store.js';
import { audit } from '../lib/accounts.js';
import { relativeTime } from '../lib/vn-date.js';

const MAX_FILE = 25 * 1024 * 1024;
const ICON = { bblk: 'message', 'hoi-cung': 'message', 'doi-chat': 'message', qd: 'gavel', lenh: 'gavel', 'kl-giam-dinh': 'zap', 'kl-dinh-gia': 'zap', 'kl-dieu-tra': 'book', 'cao-trang': 'book', 'ban-an': 'book' };
const STATEMENT = new Set(['bblk', 'hoi-cung', 'doi-chat']);

/** Văn bản thuần từ doc model (văn bản tố tụng đã lập trong phần mềm). */
function docModelText(doc) {
  const out = [];
  if (doc.title) out.push(doc.title.name, doc.title.subject || '');
  for (const p of doc.body || []) out.push(p.runs.map((r) => r.text).join(''));
  return out.filter(Boolean).join('\n');
}

function threadTitle(msgs) {
  const first = msgs.find((m) => m.role === 'user')?.text || 'Cuộc trò chuyện mới';
  return first.length > 60 ? first.slice(0, 57) + '…' : first;
}

export function render(ctx) {
  let docs = []; // tài liệu tải lên (không kèm tệp gốc)
  let filterCase = store.get('kho-case', '');
  let includeApp = store.get('kho-app', true);
  let selected = new Set(store.get('kho-sel', []));
  let q = '';
  let busy = false;
  // Lịch sử trò chuyện với trợ lý hồ sơ: nhiều cuộc, lưu trên máy theo tài khoản (xóa được).
  let threads = store.get('kho-threads', null);
  if (!threads) {
    const legacy = store.get('kho-chat', []);
    threads = legacy.length ? [{ id: uid(), title: threadTitle(legacy), createdAt: Date.now(), updatedAt: Date.now(), messages: legacy }] : [];
    store.set('kho-threads', threads);
    store.remove('kho-chat');
  }
  threads.sort((a, b) => b.updatedAt - a.updatedAt);
  let currentId = store.get('kho-current', null);
  if (!threads.some((t) => t.id === currentId)) currentId = threads[0]?.id || null;
  let messages = threads.find((t) => t.id === currentId)?.messages || [];

  ctx.view.innerHTML = `
  <div class="kho">
    <aside class="kho-lib" aria-label="Kho tài liệu">
      <div class="kho-lib-head">
        <h1>${icon('folder', 'ic-sm')}Kho hồ sơ</h1>
        <select class="select select-sm" data-case aria-label="Lọc theo hồ sơ vụ án"></select>
      </div>
      <label class="dropzone kho-drop" data-drop>
        <input type="file" multiple accept=".docx,.pdf,.txt,.md,.html" data-file aria-label="Tải lên hồ sơ, tài liệu" />
        <span class="dz-icon">${icon('upload')}</span>
        <span><strong>Tải lên hồ sơ, tài liệu</strong><small>Word (.docx), PDF có chữ, .txt · nhiều tệp cùng lúc · lưu trên máy</small></span>
      </label>
      <div class="kho-tools">
        <div class="lg-search kho-search">${icon('search', 'ic-sm')}<input type="search" placeholder="Tìm trong kho…" data-q aria-label="Tìm trong kho" /></div>
        <label class="check"><input type="checkbox" data-app ${includeApp ? 'checked' : ''} />Gồm biên bản, văn bản đã lập trong phần mềm</label>
        <div class="kho-selbar"><label class="check"><input type="checkbox" data-sel-all />Chọn tất cả làm dữ liệu</label><span class="hint" data-sel-n></span></div>
      </div>
      <ul class="kho-list" data-list></ul>
    </aside>
    <section class="kho-ai" aria-label="Trợ lý AI hồ sơ">
      <header class="kho-ai-head">
        <div><strong>${icon('sparkles', 'ic-sm')}Trợ lý hồ sơ</strong><small data-scope></small></div>
        <span class="badge" data-mode></span>
        <div class="kho-chat-tools">
          <button class="btn btn-ghost btn-sm" type="button" data-history title="Lịch sử trò chuyện">${icon('clock', 'ic-sm')}<span>Lịch sử</span> <span class="sb-count" data-thread-n></span></button>
          <button class="btn btn-ghost btn-sm btn-icon" type="button" data-new-chat aria-label="Cuộc trò chuyện mới" title="Cuộc trò chuyện mới">${icon('plus', 'ic-sm')}</button>
          <button class="btn btn-ghost btn-sm btn-icon" type="button" data-clear-chat aria-label="Xóa cuộc trò chuyện này" title="Xóa cuộc trò chuyện này">${icon('trash', 'ic-sm')}</button>
        </div>
      </header>
      <div class="kho-msgs" data-msgs></div>
      <div class="kho-quick" data-quick>
        <button type="button" class="chip" data-tpl="Tóm tắt các tài liệu đã chọn: nội dung chính, người liên quan, mốc thời gian, số tiền.">Tóm tắt hồ sơ</button>
        <button type="button" class="chip" data-tpl="Tạo biên bản lời khai mới dựa vào các biên bản lời khai cũ để làm rõ hơn ">Tạo biên bản lời khai mới từ BBLK cũ</button>
        <button type="button" class="chip" data-tpl="Chỉ ra các điểm mâu thuẫn giữa các lời khai đã chọn.">Tìm mâu thuẫn</button>
        <button type="button" class="chip" data-tpl="Tạo giấy triệu tập người làm chứng ">Tạo văn bản theo mẫu…</button>
      </div>
      <form class="kho-input" data-form>
        <textarea rows="2" data-input data-ph-short="Hỏi về hồ sơ, hoặc ra lệnh tạo biên bản, văn bản…" placeholder="Hỏi về hồ sơ, hoặc ra lệnh: “Tạo biên bản lời khai mới cho Nguyễn Văn A để làm rõ việc nhận tiền”, “Tạo quyết định trưng cầu giám định chữ ký”…" aria-label="Yêu cầu cho trợ lý"></textarea>
        <button class="btn btn-primary" type="submit" data-send>${icon('send', 'ic-sm')}Gửi</button>
      </form>
    </section>
  </div>`;
  const root = ctx.view;
  const list = $('[data-list]', root);
  const msgs = $('[data-msgs]', root);
  const input = $('[data-input]', root);
  const panes = mobilePanes($('.kho', root), [
    { id: 'lib', el: $('.kho-lib', root), label: 'Tài liệu', icon: 'folder' },
    { id: 'ai', el: $('.kho-ai', root), label: 'Trợ lý', icon: 'sparkles' },
  ], { initial: ctx.handoff?.prefill ? 'ai' : 'lib' });

  /* ---------------- Nguồn dữ liệu ---------------- */
  function appDocs() {
    if (!includeApp) return [];
    const inCase = (x) => !filterCase || (filterCase === '_none' ? !x.caseId : x.caseId === filterCase);
    const recs = recordsRepo.list(inCase).filter((r) => (r.qa || []).some((x) => x.a));
    const lds = legalDocsRepo.list(inCase);
    const org = ctx.settings().legalOrg || {};
    return [
      ...recs.map((r) => {
        const role = getRole(r.roleId);
        const header = `${role.bienBan}\nHọ tên: ${r.nguoiKhai?.hoTen || ''}\n${nhanThanText(r.nguoiKhai || {})}\nTư cách tham gia tố tụng: ${role.ten.split('/')[0].trim()}\nNgày: ${r.ngay || ''}`;
        return { id: `rec:${r.id}`, app: true, ten: `${role.bienBan.replace('BIÊN BẢN ', 'BB ')} — ${r.nguoiKhai?.hoTen || 'chưa ghi tên'} (lần ${r.lan || 1})`, loai: r.roleId === 'bi-can' ? 'hoi-cung' : 'bblk', caseId: r.caseId, ngay: r.ngay?.split('-').reverse().join('/'), nguoi: r.nguoiKhai || {}, roleId: r.roleId, qa: (r.qa || []).filter((x) => x.a), text: `${header}\n\nHỎI VÀ ĐÁP\n${qaToText(r).replace(/\[\d+\]\s*/g, '').replace(/Trả lời:/g, 'Đáp:')}` };
      }),
      ...lds.map((d) => {
        const f = findForm(d.formId);
        return { id: `ldoc:${d.id}`, app: true, ten: d.title, loai: f?.loai === 'qd' ? 'qd' : f?.loai === 'lenh' ? 'lenh' : 'bb-khac', caseId: d.caseId, ngay: '', nguoi: {}, qa: [], text: f ? docModelText(buildFormDocument(f, d.values, org)) : '' };
      }),
    ];
  }
  const visibleDocs = () => {
    const inCase = (x) => !filterCase || (filterCase === '_none' ? !x.caseId : x.caseId === filterCase);
    return [...docs.filter(inCase), ...appDocs()];
  };
  const contextDocs = () => {
    const vis = visibleDocs();
    const sel = vis.filter((d) => selected.has(d.id));
    return sel.length ? sel : vis;
  };

  /* ---------------- Danh sách ---------------- */
  function renderCaseSelect() {
    const cases = casesRepo.list();
    $('[data-case]', root).innerHTML = `<option value="">Tất cả hồ sơ</option>${cases.map((c) => `<option value="${c.id}" ${c.id === filterCase ? 'selected' : ''}>${escapeHtml(c.ten)}</option>`).join('')}<option value="_none" ${filterCase === '_none' ? 'selected' : ''}>Chưa gắn hồ sơ</option>`;
  }
  function renderList() {
    const vis = visibleDocs();
    const n = q.trim();
    let shown = vis;
    let snippets = {};
    if (n) {
      const hits = searchDocs(n, vis, { limit: 40 });
      const ids = [...new Set(hits.map((h) => h.docId))];
      shown = ids.map((id) => vis.find((d) => d.id === id)).filter(Boolean);
      for (const h of hits) snippets[h.docId] ??= h.text;
    }
    list.innerHTML = shown.length
      ? shown
          .map((d) => {
            const c = d.caseId ? casesRepo.get(d.caseId) : null;
            const meta = [LOAI_TL[d.loai] || 'Tài liệu', d.nguoi?.hoTen, d.ngay, d.qa?.length ? `${d.qa.length} lượt hỏi – đáp` : '', d.pages ? `${d.pages} trang` : '', c?.ten].filter(Boolean).join(' · ');
            return `<li class="kho-item ${selected.has(d.id) ? 'on' : ''}" data-id="${escapeHtml(d.id)}">
              <input type="checkbox" class="rec-check" data-sel ${selected.has(d.id) ? 'checked' : ''} aria-label="Dùng làm dữ liệu: ${escapeHtml(d.ten)}" />
              <span class="kho-ic">${icon(ICON[d.loai] || 'file', 'ic-sm')}</span>
              <button type="button" class="kho-item-body" data-view><strong>${escapeHtml(d.ten)}</strong><small>${escapeHtml(meta)}${d.app ? ' · <em>trong phần mềm</em>' : ''}</small>${snippets[d.id] ? `<span class="kho-snip">${escapeHtml(snippets[d.id].slice(0, 160))}…</span>` : ''}</button>
              <button type="button" class="btn btn-ghost btn-sm btn-icon" data-del aria-label="Xóa ${escapeHtml(d.ten)}" title="${d.app ? 'Xóa văn bản này khỏi phần mềm' : 'Xóa khỏi kho'}">${icon('trash', 'ic-sm')}</button>
            </li>`;
          })
          .join('')
      : `<li class="kho-empty">${n ? 'Không tìm thấy nội dung phù hợp.' : 'Chưa có tài liệu. Tải lên biên bản, quyết định, kết luận giám định… để làm dữ liệu cho trợ lý. <a href="#help/kho">Xem hướng dẫn và ví dụ câu lệnh</a>'}</li>`;
    const visIds = new Set(vis.map((d) => d.id));
    const selN = [...selected].filter((id) => visIds.has(id)).length;
    panes.badge('lib', vis.length);
    $('[data-sel-n]', root).textContent = selN ? `Đã chọn ${selN}/${vis.length}` : `${vis.length} tài liệu (dùng tất cả)`;
    $('[data-sel-all]', root).checked = selN > 0 && selN === vis.length;
    $('[data-scope]', root).textContent = `Dữ liệu: ${selN || vis.length} tài liệu${filterCase && filterCase !== '_none' ? ` · ${casesRepo.get(filterCase)?.ten || ''}` : ''}`;
  }
  const saveSel = () => store.set('kho-sel', [...selected]);

  list.addEventListener('change', (e) => {
    const li = e.target.closest('[data-id]');
    if (!li || !e.target.matches('[data-sel]')) return;
    e.target.checked ? selected.add(li.dataset.id) : selected.delete(li.dataset.id);
    saveSel();
    renderList();
  });
  list.addEventListener('click', async (e) => {
    const li = e.target.closest('[data-id]');
    if (!li) return;
    const d = visibleDocs().find((x) => x.id === li.dataset.id);
    if (!d) return;
    if (e.target.closest('[data-del]')) delDoc(d);
    else if (e.target.closest('[data-view]')) viewDoc(d);
  });
  /**
   * Xóa một tài liệu (có hoàn tác): tệp tải lên → xóa khỏi kho; biên bản / văn bản tố tụng lập trong phần mềm →
   * xóa chính văn bản đó (khỏi Ghi lời khai, Biểu mẫu tố tụng, hồ sơ vụ án).
   */
  async function delDoc(d) {
    const [kind, realId] = d.app ? d.id.split(':') : ['kho', d.id];
    const where = kind === 'rec' ? ' Biên bản sẽ bị xóa khỏi mục Ghi lời khai và hồ sơ vụ án.' : kind === 'ldoc' ? ' Văn bản sẽ bị xóa khỏi Biểu mẫu tố tụng và hồ sơ vụ án.' : '';
    if (!(await ctx.confirm(`Xóa “${d.ten}”?${where} Có thể hoàn tác ngay sau khi xóa.`, { title: d.app ? 'Xóa văn bản' : 'Xóa tài liệu', okText: 'Xóa', danger: true }))) return;
    let undo;
    if (kind === 'rec') {
      const removed = deleteRecords([realId]);
      undo = () => restoreRecords(removed);
    } else if (kind === 'ldoc') {
      const item = legalDocsRepo.get(realId);
      legalDocsRepo.remove(realId);
      undo = () => item && legalDocsRepo.restore(item);
    } else {
      const full = await khoDb.get(realId);
      await khoDb.remove(realId);
      undo = () => full && khoDb.put(full);
    }
    selected.delete(d.id);
    saveSel();
    audit(d.app ? 'Xóa văn bản (từ Kho hồ sơ)' : 'Xóa tài liệu khỏi kho hồ sơ', d.ten);
    await reload();
    toast(d.app ? 'Đã xóa văn bản' : 'Đã xóa tài liệu', {
      timeout: 8000,
      action: {
        label: 'Hoàn tác',
        onClick: async () => {
          await undo();
          await reload();
          toast('Đã khôi phục');
        },
      },
    });
  }

  $('[data-sel-all]', root).addEventListener('change', (e) => {
    visibleDocs().forEach((d) => (e.target.checked ? selected.add(d.id) : selected.delete(d.id)));
    saveSel();
    renderList();
  });
  $('[data-case]', root).addEventListener('change', (e) => {
    filterCase = e.target.value;
    store.set('kho-case', filterCase);
    renderList();
  });
  $('[data-app]', root).addEventListener('change', (e) => {
    includeApp = e.target.checked;
    store.set('kho-app', includeApp);
    renderList();
  });
  $('[data-q]', root).addEventListener('input', (e) => {
    q = e.target.value;
    renderList();
  });

  async function reload() {
    docs = (await khoDb.list()).map((d) => ({ ...d }));
    renderList();
  }

  /* ---------------- Tải lên ---------------- */
  async function upload(files) {
    let ok = 0;
    for (const f of files) {
      if (f.size > MAX_FILE) {
        toast(`“${f.name}” lớn hơn 25 MB`, { type: 'error' });
        continue;
      }
      try {
        const { text, pages } = await extractText(f);
        const a = analyzeDoc(text);
        const rec = await khoDb.put({
          ten: f.name.replace(/\.[^.]+$/, ''),
          fileName: f.name,
          mime: f.type,
          size: f.size,
          blob: f,
          text,
          pages: pages || 0,
          loai: a.loai,
          tieuDe: a.tieuDe,
          ngay: a.ngay,
          nguoi: a.nguoi,
          tuCach: a.tuCach,
          roleId: a.roleId,
          qa: a.qa,
          caseId: filterCase && filterCase !== '_none' ? filterCase : null,
        });
        selected.add(rec.id);
        ok++;
      } catch (err) {
        toast(err.message || `Không đọc được “${f.name}”`, { type: 'error', timeout: 6000 });
      }
    }
    saveSel();
    await reload();
    if (ok) {
      audit('Tải tài liệu lên kho hồ sơ', `${ok} tệp`);
      toast(`Đã thêm ${ok} tài liệu vào kho`);
    }
  }
  $('[data-file]', root).addEventListener('change', (e) => {
    upload([...e.target.files]);
    e.target.value = '';
  });
  const drop = $('[data-drop]', root);
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('drag');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('drag');
    upload([...e.dataTransfer.files]);
  });

  /* ---------------- Xem tài liệu ---------------- */
  function viewDoc(d) {
    const cases = casesRepo.list();
    ctx.modal(
      `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
      <h2 class="modal-title">${escapeHtml(d.ten)}</h2>
      <div class="grid-2 kho-meta">
        <div class="field"><label for="kv-loai">Loại tài liệu</label><select class="select" id="kv-loai" data-loai ${d.app ? 'disabled' : ''}>${Object.entries(LOAI_TL).map(([k, l]) => `<option value="${k}" ${k === d.loai ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label for="kv-case">Hồ sơ vụ án</label><select class="select" id="kv-case" data-kcase ${d.app ? 'disabled' : ''}><option value="">— Chưa gắn —</option>${cases.map((c) => `<option value="${c.id}" ${c.id === d.caseId ? 'selected' : ''}>${escapeHtml(c.ten)}</option>`).join('')}</select></div>
      </div>
      <p class="hint">${[d.nguoi?.hoTen && `Người liên quan: ${d.nguoi.hoTen}`, d.tuCach && `Tư cách: ${d.tuCach}`, d.ngay && `Ngày: ${d.ngay}`, d.qa?.length && `${d.qa.length} lượt hỏi – đáp nhận diện được`].filter(Boolean).map(escapeHtml).join(' · ') || 'Chưa nhận diện được thông tin người liên quan.'}</p>
      <pre class="kho-text">${escapeHtml(d.text || '')}</pre>
      <div class="modal-actions"><button class="btn btn-ghost" type="button" data-mdel>${icon('trash', 'ic-sm')}Xóa</button>${d.app ? `<a class="btn btn-ghost" href="${d.id.startsWith('rec:') ? `#interview/${d.id.slice(4)}` : `#forms/doc/${d.id.slice(5)}`}" data-close>${icon('arrow-right', 'ic-sm')}Mở văn bản</a>` : `<button class="btn btn-ghost" type="button" data-dl>${icon('download', 'ic-sm')}Tải tệp gốc</button>`}<span class="spacer"></span><button class="btn" type="button" data-close>Đóng</button>${d.app ? '' : `<button class="btn btn-primary" type="button" data-save>${icon('save', 'ic-sm')}Lưu</button>`}</div>`,
      {
        className: 'modal-wide',
        label: d.ten,
        onMount(box, close) {
          box.querySelector('[data-mdel]').addEventListener('click', () => {
            close();
            delDoc(d);
          });
          box.querySelector('[data-dl]')?.addEventListener('click', async () => {
            const full = await khoDb.get(d.id);
            if (full?.blob) downloadBlob(full.blob, full.fileName, full.mime);
          });
          box.querySelector('[data-save]')?.addEventListener('click', async () => {
            await khoDb.patch(d.id, { loai: box.querySelector('[data-loai]').value, caseId: box.querySelector('[data-kcase]').value || null });
            close();
            await reload();
            toast('Đã lưu');
          });
        },
      },
    );
  }

  /* ---------------- Trợ lý ---------------- */
  const aiOn = () => ctx.hasAI('legal');
  function renderMode() {
    const b = $('[data-mode]', root);
    b.className = `badge ${aiOn() ? 'badge-success' : ''}`;
    b.textContent = aiOn() ? `AI: ${ctx.ai('legal').label}` : 'Ngoại tuyến';
    b.title = aiOn() ? 'Nội dung tài liệu liên quan sẽ được gửi tới dịch vụ AI' : 'Tìm kiếm, phân tích chạy trên máy; không gửi dữ liệu ra ngoài';
  }
  function renderMsgs() {
    msgs.innerHTML = messages.length
      ? messages
          .map((m, i) => `<div class="kho-msg ${m.role}">${m.role === 'user' ? `<p>${escapeHtml(m.text)}</p>` : `<div class="msg-content">${m.html || renderMarkdown(m.text || '')}</div>${m.cites?.length ? `<details class="kho-cites"><summary>Nguồn trích dẫn (${m.cites.length})</summary><ol>${m.cites.map((c) => `<li><strong>${escapeHtml(c.ten)}</strong> — đoạn ${c.idx + 1}<br><span>${escapeHtml(c.text.slice(0, 260))}${c.text.length > 260 ? '…' : ''}</span></li>`).join('')}</ol></details>` : ''}${m.actions || ''}${toolsHtml(m, i)}`}</div>`)
          .join('')
      : `<div class="kho-welcome">${icon('sparkles', 'ic-lg')}<h3>Trợ lý làm việc trên kho hồ sơ</h3><p>Tải tài liệu lên bên trái, chọn tài liệu làm dữ liệu (không chọn = dùng tất cả trong hồ sơ đang lọc). Sau đó hỏi đáp, tóm tắt, tìm mâu thuẫn, hoặc yêu cầu tạo biên bản lời khai mới, văn bản tố tụng theo mẫu.</p></div>`;
    msgs.scrollTop = msgs.scrollHeight;
  }
  const push = (m) => {
    messages.push(m);
    renderMsgs();
    return m;
  };
  const msgText = (m) => (m.text ? mdToPlain(m.text) : (m.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  /** Nút cho câu trả lời: sao chép, tạo văn bản chuẩn, xóa. */
  function toolsHtml(m, i) {
    if (m.role === 'user' || (busy && i === messages.length - 1)) return '';
    const make = ctx.can('docs') && m.text && !m.actions ? `<button class="btn btn-sm" type="button" data-make="${i}">${icon('file', 'ic-sm')}Tạo văn bản chuẩn</button>` : '';
    return `<div class="msg-tools">${make}<button class="btn btn-ghost btn-sm" type="button" data-copy="${i}">${icon('copy', 'ic-sm')}Sao chép</button><button class="btn btn-ghost btn-sm btn-icon" type="button" data-del-msg="${i}" aria-label="Xóa câu trả lời" title="Xóa">${icon('trash', 'ic-sm')}</button></div>`;
  }
  const notTyping = (m) => !/class="typing"/.test(m.html || '');
  const saveChat = () => {
    const cur = threads.find((t) => t.id === currentId);
    if (cur) cur.updatedAt = Date.now();
    store.set('kho-threads', threads.slice(0, 30).map((t) => ({ ...t, messages: t.messages.filter(notTyping).slice(-60) })));
    store.set('kho-current', currentId);
    renderThreadInfo();
  };
  /** Bắt đầu cuộc trò chuyện mới khi gửi câu hỏi đầu tiên. */
  function ensureThread(firstText) {
    if (threads.some((t) => t.id === currentId)) return;
    const t = { id: uid(), title: threadTitle([{ role: 'user', text: firstText }]), createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    threads.unshift(t);
    currentId = t.id;
    messages = t.messages;
  }
  function openThread(id) {
    if (busy) return toast('Đợi trợ lý trả lời xong rồi chuyển cuộc trò chuyện', { type: 'info' });
    currentId = id;
    messages = threads.find((t) => t.id === id)?.messages || [];
    saveChat();
    renderMsgs();
  }
  function newThread() {
    if (busy) return;
    currentId = null;
    messages = [];
    saveChat();
    renderMsgs();
    input.focus();
  }
  function renderThreadInfo() {
    $('[data-thread-n]', root).textContent = threads.length || '';
    $('[data-clear-chat]', root).hidden = !threads.some((t) => t.id === currentId);
  }
  async function deleteThreads(ids, all = false) {
    if (busy) return toast('Đợi trợ lý trả lời xong rồi xóa', { type: 'info' });
    const removed = threads.filter((t) => ids.includes(t.id));
    if (!removed.length) return;
    if (!(await ctx.confirm(all ? `Xóa toàn bộ ${removed.length} cuộc trò chuyện với trợ lý hồ sơ? Tài liệu trong kho và văn bản đã tạo vẫn giữ nguyên.` : `Xóa cuộc trò chuyện “${removed[0].title}”? Tài liệu trong kho và văn bản đã tạo vẫn giữ nguyên.`, { title: all ? 'Xóa toàn bộ lịch sử' : 'Xóa cuộc trò chuyện', okText: 'Xóa', danger: true }))) return;
    const before = currentId;
    threads = threads.filter((t) => !ids.includes(t.id));
    if (ids.includes(currentId)) {
      currentId = threads[0]?.id || null;
      messages = threads[0]?.messages || [];
    }
    saveChat();
    renderMsgs();
    toast(all ? 'Đã xóa toàn bộ lịch sử' : 'Đã xóa cuộc trò chuyện', {
      timeout: 8000,
      action: {
        label: 'Hoàn tác',
        onClick: () => {
          threads = [...threads, ...removed].sort((a, b) => b.updatedAt - a.updatedAt);
          currentId = before;
          messages = threads.find((t) => t.id === before)?.messages || [];
          saveChat();
          renderMsgs();
          toast('Đã khôi phục');
        },
      },
    });
  }
  function historyDialog() {
    const listHtml = () =>
      threads.length
        ? threads
            .map((t) => `<div class="ch-item ${t.id === currentId ? 'active' : ''}"><button type="button" class="ch-open" data-open-thread="${t.id}"><strong>${escapeHtml(t.title)}</strong><small>${relativeTime(t.updatedAt)} · ${t.messages.filter((m) => m.role === 'user').length} câu hỏi</small></button><button type="button" class="btn btn-ghost btn-sm btn-icon ch-del" data-del-thread="${t.id}" aria-label="Xóa cuộc trò chuyện “${escapeHtml(t.title)}”" title="Xóa">${icon('trash', 'ic-sm')}</button></div>`)
            .join('')
        : '<p class="ch-empty">Chưa có cuộc trò chuyện nào.</p>';
    ctx.modal(
      `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
       <h2 class="modal-title">Lịch sử trò chuyện — Trợ lý hồ sơ</h2>
       <div class="ch-list ch-list-sheet" data-hlist>${listHtml()}</div>
       <div class="modal-actions">${threads.length ? `<button class="btn" type="button" data-h-clear>${icon('trash', 'ic-sm')}Xóa tất cả</button>` : ''}<button class="btn btn-primary" type="button" data-h-new>${icon('plus', 'ic-sm')}Cuộc trò chuyện mới</button></div>`,
      {
        label: 'Lịch sử trò chuyện',
        onMount(box, close) {
          box.querySelector('[data-hlist]').addEventListener('click', (e) => {
            const o = e.target.closest('[data-open-thread]');
            if (o) {
              close();
              return openThread(o.dataset.openThread);
            }
            const d = e.target.closest('[data-del-thread]');
            if (d) {
              close();
              deleteThreads([d.dataset.delThread]);
            }
          });
          box.querySelector('[data-h-new]').addEventListener('click', () => {
            close();
            newThread();
          });
          box.querySelector('[data-h-clear]')?.addEventListener('click', () => {
            close();
            deleteThreads(threads.map((t) => t.id), true);
          });
        },
      },
    );
  }
  $('[data-history]', root).addEventListener('click', historyDialog);
  $('[data-new-chat]', root).addEventListener('click', newThread);
  msgs.addEventListener('click', async (e) => {
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      const m = messages[+cp.dataset.copy];
      const cites = m.cites?.length ? '\n\nNguồn:\n' + m.cites.map((c) => `- ${c.ten} (đoạn ${c.idx + 1})`).join('\n') : '';
      await copyText(msgText(m) + cites);
      return toast('Đã sao chép câu trả lời');
    }
    const mk = e.target.closest('[data-make]');
    if (mk) {
      const i = +mk.dataset.make;
      const question = [...messages.slice(0, i)].reverse().find((x) => x.role === 'user')?.text || '';
      return openMakeDoc(ctx, messages[i].text, { question });
    }
    const dm = e.target.closest('[data-del-msg]');
    if (dm) {
      const i = +dm.dataset.delMsg;
      // Xóa câu trả lời cùng câu hỏi ngay trước nó.
      const start = i > 0 && messages[i - 1].role === 'user' ? i - 1 : i;
      const removed = messages.splice(start, i - start + 1);
      saveChat();
      renderMsgs();
      toast('Đã xóa', {
        timeout: 6000,
        action: {
          label: 'Hoàn tác',
          onClick: () => {
            messages.splice(start, 0, ...removed);
            saveChat();
            renderMsgs();
          },
        },
      });
    }
  });
  $('[data-clear-chat]', root).addEventListener('click', () => currentId && deleteThreads([currentId]));

  $$('[data-tpl]', root).forEach((b) =>
    b.addEventListener('click', () => {
      input.value = b.dataset.tpl;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }),
  );
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('[data-form]', root).requestSubmit();
    }
  });
  $('[data-form]', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    ensureThread(text);
    push({ role: 'user', text });
    busy = true;
    $('[data-send]', root).disabled = true;
    const bot = push({ role: 'bot', html: '<span class="typing"><span></span><span></span><span></span></span>' });
    try {
      const intent = await detectIntent(text);
      if (intent.action === 'bblk') await doInterview(bot, text, intent);
      else if (intent.action === 'form' && findForm(intent.formId)) await doForm(bot, text, findForm(intent.formId));
      else await doAnswer(bot, text);
    } catch (err) {
      bot.html = `<p class="note warn">${icon('alert', 'ic-sm')}<span>${escapeHtml(err.message)}</span></p>`;
      toast(err.message, { type: 'error', timeout: 6000 });
    } finally {
      busy = false;
      $('[data-send]', root).disabled = false;
      renderMsgs();
      saveChat();
    }
  });

  async function detectIntent(text) {
    const local = localIntent(text, FORMS);
    if (!aiOn() || local.action !== 'answer') return local;
    // Yêu cầu không rõ dạng → hỏi AI phân loại (có ghi nhớ kết quả).
    if (!/(tạo|lập|soạn|làm|viết)\s/i.test(text)) return local;
    try {
      const out = await streamClaude({ ...ctx.ai('legal'), system: KHO_SYSTEM, cache: true, maxTokens: 400, messages: [{ role: 'user', content: intentPrompt(text, FORMS) }] });
      const j = extractJson(out);
      if (j?.action) return j;
    } catch {
      /* dùng phân loại cục bộ */
    }
    return local;
  }

  /* ----- Hỏi đáp ----- */
  async function doAnswer(bot, question) {
    const pool = contextDocs();
    if (!pool.length) {
      bot.html = '<p>Kho chưa có tài liệu. Hãy tải lên hồ sơ, tài liệu trước.</p>';
      return;
    }
    const wantAll = /tóm tắt|tổng hợp|mâu thuẫn|so sánh|toàn bộ/i.test(question);
    let hits = searchDocs(question, pool, { limit: 10 });
    if (wantAll || hits.length < 3) {
      // Lấy phần đầu mỗi tài liệu để bao quát hồ sơ.
      const extra = pool.flatMap((d) => searchDocs(d.ten, [d], { limit: 2 }).concat(searchDocs('', [d], { limit: 2 })));
      const seen = new Set(hits.map((h) => `${h.docId}:${h.idx}`));
      for (const h of extra) if (!seen.has(`${h.docId}:${h.idx}`) && hits.length < 16) hits.push(h), seen.add(`${h.docId}:${h.idx}`);
    }
    if (!aiOn()) {
      bot.text = hits.length ? `**Kết quả tìm kiếm trong ${pool.length} tài liệu** (chế độ ngoại tuyến — chưa có AI tổng hợp):` : 'Không tìm thấy đoạn nào phù hợp trong kho.';
      bot.cites = hits;
      bot.html = null;
      return;
    }
    bot.cites = hits;
    bot.html = null;
    bot.text = '';
    await streamClaude({
      ...ctx.ai('legal'),
      system: KHO_SYSTEM,
      cache: true,
      messages: [{ role: 'user', content: answerPrompt(question, buildContext(hits)) }],
      onText: (_, all) => {
        bot.text = all;
        renderMsgs();
      },
    });
  }

  /* ----- Lập biên bản lời khai mới từ biên bản cũ ----- */
  async function doInterview(bot, request, intent) {
    const pool = contextDocs().filter((d) => STATEMENT.has(d.loai) && (d.qa?.length || d.text));
    if (!pool.length) {
      bot.html = '<p>Chưa có biên bản ghi lời khai/hỏi cung nào trong dữ liệu đã chọn. Tải lên các biên bản cũ (hoặc chọn biên bản đã ghi trong phần mềm) rồi thử lại.</p>';
      return;
    }
    // Chọn người: theo tên trong yêu cầu, hoặc người xuất hiện nhiều nhất.
    const want = String(intent.nguoi || '').trim().toLowerCase();
    const byName = {};
    for (const d of pool) {
      const n = (d.nguoi?.hoTen || '').trim();
      if (n) (byName[n] ||= []).push(d);
    }
    let name = Object.keys(byName).find((n) => want && (n.toLowerCase().includes(want) || want.includes(n.toLowerCase()))) || Object.keys(byName).find((n) => request.toLowerCase().includes(n.toLowerCase()));
    if (!name) name = Object.keys(byName).sort((a, b) => byName[b].length - byName[a].length)[0] || '';
    const olds = name ? byName[name] : pool;
    const roleId = olds.find((d) => d.roleId)?.roleId || (olds.some((d) => d.loai === 'hoi-cung') ? 'bi-can' : 'lam-chung');
    const focus = String(intent.focus || '').replace(/^(tạo|lập).*?(cũ|trước)\s*/i, '').trim();
    let plan;
    let via = 'ngoại tuyến';
    if (aiOn()) {
      try {
        const out = await streamClaude({ ...ctx.ai('legal'), system: KHO_SYSTEM, cache: true, messages: [{ role: 'user', content: interviewPrompt(olds, { focus, nguoi: name, roleName: getRole(roleId).ten }) }] });
        const j = extractJson(out);
        if (j?.vanDe?.length) {
          plan = { tomTat: j.tomTat || '', issues: j.vanDe.map((v) => ({ tieuDe: v.tieuDe, canCu: v.canCu, cauHoi: (v.cauHoi || []).filter((x) => typeof x === 'string') })) };
          via = ctx.ai('legal').label;
        }
      } catch (err) {
        toast(`${err.message} — dùng phân tích ngoại tuyến`, { type: 'info', timeout: 5000 });
      }
    }
    plan ||= localInterviewPlan(olds, { focus, roleId });
    const caseId = olds.find((d) => d.caseId)?.caseId || (filterCase && filterCase !== '_none' ? filterCase : null);
    const caseItem = caseId ? casesRepo.get(caseId) : null;
    const rec = newRecord({ caseItem, roleId, settings: ctx.settings() });
    rec.nguoiKhai = { ...rec.nguoiKhai, ...personFromOlds(olds) };
    if (name) rec.nguoiKhai.hoTen = name;
    rec.lan = olds.length + 1;
    rec.plan = planFromIssues(plan.issues, uid);
    prefillQa(rec, uid);
    rec.nguon = olds.map((d) => d.ten);
    const saved = recordsRepo.save(rec);
    audit('Lập biên bản lời khai từ kho hồ sơ', `${name || 'chưa rõ tên'} — dựa trên ${olds.length} biên bản`);
    const nQ = rec.qa.length;
    bot.html = null;
    bot.text = `Đã lập **biên bản ${roleId === 'bi-can' ? 'hỏi cung' : 'ghi lời khai'} lần ${rec.lan}${name ? ` — ${name}` : ''}** theo Mẫu 140, dựa trên ${olds.length} biên bản cũ (${via}).\n\n${plan.tomTat ? `*${plan.tomTat}*\n\n` : ''}${plan.issues.map((is) => `- **${is.tieuDe}** (${is.cauHoi.length} câu)`).join('\n')}\n\nTổng cộng ${nQ} câu hỏi đã đưa sẵn vào biên bản (chưa trả lời) — mở để ghi lời khai hoặc xuất phiếu hỏi Word.`;
    bot.actions = `<div class="kho-actions"><a class="btn btn-primary btn-sm" href="#interview/${saved.id}">${icon('message', 'ic-sm')}Mở biên bản để ghi lời khai</a></div>`;
  }

  /* ----- Tạo văn bản theo mẫu ----- */
  async function doForm(bot, request, form) {
    const pool = contextDocs();
    const keys = formKeys(form).filter((k) => k !== 'so');
    const caseId = pool.find((d) => d.caseId)?.caseId || (filterCase && filterCase !== '_none' ? filterCase : '');
    const caseItem = caseId ? casesRepo.get(caseId) : null;
    // Người liên quan: theo tên trong yêu cầu hoặc người trong hồ sơ.
    const person = caseItem?.persons?.find((p) => request.toLowerCase().includes(String(p.hoTen).toLowerCase())) || null;
    const values = { ...prefillFromCase({ caseItem, person, org: ctx.settings().legalOrg || {} }) };
    if (!person) {
      const d = pool.find((x) => x.nguoi?.hoTen && request.toLowerCase().includes(x.nguoi.hoTen.toLowerCase()));
      if (d) {
        values.hoTen = d.nguoi.hoTen;
        values.nhanThan = nhanThanText(d.nguoi);
      }
    }
    let via = 'ngoại tuyến (điền từ hồ sơ)';
    if (aiOn() && pool.length) {
      const hits = searchDocs(`${request} ${form.ten}`, pool, { limit: 10 });
      try {
        const labels = Object.fromEntries(keys.map((k) => [k, FIELDS[k].label]));
        const out = await streamClaude({ ...ctx.ai('legal'), system: KHO_SYSTEM, cache: true, messages: [{ role: 'user', content: formPrompt(form, keys, labels, buildContext(hits), request) }] });
        const j = extractJson(out);
        for (const [k, v] of Object.entries(j?.values || {})) if (keys.includes(k) && String(v || '').trim()) values[k] = String(v).trim();
        via = ctx.ai('legal').label;
        bot.cites = hits;
      } catch (err) {
        toast(`${err.message} — điền từ hồ sơ`, { type: 'info', timeout: 5000 });
      }
    }
    values.mauSo = ctx.settings().legalOrg?.formNos?.[form.id] || '';
    const saved = legalDocsRepo.save({ formId: form.id, caseId: caseItem?.id || null, personId: person?.id || null, values, title: `${form.ten}${values.hoTen ? ' — ' + values.hoTen : ''}` });
    audit('Tạo văn bản tố tụng từ kho hồ sơ', form.ten);
    const filled = keys.filter((k) => String(values[k] || '').trim()).length;
    bot.html = null;
    bot.text = `Đã tạo **${form.ten}** theo mẫu (${via}): điền ${filled}/${keys.length} trường. Mở văn bản để rà soát, bổ sung chỗ trống rồi xuất Word.`;
    bot.actions = `<div class="kho-actions"><a class="btn btn-primary btn-sm" href="#forms/doc/${saved.id}">${icon('file', 'ic-sm')}Mở văn bản</a></div>`;
  }

  renderCaseSelect();
  renderMode();
  renderMsgs();
  renderThreadInfo();
  reload();
}
