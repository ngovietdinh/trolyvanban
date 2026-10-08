// Phân tích tài liệu vụ việc (đơn tố giác, báo cáo, kết luận thanh tra, biên bản…) để đề xuất hành vi vi phạm,
// đối chiếu với các điều luật đang có trong hệ thống. Chạy được hoàn toàn trên máy; có AI thì phân tích sâu hơn.
// Một vụ việc có thể liên quan nhiều điều luật cùng lúc → kết quả gồm điều chính và các điều liên quan.
import { ALL_CRIMES, findCrime, crimeWithCustomActs } from './engine.js';
import { summarize, splitSentences } from '../lib/summarize.js';
import { extractJson } from '../lib/ai.js';
import { focusText, splitText, runChunks, CHUNK } from '../lib/ai-chunk.js';

const STOP = new Set(
  `và của là các có được cho với trong những một này đã để không theo về khi đến tại như do thì mà còn cũng nên vì nếu đó sẽ đang bị ra vào lại trên dưới hay hoặc rằng nhưng tuy nhiều ít rất làm người năm ngày tháng số nhằm đối qua sau trước giữa cùng chỉ đều đây ấy thế nào gì ai sự phải cần đồng thời bao gồm khác hành vi tội việc rồi đó sau khi`.split(/\s+/),
);

const syl = (s) =>
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

/** Độ khớp 0–1 giữa câu trong tài liệu và tên hành vi trong hệ thống (theo cụm từ của hành vi). */
export function matchScore(actTerms, sentTerms, phrase = '', sentence = '') {
  if (!actTerms.bi.size && !actTerms.uni.size) return 0;
  let b = 0;
  actTerms.bi.forEach((t) => sentTerms.bi.has(t) && b++);
  let u = 0;
  actTerms.uni.forEach((t) => sentTerms.uni.has(t) && u++);
  // Phải trùng ≥ 2 cụm từ và ≥ 1/4 số cụm của hành vi — hoặc tài liệu chứa nguyên cụm tên hành vi (hành vi ngắn).
  const n = actTerms.bi.size;
  const whole = phrase && sentence && phrase.split(' ').length >= 2 && sentence.includes(phrase);
  if (!whole && (b < 2 || b / n < 0.25)) return 0;
  if (whole) return Math.max(0.7, Math.min(1, (b / Math.max(2, n)) * 0.75 + (u / Math.max(3, actTerms.uni.size)) * 0.35));
  return Math.min(1, (b / Math.max(2, actTerms.bi.size)) * 0.75 + (u / Math.max(3, actTerms.uni.size)) * 0.35);
}

// Dấu hiệu một câu mô tả hành vi (động từ thường gặp trong hồ sơ hình sự).
export const ACTION = /(chiếm đoạt|chiếm giữ|lừa|gian dối|giả mạo|làm giả|giả danh|nhận tiền|nhận hối lộ|đưa hối lộ|đưa tiền|môi giới|chi khống|lập khống|kê khai|khai khống|nâng khống|nâng giá|rút tiền|chuyển tiền|chuyển khoản|thông đồng|câu kết|móc nối|chỉ định thầu|nâng|hợp thức|ký duyệt|phê duyệt|tham ô|lạm quyền|lợi dụng|vượt quá|thiếu trách nhiệm|cố ý|vi phạm|trộm|cắp|cướp|cưỡng đoạt|đe dọa|uy hiếp|đánh|đâm|chém|gây thương tích|giết|hiếp|dâm|mua bán|tàng trữ|vận chuyển|sản xuất|buôn lậu|trốn thuế|xuất hóa đơn|mua hóa đơn|cho vay|đánh bạc|tổ chức|chứa chấp|tiêu thụ|rửa tiền|hủy hoại|phá hoại|xả thải|khai thác|tham gia)/iu;

