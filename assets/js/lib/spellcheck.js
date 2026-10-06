// Bộ kiểm tra chính tả, dấu câu và thể thức cho văn bản hành chính tiếng Việt.
// Chạy hoàn toàn trên trình duyệt; mỗi lỗi trả về vị trí để tô sáng và gợi ý sửa.
import { syllableProblem, suggestSyllable, misplacedTone, telexDecode, vniDecode, LOANWORDS } from './vn-syllable.js';

/** Các lỗi chính tả thường gặp (sai → đúng). */
export const MISSPELLINGS = {
  'sử lý': 'xử lý',
  'xử dụng': 'sử dụng',
  'chuẩn đoán': 'chẩn đoán',
  'sáng lạng': 'xán lạn',
  'xán lạng': 'xán lạn',
  'giành dụm': 'dành dụm',
  'thăm quan': 'tham quan',
  'bổ xung': 'bổ sung',
  'suất sắc': 'xuất sắc',
  'chính xát': 'chính xác',
  'chiển khai': 'triển khai',
  'chách nhiệm': 'trách nhiệm',
  'giữ liệu': 'dữ liệu',
  'sắp sếp': 'sắp xếp',
  'sát nhập': 'sáp nhập',
  'lãng mạng': 'lãng mạn',
  'cọ sát': 'cọ xát',
  'chặt chẻ': 'chặt chẽ',
  'suy nghỉ': 'suy nghĩ',
  'tiến triễn': 'tiến triển',
  'giáo giục': 'giáo dục',
  'sản suất': 'sản xuất',
  'xản xuất': 'sản xuất',
  'dàng buộc': 'ràng buộc',
  'giàng buộc': 'ràng buộc',
  'học xinh': 'học sinh',
  'xinh viên': 'sinh viên',
  'tập chung': 'tập trung',
  'chẩn bị': 'chuẩn bị',
  'đột suất': 'đột xuất',
  'năng xuất': 'năng suất',
  'suất xứ': 'xuất xứ',
  'dải pháp': 'giải pháp',
  'dải quyết': 'giải quyết',
  'kiễm tra': 'kiểm tra',
  'khuyến khít': 'khuyến khích',
  'hướng dẩn': 'hướng dẫn',
  'thông tinh': 'thông tin',
  'hiệu xuất': 'hiệu suất',
  'cũng cố': 'củng cố',
  'dỡ bỏ': 'gỡ bỏ',
  'xum họp': 'sum họp',
  'xum vầy': 'sum vầy',
  'trau truốt': 'trau chuốt',
  'chau chuốt': 'trau chuốt',
  'nổ lực': 'nỗ lực',
  'giải bày': 'giãi bày',
  'chia xẻ': 'chia sẻ',
  'san sẽ': 'san sẻ',
  'đường xá': 'đường sá',
  'xơ xuất': 'sơ suất',
  'sơ xuất': 'sơ suất',
  'tránh nhiệm': 'trách nhiệm',
  // Nhầm s/x, ch/tr, d/gi/r, l/n, hỏi/ngã thường gặp trong văn bản hành chính.
  'xắp xếp': 'sắp xếp',
  'sắp xết': 'sắp xếp',
  'xuất xắc': 'xuất sắc',
  'sơ sài': 'sơ sài',
  'xai sót': 'sai sót',
  'xa thải': 'sa thải',
  'sử phạt': 'xử phạt',
  'sử lí': 'xử lý',
  'xử lí': 'xử lý',
  'sét xử': 'xét xử',
  'sét duyệt': 'xét duyệt',
  'xem sét': 'xem xét',
  'sác định': 'xác định',
  'sác nhận': 'xác nhận',
  'sác minh': 'xác minh',
  'xâu sắc': 'sâu sắc',
  'xinh hoạt': 'sinh hoạt',
  'sung đột': 'xung đột',
  'xổ sách': 'sổ sách',
  'chung thực': 'chứng thực',
  'chiệu tập': 'triệu tập',
  'chình bày': 'trình bày',
  'chình độ': 'trình độ',
  'chuyền thống': 'truyền thống',
  'chuyển khai': 'triển khai',
  'chân trọng': 'trân trọng',
  'trân thành': 'chân thành',
  'chung tâm': 'trung tâm',
  'trế độ': 'chế độ',
  'trỉ đạo': 'chỉ đạo',
  'chỉ thị': 'chỉ thị',
  'chính chị': 'chính trị',
  'chật tự': 'trật tự',
  'dủi ro': 'rủi ro',
  'giủi ro': 'rủi ro',
  'giõ ràng': 'rõ ràng',
  'dõ ràng': 'rõ ràng',
  'dà soát': 'rà soát',
  'già soát': 'rà soát',
  'giao dịch': 'giao dịch',
  'dao dịch': 'giao dịch',
  'giám xát': 'giám sát',
  'dám sát': 'giám sát',
  'dám đốc': 'giám đốc',
  'giữ gìn': 'giữ gìn',
  'dữ gìn': 'giữ gìn',
  'giữ dìn': 'giữ gìn',
  'dàn xếp': 'dàn xếp',
  'diễn giãi': 'diễn giải',
  'giải trình': 'giải trình',
  'dải trình': 'giải trình',
  'gia hạng': 'gia hạn',
  'lăng nhăng': 'lăng nhăng',
  'nàm việc': 'làm việc',
  'lăng lực': 'năng lực',
  'nội dung': 'nội dung',
  'lội dung': 'nội dung',
  'lãnh đạo': 'lãnh đạo',
  'nãnh đạo': 'lãnh đạo',
  'nưu ý': 'lưu ý',
  'nưu trữ': 'lưu trữ',
  'lồng ghép': 'lồng ghép',
  'thẩm quyền': 'thẩm quyền',
  'thẫm quyền': 'thẩm quyền',
  'thẫm định': 'thẩm định',
  'thẫm tra': 'thẩm tra',
  'kỹ lưỡng': 'kỹ lưỡng',
  'kỷ lưỡng': 'kỹ lưỡng',
  'kỹ luật': 'kỷ luật',
  'kỷ thuật': 'kỹ thuật',
  'kỷ năng': 'kỹ năng',
  'kỹ niệm': 'kỷ niệm',
  'kỹ lục': 'kỷ lục',
  'sữa chữa': 'sửa chữa',
  'sửa đổi': 'sửa đổi',
  'sữa đổi': 'sửa đổi',
  'giãi quyết': 'giải quyết',
  'giải ngân': 'giải ngân',
  'nghỉ quyết': 'nghị quyết',
  'nghĩ quyết': 'nghị quyết',
  'nghỉ định': 'nghị định',
  'đề nghĩ': 'đề nghị',
  'hội nghỉ': 'hội nghị',
  'nghỉ ngơi': 'nghỉ ngơi',
  'suy nghỉ': 'suy nghĩ',
  'ý nghỉa': 'ý nghĩa',
  'nghỉa vụ': 'nghĩa vụ',
  'mẩu biểu': 'mẫu biểu',
  'biểu mẩu': 'biểu mẫu',
  'hướng dẩn': 'hướng dẫn',
  'dẫn chứng': 'dẫn chứng',
  'vẩn còn': 'vẫn còn',
  'bảo đãm': 'bảo đảm',
  'đãm bảo': 'đảm bảo',
  'đãm nhận': 'đảm nhận',
  'cỗ phần': 'cổ phần',
  'tổng kết': 'tổng kết',
  'tỗng kết': 'tổng kết',
  'kiễm soát': 'kiểm soát',
  'kiễm điểm': 'kiểm điểm',
  'chủ trì': 'chủ trì',
  'chũ trì': 'chủ trì',
  'quãn lý': 'quản lý',
  'quản lí': 'quản lý',
  'hiễu biết': 'hiểu biết',
  'tiễu ban': 'tiểu ban',
  'đễ nghị': 'đề nghị',
  'mặc dù': 'mặc dù',
  'mặt dù': 'mặc dù',
  'mặt khác': 'mặt khác',
  'mặc khác': 'mặt khác',
  'vô hình chung': 'vô hình trung',
  'đề bạc': 'đề bạt',
  'mục địch': 'mục đích',
  'tham khảo': 'tham khảo',
  'tham khảm': 'tham khảo',
  'chuyên nghành': 'chuyên ngành',
  'nghành nghề': 'ngành nghề',
  'liên nghành': 'liên ngành',
  'sát xuất': 'xác suất',
  'xác xuất': 'xác suất',
  'sơ yếu lý lịch': 'sơ yếu lý lịch',
  'khẩn chương': 'khẩn trương',
  'trương trình': 'chương trình',
  'chương mục': 'chương mục',
  'triêu chuẩn': 'tiêu chuẩn',
  'tiêu trí': 'tiêu chí',
  'triết khấu': 'chiết khấu',
  'chiết tính': 'chiết tính',
};

