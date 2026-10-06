// AI cho PDF sang Word: (1) đọc ảnh trang (chính xác nhất cho bản quét mờ, chữ in đậm, chữ hoa có dấu);
// (2) soát lỗi chính tả kết quả OCR — chỉ sửa lỗi nhận dạng, giữ nguyên câu chữ và bố cục.
import { extractJson } from './ai.js';

export const PAGE_SYSTEM = `Bạn là chuyên gia số hóa văn bản hành chính, tố tụng tiếng Việt. Nhiệm vụ: chép lại CHÍNH XÁC từng chữ trong ảnh trang văn bản (kể cả dấu tiếng Việt, số hiệu, ngày tháng, dấu câu), giữ bố cục để dựng lại thành tệp Word.
Không tóm tắt, không sửa câu chữ, không thêm nội dung không có trong ảnh. Chữ không đọc được ghi [...]. Bỏ qua con dấu, chữ ký tay (có thể ghi [Đã ký], [Con dấu]).
Chỉ trả về một JSON hợp lệ.`;

export function pagePrompt() {
  return `Chép lại trang văn bản trong ảnh theo đúng thứ tự từ trên xuống. Trả về JSON:
{"blocks":[ ... ]}
Mỗi khối là một trong các dạng:
- Đoạn văn: {"t":"p","a":"left|center|right|justify","i":true|false,"s":13,"x":"nội dung"} — "a" căn lề, "i" thụt đầu dòng, "s" cỡ chữ ước lượng (pt, bỏ qua nếu là chữ thường); trong "x" dùng **chữ đậm**, *chữ nghiêng*.
- Hai cột song song không kẻ khung (phần đầu văn bản: cơ quan bên trái — Quốc hiệu bên phải; phần nơi nhận — chữ ký): {"t":"cols","l":["dòng 1","dòng 2"],"r":["dòng 1","dòng 2"],"la":"center|left","ra":"center|left"} (mỗi dòng cũng dùng **đậm**, *nghiêng*).
- Bảng có kẻ ô: {"t":"table","rows":[["ô","ô"],["ô","ô"]]}.
Một dòng chữ liền mạch thuộc cùng đoạn thì nối lại thành một đoạn.`;
}

/** **đậm**, *nghiêng*, ***cả hai*** → runs. */
export function inlineRuns(text, size) {
  const runs = [];
  const re = /(\*\*\*|\*\*|\*)(.+?)\1/g;
  let pos = 0;
  let m;
  const s = String(text ?? '');
  while ((m = re.exec(s))) {
    if (m.index > pos) runs.push({ text: s.slice(pos, m.index), size });
    runs.push({ text: m[2], bold: m[1].length >= 2, italic: m[1].length !== 2, size });
    pos = m.index + m[0].length;
  }
  if (pos < s.length) runs.push({ text: s.slice(pos), size });
  return runs.filter((r) => r.text);
}

/** JSON của AI → khối doc model (docx-flow). */
export function aiBlocksToFlow(data, { textWidth = 467 } = {}) {
  const out = [];
  const A = (a) => (['left', 'center', 'right', 'justify'].includes(a) ? a : 'left');
  for (const b of data?.blocks || []) {
    if (b.t === 'table' && Array.isArray(b.rows) && b.rows.length) {
      const n = Math.max(...b.rows.map((r) => (Array.isArray(r) ? r.length : 0)));
      if (!n) continue;
      const w = Math.round((textWidth / n) * 10) / 10;
      out.push({
        type: 'table',
        borders: true,
        cols: Array(n).fill(w),
        rows: b.rows.map((r) => Array.from({ length: n }, (_, i) => ({ blocks: [{ type: 'p', align: 'left', runs: inlineRuns(r[i] ?? '', 12) }] }))),
        before: 4,
      });
    } else if (b.t === 'cols') {
      const half = Math.round((textWidth / 2) * 10) / 10;
      const cell = (lines, a) => ({ blocks: (lines || []).map((x) => ({ type: 'p', align: A(a || 'center'), runs: inlineRuns(x, 13) })) });
      out.push({ type: 'table', borders: false, cols: [half * 0.86, half * 1.14].map((x) => Math.round(x * 10) / 10), rows: [[cell(b.l, b.la), cell(b.r, b.ra)]], before: 6 });
    } else if (b.x != null) {
      const size = b.s && b.s >= 8 && b.s <= 30 ? b.s : 13;
      out.push({ type: 'p', align: A(b.a), indentFirst: b.i ? 28.3 : 0, runs: inlineRuns(b.x, size), before: 3, line: 1.15 });
    }
  }
  return out;
}

