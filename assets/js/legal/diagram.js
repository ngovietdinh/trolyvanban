// Sơ đồ logic tùy chỉnh: dữ liệu + bố cục + xuất SVG (không phụ thuộc DOM — dùng chung cho màn hình sửa sơ đồ và kiểm thử).
//
// diagram = {
//   v: 1,
//   nodes: [{ id, kind: 'crime'|'act'|'person'|'money'|'box'|'note', label, sub, x, y, color?, origin: 'auto'|'user', edited? }],
//   edges: [{ id, from, to, label, kind: 'tien'|'chi-dao'|'khac'|'thuoc', origin, edited? }],
//   strokes: [{ id, color, width, points: [[x, y], …] }],
// }
// x, y là TÂM của nút. Nút sinh từ sơ đồ vụ việc có id ổn định (theo điều luật / tên người / tên hành vi) để khi
// dựng lại sau khi AI làm tiếp vẫn giữ vị trí, nhãn đã sửa, nút – mũi tên – nét vẽ người dùng tự thêm.

export const NODE_KINDS = {
  crime: { label: 'Điều luật', fill: '#fde8e4', stroke: '#c2410c' },
  act: { label: 'Hành vi', fill: '#e7eefc', stroke: '#2f5bd3' },
  person: { label: 'Người', fill: '#e6f4ea', stroke: '#1f8a4c' },
  money: { label: 'Tiền, tài sản', fill: '#fff4d6', stroke: '#b7791f' },
  box: { label: 'Khối nội dung', fill: '#f1f1f4', stroke: '#6b6b78' },
  note: { label: 'Ghi chú', fill: '#fff9c4', stroke: '#c9a227' },
};
export const EDGE_KINDS = {
  tien: { label: 'Tiền, tài sản', color: '#b7791f' },
  'chi-dao': { label: 'Chỉ đạo, yêu cầu', color: '#c0392b' },
  khac: { label: 'Quan hệ khác', color: '#5b6474' },
  thuoc: { label: 'Thuộc / liên quan', color: '#8a8f99', dash: true },
};
export const PEN_COLORS = ['#c0392b', '#2f5bd3', '#1f8a4c', '#b7791f', '#111111'];

const key = (s) => String(s || '').normalize('NFC').toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
let seq = 0;
export const newId = (p = 'n') => `${p}${Date.now().toString(36)}${(++seq).toString(36)}`;

export const emptyDiagram = () => ({ v: 1, nodes: [], edges: [], strokes: [] });

/* ---------------- Kích thước nút ---------------- */

/** Ngắt dòng theo số ký tự (giữ nguyên từ). */
export function wrap(text, n = 24, max = 4) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if (`${cur} ${w}`.length <= n) cur += ` ${w}`;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > max) {
    lines.length = max;
    const last = lines[max - 1];
    lines[max - 1] = `${last.length < n ? last : last.replace(/\s*\S*$/, '')}…`;
  }
  return lines.length ? lines : [''];
}

export function nodeSize(n) {
  const per = n.kind === 'note' ? 26 : 24;
  const lines = wrap(n.label, per, n.kind === 'note' ? 8 : 4);
  const sub = n.sub ? wrap(n.sub, per + 6, 2) : [];
  const longest = Math.max(...lines.map((l) => l.length), ...sub.map((l) => l.length * 0.85), 6);
  const w = Math.round(Math.min(250, Math.max(n.kind === 'note' ? 150 : 120, longest * 7.4 + 30)));
  const h = Math.round(18 + lines.length * 17 + sub.length * 14 + (sub.length ? 4 : 0));
  return { w, h: Math.max(h, 40), lines, sub };
}

/** Điểm trên cạnh khung nút theo hướng tới (tx, ty). */
export function borderPoint(n, tx, ty) {
  const { w, h } = nodeSize(n);
  const dx = tx - n.x;
  const dy = ty - n.y;
  if (!dx && !dy) return [n.x, n.y];
  const sx = Math.abs(dx) / (w / 2 + 4);
  const sy = Math.abs(dy) / (h / 2 + 4);
  const s = Math.max(sx, sy) || 1;
  return [n.x + dx / s, n.y + dy / s];
}

/* ---------------- Dựng từ sơ đồ vụ việc ---------------- */

