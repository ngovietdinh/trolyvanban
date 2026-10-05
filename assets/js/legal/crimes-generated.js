// Sinh dữ liệu cấu thành và bộ câu hỏi cho các tội danh chưa có dữ liệu chuyên sâu,
// theo mẫu của từng chương/lĩnh vực trong Bộ luật Hình sự. Kết quả luôn tinh chỉnh được
// (thêm hành vi thủ công, câu hỏi, AI gợi ý) và được cập nhật khi nạp nguyên văn Bộ luật.

import { CHAPTERS, chapterOf } from './blhs-catalog.js';

const hv = (id, ten, cauHoi = [], taiLieu = []) => ({ id, ten, cauHoi, taiLieu });
const lower1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const conduct = (ten) => lower1(String(ten).replace(/^Tội\s+/i, ''));

/** Lĩnh vực mới (ngoài 4 lĩnh vực có dữ liệu chuyên sâu) — xếp theo thứ tự chương của Bộ luật. */
export const NEW_DOMAINS = [
  { id: 'an-ninh', ten: 'An ninh quốc gia', icon: 'shield', moTa: 'Phản bội Tổ quốc, lật đổ, gián điệp, khủng bố, tuyên truyền chống Nhà nước', groups: [
    { id: 'an-ninh', ten: 'Xâm phạm an ninh quốc gia', moTa: 'Điều 108–116, 118, 119' },
    { id: 'tuyen-truyen', ten: 'Tuyên truyền chống Nhà nước – trốn ra nước ngoài', moTa: 'Điều 117, 120, 121' },
  ] },
  { id: 'tinh-mang', ten: 'Tính mạng – Sức khỏe – Nhân phẩm', icon: 'user', moTa: 'Giết người, cố ý gây thương tích, xâm hại tình dục, mua bán người, làm nhục, vu khống', groups: [
    { id: 'tinh-mang', ten: 'Xâm phạm tính mạng', moTa: 'Điều 123–133' },
    { id: 'suc-khoe', ten: 'Xâm phạm sức khỏe', moTa: 'Điều 134–140, 148, 149' },
    { id: 'tinh-duc', ten: 'Xâm hại tình dục', moTa: 'Điều 141–147' },
    { id: 'mua-ban-nguoi', ten: 'Mua bán người, chiếm đoạt người', moTa: 'Điều 150–154' },
    { id: 'danh-du', ten: 'Danh dự, nhân phẩm', moTa: 'Điều 155, 156' },
  ] },
  { id: 'tu-do', ten: 'Quyền tự do – Dân chủ', icon: 'quote', moTa: 'Bắt giữ người trái pháp luật, xâm phạm chỗ ở, thư tín, quyền bầu cử, khiếu nại, tố cáo', groups: [
    { id: 'tu-do-than-the', ten: 'Tự do thân thể, chỗ ở, bí mật thư tín', moTa: 'Điều 157–159' },
    { id: 'dan-chu', ten: 'Quyền dân chủ của công dân', moTa: 'Điều 160–167' },
  ] },
  { id: 'so-huu', ten: 'Sở hữu', icon: 'key', moTa: 'Cướp, cưỡng đoạt, cướp giật, trộm cắp, hủy hoại tài sản (lừa đảo, lạm dụng tín nhiệm: xem Kinh tế)', groups: [
    { id: 'chiem-doat-bao-luc', ten: 'Chiếm đoạt có dùng bạo lực, đe dọa', moTa: 'Điều 168–171' },
    { id: 'chiem-doat', ten: 'Chiếm đoạt không dùng bạo lực', moTa: 'Điều 172, 173 (174, 175 ở lĩnh vực Kinh tế)' },
    { id: 'khong-chiem-doat', ten: 'Không có mục đích chiếm đoạt', moTa: 'Điều 176–180' },
  ] },
  { id: 'hon-nhan', ten: 'Hôn nhân – Gia đình', icon: 'home', moTa: 'Cưỡng ép kết hôn, tảo hôn, vi phạm chế độ một vợ một chồng, ngược đãi, cấp dưỡng', groups: [
    { id: 'hon-nhan', ten: 'Chế độ hôn nhân', moTa: 'Điều 181–183' },
    { id: 'gia-dinh', ten: 'Quan hệ gia đình', moTa: 'Điều 184–187' },
  ] },
  { id: 'ma-tuy', ten: 'Ma túy', icon: 'alert', moTa: 'Trồng, sản xuất, tàng trữ, vận chuyển, mua bán, tổ chức sử dụng trái phép chất ma túy', groups: [
    { id: 'san-xuat-mua-ban', ten: 'Sản xuất, tàng trữ, vận chuyển, mua bán', moTa: 'Điều 247–252' },
    { id: 'tien-chat', ten: 'Tiền chất, dụng cụ, quản lý chất ma túy', moTa: 'Điều 253, 254, 259' },
    { id: 'su-dung', ten: 'Tổ chức, chứa chấp, lôi kéo, cưỡng bức sử dụng', moTa: 'Điều 255–258' },
  ] },
  { id: 'giao-thong', ten: 'An toàn giao thông', icon: 'zap', moTa: 'Đường bộ, đường sắt, đường thủy, hàng không, hàng hải; đua xe trái phép', groups: [
    { id: 'duong-bo', ten: 'Giao thông đường bộ – đua xe', moTa: 'Điều 260–266' },
    { id: 'duong-sat', ten: 'Giao thông đường sắt', moTa: 'Điều 267–271' },
    { id: 'duong-thuy', ten: 'Giao thông đường thủy', moTa: 'Điều 272–276' },
    { id: 'hang-khong', ten: 'Hàng không – hàng hải', moTa: 'Điều 277–284' },
    { id: 'cong-trinh-gt', ten: 'Công trình giao thông', moTa: 'Điều 281' },
  ] },
  { id: 'cong-nghe', ten: 'Công nghệ thông tin – Mạng viễn thông', icon: 'command', moTa: 'Tấn công, xâm nhập mạng, lừa đảo qua mạng, mua bán thông tin tài khoản, tần số vô tuyến', groups: [
    { id: 'tan-cong-mang', ten: 'Tấn công, xâm nhập hệ thống', moTa: 'Điều 285–287, 289' },
    { id: 'lua-dao-mang', ten: 'Chiếm đoạt tài sản qua mạng', moTa: 'Điều 290' },
    { id: 'thong-tin-du-lieu', ten: 'Thông tin, dữ liệu, tài khoản', moTa: 'Điều 288, 291' },
    { id: 'tan-so', ten: 'Tần số vô tuyến điện', moTa: 'Điều 293, 294' },
  ] },
  { id: 'trat-tu', ten: 'Trật tự công cộng', icon: 'megaphone', moTa: 'Gây rối, đánh bạc, rửa tiền, tiêu thụ tài sản phạm tội, mại dâm, văn hóa phẩm đồi trụy', groups: [
    { id: 'gay-roi', ten: 'Gây rối, xúc phạm, mê tín dị đoan', moTa: 'Điều 318–320' },
    { id: 'co-bac', ten: 'Đánh bạc, tổ chức đánh bạc', moTa: 'Điều 321, 322' },
    { id: 'rua-tien', ten: 'Rửa tiền, tiêu thụ tài sản do phạm tội mà có', moTa: 'Điều 323, 324' },
    { id: 'mai-dam-van-hoa', ten: 'Mại dâm, văn hóa phẩm đồi trụy, người dưới 18 tuổi', moTa: 'Điều 325–329' },
  ] },
  { id: 'hanh-chinh', ten: 'Trật tự quản lý hành chính', icon: 'building', moTa: 'Chống người thi hành công vụ, nghĩa vụ quân sự, giấy tờ, con dấu, bí mật nhà nước, xuất nhập cảnh', groups: [
    { id: 'cong-vu', ten: 'Chống người thi hành công vụ, lợi dụng quyền tự do dân chủ', moTa: 'Điều 330, 331' },
    { id: 'nghia-vu-quan-su', ten: 'Nghĩa vụ quân sự', moTa: 'Điều 332–335' },
    { id: 'giay-to-con-dau', ten: 'Giấy tờ, con dấu, hộ tịch, giả mạo chức vụ', moTa: 'Điều 336, 339–342' },
    { id: 'bi-mat-nha-nuoc', ten: 'Bí mật nhà nước', moTa: 'Điều 337, 338' },
    { id: 'xuat-nhap-canh', ten: 'Biên giới, xuất cảnh, nhập cảnh', moTa: 'Điều 346–350' },
    { id: 'quan-ly-khac', ten: 'Nhà ở, xuất bản, di tích và quản lý khác', moTa: 'Điều 343–345, 351' },
  ] },
  { id: 'tu-phap', ten: 'Hoạt động tư pháp', icon: 'book', moTa: 'Truy cứu oan sai, bức cung, dùng nhục hình, làm sai lệch hồ sơ, khai báo gian dối, che giấu tội phạm', groups: [
    { id: 'nguoi-tien-hanh', ten: 'Người tiến hành tố tụng làm trái', moTa: 'Điều 368–375' },
    { id: 'giam-giu', ten: 'Giam giữ, trốn, đánh tháo', moTa: 'Điều 376–378, 386, 387' },
    { id: 'thi-hanh-an', ten: 'Thi hành án, niêm phong, kê biên', moTa: 'Điều 379–381, 385' },
    { id: 'nguoi-tham-gia', ten: 'Khai báo, che giấu, không tố giác, phiên tòa', moTa: 'Điều 382–384, 389–391' },
  ] },
  { id: 'quan-nhan', ten: 'Nghĩa vụ quân nhân', icon: 'shield', moTa: 'Chống mệnh lệnh, đào ngũ, bí mật quân sự, vũ khí quân dụng, tội trong chiến đấu', groups: [
    { id: 'ky-luat', ten: 'Mệnh lệnh, kỷ luật, đào ngũ', moTa: 'Điều 393–398, 402, 403, 406–408' },
    { id: 'chien-dau', ten: 'Trong chiến đấu, huấn luyện', moTa: 'Điều 399–401, 409, 413–417' },
    { id: 'bi-mat-vu-khi', ten: 'Bí mật quân sự, vũ khí quân dụng', moTa: 'Điều 404, 405, 410–412' },
  ] },
  { id: 'chien-tranh', ten: 'Hòa bình – Chống loài người – Chiến tranh', icon: 'alert', moTa: 'Phá hoại hòa bình, tội chống loài người, tội phạm chiến tranh, lính đánh thuê', groups: [{ id: 'chien-tranh', ten: 'Tội phạm quốc tế', moTa: 'Điều 421–425' }] },
];