/** Dùng từ chưa đúng, thừa từ, sai kết hợp (sai → đúng, giải thích). */
export const WORD_USAGE = [
  ['tái diễn lại', 'tái diễn', 'Thừa từ: “tái” đã có nghĩa là “lại”.'],
  ['tái phạm lại', 'tái phạm', 'Thừa từ: “tái” đã có nghĩa là “lại”.'],
  ['tái lập lại', 'tái lập', 'Thừa từ: “tái” đã có nghĩa là “lại”.'],
  ['tái bổ nhiệm lại', 'tái bổ nhiệm', 'Thừa từ: “tái” đã có nghĩa là “lại”.'],
  ['quay trở lại lại', 'quay trở lại', 'Lặp ý.'],
  ['hồi hương về nước', 'hồi hương', 'Thừa từ: “hồi hương” đã là trở về quê hương.'],
  ['đầu tiên nhất', 'đầu tiên', 'Thừa từ: “đầu tiên” đã ở mức cao nhất.'],
  ['cực kỳ rất', 'cực kỳ', 'Thừa từ chỉ mức độ.'],
  ['rất là', 'rất', 'Văn nói — văn bản hành chính dùng “rất”.'],
  ['những các', 'các', 'Không dùng hai lượng từ liền nhau.'],
  ['các những', 'các', 'Không dùng hai lượng từ liền nhau.'],
  ['tất cả mọi', 'mọi', 'Thừa từ: “tất cả” và “mọi” trùng nghĩa.'],
  ['song song cùng lúc', 'song song', 'Lặp ý.'],
  ['tự bản thân mình', 'bản thân', 'Lặp ý.'],
  ['mục đích là để', 'mục đích là', 'Thừa từ “để”.'],
  ['vì vậy cho nên', 'vì vậy', 'Thừa từ nối.'],
  ['bởi vì do', 'do', 'Thừa từ chỉ nguyên nhân.'],
  ['nhưng mà', 'nhưng', 'Văn nói — văn bản hành chính dùng “nhưng”.'],
  ['yếu điểm', 'điểm yếu', '“Yếu điểm” là điểm quan trọng; nếu muốn nói nhược điểm hãy dùng “điểm yếu”.'],
  ['cảm tử quân', 'quân cảm tử', 'Trật tự từ thuần Việt: “quân cảm tử”.'],
  ['kiến nghị lên trên', 'kiến nghị lên', 'Thừa từ.'],
  ['được diễn ra', 'diễn ra', '“Diễn ra” không dùng ở thể bị động.'],
  ['được xảy ra', 'xảy ra', '“Xảy ra” không dùng ở thể bị động.'],
  ['bị xảy ra', 'xảy ra', '“Xảy ra” không dùng với “bị”.'],
];

