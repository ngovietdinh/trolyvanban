import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan } from '../../assets/js/legal/engine.js';
import { newOverlay, applyPlanOverlay, pickQuestions, unpickQuestion, toPickMode } from '../../assets/js/legal/plan-overlay.js';
import { questionSuggestions, headingSuggestions, aiRequestSuggestions } from '../../assets/js/lib/suggest.js';
import { buildCaseMap, mergeAiCaseMap, caseMapToAiJson, caseMapRefinePrompt, relevantText } from '../../assets/js/legal/case-map.js';
import { diagramFromCaseMap, syncFromCaseMap, autoLayout, nodeSize, wrap, simplify, strokeAt, diagramToSvg, bounds, labelSuggestions, emptyDiagram } from '../../assets/js/legal/diagram.js';
import { aiItems, analyzeRefinePrompt } from '../../assets/js/legal/analyze.js';

let n = 0;
const uid = () => `t${++n}`;
const plan = () => generatePlan({ dieu: '353', roleId: 'bi-can', hanhViIds: [] });

test('chế độ chọn: câu hỏi sinh ra chỉ là gợi ý, bấm Thêm mới vào kế hoạch', () => {
  const o = newOverlay();
  const p = applyPlanOverlay(plan(), o, { uid });
  assert.equal(p.stats.questions, 0);
  assert.ok(p.stats.suggestions > 20);
  const is = p.issues.find((i) => i.key === 'dong-pham');
  const two = is.goiY.slice(0, 2).map((c) => c.origin);
  pickQuestions(o, 'dong-pham', two);
  const p2 = applyPlanOverlay(plan(), o, { uid });
  const is2 = p2.issues.find((i) => i.key === 'dong-pham');
  assert.deepEqual(is2.cauHoi.map((c) => c.origin), two);
  assert.equal(is2.goiY.length, is.goiY.length - 2);
  assert.equal(p2.stats.questions, 2);
  // Bỏ ra → về lại gợi ý.
  unpickQuestion(o, 'dong-pham', two[0]);
  assert.equal(applyPlanOverlay(plan(), o, { uid }).issues.find((i) => i.key === 'dong-pham').cauHoi.length, 1);
});

test('chế độ chọn: câu tự thêm luôn trong kế hoạch, câu sửa giữ văn bản mới, câu bỏ không còn trong gợi ý', () => {
  const o = newOverlay();
  const base = applyPlanOverlay(plan(), newOverlay(), { uid });
  const [a, b] = base.issues.find((i) => i.key === 'dong-pham').goiY;
  o.added['dong-pham'] = ['Ai giữ sổ quỹ?'];
  o.edited[a.origin] = 'Câu đã sửa?';
  o.removed.push(b.origin);
  pickQuestions(o, 'dong-pham', [a.origin]);
  const is = applyPlanOverlay(plan(), o, { uid }).issues.find((i) => i.key === 'dong-pham');
  assert.deepEqual(is.cauHoi.map((c) => c.text), ['Câu đã sửa?', 'Ai giữ sổ quỹ?']);
  assert.ok(!is.goiY.some((c) => c.origin === b.origin));
});

test('kế hoạch cũ (không có mode) giữ mọi câu; chuyển sang chế độ chọn không mất câu nào', () => {
  const legacy = { removed: [], edited: {}, added: {}, ai: {} };
  const p = applyPlanOverlay(plan(), legacy, { uid });
  assert.equal(p.stats.suggestions, 0);
  const total = p.stats.questions;
  toPickMode(legacy, p);
  assert.equal(applyPlanOverlay(plan(), legacy, { uid }).stats.questions, total);
});

test('gợi ý đầu mục: câu hỏi, đoạn tóm tắt, yêu cầu AI', () => {
  const empty = questionSuggestions('', { people: ['Trần Văn Bình'], signs: ['Lợi dụng chức vụ, quyền hạn'] });
  assert.ok(empty.some((x) => /Trình bày/.test(x.label)));
  assert.ok(empty.some((x) => /Trần Văn Bình/.test(x.label)));
  assert.ok(empty.some((x) => /Dấu hiệu/.test(x.label)));
  const tail = questionSuggestions('Anh nhận tiền khi nào', {});
  assert.ok(tail.every((x) => !/thời gian, địa điểm cụ thể/.test(x.append || '')), 'không gợi ý lại đầu mục đã có');
  assert.ok(tail.some((x) => x.append));
  const h = headingSuggestions('Thời gian, địa điểm: 5/3/2025', {});
  assert.ok(!h.some((x) => x.label === 'Thời gian, địa điểm'));
  assert.ok(h.some((x) => x.line === 'Hậu quả, thiệt hại: '));
  const r = aiRequestSuggestions('', { people: ['Lê Thị Cúc'] });
  assert.ok(r.some((x) => /Lê Thị Cúc/.test(x.label)));
});

