---
version: alpha
name: Trợ lý văn bản
description: "Bàn làm việc của cán bộ: nền giấy ngà (#f7f4ee), chữ mực xanh đen (#121c2e), một màu nhấn duy nhất là đỏ con dấu (#a5222a) cho hành động chính và mục đang chọn. Tiêu đề trang dùng serif Newsreader, giao diện dùng Be Vietnam Pro, văn bản xuất ra dùng Tinos (Times New Roman) đúng thể thức Nghị định 30/2020. Mật độ cao, bảng trước thẻ, màu nằm trên dữ liệu chứ không nằm trên khung."

colors:
  bg: "#f7f4ee"
  bg-elev: "#fbf9f5"
  surface: "#ffffff"
  surface-2: "#f3efe7"
  surface-3: "#ebe5d9"
  line: "#e4ddcf"
  line-strong: "#d3c9b6"
  text: "#121c2e"
  text-2: "#43506a"
  text-3: "#6f7a90"
  accent: "#a5222a"
  accent-hover: "#8c1a20"
  accent-soft: "#fcf2f0"
  brand: "#0d1a2e"
  focus: "#2f6fed"
  success: "#1d6b52"
  success-soft: "#dcefe7"
  warning: "#a8650f"
  warning-soft: "#f8ead3"
  danger: "#a5222a"
  danger-soft: "#f8e3e1"
  gold: "#b08d57"
  dark-bg: "#0a121f"
  dark-surface: "#121d30"
  dark-text: "#edf0f6"
  dark-accent: "#e0574f"

typography:
  page-title:
    fontFamily: Newsreader
    fontSize: clamp(28px, 3vw, 36px)
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: -0.025em
  section:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: 600
  body:
    fontFamily: Be Vietnam Pro
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: Be Vietnam Pro
    fontSize: 13px
    fontWeight: 400
  label:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: 600
  document:
    fontFamily: Tinos
    fontSize: 13pt
    lineHeight: 1.5

rounded:
  xs: 6px
  sm: 8px
  control: 10px
  md: 12px
  panel: 18px
  pill: 999px

spacing:
  unit: 4px
  control-height: 40px
  input-height: 42px
  hit-target: 44px
  page-gutter-mobile: 16px
  container: 1200px

motion:
  ease: cubic-bezier(0.2, 0.7, 0.2, 1)
  ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1)
  press: 120ms
  hover: 150ms
  popover: 180ms
  modal: 240ms

components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    height: 40px
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    borderColor: "{colors.line-strong}"
    rounded: "{rounded.control}"
    height: 40px
  panel:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line}"
    rounded: "{rounded.panel}"
  badge:
    rounded: "{rounded.pill}"
    height: 24px
    fontSize: 12px
  input:
    borderColor: "{colors.line-strong}"
    height: 42px
---

# DESIGN.md — Trợ lý văn bản

Tệp này là phong cách thiết kế của ứng dụng. Mọi thay đổi giao diện (trang mới, tab mới, bảng, hộp thoại, mẫu xuất) đọc tệp này trước. Token thật nằm ở `assets/css/base.css` (`:root` và hai khối dark mode); tệp này giải thích **vì sao** và **khi nào** dùng chúng. Khi CSS và tệp này lệch nhau, CSS là sự thật, sửa tệp này cho khớp.

Nguồn học: các repo người dùng gắn sao trên GitHub — `google-labs-code/design.md` (định dạng tệp này), `Nutlope/hallmark` (sàn chất lượng, màn hình ứng dụng), `Leonxlnx/taste-skill` (luật màn hình ứng dụng, danh sách "dấu hiệu AI"), `emilkowalski/skills` (chuyển động), `nextlevelbuilder/ui-ux-pro-max-skill` (thứ tự ưu tiên kiểm tra), `VoltAgent/awesome-design-md` (mẫu DESIGN.md của các sản phẩm thật). Chỉ rút nguyên tắc, không chép mã.

## Overview

