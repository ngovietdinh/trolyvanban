// Danh mục án lệ do Hội đồng Thẩm phán Tòa án nhân dân tối cao thông qua (01/2016/AL → 90/2026/AL).
// Chỉ là DANH MỤC (số, tên, lĩnh vực, ngày thông qua, quyết định công bố, ngày áp dụng, điều luật BLHS liên quan với án
// lệ hình sự) để tra nhanh và đối chiếu; TOÀN VĂN án lệ người dùng nạp vào "Kho bản án, án lệ" (tải từ anle.toaan.gov.vn
// hoặc dán) — phần mềm tự ghép theo số án lệ. Tên án lệ ghi theo quyết định công bố; khi trích dẫn chính thức đối chiếu
// lại với bản đăng trên Cổng thông tin điện tử về án lệ của Tòa án nhân dân tối cao.
export const LINH_VUC = { hs: 'Hình sự', ds: 'Dân sự', hngd: 'Hôn nhân và gia đình', kdtm: 'Kinh doanh, thương mại', ld: 'Lao động', hc: 'Hành chính' };

/** Các đợt công bố: [số đầu, số cuối, ngày thông qua, quyết định công bố, ngày công bố, ngày áp dụng]. */
const DOT = [
  [1, 6, '06/4/2016', '220/QĐ-CA', '06/4/2016', '01/6/2016'],
  [7, 10, '17/10/2016', '698/QĐ-CA', '17/10/2016', '01/12/2016'],
  [11, 16, '14/12/2017', '299/QĐ-CA', '28/12/2017', '15/02/2018'],
  [17, 26, '17/10/2018', '269/QĐ-CA', '06/11/2018', '03/12/2018'],
  [27, 29, '09/8/2019', '293/QĐ-CA', '09/9/2019', '10/10/2019'],
  [30, 37, '05/02/2020', '50/QĐ-CA', '25/02/2020', '15/4/2020'],
  [38, 39, '13/8/2020', '276/QĐ-CA', '02/10/2020', '15/11/2020'],
  [40, 43, '23/02/2021', '42/QĐ-CA', '12/3/2021', '15/4/2021'],
  [44, 52, '25/11/2021', '594/QĐ-CA', '31/12/2021', '01/02/2022'],
  [53, 56, '07/9/2022', '323/QĐ-CA', '14/10/2022', '15/11/2022'],
  [57, 63, '01–03/02/2023', '39/QĐ-CA', '24/02/2023', '27/3/2023'],
  [64, 70, '18/8/2023', '364/QĐ-CA', '01/10/2023', '01/11/2023'],
  [71, 72, '20–23/02/2024', '119A/QĐ-CA', '15/5/2024', ''],
  [73, 82, '24/12/2025', '339a/QĐ-CA', '25/12/2025', '01/02/2026'],
  [83, 90, '21/5/2026', '162/QĐ-CA', '29/5/2026', '01/7/2026'],
];

