// Quét nguyên văn Bộ luật Hình sự → cụm định tội chính xác cho từng điều (dùng cho nhận diện theo cụm, không theo từ đơn).
//
// Nguồn: khoản 1 (mô tả hành vi, trước phần "thì bị phạt") và các điểm của khoản 1, cùng tên điều. Cách rút:
//  1. Bỏ chủ ngữ chung ("Người nào"), điều kiện tiền sự ("đã bị xử phạt vi phạm hành chính… mà còn vi phạm"), định lượng
//     ("từ 2.000.000 đồng đến dưới 50.000.000 đồng", "tỷ lệ … từ 11% đến 30%"), chú thích trong ngoặc, phần hình phạt.
//  2. Tách theo dấu câu và liên từ (hoặc, và, mà, nhằm, để, thuộc một trong…) → các đoạn ứng viên; cắt từ dừng ở hai đầu.
//  3. Giữ đoạn 2–8 âm tiết có nghĩa; tính số điều cùng dùng đoạn đó (df): df = 1 → đặc trưng (w 3), 2–3 → w 2, 4–10 → w 1,
//     > 10 → bỏ (cụm chung như "gây hậu quả nghiêm trọng"). Đoạn ≥ 4 âm tiết và chỉ một điều dùng → tự nó đủ làm căn cứ (solo).
//  4. Tên điều (bỏ "Tội", tách "hoặc") là cụm định danh (w 3, solo).
// Kết quả sinh sẵn ở law-phrases-generated.js (scripts/law-phrases/extract.mjs); khi người dùng nạp nguyên văn Bộ luật
// (Cài đặt Bộ luật) có thể rút lại từ văn bản đó (extractLawPhrases) để cập nhật theo luật hiện hành.
import { syl } from './terms.js';

const STOP_EDGE = new Set('của các những một này đó khác đã được có là cho với về theo trong tại từ đến mà thì hoặc và nào ai đang sẽ bị do vì nếu khi bằng để nhằm ra vào lên xuống lại rồi cũng đều còn như sau đây trường hợp quy định hành vi'.split(/\s+/));
const JUNK = /^(?:người (?:nào|khác|đó)|hành vi khác|trường hợp khác|một trong các|các trường hợp|quy định của pháp luật|pháp luật|nhà nước|cơ quan|tổ chức|cá nhân|tài sản|tiền|làm|gây|hậu quả|thực hiện|phạm tội|chưa được xóa án tích|đã bị kết án|một trong các tội|các tội|quy định tại|điều này|bộ luật này|khoản \d+|điểm [a-zđ])$|khoản này|điều này|bộ luật này|(?:^|\s)điểm [a-zđ](?:\s|$)|trở lên$|trở xuống$|^(?:tổng )?(?:khối lượng|thể tích|trọng lượng|số lượng|giá trị|diện tích|số tiền)$/u;
// Liên từ / dấu tách đoạn — ranh giới chữ tiếng Việt (không dùng \b: "và" sẽ khớp trong "vào").
const B = (w) => `(?<![\\p{L}])(?:${w})(?![\\p{L}])`;
const SPLIT = new RegExp(`\\s*(?:[,;:.]|${B('hoặc|và|mà|nhằm|để|thì|nếu|khi|bằng|do|vì|đối với|thuộc|thông qua|trừ trường hợp|trong trường hợp|cùng với|kèm theo')})\\s*`, 'u');
const TAIL = /\s+(?:của người khác|của mình|cho người khác|với người khác|người khác|có khối lượng|có thể tích|có trọng lượng|có giá trị|trị giá|có số lượng|có diện tích|trở lên|trở xuống|sau đây|như sau)$/u;
// Động từ hay đứng một mình trong tên điều ("Tội sản xuất, buôn bán hàng cấm") — ghép với đối tượng ở vế sau.
const VERBS = /^(?:sản xuất|tàng trữ|vận chuyển|sử dụng|mua bán|chế tạo|chiếm đoạt|chiếm giữ|buôn bán|tiêu thụ|trồng|cất giữ|hủy hoại|cố ý làm hư hỏng|làm hư hỏng|phá hủy|làm giả|lưu hành|cung cấp|phát tán|thu thập|cưỡng đoạt|cướp|cướp giật|trộm cắp|lừa đảo|đưa|nhận|môi giới|chứa chấp|lôi kéo|cưỡng bức|dụ dỗ|bắt|giữ|giam|xâm phạm|cản trở|làm sai lệch|tiết lộ|in|phát hành|mang|đánh tráo|tẩy xóa|sửa chữa|làm|cấp|sử dụng trái phép|mua bán trái phép|tàng trữ trái phép|vận chuyển trái phép|sản xuất trái phép|chiếm đoạt trái phép)(?:\s+trái phép)?$/u;
/** Cụm tên ghép với đối tượng chung chung ("làm tài liệu", "tàng trữ thông tin") không tự đủ làm căn cứ. */
const GENERIC_OBJ = /\s(?:tài liệu|thông tin|giấy tờ|hàng hóa|tài sản|tiền|vật phẩm|phương tiện|người|dữ liệu|văn bản|hồ sơ|tiền tệ|hóa đơn|chứng từ)$/u;
/** Tách "động từ + đối tượng" ở đầu một vế tên điều: "mua bán trái phép chất ma túy" → ["mua bán trái phép", "chất ma túy"]. */
const splitVerb = (x) => {
  const w = x.split(' ');
  for (let k = Math.min(4, w.length - 2); k >= 1; k--) {
    const v = w.slice(0, k).join(' ');
    if (VERBS.test(v)) return [v, w.slice(k).join(' ')];
  }
  return null;
};
const MONEY_COND = /(?:từ|dưới|trên|đến)\s+[\d.,]+\s*(?:đồng|%|người|lần|năm|tháng|ngày|kg|ki-lô-gam|gam|mét|m2|m3|ha|héc ?ta|cây|con|cá thể|lít|tấn|tạ|bộ|chiếc)[^,;]*/giu;

