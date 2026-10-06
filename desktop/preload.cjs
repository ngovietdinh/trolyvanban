// Cho mã web biết đang chạy trong bản cài đặt máy tính (xem assets/js/lib/platform.js).
const { contextBridge } = require('electron');

const OS = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };

contextBridge.exposeInMainWorld('tlvbDesktop', Object.freeze({ platform: process.platform, os: OS[process.platform] || process.platform }));
