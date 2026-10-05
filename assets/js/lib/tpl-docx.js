// Mẫu văn bản từ tệp Word người dùng tải lên: đọc đoạn văn, nhận diện trường cần điền,
// thay thế nội dung ngay trong XML gốc (giữ nguyên định dạng, bảng, tiêu đề đầu/cuối trang).
import { readZip, createZip } from './docx.js';

const PART_RE = /^word\/(document|header\d*|footer\d*)\.xml$/;
const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const enc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Thứ tự phần văn bản: tiêu đề đầu trang → thân → cuối trang. */
function partOrder(name) {
  if (name.includes('header')) return 0;
  if (name.includes('document')) return 1;
  return 2;
}

/**
 * Tách các nút chữ của một phần XML theo đoạn.
 * Nút tab/xuống dòng được tính là một khoảng trắng không sửa được để giữ đúng vị trí ký tự.
 */
function scanPart(xml) {
  const re = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t(\s[^>]*)?\/>|<w:tab\/>|<w:br(?:\s[^>]*)?\/>|<\/w:p>|<w:p[\s>]|<w:jc w:val="(\w+)"|<w:b\/>|<w:b w:val="(?:1|true|on)"\/>/g;
  const paras = [];
  let cur = null;
  const open = () => {
    if (!cur || cur.nodes.length || cur.jc) {
      cur = { nodes: [], jc: '', bold: false };
      paras.push(cur);
    }
  };
  open();
  let m;
  while ((m = re.exec(xml))) {
    const tok = m[0];
    if (tok === '</w:p>' || tok.startsWith('<w:p')) {
      cur = null;
      open();
    } else if (tok.startsWith('<w:jc')) cur.jc = m[4];
    else if (tok.startsWith('<w:b')) cur.bold = true;
    else if (tok === '<w:tab/>' || tok.startsWith('<w:br')) cur.nodes.push({ fixed: true, text: tok === '<w:tab/>' ? '\t' : '\n' });
    else if (m[2] !== undefined) {
      const inner = m[2];
      const innerStart = m.index + tok.length - '</w:t>'.length - inner.length;
      cur.nodes.push({ start: m.index, end: m.index + tok.length, innerStart, attrs: m[1] || '', text: dec(inner) });
    }
  }
  return paras.filter((p) => p.nodes.length);
}

const paraText = (p) => p.nodes.map((n) => n.text).join('');

/** Đọc tệp .docx → { zip, parts: {name: xml}, paragraphs: [{ part, i, text, align, bold }] }. */
export async function parseTemplateDocx(buffer) {
  const zip = await readZip(buffer);
  if (!zip.names.includes('word/document.xml')) throw new Error('Tệp không phải văn bản Word (.docx) hợp lệ');
  const names = zip.names.filter((n) => PART_RE.test(n)).sort((a, b) => partOrder(a) - partOrder(b) || a.localeCompare(b));
  const parts = {};
  const paragraphs = [];
  const td = new TextDecoder();
  for (const name of names) {
    parts[name] = td.decode(await zip.read(name));
    scanPart(parts[name]).forEach((p, i) => {
      const text = paraText(p);
      if (text.trim()) paragraphs.push({ part: name, i, text, align: p.jc, bold: p.bold });
    });
  }
  return { zip, parts, paragraphs };
}

/** Thay một đoạn ký tự [s, e) trong đoạn văn p bằng value, giữ định dạng của nút đầu tiên. */
function editsFor(p, s, e, value) {
  const edits = [];
  let pos = 0;
  let placed = false;
  for (const n of p.nodes) {
    const ns = pos;
    const ne = pos + n.text.length;
    pos = ne;
    if (ne <= s || ns >= e) continue;
    if (n.fixed) {
      if (!placed) return null; // Không bắt đầu trường bằng tab/xuống dòng.
      continue;
    }
    const a = Math.max(s, ns) - ns;
    const b = Math.min(e, ne) - ns;
    const next = n.text.slice(0, a) + (placed ? '' : value) + n.text.slice(b);
    placed = true;
    edits.push({ node: n, text: next });
  }
  return placed ? edits : null;
}

/**
 * Điền mẫu: fields = [{ key, locs: [{ part, i, s, e }] }], values = { key: text }.
 * Trường để trống giữ nguyên nội dung gốc. Trả về Uint8Array của tệp .docx mới.
 */
