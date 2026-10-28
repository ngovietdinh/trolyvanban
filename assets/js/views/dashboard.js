// Tổng quan kiểu "kính" (học theo dashboard Scada5): thanh chào + ô hỏi trợ lý, khung kính chứa lưới thẻ số liệu thật
// của tài khoản (sổ vụ án / hồ sơ vụ án / văn bản), bảng việc sắp tới, danh sách gần đây, dock chuyển nhanh. Nội dung
// theo cơ quan đang chọn (Tòa án, Cảnh sát điều tra) hoặc chỉ văn bản khi không có phân hệ tố tụng. Không bịa số:
// mọi con số đọc từ dữ liệu trên máy; thiếu thì ghi "—" hoặc câu hướng dẫn.
import { icon, escapeHtml } from '../ui.js';
import { docsRepo, usage } from '../lib/store.js';
import { getDocType } from '../lib/doc-types.js';
import { relativeTime } from '../lib/vn-date.js';
import { deleteWithUndo, repoOps } from '../lib/undo-delete.js';
import { courtRepo, casesRepo, recordsRepo, plansRepo } from '../legal/repo.js';
import { agencyInfo } from '../lib/agency.js';
import { findCrime } from '../legal/engine.js';
import { upcoming } from '../legal/court-deadlines.js';
import { fmtDate } from '../legal/court-penalty.js';
import { courtRules } from './toa-an-case.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

/** Dòng tài liệu dùng chung với màn hình Tài liệu của tôi. */
export function docRow(d) {
  const type = getDocType(d.typeId);
  return `<li class="doc-item">
    <span class="doc-icon" aria-hidden="true">${escapeHtml(type?.abbr || 'CV')}</span>
    <div class="doc-meta">
      <a href="#compose/doc/${d.id}">${escapeHtml(d.title)}</a>
      <small>${escapeHtml(type?.name || 'Văn bản')} · ${relativeTime(d.updatedAt)}</small>
    </div>
    <button class="btn btn-ghost btn-sm btn-icon" type="button" data-del-doc="${d.id}" aria-label="Xóa “${escapeHtml(d.title)}”" title="Xóa">${icon('trash', 'ic-sm')}</button>
  </li>`;
}

const THU = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const todayLong = (d = new Date()) => `${THU[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const conHan = (n) => (n < 0 ? `quá ${-n} ngày` : n === 0 ? 'hôm nay' : `${n} ngày`);
const monthKey = (t) => {
  const d = t instanceof Date ? t : new Date(t);
  return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${d.getMonth()}`;
};
const THIS = monthKey(new Date());
const LAST = monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
/** Sáu tháng gần nhất: [{ key, label }]. */
const months6 = () => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { key: monthKey(d), label: `T${d.getMonth() + 1}` };
  });
};

/** Chip ▲▼ so với tháng trước; không có tháng trước thì chỉ ghi chú (không bịa phần trăm). */
function delta(cur, prev, note, { bad = false } = {}) {
  if (!prev && !cur) return `<span class="gx-note">${escapeHtml(note)}</span>`;
  if (!prev) return `<span class="gx-note">${cur} ${escapeHtml(note)}</span>`;
  const diff = cur - prev;
  if (!diff) return `<span class="gx-delta-row"><span class="gx-pill">bằng tháng trước</span></span>`;
  const good = bad ? diff < 0 : diff > 0;
  return `<span class="gx-delta-row"><span class="gx-delta ${good ? 'gx-delta--good' : 'gx-delta--bad'}">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}</span><span class="gx-note">so với tháng trước</span></span>`;
}
const count = (v, unit = '') => `<span data-count="${v}">${v}</span>${unit ? `<small>${escapeHtml(unit)}</small>` : ''}`;
const card = (i, cls, inner) => `<section class="gc ${cls}" style="--d:${i}">${inner}</section>`;
const head = (title, sub = '', right = '') => `<header class="gc__head"><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${right}</header>`;
const bubble = (ic, tone = '') => `<span class="gx-bubble ${tone ? `gx-bubble--${tone}` : ''}">${icon(ic)}</span>`;

