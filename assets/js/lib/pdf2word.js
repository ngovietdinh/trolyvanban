// PDF sang Word: dựng lại bố cục (dòng → đoạn, căn lề, thụt dòng, cỡ chữ, đậm/nghiêng, bảng, phần đầu 2 cột)
// từ lớp chữ của PDF; trang ảnh quét dùng OCR (tesseract) hoặc AI đọc ảnh. Kết quả là doc model của docx-flow.js.
import { detectLegacy, fixLegacy } from './vn-legacy.js';

let pdfjsPromise = null;
export async function loadPdfjs() {
  pdfjsPromise ??= import('../../vendor/pdfjs/pdf.min.mjs').then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    return m;
  });
  return pdfjsPromise;
}

export async function openPdf(buffer) {
  const pdfjs = await loadPdfjs();
  return pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
}

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const quantile = (arr, q) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)))];
};

/* ======================= Trích chữ có toạ độ ======================= */

function fontStyle(name = '', family = '') {
  const n = `${name} ${family}`;
  return {
    bold: /bold|black|heavy|semibold|demi|,b\b|-b\b|\bbd\b|[-,]bd/i.test(n),
    italic: /italic|oblique|,i\b|-i\b|\bit\b|-it\b/i.test(n),
    font: /arial|helvetica|liberation ?sans|arimo/i.test(n) ? 'Arial' : /calibri|carlito/i.test(n) ? 'Calibri' : /courier|mono/i.test(n) ? 'Courier New' : 'Times New Roman',
    upperFont: /\.vn\w*h\b|vn\w+h$/i.test(name.replace(/^[A-Z]{6}\+/, '')), // TCVN3 phông chữ hoa (.VnTimeH)
  };
}

/** Lấy các mẩu chữ của một trang: { str, x0, x1, base, size, bold, italic, font } (pt, gốc trên-trái). */
export async function pageItems(page, { fixFonts = true } = {}) {
  const vp = page.getViewport({ scale: 1 });
  // Không chuẩn hoá NFKC: bước này biến µ → μ, ª → a, ¹ → 1… làm hỏng chữ phông cũ TCVN3.
  const content = await page.getTextContent({ includeMarkedContent: false, disableNormalization: true });
  // Nạp phông để biết tên (đậm/nghiêng, bảng mã cũ).
  try {
    await page.getOperatorList();
  } catch {}
  const fontCache = {};
  const fontOf = (id) => {
    if (fontCache[id]) return fontCache[id];
    let name = '';
    try {
      if (page.commonObjs.has(id)) name = page.commonObjs.get(id)?.name || '';
    } catch {}
    const fam = content.styles?.[id]?.fontFamily || '';
    return (fontCache[id] = { name, ...fontStyle(name, fam) });
  };
  const items = [];
  for (const it of content.items) {
    if (!('str' in it) || !it.str) continue;
    // Mẩu chỉ có khoảng trắng: giữ làm dấu cách nhưng không tính độ rộng (PDF hay dùng một “dấu cách” rất rộng để đẩy chữ sang cột bên phải).
    const ws = !it.str.trim();
    const [a, b, c, d, e, f] = it.transform;
    // Bỏ chữ xoay (dọc) — không phải nội dung chính.
    if (Math.abs(b) > Math.abs(a) * 0.3 && Math.abs(a) > 0.01) continue;
    const size = Math.hypot(c, d) || Math.abs(d) || it.height || 10;
    const [x, y] = vp.convertToViewportPoint(e, f);
    const fo = fontOf(it.fontName);
    let str = it.str;
    if (fixFonts) {
      const enc = detectLegacy(str, fo.name);
      if (enc) str = fixLegacy(str, enc, { upper: fo.upperFont });
    }
    str = str.replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff').replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl').normalize('NFC');
    items.push({ str: ws ? ' ' : str, ws, x0: x, x1: x + (it.width || str.length * size * 0.5), base: y, size, bold: fo.bold, italic: fo.italic, font: fo.font, fontName: fo.name });
  }
  return { items, width: vp.width, height: vp.height };
}

/* ======================= Nét kẻ (bảng có đường viền) ======================= */

