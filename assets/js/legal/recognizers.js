// Bộ nhận diện điều khoản: mỗi điều luật được mô tả bằng CÁC YẾU TỐ CẤU THÀNH (hành vi, đối tượng, mục đích, giá trị,
// chủ thể…) kèm mẫu nhận diện trong lời khai. Một điều chỉ được chọn khi ĐỦ các yếu tố bắt buộc xuất hiện trong cùng
// một đoạn (tối đa 3 câu liền nhau của cùng một nguồn); kết quả nêu rõ yếu tố nào đã có (kèm câu trích), yếu tố nào còn
// thiếu (kèm câu hỏi làm rõ) và vì sao không chọn điều gần nghĩa. Điều chưa có bộ nhận diện dùng cách khớp từ khóa
// trong relevance.js (độ chắc chắn thấp hơn, ghi rõ).
import { amountsIn } from './terms.js';

export const JOB_CUE = /(giám đốc|chủ tịch|trưởng (?:phòng|ban|đoàn|khoa|bộ phận|công an)|phó (?:giám đốc|chủ tịch|trưởng)|kế toán|thủ quỹ|thủ kho|cán bộ|công chức|viên chức|chuyên viên|bí thư|chỉ huy|chủ đầu tư|thanh tra|điều tra viên|kiểm sát viên|thẩm phán|chức vụ|quyền hạn)/iu;

const TIEN = 'tiền|quà|tài sản|lợi ích|\\d[\\d.,]*\\s*(?:nghìn|ngàn|triệu|tỷ|tỉ|đồng)|vàng|USD|đô la';
const GIAY = 'giấy|hồ sơ|chứng từ|tài liệu|biên bản|văn bản|chứng nhận|quyết định|sổ sách|văn bằng|chứng chỉ|giấy phép|con dấu';
const VULOI = 'vụ lợi|vì lợi ích cá nhân|vì lợi ích riêng|động cơ cá nhân|nhận(?![\\p{L}]).{0,40}(?:tiền|quà|lợi ích)|hưởng lợi';
const THIETHAI = 'thiệt hại|thất thoát|hậu quả|thất thu|lãng phí';
const TRAI = 'làm trái|trái quy định|trái pháp luật|không đúng quy định|sai quy định|vi phạm quy định';
const VIECGI = 'để\\s+(?:làm|giải quyết|không|thực hiện|cấp|duyệt|phê duyệt|ký|cho|được|trúng|thông qua|bỏ qua|hợp thức|xin|nhờ)|theo yêu cầu|vì lợi ích|nhờ(?![\\p{L}])|giúp\\s+(?:đỡ|cho)|chỉ định thầu|trúng thầu|ký duyệt|phê duyệt';
const MATUY = 'ma\\s*túy|heroin|hê rô in|cần sa|thuốc phiện|methamphetamine|cocaine|mdma|ketamine|thuốc lắc|hồng phiến|bạch phiến';

const rx = (s) => new RegExp(s, 'iu');
/** Yếu tố cấu thành. req: bắt buộc; w: trọng số; ctx: cho phép tìm ở toàn bộ nội dung; min: giá trị tối thiểu (đồng); pct: tỷ lệ % tối thiểu. */
const E = (id, label, res, { req = false, w = 1, ctx = false, min = 0, pct = 0, job = false, hoi = '' } = {}) => ({ id, label, re: (Array.isArray(res) ? res : res ? [res] : []).map(rx), req, w, ctx, min, pct, job, hoi });
// Chủ thể phải là CHÍNH người thực hiện hành vi (đứng trước động từ trong câu): có chức danh trong câu, hoặc là người được nêu
// chức vụ ở chỗ khác (“Ông Bình, Giám đốc …” … “Ông Bình nhận tiền”). Người khác trong cùng đoạn có chức vụ không tính.
const CHUCVU = (hoi = 'Người thực hiện giữ chức vụ, quyền hạn gì, ở đơn vị nào, được giao nhiệm vụ gì liên quan?') => E('chu-the', 'Chủ thể là người có chức vụ, quyền hạn', null, { req: true, w: 2, ctx: true, job: 'anchor', hoi });

/**
 * Danh sách bộ nhận diện. d: số điều (khớp Bộ luật trong phần mềm — có kiểm thử tên); vs: phân biệt với điều gần nghĩa.
 */
