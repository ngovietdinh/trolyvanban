// Màn hình sửa sơ đồ logic: kéo thả nút, thêm / sửa / xóa nút và mũi tên, nối nút, bút vẽ tự do, ghi chú, tẩy,
// hoàn tác / làm lại, sắp xếp tự động, thu phóng, toàn màn hình, xuất PNG / SVG. Tự lưu sau mỗi thay đổi.
import { $, $$, icon, toast, escapeHtml, downloadBlob } from '../ui.js';
import { attachSuggest } from '../lib/suggest.js';
import { NODE_KINDS, EDGE_KINDS, PEN_COLORS, newId, autoLayout, bounds, simplify, strokeAt, diagramSvgBody, diagramToSvg, labelSuggestions } from '../legal/diagram.js';

const MODES = [
  ['select', 'move', 'Chọn, kéo thả (V)', 'Chọn'],
  ['node', 'square', 'Thêm nút: bấm vào chỗ trống (N)', 'Nút'],
  ['connect', 'link', 'Nối: bấm nút đầu rồi nút cuối (C)', 'Nối'],
  ['pen', 'pen', 'Bút vẽ tự do (P)', 'Bút'],
  ['text', 'type', 'Ghi chú: bấm vào chỗ cần ghi (T)', 'Ghi chú'],
  ['erase', 'eraser', 'Tẩy nét vẽ (E)', 'Tẩy'],
];
const HOTKEY = { v: 'select', n: 'node', c: 'connect', p: 'pen', t: 'text', e: 'erase' };

/**
 * host: phần tử chứa. opts:
 * - diagram: dữ liệu sơ đồ (được sửa trực tiếp);
 * - title: tên sơ đồ (xuất tệp);
 * - map: sơ đồ vụ việc (để gợi ý nhãn);
 * - onChange(diagram): gọi sau mỗi thay đổi (tự lưu);
 * - onRebuild(): dựng lại phần tự sinh từ sơ đồ vụ việc (nếu có) → trả về diagram mới.
 */
