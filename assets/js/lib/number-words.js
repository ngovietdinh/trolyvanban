// Đọc số thành chữ tiếng Việt theo cách đọc chuẩn trong văn bản hành chính, kế toán.
// Hỗ trợ số nguyên tới hàng tỷ tỷ (dùng BigInt), số âm và phần thập phân.

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const UNITS = ['', 'nghìn', 'triệu', 'tỷ'];

/** Đọc một nhóm 3 chữ số. `full` = true khi nhóm không đứng đầu (phải đọc đủ "không trăm", "linh"). */
function readTriple(n, full) {
  const tram = Math.floor(n / 100);
  const chuc = Math.floor((n % 100) / 10);
  const donvi = n % 10;
  const out = [];

  if (tram > 0 || full) out.push(DIGITS[tram], 'trăm');

  if (chuc === 0) {
    if (donvi > 0 && (tram > 0 || full)) out.push('linh');
  } else if (chuc === 1) {
    out.push('mười');
  } else {
    out.push(DIGITS[chuc], 'mươi');
  }

  if (donvi > 0) {
    if (donvi === 1 && chuc > 1) out.push('mốt');
    else if (donvi === 5 && chuc > 0) out.push('lăm');
    else if (donvi === 4 && chuc > 1) out.push('tư');
    else out.push(DIGITS[donvi]);
  }
  return out.join(' ');
}

/** Đọc số nguyên không âm (BigInt). */
function readInteger(big) {
  if (big === 0n) return 'không';
  // Tách thành các nhóm 3 chữ số từ phải sang trái.
  const groups = [];
  let x = big;
  while (x > 0n) {
    groups.push(Number(x % 1000n));
    x /= 1000n;
  }

  const parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    const isFirst = i === groups.length - 1;
    // Chuỗi đơn vị: nghìn, triệu, tỷ, nghìn tỷ, triệu tỷ, tỷ tỷ...
    const unitParts = [];
    let k = i;
    while (k > 0) {
      const step = k % 3 === 0 ? 3 : k % 3;
      unitParts.unshift(UNITS[step]);
      k -= step;
    }
    // Nhóm đứng sau một nhóm 0 ở giữa vẫn phải đọc đủ "không trăm".
    parts.push(readTriple(g, !isFirst), ...unitParts.reverse());
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Chuẩn hoá chuỗi số người dùng nhập: chấp nhận "1.234.567", "1 234 567", "1,234,567.89",
 * "1.234,5" (kiểu Việt Nam). Trả về { negative, intPart, fracPart } hoặc null nếu không hợp lệ.
 */
export function parseNumberInput(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().replace(/\s+/g, '').replace(/đ|vnđ|vnd/gi, '');
  if (!s) return null;
  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let intPart = s;
  let fracPart = '';
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;

  if (dots && commas) {
    // Ký tự xuất hiện sau cùng là dấu thập phân.
    const dec = lastDot > lastComma ? '.' : ',';
    const idx = Math.max(lastDot, lastComma);
    intPart = s.slice(0, idx);
    fracPart = s.slice(idx + 1);
    intPart = intPart.split(dec === '.' ? ',' : '.').join('');
    if (intPart.includes(dec)) return null;
  } else if (dots + commas === 1) {
    const sep = dots ? '.' : ',';
    const [a, b] = s.split(sep);
    // "1.000" là phân cách nghìn; "1.5" hoặc "12,75" là thập phân.
    if (b.length === 3 && a.length > 0) intPart = a + b;
    else {
      intPart = a;
      fracPart = b;
    }
  } else if (dots + commas > 1) {
    const sep = dots ? '.' : ',';
    const chunks = s.split(sep);
    if (chunks.slice(1).every((c) => c.length === 3)) intPart = chunks.join('');
    else return null;
  }
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;
  if (!intPart) intPart = '0';
  return { negative, intPart: intPart.replace(/^0+(?=\d)/, ''), fracPart: fracPart.replace(/0+$/, '') };
}

/** Viết hoa chữ cái đầu. */
export function capitalize(text) {
  return text ? text.charAt(0).toLocaleUpperCase('vi-VN') + text.slice(1) : text;
}

/** Đọc số (number | string | bigint) thành chữ. */
export function numberToWords(value) {
  const parsed = typeof value === 'bigint' ? { negative: value < 0n, intPart: (value < 0n ? -value : value).toString(), fracPart: '' } : parseNumberInput(value);
  if (!parsed) throw new Error('Giá trị không phải là số hợp lệ');
  let words = readInteger(BigInt(parsed.intPart));
  if (parsed.fracPart) {
    const frac = parsed.fracPart;
    // Phần thập phân ngắn đọc như một số, dài thì đọc từng chữ số.
    const fracWords = frac.length <= 2 && !frac.startsWith('0') ? readInteger(BigInt(frac)) : [...frac].map((d) => DIGITS[+d]).join(' ');
    words += ' phẩy ' + fracWords;
  }
  if (parsed.negative && words !== 'không') words = 'âm ' + words;
  return words;
}

/** Đọc số tiền theo chuẩn chứng từ kế toán: "Một triệu hai trăm nghìn đồng chẵn." */
export function moneyToWords(value, { currency = 'đồng', suffix = true } = {}) {
  const parsed = parseNumberInput(value);
  if (!parsed) throw new Error('Số tiền không hợp lệ');
  const words = numberToWords(value);
  const tail = parsed.fracPart ? ` ${currency}` : ` ${currency}${suffix ? ' chẵn' : ''}`;
  return capitalize(words + tail) + '.';
}

/** Định dạng số kiểu Việt Nam: 1234567.5 → "1.234.567,5". */
export function formatNumberVi(value) {
  const parsed = parseNumberInput(value);
  if (!parsed) return '';
  const int = parsed.intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (parsed.negative ? '-' : '') + int + (parsed.fracPart ? ',' + parsed.fracPart : '');
}
