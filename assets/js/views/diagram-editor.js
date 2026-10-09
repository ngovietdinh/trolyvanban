// Màn hình sửa sơ đồ logic: kéo thả nút, thêm / sửa / xóa nút và mũi tên, nối nút, bút vẽ tự do, ghi chú, tẩy,
// hoàn tác / làm lại, sắp xếp tự động, thu phóng, toàn màn hình, xuất PNG / SVG. Tự lưu sau mỗi thay đổi.
import { $, $$, icon, toast, escapeHtml, downloadBlob } from '../ui.js';
import { attachSuggest } from '../lib/suggest.js';
import { makeResizable } from '../lib/resizer.js';
import { store, uid } from '../lib/store.js';
import { NODE_KINDS, EDGE_KINDS, PEN_COLORS, LAYOUTS, FONT_STEPS, newId, layoutDiagram, bounds, simplify, strokeAt, diagramSvgBody, diagramToSvg, labelSuggestions, nodeIdeas, treeOf, hiddenSet, fontScale, nodeSize, isTreeLayout } from '../legal/diagram.js';

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
 * - onRebuild(): dựng lại phần tự sinh từ sơ đồ vụ việc (nếu có) → trả về diagram mới;
 * - aiIdeas(node, { path, children, signal }) → Promise<string[]>: AI gợi ý nhánh con cho một hình (nếu có AI);
 * - crimeOf(dieu): tra điều luật (gợi ý dấu hiệu định tội trên hình điều luật).
 */
