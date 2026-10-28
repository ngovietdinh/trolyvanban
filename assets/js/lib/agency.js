// Cơ quan làm việc: Tòa án nhân dân hoặc Cơ quan Cảnh sát điều tra. Người dùng chọn một lần sau khi đăng nhập (lưu
// theo tài khoản), đổi được bất cứ lúc nào. Mỗi cơ quan có bộ mục điều hướng, lối tắt, thanh dưới điện thoại riêng;
// các màn hình vẫn mở được bằng đường dẫn, chỉ điều hướng được thu gọn cho đúng việc của cơ quan.
import { store, getScope } from './store.js';

// Lưu theo tài khoản nhưng dùng chung cho cả môi trường bình thường và bảo mật (chỉ là lựa chọn giao diện, không phải
// dữ liệu nghiệp vụ): khóa `agency:<tài khoản>`.
export const agencyKey = () => `agency:${getScope() || 'anon'}`;

/** Mục điều hướng: [đường dẫn (không có #), biểu tượng, nhãn, mô tả ngắn]. */
export const AGENCIES = {
  'toa-an': {
    id: 'toa-an',
    ten: 'Tòa án nhân dân',
    ngan: 'Tòa án',
    nhan: 'Tòa án nhân dân',
    mark: 'scales',
    moTa: 'Thẩm phán, thư ký, thẩm tra viên: sổ vụ án sơ thẩm và phúc thẩm, thời hạn tố tụng, thẩm tra hồ sơ, tính hình phạt, xem xét đơn, biểu mẫu Tòa án.',
    nhom: 'Xét xử hình sự',
    home: 'toa-an',
    shortcuts: [
      ['toa-an', 'folder', 'Sổ vụ án', 'Sơ thẩm, phúc thẩm, thời hạn, thẩm tra'],
      ['toa-an/kho-ban-an', 'book', 'Kho bản án, án lệ', 'Bản án tương tự, thống kê mức án'],
      ['toa-an/bieu-mau', 'file', 'Biểu mẫu Tòa án', 'Mẫu soạn sẵn, mẫu Word của đơn vị'],
      ['binh-luan', 'book', 'Bình luận BLHS', 'Đọc từng điều, tra cứu nhanh'],
      ['legal', 'layers', 'Cây hỏi đáp pháp luật', 'Tội danh, cấu thành, vấn đề cần làm rõ'],
    ],
    bottom: [
      ['tra-cuu', 'search', 'Tra cứu'],
      ['toa-an', 'folder', 'Sổ vụ án'],
      ['binh-luan', 'book', 'Bình luận'],
      ['toa-an/bieu-mau', 'clipboard', 'Biểu mẫu'],
    ],
  },
  cqdt: {
    id: 'cqdt',
    ten: 'Cơ quan Cảnh sát điều tra',
    ngan: 'Cảnh sát điều tra',
    nhan: 'Cảnh sát điều tra',
    mark: 'police',
    moTa: 'Điều tra viên, cán bộ điều tra: hồ sơ vụ án, ghi và phân tích lời khai, sơ đồ vụ việc, theo dõi tiến độ, biểu mẫu tố tụng.',
    nhom: 'Điều tra hình sự',
    home: 'cases',
    shortcuts: [
      ['cases', 'folder', 'Hồ sơ vụ án', 'Vụ việc, người tham gia, tài liệu'],
      ['interview', 'message', 'Ghi lời khai', 'Hỏi theo kế hoạch, phát hiện mâu thuẫn'],
      ['loi-khai', 'quote', 'Phân tích lời khai', 'Đối chiếu nhiều lời khai'],
      ['so-do', 'chart', 'Sơ đồ vụ việc', 'Quan hệ người, sự kiện, vật chứng'],
      ['forms', 'clipboard', 'Biểu mẫu tố tụng', 'Mẫu theo giai đoạn điều tra'],
      ['legal', 'layers', 'Cây hỏi đáp pháp luật', 'Tội danh, cấu thành, vấn đề cần làm rõ'],
    ],
    bottom: [
      ['tra-cuu', 'search', 'Tra cứu'],
      ['cases', 'folder', 'Hồ sơ'],
      ['binh-luan', 'book', 'Bình luận'],
      ['forms', 'clipboard', 'Biểu mẫu'],
    ],
  },
};
export const AGENCY_IDS = Object.keys(AGENCIES);

/** Các màn hình thuộc riêng một cơ quan (dùng để lọc hướng dẫn, bảng lệnh). */
export const AGENCY_ROUTES = {
  'toa-an': ['toa-an'],
  cqdt: ['cases', 'interview', 'loi-khai', 'so-do', 'theo-doi', 'kho', 'forms'],
};

/** Cơ quan đã chọn của tài khoản hiện tại (null nếu chưa chọn). */
export function currentAgency() {
  const id = store.get(agencyKey(), null);
  return AGENCIES[id] ? id : null;
}
export function setAgency(id) {
  if (!AGENCIES[id]) throw new Error('Cơ quan không hợp lệ');
  store.set(agencyKey(), id);
}
export const agencyInfo = (id = currentAgency()) => AGENCIES[id] || null;

/** Màn hình (theo tên đường dẫn) có thuộc riêng cơ quan khác không — để ẩn khỏi điều hướng, bảng lệnh. */
export function routeBelongsElsewhere(route, id = currentAgency()) {
  if (!id) return false;
  return AGENCY_IDS.some((a) => a !== id && AGENCY_ROUTES[a].includes(route));
}
