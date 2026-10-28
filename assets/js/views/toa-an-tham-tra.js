// Các tab thẩm tra của hồ sơ xét xử: "Thẩm tra (5 câu hỏi)" — kết luận từng câu hỏi nghiệp vụ, đề xuất phương án, xuất báo
// cáo thẩm tra (Word), sổ Excel; "Chứng cứ, bút lục" — rà soát chứng cứ, bảng đối chiếu theo bút lục; "Bản án tương tự,
// án lệ" — so sánh với kho bản án, án lệ của người dùng.
import { anLeForDieu } from '../legal/an-le-catalog.js';
import { khoDocFromData } from '../legal/an-le-data.js';
import { courtBaDb } from '../legal/court-ba-db.js';
import { icon, toast, escapeHtml, downloadBlob, warnMissing } from '../ui.js';
import { thamTra, MUC, LOAI_THAM_TRA, loaiThamTra, buildThamTraReport, thamTraWorkbook } from '../legal/court-review.js';
import { evidenceRows, typeLabel } from '../legal/court-evidence.js';
import { hinhPhatNgan } from '../legal/court-similar.js';
import { fmtMonths, fmtVnd } from '../legal/court.js';
import { buildDocx, safeFileName } from '../lib/docx.js';
import { renderDocumentHtml } from '../lib/render-html.js';
import { XLSX_MIME } from '../lib/xlsx.js';
import { rules as aiRules } from '../legal/ai-rules.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MUC_CLASS = { do: 'badge-danger', vang: 'badge-warning', xanh: 'badge-success', xam: '' };
const lawHtml = (law) => (law || []).filter((l) => l.quote).map((l) => `<blockquote class="ct-law"><b>${escapeHtml(l.ref)}</b>: “${escapeHtml(l.quote)}”</blockquote>`).join('');
const factHtml = (facts) => (facts || []).map((f) => `<blockquote class="ct-fact" data-no-law-link><b>${f.src ? escapeHtml(f.src) : 'Tài liệu'}:</b> “${escapeHtml(f.quote)}”</blockquote>`).join('');
const itemHtml = (it) => `<li class="tt-it m-${it.muc || 'xam'}">${icon({ do: 'alert', vang: 'info', xanh: 'check', xam: 'help' }[it.muc] || 'info', 'ic-sm')}<span>${escapeHtml(it.text)}${lawHtml(it.law)}${factHtml(it.facts)}</span></li>`;
const CONTROL = `<p class="note tt-control">${icon('shield', 'ic-sm')}<span><b>Kiểm soát kết luận:</b> phần mềm không xác định một người có tội hay ban hành quyết định tư pháp — chỉ tổng hợp căn cứ từ tài liệu đã nạp (trích dẫn kèm bút lục) và nguyên văn điều luật. Thẩm tra viên kiểm chứng, chịu trách nhiệm về báo cáo; quyết định thuộc người có thẩm quyền. Thiếu hồ sơ thì kết luận “Thiếu hồ sơ”, không suy diễn.</span></p>`;

