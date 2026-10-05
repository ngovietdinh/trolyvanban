// Biên bản ghi lời khai / hỏi cung và kế hoạch lấy lời khai → doc model (dùng chung cho xem trước A4 và xuất Word).
import { getRole, canCuText } from './roles.js';
import { findCrime } from './engine.js';
import { toDate } from '../lib/vn-date.js';

const upper = (s) => String(s || '').trim().toLocaleUpperCase('vi-VN');
const run = (text, opts = {}) => ({ text, ...opts });
const para = (runs, opts = {}) => ({ runs: Array.isArray(runs) ? runs : [run(runs)], align: 'justify', indent: true, ...opts });
const blank = (v, w = '…………') => (String(v ?? '').trim() ? String(v).trim() : w);

export const PERSON_FIELDS = [
  ['hoTen', 'Họ và tên', true],
  ['tenGoiKhac', 'Tên gọi khác'],
  ['gioiTinh', 'Giới tính'],
  ['ngaySinh', 'Ngày sinh'],
  ['noiSinh', 'Nơi sinh'],
  ['quocTich', 'Quốc tịch'],
  ['danToc', 'Dân tộc'],
  ['tonGiao', 'Tôn giáo'],
  ['ngheNghiep', 'Nghề nghiệp, chức vụ'],
  ['soDinhDanh', 'Số thẻ CCCD / định danh cá nhân'],
  ['ngayCap', 'Ngày cấp'],
  ['noiCap', 'Nơi cấp'],
  ['noiCuTru', 'Nơi thường trú'],
  ['noiOHienTai', 'Nơi ở hiện tại'],
  ['noiLamViec', 'Nơi làm việc, học tập'],
  ['soDienThoai', 'Số điện thoại liên hệ'],
  ['quanHe', 'Quan hệ với bị can, bị hại, vụ án'],
];

const DOTS = '……………………………………………………………………………………………………';

/** "Hồi 9 giờ 00 phút ngày 5 tháng 10 năm 2026" — đúng cách ghi của Mẫu số 140. */
export function formatMoment(dateStr, timeStr) {
  const d = toDate(dateStr || new Date());
  const [hh = '', mm = ''] = String(timeStr || '').split(':');
  return `Hồi ${hh ? +hh : '…'} giờ ${mm ? String(+mm).padStart(2, '0') : '…'} phút ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
}

/** Biểu mẫu mặc định theo Thông tư 128/2025/TT-BCA ngày 19/12/2025. */
export const FORM_DEFAULTS = { mauSoGLK: '140', mauSoHC: '', thongTu: 'TT số 128/2025/TT-BCA ngày 19/12/2025' };
export const FORM_NOTE_GLK = 'Sử dụng để ghi lời khai của người tham gia tố tụng được quy định tại Điều 55 BLTTHS; Biên bản này có thể viết tay hoặc đánh máy;';
export const FORM_NOTE_HC = 'Sử dụng để hỏi cung bị can; Biên bản này có thể viết tay hoặc đánh máy;';
const pick = (v, def) => (v === undefined || v === null || String(v).trim() === '' ? def : String(v).trim());
const hidden = (v) => /^(-|không|khong)$/i.test(String(v || '').trim());

/** Ô "Mẫu số" góc phải: ["Mẫu số: 140", "BH theo TT số 128/2025/TT-BCA", "ngày 19/12/2025"]. */
export function formNoLines(mauSo, thongTu) {
  if (!mauSo || hidden(mauSo)) return null; // chưa có số mẫu → không in ô mẫu số
  const out = [];
  if (mauSo && !hidden(mauSo)) out.push(/^mẫu/i.test(mauSo) ? mauSo : `Mẫu số: ${mauSo}`);
  if (thongTu && !hidden(thongTu)) {
    const t = thongTu.replace(/^(ban hành kèm theo|bh theo|ban hành theo)\s*/i, '');
    const m = /^(.*?)\s+(ngày\s+.+)$/i.exec(t);
    if (m) out.push(`BH theo ${m[1]}`, m[2]);
    else out.push(`BH theo ${t}`);
  }
  return out.length ? out : null;
}

/** "26/05/1971" → "26 tháng 05 năm 1971"; giữ nguyên nếu không đúng dạng. */
function ngaySinhText(v) {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(String(v || '').trim());
  if (m) return `${m[1].padStart(2, '0')} tháng ${m[2].padStart(2, '0')} năm ${m[3]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '').trim());
  if (iso) return `${iso[3]} tháng ${iso[2]} năm ${iso[1]}`;
  return String(v || '').trim();
}

