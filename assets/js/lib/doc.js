// Đọc tệp Word cũ (.doc — Word 97-2003, cả Word 6/95) ngay trên máy, không cần Word hay dịch vụ ngoài:
// - .doc nhị phân: đọc khung chứa OLE (Compound File), lấy bảng mảnh văn bản (piece table) trong luồng WordDocument.
// - Tệp mang đuôi .doc nhưng thực chất là RTF, HTML (Word "lưu dạng trang web") hoặc .docx → đọc theo đúng định dạng.
// - Văn bản gõ phông cũ (TCVN3 .VnTime, VNI-Times) được chuyển sang Unicode.
// docToDocx(): chuyển tự động .doc → .docx (giữ đoạn văn, tab; định dạng phông/bảng không giữ nguyên).
import { docxToText, createZip } from './docx.js';
import { fixLegacy } from './vn-legacy.js';

const CFB_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const FREE = 0xffffffff;
const END = 0xfffffffe;

export class DocReadError extends Error {}

/** Đọc khung chứa OLE Compound File → { stream(name) } trả Uint8Array của luồng theo tên (không phân biệt hoa thường). */
export function readCfb(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 512 || CFB_SIG.some((b, i) => bytes[i] !== b)) throw new DocReadError('Không phải tệp Word 97-2003 (.doc)');
  const secSize = 1 << v.getUint16(0x1e, true);
  const miniSize = 1 << v.getUint16(0x20, true);
  const nFat = v.getUint32(0x2c, true);
  const dirStart = v.getUint32(0x30, true);
  const cutoff = v.getUint32(0x38, true);
  const miniFatStart = v.getUint32(0x3c, true);
  let difatSec = v.getUint32(0x44, true);
  const nSecs = Math.floor((bytes.length - secSize) / secSize) + 1;
  const off = (sid) => (sid + 1) * secSize;
  const u32 = (o) => (o + 4 <= bytes.length ? v.getUint32(o, true) : FREE);

  // Danh sách sector của bảng FAT: 109 mục trong phần đầu, còn lại theo chuỗi DIFAT.
  const fatSecs = [];
  for (let i = 0; i < 109 && fatSecs.length < nFat; i++) {
    const s = u32(0x4c + i * 4);
    if (s !== FREE) fatSecs.push(s);
  }
  for (let guard = 0; difatSec !== END && difatSec !== FREE && fatSecs.length < nFat && guard < nSecs; guard++) {
    const per = secSize / 4 - 1;
    for (let i = 0; i < per && fatSecs.length < nFat; i++) {
      const s = u32(off(difatSec) + i * 4);
      if (s !== FREE) fatSecs.push(s);
    }
    difatSec = u32(off(difatSec) + per * 4);
  }
  const fat = new Uint32Array(fatSecs.length * (secSize / 4));
  fatSecs.forEach((s, k) => {
    for (let i = 0; i < secSize / 4; i++) fat[k * (secSize / 4) + i] = u32(off(s) + i * 4);
  });
  const chain = (start, table) => {
    const out = [];
    const seen = new Set();
    for (let s = start; s !== END && s !== FREE && s < table.length && !seen.has(s); s = table[s]) {
      seen.add(s);
      out.push(s);
    }
    return out;
  };
  const readChain = (start, size) => {
    const secs = chain(start, fat);
    const buf = new Uint8Array(secs.length * secSize);
    secs.forEach((s, i) => buf.set(bytes.subarray(off(s), Math.min(off(s) + secSize, bytes.length)), i * secSize));
    return size == null ? buf : buf.subarray(0, size);
  };

  // Thư mục: mỗi mục 128 byte.
  const dir = readChain(dirStart);
  const dv = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
  const entries = [];
  for (let p = 0; p + 128 <= dir.length; p += 128) {
    const type = dir[p + 66];
    if (!type) continue;
    const nameLen = Math.max(0, Math.min(64, dv.getUint16(p + 64, true)) - 2);
    let name = '';
    for (let i = 0; i < nameLen; i += 2) name += String.fromCharCode(dv.getUint16(p + i, true));
    entries.push({ name, type, start: dv.getUint32(p + 116, true), size: dv.getUint32(p + 120, true) });
  }
  const root = entries.find((e) => e.type === 5);
  let mini = null;
  let miniFat = null;
  const loadMini = () => {
    if (mini) return;
    mini = root ? readChain(root.start, root.size) : new Uint8Array(0);
    const mf = readChain(miniFatStart);
    miniFat = new Uint32Array(mf.buffer.slice(mf.byteOffset, mf.byteOffset + (mf.length & ~3)));
  };
  return {
    names: entries.map((e) => e.name),
    stream(name) {
      const e = entries.find((x) => x.type === 2 && x.name.toLowerCase() === name.toLowerCase());
      if (!e) return null;
      if (e.size >= cutoff) return readChain(e.start, e.size);
      loadMini();
      const secs = chain(e.start, miniFat);
      const buf = new Uint8Array(secs.length * miniSize);
      secs.forEach((s, i) => buf.set(mini.subarray(s * miniSize, (s + 1) * miniSize), i * miniSize));
      return buf.subarray(0, e.size);
    },
  };
}

