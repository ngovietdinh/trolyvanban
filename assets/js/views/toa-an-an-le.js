// Trang "Án lệ": danh mục toàn bộ án lệ của Hội đồng Thẩm phán TANDTC (số, tên, lĩnh vực, ngày áp dụng, điều luật liên
// quan), lọc theo lĩnh vực / từ khóa, ghép với toàn văn đã nạp vào kho của tài khoản; nạp toàn văn (dán hoặc tệp) ngay
// tại chỗ. Toàn văn lấy từ Cổng án lệ TANDTC (mở ngoài) — phần mềm không chép sẵn nội dung án lệ.
import { $, $$, icon, toast, escapeHtml, warnMissing, copyText } from '../ui.js';
import { AN_LE, LINH_VUC, AN_LE_PORTAL, withKho, findAnLe } from '../legal/an-le-catalog.js';
import { courtBaDb } from '../legal/court-ba-db.js';
import { parseKhoDoc } from '../legal/court-similar.js';
import { readAll } from './acts-review.js';
import { foldKeep, tokens, matchAt } from '../lib/universal-search.js';

const hasAll = (text, toks) => {
  const f = foldKeep(text);
  return toks.every((t) => matchAt(f, t).length);
};

export async function renderAnLe(ctx, params = []) {
  const root = ctx.view;
  const filter = { linhVuc: LINH_VUC[params[0]] ? params[0] : '', q: '', thieu: false };
  let docs = await courtBaDb.list().catch(() => []);
  if (!root.isConnected) return;
  const page = () => $('[data-al]', root);

  root.innerHTML = `<div class="page ct-page" data-al>
    <a class="rd-back" href="#toa-an">${icon('chevron-left', 'ic-sm')}Tòa án</a>
    <div class="page-head"><div><h1 class="page-title">Án lệ</h1><p class="page-sub">Danh mục ${AN_LE.length} án lệ do Hội đồng Thẩm phán Tòa án nhân dân tối cao thông qua (01/2016/AL → ${AN_LE.at(-1).so}), trong đó ${AN_LE.filter((a) => a.linhVuc === 'hs').length} án lệ hình sự có ghi điều luật liên quan. Toàn văn tải từ Cổng án lệ của Tòa án rồi nạp vào kho của bạn — khi thẩm tra, phần mềm tự đối chiếu án lệ theo điều luật.</p></div>
      <div class="inline"><a class="btn" href="${AN_LE_PORTAL}" target="_blank" rel="noopener">${icon('link', 'ic-sm')}Cổng án lệ TANDTC</a><a class="btn btn-ghost" href="#toa-an/kho-ban-an">${icon('book', 'ic-sm')}Kho bản án, án lệ</a></div></div>
    <section class="panel ct-sec">
      <div class="inline al-filters">
        <select class="select input-sm" data-al-lv aria-label="Lĩnh vực"><option value="">Tất cả lĩnh vực</option>${Object.entries(LINH_VUC).map(([k, v]) => `<option value="${k}" ${k === filter.linhVuc ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <input class="input input-sm al-q" type="search" data-al-q placeholder="Tìm: số án lệ, từ khóa, điều luật (vd: 174, lừa đảo, giết người)…" aria-label="Tìm án lệ" />
        <label class="check"><input type="checkbox" data-al-thieu />Chỉ án lệ chưa có toàn văn</label>
        <span class="hint" data-al-count></span>
      </div>
      <div data-al-list></div>
    </section>
  </div>`;

  function drawList() {
    const all = withKho(docs);
    const toks = tokens(filter.q);
    const num = /^\d{1,3}$/.test(filter.q.trim()) ? +filter.q.trim() : null;
    const list = all.filter((a) => (!filter.linhVuc || a.linhVuc === filter.linhVuc) && (!filter.thieu || !a.doc) && (!toks.length || a.num === num || a.dieu.includes(filter.q.trim()) || hasAll(`${a.so} ${a.ten} ${LINH_VUC[a.linhVuc]} ${a.dieu.map((d) => `dieu ${d}`).join(' ')}`, toks)));
    const co = all.filter((a) => a.doc).length;
    $('[data-al-count]', page()).textContent = `${list.length}/${all.length} án lệ · ${co} có toàn văn trong kho`;
    $('[data-al-list]', page()).innerHTML = list.length
      ? `<div class="tt-table-wrap"><table class="cf-table al-table"><thead><tr><th>Số</th><th>Án lệ</th><th>Lĩnh vực</th><th>Áp dụng từ</th><th>Toàn văn</th><th></th></tr></thead><tbody>${list
          .map(
            (a) => `<tr data-al-row="${a.so}"><td class="al-so"><b>${escapeHtml(a.so)}</b></td><td>${escapeHtml(a.tenNgan.replace(/^về /, 'Về '))}${a.dieu.length ? `<small>Điều luật liên quan: ${a.dieu.map((d) => `<a href="#binh-luan/${d}" class="law-link">Điều ${d}</a>`).join(', ')} BLHS</small>` : ''}<small>Thông qua ${escapeHtml(a.thongQua || '—')} · Quyết định ${escapeHtml(a.qdCongBo || '—')} ngày ${escapeHtml(a.ngayCongBo || '—')}</small></td><td><span class="badge">${LINH_VUC[a.linhVuc]}</span></td><td class="num-r">${escapeHtml(a.apDung || '—')}</td><td>${
              a.doc ? `<span class="badge badge-success">Có trong kho</span>` : `<span class="badge">Chưa có</span>`
            }</td><td class="cf-row-act">${a.doc ? `<button class="btn btn-sm btn-ghost btn-icon" type="button" data-al-view="${a.doc.id}" aria-label="Xem toàn văn">${icon('eye', 'ic-sm')}</button>` : ''}<button class="btn btn-sm ${a.doc ? 'btn-ghost' : ''}" type="button" data-al-add="${a.so}">${icon('upload', 'ic-sm')}${a.doc ? 'Nạp lại' : 'Nạp toàn văn'}</button></td></tr>`,
          )
          .join('')}</tbody></table></div>`
      : `<p class="hint">Không có án lệ khớp bộ lọc. ${filter.q ? 'Thử gõ số án lệ (vd: 47), số điều luật (vd: 174) hoặc một từ trong tên.' : ''}</p>`;
  }

  /** Hộp thoại nạp toàn văn một án lệ: dán hoặc chọn tệp; tự gắn số án lệ nếu văn bản không ghi. */
  function openAdd(a) {
    const m = ctx.modal(
      `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
      <h2 class="modal-title">Nạp toàn văn ${escapeHtml(a.so)}</h2>
      <p class="hint">${escapeHtml(a.tenNgan.replace(/^về /, 'Về '))}. Mở <a href="${AN_LE_PORTAL}" target="_blank" rel="noopener">Cổng án lệ TANDTC</a>, tìm số <b>${escapeHtml(a.so)}</b>, tải tệp Word/PDF hoặc chép toàn văn rồi dán vào đây. Văn bản lưu trên máy, riêng tài khoản của bạn.</p>
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
        if (!doc.ten || doc.ten === doc.name) doc.ten = a.tenNgan.replace(/^về /, 'Về ');
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
    const view = e.target.closest('[data-al-view]');
    const so = e.target.closest('.al-so');
    if (add) openAdd(findAnLe(add.dataset.alAdd));
    else if (view) {
      const d = docs.find((x) => x.id === view.dataset.alView);
      ctx.modal(`<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button><h2 class="modal-title">Án lệ ${escapeHtml(d.so)}</h2><pre class="kho-text">${escapeHtml(d.text || '')}</pre><div class="modal-actions"><button class="btn" type="button" data-close>Đóng</button></div>`, { className: 'modal-wide', label: 'Toàn văn án lệ' });
    } else if (so) {
      await copyText(so.textContent.trim());
      toast(`Đã sao chép “${so.textContent.trim()}” — dán vào ô tìm trên Cổng án lệ`);
    }
  });
  $$('[data-al-q]', pg).forEach((i) => i.focus());
  drawList();
}