const B = '(?<![\\p{L}\\p{N}])';
const E = '(?![\\p{L}\\p{N}])';
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Giữ kiểu chữ hoa/thường của từ gốc khi thay thế. */
export function matchCase(original, replacement) {
  if (original === original.toLocaleUpperCase('vi-VN') && original !== original.toLocaleLowerCase('vi-VN')) return replacement.toLocaleUpperCase('vi-VN');
  if (original[0] && original[0] === original[0].toLocaleUpperCase('vi-VN') && original[0] !== original[0].toLocaleLowerCase('vi-VN')) return replacement.charAt(0).toLocaleUpperCase('vi-VN') + replacement.slice(1);
  return replacement;
}

const RULES = [
  // ---- Chính tả ----
  ...Object.entries(MISSPELLINGS)
    .filter(([w, r]) => w !== r)
    .map(([wrong, right]) => ({
      type: 'spelling',
      re: new RegExp(B + escapeRe(wrong) + E, 'giu'),
      fix: (m) => matchCase(m[0], right),
      message: (m) => `“${m[0]}” viết sai chính tả.`,
    })),
  ...WORD_USAGE.map(([wrong, right, why]) => ({
    type: 'word',
    re: new RegExp(B + escapeRe(wrong) + E, 'giu'),
    fix: (m) => matchCase(m[0], right),
    message: (m) => `“${m[0]}”: ${why}`,
  })),
  {
    type: 'spelling',
    re: new RegExp(B + '(\\p{L}{2,})\\s+\\1' + E, 'giu'),
    fix: (m) => m[1],
    message: (m) => `Lặp từ “${m[1]}”.`,
    skip: (m) => /^(ba|nhiều|từng|mỗi|xa|cao|dần|rất|đều|chầm|lâu|thường)$/iu.test(m[1]),
  },
  // ---- Dấu câu ----
  {
    type: 'punctuation',
    re: / {2,}/g,
    fix: () => ' ',
    message: () => 'Thừa khoảng trắng.',
  },
  {
    type: 'punctuation',
    re: /[ \t]+([,.;:!?)])/g,
    fix: (m) => m[1],
    message: (m) => `Không đặt khoảng trắng trước dấu “${m[1]}”.`,
    skip: (m, text) => m[1] === '.' && /\.\/\./.test(text.slice(m.index + m[0].length - 1, m.index + m[0].length + 2)),
  },
  {
    type: 'punctuation',
    re: /\(\s+/g,
    fix: () => '(',
    message: () => 'Không đặt khoảng trắng sau dấu mở ngoặc.',
  },
  {
    type: 'punctuation',
    re: /([,;:])(?=[\p{L}])/gu,
    fix: (m) => m[1] + ' ',
    message: (m) => `Thiếu khoảng trắng sau dấu “${m[1]}”.`,
    skip: (m, text) => /https?$|www$/i.test(text.slice(Math.max(0, m.index - 6), m.index)),
  },
  {
    type: 'punctuation',
    re: /([.!?])(?=[A-ZÀ-ỸĐ][\p{Ll}])/gu,
    fix: (m) => m[1] + ' ',
    message: () => 'Thiếu khoảng trắng sau dấu kết thúc câu.',
  },
  {
    type: 'punctuation',
    re: /(?<=[\p{Ll}]{2})([.!?])(?=\p{Ll}{2,})/gu,
    fix: (m) => m[1] + ' ',
    message: () => 'Thiếu khoảng trắng sau dấu kết thúc câu.',
    // Bỏ qua tên miền, email, đường dẫn (vd: dichvucong.gov.vn, a@b.com).
    skip: (m, text) => {
      const token = text.slice(0, m.index).split(/\s/).pop() + text.slice(m.index).split(/\s/)[0];
      return /@|https?:|www\.|\.(vn|com|net|org|gov|edu|info|io)\b/i.test(token);
    },
  },
  {
    type: 'punctuation',
    re: /([,;:.])\1+(?!\/)/g,
    fix: (m) => m[1],
    message: (m) => `Lặp dấu “${m[1]}”.`,
    skip: (m, text) => m[1] === '.' && (text.slice(m.index, m.index + 3) === '...' || text[m.index + m[0].length] === '/'),
  },
  // ---- Viết hoa ----
  {
    type: 'format',
    re: /([.!?]\s+)(\p{Ll})/gu,
    fix: (m) => m[1] + m[2].toLocaleUpperCase('vi-VN'),
    message: () => 'Chữ đầu câu phải viết hoa.',
    skip: (m, text) => /(\d|v\/v|TP|tr|Tr|St|Q|TM|KT|TL|TUQ|ThS|TS|PGS|GS)\.\s*$/u.test(text.slice(Math.max(0, m.index - 4), m.index + 1)) || text.slice(m.index - 2, m.index + 1) === '...',
  },
  // ---- Thể thức Nghị định 30/2020/NĐ-CP ----
  {
    type: 'format',
    re: /CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM/g,
    fix: () => 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    message: () => 'Quốc hiệu theo mẫu NĐ 30/2020: “CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM”.',
  },
  {
    type: 'format',
    re: /Độc lập\s*[–—]\s*Tự do\s*[–—]\s*Hạnh phúc/g,
    fix: () => 'Độc lập - Tự do - Hạnh phúc',
    message: () => 'Tiêu ngữ dùng gạch nối ngắn (-), có cách chữ: “Độc lập - Tự do - Hạnh phúc”.',
  },
  {
    type: 'format',
    re: /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm/giu,
    fix: (m) => {
      const d = +m[1];
      const mo = +m[2];
      return `ngày ${d < 10 ? '0' + d : d} tháng ${mo <= 2 ? '0' + mo : mo} năm`;
    },
    message: () => 'Ngày dưới 10 và tháng 1, 2 phải thêm số 0 phía trước (NĐ 30/2020).',
    skip: (m) => {
      const d = +m[1];
      const mo = +m[2];
      const okDay = (d < 10 && m[1].length === 2) || (d >= 10 && m[1].length === 2);
      const okMonth = mo <= 2 ? m[2].length === 2 : m[2].length === (mo < 10 ? 1 : 2);
      return okDay && okMonth;
    },
  },
  {
    type: 'format',
    re: new RegExp(B + '(Uỷ ban|uỷ ban|UỶ BAN|Thuỷ|thuỷ|Quỹ|Tuỳ|tuỳ)' + E, 'gu'),
    fix: (m) => m[1].replace('uỷ', 'ủy').replace('Uỷ', 'Ủy').replace('UỶ', 'ỦY').replace('Thuỷ', 'Thủy').replace('thuỷ', 'thủy').replace('Tuỳ', 'Tùy').replace('tuỳ', 'tùy'),
    message: (m) => `Nên thống nhất cách bỏ dấu kiểu mới: “${m[1]}”.`,
    skip: (m) => /Quỹ/.test(m[1]),
  },
  // ---- Văn phong ----
  {
    type: 'style',
    re: new RegExp(B + '(ok|oke|okay|vv\\.\\.\\.|v\\.v\\.\\.\\.|bla bla)' + E, 'giu'),
    fix: (m) => ({ ok: 'đồng ý', oke: 'đồng ý', okay: 'đồng ý' })[m[1].toLowerCase()] || 'v.v.',
    message: (m) => `“${m[1]}” không phù hợp văn phong hành chính.`,
  },
];

