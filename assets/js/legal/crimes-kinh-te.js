// Lĩnh vực KINH TẾ — Chương XVIII "Các tội xâm phạm trật tự quản lý kinh tế" (Điều 188–231)
// và một số tội xâm phạm sở hữu thường gặp trong án kinh tế (Chương XVI).
// Nguồn: Bộ luật Hình sự 2015 (sửa đổi, bổ sung 2017, 2025). Cần đối chiếu nguyên văn khi áp dụng.

const CH18 = 'Chương XVIII — Các tội xâm phạm trật tự quản lý kinh tế';
const hv = (id, ten, cauHoi = [], taiLieu = []) => ({ id, ten, cauHoi, taiLieu });

export const GROUPS_KINH_TE = [
  { id: 'so-huu-kt', ten: 'Chiếm đoạt tài sản trong hoạt động kinh tế', moTa: 'Lừa đảo, lạm dụng tín nhiệm qua hợp đồng, dự án, huy động vốn' },
  { id: 'buon-lau', ten: 'Buôn lậu – vận chuyển qua biên giới', moTa: 'Hàng hóa, tiền tệ, kim khí quý qua biên giới' },
  { id: 'hang-gia', ten: 'Hàng cấm – hàng giả', moTa: 'Sản xuất, buôn bán, tàng trữ hàng cấm, hàng giả các loại' },
  { id: 'thuong-mai', ten: 'Thương mại – kinh doanh', moTa: 'Đầu cơ, quảng cáo gian dối, lừa dối khách hàng, cung ứng điện' },
  { id: 'thue', ten: 'Thuế – hóa đơn – ngân sách', moTa: 'Trốn thuế, mua bán hóa đơn, bao che người nộp thuế' },
  { id: 'tai-chinh', ten: 'Tài chính – ngân hàng – tiền tệ', moTa: 'Hoạt động ngân hàng, lập quỹ trái phép, tiền giả, cho vay lãi nặng' },
  { id: 'chung-khoan', ten: 'Chứng khoán – bảo hiểm', moTa: 'Thao túng, thông tin nội bộ, gian lận bảo hiểm' },
  { id: 'canh-tranh', ten: 'Cạnh tranh – đa cấp – đấu giá', moTa: 'Thỏa thuận hạn chế cạnh tranh, kinh doanh đa cấp, đấu giá tài sản' },
  { id: 'dau-thau', ten: 'Đấu thầu', moTa: 'Vi phạm quy định về đấu thầu, thông thầu, gian lận trong đấu thầu' },
  { id: 'dau-tu-cong', ten: 'Tài sản công – đầu tư công – xây dựng', moTa: 'Quản lý tài sản nhà nước, vốn đầu tư công, kế toán, đầu tư xây dựng, cứu trợ' },
  { id: 'so-huu-tri-tue', ten: 'Sở hữu trí tuệ', moTa: 'Quyền tác giả, quyền sở hữu công nghiệp' },
  { id: 'dat-dai', ten: 'Đất đai – tài nguyên', moTa: 'Quản lý, sử dụng đất; bồi thường, tái định cư; khai thác tài nguyên' },
];

