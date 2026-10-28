// Trang "Kho bản án, án lệ": nạp bản án đã xét xử và án lệ (Word, PDF, ảnh, .txt hoặc dán) để tìm bản án tương tự, đối
// chiếu án lệ; lưu trên máy, riêng tài khoản.
import { $, icon, toast, escapeHtml, warnMissing } from '../ui.js';
import { courtBaDb } from '../legal/court-ba-db.js';
import { parseKhoDoc, hinhPhatNgan } from '../legal/court-similar.js';
import { fmtVnd } from '../legal/court.js';
import { dropzoneHtml, bindDropzone, readAll } from './acts-review.js';
import { AN_LE_PORTAL, BAN_AN_PORTAL } from '../legal/an-le-catalog.js';
import { fetchDocument, htmlToText, isHtmlFile } from '../lib/net-fetch.js';
import { copyText } from '../ui.js';
import { isDesktop } from '../lib/platform.js';

export async function renderKho(ctx) {
  const root = ctx.view;
  let filter = { loai: '', q: '' };
  let docs = await courtBaDb.list().catch(() => []);
  if (!root.isConnected) return;
  root.innerHTML = `<div class="page ct-page" data-kho>
    <a class="rd-back" href="#toa-an">${icon('chevron-left', 'ic-sm')}Tòa án</a>
    <div class="page-head"><div><h1 class="page-title">Kho bản án, <em>án lệ</em></h1><p class="page-sub">Nạp bản án hình sự đã xét xử và án lệ để tra cứu bản án tương tự, thống kê mức án, đối chiếu án lệ khi thẩm tra. Phần mềm đọc tội danh, điều – khoản – điểm, hình phạt, tình tiết, giá trị tài sản; án lệ: khái quát nội dung, điều luật liên quan. Lưu trên máy, riêng tài khoản của bạn.</p></div></div>
    <section class="panel ct-sec" data-kho-up><h2>${icon('upload', 'ic-sm')}Nạp văn bản</h2>
      <div class="grid-2"><div class="field"><label>Tệp bản án / án lệ (chọn được nhiều tệp)</label>${dropzoneHtml('Word .doc/.docx, PDF (kể cả bản scan), ảnh chụp, .txt')}</div>
      <div class="field"><label for="kho-paste">Hoặc dán nội dung</label><textarea class="textarea" id="kho-paste" rows="4" data-kho-paste placeholder="Dán toàn văn bản án hoặc án lệ…"></textarea></div></div>
      <div class="inline"><button class="btn btn-primary btn-sm" type="button" data-kho-add>${icon('plus', 'ic-sm')}Thêm vào kho</button><span class="hint" data-kho-say aria-live="polite"></span></div>
    </section>
    <section class="panel ct-sec" data-kho-net><h2>${icon('link', 'ic-sm')}Tìm bản án, án lệ trên mạng</h2>
      <p class="hint">Bản án đã công bố nằm trên Cổng công bố bản án, quyết định của Tòa án; án lệ nằm trên Cổng án lệ. Hai cổng không cho phần mềm khác tìm hộ, nên phần mềm sao chép từ khóa rồi mở cổng trong trình duyệt. Tải tệp bản án (Word, PDF) về rồi kéo vào ô “Nạp văn bản” ở trên, hoặc dán đường dẫn tệp vào ô dưới để tải thẳng vào kho${isDesktop ? '' : ' (bản web chỉ tải được từ trang cho phép tải chéo; bản cài đặt máy tính tải được mọi đường dẫn)'}.</p>
      <div class="inline"><input class="input input-sm kho-kw" type="search" data-kho-kw placeholder="Từ khóa: tội danh, điều luật, tên Tòa án, năm… (sao chép sẵn khi mở cổng)" aria-label="Từ khóa tìm trên mạng" /><button class="btn btn-sm" type="button" data-kho-open="ban-an">${icon('link', 'ic-sm')}Cổng công bố bản án</button><button class="btn btn-sm" type="button" data-kho-open="an-le">${icon('link', 'ic-sm')}Cổng án lệ</button><a class="btn btn-sm btn-ghost" href="#toa-an/an-le">${icon('layers', 'ic-sm')}Danh mục án lệ</a></div>
      <div class="inline"><input class="input input-sm kho-url" type="url" data-kho-url placeholder="https://… đường dẫn tệp .doc/.docx/.pdf hoặc trang bản án" aria-label="Đường dẫn tải" /><button class="btn btn-sm btn-primary" type="button" data-kho-fetch>${icon('download', 'ic-sm')}Tải vào kho</button><span class="hint" data-kho-net-say aria-live="polite"></span></div>
    </section>
    <section class="panel ct-sec"><h2>${icon('book', 'ic-sm')}Văn bản trong kho <small data-kho-count></small></h2>
      <div class="inline"><select class="select input-sm" data-kho-loai><option value="">Tất cả</option><option value="ban-an">Bản án</option><option value="an-le">Án lệ</option></select><input class="input input-sm" type="search" data-kho-q placeholder="Lọc: số, tòa, bị cáo, điều…" aria-label="Lọc kho" /></div>
      <div data-kho-list></div>
    </section>
  </div>`;
  const page = $('[data-kho]', root);
  const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  function drawList() {
    const list = docs.filter((d) => (!filter.loai || d.loai === filter.loai) && (!filter.q || fold([d.so, d.ten, d.toa, ...(d.bc || []).map((b) => `${b.hoTen} dieu ${b.dieu}`), ...(d.dieu || []).map((x) => `dieu ${x}`)].join(' ')).includes(fold(filter.q))));
    $('[data-kho-count]', page).textContent = `${docs.filter((d) => d.loai === 'ban-an').length} bản án · ${docs.filter((d) => d.loai === 'an-le').length} án lệ`;
    $('[data-kho-list]', page).innerHTML = list.length
      ? `<div class="tt-table-wrap"><table class="cf-table tt-table"><thead><tr><th>Văn bản</th><th>Nội dung đọc được</th><th></th></tr></thead><tbody>${list
          .map((d) => `<tr data-kho-row="${d.id}"><td><span class="badge">${d.loai === 'an-le' ? 'Án lệ' : 'Bản án'}</span> <strong>${escapeHtml(d.so || d.ten)}</strong><small>${escapeHtml([d.toa, d.ngay, d.name].filter(Boolean).join(' · '))}</small></td><td>${
            d.loai === 'an-le'
              ? `${escapeHtml(d.ten || '')}${d.dieu?.length ? `<small>Điều luật liên quan: ${escapeHtml(d.dieu.join(', '))}</small>` : '<small>Chưa đọc được điều luật liên quan</small>'}`
              : (d.bc || []).length
                ? d.bc.map((b) => `${escapeHtml(b.hoTen)}: ${b.khoan ? `khoản ${b.khoan} ` : ''}Điều ${escapeHtml(b.dieu)} — ${escapeHtml(hinhPhatNgan(b.hinhPhat))}`).join('<br>') + (d.soTien ? `<small>Giá trị: ${fmtVnd(d.soTien)}</small>` : '')
                : '<small>Chưa đọc được phần quyết định (cần câu “Áp dụng … Xử phạt bị cáo …”)</small>'
          }</td><td class="cf-row-act"><button class="btn btn-sm btn-ghost btn-icon" type="button" data-kho-view="${d.id}" aria-label="Xem nguyên văn">${icon('eye', 'ic-sm')}</button><button class="btn btn-sm btn-ghost btn-icon" type="button" data-kho-del="${d.id}" aria-label="Xóa khỏi kho">${icon('trash', 'ic-sm')}</button></td></tr>`)
          .join('')}</tbody></table></div>`
      : `<p class="hint">${docs.length ? 'Không có văn bản khớp bộ lọc.' : 'Kho đang trống — nạp bản án, án lệ ở trên.'}</p>`;
  }
  let files = [];
  bindDropzone($('[data-kho-up]', page), (f) => (files = f));
  const say = (t) => ($('[data-kho-say]', page).textContent = t);
  $('[data-kho-add]', page).addEventListener('click', async () => {
    const ta = $('[data-kho-paste]', page);
    if (!files.length && !ta.value.trim()) return warnMissing('Chưa có văn bản: chọn tệp hoặc dán nội dung', ta);
    let n = 0;
    for (const f of [...files]) {
      try {
        const text = await readAll([f], '', say);
        await courtBaDb.put(parseKhoDoc(text, f.name));
        n++;
      } catch (e) {
        toast(e.message, { type: 'error', timeout: 6000 });
      }
    }
    if (ta.value.trim()) {
      await courtBaDb.put(parseKhoDoc(ta.value, `Văn bản dán ${docs.length + n + 1}`));
      n++;
      ta.value = '';
    }
    files.splice(0);
    say('');
    $('[data-kho-up] [data-files]', page).innerHTML = '';
    docs = await courtBaDb.list();
    drawList();
    toast(`Đã thêm ${n} văn bản vào kho`);
  });
  page.addEventListener('input', (e) => {
    if (e.target.matches('[data-kho-q]')) (filter.q = e.target.value.trim()), drawList();
  });
  page.addEventListener('change', (e) => {
    if (e.target.matches('[data-kho-loai]')) (filter.loai = e.target.value), drawList();
  });
  const netSay = (t) => ($('[data-kho-net-say]', page).textContent = t);
  page.addEventListener('click', async (e) => {
    const open = e.target.closest('[data-kho-open]');
    const fetchBtn = e.target.closest('[data-kho-fetch]');
    if (open) {
      const kw = $('[data-kho-kw]', page).value.trim();
      if (kw) {
        await copyText(kw);
        toast(`Đã sao chép “${kw}” — dán vào ô tìm kiếm của cổng`);
      }
      window.open(open.dataset.khoOpen === 'an-le' ? AN_LE_PORTAL : BAN_AN_PORTAL, '_blank', 'noopener');
      return;
    }
    if (fetchBtn) {
      const urlInp = $('[data-kho-url]', page);
      const url = urlInp.value.trim();
      if (!url) return warnMissing('Chưa có đường dẫn: dán địa chỉ tệp bản án hoặc trang bản án', urlInp);
      fetchBtn.disabled = true;
      netSay('Đang tải…');
      try {
        const { file, name } = await fetchDocument(url);
        const text = isHtmlFile(file) ? htmlToText(await file.text()) : await readAll([file], '', netSay);
        if (!text.trim()) throw new Error('Không đọc được chữ từ tệp đã tải');
        const doc = parseKhoDoc(text, name);
        doc.url = url;
        await courtBaDb.put(doc);
        docs = await courtBaDb.list();
        drawList();
        urlInp.value = '';
        netSay('');
        toast(`Đã tải “${name}” vào kho${doc.loai === 'an-le' ? ` (án lệ ${doc.so || ''})` : doc.so ? ` (bản án ${doc.so})` : ''}`);
      } catch (err) {
        netSay('');
        toast(err.message, { type: 'error', timeout: 9000 });
      } finally {
        fetchBtn.disabled = false;
      }
      return;
    }
    const del = e.target.closest('[data-kho-del]');
    const view = e.target.closest('[data-kho-view]');
    if (del) {
      await courtBaDb.remove(del.dataset.khoDel);
      docs = docs.filter((d) => d.id !== del.dataset.khoDel);
      drawList();
      toast('Đã xóa khỏi kho');
    } else if (view) {
      const d = docs.find((x) => x.id === view.dataset.khoView);
      ctx.modal(`<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button><h2 class="modal-title">${escapeHtml(d.so || d.ten)}</h2><pre class="kho-text">${escapeHtml(d.text || '')}</pre><div class="modal-actions"><button class="btn" type="button" data-close>Đóng</button></div>`, { className: 'modal-wide', label: 'Nguyên văn' });
    }
  });
  filter = { loai: '', q: '' };
  drawList();
}