/** [số, năm, lĩnh vực, tên, điều BLHS liên quan (án lệ hình sự)]. */
const DS = [
  [1, 2016, 'hs', 'về vụ án “Giết người”', ['123', '134']],
  [2, 2016, 'ds', 'về vụ án “Tranh chấp đòi lại tài sản”'],
  [3, 2016, 'hngd', 'về vụ án “Ly hôn”'],
  [4, 2016, 'ds', 'về vụ án “Tranh chấp hợp đồng chuyển nhượng quyền sử dụng đất”'],
  [5, 2016, 'ds', 'về vụ án “Tranh chấp di sản thừa kế”'],
  [6, 2016, 'ds', 'về vụ án “Tranh chấp thừa kế”'],
  [7, 2016, 'ds', 'về công nhận hợp đồng mua bán nhà được xác lập trước ngày 01/7/1991'],
  [8, 2016, 'kdtm', 'về xác định lãi suất, việc điều chỉnh lãi suất trong hợp đồng tín dụng kể từ thời điểm tiếp theo của kỳ hạn thanh toán'],
  [9, 2016, 'kdtm', 'về xác định lãi suất nợ quá hạn trung bình trên thị trường và việc trả lãi trên số tiền phạt vi phạm, bồi thường thiệt hại'],
  [10, 2016, 'hc', 'về quyết định hành chính là đối tượng khởi kiện vụ án hành chính'],
  [11, 2017, 'kdtm', 'về công nhận hợp đồng thế chấp quyền sử dụng đất mà trên đất có tài sản không thuộc sở hữu của bên thế chấp'],
  [12, 2017, 'ds', 'về xác định trường hợp đương sự được triệu tập hợp lệ lần thứ nhất sau khi Tòa án đã hoãn phiên tòa'],
  [13, 2017, 'kdtm', 'về hiệu lực thanh toán của thư tín dụng (L/C) trong trường hợp hợp đồng mua bán hàng hóa quốc tế là cơ sở của L/C bị hủy bỏ'],
  [14, 2017, 'ds', 'về công nhận điều kiện của hợp đồng tặng cho quyền sử dụng đất mà điều kiện đó không được ghi trong hợp đồng'],
  [15, 2017, 'ds', 'về công nhận thỏa thuận miệng của các đương sự trong việc chuyển đổi quyền sử dụng đất nông nghiệp'],
  [16, 2017, 'ds', 'về công nhận hợp đồng chuyển nhượng quyền sử dụng đất là di sản thừa kế do một trong các đồng thừa kế chuyển nhượng'],
  [17, 2018, 'hs', 'về tình tiết “Có tính chất côn đồ” trong tội “Giết người” có đồng phạm', ['123']],
  [18, 2018, 'hs', 'về hành vi giết người đang thi hành công vụ trong tội “Giết người”', ['123']],
  [19, 2018, 'hs', 'về xác định giá trị tài sản bị chiếm đoạt trong tội “Tham ô tài sản”', ['353']],
  [20, 2018, 'ld', 'về xác lập quan hệ hợp đồng lao động sau khi hết thời gian thử việc'],
  [21, 2018, 'kdtm', 'về lỗi và thiệt hại trong trường hợp đơn phương chấm dứt hợp đồng cho thuê tài sản'],
  [22, 2018, 'kdtm', 'về không vi phạm nghĩa vụ cung cấp thông tin tình trạng bệnh lý trong hợp đồng bảo hiểm nhân thọ'],
  [23, 2018, 'kdtm', 'về hiệu lực của hợp đồng bảo hiểm nhân thọ khi bên mua bảo hiểm không đóng phí bảo hiểm do lỗi của doanh nghiệp bảo hiểm'],
  [24, 2018, 'ds', 'về di sản thừa kế chuyển thành tài sản thuộc quyền sở hữu, quyền sử dụng hợp pháp của cá nhân'],
  [25, 2018, 'ds', 'về không phải chịu phạt cọc vì lý do khách quan'],
  [26, 2018, 'ds', 'về xác định thời điểm bắt đầu tính thời hiệu và thời hiệu yêu cầu chia di sản thừa kế là bất động sản'],
  [27, 2019, 'hc', 'về thụ lý, giải quyết vụ án hành chính liên quan đến nhà đất mà Nhà nước đã quản lý, bố trí sử dụng trong quá trình thực hiện các chính sách quản lý nhà đất và chính sách cải tạo xã hội chủ nghĩa trước ngày 01/7/1991'],
  [28, 2019, 'hs', 'về tội “Giết người trong trạng thái tinh thần bị kích động mạnh”', ['125']],
  [29, 2019, 'hs', 'về tài sản bị chiếm đoạt trong tội “Cướp tài sản”', ['168']],
  [30, 2020, 'hs', 'về hành vi cố ý điều khiển phương tiện giao thông chèn lên bị hại sau khi gây tai nạn', ['123']],
  [31, 2020, 'ds', 'về xác định quyền thuê nhà, mua nhà thuộc sở hữu của Nhà nước theo Nghị định số 61/CP ngày 05/7/1994 của Chính phủ là quyền tài sản'],
  [32, 2020, 'ds', 'về trường hợp đất do cá nhân khai phá nhưng sau đó xuất cảnh định cư ở nước ngoài và người khác đã quản lý, sử dụng ổn định, lâu dài'],
  [33, 2020, 'ds', 'về trường hợp cá nhân được Nhà nước giao đất nhưng không sử dụng mà để người khác quản lý, sử dụng ổn định, lâu dài'],
  [34, 2020, 'ds', 'về quyền lập di chúc định đoạt giá trị bồi thường về đất trong trường hợp đất bị Nhà nước thu hồi có bồi thường'],
  [35, 2020, 'ds', 'về người Việt Nam trước khi đi định cư ở nước ngoài giao lại đất nông nghiệp cho người ở trong nước sử dụng'],
  [36, 2020, 'ds', 'về hiệu lực của hợp đồng thế chấp quyền sử dụng đất khi giấy chứng nhận quyền sử dụng đất bị thu hồi, hủy bỏ'],
  [37, 2020, 'kdtm', 'về hiệu lực của hợp đồng bảo hiểm tài sản trong trường hợp bên mua bảo hiểm đóng phí bảo hiểm sau khi kết thúc thời hạn đóng phí bảo hiểm'],
  [38, 2020, 'ds', 'về việc không thụ lý yêu cầu đòi tài sản đã được phân chia bằng bản án có hiệu lực pháp luật'],
  [39, 2020, 'ds', 'về xác định giao dịch dân sự có điều kiện vô hiệu do điều kiện không thể xảy ra'],
  [40, 2021, 'ds', 'về công nhận việc chuyển đổi quyền sử dụng đất trên thực tế'],
  [41, 2021, 'hngd', 'về chấm dứt hôn nhân thực tế'],
  [42, 2021, 'ds', 'về quyền lựa chọn Tòa án giải quyết tranh chấp của người tiêu dùng trong trường hợp hợp đồng theo mẫu có thỏa thuận trọng tài'],
  [43, 2021, 'ds', 'về hiệu lực của hợp đồng thế chấp trong trường hợp tài sản thế chấp là nhà đất do bên thế chấp nhận chuyển nhượng của người khác nhưng chưa thanh toán đủ tiền cho bên chuyển nhượng'],
  [44, 2021, 'ds', 'về việc xác định thời hiệu khởi kiện đối với yêu cầu phản tố'],
  [45, 2021, 'hs', 'về xác định bị cáo phạm tội “Giết người” thuộc trường hợp “Phạm tội chưa đạt”', ['123', '15']],
  [46, 2021, 'hs', 'về việc xác định tình tiết định khung hình phạt “Đối với trẻ em mà người phạm tội có trách nhiệm giáo dục” trong tội “Dâm ô đối với trẻ em”', ['146']],
  [47, 2021, 'hs', 'về việc xác định tội danh trong trường hợp bị cáo dùng hung khí nguy hiểm đâm vào vùng trọng yếu của cơ thể bị hại', ['123', '134']],
  [48, 2021, 'hs', 'về tình tiết giảm nhẹ trách nhiệm hình sự “nộp lại tiền thu lợi bất chính”', ['51']],
  [49, 2021, 'hc', 'về xác định quyết định hành chính ban hành không đúng thẩm quyền'],
  [50, 2021, 'ds', 'về quyền khởi kiện vụ án đòi lại tài sản của người được giao tài sản theo bản án, quyết định có hiệu lực pháp luật'],
  [51, 2021, 'ds', 'về xác định quyền sở hữu đối với khu vực để xe ô tô của nhà chung cư'],
  [52, 2021, 'ds', 'về hiệu lực của hợp đồng tặng cho quyền sử dụng đất khi chưa đăng ký quyền sử dụng đất'],
  [53, 2022, 'hngd', 'về việc hủy việc kết hôn trái pháp luật'],
  [54, 2022, 'hngd', 'về xác định quyền nuôi con dưới 36 tháng tuổi trong trường hợp người mẹ không trực tiếp chăm sóc, nuôi dưỡng, giáo dục con'],
  [55, 2022, 'ds', 'về công nhận hiệu lực của hợp đồng vi phạm điều kiện về hình thức'],
  [56, 2022, 'ds', 'về việc giải quyết tranh chấp di dời mồ mả'],
  [57, 2023, 'hs', 'về hành vi gian dối nhằm tiếp cận tài sản trong tội “Cướp giật tài sản”', ['171']],
  [58, 2023, 'hs', 'về tình tiết định khung hình phạt quy định tại điểm c khoản 3 Điều 244 của Bộ luật Hình sự', ['244']],
  [59, 2023, 'hs', 'về lỗi cố ý gián tiếp trong vụ án “Giết người”', ['123']],
  [60, 2023, 'ds', 'về thời hạn trả thưởng xổ số kiến thiết'],
  [61, 2023, 'hngd', 'về chấm dứt việc nuôi con nuôi khi con nuôi chưa thành niên'],
  [62, 2023, 'hngd', 'về thời điểm bắt đầu thực hiện nghĩa vụ cấp dưỡng cho con chưa thành niên trong vụ án tranh chấp về xác định cha cho con'],
  [63, 2023, 'hc', 'về xem xét quyết định hành chính có liên quan đến hành vi hành chính bị khiếu kiện'],
  [64, 2023, 'hs', 'về định khung hình phạt và tình tiết định khung tăng nặng “Có tổ chức” trong tội “Bắt cóc nhằm chiếm đoạt tài sản”', ['169']],
  [65, 2023, 'hs', 'về truy cứu trách nhiệm hình sự tội “Mua bán người”', ['150']],
  [66, 2023, 'hs', 'về việc xác định tội danh “Mua bán người”', ['150']],
  [67, 2023, 'ds', 'về người được nhận hiện vật khi chia tài sản chung'],
  [68, 2023, 'ds', 'về quyền nhận di sản bằng hiện vật là nhà ở của người thừa kế là người Việt Nam định cư ở nước ngoài'],
  [69, 2023, 'kdtm', 'về thẩm quyền của Trọng tài thương mại trong việc giải quyết tranh chấp thỏa thuận bảo mật thông tin và không cạnh tranh'],
  [70, 2023, 'ld', 'về việc chấm dứt hợp đồng lao động đối với người lao động là cán bộ công đoàn không chuyên trách'],
  [71, 2024, 'ds', 'về việc đình chỉ giải quyết vụ án với lý do sự việc đã được giải quyết bằng quyết định có hiệu lực của cơ quan nhà nước có thẩm quyền và không thuộc thẩm quyền giải quyết của Tòa án'],
  [72, 2024, 'ds', 'về xác định di sản thừa kế là quyền sử dụng đất trong trường hợp di chúc không thể hiện diện tích đất cụ thể'],
  [73, 2025, 'hs', 'về tình tiết tăng nặng trách nhiệm hình sự “Cố tình thực hiện tội phạm đến cùng”', ['52']],
  [74, 2025, 'hs', 'về định tội danh “Trộm cắp tài sản” đối với hành vi chiếm đoạt tài sản của mình đang bị cơ quan có thẩm quyền tạm giữ', ['173']],
  [75, 2025, 'hs', 'về thủ đoạn gian dối để trộm cắp tài sản', ['173', '174']],
  [76, 2025, 'hs', 'về tịch thu sung vào ngân sách nhà nước công cụ, phương tiện dùng vào việc phạm tội chưa sang tên', ['47']],
  [77, 2025, 'kdtm', 'về vi phạm nghĩa vụ cung cấp thông tin về tình trạng bệnh hiểm nghèo của bên mua bảo hiểm'],
  [78, 2025, 'kdtm', 'về xác định mục đích góp vốn vào công ty'],
  [79, 2025, 'ds', 'về chủ thể giao kết hợp đồng đặt cọc và hiệu lực của hợp đồng đặt cọc'],
  [80, 2025, 'hngd', 'về tặng cho vé số của vợ, chồng'],
  [81, 2025, 'ds', 'về xác định tranh chấp dân sự về đòi lại tài sản'],
  [82, 2025, 'hngd', 'về xác định tài sản chung của vợ chồng trước khi đăng ký kết hôn'],
  [83, 2026, 'kdtm', 'về trách nhiệm bồi thường của doanh nghiệp bảo hiểm khi chưa xác định được người gây thiệt hại tài sản'],
  [84, 2026, 'hngd', 'về chấm dứt nuôi con nuôi là người chưa thành niên khi người nhận nuôi độc thân đã chết'],
  [85, 2026, 'kdtm', 'về việc tham gia tố tụng của doanh nghiệp bảo hiểm thành viên theo hợp đồng nguyên tắc đồng bảo hiểm'],
  [86, 2026, 'ds', 'về sự kiện pháp lý làm căn cứ xem xét kháng nghị theo thủ tục tái thẩm'],
  [87, 2026, 'ds', 'về thứ tự ưu tiên thanh toán khi xử lý tài sản bảo đảm'],
  [88, 2026, 'hngd', 'về ủy quyền tham gia tố tụng trong tranh chấp nuôi con'],
  [89, 2026, 'hc', 'về bồi thường, hỗ trợ khi Nhà nước thu hồi đất đối với nhà mua thanh lý để ở trên đất của cơ quan nhà nước'],
  [90, 2026, 'hc', 'về thẩm quyền của Tòa án hủy Giấy chứng nhận quyền sử dụng đất'],
];