/** Biểu đồ cột chồng 6 tháng: series [{ cls:'a'|'b', label, by: {key: n} }]. */
function bars(series, i = 0) {
  const ms = months6();
  const max = Math.max(1, ...ms.map((m) => series.reduce((s, x) => s + (x.by[m.key] || 0), 0)));
  const legend = series.map((s) => `<span><i class="gx-key gx-key--${s.cls === 'a' ? 'dark' : 'hatch'}"></i> ${escapeHtml(s.label)}</span>`).join('');
  const cols = ms
    .map((m) => {
      const total = series.reduce((s, x) => s + (x.by[m.key] || 0), 0);
      const segs = series
        .slice()
        .reverse()
        .map((s) => {
          const v = s.by[m.key] || 0;
          return v ? `<i class="${s.cls}" style="height:${Math.max(4, Math.round((v / max) * 104))}px;--d:${i}" title="${escapeHtml(s.label)}: ${v}"></i>` : '';
        })
        .join('');
      return `<div class="gx-bar"><span class="st">${segs || '<i class="a" style="height:2px;opacity:.25"></i>'}</span><span>${total ? `<b>${total}</b> ` : ''}${m.label}</span></div>`;
    })
    .join('');
  return `<div class="gx-inner gx-inner--chart"><div class="gx-inner__head"><b>Theo tháng</b><span class="gx-legend">${legend}</span></div><div class="gx-bars">${cols}</div></div>`;
}

const byMonth = (items, pick) => {
  const out = {};
  for (const it of items) {
    const k = monthKey(pick(it));
    if (k) out[k] = (out[k] || 0) + 1;
  }
  return out;
};

