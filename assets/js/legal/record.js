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
  ['soDinhDanh', 'Số định danh cá nhân / CCCD'],
  ['ngayCap', 'Ngày cấp'],
  ['noiCap', 'Nơi cấp'],
  ['noiCuTru', 'Nơi cư trú'],
  ['noiLamViec', 'Nơi làm việc, học tập'],
  ['soDienThoai', 'Số điện thoại'],
  ['quanHe', 'Quan hệ với bị can, bị hại, vụ án'],
];

const DOTS = '……………………………………………………………………………………………………';

/** "Hồi 08 giờ 30 phút, ngày 05 tháng 10 năm 2026" */
export function formatMoment(dateStr, timeStr) {
  const d = toDate(dateStr || new Date());
  const [hh = '', mm = ''] = String(timeStr || '').split(':');
  const p2 = (n) => String(n).padStart(2, '0');
  return `Hồi ${hh ? p2(hh) : '…'} giờ ${mm ? p2(mm) : '…'} phút, ngày ${p2(d.getDate())} tháng ${d.getMonth() + 1 <= 2 ? p2(d.getMonth() + 1) : d.getMonth() + 1} năm ${d.getFullYear()}`;
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
    mauSo: org.mauSo || '',
    thongTu: org.thongTu || '',
    status: 'dang-ghi',
  };
}

/**
 * Dựng doc model biên bản theo BLTTHS 2015 (sửa đổi, bổ sung năm 2021, 2025 — Luật số 99/2025/QH15).
 * Câu hỏi chưa có câu trả lời được in thành dòng chấm để điền tay (phiếu hỏi in sẵn).
 */
