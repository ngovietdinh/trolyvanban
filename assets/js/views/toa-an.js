// Mục "Tòa án": phân tích hành vi phạm tội và hướng giải quyết; kiểm tra tội danh, khung, mức hình phạt đã áp dụng;
// xem xét đơn khiếu nại / kháng cáo người khác gửi đến: từng yêu cầu có căn cứ hay không (căn cứ pháp lý nguyên văn + căn cứ
// thực tế trích tài liệu vụ án), xuất phiếu xem xét đơn (Word).
import { $, $$, icon, toast, escapeHtml, debounce, downloadBlob, warnMissing } from '../ui.js';
import { courtRepo, casesRepo, recordsRepo } from '../legal/repo.js';
import { uid } from '../lib/store.js';
import { getRole } from '../legal/roles.js';
import { findCrime } from '../legal/engine.js';
import { parseVerdict, parseIndictment, checkDefendant, analyzeCase, assessComplaint, buildReviewDocument, generalRules, fmtVnd, parseMoney, LEVELS, KET_LUAN, LOAI_DON } from '../legal/court.js';
import { upcoming, TRANG_THAI, suggestLoaiToi } from '../legal/court-deadlines.js';
import { fmtDate } from '../legal/court-penalty.js';
import { mountCasePane, renderCourtSettings, courtRules, nextDeadline } from './toa-an-case.js';
import { mountPenaltyPane } from './toa-an-tools.js';
import { mountFormsPane, renderFormsLibrary } from './toa-an-forms.js';
import { SOURCE_TYPES, detectType, srcRange } from '../legal/court-evidence.js';
import { extractText } from '../lib/extract.js';
import { courtBaDb } from '../legal/court-ba-db.js';
import { mergeLaws, LAWS_KEY } from '../legal/court-law-time.js';
import { store } from '../lib/store.js';
import { thamTraHtml, chungCuHtml, tuongTuHtml, bindThamTra, thamTraAiPrompt } from './toa-an-tham-tra.js';
import { buildReplyLetter } from '../legal/court-review.js';
import { renderKho } from './toa-an-kho.js';
import { renderAnLe } from './toa-an-an-le.js';
import { loadAnLeData } from '../legal/an-le-data.js';
import { loadBook } from '../legal/binh-luan-store.js';
import { dropzoneHtml, bindDropzone, readAll } from './acts-review.js';
import { buildDocx, safeFileName } from '../lib/docx.js';
import { renderDocumentHtml } from '../lib/render-html.js';
import { streamClaude } from '../lib/ai.js';
import { rules as aiRules } from '../legal/ai-rules.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const LOAI_HP = [
  ['', '— Chưa xử / chưa rõ —'],
  ['tu', 'Tù có thời hạn'],
  ['cai-tao', 'Cải tạo không giam giữ'],
  ['phat-tien', 'Phạt tiền'],
  ['chung-than', 'Tù chung thân'],
  ['tu-hinh', 'Tử hình'],
];
const NGAN_CHAN = [
  ['', '— Không / chưa rõ —'],
  ['tam-giam', 'Tạm giam'],
  ['cam-di-khoi', 'Cấm đi khỏi nơi cư trú'],
  ['bao-linh', 'Bảo lĩnh'],
  ['dat-tien', 'Đặt tiền để bảo đảm'],
  ['tai-ngoai', 'Tại ngoại'],
];
const VAI_TRO = [
  ['', 'Người thực hành / chủ mưu'],
  ['dong-pham', 'Đồng phạm'],
  ['giup-suc-khong-dang-ke', 'Người giúp sức, vai trò không đáng kể (lần đầu)'],
];
const LV_CLASS = { loi: 'badge-danger', canh: 'badge-warning', goi: 'badge-accent', dung: 'badge-success' };
const KL_CLASS = { co: 'badge-success', 'mot-phan': 'badge-warning', 'xac-minh': '', khong: 'badge-danger' };
const newDefendant = (x = {}) => ({ id: uid(), hoTen: '', tuoi: null, vaiTro: '', toiDanh: [{ dieu: '', khoan: null, diem: [] }], soTien: null, giamNhe: [], giamNheK2: false, tangNang: [], dieu54: false, dieu65: false, hinhPhat: {}, ...x });
const crimeHint = (dieu) => {
  const crime = findCrime(dieu);
  return crime ? `Điều ${crime.dieu}: ${escapeHtml(crime.ten)}` : dieu ? `Phần mềm chưa có dữ liệu Điều ${escapeHtml(dieu)}.` : '';
};
const recordText = (r) => [`BIÊN BẢN ${getRole(r.roleId).ten.split('/')[0].trim().toUpperCase()}: ${r.nguoiKhai?.hoTen || ''} (lần ${r.lan || 1})`, ...(r.qa || []).map((x) => `Hỏi: ${x.q}\nĐáp: ${x.a || ''}`)].join('\n');

