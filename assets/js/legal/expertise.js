// Kho tri thức chuyên môn: câu hỏi nghiệp vụ của chuyên gia từng lĩnh vực, tài liệu cần thu thập
// và loại giám định/định giá thường dùng. Được ghép với dữ liệu điều luật để sinh bộ câu hỏi.

export const EXPERTISE = {
  'tai-chinh': {
    ten: 'Tài chính – kế toán',
    cauHoi: [
      'Quy trình đề xuất, phê duyệt, chi tiền đối với khoản chi này gồm những bước nào; ai ký duyệt ở từng bước?',
      'Chứng từ kế toán (phiếu chi, ủy nhiệm chi, hóa đơn, biên bản nghiệm thu) do ai lập, ai kiểm soát, ai ký?',
      'Khoản tiền được hạch toán vào tài khoản nào, có phản ánh trên sổ kế toán và báo cáo tài chính không?',
      'Có việc lập chứng từ khống, chứng từ không có nghiệp vụ kinh tế phát sinh thực tế không?',
      'Dòng tiền sau khi chi ra được chuyển đến tài khoản nào, ai là người thụ hưởng cuối cùng?',
      'Kế toán trưởng có ý kiến phản đối hoặc cảnh báo bằng văn bản về khoản chi này không?',
    ],
    taiLieu: ['Sổ kế toán, báo cáo tài chính các năm liên quan', 'Chứng từ thu, chi, ủy nhiệm chi', 'Sao kê tài khoản ngân hàng của đơn vị và cá nhân liên quan', 'Quy chế chi tiêu nội bộ, quy chế tài chính'],
    giamDinh: ['Giám định tư pháp về tài chính – kế toán', 'Kiểm toán, thanh tra (nếu có kết luận)'],
  },
  'dau-thau': {
    ten: 'Đấu thầu – lựa chọn nhà thầu',
    cauHoi: [
      'Kế hoạch lựa chọn nhà thầu do ai lập, ai thẩm định, ai phê duyệt; hình thức lựa chọn nhà thầu được áp dụng là gì?',
      'Căn cứ xác định giá gói thầu (dự toán, báo giá, thẩm định giá) là gì; báo giá do đơn vị nào cung cấp?',
      'Hồ sơ mời thầu có tiêu chí nào mang tính hạn chế, định hướng nhà thầu (thương hiệu, xuất xứ, kinh nghiệm “may đo”) không?',
      'Tổ chuyên gia gồm những ai, có chứng chỉ hành nghề đấu thầu không; ai đánh giá phần nào của hồ sơ dự thầu?',
      'Các nhà thầu tham dự có quan hệ sở hữu, nhân sự, địa chỉ, IP nộp thầu, người lập hồ sơ trùng nhau không?',
      'Giá trúng thầu so với giá gói thầu và giá thị trường tại thời điểm đó chênh lệch bao nhiêu?',
      'Có hiện tượng nhà thầu “quân xanh, quân đỏ”, rút thầu, bỏ giá cao bất thường để nhà thầu khác trúng không?',
      'Hợp đồng ký kết có phù hợp với hồ sơ mời thầu, hồ sơ dự thầu; có điều chỉnh, phát sinh sau trúng thầu không?',
    ],
    taiLieu: ['Kế hoạch lựa chọn nhà thầu và quyết định phê duyệt', 'Hồ sơ mời thầu, hồ sơ dự thầu, báo cáo đánh giá, báo cáo thẩm định', 'Dữ liệu trên Hệ thống mạng đấu thầu quốc gia (nhật ký, địa chỉ IP)', 'Chứng thư thẩm định giá, báo giá đầu vào', 'Hợp đồng, phụ lục, biên bản nghiệm thu, thanh quyết toán'],
    giamDinh: ['Định giá tài sản/thẩm định giá hàng hóa tại thời điểm mua sắm', 'Giám định tài chính về thiệt hại', 'Giám định kỹ thuật số dữ liệu đấu thầu qua mạng'],
  },
  'xay-dung': {
    ten: 'Kỹ thuật – xây dựng',
    cauHoi: [
      'Thiết kế, dự toán được thẩm định, phê duyệt bởi ai; có điều chỉnh thiết kế trong quá trình thi công không?',
      'Khối lượng, chủng loại vật liệu thực tế thi công so với hồ sơ thiết kế và hồ sơ nghiệm thu có sai khác không?',
      'Ai trực tiếp giám sát thi công; nhật ký thi công, nhật ký giám sát ghi nhận những gì ở các hạng mục này?',
      'Biên bản nghiệm thu được lập khi nào, có kiểm tra thực tế hiện trường không, ai ký?',
      'Công trình có xảy ra sự cố, hư hỏng, xuống cấp; nguyên nhân kỹ thuật được xác định như thế nào?',
      'Đơn vị tư vấn (thiết kế, giám sát, thẩm tra) có đủ năng lực, chứng chỉ theo quy định không?',
    ],
    taiLieu: ['Hồ sơ thiết kế, dự toán, quyết định phê duyệt', 'Nhật ký thi công, nhật ký giám sát', 'Biên bản nghiệm thu, bản vẽ hoàn công', 'Kết quả thí nghiệm vật liệu, kiểm định chất lượng'],
    giamDinh: ['Giám định tư pháp xây dựng (khối lượng, chất lượng, nguyên nhân sự cố)', 'Kiểm định chất lượng công trình'],
  },
  'ngan-hang': {
    ten: 'Ngân hàng – tín dụng',
    cauHoi: [
      'Hồ sơ đề nghị vay vốn gồm những tài liệu gì; ai thẩm định khách hàng, phương án sử dụng vốn và tài sản bảo đảm?',
      'Tài sản bảo đảm được định giá bởi ai, giá trị định giá so với giá trị thực tế chênh lệch thế nào?',
      'Khoản vay có được phê duyệt vượt thẩm quyền, cho vay không có bảo đảm hoặc bảo đảm không đủ theo quy định không?',
      'Vốn vay được giải ngân vào tài khoản nào, có sử dụng đúng mục đích ghi trong hợp đồng tín dụng không?',
      'Việc kiểm tra, giám sát sau cho vay được thực hiện thế nào; khi phát sinh nợ quá hạn đã xử lý ra sao?',
      'Có quan hệ thân quen, lợi ích giữa cán bộ tín dụng/lãnh đạo ngân hàng với khách hàng vay không?',
    ],
    taiLieu: ['Hồ sơ tín dụng đầy đủ', 'Biên bản họp Hội đồng tín dụng', 'Chứng thư định giá tài sản bảo đảm', 'Sao kê giải ngân và dòng tiền sau giải ngân', 'Quy chế cho vay nội bộ'],
    giamDinh: ['Giám định ngân hàng về vi phạm quy định cho vay', 'Định giá lại tài sản bảo đảm', 'Giám định thiệt hại (dư nợ gốc, lãi không có khả năng thu hồi)'],
  },
  'thue-hoa-don': {
    ten: 'Thuế – hóa đơn',
    cauHoi: [
      'Doanh nghiệp kê khai thuế theo phương pháp nào; ai trực tiếp lập và ký tờ khai thuế các kỳ liên quan?',
      'Doanh thu, chi phí kê khai có khớp với hợp đồng, hóa đơn, dòng tiền thực tế không?',
      'Hóa đơn đầu vào được mua từ đâu, có giao dịch hàng hóa, dịch vụ thực tế kèm theo không?',
      'Hàng hóa ghi trên hóa đơn được vận chuyển, giao nhận, lưu kho như thế nào; có chứng từ vận chuyển không?',
      'Việc thanh toán qua ngân hàng có quay vòng tiền trở lại người mua/người bán hóa đơn không?',
      'Doanh nghiệp có đang hoạt động tại địa chỉ đăng ký, có người lao động, kho bãi thực tế không?',
    ],
    taiLieu: ['Tờ khai thuế, báo cáo tình hình sử dụng hóa đơn', 'Dữ liệu hóa đơn điện tử từ cơ quan thuế', 'Hợp đồng kinh tế, chứng từ vận chuyển, phiếu nhập/xuất kho', 'Sao kê tài khoản các doanh nghiệp liên quan'],
    giamDinh: ['Giám định về số thuế trốn/thiệt hại ngân sách', 'Xác minh tại cơ quan thuế quản lý'],
  },
  'hai-quan': {
    ten: 'Hải quan – xuất nhập khẩu',
    cauHoi: [
      'Hàng hóa được khai báo về tên hàng, mã HS, số lượng, trị giá, xuất xứ như thế nào; ai lập tờ khai?',
      'Hàng hóa đi qua cửa khẩu nào, phương tiện, tuyến đường, thời gian vận chuyển?',
      'Có sử dụng hóa đơn, chứng từ thương mại giả, khai sai tên hàng, chủng loại để trốn thuế hoặc né kiểm tra chuyên ngành không?',
      'Ai là chủ hàng thực sự, ai thuê vận chuyển, giá thuê và phương thức thanh toán?',
      'Hàng hóa thuộc danh mục cấm xuất, nhập khẩu, tạm ngừng hoặc phải có giấy phép không?',
    ],
    taiLieu: ['Tờ khai hải quan, bộ chứng từ thương mại (invoice, packing list, B/L, C/O)', 'Hình ảnh soi chiếu, biên bản kiểm hóa', 'Dữ liệu xuất nhập cảnh của phương tiện, người điều khiển'],
    giamDinh: ['Giám định chủng loại, xuất xứ hàng hóa', 'Định giá hàng hóa vi phạm'],
  },
  'dat-dai': {
    ten: 'Đất đai – quy hoạch',
    cauHoi: [
      'Thửa đất có nguồn gốc sử dụng như thế nào; hiện trạng và mục đích sử dụng theo hồ sơ địa chính?',
      'Việc giao đất, cho thuê đất, chuyển mục đích, cấp giấy chứng nhận có phù hợp quy hoạch, kế hoạch sử dụng đất không?',
      'Hồ sơ được ai tiếp nhận, thẩm định, trình ký; có bỏ qua bước xác minh nguồn gốc, niêm yết công khai không?',
      'Giá đất áp dụng (thu tiền sử dụng đất, bồi thường) được xác định như thế nào; có thấp hơn giá thị trường không?',
      'Người được hưởng lợi từ quyết định giao đất/cấp giấy có quan hệ gì với người có thẩm quyền?',
    ],
    taiLieu: ['Hồ sơ địa chính, bản đồ, sổ mục kê', 'Hồ sơ giao đất, cho thuê đất, cấp giấy chứng nhận', 'Quy hoạch, kế hoạch sử dụng đất được duyệt', 'Phương án bồi thường, hỗ trợ, tái định cư'],
    giamDinh: ['Định giá quyền sử dụng đất', 'Đo đạc, trích lục hiện trạng'],
  },
  'moi-truong': {
    ten: 'Kỹ thuật môi trường',
    cauHoi: [
      'Cơ sở có giấy phép môi trường/báo cáo đánh giá tác động môi trường được phê duyệt không; công suất xử lý thiết kế là bao nhiêu?',
      'Chất thải phát sinh gồm những loại nào, khối lượng bao nhiêu mỗi ngày; hệ thống xử lý vận hành ra sao?',
      'Có đường ống, cửa xả bí mật, xả thải không qua hệ thống xử lý hoặc pha loãng chất thải không?',
      'Kết quả quan trắc tự động, quan trắc định kỳ ghi nhận các thông số vượt quy chuẩn bao nhiêu lần?',
      'Chất thải nguy hại được chuyển giao cho đơn vị nào, có chứng từ chất thải nguy hại và giấy phép xử lý không?',
      'Việc xả thải đã gây thiệt hại gì cho môi trường, sức khỏe người dân, sản xuất (thủy sản, cây trồng)?',
    ],
    taiLieu: ['Giấy phép môi trường, ĐTM, kế hoạch bảo vệ môi trường', 'Kết quả quan trắc, lấy mẫu phân tích có niêm phong', 'Sổ nhật ký vận hành hệ thống xử lý', 'Chứng từ chuyển giao chất thải nguy hại'],
    giamDinh: ['Giám định mẫu chất thải, môi trường nền', 'Xác định thiệt hại do suy giảm chức năng, tính hữu ích của môi trường'],
  },
  'rung-sinh-vat': {
    ten: 'Lâm nghiệp – đa dạng sinh học',
    cauHoi: [
      'Diện tích, vị trí, loại rừng (đặc dụng, phòng hộ, sản xuất) bị tác động; tọa độ, tiểu khu, khoảnh, lô?',
      'Lâm sản/động vật thuộc loài nào, nhóm nào trong danh mục loài nguy cấp, quý, hiếm; khối lượng, số lượng?',
      'Ai tổ chức khai thác/săn bắt, ai thuê, ai thu mua, tiêu thụ; giá mua bán và phương thức thanh toán?',
      'Lực lượng kiểm lâm, chủ rừng đã kiểm tra, phát hiện, xử lý như thế nào trước đó?',
      'Phương tiện, công cụ sử dụng (cưa xăng, súng, bẫy, xe vận chuyển) thuộc sở hữu của ai?',
    ],
    taiLieu: ['Biên bản hiện trường, sơ đồ, tọa độ GPS, ảnh vệ tinh', 'Hồ sơ quản lý rừng, bản đồ hiện trạng rừng', 'Bảng kê lâm sản, hồ sơ nguồn gốc'],
    giamDinh: ['Giám định loài động vật, thực vật', 'Xác định thiệt hại rừng, giá trị lâm sản'],
  },
  'y-duoc': {
    ten: 'Y tế – dược phẩm',
    cauHoi: [
      'Người thực hiện có chứng chỉ hành nghề, phạm vi hoạt động chuyên môn phù hợp với kỹ thuật đã làm không?',
      'Cơ sở có giấy phép hoạt động; kỹ thuật thực hiện có nằm trong danh mục được phê duyệt không?',
      'Diễn biến khám, chẩn đoán, chỉ định, điều trị được ghi nhận thế nào trong hồ sơ bệnh án; có sửa chữa hồ sơ không?',
      'Quy trình chuyên môn, phác đồ điều trị áp dụng là gì; có vi phạm quy chế chuyên môn nào không?',
      'Thuốc, vật tư sử dụng có nguồn gốc, số lô, hạn dùng, hóa đơn mua vào hợp lệ không?',
      'Hội đồng chuyên môn đã họp, kết luận nguyên nhân tai biến/tử vong như thế nào?',
    ],
    taiLieu: ['Hồ sơ bệnh án, sổ y lệnh, phiếu chăm sóc', 'Chứng chỉ hành nghề, giấy phép hoạt động', 'Biên bản hội đồng chuyên môn', 'Hồ sơ nhập, xuất thuốc; mẫu thuốc có niêm phong'],
    giamDinh: ['Giám định pháp y (nguyên nhân chết, tỷ lệ tổn thương cơ thể)', 'Giám định chất lượng thuốc, kiểm nghiệm mẫu', 'Hội đồng chuyên môn của Bộ/Sở Y tế'],
  },
  'thuc-pham': {
    ten: 'An toàn thực phẩm',
    cauHoi: [
      'Nguyên liệu, phụ gia sử dụng mua từ đâu, có hóa đơn, công bố sản phẩm và nằm trong danh mục được phép không?',
      'Quy trình sản xuất, chế biến, bảo quản thực hiện ra sao; ai chịu trách nhiệm kiểm soát chất lượng?',
      'Sản phẩm đã tiêu thụ ở đâu, số lượng bao nhiêu, ai là đầu mối phân phối?',
      'Có người bị ngộ độc, bệnh lý sau khi sử dụng không; mối liên quan được cơ quan y tế xác định thế nào?',
    ],
    taiLieu: ['Giấy chứng nhận cơ sở đủ điều kiện ATTP, hồ sơ công bố sản phẩm', 'Mẫu sản phẩm, kết quả kiểm nghiệm', 'Hồ sơ điều tra ngộ độc thực phẩm của cơ quan y tế'],
    giamDinh: ['Kiểm nghiệm mẫu thực phẩm, phụ gia, chất cấm', 'Giám định pháp y đối với người bị hại'],
  },
  'chung-khoan-bao-hiem': {
    ten: 'Chứng khoán – bảo hiểm',
    cauHoi: [
      'Các tài khoản giao dịch nào được sử dụng, ai là chủ tài khoản danh nghĩa và ai thực tế điều khiển?',
      'Lệnh đặt mua/bán được thực hiện từ thiết bị, địa chỉ IP nào; có giao dịch cùng thời điểm, cùng giá giữa các tài khoản liên quan không?',
      'Thông tin công bố (báo cáo tài chính, nghị quyết, bản cáo bạch) có nội dung sai lệch hay che giấu gì; ai soạn, ai duyệt?',
      'Hồ sơ bảo hiểm/bồi thường được lập dựa trên sự kiện thực tế nào; có chứng từ y tế, hóa đơn giả không?',
    ],
    taiLieu: ['Dữ liệu giao dịch từ Sở giao dịch, Trung tâm lưu ký', 'Hồ sơ mở tài khoản, ủy quyền giao dịch', 'Tài liệu công bố thông tin', 'Hồ sơ yêu cầu bồi thường bảo hiểm'],
    giamDinh: ['Phân tích dữ liệu giao dịch của UBCKNN', 'Giám định tài chính về khoản thu lợi bất chính'],
  },
  'so-huu-tri-tue': {
    ten: 'Sở hữu trí tuệ – hàng giả',
    cauHoi: [
      'Sản phẩm/nhãn hiệu bị xâm phạm đã được bảo hộ chưa; văn bằng bảo hộ số mấy, phạm vi bảo hộ?',
      'Hàng hóa vi phạm được sản xuất, đặt in bao bì, tem nhãn ở đâu; ai cung cấp nguyên liệu, khuôn mẫu?',
      'Hàng hóa được phân phối qua những kênh nào (cửa hàng, sàn thương mại điện tử, mạng xã hội), số lượng, doanh thu?',
      'Chủ thể quyền có yêu cầu xử lý, ý kiến về thiệt hại như thế nào?',
    ],
    taiLieu: ['Văn bằng bảo hộ, giấy chứng nhận đăng ký quyền tác giả', 'Mẫu hàng thật, hàng nghi giả', 'Dữ liệu bán hàng trên sàn thương mại điện tử'],
    giamDinh: ['Giám định sở hữu trí tuệ', 'Giám định hàng giả, định giá hàng thật tương đương'],
  },
  'cong-vu': {
    ten: 'Công vụ – thẩm quyền',
    cauHoi: [
      'Chức vụ, quyền hạn, nhiệm vụ được giao của người này tại thời điểm xảy ra sự việc được quy định ở văn bản nào?',
      'Quy trình giải quyết công việc theo quy định gồm những bước nào; bước nào bị bỏ qua, làm trái?',
      'Văn bản, quyết định do người này ký/tham mưu có nội dung trái với quy định nào cụ thể?',
      'Có sự chỉ đạo (bằng văn bản hoặc bằng lời) của cấp trên; nội dung, thời điểm, người chứng kiến?',
      'Tập thể (hội đồng, ban, tổ) có họp, bàn bạc không; biên bản ghi nhận ý kiến từng thành viên ra sao?',
    ],
    taiLieu: ['Quyết định bổ nhiệm, phân công nhiệm vụ, quy chế làm việc', 'Văn bản, tờ trình, quyết định liên quan', 'Biên bản họp, sổ công văn đi/đến', 'Kết luận thanh tra, kiểm tra'],
    giamDinh: ['Ý kiến chuyên môn của cơ quan quản lý nhà nước chuyên ngành'],
  },
  'lao-dong-pccc': {
    ten: 'An toàn lao động – PCCC',
    cauHoi: [
      'Người lao động có được huấn luyện an toàn, trang bị bảo hộ, phổ biến nội quy trước khi làm việc không?',
      'Máy móc, thiết bị có yêu cầu nghiêm ngặt về an toàn đã được kiểm định còn hạn không?',
      'Cơ sở có thiết kế PCCC được thẩm duyệt, nghiệm thu; hệ thống báo cháy, chữa cháy, lối thoát nạn hoạt động thế nào?',
      'Cơ quan chức năng đã kiểm tra, kiến nghị khắc phục những tồn tại gì trước khi xảy ra vụ việc; đã khắc phục chưa?',
      'Diễn biến vụ tai nạn/vụ cháy: thời điểm phát hiện, việc báo tin, cứu nạn, sơ tán?',
    ],
    taiLieu: ['Hồ sơ huấn luyện an toàn, sổ theo dõi cấp phát bảo hộ', 'Biên bản kiểm định thiết bị', 'Hồ sơ thẩm duyệt, nghiệm thu PCCC; biên bản kiểm tra PCCC', 'Biên bản điều tra tai nạn lao động'],
    giamDinh: ['Giám định nguyên nhân cháy, nổ', 'Giám định kỹ thuật thiết bị', 'Giám định pháp y'],
  },
};