/** Lấy các nét kẻ ngang/dọc vẽ trên trang (đường viền bảng): { h: [{y, x0, x1}], v: [{x, y0, y1}] } (pt, gốc trên-trái). */
export async function pageRules(page) {
  const pdfjs = await loadPdfjs();
  const OPS = pdfjs.OPS;
  const vp = page.getViewport({ scale: 1 });
  let ops;
  try {
    ops = await page.getOperatorList();
  } catch {
    return { h: [], v: [] };
  }
  const PAINT = new Set([OPS.fill, OPS.eoFill, OPS.stroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].filter((x) => x !== undefined));
  const STROKE = new Set([OPS.stroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].filter((x) => x !== undefined));
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  let ctm = [1, 0, 0, 1, 0, 0];
  let lineW = 1;
  const stack = [];
  const h = [];
  const v = [];
  const pt = (x, y) => {
    const X = ctm[0] * x + ctm[2] * y + ctm[4];
    const Y = ctm[1] * x + ctm[3] * y + ctm[5];
    return vp.convertToViewportPoint(X, Y);
  };
  const addBox = (x0, y0, x1, y1, stroked) => {
    const a = pt(x0, y0);
    const b = pt(x1, y1);
    const L = Math.min(a[0], b[0]);
    const Rr = Math.max(a[0], b[0]);
    const T = Math.min(a[1], b[1]);
    const B = Math.max(a[1], b[1]);
    const w = Rr - L;
    const hh = B - T;
    const lw = Math.max(0.3, lineW * Math.hypot(ctm[0], ctm[1]));
    if (hh <= 2.5 && w > 6) h.push({ y: (T + B) / 2, x0: L, x1: Rr });
    else if (w <= 2.5 && hh > 6) v.push({ x: (L + Rr) / 2, y0: T, y1: B });
    else if (stroked && w > 6 && hh > 6 && lw < 3) {
      // Ô chữ nhật được vẽ viền → 4 cạnh.
      h.push({ y: T, x0: L, x1: Rr }, { y: B, x0: L, x1: Rr });
      v.push({ x: L, y0: T, y1: B }, { x: Rr, y0: T, y1: B });
    }
  };
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.save) stack.push([ctm, lineW]);
    else if (fn === OPS.restore) [ctm, lineW] = stack.pop() || [ctm, lineW];
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.setLineWidth) lineW = args[0];
    else if (fn === OPS.constructPath) {
      const paint = args[0];
      if (!PAINT.has(paint)) continue;
      const stroked = STROKE.has(paint);
      const paths = Array.isArray(args[1]) ? args[1] : [args[1]];
      for (const path of paths) {
        if (!path || typeof path.length !== 'number') continue;
        // Mã đường đi (pdf.js ≥ 4.x): 0 moveTo, 1 lineTo, 2 curveTo, 3 quadraticCurveTo, 4 closePath.
        let sub = [];
        const flush = () => {
          if (sub.length >= 2) {
            const xs = sub.map((p) => p[0]);
            const ys = sub.map((p) => p[1]);
            const curve = sub.curve;
            if (!curve) {
              if (sub.length === 2 && stroked) {
                // Đoạn thẳng được vẽ nét.
                const lw2 = lineW / 2;
                addBox(Math.min(...xs) - (ys[0] === ys[1] ? 0 : lw2), Math.min(...ys) - (ys[0] === ys[1] ? lw2 : 0), Math.max(...xs) + (ys[0] === ys[1] ? 0 : lw2), Math.max(...ys) + (ys[0] === ys[1] ? lw2 : 0), false);
              } else addBox(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), stroked);
            }
          }
          sub = [];
        };
        for (let k = 0; k < path.length; ) {
          const op = path[k];
          if (op === 0) {
            flush();
            sub.push([path[k + 1], path[k + 2]]);
            k += 3;
          } else if (op === 1) {
            sub.push([path[k + 1], path[k + 2]]);
            k += 3;
          } else if (op === 2) {
            sub.curve = true;
            k += 7;
          } else if (op === 3) {
            sub.curve = true;
            k += 5;
          } else {
            k += 1;
          }
        }
        flush();
      }
    }
  }
  return { h: mergeSegs(h, 'y', 'x0', 'x1'), v: mergeSegs(v, 'x', 'y0', 'y1') };
}

function mergeSegs(list, pos, a, b) {
  const s = [...list].sort((p, q) => p[pos] - q[pos] || p[a] - q[a]);
  const out = [];
  for (const x of s) {
    const last = out.find((o) => Math.abs(o[pos] - x[pos]) < 1.2 && x[a] <= o[b] + 1.5 && x[b] >= o[a] - 1.5);
    if (last) {
      last[a] = Math.min(last[a], x[a]);
      last[b] = Math.max(last[b], x[b]);
    } else out.push({ ...x });
  }
  return out;
}

const uniq = (vals, tol = 2) => {
  const s = [...vals].sort((a, b) => a - b);
  const out = [];
  for (const v of s) if (!out.length || v - out[out.length - 1] > tol) out.push(v);
  return out;
};

/**
 * Bảng có đường viền: dựng lưới ô từ nét kẻ, xếp chữ vào ô.
 * Trả về { tables: [{ top, bottom, block }], rest: items không thuộc bảng }.
 */