export const CRIMES_KINH_TE = [
  /* ===================== Chiếm đoạt tài sản ===================== */
  {
    dieu: '174', ten: 'Tội lừa đảo chiếm đoạt tài sản', nhom: 'so-huu-kt', chuong: 'Chương XVI — Các tội xâm phạm sở hữu',
    khachThe: 'Quyền sở hữu tài sản của cơ quan, tổ chức, cá nhân',
    chuThe: 'Người từ đủ 14 tuổi (khoản 2–4) hoặc 16 tuổi (khoản 1), có năng lực trách nhiệm hình sự',
    loi: 'Cố ý trực tiếp; mục đích chiếm đoạt có trước hoặc ngay khi nhận tài sản',
    dauHieu: ['Dùng thủ đoạn gian dối (đưa thông tin sai sự thật) làm người bị hại tin là thật và tự nguyện giao tài sản', 'Ý thức chiếm đoạt hình thành trước thời điểm nhận tài sản', 'Giá trị tài sản từ 2 triệu đồng trở lên, hoặc dưới 2 triệu nhưng thuộc trường hợp luật định (đã bị xử phạt, đã bị kết án chưa xóa án tích…)'],
    hanhVi: [
      hv('gia-mao-du-an', 'Gian dối về dự án, hợp đồng, cơ hội đầu tư không có thật', [
        'Dự án/hợp đồng được giới thiệu với người bị hại có tồn tại thực tế không; pháp lý dự án tại thời điểm giao dịch ra sao?',
        'Những thông tin, tài liệu nào được đưa ra để tạo lòng tin (giấy tờ, con dấu, hình ảnh, lời hứa lợi nhuận)? Ai soạn thảo, cung cấp?',
        'Tiền nhận từ người bị hại được sử dụng vào việc gì; có đầu tư vào dự án như cam kết không?',
      ], ['Hợp đồng, giấy nhận tiền, tin nhắn, ghi âm trao đổi', 'Hồ sơ pháp lý dự án tại cơ quan quản lý']),
      hv('gia-danh', 'Giả danh cơ quan, tổ chức, người có chức vụ', [
        'Đối tượng đã tự giới thiệu là ai, công tác ở đâu; sử dụng giấy tờ, trang phục, số điện thoại, tài khoản mạng xã hội nào?',
        'Đối tượng hứa hẹn “lo việc” gì (xin việc, chạy án, cấp phép…); số tiền yêu cầu và cách giao nhận?',
      ], ['Dữ liệu thuê bao, tài khoản mạng xã hội, tài khoản ngân hàng nhận tiền']),
      hv('huy-dong-von', 'Huy động vốn, nhận tiền với cam kết lợi nhuận cao bất thường', [
        'Mô hình huy động hoạt động thế nào; mức lãi/lợi nhuận cam kết; nguồn trả lãi cho người tham gia trước lấy từ đâu?',
        'Tổng số người tham gia, tổng số tiền đã huy động, đã chi trả và còn chiếm giữ?',
      ], ['Danh sách người tham gia, sổ sách thu chi', 'Dữ liệu hệ thống phần mềm, ví điện tử']),
      hv('mua-ban-tai-san', 'Gian dối trong mua bán, chuyển nhượng tài sản (bán tài sản không thuộc sở hữu, đã thế chấp…)', [
        'Tại thời điểm giao dịch, tài sản thuộc quyền sở hữu của ai, có đang bị thế chấp, kê biên, tranh chấp không?',
        'Bên bán có cho bên mua biết tình trạng pháp lý thật của tài sản không; nhận bao nhiêu tiền, giao nhận ra sao?',
      ]),
      hv('cong-nghe-cao', 'Lừa đảo qua mạng, viễn thông', [
        'Kịch bản lừa đảo được thực hiện qua kênh nào (cuộc gọi, tin nhắn, website, ứng dụng)?',
        'Danh sách tài khoản ngân hàng, ví điện tử nhận tiền; ai mở, ai nắm giữ, ai rút tiền?',
      ], ['Dữ liệu thuê bao, IP truy cập, lịch sử giao dịch', 'Hình ảnh camera tại điểm rút tiền']),
    ],
    dinhKhung: ['Có tổ chức', 'Có tính chất chuyên nghiệp', 'Chiếm đoạt tài sản từ 50 triệu đến dưới 200 triệu đồng (khoản 2)', 'Chiếm đoạt từ 200 triệu đến dưới 500 triệu đồng (khoản 3)', 'Chiếm đoạt từ 500 triệu đồng trở lên (khoản 4)', 'Tái phạm nguy hiểm', 'Lợi dụng chức vụ, quyền hạn hoặc lợi dụng danh nghĩa cơ quan, tổ chức', 'Dùng thủ đoạn xảo quyệt', 'Sử dụng mạng máy tính, mạng viễn thông, phương tiện điện tử', 'Lợi dụng thiên tai, dịch bệnh'],
    chuyenMon: ['tai-chinh'],
  },
  {
    dieu: '175', ten: 'Tội lạm dụng tín nhiệm chiếm đoạt tài sản', nhom: 'so-huu-kt', chuong: 'Chương XVI — Các tội xâm phạm sở hữu',
    khachThe: 'Quyền sở hữu tài sản',
    chuThe: 'Người từ đủ 16 tuổi, có năng lực trách nhiệm hình sự',
    loi: 'Cố ý trực tiếp; ý thức chiếm đoạt phát sinh sau khi đã nhận tài sản hợp pháp',
    dauHieu: ['Đã nhận được tài sản một cách hợp pháp qua hợp đồng vay, mượn, thuê, nhận giữ hộ…', 'Sau đó dùng thủ đoạn gian dối hoặc bỏ trốn để chiếm đoạt; hoặc đến hạn có điều kiện nhưng cố tình không trả; hoặc sử dụng vào mục đích bất hợp pháp dẫn đến không có khả năng trả', 'Giá trị tài sản từ 4 triệu đồng trở lên (hoặc dưới 4 triệu thuộc trường hợp luật định)'],
    hanhVi: [
      hv('vay-muon', 'Vay, mượn, thuê tài sản rồi bỏ trốn hoặc gian dối để không trả', [
        'Hợp đồng vay, mượn, thuê được xác lập khi nào, bằng hình thức gì, thời hạn trả?',
        'Tài sản đã được sử dụng vào mục đích gì; đã cầm cố, bán cho ai, giá bao nhiêu?',
        'Khi đến hạn, người nhận tài sản có khả năng trả không; đã có hành vi bỏ trốn, thay đổi nơi ở, cắt liên lạc khi nào?',
      ]),
      hv('nhan-giu-ho', 'Nhận giữ hộ, nhận ủy thác quản lý tài sản rồi chiếm đoạt', [
        'Phạm vi ủy quyền/nhận giữ hộ được thỏa thuận ra sao; có văn bản không?',
        'Tài sản được chuyển dịch, tiêu dùng vào thời điểm nào, có sự đồng ý của chủ sở hữu không?',
      ]),
      hv('su-dung-bat-hop-phap', 'Sử dụng tài sản vào mục đích bất hợp pháp dẫn đến không có khả năng trả lại', [
        'Tài sản đã được sử dụng vào hoạt động gì (cờ bạc, buôn bán hàng cấm…); chứng cứ nào xác định?',
      ]),
    ],
    dinhKhung: ['Có tổ chức', 'Có tính chất chuyên nghiệp', 'Chiếm đoạt từ 50 triệu đồng trở lên (các khoản tăng nặng)', 'Lợi dụng chức vụ, quyền hạn hoặc danh nghĩa cơ quan, tổ chức', 'Dùng thủ đoạn xảo quyệt', 'Tái phạm nguy hiểm'],
    chuyenMon: ['tai-chinh'],
  },

  /* ===================== Buôn lậu ===================== */
  {
    dieu: '188', ten: 'Tội buôn lậu', nhom: 'buon-lau', chuong: CH18, phapNhan: true,
    khachThe: 'Chế độ quản lý nhà nước về xuất khẩu, nhập khẩu hàng hóa, tiền tệ qua biên giới',
    chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại',
    loi: 'Cố ý; thường nhằm mục đích thu lợi',
    dauHieu: ['Buôn bán trái phép qua biên giới hoặc từ khu phi thuế quan vào nội địa và ngược lại', 'Đối tượng: hàng hóa, tiền Việt Nam, ngoại tệ, kim khí quý, đá quý, vật phẩm thuộc di tích lịch sử, văn hóa, hàng cấm', 'Giá trị từ 100 triệu đồng trở lên (hoặc dưới mức này nhưng thuộc trường hợp luật định, hoặc là di vật, cổ vật)'],
    hanhVi: [
      hv('khong-khai-bao', 'Đưa hàng qua biên giới không làm thủ tục hải quan (qua đường mòn, lối mở)', [
        'Hàng được tập kết ở đâu, vận chuyển qua đường mòn/lối mở nào, vào thời gian nào?',
        'Ai thuê người vận chuyển (“cửu vạn”), trả công bao nhiêu, ai nhận hàng phía bên kia biên giới?',
      ]),
      hv('khai-sai', 'Khai sai tên hàng, số lượng, chủng loại; giấu hàng trong hàng hóa khai báo', [
        'Nội dung khai trên tờ khai hải quan khác hàng thực tế ở điểm nào? Ai biết và chỉ đạo việc khai sai?',
        'Hàng hóa được che giấu bằng cách nào (ngăn bí mật, trộn lẫn, thay đổi bao bì)?',
      ]),
      hv('loi-dung-ttht', 'Lợi dụng tạm nhập tái xuất, quá cảnh, gia công để tiêu thụ hàng trong nội địa', [
        'Hàng tạm nhập/quá cảnh đã tái xuất thực tế chưa; chứng từ tái xuất có phản ánh đúng không?',
        'Hàng đã được tiêu thụ trong nội địa qua những đầu mối nào?',
      ]),
    ],
    dinhKhung: ['Có tổ chức', 'Có tính chất chuyên nghiệp', 'Lợi dụng chức vụ, quyền hạn', 'Lợi dụng danh nghĩa cơ quan, tổ chức', 'Vật phạm pháp trị giá từ 300 triệu đồng trở lên (các khoản tăng nặng)', 'Thu lợi bất chính lớn', 'Phạm tội 02 lần trở lên', 'Tái phạm nguy hiểm', 'Lợi dụng chiến tranh, thiên tai, dịch bệnh hoặc hoàn cảnh đặc biệt khó khăn khác'],
    chuyenMon: ['hai-quan'],
  },
  {
    dieu: '189', ten: 'Tội vận chuyển trái phép hàng hóa, tiền tệ qua biên giới', nhom: 'buon-lau', chuong: CH18, phapNhan: true,
    khachThe: 'Chế độ quản lý xuất nhập khẩu, quản lý tiền tệ qua biên giới',
    chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại',
    loi: 'Cố ý; không nhằm mục đích buôn bán (phân biệt với tội buôn lậu)',
    dauHieu: ['Vận chuyển trái phép qua biên giới hàng hóa, tiền Việt Nam, ngoại tệ, kim khí quý, đá quý', 'Không có mục đích mua bán kiếm lời tại thời điểm vận chuyển'],
    hanhVi: [
      hv('mang-tien-te', 'Mang tiền mặt, ngoại tệ, vàng qua biên giới không khai báo', [
        'Số tiền/vàng mang theo là bao nhiêu, của ai, mang đi với mục đích gì?',
        'Người vận chuyển có biết quy định phải khai báo hải quan không?',
      ]),
      hv('van-chuyen-thue', 'Nhận vận chuyển thuê hàng hóa qua biên giới', [
        'Ai thuê, thỏa thuận tiền công bao nhiêu, nhận hàng ở đâu, giao cho ai?',
      ]),
    ],
    dinhKhung: ['Có tổ chức', 'Vật phạm pháp có giá trị lớn', 'Lợi dụng chức vụ, quyền hạn', 'Phạm tội 02 lần trở lên', 'Tái phạm nguy hiểm'],
    chuyenMon: ['hai-quan'],
  },

  /* ===================== Hàng cấm – hàng giả ===================== */
  {
    dieu: '190', ten: 'Tội sản xuất, buôn bán hàng cấm', nhom: 'hang-gia', chuong: CH18, phapNhan: true,
    khachThe: 'Chế độ quản lý của Nhà nước đối với hàng hóa cấm kinh doanh',
    chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại',
    loi: 'Cố ý',
    dauHieu: ['Sản xuất, buôn bán hàng hóa cấm kinh doanh, cấm lưu hành, cấm sử dụng hoặc chưa được phép lưu hành, sử dụng tại Việt Nam (thuốc BVTV cấm, thuốc lá điếu nhập lậu, pháo nổ, chất cấm trong chăn nuôi…)', 'Đạt định lượng/giá trị theo từng loại hàng cấm quy định tại điều luật'],
    hanhVi: [
      hv('san-xuat', 'Sản xuất hàng cấm', [
        'Địa điểm, thiết bị, nguyên liệu sản xuất; nguồn gốc nguyên liệu?',
        'Quy mô sản xuất, số lượng thành phẩm đã sản xuất và tiêu thụ?',
      ]),
      hv('buon-ban', 'Buôn bán hàng cấm (thuốc lá nhập lậu, pháo, thuốc BVTV cấm…)', [
        'Nguồn hàng mua từ ai, giá mua; bán cho ai, giá bán; tổng số lượng đã giao dịch?',
        'Người buôn bán có biết đó là hàng cấm không; căn cứ nào xác định?',
      ]),
    ],
    dinhKhung: ['Có tổ chức', 'Có tính chất chuyên nghiệp', 'Lợi dụng chức vụ, quyền hạn', 'Số lượng/giá trị hàng cấm lớn, rất lớn, đặc biệt lớn theo từng loại', 'Thu lợi bất chính lớn', 'Buôn bán qua biên giới', 'Tái phạm nguy hiểm'],
    chuyenMon: ['hai-quan', 'so-huu-tri-tue'],
  },
  {
    dieu: '191', ten: 'Tội tàng trữ, vận chuyển hàng cấm', nhom: 'hang-gia', chuong: CH18, phapNhan: true,
    khachThe: 'Chế độ quản lý của Nhà nước đối với hàng hóa cấm',
    chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại',
    loi: 'Cố ý; không nhằm mục đích buôn bán',
    dauHieu: ['Tàng trữ hoặc vận chuyển hàng cấm', 'Không chứng minh được mục đích buôn bán (nếu có mục đích buôn bán → Điều 190)'],
    hanhVi: [
      hv('tang-tru', 'Cất giữ hàng cấm', ['Hàng cấm được cất giữ ở đâu, từ khi nào, của ai, để làm gì?']),
      hv('van-chuyen', 'Vận chuyển hàng cấm', ['Vận chuyển từ đâu đến đâu, bằng phương tiện gì, theo yêu cầu của ai, tiền công bao nhiêu?']),
    ],
    dinhKhung: ['Có tổ chức', 'Lợi dụng chức vụ, quyền hạn', 'Số lượng hàng cấm lớn', 'Vận chuyển qua biên giới', 'Tái phạm nguy hiểm'],
    chuyenMon: [],
  },
  {
    dieu: '192', ten: 'Tội sản xuất, buôn bán hàng giả', nhom: 'hang-gia', chuong: CH18, phapNhan: true,
    khachThe: 'Trật tự quản lý thị trường; quyền lợi người tiêu dùng, nhà sản xuất chân chính',
    chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại',
    loi: 'Cố ý',
    dauHieu: ['Hàng giả về giá trị sử dụng, công dụng; giả mạo nhãn hàng hóa, bao bì; giả mạo tên, địa chỉ tổ chức sản xuất…', 'Hàng giả tương đương số lượng hàng thật trị giá từ 30 triệu đồng trở lên (hoặc dưới mức này thuộc trường hợp luật định)'],
    hanhVi: [
      hv('san-xuat-gia', 'Sản xuất, đóng gói, in nhãn hàng giả', [
        'Cơ sở sản xuất ở đâu, máy móc, khuôn in, nguyên liệu mua từ ai?',
        'Hàng giả mạo nhãn hiệu/sản phẩm của doanh nghiệp nào; hàng thật tương đương có giá bao nhiêu?',
      ]),
      hv('buon-ban-gia', 'Buôn bán hàng giả (kể cả qua sàn thương mại điện tử)', [
        'Nguồn hàng, giá nhập; kênh bán, số lượng bán, doanh thu?',
        'Người bán có biết hàng giả không (giá nhập thấp bất thường, không có hóa đơn, bao bì khác hàng thật…)?',
      ]),
    ],
    dinhKhung: ['Có tổ chức', 'Có tính chất chuyên nghiệp', 'Lợi dụng chức vụ, quyền hạn', 'Lợi dụng danh nghĩa cơ quan, tổ chức', 'Hàng giả trị giá lớn', 'Thu lợi bất chính lớn', 'Buôn bán qua biên giới', 'Tái phạm nguy hiểm'],
    chuyenMon: ['so-huu-tri-tue'],
  },
  {
    dieu: '193', ten: 'Tội sản xuất, buôn bán hàng giả là lương thực, thực phẩm, phụ gia thực phẩm', nhom: 'hang-gia', chuong: CH18, phapNhan: true,
    khachThe: 'Trật tự quản lý thị trường; sức khỏe, tính mạng người tiêu dùng',
    chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại',
    loi: 'Cố ý',
    dauHieu: ['Đối tượng là lương thực, thực phẩm, phụ gia thực phẩm giả', 'Không phụ thuộc giá trị hàng giả đối với khoản 1'],
    hanhVi: [
      hv('gia-thuc-pham', 'Sản xuất thực phẩm giả (không có/ít hàm lượng dinh dưỡng, giả nhãn hiệu)', [
        'Thành phần thực tế của sản phẩm so với công bố trên nhãn khác nhau thế nào?',
        'Sản phẩm đã được tiêu thụ tại đâu, số lượng; có người sử dụng bị ảnh hưởng sức khỏe không?',
      ]),
    ],
    dinhKhung: ['Có tổ chức', 'Có tính chất chuyên nghiệp', 'Gây thương tích, tổn hại sức khỏe hoặc làm chết người', 'Hàng giả trị giá lớn', 'Thu lợi bất chính lớn', 'Buôn bán qua biên giới'],
    chuyenMon: ['thuc-pham', 'so-huu-tri-tue'],
  },
  {
    dieu: '194', ten: 'Tội sản xuất, buôn bán hàng giả là thuốc chữa bệnh, thuốc phòng bệnh', nhom: 'hang-gia', chuong: CH18, phapNhan: true,
    khachThe: 'Trật tự quản lý dược; sức khỏe, tính mạng con người',
    chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại',
    loi: 'Cố ý',
    ghiChu: 'Luật 86/2025/QH15 (hiệu lực 01/7/2025) đã bỏ hình phạt tử hình đối với tội này.',
    dauHieu: ['Đối tượng là thuốc chữa bệnh, thuốc phòng bệnh giả (không có hoặc không đủ dược chất, sai dược chất, giả mạo nhà sản xuất…)', 'Không phụ thuộc giá trị đối với khoản 1'],
    hanhVi: [
      hv('gia-thuoc', 'Sản xuất, buôn bán thuốc giả', [
        'Thuốc được sản xuất/nhập về từ đâu; có số đăng ký lưu hành không; hóa đơn, chứng từ nhập hàng?',
        'Kết quả kiểm nghiệm cho thấy hàm lượng dược chất thực tế ra sao?',
        'Thuốc đã được bán cho cơ sở y tế, nhà thuốc nào; có bệnh nhân sử dụng bị ảnh hưởng không?',
      ]),
    ],
    dinhKhung: ['Có tổ chức', 'Có tính chất chuyên nghiệp', 'Lợi dụng chức vụ, quyền hạn', 'Gây thương tích, tổn hại sức khỏe hoặc làm chết người', 'Hàng giả trị giá lớn', 'Buôn bán qua biên giới', 'Tái phạm nguy hiểm'],
    chuyenMon: ['y-duoc'],
  },
  {
    dieu: '195', ten: 'Tội sản xuất, buôn bán hàng giả là thức ăn chăn nuôi, phân bón, thuốc thú y, thuốc bảo vệ thực vật, giống cây trồng, giống vật nuôi', nhom: 'hang-gia', chuong: CH18, phapNhan: true,
    khachThe: 'Trật tự quản lý thị trường vật tư nông nghiệp; quyền lợi người sản xuất nông nghiệp',
    chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại',
    loi: 'Cố ý',
    dauHieu: ['Đối tượng là thức ăn chăn nuôi, phân bón, thuốc thú y, thuốc BVTV, giống cây trồng, giống vật nuôi giả', 'Hàng giả tương đương hàng thật trị giá từ 20 triệu đồng trở lên hoặc gây thiệt hại theo luật định'],
    hanhVi: [
      hv('gia-phan-bon', 'Sản xuất, buôn bán phân bón, thuốc BVTV, giống giả', [
        'Hàm lượng chất dinh dưỡng/hoạt chất thực tế so với công bố?',
        'Sản phẩm đã bán cho nông dân, đại lý nào; diện tích cây trồng, vật nuôi bị thiệt hại?',
      ]),
    ],
    dinhKhung: ['Có tổ chức', 'Có tính chất chuyên nghiệp', 'Gây thiệt hại cho người khác', 'Hàng giả trị giá lớn', 'Thu lợi bất chính lớn'],
    chuyenMon: ['so-huu-tri-tue'],
  },

  /* ===================== Thương mại ===================== */
  {
    dieu: '196', ten: 'Tội đầu cơ', nhom: 'thuong-mai', chuong: CH18, phapNhan: true,
    khachThe: 'Trật tự quản lý thị trường, bình ổn giá',
    chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý, nhằm thu lợi bất chính',
    dauHieu: ['Lợi dụng tình hình khan hiếm hoặc tạo ra sự khan hiếm giả tạo trong tình hình thiên tai, dịch bệnh, chiến tranh hoặc hoàn cảnh khó khăn về kinh tế', 'Mua vét hàng hóa thuộc danh mục bình ổn giá hoặc được Nhà nước định giá để bán lại nhằm thu lợi bất chính'],
    hanhVi: [hv('mua-vet', 'Mua vét, găm hàng để bán giá cao', ['Thời điểm, số lượng hàng mua vào; giá mua so với giá bán ra?', 'Hàng hóa có thuộc danh mục bình ổn giá/Nhà nước định giá không?'])],
    dinhKhung: ['Có tổ chức', 'Lợi dụng chức vụ, quyền hạn', 'Hàng phạm pháp/thu lợi bất chính có giá trị lớn', 'Gây ảnh hưởng xấu đến an ninh, trật tự, an toàn xã hội'],
    chuyenMon: [],
  },
  {
    dieu: '197', ten: 'Tội quảng cáo gian dối', nhom: 'thuong-mai', chuong: CH18,
    khachThe: 'Trật tự quản lý hoạt động quảng cáo; quyền lợi người tiêu dùng',
    chuThe: 'Người từ đủ 16 tuổi', loi: 'Cố ý',
    dauHieu: ['Quảng cáo gian dối về hàng hóa, dịch vụ', 'Đã bị xử phạt vi phạm hành chính hoặc đã bị kết án về hành vi này, chưa được xóa án tích mà còn vi phạm'],
    hanhVi: [hv('quang-cao-sai', 'Quảng cáo sai sự thật về công dụng, chất lượng', ['Nội dung quảng cáo khẳng định điều gì; căn cứ khoa học, giấy phép nội dung quảng cáo?', 'Ai thuê quảng cáo, đơn vị nào thực hiện, phát hành trên kênh nào, chi phí bao nhiêu?'])],
    dinhKhung: ['Có tổ chức', 'Thu lợi bất chính', 'Gây thiệt hại cho người tiêu dùng'],
    chuyenMon: ['y-duoc', 'thuc-pham'],
  },
  {
    dieu: '198', ten: 'Tội lừa dối khách hàng', nhom: 'thuong-mai', chuong: CH18,
    khachThe: 'Quyền lợi người tiêu dùng, trật tự thương mại',
    chuThe: 'Người từ đủ 16 tuổi', loi: 'Cố ý',
    dauHieu: ['Cân, đong, đo, đếm, tính gian hàng hóa, dịch vụ hoặc dùng thủ đoạn gian dối khác', 'Gây thiệt hại cho khách hàng từ 5 triệu đồng trở lên hoặc thuộc trường hợp luật định'],
    hanhVi: [hv('can-dong-gian', 'Cân đong đo đếm gian, gian dối về chất lượng', ['Thủ đoạn gian lận cụ thể (can thiệp thiết bị đo, tráo hàng…)?', 'Số khách hàng bị thiệt hại, tổng giá trị thiệt hại?'])],
    dinhKhung: ['Có tổ chức', 'Có tính chất chuyên nghiệp', 'Dùng thủ đoạn xảo quyệt', 'Thu lợi bất chính lớn'],
    chuyenMon: [],
  },
  {
    dieu: '199', ten: 'Tội vi phạm quy định về cung ứng điện', nhom: 'thuong-mai', chuong: CH18,
    khachThe: 'Trật tự quản lý hoạt động cung ứng điện',
    chuThe: 'Người có chức vụ, quyền hạn trong đơn vị cung ứng điện', loi: 'Cố ý',
    dauHieu: ['Người có chức vụ, quyền hạn ngừng cung cấp điện trái pháp luật', 'Gây thiệt hại theo mức luật định hoặc đã bị xử lý kỷ luật/xử phạt mà còn vi phạm'],
    hanhVi: [hv('cat-dien', 'Ngừng, giảm cung cấp điện trái quy định', ['Quyết định ngừng cấp điện do ai đưa ra, căn cứ nào, có thông báo trước theo quy định không?', 'Thiệt hại do việc ngừng cấp điện gây ra là bao nhiêu?'])],
    dinhKhung: ['Gây thiệt hại lớn', 'Gây ảnh hưởng xấu đến an ninh, trật tự'],
    chuyenMon: ['cong-vu'],
  },

  /* ===================== Thuế – hóa đơn ===================== */
  {
    dieu: '200', ten: 'Tội trốn thuế', nhom: 'thue', chuong: CH18, phapNhan: true,
    khachThe: 'Chế độ quản lý thuế, nguồn thu ngân sách nhà nước',
    chuThe: 'Cá nhân từ đủ 16 tuổi (người nộp thuế, người đại diện, kế toán…); pháp nhân thương mại',
    loi: 'Cố ý',
    dauHieu: ['Thực hiện một trong các hành vi trốn thuế liệt kê tại điều luật', 'Số tiền trốn thuế từ 100 triệu đồng trở lên; hoặc dưới 100 triệu nhưng đã bị xử phạt hành chính về hành vi trốn thuế hoặc đã bị kết án về tội này chưa được xóa án tích'],
    hanhVi: [
      hv('khong-nop-ho-so', 'Không nộp hồ sơ đăng ký thuế, khai thuế; nộp sau 90 ngày', ['Doanh nghiệp/cá nhân có phát sinh doanh thu trong kỳ nhưng không kê khai không; doanh thu thực tế bao nhiêu?']),
      hv('khong-ghi-doanh-thu', 'Không ghi chép trong sổ kế toán các khoản thu liên quan đến xác định số thuế phải nộp', ['Những khoản thu nào không được ghi sổ; được thu bằng tiền mặt hay qua tài khoản cá nhân?', 'Có sử dụng hai hệ thống sổ sách (sổ thật – sổ báo cáo thuế) không?']),
      hv('khai-sai', 'Khai sai căn cứ tính thuế, khai thấp doanh thu, khai khống chi phí', ['Doanh thu kê khai so với doanh thu thực tế (hợp đồng, sao kê) chênh lệch bao nhiêu?', 'Những chi phí nào được khai khống; chứng từ chi phí do ai lập?']),
      hv('hoa-don-khong-hop-phap', 'Sử dụng hóa đơn, chứng từ không hợp pháp để hạch toán, khấu trừ, hoàn thuế', ['Hóa đơn đầu vào nào không có hàng hóa, dịch vụ thực tế; mua từ ai, giá mua bao nhiêu % giá trị hóa đơn?', 'Số thuế GTGT đã khấu trừ/hoàn và thuế TNDN giảm do sử dụng các hóa đơn này?']),
      hv('khong-xuat-hoa-don', 'Không xuất hóa đơn khi bán hàng hoặc ghi giá trị trên hóa đơn thấp hơn thực tế', ['Giá bán thực tế và giá ghi trên hóa đơn khác nhau bao nhiêu; phần chênh lệch thu bằng cách nào?']),
      hv('su-dung-hang-mien-thue', 'Sử dụng hàng hóa được miễn thuế, xét miễn thuế không đúng mục đích', ['Hàng hóa miễn thuế đã được sử dụng/chuyển nhượng vào mục đích gì, có khai báo chuyển đổi mục đích không?']),
    ],
    dinhKhung: ['Có tổ chức', 'Số tiền trốn thuế từ 300 triệu đến dưới 1 tỷ đồng (khoản 2)', 'Số tiền trốn thuế từ 1 tỷ đồng trở lên (khoản 3)', 'Lợi dụng chức vụ, quyền hạn', 'Phạm tội 02 lần trở lên', 'Tái phạm nguy hiểm'],
    chuyenMon: ['thue-hoa-don', 'tai-chinh'],
  },
  {
    dieu: '202', ten: 'Tội làm, buôn bán tem giả, vé giả', nhom: 'thue', chuong: CH18,
    khachThe: 'Chế độ quản lý tem, vé, nguồn thu ngân sách', chuThe: 'Người từ đủ 16 tuổi', loi: 'Cố ý',
    dauHieu: ['Làm, buôn bán tem giả, vé giả, tem/vé đã sử dụng rồi', 'Số lượng/giá trị theo mức luật định'],
    hanhVi: [hv('lam-tem-gia', 'Làm, in, buôn bán tem, vé giả', ['Tem/vé giả loại gì (tem bưu chính, vé xổ số, vé tàu xe…), số lượng, nơi in?', 'Đầu mối tiêu thụ, giá bán?'])],
    dinhKhung: ['Có tổ chức', 'Số lượng lớn', 'Thu lợi bất chính lớn'],
    chuyenMon: [],
  },
  {
    dieu: '203', ten: 'Tội in, phát hành, mua bán trái phép hóa đơn, chứng từ thu nộp ngân sách nhà nước', nhom: 'thue', chuong: CH18, phapNhan: true,
    khachThe: 'Chế độ quản lý hóa đơn, chứng từ; nguồn thu ngân sách',
    chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý, thường nhằm thu lợi',
    dauHieu: ['In, phát hành, mua bán trái phép hóa đơn, chứng từ (kể cả hóa đơn điện tử)', 'Số lượng hóa đơn ở dạng phôi từ 50 số đến dưới 100 số hoặc hóa đơn đã ghi nội dung từ 10 số đến dưới 30 số, hoặc thu lợi bất chính từ 30 triệu đồng trở lên (khoản 1); hoặc các trường hợp luật định'],
    hanhVi: [
      hv('thanh-lap-dn-ma', 'Thành lập, mua lại doanh nghiệp “ma” để bán hóa đơn', ['Ai đứng tên pháp nhân, ai thực tế điều hành; giấy tờ tùy thân dùng để đăng ký doanh nghiệp lấy từ đâu?', 'Doanh nghiệp có hoạt động sản xuất, kinh doanh thực tế không?']),
      hv('mua-ban-hoa-don', 'Mua bán hóa đơn không kèm hàng hóa, dịch vụ', ['Số lượng hóa đơn đã xuất bán, tổng giá trị ghi trên hóa đơn, tỷ lệ % “phí” mua bán?', 'Danh sách doanh nghiệp mua hóa đơn; cách thức liên hệ, giao nhận, thanh toán, rút tiền quay vòng?']),
    ],
    dinhKhung: ['Có tổ chức', 'Có tính chất chuyên nghiệp', 'Lợi dụng chức vụ, quyền hạn', 'Số lượng hóa đơn lớn', 'Thu lợi bất chính lớn', 'Gây thiệt hại cho ngân sách', 'Tái phạm nguy hiểm'],
    chuyenMon: ['thue-hoa-don'],
  },
  {
    dieu: '204', ten: 'Tội vi phạm quy định về bảo quản, quản lý hóa đơn, chứng từ thu nộp ngân sách nhà nước', nhom: 'thue', chuong: CH18,
    khachThe: 'Chế độ quản lý hóa đơn, chứng từ', chuThe: 'Người có trách nhiệm bảo quản, quản lý hóa đơn, chứng từ', loi: 'Cố ý hoặc vô ý',
    dauHieu: ['Vi phạm quy định về bảo quản, quản lý hóa đơn, chứng từ', 'Gây thiệt hại theo mức luật định'],
    hanhVi: [hv('lam-mat-hoa-don', 'Làm mất, để người khác sử dụng trái phép hóa đơn, chứng từ', ['Người được giao trách nhiệm quản lý hóa đơn là ai; quy trình giao nhận, sử dụng hóa đơn?', 'Hóa đơn bị mất/bị sử dụng trái phép khi nào, gây thiệt hại bao nhiêu?'])],
    dinhKhung: ['Gây thiệt hại lớn', 'Có tổ chức'],
    chuyenMon: ['thue-hoa-don'],
  },
  {
    dieu: '223', ten: 'Tội thông đồng, bao che cho người nộp thuế gây hậu quả nghiêm trọng', nhom: 'thue', chuong: CH18,
    khachThe: 'Hoạt động đúng đắn của cơ quan quản lý thuế; nguồn thu ngân sách',
    chuThe: 'Chủ thể đặc biệt: người có chức vụ, quyền hạn trong cơ quan quản lý thuế (hoặc người khác đồng phạm)', loi: 'Cố ý',
    dauHieu: ['Lợi dụng chức vụ, quyền hạn thông đồng, bao che cho người nộp thuế', 'Gây thiệt hại cho ngân sách nhà nước từ 100 triệu đồng trở lên'],
    hanhVi: [
      hv('bao-che-kiem-tra', 'Bỏ qua sai phạm khi thanh tra, kiểm tra thuế', ['Trong đợt thanh tra/kiểm tra, những sai phạm nào đã được phát hiện nhưng không đưa vào biên bản, kết luận?', 'Có việc nhận tiền, lợi ích từ người nộp thuế không; giao nhận ở đâu, qua ai?']),
      hv('hoan-thue-sai', 'Thông đồng giải quyết hoàn thuế, miễn giảm thuế trái quy định', ['Hồ sơ hoàn thuế được kiểm tra trước hay hoàn trước kiểm tra sau; ai đề xuất, ai duyệt?']),
    ],
    dinhKhung: ['Có tổ chức', 'Thiệt hại từ 300 triệu đồng trở lên (các khoản tăng nặng)', 'Phạm tội 02 lần trở lên'],
    chuyenMon: ['thue-hoa-don', 'cong-vu'],
  },

  /* ===================== Tài chính – ngân hàng ===================== */
  {
    dieu: '201', ten: 'Tội cho vay lãi nặng trong giao dịch dân sự', nhom: 'tai-chinh', chuong: CH18,
    khachThe: 'Trật tự quản lý kinh tế trong hoạt động cho vay', chuThe: 'Người từ đủ 16 tuổi', loi: 'Cố ý',
    dauHieu: ['Lãi suất gấp 05 lần trở lên mức lãi suất cao nhất quy định trong Bộ luật Dân sự', 'Thu lợi bất chính từ 30 triệu đồng trở lên hoặc đã bị xử phạt hành chính/kết án về hành vi này chưa được xóa án tích'],
    hanhVi: [hv('cho-vay', 'Cho vay với lãi suất cao (kể cả qua ứng dụng, “tín dụng đen”)', ['Số tiền cho vay, mức lãi suất thỏa thuận/thực thu theo ngày, tháng; các khoản phí trá hình?', 'Số người vay, tổng số tiền lãi đã thu; phần thu lợi bất chính được tính thế nào?', 'Có hành vi đòi nợ bằng đe dọa, khủng bố tinh thần không?'])],
    dinhKhung: ['Thu lợi bất chính từ 100 triệu đồng trở lên (khoản 2)', 'Có tổ chức'],
    chuyenMon: ['tai-chinh'],
  },
  {
    dieu: '205', ten: 'Tội lập quỹ trái phép', nhom: 'tai-chinh', chuong: CH18,
    khachThe: 'Chế độ quản lý tài chính, kỷ luật thu chi', chuThe: 'Người có chức vụ, quyền hạn trong cơ quan, tổ chức, doanh nghiệp', loi: 'Cố ý',
    dauHieu: ['Lợi dụng chức vụ, quyền hạn lập quỹ trái phép (quỹ “đen”) ngoài sổ sách kế toán', 'Số tiền của quỹ trái phép từ mức luật định trở lên hoặc gây thiệt hại'],
    hanhVi: [hv('quy-den', 'Lập và sử dụng quỹ ngoài sổ sách', ['Nguồn hình thành quỹ (thu không nhập quỹ, chi khống, hoa hồng…)?', 'Ai quyết định lập quỹ, ai giữ, ai quyết định chi; quỹ đã chi vào việc gì, cho ai?'])],
    dinhKhung: ['Lập quỹ trái phép nhiều lần', 'Số tiền lớn', 'Gây thiệt hại lớn'],
    chuyenMon: ['tai-chinh', 'cong-vu'],
  },
  {
    dieu: '206', ten: 'Tội vi phạm quy định về hoạt động ngân hàng, hoạt động khác liên quan đến hoạt động ngân hàng', nhom: 'tai-chinh', chuong: CH18,
    khachThe: 'Trật tự quản lý hoạt động ngân hàng; an toàn hệ thống tín dụng',
    chuThe: 'Người có trách nhiệm trong tổ chức tín dụng, chi nhánh ngân hàng nước ngoài (và người khác đồng phạm)', loi: 'Cố ý',
    dauHieu: ['Thực hiện một trong các hành vi vi phạm liệt kê tại điều luật (cho vay không có bảo đảm trái quy định, cho vay vượt giới hạn, cấp tín dụng cho đối tượng không được cấp, vi phạm về tỷ lệ an toàn…)', 'Gây thiệt hại từ 100 triệu đồng trở lên hoặc thuộc trường hợp luật định'],
    hanhVi: [
      hv('cho-vay-sai', 'Cho vay không có bảo đảm, bảo đảm không đủ; định giá tài sản bảo đảm cao hơn thực tế', ['Khoản vay được phê duyệt dựa trên tài sản bảo đảm nào; ai định giá, phương pháp định giá?', 'Cán bộ tín dụng có thẩm định thực tế phương án vay, năng lực khách hàng không?']),
      hv('vuot-gioi-han', 'Cấp tín dụng vượt giới hạn, cho đối tượng không được cấp tín dụng, cho nhóm khách hàng liên quan', ['Các khách hàng vay có quan hệ sở hữu, điều hành chung không; tổng dư nợ nhóm vượt giới hạn bao nhiêu?']),
      hv('huy-dong-sai', 'Huy động vốn, chi trả lãi suất vượt trần, ngoài sổ sách', ['Lãi suất huy động thực trả, phần chênh lệch chi bằng nguồn nào, ai phê duyệt?']),
    ],
    dinhKhung: ['Có tổ chức', 'Thiệt hại từ 500 triệu đồng trở lên (các khoản tăng nặng)', 'Dẫn đến tổ chức tín dụng bị đặt vào tình trạng kiểm soát đặc biệt', 'Lợi dụng chức vụ, quyền hạn'],
    chuyenMon: ['ngan-hang', 'tai-chinh'],
  },
  {
    dieu: '207', ten: 'Tội làm, tàng trữ, vận chuyển, lưu hành tiền giả', nhom: 'tai-chinh', chuong: CH18,
    khachThe: 'Chế độ phát hành, lưu thông tiền tệ', chuThe: 'Người từ đủ 14 tuổi đối với một số khoản; từ đủ 16 tuổi', loi: 'Cố ý',
    dauHieu: ['Làm, tàng trữ, vận chuyển, lưu hành tiền giả'],
    hanhVi: [
      hv('lam-tien-gia', 'In, làm tiền giả', ['Thiết bị, giấy, mực in mua ở đâu; số lượng, mệnh giá tiền giả đã làm?']),
      hv('luu-hanh', 'Tàng trữ, vận chuyển, lưu hành tiền giả', ['Mua tiền giả từ ai (thường qua mạng), tỷ lệ mua bán; đã tiêu thụ ở đâu, bao nhiêu?']),
    ],
    dinhKhung: ['Có tổ chức', 'Số lượng tiền giả lớn', 'Tái phạm nguy hiểm'],
    chuyenMon: [],
  },
  {
    dieu: '208', ten: 'Tội làm, tàng trữ, vận chuyển, lưu hành công cụ chuyển nhượng giả hoặc các giấy tờ có giá giả khác', nhom: 'tai-chinh', chuong: CH18,
    khachThe: 'Chế độ quản lý công cụ chuyển nhượng, giấy tờ có giá', chuThe: 'Người từ đủ 16 tuổi', loi: 'Cố ý',
    dauHieu: ['Làm, tàng trữ, vận chuyển, lưu hành séc, hối phiếu, trái phiếu, cổ phiếu giả hoặc giấy tờ có giá giả khác'],
    hanhVi: [hv('giay-to-co-gia-gia', 'Làm, lưu hành giấy tờ có giá giả', ['Loại giấy tờ giả, mệnh giá, số lượng; đã sử dụng để thanh toán, cầm cố ở đâu?'])],
    dinhKhung: ['Có tổ chức', 'Giá trị lớn', 'Tái phạm nguy hiểm'],
    chuyenMon: ['ngan-hang'],
  },

  /* ===================== Chứng khoán – bảo hiểm ===================== */
  {
    dieu: '209', ten: 'Tội cố ý công bố thông tin sai lệch hoặc che giấu thông tin trong hoạt động chứng khoán', nhom: 'chung-khoan', chuong: CH18, phapNhan: true,
    khachThe: 'Trật tự quản lý thị trường chứng khoán; quyền lợi nhà đầu tư', chuThe: 'Người có nghĩa vụ công bố thông tin; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Công bố thông tin sai lệch hoặc che giấu thông tin trong chào bán, niêm yết, giao dịch, báo cáo', 'Thu lợi bất chính hoặc gây thiệt hại cho nhà đầu tư theo mức luật định'],
    hanhVi: [hv('bctc-sai', 'Lập, công bố báo cáo tài chính, bản cáo bạch sai lệch', ['Những chỉ tiêu nào bị làm sai lệch, mức độ sai lệch; ai chỉ đạo, ai lập, ai soát xét?', 'Sau công bố, giá cổ phiếu biến động thế nào; những ai đã giao dịch hưởng lợi?'])],
    dinhKhung: ['Thu lợi bất chính lớn', 'Gây thiệt hại lớn cho nhà đầu tư', 'Có tổ chức'],
    chuyenMon: ['chung-khoan-bao-hiem', 'tai-chinh'],
  },
  {
    dieu: '210', ten: 'Tội sử dụng thông tin nội bộ để mua bán chứng khoán', nhom: 'chung-khoan', chuong: CH18, phapNhan: true,
    khachThe: 'Trật tự, công bằng của thị trường chứng khoán', chuThe: 'Người biết thông tin nội bộ; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Sử dụng thông tin nội bộ chưa công bố để mua, bán chứng khoán hoặc tiết lộ, cung cấp, tư vấn cho người khác', 'Thu lợi bất chính hoặc gây thiệt hại theo mức luật định'],
    hanhVi: [hv('noi-gian', 'Giao dịch trước khi công bố thông tin quan trọng', ['Người giao dịch biết thông tin nội bộ từ nguồn nào, vào thời điểm nào?', 'Thời điểm đặt lệnh so với thời điểm công bố thông tin; khoản lợi nhuận thu được?'])],
    dinhKhung: ['Có tổ chức', 'Thu lợi bất chính lớn', 'Tái phạm nguy hiểm'],
    chuyenMon: ['chung-khoan-bao-hiem'],
  },
  {
    dieu: '211', ten: 'Tội thao túng thị trường chứng khoán', nhom: 'chung-khoan', chuong: CH18, phapNhan: true,
    khachThe: 'Trật tự, tính minh bạch của thị trường chứng khoán', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Thực hiện các hành vi thao túng: giao dịch tạo cung cầu giả tạo, mua bán liên tục chi phối giá, đặt lệnh ảo, sử dụng nhiều tài khoản thông đồng…', 'Thu lợi bất chính hoặc gây thiệt hại theo mức luật định'],
    hanhVi: [hv('thao-tung', 'Sử dụng nhiều tài khoản giao dịch “tay trái – tay phải” để làm giá', ['Danh sách tài khoản sử dụng; ai mở, ai giữ thông tin đăng nhập, ai đặt lệnh?', 'Khối lượng, tần suất giao dịch giữa các tài khoản trong nhóm; giá cổ phiếu trước – trong – sau thời kỳ giao dịch?'])],
    dinhKhung: ['Có tổ chức', 'Thu lợi bất chính lớn', 'Gây thiệt hại lớn'],
    chuyenMon: ['chung-khoan-bao-hiem'],
  },
  {
    dieu: '212', ten: 'Tội làm giả tài liệu trong hồ sơ chào bán, niêm yết chứng khoán', nhom: 'chung-khoan', chuong: CH18,
    khachThe: 'Trật tự quản lý phát hành, niêm yết chứng khoán', chuThe: 'Người từ đủ 16 tuổi', loi: 'Cố ý',
    dauHieu: ['Làm giả tài liệu trong hồ sơ đăng ký chào bán, niêm yết chứng khoán', 'Thu lợi bất chính hoặc gây thiệt hại theo mức luật định'],
    hanhVi: [hv('gia-ho-so-cb', 'Làm giả tài liệu chứng minh vốn, tài sản, điều kiện niêm yết', ['Tài liệu nào bị làm giả, ai làm, mục đích; cơ quan nào đã chấp thuận dựa trên tài liệu này?'])],
    dinhKhung: ['Có tổ chức', 'Thu lợi bất chính lớn'],
    chuyenMon: ['chung-khoan-bao-hiem'],
  },
  {
    dieu: '213', ten: 'Tội gian lận trong kinh doanh bảo hiểm', nhom: 'chung-khoan', chuong: CH18, phapNhan: true,
    khachThe: 'Trật tự quản lý kinh doanh bảo hiểm', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Thông đồng, giả mạo tài liệu, cố ý làm sai lệch thông tin để từ chối bồi thường hoặc để được bồi thường, trả tiền bảo hiểm', 'Chiếm đoạt hoặc gây thiệt hại theo mức luật định'],
    hanhVi: [hv('truc-loi-bh', 'Tạo dựng sự kiện bảo hiểm, giả mạo hồ sơ bồi thường', ['Sự kiện bảo hiểm có xảy ra thực tế không; hồ sơ (biên bản, hóa đơn, chứng từ y tế) do ai lập?', 'Có sự thông đồng với nhân viên doanh nghiệp bảo hiểm, cơ sở y tế, gara không?'])],
    dinhKhung: ['Có tổ chức', 'Số tiền lớn', 'Dùng thủ đoạn tinh vi, xảo quyệt'],
    chuyenMon: ['chung-khoan-bao-hiem'],
  },
  {
    dieu: '214', ten: 'Tội gian lận bảo hiểm xã hội, bảo hiểm thất nghiệp', nhom: 'chung-khoan', chuong: CH18,
    khachThe: 'Chế độ bảo hiểm xã hội, bảo hiểm thất nghiệp', chuThe: 'Người từ đủ 16 tuổi', loi: 'Cố ý',
    dauHieu: ['Lập hồ sơ giả, làm sai lệch nội dung hồ sơ để hưởng chế độ BHXH, BHTN', 'Chiếm đoạt hoặc gây thiệt hại theo mức luật định'],
    hanhVi: [hv('ho-so-bhxh-gia', 'Lập hồ sơ giả để hưởng chế độ', ['Hồ sơ hưởng chế độ (ốm đau, thai sản, thất nghiệp…) có giấy tờ nào giả; ai làm giả, ai hưởng lợi?'])],
    dinhKhung: ['Có tổ chức', 'Có tính chất chuyên nghiệp', 'Số tiền lớn', 'Dùng thủ đoạn tinh vi, xảo quyệt'],
    chuyenMon: ['tai-chinh'],
  },
  {
    dieu: '215', ten: 'Tội gian lận bảo hiểm y tế', nhom: 'chung-khoan', chuong: CH18,
    khachThe: 'Chế độ bảo hiểm y tế, quỹ BHYT', chuThe: 'Người từ đủ 16 tuổi (thường là người hành nghề, quản lý tại cơ sở khám chữa bệnh)', loi: 'Cố ý',
    dauHieu: ['Lập hồ sơ bệnh án, kê đơn thuốc khống, kê tăng số lượng, khống chi phí để thanh toán BHYT', 'Chiếm đoạt hoặc gây thiệt hại theo mức luật định'],
    hanhVi: [hv('ke-khong-bhyt', 'Kê khống dịch vụ kỹ thuật, thuốc, vật tư để quyết toán BHYT', ['Những dịch vụ nào không thực hiện thực tế nhưng vẫn đề nghị thanh toán; ai chỉ đạo, ai thực hiện trên phần mềm?', 'Số tiền quỹ BHYT đã thanh toán sai?'])],
    dinhKhung: ['Có tổ chức', 'Số tiền lớn', 'Dùng thủ đoạn tinh vi, xảo quyệt'],
    chuyenMon: ['y-duoc', 'tai-chinh'],
  },
  {
    dieu: '216', ten: 'Tội trốn đóng bảo hiểm xã hội, bảo hiểm y tế, bảo hiểm thất nghiệp cho người lao động', nhom: 'chung-khoan', chuong: CH18, phapNhan: true,
    khachThe: 'Quyền lợi người lao động; chế độ bảo hiểm', chuThe: 'Người sử dụng lao động có nghĩa vụ đóng bảo hiểm; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Gian dối hoặc bằng thủ đoạn khác để không đóng hoặc không đóng đầy đủ', 'Trốn đóng từ 50 triệu đồng trở lên hoặc từ 10 người lao động trở lên, thời hạn từ 06 tháng trở lên, đã bị xử phạt hành chính mà còn vi phạm'],
    hanhVi: [hv('tron-dong', 'Không đóng, đóng không đủ bảo hiểm cho người lao động', ['Số lao động thuộc diện phải đóng, số đã đóng; số tiền, số tháng trốn đóng?', 'Tiền đã trích từ lương người lao động có được nộp vào quỹ không, sử dụng vào việc gì?'])],
    dinhKhung: ['Trốn đóng số tiền lớn', 'Đối với số lượng lớn người lao động', 'Không đóng số tiền đã thu của người lao động'],
    chuyenMon: ['tai-chinh'],
  },

  /* ===================== Cạnh tranh – đa cấp – đấu giá ===================== */
  {
    dieu: '217', ten: 'Tội vi phạm quy định về cạnh tranh', nhom: 'canh-tranh', chuong: CH18, phapNhan: true,
    khachThe: 'Trật tự cạnh tranh lành mạnh', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Thỏa thuận ngăn cản, kìm hãm, loại bỏ doanh nghiệp khác; thỏa thuận thông đồng để một hoặc các bên thắng thầu…', 'Thu lợi bất chính hoặc gây thiệt hại theo mức luật định'],
    hanhVi: [hv('thoa-thuan-han-che', 'Thỏa thuận hạn chế cạnh tranh, ấn định giá, phân chia thị trường', ['Các bên tham gia thỏa thuận là ai; thỏa thuận được lập khi nào, hình thức nào (văn bản, nhóm chat, họp)?', 'Nội dung thỏa thuận (giá, khách hàng, khu vực, bỏ thầu) và lợi ích từng bên?'])],
    dinhKhung: ['Có tổ chức', 'Thu lợi bất chính lớn', 'Gây thiệt hại lớn', 'Phạm tội 02 lần trở lên'],
    chuyenMon: ['dau-thau'],
  },
  {
    dieu: '217a', ten: 'Tội vi phạm quy định về kinh doanh theo phương thức đa cấp', nhom: 'canh-tranh', chuong: CH18,
    khachThe: 'Trật tự quản lý kinh doanh đa cấp', chuThe: 'Người từ đủ 16 tuổi', loi: 'Cố ý',
    dauHieu: ['Tổ chức hoạt động kinh doanh theo phương thức đa cấp mà không có giấy chứng nhận đăng ký hoặc không đúng nội dung đăng ký', 'Thu lợi bất chính, gây thiệt hại hoặc thu hút người tham gia theo mức luật định'],
    hanhVi: [hv('da-cap-bat-chinh', 'Tổ chức mạng lưới đa cấp không phép', ['Cơ cấu mạng lưới, chính sách hoa hồng, điều kiện tham gia (phải mua hàng, nộp tiền)?', 'Tổng số người tham gia, tổng tiền thu, số tiền chi trả hoa hồng?'])],
    dinhKhung: ['Có tổ chức', 'Thu lợi bất chính lớn', 'Gây thiệt hại lớn'],
    chuyenMon: ['tai-chinh'],
  },
  {
    dieu: '218', ten: 'Tội vi phạm quy định về hoạt động bán đấu giá tài sản', nhom: 'canh-tranh', chuong: CH18,
    khachThe: 'Trật tự quản lý hoạt động đấu giá tài sản', chuThe: 'Người tham gia, tổ chức đấu giá; người có thẩm quyền', loi: 'Cố ý',
    dauHieu: ['Thực hiện hành vi vi phạm: thông đồng, dìm giá, làm sai lệch hồ sơ, kết quả đấu giá…', 'Thu lợi bất chính hoặc gây thiệt hại theo mức luật định'],
    hanhVi: [hv('dim-gia', 'Thông đồng, dìm giá, cản trở người khác tham gia đấu giá', ['Ai tổ chức việc thông đồng; những người tham gia được hứa hẹn lợi ích gì để bỏ giá thấp/bỏ cuộc?', 'Giá trúng đấu giá so với giá khởi điểm và giá trị thực tế của tài sản?'])],
    dinhKhung: ['Có tổ chức', 'Lợi dụng chức vụ, quyền hạn', 'Thu lợi bất chính lớn'],
    chuyenMon: ['dau-thau', 'dat-dai'],
  },

  /* ===================== Đấu thầu ===================== */
  {
    dieu: '222', ten: 'Tội vi phạm quy định về đấu thầu gây hậu quả nghiêm trọng', nhom: 'dau-thau', chuong: CH18,
    khachThe: 'Trật tự quản lý nhà nước về đấu thầu; sự cạnh tranh, công bằng, minh bạch, hiệu quả trong lựa chọn nhà thầu',
    chuThe: 'Người có trách nhiệm trong hoạt động đấu thầu (chủ đầu tư, bên mời thầu, tổ chuyên gia, đơn vị thẩm định, nhà thầu…) hoặc người khác có hành vi vi phạm',
    loi: 'Cố ý',
    dauHieu: ['Thực hiện một trong các hành vi: can thiệp trái pháp luật vào hoạt động đấu thầu; thông thầu; gian lận trong đấu thầu; cản trở hoạt động đấu thầu; vi phạm quy định về bảo đảm công bằng, minh bạch; tổ chức lựa chọn nhà thầu khi nguồn vốn chưa được xác định; chuyển nhượng thầu trái phép', 'Gây thiệt hại từ 100 triệu đồng trở lên (hậu quả nghiêm trọng)', 'Có mối quan hệ nhân quả giữa hành vi vi phạm và thiệt hại'],
    hanhVi: [
      hv('can-thiep', 'Can thiệp trái pháp luật vào hoạt động đấu thầu', [
        'Ai đã tác động (gọi điện, gặp trực tiếp, “giới thiệu”) để một nhà thầu cụ thể được lựa chọn; nội dung, thời gian, địa điểm?',
        'Người can thiệp có chức vụ, quyền hạn gì đối với chủ đầu tư/bên mời thầu?',
        'Sau khi có sự tác động, quy trình lựa chọn nhà thầu đã bị điều chỉnh như thế nào?',
      ], ['Tin nhắn, ghi âm, lịch làm việc, sổ tiếp khách']),
      hv('thong-thau', 'Thông thầu (thỏa thuận rút thầu, bỏ giá, dàn xếp để một nhà thầu trúng)', [
        'Các nhà thầu tham dự quen biết, thỏa thuận với nhau từ khi nào; ai là người điều phối?',
        'Thỏa thuận cụ thể là gì: ai trúng, ai làm “quân xanh”, ai rút thầu, mức giá bỏ; nhà thầu không trúng được hưởng lợi gì?',
        'Hồ sơ dự thầu của các nhà thầu có do cùng một người/đơn vị soạn, nộp từ cùng máy tính, cùng địa chỉ IP không?',
      ], ['Hồ sơ dự thầu của tất cả nhà thầu tham dự', 'Dữ liệu IP, tài khoản nộp thầu trên mạng đấu thầu quốc gia']),
      hv('gian-lan', 'Gian lận trong đấu thầu (làm sai lệch thông tin, hồ sơ, kết quả)', [
        'Thông tin nào trong hồ sơ dự thầu không trung thực (năng lực, kinh nghiệm, nhân sự, thiết bị, hợp đồng tương tự)? Ai biết và chỉ đạo?',
        'Tổ chuyên gia có phát hiện những sai lệch này không; vì sao vẫn đánh giá đạt?',
        'Có việc làm lộ hồ sơ mời thầu, dự toán, giá gói thầu cho nhà thầu trước thời điểm phát hành không?',
      ]),
      hv('cai-dat-tieu-chi', 'Lập hồ sơ mời thầu với tiêu chí “cài cắm”, hạn chế nhà thầu', [
        'Tiêu chí nào trong hồ sơ mời thầu không cần thiết, chỉ một số nhà thầu đáp ứng; ai đề xuất đưa vào?',
        'Hồ sơ mời thầu được soạn thảo dựa trên tài liệu do nhà thầu nào cung cấp?',
      ]),
      hv('chia-nho-goi-thau', 'Chia nhỏ gói thầu, áp dụng sai hình thức chỉ định thầu', [
        'Gói thầu được chia như thế nào; mục đích chia nhỏ là gì; có để thuộc hạn mức chỉ định thầu không?',
        'Ai đề xuất, ai phê duyệt việc chia nhỏ và hình thức lựa chọn nhà thầu?',
      ]),
      hv('nang-gia', 'Nâng khống giá gói thầu, giá trúng thầu so với giá thị trường', [
        'Giá gói thầu được xây dựng dựa trên những báo giá nào; các đơn vị báo giá có liên quan tới nhà thầu trúng không?',
        'Chứng thư thẩm định giá có phản ánh đúng giá thị trường; đơn vị thẩm định giá có khảo sát thực tế không?',
        'Phần chênh lệch giữa giá trúng thầu và giá thực tế được phân chia cho những ai?',
      ]),
      hv('chuyen-nhuong-thau', 'Chuyển nhượng thầu trái phép', [
        'Sau khi trúng thầu, nhà thầu có tự thực hiện không hay giao lại cho đơn vị khác; tỷ lệ “phí” giữ lại?',
        'Chủ đầu tư có biết và chấp thuận việc chuyển nhượng không?',
      ]),
    ],
    dinhKhung: ['Vì vụ lợi', 'Có tổ chức', 'Lạm dụng chức vụ, quyền hạn', 'Dẫn đến phải hủy kết quả lựa chọn nhà thầu', 'Gây thiệt hại từ 1 tỷ đến dưới 3 tỷ đồng (khoản 2)', 'Gây thiệt hại từ 3 tỷ đồng trở lên (khoản 3)'],
    chuyenMon: ['dau-thau', 'tai-chinh', 'xay-dung', 'cong-vu'],
  },

  /* ===================== Tài sản công – đầu tư công ===================== */
  {
    dieu: '219', ten: 'Tội vi phạm quy định về quản lý, sử dụng tài sản nhà nước gây thất thoát, lãng phí', nhom: 'dau-tu-cong', chuong: CH18,
    khachThe: 'Chế độ quản lý, sử dụng tài sản nhà nước',
    chuThe: 'Người được giao quản lý, sử dụng tài sản nhà nước (chủ thể đặc biệt)', loi: 'Cố ý',
    dauHieu: ['Vi phạm quy định về quản lý, sử dụng tài sản nhà nước (giao, bán, cho thuê, liên doanh, định giá tài sản, đất công… trái quy định)', 'Gây thiệt hại từ 100 triệu đồng trở lên'],
    hanhVi: [
      hv('ban-tai-san-cong', 'Bán, chuyển nhượng, cho thuê tài sản công (nhà, đất) trái quy định, không qua đấu giá', ['Tài sản được xử lý theo hình thức nào; có phải đấu giá theo quy định không; ai quyết định hình thức?', 'Giá bán/cho thuê được xác định như thế nào; so với giá thị trường thấp hơn bao nhiêu?']),
      hv('dinh-gia-sai', 'Định giá tài sản nhà nước sai khi cổ phần hóa, góp vốn, liên doanh', ['Giá trị quyền sử dụng đất, lợi thế kinh doanh có được tính vào giá trị doanh nghiệp không?']),
      hv('su-dung-sai-muc-dich', 'Sử dụng tài sản công sai mục đích, vượt tiêu chuẩn, định mức', ['Tài sản được trang bị/sử dụng vượt định mức bao nhiêu; ai phê duyệt?']),
    ],
    dinhKhung: ['Vì vụ lợi', 'Có tổ chức', 'Dùng thủ đoạn tinh vi, xảo quyệt', 'Thiệt hại từ 1 tỷ đồng trở lên (các khoản tăng nặng)'],
    chuyenMon: ['tai-chinh', 'dat-dai', 'cong-vu'],
  },
  {
    dieu: '220', ten: 'Tội vi phạm quy định của Nhà nước về quản lý và sử dụng vốn đầu tư công gây hậu quả nghiêm trọng', nhom: 'dau-tu-cong', chuong: CH18,
    khachThe: 'Chế độ quản lý vốn đầu tư công', chuThe: 'Người có trách nhiệm trong quản lý, sử dụng vốn đầu tư công', loi: 'Cố ý',
    dauHieu: ['Quyết định chủ trương đầu tư không đúng thẩm quyền, không phù hợp quy hoạch; lập, thẩm định, phê duyệt dự án không đúng quy định; quyết định đầu tư khi chưa xác định nguồn vốn…', 'Gây thiệt hại từ 100 triệu đồng trở lên'],
    hanhVi: [hv('quyet-dinh-dau-tu-sai', 'Quyết định đầu tư, phê duyệt dự án trái quy định, khi chưa xác định nguồn vốn', ['Chủ trương đầu tư do cấp nào quyết định, có đúng thẩm quyền và trình tự không?', 'Dự án có trong kế hoạch đầu tư công trung hạn, đã được bố trí vốn chưa khi phê duyệt?', 'Dự án dở dang, kém hiệu quả gây thiệt hại thế nào?'])],
    dinhKhung: ['Vì vụ lợi', 'Có tổ chức', 'Thiệt hại từ 1 tỷ đồng trở lên (các khoản tăng nặng)'],
    chuyenMon: ['xay-dung', 'tai-chinh', 'cong-vu'],
  },
  {
    dieu: '221', ten: 'Tội vi phạm quy định của Nhà nước về kế toán gây hậu quả nghiêm trọng', nhom: 'dau-tu-cong', chuong: CH18,
    khachThe: 'Chế độ kế toán', chuThe: 'Người có trách nhiệm trong công tác kế toán (kế toán, kế toán trưởng, thủ trưởng đơn vị)', loi: 'Cố ý',
    dauHieu: ['Giả mạo, khai man, thỏa thuận hoặc ép buộc người khác giả mạo, khai man, tẩy xóa tài liệu kế toán; để ngoài sổ kế toán tài sản, nguồn vốn, kinh phí; hủy bỏ hoặc cố ý làm hư hỏng tài liệu kế toán…', 'Gây thiệt hại từ 100 triệu đồng trở lên hoặc thuộc trường hợp luật định'],
    hanhVi: [hv('so-sach-sai', 'Khai man, tẩy xóa, để ngoài sổ kế toán; hủy tài liệu kế toán', ['Tài liệu kế toán nào bị sửa chữa, hủy bỏ; ai yêu cầu, ai thực hiện, thời điểm?', 'Những tài sản, nguồn vốn nào không được phản ánh trên sổ kế toán?'])],
    dinhKhung: ['Vì vụ lợi', 'Có tổ chức', 'Lợi dụng chức vụ, quyền hạn', 'Thiệt hại lớn'],
    chuyenMon: ['tai-chinh'],
  },
  {
    dieu: '224', ten: 'Tội vi phạm quy định về đầu tư công trình xây dựng gây hậu quả nghiêm trọng', nhom: 'dau-tu-cong', chuong: CH18,
    khachThe: 'Chế độ quản lý đầu tư xây dựng', chuThe: 'Người có trách nhiệm trong hoạt động đầu tư xây dựng (chủ đầu tư, tư vấn, nhà thầu)', loi: 'Cố ý',
    dauHieu: ['Vi phạm quy định về đầu tư công trình xây dựng (lập, thẩm định, phê duyệt dự án, thiết kế, dự toán; nghiệm thu khống, thanh toán khống khối lượng…)', 'Gây thiệt hại từ 100 triệu đồng trở lên'],
    hanhVi: [
      hv('nghiem-thu-khong', 'Nghiệm thu, thanh toán khống khối lượng, sai chủng loại vật liệu', ['Khối lượng nghiệm thu so với thực tế thi công chênh lệch bao nhiêu? Ai ký biên bản nghiệm thu, có kiểm tra hiện trường không?', 'Phần giá trị thanh toán khống được sử dụng vào việc gì?']),
      hv('du-toan-sai', 'Lập, thẩm định dự toán sai định mức, đơn giá, tính trùng khối lượng', ['Định mức, đơn giá áp dụng có phù hợp; hạng mục nào bị tính trùng, tính sai?']),
    ],
    dinhKhung: ['Vì vụ lợi', 'Có tổ chức', 'Thiệt hại từ 1 tỷ đồng trở lên (các khoản tăng nặng)'],
    chuyenMon: ['xay-dung', 'tai-chinh'],
  },
  {
    dieu: '231', ten: 'Tội cố ý làm trái quy định của Nhà nước về phân phối tiền, hàng cứu trợ', nhom: 'dau-tu-cong', chuong: CH18,
    khachThe: 'Chế độ quản lý, phân phối tiền, hàng cứu trợ', chuThe: 'Người có chức vụ, quyền hạn trong việc phân phối tiền, hàng cứu trợ', loi: 'Cố ý',
    dauHieu: ['Lợi dụng chức vụ, quyền hạn cố ý làm trái quy định về phân phối tiền, hàng cứu trợ', 'Gây thiệt hại theo mức luật định hoặc gây ảnh hưởng xấu đến an ninh, trật tự'],
    hanhVi: [hv('phan-phoi-sai', 'Phân phối tiền, hàng cứu trợ sai đối tượng, sai định mức, giữ lại', ['Danh sách đối tượng được nhận do ai lập, có bình xét công khai không?', 'Số tiền, hàng thực nhận so với số được phân bổ; phần chênh lệch đi đâu?'])],
    dinhKhung: ['Có tổ chức', 'Gây thiệt hại lớn', 'Gây ảnh hưởng xấu đến an ninh, trật tự'],
    chuyenMon: ['cong-vu'],
  },

  /* ===================== Sở hữu trí tuệ ===================== */
  {
    dieu: '225', ten: 'Tội xâm phạm quyền tác giả, quyền liên quan', nhom: 'so-huu-tri-tue', chuong: CH18, phapNhan: true,
    khachThe: 'Quyền tác giả, quyền liên quan; trật tự quản lý sở hữu trí tuệ', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Không được phép của chủ thể quyền mà sao chép tác phẩm, bản ghi âm, ghi hình; phân phối, cung cấp đến công chúng', 'Thu lợi bất chính từ 50 triệu đồng trở lên, gây thiệt hại từ 100 triệu đồng trở lên hoặc hàng hóa vi phạm trị giá từ 100 triệu đồng trở lên'],
    hanhVi: [hv('sao-chep-lau', 'Sao chép, phát tán trái phép tác phẩm (phần mềm, phim, sách…)', ['Tác phẩm bị sao chép là gì, chủ sở hữu quyền là ai; số lượng bản sao, kênh phát tán?', 'Doanh thu thu được từ việc khai thác trái phép?'])],
    dinhKhung: ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Thu lợi bất chính lớn'],
    chuyenMon: ['so-huu-tri-tue'],
  },
  {
    dieu: '226', ten: 'Tội xâm phạm quyền sở hữu công nghiệp', nhom: 'so-huu-tri-tue', chuong: CH18, phapNhan: true,
    khachThe: 'Quyền sở hữu công nghiệp đối với nhãn hiệu, chỉ dẫn địa lý', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Cố ý xâm phạm quyền sở hữu công nghiệp đối với nhãn hiệu hoặc chỉ dẫn địa lý đang được bảo hộ tại Việt Nam, có quy mô thương mại', 'Thu lợi bất chính, gây thiệt hại hoặc hàng hóa vi phạm theo mức luật định'],
    hanhVi: [hv('gia-nhan-hieu', 'Sử dụng nhãn hiệu trùng/tương tự gây nhầm lẫn trên hàng hóa', ['Nhãn hiệu được bảo hộ theo văn bằng nào; dấu hiệu vi phạm trùng hay tương tự đến mức gây nhầm lẫn?', 'Quy mô sản xuất, kinh doanh hàng vi phạm?'])],
    dinhKhung: ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Thu lợi bất chính lớn'],
    chuyenMon: ['so-huu-tri-tue'],
  },

  /* ===================== Đất đai – tài nguyên ===================== */
  {
    dieu: '227', ten: 'Tội vi phạm các quy định về nghiên cứu, thăm dò, khai thác tài nguyên', nhom: 'dat-dai', chuong: CH18, phapNhan: true,
    khachThe: 'Chế độ quản lý tài nguyên khoáng sản, tài nguyên nước…', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Nghiên cứu, thăm dò, khai thác tài nguyên trong đất liền, hải đảo, nội thủy, lãnh hải… không có giấy phép hoặc sai nội dung giấy phép', 'Thu lợi bất chính hoặc khoáng sản trị giá theo mức luật định'],
    hanhVi: [
      hv('khai-thac-cat', 'Khai thác cát, sỏi, khoáng sản không phép hoặc vượt phạm vi, công suất', ['Vị trí khai thác (tọa độ), thời gian, phương tiện, khối lượng khai thác?', 'Giấy phép (nếu có) quy định phạm vi, công suất thế nào; vi phạm ở điểm nào?', 'Khoáng sản đã bán cho ai, giá bán, doanh thu?']),
    ],
    dinhKhung: ['Có tổ chức', 'Thu lợi bất chính lớn', 'Gây sạt lở, ảnh hưởng đến công trình, đời sống người dân'],
    chuyenMon: ['moi-truong', 'dat-dai'],
  },
  {
    dieu: '228', ten: 'Tội vi phạm các quy định về sử dụng đất đai', nhom: 'dat-dai', chuong: CH18,
    khachThe: 'Chế độ quản lý, sử dụng đất đai', chuThe: 'Người sử dụng đất từ đủ 16 tuổi', loi: 'Cố ý',
    dauHieu: ['Lấn chiếm đất, chuyển quyền sử dụng đất hoặc sử dụng đất trái với quy định của pháp luật', 'Đã bị xử phạt hành chính hoặc đã bị kết án về tội này chưa xóa án tích mà còn vi phạm'],
    hanhVi: [hv('lan-chiem', 'Lấn chiếm đất, xây dựng trái phép trên đất công, đất nông nghiệp', ['Diện tích lấn chiếm, loại đất, thời điểm; đã bị xử phạt hành chính lần nào?'])],
    dinhKhung: ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Tái phạm nguy hiểm'],
    chuyenMon: ['dat-dai'],
  },
  {
    dieu: '229', ten: 'Tội vi phạm các quy định về quản lý đất đai', nhom: 'dat-dai', chuong: CH18,
    khachThe: 'Chế độ quản lý nhà nước về đất đai', chuThe: 'Người có chức vụ, quyền hạn trong quản lý đất đai (chủ thể đặc biệt)', loi: 'Cố ý',
    dauHieu: ['Lợi dụng hoặc lạm quyền giao đất, thu hồi, cho thuê, cho phép chuyển quyền, chuyển mục đích sử dụng đất trái quy định', 'Đất trồng lúa từ 5.000 m² đến dưới 30.000 m², đất rừng/đất nông nghiệp khác, đất ở… theo mức luật định; hoặc đã bị xử lý kỷ luật mà còn vi phạm'],
    hanhVi: [
      hv('giao-dat-sai', 'Giao đất, cho thuê đất, chuyển mục đích sử dụng đất trái thẩm quyền, trái quy hoạch', ['Quyết định giao/cho thuê/chuyển mục đích do ai ký, căn cứ pháp lý? Có phù hợp quy hoạch, kế hoạch sử dụng đất không?', 'Có miễn, giảm, áp giá thu tiền sử dụng đất trái quy định không; thiệt hại cho ngân sách?']),
      hv('cap-gcn-sai', 'Cấp giấy chứng nhận quyền sử dụng đất sai đối tượng, sai diện tích', ['Hồ sơ cấp giấy có xác minh nguồn gốc đất, niêm yết công khai đầy đủ không; ai thẩm định, ai trình?']),
    ],
    dinhKhung: ['Có tổ chức', 'Diện tích đất lớn hoặc giá trị quyền sử dụng đất lớn', 'Phạm tội 02 lần trở lên'],
    chuyenMon: ['dat-dai', 'cong-vu'],
  },
  {
    dieu: '230', ten: 'Tội vi phạm quy định của Nhà nước về bồi thường, hỗ trợ, tái định cư khi Nhà nước thu hồi đất', nhom: 'dat-dai', chuong: CH18,
    khachThe: 'Chế độ bồi thường, hỗ trợ, tái định cư; quyền lợi người bị thu hồi đất', chuThe: 'Người có chức vụ, quyền hạn trong công tác bồi thường, hỗ trợ, tái định cư', loi: 'Cố ý',
    dauHieu: ['Lợi dụng chức vụ, quyền hạn làm trái quy định về bồi thường, hỗ trợ, tái định cư', 'Gây thiệt hại từ 100 triệu đồng trở lên hoặc thuộc trường hợp luật định'],
    hanhVi: [hv('kiem-dem-sai', 'Lập hồ sơ kiểm đếm, áp giá bồi thường khống, sai đối tượng', ['Biên bản kiểm đếm do ai lập; tài sản, cây trồng, vật kiến trúc được kê khai có tồn tại thực tế không?', 'Hộ được bồi thường có đủ điều kiện không; có quan hệ với người lập phương án không?'])],
    dinhKhung: ['Có tổ chức', 'Vì vụ lợi', 'Thiệt hại lớn'],
    chuyenMon: ['dat-dai', 'cong-vu'],
  },
];
