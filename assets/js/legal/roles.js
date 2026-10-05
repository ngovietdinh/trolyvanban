// Đối tượng lấy lời khai theo Bộ luật Tố tụng hình sự 2015 (sửa đổi, bổ sung năm 2021, 2025): quyền, nghĩa vụ và cách đặt câu hỏi.

export const BLTTHS = 'Bộ luật Tố tụng hình sự năm 2015 (sửa đổi, bổ sung năm 2021, 2025)';

/** "Điều 178, Điều 183 và Điều 184" */
export function dieuList(nums = []) {
  const xs = nums.map((n) => `Điều ${n}`);
  return xs.length > 1 ? `${xs.slice(0, -1).join(', ')} và ${xs.at(-1)}` : xs[0] || '';
}

/** Căn cứ pháp lý mặc định của biên bản theo tư cách người khai. */
export const canCuText = (role) => `${dieuList(role.canCu)} ${BLTTHS}`;

export const ROLE_GROUPS = [
  { id: 'nghi-pham', ten: 'Bị can / người bị tạm giữ / người bị tố giác', moTa: 'Hỏi về hành vi của chính người khai' },
  { id: 'nhan-chung', ten: 'Người làm chứng / tố giác / người có liên quan', moTa: 'Hỏi về những gì người khai biết, chứng kiến' },
  { id: 'bi-hai', ten: 'Bị hại', moTa: 'Hỏi về diễn biến, thiệt hại, yêu cầu của bị hại' },
];

