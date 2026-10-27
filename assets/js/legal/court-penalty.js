// Công cụ tính hình phạt cho mục "Tòa án": khoảng hình phạt hợp pháp của một khung (Điều 54, 57, 101), tổng hợp hình phạt
// nhiều tội / nhiều bản án (Điều 55, 56), trừ thời gian tạm giữ, tạm giam (Điều 36, 38), ngày chấp hành xong.
//
// Số liệu đọc từ NGUYÊN VĂN các điều trong sách Bình luận BLHS đã nạp; chưa nạp sách thì dùng số của BLHS 2015 (sửa đổi
// 2017) và ghi rõ "chưa đối chiếu nguyên văn". Kết quả là công cụ tính, không phải mức án đề xuất.
import { findArticle } from './binh-luan.js';
import { parseArticle, articleFrames, fmtMonths } from './court.js';

const clean = (s) => String(s || '').normalize('NFC').replace(/\{\{fn:\d+\}\}/g, '').trim();
const WORD_FRAC = { 'ba phần tư': 3 / 4, 'một phần hai': 1 / 2, 'hai phần ba': 2 / 3, 'một phần ba': 1 / 3 };
const fracOf = (s) => {
  for (const [w, v] of Object.entries(WORD_FRAC)) if (s.includes(w)) return v;
  const m = /(\d)\/(\d)/.exec(s);
  return m ? +m[1] / +m[2] : null;
};

/** Quy định dùng để tính (nguyên văn khi có sách). */
export function penaltyRules(book) {
  const text = (so) => (findArticle(book, so)?.vb || []).map(clean);
  const quote = (so, re) => text(so).find((l) => re.test(l)) || '';
  const num = (s, re, d) => {
    const m = re.exec(s);
    return m ? +m[1] : d;
  };
  const q55a = quote('55', /cộng lại thành hình phạt chung; hình phạt chung không được vượt quá/u);
  const q55b = quote('55', /được chuyển đổi thành hình phạt tù theo tỷ lệ/u);
  const q36 = quote('36', /01 ngày tạm giữ, tạm giam bằng/u);
  const q38 = quote('38', /01 ngày tạm giữ, tạm giam bằng/u);
  const q57 = quote('57', /phạm tội chưa đạt, nếu/u);
  const k101 = parseArticle(findArticle(book, '101')?.vb || []);
  const r101 = (k, dNam, dFrac) => {
    const t = clean(k101.find((x) => x.k === k)?.text || '');
    return { maxNam: num(t, /không quá (\d+) năm tù/u, dNam), frac: fracOf(t.split('nếu là tù có thời hạn')[1] || '') ?? dFrac, quote: t };
  };
  return {
    hasBook: !!findArticle(book, '55'),
    tongHop: {
      tuMax: num(q55a, /(\d+) năm đối với hình phạt tù có thời hạn/u, 30) * 12,
      caiTaoMax: num(q55a, /(\d+) năm đối với hình phạt cải tạo không giam giữ/u, 3) * 12,
      tyLe: num(q55b, /cứ (\d+) ngày cải tạo không giam giữ/u, 3),
      quote: [q55a, q55b].filter(Boolean),
    },
    tamGiam: { tu: num(q38, /bằng (\d+) ngày tù/u, 1), caiTao: num(q36, /bằng (\d+) ngày cải tạo/u, 3), quote: [q38, q36].filter(Boolean) },
    chuaDat: { maxNamNangNhat: num(q57, /không quá (\d+) năm/u, 20), frac: fracOf(q57.split('nếu là tù có thời hạn')[1] || '') ?? 3 / 4, quote: q57 },
    duoi18: { k1: r101(1, 18, 3 / 4), k2: r101(2, 12, 1 / 2) },
  };
}

/* ---------------- Thời hạn: { thang, ngay } ---------------- */
export const toDays = (d) => Math.round((d?.thang || 0) * 30 + (d?.ngay || 0));
export function normDur({ thang = 0, ngay = 0 } = {}) {
  const total = Math.round(thang * 30 + ngay);
  return { thang: Math.floor(total / 30), ngay: total % 30 };
}
export function fmtDur(d) {
  const n = normDur(d);
  const s = [fmtMonths(n.thang).replace(/^0 tháng$/, ''), n.ngay ? `${n.ngay} ngày` : ''].filter(Boolean).join(' ');
  return s || '0 ngày';
}

