// Biểu mẫu của Tòa án trong vụ án hình sự (sơ thẩm, phúc thẩm): mẫu soạn sẵn tự điền từ hồ sơ xét xử, xuất Word.
// Mỗi biểu mẫu có thể thay bằng mẫu Word của đơn vị (tải lên, lưu riêng từng tài khoản — xem court-tpl-db.js): phần mềm
// nhận diện ô {{Tên trường}} / [Tên trường] / «Tên trường» và các dòng "Nhãn: ……" trong tệp Word rồi điền cùng dữ liệu.
//
// Mẫu soạn sẵn theo bố cục thông dụng của văn bản tố tụng hình sự; điều luật viện dẫn cần đối chiếu văn bản hiện hành.
import { findCrime } from './engine.js';
import { numberToWords } from '../lib/number-words.js';
import { parseIso } from './court-penalty.js';

/* ---------------- Trường dữ liệu ---------------- */
// [key, nhãn hiển thị, kiểu ('text'|'date'|'long'|'lines'), tên ô trong mẫu Word]
const F = [
  ['toaAn', 'Tòa án (tên đầy đủ)', 'text', 'Tòa án'],
  ['toaAnCapTren', 'Tòa án cấp trên (dòng trên tên Tòa, nếu có)', 'text', 'Tòa án cấp trên'],
  ['diaDanh', 'Địa danh', 'text', 'Địa danh'],
  ['ngayVb', 'Ngày văn bản', 'date', 'Ngày văn bản'],
  ['soVb', 'Số văn bản', 'text', 'Số văn bản'],
  ['nguoiKy', 'Người ký', 'text', 'Người ký'],
  ['chucVuKy', 'Chức vụ người ký', 'text', 'Chức vụ người ký'],
  ['chuToa', 'Thẩm phán – Chủ tọa phiên tòa', 'text', 'Chủ tọa'],
  ['thamPhan', 'Các Thẩm phán khác (phúc thẩm, mỗi người một dòng)', 'lines', 'Thẩm phán'],
  ['hoiTham', 'Hội thẩm nhân dân (mỗi người một dòng)', 'lines', 'Hội thẩm'],
  ['thuKy', 'Thư ký phiên tòa', 'text', 'Thư ký'],
  ['kiemSatVien', 'Kiểm sát viên', 'text', 'Kiểm sát viên'],
  ['vks', 'Viện kiểm sát', 'text', 'Viện kiểm sát'],
  ['soThuLy', 'Số thụ lý', 'text', 'Số thụ lý'],
  ['ngayThuLy', 'Ngày thụ lý', 'date', 'Ngày thụ lý'],
  ['caoTrangSo', 'Số cáo trạng', 'text', 'Số cáo trạng'],
  ['caoTrangNgay', 'Ngày cáo trạng', 'date', 'Ngày cáo trạng'],
  ['biCao', 'Bị cáo (họ tên)', 'text', 'Bị cáo'],
  ['biCaoChiTiet', 'Nhân thân bị cáo (mỗi bị cáo một dòng)', 'lines', 'Nhân thân bị cáo'],
  ['toiDanh', 'Tội danh', 'text', 'Tội danh'],
  ['dieuLuat', 'Điều luật (truy tố / áp dụng)', 'text', 'Điều luật'],
  ['biHai', 'Bị hại', 'text', 'Bị hại'],
  ['nguoiThamGia', 'Người tham gia tố tụng khác (mỗi người một dòng)', 'lines', 'Người tham gia tố tụng'],
  ['soQdXetXu', 'Số quyết định đưa vụ án ra xét xử', 'text', 'Số quyết định xét xử'],
  ['ngayQdXetXu', 'Ngày quyết định đưa vụ án ra xét xử', 'date', 'Ngày quyết định xét xử'],
  ['ngayXetXu', 'Ngày mở phiên tòa', 'date', 'Ngày xét xử'],
  ['gioXetXu', 'Giờ mở phiên tòa', 'text', 'Giờ xét xử'],
  ['diaDiemXetXu', 'Địa điểm mở phiên tòa', 'text', 'Địa điểm xét xử'],
  ['hinhThucXetXu', 'Hình thức xét xử', 'text', 'Hình thức xét xử'],
  ['ngayTuyenAn', 'Ngày tuyên án', 'date', 'Ngày tuyên án'],
  ['banAnSo', 'Số bản án', 'text', 'Số bản án'],
  ['banAnNgay', 'Ngày bản án', 'date', 'Ngày bản án'],
  ['banAnToa', 'Tòa án đã xét xử sơ thẩm', 'text', 'Tòa án sơ thẩm'],
  ['khangCao', 'Kháng cáo, kháng nghị', 'long', 'Kháng cáo kháng nghị'],
  ['lyDo', 'Lý do / nội dung cần nêu', 'long', 'Lý do'],
  ['noiDungVuAn', 'Nội dung vụ án', 'long', 'Nội dung vụ án'],
  ['nhanDinh', 'Nhận định của Tòa án', 'long', 'Nhận định'],
  ['quyetDinh', 'Phần quyết định', 'long', 'Quyết định'],
  ['anPhi', 'Án phí', 'long', 'Án phí'],
  ['nguoiTrieuTap', 'Người được triệu tập', 'text', 'Người được triệu tập'],
  ['tuCachTrieuTap', 'Tư cách tham gia tố tụng', 'text', 'Tư cách'],
  ['diaChiTrieuTap', 'Địa chỉ người được triệu tập', 'text', 'Địa chỉ người được triệu tập'],
  ['nguoiBiTamGiam', 'Người bị tạm giam / áp dụng biện pháp', 'text', 'Người bị tạm giam'],
  ['tamGiamTu', 'Tạm giam từ ngày', 'date', 'Tạm giam từ ngày'],
  ['tamGiamDen', 'Tạm giam đến ngày', 'date', 'Tạm giam đến ngày'],
  ['noiTamGiam', 'Nơi tạm giam', 'text', 'Nơi tạm giam'],
  ['bienPhapCu', 'Biện pháp ngăn chặn đang áp dụng', 'text', 'Biện pháp cũ'],
  ['bienPhapMoi', 'Biện pháp thay thế (để trống nếu hủy bỏ)', 'text', 'Biện pháp mới'],
  ['giaHanDen', 'Gia hạn đến ngày', 'date', 'Gia hạn đến ngày'],
  ['hinhPhat', 'Hình phạt đã tuyên', 'long', 'Hình phạt'],
  ['ngayHieuLuc', 'Ngày bản án có hiệu lực pháp luật', 'date', 'Ngày hiệu lực'],
  ['coQuanThiHanh', 'Cơ quan thi hành / giám sát', 'text', 'Cơ quan thi hành'],
  ['noiNhan', 'Nơi nhận (mỗi nơi một dòng)', 'lines', 'Nơi nhận'],
];
export const COURT_FIELDS = F.map(([key, label, kind, tag]) => ({ key, label, kind, tag }));
const FIELD = Object.fromEntries(COURT_FIELDS.map((f) => [f.key, f]));
export const fieldOf = (key) => FIELD[key] || null;

const slug = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
/** Trường dữ liệu ứng với nhãn ô trong mẫu Word ("{{Bị cáo}}", "Họ tên bị cáo: ……"). */
export function matchField(label) {
  const s = slug(label);
  if (!s) return null;
  const exact = COURT_FIELDS.find((f) => slug(f.tag) === s || slug(f.label) === s || f.key.toLowerCase() === s.replace(/ /g, ''));
  if (exact) return exact.key;
  const ALIAS = [
    [/^(ho ten )?bi cao|ho va ten bi cao/, 'biCao'],
    [/nhan than/, 'biCaoChiTiet'],
    [/^toi danh|^ve toi/, 'toiDanh'],
    [/^(dieu luat|can cu dieu)/, 'dieuLuat'],
    [/thu ly so|so thu ly/, 'soThuLy'],
    [/ngay thu ly/, 'ngayThuLy'],
    [/cao trang so|so cao trang/, 'caoTrangSo'],
    [/chu toa|tham phan chu toa/, 'chuToa'],
    [/hoi tham/, 'hoiTham'],
    [/thu ky/, 'thuKy'],
    [/kiem sat vien/, 'kiemSatVien'],
    [/vien kiem sat/, 'vks'],
    [/bi hai/, 'biHai'],
    [/thoi gian mo phien toa|ngay mo phien toa|ngay xet xu/, 'ngayXetXu'],
    [/gio/, 'gioXetXu'],
    [/dia diem/, 'diaDiemXetXu'],
    [/ban an so|so ban an/, 'banAnSo'],
    [/ly do/, 'lyDo'],
    [/^so$|so ky hieu|so van ban/, 'soVb'],
    [/dia danh ngay thang nam/, 'ngayVb'],
    [/noi nhan/, 'noiNhan'],
  ];
  return ALIAS.find(([re]) => re.test(s))?.[1] || null;
}