export const ROLES = [
  {
    id: 'bi-can', ten: 'Bị can', nhom: 'nghi-pham', bienBan: 'BIÊN BẢN HỎI CUNG BỊ CAN',
    canCu: [178, 183, 184], phuDe: '', quyen: 'Điều 60 Bộ luật Tố tụng hình sự',
    quyenTomTat: 'Được biết lý do bị khởi tố; được thông báo, giải thích quyền và nghĩa vụ; trình bày lời khai, ý kiến, không buộc phải đưa ra lời khai chống lại chính mình hoặc buộc phải nhận mình có tội; đưa ra chứng cứ, tài liệu, đồ vật, yêu cầu; tự bào chữa, nhờ người bào chữa; đọc, ghi chép bản sao tài liệu theo quy định; khiếu nại quyết định, hành vi tố tụng.',
    nghiaVu: 'Có mặt theo giấy triệu tập của người tiến hành tố tụng; chấp hành quyết định, yêu cầu của cơ quan, người có thẩm quyền tiến hành tố tụng.',
  },
  {
    id: 'tam-giu', ten: 'Người bị giữ trong trường hợp khẩn cấp / người bị bắt / người bị tạm giữ', nhom: 'nghi-pham', bienBan: 'BIÊN BẢN GHI LỜI KHAI',
    canCu: [58, 59, 178], phuDe: '(Người bị giữ trong trường hợp khẩn cấp, người bị bắt, người bị tạm giữ)', quyen: 'Điều 58, Điều 59 Bộ luật Tố tụng hình sự',
    quyenTomTat: 'Được biết lý do mình bị giữ, bị bắt, bị tạm giữ; được thông báo, giải thích quyền và nghĩa vụ; trình bày lời khai, ý kiến, không buộc phải đưa ra lời khai chống lại chính mình hoặc buộc phải nhận mình có tội; tự bào chữa, nhờ người bào chữa; đưa ra chứng cứ, tài liệu, đồ vật, yêu cầu; khiếu nại về việc giữ, bắt, tạm giữ.',
    nghiaVu: 'Chấp hành lệnh giữ, bắt, quyết định tạm giữ và nội quy nhà tạm giữ.',
  },
  {
    id: 'bi-to-giac', ten: 'Người bị tố giác, bị kiến nghị khởi tố', nhom: 'nghi-pham', bienBan: 'BIÊN BẢN GHI LỜI KHAI',
    canCu: [145, 147], phuDe: '(Người bị tố giác, bị kiến nghị khởi tố)', quyen: 'Điều 57 Bộ luật Tố tụng hình sự',
    quyenTomTat: 'Được thông báo về hành vi bị tố giác, kiến nghị khởi tố; được thông báo, giải thích quyền và nghĩa vụ; trình bày lời khai, ý kiến; đưa ra chứng cứ, tài liệu, đồ vật, yêu cầu; tự bảo vệ hoặc nhờ người bảo vệ quyền lợi; khiếu nại quyết định, hành vi tố tụng.',
    nghiaVu: 'Có mặt theo yêu cầu của cơ quan có thẩm quyền giải quyết nguồn tin về tội phạm; chấp hành quyết định, yêu cầu của cơ quan có thẩm quyền.',
  },
  {
    id: 'lam-chung', ten: 'Người làm chứng', nhom: 'nhan-chung', bienBan: 'BIÊN BẢN GHI LỜI KHAI',
    canCu: [178, 185, 186, 187], phuDe: '(Người làm chứng)', quyen: 'Điều 66 Bộ luật Tố tụng hình sự',
    quyenTomTat: 'Được thông báo, giải thích quyền và nghĩa vụ; yêu cầu cơ quan triệu tập bảo vệ tính mạng, sức khỏe, danh dự, nhân phẩm, tài sản khi bị đe dọa; khiếu nại quyết định, hành vi tố tụng; được thanh toán chi phí đi lại và chi phí khác theo quy định.',
    nghiaVu: 'Có mặt theo giấy triệu tập; trình bày trung thực những tình tiết mà mình biết về nguồn tin về tội phạm, về vụ án và lý do biết được những tình tiết đó.',
    canhBao: 'Người làm chứng khai báo gian dối, từ chối hoặc trốn tránh việc khai báo mà không có lý do chính đáng thì phải chịu trách nhiệm hình sự theo Điều 382 và Điều 383 Bộ luật Hình sự.',
  },
  {
    id: 'to-giac', ten: 'Người tố giác, báo tin về tội phạm', nhom: 'nhan-chung', bienBan: 'BIÊN BẢN GHI LỜI KHAI',
    canCu: [145, 147], phuDe: '(Người tố giác, báo tin về tội phạm)', quyen: 'Điều 56 Bộ luật Tố tụng hình sự',
    quyenTomTat: 'Đề nghị giữ bí mật việc tố giác, báo tin về tội phạm; đề nghị bảo vệ tính mạng, sức khỏe, danh dự, nhân phẩm, tài sản khi bị đe dọa; được thông báo kết quả giải quyết; khiếu nại quyết định, hành vi tố tụng.',
    nghiaVu: 'Có mặt theo yêu cầu của cơ quan có thẩm quyền giải quyết; trình bày trung thực về những tình tiết mà mình biết.',
    canhBao: 'Người tố giác, báo tin về tội phạm phải chịu trách nhiệm trước pháp luật nếu cố ý tố giác, báo tin sai sự thật.',
  },
  {
    id: 'lien-quan', ten: 'Người có quyền lợi, nghĩa vụ liên quan đến vụ án', nhom: 'nhan-chung', bienBan: 'BIÊN BẢN GHI LỜI KHAI',
    canCu: [178, 187, 188], phuDe: '(Người có quyền lợi, nghĩa vụ liên quan đến vụ án)', quyen: 'Điều 65 Bộ luật Tố tụng hình sự',
    quyenTomTat: 'Được thông báo, giải thích quyền và nghĩa vụ; đưa ra chứng cứ, tài liệu, đồ vật, yêu cầu; trình bày ý kiến về chứng cứ, tài liệu; tự bảo vệ hoặc nhờ người bảo vệ quyền lợi; khiếu nại quyết định, hành vi tố tụng.',
    nghiaVu: 'Có mặt theo giấy triệu tập; trình bày trung thực những tình tiết liên quan đến quyền lợi, nghĩa vụ của mình; chấp hành quyết định, yêu cầu của cơ quan có thẩm quyền.',
  },
  {
    id: 'bi-hai', ten: 'Bị hại', nhom: 'bi-hai', bienBan: 'BIÊN BẢN GHI LỜI KHAI',
    canCu: [178, 187, 188], phuDe: '(Bị hại)', quyen: 'Điều 62 Bộ luật Tố tụng hình sự',
    quyenTomTat: 'Được thông báo, giải thích quyền và nghĩa vụ; đưa ra chứng cứ, tài liệu, đồ vật, yêu cầu; được thông báo kết quả giải quyết vụ án; đề nghị mức bồi thường và biện pháp bảo đảm bồi thường; tham gia phiên tòa; tự bảo vệ, nhờ người bảo vệ quyền lợi; đề nghị bảo vệ khi bị đe dọa; khiếu nại quyết định, hành vi tố tụng.',
    nghiaVu: 'Có mặt theo giấy triệu tập; chấp hành quyết định, yêu cầu của cơ quan, người có thẩm quyền tiến hành tố tụng.',
  },
];

export const getRole = (id) => ROLES.find((r) => r.id === id) || ROLES[0];