/** Tab "Thẩm tra (5 câu hỏi)". c: { rec, book, laws, docs, aiText, aiBusy } */
export function thamTraHtml(c) {
  const { rec } = c;
  const R = thamTra(rec, c);
  const loai = loaiThamTra(rec);
  return `<div class="tt-wrap">
    <div class="tt-head panel ct-sec"><div class="grid-3">
      <div class="field"><label>Loại thẩm tra</label><select class="select" data-tt="loai">${Object.entries(LOAI_THAM_TRA).map(([v, l]) => `<option value="${v}" ${v === loai ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Thẩm tra viên</label><input class="input" data-tt="nguoi" value="${escapeHtml(rec.thamTra?.nguoi || '')}" placeholder="Họ tên người lập báo cáo" /></div>
      ${loai === 'tai-tham' ? `<div class="field span-2"><label>Tình tiết mới được phát hiện (mỗi tình tiết một dòng, ghi rõ nguồn)</label><textarea class="textarea" rows="3" data-tt="tinhTietMoi">${escapeHtml(rec.thamTra?.tinhTietMoi || '')}</textarea></div>` : ''}
    </div>
    <div class="inline"><button class="btn" type="button" data-tt-preview>${icon('eye', 'ic-sm')}Xem trước báo cáo thẩm tra</button><button class="btn btn-primary" type="button" data-tt-report>${icon('download', 'ic-sm')}Xuất báo cáo (Word)</button><button class="btn" type="button" data-tt-xlsx>${icon('grid', 'ic-sm')}Xuất bảng đối chiếu (Excel)</button><button class="btn btn-sm" type="button" data-ct-ai="tham-tra" ${c.aiBusy ? 'disabled' : ''}>${icon('sparkles', 'ic-sm')}${c.aiBusy ? 'AI đang thẩm tra…' : 'AI thẩm tra (chỉ dựa trên tài liệu, dẫn bút lục)'}</button></div></div>
    ${CONTROL}
    <ol class="tt-qs">${R.qs
      .map((q, i) => `<li class="tt-q m-${q.muc}" data-q="${q.id}"><div class="tt-q-head"><span class="tt-q-n">${i + 1}</span><strong>${escapeHtml(q.hoi)}</strong><span class="badge ${MUC_CLASS[q.muc]}" data-q-kl>${q.id === 'q5' ? escapeHtml(LOAI_THAM_TRA[loai]) : MUC[q.muc]}</span></div><ul class="tt-items">${q.items.map(itemHtml).join('')}</ul>${q.id === 'q5' && (R.deXuat.canCu.length || R.deXuat.boSung.length) ? `<p class="hint">${R.deXuat.canCu.length ? `Căn cứ: ${escapeHtml(R.deXuat.canCu.join('; '))}. ` : ''}${R.deXuat.boSung.length ? `Tài liệu cần bổ sung, xác minh: ${escapeHtml(R.deXuat.boSung.join('; '))}.` : ''}</p>` : ''}</li>`)
      .join('')}</ol>
    ${c.aiText ? `<div class="ct-ai md" data-ai-box="tham-tra">${escapeHtml(c.aiText).replace(/\n/g, '<br>')}</div>` : ''}
  </div>`;
}

/** Tab "Chứng cứ, bút lục". */
export function chungCuHtml(c) {
  const R = thamTra(c.rec, c);
  const rows = evidenceRows(c.rec, { book: c.book });
  const noBl = (c.rec.sources || []).filter((s) => s.loai !== 'don' && (s.butLuc === '' || s.butLuc == null));
  return `<div class="tt-wrap">
    ${noBl.length ? `<p class="note warn">${icon('hash', 'ic-sm')}<span>${noBl.length} tài liệu chưa có số bút lục (${escapeHtml(noBl.map((s) => s.name).join(', '))}) — nhập ở tab Tài liệu &amp; bị cáo để trích dẫn truy xuất được về hồ sơ gốc.</span></p>` : ''}
    <section class="panel ct-sec"><h2>${icon('search', 'ic-sm')}Rà soát chứng cứ</h2><ul class="tt-items">${R.ev.map((f) => itemHtml({ muc: { thieu: 'xam', 'mau-thuan': 'vang', canh: 'vang', dat: 'xanh' }[f.muc], text: [f.title, f.detail].filter(Boolean).join('. '), law: f.law, facts: f.facts })).join('')}</ul></section>
    <section class="panel ct-sec"><h2>${icon('layers', 'ic-sm')}Bảng đối chiếu chứng cứ theo bút lục <small>${rows.length} dòng</small></h2>
      <div class="inline"><button class="btn btn-sm" type="button" data-tt-xlsx>${icon('grid', 'ic-sm')}Xuất Excel</button></div>
      ${rows.length ? `<div class="tt-table-wrap"><table class="cf-table tt-table"><thead><tr><th>#</th><th>Vấn đề cần chứng minh</th><th>Nội dung (trích nguyên văn)</th><th>Tài liệu, bút lục</th><th>Ghi chú</th></tr></thead><tbody>${rows
        .map((r, i) => `<tr class="${/CHƯA|Chỉ có/.test(r.ghiChu) ? 'warn' : ''}"><td>${i + 1}</td><td>${escapeHtml(r.bc)}: ${escapeHtml(r.van)}</td><td data-no-law-link>${r.quote ? `“${escapeHtml(r.quote)}”` : '—'}</td><td>${escapeHtml(r.src || '—')}${r.loai ? `<small>${escapeHtml(r.loai)}</small>` : ''}</td><td>${escapeHtml(r.ghiChu)}</td></tr>`)
        .join('')}</tbody></table></div>` : '<p class="hint">Nhập bị cáo, tội danh và tài liệu để lập bảng.</p>'}
    </section>
    <section class="panel ct-sec"><h2>${icon('file', 'ic-sm')}Tài liệu đã nạp</h2><ul class="ct-els">${(c.rec.sources || []).map((s) => `<li class="ok">${icon('file', 'ic-sm')}<span>${escapeHtml(s.name)} — ${escapeHtml(typeLabel(s.loai))}${s.butLuc !== '' && s.butLuc != null ? `, bút lục từ ${s.butLuc}${s.pages?.length > 1 ? ` (${s.pages.length} trang)` : ''}` : ', chưa có bút lục'}</span></li>`).join('') || '<li class="hint">Chưa có tài liệu.</li>'}</ul></section>
  </div>`;
}

/** Án lệ hình sự trong danh mục liên quan điều luật đang xét nhưng chưa có toàn văn trong kho. */
function catalogHint(c) {
  const dieus = [...new Set((c.rec.defendants || []).flatMap((d) => (d.toiDanh || []).map((t) => String(t.dieu)).filter(Boolean)))];
  const inKho = new Set((c.docs || []).filter((d) => d.loai === 'an-le').map((d) => String(d.so || '').toUpperCase().replace(/\s+/g, '')));
  const list = anLeForDieu(dieus).filter((a) => !inKho.has(a.so));
  if (!list.length) return '';
  const data = c.anLe;
  return `<p class="hint">${list.length} án lệ hình sự liên quan Điều ${dieus.join(', ')} chưa nạp vào kho (toàn văn kèm phần mềm):</p><ul class="ct-els">${list
    .map((a) => {
      const d = data?.get?.(a.so);
      return `<li>${icon('layers', 'ic-sm')}<span><b>${escapeHtml(a.so)}</b> ${escapeHtml(a.tenNgan[0].toUpperCase() + a.tenNgan.slice(1))} <small>(Điều ${a.dieu.join(', ')} BLHS · áp dụng từ ${escapeHtml(a.apDung || '—')})</small>${d?.tinhHuong ? `<blockquote class="ct-law">Tình huống: ${escapeHtml(d.tinhHuong)}</blockquote>` : d?.khaiQuat ? `<blockquote class="ct-law">${escapeHtml(d.khaiQuat)}</blockquote>` : ''}${d?.giaiPhap ? `<blockquote class="ct-fact">Giải pháp pháp lý: ${escapeHtml(d.giaiPhap)}</blockquote>` : ''}</span></li>`;
    })
    .join('')}</ul><p class="hint"><a href="#toa-an/an-le/hs">${icon('download', 'ic-sm')}Nạp vào kho ở trang Án lệ</a> để đưa án lệ vào báo cáo thẩm tra và sổ Excel.</p>`;
}

/** Khối án lệ cho lời nhắc AI: án lệ trong kho theo điều luật + án lệ gợi ý theo nội dung (chỉ được dẫn những án lệ này). */
function anLeBlock(R, c) {
  const seen = new Set();
  const rows = [];
  for (const a of R.anLe || []) {
    seen.add(String(a.so || '').toUpperCase());
    rows.push(`- Án lệ ${a.so}${a.ten ? ` (${a.ten})` : ''}: ${a.khaiQuat || ''} ${a.giaiPhap ? `Giải pháp pháp lý: ${a.giaiPhap}` : ''}`.trim());
  }
  for (const g of R.anLeGoiY || []) {
    if (seen.has(g.a.so)) continue;
    rows.push(`- Án lệ ${g.a.so} (${g.a.ten}) — gợi ý theo nội dung${g.why.length ? `, khớp từ khóa ${g.why.map((w) => `“${w}”`).join(', ')}` : ''}: ${g.a.tinhHuong ? `Tình huống: ${g.a.tinhHuong} ` : g.a.khaiQuat ? `${g.a.khaiQuat} ` : ''}${g.a.giaiPhap ? `Giải pháp pháp lý: ${g.a.giaiPhap}` : ''}`.trim());
  }
  if (!rows.length) return '';
  return `ÁN LỆ CÓ THỂ LIÊN QUAN (của Hội đồng Thẩm phán TANDTC; chỉ được dẫn các án lệ dưới đây, ghi rõ số án lệ; nêu tình huống vụ án có tương tự tình huống án lệ không):\n${rows.join('\n').slice(0, 6000)}\n\n`;
}

/** Tab "Bản án tương tự, án lệ". */
export function tuongTuHtml(c) {
  const R = thamTra(c.rec, c);
  const n = (c.docs || []).length;
  return `<div class="tt-wrap">
    <p class="hint">${n ? `Kho có ${(c.docs || []).filter((d) => d.loai === 'ban-an').length} bản án, ${(c.docs || []).filter((d) => d.loai === 'an-le').length} án lệ (của tài khoản này).` : 'Kho bản án, án lệ của bạn đang trống.'} <a href="#toa-an/kho-ban-an">${icon('book', 'ic-sm')}Kho bản án, án lệ</a> — chỉ so sánh với văn bản có trong kho, không tự tạo bản án.</p>
    ${R.similar
      .map((s) => `<section class="panel ct-sec"><h2>${icon('gavel', 'ic-sm')}Bản án tương tự — ${escapeHtml(s.d.hoTen || 'bị cáo')}</h2>
        ${s.stats ? `<p class="ct-range"><b>${s.stats.n} bản án cùng ${s.stats.pham === 'khoan' ? 'điều, khoản' : `Điều ${escapeHtml(s.d.toiDanh?.[0]?.dieu || '')} (khác khoản)`}:</b> ${s.stats.min != null ? `mức tù từ ${fmtMonths(s.stats.min)} đến ${fmtMonths(s.stats.max)}, trung vị ${fmtMonths(s.stats.median)}` : 'không có mức tù'}; ${s.stats.anTreo} bản án cho hưởng án treo.</p>` : '<p class="hint">Chưa có bản án cùng điều luật trong kho.</p>'}
        ${s.items.length ? `<div class="tt-table-wrap"><table class="cf-table tt-table"><thead><tr><th>Bản án</th><th>Bị cáo</th><th>Điều, khoản</th><th>Giá trị</th><th>Hình phạt</th><th>Tương tự</th></tr></thead><tbody>${s.items.map((x) => `<tr><td>${escapeHtml(x.doc.so || x.doc.ten)}<small>${escapeHtml(x.doc.toa || '')}</small></td><td>${escapeHtml(x.bc.hoTen)}</td><td>${x.bc.diem?.length ? `điểm ${escapeHtml(x.bc.diem.join(', '))} ` : ''}${x.bc.khoan ? `khoản ${x.bc.khoan} ` : ''}Điều ${escapeHtml(x.bc.dieu)}</td><td>${x.doc.soTien ? fmtVnd(x.doc.soTien) : '—'}</td><td>${escapeHtml(hinhPhatNgan(x.bc.hinhPhat))}</td><td><small>${escapeHtml(x.ly.join(', '))}</small></td></tr>`).join('')}</tbody></table></div>` : ''}
      </section>`)
      .join('')}
    <section class="panel ct-sec"><h2>${icon('book', 'ic-sm')}Án lệ liên quan</h2>${R.anLe.length ? `<ul class="ct-els">${R.anLe.map((a) => `<li class="ok">${icon('book', 'ic-sm')}<span><b>Án lệ ${escapeHtml(a.so || '')}</b> ${escapeHtml(a.ten || '')}${a.khaiQuat ? `<blockquote class="ct-law">${escapeHtml(a.khaiQuat)}</blockquote>` : ''}${a.giaiPhap ? `<blockquote class="ct-fact">Giải pháp pháp lý: ${escapeHtml(a.giaiPhap)}</blockquote>` : ''}</span></li>`).join('')}</ul>` : '<p class="hint">Kho chưa có toàn văn án lệ liên quan đến điều luật đang xét.</p>'}
      ${catalogHint(c)}</section>
    ${goiYHtml(R, c)}
  </div>`;
}

/** Án lệ gợi ý theo nội dung vụ án: từ khóa / tình huống án lệ khớp với tài liệu đã nạp (không chỉ theo số điều). */
function goiYHtml(R, c) {
  const list = R.anLeGoiY || [];
  const hasSrc = (c.rec.sources || []).some((s) => (s.text || '').length > 40);
  const inKho = new Set((c.docs || []).filter((d) => d.loai === 'an-le').map((d) => String(d.so || '').toUpperCase()));
  return `<section class="panel ct-sec"><h2>${icon('sparkles', 'ic-sm')}Án lệ gợi ý theo nội dung vụ án</h2>
    ${!hasSrc ? '<p class="hint">Tải tài liệu (cáo trạng, bản án, lời khai) ở tab Tài liệu để phần mềm so nội dung vụ án với tình huống, từ khóa của 90 án lệ.</p>' : !c.anLe ? '<p class="hint">Đang tải dữ liệu án lệ…</p>' : !list.length ? '<p class="hint">Không có án lệ nào có từ khóa hoặc tình huống khớp với tài liệu đã nạp.</p>' : `<ul class="ct-els">${list
      .map((g) => `<li class="${g.score >= 8 ? 'ok' : ''}"><span><b>Án lệ ${escapeHtml(g.a.so)}</b> ${escapeHtml(g.a.ten)} <small>(${LV[g.a.linhVuc] || ''}${g.a.dieu?.length ? ` · Điều ${g.a.dieu.join(', ')} BLHS` : ''} · áp dụng từ ${escapeHtml(g.a.apDung || '—')})</small>
        ${g.why.length ? `<small class="ct-dl-note">Khớp từ khóa: ${g.why.map((w) => `“${escapeHtml(w)}”`).join(', ')}</small>` : `<small class="ct-dl-note">Tình huống án lệ có ${g.hit} cụm từ trùng với tài liệu</small>`}
        ${g.a.tinhHuong ? `<blockquote class="ct-law">Tình huống: ${escapeHtml(g.a.tinhHuong)}</blockquote>` : g.a.khaiQuat ? `<blockquote class="ct-law">${escapeHtml(g.a.khaiQuat)}</blockquote>` : ''}${g.a.giaiPhap ? `<blockquote class="ct-fact">Giải pháp pháp lý: ${escapeHtml(g.a.giaiPhap)}</blockquote>` : ''}
        <span class="inline">${inKho.has(g.a.so) ? '<span class="badge badge-success">Trong kho</span>' : `<button class="btn btn-sm" type="button" data-al-kho="${escapeHtml(g.a.so)}">${icon('download', 'ic-sm')}Nạp vào kho</button>`}<a class="btn btn-sm btn-ghost" href="#toa-an/an-le">${icon('eye', 'ic-sm')}Xem ở trang Án lệ</a></span></span></li>`)
      .join('')}</ul>`}
  </section>`;
}
const LV = { hs: 'Hình sự', ds: 'Dân sự', hngd: 'Hôn nhân và gia đình', kdtm: 'Kinh doanh, thương mại', ld: 'Lao động', hc: 'Hành chính' };

/** Sự kiện của các tab thẩm tra (gắn một lần trên vùng kết quả). */
export function bindThamTra(out, { ctx, getRec, getCtx, save, update }) {
  const org = () => ctx.settings?.().courtOrg || {};
  const report = () => buildThamTraReport(getRec(), { ...getCtx(), org: org(), nguoi: getRec().thamTra?.nguoi || '' });
  out.addEventListener('change', (e) => {
    const t = e.target;
    if (!t.dataset.tt) return;
    const rec = getRec();
    rec.thamTra = { ...(rec.thamTra || {}), [t.dataset.tt]: t.value };
    save();
    if (t.dataset.tt !== 'nguoi') update();
  });
  out.addEventListener('click', async (e) => {
    const rec = getRec();
    const kho = e.target.closest('[data-al-kho]');
    if (kho) {
      const a = getCtx().anLe?.get(kho.dataset.alKho);
      if (!a) return;
      kho.disabled = true;
      await courtBaDb.put(khoDocFromData(a));
      toast(`Đã nạp án lệ ${a.so} vào kho`);
      document.dispatchEvent(new CustomEvent('kho-changed'));
      return;
    }
    if (e.target.closest('[data-tt-report]')) {
      const doc = report();
      downloadBlob(buildDocx(doc, doc.title.name), safeFileName(`Bao-cao-tham-tra-${rec.ten || ''}`), DOCX_MIME);
      toast('Đã xuất báo cáo thẩm tra (.docx)');
    } else if (e.target.closest('[data-tt-preview]')) {
      ctx.modal(`<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button><div class="preview-modal-body print-area">${renderDocumentHtml(report())}</div><div class="modal-actions"><button class="btn" type="button" data-close>Đóng</button></div>`, { className: 'modal-wide preview-modal', label: 'Xem trước báo cáo thẩm tra' });
    } else if (e.target.closest('[data-tt-xlsx]')) {
      if (!(rec.sources || []).length && !(rec.defendants || []).some((d) => d.hoTen)) return warnMissing('Chưa có tài liệu, bị cáo để lập bảng đối chiếu');
      downloadBlob(thamTraWorkbook(rec, getCtx()), safeFileName(`Bang-doi-chieu-${rec.ten || ''}`, 'xlsx'), XLSX_MIME);
      toast('Đã xuất bảng đối chiếu (.xlsx)');
    }
  });
}

/** Lời nhắc AI thẩm tra: dẫn bút lục, không kết luận có tội, thiếu thì báo thiếu. */
export function thamTraAiPrompt(c) {
  const R = thamTra(c.rec, c);
  const docs = (c.rec.sources || [])
    .map((s) => {
      const start = s.butLuc !== '' && s.butLuc != null ? +s.butLuc : null;
      const pages = s.pages?.length > 1 ? s.pages : [s.text];
      return pages.map((p, i) => `[${s.name}${start != null ? ` — BL ${start + (pages.length > 1 ? i : 0)}` : ''} — ${typeLabel(s.loai)}]\n${p}`).join('\n');
    })
    .join('\n\n')
    .slice(0, 26000);
  const machine = R.qs.map((q, i) => `${i + 1}. ${q.hoi} → ${MUC[q.muc]}\n${q.items.slice(0, 6).map((x) => `- ${x.text}`).join('\n')}`).join('\n');
  return {
    system: `Bạn hỗ trợ Thẩm tra viên Tòa án nghiên cứu hồ sơ vụ án hình sự. Trả lời lần lượt 5 câu hỏi nghiệp vụ: (1) đúng người, đúng tội, đúng pháp luật; (2) chứng cứ đã đủ chứng minh hành vi và yếu tố cấu thành chưa; (3) căn cứ thay đổi tội danh, khoản, giảm nhẹ, dưới mức thấp nhất của khung; (4) đơn đề nghị, kiến nghị, kháng nghị có căn cứ không; (5) căn cứ đề xuất kháng nghị giám đốc thẩm, tái thẩm, hủy án, sửa án hoặc giữ nguyên.
QUY TẮC (bắt buộc):
${aiRules('nguon', 'nguyenVan', 'luat', 'gon')}
- Mỗi nhận định phải dẫn nguồn dạng (Tên tài liệu — BL n) đúng như nhãn trong TÀI LIỆU; tài liệu không có BL thì ghi tên tài liệu. Không tự đặt số bút lục.
- Không tự tạo lời khai, chứng cứ, bản án, án lệ hay điều luật không có trong tài liệu; điều gì không có trong tài liệu ghi rõ "Thiếu hồ sơ".
- Không kết luận một người có tội hay vô tội; chỉ nêu căn cứ và đề xuất để người có thẩm quyền quyết định.
- Lưu ý pháp luật theo thời điểm (ngày thực hiện hành vi, văn bản sửa đổi có lợi).`,
    content: `KẾT QUẢ ĐỐI CHIẾU TRÊN MÁY (tham khảo, cần kiểm chứng):\n${machine}\n\n${anLeBlock(R, c)}TÀI LIỆU (có nhãn bút lục):\n${docs}`,
  };
}