/* ---------------- Nội dung theo cơ quan ---------------- */
function courtBlocks(docs) {
  const list = courtRepo.list();
  const todo = upcoming(list, { rules: courtRules() }).filter((x) => x.trangThai !== 'moc');
  const over = todo.filter((x) => x.trangThai === 'qua-han').length;
  const soon = todo.filter((x) => x.trangThai === 'sap').length;
  const week = todo.filter((x) => x.con >= 0 && x.con <= 7).length;
  const st = list.filter((c) => c.cap !== 'phuc-tham').length;
  const dons = list.reduce((s, c) => s + (c.dons || []).length, 0);
  const thuLy = byMonth(list, (c) => c.thuLy?.ngay || c.createdAt);
  const near = todo.filter((x) => x.con <= 14).slice(0, 6);
  const docsM = docs.filter((d) => monthKey(d.updatedAt) === THIS).length;
  const docsL = docs.filter((d) => monthKey(d.updatedAt) === LAST).length;
  const giam = list.reduce((s, c) => s + (c.defendants || []).filter((d) => /giam/i.test(d.nganChan?.loai || '')).length, 0);
  return {
    bell: over,
    bellHref: '#toa-an',
    plus: ['#toa-an', 'Thụ lý vụ án'],
    main: card(
      0,
      'gx-s4',
      `${head('Vụ án đang giải quyết', 'Sổ vụ án sơ thẩm và phúc thẩm', `<span class="gx-pill">${escapeHtml(agencyInfo()?.ngan || 'Tòa án')}</span>`)}
       <div class="gx-big">${count(list.length, 'vụ án')}</div>
       ${delta(thuLy[THIS] || 0, thuLy[LAST] || 0, 'thụ lý tháng này')}
       <div class="gx-actions"><a class="gx-btn gx-btn--dark" href="#toa-an">Mở sổ vụ án</a><a class="gx-btn" href="#toa-an/kho-ban-an">Kho bản án</a></div>
       <div class="gx-inner"><div class="gx-inner__head"><b>Thời hạn</b><span>| ${todo.length} mốc đang chạy</span></div>
         <div class="gx-tiles">
           <a class="gx-tile" href="#toa-an"><span class="gx-tile__h">Quá hạn</span><b>${over}</b><span class="gx-tile__s">${over ? 'cần xử lý ngay' : 'không có'}</span>${over ? '<span class="gx-tile__ok gx-tile__ok--bad">Xử lý ngay</span>' : '<span class="gx-tile__ok">Đúng hạn</span>'}</a>
           <a class="gx-tile" href="#toa-an"><span class="gx-tile__h">Hết hạn trong 7 ngày</span><b>${week}</b><span class="gx-tile__s">${soon ? `${soon} sắp đến hạn` : 'chưa có'}</span></a>
           <a class="gx-tile" href="#toa-an"><span class="gx-tile__h">Sơ thẩm / phúc thẩm</span><b>${st}<small> / ${list.length - st}</small></b><span class="gx-tile__s">${giam ? `${giam} bị cáo tạm giam` : 'đang theo dõi'}</span></a>
         </div></div>`,
    ),
    quad: [
      card(2, 'gc--emerald', `${head('Văn bản đã soạn tháng này', '', bubble('file', 'dark'))}<div class="gx-mid">${count(docsM, 'văn bản')}</div>${delta(docsM, docsL, 'văn bản tháng này')}`),
      card(3, '', `${head('Đơn đã nhận', '', bubble('mail', dons ? 'amber' : ''))}<div class="gx-mid">${count(dons, 'đơn')}</div><span class="gx-note">${dons ? 'kháng cáo, khiếu nại trong các vụ án' : 'chưa có đơn nào được nạp'}</span>`),
      card(4, '', `${head('Kho bản án, án lệ', '', bubble('book'))}<div class="gx-mid" data-kho-count>—</div><span class="gx-note" data-kho-note>đang đếm…</span>`),
      card(5, '', `${head('Mẫu Word của đơn vị', '', bubble('clipboard'))}<div class="gx-mid" data-tpl-count>—</div><span class="gx-note" data-tpl-note>đang đếm…</span>`),
    ],
    chart: card(6, 'gx-s4', `${head('Thụ lý 6 tháng', 'Số vụ theo tháng thụ lý')}${bars([{ cls: 'a', label: 'Sơ thẩm', by: byMonth(list.filter((c) => c.cap !== 'phuc-tham'), (c) => c.thuLy?.ngay || c.createdAt) }, { cls: 'b', label: 'Phúc thẩm', by: byMonth(list.filter((c) => c.cap === 'phuc-tham'), (c) => c.thuLy?.ngay || c.createdAt) }], 6)}`),
    table: card(
      7,
      'gx-s8 dash-court',
      `${head('Thời hạn 14 ngày tới', 'Tính theo Bộ luật Tố tụng hình sự, từ ngày thụ lý', `<a class="gx-btn gx-btn--sm" href="#toa-an">Sổ vụ án</a>`)}
       ${
         !list.length
           ? `<div class="gx-empty"><span>Sổ vụ án đang trống. Thụ lý vụ án sơ thẩm (từ cáo trạng) hoặc phúc thẩm (có kháng cáo, kháng nghị) để theo dõi thời hạn.</span><a class="gx-btn gx-btn--sm gx-btn--dark" href="#toa-an">${icon('plus', 'ic-sm')}Thụ lý vụ án</a></div>`
           : near.length
             ? `<table class="gx-table"><thead><tr><th>Hạn</th><th>Việc</th><th>Vụ án</th><th>Tiến độ</th><th class="gx-num">Còn</th></tr></thead><tbody>${near
                 .map((it, k) => {
                   const tone = it.trangThai === 'qua-han' ? 'red' : it.trangThai === 'sap' ? 'amber' : 'green';
                   const pct = it.con < 0 ? 100 : Math.max(8, Math.round(100 - (it.con / 14) * 100));
                   return `<tr style="--d:${k}"><td><span class="gx-dot gx-dot--${tone}"><i></i>${fmtDate(it.han).slice(0, 5)}</span></td><td>${escapeHtml(it.ten)}</td><td><a href="#toa-an/${it.rec.id}/vu-an">${escapeHtml(it.rec.thuLy?.so || it.rec.ten || 'Hồ sơ')}</a> <span class="gx-muted">${escapeHtml((it.rec.defendants || []).map((d) => d.hoTen).filter(Boolean).join(', '))}</span></td><td><span class="gx-prog ${tone === 'red' ? 'gx-prog--orange' : ''}"><i style="width:${pct}%;--d:${k}"></i></span></td><td class="gx-num ${tone === 'red' ? 'gx-red' : ''}">${conHan(it.con)}</td></tr>`;
                 })
                 .join('')}</tbody></table>`
             : '<div class="gx-empty">Không có thời hạn nào trong 14 ngày tới. Nhập ngày thụ lý trong hồ sơ để theo dõi.</div>'
       }`,
    ),
    async: async (root) => {
      const [ba, tplMap] = await Promise.all([import('../legal/court-ba-db.js').then((m) => m.courtBaDb.list()).catch(() => []), import('../legal/court-tpl-db.js').then((m) => m.courtTplDb.list()).catch(() => ({}))]);
      const tpl = Object.keys(tplMap || {});
      if (!root.isConnected) return;
      const al = ba.filter((x) => x.loai === 'an-le').length;
      const k = root.querySelector('[data-kho-count]');
      if (k) k.innerHTML = count(ba.length, 'văn bản');
      const kn = root.querySelector('[data-kho-note]');
      if (kn) kn.textContent = ba.length ? `${ba.length - al} bản án, ${al} án lệ` : 'nạp bản án đã xét xử để tìm bản án tương tự';
      const t = root.querySelector('[data-tpl-count]');
      if (t) t.innerHTML = count(tpl.length, 'mẫu');
      const tn = root.querySelector('[data-tpl-note]');
      if (tn) tn.textContent = tpl.length ? 'thay cho mẫu soạn sẵn' : 'đang dùng 25 mẫu soạn sẵn';
      root.querySelectorAll('[data-kho-count] [data-count], [data-tpl-count] [data-count]').forEach(countUp);
    },
  };
}

