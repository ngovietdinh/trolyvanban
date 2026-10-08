// Tải ứng dụng máy tính ngay trong phần mềm: nhận biết hệ điều hành (Windows / macOS chip Apple / macOS Intel),
// lấy bản phát hành mới nhất trên GitHub và tải thẳng bộ cài phù hợp.
import { icon, escapeHtml } from './ui.js';

const REPO = 'ngovietdinh/trolyvanban';
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;

/** 'win' | 'mac' | 'linux' | 'mobile' | 'other'. */
export function detectOs() {
  const ua = navigator.userAgent || '';
  const p = navigator.userAgentData?.platform || navigator.platform || '';
  if (/Android|iPhone|iPad|iPod/i.test(ua) || (/Mac/.test(p) && navigator.maxTouchPoints > 1)) return 'mobile';
  if (/Win/i.test(p) || /Windows/i.test(ua)) return 'win';
  if (/Mac/i.test(p) || /Mac OS X/i.test(ua)) return 'mac';
  if (/Linux/i.test(p)) return 'linux';
  return 'other';
}

/** Mac chip Apple ('arm') hay Intel ('x64'); null nếu không xác định được. */
export async function detectMacArch() {
  try {
    const v = await navigator.userAgentData?.getHighEntropyValues?.(['architecture']);
    if (v?.architecture) return /arm/i.test(v.architecture) ? 'arm' : 'x64';
  } catch {}
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    if (/Apple M\d|Apple GPU/i.test(r)) return 'arm';
    if (/Intel|AMD|Radeon/i.test(r)) return 'x64';
  } catch {}
  return null;
}

/** Bộ cài của bản phát hành mới nhất: { version, url, assets: { win, macArm, macIntel } }. */
export async function latestInstallers() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const j = await res.json();
  const pick = (re) => {
    const a = (j.assets || []).find((x) => re.test(x.name));
    return a ? { name: a.name, url: a.browser_download_url, size: a.size } : null;
  };
  return { version: String(j.tag_name || '').replace(/^v/, ''), url: j.html_url || RELEASES_URL, assets: { win: pick(/win-x64\.exe$/), macArm: pick(/mac-arm64\.dmg$/), macIntel: pick(/mac-x64\.dmg$/) } };
}

const mb = (n) => `${Math.round(n / 1048576)} MB`;

export function openDownloadApp(ctx, { reason = '' } = {}) {
  const os = detectOs();
  ctx.modal(
    `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
    <h2 class="modal-title">${reason ? 'Cài bộ cài mới (một lần)' : 'Tải ứng dụng máy tính'}</h2>
    ${reason ? `<p class="note">${icon('info', 'ic-sm')}<span>${escapeHtml(reason)}</span></p>` : ''}
    <p class="hint">Cài lên Windows hoặc macOS: chạy như phần mềm riêng, dùng được khi mất mạng, tự cập nhật (chỉ tải phần thay đổi), tài khoản tạo mới có toàn quyền. Dữ liệu bản web và bản cài đặt tách riêng — chuyển bằng Xuất sao lưu / Khôi phục.</p>
    <div class="dl-body" data-dl-body><p class="hint">${icon('refresh', 'ic-sm spin')}Đang lấy bản mới nhất…</p></div>`,
    {
      className: 'dl-modal',
      label: 'Tải ứng dụng máy tính',
      async onMount(box) {
        const body = box.querySelector('[data-dl-body]');
        const arch = os === 'mac' ? await detectMacArch() : null;
        let rel = null;
        try {
          rel = await latestInstallers();
        } catch {}
        const rec = os === 'win' ? 'win' : os === 'mac' ? (arch === 'x64' ? 'macIntel' : arch === 'arm' ? 'macArm' : null) : null;
        const card = (key, title, sub, ic) => {
          const a = rel?.assets[key];
          const href = a?.url || RELEASES_URL;
          return `<a class="dl-card ${rec === key ? 'rec' : ''}" href="${escapeHtml(href)}" ${a ? 'download' : 'target="_blank" rel="noopener"'} data-dl="${key}">
            ${icon(ic)}<span><strong>${title}</strong><small>${sub}${a ? ` · ${mb(a.size)}` : ''}</small></span>
            ${rec === key ? '<em class="badge badge-success">Phù hợp máy này</em>' : ''}${icon('download', 'ic-sm')}</a>`;
        };
        body.innerHTML = `
          ${os === 'mobile' ? `<p class="note">${icon('info', 'ic-sm')}<span>Điện thoại, máy tính bảng: dùng bản web; trên trình duyệt chọn “Thêm vào màn hình chính” để mở như ứng dụng.</span></p>` : ''}
          ${os === 'mac' && !arch ? `<p class="note">${icon('info', 'ic-sm')}<span>Chưa xác định được chip của máy Mac. Xem tại  → Giới thiệu về máy Mac này: “Chip Apple M…” chọn bản chip Apple, “Bộ xử lý Intel” chọn bản Intel.</span></p>` : ''}
          <div class="dl-cards">
            ${card('win', 'Windows', 'Windows 10, 11 (64-bit) · .exe', 'panel')}
            ${card('macArm', 'macOS — chip Apple', 'M1, M2, M3, M4… · .dmg', 'command')}
            ${card('macIntel', 'macOS — chip Intel', 'macOS 13 trở lên · .dmg', 'command')}
          </div>
          <p class="hint">${rel ? `Phiên bản <strong>v${escapeHtml(rel.version)}</strong>.` : 'Không lấy được thông tin bản phát hành — nút tải sẽ mở trang phát hành trên GitHub.'} <a class="link" href="${RELEASES_URL}" target="_blank" rel="noopener">Xem tất cả bản phát hành</a></p>
          <details class="dl-help" ${os === 'mac' || os === 'win' ? 'open' : ''}><summary>Hướng dẫn cài đặt</summary>
            <ul>
              <li><strong>Windows:</strong> chạy tệp .exe. Nếu SmartScreen cảnh báo, chọn <em>Thông tin thêm → Vẫn chạy</em>.</li>
              <li><strong>macOS:</strong> mở tệp .dmg, kéo ứng dụng vào Applications. Lần đầu mở bị chặn: mở Terminal, chạy <code>sudo xattr -cr "/Applications/Tro Ly Van Ban AI.app"</code> rồi mở lại (hoặc Cài đặt hệ thống → Quyền riêng tư &amp; Bảo mật → Vẫn mở).</li>
              <li>Đã cài rồi: ứng dụng tự báo bản mới — bấm <em>Cập nhật ngay</em>, không cần tải lại.</li>
            </ul>
          </details>`;
      },
    },
  );
}