/* ---------------- Định dạng ---------------- */
const two = (n) => String(n).padStart(2, '0');
export const ngayChu = (iso) => {
  const d = parseIso(iso);
  return d ? `ngày ${two(d.getDate())} tháng ${two(d.getMonth() + 1)} năm ${d.getFullYear()}` : 'ngày …… tháng …… năm ……';
};
export const ngaySo = (iso) => {
  const d = parseIso(iso);
  return d ? `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}` : '……/……/……';
};
const iso = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const up = (s) => String(s || '').toLocaleUpperCase('vi-VN');
/** "08 (tám) năm 06 (sáu) tháng tù" */
export function thoiHanChu(thang) {
  if (thang == null) return '';
  const y = Math.floor(thang / 12);
  const m = thang % 12;
  return [y ? `${two(y)} (${numberToWords(y)}) năm` : '', m ? `${two(m)} (${numberToWords(m)}) tháng` : ''].filter(Boolean).join(' ');
}
const NGAN_CHAN = { 'tam-giam': 'tạm giam', 'cam-di-khoi': 'cấm đi khỏi nơi cư trú', 'bao-linh': 'bảo lĩnh', 'dat-tien': 'đặt tiền để bảo đảm', 'tai-ngoai': 'tại ngoại' };
export const nganChanText = (nc = {}) => (nc.loai === 'tam-giam' ? `bị tạm giam từ ngày ${ngaySo(nc.tu)}${nc.den ? ` đến ngày ${ngaySo(nc.den)}` : ''}` : NGAN_CHAN[nc.loai] ? `đang bị áp dụng biện pháp ${NGAN_CHAN[nc.loai]}` : '');
const citeText = (t) => `${t.diem?.length ? `điểm ${t.diem.join(', ')} ` : ''}${t.khoan ? `khoản ${t.khoan} ` : ''}Điều ${t.dieu}`;
const tenToiOf = (d) => d.tenToi || [...new Set((d.toiDanh || []).map((t) => findCrime(t.dieu)?.ten?.replace(/^Tội\s+/u, '')).filter(Boolean))].map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join('”, “');
export function hinhPhatText(hp = {}) {
  if (hp.loai === 'tu' && hp.thang != null) return `${thoiHanChu(hp.thang)} tù${hp.anTreo ? ` nhưng cho hưởng án treo, thời gian thử thách ${thoiHanChu(hp.thuThach) || '……'} tính từ ngày tuyên án` : ''}`;
  if (hp.loai === 'cai-tao' && hp.thang != null) return `${thoiHanChu(hp.thang)} cải tạo không giam giữ`;
  if (hp.loai === 'chung-than') return 'tù chung thân';
  if (hp.loai === 'tu-hinh') return 'tử hình';
  if (hp.loai === 'phat-tien' && hp.phatTien) return `phạt tiền ${Number(hp.phatTien).toLocaleString('vi-VN')} đồng`;
  return '';
}

/** Phần quyết định của bản án sơ thẩm dựng từ quyết định đã nhập cho từng bị cáo. */
export function quyetDinhText(defendants = []) {
  return defendants
    .filter((d) => d.hoTen)
    .map((d) => {
      const can = [
        ...(d.toiDanh || []).filter((t) => t.dieu).map(citeText),
        d.giamNhe?.length ? `điểm ${d.giamNhe.join(', ')} khoản 1${d.giamNheK2 ? ', khoản 2' : ''} Điều 51` : d.giamNheK2 ? 'khoản 2 Điều 51' : '',
        d.tangNang?.length ? `điểm ${d.tangNang.join(', ')} khoản 1 Điều 52` : '',
        d.dieu54 ? 'Điều 54' : '',
        d.dieu58 ? 'Điều 17, Điều 58' : '',
        d.hinhPhat?.loai === 'tu' ? 'Điều 38' : '',
        d.hinhPhat?.anTreo || d.dieu65 ? 'Điều 65' : '',
      ].filter(Boolean);
      const hp = hinhPhatText(d.hinhPhat);
      const tu = d.hinhPhat?.loai === 'tu' && !d.hinhPhat?.anTreo ? ` Thời hạn tù tính từ ngày ${d.nganChan?.loai === 'tam-giam' && d.nganChan.tu ? `bắt tạm giam ${ngaySo(d.nganChan.tu)}` : 'bị cáo bị bắt đi chấp hành án'}.` : '';
      return [`Tuyên bố bị cáo ${d.hoTen} phạm tội “${tenToiOf(d) || '……'}”.`, `Căn cứ ${can.join('; ') || '……'} của Bộ luật Hình sự.`, `Xử phạt bị cáo ${d.hoTen} ${hp || '……'}.${tu}`].join('\n');
    })
    .join('\n');
}

/** Giá trị tự điền từ hồ sơ xét xử + thông tin Tòa án trong cài đặt (org). */
export function courtValues(rec = {}, { org = {}, now = new Date() } = {}) {
  const h = rec.hdxx || {};
  const m = rec.moc || {};
  const ds = (rec.defendants || []).filter((d) => d.hoTen);
  const toiDanh = [...new Set(ds.map(tenToiOf).filter(Boolean))].join('”, “');
  const dieuLuat = [...new Set(ds.flatMap((d) => (d.toiDanh || []).filter((t) => t.dieu).map(citeText)))].join('; ');
  const ntg = (rec.nguoiThamGia || []).filter((p) => p.hoTen);
  const VT = { 'bi-hai': 'Bị hại', 'nguoi-bao-chua': 'Người bào chữa', 'nguoi-lam-chung': 'Người làm chứng', 'nguyen-don': 'Nguyên đơn dân sự', 'bi-don': 'Bị đơn dân sự', 'nqlnvlq': 'Người có quyền lợi, nghĩa vụ liên quan', 'dai-dien': 'Người đại diện', 'giam-dinh': 'Người giám định', 'phien-dich': 'Người phiên dịch' };
  const tg = ds.find((d) => d.nganChan?.loai === 'tam-giam');
  const pt = rec.cap === 'phuc-tham';
  return {
    toaAn: rec.toa?.ten || org.toaAn || '',
    toaAnCapTren: rec.toa?.capTren ?? org.toaAnCapTren ?? '',
    diaDanh: rec.toa?.diaDanh || org.diaDanh || '',
    ngayVb: iso(now),
    soVb: '',
    nguoiKy: h.chuToa || '',
    chucVuKy: 'THẨM PHÁN',
    chuToa: h.chuToa || '',
    thamPhan: h.thamPhan || '',
    hoiTham: h.hoiTham || '',
    thuKy: h.thuKy || '',
    kiemSatVien: h.kiemSatVien || '',
    vks: h.vks || rec.caoTrang?.vks || '',
    soThuLy: rec.thuLy?.so || '',
    ngayThuLy: rec.thuLy?.ngay || '',
    caoTrangSo: rec.caoTrang?.so || '',
    caoTrangNgay: rec.caoTrang?.ngay || '',
    biCao: ds.map((d) => d.hoTen).join(', '),
    biCaoChiTiet: ds.map((d) => [d.hoTen, d.namSinh && `sinh năm ${d.namSinh}`, d.noiCuTru && `nơi cư trú: ${d.noiCuTru}`, nganChanText(d.nganChan)].filter(Boolean).join('; ') + '.').join('\n'),
    toiDanh,
    dieuLuat: dieuLuat ? `${dieuLuat} Bộ luật Hình sự` : '',
    biHai: ntg.filter((p) => p.vaiTro === 'bi-hai').map((p) => p.hoTen).join(', '),
    nguoiThamGia: ntg.filter((p) => p.vaiTro !== 'bi-hai').map((p) => `${VT[p.vaiTro] || 'Người tham gia tố tụng'}: ${p.hoTen}${p.diaChi ? ` (${p.diaChi})` : ''}`).join('\n'),
    soQdXetXu: m.soQdXetXu || '',
    ngayQdXetXu: m.ngayQdXetXu || '',
    ngayXetXu: m.ngayXetXu || '',
    gioXetXu: m.gioXetXu || '',
    diaDiemXetXu: m.diaDiem || '',
    hinhThucXetXu: m.xuKin ? 'kín' : 'công khai',
    ngayTuyenAn: m.ngayTuyenAn || '',
    banAnSo: rec.banAn?.so || '',
    banAnNgay: rec.banAn?.ngay || '',
    banAnToa: rec.banAn?.toa || '',
    khangCao: rec.khangCao || '',
    lyDo: '',
    noiDungVuAn: '',
    nhanDinh: '',
    quyetDinh: pt ? '' : quyetDinhText(ds),
    anPhi: pt ? '' : `Căn cứ Điều 136 Bộ luật Tố tụng hình sự; Nghị quyết số 326/2016/UBTVQH14 ngày 30/12/2016 của Ủy ban Thường vụ Quốc hội: bị cáo ${ds.map((d) => d.hoTen).join(', ') || '……'} phải chịu ${ds.length > 1 ? 'mỗi bị cáo ' : ''}200.000 đồng án phí hình sự sơ thẩm.`,
    nguoiTrieuTap: '',
    tuCachTrieuTap: '',
    diaChiTrieuTap: '',
    nguoiBiTamGiam: tg ? [tg.hoTen, tg.namSinh && `sinh năm ${tg.namSinh}`, tg.noiCuTru && `nơi cư trú: ${tg.noiCuTru}`].filter(Boolean).join('; ') : '',
    tamGiamTu: tg?.nganChan?.tu || '',
    tamGiamDen: tg?.nganChan?.den || '',
    noiTamGiam: '',
    bienPhapCu: '',
    bienPhapMoi: '',
    giaHanDen: '',
    hinhPhat: ds.map((d) => `${d.hoTen}: ${hinhPhatText(d.hinhPhat) || '……'}`).join('\n'),
    ngayHieuLuc: m.ngayHieuLuc || '',
    coQuanThiHanh: '',
    noiNhan: '',
  };
}

