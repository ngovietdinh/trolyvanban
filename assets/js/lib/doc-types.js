// Định nghĩa các loại văn bản hành chính và cách dựng mô hình văn bản (doc model)
// theo thể thức tại Phụ lục I, Nghị định 30/2020/NĐ-CP về công tác văn thư.
//
// Doc model (độc lập với cách hiển thị — dùng chung cho xem trước HTML và xuất DOCX):
// {
//   header:  { parent, org, number, subject, placeDate },
//   title:   { name, subject } | null,
//   authority: string | null,          // Thẩm quyền ban hành (Quyết định)
//   recipients: string[] | null,       // Kính gửi
//   recipientsInline: boolean,         // Kính gửi căn giữa ngay dưới tiêu đề (Tờ trình)
//   body:   Paragraph[],               // { runs: [{text,bold,italic}], align, indent, italic }
//   sign:   { noiNhan: string[], authority, position, name } | null,
//   dualSign: { left: {title,name}, right: {title,name} } | null,
// }

import { formatAdminDate } from './vn-date.js';

export const QUOC_HIEU = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
export const TIEU_NGU = 'Độc lập - Tự do - Hạnh phúc';

const COMMON_HEAD = [
  { key: 'coQuanChuQuan', label: 'Cơ quan chủ quản', placeholder: 'UBND QUẬN BA ĐÌNH', span: 1 },
  { key: 'coQuan', label: 'Cơ quan ban hành', placeholder: 'ỦY BAN NHÂN DÂN PHƯỜNG ĐIỆN BIÊN', required: true, span: 1 },
  { key: 'vietTat', label: 'Viết tắt cơ quan', placeholder: 'UBND', required: true, span: 1 },
  { key: 'so', label: 'Số văn bản', placeholder: 'Để trống nếu chưa cấp số', span: 1 },
  { key: 'diaDanh', label: 'Địa danh', placeholder: 'Hà Nội', required: true, span: 1 },
  { key: 'ngay', label: 'Ngày ban hành', type: 'date', required: true, span: 1 },
];

const COMMON_SIGN = [
  { key: 'quyenHan', label: 'Quyền hạn ký', type: 'select', options: ['', 'TM.', 'KT.', 'Q.', 'TL.', 'TUQ.'], span: 1, hint: 'TM. = thay mặt, KT. = ký thay…' },
  { key: 'tapThe', label: 'Tập thể / Thủ trưởng', placeholder: 'ỦY BAN NHÂN DÂN', span: 1 },
  { key: 'chucVu', label: 'Chức vụ người ký', placeholder: 'CHỦ TỊCH', required: true, span: 1 },
  { key: 'nguoiKy', label: 'Họ và tên người ký', placeholder: 'Nguyễn Văn An', required: true, span: 1 },
  { key: 'noiNhan', label: 'Nơi nhận (mỗi dòng một nơi)', type: 'textarea', rows: 3, placeholder: 'Như trên;\nLưu: VT.', span: 2 },
];

const field = (key, label, extra = {}) => ({ key, label, ...extra });

