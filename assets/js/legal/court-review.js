// Thẩm tra hồ sơ vụ án hình sự: trả lời 5 câu hỏi nghiệp vụ, đề xuất phương án (giữ nguyên / sửa / hủy án; kháng nghị giám
// đốc thẩm, tái thẩm), báo cáo thẩm tra tổng hợp 8 mục (Word), dự thảo văn bản trả lời kiến nghị, sổ Excel đối chiếu.
//
// Kiểm soát kết luận: phần mềm KHÔNG xác định một người có tội hay ban hành quyết định tư pháp — chỉ tổng hợp căn cứ (trích
// tài liệu kèm bút lục, nguyên văn điều luật) để Thẩm tra viên kiểm chứng; quyết định thuộc người có thẩm quyền.
// Chống suy diễn: thiếu hồ sơ thì kết luận "Thiếu hồ sơ"; không tạo lời khai, chứng cứ, bút lục, bản án, điều luật.
import { findCrime } from './engine.js';
import { checkDefendant, assessComplaint, KET_LUAN, LOAI_DON, fmtMonths, fmtVnd } from './court.js';
import { reviewEvidence, elementMatrix, evidenceRows, typeLabel, srcRange } from './court-evidence.js';
import { lawNotes, ageChecks, DEFAULT_LAWS } from './court-law-time.js';
import { findSimilar, relatedPrecedents, hinhPhatNgan } from './court-similar.js';
import { parseIso, fmtDate, addDays } from './court-penalty.js';
import { buildXlsx } from '../lib/xlsx.js';

export const MUC = { do: 'Có dấu hiệu vi phạm', vang: 'Có căn cứ xem xét', xanh: 'Không phát hiện vi phạm', xam: 'Thiếu hồ sơ / cần xác minh' };
export const LOAI_THAM_TRA = { 'so-tham': 'Chuẩn bị xét xử sơ thẩm', 'phuc-tham': 'Xét xử phúc thẩm (bản án chưa có hiệu lực)', 'giam-doc-tham': 'Đề nghị giám đốc thẩm', 'tai-tham': 'Đề nghị tái thẩm' };
export const loaiThamTra = (rec) => rec.thamTra?.loai || (rec.cap === 'phuc-tham' ? 'phuc-tham' : 'so-tham');
const LV2MUC = { loi: 'do', canh: 'vang', goi: 'vang', thieu: 'xam', dung: 'xanh', 'vi-pham': 'do' };
const worst = (list) => (list.includes('do') ? 'do' : list.includes('xam') ? 'xam' : list.includes('vang') ? 'vang' : 'xanh');
const fromF = (f, muc) => ({ muc, text: [f.title, f.detail].filter(Boolean).join('. '), law: f.law || [], facts: f.facts || [] });