const clean = (s) =>
  String(s || '')
    .normalize('NFC')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[“”"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Phần mô tả hành vi của khoản 1 (+ các điểm a, b, c… của khoản 1) từ danh sách dòng nguyên văn điều luật. */
export function conductText(lines = []) {
  const out = [];
  let inK1 = false;
  for (const raw of lines) {
    const l = clean(raw);
    if (/^1\.\s/.test(l)) {
      inK1 = true;
      out.push(l.replace(/^1\.\s*/, ''));
      continue;
    }
    if (/^\d+\.\s/.test(l)) {
      if (inK1) break;
      continue;
    }
    if (inK1 && /^[a-zđ]\)\s/u.test(l)) out.push(l.replace(/^[a-zđ]\)\s*/u, ''));
  }
  return out.map((t) => t.replace(/,?\s*thì bị (?:phạt|xử phạt|tước|cấm)[\s\S]*$/iu, '').replace(/,?\s*thì bị[\s\S]*$/iu, ''));
}

/** Các đoạn ứng viên (đã chuẩn hóa chữ thường) từ một đoạn mô tả. */
export function chunksOf(text) {
  let t = clean(text).toLocaleLowerCase('vi-VN');
  t = t
    .replace(/^(?:người nào|người|ai|pháp nhân thương mại nào|pháp nhân thương mại|cá nhân|tổ chức)\s+/u, '')
    .replace(/đã bị xử phạt vi phạm hành chính[^;,.]*/gu, ' ')
    .replace(/đã bị kết án về (?:tội này|một trong các tội)[^;,.]*/gu, ' ')
    .replace(/chưa được xóa án tích[^;,.]*/gu, ' ')
    .replace(/mà còn vi phạm/gu, ' ')
    .replace(/thuộc một trong các trường hợp sau đây/gu, ' ; ')
    .replace(/quy định tại [^,;]*/gu, ' ')
    .replace(MONEY_COND, ' ')
    .replace(/\d[\d.,]*\s*(?:đồng|%)/gu, ' ');
  const parts = t.split(SPLIT);
  const out = [];
  for (const p of parts) {
    const ph = trimPhrase(p);
    if (!ph) continue;
    if (!out.includes(ph)) out.push(ph);
  }
  return out;
}
/** Cắt từ dừng hai đầu, bỏ đuôi định lượng; trả về cụm 2–8 âm tiết hoặc ''. */
export function trimPhrase(p) {
  let s = syl(p);
  let joined = s.join(' ');
  for (let i = 0; i < 3; i++) joined = joined.replace(TAIL, '');
  s = joined.split(' ').filter(Boolean);
  while (s.length && STOP_EDGE.has(s[0])) s.shift();
  while (s.length && STOP_EDGE.has(s[s.length - 1])) s.pop();
  joined = s.join(' ');
  for (let i = 0; i < 2; i++) joined = joined.replace(TAIL, '');
  s = joined.split(' ').filter(Boolean);
  if (s.length < 2 || s.length > 8) return '';
  if (s.some((w) => /^\d+$/.test(w))) return '';
  const ph = s.join(' ');
  if (JUNK.test(ph) || /^\d/.test(ph)) return '';
  return ph;
}