const pad = (n) => String(n).padStart(2, '0');
/** Danh mục đầy đủ: { so: '47/2021/AL', num, nam, linhVuc, ten, dieu: [], thongQua, qdCongBo, ngayCongBo, apDung }. */
export const AN_LE = DS.map(([num, nam, linhVuc, ten, dieu = []]) => {
  const d = DOT.find(([a, b]) => num >= a && num <= b) || [];
  return { so: `${pad(num)}/${nam}/AL`, num, nam, linhVuc, ten: `Án lệ số ${pad(num)}/${nam}/AL ${ten}`, tenNgan: ten, dieu, thongQua: d[2] || '', qdCongBo: d[3] || '', ngayCongBo: d[4] || '', apDung: d[5] || '' };
});

/** Cổng án lệ của Tòa án nhân dân tối cao (mở ngoài, tìm theo số án lệ). */
export const AN_LE_PORTAL = 'https://anle.toaan.gov.vn/webcenter/portal/anle/anle';
/** Cổng công bố bản án, quyết định của Tòa án. */
export const BAN_AN_PORTAL = 'https://congbobanan.toaan.gov.vn/';

const normSo = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^(\d{1,2})\//, (_, n) => `${pad(+n)}/`);
/** Tìm án lệ trong danh mục theo số ("47/2021/AL", "Án lệ số 47/2021/AL", "47"). */
export function findAnLe(so) {
  const k = normSo(String(so || '').replace(/^án lệ số\s*/i, ''));
  if (!k) return null;
  if (/^\d+$/.test(k)) return AN_LE.find((a) => a.num === +k) || null;
  return AN_LE.find((a) => a.so === k) || null;
}

/** Án lệ hình sự liên quan đến các điều luật (vd. ['174', '15']) — để gợi ý khi thẩm tra. */
export function anLeForDieu(dieus = []) {
  const set = new Set((dieus || []).map((d) => String(d)));
  if (!set.size) return [];
  return AN_LE.filter((a) => a.dieu.some((d) => set.has(d)));
}

/** Ghép danh mục với toàn văn trong kho (docs loại 'an-le' có trường so): { ...anLe, doc }. */
export function withKho(docs = []) {
  const bySo = new Map();
  for (const d of docs) if (d.loai === 'an-le' && d.so) bySo.set(normSo(d.so), d);
  return AN_LE.map((a) => ({ ...a, doc: bySo.get(a.so) || null }));
}
