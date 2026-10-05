// Lĩnh vực MÔI TRƯỜNG — Chương XIX (Điều 235–246) và các tội về rừng, động vật hoang dã (Điều 232–234, Chương XVIII).
// Lĩnh vực Y TẾ – AN TOÀN CÔNG CỘNG — các tội về khám chữa bệnh, an toàn thực phẩm, an toàn lao động, xây dựng, PCCC
// và vi phạm quy tắc nghề nghiệp gây chết người/thương tích.
// Nguồn: Bộ luật Hình sự 2015 (sửa đổi, bổ sung 2017, 2025). Cần đối chiếu nguyên văn khi áp dụng.

const CH19 = 'Chương XIX — Các tội phạm về môi trường';
const CH18 = 'Chương XVIII — Các tội xâm phạm trật tự quản lý kinh tế';
const CH21 = 'Chương XXI — Các tội xâm phạm an toàn công cộng, trật tự công cộng';
const CH14 = 'Chương XIV — Các tội xâm phạm tính mạng, sức khỏe, nhân phẩm, danh dự của con người';
const hv = (id, ten, cauHoi = [], taiLieu = []) => ({ id, ten, cauHoi, taiLieu });

export const GROUPS_MOI_TRUONG = [
  { id: 'o-nhiem', ten: 'Ô nhiễm – chất thải', moTa: 'Gây ô nhiễm, chất thải nguy hại, sự cố môi trường, đưa chất thải vào lãnh thổ' },
  { id: 'rung', ten: 'Rừng – lâm sản', moTa: 'Khai thác, bảo vệ, quản lý rừng; hủy hoại rừng' },
  { id: 'sinh-vat', ten: 'Động vật hoang dã – đa dạng sinh học', moTa: 'Động vật nguy cấp, quý hiếm; khu bảo tồn; loài ngoại lai; nguồn lợi thủy sản' },
  { id: 'dich-benh-thien-tai', ten: 'Dịch bệnh – thiên tai – công trình thủy lợi', moTa: 'Lây lan dịch bệnh; đê điều, thủy lợi, phòng chống thiên tai' },
];

export const GROUPS_Y_TE = [
  { id: 'kham-chua-benh', ten: 'Khám chữa bệnh – dược', moTa: 'Vi phạm quy định khám chữa bệnh, bán thuốc; vi phạm quy tắc nghề nghiệp' },
  { id: 'thuc-pham', ten: 'An toàn thực phẩm', moTa: 'Vi phạm quy định về an toàn thực phẩm' },
  { id: 'an-toan-lao-dong', ten: 'An toàn lao động – xây dựng – PCCC', moTa: 'An toàn lao động, nơi đông người, xây dựng, phòng cháy chữa cháy' },
];

