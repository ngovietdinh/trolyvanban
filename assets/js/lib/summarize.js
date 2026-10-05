// Tóm tắt trích xuất (extractive) cho tiếng Việt — chạy cục bộ, không cần máy chủ.
// Tiếng Việt là ngôn ngữ đơn lập: dùng cụm 2 âm tiết (bigram) làm đơn vị nghĩa xấp xỉ "từ".

const STOP = new Set(
  `và của là các có được cho với trong những một này đã để không theo về khi từ đến tại như do
  thì mà còn cũng nên vì nếu đó sẽ đang bị ra vào lại trên dưới hay hoặc rằng nhưng tuy nhiều
  ít rất làm việc người năm ngày tháng số nhằm đối việc qua sau trước giữa cùng chỉ đều đây ấy
  thế nào gì ai sự phải cần đồng thời bao gồm`.split(/\s+/),
);

export function splitSentences(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split(/(?<=[.!?…])\s+(?=[\p{Lu}\d"“(])|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const syllables = (s) =>
  s
    .toLocaleLowerCase('vi-VN')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

function terms(sentence) {
  const syl = syllables(sentence);
  const out = [];
  for (let i = 0; i < syl.length; i++) {
    if (!STOP.has(syl[i]) && syl[i].length > 1 && !/^\d+$/.test(syl[i])) out.push(syl[i]);
    if (i < syl.length - 1 && !STOP.has(syl[i]) && !STOP.has(syl[i + 1])) out.push(`${syl[i]} ${syl[i + 1]}`);
  }
  return out;
}

export function textStats(text) {
  const t = String(text || '');
  const words = t.trim() ? t.trim().split(/\s+/).length : 0;
  return {
    characters: t.length,
    words,
    sentences: splitSentences(t).length,
    paragraphs: t.split(/\n\s*\n|\n/).filter((p) => p.trim()).length,
    readingMinutes: Math.max(words ? 1 : 0, Math.round(words / 220)),
  };
}

/** Trích từ khóa nổi bật (ưu tiên cụm 2 âm tiết). */
export function keywords(text, limit = 8) {
  const freq = new Map();
  for (const s of splitSentences(text)) for (const t of terms(s)) freq.set(t, (freq.get(t) || 0) + (t.includes(' ') ? 1.6 : 1));
  const ranked = [...freq.entries()].filter(([, f]) => f >= 2).sort((a, b) => b[1] - a[1]);
  const picked = [];
  for (const [t] of ranked) {
    // Bỏ âm tiết đơn đã nằm trong một cụm được chọn.
    if (!t.includes(' ') && picked.some((p) => p.split(' ').includes(t))) continue;
    picked.push(t);
    if (picked.length >= limit) break;
  }
  return picked;
}

/**
 * Tóm tắt văn bản. ratio: tỉ lệ số câu giữ lại (0–1) hoặc maxSentences cố định.
 * Trả về { sentences: string[], summary: string, keywords: string[] }.
 */
export function summarize(text, { ratio = 0.3, maxSentences, minSentences = 1 } = {}) {
  const sents = splitSentences(text);
  if (!sents.length) return { sentences: [], summary: '', keywords: [] };
  const want = Math.max(minSentences, Math.min(sents.length, maxSentences ?? Math.ceil(sents.length * ratio)));
  if (sents.length <= want) return { sentences: sents, summary: sents.join(' '), keywords: keywords(text) };

  const freq = new Map();
  const sentTerms = sents.map((s) => terms(s));
  sentTerms.forEach((ts) => new Set(ts).forEach((t) => freq.set(t, (freq.get(t) || 0) + 1)));
  const maxF = Math.max(...freq.values());

  const scored = sents.map((s, i) => {
    const ts = sentTerms[i];
    const len = syllables(s).length;
    let score = ts.reduce((acc, t) => acc + freq.get(t) / maxF, 0) / Math.sqrt(Math.max(len, 1));
    if (i === 0) score *= 1.35; // Câu mở đầu thường nêu mục đích.
    if (i === sents.length - 1) score *= 1.1;
    if (/^(I|II|III|IV|V|VI)\.|^\d+\.\s/.test(s) && len < 12) score *= 0.4; // Đề mục ngắn.
    if (/(kết luận|đề nghị|yêu cầu|giao|chỉ đạo|kết quả|đạt|tăng|giảm)/iu.test(s)) score *= 1.2;
    if (len < 5) score *= 0.5;
    return { i, s, score };
  });

  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, want).sort((a, b) => a.i - b.i);
  return { sentences: top.map((x) => x.s), summary: top.map((x) => x.s).join(' '), keywords: keywords(text) };
}