/**
 * Khoảng hình phạt hợp pháp đối với một khoản của điều luật cho một bị cáo.
 * opts: { book, dieu, khoan, tuoi, chuaDat, giamNheK1 (số tình tiết khoản 1 Điều 51), vaiTro }
 * Trả về { frame, min, max (tháng), chungThan, tuHinh, lines: [{ t, law }], anTreo }.
 */
export function legalRange({ book, dieu, khoan, tuoi = null, chuaDat = false, giamNheK1 = 0, vaiTro = '' } = {}) {
  const R = penaltyRules(book);
  const fr = (articleFrames(book, dieu) || []).filter((x) => !x.boSung);
  const f = fr.find((x) => x.k === +khoan);
  if (!f) return { frame: null, lines: [{ t: book ? `Không thấy khoản ${khoan || '?'} có hình phạt trong Điều ${dieu || '?'}.` : 'Chưa nạp sách Bình luận BLHS — chưa có nguyên văn khung hình phạt.' }] };
  const p = f.penalty;
  const lines = [];
  const lawF = { ref: `khoản ${f.k} Điều ${dieu} BLHS`, quote: f.text.split('\n')[0] };
  let min = p.tuMin ?? null;
  let max = p.tuMax ?? null;
  let chungThan = !!p.chungThan;
  let tuHinh = !!p.tuHinh;
  lines.push({ t: `Khung khoản ${f.k}: ${min != null ? `phạt tù từ ${fmtMonths(min)}` : max != null ? 'phạt tù' : 'không có phạt tù'}${max != null ? ` đến ${fmtMonths(max)}` : ''}${chungThan ? ', tù chung thân' : ''}${tuHinh ? ', tử hình' : ''}${p.caiTaoMax ? `; cải tạo không giam giữ đến ${fmtMonths(p.caiTaoMax)}` : ''}.`, law: [lawF] });
  const heaviest = () => (tuHinh || chungThan ? 'nặng nhất' : null);
  if (chuaDat) {
    const c = R.chuaDat;
    if (heaviest()) max = c.maxNamNangNhat * 12;
    else if (max != null) max = Math.floor(max * c.frac);
    chungThan = tuHinh = false;
    lines.push({ t: `Phạm tội chưa đạt: tối đa ${fmtMonths(max)} tù.`, law: c.quote ? [{ ref: 'khoản 3 Điều 57 BLHS', quote: c.quote }] : [] });
  }
  if (tuoi != null && tuoi >= 14 && tuoi < 18) {
    const r = tuoi >= 16 ? R.duoi18.k1 : R.duoi18.k2;
    const lim = r.maxNam * 12;
    const capByLaw = chungThan || tuHinh ? lim : max != null ? Math.floor(max * r.frac) : null;
    if (capByLaw != null) max = Math.min(max ?? capByLaw, capByLaw, lim);
    chungThan = tuHinh = false;
    lines.push({ t: `Người ${tuoi >= 16 ? 'từ đủ 16 đến dưới 18' : 'từ đủ 14 đến dưới 16'} tuổi khi phạm tội: mức cao nhất không quá ${fmtMonths(max)} tù.`, law: r.quote ? [{ ref: `khoản ${tuoi >= 16 ? 1 : 2} Điều 101 BLHS`, quote: r.quote }] : [] });
  }
  if (min != null && max != null && min > max) min = max;
  // Điều 54: dưới mức thấp nhất của khung.
  const lighter = fr.filter((x) => x.k < f.k && (x.penalty.tuMax || x.penalty.caiTaoMax)).sort((a, b) => b.k - a.k)[0];
  let duoi = null;
  if (vaiTro === 'giup-suc-khong-dang-ke') duoi = { t: 'Người giúp sức có vai trò không đáng kể (lần đầu): có thể dưới mức thấp nhất của khung, không bắt buộc trong khung liền kề (khoản 2 Điều 54).' };
  else if (giamNheK1 >= 2 && lighter && min != null) duoi = { t: `Có ${giamNheK1} tình tiết giảm nhẹ khoản 1 Điều 51: có thể dưới ${fmtMonths(min)} nhưng trong khung liền kề nhẹ hơn (khoản ${lighter.k}: ${lighter.penalty.tuMin != null ? `từ ${fmtMonths(lighter.penalty.tuMin)} ` : ''}đến ${fmtMonths(lighter.penalty.tuMax ?? lighter.penalty.caiTaoMax)}${lighter.penalty.tuMax == null ? ' cải tạo không giam giữ' : ''}) (khoản 1 Điều 54).`, lighter: lighter.penalty };
  else if (giamNheK1 >= 2 && min != null && f.k === 1) duoi = { t: `Có ${giamNheK1} tình tiết giảm nhẹ khoản 1 Điều 51 nhưng khoản 1 là khung nhẹ nhất: có thể chuyển sang hình phạt nhẹ hơn (khoản 3 Điều 54).` };
  if (duoi) {
    const a54 = parseArticle(findArticle(book, '54')?.vb || []);
    lines.push({ t: duoi.t, law: a54.slice(0, 3).filter((x) => (vaiTro === 'giup-suc-khong-dang-ke' ? x.k === 2 : x.k !== 2)).map((x) => ({ ref: `khoản ${x.k} Điều 54 BLHS`, quote: clean(x.text) })) });
  }
  const minTu = duoi?.lighter ? duoi.lighter.tuMin ?? 3 : min;
  const anTreo = !chungThan && !tuHinh && minTu != null && minTu <= 36;
  if (anTreo) lines.push({ t: 'Mức thấp nhất có thể tuyên không quá 03 năm tù → có thể xem xét án treo (Điều 65) nếu tuyên không quá 03 năm và đủ điều kiện.' });
  return { frame: f, min, max, chungThan, tuHinh, duoi54: duoi, anTreo, lines };
}

