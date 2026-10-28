// Pháp luật theo thời điểm: văn bản có hiệu lực tại ngày thực hiện hành vi / ngày xét xử, văn bản sửa đổi phát sinh sau
// hành vi (Điều 7 BLHS — hiệu lực về thời gian, quy định có lợi), sách Bình luận đã nạp có thể chưa gồm sửa đổi mới;
// tuổi chịu trách nhiệm hình sự (Điều 12) tại ngày thực hiện hành vi.
// Danh mục văn bản đặt sẵn và SỬA ĐƯỢC trong Cài đặt Tòa án (lưu theo tài khoản) — văn bản đánh dấu "cần kiểm tra" là thông
// tin người dùng cần đối chiếu nguồn chính thức.
import { findArticle } from './binh-luan.js';
import { parseArticle, articleFrames, crimeClass } from './court.js';
import { parseIso, fmtDate } from './court-penalty.js';

export const DEFAULT_LAWS = [
  { id: 'blhs-1999', loai: 'blhs', ten: 'Bộ luật Hình sự năm 1999 (sửa đổi, bổ sung năm 2009)', tu: '2000-07-01', den: '2017-12-31' },
  { id: 'blhs-2015', loai: 'blhs', ten: 'Bộ luật Hình sự năm 2015 (sửa đổi, bổ sung năm 2017)', tu: '2018-01-01', den: '' },
  { id: 'luat-86-2025', loai: 'blhs', ten: 'Luật số 86/2025/QH15 sửa đổi, bổ sung một số điều của Bộ luật Hình sự', tu: '2025-07-01', den: '', suaDoi: true, kiemTra: true },
  { id: 'bltths-2015', loai: 'bltths', ten: 'Bộ luật Tố tụng hình sự năm 2015 (sửa đổi, bổ sung)', tu: '2018-01-01', den: '' },
  { id: 'vbhn-172-2026', loai: 'bltths', ten: 'Văn bản hợp nhất số 172/2026/VBHN-LQ-VPQH ngày 01/10/2026 (tra cứu nguyên văn)', tu: '2026-10-01', den: '', hopNhat: true, kiemTra: true },
];
export const LAWS_KEY = 'court-laws';
export const mergeLaws = (saved) => (Array.isArray(saved) && saved.length ? saved : DEFAULT_LAWS).map((x) => ({ ...x }));

const inRange = (d, l) => {
  const tu = parseIso(l.tu);
  const den = parseIso(l.den);
  return (!tu || d >= tu) && (!den || d <= den);
};

/** Ghi chú áp dụng pháp luật theo thời điểm: [{ level: 'thieu'|'canh'|'goi'|'dung', text, law }]. */
export function lawNotes({ ngayHanhVi = '', ngayXetXu = '', laws = DEFAULT_LAWS, book = null } = {}) {
  const out = [];
  const hv = parseIso(ngayHanhVi);
  const xx = parseIso(ngayXetXu) || new Date();
  const a7 = parseArticle(findArticle(book, '7')?.vb || []);
  const q7 = (k) => (a7.find((x) => x.k === k)?.text || '').trim();
  const law7 = [2, 3].map((k) => q7(k) && { ref: `khoản ${k} Điều 7 BLHS`, quote: q7(k) }).filter(Boolean);
  if (!hv) {
    out.push({ level: 'thieu', text: 'Chưa nhập ngày thực hiện hành vi phạm tội — chưa xác định được văn bản pháp luật áp dụng theo thời điểm (tab Vụ án, thời hạn).' });
    return out;
  }
  const blhs = laws.filter((l) => l.loai === 'blhs');
  const base = blhs.filter((l) => !l.suaDoi && inRange(hv, l));
  out.push({ level: 'dung', text: `Ngày thực hiện hành vi ${fmtDate(hv)}: áp dụng ${base.map((l) => l.ten).join('; ') || 'văn bản có hiệu lực tại thời điểm đó (chưa có trong danh mục)'}.` });
  if (base.some((l) => l.id === 'blhs-1999')) out.push({ level: 'canh', text: 'Hành vi thực hiện trước ngày 01/01/2018: đối chiếu Bộ luật Hình sự 1999 và quy định chuyển tiếp (Nghị quyết số 41/2017/QH14 về thi hành Bộ luật Hình sự 2015) — áp dụng quy định có lợi cho người phạm tội.', law: law7 });
  for (const l of blhs.filter((x) => x.suaDoi)) {
    const tu = parseIso(l.tu);
    if (!tu) continue;
    if (tu > hv && tu <= xx) out.push({ level: 'canh', text: `${l.ten} có hiệu lực từ ${fmtDate(tu)} — sau ngày thực hiện hành vi, trước ngày xét xử: điều khoản sửa đổi có lợi cho người phạm tội thì được áp dụng, không có lợi thì không áp dụng (Điều 7 BLHS).${l.kiemTra ? ' (Ngày hiệu lực đặt sẵn — kiểm tra lại.)' : ''}`, law: law7 });
    else if (tu <= hv) out.push({ level: 'goi', text: `${l.ten} (hiệu lực từ ${fmtDate(tu)}) đã có hiệu lực tại thời điểm thực hiện hành vi — áp dụng điều luật đã được sửa đổi.${l.kiemTra ? ' (Ngày hiệu lực đặt sẵn — kiểm tra lại.)' : ''}` });
    if (book && tu <= xx) out.push({ level: 'canh', text: `Nguyên văn điều luật trong sách Bình luận đã nạp có thể chưa gồm sửa đổi của ${l.ten} — điều luật bị sửa đổi cần đối chiếu văn bản hiện hành trước khi kết luận.` });
  }
  const tt = laws.filter((l) => l.loai === 'bltths' && inRange(xx, l));
  if (tt.length) out.push({ level: 'goi', text: `Thủ tục tố tụng: áp dụng Bộ luật Tố tụng hình sự có hiệu lực tại thời điểm tiến hành tố tụng — ${tt.map((l) => l.ten).join('; ')}.` });
  return out;
}