export function ruledTables(items, rules) {
  const H = rules.h.filter((r) => r.x1 - r.x0 > 15);
  const V = rules.v.filter((r) => r.y1 - r.y0 > 6);
  if (H.length < 2 || V.length < 2) return { tables: [], rest: items };
  // Gom các nét ngang chồng lấn theo chiều ngang thành vùng bảng.
  const regions = [];
  for (const r of [...H].sort((a, b) => a.y - b.y)) {
    const g = regions.find((g) => r.x0 < g.x1 - 5 && r.x1 > g.x0 + 5 && r.y - g.y1 < 260 && V.some((v) => v.x > Math.max(g.x0, r.x0) - 3 && v.x < Math.min(g.x1, r.x1) + 3 && v.y0 < r.y + 2 && v.y1 > g.y1 - 2));
    if (g) {
      g.x0 = Math.min(g.x0, r.x0);
      g.x1 = Math.max(g.x1, r.x1);
      g.y1 = r.y;
      g.hs.push(r);
    } else regions.push({ x0: r.x0, x1: r.x1, y0: r.y, y1: r.y, hs: [r] });
  }
  const tables = [];
  let rest = items;
  for (const g of regions) {
    if (g.hs.length < 2 || g.y1 - g.y0 < 8) continue;
    const vs = V.filter((v) => v.x > g.x0 - 3 && v.x < g.x1 + 3 && v.y1 > g.y0 + 2 && v.y0 < g.y1 - 2);
    const xs = uniq([g.x0, g.x1, ...vs.map((v) => v.x)], 3);
    const ys = uniq(g.hs.map((h) => h.y), 2);
    if (xs.length < 2 || ys.length < 2) continue;
    const inside = (it) => {
      const cx = (it.x0 + it.x1) / 2;
      const cy = it.base - it.size * 0.3;
      return cx > g.x0 - 1 && cx < g.x1 + 1 && cy > g.y0 - 1 && cy < g.y1 + 1;
    };
    const mine = rest.filter(inside);
    if (!mine.length) continue;
    rest = rest.filter((it) => !inside(it));
    const hasV = (x, y0, y1) => vs.some((v) => Math.abs(v.x - x) < 3 && v.y0 <= y0 + 3 && v.y1 >= y1 - 3);
    const rows = [];
    for (let r = 0; r < ys.length - 1; r++) {
      const y0 = ys[r];
      const y1 = ys[r + 1];
      if (y1 - y0 < 4) continue;
      const row = [];
      for (let c = 0; c < xs.length - 1; c++) {
        const x0 = xs[c];
        const x1 = xs[c + 1];
        // Không có nét dọc ở mép trái ô → ô gộp với ô bên trái.
        if (c > 0 && row.length && !hasV(x0, y0, y1)) {
          const prev = row[row.length - 1];
          prev.span = (prev.span || 1) + 1;
          prev.x1 = x1;
          continue;
        }
        row.push({ x0, x1, y0, y1, span: 1 });
      }
      for (const cell of row) {
        const its = mine.filter((it) => {
          const cx = (it.x0 + it.x1) / 2;
          const cy = it.base - it.size * 0.3;
          return cx >= cell.x0 - 0.5 && cx < cell.x1 + 0.5 && cy >= cell.y0 - 0.5 && cy < cell.y1 + 0.5;
        });
        cell.blocks = cellBlocks(its, cell);
      }
      rows.push(row.map(({ blocks, span }) => ({ blocks, span })));
    }
    if (!rows.length) continue;
    const cols = xs.slice(1).map((x, i) => round1(x - xs[i]));
    tables.push({ top: g.y0, bottom: g.y1, x0: g.x0, block: { type: 'table', borders: true, cols, rows } });
  }
  return { tables, rest };
}

/** Đoạn văn trong một ô bảng có viền (căn theo vị trí chữ trong ô). */
function cellBlocks(items, cell) {
  if (!items.length) return [];
  const lines = buildLines(items);
  const w = cell.x1 - cell.x0;
  const paras = [];
  let cur = null;
  for (const l of lines) {
    const lg = l.x0 - cell.x0;
    const rg = cell.x1 - l.x1;
    const align = Math.abs(lg - rg) < Math.max(4, l.size * 0.8) && lg > l.size * 0.6 ? 'center' : rg < l.size * 0.6 && lg > w * 0.3 ? 'right' : 'left';
    const runs = [];
    l.segments.forEach((s, i) => {
      if (i) runs.push({ ...s.runs[0], text: ' ' });
      runs.push(...s.runs.map((r) => ({ ...r })));
    });
    if (cur && cur.align === align && l.base - cur.lastBase < l.size * 1.7) {
      const last = cur.runs[cur.runs.length - 1];
      if (last && !/\s$/.test(last.text)) last.text += ' ';
      cur.runs.push(...runs);
      cur.lastBase = l.base;
    } else {
      cur = { type: 'p', align, runs, before: 0, after: 0, lastBase: l.base };
      paras.push(cur);
    }
  }
  return paras.map(({ lastBase, ...p }) => p);
}

