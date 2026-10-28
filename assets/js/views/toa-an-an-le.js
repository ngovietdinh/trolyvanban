// Trang "Án lệ": danh mục đủ 90 án lệ của Hội đồng Thẩm phán TANDTC kèm TOÀN VĂN (assets/data/an-le.json, lấy từ Cổng án
// lệ anle.toaan.gov.vn): lọc theo lĩnh vực / từ khóa / điều luật, xem tình huống – giải pháp pháp lý – quy định liên quan –
// toàn văn, nạp từng án lệ hoặc tất cả vào kho của tài khoản (để thẩm tra đối chiếu, xuất báo cáo). Vẫn nạp được tệp /
// văn bản dán của người dùng cho án lệ mới chưa có trong gói.
import { $, $$, icon, toast, escapeHtml, warnMissing, copyText } from '../ui.js';
import { AN_LE, LINH_VUC, AN_LE_PORTAL, withKho, findAnLe } from '../legal/an-le-catalog.js';
import { loadAnLeData, khoDocFromData } from '../legal/an-le-data.js';
import { courtBaDb } from '../legal/court-ba-db.js';
import { parseKhoDoc } from '../legal/court-similar.js';
import { readAll } from './acts-review.js';
import { foldKeep, tokens, matchAt } from '../lib/universal-search.js';

const hasAll = (text, toks) => {
  const f = foldKeep(text);
  return toks.every((t) => matchAt(f, t).length);
};
const cap1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const para = (s) =>
  String(s || '')
    .split(/\n{2,}|\n(?=\s*[-–•])/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => `<p>${escapeHtml(x).replace(/\n/g, ' ')}</p>`)
    .join('');

