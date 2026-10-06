// Nội dung Trung tâm hướng dẫn: mỗi mục một hướng dẫn gồm các bước, ví dụ minh họa, gợi ý, lỗi thường gặp, hỏi đáp.
// Định dạng trong chuỗi: **đậm**, [[Tên nút]] = nhãn nút/ô trên giao diện, `phím` = phím tắt.
// fill: màn hình có ô [data-input] — nút “Thử ngay” mở màn hình đó và điền sẵn ví dụ.

export const GROUPS = [
  { id: 'start', ten: 'Bắt đầu' },
  { id: 'docs', ten: 'Văn bản hành chính' },
  { id: 'legal', ten: 'Tố tụng hình sự' },
  { id: 'tools', ten: 'Công cụ' },
  { id: 'system', ten: 'Tài khoản & hệ thống' },
];

export const GUIDES = [
  /* ============================ BẮT ĐẦU ============================ */
  {
    id: 'batdau',
    group: 'start',
    routes: ['dashboard', 'help'],
    route: '#dashboard',
    icon: 'home',
    title: 'Bắt đầu nhanh',
    summary: 'Làm quen giao diện, cách tìm chức năng và 5 việc nên làm trong ngày đầu tiên.',
    time: '3 phút',
    when: ['Lần đầu đăng nhập phần mềm', 'Chưa biết chức năng nằm ở đâu'],
    steps: [
      { t: 'Nhìn thanh bên trái', d: 'Các chức năng được chia nhóm: **Không gian** (soạn văn bản, trợ lý), **Tố tụng hình sự** (chỉ hiện khi được cấp quyền), **Công cụ**, **Lưu trữ**. Trên điện thoại, bấm biểu tượng ☰ ở góc trên để mở.' },
      { t: 'Tìm nhanh bằng bảng lệnh', d: 'Bấm `Ctrl K` (hoặc ô [[Tìm chức năng, tài liệu…]] trên cùng) rồi gõ vài chữ không cần dấu, ví dụ “bblk”, “kham xet”, “dieu 353”. Dùng phím ↑ ↓ để chọn, `Enter` để mở.', tip: 'Gõ số điều luật để mở thẳng tội danh trong cây hỏi đáp.' },
      { t: 'Điền thông tin đơn vị một lần', d: 'Vào [[Cài đặt]] → **Thông tin đơn vị mặc định** (cơ quan, địa danh, người ký) và **Cơ quan điều tra** (tên cơ quan, mẫu số biên bản). Mọi văn bản sau đó tự điền sẵn.' },
      { t: 'Bật AI nếu cần', d: 'Trong [[Cài đặt]] → **Trí tuệ nhân tạo**, dán API key của ChatGPT, Gemini, Groq, Grok hoặc Claude. Key được mã hóa theo mật khẩu tài khoản của bạn. Không có key, phần mềm vẫn chạy chế độ cơ bản trên máy.' },
      { t: 'Mở hướng dẫn ở bất kỳ đâu', d: 'Bấm nút [[?]] trên thanh trên cùng (hoặc phím `F1`) để xem hướng dẫn của đúng màn hình đang mở.' },
    ],
    examples: [
      { title: 'Nhờ trợ lý soạn nhanh từ màn hình Tổng quan', text: 'Soạn giấy mời họp giao ban tuần vào 8 giờ sáng thứ Hai tại phòng họp tầng 2', note: 'Gõ vào ô ở trang Tổng quan rồi bấm [[Soạn ngay]] — trợ lý sẽ soạn và cho mở thẳng trong trình soạn thảo.' },
    ],
    tips: [
      'Dữ liệu lưu ngay trên máy, tách riêng theo từng tài khoản. Nên định kỳ [[Xuất sao lưu]] trong Cài đặt.',
      'Biểu tượng trạng thái AI ở góc dưới thanh bên cho biết AI đang bật hay chế độ cơ bản — bấm vào để mở Cài đặt.',
      'Có bản cập nhật mới, phần mềm sẽ hiện thông báo — bấm cập nhật để dùng tính năng mới nhất.',
    ],
    mistakes: [
      ['Dùng chung một tài khoản cho nhiều người', 'Mỗi người một tài khoản; quản trị viên cấp quyền theo vai trò.'],
      ['Xóa dữ liệu trình duyệt khi chưa sao lưu', 'Vào Cài đặt → [[Xuất sao lưu]] trước khi dọn trình duyệt hoặc đổi máy.'],
    ],
    faq: [
      ['Tôi không thấy mục Tố tụng hình sự?', 'Phân hệ này mặc định ẩn. Nhờ quản trị viên vào [[Quản trị tài khoản]] → [[Phân quyền]] để cấp quyền “Phân hệ Tố tụng hình sự”.'],
      ['Quên mật khẩu thì sao?', 'Không có cách khôi phục từ bên ngoài. Quản trị viên có thể [[Đặt lại mật khẩu]], nhưng API key đã lưu của bạn sẽ phải nhập lại.'],
    ],
    shortcuts: [['Ctrl K', 'Mở bảng lệnh tìm chức năng'], ['F1', 'Mở hướng dẫn của màn hình hiện tại'], ['Esc', 'Đóng hộp thoại, bảng lệnh']],
    related: ['quytrinh', 'settings', 'compose'],
  },
  {
    id: 'quytrinh',
    group: 'start',
    perm: 'legal',
    routes: [],
    route: '#cases',
    icon: 'layers',
    title: 'Quy trình mẫu một vụ án',
    summary: 'Đi từ tạo hồ sơ → lập kế hoạch hỏi → ghi lời khai → lập văn bản → dùng Kho hồ sơ để làm rõ thêm.',
    time: '5 phút',
    when: ['Mới nhận thụ lý một vụ án', 'Muốn biết các phân hệ tố tụng nối với nhau thế nào'],
    steps: [
      { t: 'Tạo hồ sơ vụ án', d: 'Vào [[Hồ sơ vụ án]] → [[Tạo hồ sơ]]. Nhập tên vụ, điều luật (vd: 222, 356), cơ quan, điều tra viên. Sau đó [[Thêm người]] cho bị can, người làm chứng, bị hại… kèm nhân thân.', tip: 'Nhân thân nhập một lần ở đây sẽ tự điền vào biên bản và biểu mẫu sau này.' },
      { t: 'Lập kế hoạch hỏi bằng Cây hỏi đáp', d: 'Mở [[Cây hỏi đáp pháp luật]], chọn tội danh → tích hành vi → tình tiết định khung → đối tượng lấy lời khai. Hệ thống sinh sẵn các vấn đề cần làm rõ và câu hỏi. Bấm [[Lưu kế hoạch]] và chọn hồ sơ vụ án.' },
      { t: 'Ghi lời khai theo kế hoạch', d: 'Bấm [[Ghi lời khai theo kế hoạch]]. Bấm từng câu hỏi bên trái → ghi câu trả lời → `Ctrl Enter`. Bảng **Trợ lý phân tích** bên phải gợi ý câu truy tiếp, phát hiện mâu thuẫn.' },
      { t: 'Lập văn bản tố tụng', d: 'Vào [[Biểu mẫu tố tụng]], chọn mẫu (lệnh triệu tập, quyết định trưng cầu giám định…), chọn hồ sơ và người liên quan để tự điền, rồi [[Xuất Word]].' },
      { t: 'Đối chiếu và làm rõ thêm', d: 'Trong hồ sơ vụ án, mục **Đối chiếu mâu thuẫn giữa các lời khai** → [[Phân tích]]. Hoặc tải các BBLK cũ lên [[Kho hồ sơ & Trợ lý AI]] và ra lệnh “Tạo biên bản lời khai mới… để làm rõ…”.' },
    ],
    examples: [
      { title: 'Lệnh cho Kho hồ sơ sau khi đã có 2 BBLK', text: 'Tạo biên bản lời khai mới cho Nguyễn Văn A dựa vào các BBLK cũ để làm rõ thời gian nhận tiền và số tiền đã nhận', fill: '#kho' },
    ],
    tips: ['Mọi biên bản, kế hoạch, văn bản đều gắn với hồ sơ vụ án — chọn đúng hồ sơ ngay từ đầu để dễ tra cứu.', 'Phân hệ tố tụng chạy hoàn toàn trên máy; AI chỉ dùng khi tài khoản được cấp quyền “AI trực tuyến trong Tố tụng”.'],
    mistakes: [['Ghi lời khai trên biên bản trống rồi mới nhớ lập kế hoạch', 'Lập kế hoạch trước để không bỏ sót dấu hiệu cấu thành; biên bản trống vẫn có thể [[Tạo kế hoạch]] sau.']],
    faq: [['Có phải dùng đủ 5 bước không?', 'Không. Mỗi phân hệ dùng độc lập được; quy trình này giúp dữ liệu tự nối với nhau và đỡ nhập lại.']],
    related: ['cases', 'legal', 'interview', 'forms', 'kho'],
  },

  /* ============================ VĂN BẢN HÀNH CHÍNH ============================ */
  {
    id: 'compose',
    group: 'docs',
    perm: 'docs',
    routes: ['compose'],
    route: '#compose',
    icon: 'file',
    title: 'Soạn văn bản',
    summary: 'Soạn công văn, quyết định, tờ trình, báo cáo, thông báo, kế hoạch, giấy mời, biên bản đúng thể thức NĐ 30/2020, xem trước A4 và xuất Word.',
    time: '3 phút',
    when: ['Cần soạn văn bản hành chính đúng thể thức', 'Muốn AI viết phần nội dung từ vài dòng mô tả'],
    steps: [
      { t: 'Chọn loại văn bản', d: 'Bấm một thẻ ở hàng trên cùng: **Công văn, Quyết định, Tờ trình, Báo cáo, Thông báo, Kế hoạch, Giấy mời, Biên bản**. Biểu mẫu bên trái đổi theo loại.' },
      { t: 'Điền phần đầu và nơi nhận', d: 'Cơ quan, số – ký hiệu, địa danh, ngày tháng, chức vụ, người ký… Ô có dấu **\\*** là bắt buộc. Thông tin đơn vị trong Cài đặt được điền sẵn.' },
      { t: 'Viết nội dung (hoặc để AI viết)', d: 'Gõ mô tả ngắn vào ô [[Soạn nội dung bằng AI]] rồi bấm nút ✨ hoặc `Ctrl Enter`. Không có API key, hệ thống vẫn dựng khung nội dung mẫu để bạn sửa.' },
      { t: 'Kiểm tra bản xem trước A4', d: 'Bên phải hiển thị đúng như khi in: Quốc hiệu, tiêu ngữ, số ký hiệu, căn lề, phông Times New Roman. Trên điện thoại, chuyển giữa thẻ [[Biểu mẫu]] và [[Xem trước]].' },
      { t: 'Lưu, xuất, in', d: 'Bấm lưu để vào [[Tài liệu của tôi]], [[Xuất Word]] để tải .docx, hoặc biểu tượng in để in/lưu PDF.' },
    ],
    examples: [
      { title: 'Mô tả cho công văn', text: 'Đề nghị Sở Tài chính cung cấp hồ sơ quyết toán dự án đường liên xã năm 2025, gửi trước ngày 20/10', note: 'Nêu rõ: gửi ai – việc gì – thời hạn. AI sẽ viết thành đoạn văn hành chính.' },
      { title: 'Mô tả cho giấy mời', text: 'Mời đại diện các phòng chuyên môn dự họp sơ kết quý III vào 14 giờ ngày 15/10 tại hội trường A', note: 'Càng có đủ thời gian, địa điểm, thành phần, nội dung càng ít phải sửa.' },
    ],
    tips: [
      'Nút [[Điền dữ liệu mẫu]] giúp xem nhanh văn bản hoàn chỉnh trông thế nào trước khi điền thật.',
      'Bản nháp tự lưu: lỡ đóng trang, mở lại [[Soạn văn bản]] sẽ thấy nội dung đang làm dở.',
      'Đổi loại văn bản vẫn giữ phần đầu (cơ quan, số, ngày, người ký) để khỏi gõ lại.',
    ],
    mistakes: [
      ['Gõ “Số: 12/CV-UBND” vào ô số', 'Chỉ gõ **12** vào ô Số, phần ký hiệu nhập ở ô viết tắt — hệ thống tự ghép đúng thể thức.'],
      ['Mô tả cho AI quá chung chung (“viết công văn”)', 'Nêu đủ đối tượng, mục đích, mốc thời gian, số liệu.'],
    ],
    faq: [
      ['File Word mở bị lệch phông?', 'Máy cần có phông Times New Roman (có sẵn trên Windows). Văn bản dùng khổ A4, lề theo NĐ 30/2020.'],
      ['Có sửa được văn bản đã lưu không?', 'Có. Vào [[Tài liệu của tôi]], bấm vào văn bản để mở lại trong trình soạn thảo.'],
    ],
    shortcuts: [['Ctrl Enter', 'Soạn nội dung bằng AI']],
    related: ['templates', 'docs', 'spell'],
  },
  {
    id: 'chat',
    group: 'docs',
    perm: 'docs',
    routes: ['chat'],
    route: '#chat',
    icon: 'sparkles',
    title: 'Trợ lý AI',
    summary: 'Trò chuyện để soạn thảo, viết lại, giải thích quy định; trợ lý tự đề xuất mở trình soạn thảo hoặc công cụ phù hợp.',
    time: '2 phút',
    when: ['Chưa biết bắt đầu văn bản thế nào', 'Cần viết lại, rút gọn, đổi giọng văn một đoạn'],
    steps: [
      { t: 'Gõ yêu cầu', d: 'Nhập vào ô dưới cùng, `Enter` để gửi, `Shift Enter` để xuống dòng.' },
      { t: 'Đọc câu trả lời và thao tác', d: 'Nếu là văn bản, bấm [[Mở trong trình soạn thảo]] để chuyển sang biểu mẫu chuẩn. Có thể [[Sao chép]] hoặc [[Mở công cụ]] khi trợ lý gợi ý (chính tả, tóm tắt, số thành chữ).' },
      { t: 'Hỏi tiếp để chỉnh', d: 'Trợ lý nhớ ngữ cảnh trong cuộc trò chuyện: “ngắn gọn hơn”, “thêm đoạn về kinh phí”… Bấm [[Cuộc trò chuyện mới]] khi đổi chủ đề.' },
    ],
    examples: [
      { title: 'Soạn văn bản', text: 'Soạn tờ trình đề nghị mua sắm 05 máy tính cho phòng Tổng hợp, kinh phí khoảng 90 triệu đồng', fill: '#chat' },
      { title: 'Viết lại', text: 'Viết lại đoạn sau theo văn phong hành chính, ngắn gọn: "Bên em sẽ cố gắng làm xong sớm nhất có thể ạ"', fill: '#chat' },
      { title: 'Hỏi thể thức', text: 'Cách ghi nơi nhận trong công văn theo Nghị định 30/2020 như thế nào?', fill: '#chat' },
    ],
    tips: ['Không có API key, trợ lý vẫn trả lời ở chế độ cơ bản và dẫn tới đúng công cụ.', 'Khi một dịch vụ AI lỗi, phần mềm tự thử lại và chuyển sang dịch vụ khác bạn đã nhập key (xem Cài đặt).'],
    mistakes: [['Dán thông tin mật, hồ sơ vụ án vào Trợ lý AI chung', 'Hồ sơ tố tụng hãy dùng phân hệ Tố tụng (mặc định không gửi ra ngoài).']],
    faq: [['Trợ lý có lưu cuộc trò chuyện không?', 'Có, trên máy của bạn, theo từng tài khoản.']],
    shortcuts: [['Enter', 'Gửi'], ['Shift Enter', 'Xuống dòng']],
    related: ['compose', 'settings'],
  },
  {
    id: 'templates',
    group: 'docs',
    perm: 'docs',
    routes: ['templates'],
    route: '#templates',
    icon: 'layers',
    title: 'Thư viện mẫu',
    summary: '8 mẫu chuẩn theo Phụ lục I NĐ 30/2020 và các mẫu riêng bạn tạo từ file Word.',
    time: '1 phút',
    when: ['Cần một khung văn bản chuẩn để bắt đầu', 'Tìm lại mẫu riêng của đơn vị'],
    steps: [
      { t: 'Chọn mẫu chuẩn', d: 'Ở mục **Mẫu chuẩn theo Nghị định 30/2020/NĐ-CP**, bấm [[Dùng mẫu này]] để mở trình soạn thảo với đúng loại văn bản.' },
      { t: 'Dùng mẫu của tôi', d: 'Mục **Mẫu của tôi** chứa các mẫu đã tạo từ file Word. Bấm [[Dùng mẫu]] để điền các trường và xuất Word giữ nguyên định dạng gốc.' },
      { t: 'Thêm mẫu mới', d: 'Bấm [[Tạo mẫu từ file Word]] — xem hướng dẫn “Mẫu từ file Word”.' },
    ],
    examples: [],
    tips: ['Mẫu riêng giữ nguyên bố cục, phông, bảng biểu của file gốc — phù hợp các văn bản đặc thù của đơn vị.'],
    mistakes: [],
    faq: [],
    related: ['tpl', 'compose'],
  },
  {
    id: 'tpl',
    group: 'docs',
    perm: 'docs',
    routes: ['tpl'],
    route: '#tpl',
    icon: 'upload',
    title: 'Mẫu từ file Word',
    summary: 'Tải file .docx có sẵn, hệ thống (hoặc AI) chắt lọc các chỗ cần điền thành trường, xem trước rồi lưu thành mẫu dùng lại.',
    time: '3 phút',
    when: ['Đơn vị có mẫu Word riêng dùng đi dùng lại', 'Muốn điền nhanh nhiều bản cùng một mẫu'],
    steps: [
      { t: 'Tải file Word lên', d: 'Chọn hoặc kéo thả file **.docx** (không hỗ trợ .doc đời cũ — mở bằng Word và lưu lại thành .docx).' },
      { t: 'Nhận diện trường cần điền', d: 'Hệ thống tự tìm số, ngày tháng, họ tên, địa chỉ, chỗ “……”. Bấm [[AI chắt lọc mẫu]] để AI nhận diện kỹ hơn, hoặc [[Nhận diện lại]] để dùng quy tắc trên máy.' },
      { t: 'Chỉnh trường', d: 'Bôi đen một đoạn trong bản xem trước rồi bấm [[Tạo trường]] để biến nó thành chỗ cần điền; đặt tên dễ hiểu (vd: “Họ và tên người nhận”) và gợi ý cách điền.' },
      { t: 'Đặt tên, mô tả và lưu', d: 'Ghi “Dùng khi nào, cho ai…” để người khác dễ chọn đúng mẫu. Mẫu xuất hiện trong [[Thư viện mẫu]] → **Mẫu của tôi**.' },
      { t: 'Điền và xuất', d: 'Điền các trường, xem trước, bấm [[Xuất Word]]. Bấm [[Xóa nội dung đã điền]] để làm bản tiếp theo.' },
    ],
    examples: [
      { title: 'Tên trường rõ nghĩa', text: 'Họ và tên người được triệu tập', note: 'Thay vì “Trường 1”, “Tên” — người điền sau sẽ không nhầm.' },
    ],
    tips: ['Chọn file mẫu “sạch” (đã xóa thông tin cụ thể, để chỗ trống “……”) giúp nhận diện chính xác hơn.', 'AI chỉ dùng khi tài khoản có quyền AI và đã nhập API key.'],
    mistakes: [['Tải file .doc hoặc PDF', 'Chỉ nhận .docx. Mở file trong Word → Lưu thành → Word Document (.docx).']],
    faq: [['Định dạng gốc có giữ nguyên không?', 'Có. Chỉ nội dung trong các trường được thay; bảng, phông, lề giữ như file gốc.']],
    related: ['templates', 'compose'],
  },
  {
    id: 'docs',
    group: 'docs',
    perm: 'docs',
    routes: ['docs'],
    route: '#docs',
    icon: 'folder',
    title: 'Tài liệu của tôi',
    summary: 'Nơi lưu các văn bản hành chính đã soạn: tìm kiếm, mở lại để sửa, xuất lại Word.',
    time: '1 phút',
    when: ['Tìm lại văn bản đã soạn', 'Làm văn bản mới dựa trên văn bản cũ'],
    steps: [
      { t: 'Tìm văn bản', d: 'Gõ vào ô [[Tìm theo tiêu đề hoặc nội dung…]] — tìm cả trong nội dung.' },
      { t: 'Mở để sửa hoặc xuất lại', d: 'Bấm vào văn bản để mở trong trình soạn thảo, sửa và xuất Word.' },
    ],
    examples: [],
    tips: ['Tài liệu lưu trên trình duyệt của máy này. Chuyển máy: Cài đặt → [[Xuất sao lưu]], rồi ở máy mới bấm [[Khôi phục]].'],
    mistakes: [],
    faq: [],
    related: ['compose', 'settings'],
  },

  /* ============================ TỐ TỤNG HÌNH SỰ ============================ */
  {
    id: 'legal',
    group: 'legal',
    perm: 'legal',
    routes: ['legal'],
    route: '#legal',
    icon: 'layers',
    title: 'Cây hỏi đáp pháp luật',
    summary: 'Chọn tội danh theo lĩnh vực của Bộ luật Hình sự → hành vi → tình tiết định khung → đối tượng, hệ thống sinh vấn đề cần làm rõ và bộ câu hỏi bám cấu thành tội phạm.',
    time: '4 phút',
    when: ['Chuẩn bị hỏi cung, lấy lời khai', 'Rà soát xem đã làm rõ đủ dấu hiệu định tội, định khung chưa', 'Cần danh sách tài liệu phải thu thập, giám định cần trưng cầu'],
    steps: [
      { t: 'Tìm tội danh', d: 'Ở cây bên trái, mở **lĩnh vực → nhóm → điều luật**, hoặc gõ vào ô tìm kiếm: số điều (“353”), tên tội (“tham ô”), hay hành vi (“đấu thầu”).', tip: 'Điều có ký hiệu “cần đối chiếu” nên kiểm tra lại tên điều theo văn bản chính thức.' },
      { t: '① Chọn hành vi vi phạm', d: 'Tích một hay nhiều hành vi phù hợp vụ việc. Không có hành vi phù hợp? Bấm [[Thêm hành vi thủ công]] để tự định nghĩa hành vi và câu hỏi đặc thù.' },
      { t: '② Chọn tình tiết định khung (nếu có)', d: 'Bấm các tình tiết cần làm rõ (vd: “chiếm đoạt từ 500 triệu đồng trở lên”, “có tổ chức”). Hệ thống thêm vấn đề và câu hỏi tương ứng.' },
      { t: '③ Chọn đối tượng lấy lời khai', d: 'Bị can, người làm chứng, bị hại, người có quyền lợi nghĩa vụ liên quan… Câu hỏi và phần quyền, nghĩa vụ đổi theo đối tượng.' },
      { t: 'Xem và chỉnh bộ câu hỏi', d: 'Thẻ [[Vấn đề & câu hỏi]]: sửa, xóa, thêm câu hỏi cho từng vấn đề; bấm [[Gợi ý câu hỏi]] / [[AI gợi ý thêm]] để có câu chuyên sâu. Thẻ [[Sơ đồ cây]] xem tổng quan; thẻ [[Tài liệu & giám định]] liệt kê tài liệu cần thu thập, trưng cầu giám định, định giá.' },
      { t: 'Lưu và dùng kế hoạch', d: '[[Lưu kế hoạch]] (gắn với hồ sơ vụ án), [[Xuất Word]] / [[Xem bản in]], [[Phiếu hỏi Word]] (biên bản có sẵn câu hỏi, phần trả lời để trống), hoặc [[Ghi lời khai theo kế hoạch]] để vào ghi ngay.' },
    ],
    examples: [
      { title: 'Tìm theo hành vi', text: 'đấu thầu', note: 'Gõ vào ô tìm kiếm bên trái — ra các tội liên quan như Điều 222 (vi phạm quy định về đấu thầu), Điều 224…' },
      { title: 'Hành vi thủ công', text: 'Lập hồ sơ khống để rút tiền tạm ứng', note: 'Dùng ở [[Thêm hành vi thủ công]] khi hành vi thực tế không có sẵn trong danh sách.' },
      { title: 'Câu hỏi tự thêm cho vấn đề “Dòng tiền”', text: 'Sau khi nhận tiền, anh đã chuyển số tiền đó cho ai, vào tài khoản nào, thời gian nào?', note: 'Câu hỏi tự thêm có thể bấm ⭐ để lưu vào bộ câu hỏi riêng, lần sau chọn cùng Điều sẽ tự có.' },
    ],
    tips: [
      'Câu hỏi bạn đã dùng nhiều được phần mềm **tự học** và gợi ý lại (nhãn “đã học”).',
      'Có văn bản hợp nhất Bộ luật Hình sự chính thức? Ở trang tổng quan của cây, bấm [[Cập nhật Bộ luật từ văn bản chính thức]] để nạp nguyên văn, đối chiếu tên điều.',
      'Gợi ý trên máy không gửi dữ liệu ra ngoài; gợi ý AI chỉ khi được cấp quyền AI trong Tố tụng.',
    ],
    mistakes: [
      ['Chọn tất cả hành vi “cho chắc”', 'Chỉ chọn hành vi có dấu hiệu thực tế — kế hoạch gọn, câu hỏi trúng trọng tâm.'],
      ['Quên chọn đúng đối tượng', 'Câu hỏi cho bị can khác người làm chứng; kiểm tra bước ③ trước khi lưu.'],
    ],
    faq: [
      ['Nội dung pháp lý có thay thế văn bản chính thức không?', 'Không. Đây là công cụ hỗ trợ nghiệp vụ; cần đối chiếu văn bản pháp luật hiện hành.'],
      ['Sửa kế hoạch đã lưu thế nào?', 'Mở hồ sơ vụ án → mục Kế hoạch hỏi → [[Lập kế hoạch]] hoặc bấm vào kế hoạch; chỉnh rồi bấm [[Cập nhật kế hoạch]].'],
    ],
    related: ['interview', 'cases', 'quytrinh'],
  },
  {
    id: 'interview',
    group: 'legal',
    perm: 'legal',
    routes: ['interview'],
    route: '#interview',
    icon: 'message',
    title: 'Ghi lời khai',
    summary: 'Ghi biên bản lời khai, hỏi cung theo Mẫu 140 (TT 128/2025/TT-BCA): hỏi theo kế hoạch, trợ lý phân tích mâu thuẫn, dán ghi chép để chuyển thành Hỏi/Đáp, xuất Word.',
    time: '5 phút',
    when: ['Đang lấy lời khai trực tiếp', 'Có bản ghi chép tay/gõ nhanh cần chuyển thành biên bản đúng mẫu', 'Cần in phiếu hỏi trước buổi làm việc'],
    steps: [
      { t: 'Tạo hoặc mở biên bản', d: 'Từ Cây hỏi đáp bấm [[Ghi lời khai theo kế hoạch]], hoặc tại đây bấm [[Biên bản mới]]. Biên bản chưa có kế hoạch có thể bấm [[Tạo kế hoạch]] ở cột trái.' },
      { t: 'Điền thông tin biên bản', d: 'Bấm [[Thông tin biên bản]]: thời gian, địa điểm, căn cứ, người tiến hành, nhân thân người khai (họ tên, ngày sinh, nơi cư trú, nơi ở hiện tại, giấy tờ…), mẫu số. Bấm [[Lưu thông tin]].' },
      { t: 'Thông báo quyền và nghĩa vụ', d: 'Bấm [[Thông báo quyền và nghĩa vụ]] để đọc cho người khai, xong bấm [[Đã thông báo, người khai đã hiểu]] — nội dung được ghi vào biên bản.' },
      { t: 'Hỏi – ghi theo kế hoạch', d: 'Bấm câu hỏi ở cột trái → câu hỏi vào ô **Hỏi** → ghi câu trả lời vào ô **Trả lời** → `Ctrl Enter` hoặc [[Ghi vào biên bản]]. Câu đã hỏi được đánh dấu, thanh tiến độ cho biết bao nhiêu vấn đề “Đã rõ”.', tip: 'Bấm [[Chuẩn hóa]] để sửa văn phong lời khai (viết hoa, dấu câu, từ địa phương).' },
      { t: 'Dùng trợ lý phân tích', d: 'Cột phải có 3 thẻ: [[Gợi ý hỏi]] (câu truy tiếp — bấm [[Dùng câu hỏi]]), [[Mâu thuẫn]] (trích dẫn chỗ mâu thuẫn — bấm [[Hỏi làm rõ]]), [[Mức độ rõ]] (vấn đề nào đã rõ, một phần, chưa rõ — bấm [[Cập nhật vào kế hoạch]]).' },
      { t: 'Kết thúc và xuất', d: '[[Xem biên bản]] để soát, [[Kết thúc]] khi xong, [[Xuất Word]] để in ký. Biên bản theo Mẫu 140: mẫu số góc trên, Quốc hiệu, số trang, chữ ký hai bên.' },
    ],
    examples: [
      { title: 'Dán ghi chép để chuyển thành biên bản', text: 'Hỏi: Anh cho biết ngày 05/3/2025 anh ở đâu?\nTrả lời: Tôi ở nhà, khoảng 9 giờ thì anh B gọi điện rủ đi.\nHỏi: Anh B gọi bằng số điện thoại nào?\nTrả lời: Số 0912xxxxxx.', note: 'Bấm [[Dán & chuyển đổi]], dán nội dung, bấm [[Chuyển đổi]] (trên máy) hoặc [[Chuyển đổi bằng AI]] để tách Hỏi/Đáp và chuẩn hóa văn phong, rồi [[Đưa vào biên bản]]. Có thể viết “H:”/“Đ:” hoặc “Hỏi:”/“Đáp:”.' },
      { title: 'Câu trả lời mơ hồ cần truy tiếp', text: 'Trả lời: Tôi không nhớ rõ, khoảng mấy chục triệu gì đó.', note: 'Thẻ [[Gợi ý hỏi]] sẽ đề xuất câu truy hỏi số tiền cụ thể, căn cứ để nhớ, người chứng kiến.' },
    ],
    tips: [
      'In **phiếu hỏi** trước buổi làm việc: bấm [[Thêm tất cả … câu hỏi vào biên bản]] ở cột trái rồi [[Xuất Word]] — câu hỏi có sẵn, phần trả lời để trống.',
      'Bấm biểu tượng ✎ ở một lượt Hỏi/Đáp đã ghi để sửa lại; bấm [[Hủy sửa]] nếu đổi ý.',
      'Xóa nhầm biên bản? Bấm [[Hoàn tác]] trên thông báo ngay sau khi xóa.',
      'Huy hiệu ở đầu cột trợ lý cho biết phân tích chạy **trên máy** hay gửi tới **AI**.',
    ],
    mistakes: [
      ['Ghi nhiều câu hỏi vào một ô Hỏi', 'Mỗi lượt một câu hỏi — biên bản rõ ràng, phân tích mâu thuẫn chính xác hơn.'],
      ['Không điền “Nơi ở hiện tại” khi khác nơi cư trú', 'Mẫu 140 có cả hai dòng; điền đủ để biên bản hợp lệ.'],
    ],
    faq: [
      ['Mẫu số biên bản lấy ở đâu?', 'Mặc định Mẫu 140 (ghi lời khai) theo TT 128/2025/TT-BCA; đổi được trong [[Thông tin biên bản]] hoặc Cài đặt → Cơ quan điều tra.'],
      ['Lời khai có bị gửi ra ngoài không?', 'Chỉ khi tài khoản được cấp quyền “AI trực tuyến trong Tố tụng” và bạn bấm chức năng AI. Mặc định mọi phân tích chạy trên máy.'],
    ],
    shortcuts: [['Ctrl Enter', 'Ghi lượt Hỏi/Đáp vào biên bản']],
    related: ['legal', 'cases', 'kho'],
  },
  {
    id: 'cases',
    group: 'legal',
    perm: 'legal',
    routes: ['cases'],
    route: '#cases',
    icon: 'folder',
    title: 'Hồ sơ vụ án',
    summary: 'Gom người tham gia tố tụng, kế hoạch hỏi, biên bản lời khai, văn bản tố tụng theo từng vụ án; đối chiếu mâu thuẫn giữa các lời khai.',
    time: '3 phút',
    when: ['Bắt đầu thụ lý một vụ án mới', 'Cần xem toàn bộ tài liệu của một vụ ở một chỗ'],
    steps: [
      { t: 'Tạo hồ sơ', d: 'Bấm [[Tạo hồ sơ]]: tên vụ án, điều luật (vd: “222, 356”), cơ quan thụ lý, điều tra viên, ngày thụ lý. Bấm [[Lưu hồ sơ]].' },
      { t: 'Thêm người tham gia tố tụng', d: 'Bấm [[Thêm người]]: họ tên, tư cách (bị can, người làm chứng, bị hại…), nhân thân. Mỗi người có nút [[Ghi lời khai]] để lập biên bản đã điền sẵn nhân thân.' },
      { t: 'Theo dõi kế hoạch và biên bản', d: 'Các mục **Kế hoạch hỏi**, **Biên bản lời khai**, **Văn bản tố tụng** liệt kê mọi thứ đã gắn với hồ sơ. [[Lập kế hoạch]] / [[Lập văn bản]] để tạo thêm.' },
      { t: 'Đối chiếu mâu thuẫn', d: 'Ở mục **Đối chiếu mâu thuẫn giữa các lời khai**, bấm [[Phân tích]]: hệ thống so các biên bản (của cùng người qua nhiều lần hoặc giữa nhiều người) và chỉ ra điểm vênh kèm trích dẫn.' },
    ],
    examples: [
      { title: 'Đặt tên hồ sơ dễ tìm', text: 'Vụ vi phạm quy định về đấu thầu tại Ban QLDA huyện X', note: 'Tên gồm hành vi + nơi xảy ra; điều luật nhập riêng ở ô Điều luật.' },
    ],
    tips: ['Kế hoạch hỏi chưa gắn hồ sơ hiện ở mục riêng — mở ra và lưu lại với hồ sơ để gom về một chỗ.', 'Hồ sơ là “gốc” để Biểu mẫu tố tụng và Kho hồ sơ tự điền thông tin.'],
    mistakes: [['Tạo người trùng lặp ở mỗi biên bản', 'Thêm người một lần trong hồ sơ, sau đó lập biên bản từ nút [[Ghi lời khai]] của người đó.']],
    faq: [['Xóa hồ sơ có xóa biên bản không?', 'Có — xóa hồ sơ sẽ xóa cùng toàn bộ biên bản và kế hoạch hỏi của hồ sơ đó (có hộp xác nhận). Hãy xuất Word hoặc sao lưu trước.']],
    related: ['quytrinh', 'interview', 'forms'],
  },
  {
    id: 'kho',
    group: 'legal',
    perm: 'legal',
    routes: ['kho'],
    route: '#kho',
    icon: 'sparkles',
    title: 'Kho hồ sơ & Trợ lý AI',
    summary: 'Tải lên tài liệu hồ sơ (Word, PDF, txt) làm dữ liệu để hỏi đáp có trích dẫn, tìm mâu thuẫn, tạo biên bản lời khai mới từ BBLK cũ và lập văn bản tố tụng bằng một câu lệnh.',
    time: '5 phút',
    when: ['Có sẵn nhiều BBLK, tài liệu cũ dạng file', 'Muốn hỏi nhanh “ai khai gì, ở đâu” trong cả tập hồ sơ', 'Cần lập biên bản lần sau để làm rõ điểm chưa rõ'],
    steps: [
      { t: 'Tải tài liệu lên', d: 'Kéo thả vào khung tải lên (hoặc bấm để chọn) — được chọn nhiều tệp cùng lúc, mỗi tệp tối đa 25MB. Hỗ trợ **.docx, .pdf có chữ, .txt, .md, .html**. Hệ thống tự nhận loại tài liệu (BBLK, hỏi cung, quyết định, kết luận giám định…), người khai, tư cách và các cặp Hỏi/Đáp.', tip: 'Chọn đúng hồ sơ vụ án ở bộ lọc phía trên trước khi tải để tài liệu gắn vào vụ đó.' },
      { t: 'Kiểm tra và sắp xếp', d: 'Bấm vào tài liệu để xem nội dung đã đọc được, đổi loại tài liệu / hồ sơ nếu nhận sai, hoặc [[Tải tệp gốc]]. Dùng ô [[Tìm trong kho…]] để tìm theo từ khóa, có đoạn trích.' },
      { t: 'Chọn phạm vi dữ liệu', d: 'Tích ô ở từng tài liệu để trợ lý chỉ dùng những tài liệu đó; không tích gì = dùng cả kho (theo bộ lọc hồ sơ). Tích [[Gồm biên bản, văn bản đã lập trong phần mềm]] để dùng cả biên bản ghi trong phần mềm.' },
      { t: 'Hỏi đáp', d: 'Gõ câu hỏi vào ô trợ lý, `Enter` để gửi. Câu trả lời ghi rõ **trích từ tài liệu nào** — mở mục [[Nguồn trích dẫn]] dưới câu trả lời để xem đoạn gốc. Không có AI, trợ lý trả về các đoạn tìm được phù hợp nhất.' },
      { t: 'Ra lệnh tạo biên bản lời khai mới', d: 'Gõ “Tạo biên bản lời khai mới cho [họ tên] dựa vào các BBLK cũ để làm rõ [nội dung]”. Trợ lý lấy nhân thân từ biên bản cũ, tính lần khai tiếp theo, soạn câu hỏi làm rõ mâu thuẫn, chỗ khai mơ hồ, số liệu, rồi tạo biên bản Mẫu 140 có sẵn câu hỏi. Bấm [[Mở biên bản để ghi lời khai]].' },
      { t: 'Ra lệnh lập văn bản tố tụng', d: 'Gõ “Tạo [tên văn bản]…”, ví dụ lệnh triệu tập, quyết định trưng cầu giám định. Trợ lý chọn đúng mẫu trong 125 biểu mẫu, điền từ hồ sơ và tài liệu, lưu vào Biểu mẫu tố tụng. Bấm [[Mở văn bản]] để sửa và xuất Word.' },
    ],
    examples: [
      { title: 'Tóm tắt lời khai', text: 'Tóm tắt lời khai của Trần Thiên Hà qua các lần', fill: '#kho' },
      { title: 'Tìm mâu thuẫn', text: 'Các lời khai có mâu thuẫn gì về thời gian và số tiền?', fill: '#kho' },
      { title: 'Tra cứu chi tiết', text: 'Ai đã khai về việc giao tiền tại quán cà phê? Khai ngày nào?', fill: '#kho' },
      { title: 'Biên bản lời khai mới để làm rõ', text: 'Tạo biên bản lời khai mới cho Nguyễn Văn A dựa vào các BBLK cũ để làm rõ việc nhận tiền: thời gian, địa điểm, số tiền, người chứng kiến', fill: '#kho', note: 'Nêu rõ **tên người** và **điểm cần làm rõ** — kế hoạch hỏi sẽ tập trung đúng chỗ.' },
      { title: 'Lập văn bản tố tụng', text: 'Tạo quyết định trưng cầu giám định chữ ký trên hợp đồng vay tiền ngày 10/02/2025', fill: '#kho' },
      { title: 'Lệnh triệu tập', text: 'Lập giấy triệu tập người làm chứng Lê Thị B đến làm việc lúc 8 giờ ngày 15/10/2026', fill: '#kho' },
    ],
    tips: [
      'Các nút gợi ý nhanh [[Tóm tắt hồ sơ]], [[Tạo biên bản lời khai mới từ BBLK cũ]], [[Tìm mâu thuẫn]] điền sẵn câu lệnh mẫu — chỉ cần bổ sung tên người, nội dung.',
      'Trợ lý **không tự bịa**: câu trả lời luôn dựa trên tài liệu trong kho; nếu không tìm thấy, trợ lý sẽ nói không có dữ liệu.',
      'Huy hiệu [[AI]] / [[Ngoại tuyến]] cho biết nội dung có được gửi tới dịch vụ AI hay không.',
      'Biên bản, văn bản do trợ lý tạo luôn là **bản nháp** — kiểm tra, chỉnh sửa trước khi in ký.',
    ],
    mistakes: [
      ['Tải PDF dạng ảnh scan', 'Cần chuyển chữ (OCR) hoặc chuyển sang Word trước. Hệ thống sẽ báo nếu PDF không có lớp chữ.'],
      ['Tải file .doc đời cũ', 'Mở bằng Word → Lưu thành .docx rồi tải lại.'],
      ['Ra lệnh không nêu tên khi kho có nhiều người khai', 'Ghi rõ họ tên để trợ lý chọn đúng các biên bản của người đó.'],
    ],
    faq: [
      ['Tài liệu lưu ở đâu?', 'Trên máy của bạn (bộ nhớ trình duyệt), tách riêng theo tài khoản. [[Xóa toàn bộ dữ liệu]] trong Cài đặt sẽ xóa cả kho (không xóa tài khoản).'],
      ['Không có AI thì dùng được gì?', 'Tải lên, tìm kiếm, xem; hỏi đáp trả về đoạn trích phù hợp; tạo biên bản mới theo quy tắc phát hiện mâu thuẫn / chỗ khai mơ hồ; chọn biểu mẫu theo từ khóa.'],
    ],
    shortcuts: [['Enter', 'Gửi yêu cầu'], ['Shift Enter', 'Xuống dòng']],
    related: ['interview', 'forms', 'cases'],
  },
  {
    id: 'forms',
    group: 'legal',
    perm: 'legal',
    routes: ['forms'],
    route: '#forms',
    icon: 'file',
    title: 'Biểu mẫu tố tụng',
    summary: '125 biểu mẫu chia 15 giai đoạn (tiếp nhận nguồn tin, khởi tố, biện pháp ngăn chặn, khám xét, giám định, kết thúc điều tra…): tự điền từ hồ sơ, xem trước A4, xuất Word.',
    time: '3 phút',
    when: ['Cần lập lệnh, quyết định, biên bản tố tụng', 'Muốn văn bản tự lấy nhân thân, số vụ án từ hồ sơ'],
    steps: [
      { t: 'Tìm mẫu', d: 'Mở giai đoạn ở cột trái hoặc gõ vào ô [[Tìm biểu mẫu: khám xét, tạm giam…]] (không cần dấu).' },
      { t: 'Chọn hồ sơ và người liên quan', d: 'Chọn [[Hồ sơ vụ án]] và [[Người liên quan]] (bị can, người làm chứng…) — các ô họ tên, ngày sinh, nơi cư trú, điều luật, cơ quan được điền sẵn.' },
      { t: 'Điền phần còn lại', d: 'Số văn bản, ngày, lý do, nội dung… Ô dài có nút [[AI soạn]] để AI viết nháp lý do, diễn biến, nội dung yêu cầu giám định (cần quyền AI trong Tố tụng).' },
      { t: 'Xem trước và xuất', d: 'Bản xem trước A4 cập nhật ngay khi gõ. Bấm [[Xuất Word]]; văn bản được lưu vào hồ sơ để mở lại sau.' },
    ],
    examples: [
      { title: 'Tìm nhanh', text: 'trung cau', note: 'Gõ không dấu vẫn ra “Quyết định trưng cầu giám định”.' },
      { title: 'Nội dung cần giám định (gợi ý điền)', text: 'Chữ ký mang tên Nguyễn Văn A tại mục “Bên vay” trên Hợp đồng vay tiền ngày 10/02/2025 so với chữ ký mẫu có phải do cùng một người ký ra hay không?', note: 'Nêu rõ đối tượng, vị trí, mẫu so sánh và câu hỏi giám định.' },
    ],
    tips: [
      'Mẫu số của từng biểu mẫu chỉnh được (ô “Để trống: không in” nghĩa là không in mẫu số).',
      'Có thể ra lệnh ở [[Kho hồ sơ & Trợ lý AI]] để trợ lý tự chọn mẫu và điền.',
      'Điền Cài đặt → **Cơ quan điều tra** để mọi biểu mẫu có sẵn tên cơ quan, cơ quan cấp trên.',
    ],
    mistakes: [['Xuất văn bản khi chưa chọn hồ sơ', 'Chọn hồ sơ trước để không phải gõ lại nhân thân, điều luật.']],
    faq: [['Biểu mẫu có đúng thông tư mới nhất không?', 'Nội dung theo cấu trúc mẫu thông dụng; số hiệu mẫu cấu hình được theo thông tư đơn vị áp dụng. Cần đối chiếu văn bản hiện hành trước khi ban hành.']],
    related: ['cases', 'kho'],
  },

  /* ============================ CÔNG CỤ ============================ */
  {
    id: 'spell',
    group: 'tools',
    perm: 'tools',
    routes: ['spell'],
    route: '#spell',
    icon: 'spell',
    title: 'Kiểm tra chính tả',
    summary: 'Phát hiện lỗi chính tả, dấu câu, viết hoa, khoảng trắng và thể thức theo NĐ 30/2020; sửa từng lỗi hoặc sửa tất cả.',
    time: '1 phút',
    when: ['Trước khi trình ký văn bản', 'Văn bản copy từ nhiều nguồn, lỗi dấu cách, dấu câu'],
    steps: [
      { t: 'Dán văn bản', d: 'Dán vào ô [[Dán hoặc nhập văn bản tại đây…]] — hoặc bấm [[Văn bản mẫu]] để thử.' },
      { t: 'Xem lỗi', d: 'Lỗi được tô màu trong văn bản và liệt kê ở mục **Kết quả** kèm đề xuất.' },
      { t: 'Sửa', d: 'Bấm [[Sửa]] ở từng lỗi, hoặc [[Sửa tất cả]]. Xong bấm [[Sao chép]] để dán lại vào Word.' },
    ],
    examples: [{ title: 'Câu có lỗi để thử', text: 'Căn cứ nghị định số 30/2020/NĐ-CP ngày 05/3/2020 của Chính Phủ ,UBND huyện đề nghị các xã báo cáo trước ngày 20/10 .' }],
    tips: ['Kiểm tra chạy hoàn toàn trên máy, không gửi văn bản ra ngoài.'],
    mistakes: [],
    faq: [],
    related: ['summary', 'compose'],
  },
  {
    id: 'summary',
    group: 'tools',
    perm: 'tools',
    routes: ['summary'],
    route: '#summary',
    icon: 'book',
    title: 'Tóm tắt văn bản',
    summary: 'Rút văn bản dài thành ý chính, từ khóa, thống kê; tóm tắt bằng AI khi có API key.',
    time: '1 phút',
    when: ['Đọc nhanh công văn, báo cáo dài', 'Cần ý chính để báo cáo lãnh đạo'],
    steps: [
      { t: 'Dán văn bản gốc', d: 'Dán vào ô **Văn bản gốc** hoặc bấm [[Văn bản mẫu]].' },
      { t: 'Chọn cách tóm tắt', d: '[[Tóm tắt nhanh]] chạy trên máy, chọn các câu quan trọng nhất. [[Tóm tắt bằng AI]] viết lại súc tích hơn (cần API key).' },
      { t: 'Sao chép kết quả', d: 'Bấm [[Sao chép]] để dùng trong báo cáo, tờ trình.' },
    ],
    examples: [],
    tips: ['Văn bản càng có cấu trúc (mục, khoản) thì tóm tắt nhanh càng chính xác.'],
    mistakes: [],
    faq: [],
    related: ['spell', 'chat'],
  },
  {
    id: 'number',
    group: 'tools',
    perm: 'tools',
    routes: ['number'],
    route: '#number',
    icon: 'hash',
    title: 'Số thành chữ',
    summary: 'Đọc số tiền thành chữ chuẩn chứng từ kế toán, hợp đồng, quyết định chi.',
    time: '30 giây',
    when: ['Ghi “Bằng chữ” trên chứng từ, hợp đồng'],
    steps: [
      { t: 'Nhập số', d: 'Gõ số, có thể có dấu chấm phân cách nghìn và phần thập phân sau dấu phẩy.' },
      { t: 'Sao chép, lưu', d: 'Bấm [[Sao chép]]; [[Lưu lịch sử]] để dùng lại; [[Xóa lịch sử]] khi không cần.' },
    ],
    examples: [
      { title: 'Số nguyên', text: '1.250.000', note: '→ Một triệu hai trăm năm mươi nghìn đồng.' },
      { title: 'Có thập phân', text: '2500000,5' },
    ],
    tips: ['Đọc đúng các trường hợp “linh/lẻ”, “mốt”, “lăm”, “tư” theo cách viết chứng từ.'],
    mistakes: [['Nhập “1,250,000” kiểu Mỹ', 'Dùng dấu chấm phân cách nghìn, dấu phẩy cho phần thập phân: 1.250.000'] ],
    faq: [],
    related: ['compose'],
  },

  /* ============================ HỆ THỐNG ============================ */
  {
    id: 'settings',
    group: 'system',
    routes: ['settings'],
    route: '#settings',
    icon: 'settings',
    title: 'Cài đặt, AI & dữ liệu',
    summary: 'Nhập API key (mã hóa riêng từng tài khoản), chọn mô hình, tự chuyển AI khi lỗi, thông tin đơn vị, sao lưu – khôi phục, cập nhật phần mềm.',
    time: '4 phút',
    when: ['Lần đầu bật AI', 'AI báo lỗi, cần đổi mô hình', 'Chuyển sang máy khác'],
    steps: [
      { t: 'Thêm API key', d: 'Mục **Trí tuệ nhân tạo** → **API key của tôi**: dán key của ChatGPT (sk-…), Gemini (AIza…), Groq (gsk_…), Grok (xai-…) hoặc Claude (sk-ant-…). Key được mã hóa bằng mật khẩu của bạn; quản trị viên cũng không xem được.', tip: 'Groq và Gemini có gói dùng miễn phí — phù hợp để bắt đầu.' },
      { t: 'Chọn mô hình và kiểm tra', d: 'Bấm [[Tải danh sách]] để lấy các mô hình key của bạn được dùng, chọn mô hình, rồi [[Kiểm tra kết nối]]. Chọn [[Khác — tự nhập tên mô hình…]] để gõ tên mô hình tùy ý.' },
      { t: 'Bật tự chuyển AI và ghi nhớ', d: 'Khi một dịch vụ lỗi (503, quá tải, hết hạn mức), phần mềm tự thử lại, đổi mô hình dự phòng, rồi chuyển sang dịch vụ khác có key. Kết quả AI đã hỏi được **ghi nhớ trên máy** để lần sau trả lời ngay, không tốn lượt.' },
      { t: 'Thông tin đơn vị', d: 'Điền **Thông tin đơn vị mặc định** (văn bản hành chính) và **Cơ quan điều tra** (biên bản, biểu mẫu tố tụng, mẫu số). Bấm lưu.' },
      { t: 'Sao lưu và khôi phục', d: '[[Xuất sao lưu]] tải về tệp .json; ở máy mới đăng nhập rồi bấm [[Khôi phục]] và chọn tệp đó.' },
      { t: 'Cập nhật', d: '[[Kiểm tra cập nhật]] → [[Cập nhật ngay]] khi có bản mới.' },
    ],
    examples: [],
    tips: [
      '**Nhật ký AI** ghi lại các lần lỗi, thử lại, chuyển dịch vụ — xem khi AI chạy chậm hay lỗi.',
      '[[Xóa toàn bộ dữ liệu]] xóa văn bản, biên bản, kho hồ sơ… của tài khoản nhưng **không xóa tài khoản**.',
      'Giao diện [[Sáng]] / [[Tối]] / [[Hệ thống]] đổi tại mục **Giao diện**.',
    ],
    mistakes: [
      ['Dán key có khoảng trắng thừa', 'Sao chép lại đúng key; hệ thống kiểm tra tiền tố (sk-, AIza, gsk_…) và báo nếu sai.'],
      ['Chỉ nhập một dịch vụ AI', 'Nhập từ 2 dịch vụ trở lên để khi một dịch vụ quá tải, phần mềm tự chuyển sang dịch vụ còn lại.'],
    ],
    faq: [
      ['Lỗi 503 / 429 là gì?', '503: máy chủ AI quá tải tạm thời; 429: vượt hạn mức. Phần mềm tự thử lại và chuyển dịch vụ; nếu vẫn lỗi, chờ vài phút hoặc đổi mô hình nhẹ hơn.'],
      ['Có cần Internet không?', 'Chỉ khi dùng AI hoặc cập nhật. Các chức năng khác chạy trên máy.'],
    ],
    related: ['admin', 'batdau'],
  },
  {
    id: 'admin',
    group: 'system',
    perm: 'users',
    routes: ['admin'],
    route: '#admin',
    icon: 'shield',
    title: 'Quản trị tài khoản',
    summary: 'Tạo tài khoản, phân vai trò (Quản trị viên, Điều tra viên, Người dùng), cấp quyền Tố tụng và AI, đặt lại mật khẩu, xem nhật ký.',
    time: '3 phút',
    when: ['Có người mới đăng ký đang chờ cấp quyền', 'Cần mở phân hệ Tố tụng hoặc AI cho một người'],
    steps: [
      { t: 'Xem danh sách', d: 'Mục **Danh sách tài khoản**; tài khoản mới tự đăng ký có nhãn chờ cấp quyền. Tìm theo tên, email.' },
      { t: 'Phân quyền', d: 'Bấm [[Phân quyền]] ở tài khoản: chọn vai trò (Quản trị viên / Điều tra viên / Người dùng) rồi tinh chỉnh từng quyền: Văn bản hành chính, Công cụ, AI cho văn bản, **Phân hệ Tố tụng hình sự**, **AI trực tuyến trong Tố tụng**, Quản lý tài khoản.' },
      { t: 'Tạo tài khoản hoặc đặt lại mật khẩu', d: '[[Tạo tài khoản]] cho người mới; [[Đặt lại mật khẩu]] khi họ quên (API key của họ sẽ phải nhập lại).' },
      { t: 'Cấu hình hệ thống và nhật ký', d: 'Bật/tắt cho phép tự đăng ký tại **Cấu hình hệ thống**. **Nhật ký hoạt động** ghi lại đăng nhập, phân quyền, xóa biên bản, nạp Bộ luật…' },
    ],
    examples: [],
    tips: ['Nguyên tắc tối thiểu: chỉ cấp “AI trực tuyến trong Tố tụng” cho người thật sự cần, vì nội dung lời khai sẽ được gửi tới dịch vụ AI bên ngoài.', 'Quản trị viên không xem được API key hay dữ liệu riêng của người khác.'],
    mistakes: [['Cấp vai trò Quản trị viên cho mọi người', 'Dùng vai trò Điều tra viên cho cán bộ nghiệp vụ; chỉ 1–2 người làm quản trị.']],
    faq: [['Tài khoản quản trị tối cao là gì?', 'Tài khoản cao nhất của hệ thống, có mọi quyền và không thể bị hạ quyền bởi người khác.']],
    related: ['settings'],
  },
];