export const DOC_TYPES = [
  {
    id: 'cong-van',
    name: 'Công văn',
    abbr: '',
    icon: 'mail',
    tagline: 'Trao đổi, đề nghị, hướng dẫn giữa các cơ quan',
    fields: [
      ...COMMON_HEAD,
      field('donVi', 'Đơn vị soạn thảo (viết tắt)', { placeholder: 'VP', span: 1 }),
      field('trichYeu', 'Trích yếu (V/v…)', { placeholder: 'đề nghị cung cấp số liệu báo cáo quý III', required: true, span: 1 }),
      field('kinhGui', 'Kính gửi (mỗi dòng một nơi)', { type: 'textarea', rows: 2, placeholder: 'Các phòng, ban chuyên môn', required: true, span: 2 }),
      field('noiDung', 'Nội dung', { type: 'textarea', rows: 9, required: true, span: 2, ai: true }),
      ...COMMON_SIGN,
    ],
  },
  {
    id: 'quyet-dinh',
    name: 'Quyết định',
    abbr: 'QĐ',
    icon: 'gavel',
    tagline: 'Quyết định cá biệt: bổ nhiệm, thành lập, phê duyệt',
    fields: [
      ...COMMON_HEAD,
      field('trichYeu', 'Trích yếu (Về việc…)', { placeholder: 'thành lập Tổ công tác chuyển đổi số', required: true, span: 2 }),
      field('thamQuyen', 'Thẩm quyền ban hành', { placeholder: 'CHỦ TỊCH ỦY BAN NHÂN DÂN PHƯỜNG ĐIỆN BIÊN', required: true, span: 2 }),
      field('canCu', 'Căn cứ ban hành (mỗi dòng một căn cứ)', { type: 'textarea', rows: 4, required: true, span: 2 }),
      field('deNghi', 'Theo đề nghị của', { placeholder: 'Chánh Văn phòng', span: 2 }),
      field('noiDung', 'Các điều khoản (mỗi dòng một Điều)', { type: 'textarea', rows: 7, required: true, span: 2, ai: true }),
      ...COMMON_SIGN,
    ],
  },
  {
    id: 'to-trinh',
    name: 'Tờ trình',
    abbr: 'TTr',
    icon: 'presentation',
    tagline: 'Đề xuất cấp trên xem xét, phê duyệt',
    fields: [
      ...COMMON_HEAD,
      field('trichYeu', 'Trích yếu (Về việc…)', { required: true, span: 2 }),
      field('kinhGui', 'Kính gửi', { type: 'textarea', rows: 1, required: true, span: 2 }),
      field('noiDung', 'Nội dung', { type: 'textarea', rows: 9, required: true, span: 2, ai: true }),
      ...COMMON_SIGN,
    ],
  },
  {
    id: 'bao-cao',
    name: 'Báo cáo',
    abbr: 'BC',
    icon: 'chart',
    tagline: 'Tổng kết, sơ kết, báo cáo tình hình',
    fields: [
      ...COMMON_HEAD,
      field('trichYeu', 'Trích yếu', { placeholder: 'Kết quả thực hiện nhiệm vụ quý III năm 2026', required: true, span: 2 }),
      field('noiDung', 'Nội dung', { type: 'textarea', rows: 10, required: true, span: 2, ai: true }),
      ...COMMON_SIGN,
    ],
  },
  {
    id: 'thong-bao',
    name: 'Thông báo',
    abbr: 'TB',
    icon: 'megaphone',
    tagline: 'Truyền đạt thông tin, kết luận, lịch công tác',
    fields: [
      ...COMMON_HEAD,
      field('trichYeu', 'Trích yếu', { required: true, span: 2 }),
      field('noiDung', 'Nội dung', { type: 'textarea', rows: 9, required: true, span: 2, ai: true }),
      ...COMMON_SIGN,
    ],
  },
  {
    id: 'ke-hoach',
    name: 'Kế hoạch',
    abbr: 'KH',
    icon: 'calendar',
    tagline: 'Mục đích, yêu cầu, nhiệm vụ, tổ chức thực hiện',
    fields: [
      ...COMMON_HEAD,
      field('trichYeu', 'Trích yếu', { required: true, span: 2 }),
      field('noiDung', 'Nội dung', { type: 'textarea', rows: 10, required: true, span: 2, ai: true }),
      ...COMMON_SIGN,
    ],
  },
  {
    id: 'giay-moi',
    name: 'Giấy mời',
    abbr: 'GM',
    icon: 'ticket',
    tagline: 'Mời họp, hội nghị, sự kiện',
    fields: [
      ...COMMON_HEAD,
      field('trichYeu', 'Trích yếu', { placeholder: 'Dự Hội nghị sơ kết 9 tháng đầu năm 2026', required: true, span: 2 }),
      field('thanhPhan', 'Kính mời', { type: 'textarea', rows: 2, required: true, span: 2 }),
      field('noiDung', 'Tới dự (nội dung)', { type: 'textarea', rows: 3, required: true, span: 2, ai: true }),
      field('thoiGian', 'Thời gian', { placeholder: '08 giờ 00, thứ Năm, ngày 15/10/2026', required: true, span: 1 }),
      field('diaDiem', 'Địa điểm', { placeholder: 'Hội trường tầng 3', required: true, span: 1 }),
      field('ghiChu', 'Ghi chú thêm', { type: 'textarea', rows: 2, span: 2 }),
      ...COMMON_SIGN,
    ],
  },
  {
    id: 'bien-ban',
    name: 'Biên bản',
    abbr: 'BB',
    icon: 'clipboard',
    tagline: 'Ghi nhận diễn biến cuộc họp, sự việc',
    fields: [
      ...COMMON_HEAD,
      field('trichYeu', 'Trích yếu', { placeholder: 'Họp giao ban tháng 10', required: true, span: 2 }),
      field('thoiGian', 'Thời gian bắt đầu', { placeholder: '14 giờ 00, ngày 05/10/2026', required: true, span: 1 }),
      field('diaDiem', 'Địa điểm', { required: true, span: 1 }),
      field('thanhPhan', 'Thành phần tham dự', { type: 'textarea', rows: 2, required: true, span: 2 }),
      field('chuTri', 'Chủ trì', { required: true, span: 1 }),
      field('thuKy', 'Thư ký', { required: true, span: 1 }),
      field('noiDung', 'Nội dung (diễn biến)', { type: 'textarea', rows: 8, required: true, span: 2, ai: true }),
      field('ketThuc', 'Thời gian kết thúc', { placeholder: '16 giờ 30 cùng ngày', span: 2 }),
    ],
  },
];

