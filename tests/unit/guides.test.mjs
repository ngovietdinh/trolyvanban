import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDES, GROUPS, findGuide, guideForRoute, visibleGuides, searchGuides, inline } from '../../assets/js/guide/guides.js';

const ROUTES = ['dashboard', 'compose', 'legal', 'interview', 'cases', 'forms', 'kho', 'chat', 'spell', 'summary', 'number', 'templates', 'tpl', 'docs', 'admin', 'settings', 'theo-doi', 'so-do'];

test('mỗi màn hình đều có hướng dẫn theo ngữ cảnh', () => {
  for (const r of ROUTES) assert.ok(guideForRoute(r), `thiếu hướng dẫn cho #${r}`);
});

test('cấu trúc hướng dẫn hợp lệ', () => {
  const ids = new Set();
  for (const g of GUIDES) {
    assert.ok(!ids.has(g.id), `trùng id ${g.id}`);
    ids.add(g.id);
    assert.ok(GROUPS.some((x) => x.id === g.group), `${g.id}: nhóm không hợp lệ`);
    assert.ok(g.title && g.summary && g.time, `${g.id}: thiếu tiêu đề/tóm tắt/thời lượng`);
    assert.ok(g.steps.length >= 2, `${g.id}: cần ít nhất 2 bước`);
    for (const s of g.steps) assert.ok(s.t && s.d, `${g.id}: bước thiếu nội dung`);
    for (const e of g.examples) {
      assert.ok(e.title && e.text, `${g.id}: ví dụ thiếu nội dung`);
      if (e.fill) assert.ok(['#kho', '#chat', '#spell'].includes(e.fill), `${g.id}: “Thử ngay” chỉ dùng cho màn hình có ô nhập`);
    }
    for (const r of g.related || []) assert.ok(findGuide(r), `${g.id}: liên kết tới hướng dẫn không tồn tại ${r}`);
    assert.ok(/^#[a-z-]+$/.test(g.route), `${g.id}: route không hợp lệ`);
  }
});

test('ẩn hướng dẫn tố tụng khi không có quyền', () => {
  const can = (p) => p !== 'legal' && p !== 'users';
  const v = visibleGuides(can).map((g) => g.id);
  assert.ok(v.includes('compose'));
  assert.ok(!v.includes('kho') && !v.includes('interview') && !v.includes('quytrinh') && !v.includes('admin'));
});

test('tìm hướng dẫn không dấu, ưu tiên tiêu đề', () => {
  assert.equal(searchGuides('kho ho so')[0].id, 'kho');
  assert.ok(searchGuides('mau thuan').some((g) => g.id === 'interview'));
  assert.equal(searchGuides('xyzabc').length, 0);
  assert.equal(searchGuides('').length, GUIDES.length);
});

test('định dạng nội dung: đậm, nhãn nút, phím tắt', () => {
  const h = inline('Bấm **ngay** [[Xuất Word]] hoặc `Ctrl Enter`');
  assert.match(h, /<strong>ngay<\/strong>/);
  assert.match(h, /<span class="ui-label">Xuất Word<\/span>/);
  assert.match(h, /<kbd class="kbd">Ctrl<\/kbd> <kbd class="kbd">Enter<\/kbd>/);
});