const HAS_VI_MARK = /[À-ỹđĐ]/;

/** Diễn giải lý do sai cấu tạo âm tiết bằng lời dễ hiểu. */
function friendlyProblem(p) {
  if (/vần không|ký tự lạ|thiếu vần/.test(p)) return 'có thể gõ nhầm, thừa hoặc thiếu chữ cái';
  if (/hai dấu thanh/.test(p)) return 'có hai dấu thanh';
  if (/p, t, c, ch/.test(p)) return 'sai dấu thanh (từ kết thúc bằng p, t, c, ch chỉ mang dấu sắc hoặc nặng)';
  if (/chữ cái không thuộc/.test(p)) return 'có chữ cái f, j, w, z — có thể sót kiểu gõ';
  return 'sai quy tắc chính tả: ' + p;
}

/**
 * Từ không có nghĩa / sai cấu tạo âm tiết và dấu thanh đặt sai vị trí.
 * Bỏ qua: viết tắt in hoa, tên riêng không dấu, từ mượn, địa chỉ web/email, từ có trong từ điển cá nhân.
 */
export function checkWords(src, { ignore = new Set() } = {}) {
  const out = [];
  const tokens = [...src.matchAll(/[\p{L}\p{M}]+/gu)];
  const marked = tokens.filter((t) => HAS_VI_MARK.test(t[0])).length;
  // Văn bản gõ không dấu hoàn toàn → không bắt lỗi “thiếu dấu” từng từ.
  const accented = tokens.length && marked / tokens.length > 0.2;
  for (const t of tokens) {
    const w = t[0];
    const start = t.index;
    const end = start + w.length;
    const lw = w.toLocaleLowerCase('vi-VN');
    if (w.length < 2 || ignore.has(lw) || LOANWORDS.has(lw)) continue;
    const prev = src[start - 1] || ' ';
    const next = src[end] || ' ';
    if (/[\d_@/\\]/.test(prev) || /[\d_@]/.test(next)) continue;
    const chunk = src.slice(src.lastIndexOf(' ', start) + 1, (src.indexOf(' ', end) + 1 || src.length + 1) - 1);
    if (/@|:\/\/|www\.|\.(vn|com|net|org|gov|edu)\b/i.test(chunk)) continue;
    const hasMark = HAS_VI_MARK.test(w);
    const upper = w === w.toLocaleUpperCase('vi-VN');
    if (upper && !hasMark) continue; // viết tắt: UBND, CSĐT không dấu…
    if (!upper && /\p{Lu}/u.test(w.slice(1))) continue; // camelCase, tên ghép kiểu nước ngoài
    const problem = syllableProblem(w);
    if (problem) {
      if (!hasMark && /^\p{Lu}/u.test(w)) continue; // tên riêng, từ nước ngoài viết hoa
      if (!hasMark && !accented) continue;
      // Từ không dấu: chỉ gợi ý khi giải mã được kiểu gõ Telex/VNI (gợi ý thêm dấu cho từ không dấu dễ sai → để AI).
      const raw = hasMark ? suggestSyllable(w) : [telexDecode(w), vniDecode(w)].filter((x, i, a) => x !== lw && a.indexOf(x) === i && !syllableProblem(x));
      const alts = raw.map((x) => matchCase(w, x));
      out.push({
        type: 'word',
        start,
        end,
        original: w,
        suggestion: alts[0] ?? null,
        alts,
        // Nhiều khả năng sửa, hoặc từ không dấu → không tự sửa khi bấm “Sửa tất cả”.
        ambiguous: alts.length !== 1,
        message: hasMark ? `“${w}” không có nghĩa trong tiếng Việt — ${friendlyProblem(problem)}.` : alts.length ? `“${w}” có vẻ gõ sót kiểu Telex/VNI — nên viết “${alts[0]}”.` : `“${w}” không đúng chính tả tiếng Việt — có thể thiếu dấu hoặc là từ nước ngoài. Dùng “Kiểm tra bằng AI” để có gợi ý.`,
      });
      continue;
    }
    const fix = misplacedTone(w);
    if (fix) out.push({ type: 'spelling', start, end, original: w, suggestion: matchCase(w, fix), message: `Đặt dấu thanh chưa đúng vị trí: “${w}” → “${matchCase(w, fix)}”.` });
  }
  return out;
}

