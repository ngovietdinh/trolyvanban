// Kiểm tra cấu tạo âm tiết tiếng Việt (phụ âm đầu + vần + thanh) — phát hiện “từ không có nghĩa”:
// gõ nhầm (thôngg, côgn), sót kiểu gõ Telex/VNI (dduowcj, thoongs), sai quy tắc chính tả (nghành, ghà, kà),
// vần tắc (p, t, c, ch) mang thanh không hợp lệ (đươc, việc→viềc)… Chạy hoàn toàn trên máy.

const TONE_MARKS = { '̀': 1, '́': 2, '̉': 3, '̃': 4, '̣': 5 }; // huyền, sắc, hỏi, ngã, nặng
const MARK_OF = ['', '̀', '́', '̉', '̃', '̣'];

/** Tách thanh điệu: trả về { base (chữ thường, không thanh, giữ â ă ê ô ơ ư đ), tone, toneCount }. */
export function splitTone(word) {
  let tone = 0;
  let toneCount = 0;
  let base = '';
  for (const ch of word.toLowerCase().normalize('NFD')) {
    if (TONE_MARKS[ch]) {
      tone = TONE_MARKS[ch];
      toneCount++;
    } else base += ch;
  }
  return { base: base.normalize('NFC'), tone, toneCount };
}

const INITIALS = ['ngh', 'ch', 'gh', 'gi', 'kh', 'ng', 'nh', 'ph', 'qu', 'th', 'tr', 'b', 'c', 'd', 'đ', 'g', 'h', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'x'];

// Vần (không kể âm đệm o/u) — nhóm theo âm chính.
const CORE = `a ai ao au ay am an ang anh ap at ac ach
ă ăm ăn ăng ăp ăt ăc
â âm ân âng âp ât âc âu ây
e eo em en eng ep et ec
ê êu êm ên ênh êp êt êch
i ia iu im in inh ip it ich iêm iên iêng iêp iêt iêc iêu
y yêm yên yêng yêt yêu
o oi om on ong op ot oc ooc oong
ô ôi ôm ôn ông ôp ôt ôc
ơ ơi ơm ơn ơp ơt
u ua ui um un ung up ut uc uôi uôm uôn uông uôt uôc
ư ưa ưi ưu ưm ưn ưng ưt ưc ươi ươu ươm ươn ương ươp ươt ươc`
  .split(/\s+/)
  .filter(Boolean);

// Vần có âm đệm (viết bằng o trước a, ă, e; bằng u trước â, ê, y, ơ, a sau q).
const MEDIAL = `oa oai oao oay oam oan oang oanh oap oat oac oach
oăm oăn oăng oăp oăt oăc
oe oeo oem oen oet
uâ uân uâng uât uây uê uêch uênh uơ
uy uya uyu uyn uynh uyp uyt uych uyên uyêt`
  .split(/\s+/)
  .filter(Boolean);

const RHYMES = new Set([...CORE, ...MEDIAL]);
// Sau “qu”: chữ u đã là âm đệm → vần không bắt đầu bằng o/u (đệm), trừ uy… được viết “quy…”.
const QU_RHYMES = new Set(
  [...CORE.filter((r) => /^[aăâeêioôơy]/.test(r)), 'yên', 'yêt', 'ynh', 'ych', 'yt', 'ynh', 'y'].filter((r) => !/^(oo|ia$)/.test(r)),
);

const STOP_FINAL = /(p|t|c|ch)$/;
const FRONT = /^[ieêy]/; // nguyên âm hàng trước: dùng k, gh, ngh

/**
 * Âm tiết có hợp lệ không (chỉ xét chữ cái tiếng Việt, đã bỏ dấu câu).
 * Trả về null nếu hợp lệ, hoặc chuỗi lý do nếu không.
 */
