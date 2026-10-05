// Danh mục Phần thứ hai "Các tội phạm" — Bộ luật Hình sự 2015 (sửa đổi, bổ sung 2017, 2025).
// Dùng để dựng toàn bộ cây hỏi đáp; các tội đã có dữ liệu chuyên sâu (crimes-*.js) được giữ nguyên.
//
// Mỗi dòng: [số điều, tên điều, nhóm, cờ]
//   cờ 'k' = tên/số điều trong dữ liệu tích hợp cần đối chiếu nguyên văn Văn bản hợp nhất 135/VBHN-VPQH;
//   cờ 'b' = điều đã bị bãi bỏ; cờ 'm' = điều được bổ sung năm 2025.
//   tên null = chưa có tên trong dữ liệu tích hợp → ẩn cho tới khi nạp văn bản luật chính thức (Cài đặt Bộ luật).
// Người dùng có thể nạp nguyên văn Bộ luật (Word / văn bản dán vào) để tên điều, nội dung các khoản,
// tình tiết định khung được cập nhật đúng văn bản hiện hành.

export const CHAPTERS = {
  XIII: { ten: 'Chương XIII — Các tội xâm phạm an ninh quốc gia', linhVuc: 'an-ninh' },
  XIV: { ten: 'Chương XIV — Các tội xâm phạm tính mạng, sức khỏe, nhân phẩm, danh dự của con người', linhVuc: 'tinh-mang' },
  XV: { ten: 'Chương XV — Các tội xâm phạm quyền tự do của con người, quyền tự do, dân chủ của công dân', linhVuc: 'tu-do' },
  XVI: { ten: 'Chương XVI — Các tội xâm phạm sở hữu', linhVuc: 'so-huu' },
  XVII: { ten: 'Chương XVII — Các tội xâm phạm chế độ hôn nhân và gia đình', linhVuc: 'hon-nhan' },
  XVIII: { ten: 'Chương XVIII — Các tội xâm phạm trật tự quản lý kinh tế', linhVuc: 'kinh-te' },
  XIX: { ten: 'Chương XIX — Các tội phạm về môi trường', linhVuc: 'moi-truong' },
  XX: { ten: 'Chương XX — Các tội phạm về ma túy', linhVuc: 'ma-tuy' },
  'XXI-1': { ten: 'Chương XXI — Mục 1. Các tội xâm phạm an toàn giao thông', linhVuc: 'giao-thong' },
  'XXI-2': { ten: 'Chương XXI — Mục 2. Tội phạm trong lĩnh vực công nghệ thông tin, mạng viễn thông', linhVuc: 'cong-nghe' },
  'XXI-3': { ten: 'Chương XXI — Mục 3. Các tội phạm khác xâm phạm an toàn công cộng', linhVuc: 'y-te-an-toan' },
  'XXI-4': { ten: 'Chương XXI — Mục 4. Các tội xâm phạm trật tự công cộng', linhVuc: 'trat-tu' },
  XXII: { ten: 'Chương XXII — Các tội xâm phạm trật tự quản lý hành chính', linhVuc: 'hanh-chinh' },
  XXIII: { ten: 'Chương XXIII — Các tội phạm về chức vụ', linhVuc: 'chuc-vu' },
  XXIV: { ten: 'Chương XXIV — Các tội xâm phạm hoạt động tư pháp', linhVuc: 'tu-phap' },
  XXV: { ten: 'Chương XXV — Các tội xâm phạm nghĩa vụ, trách nhiệm của quân nhân và trách nhiệm của người phối thuộc với quân đội', linhVuc: 'quan-nhan' },
  XXVI: { ten: 'Chương XXVI — Tội phá hoại hòa bình, chống loài người và tội phạm chiến tranh', linhVuc: 'chien-tranh' },
};

/** Chương của một điều luật (theo số điều). */
export function chapterOf(dieu) {
  const n = parseInt(dieu, 10);
  if (n >= 108 && n <= 122) return 'XIII';
  if (n <= 156) return 'XIV';
  if (n <= 167) return 'XV';
  if (n <= 180) return 'XVI';
  if (n <= 187) return 'XVII';
  if (n <= 234) return 'XVIII';
  if (n <= 246) return 'XIX';
  if (n <= 259) return 'XX';
  if (n <= 284) return 'XXI-1';
  if (n <= 294) return 'XXI-2';
  if (n <= 317) return 'XXI-3';
  if (n <= 329) return 'XXI-4';
  if (n <= 351) return 'XXII';
  if (n <= 366) return 'XXIII';
  if (n <= 391) return 'XXIV';
  if (n <= 420) return 'XXV';
  if (n <= 425) return 'XXVI';
  return null;
}

