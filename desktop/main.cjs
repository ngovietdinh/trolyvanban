// Bản cài đặt máy tính (Windows/macOS) của Trợ Lý Văn Bản AI.
// Nạp nguyên mã web trong thư mục web/ qua giao thức riêng app://trolyvanban — một origin cố định, bảo mật
// (crypto.subtle, Worker, localStorage hoạt động như trên HTTPS) và dữ liệu lưu bền trong thư mục người dùng.
const { app, BrowserWindow, protocol, shell, Menu, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const SCHEME = 'app';
const HOST = 'trolyvanban';
const ORIGIN = `${SCHEME}://${HOST}`;
const WEB = path.join(__dirname, 'web');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.txt': 'text/plain; charset=utf-8',
};

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
]);

// Tên sản phẩm có dấu tiếng Việt lọt vào User-Agent làm protocol.handle lỗi (header chỉ nhận ASCII).
app.userAgentFallback = app.userAgentFallback.replace(app.name, 'TroLyVanBan').replace(/[^\x20-\x7e]/g, '');

async function serve(request) {
  const url = new URL(request.url);
  if (url.host !== HOST) return new Response('Not found', { status: 404 });
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/app.html';
  const file = path.normalize(path.join(WEB, rel));
  if (file !== WEB && !file.startsWith(WEB + path.sep)) return new Response('Forbidden', { status: 403 });
  try {
    const body = await fs.readFile(file);
    return new Response(body, { headers: { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

const isExternal = (u) => /^(https?:|mailto:|tel:)/i.test(u) && !u.startsWith(ORIGIN);

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 380,
    minHeight: 560,
    title: 'Trợ Lý Văn Bản AI',
    backgroundColor: '#f7f4ee',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());

  // Liên kết ra ngoài (trang tải bộ cài, tài liệu nhà cung cấp AI…) mở bằng trình duyệt mặc định.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN)) {
      e.preventDefault();
      if (isExternal(url)) shell.openExternal(url);
    }
  });

  win.loadURL(`${ORIGIN}/app.html`);
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const template = [
    ...(mac ? [{ label: app.name, submenu: [{ role: 'about', label: 'Giới thiệu' }, { type: 'separator' }, { role: 'hide', label: 'Ẩn' }, { role: 'hideOthers', label: 'Ẩn ứng dụng khác' }, { type: 'separator' }, { role: 'quit', label: 'Thoát' }] }] : []),
    { label: 'Tệp', submenu: [mac ? { role: 'close', label: 'Đóng cửa sổ' } : { role: 'quit', label: 'Thoát' }] },
    {
      label: 'Sửa',
      submenu: [
        { role: 'undo', label: 'Hoàn tác' },
        { role: 'redo', label: 'Làm lại' },
        { type: 'separator' },
        { role: 'cut', label: 'Cắt' },
        { role: 'copy', label: 'Sao chép' },
        { role: 'paste', label: 'Dán' },
        { role: 'selectAll', label: 'Chọn tất cả' },
      ],
    },
    {
      label: 'Xem',
      submenu: [
        { role: 'reload', label: 'Tải lại' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Cỡ chữ mặc định' },
        { role: 'zoomIn', label: 'Phóng to' },
        { role: 'zoomOut', label: 'Thu nhỏ' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toàn màn hình' },
        { role: 'toggleDevTools', label: 'Công cụ nhà phát triển' },
      ],
    },
    {
      label: 'Trợ giúp',
      submenu: [
        { label: 'Tải bản cài đặt mới nhất', click: () => shell.openExternal('https://github.com/ngovietdinh/trolyvanban/releases/latest') },
        { label: 'Mở thư mục dữ liệu', click: () => shell.openPath(app.getPath('userData')) },
        {
          label: 'Phiên bản',
          click: () => dialog.showMessageBox(win, { type: 'info', title: 'Trợ Lý Văn Bản AI', message: `Trợ Lý Văn Bản AI v${app.getVersion()}`, detail: 'Dữ liệu, tài khoản và API key chỉ lưu trên máy này.' }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    protocol.handle(SCHEME, serve);
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