/** Sơ đồ vụ việc (buildCaseMap / AI) → nút và mũi tên tự sinh. */
export function autoFromCaseMap(m) {
  const nodes = [];
  const edges = [];
  const byId = new Map();
  const add = (n) => {
    if (byId.has(n.id)) return byId.get(n.id);
    const x = { ...n, origin: 'auto', x: 0, y: 0 };
    byId.set(n.id, x);
    nodes.push(x);
    return x;
  };
  const edge = (from, to, label, kind) => {
    const id = `e:${from}>${to}:${key(label).slice(0, 40)}:${kind}`;
    if (from === to || edges.some((e) => e.id === id)) return;
    edges.push({ id, from, to, label, kind, origin: 'auto' });
  };
  const personId = (t) => `p:${key(t)}`;
  for (const p of m.people || []) add({ id: personId(p.ten), kind: 'person', label: p.ten, sub: p.vaiTro || '' });
  for (const c of m.crimes || []) {
    const cid = `c:${c.dieu || 'khac'}`;
    add({ id: cid, kind: 'crime', label: c.dieu ? `Điều ${c.dieu}` : 'Chưa xác định điều luật', sub: String(c.ten || '').replace(/^Tội /, '') });
    for (const it of c.items || []) {
      const aid = `a:${c.dieu || 'khac'}:${key(it.ten).slice(0, 80)}`;
      add({ id: aid, kind: 'act', label: it.ten, sub: it.soTien || '' });
      edge(cid, aid, '', 'thuoc');
      for (const who of it.nguoi || []) {
        if (!who) continue;
        add({ id: personId(who), kind: 'person', label: who, sub: '' });
        edge(personId(who), aid, 'thực hiện', 'khac');
      }
    }
  }
  for (const e of m.edges || []) {
    if (!e.tu || !e.den) continue;
    add({ id: personId(e.tu), kind: 'person', label: e.tu, sub: '' });
    add({ id: personId(e.den), kind: 'person', label: e.den, sub: '' });
    edge(personId(e.tu), personId(e.den), `${e.noiDung || ''}${e.soTien ? ` ${e.soTien}` : ''}`.trim(), ['tien', 'chi-dao'].includes(e.loai) ? e.loai : 'khac');
  }
  return { nodes, edges };
}

/** Sơ đồ mới từ sơ đồ vụ việc (đã sắp xếp). */
export function diagramFromCaseMap(m) {
  return autoLayout({ ...emptyDiagram(), ...autoFromCaseMap(m) });
}

/**
 * Dựng lại phần tự sinh từ sơ đồ vụ việc mới (vd sau khi AI làm tiếp), giữ:
 * vị trí các nút cũ, nhãn đã sửa tay, nút / mũi tên / nét vẽ người dùng tự thêm. Nút tự sinh không còn thì bỏ
 * (kèm mũi tên nối tới nó). Nút mới được đặt theo bố cục tự động quanh các nút cũ.
 */
export function syncFromCaseMap(d, m) {
  const auto = autoFromCaseMap(m);
  const old = new Map(d.nodes.map((n) => [n.id, n]));
  const keepUser = d.nodes.filter((n) => n.origin !== 'auto');
  const nodes = auto.nodes.map((n) => {
    const o = old.get(n.id);
    if (!o) return { ...n, fresh: true };
    return { ...n, x: o.x, y: o.y, color: o.color, ...(o.edited ? { label: o.label, sub: o.sub, kind: o.kind, edited: true } : {}) };
  });
  const all = [...nodes, ...keepUser];
  const ids = new Set(all.map((n) => n.id));
  const oldEdges = new Map(d.edges.map((e) => [e.id, e]));
  const edges = [
    ...auto.edges.map((e) => (oldEdges.get(e.id)?.edited ? { ...oldEdges.get(e.id) } : e)),
    ...d.edges.filter((e) => e.origin !== 'auto'),
  ].filter((e) => ids.has(e.from) && ids.has(e.to));
  const out = { ...d, nodes: all, edges };
  if (nodes.some((n) => n.fresh)) {
    if (nodes.every((n) => n.fresh) && !keepUser.length) autoLayout(out);
    else placeFresh(out);
  }
  out.nodes.forEach((n) => delete n.fresh);
  return out;
}

/* ---------------- Bố cục ---------------- */

const RANK = { crime: 0, act: 1, money: 1, person: 2, box: 3, note: 3 };