export const getDocType = (id) => DOC_TYPES.find((t) => t.id === id);

const lines = (s) =>
  String(s || '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

const upper = (s) => String(s || '').trim().toLocaleUpperCase('vi-VN');
const run = (text, opts = {}) => ({ text, ...opts });
const para = (runs, opts = {}) => ({ runs: Array.isArray(runs) ? runs : [run(runs)], align: 'justify', indent: true, ...opts });

/** Bảo đảm dòng kết thúc bằng dấu câu phù hợp (dùng cho căn cứ, kính gửi, nơi nhận). */
function endWith(text, mark) {
  const t = text.replace(/[;.,:]+$/, '').trim();
  return t + mark;
}

/** Chuyển khối văn bản tự do thành các đoạn, nhận diện đề mục La Mã / số / chữ để in đậm. */
export function textToParagraphs(text) {
  return lines(text).map((l) => {
    if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\.\s/.test(l)) return para([run(l, { bold: true })]);
    const m = l.match(/^(Điều\s+\d+\.)\s*(.*)$/);
    if (m) return para([run(m[1] + ' ', { bold: true }), run(m[2])]);
    if (/^\d+\.\s/.test(l) && l.length < 120) return para([run(l, { bold: true })]);
    return para(l);
  });
}

/** Ghép số và ký hiệu văn bản: "Số: 125/QĐ-UBND" hoặc "Số:      /QĐ-UBND" khi chưa cấp số. */
export function buildNumber(type, v) {
  const so = String(v.so || '').trim() || '      ';
  const org = String(v.vietTat || '').trim().toUpperCase();
  let symbol;
  if (type.id === 'cong-van') symbol = [org, String(v.donVi || '').trim().toUpperCase()].filter(Boolean).join('-');
  else symbol = [type.abbr, org].filter(Boolean).join('-');
  return `Số: ${so}/${symbol}`;
}

function buildSign(v) {
  const qh = String(v.quyenHan || '').trim();
  const tapThe = upper(v.tapThe);
  return {
    noiNhan: lines(v.noiNhan).length ? lines(v.noiNhan) : ['Như trên', 'Lưu: VT'],
    authority: qh && tapThe ? `${qh} ${tapThe}` : tapThe,
    position: upper(v.chucVu),
    name: String(v.nguoiKy || '').trim(),
  };
}

/** Kiểm tra các trường bắt buộc. Trả về mảng { key, label }. */
export function validate(typeId, values) {
  const type = getDocType(typeId);
  if (!type) return [{ key: '_type', label: 'Loại văn bản' }];
  return type.fields.filter((f) => f.required && !String(values[f.key] ?? '').trim()).map((f) => ({ key: f.key, label: f.label }));
}

