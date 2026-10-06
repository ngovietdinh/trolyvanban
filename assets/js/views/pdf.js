// PDF sang Word: chọn tệp PDF / ảnh → chế độ (tự động, OCR, AI đọc ảnh) → chuyển → xem trước → tải .docx.
import { $, $$, icon, toast, escapeHtml, copyText, downloadBlob } from '../ui.js';
import { inspectFile, convertFile } from '../lib/pdf-convert.js';
import { buildFlowDocx, flowToText } from '../lib/docx-flow.js';
import { aiReadPage, aiFixLines } from '../lib/pdf-ai.js';
import { streamClaude } from '../lib/ai.js';
import { safeFileName } from '../lib/docx.js';
import { store, usage } from '../lib/store.js';
import { audit } from '../lib/accounts.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX = 60 * 1024 * 1024;
const KIND = { text: ['Có lớp chữ', 'badge-success', 'Giữ nguyên chữ gốc — chính xác tuyệt đối về nội dung.'], scan: ['Ảnh quét', 'badge-warning', 'Cần nhận dạng chữ (OCR).'], mixed: ['Hỗn hợp', 'badge-warning', 'Trang có chữ giữ nguyên, trang ảnh quét dùng OCR.'], image: ['Ảnh chụp', 'badge-warning', 'Nhận dạng chữ (OCR) từ ảnh.'] };
const PAGE_KIND = { text: 'Chữ gốc', ocr: 'OCR', ai: 'AI đọc ảnh' };

/** Xem trước doc model dạng trang A4 (đơn vị pt, thu phóng theo khung). */
export function flowToHtml(doc) {
  const runHtml = (r) => {
    let t = escapeHtml(r.text).replace(/\t/g, '<span class="pw-tab"></span>');
    const st = [`font-size:${r.size || 13}pt`, r.font && r.font !== 'Times New Roman' ? `font-family:'${r.font}',sans-serif` : ''].filter(Boolean).join(';');
    if (r.bold) t = `<b>${t}</b>`;
    if (r.italic) t = `<i>${t}</i>`;
    if (r.sup) t = `<sup>${t}</sup>`;
    return `<span style="${st}">${t}</span>`;
  };
  const para = (b) => {
    const st = [`text-align:${b.align === 'justify' ? 'justify' : b.align || 'left'}`, b.indentLeft ? `padding-left:${b.indentLeft}pt` : '', b.indentFirst ? `text-indent:${b.indentFirst}pt` : '', b.before ? `margin-top:${b.before}pt` : '', b.line ? `line-height:${(b.line * 1.15).toFixed(2)}` : ''].filter(Boolean).join(';');
    return `<p style="${st}">${(b.runs || []).map(runHtml).join('') || '&nbsp;'}</p>`;
  };
  const block = (b) =>
    b.type === 'table'
      ? `<table class="pw-table ${b.borders ? 'grid' : ''}" style="${b.before ? `margin-top:${b.before}pt` : ''}"><colgroup>${b.cols.map((w) => `<col style="width:${w}pt">`).join('')}</colgroup>${b.rows.map((r) => `<tr>${r.map((c) => `<td${c.span > 1 ? ` colspan="${c.span}"` : ''}>${(c.blocks || []).map(block).join('')}</td>`).join('')}</tr>`).join('')}</table>`
      : para(b);
  return doc.pages
    .map((p, i) => {
      const m = p.margins || {};
      return `<div class="pw-wrap" data-pw="${i}"><div class="pw-page" style="width:${p.width}pt;min-height:${p.height}pt;padding:${m.top}pt ${m.right}pt ${m.bottom}pt ${m.left}pt">${p.blocks.map(block).join('')}</div><span class="pw-num">Trang ${i + 1} · ${PAGE_KIND[p.kind] || ''}</span></div>`;
    })
    .join('');
}