export function syllableProblem(word) {
  const { base, tone, toneCount } = splitTone(word);
  if (!base) return 'trống';
  if (toneCount > 1) return 'có hai dấu thanh';
  if (/[fjwz]/.test(base)) return 'có chữ cái không thuộc tiếng Việt';
  if (/[^a-zâăêôơưđ]/.test(base)) return 'có ký tự lạ';
  let initial = '';
  for (const c of INITIALS) {
    if (base.startsWith(c) && base.length > c.length) {
      initial = c;
      break;
    }
  }
  let rhyme = base.slice(initial.length);
  // “gi” trước i/iê: viết gộp (gì, gìn, giếng = gi + iêng).
  if (initial === 'gi') {
    if (rhyme === '' || /^[nmtpc]|^nh|^ch/.test(rhyme)) rhyme = 'i' + rhyme;
    else if (rhyme.startsWith('ê')) rhyme = 'i' + rhyme;
  }
  if (!rhyme) return 'thiếu vần';
  if (initial === 'qu') {
    if (!QU_RHYMES.has(rhyme)) return 'vần không hợp lệ sau “qu”';
  } else if (!RHYMES.has(rhyme)) {
    return base.startsWith('q') ? '“q” phải đi với “u”' : 'vần không có trong tiếng Việt';
  }
  // Quy tắc chính tả c/k, g/gh, ng/ngh.
  const v = rhyme;
  if (initial === 'k' && !FRONT.test(v)) return '“k” chỉ đứng trước i, e, ê, y';
  if (initial === 'c' && FRONT.test(v)) return 'trước i, e, ê phải viết “k”';
  if (initial === 'gh' && !FRONT.test(v)) return '“gh” chỉ đứng trước i, e, ê';
  if (initial === 'g' && /^[eê]/.test(v)) return 'trước e, ê phải viết “gh”';
  if (initial === 'ngh' && !/^[ieê]/.test(v)) return '“ngh” chỉ đứng trước i, e, ê';
  if (initial === 'ng' && /^[ieê]/.test(v)) return 'trước i, e, ê phải viết “ngh”';
  // iê/yê: không có phụ âm đầu thì viết “yê”, có phụ âm đầu thì viết “iê”.
  if (/^yê/.test(v) && initial && initial !== 'qu') return 'sau phụ âm đầu phải viết “iê”';
  if (/^iê/.test(v) && !initial) return 'đứng đầu âm tiết phải viết “yê”';
  if (/^(ia|iu|ich|inh|ip|it)$/.test(v) && false) return null;
  // Vần tắc chỉ mang thanh sắc hoặc nặng.
  if (STOP_FINAL.test(v) && tone !== 2 && tone !== 5) return 'âm tiết kết thúc bằng p, t, c, ch phải có dấu sắc hoặc nặng';
  return null;
}

export const isValidSyllable = (w) => syllableProblem(w) === null;

/** Các cách đặt dấu thanh được chấp nhận (kiểu cũ “hoà, thuý” và kiểu mới “hòa, thúy”). */
export function tonePlacements(base, tone) {
  const out = new Set([applyTone(base, tone)]);
  if (tone && /(oa|oe|uy)$/.test(base) && !/^qu/.test(base)) {
    const chars = [...base];
    const i = chars.length - 2;
    chars[i] = (chars[i] + MARK_OF[tone]).normalize('NFC');
    out.add(chars.join(''));
  }
  return out;
}

/** Dấu thanh đặt sai vị trí (cuả → của, nghiã → nghĩa). Trả về cách viết đúng hoặc null. */
export function misplacedTone(word) {
  const { base, tone, toneCount } = splitTone(word);
  if (toneCount !== 1 || syllableProblem(word)) return null;
  const lw = word.toLowerCase().normalize('NFC');
  const ok = tonePlacements(base, tone);
  return ok.has(lw) ? null : [...ok].pop();
}

/* ---------------- Gợi ý sửa ---------------- */

/** Đặt thanh vào âm tiết không dấu (quy tắc kiểu mới: oà→òa giữ cách phổ biến “hòa”). */
export function applyTone(base, tone) {
  if (!tone) return base;
  const s = base.normalize('NFC');
  const vowels = [...s].map((c, i) => (/[aăâeêioôơuưy]/.test(c) ? i : -1)).filter((i) => i >= 0);
  if (!vowels.length) return s;
  let idx;
  const chars = [...s];
  const hasHat = vowels.find((i) => /[ăâêôơư]/.test(chars[i]));
  if (hasHat !== undefined) {
    // ươ: đặt vào ơ.
    idx = chars[hasHat] === 'ư' && chars[hasHat + 1] === 'ơ' ? hasHat + 1 : hasHat;
  } else {
    let vs = vowels;
    // Bỏ âm đệm u sau q, i sau g (gi).
    if (/^qu/.test(s)) vs = vs.filter((i) => i !== 1);
    if (/^gi/.test(s) && vs.length > 1) vs = vs.filter((i) => i !== 1);
    const endsConsonant = !/[aăâeêioôơuưy]$/.test(s);
    if (vs.length >= 3) idx = vs[1];
    else if (vs.length === 2) idx = endsConsonant ? vs[1] : /^(oa|oe|uy)$/.test(chars[vs[0]] + chars[vs[1]]) ? vs[1] : vs[0];
    else idx = vs[0];
  }
  chars[idx] = (chars[idx] + MARK_OF[tone]).normalize('NFC');
  return chars.join('');
}

