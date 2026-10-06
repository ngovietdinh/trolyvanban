// Xuất tài liệu “tự do” (không theo mẫu) ra .docx: nhiều trang, mỗi trang giữ khổ giấy và lề riêng,
// đoạn văn có căn lề, thụt dòng, điểm dừng tab, chữ đậm/nghiêng/cỡ chữ/chỉ số trên, bảng có hoặc không kẻ.
// Dùng cho chức năng PDF sang Word.
import { createZip } from './docx.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const tw = (pt) => Math.round(pt * 20); // điểm (pt) → twip
const ALIGN = { left: 'left', center: 'center', right: 'right', justify: 'both' };

/**
 * Doc model:
 * { title, pages: [{ width, height, margins: { top, right, bottom, left }, blocks: Block[] }] }  (đơn vị: pt)
 * Block đoạn: { type: 'p', align, indentLeft, indentFirst, before, after, line, tabs: [pt], runs: Run[] }
 * Run: { text, bold, italic, size (pt), sup, font }
 * Block bảng: { type: 'table', borders, cols: [pt], rows: [[ { blocks: Block[] } ]] }
 */
function runXml(r) {
  const size = Math.max(2, Math.round((r.size || 13) * 2));
  const font = r.font || 'Times New Roman';
  const props = `<w:rFonts w:ascii="${esc(font)}" w:hAnsi="${esc(font)}" w:cs="${esc(font)}"/>${r.bold ? '<w:b/><w:bCs/>' : ''}${r.italic ? '<w:i/><w:iCs/>' : ''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${r.underline ? '<w:u w:val="single"/>' : ''}${r.sup ? '<w:vertAlign w:val="superscript"/>' : ''}`;
  const inner = String(r.text ?? '')
    .split('\t')
    .map((t) => (t ? `<w:t xml:space="preserve">${esc(t)}</w:t>` : ''))
    .join('<w:tab/>');
  return `<w:r><w:rPr>${props}</w:rPr>${inner}</w:r>`;
}

function paraXml(b, extraPPr = '') {
  const ind = [];
  if (b.indentLeft) ind.push(`w:left="${tw(b.indentLeft)}"`);
  if (b.indentFirst > 0) ind.push(`w:firstLine="${tw(b.indentFirst)}"`);
  if (b.indentFirst < 0) ind.push(`w:hanging="${tw(-b.indentFirst)}"`);
  const tabList = (b.tabs || []).map((t) => ({ align: t.align || 'left', pos: Math.max(0, tw(t.pos ?? t)) })).filter((t) => t.pos > 0);
  const tabs = tabList.length ? `<w:tabs>${tabList.map((t) => `<w:tab w:val="${t.align}" w:pos="${t.pos}"/>`).join('')}</w:tabs>` : '';
  const line = b.line ? Math.round(b.line * 240) : 240;
  const ppr = `<w:pPr>${b.keepNext ? '<w:keepNext/>' : ''}${tabs}<w:spacing w:before="${tw(b.before || 0)}" w:after="${tw(b.after || 0)}" w:line="${line}" w:lineRule="auto"/>${ind.length ? `<w:ind ${ind.join(' ')}/>` : ''}<w:jc w:val="${ALIGN[b.align] || 'left'}"/>${extraPPr}</w:pPr>`;
  const runs = (b.runs || []).filter((r) => r.text);
  return `<w:p>${ppr}${runs.map(runXml).join('')}</w:p>`;
}

