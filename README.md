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
| **Kho tài liệu** | Lưu, tìm kiếm không dấu, gắn sao, nhân bản, xuất Word, sao lưu / khôi phục JSON. |
| **Khác** | Tài khoản cục bộ, bảng lệnh `Ctrl + K`, phím tắt `Ctrl + S`, giao diện sáng/tối, tối ưu di động. |

## Chạy thử

Trang web tĩnh, không cần build:

```bash
npm install        # chỉ cần cho kiểm thử
npm start          # http://localhost:4173
```

Có thể triển khai thẳng lên GitHub Pages, Netlify, Vercel hoặc bất kỳ máy chủ tĩnh nào.

### Bật AI Claude

Vào **Cài đặt → Trí tuệ nhân tạo**, dán API key Anthropic (`sk-ant-…`). Khóa chỉ lưu trên trình duyệt; yêu cầu được gửi trực tiếp tới Anthropic. Mặc định dùng `claude-opus-5-5` (có thể chọn Sonnet 5.5 / Haiku 4.5).

> Khi triển khai cho nhiều người dùng, nên đặt một máy chủ trung gian giữ API key thay vì để mỗi người tự nhập khóa.

## Kiểm thử

```bash
npm test           # 61 unit test (node:test) — đọc số, thể thức, DOCX, chính tả, tóm tắt, trợ lý
npm run test:e2e   # 44 test end-to-end (Playwright) trên desktop & di động, gồm API Claude giả lập
```

## Cấu trúc

```
index.html              Trang giới thiệu
app.html                Không gian làm việc (SPA, điều hướng bằng hash)
assets/css/             base (hệ thống thiết kế) · landing · app · document (trang A4 & in)
assets/js/lib/          Lõi xử lý thuần: doc-types, render-html, docx, spellcheck, summarize, number-words, ai, store
assets/js/views/        Các màn hình của ứng dụng
assets/fonts, vendor/   Phông Be Vietnam Pro · Newsreader · Tinos và SDK Anthropic đóng gói sẵn (npm run vendor)
tests/                  unit/ và e2e/
```
