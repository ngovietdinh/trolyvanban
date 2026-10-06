// Kiểm tra chính tả, từ ngữ, ngữ pháp bằng AI: dựng yêu cầu, tách đoạn dài, đọc kết quả JSON và định vị lỗi trong văn bản.

export const SPELL_AI_SYSTEM = `Bạn là biên tập viên tiếng Việt chuyên rà soát văn bản hành chính, văn bản tố tụng theo Nghị định 30/2020/NĐ-CP.
Nhiệm vụ: tìm lỗi chính tả, từ không có nghĩa/gõ nhầm, dùng từ sai nghĩa hoặc sai ngữ cảnh, từ thừa/lặp ý, lỗi ngữ pháp (câu thiếu thành phần, sai quan hệ từ), lỗi dấu câu, văn phong không phù hợp.
Nguyên tắc:
- Chỉ góp ý khi chắc chắn là lỗi; không sửa tên riêng, số hiệu văn bản, số liệu, trích dẫn nguyên văn điều luật.
- "sai" phải chép NGUYÊN VĂN một đoạn ngắn (1–8 từ) có trong văn bản, đủ để xác định vị trí.
- "sua" là đoạn thay thế cho đúng phần "sai" (không viết lại cả câu nếu không cần).
- Trả lời DUY NHẤT một JSON, không kèm giải thích ngoài JSON.`;

export const AI_TYPES = { 'chinh-ta': 'spelling', 'tu-ngu': 'word', 'ngu-phap': 'grammar', 'dau-cau': 'punctuation', 'van-phong': 'style', 'the-thuc': 'format' };

export function spellAiPrompt(chunk) {
  return `Rà soát đoạn văn bản dưới đây. Trả về JSON đúng dạng:
{"loi":[{"sai":"đoạn sai nguyên văn","sua":"đoạn đúng","loai":"chinh-ta|tu-ngu|ngu-phap|dau-cau|van-phong|the-thuc","giaiThich":"lý do ngắn gọn"}],"nhanXet":"1–2 câu nhận xét chung về chất lượng ngôn ngữ"}
Tối đa 40 lỗi, xếp theo thứ tự xuất hiện. Nếu không có lỗi, trả về "loi": [].

---
${chunk}
---`;
}

/** Tách văn bản dài theo đoạn để mỗi lần gửi không quá `max` ký tự. Trả về [{ text, offset }]. */
export function splitChunks(text, max = 5000) {
  const out = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + max);
    if (end < text.length) {
      const nl = text.lastIndexOf('\n', end);
      const dot = text.lastIndexOf('. ', end);
      const cut = nl > start + max * 0.5 ? nl + 1 : dot > start + max * 0.5 ? dot + 2 : end;
      end = cut;
    }
    out.push({ text: text.slice(start, end), offset: start });
    start = end;
  }
  return out;
}

/**
 * Định vị các góp ý của AI trong văn bản. Bỏ góp ý không tìm thấy, không đổi gì, hoặc trùng vị trí.
 * Trả về [{ type, start, end, original, suggestion, message, ai: true }].
 */
export function locateAiIssues(text, items, offset = 0, chunkLen = text.length) {
  const out = [];
  let cursor = offset;
  const limit = offset + chunkLen;
  for (const it of items || []) {
    const sai = String(it?.sai ?? '').trim();
    const sua = it?.sua == null ? null : String(it.sua);
    if (!sai || sua === sai) continue;
    let idx = text.indexOf(sai, cursor);
    if (idx < 0 || idx >= limit) idx = text.indexOf(sai, offset);
    if (idx < 0 || idx >= limit) {
      const low = text.toLocaleLowerCase('vi-VN');
      idx = low.indexOf(sai.toLocaleLowerCase('vi-VN'), offset);
      if (idx < 0 || idx >= limit) continue;
    }
    const end = idx + sai.length;
    if (out.some((o) => idx < o.end && end > o.start)) continue;
    cursor = end;
    out.push({
      type: AI_TYPES[it.loai] || 'spelling',
      start: idx,
      end,
      original: text.slice(idx, end),
      suggestion: sua,
      message: String(it.giaiThich || 'AI đề nghị sửa.').trim(),
      ai: true,
    });
  }
  return out;
}

/** Gộp lỗi trên máy và góp ý AI: lỗi trên máy ưu tiên, góp ý AI chồng lấn bị bỏ. */
export function mergeIssues(local, ai) {
  const all = [...local];
  for (const a of ai) if (!local.some((l) => a.start < l.end && a.end > l.start)) all.push(a);
  return all.sort((x, y) => x.start - y.start).map((x, i) => ({ ...x, id: (x.ai ? 'a' : 'i') + i }));
}