export function render(ctx) {
  let file = null;
  let info = null;
  let result = null;
  let controller = null;
  const opts = { mode: 'auto', fixFonts: true, aiFix: ctx.hasAI(), dropPageNumbers: true, ...store.get('pdf-opts', {}) };
  if (opts.mode === 'ai' && !ctx.hasAI()) opts.mode = 'auto';

  ctx.view.innerHTML = `
  <div class="page pw">
    <div class="page-head">
      <div><h1 class="page-title">PDF sang <em>Word</em></h1><p class="page-sub">Chuyển PDF — kể cả bản scan, ảnh chụp văn bản — thành Word giữ bố cục: đoạn văn, căn lề, thụt dòng, chữ đậm/nghiêng, bảng, phần đầu văn bản hai cột. Tự sửa chữ phông cũ TCVN3, VNI.</p></div>
    </div>
    <div class="pw-grid">
      <section class="panel pw-opts">
        <div class="panel-body" style="display:grid;gap:16px">
          <label class="dropzone" data-drop>
            <input type="file" accept="application/pdf,.pdf,image/*" data-file aria-label="Chọn tệp PDF hoặc ảnh" />
            <span class="dz-icon">${icon('upload')}</span>
            <span><strong>Chọn hoặc kéo thả tệp PDF, ảnh chụp</strong><small>PDF, JPG, PNG · tối đa 60 MB · xử lý ngay trên máy</small></span>
          </label>
          <div data-info></div>
          <fieldset class="pw-modes"><legend class="label">Cách đọc</legend>
            ${modeCard('auto', 'Tự động (khuyên dùng)', 'Trang có chữ: giữ nguyên chữ gốc và định dạng. Trang ảnh quét: nhận dạng chữ (OCR).', 'zap')}
            ${modeCard('ocr', 'Nhận dạng chữ mọi trang', 'Dùng khi PDF có chữ bị lỗi phông, ra ký tự lạ.', 'eye')}
            ${modeCard('ai', 'AI đọc ảnh — chính xác nhất', ctx.hasAI() ? 'Gửi ảnh từng trang tới AI để chép lại (bản quét mờ, chữ in đậm, chữ hoa có dấu).' : 'Cần quyền AI và API key trong Cài đặt.', 'sparkles', !ctx.hasAI())}
          </fieldset>
          <div class="pw-checks">
            <label class="check"><input type="checkbox" data-opt="fixFonts" ${opts.fixFonts ? 'checked' : ''} />Tự sửa chữ phông cũ (TCVN3 .VnTime, VNI-Times)</label>
            <label class="check" ${ctx.hasAI() ? '' : 'title="Cần quyền AI và API key"'}><input type="checkbox" data-opt="aiFix" ${opts.aiFix && ctx.hasAI() ? 'checked' : ''} ${ctx.hasAI() ? '' : 'disabled'} />AI soát lỗi chính tả sau khi nhận dạng (OCR)</label>
            <label class="check"><input type="checkbox" data-opt="dropPageNumbers" ${opts.dropPageNumbers ? 'checked' : ''} />Bỏ số trang ở đầu/cuối trang</label>
          </div>
          <div class="pw-range"><span class="label">Trang</span><input class="input" type="number" min="1" placeholder="từ" data-from aria-label="Từ trang" /><span>–</span><input class="input" type="number" min="1" placeholder="đến" data-to aria-label="Đến trang" /><span class="hint">để trống: tất cả</span></div>
          <button class="btn btn-primary btn-lg" type="button" data-go disabled>${icon('file', 'ic-sm')}<span data-go-label>Chuyển sang Word</span></button>
          <p class="hint pw-privacy">${icon('lock', 'ic-sm')}<span>Tệp được xử lý trên máy của bạn. Chỉ khi chọn chế độ AI, ảnh hoặc chữ của trang mới được gửi tới dịch vụ AI bạn đã cài.</span></p>
        </div>
      </section>
      <section class="panel pw-out" aria-live="polite" data-out></section>
    </div>
  </div>`;

  const root = ctx.view;
  const out = $('[data-out]', root);

  function modeCard(id, title, desc, ic, disabled = false) {
    return `<label class="pw-mode ${opts.mode === id ? 'on' : ''} ${disabled ? 'off' : ''}"><input type="radio" name="pw-mode" value="${id}" ${opts.mode === id ? 'checked' : ''} ${disabled ? 'disabled' : ''} /><span class="quick-icon">${icon(ic, 'ic-sm')}</span><span><strong>${title}</strong><small>${desc}</small></span></label>`;
  }
  const saveOpts = () => store.set('pdf-opts', opts);

  function renderEmpty() {
    out.innerHTML = `<div class="empty pw-empty"><div class="empty-icon">${icon('file', 'ic-lg')}</div><h3>Chưa có tệp</h3><p>Chọn tệp PDF hoặc ảnh chụp văn bản ở bên trái.</p>
      <ul class="pw-feats"><li>${icon('check', 'ic-sm')}PDF có chữ: giữ nguyên 100% nội dung, dựng lại đoạn, căn lề, bảng, chữ đậm/nghiêng</li><li>${icon('check', 'ic-sm')}PDF scan, ảnh chụp: nhận dạng chữ tiếng Việt ngay trên máy (≈ 99% với bản quét rõ)</li><li>${icon('check', 'ic-sm')}Văn bản cũ gõ phông .VnTime, VNI-Times: tự chuyển sang Unicode</li><li>${icon('check', 'ic-sm')}Có AI: soát lỗi hoặc đọc ảnh để đạt độ chính xác cao nhất</li></ul></div>`;
  }

  function renderInfo() {
    const box = $('[data-info]', root);
    if (!file) return (box.innerHTML = '');
    const k = info ? KIND[info.kind] : null;
    box.innerHTML = `<div class="pw-file">${icon('file')}<div><strong>${escapeHtml(file.name)}</strong><small>${(file.size / 1024 / 1024).toFixed(file.size > 1048576 ? 1 : 2)} MB${info ? ` · ${info.pages} trang` : ' · đang đọc…'}</small>${k ? `<small>${k[2]}</small>` : ''}</div>${k ? `<span class="badge ${k[1]}">${k[0]}</span>` : ''}<button class="btn btn-ghost btn-sm btn-icon" type="button" data-clear aria-label="Bỏ tệp">${icon('x', 'ic-sm')}</button></div>`;
    $('[data-clear]', box).addEventListener('click', () => {
      if (controller) return;
      file = info = result = null;
      renderInfo();
      renderEmpty();
      $('[data-go]', root).disabled = true;
    });
  }

  async function pick(f) {
    if (!f) return;
    if (!/pdf$|^image\//.test(f.type) && !/\.(pdf|jpe?g|png|webp|bmp|gif|tiff?)$/i.test(f.name)) return toast('Chọn tệp PDF hoặc ảnh (JPG, PNG)', { type: 'error' });
    if (f.size > MAX) return toast('Tệp lớn hơn 60 MB', { type: 'error' });
    file = f;
    info = null;
    result = null;
    renderInfo();
    renderEmpty();
    try {
      info = await inspectFile(f);
      // Gợi ý chế độ phù hợp.
      if (info.kind === 'scan' && ctx.hasAI() && opts.mode === 'auto') toast('PDF dạng ảnh quét — có thể chọn “AI đọc ảnh” để chính xác nhất', { type: 'info', timeout: 5000 });
      renderInfo();
      $('[data-to]', root).placeholder = String(info.pages);
      $('[data-go]', root).disabled = false;
    } catch (err) {
      file = null;
      renderInfo();
      toast(/password/i.test(err?.name + err?.message) ? 'PDF có mật khẩu — hãy bỏ mật khẩu rồi thử lại' : `Không đọc được tệp: ${err.message}`, { type: 'error', timeout: 6000 });
    }
  }

  function progress(p) {
    const pct = Math.round(((p.page - 1 + (p.pct || 0)) / p.total) * 100);
    out.innerHTML = `<div class="pw-progress"><div class="spinner" aria-hidden="true"></div><strong>Đang chuyển… ${pct}%</strong><div class="bar"><span style="width:${pct}%"></span></div><small>Trang ${p.page}/${p.total} · ${escapeHtml(p.stage)}${p.pct && p.pct < 1 && /OCR/.test(p.stage) ? ` ${Math.round(p.pct * 100)}%` : ''}</small><small class="hint">Lần đầu dùng nhận dạng chữ, trình duyệt tải bộ dữ liệu tiếng Việt (~5 MB) — các lần sau nhanh hơn.</small></div>`;
  }

  async function run() {
    if (controller) return controller.abort();
    if (!file) return;
    const label = $('[data-go-label]', root);
    controller = new AbortController();
    label.textContent = 'Dừng';
    const ai = ctx.hasAI() ? ctx.ai() : null;
    const call = (o) => streamClaude({ ...ai, signal: controller.signal, ...o });
    const t0 = performance.now();
    try {
      const from = +$('[data-from]', root).value || undefined;
      const to = +$('[data-to]', root).value || undefined;
      const r = await convertFile(file, {
        mode: opts.mode,
        from,
        to,
        fixFonts: opts.fixFonts,
        dropPageNumbers: opts.dropPageNumbers,
        signal: controller.signal,
        onProgress: progress,
        aiPage: ai && opts.mode === 'ai' ? (b64) => aiReadPage(call, b64) : null,
        aiFix: ai && opts.aiFix && opts.mode !== 'ai' ? (lines) => aiFixLines(call, lines) : null,
      });
      result = { ...r, ms: performance.now() - t0 };
      usage.track('pdf');
      audit('Chuyển PDF sang Word', `${file.name} — ${r.doc.pages.length} trang`);
      renderResult();
    } catch (err) {
      if (/^Đã dừng/.test(err.message)) {
        toast('Đã dừng chuyển đổi', { type: 'info' });
        result ? renderResult() : renderEmpty();
      } else {
        out.innerHTML = `<div class="empty"><div class="empty-icon">${icon('alert', 'ic-lg')}</div><h3>Không chuyển được</h3><p>${escapeHtml(err.message || String(err))}</p></div>`;
      }
    } finally {
      controller = null;
      label.textContent = 'Chuyển sang Word';
    }
  }

  function renderResult() {
    const { doc, stats } = result;
    const parts = [stats.text ? `${stats.text} trang giữ chữ gốc` : '', stats.ocr ? `${stats.ocr} trang OCR${stats.confidence ? ` (độ tin cậy ${stats.confidence}%)` : ''}` : '', stats.ai ? `${stats.ai} trang AI đọc ảnh` : '', stats.aiFixed ? `AI đã soát lỗi ${stats.aiFixed} trang` : ''].filter(Boolean);
    out.innerHTML = `
      <div class="pw-res-head">
        <div><strong>${escapeHtml(doc.title)}.docx</strong><small>${doc.pages.length} trang · ${parts.join(' · ')} · ${(result.ms / 1000).toFixed(1)} giây</small></div>
        <div class="inline">
          <button class="btn btn-primary" type="button" data-dl>${icon('download', 'ic-sm')}Tải Word (.docx)</button>
          <button class="btn" type="button" data-copy>${icon('copy', 'ic-sm')}Sao chép chữ</button>
          ${ctx.can('tools') ? `<button class="btn btn-ghost" type="button" data-spell>${icon('spell', 'ic-sm')}Kiểm tra chính tả</button>` : ''}
          ${ctx.can('legal') ? `<button class="btn btn-ghost" type="button" data-kho>${icon('folder', 'ic-sm')}Lưu vào Kho hồ sơ</button>` : ''}
        </div>
      </div>
      ${stats.warnings?.length ? `<p class="note warn">${icon('alert', 'ic-sm')}<span>${stats.warnings.map(escapeHtml).join('<br>')}</span></p>` : ''}
      ${stats.ocr && !stats.aiFixed ? `<p class="note">${icon('info', 'ic-sm')}<span>Trang nhận dạng chữ (OCR) có thể còn lỗi nhỏ ở chữ in hoa, chữ mờ — nên rà soát hoặc dùng “Kiểm tra chính tả”${ctx.hasAI() ? ', bật “AI soát lỗi” hoặc chế độ “AI đọc ảnh”' : ''}.</span></p>` : ''}
      <div class="pw-preview" data-preview>${flowToHtml(doc)}</div>`;
    fitPreview();
    $('[data-dl]', out).addEventListener('click', () => {
      downloadBlob(buildFlowDocx(doc, doc.title), safeFileName(doc.title), DOCX_MIME);
      usage.track('export');
      toast('Đã tải tệp Word');
    });
    $('[data-copy]', out).addEventListener('click', async () => {
      await copyText(flowToText(doc));
      toast('Đã sao chép toàn bộ chữ');
    });
    $('[data-spell]', out)?.addEventListener('click', () => {
      store.set('spell-text', flowToText(doc));
      ctx.navigate('#spell');
    });
    $('[data-kho]', out)?.addEventListener('click', async () => {
      const [{ khoDb }, { analyzeDoc }] = await Promise.all([import('../lib/kho-db.js'), import('../legal/kho.js')]);
      const text = flowToText(doc);
      const a = analyzeDoc(text);
      await khoDb.put({ ten: doc.title, fileName: file.name, mime: file.type, size: file.size, blob: file, text, pages: doc.pages.length, loai: a.loai, tieuDe: a.tieuDe, ngay: a.ngay, nguoi: a.nguoi, tuCach: a.tuCach, roleId: a.roleId, qa: a.qa, caseId: null });
      toast('Đã lưu vào Kho hồ sơ', { action: { label: 'Mở kho', onClick: () => ctx.navigate('#kho') } });
    });
  }

  // Thu phóng trang xem trước cho vừa khung.
  function fitPreview() {
    const box = $('[data-preview]', out);
    if (!box) return;
    const avail = box.clientWidth - 8;
    $$('.pw-wrap', box).forEach((w) => {
      const pg = w.firstElementChild;
      const k = Math.min(1, avail / pg.offsetWidth);
      pg.style.transform = `scale(${k})`;
      w.style.height = `${pg.offsetHeight * k + 26}px`;
      w.style.width = `${pg.offsetWidth * k}px`;
    });
  }
  const ro = new ResizeObserver(() => fitPreview());
  ro.observe(out);

  $('[data-file]', root).addEventListener('change', (e) => {
    pick(e.target.files[0]);
    e.target.value = '';
  });
  const dz = $('[data-drop]', root);
  ['dragenter', 'dragover'].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add('drag');
    }),
  );
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, () => dz.classList.remove('drag')));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    pick(e.dataTransfer.files[0]);
  });
  $$('input[name="pw-mode"]', root).forEach((r) =>
    r.addEventListener('change', () => {
      opts.mode = r.value;
      $$('.pw-mode', root).forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
      saveOpts();
    }),
  );
  $$('[data-opt]', root).forEach((c) =>
    c.addEventListener('change', () => {
      opts[c.dataset.opt] = c.checked;
      saveOpts();
    }),
  );
  $('[data-go]', root).addEventListener('click', run);
  renderEmpty();
  return () => {
    controller?.abort();
    ro.disconnect();
  };
}