const cp1252 = new TextDecoder('windows-1252');
const utf16 = new TextDecoder('utf-16le');

/** Chuỗi ký tự Word (có ký tự điều khiển) → văn bản thuần. Bỏ mã trường (giữ kết quả), ảnh, dấu chú thích. */
export function cleanWordText(s) {
  let out = '';
  const fields = []; // mỗi trường: true = đang ở phần mã (ẩn)
  let cell = false; // vừa hết một ô bảng: dấu 0x07 kế tiếp là hết hàng
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c === 0x07 && !fields.some(Boolean)) {
      if (cell) out = `${out.replace(/\t$/, '')}\n`;
      else out += '\t';
      cell = !cell;
      continue;
    }
    cell = false;
    if (c === 0x13) {
      fields.push(true);
      continue;
    }
    if (c === 0x14) {
      if (fields.length) fields[fields.length - 1] = false;
      continue;
    }
    if (c === 0x15) {
      fields.pop();
      continue;
    }
    if (fields.some(Boolean)) continue;
    if (c === 0x0d || c === 0x0b || c === 0x0c) out += '\n';
    else if (c === 0x09) out += '\t';
    else if (c === 0x1e || c === 0x2011) out += '-';
    else if (c === 0xa0) out += ' ';
    else if (c === 0x1f) out += '\u00ad'; // gạch nối mềm — trong phông TCVN3 đây là chữ “ư”, xử lý sau khi nhận diện phông
    else if (c < 0x20) continue;
    else out += ch;
  }
  return out
    .split('\n')
    .map((l) => l.replace(/\t+$/, '').replace(/[  ]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** .doc nhị phân (Word 97-2003; Word 6/95) → văn bản thuần. */
export function docBinaryToText(bytes) {
  const cfb = readCfb(bytes);
  const wd = cfb.stream('WordDocument');
  if (!wd || wd.length < 0x200) throw new DocReadError('Tệp .doc không có nội dung văn bản Word (có thể là bảng tính hoặc tệp hỏng)');
  const v = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
  if (v.getUint16(0, true) !== 0xa5ec && v.getUint16(0, true) !== 0xa5dc) throw new DocReadError('Tệp .doc không đúng cấu trúc Word');
  const nFib = v.getUint16(2, true);
  const flags = v.getUint16(0x0a, true);
  if (flags & 0x0100) throw new DocReadError('Tệp .doc đang đặt mật khẩu mở — mở bằng Word, gỡ mật khẩu rồi tải lại');
  if (flags & 0x0004) {
    /* fComplex: lưu nhanh — vẫn có bảng mảnh, đọc như thường */
  }
  // Word 6/95: văn bản nằm liền một khối 8 bit từ fcMin đến fcMac.
  if (nFib < 101) {
    const fcMin = v.getUint32(0x18, true);
    const fcMac = v.getUint32(0x1c, true);
    return cleanWordText(cp1252.decode(wd.subarray(fcMin, Math.min(fcMac, wd.length))));
  }
  // Độ dài (ký tự) các phần theo thứ tự lưu: thân, chú thích cuối trang, đầu/chân trang, (dự phòng), ghi chú,
  // chú thích cuối văn bản, khung chữ, khung chữ ở đầu trang. Lấy thân + chú thích + ghi chú + khung chữ (bỏ đầu/chân trang).
  const ccp = Array.from({ length: 8 }, (_, i) => Math.max(0, v.getInt32(0x4c + i * 4, true)));
  const total = ccp.reduce((a, b) => a + b, 0);
  const fcClx = v.getUint32(0x1a2, true);
  const lcbClx = v.getUint32(0x1a6, true);
  const table = cfb.stream(flags & 0x0200 ? '1Table' : '0Table');
  if (!table || !lcbClx || fcClx + lcbClx > table.length) throw new DocReadError('Không tìm thấy bảng văn bản trong tệp .doc (tệp hỏng?)');
  const tv = new DataView(table.buffer, table.byteOffset, table.byteLength);
  // Clx: bỏ qua các Prc (0x01), tìm Pcdt (0x02) chứa bảng mảnh.
  let p = fcClx;
  const endClx = fcClx + lcbClx;
  while (p < endClx && table[p] === 0x01) p += 3 + tv.getInt16(p + 1, true);
  if (table[p] !== 0x02) throw new DocReadError('Bảng mảnh văn bản của tệp .doc không hợp lệ');
  const lcb = tv.getUint32(p + 1, true);
  const plc = p + 5;
  const n = Math.floor((lcb - 4) / 12);
  let text = '';
  for (let i = 0; i < n && text.length < total; i++) {
    const cpStart = tv.getUint32(plc + i * 4, true);
    const cpEnd = tv.getUint32(plc + (i + 1) * 4, true);
    const pcd = plc + (n + 1) * 4 + i * 8;
    const fcRaw = tv.getUint32(pcd + 2, true);
    const len = Math.max(0, cpEnd - cpStart);
    if (fcRaw & 0x40000000) {
      const fc = (fcRaw & 0x3fffffff) / 2;
      text += cp1252.decode(wd.subarray(fc, fc + len));
    } else {
      text += utf16.decode(wd.subarray(fcRaw, fcRaw + len * 2));
    }
  }
  let cp = 0;
  const part = (len) => text.slice(cp, (cp += len));
  const [main, ftn, , mcr, atn, edn, txbx] = [part(ccp[0]), part(ccp[1]), part(ccp[2]), part(ccp[3]), part(ccp[4]), part(ccp[5]), part(ccp[6])];
  void mcr;
  return cleanWordText([main, txbx, ftn, edn, atn].filter((x) => x.replace(/[\s\x00-\x1f]/g, '')).join('\r'));
}

/* ---------------- RTF (tệp .doc thực chất là RTF) ---------------- */
const RTF_SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'headerl', 'headerr', 'footerl', 'footerr', 'object', 'themedata', 'colorschememapping', 'latentstyles', 'datastore', 'xmlnstbl', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'filetbl', 'revtbl', 'pgdsctbl']);