/** Bố cục theo tầng: Điều luật → Hành vi → Người → khối khác; thứ tự trong tầng theo trọng tâm các nút nối tới. */
export function autoLayout(d, { gapX = 50, gapY = 120 } = {}) {
  const rows = [[], [], [], []];
  d.nodes.forEach((n) => rows[RANK[n.kind] ?? 3].push(n));
  const nb = new Map(d.nodes.map((n) => [n.id, []]));
  d.edges.forEach((e) => {
    nb.get(e.from)?.push(e.to);
    nb.get(e.to)?.push(e.from);
  });
  const pos = new Map();
  let y = 60;
  rows.forEach((row) => {
    if (!row.length) return;
    // Sắp theo trọng tâm các nút đã đặt ở tầng trên.
    row.forEach((n, i) => {
      const xs = nb.get(n.id).map((id) => pos.get(id)).filter((v) => v !== undefined);
      n._o = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 1e6 + i;
    });
    row.sort((a, b) => a._o - b._o);
    const sizes = row.map((n) => nodeSize(n));
    // Tầng có mũi tên nối ngang (vd giữa các người): giãn rộng để đủ chỗ ghi nhãn mũi tên.
    const ids = new Set(row.map((n) => n.id));
    const gx = d.edges.some((e) => ids.has(e.from) && ids.has(e.to)) ? Math.max(gapX, 150) : gapX;
    const total = sizes.reduce((s, z) => s + z.w, 0) + gx * (row.length - 1);
    let x = Math.max(60, 600 - total / 2);
    const rowH = Math.max(...sizes.map((z) => z.h));
    row.forEach((n, i) => {
      n.x = Math.round(x + sizes[i].w / 2);
      n.y = Math.round(y + rowH / 2);
      pos.set(n.id, n.x);
      x += sizes[i].w + gx;
      delete n._o;
    });
    y += rowH + gapY;
  });
  return d;
}

/** Đặt các nút mới (fresh) cạnh nút đã có cùng loại, không chồng lên nút khác. */
function placeFresh(d) {
  const placed = d.nodes.filter((n) => !n.fresh);
  for (const n of d.nodes.filter((x) => x.fresh)) {
    const same = placed.filter((p) => (RANK[p.kind] ?? 3) === (RANK[n.kind] ?? 3));
    const ref = same.length ? same : placed;
    const z = nodeSize(n);
    let x = ref.length ? Math.max(...ref.map((p) => p.x + nodeSize(p).w / 2)) + 40 + z.w / 2 : 200;
    const y = same.length ? same[0].y : ref.length ? Math.max(...ref.map((p) => p.y)) + 140 : 100;
    while (placed.some((p) => Math.abs(p.x - x) < (nodeSize(p).w + z.w) / 2 + 10 && Math.abs(p.y - y) < (nodeSize(p).h + z.h) / 2 + 10)) x += 60;
    n.x = Math.round(x);
    n.y = Math.round(y);
    placed.push(n);
  }
}

/** Khung bao toàn sơ đồ (nút + nét vẽ). */
export function bounds(d, pad = 40) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const n of d.nodes) {
    const { w, h } = nodeSize(n);
    x0 = Math.min(x0, n.x - w / 2);
    y0 = Math.min(y0, n.y - h / 2);
    x1 = Math.max(x1, n.x + w / 2);
    y1 = Math.max(y1, n.y + h / 2);
  }
  for (const s of d.strokes) for (const [x, y] of s.points) ((x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y)));
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 1000, h: 600 };
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

/* ---------------- Nét vẽ ---------------- */

/** Rút gọn điểm của nét vẽ (bỏ điểm quá gần nhau). */
export function simplify(points, min = 2.5) {
  const out = [];
  for (const p of points) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) >= min) out.push([Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
  }
  if (points.length && out[out.length - 1] !== points[points.length - 1] && out.length > 1) out[out.length - 1] = points[points.length - 1];
  return out;
}

