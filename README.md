# Trợ Lý Văn Bản AI

Nền tảng soạn thảo văn bản hành chính tiếng Việt, trình bày đúng thể thức **Nghị định 30/2020/NĐ-CP**, có trợ lý AI (Claude).

## Tính năng

| Phân hệ | Mô tả |
|---|---|
| **Soạn văn bản** | 8 loại: công văn, quyết định, tờ trình, báo cáo, thông báo, kế hoạch, giấy mời, biên bản. Xem trước trang A4 trực tiếp, tự trình bày quốc hiệu, tiêu ngữ, số ký hiệu, ngày tháng (tự thêm số 0), nơi nhận, quyền hạn ký. |
| **Soạn bằng AI** | Mô tả một câu → AI điền trích yếu và nội dung. Dùng Claude khi có API key; nếu chưa có, dùng trợ lý mẫu chạy cục bộ. |
| **Xuất bản** | Xuất **Word (.docx)** chuẩn A4, lề 20/15/20/30 mm, Times New Roman; in / lưu PDF; sao chép văn bản. |
| **Trợ lý AI** | Hội thoại streaming với Claude; chuyển bản nháp sang trình soạn thảo bằng một chạm. |
| **PDF sang Word** (`#pdf`) | Chuyển PDF, bản scan, ảnh chụp sang .docx giữ bố cục: dòng → đoạn, căn lề, thụt dòng, cỡ chữ, đậm/nghiêng, chỉ số trên, bảng có viền (dựng lưới ô từ nét kẻ, ô gộp), phần đầu văn bản / chữ ký hai cột, khổ giấy và lề từng trang. Trang ảnh quét nhận dạng chữ tiếng Việt trên máy (tesseract.js, ≈ 99% ký tự với bản quét rõ), tự sửa chữ hoa mất dấu, chữ dính; AI soát lỗi OCR hoặc AI đọc ảnh (Claude, ChatGPT, Gemini…). Tự chuyển phông cũ TCVN3 (.VnTime) và VNI sang Unicode. Kho hồ sơ dùng chung bộ nhận dạng cho PDF scan, ảnh chụp. |
| **Kiểm tra chính tả** | Lỗi s/x, ch/tr, d/gi/r, l/n, hỏi/ngã, dấu câu, khoảng trắng, viết hoa, lặp từ, thể thức ngày tháng / quốc hiệu. **Từ không có nghĩa** (kiểm tra cấu tạo âm tiết tiếng Việt trên máy: gõ nhầm, sót Telex/VNI, sai quy tắc c/k, g/gh, ng/ngh, iê/yê, vần p/t/c/ch sai thanh), dấu thanh đặt sai vị trí, **dùng từ thừa/sai** (tái diễn lại, được diễn ra…); gợi ý nhiều cách sửa; từ điển cá nhân; **Kiểm tra bằng AI** (ngữ pháp, dùng từ sai ngữ cảnh, nhận xét chung, tách đoạn văn bản dài, ghi nhớ kết quả); điểm chất lượng; đọc tệp .docx/.txt. |
| **Tóm tắt văn bản** | Tóm tắt trích xuất cục bộ (từ khóa, thống kê) hoặc tóm tắt bằng Claude. |
| **Số thành chữ** | Đọc số tiền chuẩn chứng từ (mốt, lăm, tư, linh…) tới hàng tỷ tỷ, có lịch sử. |
| **Mẫu từ file Word** (`#tpl/new`) | Tải lên tệp .docx có sẵn → nhận diện tự động các phần cần điền (số ký hiệu, địa danh – ngày tháng, kính gửi, họ tên, địa chỉ, số tiền, ô `[..]`) hoặc **AI chắt lọc mẫu**; bôi đen chữ trong bản xem trước để tạo trường; xem trước, lưu vào “Mẫu của tôi”, điền nội dung và xuất Word giữ nguyên định dạng gốc (bảng, đầu/cuối trang). |
| **Kho tài liệu** | Lưu, tìm kiếm không dấu, gắn sao, nhân bản, xuất Word, sao lưu / khôi phục JSON. |
| **Khác** | Tài khoản cục bộ, bảng lệnh `Ctrl + K`, phím tắt `Ctrl + S`, giao diện sáng/tối, tối ưu di động. |

## Độ tin cậy AI & bộ nhớ cục bộ

- **Chọn mô hình** bằng danh sách cho từng nhà cung cấp; nút “Tải danh sách” lấy đúng các mô hình mà API key được dùng; có thể tự nhập tên mô hình. Đổi mô hình được lưu ngay.
- **Quá tải tạm thời (503, 429, 5xx)**: tự thử lại 2 lần (sau 1,5 và 4 giây), sau đó chuyển sang mô hình dự phòng của cùng nhà cung cấp (vd: Gemini 2.5 Flash → 2.0 Flash → 2.5 Flash-Lite) — chỉ có một API key vẫn chạy được.
- **Tự chuyển nhà cung cấp**: khi AI lỗi (sai key, hết hạn mức, máy chủ lỗi, không phản hồi sau 90 giây) hệ thống tự chuyển sang nhà cung cấp khác đã nhập key và báo cho người dùng; nếu tất cả đều lỗi, thông báo gộp nêu rõ lỗi của từng nhà cung cấp. Trong phân hệ Tố tụng, AI lỗi thì tự dùng phân tích/gợi ý ngoại tuyến.
- **Nhật ký AI** trong Cài đặt: các lỗi và lần tự chuyển gần đây.
- **Ghi nhớ kết quả AI** trên máy: yêu cầu giống hệt lần trước dùng lại kết quả, không gửi lại (có nút “Hỏi lại AI”).
- **Tự học câu hỏi**: câu hỏi đã hỏi khi ghi lời khai, gợi ý đã chọn được ghi nhớ theo tội danh/vấn đề và tự xuất hiện lại trong cây hỏi đáp với nhãn “Đã học”.