/* ======================= Dòng ======================= */

/** Gom mẩu chữ thành dòng (cùng đường chân chữ), tách đoạn trong dòng khi khoảng trống lớn (cột, tab). */
export function buildLines(items) {
  const sorted = [...items].sort((p, q) => p.base - q.base || p.x0 - q.x0);
  const lines = [];
  for (const it of sorted) {
    const tol = Math.max(2, it.size * 0.45);
    let line = null;
    for (let i = lines.length - 1; i >= 0 && i >= lines.length - 4; i--) {
      const l = lines[i];
      // Chỉ số trên (số chú thích) nằm cao hơn chân chữ một chút vẫn thuộc dòng.
      const supOk = it.size < l.size * 0.8 && it.base < l.base && l.base - it.base < l.size * 0.6;
      if (Math.abs(l.base - it.base) <= tol || supOk) {
        line = l;
        break;
      }
    }
    if (!line) {
      line = { items: [], base: it.base, size: it.size };
      lines.push(line);
    }
    line.items.push(it);
    if (it.size >= line.size * 0.8) line.size = Math.max(line.size, it.size);
  }
  return lines.map(finishLine).filter((l) => l.text.trim());
}

function finishLine(l) {
  const all = l.items.sort((a, b) => a.x0 - b.x0);
  const items = all.filter((i) => !i.ws);
  if (!items.length) return { text: '', segments: [] };
  const sizes = items.filter((i) => i.str.trim()).map((i) => i.size);
  const size = median(sizes) || l.size;
  const segments = [];
  let seg = null;
  let prev = null;
  let space = false;
  for (const it of all) {
    if (it.ws) {
      if (prev) space = true;
      continue;
    }
    const gap = prev ? it.x0 - prev.x1 : 0;
    if (!seg || gap > Math.max(size * 2.2, 18)) {
      seg = { x0: it.x0, x1: it.x1, runs: [] };
      segments.push(seg);
    } else if (prev && (space || gap > size * 0.18 || (prev.word && it.word)) && !/\s$/.test(prev.str) && !/^\s/.test(it.str)) {
      pushRun(seg.runs, ' ', prev);
    }
    space = false;
    const sup = it.size < size * 0.78 && l.base - it.base > size * 0.18;
    pushRun(seg.runs, it.str, it, sup);
    seg.x1 = Math.max(seg.x1, it.x1);
    prev = it;
  }
  for (const s of segments) {
    s.runs = s.runs.map((r) => ({ ...r, text: r.text.replace(/\s{2,}/g, ' ') }));
    s.text = s.runs.map((r) => r.text).join('');
  }
  const x0 = Math.min(...items.map((i) => i.x0));
  const x1 = Math.max(...items.map((i) => i.x1));
  return {
    x0,
    x1,
    base: l.base,
    top: l.base - size * 0.9,
    bottom: l.base + size * 0.25,
    size,
    segments,
    text: segments.map((s) => s.text).join('\t'),
    bold: items.filter((i) => i.str.trim()).every((i) => i.bold),
  };
}

function pushRun(runs, text, it, sup = false) {
  const last = runs[runs.length - 1];
  const style = { bold: it.bold, italic: it.italic, size: Math.round(it.size * 2) / 2, font: it.font, sup };
  if (text === ' ' && last) {
    last.text += ' ';
    return;
  }
  if (last && last.bold === style.bold && last.italic === style.italic && Math.abs(last.size - style.size) < 0.6 && last.sup === style.sup && last.font === style.font) last.text += text;
  else runs.push({ text, ...style });
}

/* ======================= Đoạn, bảng ======================= */

const LIST_RE = /^(\s*)([-–•+*▪●○]|\d{1,3}[.)]|\d{1,2}\.\d{1,2}\.?|[a-zđ][.)]|[IVXLC]{1,6}[.)]|Điều\s+\d+|Chương\s+[IVXLC\d]+|Mục\s+\d+|Phần\s+[IVXLC\d]+)\s/u;

/**
 * Dựng khối (đoạn, bảng) từ các dòng của một trang.
 * opts.dropPageNumbers: bỏ dòng chỉ có số trang ở đầu/cuối trang.
 */