export const RECOGNIZERS = [
  {
    d: '354',
    vs: 'Khác Điều 364 (người đưa) và 365 (người trung gian): ở đây người NHẬN có chức vụ, quyền hạn nhận lợi ích để làm / không làm việc cho người đưa.',
    el: [
      E('hanh-vi', 'Nhận (hoặc sẽ nhận) tiền, tài sản, lợi ích', [`nhận(?![\\p{L}]).{0,80}(?:${TIEN})`, 'đòi\\s+(?:tiền|hối lộ)|hối lộ|lại quả'], { req: true, w: 3, hoi: 'Người có chức vụ đã nhận gì (tiền, tài sản, lợi ích), của ai, vào thời điểm nào?' }),
      E('vi-viec', 'Để làm hoặc không làm một việc vì lợi ích / theo yêu cầu của người đưa', VIECGI, { req: true, w: 2, hoi: 'Việc nhận tiền gắn với việc gì mà người đó đã làm hoặc không làm cho người đưa?' }),
      E('gia-tri', 'Lợi ích từ 2 triệu đồng trở lên', null, { w: 1, min: 2e6, hoi: 'Giá trị lợi ích đã nhận là bao nhiêu?' }),
      CHUCVU(),
    ],
  },
  {
    d: '364',
    vs: 'Khác Điều 354: ở đây người ĐƯA lợi ích cho người có chức vụ, quyền hạn để người đó làm / không làm việc vì lợi ích của mình.',
    el: [
      E('hanh-vi', 'Đưa, biếu, tặng tiền, tài sản, lợi ích cho người khác', [`(?:đưa|biếu|tặng|gửi|chuyển|trao)(?![\\p{L}]).{0,80}(?:${TIEN})`, 'đưa hối lộ|hối lộ'], { req: true, w: 3, hoi: 'Người đưa đã đưa gì, cho ai, vào thời điểm nào?' }),
      E('vi-viec', 'Để người nhận làm hoặc không làm một việc vì lợi ích của mình', VIECGI, { req: true, w: 2, hoi: 'Người đưa nhờ người nhận làm / không làm việc gì?' }),
      E('nguoi-nhan', 'Người nhận là người có chức vụ, quyền hạn', null, { req: true, w: 2, ctx: true, job: 'after', hoi: 'Người nhận giữ chức vụ, quyền hạn gì?' }),
      E('gia-tri', 'Lợi ích từ 2 triệu đồng trở lên', null, { w: 1, min: 2e6, hoi: 'Giá trị lợi ích đã đưa là bao nhiêu?' }),
    ],
  },
  {
    d: '365',
    vs: 'Khác Điều 354 / 364: người này KHÔNG phải người nhận hay người đưa, chỉ làm trung gian giữa hai bên.',
    el: [
      E('trung-gian', 'Làm trung gian, môi giới giữa người đưa và người nhận', ['môi giới', 'làm trung gian', 'trung gian', 'đưa\\s+(?:hộ|giúp)|nhận\\s+(?:hộ|giúp)|chuyển\\s+(?:hộ|giúp)'], { req: true, w: 3, hoi: 'Ai làm trung gian, giữa ai với ai, bằng cách nào?' }),
      E('hanh-vi', 'Việc đưa / nhận tiền, tài sản, lợi ích', `(?:đưa|nhận|chuyển|biếu)(?![\\p{L}]).{0,80}(?:${TIEN})`, { req: true, w: 2, hoi: 'Khoản đã được chuyển là gì, bao nhiêu?' }),
    ],
  },
  {
    d: '353',
    vs: 'Khác Điều 355: ở đây tài sản bị chiếm đoạt do CHÍNH người đó có trách nhiệm quản lý (thủ quỹ, kế toán, người quản lý kho…); khác Điều 174 / 175: chủ thể là người có chức vụ, quyền hạn.',
    el: [
      E('hanh-vi', 'Chiếm đoạt tài sản (lấy, rút tiền, giữ lại không nhập quỹ…)', [`rút(?![\\p{L}]).{0,30}(?:${TIEN})`, `(?:lấy|chiếm đoạt|chiếm giữ|biển thủ|bỏ túi|chiếm dụng)(?![\\p{L}]).{0,60}(?:${TIEN})`, 'không\\s+(?:nhập quỹ|hạch toán|ghi sổ)', 'tham ô'], { req: true, w: 3, hoi: 'Người đó đã lấy / rút / giữ lại tài sản nào, vào lúc nào, số tiền bao nhiêu?' }),
      E('thu-doan', 'Thủ đoạn: chứng từ, hóa đơn khống hoặc chi sai để hợp thức hóa', 'chi khống|kê khống|khai khống|nâng khống|lập khống|quyết toán khống|hợp thức hóa|chi sai', { w: 2, hoi: 'Đã dùng chứng từ, hóa đơn, hồ sơ nào để hợp thức hóa khoản chi?' }),
      E('trach-nhiem', 'Tài sản do mình có trách nhiệm quản lý (quỹ, kho, kinh phí, dự án…)', 'quỹ|công quỹ|kho(?![\\p{L}])|kinh phí|ngân sách|dự án|tiền của\\s+(?:cơ quan|đơn vị|công ty|ban|xã|trường|bệnh viện)|tài sản\\s+(?:của\\s+)?(?:nhà nước|cơ quan|đơn vị|công ty)|được giao quản lý|có trách nhiệm quản lý|thủ quỹ|thủ kho|kế toán', { req: true, w: 2, ctx: true, hoi: 'Tài sản đó có phải do người đó được giao quản lý không? Căn cứ giao nhiệm vụ (quyết định, hợp đồng, biên bản bàn giao)?' }),
      E('gia-tri', 'Tài sản từ 2 triệu đồng trở lên', null, { w: 1, min: 2e6, ctx: true, hoi: 'Tổng giá trị tài sản bị chiếm đoạt là bao nhiêu?' }),
      CHUCVU(),
    ],
  },
  {
    d: '355',
    vs: 'Khác Điều 353: tài sản bị chiếm đoạt KHÔNG thuộc phạm vi mình có trách nhiệm quản lý, người phạm tội lợi dụng chức vụ, quyền hạn để chiếm đoạt.',
    el: [
      E('loi-dung', 'Lợi dụng chức vụ, quyền hạn', 'lợi dụng\\s+(?:chức vụ|quyền hạn|chức quyền)|dựa vào\\s+(?:chức vụ|quyền)|sử dụng\\s+(?:chức vụ|quyền hạn)\\s+để', { req: true, w: 3, hoi: 'Người đó đã lợi dụng chức vụ, quyền hạn cụ thể nào để chiếm đoạt?' }),
      E('hanh-vi', 'Chiếm đoạt tài sản của người khác', 'chiếm đoạt|chiếm giữ|lừa|gian dối', { req: true, w: 3, hoi: 'Tài sản bị chiếm đoạt là gì, của ai, bằng cách nào?' }),
      E('gia-tri', 'Tài sản từ 2 triệu đồng trở lên', null, { w: 1, min: 2e6, ctx: true, hoi: 'Giá trị tài sản bị chiếm đoạt?' }),
      CHUCVU(),
    ],
  },
  {
    d: '356',
    vs: 'Khác Điều 357 (vượt quá quyền hạn) và 360 (thiếu trách nhiệm, vô ý): ở đây LỢI DỤNG chức vụ, quyền hạn làm trái công vụ vì vụ lợi / động cơ cá nhân.',
    el: [
      E('loi-dung', 'Lợi dụng chức vụ, quyền hạn', 'lợi dụng\\s+(?:chức vụ|quyền hạn|chức quyền)|dựa vào\\s+(?:chức vụ|quyền)', { req: true, w: 3, hoi: 'Lợi dụng chức vụ, quyền hạn cụ thể nào?' }),
      E('trai', 'Làm trái quy định, công vụ', TRAI, { req: true, w: 2, hoi: 'Làm trái quy định nào (văn bản, điều khoản)?' }),
      E('vu-loi', 'Vì vụ lợi hoặc động cơ cá nhân khác', VULOI, { w: 2, hoi: 'Người đó được lợi gì / động cơ gì?' }),
      E('thiet-hai', 'Gây thiệt hại', THIETHAI, { w: 2, hoi: 'Thiệt hại gây ra là gì, bao nhiêu?' }),
      CHUCVU(),
    ],
  },
  {
    d: '357',
    vs: 'Khác Điều 356: ở đây VƯỢT QUÁ quyền hạn, thẩm quyền (lạm quyền) khi thi hành công vụ.',
    el: [
      E('vuot', 'Vượt quá quyền hạn, thẩm quyền', 'vượt quá\\s+(?:quyền hạn|thẩm quyền|chức năng)|lạm quyền|ngoài thẩm quyền|không\\s+thuộc\\s+thẩm quyền|tự ý', { req: true, w: 3, hoi: 'Quyền hạn, thẩm quyền của người đó đến đâu, việc làm vượt quá ở điểm nào?' }),
      E('trai', 'Làm trái công vụ', TRAI, { req: true, w: 2, hoi: 'Làm trái quy định nào?' }),
      E('thiet-hai', 'Gây thiệt hại', THIETHAI, { w: 2, hoi: 'Thiệt hại gây ra là gì, bao nhiêu?' }),
      CHUCVU(),
    ],
  },
  {
    d: '359',
    vs: 'Khác Điều 341: chủ thể là người có chức vụ, quyền hạn sửa chữa, làm sai lệch giấy tờ trong công tác vì vụ lợi / động cơ cá nhân.',
    el: [
      E('hanh-vi', 'Sửa chữa, làm sai lệch nội dung hoặc làm, cấp giấy tờ giả', 'giả mạo|làm giả|sửa\\s+(?:chữa|đổi)|làm sai lệch|tẩy xóa|hợp thức hóa|lập\\s+(?:khống|giả)', { req: true, w: 3, hoi: 'Đã sửa / làm giả giấy tờ nào, nội dung sai lệch ở điểm nào?' }),
      E('giay-to', 'Giấy tờ, tài liệu, hồ sơ, chứng từ', GIAY, { req: true, w: 2, hoi: 'Giấy tờ, tài liệu cụ thể là gì (số, ngày, cơ quan cấp)?' }),
      E('vu-loi', 'Vì vụ lợi hoặc động cơ cá nhân khác', VULOI, { w: 2, hoi: 'Làm vì mục đích gì, được lợi gì?' }),
      CHUCVU(),
    ],
  },
  {
    d: '360',
    vs: 'Khác Điều 356 / 357: thiếu trách nhiệm (không làm, làm không đúng nhiệm vụ) dẫn đến hậu quả nghiêm trọng, thường không có mục đích vụ lợi.',
    el: [
      E('thieu', 'Thiếu trách nhiệm: không thực hiện / thực hiện không đúng nhiệm vụ', 'thiếu trách nhiệm|buông lỏng|không\\s+(?:kiểm tra|giám sát|thực hiện|làm tròn)|lơ là|thực hiện không đúng|chủ quan', { req: true, w: 3, hoi: 'Nhiệm vụ được giao là gì, người đó đã không làm / làm không đúng ở điểm nào?' }),
      E('hau-qua', 'Gây hậu quả nghiêm trọng (thiệt hại tài sản, thất thoát…)', THIETHAI + '|tử vong|thiệt mạng|mất mát', { req: true, w: 3, hoi: 'Hậu quả cụ thể là gì (thiệt hại bao nhiêu, ai bị ảnh hưởng)?' }),
      CHUCVU(),
    ],
  },
  {
    d: '174',
    win: 1,
    vs: 'Khác Điều 175 / 353 / 355: ý định chiếm đoạt có từ trước hoặc trong lúc dùng thủ đoạn gian dối để người khác TỰ GIAO tài sản.',
    el: [
      E('thu-doan', 'Dùng thủ đoạn gian dối', 'gian dối|lừa(?:\\s+(?:dối|đảo))?|giả danh|giả mạo|vẽ ra|hứa hẹn|cam kết|mạo nhận|thông tin\\s+(?:giả|sai sự thật)', { req: true, w: 3, hoi: 'Người đó đã nói / làm gì để người bị hại tin?' }),
      E('chiem-doat', 'Chiếm đoạt tài sản của người bị hại', 'chiếm đoạt|chiếm giữ|không\\s+(?:trả|hoàn trả)|bỏ trốn|tiêu\\s+(?:xài\\s+)?hết|sử dụng\\s+hết', { req: true, w: 3, hoi: 'Người bị hại đã giao tài sản gì, bằng cách nào, bao nhiêu?' }),
      E('gia-tri', 'Tài sản từ 2 triệu đồng trở lên', null, { w: 1, min: 2e6, ctx: true, hoi: 'Giá trị tài sản bị chiếm đoạt?' }),
    ],
  },
  {
    d: '175',
    vs: 'Khác Điều 174: ban đầu nhận tài sản HỢP PHÁP (vay, mượn, thuê, hợp đồng) rồi mới chiếm đoạt; khác Điều 353 / 355: chủ thể không dùng chức vụ.',
    el: [
      E('nhan-hop-phap', 'Vay, mượn, thuê hoặc nhận tài sản qua hợp đồng', '(?:vay|mượn|thuê|nhận\\s+giữ|nhận\\s+ủy thác|hợp đồng|nhờ\\s+giữ)(?![\\p{L}])', { req: true, w: 3, hoi: 'Tài sản được nhận theo hình thức nào (vay, mượn, hợp đồng…), vào lúc nào?' }),
      E('chiem-doat', 'Chiếm đoạt: bỏ trốn, gian dối hoặc đến hạn không trả', 'bỏ trốn|không\\s+(?:trả|hoàn trả)|đến hạn|sử dụng\\s+vào\\s+(?:mục đích|việc)\\s+(?:bất hợp pháp|trái)|chiếm đoạt|gian dối|đem\\s+(?:đi\\s+)?(?:bán|cầm cố|thế chấp)', { req: true, w: 3, hoi: 'Sau khi nhận, người đó đã làm gì với tài sản (bỏ trốn, không trả, đem bán…)?' }),
      E('gia-tri', 'Tài sản từ 4 triệu đồng trở lên', null, { w: 1, min: 4e6, ctx: true, hoi: 'Giá trị tài sản bị chiếm đoạt?' }),
    ],
  },
  {
    d: '173',
    win: 1,
    vs: 'Lén lút lấy tài sản (khác Điều 171 cướp giật, 172 công nhiên chiếm đoạt, 174 lừa đảo).',
    el: [
      E('hanh-vi', 'Lén lút lấy tài sản của người khác', 'trộm|cắp|lén lút|đột nhập|móc túi|bẻ khóa|lấy\\s+trộm', { req: true, w: 3, hoi: 'Người đó đã lấy tài sản bằng cách nào, ở đâu, vào lúc nào?' }),
      E('tai-san', 'Tài sản bị lấy', 'tài sản|xe(?![\\p{L}])|điện thoại|máy(?![\\p{L}])|vàng|tiền|đồ(?![\\p{L}])|chiếc|con(?![\\p{L}])', { req: true, w: 1, hoi: 'Tài sản bị lấy là gì?' }),
      E('gia-tri', 'Tài sản từ 2 triệu đồng trở lên', null, { w: 1, min: 2e6, ctx: true, hoi: 'Giá trị tài sản bị lấy?' }),
    ],
  },
  {
    d: '200',
    vs: 'Khác Điều 203 (hóa đơn): ở đây hành vi nhằm KHÔNG nộp / nộp thiếu thuế.',
    el: [
      E('hanh-vi', 'Hành vi trốn thuế (hóa đơn giả / khống, kê khai sai, giấu doanh thu…)', 'hóa đơn\\s+(?:giả|khống|không hợp pháp)|(?:khai|kê khai)\\s+(?:sai|khống|thiếu)|giấu\\s+doanh thu|không\\s+(?:ghi|hạch toán)\\s+doanh thu|trốn thuế|không\\s+kê khai|không\\s+đăng ký\\s+(?:thuế|kinh doanh)', { req: true, w: 3, hoi: 'Đã dùng thủ đoạn nào để không nộp / nộp thiếu thuế, thuế gì, kỳ nào?' }),
      E('thue', 'Liên quan nghĩa vụ thuế', 'thuế', { req: true, w: 1, ctx: true, hoi: 'Loại thuế bị trốn?' }),
      E('gia-tri', 'Số thuế trốn từ 100 triệu đồng trở lên', null, { w: 2, min: 1e8, ctx: true, hoi: 'Số thuế trốn là bao nhiêu?' }),
    ],
  },
  {
    d: '222',
    vs: 'Khác Điều 354 / 355: ở đây hành vi VI PHẠM QUY ĐỊNH ĐẤU THẦU gây hậu quả; nếu có nhận tiền thì xét thêm Điều 354 / 364.',
    el: [
      E('dau-thau', 'Hoạt động đấu thầu', 'đấu thầu|chỉ định thầu|nhà thầu|trúng thầu|dự thầu|gói thầu|mời thầu', { req: true, w: 2, hoi: 'Gói thầu nào, của đơn vị nào, thời điểm nào?' }),
      E('vi-pham', 'Vi phạm quy định đấu thầu (thông thầu, can thiệp, không đủ năng lực, chia nhỏ gói thầu…)', 'thông thầu|dàn xếp|bán thầu|tiết lộ\\s+(?:thông tin|hồ sơ)|can thiệp|nâng\\s+(?:khống|giá)|không\\s+đủ\\s+(?:điều kiện|năng lực)|thiếu\\s+năng lực|chia nhỏ\\s+gói thầu|gian lận|trái quy định|không đúng quy định|móc nối|ưu ái', { req: true, w: 3, hoi: 'Đã vi phạm quy định nào của pháp luật đấu thầu (điều, khoản)?' }),
      E('hau-qua', 'Gây hậu quả nghiêm trọng (thiệt hại từ 100 triệu đồng)', THIETHAI, { w: 2, min: 0, hoi: 'Thiệt hại cho nhà nước / chủ đầu tư là bao nhiêu?' }),
    ],
  },
  {
    d: '219',
    vs: 'Khác Điều 353 / 355: không nhằm chiếm đoạt mà quản lý, sử dụng tài sản nhà nước trái quy định gây thất thoát, lãng phí.',
    el: [
      E('tai-san', 'Tài sản nhà nước', 'tài sản\\s+(?:của\\s+)?(?:nhà nước|công)|ngân sách|công quỹ|vốn\\s+nhà nước|đất công|trụ sở|xe công', { req: true, w: 2, ctx: true, hoi: 'Tài sản nhà nước nào, do đơn vị nào quản lý?' }),
      E('trai', 'Quản lý, sử dụng trái quy định', `${TRAI}|vi phạm|cho\\s+(?:thuê|mượn)`, { req: true, w: 3, hoi: 'Quản lý, sử dụng trái quy định nào?' }),
      E('that-thoat', 'Gây thất thoát, lãng phí', 'thất thoát|lãng phí|thiệt hại', { req: true, w: 3, hoi: 'Thất thoát, lãng phí bao nhiêu?' }),
      CHUCVU(),
    ],
  },
  {
    d: '229',
    vs: 'Khác Điều 228 (vi phạm về sử dụng đất của người sử dụng) : ở đây người có thẩm quyền quản lý đất đai làm trái quy định.',
    el: [
      E('dat-dai', 'Việc về đất đai (giao, cho thuê, thu hồi, cấp giấy chứng nhận, chuyển mục đích…)', 'giao đất|cho thuê đất|thu hồi đất|chuyển mục đích|cấp\\s+giấy chứng nhận|quyền sử dụng đất|giấy chứng nhận(?![\\p{L}]).{0,30}đất|bồi thường(?![\\p{L}]).{0,30}đất|đất đai|sổ đỏ', { req: true, w: 3, hoi: 'Thửa đất nào, việc gì (giao, cấp giấy, thu hồi…), ai đề nghị?' }),
      E('trai', 'Làm trái quy định', 'trái quy định|sai quy định|không đúng quy định|trái pháp luật|không đủ điều kiện|sai đối tượng|sai thẩm quyền', { req: true, w: 3, hoi: 'Trái quy định nào của pháp luật đất đai?' }),
      E('hau-qua', 'Gây thiệt hại hoặc vụ lợi', `${THIETHAI}|vụ lợi|nhận(?![\\p{L}]).{0,40}tiền`, { w: 1, hoi: 'Thiệt hại / lợi ích thu được là gì?' }),
      CHUCVU(),
    ],
  },
  {
    d: '341',
    win: 1,
    vs: 'Khác Điều 359: chủ thể không cần là người có chức vụ; hành vi LÀM GIẢ hoặc SỬ DỤNG con dấu, tài liệu giả của cơ quan, tổ chức.',
    el: [
      E('lam-gia', 'Làm giả hoặc sử dụng giả', 'làm giả|giả mạo|giả\\s+(?:con dấu|chữ ký|giấy|văn bằng|chứng chỉ)|tự\\s+(?:khắc|làm)\\s+(?:con dấu|giấy)|photo\\s+ghép|sử dụng\\s+(?:con dấu|giấy tờ|tài liệu)\\s+giả', { req: true, w: 3, hoi: 'Đã làm giả bằng cách nào, ai làm, ai sử dụng?' }),
      E('doi-tuong', 'Con dấu, tài liệu của cơ quan, tổ chức', 'con dấu|giấy chứng nhận|văn bằng|bằng\\s+(?:tốt nghiệp|lái)|chứng chỉ|giấy phép|công văn|quyết định|(?:của|do)\\s+(?:cơ quan|tổ chức|UBND|sở|phòng)', { req: true, w: 2, hoi: 'Con dấu, tài liệu của cơ quan, tổ chức nào (số, ngày)?' }),
    ],
  },
  {
    d: '321',
    vs: 'Khác Điều 322: người chơi ăn thua bằng tiền, tài sản (không phải người tổ chức).',
    el: [
      E('hanh-vi', 'Đánh bạc, cá độ ăn thua', 'đánh bạc|xóc đĩa|tài xỉu|ghi đề|lô đề|cá độ|đá gà\\s+ăn tiền|sát phạt|cá cược|chơi bài', { req: true, w: 3, hoi: 'Hình thức đánh bạc, địa điểm, thời gian, số người?' }),
      E('an-thua', 'Ăn thua bằng tiền hoặc tài sản', TIEN, { req: true, w: 1, hoi: 'Số tiền dùng đánh bạc?' }),
      E('gia-tri', 'Tổng số tiền từ 5 triệu đồng trở lên', null, { w: 2, min: 5e6, hoi: 'Tổng số tiền dùng đánh bạc (trên chiếu bạc và trong người)?' }),
    ],
  },
  {
    d: '322',
    vs: 'Khác Điều 321: người TỔ CHỨC, gá bạc, chủ sới.',
    el: [
      E('hanh-vi', 'Đánh bạc, cá độ', 'đánh bạc|xóc đĩa|tài xỉu|ghi đề|lô đề|cá độ|đá gà\\s+ăn tiền|cá cược|sới bạc|chiếu bạc', { req: true, w: 2, hoi: 'Hình thức đánh bạc, địa điểm?' }),
      E('to-chuc', 'Tổ chức, gá bạc (chủ sới, cầm cái, cho mượn địa điểm, rủ rê…)', 'tổ chức|gá bạc|chủ sới|cầm cái|rủ rê|lôi kéo|cho\\s+(?:mượn|thuê)\\s+địa điểm|đứng ra', { req: true, w: 3, hoi: 'Ai tổ chức, vai trò từng người, thu lợi gì?' }),
      E('gia-tri', 'Tổng số tiền từ 20 triệu đồng trở lên', null, { w: 2, min: 2e7, hoi: 'Tổng số tiền dùng đánh bạc?' }),
    ],
  },
  {
    d: '134',
    vs: 'Khác Điều 123 (giết người: có ý định tước đoạt tính mạng); khác Điều 135 / 136 / 137 (tình tiết kích động, phòng vệ, bắt giữ).',
    el: [
      E('hanh-vi', 'Hành vi tấn công cơ thể người khác', 'đánh|đấm|đá(?![\\p{L}])|đâm|chém|đập|tát|dùng\\s+(?:dao|gậy|hung khí|vật)|gây\\s+thương\\s+tích|bắn', { req: true, w: 3, hoi: 'Hành vi cụ thể (dùng gì, đánh vào đâu), nguyên nhân, thời gian, địa điểm?' }),
      E('thuong-tich', 'Gây thương tích hoặc tổn hại sức khỏe', 'thương tích|tổn hại|tổn thương|nhập viện|vết thương|chấn thương|\\d+\\s*%', { req: true, w: 3, hoi: 'Thương tích cụ thể, kết quả giám định?' }),
      E('ty-le', 'Tỷ lệ tổn thương cơ thể từ 11% trở lên (hoặc dùng hung khí nguy hiểm)', null, { w: 2, pct: 11, ctx: true, hoi: 'Tỷ lệ tổn thương cơ thể theo kết luận giám định pháp y?' }),
    ],
  },
  {
    d: '123',
    vs: 'Khác Điều 134: có ý định tước đoạt tính mạng người khác (hoặc hậu quả chết người).',
    el: [
      E('hanh-vi', 'Hành vi tước đoạt tính mạng', 'giết|đâm(?![\\p{L}])|chém|bóp cổ|bắn|siết cổ|đầu độc|dìm|đánh(?![\\p{L}])', { req: true, w: 3, hoi: 'Hành vi cụ thể, công cụ, vào bộ phận nào?' }),
      E('hau-qua', 'Hậu quả chết người hoặc ý định giết', 'chết|tử vong|thiệt mạng|giết\\s+người|cướp đi tính mạng|cố ý giết', { req: true, w: 3, hoi: 'Nạn nhân chết như thế nào, nguyên nhân tử vong theo giám định?' }),
    ],
  },
  {
    d: '249',
    vs: 'Khác Điều 250 (vận chuyển) và 251 (mua bán): chỉ TÀNG TRỮ, cất giữ trái phép.',
    el: [
      E('hanh-vi', 'Tàng trữ, cất giữ trái phép', 'tàng trữ|cất giấu|cất giữ|giữ(?![\\p{L}]).{0,20}(?:trong người|trong nhà)|cất\\s+trong', { req: true, w: 3, hoi: 'Cất giữ ở đâu, từ khi nào, nguồn gốc?' }),
      E('chat', 'Chất ma túy', MATUY, { req: true, w: 3, hoi: 'Loại chất ma túy?' }),
      E('khoi-luong', 'Khối lượng (gam, kg…)', '\\d[\\d.,]*\\s*(?:gam|g(?![\\p{L}])|kg|miligam|mg|viên|ml)', { w: 2, hoi: 'Khối lượng, kết quả giám định chất ma túy?' }),
    ],
  },
  {
    d: '250',
    vs: 'Khác Điều 249 / 251: hành vi VẬN CHUYỂN trái phép chất ma túy.',
    el: [
      E('hanh-vi', 'Vận chuyển, chở, mang theo', 'vận chuyển|chở|mang\\s+theo|giao\\s+cho', { req: true, w: 3, hoi: 'Vận chuyển từ đâu đến đâu, bằng phương tiện gì, cho ai?' }),
      E('chat', 'Chất ma túy', MATUY, { req: true, w: 3, hoi: 'Loại chất ma túy?' }),
      E('khoi-luong', 'Khối lượng (gam, kg…)', '\\d[\\d.,]*\\s*(?:gam|g(?![\\p{L}])|kg|miligam|mg|viên|ml)', { w: 2, hoi: 'Khối lượng, kết quả giám định?' }),
    ],
  },
  {
    d: '251',
    vs: 'Khác Điều 249 / 250: hành vi MUA BÁN, trao đổi trái phép chất ma túy.',
    el: [
      E('hanh-vi', 'Mua bán, trao đổi', 'mua bán|bán(?![\\p{L}])|giao\\s+bán|mua(?![\\p{L}])|bán\\s+lại|trao đổi', { req: true, w: 3, hoi: 'Mua / bán với ai, giá bao nhiêu, mấy lần, vào lúc nào?' }),
      E('chat', 'Chất ma túy', MATUY, { req: true, w: 3, hoi: 'Loại chất ma túy?' }),
      E('khoi-luong', 'Khối lượng (gam, kg…)', '\\d[\\d.,]*\\s*(?:gam|g(?![\\p{L}])|kg|miligam|mg|viên|ml)', { w: 2, hoi: 'Khối lượng, kết quả giám định?' }),
    ],
  },
];

