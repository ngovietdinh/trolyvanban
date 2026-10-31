// Mô hình cụm từ có nghĩa cho nhận diện hành vi phạm tội.
//
// Nguyên tắc (rút từ lỗi thực tế: “đánh giá” bị coi là đánh người, “10%” bị coi là tỷ lệ thương tích):
//  1. Không luận tội bằng TỪ ĐƠN. Một hành vi chỉ được nhận khi có CỤM CÓ NGHĨA: động từ + bổ ngữ / đối tượng / công cụ /
//     vị trí (“đánh vào mặt”, “dùng dao đâm”, “đâm hai nhát”, “đánh anh A”), hoặc cụm cố định của pháp luật
//     (“gây thương tích”, “hành hung”, “tước đoạt tính mạng”).
//  2. Từ đa nghĩa (đánh, đâm, chém, đá, chết, giết, lừa, trộm, chủ quan…) có DANH SÁCH CỤM VÔ HẠI đi kèm (đánh giá,
//     đánh dấu, đâm đơn, chém gió, bóng đá, chết máy, giết thời gian, ý chí chủ quan…): khớp nằm trong cụm vô hại thì bỏ.
//  3. Số liệu phải gắn với ngữ cảnh: “%” chỉ là tỷ lệ tổn thương cơ thể khi đi cùng “tỷ lệ / tổn thương / thương tích /
//     giám định”; “10% cổ phần”, “lãi suất 10%” không phải thương tích.
//  4. Mọi khớp đều trả về đúng CỤM đã khớp (khop) để giao diện giải thích “vì sao chọn điều này”.
//
// Dùng ở recognizers.js (yếu tố cấu thành của từng điều) và analyze.js (câu mô tả hành vi). Thêm cụm mới: sửa các
// danh sách dưới đây, rồi thêm câu bẫy vào tests/unit/lexicon.test.mjs.

/** Ranh giới từ tiếng Việt: không dính vào chữ cái / dấu trước và sau. */
export const WB = (src) => `(?<![\\p{L}\\p{M}])(?:${src})(?![\\p{L}\\p{M}])`;
export const rx = (src, flags = 'iu') => new RegExp(src, flags);
const alt = (list) => list.map((s) => s.replace(/ /g, '\\s+')).join('|');

