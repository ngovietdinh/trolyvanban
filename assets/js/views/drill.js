// Xem chi tiết ngay khi bấm: số điều luật, hành vi, người liên quan, dòng tiền, tổng tiền, số tiền lớn nhất — và từng người,
// từng khoản. Dùng chung cho Sơ đồ vụ việc và Phân tích lời khai. Mọi con số lấy từ sơ đồ (nguyên văn); tổng do máy cộng
// được ghi rõ. Khoản tiền sửa được (đảo chiều, đổi loại, không phải dòng tiền) và máy ghi nhớ cho lần sau.
import { icon, escapeHtml as esc } from '../ui.js';
import { analyzeMoney, personProfile, essenceOf, formatVnd, XAC_NHAN } from '../legal/money-flow.js';
import { learnCount, describeVerb } from '../legal/learn.js';
import { lawReasonHtml } from './law-reason.js';
import { key } from '../legal/text-sim.js';

const cut = (t, n = 200) => {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
};
const nameBtn = (n) => `<button type="button" class="cm-pn" data-person="${esc(n)}" title="Xem chi tiết ${esc(n)}">${esc(n)}</button>`;
const quote = (t) => (t ? `<q>${esc(cut(t, 230))}</q>` : '');

/* ---------------- Thanh số liệu bấm được ---------------- */
export function kpiHtml(m, active = '') {
  const acts = (m.crimes || []).reduce((s, c) => s + (c.items || []).length, 0);
  const laws = (m.crimes || []).filter((c) => c.dieu).length;
  const mo = analyzeMoney(m);
  const biggest = (m.soTien || [])[0]?.raw || m.amounts?.[0] || '';
  const items = [
    ['dieu', laws, `điều luật${(m.canLamRo || []).length ? ` · ${m.canLamRo.length} cần làm rõ` : ''}`],
    ['hanh-vi', acts, 'hành vi'],
    ['nguoi', (m.people || []).length, `người liên quan${(m.unclear || []).length ? ` · ${m.unclear.length} chưa rõ tên` : ''}`],
    ['dong-tien', mo.flows.length, `dòng tiền${mo.gaps.some((g) => g.kind !== 'mot-phia') ? ' · có khoản chưa rõ' : ''}`],
    ['tong', mo.tong ? formatVnd(mo.tong) : '—', 'tổng các khoản (máy cộng)'],
    ['so-tien', biggest || '—', `số tiền lớn nhất${(m.soTien || []).length > 1 ? ` · ${m.soTien.length} mức` : ''}`],
  ];
  return `<div class="cm-kpis" role="group" aria-label="Số liệu — bấm để xem chi tiết">${items.map(([k, v, l]) => `<button type="button" class="cm-kpi ${active === k ? 'on' : ''}" data-kpi="${k}" aria-expanded="${active === k}"><strong>${esc(String(v))}</strong><span>${esc(l)}</span></button>`).join('')}</div>`;
}

/* ---------------- Tóm lược bản chất ---------------- */
export function essenceHtml(m) {
  const list = essenceOf(m);
  if (!list.length) return '';
  const by = new Map();
  list.forEach((x) => by.set(x.nhom, [...(by.get(x.nhom) || []), x]));
  return `<section class="cm-ess"><h3 class="tk-h">${icon('layers', 'ic-sm')}Mô hình vụ việc <small class="hint">(máy lập từ dữ liệu có nguyên văn — bấm tên người để xem chi tiết)</small></h3>${[...by]
    .map(([nhom, xs]) => `<div class="cm-ess-g ${nhom === 'Chưa rõ' ? 'unk' : ''}"><b>${esc(nhom)}</b><ul>${xs.map((x) => `<li>${esc(x.text)}${x.nguoi.length ? ` <span class="cm-ess-who">${x.nguoi.slice(0, 6).map(nameBtn).join(' ')}</span>` : ''}</li>`).join('')}</ul></div>`)
    .join('')}</section>`;
}

/* ---------------- Dòng tiền ---------------- */
const xnBadge = (f) => `<span class="cm-xn cm-xn-${XAC_NHAN[f.xacNhan][1]}" title="${esc(XAC_NHAN[f.xacNhan][0])}">${f.xacNhan === 'hai-phia' ? '✓ 2 phía' : '1 phía'}</span>`;

