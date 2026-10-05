# Trợ Lý Văn Bản AI

Nền tảng soạn thảo văn bản hành chính tiếng Việt, trình bày đúng thể thức **Nghị định 30/2020/NĐ-CP**, có trợ lý AI (Claude).

## Tính năng

| Phân hệ | Mô tả |
|---|---|
| **Soạn văn bản** | 8 loại: công văn, quyết định, tờ trình, báo cáo, thông báo, kế hoạch, giấy mời, biên bản. Xem trước trang A4 trực tiếp, tự trình bày quốc hiệu, tiêu ngữ, số ký hiệu, ngày tháng (tự thêm số 0), nơi nhận, quyền hạn ký. |
| **Soạn bằng AI** | Mô tả một câu → AI điền trích yếu và nội dung. Dùng Claude khi có API key; nếu chưa có, dùng trợ lý mẫu chạy cục bộ. |
| **Xuất bản** | Xuất **Word (.docx)** chuẩn A4, lề 20/15/20/30 mm, Times New Roman; in / lưu PDF; sao chép văn bản. |
| **Trợ lý AI** | Hội thoại streaming với Claude; chuyển bản nháp sang trình soạn thảo bằng một chạm. |
| **Kiểm tra chính tả** | Lỗi s/x, ch/tr, dấu câu, khoảng trắng, viết hoa, lặp từ, thể thức ngày tháng / quốc hiệu; sửa từng lỗi hoặc tất cả; điểm chất lượng; đọc tệp .docx/.txt. |
| **Tóm tắt văn bản** | Tóm tắt trích xuất cục bộ (từ khóa, thống kê) hoặc tóm tắt bằng Claude. |
| **Số thành chữ** | Đọc số tiền chuẩn chứng từ (mốt, lăm, tư, linh…) tới hàng tỷ tỷ, có lịch sử. |
| **Mẫu từ file Word** (`#tpl/new`) | Tải lên tệp .docx có sẵn → nhận diện tự động các phần cần điền (số ký hiệu, địa danh – ngày tháng, kính gửi, họ tên, địa chỉ, số tiền, ô `[..]`) hoặc **AI chắt lọc mẫu**; bôi đen chữ trong bản xem trước để tạo trường; xem trước, lưu vào “Mẫu của tôi”, điền nội dung và xuất Word giữ nguyên định dạng gốc (bảng, đầu/cuối trang). |
| **Kho tài liệu** | Lưu, tìm kiếm không dấu, gắn sao, nhân bản, xuất Word, sao lưu / khôi phục JSON. |
| **Khác** | Tài khoản cục bộ, bảng lệnh `Ctrl + K`, phím tắt `Ctrl + S`, giao diện sáng/tối, tối ưu di động. |

## Tài khoản, phân quyền & bảo mật

Ứng dụng **bắt buộc đăng nhập** và chạy hoàn toàn cục bộ: tài khoản, dữ liệu, API key đều lưu trên máy người dùng.

| Vai trò | Quyền mặc định |
|---|---|
| **Quản trị tối cao** (`gsnvbu@gmail.com`) | Toàn quyền; không thể bị hạ quyền, khóa hay xóa |
| **Quản trị viên** | Văn bản, công cụ, AI, Tố tụng, quản lý tài khoản (trừ quản trị viên khác) |
| **Điều tra viên** | Văn bản, công cụ, AI, Tố tụng |
| **Người dùng** | Văn bản, công cụ, AI |

- Mỗi quyền có thể bật/tắt riêng cho từng tài khoản (màn hình **Quản trị tài khoản**). Có nhật ký hoạt động, khóa tài khoản, đặt lại mật khẩu, bật/tắt tự đăng ký.
- **Phân hệ Tố tụng** chỉ hiện với tài khoản được cấp quyền và được ẩn khỏi trang giới thiệu công khai. Quyền **“AI trực tuyến trong Tố tụng”** mặc định tắt với mọi vai trò — khi chưa được cấp, mọi phân tích lời khai chạy ngoại tuyến, không gửi dữ liệu ra ngoài.
- Dữ liệu (văn bản, hồ sơ, biên bản, lịch sử) **tách riêng theo tài khoản**.
- **API key** ChatGPT (OpenAI), Gemini (Google), Grok (xAI), Claude (Anthropic): mỗi tài khoản tự nhập, mã hóa AES-GCM bằng khóa sinh từ mật khẩu (PBKDF2-SHA256, 310.000 vòng). Không lưu mật khẩu; quản trị viên không đọc được khóa của người khác; đặt lại mật khẩu sẽ xóa kho khóa.
- Phiên đăng nhập nằm trong `sessionStorage` — tự hết khi đóng trình duyệt.
- **Xóa toàn bộ dữ liệu** chỉ xóa văn bản, hồ sơ, biên bản, lịch sử; tài khoản, API key và cài đặt được giữ lại.

> Giới hạn của mô hình chạy cục bộ: phân quyền được kiểm tra trong trình duyệt, đủ để phân tách người dùng thông thường trên cùng máy nhưng không thay thế được máy chủ xác thực tập trung. Mỗi máy có hệ thống tài khoản riêng.