/**
 * Tổng hợp hình phạt chính (Điều 55; Điều 56 khi có phần chưa chấp hành của bản án trước).
 * items: [{ loai: 'tu'|'cai-tao'|'chung-than'|'tu-hinh'|'phat-tien', thang, ngay, tien, nhan }]
 * daChapHanh: { thang, ngay } (khoản 1 Điều 56 — trừ vào hình phạt chung).
 */
export function tongHop(items = [], { book = null, daChapHanh = null } = {}) {
  const R = penaltyRules(book).tongHop;
  const law = R.quote.map((q, i) => ({ ref: `điểm ${i ? 'b' : 'a'} khoản 1 Điều 55 BLHS`, quote: q }));
  const tien = items.filter((x) => x.loai === 'phat-tien').reduce((s, x) => s + (+x.tien || 0), 0);
  const out = { loai: null, dur: null, tien: tien || null, lines: [], law };
  if (items.some((x) => x.loai === 'tu-hinh')) out.loai = 'tu-hinh';
  else if (items.some((x) => x.loai === 'chung-than')) out.loai = 'chung-than';
  if (out.loai) {
    out.lines.push(`Hình phạt nặng nhất là ${out.loai === 'tu-hinh' ? 'tử hình' : 'tù chung thân'} → hình phạt chung là ${out.loai === 'tu-hinh' ? 'tử hình' : 'tù chung thân'}.`);
  } else {
    const tu = items.filter((x) => x.loai === 'tu');
    const ct = items.filter((x) => x.loai === 'cai-tao');
    const days = (list) => list.reduce((s, x) => s + toDays(x), 0);
    if (tu.length) {
      let d = days(tu);
      if (ct.length) {
        const conv = Math.floor(days(ct) / R.tyLe);
        out.lines.push(`Cải tạo không giam giữ ${fmtDur(normDur({ ngay: days(ct) }))} chuyển thành ${fmtDur(normDur({ ngay: conv }))} tù (cứ ${R.tyLe} ngày cải tạo không giam giữ = 01 ngày tù).`);
        d += conv;
      }
      out.loai = 'tu';
      const cap = R.tuMax * 30;
      if (d > cap) out.lines.push(`Tổng ${fmtDur(normDur({ ngay: d }))} vượt quá ${fmtMonths(R.tuMax)} → hình phạt chung là ${fmtMonths(R.tuMax)} tù.`);
      out.dur = normDur({ ngay: Math.min(d, cap) });
    } else if (ct.length) {
      const d = days(ct);
      const cap = R.caiTaoMax * 30;
      out.loai = 'cai-tao';
      if (d > cap) out.lines.push(`Tổng ${fmtDur(normDur({ ngay: d }))} vượt quá ${fmtMonths(R.caiTaoMax)} → hình phạt chung là ${fmtMonths(R.caiTaoMax)} cải tạo không giam giữ.`);
      out.dur = normDur({ ngay: Math.min(d, cap) });
    }
  }
  if (tien) out.lines.push(`Phạt tiền không tổng hợp với hình phạt khác; các khoản tiền phạt cộng lại: ${tien.toLocaleString('vi-VN')} đồng.`);
  if (out.dur && daChapHanh && toDays(daChapHanh)) {
    out.conLai = normDur({ ngay: Math.max(0, toDays(out.dur) - toDays(daChapHanh)) });
    out.lines.push(`Trừ thời gian đã chấp hành ${fmtDur(daChapHanh)} → còn phải chấp hành ${fmtDur(out.conLai)} (khoản 1 Điều 56).`);
  }
  return out;
}

