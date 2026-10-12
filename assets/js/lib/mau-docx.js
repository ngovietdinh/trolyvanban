// Điền biểu mẫu Word chính thức: thay đúng các đoạn ký tự đã định vị (dòng chấm, tab dẫn chấm, dấu chú thích)
// ngay trong XML gốc nên giữ nguyên bố cục, phông chữ, bảng, khung và tiêu đề đầu/cuối trang của mẫu.
import { readZip, createZip } from './docx.js';
import { scanPart } from './tpl-docx.js';

const enc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textXml = (out) =>
  out === ''
    ? ''
    : String(out)
        .split('\n')
        .map((l) => `<w:t xml:space="preserve">${enc(l)}</w:t>`)
        .join('<w:br/>');

/**
 * Cỡ chữ nên dùng cho nội dung điền vào nút `n`: dòng chấm trong mẫu thường đặt cỡ nhỏ (8pt) nên khi điền
 * phải lấy cỡ của chữ thường ở gần nhất trong đoạn (ưu tiên đứng trước).
 */
function referenceSize(p, n, fallback) {
  const k = p.nodes.indexOf(n);
  const ok = (x) => !x.fixed && x.run?.sz && /[\p{L}\p{N}]/u.test(x.text) && !/[.…]{3}/.test(x.text);
  for (let j = k - 1; j >= 0; j--) if (ok(p.nodes[j])) return p.nodes[j].run.sz;
  for (let j = k + 1; j < p.nodes.length; j++) if (ok(p.nodes[j])) return p.nodes[j].run.sz;
  return fallback;
}

/** Cỡ chữ thân văn bản: cỡ có nhiều chữ nhất trong phần (dùng khi đoạn chỉ có dòng chấm). */
function bodySize(paras) {
  const count = new Map();
  for (const p of paras) for (const n of p.nodes) if (!n.fixed && n.run?.sz && !/[.…]{3}/.test(n.text)) count.set(n.run.sz, (count.get(n.run.sz) || 0) + (n.text.match(/\p{L}/gu) || []).length);
  let best = 0;
  let max = 0;
  // Chú thích, nhãn nhỏ cũng nhiều chữ: ưu tiên cỡ chữ văn bản (từ 11pt) trước.
  for (const [sz, c] of count) if (sz >= 22 && c > max) ((best = sz), (max = c));
  if (best) return best;
  for (const [sz, c] of count) if (c > max) ((best = sz), (max = c));
  return best;
}

/**
 * ops = [{ part, i, s, e, value }]: thay [s, e) của đoạn i (đếm ký tự theo văn bản đoạn, tab = 1 ký tự) bằng value
 * (rỗng = xóa). dropParas = [{ part, i }]: bỏ hẳn các đoạn (dòng chú thích, dòng chấm thừa).
 * Trả về Uint8Array của tệp .docx mới; nội dung không được nhắc đến giữ nguyên từng byte.
 */