/* ---------------- Dựng văn bản ---------------- */
const run = (text, o = {}) => ({ text, ...o });
const P = (text, o = {}) => ({ runs: Array.isArray(text) ? text : [run(text)], align: 'justify', indent: true, ...o });
const H = (text) => P([run(text, { bold: true })], { align: 'center', indent: false, spaceBefore: true });
const B = (label, text) => P([run(label, { bold: true }), run(text)]);
const dots = (s) => (String(s || '').trim() ? String(s).trim() : '……………………');
const endDot = (l) => (/[.;:!?…]$/.test(l) ? l : `${l}.`);
const multi = (s, prefix = '') => (lines(s).length ? lines(s).map((l) => P(`${prefix}${prefix ? endDot(l) : l}`)) : [P(`${prefix}……………………`)]);
const year = (v) => (parseIso(v.ngayVb) || new Date()).getFullYear();
const so = (v, kh) => `Số: ${v.soVb || `……/${year(v)}/${kh}`}`;
const head = (v, kh, extra = {}) => ({ parent: up(v.toaAnCapTren), org: up(v.toaAn) || 'TÒA ÁN NHÂN DÂN ……', number: so(v, kh), subject: null, placeDate: `${v.diaDanh || '……'}, ${ngayChu(v.ngayVb)}`, ...extra });
const ky = (v, noiNhan, { auth = null, pos = null } = {}) => ({ noiNhan: lines(v.noiNhan).length ? lines(v.noiNhan) : [...noiNhan, 'Lưu hồ sơ vụ án'], authority: auth, position: up(pos || v.chucVuKy || 'THẨM PHÁN'), name: v.nguoiKy || '' });
const doc = (id, v, { kh, title, subject = '', body, sign, signers, authority = null, header = {} }) => ({ typeId: `ct-${id}`, header: head(v, kh, header), title: { name: title, subject }, authority, recipients: null, body, sign: signers ? null : sign, dualSign: null, signers: signers || null });
const hdxxLines = (v, pt) => [
  P(`- Thẩm phán – Chủ tọa phiên tòa: ${dots(v.chuToa)}.`),
  ...(pt ? lines(v.thamPhan).map((x) => P(`- Thẩm phán: ${x}.`)) : []),
  ...(pt && !lines(v.thamPhan).length ? [P('- Các Thẩm phán: ……………………')] : []),
  ...(!pt ? (lines(v.hoiTham).length ? lines(v.hoiTham) : ['……………………']).map((x) => P(`- Hội thẩm nhân dân: ${x}.`)) : []),
  P(`- Thư ký phiên tòa: ${dots(v.thuKy)}.`),
];
const capWords = (s) => s.replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('vi-VN'));
/** "VIỆN KIỂM SÁT NHÂN DÂN TỈNH NINH BÌNH" → "Viện kiểm sát nhân dân tỉnh Ninh Bình" (tên viết thường giữ nguyên). */
export function tenCoQuan(s) {
  const t = String(s || '').trim();
  if (!t || t !== t.toLocaleUpperCase('vi-VN')) return t;
  return t
    .toLocaleLowerCase('vi-VN')
    .split(/\s+-\s+/)
    .map((part, i) => (i ? capWords(part) : part.replace(/(tỉnh|thành phố|huyện|quận|thị xã)\s+(.+)$/u, (_, k, name) => `${k} ${capWords(name)}`)))
    .join(' - ')
    .replace(/^\p{L}/u, (c) => c.toLocaleUpperCase('vi-VN'));
}
const vksTen = (v) => (v.vks ? tenCoQuan(v.vks) : 'Viện kiểm sát ……');
const VKS_NOI = vksTen;
const vuAn = (v) => `vụ án hình sự thụ lý số ${dots(v.soThuLy)} ${ngayChu(v.ngayThuLy)} đối với bị cáo ${dots(v.biCao)}`;
const truyTo = (v) => `bị ${vksTen(v)} truy tố về tội “${dots(v.toiDanh)}” theo ${dots(v.dieuLuat)}${v.caoTrangSo ? ` (Cáo trạng số ${v.caoTrangSo} ${ngayChu(v.caoTrangNgay)})` : ''}`;
const banAnST = (v) => `Bản án hình sự sơ thẩm số ${dots(v.banAnSo)} ${ngayChu(v.banAnNgay)} của ${dots(v.banAnToa)}`;

/**
 * Danh mục biểu mẫu. cap: 'so' (sơ thẩm) | 'pt' (phúc thẩm) | 'tha' (sau xét xử, thi hành án).
 * fields: các trường hiển thị để điền / sửa (ngoài trường chung của phần đầu văn bản).
 */