/**
 * Kiểm tra văn bản. Trả về danh sách lỗi đã sắp xếp theo vị trí, không chồng lấn:
 * { id, type, start, end, original, suggestion, message, alts? }
 * opts.ignore: tập từ (chữ thường) bỏ qua — từ điển cá nhân.
 */
export function checkText(text, opts = {}) {
  const src = String(text ?? '');
  const found = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(src))) {
      if (m[0] === '') {
        rule.re.lastIndex++;
        continue;
      }
      if (rule.skip?.(m, src)) continue;
      const suggestion = rule.fix(m);
      if (suggestion === m[0]) continue;
      found.push({ type: rule.type, start: m.index, end: m.index + m[0].length, original: m[0], suggestion, message: rule.message(m) });
    }
  }
  if (opts.words !== false) found.push(...checkWords(src, opts));
  // Ngoặc đơn không cân bằng.
  const open = (src.match(/\(/g) || []).length;
  const close = (src.match(/\)/g) || []).length;
  if (open !== close) {
    const idx = open > close ? src.lastIndexOf('(') : src.lastIndexOf(')');
    found.push({ type: 'punctuation', start: idx, end: idx + 1, original: src[idx], suggestion: null, message: 'Dấu ngoặc đơn chưa được đóng/mở đầy đủ.' });
  }
  // Câu quá dài.
  const sentenceRe = /[^.!?\n]+[.!?]?/g;
  let s;
  while ((s = sentenceRe.exec(src))) {
    const words = s[0].trim().split(/\s+/).filter(Boolean).length;
    if (words > 70) {
      const start = s.index + (s[0].length - s[0].trimStart().length);
      found.push({ type: 'style', start, end: start + Math.min(s[0].trim().length, 40), original: s[0].trim().slice(0, 40), suggestion: null, message: `Câu dài ${words} từ — nên tách thành các câu ngắn để dễ hiểu.` });
    }
  }

  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const result = [];
  let lastEnd = -1;
  for (const f of found) {
    if (f.start < lastEnd) continue;
    result.push({ id: `i${result.length}`, ...f });
    lastEnd = f.end;
  }
  return result;
}