export const RECOGNIZER_OF = new Map(RECOGNIZERS.map((r) => [r.d, r]));

// Lời phủ nhận của người khai (“tôi không nhận…”, “chưa bao giờ…”) không phải căn cứ chứng minh hành vi.
const DENY = /(?:^|\s)(?:không hề|chưa\s+(?:bao giờ|từng|hề)|không bao giờ)(?![\p{L}])|phủ nhận|không thừa nhận|không có\s+(?:việc|chuyện)|không đúng sự thật|^\s*tôi\s+không\s+(?:nhận|đưa|biết|lấy|làm|liên quan)/iu;
const pctOf = (t) => [...String(t).matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*%/g)].map((m) => parseFloat(String(m[1]).replace(',', '.')));

/** Câu tạo nên “cảnh”: tối đa 3 câu liền nhau cùng nguồn. sents: [{ t, src? }]. */
function scenes(sents, size = 3) {
  const out = [];
  for (let i = 0; i < sents.length; i++) {
    const win = [sents[i]];
    for (let j = i + 1; j < sents.length && win.length < size && (sents[j].src || '') === (sents[i].src || ''); j++) win.push(sents[j]);
    out.push(win);
  }
  return out;
}

const UPC = 'A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ';
const CAP = new RegExp(`^[${UPC}][\\p{Ll}]+$`, 'u');