/** Toàn bộ kết quả thẩm tra của hồ sơ. ctx: { book, laws, docs (kho bản án / án lệ) }. */
export function thamTra(rec = {}, { book = null, laws = DEFAULT_LAWS, docs = [] } = {}) {
  const sources = rec.sources || [];
  const defs = (rec.defendants || []).filter((d) => d.hoTen || d.toiDanh?.[0]?.dieu);
  const ev = reviewEvidence(rec, { book });
  const checks = defs.map((d) => ({ d, F: checkDefendant(d, { book, sources }) }));
  const ages = ageChecks(rec, { book });
  const notes = lawNotes({ ngayHanhVi: rec.moc?.ngayHanhVi, ngayXetXu: rec.moc?.ngayXetXu || rec.moc?.ngayTuyenAn, laws, book });
  const dons = (rec.dons || []).map((don) => ({ don, r: assessComplaint({ text: don.text, defendants: rec.defendants || [], sources, book, banAn: rec.banAn || {} }) }));
  const named = (d, t) => (defs.length > 1 ? `${d.hoTen || 'Bị cáo'}: ${t}` : t);

  /* Câu 1. Đúng người, đúng tội, đúng pháp luật. */
  const q1 = [];
  if (!defs.some((d) => d.toiDanh?.[0]?.dieu)) q1.push({ muc: 'xam', text: 'Chưa có tội danh, điều luật đã áp dụng (đọc bản án / cáo trạng ở tab Tài liệu & bị cáo hoặc nhập tay).' });
  for (const a of ages) q1.push({ muc: LV2MUC[a.level], text: a.text, law: a.law || [] });
  for (const f of ev.filter((x) => x.id.startsWith('nhan-than-'))) q1.push(fromF(f, 'vang'));
  for (const { d, F } of checks) {
    for (const f of F) {
      if (f.id === 'toi-danh-ok') q1.push({ ...fromF(f, 'xanh'), text: named(d, f.title) });
      else if (f.id === 'toi-danh-thieu' || /^toi-danh-khac-/.test(f.id)) q1.push({ ...fromF(f, 'vang'), text: named(d, `${f.title}. ${f.detail || ''}`) });
      else if (f.level === 'loi') q1.push({ ...fromF(f, 'do'), text: named(d, `${f.title}${f.detail ? `. ${f.detail}` : ''}`) });
      else if (f.id === 'chua-co-sach') q1.push({ ...fromF(f, 'xam') });
    }
  }
  for (const n of notes) if (n.level === 'canh' || n.level === 'thieu') q1.push({ muc: n.level === 'thieu' ? 'xam' : 'vang', text: n.text, law: n.law || [] });

  /* Câu 2. Chứng cứ đủ chứng minh hành vi và các yếu tố cấu thành chưa. */
  const q2 = ev.map((f) => fromF(f, { thieu: 'xam', 'mau-thuan': 'vang', canh: 'vang', dat: 'xanh' }[f.muc]));
  for (const d of defs) {
    const t = d.toiDanh?.[0];
    if (!t?.dieu) continue;
    for (const e of elementMatrix(t.dieu, sources).filter((x) => x.support.length && !x.onlyConfession)) q2.push({ muc: 'xanh', text: named(d, `Yếu tố “${e.label}” có ${e.support.length} nguồn chứng minh: ${[...new Set(e.support.map((x) => x.src))].join('; ')}.`), facts: e.support.slice(0, 1) });
  }

  /* Câu 3. Căn cứ thay đổi tội danh, khoản, giảm nhẹ, dưới mức thấp nhất của khung. */
  const q3 = [];
  for (const { d, F } of checks)
    for (const f of F.filter((x) => /^toi-danh-khac-/.test(x.id) || x.id === 'khung-tien' || x.chieu === 'giam')) q3.push({ ...fromF(f, f.level === 'loi' ? 'do' : 'vang'), text: named(d, `${f.title}${f.detail ? `. ${f.detail}` : ''}`), yeuCau: f.yeuCau });
  if (!q3.length && defs.length) q3.push({ muc: 'xanh', text: 'Không thấy căn cứ thay đổi tội danh, khoản áp dụng, giảm nhẹ hoặc xử dưới mức thấp nhất của khung trong tài liệu đã nạp.' });

  /* Câu 4. Đơn đề nghị, kiến nghị, kháng nghị có căn cứ không. */
  const q4 = dons.map(({ don, r }) => ({ muc: { co: 'vang', 'mot-phan': 'vang', khong: 'xanh', 'xac-minh': 'xam' }[r.overall], text: `${LOAI_DON[r.parsed.loai] || 'Đơn'} “${don.name}”${r.parsed.nguoi.hoTen ? ` của ${r.parsed.nguoi.hoTen}` : ''}: đơn ${KET_LUAN[r.overall].toLowerCase()} — ${r.items.map((it) => `${it.label.toLowerCase()}: ${KET_LUAN[it.kl].toLowerCase()}`).join('; ')}.` }));
  if (!q4.length) q4.push({ muc: 'xam', text: 'Chưa có đơn đề nghị, kiến nghị, kháng nghị (tải ở tab Xem xét đơn).' });

  /* Câu 5. Đề xuất. */
  const deXuat = propose(rec, { q1, q2, q3, dons, ev, checks });
  deXuat.lyDo = deXuat.lyDo.filter((x, i, a) => a.findIndex((y) => y.text === x.text) === i);
  const qs = [
    { id: 'q1', hoi: 'Bản án đã tuyên có đúng người, đúng tội, đúng pháp luật không?', items: q1 },
    { id: 'q2', hoi: 'Chứng cứ đã đủ để chứng minh hành vi phạm tội và các yếu tố cấu thành tội phạm chưa?', items: q2 },
    { id: 'q3', hoi: 'Có căn cứ thay đổi tội danh, khoản áp dụng, giảm nhẹ hình phạt hoặc quyết định hình phạt dưới mức thấp nhất của khung không?', items: q3 },
    { id: 'q4', hoi: 'Đơn đề nghị, kiến nghị, kháng nghị có căn cứ pháp luật và chứng cứ hỗ trợ hay không?', items: q4 },
  ].map((q) => ({ ...q, muc: worst(q.items.map((x) => x.muc)) }));
  qs.push({ id: 'q5', hoi: 'Có căn cứ đề xuất kháng nghị giám đốc thẩm, tái thẩm, hủy án, sửa án hoặc giữ nguyên bản án không?', items: [{ muc: deXuat.muc, text: `${deXuat.ten}.` }, ...deXuat.lyDo], muc: deXuat.muc });
  const dieus = [...new Set(defs.map((d) => d.toiDanh?.[0]?.dieu).filter(Boolean))];
  const similar = defs.map((d) => ({ d, ...findSimilar(d, docs) }));
  return { qs, deXuat, ev, checks, ages, notes, dons, similar, anLe: relatedPrecedents(dieus, docs) };
}

