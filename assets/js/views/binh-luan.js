// Mục "Bình luận khoa học Bộ luật Hình sự": nạp sách một lần, mục lục theo Phần / Chương / Mục, đọc từng điều
// (nguyên văn điều luật + bình luận + chú thích), tìm toàn văn không dấu, cỡ chữ tùy chỉnh. Nội dung giữ nguyên 100%.
import { $, $$, icon, toast, escapeHtml, debounce, warnMissing } from '../ui.js';
import { store } from '../lib/store.js';
import { tocTree, searchBook } from '../legal/binh-luan.js';
import { loadBook, currentBook, importBookFile, removeBook } from '../legal/binh-luan-store.js';
import { articleHtml } from './bl-render.js';

const SIZE_KEY = 'bl-size';
const LAST_KEY = 'bl-last';
let lastQuery = '';
let tocScroll = 0;

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

function emptyHtml() {
  return `<section class="bl-empty card">
    <span class="bl-empty-ic">${icon('book')}</span>
    <h2>Chưa nạp sách Bình luận</h2>
    <p>Chọn tệp sách <strong>Bình luận khoa học Bộ luật Hình sự</strong> của bạn (Word .doc / .docx hoặc .txt). Phần mềm đọc ngay trên máy, tách theo Phần – Chương – Mục – Điều, <strong>đối chiếu từng dòng với bản gốc</strong> (không thêm, bớt, sửa chữ nào) rồi lưu trên máy này. Sách không gửi đi đâu và không nằm trong mã nguồn phần mềm.</p>
    <label class="btn btn-primary bl-import">${icon('upload', 'ic-sm')}Nạp sách Bình luận<input type="file" accept=".doc,.docx,.txt,application/msword" hidden data-bl-file /></label>
    <p class="hint" data-bl-say aria-live="polite"></p>
  </section>`;
}

function tocHtml(book, cur) {
  const curA = book.articles.find((a) => a.so === cur);
  return tocTree(book)
    .map(
      (p) => `<details class="bl-toc-p" ${!curA || curA.phan === p.phan ? 'open' : ''}><summary>${escapeHtml(p.phan || 'Phần mở đầu')}</summary>
      ${p.chuongs
        .map(
          (c) => `<details class="bl-toc-c" ${curA && curA.chuong === c.chuong ? 'open' : ''}><summary>${escapeHtml(c.chuong || '—')}</summary>
          ${c.mucs
            .map(
              (m) => `${m.muc ? `<p class="bl-toc-m">${escapeHtml(m.muc)}</p>` : ''}<ul>${m.items
                .map((it) => `<li><a href="#binh-luan/${encodeURIComponent(it.so)}" data-so="${escapeHtml(it.so)}" ${it.so === cur ? 'aria-current="true"' : ''}><b>Điều ${escapeHtml(it.so)}.</b> ${escapeHtml(it.ten)}</a></li>`)
                .join('')}</ul>`,
            )
            .join('')}</details>`,
        )
        .join('')}</details>`,
    )
    .join('');
}

function navHtml(book, a) {
  const i = book.articles.indexOf(a);
  const prev = book.articles[i - 1];
  const next = book.articles[i + 1];
  const link = (x, dir) =>
    x ? `<a class="btn btn-sm ${dir === 'next' ? 'bl-next' : ''}" href="#binh-luan/${encodeURIComponent(x.so)}" data-bl-${dir}>${dir === 'prev' ? `${icon('chevron-left', 'ic-sm')}Điều ${escapeHtml(x.so)}` : `Điều ${escapeHtml(x.so)}${icon('arrow-right', 'ic-sm')}`}</a>` : '<span></span>';
  return `<nav class="bl-nav" aria-label="Chuyển điều">${link(prev, 'prev')}${link(next, 'next')}</nav>`;
}