/** Nhóm bổ sung vào lĩnh vực "Y tế – An toàn công cộng" (Chương XXI Mục 3). */
export const EXTRA_GROUPS = {
  'y-te-an-toan': [
    { id: 'khung-bo', ten: 'Khủng bố, bắt cóc con tin, cướp biển', moTa: 'Điều 299–303' },
    { id: 'vu-khi', ten: 'Vũ khí, vật liệu nổ, công cụ hỗ trợ', moTa: 'Điều 304–308' },
    { id: 'phong-xa-chat-doc', ten: 'Chất phóng xạ, chất cháy, chất độc', moTa: 'Điều 309–312' },
  ],
};

/* ---------------- Mẫu cấu thành và câu hỏi theo lĩnh vực / nhóm ---------------- */

const CHU_THE_CHUNG = 'Người từ đủ 16 tuổi trở lên có năng lực trách nhiệm hình sự (người từ đủ 14 đến dưới 16 tuổi chịu TNHS đối với tội rất nghiêm trọng, đặc biệt nghiêm trọng thuộc các điều luật tại khoản 2 Điều 12 BLHS)';
const DK_CHUNG = ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Tái phạm nguy hiểm', 'Lợi dụng chức vụ, quyền hạn'];

const TPL = {
  'an-ninh': {
    khachThe: 'An ninh quốc gia: độc lập, chủ quyền, thống nhất, toàn vẹn lãnh thổ, chế độ chính trị, chế độ kinh tế, nền văn hóa, quốc phòng, an ninh, đối ngoại',
    chuThe: CHU_THE_CHUNG + '; một số tội chỉ do công dân Việt Nam thực hiện (vd: Điều 108)',
    loi: 'Cố ý trực tiếp; mục đích chống chính quyền nhân dân (đối với các tội có dấu hiệu mục đích)',
    cauHoi: [
      'Mục đích của việc làm này là gì; có nhằm chống chính quyền nhân dân, gây phương hại đến an ninh quốc gia không?',
      'Có tham gia, liên hệ với tổ chức, cá nhân nào trong nước hoặc nước ngoài; ai tuyển mộ, chỉ đạo, cung cấp kinh phí?',
      'Hình thức liên lạc (ứng dụng, tài khoản, mật danh), thời gian, nội dung các lần liên lạc?',
      'Tài liệu, phương tiện, tiền bạc được cung cấp, sử dụng là gì; hiện cất giữ ở đâu?',
      'Phạm vi, đối tượng bị tác động; hậu quả đã xảy ra?',
    ],
    dinhKhung: ['Người tổ chức, người xúi giục, người hoạt động đắc lực', 'Gây hậu quả nghiêm trọng hoặc đặc biệt nghiêm trọng', 'Người đồng phạm khác', 'Chuẩn bị phạm tội'],
    chuyenMon: ['an-ninh'],
  },
  'tinh-mang': {
    khachThe: 'Quyền được tôn trọng và bảo vệ tính mạng, sức khỏe, danh dự, nhân phẩm của con người',
    chuThe: CHU_THE_CHUNG,
    cauHoi: [
      'Giữa người thực hiện và người bị hại có quan hệ gì; trước đó có mâu thuẫn, xích mích gì không?',
      'Công cụ, phương tiện, hung khí sử dụng là gì; có từ đâu; sau đó cất giấu, vứt bỏ ở đâu?',
      'Tác động vào vị trí nào trên cơ thể nạn nhân, bao nhiêu lần, với lực như thế nào?',
      'Sau khi sự việc xảy ra, ai sơ cứu, đưa nạn nhân đi cấp cứu; người thực hiện đã làm gì?',
      'Những ai có mặt tại hiện trường; có camera, hình ảnh ghi lại không?',
    ],
    dinhKhung: ['Có tính chất côn đồ', 'Dùng hung khí nguy hiểm hoặc thủ đoạn gây nguy hại cho nhiều người', 'Đối với người dưới 16 tuổi, phụ nữ mà biết là có thai, người già yếu, ốm đau hoặc không có khả năng tự vệ', 'Đối với người đang thi hành công vụ hoặc vì lý do công vụ của nạn nhân', 'Có tổ chức', 'Phạm tội 02 lần trở lên', 'Đối với 02 người trở lên', 'Tái phạm nguy hiểm'],
    chuyenMon: ['phap-y', 'hien-truong'],
    nhom: {
      'tinh-duc': {
        khachThe: 'Quyền bất khả xâm phạm về tình dục; sự phát triển bình thường về thể chất, tâm sinh lý của người dưới 16 tuổi',
        cauHoi: [
          'Tuổi của bị hại tại thời điểm xảy ra sự việc (căn cứ giấy khai sinh, căn cước); người thực hiện có biết tuổi của bị hại không?',
          'Bị hại có đồng ý không; có bị dùng vũ lực, đe dọa, lợi dụng tình trạng không thể tự vệ, lệ thuộc hoặc quẫn bách không?',
          'Thời gian, địa điểm, số lần xảy ra; ai biết, ai được bị hại kể lại sớm nhất?',
          'Có tin nhắn, hình ảnh, vật chứng (quần áo, dấu vết sinh học) nào liên quan; hiện ở đâu?',
        ],
        dinhKhung: ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Đối với 02 người trở lên', 'Nhiều người hiếp một người', 'Đối với người mà người phạm tội có trách nhiệm chăm sóc, giáo dục, chữa bệnh', 'Gây thương tích hoặc tổn hại sức khỏe, rối loạn tâm thần và hành vi', 'Làm nạn nhân có thai', 'Tái phạm nguy hiểm'],
        chuyenMon: ['phap-y'],
      },
      'mua-ban-nguoi': {
        cauHoi: [
          'Ai tuyển mộ, dụ dỗ nạn nhân; bằng lời hứa hẹn gì (việc làm, kết hôn, du lịch…)?',
          'Nạn nhân được vận chuyển, chứa chấp, giao nhận qua những địa điểm nào, ai đưa đón?',
          'Giá trị giao dịch, tiền nhận được, phương thức thanh toán; ai hưởng lợi?',
          'Mục đích: bóc lột tình dục, cưỡng bức lao động, lấy bộ phận cơ thể hay mục đích vô nhân đạo khác?',
        ],
        dinhKhung: ['Có tổ chức', 'Vì động cơ đê hèn', 'Đưa nạn nhân ra khỏi biên giới', 'Đối với từ 02 người trở lên', 'Để lấy bộ phận cơ thể của nạn nhân', 'Phạm tội 02 lần trở lên', 'Gây tổn thương cơ thể hoặc rối loạn tâm thần cho nạn nhân'],
        chuyenMon: ['hien-truong'],
      },
      'danh-du': {
        cauHoi: [
          'Lời nói, hành động, thông tin xúc phạm hoặc bịa đặt cụ thể là gì; được nói/đăng ở đâu, khi nào, bao nhiêu người biết?',
          'Thông tin đó có đúng sự thật không; người đưa tin có căn cứ gì?',
          'Mục đích của việc làm này; hậu quả đối với danh dự, uy tín của bị hại?',
        ],
        dinhKhung: ['Phạm tội 02 lần trở lên', 'Đối với 02 người trở lên', 'Sử dụng mạng máy tính, mạng viễn thông, phương tiện điện tử để phạm tội', 'Đối với người đang thi hành công vụ', 'Vu khống người khác phạm tội rất nghiêm trọng, đặc biệt nghiêm trọng'],
        chuyenMon: ['cntt'],
      },
    },
  },
  'tu-do': {
    khachThe: 'Quyền tự do thân thể, bất khả xâm phạm về chỗ ở, bí mật đời tư và các quyền tự do, dân chủ của công dân',
    chuThe: CHU_THE_CHUNG + '; nhiều tội có chủ thể là người có chức vụ, quyền hạn',
    loi: 'Cố ý',
    cauHoi: [
      'Quyền nào của công dân đã bị xâm phạm; cụ thể bị xâm phạm như thế nào?',
      'Người thực hiện căn cứ vào văn bản, quyết định nào; có thẩm quyền không?',
      'Thời gian, địa điểm, người có mặt; hậu quả đối với người bị xâm phạm?',
    ],
    dinhKhung: ['Lợi dụng chức vụ, quyền hạn', 'Phạm tội 02 lần trở lên', 'Đối với 02 người trở lên', 'Làm người bị hại tự sát', 'Gây hậu quả nghiêm trọng'],
    chuyenMon: ['cong-vu'],
  },
  'so-huu': {
    khachThe: 'Quyền sở hữu tài sản (đối với các tội có bạo lực: đồng thời xâm phạm tính mạng, sức khỏe)',
    chuThe: CHU_THE_CHUNG,
    loi: 'Cố ý; mục đích chiếm đoạt (đối với các tội chiếm đoạt)',
    cauHoi: [
      'Tài sản bị xâm phạm gồm những gì (chủng loại, số lượng, đặc điểm nhận dạng); thuộc sở hữu của ai?',
      'Giá trị tài sản tại thời điểm xảy ra sự việc; đã định giá chưa?',
      'Thủ đoạn thực hiện cụ thể; công cụ, phương tiện sử dụng?',
      'Tài sản sau khi chiếm đoạt được cất giấu, tiêu thụ ở đâu, bán cho ai, giá bao nhiêu; tiền sử dụng vào việc gì?',
    ],
    dinhKhung: ['Có tổ chức', 'Có tính chất chuyên nghiệp', 'Tái phạm nguy hiểm', 'Chiếm đoạt tài sản trị giá từ 50 triệu đồng trở lên (các khoản tăng nặng)', 'Dùng thủ đoạn xảo quyệt, nguy hiểm', 'Lợi dụng thiên tai, dịch bệnh'],
    chuyenMon: ['hien-truong'],
    nhom: {
      'chiem-doat-bao-luc': {
        cauHoi: [
          'Có dùng vũ lực, đe dọa dùng vũ lực ngay tức khắc hoặc hành vi khác làm người bị hại lâm vào tình trạng không thể chống cự không; cụ thể như thế nào?',
          'Hung khí, phương tiện (xe máy…) sử dụng; ai chuẩn bị, ai điều khiển?',
          'Người bị hại có bị thương tích không; tỷ lệ tổn thương cơ thể?',
        ],
        dinhKhung: ['Có tổ chức', 'Có tính chất chuyên nghiệp', 'Dùng vũ khí, phương tiện hoặc thủ đoạn nguy hiểm khác', 'Gây thương tích hoặc tổn hại sức khỏe cho người khác', 'Đối với người dưới 16 tuổi, phụ nữ mà biết là có thai, người già yếu', 'Tái phạm nguy hiểm', 'Hành hung để tẩu thoát'],
        chuyenMon: ['hien-truong', 'phap-y'],
      },
    },
  },
  'hon-nhan': {
    khachThe: 'Chế độ hôn nhân và gia đình tự nguyện, tiến bộ, một vợ một chồng, bình đẳng; quyền và nghĩa vụ giữa các thành viên gia đình',
    chuThe: CHU_THE_CHUNG,
    loi: 'Cố ý',
    cauHoi: [
      'Quan hệ hôn nhân, gia đình giữa các bên (giấy chứng nhận kết hôn, quan hệ huyết thống, nuôi dưỡng)?',
      'Hành vi vi phạm cụ thể, diễn ra từ khi nào, bao nhiêu lần?',
      'Đã bị xử lý vi phạm hành chính, nhắc nhở, hòa giải về hành vi này chưa?',
      'Hậu quả đối với người bị hại (sức khỏe, tinh thần, đời sống)?',
    ],
    dinhKhung: ['Đã bị xử phạt vi phạm hành chính về hành vi này mà còn vi phạm', 'Làm cho quan hệ hôn nhân của một hoặc hai bên dẫn đến ly hôn', 'Làm người bị hại tự sát', 'Đối với người dưới 18 tuổi', 'Phạm tội 02 lần trở lên'],
    chuyenMon: [],
  },
  'ma-tuy': {
    khachThe: 'Chế độ quản lý của Nhà nước đối với chất ma túy, tiền chất; sức khỏe cộng đồng, trật tự an toàn xã hội',
    chuThe: CHU_THE_CHUNG,
    loi: 'Cố ý',
    cauHoi: [
      'Loại chất ma túy (heroin, ma túy tổng hợp, cần sa…), khối lượng, số lượng; được đóng gói, cất giấu như thế nào?',
      'Nguồn gốc chất ma túy: mua của ai, ở đâu, khi nào, giá bao nhiêu, liên lạc qua phương tiện gì?',
      'Mục đích tàng trữ/vận chuyển: để bán, để sử dụng hay cất giữ hộ người khác?',
      'Đã bán, giao cho những ai; số lần, khối lượng mỗi lần, số tiền thu được?',
      'Đường dây gồm những ai; vai trò của từng người; phương thức giao nhận, thanh toán (tiền mặt, chuyển khoản)?',
    ],
    dinhKhung: ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Đối với 02 người trở lên', 'Lợi dụng chức vụ, quyền hạn hoặc danh nghĩa cơ quan, tổ chức', 'Sử dụng người dưới 16 tuổi vào việc phạm tội hoặc bán ma túy cho người dưới 16 tuổi', 'Qua biên giới', 'Khối lượng chất ma túy thuộc khoản 2, 3, 4', 'Tái phạm nguy hiểm'],
    chuyenMon: ['ma-tuy'],
  },
  'giao-thong': {
    khachThe: 'An toàn giao thông, an toàn công cộng; tính mạng, sức khỏe, tài sản của người tham gia giao thông',
    chuThe: CHU_THE_CHUNG + '; với một số tội là người có trách nhiệm quản lý phương tiện, công trình giao thông',
    loi: 'Vô ý đối với hậu quả (riêng tội cản trở giao thông, đua xe, chiếm đoạt tàu bay, tàu thủy là cố ý)',
    cauHoi: [
      'Phương tiện điều khiển (loại, biển số, chủ sở hữu); giấy phép lái xe/bằng, chứng chỉ chuyên môn còn hiệu lực không?',
      'Tình trạng trước khi điều khiển: có sử dụng rượu, bia, chất ma túy không; nghỉ ngơi bao lâu?',
      'Tốc độ, làn đường, hướng đi, tín hiệu, điều kiện thời tiết, mặt đường tại thời điểm xảy ra?',
      'Diễn biến va chạm/sự cố: thời điểm phát hiện nguy hiểm, biện pháp xử lý (phanh, đánh lái)?',
      'Sau tai nạn: có dừng lại, cứu giúp người bị nạn, báo cơ quan chức năng không?',
    ],
    dinhKhung: ['Không có giấy phép hoặc bằng lái theo quy định', 'Trong tình trạng có sử dụng rượu, bia mà nồng độ cồn vượt mức quy định hoặc có sử dụng chất ma túy, chất kích thích', 'Gây tai nạn rồi bỏ chạy để trốn tránh trách nhiệm hoặc cố ý không cứu giúp người bị nạn', 'Không chấp hành hiệu lệnh của người điều khiển, hướng dẫn giao thông', 'Làm chết 02 người trở lên', 'Gây thiệt hại về tài sản lớn'],
    chuyenMon: ['giao-thong'],
  },
  'cong-nghe': {
    khachThe: 'An toàn, an ninh của mạng máy tính, mạng viễn thông, phương tiện điện tử; quyền sở hữu, quyền riêng tư',
    chuThe: CHU_THE_CHUNG,
    loi: 'Cố ý',
    cauHoi: [
      'Thiết bị, tài khoản (email, mạng xã hội, ví điện tử, ngân hàng), số điện thoại, địa chỉ IP đã sử dụng; ai đăng ký, ai quản lý?',
      'Công cụ, phần mềm, mã độc sử dụng; mua/tải ở đâu, ai hướng dẫn?',
      'Hệ thống, dữ liệu, tài khoản nào bị xâm nhập, tác động; thời gian, phương thức?',
      'Số người bị hại, số tiền chiếm đoạt hoặc thu lợi; tiền được chuyển qua những tài khoản nào, rút ở đâu?',
    ],
    dinhKhung: ['Có tổ chức', 'Lợi dụng quyền quản trị mạng máy tính, mạng viễn thông', 'Có tính chất chuyên nghiệp', 'Thu lợi bất chính hoặc gây thiệt hại từ mức luật định', 'Đối với hệ thống dữ liệu thuộc bí mật nhà nước, hệ thống thông tin phục vụ quốc phòng, an ninh', 'Phạm tội 02 lần trở lên'],
    chuyenMon: ['cntt'],
  },
  'y-te-an-toan': {
    khachThe: 'An toàn công cộng; chế độ quản lý vũ khí, vật liệu nổ, chất phóng xạ, chất độc; tính mạng, sức khỏe, tài sản',
    chuThe: CHU_THE_CHUNG,
    loi: 'Cố ý (riêng các tội vi phạm quy định quản lý, thiếu trách nhiệm có thể vô ý đối với hậu quả)',
    cauHoi: [
      'Nguồn gốc vật phẩm/chất nguy hiểm: mua, chế tạo, chiếm đoạt từ đâu, khi nào, của ai?',
      'Chủng loại, số lượng, đặc điểm; cất giữ ở đâu, bảo quản thế nào?',
      'Mục đích tàng trữ, sử dụng; đã sử dụng vào việc gì, gây hậu quả gì?',
      'Có giấy phép, quyết định giao quản lý không; trách nhiệm quản lý theo quy định?',
    ],
    dinhKhung: ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Vận chuyển, mua bán qua biên giới', 'Làm chết người hoặc gây thương tích cho người khác', 'Gây thiệt hại về tài sản lớn', 'Tái phạm nguy hiểm'],
    chuyenMon: ['vu-khi'],
    nhom: {
      'khung-bo': {
        khachThe: 'An toàn công cộng, tính mạng, sức khỏe, tự do của con người; an ninh quốc gia',
        cauHoi: [
          'Mục đích của hành vi: gây ra tình trạng hoảng sợ trong công chúng, ép buộc cơ quan, tổ chức làm hoặc không làm một việc?',
          'Ai tổ chức, tài trợ, huấn luyện; nguồn kinh phí, vũ khí, phương tiện?',
          'Mục tiêu, kế hoạch, thời gian, địa điểm thực hiện; ai được phân công việc gì?',
        ],
        chuyenMon: ['an-ninh', 'vu-khi'],
      },
      'an-toan-lao-dong': {
        khachThe: 'An toàn lao động, quyền của người lao động, an toàn công trình',
        cauHoi: [
          'Quan hệ lao động giữa các bên (hợp đồng, thỏa thuận); điều kiện, thời gian làm việc thực tế?',
          'Người lao động có bị ép buộc, đe dọa, giữ giấy tờ, trừ lương không?',
          'Quy định an toàn nào bị vi phạm; ai có trách nhiệm bảo đảm?',
        ],
        chuyenMon: ['lao-dong-pccc'],
      },
    },
  },
  'trat-tu': {
    khachThe: 'Trật tự công cộng, nếp sống văn minh, an toàn xã hội',
    chuThe: CHU_THE_CHUNG,
    loi: 'Cố ý',
    cauHoi: [
      'Hành vi diễn ra ở đâu, khi nào, kéo dài bao lâu; có bao nhiêu người tham gia, chứng kiến?',
      'Vai trò của từng người tham gia; ai khởi xướng, tổ chức?',
      'Tiền, tài sản, phương tiện liên quan; thu lợi bao nhiêu?',
    ],
    dinhKhung: DK_CHUNG,
    chuyenMon: [],
    nhom: {
      'co-bac': {
        cauHoi: [
          'Hình thức đánh bạc (xóc đĩa, tá lả, cá độ bóng đá, đánh bạc qua mạng…); thời gian, địa điểm, những người tham gia?',
          'Tổng số tiền, hiện vật dùng đánh bạc trong cùng một lần; tiền thu giữ trên chiếu bạc và trên người?',
          'Ai tổ chức, cung cấp địa điểm, phương tiện, tài khoản; thu tiền xâu bao nhiêu?',
          'Trước đó đã bị xử phạt hành chính hoặc kết án về đánh bạc chưa?',
        ],
        dinhKhung: ['Có tính chất chuyên nghiệp', 'Tiền, hiện vật dùng đánh bạc trị giá từ 50 triệu đồng trở lên', 'Sử dụng mạng internet, mạng máy tính, mạng viễn thông hoặc phương tiện điện tử để phạm tội', 'Tái phạm nguy hiểm'],
        chuyenMon: ['cntt'],
      },
      'rua-tien': {
        cauHoi: [
          'Nguồn gốc tiền, tài sản: do ai phạm tội mà có; người thực hiện có biết hoặc có cơ sở để biết không?',
          'Các giao dịch đã thực hiện (chuyển khoản, mua bán bất động sản, góp vốn, đầu tư); thời gian, giá trị?',
          'Tài sản hiện ở đâu, đứng tên ai; ai hưởng lợi?',
        ],
        dinhKhung: ['Có tổ chức', 'Có tính chất chuyên nghiệp', 'Phạm tội 02 lần trở lên', 'Lợi dụng chức vụ, quyền hạn', 'Tiền, tài sản phạm tội trị giá từ 500 triệu đồng trở lên', 'Gây ảnh hưởng xấu đến an toàn hệ thống tài chính, tiền tệ'],
        chuyenMon: ['tai-chinh', 'ngan-hang'],
      },
      'mai-dam-van-hoa': {
        cauHoi: [
          'Địa điểm, thời gian, những người tham gia; người bán dâm/mua dâm là ai, tuổi?',
          'Số tiền giao dịch, cách thức liên hệ (mạng xã hội, môi giới), người hưởng lợi?',
          'Người tổ chức, quản lý, bảo kê là ai?',
        ],
        dinhKhung: ['Đối với người từ đủ 16 tuổi đến dưới 18 tuổi', 'Có tổ chức', 'Cưỡng bức mại dâm', 'Phạm tội 02 lần trở lên', 'Đối với 02 người trở lên', 'Thu lợi bất chính từ mức luật định'],
        chuyenMon: [],
      },
    },
  },
  'hanh-chinh': {
    khachThe: 'Trật tự quản lý hành chính của Nhà nước trong các lĩnh vực',
    chuThe: CHU_THE_CHUNG,
    loi: 'Cố ý (riêng tội vô ý làm lộ bí mật nhà nước là vô ý)',
    cauHoi: [
      'Quy định quản lý hành chính nào bị vi phạm; người thực hiện có biết quy định đó không?',
      'Hành vi cụ thể, thời gian, địa điểm, số lần thực hiện?',
      'Mục đích, động cơ; thu lợi hoặc gây thiệt hại gì?',
      'Đã bị xử phạt vi phạm hành chính về hành vi này chưa?',
    ],
    dinhKhung: DK_CHUNG.concat(['Gây hậu quả nghiêm trọng']),
    chuyenMon: ['cong-vu'],
    nhom: {
      'cong-vu': {
        cauHoi: [
          'Người thi hành công vụ là ai, đang thực hiện nhiệm vụ gì, có mặc trang phục, xuất trình giấy tờ không?',
          'Hành vi chống đối cụ thể: dùng vũ lực, đe dọa dùng vũ lực hay thủ đoạn khác; nhằm cản trở việc gì?',
          'Hậu quả đối với người thi hành công vụ và nhiệm vụ đang thực hiện?',
        ],
        dinhKhung: ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Xúi giục, lôi kéo, kích động người khác phạm tội', 'Gây thiệt hại về tài sản', 'Tái phạm nguy hiểm'],
        chuyenMon: [],
      },
      'giay-to-con-dau': {
        cauHoi: [
          'Loại con dấu, tài liệu, giấy tờ bị làm giả/sửa chữa/sử dụng (bằng cấp, giấy phép, sổ đỏ, căn cước…); số lượng?',
          'Ai làm, làm ở đâu, bằng thiết bị gì; đặt làm qua ai, giá bao nhiêu?',
          'Giấy tờ giả đã được sử dụng vào việc gì, nộp cho cơ quan nào, thu lợi gì?',
        ],
        dinhKhung: ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Làm từ 02 đến 05 con dấu, tài liệu hoặc giấy tờ khác (và các mức cao hơn)', 'Sử dụng con dấu, tài liệu giả thực hiện tội phạm rất nghiêm trọng, đặc biệt nghiêm trọng', 'Thu lợi bất chính từ mức luật định'],
        chuyenMon: ['tai-lieu'],
      },
    },
  },
  'tu-phap': {
    khachThe: 'Hoạt động đúng đắn của cơ quan tiến hành tố tụng, cơ quan thi hành án; quyền, lợi ích hợp pháp của người tham gia tố tụng',
    chuThe: 'Người có thẩm quyền tiến hành tố tụng, thi hành án (đối với các tội do người tiến hành tố tụng thực hiện); người tham gia tố tụng hoặc người khác (đối với các tội còn lại)',
    loi: 'Cố ý (riêng tội thiếu trách nhiệm để người bị giam giữ trốn là vô ý)',
    cauHoi: [
      'Vụ án/vụ việc liên quan: giai đoạn tố tụng, người được phân công giải quyết theo quyết định nào?',
      'Hành vi làm trái, gian dối, cản trở cụ thể là gì; thời gian, cách thức thực hiện?',
      'Hồ sơ, tài liệu, chứng cứ nào bị tác động; trước và sau khi tác động khác nhau thế nào?',
      'Động cơ, mục đích; có nhận lợi ích hoặc chịu sự tác động của ai không?',
      'Hậu quả đối với việc giải quyết vụ án và quyền lợi của người liên quan?',
    ],
    dinhKhung: ['Có tổ chức', 'Đối với 02 người trở lên', 'Đối với người dưới 18 tuổi, phụ nữ mà biết là có thai, người già yếu', 'Người bị oan bị kết án về tội rất nghiêm trọng, đặc biệt nghiêm trọng', 'Làm người bị hại tự sát', 'Dẫn đến làm sai lệch kết quả giải quyết vụ án'],
    chuyenMon: ['tu-phap'],
  },
  'quan-nhan': {
    khachThe: 'Chế độ, nghĩa vụ, trách nhiệm của quân nhân; sức mạnh chiến đấu và kỷ luật của quân đội',
    chuThe: 'Quân nhân tại ngũ, công chức, công nhân, viên chức quốc phòng, quân nhân dự bị trong thời gian tập trung huấn luyện hoặc kiểm tra tình trạng sẵn sàng chiến đấu; dân quân, tự vệ phối thuộc với quân đội; công dân được trưng tập vào phục vụ quân đội (Điều 392)',
    loi: 'Cố ý (một số tội vô ý: làm mất, vô ý làm lộ…)',
    cauHoi: [
      'Cấp bậc, chức vụ, đơn vị; nhiệm vụ được giao tại thời điểm xảy ra sự việc theo mệnh lệnh, quyết định nào?',
      'Mệnh lệnh/quy định nào bị vi phạm; người thực hiện có được phổ biến, nắm rõ không?',
      'Diễn biến sự việc; hoàn cảnh (thời bình, thời chiến, trong chiến đấu, huấn luyện)?',
      'Hậu quả đối với nhiệm vụ của đơn vị, vũ khí, trang bị, con người?',
    ],
    dinhKhung: ['Là chỉ huy hoặc sĩ quan', 'Lôi kéo người khác phạm tội', 'Trong chiến đấu hoặc trong khu vực có chiến sự', 'Trong thời chiến', 'Gây hậu quả nghiêm trọng, rất nghiêm trọng hoặc đặc biệt nghiêm trọng'],
    chuyenMon: ['quan-su'],
  },
  'chien-tranh': {
    khachThe: 'Hòa bình, an ninh nhân loại, các quy tắc của luật pháp quốc tế về chiến tranh',
    chuThe: CHU_THE_CHUNG,
    loi: 'Cố ý',
    cauHoi: [
      'Hành vi cụ thể, thời gian, địa điểm, đối tượng bị tác động (dân thường, tù binh, người bị thương)?',
      'Người tổ chức, chỉ huy, ra lệnh là ai; chuỗi mệnh lệnh?',
      'Có tuyển mộ, huấn luyện, trả thù lao cho người tham gia không; nguồn kinh phí?',
    ],
    dinhKhung: ['Người tổ chức, chỉ huy', 'Gây hậu quả đặc biệt nghiêm trọng'],
    chuyenMon: ['an-ninh'],
  },
};