/** Đề xuất phương án theo loại thẩm tra. */
function propose(rec, { q1, q2, q3, dons, ev }) {
  const loai = loaiThamTra(rec);
  const viPham = q1.filter((x) => x.muc === 'do');
  const chuaChungCu = ev.filter((f) => /^chua-chung-cu-/.test(f.id) || f.id === 'khong-tai-lieu');
  const thieuTaiLieu = ev.filter((f) => f.muc === 'thieu');
  const mauThuan = ev.filter((f) => f.muc === 'mau-thuan');
  const coCanCu = q3.filter((x) => x.muc !== 'xanh');
  const thuTuc = dons.flatMap(({ r }) => r.items.filter((it) => it.type === 'thu-tuc'));
  const tinhTietMoi = [
    ...String(rec.thamTra?.tinhTietMoi || '').split('\n').map((x) => x.trim()).filter(Boolean).map((t) => ({ muc: 'vang', text: `Tình tiết mới: ${t}` })),
    ...dons.flatMap(({ r }) => r.items.flatMap((it) => it.xacMinh.filter((x) => /tình tiết mới/iu.test(x.text)).map((x) => ({ muc: 'xam', text: x.text })))),
  ];
  const boSung = [...thieuTaiLieu.map((f) => f.title.replace(/^Hồ sơ đã nạp chưa có: /, '')), ...dons.flatMap(({ r }) => r.items.filter((it) => it.kl === 'xac-minh').map((it) => `Xác minh: ${it.label.toLowerCase()}`))];
  const out = { loai, boSung: [...new Set(boSung)], lyDo: [], canCu: [] };
  if (loai === 'so-tham') {
    if (chuaChungCu.length) Object.assign(out, { ma: 'tra-ho-so', ten: 'Đề xuất trả hồ sơ để yêu cầu điều tra bổ sung (Điều 280 BLTTHS) — chứng cứ chưa thể hiện đủ yếu tố cấu thành', muc: 'vang' });
    else if (thieuTaiLieu.length) Object.assign(out, { ma: 'bo-sung', ten: 'Đề nghị bổ sung tài liệu trước khi quyết định đưa vụ án ra xét xử', muc: 'xam' });
    else Object.assign(out, { ma: 'dua-ra-xet-xu', ten: 'Tài liệu đã nạp đủ căn cứ để quyết định đưa vụ án ra xét xử', muc: 'xanh' });
    out.lyDo = [...chuaChungCu, ...mauThuan].map((f) => fromF(f, f.muc === 'mau-thuan' ? 'vang' : 'xam'));
    return out;
  }
  if (loai === 'phuc-tham') {
    out.canCu = ['Điều 355 BLTTHS (thẩm quyền của Hội đồng xét xử phúc thẩm)'];
    if (chuaChungCu.length || q1.some((x) => /yếu tố cấu thành/.test(x.text) && x.muc !== 'xanh')) Object.assign(out, { ma: 'huy-an', ten: 'Có căn cứ xem xét hủy bản án sơ thẩm để điều tra lại hoặc xét xử lại (chứng cứ chưa chứng minh đủ yếu tố cấu thành, không bổ sung được tại phiên tòa phúc thẩm)', muc: 'vang' });
    else if (viPham.length || coCanCu.length) Object.assign(out, { ma: 'sua-an', ten: `Có căn cứ xem xét sửa bản án sơ thẩm${coCanCu.length ? ' (tội danh, khoản, tình tiết, mức hình phạt)' : ''}`, muc: viPham.length ? 'do' : 'vang' });
    else Object.assign(out, { ma: 'giu-nguyen', ten: 'Không thấy căn cứ chấp nhận kháng cáo, kháng nghị — đề xuất giữ nguyên bản án sơ thẩm', muc: 'xanh' });
    out.lyDo = [...chuaChungCu.map((f) => fromF(f, 'xam')), ...viPham, ...coCanCu];
    return out;
  }
  if (loai === 'giam-doc-tham') {
    const a = [...chuaChungCu, ...mauThuan].map((f) => fromF(f, 'vang'));
    const c = [...viPham, ...q3.filter((x) => x.muc === 'do')];
    const b = thuTuc.map((it) => ({ muc: 'xam', text: `Đơn nêu vi phạm thủ tục tố tụng: “${it.quotes[0] || it.label}” — cần kiểm tra hồ sơ.` }));
    out.canCu = ['Điều 371 BLTTHS (căn cứ để kháng nghị theo thủ tục giám đốc thẩm)'];
    out.lyDo = [
      ...(a.length ? [{ muc: 'vang', text: 'Căn cứ (a) — kết luận trong bản án có dấu hiệu không phù hợp với tình tiết khách quan của vụ án:' }, ...a] : []),
      ...(b.length ? [{ muc: 'xam', text: 'Căn cứ (b) — vi phạm nghiêm trọng thủ tục tố tụng (cần xác minh):' }, ...b] : []),
      ...(c.length ? [{ muc: 'do', text: 'Căn cứ (c) — sai lầm trong việc áp dụng pháp luật:' }, ...c] : []),
    ];
    const hl = parseIso(rec.moc?.ngayHieuLuc);
    if (hl) out.lyDo.push({ muc: 'xam', text: `Thời hạn kháng nghị theo hướng không có lợi cho người bị kết án: 01 năm kể từ ngày bản án có hiệu lực pháp luật (bản án có hiệu lực ${fmtDate(hl)} → đến ${fmtDate(addDays(new Date(hl.getFullYear() + 1, hl.getMonth(), hl.getDate()), -1))}); theo hướng có lợi: không hạn chế thời gian.` });
    else out.lyDo.push({ muc: 'xam', text: 'Nhập ngày bản án có hiệu lực pháp luật (tab Vụ án) để tính thời hạn kháng nghị giám đốc thẩm.' });
    if (c.length) Object.assign(out, { ma: 'khang-nghi-gdt', ten: 'Có căn cứ đề xuất kháng nghị theo thủ tục giám đốc thẩm (sai lầm trong việc áp dụng pháp luật)', muc: 'do' });
    else if (a.length) Object.assign(out, { ma: 'xem-xet-gdt', ten: 'Có dấu hiệu kết luận không phù hợp với tình tiết khách quan — cần xác minh, đối chiếu hồ sơ trước khi đề xuất kháng nghị giám đốc thẩm', muc: 'vang' });
    else if (b.length) Object.assign(out, { ma: 'xac-minh', ten: 'Cần xác minh vi phạm thủ tục tố tụng mà đơn nêu trước khi đề xuất', muc: 'xam' });
    else Object.assign(out, { ma: 'khong-khang-nghi', ten: 'Không thấy căn cứ kháng nghị giám đốc thẩm — đề xuất trả lời người đề nghị', muc: 'xanh' });
    return out;
  }
  // Tái thẩm: tình tiết mới được phát hiện có thể làm thay đổi cơ bản nội dung bản án mà Tòa án không biết được khi ra bản án.
  out.canCu = ['BLTTHS — căn cứ kháng nghị theo thủ tục tái thẩm (tình tiết mới được phát hiện)'];
  out.lyDo = tinhTietMoi;
  if (tinhTietMoi.length) Object.assign(out, { ma: 'xem-xet-tt', ten: 'Có tình tiết mới cần xác minh — xem xét đề xuất kháng nghị theo thủ tục tái thẩm', muc: 'vang' });
  else Object.assign(out, { ma: 'khong-tt', ten: 'Chưa có tình tiết mới làm thay đổi cơ bản nội dung bản án — chưa có căn cứ tái thẩm', muc: 'xanh' });
  return out;
}