function tableXml(t) {
  const total = t.cols.reduce((a, b) => a + b, 0);
  const bd = t.borders
    ? ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('')
    : ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="nil"/>`).join('');
  const grid = t.cols.map((w) => `<w:gridCol w:w="${tw(w)}"/>`).join('');
  const rows = t.rows
    .map(
      (row) =>
        `<w:tr>${row
          .map((cell, i) => {
            const span = cell.span > 1 ? `<w:gridSpan w:val="${cell.span}"/>` : '';
            const w = t.cols.slice(i, i + (cell.span || 1)).reduce((a, b) => a + b, 0);
            const content = (cell.blocks || []).length ? cell.blocks.map(blockXml).join('') : '<w:p/>';
            return `<w:tc><w:tcPr><w:tcW w:w="${tw(w)}" w:type="dxa"/>${span}</w:tcPr>${content}</w:tc>`;
          })
          .join('')}</w:tr>`,
    )
    .join('');
  const mar = t.borders ? '<w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/>' : '<w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/>';
  return `<w:tbl><w:tblPr><w:tblW w:w="${tw(total)}" w:type="dxa"/>${t.indent ? `<w:tblInd w:w="${tw(t.indent)}" w:type="dxa"/>` : ''}<w:tblBorders>${bd}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar>${mar}</w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl>`;
}

function blockXml(b) {
  if (b.type === 'table') return tableXml(b);
  return paraXml(b);
}

function sectPr(pg) {
  const m = pg.margins || {};
  const W = tw(pg.width || 595.3);
  const H = tw(pg.height || 841.9);
  const orient = W > H ? ' w:orient="landscape"' : '';
  return `<w:sectPr><w:pgSz w:w="${W}" w:h="${H}"${orient}/><w:pgMar w:top="${tw(m.top ?? 56.7)}" w:right="${tw(m.right ?? 42.5)}" w:bottom="${tw(m.bottom ?? 56.7)}" w:left="${tw(m.left ?? 85)}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>`;
}

export function buildFlowDocumentXml(doc) {
  const body = [];
  doc.pages.forEach((pg, i) => {
    const blocks = pg.blocks.length ? pg.blocks : [{ type: 'p', runs: [] }];
    const last = i === doc.pages.length - 1;
    blocks.forEach((b, j) => {
      const isLast = j === blocks.length - 1;
      // Mỗi trang PDF là một phần (section) riêng: giữ khổ giấy, lề; ngắt trang giữa các trang.
      if (isLast && !last) {
        if (b.type === 'table') {
          body.push(tableXml(b));
          body.push(`<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>${sectPr(pg)}</w:pPr></w:p>`);
        } else body.push(paraXml(b, sectPr(pg)));
      } else body.push(blockXml(b));
    });
  });
  const lastPg = doc.pages[doc.pages.length - 1] || {};
  // Word cần một đoạn văn sau bảng cuối tài liệu.
  if (body.length && body[body.length - 1].startsWith('<w:tbl>')) body.push('<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join('')}${sectPr(lastPg)}</w:body></w:document>`;
}

const CT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
const core = (title) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title)}</dc:title><dc:creator>Trợ Lý Văn Bản AI</dc:creator><dc:language>vi-VN</dc:language></cp:coreProperties>`;

/** Tạo tệp .docx (Uint8Array) từ doc model dạng tự do. */
export function buildFlowDocx(doc, title = 'Văn bản') {
  return createZip([
    { name: '[Content_Types].xml', data: CT },
    { name: '_rels/.rels', data: RELS },
    { name: 'docProps/core.xml', data: core(title) },
    { name: 'word/_rels/document.xml.rels', data: DOC_RELS },
    { name: 'word/styles.xml', data: STYLES },
    { name: 'word/document.xml', data: buildFlowDocumentXml(doc) },
  ]);
}

/** Văn bản thuần của doc model (để sao chép, kiểm tra chính tả, đưa vào kho). */
export function flowToText(doc) {
  const out = [];
  const walk = (blocks) => {
    for (const b of blocks) {
      if (b.type === 'table') for (const row of b.rows) out.push(row.map((c) => c.blocks.map((x) => (x.runs || []).map((r) => r.text).join('')).join(' / ')).join('\t'));
      else out.push((b.runs || []).map((r) => r.text).join(''));
    }
  };
  doc.pages.forEach((p, i) => {
    if (i) out.push('');
    walk(p.blocks);
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
