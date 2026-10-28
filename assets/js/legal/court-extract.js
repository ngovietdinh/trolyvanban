// Bộ tự động bắt thông tin vụ án từ tài liệu (cáo trạng, bản án, quyết định đưa vụ án ra xét xử, thông báo thụ lý,
// quyết định kháng nghị, đơn kháng cáo, kết luận điều tra, lệnh tạm giam…) → các ô của hồ sơ xét xử.
//
// Nguyên tắc: chỉ lấy đúng chữ có trong tài liệu, mỗi giá trị kèm câu trích (quote) và tên tài liệu để người dùng
// đối chiếu; không suy diễn. Luật bắt khai báo trong FIELD_RULES — thêm ô mới chỉ cần thêm một dòng luật.
import { parseIndictment, parseVerdict, parseCitations } from './court.js';
import { findCrime } from './engine.js';
import { detectType } from './court-evidence.js';

/* ---------------- Loại tài liệu ---------------- */
export const DOC_KINDS = {
  'cao-trang': 'Cáo trạng',
  'ban-an': 'Bản án',
  'qd-xet-xu': 'Quyết định đưa vụ án ra xét xử',
  'thong-bao-thu-ly': 'Thông báo thụ lý vụ án',
  'khang-cao': 'Đơn kháng cáo',
  'khang-nghi': 'Quyết định kháng nghị',
  'kl-dieu-tra': 'Kết luận điều tra',
  'lenh-tam-giam': 'Lệnh tạm giam',
  'qd-thi-hanh': 'Quyết định thi hành án',
  khac: 'Tài liệu khác',
};
/** Loại tài liệu (chi tiết hơn detectType của kho chứng cứ) theo tiêu đề / đầu văn bản. */
export function detectKind(name = '', text = '') {
  const h = `${name}\n${String(text).slice(0, 1200)}`.normalize('NFC');
  const head = h.slice(0, 600);
  // Tiêu đề văn bản (ở đầu) quyết định loại; bản án, cáo trạng được dẫn trong văn bản khác không làm đổi loại.
  if (/QUYẾT ĐỊNH ĐƯA VỤ ÁN RA XÉT XỬ|^\s*Số\s*:?\s*\d{1,5}\/\d{4}\/QĐXX/mu.test(head) || /^quyết định đưa vụ án ra xét xử/iu.test(name)) return 'qd-xet-xu';
  if (/THÔNG BÁO\s*(?:VỀ )?(?:VIỆC )?THỤ LÝ|^thông báo (?:về việc )?thụ lý/imu.test(head)) return 'thong-bao-thu-ly';
  if (/QUYẾT ĐỊNH KHÁNG NGHỊ|^KHÁNG NGHỊ (?:GIÁM ĐỐC THẨM|PHÚC THẨM|TÁI THẨM)/mu.test(head)) return 'khang-nghi';
  if (/ĐƠN KHÁNG CÁO|^đơn kháng cáo/imu.test(head)) return 'khang-cao';
  if (/LỆNH TẠM GIAM/u.test(head)) return 'lenh-tam-giam';
  if (/QUYẾT ĐỊNH THI HÀNH ÁN/u.test(head)) return 'qd-thi-hanh';
  if (/NHÂN DANH\s+NƯỚC CỘNG HÒA|^\s*(?:Bản án|BẢN ÁN)(?: hình sự| HÌNH SỰ)?(?: sơ thẩm| phúc thẩm| SƠ THẨM| PHÚC THẨM)?\s*(?:số|SỐ)?\s*:|^\s*Số\s*:?\s*\d{1,5}\/\d{4}\/HS-?(?:ST|PT)\b/mu.test(head)) return 'ban-an';
  if (/^\s*CÁO TRẠNG\s*$|^\s*Số\s*:?\s*\d{1,5}\/[^\s]*CT[^\s]*$/mu.test(head)) return 'cao-trang';
  if (/KẾT LUẬN ĐIỀU TRA/u.test(head)) return 'kl-dieu-tra';
  const t = detectType(name, text);
  if (t === 'ban-an' || t === 'cao-trang' || t === 'kl-dieu-tra') return t;
  return 'khac';
}
/** Loại tài liệu của kho chứng cứ tương ứng (để lưu vào danh sách tài liệu của hồ sơ). */
export const sourceTypeOf = (kind) => ({ 'cao-trang': 'cao-trang', 'ban-an': 'ban-an', 'kl-dieu-tra': 'kl-dieu-tra', 'khang-cao': 'don', 'khang-nghi': 'don' }[kind] || 'khac');

