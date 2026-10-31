// Sửa lỗi nhận dạng chữ (OCR) tiếng Việt bằng mô hình ngôn ngữ âm tiết (assets/data/vi-lm.json — thống kê từ án lệ,
// Bộ luật). Lỗi điển hình của OCR với tiếng Việt là MẤT / SAI DẤU, nhất là ở chữ hoa, chữ đậm: "TOI CAO" (TỐI CAO), "CONG HÒA"
// (CỘNG HÒA), "chêt" (chết), "Quyét định so" (Quyết định số), "Tham phán" (Thẩm phán), "Toa án" (Tòa án).
//
// Cách làm: với mỗi dòng, mỗi chữ sinh các ứng viên là những âm tiết trong từ điển có cùng "xương" (bỏ dấu, đ → d), rồi
// chọn chuỗi ứng viên có xác suất cao nhất theo cặp âm tiết liền nhau (Viterbi). Chữ gốc hợp lệ và OCR tự tin thì chỉ bị thay
// khi ngữ cảnh ủng hộ rõ rệt; chữ gốc không có trong từ điển hoặc OCR kém tin thì dễ thay hơn. Giữ nguyên chữ hoa / thường,
// số, dấu câu, tên riêng không có trong từ điển.
let lmPromise = null;
let LM = null;

const stripTone = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .normalize('NFC');
const low = (s) => s.toLocaleLowerCase('vi-VN');

/** Nạp mô hình (một lần). Có thể truyền sẵn dữ liệu (kiểm thử / Node). */
export async function loadViLm(data = null) {
  if (data) {
    LM = index(data);
    lmPromise = Promise.resolve(LM);
    return LM;
  }
  lmPromise ??= fetch(new URL('../../data/vi-lm.json', import.meta.url))
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((d) => (LM = index(d)))
    .catch(() => (LM = null));
  return lmPromise;
}
function index(d) {
  const byBase = new Map();
  for (const w of Object.keys(d.u)) {
    const b = stripTone(w);
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b).push(w);
  }
  for (const list of byBase.values()) list.sort((a, b) => d.u[b] - d.u[a]);
  const v = new Set(String(d.v || '').split(' ').filter(Boolean));
  return { n: d.n, u: d.u, b: d.b, byBase, v, V: Object.keys(d.u).length };
}
const logp = (lm, prev, cur) => {
  const uc = lm.u[cur] || 0;
  const pu = (uc + 0.5) / (lm.n + 0.5 * lm.V); // unigram làm trơn
  if (!prev) return Math.log(pu);
  const up = lm.u[prev] || 0;
  const bc = lm.b[`${prev} ${cur}`] || 0;
  if (!up) return Math.log(pu);
  // Nội suy: cặp quan sát được + unigram.
  const lam = up / (up + 3);
  return Math.log(lam * (bc / up) + (1 - lam) * pu + 1e-9);
};

/** Áp kiểu chữ hoa của mẫu lên chữ mới: ALL CAPS / Viết hoa đầu / thường. */
function applyCase(sample, word) {
  if (sample === sample.toLocaleUpperCase('vi-VN') && /\p{Lu}/u.test(sample) && sample.length > 1) return word.toLocaleUpperCase('vi-VN');
  if (/^\p{Lu}/u.test(sample)) return word.charAt(0).toLocaleUpperCase('vi-VN') + word.slice(1);
  return word;
}