export function layoutPage(lines, page, { dropPageNumbers = true, tables = [] } = {}) {
  let L = [...lines].sort((a, b) => a.base - b.base || a.x0 - b.x0);
  if (dropPageNumbers) {
    L = L.filter((l, i) => {
      const edge = l.top < page.height * 0.08 || l.bottom > page.height * 0.92;
      return !(edge && /^\s*[-–]?\s*(trang\s*)?\d{1,4}(\s*\/\s*\d{1,4})?\s*[-–]?\s*$/i.test(l.text));
    });
  }
  const pending = [...tables].sort((a, b) => a.top - b.top);
  if (!L.length) return { blocks: pending.map((t) => t.block), margins: defaultMargins(page) };
  const left = quantile(L.map((l) => l.x0), 0.1);
  const right = quantile(L.map((l) => l.x1), 0.92);
  const textW = Math.max(100, right - left);
  const center = left + textW / 2;
  const bodySize = median(L.map((l) => l.size)) || 13;
  const margins = {
    left: clamp(left, 28, page.width * 0.3),
    right: clamp(page.width - right, 20, page.width * 0.3),
    top: clamp(Math.min(...L.map((l) => l.top)) - 4, 20, page.height * 0.25),
    // Trang không kín chữ thì không suy được lề dưới → dùng lề trên làm chuẩn.
    bottom: clamp(page.height - Math.max(...L.map((l) => l.bottom)) - 4, 20, 72),
  };
  const ctx = { left, right, textW, center, bodySize, margins, page };

  // 1) Nhóm bảng / bố cục nhiều cột.
  const groups = findTables(L, ctx);
  const inTable = new Map();
  groups.forEach((g, gi) => g.lines.forEach((l) => inTable.set(l, gi)));

  // 2) Duyệt tuần tự: đoạn văn và bảng.
  const blocks = [];
  let para = null;
  let prev = null;
  const emitted = new Set();
  const spacing = median(L.slice(1).map((l, i) => l.base - L[i].base).filter((d) => d > 0 && d < bodySize * 3)) || bodySize * 1.2;
  const flushTables = (beforeY) => {
    while (pending.length && pending[0].top < beforeY) {
      const t = pending.shift();
      if (para) blocks.push(finishPara(para, ctx));
      para = null;
      t.block.before = prev ? clamp(Math.round(t.top - prev.bottom - 4), 0, 24) : 0;
      blocks.push(t.block);
      prev = { base: t.bottom + bodySize, bottom: t.bottom, top: t.top, x0: left, x1: right, size: bodySize, segments: [], text: '' };
    }
  };
  for (const l of L) {
    flushTables(l.top);
    const gi = inTable.get(l);
    if (gi !== undefined) {
      if (!emitted.has(gi)) {
        if (para) blocks.push(finishPara(para, ctx));
        para = null;
        const tb = tableBlock(groups[gi], ctx);
        tb.before = prev ? gapPt(prev, groups[gi].lines[0], spacing) : 0;
        blocks.push(tb);
        emitted.add(gi);
        prev = groups[gi].lines[groups[gi].lines.length - 1];
      }
      continue;
    }
    const align = lineAlign(l, ctx);
    const startsList = LIST_RE.test(l.text);
    const indented = l.x0 > left + bodySize * 1.2 && align !== 'center' && align !== 'right';
    let newPara = !para;
    if (para) {
      const last = para.lines[para.lines.length - 1];
      const vgap = l.base - last.base;
      const prevShort = last.x1 < right - bodySize * 2.5;
      const sameIndentCont = Math.abs(l.x0 - (para.lines[1]?.x0 ?? left)) < bodySize * 0.8;
      if (vgap > spacing * 1.55 || vgap < 0) newPara = true;
      else if (align !== para.align && !(para.align === 'justify' && align === 'left')) newPara = true;
      else if (startsList) newPara = true;
      else if (prevShort && align !== 'center') newPara = true;
      else if (align === 'center' && last.x1 - last.x0 < textW * 0.72) newPara = true; // tiêu đề, dòng căn giữa ngắn: mỗi dòng một đoạn
      else if (indented && !sameIndentCont && para.lines.length >= 1 && Math.abs(l.x0 - last.x0) > bodySize) newPara = true;
      else if (l.bold !== last.bold && (l.bold ? l.x1 - l.x0 < textW * 0.8 : last.x1 - last.x0 < textW * 0.8)) newPara = true;
      else if (Math.abs(l.size - last.size) > Math.max(1.2, last.size * 0.15)) newPara = true;
      else if (l.segments.length > 1 || last.segments.length > 1) newPara = true;
    }
    if (newPara) {
      if (para) blocks.push(finishPara(para, ctx));
      para = { lines: [l], align: align === 'left' ? 'left' : align, before: prev ? gapPt(prev, l, spacing) : 0 };
    } else {
      para.lines.push(l);
      if (para.align === 'left' && l.x1 > right - bodySize * 1.5) para.align = 'justify';
    }
    prev = l;
  }
  flushTables(Infinity);
  if (para) blocks.push(finishPara(para, ctx));
  return { blocks, margins };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const defaultMargins = (page) => ({ top: 56.7, bottom: 56.7, left: Math.min(85, page.width * 0.12), right: Math.min(42.5, page.width * 0.08) });
const gapPt = (a, b, spacing) => clamp(Math.round(b.base - a.base - spacing), 0, 30);

function lineAlign(l, { left, right, textW, center, bodySize }) {
  const w = l.x1 - l.x0;
  const cx = (l.x0 + l.x1) / 2;
  const lg = l.x0 - left;
  const rg = right - l.x1;
  if (w < textW * 0.88 && Math.abs(cx - center) < bodySize * 1.6 && lg > bodySize * 1.5) return 'center';
  if (rg < bodySize * 0.8 && lg > textW * 0.3) return 'right';
  return 'left';
}

function finishPara(p, ctx) {
  const { left, bodySize } = ctx;
  const first = p.lines[0];
  const rest = p.lines.slice(1);
  const runs = [];
  p.lines.forEach((l, i) => {
    l.segments.forEach((s, si) => {
      if (si > 0) runs.push({ ...s.runs[0], text: '\t' });
      s.runs.forEach((r) => runs.push({ ...r }));
    });
    if (i < p.lines.length - 1) {
      const lastRun = runs[runs.length - 1];
      if (lastRun && !/\s$/.test(lastRun.text)) lastRun.text += ' ';
    }
  });
  // Gộp các mẩu cùng kiểu.
  const merged = [];
  for (const r of runs) {
    const m = merged[merged.length - 1];
    if (m && m.bold === r.bold && m.italic === r.italic && m.size === r.size && m.sup === r.sup && m.font === r.font) m.text += r.text;
    else merged.push(r);
  }
  const block = { type: 'p', align: p.align, runs: merged, before: p.before || 0, after: 0 };
  if (p.align === 'left' || p.align === 'justify') {
    // Đoạn một dòng thụt vào: coi là thụt đầu dòng (thường gặp trong văn bản hành chính).
    const baseX = rest.length ? median(rest.map((l) => l.x0)) : first.x0 - left < bodySize * 4 ? left : first.x0;
    const indLeft = baseX - left;
    if (indLeft > bodySize * 0.8) block.indentLeft = round1(indLeft);
    const firstDelta = first.x0 - baseX;
    if (Math.abs(firstDelta) > bodySize * 0.5) block.indentFirst = round1(firstDelta);
  }
  // Giãn dòng ước lượng từ khoảng cách chân chữ.
  if (p.lines.length > 1) {
    const d = median(p.lines.slice(1).map((l, i) => l.base - p.lines[i].base));
    const ratio = d / (first.size * 1.15);
    block.line = clamp(Math.round(ratio * 20) / 20, 1, 2.5);
  }
  // Tab stop tại vị trí các đoạn sau (dòng “Số: …⇥Hà Nội, ngày…”).
  if (first.segments.length > 1) {
    block.tabs = first.segments.slice(1).map((s) => round1(s.x0 - left - (block.indentLeft || 0)));
    block.align = 'left';
  }
  return block;
}
const round1 = (v) => Math.round(v * 10) / 10;

/** Tìm vùng nhiều dòng có cột thẳng hàng → bảng (≥3 cột: có kẻ; 2 cột: bố cục không kẻ như phần đầu văn bản). */
function findTables(L, ctx) {
  const { bodySize, textW } = ctx;
  const groups = [];
  let cur = null;
  const close = () => {
    if (cur && cur.lines.filter((l) => l.segments.length > 1).length >= 2) groups.push(cur);
    cur = null;
  };
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    const prev = L[i - 1];
    const near = prev && l.base - prev.base < Math.max(l.size, prev.size) * 2.6;
    if (l.segments.length > 1) {
      if (cur && near && compatible(cur, l, bodySize)) {
        addLine(cur, l, bodySize);
      } else {
        close();
        cur = { lines: [], cols: [] };
        // Dòng một đoạn ngay phía trên, nằm gọn trong một cột (vd: “BỘ CÔNG AN” trên “CỤC CẢNH SÁT…”).
        const above = L[i - 1];
        if (above && above.segments.length === 1 && l.base - above.base < l.size * 2.6 && above.x1 - above.x0 < textW * 0.55 && !groups.some((g) => g.lines.includes(above))) {
          cur.pending = above;
        }
        addLine(cur, l, bodySize);
        if (cur.pending && fitsColumn(cur, cur.pending, bodySize, ctx.center)) cur.lines.unshift(cur.pending);
        delete cur.pending;
      }
    } else if (cur && near && l.x1 - l.x0 < textW * 0.6 && fitsColumn(cur, l, bodySize, ctx.center)) {
      cur.lines.push(l);
    } else if (cur && prev && l.base - prev.base < l.size * 7 && l.x1 - l.x0 < textW * 0.45 && fitsColumn(cur, l, bodySize, ctx.center) && cur.cols.length === 2 && l.x0 > Math.max(...cur.cols.map((c) => c.x0)) - bodySize * 2) {
      // Họ tên người ký nằm dưới khoảng trống ký, thẳng cột phải.
      l.gapBefore = true;
      cur.lines.push(l);
    } else close();
  }
  close();
  for (const g of groups) g.cols.sort((a, b) => a.x0 - b.x0);
  return groups;
}