export const COURT_FORMS = [
  {
    id: 'so-thong-bao-thu-ly', cap: 'so', nhom: 'Thụ lý, chuẩn bị xét xử', ten: 'Thông báo về việc thụ lý vụ án hình sự',
    fields: ['soThuLy', 'ngayThuLy', 'biCao', 'toiDanh', 'dieuLuat', 'caoTrangSo', 'caoTrangNgay', 'vks', 'chuToa'],
    build: (v) => doc('so-thong-bao-thu-ly', v, { kh: 'TB-TA', title: 'THÔNG BÁO', subject: 'Về việc thụ lý vụ án hình sự', body: [
      P([run('Kính gửi: ', { bold: true }), run(`${vksTen(v)}.`)], { indent: false, align: 'center' }),
      P(`${ngayChu(v.ngayThuLy).replace(/^n/, 'N')}, ${v.toaAn || 'Tòa án'} đã thụ lý vụ án hình sự sơ thẩm số ${dots(v.soThuLy)} đối với bị cáo ${dots(v.biCao)}, ${truyTo(v)}.`),
      P(`Thẩm phán được phân công giải quyết vụ án: ${dots(v.chuToa)}.`),
    ], sign: ky(v, ['Như trên', 'Bị cáo']) }),
  },
  {
    id: 'so-qd-xet-xu', cap: 'so', nhom: 'Thụ lý, chuẩn bị xét xử', ten: 'Quyết định đưa vụ án ra xét xử',
    fields: ['soThuLy', 'ngayThuLy', 'biCaoChiTiet', 'toiDanh', 'dieuLuat', 'caoTrangSo', 'caoTrangNgay', 'vks', 'ngayXetXu', 'gioXetXu', 'diaDiemXetXu', 'hinhThucXetXu', 'chuToa', 'hoiTham', 'thuKy', 'kiemSatVien', 'biHai', 'nguoiThamGia'],
    build: (v) => doc('so-qd-xet-xu', v, { kh: 'QĐXXST-HS', title: 'QUYẾT ĐỊNH', subject: 'ĐƯA VỤ ÁN RA XÉT XỬ', authority: up(v.toaAn || 'TÒA ÁN NHÂN DÂN'), body: [
      P('Căn cứ Điều 255 và Điều 277 của Bộ luật Tố tụng hình sự;'),
      P(`Sau khi nghiên cứu hồ sơ vụ án hình sự sơ thẩm thụ lý số ${dots(v.soThuLy)} ${ngayChu(v.ngayThuLy)},`),
      H('QUYẾT ĐỊNH:'),
      P('1. Đưa ra xét xử sơ thẩm vụ án hình sự đối với bị cáo:'),
      ...multi(v.biCaoChiTiet, '- '),
      P(`Bị cáo ${truyTo(v)}.`),
      P(`2. Thời gian mở phiên tòa: ${v.gioXetXu ? `${v.gioXetXu}, ` : ''}${ngayChu(v.ngayXetXu)}.`),
      P(`3. Địa điểm mở phiên tòa: ${dots(v.diaDiemXetXu)}.`),
      P(`4. Vụ án được xét xử ${v.hinhThucXetXu || 'công khai'}.`),
      P('5. Thành phần Hội đồng xét xử và Thư ký phiên tòa:'),
      ...hdxxLines(v, false),
      P(`6. Kiểm sát viên tham gia phiên tòa: ${dots(v.kiemSatVien)} – ${vksTen(v)}.`),
      P('7. Những người được triệu tập đến phiên tòa:'),
      ...(v.biHai ? [P(`- Bị hại: ${v.biHai}.`)] : []),
      ...multi(v.nguoiThamGia, '- '),
      P('8. Vật chứng cần đưa ra xem xét tại phiên tòa (nếu có): ……………………'),
    ], sign: ky(v, [VKS_NOI(v), 'Bị cáo, người bào chữa', 'Người tham gia tố tụng'], { pos: v.chucVuKy === 'THẨM PHÁN' ? 'THẨM PHÁN – CHỦ TỌA PHIÊN TÒA' : v.chucVuKy }) }),
  },
  {
    id: 'so-qd-tra-ho-so', cap: 'so', nhom: 'Thụ lý, chuẩn bị xét xử', ten: 'Quyết định trả hồ sơ để yêu cầu điều tra bổ sung',
    fields: ['soThuLy', 'ngayThuLy', 'biCao', 'toiDanh', 'dieuLuat', 'vks', 'lyDo'],
    build: (v) => doc('so-qd-tra-ho-so', v, { kh: 'HSST-QĐ', title: 'QUYẾT ĐỊNH', subject: 'TRẢ HỒ SƠ ĐỂ YÊU CẦU ĐIỀU TRA BỔ SUNG', authority: up(v.toaAn || 'TÒA ÁN NHÂN DÂN'), body: [
      P('Căn cứ Điều 280 của Bộ luật Tố tụng hình sự;'),
      P(`Sau khi nghiên cứu hồ sơ ${vuAn(v)}, ${truyTo(v)};`),
      P('Xét thấy cần điều tra bổ sung những vấn đề sau đây mà không thể bổ sung tại phiên tòa được:'),
      ...multi(v.lyDo, '- '),
      H('QUYẾT ĐỊNH:'),
      P(`1. Trả hồ sơ vụ án cho ${vksTen(v)} để yêu cầu điều tra bổ sung những vấn đề nêu trên.`),
      P('2. Thời hạn điều tra bổ sung thực hiện theo quy định của Bộ luật Tố tụng hình sự.'),
    ], sign: ky(v, [VKS_NOI(v)]) }),
  },
  {
    id: 'so-qd-tam-dinh-chi', cap: 'so', nhom: 'Thụ lý, chuẩn bị xét xử', ten: 'Quyết định tạm đình chỉ vụ án',
    fields: ['soThuLy', 'ngayThuLy', 'biCao', 'toiDanh', 'dieuLuat', 'vks', 'lyDo'],
    build: (v) => doc('so-qd-tam-dinh-chi', v, { kh: 'HSST-QĐ', title: 'QUYẾT ĐỊNH', subject: 'TẠM ĐÌNH CHỈ VỤ ÁN', authority: up(v.toaAn || 'TÒA ÁN NHÂN DÂN'), body: [
      P('Căn cứ Điều 281 của Bộ luật Tố tụng hình sự;'),
      P(`Xét ${vuAn(v)}, ${truyTo(v)};`),
      P(`Xét thấy: ${dots(v.lyDo)}`),
      H('QUYẾT ĐỊNH:'),
      P(`1. Tạm đình chỉ vụ án hình sự đối với bị cáo ${dots(v.biCao)}.`),
      P('2. Khi lý do tạm đình chỉ không còn, vụ án được phục hồi để giải quyết theo quy định của Bộ luật Tố tụng hình sự.'),
    ], sign: ky(v, [VKS_NOI(v), 'Bị cáo']) }),
  },
  {
    id: 'so-qd-dinh-chi', cap: 'so', nhom: 'Thụ lý, chuẩn bị xét xử', ten: 'Quyết định đình chỉ vụ án',
    fields: ['soThuLy', 'ngayThuLy', 'biCao', 'toiDanh', 'dieuLuat', 'vks', 'lyDo'],
    build: (v) => doc('so-qd-dinh-chi', v, { kh: 'HSST-QĐ', title: 'QUYẾT ĐỊNH', subject: 'ĐÌNH CHỈ VỤ ÁN', authority: up(v.toaAn || 'TÒA ÁN NHÂN DÂN'), body: [
      P('Căn cứ Điều 282 của Bộ luật Tố tụng hình sự;'),
      P(`Xét ${vuAn(v)}, ${truyTo(v)};`),
      P(`Xét thấy: ${dots(v.lyDo)}`),
      H('QUYẾT ĐỊNH:'),
      P(`1. Đình chỉ vụ án hình sự đối với bị cáo ${dots(v.biCao)}.`),
      P('2. Hủy bỏ biện pháp ngăn chặn đã áp dụng đối với bị cáo (nếu có); giải quyết vật chứng theo quy định của pháp luật.'),
      P('3. Quyết định này có thể bị kháng cáo, kháng nghị theo quy định của Bộ luật Tố tụng hình sự.'),
    ], sign: ky(v, [VKS_NOI(v), 'Bị cáo']) }),
  },
  {
    id: 'so-qd-gia-han', cap: 'so', nhom: 'Thụ lý, chuẩn bị xét xử', ten: 'Quyết định gia hạn thời hạn chuẩn bị xét xử',
    fields: ['soThuLy', 'ngayThuLy', 'biCao', 'toiDanh', 'dieuLuat', 'giaHanDen', 'lyDo', 'nguoiKy', 'chucVuKy'],
    build: (v) => doc('so-qd-gia-han', v, { kh: 'HSST-QĐ', title: 'QUYẾT ĐỊNH', subject: 'GIA HẠN THỜI HẠN CHUẨN BỊ XÉT XỬ', authority: `CHÁNH ÁN ${up(v.toaAn || 'TÒA ÁN NHÂN DÂN')}`, body: [
      P('Căn cứ khoản 1 Điều 277 của Bộ luật Tố tụng hình sự;'),
      P(`Xét ${vuAn(v)}, ${truyTo(v)};`),
      P(`Xét thấy vụ án phức tạp: ${dots(v.lyDo)}`),
      H('QUYẾT ĐỊNH:'),
      P(`Gia hạn thời hạn chuẩn bị xét xử vụ án đến ${ngayChu(v.giaHanDen)}.`),
    ], sign: ky(v, [VKS_NOI(v), 'Thẩm phán được phân công'], { pos: v.chucVuKy === 'THẨM PHÁN' ? 'CHÁNH ÁN' : v.chucVuKy }) }),
  },
  {
    id: 'so-lenh-tam-giam', cap: 'so', nhom: 'Biện pháp ngăn chặn', ten: 'Lệnh tạm giam (giai đoạn xét xử sơ thẩm)',
    fields: ['nguoiBiTamGiam', 'toiDanh', 'dieuLuat', 'tamGiamTu', 'tamGiamDen', 'noiTamGiam', 'lyDo', 'nguoiKy', 'chucVuKy'],
    build: (v) => doc('so-lenh-tam-giam', v, { kh: 'HSST-LTG', title: 'LỆNH TẠM GIAM', body: [
      P('Căn cứ Điều 119 và Điều 278 của Bộ luật Tố tụng hình sự;'),
      P(`Xét thấy cần thiết tạm giam bị cáo để bảo đảm việc xét xử: ${dots(v.lyDo)}`),
      P(`Tạm giam: ${dots(v.nguoiBiTamGiam)}.`),
      P(`Bị truy tố về tội “${dots(v.toiDanh)}” theo ${dots(v.dieuLuat)}.`),
      P(`Thời hạn tạm giam: từ ${ngayChu(v.tamGiamTu)} đến ${ngayChu(v.tamGiamDen)}.`),
      P(`Nơi tạm giam: ${dots(v.noiTamGiam)}.`),
      P('Cơ quan, người có thẩm quyền thi hành Lệnh này theo quy định của pháp luật.'),
    ], sign: ky(v, [VKS_NOI(v), 'Nơi tạm giam', 'Bị cáo']) }),
  },
  {
    id: 'so-qd-thay-the-bpnc', cap: 'so', nhom: 'Biện pháp ngăn chặn', ten: 'Quyết định thay thế / hủy bỏ biện pháp ngăn chặn',
    fields: ['nguoiBiTamGiam', 'toiDanh', 'dieuLuat', 'bienPhapCu', 'bienPhapMoi', 'lyDo'],
    build: (v) => doc('so-qd-thay-the-bpnc', v, { kh: 'HSST-QĐ', title: 'QUYẾT ĐỊNH', subject: v.bienPhapMoi ? 'THAY THẾ BIỆN PHÁP NGĂN CHẶN' : 'HỦY BỎ BIỆN PHÁP NGĂN CHẶN', authority: up(v.toaAn || 'TÒA ÁN NHÂN DÂN'), body: [
      P('Căn cứ Điều 125 và Điều 278 của Bộ luật Tố tụng hình sự;'),
      P(`Xét thấy: ${dots(v.lyDo)}`),
      H('QUYẾT ĐỊNH:'),
      P(`1. ${v.bienPhapMoi ? 'Thay thế' : 'Hủy bỏ'} biện pháp ngăn chặn ${dots(v.bienPhapCu)} đối với: ${dots(v.nguoiBiTamGiam)}, bị truy tố về tội “${dots(v.toiDanh)}” theo ${dots(v.dieuLuat)}.`),
      ...(v.bienPhapMoi ? [P(`2. Áp dụng biện pháp ngăn chặn: ${v.bienPhapMoi}.`)] : []),
      P(`${v.bienPhapMoi ? 3 : 2}. Cơ quan, người có thẩm quyền thi hành Quyết định này theo quy định của pháp luật.`),
    ], sign: ky(v, [VKS_NOI(v), 'Bị cáo']) }),
  },
  {
    id: 'so-giay-trieu-tap', cap: 'so', nhom: 'Thụ lý, chuẩn bị xét xử', ten: 'Giấy triệu tập',
    fields: ['nguoiTrieuTap', 'tuCachTrieuTap', 'diaChiTrieuTap', 'biCao', 'toiDanh', 'ngayXetXu', 'gioXetXu', 'diaDiemXetXu'],
    build: (v) => doc('so-giay-trieu-tap', v, { kh: 'GTT-TA', title: 'GIẤY TRIỆU TẬP', body: [
      P(`${v.toaAn || 'Tòa án'} triệu tập: ${dots(v.nguoiTrieuTap)}.`),
      P(`Địa chỉ: ${dots(v.diaChiTrieuTap)}.`),
      P(`Tư cách tham gia tố tụng: ${dots(v.tuCachTrieuTap)} trong vụ án hình sự đối với bị cáo ${dots(v.biCao)} về tội “${dots(v.toiDanh)}”.`),
      P(`Có mặt lúc ${dots(v.gioXetXu)}, ${ngayChu(v.ngayXetXu)} tại ${dots(v.diaDiemXetXu)} để tham gia phiên tòa.`),
      P('Khi đến mang theo Giấy triệu tập này và giấy tờ tùy thân. Trường hợp vắng mặt phải có lý do chính đáng.'),
    ], sign: ky(v, ['Người được triệu tập']) }),
  },
  {
    id: 'so-qd-hoan', cap: 'so', nhom: 'Phiên tòa', ten: 'Quyết định hoãn phiên tòa',
    fields: ['soThuLy', 'ngayThuLy', 'biCao', 'toiDanh', 'dieuLuat', 'vks', 'chuToa', 'hoiTham', 'thuKy', 'kiemSatVien', 'lyDo'],
    build: (v) => doc('so-qd-hoan', v, { kh: 'HSST-QĐ', title: 'QUYẾT ĐỊNH', subject: 'HOÃN PHIÊN TÒA', authority: up(v.toaAn || 'TÒA ÁN NHÂN DÂN'), body: [
      P('Với Hội đồng xét xử sơ thẩm gồm có:'),
      ...hdxxLines(v, false),
      P(`Đại diện ${vksTen(v)} tham gia phiên tòa: ${dots(v.kiemSatVien)} – Kiểm sát viên.`),
      P('Căn cứ Điều 297 của Bộ luật Tố tụng hình sự;'),
      P(`Xét ${vuAn(v)}, ${truyTo(v)};`),
      P(`Xét thấy: ${dots(v.lyDo)}`),
      H('QUYẾT ĐỊNH:'),
      P(`1. Hoãn phiên tòa xét xử sơ thẩm vụ án hình sự đối với bị cáo ${dots(v.biCao)}.`),
      P('2. Thời gian, địa điểm mở lại phiên tòa: ……………………'),
    ], sign: ky(v, [VKS_NOI(v), 'Người tham gia tố tụng'], { auth: 'TM. HỘI ĐỒNG XÉT XỬ', pos: 'THẨM PHÁN – CHỦ TỌA PHIÊN TÒA' }) }),
  },
  {
    id: 'so-bien-ban-phien-toa', cap: 'so', nhom: 'Phiên tòa', ten: 'Biên bản phiên tòa sơ thẩm',
    fields: ['soThuLy', 'ngayThuLy', 'soQdXetXu', 'ngayQdXetXu', 'biCaoChiTiet', 'toiDanh', 'dieuLuat', 'ngayXetXu', 'gioXetXu', 'diaDiemXetXu', 'chuToa', 'hoiTham', 'thuKy', 'kiemSatVien', 'vks', 'biHai', 'nguoiThamGia'],
    build: (v) => doc('so-bien-ban-phien-toa', v, { kh: 'BB-HSST', title: 'BIÊN BẢN PHIÊN TÒA', subject: 'XÉT XỬ SƠ THẨM VỤ ÁN HÌNH SỰ', header: { number: `Thụ lý số: ${dots(v.soThuLy)}` }, body: [
      P(`Vào hồi ${dots(v.gioXetXu)}, ${ngayChu(v.ngayXetXu)}, tại ${dots(v.diaDiemXetXu)}, ${v.toaAn || 'Tòa án'} mở phiên tòa xét xử sơ thẩm ${v.hinhThucXetXu || 'công khai'} ${vuAn(v)}, theo Quyết định đưa vụ án ra xét xử số ${dots(v.soQdXetXu)} ${ngayChu(v.ngayQdXetXu)}.`),
      B('I. NHỮNG NGƯỜI TIẾN HÀNH TỐ TỤNG', ''),
      ...hdxxLines(v, false),
      P(`- Kiểm sát viên: ${dots(v.kiemSatVien)} – ${vksTen(v)}.`),
      B('II. NHỮNG NGƯỜI THAM GIA TỐ TỤNG', ''),
      ...multi(v.biCaoChiTiet, '- Bị cáo: '),
      ...(v.biHai ? [P(`- Bị hại: ${v.biHai}.`)] : []),
      ...lines(v.nguoiThamGia).map((x) => P(`- ${x}.`)),
      B('III. PHẦN THỦ TỤC BẮT ĐẦU PHIÊN TÒA', ''),
      P('……………………'),
      B('IV. PHẦN TRANH TỤNG TẠI PHIÊN TÒA (xét hỏi, tranh luận)', ''),
      P(`Kiểm sát viên công bố bản cáo trạng: bị cáo ${truyTo(v)}.`),
      P('……………………'),
      B('V. BỊ CÁO NÓI LỜI SAU CÙNG', ''),
      P('……………………'),
      B('VI. NGHỊ ÁN VÀ TUYÊN ÁN', ''),
      P('……………………'),
      P(`Phiên tòa kết thúc vào hồi …… giờ …… phút cùng ngày. Biên bản được lập theo Điều 258 của Bộ luật Tố tụng hình sự.`),
    ], signers: [{ title: 'THƯ KÝ PHIÊN TÒA', name: v.thuKy }, { title: 'THẨM PHÁN – CHỦ TỌA PHIÊN TÒA', name: v.chuToa }] }),
  },
  {
    id: 'so-bien-ban-nghi-an', cap: 'so', nhom: 'Phiên tòa', ten: 'Biên bản nghị án',
    fields: ['soThuLy', 'ngayThuLy', 'biCao', 'toiDanh', 'dieuLuat', 'ngayXetXu', 'chuToa', 'hoiTham', 'quyetDinh'],
    build: (v) => doc('so-bien-ban-nghi-an', v, { kh: 'BBNA-HSST', title: 'BIÊN BẢN NGHỊ ÁN', header: { number: `Thụ lý số: ${dots(v.soThuLy)}` }, body: [
      P('Căn cứ Điều 326 của Bộ luật Tố tụng hình sự;'),
      P(`Vào hồi …… giờ …… phút, ${ngayChu(v.ngayXetXu)}, tại phòng nghị án ${v.toaAn || 'Tòa án'}, Hội đồng xét xử gồm:`),
      P(`- Thẩm phán – Chủ tọa phiên tòa: ${dots(v.chuToa)}.`),
      ...(lines(v.hoiTham).length ? lines(v.hoiTham) : ['……………………']).map((x) => P(`- Hội thẩm nhân dân: ${x}.`)),
      P(`Tiến hành nghị án ${vuAn(v)}, ${truyTo(v)}.`),
      P('Hội đồng xét xử đã thảo luận và biểu quyết từng vấn đề theo đa số như sau:'),
      ...multi(v.quyetDinh),
      P('Ý kiến khác (nếu có): ……………………'),
      P('Việc nghị án kết thúc vào hồi …… giờ …… phút cùng ngày.'),
    ], signers: [{ title: 'THẨM PHÁN – CHỦ TỌA PHIÊN TÒA', name: v.chuToa }, ...(lines(v.hoiTham).length ? lines(v.hoiTham) : ['', '']).map((x) => ({ title: 'HỘI THẨM NHÂN DÂN', name: x }))] }),
  },
  {
    id: 'so-ban-an', cap: 'so', nhom: 'Bản án', ten: 'Bản án hình sự sơ thẩm',
    fields: ['banAnSo', 'ngayTuyenAn', 'soThuLy', 'ngayThuLy', 'soQdXetXu', 'ngayQdXetXu', 'chuToa', 'hoiTham', 'thuKy', 'kiemSatVien', 'vks', 'ngayXetXu', 'diaDiemXetXu', 'biCaoChiTiet', 'toiDanh', 'dieuLuat', 'biHai', 'nguoiThamGia', 'noiDungVuAn', 'nhanDinh', 'quyetDinh', 'anPhi'],
    build: (v) => doc('so-ban-an', v, { kh: 'HS-ST', title: 'NHÂN DANH NƯỚC CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', subject: up(v.toaAn || 'TÒA ÁN NHÂN DÂN'), header: { number: `Bản án số: ${v.banAnSo || `……/${year(v)}/HS-ST`}`, subject: `Ngày: ${ngaySo(v.ngayTuyenAn)}`, placeDate: '' }, body: [
      P('- Thành phần Hội đồng xét xử sơ thẩm gồm có:', { indent: false }),
      P(`Thẩm phán – Chủ tọa phiên tòa: ${dots(v.chuToa)}.`),
      P(`Các Hội thẩm nhân dân: ${lines(v.hoiTham).join(', ') || '……………………'}.`),
      P(`- Thư ký phiên tòa: ${dots(v.thuKy)}.`, { indent: false }),
      P(`- Đại diện ${vksTen(v)} tham gia phiên tòa: ${dots(v.kiemSatVien)} – Kiểm sát viên.`, { indent: false }),
      P(`${ngayChu(v.ngayXetXu).replace(/^n/, 'N')}, tại ${dots(v.diaDiemXetXu)}, xét xử sơ thẩm ${v.hinhThucXetXu || 'công khai'} vụ án hình sự thụ lý số ${dots(v.soThuLy)} ${ngayChu(v.ngayThuLy)} theo Quyết định đưa vụ án ra xét xử số ${dots(v.soQdXetXu)} ${ngayChu(v.ngayQdXetXu)} đối với bị cáo:`),
      ...multi(v.biCaoChiTiet, '- '),
      ...(v.biHai ? [P(`- Bị hại: ${v.biHai}.`)] : []),
      ...lines(v.nguoiThamGia).map((x) => P(`- ${x}.`)),
      H('NỘI DUNG VỤ ÁN:'),
      ...multi(v.noiDungVuAn),
      H('NHẬN ĐỊNH CỦA TÒA ÁN:'),
      ...multi(v.nhanDinh),
      P([run('Vì các lẽ trên,', { italic: true })], { indent: false, spaceBefore: true }),
      H('QUYẾT ĐỊNH:'),
      ...multi(v.quyetDinh),
      ...(v.anPhi ? [B('Về án phí: ', v.anPhi.replace(/^Về án phí:\s*/u, ''))] : []),
      P('Bị cáo, bị hại có mặt tại phiên tòa có quyền kháng cáo bản án trong thời hạn 15 ngày kể từ ngày tuyên án; người vắng mặt có quyền kháng cáo trong thời hạn 15 ngày kể từ ngày nhận được bản án hoặc bản án được niêm yết.'),
    ], sign: { noiNhan: lines(v.noiNhan).length ? lines(v.noiNhan) : [VKS_NOI(v), 'Bị cáo, bị hại', 'Cơ quan thi hành án', 'Lưu hồ sơ vụ án'], authority: 'TM. HỘI ĐỒNG XÉT XỬ SƠ THẨM', position: 'THẨM PHÁN – CHỦ TỌA PHIÊN TÒA', name: v.chuToa || '' } }),
  },
  {
    id: 'so-lenh-bat-tam-giam', cap: 'so', nhom: 'Biện pháp ngăn chặn', ten: 'Lệnh bắt tạm giam bị cáo sau khi tuyên án',
    fields: ['nguoiBiTamGiam', 'toiDanh', 'dieuLuat', 'hinhPhat', 'ngayTuyenAn', 'noiTamGiam'],
    build: (v) => doc('so-lenh-bat-tam-giam', v, { kh: 'HSST-LBTG', title: 'LỆNH BẮT TẠM GIAM', body: [
      P('Căn cứ Điều 329 của Bộ luật Tố tụng hình sự;'),
      P(`Căn cứ bản án hình sự sơ thẩm tuyên ${ngayChu(v.ngayTuyenAn)} đối với bị cáo về tội “${dots(v.toiDanh)}” theo ${dots(v.dieuLuat)};`),
      P(`Hình phạt đã tuyên: ${lines(v.hinhPhat).join('; ') || '……………………'}.`),
      P(`Bắt tạm giam: ${dots(v.nguoiBiTamGiam)}.`),
      P(`Thời hạn tạm giam: 45 ngày kể từ ${ngayChu(v.ngayTuyenAn)}.`),
      P(`Nơi tạm giam: ${dots(v.noiTamGiam)}.`),
    ], sign: ky(v, [VKS_NOI(v), 'Nơi tạm giam', 'Bị cáo'], { auth: 'TM. HỘI ĐỒNG XÉT XỬ', pos: 'THẨM PHÁN – CHỦ TỌA PHIÊN TÒA' }) }),
  },
  {
    id: 'so-thong-bao-khang-cao', cap: 'so', nhom: 'Sau xét xử', ten: 'Thông báo về việc kháng cáo, kháng nghị',
    fields: ['banAnSo', 'banAnNgay', 'biCao', 'toiDanh', 'khangCao', 'vks'],
    build: (v) => doc('so-thong-bao-khang-cao', v, { kh: 'TB-TA', title: 'THÔNG BÁO', subject: 'Về việc kháng cáo, kháng nghị', body: [
      P([run('Kính gửi: ', { bold: true }), run(`${vksTen(v)} và những người tham gia tố tụng có liên quan.`)], { indent: false }),
      P(`${v.toaAn || 'Tòa án'} đã nhận được kháng cáo, kháng nghị đối với Bản án hình sự sơ thẩm số ${dots(v.banAnSo)} ${ngayChu(v.banAnNgay)} xét xử bị cáo ${dots(v.biCao)} về tội “${dots(v.toiDanh)}”:`),
      ...multi(v.khangCao, '- '),
      P('Những người được thông báo có quyền gửi văn bản nêu ý kiến của mình về nội dung kháng cáo, kháng nghị cho Tòa án cấp phúc thẩm theo quy định của Bộ luật Tố tụng hình sự.'),
    ], sign: ky(v, ['Như trên']) }),
  },
  {
    id: 'tha-qd-thi-hanh-tu', cap: 'tha', nhom: 'Thi hành án', ten: 'Quyết định thi hành án phạt tù',
    fields: ['banAnSo', 'banAnNgay', 'banAnToa', 'ngayHieuLuc', 'biCaoChiTiet', 'toiDanh', 'hinhPhat', 'coQuanThiHanh', 'nguoiKy', 'chucVuKy'],
    build: (v) => doc('tha-qd-thi-hanh-tu', v, { kh: 'QĐ-CA', title: 'QUYẾT ĐỊNH', subject: 'THI HÀNH ÁN HÌNH SỰ', authority: `CHÁNH ÁN ${up(v.toaAn || 'TÒA ÁN NHÂN DÂN')}`, body: [
      P('Căn cứ Điều 364 của Bộ luật Tố tụng hình sự;'),
      P('Căn cứ Luật Thi hành án hình sự;'),
      P(`Căn cứ Bản án hình sự số ${dots(v.banAnSo)} ${ngayChu(v.banAnNgay)} của ${v.banAnToa || v.toaAn || '……'}, có hiệu lực pháp luật ${ngayChu(v.ngayHieuLuc)},`),
      H('QUYẾT ĐỊNH:'),
      P('1. Thi hành hình phạt tù đối với người bị kết án:'),
      ...multi(v.biCaoChiTiet, '- '),
      P(`Về tội “${dots(v.toiDanh)}”; hình phạt: ${lines(v.hinhPhat).join('; ') || '……………………'}.`),
      P(`2. ${dots(v.coQuanThiHanh)} có trách nhiệm thi hành Quyết định này.`),
    ], sign: ky(v, [VKS_NOI(v), 'Cơ quan thi hành án hình sự', 'Người bị kết án'], { pos: v.chucVuKy === 'THẨM PHÁN' ? 'CHÁNH ÁN' : v.chucVuKy }) }),
  },
  {
    id: 'tha-qd-thi-hanh-an-treo', cap: 'tha', nhom: 'Thi hành án', ten: 'Quyết định thi hành án treo / cải tạo không giam giữ',
    fields: ['banAnSo', 'banAnNgay', 'banAnToa', 'ngayHieuLuc', 'biCaoChiTiet', 'toiDanh', 'hinhPhat', 'coQuanThiHanh', 'nguoiKy', 'chucVuKy'],
    build: (v) => doc('tha-qd-thi-hanh-an-treo', v, { kh: 'QĐ-CA', title: 'QUYẾT ĐỊNH', subject: 'THI HÀNH ÁN HÌNH SỰ', authority: `CHÁNH ÁN ${up(v.toaAn || 'TÒA ÁN NHÂN DÂN')}`, body: [
      P('Căn cứ Điều 364 của Bộ luật Tố tụng hình sự;'),
      P('Căn cứ Luật Thi hành án hình sự;'),
      P(`Căn cứ Bản án hình sự số ${dots(v.banAnSo)} ${ngayChu(v.banAnNgay)} của ${v.banAnToa || v.toaAn || '……'}, có hiệu lực pháp luật ${ngayChu(v.ngayHieuLuc)},`),
      H('QUYẾT ĐỊNH:'),
      P('1. Thi hành hình phạt đối với người bị kết án:'),
      ...multi(v.biCaoChiTiet, '- '),
      P(`Về tội “${dots(v.toiDanh)}”; hình phạt: ${lines(v.hinhPhat).join('; ') || '……………………'}.`),
      P(`2. Giao người bị kết án cho ${dots(v.coQuanThiHanh)} giám sát, giáo dục trong thời gian chấp hành án / thời gian thử thách.`),
    ], sign: ky(v, [VKS_NOI(v), 'Cơ quan thi hành án hình sự', 'Người bị kết án'], { pos: v.chucVuKy === 'THẨM PHÁN' ? 'CHÁNH ÁN' : v.chucVuKy }) }),
  },
  /* ----- Phúc thẩm ----- */
  {
    id: 'pt-thong-bao-thu-ly', cap: 'pt', nhom: 'Thụ lý, chuẩn bị xét xử phúc thẩm', ten: 'Thông báo về việc thụ lý vụ án phúc thẩm',
    fields: ['soThuLy', 'ngayThuLy', 'banAnSo', 'banAnNgay', 'banAnToa', 'biCao', 'toiDanh', 'khangCao', 'vks', 'chuToa'],
    build: (v) => doc('pt-thong-bao-thu-ly', v, { kh: 'TB-TA', title: 'THÔNG BÁO', subject: 'Về việc thụ lý vụ án hình sự phúc thẩm', body: [
      P([run('Kính gửi: ', { bold: true }), run(`${vksTen(v)} và những người tham gia tố tụng có liên quan.`)], { indent: false }),
      P(`${ngayChu(v.ngayThuLy).replace(/^n/, 'N')}, ${v.toaAn || 'Tòa án'} đã thụ lý vụ án hình sự phúc thẩm số ${dots(v.soThuLy)} đối với bị cáo ${dots(v.biCao)} về tội “${dots(v.toiDanh)}”, do có kháng cáo, kháng nghị đối với ${banAnST(v)}:`),
      ...multi(v.khangCao, '- '),
      P(`Thẩm phán được phân công chủ tọa phiên tòa: ${dots(v.chuToa)}.`),
    ], sign: ky(v, ['Như trên']) }),
  },
  {
    id: 'pt-qd-xet-xu', cap: 'pt', nhom: 'Thụ lý, chuẩn bị xét xử phúc thẩm', ten: 'Quyết định đưa vụ án ra xét xử phúc thẩm',
    fields: ['soThuLy', 'ngayThuLy', 'banAnSo', 'banAnNgay', 'banAnToa', 'biCaoChiTiet', 'toiDanh', 'dieuLuat', 'khangCao', 'ngayXetXu', 'gioXetXu', 'diaDiemXetXu', 'hinhThucXetXu', 'chuToa', 'thamPhan', 'thuKy', 'kiemSatVien', 'vks', 'biHai', 'nguoiThamGia'],
    build: (v) => doc('pt-qd-xet-xu', v, { kh: 'QĐXXPT-HS', title: 'QUYẾT ĐỊNH', subject: 'ĐƯA VỤ ÁN RA XÉT XỬ PHÚC THẨM', authority: up(v.toaAn || 'TÒA ÁN NHÂN DÂN'), body: [
      P('Căn cứ Bộ luật Tố tụng hình sự;'),
      P(`Sau khi nghiên cứu hồ sơ vụ án hình sự phúc thẩm thụ lý số ${dots(v.soThuLy)} ${ngayChu(v.ngayThuLy)} do có kháng cáo, kháng nghị đối với ${banAnST(v)},`),
      H('QUYẾT ĐỊNH:'),
      P('1. Đưa ra xét xử phúc thẩm vụ án hình sự đối với bị cáo:'),
      ...multi(v.biCaoChiTiet, '- '),
      P(`Bị xét xử sơ thẩm về tội “${dots(v.toiDanh)}” theo ${dots(v.dieuLuat)}.`),
      P('2. Kháng cáo, kháng nghị:'),
      ...multi(v.khangCao, '- '),
      P(`3. Thời gian mở phiên tòa: ${v.gioXetXu ? `${v.gioXetXu}, ` : ''}${ngayChu(v.ngayXetXu)}.`),
      P(`4. Địa điểm mở phiên tòa: ${dots(v.diaDiemXetXu)}.`),
      P(`5. Vụ án được xét xử ${v.hinhThucXetXu || 'công khai'}.`),
      P('6. Thành phần Hội đồng xét xử phúc thẩm và Thư ký phiên tòa:'),
      ...hdxxLines(v, true),
      P(`7. Kiểm sát viên tham gia phiên tòa: ${dots(v.kiemSatVien)} – ${vksTen(v)}.`),
      P('8. Những người được triệu tập đến phiên tòa:'),
      ...(v.biHai ? [P(`- Bị hại: ${v.biHai}.`)] : []),
      ...multi(v.nguoiThamGia, '- '),
    ], sign: ky(v, [VKS_NOI(v), 'Người kháng cáo, bị cáo', 'Người tham gia tố tụng'], { pos: v.chucVuKy === 'THẨM PHÁN' ? 'THẨM PHÁN – CHỦ TỌA PHIÊN TÒA' : v.chucVuKy }) }),
  },
  {
    id: 'pt-qd-hoan', cap: 'pt', nhom: 'Phiên tòa phúc thẩm', ten: 'Quyết định hoãn phiên tòa phúc thẩm',
    fields: ['soThuLy', 'ngayThuLy', 'banAnSo', 'banAnNgay', 'banAnToa', 'biCao', 'chuToa', 'thamPhan', 'thuKy', 'kiemSatVien', 'vks', 'lyDo'],
    build: (v) => doc('pt-qd-hoan', v, { kh: 'HSPT-QĐ', title: 'QUYẾT ĐỊNH', subject: 'HOÃN PHIÊN TÒA PHÚC THẨM', authority: up(v.toaAn || 'TÒA ÁN NHÂN DÂN'), body: [
      P('Với Hội đồng xét xử phúc thẩm gồm có:'),
      ...hdxxLines(v, true),
      P(`Đại diện ${vksTen(v)} tham gia phiên tòa: ${dots(v.kiemSatVien)} – Kiểm sát viên.`),
      P('Căn cứ Bộ luật Tố tụng hình sự;'),
      P(`Xét vụ án hình sự phúc thẩm thụ lý số ${dots(v.soThuLy)} ${ngayChu(v.ngayThuLy)} đối với bị cáo ${dots(v.biCao)}, do có kháng cáo, kháng nghị đối với ${banAnST(v)};`),
      P(`Xét thấy: ${dots(v.lyDo)}`),
      H('QUYẾT ĐỊNH:'),
      P(`1. Hoãn phiên tòa xét xử phúc thẩm vụ án hình sự đối với bị cáo ${dots(v.biCao)}.`),
      P('2. Thời gian, địa điểm mở lại phiên tòa: ……………………'),
    ], sign: ky(v, [VKS_NOI(v), 'Người tham gia tố tụng'], { auth: 'TM. HỘI ĐỒNG XÉT XỬ', pos: 'THẨM PHÁN – CHỦ TỌA PHIÊN TÒA' }) }),
  },
  {
    id: 'pt-qd-dinh-chi', cap: 'pt', nhom: 'Thụ lý, chuẩn bị xét xử phúc thẩm', ten: 'Quyết định đình chỉ xét xử phúc thẩm',
    fields: ['soThuLy', 'ngayThuLy', 'banAnSo', 'banAnNgay', 'banAnToa', 'biCao', 'khangCao', 'lyDo'],
    build: (v) => doc('pt-qd-dinh-chi', v, { kh: 'HSPT-QĐ', title: 'QUYẾT ĐỊNH', subject: 'ĐÌNH CHỈ XÉT XỬ PHÚC THẨM', authority: up(v.toaAn || 'TÒA ÁN NHÂN DÂN'), body: [
      P('Căn cứ Bộ luật Tố tụng hình sự;'),
      P(`Xét vụ án hình sự phúc thẩm thụ lý số ${dots(v.soThuLy)} ${ngayChu(v.ngayThuLy)} đối với bị cáo ${dots(v.biCao)}, do có kháng cáo, kháng nghị đối với ${banAnST(v)}:`),
      ...multi(v.khangCao, '- '),
      P(`Xét thấy: ${dots(v.lyDo)}`),
      H('QUYẾT ĐỊNH:'),
      P(`1. Đình chỉ xét xử phúc thẩm vụ án hình sự đối với bị cáo ${dots(v.biCao)}.`),
      P(`2. ${banAnST(v)} có hiệu lực pháp luật kể từ ngày ra quyết định này (đối với phần bị kháng cáo, kháng nghị đã rút).`),
    ], sign: ky(v, [VKS_NOI(v), 'Tòa án đã xét xử sơ thẩm', 'Người tham gia tố tụng'], { pos: v.chucVuKy === 'THẨM PHÁN' ? 'THẨM PHÁN – CHỦ TỌA PHIÊN TÒA' : v.chucVuKy }) }),
  },
  {
    id: 'pt-lenh-tam-giam', cap: 'pt', nhom: 'Biện pháp ngăn chặn', ten: 'Lệnh tạm giam (giai đoạn xét xử phúc thẩm)',
    fields: ['nguoiBiTamGiam', 'toiDanh', 'banAnSo', 'banAnNgay', 'banAnToa', 'tamGiamTu', 'tamGiamDen', 'noiTamGiam', 'lyDo', 'nguoiKy', 'chucVuKy'],
    build: (v) => doc('pt-lenh-tam-giam', v, { kh: 'HSPT-LTG', title: 'LỆNH TẠM GIAM', body: [
      P('Căn cứ Điều 119 của Bộ luật Tố tụng hình sự và quy định về áp dụng biện pháp ngăn chặn ở giai đoạn xét xử phúc thẩm;'),
      P(`Xét thấy cần thiết tạm giam bị cáo để bảo đảm việc xét xử phúc thẩm: ${dots(v.lyDo)}`),
      P(`Tạm giam: ${dots(v.nguoiBiTamGiam)}.`),
      P(`Bị xét xử sơ thẩm về tội “${dots(v.toiDanh)}” tại ${banAnST(v)}.`),
      P(`Thời hạn tạm giam: từ ${ngayChu(v.tamGiamTu)} đến ${ngayChu(v.tamGiamDen)}.`),
      P(`Nơi tạm giam: ${dots(v.noiTamGiam)}.`),
    ], sign: ky(v, [VKS_NOI(v), 'Nơi tạm giam', 'Bị cáo']) }),
  },
  {
    id: 'pt-bien-ban-phien-toa', cap: 'pt', nhom: 'Phiên tòa phúc thẩm', ten: 'Biên bản phiên tòa phúc thẩm',
    fields: ['soThuLy', 'ngayThuLy', 'soQdXetXu', 'ngayQdXetXu', 'banAnSo', 'banAnNgay', 'banAnToa', 'biCaoChiTiet', 'khangCao', 'ngayXetXu', 'gioXetXu', 'diaDiemXetXu', 'chuToa', 'thamPhan', 'thuKy', 'kiemSatVien', 'vks', 'biHai', 'nguoiThamGia'],
    build: (v) => doc('pt-bien-ban-phien-toa', v, { kh: 'BB-HSPT', title: 'BIÊN BẢN PHIÊN TÒA', subject: 'XÉT XỬ PHÚC THẨM VỤ ÁN HÌNH SỰ', header: { number: `Thụ lý số: ${dots(v.soThuLy)}` }, body: [
      P(`Vào hồi ${dots(v.gioXetXu)}, ${ngayChu(v.ngayXetXu)}, tại ${dots(v.diaDiemXetXu)}, ${v.toaAn || 'Tòa án'} mở phiên tòa xét xử phúc thẩm ${v.hinhThucXetXu || 'công khai'} vụ án hình sự thụ lý số ${dots(v.soThuLy)} ${ngayChu(v.ngayThuLy)}, theo Quyết định đưa vụ án ra xét xử phúc thẩm số ${dots(v.soQdXetXu)} ${ngayChu(v.ngayQdXetXu)}, do có kháng cáo, kháng nghị đối với ${banAnST(v)}.`),
      B('I. NHỮNG NGƯỜI TIẾN HÀNH TỐ TỤNG', ''),
      ...hdxxLines(v, true),
      P(`- Kiểm sát viên: ${dots(v.kiemSatVien)} – ${vksTen(v)}.`),
      B('II. NHỮNG NGƯỜI THAM GIA TỐ TỤNG', ''),
      ...multi(v.biCaoChiTiet, '- Bị cáo: '),
      ...(v.biHai ? [P(`- Bị hại: ${v.biHai}.`)] : []),
      ...lines(v.nguoiThamGia).map((x) => P(`- ${x}.`)),
      B('III. KHÁNG CÁO, KHÁNG NGHỊ', ''),
      ...multi(v.khangCao, '- '),
      B('IV. DIỄN BIẾN PHIÊN TÒA (thủ tục, xét hỏi, tranh luận, lời nói sau cùng)', ''),
      P('……………………'),
      B('V. NGHỊ ÁN VÀ TUYÊN ÁN', ''),
      P('……………………'),
      P('Phiên tòa kết thúc vào hồi …… giờ …… phút cùng ngày. Biên bản được lập theo Điều 258 của Bộ luật Tố tụng hình sự.'),
    ], signers: [{ title: 'THƯ KÝ PHIÊN TÒA', name: v.thuKy }, { title: 'THẨM PHÁN – CHỦ TỌA PHIÊN TÒA', name: v.chuToa }] }),
  },
  {
    id: 'pt-bien-ban-nghi-an', cap: 'pt', nhom: 'Phiên tòa phúc thẩm', ten: 'Biên bản nghị án (phúc thẩm)',
    fields: ['soThuLy', 'ngayThuLy', 'banAnSo', 'banAnNgay', 'banAnToa', 'biCao', 'khangCao', 'ngayXetXu', 'chuToa', 'thamPhan', 'quyetDinh'],
    build: (v) => doc('pt-bien-ban-nghi-an', v, { kh: 'BBNA-HSPT', title: 'BIÊN BẢN NGHỊ ÁN', header: { number: `Thụ lý số: ${dots(v.soThuLy)}` }, body: [
      P('Căn cứ Điều 326 của Bộ luật Tố tụng hình sự;'),
      P(`Vào hồi …… giờ …… phút, ${ngayChu(v.ngayXetXu)}, tại phòng nghị án ${v.toaAn || 'Tòa án'}, Hội đồng xét xử phúc thẩm gồm:`),
      P(`- Thẩm phán – Chủ tọa phiên tòa: ${dots(v.chuToa)}.`),
      ...(lines(v.thamPhan).length ? lines(v.thamPhan) : ['……………………', '……………………']).map((x) => P(`- Thẩm phán: ${x}.`)),
      P(`Tiến hành nghị án vụ án hình sự phúc thẩm đối với bị cáo ${dots(v.biCao)}, xét kháng cáo, kháng nghị đối với ${banAnST(v)}:`),
      ...multi(v.khangCao, '- '),
      P('Hội đồng xét xử đã thảo luận và biểu quyết từng vấn đề theo đa số như sau:'),
      ...multi(v.quyetDinh),
      P('Việc nghị án kết thúc vào hồi …… giờ …… phút cùng ngày.'),
    ], signers: [{ title: 'THẨM PHÁN – CHỦ TỌA PHIÊN TÒA', name: v.chuToa }, ...(lines(v.thamPhan).length ? lines(v.thamPhan) : ['', '']).map((x) => ({ title: 'THẨM PHÁN', name: x }))] }),
  },
  {
    id: 'pt-ban-an', cap: 'pt', nhom: 'Bản án', ten: 'Bản án hình sự phúc thẩm',
    fields: ['banAnSo', 'banAnNgay', 'banAnToa', 'soThuLy', 'ngayThuLy', 'soQdXetXu', 'ngayQdXetXu', 'chuToa', 'thamPhan', 'thuKy', 'kiemSatVien', 'vks', 'ngayXetXu', 'diaDiemXetXu', 'ngayTuyenAn', 'biCaoChiTiet', 'toiDanh', 'dieuLuat', 'khangCao', 'biHai', 'nguoiThamGia', 'noiDungVuAn', 'nhanDinh', 'quyetDinh'],
    build: (v) => doc('pt-ban-an', v, { kh: 'HS-PT', title: 'NHÂN DANH NƯỚC CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', subject: up(v.toaAn || 'TÒA ÁN NHÂN DÂN'), header: { number: `Bản án số: ${v.soVb || `……/${year(v)}/HS-PT`}`, subject: `Ngày: ${ngaySo(v.ngayTuyenAn)}`, placeDate: '' }, body: [
      P('- Thành phần Hội đồng xét xử phúc thẩm gồm có:', { indent: false }),
      P(`Thẩm phán – Chủ tọa phiên tòa: ${dots(v.chuToa)}.`),
      P(`Các Thẩm phán: ${lines(v.thamPhan).join(', ') || '……………………'}.`),
      P(`- Thư ký phiên tòa: ${dots(v.thuKy)}.`, { indent: false }),
      P(`- Đại diện ${vksTen(v)} tham gia phiên tòa: ${dots(v.kiemSatVien)} – Kiểm sát viên.`, { indent: false }),
      P(`${ngayChu(v.ngayXetXu).replace(/^n/, 'N')}, tại ${dots(v.diaDiemXetXu)}, xét xử phúc thẩm ${v.hinhThucXetXu || 'công khai'} vụ án hình sự thụ lý số ${dots(v.soThuLy)} ${ngayChu(v.ngayThuLy)} theo Quyết định đưa vụ án ra xét xử phúc thẩm số ${dots(v.soQdXetXu)} ${ngayChu(v.ngayQdXetXu)}, do có kháng cáo, kháng nghị đối với ${banAnST(v)}.`),
      P('- Bị cáo có kháng cáo / bị kháng cáo, kháng nghị:', { indent: false }),
      ...multi(v.biCaoChiTiet, '- '),
      ...(v.biHai ? [P(`- Bị hại: ${v.biHai}.`)] : []),
      ...lines(v.nguoiThamGia).map((x) => P(`- ${x}.`)),
      H('NỘI DUNG VỤ ÁN:'),
      ...multi(v.noiDungVuAn),
      P('Kháng cáo, kháng nghị:'),
      ...multi(v.khangCao, '- '),
      H('NHẬN ĐỊNH CỦA TÒA ÁN:'),
      ...multi(v.nhanDinh),
      P([run('Vì các lẽ trên,', { italic: true })], { indent: false, spaceBefore: true }),
      H('QUYẾT ĐỊNH:'),
      P('Căn cứ điểm …… khoản 1 Điều 355, Điều …… của Bộ luật Tố tụng hình sự;'),
      ...multi(v.quyetDinh),
      P('Bản án phúc thẩm có hiệu lực pháp luật kể từ ngày tuyên án.'),
    ], sign: { noiNhan: lines(v.noiNhan).length ? lines(v.noiNhan) : [VKS_NOI(v), 'Tòa án đã xét xử sơ thẩm', 'Bị cáo, người tham gia tố tụng', 'Cơ quan thi hành án', 'Lưu hồ sơ vụ án'], authority: 'TM. HỘI ĐỒNG XÉT XỬ PHÚC THẨM', position: 'THẨM PHÁN – CHỦ TỌA PHIÊN TÒA', name: v.chuToa || '' } }),
  },
];
export const CAP_FORMS = { so: 'Sơ thẩm', pt: 'Phúc thẩm', tha: 'Sau xét xử, thi hành án' };
export const courtForm = (id) => COURT_FORMS.find((f) => f.id === id) || null;
/** Trường hiển thị khi điền một biểu mẫu: phần đầu văn bản + trường riêng của mẫu. */
export const formFields = (form) => [...new Set(['toaAn', 'toaAnCapTren', 'diaDanh', 'soVb', 'ngayVb', ...form.fields, 'nguoiKy', 'chucVuKy', 'noiNhan'])].map(fieldOf).filter(Boolean);
/** Văn bản (doc model) của biểu mẫu soạn sẵn với giá trị đã điền. */
export const buildCourtForm = (id, values) => courtForm(id)?.build({ ...values }) || null;
/** Nhãn ô dùng trong mẫu Word của đơn vị: {{Tên trường}}. */
export const wordTag = (key) => `{{${fieldOf(key)?.tag || key}}}`;
