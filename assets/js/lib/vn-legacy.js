// Chuyển văn bản gõ bằng phông cũ (TCVN3/ABC — .VnTime; VNI-Windows — VNI-Times) sang Unicode.
// PDF tạo từ văn bản phông cũ khi trích chữ sẽ ra “Céng hßa x· héi…” (TCVN3) hoặc “Coäng hoøa xaõ hoäi…” (VNI).
import { isValidSyllable } from './vn-syllable.js';

/* ---------- TCVN3 (TCVN 5712:1993 — bảng mã ABC) ---------- */
// Phông thường (.VnTime): chữ thường có dấu + các chữ hoa không dấu thanh (Ă Â Ê Ô Ơ Ư Đ).
const TCVN3 = {
  '¡': 'Ă', '¢': 'Â', '£': 'Ê', '¤': 'Ô', '¥': 'Ơ', '¦': 'Ư', '§': 'Đ',
  '¨': 'ă', '©': 'â', 'ª': 'ê', '«': 'ô', '¬': 'ơ', '­': 'ư', '®': 'đ',
  'µ': 'à', 'μ': 'à', '¶': 'ả', '·': 'ã', '¸': 'á', '¹': 'ạ',
  '»': 'ằ', '¼': 'ẳ', '½': 'ẵ', '¾': 'ắ', 'Æ': 'ặ',
  'Ç': 'ầ', 'È': 'ẩ', 'É': 'ẫ', 'Ê': 'ấ', 'Ë': 'ậ',
  'Ì': 'è', 'Î': 'ẻ', 'Ï': 'ẽ', 'Ð': 'é', 'Ñ': 'ẹ',
  'Ò': 'ề', 'Ó': 'ể', 'Ô': 'ễ', 'Õ': 'ế', 'Ö': 'ệ',
  '×': 'ì', 'Ø': 'ỉ', 'Ü': 'ĩ', 'Ý': 'í', 'Þ': 'ị',
  'ß': 'ò', 'á': 'ỏ', 'â': 'õ', 'ã': 'ó', 'ä': 'ọ',
  'å': 'ồ', 'æ': 'ổ', 'ç': 'ỗ', 'è': 'ố', 'é': 'ộ',
  'ê': 'ờ', 'ë': 'ở', 'ì': 'ỡ', 'í': 'ớ', 'î': 'ợ',
  'ï': 'ù', 'ñ': 'ủ', 'ò': 'ũ', 'ó': 'ú', 'ô': 'ụ',
  'õ': 'ừ', 'ö': 'ử', '÷': 'ữ', 'ø': 'ứ', 'ù': 'ự',
  'ú': 'ỳ', 'û': 'ỷ', 'ü': 'ỹ', 'ý': 'ý', 'þ': 'ỵ',
};

/** TCVN3 → Unicode. upper = phông chữ hoa (.VnTimeH): các mã có dấu là chữ HOA. */
export function tcvn3ToUnicode(s, { upper = false } = {}) {
  let out = '';
  for (const ch of String(s)) {
    const u = TCVN3[ch];
    out += u ? (upper ? u.toLocaleUpperCase('vi-VN') : u) : ch;
  }
  return out;
}

/* ---------- VNI-Windows ---------- */
// Chữ cái gốc + ký tự dấu đi sau. Một số chữ có dấu là một ký tự riêng.
const VNI_SINGLE = { í: 'í', ì: 'ì', æ: 'ỉ', ó: 'ĩ', ò: 'ị', î: 'ỵ', ô: 'ơ', ö: 'ư', ñ: 'đ', Í: 'Í', Ì: 'Ì', Æ: 'Ỉ', Ó: 'Ĩ', Ò: 'Ị', Î: 'Ỵ', Ô: 'Ơ', Ö: 'Ư', Ñ: 'Đ' };
// Dấu thanh: sắc, huyền, hỏi, ngã, nặng.
const TONE = { ù: '́', ø: '̀', û: '̉', õ: '̃', ï: '̣', Ù: '́', Ø: '̀', Û: '̉', Õ: '̃', Ï: '̣' };
// Mũ (â ê ô) kèm thanh.
const HAT = { â: '', á: '́', à: '̀', å: '̉', ã: '̃', ä: '̣', Â: '', Á: '́', À: '̀', Å: '̉', Ã: '̃', Ä: '̣' };
// Trăng (ă) kèm thanh — chỉ đi với a.
const BREVE = { ê: '', é: '́', è: '̀', ú: '̉', ü: '̃', ë: '̣', Ê: '', É: '́', È: '̀', Ú: '̉', Ü: '̃', Ë: '̣' };

