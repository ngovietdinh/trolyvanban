// Lĩnh vực CHỨC VỤ – THAM NHŨNG — Chương XXIII "Các tội phạm về chức vụ" (Điều 352–366).
// Nguồn: Bộ luật Hình sự 2015 (sửa đổi, bổ sung 2017, 2025). Cần đối chiếu nguyên văn khi áp dụng.

const CH23 = 'Chương XXIII — Các tội phạm về chức vụ';
const hv = (id, ten, cauHoi = [], taiLieu = []) => ({ id, ten, cauHoi, taiLieu });
const CHU_THE_CV = 'Người có chức vụ, quyền hạn (Điều 352): người do bổ nhiệm, bầu cử, hợp đồng hoặc hình thức khác, có hưởng lương hoặc không, được giao thực hiện nhiệm vụ nhất định và có quyền hạn nhất định khi thực hiện công vụ, nhiệm vụ';

export const GROUPS_CHUC_VU = [
  { id: 'tham-nhung', ten: 'Tội phạm tham nhũng (Mục 1)', moTa: 'Tham ô, nhận hối lộ, lạm dụng, lợi dụng chức vụ, lạm quyền, trục lợi' },
  { id: 'chuc-vu-khac', ten: 'Tội phạm khác về chức vụ (Mục 2)', moTa: 'Giả mạo trong công tác, thiếu trách nhiệm, đưa – môi giới hối lộ, bí mật công tác' },
];