/* ---------------- Văn bản ---------------- */
const run = (text, o = {}) => ({ text, ...o });
const P = (text, o = {}) => ({ runs: Array.isArray(text) ? text : [run(text)], align: 'justify', indent: true, ...o });
const H = (text) => P([run(text, { bold: true })], { indent: false, spaceBefore: true });
const H2 = (text) => P([run(text, { bold: true, italic: true })], { indent: false });
const up = (s) => String(s || '').toLocaleUpperCase('vi-VN');
const today = () => {
  const d = new Date();
  return `ngày ${String(d.getDate()).padStart(2, '0')} tháng ${String(d.getMonth() + 1).padStart(2, '0')} năm ${d.getFullYear()}`;
};
const itemParas = (it) => [
  P([run(`${{ do: '[Vi phạm] ', vang: '[Xem xét] ', xanh: '[Đạt] ', xam: '[Thiếu / xác minh] ' }[it.muc] || ''}`, { bold: true }), run(it.text)]),
  ...(it.law || []).filter((l) => l.quote).map((l) => P([run('Căn cứ pháp lý: ', { italic: true }), run(`${l.ref}: “${l.quote}”`)])),
  ...(it.facts || []).map((f) => P([run('Căn cứ thực tế: ', { italic: true }), run(`“${f.quote}”${f.src ? ` (${f.src})` : ''}`)])),
];
const hpText = (hp = {}) => hinhPhatNgan(hp);

