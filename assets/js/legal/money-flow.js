// Phân tích dòng tiền từ sơ đồ vụ việc: từng khoản (ai đưa → ai nhận, bao nhiêu, khi nào, mục đích, ai khai, xác nhận mấy
// phía), hồ sơ từng người (đã nhận / đã đưa / số tiền rút), đối chiếu “tiền vào – tiền ra” để chỉ ra khoản chưa rõ đi đâu,
// vai trò theo dòng tiền, và tóm lược bản chất lập TỪ DỮ LIỆU ĐÃ CÓ NGUYÊN VĂN (không sinh nội dung mới).
// Mọi tổng đều do máy cộng — chỉ để đối chiếu, luôn ghi rõ, không phải số liệu trong lời khai.
import { amountsIn } from './terms.js';
import { key } from './text-sim.js';

export const valueOf = (soTien) => amountsIn(soTien || '')[0]?.v || 0;
export const edgeId = (e) => `${key(e.tu)}>${key(e.den)}:${e.loai}:${valueOf(e.soTien)}`;

export const XAC_NHAN = {
  'hai-phia': ['Cả người đưa và người nhận cùng khai', 'ok'],
  'dua-khai': ['Chỉ người đưa khai', 'warn'],
  'nhan-khai': ['Chỉ người nhận khai', 'warn'],
  'ben-thu-ba': ['Người khác / tài liệu nêu — chính hai bên chưa khai', 'warn'],
};
const xacNhanOf = (e) => (e.khai?.dua && e.khai?.nhan ? 'hai-phia' : e.khai?.dua ? 'dua-khai' : e.khai?.nhan ? 'nhan-khai' : 'ben-thu-ba');

export function formatVnd(v) {
  if (!v) return '';
  if (v >= 1e9) return `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} tỷ đồng`;
  if (v >= 1e6) return `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} triệu đồng`;
  return `${v.toLocaleString('vi-VN')} đồng`;
}

const ts = (label) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(label || '') || /^(\d{1,2})\/(\d{4})$/.exec(label || '');
  if (!m) return Number.MAX_SAFE_INTEGER;
  return m.length === 4 ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : Date.UTC(+m[2], +m[1] - 1, 1);
};

/**
 * Phân tích dòng tiền của sơ đồ m.
 * Trả về { flows[], persons: Map, gaps[], tong, soKhoanChuaRoSoTien, vaiTro: Map }.
 */
