// Mục "Tòa án": phân tích hành vi phạm tội và hướng giải quyết; kiểm tra tội danh, khung, mức hình phạt đã áp dụng;
// xem xét đơn khiếu nại / kháng cáo người khác gửi đến: từng yêu cầu có căn cứ hay không (căn cứ pháp lý nguyên văn + căn cứ
// thực tế trích tài liệu vụ án), xuất phiếu xem xét đơn (Word).
import { $, $$, icon, toast, escapeHtml, debounce, downloadBlob, warnMissing } from '../ui.js';
import { courtRepo, casesRepo, recordsRepo } from '../legal/repo.js';
import { uid } from '../lib/store.js';
import { getRole } from '../legal/roles.js';
import { findCrime } from '../legal/engine.js';
import { parseVerdict, checkDefendant, analyzeCase, assessComplaint, buildReviewDocument, generalRules, fmtVnd, parseMoney, LEVELS, KET_LUAN, LOAI_DON } from '../legal/court.js';
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
const VAI_TRO = [
  ['', 'Người thực hành / chủ mưu'],
  ['dong-pham', 'Đồng phạm'],
  ['giup-suc-khong-dang-ke', 'Người giúp sức, vai trò không đáng kể (lần đầu)'],
];
const LV_CLASS = { loi: 'badge-danger', canh: 'badge-warning', goi: 'badge-accent', dung: 'badge-success' };
const KL_CLASS = { co: 'badge-success', 'mot-phan': 'badge-warning', 'xac-minh': '', khong: 'badge-danger' };
const newDefendant = (x = {}) => ({ id: uid(), hoTen: '', tuoi: null, vaiTro: '', toiDanh: [{ dieu: '', khoan: null, diem: [] }], soTien: null, giamNhe: [], giamNheK2: false, tangNang: [], dieu54: false, dieu65: false, hinhPhat: {}, ...x });
const recordText = (r) => [`BIÊN BẢN ${getRole(r.roleId).ten.split('/')[0].trim().toUpperCase()}: ${r.nguoiKhai?.hoTen || ''} (lần ${r.lan || 1})`, ...(r.qa || []).map((x) => `Hỏi: ${x.q}\nĐáp: ${x.a || ''}`)].join('\n');

/* ---------------- Danh sách ---------------- */
function renderList(ctx) {
  const list = courtRepo.list();
  ctx.view.innerHTML = `<div class="page">
    <div class="page-head"><div><h1 class="page-title">Tòa án — <em>xem xét bản án</em></h1><p class="page-sub">Phân tích hành vi phạm tội và hướng giải quyết; kiểm tra tội danh, khung, mức hình phạt đã áp dụng có đúng không; xem xét đơn khiếu nại, kháng cáo nhận được có căn cứ hay không — dựa trên tài liệu vụ án, dữ liệu điều luật và nguyên văn sách Bình luận BLHS.</p></div>
      <button class="btn btn-primary" type="button" data-new>${icon('plus', 'ic-sm')}Tạo hồ sơ xét xử</button></div>
    ${
      list.length
        ? `<ul class="ct-list">${list.map((c) => `<li><a href="#toa-an/${c.id}"><strong>${escapeHtml(c.ten || 'Hồ sơ xét xử')}</strong><small>${(c.defendants || []).map((d) => escapeHtml(d.hoTen || 'Chưa ghi tên')).join(', ') || 'Chưa có bị cáo'} · ${(c.sources || []).length} tài liệu · ${(c.dons || []).length} đơn · ${new Date(c.updatedAt).toLocaleDateString('vi-VN')}</small></a></li>`).join('')}</ul>`
        : `<section class="panel"><div class="empty"><div class="empty-icon">${icon('gavel', 'ic-lg')}</div><h3>Chưa có hồ sơ xét xử</h3><p>Tạo hồ sơ, tải bản án / cáo trạng / kết luận điều tra (hoặc chọn hồ sơ vụ án có sẵn) — phần mềm đọc tội danh, hình phạt đã áp dụng và đối chiếu với điều luật.</p></div></section>`
    }
  </div>`;
  $('[data-new]', ctx.view).addEventListener('click', () => {
    const rec = courtRepo.save({ ten: 'Hồ sơ xét xử mới', sources: [], defendants: [newDefendant()], banAn: {}, dons: [] });
    ctx.navigate(`#toa-an/${rec.id}`);
  });
}

