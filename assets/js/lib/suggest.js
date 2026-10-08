// Gợi ý đầu mục khi nhập / chỉnh sửa: hàng gợi ý hiện ngay dưới ô đang nhập, nội dung gợi ý dựa vào chữ đang gõ
// và ngữ cảnh (điều luật, dấu hiệu định tội, hành vi, người liên quan, số tiền…). Bấm gợi ý để chèn — người dùng
// vẫn tự sửa tùy ý. Dùng chung cho câu hỏi, lời khai, tóm tắt, yêu cầu AI, nhãn sơ đồ.
import { escapeHtml } from '../ui.js';

const key = (s) => String(s || '').normalize('NFC').toLocaleLowerCase('vi-VN');
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const short = (s, n = 70) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s).replace(/[.;]$/, '');

/** Gợi ý cho câu hỏi: mở đầu (ô trống), phần đuôi bổ sung đầu mục còn thiếu, câu hỏi theo dấu hiệu / hành vi / người. */
export function questionSuggestions(text, ctx = {}) {
  const t = key(text);
  const out = [];
  if (!t.trim()) {
    out.push(
      { label: 'Trình bày cụ thể…', insert: 'Anh/chị trình bày cụ thể ' },
      { label: 'Thời gian, địa điểm…', insert: 'Việc này diễn ra vào thời gian nào, ở đâu cụ thể; ' },
      { label: 'Ai là người…', insert: 'Ai là người ' },
      { label: 'Căn cứ, tài liệu…', insert: 'Căn cứ, tài liệu nào thể hiện ' },
      { label: 'Tiền, tài sản…', insert: 'Khoản tiền ' },
    );
  } else {
    const ends = [
      [/thời gian|khi nào|ngày/, 'thời gian, địa điểm cụ thể'],
      [/ai |những ai|người nào|chứng kiến/, 'những ai có mặt, chứng kiến'],
      [/cách thức|như thế nào|thế nào|trình tự/, 'cách thức thực hiện theo trình tự'],
      [/tài liệu|chứng từ|căn cứ/, 'căn cứ, tài liệu nào thể hiện; hiện ai lưu giữ'],
      [/mục đích|động cơ|hưởng lợi/, 'mục đích, động cơ; ai được hưởng lợi'],
      [/tiền|tài sản|giá trị/, 'số tiền, hình thức giao nhận (tiền mặt hay chuyển khoản)'],
      [/vì sao|tại sao|lý do/, 'vì sao lại làm như vậy'],
    ];
    ends.filter(([re]) => !re.test(t)).slice(0, 5).forEach(([, e]) => out.push({ label: `+ ${e}`, append: e }));
  }
  (ctx.people || []).slice(0, 3).forEach((p) => !t.includes(key(p)) && out.push({ label: `Vai trò của ${p}`, insert: `${p} có vai trò gì trong sự việc; anh/chị biết ${p} trong hoàn cảnh nào?` }));
  (ctx.signs || []).slice(0, 3).forEach((s) => out.push({ label: `Dấu hiệu: ${short(s, 48)}`, insert: `Làm rõ ${lc(short(s, 160))}: anh/chị trình bày cụ thể, căn cứ vào đâu?` }));
  (ctx.acts || []).slice(0, 2).forEach((a) => out.push({ label: `Hành vi: ${short(a, 44)}`, insert: `Về việc “${lc(a)}”: ` }));
  return out.slice(0, 10);
}

/** Gợi ý đầu mục cho đoạn tóm tắt, ghi chú, báo cáo: các mục thường có của một vụ việc, chưa xuất hiện trong nội dung. */
export function headingSuggestions(text, ctx = {}) {
  const t = key(text);
  const heads = ['Thời gian, địa điểm', 'Người liên quan', 'Hành vi', 'Thủ đoạn, cách thức', 'Hậu quả, thiệt hại', 'Số tiền, tài sản', 'Tài liệu, chứng cứ', 'Điều luật áp dụng', 'Việc cần làm tiếp'];
  const out = heads.filter((h) => !t.includes(key(h).split(',')[0])).map((h) => ({ label: h, line: `${h}: ` }));
  (ctx.people || []).slice(0, 4).forEach((p) => !t.includes(key(p)) && out.push({ label: p, insert: `${p} ` }));
  return out.slice(0, 10);
}