export async function fillMauDocx(buffer, ops = [], dropParas = [], { stripFootnotes = false } = {}) {
  const zip = await readZip(buffer);
  const td = new TextDecoder();
  const parts = new Set([...ops, ...dropParas].map((o) => o.part));
  // Chú thích dạng “footnote” của Word: bỏ dấu tham chiếu trong thân mẫu và nội dung chú thích.
  const hasNotes = stripFootnotes && zip.names.includes('word/footnotes.xml');
  if (hasNotes) {
    parts.add('word/document.xml');
    parts.add('word/footnotes.xml');
  }
  const out = {};
  for (const part of parts) {
    const raw = await zip.read(part);
    if (!raw) continue;
    let xml = td.decode(raw);
    const paras = scanPart(xml);
    const edits = [];
    const sized = new Map();
    const body = bodySize(paras);
    const byPara = new Map();
    for (const o of ops) if (o.part === part) (byPara.get(o.i) || byPara.set(o.i, []).get(o.i)).push(o);
    const drops = new Set(dropParas.filter((d) => d.part === part).map((d) => d.i));
    const removed = [];
    for (const i of drops) {
      const p = paras[i];
      if (!p) continue;
      // Chân trang/đầu trang phải còn ít nhất một đoạn; ô bảng, khung chữ cũng vậy → chỉ xóa chữ, giữ đoạn trống.
      if (!part.endsWith('document.xml') || p.nested || p.hasChild || p.inTc || p.start === undefined || p.end === undefined) byPara.set(i, [{ i, s: 0, e: p.nodes.reduce((t, n) => t + n.text.length, 0), value: '', blank: true }]);
      else removed.push([p.start, p.end]);
    }
    for (const [i, list] of byPara) {
      const p = paras[i];
      if (!p || removed.some(([a, b]) => p.start >= a && p.start < b)) continue;
      let pos = 0;
      for (const n of p.nodes) {
        n.len0 = n.text.length;
        n.cur = n.text;
        n.off = pos;
        n.set = false;
        pos += n.len0;
      }
      // Từ cuối đoạn về đầu để vị trí ký tự các chỗ phía trước không lệch.
      for (const o of [...list].sort((a, b) => b.s - a.s)) {
        let first = true;
        for (const n of p.nodes) {
          if (n.off >= o.e || n.off + n.len0 <= o.s) continue;
          const a = Math.max(o.s, n.off) - n.off;
          const b = Math.min(o.e, n.off + n.len0) - n.off;
          if (n.fixed) {
            n.cur = first ? o.value : '';
            n.set = true;
          } else {
            n.cur = n.cur.slice(0, a) + (first ? o.value : '') + n.cur.slice(b);
            n.set = true;
          }
          if (first && o.value && n.run?.rpr && n.run.sz) {
            const ref = o.size || referenceSize(p, n, body);
            if (ref && ref !== n.run.sz) sized.set(n.run.start, { rpr: n.run.rpr, sz: ref });
          }
          first = false;
        }
      }
      for (const n of p.nodes) {
        if (!n.set) continue;
        if (!n.fixed && n.cur === n.text) continue;
        edits.push({ start: n.start, end: n.end, str: textXml(n.cur) });
      }
    }
    for (const { rpr, sz } of sized.values()) {
      if (rpr.end < 0) continue;
      const seg = xml.slice(rpr.start, rpr.end).replace(/<w:sz w:val="\d+"\/>/, `<w:sz w:val="${sz}"/>`).replace(/<w:szCs w:val="\d+"\/>/, `<w:szCs w:val="${sz}"/>`);
      edits.push({ start: rpr.start, end: rpr.end, str: seg });
    }
    for (const [a, b] of removed) edits.push({ start: a, end: b, str: '' });
    edits.sort((x, y) => y.start - x.start || y.end - x.end);
    let lastStart = Infinity;
    for (const e of edits) {
      if (e.end > lastStart) continue; // nằm trong vùng đã bị xóa/sửa
      xml = xml.slice(0, e.start) + e.str + xml.slice(e.end);
      lastStart = e.start;
    }
    if (hasNotes && part === 'word/document.xml') {
      // Dấu tham chiếu thường nằm giữa hai dấu ngoặc rời nhau: "(" + [tham chiếu] + ")" → bỏ cả cụm.
      const RUN = '<w:r(?:\\s[^>]*)?>(?:(?!<\\/w:r>)[\\s\\S])*?';
      xml = xml.replace(new RegExp(`${RUN}<w:t[^>]*>\\(<\\/w:t><\\/w:r>\\s*${RUN}<w:footnoteReference\\b[^>]*\\/>(?:(?!<\\/w:r>)[\\s\\S])*?<\\/w:r>\\s*${RUN}<w:t[^>]*>\\)<\\/w:t><\\/w:r>`, 'g'), '');
    }
    if (hasNotes && part === 'word/document.xml') xml = xml.replace(/<w:r(?:\s[^>]*)?>(?:(?!<\/w:r>)[\s\S])*?<w:footnoteReference\b[^>]*\/>(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/g, '');
    if (hasNotes && part === 'word/footnotes.xml') xml = xml.replace(/<w:footnote\s+(?![^>]*w:type=)[^>]*>[\s\S]*?<\/w:footnote>/g, '');
    out[part] = xml;
  }
  const files = [];
  for (const name of zip.names) {
    if (name.endsWith('/')) continue;
    files.push({ name, data: out[name] ?? (await zip.read(name)) });
  }
  files.sort((a, b) => (b.name === '[Content_Types].xml') - (a.name === '[Content_Types].xml'));
  return createZip(files);
}
