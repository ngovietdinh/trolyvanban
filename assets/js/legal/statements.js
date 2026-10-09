// Phân tích lời khai: đọc nhiều lời khai cùng lúc (trên máy, tức thì) → sơ đồ vụ việc + đối chiếu ai khai gì về ai
// + danh sách điểm cần làm rõ (mâu thuẫn số tiền, phủ nhận, chỉ một người khai, thiếu số tiền / thời gian / chức vụ,
// người chưa lấy lời khai, câu trả lời mơ hồ). AI chỉ dùng cho từng điểm cần làm rõ, gửi đúng đoạn liên quan.
import { buildCaseMap, sentences, classifyPeople, classifySentence, isFullName, nameVerbatim, stripTitle, key, short } from './case-map.js';
import { withCache } from '../lib/cache-mark.js';
import { rules } from './ai-rules.js';
import { amountsIn } from './analyze.js';
import { extractJson } from '../lib/ai.js';

export const VAGUE_RE = /(không nhớ|không rõ|không biết|không nắm|không chắc|khoảng chừng|khoảng|tầm|hình như|có lẽ|chắc là|nghe nói|nghe đâu|quên|lâu rồi)/i;
export const LEVELS = { cao: 'Cần làm rõ ngay', vua: 'Nên làm rõ', thap: 'Bổ sung' };
export const KINDS = {
  'trai-nguoc': 'Lời khai trái ngược',
  'lech-tien': 'Số tiền khác nhau',
  'phu-nhan': 'Phủ nhận',
  'mot-chieu': 'Chỉ một bên khai',
  'thieu-tien': 'Chưa rõ số tiền',
  'thieu-ngay': 'Chưa rõ thời gian',
  'thieu-chuc-vu': 'Chưa rõ chức vụ',
  'chua-khai': 'Chưa lấy lời khai',
  'chua-ro-ten': 'Tên chưa rõ',
  'thieu-yeu-to': 'Thiếu yếu tố cấu thành',
  'mo-ho': 'Trả lời mơ hồ',
};
const RANK = { cao: 0, vua: 1, thap: 2 };
const VERB = { tien: 'đưa / nhận tiền', 'chi-dao': 'chỉ đạo, yêu cầu', khac: 'quan hệ' };
const idOf = (...xs) => xs.map((x) => key(x).replace(/ /g, '-')).join('_').slice(0, 120);

/**
 * statements: [{ speaker, label?, role?, text }] — mỗi phần tử là lời khai của một người (một lần khai).
 * Trả về { map (sơ đồ vụ việc), speakers, claims, issues }.
 */
