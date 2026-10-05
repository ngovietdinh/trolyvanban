// Xuất doc model ra tệp Microsoft Word (.docx) chuẩn Office Open XML — không cần thư viện ngoài.
// Đồng thời cung cấp hàm đọc văn bản thuần từ tệp .docx người dùng tải lên.
import { QUOC_HIEU, TIEU_NGU, formatNoiNhan, formatRecipients } from './doc-types.js';

/* ---------------- ZIP (phương thức STORE) ---------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Tạo tệp ZIP từ danh sách { name, data: Uint8Array | string }. */
export function createZip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  // 2026-01-01 00:00 theo định dạng DOS — cố định để kết quả xuất ổn định.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 tên tệp
    local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), name, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, dosTime, true);
    cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + data.length;
  }

  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);

  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

/** Đọc danh sách tệp trong ZIP (hỗ trợ STORE và DEFLATE qua DecompressionStream). */
export async function readZip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Tệp không đúng định dạng ZIP/DOCX');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const entries = {};
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOff = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const lNameLen = view.getUint16(localOff + 26, true);
    const lExtraLen = view.getUint16(localOff + 28, true);
    const start = localOff + 30 + lNameLen + lExtraLen;
    entries[name] = { method, data: bytes.subarray(start, start + compSize) };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return {
    names: Object.keys(entries),
    async read(name) {
      const e = entries[name];
      if (!e) return null;
      if (e.method === 0) return e.data;
      if (e.method !== 8) throw new Error('Phương thức nén không được hỗ trợ');
      const stream = new Blob([e.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    },
  };
}

/** Trích văn bản thuần từ .docx (mỗi đoạn một dòng). */
export async function docxToText(buffer) {
  const zip = await readZip(buffer);
  const xmlBytes = await zip.read('word/document.xml');
  if (!xmlBytes) throw new Error('Không tìm thấy nội dung văn bản trong tệp .docx');
  const xml = new TextDecoder().decode(xmlBytes);
  const paras = xml.split(/<\/w:p>/);
  const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  return paras
    .map((p) => {
      let t = '';
      const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
      let m;
      while ((m = re.exec(p))) {
        if (m[0] === '<w:tab/>') t += '\t';
        else if (m[0] === '<w:br/>') t += '\n';
        else t += decode(m[1]);
      }
      return t;
    })
    .filter((t, i, arr) => t.trim() || (i > 0 && arr[i - 1].trim()))
    .join('\n')
    .trim();
}

/* ---------------- WordprocessingML ---------------- */

const xmlEsc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const PAGE = { w: 11906, h: 16838, top: 1134, bottom: 1134, left: 1701, right: 851 };
const TEXT_W = PAGE.w - PAGE.left - PAGE.right;
const HEAD_L = Math.round(TEXT_W * 0.42);
const HEAD_R = TEXT_W - HEAD_L;

function r(text, { bold, italic, size = 28, caps, sup } = {}) {
  const props = [`<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>`, bold ? '<w:b/>' : '', italic ? '<w:i/>' : '', caps ? '<w:caps/>' : '', `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`, sup ? '<w:vertAlign w:val="superscript"/>' : ''].join('');
  // Ký tự tab → <w:tab/> (dùng cho dòng "Họ tên: …⇥⇥Giới tính: …").
  const inner = String(text ?? '')
    .split('\t')
    .map((t) => `<w:t xml:space="preserve">${xmlEsc(t)}</w:t>`)
    .join('<w:tab/>');
  return `<w:r><w:rPr>${props}</w:rPr>${inner}</w:r>`;
}

function p(runs, { align = 'both', indent = 0, before = 0, after = 120, line = 288, keep = false, border } = {}) {
  const ppr = [keep ? '<w:keepNext/>' : '', border || '', `<w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/>`, indent ? `<w:ind w:firstLine="${indent}"/>` : '', `<w:jc w:val="${align}"/>`].join('');
  return `<w:p><w:pPr>${ppr}</w:pPr>${Array.isArray(runs) ? runs.join('') : runs}</w:p>`;
}

/** Đường kẻ ngang căn giữa trong ô có chiều rộng cellW, độ dài lineW (twip). */
function rule(lineW, cellW) {
  const side = Math.max(0, Math.round((cellW - lineW) / 2));
  return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr><w:spacing w:before="0" w:after="120" w:line="120" w:lineRule="exact"/><w:ind w:left="${side}" w:right="${side}"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="4"/></w:rPr><w:t></w:t></w:r></w:p>`;
}

function table(cells) {
  const grid = cells.map((c) => `<w:gridCol w:w="${c.w}"/>`).join('');
  const tcs = cells.map((c) => `<w:tc><w:tcPr><w:tcW w:w="${c.w}" w:type="dxa"/></w:tcPr>${c.content || p(r(''))}</w:tc>`).join('');
  const none = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="nil"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${TEXT_W}" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders>${none}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid><w:tr>${tcs}</w:tr></w:tbl>`;
}

const c = (runs, o = {}) => p(runs, { align: 'center', after: 0, line: 240, ...o });

/* ----- Bố cục biểu mẫu tố tụng (Mẫu số 140 — TT 128/2025/TT-BCA) ----- */
const FORM_LINE = 269; // giãn dòng như mẫu gốc (≈1,12)

function buildFormXml(doc) {
  const out = [];
  const fp = (l, i) => p(r(l, { italic: true, size: 16 }), { align: 'center', after: 0, line: 240 }).replace('<w:pPr>', `<w:pPr><w:framePr w:w="2820" w:hSpace="180" w:wrap="around" w:vAnchor="page" w:hAnchor="margin" w:xAlign="right" w:y="397"/>`);
  (doc.formNo || []).forEach((l, i) => out.push(fp(l, i)));
  out.push(p(r(QUOC_HIEU, { bold: true, size: 26 }), { align: 'center', after: 0, line: FORM_LINE }));
  out.push(p(r(TIEU_NGU, { bold: true, size: 28 }), { align: 'center', after: 0, line: FORM_LINE }));
  out.push(rule(3000, TEXT_W));
  out.push(p(r(''), { align: 'center', after: 0, line: FORM_LINE }));
  const note = doc.title.note ? `${r(' (')}<w:r><w:rPr><w:sz w:val="28"/><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="1"/></w:r>${r(')')}` : '';
  out.push(p([r(doc.title.name, { bold: true, size: 28 }), note], { align: 'center', after: 0, line: FORM_LINE }));
  if (doc.title.subject) out.push(p(r(doc.title.subject, { bold: true, size: 28 }), { align: 'center', after: 0, line: FORM_LINE }));
  out.push(p(r(''), { after: 0, line: FORM_LINE }));
  for (const para of doc.body) {
    const align = { justify: 'both', center: 'center', left: 'left', right: 'right' }[para.align || 'justify'];
    out.push(p(para.runs.map((x) => r(x.text, { bold: x.bold, italic: x.italic, size: 28 })), { align, indent: para.indent ? 720 : 0, before: para.spaceBefore ? 240 : 0, after: para.spaceAfter ? 240 : 0, line: FORM_LINE }));
  }
  out.push(p(r(''), { after: 0, line: FORM_LINE }));
  const list = doc.signers || [];
  for (let i = 0; i < list.length; i += 2) {
    const row = list.slice(i, i + 2);
    const half = Math.round(TEXT_W / 2);
    const col = (x) => [c(r(x.title, { bold: true, size: 28 }), { line: FORM_LINE }), p(r(''), { after: 1500 }), c(r(x.name || '', { bold: true, size: 28 }), { line: FORM_LINE })].join('');
    out.push(table(row.length === 2 ? [{ w: half, content: col(row[0]) }, { w: TEXT_W - half, content: col(row[1]) }] : [{ w: half, content: col(row[0]) }, { w: TEXT_W - half, content: '' }]));
  }
  const sect = `<w:sectPr>${doc.pageNumbers ? '<w:headerReference w:type="default" r:id="rIdHdr1"/>' : ''}<w:pgSz w:w="${PAGE.w}" w:h="${PAGE.h}"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1701" w:header="425" w:footer="0" w:gutter="0"/>${doc.pageNumbers ? '<w:titlePg/>' : ''}</w:sectPr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${out.join('')}${sect}</w:body></w:document>`;
}

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
function footnotesXml(note) {
  const sep = (type, id, tag) => `<w:footnote w:type="${type}" w:id="${id}"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:${tag}/></w:r></w:p></w:footnote>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:footnotes ${W_NS}>${sep('separator', -1, 'separator')}${sep('continuationSeparator', 0, 'continuationSeparator')}<w:footnote w:id="1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:vertAlign w:val="superscript"/></w:rPr><w:t>(</w:t></w:r><w:r><w:rPr><w:sz w:val="20"/><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteRef/></w:r><w:r><w:rPr><w:sz w:val="20"/><w:vertAlign w:val="superscript"/></w:rPr><w:t>)</w:t></w:r><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve"> ${xmlEsc(note)}</w:t></w:r></w:p></w:footnote></w:footnotes>`;
}
const HEADER_PAGE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${W_NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>2</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:hdr>`;

export function buildDocumentXml(doc) {
  if (doc.layout === 'form') return buildFormXml(doc);
  const h = doc.header;
  const out = [];

  const left = [
    h.parent ? c(r(h.parent, { size: 26 })) : '',
    c(r(h.org || ' ', { bold: true, size: 26 })),
    rule(1300, HEAD_L),
    h.number ? c(r(h.number, { size: 26 })) : '',
    h.subject ? c(r(h.subject, { size: 24 }), { before: 60 }) : '',
  ].join('');
  const right = [c(r(QUOC_HIEU, { bold: true, size: 26 })), c(r(TIEU_NGU, { bold: true, size: 28 })), rule(3000, HEAD_R), h.placeDate ? c(r(h.placeDate, { italic: true, size: 28 }), { before: 60 }) : ''].join('');
  (doc.formNo || []).forEach((l, i, arr) => out.push(p(r(l, { italic: true, size: 22 }), { align: 'right', after: i === arr.length - 1 ? 120 : 0, line: 240 })));
  out.push(table([{ w: HEAD_L, content: left }, { w: HEAD_R, content: right }]));

  if (doc.title) {
    out.push(p(r(doc.title.name, { bold: true, size: 28 }), { align: 'center', before: 360, after: 0, line: 240 }));
    if (doc.title.subject) out.push(p(r(doc.title.subject, { bold: true, size: 28 }), { align: 'center', after: 0, line: 276 }));
    out.push(rule(1800, TEXT_W));
  } else {
    out.push(p(r(''), { after: 120 }));
  }
  if (doc.authority) out.push(p(r(doc.authority, { bold: true, size: 28 }), { align: 'center', before: 120, after: 240, line: 276 }));

  if (doc.recipients?.length) {
    const align = 'center';
    if (doc.recipients.length === 1) {
      out.push(p([r('Kính gửi: ', { size: 28 }), r(doc.recipients[0].replace(/[.;]+$/, '') + '.', { size: 28 })], { align, before: doc.recipientsInline ? 120 : 0, after: 240 }));
    } else {
      out.push(p(r('Kính gửi:', { size: 28 }), { align, after: 0 }));
      formatRecipients(doc.recipients).forEach((l, i, a) => out.push(p(r(l, { size: 28 }), { align, after: i === a.length - 1 ? 240 : 0 })));
    }
  }

  for (const para of doc.body) {
    const align = { justify: 'both', center: 'center', left: 'left', right: 'right' }[para.align || 'justify'];
    out.push(p(para.runs.map((x) => r(x.text, { bold: x.bold, italic: x.italic, size: 28 })), { align, indent: para.indent ? 567 : 0, before: para.spaceBefore ? 120 : 0, after: 120, line: 312 }));
  }

  if (doc.sign) {
    const s = doc.sign;
    const leftC = [
      ...(s.leftTop || []).map((l, i) => p(r(l.text, { bold: l.bold, italic: l.italic, size: 24 }), { align: 'center', before: i ? 0 : 120, after: 0, line: 240 })),
      p(r('Nơi nhận:', { bold: true, italic: true, size: 24 }), { align: 'left', before: s.leftTop ? 360 : 120, after: 0, line: 240 }),
      ...formatNoiNhan(s.noiNhan).map((l) => p(r(l, { size: 22 }), { align: 'left', after: 0, line: 240 })),
    ].join('');
    const rightC = [s.authority ? c(r(s.authority, { bold: true, size: 28 }), { before: 120 }) : '', c(r(s.position, { bold: true, size: 28 }), { before: s.authority ? 0 : 120 }), p(r(''), { after: 1400 }), c(r(s.name, { bold: true, size: 28 }))].join('');
    out.push(table([{ w: Math.round(TEXT_W * 0.45), content: leftC }, { w: TEXT_W - Math.round(TEXT_W * 0.45), content: rightC }]));
  } else if (doc.dualSign) {
    const col = (x) => [c(r(x.title, { bold: true, size: 28 }), { before: 240 }), c(r('(Ký, ghi rõ họ tên)', { italic: true, size: 26 })), p(r(''), { after: 1400 }), c(r(x.name.replace(/\s*-.*$/, '').replace(/^(Ông|Bà)\s+/i, ''), { bold: true, size: 28 }))].join('');
    out.push(table([{ w: Math.round(TEXT_W / 2), content: col(doc.dualSign.left) }, { w: TEXT_W - Math.round(TEXT_W / 2), content: col(doc.dualSign.right) }]));
  } else if (doc.signers?.length) {
    for (let i = 0; i < doc.signers.length; i += 3) {
      const row = doc.signers.slice(i, i + 3);
      const w = Math.floor(TEXT_W / row.length);
      const col = (x) => [c(r(x.title, { bold: true, size: 26 }), { before: 240 }), x.hint ? c(r(x.hint, { italic: true, size: 24 })) : '', p(r(''), { after: 1300 }), c(r(x.name || '', { bold: true, size: 26 }))].join('');
      out.push(table(row.map((x, j) => ({ w: j === row.length - 1 ? TEXT_W - w * (row.length - 1) : w, content: col(x) }))));
    }
  }

  const sect = `<w:sectPr><w:pgSz w:w="${PAGE.w}" w:h="${PAGE.h}"/><w:pgMar w:top="${PAGE.top}" w:right="${PAGE.right}" w:bottom="${PAGE.bottom}" w:left="${PAGE.left}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${out.join('')}${sect}</w:body></w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;

function coreXml(title) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEsc(title)}</dc:title><dc:creator>Trợ Lý Văn Bản AI</dc:creator><dc:language>vi-VN</dc:language></cp:coreProperties>`;
}

/** Tạo tệp .docx (Uint8Array) từ doc model. */
export function buildDocx(doc, title = 'Văn bản') {
  const fn = doc.layout === 'form' && doc.title?.note;
  const hdr = doc.layout === 'form' && doc.pageNumbers;
  const types = CONTENT_TYPES.replace(
    '</Types>',
    `${fn ? '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>' : ''}${hdr ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ''}</Types>`,
  );
  const rels = DOC_RELS.replace(
    '</Relationships>',
    `${fn ? '<Relationship Id="rIdFn" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>' : ''}${hdr ? '<Relationship Id="rIdHdr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : ''}</Relationships>`,
  );
  return createZip([
    { name: '[Content_Types].xml', data: types },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'docProps/core.xml', data: coreXml(title) },
    { name: 'word/_rels/document.xml.rels', data: rels },
    { name: 'word/styles.xml', data: STYLES },
    { name: 'word/document.xml', data: buildDocumentXml(doc) },
    ...(fn ? [{ name: 'word/footnotes.xml', data: footnotesXml(doc.title.note) }] : []),
    ...(hdr ? [{ name: 'word/header1.xml', data: HEADER_PAGE }] : []),
  ]);
}

/** Tên tệp an toàn, bỏ dấu tiếng Việt. */
export function safeFileName(s, ext = 'docx') {
  const base = String(s || 'van-ban')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return `${base || 'van-ban'}.${ext}`;
}
