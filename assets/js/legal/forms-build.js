// Dựng doc model (xem trước A4 + xuất Word) cho biểu mẫu tố tụng từ định nghĩa mẫu và giá trị đã điền.
import { KY_HIEU_LOAI } from './forms-catalog.js';
import { formNoLines, formatMoment } from './record.js';
import { getRole } from './roles.js';
import { findCrime } from './engine.js';

const DOTS = '…………';
const upper = (s) => String(s || '').trim().toLocaleUpperCase('vi-VN');
const run = (text, o = {}) => ({ text, ...o });
const para = (runs, o = {}) => ({ runs: Array.isArray(runs) ? runs : [run(runs)], align: 'justify', indent: true, ...o });
const endWith = (s, ch) => String(s).replace(/[.;,:\s]+$/, '') + ch;
const lines = (v) =>
  String(v ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

/** Thay {khoa} bằng giá trị (nhiều dòng → nối bằng "; "); ô trống → dòng chấm. */
export function fill(tpl, values) {
  return String(tpl).replace(/\{([a-zA-Z0-9]+)\}/g, (_, k) => {
    const v = lines(values[k]).join('; ');
    return v || DOTS;
  });
}
const onlyPlaceholder = (t) => /^\{[a-zA-Z0-9]+\}$/.test(String(t).trim());
const isEmptyKey = (t, values) => onlyPlaceholder(t) && !lines(values[String(t).trim().slice(1, -1)]).length;

function dateLine(org, ngay) {
  const d = ngay ? new Date(ngay) : null;
  const ok = d && !Number.isNaN(+d);
  const p2 = (n) => String(n).padStart(2, '0');
  const dd = ok ? p2(d.getDate()) : '……';
  const mm = ok ? (d.getMonth() + 1 <= 2 ? p2(d.getMonth() + 1) : String(d.getMonth() + 1)) : '……';
  const yy = ok ? d.getFullYear() : '……';
  return `${org.diaDanh || '……'}, ngày ${dd} tháng ${mm} năm ${yy}`;
}

function headerFor(form, values, org) {
  const ky = form.ky || KY_HIEU_LOAI[form.loai];
  const so = String(values.so || '').trim();
  const kyHieuCq = String(org.kyHieu || '').trim() || '……';
  const isCongVan = form.loai === 'yc' || form.loai === 'dn';
  return {
    parent: upper(org.coQuanCapTren),
    org: upper(org.coQuan || 'CƠ QUAN CẢNH SÁT ĐIỀU TRA'),
    number: ky ? `Số: ${so || '         '}/${ky}-${kyHieuCq}` : '',
    subject: isCongVan && form.subject ? `V/v ${form.subject.charAt(0).toLowerCase()}${form.subject.slice(1)}` : null,
    placeDate: dateLine(org, values.ngayVb),
  };
}

function signFor(org, values, { noiNhan = [], pheChuan = false } = {}) {
  const nn = [...noiNhan.map((t) => fill(t, values)).filter((t) => !/^…+$/.test(t)), 'Lưu: Hồ sơ vụ án, đơn vị'];
  const sign = {
    authority: upper(org.quyenKy || ''),
    position: upper(org.chucVuKy || 'THỦ TRƯỞNG'),
    name: org.nguoiKy || '',
    noiNhan: nn,
  };
  if (pheChuan) {
    sign.leftTop = [
      { text: `PHÊ CHUẨN CỦA VIỆN KIỂM SÁT NHÂN DÂN ${upper(values.vks) || '……'}`, bold: true },
      { text: 'Số: ……… ngày …… tháng …… năm ……', italic: true },
      { text: 'KIỂM SÁT VIÊN / VIỆN TRƯỞNG', bold: true },
      { text: ' ' },
      { text: ' ' },
    ];
  }
  return sign;
}

function authorityFor(org) {
  if (org.thamQuyen) return upper(org.thamQuyen);
  return upper(`THỦ TRƯỞNG ${org.coQuan || 'CƠ QUAN CẢNH SÁT ĐIỀU TRA'}${org.coQuanCapTren ? ' ' + org.coQuanCapTren : ''}`);
}

function canCuParas(list, values, extraLast = '') {
  const items = list.filter((t) => !isEmptyKey(t, values)).map((t) => fill(t, values).replace(/^căn cứ\s+/i, ''));
  return items.map((t, i) => para([run(endWith(`Căn cứ ${t}`, i === items.length - 1 && !extraLast ? '.' : ';'), { italic: true })]));
}

/* ---------- Biên bản (bố cục biểu mẫu: ô mẫu số, quốc hiệu giữa) ---------- */
function buildBienBan(form, values, org) {
  const body = [];
  body.push(para(`${formatMoment(values.ngayVb, values.gioBatDau)} tại ${lines(values.diaDiem).join(', ') || DOTS}.`));
  const tp = lines(values.thanhPhan);
  body.push(para([run('Chúng tôi gồm: ', { bold: true }), run(tp.length ? '' : DOTS)]));
  tp.forEach((l) => body.push(para(`- ${l};`, { indent: true })));
  const ck = lines(values.nguoiChungKien);
  if (ck.length) {
    body.push(para([run('Với sự tham gia/chứng kiến của: ', { bold: true })]));
    ck.forEach((l) => body.push(para(`- ${l};`, { indent: true })));
  }
  (form.intro || []).forEach((t) => body.push(para(fill(t, values))));
  body.push(para(`Căn cứ ${fill(form.canCu, values)}, tiến hành ${fill(form.hoatDong, values)}.`));
  body.push(para([run(form.heading || 'NỘI DUNG', { bold: true })], { align: 'center', indent: false, spaceBefore: true, spaceAfter: true }));
  const nd = lines(values.noiDung);
  if (nd.length) {
    nd.forEach((l) => {
      const m = /^(Hỏi|Đáp|Trả lời)\s*:\s*(.*)$/i.exec(l);
      body.push(m ? para([run(`${m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()}: `, { bold: true }), run(m[2])]) : para(l));
    });
  } else {
    for (let i = 0; i < 6; i++) body.push(para('……………………………………………………………………………………………………', { indent: false, cls: 'vb-blank' }));
  }
  if (form.outro) body.push(para(fill(form.outro, values)));
  const ket = values.gioKetThuc ? `hồi ${+String(values.gioKetThuc).split(':')[0]} giờ ${String(values.gioKetThuc).split(':')[1] || '00'} phút` : 'hồi …… giờ …… phút';
  body.push(para(`Việc lập biên bản kết thúc ${ket} cùng ngày. Biên bản đã được đọc lại cho những người có tên trên nghe, công nhận đúng và cùng ký tên xác nhận dưới đây./.`, { spaceBefore: true }));
  const names = { 'ĐIỀU TRA VIÊN': lines(values.thanhPhan)[0]?.split(/\s+[—–-]\s+/)[0] || org.dieuTraVien || '' };
  return {
    typeId: `tt-${form.id}`,
    layout: 'form',
    pageNumbers: true,
    formNo: formNoLines(values.mauSo, org.thongTu || 'TT số 128/2025/TT-BCA ngày 19/12/2025'),
    header: { parent: '', org: '', number: '', subject: null, placeDate: '' },
    title: { name: upper(form.ten), subject: '' },
    body,
    signers: (form.signers || ['NGƯỜI LẬP BIÊN BẢN']).map((t) => ({ title: t, name: names[t] || '' })),
  };
}

/* ---------- Giấy cam đoan ---------- */
function buildCamDoan(form, values) {
  return {
    typeId: `tt-${form.id}`,
    layout: 'form',
    pageNumbers: false,
    formNo: formNoLines(values.mauSo, ''),
    header: { parent: '', org: '', number: '', subject: null, placeDate: '' },
    title: { name: form.title, subject: '' },
    body: [...form.body.map((t) => para(fill(t, values))), para(`${dateLine({ diaDanh: values.diaDanh || '……' }, values.ngayVb)}`, { align: 'right', indent: false, spaceBefore: true })],
    signers: form.signers.map((t) => ({ title: t, name: t === 'NGƯỜI CAM ĐOAN' || t === 'NGƯỜI NHẬN BẢO LĨNH' ? '' : '' })),
  };
}

/** Dựng doc model cho một biểu mẫu tố tụng. org = settings.legalOrg; values gồm cả mauSo, ngayVb, gioBatDau. */
export function buildFormDocument(form, values = {}, org = {}) {
  if (form.loai === 'bb') return buildBienBan(form, values, org);
  if (form.loai === 'cd') return buildCamDoan(form, values);
  const doc = { typeId: `tt-${form.id}`, header: headerFor(form, values, org), title: null, authority: null, recipients: null, body: [], sign: null };
  const mau = formNoLines(values.mauSo, org.thongTu || 'TT số 128/2025/TT-BCA ngày 19/12/2025');
  if (mau) doc.formNo = mau;
  if (form.loai === 'qd' || form.loai === 'lenh') {
    doc.title = { name: form.loai === 'qd' ? 'QUYẾT ĐỊNH' : 'LỆNH', subject: form.subject };
    doc.authority = authorityFor(org);
    doc.body.push(...canCuParas(form.canCu || [], values));
    if (form.loai === 'qd') {
      if (form.xetThay) doc.body.push(para([run('Xét thấy: ', { italic: true }), run(endWith(fill(form.xetThay, values), '.'), { italic: true })]));
      doc.body.push(para([run('QUYẾT ĐỊNH:', { bold: true })], { align: 'center', indent: false, spaceBefore: true }));
      const dieu = [...form.dieu];
      if (form.thiHanh !== false) dieu.push('Điều tra viên được phân công và cơ quan, tổ chức, cá nhân có liên quan chịu trách nhiệm thi hành Quyết định này.');
      dieu.forEach((t, i) => doc.body.push(para([run(`Điều ${i + 1}. `, { bold: true }), run(endWith(fill(t, values), '.'))])));
    } else {
      form.body.forEach((t) => doc.body.push(para(endWith(fill(t, values), '.'))));
      doc.body.push(para('Điều tra viên được phân công và cơ quan, tổ chức, cá nhân có liên quan có trách nhiệm thi hành Lệnh này.'));
    }
    doc.sign = signFor(org, values, { noiNhan: form.noiNhan || ['Viện kiểm sát nhân dân {vks}'], pheChuan: form.pheChuan });
    return doc;
  }
  if (form.loai === 'kl') {
    doc.title = { name: 'BẢN KẾT LUẬN ĐIỀU TRA VỤ ÁN HÌNH SỰ', subject: form.subject };
    doc.body.push(para(fill(form.intro, values)));
    for (const [heading, key] of form.sections) {
      doc.body.push(para([run(heading, { bold: true })], { indent: false, spaceBefore: true }));
      const ls = lines(values[key]);
      (ls.length ? ls : [DOTS]).forEach((l) => doc.body.push(para(l)));
    }
    doc.sign = signFor(org, values, { noiNhan: form.noiNhan });
    return doc;
  }
  // tb / giay / yc / dn
  if (form.loai === 'tb') doc.title = { name: 'THÔNG BÁO', subject: form.subject };
  if (form.loai === 'giay') doc.title = { name: form.title, subject: form.subject || '' };
  if (form.kinhGui) {
    const kg = lines(fill(form.kinhGui, values).split('; ').join('\n'));
    doc.recipients = kg.length ? kg : [DOTS];
    doc.recipientsInline = form.loai !== 'tb';
  }
  if (form.canCuLine) doc.body.push(para([run(form.canCuLine, { italic: true })]));
  form.body.forEach((t) => {
    if (onlyPlaceholder(t)) {
      const ls = lines(values[t.trim().slice(1, -1)]);
      (ls.length ? ls : [DOTS]).forEach((l) => doc.body.push(para(`- ${l}`)));
    } else doc.body.push(para(endWith(fill(t, values), '.')));
  });
  doc.sign = signFor(org, values, { noiNhan: form.noiNhan || (form.kinhGui ? ['Như trên'] : []) });
  return doc;
}

/* ---------- Tự điền từ hồ sơ vụ án ---------- */
const val = (v) => String(v || '').trim();
/** "Nguyễn Văn A, sinh ngày …; nơi cư trú …" từ thông tin người tham gia tố tụng. */
export function nhanThanText(p = {}) {
  const parts = [];
  if (p.gioiTinh) parts.push(`giới tính: ${p.gioiTinh}`);
  if (p.ngaySinh) parts.push(`sinh ngày: ${p.ngaySinh}${p.noiSinh ? ` tại ${p.noiSinh}` : ''}`);
  if (p.quocTich) parts.push(`quốc tịch: ${p.quocTich}`);
  if (p.danToc) parts.push(`dân tộc: ${p.danToc}`);
  if (p.ngheNghiep) parts.push(`nghề nghiệp: ${p.ngheNghiep}`);
  if (p.soDinhDanh) parts.push(`số định danh cá nhân: ${p.soDinhDanh}`);
  if (p.noiCuTru) parts.push(`nơi thường trú: ${p.noiCuTru}`);
  if (p.noiOHienTai) parts.push(`nơi ở hiện tại: ${p.noiOHienTai}`);
  return parts.join('; ');
}

/** Giá trị gợi ý từ hồ sơ vụ án (tên vụ, tội danh), người tham gia và thông tin cơ quan. */
export function prefillFromCase({ caseItem = null, person = null, org = {} } = {}) {
  const v = {};
  if (org.vks) v.vks = org.vks;
  if (org.dieuTraVien) {
    v.dtv = `${org.dieuTraVien} — ${org.chucDanh || 'Điều tra viên'}`;
    v.gapAi = `${org.chucDanh || 'Điều tra viên'} ${org.dieuTraVien}`;
    v.thanhPhan = `${org.dieuTraVien} — ${org.chucDanh || 'Điều tra viên'}`;
  }
  if (org.diaDiem) {
    v.diaDiem = org.diaDiem;
    v.diaDiemHen = org.diaDiem;
  }
  if (caseItem) {
    v.tenVu = val(caseItem.ten);
    const crimes = (caseItem.toiDanh || []).map((d) => findCrime(d)).filter(Boolean);
    if (crimes.length) v.toiDanh = crimes.map((c) => `${c.ten.replace(/^Tội\s+/i, '')} quy định tại Điều ${c.dieu} Bộ luật Hình sự`).join('; ');
  }
  if (person) {
    v.hoTen = val(person.hoTen);
    v.nhanThan = nhanThanText(person);
    if (person.roleId) v.quanHe = getRole(person.roleId).ten.split('/')[0].trim();
  }
  return v;
}