/** Các lĩnh vực có tài liệu, giám định đặc thù — câu hỏi chuyên môn bổ sung. */
export const EXTRA_EXPERTISE = {
  'an-ninh': {
    ten: 'An ninh – phản gián',
    cauHoi: ['Các tài khoản, nhóm, trang mạng xã hội liên quan do ai lập, quản trị; số lượng người theo dõi, tương tác?', 'Tài liệu, ấn phẩm thu giữ có nội dung gì; nguồn gốc, số lượng đã phát tán?', 'Có nhận tiền, hỗ trợ từ tổ chức, cá nhân nước ngoài không; phương thức chuyển tiền?'],
    taiLieu: ['Dữ liệu điện tử, tài khoản mạng xã hội, thiết bị lưu trữ', 'Tài liệu, ấn phẩm, vật phẩm thu giữ'],
    giamDinh: ['Giám định nội dung tài liệu, ấn phẩm', 'Giám định dữ liệu điện tử'],
  },
  'phap-y': {
    ten: 'Pháp y',
    cauHoi: ['Thương tích, dấu vết trên cơ thể nạn nhân; vị trí, kích thước, cơ chế hình thành?', 'Nạn nhân được cấp cứu, điều trị ở đâu; chẩn đoán, hồ sơ bệnh án?', 'Thời điểm, nguyên nhân chết (nếu có); kết quả khám nghiệm tử thi?'],
    taiLieu: ['Hồ sơ bệnh án, giấy chứng nhận thương tích', 'Biên bản khám nghiệm tử thi', 'Mẫu sinh học thu tại hiện trường'],
    giamDinh: ['Giám định tỷ lệ tổn thương cơ thể', 'Giám định pháp y tử thi', 'Giám định ADN, độc chất', 'Giám định pháp y tâm thần'],
  },
  'hien-truong': {
    ten: 'Hiện trường – dấu vết',
    cauHoi: ['Hiện trường được phát hiện, bảo vệ như thế nào; có bị xáo trộn không?', 'Camera an ninh khu vực ghi nhận những gì; ai quản lý dữ liệu?', 'Dấu vết, vật chứng thu được (vân tay, dấu giày, hung khí, tài sản)?'],
    taiLieu: ['Biên bản khám nghiệm hiện trường, sơ đồ, ảnh hiện trường', 'Dữ liệu camera', 'Vật chứng thu giữ'],
    giamDinh: ['Giám định dấu vết đường vân, dấu vết cơ học', 'Định giá tài sản', 'Giám định hung khí'],
  },
  'ma-tuy': {
    ten: 'Ma túy – tiền chất',
    cauHoi: ['Ma túy thu giữ được niêm phong, cân, lấy mẫu như thế nào; có người chứng kiến không?', 'Đối tượng có sử dụng ma túy không; kết quả xét nghiệm?', 'Dữ liệu điện thoại thể hiện liên lạc mua bán (tin nhắn, cuộc gọi, ví điện tử)?'],
    taiLieu: ['Biên bản bắt người phạm tội quả tang, biên bản niêm phong, mở niêm phong', 'Kết quả xét nghiệm chất ma túy trong cơ thể', 'Dữ liệu điện thoại, sao kê tài khoản'],
    giamDinh: ['Giám định loại, khối lượng chất ma túy', 'Giám định hàm lượng (đối với chất ma túy ở thể lỏng, hỗn hợp theo quy định)'],
  },
  'giao-thong': {
    ten: 'Kỹ thuật giao thông',
    cauHoi: ['Vị trí va chạm, vết phanh, vết cày trên mặt đường; vị trí dừng của phương tiện?', 'Tình trạng kỹ thuật phương tiện (phanh, lái, đèn) trước và sau tai nạn?', 'Kết quả đo nồng độ cồn, xét nghiệm ma túy; thời điểm đo?'],
    taiLieu: ['Biên bản khám nghiệm hiện trường, khám nghiệm phương tiện', 'Kết quả đo nồng độ cồn, xét nghiệm ma túy', 'Giấy phép lái xe, đăng ký, đăng kiểm phương tiện', 'Dữ liệu camera hành trình, camera giao thông'],
    giamDinh: ['Giám định kỹ thuật phương tiện', 'Giám định dấu vết va chạm, tốc độ', 'Giám định pháp y'],
  },
  cntt: {
    ten: 'Công nghệ thông tin – dữ liệu điện tử',
    cauHoi: ['Thiết bị điện tử thu giữ (máy tính, điện thoại, máy chủ) được niêm phong, sao lưu như thế nào?', 'Nhật ký truy cập (log), địa chỉ IP, thời gian tác động vào hệ thống?', 'Các tài khoản ngân hàng, ví điện tử, sàn giao dịch nhận tiền; chủ tài khoản thực tế là ai?'],
    taiLieu: ['Dữ liệu điện tử thu thập theo Điều 107 BLTTHS', 'Thông tin thuê bao, IP từ nhà mạng', 'Sao kê tài khoản ngân hàng, ví điện tử'],
    giamDinh: ['Giám định dữ liệu điện tử, thiết bị số', 'Giám định mã độc, phần mềm'],
  },
  'vu-khi': {
    ten: 'Vũ khí – vật liệu nổ',
    cauHoi: ['Đặc điểm vũ khí/vật liệu nổ (loại, số hiệu, cỡ nòng, khối lượng); còn sử dụng được không?', 'Nguồn gốc: mua trên mạng, tự chế, chiếm đoạt từ đơn vị nào?', 'Đã sử dụng chưa; bắn, nổ ở đâu, khi nào, gây hậu quả gì?'],
    taiLieu: ['Biên bản thu giữ, niêm phong vũ khí, vật liệu nổ', 'Giấy phép sử dụng, sổ theo dõi quản lý vũ khí (nếu có)'],
    giamDinh: ['Giám định vũ khí quân dụng, vật liệu nổ, công cụ hỗ trợ', 'Giám định đường đạn, thuốc súng'],
  },
  'tai-lieu': {
    ten: 'Kỹ thuật hình sự – tài liệu',
    cauHoi: ['Đặc điểm của con dấu, chữ ký, phôi tài liệu so với mẫu thật?', 'Thiết bị dùng để làm giả (máy in, máy khắc dấu, phần mềm) ở đâu, của ai?'],
    taiLieu: ['Tài liệu, con dấu nghi giả thu giữ', 'Mẫu so sánh: chữ ký, con dấu, phôi tài liệu thật'],
    giamDinh: ['Giám định tài liệu, chữ ký, chữ viết, hình dấu'],
  },
  'tu-phap': {
    ten: 'Tố tụng – thi hành án',
    cauHoi: ['Hồ sơ vụ án có những bút lục nào bị thay đổi, thêm bớt; ai quản lý hồ sơ trong thời gian đó?', 'Quyết định, bản án liên quan có nội dung trái pháp luật ở điểm nào; cơ quan nào đã hủy, sửa?', 'Quy trình áp giải, canh gác, quản lý người bị giam giữ theo quy định và thực tế?'],
    taiLieu: ['Hồ sơ vụ án, sổ thụ lý, sổ giao nhận hồ sơ', 'Bản án, quyết định, kháng nghị', 'Sổ theo dõi trực, canh gác tại cơ sở giam giữ'],
    giamDinh: ['Giám định chữ ký, tài liệu trong hồ sơ', 'Giám định pháp y (đối với tội dùng nhục hình)'],
  },
  'quan-su': {
    ten: 'Quân sự',
    cauHoi: ['Mệnh lệnh được truyền đạt bằng hình thức nào, thời gian, người truyền đạt?', 'Điều lệnh, quy định của quân đội liên quan đến nhiệm vụ?', 'Tình trạng vũ khí, trang bị trước và sau sự việc; sổ sách quản lý?'],
    taiLieu: ['Quyết định, mệnh lệnh, kế hoạch nhiệm vụ', 'Sổ trực ban, sổ giao nhận vũ khí, trang bị', 'Hồ sơ quân nhân'],
    giamDinh: ['Giám định vũ khí, trang bị kỹ thuật quân sự'],
  },
};

