// Hiển thị VÌ SAO một điều luật được chọn: độ chắc chắn, từng yếu tố cấu thành (đã có — kèm câu trích; còn thiếu — kèm câu
// cần hỏi), cách phân biệt với điều gần nghĩa. Dùng chung cho Sơ đồ vụ việc, Phân tích lời khai, phân tích vụ án.
import { icon, escapeHtml } from '../ui.js';

const MUC = {
  cao: ['Độ chắc chắn cao', 'cao'],
  vua: ['Độ chắc chắn vừa', 'vua'],
  thap: ['Theo viện dẫn / điều đang xét', 'thap'],
  gan: ['Chưa đủ yếu tố — cần làm rõ', 'gan'],
};

export function lawBadge(can) {
  if (!can) return '';
  if (can.nguon === 'tu-khoa') return '<span class="lr-badge lr-kw" title="Điều này chưa có bộ nhận diện chi tiết: chỉ khớp từ khóa, cần kiểm tra kỹ">Khớp từ khóa — kiểm tra kỹ</span>';
  const [t, k] = MUC[can.muc] || MUC.thap;
  return `<span class="lr-badge lr-${k}">${can.ai ? 'AI xác định · ' : ''}${t}</span>`;
}

/** Danh sách yếu tố cấu thành: ✓ có (kèm trích), ✗ chưa có (kèm câu cần hỏi). */
export function lawElementsHtml(can) {
  const els = can?.yeuTo || [];
  if (!els.length) return '';
  return `<ul class="lr-el">${els
    .map((y) => (y.ok ? `<li class="ok"><span class="lr-ic" aria-label="Đã có">✓</span><span><b>${escapeHtml(y.label)}</b>${y.quote ? `<q>${escapeHtml(y.quote.length > 230 ? `${y.quote.slice(0, 228)}…` : y.quote)}</q>` : ''}</span></li>` : `<li class="no"><span class="lr-ic" aria-label="Chưa có">✗</span><span><b>${escapeHtml(y.label)}</b><small>${y.req ? 'bắt buộc — ' : ''}chưa có trong lời khai${y.hoi ? ` · cần hỏi: ${escapeHtml(y.hoi)}` : ''}</small></span></li>`))
    .join('')}</ul>`;
}

/** Một điều luật + lý do. c: { dieu, ten, can, canCu }. */
export function lawReasonHtml(c, { open = false } = {}) {
  const can = c.can || null;
  const hasEl = (can?.yeuTo || []).length > 0;
  return `<li class="lr"><div class="lr-h"><strong>${c.dieu ? `Điều ${escapeHtml(c.dieu)}` : 'Chưa xác định điều luật'}</strong> <span>${escapeHtml(String(c.ten || '').replace(/^Tội /, ''))}</span> ${lawBadge(can)}</div>${c.canCu ? `<p class="lr-why">${icon('info', 'ic-sm')}${escapeHtml(c.canCu)}</p>` : ''}${hasEl || can?.vs ? `<details class="lr-more" ${open ? 'open' : ''}><summary>Căn cứ chọn điều này — ${(can?.yeuTo || []).filter((y) => y.ok).length}/${(can?.yeuTo || []).length} yếu tố cấu thành</summary>${lawElementsHtml(can)}${can?.vs ? `<p class="lr-vs"><b>Phân biệt:</b> ${escapeHtml(can.vs)}</p>` : ''}</details>` : ''}</li>`;
}
