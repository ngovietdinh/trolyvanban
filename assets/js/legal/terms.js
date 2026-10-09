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