export const CRIMES_MOI_TRUONG = [
  {
    dieu: '235', ten: 'Tội gây ô nhiễm môi trường', nhom: 'o-nhiem', chuong: CH19, phapNhan: true,
    khachThe: 'Chế độ bảo vệ môi trường; sức khỏe cộng đồng',
    chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Chôn, lấp, đổ, thải ra môi trường chất thải rắn, nước thải, khí thải, chất phóng xạ… trái pháp luật', 'Khối lượng chất thải hoặc mức vượt quy chuẩn kỹ thuật đạt ngưỡng tại khoản 1 (theo từng loại chất thải, số lần vượt quy chuẩn)'],
    hanhVi: [
      hv('xa-nuoc-thai', 'Xả nước thải vượt quy chuẩn kỹ thuật ra môi trường', [
        'Lưu lượng nước thải xả ra mỗi ngày; thông số nào vượt quy chuẩn, vượt bao nhiêu lần?',
        'Hệ thống xử lý có vận hành tại thời điểm lấy mẫu không; ai chỉ đạo việc xả thải không qua xử lý?',
        'Có đường ống ngầm, cửa xả bí mật không; ai thiết kế, thi công, biết sự tồn tại của nó?',
      ]),
      hv('chon-lap-chat-thai', 'Chôn, lấp, đổ chất thải rắn trái phép', ['Chất thải là loại gì, khối lượng bao nhiêu, nguồn phát sinh từ đâu?', 'Ai thuê vận chuyển, đổ thải; giá thuê; địa điểm, thời gian đổ?']),
      hv('khi-thai', 'Thải khí thải, bụi vượt quy chuẩn', ['Nguồn phát thải, thiết bị xử lý khí thải; kết quả đo đạc vượt quy chuẩn bao nhiêu lần?']),
    ],
    dinhKhung: ['Có tổ chức', 'Cố ý thải chất thải nguy hại có thành phần đặc biệt nguy hiểm', 'Khối lượng chất thải/mức vượt quy chuẩn ở các ngưỡng khoản 2, 3', 'Gây thiệt hại về sức khỏe, tính mạng con người', 'Gây thiệt hại về tài sản'],
    chuyenMon: ['moi-truong'],
  },
  {
    dieu: '236', ten: 'Tội vi phạm quy định về quản lý chất thải nguy hại', nhom: 'o-nhiem', chuong: CH19,
    khachThe: 'Chế độ quản lý chất thải nguy hại', chuThe: 'Người có trách nhiệm trong quản lý chất thải nguy hại', loi: 'Cố ý',
    dauHieu: ['Vi phạm quy định về quản lý chất thải nguy hại (thu gom, vận chuyển, xử lý không có giấy phép, sai giấy phép…)', 'Khối lượng chất thải nguy hại theo ngưỡng luật định'],
    hanhVi: [hv('xu-ly-ctnh-sai', 'Thu gom, vận chuyển, xử lý chất thải nguy hại không phép, sai quy trình', ['Chất thải nguy hại phát sinh từ đâu, mã chất thải, khối lượng?', 'Chứng từ chất thải nguy hại có khớp với khối lượng thực tế chuyển giao không; đơn vị nhận có giấy phép xử lý không?'])],
    dinhKhung: ['Có tổ chức', 'Khối lượng lớn', 'Gây thiệt hại về sức khỏe, tài sản'],
    chuyenMon: ['moi-truong'],
  },
  {
    dieu: '237', ten: 'Tội vi phạm phòng ngừa, ứng phó, khắc phục sự cố môi trường', nhom: 'o-nhiem', chuong: CH19, phapNhan: true,
    khachThe: 'Chế độ phòng ngừa, ứng phó sự cố môi trường', chuThe: 'Cá nhân có trách nhiệm; pháp nhân thương mại', loi: 'Cố ý hoặc vô ý',
    dauHieu: ['Không xây dựng kế hoạch, biện pháp phòng ngừa; không ứng phó, khắc phục sự cố môi trường theo quy định', 'Làm môi trường bị ô nhiễm nghiêm trọng hoặc gây thiệt hại'],
    hanhVi: [hv('khong-ung-pho', 'Không thực hiện biện pháp phòng ngừa, ứng phó khi xảy ra sự cố', ['Kế hoạch ứng phó sự cố đã được lập, phê duyệt chưa? Khi sự cố xảy ra, ai được báo cáo, đã xử lý thế nào?'])],
    dinhKhung: ['Gây thiệt hại lớn', 'Làm chết người'],
    chuyenMon: ['moi-truong'],
  },
  {
    dieu: '238', ten: 'Tội vi phạm quy định về bảo vệ an toàn công trình thủy lợi, đê điều và phòng, chống thiên tai; vi phạm quy định về bảo vệ bờ, bãi sông', nhom: 'dich-benh-thien-tai', chuong: CH19, phapNhan: true,
    khachThe: 'An toàn công trình thủy lợi, đê điều; công tác phòng, chống thiên tai', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Xây dựng, khai thác, đổ thải… trái phép trong phạm vi bảo vệ công trình thủy lợi, đê điều; khai thác cát sỏi làm sạt lở bờ, bãi sông', 'Gây thiệt hại theo mức luật định'],
    hanhVi: [hv('xam-pham-de', 'Xâm phạm hành lang bảo vệ đê điều, công trình thủy lợi', ['Công trình/hoạt động vi phạm ở vị trí nào so với phạm vi bảo vệ; thời gian thực hiện?', 'Thiệt hại, nguy cơ đối với công trình đê điều, thủy lợi được đánh giá thế nào?'])],
    dinhKhung: ['Có tổ chức', 'Gây thiệt hại lớn', 'Làm chết người'],
    chuyenMon: ['xay-dung', 'moi-truong'],
  },
  {
    dieu: '239', ten: 'Tội đưa chất thải vào lãnh thổ Việt Nam', nhom: 'o-nhiem', chuong: CH19, phapNhan: true,
    khachThe: 'Chế độ bảo vệ môi trường, quản lý nhập khẩu', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Lợi dụng việc nhập khẩu công nghệ, máy móc, thiết bị, phế liệu, hóa chất… để đưa chất thải vào lãnh thổ Việt Nam', 'Khối lượng chất thải theo ngưỡng luật định'],
    hanhVi: [hv('nhap-phe-lieu', 'Nhập khẩu phế liệu không đạt quy chuẩn, chất thải trá hình', ['Lô hàng khai báo là gì, thực tế là gì; kết quả giám định thành phần?', 'Ai là người nhập khẩu, ai nhận hàng tiêu thụ trong nước?'])],
    dinhKhung: ['Có tổ chức', 'Chất thải nguy hại', 'Khối lượng lớn'],
    chuyenMon: ['moi-truong', 'hai-quan'],
  },
  {
    dieu: '240', ten: 'Tội làm lây lan dịch bệnh truyền nhiễm nguy hiểm cho người', nhom: 'dich-benh-thien-tai', chuong: CH19,
    khachThe: 'Sức khỏe cộng đồng; chế độ phòng chống dịch bệnh', chuThe: 'Người từ đủ 16 tuổi', loi: 'Cố ý hoặc vô ý',
    dauHieu: ['Đưa ra hoặc cho phép đưa ra khỏi vùng có dịch động vật, thực vật, sản phẩm có nguồn bệnh; đưa vào lãnh thổ VN mầm bệnh; hành vi khác làm lây lan dịch bệnh truyền nhiễm nguy hiểm cho người'],
    hanhVi: [hv('lay-lan-dich', 'Vi phạm quy định cách ly, khai báo y tế làm lây lan dịch bệnh', ['Người này biết mình thuộc diện cách ly/nhiễm bệnh từ khi nào; đã khai báo như thế nào?', 'Lộ trình di chuyển, những người đã tiếp xúc; số người bị lây nhiễm có mối liên hệ dịch tễ?'])],
    dinhKhung: ['Dẫn đến phải công bố dịch', 'Làm chết người'],
    chuyenMon: ['y-duoc'],
  },
  {
    dieu: '241', ten: 'Tội làm lây lan dịch bệnh nguy hiểm cho động vật, thực vật', nhom: 'dich-benh-thien-tai', chuong: CH19,
    khachThe: 'Chế độ phòng chống dịch bệnh động vật, thực vật', chuThe: 'Người từ đủ 16 tuổi', loi: 'Cố ý hoặc vô ý',
    dauHieu: ['Đưa vào/ra khỏi vùng dịch động vật, thực vật mang mầm bệnh; vi phạm quy định về kiểm dịch', 'Làm lây lan dịch bệnh gây thiệt hại theo luật định'],
    hanhVi: [hv('van-chuyen-dong-vat-benh', 'Vận chuyển, buôn bán động vật, sản phẩm động vật mắc bệnh ra khỏi vùng dịch', ['Nguồn gốc động vật, có giấy kiểm dịch không; vận chuyển đi đâu, bán cho ai?'])],
    dinhKhung: ['Gây thiệt hại lớn'],
    chuyenMon: ['thuc-pham'],
  },
  {
    dieu: '242', ten: 'Tội hủy hoại nguồn lợi thủy sản', nhom: 'sinh-vat', chuong: CH19, phapNhan: true,
    khachThe: 'Nguồn lợi thủy sản, môi trường sống của thủy sinh vật', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Sử dụng chất độc, chất nổ, xung điện, ngư cụ bị cấm hoặc khai thác trong khu vực cấm, mùa cấm…', 'Thu lợi bất chính, gây thiệt hại hoặc đã bị xử phạt mà còn vi phạm'],
    hanhVi: [hv('danh-bat-huy-diet', 'Đánh bắt bằng chất nổ, xung điện, chất độc; khai thác trong khu vực, mùa cấm', ['Phương tiện, ngư cụ sử dụng; khu vực, thời gian khai thác?', 'Sản lượng khai thác, đã bán cho ai, giá bao nhiêu?'])],
    dinhKhung: ['Có tổ chức', 'Thu lợi bất chính lớn', 'Gây thiệt hại lớn'],
    chuyenMon: ['rung-sinh-vat'],
  },
  {
    dieu: '243', ten: 'Tội hủy hoại rừng', nhom: 'rung', chuong: CH19, phapNhan: true,
    khachThe: 'Tài nguyên rừng, chế độ quản lý bảo vệ rừng', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Đốt, phá rừng trái pháp luật hoặc hành vi khác hủy hoại rừng', 'Diện tích rừng bị thiệt hại theo ngưỡng của từng loại rừng (sản xuất, phòng hộ, đặc dụng)'],
    hanhVi: [hv('pha-rung', 'Phát, đốt, chặt phá rừng để lấy đất canh tác, xây dựng', ['Diện tích, vị trí (tiểu khu, khoảnh, lô), loại rừng bị phá?', 'Ai chỉ đạo, thuê nhân công; mục đích sử dụng đất sau khi phá?'])],
    dinhKhung: ['Có tổ chức', 'Lợi dụng chức vụ, quyền hạn', 'Diện tích rừng bị thiệt hại lớn', 'Rừng đặc dụng, phòng hộ', 'Tái phạm nguy hiểm'],
    chuyenMon: ['rung-sinh-vat'],
  },
  {
    dieu: '244', ten: 'Tội vi phạm quy định về quản lý, bảo vệ động vật nguy cấp, quý, hiếm', nhom: 'sinh-vat', chuong: CH19, phapNhan: true,
    khachThe: 'Chế độ bảo vệ động vật nguy cấp, quý, hiếm; đa dạng sinh học', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Săn bắt, giết, nuôi, nhốt, vận chuyển, buôn bán trái phép động vật thuộc Danh mục loài nguy cấp, quý, hiếm được ưu tiên bảo vệ hoặc Phụ lục I CITES; ngà voi, sừng tê giác…', 'Không phụ thuộc số lượng đối với một số loài/sản phẩm; hoặc theo ngưỡng luật định'],
    hanhVi: [hv('buon-ban-dvhd', 'Buôn bán, vận chuyển, tàng trữ động vật nguy cấp, ngà voi, sừng tê giác', ['Loài, số lượng/khối lượng; nguồn gốc (săn bắt, nhập lậu)?', 'Đầu mối mua bán, giá cả, phương thức liên lạc (thường qua mạng xã hội)?'])],
    dinhKhung: ['Có tổ chức', 'Lợi dụng chức vụ, quyền hạn', 'Số lượng lớn', 'Vận chuyển, buôn bán qua biên giới', 'Tái phạm nguy hiểm'],
    chuyenMon: ['rung-sinh-vat', 'hai-quan'],
  },
  {
    dieu: '245', ten: 'Tội vi phạm các quy định về quản lý khu bảo tồn thiên nhiên', nhom: 'sinh-vat', chuong: CH19, phapNhan: true,
    khachThe: 'Chế độ quản lý khu bảo tồn thiên nhiên', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Vi phạm quy định về quản lý khu bảo tồn (xây dựng, khai thác, săn bắt… trong phân khu bảo vệ nghiêm ngặt)', 'Gây thiệt hại theo luật định'],
    hanhVi: [hv('xam-pham-khu-bao-ton', 'Xây dựng, khai thác trái phép trong khu bảo tồn', ['Hoạt động diễn ra ở phân khu nào; được phép của ai; thiệt hại đối với hệ sinh thái?'])],
    dinhKhung: ['Có tổ chức', 'Gây thiệt hại lớn'],
    chuyenMon: ['rung-sinh-vat'],
  },
  {
    dieu: '246', ten: 'Tội nhập khẩu, phát tán các loài ngoại lai xâm hại', nhom: 'sinh-vat', chuong: CH19, phapNhan: true,
    khachThe: 'Đa dạng sinh học; chế độ kiểm soát loài ngoại lai', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Nhập khẩu, phát tán loài ngoại lai xâm hại thuộc danh mục', 'Gây thiệt hại hoặc đã bị xử phạt mà còn vi phạm'],
    hanhVi: [hv('nhap-loai-ngoai-lai', 'Nhập khẩu, nuôi, phát tán loài ngoại lai xâm hại', ['Loài gì, số lượng, nguồn nhập; đã bán, thả ra môi trường ở đâu?'])],
    dinhKhung: ['Có tổ chức', 'Gây thiệt hại lớn'],
    chuyenMon: ['rung-sinh-vat'],
  },
  {
    dieu: '232', ten: 'Tội vi phạm các quy định về khai thác, bảo vệ rừng và quản lý lâm sản', nhom: 'rung', chuong: CH18, phapNhan: true,
    khachThe: 'Chế độ khai thác, bảo vệ rừng và quản lý lâm sản', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Khai thác trái phép cây rừng; tàng trữ, vận chuyển, chế biến, mua bán trái phép lâm sản', 'Khối lượng, giá trị lâm sản hoặc loài thực vật nguy cấp theo ngưỡng luật định'],
    hanhVi: [
      hv('khai-thac-go', 'Khai thác trái phép cây rừng', ['Vị trí, số cây, loại gỗ, khối lượng khai thác; công cụ, nhân công?', 'Ai thuê khai thác, ai tiêu thụ?']),
      hv('van-chuyen-lam-san', 'Vận chuyển, mua bán, chế biến lâm sản trái phép', ['Hồ sơ nguồn gốc lâm sản có hợp lệ không; lâm sản được hợp thức hóa bằng cách nào?']),
    ],
    dinhKhung: ['Có tổ chức', 'Lợi dụng chức vụ, quyền hạn', 'Khối lượng/giá trị lâm sản lớn', 'Thực vật nguy cấp, quý, hiếm', 'Tái phạm nguy hiểm'],
    chuyenMon: ['rung-sinh-vat'],
  },
  {
    dieu: '233', ten: 'Tội vi phạm các quy định về quản lý rừng', nhom: 'rung', chuong: CH18,
    khachThe: 'Chế độ quản lý nhà nước về rừng', chuThe: 'Người có chức vụ, quyền hạn trong quản lý rừng', loi: 'Cố ý',
    dauHieu: ['Lợi dụng chức vụ, quyền hạn giao rừng, thu hồi rừng, cho thuê rừng, chuyển mục đích sử dụng rừng trái pháp luật', 'Diện tích rừng theo ngưỡng luật định'],
    hanhVi: [hv('giao-rung-sai', 'Giao, cho thuê, chuyển mục đích sử dụng rừng trái thẩm quyền, trái quy hoạch', ['Quyết định do ai ký, căn cứ pháp lý, có phù hợp quy hoạch bảo vệ và phát triển rừng không?'])],
    dinhKhung: ['Có tổ chức', 'Diện tích rừng lớn', 'Rừng đặc dụng, phòng hộ'],
    chuyenMon: ['rung-sinh-vat', 'cong-vu'],
  },
  {
    dieu: '234', ten: 'Tội vi phạm quy định về quản lý, bảo vệ động vật hoang dã', nhom: 'sinh-vat', chuong: CH18, phapNhan: true,
    khachThe: 'Chế độ quản lý, bảo vệ động vật hoang dã', chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Săn bắt, giết, nuôi, nhốt, vận chuyển, buôn bán trái phép động vật rừng thông thường, động vật nguy cấp nhóm IIB, Phụ lục II CITES', 'Giá trị/số lượng theo ngưỡng luật định'],
    hanhVi: [hv('san-bat-dong-vat', 'Săn bắt, nuôi nhốt, buôn bán động vật hoang dã', ['Loài, số lượng, nguồn gốc; có hồ sơ nguồn gốc hợp pháp không?'])],
    dinhKhung: ['Có tổ chức', 'Lợi dụng chức vụ, quyền hạn', 'Giá trị lớn', 'Buôn bán qua biên giới'],
    chuyenMon: ['rung-sinh-vat'],
  },
];