function flowRow(f) {
  return `<tr class="cm-fl" data-flow-row="${esc(f.id)}"><td data-l="Thời gian">${esc(f.thoiGian || '—')}</td><td data-l="Từ → Đến">${nameBtn(f.tu)} → ${nameBtn(f.den)}</td><td data-l="Số tiền (nguyên văn)"><strong>${esc(f.soTien || 'chưa nêu')}</strong></td><td data-l="Xác nhận">${xnBadge(f)}</td><td data-l="Mục đích (nguyên văn)">${esc(f.mucDich || '—')}</td><td data-l=""><button type="button" class="btn btn-ghost btn-sm" data-flow-toggle="${esc(f.id)}" aria-expanded="false">Chi tiết</button></td></tr>
  <tr class="cm-fl-d" data-flow-detail="${esc(f.id)}" hidden><td colspan="6"><div class="cm-fl-box">${quote(f.trich)}<p class="hint">${esc(XAC_NHAN[f.xacNhan][0])}${f.nguon.length ? ` · nguồn: ${esc(f.nguon.join(', '))}` : ''}${f.n > 1 ? ` · nêu ${f.n} lần` : ''}${f.hoc ? ' · đã áp dụng quy tắc máy học' : ''}</p>
    <div class="cm-fl-act"><button type="button" class="btn btn-sm" data-flow-act="dao" data-flow="${esc(f.id)}" title="Đổi chiều mũi tên (người nhận ↔ người đưa); máy ghi nhớ cho động từ này">${icon('refresh', 'ic-sm')}Đảo chiều</button><select class="select" data-flow-kind="${esc(f.id)}" aria-label="Đổi loại quan hệ"><option value="">Đổi loại…</option><option value="chi-dao">Chỉ đạo, yêu cầu</option><option value="khac">Quan hệ khác</option></select><button type="button" class="btn btn-sm btn-ghost" data-flow-act="bo" data-flow="${esc(f.id)}" title="Câu này không tạo dòng tiền; máy ghi nhớ">${icon('x', 'ic-sm')}Không phải dòng tiền</button></div></div></td></tr>`;
}

/** Bảng tổng theo người: bấm vào số để thấy các khoản tạo nên con số đó. */
export function totalsHtml(mo) {
  const rows = [...mo.persons.values()].filter((p) => p.dua || p.nhan || p.rutTong);
  if (!rows.length) return '';
  const cell = (p, kind) => {
    const v = kind === 'in' ? p.nhan : kind === 'out' ? p.dua : p.rutTong;
    const n = kind === 'in' ? p.in.length : kind === 'out' ? p.out.length : p.rut.length;
    return v || n ? `<button type="button" class="cm-tot" data-tot="${kind}" data-person="${esc(p.ten)}" aria-expanded="false" title="Bấm để xem các khoản tạo nên số này">${v ? formatVnd(v) : `${n} khoản chưa nêu số tiền`}</button>` : '';
  };
  const rep = (p, kind) => {
    const list = kind === 'in' ? p.in : kind === 'out' ? p.out : p.rut.map((r) => ({ tu: p.ten, den: 'rút / lấy', soTien: r.soTien, v: r.v, trich: r.trich, thoiGian: '' }));
    const vals = list.filter((f) => f.v).map((f) => formatVnd(f.v));
    return `<tr class="cm-tot-d" data-tot-detail="${esc(`${key(p.ten)}|${kind}`)}" hidden><td colspan="4"><div class="cm-fl-box"><b>${esc(p.ten)} — ${kind === 'in' ? 'đã nhận' : kind === 'out' ? 'đã đưa / chuyển' : 'rút / lấy'}${vals.length > 1 ? `: ${vals.join(' + ')} = ${formatVnd(list.reduce((s, f) => s + f.v, 0))} (máy cộng)` : ''}</b><ul>${list.map((f) => `<li>${kind === 'in' ? nameBtn(f.tu) : kind === 'out' ? `→ ${nameBtn(f.den)}` : 'rút / lấy'} <strong>${esc(f.soTien || 'chưa nêu số tiền')}</strong>${f.thoiGian ? ` · ${esc(f.thoiGian)}` : ''}${quote(f.trich)}</li>`).join('')}</ul></div></td></tr>`;
  };
  return `<h3 class="tk-h">${icon('hash', 'ic-sm')}Tổng theo người <small class="hint">(máy cộng các khoản đã xác định — để đối chiếu, không phải số liệu trong lời khai; bấm số để xem từng khoản)</small></h3>
  <div class="tk-table-wrap"><table class="tk-table cm-totals"><thead><tr><th>Người</th><th>Đã nhận</th><th>Đã đưa / chuyển</th><th>Rút / lấy</th></tr></thead><tbody>${rows
    .map((p) => `<tr><td data-l="Người">${nameBtn(p.ten)}${p.vaiTro ? `<small class="cm-role-tag">${{ 'nguon-tien': 'nguồn tiền', 'trung-gian': 'trung gian', 'nguoi-nhan-cuoi': 'người nhận cuối' }[p.vaiTro]}</small>` : ''}</td><td data-l="Đã nhận">${cell(p, 'in')}</td><td data-l="Đã đưa">${cell(p, 'out')}</td><td data-l="Rút / lấy">${cell(p, 'rut')}</td></tr>${p.in.length ? rep(p, 'in') : ''}${p.out.length ? rep(p, 'out') : ''}${p.rut.length ? rep(p, 'rut') : ''}`)
    .join('')}</tbody></table></div>`;
}