export function strokePath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M${points[0][0]},${points[0][1]} l0.1,0`;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += ` Q${x},${y} ${((x + nx) / 2).toFixed(1)},${((y + ny) / 2).toFixed(1)}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last[0]},${last[1]}`;
}

function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Nét vẽ nằm dưới điểm (x, y) — dùng cho tẩy. */
export function strokeAt(d, x, y, r = 8) {
  for (let i = d.strokes.length - 1; i >= 0; i--) {
    const s = d.strokes[i];
    const lim = r + (s.width || 3) / 2;
    if (s.points.length === 1 && Math.hypot(x - s.points[0][0], y - s.points[0][1]) <= lim) return s;
    for (let j = 1; j < s.points.length; j++) if (segDist(x, y, s.points[j - 1], s.points[j]) <= lim) return s;
  }
  return null;
}

/* ---------------- Vẽ SVG ---------------- */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function segHitsNode(a, b, n) {
  const { w, h } = nodeSize(n);
  const x0 = n.x - w / 2 - 6;
  const x1 = n.x + w / 2 + 6;
  const y0 = n.y - h / 2 - 6;
  const y1 = n.y + h / 2 + 6;
  // Lấy mẫu dọc đoạn thẳng (đủ chính xác cho kích thước nút).
  for (let i = 1; i < 24; i++) {
    const t = i / 24;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (x > x0 && x < x1 && y > y0 && y < y1) return true;
  }
  return false;
}

export function edgeGeom(d, e) {
  const a = d.nodes.find((n) => n.id === e.from);
  const b = d.nodes.find((n) => n.id === e.to);
  if (!a || !b) return null;
  // Hai mũi tên ngược chiều giữa cùng cặp nút: cong ra hai bên để không chồng nhau.
  const twin = d.edges.some((x) => x !== e && x.from === e.to && x.to === e.from);
  const same = d.edges.filter((x) => x.from === e.from && x.to === e.to);
  const nth = same.indexOf(e);
  // Đường thẳng cắt qua nút khác → uốn cong vòng qua (tránh che nhãn và nhầm hướng).
  const blocked = d.nodes.some((n) => n !== a && n !== b && segHitsNode(a, b, n));
  const bend = (twin ? 28 : 0) + nth * 34 + (blocked ? 70 : 0);
  const mx0 = (a.x + b.x) / 2;
  const my0 = (a.y + b.y) / 2;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const cx = mx0 - ((b.y - a.y) / len) * bend;
  const cy = my0 + ((b.x - a.x) / len) * bend;
  const [sx, sy] = borderPoint(a, bend ? cx : b.x, bend ? cy : b.y);
  const [ex, ey] = borderPoint(b, bend ? cx : a.x, bend ? cy : a.y);
  const lx = bend ? 0.25 * sx + 0.5 * cx + 0.25 * ex : (sx + ex) / 2;
  const ly = bend ? 0.25 * sy + 0.5 * cy + 0.25 * ey : (sy + ey) / 2;
  const path = bend ? `M${sx.toFixed(1)},${sy.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}` : `M${sx.toFixed(1)},${sy.toFixed(1)} L${ex.toFixed(1)},${ey.toFixed(1)}`;
  return { path, lx, ly };
}

/** Phần thân SVG (mũi tên, nút, nét vẽ). sel: id đang chọn (để tô viền). */
export function diagramSvgBody(d, { sel = null } = {}) {
  const markers = Object.entries(EDGE_KINDS)
    .map(([k, v]) => `<marker id="dg-arr-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${v.color}"/></marker>`)
    .join('');
  const edges = d.edges
    .map((e) => {
      const g = edgeGeom(d, e);
      if (!g) return '';
      const k = EDGE_KINDS[e.kind] || EDGE_KINDS.khac;
      const lab = e.label ? (e.label.length > 40 ? `${e.label.slice(0, 38)}…` : e.label) : '';
      const lw = lab.length * 6.3 + 12;
      return `<g class="dg-edge${sel === e.id ? ' sel' : ''}" data-edge="${esc(e.id)}"><path class="dg-hit" d="${g.path}" stroke="transparent" stroke-width="14" fill="none"/><path d="${g.path}" stroke="${sel === e.id ? '#2563eb' : k.color}" stroke-width="${sel === e.id ? 2.6 : 1.8}" fill="none" ${k.dash ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#dg-arr-${e.kind in EDGE_KINDS ? e.kind : 'khac'})"><title>${esc(e.label || k.label)}</title></path>${lab ? `<rect x="${(g.lx - lw / 2).toFixed(1)}" y="${(g.ly - 9).toFixed(1)}" width="${lw.toFixed(1)}" height="16" rx="5" fill="#ffffff" fill-opacity="0.92" stroke="${k.color}" stroke-opacity="0.35"/><text x="${g.lx.toFixed(1)}" y="${(g.ly + 3).toFixed(1)}" text-anchor="middle" font-size="11" fill="${k.color}" font-family="system-ui, sans-serif">${esc(lab)}</text>` : ''}</g>`;
    })
    .join('');
  const nodes = d.nodes
    .map((n) => {
      const k = NODE_KINDS[n.kind] || NODE_KINDS.box;
      const { w, h, lines, sub } = nodeSize(n);
      const x = n.x - w / 2;
      const y = n.y - h / 2;
      const stroke = n.color || k.stroke;
      const rx = n.kind === 'person' ? h / 2 : n.kind === 'note' ? 3 : 9;
      let ty = y + 15 + (h - 18 - lines.length * 17 - sub.length * 14 - (sub.length ? 4 : 0)) / 2 + 12;
      const tl = lines.map((l) => {
        const t = `<text x="${n.x.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" font-size="13" font-weight="${n.kind === 'note' ? 400 : 650}" fill="#1b1b22" font-family="system-ui, sans-serif">${esc(l)}</text>`;
        ty += 17;
        return t;
      });
      ty += sub.length ? 2 : 0;
      const sl = sub.map((l) => {
        const t = `<text x="${n.x.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" font-size="11" fill="#555561" font-family="system-ui, sans-serif">${esc(l)}</text>`;
        ty += 14;
        return t;
      });
      return `<g class="dg-node dg-k-${n.kind}${sel === n.id ? ' sel' : ''}" data-node="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(`${k.label}: ${n.label}${n.sub ? ` — ${n.sub}` : ''}`)}"><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h}" rx="${rx}" fill="${k.fill}" stroke="${sel === n.id ? '#2563eb' : stroke}" stroke-width="${sel === n.id ? 2.8 : 1.6}" ${n.kind === 'note' ? 'stroke-dasharray="0"' : ''}/>${tl.join('')}${sl.join('')}</g>`;
    })
    .join('');
  const strokes = d.strokes.map((s) => `<path class="dg-stroke" data-stroke="${esc(s.id)}" d="${strokePath(s.points)}" stroke="${s.color}" stroke-width="${s.width || 3}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<defs>${markers}</defs><g class="dg-edges">${edges}</g><g class="dg-nodes">${nodes}</g><g class="dg-strokes">${strokes}</g>`;
}