export function analyzeStatements(statements = [], { known = [], primary = null, confirmed = [] } = {}) {
  const t0 = Date.now();
  const sources = statements
    .filter((s) => String(s.text || '').trim())
    .map((s, i) => ({ label: s.label || (s.speaker ? `Lời khai của ${s.speaker}` : `Lời khai ${i + 1}`), speaker: String(s.speaker || '').trim(), text: s.text }));
  // confirmed: họ tên đầy đủ do người dùng xác nhận (chỉ những tên này mới được gộp / coi là rõ khi lời khai chỉ nêu tên gọi).
  const knownAll = [...known, ...confirmed.filter(isFullName).map((ten) => ({ ten: stripTitle(ten), vaiTro: '' })), ...statements.filter((s) => s.speaker && s.role).map((s) => ({ ten: s.speaker, vaiTro: s.role }))];
  const map = buildCaseMap({ sources, known: knownAll, primary });
  const sents = sentences(sources);
  const all = classifyPeople(sents, knownAll);
  const people = all.filter((p) => p.clear);
  const spKeys = new Set(sources.filter((s) => s.speaker).map((s) => key(s.speaker)));
  const isSpeaker = (p) => p && (spKeys.has(p.key) || [...spKeys].some((k) => k.endsWith(` ${p.key}`) || p.key.endsWith(` ${k}`)));

  // Ai khai gì về ai (mỗi câu có ≥ 1 người và có động từ quan hệ; câu phủ nhận giữ lại để đối chiếu).
  const claims = [];
  const vague = [];
  for (const s of sents) {
    const c = classifySentence(s, all);
    if (VAGUE_RE.test(s.t) && s.speaker) vague.push(s);
    if (!c.type || !c.actors.length) continue;
    if (c.actors.length < 2 && !c.deny) continue;
    // Một đầu là người chưa rõ tên → không ghi nhận (điểm “Tên chưa rõ” nêu riêng).
    if (!c.deny && !c.ok) continue;
    claims.push({ speaker: s.speaker, src: s.src, t: s.t, type: c.type, deny: c.deny, tu: c.ok ? c.from.ten : '', den: c.ok ? c.to.ten : '', who: c.actors.map((p) => p.ten), soTien: c.money?.raw || '', v: c.money?.v || 0, date: c.date?.label || '' });
  }
  const pair = (c) => [key(c.tu), key(c.den)].sort().join('|');
  const ex = (c) => ({ speaker: c.speaker || c.src, t: short(c.t, 260) });
  const issues = [];
  const add = (x) => !issues.some((y) => y.id === x.id) && issues.push(x);

  // 1. Phủ nhận: đối chiếu với lời khai người khác về cùng cặp người (cùng loại quan hệ).
  for (const d of claims.filter((c) => c.deny)) {
    const other = claims.filter((c) => !c.deny && c.speaker !== d.speaker && c.type === d.type && (d.who.length >= 2 ? pair(c) === pair(d) : c.who.some((w) => d.who.some((x) => key(x) === key(w)))));
    const who = [...new Set([...d.who, ...other.flatMap((c) => [c.tu, c.den])])].filter(Boolean);
    if (other.length) {
      add({
        id: idOf('trai-nguoc', d.speaker, ...who.slice(0, 2), d.type),
        kind: 'trai-nguoc',
        level: 'cao',
        title: `${d.speaker || 'Người khai'} phủ nhận, nhưng ${[...new Set(other.map((c) => c.speaker || c.src))].join(', ')} khai có ${VERB[d.type]}`,
        detail: 'Hai lời khai trái ngược nhau về cùng một sự việc — cần đối chất hoặc tìm chứng cứ khách quan (sao kê, chứng từ, người chứng kiến).',
        excerpts: [ex(d), ...other.slice(0, 3).map(ex)],
        people: who,
        ask: [`${other[0].speaker || 'Người khác'} khai: “${short(other[0].t, 160)}”. Đề nghị ${d.speaker || 'người khai'} trình bày ý kiến, giải thích vì sao lời khai khác nhau?`, `Có tài liệu, người chứng kiến nào chứng minh việc ${VERB[d.type]} giữa ${who.slice(0, 2).join(' và ')} không?`],
      });
    } else {
      add({
        id: idOf('phu-nhan', d.speaker, d.t.slice(0, 40)),
        kind: 'phu-nhan',
        level: 'vua',
        title: `${d.speaker || 'Người khai'} phủ nhận ${VERB[d.type]}${d.who.length >= 2 ? ` với ${d.who.filter((w) => key(w) !== key(d.speaker)).join(', ')}` : ''}`,
        detail: 'Lời phủ nhận chưa được lời khai khác xác nhận hay bác bỏ — cần xác minh thêm.',
        excerpts: [ex(d)],
        people: d.who,
        ask: [`Căn cứ nào để ${d.speaker || 'người khai'} khẳng định không ${VERB[d.type]}?`],
      });
    }
  }

  // 2. Số tiền khác nhau cho cùng một cặp người.
  const money = claims.filter((c) => !c.deny && c.type === 'tien' && c.v && c.tu && c.den);
  const byPair = new Map();
  money.forEach((c) => byPair.set(pair(c), [...(byPair.get(pair(c)) || []), c]));
  for (const list of byPair.values()) {
    const vals = [...new Set(list.map((c) => c.v))];
    if (vals.length < 2) continue;
    const sp = [...new Set(list.map((c) => c.speaker || c.src))];
    add({
      id: idOf('lech-tien', list[0].tu, list[0].den),
      kind: 'lech-tien',
      level: sp.length > 1 ? 'cao' : 'vua',
      title: `${list[0].tu} → ${list[0].den}: ${[...new Map(list.map((c) => [c.v, c.soTien])).values()].join(' / ')}`,
      detail: sp.length > 1 ? `Các lời khai (${sp.join(', ')}) nêu số tiền khác nhau — là nhiều lần đưa khác nhau hay mâu thuẫn?` : `${sp[0]} nêu nhiều số tiền khác nhau — làm rõ là nhiều lần hay một lần.`,
      excerpts: list.slice(0, 4).map(ex),
      people: [list[0].tu, list[0].den],
      ask: [`Giữa ${list[0].tu} và ${list[0].den} có bao nhiêu lần giao nhận tiền? Mỗi lần vào thời gian nào, số tiền cụ thể bao nhiêu, ở đâu, ai chứng kiến?`],
    });
  }

  // 3. Chỉ một bên khai: người còn lại có lời khai nhưng không nhắc tới việc này.
  for (const e of map.edges.filter((x) => x.loai !== 'khac')) {
    const pe = (n) => people.find((p) => key(p.ten) === key(n));
    const sup = claims.filter((c) => !c.deny && pair(c) === pair(e));
    const sayers = new Set(sup.map((c) => key(c.speaker)));
    for (const side of [e.tu, e.den]) {
      const p = pe(side);
      if (!p || !isSpeaker(p) || [...sayers].some((k) => k && (k === p.key || k.endsWith(` ${p.key}`) || p.key.endsWith(` ${k}`)))) continue;
      if (claims.some((c) => c.deny && key(c.speaker) === p.key)) continue;
      add({
        id: idOf('mot-chieu', side, e.tu, e.den, e.loai),
        kind: 'mot-chieu',
        level: 'vua',
        title: `${side} chưa khai về việc ${e.tu} ${e.noiDung || VERB[e.loai]} ${e.den}${e.soTien ? ` (${e.soTien})` : ''}`,
        detail: `Chỉ có lời khai của ${[...new Set(sup.map((c) => c.speaker || c.src))].join(', ') || 'người khác'}; ${side} đã khai nhưng không nhắc tới — cần hỏi lại để xác nhận hoặc bác bỏ.`,
        excerpts: sup.slice(0, 2).map(ex),
        people: [e.tu, e.den],
        ask: [`${side} có ${e.loai === 'tien' ? (key(side) === key(e.tu) ? 'đưa' : 'nhận') : key(side) === key(e.tu) ? 'chỉ đạo, yêu cầu' : 'nhận chỉ đạo, yêu cầu'}${e.soTien ? ` ${e.soTien}` : ''} ${key(side) === key(e.tu) ? `cho ${e.den}` : `từ ${e.tu}`} không? Thời gian, địa điểm, mục đích?`],
      });
    }
  }

  // 4. Dòng tiền thiếu số tiền / thời gian.
  for (const e of map.edges.filter((x) => x.loai === 'tien')) {
    const sup = claims.filter((c) => !c.deny && c.type === 'tien' && pair(c) === pair(e));
    if (!e.soTien && !sup.some((c) => c.v))
      add({ id: idOf('thieu-tien', e.tu, e.den), kind: 'thieu-tien', level: 'vua', title: `${e.tu} → ${e.den}: chưa có số tiền`, detail: 'Lời khai nêu việc đưa / nhận tiền nhưng không nêu số tiền.', excerpts: sup.slice(0, 2).map(ex), people: [e.tu, e.den], ask: [`Số tiền ${e.tu} đưa cho ${e.den} là bao nhiêu? Tiền mặt hay chuyển khoản? Nguồn tiền từ đâu?`] });
    if (!sup.some((c) => c.date))
      add({ id: idOf('thieu-ngay', e.tu, e.den), kind: 'thieu-ngay', level: 'thap', title: `${e.tu} → ${e.den}${e.soTien ? ` (${e.soTien})` : ''}: chưa rõ thời gian`, detail: 'Chưa có ngày, tháng giao nhận tiền trong lời khai.', excerpts: sup.slice(0, 1).map(ex), people: [e.tu, e.den], ask: [`Việc giao nhận tiền giữa ${e.tu} và ${e.den} diễn ra vào ngày, tháng, năm nào? Ở đâu?`] });
  }

  // 5. Người có vai trò trong quan hệ nhưng chưa có chức vụ nguyên văn / chưa lấy lời khai.
  const inEdges = map.people.filter((p) => map.edges.some((e) => key(e.tu) === key(p.ten) || key(e.den) === key(p.ten)));
  for (const p of inEdges) {
    const pp = people.find((x) => key(x.ten) === key(p.ten));
    if (!p.vaiTro) add({ id: idOf('thieu-chuc-vu', p.ten), kind: 'thieu-chuc-vu', level: 'thap', title: `${p.ten}: chưa có chức vụ trong lời khai`, detail: 'Chức vụ chỉ ghi khi có nguyên văn — cần hỏi rõ để xác định tư cách, trách nhiệm.', excerpts: [], people: [p.ten], ask: [`${p.ten} giữ chức vụ gì, ở đơn vị nào, được giao nhiệm vụ gì tại thời điểm xảy ra sự việc?`] });
    if (spKeys.size && !isSpeaker(pp || { key: key(p.ten) }))
      add({ id: idOf('chua-khai', p.ten), kind: 'chua-khai', level: 'vua', title: `Chưa có lời khai của ${p.ten}`, detail: `${p.ten} có trong ${map.edges.filter((e) => key(e.tu) === key(p.ten) || key(e.den) === key(p.ten)).length} quan hệ trên sơ đồ nhưng chưa có lời khai — cần triệu tập lấy lời khai để đối chiếu.`, excerpts: claims.filter((c) => c.who.some((w) => key(w) === key(p.ten))).slice(0, 2).map(ex), people: [p.ten], ask: [`Triệu tập ${p.ten} làm rõ: quan hệ với ${[...new Set(map.edges.filter((e) => key(e.tu) === key(p.ten) || key(e.den) === key(p.ten)).map((e) => (key(e.tu) === key(p.ten) ? e.den : e.tu)))].join(', ')}; các khoản tiền, chỉ đạo liên quan.`] });
  }

  // 6. Trả lời mơ hồ (không nhớ, khoảng, hình như…) theo từng người khai.
  const vBy = new Map();
  vague.forEach((s) => vBy.set(s.speaker, [...(vBy.get(s.speaker) || []), s]));
  for (const [sp, list] of vBy) add({ id: idOf('mo-ho', sp), kind: 'mo-ho', level: list.length >= 3 ? 'vua' : 'thap', title: `${sp}: ${list.length} câu trả lời mơ hồ`, detail: 'Câu trả lời “không nhớ”, “khoảng”, “hình như”… — cần hỏi lại cụ thể hoặc dùng tài liệu gợi nhớ.', excerpts: list.slice(0, 4).map((s) => ({ speaker: sp, t: short(s.t, 220) })), people: [sp], ask: [`Đề nghị ${sp} trình bày cụ thể (thời gian, số tiền, người có mặt) thay cho các câu “không nhớ / khoảng / hình như”; có tài liệu, sổ sách nào giúp xác định không?`] });

  // 6b. Điều luật đã được nhận diện nhưng còn thiếu yếu tố cấu thành (không bắt buộc) → cần hỏi thêm để chứng minh.
  for (const c of [...(map.crimes || []), ...(map.canLamRo || [])]) {
    const th = [...(c.can?.thieu || [])].sort((a, b) => Number(!!b.req) - Number(!!a.req));
    if (!c.dieu || !th.length || c.can?.nguon !== 'bo-nhan-dien') continue;
    const near = c.can.muc === 'gan';
    const name = c.ten.replace(/^Tội /, '').toLowerCase();
    add({
      id: idOf('thieu-yeu-to', c.dieu),
      kind: 'thieu-yeu-to',
      level: near ? 'cao' : 'vua',
      title: `Điều ${c.dieu} (${name}): chưa rõ ${th.map((y) => y.label.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase()).join('; ')}`,
      detail: near ? 'Lời khai gần đủ yếu tố của điều này nhưng còn thiếu yếu tố BẮT BUỘC — chưa thể kết luận, chưa đưa vào sơ đồ; cần hỏi thêm.' : 'Lời khai đã đủ yếu tố bắt buộc của điều này nhưng còn thiếu các yếu tố sau — cần hỏi thêm để chứng minh đầy đủ cấu thành.',
      excerpts: c.can.yeuTo.filter((y) => y.ok && y.quote).slice(0, 3).map((y) => ({ speaker: y.label.replace(/\s*\([^)]*\)\s*$/, ''), t: short(y.quote, 220) })),
      people: [],
      askWho: `Làm rõ cấu thành Điều ${c.dieu}`,
      ask: th.map((y) => y.hoi).filter(Boolean),
    });
  }

  // 7. Tên chưa rõ: không đưa vào sơ đồ cho tới khi có họ tên đầy đủ nguyên văn.
  for (const u of map.unclear || []) {
    add({
      id: idOf('chua-ro-ten', u.ten),
      kind: 'chua-ro-ten',
      level: 'cao',
      title: `Tên chưa rõ: “${u.ten}”`,
      detail: `${u.lyDo}. Chưa đưa vào sơ đồ cho tới khi có họ tên đầy đủ.`,
      excerpts: (u.cau || []).slice(0, 3).map((t) => ({ speaker: (u.nguoiKhai || [])[0] || 'Lời khai', t })),
      people: [],
      rawName: u.ten,
      askWho: (u.nguoiKhai || [])[0] || '',
      ask: [`Đề nghị nói rõ họ tên đầy đủ (họ, tên đệm, tên) của người được gọi là “${u.ten}”; năm sinh, nơi cư trú, chức vụ, quan hệ với các bên?`],
    });
  }

  issues.sort((a, b) => RANK[a.level] - RANK[b.level]);

  // Người khai: nhắc tới ai, khai có / phủ nhận bao nhiêu việc.
  const speakers = sources
    .filter((s) => s.speaker)
    .map((s) => {
      const mine = claims.filter((c) => c.speaker === s.speaker);
      const mentions = new Map();
      mine.forEach((c) => c.who.forEach((w) => key(w) !== key(s.speaker) && mentions.set(w, (mentions.get(w) || 0) + 1)));
      return { ten: s.speaker, ro: isFullName(s.speaker), label: s.label, khai: mine.filter((c) => !c.deny).length, phuNhan: mine.filter((c) => c.deny).length, moHo: vague.filter((x) => x.speaker === s.speaker).length, nhacToi: [...mentions].sort((a, b) => b[1] - a[1]).map(([ten, n]) => ({ ten, n })), claims: mine };
    });
  return { map, speakers, claims, issues, ms: Date.now() - t0 };
}