/** Dựng doc model từ loại văn bản và giá trị người dùng nhập. */
export function buildDocument(typeId, values) {
  const type = getDocType(typeId);
  if (!type) throw new Error(`Không có loại văn bản "${typeId}"`);
  const v = values || {};
  const trichYeu = String(v.trichYeu || '').trim().replace(/^(v\/v|về việc)\s*/i, '');

  const doc = {
    typeId,
    header: {
      parent: upper(v.coQuanChuQuan),
      org: upper(v.coQuan),
      number: buildNumber(type, v),
      subject: null,
      placeDate: formatAdminDate(v.ngay || new Date(), v.diaDanh || ''),
    },
    title: null,
    authority: null,
    recipients: null,
    recipientsInline: false,
    body: [],
    sign: buildSign(v),
    dualSign: null,
  };

  const subjectLine = (prefix) => (trichYeu ? `${prefix}${trichYeu}` : '');

  switch (typeId) {
    case 'cong-van': {
      doc.header.subject = trichYeu ? `V/v ${trichYeu}` : '';
      doc.recipients = lines(v.kinhGui);
      doc.body = textToParagraphs(v.noiDung);
      break;
    }
    case 'quyet-dinh': {
      doc.title = { name: 'QUYẾT ĐỊNH', subject: subjectLine('Về việc ') };
      doc.authority = upper(v.thamQuyen);
      const canCu = lines(v.canCu).map((c) => (/^căn cứ/i.test(c) ? c : `Căn cứ ${c}`));
      const deNghi = String(v.deNghi || '').trim();
      canCu.forEach((c, i) => {
        const last = i === canCu.length - 1 && !deNghi;
        doc.body.push(para([run(endWith(c, last ? '.' : ';'), { italic: true })]));
      });
      if (deNghi) doc.body.push(para([run(endWith(/^theo đề nghị/i.test(deNghi) ? deNghi : `Theo đề nghị của ${deNghi}`, '.'), { italic: true })]));
      doc.body.push(para([run('QUYẾT ĐỊNH:', { bold: true })], { align: 'center', indent: false, spaceBefore: true, structural: true }));
      lines(v.noiDung).forEach((l, i) => {
        const m = l.match(/^Điều\s+(\d+)\.?\s*(.*)$/i);
        const n = m ? m[1] : String(i + 1);
        const text = m ? m[2] : l;
        doc.body.push(para([run(`Điều ${n}. `, { bold: true }), run(text)]));
      });
      break;
    }
    case 'to-trinh': {
      doc.title = { name: 'TỜ TRÌNH', subject: subjectLine('Về việc ') };
      doc.recipients = lines(v.kinhGui);
      doc.recipientsInline = true;
      doc.body = textToParagraphs(v.noiDung);
      break;
    }
    case 'giay-moi': {
      doc.title = { name: 'GIẤY MỜI', subject: trichYeu };
      const org = String(v.coQuan || '').trim();
      const orgName = org ? org.charAt(0) + org.slice(1).toLocaleLowerCase('vi-VN') : 'Cơ quan';
      doc.body.push(para(`${orgName} trân trọng kính mời: ${lines(v.thanhPhan).join('; ')}.`));
      doc.body.push(para([run('Tới dự: ', { bold: true }), run(lines(v.noiDung).join(' '))]));
      doc.body.push(para([run('Thời gian: ', { bold: true }), run(String(v.thoiGian || '').trim())]));
      doc.body.push(para([run('Địa điểm: ', { bold: true }), run(String(v.diaDiem || '').trim())]));
      textToParagraphs(v.ghiChu).forEach((p) => doc.body.push(p));
      doc.body.push(para('Rất mong được đón tiếp./.'));
      break;
    }
    case 'bien-ban': {
      doc.title = { name: 'BIÊN BẢN', subject: trichYeu };
      const kv = (label, value) => para([run(`${label}: `, { bold: true }), run(String(value || '').trim())]);
      doc.body.push(kv('Thời gian bắt đầu', v.thoiGian));
      doc.body.push(kv('Địa điểm', v.diaDiem));
      doc.body.push(kv('Thành phần tham dự', lines(v.thanhPhan).join('; ')));
      doc.body.push(kv('Chủ trì', v.chuTri));
      doc.body.push(kv('Thư ký (người ghi biên bản)', v.thuKy));
      doc.body.push(para([run('Nội dung:', { bold: true })]));
      textToParagraphs(v.noiDung).forEach((p) => doc.body.push(p));
      const end = String(v.ketThuc || '').trim();
      doc.body.push(para(`Cuộc họp kết thúc${end ? ` vào ${end}` : ''}, biên bản đã được đọc lại cho các thành viên dự họp cùng nghe và nhất trí thông qua./.`));
      doc.sign = null;
      doc.dualSign = {
        left: { title: 'THƯ KÝ', name: String(v.thuKy || '').trim() },
        right: { title: 'CHỦ TRÌ', name: String(v.chuTri || '').trim() },
      };
      break;
    }
    default: {
      doc.title = { name: upper(type.name), subject: trichYeu };
      doc.body = textToParagraphs(v.noiDung);
    }
  }

  // Văn bản kết thúc bằng dấu "./." theo thông lệ.
  const last = doc.body[doc.body.length - 1];
  if (last && !last.structural && typeId !== 'giay-moi' && typeId !== 'bien-ban') {
    const r = last.runs[last.runs.length - 1];
    if (!/\.\/\.$/.test(r.text)) r.text = r.text.replace(/[.;,:]*\s*$/, '') + './.';
  }
  return doc;
}