export function newRecord({ caseItem = null, person = null, roleId = 'bi-can', plan = null, settings = {} } = {}) {
  const now = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const org = settings.legalOrg || {};
  return {
    caseId: caseItem?.id || null,
    personId: person?.id || null,
    roleId: person?.roleId || roleId,
    lan: 1,
    ngay: `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`,
    gioBatDau: `${p2(now.getHours())}:${p2(now.getMinutes())}`,
    gioKetThuc: '',
    diaDiem: org.diaDiem || '',
    coQuanCapTren: caseItem?.coQuanCapTren || org.coQuanCapTren || '',
    coQuan: caseItem?.coQuan || org.coQuan || '',
    tenVu: caseItem?.ten || '',
    nguoiTienHanh: [{ hoTen: caseItem?.dieuTraVien || org.dieuTraVien || '', chucDanh: org.chucDanh || 'Điều tra viên' }],
    nguoiGhi: '',
    thamGia: [],
    nguoiKhai: person ? Object.fromEntries(PERSON_FIELDS.map(([k]) => [k, person[k] || ''])) : { hoTen: '', quocTich: 'Việt Nam' },
    daThongBaoQuyen: false,
    ghiAmGhiHinh: false,
    qa: [],
    plan: plan ? { dieu: plan.crime?.dieu || plan.dieu, roleId: plan.role?.id || plan.roleId, hanhViIds: (plan.hanhVi || []).map((h) => h.id || h), dinhKhung: plan.dinhKhung || [], issues: plan.issues } : null,
    coverage: {},
    soBan: 2,
    canCu: '',
    mauSoGLK: pick(org.mauSo, FORM_DEFAULTS.mauSoGLK),
    mauSoHC: pick(org.mauSoHoiCung, FORM_DEFAULTS.mauSoHC),
    thongTu: pick(org.thongTu, FORM_DEFAULTS.thongTu),
    cachDoc: 'tu-doc',
    status: 'dang-ghi',
  };
}

/**
 * Dựng doc model biên bản ghi lời khai / hỏi cung bị can theo Mẫu số 140 (TT 128/2025/TT-BCA):
 * ô mẫu số góc phải, quốc hiệu căn giữa, "Tôi: …", căn cứ, nhân thân, "HỎI VÀ ĐÁP", chữ ký NGƯỜI KHAI – ĐIỀU TRA VIÊN.
 * Câu hỏi chưa có câu trả lời được in thành dòng chấm để điền tay (phiếu hỏi in sẵn).
 */