/** SVG độc lập để xuất tệp (nền trắng, vừa khung). */
export function diagramToSvg(d, { title = '' } = {}) {
  const b = bounds(d);
  const head = title ? 36 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x.toFixed(0)} ${(b.y - head).toFixed(0)} ${b.w.toFixed(0)} ${(b.h + head).toFixed(0)}" width="${Math.round(b.w)}" height="${Math.round(b.h + head)}"><rect x="${b.x}" y="${b.y - head}" width="${b.w}" height="${b.h + head}" fill="#ffffff"/>${title ? `<text x="${(b.x + 20).toFixed(0)}" y="${(b.y - head + 26).toFixed(0)}" font-size="16" font-weight="700" fill="#1b1b22" font-family="system-ui, sans-serif">${esc(title)}</text>` : ''}${diagramSvgBody(d)}</svg>`;
}

/* ---------------- Gợi ý nhãn ---------------- */

/** Gợi ý nhãn cho nút / mũi tên dựa vào sơ đồ vụ việc và nội dung đang gõ. */
export function labelSuggestions(text, { kind = 'node', map = null, d = null } = {}) {
  const t = key(text);
  const used = new Set((d?.nodes || []).map((n) => key(n.label)));
  const out = [];
  if (kind === 'edge') {
    ['đưa tiền', 'nhận tiền', 'chuyển khoản', 'chỉ đạo', 'ký duyệt', 'thông đồng', 'môi giới', 'cho vay', 'giao hàng', 'báo cáo'].filter((x) => !t.includes(x)).forEach((x) => out.push({ label: x, insert: `${x} ` }));
    (map?.amounts || []).slice(0, 3).forEach((a) => !t.includes(key(a)) && out.push({ label: a, insert: `${a} ` }));
    return out.slice(0, 10);
  }
  (map?.people || []).filter((p) => !used.has(key(p.ten)) && (!t || key(p.ten).includes(t))).slice(0, 4).forEach((p) => out.push({ label: p.ten, insert: p.ten }));
  (map?.crimes || []).flatMap((c) => c.items).filter((it) => !used.has(key(it.ten))).slice(0, 3).forEach((it) => out.push({ label: it.ten.length > 40 ? `${it.ten.slice(0, 38)}…` : it.ten, insert: it.ten }));
  if (!t) ['Thời gian, địa điểm', 'Hậu quả, thiệt hại', 'Tài liệu, chứng cứ', 'Mâu thuẫn cần làm rõ', 'Việc cần làm tiếp'].forEach((h) => out.push({ label: h, line: `${h}: ` }));
  (map?.amounts || []).slice(0, 2).forEach((a) => !t.includes(key(a)) && out.push({ label: a, insert: ` ${a}` }));
  return out.slice(0, 10);
}