## Cập nhật phiên bản & dùng ngoại tuyến

- Service worker (`sw.js`) lưu bộ nhớ đệm để dùng được khi mất mạng.
- Khi máy chủ có bản mới, ứng dụng hiện thông báo **“Đã có phiên bản mới — Cập nhật ngay”**; cũng có thể kiểm tra trong **Cài đặt → Phiên bản & cập nhật**. Cập nhật chỉ thay mã nguồn, dữ liệu trên máy giữ nguyên.
- Phát hành bản mới: `npm run release -- 2.1.0 "Ghi chú thay đổi"` (đồng bộ `version.json`, `sw.js`, `assets/js/version.js`), rồi triển khai lên máy chủ tĩnh.

## Phân hệ Tố tụng hình sự

| Thành phần | Mô tả |
|---|---|
| **Cây hỏi đáp pháp luật** (`#legal`) | Lĩnh vực → nhóm → tội danh → hành vi vi phạm. Phủ 4 lĩnh vực: **Kinh tế** (Chương XVIII, Điều 174, 175), **Chức vụ – tham nhũng** (Chương XXIII), **Môi trường** (Chương XIX, Điều 232–234), **Y tế – an toàn công cộng** (Điều 129, 139, 295, 298, 313, 315, 317). Mỗi điều luật có khách thể, chủ thể, lỗi, dấu hiệu định tội, các hành vi, tình tiết định khung và lĩnh vực chuyên môn liên quan. |
| **Bộ máy sinh câu hỏi** (`assets/js/legal/engine.js`) | Kết hợp 4 lớp: luật hình sự (cấu thành, định khung, Điều 51, 52), luật tố tụng (Điều 85 BLTTHS, quyền của người tham gia tố tụng), nghiệp vụ điều tra (5W1H, đồng phạm, dòng tiền, vật chứng) và chuyên môn ngành (tài chính, đấu thầu, xây dựng, ngân hàng, thuế, hải quan, đất đai, môi trường, y dược, ATTP, PCCC…). Câu hỏi thay đổi theo đối tượng: bị can, người bị tạm giữ, người bị tố giác, người làm chứng, người tố giác, người có quyền lợi liên quan, bị hại. |
| **Tinh chỉnh** | Thêm, sửa, xóa câu hỏi; lưu câu hỏi vào “bộ câu hỏi của tôi” để tự xuất hiện lần sau; **gợi ý AI cho từng câu hỏi** (câu hỏi truy tiếp) và cho từng vấn đề — khi chưa được cấp AI thì dùng gợi ý ngoại tuyến; **thêm hành vi vi phạm thủ công** (tên, câu hỏi đặc thù, tài liệu cần thu thập); sơ đồ cây trực quan; xuất kế hoạch hỏi ra Word. |
| **Phiếu hỏi** | “Phiếu hỏi Word”: xuất biên bản có sẵn toàn bộ câu hỏi của cây, phần trả lời để dòng chấm điền tay; hoặc đưa sẵn toàn bộ câu hỏi vào biên bản khi bắt đầu ghi / bằng nút “Thêm tất cả câu hỏi vào biên bản”. |
| **Ghi lời khai** (`#interview`) | Biên bản hỏi cung bị can / biên bản ghi lời khai: kế hoạch hỏi bên trái (đánh dấu đã hỏi, mức độ làm rõ từng vấn đề), ghi hỏi – đáp ở giữa, trợ lý phân tích bên phải (gợi ý câu hỏi truy tiếp, phát hiện mâu thuẫn trong và giữa các lời khai, đánh giá mức độ làm rõ, chuẩn hóa văn phong). Thông báo quyền – nghĩa vụ, xuất biên bản Word đúng thể thức với đủ chữ ký. Mẫu biên bản theo BLTTHS 2015 sửa đổi, bổ sung năm 2021, 2025 (Luật 99/2025/QH15): căn cứ theo tư cách người khai (bị can Điều 178, 183, 184; người làm chứng Điều 185–187; bị hại, người liên quan Điều 187, 188; người bị giữ/bắt/tạm giữ Điều 58, 59; giai đoạn giải quyết nguồn tin Điều 145, 147), ghi âm/ghi hình hỏi cung tại trụ sở (khoản 6 Điều 183), số trang, ký từng trang; “Mẫu số / Ban hành kèm theo Thông tư …” cấu hình trong Cài đặt. |
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

Vào **Cài đặt → Trí tuệ nhân tạo**, chọn nhà cung cấp (Claude, ChatGPT, Gemini, Grok), dán API key và chọn mô hình (có thể nhập tên mô hình tự do). Claude mặc định dùng `claude-opus-5-5`.

> Khi triển khai cho nhiều người dùng, nên đặt một máy chủ trung gian giữ API key thay vì để mỗi người tự nhập khóa.

## Kiểm thử

```bash
npm test           # unit test (node:test) — đọc số, thể thức, DOCX, chính tả, tóm tắt, trợ lý, dữ liệu điều luật, bộ sinh câu hỏi, biên bản
npm run test:e2e   # test end-to-end (Playwright) trên desktop & di động, gồm API Claude giả lập
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