export function buildRecordDocument(rec) {
  const role = getRole(rec.roleId);
  const hoiCung = role.id === 'bi-can';
  const act = hoiCung ? 'hỏi cung' : 'ghi lời khai';
  const ng = hoiCung ? 'bị can' : 'người khai';
  const nk = rec.nguoiKhai || {};
  const body = [];
  const L = (runs, o = {}) => para(runs, { indent: false, ...o });
  const lbl = (t) => run(t);

  body.push(para(`${formatMoment(rec.ngay, rec.gioBatDau)} tại ${blank(rec.diaDiem)}.`));
  const nth = (rec.nguoiTienHanh || []).filter((x) => x.hoTen || x.chucDanh);
  const coQuan = String(rec.coQuan || '').trim();
  // Tên cơ quan nhập kiểu tiêu đề (IN HOA) → viết thường như trong câu văn của mẫu.
  const coQuanText = coQuan && coQuan === coQuan.toLocaleUpperCase('vi-VN') ? coQuan.charAt(0) + coQuan.slice(1).toLocaleLowerCase('vi-VN') : coQuan;
  const who = (x) => [run(x.hoTen || '…………', { bold: true }), run(`, ${x.chucDanh || 'Điều tra viên'}${coQuanText ? ` thuộc ${coQuanText}` : ''}`)];
  if (nth.length <= 1) body.push(para([run('Tôi: '), ...who(nth[0] || {}), run('.')]));
  else body.push(para([run('Chúng tôi gồm: '), ...nth.flatMap((x, i) => [...(i ? [run('; ')] : []), ...who(x)]), run('.')]));
  if (rec.nguoiGhi) body.push(para([run('Người ghi biên bản: '), run(rec.nguoiGhi, { bold: true }), run('.')]));
  const tg = (rec.thamGia || []).filter((x) => x.hoTen);
  if (tg.length) body.push(para([run('Với sự tham gia của: '), run(tg.map((x) => `${x.hoTen} (${x.tuCach || 'người tham gia'})`).join('; ')), run('.')]));
  const canCu = (String(rec.canCu || '').trim() || canCuText(role)).replace(/^căn cứ\s+/i, '').replace(/[.,;:]+$/, '');
  body.push(para(`Căn cứ ${canCu}, tiến hành ${hoiCung ? 'hỏi cung bị can' : 'lập biên bản ghi lời khai của'}:`));

  // Nhân thân — viết liền, không thụt đầu dòng như mẫu.
  body.push(para([lbl('Họ tên: '), run(nk.hoTen ? String(nk.hoTen).trim() : '…………', { bold: true }), run('\t\t'), lbl(`Giới tính: ${blank(nk.gioiTinh, '……')};`)]));
  body.push(L(`Tên gọi khác: ${blank(nk.tenGoiKhac, 'Không')};`));
  body.push(L(`Sinh ngày ${blank(ngaySinhText(nk.ngaySinh))} tại ${blank(nk.noiSinh)};`));
  body.push(L(`Quốc tịch: ${blank(nk.quocTich, '……')}; dân tộc: ${blank(nk.danToc, '……')}; Tôn giáo: ${blank(nk.tonGiao, '……')}`));
  body.push(L(`Nghề nghiệp: ${blank(nk.ngheNghiep)}`));
  if (nk.noiLamViec) body.push(L(`Nơi làm việc, học tập: ${nk.noiLamViec}`));
  body.push(L(`Thẻ CCCD: ${blank(nk.soDinhDanh)}; cấp ngày: ${blank(nk.ngayCap, '……')};`));
  body.push(L(`Nơi cấp: ${blank(nk.noiCap)}.`));
  body.push(L(`Số điện thoại liên hệ: ${blank(nk.soDienThoai)};`));
  body.push(L(`Nơi thường trú: ${blank(nk.noiCuTru)};`));
  body.push(L(`Nơi ở hiện tại: ${blank(nk.noiOHienTai || nk.noiCuTru)};`));
  body.push(L(`Tư cách tham gia tố tụng: ${role.ten.split('/')[0].trim()}.`));
  if (!hoiCung && nk.quanHe) body.push(L(`Quan hệ với bị can, bị hại, vụ án: ${nk.quanHe}.`));
  if (rec.tenVu) body.push(L(`Vụ án/vụ việc: ${String(rec.tenVu).replace(/[.;]+$/, '')}.`));
  if (rec.lan > 1) body.push(L(`Đây là lần ${act} thứ ${rec.lan}.`));
  body.push(L(`${hoiCung ? 'Bị can' : 'Người khai'} đã được giải thích quyền và nghĩa vụ của mình theo quy định tại ${role.quyen} và cam đoan chịu trách nhiệm về lời khai của mình.`));
  if (role.canhBao) body.push(L([run(role.canhBao, { italic: true })]));
  if (rec.ghiAmGhiHinh) body.push(L(`Việc ${act} có ghi âm hoặc ghi hình có âm thanh${hoiCung ? ' theo khoản 6 Điều 183 Bộ luật Tố tụng hình sự' : ''}.`));

  body.push(para([run('HỎI VÀ ĐÁP', { bold: true })], { align: 'center', indent: false, spaceBefore: true, spaceAfter: true }));
  const qa = (rec.qa || []).filter((x) => String(x.q || '').trim() || String(x.a || '').trim());
  if (!qa.length) body.push(para('[Chưa có nội dung hỏi – đáp]'));
  qa.forEach((x) => {
    const q = String(x.q || '').trim().split(/\n+/);
    body.push(para([run('Hỏi: ', { bold: true }), run(q[0])], { cls: 'vb-q' }));
    q.slice(1).forEach((l) => body.push(para(l)));
    const a = String(x.a || '').trim();
    if (!a) {
      body.push(para([run('Đáp: ', { bold: true }), run(DOTS)], { cls: 'vb-a vb-blank' }));
      body.push(para(DOTS, { indent: false, cls: 'vb-blank' }));
      return;
    }
    const lines = a.split(/\n+/);
    body.push(para([run('Đáp: ', { bold: true }), run(lines[0])], { cls: 'vb-a' }));
    lines.slice(1).forEach((l) => body.push(para(l, { cls: 'vb-a' })));
  });

  const ket = rec.gioKetThuc ? `hồi ${+rec.gioKetThuc.split(':')[0]} giờ ${rec.gioKetThuc.split(':')[1] || '00'} phút` : 'hồi … giờ … phút';
  const doc = rec.cachDoc === 'doc-nghe' ? `đã đọc lại cho ${ng} nghe` : `đã cho ${ng} tự đọc lại`;
  body.push(para(`Việc ${act} kết thúc ${ket} cùng ngày. Biên bản này ${doc}, công nhận đúng và ký tên xác nhận dưới đây./.`));

  const signers = [
    { title: hoiCung ? 'BỊ CAN' : 'NGƯỜI KHAI', name: '' },
    { title: upper(nth[0]?.chucDanh || 'ĐIỀU TRA VIÊN'), name: nth[0]?.hoTen || '' },
    ...(rec.nguoiGhi ? [{ title: 'NGƯỜI GHI BIÊN BẢN', name: rec.nguoiGhi }] : []),
    ...tg.map((x) => ({ title: upper(x.tuCach || 'NGƯỜI THAM GIA'), name: x.hoTen })),
  ];
  const mauSo = hoiCung ? pick(rec.mauSoHC, FORM_DEFAULTS.mauSoHC) : pick(rec.mauSoGLK ?? rec.mauSo, FORM_DEFAULTS.mauSoGLK);
  const thongTu = pick(rec.thongTu, FORM_DEFAULTS.thongTu);

  return {
    typeId: 'bien-ban-loi-khai',
    layout: 'form',
    pageNumbers: true,
    formNo: formNoLines(mauSo, thongTu),
    header: { parent: '', org: '', number: '', subject: null, placeDate: '' },
    title: { name: role.bienBan, subject: '', note: hoiCung ? FORM_NOTE_HC : FORM_NOTE_GLK },
    authority: null,
    recipients: null,
    body,
    sign: null,
    dualSign: null,
    signers,
  };
}