export function render(ctx, params = []) {
  const root = ctx.view;
  let size = Math.min(26, Math.max(15, +store.get(SIZE_KEY, 19) || 19));
  let book = currentBook();

  const draw = () => {
    book = currentBook();
    const want = params[0] ? decodeURIComponent(params[0]).toLowerCase() : null;
    const cur = book ? book.articles.find((a) => a.so === (want || store.get(LAST_KEY, '1'))) || book.articles[0] : null;
    root.innerHTML = `<div class="page bl-page" style="--bl-size:${size}px">
      <div class="page-head"><div><h1 class="page-title">Bình luận khoa học <em>Bộ luật Hình sự</em></h1>
        <p class="page-sub">${book ? `${fmt(book.meta?.articles || book.articles.length)} điều · ${escapeHtml(book.title.filter((x) => x.trim()).join(' · '))}` : 'Đọc nguyên văn điều luật và bình luận khoa học của từng điều; bấm vào “Điều …” ở bất kỳ màn hình nào để mở bình luận.'}</p></div>
        ${
          book
            ? `<div class="bl-tools">
          <label class="bl-search">${icon('search', 'ic-sm')}<input class="input" type="search" placeholder="Tìm trong sách (không dấu được) hoặc số điều…" value="${escapeHtml(lastQuery)}" data-bl-q aria-label="Tìm trong sách Bình luận" /></label>
          <div class="bl-size" role="group" aria-label="Cỡ chữ"><button class="btn btn-sm btn-ghost" type="button" data-bl-size="-1" aria-label="Chữ nhỏ hơn">A−</button><span data-bl-size-v>${size}</span><button class="btn btn-sm btn-ghost" type="button" data-bl-size="1" aria-label="Chữ lớn hơn">A+</button></div>
          <details class="bl-more"><summary class="btn btn-sm btn-ghost btn-icon" aria-label="Tùy chọn sách">${icon('settings', 'ic-sm')}</summary><div class="bl-more-menu">
            <p class="hint">${escapeHtml(book.meta?.file || '')}${book.meta?.lines ? ` · đối chiếu khớp ${fmt(book.meta.lines)} dòng với bản gốc` : ''}</p>
            <label class="btn btn-sm">${icon('upload', 'ic-sm')}Nạp lại sách<input type="file" accept=".doc,.docx,.txt,application/msword" hidden data-bl-file /></label>
            <button class="btn btn-sm btn-ghost" type="button" data-bl-remove>${icon('trash', 'ic-sm')}Gỡ sách khỏi máy này</button>
          </div></details>
        </div>`
            : ''
        }
      </div>
      ${
        book
          ? `<div class="bl-layout">
        <details class="bl-toc-wrap" ${matchMedia('(max-width: 900px)').matches && params[0] ? '' : 'open'}><summary class="bl-toc-head">${icon('layers', 'ic-sm')}Mục lục</summary>
          <input class="input input-sm" type="search" placeholder="Lọc theo số / tên điều…" data-bl-filter aria-label="Lọc mục lục" />
          <nav class="bl-toc" aria-label="Mục lục sách Bình luận">${tocHtml(book, cur?.so)}</nav>
          <p class="hint" data-bl-say aria-live="polite"></p>
        </details>
        <div class="bl-main" data-bl-main>${cur ? `${navHtml(book, cur)}${articleHtml(book, cur, { q: lastQuery && !/^\d/.test(lastQuery) ? lastQuery : '' })}${navHtml(book, cur)}` : ''}</div>
      </div>`
          : emptyHtml()
      }
    </div>`;
    if (cur) store.set(LAST_KEY, cur.so);
    bind(cur);
  };

  const showResults = (q) => {
    const main = $('[data-bl-main]', root);
    const res = searchBook(book, q, 80);
    main.innerHTML = `<div class="bl-results"><h2>${res.length ? `${res.length >= 80 ? 'Hơn 80' : res.length} điều có “${escapeHtml(q)}”` : `Không thấy “${escapeHtml(q)}” trong sách`}</h2>
      <ul>${res
        .map((r) => `<li><a href="#binh-luan/${encodeURIComponent(r.so)}"><b>Điều ${escapeHtml(r.so)}.</b> ${escapeHtml(r.ten)}</a>${r.snippet ? `<p><span class="badge">${r.where === 'vb' ? 'Điều luật' : 'Bình luận'}</span> ${escapeHtml(r.snippet)}</p>` : ''}</li>`)
        .join('')}</ul></div>`;
  };

  function bind(cur) {
    const fileInputs = $$('[data-bl-file]', root);
    fileInputs.forEach((inp) =>
      inp.addEventListener('change', async () => {
        const f = inp.files[0];
        inp.value = '';
        if (!f) return;
        const say = $('[data-bl-say]', root);
        if (say) say.textContent = `Đang đọc “${f.name}” và đối chiếu với bản gốc…`;
        try {
          const meta = await importBookFile(f);
          toast(`Đã nạp ${fmt(meta.articles)} điều (${fmt(meta.withBl)} điều có bình luận, ${fmt(meta.notes)} chú thích) — đối chiếu khớp ${fmt(meta.lines)}/${fmt(meta.lines)} dòng với bản gốc`, { timeout: 7000 });
          params = [];
          draw();
        } catch (e) {
          if (say) say.textContent = '';
          toast(e.message, { type: 'error', timeout: 9000 });
        }
      }),
    );
    if (!book) return;
    $$('[data-bl-size]', root).forEach((b) =>
      b.addEventListener('click', () => {
        size = Math.min(26, Math.max(15, size + +b.dataset.blSize));
        store.set(SIZE_KEY, size);
        $('.bl-page', root).style.setProperty('--bl-size', `${size}px`);
        $('[data-bl-size-v]', root).textContent = size;
      }),
    );
    $('[data-bl-remove]', root)?.addEventListener('click', async () => {
      if (!(await ctx.confirm('Gỡ sách Bình luận khỏi máy này? Muốn đọc lại phải nạp lại tệp sách.', { title: 'Gỡ sách Bình luận', okText: 'Gỡ sách', danger: true }))) return;
      await removeBook();
      toast('Đã gỡ sách Bình luận khỏi máy này');
      draw();
    });
    const qInput = $('[data-bl-q]', root);
    const runSearch = debounce(() => {
      const q = qInput.value.trim();
      lastQuery = q;
      if (!q) return draw();
      const num = /^(?:điều|dieu|đ\.?)?\s*(\d{1,3}[a-zđ]?)$/i.exec(q);
      if (num) {
        const a = book.articles.find((x) => x.so === num[1].toLowerCase());
        if (a) return ctx.navigate(`#binh-luan/${encodeURIComponent(a.so)}`);
        return warnMissing(`Sách không có Điều ${num[1]}`);
      }
      if (q.length < 2) return;
      showResults(q);
    }, 350);
    qInput.addEventListener('input', runSearch);
    qInput.addEventListener('keydown', (e) => e.key === 'Enter' && runSearch());
    // Lọc mục lục.
    const filter = $('[data-bl-filter]', root);
    filter.addEventListener('input', () => {
      const f = filter.value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .trim();
      $$('.bl-toc li', root).forEach((li) => {
        const t = li.textContent
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/đ/gi, 'd')
          .toLowerCase();
        li.hidden = !!f && !t.includes(f);
      });
      $$('.bl-toc details', root).forEach((d) => (d.open = !!f || d.contains($('[aria-current]', d))));
      if (!f) $$('.bl-toc-p', root).forEach((d) => (d.open = d.contains($('[aria-current]', d)) || !$('[aria-current]', root)));
    });
    // Giữ vị trí cuộn mục lục, đưa điều đang đọc vào tầm nhìn.
    const toc = $('.bl-toc', root);
    toc.addEventListener('scroll', () => (tocScroll = toc.scrollTop), { passive: true });
    toc.scrollTop = tocScroll;
    const curLink = $('.bl-toc [aria-current]', root);
    if (curLink) {
      const r = curLink.getBoundingClientRect();
      const tr = toc.getBoundingClientRect();
      if (r.top < tr.top || r.bottom > tr.bottom) curLink.scrollIntoView({ block: 'center' });
    }
    if (params[0]) $('.bl-main', root)?.scrollIntoView?.({ block: 'start' });
  }

  // Liên kết sang một điều (mục lục, kết quả tìm, điều trước / sau): luôn mở lại, kể cả khi trùng điều đang xem.
  root.addEventListener('click', (e) => {
    const l = e.target.closest('a[href^="#binh-luan/"]');
    if (!l || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    ctx.navigate(l.getAttribute('href'));
  });
  // Chú thích: cuộn tới nội dung chú thích trong cùng trang.
  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-fn]');
    if (!a) return;
    e.preventDefault();
    $(`#${CSS.escape(a.getAttribute('href').slice(1))}`, root)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  if (!book) {
    root.innerHTML = '<div class="page"><p class="hint">Đang mở sách…</p></div>';
    loadBook().then(draw);
  } else draw();
}