/**
 * Bản sao giá trị dùng cho xem trước: trường bắt buộc còn trống được thay bằng "[Tên trường]"
 * để người dùng thấy rõ vị trí cần điền trên trang A4.
 */
export function withPlaceholders(typeId, values) {
  const type = getDocType(typeId);
  const out = { ...values };
  if (!type) return out;
  for (const f of type.fields) {
    if (!f.required || String(out[f.key] ?? '').trim()) continue;
    if (f.type === 'date') continue;
    out[f.key] = `[${f.label.replace(/\s*\(.*\)\s*/, '')}]`;
  }
  return out;
}

/** Văn bản thuần (dùng để sao chép, đếm từ, lưu trữ, gửi cho AI). */
export function documentToText(doc) {
  const out = [];
  const h = doc.header;
  if (h.parent) out.push(h.parent);
  out.push(h.org, h.number);
  if (h.subject) out.push(h.subject);
  out.push('', QUOC_HIEU, TIEU_NGU, h.placeDate, '');
  if (doc.title) {
    out.push(doc.title.name);
    if (doc.title.subject) out.push(doc.title.subject);
    out.push('');
  }
  if (doc.authority) out.push(doc.authority, '');
  if (doc.recipients?.length) {
    out.push(doc.recipients.length === 1 ? `Kính gửi: ${doc.recipients[0]}.` : 'Kính gửi:');
    if (doc.recipients.length > 1) doc.recipients.forEach((r, i) => out.push(`- ${endWith(r, i === doc.recipients.length - 1 ? '.' : ';')}`));
    out.push('');
  }
  doc.body.forEach((p) => out.push(p.runs.map((r) => r.text).join('')));
  out.push('');
  if (doc.sign) {
    out.push('Nơi nhận:', ...formatNoiNhan(doc.sign.noiNhan).map((l) => l));
    if (doc.sign.authority) out.push(doc.sign.authority);
    out.push(doc.sign.position, '', doc.sign.name);
  }
  if (doc.dualSign) out.push(`${doc.dualSign.left.title}: ${doc.dualSign.left.name}`, `${doc.dualSign.right.title}: ${doc.dualSign.right.name}`);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Định dạng danh sách nơi nhận: "- Như trên;" ... "- Lưu: VT." */
export function formatNoiNhan(list) {
  return list.map((l, i) => `- ${endWith(l.replace(/^[-–•]\s*/, ''), i === list.length - 1 ? '.' : ';')}`);
}

/** Định dạng danh sách kính gửi nhiều dòng. */
export function formatRecipients(list) {
  return list.map((l, i) => `- ${endWith(l.replace(/^[-–•]\s*/, ''), i === list.length - 1 ? '.' : ';')}`);
}

/** Dữ liệu mẫu để dùng thử nhanh từng loại văn bản. */
export function sampleValues(typeId, today) {
  const base = {
    coQuanChuQuan: 'UBND QUẬN BA ĐÌNH',
    coQuan: 'ỦY BAN NHÂN DÂN PHƯỜNG ĐIỆN BIÊN',
    vietTat: 'UBND',
    so: '',
    diaDanh: 'Hà Nội',
    ngay: today,
    quyenHan: 'TM.',
    tapThe: 'ỦY BAN NHÂN DÂN',
    chucVu: 'CHỦ TỊCH',
    nguoiKy: 'Nguyễn Văn An',
    noiNhan: 'Như trên;\nThường trực Đảng ủy phường;\nLưu: VT, VP.',
  };
  const samples = {
    'cong-van': {
      donVi: 'VP',
      trichYeu: 'đề nghị báo cáo kết quả chuyển đổi số quý III năm 2026',
      kinhGui: 'Các ban, ngành, đoàn thể phường\nTrưởng các tổ dân phố',
      noiDung:
        'Thực hiện Kế hoạch số 45/KH-UBND ngày 12/02/2026 của Ủy ban nhân dân phường về triển khai chuyển đổi số năm 2026, để có cơ sở tổng hợp, báo cáo Ủy ban nhân dân quận, Ủy ban nhân dân phường đề nghị các đơn vị thực hiện một số nội dung sau:\n1. Báo cáo kết quả thực hiện các chỉ tiêu chuyển đổi số được giao trong quý III năm 2026.\n2. Đánh giá khó khăn, vướng mắc và đề xuất giải pháp tháo gỡ.\nBáo cáo gửi về Ủy ban nhân dân phường (qua Văn phòng) trước ngày 20/10/2026 để tổng hợp.\nĐề nghị các đơn vị quan tâm, phối hợp thực hiện.',
    },
    'quyet-dinh': {
      trichYeu: 'thành lập Tổ công tác chuyển đổi số phường Điện Biên',
      thamQuyen: 'CHỦ TỊCH ỦY BAN NHÂN DÂN PHƯỜNG ĐIỆN BIÊN',
      canCu: 'Luật Tổ chức chính quyền địa phương ngày 19 tháng 02 năm 2025\nNghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư',
      deNghi: 'Chánh Văn phòng Ủy ban nhân dân phường',
      noiDung:
        'Thành lập Tổ công tác chuyển đổi số phường Điện Biên gồm các thành viên có tên trong danh sách kèm theo.\nTổ công tác có nhiệm vụ tham mưu, đôn đốc, kiểm tra việc triển khai các nhiệm vụ chuyển đổi số trên địa bàn phường.\nQuyết định này có hiệu lực kể từ ngày ký. Chánh Văn phòng, các ông (bà) có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này.',
      noiNhan: 'Như Điều 3;\nUBND quận (để b/c);\nLưu: VT, VP.',
    },
    'to-trinh': {
      trichYeu: 'phê duyệt kinh phí mua sắm trang thiết bị phục vụ chuyển đổi số',
      kinhGui: 'Ủy ban nhân dân quận Ba Đình',
      noiDung:
        'I. SỰ CẦN THIẾT\nHiện nay, hệ thống máy tính tại Bộ phận Một cửa của phường đã xuống cấp, ảnh hưởng đến chất lượng giải quyết thủ tục hành chính cho người dân.\nII. NỘI DUNG ĐỀ XUẤT\nĐề nghị phê duyệt kinh phí 350.000.000 đồng để mua sắm 10 bộ máy tính và 02 máy quét tài liệu.\nỦy ban nhân dân phường kính trình Ủy ban nhân dân quận xem xét, phê duyệt.',
      quyenHan: 'TM.',
      noiNhan: 'Như trên;\nLưu: VT.',
    },
    'bao-cao': {
      trichYeu: 'Kết quả thực hiện nhiệm vụ quý III năm 2026',
      noiDung:
        'I. KẾT QUẢ ĐẠT ĐƯỢC\n1. Công tác cải cách hành chính\nTrong quý, phường tiếp nhận 1.245 hồ sơ, giải quyết đúng hạn 1.240 hồ sơ, đạt 99,6%.\n2. Công tác chuyển đổi số\nTỷ lệ hồ sơ trực tuyến toàn trình đạt 78%, tăng 12% so với quý trước.\nII. TỒN TẠI, HẠN CHẾ\nMột số tổ dân phố chưa cập nhật dữ liệu dân cư kịp thời.\nIII. PHƯƠNG HƯỚNG QUÝ IV\nTiếp tục đẩy mạnh dịch vụ công trực tuyến, hoàn thành 100% chỉ tiêu năm.',
    },
    'thong-bao': {
      trichYeu: 'Lịch tiếp công dân tháng 10 năm 2026',
      noiDung:
        'Ủy ban nhân dân phường thông báo lịch tiếp công dân định kỳ tháng 10 năm 2026 như sau:\n- Thời gian: Sáng thứ Năm hằng tuần, từ 08 giờ 00 đến 11 giờ 30.\n- Địa điểm: Phòng tiếp công dân, tầng 1, trụ sở Ủy ban nhân dân phường.\nỦy ban nhân dân phường thông báo để Nhân dân biết, thực hiện.',
    },
    'ke-hoach': {
      trichYeu: 'Tổ chức Ngày Chuyển đổi số phường năm 2026',
      noiDung:
        'I. MỤC ĐÍCH, YÊU CẦU\n1. Mục đích\nNâng cao nhận thức của cán bộ và Nhân dân về chuyển đổi số.\n2. Yêu cầu\nTổ chức thiết thực, hiệu quả, tiết kiệm.\nII. NỘI DUNG, THỜI GIAN\nTổ chức hướng dẫn cài đặt VNeID, dịch vụ công trực tuyến vào ngày 10/10/2026.\nIII. TỔ CHỨC THỰC HIỆN\nGiao Văn phòng chủ trì, phối hợp với Đoàn Thanh niên triển khai.',
    },
    'giay-moi': {
      trichYeu: 'Dự Hội nghị sơ kết công tác 9 tháng đầu năm 2026',
      thanhPhan: 'Đại diện lãnh đạo các ban, ngành, đoàn thể phường\nBí thư Chi bộ, Tổ trưởng các tổ dân phố',
      noiDung: 'Hội nghị sơ kết công tác 9 tháng đầu năm, triển khai nhiệm vụ trọng tâm quý IV năm 2026.',
      thoiGian: '08 giờ 00, thứ Năm, ngày 15/10/2026',
      diaDiem: 'Hội trường tầng 3, trụ sở Ủy ban nhân dân phường',
      ghiChu: 'Đề nghị các đại biểu sắp xếp thời gian tham dự đầy đủ, đúng giờ.',
      noiNhan: 'Như thành phần mời;\nLưu: VT.',
    },
    'bien-ban': {
      trichYeu: 'Họp giao ban tháng 10 năm 2026',
      thoiGian: '14 giờ 00, ngày 05/10/2026',
      diaDiem: 'Phòng họp số 1, Ủy ban nhân dân phường',
      thanhPhan: 'Lãnh đạo Ủy ban nhân dân phường\nCông chức chuyên môn',
      chuTri: 'Ông Nguyễn Văn An - Chủ tịch UBND phường',
      thuKy: 'Bà Trần Thị Bình - Công chức Văn phòng',
      noiDung:
        '1. Đồng chí Chủ tịch quán triệt nhiệm vụ trọng tâm tháng 10.\n2. Các bộ phận báo cáo tiến độ thực hiện nhiệm vụ được giao.\n3. Kết luận: Giao Văn phòng tổng hợp, theo dõi, báo cáo kết quả trước ngày 30/10/2026.',
      ketThuc: '16 giờ 30 cùng ngày',
    },
  };
  return { ...base, ...(samples[typeId] || {}) };
}