export const findGuide = (id) => GUIDES.find((g) => g.id === id);
/** Hướng dẫn cho màn hình (route) đang mở. */
export const guideForRoute = (route) => GUIDES.find((g) => g.routes.includes(route)) || null;
/** Hướng dẫn mà người dùng được phép xem (theo quyền). */
export const visibleGuides = (can) => GUIDES.filter((g) => !g.perm || can(g.perm));

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

/** Toàn bộ chữ của một hướng dẫn (để tìm kiếm). */
export function guideText(g) {
  return [g.title, g.summary, ...(g.when || []), ...g.steps.flatMap((s) => [s.t, s.d, s.tip]), ...g.examples.flatMap((e) => [e.title, e.text, e.note]), ...(g.tips || []), ...(g.mistakes || []).flat(), ...(g.faq || []).flat()].filter(Boolean).join(' ');
}

/** Tìm hướng dẫn: mọi từ khóa (không dấu) phải xuất hiện; tiêu đề khớp được xếp trước. */
export function searchGuides(q, guides = GUIDES) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return guides;
  return guides
    .map((g) => {
      const title = norm(g.title);
      const sum = norm(g.summary);
      const all = norm(guideText(g));
      if (!words.every((w) => all.includes(w))) return null;
      const phrase = words.join(' ');
      return { g, score: (title.includes(phrase) ? 10 : 0) + words.filter((w) => title.includes(w)).length * 2 + words.filter((w) => sum.includes(w)).length };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.g);
}

/** Định dạng nội dung: **đậm**, [[nút]], `phím`. Đầu vào là chuỗi đã escape HTML. */
export function inline(escaped) {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[\[(.+?)\]\]/g, '<span class="ui-label">$1</span>')
    .replace(/`(.+?)`/g, (m, k) => k.split(' ').map((x) => `<kbd class="kbd">${x}</kbd>`).join(' '));
}