const TOKEN = /(\p{L}+(?:[-']\p{L}+)*)/u;
const FUNC = new Set('và của là các có được cho với trong những một này đã để không theo về khi đến tại như do thì mà còn cũng nên vì nếu đó sẽ đang bị ra vào lại trên dưới hay hoặc rằng nhưng tuy rất đều chỉ từ đối qua sau trước giữa cùng nào gì ai sự phải cần thời bao gồm khác việc rồi đây ấy thế'.split(' '));
/**
 * Sửa một dòng. words: [{ text, confidence }] (tùy chọn, từ OCR) để biết độ tin cậy từng chữ.
 * Trả về { text, changes: [[cũ, mới]] }.
 */
export function correctLine(line, { words = null, lm = LM } = {}) {
  if (!lm || !line) return { text: line, changes: [] };
  // Chuẩn hóa ký tự hay nhầm: Ð (Eth) → Đ.
  const src = String(line).replace(/Ð/g, 'Đ').replace(/ð/g, 'đ').normalize('NFC');
  const parts = src.split(TOKEN); // xen kẽ: ngoài chữ, chữ, ngoài chữ…
  const confOf = (() => {
    if (!words?.length) return () => 100;
    const q = words.map((w) => ({ t: low(String(w.text || '').replace(/[^\p{L}]/gu, '')), c: w.confidence ?? 100 }));
    let i = 0;
    return (tok) => {
      const t = low(tok);
      for (let k = i; k < Math.min(q.length, i + 3); k++)
        if (q[k].t && (q[k].t === t || q[k].t.includes(t) || t.includes(q[k].t))) {
          i = k + 1;
          return q[k].c;
        }
      return 100;
    };
  })();
  // Trạng thái Viterbi theo từng chữ.
  const toks = [];
  for (let i = 1; i < parts.length; i += 2) {
    const tok = parts[i];
    const l = low(tok);
    const conf = confOf(tok);
    const valid = !!lm.u[l] || lm.v.has(l);
    // Tên riêng: chữ viết hoa đứng sau một chữ viết hoa khác hoặc sau danh xưng ("Đặng Hùng", "anh Hùng") → không sửa.
    const prevTok = i >= 3 ? parts[i - 2] : '';
    const isName = /^\p{Lu}\p{Ll}+$/u.test(tok) && (/^\p{Lu}/u.test(prevTok) || /^(?:anh|chị|ông|bà|em|cháu|cô|chú|bác|thôn|xã|huyện|tỉnh|phường|quận|xóm|ấp|làng|đường|phố)$/u.test(low(prevTok)));
    const cands = lm.byBase.get(stripTone(l)) || [];
    const upperNoTone = tok.length > 1 && tok === tok.toLocaleUpperCase('vi-VN') && stripTone(l) === l;
    // Chữ gốc HỢP LỆ và OCR tin cậy (≥ 85) thì giữ nguyên — từ điển pháp lý không đủ rộng để "sửa" tên riêng, từ đời thường
    // ("cơm", "Hùng", "sân"). Chỉ xét thay khi: chữ không có trong từ điển; chữ hoa không dấu ("TOI CAO"); OCR kém tin.
    const keepPen = valid ? 0 : cands.length ? 5 : 0;
    const consider = tok.length > 1 && cands.length && !isName && (!valid || upperNoTone || conf < 85);
    const changePen = !valid ? 0 : upperNoTone ? 1.2 : conf < 70 ? 2.5 : 4;
    const states = [{ w: l, pen: keepPen, orig: true }];
    if (consider) {
      for (const c of cands.slice(0, 12)) if (c !== l) states.push({ w: c, pen: changePen, orig: false });
    } else if (valid && conf < 95 && cands.length > 1 && !isName) {
      // Chữ hợp lệ, OCR khá tin (85–94) vẫn hay sai dấu ("Tham phán", "công bo", "so 162"): chỉ đổi sang ứng viên tạo thành
      // CỤM CỐ ĐỊNH với chữ bên cạnh (cặp xuất hiện ≥ 30 lần và chiếm ≥ 30% các cặp của chữ bên cạnh) khi cặp gốc chưa từng gặp.
      const nxt = i + 2 < parts.length ? low(parts[i + 2]) : '';
      const prv = i >= 3 ? low(parts[i - 2]) : '';
      // Chữ bên cạnh phải là từ có nghĩa (không phải hư từ "và", "của", "theo"…) thì cặp mới là cụm cố định.
      const content = (w) => w && lm.u[w] && !FUNC.has(w);
      const assoc = (pair, nb, c) => {
        const k = lm.b[pair] || 0;
        return k >= 30 && (k / lm.u[nb] >= 0.3 || k / lm.u[c] >= 0.3 || lm.u[c] >= 10 * (lm.u[l] || 1));
      };
      for (const c of cands.slice(0, 12)) {
        if (c === l) continue;
        const okNext = content(nxt) && !lm.b[`${l} ${nxt}`] && assoc(`${c} ${nxt}`, nxt, c);
        const okPrev = content(prv) && !lm.b[`${prv} ${l}`] && assoc(`${prv} ${c}`, prv, c);
        if (okNext || okPrev) states.push({ w: c, pen: 1, orig: false });
      }
    }
    toks.push({ i, tok, states, cands, valid });
  }
  if (!toks.length) return { text: src, changes: [] };
  // Viterbi.
  let prevLayer = toks[0].states.map((s) => ({ s, score: logp(lm, null, s.w) - s.pen, back: null }));
  const layers = [prevLayer];
  for (let k = 1; k < toks.length; k++) {
    const layer = toks[k].states.map((s) => {
      let best = null;
      for (const p of prevLayer) {
        const sc = p.score + logp(lm, p.s.w, s.w) - s.pen;
        if (!best || sc > best.score) best = { s, score: sc, back: p };
      }
      return best;
    });
    layers.push(layer);
    prevLayer = layer;
  }
  let node = prevLayer.reduce((a, b) => (b.score > a.score ? b : a));
  const picked = [];
  while (node) {
    picked.unshift(node.s);
    node = node.back;
  }
  const changes = [];
  picked.forEach((s, k) => {
    const t = toks[k];
    if (s.orig) return;
    const nw = applyCase(t.tok, s.w);
    if (nw !== t.tok) {
      changes.push([t.tok, nw]);
      parts[t.i] = nw;
    }
  });
  return { text: parts.join(''), changes };
}

/** Sửa toàn bộ kết quả OCR (ocr.lines[].text, .words[].text) tại chỗ; trả về số chữ đã sửa. */
export async function correctOcr(ocr) {
  const lm = await loadViLm();
  if (!lm || !ocr?.lines) return 0;
  let n = 0;
  const eth = (t) => String(t).replace(/\u00D0/g, 'Đ').replace(/\u00F0/g, 'đ');
  for (const l of ocr.lines) {
    const r = correctLine(l.text, { words: l.words, lm });
    // Chuẩn hóa Ð (Eth) → Đ ở từng chữ dù không có sửa nào khác.
    for (const w of l.words || []) w.text = eth(w.text);
    if (r.text !== l.text) l.text = r.text;
    if (!r.changes.length) continue;
    n += r.changes.length;
    // Cập nhật từng chữ để bố cục giữ đúng vị trí.
    const map = new Map(r.changes);
    for (const w of l.words || []) {
      const core = w.text.match(TOKEN)?.[1];
      if (core && map.has(core)) w.text = w.text.replace(core, map.get(core));
    }
  }
  if (ocr.text) ocr.text = ocr.lines.map((l) => l.text).join('\n');
  return n;
}

/** Sửa một đoạn văn bản thuần (nhiều dòng). */
export async function correctText(text) {
  const lm = await loadViLm();
  if (!lm) return String(text || '');
  return String(text || '')
    .split('\n')
    .map((l) => correctLine(l, { lm }).text)
    .join('\n');
}
