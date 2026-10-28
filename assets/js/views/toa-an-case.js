// Tab "Vụ án" của hồ sơ xét xử: thụ lý, Tòa án, Hội đồng xét xử, cáo trạng / bản án sơ thẩm, mốc tố tụng, người tham gia
// tố tụng, bảng thời hạn. Trang "Cài đặt Tòa án": thông tin Tòa án (tự điền vào hồ sơ, biểu mẫu) và thời hạn tố tụng.
import { $, icon, toast, escapeHtml, debounce } from '../ui.js';
import { store } from '../lib/store.js';
import { LOAI_TOI, DEFAULT_RULES, mergeRules, computeDeadlines, suggestLoaiToi, TRANG_THAI } from '../legal/court-deadlines.js';
import { fmtDate } from '../legal/court-penalty.js';
import { DEFAULT_LAWS, LAWS_KEY, mergeLaws } from '../legal/court-law-time.js';

export const RULES_KEY = 'court-rules';
export const courtRules = () => mergeRules(store.get(RULES_KEY, {}));
const ST_CLASS = { 'qua-han': 'badge-danger', sap: 'badge-warning', con: '', moc: '', 'da-qua': '', xong: 'badge-success', tre: 'badge-warning', thieu: '' };
export const VAI_TRO_TG = [
  ['bi-hai', 'Bị hại'],
  ['nguoi-bao-chua', 'Người bào chữa'],
  ['nguoi-lam-chung', 'Người làm chứng'],
  ['nguyen-don', 'Nguyên đơn dân sự'],
  ['bi-don', 'Bị đơn dân sự'],
  ['nqlnvlq', 'Người có quyền lợi, nghĩa vụ liên quan'],
  ['dai-dien', 'Người đại diện'],
  ['giam-dinh', 'Người giám định'],
  ['phien-dich', 'Người phiên dịch'],
];

const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function set(o, path, v) {
  const ks = path.split('.');
  let cur = o;
  ks.slice(0, -1).forEach((k) => (cur = cur[k] ||= {}));
  cur[ks[ks.length - 1]] = v;
}
const inp = (rec, path, label, { type = 'text', ph = '', span = false } = {}) => {
  const v = get(rec, path);
  if (type === 'check') return `<div class="field"><label class="check"><input type="checkbox" data-v="${path}" ${v ? 'checked' : ''} />${label}</label></div>`;
  if (type === 'area') return `<div class="field ${span ? 'span-2' : ''}"><label>${label}</label><textarea class="textarea" rows="3" data-v="${path}" placeholder="${escapeHtml(ph)}">${escapeHtml(v || '')}</textarea></div>`;
  return `<div class="field ${span ? 'span-2' : ''}"><label>${label}</label><input class="input" ${type === 'date' ? 'type="date"' : ''} data-v="${path}" value="${escapeHtml(v ?? '')}" placeholder="${escapeHtml(ph)}" /></div>`;
};

/** Bảng thời hạn của một hồ sơ. */
export function deadlinesHtml(rec) {
  const items = computeDeadlines(rec, { rules: courtRules() });
  if (!items.length) return '<p class="hint">Nhập ngày thụ lý (sơ thẩm) hoặc ngày nhận hồ sơ (phúc thẩm) để tính thời hạn.</p>';
  return `<ul class="ct-dl">${items
    .map((it) => `<li class="st-${it.trangThai}" data-dl="${it.id}"><div><strong>${escapeHtml(it.ten)}</strong><small>${escapeHtml(it.canCu || '')}</small>${it.ghiChu ? `<small class="ct-dl-note">${escapeHtml(it.ghiChu)}</small>` : ''}</div><div class="ct-dl-r">${it.han ? `<b>${fmtDate(it.han)}</b>` : ''}<span class="badge ${ST_CLASS[it.trangThai]}">${TRANG_THAI[it.trangThai]}${['qua-han', 'sap', 'con'].includes(it.trangThai) ? ` · ${it.con < 0 ? `quá ${-it.con} ngày` : it.con === 0 ? 'hôm nay' : `còn ${it.con} ngày`}` : ''}</span></div></li>`)
    .join('')}</ul>`;
}