export const CRIMES_Y_TE = [
  {
    dieu: '315', ten: 'Tội vi phạm quy định về khám bệnh, chữa bệnh, sản xuất, pha chế, cấp phát, bán thuốc hoặc dịch vụ y tế khác', nhom: 'kham-chua-benh', chuong: CH21,
    khachThe: 'Chế độ quản lý hoạt động khám chữa bệnh, dược; tính mạng, sức khỏe người bệnh',
    chuThe: 'Người hành nghề khám bệnh, chữa bệnh, dược hoặc dịch vụ y tế khác', loi: 'Vô ý (đối với hậu quả)',
    dauHieu: ['Vi phạm quy định về khám bệnh, chữa bệnh, sản xuất, pha chế, cấp phát, bán thuốc hoặc dịch vụ y tế khác', 'Gây hậu quả: làm chết người, gây thương tích/tổn hại sức khỏe với tỷ lệ luật định'],
    hanhVi: [
      hv('vi-pham-chuyen-mon', 'Vi phạm quy trình chuyên môn, phác đồ điều trị gây tai biến', [
        'Chẩn đoán ban đầu, chỉ định điều trị của bác sĩ là gì; có phù hợp phác đồ, hướng dẫn chuyên môn không?',
        'Trong quá trình theo dõi, các dấu hiệu bất thường được phát hiện khi nào; đã xử trí, hội chẩn, chuyển tuyến kịp thời chưa?',
        'Hồ sơ bệnh án có bị sửa chữa, bổ sung sau sự việc không?',
      ]),
      hv('vuot-pham-vi', 'Hành nghề không có chứng chỉ, vượt phạm vi chuyên môn, cơ sở không phép', ['Người thực hiện có chứng chỉ hành nghề và phạm vi chuyên môn phù hợp kỹ thuật đã làm không?', 'Cơ sở có giấy phép hoạt động và danh mục kỹ thuật được phê duyệt không?']),
      hv('ban-thuoc-sai', 'Pha chế, cấp phát, bán thuốc sai quy định (sai thuốc, không đơn, quá liều)', ['Đơn thuốc do ai kê; thuốc cấp phát/bán có đúng đơn, đúng liều không; ai trực tiếp cấp phát?']),
    ],
    dinhKhung: ['Làm chết 02 người trở lên', 'Gây thương tích, tổn hại sức khỏe cho nhiều người với tỷ lệ tổn thương cao'],
    chuyenMon: ['y-duoc'],
  },
  {
    dieu: '129', ten: 'Tội vô ý làm chết người do vi phạm quy tắc nghề nghiệp hoặc quy tắc hành chính', nhom: 'kham-chua-benh', chuong: CH14,
    khachThe: 'Quyền được tôn trọng và bảo vệ về tính mạng', chuThe: 'Người có nghề nghiệp/được giao nhiệm vụ phải tuân thủ quy tắc nghề nghiệp, quy tắc hành chính', loi: 'Vô ý',
    dauHieu: ['Vi phạm quy tắc nghề nghiệp hoặc quy tắc hành chính', 'Hậu quả chết người', 'Mối quan hệ nhân quả giữa vi phạm và cái chết'],
    hanhVi: [hv('vi-pham-quy-tac', 'Vi phạm quy tắc nghề nghiệp dẫn đến chết người', ['Quy tắc nghề nghiệp/quy tắc hành chính bị vi phạm là gì, được quy định ở đâu?', 'Người vi phạm có được đào tạo, phổ biến quy tắc đó không; vì sao không tuân thủ?', 'Kết luận giám định pháp y về nguyên nhân chết có liên quan trực tiếp đến vi phạm không?'])],
    dinhKhung: ['Làm chết 02 người trở lên'],
    chuyenMon: ['y-duoc', 'lao-dong-pccc'],
  },
  {
    dieu: '139', ten: 'Tội vô ý gây thương tích hoặc gây tổn hại cho sức khỏe của người khác do vi phạm quy tắc nghề nghiệp hoặc quy tắc hành chính', nhom: 'kham-chua-benh', chuong: CH14,
    khachThe: 'Quyền được tôn trọng và bảo vệ về sức khỏe', chuThe: 'Người có nghề nghiệp/được giao nhiệm vụ phải tuân thủ quy tắc', loi: 'Vô ý',
    dauHieu: ['Vi phạm quy tắc nghề nghiệp hoặc quy tắc hành chính', 'Gây thương tích hoặc tổn hại sức khỏe với tỷ lệ tổn thương cơ thể từ mức luật định trở lên'],
    hanhVi: [hv('gay-thuong-tich-nghe-nghiep', 'Vi phạm quy tắc nghề nghiệp gây thương tích', ['Vi phạm cụ thể; tỷ lệ tổn thương cơ thể theo kết luận giám định?'])],
    dinhKhung: ['Gây thương tích cho nhiều người', 'Tỷ lệ tổn thương cao'],
    chuyenMon: ['y-duoc'],
  },
  {
    dieu: '317', ten: 'Tội vi phạm quy định về an toàn thực phẩm', nhom: 'thuc-pham', chuong: CH21, phapNhan: true,
    khachThe: 'Chế độ quản lý an toàn thực phẩm; sức khỏe, tính mạng người tiêu dùng',
    chuThe: 'Cá nhân từ đủ 16 tuổi; pháp nhân thương mại', loi: 'Cố ý',
    dauHieu: ['Sử dụng chất cấm trong sản xuất, chế biến thực phẩm; sử dụng hóa chất, phụ gia ngoài danh mục; chế biến thực phẩm từ động vật chết do bệnh, không rõ nguồn gốc…', 'Không phụ thuộc hậu quả đối với một số hành vi; hoặc gây ngộ độc, thương tích, chết người'],
    hanhVi: [
      hv('chat-cam', 'Sử dụng chất cấm, hóa chất ngoài danh mục trong sản xuất, chế biến, bảo quản thực phẩm', ['Chất cấm/hóa chất gì, mua ở đâu, sử dụng với liều lượng nào, trong khâu nào?', 'Sản phẩm đã bán ra bao nhiêu, cho ai?']),
      hv('ngo-doc', 'Cung cấp thực phẩm không bảo đảm an toàn gây ngộ độc', ['Số người bị ngộ độc, triệu chứng; kết quả xét nghiệm mẫu thực phẩm và mẫu bệnh phẩm?', 'Quy trình chế biến, bảo quản tại cơ sở; ai chịu trách nhiệm?']),
    ],
    dinhKhung: ['Có tổ chức', 'Gây ngộ độc cho nhiều người', 'Làm chết người', 'Thực phẩm có giá trị lớn', 'Thu lợi bất chính lớn'],
    chuyenMon: ['thuc-pham'],
  },
  {
    dieu: '295', ten: 'Tội vi phạm quy định về an toàn lao động, vệ sinh lao động, về an toàn ở những nơi đông người', nhom: 'an-toan-lao-dong', chuong: CH21,
    khachThe: 'An toàn công cộng; tính mạng, sức khỏe người lao động và người khác',
    chuThe: 'Người có trách nhiệm về an toàn lao động, vệ sinh lao động, an toàn ở nơi đông người', loi: 'Vô ý (đối với hậu quả)',
    dauHieu: ['Vi phạm quy định về an toàn lao động, vệ sinh lao động, an toàn ở những nơi đông người', 'Gây hậu quả: làm chết người, gây thương tích với tỷ lệ luật định hoặc thiệt hại tài sản từ 100 triệu đồng trở lên'],
    hanhVi: [hv('vi-pham-atld', 'Không trang bị bảo hộ, không huấn luyện, để thiết bị không an toàn hoạt động', ['Người có trách nhiệm về an toàn tại nơi xảy ra tai nạn là ai, nhiệm vụ cụ thể?', 'Biện pháp an toàn nào bắt buộc nhưng không được thực hiện; đã có kiến nghị khắc phục trước đó chưa?', 'Kết luận điều tra tai nạn lao động về nguyên nhân và trách nhiệm?'])],
    dinhKhung: ['Làm chết 02 người trở lên', 'Gây thiệt hại tài sản lớn'],
    chuyenMon: ['lao-dong-pccc'],
  },
  {
    dieu: '298', ten: 'Tội vi phạm quy định về xây dựng gây hậu quả nghiêm trọng', nhom: 'an-toan-lao-dong', chuong: CH21,
    khachThe: 'An toàn công cộng trong hoạt động xây dựng', chuThe: 'Người có trách nhiệm trong khảo sát, thiết kế, thi công, giám sát, nghiệm thu, sử dụng công trình', loi: 'Vô ý (đối với hậu quả)',
    dauHieu: ['Vi phạm quy định về xây dựng trong lĩnh vực khảo sát, thiết kế, thi công, sử dụng nguyên liệu, vật liệu, máy móc, giám sát, nghiệm thu công trình', 'Gây hậu quả: làm chết người, gây thương tích hoặc thiệt hại tài sản từ 100 triệu đồng trở lên'],
    hanhVi: [hv('su-co-cong-trinh', 'Vi phạm kỹ thuật dẫn đến sập đổ, sự cố công trình', ['Sự cố xảy ra ở hạng mục nào; nguyên nhân kỹ thuật theo kết luận giám định?', 'Ai chịu trách nhiệm về thiết kế, thi công, giám sát hạng mục đó; đã làm đúng quy chuẩn chưa?'])],
    dinhKhung: ['Làm chết 02 người trở lên', 'Gây thiệt hại tài sản lớn'],
    chuyenMon: ['xay-dung', 'lao-dong-pccc'],
  },
  {
    dieu: '313', ten: 'Tội vi phạm quy định về phòng cháy, chữa cháy', nhom: 'an-toan-lao-dong', chuong: CH21,
    khachThe: 'An toàn công cộng; chế độ phòng cháy, chữa cháy', chuThe: 'Người có trách nhiệm về PCCC (chủ cơ sở, người quản lý, người được giao nhiệm vụ)', loi: 'Vô ý (đối với hậu quả)',
    dauHieu: ['Vi phạm quy định về phòng cháy, chữa cháy', 'Gây hậu quả: làm chết người, gây thương tích hoặc thiệt hại tài sản theo mức luật định'],
    hanhVi: [hv('vi-pham-pccc', 'Không bảo đảm điều kiện PCCC, không khắc phục kiến nghị, vi phạm quy định sử dụng lửa, điện', ['Cơ sở có hồ sơ thẩm duyệt, nghiệm thu PCCC không; đã được cơ quan chức năng kiến nghị những gì, khắc phục chưa?', 'Nguyên nhân cháy theo kết luận giám định; điểm xuất phát cháy?', 'Hệ thống báo cháy, chữa cháy, lối thoát nạn có hoạt động khi xảy ra cháy không?'])],
    dinhKhung: ['Làm chết 02 người trở lên', 'Gây thiệt hại tài sản lớn'],
    chuyenMon: ['lao-dong-pccc'],
  },
];