const short = (s, n = 140) => {
  const t = String(s).replace(/\s+/g, ' ').trim().replace(/^[-•+*\d.)\s]+/, '');
  if (t.length <= n) return t.replace(/[.;,:]$/, '');
  const cut = t.slice(0, n);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 60))}…`;
};

const norm = (s) => syl(s).join(' ');

// Các tội “biến thể” khác tội cơ bản bởi một tình tiết đặc biệt trong tên (vô ý, khi thi hành công vụ, kích động
// mạnh, vượt quá phòng vệ…): chỉ chọn khi mô tả có nhắc tình tiết đó.
const QUALIFIERS = [['vô ý'], ['thi hành công vụ'], ['kích động'], ['phòng vệ', 'bắt giữ'], ['quy tắc nghề nghiệp', 'quy tắc hành chính'], ['con mới đẻ']];
export function qualifierPenalty(crimeName, textNorm) {
  const n = norm(crimeName);
  return QUALIFIERS.some((ws) => ws.some((w) => n.includes(w)) && !ws.some((w) => textNorm.includes(w))) ? 0.3 : 0;
}

/** Các “Điều N” của BLHS được nêu trong tài liệu (bỏ qua điều của BLTTHS, luật khác). */
export function mentionedArticles(text) {
  const out = new Map();
  const re = /Điều\s+(\d{1,3}[a-zđ]?)(?:\s*,\s*(?:khoản|điểm)[^.;\n]{0,40})?([^.;\n]{0,60})/giu;
  let m;
  while ((m = re.exec(text))) {
    const tail = m[2] || '';
    if (/tố tụng|BLTTHS|luật (?!hình sự)|nghị định|thông tư|hiến pháp|bộ luật dân sự|BLDS/i.test(tail)) continue;
    const c = findCrime(m[1]);
    if (c) out.set(c.dieu, (out.get(c.dieu) || 0) + 1);
  }
  return out;
}

/**
 * Phân tích ngoại tuyến. primary: điều đang mở trên cây hỏi đáp.
 * Trả về { tomTat, crimes: [{ dieu, ten, score, reasons }], items: [{ ten, dieu, hanhViId, trich, score, checked, nguon }] }.
 */
export function analyzeOffline(text, { primary } = {}) {
  const src = String(text || '');
  const sentences = splitSentences(src)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 15 && s.length <= 600);
  const sentT = sentences.map((s) => termsOf(s));
  const sentN = sentences.map((s) => norm(s));
  const whole = norm(src);
  const mentioned = mentionedArticles(src);

  const crimeInfo = [];
  const best = new Map(); // `${dieu}|${hvId}` → item
  for (const base of ALL_CRIMES) {
    const crime = crimeWithCustomActs(base.dieu) || base;
    const reasons = [];
    let score = 0;
    const name = norm(crime.ten.replace(/^Tội\s+/i, ''));
    if (name.split(' ').length >= 2 && whole.includes(name)) {
      score += 5;
      reasons.push('Tài liệu nêu tên tội danh');
    }
    if (mentioned.has(crime.dieu)) {
      score += 6;
      reasons.push(`Tài liệu viện dẫn Điều ${crime.dieu}`);
    }
    let matched = 0;
    for (const h of crime.hanhVi) {
      const ht = termsOf(h.ten);
      const phrase = norm(h.ten);
      let top = null;
      sentences.forEach((s, i) => {
        const sc = matchScore(ht, sentT[i], phrase, sentN[i]) - qualifierPenalty(crime.ten, sentN[i]);
        if (sc >= 0.34 && (!top || sc > top.sc)) top = { sc, s };
      });
      if (top) {
        matched++;
        score += 1.5 + top.sc * 2;
        const k = `${crime.dieu}|${h.id}`;
        if (!best.has(k) || best.get(k).score < top.sc) best.set(k, { ten: h.ten, dieu: crime.dieu, hanhViId: h.id, trich: short(top.s, 260), score: top.sc, nguon: 'he-thong' });
      }
    }
    if (matched) reasons.push(`${matched} hành vi trong hệ thống khớp với nội dung tài liệu`);
    const strong = [...best.values()].some((x) => x.dieu === crime.dieu && x.score >= 0.45);
    // Dấu hiệu định tội xuất hiện trong tài liệu (trọng số nhỏ).
    const sig = termsOf((crime.dauHieu || []).join(' '));
    let hit = 0;
    sig.bi.forEach((t) => whole.includes(t) && hit++);
    if (sig.bi.size && hit / sig.bi.size > 0.15) {
      score += Math.min(2, (hit / sig.bi.size) * 4);
      reasons.push('Nội dung có các dấu hiệu định tội của điều này');
    }
    if (score > 0) crimeInfo.push({ dieu: crime.dieu, ten: crime.ten, score: Math.round(score * 10) / 10, reasons, strong });
  }
  crimeInfo.sort((a, b) => b.score - a.score);
  // Điều được xem xét: điều đang mở, điều được viện dẫn, và các điều điểm cao (đủ mạnh).
  const top = crimeInfo.filter((c, i) => c.dieu === String(primary) || mentioned.has(c.dieu) || (i < 8 && (c.score >= 4.5 || c.strong)));
  const keep = new Set(top.map((c) => c.dieu));
  if (primary) keep.add(String(primary));

  const items = [...best.values()]
    .filter((x) => keep.has(x.dieu))
    .sort((a, b) => b.score - a.score)
    .map((x) => ({ ...x, checked: x.dieu === String(primary) || mentioned.has(x.dieu) ? x.score >= 0.3 : x.score >= 0.6 }));

  // Câu mô tả hành vi chưa khớp hành vi nào trong hệ thống → đề xuất hành vi mới (mặc định không chọn).
  const used = new Set(items.map((x) => x.trich));
  // Gắn vào điều có tên / dấu hiệu gần nhất trong các điều đang xét.
  // Điều đang xét được ưu tiên; điều khác trong hệ thống chỉ nhận khi trùng rõ hơn (≥ 2 cụm từ với tên tội / hành vi).
  const crimeTerms = ALL_CRIMES.map((c) => crimeWithCustomActs(c.dieu) || c).map((c) => ({ dieu: c.dieu, kept: keep.has(c.dieu), name: termsOf(c.ten.replace(/^Tội\s+/i, '')), t: termsOf(`${c.hanhVi.map((h) => h.ten).join(' ')}${keep.has(c.dieu) ? ` ${(c.dauHieu || []).join(' ')}` : ''}`) }));
  const bestDieu = (st) => {
    let pick = String(primary || top[0]?.dieu || '');
    let sc = 0;
    for (const c of crimeTerms) {
      let n = 0;
      st.bi.forEach((t) => (c.name.bi.has(t) ? (n += 2.5) : c.t.bi.has(t) && n++)); // trùng tên tội danh nặng hơn
      const eff = c.kept ? n + 0.5 : n >= 2 ? n : 0;
      if (eff > sc) [sc, pick] = [eff, c.dieu];
    }
    return pick;
  };
  const fresh = sentences
    .map((s, i) => ({ s, st: sentT[i] }))
    .filter(({ s }) => ACTION.test(s) && !used.has(short(s, 260)) && !/^(căn cứ|xét|theo|thực hiện|qua|ngày|hồi|vào lúc)\b/iu.test(s) && !/có dấu hiệu (của )?tội|theo (quy định tại )?Điều \d/iu.test(s))
    .slice(0, 8)
    .map(({ s, st }) => ({ ten: short(s), dieu: bestDieu(st), hanhViId: null, trich: short(s, 260), score: 0, checked: false, nguon: 'tai-lieu' }));

  const sum = summarize(src, { maxSentences: 5 });
  const crimes = top.length ? [...top] : crimeInfo.slice(0, 5);
  for (const f of fresh) {
    if (f.dieu && !crimes.some((c) => c.dieu === f.dieu)) {
      const c = findCrime(f.dieu);
      if (c) crimes.push({ dieu: c.dieu, ten: c.ten, score: 1, reasons: ['Có câu mô tả hành vi gần với điều này'] });
    }
  }
  return { tomTat: sum.summary, keywords: sum.keywords, crimes, items: [...items, ...fresh] };
}

/**
 * Hành vi nhập tay (mỗi dòng một hành vi, hoặc một đoạn mô tả): mỗi dòng thành một hành vi. Dòng khớp hành vi có sẵn
 * trong hệ thống → dùng hành vi đó; không khớp → hành vi mới, gắn vào điều luật gần nhất (tên tội danh, hành vi).
 * Trả về cùng dạng analyzeOffline: { tomTat, crimes, items }.
 */
export function analyzeActs(text, { primary } = {}) {
  const raw = String(text || '')
    .split(/\n+/)
    .flatMap((l) => (l.length > 260 ? splitSentences(l) : [l]))
    .map((l) => l.replace(/^\s*[-•+*\d.)]+\s*/, '').trim())
    .filter((l) => l.length >= 6);
  const crimes = ALL_CRIMES.map((c) => crimeWithCustomActs(c.dieu) || c);
  const named = crimes.map((c) => ({ c, name: termsOf(c.ten.replace(/^Tội\s+/i, '')), acts: termsOf(c.hanhVi.map((h) => h.ten).join(' ')) }));
  const mentioned = mentionedArticles(text);
  const score = new Map();
  const items = raw.map((line) => {
    const st = termsOf(line);
    const ln = norm(line);
    // 1) Hành vi có sẵn khớp nhất.
    let best = null;
    for (const c of crimes) {
      for (const h of c.hanhVi) {
        const sc = matchScore(termsOf(h.ten), st, norm(h.ten), ln) + (String(primary) === c.dieu ? 0.05 : 0) - qualifierPenalty(c.ten, ln);
        if (sc >= 0.34 && (!best || sc > best.sc)) best = { sc, c, h };
      }
    }
    // 2) Điều luật gần nhất theo tên tội danh / hành vi (tên tội nặng hơn).
    let pick = null;
    let top = 0;
    const m = line.match(/Điều\s+(\d{1,3}[a-zđ]?)/iu);
    if (m && findCrime(m[1])) pick = findCrime(m[1]).dieu;
    for (const n of named) {
      let k = 0;
      st.bi.forEach((t) => (n.name.bi.has(t) ? (k += 2.5) : n.acts.bi.has(t) && k++));
      if (String(primary) === n.c.dieu) k += 0.5;
      if (k) k -= qualifierPenalty(n.c.ten, ln) * 10;
      if (k > top) [top, pick] = [k, pick && m ? pick : n.c.dieu];
    }
    const it = best
      ? { ten: best.h.ten, dieu: best.c.dieu, hanhViId: best.h.id, trich: short(line, 260), score: best.sc, checked: true, nguon: 'he-thong' }
      : { ten: short(line, 160), dieu: top >= 1 || m ? pick : String(primary || pick || ''), hanhViId: null, trich: '', score: 0, checked: true, nguon: 'tu-nhap' };
    score.set(it.dieu, (score.get(it.dieu) || 0) + 1 + it.score);
    return it;
  });
  for (const [d, n] of mentioned) score.set(d, (score.get(d) || 0) + 2 * n);
  const ranked = [...score]
    .filter(([d]) => findCrime(d))
    .sort((a, b) => b[1] - a[1])
    .map(([d, sc]) => {
      const n = items.filter((x) => x.dieu === d).length;
      return { dieu: d, ten: findCrime(d).ten, score: Math.round(sc * 10) / 10, reasons: [n ? `${n} hành vi nhập vào thuộc điều này` : '', mentioned.has(d) ? `Có viện dẫn Điều ${d}` : ''].filter(Boolean) };
    });
  return { tomTat: '', keywords: [], crimes: ranked, items };
}

/** Gộp kết quả từ nhiều nguồn (nhập tay + tài liệu): bỏ trùng hành vi, cộng điểm điều luật. */
export function mergeResults(...rs) {
  const list = rs.filter(Boolean);
  const items = [];
  const seen = new Set();
  for (const r of list) {
    for (const x of r.items) {
      const k = x.hanhViId ? `${x.dieu}|${x.hanhViId}` : `${x.dieu}|${norm(x.ten)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      items.push(x);
    }
  }
  const cs = new Map();
  for (const r of list) {
    for (const c of r.crimes) {
      const cur = cs.get(c.dieu);
      cs.set(c.dieu, cur ? { ...cur, score: Math.round((cur.score + c.score) * 10) / 10, reasons: [...new Set([...cur.reasons, ...(c.reasons || [])])] } : { ...c, reasons: [...(c.reasons || [])] });
    }
  }
  return { tomTat: list.map((r) => r.tomTat).filter(Boolean).join(' '), keywords: list.flatMap((r) => r.keywords || []), crimes: [...cs.values()].sort((a, b) => b.score - a.score), items, ai: list.some((r) => r.ai) };
}