export function vniToUnicode(s) {
  const chars = [...String(s)];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    let c = chars[i];
    const next = chars[i + 1];
    const lower = c.toLowerCase();
    if (/[aeoyu]/.test(lower) && next) {
      if (lower === 'a' && BREVE[next] !== undefined) {
        out += ((c === 'A' ? 'Ă' : 'ă') + BREVE[next]).normalize('NFC');
        i++;
        continue;
      }
      if (/[aeo]/.test(lower) && HAT[next] !== undefined) {
        const base = { a: 'â', e: 'ê', o: 'ô' }[lower];
        out += ((c === lower ? base : base.toUpperCase()) + HAT[next]).normalize('NFC');
        i++;
        continue;
      }
      if (TONE[next]) {
        out += (c + TONE[next]).normalize('NFC');
        i++;
        continue;
      }
    }
    if (VNI_SINGLE[c] !== undefined) {
      const v = VNI_SINGLE[c];
      // ơ, ư có thể mang thanh ở ký tự sau.
      if ((v === 'ơ' || v === 'ư' || v === 'Ơ' || v === 'Ư') && next && TONE[next]) {
        out += (v + TONE[next]).normalize('NFC');
        i++;
        continue;
      }
      out += v;
      continue;
    }
    out += c;
  }
  return out;
}

/* ---------- Nhận diện tự động ---------- */
const TCVN3_SIG = /[¡-¾ÆÇÈÉÊËÌÎÏÐÑÒÓÔÕÖ×ØÜÝÞßáâãäåæçèéêëìíîïñòóôõö÷øùúûüýþ]/g;

/** Tỉ lệ âm tiết hợp lệ trong chuỗi (0–1) — dùng để chọn cách giải mã đúng. */
export function syllableScore(text) {
  const words = String(text).match(/[\p{L}]+/gu) || [];
  const vi = words.filter((w) => w.length >= 1 && w.length <= 7);
  if (!vi.length) return 0;
  return vi.filter((w) => isValidSyllable(w)).length / vi.length;
}

/**
 * Đoán bảng mã của một đoạn chữ trích từ PDF. Trả về 'tcvn3' | 'vni' | null (đã là Unicode).
 * fontName (nếu có): .VnTime → tcvn3, VNI-Times → vni.
 */
export function detectLegacy(text, fontName = '') {
  if (/(^|[+,_ -])\.?vn[a-z]*|\.vn/i.test(fontName) && !/vni/i.test(fontName)) return 'tcvn3';
  if (/vni[-_ ]?/i.test(fontName)) return 'vni';
  const s = String(text);
  if (/[ạ-ỹ]/.test(s)) return null; // đã có chữ Unicode tổ hợp sẵn
  const sig = (s.match(TCVN3_SIG) || []).length;
  if (sig < 2) return null;
  const base = syllableScore(s);
  const t = syllableScore(tcvn3ToUnicode(s));
  const v = syllableScore(vniToUnicode(s));
  const best = Math.max(t, v);
  if (best < base + 0.15) return null;
  return t >= v ? 'tcvn3' : 'vni';
}

/** Chuyển một chuỗi theo bảng mã đã đoán (hoặc tự đoán). */
export function fixLegacy(text, enc = detectLegacy(text), opts = {}) {
  if (enc === 'tcvn3') return tcvn3ToUnicode(text, opts);
  if (enc === 'vni') return vniToUnicode(text);
  return text;
}