## Tài khoản, phân quyền & bảo mật

Ứng dụng **bắt buộc đăng nhập** và chạy hoàn toàn cục bộ: tài khoản, dữ liệu, API key đều lưu trên máy người dùng.

| Vai trò | Quyền mặc định |
|---|---|
| **Quản trị tối cao** (`gsnvbu@gmail.com`) | Toàn quyền; không thể bị hạ quyền, khóa hay xóa |
| **Quản trị viên** | Văn bản, công cụ, AI, Tố tụng, quản lý tài khoản (trừ quản trị viên khác) |
| **Điều tra viên** | Văn bản, công cụ, AI, Tố tụng |
| **Người dùng** | Văn bản, công cụ, AI |

- **Đăng ký**: màn hình đăng ký không gắn sẵn email. Ai đăng ký bằng email quản trị tối cao sẽ tự động có toàn quyền; email khác là tài khoản **Người dùng**, hiện nhãn “Chờ cấp quyền” — quản trị đăng nhập ngay trên máy đó để phân quyền (được nhắc khi đăng nhập).
- Mỗi quyền có thể bật/tắt riêng cho từng tài khoản (màn hình **Quản trị tài khoản**). Có nhật ký hoạt động, khóa tài khoản, đặt lại mật khẩu, bật/tắt tự đăng ký.
- **Phân hệ Tố tụng** chỉ hiện với tài khoản được cấp quyền và được ẩn khỏi trang giới thiệu công khai. Quyền **“AI trực tuyến trong Tố tụng”** mặc định tắt với mọi vai trò — khi chưa được cấp, mọi phân tích lời khai chạy ngoại tuyến, không gửi dữ liệu ra ngoài.
- Dữ liệu (văn bản, hồ sơ, biên bản, lịch sử) **tách riêng theo tài khoản**.
- **API key** ChatGPT (OpenAI), Gemini (Google), Grok (xAI), Groq, Claude (Anthropic): mỗi tài khoản tự nhập, mã hóa AES-GCM bằng khóa sinh từ mật khẩu (PBKDF2-SHA256, 310.000 vòng). Không lưu mật khẩu; quản trị viên không đọc được khóa của người khác; đặt lại mật khẩu sẽ xóa kho khóa.
- Phiên đăng nhập nằm trong `sessionStorage` — tự hết khi đóng trình duyệt.
- **Xóa toàn bộ dữ liệu** chỉ xóa văn bản, hồ sơ, biên bản, lịch sử; tài khoản, API key và cài đặt được giữ lại.

> Giới hạn của mô hình chạy cục bộ: phân quyền được kiểm tra trong trình duyệt, đủ để phân tách người dùng thông thường trên cùng máy nhưng không thay thế được máy chủ xác thực tập trung. Mỗi máy có hệ thống tài khoản riêng.

## Cập nhật phiên bản & dùng ngoại tuyến

- Service worker (`sw.js`) lưu bộ nhớ đệm để dùng được khi mất mạng.
- Khi máy chủ có bản mới, ứng dụng hiện thông báo **“Đã có phiên bản mới — Cập nhật ngay”**; cũng có thể kiểm tra trong **Cài đặt → Phiên bản & cập nhật**. Cập nhật chỉ thay mã nguồn, dữ liệu trên máy giữ nguyên.
- Phát hành bản mới: `npm run release -- 2.1.0 "Ghi chú thay đổi"` (đồng bộ `version.json`, `sw.js`, `assets/js/version.js`), rồi triển khai lên máy chủ tĩnh.

## AI chạy trên máy (Ollama, LM Studio, llama.cpp, Jan, BionicGPT)

**Cài đặt → Trí tuệ nhân tạo → AI chạy trên máy**: kết nối mô hình AI cài trên máy này hoặc máy chủ trong mạng nội bộ qua giao thức tương thích OpenAI. Không cần API key, không mất phí, dùng được khi mất mạng.