/* ---------------- Danh sách ---------------- */
const TABS = [
  ['vu-an', 'folder', 'Vụ án, thời hạn'],
  ['tai-lieu', 'upload', 'Tài liệu & bị cáo'],
  ['tham-tra', 'check-circle', 'Thẩm tra (5 câu hỏi)'],
  ['chung-cu', 'layers', 'Chứng cứ, bút lục'],
  ['phan-tich', 'activity', 'Phân tích hành vi'],
  ['kiem-tra', 'check-circle', 'Kiểm tra bản án'],
  ['hinh-phat', 'gavel', 'Tính hình phạt'],
  ['khieu-nai', 'mail', 'Xem xét đơn'],
  ['tuong-tu', 'book', 'Bản án tương tự, án lệ'],
  ['bieu-mau', 'file', 'Biểu mẫu'],
];
const CAP = { 'so-tham': 'Sơ thẩm', 'phuc-tham': 'Phúc thẩm', 'giam-doc-tham': 'Giám đốc thẩm' };
const TEN_MOI = { 'so-tham': 'Vụ án sơ thẩm mới', 'phuc-tham': 'Vụ án phúc thẩm mới', 'giam-doc-tham': 'Vụ án giám đốc thẩm mới' };
const ST_CLASS = { 'qua-han': 'badge-danger', sap: 'badge-warning', con: '', moc: '' };
// Hồ sơ mới là BẢN NHÁP trong bộ nhớ: chỉ vào sổ vụ án khi người dùng bấm "Lưu hồ sơ". Rời trang khi nháp đã có nội dung
// → giữ tạm (khóa court-draft, riêng tài khoản) để tiếp tục từ Sổ vụ án; "Hủy" bỏ hẳn.
export const DRAFT_KEY = 'court-draft';
function newCourtCase(ctx, cap) {
  const org = ctx.settings?.().courtOrg || {};
  return { id: null, draft: true, ten: TEN_MOI[cap] || TEN_MOI['so-tham'], cap: CAP[cap] ? cap : 'so-tham', thuLy: {}, toa: { ten: org.toaAn || '', capTren: org.toaAnCapTren || '', diaDanh: org.diaDanh || '' }, hdxx: {}, moc: {}, caoTrang: {}, sources: [], defendants: [newDefendant()], nguoiThamGia: [], banAn: {}, dons: [] };
}
function renderList(ctx) {
  const list = courtRepo.list().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const todo = upcoming(list, { rules: courtRules() }).filter((x) => x.trangThai !== 'moc').slice(0, 12);
  const draft = store.get(DRAFT_KEY, null);
  ctx.view.innerHTML = `<div class="page ct-page">
    <div class="page-head"><div><h1 class="page-title">Tòa án — <em>hồ sơ xét xử hình sự</em></h1><p class="page-sub">Sổ vụ án sơ thẩm, phúc thẩm, giám đốc thẩm; thời hạn tố tụng và cảnh báo; phân tích hành vi, kiểm tra bản án, tính hình phạt; xem xét đơn khiếu nại, kháng cáo; biểu mẫu Tòa án tự điền. Dữ liệu lưu trên máy, riêng tài khoản của bạn.</p></div>
      <div class="inline"><button class="btn btn-primary" type="button" data-new="so-tham">${icon('plus', 'ic-sm')}Vụ án sơ thẩm</button><button class="btn" type="button" data-new="phuc-tham">${icon('plus', 'ic-sm')}Vụ án phúc thẩm</button><button class="btn" type="button" data-new="giam-doc-tham">${icon('plus', 'ic-sm')}Vụ án giám đốc thẩm</button></div></div>
    <div class="inline ct-links"><a class="btn btn-sm btn-ghost" href="#toa-an/bieu-mau">${icon('file', 'ic-sm')}Biểu mẫu Tòa án</a><a class="btn btn-sm btn-ghost" href="#toa-an/kho-ban-an">${icon('book', 'ic-sm')}Kho bản án, án lệ</a><a class="btn btn-sm btn-ghost" href="#toa-an/an-le">${icon('layers', 'ic-sm')}Án lệ</a><a class="btn btn-sm btn-ghost" href="#toa-an/cai-dat">${icon('settings', 'ic-sm')}Cài đặt Tòa án, thời hạn, văn bản</a><input class="input input-sm ct-list-q" type="search" placeholder="Tìm hồ sơ: tên, bị cáo, số thụ lý…" data-list-q aria-label="Tìm hồ sơ xét xử" /></div>
    ${
      draft
        ? `<section class="panel ct-sec ct-draft" data-ct-draft><div class="inline"><span class="badge badge-warning">Bản nháp chưa lưu</span><strong>${escapeHtml(draft.ten || 'Hồ sơ xét xử')}</strong><small>${CAP[draft.cap] || ''}${draft.stashedAt ? ` · ghi tạm ${new Date(draft.stashedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : ''}</small><a class="btn btn-sm btn-primary" href="#toa-an/nhap/vu-an">${icon('file', 'ic-sm')}Tiếp tục soạn</a><button class="btn btn-sm btn-ghost" type="button" data-draft-drop>${icon('x', 'ic-sm')}Bỏ bản nháp</button></div></section>`
        : ''
    }
    ${
      todo.length
        ? `<section class="panel ct-sec ct-todo"><h2>${icon('clock', 'ic-sm')}Việc cần làm theo thời hạn</h2><ul class="ct-dl">${todo
            .map((it) => `<li class="st-${it.trangThai}"><div><a href="#toa-an/${it.rec.id}/vu-an"><strong>${escapeHtml(it.ten)}</strong></a><small>${escapeHtml(it.rec.ten || '')}${it.rec.thuLy?.so ? ` · thụ lý số ${escapeHtml(it.rec.thuLy.so)}` : ''}</small></div><div class="ct-dl-r"><b>${fmtDate(it.han)}</b><span class="badge ${ST_CLASS[it.trangThai]}">${TRANG_THAI[it.trangThai]} · ${it.con < 0 ? `quá ${-it.con} ngày` : it.con === 0 ? 'hôm nay' : `còn ${it.con} ngày`}</span></div></li>`)
            .join('')}</ul></section>`
        : ''
    }
    ${
      list.length
        ? `<section class="panel"><div class="tt-table-wrap"><table class="cf-table ct-list"><thead><tr><th>Hồ sơ</th><th>Bị cáo</th><th>Thời hạn gần nhất</th><th class="num-r">Tài liệu</th><th class="num-r">Cập nhật</th></tr></thead><tbody>${list
            .map((c) => {
              const nd = nextDeadline(c);
              const names = (c.defendants || []).map((d) => escapeHtml(d.hoTen || 'Chưa ghi tên')).join(', ');
              return `<tr><td><a href="#toa-an/${c.id}"><strong>${escapeHtml(c.ten || 'Hồ sơ xét xử')}</strong></a><small>${CAP[c.cap] || 'Hồ sơ xét xử'}</small>${c.thuLy?.so ? `<small>Thụ lý số ${escapeHtml(c.thuLy.so)}</small>` : ''}</td><td>${names || '<span class="ct-dash">Chưa có bị cáo</span>'}</td><td>${nd ? `<span class="badge ${nd.cls}">${escapeHtml(nd.text)}</span>` : '<span class="ct-dash">—</span>'}</td><td class="num-r">${(c.sources || []).length} tài liệu<small>${(c.dons || []).length} đơn</small></td><td class="num-r">${new Date(c.updatedAt).toLocaleDateString('vi-VN')}</td></tr>`;
            })
            .join('')}</tbody></table></div></section>`
        : `<section class="panel"><div class="empty"><div class="empty-icon">${icon('gavel', 'ic-lg')}</div><h3>Chưa có hồ sơ xét xử</h3><p>Tạo vụ án sơ thẩm (thụ lý từ cáo trạng), phúc thẩm (có kháng cáo, kháng nghị) hoặc giám đốc thẩm (có kháng nghị đối với bản án đã có hiệu lực). Tải cáo trạng / bản án để phần mềm tự điền bị cáo, tội danh, nhân thân; nhập ngày thụ lý để theo dõi thời hạn.</p></div></section>`
    }
  </div>`;
  const q = ctx.view.querySelector('[data-list-q]');
  q?.addEventListener('input', () => {
    const k = q.value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    ctx.view.querySelectorAll('.ct-list tbody tr').forEach((li) => (li.hidden = !!k && !li.textContent.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').includes(k)));
  });
  ctx.view.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => ctx.navigate(`#toa-an/moi/${b.dataset.new}/vu-an`)));
  ctx.view.querySelector('[data-draft-drop]')?.addEventListener('click', async () => {
    if (!(await ctx.confirm(`Bỏ bản nháp “${draft.ten || 'Hồ sơ xét xử'}”? Nội dung đã nhập sẽ mất.`, { title: 'Bỏ bản nháp', okText: 'Bỏ bản nháp', danger: true }))) return;
    store.remove(DRAFT_KEY);
    toast('Đã bỏ bản nháp');
    renderList(ctx);
  });
}