const SRC = [{ label: 'BB An', speaker: 'Nguyễn Văn An', text: 'Ngày 05/3/2025 tôi lập chứng từ chi khống để rút tiền chiếm đoạt 300 triệu đồng.\nSau đó tôi chuyển cho ông Trần Văn Bình 100 triệu đồng.\nÔng Bình chỉ đạo tôi lập hồ sơ quyết toán.' }];

test('AI làm tiếp sơ đồ: gửi sơ đồ hiện tại + yêu cầu, kết quả thay thế hoàn toàn', () => {
  const m = buildCaseMap({ sources: SRC, primary: '353' });
  const j = caseMapToAiJson(m);
  assert.ok(j.nguoi.some((p) => /Bình/.test(p.ten)));
  const prompt = caseMapRefinePrompt(m, 'Bổ sung bà Cúc thủ quỹ', { source: SRC[0].text });
  assert.match(prompt, /SƠ ĐỒ VỤ VIỆC HIỆN TẠI/);
  assert.match(prompt, /Bổ sung bà Cúc thủ quỹ/);
  assert.match(prompt, /TOÀN BỘ sơ đồ/);
  const next = mergeAiCaseMap(m, JSON.stringify({ tomTat: 'Mới', banChat: ['A'], nguoi: [{ ten: 'Nguyễn Văn An', vaiTro: 'Kế toán' }, { ten: 'Lê Thị Cúc', vaiTro: 'Thủ quỹ' }], hanhVi: [{ ten: 'Lập chứng từ chi khống', dieu: '353', nguoi: ['Nguyễn Văn An'] }], quanHe: [{ tu: 'Nguyễn Văn An', den: 'Lê Thị Cúc', loai: 'tien', noiDung: 'đưa', soTien: '20 triệu' }], moc: [], ghiChu: 'Thêm bà Cúc' }), { replace: true });
  assert.equal(next.tomTat, 'Mới');
  assert.equal(next.note, 'Thêm bà Cúc');
  assert.ok(!next.people.some((p) => /Bình/.test(p.ten)), 'người AI bỏ thì bỏ');
  assert.ok(next.people.some((p) => p.ten === 'Lê Thị Cúc'));
  assert.equal(next.edges.length, 1);
  assert.equal(next.timeline.length, 0);
});

test('đoạn tài liệu gửi kèm ưu tiên câu liên quan tới yêu cầu, giữ thứ tự gốc', () => {
  const filler = Array.from({ length: 200 }, (_, i) => `Câu thứ ${i} nói về việc khác không liên quan.`).join(' ');
  const full = `${filler} Bà Cúc thủ quỹ nhận 20 triệu đồng. ${filler}`;
  const out = relevantText(full, 'làm rõ bà Cúc thủ quỹ', 800);
  assert.ok(out.length <= 800);
  assert.match(out, /Bà Cúc thủ quỹ nhận 20 triệu/);
  assert.equal(relevantText('ngắn', 'x', 100), 'ngắn');
});

test('sơ đồ tùy chỉnh: dựng từ sơ đồ vụ việc, bố cục theo tầng, không chồng nút', () => {
  const m = buildCaseMap({ sources: SRC, primary: '353' });
  const d = diagramFromCaseMap(m, { layout: 'tang' });
  assert.ok(d.nodes.some((x) => x.kind === 'crime' && x.label === 'Điều 353'));
  assert.ok(d.nodes.some((x) => x.kind === 'person'));
  assert.ok(d.edges.some((e) => e.kind === 'thuoc'));
  const crimeY = d.nodes.find((x) => x.kind === 'crime').y;
  const personY = d.nodes.find((x) => x.kind === 'person').y;
  assert.ok(crimeY < personY, 'điều luật ở trên, người ở dưới');
  for (const a of d.nodes)
    for (const b of d.nodes) {
      if (a === b || a.y !== b.y) continue;
      assert.ok(Math.abs(a.x - b.x) >= (nodeSize(a).w + nodeSize(b).w) / 2, `${a.label} chồng ${b.label}`);
    }
  const svg = diagramToSvg(d, { title: 'Vụ A' });
  assert.match(svg, /^<svg xmlns/);
  assert.match(svg, /Điều 353/);
  assert.match(svg, /Vụ A/);
});

