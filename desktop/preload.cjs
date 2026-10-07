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