/* ---------------- Hồ sơ xét xử ---------------- */
export function render(ctx, params = []) {
  if (!params[0]) return renderList(ctx);
  if (params[0] === 'bieu-mau') return renderFormsLibrary(ctx);
  if (params[0] === 'cai-dat') return renderCourtSettings(ctx);
  if (params[0] === 'kho-ban-an') return renderKho(ctx);
  if (params[0] === 'an-le') return renderAnLe(ctx, params.slice(1));
  let rec;
  let draft = false; // Hồ sơ mới chưa lưu vào sổ.
  let tabParam = params[1];
  if (params[0] === 'moi') {
    rec = newCourtCase(ctx, params[1]);
    draft = true;
    tabParam = params[2];
  } else if (params[0] === 'nhap') {
    rec = store.get(DRAFT_KEY, null);
    if (!rec) {
      toast('Không còn bản nháp nào — tạo vụ án mới', { type: 'info' });
      return renderList(ctx);
    }
    rec.draft = true;
    draft = true;
  } else rec = courtRepo.get(params[0]);
  if (!rec) {
    toast('Không tìm thấy hồ sơ xét xử', { type: 'error' });
    return renderList(ctx);
  }
  let book = null;
  rec.cap ||= 'so-tham';
  let tab = TABS.some(([t]) => t === tabParam) ? tabParam : !draft && ((rec.sources || []).length || rec.thuLy?.so) ? 'tai-lieu' : 'vu-an';
  const base = () => (draft ? '#toa-an/nhap' : `#toa-an/${rec.id}`);
  const panes = {};
  let khoDocs = [];
  let anLeData = null;
  loadAnLeData().then((d) => {
    anLeData = d;
    if (root.isConnected && tab === 'tuong-tu') update();
  });
  const laws = () => mergeLaws(store.get(LAWS_KEY, null));
  const aiText = { 'phan-tich': '', don: '', 'tham-tra': '' };
  let aiBusy = null;
  rec.dons = rec.dons || [];
  let donSel = rec.dons[rec.dons.length - 1]?.id || null;
  // Giữ nguyên đối tượng hồ sơ (các tab Vụ án, Tính hình phạt, Biểu mẫu cùng tham chiếu) — chỉ cập nhật thời gian lưu.
  let dirty = false;
  let changed = false; // Bản nháp đã có nội dung (để giữ tạm khi rời trang).
  const stash = () => store.set(DRAFT_KEY, { ...rec, draft: true, stashedAt: Date.now() });
  const setStatus = () => {
    const el = $('[data-ct-status]', root);
    if (el) el.textContent = `Đã lưu ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  };
  const saveNow = () => {
    dirty = false;
    if (draft) {
      // Bản nháp: không ghi vào sổ; đổi địa chỉ sang #toa-an/nhap để tải lại trang vẫn giữ được (giữ tạm khi rời trang).
      changed = true;
      if (location.hash.startsWith('#toa-an/moi/')) history.replaceState(null, '', `#toa-an/nhap/${tab}`);
      return;
    }
    Object.assign(rec, courtRepo.save(rec));
    setStatus();
  };
  const saveLater = debounce(() => dirty && saveNow(), 300);
  const save = () => {
    dirty = true;
    if (draft) changed = true;
    saveLater();
  };
  // Rời trang / tải lại: hồ sơ đã lưu thì ghi nốt; bản nháp có nội dung thì giữ tạm.
  const flush = () => {
    if (draft) {
      if (changed) stash();
      return;
    }
    if (dirty) saveNow();
  };
  window.addEventListener('pagehide', flush);
  const root = ctx.view;
  // Bản nháp: ghi nhận "đã có nội dung" ngay khi gõ (các ô lưu trễ 200–300 ms) để Hủy / rời trang hỏi lại đúng lúc.
  root.addEventListener('input', () => draft && (changed = true), true);

  const shell = () => {
    root.innerHTML = `<div class="page ct-page">
      <a class="rd-back" href="#toa-an">${icon('chevron-left', 'ic-sm')}Hồ sơ xét xử</a>
      <div class="ct-title"><span class="badge" data-ct-cap>${CAP[rec.cap]}</span><input class="input ct-name" value="${escapeHtml(rec.ten || '')}" data-ct-name aria-label="Tên hồ sơ xét xử" />
        <div class="ct-title-act">${
          draft
            ? `<span class="badge badge-warning" data-ct-draft-badge>Bản nháp — chưa lưu</span><button class="btn btn-primary btn-sm" type="button" data-ct-save>${icon('check', 'ic-sm')}Lưu hồ sơ</button><button class="btn btn-ghost btn-sm" type="button" data-ct-cancel>Hủy</button>`
            : `<small class="hint" data-ct-status>Đã lưu</small><button class="btn btn-sm" type="button" data-ct-save>${icon('check', 'ic-sm')}Lưu</button><button class="btn btn-ghost btn-sm" type="button" data-ct-del>${icon('x', 'ic-sm')}Xóa hồ sơ</button>`
        }</div></div>
      <div class="seg ct-tabs ct-maintabs" role="tablist">${TABS.map(([id, ic, l]) => `<button role="tab" data-ct-tab="${id}">${icon(ic, 'ic-sm')}${l}</button>`).join('')}</div>
      <p class="note warn ct-book" data-ct-book hidden>${icon('book', 'ic-sm')}<span>Chưa nạp sách Bình luận BLHS — chưa kiểm tra được khung, mức hình phạt (cần nguyên văn điều luật). <a href="#binh-luan">Nạp sách</a></span></p>
      <div data-pane="vu-an" hidden></div>
      <div data-pane="tai-lieu" hidden>
      <section class="panel ct-sec" data-ct-src><h2>${icon('upload', 'ic-sm')}1. Tài liệu vụ án</h2>
        <div class="grid-2">
          <div class="field"><label for="ct-case">Lấy từ hồ sơ vụ án</label><select class="select" id="ct-case" data-ct-case><option value="">— Chọn hồ sơ (lấy lời khai, tội danh, người) —</option>${casesRepo.list().map((c) => `<option value="${c.id}" ${c.id === rec.caseId ? 'selected' : ''}>${escapeHtml(c.ten)}</option>`).join('')}</select></div>
          <div class="field"><label>Cáo trạng / bản án / kết luận điều tra</label>${dropzoneHtml('Word .doc/.docx, PDF (kể cả bản scan), ảnh chụp, .txt')}</div>
        </div>
        <div class="field"><label for="ct-paste">Hoặc dán nội dung</label><textarea class="textarea" id="ct-paste" rows="3" data-ct-paste placeholder="Dán nội dung cáo trạng, bản án…"></textarea></div>
        <div class="inline"><button class="btn btn-sm" type="button" data-ct-add>${icon('plus', 'ic-sm')}Thêm tài liệu</button><button class="btn btn-sm btn-primary" type="button" data-ct-indict>${icon('search', 'ic-sm')}Đọc cáo trạng: bị cáo, tội danh, nhân thân</button><button class="btn btn-sm btn-primary" type="button" data-ct-parse>${icon('search', 'ic-sm')}Đọc bản án: tội danh, hình phạt, tình tiết</button><span class="hint" data-ct-say aria-live="polite"></span></div>
        <ul class="ct-sources" data-ct-sources></ul>
      </section>
      <section class="panel ct-sec"><h2>${icon('user', 'ic-sm')}2. Bị cáo và quyết định đã áp dụng</h2>
        <div data-ct-defs></div>
        <button class="btn btn-sm" type="button" data-ct-adddef>${icon('plus', 'ic-sm')}Thêm bị cáo</button>
      </section>
      </div>
      <div data-pane="hinh-phat" hidden></div>
      <div data-pane="bieu-mau" hidden></div>
      <section class="panel ct-sec" data-ct-don hidden><h2>${icon('mail', 'ic-sm')}Đơn nhận được</h2>
        <p class="hint">Tải đơn khiếu nại, kháng cáo, đề nghị giám đốc thẩm… người khác gửi đến — phần mềm tách từng yêu cầu trong đơn và đối chiếu với tài liệu vụ án (phần 1), quyết định đã áp dụng (phần 2), nguyên văn điều luật. Nội dung đơn không được coi là chứng cứ.</p>
        <div class="grid-2">
          <div class="field" data-don-drop><label>Tệp đơn</label>${dropzoneHtml('Word .doc/.docx, PDF (kể cả bản scan), ảnh chụp đơn, .txt')}</div>
          <div class="field"><label for="ct-don-paste">Hoặc dán nội dung đơn</label><textarea class="textarea" id="ct-don-paste" rows="4" data-don-paste placeholder="Dán toàn bộ nội dung đơn…"></textarea></div>
        </div>
        <div class="inline"><button class="btn btn-sm btn-primary" type="button" data-don-add>${icon('plus', 'ic-sm')}Thêm đơn để xem xét</button><span class="hint" data-don-say aria-live="polite"></span></div>
        <ul class="ct-sources" data-don-list></ul>
      </section>
      <section class="ct-out" data-ct-out aria-live="polite"></section>
      <p class="hint ct-disclaimer">${icon('info', 'ic-sm')}<span>Kết quả là gợi ý dựa trên tài liệu đã nạp, dữ liệu điều luật và nguyên văn sách Bình luận — người có thẩm quyền cần đối chiếu hồ sơ gốc và văn bản pháp luật hiện hành trước khi sử dụng.</span></p>
    </div>`;
  };

  /* ----- Tài liệu ----- */
  function drawSources() {
    const host = $('[data-ct-sources]', root);
    host.innerHTML = (rec.sources || []).length
      ? rec.sources.map((s, i) => `<li class="ct-src-row"><span>${icon('file', 'ic-sm')}<strong>${escapeHtml(s.name)}</strong><small>${s.text.length.toLocaleString('vi-VN')} ký tự${s.pages?.length > 1 ? ` · ${s.pages.length} trang` : ''}${s.ocrConf != null ? ` · OCR ${Math.round(s.ocrConf * 100)}%` : ''}</small></span><span class="ct-src-meta"><select class="select input-sm" data-src-loai="${i}" aria-label="Loại tài liệu ${escapeHtml(s.name)}">${SOURCE_TYPES.map(([v, l]) => `<option value="${v}" ${v === (s.loai || 'khac') ? 'selected' : ''}>${l}</option>`).join('')}</select><label class="ct-bl">BL <input class="input input-sm" type="number" min="1" data-src-bl="${i}" value="${escapeHtml(String(s.butLuc ?? ''))}" aria-label="Bút lục bắt đầu của ${escapeHtml(s.name)}" placeholder="số" /></label><small data-src-range="${i}">${escapeHtml(srcRange(s))}</small></span><button class="btn btn-ghost btn-sm btn-icon" type="button" data-src-del="${i}" aria-label="Bỏ tài liệu ${escapeHtml(s.name)}">${icon('x', 'ic-sm')}</button></li>`).join('')
      : '<li class="hint">Chưa có tài liệu.</li>';
  }
  const addSource = (name, text, extra = {}) => {
    if (!String(text || '').trim()) return;
    const old = (rec.sources || []).find((s) => s.name === name) || {};
    rec.sources = [...(rec.sources || []).filter((s) => s.name !== name), { name, text: String(text), loai: old.loai || detectType(name, text), butLuc: old.butLuc ?? '', ...extra }];
    saveNow();
    drawSources();
    update();
  };

  /* ----- Bị cáo ----- */
  function defHtml(d, i) {
    const t = d.toiDanh?.[0] || {};
    const hp = d.hinhPhat || {};
    const R = generalRules(book);
    const chips = (list, sel, key) =>
      list.length
        ? list.map((p) => `<label class="chip ${sel.includes(p.d) ? 'on' : ''}" title="${escapeHtml(p.text)}"><input type="checkbox" hidden data-chip="${key}" value="${p.d}" ${sel.includes(p.d) ? 'checked' : ''} />${p.d}</label>`).join('')
        : `<input class="input input-sm" data-chips-text="${key}" value="${escapeHtml(sel.join(', '))}" placeholder="vd: b, s" />`;
    return `<article class="ct-def" data-def="${i}">
      <div class="ct-def-head"><strong>Bị cáo ${i + 1}</strong>${rec.defendants.length > 1 ? `<button class="btn btn-ghost btn-sm" type="button" data-def-del>${icon('trash', 'ic-sm')}Bỏ</button>` : ''}</div>
      <div class="grid-3">
        <div class="field"><label>Họ tên</label><input class="input" data-f="hoTen" value="${escapeHtml(d.hoTen || '')}" /></div>
        <div class="field"><label>Tuổi khi phạm tội</label><input class="input" type="number" min="14" max="100" data-f="tuoi" value="${d.tuoi ?? ''}" /></div>
        <div class="field"><label>Vai trò</label><select class="select" data-f="vaiTro">${VAI_TRO.map(([v, l]) => `<option value="${v}" ${v === (d.vaiTro || '') ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>Năm sinh</label><input class="input" data-f="namSinh" value="${escapeHtml(d.namSinh || '')}" /></div>
        <div class="field"><label>Ngày sinh (nếu có)</label><input class="input" data-f="ngaySinh" value="${escapeHtml(d.ngaySinh || '')}" placeholder="dd/mm/yyyy" /></div>
        <div class="field span-2"><label>Nơi cư trú</label><input class="input" data-f="noiCuTru" value="${escapeHtml(d.noiCuTru || '')}" /></div>
      </div>
      <div class="grid-3">
        <div class="field"><label>Biện pháp ngăn chặn</label><select class="select" data-n="loai">${NGAN_CHAN.map(([v, l]) => `<option value="${v}" ${v === (d.nganChan?.loai || '') ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>Tạm giam từ ngày</label><input class="input" type="date" data-n="tu" value="${escapeHtml(d.nganChan?.tu || '')}" /></div>
        <div class="field"><label>Hết hạn tạm giam (theo lệnh)</label><input class="input" type="date" data-n="den" value="${escapeHtml(d.nganChan?.den || '')}" /></div>
      </div>
      <div class="grid-4">
        <div class="field"><label>Điều (tội danh)</label><input class="input" data-t="dieu" value="${escapeHtml(t.dieu || '')}" placeholder="vd: 174" /></div>
        <div class="field"><label>Khoản</label><input class="input" type="number" min="1" max="9" data-t="khoan" value="${t.khoan ?? ''}" /></div>
        <div class="field"><label>Điểm</label><input class="input" data-t="diem" value="${escapeHtml((t.diem || []).join(', '))}" placeholder="vd: a" /></div>
        <div class="field"><label>Giá trị tài sản / thiệt hại</label><input class="input" data-f="soTien" value="${d.soTien != null ? fmtVnd(d.soTien) : ''}" placeholder="vd: 180.000.000 đồng" /></div>
      </div>
      <p class="hint" data-def-crime>${crimeHint(t.dieu)}</p>
      <div class="grid-4">
        <div class="field"><label>Hình phạt chính</label><select class="select" data-h="loai">${LOAI_HP.map(([v, l]) => `<option value="${v}" ${v === (hp.loai || '') ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>Thời hạn (năm)</label><input class="input" type="number" min="0" max="30" data-h="nam" value="${hp.thang != null ? Math.floor(hp.thang / 12) : ''}" /></div>
        <div class="field"><label>Thời hạn (tháng)</label><input class="input" type="number" min="0" max="11" data-h="thangLe" value="${hp.thang != null ? hp.thang % 12 : ''}" /></div>
        <div class="field"><label class="check"><input type="checkbox" data-h="anTreo" ${hp.anTreo ? 'checked' : ''} />Án treo — thử thách (năm)</label><input class="input" type="number" min="0" max="10" data-h="thuThachNam" value="${hp.thuThach != null ? hp.thuThach / 12 : ''}" /></div>
      </div>
      <div class="ct-chips"><span>Giảm nhẹ — khoản 1 Điều 51:</span>${chips(R.a51.k1, d.giamNhe || [], 'giamNhe')}<label class="check"><input type="checkbox" data-f="giamNheK2" ${d.giamNheK2 ? 'checked' : ''} />khoản 2 Điều 51</label></div>
      <div class="ct-chips"><span>Tăng nặng — khoản 1 Điều 52:</span>${chips(R.a52.k1, d.tangNang || [], 'tangNang')}</div>
      <div class="ct-chips"><label class="check"><input type="checkbox" data-f="dieu54" ${d.dieu54 ? 'checked' : ''} />Áp dụng Điều 54 (dưới mức thấp nhất của khung)</label><label class="check"><input type="checkbox" data-f="dieu65" ${d.dieu65 ? 'checked' : ''} />Điều 65 (án treo)</label></div>
    </article>`;
  }
  function drawDefs() {
    $('[data-ct-defs]', root).innerHTML = rec.defendants.map(defHtml).join('');
  }
  function readDef(el) {
    const d = rec.defendants[+el.dataset.def];
    const v = (sel) => el.querySelector(sel);
    d.hoTen = v('[data-f="hoTen"]').value.trim();
    d.tuoi = v('[data-f="tuoi"]').value ? +v('[data-f="tuoi"]').value : null;
    d.vaiTro = v('[data-f="vaiTro"]').value;
    d.namSinh = v('[data-f="namSinh"]').value.trim();
    d.ngaySinh = v('[data-f="ngaySinh"]').value.trim();
    d.noiCuTru = v('[data-f="noiCuTru"]').value.trim();
    d.nganChan = { loai: v('[data-n="loai"]').value, tu: v('[data-n="tu"]').value, den: v('[data-n="den"]').value };
    d.soTien = parseMoney(v('[data-f="soTien"]').value);
    d.giamNheK2 = v('[data-f="giamNheK2"]').checked;
    d.dieu54 = v('[data-f="dieu54"]').checked;
    d.dieu65 = v('[data-f="dieu65"]').checked;
    d.toiDanh = [{ dieu: v('[data-t="dieu"]').value.trim().toLowerCase(), khoan: v('[data-t="khoan"]').value ? +v('[data-t="khoan"]').value : null, diem: v('[data-t="diem"]').value.split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean) }, ...(d.toiDanh || []).slice(1)];
    for (const key of ['giamNhe', 'tangNang']) {
      const txt = v(`[data-chips-text="${key}"]`);
      d[key] = txt ? txt.value.split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean) : [...el.querySelectorAll(`[data-chip="${key}"]:checked`)].map((x) => x.value);
    }
    const loai = v('[data-h="loai"]').value;
    const nam = +v('[data-h="nam"]').value || 0;
    const thangLe = +v('[data-h="thangLe"]').value || 0;
    const anTreo = v('[data-h="anTreo"]').checked;
    const tt = v('[data-h="thuThachNam"]').value;
    d.hinhPhat = { loai, thang: (loai === 'tu' || loai === 'cai-tao') && (nam || thangLe) ? nam * 12 + thangLe : null, anTreo, thuThach: anTreo && tt !== '' ? Math.round(+tt * 12) : null };
    if (anTreo) d.dieu65 = true;
  }

  /* ----- Kết quả ----- */
  const lawHtml = (law) => (law || []).map((l) => `<blockquote class="ct-law"><b>${escapeHtml(l.ref)}</b>${l.quote ? `: “${escapeHtml(l.quote)}”` : ''}</blockquote>`).join('');
  const factHtml = (facts) => (facts || []).map((f) => `<blockquote class="ct-fact" data-no-law-link><b>Trích tài liệu${f.src ? ` (${escapeHtml(f.src)})` : ''}:</b> “${escapeHtml(f.quote)}”</blockquote>`).join('');
  const findingHtml = (f) => `<li class="ct-f lv-${f.level}"><div class="ct-f-head"><span class="badge ${LV_CLASS[f.level]}">${LEVELS[f.level]}</span><strong>${escapeHtml(f.title)}</strong></div>${f.detail ? `<p>${escapeHtml(f.detail)}</p>` : ''}${lawHtml(f.law)}${factHtml(f.facts)}${f.yeuCau ? `<p class="ct-yc">${icon('arrow-right', 'ic-sm')}${escapeHtml(f.yeuCau)}</p>` : ''}</li>`;

  function analysisHtml() {
    const primary = rec.defendants[0]?.toiDanh?.[0]?.dieu || null;
    const amount = rec.defendants.find((d) => d.soTien != null)?.soTien ?? null;
    const a = analyzeCase({ sources: rec.sources || [], book, primary: findCrime(primary) ? primary : null, defendants: rec.defendants, amount });
    if (!(rec.sources || []).length) return `<p class="note">${icon('info', 'ic-sm')}<span>Thêm tài liệu (bản án, cáo trạng, kết luận điều tra, lời khai) để phân tích hành vi.</span></p>`;
    // Câu trích chỉ hiện một lần (nhiều yếu tố thường cùng một câu).
    const seenQ = new Set();
    const el = (y) => {
      const q = y.quote && !seenQ.has(y.quote) ? (seenQ.add(y.quote), y.quote) : '';
      return `<li class="${y.ok ? 'ok' : 'no'}">${icon(y.ok ? 'check' : 'x', 'ic-sm')}<span>${escapeHtml(y.label)}${y.ok && y.khop ? ` <small class="ct-khop">khớp cụm “${escapeHtml(y.khop)}”</small>` : ''}${q ? `<blockquote class="ct-fact" data-no-law-link>“${escapeHtml(q)}”</blockquote>` : ''}</span></li>`;
    };
    return `<div class="ct-cols">
      <section><h3>Hành vi và tội danh có căn cứ</h3>
        ${a.crimes.length ? a.crimes.map((c) => `<div class="ct-crime"><h4>Điều ${c.dieu}. ${escapeHtml(c.ten)}${c.khung ? ` — khoản ${c.khung}` : ''}</h4>${c.why ? `<p class="hint">${escapeHtml(c.why)}</p>` : ''}${c.yeuTo.length ? `<ul class="ct-els">${c.yeuTo.map(el).join('')}</ul>` : ''}${c.signs.length ? `<p><b>Dấu hiệu định khung có trong tài liệu:</b></p><ul class="ct-els">${c.signs.map((s) => `<li class="ok">${icon('check', 'ic-sm')}<span>điểm ${s.d} khoản ${s.k}: ${escapeHtml(s.text)}<blockquote class="ct-fact" data-no-law-link>“${escapeHtml(s.quote)}”</blockquote></span></li>`).join('')}</ul>` : ''}${c.frame ? lawHtml([{ ref: `khoản ${c.khung} Điều ${c.dieu} BLHS`, quote: c.frame.text.split('\n')[0] }]) : ''}${c.hint ? `<p class="note">${icon('info', 'ic-sm')}<span>${escapeHtml(c.hint)}</span></p>` : ''}</div>`).join('') : '<p class="hint">Chưa xác định được điều luật có đủ căn cứ.</p>'}
      </section>
      <section><h3>Tình tiết có dấu hiệu trong tài liệu</h3>
        ${a.mitig.length ? `<p><b>Giảm nhẹ (khoản 1 Điều 51)</b></p><ul class="ct-els">${a.mitig.map((x) => `<li class="ok">${icon('check', 'ic-sm')}<span>điểm ${x.d}: ${escapeHtml(x.text)}<blockquote class="ct-fact" data-no-law-link>“${escapeHtml(x.quote)}”</blockquote></span></li>`).join('')}</ul>` : '<p class="hint">Chưa thấy tình tiết giảm nhẹ.</p>'}
        ${a.aggr.length ? `<p><b>Tăng nặng (khoản 1 Điều 52)</b></p><ul class="ct-els">${a.aggr.map((x) => `<li class="no">${icon('alert', 'ic-sm')}<span>điểm ${x.d}: ${escapeHtml(x.text)}<blockquote class="ct-fact" data-no-law-link>“${escapeHtml(x.quote)}”</blockquote></span></li>`).join('')}</ul>` : '<p class="hint">Chưa thấy tình tiết tăng nặng.</p>'}
        <h3>Hướng giải quyết</h3><ol class="ct-huong">${a.huong.map((h) => `<li><b>${escapeHtml(h.t)}:</b> ${escapeHtml(h.d)}</li>`).join('')}</ol>
        <div class="inline"><button class="btn btn-sm" type="button" data-ct-ai="phan-tich" ${aiBusy ? 'disabled' : ''}>${icon('sparkles', 'ic-sm')}${aiBusy ? 'AI đang phân tích…' : 'AI phân tích sâu (chỉ dựa trên tài liệu)'}</button></div>
        ${aiText['phan-tich'] ? `<div class="ct-ai md" data-ai-box="phan-tich">${escapeHtml(aiText['phan-tich']).replace(/\n/g, '<br>')}</div>` : ''}
      </section>
    </div>`;
  }
  function checkHtml() {
    return rec.defendants
      .map((d, i) => {
        const f = checkDefendant(d, { book, sources: rec.sources || [] });
        const n = (lv) => f.filter((x) => x.level === lv).length;
        return `<section class="ct-check"><h3>${escapeHtml(d.hoTen || `Bị cáo ${i + 1}`)} <small>${n('loi')} có dấu hiệu sai · ${n('canh')} cần xem lại · ${n('goi')} có thể đề nghị · ${n('dung')} phù hợp</small></h3><ul class="ct-fs">${f.map(findingHtml).join('')}</ul></section>`;
      })
      .join('');
  }
  /* ----- Xem xét đơn nhận được ----- */
  function drawDons() {
    const host = $('[data-don-list]', root);
    host.innerHTML = rec.dons.length
      ? rec.dons.map((x) => `<li class="${x.id === donSel ? 'on' : ''}"><button class="btn btn-ghost btn-sm ct-don-pick" type="button" data-don-pick="${x.id}" aria-pressed="${x.id === donSel}">${icon('mail', 'ic-sm')}<strong>${escapeHtml(x.name)}</strong><small>${x.text.length.toLocaleString('vi-VN')} ký tự</small></button><button class="btn btn-ghost btn-sm btn-icon" type="button" data-don-del="${x.id}" aria-label="Bỏ đơn ${escapeHtml(x.name)}">${icon('x', 'ic-sm')}</button></li>`).join('')
      : '<li class="hint">Chưa có đơn nào.</li>';
  }
  const currentDon = () => rec.dons.find((x) => x.id === donSel) || null;
  const assess = (don) => assessComplaint({ text: don.text, defendants: rec.defendants, sources: rec.sources || [], book, banAn: rec.banAn || {} });
  const reasonHtml = (cls, ic, title, r) => `<li class="${cls}">${icon(ic, 'ic-sm')}<span><b>${title}:</b> ${escapeHtml(r.text)}${lawHtml(r.law)}${factHtml(r.facts)}</span></li>`;
  function reviewHtml() {
    const don = currentDon();
    if (!don) return `<p class="note">${icon('info', 'ic-sm')}<span>Tải đơn khiếu nại / kháng cáo đã nhận ở khung <b>Đơn nhận được</b> phía trên để xem xét.</span></p>`;
    const r = assess(don);
    const n = r.parsed.nguoi;
    const ba = r.parsed.banAn;
    const info = [
      ['Loại đơn', LOAI_DON[r.parsed.loai] || 'Chưa rõ'],
      ['Người gửi', [n.hoTen, n.namSinh && `sinh năm ${n.namSinh}`].filter(Boolean).join(', ') || 'Chưa đọc được'],
      ['Tư cách', n.tuCach || 'Chưa rõ'],
      ['Ngày đơn', r.parsed.ngay || 'Chưa rõ'],
      ['Bản án', [ba.so || rec.banAn?.so, (ba.ngay || rec.banAn?.ngay) && `ngày ${ba.ngay || rec.banAn?.ngay}`].filter(Boolean).join(' ') || 'Chưa rõ'],
      ['Đối chiếu với', [r.defendant?.hoTen && `bị cáo ${r.defendant.hoTen}`, r.defendant?.toiDanh?.[0]?.dieu && `${r.defendant.toiDanh[0].khoan ? `khoản ${r.defendant.toiDanh[0].khoan} ` : ''}Điều ${r.defendant.toiDanh[0].dieu}`, r.hinhPhat].filter(Boolean).join(', ') || 'Chưa có quyết định (phần 2)'],
    ];
    const cnt = Object.keys(KET_LUAN).map((k) => [k, r.items.filter((x) => x.kl === k).length]).filter(([, c]) => c);
    return `<div class="ct-review">
      <div class="ct-don-head"><dl class="ct-don-meta">${info.map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>
        <div class="ct-verdict"><span>Kết luận chung</span><span class="badge ${KL_CLASS[r.overall]}" data-don-overall>Đơn ${KET_LUAN[r.overall].toLowerCase()}</span><small>${r.items.length} yêu cầu: ${cnt.map(([k, c]) => `${c} ${KET_LUAN[k].toLowerCase()}`).join(' · ')}</small></div></div>
      ${r.notes.length ? `<ul class="ct-notes">${r.notes.map((x) => `<li class="lv-${x.level}">${icon(x.level === 'dung' ? 'check' : 'info', 'ic-sm')}<span>${escapeHtml(x.text)}</span></li>`).join('')}</ul>` : ''}
      <ol class="ct-fs ct-yc-list">${r.items
        .map(
          (it) => `<li class="ct-f kl-${it.kl}" data-yc="${it.type}"><div class="ct-f-head"><span class="badge ${KL_CLASS[it.kl]}">${KET_LUAN[it.kl]}</span><strong>${escapeHtml(it.label)}</strong></div>
          ${it.quotes.map((q) => `<blockquote class="ct-don-q" data-no-law-link><b>Nội dung đơn:</b> “${escapeHtml(q)}”</blockquote>`).join('')}
          <ul class="ct-els">${it.co.map((x) => reasonHtml('ok', 'check', 'Có căn cứ', x)).join('')}${it.khong.map((x) => reasonHtml('no', 'x', 'Không có căn cứ', x)).join('')}${it.xacMinh.map((x) => reasonHtml('xm', 'help', 'Cần xác minh', x)).join('')}</ul></li>`,
        )
        .join('')}</ol>
      <div class="inline"><button class="btn" type="button" data-don-preview>${icon('eye', 'ic-sm')}Xem trước phiếu xem xét đơn</button><button class="btn btn-primary" type="button" data-don-export>${icon('download', 'ic-sm')}Xuất Word</button><button class="btn" type="button" data-don-reply>${icon('mail', 'ic-sm')}Dự thảo văn bản trả lời</button><button class="btn btn-sm" type="button" data-ct-ai="don" ${aiBusy ? 'disabled' : ''}>${icon('sparkles', 'ic-sm')}${aiBusy ? 'AI đang xem xét…' : 'AI xem xét đơn (chỉ dựa trên tài liệu)'}</button></div>
      ${aiText.don ? `<div class="ct-ai md" data-ai-box="don">${escapeHtml(aiText.don).replace(/\n/g, '<br>')}</div>` : ''}
    </div>`;
  }
  function reviewDoc() {
    const don = currentDon();
    if (!don) return warnMissing('Chưa có đơn: tải đơn khiếu nại / kháng cáo ở khung Đơn nhận được', $('[data-don-paste]', root)), null;
    return buildReviewDocument(assess(don), { banAn: rec.banAn || {}, org: ctx.settings?.().legalOrg || {}, ten: rec.ten || '' });
  }

  const update = debounce(() => {
    const out = $('[data-ct-out]', root);
    if (!out) return;
    $$('[data-ct-tab]', root).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ctTab === tab)));
    $('[data-ct-don]', root).hidden = tab !== 'khieu-nai';
    $$('[data-pane]', root).forEach((p) => (p.hidden = p.dataset.pane !== tab));
    const inOut = ['phan-tich', 'kiem-tra', 'khieu-nai', 'tham-tra', 'chung-cu', 'tuong-tu'].includes(tab);
    out.hidden = !inOut;
    $('[data-ct-book]', root).hidden = !!book || !['kiem-tra', 'hinh-phat', 'tai-lieu'].includes(tab);
    if (tab === 'vu-an') panes['vu-an'] ? panes['vu-an'].refresh() : (panes['vu-an'] = mountCasePane($('[data-pane="vu-an"]', root), { ctx, rec, save, getBook: () => book, onChange: onCaseChange, addSource, newDefendant }));
    else if (tab === 'hinh-phat') panes['hinh-phat'] ? panes['hinh-phat'].refresh() : (panes['hinh-phat'] = mountPenaltyPane($('[data-pane="hinh-phat"]', root), { rec, save, getBook: () => book }));
    else if (tab === 'bieu-mau') panes['bieu-mau'] ? panes['bieu-mau'].refresh() : (panes['bieu-mau'] = mountFormsPane($('[data-pane="bieu-mau"]', root), { ctx, rec, save }));
    if (!inOut) return;
    const tctx = { rec, book, laws: laws(), docs: khoDocs, anLe: anLeData, aiText: aiText['tham-tra'], aiBusy };
    out.innerHTML = tab === 'phan-tich' ? analysisHtml() : tab === 'kiem-tra' ? checkHtml() : tab === 'tham-tra' ? thamTraHtml(tctx) : tab === 'chung-cu' ? chungCuHtml(tctx) : tab === 'tuong-tu' ? tuongTuHtml(tctx) : reviewHtml();
  }, 120);

  // Đổi cấp xét xử ở tab Vụ án → nhãn trên đầu; biểu mẫu vẽ lại theo cấp.
  let lastCap = rec.cap;
  function onCaseChange() {
    $('[data-ct-cap]', root).textContent = CAP[rec.cap] || '';
    // Bộ nhập từ tệp có thể đổi tên hồ sơ, bị cáo, người tham gia → cập nhật phần ngoài tab Vụ án.
    const nameEl = $('[data-ct-name]', root);
    if (nameEl && nameEl.value !== (rec.ten || '')) nameEl.value = rec.ten || '';
    drawDefs();
    // Không gọi update() ở đây: update() vẽ lại cả tab Vụ án (mất ô đang gõ); các tab khác tự vẽ khi mở.
    if (rec.cap === lastCap || !panes['bieu-mau']) return (lastCap = rec.cap);
    lastCap = rec.cap;
    const fresh = document.createElement('div');
    fresh.dataset.pane = 'bieu-mau';
    fresh.hidden = true;
    $('[data-pane="bieu-mau"]', root).replaceWith(fresh);
    panes['bieu-mau'] = null;
  }

  /* ----- Gắn sự kiện ----- */
  function bind() {
    $('[data-ct-name]', root).addEventListener('input', (e) => {
      rec.ten = e.target.value;
      save();
    });
    $('[data-ct-save]', root).addEventListener('click', () => {
      if (!draft) {
        saveNow();
        toast('Đã lưu hồ sơ');
        return;
      }
      if (!String(rec.ten || '').trim()) rec.ten = TEN_MOI[rec.cap] || 'Hồ sơ xét xử';
      draft = false;
      changed = false;
      delete rec.draft;
      delete rec.stashedAt;
      Object.assign(rec, courtRepo.save(rec));
      store.remove(DRAFT_KEY);
      toast(`Đã lưu hồ sơ “${rec.ten}” vào sổ vụ án`, { timeout: 4000 });
      ctx.navigate(`#toa-an/${rec.id}/${tab}`);
    });
    $('[data-ct-cancel]', root)?.addEventListener('click', async () => {
      if (changed && !(await ctx.confirm('Bỏ bản nháp này? Nội dung đã nhập sẽ mất.', { title: 'Bỏ bản nháp', okText: 'Bỏ bản nháp', danger: true }))) return;
      changed = false;
      store.remove(DRAFT_KEY);
      ctx.navigate('#toa-an');
    });
    $('[data-ct-del]', root)?.addEventListener('click', async () => {
      if (!(await ctx.confirm(`Xóa hồ sơ “${rec.ten || 'Hồ sơ xét xử'}” cùng tài liệu, bị cáo, đơn và kết quả thẩm tra đã nạp? Không hoàn tác được.`, { title: 'Xóa hồ sơ xét xử', okText: 'Xóa vĩnh viễn', danger: true }))) return;
      dirty = false;
      courtRepo.remove(rec.id);
      toast('Đã xóa hồ sơ xét xử');
      ctx.navigate('#toa-an');
    });
    $('[data-ct-case]', root).addEventListener('change', (e) => {
      const c = casesRepo.get(e.target.value);
      rec.caseId = c?.id || null;
      if (c) {
        if (!rec.ten || rec.ten === 'Hồ sơ xét xử mới') {
          rec.ten = c.ten;
          $('[data-ct-name]', root).value = c.ten;
        }
        const recs = recordsRepo.list((r) => r.caseId === c.id);
        recs.forEach((r) => addSource(`Lời khai: ${r.nguoiKhai?.hoTen || 'chưa ghi tên'} (lần ${r.lan || 1})`, recordText(r)));
        // Bị cáo từ hồ sơ: người tư cách bị can.
        const biCan = (c.persons || []).filter((p) => p.roleId === 'bi-can');
        if (biCan.length && rec.defendants.every((d) => !d.hoTen)) rec.defendants = biCan.map((p) => newDefendant({ hoTen: p.hoTen, toiDanh: [{ dieu: c.toiDanh?.[0] || '', khoan: null, diem: [] }] }));
        drawDefs();
        toast(`Đã lấy ${recs.length} biên bản${biCan.length ? `, ${biCan.length} bị can` : ''} từ hồ sơ`);
      }
      save();
      update();
    });
    const drop = bindDropzone($('[data-ct-src]', root), async (files) => {
      if (!files.length) return;
      const say = (t) => ($('[data-ct-say]', root).textContent = t);
      for (const f of [...files]) {
        try {
          // Giữ từng trang (PDF) để tính bút lục của câu trích; ghi độ tin cậy OCR để cảnh báo tài liệu đọc không rõ.
          say(`Đang đọc “${f.name}”…`);
          const r = await extractText(f, { onProgress: (p) => say(`Nhận dạng chữ “${f.name}” — trang ${p.page}/${p.total}`) });
          addSource(f.name, r.text, { ...(r.pageTexts?.length > 1 && { pages: r.pageTexts }), ...(r.ocr && r.confidence != null && { ocrConf: r.confidence > 1 ? r.confidence / 100 : r.confidence }) });
        } catch (e) {
          toast(e.message, { type: 'error', timeout: 6000 });
        }
      }
      files.splice(0);
      say('');
      $('[data-ct-src] [data-files]', root).innerHTML = '';
    });
    void drop;
    // Đơn nhận được: tải tệp / dán → danh sách đơn, chọn đơn để xem xét.
    let donFiles = [];
    bindDropzone($('[data-don-drop]', root), (files) => (donFiles = files));
    $('[data-don-add]', root).addEventListener('click', async () => {
      const ta = $('[data-don-paste]', root);
      if (!donFiles.length && !ta.value.trim()) return warnMissing('Chưa có đơn: chọn tệp đơn hoặc dán nội dung đơn vào ô bên cạnh', ta);
      const say = (t) => ($('[data-don-say]', root).textContent = t);
      const add = (name, text) => {
        if (!String(text || '').trim()) return;
        const don = { id: uid(), name, text: String(text) };
        rec.dons.push(don);
        donSel = don.id;
      };
      for (const f of [...donFiles]) {
        try {
          add(f.name, await readAll([f], '', say));
        } catch (e) {
          toast(e.message, { type: 'error', timeout: 6000 });
        }
      }
      if (ta.value.trim()) add(`Đơn dán ${rec.dons.filter((x) => /^Đơn dán/.test(x.name)).length + 1}`, ta.value);
      donFiles.splice(0);
      ta.value = '';
      say('');
      $('[data-don-drop] [data-files]', root).innerHTML = '';
      saveNow();
      drawDons();
      update();
    });
    $('[data-don-list]', root).addEventListener('click', (e) => {
      const del = e.target.closest('[data-don-del]');
      const pick = e.target.closest('[data-don-pick]');
      if (del) {
        rec.dons = rec.dons.filter((x) => x.id !== del.dataset.donDel);
        if (donSel === del.dataset.donDel) donSel = rec.dons[rec.dons.length - 1]?.id || null;
        saveNow();
      } else if (pick) donSel = pick.dataset.donPick;
      else return;
      drawDons();
      update();
    });
    $('[data-ct-add]', root).addEventListener('click', () => {
      const ta = $('[data-ct-paste]', root);
      if (!ta.value.trim()) return warnMissing('Chưa có nội dung: dán nội dung bản án / tài liệu vào ô bên trên', ta);
      addSource(`Nội dung dán ${(rec.sources || []).filter((s) => /^Nội dung dán/.test(s.name)).length + 1}`, ta.value);
      ta.value = '';
    });
    $('[data-ct-parse]', root).addEventListener('click', () => {
      const ta = $('[data-ct-paste]', root);
      if (ta.value.trim()) $('[data-ct-add]', root).click();
      if (!(rec.sources || []).length) return warnMissing('Chưa có tài liệu: tải bản án / cáo trạng hoặc dán nội dung trước', $('[data-drop]', root));
      // Chỉ đọc tài liệu loại "Bản án" nếu có (số tiền, quyết định lấy từ bản án, không lấy lời khai).
      const pool = rec.sources.filter((s) => s.loai === 'ban-an');
      const v = parseVerdict((pool.length ? pool : rec.sources).map((s) => s.text).join('\n'));
      if (!v.defendants.length) return warnMissing('Không đọc được phần quyết định (cần câu dạng “Áp dụng … Xử phạt bị cáo …”) — nhập tay ở phần Bị cáo');
      const maxMoney = v.money.sort((a, b) => b.v - a.v)[0]?.v ?? null;
      rec.defendants = v.defendants.map((d) => {
        const old = rec.defendants.find((x) => x.hoTen && x.hoTen === d.hoTen) || {};
        return newDefendant({ ...old, ...d, id: old.id || uid(), soTien: old.soTien ?? maxMoney, toiDanh: d.toiDanh.length ? d.toiDanh : old.toiDanh || [{ dieu: '', khoan: null, diem: [] }] });
      });
      save();
      drawDefs();
      update();
      toast(`Đã đọc ${v.defendants.length} bị cáo — kiểm tra lại các ô đã điền`, { timeout: 5000 });
    });
    $('[data-ct-indict]', root).addEventListener('click', () => {
      const ta = $('[data-ct-paste]', root);
      if (ta.value.trim()) $('[data-ct-add]', root).click();
      if (!(rec.sources || []).length) return warnMissing('Chưa có tài liệu: tải cáo trạng hoặc dán nội dung trước', $('[data-drop]', root));
      const pool = rec.sources.filter((s) => s.loai === 'cao-trang');
      const ct = parseIndictment((pool.length ? pool : rec.sources).map((s) => s.text).join('\n'));
      if (!ct.defendants.length) return warnMissing('Không đọc được phần truy tố (cần câu dạng “Truy tố bị can … về tội … theo … Điều …”) — nhập tay ở phần Bị cáo');
      rec.caoTrang = { ...(rec.caoTrang || {}), ...(ct.so && { so: ct.so }), ...(ct.ngay && { ngay: ct.ngay }), ...(ct.vks && { vks: ct.vks }) };
      rec.hdxx = { ...(rec.hdxx || {}) };
      if (!rec.hdxx.vks && ct.vks) rec.hdxx.vks = ct.vks;
      const maxMoney = ct.money.sort((a, b) => b.v - a.v)[0]?.v ?? null;
      rec.defendants = ct.defendants.map((d) => {
        const old = rec.defendants.find((x) => x.hoTen && x.hoTen === d.hoTen) || {};
        return newDefendant({ ...old, ...d, id: old.id || uid(), soTien: old.soTien ?? maxMoney, nganChan: d.nganChan || old.nganChan || {} });
      });
      rec.nguoiThamGia = [...(rec.nguoiThamGia || [])];
      for (const n of ct.biHai) if (!rec.nguoiThamGia.some((p) => p.hoTen === n)) rec.nguoiThamGia.push({ vaiTro: 'bi-hai', hoTen: n, diaChi: '' });
      if (!rec.loaiToi) rec.loaiToi = suggestLoaiToi(rec.defendants, book) || '';
      if (/^Vụ án (sơ|phúc) thẩm mới$|^Hồ sơ xét xử mới$/.test(rec.ten || '')) {
        rec.ten = `${ct.defendants[0].tenToi || 'Vụ án'} — ${ct.defendants.map((d) => d.hoTen).join(', ')}`;
        $('[data-ct-name]', root).value = rec.ten;
      }
      save();
      drawDefs();
      update();
      toast(`Đã đọc cáo trạng${ct.so ? ` số ${ct.so}` : ''}: ${ct.defendants.length} bị cáo${ct.biHai.length ? `, ${ct.biHai.length} bị hại` : ''} — kiểm tra lại các ô đã điền`, { timeout: 5000 });
    });
    $('[data-ct-sources]', root).addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.srcLoai != null) rec.sources[+t.dataset.srcLoai].loai = t.value;
      else if (t.dataset.srcBl != null) {
        const s = rec.sources[+t.dataset.srcBl];
        s.butLuc = t.value === '' ? '' : Math.max(1, Math.round(+t.value));
        $(`[data-src-range="${t.dataset.srcBl}"]`, root).textContent = srcRange(s);
      } else return;
      saveNow();
      update();
    });
    $('[data-ct-sources]', root).addEventListener('click', (e) => {
      const b = e.target.closest('[data-src-del]');
      if (!b) return;
      rec.sources.splice(+b.dataset.srcDel, 1);
      save();
      drawSources();
      update();
    });
    $('[data-ct-adddef]', root).addEventListener('click', () => {
      rec.defendants.push(newDefendant());
      save();
      drawDefs();
      update();
    });
    const defs = $('[data-ct-defs]', root);
    const onDef = (e) => {
      const el = e.target.closest('[data-def]');
      if (!el) return;
      if (e.target.matches('[data-chip]')) e.target.closest('.chip').classList.toggle('on', e.target.checked);
      readDef(el);
      save();
      update();
    };
    defs.addEventListener('input', onDef);
    defs.addEventListener('change', (e) => {
      onDef(e);
      if (e.target.matches('[data-t="dieu"]')) e.target.closest('[data-def]').querySelector('[data-def-crime]').innerHTML = crimeHint(e.target.value.trim());
    });
    defs.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-def-del]');
      if (!b) return;
      rec.defendants.splice(+b.closest('[data-def]').dataset.def, 1);
      save();
      drawDefs();
      update();
    });
    $$('[data-ct-tab]', root).forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.ctTab;
        history.replaceState(null, '', `${base()}/${tab}`);
        update();
      }),
    );
    const out = $('[data-ct-out]', root);
    bindThamTra(out, { ctx, getRec: () => rec, getCtx: () => ({ book, laws: laws(), docs: khoDocs, anLe: anLeData }), save, update });
    out.addEventListener('click', (e) => {
      if (e.target.closest('[data-don-export]')) {
        const doc = reviewDoc();
        if (!doc) return;
        downloadBlob(buildDocx(doc, doc.title.name), safeFileName(`Phieu-xem-xet-don-${currentDon()?.name || ''}`), DOCX_MIME);
        toast('Đã xuất phiếu xem xét đơn (.docx)');
      } else if (e.target.closest('[data-don-preview]')) {
        const doc = reviewDoc();
        if (!doc) return;
        ctx.modal(`<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button><div class="preview-modal-body print-area">${renderDocumentHtml(doc)}</div><div class="modal-actions"><button class="btn" type="button" data-close>Đóng</button></div>`, { className: 'modal-wide preview-modal', label: 'Xem trước phiếu xem xét đơn' });
      } else if (e.target.closest('[data-don-reply]')) {
        const don = currentDon();
        if (!don) return warnMissing('Chưa có đơn');
        const doc = buildReplyLetter(rec, don, { book, org: ctx.settings?.().courtOrg || {} });
        ctx.modal(`<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button><div class="preview-modal-body print-area">${renderDocumentHtml(doc)}</div><div class="modal-actions"><button class="btn" type="button" data-close>Đóng</button><button class="btn btn-primary" type="button" data-reply-export>${icon('download', 'ic-sm')}Xuất Word</button></div>`, {
          className: 'modal-wide preview-modal',
          label: 'Dự thảo văn bản trả lời',
          onMount(box) {
            box.querySelector('[data-reply-export]').addEventListener('click', () => {
              downloadBlob(buildDocx(doc, 'Tra loi don'), safeFileName(`Tra-loi-don-${don.name}`), DOCX_MIME);
              toast('Đã xuất dự thảo văn bản trả lời (.docx)');
            });
          },
        });
      } else if (e.target.closest('[data-ct-ai]')) runAi(e.target.closest('[data-ct-ai]').dataset.ctAi || 'phan-tich');
    });
  }

  async function runAi(kind = 'phan-tich') {
    const ai = ctx.ai('legal');
    if (!ai) return warnMissing(ctx.can('legal.ai') ? 'Chưa kết nối AI — thêm API key (hoặc AI nội bộ) trong Cài đặt' : 'Phân hệ Tố tụng đang ngoại tuyến — phần phân tích trên máy vẫn dùng được');
    const facts = (rec.sources || []).map((s) => `[${s.name}]\n${s.text}`).join('\n\n').slice(0, 24000);
    const don = kind === 'don' ? currentDon() : null;
    if (kind === 'don' && !don) return warnMissing('Chưa có đơn để xem xét');
    let system;
    let content;
    if (kind === 'tham-tra') {
      ({ system, content } = thamTraAiPrompt({ rec, book, laws: laws(), docs: khoDocs, anLe: anLeData }));
    } else if (don) {
      const r = assess(don);
      const sum = r.items.map((it) => `- ${it.label}: ${KET_LUAN[it.kl]}`).join('\n');
      system = `Bạn là thẩm phán, kiểm sát viên giàu kinh nghiệm về Bộ luật Hình sự, Bộ luật Tố tụng hình sự. Xem xét đơn khiếu nại / kháng cáo: tách từng yêu cầu của đơn, kết luận mỗi yêu cầu Có căn cứ / Có căn cứ một phần / Cần xác minh thêm / Không có căn cứ.\nQUY TẮC (bắt buộc):\n${aiRules('nguon', 'nguyenVan', 'luat', 'gon')}\nLời trình bày trong đơn KHÔNG phải chứng cứ — chỉ dùng TÀI LIỆU VỤ ÁN làm căn cứ thực tế (trích nguyên văn ngắn). Không bịa tình tiết, số liệu, điều luật. Trình bày theo từng yêu cầu: nội dung đơn → kết luận → lý do, căn cứ; cuối cùng: kết luận chung và đề xuất hướng giải quyết đơn.`;
      content = `KẾT QUẢ ĐỐI CHIẾU TRÊN MÁY (tham khảo):\n${sum}\n\nĐƠN:\n${don.text.slice(0, 12000)}\n\nTÀI LIỆU VỤ ÁN:\n${facts}`;
    } else {
      const checks = rec.defendants.map((d) => `${d.hoTen || 'Bị cáo'}: ${checkDefendant(d, { book, sources: rec.sources || [] }).filter((f) => f.level !== 'dung').map((f) => `- ${f.title}`).join('\n')}`).join('\n');
      system = `Bạn là thẩm phán, kiểm sát viên giàu kinh nghiệm về Bộ luật Hình sự 2015 (sửa đổi 2017, 2025). Phân tích hành vi phạm tội, đánh giá việc định tội, khung, mức hình phạt đã áp dụng và nêu hướng giải quyết.\nQUY TẮC (bắt buộc):\n${aiRules('nguon', 'nguyenVan', 'luat', 'gon')}\nChỉ dựa trên tài liệu được cung cấp; mỗi nhận định nêu căn cứ (trích nguyên văn ngắn). Không bịa tình tiết, số liệu, điều luật. Trình bày: 1) Hành vi; 2) Định tội, khung; 3) Tình tiết; 4) Đánh giá hình phạt đã tuyên; 5) Hướng giải quyết.`;
      content = `KẾT QUẢ ĐỐI CHIẾU TRÊN MÁY (tham khảo):\n${checks}\n\nTÀI LIỆU:\n${facts}`;
    }
    aiBusy = new AbortController();
    aiText[kind] = '';
    update();
    try {
      await streamClaude({
        ...ai,
        signal: aiBusy.signal,
        system,
        messages: [{ role: 'user', content }],
        effort: 'medium',
        onText: (_d, all) => {
          aiText[kind] = all;
          const box = $(`[data-ai-box="${kind}"]`, root);
          if (box) box.innerHTML = escapeHtml(all).replace(/\n/g, '<br>');
          else update();
        },
      });
    } catch (e) {
      if (e.name !== 'AbortError') toast(e.message, { type: 'error', timeout: 6000 });
    } finally {
      aiBusy = null;
      update();
    }
  }

  shell();
  drawSources();
  drawDons();
  drawDefs();
  bind();
  update();
  const loadKho = () =>
    courtBaDb.list().then((d) => {
      khoDocs = d;
      if (root.isConnected && ['tuong-tu', 'tham-tra'].includes(tab)) update();
    });
  document.addEventListener('kho-changed', function onKho() {
    if (!root.isConnected) return document.removeEventListener('kho-changed', onKho);
    loadKho();
  });
  loadKho().catch(() => {});
  loadBook().then((b) => {
    book = b;
    if (!root.isConnected) return;
    drawDefs();
    update();
  });
  return () => {
    aiBusy?.abort();
    flush();
    window.removeEventListener('pagehide', flush);
  };
}