export function analyzeMoney(m) {
  const flows = (m.edges || [])
    .filter((e) => e.loai === 'tien')
    .map((e) => ({ id: edgeId(e), tu: e.tu, den: e.den, soTien: e.soTien || '', v: valueOf(e.soTien), noiDung: e.noiDung || '', trich: e.trich || '', nguon: e.nguon || [], khai: e.khai || {}, xacNhan: xacNhanOf(e), thoiGian: e.thoiGian || '', mucDich: e.mucDich || '', n: e.n || 1, hoc: !!e.hoc }))
    .sort((a, b) => ts(a.thoiGian) - ts(b.thoiGian) || b.v - a.v);
  const persons = new Map();
  const P = (name) => {
    const k = key(name);
    if (!persons.has(k)) persons.set(k, { ten: name, in: [], out: [], rut: [], nhan: 0, dua: 0, rutTong: 0, khongRoSoTien: 0 });
    return persons.get(k);
  };
  flows.forEach((f) => {
    const a = P(f.tu);
    const b = P(f.den);
    a.out.push(f);
    b.in.push(f);
    a.dua += f.v;
    b.nhan += f.v;
    if (!f.v) {
      a.khongRoSoTien++;
      b.khongRoSoTien++;
    }
  });
  (m.rut || []).forEach((r) => {
    const p = P(r.nguoi);
    p.rut.push(r);
    p.rutTong += r.v;
  });
  // Đối chiếu: tiền đã biết vào tay (nhận + rút) so với tiền đã chuyển đi.
  const gaps = [];
  for (const p of persons.values()) {
    const biet = p.nhan + p.rutTong;
    p.biet = biet;
    p.conLai = biet - p.dua;
    p.vaiTro = p.in.length && p.out.length ? 'trung-gian' : p.out.length || p.rut.length ? 'nguon-tien' : p.in.length ? 'nguoi-nhan-cuoi' : '';
    if (p.dua > 0 && p.conLai > 0 && (p.rutTong > 0 || p.nhan > 0)) gaps.push({ kind: 'chua-di', nguoi: p.ten, v: p.conLai, text: `${p.ten}: đã biết ${formatVnd(biet)} ${p.rutTong ? 'vào tay (rút / lấy' + (p.nhan ? ' và nhận' : '') + ')' : '(đã nhận)'}, mới thấy chuyển đi ${formatVnd(p.dua)} — còn ${formatVnd(p.conLai)} chưa rõ đi đâu` });
    else if (p.rutTong > 0 && !p.dua) gaps.push({ kind: 'chua-di', nguoi: p.ten, v: p.rutTong, text: `${p.ten}: rút / lấy ${formatVnd(p.rutTong)} nhưng chưa thấy khoản nào chuyển đi — chưa rõ tiền đi đâu` });
    if (p.dua > 0 && p.conLai < 0) gaps.push({ kind: 'thieu-nguon', nguoi: p.ten, v: -p.conLai, text: `${p.ten}: chuyển đi ${formatVnd(p.dua)} nhưng chỉ biết nguồn ${formatVnd(biet)} — thiếu nguồn ${formatVnd(-p.conLai)}` });
    if (p.khongRoSoTien) gaps.push({ kind: 'chua-so-tien', nguoi: p.ten, v: 0, text: `${p.ten}: ${p.khongRoSoTien} khoản chưa nêu số tiền` });
  }
  const one = flows.filter((f) => f.xacNhan !== 'hai-phia');
  if (one.length) gaps.push({ kind: 'mot-phia', nguoi: '', v: 0, text: `${one.length}/${flows.length} khoản chưa được cả hai bên xác nhận (nét đứt trên sơ đồ dòng tiền)` });
  return { flows, persons, gaps, tong: flows.reduce((s, f) => s + f.v, 0), vaiTro: new Map([...persons].map(([k, p]) => [k, p.vaiTro])) };
}

/** Hồ sơ một người: chức vụ nguyên văn, vai trò, quan hệ, dòng tiền, hành vi, đối chiếu tiền vào – ra. */
export function personProfile(m, name) {
  const k = key(name);
  const person = (m.people || []).find((p) => key(p.ten) === k) || null;
  const mo = analyzeMoney(m);
  const money = mo.persons.get(k) || null;
  const rel = (m.edges || []).filter((e) => key(e.tu) === k || key(e.den) === k);
  const acts = (m.crimes || []).flatMap((c) => (c.items || []).filter((it) => (it.nguoi || []).some((n) => key(n) === k)).map((it) => ({ ...it, dieu: c.dieu, tenToi: c.ten })));
  return { ten: person?.ten || name, person, money, rel, acts, gaps: mo.gaps.filter((g) => key(g.nguoi) === k) };
}

/**
 * Tóm lược bản chất — ghép từ dữ liệu đã có nguyên văn (điều luật đủ yếu tố, hành vi + người, dòng tiền, chỗ chưa rõ).
 * Trả về [{ nhom, text, nguoi: [tên…] }].
 */