/* ---------------- Cụm vô hại chứa từ nhạy cảm (loại trừ) ---------------- */
export const EXCLUDE = {
  // “đánh” không phải đánh người
  danh: ['đánh giá', 'đánh dấu', 'đánh số', 'đánh máy', 'đánh thuế', 'đánh mất', 'đánh rơi', 'đánh đổi', 'đánh cược', 'đánh bạc', 'đánh bài', 'đánh lô', 'đánh đề', 'đánh bóng', 'đánh răng', 'đánh cá', 'đánh bắt', 'đánh lừa', 'đánh tiếng', 'đánh vần', 'đánh xe', 'đánh thức', 'đánh chữ', 'đánh tên', 'đánh giấy', 'đánh công văn', 'đánh văn bản', 'đánh tráo', 'đánh tan', 'đánh động', 'đánh hơi', 'đánh cắp', 'đánh giày', 'đánh sập', 'đánh trống', 'đánh đàn', 'đánh cờ', 'đánh golf', 'đánh tennis', 'đánh cầu lông', 'đánh bóng chuyền', 'đánh úp', 'đánh chiếm', 'đánh thắng', 'đánh địch', 'đánh trận', 'đánh phá', 'đánh lạc hướng', 'đánh liều', 'đánh hụt', 'đánh lận', 'đánh đồng', 'đánh thành', 'đánh sang', 'đánh ghen'],
  dam: ['đâm đơn', 'đâm chồi', 'đâm ra', 'đâm lao', 'đâm hoa', 'đâm bị thóc', 'đâm sầm', 'đâm vào xe', 'đâm vào cột', 'đâm vào dải', 'đâm vào gốc', 'đâm vào tường', 'xe đâm', 'ô tô đâm', 'tàu đâm', 'đâm va', 'đâm nhau trên đường', 'đâm xe'],
  chem: ['chém gió'],
  da: ['bóng đá', 'đá bóng', 'đá banh', 'đá cầu', 'đá gà', 'đá phạt', 'sân đá', 'viên đá', 'hòn đá', 'cục đá', 'tảng đá', 'đá lạnh', 'nước đá', 'đá hoa', 'đá granit', 'đá quý', 'đá ong', 'khai thác đá', 'mỏ đá', 'đá vôi', 'đá xanh', 'đá dăm', 'đá cuội', 'bằng đá', 'đá tảng', 'xe đá'],
  dap: ['đập đá', 'đập hộp', 'đập thủy điện', 'con đập', 'đập tràn', 'đập nước', 'đập phá tài sản', 'đập tan'],
  tat: ['tát nước', 'tát ao', 'tát cạn', 'đồng tát'],
  ban: ['bắn tin', 'bắn pháo hoa', 'bắn tốc độ', 'bắn súng thể thao', 'bắn cung', 'bắn bia', 'bắn pháo', 'bắn ra'],
  nem: ['ném đá giấu tay', 'ném bóng', 'ném lao', 'ném tạ', 'ném đĩa', 'ném rác', 'ném tiền'],
  dap_xe: ['đạp xe', 'đạp ga', 'đạp phanh', 'đạp thắng', 'xe đạp', 'bàn đạp', 'đạp đổ'],
  chet: ['chết máy', 'chết đứng', 'chết lặng', 'chết khiếp', 'chết cười', 'chết đói', 'chết tiệt', 'chết dở', 'sợ chết', 'chết mê', 'chết chóc', 'chết người ta', 'chết điếng', 'chết trân', 'chết ngất', 'chết cóng', 'chết nghẹn', 'chết nỗi', 'mệt chết', 'buồn chết', 'cây chết', 'cá chết', 'lợn chết', 'gà chết', 'heo chết', 'bò chết', 'trâu chết', 'tôm chết', 'chết khát', 'chết cháy rừng', 'chết tên', 'thẻ chết', 'nợ chết', 'vốn chết', 'điểm chết', 'ngõ chết', 'chết yểu'],
  giet: ['giết thời gian', 'giết mổ', 'giết gà', 'giết lợn', 'giết heo', 'giết chó', 'giết sâu', 'giết chuột', 'giết vi khuẩn', 'giết cỏ', 'thuốc giết', 'dọa giết', 'đe dọa giết', 'đòi giết', 'thề giết', 'muốn giết chết thời gian'],
  lua: ['con lừa', 'lừa ngựa', 'lừa hoang', 'thịt lừa'],
  trom: ['nhìn trộm', 'trộm nghĩ', 'nghe trộm', 'liếc trộm', 'ngó trộm', 'trộm vía', 'xem trộm', 'đọc trộm', 'chụp trộm', 'quay trộm'],
  cap: ['cắp sách', 'cắp nách', 'cắp cặp', 'cặp cắp', 'cắp ô'],
  cuop: ['cướp lời', 'cướp cò', 'cướp diễn đàn', 'cướp sóng', 'cướp biển'],
  chu_quan: ['ý chí chủ quan', 'mặt chủ quan', 'ý muốn chủ quan', 'ngoài ý muốn chủ quan', 'về mặt chủ quan', 'nhận thức chủ quan', 'cảm tính chủ quan', 'yếu tố chủ quan', 'nguyên nhân chủ quan', 'đánh giá chủ quan'],
  boc_co: ['bóp cổ chai', 'bóp cổ gà'],
};
const EXCL_RE = Object.fromEntries(Object.entries(EXCLUDE).map(([k, list]) => [k, rx(alt(list), 'giu')]));
/** Mọi cụm vô hại (dùng khi không biết động từ nào khớp). */
export const EXCLUDE_ALL = rx(alt(Object.values(EXCLUDE).flat()), 'giu');

/* ---------------- Kho cụm ---------------- */
const CAPNAME = '[A-ZĐÀ-Ỹ][\\p{Ll}\\u0300-\\u036f]+';
/** Người bị tác động: danh xưng / tư cách tố tụng / tên riêng. */
export const NGUOI = `(?:anh|chị|ông|bà|em|cháu|cô|chú|bác|cậu|mợ|dì|thím|bị hại|nạn nhân|người bị hại|vợ|chồng|con|mẹ|bố|cha|bạn|đồng nghiệp|hàng xóm|nhân viên|bảo vệ|tài xế|lái xe|khách|người|${CAPNAME})`;
/** Công cụ, hung khí. */
export const HUNG_KHI = '(?:dao|kéo|gậy|gạch|đá|tuýp sắt|tuýp|ống sắt|ống tuýp|thanh sắt|côn|kiếm|mã tấu|rựa|búa|rìu|cuốc|xẻng|ghế|mũ bảo hiểm|chai|cốc|ly|vỏ chai|súng|bình xịt|roi|dây|điếu cày|chày|cờ lê|mỏ lết|đoạn cây|khúc gỗ|cây gỗ|thanh gỗ|gậy gỗ|gậy sắt|dao bầu|dao phay|dao gọt|dao nhọn|dao Thái|lưỡi lê|đinh ba|xiên|bình ga|axit|a-xít|xăng|hung khí|vật cứng|vật nhọn|tay|chân|nắm đấm|cùi chỏ|đầu gối|đầu)';
/** Động từ tấn công (chỉ dùng khi có bổ ngữ / công cụ / đối tượng — xem ASSAULT). */
const VERB_HIT = '(?:đánh|đấm|đá|đạp|tát|đập|chém|đâm|cứa|chặt|vụt|phang|quật|ném|bắn|cắn|húc|xô|đẩy|kéo|giật|túm|bóp|siết|dí|kề|tạt|đổ|đốt|châm|thiêu|dìm|nhấn|đè|đánh đập|hành hung)';
const BO_PHAN = '(?:đầu|mặt|mắt|mũi|miệng|má|cằm|tai|gáy|cổ|vai|ngực|bụng|lưng|sườn|hông|mông|đùi|chân|tay|cánh tay|bàn tay|ngón tay|bắp chân|bàn chân|đầu gối|thái dương|trán|người|cơ thể|vùng [a-zà-ỹ]+)';

