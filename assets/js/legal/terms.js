// Tách cụm từ tiếng Việt dùng chung cho đối chiếu hành vi / điều luật.
const STOP = new Set(
  `và của là các có được cho với trong những một này đã để không theo về khi đến tại như do thì mà còn cũng nên vì nếu đó sẽ đang bị ra vào lại trên dưới hay hoặc rằng nhưng tuy nhiều ít rất làm người năm ngày tháng số nhằm đối qua sau trước giữa cùng chỉ đều đây ấy thế nào gì ai sự phải cần đồng thời bao gồm khác hành vi tội việc rồi đó sau khi`.split(/\s+/),
);

export const syl = (s) =>
  String(s || '')
    .normalize('NFC')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** Cụm 2 âm tiết có nghĩa (tiếng Việt đơn lập: “chiếm đoạt”, “hối lộ”, “chứng từ”…) và âm tiết nội dung. */
export function termsOf(text) {
  const s = syl(text);
  const bi = new Set();
  const uni = new Set();
  for (let i = 0; i < s.length; i++) {
    if (!STOP.has(s[i]) && s[i].length > 1 && !/^\d+$/.test(s[i])) uni.add(s[i]);
    if (i < s.length - 1 && !STOP.has(s[i]) && !STOP.has(s[i + 1]) && !/^\d+$/.test(s[i]) && !/^\d+$/.test(s[i + 1])) bi.add(`${s[i]} ${s[i + 1]}`);
  }
  return { bi, uni };
}


export const norm = (s) => syl(s).join(' ');

// Số tiền trong văn bản: “300 triệu đồng”, “1.200.000 đồng” → [{ v (đồng), raw (nguyên văn) }].
export const UNIT = { 'nghìn': 1e3, 'ngàn': 1e3, 'triệu': 1e6, 'tỷ': 1e9, 'tỉ': 1e9 };
export const num = (v) => parseFloat(String(v).replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
/** Các số tiền nêu trong nội dung (đồng): “1,2 tỷ đồng”, “300 triệu”, “50.000.000 đồng”. */
export function amountsIn(text) {
  const out = [];
  const re = /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(nghìn|ngàn|triệu|tỷ|tỉ)?\s*(?:đồng|VNĐ|VND|đ\b)?/giu;
  let m;
  while ((m = re.exec(String(text)))) {
    const unit = m[2] && UNIT[m[2].toLowerCase()];
    const v = unit ? num(m[1]) * unit : /\d[.,]\d{3}/.test(m[1]) && /đồng|VN|đ\b/i.test(m[0]) ? num(m[1].replace(/[.,]/g, '')) : null;
    if (v && v >= 1000) out.push({ v, raw: m[0].trim() });
  }
  return out;
}