export async function fillTemplateDocx(buffer, fields, values = {}) {
  const zip = await readZip(buffer);
  const td = new TextDecoder();
  const out = {};
  const byPart = {};
  for (const f of fields) {
    const v = values[f.key];
    if (v === undefined || v === null || String(v) === '') continue;
    for (const l of f.locs || []) (byPart[l.part] ||= []).push({ ...l, value: String(v) });
  }
  for (const [part, locs] of Object.entries(byPart)) {
    const raw = await zip.read(part);
    if (!raw) continue;
    let xml = td.decode(raw);
    const paras = scanPart(xml);
    const nodeEdits = new Map();
    // Áp dụng từ cuối đoạn về đầu để vị trí ký tự không lệch.
    locs.sort((a, b) => a.i - b.i || b.s - a.s);
    for (const l of locs) {
      const p = paras[l.i];
      if (!p) continue;
      // Đồng bộ văn bản các nút đã sửa trước đó trong cùng đoạn.
      p.nodes.forEach((n) => nodeEdits.has(n) && (n.text = nodeEdits.get(n)));
      const ed = editsFor(p, l.s, l.e, l.value);
      if (ed) ed.forEach(({ node, text }) => nodeEdits.set(node, text));
    }
    const list = [...nodeEdits.entries()].sort((a, b) => b[0].start - a[0].start);
    for (const [n, text] of list) {
      const attrs = /xml:space=/.test(n.attrs) ? n.attrs : `${n.attrs} xml:space="preserve"`;
      xml = `${xml.slice(0, n.start)}<w:t${attrs}>${enc(text)}</w:t>${xml.slice(n.end)}`;
    }
    out[part] = xml;
  }
  const files = [];
  for (const name of zip.names) {
    if (name.endsWith('/')) continue;
    files.push({ name, data: out[name] ?? (await zip.read(name)) });
  }
  // [Content_Types].xml nên đứng đầu gói.
  files.sort((a, b) => (b.name === '[Content_Types].xml') - (a.name === '[Content_Types].xml'));
  return createZip(files);
}

/* ---------------- Nhận diện trường ---------------- */

const PLACEHOLDER = /^[\s.…_\-–/]*$/;
const slug = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'truong';

/** Mọi vị trí xuất hiện của chuỗi find trong các đoạn. */
export function findLocs(paragraphs, find, { onlyPara = null, all = true } = {}) {
  const locs = [];
  if (!find) return locs;
  paragraphs.forEach((p, idx) => {
    if (onlyPara !== null && idx !== onlyPara) return;
    let k = p.text.indexOf(find);
    while (k >= 0) {
      locs.push({ part: p.part, i: p.i, s: k, e: k + find.length, p: idx });
      if (!all) return;
      k = p.text.indexOf(find, k + find.length);
    }
  });
  return all ? locs : locs.slice(0, 1);
}

const overlaps = (a, b) => a.part === b.part && a.i === b.i && a.s < b.e && b.s < a.e;

/** Thêm trường vào danh sách, bỏ các vị trí trùng với trường đã có. Trả về trường mới hoặc null. */
export function addField(fields, paragraphs, { label, find, hint = '', para = null, all } = {}) {
  find = String(find || '');
  if (!find.trim() || !label) return null;
  const isPh = PLACEHOLDER.test(find) || /^\[.*\]$|^\{\{.*\}\}$|^«.*»$/.test(find.trim());
  const useAll = all ?? !isPh;
  let locs = findLocs(paragraphs, find, { onlyPara: useAll ? null : para, all: useAll });
  if (!locs.length && para !== null) locs = findLocs(paragraphs, find, { all: useAll });
  const taken = fields.flatMap((f) => f.locs);
  locs = locs.filter((l) => !taken.some((t) => overlaps(t, l)));
  if (!locs.length) return null;
  let key = slug(label);
  for (let n = 2; fields.some((f) => f.key === key); n++) key = `${slug(label)}-${n}`;
  const f = { key, label: String(label).trim(), find, hint: String(hint || '').trim(), locs };
  fields.push(f);
  return f;
}

const LABELS = [
  ['ho-ten', /(^(họ và tên|họ tên|tên tôi là|người làm đơn|người đề nghị)$|(^|\s)(ông\/bà|ông|bà|anh|chị)$)/i, 'Họ và tên'],
  ['ngay-sinh', /^ngày.{0,6}sinh$/i, 'Ngày sinh'],
  ['cccd', /(căn cước|cccd|cmnd|định danh)/i, 'Số định danh cá nhân'],
  ['dia-chi', /(địa chỉ|nơi cư trú|thường trú|tạm trú|trú tại)/i, 'Địa chỉ'],
  ['dien-thoai', /(điện thoại|sđt)/i, 'Số điện thoại'],
  ['email', /^e-?mail$/i, 'Email'],
  ['chuc-vu', /^chức vụ$/i, 'Chức vụ'],
  ['don-vi', /^(đơn vị|cơ quan|nơi công tác)$/i, 'Đơn vị công tác'],
];