/* ---------------- AI làm rõ từng điểm (chỉ gửi đoạn liên quan) ---------------- */

export const CLARIFY_SYSTEM = `Bạn là điều tra viên cao cấp, giỏi đối chiếu lời khai. Chỉ làm rõ điểm được hỏi, dựa trên các đoạn lời khai được cung cấp.\nQUY TẮC (bắt buộc):\n${rules('nguon', 'nguyenVan', 'trung', 'tien', 'gon')}`;

/** Câu trong lời khai nhắc tới những người của điểm cần làm rõ (gửi kèm cho AI, không gửi toàn bộ). */
export function contextFor(issue, statements, max = 3500) {
  const names = (issue.people || []).map(key).filter(Boolean);
  const short2 = names.map((n) => n.split(' ').slice(-2).join(' '));
  const out = [];
  let len = 0;
  for (const s of statements) {
    const sp = String(s.speaker || '').trim();
    const mine = names.some((n) => key(sp) === n || key(sp).endsWith(` ${n}`) || n.endsWith(` ${key(sp)}`));
    const parts = String(s.text || '').split(/(?<=[.!?;])\s+|\n+/).filter((t) => t.trim().length > 8);
    for (const t of parts) {
      const k = key(t);
      if (!(mine && /(^| )tôi( |$)/.test(k)) && !short2.some((n) => n && k.includes(n))) continue;
      const line = `[${sp || 'Tài liệu'}] ${t.trim()}`;
      if (len + line.length > max) return out.join('\n');
      out.push(line);
      len += line.length + 1;
    }
  }
  return out.join('\n');
}