Người dùng là cán bộ — văn phòng, pháp chế, tòa án — làm việc nhiều giờ với văn bản hành chính, hồ sơ, bản án. Ứng dụng phải giống **bàn làm việc ngăn nắp với tờ giấy trắng và con dấu đỏ**, không giống trang quảng cáo phần mềm. Tham chiếu cụ thể: mật độ và sự kiệm màu của Linear, cách trình bày bảng của một sổ thụ lý giấy được kẻ cẩn thận, và chính tờ văn bản theo Nghị định 30/2020/NĐ-CP (quốc hiệu, tiêu ngữ, số ký hiệu, nơi nhận).

Ba điều làm nên "khuôn mặt" của sản phẩm, không bỏ:
1. **Đỏ con dấu** là màu nhấn duy nhất — trên hành động chính, mục đang chọn, và chữ nhấn trong tiêu đề trang.
2. **Tờ văn bản** (`--shadow-paper`, font Tinos) — bản xem trước luôn là tờ A4 thật, đúng thể thức; đây là vật thể đặc trưng của ứng dụng.
3. **Ngôn ngữ nghề**: "bút lục", "khung hình phạt", "nơi nhận", "thụ lý", "căn cứ" — không dùng chữ chung chung kiểu "Bắt đầu", "Liền mạch", "Mạnh mẽ".

## Colors

- Nền giấy ngà `bg`, mặt làm việc trắng `surface`, bậc tông `surface-2/3` để phân lớp. Phân lớp bằng **bậc tông hoặc đường kẻ**, không chồng bóng + viền + tông cùng lúc.
- `accent` (đỏ con dấu) chỉ cho: nút chính của màn hình (một nút), mục đang chọn (tab, chip, dòng), con số cần chú ý. Khoảng 3% điểm ảnh có màu là vừa.
- Màu trạng thái (`success`, `warning`, `danger`) luôn đi cặp với `*-soft` làm nền: nhãn là **nền nhạt + chữ đậm**, không phải nền đậm chữ trắng. `danger` trùng `accent` có chủ ý — lỗi và con dấu cùng một đỏ — nên lỗi phải có chữ/biểu tượng đi kèm, không dựa vào màu.
- `focus` xanh dương tách biệt hẳn khỏi đỏ để vòng focus luôn nhìn thấy.
- Dark mode: định nghĩa ở cả `@media (prefers-color-scheme: dark)` (với `:root:not([data-theme='light'])`) và `:root[data-theme='dark']`. Thêm token mới phải thêm ở cả ba chỗ.
- Không dùng mã màu thô trong component; luôn qua `var(--…)`. Ngoại lệ cũ đang có (`#fff` trên nền accent, `.chip.active` dùng `--ink-900`) giữ nguyên.

## Typography

- **Newsreader** (serif) chỉ cho tiêu đề trang (`.page-title`) và tiêu đề tài liệu lớn. **Be Vietnam Pro** cho toàn bộ giao diện. **Tinos** chỉ cho văn bản xuất ra (xem trước, Word) — đúng Times New Roman của thể thức.
- Thang chữ giao diện nên gói gọn trong **5 cỡ**: 12 (nhãn, tiêu đề cột), 13 (phụ, gợi ý), 15 (thân), 16–18 (tiêu đề khối), tiêu đề trang dạng clamp. CSS hiện có nhiều cỡ lẻ (12.5, 13.5, 14.5…) — không thêm cỡ lẻ mới; khi sửa khu vực nào thì gom về thang này.
- Số trong bảng, tiền, ngày: căn phải, `font-variant-numeric: tabular-nums`.
- Tiêu đề viết thường kiểu câu ("Văn bản trong kho"), không viết hoa toàn bộ. Chữ IN HOA chỉ dùng khi thể thức văn bản bắt buộc (tên loại văn bản, quốc hiệu).
- Tên người, số tiền, số hiệu văn bản hiển thị **nguyên văn** như trong hồ sơ.

## Layout