export function learnedHtml(learn) {
  if (!learnCount(learn)) return '';
  const verbs = Object.entries(learn.verbs || {});
  return `<details class="cm-learned"><summary>${icon('wand', 'ic-sm')}Máy đã học ${learnCount(learn)} quy tắc từ chỉnh sửa của bạn</summary><ul>${verbs.map(([k, v]) => `<li>${esc(describeVerb(v))} <button type="button" class="btn btn-ghost btn-sm" data-forget="verb" data-key="${esc(k)}" aria-label="Quên quy tắc này">${icon('x', 'ic-sm')}</button></li>`).join('')}${(learn.ignore || []).map((k) => `<li>Bỏ qua câu bắt đầu “${esc(cut(k, 60))}” <button type="button" class="btn btn-ghost btn-sm" data-forget="ignore" data-key="${esc(k)}" aria-label="Quên quy tắc này">${icon('x', 'ic-sm')}</button></li>`).join('')}</ul><small class="hint">Quy tắc áp dụng cho các lần phân tích sau (không đổi kết quả đã lưu).</small></details>`;
}

export function moneyPanelHtml(m, { learn = null } = {}) {
  const mo = analyzeMoney(m);
  if (!mo.flows.length && !(m.rut || []).length) return `<p class="muted">Chưa xác định được dòng tiền (cần câu có hai người và hành động đưa, nhận, chuyển tiền…).</p>${learnedHtml(learn)}`;
  const real = mo.gaps.filter((g) => g.kind !== 'mot-phia');
  return `<div class="cm-money">
    <p class="cm-money-sum"><b>${mo.flows.length}</b> khoản${mo.tong ? ` · tổng các khoản có số tiền <b>${formatVnd(mo.tong)}</b> <small class="hint">(máy cộng, để đối chiếu)</small>` : ''}</p>
    ${mo.gaps.length ? `<ul class="cm-gaps">${mo.gaps.map((g) => `<li class="gap-${g.kind}">${icon('alert', 'ic-sm')}${esc(g.text)}</li>`).join('')}</ul>` : ''}
    ${mo.flows.length ? `<div class="tk-table-wrap"><table class="tk-table cm-flows"><thead><tr><th>Thời gian</th><th>Từ → Đến</th><th>Số tiền (nguyên văn)</th><th>Xác nhận</th><th>Mục đích</th><th></th></tr></thead><tbody>${mo.flows.map(flowRow).join('')}</tbody></table></div>` : ''}
    ${totalsHtml(mo)}${real.length ? '' : ''}${learnedHtml(learn)}</div>`;
}

