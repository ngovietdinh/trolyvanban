// Danh mục án lệ do Hội đồng Thẩm phán Tòa án nhân dân tối cao thông qua (01/2016/AL → 90/2026/AL), sinh từ dữ liệu
// Cổng thông tin điện tử về án lệ (anle.toaan.gov.vn, tháng 10/2026): số, tên, lĩnh vực, ngày thông qua, quyết định
// công bố, ngày công bố, ngày áp dụng; án lệ hình sự ghi điều luật BLHS 2015 liên quan (đọc từ mục "Quy định của pháp
// luật liên quan đến án lệ", có rà tay). TOÀN VĂN nằm ở assets/data/an-le.json (xem an-le-data.js). Khi cổng công bố án lệ
// mới: chạy lại bộ sinh dữ liệu (scripts/an-le/) rồi cập nhật cả hai tệp.
export const LINH_VUC = { hs: 'Hình sự', ds: 'Dân sự', hngd: 'Hôn nhân và gia đình', kdtm: 'Kinh doanh, thương mại', ld: 'Lao động', hc: 'Hành chính' };

/** [số, năm, lĩnh vực, tên (sau chữ "Về"), ngày thông qua, quyết định công bố, ngày công bố, ngày áp dụng, điều BLHS liên quan]. */
const DS = [
  [1, 2016, 'hs', 'Về vụ án “Giết người”', '06/04/2016', '220/QĐ-CA', '06/04/2016', '23/05/2016', ['123', '134']],
  [2, 2016, 'ds', 'Về vụ án “Tranh chấp đòi lại tài sản”', '06/04/2016', '220/QĐ-CA', '06/04/2016', '25/05/2016'],
  [3, 2016, 'hngd', 'Về vụ án “Ly hôn”', '06/04/2016', '220/QĐ-CA', '06/04/2016', '25/05/2016'],
  [4, 2016, 'ds', 'Về vụ án “Tranh chấp hợp đồng chuyển nhượng quyền sử dụng đất”', '06/04/2016', '220/QĐ-CA', '25/05/2016', '25/05/2016'],
  [5, 2016, 'ds', 'Về vụ án “Tranh chấp di sản thừa kế”', '06/04/2016', '220/QĐ-CA', '06/04/2016', '25/05/2016'],
  [6, 2016, 'ds', 'Về vụ án “Tranh chấp thừa kế”', '06/04/2016', '220/QĐ-CA', '06/04/2016', '25/05/2016'],
  [7, 2016, 'ds', 'Công nhận hợp đồng mua bán nhà được xác lập trước ngày 01-7-1991', '10/07/2016', '698/QĐ-CA', '10/07/2016', '01/12/2016'],
  [8, 2016, 'kdtm', 'Về xác định lãi suất, việc điều chỉnh lãi suất trong hợp đồng tín dụng kể từ thời điểm tiếp theo của kỳ hạn thanh toán', '10/07/2016', '698/QĐ-CA', '17/10/2016', '01/12/2016'],
  [9, 2016, 'kdtm', 'Về xác định lãi suất nợ quá hạn trung bình trên thị trường và việc trả lãi trên số tiền phạt vi phạm, bồi thường thiệt hại', '10/07/2016', '698/QĐ-CA', '17/10/2016', '01/12/2016'],
  [10, 2016, 'hc', 'Về quyết định hành chính là đối tượng khởi kiện vụ án hành chính', '10/07/2016', '698/QĐ-CA', '17/10/2016', '17/10/2016'],
  [11, 2017, 'ds', 'Công nhận hợp đồng thế chấp quyền sử dụng đất mà trên đất có tài sản không thuộc sở hữu của bên thế chấp', '14/12/2017', '299/QĐ-CA', '15/02/2018', '15/02/2018'],
  [12, 2017, 'kdtm', 'Xác định trường hợp đương sự được triệu tập hợp lệ lần thứ nhất sau khi Tòa án đã hoãn phiên tòa', '14/12/2017', '299/QĐ-CA', '15/02/2018', '15/02/2018'],
  [13, 2017, 'kdtm', 'Hiệu lực thanh toán của thư tín dụng (L/C) trong trường hợp hợp đồng mua bán hàng hóa quốc tế là cơ sở của L/C bị huỷ bỏ', '14/12/2017', '299/QĐ-CA', '15/02/2018', '15/02/2018'],
  [14, 2017, 'ds', 'Công nhận điều kiện của hợp đồng tặng cho quyền sử dụng đất mà điều kiện đó không được ghi trong hợp đồng', '14/12/2017', '299/QĐ-CA', '15/02/2018', '15/02/2018'],
  [15, 2017, 'ds', 'Công nhận thỏa thuận miệng của các đương sự trong việc chuyển đổi quyền sử dụng đất nông nghiệp', '14/12/2017', '299/QĐ-CA', '15/02/2018', '15/02/2018'],
  [16, 2017, 'ds', 'Công nhận hợp đồng chuyển nhượng quyền sử dụng đất là di sản thừa kế do một trong các đồng thừa kế chuyển nhượng', '14/12/2017', '299/QĐ-CA', '15/02/2018', '15/02/2018'],
  [17, 2018, 'hs', 'Về tình tiết “Có tính chất côn đồ” trong tội “Giết người” có đồng phạm', '17/10/2018', '269/QĐ-CA', '06/11/2018', '03/12/2018', ['123']],
  [18, 2018, 'hs', 'Về hành vi giết người đang thi hành công vụ trong tội “Giết người”', '17/10/2018', '269/QĐ-CA', '06/11/2018', '03/12/2018', ['123']],
  [19, 2018, 'hs', 'Về xác định giá trị tài sản bị chiếm đoạt trong tội “Tham ô tài sản”', '17/10/2018', '269/QĐ-CA', '06/11/2018', '03/12/2018', ['353', '51', '65']],
  [20, 2018, 'ds', 'Về xác lập quan hệ hợp đồng lao động sau khi hết thời gian thử việc', '17/10/2018', '269/QĐ-CA', '06/11/2018', '03/12/2018'],
  [21, 2018, 'kdtm', 'Về lỗi và thiệt hại trong trường hợp đơn phương chấm dứt hợp đồng cho thuê tài sản', '17/10/2018', '269/QĐ-CA', '06/11/2018', '03/12/2018'],
  [22, 2018, 'ld', 'Về không vi phạm nghĩa vụ cung cấp thông tin tình trạng bệnh lý trong hợp đồng bảo hiểm nhân thọ', '17/10/2018', '269/QĐ-CA', '06/11/2018', '03/12/2018'],
  [23, 2018, 'ds', 'Về hiệu lực của hợp đồng bảo hiểm nhân thọ khi bên mua bảo hiểm không đóng phí bảo hiểm do lỗi của doanh nghiệp bảo hiểm', '17/10/2018', '269/QĐ-CA', '06/11/2018', '03/12/2018'],
  [24, 2018, 'ds', 'Về di sản thừa kế chuyển thành tài sản thuộc quyền sở hữu, quyền sử dụng hợp pháp của cá nhân', '17/10/2018', '269/QĐ-CA', '06/11/2018', '03/12/2018'],
  [25, 2018, 'ds', 'Về không phải chịu phạt cọc vì lý do khách quan', '17/10/2018', '269/QĐ-CA', '06/11/2018', '03/12/2018'],
  [26, 2018, 'ds', 'Về xác định thời điểm bắt đầu tính thời hiệu và thời hiệu yêu cầu chia di sản thừa kế là bất động sản', '17/10/2018', '269/QĐ-CA', '06/11/2018', '03/12/2018'],
  [27, 2019, 'hc', 'Về thụ lý, giải quyết vụ án hành chính liên quan đến nhà đất mà Nhà nước đã quản lý, bố trí sử dụng trong quá trình thực hiện chính sách quản lý nhà đất và chính sách cải tạo xã hội chủ nghĩa trước ngày 01-7-1991', '22/08/2019', '293/QĐ-CA', '09/09/2019', '10/10/2019'],
  [28, 2019, 'hs', 'Về tội “Giết người trong trạng thái tinh thần bị kích động mạnh”', '22/08/2019', '293/QĐ-CA', '09/09/2019', '10/10/2019', ['125']],
  [29, 2019, 'hs', 'Về tài sản bị chiếm đoạt trong tội “Cướp tài sản”', '22/08/2019', '293/QĐ-CA', '09/09/2019', '10/10/2019', ['168']],
  [30, 2020, 'hs', 'Về hành vi cố ý điều khiển phương tiện giao thông chèn lên bị hại sau khi xảy ra tai nạn giao thông', '05/02/2020', '50/QĐ-CA', '25/02/2020', '15/04/2020', ['123']],
  [31, 2020, 'ds', 'Về xác định quyền thuê nhà, mua nhà thuộc sở hữu của Nhà nước theo Nghị định số 61/CP ngày 05-7-1994 của Chính phủ là quyền tài sản', '05/02/2020', '50/QĐ-CA', '25/02/2020', '15/04/2020'],
  [32, 2020, 'ds', 'Về trường hợp đất do cá nhân khai phá nhưng sau đó xuất cảnh định cư ở nước ngoài và người khác đã quản lý, sử dụng ổn định, lâu dài', '05/02/2020', '50/QĐ-CA', '25/02/2020', '15/04/2020'],
  [33, 2020, 'ds', 'Về trường hợp cá nhân được Nhà nước giao đất nhưng không sử dụng mà để người khác quản lý, sử dụng ổn định, lâu dài', '05/02/2020', '50/QĐ-CA', '25/02/2020', '15/04/2020'],
  [34, 2020, 'ds', 'Về quyền lập di chúc định đoạt giá trị bồi thường về đất trong trường hợp đất bị Nhà nước thu hồi có bồi thường', '05/02/2020', '50/QĐ-CA', '25/02/2020', '15/04/2020'],
  [35, 2020, 'ds', 'Về người Việt Nam trước khi đi định cư ở nước ngoài giao lại đất nông nghiệp cho người ở trong nước sử dụng', '05/02/2020', '50/QĐ-CA', '25/02/2020', '15/04/2020'],
  [36, 2020, 'kdtm', 'Về hiệu lực của hợp đồng thế chấp quyền sử dụng đất khi giấy chứng nhận quyền sử dụng đất bị thu hồi, hủy bỏ', '05/02/2020', '50/QĐ-CA', '25/02/2020', '15/04/2020'],
  [37, 2020, 'kdtm', 'Về hiệu lực của hợp đồng bảo hiểm tài sản trong trường hợp bên mua bảo hiểm đóng phí bảo hiểm sau khi kết thúc thời hạn đóng phí bảo hiểm', '05/02/2020', '50/QĐ-CA', '25/02/2020', '15/04/2020'],
  [38, 2020, 'ds', 'Về việc không thụ lý yêu cầu đòi tài sản đã được phân chia bằng bản án có hiệu lực pháp luật', '13/08/2020', '276/QĐ-CA', '02/10/2020', '15/11/2020'],
  [39, 2020, 'ds', 'Về xác định giao dịch dân sự có điều kiện vô hiệu do điều kiện không thể xảy ra', '13/08/2020', '276/QĐ-CA', '02/10/2020', '15/11/2020'],
  [40, 2021, 'ds', 'Về công nhận việc chuyển đổi quyền sử dụng đất trên thực tế', '23/02/2021', '42/QĐ-CA', '12/03/2021', '15/04/2021'],
  [41, 2021, 'ds', 'Về chấm dứt hôn nhân thực tế', '23/02/2021', '42/QĐ-CA', '12/03/2021', '15/04/2021'],
  [42, 2021, 'ds', 'Về quyền lựa chọn Tòa án giải quyết tranh chấp của người tiêu dùng trong trường hợp hợp đồng theo mẫu có thỏa thuận trọng tài', '24/02/2021', '42/QĐ-CA', '12/03/2021', '15/04/2021'],
  [43, 2021, 'kdtm', 'Về hiệu lực của hợp đồng thế chấp trong trường hợp tài sản thế chấp là nhà đất do bên thế chấp nhận chuyển nhượng của người khác nhưng chưa thanh toán đủ tiền cho bên bán', '24/02/2021', '42/QĐ-CA', '12/03/2021', '15/04/2021'],
  [44, 2021, 'kdtm', 'Về việc xác định thời hiệu khởi kiện đối với yêu cầu phản tố', '25/11/2021', '594/QĐ-CA', '31/12/2021', '31/12/2021'],
  [45, 2021, 'hs', 'Về xác định bị cáo phạm tội “Giết người” thuộc trường hợp “Phạm tội chưa đạt”', '25/11/2021', '594/QĐ-CA', '31/12/2021', '31/12/2021', ['123', '15']],
  [46, 2021, 'hs', 'Về việc xác định tình tiết định khung hình phạt “Đối với trẻ em mà người phạm tội có trách nhiệm giáo dục” trong tội “Dâm ô đối với trẻ em”', '25/11/2021', '594/QĐ-CA', '31/12/2021', '31/12/2021', ['146']],
  [47, 2021, 'hs', 'Về việc xác định tội danh trong trường hợp bị cáo dùng hung khí nguy hiểm đâm vào vùng trọng yếu của cơ thể bị hại', '25/11/2021', '594/QĐ-CA', '31/12/2021', '31/12/2021', ['123', '134']],
  [48, 2021, 'hs', 'Về tình tiết giảm nhẹ trách nhiệm hình sự “nộp lại tiền thu lợi bất chính”', '25/11/2021', '594/QĐ-CA', '31/12/2021', '31/12/2021', ['51']],
  [49, 2021, 'hc', 'Về xác định quyết định hành chính ban hành không đúng thẩm quyền', '25/11/2021', '594/QĐ-CA', '31/12/2021', '31/12/2021'],
  [50, 2021, 'ds', 'Về quyền khởi kiện vụ án đòi lại tài sản của người được giao tài sản theo bản án, quyết định có hiệu lực pháp luật', '25/11/2021', '594/QĐ-CA', '31/12/2021', '31/12/2021'],
  [51, 2021, 'ds', 'Về xác định quyền sở hữu đối với khu vực để xe ô tô của nhà chung cư', '25/11/2021', '594/QĐ-CA', '31/12/2021', '31/12/2021'],
  [52, 2021, 'ds', 'Về hiệu lực của hợp đồng tặng cho quyền sử dụng đất khi chưa đăng ký quyền sử dụng đất', '25/11/2021', '594/QĐ-CA', '31/12/2021', '31/12/2021'],
  [53, 2022, 'hngd', 'Về việc hủy kết hôn trái pháp luật', '07/09/2022', '323/QĐ-CA', '14/10/2022', '14/10/2022'],
  [54, 2022, 'hngd', 'Về xác định quyền nuôi con dưới 36 tháng tuổi trong trường hợp người mẹ không trực tiếp chăm sóc, nuôi dưỡng, giáo dục con', '07/09/2022', '323/QĐ-CA', '14/10/2022', '14/10/2022'],
  [55, 2022, 'ds', 'Về công nhận hiệu lực của hợp đồng vi phạm điều kiện về hình thức', '07/09/2022', '323/QĐ-CA', '14/10/2022', '14/10/2022'],
  [56, 2022, 'ds', 'Về việc giải quyết tranh chấp di dời mồ mả', '07/09/2022', '323/QĐ-CA', '14/10/2022', '14/10/2022'],
  [57, 2023, 'hs', 'Về hành vi gian dối nhằm tiếp cận tài sản trong tội “Cướp giật tài sản”', '01/02/2023', '39/QĐ-CA', '24/02/2023', '27/03/2023', ['171']],
  [58, 2023, 'hs', 'Về tình tiết định khung hình phạt tại điểm c khoản 3 Điều 244 của Bộ luật Hình sự', '01/02/2023', '39/QĐ-CA', '24/02/2023', '27/03/2023', ['244']],
  [59, 2023, 'hs', 'Về lỗi cố ý gián tiếp trong vụ án “Giết người”', '01/02/2023', '39/QĐ-CA', '24/02/2023', '27/03/2023', ['123']],
  [60, 2023, 'ds', 'Về thời hạn trả thưởng xổ số kiến thiết', '01/02/2023', '39/QĐ-CA', '24/02/2023', '27/03/2023'],
  [61, 2023, 'hngd', 'Về chấm dứt việc nuôi con nuôi khi con nuôi chưa thành niên', '01/02/2023', '39/QĐ-CA', '24/02/2023', '27/03/2023'],
  [62, 2023, 'hngd', 'Về thời điểm bắt đầu thực hiện nghĩa vụ cấp dưỡng cho con chưa thành niên trong vụ án tranh chấp về xác định cha cho con', '01/02/2023', '39/QĐ-CA', '24/02/2023', '27/03/2023'],
  [63, 2023, 'hc', 'Về xem xét quyết định hành chính có liên quan đến hành vi hành chính bị khiếu kiện', '01/02/2023', '39/QĐ-CA', '24/02/2023', '27/03/2023'],
  [64, 2023, 'hs', 'Về định khung hình phạt và tình tiết định khung tăng nặng “có tổ chức” trong tội “Bắt cóc nhằm chiếm đoạt tài sản”', '18/08/2023', '364/QĐ-CA', '01/10/2023', '01/11/2023', ['169']],
  [65, 2023, 'hs', 'Về truy cứu trách nhiệm hình sự tội “Mua bán người”', '18/08/2023', '364/QĐ-CA', '01/10/2023', '01/11/2023', ['150', '151']],
  [66, 2023, 'hs', 'Về việc xác định tội danh “Mua bán người”', '18/08/2023', '364/QĐ-CA', '01/10/2023', '01/11/2023', ['150']],
  [67, 2023, 'ds', 'Về người được nhận hiện vật khi chia tài sản chung', '18/08/2023', '364/QĐ-CA', '01/10/2023', '01/11/2023'],
  [68, 2023, 'ds', 'Về quyền nhận di sản bằng hiện vật là nhà ở của người thừa kế là người Việt Nam định cư ở nước ngoài', '18/08/2023', '364/QĐ-CA', '01/10/2023', '01/11/2023'],
  [69, 2023, 'ds', 'Về thẩm quyền của Trọng tài thương mại trong việc giải quyết tranh chấp thỏa thuận bảo mật thông tin và không cạnh tranh', '18/08/2023', '364/QĐ-CA', '01/10/2023', '01/11/2023'],
  [70, 2023, 'ld', 'Về việc chấm dứt hợp đồng lao động đối với người lao động là cán bộ công đoàn không chuyên trách', '18/08/2023', '364/QĐ-CA', '01/10/2023', '01/11/2023'],
  [71, 2024, 'ds', 'Về việc đình chỉ giải quyết vụ án với lý do sự việc đã được giải quyết bằng quyết định có hiệu lực của cơ quan nhà nước có thẩm quyền và không thuộc thẩm quyền giải quyết của Tòa án', '20/02/2024', '119A/QĐ-CA', '15/05/2024', '15/06/2024'],
  [72, 2024, 'ds', 'Về xác định di sản thừa kế là quyền sử dụng đất trong trường hợp di chúc không thể hiện diện tích đất cụ thể', '20/02/2024', '119A/QĐ-CA', '15/05/2024', '15/06/2024'],
  [73, 2025, 'hs', 'Về việc áp dụng tình tiết tăng nặng trách nhiệm hình sự “Cố tình thực hiện tội phạm đến cùng”', '24/12/2025', '339a/QĐ-CA', '25/12/2025', '01/02/2026', ['52', '123']],
  [74, 2025, 'hs', 'Về việc định tội danh “Trộm cắp tài sản” đối với hành vi chiếm đoạt tài sản của mình đang bị cơ quan có thẩm quyền tạm giữ', '24/12/2025', '339a/QĐ-CA', '25/12/2025', '01/02/2026', ['173']],
  [75, 2025, 'hs', 'Về thủ đoạn gian dối để trộm cắp tài sản', '24/12/2025', '339a/QĐ-CA', '25/12/2025', '01/02/2026', ['173', '174']],
  [76, 2025, 'hs', 'Về việc tịch thu sung vào ngân sách Nhà nước công cụ, phương tiện dùng vào việc phạm tội chưa sang tên', '24/12/2025', '339a/QĐ-CA', '25/12/2025', '01/02/2026', ['47']],
  [77, 2025, 'ds', 'Về việc vi phạm nghĩa vụ cung cấp thông tin tình trạng bệnh hiểm nghèo của bên mua bảo hiểm', '24/12/2025', '339a/QĐ-CA', '25/12/2025', '01/02/2026'],
  [78, 2025, 'kdtm', 'Về xác định mục đích góp vốn vào công ty', '24/12/2025', '339a/QĐ-CA', '25/12/2025', '01/02/2026'],
  [79, 2025, 'ds', 'Về chủ thể giao kết hợp đồng đặt cọc và hiệu lực của hợp đồng đặt cọc', '24/12/2025', '339a/QĐ-CA', '25/12/2025', '01/02/2026'],
  [80, 2025, 'ds', 'Về việc tặng cho vé số của vợ, chồng', '24/12/2025', '339a/QĐ-CA', '25/12/2025', '01/02/2026'],
  [81, 2025, 'kdtm', 'Về xác định tranh chấp dân sự về đòi lại tài sản', '24/12/2025', '339a/QĐ-CA', '25/12/2025', '01/02/2026'],
  [82, 2025, 'hngd', 'Về xác định tài sản chung của vợ chồng trước khi đăng ký kết hôn', '24/12/2025', '339a/QĐ-CA', '25/12/2025', '01/02/2026'],
  [83, 2026, 'ds', 'Về trách nhiệm bồi thường của doanh nghiệp bảo hiểm khi cơ quan cso thẩm quyền chưa xác định được người gây ra thiệt hại về tài sản', '21/05/2026', '162/QĐ-CA', '29/05/2026', '01/07/2026'],
  [84, 2026, 'ds', 'Về chấm dứt việc nuôi con nuôi là người chưa thành niên khi người nhận con nuôi là người độc thân chết', '21/05/2026', '162/QĐ-CA', '29/05/2026', '01/07/2026'],
  [85, 2026, 'ds', 'Về việc tham gia tố tụng của doanh nghiệp bảo hiểm thành viên theo hợp đồng nguyên tắc đồng bảo hiểm', '21/05/2026', '162/QĐ-CA', '29/05/2026', '01/07/2026'],
  [86, 2026, 'kdtm', 'Về sự kiện pháp lý làm phát sinh căn cứ để xem xét kháng nghị theo thủ tục tái thẩm', '21/05/2026', '162/QĐ-CA', '29/05/2026', '01/07/2026'],
  [87, 2026, 'kdtm', 'Về thứ tự ưu tiên thanh toán khi xử lý tài sản bảo đảm', '21/05/2026', '162/QĐ-CA', '29/05/2026', '01/07/2026'],
  [88, 2026, 'hngd', 'Về ủy quyền tham gia tố tụng trong vụ án tranh chấp về nuôi con', '21/05/2026', '162/QĐ-CA', '29/05/2026', '01/07/2026'],
  [89, 2026, 'hc', 'Về việc bồi thường, hỗ trợ khi nhà nước thu hồi đất đối với tài sản là nhà mua thanh lý để ở trên đất của cơ quan nhà nước', '21/05/2026', '162/QĐ-CA', '29/05/2026', '01/07/2026'],
  [90, 2026, 'hc', 'Về thẩm quyền hủy giấy chứng nhận quyền sử dụng đất của Tòa án', '21/05/2026', '162/QĐ-CA', '29/05/2026', '01/07/2026'],
];

const pad = (n) => String(n).padStart(2, '0');
/** Danh mục đầy đủ: { so: '47/2021/AL', num, nam, linhVuc, ten, dieu: [], thongQua, qdCongBo, ngayCongBo, apDung }. */
export const AN_LE = DS.map(([num, nam, linhVuc, ten, thongQua, qdCongBo, ngayCongBo, apDung, dieu = []]) => ({
  so: `${pad(num)}/${nam}/AL`,
  num,
  nam,
  linhVuc,
  ten: `Án lệ số ${pad(num)}/${nam}/AL ${ten[0].toLowerCase()}${ten.slice(1)}`,
  tenNgan: ten,
  dieu,
  thongQua,
  qdCongBo,
  ngayCongBo,
  apDung,
}));

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
