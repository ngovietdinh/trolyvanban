// Tiện ích giao diện dùng chung: icon, toast, giao diện sáng/tối, sao chép, tải tệp.
import { store } from './lib/store.js';
import { escapeHtml } from './lib/render-html.js';

export const ICONS = 'assets/icons.svg';
export const icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="${ICONS}#i-${name}"/></svg>`;
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export { escapeHtml };

export function toast(message, { type = 'success', timeout = 2800 } = {}) {
  let host = $('.toasts');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toasts';
    host.setAttribute('aria-live', 'polite');
    document.body.append(host);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check-circle')}<span>${escapeHtml(message)}</span>`;
  host.append(el);
  setTimeout(() => {
    el.classList.add('leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, timeout);
  return el;
}

/* ---------- Giao diện sáng / tối ---------- */
export function currentTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function setTheme(theme) {
  if (theme === 'system') {
    delete document.documentElement.dataset.theme;
    store.remove('theme');
  } else {
    document.documentElement.dataset.theme = theme;
    store.set('theme', theme);
  }
  document.dispatchEvent(new CustomEvent('themechange', { detail: currentTheme() }));
}
export function bindThemeToggles(root = document) {
  $$('[data-theme-toggle]', root).forEach((btn) =>
    btn.addEventListener('click', () => {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    }),
  );
}

/* ---------- Clipboard & download ---------- */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      ta.remove();
    }
  }
}

export function downloadBlob(data, filename, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Markdown tối giản và an toàn (escape trước, rồi mới định dạng). */
export function renderMarkdown(md) {
  const lines = escapeHtml(md).split('\n');
  const out = [];
  let list = null;
  const inline = (s) =>
    s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if ((m = line.match(/^\s*[-•]\s+(.*)$/))) {
      if (list !== 'ul') {
        closeList();
        out.push('<ul>');
        list = 'ul';
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*(\d+)[.)]\s+(.*)$/))) {
      if (list !== 'ol') {
        closeList();
        out.push('<ol>');
        list = 'ol';
      }
      out.push(`<li>${inline(m[2])}</li>`);
    } else if ((m = line.match(/^&gt;\s?(.*)$/))) {
      closeList();
      out.push(`<blockquote>${inline(m[1])}</blockquote>`);
    } else if ((m = line.match(/^#{1,4}\s+(.*)$/))) {
      closeList();
      out.push(`<h4>${inline(m[1])}</h4>`);
    } else if (!line.trim()) {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('');
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