export async function renderAnLe(ctx, params = []) {
  const root = ctx.view;
  const filter = { linhVuc: LINH_VUC[params[0]] ? params[0] : '', q: '', thieu: false };
  let [docs, data] = await Promise.all([courtBaDb.list().catch(() => []), loadAnLeData()]);
  if (!root.isConnected) return;
  const page = () => $('[data-al]', root);
  const coToanVan = AN_LE.filter((a) => data.get(a.so)?.text).length;

  root.innerHTML = `<div class="page ct-page" data-al>
    <a class="rd-back" href="#toa-an">${icon('chevron-left', 'ic-sm')}Tòa án</a>
    <div class="page-head"><div><h1 class="page-title">Án lệ</h1><p class="page-sub">${AN_LE.length} án lệ do Hội đồng Thẩm phán Tòa án nhân dân tối cao thông qua (01/2016/AL → ${AN_LE.at(-1).so}), ${coToanVan} án lệ có toàn văn kèm phần mềm lấy từ Cổng án lệ của Tòa án; ${AN_LE.filter((a) => a.linhVuc === 'hs').length} án lệ hình sự ghi điều luật liên quan. Nạp vào kho để tab Bản án tương tự đối chiếu theo điều luật và đưa vào báo cáo thẩm tra.</p></div>
      <div class="inline"><button class="btn btn-primary" type="button" data-al-add-all>${icon('download', 'ic-sm')}Nạp tất cả vào kho</button><a class="btn btn-ghost" href="${AN_LE_PORTAL}" target="_blank" rel="noopener">${icon('link', 'ic-sm')}Cổng án lệ TANDTC</a><a class="btn btn-ghost" href="#toa-an/kho-ban-an">${icon('book', 'ic-sm')}Kho bản án, án lệ</a></div></div>
    <section class="panel ct-sec">
      <div class="inline al-filters">
        <select class="select input-sm" data-al-lv aria-label="Lĩnh vực"><option value="">Tất cả lĩnh vực</option>${Object.entries(LINH_VUC).map(([k, v]) => `<option value="${k}" ${k === filter.linhVuc ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <input class="input input-sm al-q" type="search" data-al-q placeholder="Tìm: số án lệ, từ khóa, điều luật (vd: 174, lừa đảo, giết người)…" aria-label="Tìm án lệ" />
        <label class="check"><input type="checkbox" data-al-thieu />Chỉ án lệ chưa nạp vào kho</label>
        <span class="hint" data-al-count></span>
      </div>
      <div data-al-list></div>
    </section>
  </div>`;

  function drawList() {
    const all = withKho(docs);
    const toks = tokens(filter.q);
    const q = filter.q.trim();
    const num = /^\d{1,3}$/.test(q) ? +q : null;
    const list = all.filter((a) => {
      if (filter.linhVuc && a.linhVuc !== filter.linhVuc) return false;
      if (filter.thieu && a.doc) return false;
      if (!toks.length) return true;
      const d = data.get(a.so);
      return a.num === num || a.dieu.includes(q) || hasAll(`${a.so} ${a.ten} ${LINH_VUC[a.linhVuc]} ${a.dieu.map((x) => `dieu ${x}`).join(' ')} ${d?.tuKhoa || ''} ${d?.tinhHuong || ''} ${d?.giaiPhap || ''} ${d?.khaiQuat || ''}`, toks);
    });
    const co = all.filter((a) => a.doc).length;
    $('[data-al-count]', page()).textContent = `${list.length}/${all.length} án lệ · ${co} đã nạp vào kho`;
    $('[data-al-list]', page()).innerHTML = list.length
      ? `<div class="tt-table-wrap"><table class="cf-table al-table"><thead><tr><th>Số</th><th>Án lệ</th><th>Lĩnh vực</th><th>Áp dụng từ</th><th>Toàn văn</th><th></th></tr></thead><tbody>${list
          .map((a) => {
            const d = data.get(a.so);
            return `<tr data-al-row="${a.so}"><td class="al-so"><b>${escapeHtml(a.so)}</b></td><td>${escapeHtml(cap1(a.tenNgan))}${a.dieu.length ? `<small>Điều luật liên quan: ${a.dieu.map((x) => `<a href="#binh-luan/${x}" class="law-link">Điều ${x}</a>`).join(', ')} BLHS</small>` : ''}<small>Thông qua ${escapeHtml(a.thongQua || '—')} · Quyết định ${escapeHtml(a.qdCongBo || '—')} ngày ${escapeHtml(a.ngayCongBo || '—')}</small></td><td><span class="badge">${LINH_VUC[a.linhVuc]}</span></td><td class="num-r">${escapeHtml(a.apDung || '—')}</td><td>${
              a.doc ? `<span class="badge badge-success">Trong kho</span>` : d?.text ? `<span class="badge">Kèm phần mềm</span>` : `<span class="badge">Chưa có</span>`
            }</td><td class="cf-row-act">${d?.text || a.doc ? `<button class="btn btn-sm btn-ghost btn-icon" type="button" data-al-view="${a.so}" aria-label="Xem án lệ ${escapeHtml(a.so)}" title="Xem">${icon('eye', 'ic-sm')}</button>` : ''}${
              a.doc ? '' : d?.text ? `<button class="btn btn-sm" type="button" data-al-add="${a.so}">${icon('download', 'ic-sm')}Nạp vào kho</button>` : `<button class="btn btn-sm" type="button" data-al-upload="${a.so}">${icon('upload', 'ic-sm')}Nạp toàn văn</button>`
            }</td></tr>`;
          })
          .join('')}</tbody></table></div>`
      : `<p class="hint">Không có án lệ khớp bộ lọc. ${filter.q ? 'Thử gõ số án lệ (vd: 47), số điều luật (vd: 174) hoặc một từ trong tên.' : ''}</p>`;
  }

  /** Hộp xem: tình huống – giải pháp – quy định – từ khóa – nguồn, rồi toàn văn. */
  function openView(a) {
    const d = data.get(a.so);
    const doc = docs.find((x) => x.loai === 'an-le' && String(x.so).toUpperCase() === a.so);
    const text = d?.text || doc?.text || '';
    const meta = [
      ['Lĩnh vực', LINH_VUC[a.linhVuc]],
      ['Thông qua', a.thongQua],
      ['Công bố', a.qdCongBo ? `Quyết định ${a.qdCongBo} ngày ${a.ngayCongBo}` : ''],
      ['Áp dụng từ', a.apDung],
      ['Nguồn án lệ', d?.nguon],
      ['Vị trí nội dung', d?.viTri],
    ].filter(([, v]) => v);
    const sec = (h, v) => (v ? `<h3>${h}</h3>${para(v)}` : '');
    ctx.modal(
      `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
      <h2 class="modal-title">Án lệ ${escapeHtml(a.so)}</h2>
      <p class="al-view-ten">${escapeHtml(cap1(a.tenNgan))}</p>
      <dl class="al-meta">${meta.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
      ${d?.ocr ? `<p class="note">${icon('info', 'ic-sm')}<span>Cổng án lệ đăng bản quét; chữ dưới đây do phần mềm nhận dạng tự động nên có thể sai chính tả — khi trích dẫn hãy đối chiếu bản gốc trên Cổng án lệ.</span></p>` : ''}
      <div class="al-view">
        ${sec('Tình huống án lệ', d?.tinhHuong)}${sec('Giải pháp pháp lý', d?.giaiPhap)}${!d?.tinhHuong && !d?.giaiPhap ? sec('Khái quát nội dung án lệ', d?.khaiQuat || doc?.khaiQuat) : ''}
        ${sec('Quy định của pháp luật liên quan', d?.quyDinh)}${sec('Từ khóa', d?.tuKhoa)}
        ${text ? `<details class="al-full"><summary>Toàn văn án lệ</summary><pre class="kho-text">${escapeHtml(text)}</pre></details>` : ''}
      </div>
      <div class="modal-actions">${d?.url ? `<a class="btn btn-ghost" href="${escapeHtml(d.url)}" target="_blank" rel="noopener">${icon('link', 'ic-sm')}Trên Cổng án lệ</a>` : ''}${!doc && d?.text ? `<button class="btn" type="button" data-al-add="${a.so}" data-close>${icon('download', 'ic-sm')}Nạp vào kho</button>` : ''}<button class="btn btn-primary" type="button" data-close>Đóng</button></div>`,
      { className: 'modal-wide', label: `Án lệ ${a.so}` },
    );
  }

  async function addFromData(list, { quiet = false } = {}) {
    let n = 0;
    for (const a of list) {
      const d = data.get(a.so);
      if (!d?.text || docs.some((x) => x.loai === 'an-le' && String(x.so).toUpperCase() === a.so)) continue;
      await courtBaDb.put(khoDocFromData(d, a.dieu));
      n++;
    }
    if (n) docs = await courtBaDb.list();
    drawList();
    if (!quiet) toast(n ? `Đã nạp ${n} án lệ vào kho của bạn` : 'Các án lệ này đã có trong kho');
    return n;
  }

  /** Hộp thoại nạp toàn văn do người dùng cung cấp (án lệ mới chưa có trong gói, hoặc thay bản khác). */
  function openUpload(a) {
    const m = ctx.modal(
      `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
      <h2 class="modal-title">Nạp toàn văn ${escapeHtml(a.so)}</h2>
      <p class="hint">${escapeHtml(cap1(a.tenNgan))}. Mở <a href="${AN_LE_PORTAL}" target="_blank" rel="noopener">Cổng án lệ TANDTC</a>, tìm số <b>${escapeHtml(a.so)}</b>, tải tệp Word/PDF hoặc chép toàn văn rồi dán vào đây. Văn bản lưu trên máy, riêng tài khoản của bạn.</p>
      <div class="field"><label>Tệp Word / PDF / ảnh / .txt</label><input class="input" type="file" multiple accept=".doc,.docx,.pdf,.txt,.png,.jpg,.jpeg" data-al-file /></div>
      <div class="field"><label>Hoặc dán toàn văn</label><textarea class="textarea" rows="8" data-al-paste placeholder="ÁN LỆ SỐ ${escapeHtml(a.so)}…"></textarea></div>
      <p class="hint" data-al-say aria-live="polite"></p>
      <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="button" data-al-save>${icon('check', 'ic-sm')}Lưu vào kho</button></div>`,
      { className: 'modal-wide', label: `Nạp toàn văn ${a.so}` },
    );
    const box = m.box;
    const say = (t) => ($('[data-al-say]', box).textContent = t);
    $('[data-al-save]', box).addEventListener('click', async () => {
      const files = [...($('[data-al-file]', box).files || [])];
      const ta = $('[data-al-paste]', box);
      if (!files.length && !ta.value.trim()) return warnMissing('Chưa có toàn văn: chọn tệp hoặc dán nội dung', ta);
      try {
        const text = await readAll(files, ta.value, say);
        const doc = parseKhoDoc(text, files[0]?.name || `Án lệ ${a.so}`);
        if (doc.loai !== 'an-le' || !doc.so) Object.assign(doc, { loai: 'an-le', so: a.so });
        if (!doc.ten || doc.ten === doc.name) doc.ten = cap1(a.tenNgan);
        if (!doc.dieu?.length) doc.dieu = [...a.dieu];
        const cat = findAnLe(doc.so);
        if (cat && cat.so !== a.so) toast(`Văn bản ghi số ${doc.so} — đã lưu theo số đó`, { type: 'info', timeout: 6000 });
        await courtBaDb.put(doc);
        docs = await courtBaDb.list();
        m.close();
        drawList();
        toast(`Đã nạp toàn văn ${doc.so} vào kho`);
      } catch (e) {
        toast(e.message, { type: 'error', timeout: 7000 });
      }
    });
  }

  const pg = page();
  pg.addEventListener('input', (e) => {
    if (e.target.matches('[data-al-q]')) (filter.q = e.target.value), drawList();
  });
  pg.addEventListener('change', (e) => {
    if (e.target.matches('[data-al-lv]')) {
      filter.linhVuc = e.target.value;
      history.replaceState(null, '', `#toa-an/an-le${filter.linhVuc ? `/${filter.linhVuc}` : ''}`);
      drawList();
    } else if (e.target.matches('[data-al-thieu]')) (filter.thieu = e.target.checked), drawList();
  });
  pg.addEventListener('click', async (e) => {
    const add = e.target.closest('[data-al-add]');
    const up = e.target.closest('[data-al-upload]');
    const view = e.target.closest('[data-al-view]');
    const all = e.target.closest('[data-al-add-all]');
    const so = e.target.closest('.al-so');
    if (all) {
      all.disabled = true;
      try {
        const n = await addFromData(AN_LE, { quiet: true });
        toast(n ? `Đã nạp ${n} án lệ vào kho của bạn — tab Bản án tương tự sẽ đối chiếu theo điều luật` : 'Toàn bộ án lệ đã có trong kho', { timeout: 6000 });
      } finally {
        all.disabled = false;
      }
    } else if (add) await addFromData([findAnLe(add.dataset.alAdd)]);
    else if (up) openUpload(findAnLe(up.dataset.alUpload));
    else if (view) openView(findAnLe(view.dataset.alView));
    else if (so) {
      await copyText(so.textContent.trim());
      toast(`Đã sao chép “${so.textContent.trim()}”`);
    }
  });
  // Nút "Nạp vào kho" trong hộp xem (hộp thoại nằm ngoài trang).
  document.addEventListener('click', async function onDoc(e) {
    if (!root.isConnected) return document.removeEventListener('click', onDoc);
    const b = e.target.closest('.modal [data-al-add]');
    if (b) await addFromData([findAnLe(b.dataset.alAdd)]);
  });
  $$('[data-al-q]', pg).forEach((i) => i.focus());
  drawList();
}