/* ---------------- Tiện ích ---------------- */
const NAME = '((?:[A-ZĐÀ-Ỹ][\\p{Ll}\\u0300-\\u036f]*)(?:[ \\t]+[A-ZĐÀ-Ỹ][\\p{Ll}\\u0300-\\u036f]*){1,4})';
// Ngày: "15 tháng 3 năm 2026", "15/3/2026", "15-03-2026", "15.3.2026".
const D = '(?<d>\\d{1,2})\\s*(?:tháng|\\/|-|\\.)\\s*(?<m>\\d{1,2})\\s*(?:năm|\\/|-|\\.)\\s*(?<y>\\d{4})';
const iso = (g) => (g && g.y ? `${g.y}-${String(g.m).padStart(2, '0')}-${String(g.d).padStart(2, '0')}` : '');
const validIso = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return false;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] && +m[1] > 1950 && +m[1] < 2100;
};
const clean = (s) => String(s || '').replace(/\s+/g, ' ').replace(/[;,.:]+$/u, '').trim();
const LOWER = new Set(['tòa', 'án', 'nhân', 'dân', 'khu', 'vực', 'tỉnh', 'thành', 'phố', 'huyện', 'quận', 'thị', 'xã', 'cấp', 'cao', 'tối', 'viện', 'kiểm', 'sát', 'tại', 'và', 'của', 'số', 'phường', 'trấn', 'trung', 'ương', 'quân', 'sự']);
/** "TÒA ÁN NHÂN DÂN KHU VỰC 3 - NINH BÌNH" → "Tòa án nhân dân khu vực 3 - Ninh Bình"; chữ đã có hoa thường thì giữ nguyên. */
export function properCase(s, { first = true } = {}) {
  const t = clean(s);
  if (!t || t !== t.toUpperCase()) return t;
  const words = t.toLowerCase().split(' ');
  return words.map((w, i) => ((i === 0 && first) || (!LOWER.has(w) && /^\p{L}/u.test(w)) ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}
const toaAn = (rest) => (/^Tòa án/iu.test(clean(rest)) ? properCase(rest) : `Tòa án nhân dân ${properCase(rest, { first: false })}`);
const quoteAt = (text, index, len = 0) => {
  const a = Math.max(0, text.lastIndexOf('\n', index) + 1);
  const b0 = text.indexOf('\n', index + len);
  const b = b0 < 0 ? text.length : b0;
  let q = text.slice(a, b).trim();
  if (q.length > 220) {
    const s = Math.max(0, index - a - 90);
    q = `${s > 0 ? '…' : ''}${q.slice(s, s + 220).trim()}…`;
  }
  return q;
};
const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/* ---------------- Luật bắt từng ô ---------------- */
// Mỗi luật: path (ô của hồ sơ), label, group, type ('text'|'date'|'area'|'check'), kinds (ưu tiên loại tài liệu — luật
// vẫn chạy trên mọi tài liệu nhưng giá trị từ loại ưu tiên được chọn trước), re: danh sách regex (thử lần lượt, lấy
// nhóm 1 hoặc nhóm ngày), pick: hàm chuẩn hóa giá trị (tùy chọn).
const r = (src, flags = 'u') => new RegExp(src, flags);
export const FIELD_RULES = [
  // Thụ lý
  { path: 'thuLy.so', label: 'Số thụ lý', group: 'Thụ lý', kinds: ['thong-bao-thu-ly', 'ban-an', 'qd-xet-xu'], re: [r('thụ lý\\s*(?:vụ án\\s*)?(?:hình sự\\s*)?(?:sơ thẩm|phúc thẩm|giám đốc thẩm)?\\s*số\\s*:?\\s*(\\d{1,5}\\/\\d{4}\\/TL[^\\s,;)]*)', 'iu'), r('(\\d{1,5}\\/\\d{4}\\/TL(?:ST|PT|GĐT|GDT)[-–]?HS)')] },
  { path: 'thuLy.ngay', label: 'Ngày thụ lý', group: 'Thụ lý', type: 'date', kinds: ['thong-bao-thu-ly', 'ban-an', 'qd-xet-xu'], re: [r(`thụ lý[^.\\n]{0,80}?\\d{1,5}\\/\\d{4}\\/TL[^\\s,;)]*\\s*,?\\s*ngày\\s+${D}`, 'iu'), r(`(?:đã )?thụ lý (?:vụ án )?[^.\\n]{0,60}?ngày\\s+${D}`, 'iu')] },
  { path: 'cap', label: 'Cấp xét xử', group: 'Thụ lý', type: 'select', kinds: ['thong-bao-thu-ly', 'ban-an', 'qd-xet-xu'], re: [r('\\d{1,5}\\/\\d{4}\\/TL(ST|PT|GĐT|GDT)[-–]?HS')], pick: (v) => ({ ST: 'so-tham', PT: 'phuc-tham', GĐT: 'giam-doc-tham', GDT: 'giam-doc-tham' }[v] || '') },
  // Tòa án
  { path: 'toa.ten', label: 'Tòa án', group: 'Tòa án, Hội đồng xét xử', kinds: ['qd-xet-xu', 'ban-an', 'thong-bao-thu-ly', 'cao-trang'], re: [r('^(?:TÒA ÁN NHÂN DÂN|TOÀ ÁN NHÂN DÂN|Tòa án nhân dân)\\s+((?!TỈNH|THÀNH PHỐ|TỐI CAO|CẤP CAO|tỉnh|thành phố|tối cao|cấp cao)[^\\n]{2,80})$', 'mu'), r('ra trước (Tòa án nhân dân [^\\n]{2,80}?) để xét xử', 'u'), r('^(?:TÒA ÁN NHÂN DÂN|TOÀ ÁN NHÂN DÂN|Tòa án nhân dân)\\s+([^\\n]{2,80})$', 'mu')], pick: (v, m) => toaAn(m[1]) },
  { path: 'toa.capTren', label: 'Tòa án cấp trên', group: 'Tòa án, Hội đồng xét xử', kinds: ['qd-xet-xu', 'ban-an', 'thong-bao-thu-ly'], re: [r('^(?:TÒA ÁN NHÂN DÂN|TOÀ ÁN NHÂN DÂN)\\s+((?:TỈNH|THÀNH PHỐ|CẤP CAO|TỐI CAO)[^\\n]{0,60})\\n\\s*(?:TÒA ÁN NHÂN DÂN|TOÀ ÁN NHÂN DÂN)\\s', 'mu')], pick: (v) => toaAn(v) },
  { path: 'toa.diaDanh', label: 'Địa danh', group: 'Tòa án, Hội đồng xét xử', kinds: ['qd-xet-xu', 'thong-bao-thu-ly', 'ban-an'], re: [r('^\\s*([\\p{Lu}][\\p{L} .]{1,40}?),\\s*ngày\\s+\\d{1,2}\\s+tháng', 'mu')], pick: (v) => properCase(v) },
  { path: 'hdxx.chuToa', label: 'Thẩm phán – Chủ tọa phiên tòa', group: 'Tòa án, Hội đồng xét xử', kinds: ['qd-xet-xu', 'ban-an'], re: [r(`Thẩm phán\\s*[-–]\\s*Chủ tọa phiên tòa\\s*:?\\s*(?:Ông|Bà|ông|bà)?\\s*${NAME}`, 'u'), r(`Chủ tọa phiên tòa\\s*:?\\s*(?:Ông|Bà|ông|bà)?\\s*${NAME}`, 'u'), r(`(?:Ông|Bà|ông|bà)\\s+${NAME}\\s*[-–,]\\s*(?:Thẩm phán\\s*[-–,]?\\s*)?Chủ tọa phiên tòa`, 'u')] },
  { path: 'hdxx.thamPhan', label: 'Các Thẩm phán', group: 'Tòa án, Hội đồng xét xử', type: 'area', kinds: ['qd-xet-xu', 'ban-an'], re: [r('(?:Các )?Thẩm phán\\s*:\\s*([^\\n]{4,200})', 'u')], pick: (v) => namesList(v) },
  { path: 'hdxx.hoiTham', label: 'Hội thẩm nhân dân', group: 'Tòa án, Hội đồng xét xử', type: 'area', kinds: ['qd-xet-xu', 'ban-an'], re: [r('(?:Các )?Hội thẩm nhân dân\\s*:?\\s*((?:(?:Ông|Bà|ông|bà)\\s*[^\\n;]{4,60}[;,\\n]?\\s*){1,3})', 'u')], pick: (v) => namesList(v) },
  { path: 'hdxx.thuKy', label: 'Thư ký phiên tòa', group: 'Tòa án, Hội đồng xét xử', kinds: ['qd-xet-xu', 'ban-an'], re: [r(`Thư ký (?:phiên tòa|Tòa án|ghi biên bản phiên tòa)[^:\\n]{0,40}:\\s*(?:Ông|Bà|ông|bà)?\\s*${NAME}`, 'u'), r(`(?:Ông|Bà|ông|bà)\\s+${NAME}\\s*[-–,]\\s*Thư ký`, 'u')] },
  { path: 'hdxx.kiemSatVien', label: 'Kiểm sát viên', group: 'Tòa án, Hội đồng xét xử', kinds: ['qd-xet-xu', 'ban-an'], re: [r(`Kiểm sát viên\\s*:?\\s*(?:Ông|Bà|ông|bà)?\\s*${NAME}`, 'u'), r(`(?:Ông|Bà|ông|bà)\\s+${NAME}\\s*[-–,]\\s*Kiểm sát viên`, 'u')] },
  { path: 'hdxx.vks', label: 'Viện kiểm sát', group: 'Tòa án, Hội đồng xét xử', kinds: ['cao-trang', 'qd-xet-xu', 'ban-an'], re: [r('^(VIỆN KIỂM SÁT NHÂN DÂN\\s+(?!TỈNH|THÀNH PHỐ|TỐI CAO|CẤP CAO)[^\\n]{2,60})$', 'mu'), r('(Viện kiểm sát nhân dân [^\\n.;,]{2,60}?)(?: tham gia| thực hành| truy tố| giữ quyền|[.;,\\n])', 'u'), r('^(VIỆN KIỂM SÁT NHÂN DÂN\\s+[^\\n]{2,60})$', 'mu')], pick: (v) => properCase(v) },
  // Cáo trạng
  { path: 'caoTrang.so', label: 'Số cáo trạng', group: 'Cáo trạng', kinds: ['cao-trang', 'qd-xet-xu', 'ban-an'], re: [r('[Cc]áo trạng số\\s*:?\\s*(\\d{1,5}\\/[^\\s,;)]*CT[^\\s,;)]*)', 'u'), r('Số\\s*:?\\s*(\\d{1,5}\\/[^\\s,;)]*CT[^\\s,;)]*)', 'u')] },
  { path: 'caoTrang.ngay', label: 'Ngày cáo trạng', group: 'Cáo trạng', type: 'date', kinds: ['cao-trang', 'qd-xet-xu', 'ban-an'], re: [r(`[Cc]áo trạng số\\s*:?\\s*\\d{1,5}\\/[^\\s,;)]*CT[^\\s,;)]*\\s*,?\\s*ngày\\s+${D}`, 'u'), r(`Số\\s*:?\\s*\\d{1,5}\\/[^\\s,;)]*CT[^\\s,;)]*[^\\n]*\\n[^\\n]*?,\\s*ngày\\s+${D}`, 'u')] },
  { path: 'caoTrang.vks', label: 'Viện kiểm sát truy tố', group: 'Cáo trạng', kinds: ['cao-trang', 'qd-xet-xu', 'ban-an'], re: [r('^(VIỆN KIỂM SÁT NHÂN DÂN\\s+(?!TỈNH|THÀNH PHỐ|TỐI CAO|CẤP CAO)[^\\n]{2,60})$', 'mu'), r('[Cc]áo trạng số[^\\n]{0,80}? của (Viện kiểm sát nhân dân [^\\n.;,]{2,60})', 'u')], pick: (v) => properCase(v) },
  // Mốc tố tụng
  { path: 'moc.soQdXetXu', label: 'Số quyết định đưa vụ án ra xét xử', group: 'Mốc tố tụng', kinds: ['qd-xet-xu', 'ban-an'], re: [r('[Qq]uyết định đưa vụ án ra xét xử\\s*(?:sơ thẩm|phúc thẩm)?\\s*số\\s*:?\\s*(\\d{1,5}\\/\\d{4}\\/[^\\s,;)]*)', 'u'), r('Số\\s*:?\\s*(\\d{1,5}\\/\\d{4}\\/QĐ(?:XX)?[^\\s,;)]*)', 'u')] },
  { path: 'moc.ngayQdXetXu', label: 'Ngày quyết định đưa vụ án ra xét xử', group: 'Mốc tố tụng', type: 'date', kinds: ['qd-xet-xu', 'ban-an'], re: [r(`[Qq]uyết định đưa vụ án ra xét xử\\s*(?:sơ thẩm|phúc thẩm)?\\s*số\\s*:?\\s*\\d{1,5}\\/\\d{4}\\/[^\\s,;)]*\\s*,?\\s*ngày\\s+${D}`, 'u'), r(`Số\\s*:?\\s*\\d{1,5}\\/\\d{4}\\/QĐ(?:XX)?[^\\s,;)]*[^\\n]*\\n[^\\n]*?,\\s*ngày\\s+${D}`, 'u')] },
  { path: 'moc.ngayXetXu', label: 'Ngày mở phiên tòa', group: 'Mốc tố tụng', type: 'date', kinds: ['qd-xet-xu', 'ban-an'], re: [r(`(?:mở phiên tòa|đưa (?:vụ án )?ra xét xử|xét xử)[^.\\n]{0,80}?(?:vào\\s+)?(?:lúc|hồi)\\s*\\d{1,2}\\s*(?:giờ|h)[^.\\n]{0,30}?ngày\\s+${D}`, 'iu'), r(`Thời gian (?:mở phiên tòa|xét xử)\\s*:?[^\\n]{0,40}?ngày\\s+${D}`, 'iu'), r(`(?:Trong|Vào) (?:các )?ngày[^\\n]{0,30}?${D}[^\\n]{0,80}?(?:tại trụ sở|Tòa án nhân dân)[^\\n]{0,120}?xét xử`, 'u'), r(`^\\s*Ngày\\s+${D}\\s*,\\s*tại (?:trụ sở )?Tòa án`, 'mu')] },
  { path: 'moc.gioXetXu', label: 'Giờ mở phiên tòa', group: 'Mốc tố tụng', kinds: ['qd-xet-xu'], re: [r('(?:mở phiên tòa|đưa (?:vụ án )?ra xét xử|xét xử)[^.\\n]{0,80}?(?:vào\\s+)?(?:lúc|hồi)\\s*(\\d{1,2}\\s*(?:giờ|h)\\s*(?:\\d{1,2}\\s*(?:phút)?)?)', 'iu'), r('Thời gian (?:mở phiên tòa|xét xử)\\s*:?\\s*(\\d{1,2}\\s*(?:giờ|h)\\s*(?:\\d{1,2}\\s*(?:phút)?)?)', 'iu')], pick: (v) => clean(v).replace(/\s*h\s*/, ' giờ ').replace(/(\d{1,2}) giờ (\d{1,2})\b/, (m, a, b) => `${a.padStart(2, '0')} giờ ${b.padStart(2, '0')}`).replace(/^(\d{1,2}) giờ$/, (m, a) => `${a.padStart(2, '0')} giờ 00`) },
  { path: 'moc.diaDiem', label: 'Địa điểm mở phiên tòa', group: 'Mốc tố tụng', kinds: ['qd-xet-xu', 'ban-an'], re: [r('Địa điểm (?:mở phiên tòa|xét xử)\\s*:?\\s*([^\\n.;]{5,160})', 'iu'), r('(?:mở phiên tòa|xét xử)[^.\\n]{0,120}?tại (trụ sở [^\\n.;]{5,140}?)(?=\\s+(?:xét xử|mở phiên)|[.;\\n]|$)', 'iu'), r('tại (trụ sở Tòa án nhân dân [^\\n.;,]{2,120}?)(?=\\s+(?:xét xử|mở phiên)|[.;,\\n]|$)', 'u')], pick: (v) => clean(v) },
  { path: 'moc.xuKin', label: 'Xét xử kín', group: 'Mốc tố tụng', type: 'check', kinds: ['qd-xet-xu', 'ban-an'], re: [r('(xét xử kín)', 'iu')], pick: () => true },
  { path: 'moc.ngayTuyenAn', label: 'Ngày tuyên án', group: 'Mốc tố tụng', type: 'date', kinds: ['ban-an'], re: [r(`[Tt]uyên án[^.\\n]{0,30}?ngày\\s+${D}`, 'u'), r(`[Ss]ố\\s*:?\\s*\\d{1,5}\\/\\d{4}\\/HS-(?:ST|PT)\\s*\\n?\\s*Ngày\\s*:?\\s*${D}`, 'u'), r(`Bản án (?:hình sự )?(?:sơ thẩm |phúc thẩm )?số\\s*:?\\s*\\d{1,5}\\/\\d{4}\\/HS-(?:ST|PT)\\s*,?\\s*ngày\\s+${D}`, 'u')] },
  { path: 'moc.ngayHanhVi', label: 'Ngày thực hiện hành vi phạm tội', group: 'Mốc tố tụng', type: 'date', conf: 'vua', kinds: ['cao-trang', 'kl-dieu-tra', 'ban-an'], re: [r(`(?:NỘI DUNG VỤ ÁN|Nội dung vụ án|NỘI DUNG SỰ VIỆC|Nội dung sự việc|diễn biến)[^]{0,400}?(?:Khoảng|Vào|Hồi|Lúc)?\\s*(?:\\d{1,2}\\s*(?:giờ|h)[^,\\n]{0,15},?\\s*)?ngày\\s+${D}`, 'u'), r(`(?:Khoảng|Vào|Hồi|Lúc)\\s+(?:\\d{1,2}\\s*(?:giờ|h)[^,\\n]{0,15},?\\s*)?ngày\\s+${D}[^.\\n]{0,160}?(?:đã |thực hiện|chiếm đoạt|dùng|lấy|đánh|đâm|gây|trộm|cướp|bán|mua|vận chuyển|tàng trữ)`, 'u')] },
  // Bản án (sơ thẩm bị kháng cáo / bị kháng nghị, hoặc bản án của chính vụ án)
  { path: 'banAn.so', label: 'Số bản án', group: 'Bản án', kinds: ['ban-an', 'khang-cao', 'khang-nghi', 'qd-thi-hanh'], re: [r('[Bb]ản án (?:hình sự )?(?:sơ thẩm |phúc thẩm )?số\\s*:?\\s*(\\d{1,5}\\/\\d{4}\\/HS-?(?:ST|PT))', 'u'), r('Số\\s*:?\\s*(\\d{1,5}\\/\\d{4}\\/HS-?(?:ST|PT))', 'u')], pick: (v) => v.replace(/\/HS(ST|PT)$/, '/HS-$1') },
  { path: 'banAn.ngay', label: 'Ngày tuyên án (bản án)', group: 'Bản án', kinds: ['ban-an', 'khang-cao', 'khang-nghi', 'qd-thi-hanh'], re: [r(`[Bb]ản án (?:hình sự )?(?:sơ thẩm |phúc thẩm )?số\\s*:?\\s*\\d{1,5}\\/\\d{4}\\/HS-?(?:ST|PT)\\s*,?\\s*ngày\\s+${D}`, 'u'), r(`[Ss]ố\\s*:?\\s*\\d{1,5}\\/\\d{4}\\/HS-?(?:ST|PT)\\s*\\n?\\s*Ngày\\s*:?\\s*${D}`, 'u')], pick: (v, m) => `${String(m.groups.d).padStart(2, '0')}/${String(m.groups.m).padStart(2, '0')}/${m.groups.y}` },
  { path: 'banAn.toa', label: 'Tòa án đã xét xử', group: 'Bản án', kinds: ['khang-cao', 'khang-nghi', 'qd-thi-hanh', 'ban-an'], re: [r('[Bb]ản án (?:hình sự )?(?:sơ thẩm |phúc thẩm )?số\\s*:?\\s*\\d{1,5}\\/\\d{4}\\/HS-?(?:ST|PT)[^\\n]{0,60}? của (Tòa án nhân dân [^\\n.;,]{2,80})', 'u')], pick: (v) => properCase(v) },
  { path: 'banAn.ngayHieuLuc', label: 'Ngày bản án có hiệu lực', group: 'Bản án', type: 'date', kinds: ['khang-nghi', 'qd-thi-hanh'], re: [r(`có hiệu lực pháp luật (?:kể )?từ ngày\\s+${D}`, 'u')] },
  // Phúc thẩm: kháng cáo, kháng nghị
  { path: 'khangCao', label: 'Kháng cáo, kháng nghị', group: 'Bản án', type: 'area', kinds: ['khang-cao', 'ban-an', 'thong-bao-thu-ly'], re: [r('(?:^|\\n)\\s*((?:Ngày\\s+\\d{1,2}[^\\n]{0,40}?)?[^\\n]{0,80}?(?:kháng cáo|kháng nghị)[^\\n]{8,300})', 'iu')], pick: (v, m, text) => khangCaoLines(text) },
  // Giám đốc thẩm
  { path: 'khangNghi.so', label: 'Số quyết định kháng nghị', group: 'Kháng nghị', kinds: ['khang-nghi', 'thong-bao-thu-ly'], re: [r('[Kk]háng nghị (?:giám đốc thẩm )?số\\s*:?\\s*(\\d{1,5}\\/\\d{4}\\/[^\\s,;)]*)', 'u'), r('Số\\s*:?\\s*(\\d{1,5}\\/\\d{4}\\/(?:QĐ-?)?KN[^\\s,;)]*)', 'u')] },
  { path: 'khangNghi.ngay', label: 'Ngày kháng nghị', group: 'Kháng nghị', type: 'date', kinds: ['khang-nghi', 'thong-bao-thu-ly'], re: [r(`[Kk]háng nghị (?:giám đốc thẩm )?số\\s*:?\\s*\\d{1,5}\\/\\d{4}\\/[^\\s,;)]*\\s*,?\\s*ngày\\s+${D}`, 'u'), r(`Số\\s*:?\\s*\\d{1,5}\\/\\d{4}\\/(?:QĐ-?)?KN[^\\s,;)]*[^\\n]*\\n[^\\n]*?,\\s*ngày\\s+${D}`, 'u')] },
  { path: 'khangNghi.nguoi', label: 'Người kháng nghị', group: 'Kháng nghị', type: 'select', kinds: ['khang-nghi'], re: [r('(Chánh án Tòa án nhân dân tối cao|Viện trưởng Viện kiểm sát nhân dân tối cao|Chánh án Tòa án nhân dân cấp cao|Viện trưởng Viện kiểm sát nhân dân cấp cao)', 'u')], pick: (v) => ({ 'Chánh án Tòa án nhân dân tối cao': 'ca-tc', 'Viện trưởng Viện kiểm sát nhân dân tối cao': 'vt-tc', 'Chánh án Tòa án nhân dân cấp cao': 'ca-tinh', 'Viện trưởng Viện kiểm sát nhân dân cấp cao': 'vt-tinh' }[v] || '') },
];

function namesList(v) {
  const names = [...String(v).replace(/(?:^|(?<=\s))(?:Ông|Bà|ông|bà|Anh|Chị|anh|chị)\s+/gu, '').matchAll(new RegExp(NAME, 'gu'))].map((m) => m[1].trim()).filter((n) => !/^(Hội|Thẩm|Các|Ông|Bà|Thư|Kiểm)$/u.test(n.split(' ')[0]));
  return [...new Set(names)].join('\n');
}
function khangCaoLines(text) {
  const out = [];
  for (const s of String(text).split(/(?<=[.;])\s+|\n+/u)) {
    const t = s.trim();
    if (/(kháng cáo|kháng nghị)/iu.test(t) && /(xin|đề nghị|yêu cầu|với nội dung|toàn bộ|một phần|giảm|tăng|hủy|huỷ|sửa|kêu oan|không phạm tội|án treo)/iu.test(t) && t.length >= 20 && t.length <= 400 && !/thời hạn kháng cáo|quyền kháng cáo|được kháng cáo|có thể kháng cáo/iu.test(t)) out.push(t);
    if (out.length >= 6) break;
  }
  return out.join('\n');
}

/* ---------------- Người tham gia tố tụng ---------------- */
const ROLE_LABELS = [
  [/(?:Người )?[Bb]ị hại|Người bị hại|BỊ HẠI/u, 'bi-hai'],
  [/Người bào chữa|Luật sư bào chữa|NGƯỜI BÀO CHỮA/u, 'nguoi-bao-chua'],
  [/Người làm chứng|NGƯỜI LÀM CHỨNG/u, 'nguoi-lam-chung'],
  [/Nguyên đơn dân sự|NGUYÊN ĐƠN DÂN SỰ/u, 'nguyen-don'],
  [/Bị đơn dân sự|BỊ ĐƠN DÂN SỰ/u, 'bi-don'],
  [/Người có quyền lợi,? nghĩa vụ liên quan|NGƯỜI CÓ QUYỀN LỢI,? NGHĨA VỤ LIÊN QUAN/u, 'nqlnvlq'],
  [/Người đại diện (?:hợp pháp|theo pháp luật|theo ủy quyền)?(?: của [^:\n]{2,60})?|NGƯỜI ĐẠI DIỆN[^:\n]{0,60}/u, 'dai-dien'],
  [/Người giám định|NGƯỜI GIÁM ĐỊNH/u, 'giam-dinh'],
  [/Người phiên dịch|NGƯỜI PHIÊN DỊCH/u, 'phien-dich'],
];
const ROLE_ANY = /(?:Người )?[Bb]ị hại|Người bị hại|BỊ HẠI|Người bào chữa|Luật sư bào chữa|NGƯỜI BÀO CHỮA|Người làm chứng|NGƯỜI LÀM CHỨNG|Nguyên đơn dân sự|NGUYÊN ĐƠN DÂN SỰ|Bị đơn dân sự|BỊ ĐƠN DÂN SỰ|Người có quyền lợi,? nghĩa vụ liên quan|NGƯỜI CÓ QUYỀN LỢI|Người đại diện|NGƯỜI ĐẠI DIỆN|Người giám định|NGƯỜI GIÁM ĐỊNH|Người phiên dịch|NGƯỜI PHIÊN DỊCH|Bị cáo|BỊ CÁO|Bị can|BỊ CAN|Người bị kết án|NGƯỜI BỊ KẾT ÁN|Kiểm sát viên|Thư ký|Hội thẩm|Thẩm phán|NHẬN THẤY|NỘI DUNG VỤ ÁN|XÉT THẤY|QUYẾT ĐỊNH|Truy tố/u;
const TITLE = '(?:[Ôô]ng|[Bb]à|[Aa]nh|[Cc]hị|[Cc]háu|[Ee]m|Luật sư|LS\\.?)';

/** Người tham gia tố tụng (ngoài bị cáo) theo các dòng "Bị hại: chị Trần Thị Bình, sinh năm 1980; địa chỉ: …". */
export function parseParticipants(text) {
  const src = String(text || '').replace(/\r/g, '');
  const out = [];
  const seen = new Set();
  for (const [re, vaiTro] of ROLE_LABELS) {
    const lab = new RegExp(`(?:^|\\n|[.;]\\s+)(?:\\d+[.)]\\s*)?(${re.source})[^:\\n]{0,50}:\\s*`, 'gu');
    for (const m of src.matchAll(lab)) {
      const start = m.index + m[0].length;
      const rest = src.slice(start, start + 700);
      const stop = rest.search(new RegExp(`\\n\\s*(?:\\d+[.)]\\s*)?(?:${ROLE_ANY.source})`, 'u'));
      const seg = stop > 0 ? rest.slice(0, stop) : rest.slice(0, 400);
      // Từng người: "1. Ông Nguyễn Văn A, sinh năm…; địa chỉ: …" hoặc "chị Trần Thị Bình, sinh năm 1980".
      const items = seg.split(/\n|;\s*(?=(?:\d+[.)]\s*)?(?:Ông|Bà|Anh|Chị|ông|bà|anh|chị|Luật sư))/u);
      for (const it of items) {
        const nm = new RegExp(`^\\s*(?:\\d+[.)]\\s*)?(?:${TITLE}\\s+)?${NAME}`, 'u').exec(it) || new RegExp(`${TITLE}\\s+${NAME}`, 'u').exec(it);
        if (!nm) continue;
        const hoTen = nm[1].trim();
        if (/^(Sinh|Địa|Nơi|Trú|Đại|Người|Tòa|Viện|Công|Ủy|Uỷ|Bộ|Sở|Phòng|Ban|Cục|Hội|Không|Vắng|Có)\b/u.test(hoTen)) continue;
        const key = `${vaiTro}|${fold(hoTen)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ad = /(?:[Đđ]ịa chỉ|[Tt]rú tại|[Nn]ơi cư trú|[Cc]ư trú tại|[Nn]ơi ở|HKTT|[Tt]hường trú)\s*:?\s*([^;\n]{5,160}?)(?:[;.]\s|\n|$)/u.exec(it);
        out.push({ vaiTro, hoTen, diaChi: ad ? clean(ad[1]) : '', quote: quoteAt(src, start + Math.max(0, seg.indexOf(it)), it.length) });
      }
    }
  }
  return out;
}

/* ---------------- Bị cáo ---------------- */
const nganChanOf = (win) => {
  const tg = /tạm giam (?:từ ngày|kể từ ngày|ngày)\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})/u.exec(win);
  if (tg) return { loai: 'tam-giam', tu: `${tg[3]}-${tg[2].padStart(2, '0')}-${tg[1].padStart(2, '0')}`, den: '' };
  if (/cấm đi khỏi nơi cư trú/iu.test(win)) return { loai: 'cam-di-khoi' };
  if (/bảo lĩnh/iu.test(win)) return { loai: 'bao-linh' };
  if (/tại ngoại/iu.test(win)) return { loai: 'tai-ngoai' };
  return null;
};
/** Bị cáo / bị can / người bị kết án theo khối "Bị cáo: Nguyễn Văn A, sinh năm 1985; nơi cư trú …; bị truy tố về tội …". */
export function parseDefendantBlocks(text) {
  const src = String(text || '').replace(/\r/g, '');
  const out = new Map();
  // Không bắt "Người bào chữa cho bị cáo: Luật sư …", "người đại diện của bị cáo: …" (người khác, không phải bị cáo).
  const lab = new RegExp(`(?:^|\\n|[.;:,]\\s+|\\s)(?<!(?:cho|của|hộ|thay)\\s)(?:\\d+[.)]\\s*)?(?:[Bb]ị cáo|BỊ CÁO|[Bb]ị can|BỊ CAN|[Nn]gười bị kết án|NGƯỜI BỊ KẾT ÁN)\\s*(?:\\(.{0,40}?\\))?\\s*:?\\s*(?:(?<ls>Luật sư|LS\\.?)\\s+|${TITLE}\\s+)?${NAME}`, 'gu');
  for (const m of src.matchAll(lab)) {
    if (m.groups?.ls) continue;
    const hoTen = m[2].trim(); // nhóm 1 là danh xưng "Luật sư" (nếu có), nhóm 2 là họ tên
    if (/^(Sinh|Địa|Nơi|Trú|Đại|Người|Tòa|Viện|Không|Có|Vắng|Bị)\b/u.test(hoTen)) continue;
    const start = m.index + m[0].length;
    const rest = src.slice(start, start + 900);
    const stop = rest.search(new RegExp(`\\n\\s*(?:\\d+[.)]\\s*)?(?:${ROLE_ANY.source})`, 'u'));
    const win = stop > 0 ? rest.slice(0, stop) : rest;
    const d = out.get(fold(hoTen)) || { hoTen, toiDanh: [], tenToi: [] };
    const sn = /sinh (?:ngày\s*(\d{1,2}[/-]\d{1,2}[/-](\d{4}))|năm\s*(\d{4}))/u.exec(win);
    if (sn) {
      d.ngaySinh ||= sn[1] || '';
      d.namSinh ||= sn[2] || sn[3] || '';
    }
    const ct = /(?:[Nn]ơi cư trú|[Nn]ơi ở|[Tt]rú tại|[Đđ]ịa chỉ|[Tt]hường trú|HKTT)\s*:?\s*([^;\n]{5,160}?)(?:;|\.\s|\n|$)/u.exec(win);
    if (ct && !d.noiCuTru) d.noiCuTru = clean(ct[1]);
    const nc = nganChanOf(win);
    if (nc && !d.nganChan) d.nganChan = nc;
    for (const c of parseCitations(win).filter((x) => findCrime(x.dieu))) if (!d.toiDanh.some((x) => x.dieu === c.dieu && x.khoan === c.khoan)) d.toiDanh.push({ dieu: c.dieu, khoan: c.khoan, diem: c.diem });
    for (const t of [...win.matchAll(/(?:về tội|phạm tội|tội)\s*[“"]([^”"]{3,120})[”"]/gu)].map((x) => x[1].trim())) if (!d.tenToi.includes(t)) d.tenToi.push(t);
    d.quote ||= quoteAt(src, m.index + 1, m[0].length);
    out.set(fold(hoTen), d);
  }
  return [...out.values()].map((d) => ({ ...d, tenToi: d.tenToi.join('; ') }));
}

/* ---------------- Chạy trên một tài liệu ---------------- */
function runRules(text, kind, src) {
  const out = [];
  for (const rule of FIELD_RULES) {
    for (const re of rule.re) {
      const m = re.exec(text);
      if (!m) continue;
      let value;
      if (rule.type === 'date') value = iso(m.groups);
      else value = rule.pick ? rule.pick(m[1], m, text) : clean(m[1]);
      if (rule.type === 'date' && !validIso(value)) continue;
      if (value === '' || value == null) continue;
      if (rule.type === 'area' && !String(value).trim()) continue;
      out.push({ path: rule.path, label: rule.label, group: rule.group, type: rule.type || 'text', value, quote: quoteAt(text, m.index, m[0].length), src, kind, conf: rule.conf || 'cao', pref: rule.kinds ? rule.kinds.indexOf(kind) : -1 });
      break;
    }
  }
  return out;
}

/**
 * Bắt thông tin từ nhiều tài liệu: { docs: [{ name, kind }], fields: [...], people: [...], defendants: [...] }.
 * Mỗi ô lấy một giá trị (ưu tiên loại tài liệu phù hợp, rồi độ tin cậy), các giá trị khác thành `alts` để người dùng chọn.
 */
export function extractCase(sources = []) {
  const docs = [];
  const all = [];
  const people = [];
  const defs = new Map();
  const seenP = new Set();
  for (const s of sources) {
    const text = String(s.text || '').replace(/\r/g, '').normalize('NFC');
    if (!text.trim()) continue;
    const kind = s.kind || detectKind(s.name, text);
    docs.push({ name: s.name, kind, label: DOC_KINDS[kind] || DOC_KINDS.khac });
    all.push(...runRules(text, kind, s.name));
    for (const p of parseParticipants(text)) {
      const k = `${p.vaiTro}|${fold(p.hoTen)}`;
      if (seenP.has(k)) continue;
      seenP.add(k);
      people.push({ ...p, src: s.name });
    }
    // Bị cáo: bộ đọc cáo trạng / bản án (đã có) + khối "Bị cáo: …" chung.
    const list = [...(kind === 'cao-trang' ? parseIndictment(text).defendants : []), ...(kind === 'ban-an' ? parseVerdict(text).defendants : []), ...parseDefendantBlocks(text)];
    for (const d of list) {
      if (!d.hoTen) continue;
      const k = fold(d.hoTen);
      const cur = defs.get(k) || { hoTen: d.hoTen, toiDanh: [], src: s.name };
      for (const f of ['namSinh', 'ngaySinh', 'noiCuTru', 'nganChan', 'tenToi', 'hinhPhat', 'quote']) if (d[f] && (cur[f] == null || cur[f] === '' || (typeof cur[f] === 'object' && !Object.keys(cur[f]).length))) cur[f] = d[f];
      for (const f of ['giamNhe', 'tangNang']) if (Array.isArray(d[f]) && d[f].length) cur[f] = [...new Set([...(cur[f] || []), ...d[f]])];
      for (const f of ['giamNheK2', 'dieu54', 'dieu65', 'dieu58']) if (d[f]) cur[f] = true;
      for (const t of d.toiDanh || []) if (t.dieu && !cur.toiDanh.some((x) => x.dieu === t.dieu && x.khoan === t.khoan)) cur.toiDanh.push(t);
      defs.set(k, cur);
    }
  }
  // Gộp theo ô: ưu tiên loại tài liệu phù hợp (pref nhỏ hơn = hợp hơn; -1 = không ưu tiên), rồi độ tin cậy.
  const rank = (f) => (f.pref < 0 ? 99 : f.pref) * 10 + (f.conf === 'cao' ? 0 : 5);
  const byPath = new Map();
  for (const f of all) {
    const cur = byPath.get(f.path);
    if (!cur) byPath.set(f.path, { ...f, alts: [] });
    else if (rank(f) < rank(cur)) byPath.set(f.path, { ...f, alts: [...cur.alts, ...(String(cur.value) !== String(f.value) ? [cur] : [])].filter((a) => String(a.value) !== String(f.value)) });
    else if (String(f.value) !== String(cur.value) && !cur.alts.some((a) => String(a.value) === String(f.value))) cur.alts.push(f);
  }
  const fields = [...byPath.values()];
  const defendants = [...defs.values()];
  // Tên hồ sơ gợi ý: "Tội danh — bị cáo A, B".
  const tenToi = defendants.map((d) => (d.tenToi || '').split(';')[0].trim()).find(Boolean) || (defendants.flatMap((d) => d.toiDanh).map((t) => findCrime(t.dieu)?.ten).find(Boolean) || '');
  if (defendants.length) fields.push({ path: 'ten', label: 'Tên hồ sơ', group: 'Thụ lý', type: 'text', value: `${tenToi || 'Vụ án'} — ${defendants.map((d) => d.hoTen).join(', ')}`, quote: defendants[0].quote || '', src: defendants[0].src, kind: '', conf: 'cao', alts: [] });
  return { docs, fields, people, defendants };
}

/* ---------------- Áp vào hồ sơ ---------------- */
const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, path, v) {
  const ks = path.split('.');
  let cur = o;
  ks.slice(0, -1).forEach((k) => (cur = cur[k] ||= {}));
  cur[ks[ks.length - 1]] = v;
}
const isEmpty = (v) => v == null || v === '' || v === false || (Array.isArray(v) && !v.length);

const DEFAULT_TEN = /^(?:Vụ án (?:sơ|phúc|giám đốc) thẩm mới|Hồ sơ xét xử mới)$/u;
/** Giá trị hiện có trong hồ sơ của một ô (để đối chiếu); tên hồ sơ mặc định coi như trống. */
export const currentValue = (rec, path) => {
  const v = getPath(rec, path);
  return path === 'ten' && DEFAULT_TEN.test(String(v || '')) ? '' : v;
};

/**
 * Điền các mục đã chọn vào hồ sơ. fields: [{ path, value }], people: [...], defendants: [...].
 * overwrite=false: chỉ điền ô đang trống. newDefendant: hàm tạo bị cáo đúng cấu trúc của hồ sơ.
 */
export function applyExtract(rec, { fields = [], people = [], defendants = [] } = {}, { overwrite = false, newDefendant = (x) => ({ hoTen: '', toiDanh: [{ dieu: '', khoan: null, diem: [] }], hinhPhat: {}, ...x }) } = {}) {
  let filled = 0;
  let skipped = 0;
  for (const f of fields) {
    const cur = currentValue(rec, f.path);
    if (!overwrite && !isEmpty(cur) && String(cur) !== String(f.value)) {
      skipped++;
      continue;
    }
    if (String(cur) === String(f.value)) continue;
    setPath(rec, f.path, f.value);
    filled++;
  }
  rec.nguoiThamGia = [...(rec.nguoiThamGia || [])];
  for (const p of people) {
    const old = rec.nguoiThamGia.find((x) => fold(x.hoTen) === fold(p.hoTen) && (x.vaiTro === p.vaiTro || !x.vaiTro));
    if (old) {
      if (!old.vaiTro) old.vaiTro = p.vaiTro;
      if (!old.diaChi && p.diaChi) old.diaChi = p.diaChi;
      continue;
    }
    rec.nguoiThamGia.push({ vaiTro: p.vaiTro, hoTen: p.hoTen, diaChi: p.diaChi || '' });
    filled++;
  }
  if (defendants.length) {
    const list = [...(rec.defendants || [])];
    for (const d of defendants) {
      const i = list.findIndex((x) => x.hoTen && fold(x.hoTen) === fold(d.hoTen));
      const blank = i < 0 ? list.findIndex((x) => !x.hoTen) : -1;
      const old = i >= 0 ? list[i] : blank >= 0 ? list[blank] : null;
      const merged = newDefendant({
        ...(old || {}),
        hoTen: d.hoTen,
        ...(d.namSinh && (overwrite || !old?.namSinh) && { namSinh: d.namSinh }),
        ...(d.ngaySinh && (overwrite || !old?.ngaySinh) && { ngaySinh: d.ngaySinh }),
        ...(d.noiCuTru && (overwrite || !old?.noiCuTru) && { noiCuTru: d.noiCuTru }),
        ...(d.nganChan && (overwrite || !old?.nganChan?.loai) && { nganChan: d.nganChan }),
        ...(d.tenToi && (overwrite || !old?.tenToi) && { tenToi: d.tenToi }),
        ...(d.hinhPhat && Object.keys(d.hinhPhat).length && (overwrite || !old?.hinhPhat?.loai) && { hinhPhat: d.hinhPhat }),
        ...(d.giamNhe?.length && { giamNhe: [...new Set([...(old?.giamNhe || []), ...d.giamNhe])] }),
        ...(d.tangNang?.length && { tangNang: [...new Set([...(old?.tangNang || []), ...d.tangNang])] }),
        ...(d.giamNheK2 && { giamNheK2: true }),
        ...(d.dieu54 && { dieu54: true }),
        ...(d.dieu65 && { dieu65: true }),
        toiDanh: d.toiDanh?.length && (overwrite || !old?.toiDanh?.some((t) => t.dieu)) ? d.toiDanh : old?.toiDanh?.length ? old.toiDanh : [{ dieu: '', khoan: null, diem: [] }],
      });
      if (old) list[i >= 0 ? i : blank] = merged;
      else list.push(merged);
      if (!old || JSON.stringify(old) !== JSON.stringify(merged)) filled++;
    }
    rec.defendants = list;
  }
  return { filled, skipped };
}