export const EXTRA_DOMAIN_QUESTIONS = {
  'an-ninh': ['Hoạt động này có liên hệ với tổ chức phản động, thế lực thù địch nào; có sự chỉ đạo từ bên ngoài không?'],
  'tinh-mang': ['Nạn nhân hiện còn sống không; tình trạng sức khỏe, khả năng lấy lời khai?', 'Có người làm chứng trực tiếp nào chưa được lấy lời khai?'],
  'tu-do': ['Người bị xâm phạm đã khiếu nại, phản ánh với cơ quan nào; kết quả giải quyết?'],
  'so-huu': ['Tài sản đã được thu hồi, trả lại cho chủ sở hữu chưa; phần còn lại ở đâu?'],
  'hon-nhan': ['Chính quyền, đoàn thể, tổ hòa giải ở cơ sở đã can thiệp, hòa giải lần nào?'],
  'ma-tuy': ['Trên người, nơi ở, phương tiện của đối tượng còn chất ma túy, tiền, công cụ nào khác không?'],
  'giao-thong': ['Phương tiện được đăng ký, kiểm định, bảo hiểm thế nào; chủ phương tiện có biết người điều khiển không đủ điều kiện không?'],
  'cong-nghe': ['Có người bị hại nào khác chưa trình báo; số tiền thiệt hại tổng cộng?'],
  'trat-tu': ['Lực lượng chức năng đã phát hiện, xử lý tại địa điểm này lần nào trước đây?'],
  'hanh-chinh': ['Cơ quan quản lý chuyên ngành đã phát hiện, xử lý vi phạm này như thế nào trước khi khởi tố?'],
  'tu-phap': ['Lãnh đạo đơn vị đã kiểm tra, phê duyệt các văn bản tố tụng liên quan như thế nào?'],
  'quan-nhan': ['Chỉ huy đơn vị đã quán triệt, kiểm tra việc chấp hành của quân nhân như thế nào?'],
  'chien-tranh': ['Có tài liệu, nhân chứng quốc tế nào ghi nhận hành vi không?'],
};