function addLine(g, l, size) {
  g.lines.push(l);
  for (const s of l.segments) {
    const c = g.cols.find((c) => overlap(c, s) || Math.abs(c.x0 - s.x0) < size * 1.5);
    if (c) {
      c.x0 = Math.min(c.x0, s.x0);
      c.x1 = Math.max(c.x1, s.x1);
    } else g.cols.push({ x0: s.x0, x1: s.x1 });
  }
}
const overlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > Math.min(a.x1 - a.x0, b.x1 - b.x0) * 0.3;
function compatible(g, l, size) {
  // Mỗi đoạn của dòng phải khớp một cột hiện có (hoặc nằm ngoài mọi cột, tạo cột mới khi còn ít cột).
  const hits = l.segments.filter((s) => g.cols.some((c) => overlap(c, s) || Math.abs(c.x0 - s.x0) < size * 1.5)).length;
  return hits >= Math.min(l.segments.length, 2) - (g.cols.length < 2 ? 1 : 0);
}
function fitsColumn(g, l, size, center) {
  // Dòng phải nằm gọn trong một cột và không to hơn chữ thường (tiêu đề căn giữa cả trang thì không thuộc bảng).
  const ref = Math.max(size, median(g.lines.map((x) => x.size)));
  const cx = (l.x0 + l.x1) / 2;
  return (
    g.cols.some((c) => {
      const inCol = overlap(c, { x0: l.x0, x1: l.x1 }) && l.x0 > c.x0 - size * 2 && l.x1 < c.x1 + size * 2;
      const colCenter = (c.x0 + c.x1) / 2;
      const pageCentered = center !== undefined && Math.abs(cx - center) < size * 1.2 && Math.abs(colCenter - center) > size * 3 && Math.abs(cx - colCenter) > size * 1.2;
      return inCol && !pageCentered;
    }) && l.size - ref < Math.max(0.9, l.size * 0.07)
  );
}

