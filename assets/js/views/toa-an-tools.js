// Tab "Tính hình phạt" của hồ sơ xét xử: khoảng hình phạt hợp pháp (khung, Điều 54, 57, 101), tổng hợp hình phạt
// (Điều 55, 56), trừ tạm giữ / tạm giam và ngày chấp hành xong (Điều 36, 38). Trạng thái lưu trong hồ sơ (rec.tools).
import { $, icon, escapeHtml, debounce } from '../ui.js';
import { legalRange, tongHop, chapHanh, fmtDur, penaltyRules } from '../legal/court-penalty.js';
import { findCrime } from '../legal/engine.js';
import { fmtMonths } from '../legal/court.js';

const LOAI = [
  ['tu', 'Tù có thời hạn'],
  ['cai-tao', 'Cải tạo không giam giữ'],
  ['chung-than', 'Tù chung thân'],
  ['tu-hinh', 'Tử hình'],
  ['phat-tien', 'Phạt tiền (hình phạt chính)'],
];
const lawHtml = (law) => (law || []).filter((l) => l.quote).map((l) => `<blockquote class="ct-law"><b>${escapeHtml(l.ref)}</b>: “${escapeHtml(l.quote)}”</blockquote>`).join('');
const num = (v) => (v === '' || v == null ? 0 : +v || 0);
const durOf = (x) => ({ thang: num(x.nam) * 12 + num(x.thang), ngay: num(x.ngay) });
const durInputs = (x, attr) => `<input class="input input-sm" type="number" min="0" max="30" ${attr}="nam" value="${x.nam ?? ''}" aria-label="Năm" placeholder="năm" /><input class="input input-sm" type="number" min="0" max="11" ${attr}="thang" value="${x.thang ?? ''}" aria-label="Tháng" placeholder="tháng" /><input class="input input-sm" type="number" min="0" max="29" ${attr}="ngay" value="${x.ngay ?? ''}" aria-label="Ngày" placeholder="ngày" />`;