/** Văn bản thuần của phần hỏi – đáp (dùng cho AI, sao chép). */
export function qaToText(rec) {
  return (rec.qa || [])
    .filter((x) => x.q || x.a)
    .map((x, i) => `[${i + 1}] Hỏi: ${x.q}\nTrả lời: ${x.a || '(chưa trả lời)'}`)
    .join('\n\n');
}

/** Kế hoạch lấy lời khai → doc model để in/xuất Word. */
export function buildPlanDocument(plan, { coQuan = '', coQuanCapTren = '', tenVu = '', dieuTraVien = '' } = {}) {
  const body = [];
  body.push(para([run('Tội danh: ', { bold: true }), run(`Điều ${plan.crime.dieu} Bộ luật Hình sự — ${plan.crime.ten}.`)]));
  if (tenVu) body.push(para([run('Vụ án/vụ việc: ', { bold: true }), run(tenVu)]));
  body.push(para([run('Đối tượng lấy lời khai: ', { bold: true }), run(plan.role.ten + '.')]));
  body.push(para([run('Hành vi cần làm rõ: ', { bold: true }), run(plan.hanhVi.map((h) => h.ten).join('; ') + '.')]));
  if (plan.dinhKhung?.length) body.push(para([run('Tình tiết định khung cần làm rõ: ', { bold: true }), run(plan.dinhKhung.join('; ') + '.')]));
  plan.issues.forEach((is, i) => {
    body.push(para([run(`${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'][i] || i + 1}. ${upper(is.tieuDe)}`, { bold: true })], { spaceBefore: true }));
    body.push(para([run(`Căn cứ: ${is.canCu}. ${is.moTa || ''}`, { italic: true })]));
    is.cauHoi.forEach((c, j) => body.push(para(`${j + 1}. ${c.text}`)));
  });
  if (plan.taiLieu?.length) {
    body.push(para([run('TÀI LIỆU CẦN THU THẬP', { bold: true })], { spaceBefore: true }));
    plan.taiLieu.forEach((t) => body.push(para(`- ${t}.`)));
  }
  if (plan.giamDinh?.length) {
    body.push(para([run('TRƯNG CẦU GIÁM ĐỊNH, ĐỊNH GIÁ', { bold: true })], { spaceBefore: true }));
    plan.giamDinh.forEach((t) => body.push(para(`- ${t}.`)));
  }
  return {
    typeId: 'ke-hoach-hoi',
    header: { parent: upper(coQuanCapTren), org: upper(coQuan), number: '', subject: null, placeDate: '' },
    title: { name: 'KẾ HOẠCH LẤY LỜI KHAI', subject: plan.role.ten },
    authority: null,
    recipients: null,
    body,
    sign: null,
    dualSign: null,
    signers: [{ title: 'ĐIỀU TRA VIÊN', hint: '(Ký, ghi rõ họ tên)', name: dieuTraVien }],
  };
}