/** Những người được nêu chức danh trong nội dung: “Giám đốc Trần Văn Bình”, “ông An, kế toán Ban QLDA”. Trả về tập tên gọi (chữ cuối). */
export function jobNames(text) {
  const out = new Set();
  const t = String(text || '');
  const toks = (str) => str.split(/\s+/).map((w) => w.replace(/^[(,;:.]+|[),;:.]+$/g, '')).filter(Boolean);
  const run = (words) => {
    let cur = [];
    for (const w of words) {
      if (CAP.test(w)) cur.push(w);
      else if (cur.length >= 2) break;
      else cur = [];
    }
    return cur.length >= 2 ? cur.slice(0, 4) : [];
  };
  const g = new RegExp(JOB_CUE.source, 'giu');
  for (const m of t.matchAll(g)) {
    const after = run(toks(t.slice(m.index + m[0].length, m.index + m[0].length + 70)).slice(0, 7));
    if (after.length) out.add(after.at(-1));
    const bw = toks(t.slice(Math.max(0, m.index - 40), m.index));
    const before = [];
    for (let i = bw.length - 1; i >= 0 && CAP.test(bw[i]); i--) before.unshift(bw[i]);
    // Tên đứng ngay trước chức danh (“Nguyễn Văn An, kế toán …”) — bỏ danh xưng viết hoa đầu câu.
    const nm = before.filter((w) => !/^(Ông|Bà|Anh|Chị|Em|Cô|Chú|Bác)$/.test(w));
    if (nm.length >= 2) out.add(nm.at(-1));
  }
  return out;
}

