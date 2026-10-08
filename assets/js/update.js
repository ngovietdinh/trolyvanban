// Cập nhật phần mềm: đăng ký service worker (dùng ngoại tuyến) và thông báo khi có phiên bản mới.
import { APP_VERSION } from './version.js';
import { icon, escapeHtml, toast } from './ui.js';
import { isDesktop, desktop } from './lib/platform.js';

// Bản cài đặt trên máy: cập nhật tại chỗ (chỉ tải tệp mã web thay đổi) qua vỏ ứng dụng; vỏ cũ hoặc bản mới cần vỏ
// mới thì mở trang tải bộ cài. Vỏ cũ (trước v2.16) không có desktop.update → so với version.json trên main.
const DESKTOP_VERSION_URL = 'https://raw.githubusercontent.com/ngovietdinh/trolyvanban/main/version.json';
export const DESKTOP_DOWNLOAD_URL = 'https://github.com/ngovietdinh/trolyvanban/releases/latest';

let registration = null;

const cmp = (a, b) => {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};

// Ghi nhớ trên máy (không theo tài khoản): bản người dùng chọn “Để sau”, bản vừa bấm cập nhật.
const LS = { dismissed: 'tlvb:update-dismissed', attempt: 'tlvb:update-attempt' };
const lsGet = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null');
  } catch {
    return null;
  }
};
const lsSet = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const DISMISS_MS = 12 * 60 * 60 * 1000; // “Để sau”: không nhắc lại bản đó trong 12 giờ
const inPlace = () => !!desktop?.update;
let needInstaller = false;

/**
 * Bản cài đặt phải cài lại bộ cài (vỏ ứng dụng cũ chưa có cập nhật tại chỗ, hoặc bản mới cần vỏ mới): mở hộp thoại
 * tải đúng bộ cài theo máy (Windows / Mac chip Apple / Mac Intel) — app.js xử lý sự kiện; không có thì mở trang tải.
 */
function openInstaller(reason) {
  const go = window.dispatchEvent(new CustomEvent('tlvb:need-installer', { detail: { reason }, cancelable: true }));
  if (go) window.open(DESKTOP_DOWNLOAD_URL, '_blank');
}
const INSTALLER_REASON = () => (inPlace() ? 'Bản mới thay đổi phần lõi của ứng dụng nên cần cài bộ cài mới một lần (cài đè, dữ liệu giữ nguyên). Sau đó các bản tiếp theo lại cập nhật tại chỗ.' : 'Bộ cài trên máy là bản cũ (trước v2.16) chưa có chức năng cập nhật tại chỗ. Cài bộ cài mới một lần (cài đè, dữ liệu giữ nguyên) — từ đó về sau bấm “Cập nhật ngay” là xong, không cần tải lại.');

function banner(version, notes = []) {
  if (document.querySelector('.update-banner')) return;
  const d = lsGet(LS.dismissed);
  if (d && d.version === (version || '') && Date.now() - d.at < DISMISS_MS) return;
  const el = document.createElement('div');
  el.className = 'update-banner';
  el.setAttribute('role', 'status');
  el.innerHTML = `${icon('refresh', 'ic-sm')}<span><strong>Đã có phiên bản mới${version ? ` v${escapeHtml(version)}` : ''}.</strong> ${notes.length ? escapeHtml(notes[0]) : 'Dữ liệu và tài khoản được giữ nguyên.'}</span><button class="btn btn-sm btn-primary" type="button" data-do-update>${isDesktop && (!inPlace() || needInstaller) ? 'Tải bộ cài mới' : 'Cập nhật ngay'}</button><button class="btn btn-sm btn-ghost btn-icon" type="button" aria-label="Để sau" data-dismiss>${icon('x', 'ic-sm')}</button>`;
  document.body.append(el);
  el.querySelector('[data-do-update]').addEventListener('click', applyUpdate);
  el.querySelector('[data-dismiss]').addEventListener('click', () => {
    lsSet(LS.dismissed, { version: version || '', at: Date.now() });
    el.remove();
  });
}

