// Sơ đồ vụ việc: chọn biên bản lời khai hoặc tải tài liệu → xem nhanh bản chất vụ việc, sơ đồ cây hành vi
// theo điều luật, sơ đồ quan hệ – dòng tiền giữa các người, dòng thời gian; xuất Word.
import { $, $$, icon, toast, escapeHtml, downloadBlob } from '../ui.js';
import { casesRepo, recordsRepo } from '../legal/repo.js';
import { getRole } from '../legal/roles.js';
import { buildCaseMap, caseMapPrompt, mergeAiCaseMap, caseMapToTree, CASE_MAP_SYSTEM } from '../legal/case-map.js';
import { streamClaude } from '../lib/ai.js';
import { buildDocx, safeFileName } from '../lib/docx.js';
import { renderDocumentHtml } from '../lib/render-html.js';
import { store } from '../lib/store.js';
import { mountTree } from './plan-tree.js';
import { dropzoneHtml, bindDropzone, readAll } from './acts-review.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const LOAI = { tien: 'Tiền, tài sản', 'chi-dao': 'Chỉ đạo, yêu cầu', khac: 'Quan hệ khác' };
const vnDate = (d) => (d ? String(d).split('-').reverse().join('/') : '');

/* ---------------- Sơ đồ quan hệ – dòng tiền (SVG) ---------------- */
export function relationSvg(m, { narrow = false } = {}) {
  const people = m.people.filter((p) => m.edges.some((e) => e.tu === p.ten || e.den === p.ten));
  if (!people.length) return '';
  // Màn hình hẹp: khung vẽ hẹp hơn để chữ không bị thu nhỏ quá mức.
  const W = narrow ? 420 : 860;
  const H = narrow ? (people.length <= 2 ? 260 : people.length <= 4 ? 460 : 560) : people.length <= 2 ? 300 : people.length <= 4 ? 420 : 520;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W * 0.36, H * 0.36);
  const pos = new Map(people.map((p, i) => {
    const a = people.length === 1 ? 0 : -Math.PI / 2 + (i * 2 * Math.PI) / people.length;
    return [p.ten, { x: people.length === 2 ? cx + (i ? 1 : -1) * W * 0.3 : cx + Math.min(R * 1.25, W / 2 - 82) * Math.cos(a), y: people.length === 2 ? cy : cy + R * Math.sin(a), p }];
  }));
  const pairN = new Map();
  const edges = m.edges
    .filter((e) => pos.has(e.tu) && pos.has(e.den) && e.tu !== e.den)
    .map((e, i) => {
      const a = pos.get(e.tu);
      const b = pos.get(e.den);
      const k = [e.tu, e.den].sort().join('|');
      const nth = pairN.get(k) || 0;
      pairN.set(k, nth + 1);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      // Lùi điểm đầu/cuối ra ngoài khung tên; nhiều cạnh cùng cặp thì cong khác nhau.
      const pad = 62;
      const sx = a.x + (dx / len) * pad;
      const sy = a.y + (dy / len) * 26;
      const ex = b.x - (dx / len) * pad;
      const ey = b.y - (dy / len) * 26;
      // Độ cong tính theo chiều chuẩn của cặp người → các mũi tên giữa hai người tách ra hai bên, không chồng nhau.
      const sign = e.tu < e.den ? 1 : -1;
      const bend = (nth % 2 ? -1 : 1) * (Math.floor(nth / 2) + 1) * 46;
      const mx = (sx + ex) / 2 - ((dy * sign) / len) * bend;
      const my = (sy + ey) / 2 + ((dx * sign) / len) * bend;
      // Màn hình hẹp chỉ ghi số tiền (hoặc nội dung) cho gọn; nhãn đặt ở 62% đường cong — các mũi tên chung
      // điểm xuất phát tách nhau ở phía đích nên nhãn không chồng lên nhau.
      const label = (narrow ? e.soTien || e.noiDung || '' : `${e.noiDung || ''}${e.soTien ? ` ${e.soTien}` : ''}`).trim();
      const lim = narrow ? 18 : 34;
      const t = 0.62;
      const qx = (1 - t) * (1 - t) * sx + 2 * t * (1 - t) * mx + t * t * ex;
      const qy = (1 - t) * (1 - t) * sy + 2 * t * (1 - t) * my + t * t * ey;
      return `<g class="cm-edge cm-e-${e.loai}" data-from="${escapeHtml(e.tu)}" data-to="${escapeHtml(e.den)}" style="--i:${i}">
        <path d="M${sx.toFixed(1)},${sy.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" marker-end="url(#cm-arrow-${e.loai})"><title>${escapeHtml(`${e.tu} → ${e.den}: ${label}${e.trich ? `\n“${e.trich}”` : ''}`)}</title></path>
        ${label ? `<text x="${(qx + (qx < cx - 12 ? -8 : qx > cx + 12 ? 8 : 0)).toFixed(1)}" y="${(qy - 4).toFixed(1)}" text-anchor="${qx < cx - 12 ? 'end' : qx > cx + 12 ? 'start' : 'middle'}">${escapeHtml(label.length > lim ? `${label.slice(0, lim - 2)}…` : label)}</text>` : ''}
      </g>`;
    })
    .join('');
  const nodes = [...pos.values()]
    .map(({ x, y, p }, i) => {
      const name = p.ten.length > 22 ? `${p.ten.slice(0, 20)}…` : p.ten;
      const role = (p.vaiTro || '').length > 26 ? `${p.vaiTro.slice(0, 24)}…` : p.vaiTro || '';
      const cls = /chỉ đạo/i.test(p.vaiTro) ? 'boss' : /nhận tiền/i.test(p.vaiTro) ? 'recv' : /bị can|bị tạm giữ|tố giác/i.test(p.vaiTro) ? 'suspect' : '';
      return `<g class="cm-node ${cls}" data-node="${escapeHtml(p.ten)}" tabindex="0" role="button" aria-label="${escapeHtml(`${p.ten}${p.vaiTro ? ` — ${p.vaiTro}` : ''}`)}" style="--i:${i}">
        <rect x="${(x - 78).toFixed(1)}" y="${(y - 24).toFixed(1)}" width="156" height="48" rx="12" />
        <text x="${x.toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle" class="cm-name">${escapeHtml(name)}</text>
        <text x="${x.toFixed(1)}" y="${(y + 14).toFixed(1)}" text-anchor="middle" class="cm-role">${escapeHtml(role)}</text>
      </g>`;
    })
    .join('');
  const marker = (k) => `<marker id="cm-arrow-${k}" class="cm-m-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" /></marker>`;
  return `<svg class="cm-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sơ đồ quan hệ, dòng tiền giữa những người liên quan"><defs>${Object.keys(LOAI).map(marker).join('')}</defs>${edges}${nodes}</svg>`;
}