function policeBlocks(docs) {
  const cases = casesRepo.list();
  const recs = recordsRepo.list();
  const plans = plansRepo.list();
  const persons = cases.reduce((s, c) => s + (c.persons || []).length, 0);
  const cm = byMonth(cases, (c) => c.createdAt || c.updatedAt);
  const rm = byMonth(recs, (r) => r.ngay || r.createdAt || r.updatedAt);
  const docsM = docs.filter((d) => monthKey(d.updatedAt) === THIS).length;
  const docsL = docs.filter((d) => monthKey(d.updatedAt) === LAST).length;
  const recent = cases
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 6);
  return {
    bell: 0,
    bellHref: '#cases',
    plus: ['#cases', 'Tạo hồ sơ'],
    main: card(
      0,
      'gx-s4',
      `${head('Hồ sơ vụ án đang theo dõi', 'Vụ việc, người tham gia, biên bản, kế hoạch hỏi', `<span class="gx-pill">${escapeHtml(agencyInfo()?.ngan || 'Điều tra')}</span>`)}
       <div class="gx-big">${count(cases.length, 'hồ sơ')}</div>
       ${delta(cm[THIS] || 0, cm[LAST] || 0, 'hồ sơ mới tháng này')}
       <div class="gx-actions"><a class="gx-btn gx-btn--dark" href="#cases">Hồ sơ vụ án</a><a class="gx-btn" href="#interview">Ghi lời khai</a></div>
       <div class="gx-inner"><div class="gx-inner__head"><b>Trong hồ sơ</b><span>| ${persons} người tham gia</span></div>
         <div class="gx-tiles">
           <a class="gx-tile" href="#interview"><span class="gx-tile__h">Biên bản tháng này</span><b>${rm[THIS] || 0}</b><span class="gx-tile__s">${recs.length} biên bản tất cả</span></a>
           <a class="gx-tile" href="#legal"><span class="gx-tile__h">Kế hoạch hỏi</span><b>${plans.length}</b><span class="gx-tile__s">${plans.length ? 'từ cây hỏi đáp' : 'chưa lập'}</span></a>
           <a class="gx-tile" href="#loi-khai"><span class="gx-tile__h">Người tham gia</span><b>${persons}</b><span class="gx-tile__s">${cases.length ? 'trong các hồ sơ' : 'chưa có hồ sơ'}</span></a>
         </div></div>`,
    ),
    quad: [
      card(2, 'gc--emerald', `${head('Biên bản lời khai', '', bubble('message', 'dark'))}<div class="gx-mid">${count(recs.length, 'biên bản')}</div>${delta(rm[THIS] || 0, rm[LAST] || 0, 'biên bản tháng này')}`),
      card(3, '', `${head('Văn bản đã soạn tháng này', '', bubble('file'))}<div class="gx-mid">${count(docsM, 'văn bản')}</div>${delta(docsM, docsL, 'văn bản tháng này')}`),
      card(4, '', `${head('Kho hồ sơ', '', bubble('sparkles'))}<div class="gx-mid" data-kho-count>—</div><span class="gx-note" data-kho-note>đang đếm…</span>`),
      card(5, '', `${head('Kế hoạch hỏi', '', bubble('layers'))}<div class="gx-mid">${count(plans.length, 'kế hoạch')}</div><span class="gx-note">${plans.length ? 'gắn với hồ sơ, biên bản' : 'lập từ Cây hỏi đáp pháp luật'}</span>`),
    ],
    chart: card(6, 'gx-s4', `${head('Hồ sơ và biên bản 6 tháng', 'Theo tháng tạo')}${bars([{ cls: 'a', label: 'Hồ sơ', by: cm }, { cls: 'b', label: 'Biên bản', by: rm }], 6)}`),
    table: card(
      7,
      'gx-s8 dash-cases',
      `${head('Hồ sơ vụ án gần đây', 'Vụ việc, tội danh, người tham gia', `<a class="gx-btn gx-btn--sm" href="#cases">Tất cả hồ sơ</a>`)}
       ${
         recent.length
           ? `<table class="gx-table"><thead><tr><th>Hồ sơ</th><th>Tội danh</th><th class="gx-num">Người</th><th class="gx-num">Cập nhật</th></tr></thead><tbody>${recent
               .map((c, k) => `<tr style="--d:${k}"><td><a href="#cases/${c.id}">${escapeHtml(c.ten || 'Hồ sơ vụ án')}</a>${c.soHoSo ? `<div class="gx-muted">${escapeHtml(c.soHoSo)}</div>` : ''}</td><td>${(c.toiDanh || []).map((d) => `Điều ${escapeHtml(d)}${findCrime(d) ? ` ${escapeHtml(findCrime(d).ten.replace(/^Tội /, ''))}` : ''}`).join('; ') || '<span class="gx-muted">chưa xác định</span>'}</td><td class="gx-num">${(c.persons || []).length}</td><td class="gx-num gx-muted">${escapeHtml(relativeTime(c.updatedAt || Date.now()))}</td></tr>`)
               .join('')}</tbody></table>`
           : `<div class="gx-empty"><span>Chưa có hồ sơ vụ án. Tạo hồ sơ để gắn kế hoạch hỏi, lời khai, sơ đồ vụ việc.</span><a class="gx-btn gx-btn--sm gx-btn--dark" href="#cases">${icon('plus', 'ic-sm')}Tạo hồ sơ</a></div>`
       }`,
    ),
    async: async (root) => {
      const kho = await import('../lib/kho-db.js').then((m) => m.khoDb.list()).catch(() => []);
      if (!root.isConnected) return;
      const k = root.querySelector('[data-kho-count]');
      if (k) k.innerHTML = count(kho.length, 'tài liệu');
      const kn = root.querySelector('[data-kho-note]');
      if (kn) kn.textContent = kho.length ? 'đã nạp để tra cứu, hỏi trợ lý' : 'nạp tài liệu vụ án để hỏi trợ lý';
      root.querySelectorAll('[data-kho-count] [data-count]').forEach(countUp);
    },
  };
}