/** Việc gần nhất cần chú ý của hồ sơ (cho danh sách): { text, cls } hoặc null. */
export function nextDeadline(rec) {
  const it = computeDeadlines(rec, { rules: courtRules() }).filter((x) => ['qua-han', 'sap', 'con'].includes(x.trangThai)).sort((a, b) => a.han - b.han)[0];
  if (!it) return null;
  return { text: `${it.ten.replace(/ — .*$/, '')}: ${fmtDate(it.han)} (${it.con < 0 ? `quá ${-it.con} ngày` : it.con === 0 ? 'hôm nay' : `còn ${it.con} ngày`})`, cls: ST_CLASS[it.trangThai] };
}

/** Gắn tab "Vụ án" vào host. onChange(): báo cho trang cập nhật phần khác (tên, danh sách bị cáo…). */
export function mountCasePane(host, { ctx, rec, save, getBook, onChange = () => {} }) {
  const org = () => ctx.settings?.().courtOrg || {};
  rec.toa ||= {};
  rec.hdxx ||= {};
  rec.moc ||= {};
  rec.thuLy ||= {};
  rec.caoTrang ||= {};
  rec.banAn ||= {};
  rec.nguoiThamGia ||= [];
  // Thông tin Tòa án mặc định từ cài đặt của tài khoản.
  for (const [k, from] of [['ten', 'toaAn'], ['capTren', 'toaAnCapTren'], ['diaDanh', 'diaDanh']]) if (rec.toa[k] == null && org()[from]) rec.toa[k] = org()[from];

  function draw() {
    const pt = rec.cap === 'phuc-tham';
    const sug = suggestLoaiToi(rec.defendants, getBook());
    host.innerHTML = `<div class="ct-case">
      <div class="ct-case-main">
        <section class="panel ct-sec"><h2>${icon('folder', 'ic-sm')}Thụ lý</h2>
          <div class="grid-3">
            <div class="field"><label>Cấp xét xử</label><select class="select" data-v="cap"><option value="so-tham" ${!pt ? 'selected' : ''}>Sơ thẩm</option><option value="phuc-tham" ${pt ? 'selected' : ''}>Phúc thẩm</option></select></div>
            ${inp(rec, 'thuLy.so', 'Số thụ lý', { ph: pt ? 'vd: 45/2026/TLPT-HS' : 'vd: 120/2026/TLST-HS' })}
            ${inp(rec, 'thuLy.ngay', 'Ngày thụ lý', { type: 'date' })}
            ${pt ? '' : `<div class="field"><label>Loại tội phạm (tính thời hạn)</label><select class="select" data-v="loaiToi"><option value="">— Chọn —</option>${LOAI_TOI.map((l) => `<option value="${l.id}" ${rec.loaiToi === l.id ? 'selected' : ''}>${l.ten}</option>`).join('')}</select>${sug && sug !== rec.loaiToi ? `<button class="btn btn-ghost btn-sm" type="button" data-loai-sug="${sug}">${icon('wand', 'ic-sm')}Theo khung truy tố: ${LOAI_TOI.find((l) => l.id === sug).ten.toLowerCase()}</button>` : ''}</div>`}
            ${pt ? inp(rec, 'moc.ngayNhanHoSo', 'Ngày nhận hồ sơ vụ án phúc thẩm', { type: 'date' }) : ''}
          </div>
        </section>
        <section class="panel ct-sec"><h2>${icon('building', 'ic-sm')}Tòa án, Hội đồng xét xử</h2>
          <div class="grid-3">
            ${inp(rec, 'toa.ten', 'Tòa án', { ph: 'vd: Tòa án nhân dân khu vực 3 - Ninh Bình' })}
            ${inp(rec, 'toa.capTren', 'Tòa án cấp trên (dòng trên tên Tòa, nếu có)')}
            ${inp(rec, 'toa.diaDanh', 'Địa danh (ghi ngày tháng văn bản)')}
            ${inp(rec, 'hdxx.chuToa', 'Thẩm phán – Chủ tọa phiên tòa')}
            ${pt ? inp(rec, 'hdxx.thamPhan', 'Các Thẩm phán khác (mỗi người một dòng)', { type: 'area' }) : inp(rec, 'hdxx.hoiTham', 'Hội thẩm nhân dân (mỗi người một dòng)', { type: 'area' })}
            ${inp(rec, 'hdxx.thuKy', 'Thư ký phiên tòa')}
            ${inp(rec, 'hdxx.kiemSatVien', 'Kiểm sát viên')}
            ${inp(rec, 'hdxx.vks', 'Viện kiểm sát', { ph: 'vd: Viện kiểm sát nhân dân khu vực 3' })}
          </div>
        </section>
        ${
          pt
            ? `<section class="panel ct-sec"><h2>${icon('file', 'ic-sm')}Bản án sơ thẩm, kháng cáo, kháng nghị</h2><div class="grid-3">
            ${inp(rec, 'banAn.so', 'Số bản án sơ thẩm', { ph: 'vd: 25/2026/HS-ST' })}
            ${inp(rec, 'banAn.ngay', 'Ngày tuyên án sơ thẩm', { ph: 'dd/mm/yyyy' })}
            ${inp(rec, 'banAn.toa', 'Tòa án xét xử sơ thẩm')}
            ${inp(rec, 'khangCao', 'Kháng cáo, kháng nghị (người, ngày, nội dung — mỗi dòng một kháng cáo)', { type: 'area', span: true })}
          </div></section>`
            : `<section class="panel ct-sec"><h2>${icon('file', 'ic-sm')}Cáo trạng</h2><div class="grid-3">
            ${inp(rec, 'caoTrang.so', 'Số cáo trạng')}
            ${inp(rec, 'caoTrang.ngay', 'Ngày cáo trạng', { type: 'date' })}
            ${inp(rec, 'caoTrang.vks', 'Viện kiểm sát truy tố')}
          </div><p class="hint">Có tệp cáo trạng: tải lên ở tab <b>Tài liệu &amp; bị cáo</b> rồi bấm <b>Đọc cáo trạng</b> — phần mềm tự điền số, ngày, bị cáo, tội danh, nhân thân, biện pháp ngăn chặn.</p></section>`
        }
        <section class="panel ct-sec"><h2>${icon('calendar', 'ic-sm')}Mốc tố tụng</h2><div class="grid-3">
          ${inp(rec, 'moc.ngayHanhVi', 'Ngày thực hiện hành vi phạm tội (xác định luật áp dụng)', { type: 'date' })}
          ${pt ? '' : inp(rec, 'moc.giaHan', 'Đã gia hạn thời hạn chuẩn bị xét xử', { type: 'check' })}
          ${pt ? '' : inp(rec, 'moc.ngayTraHoSo', 'Ngày trả hồ sơ điều tra bổ sung', { type: 'date' })}
          ${pt ? '' : inp(rec, 'moc.ngayNhanLaiHoSo', 'Ngày nhận lại hồ sơ', { type: 'date' })}
          ${inp(rec, 'moc.soQdXetXu', 'Số quyết định đưa vụ án ra xét xử')}
          ${inp(rec, 'moc.ngayQdXetXu', 'Ngày quyết định đưa vụ án ra xét xử', { type: 'date' })}
          ${inp(rec, 'moc.ngayXetXu', 'Ngày mở phiên tòa', { type: 'date' })}
          ${inp(rec, 'moc.gioXetXu', 'Giờ mở phiên tòa', { ph: 'vd: 08 giờ 00' })}
          ${inp(rec, 'moc.diaDiem', 'Địa điểm mở phiên tòa')}
          ${inp(rec, 'moc.xuKin', 'Xét xử kín', { type: 'check' })}
          ${inp(rec, 'moc.ngayTuyenAn', 'Ngày tuyên án', { type: 'date' })}
          ${pt ? '' : inp(rec, 'moc.ngayGiaoBanAn', 'Ngày giao, gửi bản án', { type: 'date' })}
          ${pt ? inp(rec, 'moc.ngayHieuLuc', 'Ngày bản án có hiệu lực (thẩm tra giám đốc thẩm, tái thẩm)', { type: 'date' }) : ''}
          ${pt ? '' : inp(rec, 'moc.coKhangCao', 'Có kháng cáo / kháng nghị', { type: 'check' })}
          ${pt ? '' : rec.moc.coKhangCao ? inp(rec, 'moc.ngayGuiHoSo', 'Ngày gửi hồ sơ lên cấp phúc thẩm', { type: 'date' }) : inp(rec, 'moc.ngayHieuLuc', 'Ngày bản án có hiệu lực (nếu khác ngày tự tính)', { type: 'date' })}
          ${pt ? '' : inp(rec, 'moc.ngayQdThiHanh', 'Ngày ra quyết định thi hành án', { type: 'date' })}
        </div></section>
        <section class="panel ct-sec"><h2>${icon('user', 'ic-sm')}Người tham gia tố tụng (ngoài bị cáo)</h2>
          <div class="ct-th-rows" data-tg-rows>${rec.nguoiThamGia
            .map((p, i) => `<div class="ct-th-row ct-tg-row" data-tg="${i}"><select class="select input-sm" data-tgf="vaiTro">${VAI_TRO_TG.map(([v, l]) => `<option value="${v}" ${v === p.vaiTro ? 'selected' : ''}>${l}</option>`).join('')}</select><input class="input input-sm" data-tgf="hoTen" value="${escapeHtml(p.hoTen || '')}" placeholder="Họ tên" aria-label="Họ tên" /><input class="input input-sm" data-tgf="diaChi" value="${escapeHtml(p.diaChi || '')}" placeholder="Địa chỉ" aria-label="Địa chỉ" /><button class="btn btn-ghost btn-sm btn-icon" type="button" data-tg-del="${i}" aria-label="Bỏ người tham gia">${icon('x', 'ic-sm')}</button></div>`)
            .join('')}</div>
          <button class="btn btn-sm" type="button" data-tg-add>${icon('plus', 'ic-sm')}Thêm người tham gia</button>
          <p class="hint">Bị cáo (nhân thân, biện pháp ngăn chặn, tội danh, hình phạt) nhập ở tab <b>Tài liệu &amp; bị cáo</b>.</p>
        </section>
      </div>
      <aside class="ct-case-side"><section class="panel ct-sec"><h2>${icon('clock', 'ic-sm')}Thời hạn</h2><div data-dl-box>${deadlinesHtml(rec)}</div><a class="btn btn-sm btn-ghost" href="#toa-an/cai-dat">${icon('settings', 'ic-sm')}Cài đặt thời hạn</a></section></aside>
    </div>`;
  }
  const refreshDl = () => {
    const box = $('[data-dl-box]', host);
    if (box) box.innerHTML = deadlinesHtml(rec);
  };
  const commit = debounce(() => {
    save();
    refreshDl();
    onChange();
  }, 200);
  host.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.v) set(rec, t.dataset.v, t.type === 'checkbox' ? t.checked : t.value.trim() === '' ? '' : t.value);
    else if (t.dataset.tgf) rec.nguoiThamGia[+t.closest('[data-tg]').dataset.tg][t.dataset.tgf] = t.value;
    else return;
    commit();
  });
  host.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.v === 'cap' || t.dataset.v === 'moc.coKhangCao' || t.dataset.v === 'loaiToi') {
      set(rec, t.dataset.v, t.type === 'checkbox' ? t.checked : t.value);
      save();
      draw();
      onChange();
    }
  });
  host.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.loaiSug) rec.loaiToi = b.dataset.loaiSug;
    else if (b.matches('[data-tg-add]')) rec.nguoiThamGia.push({ vaiTro: 'bi-hai', hoTen: '', diaChi: '' });
    else if (b.dataset.tgDel != null) rec.nguoiThamGia.splice(+b.dataset.tgDel, 1);
    else return;
    save();
    draw();
    onChange();
  });
  draw();
  return { refresh: draw, refreshDl };
}