/** Tuổi tròn tại ngày hd từ ngày sinh (dd/mm/yyyy, ISO) hoặc chỉ năm sinh → { min, max } (chỉ năm → có thể chênh 1 tuổi). */
export function ageAt(ngaySinh, namSinh, hd) {
  const d = parseIso(ngaySinh);
  if (d && hd) {
    let a = hd.getFullYear() - d.getFullYear();
    if (hd.getMonth() < d.getMonth() || (hd.getMonth() === d.getMonth() && hd.getDate() < d.getDate())) a--;
    return { min: a, max: a, exact: true };
  }
  const y = +(namSinh || /(\d{4})/.exec(String(ngaySinh || ''))?.[1]);
  if (!y || !hd) return null;
  return { min: hd.getFullYear() - y - 1, max: hd.getFullYear() - y, exact: false };
}

/** Kiểm tra tuổi chịu trách nhiệm hình sự (Điều 12) của từng bị cáo tại ngày thực hiện hành vi. */
export function ageChecks(rec = {}, { book = null } = {}) {
  const hv = parseIso(rec.moc?.ngayHanhVi);
  const out = [];
  const k12 = parseArticle(findArticle(book, '12')?.vb || []);
  const law = k12.slice(0, 2).map((k) => ({ ref: `khoản ${k.k} Điều 12 BLHS`, quote: k.text.trim() }));
  for (const d of rec.defendants || []) {
    if (!d.hoTen) continue;
    const a = ageAt(d.ngaySinh, d.namSinh, hv);
    if (!a) {
      if (hv) out.push({ level: 'thieu', ten: d.hoTen, text: `Bị cáo ${d.hoTen}: chưa có ngày / năm sinh — chưa xác định được tuổi tại thời điểm phạm tội.` });
      continue;
    }
    const t = d.toiDanh?.[0] || {};
    const fr = (articleFrames(book, t.dieu) || []).find((x) => !x.boSung && x.k === +t.khoan);
    const cls = fr ? crimeClass(fr.penalty) : null;
    const ageTxt = a.exact ? `${a.max} tuổi` : `${a.min}–${a.max} tuổi (chỉ có năm sinh)`;
    if (a.max < 14) out.push({ level: 'loi', ten: d.hoTen, text: `Bị cáo ${d.hoTen} ${ageTxt} khi thực hiện hành vi — chưa đủ tuổi chịu trách nhiệm hình sự.`, law });
    else if (a.min < 16) {
      const nhe = cls === 'ít nghiêm trọng' || cls === 'nghiêm trọng';
      out.push({ level: nhe ? 'loi' : 'canh', ten: d.hoTen, text: `Bị cáo ${d.hoTen} ${ageTxt} khi thực hiện hành vi${a.min < 14 ? ' (có thể chưa đủ 14 tuổi)' : ''}: từ đủ 14 đến dưới 16 tuổi chỉ chịu trách nhiệm hình sự về tội rất nghiêm trọng, đặc biệt nghiêm trọng thuộc các điều được liệt kê${cls ? ` — khung đã áp dụng là tội ${cls}` : ''}.`, law });
    } else if (a.min < 18) out.push({ level: 'goi', ten: d.hoTen, text: `Bị cáo ${d.hoTen} ${ageTxt} khi thực hiện hành vi — áp dụng quy định đối với người dưới 18 tuổi phạm tội (Chương XII BLHS, mức phạt tù theo Điều 101).` });
    else out.push({ level: 'dung', ten: d.hoTen, text: `Bị cáo ${d.hoTen} ${ageTxt} khi thực hiện hành vi — đủ tuổi chịu trách nhiệm hình sự.` });
  }
  return out;
}