/** Kiểm tra version.json trên máy chủ. Trả về { available, latest, notes }. */
export async function checkForUpdate() {
  if (inPlace()) {
    try {
      const r = await desktop.update.check();
      needInstaller = !!r.needInstaller;
      return { available: r.available, latest: r.latest, notes: r.notes || [], needInstaller };
    } catch {
      throw new Error('Không kiểm tra được bản cập nhật (đang ngoại tuyến hoặc máy chủ không phản hồi).');
    }
  }
  let info;
  try {
    const res = await fetch(`${isDesktop ? DESKTOP_VERSION_URL : 'version.json'}?t=${Date.now()}`, { cache: 'no-store' });
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
  if (isDesktop) {
    if (!inPlace() || needInstaller) return openInstaller(INSTALLER_REASON());
    return applyInPlace();
  }
  const latest = await checkForUpdate().then((r) => r.latest).catch(() => null);
  const prev = lsGet(LS.attempt);
  lsSet(LS.attempt, { version: latest, at: Date.now(), n: prev?.version === latest ? (prev.n || 0) + 1 : 1 });
  const reg = registration || (await navigator.serviceWorker?.getRegistration());
  // Đã thử cập nhật mà vẫn chạy bản cũ → làm sạch hoàn toàn bộ nhớ đệm rồi tải lại.
  if (prev?.version && prev.version === latest) return hardRefresh(reg);
  if (reg?.waiting) {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    reg.waiting.postMessage('skipWaiting');
    setTimeout(() => location.reload(), 3000);
    return;
  }
  // Không có service worker chờ: xóa bộ nhớ đệm cũ rồi tải lại để lấy mã mới.
  await reg?.update().catch(() => {});
  return hardRefresh(reg);
}

/**
 * Làm sạch bộ nhớ đệm của ứng dụng rồi tải lại (dữ liệu, tài khoản trong localStorage giữ nguyên).
 * Service worker mới tải lại mọi tệp từ máy chủ (bỏ qua bộ nhớ đệm HTTP) nên chắc chắn lên bản mới.
 */
async function hardRefresh(reg) {
  try {
    reg?.waiting?.postMessage('skipWaiting');
    if (window.caches) for (const k of await caches.keys()) if (k.startsWith('tlvb-')) await caches.delete(k);
    // Làm mới bộ nhớ đệm HTTP cho các tệp quyết định phiên bản.
    await Promise.all(['assets/js/version.js', 'assets/js/app.js', 'assets/js/update.js', 'app.html', 'index.html'].map((u) => fetch(u, { cache: 'reload' }).catch(() => {})));
  } catch {}
  location.reload();
}

/** Bản cài đặt: tải phần thay đổi rồi tải lại trang (dữ liệu giữ nguyên). */
let applying = false;
async function applyInPlace() {
  if (applying) return;
  applying = true;
  const btns = [...document.querySelectorAll('[data-do-update], [data-apply-update]')];
  const say = (t) => btns.forEach((b) => ((b.disabled = true), (b.textContent = t)));
  say('Đang tải…');
  const off = desktop.update.onProgress(({ done, total }) => say(total ? `Đang tải ${done}/${total} tệp…` : 'Đang kiểm tra…'));
  try {
    const r = await desktop.update.apply();
    if (r.needInstaller) {
      needInstaller = true;
      return openInstaller(INSTALLER_REASON());
    }
    if (r.upToDate) {
      toast('Bạn đang dùng phiên bản mới nhất.');
      document.querySelector('.update-banner')?.remove();
      return;
    }
    say('Đang khởi động lại…');
    toast(`Đã cập nhật lên v${r.version} (${r.changed} tệp, ${(r.bytes / 1048576).toFixed(1)} MB) — khởi động lại…`, { timeout: 4000 });
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    toast(`${err.message || 'Cập nhật lỗi'} — bấm “Cập nhật ngay” để thử lại; vẫn lỗi thì kiểm tra mạng (mạng cơ quan có thể chặn github.com, raw.githubusercontent.com, cdn.jsdelivr.net).`, { type: 'error', timeout: 10000 });
    btns.forEach((b) => ((b.disabled = false), (b.textContent = 'Cập nhật ngay')));
  } finally {
    off();
    applying = false;
  }
}

/** Có service worker mới đang chờ: chỉ báo khi máy chủ thật sự có bản mới hơn; ngược lại kích hoạt ngầm. */
function notifyIfNewer(reg) {
  checkForUpdate()
    .then((r) => (r.available ? banner(r.latest, r.notes) : reg.waiting?.postMessage('skipWaiting')))
    .catch(() => {});
}

export function initUpdates() {
  if (inPlace()) {
    // Bản cài đặt: kiểm tra bản mới khi mở và mỗi 6 giờ (app.js báo “sẵn sàng” cho vỏ ứng dụng sau khi khởi động).
    const run = () => checkForUpdate().then((r) => r.available && banner(r.latest, r.notes)).catch(() => {});
    setTimeout(run, 4000);
    setInterval(run, 6 * 60 * 60 * 1000);
    return;
  }
  // Đã lên đúng bản mới → xóa dấu “đang cập nhật”.
  const att = lsGet(LS.attempt);
  if (att?.version && cmp(APP_VERSION, att.version) >= 0) lsSet(LS.attempt, null);
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker
    .register('sw.js')
    .then((reg) => {
      registration = reg;
      const watch = (w) =>
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) notifyIfNewer(reg);
        });
      if (reg.waiting && navigator.serviceWorker.controller) notifyIfNewer(reg);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      // Kiểm tra định kỳ mỗi 30 phút khi đang mở ứng dụng.
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    })
    .catch(() => {});
  checkForUpdate()
    .then((r) => r.available && banner(r.latest, r.notes))
    .catch(() => {});
}
