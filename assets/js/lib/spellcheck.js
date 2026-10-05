// Bộ kiểm tra chính tả, dấu câu và thể thức cho văn bản hành chính tiếng Việt.
// Chạy hoàn toàn trên trình duyệt; mỗi lỗi trả về vị trí để tô sáng và gợi ý sửa.

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
};

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

/**
 * Kiểm tra văn bản. Trả về danh sách lỗi đã sắp xếp theo vị trí, không chồng lấn:
 * { id, type, start, end, original, suggestion, message }
 */
export function checkText(text) {
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
export function fixAll(text, maxPasses = 4) {
  let cur = String(text ?? '');
  for (let i = 0; i < maxPasses; i++) {
    const issues = checkText(cur).filter((x) => x.suggestion !== null);
    if (!issues.length) break;
    cur = applyFixes(cur, issues);
  }
  return cur;
}

export const ISSUE_LABELS = { spelling: 'Chính tả', punctuation: 'Dấu câu', format: 'Thể thức', style: 'Văn phong' };

/** Điểm chất lượng 0–100 dựa trên mật độ lỗi. */
export function qualityScore(text, issues) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 100;
  const weight = { spelling: 3, punctuation: 1, format: 2, style: 1.5 };
  const penalty = issues.reduce((s, i) => s + (weight[i.type] || 1), 0);
  return Math.max(0, Math.round(100 - (penalty / words) * 250));
}