export function mountDiagram(host, { diagram, title = 'Sơ đồ', map = null, onChange = () => {}, onRebuild = null }) {
  let d = diagram;
  let mode = 'select';
  let sel = null; // { type: 'node'|'edge', id }
  let nodeKind = 'box';
  let edgeKind = 'khac';
  let pen = { color: PEN_COLORS[0], width: 3 };
  let connectFrom = null;
  const undo = [];
  const redo = [];
  let view = null; // { x, y, w, h } — vùng đang nhìn (viewBox)
  let fallbackFull = false;

  host.innerHTML = `<div class="dg" data-dg tabindex="-1">
    <div class="dg-bar" role="toolbar" aria-label="Công cụ sơ đồ">
      <div class="dg-group dg-modes">${MODES.map(([m, ic, tip, l]) => `<button type="button" class="dg-btn" data-dg-mode="${m}" title="${tip}" aria-label="${tip}" aria-pressed="false">${icon(ic, 'ic-sm')}<span>${l}</span></button>`).join('')}</div>
      <div class="dg-group dg-opt" data-dg-opt></div>
      <span class="spacer"></span>
      <div class="dg-group">
        <button type="button" class="dg-btn" data-dg-undo title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác">${icon('undo', 'ic-sm')}</button>
        <button type="button" class="dg-btn" data-dg-redo title="Làm lại (Ctrl+Y)" aria-label="Làm lại">${icon('redo', 'ic-sm')}</button>
        <button type="button" class="dg-btn" data-dg-layout title="Sắp xếp tự động" aria-label="Sắp xếp tự động">${icon('grid', 'ic-sm')}</button>
        <button type="button" class="dg-btn" data-dg-zoom="out" title="Thu nhỏ" aria-label="Thu nhỏ">${icon('zoom-out', 'ic-sm')}</button>
        <button type="button" class="dg-btn" data-dg-fit title="Vừa khung" aria-label="Vừa khung"><span>100%</span></button>
        <button type="button" class="dg-btn" data-dg-zoom="in" title="Phóng to" aria-label="Phóng to">${icon('zoom-in', 'ic-sm')}</button>
        <button type="button" class="dg-btn" data-dg-full title="Toàn màn hình (F)" aria-label="Toàn màn hình">${icon('maximize', 'ic-sm')}</button>
      </div>
    </div>
    <div class="dg-main">
      <div class="dg-canvas" data-dg-canvas>
        <svg class="dg-svg" data-dg-svg xmlns="http://www.w3.org/2000/svg" role="application" aria-label="Sơ đồ logic — kéo thả để sắp xếp, bấm đúp để sửa"></svg>
        <p class="dg-tip" data-dg-tip></p>
      </div>
      <aside class="dg-props" data-dg-props></aside>
    </div>
    <div class="dg-foot"><small data-dg-stat></small><span class="spacer"></span>${onRebuild ? `<button type="button" class="btn btn-ghost btn-sm" data-dg-rebuild title="Cập nhật nút, mũi tên từ sơ đồ vụ việc hiện tại — giữ vị trí, nhãn đã sửa và mọi thứ tự thêm">${icon('refresh', 'ic-sm')}Cập nhật từ sơ đồ vụ việc</button>` : ''}<button type="button" class="btn btn-ghost btn-sm" data-dg-clear>${icon('trash', 'ic-sm')}Xóa nét vẽ</button><button type="button" class="btn btn-sm" data-dg-png>${icon('download', 'ic-sm')}PNG</button><button type="button" class="btn btn-sm" data-dg-svgx>${icon('download', 'ic-sm')}SVG</button></div>
  </div>`;
  const root = $('[data-dg]', host);
  const svg = $('[data-dg-svg]', root);
  const canvas = $('[data-dg-canvas]', root);
  const props = $('[data-dg-props]', root);

  /* ---------- Lịch sử ---------- */
  const snap = () => JSON.stringify(d);
  const commit = (before) => {
    if (before === snap()) return;
    undo.push(before);
    if (undo.length > 80) undo.shift();
    redo.length = 0;
    changed();
  };
  const mutate = (fn) => {
    const before = snap();
    fn();
    commit(before);
    draw();
  };
  function changed() {
    onChange(d);
    stat();
  }
  function restore(s) {
    const o = JSON.parse(s);
    d.nodes = o.nodes;
    d.edges = o.edges;
    d.strokes = o.strokes;
    if (sel && !(sel.type === 'node' ? d.nodes : d.edges).some((x) => x.id === sel.id)) sel = null;
    changed();
    draw();
    drawProps();
  }

  /* ---------- Toạ độ, thu phóng ---------- */
  function fit() {
    const b = bounds(d, 50);
    const r = canvas.getBoundingClientRect();
    const ratio = r.width && r.height ? r.width / r.height : 1.6;
    let { x, y, w, h } = b;
    if (w / h > ratio) {
      const nh = w / ratio;
      y -= (nh - h) / 2;
      h = nh;
    } else {
      const nw = h * ratio;
      x -= (nw - w) / 2;
      w = nw;
    }
    view = { x, y, w, h };
    applyView();
  }
  function applyView() {
    svg.setAttribute('viewBox', `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`);
    const r = canvas.getBoundingClientRect();
    const z = r.width ? Math.round((r.width / view.w) * 100) : 100;
    $('[data-dg-fit] span', root).textContent = `${z}%`;
  }
  function zoom(f, cx, cy) {
    const r = canvas.getBoundingClientRect();
    const px = cx ?? view.x + view.w / 2;
    const py = cy ?? view.y + view.h / 2;
    const nw = Math.min(Math.max(view.w * f, 200), 20000);
    const k = nw / view.w;
    view = { x: px - (px - view.x) * k, y: py - (py - view.y) * k, w: nw, h: view.h * k };
    if (!r.width) return;
    applyView();
  }
  function pt(e) {
    const r = svg.getBoundingClientRect();
    // viewBox giữ tỉ lệ (meet): tính lề khi khung không cùng tỉ lệ.
    const s = Math.max(view.w / r.width, view.h / r.height);
    const ox = (r.width * s - view.w) / 2;
    const oy = (r.height * s - view.h) / 2;
    return [view.x - ox + (e.clientX - r.left) * s, view.y - oy + (e.clientY - r.top) * s];
  }

  /* ---------- Vẽ ---------- */
  let tempLine = '';
  let liveStroke = null;
  function draw() {
    const selId = sel?.id || null;
    svg.innerHTML = `${diagramSvgBody(d, { sel: selId })}<g class="dg-temp" data-dg-temp>${connectFrom ? tempLine : ''}</g>${liveStroke ? `<path class="dg-live" d="M${liveStroke.points.map((p) => p.join(',')).join(' L')}" stroke="${liveStroke.color}" stroke-width="${liveStroke.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}`;
    if (connectFrom) $(`[data-node="${CSS.escape(connectFrom)}"]`, svg)?.classList.add('from');
  }
  // Chỉ đổi lớp “đang chọn”, không dựng lại SVG (giữ phần tử dưới con trỏ để nhận bấm đúp).
  function markSel() {
    $$('.dg-node.sel, .dg-edge.sel', svg).forEach((x) => x.classList.remove('sel'));
    if (sel) $(`[data-${sel.type}="${CSS.escape(sel.id)}"]`, svg)?.classList.add('sel');
  }
  function stat() {
    $('[data-dg-stat]', root).textContent = `${d.nodes.length} nút · ${d.edges.length} mũi tên · ${d.strokes.length} nét vẽ · tự lưu`;
    $('[data-dg-undo]', root).disabled = !undo.length;
    $('[data-dg-redo]', root).disabled = !redo.length;
  }
  const TIPS = {
    select: 'Kéo nút để sắp xếp · kéo chỗ trống để di chuyển khung · bấm đúp để sửa · Delete để xóa · Ctrl + lăn chuột để thu phóng',
    node: 'Bấm vào chỗ trống để thêm nút mới (chọn loại nút ở thanh công cụ)',
    connect: 'Bấm nút đầu, rồi bấm nút cuối để nối mũi tên · Esc để hủy',
    pen: 'Kéo để vẽ tự do lên sơ đồ — khoanh vùng, gạch chân, vẽ thêm mũi tên…',
    text: 'Bấm vào chỗ cần ghi chú',
    erase: 'Bấm hoặc kéo qua nét vẽ để xóa',
  };
  function setMode(m) {
    mode = m;
    connectFrom = null;
    tempLine = '';
    $$('[data-dg-mode]', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dgMode === m)));
    root.dataset.mode = m;
    $('[data-dg-tip]', root).textContent = TIPS[m];
    const opt = $('[data-dg-opt]', root);
    if (m === 'node') opt.innerHTML = `<select class="select dg-sel" data-dg-nkind aria-label="Loại nút">${Object.entries(NODE_KINDS).filter(([k]) => k !== 'note').map(([k, v]) => `<option value="${k}" ${k === nodeKind ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`;
    else if (m === 'connect') opt.innerHTML = `<select class="select dg-sel" data-dg-ekind aria-label="Loại mũi tên">${Object.entries(EDGE_KINDS).map(([k, v]) => `<option value="${k}" ${k === edgeKind ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`;
    else if (m === 'pen') opt.innerHTML = `${PEN_COLORS.map((c) => `<button type="button" class="dg-color ${c === pen.color ? 'on' : ''}" data-dg-color="${c}" style="--c:${c}" aria-label="Màu ${c}"></button>`).join('')}<select class="select dg-sel" data-dg-width aria-label="Nét"><option value="2" ${pen.width === 2 ? 'selected' : ''}>Mảnh</option><option value="3" ${pen.width === 3 ? 'selected' : ''}>Vừa</option><option value="6" ${pen.width === 6 ? 'selected' : ''}>Đậm</option><option value="14" ${pen.width === 14 ? 'selected' : ''}>Bút dạ</option></select>`;
    else opt.innerHTML = '';
    draw();
  }

  /* ---------- Bảng thuộc tính ---------- */
  let detachSg = [];
  function drawProps(focus = false) {
    detachSg.forEach((f) => f());
    detachSg = [];
    const n = sel?.type === 'node' ? d.nodes.find((x) => x.id === sel.id) : null;
    const e = sel?.type === 'edge' ? d.edges.find((x) => x.id === sel.id) : null;
    if (n) {
      props.innerHTML = `<h4>${icon('square', 'ic-sm')}Nút</h4>
        <label class="dg-f"><span>Nội dung</span><textarea class="textarea" rows="3" data-dg-label>${escapeHtml(n.label)}</textarea></label>
        <label class="dg-f"><span>Dòng phụ</span><input class="input" data-dg-sub value="${escapeHtml(n.sub || '')}" placeholder="Vai trò, số tiền, thời gian…" /></label>
        <label class="dg-f"><span>Loại</span><select class="select" data-dg-kind>${Object.entries(NODE_KINDS).map(([k, v]) => `<option value="${k}" ${k === n.kind ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <div class="dg-f"><span>Màu viền</span><div class="dg-colors">${['', ...PEN_COLORS].map((c) => `<button type="button" class="dg-color ${c === (n.color || '') ? 'on' : ''}" data-dg-ncolor="${c}" style="--c:${c || 'var(--line-strong)'}" aria-label="${c ? `Màu ${c}` : 'Màu mặc định'}"></button>`).join('')}</div></div>
        <div class="dg-actions"><button type="button" class="btn btn-sm" data-dg-from>${icon('link', 'ic-sm')}Nối từ nút này</button><button type="button" class="btn btn-sm btn-ghost" data-dg-dup>${icon('copy', 'ic-sm')}Nhân bản</button><button type="button" class="btn btn-sm btn-ghost dg-del" data-dg-del>${icon('trash', 'ic-sm')}Xóa</button></div>`;
      const ta = $('[data-dg-label]', props);
      detachSg.push(attachSuggest(ta, (t) => labelSuggestions(t, { kind: 'node', map, d })));
      if (focus) {
        ta.focus();
        ta.select();
      }
    } else if (e) {
      const a = d.nodes.find((x) => x.id === e.from);
      const b = d.nodes.find((x) => x.id === e.to);
      props.innerHTML = `<h4>${icon('link', 'ic-sm')}Mũi tên</h4>
        <p class="hint">${escapeHtml(a?.label || '?')} → ${escapeHtml(b?.label || '?')}</p>
        <label class="dg-f"><span>Nhãn</span><input class="input" data-dg-elabel value="${escapeHtml(e.label || '')}" placeholder="đưa tiền 50 triệu, chỉ đạo…" /></label>
        <label class="dg-f"><span>Loại</span><select class="select" data-dg-ek>${Object.entries(EDGE_KINDS).map(([k, v]) => `<option value="${k}" ${k === e.kind ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <div class="dg-actions"><button type="button" class="btn btn-sm" data-dg-rev>${icon('refresh', 'ic-sm')}Đảo chiều</button><button type="button" class="btn btn-sm btn-ghost dg-del" data-dg-del>${icon('trash', 'ic-sm')}Xóa</button></div>`;
      const inp = $('[data-dg-elabel]', props);
      detachSg.push(attachSuggest(inp, (t) => labelSuggestions(t, { kind: 'edge', map, d })));
      if (focus) {
        inp.focus();
        inp.select();
      }
    } else {
      props.innerHTML = `<h4>${icon('info', 'ic-sm')}Sơ đồ tùy chỉnh</h4>
        <p class="hint">Bấm một nút hoặc mũi tên để sửa. Bấm đúp vào chỗ trống để thêm nhanh một nút.</p>
        <div class="dg-quick">${Object.entries(NODE_KINDS).map(([k, v]) => `<button type="button" class="dg-chip" data-dg-add="${k}">${icon('plus', 'ic-sm')}${v.label}</button>`).join('')}</div>
        <ul class="dg-legend">${Object.values(EDGE_KINDS).map((v) => `<li><i style="--c:${v.color}" class="${v.dash ? 'dash' : ''}"></i>${v.label}</li>`).join('')}</ul>`;
    }
  }
  // Sửa thuộc tính: ghi ngay (một bước hoàn tác cho mỗi lần sửa ô).
  let editBefore = null;
  props.addEventListener('focusin', (ev) => {
    if (ev.target.matches('input, textarea')) editBefore = snap();
  });
  props.addEventListener('input', (ev) => {
    const n = sel?.type === 'node' ? d.nodes.find((x) => x.id === sel.id) : null;
    const e = sel?.type === 'edge' ? d.edges.find((x) => x.id === sel.id) : null;
    if (n && ev.target.matches('[data-dg-label]')) n.label = ev.target.value;
    else if (n && ev.target.matches('[data-dg-sub]')) n.sub = ev.target.value;
    else if (e && ev.target.matches('[data-dg-elabel]')) e.label = ev.target.value;
    else return;
    (n || e).edited = true;
    draw();
  });
  props.addEventListener('focusout', (ev) => {
    if (editBefore && ev.target.matches('input, textarea')) {
      commit(editBefore);
      editBefore = null;
    }
  });
  props.addEventListener('change', (ev) => {
    const n = sel?.type === 'node' ? d.nodes.find((x) => x.id === sel.id) : null;
    const e = sel?.type === 'edge' ? d.edges.find((x) => x.id === sel.id) : null;
    if (n && ev.target.matches('[data-dg-kind]')) mutate(() => ((n.kind = ev.target.value), (n.edited = true)));
    if (e && ev.target.matches('[data-dg-ek]')) mutate(() => ((e.kind = ev.target.value), (e.edited = true)));
  });
  props.addEventListener('click', (ev) => {
    const t = ev.target;
    const n = sel?.type === 'node' ? d.nodes.find((x) => x.id === sel.id) : null;
    const e = sel?.type === 'edge' ? d.edges.find((x) => x.id === sel.id) : null;
    const add = t.closest('[data-dg-add]');
    if (add) return addNode(add.dataset.dgAdd, view.x + view.w / 2 + (Math.random() - 0.5) * 80, view.y + view.h / 2 + (Math.random() - 0.5) * 60);
    if (t.closest('[data-dg-del]')) return removeSel();
    if (n && t.closest('[data-dg-ncolor]')) return mutate(() => ((n.color = t.closest('[data-dg-ncolor]').dataset.dgNcolor || undefined), (n.edited = true))), drawProps();
    if (n && t.closest('[data-dg-from]')) {
      setMode('connect');
      connectFrom = n.id;
      draw();
      return;
    }
    if (n && t.closest('[data-dg-dup]')) {
      const c = { ...n, id: newId(), origin: 'user', x: n.x + 30, y: n.y + 30 };
      mutate(() => d.nodes.push(c));
      sel = { type: 'node', id: c.id };
      draw();
      return drawProps();
    }
    if (e && t.closest('[data-dg-rev]')) return mutate(() => ([e.from, e.to] = [e.to, e.from]));
  });

  function addNode(kind, x, y, label) {
    const n = { id: newId(), kind, label: label ?? (kind === 'note' ? '' : NODE_KINDS[kind].label), sub: '', x: Math.round(x), y: Math.round(y), origin: 'user' };
    mutate(() => d.nodes.push(n));
    sel = { type: 'node', id: n.id };
    draw();
    drawProps(true);
    return n;
  }
  function removeSel() {
    if (!sel) return;
    const s = sel;
    mutate(() => {
      if (s.type === 'node') {
        d.nodes = d.nodes.filter((x) => x.id !== s.id);
        d.edges = d.edges.filter((x) => x.from !== s.id && x.to !== s.id);
      } else d.edges = d.edges.filter((x) => x.id !== s.id);
    });
    sel = null;
    draw();
    drawProps();
  }

  /* ---------- Con trỏ ---------- */
  let drag = null;
  let lastDown = { id: null, t: 0, x: 0, y: 0 };
  // Bấm đúp (chuột và cảm ứng): tự nhận theo hai lần nhấn liên tiếp trên cùng đối tượng.
  const isDouble = (id, ev) => {
    const now = Date.now();
    const dbl = lastDown.id === id && now - lastDown.t < 420 && Math.hypot(ev.clientX - lastDown.x, ev.clientY - lastDown.y) < 12;
    lastDown = dbl ? { id: null, t: 0, x: 0, y: 0 } : { id, t: now, x: ev.clientX, y: ev.clientY };
    return dbl;
  };
  svg.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    // Giữ phím tắt (Delete, Ctrl+Z, V/N/C/P/T/E) hoạt động sau khi bấm vào khung vẽ.
    if (!root.contains(document.activeElement) || props.contains(document.activeElement)) root.focus({ preventScroll: true });
    const [x, y] = pt(ev);
    const nodeEl = ev.target.closest('[data-node]');
    const edgeEl = ev.target.closest('[data-edge]');
    if (mode === 'select') {
      const id = nodeEl ? `n:${nodeEl.dataset.node}` : edgeEl ? `e:${edgeEl.dataset.edge}` : 'bg';
      if (isDouble(id, ev)) {
        ev.preventDefault();
        if (nodeEl || edgeEl) {
          sel = nodeEl ? { type: 'node', id: nodeEl.dataset.node } : { type: 'edge', id: edgeEl.dataset.edge };
          markSel();
          return drawProps(true);
        }
        addNode('box', x, y);
        return;
      }
    }
    if (mode === 'pen') {
      liveStroke = { id: newId('s'), color: pen.color, width: pen.width, points: [[x, y]] };
      drag = { type: 'pen' };
    } else if (mode === 'erase') {
      drag = { type: 'erase', before: snap() };
      eraseAt(x, y);
    } else if (mode === 'text') {
      addNode('note', x, y, '');
      return;
    } else if (mode === 'node' && !nodeEl) {
      addNode(nodeKind, x, y);
      return;
    } else if (mode === 'connect') {
      if (!nodeEl) {
        connectFrom = null;
        draw();
        return;
      }
      const id = nodeEl.dataset.node;
      if (!connectFrom) {
        connectFrom = id;
        draw();
        return;
      }
      if (id !== connectFrom) {
        const e = { id: newId('e'), from: connectFrom, to: id, label: '', kind: edgeKind, origin: 'user' };
        mutate(() => d.edges.push(e));
        sel = { type: 'edge', id: e.id };
        connectFrom = null;
        tempLine = '';
        draw();
        drawProps(true);
      }
      return;
    } else if (nodeEl) {
      const n = d.nodes.find((q) => q.id === nodeEl.dataset.node);
      sel = { type: 'node', id: n.id };
      drag = { type: 'node', n, dx: x - n.x, dy: y - n.y, before: snap(), moved: false };
      markSel();
      drawProps();
    } else if (edgeEl) {
      sel = { type: 'edge', id: edgeEl.dataset.edge };
      markSel();
      drawProps();
      return;
    } else {
      if (sel) {
        sel = null;
        markSel();
        drawProps();
      }
      drag = { type: 'pan', sx: ev.clientX, sy: ev.clientY, v: { ...view } };
    }
    svg.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
  });
  svg.addEventListener('pointermove', (ev) => {
    if (mode === 'connect' && connectFrom) {
      const a = d.nodes.find((n) => n.id === connectFrom);
      const [x, y] = pt(ev);
      if (a) {
        // Chỉ vẽ lại đường tạm, không dựng lại cả sơ đồ.
        tempLine = `<line x1="${a.x}" y1="${a.y}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#2563eb" stroke-width="1.6" stroke-dasharray="5 4" pointer-events="none"/>`;
        const g = $('[data-dg-temp]', svg);
        if (g) g.innerHTML = tempLine;
      }
      return;
    }
    if (!drag) return;
    const [x, y] = pt(ev);
    if (drag.type === 'pen') {
      liveStroke.points.push([x, y]);
      draw();
    } else if (drag.type === 'erase') eraseAt(x, y);
    else if (drag.type === 'node') {
      drag.n.x = Math.round(x - drag.dx);
      drag.n.y = Math.round(y - drag.dy);
      drag.moved = true;
      draw();
    } else if (drag.type === 'pan') {
      const r = svg.getBoundingClientRect();
      const s = Math.max(drag.v.w / r.width, drag.v.h / r.height);
      view = { ...drag.v, x: drag.v.x - (ev.clientX - drag.sx) * s, y: drag.v.y - (ev.clientY - drag.sy) * s };
      applyView();
    }
  });
  const end = () => {
    if (!drag) return;
    const g = drag;
    drag = null;
    if (g.type === 'pen' && liveStroke) {
      const s = { ...liveStroke, points: simplify(liveStroke.points) };
      liveStroke = null;
      mutate(() => d.strokes.push(s));
    } else if (g.type === 'erase') commit(g.before);
    else if (g.type === 'node' && g.moved) commit(g.before);
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  function eraseAt(x, y) {
    const s = strokeAt(d, x, y, 8 * (view.w / (svg.getBoundingClientRect().width || view.w)));
    if (!s) return;
    d.strokes = d.strokes.filter((q) => q !== s);
    draw();
  }
  canvas.addEventListener(
    'wheel',
    (ev) => {
      if (!(ev.ctrlKey || ev.metaKey || isFull())) return;
      ev.preventDefault();
      const [x, y] = pt(ev);
      zoom(ev.deltaY > 0 ? 1.12 : 1 / 1.12, x, y);
    },
    { passive: false },
  );

  /* ---------- Thanh công cụ ---------- */
  root.addEventListener('click', (ev) => {
    const t = ev.target;
    const m = t.closest('[data-dg-mode]');
    if (m) return setMode(m.dataset.dgMode);
    const c = t.closest('[data-dg-color]');
    if (c) {
      pen.color = c.dataset.dgColor;
      return setMode('pen');
    }
    if (t.closest('[data-dg-undo]') && undo.length) {
      redo.push(snap());
      return restore(undo.pop());
    }
    if (t.closest('[data-dg-redo]') && redo.length) {
      undo.push(snap());
      return restore(redo.pop());
    }
    if (t.closest('[data-dg-layout]')) {
      mutate(() => autoLayout(d));
      return fit();
    }
    const z = t.closest('[data-dg-zoom]');
    if (z) return zoom(z.dataset.dgZoom === 'in' ? 1 / 1.25 : 1.25);
    if (t.closest('[data-dg-fit]')) return fit();
    if (t.closest('[data-dg-full]')) return toggleFull();
    if (t.closest('[data-dg-clear]')) {
      if (!d.strokes.length) return toast('Chưa có nét vẽ nào', { type: 'info' });
      mutate(() => (d.strokes = []));
      return toast('Đã xóa các nét vẽ — bấm Hoàn tác nếu cần lấy lại');
    }
    if (t.closest('[data-dg-svgx]')) {
      downloadBlob(new Blob([diagramToSvg(d, { title })], { type: 'image/svg+xml' }), `${fileBase()}.svg`, 'image/svg+xml');
      return toast('Đã xuất sơ đồ (.svg)');
    }
    if (t.closest('[data-dg-png]')) return exportPng();
    if (t.closest('[data-dg-rebuild]') && onRebuild) {
      const before = snap();
      const nd = onRebuild();
      if (!nd) return;
      d.nodes = nd.nodes;
      d.edges = nd.edges;
      d.strokes = nd.strokes;
      commit(before);
      draw();
      fit();
      toast('Đã cập nhật từ sơ đồ vụ việc — vị trí, nhãn đã sửa và phần tự thêm được giữ nguyên');
    }
  });
  root.addEventListener('change', (ev) => {
    if (ev.target.matches('[data-dg-nkind]')) nodeKind = ev.target.value;
    if (ev.target.matches('[data-dg-ekind]')) edgeKind = ev.target.value;
    if (ev.target.matches('[data-dg-width]')) pen.width = +ev.target.value;
  });
  root.addEventListener('keydown', (ev) => {
    if (ev.target.matches('input, textarea, select')) {
      if (ev.key === 'Escape') ev.target.blur();
      return;
    }
    const k = ev.key.toLowerCase();
    if ((ev.ctrlKey || ev.metaKey) && k === 'z') {
      ev.preventDefault();
      return $(ev.shiftKey ? '[data-dg-redo]' : '[data-dg-undo]', root).click();
    }
    if ((ev.ctrlKey || ev.metaKey) && k === 'y') {
      ev.preventDefault();
      return $('[data-dg-redo]', root).click();
    }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (k === 'delete' || k === 'backspace') {
      if (sel) {
        ev.preventDefault();
        removeSel();
      }
      return;
    }
    if (k === 'escape') {
      if (fallbackFull) return toggleFull();
      sel = null;
      setMode('select');
      return drawProps();
    }
    if (k === 'f') return toggleFull();
    if (HOTKEY[k]) setMode(HOTKEY[k]);
  });

  /* ---------- Toàn màn hình ---------- */
  const isFull = () => fallbackFull || document.fullscreenElement === root;
  function toggleFull() {
    if (isFull()) {
      if (document.fullscreenElement === root) document.exitFullscreen?.();
      fallbackFull = false;
      root.classList.remove('dg-full');
      document.body.classList.remove('dg-lock');
    } else if (root.requestFullscreen && document.fullscreenEnabled) {
      root.requestFullscreen().catch(() => {
        fallbackFull = true;
        root.classList.add('dg-full');
        document.body.classList.add('dg-lock');
        afterFull();
      });
    } else {
      // iPhone / trình duyệt không hỗ trợ Fullscreen API: phủ kín cửa sổ.
      fallbackFull = true;
      root.classList.add('dg-full');
      document.body.classList.add('dg-lock');
    }
    afterFull();
  }
  function afterFull() {
    requestAnimationFrame(() => {
      const on = isFull();
      const b = $('[data-dg-full]', root);
      b.innerHTML = icon(on ? 'minimize' : 'maximize', 'ic-sm');
      b.setAttribute('aria-label', on ? 'Thoát toàn màn hình' : 'Toàn màn hình');
      b.title = on ? 'Thoát toàn màn hình (Esc)' : 'Toàn màn hình (F)';
      root.classList.toggle('is-full', on);
      fit();
      root.focus({ preventScroll: true });
    });
  }
  const onFs = () => afterFull();
  document.addEventListener('fullscreenchange', onFs);

  /* ---------- Xuất ---------- */
  const fileBase = () => `so-do-${String(title).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) || 'logic'}`;
  function exportPng() {
    const svgText = diagramToSvg(d, { title });
    const b = bounds(d);
    const scale = Math.min(2, 6000 / Math.max(b.w, b.h + 36));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(b.w * scale);
      c.height = Math.round((b.h + (title ? 36 : 0)) * scale);
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((blob) => {
        if (!blob) return toast('Không tạo được ảnh PNG — thử xuất SVG', { type: 'error' });
        downloadBlob(blob, `${fileBase()}.png`, 'image/png');
        toast('Đã xuất sơ đồ (.png)');
      }, 'image/png');
    };
    img.onerror = () => toast('Không tạo được ảnh PNG — thử xuất SVG', { type: 'error' });
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => view && applyView()) : null;
  ro?.observe(canvas);
  setMode('select');
  drawProps();
  stat();
  requestAnimationFrame(fit);
  return {
    get: () => d,
    set(nd) {
      d = nd;
      sel = null;
      undo.length = 0;
      redo.length = 0;
      draw();
      drawProps();
      stat();
      fit();
    },
    destroy() {
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement === root) document.exitFullscreen?.();
      document.body.classList.remove('dg-lock');
      ro?.disconnect();
      detachSg.forEach((f) => f());
    },
  };
}

