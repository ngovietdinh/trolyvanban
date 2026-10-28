// Thời hạn tố tụng của Tòa án (hình sự sơ thẩm, phúc thẩm): từ các mốc của hồ sơ xét xử → danh sách hạn, còn bao nhiêu
// ngày, sắp đến hạn / quá hạn. Số ngày đặt sẵn theo Bộ luật Tố tụng hình sự 2015 (sửa đổi) và SỬA ĐƯỢC trong
// "Cài đặt thời hạn" (lưu theo tài khoản) — luật thay đổi thì người dùng chỉnh, không cần cập nhật phần mềm.
//
// Cách tính (Điều 134 BLTTHS): không tính ngày bắt đầu; thời hạn tính bằng tháng hết vào ngày trùng của tháng sau (không
// có ngày trùng → ngày cuối tháng); hết hạn vào ngày nghỉ thì lùi sang ngày làm việc tiếp theo (phần mềm chỉ biết thứ
// Bảy, Chủ nhật — ngày lễ người dùng tự lưu ý). Thời hạn tạm giam không lùi theo ngày nghỉ.
import { addDays, addMonths, parseIso, fmtDate } from './court-penalty.js';
import { articleFrames, crimeClass } from './court.js';

export const LOAI_TOI = [
  { id: 'it', ten: 'Ít nghiêm trọng' },
  { id: 'nt', ten: 'Nghiêm trọng' },
  { id: 'rnt', ten: 'Rất nghiêm trọng' },
  { id: 'dbnt', ten: 'Đặc biệt nghiêm trọng' },
];
const CLASS_ID = { 'ít nghiêm trọng': 'it', 'nghiêm trọng': 'nt', 'rất nghiêm trọng': 'rnt', 'đặc biệt nghiêm trọng': 'dbnt' };

/** Thời hạn đặt sẵn: { id: { ten, n, unit: 'ngay'|'thang', canCu } }. */
export const DEFAULT_RULES = {
  'chuan-bi-it': { ten: 'Chuẩn bị xét xử — tội ít nghiêm trọng', n: 30, unit: 'ngay', canCu: 'khoản 1 Điều 277 BLTTHS' },
  'chuan-bi-nt': { ten: 'Chuẩn bị xét xử — tội nghiêm trọng', n: 45, unit: 'ngay', canCu: 'khoản 1 Điều 277 BLTTHS' },
  'chuan-bi-rnt': { ten: 'Chuẩn bị xét xử — tội rất nghiêm trọng', n: 2, unit: 'thang', canCu: 'khoản 1 Điều 277 BLTTHS' },
  'chuan-bi-dbnt': { ten: 'Chuẩn bị xét xử — tội đặc biệt nghiêm trọng', n: 3, unit: 'thang', canCu: 'khoản 1 Điều 277 BLTTHS' },
  'gia-han-it': { ten: 'Gia hạn chuẩn bị xét xử — ít nghiêm trọng, nghiêm trọng', n: 15, unit: 'ngay', canCu: 'khoản 1 Điều 277 BLTTHS' },
  'gia-han-rnt': { ten: 'Gia hạn chuẩn bị xét xử — rất nghiêm trọng, đặc biệt nghiêm trọng', n: 30, unit: 'ngay', canCu: 'khoản 1 Điều 277 BLTTHS' },
  'nhan-lai-ho-so': { ten: 'Ra quyết định đưa vụ án ra xét xử sau khi nhận lại hồ sơ điều tra bổ sung', n: 15, unit: 'ngay', canCu: 'khoản 2 Điều 277 BLTTHS' },
  'mo-phien-toa': { ten: 'Mở phiên tòa kể từ ngày có quyết định đưa vụ án ra xét xử', n: 15, unit: 'ngay', canCu: 'khoản 3 Điều 277 BLTTHS (trở ngại khách quan: 30 ngày)' },
  'giao-ban-an': { ten: 'Giao, gửi bản án sơ thẩm', n: 10, unit: 'ngay', canCu: 'khoản 1 Điều 262 BLTTHS' },
  'khang-cao': { ten: 'Kháng cáo bản án sơ thẩm', n: 15, unit: 'ngay', canCu: 'khoản 1 Điều 333 BLTTHS' },
  'khang-nghi-cung-cap': { ten: 'Kháng nghị của Viện kiểm sát cùng cấp', n: 15, unit: 'ngay', canCu: 'khoản 1 Điều 337 BLTTHS' },
  'khang-nghi-cap-tren': { ten: 'Kháng nghị của Viện kiểm sát cấp trên trực tiếp', n: 30, unit: 'ngay', canCu: 'khoản 1 Điều 337 BLTTHS' },
  'gui-ho-so-pt': { ten: 'Gửi hồ sơ, kháng cáo, kháng nghị lên Tòa án cấp phúc thẩm (kể từ ngày hết hạn kháng cáo, kháng nghị)', n: 7, unit: 'ngay', canCu: 'BLTTHS — gửi hồ sơ vụ án có kháng cáo, kháng nghị' },
  'tam-giam-sau-tuyen-an': { ten: 'Tạm giam bị cáo sau khi tuyên án', n: 45, unit: 'ngay', canCu: 'khoản 1 Điều 329 BLTTHS' },
  'thi-hanh': { ten: 'Ra quyết định thi hành án kể từ ngày bản án có hiệu lực', n: 7, unit: 'ngay', canCu: 'khoản 1 Điều 364 BLTTHS' },
  'phuc-tham': { ten: 'Mở phiên tòa phúc thẩm kể từ ngày nhận hồ sơ vụ án', n: 60, unit: 'ngay', canCu: 'BLTTHS — thời hạn xét xử phúc thẩm (Tòa án cấp tỉnh)' },
  'canh-bao': { ten: 'Báo “sắp đến hạn” trước', n: 5, unit: 'ngay', canCu: 'Cài đặt của người dùng' },
};