/** Báo cáo thẩm tra tổng hợp 8 mục (doc model). */
export function buildThamTraReport(rec, { book = null, laws = DEFAULT_LAWS, docs = [], org = {}, nguoi = '' } = {}) {
  const R = thamTra(rec, { book, laws, docs });
  const defs = (rec.defendants || []).filter((d) => d.hoTen);
  const body = [];
  body.push(P([run('Kết quả dưới đây do Thẩm tra viên kiểm chứng; phần mềm chỉ tổng hợp căn cứ từ tài liệu đã nạp (trích dẫn kèm bút lục) và nguyên văn điều luật — không thay thế kết luận của người có thẩm quyền.', { italic: true })], { indent: false }));
  // 1
  body.push(H('1. TÓM TẮT VỤ ÁN VÀ QUÁ TRÌNH XÉT XỬ'));
  body.push(P(`Vụ án: ${rec.ten || '……'}${rec.thuLy?.so ? `; thụ lý số ${rec.thuLy.so}${rec.thuLy.ngay ? ` ngày ${fmtDate(parseIso(rec.thuLy.ngay))}` : ''}` : ''}. Loại thẩm tra: ${LOAI_THAM_TRA[loaiThamTra(rec)]}.`));
  if (rec.caoTrang?.so) body.push(P(`Cáo trạng số ${rec.caoTrang.so}${rec.caoTrang.ngay ? ` ngày ${fmtDate(parseIso(rec.caoTrang.ngay))}` : ''}${rec.caoTrang.vks ? ` của ${rec.caoTrang.vks}` : ''}.`));
  if (rec.banAn?.so) body.push(P(`Bản án số ${rec.banAn.so}${rec.banAn.ngay ? ` ngày ${rec.banAn.ngay}` : ''}${rec.banAn.toa ? ` của ${rec.banAn.toa}` : ''}${rec.moc?.ngayHieuLuc ? `; có hiệu lực pháp luật ngày ${fmtDate(parseIso(rec.moc.ngayHieuLuc))}` : ''}.`));
  for (const d of defs) {
    const t = d.toiDanh?.[0] || {};
    body.push(P(`- Bị cáo ${d.hoTen}${d.namSinh ? `, sinh năm ${d.namSinh}` : ''}: ${t.dieu ? `${t.diem?.length ? `điểm ${t.diem.join(', ')} ` : ''}${t.khoan ? `khoản ${t.khoan} ` : ''}Điều ${t.dieu} BLHS${findCrime(t.dieu) ? ` (${findCrime(t.dieu).ten})` : ''}` : 'chưa rõ tội danh'}; hình phạt: ${hpText(d.hinhPhat)}${d.giamNhe?.length ? `; giảm nhẹ điểm ${d.giamNhe.join(', ')} khoản 1 Điều 51` : ''}${d.tangNang?.length ? `; tăng nặng điểm ${d.tangNang.join(', ')} khoản 1 Điều 52` : ''}.`));
  }
  if (rec.khangCao) body.push(P(`Kháng cáo, kháng nghị: ${String(rec.khangCao).split('\n').filter(Boolean).join('; ')}.`));
  const tl = (rec.sources || []).map((s) => `${s.name} (${typeLabel(s.loai)}${srcRange(s) ? `, ${srcRange(s)}` : ''})`);
  body.push(P(`Tài liệu đã nghiên cứu: ${tl.join('; ') || 'chưa có'}.`));
  // 2
  body.push(H('2. NỘI DUNG ĐƠN ĐỀ NGHỊ, KIẾN NGHỊ HOẶC KHÁNG NGHỊ'));
  if (!R.dons.length) body.push(P('Chưa có đơn đề nghị, kiến nghị, kháng nghị trong hồ sơ đã nạp.'));
  for (const { don, r } of R.dons) {
    body.push(H2(`${LOAI_DON[r.parsed.loai] || 'Đơn'} “${don.name}”${r.parsed.nguoi.hoTen ? ` — ${r.parsed.nguoi.hoTen}` : ''}${r.parsed.nguoi.tuCach ? ` (${r.parsed.nguoi.tuCach})` : ''}${r.parsed.ngay ? `, ngày ${r.parsed.ngay}` : ''}`));
    for (const it of r.items) body.push(P(`- ${it.label}${it.quotes[0] ? `: “${it.quotes[0]}”` : ''}`));
  }
  // 3
  body.push(H('3. KẾT QUẢ KIỂM TRA CHỨNG CỨ VÀ THỦ TỤC TỐ TỤNG'));
  for (const it of R.qs[1].items.filter((x) => x.muc !== 'xanh' || /Chưa phát hiện/.test(x.text))) body.push(...itemParas(it));
  for (const { r } of R.dons) for (const it of r.items.filter((x) => x.type === 'thu-tuc')) body.push(...itemParas({ muc: 'xam', text: `Thủ tục tố tụng (theo đơn): “${it.quotes[0] || ''}” — ${it.xacMinh[0]?.text || 'cần kiểm tra hồ sơ'}` }));
  // 4
  body.push(H('4. ĐÁNH GIÁ TỘI DANH, CẤU THÀNH TỘI PHẠM, VAI TRÒ TỪNG BỊ CÁO'));
  for (const d of defs) {
    const t = d.toiDanh?.[0];
    body.push(H2(`Bị cáo ${d.hoTen}${d.vaiTro ? ` — vai trò: ${{ 'dong-pham': 'đồng phạm', 'giup-suc-khong-dang-ke': 'người giúp sức, vai trò không đáng kể' }[d.vaiTro] || d.vaiTro}` : ''}`));
    if (t?.dieu) for (const e of elementMatrix(t.dieu, rec.sources || [])) body.push(P(`- ${e.label}${e.req ? '' : ' (không bắt buộc)'}: ${e.support.length ? `${e.onlyConfession ? 'chỉ có lời khai của bị can, bị cáo — ' : ''}${[...new Set(e.support.map((x) => x.src))].join('; ')}` : 'CHƯA CÓ CHỨNG CỨ trong tài liệu đã nạp'}.`));
  }
  for (const it of R.qs[0].items) body.push(...itemParas(it));
  // 5
  body.push(H('5. ĐÁNH GIÁ KHUNG HÌNH PHẠT VÀ CÁC TÌNH TIẾT TĂNG NẶNG, GIẢM NHẸ'));
  for (const { d, F } of R.checks) {
    body.push(H2(`Bị cáo ${d.hoTen || ''}`));
    for (const f of F.filter((x) => ['khung', 'muc', 'an-treo', 'tinh-tiet'].includes(x.nhom))) body.push(...itemParas({ muc: { loi: 'do', canh: 'vang', goi: 'vang', dung: 'xanh' }[f.level], text: [f.title, f.detail].filter(Boolean).join('. '), law: f.law, facts: f.facts }));
  }
  // 6
  body.push(H('6. PHÂN TÍCH CĂN CỨ PHÁP LUẬT, ÁN LỆ VÀ BẢN ÁN TƯƠNG TỰ'));
  for (const n of R.notes) body.push(P(`- ${n.text}`));
  if (R.anLe.length) for (const a of R.anLe) body.push(P(`- Án lệ ${a.so || ''} ${a.ten ? `(${a.ten})` : ''}: ${a.khaiQuat || a.giaiPhap || 'xem nguyên văn án lệ'}`));
  else body.push(P('- Kho án lệ của người dùng chưa có án lệ liên quan đến điều luật đang xét.'));
  for (const s of R.similar) {
    if (!s.stats) {
      body.push(P(`- ${s.d.hoTen || 'Bị cáo'}: kho bản án chưa có bản án tương tự (cùng điều luật).`));
      continue;
    }
    body.push(P(`- ${s.d.hoTen || 'Bị cáo'}: ${s.stats.n} bản án cùng ${s.stats.pham === 'khoan' ? 'điều, khoản' : 'điều (khác khoản)'} trong kho; mức tù ${s.stats.min != null ? `từ ${fmtMonths(s.stats.min)} đến ${fmtMonths(s.stats.max)}, trung vị ${fmtMonths(s.stats.median)}` : '—'}; ${s.stats.anTreo} bản án cho hưởng án treo.`));
    for (const x of s.items.slice(0, 5)) body.push(P(`  + ${x.doc.so || x.doc.ten}${x.doc.toa ? ` (${x.doc.toa})` : ''}: bị cáo ${x.bc.hoTen}, ${x.bc.khoan ? `khoản ${x.bc.khoan} ` : ''}Điều ${x.bc.dieu}${x.doc.soTien ? `, ${fmtVnd(x.doc.soTien)}` : ''} — ${hpText(x.bc.hinhPhat)}.`));
  }
  // 7
  body.push(H('7. ĐÁNH GIÁ TỪNG NỘI DUNG KIẾN NGHỊ'));
  if (!R.dons.length) body.push(P('Không có.'));
  for (const { don, r } of R.dons) {
    body.push(H2(`${don.name}: đơn ${KET_LUAN[r.overall].toLowerCase()}`));
    r.items.forEach((it, i) => {
      body.push(P([run(`${i + 1}. ${it.label}: `, { bold: true }), run(KET_LUAN[it.kl], { italic: true })]));
      for (const [k, lab] of [['co', 'Có căn cứ'], ['khong', 'Không có căn cứ'], ['xacMinh', 'Cần xác minh']]) for (const x of it[k]) body.push(...itemParas({ muc: '', text: `${lab}: ${x.text}`, law: x.law, facts: x.facts }));
    });
    for (const n of r.notes) body.push(P(`Lưu ý: ${n.text}`));
  }
  // 8
  body.push(H('8. ĐỀ XUẤT PHƯƠNG ÁN GIẢI QUYẾT, LÝ DO VÀ TÀI LIỆU CẦN BỔ SUNG'));
  body.push(P([run('Đề xuất: ', { bold: true }), run(`${R.deXuat.ten}.`)]));
  if (R.deXuat.canCu.length) body.push(P(`Căn cứ: ${R.deXuat.canCu.join('; ')}.`));
  for (const it of R.deXuat.lyDo) body.push(...itemParas(it));
  body.push(P(`Tài liệu cần bổ sung, xác minh: ${R.deXuat.boSung.join('; ') || 'không'}.`));
  // Phụ lục
  const rows = evidenceRows(rec, { book });
  if (rows.length) {
    body.push(H('PHỤ LỤC: BẢNG ĐỐI CHIẾU CHỨNG CỨ THEO BÚT LỤC'));
    body.push({ table: { widths: [0.06, 0.24, 0.4, 0.18, 0.12], header: ['STT', 'Vấn đề cần chứng minh', 'Nội dung (trích nguyên văn)', 'Tài liệu, bút lục', 'Ghi chú'], rows: rows.map((r, i) => [String(i + 1), `${r.bc}: ${r.van}`, r.quote ? `“${r.quote}”` : '—', r.src || '—', r.ghiChu]) } });
  }
  const d = new Date();
  return {
    typeId: 'bao-cao-tham-tra',
    header: { parent: up(org.toaAnCapTren), org: up(org.toaAn) || 'TÒA ÁN NHÂN DÂN ……', number: `Số: ……/${d.getFullYear()}/BC-TT`, subject: null, placeDate: `${org.diaDanh || '……'}, ${today()}` },
    title: { name: 'BÁO CÁO THẨM TRA', subject: `Vụ án ${rec.ten || ''}${defs.length ? ` — bị cáo ${defs.map((x) => x.hoTen).join(', ')}` : ''}` },
    authority: null,
    recipients: null,
    body,
    sign: { noiNhan: ['Lãnh đạo đơn vị', 'Lưu hồ sơ thẩm tra'], authority: null, position: 'THẨM TRA VIÊN', name: nguoi || '' },
    dualSign: null,
    signers: null,
  };
}