/** Áp dụng các gợi ý sửa (bỏ qua lỗi không có gợi ý). */
export function applyFixes(text, issues) {
  let out = String(text ?? '');
  [...issues]
    .filter((i) => i.suggestion !== null && i.suggestion !== undefined)
    .sort((a, b) => b.start - a.start)
    .forEach((i) => {
      out = out.slice(0, i.start) + i.suggestion + out.slice(i.end);
    });
  return out;
}

/** Sửa tất cả, lặp đến khi ổn định (vì sửa một lỗi có thể lộ ra lỗi khác). */
export function fixAll(text, maxPasses = 4, opts = {}) {
  let cur = String(text ?? '');
  for (let i = 0; i < maxPasses; i++) {
    const issues = checkText(cur, opts).filter((x) => x.suggestion !== null && x.suggestion !== undefined && !x.ambiguous);
    if (!issues.length) break;
    cur = applyFixes(cur, issues);
  }
  return cur;
}

export const ISSUE_LABELS = { spelling: 'Chính tả', word: 'Từ ngữ', grammar: 'Ngữ pháp', punctuation: 'Dấu câu', format: 'Thể thức', style: 'Văn phong' };

/** Điểm chất lượng 0–100 dựa trên mật độ lỗi. */
export function qualityScore(text, issues) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 100;
  const weight = { spelling: 3, word: 3, grammar: 2, punctuation: 1, format: 2, style: 1.5 };
  const penalty = issues.reduce((s, i) => s + (weight[i.type] || 1), 0);
  return Math.max(0, Math.round(100 - (penalty / words) * 250));
}