/* ---------------- Báo cáo Word ---------------- */
function mapDoc(m, title, org = {}) {
  const up = (s) => String(s || '').toLocaleUpperCase('vi-VN');
  const p = (text, o = {}) => ({ runs: [{ text, ...o.r }], align: 'justify', indent: !o.noIndent, spaceBefore: o.sb });
  const head = (t) => ({ runs: [{ text: t, bold: true }], align: 'left', spaceBefore: true });
  const body = [];
  if (m.tomTat) body.push(p(m.tomTat));
  body.push(head('I. BẢN CHẤT VỤ VIỆC'));
  m.banChat.forEach((t) => body.push(p(`- ${t}`)));
  body.push(head('II. HÀNH VI THEO ĐIỀU LUẬT'));
  const acts = m.crimes.flatMap((c) => c.items.map((it) => [c.dieu ? `Điều ${c.dieu}` : '—', it.ten, it.nguoi.join(', '), it.soTien || '', it.trich || '']));
  body.push(acts.length ? { table: { widths: [0.1, 0.27, 0.18, 0.13, 0.32], header: ['Điều', 'Hành vi', 'Người thực hiện', 'Số tiền', 'Trích dẫn'], rows: acts } } : p('Chưa xác định được hành vi.'));
  body.push(head('III. QUAN HỆ, DÒNG TIỀN'));
  body.push(m.edges.length ? { table: { widths: [0.2, 0.2, 0.16, 0.16, 0.28], header: ['Từ', 'Đến', 'Nội dung', 'Số tiền', 'Căn cứ'], rows: m.edges.map((e) => [e.tu, e.den, `${LOAI[e.loai]}: ${e.noiDung}`, e.soTien || '', e.trich || e.src || '']) } } : p('Chưa xác định được quan hệ giữa các người.'));
  body.push(head('IV. NGƯỜI LIÊN QUAN'));
  body.push(m.people.length ? { table: { widths: [0.35, 0.45, 0.2], header: ['Họ tên', 'Vai trò', 'Số lần được nhắc'], rows: m.people.map((x) => [x.ten, x.vaiTro || '', String(x.mentions || '')]) } } : p('Chưa xác định.'));
  body.push(head('V. DÒNG THỜI GIAN'));
  body.push(m.timeline.length ? { table: { widths: [0.16, 0.6, 0.24], header: ['Thời gian', 'Sự kiện', 'Nguồn'], rows: m.timeline.map((t) => [t.thoiGian, t.suKien, t.src || '']) } } : p('Chưa có mốc thời gian.'));
  body.push(p(`Sơ đồ được lập ${m.ai ? 'bằng AI kết hợp phân tích trên máy' : 'bằng phân tích trên máy'} từ nội dung đã chọn — chỉ để tham khảo, cần đối chiếu với tài liệu, chứng cứ.`, { r: { italic: true } }));
  return {
    typeId: 'so-do-vu-viec',
    header: { parent: up(org.coQuanCapTren), org: up(org.coQuan), number: '', subject: null, placeDate: '' },
    title: { name: 'SƠ ĐỒ, BẢN CHẤT VỤ VIỆC', subject: title },
    authority: null,
    recipients: null,
    body,
    sign: null,
    dualSign: null,
    signers: [{ title: 'NGƯỜI LẬP', hint: '(Ký, ghi rõ họ tên)', name: org.dieuTraVien || '' }],
  };
}

