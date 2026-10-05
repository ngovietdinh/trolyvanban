// Tương tác cho trang giới thiệu.
import { $, $$, icon, toast, bindThemeToggles, copyText, escapeHtml } from './ui.js';
import { DOC_TYPES } from './lib/doc-types.js';
import { moneyToWords } from './lib/number-words.js';
import { checkText, fixAll } from './lib/spellcheck.js';
import { store, uid } from './lib/store.js';

document.documentElement.classList.add('js');
bindThemeToggles();

/* ---------- Header ---------- */
const header = $('.site-header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

const menuBtn = $('[data-menu-toggle]');
const mobileNav = $('#mobile-nav');
menuBtn.addEventListener('click', () => {
  const open = mobileNav.hidden;
  mobileNav.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
});
$$('a', mobileNav).forEach((a) =>
  a.addEventListener('click', () => {
    mobileNav.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }),
);

// Đánh dấu mục đang xem trên thanh điều hướng.
const navLinks = $$('.main-nav a');
const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window) {
  const navObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${e.target.id}`));
      });
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  sections.forEach((s) => navObs.observe(s));
}

/* ---------- Mẫu văn bản ---------- */
$('[data-templates]').innerHTML = DOC_TYPES.map(
  (t) => `
  <a class="tpl reveal" href="app.html#compose/${t.id}">
    <span class="tpl-icon">${icon(t.icon)}</span>
    ${t.abbr ? `<span class="tpl-abbr">${t.abbr}</span>` : ''}
    <h3>${t.name}</h3>
    <p>${t.tagline}</p>
    <span class="tpl-go">Soạn ngay ${icon('arrow-right', 'ic-sm')}</span>
  </a>`,
).join('');

/* ---------- Reveal & counters ---------- */
function animateCount(el) {
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix || '';
  const start = performance.now();
  const dur = 1200;
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
if ('IntersectionObserver' in window) {
  const obs = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        $$('[data-count]', e.target).forEach(animateCount);
        if (e.target.matches('[data-count]')) animateCount(e.target);
        obs.unobserve(e.target);
      }),
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
  );
  $$('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    obs.observe(el);
  });
} else {
  $$('.reveal').forEach((el) => el.classList.add('in'));
  $$('[data-count]').forEach((el) => (el.textContent = el.dataset.count + (el.dataset.suffix || '')));
}

/* ---------- Gợi ý xoay vòng ---------- */
const rot = $('[data-rotate]');
if (rot) {
  const items = JSON.parse(rot.dataset.rotate);
  let i = 0;
  setInterval(() => {
    i = (i + 1) % items.length;
    rot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).onfinish = () => {
      rot.textContent = items[i];
      rot.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 260 });
    };
  }, 3200);
}

/* ---------- Tabs dùng thử ---------- */
const tabs = $$('.demo-panel [role="tab"]');
function selectTab(tab) {
  tabs.forEach((t) => {
    const sel = t === tab;
    t.setAttribute('aria-selected', String(sel));
    t.tabIndex = sel ? 0 : -1;
    $(`#${t.getAttribute('aria-controls')}`).hidden = !sel;
  });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next);
    next.focus();
  });
});

// Đọc số
const numInput = $('#demo-number-input');
const wordsEl = $('[data-demo-words]');
function updateWords() {
  const v = numInput.value.trim();
  if (!v) {
    wordsEl.textContent = 'Nhập một số tiền để xem kết quả.';
    wordsEl.classList.add('error');
    return;
  }
  try {
    wordsEl.textContent = moneyToWords(v);
    wordsEl.classList.remove('error');
  } catch {
    wordsEl.textContent = 'Số không hợp lệ — ví dụ: 1.250.000 hoặc 2500000';
    wordsEl.classList.add('error');
  }
}
numInput.addEventListener('input', updateWords);
updateWords();
$('[data-copy-words]').addEventListener('click', async () => {
  await copyText(wordsEl.textContent);
  toast('Đã sao chép số tiền bằng chữ');
});

// Chính tả
const spellInput = $('#demo-spell-input');
const markedEl = $('[data-spell-marked]');
const countEl = $('[data-spell-count]');
function updateSpell() {
  const text = spellInput.value;
  const issues = checkText(text);
  let html = '';
  let pos = 0;
  for (const it of issues) {
    html += escapeHtml(text.slice(pos, it.start));
    html += `<mark class="err-mark t-${it.type}" title="${escapeHtml(it.message)}">${escapeHtml(text.slice(it.start, it.end)).replace(/ /g, '&nbsp;') || '&nbsp;'}</mark>`;
    pos = it.end;
  }
  html += escapeHtml(text.slice(pos));
  markedEl.innerHTML = html || '<span class="muted">Chưa có nội dung.</span>';
  countEl.textContent = issues.length ? `Phát hiện ${issues.length} lỗi` : 'Không phát hiện lỗi ✓';
}
spellInput.addEventListener('input', updateSpell);
updateSpell();
$('[data-spell-fix]').addEventListener('click', () => {
  spellInput.value = fixAll(spellInput.value);
  updateSpell();
  toast('Đã sửa tất cả lỗi có thể sửa tự động');
});

/* ---------- Bảng giá ---------- */
$$('[data-billing]').forEach((btn) =>
  btn.addEventListener('click', () => {
    const mode = btn.dataset.billing;
    $$('[data-billing]').forEach((b) => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-pressed', String(b === btn));
    });
    $$('[data-price-month]').forEach((el) => {
      el.textContent = mode === 'year' ? el.dataset.priceYear : el.dataset.priceMonth;
      el.nextElementSibling.textContent = mode === 'year' ? '/ tháng, thanh toán năm' : '/ tháng';
    });
  }),
);

/* ---------- Form liên hệ ---------- */
const form = $('[data-contact-form]');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const checks = {
    name: !!data.name.trim(),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim()),
    message: !!data.message.trim(),
  };
  let firstInvalid = null;
  for (const [k, ok] of Object.entries(checks)) {
    const fieldEl = form.elements[k].closest('.field');
    fieldEl.classList.toggle('invalid', !ok);
    form.elements[k].setAttribute('aria-invalid', String(!ok));
    if (!ok && !firstInvalid) firstInvalid = form.elements[k];
  }
  if (firstInvalid) {
    firstInvalid.focus();
    return;
  }
  store.update('contacts', (list) => [...list, { id: uid(), ...data, at: Date.now() }], []);
  form.reset();
  toast('Cảm ơn bạn! Chúng tôi sẽ liên hệ trong 24 giờ làm việc.');
});
$$('input, textarea', form).forEach((el) => el.addEventListener('input', () => el.closest('.field').classList.remove('invalid')));

$('[data-year]').textContent = new Date().getFullYear();