export function rtfToText(src) {
  let out = '';
  const stack = [];
  let skip = false;
  let uc = 1;
  let pendingSkip = 0;
  let enc = 'windows-1252';
  const ansi = src.match(/\\ansicpg(\d+)/);
  if (ansi) enc = `windows-${ansi[1]}`;
  let dec;
  try {
    dec = new TextDecoder(enc);
  } catch {
    dec = cp1252;
  }
  let bytes = [];
  const flushBytes = () => {
    if (bytes.length) out += dec.decode(new Uint8Array(bytes));
    bytes = [];
  };
  const emit = (s) => {
    if (skip) return;
    if (pendingSkip > 0) {
      const take = Math.min(pendingSkip, s.length);
      pendingSkip -= take;
      s = s.slice(take);
    }
    if (s) {
      flushBytes();
      out += s;
    }
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      flushBytes();
      stack.push({ skip, uc });
      continue;
    }
    if (ch === '}') {
      flushBytes();
      ({ skip, uc } = stack.pop() || { skip: false, uc: 1 });
      continue;
    }
    if (ch === '\\') {
      const nx = src[i + 1];
      if (nx === '\\' || nx === '{' || nx === '}') {
        emit(nx);
        i++;
        continue;
      }
      if (nx === "'") {
        const hex = parseInt(src.substr(i + 2, 2), 16);
        i += 3;
        if (skip) continue;
        if (pendingSkip > 0) {
          pendingSkip--;
          continue;
        }
        bytes.push(hex);
        continue;
      }
      if (nx === '*') {
        skip = true;
        i++;
        continue;
      }
      if (nx === '~') {
        emit(' ');
        i++;
        continue;
      }
      if (nx === '-' || nx === '_') {
        if (nx === '_') emit('-');
        i++;
        continue;
      }
      const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(src.slice(i + 1, i + 40));
      if (!m) {
        i++;
        continue;
      }
      i += m[0].length;
      const word = m[1];
      const arg = m[2] != null ? +m[2] : null;
      if (RTF_SKIP.has(word)) skip = true;
      else if (word === 'par' || word === 'line' || word === 'row' || word === 'sect' || word === 'page') emit('\n');
      else if (word === 'tab' || word === 'cell') emit('\t');
      else if (word === 'uc') uc = arg ?? 1;
      else if (word === 'u') {
        emit(String.fromCharCode(arg < 0 ? arg + 65536 : arg));
        pendingSkip = uc;
      } else if (word === 'emdash') emit('—');
      else if (word === 'endash') emit('–');
      else if (word === 'lquote') emit('‘');
      else if (word === 'rquote') emit('’');
      else if (word === 'ldblquote') emit('“');
      else if (word === 'rdblquote') emit('”');
      else if (word === 'bullet') emit('•');
      continue;
    }
    if (ch === '\r' || ch === '\n') continue;
    emit(ch);
  }
  flushBytes();
  return cleanWordText(out.replace(/\n/g, '\r'));
}