/** Gắn tab "Tính hình phạt" vào host. getBook(): sách Bình luận đã nạp (có thể null). */
export function mountPenaltyPane(host, { rec, save, getBook }) {
  const T = (rec.tools ||= {});
  T.range ||= { def: 0 };
  T.th ||= { items: [{ loai: 'tu' }, { loai: 'tu' }], da: {} };
  T.ch ||= { loai: 'tu', dur: {}, batDau: '', giam: [{ tu: '', den: '' }] };

  // Lấy sẵn từ bị cáo đã chọn: điều, khoản, tuổi, số tình tiết giảm nhẹ, vai trò; mức án và tạm giam cho phần chấp hành.
  function fromDefendant(i) {
    const d = rec.defendants[i];
    if (!d) return;
    const t = d.toiDanh?.[0] || {};
    Object.assign(T.range, { def: i, dieu: t.dieu || '', khoan: t.khoan ?? '', tuoi: d.tuoi ?? '', giamNhe: (d.giamNhe || []).length, vaiTro: d.vaiTro || '' });
    const hp = d.hinhPhat || {};
    if (hp.thang != null && (hp.loai === 'tu' || hp.loai === 'cai-tao')) T.ch = { ...T.ch, loai: hp.loai, dur: { nam: Math.floor(hp.thang / 12) || '', thang: hp.thang % 12 || '', ngay: '' } };
    if (d.nganChan?.loai === 'tam-giam' && d.nganChan.tu) T.ch = { ...T.ch, batDau: d.nganChan.tu };
  }
  if (T.range.dieu == null && rec.defendants.length) fromDefendant(0);

  function results() {
    const book = getBook();
    const R = T.range;
    const r = legalRange({ book, dieu: String(R.dieu || '').trim(), khoan: R.khoan, tuoi: R.tuoi === '' || R.tuoi == null ? null : +R.tuoi, chuaDat: !!R.chuaDat, giamNheK1: num(R.giamNhe), vaiTro: R.vaiTro || '' });
    const crime = findCrime(String(R.dieu || '').trim());
    const rangeHtml = `${crime ? `<p class="hint">Điều ${crime.dieu}. ${escapeHtml(crime.ten)}</p>` : ''}${r.frame ? `<p class="ct-range"><b>Khoảng tù hợp pháp:</b> ${r.min != null ? `từ ${fmtMonths(r.min)} ` : ''}${r.max != null ? `đến ${fmtMonths(r.max)}` : ''}${r.chungThan ? ', tù chung thân' : ''}${r.tuHinh ? ', tử hình' : ''}</p>` : ''}<ul class="ct-els">${r.lines.map((l) => `<li class="ok">${icon('arrow-right', 'ic-sm')}<span>${escapeHtml(l.t)}${lawHtml(l.law)}</span></li>`).join('')}</ul>`;
    const th = tongHop(T.th.items.map((x) => ({ loai: x.loai, ...durOf(x), tien: num(String(x.tien || '').replace(/\D/g, '')) })).filter((x) => x.loai === 'chung-than' || x.loai === 'tu-hinh' || x.tien || x.thang || x.ngay), { book, daChapHanh: durOf(T.th.da || {}) });
    const thHtml = `<p class="ct-range"><b>Hình phạt chung:</b> ${th.loai === 'tu' ? `${fmtDur(th.dur)} tù` : th.loai === 'cai-tao' ? `${fmtDur(th.dur)} cải tạo không giam giữ` : th.loai === 'chung-than' ? 'tù chung thân' : th.loai === 'tu-hinh' ? 'tử hình' : '—'}${th.tien ? `; phạt tiền ${th.tien.toLocaleString('vi-VN')} đồng` : ''}</p><ul class="ct-els">${th.lines.map((l) => `<li class="ok">${icon('arrow-right', 'ic-sm')}<span>${escapeHtml(l)}</span></li>`).join('')}</ul>${lawHtml(th.law)}`;
    const ch = chapHanh({ loai: T.ch.loai, dur: durOf(T.ch.dur || {}), tamGiam: T.ch.giam || [], batDau: T.ch.batDau, book });
    const chHtml = `<ul class="ct-els">${ch.lines.map((l) => `<li class="ok">${icon('arrow-right', 'ic-sm')}<span>${escapeHtml(l)}</span></li>`).join('')}</ul>${ch.ketThuc ? `<p class="ct-range" data-ch-end><b>Chấp hành xong:</b> hết ngày ${String(ch.ketThuc.getDate()).padStart(2, '0')}/${String(ch.ketThuc.getMonth() + 1).padStart(2, '0')}/${ch.ketThuc.getFullYear()}</p>` : ''}${lawHtml(ch.law)}`;
    $('[data-out="range"]', host).innerHTML = rangeHtml;
    $('[data-out="th"]', host).innerHTML = thHtml;
    $('[data-out="ch"]', host).innerHTML = chHtml;
  }

  function draw() {
    const R = T.range;
    const book = getBook();
    host.innerHTML = `<div class="ct-tools">
      ${!book ? `<p class="note warn">${icon('book', 'ic-sm')}<span>Chưa nạp sách Bình luận BLHS — chưa có nguyên văn khung hình phạt; phần tổng hợp, trừ tạm giam dùng số liệu mặc định của BLHS. <a href="#binh-luan">Nạp sách</a></span></p>` : penaltyRules(book).hasBook ? '' : `<p class="note warn">${icon('book', 'ic-sm')}<span>Sách đã nạp không có Điều 55 — phần tổng hợp, trừ tạm giam dùng số liệu mặc định của BLHS.</span></p>`}
      <section class="panel ct-sec"><h2>${icon('gavel', 'ic-sm')}Khoảng hình phạt hợp pháp</h2>
        <div class="grid-4">
          <div class="field"><label>Lấy từ bị cáo</label><select class="select" data-r-def>${rec.defendants.map((d, i) => `<option value="${i}" ${i === R.def ? 'selected' : ''}>${escapeHtml(d.hoTen || `Bị cáo ${i + 1}`)}</option>`).join('')}</select></div>
          <div class="field"><label>Điều</label><input class="input" data-r="dieu" value="${escapeHtml(R.dieu ?? '')}" placeholder="vd: 174" /></div>
          <div class="field"><label>Khoản</label><input class="input" type="number" min="1" max="9" data-r="khoan" value="${R.khoan ?? ''}" /></div>
          <div class="field"><label>Tuổi khi phạm tội</label><input class="input" type="number" min="14" max="100" data-r="tuoi" value="${R.tuoi ?? ''}" /></div>
          <div class="field"><label>Số tình tiết giảm nhẹ khoản 1 Điều 51</label><input class="input" type="number" min="0" max="20" data-r="giamNhe" value="${R.giamNhe ?? 0}" /></div>
          <div class="field"><label>Vai trò</label><select class="select" data-r="vaiTro"><option value="">Thực hành / chủ mưu / đồng phạm</option><option value="giup-suc-khong-dang-ke" ${R.vaiTro === 'giup-suc-khong-dang-ke' ? 'selected' : ''}>Giúp sức, vai trò không đáng kể (lần đầu)</option></select></div>
          <div class="field"><label class="check"><input type="checkbox" data-r="chuaDat" ${R.chuaDat ? 'checked' : ''} />Phạm tội chưa đạt (Điều 57)</label></div>
        </div>
        <div data-out="range"></div>
      </section>
      <section class="panel ct-sec"><h2>${icon('layers', 'ic-sm')}Tổng hợp hình phạt (Điều 55, 56)</h2>
        <div class="ct-th-rows">${T.th.items
          .map((x, i) => `<div class="ct-th-row" data-th="${i}"><select class="select input-sm" data-thf="loai">${LOAI.map(([v, l]) => `<option value="${v}" ${v === x.loai ? 'selected' : ''}>${l}</option>`).join('')}</select>${x.loai === 'phat-tien' ? `<input class="input input-sm" data-thf="tien" value="${escapeHtml(x.tien || '')}" placeholder="số tiền (đồng)" />` : x.loai === 'tu' || x.loai === 'cai-tao' ? durInputs(x, 'data-thf') : '<span class="hint">—</span>'}<button class="btn btn-ghost btn-sm btn-icon" type="button" data-th-del="${i}" aria-label="Bỏ dòng">${icon('x', 'ic-sm')}</button></div>`)
          .join('')}</div>
        <div class="inline"><button class="btn btn-sm" type="button" data-th-add>${icon('plus', 'ic-sm')}Thêm hình phạt (tội / bản án)</button></div>
        <div class="field"><label>Thời gian đã chấp hành của bản án trước (khoản 1 Điều 56, nếu có)</label><div class="ct-dur">${durInputs(T.th.da || {}, 'data-thda')}</div></div>
        <div data-out="th"></div>
      </section>
      <section class="panel ct-sec"><h2>${icon('clock', 'ic-sm')}Trừ tạm giữ, tạm giam — ngày chấp hành xong</h2>
        <div class="grid-3">
          <div class="field"><label>Hình phạt</label><select class="select" data-ch="loai"><option value="tu" ${T.ch.loai === 'tu' ? 'selected' : ''}>Tù có thời hạn</option><option value="cai-tao" ${T.ch.loai === 'cai-tao' ? 'selected' : ''}>Cải tạo không giam giữ</option></select></div>
          <div class="field"><label>Thời hạn</label><div class="ct-dur">${durInputs(T.ch.dur || {}, 'data-chd')}</div></div>
          <div class="field"><label>Ngày bắt đầu chấp hành (thời hạn tính từ)</label><input class="input" type="date" data-ch="batDau" value="${escapeHtml(T.ch.batDau || '')}" /></div>
        </div>
        <p class="hint">Các khoảng tạm giữ, tạm giam TRƯỚC ngày bắt đầu chấp hành (đã được tại ngoại) được trừ vào thời hạn:</p>
        <div class="ct-th-rows">${(T.ch.giam || [])
          .map((g, i) => `<div class="ct-th-row" data-g="${i}"><span>Từ</span><input class="input input-sm" type="date" data-gf="tu" value="${escapeHtml(g.tu || '')}" aria-label="Tạm giam từ ngày" /><span>đến</span><input class="input input-sm" type="date" data-gf="den" value="${escapeHtml(g.den || '')}" aria-label="Tạm giam đến ngày" /><button class="btn btn-ghost btn-sm btn-icon" type="button" data-g-del="${i}" aria-label="Bỏ khoảng">${icon('x', 'ic-sm')}</button></div>`)
          .join('')}</div>
        <div class="inline"><button class="btn btn-sm" type="button" data-g-add>${icon('plus', 'ic-sm')}Thêm khoảng tạm giữ / tạm giam</button></div>
        <div data-out="ch"></div>
      </section>
      <p class="hint ct-disclaimer">${icon('info', 'ic-sm')}<span>Công cụ tính theo nguyên văn điều luật đã nạp — không phải mức án đề xuất; người có thẩm quyền quyết định hình phạt.</span></p>
    </div>`;
    results();
  }

  const commit = debounce(() => {
    save();
    results();
  }, 150);
  host.addEventListener('input', (e) => {
    const t = e.target;
    const val = t.type === 'checkbox' ? t.checked : t.value;
    if (t.dataset.r) T.range[t.dataset.r] = val;
    else if (t.dataset.thf) T.th.items[+t.closest('[data-th]').dataset.th][t.dataset.thf] = val;
    else if (t.dataset.thda) T.th.da = { ...(T.th.da || {}), [t.dataset.thda]: val };
    else if (t.dataset.ch) T.ch[t.dataset.ch] = val;
    else if (t.dataset.chd) T.ch.dur = { ...(T.ch.dur || {}), [t.dataset.chd]: val };
    else if (t.dataset.gf) T.ch.giam[+t.closest('[data-g]').dataset.g][t.dataset.gf] = val;
    else return;
    commit();
  });
  host.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-r-def]')) {
      fromDefendant(+t.value);
      save();
      draw();
    } else if (t.matches('[data-thf="loai"]')) {
      T.th.items[+t.closest('[data-th]').dataset.th] = { loai: t.value };
      save();
      draw();
    } else if (t.matches('[data-r="chuaDat"]')) {
      T.range.chuaDat = t.checked;
      commit();
    }
  });
  host.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-th-add]')) T.th.items.push({ loai: 'tu' });
    else if (b.dataset.thDel != null) T.th.items.splice(+b.dataset.thDel, 1);
    else if (b.matches('[data-g-add]')) T.ch.giam.push({ tu: '', den: '' });
    else if (b.dataset.gDel != null) T.ch.giam.splice(+b.dataset.gDel, 1);
    else return;
    save();
    draw();
  });
  draw();
  return { refresh: draw };
}