export function mountDiagram(host, { diagram, title = 'Sơ đồ', map = null, onChange = () => {}, onRebuild = null, aiIdeas = null, crimeOf = null, profileHtml = null }) {
  let d = diagram;
  let mode = 'select';
  let sel = null; // { type: 'node'|'edge', id }
  let nodeKind = 'box';
  let edgeKind = 'khac';
  let pen = { color: PEN_COLORS[0], width: 3 };
  let connectFrom = null;
  let hl = new Set(); // nút được làm nổi (Phân tích lời khai → “Xem trên sơ đồ”)
  const undo = [];
  const redo = [];
  let view = null; // { x, y, w, h } — vùng đang nhìn (viewBox)
  let fallbackFull = false;

  host.innerHTML = `<div class="dg" data-dg tabindex="-1">
    <div class="dg-bar" role="toolbar" aria-label="Công cụ sơ đồ">
      <div class="dg-group dg-modes">${MODES.map(([m, ic, tip, l]) => `<button type="button" class="dg-btn" data-dg-mode="${m}" title="${tip}" aria-label="${tip}" aria-pressed="false">${icon(ic, 'ic-sm')}<span>${l}</span></button>`).join('')}</div>
      <div class="dg-group dg-opt" data-dg-opt></div>
      <div class="dg-group dg-view">
        <select class="select dg-sel" data-dg-lmode aria-label="Kiểu sơ đồ" title="Kiểu sơ đồ">${Object.entries(LAYOUTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <button type="button" class="dg-btn" data-dg-collapse="all" title="Thu gọn tất cả nhánh (chỉ còn nhánh chính)" aria-label="Thu gọn tất cả nhánh">${icon('minimize', 'ic-sm')}</button>
        <button type="button" class="dg-btn" data-dg-collapse="none" title="Mở tất cả nhánh" aria-label="Mở tất cả nhánh">${icon('maximize', 'ic-sm')}<span>Mở hết</span></button>
        <button type="button" class="dg-btn" data-dg-cross aria-pressed="true" title="Ẩn / hiện quan hệ chéo giữa các nhánh (tiền, chỉ đạo…)" aria-label="Ẩn / hiện quan hệ chéo">${icon('link', 'ic-sm')}<span>Quan hệ</span></button>
      </div>
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
        <div class="dg-pop" data-dg-pop hidden role="dialog" aria-label="Gợi ý nhánh"></div>
        <div class="dg-pop dg-lib" data-dg-libp hidden role="dialog" aria-label="Lưu và mở sơ đồ"></div>
        <input type="file" accept=".json,application/json" data-dg-file hidden />
      </div>
      <div class="dg-vsplit" data-dg-vsplit style="right: var(--dg-pw, 260px)" title="Kéo để đổi độ rộng khung thuộc tính · bấm đúp: mặc định" aria-label="Kéo để đổi độ rộng khung thuộc tính"></div>
      <aside class="dg-props" data-dg-props></aside>
    </div>
    <div class="dg-grip" data-dg-grip title="Kéo để đổi chiều cao khung vẽ · bấm đúp: mặc định" aria-label="Kéo để đổi chiều cao khung vẽ"></div>
    <div class="dg-foot"><small data-dg-stat></small><span class="spacer"></span>${onRebuild ? `<button type="button" class="btn btn-ghost btn-sm" data-dg-rebuild title="Cập nhật nút, mũi tên từ sơ đồ vụ việc hiện tại — giữ vị trí, nhãn đã sửa và mọi thứ tự thêm">${icon('refresh', 'ic-sm')}Cập nhật từ sơ đồ vụ việc</button>` : ''}<button type="button" class="btn btn-sm" data-dg-lib title="Lưu bản sơ đồ có tên, mở bản đã lưu, tải ra / mở từ tệp">${icon('save', 'ic-sm')}Lưu / mở bản</button><button type="button" class="btn btn-ghost btn-sm" data-dg-clear>${icon('trash', 'ic-sm')}Xóa nét vẽ</button><button type="button" class="btn btn-sm" data-dg-png>${icon('download', 'ic-sm')}PNG</button><button type="button" class="btn btn-sm" data-dg-svgx>${icon('download', 'ic-sm')}SVG</button></div>
  </div>`;
  const root = $('[data-dg]', host);
  const svg = $('[data-dg-svg]', root);
  const canvas = $('[data-dg-canvas]', root);
  // Kéo thanh dưới khung vẽ để đổi chiều cao; kéo thanh trước khung thuộc tính để đổi độ rộng (nhớ trên máy).
  const rzH = makeResizable($('[data-dg-grip]', root), { axis: 'y', min: 280, max: () => Math.max(420, window.innerHeight * 1.6), key: 'tlvb:dg-h', current: () => canvas.getBoundingClientRect().height, apply: (v) => root.style.setProperty('--dg-h', v == null ? '' : `${v}px`) });
  const rzW = makeResizable($('[data-dg-vsplit]', root), { axis: 'x', dir: -1, min: 200, max: () => Math.max(260, root.clientWidth * 0.5), key: 'tlvb:dg-pw', current: () => $('[data-dg-props]', root).getBoundingClientRect().width, apply: (v) => root.style.setProperty('--dg-pw', v == null ? '' : `${v}px`) });
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
  let savedAt = null;
  function changed() {
    ideaCache = null;
    onChange(d);
    savedAt = new Date();
    stat();
  }
  // Số gợi ý trên từng hình (tính lại khi sơ đồ đổi cấu trúc, không tính lại khi đang kéo).
  let ideaCache = null;
  const ideasOf = (n) => nodeIdeas(n, d, { map, crimeOf });
  const ideaCount = (n) => {
    if (!ideaCache) ideaCache = new Map();
    if (!ideaCache.has(n.id)) ideaCache.set(n.id, ideasOf(n).length);
    return ideaCache.get(n.id);
  };
  const isTree = () => isTreeLayout(d.layout);
  /** Sắp lại theo cây (sơ đồ tư duy / cây ngang) — giữ chủ đề trung tâm tại chỗ. */
  const relayout = () => isTree() && layoutDiagram(d);
  function restore(s) {
    const o = JSON.parse(s);
    d.nodes = o.nodes;
    d.edges = o.edges;
    d.strokes = o.strokes;
    d.layout = o.layout;
    d.hideCross = o.hideCross;
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
    // Sơ đồ ít hình: không phóng quá 100% (hình không to quá khổ, còn chỗ trống để thêm).
    const minW = Math.max(r.width || 900, 600);
    if (w < minW) {
      x -= (minW - w) / 2;
      w = minW;
    }
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
    svg.innerHTML = `${diagramSvgBody(d, { sel: selId, ui: true, ideas: ideaCount })}<g class="dg-temp" data-dg-temp>${connectFrom ? tempLine : ''}</g>${liveStroke ? `<path class="dg-live" d="M${liveStroke.points.map((p) => p.join(',')).join(' L')}" stroke="${liveStroke.color}" stroke-width="${liveStroke.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}`;
    if (connectFrom) $(`[data-node="${CSS.escape(connectFrom)}"]`, svg)?.classList.add('from');
    hl.forEach((id) => $(`[data-node="${CSS.escape(id)}"]`, svg)?.classList.add('hl'));
  }
  // Chỉ đổi lớp “đang chọn”, không dựng lại SVG (giữ phần tử dưới con trỏ để nhận bấm đúp).
  function markSel() {
    $$('.dg-node.sel, .dg-edge.sel', svg).forEach((x) => x.classList.remove('sel'));
    if (sel) $(`[data-${sel.type}="${CSS.escape(sel.id)}"]`, svg)?.classList.add('sel');
  }
  function stat() {
    const hid = d.nodes.some((n) => n.collapsed) ? hiddenSet(d).size : 0;
    $('[data-dg-stat]', root).textContent = `${d.nodes.length} nút${hid ? ` (${hid} đang thu gọn)` : ''} · ${d.edges.length} mũi tên · ${d.strokes.length} nét vẽ · ${savedAt ? `đã tự lưu lúc ${savedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'tự lưu'}`;
    $('[data-dg-lmode]', root).value = d.layout || 'tang';
    $('[data-dg-cross]', root).setAttribute('aria-pressed', String(!d.hideCross));
    $('[data-dg-cross]', root).hidden = !isTree();
    $$('[data-dg-collapse]', root).forEach((b) => (b.hidden = !isTree()));
    $('[data-dg-undo]', root).disabled = !undo.length;
    $('[data-dg-redo]', root).disabled = !redo.length;
  }
  const TIPS = {
    select: 'Kéo hình để sắp xếp · kéo ô vuông xanh ở góc để đổi kích thước · ✦ để xem gợi ý · Tab: thêm nhánh con · Enter: thêm nhánh ngang hàng · bấm đúp để sửa · Ctrl + lăn chuột (hoặc chụm 2 ngón) để thu phóng',
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
        <div class="dg-f"><span>Cỡ chữ, kích thước</span><div class="dg-fs"><button type="button" class="btn btn-sm" data-dg-fs="-1" aria-label="Chữ nhỏ hơn">A−</button><strong>${Math.round(fontScale(n) * 100)}%</strong><button type="button" class="btn btn-sm" data-dg-fs="1" aria-label="Chữ to hơn">A+</button>${n.w || n.h ? `<button type="button" class="btn btn-sm btn-ghost" data-dg-autosize>Tự co theo chữ</button>` : ''}</div></div>
        <div class="dg-actions"><button type="button" class="btn btn-sm btn-primary" data-dg-child>${icon('plus', 'ic-sm')}Thêm nhánh con</button><button type="button" class="btn btn-sm" data-dg-ideas>✦ Gợi ý</button></div>
        <div class="dg-actions"><button type="button" class="btn btn-sm" data-dg-from>${icon('link', 'ic-sm')}Nối từ nút này</button><button type="button" class="btn btn-sm btn-ghost" data-dg-dup>${icon('copy', 'ic-sm')}Nhân bản</button><button type="button" class="btn btn-sm btn-ghost dg-del" data-dg-del>${icon('trash', 'ic-sm')}Xóa</button></div>${(n.kind === 'person' && profileHtml && profileHtml(n.label)) ? `<details class="dg-prof" open><summary>${icon('user', 'ic-sm')}Hồ sơ người này (từ lời khai)</summary>${profileHtml(n.label)}</details>` : ''}`;
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
        <p class="hint">Bấm một hình hoặc mũi tên để sửa. Hình có ✦ là có gợi ý nhánh — bấm để thêm nhanh${aiIdeas ? ' hoặc nhờ AI gợi ý thêm' : ''}. Bấm đúp vào chỗ trống để thêm hình mới. Đổi “Kiểu sơ đồ” ở thanh công cụ: sơ đồ tư duy, cây ngang, theo tầng.</p>
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
    const fsb = n && t.closest('[data-dg-fs]');
    if (fsb) {
      const cur = fontScale(n);
      const i = FONT_STEPS.findIndex((f) => f >= cur - 0.01);
      const next = FONT_STEPS[Math.max(0, Math.min(FONT_STEPS.length - 1, (i < 0 ? 1 : i) + +fsb.dataset.dgFs))];
      mutate(() => ((n.fs = next), relayout()));
      return drawProps();
    }
    if (n && t.closest('[data-dg-autosize]')) {
      mutate(() => (delete n.w, delete n.h, relayout()));
      return drawProps();
    }
    if (n && t.closest('[data-dg-child]')) return addChild(n, '', { edit: true });
    if (n && t.closest('[data-dg-ideas]')) return openIdeas(n.id);
  });

  /* ---------- Nhánh, gợi ý ngay trên hình ---------- */
  const CHILD_KIND = { root: 'box', crime: 'act', act: 'box', person: 'box', money: 'box', box: 'box', note: 'note' };
  const childKind = (host) => (d.preset === 'quan-he' || d.preset === 'dong-tien' ? 'person' : CHILD_KIND[host.kind] || 'box');
  function addChild(parent, label, { kind, edit = false, sibling = false } = {}) {
    const t = treeOf(d);
    const host = sibling ? d.nodes.find((x) => x.id === t.parent.get(parent.id)) || parent : parent;
    const k = kind || childKind(host);
    const kids = (t.children.get(host.id) || []).map((id) => d.nodes.find((x) => x.id === id));
    const right = host.kind === 'root' ? kids.filter((x) => x.x >= host.x).length <= kids.filter((x) => x.x < host.x).length : host.x >= (d.nodes.find((x) => x.id === t.parent.get(host.id))?.x ?? host.x - 1);
    const below = kids.length ? Math.max(...kids.map((x) => x.y + nodeSize(x).h / 2)) + 40 : host.y;
    const n = { id: newId(), kind: k, label: label || (edit ? '' : NODE_KINDS[k].label), sub: '', x: Math.round(host.x + (right ? 1 : -1) * (nodeSize(host).w / 2 + 180)), y: Math.round(below), origin: 'user' };
    mutate(() => {
      host.collapsed = false;
      d.nodes.push(n);
      // Sơ đồ quan hệ / dòng tiền: nhánh mới là một quan hệ (tiền) để sửa nhãn, số tiền ngay.
      d.edges.push({ id: newId('e'), from: host.id, to: n.id, label: '', kind: d.preset === 'dong-tien' ? 'tien' : d.preset === 'quan-he' ? 'khac' : 'thuoc', origin: 'user' });
      relayout();
      // Sơ đồ quan hệ / dòng tiền: sắp lại để người mới vào đúng vị trí (vòng tròn / dòng chảy).
      if (d.layout === 'dong' || d.layout === 'vong') layoutDiagram(d);
    });
    ensureVisible(n);
    if (edit) {
      sel = { type: 'node', id: n.id };
      draw();
      drawProps(true);
    }
    return n;
  }
  /** Đưa hình vào tầm nhìn (dời khung nếu hình nằm ngoài). */
  function ensureVisible(n) {
    if (!view || !n) return;
    const z = nodeSize(n);
    const pad = 30;
    if (n.x - z.w / 2 < view.x + pad || n.x + z.w / 2 > view.x + view.w - pad || n.y - z.h / 2 < view.y + pad || n.y + z.h / 2 > view.y + view.h - pad) {
      const b = bounds(d, 50);
      if (b.w <= view.w && b.h <= view.h) view = { ...view, x: b.x + b.w / 2 - view.w / 2, y: b.y + b.h / 2 - view.h / 2 };
      else view = { ...view, x: n.x - view.w / 2, y: n.y - view.h / 2 };
      applyView();
    }
  }
  const pop = $('[data-dg-pop]', root);
  let popFor = null;
  let popCtl = null;
  let popAi = [];
  function closeIdeas() {
    popCtl?.abort();
    popCtl = null;
    popFor = null;
    pop.hidden = true;
  }
  function openIdeas(id, { keepAi = false } = {}) {
    const n = d.nodes.find((x) => x.id === id);
    if (!n) return closeIdeas();
    if (popFor !== id) popAi = [];
    if (!keepAi && popFor !== id) popCtl?.abort();
    popFor = id;
    sel = { type: 'node', id };
    markSel();
    const list = ideasOf(n);
    const ai = popAi.filter((x) => !list.some((y) => y.label === x.label));
    pop.innerHTML = `<div class="dg-pop-head"><strong>✦ Gợi ý cho “${escapeHtml(n.label.length > 40 ? `${n.label.slice(0, 38)}…` : n.label)}”</strong><button type="button" class="btn btn-ghost btn-sm btn-icon" data-pop-x aria-label="Đóng">${icon('x', 'ic-sm')}</button></div>
      <p class="hint">Bấm để thêm thành nhánh con — sửa lại tùy ý.</p>
      <div class="dg-pop-chips">${list.map((x, i) => `<button type="button" class="dg-chip" data-idea="${i}">${icon('plus', 'ic-sm')}${escapeHtml(x.label)}</button>`).join('') || '<small class="hint">Đã thêm hết gợi ý có sẵn.</small>'}</div>
      ${ai.length ? `<div class="dg-pop-chips ai">${ai.map((x, i) => `<button type="button" class="dg-chip ai" data-idea-ai="${i}">✨ ${escapeHtml(x.label)}</button>`).join('')}</div>` : ''}
      ${aiIdeas ? `<button type="button" class="btn btn-sm dg-pop-ai" data-pop-ai ${popCtl ? 'disabled' : ''}>${popCtl ? `${icon('refresh', 'ic-sm spin')}AI đang gợi ý…` : '✨ AI gợi ý thêm'}</button>` : ''}
      <form class="dg-pop-add" data-pop-add><input class="input input-sm" placeholder="Tự thêm nhánh… (Enter)" aria-label="Tự thêm nhánh" /></form>`;
    pop.hidden = false;
    // Nút vừa bấm đã bị vẽ lại → giữ phím tắt (Esc) trong khung sơ đồ.
    if (!root.contains(document.activeElement)) root.focus({ preventScroll: true });
    pop._list = list;
    pop._ai = ai;
    // Đặt bảng gợi ý cạnh hình, không tràn khỏi khung vẽ.
    const el = $(`[data-node="${CSS.escape(id)}"]`, svg);
    const cr = canvas.getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    const pw = Math.min(320, cr.width - 16);
    pop.style.width = `${pw}px`;
    let left = r ? r.right - cr.left + 10 : 10;
    if (left + pw > cr.width - 8) left = r ? Math.max(8, r.left - cr.left - pw - 10) : 8;
    if (left < 8 || cr.width < 520) left = Math.max(8, (cr.width - pw) / 2);
    const top = r ? Math.max(8, Math.min(r.top - cr.top, cr.height - pop.offsetHeight - 8)) : 8;
    pop.style.left = `${left}px`;
    pop.style.top = `${Math.max(8, top)}px`;
  }
  pop.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  pop.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    ev.stopPropagation();
    closeIdeas();
    root.focus({ preventScroll: true });
  });
  pop.addEventListener('click', async (ev) => {
    const t = ev.target;
    const n = d.nodes.find((x) => x.id === popFor);
    if (t.closest('[data-pop-x]')) return closeIdeas();
    if (!n) return;
    const ib = t.closest('[data-idea]');
    if (ib) {
      const x = pop._list[+ib.dataset.idea];
      addChild(n, x.label, { kind: x.kind });
      return openIdeas(n.id, { keepAi: true });
    }
    const ab = t.closest('[data-idea-ai]');
    if (ab) {
      const x = pop._ai[+ab.dataset.ideaAi];
      addChild(n, x.label, { kind: 'box' });
      popAi = popAi.filter((y) => y !== x);
      return openIdeas(n.id, { keepAi: true });
    }
    if (t.closest('[data-pop-ai]') && aiIdeas && !popCtl) {
      popCtl = new AbortController();
      const ctl = popCtl;
      openIdeas(n.id, { keepAi: true });
      try {
        const t2 = treeOf(d);
        const path = [];
        for (let id = n.id; id; id = t2.parent.get(id)) path.unshift(d.nodes.find((x) => x.id === id)?.label);
        const children = (t2.children.get(n.id) || []).map((id) => d.nodes.find((x) => x.id === id)?.label);
        const got = await aiIdeas(n, { path, children, signal: ctl.signal });
        if (ctl.signal.aborted) return;
        const seen = new Set([...children, ...popAi.map((x) => x.label)].map((x) => String(x).toLowerCase()));
        popAi = [...popAi, ...got.filter((l) => l && !seen.has(l.toLowerCase())).map((label) => ({ label }))];
        if (!got.length) toast('AI chưa gợi ý được thêm nhánh nào', { type: 'info' });
      } catch (err) {
        if (!ctl.signal.aborted) toast(err.message, { type: 'error', timeout: 5000 });
      }
      if (popCtl === ctl) popCtl = null;
      if (popFor === n.id) openIdeas(n.id, { keepAi: true });
    }
  });
  pop.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const inp = ev.target.querySelector('input');
    const n = d.nodes.find((x) => x.id === popFor);
    const v = inp.value.trim();
    if (!n || !v) return;
    addChild(n, v);
    openIdeas(n.id, { keepAi: true });
    pop.querySelector('[data-pop-add] input')?.focus();
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
  const touches = new Map();
  let pinch = null;
  svg.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    // Chụm / mở 2 ngón để thu phóng (điện thoại, máy tính bảng).
    if (ev.pointerType === 'touch') {
      touches.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinch = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), v: { ...view }, mid: pt({ clientX: (a[0] + b[0]) / 2, clientY: (a[1] + b[1]) / 2 }) };
        drag = null;
        liveStroke = null;
        return;
      }
    }
    const tog = ev.target.closest('[data-toggle]');
    if (tog && mode !== 'pen' && mode !== 'erase') {
      ev.preventDefault();
      const n = d.nodes.find((x) => x.id === tog.dataset.toggle);
      mutate(() => ((n.collapsed = !n.collapsed), relayout()));
      return;
    }
    const idb = ev.target.closest('[data-ideas]');
    if (idb && mode !== 'pen' && mode !== 'erase') {
      ev.preventDefault();
      drawProps();
      return openIdeas(idb.dataset.ideas);
    }
    if (!pop.hidden) closeIdeas();
    const rz = ev.target.closest('[data-resize]');
    if (rz && mode === 'select') {
      const n = d.nodes.find((x) => x.id === rz.dataset.resize);
      const z = nodeSize(n);
      const [x0, y0] = pt(ev);
      drag = { type: 'resize', n, sx: x0, sy: y0, w0: z.w, h0: z.h, cx: n.x, cy: n.y, before: snap(), moved: false };
      svg.setPointerCapture?.(ev.pointerId);
      ev.preventDefault();
      return;
    }
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
    if (ev.pointerType === 'touch' && touches.has(ev.pointerId)) touches.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pinch && touches.size === 2) {
      const [a, b] = [...touches.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      const k = Math.min(Math.max(pinch.dist / dist, 0.05), 20);
      const nw = Math.min(Math.max(pinch.v.w * k, 200), 20000);
      const f = nw / pinch.v.w;
      view = { x: pinch.mid[0] - (pinch.mid[0] - pinch.v.x) * f, y: pinch.mid[1] - (pinch.mid[1] - pinch.v.y) * f, w: nw, h: pinch.v.h * f };
      applyView();
      return;
    }
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
    else if (drag.type === 'resize') {
      const w = Math.max(70, Math.round(drag.w0 + (x - drag.sx)));
      const h = Math.max(36, Math.round(drag.h0 + (y - drag.sy)));
      drag.n.w = w;
      drag.n.h = h;
      // Giữ cạnh trái – trên cố định (tâm dời theo).
      drag.n.x = Math.round(drag.cx + (w - drag.w0) / 2);
      drag.n.y = Math.round(drag.cy + (h - drag.h0) / 2);
      drag.moved = true;
      draw();
    } else if (drag.type === 'node') {
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
  const end = (ev) => {
    if (ev?.pointerType === 'touch') {
      touches.delete(ev.pointerId);
      if (touches.size < 2) pinch = null;
    }
    if (!drag) return;
    const g = drag;
    drag = null;
    if (g.type === 'pen' && liveStroke) {
      const s = { ...liveStroke, points: simplify(liveStroke.points) };
      liveStroke = null;
      mutate(() => d.strokes.push(s));
    } else if (g.type === 'erase') commit(g.before);
    else if (g.type === 'node' && g.moved) commit(g.before);
    else if (g.type === 'resize' && g.moved) {
      relayout();
      commit(g.before);
      draw();
      drawProps();
    }
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
      if (!pop.hidden) closeIdeas();
      ev.preventDefault();
      const [x, y] = pt(ev);
      zoom(ev.deltaY > 0 ? 1.12 : 1 / 1.12, x, y);
    },
    { passive: false },
  );

  /* ---------- Lưu bản có tên, mở bản đã lưu, tệp sơ đồ ---------- */
  const LIB = 'diagram-library';
  const libPanel = $('[data-dg-libp]', root);
  const fileInput = $('[data-dg-file]', root);
  const PRESET_LABEL = { 'tong-hop': 'Sơ đồ tư duy', 'hanh-vi': 'Sơ đồ hành vi', 'quan-he': 'Quan hệ', 'dong-tien': 'Dòng tiền' };
  const clean = () => ({ nodes: d.nodes, edges: d.edges, strokes: d.strokes, layout: d.layout, hideCross: d.hideCross, preset: d.preset });
  const stamp = (t) => new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
  function loadInto(o, what) {
    if (!o || !Array.isArray(o.nodes) || !Array.isArray(o.edges)) return toast('Tệp không phải sơ đồ của phần mềm', { type: 'error' });
    mutate(() => {
      d.nodes = o.nodes.filter((n) => n && n.id).map((n) => ({ ...n }));
      const ids = new Set(d.nodes.map((n) => n.id));
      d.edges = o.edges.filter((e) => e && ids.has(e.from) && ids.has(e.to)).map((e) => ({ ...e }));
      d.strokes = Array.isArray(o.strokes) ? o.strokes : [];
      d.layout = o.layout || d.layout;
      d.hideCross = !!o.hideCross;
    });
    sel = null;
    closeLib();
    drawProps();
    fit();
    toast(`Đã mở ${what} — bấm Hoàn tác nếu muốn quay lại sơ đồ trước`);
  }
  function closeLib() {
    libPanel.hidden = true;
  }
  function openLib() {
    closeIdeas();
    const all = store.get(LIB, []) || [];
    const list = [...all].sort((a, b) => (a.preset === d.preset ? -1 : 0) - (b.preset === d.preset ? -1 : 0) || b.at - a.at);
    const now = new Date();
    libPanel.innerHTML = `<div class="dg-pop-head"><strong>${icon('save', 'ic-sm')} Lưu &amp; mở sơ đồ</strong><button type="button" class="btn btn-ghost btn-sm btn-icon" data-lib-x aria-label="Đóng">${icon('x', 'ic-sm')}</button></div>
      <p class="hint">Sơ đồ đang sửa luôn tự lưu. Lưu thêm bản có tên để giữ các phương án, mở lại bất cứ lúc nào; tải ra tệp để chuyển sang máy khác.</p>
      <form class="dg-lib-save" data-lib-save><input class="input input-sm" name="ten" maxlength="120" aria-label="Tên bản lưu" value="${escapeHtml(`${title} — ${now.toLocaleDateString('vi-VN')} ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`)}" /><button class="btn btn-sm btn-primary" type="submit">${icon('save', 'ic-sm')}Lưu bản này</button></form>
      ${list.length ? `<ul class="dg-lib-list">${list.map((x) => `<li data-lib-id="${escapeHtml(x.id)}"><span><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml(PRESET_LABEL[x.preset] || 'Sơ đồ')} · ${x.diagram?.nodes?.length || 0} hình · ${stamp(x.at)}</small></span><button type="button" class="btn btn-sm" data-lib-open>Mở</button><button type="button" class="btn btn-ghost btn-sm btn-icon" data-lib-del aria-label="Xóa bản lưu">${icon('trash', 'ic-sm')}</button></li>`).join('')}</ul>` : '<p class="hint">Chưa có bản lưu nào.</p>'}
      <div class="dg-actions"><button type="button" class="btn btn-sm btn-ghost" data-lib-export>${icon('download', 'ic-sm')}Tải tệp sơ đồ (.json)</button><button type="button" class="btn btn-sm btn-ghost" data-lib-import>${icon('upload', 'ic-sm')}Mở từ tệp…</button></div>`;
    libPanel.hidden = false;
    const cr = canvas.getBoundingClientRect();
    const pw = Math.min(380, cr.width - 16);
    libPanel.style.width = `${pw}px`;
    libPanel.style.left = `${Math.max(8, cr.width - pw - 12)}px`;
    libPanel.style.top = '8px';
    $('[data-lib-save] input', libPanel)?.select();
  }
  libPanel.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  libPanel.addEventListener('keydown', (ev) => ev.key === 'Escape' && (ev.stopPropagation(), closeLib(), root.focus({ preventScroll: true })));
  libPanel.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = ev.target.querySelector('input').value.trim() || title;
    const all = store.get(LIB, []) || [];
    store.set(LIB, [{ id: uid(), name, preset: d.preset || 'tong-hop', title, at: Date.now(), diagram: JSON.parse(JSON.stringify(clean())) }, ...all].slice(0, 100));
    toast(`Đã lưu bản “${name}”`);
    openLib();
  });
  libPanel.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t.closest('[data-lib-x]')) return closeLib();
    const li = t.closest('[data-lib-id]');
    const all = store.get(LIB, []) || [];
    const item = li && all.find((x) => x.id === li.dataset.libId);
    if (item && t.closest('[data-lib-open]')) return loadInto(item.diagram, `bản “${item.name}”`);
    if (item && t.closest('[data-lib-del]')) {
      store.set(LIB, all.filter((x) => x.id !== item.id));
      toast(`Đã xóa bản “${item.name}”`);
      return openLib();
    }
    if (t.closest('[data-lib-export]')) {
      const blob = new Blob([JSON.stringify({ app: 'tro-ly-van-ban', type: 'so-do', v: 1, title, savedAt: new Date().toISOString(), diagram: clean() }, null, 1)], { type: 'application/json' });
      downloadBlob(blob, `${fileBase()}.json`, 'application/json');
      return toast('Đã tải tệp sơ đồ (.json) — mở lại bằng “Mở từ tệp…”');
    }
    if (t.closest('[data-lib-import]')) fileInput.click();
  });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      loadInto(o.diagram || o, `tệp “${f.name}”`);
    } catch {
      toast('Không đọc được tệp sơ đồ (.json)', { type: 'error' });
    }
  });

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
      mutate(() => layoutDiagram(d));
      return fit();
    }
    if (t.closest('[data-dg-cross]')) {
      mutate(() => (d.hideCross = !d.hideCross));
      return toast(d.hideCross ? 'Đã ẩn quan hệ chéo — chỉ còn các nhánh' : 'Đã hiện quan hệ chéo giữa các nhánh');
    }
    const cb = t.closest('[data-dg-collapse]');
    if (cb) {
      const tr = treeOf(d);
      mutate(() => {
        // Thu gọn: chỉ còn chủ đề và nhánh cấp 1; mở hết: bỏ mọi thu gọn.
        d.nodes.forEach((n) => (n.collapsed = cb.dataset.dgCollapse === 'all' ? (tr.depth.get(n.id) || 0) >= 1 && (tr.children.get(n.id) || []).length > 0 : false));
        if (!isTree() && cb.dataset.dgCollapse === 'all') d.layout = 'mindmap';
        layoutDiagram(d);
      });
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
    if (t.closest('[data-dg-lib]')) return libPanel.hidden ? openLib() : closeLib();
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
    if (ev.target.matches('[data-dg-lmode]')) {
      mutate(() => ((d.layout = ev.target.value), layoutDiagram(d)));
      fit();
      return toast(`Đã chuyển sang kiểu “${LAYOUTS[d.layout]}”`);
    }
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
    const cur = sel?.type === 'node' ? d.nodes.find((x) => x.id === sel.id) : null;
    if (cur && (ev.key === 'Tab' || ev.key === 'Enter' || ev.key === 'F2')) {
      ev.preventDefault();
      if (ev.key === 'F2') return drawProps(true);
      return addChild(cur, '', { edit: true, sibling: ev.key === 'Enter' && cur.kind !== 'root' });
    }
    if (k === 'escape') {
      if (!pop.hidden) return closeIdeas();
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
    /** Làm nổi các nút có nhãn trùng tên (bỏ trống để tắt); trả về số nút tìm thấy. */
    highlight(names = []) {
      const k = (x) => String(x || '').normalize('NFC').toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
      const want = new Set(names.map(k));
      hl = new Set(d.nodes.filter((n) => want.has(k(n.label))).map((n) => n.id));
      $$('.dg-node.hl', svg).forEach((x) => x.classList.remove('hl'));
      hl.forEach((id) => $(`[data-node="${CSS.escape(id)}"]`, svg)?.classList.add('hl'));
      const first = d.nodes.find((n) => hl.has(n.id));
      if (first) ensureVisible(first);
      return hl.size;
    },
    destroy() {
      rzH.destroy();
      rzW.destroy();
      popCtl?.abort();
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement === root) document.exitFullscreen?.();
      document.body.classList.remove('dg-lock');
      ro?.disconnect();
      detachSg.forEach((f) => f());
    },
  };
}