/** Đưa toàn bộ câu hỏi của kế hoạch vào phần hỏi – đáp (chưa có câu trả lời), bỏ qua câu đã có. */
export function prefillQa(rec, uidFn = () => Math.random().toString(36).slice(2, 10)) {
  const have = new Set((rec.qa || []).map((x) => x.planQ).filter(Boolean));
  const add = [];
  for (const is of rec.plan?.issues || []) {
    for (const c of is.cauHoi || []) {
      if (have.has(c.id)) continue;
      add.push({ id: uidFn(), q: c.text, a: '', issueId: is.id, planQ: c.id, at: null });
    }
  }
  rec.qa = [...(rec.qa || []), ...add];
  return add.length;
}

/* ---------------- Dán văn bản ghi chép → hỏi – đáp theo mẫu biên bản ---------------- */
const Q_MARK = /^\s*(?:\d{1,3}\s*[.)]\s*)?(?:câu\s*hỏi|hỏi|h|q)\s*(?:\d{1,3}\s*)?[:.\-–—]\s*/i;
const A_MARK = /^\s*(?:trả\s*lời|tl|đáp|đ|a)\s*[:.\-–—]\s*/i;
const keyText = (t) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * Tách văn bản dán vào thành các cặp hỏi – đáp.
 * Nhận diện dòng bắt đầu bằng "Hỏi:", "H:", "Câu hỏi 1:", "Trả lời:", "TL:", "Đáp:", "Đ:".
 * Không có dấu hiệu nào → trả về các đoạn văn (paragraphs) để ghép với câu hỏi chưa trả lời.
 */
