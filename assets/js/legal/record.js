// Biên bản ghi lời khai / hỏi cung và kế hoạch lấy lời khai → doc model (dùng chung cho xem trước A4 và xuất Word).
import { getRole } from './roles.js';
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
  ['soDienThoai', 'Số điện thoại'],
];

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
    status: 'dang-ghi',
  };
}

/** Dựng doc model biên bản. */
export function buildRecordDocument(rec) {
  const role = getRole(rec.roleId);
  const hoiCung = role.id === 'bi-can';
  const act = hoiCung ? 'hỏi cung' : 'lấy lời khai';
  const nk = rec.nguoiKhai || {};
  const crime = rec.plan?.dieu ? findCrime(rec.plan.dieu) : null;
  const body = [];

  body.push(para(`${formatMoment(rec.ngay, rec.gioBatDau)}, tại ${blank(rec.diaDiem)}.`));
  const nth = (rec.nguoiTienHanh || []).filter((x) => x.hoTen || x.chucDanh);
  body.push(para([run('Chúng tôi gồm: ', { bold: true }), run(nth.length ? nth.map((x) => `${x.hoTen || '…………'} — ${x.chucDanh || '…………'}`).join('; ') : '…………')]));
  if (rec.nguoiGhi) body.push(para([run('Người ghi biên bản: ', { bold: true }), run(rec.nguoiGhi)]));
  const tg = (rec.thamGia || []).filter((x) => x.hoTen);
  if (tg.length) body.push(para([run('Với sự tham gia của: ', { bold: true }), run(tg.map((x) => `${x.hoTen} (${x.tuCach || 'người tham gia'})`).join('; '))]));
  if (hoiCung) body.push(para(`Căn cứ ${role.canCu}, tiến hành hỏi cung bị can:`));
  else body.push(para(`Tiến hành lấy lời khai của ${role.ten.toLowerCase()}:`));

  body.push(para([run('Họ và tên: ', { bold: true }), run(upper(nk.hoTen) || '…………'), run(nk.tenGoiKhac ? `; tên gọi khác: ${nk.tenGoiKhac}` : ''), run(`; giới tính: ${blank(nk.gioiTinh, '……')}`)]));
  body.push(para(`Sinh ngày: ${blank(nk.ngaySinh)}; nơi sinh: ${blank(nk.noiSinh)}; quốc tịch: ${blank(nk.quocTich, '……')}; dân tộc: ${blank(nk.danToc, '……')}; tôn giáo: ${blank(nk.tonGiao, '……')}.`));
  body.push(para(`Nghề nghiệp, chức vụ: ${blank(nk.ngheNghiep)}.`));
  body.push(para(`Số định danh cá nhân/CCCD: ${blank(nk.soDinhDanh)}; cấp ngày: ${blank(nk.ngayCap, '……')}; nơi cấp: ${blank(nk.noiCap)}.`));
  body.push(para(`Nơi cư trú: ${blank(nk.noiCuTru)}.${nk.soDienThoai ? ` Số điện thoại: ${nk.soDienThoai}.` : ''}`));
  if (rec.tenVu || crime) body.push(para([run('Về vụ án/vụ việc: ', { bold: true }), run(`${(rec.tenVu || `có dấu hiệu ${crime.ten.toLowerCase()} (Điều ${crime.dieu} Bộ luật Hình sự)`).replace(/[.;]+$/, '')}.`)]));
  if (rec.lan > 1) body.push(para(`Đây là lần ${act} thứ ${rec.lan}.`));
  body.push(para(`Trước khi ${act}, chúng tôi đã thông báo, giải thích quyền và nghĩa vụ của ${role.ten.toLowerCase()} theo quy định tại ${role.quyen}${rec.daThongBaoQuyen ? '; người khai xác nhận đã được nghe, hiểu rõ quyền và nghĩa vụ của mình' : ''}.`));
  if (role.canhBao) body.push(para([run(role.canhBao, { italic: true })]));
  if (rec.ghiAmGhiHinh) body.push(para(`Việc ${act} có ghi âm, ghi hình có âm thanh theo quy định của Bộ luật Tố tụng hình sự.`));

  body.push(para([run('NỘI DUNG', { bold: true })], { align: 'center', indent: false, spaceBefore: true }));
  const qa = (rec.qa || []).filter((x) => String(x.q || '').trim() || String(x.a || '').trim());
  if (!qa.length) body.push(para('[Chưa có nội dung hỏi – đáp]'));
  qa.forEach((x) => {
    body.push(para([run('Hỏi: ', { bold: true }), run(String(x.q || '').trim())], { cls: 'vb-q' }));
    body.push(para([run('Trả lời: ', { bold: true }), run(String(x.a || '').trim() || '[…]')], { cls: 'vb-a' }));
  });

  body.push(
    para(
      `Việc ${act} kết thúc ${rec.gioKetThuc ? `hồi ${rec.gioKetThuc.replace(':', ' giờ ')} phút` : 'hồi … giờ … phút'} cùng ngày. Biên bản đã được đọc lại cho người khai nghe (hoặc người khai tự đọc lại), người khai xác nhận đúng lời khai của mình, không bổ sung, sửa chữa gì và cùng ký tên dưới đây. Biên bản được lập thành ${rec.soBan || 2} bản.`,
      { spaceBefore: true },
    ),
  );

  const signers = [
    { title: hoiCung ? 'BỊ CAN' : 'NGƯỜI KHAI', hint: '(Ký, ghi rõ họ tên)', name: nk.hoTen || '' },
    ...tg.map((x) => ({ title: upper(x.tuCach || 'NGƯỜI THAM GIA'), hint: '(Ký, ghi rõ họ tên)', name: x.hoTen })),
    { title: 'NGƯỜI GHI BIÊN BẢN', hint: '(Ký, ghi rõ họ tên)', name: rec.nguoiGhi || '' },
    { title: upper(nth[0]?.chucDanh || 'ĐIỀU TRA VIÊN'), hint: '(Ký, ghi rõ họ tên)', name: nth[0]?.hoTen || '' },
  ];

  return {
    typeId: 'bien-ban-loi-khai',
    header: { parent: upper(rec.coQuanCapTren), org: upper(rec.coQuan), number: '', subject: null, placeDate: '' },
    title: { name: role.bienBan, subject: '' },
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