- Chọn phần mềm (Ollama `http://localhost:11434/v1`, LM Studio `:1234`, llama.cpp `:8080`, Jan `:1337`) hoặc nhập địa chỉ máy chủ nội bộ → **Tải danh sách** mô hình đã cài → **Kiểm tra kết nối**. Chọn “AI trên máy” làm nhà cung cấp mặc định.
- **Phân quyền**: địa chỉ trên máy hoặc mạng nội bộ (localhost, 127.x, 10.x, 172.16–31.x, 192.168.x, *.local) không đưa dữ liệu ra Internet nên chỉ cần quyền dùng phân hệ — **phân hệ Tố tụng dùng được AI trên máy kể cả khi chưa có quyền “AI trực tuyến trong Tố tụng”**; tài khoản bị tắt AI trực tuyến vẫn dùng được cho văn bản. Địa chỉ ngoài mạng nội bộ được coi như dịch vụ trực tuyến.
- **BionicGPT** và các nền tảng AI tự dựng tương thích OpenAI (LiteLLM, vLLM, LocalAI, Open WebUI…): nhập địa chỉ máy chủ (`http://<máy chủ>:3000/v1` với BionicGPT chạy bằng Docker Compose) và khóa API (BionicGPT: Admin Panel → API Keys → Create Assistant Key). Bản cài đặt tự bỏ chặn CORS cho yêu cầu của chính ứng dụng nên kết nối được với máy chủ nội bộ không cấu hình CORS.
- **Mất mạng → tự dùng AI trên máy**: khi trình duyệt báo mất mạng, mọi chức năng AI dùng ngay AI trên máy; khi gọi dịch vụ trực tuyến bị lỗi kết nối thì chuyển ngay (không chờ thử lại), kể cả khi tắt “tự chuyển nhà cung cấp”. Có mạng lại thì dùng nhà cung cấp mặc định.
- AI trên máy **không bao giờ tự chuyển** sang Claude, ChatGPT… khi lỗi. Thời gian chờ dài hơn (5 phút) vì lần đầu phải nạp mô hình.
- Gợi ý mô hình hiểu tiếng Việt: `qwen2.5:7b` (RAM 8 GB), `qwen2.5:14b` (16 GB), `gemma3:12b` (đọc được ảnh — dùng cho “AI đọc ảnh” trong PDF sang Word). Văn bản dài: đặt `OLLAMA_CONTEXT_LENGTH=16384`.
- Bản cài đặt kết nối được ngay với Ollama (và máy chủ AI khác trong mạng nội bộ). Bản web: đặt `OLLAMA_ORIGINS=*` (LM Studio: bật “Enable CORS”); trình duyệt chỉ cho trang web gọi `localhost`.

## Tài liệu dài & thời gian chờ AI

Phân tích tài liệu (Thêm hành vi từ tài liệu, Phân tích vụ việc), Sơ đồ vụ việc, Kho hồ sơ, Lời khai lần tiếp theo không còn gửi nguyên khối lớn cho AI (`assets/js/lib/ai-chunk.js`):
- **Lọc trên máy** trước khi gửi: giữ câu có thông tin (hành vi, số tiền, ngày tháng, người có danh xưng / chức danh, “Điều …”), bỏ phần thủ tục, tiêu đề, nhân thân, câu lặp — thường giảm 30–70% dung lượng.
- **Chia phần** vừa sức mô hình: khoảng 8.000 ký tự mỗi phần với dịch vụ trực tuyến, 3.500 với AI trên máy (ngữ cảnh mặc định của Ollama nhỏ, chạy CPU chậm); gửi lần lượt, mỗi phần yêu cầu trả lời ngắn (ít token đầu ra); thanh trạng thái báo “phần i/n”.
- **Không gửi lại cả khối khi hết giờ chờ**: phần bị hết giờ / lỗi được bỏ qua, các phần khác vẫn dùng được, có thông báo số phần AI không trả lời.
- **Kết quả trên máy hiện ngay** (Sơ đồ vụ việc): AI bổ sung dần sau mỗi phần; nút **Dừng AI** giữ nguyên kết quả đã có.
- Ngữ cảnh Kho hồ sơ, kết luận AI, lời khai lần tiếp theo được giới hạn theo nhà cung cấp (AI trên máy nhỏ hơn).
- **Bảo đảm kết quả về đủ** (v2.23): phần nào lỗi / hết giờ / trả sai định dạng thì **tự chia đôi và gửi lại** (tối đa 2 lần chia), phần vẫn lỗi được **thử lại cuối lượt**; dịch vụ trực tuyến gửi **2 phần song song**; câu trả lời chạm giới hạn độ dài thì **tự yêu cầu viết tiếp** đúng chỗ dừng và ghép lại (mọi chức năng AI, tối đa 3 lần); JSON bị cắt dở vẫn lấy được các phần tử trọn vẹn.

## Bản cài đặt trên máy tính (Windows, macOS)

Ngoài bản web, ứng dụng có **bộ cài đặt** chạy như phần mềm riêng (Electron, thư mục `desktop/`), dùng được khi không có mạng.