/* ---------------- Sinh tội danh ---------------- */

function tplFor(domainId, groupId) {
  const base = TPL[domainId] || TPL['hanh-chinh'];
  const g = base.nhom?.[groupId] || {};
  return {
    khachThe: g.khachThe || base.khachThe,
    chuThe: g.chuThe || base.chuThe,
    loi: g.loi || base.loi,
    cauHoi: [...(g.cauHoi || []), ...(g.cauHoi ? base.cauHoi.slice(0, 2) : base.cauHoi)],
    dinhKhung: g.dinhKhung || base.dinhKhung,
    chuyenMon: g.chuyenMon || base.chuyenMon,
  };
}

/** Lỗi theo tên tội (vô ý / thiếu trách nhiệm) hoặc theo mẫu lĩnh vực. */
function loiOf(ten, t) {
  if (/vô ý|thiếu trách nhiệm/i.test(ten)) return 'Vô ý (cẩu thả hoặc quá tự tin) đối với hậu quả';
  return t.loi || 'Cố ý';
}

/**
 * Tạo dữ liệu cấu thành cho một điều luật trong danh mục.
 * Hành vi: tách theo dấu "; tội …" khi một điều quy định nhiều tội (vd: Điều 337, 341).
 */
export function generateCrime([dieu, ten, nhom, flags = ''], official = null) {
  const ch = chapterOf(dieu);
  const linhVuc = CHAPTERS[ch]?.linhVuc;
  const t = tplFor(linhVuc, nhom);
  const name = official?.ten || ten;
  const parts = name.split(/;\s*(?=tội\s)/i).map((p, i) => (i ? p.replace(/^tội\s+/i, 'Tội ') : p));
  const hanhVi = parts.map((p, i) =>
    hv(i ? `hv-${i + 1}` : 'hv-chinh', conduct(p).charAt(0).toUpperCase() + conduct(p).slice(1), i ? [] : t.cauHoi, []),
  );
  const kiemTra = flags.includes('k') && !official;
  const notes = [];
  if (flags.includes('m')) notes.push('Điều luật được bổ sung bởi Luật số 86/2025/QH15 (hiệu lực 01/7/2025).');
  if (kiemTra) notes.push('Tên và số điều trong dữ liệu tích hợp cần đối chiếu nguyên văn Văn bản hợp nhất 135/VBHN-VPQH (2025) — nạp văn bản luật tại “Cập nhật Bộ luật” để xác thực.');
  if (!official) notes.push('Bộ câu hỏi được sinh theo mẫu của chương; tinh chỉnh bằng cách thêm hành vi thủ công, câu hỏi hoặc dùng gợi ý AI.');
  return {
    dieu,
    ten: name,
    nhom,
    chuong: CHAPTERS[ch]?.ten || '',
    khachThe: t.khachThe,
    chuThe: t.chuThe,
    loi: loiOf(name, t),
    dauHieu: official?.dauHieu?.length ? official.dauHieu : [`Có hành vi ${conduct(name)} theo mô tả tại khoản 1 Điều ${dieu} BLHS`, 'Thỏa mãn các dấu hiệu bắt buộc về hậu quả, giá trị, số lượng, tiền sự (nếu điều luật quy định)'],
    hanhVi,
    dinhKhung: official?.dinhKhung?.length ? official.dinhKhung : t.dinhKhung,
    chuyenMon: t.chuyenMon || [],
    ghiChu: notes.join(' '),
    generic: true,
    kiemTra,
    baiBo: flags.includes('b'),
  };
}