export function buildRecordDocument(rec) {
  const role = getRole(rec.roleId);
  const hoiCung = role.id === 'bi-can';
  const act = hoiCung ? 'hỏi cung' : 'lấy lời khai';
  const nk = rec.nguoiKhai || {};
  const crime = rec.plan?.dieu ? findCrime(rec.plan.dieu) : null;
  const body = [];

  body.push(para(`${formatMoment(rec.ngay, rec.gioBatDau)}, tại ${blank(rec.diaDiem)}.`));
  const nth = (rec.nguoiTienHanh || []).filter((x) => x.hoTen || x.chucDanh);
  const coQuan = String(rec.coQuan || '').trim();
  body.push(para([run(nth.length > 1 ? 'Chúng tôi gồm: ' : 'Tôi: ', { bold: true }), run(nth.length ? nth.map((x) => `${x.hoTen || '…………'} — ${x.chucDanh || '…………'}`).join('; ') : '…………'), run(coQuan ? ` thuộc ${coQuan}` : '')]));
  body.push(para([run('Người ghi biên bản: ', { bold: true }), run(blank(rec.nguoiGhi))]));
  const tg = (rec.thamGia || []).filter((x) => x.hoTen);
  body.push(para([run('Với sự tham gia của: ', { bold: true }), run(tg.length ? tg.map((x) => `${x.hoTen} (${x.tuCach || 'người tham gia'})`).join('; ') : '…………')]));
  const canCu = String(rec.canCu || '').trim() || canCuText(role);
  body.push(para(`Căn cứ ${canCu.replace(/^căn cứ\s+/i, '').replace(/[.,;:]+$/, '')}, tiến hành ${hoiCung ? 'hỏi cung bị can' : `ghi lời khai của ${role.ten.toLowerCase()}`}:`));

  body.push(para([run('Họ và tên: ', { bold: true }), run(upper(nk.hoTen) || '…………'), run(nk.tenGoiKhac ? `; tên gọi khác: ${nk.tenGoiKhac}` : ''), run(`; giới tính: ${blank(nk.gioiTinh, '……')}`)]));
  body.push(para(`Sinh ngày: ${blank(nk.ngaySinh)}; nơi sinh: ${blank(nk.noiSinh)}; quốc tịch: ${blank(nk.quocTich, '……')}; dân tộc: ${blank(nk.danToc, '……')}; tôn giáo: ${blank(nk.tonGiao, '……')}.`));
  body.push(para(`Nghề nghiệp, chức vụ: ${blank(nk.ngheNghiep)}; nơi làm việc, học tập: ${blank(nk.noiLamViec)}.`));
  body.push(para(`Số định danh cá nhân/thẻ căn cước: ${blank(nk.soDinhDanh)}; cấp ngày: ${blank(nk.ngayCap, '……')}; nơi cấp: ${blank(nk.noiCap)}.`));
  body.push(para(`Nơi cư trú: ${blank(nk.noiCuTru)}.${nk.soDienThoai ? ` Số điện thoại: ${nk.soDienThoai}.` : ''}`));
  if (!hoiCung) body.push(para(`Quan hệ với bị can, bị hại, vụ án: ${blank(nk.quanHe)}.`));
  if (rec.tenVu || crime) body.push(para([run('Về vụ án/vụ việc: ', { bold: true }), run(`${(rec.tenVu || `có dấu hiệu ${crime.ten.toLowerCase()} (Điều ${crime.dieu} Bộ luật Hình sự)`).replace(/[.;]+$/, '')}.`)]));
  if (rec.lan > 1) body.push(para(`Đây là lần ${act} thứ ${rec.lan}.`));
  body.push(para(`Trước khi ${act}, ${nth.length > 1 ? 'chúng tôi' : 'tôi'} đã thông báo, giải thích quyền và nghĩa vụ của ${role.ten.toLowerCase()} theo quy định tại ${role.quyen}${rec.daThongBaoQuyen ? '; người khai xác nhận đã được nghe, hiểu rõ quyền và nghĩa vụ của mình' : ''}.`));
  if (role.canhBao) body.push(para([run(role.canhBao, { italic: true })]));
  if (hoiCung) body.push(para(`Việc hỏi cung bị can tại cơ sở giam giữ hoặc tại trụ sở Cơ quan điều tra phải được ghi âm hoặc ghi hình có âm thanh theo khoản 6 Điều 183 Bộ luật Tố tụng hình sự${rec.ghiAmGhiHinh ? '; buổi hỏi cung này có ghi âm, ghi hình có âm thanh' : ''}.`));
  else if (rec.ghiAmGhiHinh) body.push(para('Việc lấy lời khai có ghi âm hoặc ghi hình có âm thanh theo quy định của Bộ luật Tố tụng hình sự.'));

  body.push(para([run('NỘI DUNG', { bold: true })], { align: 'center', indent: false, spaceBefore: true }));
  const qa = (rec.qa || []).filter((x) => String(x.q || '').trim() || String(x.a || '').trim());
  if (!qa.length) body.push(para('[Chưa có nội dung hỏi – đáp]'));
  qa.forEach((x) => {
    body.push(para([run('Hỏi: ', { bold: true }), run(String(x.q || '').trim())], { cls: 'vb-q' }));
    const a = String(x.a || '').trim();
    body.push(para([run('Trả lời: ', { bold: true }), run(a || DOTS)], { cls: a ? 'vb-a' : 'vb-a vb-blank' }));
    if (!a) body.push(para(DOTS, { indent: false, cls: 'vb-blank' }));
  });

  const nguoiNghe = hoiCung ? 'bị can' : 'người khai';
  body.push(
    para(
      `Việc ${act} kết thúc ${rec.gioKetThuc ? `hồi ${rec.gioKetThuc.replace(':', ' giờ ')} phút` : 'hồi … giờ … phút'} cùng ngày. Biên bản gồm ${rec.soTrang || '……'} trang, đã được đọc lại cho ${nguoiNghe} nghe (hoặc ${nguoiNghe} tự đọc lại), ${nguoiNghe} xác nhận đúng lời khai của mình, không bổ sung, sửa chữa gì và cùng ký xác nhận vào từng trang của biên bản. Biên bản được lập thành ${rec.soBan || 2} bản.`,
      { spaceBefore: true },
    ),
  );

  const signers = [
    { title: hoiCung ? 'BỊ CAN' : 'NGƯỜI KHAI', hint: '(Ký, ghi rõ họ tên)', name: nk.hoTen || '' },
    ...tg.map((x) => ({ title: upper(x.tuCach || 'NGƯỜI THAM GIA'), hint: '(Ký, ghi rõ họ tên)', name: x.hoTen })),
    { title: 'NGƯỜI GHI BIÊN BẢN', hint: '(Ký, ghi rõ họ tên)', name: rec.nguoiGhi || '' },
    { title: upper(nth[0]?.chucDanh || 'ĐIỀU TRA VIÊN'), hint: '(Ký, ghi rõ họ tên)', name: nth[0]?.hoTen || '' },
  ];
  const mauSo = String(rec.mauSo || '').trim();
  const thongTu = String(rec.thongTu || '').trim();

  return {
    typeId: 'bien-ban-loi-khai',
    formNo: mauSo || thongTu ? [mauSo && (/^mẫu/i.test(mauSo) ? mauSo : `Mẫu số ${mauSo}`), thongTu && (/^ban hành/i.test(thongTu) ? thongTu : `Ban hành kèm theo ${thongTu}`)].filter(Boolean) : null,
    header: { parent: upper(rec.coQuanCapTren), org: upper(rec.coQuan), number: '', subject: null, placeDate: '' },
    title: { name: role.bienBan, subject: role.phuDe || '' },
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