/** Người NHẬN có chức vụ (đứng SAU động từ: “đưa cho ông Bình, Giám đốc …”)? */
function subjectAfter(sentence, idx, names) {
  const after = sentence.slice(Math.max(0, idx));
  if (JOB_CUE.test(after)) return true;
  for (const n of names) if (new RegExp(`(?<![\\p{L}])${n}(?![\\p{L}])`, 'u').test(after)) return true;
  return false;
}

/** Chủ thể có chức vụ đứng TRƯỚC vị trí hành vi trong câu? (hoặc “tôi” khi cảnh có nêu chức danh). */
function subjectBefore(sentence, idx, win, names) {
  const before = sentence.slice(0, Math.max(0, idx));
  if (JOB_CUE.test(before)) return true;
  for (const n of names) if (new RegExp(`(?<![\\p{L}])${n}(?![\\p{L}])`, 'u').test(before)) return true;
  return /(?<![\p{L}])tôi(?![\p{L}])/iu.test(before) && win.some((x) => JOB_CUE.test(x.t));
}

/** Yếu tố có khớp trong cảnh (hoặc toàn bộ nội dung nếu ctx)? Trả về { quote, idx } (câu trích, vị trí khớp trong câu) hoặc null. */
function matchElement(e, win, all) {
  const pools = [win, ...(e.ctx ? [all] : [])];
  for (const pool of pools) {
    for (const s of pool) {
      const t = s.t;
      if (DENY.test(t)) continue;
      if (e.job === true) {
        const m = JOB_CUE.exec(t);
        if (m) return { quote: t, idx: m.index };
      }
      for (const r of e.re) {
        const m = r.exec(t);
        if (m) return { quote: t, idx: m.index };
      }
      if (e.min && amountsIn(t).some((a) => a.v >= e.min)) return { quote: t, idx: 0 };
      if (e.pct && pctOf(t).some((p) => p >= e.pct)) return { quote: t, idx: 0 };
    }
  }
  return null;
}