/** Gộp thời hạn người dùng đã sửa với thời hạn đặt sẵn. */
export function mergeRules(saved = {}) {
  const out = {};
  for (const [k, v] of Object.entries(DEFAULT_RULES)) out[k] = { ...v, ...(saved[k] && Number.isFinite(+saved[k].n) && +saved[k].n > 0 ? { n: +saved[k].n } : {}) };
  return out;
}

const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
/** Hạn cuối từ ngày gốc (không tính ngày gốc). */
export function dueDate(base, rule, { shiftWeekend = true } = {}) {
  if (!base || !rule) return null;
  let d = rule.unit === 'thang' ? addMonths(base, rule.n) : addDays(base, rule.n);
  if (shiftWeekend) while (isWeekend(d)) d = addDays(d, 1);
  return d;
}
const plusRule = (d, rule) => (rule.unit === 'thang' ? addMonths(d, rule.n) : addDays(d, rule.n));
export const daysLeft = (han, today) => Math.round((new Date(han.getFullYear(), han.getMonth(), han.getDate()) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);

/** Loại tội phạm gợi ý: nặng nhất trong các khoản đang truy tố / áp dụng (theo khung trong sách, Điều 9). */
export function suggestLoaiToi(defendants = [], book = null) {
  const order = ['it', 'nt', 'rnt', 'dbnt'];
  let best = null;
  for (const d of defendants)
    for (const t of d.toiDanh || []) {
      const f = (articleFrames(book, t.dieu) || []).find((x) => !x.boSung && x.k === +t.khoan);
      const id = f ? CLASS_ID[crimeClass(f.penalty)] : null;
      if (id && (!best || order.indexOf(id) > order.indexOf(best))) best = id;
    }
  return best;
}

/**
 * Danh sách hạn của một hồ sơ xét xử.
 * rec: { cap: 'so-tham'|'phuc-tham', loaiToi, thuLy: { ngay }, moc: {...}, defendants: [{ hoTen, nganChan: { loai, den } }] }
 * Trả về [{ id, ten, han (Date|null), canCu, trangThai: 'xong'|'tre'|'qua-han'|'sap'|'con'|'moc'|'da-qua'|'thieu', con, ghiChu }].
 */
export function computeDeadlines(rec, { rules = mergeRules(), today = new Date() } = {}) {
  const m = rec.moc || {};
  const D = (k) => parseIso(m[k]);
  const warn = rules['canh-bao'].n;
  const items = [];
  const push = (id, rule, han, { done = null, moc = false, ghiChu = '', ten = rule?.ten, canCu = rule?.canCu } = {}) => {
    const it = { id, ten, han, canCu, ghiChu, con: han ? daysLeft(han, today) : null };
    if (!han) it.trangThai = 'thieu';
    else if (done) it.trangThai = done > han ? 'tre' : 'xong';
    else if (moc) it.trangThai = it.con < 0 ? 'da-qua' : 'moc';
    else it.trangThai = it.con < 0 ? 'qua-han' : it.con <= warn ? 'sap' : 'con';
    if (done) it.xong = done;
    items.push(it);
  };
  const tuyen = D('ngayTuyenAn');
  if (rec.cap === 'phuc-tham') {
    const nhan = D('ngayNhanHoSo');
    push('phuc-tham', rules['phuc-tham'], nhan ? dueDate(nhan, rules['phuc-tham']) : null, { done: D('ngayXetXu'), ghiChu: nhan ? '' : 'Nhập ngày nhận hồ sơ vụ án phúc thẩm.' });
  } else {
    const thuLy = parseIso(rec.thuLy?.ngay);
    const loai = rec.loaiToi;
    const traHoSo = D('ngayTraHoSo');
    const nhanLai = D('ngayNhanLaiHoSo');
    if (nhanLai) push('nhan-lai-ho-so', rules['nhan-lai-ho-so'], dueDate(nhanLai, rules['nhan-lai-ho-so']), { done: D('ngayQdXetXu') });
    else {
      const r = loai ? rules[`chuan-bi-${loai}`] : null;
      let han = thuLy && r ? plusRule(thuLy, r) : null;
      const gh = loai ? rules[loai === 'it' || loai === 'nt' ? 'gia-han-it' : 'gia-han-rnt'] : null;
      if (han && m.giaHan && gh) han = plusRule(han, gh);
      if (han) while (isWeekend(han)) han = addDays(han, 1);
      push('chuan-bi', r || DEFAULT_RULES['chuan-bi-it'], han, {
        ten: `Chuẩn bị xét xử${loai ? ` (${(LOAI_TOI.find((x) => x.id === loai)?.ten || loai).toLowerCase()})` : ''}${m.giaHan ? ', đã gia hạn' : ''}`,
        done: D('ngayQdXetXu') || traHoSo,
        ghiChu: !thuLy ? 'Nhập ngày thụ lý.' : !loai ? 'Chọn loại tội phạm để tính thời hạn chuẩn bị xét xử.' : traHoSo && !D('ngayQdXetXu') ? `Đã trả hồ sơ điều tra bổ sung ngày ${fmtDate(traHoSo)} — nhập ngày nhận lại hồ sơ.` : '',
      });
    }
    const qd = D('ngayQdXetXu');
    if (qd) push('mo-phien-toa', rules['mo-phien-toa'], dueDate(qd, rules['mo-phien-toa']), { done: D('ngayXetXu') || tuyen });
    if (tuyen) {
      push('giao-ban-an', rules['giao-ban-an'], dueDate(tuyen, rules['giao-ban-an']), { done: D('ngayGiaoBanAn') });
      push('khang-cao', rules['khang-cao'], dueDate(tuyen, rules['khang-cao']), { moc: true, ghiChu: 'Người vắng mặt: tính từ ngày nhận được bản án hoặc ngày niêm yết.' });
      push('khang-nghi-cung-cap', rules['khang-nghi-cung-cap'], dueDate(tuyen, rules['khang-nghi-cung-cap']), { moc: true });
      push('khang-nghi-cap-tren', rules['khang-nghi-cap-tren'], dueDate(tuyen, rules['khang-nghi-cap-tren']), { moc: true });
      if (m.coKhangCao) {
        const het = dueDate(tuyen, rules['khang-cao']);
        push('gui-ho-so-pt', rules['gui-ho-so-pt'], dueDate(het, rules['gui-ho-so-pt']), { done: D('ngayGuiHoSo') });
      } else {
        const hl = D('ngayHieuLuc') || dueDate(tuyen, rules['khang-nghi-cap-tren']);
        push('thi-hanh', rules['thi-hanh'], dueDate(hl, rules['thi-hanh']), { done: D('ngayQdThiHanh'), ghiChu: m.ngayHieuLuc ? '' : `Bản án có hiệu lực ngày ${fmtDate(hl)} nếu không bị kháng cáo, kháng nghị.` });
      }
    }
  }
  // Tạm giam từng bị cáo: hạn ghi trong lệnh tạm giam (không lùi theo ngày nghỉ).
  for (const d of rec.defendants || []) {
    const nc = d.nganChan || {};
    if (nc.loai !== 'tam-giam') continue;
    const den = parseIso(nc.den);
    const ten = `Hết hạn tạm giam — bị cáo ${d.hoTen || '(chưa ghi tên)'}`;
    if (tuyen && rec.cap !== 'phuc-tham') {
      push(`tam-giam-sau-${d.id}`, rules['tam-giam-sau-tuyen-an'], addDays(tuyen, rules['tam-giam-sau-tuyen-an'].n), { ten: `Tạm giam sau tuyên án — bị cáo ${d.hoTen || '(chưa ghi tên)'}`, ghiChu: 'Nếu bị cáo bị xử phạt tù và đang bị tạm giam.' });
    } else push(`tam-giam-${d.id}`, { ten, canCu: 'Lệnh tạm giam' }, den, { ten, canCu: 'Lệnh tạm giam', ghiChu: den ? '' : 'Nhập ngày hết hạn tạm giam theo lệnh.' });
  }
  return items;
}

const RANK = { 'qua-han': 0, sap: 1, thieu: 2, con: 3, moc: 4, tre: 5, xong: 6, 'da-qua': 7 };
/** Việc cần chú ý trên nhiều hồ sơ: quá hạn, sắp đến hạn, còn hạn — sắp theo mức khẩn rồi theo ngày. */
export function upcoming(recs = [], opts = {}) {
  const out = [];
  for (const r of recs) for (const it of computeDeadlines(r, opts)) if (['qua-han', 'sap', 'con', 'moc'].includes(it.trangThai)) out.push({ ...it, rec: r });
  return out.sort((a, b) => RANK[a.trangThai] - RANK[b.trangThai] || a.han - b.han);
}
export const TRANG_THAI = { 'qua-han': 'Quá hạn', sap: 'Sắp đến hạn', con: 'Còn hạn', moc: 'Mốc', 'da-qua': 'Đã qua', xong: 'Đã xong', tre: 'Xong nhưng trễ hạn', thieu: 'Thiếu dữ liệu' };