/** Dự thảo văn bản trả lời đơn đề nghị, kiến nghị (doc model). */
export function buildReplyLetter(rec, don, { book = null, org = {} } = {}) {
  const r = assessComplaint({ text: don.text, defendants: rec.defendants || [], sources: rec.sources || [], book, banAn: rec.banAn || {} });
  const n = r.parsed.nguoi;
  const body = [];
  body.push(P([run('Kính gửi: ', { bold: true }), run(`${n.hoTen ? `Ông/Bà ${n.hoTen}` : 'Người gửi đơn'}${n.diaChi ? ` — ${n.diaChi}` : ''}.`)], { indent: false, align: 'center' }));
  body.push(P(`${org.toaAn || 'Tòa án'} nhận được ${(LOAI_DON[r.parsed.loai] || 'đơn').toLowerCase()}${r.parsed.ngay ? ` đề ngày ${r.parsed.ngay}` : ''} của ${n.hoTen ? `ông/bà ${n.hoTen}` : 'ông/bà'}${n.tuCach ? ` (${n.tuCach.toLowerCase()})` : ''} đối với ${r.parsed.banAn.so || rec.banAn?.so ? `Bản án số ${r.parsed.banAn.so || rec.banAn.so}` : 'bản án'}${defsName(rec) ? ` xét xử bị cáo ${defsName(rec)}` : ''}.`));
  body.push(P('Sau khi nghiên cứu đơn và hồ sơ vụ án, Tòa án trả lời như sau:'));
  r.items.forEach((it, i) => {
    const why = (it.kl === 'khong' ? it.khong : it.kl === 'xac-minh' ? it.xacMinh : it.co)[0]?.text || '';
    const phrase = { co: 'có căn cứ và được xem xét theo quy định của pháp luật', 'mot-phan': 'có căn cứ một phần và được xem xét theo quy định của pháp luật', khong: 'không có căn cứ để chấp nhận', 'xac-minh': 'đang được xác minh, Tòa án sẽ thông báo kết quả khi có đủ tài liệu' }[it.kl];
    body.push(P(`${i + 1}. Về nội dung ${it.label.toLowerCase()}: ${phrase}.${why ? ` Lý do: ${why}` : ''}`));
  });
  body.push(P('Trên đây là trả lời của Tòa án đối với đơn của ông/bà./.'));
  return {
    typeId: 'tra-loi-don',
    header: { parent: up(org.toaAnCapTren), org: up(org.toaAn) || 'TÒA ÁN NHÂN DÂN ……', number: `Số: ……/TB-TA`, subject: `V/v trả lời ${(LOAI_DON[r.parsed.loai] || 'đơn').toLowerCase()}`, placeDate: `${org.diaDanh || '……'}, ${today()}` },
    title: null,
    authority: null,
    recipients: null,
    body,
    sign: { noiNhan: ['Như trên', 'Lưu hồ sơ'], authority: null, position: 'CHÁNH ÁN', name: '' },
    dualSign: null,
    signers: null,
  };
}
const defsName = (rec) => (rec.defendants || []).map((d) => d.hoTen).filter(Boolean).join(', ');