- Khung ứng dụng: thanh bên (`.sidebar`, nền `bg-elev`, viền phải) + vùng trang tối đa `--container` 1200px. Thanh bên trung tính; mục đang chọn mới có màu.
- Đầu trang: một tiêu đề danh từ + một dòng mô tả (`.page-sub`), **không có hero**. Hành động chính của trang nằm cùng hàng tiêu đề, bên phải.
- Nội dung chia bằng `.panel` / `section` có tiêu đề `h2` cỡ 16. Không lồng thẻ trong thẻ.
- **Bảng trước thẻ** cho mọi dữ liệu có cột (sổ vụ án, kho bản án, bút lục, thời hạn): kẻ ngang mảnh, tiêu đề cột 12px xám kiểu câu, không sọc ngựa vằn, hàng hành động căn phải (`.cf-row-act`).
- Mật độ: nút 40px, ô nhập 42px, vùng bấm tối thiểu 44px trên điện thoại. Lề 16px trên điện thoại, không cuộn ngang (`overflow-x: clip` thay cho `hidden` khi cần cắt).
- Trạng thái nằm trên URL hash (`#toa-an/kho-ban-an`, `#toa-an/cai-dat`) để nút Back và tải lại trang giữ đúng chỗ.

## Elevation & Depth

- Mặt phẳng là mặc định. `.panel` dùng viền `line` + `--shadow-xs` gần như vô hình.
- Bóng rõ (`--shadow-md/lg`) chỉ cho vật thể nổi: hộp thoại, menu thả, toast, nút nổi.
- `--shadow-paper` dành riêng cho tờ văn bản xem trước. Không dùng cho thẻ thường.

## Shapes

- Bán kính theo vai trò, không một cỡ cho tất cả: ô nhập/nút 10px, thẻ nhỏ 12px, panel 18px, nhãn/chip tròn hẳn (999px), tờ văn bản góc vuông như giấy thật.
- Biểu tượng: một bộ nét mảnh (hàm `icon()` trong `ui.js`), 14–20px, màu theo chữ. Không dùng emoji làm biểu tượng.

## Components

- **Nút**: `.btn` (viền), `.btn-primary` (đỏ, một nút mỗi vùng), `.btn-ghost` (hành động phụ trong bảng), `.btn-icon` luôn có `aria-label`. `:active` hơi lún (`translateY(1px) scale(0.99)`) là phản hồi nhấn — giữ kín đáo, không nảy.
- **Nhãn** `.badge`: cao 24px, nền nhạt + chữ đậm. Không chấm trạng thái trang trí.
- **Toast**: thông báo ngắn sau hành động; lỗi kéo dài hơn (`timeout: 6000`). Hành động phá hủy (xóa) phải hỏi lại hoặc có hoàn tác.
- **Bốn trạng thái dữ liệu** cho mọi danh sách: đang tải, trống (một câu + đúng một hành động, ví dụ "Kho đang trống — nạp bản án, án lệ ở trên."), lỗi (nói rõ thiếu gì — dùng `warnMissing`), đầy đủ. Số 0 hiển thị là 0; thiếu dữ liệu là dấu gạch "—" màu xám; không bịa số.
- **Kết luận nghiệp vụ** (thẩm tra, khiếu nại): luôn kèm căn cứ và trích nguồn (bút lục, điều luật); câu chữ là "có dấu hiệu", "cần xác minh" — phần mềm không kết luận thay người.
- **Form**: nhãn luôn hiện (không dùng placeholder thay nhãn), lỗi đặt cạnh ô.

## Motion

Chuyển động chỉ để báo trạng thái, không trang trí. Theo chuẩn của Emil Kowalski:

- **Có nên chuyển động không?** Thao tác lặp hàng chục lần mỗi ngày (chuyển tab, gõ phím tắt, lọc bảng) → không hoặc gần như không. Hộp thoại, menu, toast → có, ngắn. Lần đầu dùng → có thể nhiều hơn.
- **Easing**: vào/ra dùng ease-out (`--ease` hoặc `cubic-bezier(0.23, 1, 0.32, 1)`); di chuyển trên màn hình dùng ease-in-out; đổi màu khi hover dùng `ease`. **Không bao giờ dùng ease-in** cho giao diện.
- **Thời lượng**: nhấn nút 100–160ms, tooltip/popover 125–200ms, menu 150–250ms, hộp thoại 200–300ms. Giao diện giữ dưới 300ms.
- **Chỉ animate `transform` và `opacity`** (và màu). Không animate width/height/top/left/margin. **Không bao giờ `transition: all`** — liệt kê đúng thuộc tính.
- Không xuất hiện từ `scale(0)`; bắt đầu từ `scale(0.95–0.97)` + `opacity: 0`. Menu thả phóng từ phía nút bấm; hộp thoại phóng từ giữa.
- Ưu tiên `transition` (ngắt giữa chừng được) hơn `@keyframes` cho thứ bật tắt nhanh.
- `prefers-reduced-motion` đã có ở `base.css` (cắt toàn bộ); hiệu ứng mới không được né khối đó.
- Hover chuyển động (nhấc thẻ, phóng to) chỉ trong `@media (hover: hover) and (pointer: fine)`; mặc định là không nhấc.

## Do's and Don'ts

**Làm:**
- Đọc tệp này và token trong `base.css` trước khi viết CSS mới; tái dùng class sẵn có (`.panel`, `.btn`, `.badge`, `.cf-table`, `.tt-table`, `.field`, `.inline`, `.hint`).
- Giữ một nút chính đỏ trên mỗi vùng; mọi thứ khác trung tính.
- `:focus-visible` nhìn thấy được trên mọi phần tử tương tác (mặc định ở `base.css`, đừng `outline: none`).
- Tương phản chữ tối thiểu 4.5:1 ở cả sáng và tối.
- Kiểm tra ở 375px và 1280px, sáng và tối, trước khi coi là xong.
- Thêm chất (nội dung thật, căn cứ thật, số liệu thật) thay vì chỉ trang trí bớt.

**Không làm** (sàn chất lượng + các "dấu hiệu AI" đã lỗi thời):
- Gradient tím–xanh, glow, kính mờ, nền nhiễu, màu cầu vồng trên biểu đồ.
- Hero lớn trên màn hình ứng dụng; thẻ KPI có ô biểu tượng màu; sparkline trang trí.
- Thẻ lồng thẻ; bento grid; bóng + viền + nền tông cùng lúc.
- Nhãn "eyebrow" chữ in hoa giãn cách phía trên tiêu đề; nhãn mono nhỏ; đánh số trang trí 01/02/03.
- Dòng meta nối bằng dấu chấm giữa "·" kiểu trang trí; chấm trạng thái trang trí.
- Emoji làm biểu tượng; số liệu bịa, lorem ipsum, "99% hài lòng".
- `transition: all`; animate kích thước/vị trí; fade-up cho mọi thứ khi cuộn; nảy (bounce) trên giao diện làm việc.
- Cỡ chữ lẻ mới; mã màu thô trong component; màu tím/chàm làm nhấn.
- Chữ chung chung: "Bắt đầu ngay", "Trải nghiệm liền mạch", "Mạnh mẽ". Dùng động từ nghề: "Đọc bản án", "Xuất phiếu", "Thêm vào kho".

## Known debt

Những chỗ CSS hiện tại chưa khớp tệp này. Không sửa hàng loạt; sửa khi đụng tới khu vực đó:
- Nhiều nhãn chữ in hoa giãn cách (`text-transform: uppercase; letter-spacing: 0.12em`) trong `app.css`, `help.css`, `landing.css`.
- Cỡ chữ lẻ (12.5, 13.5, 14.5, 11.5px) rải rác trong `app.css`.
- `.suggest:hover` và vài thẻ khác nhấc lên (`translateY(-1px)` + bóng) không qua `@media (hover: hover)`.
- `.type-tab[aria-selected]` có bóng màu accent dưới tab.
- `.page-title em` tô đỏ một chữ in nghiêng trong tiêu đề — là dấu ấn hiện có của thương hiệu nên giữ, nhưng không nhân rộng sang tiêu đề khối hay nơi khác.