/* ---------------- Hồ sơ từng người ---------------- */
export function personHtml(m, name, { compact = false } = {}) {
  const pr = personProfile(m, name);
  const p = pr.person;
  const mo = pr.money;
  const nm = compact ? esc : nameBtn;
  const flowLine = (f, out) => `<li>${out ? '→' : '←'} ${nm(out ? f.den : f.tu)} <strong>${esc(f.soTien || 'chưa nêu số tiền')}</strong>${f.thoiGian ? ` · ${esc(f.thoiGian)}` : ''}${f.mucDich ? ` · ${esc(f.mucDich)}` : ''}${compact ? '' : quote(f.trich)}</li>`;
  const head = `<div class="cm-pf-h"><strong>${esc(pr.ten)}</strong>${p?.vaiTro ? ` <span class="cm-pf-job" title="${esc(p.chucVuTrich ? `Nguyên văn: “${p.chucVuTrich}”` : 'Chức vụ / tư cách')}">${esc(p.vaiTro)}</span>` : ' <em class="hint">chưa có chức vụ trong lời khai</em>'}${p?.suyRa ? ` <span class="cm-infer" title="Máy suy ra từ quan hệ, không phải chức vụ">theo quan hệ: ${esc(p.suyRa.toLowerCase())}</span>` : ''}${mo?.vaiTro ? ` <span class="cm-role-tag">${{ 'nguon-tien': 'nguồn tiền', 'trung-gian': 'trung gian', 'nguoi-nhan-cuoi': 'người nhận cuối' }[mo.vaiTro]}</span>` : ''}</div>${p?.chucVuTrich && !compact ? quote(p.chucVuTrich) : ''}`;
  const money = mo && (mo.in.length || mo.out.length || mo.rut.length)
    ? `<div class="cm-pf-s"><b>Dòng tiền</b> <small class="hint">(tổng do máy cộng)</small><ul>${mo.rut.map((r) => `<li>rút / lấy <strong>${esc(r.soTien)}</strong>${compact ? '' : quote(r.trich)}</li>`).join('')}${mo.in.map((f) => flowLine(f, false)).join('')}${mo.out.map((f) => flowLine(f, true)).join('')}</ul><p class="hint">${[mo.nhan && `đã nhận ${formatVnd(mo.nhan)}`, mo.rutTong && `rút / lấy ${formatVnd(mo.rutTong)}`, mo.dua && `đã đưa ${formatVnd(mo.dua)}`].filter(Boolean).join(' · ')}</p>${pr.gaps.filter((g) => g.kind !== 'chua-so-tien').map((g) => `<p class="cm-gap1">${icon('alert', 'ic-sm')}${esc(g.text)}</p>`).join('')}</div>`
    : '';
  const others = pr.rel.filter((e) => e.loai !== 'tien');
  const rel = others.length ? `<div class="cm-pf-s"><b>Quan hệ khác</b><ul>${others.map((e) => `<li>${key(e.tu) === key(pr.ten) ? '→' : '←'} ${nm(key(e.tu) === key(pr.ten) ? e.den : e.tu)} · ${esc(e.noiDung || 'liên quan')}${compact ? '' : quote(e.trich)}</li>`).join('')}</ul></div>` : '';
  const acts = pr.acts.length ? `<div class="cm-pf-s"><b>Hành vi</b><ul>${pr.acts.map((a) => `<li>${a.dieu ? `Điều ${esc(a.dieu)} — ` : ''}${esc(a.ten)}${a.soTien ? ` (${esc(a.soTien)})` : ''}${compact ? '' : quote(a.trich)}</li>`).join('')}</ul></div>` : '';
  return `${head}${money}${rel}${acts}${compact ? '' : `<div class="cm-fl-act"><button type="button" class="btn btn-sm" data-show="${esc(pr.ten)}">${icon('eye', 'ic-sm')}Xem trên sơ đồ</button></div>`}`;
}