export const CRIMES_CHUC_VU = [
  {
    dieu: '353', ten: 'Tội tham ô tài sản', nhom: 'tham-nhung', chuong: CH23,
    khachThe: 'Hoạt động đúng đắn của cơ quan, tổ chức; quyền sở hữu tài sản do người phạm tội có trách nhiệm quản lý',
    chuThe: CHU_THE_CV + '; có trách nhiệm quản lý đối với tài sản bị chiếm đoạt. Áp dụng cả trong doanh nghiệp, tổ chức ngoài nhà nước (khoản 6)',
    loi: 'Cố ý trực tiếp, mục đích chiếm đoạt',
    ghiChu: 'Luật 86/2025/QH15 (hiệu lực 01/7/2025) bỏ hình phạt tử hình; người bị kết án tù chung thân phải nộp lại ít nhất 3/4 tài sản tham ô và hợp tác tích cực để được xét giảm.',
    dauHieu: ['Người có chức vụ, quyền hạn lợi dụng chức vụ, quyền hạn chiếm đoạt tài sản mà mình có trách nhiệm quản lý', 'Tài sản trị giá từ 2 triệu đồng trở lên (hoặc dưới 2 triệu thuộc trường hợp luật định: đã bị xử lý kỷ luật, đã bị kết án về tội tham nhũng chưa xóa án tích…)', 'Thời điểm và căn cứ phát sinh trách nhiệm quản lý tài sản'],
    hanhVi: [
      hv('chi-khong', 'Lập chứng từ chi khống, chi sai để rút tiền chiếm đoạt', [
        'Những chứng từ chi nào không có nội dung kinh tế thực tế; ai lập, ai ký duyệt, ai nhận tiền?',
        'Số tiền rút ra được chuyển cho ai, sử dụng vào việc gì?',
      ]),
      hv('thu-khong-nhap-quy', 'Thu tiền nhưng không nhập quỹ, không hạch toán', ['Các khoản thu nào không được nộp vào quỹ; thời gian, số tiền, người nộp?', 'Có biên lai, phiếu thu viết tay hay sử dụng biên lai không đúng quy định không?']),
      hv('chiem-doat-tai-san-giu', 'Chiếm đoạt tiền, hàng, vật tư đang được giao quản lý (thủ quỹ, thủ kho, kế toán)', ['Phạm vi tài sản được giao quản lý theo văn bản nào; biên bản bàn giao, kiểm kê gần nhất?', 'Số tài sản thiếu hụt khi kiểm kê; người quản lý giải trình như thế nào?']),
      hv('khai-tang-chi-phi', 'Nâng khống giá mua sắm, kê khống chi phí để chiếm đoạt phần chênh lệch', ['Giá thanh toán so với giá thực tế mua vào chênh lệch bao nhiêu; ai hưởng phần chênh lệch?']),
    ],
    dinhKhung: ['Có tổ chức', 'Dùng thủ đoạn xảo quyệt, nguy hiểm', 'Phạm tội 02 lần trở lên', 'Chiếm đoạt từ 100 triệu đến dưới 500 triệu đồng (khoản 2)', 'Chiếm đoạt từ 500 triệu đến dưới 1 tỷ đồng (khoản 3)', 'Chiếm đoạt từ 1 tỷ đồng trở lên (khoản 4)', 'Chiếm đoạt tiền, tài sản dùng vào mục đích xóa đói giảm nghèo, ủng hộ thiên tai, dịch bệnh; tiền phụ cấp, trợ cấp, ưu đãi đối với người có công', 'Gây thiệt hại về tài sản', 'Ảnh hưởng xấu đến đời sống của cán bộ, công chức, người lao động', 'Dẫn đến doanh nghiệp, tổ chức bị phá sản hoặc ngừng hoạt động'],
    chuyenMon: ['tai-chinh', 'cong-vu'],
  },
  {
    dieu: '354', ten: 'Tội nhận hối lộ', nhom: 'tham-nhung', chuong: CH23,
    khachThe: 'Hoạt động đúng đắn, uy tín của cơ quan, tổ chức',
    chuThe: CHU_THE_CV + '. Áp dụng cả trong doanh nghiệp, tổ chức ngoài nhà nước (khoản 6)',
    loi: 'Cố ý trực tiếp, vụ lợi',
    ghiChu: 'Luật 86/2025/QH15 (hiệu lực 01/7/2025) bỏ hình phạt tử hình đối với tội này.',
    dauHieu: ['Lợi dụng chức vụ, quyền hạn trực tiếp hoặc qua trung gian nhận (hoặc sẽ nhận) lợi ích', 'Lợi ích vật chất (tiền, tài sản, lợi ích vật chất khác) từ 2 triệu đồng trở lên, hoặc lợi ích phi vật chất', 'Để làm hoặc không làm một việc vì lợi ích hoặc theo yêu cầu của người đưa hối lộ'],
    hanhVi: [
      hv('nhan-tien', 'Nhận tiền, tài sản để giải quyết công việc theo yêu cầu người đưa', [
        'Người đưa hối lộ đặt vấn đề gì, vào thời gian nào, ở đâu, có ai chứng kiến?',
        'Số tiền/lợi ích là bao nhiêu, giao nhận bằng hình thức nào (trực tiếp, chuyển khoản, qua người thân, “quà”)?',
        'Sau khi nhận, công việc đã được giải quyết như thế nào; việc giải quyết có trái quy định không?',
      ]),
      hv('qua-trung-gian', 'Nhận hối lộ qua trung gian (người thân, cấp dưới, “cò”)', ['Người trung gian là ai, quan hệ thế nào; đã nhận bao nhiêu, chuyển lại bao nhiêu?', 'Người có chức vụ có biết và đồng ý với việc trung gian nhận tiền không?']),
      hv('phi-vat-chat', 'Nhận lợi ích phi vật chất (quan hệ tình dục, cơ hội thăng tiến, du lịch…)', ['Lợi ích phi vật chất cụ thể là gì; mối liên hệ với công việc được giải quyết?']),
      hv('sach-nhieu', 'Đòi hối lộ, sách nhiễu, gây khó khăn để buộc người khác đưa tiền', ['Những khó khăn, yêu cầu trái quy định nào được đặt ra cho người dân, doanh nghiệp?', 'Ai đặt vấn đề về tiền trước, nội dung cụ thể?']),
    ],
    dinhKhung: ['Có tổ chức', 'Lạm dụng chức vụ, quyền hạn', 'Phạm tội 02 lần trở lên', 'Biết rõ của hối lộ là tài sản của Nhà nước', 'Đòi hối lộ, sách nhiễu hoặc dùng thủ đoạn xảo quyệt', 'Của hối lộ trị giá từ 100 triệu đến dưới 500 triệu đồng (khoản 2)', 'Của hối lộ trị giá từ 500 triệu đến dưới 1 tỷ đồng (khoản 3)', 'Của hối lộ trị giá từ 1 tỷ đồng trở lên (khoản 4)', 'Gây thiệt hại về tài sản'],
    chuyenMon: ['cong-vu', 'tai-chinh'],
  },
  {
    dieu: '355', ten: 'Tội lạm dụng chức vụ, quyền hạn chiếm đoạt tài sản', nhom: 'tham-nhung', chuong: CH23,
    khachThe: 'Hoạt động đúng đắn của cơ quan, tổ chức; quyền sở hữu tài sản của người khác',
    chuThe: CHU_THE_CV + '; không có trách nhiệm quản lý tài sản bị chiếm đoạt (phân biệt với tham ô)',
    loi: 'Cố ý trực tiếp, mục đích chiếm đoạt',
    dauHieu: ['Vượt quá chức vụ, quyền hạn của mình để chiếm đoạt tài sản của người khác', 'Tài sản trị giá từ 2 triệu đồng trở lên hoặc thuộc trường hợp luật định'],
    hanhVi: [hv('ep-buoc-nop-tien', 'Lợi dụng vị trí công tác ép buộc, gian dối để chiếm đoạt tài sản của người dân, doanh nghiệp', ['Người bị chiếm đoạt đã giao tài sản trong hoàn cảnh nào; có bị đe dọa, ép buộc không?', 'Chức vụ, quyền hạn của người phạm tội liên quan thế nào tới công việc của người bị hại?'])],
    dinhKhung: ['Có tổ chức', 'Dùng thủ đoạn xảo quyệt, nguy hiểm', 'Phạm tội 02 lần trở lên', 'Chiếm đoạt tài sản trị giá lớn', 'Gây thiệt hại về tài sản'],
    chuyenMon: ['cong-vu'],
  },
  {
    dieu: '356', ten: 'Tội lợi dụng chức vụ, quyền hạn trong khi thi hành công vụ', nhom: 'tham-nhung', chuong: CH23,
    khachThe: 'Hoạt động đúng đắn của cơ quan, tổ chức',
    chuThe: CHU_THE_CV, loi: 'Cố ý; vì vụ lợi hoặc động cơ cá nhân khác',
    dauHieu: ['Vì vụ lợi hoặc động cơ cá nhân khác mà lợi dụng chức vụ, quyền hạn làm trái công vụ', 'Gây thiệt hại về tài sản từ 10 triệu đồng trở lên hoặc gây thiệt hại khác đến lợi ích của Nhà nước, quyền, lợi ích hợp pháp của tổ chức, cá nhân', 'Động cơ vụ lợi/động cơ cá nhân khác phải được chứng minh'],
    hanhVi: [
      hv('lam-trai-cong-vu', 'Ký, ban hành văn bản, quyết định trái quy định (giao dự án, cấp phép, phê duyệt)', [
        'Quy định nào đã bị làm trái; người thực hiện có biết quy định đó không?',
        'Vì sao lại ký/tham mưu như vậy; có lợi ích gì cho bản thân, người thân hoặc “nhóm lợi ích” không?',
        'Thiệt hại cụ thể cho Nhà nước, tổ chức, cá nhân là gì, bao nhiêu?',
      ]),
      hv('bo-qua-sai-pham', 'Cố ý bỏ qua sai phạm khi thanh tra, kiểm tra, giám sát', ['Sai phạm nào đã được phát hiện nhưng không xử lý; lý do?']),
    ],
    dinhKhung: ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Gây thiệt hại về tài sản từ 200 triệu đồng trở lên (các khoản tăng nặng)'],
    chuyenMon: ['cong-vu'],
  },
  {
    dieu: '357', ten: 'Tội lạm quyền trong khi thi hành công vụ', nhom: 'tham-nhung', chuong: CH23,
    khachThe: 'Hoạt động đúng đắn của cơ quan, tổ chức', chuThe: CHU_THE_CV, loi: 'Cố ý; vì vụ lợi hoặc động cơ cá nhân khác',
    dauHieu: ['Vượt quá quyền hạn của mình làm trái công vụ', 'Gây thiệt hại về tài sản từ 10 triệu đồng trở lên hoặc thiệt hại khác'],
    hanhVi: [hv('vuot-quyen', 'Quyết định, xử lý vượt thẩm quyền được giao', ['Thẩm quyền của người này theo quy định đến đâu; việc đã làm vượt ra ngoài thẩm quyền ở điểm nào?', 'Vì sao không trình cấp có thẩm quyền; có chỉ đạo của ai không?'])],
    dinhKhung: ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Gây thiệt hại lớn'],
    chuyenMon: ['cong-vu'],
  },
  {
    dieu: '358', ten: 'Tội lợi dụng chức vụ, quyền hạn gây ảnh hưởng đối với người khác để trục lợi', nhom: 'tham-nhung', chuong: CH23,
    khachThe: 'Hoạt động đúng đắn của cơ quan, tổ chức', chuThe: CHU_THE_CV, loi: 'Cố ý, vụ lợi',
    dauHieu: ['Lợi dụng chức vụ, quyền hạn trực tiếp hoặc qua trung gian nhận lợi ích', 'Để dùng ảnh hưởng của mình thúc đẩy người có chức vụ quyền hạn khác làm hoặc không làm một việc thuộc trách nhiệm của họ'],
    hanhVi: [hv('chay-viec', 'Nhận tiền để tác động, “chạy” việc với người có thẩm quyền khác', ['Người nhận tiền đã tác động tới ai, bằng cách nào; người được tác động có thẩm quyền gì?', 'Số tiền nhận, đã chuyển cho ai phần nào?'])],
    dinhKhung: ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Lợi ích trị giá lớn'],
    chuyenMon: ['cong-vu'],
  },
  {
    dieu: '359', ten: 'Tội giả mạo trong công tác', nhom: 'chuc-vu-khac', chuong: CH23,
    khachThe: 'Hoạt động đúng đắn của cơ quan, tổ chức; tính xác thực của giấy tờ, tài liệu', chuThe: CHU_THE_CV, loi: 'Cố ý; vì vụ lợi hoặc động cơ cá nhân khác',
    dauHieu: ['Lợi dụng chức vụ, quyền hạn: sửa chữa, làm sai lệch nội dung giấy tờ; làm, cấp giấy tờ giả; giả mạo chữ ký của người có chức vụ'],
    hanhVi: [hv('lam-gia-giay-to', 'Làm, cấp giấy tờ giả; sửa chữa hồ sơ, giả chữ ký', ['Giấy tờ nào bị làm giả/sửa chữa, ai làm, sử dụng con dấu thật hay giả?', 'Giấy tờ giả được cấp cho ai, để làm gì, có thu tiền không?'])],
    dinhKhung: ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Làm, cấp giấy tờ giả với số lượng lớn', 'Để thực hiện tội phạm khác'],
    chuyenMon: ['cong-vu'],
  },
  {
    dieu: '360', ten: 'Tội thiếu trách nhiệm gây hậu quả nghiêm trọng', nhom: 'chuc-vu-khac', chuong: CH23,
    khachThe: 'Hoạt động đúng đắn của cơ quan, tổ chức', chuThe: CHU_THE_CV, loi: 'Vô ý',
    dauHieu: ['Người có chức vụ, quyền hạn vì thiếu trách nhiệm mà không thực hiện hoặc thực hiện không đúng nhiệm vụ được giao', 'Gây hậu quả: làm chết người, gây thương tích, hoặc thiệt hại về tài sản từ 100 triệu đồng trở lên', 'Không thuộc trường hợp tại các điều luật chuyên biệt (179, 308, 376)'],
    hanhVi: [
      hv('buong-long-quan-ly', 'Buông lỏng quản lý, không kiểm tra, giám sát theo nhiệm vụ', ['Nhiệm vụ cụ thể được giao là gì, theo văn bản nào?', 'Người này đã thực hiện nhiệm vụ đó như thế nào; nếu thực hiện đúng có ngăn chặn được hậu quả không?']),
      hv('ky-duyet-khong-kiem-tra', 'Ký duyệt hồ sơ, chứng từ mà không kiểm tra theo quy trình', ['Khi ký, người này có kiểm tra hồ sơ không; vì sao không phát hiện sai sót?']),
    ],
    dinhKhung: ['Làm chết 02 người trở lên', 'Gây thiệt hại về tài sản từ 500 triệu đồng trở lên (các khoản tăng nặng)'],
    chuyenMon: ['cong-vu', 'tai-chinh'],
  },
  {
    dieu: '361', ten: 'Tội cố ý làm lộ bí mật công tác; chiếm đoạt, mua bán, tiêu hủy tài liệu bí mật công tác', nhom: 'chuc-vu-khac', chuong: CH23,
    khachThe: 'Chế độ bảo vệ bí mật công tác', chuThe: CHU_THE_CV, loi: 'Cố ý',
    dauHieu: ['Cố ý làm lộ bí mật công tác hoặc chiếm đoạt, mua bán, tiêu hủy tài liệu bí mật công tác', 'Gây thiệt hại theo luật định (nếu không thuộc trường hợp tội xâm phạm an ninh quốc gia)'],
    hanhVi: [hv('lo-bi-mat', 'Tiết lộ, cung cấp thông tin, tài liệu mật cho người không có trách nhiệm', ['Tài liệu/thông tin nào bị làm lộ; độ mật; người này được tiếp cận trong phạm vi nào?', 'Cung cấp cho ai, bằng cách nào, nhận lợi ích gì?'])],
    dinhKhung: ['Có tổ chức', 'Lợi dụng chức vụ, quyền hạn', 'Gây hậu quả nghiêm trọng'],
    chuyenMon: ['cong-vu'],
  },
  {
    dieu: '362', ten: 'Tội vô ý làm lộ bí mật công tác; tội làm mất tài liệu bí mật công tác', nhom: 'chuc-vu-khac', chuong: CH23,
    khachThe: 'Chế độ bảo vệ bí mật công tác', chuThe: CHU_THE_CV, loi: 'Vô ý',
    dauHieu: ['Vô ý làm lộ hoặc làm mất tài liệu bí mật công tác', 'Gây hậu quả nghiêm trọng'],
    hanhVi: [hv('mat-tai-lieu', 'Làm mất, để lộ tài liệu mật do sơ suất', ['Tài liệu được bảo quản thế nào theo quy định; người này đã vi phạm quy trình nào dẫn đến mất/lộ?'])],
    dinhKhung: ['Gây hậu quả rất nghiêm trọng'],
    chuyenMon: ['cong-vu'],
  },
  {
    dieu: '363', ten: 'Tội đào nhiệm', nhom: 'chuc-vu-khac', chuong: CH23,
    khachThe: 'Hoạt động đúng đắn của cơ quan, tổ chức', chuThe: 'Cán bộ, công chức, viên chức', loi: 'Cố ý',
    dauHieu: ['Cố ý từ bỏ nhiệm vụ công tác', 'Gây hậu quả nghiêm trọng'],
    hanhVi: [hv('bo-nhiem-vu', 'Tự ý bỏ nhiệm vụ được giao', ['Thời điểm bỏ nhiệm vụ, lý do; hậu quả phát sinh?'])],
    dinhKhung: ['Lôi kéo người khác đào nhiệm', 'Trong hoàn cảnh chiến tranh, thiên tai, dịch bệnh'],
    chuyenMon: ['cong-vu'],
  },
  {
    dieu: '364', ten: 'Tội đưa hối lộ', nhom: 'chuc-vu-khac', chuong: CH23,
    khachThe: 'Hoạt động đúng đắn của cơ quan, tổ chức', chuThe: 'Người từ đủ 16 tuổi; áp dụng cả với việc đưa hối lộ cho người có chức vụ trong doanh nghiệp ngoài nhà nước, công chức nước ngoài', loi: 'Cố ý',
    dauHieu: ['Trực tiếp hay qua trung gian đã đưa hoặc sẽ đưa lợi ích cho người có chức vụ, quyền hạn để họ làm hoặc không làm một việc vì lợi ích hoặc theo yêu cầu của người đưa', 'Lợi ích vật chất từ 2 triệu đồng trở lên hoặc lợi ích phi vật chất', 'Lưu ý: người bị ép buộc đưa hối lộ mà chủ động khai báo trước khi bị phát giác thì được coi là không có tội (khoản 6)'],
    hanhVi: [hv('dua-tien', 'Đưa tiền, tài sản cho người có chức vụ để được giải quyết việc', ['Người đưa muốn đạt được việc gì; ai gợi ý việc đưa tiền?', 'Đưa bao nhiêu, mấy lần, ở đâu, có người chứng kiến, có chứng cứ (tin nhắn, sao kê) không?', 'Có bị đòi hối lộ, ép buộc không; đã chủ động khai báo khi nào?'])],
    dinhKhung: ['Có tổ chức', 'Dùng thủ đoạn xảo quyệt', 'Dùng tài sản của Nhà nước để đưa hối lộ', 'Lợi dụng chức vụ, quyền hạn', 'Phạm tội 02 lần trở lên', 'Của hối lộ trị giá lớn'],
    chuyenMon: ['cong-vu'],
  },
  {
    dieu: '365', ten: 'Tội môi giới hối lộ', nhom: 'chuc-vu-khac', chuong: CH23,
    khachThe: 'Hoạt động đúng đắn của cơ quan, tổ chức', chuThe: 'Người từ đủ 16 tuổi', loi: 'Cố ý',
    dauHieu: ['Làm trung gian giữa người đưa và người nhận hối lộ theo yêu cầu của một bên', 'Của hối lộ từ 2 triệu đồng trở lên hoặc lợi ích phi vật chất'],
    hanhVi: [hv('trung-gian', 'Làm trung gian kết nối, chuyển tiền hối lộ', ['Người môi giới được bên nào nhờ; kết nối với ai; đã chuyển bao nhiêu, giữ lại bao nhiêu?'])],
    dinhKhung: ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Biết của hối lộ là tài sản Nhà nước', 'Của hối lộ trị giá lớn'],
    chuyenMon: ['cong-vu'],
  },
  {
    dieu: '366', ten: 'Tội lợi dụng ảnh hưởng đối với người có chức vụ, quyền hạn để trục lợi', nhom: 'chuc-vu-khac', chuong: CH23,
    khachThe: 'Hoạt động đúng đắn của cơ quan, tổ chức', chuThe: 'Người không có chức vụ quyền hạn liên quan (người thân, người quen của người có chức vụ)', loi: 'Cố ý, vụ lợi',
    dauHieu: ['Trực tiếp hoặc qua trung gian nhận lợi ích từ 2 triệu đồng trở lên', 'Để dùng ảnh hưởng của mình thúc đẩy người có chức vụ, quyền hạn làm hoặc không làm một việc thuộc trách nhiệm của họ'],
    hanhVi: [hv('chay-an-chay-viec', 'Nhận tiền với danh nghĩa “quen biết lãnh đạo” để lo việc', ['Người nhận tiền có quan hệ thế nào với người có chức vụ; đã thực sự tác động chưa, bằng cách nào?', 'Lợi ích nhận được là gì, bao nhiêu?'])],
    dinhKhung: ['Có tổ chức', 'Phạm tội 02 lần trở lên', 'Lợi ích trị giá lớn'],
    chuyenMon: ['cong-vu'],
  },
];
