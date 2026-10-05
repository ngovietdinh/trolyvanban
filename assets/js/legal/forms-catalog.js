// Danh mục biểu mẫu văn bản tố tụng hình sự dùng trong giai đoạn tiếp nhận, giải quyết nguồn tin
// và điều tra (Bộ luật Tố tụng hình sự 2015, sửa đổi, bổ sung 2021, 2025).
// Nội dung theo cấu trúc biểu mẫu thông dụng của Cơ quan điều tra; số hiệu mẫu theo Thông tư
// 128/2025/TT-BCA nhập được cho từng mẫu (Cài đặt mẫu số). Cần đối chiếu biểu mẫu chính thức khi ban hành.
//
// Cú pháp nội dung: {khoa} là chỗ điền (danh mục trường ở FIELDS). Loại mẫu:
//   qd = Quyết định · lenh = Lệnh · bb = Biên bản · tb = Thông báo · giay = Giấy triệu tập/Giấy mời
//   yc = Yêu cầu/Công văn · dn = Đề nghị · kl = Bản kết luận · cd = Giấy cam đoan/đơn.

export const STAGES = [
  { id: 'nguon-tin', ten: 'Tiếp nhận, giải quyết nguồn tin về tội phạm', icon: 'message' },
  { id: 'khoi-to', ten: 'Khởi tố vụ án, khởi tố bị can', icon: 'gavel' },
  { id: 'phan-cong', ten: 'Phân công, thay đổi người tiến hành, người tham gia tố tụng', icon: 'user' },
  { id: 'bat-giu', ten: 'Giữ người, bắt người, tạm giữ, tạm giam', icon: 'lock' },
  { id: 'ngan-chan-khac', ten: 'Biện pháp ngăn chặn khác, biện pháp cưỡng chế', icon: 'shield' },
  { id: 'trieu-tap', ten: 'Triệu tập, lấy lời khai, đối chất, nhận dạng', icon: 'quote' },
  { id: 'kham-xet', ten: 'Khám xét, thu giữ, tạm giữ đồ vật, tài liệu', icon: 'search' },
  { id: 'kham-nghiem', ten: 'Khám nghiệm, thực nghiệm điều tra', icon: 'eye' },
  { id: 'giam-dinh', ten: 'Trưng cầu giám định, yêu cầu định giá tài sản', icon: 'zap' },
  { id: 'vat-chung', ten: 'Vật chứng, tài sản, tài liệu', icon: 'folder' },
  { id: 'bao-chua', ten: 'Người bào chữa, bảo vệ người tham gia tố tụng', icon: 'shield' },
  { id: 'thoi-han', ten: 'Gia hạn, tạm đình chỉ, phục hồi, đình chỉ điều tra', icon: 'clock' },
  { id: 'ket-thuc', ten: 'Kết thúc điều tra', icon: 'check-circle' },
  { id: 'dac-biet', ten: 'Thủ tục đặc biệt (người dưới 18 tuổi, pháp nhân, truy nã…)', icon: 'layers' },
  { id: 'chung', ten: 'Văn bản, biên bản dùng chung', icon: 'file' },
];

/** Trường điền: nhãn, kiểu, gợi ý. */
export const FIELDS = {
  so: { label: 'Số văn bản', hint: 'Để trống để ghi tay', short: true },
  tenVu: { label: 'Vụ án / vụ việc', hint: 'VD: Tham ô tài sản xảy ra tại Công ty X' },
  toiDanh: { label: 'Tội danh và điều luật', hint: 'VD: Tham ô tài sản quy định tại khoản 4 Điều 353 Bộ luật Hình sự' },
  toiDanhMoi: { label: 'Tội danh (thay đổi/bổ sung)', hint: 'Tội … quy định tại Điều … Bộ luật Hình sự' },
  noiXayRa: { label: 'Nơi xảy ra' },
  thoiGianXayRa: { label: 'Thời gian xảy ra' },
  tomTat: { label: 'Xét thấy (tóm tắt căn cứ, hành vi)', type: 'textarea', hint: 'Tóm tắt hành vi, căn cứ pháp lý của quyết định' },
  hoTen: { label: 'Họ tên người bị áp dụng / người được triệu tập' },
  nhanThan: { label: 'Nhân thân (sinh ngày, nơi cư trú, CCCD…)', type: 'textarea' },
  hoTen2: { label: 'Họ tên người thứ hai (đối chất, nhận dạng…)' },
  nguoiBaoLinh: { label: 'Người/tổ chức nhận bảo lĩnh' },
  quanHe: { label: 'Quan hệ với bị can' },
  lyDo: { label: 'Lý do', type: 'textarea' },
  thoiHan: { label: 'Thời hạn', hint: 'VD: 02 tháng' },
  tuNgay: { label: 'Từ ngày' },
  denNgay: { label: 'Đến ngày' },
  diaDiem: { label: 'Địa điểm tiến hành' },
  noiGiam: { label: 'Nơi tạm giữ / tạm giam', hint: 'Nhà tạm giữ / Trại tạm giam …' },
  dtv: { label: 'Điều tra viên được phân công', type: 'textarea', hint: 'Mỗi dòng một người: Họ tên — chức danh' },
  dtvCu: { label: 'Điều tra viên bị thay đổi' },
  cbdt: { label: 'Cán bộ điều tra', type: 'textarea' },
  nguoiPhienDich: { label: 'Người phiên dịch / dịch thuật' },
  ngonNgu: { label: 'Ngôn ngữ' },
  vks: { label: 'Viện kiểm sát nhân dân', hint: 'VD: tỉnh Ninh Bình' },
  kinhGui: { label: 'Kính gửi', type: 'textarea' },
  coQuanNhan: { label: 'Cơ quan, tổ chức nhận / được yêu cầu' },
  soQuyetDinh: { label: 'Quyết định / lệnh liên quan', hint: 'Quyết định số … ngày … của …' },
  taiSan: { label: 'Tài sản', type: 'textarea' },
  taiKhoan: { label: 'Tài khoản (số TK, chủ TK, ngân hàng)', type: 'textarea' },
  soTien: { label: 'Số tiền' },
  diaChiKhamXet: { label: 'Đối tượng / địa điểm khám xét, thu giữ' },
  doVat: { label: 'Đồ vật, tài liệu, dữ liệu', type: 'textarea' },
  toChucGiamDinh: { label: 'Tổ chức / người giám định, định giá' },
  doiTuongGiamDinh: { label: 'Đối tượng giám định, định giá', type: 'textarea' },
  noiDungGiamDinh: { label: 'Nội dung yêu cầu (câu hỏi giám định, định giá)', type: 'textarea' },
  thoiHanGiamDinh: { label: 'Thời hạn trả kết luận' },
  vatChung: { label: 'Vật chứng', type: 'textarea' },
  cachXuLy: { label: 'Biện pháp xử lý', type: 'textarea' },
  ngayHen: { label: 'Ngày có mặt' },
  gioHen: { label: 'Giờ có mặt' },
  diaDiemHen: { label: 'Địa điểm có mặt' },
  gapAi: { label: 'Gặp ai', hint: 'Điều tra viên …' },
  mucDich: { label: 'Để làm gì', hint: 'làm việc, ghi lời khai về …' },
  thanhPhan: { label: 'Thành phần tiến hành', type: 'textarea', hint: 'Mỗi dòng: Họ tên — chức danh' },
  nguoiChungKien: { label: 'Người chứng kiến, người tham gia', type: 'textarea' },
  noiDung: { label: 'Nội dung', type: 'textarea', rows: 8 },
  ketQua: { label: 'Kết quả', type: 'textarea' },
  nguoiBaoChua: { label: 'Người bào chữa / người bảo vệ quyền lợi' },
  bienPhap: { label: 'Biện pháp' },
  lan: { label: 'Lần thứ' },
  coQuanChuyen: { label: 'Cơ quan nhận chuyển', hint: 'Cơ quan có thẩm quyền điều tra …' },
  dienBien: { label: 'Diễn biến hành vi phạm tội', type: 'textarea', rows: 10 },
  chungCu: { label: 'Chứng cứ xác định hành vi phạm tội', type: 'textarea', rows: 6 },
  tinhTiet: { label: 'Tình tiết tăng nặng, giảm nhẹ; nhân thân bị can', type: 'textarea', rows: 5 },
  xuLyVatChung: { label: 'Vật chứng, tài sản, biện pháp đã áp dụng', type: 'textarea', rows: 4 },
  deNghi: { label: 'Kết luận và đề nghị', type: 'textarea', rows: 5 },
  nguoiDaiDien: { label: 'Người đại diện / người giám hộ / nhà trường' },
  phapNhan: { label: 'Pháp nhân thương mại (tên, mã số, trụ sở, người đại diện)', type: 'textarea' },
};

const F = []; // danh sách mẫu
const add = (stage, id, ten, loai, def) => F.push({ id, ten, loai, giaiDoan: stage, ...def });
const BL = 'Bộ luật Tố tụng hình sự';