/** Gửi ảnh trang cho AI, nhận khối. call(opts) = streamClaude đã gắn cấu hình. */
export async function aiReadPage(call, b64) {
  const reply = await call({
    system: PAGE_SYSTEM,
    maxTokens: 8000,
    cache: true,
    messages: [{ role: 'user', content: [{ type: 'image', mime: 'image/jpeg', data: b64 }, { type: 'text', text: pagePrompt() }] }],
  });
  const data = extractJson(reply);
  if (!data || !Array.isArray(data.blocks)) throw new Error('AI trả về dữ liệu không đúng định dạng.');
  return aiBlocksToFlow(data);
}

/* ---------------- Soát lỗi OCR ---------------- */

export const FIX_SYSTEM = `Bạn là biên tập viên tiếng Việt, chuyên sửa lỗi nhận dạng chữ (OCR) của văn bản hành chính. Chỉ sửa lỗi do máy đọc sai: sai dấu thanh, dấu mũ (CAU → CẦU, Tố chức → Tổ chức), nhầm chữ (PIA → ĐỊA, LI. → II.), dính hoặc tách chữ sai. TUYỆT ĐỐI không viết lại câu, không thêm bớt từ, không đổi số liệu, tên riêng nếu không chắc. Trả về JSON.`;

export function fixPrompt(lines) {
  return `Các dòng OCR dưới đây (giữ nguyên thứ tự, số lượng dòng). Trả về {"lines":["dòng đã sửa", ...]} với đúng ${lines.length} phần tử.\n\n${JSON.stringify(lines)}`;
}

/** Độ giống nhau 0–1 giữa hai chuỗi (bỏ dấu) — chặn AI viết lại câu. */
export function similarity(a, b) {
  const n = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const x = n(a);
  const y = n(b);
  if (!x.length && !y.length) return 1;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length);
}

/**
 * AI soát lỗi các dòng OCR (dòng có toạ độ của pdf2word). Chỉ nhận bản sửa giống bản gốc ≥ 75% (bỏ dấu).
 * Giữ nguyên toạ độ, chỉ thay chữ trong từng đoạn (segment) theo tỉ lệ.
 */
export async function aiFixLines(call, lines) {
  const texts = lines.map((l) => l.segments.map((s) => s.text).join(' ⟂ '));
  const reply = await call({ system: FIX_SYSTEM, maxTokens: 8000, cache: true, messages: [{ role: 'user', content: fixPrompt(texts) }] });
  const data = extractJson(reply);
  if (!data || !Array.isArray(data.lines) || data.lines.length !== lines.length) return lines;
  return lines.map((l, i) => {
    const fixed = String(data.lines[i] ?? '');
    if (similarity(texts[i], fixed) < 0.75) return l;
    const parts = fixed.split(/\s*⟂\s*/);
    if (parts.length !== l.segments.length) return l;
    l.segments.forEach((s, k) => {
      if (s.runs.length === 1) s.runs[0].text = parts[k];
      else if (s.text !== parts[k]) {
        s.runs = [{ ...s.runs[0], text: parts[k] }];
      }
      s.text = parts[k];
    });
    l.text = l.segments.map((s) => s.text).join('\t');
    return l;
  });
}
