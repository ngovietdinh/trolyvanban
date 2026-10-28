// Bản án tương tự và án lệ: đọc bản án / án lệ người dùng nạp vào kho (tội danh, khoản, điểm, hình phạt, tình tiết, giá
// trị tài sản; án lệ: khái quát nội dung, điều luật liên quan), tìm bản án tương tự với bị cáo đang xét và thống kê mức án.
// Chỉ so sánh các bản án có trong kho của người dùng — không tự tạo bản án.
import { parseVerdict, parseCitations, fmtMonths, fmtVnd } from './court.js';
import { findCrime } from './engine.js';

const pick = (re, t) => re.exec(t)?.[1]?.trim() || '';

/** Đọc một bản án / án lệ trong kho → bản ghi tóm tắt (giữ nguyên văn để xem lại). */
export function parseKhoDoc(text, name = '') {
  const t = String(text || '').replace(/\r/g, '');
  const head = t.slice(0, 1500);
  const anLe = /ÁN LỆ SỐ|Án lệ số\s+\d+\/\d{4}\/AL/u.test(head);
  if (anLe) {
    const so = pick(/Án lệ số\s*:?\s*([0-9]{1,3}\/[0-9]{4}\/AL)/iu, t);
    const ten = pick(/ÁN LỆ SỐ[^\n]*\n+([^\n]{5,200})/u, t) || pick(/Về\s+([^\n]{5,200})/u, head);
    const khaiQuat = pick(/Khái quát nội dung (?:của )?án lệ\s*:?\s*\n*([\s\S]{20,1500}?)(?:\n\s*\n|Giải pháp pháp lý|Quy định của pháp luật)/iu, t);
    const giaiPhap = pick(/Giải pháp pháp lý\s*:?\s*\n*([\s\S]{20,1500}?)(?:\n\s*\n|Quy định của pháp luật)/iu, t);
    const qd = pick(/Quy định của pháp luật liên quan đến án lệ\s*:?\s*\n*([\s\S]{5,800}?)(?:\n\s*\n|Từ khóa|$)/iu, t);
    const dieu = [...new Set(parseCitations(qd || t.slice(0, 3000)).map((c) => c.dieu).filter((d) => findCrime(d) || /^\d+$/.test(d)))];
    return { loai: 'an-le', ten: ten || name, so, khaiQuat, giaiPhap, dieu, name, text: t };
  }
  const v = parseVerdict(t);
  const so = pick(/Bản án số\s*:?\s*([0-9]{1,5}\/[0-9]{4}\/HS-(?:ST|PT))/iu, t);
  const ngay = pick(/Bản án số[^\n]*\n?[^\n]*?Ngày\s*:?\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4})/iu, head) || pick(/ngày\s+([0-9]{1,2}\s+tháng\s+[0-9]{1,2}\s+năm\s+[0-9]{4})/iu, head);
  const toa = pick(/^(TÒA ÁN NHÂN DÂN[^\n]{0,80})/mu, head);
  const money = v.money.sort((a, b) => b.v - a.v)[0]?.v ?? null;
  const bc = v.defendants.map((d) => ({ hoTen: d.hoTen, dieu: d.toiDanh[0]?.dieu || '', khoan: d.toiDanh[0]?.khoan ?? null, diem: d.toiDanh[0]?.diem || [], hinhPhat: d.hinhPhat || {}, giamNhe: d.giamNhe, tangNang: d.tangNang, dieu54: d.dieu54, anTreo: !!d.hinhPhat?.anTreo }));
  return { loai: 'ban-an', ten: name || so || 'Bản án', so, ngay, toa, cap: /HS-PT/u.test(so) ? 'pt' : 'st', soTien: money, bc, name, text: t };
}

const jacc = (a = [], b = []) => {
  const A = new Set(a);
  const B = new Set(b);
  const u = new Set([...A, ...B]);
  return u.size ? [...A].filter((x) => B.has(x)).length / u.size : 0;
};

/**
 * Bản án tương tự với bị cáo d ({ toiDanh: [{dieu, khoan}], soTien, giamNhe, tangNang }) trong kho.
 * Trả về { items: [{ doc, bc, diem, ly }], stats: { n, min, max, median, anTreo } } (mức tù tính tháng, cùng điều + khoản).
 */
export function findSimilar(d, docs = [], { limit = 12 } = {}) {
  const t = d?.toiDanh?.[0] || {};
  if (!t.dieu) return { items: [], stats: null };
  const items = [];
  for (const doc of docs.filter((x) => x.loai === 'ban-an')) {
    for (const bc of doc.bc || []) {
      if (bc.dieu !== String(t.dieu)) continue;
      let diem = 1;
      const ly = [`cùng Điều ${t.dieu}`];
      if (t.khoan && bc.khoan === +t.khoan) (diem += 3), ly.push(`cùng khoản ${t.khoan}`);
      const tien = d.soTien ?? null;
      if (tien && doc.soTien && Math.abs(doc.soTien - tien) / Math.max(tien, doc.soTien) <= 0.5) (diem += 2), ly.push(`giá trị gần (${fmtVnd(doc.soTien)})`);
      const j = jacc(d.giamNhe, bc.giamNhe);
      if (j > 0) (diem += 2 * j), ly.push(`tình tiết giảm nhẹ giống ${Math.round(j * 100)}%`);
      if (!(d.tangNang || []).length === !(bc.tangNang || []).length) diem += 0.5;
      items.push({ doc, bc, diem, ly });
    }
  }
  items.sort((a, b) => b.diem - a.diem);
  // Thống kê trên các bản án cùng điều + khoản; không có thì trên các bản án cùng điều (ghi rõ phạm vi).
  const sameK = items.filter((x) => !t.khoan || x.bc.khoan === +t.khoan);
  const same = sameK.length ? sameK : items;
  const tu = same.filter((x) => x.bc.hinhPhat?.loai === 'tu' && x.bc.hinhPhat.thang != null).map((x) => x.bc.hinhPhat.thang).sort((a, b) => a - b);
  const stats = same.length ? { n: same.length, pham: sameK.length ? 'khoan' : 'dieu', min: tu[0] ?? null, max: tu[tu.length - 1] ?? null, median: tu.length ? tu[Math.floor((tu.length - 1) / 2)] : null, anTreo: same.filter((x) => x.bc.anTreo).length } : null;
  return { items: items.slice(0, limit), stats };
}

/** Án lệ trong kho liên quan đến điều luật đang xét. */
export const relatedPrecedents = (dieus = [], docs = []) => docs.filter((x) => x.loai === 'an-le' && x.dieu?.some((d) => dieus.includes(d)));

export const hinhPhatNgan = (hp = {}) => (hp.loai === 'tu' && hp.thang != null ? `${fmtMonths(hp.thang)} tù${hp.anTreo ? ' (án treo)' : ''}` : hp.loai === 'cai-tao' ? `${fmtMonths(hp.thang)} cải tạo không giam giữ` : hp.loai === 'chung-than' ? 'tù chung thân' : hp.loai === 'tu-hinh' ? 'tử hình' : hp.loai === 'phat-tien' ? 'phạt tiền' : '—');