/** Cụm hành vi tấn công cơ thể người khác (Điều 134, 123 và các tội dùng vũ lực). */
export const ASSAULT = [
  // dùng / cầm / rút / vớ + công cụ … + động từ
  `(?:dùng|cầm|lấy|vớ|rút|sử dụng|vung|giơ|nhặt)\\s+(?:một\\s+|hai\\s+|\\d+\\s+)?(?:con\\s+|cây\\s+|chiếc\\s+|cái\\s+|khẩu\\s+|thanh\\s+|đoạn\\s+|viên\\s+|hòn\\s+|cục\\s+|can\\s+|bình\\s+|chai\\s+|ca\\s+)?${HUNG_KHI}(?![\\p{L}])[^.;]{0,50}?${VERB_HIT}`,
  // động từ + vào / trúng + bộ phận, hoặc số nhát / cái
  `${VERB_HIT}\\s+(?:mạnh\\s+|liên tiếp\\s+|liên tục\\s+|nhiều\\s+(?:cái|nhát|phát|lần|cú)\\s+|một\\s+(?:cái|nhát|phát|cú)\\s+|\\d+\\s+(?:cái|nhát|phát|lần|cú)\\s+)?(?:vào|trúng|lên)\\s+(?:vùng\\s+)?${BO_PHAN}`,
  `${VERB_HIT}\\s+(?:liên tiếp|liên tục|túi bụi|tới tấp|nhiều\\s+(?:cái|nhát|phát|lần|cú)|một\\s+(?:cái|nhát|phát|cú)|\\d+\\s+(?:cái|nhát|phát|lần|cú))`,
  // động từ + người
  `(?:đánh|đấm|đá|đạp|tát|đập|chém|đâm|cắn|húc|xô ngã|đẩy ngã|túm tóc|giật tóc|bóp cổ|siết cổ|hành hung|đánh đập|đâm chém|tạt axit|tạt a-xít)\\s+(?:chết\\s+|bị thương\\s+|trọng thương\\s+)?${NGUOI}`,
  `(?:xông|lao|nhảy)\\s+(?:vào|tới|đến)\\s+(?:đánh|đấm|đá|đạp|tát|đập|chém|đâm|hành hung)`,
  `bị\\s+(?:${NGUOI}\\s+)?(?:đánh|đấm|đá|đạp|tát|đập|chém|đâm|bắn|hành hung|đánh đập|cắn|húc|xô ngã|bóp cổ|siết cổ|tạt axit|tạt a-xít)`,
  // cụm cố định
  `đánh nhau|ẩu đả|xô xát|hành hung|đánh hội đồng|đánh đập|đâm chém|chém nhau|gây thương tích|gây tổn hại (?:cho )?sức khỏe|cố ý gây thương tích|tạt a-?xít|đổ xăng[^.;]{0,30}(?:đốt|châm lửa)|châm lửa đốt|lao xe (?:vào|thẳng vào) (?:người|đám đông|${NGUOI})|bóp cổ|siết cổ|thắt cổ|dí dao|kề dao|dùng vũ lực|đe dọa dùng vũ lực`,
];
/** Cụm thương tích / tổn hại sức khỏe. */
export const INJURY = [
  'thương tích|thương tật|tổn hại (?:cho |đến |về )?sức khỏe|tổn thương (?:cơ thể|sọ não|não|nội tạng|phần mềm|mắt|tai|răng)|vết thương|vết chém|vết đâm|vết bầm|vết rách|vết cắn|vết bỏng',
    'gãy (?:xương|tay|chân|răng|mũi|sườn|hàm|đốt|ngón|cổ tay|cẳng|đùi|xương sườn|xương đòn|xương hàm)|rạn xương|vỡ (?:xương|sọ|lách|gan|hốc mắt)|dập (?:phổi|lá lách|gan|não|nát|thận)|chấn thương|chấn động não|bầm tím|sưng tấy|tụ máu|rách (?:da|mí|môi|trán|đầu|mặt|da đầu|giác mạc)|chảy máu|đứt (?:gân|tay|tai|động mạch|dây chằng|ngón)|thủng (?:ruột|phổi|dạ dày|màng nhĩ)|mất (?:răng|mắt|thị lực|thính lực|ngón|bàn tay|khả năng lao động)|mù (?:mắt|một mắt|hai mắt)|bỏng (?:nặng|độ|toàn thân|mặt|\\d+%)|hôn mê|bất tỉnh|ngất xỉu',
  'phải (?:khâu|mổ|phẫu thuật|cấp cứu|nhập viện|điều trị|bó bột|nằm viện)|nhập viện|đi cấp cứu|đưa đi cấp cứu|điều trị tại bệnh viện|nằm viện|cấp cứu tại|bệnh viện (?:điều trị|cấp cứu)',
  'giám định (?:pháp y|thương tích|thương tật|tỷ lệ|tỉ lệ|sức khỏe)|kết luận giám định[^.;]{0,60}(?:thương|tổn|%)|tỷ lệ (?:tổn thương|thương tích|thương tật)|tỉ lệ (?:tổn thương|thương tích|thương tật)',
];
/** Cụm tước đoạt tính mạng (Điều 123). */
export const KILL = [
  'giết người|sát hại|tước đoạt (?:tính mạng|mạng sống)|hạ sát|đoạt mạng|cố ý giết|ý định giết|định giết|mục đích giết|nhằm giết|muốn giết|để giết|giết chết|đâm chết|chém chết|đánh chết|bắn chết|bóp cổ chết|siết cổ chết|đầu độc|bỏ thuốc độc|dìm chết|thiêu chết|đốt chết|đẩy xuống (?:sông|giếng|vực|hồ|biển)|ném xuống (?:sông|giếng|vực)',
  `(?:đâm|chém|bắn|đập|chặt)\\s+(?:mạnh\\s+|liên tiếp\\s+|nhiều\\s+(?:nhát|phát|cái)\\s+|\\d+\\s+(?:nhát|phát|cái)\\s+)?(?:vào|trúng)\\s+(?:vùng\\s+)?(?:đầu|ngực|bụng|cổ|gáy|tim|thái dương|lưng|sườn|vùng trọng yếu|nơi hiểm yếu|chỗ hiểm)`,
  `(?:dùng|cầm|rút|lấy)\\s+(?:con\\s+|cây\\s+|khẩu\\s+|thanh\\s+|đoạn\\s+)?${HUNG_KHI}(?![\\p{L}])[^.;]{0,50}?(?:đâm|chém|bắn|đập|siết|bóp|chặt|dìm|thiêu|đốt)`,
  'bóp cổ|siết cổ|thắt cổ|treo cổ (?:nạn nhân|bị hại|' + NGUOI + ')|dìm (?:đầu|xuống nước)|đổ xăng[^.;]{0,30}(?:đốt|châm lửa)',
];
/** Cụm hậu quả chết người. */
export const DEATH = ['tử vong', 'thiệt mạng', 'không qua khỏi', 'qua đời', 'chết tại chỗ', 'chết trên đường', 'chết sau', 'chết do', 'chết vì', 'bị chết', 'đã chết', 'dẫn đến chết', 'làm chết', 'gây chết', 'chết người', 'tắt thở', 'ngừng thở', 'ngừng tim', 'tử thi', 'khám nghiệm tử thi', 'nguyên nhân chết', 'nguyên nhân tử vong', 'cướp đi tính mạng', 'mất mạng', 'bỏ mạng', 'thi thể'];

