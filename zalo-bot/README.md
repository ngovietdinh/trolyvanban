# Bot Zalo lấy nhanh biểu mẫu tố tụng

Nhắn cho bot trên Zalo số mẫu hoặc tên mẫu → bot trả **link tải file Word gốc** (đúng bố cục) lấy từ kho riêng
`mau-bieu-mau` trên GitHub. Bot chạy độc lập với phần mềm Trợ lý Văn bản, trên **Cloudflare Workers (miễn phí, 24/7)**.

```
Bạn:  140
Bot:  📄 Mẫu 140. Biên bản ghi lời khai
      ⬇️ https://tlvb-bieu-mau-bot.<tên>.workers.dev/f/…   (link hết hạn sau 15 phút)

Bạn:  qd khoi to bi can
Bot:  Có thể là:
      • 52. Quyết định khởi tố bị can
      • 53. Quyết định bổ sung Quyết định khởi tố bị can
      • 268. QĐ khởi tố bị can đối với pháp nhân …
      Nhắn số mẫu để lấy file.
```

- **Lệnh:** số mẫu (`140`, `mẫu 257A`) · tên / mô tả (gõ có dấu hay không dấu, viết tắt QĐ, BB, TB, ĐTV… đều được) · `ds 100` xem danh sách từ số 100 · `hd` hướng dẫn.
- **AI (tùy chọn):** khi câu hỏi mơ hồ, bot nhờ AI (Groq, mặc định `openai/gpt-oss-120b`) chọn trong ~20 mẫu ứng viên — vài trăm token mỗi lần, chỉ chọn trong danh sách có thật, có thể hỏi lại cho rõ. Không có AI bot vẫn tìm được.
- **An toàn:** chỉ tài khoản Zalo trong `ALLOWED_IDS` được dùng (người lạ chỉ nhận lại mã tài khoản của họ); bot đọc kho mẫu bằng token **chỉ đọc**, không lưu bản sao; link tải được mã hóa (không lộ tên tệp), tự hết hạn; webhook có mã bí mật sinh mới mỗi lần triển khai. Chỉ dùng cho **biểu mẫu trống** — không đưa dữ liệu vụ án vào bot.
- **Vì sao là link tải?** Zalo Bot chỉ gửi được chữ, ảnh, sticker, giọng nói — không gửi tệp Word.

## Cài đặt (một lần, làm trên trình duyệt, khoảng 15 phút)

### 1. Tạo bot Zalo, lấy token
Trên ứng dụng Zalo, tìm tài khoản **Zalo Bot Manager** → **Tạo bot** → đặt tên (vd “Bot biểu mẫu”) → Zalo gửi **Bot Token**
qua tin nhắn. Giữ token này bí mật. (Hướng dẫn chính thức: docs.zaloplatforms.com → Zalo Bot → Tạo bot.)

### 2. Tạo tài khoản Cloudflare (miễn phí)
1. Đăng ký tại **dash.cloudflare.com**.
2. Vào **Workers & Pages** → chép **Account ID** (cột bên phải).
3. Bấm ảnh đại diện → **My Profile → API Tokens → Create Token** → dùng mẫu **Edit Cloudflare Workers** → **Continue to summary → Create Token** → chép token.

### 3. Tạo token GitHub chỉ đọc kho mẫu
**github.com/settings/personal-access-tokens/new** (Fine-grained token):
- *Repository access*: **Only select repositories** → chọn `mau-bieu-mau`
- *Permissions → Repository permissions → Contents*: **Read-only**
- *Expiration*: 1 năm → **Generate token** → chép.

### 4. (Tùy chọn) Key Groq cho AI
**console.groq.com/keys** → *Create API Key* → chép.

### 5. Khai báo bí mật trong kho `trolyvanban`
GitHub → kho `trolyvanban` → **Settings → Secrets and variables → Actions → New repository secret**, tạo lần lượt:

| Tên | Giá trị |
|---|---|
| `CLOUDFLARE_API_TOKEN` | token ở bước 2.3 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID ở bước 2.2 |
| `ZALO_BOT_TOKEN` | Bot Token ở bước 1 |
| `MAU_GITHUB_TOKEN` | token ở bước 3 |
| `GROQ_API_KEY` | (tùy chọn) key ở bước 4 |

### 6. Triển khai
**Actions → Bot Zalo biểu mẫu → Run workflow**. Khoảng 1 phút, trang kết quả báo “Bot Zalo đã chạy ✅” kèm địa chỉ bot.

### 7. Cấp quyền cho tài khoản Zalo của bạn
1. Nhắn bất kỳ chữ gì cho bot → bot trả lời **“Mã tài khoản Zalo của bạn: …”**.
2. Tạo thêm secret `ALLOWED_IDS` = mã đó (nhiều người thì cách nhau dấu phẩy).
3. **Run workflow** lại. Xong — nhắn `140` để thử.

## Ghi chú
- Thêm / sửa mẫu: chỉ cần cập nhật kho `mau-bieu-mau` (tên tệp dạng `140. Tên mẫu.doc`); bot tự đọc lại sau tối đa 10 phút.
- Gói miễn phí Cloudflare: 100.000 yêu cầu/ngày — dư cho dùng cá nhân.
- Đổi thời hạn link: sửa `LINK_MINUTES` trong `wrangler.toml`. Kho mẫu khác: sửa `MAU_REPO`, `MAU_REF`, `MAU_DIR`.
- Kiểm thử: `node --test tests/unit/zalo-bot.test.mjs` (giả lập Zalo, GitHub, AI).