/** Trang "Cài đặt Tòa án": thông tin Tòa án của tài khoản, thời hạn tố tụng (sửa được). */
export function renderCourtSettings(ctx) {
  const root = ctx.view;
  const org = ctx.settings().courtOrg || {};
  const saved = store.get(RULES_KEY, {});
  const rules = mergeRules(saved);
  const laws = mergeLaws(store.get(LAWS_KEY, null));
  root.innerHTML = `<div class="page ct-page" data-ct-settings>
    <a class="rd-back" href="#toa-an">${icon('chevron-left', 'ic-sm')}Tòa án</a>
    <div class="page-head"><div><h1 class="page-title">Cài đặt <em>Tòa án</em></h1><p class="page-sub">Lưu riêng cho tài khoản của bạn. Thông tin Tòa án tự điền vào hồ sơ xét xử mới và biểu mẫu.</p></div></div>
    <section class="panel ct-sec"><h2>${icon('building', 'ic-sm')}Thông tin Tòa án</h2><div class="grid-3">
      ${[
        ['toaAn', 'Tòa án', 'vd: Tòa án nhân dân khu vực 3 - Ninh Bình'],
        ['toaAnCapTren', 'Tòa án cấp trên (dòng trên tên Tòa, nếu có)', 'vd: Tòa án nhân dân tỉnh Ninh Bình'],
        ['diaDanh', 'Địa danh', 'vd: Ninh Bình'],
      ]
        .map(([k, l, p]) => `<div class="field"><label>${l}</label><input class="input" data-org="${k}" value="${escapeHtml(org[k] || '')}" placeholder="${escapeHtml(p)}" /></div>`)
        .join('')}
    </div></section>
    <section class="panel ct-sec"><h2>${icon('clock', 'ic-sm')}Thời hạn tố tụng</h2>
      <p class="hint">Đặt sẵn theo Bộ luật Tố tụng hình sự 2015 (sửa đổi). Rà lại và sửa khi luật thay đổi. Cách tính: không tính ngày bắt đầu; tháng tính đến ngày trùng của tháng sau; hết hạn vào thứ Bảy, Chủ nhật thì lùi sang thứ Hai (ngày lễ tự lưu ý).</p>
      <table class="cf-table ct-rules"><thead><tr><th>Thời hạn</th><th>Số</th><th>Căn cứ</th></tr></thead><tbody>
      ${Object.entries(rules)
        .map(([k, r]) => `<tr><td>${escapeHtml(r.ten)}</td><td><input class="input input-sm" type="number" min="1" max="365" data-rule="${k}" value="${r.n}" aria-label="${escapeHtml(r.ten)}" /> ${r.unit === 'thang' ? 'tháng' : 'ngày'}${saved[k] && +saved[k].n !== DEFAULT_RULES[k].n ? ` <small>(mặc định ${DEFAULT_RULES[k].n})</small>` : ''}</td><td><small>${escapeHtml(r.canCu)}</small></td></tr>`)
        .join('')}
      </tbody></table>
      <button class="btn btn-sm btn-ghost" type="button" data-rules-reset>${icon('refresh', 'ic-sm')}Khôi phục thời hạn mặc định</button>
    </section>
    <section class="panel ct-sec"><h2>${icon('book', 'ic-sm')}Văn bản pháp luật theo thời điểm</h2>
      <p class="hint">Dùng để xác định văn bản áp dụng theo ngày thực hiện hành vi, ngày xét xử (Điều 7 BLHS — quy định có lợi) và cảnh báo khi nguyên văn trong sách Bình luận chưa gồm sửa đổi mới. Dòng đánh dấu “cần kiểm tra” là thông tin đặt sẵn — đối chiếu nguồn chính thức và sửa ngày hiệu lực nếu khác.</p>
      <table class="cf-table ct-laws"><thead><tr><th>Văn bản</th><th>Loại</th><th>Hiệu lực từ</th><th>Hết hiệu lực</th><th>Sửa đổi</th><th></th></tr></thead><tbody>
      ${laws
        .map((l, i) => `<tr data-law="${i}"><td><input class="input input-sm" data-lf="ten" value="${escapeHtml(l.ten)}" aria-label="Tên văn bản" />${l.kiemTra ? '<small>cần kiểm tra</small>' : ''}</td><td><select class="select input-sm" data-lf="loai"><option value="blhs" ${l.loai === 'blhs' ? 'selected' : ''}>BLHS</option><option value="bltths" ${l.loai === 'bltths' ? 'selected' : ''}>BLTTHS</option></select></td><td><input class="input input-sm" type="date" data-lf="tu" value="${escapeHtml(l.tu || '')}" aria-label="Hiệu lực từ" /></td><td><input class="input input-sm" type="date" data-lf="den" value="${escapeHtml(l.den || '')}" aria-label="Hết hiệu lực" /></td><td><input type="checkbox" data-lf="suaDoi" ${l.suaDoi ? 'checked' : ''} aria-label="Là văn bản sửa đổi" /></td><td><button class="btn btn-ghost btn-sm btn-icon" type="button" data-law-del="${i}" aria-label="Bỏ văn bản">${icon('x', 'ic-sm')}</button></td></tr>`)
        .join('')}
      </tbody></table>
      <div class="inline"><button class="btn btn-sm" type="button" data-law-add>${icon('plus', 'ic-sm')}Thêm văn bản</button><button class="btn btn-sm btn-ghost" type="button" data-laws-reset>${icon('refresh', 'ic-sm')}Khôi phục danh mục đặt sẵn</button></div>
    </section>
  </div>`;
  const page = $('[data-ct-settings]', root);
  page.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.lf) {
      const i = +t.closest('[data-law]').dataset.law;
      laws[i] = { ...laws[i], [t.dataset.lf]: t.type === 'checkbox' ? t.checked : t.value, kiemTra: false };
      store.set(LAWS_KEY, laws);
      return;
    }
    if (t.dataset.org) ctx.saveSettings({ courtOrg: { ...(ctx.settings().courtOrg || {}), [t.dataset.org]: t.value.trim() } });
    else if (t.dataset.rule) {
      const cur = store.get(RULES_KEY, {});
      const n = +t.value;
      if (!(n > 0)) return;
      store.set(RULES_KEY, { ...cur, [t.dataset.rule]: { n } });
    }
  });
  page.addEventListener('change', (e) => {
    if (e.target.dataset.lf === 'loai' || e.target.dataset.lf === 'suaDoi') e.target.dispatchEvent(new Event('input', { bubbles: true }));
  });
  page.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b?.matches('[data-law-add]')) {
      store.set(LAWS_KEY, [...laws, { id: `vb-${Date.now()}`, loai: 'blhs', ten: 'Văn bản mới', tu: '', den: '', suaDoi: true }]);
      return renderCourtSettings(ctx);
    }
    if (b?.dataset.lawDel != null) {
      store.set(LAWS_KEY, laws.filter((_, i) => i !== +b.dataset.lawDel));
      return renderCourtSettings(ctx);
    }
    if (b?.matches('[data-laws-reset]')) {
      store.set(LAWS_KEY, DEFAULT_LAWS);
      toast('Đã khôi phục danh mục văn bản đặt sẵn');
      return renderCourtSettings(ctx);
    }
    if (!e.target.closest('[data-rules-reset]')) return;
    store.set(RULES_KEY, {});
    toast('Đã khôi phục thời hạn mặc định');
    renderCourtSettings(ctx);
  });
}