/** Mẫu regex cho một nhóm cụm (ghép bằng |). */
export const groupRe = (list, flags = 'iu') => rx(list.join('|'), flags);

/* ---------------- Khớp cụm có loại trừ ---------------- */
/** Cụm loại trừ có chồng lên đoạn [a, b) của câu không? */
export function excluded(text, a, b, excl = EXCLUDE_ALL) {
  const res = Array.isArray(excl) ? excl : [excl];
  for (const re of res) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m.index < b && m.index + m[0].length > a) return true;
      if (!m[0].length) re.lastIndex++;
    }
  }
  return false;
}
/**
 * Khớp đầu tiên của `re` trong `text` không nằm trong cụm vô hại. Trả về { index, khop } hoặc null.
 * excl: regex / mảng regex loại trừ (mặc định toàn bộ EXCLUDE).
 */
export function findPhrase(text, re, excl = EXCLUDE_ALL) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m;
  while ((m = g.exec(text))) {
    if (!m[0].length) {
      g.lastIndex++;
      continue;
    }
    if (!excluded(text, m.index, m.index + m[0].length, excl)) return { index: m.index, khop: m[0] };
  }
  return null;
}
/** Câu có cụm nào trong danh sách (không tính cụm vô hại)? */
export const hasPhrase = (text, list, excl = EXCLUDE_ALL) => !!findPhrase(text, groupRe(list), excl);