export function essenceOf(m) {
  const out = [];
  const mo = analyzeMoney(m);
  for (const c of m.crimes || []) {
    if (!c.dieu) continue;
    const ppl = [...new Set((c.items || []).flatMap((it) => it.nguoi || []))];
    const it = (c.items || [])[0];
    out.push({ nhom: 'Hành vi, điều luật', text: `Điều ${c.dieu} (${String(c.ten).replace(/^Tội /, '').toLowerCase()}): ${ppl.length ? `${ppl.join(', ')} — ` : ''}${it?.ten || ''}${it?.soTien ? ` (${it.soTien})` : ''}`, nguoi: ppl });
  }
  if (mo.flows.length) {
    out.push({ nhom: 'Dòng tiền', text: `${mo.flows.length} khoản đã xác định: ${mo.flows.slice(0, 4).map((f) => `${f.tu} → ${f.den}${f.soTien ? ` ${f.soTien}` : ''}${f.thoiGian ? ` (${f.thoiGian})` : ''}`).join('; ')}${mo.flows.length > 4 ? '…' : ''}${mo.tong ? `. Tổng các khoản có số tiền: ${formatVnd(mo.tong)} (máy cộng, để đối chiếu)` : ''}`, nguoi: [...new Set(mo.flows.flatMap((f) => [f.tu, f.den]))] });
    const src = [...mo.persons.values()].filter((p) => p.vaiTro === 'nguon-tien').map((p) => p.ten);
    const mid = [...mo.persons.values()].filter((p) => p.vaiTro === 'trung-gian').map((p) => p.ten);
    const fin = [...mo.persons.values()].filter((p) => p.vaiTro === 'nguoi-nhan-cuoi').map((p) => p.ten);
    out.push({ nhom: 'Đường đi của tiền', text: `${src.length ? `Nguồn / người đưa: ${src.join(', ')}. ` : ''}${mid.length ? `Trung gian (vừa nhận vừa chuyển): ${mid.join(', ')}. ` : ''}${fin.length ? `Người nhận cuối: ${fin.join(', ')}.` : ''}`.trim(), nguoi: [...src, ...mid, ...fin] });
  }
  for (const g of mo.gaps.filter((x) => x.kind !== 'mot-phia')) out.push({ nhom: 'Chưa rõ', text: g.text, nguoi: g.nguoi ? [g.nguoi] : [] });
  if (mo.gaps.some((g) => g.kind === 'mot-phia')) out.push({ nhom: 'Chưa rõ', text: mo.gaps.find((g) => g.kind === 'mot-phia').text, nguoi: [] });
  if ((m.unclear || []).length) out.push({ nhom: 'Chưa rõ', text: `${m.unclear.length} tên chưa đủ họ tên nên chưa đưa vào sơ đồ: ${m.unclear.map((u) => u.ten).join(', ')}`, nguoi: [] });
  for (const c of m.canLamRo || []) out.push({ nhom: 'Chưa rõ', text: `Điều ${c.dieu} (${String(c.ten).replace(/^Tội /, '').toLowerCase()}): ${c.canCu}`, nguoi: [] });
  return out;
}

/**
 * Áp một thao tác của điều tra viên lên khoản (edge id): 'dao' (đảo chiều), 'bo' (không phải dòng tiền / quan hệ),
 * 'loai:tien|chi-dao|khac'. Trả về { map, verb, trich, patch } — patch mô tả điều cần “học”.
 */
export function applyFlowAction(m, id, action) {
  const edges = m.edges || [];
  const i = edges.findIndex((e) => edgeId(e) === id);
  if (i < 0) return null;
  const e = edges[i];
  const next = edges.slice();
  let patch = null;
  if (action === 'dao') {
    next[i] = { ...e, tu: e.den, den: e.tu, khai: { dua: !!e.khai?.nhan, nhan: !!e.khai?.dua } };
    patch = { dao: true };
  } else if (action === 'bo') {
    next.splice(i, 1);
  } else if (action.startsWith('loai:')) {
    const loai = action.slice(5);
    next[i] = { ...e, loai };
    patch = { loai };
  } else return null;
  return { map: { ...m, edges: next }, verb: e.noiDung || '', trich: e.trich || '', patch, action };
}