/**
 * Đối chiếu dấu hiệu định tội của điều luật (trong phần mềm) với nội dung vụ việc: dấu hiệu nào có cụm từ xuất hiện.
 * Trả về [{ text, hit }].
 */
const UNIT = { 'nghìn': 1e3, 'ngàn': 1e3, 'triệu': 1e6, 'tỷ': 1e9, 'tỉ': 1e9 };
const num = (v) => parseFloat(String(v).replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
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
const fmtMoney = (v) => (v >= 1e9 ? `${(v / 1e9).toLocaleString('vi-VN')} tỷ đồng` : `${(v / 1e6).toLocaleString('vi-VN')} triệu đồng`);

export function signCoverage(crime, text) {
  const t = termsOf(text);
  const money = amountsIn(text);
  const maxMoney = money.length ? Math.max(...money.map((x) => x.v)) : 0;
  return (crime?.dauHieu || []).map((d) => {
    // Ngưỡng giá trị (“từ 2 triệu đồng trở lên”): so với số tiền lớn nhất nêu trong nội dung.
    const th = d.match(/từ\s+([\d.,]+)\s*(nghìn|ngàn|triệu|tỷ|tỉ)\s*đồng\s*trở lên/iu);
    if (th && maxMoney) {
      const need = num(th[1]) * UNIT[th[2].toLowerCase()];
      return { text: d, hit: maxMoney >= need, note: `${maxMoney >= need ? 'Có' : 'Chưa đủ'}: số tiền ${fmtMoney(maxMoney)} ${maxMoney >= need ? '≥' : '<'} ${fmtMoney(need)}` };
    }
    const st = termsOf(d.replace(/theo mô tả tại khoản \d+ Điều \d+\w* BLHS/i, ''));
    let b = 0;
    st.bi.forEach((x) => t.bi.has(x) && b++);
    return { text: d, hit: st.bi.size ? b >= 2 && b / st.bi.size >= 0.2 : false };
  });
}

/** Gắn kết quả đối chiếu dấu hiệu cho từng điều được đề xuất và cách xác định từng hành vi. */
export function annotateResult(result, text, method) {
  const crimes = result.crimes.map((c) => {
    const crime = findCrime(c.dieu);
    return crime ? { ...c, signs: signCoverage(crime, text) } : c;
  });
  const items = result.items.map((x) => {
    const crime = crimeWithCustomActs(x.dieu);
    const known = crime && x.hanhViId ? crime.hanhVi.find((h) => h.id === x.hanhViId) : null;
    // Cách xác định: khớp hành vi có sẵn trong Bộ luật của phần mềm, AI đề xuất (đã kiểm tra điều luật), hay nhập mới.
    const doiChieu = known ? 'khop' : crime ? 'moi' : 'ngoai';
    return { ...x, doiChieu };
  });
  return { ...result, crimes, items, method };
}

/* ---------------- AI ---------------- */

export const ANALYZE_SYSTEM = `Bạn là điều tra viên, kiểm sát viên giàu kinh nghiệm, nắm vững Bộ luật Hình sự 2015 (sửa đổi 2017, 2025). Nhiệm vụ: đọc tài liệu vụ việc, tóm tắt, rồi liệt kê từng hành vi có dấu hiệu tội phạm, đối chiếu với điều luật cụ thể.
Nguyên tắc: chỉ dựa trên nội dung tài liệu, không suy diễn; mỗi hành vi kèm đoạn trích nguyên văn làm căn cứ; ưu tiên các điều và hành vi có trong danh mục được cung cấp; một vụ việc có thể liên quan nhiều điều luật (ví dụ tham ô và lạm quyền, lừa đảo và làm giả tài liệu) — liệt kê đủ; điều luật ngoài danh mục chỉ nêu khi chắc chắn. Câu hỏi phải bám sát dấu hiệu cấu thành của điều luật, đúng tư cách người được hỏi, không mớm cung. Chỉ trả về JSON hợp lệ.`;

/** Danh mục rút gọn gửi kèm cho AI: các điều ứng viên với hành vi (id) và dấu hiệu định tội. */
export function catalogForAi(dieus) {
  return dieus
    .map((d) => crimeWithCustomActs(d))
    .filter(Boolean)
    .map((c) => `Điều ${c.dieu} — ${c.ten}\n  Dấu hiệu: ${(c.dauHieu || []).slice(0, 4).join('; ')}\n  Hành vi: ${c.hanhVi.map((h) => `[${h.id}] ${h.ten}`).join('; ')}`)
    .join('\n');
}

export function analyzePrompt(text, { primary, candidates, role, part = null }) {
  const body = String(text).slice(0, 14000);
  return `${part ? `ĐÂY LÀ PHẦN ${part[0]}/${part[1]} CỦA TÀI LIỆU — chỉ liệt kê hành vi có trong phần này; "tomTat" chỉ 1–2 câu.
` : ''}Điều đang làm việc: Điều ${primary}. Người sẽ lấy lời khai: ${role}.
DANH MỤC ĐIỀU LUẬT TRONG HỆ THỐNG (ưu tiên dùng; "hanhViId" lấy trong ngoặc vuông nếu hành vi trùng):
${catalogForAi(candidates)}

TÀI LIỆU VỤ VIỆC${String(text).length > 14000 ? ' (đã cắt bớt phần cuối)' : ''}:
"""
${body}
"""

Trả về JSON:
{"tomTat":"tóm tắt vụ việc 3–5 câu",
 "hanhVi":[{"ten":"tên hành vi ngắn gọn","dieu":"số điều BLHS","hanhViId":"id trong danh mục hoặc null nếu hành vi mới","trich":"đoạn trích nguyên văn trong tài liệu","lyDo":"vì sao thỏa mãn dấu hiệu của điều này","cauHoi":["3–6 câu hỏi đặc thù bám dấu hiệu cấu thành — chỉ khi hanhViId null"],"taiLieu":["tài liệu cần thu thập"]}]}`;
}

/**
 * Gọi AI phân tích, hợp nhất với kết quả ngoại tuyến. call(opts) = streamAI đã gắn cấu hình.
 * Điều luật AI nêu được kiểm tra với hệ thống: không có trong hệ thống → gắn cờ ngoài danh mục.
 */
export async function analyzeWithAi(call, text, { primary, offline, role = 'người được hỏi', signal, chunkSize = CHUNK.online, onProgress, concurrency = 1 } = {}) {
  const candidates = [...new Set([String(primary), ...offline.crimes.map((c) => c.dieu)])].filter(Boolean).slice(0, 12);
  // Tài liệu dài: lọc câu có thông tin rồi chia phần, gửi lần lượt — tránh hết thời gian chờ.
  const chunks = splitText(focusText(text, { min: chunkSize }), chunkSize);
  const run = await runChunks(
    chunks,
    async (chunk, i, n) => {
      const out = await call({ system: ANALYZE_SYSTEM, cache: true, maxTokens: n > 1 ? 3000 : 5000, signal, timeoutRetry: n === 1 ? undefined : false, messages: [{ role: 'user', content: analyzePrompt(chunk, { primary, candidates, role, part: n > 1 ? [i + 1, n] : null }) }] });
      const part = extractJson(out);
      if (!part || !Array.isArray(part.hanhVi)) throw new Error('AI trả về kết quả không đúng định dạng — đang dùng kết quả phân tích trên máy.');
      return part;
    },
    { signal, onProgress, concurrency, minSize: Math.min(1500, Math.round(chunkSize / 4)) },
  );
  const j = { tomTat: run.values.map((x) => x.tomTat).filter(Boolean).join(' ').slice(0, 900), hanhVi: run.values.flatMap((x) => x.hanhVi) };
  // Bỏ hành vi trùng giữa các phần.
  const seen = new Set();
  j.hanhVi = j.hanhVi.filter((h) => {
    const k = `${String(h?.dieu || '').replace(/\D+$/, '')}|${h?.hanhViId || String(h?.ten || '').toLowerCase().trim()}`;
    return h && !seen.has(k) && seen.add(k);
  });
  const items = j.hanhVi
    .filter((h) => h && h.ten)
    .map((h) => {
      const dieu = String(h.dieu || primary).replace(/\D+$/g, '').replace(/^Điều\s*/i, '').trim();
      const crime = crimeWithCustomActs(dieu);
      const known = crime && h.hanhViId ? crime.hanhVi.find((x) => x.id === h.hanhViId) : null;
      return {
        ten: known ? known.ten : short(h.ten, 160),
        dieu,
        hanhViId: known ? known.id : null,
        trich: short(h.trich || '', 260),
        lyDo: h.lyDo || '',
        cauHoi: known ? [] : (h.cauHoi || []).filter(Boolean).slice(0, 8),
        taiLieu: (h.taiLieu || []).filter(Boolean).slice(0, 6),
        score: 1,
        checked: !!crime,
        ngoaiDanhMuc: !crime,
        nguon: 'ai',
      };
    });
  // Giữ thêm các hành vi hệ thống khớp mạnh mà AI bỏ sót.
  const have = new Set(items.map((x) => `${x.dieu}|${x.hanhViId}`));
  const extra = offline.items.filter((x) => x.hanhViId && x.score >= 0.5 && !have.has(`${x.dieu}|${x.hanhViId}`)).map((x) => ({ ...x, checked: false }));
  const dieus = [...new Set(items.map((x) => x.dieu).filter((d) => findCrime(d)))];
  const crimes = [
    ...dieus.map((d) => offline.crimes.find((c) => c.dieu === d) || { dieu: d, ten: findCrime(d).ten, score: 0, reasons: [] }).map((c) => ({ ...c, reasons: [...new Set([...(c.reasons || []), 'AI xác định có hành vi thuộc điều này'])] })),
    ...offline.crimes.filter((c) => !dieus.includes(c.dieu)),
  ];
  return { tomTat: j.tomTat || offline.tomTat, keywords: offline.keywords, crimes, items: [...items, ...extra], ai: true, aiParts: { total: run.total, failed: run.errors.length, split: run.split } };
}

/* ---------------- Câu hỏi cho hành vi mới ---------------- */

/**
 * Câu hỏi ngoại tuyến cho hành vi mới: bám nội dung tài liệu (đoạn trích) và dấu hiệu định tội của điều luật.
 */
export function questionsForAct(crime, ten, trich = '') {
  const t = ten.charAt(0).toLowerCase() + ten.slice(1).replace(/[.…]+$/, '');
  const qs = [];
  if (trich) qs.push(`Tài liệu ghi nhận: “${short(trich, 200)}”. Anh/chị trình bày rõ nội dung này: thời gian, địa điểm, ai thực hiện, thực hiện thế nào?`);
  qs.push(
    `Anh/chị trình bày cụ thể việc ${t}: thời gian, địa điểm, cách thức, thủ đoạn thực hiện?`,
    `Ai đề xuất, ai chỉ đạo, ai trực tiếp thực hiện việc ${t}; vai trò của từng người?`,
    `Việc ${t} nhằm mục đích gì; ai được hưởng lợi, lợi ích cụ thể là bao nhiêu?`,
  );
  for (const d of (crime?.dauHieu || []).slice(0, 3)) qs.push(`Làm rõ dấu hiệu “${d.charAt(0).toLowerCase() + d.slice(1).replace(/\.$/, '')}”: căn cứ nào chứng minh có hoặc không có dấu hiệu này trong việc ${t}?`);
  qs.push(`Việc ${t} gây thiệt hại gì, cho ai, giá trị bao nhiêu; căn cứ xác định?`, `Tài liệu, chứng từ, dữ liệu điện tử nào phản ánh việc ${t}; hiện ai đang lưu giữ?`);
  return [...new Set(qs)];
}

export const taiLieuForAct = (ten) => [`Tài liệu, chứng từ liên quan đến việc ${ten.charAt(0).toLowerCase() + ten.slice(1).replace(/[.…]+$/, '')}`, 'Dữ liệu điện tử, tin nhắn, thư điện tử, sao kê tài khoản liên quan'];