/* ---------------- Hồ sơ xét xử ---------------- */
export function render(ctx, params = []) {
  if (!params[0]) return renderList(ctx);
  let rec = courtRepo.get(params[0]);
  if (!rec) {
    toast('Không tìm thấy hồ sơ xét xử', { type: 'error' });
    return renderList(ctx);
  }
  let book = null;
  let tab = 'phan-tich';
  const aiText = { 'phan-tich': '', don: '' };
  let aiBusy = null;
  rec.dons = rec.dons || [];
  let donSel = rec.dons[rec.dons.length - 1]?.id || null;
  const save = debounce(() => (rec = courtRepo.save(rec)), 300);
  const root = ctx.view;

  const shell = () => {
    root.innerHTML = `<div class="page ct-page">
      <a class="rd-back" href="#toa-an">${icon('chevron-left', 'ic-sm')}Hồ sơ xét xử</a>
      <input class="input ct-name" value="${escapeHtml(rec.ten || '')}" data-ct-name aria-label="Tên hồ sơ xét xử" />
      <p class="note warn ct-book" data-ct-book hidden>${icon('book', 'ic-sm')}<span>Chưa nạp sách Bình luận BLHS — chưa kiểm tra được khung, mức hình phạt (cần nguyên văn điều luật). <a href="#binh-luan">Nạp sách</a></span></p>
      <section class="panel ct-sec" data-ct-src><h2>${icon('upload', 'ic-sm')}1. Tài liệu vụ án</h2>
        <div class="grid-2">
          <div class="field"><label for="ct-case">Lấy từ hồ sơ vụ án</label><select class="select" id="ct-case" data-ct-case><option value="">— Chọn hồ sơ (lấy lời khai, tội danh, người) —</option>${casesRepo.list().map((c) => `<option value="${c.id}" ${c.id === rec.caseId ? 'selected' : ''}>${escapeHtml(c.ten)}</option>`).join('')}</select></div>
          <div class="field"><label>Bản án / cáo trạng / kết luận điều tra</label>${dropzoneHtml('Word .doc/.docx, PDF (kể cả bản scan), ảnh chụp, .txt')}</div>
        </div>
        <div class="field"><label for="ct-paste">Hoặc dán nội dung</label><textarea class="textarea" id="ct-paste" rows="3" data-ct-paste placeholder="Dán phần nhận định, quyết định của bản án…"></textarea></div>
        <div class="inline"><button class="btn btn-sm" type="button" data-ct-add>${icon('plus', 'ic-sm')}Thêm tài liệu</button><button class="btn btn-sm btn-primary" type="button" data-ct-parse>${icon('search', 'ic-sm')}Đọc bản án: tội danh, hình phạt, tình tiết</button><span class="hint" data-ct-say aria-live="polite"></span></div>
        <ul class="ct-sources" data-ct-sources></ul>
      </section>
      <section class="panel ct-sec"><h2>${icon('user', 'ic-sm')}2. Bị cáo và quyết định đã áp dụng</h2>
        <div data-ct-defs></div>
        <button class="btn btn-sm" type="button" data-ct-adddef>${icon('plus', 'ic-sm')}Thêm bị cáo</button>
        <details class="ct-don-info"><summary>Thông tin bản án (số, ngày tuyên án — dùng khi xem xét đơn)</summary><div class="grid-3">
          <div class="field"><label>Số bản án</label><input class="input" data-ban="so" value="${escapeHtml(rec.banAn?.so || '')}" placeholder="vd: 25/2026/HS-ST" /></div>
          <div class="field"><label>Ngày tuyên án</label><input class="input" data-ban="ngay" value="${escapeHtml(rec.banAn?.ngay || '')}" placeholder="vd: 15/10/2026" /></div>
          <div class="field"><label>Tòa án xét xử</label><input class="input" data-ban="toa" value="${escapeHtml(rec.banAn?.toa || '')}" placeholder="vd: Tòa án nhân dân huyện X" /></div>
        </div></details>
      </section>
      <div class="seg ct-tabs" role="tablist">
        <button role="tab" data-ct-tab="phan-tich">${icon('activity', 'ic-sm')}Phân tích hành vi &amp; hướng giải quyết</button>
        <button role="tab" data-ct-tab="kiem-tra">${icon('check-circle', 'ic-sm')}Kiểm tra tội danh, hình phạt</button>
        <button role="tab" data-ct-tab="khieu-nai">${icon('file', 'ic-sm')}Xem xét đơn khiếu nại / kháng cáo</button>
      </div>
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
      ? rec.sources.map((s, i) => `<li><span>${icon('file', 'ic-sm')}<strong>${escapeHtml(s.name)}</strong><small>${s.text.length.toLocaleString('vi-VN')} ký tự</small></span><button class="btn btn-ghost btn-sm btn-icon" type="button" data-src-del="${i}" aria-label="Bỏ tài liệu ${escapeHtml(s.name)}">${icon('x', 'ic-sm')}</button></li>`).join('')
      : '<li class="hint">Chưa có tài liệu.</li>';
  }
  const addSource = (name, text) => {
    if (!String(text || '').trim()) return;
    rec.sources = [...(rec.sources || []).filter((s) => s.name !== name), { name, text: String(text) }];
    save();
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
    const crime = findCrime(t.dieu);
    return `<article class="ct-def" data-def="${i}">
      <div class="ct-def-head"><strong>Bị cáo ${i + 1}</strong>${rec.defendants.length > 1 ? `<button class="btn btn-ghost btn-sm" type="button" data-def-del>${icon('trash', 'ic-sm')}Bỏ</button>` : ''}</div>
      <div class="grid-3">
        <div class="field"><label>Họ tên</label><input class="input" data-f="hoTen" value="${escapeHtml(d.hoTen || '')}" /></div>
        <div class="field"><label>Tuổi khi phạm tội</label><input class="input" type="number" min="14" max="100" data-f="tuoi" value="${d.tuoi ?? ''}" /></div>
        <div class="field"><label>Vai trò</label><select class="select" data-f="vaiTro">${VAI_TRO.map(([v, l]) => `<option value="${v}" ${v === (d.vaiTro || '') ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      <div class="grid-4">
        <div class="field"><label>Điều (tội danh)</label><input class="input" data-t="dieu" value="${escapeHtml(t.dieu || '')}" placeholder="vd: 174" /></div>
        <div class="field"><label>Khoản</label><input class="input" type="number" min="1" max="9" data-t="khoan" value="${t.khoan ?? ''}" /></div>
        <div class="field"><label>Điểm</label><input class="input" data-t="diem" value="${escapeHtml((t.diem || []).join(', '))}" placeholder="vd: a" /></div>
        <div class="field"><label>Giá trị tài sản / thiệt hại</label><input class="input" data-f="soTien" value="${d.soTien != null ? fmtVnd(d.soTien) : ''}" placeholder="vd: 180.000.000 đồng" /></div>
      </div>
      ${crime ? `<p class="hint">Điều ${crime.dieu}: ${escapeHtml(crime.ten)}</p>` : t.dieu ? `<p class="hint">Phần mềm chưa có dữ liệu Điều ${escapeHtml(t.dieu)}.</p>` : ''}
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
      return `<li class="${y.ok ? 'ok' : 'no'}">${icon(y.ok ? 'check' : 'x', 'ic-sm')}<span>${escapeHtml(y.label)}${q ? `<blockquote class="ct-fact" data-no-law-link>“${escapeHtml(q)}”</blockquote>` : ''}</span></li>`;
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
      <div class="inline"><button class="btn" type="button" data-don-preview>${icon('eye', 'ic-sm')}Xem trước phiếu xem xét đơn</button><button class="btn btn-primary" type="button" data-don-export>${icon('download', 'ic-sm')}Xuất Word</button><button class="btn btn-sm" type="button" data-ct-ai="don" ${aiBusy ? 'disabled' : ''}>${icon('sparkles', 'ic-sm')}${aiBusy ? 'AI đang xem xét…' : 'AI xem xét đơn (chỉ dựa trên tài liệu)'}</button></div>
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
    out.innerHTML = tab === 'phan-tich' ? analysisHtml() : tab === 'kiem-tra' ? checkHtml() : reviewHtml();
  }, 120);

  /* ----- Gắn sự kiện ----- */
  function bind() {
    $('[data-ct-name]', root).addEventListener('input', (e) => {
      rec.ten = e.target.value;
      save();
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
          addSource(f.name, await readAll([f], '', say));
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
      save();
      drawDons();
      update();
    });
    $('[data-don-list]', root).addEventListener('click', (e) => {
      const del = e.target.closest('[data-don-del]');
      const pick = e.target.closest('[data-don-pick]');
      if (del) {
        rec.dons = rec.dons.filter((x) => x.id !== del.dataset.donDel);
        if (donSel === del.dataset.donDel) donSel = rec.dons[rec.dons.length - 1]?.id || null;
        save();
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
      const v = parseVerdict(rec.sources.map((s) => s.text).join('\n'));
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
      if (e.target.matches('[data-t="dieu"]')) drawDefs();
    });
    defs.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-def-del]');
      if (!b) return;
      rec.defendants.splice(+b.closest('[data-def]').dataset.def, 1);
      save();
      drawDefs();
      update();
    });
    $$('[data-ban]', root).forEach((inp) =>
      inp.addEventListener('input', () => {
        rec.banAn = { ...(rec.banAn || {}), [inp.dataset.ban]: inp.value.trim() };
        save();
      }),
    );
    $$('[data-ct-tab]', root).forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.ctTab;
        update();
      }),
    );
    const out = $('[data-ct-out]', root);
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
    if (don) {
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
  loadBook().then((b) => {
    book = b;
    if (!root.isConnected) return;
    $('[data-ct-book]', root).hidden = !!b;
    drawDefs();
    update();
  });
  return () => aiBusy?.abort();
}