export const CATALOG = [
  // ---- Chương XIII — An ninh quốc gia
  ['108', 'Tội phản bội Tổ quốc', 'an-ninh'],
  ['109', 'Tội hoạt động nhằm lật đổ chính quyền nhân dân', 'an-ninh'],
  ['110', 'Tội gián điệp', 'an-ninh'],
  ['111', 'Tội xâm phạm an ninh lãnh thổ', 'an-ninh'],
  ['112', 'Tội bạo loạn', 'an-ninh'],
  ['113', 'Tội khủng bố nhằm chống chính quyền nhân dân', 'an-ninh'],
  ['114', 'Tội phá hoại cơ sở vật chất - kỹ thuật của nước Cộng hòa xã hội chủ nghĩa Việt Nam', 'an-ninh'],
  ['115', 'Tội phá hoại việc thực hiện các chính sách kinh tế - xã hội', 'an-ninh'],
  ['116', 'Tội phá hoại chính sách đoàn kết', 'an-ninh'],
  ['117', 'Tội làm, tàng trữ, phát tán hoặc tuyên truyền thông tin, tài liệu, vật phẩm nhằm chống Nhà nước Cộng hòa xã hội chủ nghĩa Việt Nam', 'tuyen-truyen'],
  ['118', 'Tội phá rối an ninh', 'an-ninh'],
  ['119', 'Tội chống phá cơ sở giam giữ', 'an-ninh'],
  ['120', 'Tội tổ chức, cưỡng ép, xúi giục người khác trốn đi nước ngoài hoặc trốn ở lại nước ngoài nhằm chống chính quyền nhân dân', 'tuyen-truyen'],
  ['121', 'Tội trốn đi nước ngoài hoặc trốn ở lại nước ngoài nhằm chống chính quyền nhân dân', 'tuyen-truyen'],

  // ---- Chương XIV — Tính mạng, sức khỏe, nhân phẩm, danh dự
  ['123', 'Tội giết người', 'tinh-mang'],
  ['124', 'Tội giết hoặc vứt bỏ con mới đẻ', 'tinh-mang'],
  ['125', 'Tội giết người trong trạng thái tinh thần bị kích động mạnh', 'tinh-mang'],
  ['126', 'Tội giết người do vượt quá giới hạn phòng vệ chính đáng hoặc do vượt quá mức cần thiết khi bắt giữ người phạm tội', 'tinh-mang'],
  ['127', 'Tội làm chết người trong khi thi hành công vụ', 'tinh-mang'],
  ['128', 'Tội vô ý làm chết người', 'tinh-mang'],
  ['130', 'Tội bức tử', 'tinh-mang'],
  ['131', 'Tội xúi giục hoặc giúp người khác tự sát', 'tinh-mang'],
  ['132', 'Tội không cứu giúp người đang ở trong tình trạng nguy hiểm đến tính mạng', 'tinh-mang'],
  ['133', 'Tội đe dọa giết người', 'tinh-mang'],
  ['134', 'Tội cố ý gây thương tích hoặc gây tổn hại cho sức khỏe của người khác', 'suc-khoe'],
  ['135', 'Tội cố ý gây thương tích hoặc gây tổn hại cho sức khỏe của người khác trong trạng thái tinh thần bị kích động mạnh', 'suc-khoe'],
  ['136', 'Tội cố ý gây thương tích hoặc gây tổn hại cho sức khỏe của người khác do vượt quá giới hạn phòng vệ chính đáng hoặc do vượt quá mức cần thiết khi bắt giữ người phạm tội', 'suc-khoe'],
  ['137', 'Tội gây thương tích hoặc gây tổn hại cho sức khỏe của người khác trong khi thi hành công vụ', 'suc-khoe'],
  ['138', 'Tội vô ý gây thương tích hoặc gây tổn hại cho sức khỏe của người khác', 'suc-khoe'],
  ['140', 'Tội hành hạ người khác', 'suc-khoe'],
  ['141', 'Tội hiếp dâm', 'tinh-duc'],
  ['142', 'Tội hiếp dâm người dưới 16 tuổi', 'tinh-duc'],
  ['143', 'Tội cưỡng dâm', 'tinh-duc'],
  ['144', 'Tội cưỡng dâm người từ đủ 13 tuổi đến dưới 16 tuổi', 'tinh-duc'],
  ['145', 'Tội giao cấu hoặc thực hiện hành vi quan hệ tình dục khác với người từ đủ 13 tuổi đến dưới 16 tuổi', 'tinh-duc'],
  ['146', 'Tội dâm ô đối với người dưới 16 tuổi', 'tinh-duc'],
  ['147', 'Tội sử dụng người dưới 16 tuổi vào mục đích khiêu dâm', 'tinh-duc'],
  ['148', 'Tội lây truyền HIV cho người khác', 'suc-khoe'],
  ['149', 'Tội cố ý truyền HIV cho người khác', 'suc-khoe'],
  ['150', 'Tội mua bán người', 'mua-ban-nguoi'],
  ['151', 'Tội mua bán người dưới 16 tuổi', 'mua-ban-nguoi'],
  ['152', 'Tội đánh tráo người dưới 01 tuổi', 'mua-ban-nguoi'],
  ['153', 'Tội chiếm đoạt người dưới 16 tuổi', 'mua-ban-nguoi'],
  ['154', 'Tội mua bán, chiếm đoạt mô hoặc bộ phận cơ thể người', 'mua-ban-nguoi'],
  ['155', 'Tội làm nhục người khác', 'danh-du'],
  ['156', 'Tội vu khống', 'danh-du'],

  // ---- Chương XV — Quyền tự do, dân chủ
  ['157', 'Tội bắt, giữ hoặc giam người trái pháp luật', 'tu-do-than-the'],
  ['158', 'Tội xâm phạm chỗ ở của người khác', 'tu-do-than-the'],
  ['159', 'Tội xâm phạm bí mật hoặc an toàn thư tín, điện thoại, điện tín hoặc hình thức trao đổi thông tin riêng tư khác của người khác', 'tu-do-than-the'],
  ['160', 'Tội xâm phạm quyền bầu cử, quyền ứng cử hoặc quyền biểu quyết khi Nhà nước trưng cầu ý dân', 'dan-chu'],
  ['161', 'Tội làm sai lệch kết quả bầu cử, kết quả trưng cầu ý dân', 'dan-chu'],
  ['162', 'Tội buộc công chức, viên chức thôi việc hoặc sa thải người lao động trái pháp luật', 'dan-chu'],
  ['163', 'Tội xâm phạm quyền hội họp, lập hội của công dân', 'dan-chu'],
  ['164', 'Tội xâm phạm quyền tự do tín ngưỡng, tôn giáo của người khác', 'dan-chu'],
  ['165', 'Tội xâm phạm quyền bình đẳng giới', 'dan-chu'],
  ['166', 'Tội xâm phạm quyền khiếu nại, tố cáo', 'dan-chu'],
  ['167', 'Tội xâm phạm quyền tự do ngôn luận, tự do báo chí, tiếp cận thông tin, biểu tình của công dân', 'dan-chu'],

  // ---- Chương XVI — Sở hữu (Điều 174, 175 nằm ở lĩnh vực Kinh tế với dữ liệu chuyên sâu)
  ['168', 'Tội cướp tài sản', 'chiem-doat-bao-luc'],
  ['169', 'Tội bắt cóc nhằm chiếm đoạt tài sản', 'chiem-doat-bao-luc'],
  ['170', 'Tội cưỡng đoạt tài sản', 'chiem-doat-bao-luc'],
  ['171', 'Tội cướp giật tài sản', 'chiem-doat-bao-luc'],
  ['172', 'Tội công nhiên chiếm đoạt tài sản', 'chiem-doat'],
  ['173', 'Tội trộm cắp tài sản', 'chiem-doat'],
  ['176', 'Tội chiếm giữ trái phép tài sản', 'khong-chiem-doat'],
  ['177', 'Tội sử dụng trái phép tài sản', 'khong-chiem-doat'],
  ['178', 'Tội hủy hoại hoặc cố ý làm hư hỏng tài sản', 'khong-chiem-doat'],
  ['179', 'Tội thiếu trách nhiệm gây thiệt hại nghiêm trọng đến tài sản của Nhà nước, cơ quan, tổ chức, doanh nghiệp', 'khong-chiem-doat'],
  ['180', 'Tội vô ý gây thiệt hại nghiêm trọng đến tài sản', 'khong-chiem-doat'],

  // ---- Chương XVII — Hôn nhân và gia đình
  ['181', 'Tội cưỡng ép kết hôn, ly hôn hoặc cản trở kết hôn, ly hôn tự nguyện, tiến bộ', 'hon-nhan'],
  ['182', 'Tội vi phạm chế độ một vợ, một chồng', 'hon-nhan'],
  ['183', 'Tội tổ chức tảo hôn', 'hon-nhan'],
  ['184', 'Tội loạn luân', 'gia-dinh'],
  ['185', 'Tội ngược đãi hoặc hành hạ ông bà, cha mẹ, vợ chồng, con, cháu hoặc người có công nuôi dưỡng mình', 'gia-dinh'],
  ['186', 'Tội từ chối hoặc trốn tránh nghĩa vụ cấp dưỡng', 'gia-dinh'],
  ['187', 'Tội tổ chức mang thai hộ vì mục đích thương mại', 'gia-dinh'],

  // ---- Chương XX — Ma túy
  ['247', 'Tội trồng cây thuốc phiện, cây côca, cây cần sa hoặc các loại cây khác có chứa chất ma túy', 'san-xuat-mua-ban'],
  ['248', 'Tội sản xuất trái phép chất ma túy', 'san-xuat-mua-ban'],
  ['249', 'Tội tàng trữ trái phép chất ma túy', 'san-xuat-mua-ban'],
  ['250', 'Tội vận chuyển trái phép chất ma túy', 'san-xuat-mua-ban'],
  ['251', 'Tội mua bán trái phép chất ma túy', 'san-xuat-mua-ban'],
  ['252', 'Tội chiếm đoạt chất ma túy', 'san-xuat-mua-ban'],
  ['253', 'Tội tàng trữ, vận chuyển, mua bán hoặc chiếm đoạt tiền chất dùng vào việc sản xuất trái phép chất ma túy', 'tien-chat'],
  ['254', 'Tội sản xuất, tàng trữ, vận chuyển hoặc mua bán phương tiện, dụng cụ dùng vào việc sản xuất hoặc sử dụng trái phép chất ma túy', 'tien-chat'],
  ['255', 'Tội tổ chức sử dụng trái phép chất ma túy', 'su-dung'],
  ['256', 'Tội chứa chấp việc sử dụng trái phép chất ma túy', 'su-dung'],
  ['256a', 'Tội sử dụng trái phép chất ma túy', 'su-dung', 'km'],
  ['257', 'Tội cưỡng bức người khác sử dụng trái phép chất ma túy', 'su-dung'],
  ['258', 'Tội lôi kéo người khác sử dụng trái phép chất ma túy', 'su-dung'],
  ['259', 'Tội vi phạm quy định về quản lý chất ma túy, tiền chất, thuốc gây nghiện, thuốc hướng thần', 'tien-chat'],

  // ---- Chương XXI Mục 1 — An toàn giao thông
  ['260', 'Tội vi phạm quy định về tham gia giao thông đường bộ', 'duong-bo'],
  ['261', 'Tội cản trở giao thông đường bộ', 'duong-bo'],
  ['262', 'Tội đưa vào sử dụng phương tiện giao thông đường bộ không bảo đảm an toàn kỹ thuật', 'duong-bo'],
  ['263', 'Tội điều động hoặc giao cho người không đủ điều kiện điều khiển phương tiện tham gia giao thông đường bộ', 'duong-bo'],
  ['264', null, 'duong-bo'],
  ['265', 'Tội tổ chức đua xe trái phép', 'duong-bo'],
  ['266', 'Tội đua xe trái phép', 'duong-bo'],
  ['267', 'Tội vi phạm quy định về an toàn giao thông đường sắt', 'duong-sat', 'k'],
  ['268', 'Tội cản trở giao thông đường sắt', 'duong-sat', 'k'],
  ['269', 'Tội đưa vào sử dụng phương tiện giao thông đường sắt không bảo đảm an toàn kỹ thuật', 'duong-sat', 'k'],
  ['270', 'Tội vi phạm quy định về điều khiển tàu chạy', 'duong-sat', 'k'],
  ['271', 'Tội điều động hoặc giao cho người không đủ điều kiện điều khiển phương tiện giao thông đường sắt', 'duong-sat', 'k'],
  ['272', 'Tội vi phạm quy định về an toàn giao thông đường thủy', 'duong-thuy', 'k'],
  ['273', 'Tội cản trở giao thông đường thủy', 'duong-thuy', 'k'],
  ['274', 'Tội đưa vào sử dụng phương tiện giao thông đường thủy không bảo đảm an toàn kỹ thuật', 'duong-thuy', 'k'],
  ['275', 'Tội điều động hoặc giao cho người không đủ điều kiện điều khiển phương tiện giao thông đường thủy', 'duong-thuy', 'k'],
  ['276', null, 'duong-thuy'],
  ['277', 'Tội vi phạm quy định về hàng không dân dụng', 'hang-khong', 'k'],
  ['278', 'Tội cản trở giao thông đường không', 'hang-khong', 'k'],
  ['279', 'Tội đưa vào sử dụng tàu bay không bảo đảm an toàn kỹ thuật', 'hang-khong', 'k'],
  ['280', 'Tội điều động hoặc giao cho người không đủ điều kiện điều khiển tàu bay', 'hang-khong', 'k'],
  ['281', 'Tội vi phạm quy định về duy tu, sửa chữa, quản lý công trình giao thông', 'cong-trinh-gt', 'k'],
  ['282', 'Tội chiếm đoạt tàu bay, tàu thủy', 'hang-khong'],
  ['283', 'Tội điều khiển tàu bay vi phạm quy định về hàng không của nước Cộng hòa xã hội chủ nghĩa Việt Nam', 'hang-khong'],
  ['284', 'Tội điều khiển phương tiện hàng hải vi phạm quy định về hàng hải của nước Cộng hòa xã hội chủ nghĩa Việt Nam', 'hang-khong'],

  // ---- Chương XXI Mục 2 — Công nghệ thông tin, mạng viễn thông
  ['285', 'Tội sản xuất, mua bán, trao đổi hoặc tặng cho công cụ, thiết bị, phần mềm để sử dụng vào mục đích trái pháp luật', 'tan-cong-mang'],
  ['286', 'Tội phát tán chương trình tin học gây hại cho hoạt động của mạng máy tính, mạng viễn thông, phương tiện điện tử', 'tan-cong-mang'],
  ['287', 'Tội cản trở hoặc gây rối loạn hoạt động của mạng máy tính, mạng viễn thông, phương tiện điện tử', 'tan-cong-mang'],
  ['288', 'Tội đưa hoặc sử dụng trái phép thông tin mạng máy tính, mạng viễn thông', 'thong-tin-du-lieu'],
  ['289', 'Tội xâm nhập trái phép vào mạng máy tính, mạng viễn thông hoặc phương tiện điện tử của người khác', 'tan-cong-mang'],
  ['290', 'Tội sử dụng mạng máy tính, mạng viễn thông, phương tiện điện tử thực hiện hành vi chiếm đoạt tài sản', 'lua-dao-mang'],
  ['291', 'Tội thu thập, tàng trữ, trao đổi, mua bán, công khai hóa trái phép thông tin về tài khoản ngân hàng', 'thong-tin-du-lieu'],
  ['292', 'Tội cung cấp dịch vụ trái phép trên mạng máy tính, mạng viễn thông', 'thong-tin-du-lieu', 'b'],
  ['293', 'Tội sử dụng trái phép tần số vô tuyến điện dành riêng cho mục đích cấp cứu, an toàn, tìm kiếm, cứu hộ, cứu nạn, quốc phòng, an ninh', 'tan-so'],
  ['294', 'Tội cố ý gây nhiễu có hại', 'tan-so'],

  // ---- Chương XXI Mục 3 — An toàn công cộng (bổ sung vào lĩnh vực Y tế – An toàn công cộng)
  ['296', 'Tội vi phạm quy định về sử dụng người lao động dưới 16 tuổi', 'an-toan-lao-dong'],
  ['297', 'Tội cưỡng bức lao động', 'an-toan-lao-dong'],
  ['299', 'Tội khủng bố', 'khung-bo'],
  ['300', 'Tội tài trợ khủng bố', 'khung-bo'],
  ['301', 'Tội bắt cóc con tin', 'khung-bo'],
  ['302', 'Tội cướp biển', 'khung-bo'],
  ['303', 'Tội phá hủy công trình, cơ sở, phương tiện quan trọng về an ninh quốc gia', 'khung-bo'],
  ['304', 'Tội chế tạo, tàng trữ, vận chuyển, sử dụng, mua bán trái phép hoặc chiếm đoạt vũ khí quân dụng, phương tiện kỹ thuật quân sự', 'vu-khi'],
  ['305', 'Tội chế tạo, tàng trữ, vận chuyển, sử dụng, mua bán trái phép hoặc chiếm đoạt vật liệu nổ', 'vu-khi'],
  ['306', 'Tội chế tạo, tàng trữ, vận chuyển, sử dụng, mua bán trái phép hoặc chiếm đoạt súng săn, vũ khí thô sơ, vũ khí thể thao hoặc công cụ hỗ trợ', 'vu-khi'],
  ['307', 'Tội vi phạm quy định về quản lý vũ khí, vật liệu nổ, công cụ hỗ trợ', 'vu-khi'],
  ['308', 'Tội thiếu trách nhiệm trong việc giữ vũ khí, vật liệu nổ, công cụ hỗ trợ gây hậu quả nghiêm trọng', 'vu-khi'],
  ['309', 'Tội sản xuất, tàng trữ, vận chuyển, sử dụng, phát tán, mua bán trái phép hoặc chiếm đoạt chất phóng xạ, vật liệu hạt nhân', 'phong-xa-chat-doc'],
  ['310', 'Tội vi phạm quy định về quản lý chất phóng xạ, vật liệu hạt nhân', 'phong-xa-chat-doc'],
  ['311', 'Tội sản xuất, tàng trữ, vận chuyển, sử dụng hoặc mua bán trái phép chất cháy, chất độc', 'phong-xa-chat-doc'],
  ['312', 'Tội vi phạm quy định về quản lý chất cháy, chất độc', 'phong-xa-chat-doc'],
  ['314', 'Tội vi phạm quy định về an toàn vận hành công trình điện lực', 'an-toan-lao-dong'],
  ['316', null, 'an-toan-lao-dong'],

  // ---- Chương XXI Mục 4 — Trật tự công cộng
  ['318', 'Tội gây rối trật tự công cộng', 'gay-roi'],
  ['319', 'Tội xúc phạm Quốc kỳ, Quốc huy, Quốc ca', 'gay-roi'],
  ['320', 'Tội hành nghề mê tín, dị đoan', 'gay-roi'],
  ['321', 'Tội đánh bạc', 'co-bac'],
  ['322', 'Tội tổ chức đánh bạc hoặc gá bạc', 'co-bac'],
  ['323', 'Tội chứa chấp hoặc tiêu thụ tài sản do người khác phạm tội mà có', 'rua-tien'],
  ['324', 'Tội rửa tiền', 'rua-tien'],
  ['325', 'Tội dụ dỗ, ép buộc hoặc chứa chấp người dưới 18 tuổi phạm pháp', 'mai-dam-van-hoa'],
  ['326', 'Tội truyền bá văn hóa phẩm đồi trụy', 'mai-dam-van-hoa'],
  ['327', 'Tội chứa mại dâm', 'mai-dam-van-hoa'],
  ['328', 'Tội môi giới mại dâm', 'mai-dam-van-hoa'],
  ['329', 'Tội mua dâm người dưới 18 tuổi', 'mai-dam-van-hoa'],

  // ---- Chương XXII — Trật tự quản lý hành chính
  ['330', 'Tội chống người thi hành công vụ', 'cong-vu'],
  ['331', 'Tội lợi dụng các quyền tự do dân chủ xâm phạm lợi ích của Nhà nước, quyền, lợi ích hợp pháp của tổ chức, cá nhân', 'cong-vu'],
  ['332', 'Tội trốn tránh nghĩa vụ quân sự', 'nghia-vu-quan-su'],
  ['333', 'Tội không chấp hành lệnh gọi quân nhân dự bị nhập ngũ', 'nghia-vu-quan-su'],
  ['334', 'Tội làm trái quy định về việc thực hiện nghĩa vụ quân sự', 'nghia-vu-quan-su'],
  ['335', 'Tội cản trở việc thực hiện nghĩa vụ quân sự', 'nghia-vu-quan-su'],
  ['336', 'Tội đăng ký hộ tịch trái pháp luật', 'giay-to-con-dau'],
  ['337', 'Tội cố ý làm lộ bí mật nhà nước; tội chiếm đoạt, mua bán, tiêu hủy vật hoặc tài liệu bí mật nhà nước', 'bi-mat-nha-nuoc'],
  ['338', 'Tội vô ý làm lộ bí mật nhà nước; tội làm mất vật hoặc tài liệu bí mật nhà nước', 'bi-mat-nha-nuoc'],
  ['339', 'Tội giả mạo chức vụ, cấp bậc, vị trí công tác', 'giay-to-con-dau'],
  ['340', 'Tội sửa chữa và sử dụng giấy chứng nhận, các tài liệu của cơ quan, tổ chức', 'giay-to-con-dau'],
  ['341', 'Tội làm giả con dấu, tài liệu của cơ quan, tổ chức; tội sử dụng con dấu hoặc tài liệu giả của cơ quan, tổ chức', 'giay-to-con-dau'],
  ['342', 'Tội chiếm đoạt, mua bán, tiêu hủy con dấu, tài liệu của cơ quan, tổ chức', 'giay-to-con-dau'],
  ['343', 'Tội vi phạm các quy định về quản lý nhà ở', 'quan-ly-khac', 'k'],
  ['344', 'Tội vi phạm quy định về hoạt động xuất bản', 'quan-ly-khac', 'k'],
  ['345', 'Tội vi phạm quy định về bảo vệ và sử dụng di tích lịch sử - văn hóa, danh lam thắng cảnh gây hậu quả nghiêm trọng', 'quan-ly-khac'],
  ['346', 'Tội vi phạm quy chế về khu vực biên giới', 'xuat-nhap-canh', 'k'],
  ['347', 'Tội vi phạm quy định về xuất cảnh, nhập cảnh; tội ở lại Việt Nam trái phép', 'xuat-nhap-canh'],
  ['348', 'Tội tổ chức, môi giới cho người khác xuất cảnh, nhập cảnh hoặc ở lại Việt Nam trái phép', 'xuat-nhap-canh'],
  ['349', 'Tội tổ chức, môi giới cho người khác trốn đi nước ngoài hoặc ở lại nước ngoài trái phép', 'xuat-nhap-canh'],
  ['350', 'Tội cưỡng ép người khác trốn đi nước ngoài hoặc ở lại nước ngoài trái phép', 'xuat-nhap-canh'],
  ['351', null, 'quan-ly-khac'],

  // ---- Chương XXIV — Hoạt động tư pháp
  ['368', 'Tội truy cứu trách nhiệm hình sự người không có tội', 'nguoi-tien-hanh'],
  ['369', 'Tội không truy cứu trách nhiệm hình sự người có tội', 'nguoi-tien-hanh'],
  ['370', 'Tội ra bản án trái pháp luật', 'nguoi-tien-hanh'],
  ['371', 'Tội ra quyết định trái pháp luật', 'nguoi-tien-hanh'],
  ['372', 'Tội ép buộc người có thẩm quyền trong hoạt động tư pháp làm trái pháp luật', 'nguoi-tien-hanh'],
  ['373', 'Tội dùng nhục hình', 'nguoi-tien-hanh'],
  ['374', 'Tội bức cung', 'nguoi-tien-hanh'],
  ['375', 'Tội làm sai lệch hồ sơ vụ án, vụ việc', 'nguoi-tien-hanh'],
  ['376', 'Tội thiếu trách nhiệm để người bị bắt, người bị tạm giữ, tạm giam, người đang chấp hành án phạt tù trốn', 'giam-giu'],
  ['377', 'Tội lợi dụng chức vụ, quyền hạn giam, giữ người trái pháp luật', 'giam-giu'],
  ['378', 'Tội tha trái pháp luật người bị bắt, người bị tạm giữ, tạm giam, người đang chấp hành án phạt tù', 'giam-giu'],
  ['379', 'Tội không thi hành án', 'thi-hanh-an'],
  ['380', 'Tội không chấp hành án', 'thi-hanh-an'],
  ['381', 'Tội cản trở việc thi hành án', 'thi-hanh-an'],
  ['382', 'Tội cung cấp tài liệu sai sự thật hoặc khai báo gian dối', 'nguoi-tham-gia'],
  ['383', 'Tội từ chối khai báo, từ chối kết luận giám định, định giá tài sản hoặc từ chối cung cấp tài liệu', 'nguoi-tham-gia'],
  ['384', 'Tội mua chuộc hoặc cưỡng ép người khai báo, người giám định, người định giá tài sản, người phiên dịch, người dịch thuật', 'nguoi-tham-gia'],
  ['385', 'Tội vi phạm việc niêm phong, kê biên tài sản, phong tỏa tài khoản', 'thi-hanh-an', 'k'],
  ['386', 'Tội trốn khỏi nơi giam, giữ hoặc trốn khi đang bị áp giải, đang bị xét xử', 'giam-giu'],
  ['387', 'Tội đánh tháo người bị bắt, người bị tạm giữ, tạm giam, người đang bị áp giải, người đang bị xét xử, người đang chấp hành án phạt tù', 'giam-giu'],
  ['388', null, 'nguoi-tham-gia'],
  ['389', 'Tội che giấu tội phạm', 'nguoi-tham-gia'],
  ['390', 'Tội không tố giác tội phạm', 'nguoi-tham-gia'],
  ['391', 'Tội gây rối trật tự phiên tòa, phiên họp', 'nguoi-tham-gia'],

  // ---- Chương XXV — Nghĩa vụ, trách nhiệm quân nhân
  ['393', 'Tội chống mệnh lệnh', 'ky-luat', 'k'],
  ['394', 'Tội chấp hành không nghiêm chỉnh mệnh lệnh', 'ky-luat', 'k'],
  ['395', 'Tội cản trở đồng đội thực hiện nhiệm vụ', 'ky-luat', 'k'],
  ['396', 'Tội làm nhục, hành hung người chỉ huy hoặc cấp trên', 'ky-luat', 'k'],
  ['397', 'Tội làm nhục hoặc dùng nhục hình đối với cấp dưới', 'ky-luat', 'k'],
  ['398', 'Tội làm nhục, hành hung đồng đội', 'ky-luat', 'k'],
  ['399', 'Tội đầu hàng địch', 'chien-dau', 'k'],
  ['400', 'Tội khai báo hoặc tự nguyện làm việc cho địch khi bị bắt làm tù binh', 'chien-dau', 'k'],
  ['401', 'Tội bỏ vị trí chiến đấu hoặc không làm nhiệm vụ trong chiến đấu', 'chien-dau', 'k'],
  ['402', 'Tội đào ngũ', 'ky-luat', 'k'],
  ['403', 'Tội trốn tránh nhiệm vụ', 'ky-luat', 'k'],
  ['404', 'Tội cố ý làm lộ bí mật công tác quân sự; tội chiếm đoạt, mua bán hoặc tiêu hủy tài liệu bí mật công tác quân sự', 'bi-mat-vu-khi', 'k'],
  ['405', 'Tội vô ý làm lộ bí mật công tác quân sự; tội làm mất tài liệu bí mật công tác quân sự', 'bi-mat-vu-khi', 'k'],
  ['406', 'Tội báo cáo sai', 'ky-luat', 'k'],
  ['407', 'Tội vi phạm quy định về trực chiến, trực chỉ huy, trực ban', 'ky-luat', 'k'],
  ['408', 'Tội vi phạm quy định về bảo vệ', 'ky-luat', 'k'],
  ['409', 'Tội vi phạm quy định về bảo đảm an toàn trong chiến đấu hoặc trong huấn luyện', 'chien-dau', 'k'],
  ['410', 'Tội vi phạm quy định về sử dụng vũ khí quân dụng', 'bi-mat-vu-khi', 'k'],
  ['411', 'Tội hủy hoại vũ khí quân dụng, phương tiện kỹ thuật quân sự', 'bi-mat-vu-khi', 'k'],
  ['412', 'Tội làm mất hoặc vô ý làm hư hỏng vũ khí quân dụng, phương tiện kỹ thuật quân sự', 'bi-mat-vu-khi', 'k'],
  ['413', 'Tội vi phạm chính sách đối với thương binh, tử sĩ trong chiến đấu', 'chien-dau', 'k'],
  ['414', 'Tội chiếm đoạt hoặc hủy hoại chiến lợi phẩm', 'chien-dau', 'k'],
  ['415', 'Tội quấy nhiễu nhân dân', 'chien-dau', 'k'],
  ['416', 'Tội lạm dụng nhu cầu quân sự trong khi thực hiện nhiệm vụ', 'chien-dau', 'k'],
  ['417', 'Tội ngược đãi tù binh, hàng binh', 'chien-dau', 'k'],
  ['418', null, 'ky-luat'],
  ['419', null, 'ky-luat'],
  ['420', null, 'ky-luat'],

  // ---- Chương XXVI — Phá hoại hòa bình, chống loài người, tội phạm chiến tranh
  ['421', 'Tội phá hoại hòa bình, gây chiến tranh xâm lược', 'chien-tranh'],
  ['422', 'Tội chống loài người', 'chien-tranh'],
  ['423', 'Tội phạm chiến tranh', 'chien-tranh'],
  ['424', 'Tội tuyển mộ, huấn luyện hoặc sử dụng lính đánh thuê', 'chien-tranh'],
  ['425', 'Tội làm lính đánh thuê', 'chien-tranh'],
];