const htmlToText = (s) =>
  s
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/** Nhận diện định dạng thật của tệp mang đuôi .doc: 'doc' | 'docx' | 'rtf' | 'html' | 'text' | null. */
export function sniffDoc(bytes) {
  if (CFB_SIG.every((b, i) => bytes[i] === b)) return 'doc';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'docx';
  const head = cp1252.decode(bytes.subarray(0, 2048)).replace(/^﻿|^ï»¿/, '').trimStart();
  if (head.startsWith('{\\rtf')) return 'rtf';
  if (/^<(!doctype html|html|\?xml)/i.test(head) || /<html[\s>]/i.test(head)) return 'html';
  return null;
}

/** Tệp .doc (mọi biến thể thường gặp) → văn bản thuần Unicode. Ném lỗi tiếng Việt nói rõ lý do. */
export async function docToText(buffer, name = 'tệp') {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const kind = sniffDoc(bytes);
  let text;
  try {
    if (kind === 'doc') text = docBinaryToText(bytes);
    else if (kind === 'docx') text = await docxToText(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    else if (kind === 'rtf') text = rtfToText(cp1252.decode(bytes));
    else if (kind === 'html') {
      const head = cp1252.decode(bytes.subarray(0, 4096));
      const cs = /charset=["']?([\w-]+)/i.exec(head)?.[1] || 'utf-8';
      let s;
      try {
        s = new TextDecoder(cs).decode(bytes);
      } catch {
        s = new TextDecoder().decode(bytes);
      }
      text = cleanWordText(htmlToText(s).replace(/\n/g, '\r'));
    } else throw new DocReadError(`“${name}” mang đuôi .doc nhưng không phải tệp Word (có thể bị hỏng hoặc đổi đuôi)`);
  } catch (e) {
    if (e instanceof DocReadError) throw new Error(e.message.startsWith('“') ? e.message : `“${name}”: ${e.message}`);
    throw new Error(`Không đọc được “${name}” (tệp .doc hỏng hoặc định dạng lạ) — mở bằng Word, chọn Lưu thành .docx rồi tải lại`);
  }
  text = fixLegacy(text).replace(/\u00ad/g, '');
  if (!text.replace(/\s/g, '')) throw new Error(`“${name}” không có chữ (văn bản trống hoặc chỉ có hình ảnh)`);
  return text;
}

const xmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Văn bản thuần → tệp .docx tối giản (Times New Roman 14, khổ A4, lề theo thể thức). */
export function textToDocx(text) {
  const run = (t) => `<w:r><w:t xml:space="preserve">${xmlEsc(t)}</w:t></w:r>`;
  const paras = text
    .split('\n')
    .map((line) => `<w:p>${line.split('\t').map((seg, i) => `${i ? '<w:r><w:tab/></w:r>' : ''}${seg ? run(seg) : ''}`).join('')}</w:p>`)
    .join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="851" w:bottom="1134" w:left="1701" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
  const te = new TextEncoder();
  return createZip([
    { name: '[Content_Types].xml', data: te.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>') },
    { name: '_rels/.rels', data: te.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>') },
    { name: 'word/_rels/document.xml.rels', data: te.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') },
    { name: 'word/document.xml', data: te.encode(doc) },
    { name: 'word/styles.xml', data: te.encode(styles) },
  ]);
}

/** Chuyển tự động .doc → .docx (Uint8Array). Tệp thực chất đã là .docx thì trả nguyên. */
export async function docToDocx(buffer, name) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (sniffDoc(bytes) === 'docx') return bytes;
  return textToDocx(await docToText(bytes, name));
}
