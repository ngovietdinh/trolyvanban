// Cho mã web biết đang chạy trong bản cài đặt máy tính (xem assets/js/lib/platform.js).
const { contextBridge, ipcRenderer } = require('electron');

const OS = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };

contextBridge.exposeInMainWorld(
  'tlvbDesktop',
  Object.freeze({
    platform: process.platform,
    os: OS[process.platform] || process.platform,
    /** Mã web khởi động xong (xác nhận bản cập nhật tại chỗ chạy được). */
    ready: () => ipcRenderer.send('tlvb:ready'),
    version: () => ipcRenderer.invoke('tlvb:version'),
    /** Chế độ bảo mật: vỏ ứng dụng chặn mọi yêu cầu mạng ra ngoài (xem desktop/main.cjs). */
    security: Object.freeze({
      set: (p) => ipcRenderer.invoke('tlvb:security-set', p),
      status: () => ipcRenderer.invoke('tlvb:security-status'),
    }),
    /** Tải tệp / trang từ mạng qua vỏ ứng dụng (bản án, án lệ) — xem desktop/main.cjs 'tlvb:fetch'. */
    net: Object.freeze({ fetch: (url) => ipcRenderer.invoke('tlvb:fetch', String(url)) }),
    /** Nhận dạng chữ tại chỗ (PaddleOCR + VietOCR) — xem desktop/ocr/engine.cjs. page(png: ArrayBuffer) → { width, height, lines }. */
    ocr: Object.freeze({
      status: () => ipcRenderer.invoke('tlvb:ocr-status'),
      page: (png, { onProgress, withText = true } = {}) => {
        const h = (_, p) => onProgress?.(p);
        if (onProgress) ipcRenderer.on('tlvb:ocr-progress', h);
        return ipcRenderer.invoke('tlvb:ocr-page', png instanceof ArrayBuffer ? new Uint8Array(png) : png, { withText }).finally(() => ipcRenderer.removeListener('tlvb:ocr-progress', h));
      },
      download: (onProgress) => {
        const h = (_, p) => onProgress?.(p);
        if (onProgress) ipcRenderer.on('tlvb:ocr-progress', h);
        return ipcRenderer.invoke('tlvb:ocr-download').finally(() => ipcRenderer.removeListener('tlvb:ocr-progress', h));
      },
      remove: () => ipcRenderer.invoke('tlvb:ocr-remove'),
    }),
    /** Cập nhật tại chỗ: chỉ tải các tệp mã web thay đổi. */
    update: Object.freeze({
      check: () => ipcRenderer.invoke('tlvb:update-check'),
      apply: () => ipcRenderer.invoke('tlvb:update-apply'),
      onProgress(cb) {
        const h = (_e, p) => cb(p);
        ipcRenderer.on('tlvb:update-progress', h);
        return () => ipcRenderer.removeListener('tlvb:update-progress', h);
      },
    }),
  }),
);