/** Gộp nhiều điểm cần làm rõ vào một lần gọi AI (phần hướng dẫn cố định → đọc lại từ cache). */
export function clarifyPrompt(issues, statements, { max = 3500, primary = null } = {}) {
  const stable = `${primary ? `Điều luật đang xem xét: Điều ${primary} BLHS.\n` : ''}Nhiệm vụ: với mỗi ĐIỂM CẦN LÀM RÕ (máy đã phát hiện khi đối chiếu các lời khai), đọc các ĐOẠN LỜI KHAI LIÊN QUAN và trả lời:
- nhanDinh: 1–3 câu nhận định (mâu thuẫn ở đâu, lời khai nào có cơ sở hơn, còn thiếu gì) — chỉ dựa trên đoạn được cung cấp;
- cauHoi: 2–5 câu hỏi cụ thể để lấy lời khai bổ sung / đối chất, ghi rõ hỏi ai;
- xacMinh: 1–3 biện pháp xác minh (sao kê, chứng từ, người chứng kiến, camera…);
- quanHe: quan hệ / dòng tiền CÓ NGUYÊN VĂN trong đoạn lời khai mà sơ đồ còn thiếu (không có thì để mảng rỗng), số tiền và trích dẫn chép nguyên văn; tu / den là HỌ TÊN ĐẦY ĐỦ chép nguyên văn — người chỉ có tên gọi (“ông An”) mà đoạn lời khai chưa có họ tên đầy đủ thì không đưa vào.
Chỉ trả về JSON: {"ketQua":[{"id":"…","nhanDinh":"…","cauHoi":[{"hoi":"…","ai":"người được hỏi"}],"xacMinh":["…"],"quanHe":[{"tu":"…","den":"…","loai":"tien|chi-dao|khac","noiDung":"…","soTien":"…","trich":"…"}]}]}
`;
  const body = issues
    .map((x, i) => `### ĐIỂM ${i + 1} (id: ${x.id}) — ${KINDS[x.kind]}: ${x.title}\n${x.detail}\n${x.excerpts.length ? `Trích: ${x.excerpts.map((e) => `[${e.speaker}] ${e.t}`).join(' | ')}\n` : ''}ĐOẠN LỜI KHAI LIÊN QUAN:\n"""\n${contextFor(x, statements, Math.max(800, Math.round(max / issues.length)))}\n"""`)
    .join('\n\n');
  return withCache(stable, `\n${body}`);
}