/** Cụm định danh từ tên điều: "Tội cướp giật tài sản" → ["cướp giật tài sản"]. */
export const namePhrases = (ten) => namePhrasesDetailed(ten).map((x) => x.ph);
/** Như namePhrases nhưng đánh dấu cụm GHÉP (động từ đứng một mình + đối tượng của vế khác): [{ ph, combo }]. */
export function namePhrasesDetailed(ten) {
  const pieces = clean(ten)
    .replace(/^Tội\s+/iu, '')
    .toLocaleLowerCase('vi-VN')
    .split(new RegExp(`\\s*(?:${B('hoặc')}|[,;])\\s*`, 'u'))
    .map((x) => x.replace(/^tội\s+/u, '').trim())
    .map((x) => {
      let j = syl(x).join(' ');
      for (let i = 0; i < 3; i++) j = j.replace(TAIL, '');
      let s = j.split(' ').filter(Boolean);
      while (s.length && STOP_EDGE.has(s[s.length - 1])) s.pop();
      j = s.join(' ');
      for (let i = 0; i < 2; i++) j = j.replace(TAIL, '');
      return j;
    })
    .filter(Boolean);
  // "sản xuất, buôn bán hàng cấm" → động từ đứng một mình ghép với đối tượng của vế có đối tượng: "sản xuất hàng cấm".
  const objects = [];
  for (const x of pieces) {
    if (VERBS.test(x)) continue;
    const sv = splitVerb(x);
    if (sv && sv[1].split(' ').length >= 2) objects.push(sv[1]);
    else if (!sv && x.split(' ').length >= 2) objects.push(x);
  }
  // Vế chỉ là đối tượng ("tài liệu của cơ quan", "phương tiện kỹ thuật quân sự") không đứng một mình khi tên có vế động từ.
  const hasVerb = pieces.some((x) => VERBS.test(x) || splitVerb(x));
  const out = [];
  const seen = new Set();
  const push = (ph, combo) => {
    if (seen.has(ph) || ph.split(' ').length < 2 || JUNK.test(ph)) return;
    seen.add(ph);
    out.push({ ph, combo });
  };
  for (const x of pieces) {
    if (VERBS.test(x)) {
      for (const o of objects) push(`${x} ${o}`, true);
      continue;
    }
    if (hasVerb && !splitVerb(x)) continue;
    push(x, false);
  }
  return out;
}

/**
 * Rút cụm định tội cho nhiều điều. articles: [{ so, ten, vb: [dòng] }] hoặc [{ so, ten, text }].
 * Trả về { so: [[cụm, w, solo]] } — w: 3 đặc trưng / 2 ít điều dùng / 1 nhiều điều dùng; solo 1 = tự nó đủ làm căn cứ.
 */
export function extractLawPhrases(articles = [], { max = 24 } = {}) {
  const per = new Map();
  const df = new Map();
  const nameOwner = new Map(); // cụm tên điều → điều sở hữu (cụm trùng tên điều khác không được dùng làm căn cứ cho điều này)
  for (const a of articles) {
    const lines = Array.isArray(a.vb) ? a.vb : String(a.text || '').split('\n');
    const texts = conductText(lines);
    const set = new Set();
    for (const t of texts) for (const c of chunksOf(t)) set.add(c);
    const names = namePhrasesDetailed(a.ten || '');
    per.set(String(a.so), { chunks: [...set], names });
    for (const c of set) df.set(c, (df.get(c) || 0) + 1);
    for (const { ph: n } of names) {
      if (!nameOwner.has(n)) nameOwner.set(n, String(a.so));
      if (!set.has(n)) df.set(n, (df.get(n) || 0) + 1);
    }
  }
  const out = {};
  for (const [so, { chunks, names }] of per) {
    const list = [];
    // Tên điều nguyên vế: tự đủ. Cụm ghép với đối tượng chung chung ("làm tài liệu"): chỉ là cụm phụ.
    for (const { ph: n, combo } of names) if (!list.some((x) => x[0] === n)) list.push(combo && GENERIC_OBJ.test(n) ? [n, 2, 0] : [n, 3, 1]);
    const ranked = chunks
      .map((c) => ({ c, d: df.get(c) || 1, n: c.split(' ').length }))
      .filter((x) => x.d <= 10 && !(x.n <= 2 && x.d >= 2) && (!nameOwner.has(x.c) || nameOwner.get(x.c) === so))
      .sort((a, b) => a.d - b.d || b.n - a.n);
    for (const x of ranked) {
      if (list.some((y) => y[0] === x.c)) continue;
      // Cụm 2 âm tiết (“phụ nữ”, “già yếu”) chỉ là cụm phụ trợ (w 1): không tự ghép thành căn cứ.
      const w = x.n <= 2 ? 1 : x.d === 1 ? 3 : x.d <= 3 ? 2 : 1;
      // Tự đủ làm căn cứ: cụm dài (≥ 5 âm tiết) chỉ một điều dùng — cụm 3–4 âm tiết (“lập hồ sơ giả”) vẫn cần thêm cụm khác.
      const solo = x.d === 1 && x.n >= 5 ? 1 : 0;
      list.push([x.c, w, solo]);
      if (list.length >= max) break;
    }
    if (list.length) out[so] = list;
  }
  return out;
}