/** Sổ Excel thẩm tra: chứng cứ theo bút lục, rà soát chứng cứ, 5 câu hỏi, bản án tương tự. */
export function thamTraWorkbook(rec, { book = null, laws = DEFAULT_LAWS, docs = [] } = {}) {
  const R = thamTra(rec, { book, laws, docs });
  const rows = evidenceRows(rec, { book });
  return buildXlsx([
    { name: 'Chứng cứ theo bút lục', header: ['STT', 'Bị cáo', 'Vấn đề cần chứng minh', 'Nội dung (trích nguyên văn)', 'Tài liệu, bút lục', 'Loại tài liệu', 'Ghi chú'], rows: rows.map((r, i) => [i + 1, r.bc, r.van, r.quote, r.src, r.loai, r.ghiChu]), widths: [6, 18, 40, 70, 30, 22, 26] },
    { name: 'Rà soát chứng cứ', header: ['STT', 'Mức', 'Nội dung', 'Trích dẫn', 'Tài liệu, bút lục'], rows: R.ev.map((f, i) => [i + 1, { thieu: 'Thiếu', 'mau-thuan': 'Mâu thuẫn', canh: 'Cần xem xét', dat: 'Đạt' }[f.muc], [f.title, f.detail].filter(Boolean).join('. '), (f.facts || []).map((x) => `“${x.quote}”`).join('\n'), (f.facts || []).map((x) => x.src).join('\n')]), widths: [6, 14, 60, 70, 30] },
    { name: '5 câu hỏi', header: ['Câu hỏi', 'Kết luận', 'Nội dung', 'Căn cứ'], rows: R.qs.flatMap((q) => q.items.map((it, i) => [i ? '' : q.hoi, MUC[it.muc] || '', it.text, [...(it.law || []).map((l) => l.ref), ...(it.facts || []).map((f) => f.src)].filter(Boolean).join('; ')])), widths: [40, 22, 80, 40] },
    { name: 'Bản án tương tự', header: ['Bị cáo đang xét', 'Bản án', 'Tòa án', 'Bị cáo', 'Điều, khoản', 'Giá trị tài sản', 'Hình phạt', 'Mức độ tương tự'], rows: R.similar.flatMap((s) => s.items.map((x) => [s.d.hoTen || '', x.doc.so || x.doc.ten, x.doc.toa || '', x.bc.hoTen, `${x.bc.khoan ? `khoản ${x.bc.khoan} ` : ''}Điều ${x.bc.dieu}`, x.doc.soTien ? fmtVnd(x.doc.soTien) : '', hpText(x.bc.hinhPhat), x.ly.join(', ')])), widths: [20, 22, 30, 20, 16, 20, 22, 40] },
  ]);
}