/** Đọc kết quả AI; quan hệ AI nêu chỉ giữ khi trích dẫn có nguyên văn trong lời khai, số tiền khớp nguyên văn. */
export function parseClarify(raw, issues, source = '', allow = []) {
  const j = typeof raw === 'string' ? extractJson(raw) : raw;
  const list = Array.isArray(j?.ketQua) ? j.ketQua : Array.isArray(j) ? j : j && issues.length === 1 ? [{ ...j, id: issues[0].id }] : null;
  if (!list) throw new Error('AI trả về kết quả không đúng định dạng');
  const src = key(source);
  const amounts = source ? [...String(source).matchAll(/(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(nghìn|ngàn|triệu|tỷ|tỉ)?\s*(?:đồng|VNĐ|VND|đ\b)?/giu)].map((m) => m[0].trim()) : [];
  let dropped = 0;
  const allowK = new Set(allow.map(key));
  const out = {};
  list.forEach((r, i) => {
    const id = issues.some((x) => x.id === r?.id) ? r.id : issues[i]?.id;
    if (!id || !r) return;
    const quanHe = (r.quanHe || []).filter((e) => {
      if (!e?.tu || !e?.den) return false;
      // Tên phải là họ tên đầy đủ có nguyên văn trong lời khai (hoặc đã rõ trên sơ đồ); không thì không đưa lên sơ đồ.
      if (!nameVerbatim(e.tu, source, allowK) || !nameVerbatim(e.den, source, allowK)) return !!dropped++ && false;
      e.tu = stripTitle(e.tu);
      e.den = stripTitle(e.den);
      // Số tiền phải nằm trong chính câu trích dẫn của khoản đó.
      const v = e.soTien ? amountsIn(e.soTien)[0]?.v : 0;
      if (v && !amountsIn(e.trich || '').some((a) => a.v === v)) e.soTien = '';
      const ok = !source || (e.trich && src.includes(key(e.trich).slice(0, 80)));
      if (!ok) dropped++;
      if (ok && e.soTien && source && !amounts.some((a) => key(a) === key(e.soTien))) e.soTien = '';
      return ok;
    });
    out[id] = {
      nhanDinh: String(r.nhanDinh || '').trim().slice(0, 900),
      cauHoi: (r.cauHoi || []).map((q) => (typeof q === 'string' ? { hoi: q, ai: '' } : { hoi: String(q?.hoi || '').trim(), ai: String(q?.ai || '').trim() })).filter((q) => q.hoi).slice(0, 6),
      xacMinh: (r.xacMinh || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 4),
      quanHe: quanHe.map((e) => ({ tu: e.tu, den: e.den, loai: ['tien', 'chi-dao'].includes(e.loai) ? e.loai : 'khac', noiDung: e.noiDung || '', soTien: e.soTien || '', trich: short(e.trich || '', 220), src: 'AI làm rõ', n: 1 })),
      at: Date.now(),
    };
  });
  return { answers: out, dropped };
}

/** Thêm quan hệ AI tìm thêm (đã kiểm nguyên văn) vào sơ đồ. */
export function withExtraEdges(map, extra = []) {
  if (!extra.length) return map;
  const ek = (e) => `${key(e.tu)}|${key(e.den)}|${e.loai}|${amountsIn(e.soTien || '')[0]?.v || 0}`;
  const have = new Set(map.edges.map(ek));
  const edges = [...map.edges, ...extra.filter((e) => !have.has(ek(e)) && have.add(ek(e)))];
  const people = [...map.people];
  edges.forEach((e) => [e.tu, e.den].forEach((t) => !people.some((p) => key(p.ten) === key(t)) && people.push({ ten: t, vaiTro: '', suyRa: '', mentions: 1 })));
  return { ...map, edges, people };
}

/** Câu hỏi làm rõ theo người được hỏi (từ máy + AI), để đưa vào lần lấy lời khai tiếp theo. */
export function questionsByPerson(issues, answers = {}, done = {}) {
  const by = new Map();
  const put = (who, q) => {
    const k = who || 'Chưa xác định người được hỏi';
    if (!by.has(k)) by.set(k, []);
    if (!by.get(k).some((x) => key(x) === key(q))) by.get(k).push(q);
  };
  for (const x of issues) {
    if (done[x.id]) continue;
    const a = answers[x.id];
    if (a?.cauHoi?.length) a.cauHoi.forEach((q) => put(q.ai, q.hoi));
    else x.ask.forEach((q) => put(x.askWho || (x.kind === 'chua-khai' || x.kind === 'thieu-chuc-vu' || x.kind === 'mo-ho' ? x.people[0] : x.excerpts[0]?.speaker && x.kind === 'trai-nguoc' ? x.excerpts[0].speaker : x.people[0]), q));
  }
  return [...by].map(([ai, list]) => ({ ai, list }));
}

/**
 * Tách một văn bản có nhiều lời khai theo tiêu đề: “Lời khai của Nguyễn Văn An”, “Biên bản ghi lời khai của …”,
 * “Người khai: …”, “[Lời khai của …]”. Không có tiêu đề nào → trả về mảng rỗng.
 */
export function splitByHeading(text) {
  const re = /^\s*\[?\s*(?:biên bản\s+)?(?:ghi\s+)?(?:lời khai|bản tự khai|tự khai)\s+(?:của\s+)?(?:ông|bà|anh|chị)?\s*([A-ZÀ-Ỹ][^\n:\]–—(]{1,60}?)\s*(?:\(([^)\n]{1,60})\))?\s*[\]:–—-]*\s*$|^\s*người khai\s*:\s*([^\n]{2,60})$/gimu;
  const marks = [];
  let m;
  while ((m = re.exec(String(text || '')))) marks.push({ at: m.index, end: m.index + m[0].length, speaker: String(m[1] || m[3] || '').replace(/\s*[-–,].*$/, '').trim(), role: String(m[2] || '').trim() });
  if (!marks.length) return [];
  return marks.map((x, i) => ({ speaker: x.speaker, role: x.role, text: String(text).slice(x.end, marks[i + 1]?.at ?? undefined).trim() })).filter((x) => x.text);
}