/* ---------------- Ngày tháng ---------------- */
export const parseIso = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')) || null;
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const v = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '').trim());
  return v ? new Date(+v[3], +v[2] - 1, +v[1]) : null;
};
export const fmtDate = (d) => (d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '');
export const isoDate = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Cộng tháng: ngày trùng của tháng sau; tháng không có ngày trùng → ngày cuối tháng. */
export function addMonths(d, n) {
  const y = d.getFullYear();
  const m = d.getMonth() + n;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d.getDate(), last));
}
/** Số ngày của khoảng [from, to] (tính cả hai đầu). */
export const daysBetween = (from, to) => Math.round((to - from) / 86400000) + 1;

/**
 * Trừ tạm giữ, tạm giam và ngày chấp hành xong.
 * { loai: 'tu'|'cai-tao', dur: {thang, ngay}, tamGiam: [{ tu, den }] (ISO / dd/mm/yyyy), batDau } → kết quả.
 * Thời hạn tính từ ngày bắt đầu chấp hành; phần tạm giữ, tạm giam (Điều 38: 1 ngày = 1 ngày tù; Điều 36: 1 ngày = 3 ngày
 * cải tạo không giam giữ) được trừ. Ngày chấp hành xong là ngày cuối cùng của thời hạn.
 */
export function chapHanh({ loai = 'tu', dur = {}, tamGiam = [], batDau = null, book = null } = {}) {
  const R = penaltyRules(book).tamGiam;
  const lines = [];
  const start = parseIso(batDau);
  // Khoảng tạm giam liền với thời gian chấp hành (thời hạn tù tính từ ngày bắt tạm giam) đã nằm trong thời hạn → chỉ trừ
  // các khoảng tạm giữ, tạm giam kết thúc TRƯỚC ngày bắt đầu chấp hành.
  const periods = tamGiam.map((x) => ({ tu: parseIso(x.tu), den: parseIso(x.den) })).filter((x) => x.tu && x.den && x.den >= x.tu);
  const giam = periods.filter((x) => !start || x.den < start).reduce((s, x) => s + daysBetween(x.tu, x.den), 0);
  if (start && periods.some((x) => x.den >= start)) lines.push(`Khoảng tạm giam từ ngày ${fmtDate(start)} trở đi đã nằm trong thời hạn chấp hành (thời hạn tính từ ngày bắt đầu chấp hành) nên không trừ thêm.`);
  const tyLe = loai === 'cai-tao' ? R.caiTao : R.tu;
  const tru = giam * tyLe;
  const total = toDays(dur);
  const con = Math.max(0, total - tru);
  if (giam) lines.push(`Đã tạm giữ, tạm giam ${giam} ngày → trừ ${tru} ngày ${loai === 'cai-tao' ? 'cải tạo không giam giữ' : 'tù'} (cứ 01 ngày tạm giữ, tạm giam = ${String(tyLe).padStart(2, '0')} ngày ${loai === 'cai-tao' ? 'cải tạo không giam giữ' : 'tù'}).`);
  lines.push(`Còn phải chấp hành: ${fmtDur(normDur({ ngay: con }))}${giam ? ' (khi trừ, 01 tháng tính 30 ngày)' : ''}.`);
  let ketThuc = null;
  if (start && con > 0) {
    // Tháng tính theo lịch (ngày trùng tháng sau), ngày lẻ cộng thêm; ngày cuối cùng = trước ngày tròn thời hạn một ngày.
    const n = normDur({ ngay: con });
    ketThuc = addDays(addDays(addMonths(start, n.thang), n.ngay), -1);
    lines.push(`Bắt đầu chấp hành từ ${fmtDate(start)} → chấp hành xong vào hết ngày ${fmtDate(ketThuc)}.`);
  }
  return { giam, tru, con: normDur({ ngay: con }), ketThuc, lines, law: R.quote.map((q, i) => ({ ref: i ? 'khoản 1 Điều 36 BLHS' : 'khoản 1 Điều 38 BLHS', quote: q })) };
}