function docsBlocks(docs, u, ctx) {
  const dm = byMonth(docs, (d) => d.updatedAt);
  const recent = docs.slice(0, 6);
  return {
    bell: 0,
    bellHref: '#docs',
    plus: ['#compose', 'Văn bản mới'],
    main: card(
      0,
      'gx-s4',
      `${head('Văn bản đã soạn', 'Lưu trên máy, riêng tài khoản của bạn')}
       <div class="gx-big">${count(docs.length, 'văn bản')}</div>
       ${delta(dm[THIS] || 0, dm[LAST] || 0, 'văn bản tháng này')}
       <div class="gx-actions"><a class="gx-btn gx-btn--dark" href="#compose">Soạn văn bản</a><a class="gx-btn" href="#templates">Thư viện mẫu</a></div>
       <div class="gx-inner"><div class="gx-inner__head"><b>Hoạt động</b><span>| từ khi tạo tài khoản</span></div>
         <div class="gx-tiles">
           <a class="gx-tile" href="#docs"><span class="gx-tile__h">Lượt xuất Word</span><b>${u.export || 0}</b><span class="gx-tile__s">tệp .docx</span></a>
           <a class="gx-tile" href="#spell"><span class="gx-tile__h">Kiểm tra chính tả</span><b>${u.spell || 0}</b><span class="gx-tile__s">lượt soát lỗi</span></a>
           <a class="gx-tile" href="#chat"><span class="gx-tile__h">Trợ lý AI</span><b>${(u.ai || 0) + (u.chat || 0)}</b><span class="gx-tile__s">lượt hỏi, soạn</span></a>
         </div></div>`,
    ),
    quad: [
      card(2, 'gc--emerald', `${head('Tháng này', '', bubble('file', 'dark'))}<div class="gx-mid">${count(dm[THIS] || 0, 'văn bản')}</div>${delta(dm[THIS] || 0, dm[LAST] || 0, 'văn bản tháng này')}`),
      card(3, '', `${head('Công văn', '', bubble('mail'))}<div class="gx-mid">${count(docs.filter((d) => d.typeId === 'cong-van').length)}</div><a class="gx-note" href="#compose/cong-van">Soạn công văn mới</a>`),
      card(4, '', `${head('Quyết định', '', bubble('gavel'))}<div class="gx-mid">${count(docs.filter((d) => d.typeId === 'quyet-dinh').length)}</div><a class="gx-note" href="#compose/quyet-dinh">Soạn quyết định mới</a>`),
      card(5, '', `${head('Mẫu riêng từ Word', '', bubble('upload'))}<div class="gx-mid" data-tpl-count>—</div><span class="gx-note" data-tpl-note>đang đếm…</span>`),
    ],
    chart: card(6, 'gx-s4', `${head('Văn bản 6 tháng', 'Theo tháng cập nhật')}${bars([{ cls: 'a', label: 'Văn bản', by: dm }], 6)}`),
    table: card(
      7,
      'gx-s8',
      `${head('Tài liệu gần đây', 'Mở lại để sửa, xuất Word', `<a class="gx-btn gx-btn--sm" href="#docs">Tất cả tài liệu</a>`)}
       ${
         recent.length
           ? `<table class="gx-table"><thead><tr><th>Tiêu đề</th><th>Loại</th><th class="gx-num">Cập nhật</th></tr></thead><tbody>${recent
               .map((d, k) => `<tr style="--d:${k}"><td><a href="#compose/doc/${d.id}">${escapeHtml(d.title)}</a></td><td>${escapeHtml(getDocType(d.typeId)?.name || 'Văn bản')}</td><td class="gx-num gx-muted">${escapeHtml(relativeTime(d.updatedAt))}</td></tr>`)
               .join('')}</tbody></table>`
           : `<div class="gx-empty"><span>Chưa có tài liệu. Văn bản bạn lưu sẽ xuất hiện tại đây.</span>${ctx.can('docs') ? `<a class="gx-btn gx-btn--sm gx-btn--dark" href="#compose">${icon('plus', 'ic-sm')}Soạn văn bản đầu tiên</a>` : ''}</div>`
       }`,
    ),
    async: async (root) => {
      const n = (await import('../lib/store.js').then((m) => m.store.get('tpl-custom', [])).catch(() => [])).length;
      if (!root.isConnected) return;
      const t = root.querySelector('[data-tpl-count]');
      if (t) t.innerHTML = count(n, 'mẫu');
      const tn = root.querySelector('[data-tpl-note]');
      if (tn) tn.textContent = n ? 'tạo từ tệp Word của bạn' : 'tải tệp Word lên để tạo mẫu riêng';
    },
  };
}

