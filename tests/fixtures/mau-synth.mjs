// Biểu mẫu tổng hợp dùng cho kiểm thử (KHÔNG phải nội dung biểu mẫu chính thức): mô phỏng cấu trúc
// dòng chấm, tab dẫn chấm, chú thích (n), danh mục các mẫu.
import { createZip } from '../../assets/js/lib/docx.js';

// Mẫu tổng hợp (không phải nội dung biểu mẫu chính thức) mô phỏng cấu trúc: dòng chấm, tab dẫn chấm, chú thích (n).
export const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
export const run = (t, sz = 26, extra = '') => `<w:r><w:rPr><w:sz w:val="${sz}"/><w:szCs w:val="20"/>${extra}</w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`;
const tab = (sz = 16) => `<w:r><w:rPr><w:sz w:val="${sz}"/></w:rPr><w:tab/></w:r>`;
export const para = (inner, { leader = false, jc = '' } = {}) => `<w:p><w:pPr>${leader ? '<w:tabs><w:tab w:val="right" w:pos="9356" w:leader="dot"/></w:tabs>' : ''}${jc ? `<w:jc w:val="${jc}"/>` : ''}</w:pPr>${inner}</w:p>`;
export const DOTS = '.'.repeat(30);

export function templateDocx(extraBody = '', footer = '', withNotes = true) {
  const body = [
    para(run(DOTS, 16)),
    para(run(DOTS, 16)),
    para(run('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'), { jc: 'center' }),
    para(run('Số: ', 26) + run(DOTS, 16) + run(' /QĐ- ', 26) + run('………', 16)),
    para(run(DOTS, 16) + run(', ngày ', 26) + run('.....', 16) + run(' tháng ', 26) + run('.....', 16) + run(' năm ', 26) + run('......', 16)),
    para(run('QUYẾT ĐỊNH MẪU'), { jc: 'center' }),
    para(tab() + run('(1)', 26, '<w:vertAlign w:val="superscript"/>'), { leader: true }),
    para(run('Căn cứ ', 26) + tab(), { leader: true }),
    para(tab(), { leader: true }),
    para(tab(), { leader: true }),
    para(run('Hồi ', 26) + run('....', 16) + run('giờ', 26) + run('....', 16) + run(' ngày ', 26) + run('....', 16) + run('tháng', 26) + run('....', 16) + run(' năm ', 26) + run('....', 16)),
    para(run('Họ tên: ', 26) + run(DOTS, 16) + run(' Giới tính:', 26) + tab() + tab(), { leader: true }),
    para(run('Sinh ngày ', 26) + run('....', 16) + run(' tháng ', 26) + run('....', 16) + run(' năm ', 26) + run('....', 16) + run(' tại:', 26) + tab(), { leader: true }),
    para(run('Nghề nghiệp:', 26) + tab(), { leader: true }),
    para(run('Điều', 26) + run('(2)', 26, '<w:vertAlign w:val="superscript"/>') + run('.....', 16) + run(' Bộ luật Hình sự;', 26)),
    para(run('Chúng tôi gồm:', 26)),
    para(run('1.', 26) + tab(), { leader: true }),
    para(run('2.', 26) + tab(), { leader: true }),
    para(run('.'.repeat(80), 16)),
    extraBody,
    ...(withNotes ? [para(run('(1) Chức danh tư pháp của người ký ban hành văn bản;', 16)), para(run('(2) Căn cứ vào thẩm quyền điều tra.', 16))] : []),
  ].join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr/></w:body></w:document>`;
  const files = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
    { name: 'word/document.xml', data: doc },
  ];
  if (footer) files.push({ name: 'word/footer1.xml', data: `<?xml version="1.0"?><w:ftr ${W}>${footer}</w:ftr>` });
  return createZip(files);
}


export function indexDocx() {
  const p = (t) => para(run(t, 22));
  const body = [
    p('DANH MỤC'),
    p('STT'),
    p('1. Biểu mẫu sử dụng trong tiếp nhận nguồn tin'),
    p('1'),
    p('Quyết định mẫu thử'),
    p('27'),
    p('2'),
    p('Biên bản mẫu thử'),
    p('02A'),
    p('2. Sổ sách về điều tra hình sự'),
    p('1'),
    p('Sổ mẫu thử'),
    p('294'),
    p('2'),
    p('Biên bản nhóm hai'),
    p('300'),
    p('(1) Công an cấp xã được sử dụng 2 Biểu mẫu số: 02A, 294.'),
  ].join('');
  return createZip([
    { name: '[Content_Types].xml', data: '<Types/>' },
    { name: 'word/document.xml', data: `<w:document ${W}><w:body>${body}</w:body></w:document>` },
  ]);
}