/** Giải mã kiểu gõ Telex còn sót (dduowcj → được). */
export function telexDecode(word) {
  let w = word.toLowerCase();
  let tone = 0;
  const toneKey = { s: 2, f: 1, r: 3, x: 4, j: 5 };
  // Phím thanh thường gõ cuối.
  const last = w.at(-1);
  if (toneKey[last] && w.length > 2) {
    tone = toneKey[last];
    w = w.slice(0, -1);
  }
  w = w
    .replace(/dd/g, 'đ')
    .replace(/uow/g, 'ươ')
    .replace(/aw/g, 'ă')
    .replace(/aa/g, 'â')
    .replace(/ee/g, 'ê')
    .replace(/oo/g, 'ô')
    .replace(/ow/g, 'ơ')
    .replace(/uw/g, 'ư')
    .replace(/w/g, 'ư');
  return applyTone(w, tone);
}

/** Giải mã kiểu gõ VNI (d9u7o75c → được). */
export function vniDecode(word) {
  let w = word.toLowerCase();
  let tone = 0;
  const map = { 1: 2, 2: 1, 3: 3, 4: 4, 5: 5 };
  w = w.replace(/[1-5]/g, (d) => ((tone = map[d]), ''));
  w = w
    .replace(/d9/g, 'đ')
    .replace(/a6/g, 'â')
    .replace(/a8/g, 'ă')
    .replace(/e6/g, 'ê')
    .replace(/o6/g, 'ô')
    .replace(/o7/g, 'ơ')
    .replace(/u7/g, 'ư');
  return /\d/.test(w) ? word : applyTone(w, tone);
}

/** Danh sách gợi ý (đã kiểm tra hợp lệ), ưu tiên sửa ít nhất. */
export function suggestSyllable(word) {
  const out = [];
  const push = (w) => {
    if (w && w !== word.toLowerCase() && isValidSyllable(w) && !out.includes(w)) out.push(w);
  };
  const { base, tone } = splitTone(word);
  // Vần tắc thiếu/sai thanh → thử nặng, sắc.
  if (STOP_FINAL.test(base)) {
    push(applyTone(base, 5));
    push(applyTone(base, 2));
  }
  // Quy tắc c/k, g/gh, ng/ngh, iê/yê.
  const swaps = [
    [/^ngh(?=[^ieê])/, 'ng'],
    [/^ng(?=[ieê])/, 'ngh'],
    [/^gh(?=[^ieê])/, 'g'],
    [/^g(?=[eê])/, 'gh'],
    [/^k(?=[^ieêyh])/, 'c'],
    [/^c(?=[ieêy])/, 'k'],
    [/^yê/, 'yê'],
    [/^([^aăâeêioôơuưy]+)yê/, '$1iê'],
    [/^iê/, 'yê'],
  ];
  for (const [re, rep] of swaps) if (re.test(base)) push(applyTone(base.replace(re, rep), tone));
  // Sai dấu mũ/móc trong nguyên âm đôi (nguời, đuợc, ngưòi → người, được).
  for (const [re, rep] of [[/uơ|ưo/, 'ươ'], [/uo(?=[cimnpt])/, 'uô'], [/ie(?=[cmnptu])/, 'iê'], [/ye(?=[mnptu])/, 'yê']]) if (re.test(base)) push(applyTone(base.replace(re, rep), tone));
  // Lặp chữ cái do gõ nhầm (thôngg, nhaanh).
  if (/(.)\1/.test(base)) push(applyTone(base.replace(/(.)\1+/g, '$1'), tone));
  // Hoán vị hai chữ cạnh nhau (côgn → công).
  for (let i = 0; i < base.length - 1; i++) push(applyTone(base.slice(0, i) + base[i + 1] + base[i] + base.slice(i + 2), tone));
  // Sót kiểu gõ.
  push(telexDecode(word));
  push(vniDecode(word));
  // Thiếu một chữ cuối thường gặp (thôn → thông đã hợp lệ nên không xét; “thôg” → thông).
  if (/g$/.test(base) && !/ng$/.test(base)) push(applyTone(base.replace(/g$/, 'ng'), tone));
  if (/n$/.test(base) && !/[aeiouyâăêôơư]n$/.test(base)) push(applyTone(base + 'g', tone));
  return out.slice(0, 3);
}

/** Từ không cần kiểm tra cấu tạo (viết tắt, từ mượn thông dụng, đơn vị…). */
export const LOANWORDS = new Set(
  `email e-mail internet website web online offline file video audio zalo facebook youtube google wifi app ứng
  ok pin xăng radio tivi taxi karaoke km kg cm mm ml kw kwh vnd usd euro gmail pdf word excel covid
  sars logo blog fax modem server laptop smartphone iphone android usb cd dvd ram rom cpu gps
  marketing online pháp-luật`.split(/\s+/),
);
