# Ghi chú cho Claude

- Trả lời người dùng bằng tiếng Việt.
- **Giao diện**: trước khi thêm hoặc sửa bất kỳ màn hình, tab, bảng, hộp thoại hay CSS nào, đọc `DESIGN.md` và làm theo (token ở `assets/css/base.css`). Không đổi kiểu toàn bộ ứng dụng khi không được yêu cầu; mục "Known debt" chỉ sửa khi đụng tới khu vực đó.
- Dữ liệu người dùng ở trên máy, riêng từng tài khoản. Không commit biểu mẫu riêng của người dùng hay nội dung sách Bình luận BLHS (có bản quyền).
- Tên người, số tiền, số hiệu văn bản giữ nguyên văn.
- Phát hành: `npm run release -- X.Y.Z "ghi chú 1" "ghi chú 2"`, rồi commit và đẩy lên nhánh làm việc và `main`.
- Kiểm thử: `npm test` (unit), `npm run test:e2e` (Playwright).