- **Nút “Tải ứng dụng máy tính”** trong bản web (thanh bên, Cài đặt): tự nhận biết Windows / macOS chip Apple / Intel, tải thẳng bộ cài của bản mới nhất kèm hướng dẫn cài.
- **Tải về**: [GitHub Releases](https://github.com/ngovietdinh/trolyvanban/releases/latest) — Windows `TroLyVanBan-x.y.z-win-x64.exe`; macOS `…-mac-arm64.dmg` (chip Apple M1/M2…) hoặc `…-mac-x64.dmg` (Intel). Trong bản web: nút **Tải ứng dụng máy tính**.
- **Phân quyền mặc định của bản cài đặt: toàn quyền.** Tài khoản đầu tiên tạo trên máy là **Quản trị tối cao**; tài khoản tự đăng ký sau đó là **Quản trị viên có đủ mọi quyền** (văn bản, công cụ, AI, Tố tụng, AI trực tuyến trong Tố tụng, quản lý tài khoản), không phải chờ cấp quyền. Vẫn có thể hạ quyền từng tài khoản trong **Quản trị tài khoản**. Bản web giữ nguyên cách cũ (Người dùng, chờ cấp quyền, Tố tụng ẩn).
- Dữ liệu, tài khoản, API key lưu trong thư mục dữ liệu của người dùng (Windows `%APPDATA%\Trợ Lý Văn Bản AI`, macOS `~/Library/Application Support/Tro Ly Van Ban AI`); gỡ cài đặt hoặc cài bản mới đè lên không mất dữ liệu. Menu **Trợ giúp → Mở thư mục dữ liệu**.
- **Cập nhật tại chỗ, không cần tải lại bộ cài** (từ v2.16.0): ứng dụng tự kiểm tra khi mở và mỗi 6 giờ; có bản mới thì hiện **“Cập nhật ngay”** — chỉ tải các tệp mã web thay đổi (thường vài MB, theo `web-manifest.json` đăng kèm mỗi bản phát hành, tải từ đúng commit, kiểm tra sha256), lưu vào thư mục dữ liệu (`web-updates/`) rồi khởi động lại; dữ liệu giữ nguyên. Bản cập nhật không khởi động được trong 25 giây → tự quay về bản trước. Khi bản mới cần thay vỏ ứng dụng (`shellApi` trong `desktop/package.json` tăng) thì nút chuyển thành **“Tải bộ cài mới”**. Bản đã cài trước v2.16.0 cần tải bộ cài một lần.
- Bộ cài chưa ký số: Windows SmartScreen chọn *Thông tin thêm → Vẫn chạy*; macOS lần đầu mở sẽ báo “không thể mở vì Apple không thể kiểm tra phần mềm độc hại”: bấm *OK*, vào *Cài đặt hệ thống → Quyền riêng tư & Bảo mật*, kéo xuống mục Bảo mật, bấm *Vẫn mở* (Open Anyway) rồi nhập mật khẩu máy — chỉ cần làm một lần. Cách khác: mở Terminal, chạy `xattr -cr "/Applications/Tro Ly Van Ban AI.app"`.
- **Đóng gói**: mỗi khi `version.json` trên `main` đổi, GitHub Actions (`.github/workflows/desktop.yml`) build bộ cài Windows và macOS rồi đăng lên Releases (cũng chạy tay được ở tab Actions). Build trên máy: `node scripts/desktop.mjs && cd desktop && npm install && npm run dist:win` (hoặc `dist:mac` trên máy Mac); chạy thử `npm run desktop:start`.

**Cập nhật tại chỗ — nguồn tải dự phòng** (v2.23): danh sách tệp lấy từ bản phát hành (dự phòng qua GitHub API); từng tệp tải lần lượt từ raw.githubusercontent.com → cdn.jsdelivr.net → github.com/raw (mỗi nguồn thử 2 lần, phải khớp sha256) — mạng cơ quan chặn một nguồn vẫn cập nhật được. Bộ cài cũ (trước v2.16) chưa có cập nhật tại chỗ: phần mềm mở hộp thoại tải đúng bộ cài theo máy (Windows / Mac chip Apple / Mac Intel) kèm giải thích — cài đè một lần, dữ liệu giữ nguyên. Cài đặt → Kiểm tra cập nhật hiện phiên bản bộ cài và mã đang chạy. CI chạy kiểm thử cập nhật tại chỗ thật trên macOS và Windows trước mỗi lần phát hành.

## Phân hệ Tố tụng hình sự

**Phân tích vụ việc theo 4 bước** (nút “Phân tích vụ việc” đầu cây hỏi đáp, trang tổng quan; `#legal/vu-viec`) — khi chưa rõ điều luật: ① nhập hành vi thủ công (mỗi dòng một hành vi) và/hoặc tải Word, PDF (cả bản quét), ảnh → ② hệ thống đề xuất điều luật (lý do, mức độ phù hợp, dấu hiệu định tội), chọn một hoặc nhiều điều và điều chính, tìm thêm điều khác → ③ duyệt hành vi theo từng điều: hành vi có sẵn, hành vi tự nhập, hành vi có sẵn chưa được phát hiện → ④ màn hình kế hoạch hỏi (điều chính + điều liên quan) mở ngay ở **sơ đồ cây**, thanh bước để quay lại. Dữ liệu đang phân tích được lưu theo tài khoản. **Cách phân tích** (chọn ở bước ①): *Đối chiếu Bộ luật* trong phần mềm (chạy trên máy), *AI phân tích* (điều luật AI nêu được kiểm tra với Bộ luật trong phần mềm) hoặc *Kết hợp*; bước ② hiện **đối chiếu dấu hiệu định tội** của từng điều với nội dung (kể cả so số tiền với ngưỡng “từ … đồng trở lên”). Hành vi nhập tay khớp hành vi có sẵn hoặc điều gần nhất (ưu tiên tên tội danh; tội “biến thể” như vô ý, khi thi hành công vụ, vượt quá phòng vệ chỉ chọn khi mô tả có tình tiết đó).

**Câu hỏi theo trình tự điều tra** — bộ câu hỏi lần đầu đi theo trình tự của điều tra viên: *Tự trình bày* (để người khai kể toàn bộ, không gợi ý) → *Cụ thể hóa* (bắt đầu – kết thúc, số lần, từng lần; quy trình đúng phải làm và đã làm sai ở đâu; ai đề xuất, quyết định, thực hiện; phương tiện, tài khoản, con dấu) → *Kiểm chứng* (tài liệu, dữ liệu điện tử, người chứng kiến) → *Đối chiếu* (chữ ký trên chứng từ, hành vi che giấu, hợp thức hóa, thông cung) → *Chốt lại* (bổ sung, đính chính, tự nguyện, không bị ép buộc). Nhãn bước hiện ở từng câu hỏi trong cây hỏi đáp.

**Lời khai lần tiếp theo** (nút “Lời khai lần tiếp theo” trong màn hình Ghi lời khai; Hồ sơ vụ án → Ghi lời khai; Theo dõi → Lần tiếp theo) — đọc toàn bộ biên bản trước của cùng người và lập kế hoạch hỏi lần N: ① xác nhận giữ nguyên / thay đổi lời khai cũ, có bị tác động không; ② làm rõ chi tiết đã khai: câu trả lời mơ hồ, chối bỏ, quá ngắn (dẫn nguyên văn “Tại biên bản lần 1 ngày…, khi được hỏi…, anh/chị trả lời…”), số tiền (từng lần, giao nhận, tài khoản, sử dụng vào đâu), người được nhắc tên, mốc thời gian; ③ câu hỏi kế hoạch còn bỏ ngỏ theo từng vấn đề; ④ dấu hiệu định tội chưa có lời khai đề cập; ⑤ đối chiếu lời khai thay đổi giữa các lần và mâu thuẫn số liệu với người khác, đề nghị đối chất; ⑥ chốt lại. Mỗi câu có lý do cần hỏi; chọn / bỏ từng nhóm; AI đề xuất thêm câu hỏi dẫn chiếu biên bản (tùy chọn); nhân thân lấy từ lần trước.

**Sơ đồ vụ việc** (`#so-do`, thanh bên; nút “Sơ đồ vụ việc” trong Hồ sơ vụ án và Theo dõi) — chọn các biên bản lời khai (theo hồ sơ, tích từng biên bản) hoặc tải tài liệu (Word, PDF, ảnh, dán chữ) rồi bấm “Vẽ sơ đồ”: **Bản chất** (tóm tắt, ý then chốt: điều luật, ai làm gì, dòng tiền, ai chỉ đạo, người được nhắc nhiều nhất, số tiền lớn nhất, khoảng thời gian); **Sơ đồ hành vi** (cây Vụ việc → Điều luật → Hành vi → người thực hiện, số tiền, trích dẫn; nhánh Người liên quan với các quan hệ; nhánh Dòng thời gian — dùng chung bộ sơ đồ cây có tìm kiếm, phóng to, toàn màn hình trình bày); **Quan hệ – dòng tiền** (sơ đồ người – mũi tên: tiền, chỉ đạo, quan hệ khác; vai trò tự suy ra: người chỉ đạo, người nhận tiền, người đưa tiền; bấm một người để làm nổi quan hệ; bảng kèm căn cứ trích dẫn); **Dòng thời gian**. Chạy trên máy (nhận diện tên theo danh xưng / chức danh và người trong hồ sơ, “tôi” = người khai); có AI thì phân tích sâu, điều luật vẫn được kiểm tra với Bộ luật trong phần mềm. Xuất Word / bản in có bảng biểu.

**Theo dõi & báo cáo** (`#theo-doi`, mục “Theo dõi & báo cáo” ở thanh bên; nút “Theo dõi tiến độ” trong hồ sơ vụ án) — nhìn nhanh tình trạng từng hồ sơ:
- **Bảng tổng hợp** mọi hồ sơ: tội danh, người đã lấy lời khai, số biên bản, tiến độ câu hỏi, số cảnh báo, tình trạng (Chưa bắt đầu / Đang thực hiện / Gần hoàn thành / Đã hoàn thành), lọc theo tình trạng; danh sách cảnh báo cần xử lý; kế hoạch hỏi chưa gắn hồ sơ.
- **Trạng thái từng câu hỏi** của kế hoạch: Chưa hỏi, Đã hỏi (chưa có trả lời), Cần làm rõ (trả lời mơ hồ, né tránh), Đã có trả lời, Không cần hỏi — tự tính từ các biên bản của kế hoạch (gắn trực tiếp, hoặc cùng hồ sơ + cùng điều + cùng tư cách người khai; khớp câu hỏi theo nội dung), đánh dấu thủ công được. Hiện ở Cây hỏi đáp (thanh theo dõi, chấm trạng thái từng vấn đề, ô trạng thái và câu trả lời của từng câu) và trên sơ đồ cây.
- **Từng hồ sơ**: Tổng quan (việc đã làm / chưa làm kèm nút Làm ngay, người tham gia, kế hoạch), Theo kế hoạch, **Bảng kết quả** (vấn đề – câu hỏi – câu trả lời của từng người khai – trạng thái), **Cảnh báo** (chưa xác định tội danh, bị can chưa lấy lời khai, hành vi / lỗi / hậu quả chưa làm rõ, câu hỏi quan trọng chưa có trả lời, trả lời mơ hồ, mâu thuẫn, dấu hiệu định tội chưa có lời khai, biên bản ghi dở, hồ sơ lâu không hoạt động), **Phân tích & kết luận** (đối chiếu lời khai với dấu hiệu định tội, số tiền, mâu thuẫn, kết luận sơ bộ trên máy; nhận định AI tùy chọn, lưu vào hồ sơ).
- **Tải biên bản lên**: Word, PDF (cả bản quét), ảnh chụp hoặc dán nội dung → tự tách Hỏi – Đáp, nhận họ tên, ngày, lần, hỏi cung/ghi lời khai; gắn hồ sơ, người khai (người mới được thêm vào hồ sơ), kế hoạch hỏi để đánh dấu câu đã trả lời.
- **Báo cáo Word** (và xem bản in) có bảng biểu: báo cáo tổng hợp mọi hồ sơ hoặc báo cáo tiến độ, kết quả lấy lời khai của từng hồ sơ.

**Danh mục tính năng** (nút “Tính năng” ở góc phải trên cùng): mọi tính năng hiện có — làm gì, ai dùng, mục đích, quyền cần có, ở đâu, có từ phiên bản nào (`assets/js/feature-list.js`); tìm kiếm, lọc theo nhóm, đánh giá tình trạng và ghi chú theo dõi từng tính năng, thêm đề xuất tính năng mới, xuất Word.

**Sơ đồ cây kế hoạch hỏi**: Kế hoạch → Điều chính / Điều liên quan → Hành vi vi phạm, Cấu thành – định khung – chuyên môn → câu hỏi; nhánh Vấn đề chung (Điều 85 BLTTHS), Tài liệu – giám định. Mở / thu gọn từng nhánh (hiệu ứng hiện dần, đường nối mọc ra), mở rộng / thu gọn tất cả, rê chuột làm nổi đường đi, tìm trong sơ đồ, phóng to / thu nhỏ; nút **Toàn màn hình · Trình bày** (toàn màn hình thật để trình chiếu, tiêu đề vụ việc, làm nổi nhánh đang trình bày, phím + − 0 E C F Esc); bấm câu hỏi để tới bộ câu hỏi.

**Thêm hành vi từ tài liệu** (cây hỏi đáp → bước ① Hành vi vi phạm): tải đơn tố giác, báo cáo, kết luận thanh tra, biên bản (PDF có chữ hoặc ảnh quét, Word, ảnh chụp, văn bản) hoặc dán nội dung. Hệ thống tóm tắt, liệt kê hành vi có dấu hiệu tội phạm kèm đoạn trích làm căn cứ, đối chiếu với các điều luật trong hệ thống: tên tội danh, “Điều …” được viện dẫn (bỏ qua điều của BLTTHS, luật khác), hành vi đã có. Người dùng tích / bỏ tích, sửa tên, đổi điều luật, sửa câu hỏi sẽ sinh rồi bấm **Thêm hành vi**: hành vi có sẵn dùng bộ câu hỏi có sẵn; hành vi mới được lưu thành hành vi tự thêm, câu hỏi sinh theo đoạn trích và dấu hiệu định tội của điều. **Một vụ việc nhiều điều luật**: hành vi thuộc điều khác được thêm vào “Điều luật liên quan cùng vụ việc”, kế hoạch hỏi có thêm vấn đề “[Điều …]” theo từng điều (lưu cùng kế hoạch, biên bản, phiếu hỏi). Có AI (kể cả AI chạy trên máy) thì phân tích sâu hơn; điều luật AI nêu được kiểm tra với hệ thống.

| Thành phần | Mô tả |
|---|---|
| **Cây hỏi đáp pháp luật** (`#legal`) | Lĩnh vực → nhóm → tội danh → hành vi vi phạm. Phủ **toàn bộ Phần các tội phạm** (Chương XIII – XXVI) Bộ luật Hình sự 2015 (sửa đổi, bổ sung 2017, 2025), tự chia thành 17 lĩnh vực: An ninh quốc gia; Tính mạng – sức khỏe – nhân phẩm; Quyền tự do – dân chủ; Sở hữu; Hôn nhân – gia đình; Kinh tế; Môi trường; Ma túy; An toàn giao thông; Công nghệ thông tin – mạng viễn thông; Y tế – an toàn công cộng; Trật tự công cộng; Trật tự quản lý hành chính; Chức vụ – tham nhũng; Hoạt động tư pháp; Nghĩa vụ quân nhân; Hòa bình – chống loài người – chiến tranh. 83 tội có dữ liệu chuyên sâu (từng hành vi, câu hỏi chuyên ngành); các tội còn lại sinh cấu thành và bộ câu hỏi theo mẫu của chương. **Cập nhật Bộ luật từ văn bản chính thức**: nạp tệp Word/.txt hoặc dán toàn văn Văn bản hợp nhất để xác thực tên điều, xem nguyên văn từng điều, lấy dấu hiệu định tội (khoản 1) và tình tiết định khung (điểm của khoản 2 trở đi) đúng văn bản; điều bị bãi bỏ tự loại khỏi cây. |
| **Bộ máy sinh câu hỏi** (`assets/js/legal/engine.js`) | Kết hợp 4 lớp: luật hình sự (cấu thành, định khung, Điều 51, 52), luật tố tụng (Điều 85 BLTTHS, quyền của người tham gia tố tụng), nghiệp vụ điều tra (5W1H, đồng phạm, dòng tiền, vật chứng) và chuyên môn ngành (tài chính, đấu thầu, xây dựng, ngân hàng, thuế, hải quan, đất đai, môi trường, y dược, ATTP, PCCC…). Câu hỏi thay đổi theo đối tượng: bị can, người bị tạm giữ, người bị tố giác, người làm chứng, người tố giác, người có quyền lợi liên quan, bị hại. |
| **Tinh chỉnh** | Thêm, sửa, xóa câu hỏi; lưu câu hỏi vào “bộ câu hỏi của tôi” để tự xuất hiện lần sau; **gợi ý AI cho từng câu hỏi** (câu hỏi truy tiếp) và cho từng vấn đề — khi chưa được cấp AI thì dùng gợi ý ngoại tuyến; **thêm hành vi vi phạm thủ công** (tên, câu hỏi đặc thù, tài liệu cần thu thập); sơ đồ cây trực quan; xuất kế hoạch hỏi ra Word. |
| **Dán & chuyển đổi** | Trong màn hình ghi lời khai: dán nội dung ghi chép (dạng “Hỏi:/Trả lời:” hoặc chỉ các đoạn trả lời) → “Chuyển đổi” (chạy trên máy, chuẩn hóa văn phong) hoặc “Chuyển đổi bằng AI” → xem trước → đưa vào biên bản; đoạn trả lời rời được ghép lần lượt với các câu hỏi chưa trả lời. |
| **Phiếu hỏi** | “Phiếu hỏi Word”: xuất biên bản có sẵn toàn bộ câu hỏi của cây, phần trả lời để dòng chấm điền tay; hoặc đưa sẵn toàn bộ câu hỏi vào biên bản khi bắt đầu ghi / bằng nút “Thêm tất cả câu hỏi vào biên bản”. |
| **Ghi lời khai** (`#interview`) | Biên bản hỏi cung bị can / biên bản ghi lời khai: kế hoạch hỏi bên trái (đánh dấu đã hỏi, mức độ làm rõ từng vấn đề), ghi hỏi – đáp ở giữa, trợ lý phân tích bên phải (gợi ý câu hỏi truy tiếp, phát hiện mâu thuẫn trong và giữa các lời khai, đánh giá mức độ làm rõ, chuẩn hóa văn phong). Thông báo quyền – nghĩa vụ, xuất biên bản Word đúng thể thức với đủ chữ ký. Mẫu biên bản theo **Mẫu số 140 — Thông tư 128/2025/TT-BCA ngày 19/12/2025** (ô mẫu số góc phải, quốc hiệu căn giữa, chú thích cuối trang, “Tôi: …”, nhân thân, “HỎI VÀ ĐÁP” với Hỏi/Đáp, chữ ký NGƯỜI KHAI – ĐIỀU TRA VIÊN, đánh số trang từ trang 2); biên bản hỏi cung bị can dùng cùng bố cục; căn cứ theo tư cách người khai (bị can Điều 178, 183, 184; người làm chứng Điều 185–187; bị hại, người liên quan Điều 187, 188; người bị giữ/bắt/tạm giữ Điều 58, 59; giai đoạn giải quyết nguồn tin Điều 145, 147), ghi âm/ghi hình hỏi cung tại trụ sở (khoản 6 Điều 183), số trang, ký từng trang; “Mẫu số / Ban hành kèm theo Thông tư …” cấu hình trong Cài đặt. |
| **Kho hồ sơ & Trợ lý AI** (`#kho`) | Tải lên hồ sơ, tài liệu (Word .docx, PDF có lớp chữ, .txt — nhiều tệp, kéo thả), lưu trên máy (IndexedDB) theo từng tài khoản, gắn với hồ sơ vụ án. Tự nhận diện loại tài liệu (biên bản ghi lời khai, hỏi cung, quyết định, kết luận giám định…), người khai, nhân thân, ngày, các lượt Hỏi/Đáp. Tìm kiếm toàn văn không dấu. Trợ lý dùng tài liệu đã chọn (và biên bản, văn bản đã lập trong phần mềm) làm dữ liệu: **hỏi đáp, tóm tắt, tìm mâu thuẫn có trích dẫn nguồn**; ra lệnh bằng lời như “Tạo biên bản lời khai mới dựa vào các BBLK cũ để làm rõ…” → tự lập biên bản Mẫu 140 lần kế tiếp với nhân thân và câu hỏi làm rõ mâu thuẫn, nội dung chưa cụ thể, số liệu; “Tạo quyết định trưng cầu giám định…” → tự chọn mẫu trong 125 biểu mẫu và điền từ hồ sơ. Không có AI vẫn hoạt động (tìm kiếm, phân tích, lập biên bản, điền mẫu trên máy). |
| **Lịch sử trò chuyện & xóa** | Trợ lý AI lưu nhiều cuộc trò chuyện (tìm kiếm, mở lại, xóa từng cuộc / từng tin nhắn / toàn bộ, có hoàn tác); Trợ lý hồ sơ lưu và xóa được cuộc trò chuyện; Cài đặt → Xóa lịch sử trò chuyện. Mọi văn bản đã tạo đều có nút xóa kèm Hoàn tác (Tài liệu của tôi, Tổng quan, trình soạn thảo, văn bản tố tụng, kế hoạch hỏi, biên bản, kho hồ sơ). |
| **Sao chép & Tạo văn bản chuẩn** | Mọi câu trả lời AI (Trợ lý AI, Trợ lý hồ sơ, tóm tắt) có nút Sao chép và **Tạo văn bản chuẩn**: tự đoán loại văn bản, trích yếu; AI chuẩn hóa nội dung theo cấu trúc loại văn bản rồi mở trình soạn thảo đúng thể thức NĐ 30/2020. |
| **Hướng dẫn sử dụng** (`#help`) | Trung tâm hướng dẫn cho 20 mục (bắt đầu nhanh, quy trình mẫu một vụ án, từng chức năng): các bước có đánh số, mẹo, ví dụ minh họa (sao chép hoặc **Thử ngay** — mở chức năng và điền sẵn ví dụ), bảng “Tránh / Nên”, hỏi đáp, phím tắt, lộ trình làm quen có theo dõi tiến độ, tìm kiếm không dấu. Ở mọi màn hình: nút **?** hoặc phím **F1** mở ngăn hướng dẫn đúng màn hình đang dùng; gợi ý “Lần đầu dùng?” trên thanh trên cùng (ẩn được). Hướng dẫn tự ẩn theo quyền của tài khoản. |
| **Giao diện điện thoại** | Thanh điều hướng dưới kiểu ứng dụng (theo quyền tài khoản, ẩn khi bàn phím mở); màn hình nhiều cột (Cây hỏi đáp, Ghi lời khai, Kho hồ sơ, Biểu mẫu, Hướng dẫn) chia thẻ, tự chuyển thẻ khi chọn; hộp thoại dạng tấm trượt từ dưới lên; ô nhập 16px (iOS không tự phóng to), vùng chạm ≥ 40px, hỗ trợ tai thỏ / thanh home; bảng tài khoản thành thẻ; chế độ sáng/tối trong menu tài khoản. |
| **Biểu mẫu tố tụng** (`#forms`) | 125 biểu mẫu văn bản tố tụng hình sự chia 15 giai đoạn: tiếp nhận, giải quyết nguồn tin; khởi tố vụ án, bị can; phân công, thay đổi người tiến hành tố tụng; giữ người, bắt, tạm giữ, tạm giam; cấm đi khỏi nơi cư trú, bảo lĩnh, đặt tiền, tạm hoãn xuất cảnh, áp giải, kê biên, phong tỏa; triệu tập, đối chất, nhận dạng; khám xét, thu giữ, tạm giữ; khám nghiệm, thực nghiệm; giám định, định giá; vật chứng; người bào chữa, bảo vệ; gia hạn, tạm đình chỉ, phục hồi, đình chỉ; kết luận điều tra; truy nã, pháp nhân, người dưới 18 tuổi; biên bản dùng chung. Đủ loại quyết định, lệnh (có ô phê chuẩn của Viện kiểm sát), biên bản (bố cục Mẫu 140), thông báo, giấy triệu tập, đề nghị, bản kết luận điều tra. Tự điền từ hồ sơ vụ án và người tham gia tố tụng, AI soạn phần nội dung, xem trước A4, xuất Word, lưu vào hồ sơ; số mẫu (TT 128/2025/TT-BCA) nhập và ghi nhớ cho từng mẫu. |
| **Xóa lời khai** | Xóa từng biên bản, chọn nhiều/chọn tất cả để xóa, xóa ngay trong màn hình ghi lời khai hoặc trong hồ sơ vụ án; có xác nhận và nút **Hoàn tác**; ghi nhật ký hoạt động. |
| **Hồ sơ vụ án** (`#cases`) | Thông tin vụ án, người tham gia tố tụng, kế hoạch hỏi, danh sách biên bản, đối chiếu mâu thuẫn giữa các lời khai. |

Mặc định trợ lý phân tích chạy bằng quy tắc cục bộ (trích xuất số tiền, mốc thời gian, tên người; phát hiện số liệu khai không thống nhất). Chỉ khi tài khoản được cấp quyền “AI trực tuyến trong Tố tụng” và có API key, nội dung lời khai mới được gửi tới dịch vụ AI.

> Dữ liệu điều luật được biên soạn theo BLHS 2015 (sửa đổi 2017, Luật 86/2025/QH15) và BLTTHS 2015 nhằm hỗ trợ nghiệp vụ; cần đối chiếu nguyên văn văn bản hiện hành trước khi sử dụng chính thức.

## Chạy thử

Trang web tĩnh, không cần build:

```bash
npm install        # chỉ cần cho kiểm thử
npm start          # http://localhost:4173
```

Có thể triển khai thẳng lên GitHub Pages, Netlify, Vercel hoặc bất kỳ máy chủ tĩnh nào.

### Bật AI

Vào **Cài đặt → Trí tuệ nhân tạo**, chọn nhà cung cấp (Claude, ChatGPT, Gemini, Grok, Groq), dán API key và chọn mô hình (có thể nhập tên mô hình tự do). Claude mặc định dùng `claude-opus-5-5`.

> Khi triển khai cho nhiều người dùng, nên đặt một máy chủ trung gian giữ API key thay vì để mỗi người tự nhập khóa.

## Kiểm thử

```bash
npm test           # unit test (node:test) — đọc số, thể thức, DOCX, chính tả, tóm tắt, trợ lý, dữ liệu điều luật, bộ sinh câu hỏi, biên bản
npm run test:e2e   # test end-to-end (Playwright) trên desktop & di động, gồm API Claude giả lập
npm run test:desktop  # mở bản cài đặt Electron thật (Linux cần xvfb-run): toàn quyền mặc định, OCR, lưu dữ liệu, cập nhật tại chỗ
```

## Cấu trúc

```
index.html              Trang giới thiệu
app.html                Không gian làm việc (SPA, điều hướng bằng hash)
assets/css/             base (hệ thống thiết kế) · landing · app · document (trang A4 & in)
assets/js/lib/          Lõi xử lý thuần: doc-types, render-html, docx, spellcheck, summarize, number-words, ai, store
assets/js/legal/        Tri thức pháp luật & tố tụng: điều luật, chuyên môn, đối tượng, bộ sinh câu hỏi, biên bản, trợ lý phân tích
assets/js/views/        Các màn hình của ứng dụng
assets/fonts, vendor/   Phông Be Vietnam Pro · Newsreader · Tinos và SDK Anthropic đóng gói sẵn (npm run vendor)
tests/                  unit/ và e2e/
```