/* ---------------- Màn hình ---------------- */
export function render(ctx, params = []) {
  const st = { src: 'records', caseId: params[0] && casesRepo.get(params[0]) ? params[0] : store.get('case-map-case', '') || '', picked: null, tab: 'ban-chat', map: null, title: '' };
  let treeCtl = null;
  let drop = null;
  const cases = casesRepo.list();
  const recsOf = () => recordsRepo.list((r) => (st.caseId === '' ? true : st.caseId === '-' ? !r.caseId : r.caseId === st.caseId) && (r.qa || []).some((x) => String(x.a || '').trim()));

  ctx.view.innerHTML = `
  <div class="page cm">
    <div class="page-head"><div><h1 class="page-title">Sơ đồ <em>vụ việc</em></h1><p class="page-sub">Chọn các biên bản lời khai hoặc tải tài liệu (Word, PDF, ảnh) — hệ thống dựng nhanh bản chất vụ việc: ai làm gì, với ai, khi nào, bao nhiêu tiền, thuộc điều luật nào; sơ đồ cây hành vi, sơ đồ quan hệ – dòng tiền, dòng thời gian.</p></div></div>
    <section class="panel cm-src">
      <div class="tabs cm-src-tabs" role="tablist"><button class="tab" role="tab" data-src="records" aria-selected="true">${icon('message', 'ic-sm')}Biên bản lời khai</button><button class="tab" role="tab" data-src="files" aria-selected="false">${icon('upload', 'ic-sm')}Tài liệu tải lên</button></div>
      <div class="cm-src-body" data-src-body></div>
      <div class="cm-run">
        ${ctx.hasAI('legal') ? `<label class="check"><input type="checkbox" data-cm-ai />Phân tích sâu bằng AI (${escapeHtml(ctx.ai('legal').label)})</label>` : `<small class="hint">Phân tích trên máy, không gửi dữ liệu ra ngoài.</small>`}
        <span class="spacer"></span>
        <button class="btn btn-primary" type="button" data-cm-run>${icon('chart', 'ic-sm')}Vẽ sơ đồ</button>
      </div>
      <p class="hint" data-cm-say aria-live="polite"></p>
    </section>
    <section class="panel cm-result" data-result hidden></section>
  </div>`;
  const v = ctx.view;

  function drawSource() {
    const body = $('[data-src-body]', v);
    $$('[data-src]', v).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.src === st.src)));
    if (st.src === 'files') {
      body.innerHTML = `${dropzoneHtml('Đơn tố giác, báo cáo, kết luận thanh tra, biên bản… (.pdf, .docx, ảnh chụp, .txt)')}<div class="field"><label for="cm-text">Hoặc dán nội dung</label><textarea class="textarea" id="cm-text" rows="5" data-cm-text placeholder="Dán nội dung vụ việc, lời khai…"></textarea></div>`;
      drop = bindDropzone(body);
      return;
    }
    const recs = recsOf();
    if (!st.picked) st.picked = new Set(recs.map((r) => r.id));
    body.innerHTML = `<div class="cm-pick-head"><label for="cm-case" class="hint">Hồ sơ</label><select class="select" id="cm-case" data-cm-case><option value="">Tất cả biên bản</option>${cases.map((c) => `<option value="${c.id}" ${c.id === st.caseId ? 'selected' : ''}>${escapeHtml(c.ten)}</option>`).join('')}<option value="-" ${st.caseId === '-' ? 'selected' : ''}>Biên bản chưa gắn hồ sơ</option></select>${recs.length ? `<label class="check"><input type="checkbox" data-cm-all ${recs.every((r) => st.picked.has(r.id)) ? 'checked' : ''} />Chọn tất cả (${recs.length})</label>` : ''}</div>
      ${
        recs.length
          ? `<ul class="cm-recs">${recs
              .map((r) => `<li><label class="check"><input type="checkbox" data-cm-rec="${r.id}" ${st.picked.has(r.id) ? 'checked' : ''} /><span><strong>${escapeHtml(r.nguoiKhai?.hoTen || 'Chưa ghi tên')} — lần ${r.lan || 1}</strong><small>${escapeHtml(getRole(r.roleId).ten.split('/')[0].trim())}${r.ngay ? ` · ${vnDate(r.ngay)}` : ''} · ${(r.qa || []).filter((x) => String(x.a || '').trim()).length} câu trả lời${r.caseId && st.caseId === '' ? ` · ${escapeHtml(casesRepo.get(r.caseId)?.ten || '')}` : ''}</small></span></label></li>`)
              .join('')}</ul>`
          : `<p class="muted">Chưa có biên bản có nội dung trả lời${st.caseId ? ' trong hồ sơ này' : ''}. Chuyển sang “Tài liệu tải lên” để vẽ sơ đồ từ tệp.</p>`
      }`;
  }

  function drawResult() {
    const host = $('[data-result]', v);
    treeCtl?.destroy();
    treeCtl = null;
    const m = st.map;
    if (!m) return (host.hidden = true);
    host.hidden = false;
    const TABS = [['ban-chat', 'Bản chất'], ['cay', 'Sơ đồ hành vi'], ['quan-he', `Quan hệ – dòng tiền (${m.edges.length})`], ['thoi-gian', `Dòng thời gian (${m.timeline.length})`]];
    host.innerHTML = `<div class="cm-res-head"><div><h2>${icon('chart', 'ic-sm')}${escapeHtml(st.title)}</h2><small>${m.ai ? 'AI kết hợp phân tích trên máy' : 'Phân tích trên máy'} · ${m.people.length} người · ${m.crimes.reduce((s, c) => s + c.items.length, 0)} hành vi · ${m.edges.length} quan hệ · ${m.timeline.length} mốc</small></div><span class="spacer"></span><button class="btn btn-sm btn-ghost" type="button" data-cm-preview>${icon('eye', 'ic-sm')}Xem bản in</button><button class="btn btn-sm" type="button" data-cm-export>${icon('download', 'ic-sm')}Xuất Word</button></div>
      <div class="tabs cm-tabs" role="tablist">${TABS.map(([k, l]) => `<button class="tab" role="tab" data-cm-tab="${k}" aria-selected="${st.tab === k}">${l}</button>`).join('')}</div>
      <div class="cm-body" data-cm-body></div>`;
    const body = $('[data-cm-body]', host);
    if (st.tab === 'ban-chat') {
      const total = m.crimes.reduce((s, c) => s + c.items.length, 0);
      body.innerHTML = `<div class="cm-essence">
        ${m.tomTat ? `<blockquote class="cm-sum">${escapeHtml(m.tomTat)}</blockquote>` : ''}
        <div class="cm-kpis"><span><strong>${m.crimes.filter((c) => c.dieu).length}</strong>điều luật</span><span><strong>${total}</strong>hành vi</span><span><strong>${m.people.length}</strong>người liên quan</span><span><strong>${m.edges.filter((e) => e.loai === 'tien').length}</strong>dòng tiền</span><span><strong>${m.amounts?.[0] || '—'}</strong>số tiền lớn nhất</span></div>
        <ul class="cm-points">${m.banChat.map((t) => `<li>${escapeHtml(t)}</li>`).join('') || '<li class="muted">Chưa rút ra được nội dung then chốt — thử chọn thêm biên bản hoặc dùng AI.</li>'}</ul>
        ${m.people.length ? `<h3 class="tk-h">${icon('user', 'ic-sm')}Người liên quan</h3><div class="cm-people">${m.people.map((p) => `<span class="cm-chip"><strong>${escapeHtml(p.ten)}</strong><small>${escapeHtml(p.vaiTro || '')}${p.mentions ? ` · ${p.mentions} lần` : ''}</small></span>`).join('')}</div>` : ''}
      </div>`;
    } else if (st.tab === 'cay') {
      if (!m.crimes.length && !m.people.length && !m.timeline.length) body.innerHTML = '<p class="muted">Chưa đủ dữ liệu để vẽ sơ đồ cây.</p>';
      else {
        const tree = caseMapToTree(m, st.title);
        treeCtl = mountTree(body, tree, {
          initialOpen: ['root', ...tree.children.filter((c) => c.kind === 'crime').map((c) => c.id), 'people'],
          title: `Sơ đồ vụ việc — ${st.title}`,
          subtitle: m.crimes.filter((c) => c.dieu).map((c) => `Điều ${c.dieu} — ${c.ten.replace(/^Tội /, '')}`).join(' · '),
          legendHtml: `<span class="lg-k pt-k-crime">Điều luật</span><span class="lg-k pt-k-act">Hành vi</span><span class="lg-k pt-k-person">Người</span><span class="lg-k pt-k-q">Trích dẫn, quan hệ</span><small>Bấm vào nút để mở / thu gọn · nút Toàn màn hình để trình bày</small>`,
        });
      }
    } else if (st.tab === 'quan-he') {
      const svg = relationSvg(m, { narrow: body.clientWidth < 600 });
      body.innerHTML = svg
        ? `<div class="cm-legend"><span class="cm-l-tien">Tiền, tài sản</span><span class="cm-l-chi-dao">Chỉ đạo, yêu cầu</span><span class="cm-l-khac">Quan hệ khác</span><small>Bấm vào một người để làm nổi các quan hệ của người đó · rê chuột lên mũi tên để xem căn cứ</small></div><div class="cm-graph" data-cm-graph>${svg}</div>
          <div class="tk-table-wrap"><table class="tk-table"><thead><tr><th>Từ</th><th>Đến</th><th>Nội dung</th><th>Số tiền</th><th>Căn cứ</th></tr></thead><tbody>${m.edges.map((e) => `<tr><td data-l="Từ">${escapeHtml(e.tu)}</td><td data-l="Đến">${escapeHtml(e.den)}</td><td data-l="Nội dung"><span class="cm-tag cm-l-${e.loai}">${LOAI[e.loai]}</span> ${escapeHtml(e.noiDung || '')}</td><td data-l="Số tiền">${escapeHtml(e.soTien || '')}</td><td data-l="Căn cứ"><small>${escapeHtml(e.trich || e.src || '')}</small></td></tr>`).join('')}</tbody></table></div>`
        : '<p class="muted">Chưa xác định được quan hệ giữa các người (cần câu có ít nhất hai người cùng hành động: đưa, nhận, chuyển, chỉ đạo…).</p>';
      $('[data-cm-graph]', body)?.addEventListener('click', (e) => {
        const n = e.target.closest('[data-node]');
        const g = $('.cm-svg', body);
        const name = n?.dataset.node;
        const on = name && g.dataset.focus !== name;
        g.dataset.focus = on ? name : '';
        g.classList.toggle('focus', !!on);
        $$('.cm-edge', g).forEach((x) => x.classList.toggle('hl', !!on && (x.dataset.from === name || x.dataset.to === name)));
        $$('.cm-node', g).forEach((x) => x.classList.toggle('hl', !!on && (x.dataset.node === name || $$(`.cm-edge.hl`, g).some((y) => y.dataset.from === x.dataset.node || y.dataset.to === x.dataset.node))));
      });
    } else {
      body.innerHTML = m.timeline.length ? `<ol class="cm-time">${m.timeline.map((t, i) => `<li style="--i:${i}"><time>${escapeHtml(t.thoiGian)}</time><p>${escapeHtml(t.suKien)}</p>${t.src ? `<small>${escapeHtml(t.src)}</small>` : ''}</li>`).join('')}</ol>` : '<p class="muted">Không tìm thấy mốc thời gian (ngày/tháng/năm) trong nội dung.</p>';
    }
    $$('[data-cm-tab]', host).forEach((b) =>
      b.addEventListener('click', () => {
        st.tab = b.dataset.cmTab;
        drawResult();
      }),
    );
    const org = ctx.settings().legalOrg || {};
    $('[data-cm-export]', host).addEventListener('click', () => {
      downloadBlob(buildDocx(mapDoc(m, st.title, org), 'Sơ đồ vụ việc'), safeFileName(`so-do-vu-viec-${st.title}`), DOCX_MIME);
      toast('Đã xuất sơ đồ, bản chất vụ việc (.docx)');
    });
    $('[data-cm-preview]', host).addEventListener('click', () =>
      ctx.modal(`<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button><div class="preview-modal-body print-area">${renderDocumentHtml(mapDoc(m, st.title, org))}</div><div class="modal-actions"><button class="btn" type="button" data-close>Đóng</button><button class="btn btn-dark" type="button" data-print>${icon('printer', 'ic-sm')}In / PDF</button></div>`, { className: 'modal-preview', label: 'Xem bản in sơ đồ vụ việc', onMount: (box) => box.querySelector('[data-print]').addEventListener('click', () => window.print()) }),
    );
  }

  async function run(btn) {
    const say = (t) => ($('[data-cm-say]', v).textContent = t);
    let sources = [];
    let known = [];
    let primary = null;
    if (st.src === 'records') {
      const recs = recsOf().filter((r) => st.picked?.has(r.id));
      if (!recs.length) return toast('Chọn ít nhất một biên bản', { type: 'error' });
      sources = recs.map((r) => ({ label: `${r.nguoiKhai?.hoTen || 'Người khai'} — lần ${r.lan || 1}`, speaker: r.nguoiKhai?.hoTen || '', text: (r.qa || []).filter((x) => String(x.a || '').trim()).map((x) => x.a).join('\n') }));
      const cs = [...new Set(recs.map((r) => r.caseId).filter(Boolean))].map((id) => casesRepo.get(id)).filter(Boolean);
      known = cs.flatMap((c) => (c.persons || []).map((p) => ({ ten: p.hoTen, vaiTro: getRole(p.roleId).ten.split('/')[0].trim() })));
      primary = cs[0]?.toiDanh?.[0] || recs.find((r) => r.plan?.dieu)?.plan.dieu || null;
      st.title = cs.length === 1 ? cs[0].ten : `${recs.length} biên bản lời khai`;
    } else {
      const files = drop?.files() || [];
      const pasted = $('[data-cm-text]', v)?.value || '';
      if (!files.length && !pasted.trim()) return toast('Chọn tệp hoặc dán nội dung', { type: 'error' });
      btn.disabled = true;
      try {
        const text = await readAll(files, pasted, say);
        sources = [{ label: files.map((f) => f.name).join(', ') || 'Nội dung dán', text }];
        st.title = files[0]?.name.replace(/\.[^.]+$/, '') || 'Nội dung tải lên';
      } catch (err) {
        btn.disabled = false;
        say('');
        return toast(err.message, { type: 'error', timeout: 5000 });
      }
    }
    btn.disabled = true;
    say('Đang phân tích…');
    let map = buildCaseMap({ sources, known, primary });
    if ($('[data-cm-ai]', v)?.checked) {
      const ai = ctx.ai('legal');
      say(`AI (${ai.label}) đang phân tích sâu…`);
      try {
        const out = await streamClaude({ provider: ai.provider, apiKey: ai.apiKey, model: ai.model, system: CASE_MAP_SYSTEM, maxTokens: 5000, cache: true, messages: [{ role: 'user', content: caseMapPrompt(sources.map((s) => `${s.speaker ? `[Lời khai của ${s.speaker} — ${s.label}]` : `[${s.label}]`}\n${s.text}`).join('\n\n'), { known, primary }) }] });
        map = mergeAiCaseMap(map, out);
      } catch (err) {
        toast(err.message, { type: 'error', timeout: 6000 });
      }
    }
    st.map = map;
    st.tab = 'ban-chat';
    btn.disabled = false;
    say('');
    drawResult();
    $('[data-result]', v).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  v.addEventListener('click', (e) => {
    const s = e.target.closest('[data-src]');
    if (s) {
      st.src = s.dataset.src;
      return drawSource();
    }
    if (e.target.closest('[data-cm-run]')) run(e.target.closest('[data-cm-run]'));
  });
  v.addEventListener('change', (e) => {
    if (e.target.matches('[data-cm-case]')) {
      st.caseId = e.target.value;
      store.set('case-map-case', st.caseId);
      st.picked = null;
      return drawSource();
    }
    if (e.target.matches('[data-cm-all]')) {
      st.picked = new Set(e.target.checked ? recsOf().map((r) => r.id) : []);
      return drawSource();
    }
    const r = e.target.closest('[data-cm-rec]');
    if (r) {
      r.checked ? st.picked.add(r.dataset.cmRec) : st.picked.delete(r.dataset.cmRec);
      const all = $('[data-cm-all]', v);
      if (all) all.checked = recsOf().every((x) => st.picked.has(x.id));
    }
  });
  drawSource();
  return () => treeCtl?.destroy();
}