test('cập nhật từ sơ đồ vụ việc mới: giữ vị trí, nhãn đã sửa, nút / mũi tên / nét vẽ tự thêm', () => {
  const m = buildCaseMap({ sources: SRC, primary: '353' });
  const d = diagramFromCaseMap(m, { layout: 'tang' });
  const crime = d.nodes.find((x) => x.kind === 'crime');
  crime.x = 999;
  crime.label = 'Điều 353 (sửa)';
  crime.edited = true;
  d.nodes.push({ id: 'u1', kind: 'note', label: 'Ghi chú của tôi', x: 10, y: 10, origin: 'user' });
  d.edges.push({ id: 'ue', from: 'u1', to: crime.id, label: 'xem', kind: 'khac', origin: 'user' });
  d.strokes.push({ id: 's1', color: '#c0392b', width: 3, points: [[0, 0], [10, 10]] });
  const m2 = mergeAiCaseMap(m, { nguoi: [...m.people.map((p) => ({ ten: p.ten, vaiTro: p.vaiTro })), { ten: 'Lê Thị Cúc', vaiTro: 'Thủ quỹ' }], hanhVi: caseMapToAiJson(m).hanhVi, quanHe: caseMapToAiJson(m).quanHe, moc: [] }, { replace: true });
  const d2 = syncFromCaseMap(d, m2);
  const c2 = d2.nodes.find((x) => x.id === crime.id);
  assert.equal(c2.x, 999);
  assert.equal(c2.label, 'Điều 353 (sửa)');
  assert.ok(d2.nodes.some((x) => x.id === 'u1'));
  assert.ok(d2.edges.some((x) => x.id === 'ue'));
  assert.equal(d2.strokes.length, 1);
  const cuc = d2.nodes.find((x) => x.label === 'Lê Thị Cúc');
  assert.ok(cuc && Number.isFinite(cuc.x) && Number.isFinite(cuc.y), 'nút mới được đặt vị trí');
});

test('nét vẽ: rút gọn điểm, tẩy trúng nét; khung bao; ngắt dòng nhãn', () => {
  const pts = Array.from({ length: 50 }, (_, i) => [i * 0.5, 0]);
  const s = simplify(pts);
  assert.ok(s.length < pts.length && s.length >= 2);
  const d = { ...emptyDiagram(), strokes: [{ id: 's', color: '#000', width: 3, points: [[0, 0], [100, 0]] }] };
  assert.equal(strokeAt(d, 50, 4)?.id, 's');
  assert.equal(strokeAt(d, 50, 40), null);
  assert.ok(bounds(d).w >= 100);
  assert.deepEqual(wrap('một hai ba bốn năm sáu bảy tám chín mười', 10), ['một hai ba', 'bốn năm', 'sáu bảy', 'tám chín…']);
  const big = autoLayout({ ...emptyDiagram(), nodes: [{ id: 'a', kind: 'note', label: 'x' }, { id: 'b', kind: 'crime', label: 'y' }], edges: [] });
  assert.ok(big.nodes.find((x) => x.id === 'b').y < big.nodes.find((x) => x.id === 'a').y);
});

test('gợi ý nhãn nút / mũi tên theo sơ đồ vụ việc', () => {
  const m = buildCaseMap({ sources: SRC, primary: '353' });
  const node = labelSuggestions('', { kind: 'node', map: m, d: emptyDiagram() });
  assert.ok(node.some((x) => /Bình/.test(x.label)));
  const edge = labelSuggestions('', { kind: 'edge', map: m });
  assert.ok(edge.some((x) => x.label === 'đưa tiền'));
});

test('AI làm tiếp danh sách hành vi: lời nhắc có hành vi đang có và yêu cầu; hành vi AI kiểm tra với Bộ luật', () => {
  const p = analyzeRefinePrompt('Tài liệu A', 'Tìm thêm hành vi lập khống', { primary: '353', candidates: ['353'], role: 'bị can', current: [{ dieu: '353', ten: 'Rút tiền', trich: 'rút 300 triệu' }] });
  assert.match(p, /CÁC HÀNH VI ĐÃ XÁC ĐỊNH/);
  assert.match(p, /\[Điều 353\] Rút tiền/);
  assert.match(p, /Tìm thêm hành vi lập khống/);
  const items = aiItems([{ ten: 'Lập chứng từ khống', dieu: 'Điều 353' }, { ten: 'Việc lạ', dieu: '9999' }], '353');
  assert.equal(items[0].dieu, '353');
  assert.equal(items[0].checked, true);
  assert.equal(items[1].ngoaiDanhMuc, true);
});