/** Câu hỏi chung theo từng lĩnh vực (áp dụng cho mọi tội trong lĩnh vực). */
export const DOMAIN_QUESTIONS = {
  'kinh-te': ['Vụ việc mang lại lợi ích kinh tế cho những ai, dưới hình thức nào (tiền, tài sản, cổ phần, cơ hội kinh doanh)?', 'Các giao dịch liên quan được thanh toán bằng tiền mặt hay chuyển khoản; qua tài khoản của ai?'],
  'chuc-vu': ['Người có chức vụ đã sử dụng chức vụ, quyền hạn nào để thực hiện hoặc tạo điều kiện cho hành vi?', 'Có việc kê khai tài sản, thu nhập không trung thực trong giai đoạn liên quan không?'],
  'moi-truong': ['Cơ quan quản lý nhà nước về môi trường tại địa phương đã thanh tra, kiểm tra, xử phạt cơ sở này những lần nào?', 'Người dân, chính quyền địa phương đã phản ánh về tình trạng ô nhiễm từ thời điểm nào?'],
  'y-te-an-toan': ['Có hậu quả về tính mạng, sức khỏe con người không; số người bị ảnh hưởng, tỷ lệ tổn thương?', 'Trước khi xảy ra vụ việc đã có cảnh báo, kiến nghị hoặc sự cố tương tự chưa?'],
};