function tableBlock(g, ctx) {
  const { left, right, bodySize } = ctx;
  const cols = g.cols;
  const n = cols.length;
  // Ranh giới cột: giữa khoảng trống hai cột liền kề.
  const edges = [left];
  for (let i = 1; i < n; i++) edges.push((cols[i - 1].x1 + cols[i].x0) / 2);
  edges.push(Math.max(right, cols[n - 1].x1));
  const widths = edges.slice(1).map((e, i) => Math.max(20, e - edges[i]));
  const colOf = (s) => {
    const cx = (s.x0 + s.x1) / 2;
    for (let i = 0; i < n; i++) if (cx < edges[i + 1]) return i;
    return n - 1;
  };
  const layout = n === 2; // phần đầu văn bản hành chính, chữ ký…: bảng không kẻ, mỗi cột là một ô nhiều dòng
  let rows;
  if (layout) {
    const cells = [[], []];
    for (const l of g.lines) for (const s of l.segments) cells[colOf(s)].push({ seg: s, line: l });
    rows = [cells.map((items, ci) => ({ blocks: cellParas(items, edges[ci], widths[ci], bodySize) }))];
  } else {
    rows = [];
    for (const l of g.lines) {
      const cells = Array.from({ length: n }, () => []);
      for (const s of l.segments) cells[colOf(s)].push({ seg: s, line: l });
      // Dòng chỉ có chữ ở các cột sau → nối tiếp ô của hàng trước (ô nhiều dòng).
      const cont = rows.length && cells[0].length === 0 && l.segments.length === 1;
      if (cont) cells.forEach((c, i) => c.forEach((x) => rows[rows.length - 1].raw[i].push(x)));
      else rows.push({ raw: cells });
    }
    rows = rows.map((r) => r.raw.map((items, ci) => ({ blocks: cellParas(items, edges[ci], widths[ci], bodySize, true) })));
  }
  return { type: 'table', borders: !layout, cols: widths.map(round1), rows, indent: 0 };
}