/** Gợi ý cho yêu cầu gửi AI làm tiếp (phân tích, sơ đồ, kết luận). */
export function aiRequestSuggestions(text, ctx = {}) {
  const base = [
    'Bổ sung các quan hệ, dòng tiền còn thiếu',
    'Làm rõ vai trò từng người',
    'Bổ sung mốc thời gian theo trình tự',
    'Kiểm tra lại điều luật, dấu hiệu định tội áp dụng',
    'Rút gọn bản chất vụ việc còn 5 ý chính',
    'Chỉ ra mâu thuẫn, điểm chưa rõ',
    'Đề xuất câu hỏi để làm rõ tiếp',
    ...(ctx.extra || []),
  ];
  const t = key(text);
  const out = base.filter((b) => !t.includes(key(b).slice(0, 14))).map((b) => ({ label: b, insert: `${b}. ` }));
  (ctx.people || []).slice(0, 3).forEach((p) => out.push({ label: `Tập trung vào ${p}`, insert: `Tập trung làm rõ hành vi, vai trò của ${p}. ` }));
  return out.slice(0, 10);
}

/**
 * Gắn hàng gợi ý cho một ô nhập. provider(text) → [{ label, insert | append | line }].
 * - insert: chèn tại con trỏ (ô trống thì thay toàn bộ);
 * - append: nối vào cuối câu (trước dấu “?” nếu có);
 * - line: thêm một dòng mới bắt đầu bằng đầu mục.
 * Trả về hàm gỡ.
 */
export function attachSuggest(el, provider, { onChange } = {}) {
  if (!el || el.dataset.sgOn) return () => {};
  el.dataset.sgOn = '1';
  const row = document.createElement('div');
  row.className = 'sg-row';
  row.hidden = true;
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Gợi ý nội dung');
  el.after(row);
  let items = [];
  const draw = () => {
    items = provider(el.value) || [];
    row.innerHTML = items.length ? `<span class="sg-k">Gợi ý</span>${items.map((x, i) => `<button type="button" class="sg-chip" data-sg="${i}" tabindex="-1">${escapeHtml(x.label)}</button>`).join('')}` : '';
    row.hidden = !items.length;
  };
  const apply = (x) => {
    const v = el.value;
    const pos = el.selectionStart ?? v.length;
    if (x.append) {
      const body = v.replace(/[\s?.;:]+$/, '');
      el.value = `${body}${body ? (/[,;:]$/.test(body) ? ' ' : '; ') : ''}${x.append}?`;
    } else if (x.line) {
      el.value = `${v.replace(/\s+$/, '')}${v.trim() ? '\n' : ''}${x.line}`;
    } else if (!v.trim()) el.value = x.insert;
    else el.value = v.slice(0, pos) + x.insert + v.slice(pos);
    el.focus();
    const end = x.insert && v.trim() && !x.append && !x.line ? pos + x.insert.length : el.value.length;
    el.setSelectionRange?.(end, end);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    onChange?.(el.value);
  };
  // mousedown: giữ con trỏ trong ô khi bấm gợi ý.
  row.addEventListener('mousedown', (e) => e.preventDefault());
  row.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sg]');
    if (b) apply(items[+b.dataset.sg]);
  });
  let timer;
  const onInput = () => {
    clearTimeout(timer);
    timer = setTimeout(draw, 150);
  };
  const onFocus = () => draw();
  const onBlur = () => setTimeout(() => (row.hidden = true), 120);
  el.addEventListener('input', onInput);
  el.addEventListener('focus', onFocus);
  el.addEventListener('blur', onBlur);
  if (document.activeElement === el) draw();
  return () => {
    el.removeEventListener('input', onInput);
    el.removeEventListener('focus', onFocus);
    el.removeEventListener('blur', onBlur);
    row.remove();
    delete el.dataset.sgOn;
  };
}