/* ---------------- Tiếp nhận, giải quyết nguồn tin ---------------- */
add('nguon-tin', 'bb-tiep-nhan-nguon-tin', 'Biên bản tiếp nhận nguồn tin về tội phạm', 'bb', {
  canCu: `Điều 145, Điều 146 ${BL}`, hoatDong: 'tiếp nhận nguồn tin về tội phạm', heading: 'NỘI DUNG NGUỒN TIN',
  intro: ['Người cung cấp nguồn tin: {hoTen}; {nhanThan}.'], signers: ['NGƯỜI CUNG CẤP NGUỒN TIN', 'NGƯỜI TIẾP NHẬN'],
});
add('nguon-tin', 'qd-phan-cong-giai-quyet-nguon-tin', 'Quyết định phân công giải quyết nguồn tin về tội phạm', 'qd', {
  subject: 'Phân công giải quyết nguồn tin về tội phạm', canCu: [`Điều 36, Điều 147 ${BL}`],
  xetThay: '{tomTat}', dieu: ['Phân công: {dtv} giải quyết nguồn tin về tội phạm: {tenVu}.', 'Thời hạn giải quyết: {thoiHan}, kể từ ngày tiếp nhận nguồn tin.'],
});
add('nguon-tin', 'qd-gia-han-giai-quyet-nguon-tin', 'Quyết định gia hạn thời hạn giải quyết nguồn tin về tội phạm', 'qd', {
  subject: 'Gia hạn thời hạn giải quyết nguồn tin về tội phạm', canCu: [`Điều 147 ${BL}`],
  xetThay: 'Nguồn tin về tội phạm: {tenVu} có nhiều tình tiết phức tạp, phải kiểm tra, xác minh tại nhiều địa điểm; {lyDo}', dieu: ['Gia hạn thời hạn giải quyết nguồn tin về tội phạm: {tenVu}.', 'Thời hạn gia hạn: {thoiHan}, từ ngày {tuNgay} đến ngày {denNgay}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}'],
});
add('nguon-tin', 'qd-tam-dinh-chi-nguon-tin', 'Quyết định tạm đình chỉ việc giải quyết nguồn tin về tội phạm', 'qd', {
  subject: 'Tạm đình chỉ việc giải quyết nguồn tin về tội phạm', canCu: [`Điều 148 ${BL}`],
  xetThay: '{lyDo}', dieu: ['Tạm đình chỉ việc giải quyết nguồn tin về tội phạm: {tenVu}.', 'Lý do tạm đình chỉ: {lyDo}'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Cơ quan, tổ chức, cá nhân đã tố giác, báo tin, kiến nghị khởi tố'],
});
add('nguon-tin', 'qd-phuc-hoi-nguon-tin', 'Quyết định phục hồi giải quyết nguồn tin về tội phạm', 'qd', {
  subject: 'Phục hồi giải quyết nguồn tin về tội phạm', canCu: [`Điều 149 ${BL}`],
  xetThay: 'Lý do tạm đình chỉ việc giải quyết nguồn tin về tội phạm theo {soQuyetDinh} không còn; {lyDo}', dieu: ['Phục hồi giải quyết nguồn tin về tội phạm: {tenVu}.', 'Thời hạn giải quyết: {thoiHan}, kể từ ngày ra quyết định phục hồi.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}'],
});
add('nguon-tin', 'qd-chuyen-nguon-tin', 'Quyết định chuyển nguồn tin về tội phạm', 'qd', {
  subject: 'Chuyển nguồn tin về tội phạm', canCu: [`Điều 145 ${BL}`, 'Quy định về thẩm quyền điều tra'],
  xetThay: 'Nguồn tin về tội phạm: {tenVu} không thuộc thẩm quyền giải quyết của Cơ quan; {lyDo}', dieu: ['Chuyển nguồn tin về tội phạm: {tenVu} cùng toàn bộ tài liệu kèm theo đến {coQuanChuyen} để giải quyết theo thẩm quyền.'],
  noiNhan: ['{coQuanChuyen}', 'Viện kiểm sát nhân dân {vks}'],
});
add('nguon-tin', 'qd-khong-khoi-to-vu-an', 'Quyết định không khởi tố vụ án hình sự', 'qd', {
  subject: 'Không khởi tố vụ án hình sự', canCu: [`Điều 147, Điều 157, Điều 158 ${BL}`],
  xetThay: 'Kết quả giải quyết nguồn tin về tội phạm: {tenVu} xác định: {tomTat}. Có căn cứ không khởi tố vụ án hình sự theo quy định tại {lyDo}', dieu: ['Không khởi tố vụ án hình sự đối với sự việc: {tenVu}.', 'Cơ quan, tổ chức, cá nhân đã tố giác, báo tin, kiến nghị khởi tố có quyền khiếu nại Quyết định này theo quy định tại Chương XXXIII Bộ luật Tố tụng hình sự.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Cơ quan, tổ chức, cá nhân đã tố giác, báo tin, kiến nghị khởi tố'],
});
add('nguon-tin', 'tb-ket-qua-giai-quyet-nguon-tin', 'Thông báo kết quả giải quyết nguồn tin về tội phạm', 'tb', {
  subject: 'Kết quả giải quyết nguồn tin về tội phạm', kinhGui: '{kinhGui}',
  body: ['Ngày {thoiGianXayRa}, Cơ quan đã tiếp nhận nguồn tin về tội phạm: {tenVu}.', 'Kết quả giải quyết: {ketQua}', 'Nếu không đồng ý, có quyền khiếu nại theo quy định của Bộ luật Tố tụng hình sự.'],
});
add('nguon-tin', 'yc-cung-cap-tai-lieu', 'Yêu cầu cung cấp tài liệu, đồ vật, dữ liệu điện tử', 'yc', {
  subject: 'Yêu cầu cung cấp tài liệu, đồ vật, dữ liệu điện tử', kinhGui: '{coQuanNhan}', canCuLine: `Căn cứ Điều 88, Điều 147 ${BL};`,
  body: ['Để phục vụ công tác giải quyết nguồn tin về tội phạm/điều tra vụ án: {tenVu}, đề nghị {coQuanNhan} cung cấp cho Cơ quan các tài liệu, đồ vật, dữ liệu sau:', '{doVat}', 'Thời hạn cung cấp: {thoiHan}. Tài liệu gửi về: {diaDiemHen}; cán bộ liên hệ: {gapAi}.'],
});

/* ---------------- Khởi tố ---------------- */
add('khoi-to', 'qd-khoi-to-vu-an', 'Quyết định khởi tố vụ án hình sự', 'qd', {
  subject: 'Khởi tố vụ án hình sự', canCu: [`Điều 36, Điều 143, Điều 153, Điều 154 ${BL}`],
  xetThay: '{tomTat} Hành vi trên có dấu hiệu tội {toiDanh}.', dieu: ['Khởi tố vụ án hình sự: {tenVu}, xảy ra tại {noiXayRa}, vào {thoiGianXayRa}.', 'Về tội: {toiDanh}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}'],
});
add('khoi-to', 'qd-thay-doi-khoi-to-vu-an', 'Quyết định thay đổi quyết định khởi tố vụ án hình sự', 'qd', {
  subject: 'Thay đổi quyết định khởi tố vụ án hình sự', canCu: [`Điều 36, Điều 156 ${BL}`],
  xetThay: 'Kết quả điều tra xác định tội phạm đã khởi tố theo {soQuyetDinh} không đúng với hành vi phạm tội xảy ra: {tomTat}', dieu: ['Thay đổi {soQuyetDinh} khởi tố vụ án hình sự: {tenVu}.', 'Từ tội: {toiDanh}; thành tội: {toiDanhMoi}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}'],
});
add('khoi-to', 'qd-bo-sung-khoi-to-vu-an', 'Quyết định bổ sung quyết định khởi tố vụ án hình sự', 'qd', {
  subject: 'Bổ sung quyết định khởi tố vụ án hình sự', canCu: [`Điều 36, Điều 156 ${BL}`],
  xetThay: 'Quá trình điều tra phát hiện còn tội phạm khác chưa được khởi tố: {tomTat}', dieu: ['Bổ sung {soQuyetDinh} khởi tố vụ án hình sự: {tenVu}.', 'Tội danh bổ sung: {toiDanhMoi}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}'],
});
add('khoi-to', 'qd-khoi-to-bi-can', 'Quyết định khởi tố bị can', 'qd', {
  subject: 'Khởi tố bị can', canCu: [`Điều 36, Điều 179 ${BL}`, 'Quyết định khởi tố vụ án hình sự {soQuyetDinh}'],
  xetThay: 'Có đủ căn cứ xác định: {tomTat} Hành vi đó đã phạm vào tội {toiDanh}.', dieu: ['Khởi tố bị can đối với: {hoTen}; {nhanThan}.', 'Về tội: {toiDanh}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks} (để phê chuẩn)', 'Bị can {hoTen}'],
});
add('khoi-to', 'qd-thay-doi-khoi-to-bi-can', 'Quyết định thay đổi quyết định khởi tố bị can', 'qd', {
  subject: 'Thay đổi quyết định khởi tố bị can', canCu: [`Điều 36, Điều 180 ${BL}`],
  xetThay: 'Kết quả điều tra xác định hành vi của bị can {hoTen} không phạm tội đã bị khởi tố theo {soQuyetDinh}: {tomTat}', dieu: ['Thay đổi {soQuyetDinh} khởi tố bị can đối với: {hoTen}; {nhanThan}.', 'Từ tội: {toiDanh}; thành tội: {toiDanhMoi}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks} (để phê chuẩn)', 'Bị can {hoTen}'],
});
add('khoi-to', 'qd-bo-sung-khoi-to-bi-can', 'Quyết định bổ sung quyết định khởi tố bị can', 'qd', {
  subject: 'Bổ sung quyết định khởi tố bị can', canCu: [`Điều 36, Điều 180 ${BL}`],
  xetThay: 'Bị can {hoTen} còn thực hiện hành vi phạm tội khác: {tomTat}', dieu: ['Bổ sung {soQuyetDinh} khởi tố bị can đối với: {hoTen}; {nhanThan}.', 'Tội danh bổ sung: {toiDanhMoi}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks} (để phê chuẩn)', 'Bị can {hoTen}'],
});
add('khoi-to', 'qd-nhap-vu-an', 'Quyết định nhập vụ án hình sự để điều tra', 'qd', {
  subject: 'Nhập vụ án hình sự để điều tra', canCu: [`Điều 170 ${BL}`],
  xetThay: '{tomTat}', dieu: ['Nhập vụ án hình sự {soQuyetDinh} vào vụ án hình sự {tenVu} để tiến hành điều tra chung.', 'Lý do: {lyDo}'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}'],
});
add('khoi-to', 'qd-tach-vu-an', 'Quyết định tách vụ án hình sự để điều tra', 'qd', {
  subject: 'Tách vụ án hình sự để điều tra', canCu: [`Điều 170 ${BL}`],
  xetThay: 'Việc tách vụ án không ảnh hưởng đến việc xác định sự thật khách quan, toàn diện của vụ án; {lyDo}', dieu: ['Tách vụ án hình sự đối với: {hoTen} về tội {toiDanh} ra khỏi vụ án {tenVu} để điều tra riêng.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}'],
});
add('khoi-to', 'qd-chuyen-vu-an', 'Quyết định chuyển vụ án hình sự để điều tra theo thẩm quyền', 'qd', {
  subject: 'Chuyển vụ án hình sự', canCu: [`Điều 169 ${BL}`],
  xetThay: 'Vụ án {tenVu} không thuộc thẩm quyền điều tra của Cơ quan; {lyDo}', dieu: ['Chuyển vụ án hình sự: {tenVu} cùng toàn bộ hồ sơ, vật chứng đến {coQuanChuyen} để điều tra theo thẩm quyền.'],
  noiNhan: ['{coQuanChuyen}', 'Viện kiểm sát nhân dân {vks}'],
});
add('khoi-to', 'dn-phe-chuan-khoi-to-bi-can', 'Văn bản đề nghị phê chuẩn quyết định khởi tố bị can', 'dn', {
  subject: 'Đề nghị phê chuẩn quyết định khởi tố bị can', kinhGui: 'Viện kiểm sát nhân dân {vks}',
  body: ['Căn cứ Điều 179 Bộ luật Tố tụng hình sự; Cơ quan đã ra {soQuyetDinh} khởi tố bị can đối với: {hoTen}; {nhanThan}, về tội {toiDanh}.', 'Tóm tắt hành vi và chứng cứ: {tomTat}', 'Đề nghị Viện kiểm sát nhân dân {vks} xem xét, phê chuẩn Quyết định khởi tố bị can nêu trên. Kèm theo hồ sơ, tài liệu có liên quan.'],
});

/* ---------------- Phân công, thay đổi ---------------- */
add('phan-cong', 'qd-phan-cong-dtv', 'Quyết định phân công Điều tra viên, Cán bộ điều tra điều tra vụ án', 'qd', {
  subject: 'Phân công Điều tra viên, Cán bộ điều tra', canCu: [`Điều 36, Điều 37 ${BL}`],
  xetThay: null, dieu: ['Phân công: {dtv} là Điều tra viên tiến hành điều tra vụ án {tenVu}.', 'Phân công Cán bộ điều tra: {cbdt} giúp Điều tra viên.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}'],
});
add('phan-cong', 'qd-thay-doi-dtv', 'Quyết định thay đổi Điều tra viên', 'qd', {
  subject: 'Thay đổi Điều tra viên', canCu: [`Điều 36, Điều 51 ${BL}`],
  xetThay: '{lyDo}', dieu: ['Thay đổi Điều tra viên {dtvCu} trong vụ án {tenVu}.', 'Phân công {dtv} thay thế làm Điều tra viên tiến hành điều tra vụ án.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}'],
});
add('phan-cong', 'qd-cu-phien-dich', 'Quyết định cử người phiên dịch, người dịch thuật', 'qd', {
  subject: 'Cử người phiên dịch, người dịch thuật', canCu: [`Điều 70 ${BL}`],
  xetThay: 'Người tham gia tố tụng {hoTen} không sử dụng được tiếng Việt; {lyDo}', dieu: ['Cử: {nguoiPhienDich} làm người phiên dịch tiếng {ngonNgu} trong vụ án {tenVu}.', 'Người phiên dịch có quyền, nghĩa vụ theo quy định tại Điều 70 Bộ luật Tố tụng hình sự; nếu dịch gian dối thì phải chịu trách nhiệm hình sự theo Điều 382 Bộ luật Hình sự.'],
});
add('phan-cong', 'qd-thay-doi-phien-dich', 'Quyết định thay đổi người phiên dịch, người dịch thuật', 'qd', {
  subject: 'Thay đổi người phiên dịch, người dịch thuật', canCu: [`Điều 70, Điều 71 ${BL}`],
  xetThay: '{lyDo}', dieu: ['Thay đổi người phiên dịch {hoTen2} trong vụ án {tenVu}.', 'Cử {nguoiPhienDich} làm người phiên dịch tiếng {ngonNgu} thay thế.'],
});
add('phan-cong', 'qd-tu-choi-tham-gia', 'Quyết định về việc từ chối, thay đổi người tiến hành tố tụng', 'qd', {
  subject: 'Từ chối, thay đổi người tiến hành tố tụng', canCu: [`Điều 49, Điều 51 ${BL}`],
  xetThay: 'Xét đề nghị của {hoTen} về việc thay đổi người tiến hành tố tụng; {lyDo}', dieu: ['{noiDung}'],
});

/* ---------------- Giữ, bắt, tạm giữ, tạm giam ---------------- */
add('bat-giu', 'qd-giu-khan-cap', 'Quyết định giữ người trong trường hợp khẩn cấp', 'qd', {
  subject: 'Giữ người trong trường hợp khẩn cấp', canCu: [`Điều 110 ${BL}`],
  xetThay: 'Có căn cứ: {lyDo}', dieu: ['Giữ người trong trường hợp khẩn cấp đối với: {hoTen}; {nhanThan}.', 'Đưa người bị giữ về trụ sở Cơ quan để giải quyết theo quy định của pháp luật.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Người bị giữ'],
});
add('bat-giu', 'bb-giu-khan-cap', 'Biên bản giữ người trong trường hợp khẩn cấp', 'bb', {
  canCu: `Điều 110, Điều 133 ${BL}`, hoatDong: 'giữ người trong trường hợp khẩn cấp theo {soQuyetDinh} đối với {hoTen}; {nhanThan}', heading: 'DIỄN BIẾN, ĐỒ VẬT TẠM GIỮ',
  signers: ['NGƯỜI BỊ GIỮ', 'NGƯỜI CHỨNG KIẾN', 'NGƯỜI THI HÀNH'],
});
add('bat-giu', 'lenh-bat-khan-cap', 'Lệnh bắt người bị giữ trong trường hợp khẩn cấp', 'lenh', {
  subject: 'Bắt người bị giữ trong trường hợp khẩn cấp', canCu: [`Điều 110, Điều 113 ${BL}`, '{soQuyetDinh}'],
  body: ['Bắt người bị giữ trong trường hợp khẩn cấp: {hoTen}; {nhanThan}.', 'Lý do bắt: {lyDo}', 'Lệnh này phải được Viện kiểm sát nhân dân {vks} phê chuẩn trước khi thi hành.'], pheChuan: true,
  noiNhan: ['Viện kiểm sát nhân dân {vks} (để phê chuẩn)', 'Người bị bắt'],
});
add('bat-giu', 'bb-bat-qua-tang', 'Biên bản bắt người phạm tội quả tang', 'bb', {
  canCu: `Điều 111, Điều 133 ${BL}`, hoatDong: 'bắt người phạm tội quả tang đối với {hoTen}; {nhanThan}', heading: 'HÀNH VI PHẠM TỘI, DIỄN BIẾN VIỆC BẮT, ĐỒ VẬT THU GIỮ',
  signers: ['NGƯỜI BỊ BẮT', 'NGƯỜI CHỨNG KIẾN', 'NGƯỜI LẬP BIÊN BẢN'],
});
add('bat-giu', 'bb-bat-truy-na', 'Biên bản bắt người đang bị truy nã', 'bb', {
  canCu: `Điều 112, Điều 133 ${BL}`, hoatDong: 'bắt người đang bị truy nã theo {soQuyetDinh} đối với {hoTen}; {nhanThan}', heading: 'DIỄN BIẾN VIỆC BẮT, ĐỒ VẬT THU GIỮ',
  signers: ['NGƯỜI BỊ BẮT', 'NGƯỜI CHỨNG KIẾN', 'NGƯỜI LẬP BIÊN BẢN'],
});
add('bat-giu', 'bb-tiep-nhan-nguoi-bi-bat', 'Biên bản tiếp nhận người bị giữ, người bị bắt', 'bb', {
  canCu: `Điều 111, Điều 112, Điều 133 ${BL}`, hoatDong: 'tiếp nhận người bị giữ/bị bắt: {hoTen}; {nhanThan}', heading: 'TÌNH TRẠNG NGƯỜI BỊ GIỮ, BỊ BẮT; ĐỒ VẬT, TÀI LIỆU BÀN GIAO',
  signers: ['NGƯỜI GIAO', 'NGƯỜI BỊ GIỮ, BỊ BẮT', 'NGƯỜI NHẬN'],
});
add('bat-giu', 'lenh-bat-tam-giam', 'Lệnh bắt bị can để tạm giam', 'lenh', {
  subject: 'Bắt bị can để tạm giam', canCu: [`Điều 113, Điều 119 ${BL}`, '{soQuyetDinh}'],
  body: ['Bắt bị can để tạm giam đối với: {hoTen}; {nhanThan}.', 'Bị can bị khởi tố về tội: {toiDanh}.', 'Thời hạn tạm giam: {thoiHan}, kể từ ngày bắt. Nơi tạm giam: {noiGiam}.'], pheChuan: true,
  noiNhan: ['Viện kiểm sát nhân dân {vks} (để phê chuẩn)', 'Bị can', '{noiGiam}'],
});
add('bat-giu', 'bb-bat-bi-can', 'Biên bản bắt bị can để tạm giam', 'bb', {
  canCu: `Điều 113, Điều 115, Điều 133 ${BL}`, hoatDong: 'thi hành {soQuyetDinh} bắt bị can để tạm giam đối với {hoTen}; {nhanThan}', heading: 'DIỄN BIẾN VIỆC BẮT, ĐỒ VẬT TẠM GIỮ',
  intro: ['Đã đọc lệnh, giải thích lệnh, quyền và nghĩa vụ cho người bị bắt.'], signers: ['NGƯỜI BỊ BẮT', 'ĐẠI DIỆN CHÍNH QUYỀN', 'NGƯỜI CHỨNG KIẾN', 'NGƯỜI THI HÀNH LỆNH'],
});
add('bat-giu', 'tb-bat-tam-giu', 'Thông báo về việc giữ người, bắt, tạm giữ, tạm giam', 'tb', {
  subject: 'Việc giữ người, bắt, tạm giữ, tạm giam', kinhGui: '{kinhGui}',
  body: ['Căn cứ Điều 116 Bộ luật Tố tụng hình sự, Cơ quan thông báo: Ông/Bà {hoTen}; {nhanThan}.', 'Đã bị {bienPhap} theo {soQuyetDinh}, vì {lyDo}.', 'Hiện đang bị giữ tại: {noiGiam}.'],
});
add('bat-giu', 'qd-tam-giu', 'Quyết định tạm giữ', 'qd', {
  subject: 'Tạm giữ', canCu: [`Điều 117 ${BL}`],
  xetThay: 'Đối với người bị giữ trong trường hợp khẩn cấp/bị bắt: {lyDo}', dieu: ['Tạm giữ: {hoTen}; {nhanThan}.', 'Thời hạn tạm giữ: {thoiHan} kể từ {tuNgay}, tại {noiGiam}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Người bị tạm giữ', '{noiGiam}'],
});
add('bat-giu', 'qd-gia-han-tam-giu', 'Quyết định gia hạn tạm giữ', 'qd', {
  subject: 'Gia hạn tạm giữ', canCu: [`Điều 118 ${BL}`, '{soQuyetDinh}'],
  xetThay: '{lyDo}', dieu: ['Gia hạn tạm giữ lần thứ {lan} đối với: {hoTen}; {nhanThan}.', 'Thời hạn gia hạn: {thoiHan}, từ {tuNgay} đến {denNgay}.'], pheChuan: true,
  noiNhan: ['Viện kiểm sát nhân dân {vks} (để phê chuẩn)', 'Người bị tạm giữ', '{noiGiam}'],
});
add('bat-giu', 'qd-tra-tu-do', 'Quyết định trả tự do cho người bị tạm giữ', 'qd', {
  subject: 'Trả tự do cho người bị tạm giữ', canCu: [`Điều 118 ${BL}`],
  xetThay: '{lyDo}', dieu: ['Trả tự do cho: {hoTen}; {nhanThan}, đang bị tạm giữ theo {soQuyetDinh}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Người được trả tự do', '{noiGiam}'],
});
add('bat-giu', 'lenh-tam-giam', 'Lệnh tạm giam', 'lenh', {
  subject: 'Tạm giam', canCu: [`Điều 119, Điều 173 ${BL}`, '{soQuyetDinh}'],
  body: ['Tạm giam bị can: {hoTen}; {nhanThan}.', 'Bị can bị khởi tố về tội: {toiDanh}.', 'Thời hạn tạm giam: {thoiHan}, từ ngày {tuNgay} đến ngày {denNgay}, tại {noiGiam}.'], pheChuan: true,
  noiNhan: ['Viện kiểm sát nhân dân {vks} (để phê chuẩn)', 'Bị can', '{noiGiam}'],
});
add('bat-giu', 'dn-gia-han-tam-giam', 'Văn bản đề nghị gia hạn thời hạn tạm giam', 'dn', {
  subject: 'Đề nghị gia hạn thời hạn tạm giam', kinhGui: 'Viện kiểm sát nhân dân {vks}',
  body: ['Bị can {hoTen}; {nhanThan}, bị khởi tố về tội {toiDanh}, đang bị tạm giam theo {soQuyetDinh}, thời hạn tạm giam hết vào ngày {denNgay}.', 'Do vụ án có nhiều tình tiết phức tạp: {lyDo}', 'Căn cứ Điều 173 Bộ luật Tố tụng hình sự, Cơ quan đề nghị Viện kiểm sát nhân dân {vks} gia hạn thời hạn tạm giam lần thứ {lan} đối với bị can {hoTen}, thời hạn {thoiHan}.'],
});
add('bat-giu', 'qd-huy-bo-tam-giam', 'Quyết định hủy bỏ biện pháp tạm giam', 'qd', {
  subject: 'Hủy bỏ biện pháp tạm giam', canCu: [`Điều 125 ${BL}`, '{soQuyetDinh}'],
  xetThay: '{lyDo}', dieu: ['Hủy bỏ biện pháp tạm giam đối với bị can: {hoTen}; {nhanThan}.', 'Trả tự do ngay cho bị can nếu không bị tạm giam về tội phạm khác.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Bị can', '{noiGiam}'],
});
add('bat-giu', 'qd-thay-the-ngan-chan', 'Quyết định thay thế biện pháp ngăn chặn', 'qd', {
  subject: 'Thay thế biện pháp ngăn chặn', canCu: [`Điều 125 ${BL}`],
  xetThay: '{lyDo}', dieu: ['Thay thế biện pháp ngăn chặn đã áp dụng theo {soQuyetDinh} đối với bị can {hoTen}; {nhanThan}.', 'Áp dụng biện pháp: {bienPhap}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Bị can'],
});

/* ---------------- Biện pháp ngăn chặn khác, cưỡng chế ---------------- */
add('ngan-chan-khac', 'lenh-cam-di-khoi-noi-cu-tru', 'Lệnh cấm đi khỏi nơi cư trú', 'lenh', {
  subject: 'Cấm đi khỏi nơi cư trú', canCu: [`Điều 123 ${BL}`],
  body: ['Cấm bị can: {hoTen}; {nhanThan} đi khỏi nơi cư trú.', 'Thời hạn: {thoiHan}, kể từ ngày {tuNgay}.', 'Bị can phải làm giấy cam đoan thực hiện các nghĩa vụ theo khoản 1 Điều 123 Bộ luật Tố tụng hình sự; giao bị can cho Ủy ban nhân dân xã/phường hoặc đơn vị quân đội nơi bị can cư trú/làm việc để quản lý, theo dõi.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Bị can', 'Chính quyền địa phương nơi bị can cư trú'],
});
add('ngan-chan-khac', 'cd-cam-doan-cu-tru', 'Giấy cam đoan (cấm đi khỏi nơi cư trú)', 'cd', {
  title: 'GIẤY CAM ĐOAN', body: ['Tôi là: {hoTen}; {nhanThan}.', 'Là bị can trong vụ án: {tenVu}, bị áp dụng biện pháp cấm đi khỏi nơi cư trú theo {soQuyetDinh}.', 'Tôi xin cam đoan: không đi khỏi nơi cư trú nếu không được cơ quan đã ra lệnh cho phép; có mặt theo giấy triệu tập; không bỏ trốn hoặc tiếp tục phạm tội; không mua chuộc, cưỡng ép, xúi giục người khác khai báo gian dối, tiêu hủy, giả mạo chứng cứ, đe dọa, trả thù người làm chứng, bị hại, người tố giác tội phạm.', 'Nếu vi phạm cam đoan, tôi xin chịu hoàn toàn trách nhiệm trước pháp luật.'],
  signers: ['NGƯỜI CAM ĐOAN'],
});
add('ngan-chan-khac', 'qd-bao-linh', 'Quyết định cho bảo lĩnh', 'qd', {
  subject: 'Cho bảo lĩnh', canCu: [`Điều 121 ${BL}`],
  xetThay: 'Xét giấy cam đoan nhận bảo lĩnh của {nguoiBaoLinh}; tính chất, mức độ hành vi phạm tội và nhân thân bị can: {lyDo}', dieu: ['Cho bị can {hoTen}; {nhanThan} được bảo lĩnh.', 'Người/tổ chức nhận bảo lĩnh: {nguoiBaoLinh}; thời hạn bảo lĩnh: {thoiHan}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks} (để phê chuẩn)', 'Bị can', '{nguoiBaoLinh}'], pheChuan: true,
});
add('ngan-chan-khac', 'cd-nhan-bao-linh', 'Giấy cam đoan nhận bảo lĩnh', 'cd', {
  title: 'GIẤY CAM ĐOAN NHẬN BẢO LĨNH', body: ['Tôi (cơ quan, tổ chức) là: {nguoiBaoLinh}; quan hệ với bị can: {quanHe}.', 'Xin nhận bảo lĩnh cho bị can: {hoTen}; {nhanThan}, trong vụ án {tenVu}.', 'Tôi cam đoan giám sát bị can thực hiện đầy đủ các nghĩa vụ theo khoản 3 Điều 121 Bộ luật Tố tụng hình sự; nếu để bị can vi phạm nghĩa vụ đã cam đoan, tôi xin chịu trách nhiệm theo quy định của pháp luật.'],
  signers: ['XÁC NHẬN CỦA CHÍNH QUYỀN / CƠ QUAN', 'NGƯỜI NHẬN BẢO LĨNH'],
});
add('ngan-chan-khac', 'qd-dat-tien', 'Quyết định áp dụng biện pháp đặt tiền để bảo đảm', 'qd', {
  subject: 'Áp dụng biện pháp đặt tiền để bảo đảm', canCu: [`Điều 122 ${BL}`],
  xetThay: '{lyDo}', dieu: ['Áp dụng biện pháp đặt tiền để bảo đảm đối với bị can {hoTen}; {nhanThan}.', 'Số tiền đặt để bảo đảm: {soTien}; nộp vào tài khoản tạm giữ của Cơ quan tại Kho bạc Nhà nước.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks} (để phê chuẩn)', 'Bị can'], pheChuan: true,
});
add('ngan-chan-khac', 'qd-tam-hoan-xuat-canh', 'Quyết định tạm hoãn xuất cảnh', 'qd', {
  subject: 'Tạm hoãn xuất cảnh', canCu: [`Điều 124 ${BL}`],
  xetThay: 'Có căn cứ xác định việc xuất cảnh của người này có dấu hiệu bỏ trốn: {lyDo}', dieu: ['Tạm hoãn xuất cảnh đối với: {hoTen}; {nhanThan}.', 'Thời hạn tạm hoãn xuất cảnh: {thoiHan}, kể từ ngày {tuNgay}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Cục Quản lý xuất nhập cảnh', 'Người bị tạm hoãn xuất cảnh'],
});
add('ngan-chan-khac', 'qd-huy-tam-hoan-xuat-canh', 'Quyết định hủy bỏ biện pháp tạm hoãn xuất cảnh', 'qd', {
  subject: 'Hủy bỏ biện pháp tạm hoãn xuất cảnh', canCu: [`Điều 124, Điều 125 ${BL}`, '{soQuyetDinh}'],
  xetThay: '{lyDo}', dieu: ['Hủy bỏ biện pháp tạm hoãn xuất cảnh đối với: {hoTen}; {nhanThan}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Cục Quản lý xuất nhập cảnh', 'Người được hủy bỏ'],
});
add('ngan-chan-khac', 'qd-ap-giai', 'Quyết định áp giải', 'qd', {
  subject: 'Áp giải', canCu: [`Điều 127 ${BL}`],
  xetThay: 'Người bị buộc tội {hoTen} đã được triệu tập hợp lệ mà vẫn vắng mặt không vì lý do bất khả kháng hoặc trở ngại khách quan; {lyDo}', dieu: ['Áp giải: {hoTen}; {nhanThan} đến {diaDiemHen} vào hồi {gioHen} ngày {ngayHen}.', 'Giao lực lượng Cảnh sát hỗ trợ tư pháp/cán bộ được phân công thi hành.'],
});
add('ngan-chan-khac', 'qd-dan-giai', 'Quyết định dẫn giải', 'qd', {
  subject: 'Dẫn giải', canCu: [`Điều 127 ${BL}`],
  xetThay: 'Người làm chứng/bị hại/người bị tố giác {hoTen} đã được triệu tập mà vẫn cố ý vắng mặt không vì lý do bất khả kháng hoặc trở ngại khách quan; {lyDo}', dieu: ['Dẫn giải: {hoTen}; {nhanThan} đến {diaDiemHen} vào hồi {gioHen} ngày {ngayHen}.'],
});
add('ngan-chan-khac', 'bb-ap-giai', 'Biên bản về việc áp giải, dẫn giải', 'bb', {
  canCu: `Điều 127, Điều 133 ${BL}`, hoatDong: 'thi hành {soQuyetDinh} áp giải/dẫn giải {hoTen}', heading: 'DIỄN BIẾN',
  signers: ['NGƯỜI BỊ ÁP GIẢI, DẪN GIẢI', 'NGƯỜI CHỨNG KIẾN', 'NGƯỜI THI HÀNH'],
});
add('ngan-chan-khac', 'lenh-ke-bien', 'Lệnh kê biên tài sản', 'lenh', {
  subject: 'Kê biên tài sản', canCu: [`Điều 128 ${BL}`],
  body: ['Kê biên tài sản của: {hoTen}; {nhanThan}.', 'Tài sản kê biên: {taiSan}', 'Lý do kê biên: {lyDo}'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Người có tài sản bị kê biên'],
});
add('ngan-chan-khac', 'bb-ke-bien', 'Biên bản kê biên tài sản', 'bb', {
  canCu: `Điều 128, Điều 133 ${BL}`, hoatDong: 'thi hành {soQuyetDinh} kê biên tài sản của {hoTen}', heading: 'TÀI SẢN KÊ BIÊN (tên, số lượng, khối lượng, đặc điểm, tình trạng)',
  outro: 'Tài sản kê biên được giao cho {nguoiBaoLinh} bảo quản; người bảo quản đã được giải thích trách nhiệm theo quy định của pháp luật.',
  signers: ['NGƯỜI CÓ TÀI SẢN BỊ KÊ BIÊN', 'ĐẠI DIỆN CHÍNH QUYỀN', 'NGƯỜI CHỨNG KIẾN', 'NGƯỜI THI HÀNH LỆNH'],
});
add('ngan-chan-khac', 'qd-huy-ke-bien', 'Quyết định hủy bỏ biện pháp kê biên tài sản', 'qd', {
  subject: 'Hủy bỏ biện pháp kê biên tài sản', canCu: [`Điều 128, Điều 130 ${BL}`, '{soQuyetDinh}'],
  xetThay: '{lyDo}', dieu: ['Hủy bỏ biện pháp kê biên đối với tài sản: {taiSan} của {hoTen}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Người có tài sản'],
});
add('ngan-chan-khac', 'lenh-phong-toa', 'Lệnh phong tỏa tài khoản', 'lenh', {
  subject: 'Phong tỏa tài khoản', canCu: [`Điều 129 ${BL}`],
  body: ['Phong tỏa tài khoản: {taiKhoan}', 'Của: {hoTen}; {nhanThan}.', 'Số tiền phong tỏa: {soTien}. Lý do: {lyDo}'],
  noiNhan: ['{coQuanNhan}', 'Viện kiểm sát nhân dân {vks}', 'Chủ tài khoản'],
});
add('ngan-chan-khac', 'qd-huy-phong-toa', 'Quyết định hủy bỏ biện pháp phong tỏa tài khoản', 'qd', {
  subject: 'Hủy bỏ biện pháp phong tỏa tài khoản', canCu: [`Điều 129, Điều 130 ${BL}`, '{soQuyetDinh}'],
  xetThay: '{lyDo}', dieu: ['Hủy bỏ biện pháp phong tỏa đối với tài khoản: {taiKhoan}'],
  noiNhan: ['{coQuanNhan}', 'Viện kiểm sát nhân dân {vks}', 'Chủ tài khoản'],
});

/* ---------------- Triệu tập, lời khai, đối chất, nhận dạng ---------------- */
for (const [id, who, art] of [
  ['giay-trieu-tap-bi-can', 'Bị can', 'Điều 182'],
  ['giay-trieu-tap-lam-chung', 'Người làm chứng', 'Điều 185'],
  ['giay-trieu-tap-bi-hai', 'Bị hại', 'Điều 62, Điều 188'],
  ['giay-trieu-tap-lien-quan', 'Người có quyền lợi, nghĩa vụ liên quan', 'Điều 65, Điều 188'],
  ['giay-trieu-tap-bi-to-giac', 'Người bị tố giác, bị kiến nghị khởi tố', 'Điều 57, Điều 147'],
]) {
  add('trieu-tap', id, `Giấy triệu tập ${who.toLowerCase()}`, 'giay', {
    title: 'GIẤY TRIỆU TẬP', subject: who, art,
    body: [`Căn cứ ${art} Bộ luật Tố tụng hình sự, Cơ quan yêu cầu: Ông/Bà {hoTen}; {nhanThan}.`, 'Có mặt tại: {diaDiemHen}, vào hồi {gioHen} ngày {ngayHen}, để gặp {gapAi} {mucDich}.', 'Khi đến mang theo Giấy triệu tập này và giấy tờ tùy thân. Trường hợp vắng mặt không vì lý do bất khả kháng hoặc không do trở ngại khách quan thì có thể bị dẫn giải/áp giải theo quy định tại Điều 127 Bộ luật Tố tụng hình sự.'],
    tearOff: true,
  });
}
add('trieu-tap', 'giay-moi-lam-viec', 'Giấy mời làm việc (giai đoạn giải quyết nguồn tin)', 'giay', {
  title: 'GIẤY MỜI', art: 'Điều 147',
  body: ['Để phục vụ công tác giải quyết nguồn tin về tội phạm: {tenVu}, Cơ quan trân trọng mời: Ông/Bà {hoTen}; {nhanThan}.', 'Có mặt tại: {diaDiemHen}, vào hồi {gioHen} ngày {ngayHen}, để gặp {gapAi} {mucDich}.', 'Khi đến mang theo Giấy mời này, giấy tờ tùy thân và tài liệu liên quan (nếu có).'],
});
add('trieu-tap', 'bb-doi-chat', 'Biên bản đối chất', 'bb', {
  canCu: `Điều 178, Điều 189 ${BL}`, hoatDong: 'đối chất giữa {hoTen} và {hoTen2} trong vụ án {tenVu}', heading: 'NỘI DUNG ĐỐI CHẤT',
  intro: ['Lý do đối chất: {lyDo}', 'Những người tham gia đối chất đã được giải thích quyền và nghĩa vụ; người làm chứng, bị hại được giải thích trách nhiệm về việc từ chối, trốn tránh khai báo hoặc khai báo gian dối.'],
  signers: ['NGƯỜI THAM GIA ĐỐI CHẤT', 'NGƯỜI THAM GIA ĐỐI CHẤT', 'ĐIỀU TRA VIÊN', 'NGƯỜI GHI BIÊN BẢN'], qa: true,
});
add('trieu-tap', 'bb-nhan-dang', 'Biên bản nhận dạng', 'bb', {
  canCu: `Điều 178, Điều 190 ${BL}`, hoatDong: 'cho {hoTen} nhận dạng', heading: 'DIỄN BIẾN VÀ KẾT QUẢ NHẬN DẠNG',
  intro: ['Đối tượng được đưa ra nhận dạng (ít nhất ba người/vật/ảnh có điểm bề ngoài tương tự): {doVat}', 'Người nhận dạng đã được hỏi trước về hoàn cảnh, đặc điểm mà nhờ đó có thể nhận dạng được.'],
  signers: ['NGƯỜI NHẬN DẠNG', 'NGƯỜI CHỨNG KIẾN', 'ĐIỀU TRA VIÊN'],
});
add('trieu-tap', 'bb-nhan-biet-giong-noi', 'Biên bản nhận biết giọng nói', 'bb', {
  canCu: `Điều 178, Điều 191 ${BL}`, hoatDong: 'cho {hoTen} nhận biết giọng nói', heading: 'DIỄN BIẾN VÀ KẾT QUẢ NHẬN BIẾT GIỌNG NÓI',
  signers: ['NGƯỜI NHẬN BIẾT', 'NGƯỜI CHỨNG KIẾN', 'ĐIỀU TRA VIÊN'],
});
add('trieu-tap', 'bb-giao-trieu-tap', 'Biên bản giao giấy triệu tập', 'bb', {
  canCu: `Điều 137, Điều 138 ${BL}`, hoatDong: 'giao giấy triệu tập cho {hoTen}', heading: 'NỘI DUNG',
  signers: ['NGƯỜI NHẬN', 'NGƯỜI GIAO'],
});
add('trieu-tap', 'bb-vang-mat', 'Biên bản về việc người được triệu tập vắng mặt', 'bb', {
  canCu: `Điều 133 ${BL}`, hoatDong: 'lập biên bản về việc {hoTen} đã được triệu tập hợp lệ nhưng vắng mặt', heading: 'NỘI DUNG',
  signers: ['NGƯỜI CHỨNG KIẾN', 'ĐIỀU TRA VIÊN'],
});

/* ---------------- Khám xét, thu giữ, tạm giữ ---------------- */
add('kham-xet', 'lenh-kham-xet', 'Lệnh khám xét người, chỗ ở, nơi làm việc, địa điểm, phương tiện', 'lenh', {
  subject: 'Khám xét', canCu: [`Điều 192, Điều 193, Điều 194, Điều 195 ${BL}`],
  body: ['Khám xét: {diaChiKhamXet}.', 'Của: {hoTen}; {nhanThan}.', 'Lý do khám xét: {lyDo}', 'Thời gian khám xét: {thoiHan}.'], pheChuan: true,
  noiNhan: ['Viện kiểm sát nhân dân {vks} (để phê chuẩn)', 'Người bị khám xét'],
});
add('kham-xet', 'lenh-kham-xet-khan-cap', 'Lệnh khám xét trong trường hợp khẩn cấp', 'lenh', {
  subject: 'Khám xét trong trường hợp khẩn cấp', canCu: [`Điều 193 ${BL}`],
  body: ['Khám xét: {diaChiKhamXet}.', 'Của: {hoTen}; {nhanThan}.', 'Lý do khẩn cấp: có căn cứ để khẳng định nếu không khám xét ngay thì đồ vật, tài liệu, đồ dùng cần thu giữ sẽ bị tẩu tán, tiêu hủy: {lyDo}', 'Trong thời hạn 24 giờ kể từ khi khám xét xong, phải thông báo bằng văn bản cho Viện kiểm sát nhân dân {vks}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Người bị khám xét'],
});
add('kham-xet', 'bb-kham-xet', 'Biên bản khám xét', 'bb', {
  canCu: `Điều 178, Điều 195 ${BL}`, hoatDong: 'thi hành {soQuyetDinh} khám xét {diaChiKhamXet} của {hoTen}', heading: 'DIỄN BIẾN VIỆC KHÁM XÉT, ĐỒ VẬT, TÀI LIỆU THU GIỮ, TẠM GIỮ',
  intro: ['Đã đọc lệnh khám xét, giải thích cho đương sự và những người có mặt quyền, nghĩa vụ của họ; yêu cầu đương sự đưa ra đồ vật, tài liệu có liên quan.'],
  outro: 'Đồ vật, tài liệu thu giữ được niêm phong theo quy định, có chữ ký của những người chứng kiến.',
  signers: ['NGƯỜI BỊ KHÁM XÉT', 'ĐẠI DIỆN CHÍNH QUYỀN', 'NGƯỜI CHỨNG KIẾN', 'ĐIỀU TRA VIÊN'],
});
add('kham-xet', 'lenh-thu-giu-thu-tin', 'Lệnh thu giữ thư tín, điện tín, bưu kiện, bưu phẩm', 'lenh', {
  subject: 'Thu giữ thư tín, điện tín, bưu kiện, bưu phẩm', canCu: [`Điều 198 ${BL}`],
  body: ['Thu giữ: {doVat}', 'Của/gửi cho: {hoTen}; tại {coQuanNhan}.', 'Lý do thu giữ: {lyDo}'], pheChuan: true,
  noiNhan: ['Viện kiểm sát nhân dân {vks} (để phê chuẩn)', '{coQuanNhan}'],
});
add('kham-xet', 'lenh-thu-giu-dien-tu', 'Lệnh thu giữ phương tiện điện tử, dữ liệu điện tử', 'lenh', {
  subject: 'Thu giữ phương tiện điện tử, dữ liệu điện tử', canCu: [`Điều 107, Điều 196 ${BL}`],
  body: ['Thu giữ phương tiện điện tử, dữ liệu điện tử: {doVat}', 'Của: {hoTen}; {nhanThan}.', 'Lý do thu giữ: {lyDo}'], pheChuan: true,
  noiNhan: ['Viện kiểm sát nhân dân {vks} (để phê chuẩn)', 'Người có phương tiện, dữ liệu bị thu giữ'],
});
add('kham-xet', 'bb-thu-giu', 'Biên bản thu giữ đồ vật, tài liệu, phương tiện, dữ liệu điện tử', 'bb', {
  canCu: `Điều 107, Điều 178, Điều 196, Điều 198 ${BL}`, hoatDong: 'thu giữ đồ vật, tài liệu, phương tiện, dữ liệu điện tử của {hoTen}', heading: 'ĐỒ VẬT, TÀI LIỆU, PHƯƠNG TIỆN, DỮ LIỆU THU GIỮ (tên, số lượng, đặc điểm, tình trạng, cách niêm phong)',
  signers: ['NGƯỜI CÓ ĐỒ VẬT BỊ THU GIỮ', 'NGƯỜI CHỨNG KIẾN', 'ĐIỀU TRA VIÊN'],
});
add('kham-xet', 'lenh-tam-giu-do-vat', 'Lệnh tạm giữ đồ vật, tài liệu', 'lenh', {
  subject: 'Tạm giữ đồ vật, tài liệu', canCu: [`Điều 199 ${BL}`],
  body: ['Tạm giữ đồ vật, tài liệu: {doVat}', 'Của: {hoTen}; {nhanThan}.', 'Lý do tạm giữ: {lyDo}'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Người có đồ vật, tài liệu bị tạm giữ'],
});
add('kham-xet', 'bb-tam-giu-do-vat', 'Biên bản tạm giữ đồ vật, tài liệu', 'bb', {
  canCu: `Điều 178, Điều 199 ${BL}`, hoatDong: 'tạm giữ đồ vật, tài liệu của {hoTen}', heading: 'ĐỒ VẬT, TÀI LIỆU TẠM GIỮ (tên, số lượng, đặc điểm, tình trạng)',
  signers: ['NGƯỜI CÓ ĐỒ VẬT BỊ TẠM GIỮ', 'NGƯỜI CHỨNG KIẾN', 'ĐIỀU TRA VIÊN'],
});
add('kham-xet', 'bb-niem-phong', 'Biên bản niêm phong / mở niêm phong vật chứng', 'bb', {
  canCu: `Điều 90, Điều 178 ${BL}`, hoatDong: 'niêm phong/mở niêm phong đồ vật, tài liệu: {doVat}', heading: 'TÌNH TRẠNG NIÊM PHONG VÀ ĐỒ VẬT',
  signers: ['NGƯỜI CÓ ĐỒ VẬT', 'NGƯỜI CHỨNG KIẾN', 'ĐIỀU TRA VIÊN'],
});

/* ---------------- Khám nghiệm, thực nghiệm ---------------- */
add('kham-nghiem', 'bb-kham-nghiem-hien-truong', 'Biên bản khám nghiệm hiện trường', 'bb', {
  canCu: `Điều 178, Điều 201 ${BL}`, hoatDong: 'khám nghiệm hiện trường vụ {tenVu}', heading: 'MÔ TẢ HIỆN TRƯỜNG, DẤU VẾT, VẬT CHỨNG THU ĐƯỢC',
  intro: ['Điều kiện khám nghiệm (thời tiết, ánh sáng): {lyDo}', 'Hiện trường được bảo vệ từ: {thoiGianXayRa}.'],
  outro: 'Kèm theo biên bản: sơ đồ hiện trường, bản ảnh, các mẫu vật, dấu vết thu được đã niêm phong.',
  signers: ['NGƯỜI CHỨNG KIẾN', 'ĐẠI DIỆN VIỆN KIỂM SÁT', 'NGƯỜI CHỈ HUY KHÁM NGHIỆM', 'NGƯỜI LẬP BIÊN BẢN'],
});
add('kham-nghiem', 'bb-kham-nghiem-tu-thi', 'Biên bản khám nghiệm tử thi', 'bb', {
  canCu: `Điều 178, Điều 202 ${BL}`, hoatDong: 'khám nghiệm tử thi: {hoTen}', heading: 'KẾT QUẢ KHÁM NGHIỆM (khám ngoài, khám trong, dấu vết, thương tích)',
  signers: ['NGƯỜI CHỨNG KIẾN', 'BÁC SĨ PHÁP Y', 'ĐẠI DIỆN VIỆN KIỂM SÁT', 'ĐIỀU TRA VIÊN'],
});
add('kham-nghiem', 'qd-khai-quat-tu-thi', 'Quyết định khai quật tử thi', 'qd', {
  subject: 'Khai quật tử thi', canCu: [`Điều 202 ${BL}`],
  xetThay: '{lyDo}', dieu: ['Khai quật tử thi: {hoTen}, chôn cất tại {diaDiem}.', 'Thông báo cho gia đình người chết biết trước khi tiến hành; mời bác sĩ pháp y, người chứng kiến tham gia.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Gia đình người chết'],
});
add('kham-nghiem', 'bb-xem-xet-dau-vet', 'Biên bản xem xét dấu vết trên thân thể', 'bb', {
  canCu: `Điều 178, Điều 203 ${BL}`, hoatDong: 'xem xét dấu vết trên thân thể của {hoTen}', heading: 'DẤU VẾT PHÁT HIỆN',
  signers: ['NGƯỜI BỊ XEM XÉT', 'NGƯỜI CHỨNG KIẾN', 'ĐIỀU TRA VIÊN'],
});
add('kham-nghiem', 'qd-thuc-nghiem', 'Quyết định thực nghiệm điều tra', 'qd', {
  subject: 'Thực nghiệm điều tra', canCu: [`Điều 204 ${BL}`],
  xetThay: 'Để kiểm tra, xác minh tài liệu, tình tiết có ý nghĩa đối với vụ án: {lyDo}', dieu: ['Tiến hành thực nghiệm điều tra trong vụ án {tenVu}, tại {diaDiem}, vào {thoiGianXayRa}.', 'Nội dung thực nghiệm: {noiDung}'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}'],
});
add('kham-nghiem', 'bb-thuc-nghiem', 'Biên bản thực nghiệm điều tra', 'bb', {
  canCu: `Điều 178, Điều 204 ${BL}`, hoatDong: 'thực nghiệm điều tra theo {soQuyetDinh}', heading: 'DIỄN BIẾN VÀ KẾT QUẢ THỰC NGHIỆM',
  signers: ['NGƯỜI THAM GIA', 'NGƯỜI CHỨNG KIẾN', 'ĐẠI DIỆN VIỆN KIỂM SÁT', 'ĐIỀU TRA VIÊN'],
});

/* ---------------- Giám định, định giá ---------------- */
add('giam-dinh', 'qd-trung-cau-giam-dinh', 'Quyết định trưng cầu giám định', 'qd', {
  subject: 'Trưng cầu giám định', canCu: [`Điều 205, Điều 206 ${BL}`],
  xetThay: 'Để làm rõ tình tiết của vụ án {tenVu}: {lyDo}', dieu: ['Trưng cầu: {toChucGiamDinh} tiến hành giám định.', 'Đối tượng giám định: {doiTuongGiamDinh}', 'Nội dung yêu cầu giám định: {noiDungGiamDinh}', 'Thời hạn trả kết luận giám định: {thoiHanGiamDinh}.'],
  noiNhan: ['{toChucGiamDinh}', 'Viện kiểm sát nhân dân {vks}'],
});
add('giam-dinh', 'qd-trung-cau-giam-dinh-bo-sung', 'Quyết định trưng cầu giám định bổ sung', 'qd', {
  subject: 'Trưng cầu giám định bổ sung', canCu: [`Điều 210 ${BL}`],
  xetThay: 'Nội dung kết luận giám định {soQuyetDinh} chưa rõ, chưa đầy đủ hoặc phát sinh vấn đề mới: {lyDo}', dieu: ['Trưng cầu: {toChucGiamDinh} giám định bổ sung.', 'Đối tượng giám định: {doiTuongGiamDinh}', 'Nội dung yêu cầu giám định bổ sung: {noiDungGiamDinh}'],
  noiNhan: ['{toChucGiamDinh}', 'Viện kiểm sát nhân dân {vks}'],
});
add('giam-dinh', 'qd-trung-cau-giam-dinh-lai', 'Quyết định trưng cầu giám định lại', 'qd', {
  subject: 'Trưng cầu giám định lại', canCu: [`Điều 211 ${BL}`],
  xetThay: 'Có nghi ngờ kết quả giám định lần đầu {soQuyetDinh}: {lyDo}', dieu: ['Trưng cầu: {toChucGiamDinh} giám định lại.', 'Đối tượng giám định: {doiTuongGiamDinh}', 'Nội dung yêu cầu: {noiDungGiamDinh}'],
  noiNhan: ['{toChucGiamDinh}', 'Viện kiểm sát nhân dân {vks}'],
});
add('giam-dinh', 'qd-yeu-cau-dinh-gia', 'Quyết định yêu cầu định giá tài sản', 'qd', {
  subject: 'Yêu cầu định giá tài sản', canCu: [`Điều 215 ${BL}`],
  xetThay: 'Để xác định giá trị tài sản liên quan đến vụ án {tenVu}: {lyDo}', dieu: ['Yêu cầu: {toChucGiamDinh} định giá tài sản.', 'Tài sản cần định giá: {doiTuongGiamDinh}', 'Thời điểm định giá và nội dung yêu cầu: {noiDungGiamDinh}'],
  noiNhan: ['{toChucGiamDinh}', 'Viện kiểm sát nhân dân {vks}'],
});
add('giam-dinh', 'qd-yeu-cau-dinh-gia-lai', 'Quyết định yêu cầu định giá lại tài sản', 'qd', {
  subject: 'Yêu cầu định giá lại tài sản', canCu: [`Điều 218 ${BL}`],
  xetThay: 'Có nghi ngờ kết luận định giá {soQuyetDinh}: {lyDo}', dieu: ['Yêu cầu: {toChucGiamDinh} định giá lại tài sản: {doiTuongGiamDinh}'],
  noiNhan: ['{toChucGiamDinh}', 'Viện kiểm sát nhân dân {vks}'],
});
add('giam-dinh', 'bb-lay-mau', 'Biên bản lấy mẫu vật để giám định', 'bb', {
  canCu: `Điều 178, Điều 207 ${BL}`, hoatDong: 'lấy mẫu vật để giám định trong vụ án {tenVu}', heading: 'MẪU VẬT ĐÃ LẤY, CÁCH THỨC LẤY VÀ NIÊM PHONG',
  signers: ['NGƯỜI BỊ LẤY MẪU', 'NGƯỜI CHỨNG KIẾN', 'ĐIỀU TRA VIÊN'],
});
add('giam-dinh', 'tb-ket-luan-giam-dinh', 'Thông báo kết luận giám định / định giá tài sản', 'tb', {
  subject: 'Kết luận giám định, định giá tài sản', kinhGui: '{kinhGui}',
  body: ['Căn cứ Điều 213, Điều 220 Bộ luật Tố tụng hình sự, Cơ quan thông báo kết luận {soQuyetDinh} trong vụ án {tenVu} như sau:', '{ketQua}', 'Trong thời hạn quy định, người được thông báo có quyền trình bày ý kiến, đề nghị giám định/định giá bổ sung hoặc lại.'],
});

/* ---------------- Vật chứng, tài sản ---------------- */
add('vat-chung', 'qd-xu-ly-vat-chung', 'Quyết định xử lý vật chứng', 'qd', {
  subject: 'Xử lý vật chứng', canCu: [`Điều 106 ${BL}`],
  xetThay: '{lyDo}', dieu: ['Xử lý vật chứng trong vụ án {tenVu} như sau: {vatChung}', 'Biện pháp xử lý: {cachXuLy}'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Cơ quan quản lý vật chứng'],
});
add('vat-chung', 'qd-tra-lai-tai-san', 'Quyết định trả lại tài sản, đồ vật, tài liệu', 'qd', {
  subject: 'Trả lại tài sản, đồ vật, tài liệu', canCu: [`Điều 106 ${BL}`],
  xetThay: 'Tài sản, đồ vật không phải là vật chứng/việc trả lại không ảnh hưởng đến việc xử lý vụ án: {lyDo}', dieu: ['Trả lại cho {hoTen}: {taiSan}'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Người được trả lại'],
});
add('vat-chung', 'bb-giao-nhan-vat-chung', 'Biên bản giao nhận vật chứng, tài sản', 'bb', {
  canCu: `Điều 90, Điều 106 ${BL}`, hoatDong: 'giao nhận vật chứng, tài sản trong vụ án {tenVu}', heading: 'VẬT CHỨNG, TÀI SẢN GIAO NHẬN (tên, số lượng, tình trạng niêm phong)',
  signers: ['BÊN GIAO', 'BÊN NHẬN'],
});
add('vat-chung', 'bb-tra-lai-tai-san', 'Biên bản trả lại tài sản, đồ vật, tài liệu', 'bb', {
  canCu: `Điều 106 ${BL}`, hoatDong: 'trả lại tài sản, đồ vật, tài liệu cho {hoTen} theo {soQuyetDinh}', heading: 'TÀI SẢN, ĐỒ VẬT, TÀI LIỆU TRẢ LẠI',
  signers: ['NGƯỜI NHẬN LẠI', 'NGƯỜI CHỨNG KIẾN', 'ĐIỀU TRA VIÊN'],
});
add('vat-chung', 'bb-tieu-huy-vat-chung', 'Biên bản tiêu hủy vật chứng', 'bb', {
  canCu: `Điều 106 ${BL}`, hoatDong: 'tiêu hủy vật chứng theo {soQuyetDinh}', heading: 'VẬT CHỨNG TIÊU HỦY, PHƯƠNG PHÁP TIÊU HỦY',
  signers: ['ĐẠI DIỆN VIỆN KIỂM SÁT', 'NGƯỜI CHỨNG KIẾN', 'HỘI ĐỒNG / ĐIỀU TRA VIÊN'],
});
add('vat-chung', 'bb-giao-nhan-ho-so', 'Biên bản giao nhận hồ sơ, tài liệu', 'bb', {
  canCu: `Điều 133 ${BL}`, hoatDong: 'giao nhận hồ sơ, tài liệu vụ án {tenVu}', heading: 'HỒ SƠ, TÀI LIỆU GIAO NHẬN (số bút lục, tình trạng)',
  signers: ['BÊN GIAO', 'BÊN NHẬN'],
});

/* ---------------- Bào chữa, bảo vệ ---------------- */
add('bao-chua', 'tb-dang-ky-bao-chua', 'Thông báo người bào chữa (xác nhận đăng ký bào chữa)', 'tb', {
  subject: 'Người bào chữa', kinhGui: '{kinhGui}',
  body: ['Căn cứ Điều 78 Bộ luật Tố tụng hình sự; xét hồ sơ đăng ký bào chữa của {nguoiBaoChua}.', 'Cơ quan thông báo: {nguoiBaoChua} là người bào chữa cho {hoTen} trong vụ án {tenVu}, về tội {toiDanh}.', 'Người bào chữa có quyền và nghĩa vụ theo quy định tại Điều 73 Bộ luật Tố tụng hình sự.'],
});
add('bao-chua', 'tb-tu-choi-bao-chua', 'Thông báo từ chối việc đăng ký bào chữa', 'tb', {
  subject: 'Từ chối việc đăng ký bào chữa', kinhGui: '{kinhGui}',
  body: ['Căn cứ Điều 78 Bộ luật Tố tụng hình sự; xét hồ sơ đăng ký bào chữa của {nguoiBaoChua} cho {hoTen}.', 'Cơ quan từ chối việc đăng ký bào chữa vì: {lyDo}'],
});
add('bao-chua', 'tb-hoat-dong-dieu-tra', 'Thông báo thời gian, địa điểm tiến hành hoạt động điều tra cho người bào chữa', 'tb', {
  subject: 'Thời gian, địa điểm tiến hành hoạt động điều tra', kinhGui: '{nguoiBaoChua}',
  body: ['Căn cứ Điều 79 Bộ luật Tố tụng hình sự, Cơ quan thông báo: vào hồi {gioHen} ngày {ngayHen}, tại {diaDiemHen}, Điều tra viên sẽ tiến hành {mucDich} đối với {hoTen} trong vụ án {tenVu}.', 'Đề nghị người bào chữa có mặt để tham gia theo quy định.'],
});
add('bao-chua', 'yc-chi-dinh-bao-chua', 'Văn bản đề nghị cử người bào chữa (chỉ định)', 'dn', {
  subject: 'Đề nghị cử người bào chữa', kinhGui: '{coQuanNhan}',
  body: ['Căn cứ Điều 76 Bộ luật Tố tụng hình sự; người bị buộc tội {hoTen}; {nhanThan} thuộc trường hợp bắt buộc phải có người bào chữa: {lyDo}', 'Đề nghị {coQuanNhan} cử người bào chữa cho {hoTen} trong vụ án {tenVu}.'],
});
add('bao-chua', 'qd-bao-ve-nguoi-to-giac', 'Quyết định áp dụng biện pháp bảo vệ người tố giác, người làm chứng, bị hại', 'qd', {
  subject: 'Áp dụng biện pháp bảo vệ', canCu: [`Điều 484, Điều 486 ${BL}`],
  xetThay: 'Có căn cứ xác định tính mạng, sức khỏe, tài sản, danh dự của {hoTen} bị đe dọa: {lyDo}', dieu: ['Áp dụng biện pháp bảo vệ đối với: {hoTen}; {nhanThan}.', 'Biện pháp bảo vệ: {bienPhap}; thời hạn: {thoiHan}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Người được bảo vệ'],
});

/* ---------------- Thời hạn, tạm đình chỉ, phục hồi, đình chỉ ---------------- */
add('thoi-han', 'dn-gia-han-dieu-tra', 'Văn bản đề nghị gia hạn thời hạn điều tra', 'dn', {
  subject: 'Đề nghị gia hạn thời hạn điều tra', kinhGui: 'Viện kiểm sát nhân dân {vks}',
  body: ['Vụ án {tenVu}, khởi tố về tội {toiDanh} theo {soQuyetDinh}; thời hạn điều tra hết vào ngày {denNgay}.', 'Do vụ án có nhiều tình tiết phức tạp, cần tiếp tục: {lyDo}', 'Căn cứ Điều 172 Bộ luật Tố tụng hình sự, đề nghị Viện kiểm sát nhân dân {vks} gia hạn thời hạn điều tra lần thứ {lan}, thời hạn {thoiHan}.'],
});
add('thoi-han', 'qd-tam-dinh-chi-dieu-tra', 'Quyết định tạm đình chỉ điều tra vụ án', 'qd', {
  subject: 'Tạm đình chỉ điều tra vụ án hình sự', canCu: [`Điều 229 ${BL}`],
  xetThay: '{lyDo}', dieu: ['Tạm đình chỉ điều tra vụ án hình sự: {tenVu}, khởi tố về tội {toiDanh}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Bị can, bị hại, người đại diện'],
});
add('thoi-han', 'qd-tam-dinh-chi-dieu-tra-bi-can', 'Quyết định tạm đình chỉ điều tra đối với bị can', 'qd', {
  subject: 'Tạm đình chỉ điều tra đối với bị can', canCu: [`Điều 229 ${BL}`],
  xetThay: '{lyDo}', dieu: ['Tạm đình chỉ điều tra đối với bị can: {hoTen}; {nhanThan}, về tội {toiDanh}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Bị can'],
});
add('thoi-han', 'qd-phuc-hoi-dieu-tra', 'Quyết định phục hồi điều tra vụ án', 'qd', {
  subject: 'Phục hồi điều tra vụ án hình sự', canCu: [`Điều 235 ${BL}`, '{soQuyetDinh}'],
  xetThay: 'Lý do tạm đình chỉ điều tra không còn: {lyDo}', dieu: ['Phục hồi điều tra vụ án hình sự: {tenVu}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}'],
});
add('thoi-han', 'qd-phuc-hoi-dieu-tra-bi-can', 'Quyết định phục hồi điều tra đối với bị can', 'qd', {
  subject: 'Phục hồi điều tra đối với bị can', canCu: [`Điều 235 ${BL}`, '{soQuyetDinh}'],
  xetThay: 'Lý do tạm đình chỉ điều tra đối với bị can không còn: {lyDo}', dieu: ['Phục hồi điều tra đối với bị can: {hoTen}; {nhanThan}, về tội {toiDanh}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Bị can'],
});
add('thoi-han', 'qd-dinh-chi-dieu-tra', 'Quyết định đình chỉ điều tra vụ án', 'qd', {
  subject: 'Đình chỉ điều tra vụ án hình sự', canCu: [`Điều 230 ${BL}`],
  xetThay: '{lyDo}', dieu: ['Đình chỉ điều tra vụ án hình sự: {tenVu}, khởi tố về tội {toiDanh}.', 'Hủy bỏ các biện pháp ngăn chặn, biện pháp cưỡng chế đã áp dụng; xử lý vật chứng: {vatChung}'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Bị can, bị hại, người đại diện'],
});
add('thoi-han', 'qd-dinh-chi-dieu-tra-bi-can', 'Quyết định đình chỉ điều tra đối với bị can', 'qd', {
  subject: 'Đình chỉ điều tra đối với bị can', canCu: [`Điều 230 ${BL}`],
  xetThay: '{lyDo}', dieu: ['Đình chỉ điều tra đối với bị can: {hoTen}; {nhanThan}, về tội {toiDanh}.', 'Hủy bỏ biện pháp ngăn chặn, biện pháp cưỡng chế đã áp dụng đối với bị can.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Bị can'],
});

/* ---------------- Kết thúc điều tra ---------------- */
add('ket-thuc', 'kl-de-nghi-truy-to', 'Bản kết luận điều tra vụ án hình sự đề nghị truy tố', 'kl', {
  subject: 'Đề nghị truy tố',
  sections: [['I. DIỄN BIẾN HÀNH VI PHẠM TỘI', 'dienBien'], ['II. CHỨNG CỨ XÁC ĐỊNH HÀNH VI PHẠM TỘI', 'chungCu'], ['III. TÌNH TIẾT TĂNG NẶNG, GIẢM NHẸ; NHÂN THÂN BỊ CAN', 'tinhTiet'], ['IV. VẬT CHỨNG, TÀI SẢN VÀ BIỆN PHÁP ĐÃ ÁP DỤNG', 'xuLyVatChung'], ['V. KẾT LUẬN VÀ ĐỀ NGHỊ', 'deNghi']],
  intro: 'Căn cứ Điều 232 Bộ luật Tố tụng hình sự; ngày {thoiGianXayRa}, Cơ quan đã khởi tố vụ án hình sự {tenVu} về tội {toiDanh}; khởi tố bị can: {hoTen}; {nhanThan}.',
  noiNhan: ['Viện kiểm sát nhân dân {vks} (kèm hồ sơ vụ án)', 'Bị can, người bào chữa'],
});
add('ket-thuc', 'kl-dinh-chi', 'Bản kết luận điều tra vụ án hình sự đề nghị đình chỉ', 'kl', {
  subject: 'Đình chỉ điều tra',
  sections: [['I. DIỄN BIẾN SỰ VIỆC', 'dienBien'], ['II. KẾT QUẢ ĐIỀU TRA', 'chungCu'], ['III. LÝ DO VÀ CĂN CỨ ĐÌNH CHỈ', 'lyDo'], ['IV. XỬ LÝ VẬT CHỨNG, TÀI SẢN', 'xuLyVatChung'], ['V. KẾT LUẬN', 'deNghi']],
  intro: 'Căn cứ Điều 230, Điều 234 Bộ luật Tố tụng hình sự; vụ án hình sự {tenVu} khởi tố về tội {toiDanh}.',
  noiNhan: ['Viện kiểm sát nhân dân {vks} (kèm hồ sơ vụ án)', 'Bị can, bị hại'],
});
add('ket-thuc', 'tb-ket-thuc-dieu-tra', 'Thông báo kết thúc điều tra (gửi bị can, người bào chữa, bị hại)', 'tb', {
  subject: 'Kết thúc điều tra', kinhGui: '{kinhGui}',
  body: ['Cơ quan thông báo: ngày {tuNgay} đã kết thúc điều tra vụ án hình sự {tenVu}.', 'Bản kết luận điều tra đã đề nghị: {ketQua}', 'Người được thông báo có quyền đọc, ghi chép, sao chụp tài liệu trong hồ sơ theo quy định của Bộ luật Tố tụng hình sự.'],
});
add('ket-thuc', 'bb-giao-nhan-ho-so-vks', 'Biên bản giao nhận hồ sơ vụ án (chuyển Viện kiểm sát)', 'bb', {
  canCu: `Điều 232, Điều 236 ${BL}`, hoatDong: 'giao hồ sơ vụ án {tenVu} kèm Bản kết luận điều tra cho Viện kiểm sát nhân dân {vks}', heading: 'HỒ SƠ, VẬT CHỨNG GIAO NHẬN (số tập, số bút lục, vật chứng kèm theo)',
  signers: ['ĐẠI DIỆN VIỆN KIỂM SÁT (BÊN NHẬN)', 'ĐẠI DIỆN CƠ QUAN ĐIỀU TRA (BÊN GIAO)'],
});
add('ket-thuc', 'bb-doc-ket-luan', 'Biên bản giao Bản kết luận điều tra cho bị can', 'bb', {
  canCu: `Điều 232 ${BL}`, hoatDong: 'giao Bản kết luận điều tra vụ án {tenVu} cho bị can {hoTen}', heading: 'NỘI DUNG',
  signers: ['BỊ CAN', 'ĐIỀU TRA VIÊN'],
});

/* ---------------- Thủ tục đặc biệt ---------------- */
add('dac-biet', 'qd-truy-na', 'Quyết định truy nã', 'qd', {
  subject: 'Truy nã', canCu: [`Điều 231 ${BL}`],
  xetThay: 'Bị can {hoTen} đã bỏ trốn/không biết đang ở đâu: {lyDo}', dieu: ['Truy nã bị can: {hoTen}; {nhanThan}; đặc điểm nhận dạng: {doVat}', 'Về tội: {toiDanh}. Ai phát hiện, đề nghị báo ngay cho cơ quan Công an hoặc chính quyền nơi gần nhất.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Các cơ quan Công an', 'Phương tiện thông tin đại chúng'],
});
add('dac-biet', 'qd-dinh-na', 'Quyết định đình nã', 'qd', {
  subject: 'Đình nã', canCu: [`Điều 231 ${BL}`, '{soQuyetDinh}'],
  xetThay: '{lyDo}', dieu: ['Đình nã đối với bị can: {hoTen}; {nhanThan}, bị truy nã theo {soQuyetDinh}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks}', 'Các cơ quan đã nhận Quyết định truy nã'],
});
add('dac-biet', 'bb-dau-thu', 'Biên bản về việc người phạm tội tự thú, đầu thú', 'bb', {
  canCu: `Điều 152 ${BL}`, hoatDong: 'tiếp nhận người phạm tội tự thú, đầu thú: {hoTen}; {nhanThan}', heading: 'NỘI DUNG TRÌNH BÀY CỦA NGƯỜI TỰ THÚ, ĐẦU THÚ',
  signers: ['NGƯỜI TỰ THÚ, ĐẦU THÚ', 'NGƯỜI TIẾP NHẬN'],
});
add('dac-biet', 'giay-moi-dai-dien-nguoi-duoi-18', 'Giấy mời người đại diện, nhà trường tham gia (người dưới 18 tuổi)', 'giay', {
  title: 'GIẤY MỜI', art: 'Điều 421',
  body: ['Căn cứ Điều 421 Bộ luật Tố tụng hình sự, Cơ quan mời: {nguoiDaiDien}.', 'Là người đại diện của người dưới 18 tuổi: {hoTen}; {nhanThan}.', 'Có mặt tại {diaDiemHen}, vào hồi {gioHen} ngày {ngayHen}, để tham gia việc {mucDich}.'],
});
add('dac-biet', 'qd-khoi-to-phap-nhan', 'Quyết định khởi tố bị can là pháp nhân thương mại', 'qd', {
  subject: 'Khởi tố bị can (pháp nhân thương mại)', canCu: ['Chương XXIX Bộ luật Tố tụng hình sự', '{soQuyetDinh}'],
  xetThay: 'Có đủ căn cứ xác định pháp nhân thương mại đã thực hiện hành vi phạm tội: {tomTat}', dieu: ['Khởi tố bị can đối với pháp nhân thương mại: {phapNhan}', 'Về tội: {toiDanh}.'],
  noiNhan: ['Viện kiểm sát nhân dân {vks} (để phê chuẩn)', 'Pháp nhân bị khởi tố'],
});
add('dac-biet', 'yc-uy-thac-dieu-tra', 'Quyết định ủy thác điều tra', 'qd', {
  subject: 'Ủy thác điều tra', canCu: [`Điều 170 ${BL}`],
  xetThay: 'Cần tiến hành một số hoạt động điều tra tại địa phương khác: {lyDo}', dieu: ['Ủy thác cho {coQuanNhan} tiến hành các hoạt động điều tra sau trong vụ án {tenVu}: {noiDung}', 'Thời hạn thực hiện và gửi kết quả: {thoiHan}.'],
  noiNhan: ['{coQuanNhan}', 'Viện kiểm sát nhân dân {vks}'],
});
add('dac-biet', 'dn-bien-phap-dac-biet', 'Văn bản đề nghị áp dụng biện pháp điều tra tố tụng đặc biệt', 'dn', {
  subject: 'Đề nghị áp dụng biện pháp điều tra tố tụng đặc biệt', kinhGui: 'Viện trưởng Viện kiểm sát nhân dân {vks}',
  body: ['Căn cứ Điều 223, Điều 224 Bộ luật Tố tụng hình sự; vụ án {tenVu} khởi tố về tội {toiDanh}.', 'Đề nghị phê chuẩn áp dụng biện pháp: {bienPhap}, đối với: {hoTen}; thời hạn: {thoiHan}.', 'Lý do, căn cứ: {lyDo}'],
});

/* ---------------- Dùng chung ---------------- */
add('chung', 'bb-lam-viec', 'Biên bản làm việc', 'bb', {
  canCu: `Điều 133 ${BL}`, hoatDong: 'làm việc với {hoTen} về {mucDich}', heading: 'NỘI DUNG LÀM VIỆC',
  signers: ['ĐẠI DIỆN BÊN LÀM VIỆC', 'ĐIỀU TRA VIÊN / CÁN BỘ ĐIỀU TRA'],
});
add('chung', 'bb-xac-minh', 'Biên bản kiểm tra, xác minh', 'bb', {
  canCu: `Điều 147 ${BL}`, hoatDong: 'kiểm tra, xác minh {mucDich}', heading: 'KẾT QUẢ KIỂM TRA, XÁC MINH',
  signers: ['NGƯỜI ĐƯỢC XÁC MINH / ĐẠI DIỆN', 'NGƯỜI XÁC MINH'],
});
add('chung', 'bb-giao-nhan-van-ban', 'Biên bản giao, nhận văn bản tố tụng', 'bb', {
  canCu: `Điều 137, Điều 138 ${BL}`, hoatDong: 'giao {soQuyetDinh} cho {hoTen}', heading: 'NỘI DUNG',
  signers: ['NGƯỜI NHẬN', 'NGƯỜI GIAO'],
});
add('chung', 'bb-niem-yet', 'Biên bản niêm yết công khai văn bản tố tụng', 'bb', {
  canCu: `Điều 140 ${BL}`, hoatDong: 'niêm yết công khai {soQuyetDinh} tại {diaDiem}', heading: 'NỘI DUNG',
  signers: ['ĐẠI DIỆN CHÍNH QUYỀN', 'NGƯỜI CHỨNG KIẾN', 'NGƯỜI THỰC HIỆN'],
});
add('chung', 'bb-thong-bao-quyen', 'Biên bản về việc thông báo, giải thích quyền và nghĩa vụ', 'bb', {
  canCu: `Điều 71 ${BL}`, hoatDong: 'thông báo, giải thích quyền và nghĩa vụ cho {hoTen} (tư cách: {quanHe})', heading: 'QUYỀN VÀ NGHĨA VỤ ĐÃ ĐƯỢC THÔNG BÁO, GIẢI THÍCH',
  signers: ['NGƯỜI ĐƯỢC THÔNG BÁO', 'ĐIỀU TRA VIÊN'],
});
add('chung', 'bb-su-viec', 'Biên bản sự việc', 'bb', {
  canCu: `Điều 133 ${BL}`, hoatDong: 'lập biên bản sự việc: {mucDich}', heading: 'NỘI DUNG SỰ VIỆC',
  signers: ['NGƯỜI CHỨNG KIẾN', 'NGƯỜI LẬP BIÊN BẢN'],
});
add('chung', 'yc-cong-van', 'Công văn đề nghị phối hợp', 'yc', {
  subject: 'Đề nghị phối hợp', kinhGui: '{coQuanNhan}',
  body: ['Để phục vụ công tác điều tra vụ án {tenVu}, Cơ quan đề nghị {coQuanNhan} phối hợp: {noiDung}', 'Thông tin liên hệ: {gapAi}.'],
});

// Ký hiệu riêng cho từng loại lệnh.
const KY_RIENG = { 'lenh-bat-khan-cap': 'LB', 'lenh-bat-tam-giam': 'LBTG', 'lenh-tam-giam': 'LTG', 'lenh-cam-di-khoi-noi-cu-tru': 'LCĐKNCT', 'lenh-ke-bien': 'LKB', 'lenh-phong-toa': 'LPT', 'lenh-kham-xet': 'LKX', 'lenh-kham-xet-khan-cap': 'LKX', 'lenh-thu-giu-thu-tin': 'LTG', 'lenh-thu-giu-dien-tu': 'LTG', 'lenh-tam-giu-do-vat': 'LTGĐV' };
for (const f of F) if (KY_RIENG[f.id]) f.ky = KY_RIENG[f.id];
export const FORMS = F;
export const findForm = (id) => F.find((f) => f.id === id) || null;
export const LOAI = { qd: 'Quyết định', lenh: 'Lệnh', bb: 'Biên bản', tb: 'Thông báo', giay: 'Giấy triệu tập / mời', yc: 'Yêu cầu / công văn', dn: 'Đề nghị', kl: 'Kết luận điều tra', cd: 'Cam đoan' };
/** Ký hiệu loại văn bản trong số hiệu (Số: …/QĐ-…). */
export const KY_HIEU_LOAI = { qd: 'QĐ', lenh: 'L', bb: 'BB', tb: 'TB', giay: 'GTT', yc: 'CV', dn: 'CV', kl: 'KLĐT', cd: '' };

/** Danh sách khóa trường (theo thứ tự xuất hiện) dùng trong một mẫu. */
export function formKeys(form) {
  const text = JSON.stringify(form);
  const keys = [];
  for (const m of text.matchAll(/\{([a-zA-Z0-9]+)\}/g)) if (FIELDS[m[1]] && !keys.includes(m[1])) keys.push(m[1]);
  if (form.loai === 'bb') for (const k of ['diaDiem', 'thanhPhan', 'nguoiChungKien', 'noiDung']) if (!keys.includes(k)) keys.push(k);
  if (form.qa && !keys.includes('noiDung')) keys.push('noiDung');
  if (form.loai === 'kl') for (const [, k] of form.sections) if (!keys.includes(k)) keys.push(k);
  if (['qd', 'lenh', 'tb', 'giay', 'yc', 'dn', 'kl'].includes(form.loai)) keys.unshift('so');
  return keys;
}