/** Đoạn văn trong một ô: gộp dòng liền nhau, giữ căn giữa nếu các dòng nằm giữa ô. */
function cellParas(items, x0, w, size, compact = false) {
  if (!items.length) return [];
  const paras = [];
  let cur = null;
  for (const { seg, line } of items) {
    const cx = (seg.x0 + seg.x1) / 2;
    const centered = Math.abs(cx - (x0 + w / 2)) < Math.max(size * 1.5, w * 0.12) && seg.x1 - seg.x0 < w * 0.92;
    const align = centered ? 'center' : 'left';
    const join = cur && compact && cur.align === align && line.base - cur.lastBase < line.size * 1.8;
    if (join) {
      const last = cur.runs[cur.runs.length - 1];
      if (last && !/\s$/.test(last.text)) last.text += ' ';
      cur.runs.push(...seg.runs.map((r) => ({ ...r })));
    } else {
      const before = line.gapBefore && cur ? clamp(Math.round(line.base - cur.lastBase - line.size * 1.3), 0, 80) : 0;
      cur = { type: 'p', align, runs: seg.runs.map((r) => ({ ...r })), before, after: 0, lastBase: line.base };
      paras.push(cur);
    }
    cur.lastBase = line.base;
  }
  return paras.map(({ lastBase, ...p }) => p);
}

/* ======================= OCR → dòng ======================= */

/** Chuyển kết quả OCR (toạ độ pixel) thành dòng (pt) cùng định dạng với lớp chữ PDF. */
export function ocrToLines(ocr, scale) {
  // Cỡ chữ ước lượng từ chiều cao dòng rất dao động (dòng có/không có chữ hoa, dấu, chân chữ) →
  // đưa các dòng gần cỡ chữ chính về đúng cỡ đó và làm tròn theo cỡ chuẩn.
  const heights = ocr.lines.map((l) => (l.y1 - l.y0) / scale).filter((h) => h > 3);
  const bodyH = median(heights) || 16;
  const STD = [8, 9, 10, 10.5, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 32, 36];
  const snap = (v) => STD.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), STD[0]);
  const body = snap(bodyH / 1.2);
  const sizeOf = (h) => {
    const r = h / bodyH;
    if (r > 0.6 && r < 1.3) return body;
    return clamp(snap(h / 1.2), 7, 40);
  };
  return ocr.lines
    .map((l) => {
      const h = (l.y1 - l.y0) / scale;
      const size = sizeOf(h);
      const words = l.words.length ? l.words : [{ text: l.text, x0: l.x0, x1: l.x1 }];
      const items = words
        .filter((w) => w.text.trim())
        .map((w) => ({ str: w.text, word: true, x0: w.x0 / scale, x1: w.x1 / scale, base: l.y1 / scale - size * 0.22, size, bold: false, italic: false, font: 'Times New Roman' }));
      if (!items.length) return null;
      const line = finishLine({ items, base: l.y1 / scale - size * 0.22, size });
      line.confidence = l.confidence;
      return line;
    })
    .filter(Boolean);
}

/* ======================= Trang ảnh quét ======================= */

/** Trang có lớp chữ thật hay chỉ là ảnh quét. */
export function isScanned(items) {
  const chars = items.reduce((n, i) => n + i.str.replace(/\s/g, '').length, 0);
  return chars < 25;
}

/** Vẽ trang PDF ra canvas để OCR / gửi AI. */
export async function renderPage(page, targetWidth = 2200) {
  const vp1 = page.getViewport({ scale: 1 });
  const scale = Math.min(4, targetWidth / vp1.width);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: g, viewport: vp, background: 'white' }).promise;
  enhanceForOcr(canvas);
  return { canvas, scale };
}

/** Tăng tương phản, chuyển xám cho ảnh quét (nền ố vàng, chữ mờ) — giúp OCR nhận chữ in đậm, chữ hoa có dấu chính xác hơn. */
export function enhanceForOcr(canvas) {
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const img = g.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) hist[(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0]++;
  // Kéo giãn mức xám theo phân vị 1% – 99%.
  const total = d.length / 4;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc > total * 0.01) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc > total * 0.01) {
      hi = v;
      break;
    }
  }
  if (hi - lo < 40) return;
  const k = 255 / (hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const y = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 - lo) * k;
    const v = y < 0 ? 0 : y > 255 ? 255 : y;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
}