/** Nhận diện trường cần điền bằng quy tắc (chạy trên máy, không cần AI). */
export function detectFields(paragraphs) {
  const fields = [];
  const push = (label, find, para, hint) => addField(fields, paragraphs, { label, find, para, hint });
  paragraphs.forEach((p, idx) => {
    const t = p.text;
    let m;
    // Ký hiệu, số văn bản.
    if ((m = /\bSố\s*:\s*([^\s].*?)(?=\s{2,}|\t|$)/u.exec(t))) push('Số, ký hiệu văn bản', m[1].trim(), idx, 'VD: 12/QĐ-UBND');
    // Địa danh, ngày tháng năm.
    if ((m = /([\p{Lu}][\p{L}.\s]{1,40}?|…+|\.{3,}),\s*ngày\s+(\d{1,2}|[.…_]+)\s+tháng\s+(\d{1,2}|[.…_]+)\s+năm\s+(\d{4}|[.…_]+)/u.exec(t))) push('Địa danh, ngày tháng năm', m[0].trim(), idx, 'VD: Hà Nội, ngày 05 tháng 10 năm 2026');
    // Kính gửi.
    if ((m = /Kính gửi\s*:\s*(.+)$/iu.exec(t)) && m[1].trim().length > 1) push('Kính gửi', m[1].trim(), idx);
    // Ô giữ chỗ dạng [..], {{..}}, «..».
    for (const mm of t.matchAll(/\[([^\]\n]{1,60})\]|\{\{\s*([^}\n]{1,60}?)\s*\}\}|«([^»\n]{1,60})»/gu)) push((mm[1] || mm[2] || mm[3]).trim(), mm[0], idx);
    // "Nhãn: giá trị" hoặc "Nhãn: ……".
    for (const mm of t.matchAll(/(^|[;.\t]\s*|\s{2,})([\p{L}][\p{L}\s/()]{1,38}?)\s*:\s*([^:;\t]{1,80}?)(?=\s*;|\t|\s{2,}|$)/gu)) {
      const lab = mm[2].trim();
      const val = mm[3].trim().replace(/[.,]$/, '');
      if (!val || /^(kính gửi|số|nơi nhận|căn cứ)$/i.test(lab) || lab.split(/\s+/).length > 6) continue;
      const known = LABELS.find(([, re]) => re.test(lab));
      if (!known && !PLACEHOLDER.test(val)) continue;
      push(known ? known[2] : lab.charAt(0).toUpperCase() + lab.slice(1), val, idx);
    }
    // Số tiền.
    for (const mm of t.matchAll(/\d{1,3}(?:[.,]\d{3})+\s*(?:đồng|VNĐ|VND|đ)\b/gu)) push('Số tiền', mm[0], idx);
  });
  return fields;
}

/** Kiểm tra, chuẩn hóa kết quả AI {ten, moTa, truong: [{label, find, para, hint}]} thành danh sách trường hợp lệ. */
export function fieldsFromAi(paragraphs, json, existing = []) {
  const fields = existing.map((f) => ({ ...f, locs: [...f.locs] }));
  const added = [];
  for (const t of json?.truong || json?.fields || []) {
    const find = String(t.find || t.text || '').trim();
    const para = Number.isInteger(t.para) ? t.para : Number.isInteger(+t.para) ? +t.para : null;
    const f = addField(fields, paragraphs, { label: t.label || t.ten, find, para, hint: t.hint || t.goiY });
    if (f) added.push(f);
  }
  return { fields, added };
}

/** Văn bản đánh số đoạn để gửi AI (giới hạn độ dài). */
export function numberedText(paragraphs, max = 14000) {
  let out = '';
  for (let k = 0; k < paragraphs.length; k++) {
    const line = `[${k}] ${paragraphs[k].text.replace(/\t/g, ' ')}\n`;
    if (out.length + line.length > max) break;
    out += line;
  }
  return out;
}

export const TEMPLATE_AI_PROMPT = `Bạn là chuyên viên văn thư. Dưới đây là nội dung một văn bản Word mẫu, mỗi đoạn có số thứ tự [n].
Hãy chắt lọc thành MẪU VĂN BẢN dùng lại được: xác định các phần thông tin thay đổi theo từng lần sử dụng (số văn bản, địa danh – ngày tháng, tên người, cơ quan, địa chỉ, số tiền, thời gian, nội dung cụ thể…) — KHÔNG chọn phần cố định như quốc hiệu, tiêu ngữ, căn cứ pháp lý chung.
Với mỗi trường, "find" phải là chuỗi ký tự CÓ THẬT, sao chép nguyên văn từ đoạn [para] (kể cả dấu chấm "……" nếu là chỗ trống).
Chỉ trả về JSON: {"ten":"tên mẫu ngắn gọn","moTa":"mô tả 1 câu","truong":[{"label":"Tên trường","find":"chuỗi nguyên văn","para":số đoạn,"hint":"gợi ý cách điền"}]}`;

/* ---------------- Base64 ---------------- */
export function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
