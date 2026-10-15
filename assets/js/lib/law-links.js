// Tự gắn liên kết cho mọi chỗ ghi "Điều N" (Bộ luật Hình sự) trên màn hình → bấm để đọc bình luận của điều đó.
// Chỉ đọc chữ hiển thị, không đụng ô nhập, nút bấm, bản xem trước văn bản; bỏ qua điều của luật khác (BLTTHS, Luật …).

const RE = /(?<![\p{L}\d])(Điều|điều|ĐIỀU|Đ\.)\s?(\d{1,3}[a-zđ]?)(?![\d\p{L}])/gu;
const LIST = /^(\s*(?:,|;|và|hoặc)\s*)(\d{1,3}[a-zđ]?)(?![\d\p{L}])/u;
// Sau số điều ghi rõ luật khác → không gắn.
const OTHER_LAW = /^[^.;\n]{0,70}?(BLTTHS|[Tt]ố\s*tụng|BLDS|[Dd]ân\s*sự|Luật\s+(?![Hh]ình)\p{Lu}|[Ll]uật\s+số|[Nn]ghị\s*định|[Tt]hông\s*tư|[Nn]ghị\s*quyết|[Pp]háp\s*lệnh|[Hh]iến\s*pháp|[Qq]uyết\s*định\s+số|[Cc]ông\s*ước|[Bb]ộ\s*luật\s+(?![Hh]ình\s*sự|HÌNH\s*SỰ|này)\p{L}|(?:BLHS|[Bb]ộ\s*luật\s*[Hh]ình\s*sự)\s*(?:năm\s*)?(?:1985|1999))/u;
const THIS_LAW = /^[^.;\n]{0,70}?(BLHS|Bộ\s*luật\s*hình\s*sự)/iu;
const SKIP = 'a, button, input, textarea, select, option, label.btn, [contenteditable], [contenteditable] *, .vb-page, .law-link, .no-law-link, script, style, code, pre, svg, .toast, .ProseMirror, [data-no-law-link]';

/** Tách một đoạn chữ thành các phần: chữ thường và { so, text } cần gắn liên kết. has(so) kiểm tra sách có điều đó. */
export function splitLawRefs(text, has = () => true) {
  const out = [];
  let i = 0;
  RE.lastIndex = 0;
  let m;
  while ((m = RE.exec(text))) {
    const after = text.slice(m.index + m[0].length);
    const other = OTHER_LAW.exec(after);
    const own = THIS_LAW.exec(after);
    // Luật khác được nhắc trước (hoặc là BLHS cũ 1985 / 1999) → không gắn.
    if (other && (!own || other.index <= own.index || /1985|1999/.test(other[0]))) continue;
    const so = m[2].toLowerCase();
    if (!has(so)) continue;
    if (m.index > i) out.push(text.slice(i, m.index));
    out.push({ so, text: m[0] });
    i = m.index + m[0].length;
    // "Điều 51, 52 và 54" → gắn cả các số sau.
    let rest = text.slice(i);
    let l;
    while ((l = LIST.exec(rest)) && has(l[2].toLowerCase())) {
      out.push(l[1]);
      out.push({ so: l[2].toLowerCase(), text: l[2] });
      i += l[0].length;
      rest = text.slice(i);
    }
    RE.lastIndex = i;
  }
  if (i < text.length) out.push(text.slice(i));
  return out;
}

const seen = new WeakSet();
function linkTextNode(node, has) {
  if (seen.has(node)) return;
  seen.add(node);
  const text = node.nodeValue;
  if (!text || text.length < 6 || !/(Điều|điều|ĐIỀU|Đ\.)\s?\d/u.test(text)) return;
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP)) return;
  const parts = splitLawRefs(text, has);
  if (parts.length === 1 && typeof parts[0] === 'string') return;
  const frag = document.createDocumentFragment();
  for (const p of parts) {
    if (typeof p === 'string') {
      const t = document.createTextNode(p);
      seen.add(t);
      frag.append(t);
    } else {
      const s = document.createElement('span');
      s.className = 'law-link';
      s.setAttribute('role', 'link');
      s.tabIndex = 0;
      s.dataset.bl = p.so;
      s.title = `Đọc bình luận Điều ${p.so} Bộ luật Hình sự`;
      s.textContent = p.text;
      frag.append(s);
    }
  }
  node.replaceWith(frag);
}

function scan(root, has) {
  if (!root) return;
  if (root.nodeType === 3) return linkTextNode(root, has);
  if (root.nodeType !== 1 || root.closest?.(SKIP)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((n) => linkTextNode(n, has));
}

let observer = null;
let opts = null;
let wired = false;

/** Bật tự gắn liên kết. has(so): sách có điều này không; open(so, el): mở bình luận. */
export function startLawLinks({ has, open, root = document.body }) {
  opts = { has, open };
  if (!observer) {
    let queue = new Set();
    let timer = 0;
    const flush = () => {
      timer = 0;
      const list = [...queue];
      queue = new Set();
      if (opts) list.forEach((n) => n.isConnected && scan(n, opts.has));
    };
    observer = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') queue.add(m.target);
        m.addedNodes.forEach((n) => queue.add(n));
      }
      if (!timer) timer = setTimeout(flush, 60);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  }
  if (!wired) {
    wired = true;
    const go = (e) => {
      const el = e.target.closest?.('.law-link');
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      opts?.open(el.dataset.bl, el);
    };
    root.addEventListener('click', go, true); // bắt trước để không kích hoạt thẻ, ô chọn chứa nó
    root.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && go(e));
  }
  scan(root, has);
}

/** Tắt: gỡ các liên kết đã gắn (trả lại chữ thường). */
export function stopLawLinks(root = document.body) {
  observer?.disconnect();
  observer = null;
  opts = null;
  root.querySelectorAll('.law-link').forEach((s) => s.replaceWith(document.createTextNode(s.textContent)));
}