/** Danh sách "gần đây" bên phải: văn bản của tài khoản. */
function recentList(docs, ctx) {
  const rows = docs.slice(0, 5);
  return card(
    8,
    'gx-s4',
    `${head('Tài liệu gần đây', 'Văn bản bạn vừa soạn, sửa', ctx.can('docs') ? `<a class="gx-btn gx-btn--sm" href="#docs">Xem tất cả</a>` : '')}
     ${
       rows.length
         ? `<div class="gx-list">${rows.map((d) => `<a class="gx-list__row" href="#compose/doc/${d.id}"><span class="gx-bubble">${escapeHtml(getDocType(d.typeId)?.abbr || 'VB')}</span><span><b>${escapeHtml(d.title)}</b><small>${escapeHtml(getDocType(d.typeId)?.name || 'Văn bản')} · ${escapeHtml(relativeTime(d.updatedAt))}</small></span><span class="gx-pill">Word</span></a>`).join('')}</div>`
         : `<div class="gx-empty"><span>Chưa có văn bản nào.</span>${ctx.can('docs') ? `<a class="gx-btn gx-btn--sm" href="#compose">Soạn văn bản</a>` : ''}</div>`
     }`,
  );
}

/** Số chạy từ 0 tới giá trị (bỏ qua khi người dùng tắt chuyển động). */
function countUp(el) {
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target) || target === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const start = performance.now();
  const dur = 900;
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function render(ctx) {
  const user = ctx.user();
  const docs = docsRepo.list();
  const u = usage.get();
  const name = user ? user.name.split(/\s+/).pop() : '';
  const initials = user
    ? user.name
        .split(/\s+/)
        .slice(-2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : '';
  const ag = ctx.can('legal') ? agencyInfo() : null;
  const b = ag?.id === 'toa-an' ? courtBlocks(docs) : ag?.id === 'cqdt' ? policeBlocks(docs) : docsBlocks(docs, u, ctx);
  const dockItems = ag
    ? ag.shortcuts.map(([h, , t]) => [h, t])
    : [
        ['compose', 'Soạn văn bản'],
        ['templates', 'Thư viện mẫu'],
        ['docs', 'Tài liệu'],
        ['chat', 'Trợ lý AI'],
      ];

  ctx.view.innerHTML = `
  <div class="gx" data-dash>
    <div class="gx-bg" aria-hidden="true"></div>
    <header class="gx-top hello">
      <div class="gx-me"><span class="gx-avatar">${escapeHtml(initials)}</span><span><h1>${greeting()}${name ? `, ${escapeHtml(name)}` : ''}</h1><small>${todayLong()}${ag ? ` · ${escapeHtml(ag.ten)}` : ''}</small></span></div>
      ${ctx.can('docs') ? `<form class="gx-ask hello-prompt" data-hello><span class="gx-orb" aria-hidden="true"></span><input name="q" placeholder="Hỏi trợ lý: soạn giấy mời họp, quyết định, tính thời hạn…" aria-label="Hỏi trợ lý" autocomplete="off" /><button type="submit" aria-label="Gửi cho trợ lý">${icon('arrow-right', 'ic-sm')}</button></form>` : '<span></span>'}
      <div class="gx-top__r">
        <a class="gx-round" href="${b.bellHref}" title="${b.bell ? `${b.bell} việc quá hạn` : 'Không có việc quá hạn'}" aria-label="Việc quá hạn">${icon('clock')}${b.bell ? `<em>${b.bell}</em>` : ''}</a>
        ${ag ? `<a class="gx-round gx-round--white" href="#co-quan" title="${escapeHtml(ag.ten)} — đổi cơ quan" aria-label="Đổi cơ quan">${icon(ag.mark)}</a>` : ''}
      </div>
    </header>
    <section class="gx-panel"><div class="gx-page">
      <div class="gx-head">
        <div><h1>Tổng quan</h1><p>${ag ? escapeHtml(ag.nhom) : 'Văn bản hành chính'} · số liệu trên máy của bạn, cập nhật ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p></div>
        <div class="gx-head__r"><a class="gx-btn gx-btn--dark" href="${b.plus[0]}">${icon('plus', 'ic-sm')}${escapeHtml(b.plus[1])}</a></div>
      </div>
      <div class="gx-grid">
        ${b.main}
        <section class="gc gc--frame gx-s4" style="--d:1"><div class="gx-quad">${b.quad.join('')}</div></section>
        ${b.chart}
        ${b.table}
        ${recentList(docs, ctx)}
      </div>
    </div></section>
    <nav class="gx-dock ${ag ? 'legal-promo' : ''}" aria-label="Chuyển nhanh">
      <a class="is-on" href="#dashboard">Tổng quan</a>
      ${dockItems.map(([h, t]) => `<a href="#${h}">${escapeHtml(t)}</a>`).join('')}
      <a class="gx-dock__plus" href="${b.plus[0]}" title="${escapeHtml(b.plus[1])}" aria-label="${escapeHtml(b.plus[1])}">${icon('plus', 'ic-sm')}</a>
    </nav>
  </div>`;

  ctx.view.querySelectorAll('[data-count]').forEach(countUp);
  b.async?.(ctx.view);

  ctx.view.querySelector('[data-hello]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    if (!q) return e.target.q.focus();
    ctx.handoff = { chatPrompt: q };
    ctx.navigate('#chat');
  });
  ctx.view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-del-doc]');
    if (!b) return;
    const d = docsRepo.get(b.dataset.delDoc);
    deleteWithUndo(ctx, {
      title: 'Xóa văn bản',
      message: `Xóa “${d?.title}” khỏi Tài liệu của tôi? Có thể hoàn tác ngay sau khi xóa.`,
      items: [{ item: d, ...repoOps(docsRepo) }],
      after: () => {
        document.dispatchEvent(new CustomEvent('docs-changed'));
        render(ctx);
      },
    });
  });
}
