// Cập nhật phần mềm: đăng ký service worker (dùng ngoại tuyến) và thông báo khi có phiên bản mới.
import { APP_VERSION } from './version.js';
import { icon, escapeHtml } from './ui.js';

let registration = null;

const cmp = (a, b) => {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};

function banner(version, notes = []) {
  if (document.querySelector('.update-banner')) return;
  const el = document.createElement('div');
  el.className = 'update-banner';
  el.setAttribute('role', 'status');
  el.innerHTML = `${icon('refresh', 'ic-sm')}<span><strong>Đã có phiên bản mới${version ? ` v${escapeHtml(version)}` : ''}.</strong> ${notes.length ? escapeHtml(notes[0]) : 'Dữ liệu và tài khoản được giữ nguyên.'}</span><button class="btn btn-sm btn-primary" type="button" data-do-update>Cập nhật ngay</button><button class="btn btn-sm btn-ghost btn-icon" type="button" aria-label="Để sau" data-dismiss>${icon('x', 'ic-sm')}</button>`;
  document.body.append(el);
  el.querySelector('[data-do-update]').addEventListener('click', applyUpdate);
  el.querySelector('[data-dismiss]').addEventListener('click', () => el.remove());
}

/** Kiểm tra version.json trên máy chủ. Trả về { available, latest, notes }. */
export async function checkForUpdate() {
  let info;
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error();
    info = await res.json();
  } catch {
    throw new Error('Không kiểm tra được bản cập nhật (đang ngoại tuyến hoặc máy chủ không phản hồi).');
  }
  const available = cmp(info.version, APP_VERSION) > 0;
  if (available) registration?.update().catch(() => {});
  return { available, latest: info.version, notes: info.notes || [] };
}

/** Áp dụng bản mới: kích hoạt service worker đang chờ rồi tải lại trang (dữ liệu localStorage giữ nguyên). */
export async function applyUpdate() {
  const reg = registration || (await navigator.serviceWorker?.getRegistration());
  if (reg?.waiting) {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    reg.waiting.postMessage('skipWaiting');
    setTimeout(() => location.reload(), 3000);
    return;
  }
  // Không có service worker chờ: xóa bộ nhớ đệm cũ rồi tải lại để lấy mã mới.
  if (window.caches) for (const k of await caches.keys()) if (k.startsWith('tlvb-')) await caches.delete(k);
  await reg?.update().catch(() => {});
  location.reload();
}

export function initUpdates() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker
    .register('sw.js')
    .then((reg) => {
      registration = reg;
      const watch = (w) =>
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) checkForUpdate().then((r) => banner(r.latest, r.notes)).catch(() => banner());
        });
      if (reg.waiting && navigator.serviceWorker.controller) checkForUpdate().then((r) => banner(r.latest, r.notes)).catch(() => banner());
      reg.addEventListener('updatefound', () => watch(reg.installing));
      // Kiểm tra định kỳ mỗi 30 phút khi đang mở ứng dụng.
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    })
    .catch(() => {});
  checkForUpdate()
    .then((r) => r.available && banner(r.latest, r.notes))
    .catch(() => {});
}