export function parsePastedQa(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const pairs = [];
  const pre = []; // đoạn văn đứng trước dấu hiệu "Hỏi:" đầu tiên
  let cur = null;
  let mode = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!cur && !Q_MARK.test(line) && !A_MARK.test(line)) {
      pre.push(raw);
      continue;
    }
    if (Q_MARK.test(line)) {
      cur = { q: line.replace(Q_MARK, '').trim(), a: '' };
      pairs.push(cur);
      mode = 'q';
    } else if (A_MARK.test(line)) {
      if (!cur) {
        cur = { q: '', a: '' };
        pairs.push(cur);
      }
      cur.a = [cur.a, line.replace(A_MARK, '').trim()].filter(Boolean).join('\n');
      mode = 'a';
    } else if (cur && line) {
      cur[mode] = [cur[mode], line].filter(Boolean).join(mode === 'a' ? '\n' : ' ');
    }
  }
  const paras = (t) =>
    t
      .split(/\n\s*\n|\n(?=\s*[-•–]\s)/)
      .map((p) => p.replace(/^\s*[-•–]\s*/, '').replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean);
  if (pairs.length) return { pairs: pairs.filter((p) => p.q || p.a), paragraphs: paras(pre.join('\n')) };
  const paragraphs = String(text || '')
    .replace(/\r/g, '')
    .split(/\n\s*\n|\n(?=\s*[-•–]\s)/)
    .map((p) => p.replace(/^\s*[-•–]\s*/, '').replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
  return { pairs: [], paragraphs: paragraphs.length > 1 ? paragraphs : String(text || '').trim() ? [String(text).trim()] : [] };
}

/**
 * Lập kế hoạch đưa nội dung dán vào biên bản (chưa sửa rec):
 * - cặp hỏi – đáp trùng câu hỏi đã có mà chưa trả lời → điền câu trả lời vào đúng lượt đó;
 * - còn lại → thêm lượt mới;
 * - chỉ có đoạn văn → ghép lần lượt với các câu hỏi chưa trả lời (nếu có).
 * Trả về [{ index (lượt sẽ điền, -1 = thêm mới), q, a }].
 */
export function planPastedQa(rec, parsed) {
  const qa = rec.qa || [];
  const pendingIdx = qa.map((x, i) => (String(x.a || '').trim() ? -1 : i)).filter((i) => i >= 0);
  const used = new Set();
  const fromParas = (list) =>
    list.map((a) => {
      const i = pendingIdx.find((j) => !used.has(j));
      if (i !== undefined) {
        used.add(i);
        return { index: i, q: qa[i].q, a };
      }
      return { index: -1, q: '[Câu hỏi]', a };
    });
  if (parsed.pairs.length) {
    // Khớp câu hỏi trùng trước, rồi mới ghép các đoạn trả lời rời với câu hỏi chưa trả lời còn lại.
    const matched = parsed.pairs.map((p) => {
      const k = keyText(p.q);
      const i = k ? pendingIdx.find((j) => !used.has(j) && keyText(qa[j].q) === k) : undefined;
      if (i !== undefined) {
        used.add(i);
        return { index: i, q: qa[i].q, a: p.a };
      }
      return { index: -1, q: p.q || '[Câu hỏi]', a: p.a };
    });
    return [...fromParas(parsed.paragraphs || []), ...matched];
  }
  return fromParas(parsed.paragraphs);
}

/** Áp dụng kế hoạch vào biên bản. Trả về { filled, added }. */
export function applyPastedQa(rec, items, uidFn = () => Math.random().toString(36).slice(2, 10)) {
  let filled = 0;
  let added = 0;
  rec.qa = [...(rec.qa || [])];
  for (const it of items) {
    if (!String(it.a || '').trim() && !String(it.q || '').trim()) continue;
    if (it.index >= 0 && rec.qa[it.index]) {
      rec.qa[it.index] = { ...rec.qa[it.index], a: it.a, at: rec.qa[it.index].at || Date.now() };
      filled++;
    } else {
      rec.qa.push({ id: uidFn(), q: it.q, a: it.a, issueId: null, planQ: null, at: Date.now() });
      added++;
    }
  }
  return { filled, added };
}
