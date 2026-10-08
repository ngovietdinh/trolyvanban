// Gửi tài liệu dài cho AI mà không bị hết thời gian chờ:
// 1) lọc trên máy, chỉ giữ các câu có thông tin (hành vi, tiền, ngày tháng, người, điều luật) — bỏ phần thủ tục,
//    tiêu đề, lặp lại; 2) chia thành nhiều phần vừa sức mô hình (AI trên máy nhỏ hơn); 3) gửi lần lượt, mỗi phần
//    trả lời ngắn; phần nào lỗi / hết giờ thì bỏ qua, vẫn giữ kết quả các phần khác.

/** Kích thước mỗi phần (ký tự): dịch vụ trực tuyến ~8 nghìn, AI trên máy ~3,5 nghìn (ngữ cảnh mặc định nhỏ, chạy CPU chậm). */
export const CHUNK = { online: 8000, local: 3500, groq: 4000 };
/** Nhà cung cấp “chật”: AI trên máy (ngữ cảnh nhỏ, chậm) và Groq (gói miễn phí ~8K token/phút). */
export const isTight = (ai) => !!(ai?.local || ai?.provider === 'local' || ai?.provider === 'groq');
export const chunkSizeFor = (ai) => (ai?.local || ai?.provider === 'local' ? CHUNK.local : ai?.provider === 'groq' ? CHUNK.groq : CHUNK.online);
/** Số phần gửi song song: nhà cung cấp chật gửi lần lượt từng phần. */
export const concurrencyFor = (ai) => (isTight(ai) ? 1 : 2);
/** Độ dài ngữ cảnh gửi kèm: lớn với dịch vụ thường, nhỏ với nhà cung cấp chật. */
export const ctxFor = (ai, big, small) => (isTight(ai) ? small : big);

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
 * Chạy fn(chunk, i, n) cho từng phần, bảo đảm kết quả về đủ:
 * - phần lỗi / hết giờ chờ / trả về sai định dạng → tự chia đôi và gửi lại (tối đa 2 lần chia, phần còn ≥ minSize);
 * - phần vẫn lỗi được thử lại một lần ở cuối lượt;
 * - concurrency: số phần gửi cùng lúc (dịch vụ trực tuyến 2, AI trên máy 1).
 * onProgress(đã xong + 1, tổng hiện tại) — tổng tăng khi có phần được chia nhỏ.
 * Trả về { values (theo thứ tự nội dung), errors: [{ i, err }], total, split (số lần chia), retried }.
 */
export async function runChunks(chunks, fn, { signal, onProgress, concurrency = 1, minSize = 800, maxDepth = 2, retryDelay = 1500 } = {}) {
  let seq = 0;
  // key: thứ tự trong nội dung (phần con của phần i đứng ngay sau i).
  const queue = chunks.map((text, i) => ({ text, key: [i], depth: 0, id: seq++ }));
  const done = [];
  const failed = [];
  let total = queue.length;
  let finished = 0;
  let split = 0;
  let retried = 0;
  const attempt = async (job, last = false) => {
    if (signal?.aborted) return;
    onProgress?.(Math.min(finished + 1, total), total);
    try {
      done.push({ key: job.key, value: await fn(job.text, finished, total) });
      finished++;
    } catch (err) {
      if (signal?.aborted) return;
      if (!last && job.depth < maxDepth && job.text.length >= minSize * 2) {
        // Chia đôi phần lỗi rồi gửi lại từng nửa.
        const halves = splitText(job.text, Math.ceil(job.text.length / 2) + 50);
        if (halves.length > 1) {
          split++;
          total += halves.length - 1;
          queue.unshift(...halves.map((t, k) => ({ text: t, key: [...job.key, k], depth: job.depth + 1, id: seq++ })));
          return;
        }
      }
      if (last) {
        finished++;
        failed.push({ i: job.key[0], err });
      } else failed.push({ job, err });
    }
  };
  const worker = async () => {
    while (queue.length && !signal?.aborted) await attempt(queue.shift());
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, worker));
  // Thử lại lần cuối các phần còn lỗi (sau một nhịp nghỉ — máy chủ có thể vừa quá tải).
  const again = failed.splice(0).filter((f) => f.job);
  if (again.length && !signal?.aborted) {
    await new Promise((r) => setTimeout(r, retryDelay));
    for (const f of again) {
      retried++;
      await attempt(f.job, true);
    }
  }
  if (signal?.aborted && !done.length) throw new Error('Đã dừng phân tích.');
  const errors = failed.filter((f) => !f.job);
  if (!done.length && errors.length) throw errors.at(-1).err;
  const cmpKey = (a, b) => {
    for (let k = 0; k < Math.max(a.length, b.length); k++) if ((a[k] ?? -1) !== (b[k] ?? -1)) return (a[k] ?? -1) - (b[k] ?? -1);
    return 0;
  };
  done.sort((a, b) => cmpKey(a.key, b.key));
  return { values: done.map((d) => d.value), errors, total, split, retried };
}