/** Tỷ lệ tổn thương cơ thể (%): chỉ khi “%” đi cùng tỷ lệ / tổn thương / thương tích / thương tật / giám định trong cùng câu. */
export function pctInjury(text) {
  const out = [];
  const t = String(text || '');
  const re = /(?:tỷ lệ|tỉ lệ|tổn thương|thương tích|thương tật|tổn hại sức khỏe|giám định|sức khỏe bị)[^.;%]{0,80}?(\d{1,3}(?:[.,]\d+)?)\s*%/giu;
  let m;
  while ((m = re.exec(t))) out.push(parseFloat(m[1].replace(',', '.')));
  // “35% tỷ lệ tổn thương cơ thể” (số đứng trước).
  const re2 = /(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:tỷ lệ|tỉ lệ|tổn thương|thương tích|thương tật|sức khỏe)/giu;
  while ((m = re2.exec(t))) out.push(parseFloat(m[1].replace(',', '.')));
  return out;
}

/* ---------------- Câu mô tả hành vi (analyze.js) ---------------- */
/** Cụm hành vi thường gặp trong hồ sơ hình sự — mỗi mục là cụm có nghĩa, không phải từ đơn. */
export const ACTION_PHRASES = [
  'chiếm đoạt|chiếm giữ trái phép|lừa đảo|lừa dối|lừa gạt|gian dối|giả mạo|làm giả|giả danh|mạo danh|nhận tiền|nhận hối lộ|đưa hối lộ|đưa tiền|môi giới hối lộ|chi khống|lập khống|kê khai (?:khống|sai|gian)|khai khống|nâng khống|nâng giá|rút tiền|chuyển tiền|chuyển khoản|thông đồng|câu kết|móc nối|chỉ định thầu|hợp thức hóa|ký duyệt|phê duyệt (?:sai|trái|khống)|tham ô|lạm quyền|lợi dụng (?:chức vụ|quyền hạn|tín nhiệm|sơ hở|lòng tin|hoàn cảnh|danh nghĩa)|vượt quá (?:quyền hạn|thẩm quyền|giới hạn)|thiếu trách nhiệm|cố ý (?:gây|làm trái|không|hủy hoại)|vi phạm quy định|làm trái (?:quy định|công vụ)',
  'trộm cắp|ăn trộm|lấy trộm|đột nhập|móc túi|bẻ khóa|cướp (?:tài sản|giật|xe|tiền|điện thoại|túi)|cướp giật|cưỡng đoạt|đe dọa|uy hiếp|khống chế|bắt giữ người|giam giữ người|hiếp dâm|cưỡng dâm|dâm ô|giao cấu|mua bán người|bắt cóc',
  ...ASSAULT,
  ...KILL,
  'mua bán trái phép|tàng trữ trái phép|vận chuyển trái phép|sản xuất trái phép|buôn lậu|buôn bán hàng cấm|hàng giả|trốn thuế|xuất hóa đơn|mua hóa đơn|bán hóa đơn|cho vay (?:nặng lãi|lãi nặng|với lãi suất)|đánh bạc|tổ chức đánh bạc|gá bạc|cá độ|chứa chấp|tiêu thụ tài sản|rửa tiền|hủy hoại tài sản|phá hoại|xả thải|khai thác (?:trái phép|khoáng sản|cát|gỗ|rừng|đất)|phá rừng|săn bắt|gây rối trật tự|chống người thi hành công vụ|đua xe|tổ chức sử dụng (?:trái phép )?(?:chất )?ma túy|sử dụng trái phép chất ma túy|làm nhục|vu khống|xúc phạm',
];
const ACTION_RE = groupRe(ACTION_PHRASES);
/** Câu có mô tả hành vi có dấu hiệu tội phạm (cụm có nghĩa, đã loại cụm vô hại)? */
export const isActionSentence = (s) => !!findPhrase(String(s || ''), ACTION_RE);