/* ---------------- Các bảng chi tiết theo số liệu ---------------- */
function peopleHtml(m) {
  const mo = analyzeMoney(m);
  if (!(m.people || []).length) return '<p class="muted">Chưa xác định được người liên quan.</p>';
  return `<div class="tk-table-wrap"><table class="tk-table"><thead><tr><th>Họ tên</th><th>Chức vụ – tư cách (nguyên văn)</th><th>Theo quan hệ (máy suy ra)</th><th>Dòng tiền (máy cộng)</th><th>Số lần nêu</th></tr></thead><tbody>${m.people
    .map((p) => {
      const mp = mo.persons.get(key(p.ten));
      return `<tr><td data-l="Họ tên">${nameBtn(p.ten)}</td><td data-l="Chức vụ">${p.vaiTro ? `${esc(p.vaiTro)}${p.chucVuTrich ? `<small title="${esc(p.chucVuTrich)}"> · có trích</small>` : ''}` : '<em class="hint">chưa có</em>'}</td><td data-l="Theo quan hệ">${esc(p.suyRa || '')}</td><td data-l="Dòng tiền">${mp ? [mp.nhan && `nhận ${formatVnd(mp.nhan)}`, mp.dua && `đưa ${formatVnd(mp.dua)}`, mp.rutTong && `rút ${formatVnd(mp.rutTong)}`].filter(Boolean).join(' · ') : ''}</td><td data-l="Số lần">${p.mentions || ''}</td></tr>`;
    })
    .join('')}</tbody></table></div>${(m.unclear || []).length ? `<p class="hint">${icon('alert', 'ic-sm')}Chưa đưa vào sơ đồ vì chưa đủ họ tên: ${m.unclear.map((u) => esc(u.ten)).join(', ')}.</p>` : ''}`;
}

function actsHtml(m) {
  const groups = (m.crimes || []).filter((c) => (c.items || []).length);
  if (!groups.length) return '<p class="muted">Chưa xác định được hành vi.</p>';
  return groups
    .map((c) => `<div class="cm-pf-s"><b>${c.dieu ? `Điều ${esc(c.dieu)} — ${esc(String(c.ten).replace(/^Tội /, ''))}` : 'Chưa xác định điều luật'}</b><ul>${c.items.map((it) => `<li>${esc(it.ten)}${it.soTien ? ` <strong>(${esc(it.soTien)})</strong>` : ''}${(it.nguoi || []).length ? ` — ${it.nguoi.map(nameBtn).join(', ')}` : ''}${quote(it.trich)}</li>`).join('')}</ul></div>`)
    .join('');
}

function amountsHtml(m) {
  const list = m.soTien || [];
  if (!list.length) return `<p class="muted">${(m.amounts || []).length ? `Các số tiền nêu: ${esc(m.amounts.join(', '))}.` : 'Không có số tiền nào trong nội dung.'}</p>`;
  const L = { 'dong-tien': 'đã gắn vào dòng tiền giữa hai người', rut: 'khoản rút / lấy (nguồn tiền)', khac: 'chưa gắn với người đưa / nhận — cần làm rõ' };
  return `<div class="tk-table-wrap"><table class="tk-table"><thead><tr><th>Số tiền (nguyên văn)</th><th>Số lần nêu</th><th>Tình trạng</th><th>Nêu ở câu</th></tr></thead><tbody>${list
    .map((a) => `<tr class="${a.loai === 'khac' ? 'warn' : ''}"><td data-l="Số tiền"><strong>${esc(a.raw)}</strong></td><td data-l="Số lần">${a.n}</td><td data-l="Tình trạng">${esc(L[a.loai])}${a.nguoiKhai?.length ? `<small> · do ${esc(a.nguoiKhai.join(', '))} nêu</small>` : ''}</td><td data-l="Câu">${a.quotes.map(quote).join('')}</td></tr>`)
    .join('')}</tbody></table></div>`;
}

const TITLE = { dieu: 'Điều luật liên quan', 'hanh-vi': 'Hành vi', nguoi: 'Người liên quan', 'dong-tien': 'Dòng tiền', tong: 'Dòng tiền và tổng các khoản', 'so-tien': 'Các số tiền trong nội dung' };