test('v2.25 sơ đồ tư duy: chủ đề trung tâm → điều luật → hành vi → người; quan hệ tiền là liên kết chéo; không chồng hình', async () => {
  const { treeOf, mindmapLayout, nodeIdeas, hiddenSet, nodeSize: ns } = await import('../../assets/js/legal/diagram.js');
  const { findCrime } = await import('../../assets/js/legal/engine.js');
  const m = buildCaseMap({ sources: SRC, primary: '353' });
  const d = diagramFromCaseMap(m, { title: 'Vụ A' });
  assert.equal(d.layout, 'mindmap');
  const root = d.nodes.find((n) => n.kind === 'root');
  assert.equal(root.label, 'Vụ A');
  const t = treeOf(d);
  assert.equal(t.roots[0], root.id);
  const crime = d.nodes.find((n) => n.kind === 'crime');
  assert.equal(t.parent.get(crime.id), root.id);
  const act = d.nodes.find((n) => n.kind === 'act');
  assert.equal(t.parent.get(act.id), crime.id);
  const money = d.edges.find((e) => e.kind === 'tien');
  if (money) assert.ok(!t.treeEdges.has(money.id) || t.parent.get(money.to) === money.from || t.parent.get(money.from) === money.to);
  // Không chồng nhau.
  for (const a of d.nodes)
    for (const b of d.nodes) {
      if (a === b) continue;
      const za = ns(a);
      const zb = ns(b);
      const overlap = Math.abs(a.x - b.x) < (za.w + zb.w) / 2 && Math.abs(a.y - b.y) < (za.h + zb.h) / 2;
      assert.ok(!overlap, `${a.label} chồng ${b.label}`);
    }
  // Hai bên chủ đề đều có nhánh khi có từ 2 nhánh cấp 1 trở lên.
  const first = t.children.get(root.id).map((id) => d.nodes.find((n) => n.id === id));
  if (first.length >= 2) assert.ok(first.some((n) => n.x > root.x) && first.some((n) => n.x < root.x));
  // Thu gọn nhánh điều luật → ẩn hành vi bên dưới.
  crime.collapsed = true;
  mindmapLayout(d);
  assert.ok(hiddenSet(d).has(act.id));
  // Gợi ý trên hình: điều luật có dấu hiệu định tội, hành vi có đầu mục điều tra.
  const ci = nodeIdeas(crime, d, { map: m, crimeOf: findCrime });
  assert.ok(ci.some((x) => x.label.startsWith('Dấu hiệu:')));
  const ai = nodeIdeas(act, d, { map: m });
  assert.ok(ai.some((x) => x.label === 'Thời gian, địa điểm'));
  // Kích thước kéo tay, cỡ chữ.
  const z0 = ns(act);
  const big = ns({ ...act, w: z0.w + 120, fs: 1.45 });
  assert.equal(big.w, z0.w + 120);
  assert.ok(big.lh > z0.lh);
});

test('v2.26 sơ đồ hành vi, quan hệ, dòng tiền: dựng sẵn từ phân tích, bố cục riêng', async () => {
  const { moneyValue, formatMoney, PRESETS, isTreeLayout, nodeSize: ns } = await import('../../assets/js/legal/diagram.js');
  const m = buildCaseMap({ sources: SRC, primary: '353' });
  const hv = diagramFromCaseMap(m, { title: 'Vụ A', preset: 'hanh-vi' });
  assert.equal(hv.layout, 'cay');
  assert.equal(hv.preset, 'hanh-vi');
  assert.ok(hv.nodes.some((n) => n.kind === 'act'));
  assert.ok(!hv.edges.some((e) => e.kind === 'tien'), 'sơ đồ hành vi không có quan hệ tiền');
  const qh = diagramFromCaseMap(m, { preset: 'quan-he' });
  assert.equal(qh.layout, 'vong');
  assert.ok(qh.nodes.every((n) => n.kind === 'person'));
  assert.ok(qh.edges.length >= 1);
  const dt = diagramFromCaseMap(m, { preset: 'dong-tien' });
  assert.equal(dt.layout, 'dong');
  assert.ok(dt.edges.every((e) => e.kind === 'tien'));
  const giver = dt.nodes.find((n) => dt.edges.some((e) => e.from === n.id));
  const taker = dt.nodes.find((n) => dt.edges.some((e) => e.to === n.id));
  assert.ok(giver.x < taker.x, 'dòng tiền chảy trái → phải');
  assert.ok(!/Nhận|Đưa/.test(taker.sub || ''), 'không ghi tổng tiền tự cộng lên hình');
  for (const d of [qh, dt])
    for (const a of d.nodes)
      for (const b of d.nodes) {
        if (a === b) continue;
        assert.ok(!(Math.abs(a.x - b.x) < (ns(a).w + ns(b).w) / 2 && Math.abs(a.y - b.y) < (ns(a).h + ns(b).h) / 2), `${a.label} chồng ${b.label}`);
      }
  // Cập nhật theo phân tích mới vẫn đúng loại sơ đồ.
  const again = syncFromCaseMap(dt, m);
  assert.ok(again.edges.every((e) => e.kind === 'tien'));
  assert.equal(moneyValue('1,5 tỷ đồng'), 1.5e9);
  assert.equal(moneyValue('20.000.000 đồng'), 2e7);
  assert.equal(formatMoney(2.5e8), '250 triệu');
  assert.equal(Object.keys(PRESETS).length, 4);
  assert.equal(isTreeLayout('vong'), false);
});
