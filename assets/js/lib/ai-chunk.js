// Gửi tài liệu dài cho AI mà không bị hết thời gian chờ:
// 1) lọc trên máy, chỉ giữ các câu có thông tin (hành vi, tiền, ngày tháng, người, điều luật) — bỏ phần thủ tục,
//    tiêu đề, lặp lại; 2) chia thành nhiều phần vừa sức mô hình (AI trên máy nhỏ hơn); 3) gửi lần lượt, mỗi phần
//    trả lời ngắn; phần nào lỗi / hết giờ thì bỏ qua, vẫn giữ kết quả các phần khác.

/** Kích thước mỗi phần (ký tự): dịch vụ trực tuyến ~8 nghìn, AI trên máy ~3,5 nghìn (ngữ cảnh mặc định nhỏ, chạy CPU chậm). */
export const CHUNK = { online: 8000, local: 3500 };
export const chunkSizeFor = (ai) => (ai?.local || ai?.provider === 'local' ? CHUNK.local : CHUNK.online);

const SIGNAL = /(chiếm đoạt|chiếm giữ|lừa|gian dối|giả mạo|làm giả|nhận|đưa|chuyển|chi |chi khống|lập|ký|duyệt|thông đồng|chỉ đạo|giao|rút|nộp|vay|trả|mua|bán|tham ô|lạm quyền|lợi dụng|vi phạm|thiếu trách nhiệm|trộm|cướp|đe dọa|đánh|đâm|gây thương tích|tàng trữ|vận chuyển|buôn lậu|trốn thuế|hóa đơn|đánh bạc|tiêu thụ|hủy hoại|thiệt hại|hậu quả|hưởng lợi|khai|thừa nhận|không biết|không nhớ|Điều\s+\d|\d[\d.,]*\s*(?:nghìn|ngàn|triệu|tỷ|tỉ|đồng|USD)|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|ngày\s+\d|tháng\s+\d|năm\s+\d{4}|(?:ông|bà|anh|chị|giám đốc|kế toán|thủ quỹ|chủ tịch|trưởng phòng)\s+\p{Lu})/iu;
const BOILER = /^(cộng hòa xã hội|độc lập\s*[-–]|căn cứ\s|người tiến hành|người ghi biên bản|người khai đã được giải thích|biên bản này|việc (ghi lời khai|hỏi cung)[^.]*kết thúc|nơi nhận|mẫu số|ban hành kèm|họ tên:|sinh ngày|quốc tịch|nghề nghiệp|nơi (thường trú|ở hiện tại|cấp)|thẻ cccd|số điện thoại)/i;

const sentencesOf = (text) =>
  String(text || '')
    .replace(/\r/g, '')
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?;])\s+(?=\p{Lu}|\d|“|")/u))
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Lọc tài liệu: bỏ phần thủ tục, tiêu đề; giữ câu có dấu hiệu thông tin. Chỉ lọc khi dài hơn `min` ký tự và
 * kết quả còn đủ nội dung (≥ 25%), tránh lọc mất ý. Giữ nguyên thứ tự câu.
 */
export function focusText(text, { min = 6000 } = {}) {
  const t = String(text || '').trim();
  if (t.length <= min) return t;
  const seen = new Set();
  const keep = sentencesOf(t).filter((s) => {
    const k = s.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(k) || s.length < 12 || BOILER.test(s)) return false;
    seen.add(k);
    return SIGNAL.test(s);
  });
  const out = keep.join('\n');
  return out.length >= t.length * 0.25 ? out : t;
}

/** Chia nội dung thành các phần ≤ size ký tự, cắt ở ranh giới đoạn / câu. */
export function splitText(text, size = CHUNK.online) {
  const t = String(text || '').trim();
  if (t.length <= size) return t ? [t] : [];
  const out = [];
  let cur = '';
  const push = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = '';
  };
  for (const s of sentencesOf(t)) {
    if (s.length > size) {
      push();
      for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
      continue;
    }
    if (cur.length + s.length + 1 > size) push();
    cur += `${cur ? '\n' : ''}${s}`;
  }
  push();
  return out;
}

/**
 * Chạy fn(chunk, i, n) lần lượt cho từng phần. Phần lỗi được ghi lại, không làm hỏng cả lượt.
 * Trả về { values: [kết quả các phần thành công], errors: [{ i, err }], total }. Dừng ngay khi signal bị hủy.
 */
export async function runChunks(chunks, fn, { signal, onProgress } = {}) {
  const values = [];
  const errors = [];
  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) break;
    onProgress?.(i + 1, chunks.length);
    try {
      values.push(await fn(chunks[i], i, chunks.length));
    } catch (err) {
      if (signal?.aborted) break;
      errors.push({ i, err });
    }
  }
  if (signal?.aborted && !values.length) throw new Error('Đã dừng phân tích.');
  if (!values.length && errors.length) throw errors.at(-1).err;
  return { values, errors, total: chunks.length };
}