/** Nội dung bảng chi tiết cho một số liệu (kind) hoặc một người (kind 'nguoi-chi-tiet', arg = tên). */
export function drillHtml(m, kind, arg = '', opts = {}) {
  let body = '';
  let title = TITLE[kind] || '';
  if (kind === 'dieu') body = `${(m.crimes || []).filter((c) => c.dieu).length ? `<ul class="cm-law">${m.crimes.filter((c) => c.dieu).map((c) => lawReasonHtml(c)).join('')}</ul>` : '<p class="muted">Chưa có điều luật nào đủ yếu tố cấu thành trong nội dung.</p>'}${(m.canLamRo || []).length ? `<h4>Cần làm rõ thêm (chưa đưa vào sơ đồ)</h4><ul class="cm-law">${m.canLamRo.map((c) => lawReasonHtml(c, { open: true })).join('')}</ul>` : ''}`;
  else if (kind === 'hanh-vi') body = actsHtml(m);
  else if (kind === 'nguoi') body = peopleHtml(m);
  else if (kind === 'dong-tien' || kind === 'tong') body = moneyPanelHtml(m, opts);
  else if (kind === 'so-tien') body = amountsHtml(m);
  else if (kind === 'nguoi-chi-tiet') {
    title = 'Hồ sơ người liên quan';
    body = personHtml(m, arg);
  }
  const back = kind === 'nguoi-chi-tiet' ? `<button type="button" class="btn btn-ghost btn-sm" data-kpi="nguoi">${icon('chevron-left', 'ic-sm')}Danh sách người</button>` : '';
  return `<section class="cm-drill" aria-label="${esc(title)}"><div class="cm-drill-h"><h3>${esc(title)}</h3><span class="spacer"></span>${back}<button type="button" class="btn btn-ghost btn-sm btn-icon" data-drill-close aria-label="Đóng">${icon('x', 'ic-sm')}</button></div><div class="cm-drill-b">${body}</div></section>`;
}

/**
 * Gắn xử lý bấm cho vùng root (ủy quyền sự kiện). h: {
 *   map(): sơ đồ hiện tại, learn(): quy tắc đã học, host(): phần tử hiển thị bảng chi tiết (null → dùng modal),
 *   modal(html): mở hộp thoại, show(names): xem trên sơ đồ, flow(id, action): áp thao tác lên khoản, forget(kind, key) }.
 * Trả về { open(kind, arg), close() }.
 */
export function bindDrill(root, h) {
  const state = { kind: '', arg: '' };
  const render = () => {
    const host = h.host?.();
    if (!host) return;
    host.innerHTML = state.kind ? drillHtml(h.map(), state.kind, state.arg, { learn: h.learn?.() }) : '';
    root.querySelectorAll('[data-kpi]').forEach((b) => {
      const on = b.closest('.cm-kpis') && b.dataset.kpi === state.kind;
      if (b.closest('.cm-kpis')) {
        b.classList.toggle('on', !!on);
        b.setAttribute('aria-expanded', String(!!on));
      }
    });
    if (state.kind) host.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  };
  const open = (kind, arg = '') => {
    state.kind = kind;
    state.arg = arg;
    render();
  };
  root.addEventListener('click', (e) => {
    const t = e.target;
    const kpi = t.closest('[data-kpi]');
    if (kpi) return open(state.kind === kpi.dataset.kpi && !state.arg ? '' : kpi.dataset.kpi);
    if (t.closest('[data-drill-close]')) return open('');
    const tot = t.closest('[data-tot]');
    if (tot) {
      const row = root.querySelector(`[data-tot-detail="${CSS.escape(`${key(tot.dataset.person)}|${tot.dataset.tot}`)}"]`);
      if (row) {
        row.hidden = !row.hidden;
        tot.setAttribute('aria-expanded', String(!row.hidden));
      }
      return;
    }
    const tg = t.closest('[data-flow-toggle]');
    if (tg) {
      const row = root.querySelector(`[data-flow-detail="${CSS.escape(tg.dataset.flowToggle)}"]`);
      if (row) {
        row.hidden = !row.hidden;
        tg.setAttribute('aria-expanded', String(!row.hidden));
      }
      return;
    }
    const act = t.closest('[data-flow-act]');
    if (act) return h.flow?.(act.dataset.flow, act.dataset.flowAct);
    const fg = t.closest('[data-forget]');
    if (fg) return h.forget?.(fg.dataset.forget, fg.dataset.key);
    const sh = t.closest('[data-show]');
    if (sh) return h.show?.([sh.dataset.show]);
    const pn = t.closest('[data-person]');
    if (pn && !pn.closest('[data-tot]')) {
      const name = pn.dataset.person;
      if (h.host?.()) return open('nguoi-chi-tiet', name);
      return h.modal?.(`<h2 class="modal-title">${esc(name)}</h2><div class="cm-pf">${personHtml(h.map(), name)}</div><div class="modal-actions"><button class="btn" type="button" data-close>Đóng</button></div>`);
    }
  });
  root.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-flow-kind]');
    if (sel && sel.value) h.flow?.(sel.dataset.flowKind, `loai:${sel.value}`);
  });
  return { open, close: () => open(''), state };
}