/**
 * Chạy bộ nhận diện của một điều trên danh sách câu. ctxSents: ngữ cảnh rộng hơn cho yếu tố ctx (mặc định: chính sents).
 * Luôn trả về cảnh tốt nhất: { ok (đủ yếu tố bắt buộc), muc ('cao' | 'vua' | 'khong'), diem, toiDa, yeuTo[], thieu[], canh, trich };
 * null nếu không có câu nào.
 */
export function recognize(rec, sents, ctxSents = sents, extraNames = []) {
  let best = null;
  const names = new Set([...jobNames(ctxSents.map((x) => x.t).join('\n')), ...extraNames]);
  for (const win of scenes(sents, rec.win || 3)) {
    const found = rec.el.map((e) => (e.job === 'anchor' || e.job === 'after' ? null : matchElement(e, win, ctxSents)));
    // Mốc để xét chủ thể: yếu tố hành vi bắt buộc đầu tiên đã khớp.
    const ai = rec.el.findIndex((e, i) => e.req && e.job !== 'anchor' && e.job !== 'after' && found[i]);
    const anchor = ai >= 0 ? found[ai] : null;
    const yeuTo = rec.el.map((e, i) => {
      let m = found[i];
      if (e.job === 'after') m = anchor && subjectAfter(anchor.quote, anchor.idx, names) ? { quote: anchor.quote } : null;
      if (e.job === 'anchor') {
        m = anchor && subjectBefore(anchor.quote, anchor.idx, win, names) ? { quote: anchor.quote } : null;
        // Chủ thể nêu ở câu khác của người đó (“Ông Bình, Giám đốc …”): câu hành vi có tên người đó trước động từ → đã xét ở subjectBefore.
      }
      return { id: e.id, label: e.label, ok: !!m, quote: m?.quote || '', req: e.req, hoi: e.hoi, w: e.w };
    });
    const ok = yeuTo.every((y) => !y.req || y.ok);
    const diem = yeuTo.reduce((n, y) => n + (y.ok ? y.w : 0), 0);
    const toiDa = yeuTo.reduce((n, y) => n + y.w, 0);
    const reqOk = yeuTo.filter((y) => y.req && y.ok).length;
    const cand = { ok, diem, toiDa, yeuTo, reqOk, canh: win.map((s) => s.t).join(' ') };
    if (!best || (ok && !best.ok) || (ok === best.ok && (diem > best.diem || (diem === best.diem && reqOk > best.reqOk)))) best = cand;
  }
  if (!best) return null;
  const trich = best.yeuTo.find((y) => y.req && y.quote && y.id !== 'chu-the')?.quote || best.yeuTo.find((y) => y.quote)?.quote || '';
  return { ok: best.ok, muc: !best.ok ? 'khong' : best.diem / best.toiDa >= 0.75 ? 'cao' : 'vua', diem: best.diem, toiDa: best.toiDa, yeuTo: best.yeuTo, thieu: best.yeuTo.filter((y) => !y.ok), canh: best.canh, trich };
}

/** Yếu tố đã khớp → câu giải thích ngắn: “Đủ 3/4 yếu tố cấu thành (còn thiếu: …)”. */
export function explain(r) {
  const ok = r.yeuTo.filter((y) => y.ok).length;
  const short = (y) => y.label.replace(/\s*\([^)]*\)\s*$/, '');
  return r.ok ? `Đủ ${ok}/${r.yeuTo.length} yếu tố cấu thành${r.thieu.length ? ` (chưa rõ: ${r.thieu.map(short).join('; ')})` : ''}` : `Thiếu yếu tố bắt buộc: ${r.thieu.filter((y) => y.req).map(short).join('; ')}`;
}

