// Sơ đồ logic tùy chỉnh: dữ liệu + bố cục + xuất SVG (không phụ thuộc DOM — dùng chung cho màn hình sửa sơ đồ và kiểm thử).
//
// diagram = {
//   v: 1,
//   layout: 'mindmap' | 'cay' | 'tang'          — kiểu bố cục (sơ đồ tư duy / cây ngang / theo tầng),
//   nodes: [{ id, kind: 'root'|'crime'|'act'|'person'|'money'|'box'|'note', label, sub, x, y, color?, w?, h?, fs?,
//             collapsed?, origin: 'auto'|'user', edited? }],   — w/h: kích thước kéo tay, fs: cỡ chữ (0.85–1.6),
//   edges: [{ id, from, to, label, kind: 'tien'|'chi-dao'|'khac'|'thuoc', origin, edited? }],
//   strokes: [{ id, color, width, points: [[x, y], …] }],
// }
// x, y là TÂM của nút. Nút sinh từ sơ đồ vụ việc có id ổn định (theo điều luật / tên người / tên hành vi) để khi
// dựng lại sau khi AI làm tiếp vẫn giữ vị trí, nhãn đã sửa, nút – mũi tên – nét vẽ người dùng tự thêm.

export const NODE_KINDS = {
  root: { label: 'Chủ đề trung tâm', fill: '#22304f', stroke: '#22304f', ink: '#ffffff' },
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
/** Màu các nhánh của sơ đồ tư duy (mỗi nhánh cấp 1 một màu, nhánh con theo màu nhánh mẹ). */
export const BRANCH_COLORS = ['#e8590c', '#1c7ed6', '#2b8a3e', '#ae3ec9', '#f08c00', '#0c8599', '#c2255c', '#5c940d'];
export const LAYOUTS = { mindmap: 'Sơ đồ tư duy', cay: 'Cây ngang', tang: 'Theo tầng', vong: 'Vòng tròn (quan hệ)', dong: 'Dòng chảy (dòng tiền)' };
/** Kiểu bố cục dạng cây (nhánh cong, thu gọn nhánh, quan hệ chéo). */
export const isTreeLayout = (layout) => layout === 'mindmap' || layout === 'cay';
/**
 * Các sơ đồ dựng sẵn từ sơ đồ vụ việc (đều sửa được như nhau): tổng hợp (sơ đồ tư duy), hành vi (điều luật → hành vi
 * → người, trích dẫn), quan hệ (người – người, mọi quan hệ), dòng tiền (chỉ quan hệ tiền, tài sản).
 */
export const PRESETS = {
  'tong-hop': { label: 'Sơ đồ tư duy', layout: 'mindmap' },
  'hanh-vi': { label: 'Sơ đồ hành vi', layout: 'cay' },
  'quan-he': { label: 'Quan hệ', layout: 'vong' },
  'dong-tien': { label: 'Dòng tiền', layout: 'dong' },
};
export const FONT_STEPS = [0.85, 1, 1.2, 1.45, 1.7];

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

export const fontScale = (n) => n.fs || (n.kind === 'root' ? 1.35 : 1);

/** Kích thước nút: tự co theo chữ, hoặc theo kích thước kéo tay (w, h) — chữ tự ngắt dòng theo bề rộng. */
export function nodeSize(n) {
  const fs = fontScale(n);
  const cw = 7.7 * fs;
  const per = n.w ? Math.max(6, Math.floor((n.w - 28) / cw)) : n.kind === 'note' ? 26 : 22;
  const lines = wrap(n.label, per, n.w ? 14 : n.kind === 'note' ? 8 : 4);
  const sub = n.sub ? wrap(n.sub, Math.round(per * 1.2), n.w ? 5 : 2) : [];
  const lh = Math.round(18 * fs);
  const sh = Math.round(15 * fs);
  const longest = Math.max(...lines.map((l) => l.length), ...sub.map((l) => l.length * 0.85), 5);
  const w = n.w ? Math.max(70, Math.round(n.w)) : Math.round(Math.min(290 * fs, Math.max(n.kind === 'note' ? 150 : n.kind === 'root' ? 170 : 104, longest * cw + 30)));
  const contentH = 16 + lines.length * lh + sub.length * sh + (sub.length ? 4 : 0);
  const h = Math.round(Math.max(n.h || 0, contentH, n.kind === 'root' ? 64 : 40));
  return { w, h, lines, sub, fs, lh, sh };
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
export function autoFromCaseMap(m, { title = '', preset = 'tong-hop' } = {}) {
  if (preset === 'quan-he' || preset === 'dong-tien') return relationFromCaseMap(m, { money: preset === 'dong-tien' });
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
  // Chủ đề trung tâm: vụ việc → các điều luật → hành vi → người thực hiện; người không gắn hành vi nối thẳng vào giữa.
  const acts = (m.crimes || []).reduce((s, c) => s + (c.items || []).length, 0);
  const behaviour = preset === 'hanh-vi';
  add({ id: 'root', kind: 'root', label: title || 'Vụ việc', sub: [acts && `${acts} hành vi`, !behaviour && (m.people || []).length && `${m.people.length} người`].filter(Boolean).join(' · ') });
  const vai = new Map((m.people || []).map((p) => [key(p.ten), p.vaiTro || '']));
  if (!behaviour) for (const p of m.people || []) add({ id: personId(p.ten), kind: 'person', label: p.ten, sub: p.vaiTro || '' });
  for (const c of m.crimes || []) {
    const cid = `c:${c.dieu || 'khac'}`;
    add({ id: cid, kind: 'crime', label: c.dieu ? `Điều ${c.dieu}` : 'Chưa xác định điều luật', sub: String(c.ten || '').replace(/^Tội /, '') });
    edge('root', cid, '', 'thuoc');
    for (const it of c.items || []) {
      const aid = `a:${c.dieu || 'khac'}:${key(it.ten).slice(0, 80)}`;
      add({ id: aid, kind: 'act', label: it.ten, sub: it.soTien || '' });
      edge(cid, aid, '', 'thuoc');
      for (const who of it.nguoi || []) {
        if (!who) continue;
        add({ id: personId(who), kind: 'person', label: who, sub: vai.get(key(who)) || '' });
        edge(personId(who), aid, 'thực hiện', 'khac');
      }
      // Sơ đồ hành vi: trích dẫn làm căn cứ gắn dưới hành vi.
      if (behaviour && it.trich) {
        const qid = `q:${aid}`;
        add({ id: qid, kind: 'note', label: `“${String(it.trich).slice(0, 160)}”`, sub: '' });
        edge(aid, qid, '', 'thuoc');
      }
    }
  }
  if (behaviour) return { nodes, edges };
  for (const e of m.edges || []) {
    if (!e.tu || !e.den) continue;
    add({ id: personId(e.tu), kind: 'person', label: e.tu, sub: '' });
    add({ id: personId(e.den), kind: 'person', label: e.den, sub: '' });
    edge(personId(e.tu), personId(e.den), `${e.noiDung || ''}${e.soTien ? ` ${e.soTien}` : ''}`.trim(), ['tien', 'chi-dao'].includes(e.loai) ? e.loai : 'khac');
  }
  // Người chưa gắn với hành vi nào → nhánh trực tiếp của chủ đề trung tâm.
  const doers = new Set(edges.filter((e) => e.label === 'thực hiện').map((e) => e.from));
  nodes.filter((n) => n.kind === 'person' && !doers.has(n.id)).forEach((n) => edge('root', n.id, '', 'thuoc'));
  return { nodes, edges };
}

/** Sơ đồ quan hệ / dòng tiền: người – người theo các quan hệ (money: chỉ tiền, tài sản). */
function relationFromCaseMap(m, { money = false } = {}) {
  const nodes = [];
  const edges = [];
  const ids = new Set();
  const vai = new Map((m.people || []).map((p) => [key(p.ten), p.vaiTro || '']));
  const person = (t) => {
    const id = `p:${key(t)}`;
    if (!ids.has(id)) {
      ids.add(id);
      nodes.push({ id, kind: 'person', label: t, sub: vai.get(key(t)) || '', origin: 'auto', x: 0, y: 0 });
    }
    return id;
  };
  for (const e of m.edges || []) {
    if (!e.tu || !e.den || (money && e.loai !== 'tien')) continue;
    const a = person(e.tu);
    const b = person(e.den);
    // Dòng tiền: số tiền nguyên văn kèm thời điểm (nếu câu nêu); nét đứt = chưa được cả người đưa lẫn người nhận khai.
    const label = money ? `${e.soTien || e.noiDung || ''}${e.thoiGian ? ` · ${e.thoiGian}` : ''}` : `${e.noiDung || ''}${e.soTien ? ` ${e.soTien}` : ''}`.trim();
    const kind = ['tien', 'chi-dao'].includes(e.loai) ? e.loai : 'khac';
    const id = `e:${a}>${b}:${key(label).slice(0, 40)}:${kind}`;
    const weak = money && !!e.khai && !(e.khai.dua && e.khai.nhan);
    if (a !== b && !edges.some((x) => x.id === id)) edges.push({ id, from: a, to: b, label, kind, origin: 'auto', ...(weak ? { weak: true } : {}) });
  }
  // Nguồn tiền: số tiền một người rút / lấy (chưa nói đưa cho ai) → nút “tiền” nối vào người đó (số tiền nguyên văn).
  if (money) {
    for (const r of m.rut || []) {
      const b = person(r.nguoi);
      const id = `r:${key(r.nguoi)}:${r.v}`;
      if (ids.has(id)) continue;
      ids.add(id);
      nodes.push({ id, kind: 'money', label: r.soTien, sub: 'rút / lấy (nguyên văn)', origin: 'auto', x: 0, y: 0 });
      edges.push({ id: `e:${id}>${b}`, from: id, to: b, label: '', kind: 'tien', origin: 'auto' });
    }
  }
  // Quan hệ: cả người chưa có quan hệ nào (để nối tay).
  if (!money) (m.people || []).forEach((p) => person(p.ten));
  // Không ghi tổng tiền tự cộng lên hình (chỉ số liệu nguyên văn); tổng theo người xem ở bảng bên dưới sơ đồ.
  return { nodes, edges };
}

/** “100 triệu đồng”, “1,5 tỷ”, “20.000.000 đồng” → số đồng (0 nếu không đọc được). */
export function moneyValue(text) {
  const m = String(text || '').match(/(\d[\d.,]*)\s*(tỷ|tỉ|triệu|nghìn|ngàn)?/i);
  if (!m) return 0;
  const unit = { tỷ: 1e9, tỉ: 1e9, triệu: 1e6, nghìn: 1e3, ngàn: 1e3 }[(m[2] || '').toLowerCase()] || 1;
  // Có đơn vị: “1,5” là thập phân; không đơn vị: “20.000.000” là phân cách hàng nghìn.
  const raw = m[1];
  const num = unit > 1 ? parseFloat(raw.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) : parseFloat(raw.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(num) ? num * unit : 0;
}
export function formatMoney(v) {
  const f = (x) => (Math.round(x * 100) / 100).toLocaleString('vi-VN');
  if (v >= 1e9) return `${f(v / 1e9)} tỷ`;
  if (v >= 1e6) return `${f(v / 1e6)} triệu`;
  if (v >= 1e3) return `${f(v / 1e3)} nghìn`;
  return `${f(v)} đồng`;
}

/** Sơ đồ mới từ sơ đồ vụ việc (đã sắp xếp). preset: tong-hop | hanh-vi | quan-he | dong-tien. */
export function diagramFromCaseMap(m, { title = '', preset = 'tong-hop', layout = PRESETS[preset]?.layout || 'mindmap' } = {}) {
  return layoutDiagram({ ...emptyDiagram(), layout, preset, ...autoFromCaseMap(m, { title, preset }) });
}

/**
 * Dựng lại phần tự sinh từ sơ đồ vụ việc mới (vd sau khi AI làm tiếp), giữ:
 * vị trí các nút cũ, nhãn đã sửa tay, nút / mũi tên / nét vẽ người dùng tự thêm. Nút tự sinh không còn thì bỏ
 * (kèm mũi tên nối tới nó). Nút mới được đặt theo bố cục tự động quanh các nút cũ.
 */
export function syncFromCaseMap(d, m, { title = '' } = {}) {
  const auto = autoFromCaseMap(m, { title: title || d.nodes.find((n) => n.id === 'root')?.label || '', preset: d.preset || 'tong-hop' });
  const old = new Map(d.nodes.map((n) => [n.id, n]));
  const keepUser = d.nodes.filter((n) => n.origin !== 'auto');
  const nodes = auto.nodes.map((n) => {
    const o = old.get(n.id);
    if (!o) return { ...n, fresh: true };
    return { ...n, x: o.x, y: o.y, color: o.color, w: o.w, h: o.h, fs: o.fs, collapsed: o.collapsed, ...(o.edited ? { label: o.label, sub: o.sub, kind: o.kind, edited: true } : {}) };
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
    // Sơ đồ tư duy / cây: sắp lại theo cây (vị trí do bố cục quyết định); theo tầng: chỉ đặt nút mới.
    if ((out.layout || 'tang') !== 'tang' || (nodes.every((n) => n.fresh) && !keepUser.length)) layoutDiagram(out);
    else placeFresh(out);
  }
  out.nodes.forEach((n) => delete n.fresh);
  return out;
}

/* ---------------- Bố cục ---------------- */

const RANK = { root: 0, crime: 0, act: 1, money: 1, person: 2, box: 3, note: 3 };

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

/* ---------------- Cây (cho sơ đồ tư duy, thu gọn nhánh) ---------------- */

const KIND_ORDER = { root: 0, crime: 1, act: 2, money: 3, person: 4, box: 5, note: 6 };

/**
 * Cây khung của sơ đồ: duyệt rộng từ chủ đề trung tâm (hoặc nút có nhiều liên kết nhất) theo mũi tên (không xét
 * chiều). Trả { roots, parent, children, depth, branch, treeEdges }; mũi tên không thuộc cây là liên kết chéo.
 */
export function treeOf(d) {
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  // Liên kết cấu trúc (thuộc, thực hiện) dựng khung cây trước; quan hệ (tiền, chỉ đạo…) chỉ dùng khi còn nút chưa nối.
  const structural = (e) => e.kind === 'thuoc' || e.label === 'thực hiện';
  const adjOf = (pred) => {
    const adj = new Map(d.nodes.map((n) => [n.id, []]));
    for (const e of d.edges) {
      if (!byId.has(e.from) || !byId.has(e.to) || e.from === e.to || !pred(e)) continue;
      adj.get(e.from).push({ id: e.to, e });
      adj.get(e.to).push({ id: e.from, e });
    }
    return adj;
  };
  const adjS = adjOf(structural);
  const adjAll = adjOf(() => true);
  const order = (a, b) => (KIND_ORDER[byId.get(a.id).kind] ?? 9) - (KIND_ORDER[byId.get(b.id).kind] ?? 9);
  const parent = new Map();
  const children = new Map(d.nodes.map((n) => [n.id, []]));
  const depth = new Map();
  const branch = new Map();
  const treeEdges = new Set();
  const roots = [];
  const bfs = (start, adj) => {
    const q = [start];
    while (q.length) {
      const id = q.shift();
      for (const nb of [...adj.get(id)].sort(order)) {
        if (depth.has(nb.id)) continue;
        depth.set(nb.id, depth.get(id) + 1);
        parent.set(nb.id, id);
        children.get(id).push(nb.id);
        treeEdges.add(nb.e.id);
        branch.set(nb.id, depth.get(id) === 0 ? children.get(id).length - 1 : branch.get(id));
        q.push(nb.id);
      }
    }
  };
  const starts = [...d.nodes].sort((a, b) => (a.kind === 'root' ? -1 : 0) - (b.kind === 'root' ? -1 : 0) || adjAll.get(b.id).length - adjAll.get(a.id).length || (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9));
  for (const s of starts) {
    if (depth.has(s.id)) continue;
    roots.push(s.id);
    depth.set(s.id, 0);
    bfs(s.id, adjS);
    // Nối thêm các nút chỉ liên hệ qua quan hệ với cụm này (theo thứ tự đã có trong cụm).
    let grew = true;
    while (grew) {
      grew = false;
      for (const id of [...depth.keys()]) {
        for (const nb of [...adjAll.get(id)].sort(order)) {
          if (depth.has(nb.id)) continue;
          depth.set(nb.id, depth.get(id) + 1);
          parent.set(nb.id, id);
          children.get(id).push(nb.id);
          treeEdges.add(nb.e.id);
          branch.set(nb.id, depth.get(id) === 0 ? children.get(id).length - 1 : branch.get(id));
          bfs(nb.id, adjS);
          grew = true;
        }
      }
    }
  }
  return { roots, parent, children, depth, branch, treeEdges };
}

/** Các nút bị ẩn vì nằm trong nhánh đang thu gọn. */
export function hiddenSet(d, t = treeOf(d)) {
  const hidden = new Set();
  const hide = (id) => t.children.get(id)?.forEach((c) => (hidden.add(c), hide(c)));
  d.nodes.filter((n) => n.collapsed).forEach((n) => hide(n.id));
  return hidden;
}

/** Bố cục theo kiểu của sơ đồ (d.layout). */
export function layoutDiagram(d) {
  const l = d.layout || 'tang';
  if (l === 'vong') return circleLayout(d);
  if (l === 'dong') return flowLayout(d);
  return l === 'tang' ? autoLayout(d) : mindmapLayout(d, { both: l !== 'cay' });
}

/** Vòng tròn: các nút xếp đều trên vòng (người nhiều quan hệ ở trên cùng) — hợp với sơ đồ quan hệ. */
export function circleLayout(d) {
  const deg = new Map(d.nodes.map((n) => [n.id, 0]));
  d.edges.forEach((e) => (deg.set(e.from, (deg.get(e.from) || 0) + 1), deg.set(e.to, (deg.get(e.to) || 0) + 1)));
  const list = [...d.nodes].sort((a, b) => deg.get(b.id) - deg.get(a.id));
  const n = list.length;
  if (!n) return d;
  if (n === 1) return ((list[0].x = 0), (list[0].y = 0), d);
  const maxW = Math.max(...list.map((x) => nodeSize(x).w));
  // Bán kính đủ để các nút không chạm nhau, chừa chỗ cho nhãn mũi tên.
  const R = Math.max(200, (n * (maxW + 70)) / (2 * Math.PI));
  list.forEach((node, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    node.x = Math.round(R * 1.35 * Math.cos(a));
    node.y = Math.round(R * Math.sin(a));
  });
  return d;
}

/**
 * Dòng chảy trái → phải: cột theo đường đi dài nhất từ nguồn (người chỉ đưa / chuyển) tới đích (người chỉ nhận);
 * trong cột sắp theo trọng tâm các nút nối tới — hợp với sơ đồ dòng tiền.
 */
export function flowLayout(d, { gapX = 150, gapY = 46 } = {}) {
  const ids = d.nodes.map((n) => n.id);
  const rank = new Map(ids.map((id) => [id, 0]));
  for (let k = 0; k < ids.length; k++) {
    let moved = false;
    for (const e of d.edges) {
      if (!rank.has(e.from) || !rank.has(e.to) || e.from === e.to) continue;
      if (rank.get(e.to) < rank.get(e.from) + 1 && rank.get(e.from) + 1 < ids.length) {
        rank.set(e.to, rank.get(e.from) + 1);
        moved = true;
      }
    }
    if (!moved) break;
  }
  const cols = [];
  d.nodes.forEach((n) => (cols[rank.get(n.id)] ||= []).push(n));
  const pos = new Map();
  let x = 0;
  cols.forEach((col) => {
    if (!col?.length) return;
    col.forEach((n, i) => {
      const ys = d.edges.filter((e) => e.to === n.id && pos.has(e.from)).map((e) => pos.get(e.from));
      n._o = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : i * 1000;
    });
    col.sort((a, b) => a._o - b._o);
    const w = Math.max(...col.map((n) => nodeSize(n).w));
    const total = col.reduce((s, n) => s + nodeSize(n).h, 0) + gapY * (col.length - 1);
    let y = -total / 2;
    col.forEach((n) => {
      const h = nodeSize(n).h;
      n.x = Math.round(x + w / 2);
      n.y = Math.round(y + h / 2);
      pos.set(n.id, n.y);
      y += h + gapY;
      delete n._o;
    });
    x += w + gapX;
  });
  return d;
}

/**
 * Sơ đồ tư duy: chủ đề ở giữa, các nhánh tỏa hai bên (both) hoặc cây ngang sang phải; nhánh con xếp gọn theo chiều
 * dọc, không chồng nhau. Nhánh đang thu gọn chỉ chiếm chỗ của nút mẹ.
 */
export function mindmapLayout(d, { both = true, gapY = 16, gapX = 64 } = {}) {
  const t = treeOf(d);
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const kids = (id) => (byId.get(id)?.collapsed ? [] : t.children.get(id) || []);
  const span = new Map();
  const spanOf = (id) => {
    if (span.has(id)) return span.get(id);
    const own = nodeSize(byId.get(id)).h;
    const ks = kids(id);
    const v = Math.max(own, ks.reduce((s, c) => s + spanOf(c), 0) + gapY * Math.max(0, ks.length - 1));
    span.set(id, v);
    return v;
  };
  const place = (id, dir) => {
    const n = byId.get(id);
    const ks = kids(id);
    const total = ks.reduce((s, c) => s + spanOf(c), 0) + gapY * Math.max(0, ks.length - 1);
    let y = n.y - total / 2;
    const w = nodeSize(n).w;
    for (const c of ks) {
      const cn = byId.get(c);
      const sp = spanOf(c);
      cn.y = Math.round(y + sp / 2);
      cn.x = Math.round(n.x + dir * (w / 2 + gapX + nodeSize(cn).w / 2));
      place(c, dir);
      y += sp + gapY;
    }
    // Nút trong nhánh thu gọn: đặt tại nút mẹ (không hiển thị).
    if (n.collapsed) {
      const hide = (k) => (t.children.get(k) || []).forEach((c) => ((byId.get(c).x = n.x), (byId.get(c).y = n.y), hide(c)));
      hide(id);
    }
  };
  let bottom = null;
  t.roots.forEach((rid, ri) => {
    const r = byId.get(rid);
    if (ri === 0) {
      if (!Number.isFinite(r.x)) r.x = 0;
      if (!Number.isFinite(r.y)) r.y = 0;
      const ks = kids(rid);
      if (!both) {
        place(rid, 1);
      } else {
        // Chia nhánh cấp 1 sang phải / trái cho cân (theo tổng chiều cao), giữ thứ tự.
        const right = [];
        const left = [];
        let sr = 0;
        let sl = 0;
        for (const c of ks) {
          if (sr <= sl) (right.push(c), (sr += spanOf(c) + gapY));
          else (left.push(c), (sl += spanOf(c) + gapY));
        }
        const side = (list, dir) => {
          const total = list.reduce((s, c) => s + spanOf(c), 0) + gapY * Math.max(0, list.length - 1);
          let y = r.y - total / 2;
          const w = nodeSize(r).w;
          for (const c of list) {
            const cn = byId.get(c);
            const sp = spanOf(c);
            cn.y = Math.round(y + sp / 2);
            cn.x = Math.round(r.x + dir * (w / 2 + gapX + 20 + nodeSize(cn).w / 2));
            place(c, dir);
            y += sp + gapY;
          }
        };
        side(right, 1);
        side(left.reverse(), -1);
        if (r.collapsed) place(rid, 1);
      }
      bottom = bounds(d, 0);
    } else {
      // Cụm không nối với chủ đề trung tâm: xếp bên dưới, mỗi cụm một cây ngang.
      const sp = spanOf(rid);
      r.x = Math.round((bottom?.x ?? 0) + nodeSize(r).w / 2);
      r.y = Math.round((bottom ? bottom.y + bottom.h : 0) + 90 + sp / 2);
      place(rid, 1);
      bottom = bounds(d, 0);
    }
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
  const hidden = d.nodes.some((n) => n.collapsed) ? hiddenSet(d) : null;
  for (const n of d.nodes) {
    if (hidden?.has(n.id) || !Number.isFinite(n.x)) continue;
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

export function edgeGeom(d, e, { arc = 0 } = {}) {
  const a = d.nodes.find((n) => n.id === e.from);
  const b = d.nodes.find((n) => n.id === e.to);
  if (!a || !b) return null;
  // Hai mũi tên ngược chiều giữa cùng cặp nút: cong ra hai bên để không chồng nhau.
  const twin = d.edges.some((x) => x !== e && x.from === e.to && x.to === e.from);
  const same = d.edges.filter((x) => x.from === e.from && x.to === e.to);
  const nth = same.indexOf(e);
  // Đường thẳng cắt qua nút khác → uốn cong vòng qua (tránh che nhãn và nhầm hướng).
  const blocked = d.nodes.some((n) => n !== a && n !== b && segHitsNode(a, b, n));
  const bend = (twin ? 28 : 0) + nth * 34 + (blocked && !arc ? 70 : 0) + arc;
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

const tint = (hex, a) => {
  const v = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * (1 - a));
  return `#${[(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => mix(c).toString(16).padStart(2, '0')).join('')}`;
};

/** Đường nhánh cong (sơ đồ tư duy) từ cạnh nút mẹ tới cạnh nút con. */
function branchPath(a, b) {
  const wa = nodeSize(a).w / 2;
  const wb = nodeSize(b).w / 2;
  const dir = b.x >= a.x ? 1 : -1;
  const sx = a.x + dir * wa;
  const ex = b.x - dir * wb;
  const mx = (sx + ex) / 2;
  return { path: `M${sx.toFixed(1)},${a.y.toFixed(1)} C${mx.toFixed(1)},${a.y.toFixed(1)} ${mx.toFixed(1)},${b.y.toFixed(1)} ${ex.toFixed(1)},${b.y.toFixed(1)}`, lx: mx, ly: (a.y + b.y) / 2, dir };
}

/**
 * Phần thân SVG (mũi tên, nút, nét vẽ). sel: id đang chọn. ui: vẽ thêm điều khiển trên hình (thu gọn nhánh,
 * gợi ý, tay nắm đổi kích thước) — chỉ trong màn hình sửa, không có khi xuất tệp. ideas(n): số gợi ý của nút.
 */
export function diagramSvgBody(d, { sel = null, ui = false, ideas = null } = {}) {
  let crossN = 0;
  const tree = isTreeLayout(d.layout);
  const t = treeOf(d);
  const hidden = hiddenSet(d, t);
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const colorOf = (id) => {
    const n = byId.get(id);
    if (n?.color) return n.color;
    if (!tree) return (NODE_KINDS[n?.kind] || NODE_KINDS.box).stroke;
    if (!t.depth.get(id)) return NODE_KINDS.root.stroke;
    return BRANCH_COLORS[(t.branch.get(id) ?? 0) % BRANCH_COLORS.length];
  };
  const markers = Object.entries(EDGE_KINDS)
    .map(([k, v]) => `<marker id="dg-arr-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${v.color}"/></marker>`)
    .join('');
  const label = (lab, x, y, color) => {
    if (!lab) return '';
    const s = lab.length > 40 ? `${lab.slice(0, 38)}…` : lab;
    const lw = s.length * 6.8 + 14;
    return `<rect x="${(x - lw / 2).toFixed(1)}" y="${(y - 10).toFixed(1)}" width="${lw.toFixed(1)}" height="18" rx="6" fill="#ffffff" fill-opacity="0.94" stroke="${color}" stroke-opacity="0.4"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="600" fill="${color}" font-family="system-ui, sans-serif">${esc(s)}</text>`;
  };
  const edges = d.edges
    .filter((e) => !hidden.has(e.from) && !hidden.has(e.to))
    .map((e) => {
      const k = EDGE_KINDS[e.kind] || EDGE_KINDS.khac;
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) return '';
      const isSel = sel === e.id;
      if (tree && t.treeEdges.has(e.id)) {
        // Nhánh của sơ đồ tư duy: đường cong theo màu nhánh, càng xa trung tâm càng mảnh.
        const [pa, ch] = t.parent.get(e.to) === e.from ? [a, b] : [b, a];
        const g = branchPath(pa, ch);
        const c = colorOf(ch.id);
        const wdt = Math.max(1.8, 5 - (t.depth.get(ch.id) || 1) * 1.1);
        const arrow = e.kind === 'tien' || e.kind === 'chi-dao' ? ` marker-end="url(#dg-arr-${e.kind})"` : '';
        return `<g class="dg-edge dg-branch dg-e-${e.kind}${isSel ? ' sel' : ''}" data-edge="${esc(e.id)}"><path class="dg-hit" d="${g.path}" stroke="transparent" stroke-width="14" fill="none"/><path d="${g.path}" stroke="${isSel ? '#2563eb' : c}" stroke-width="${isSel ? wdt + 1 : wdt}" fill="none" stroke-linecap="round"${arrow}><title>${esc(e.label || k.label)}</title></path>${label(e.label && e.label !== 'thực hiện' ? e.label : '', g.lx, g.ly, c)}</g>`;
      }
      // Sơ đồ tư duy: quan hệ chéo (tiền, chỉ đạo… giữa các nhánh) vẽ thành vòng cung tránh trục chính, có thể ẩn.
      if (tree && d.hideCross) return '';
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const g = edgeGeom(d, e, tree ? { arc: (crossN++ % 2 ? -1 : 1) * Math.max(50, len * 0.28) } : {});
      if (!g) return '';
      const cross = tree ? ' dg-cross' : '';
      return `<g class="dg-edge dg-e-${e.kind}${cross}${isSel ? ' sel' : ''}" data-edge="${esc(e.id)}"><path class="dg-hit" d="${g.path}" stroke="transparent" stroke-width="14" fill="none"/><path d="${g.path}" stroke="${isSel ? '#2563eb' : k.color}" stroke-width="${isSel ? 2.6 : e.kind === 'tien' && !tree ? 2.4 : 1.8}" fill="none" ${k.dash || tree || e.weak ? 'stroke-dasharray="6 4"' : ''} marker-end="url(#dg-arr-${e.kind in EDGE_KINDS ? e.kind : 'khac'})"><title>${esc(e.label || k.label)}${e.weak ? ' — chỉ một bên khai' : ''}</title></path>${label(e.label, g.lx, g.ly, k.color)}</g>`;
    })
    .join('');
  const nodes = d.nodes
    .filter((n) => !hidden.has(n.id) && Number.isFinite(n.x))
    .map((n) => {
      const k = NODE_KINDS[n.kind] || NODE_KINDS.box;
      const { w, h, lines, sub, fs, lh, sh } = nodeSize(n);
      const x = n.x - w / 2;
      const y = n.y - h / 2;
      const depth = t.depth.get(n.id) || 0;
      const c = colorOf(n.id);
      // Sơ đồ tư duy: chủ đề đậm; nhánh cấp 1 nền màu nhạt của nhánh; cấp sâu hơn nền trắng viền màu nhánh.
      const isRoot = n.kind === 'root';
      const fill = isRoot ? k.fill : tree ? (depth === 1 ? tint(c, 0.16) : '#ffffff') : k.fill;
      const stroke = isRoot ? k.stroke : tree ? c : n.color || k.stroke;
      const ink = isRoot ? '#ffffff' : '#1b1b22';
      const subInk = isRoot ? '#dfe6f5' : '#555561';
      const rx = isRoot ? 18 : n.kind === 'person' && !n.w ? h / 2 : n.kind === 'note' ? 4 : 10;
      const bodyH = 16 + lines.length * lh + sub.length * sh + (sub.length ? 4 : 0);
      let ty = y + (h - bodyH) / 2 + 8 + lh * 0.78;
      const tl = lines.map((l) => {
        const out = `<text x="${n.x.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" font-size="${(14 * fs).toFixed(1)}" font-weight="${n.kind === 'note' ? 400 : isRoot || depth <= 1 ? 700 : 600}" fill="${ink}" font-family="system-ui, sans-serif">${esc(l)} </text>`;
        ty += lh;
        return out;
      });
      ty += sub.length ? 3 : 0;
      const sl = sub.map((l) => {
        const out = `<text x="${n.x.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" font-size="${(12 * fs).toFixed(1)}" fill="${subInk}" font-family="system-ui, sans-serif">${esc(l)} </text>`;
        ty += sh;
        return out;
      });
      let extra = '';
      if (ui) {
        const nKids = (t.children.get(n.id) || []).length;
        const right = !tree || n.x >= (byId.get(t.parent.get(n.id))?.x ?? n.x - 1);
        if (nKids && (tree || n.collapsed)) {
          const cx = isRoot ? n.x : right ? x + w + 9 : x - 9;
          const cy = isRoot ? y + h + 9 : n.y;
          extra += `<g class="dg-toggle" data-toggle="${esc(n.id)}" role="button" aria-label="${n.collapsed ? `Mở nhánh (${nKids})` : 'Thu gọn nhánh'}"><circle cx="${cx}" cy="${cy}" r="9" fill="#ffffff" stroke="${stroke}" stroke-width="1.6"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="${n.collapsed ? 10 : 13}" font-weight="700" fill="${stroke}" font-family="system-ui, sans-serif">${n.collapsed ? nKids : '−'}</text></g>`;
        }
        const nIdeas = ideas ? ideas(n) : 0;
        if (nIdeas) extra += `<g class="dg-idea" data-ideas="${esc(n.id)}" role="button" aria-label="Gợi ý cho “${esc(n.label)}”"><title>${nIdeas} gợi ý — bấm để xem, thêm nhánh</title><circle cx="${x + w - 2}" cy="${y + 2}" r="10" fill="#7048e8"/><text x="${x + w - 2}" y="${y + 6.5}" text-anchor="middle" font-size="12" fill="#ffffff" font-family="system-ui, sans-serif">✦</text></g>`;
        if (sel === n.id) extra += `<rect class="dg-resize" data-resize="${esc(n.id)}" x="${x + w - 7}" y="${y + h - 7}" width="12" height="12" rx="3" fill="#2563eb" stroke="#ffffff" stroke-width="1.5"><title>Kéo để đổi kích thước</title></rect>`;
      }
      const shadow = tree || isRoot ? ' filter="url(#dg-shadow)"' : '';
      return `<g class="dg-node dg-k-${n.kind}${sel === n.id ? ' sel' : ''}${n.collapsed ? ' collapsed' : ''}" data-node="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(`${k.label}: ${n.label}${n.sub ? ` — ${n.sub}` : ''}`)}"><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${sel === n.id ? '#2563eb' : stroke}" stroke-width="${sel === n.id ? 2.8 : isRoot ? 0 : tree ? 2 : 1.6}"${shadow}/>${tl.join('')}${sl.join('')}${extra}</g>`;
    })
    .join('');
  const strokes = d.strokes.map((s) => `<path class="dg-stroke" data-stroke="${esc(s.id)}" d="${strokePath(s.points)}" stroke="${s.color}" stroke-width="${s.width || 3}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  const defs = `<defs>${markers}<filter id="dg-shadow" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#1b1b22" flood-opacity="0.16"/></filter></defs>`;
  return `${defs}<g class="dg-edges">${edges}</g><g class="dg-nodes">${nodes}</g><g class="dg-strokes">${strokes}</g>`;
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

/* ---------------- Gợi ý ngay trên từng hình ---------------- */

const IDEA_BY_KIND = {
  root: ['Người liên quan', 'Hành vi vi phạm', 'Dòng tiền, tài sản', 'Dòng thời gian', 'Tài liệu, chứng cứ', 'Mâu thuẫn cần làm rõ', 'Việc cần làm tiếp'],
  crime: ['Dấu hiệu định tội đã có căn cứ', 'Dấu hiệu còn phải chứng minh', 'Tình tiết định khung', 'Hậu quả, thiệt hại'],
  act: ['Thời gian, địa điểm', 'Người thực hiện, giúp sức', 'Thủ đoạn, cách thức', 'Số tiền, thiệt hại', 'Mục đích, động cơ', 'Tài liệu, chứng cứ', 'Câu hỏi cần làm rõ'],
  person: ['Vai trò, chức vụ', 'Đã đưa / nhận bao nhiêu tiền', 'Liên hệ với ai', 'Lời khai đã có', 'Điểm mâu thuẫn trong lời khai', 'Câu hỏi cho lần khai tới'],
  money: ['Nguồn tiền', 'Chuyển cho ai, khi nào', 'Hình thức (tiền mặt / chuyển khoản)', 'Chứng từ, sao kê', 'Số tiền đã thu hồi'],
  box: ['Làm rõ thêm', 'Căn cứ, tài liệu', 'Việc cần làm tiếp'],
  note: ['Việc cần làm tiếp', 'Người phụ trách', 'Thời hạn'],
};

/**
 * Gợi ý nhánh con cho một nút: theo loại nút (đầu mục điều tra thường cần), theo dữ liệu vụ việc (người, hành vi,
 * dòng tiền liên quan chưa có trên sơ đồ) và dấu hiệu định tội của điều luật. Bỏ các gợi ý đã có trong nhánh.
 * Trả [{ label, kind }].
 */
export function nodeIdeas(n, d, { map = null, crimeOf = null } = {}) {
  if (!n) return [];
  const t = treeOf(d);
  const near = new Set([...(t.children.get(n.id) || []), t.parent.get(n.id)].filter(Boolean).map((id) => key(d.nodes.find((x) => x.id === id)?.label)));
  const onMap = new Set(d.nodes.map((x) => key(x.label)));
  const out = [];
  const push = (label, kind = 'box') => {
    const k = key(label);
    if (!k || near.has(k) || out.some((x) => key(x.label) === k)) return;
    out.push({ label, kind });
  };
  const nk = key(n.label);
  if (n.kind === 'crime') {
    const dieu = (n.label.match(/\d+/) || [])[0];
    const c = dieu && crimeOf ? crimeOf(dieu) : null;
    (c?.dauHieu || []).slice(0, 4).forEach((s) => push(`Dấu hiệu: ${s.length > 70 ? `${s.slice(0, 68)}…` : s}`));
    (map?.crimes || []).filter((x) => x.dieu === dieu).flatMap((x) => x.items).forEach((it) => !onMap.has(key(it.ten)) && push(it.ten, 'act'));
  }
  if (n.kind === 'act' && map) {
    const it = (map.crimes || []).flatMap((c) => c.items).find((x) => key(x.ten) === nk);
    (it?.nguoi || []).forEach((p) => push(p, 'person'));
    if (it?.soTien) push(it.soTien, 'money');
  }
  if (n.kind === 'person' && map) {
    (map.edges || []).filter((e) => key(e.tu) === nk || key(e.den) === nk).forEach((e) => push(key(e.tu) === nk ? `${e.noiDung || 'liên quan'} ${e.den}${e.soTien ? `: ${e.soTien}` : ''}` : `${e.tu} ${e.noiDung || 'liên quan'}${e.soTien ? `: ${e.soTien}` : ''}`, e.loai === 'tien' ? 'money' : 'box'));
    const p = (map.people || []).find((x) => key(x.ten) === nk);
    if (p?.vaiTro && !key(n.sub).includes(key(p.vaiTro))) push(`Vai trò: ${p.vaiTro}`);
  }
  if (n.kind === 'root' && map) (map.people || []).filter((p) => !onMap.has(key(p.ten))).slice(0, 4).forEach((p) => push(p.ten, 'person'));
  (IDEA_BY_KIND[n.kind] || IDEA_BY_KIND.box).forEach((l) => push(l));
  return out.slice(0, 10);
}
