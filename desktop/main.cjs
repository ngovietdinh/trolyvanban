// Bản cài đặt máy tính (Windows/macOS) của Trợ Lý Văn Bản AI.
// Nạp nguyên mã web trong thư mục web/ qua giao thức riêng app://trolyvanban — một origin cố định, bảo mật
// (crypto.subtle, Worker, localStorage hoạt động như trên HTTPS) và dữ liệu lưu bền trong thư mục người dùng.
const { app, BrowserWindow, protocol, shell, Menu, dialog, session, ipcMain, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');

const SCHEME = 'app';
const HOST = 'trolyvanban';
const ORIGIN = `${SCHEME}://${HOST}`;
const WEB = path.join(__dirname, 'web');
const { createUpdater, WATCHDOG_MS } = require('./updater.cjs');
const updater = createUpdater(WEB);

/* ---------------- Chế độ bảo mật ở tầng ứng dụng ----------------
 * Mã web báo chính sách (lib/security.js → tlvb:security-set); vỏ ứng dụng lưu vào security.json để áp dụng ngay
 * từ lần mở sau, trước khi trang kịp chạy. Bản cài "bảo mật" có security-forced.json { on: true }: luôn bật,
 * chỉ phục vụ mã web trong bộ cài (bỏ qua bản cập nhật tại chỗ), không tải cập nhật, không mở công cụ nhà phát triển.
 */
const FORCED = (() => {
  try {
    return JSON.parse(fsSync.readFileSync(path.join(__dirname, 'security-forced.json'), 'utf8')).on === true;
  } catch {
    return false;
  }
})();
let sec = { on: FORCED, hosts: [], strict: true };
let blocked = 0;
const secFile = () => path.join(app.getPath('userData'), 'security.json');
function loadSecurity() {
  try {
    sec = { ...sec, ...JSON.parse(fsSync.readFileSync(secFile(), 'utf8')) };
  } catch {}
  if (FORCED) sec.on = true;
}
function saveSecurity() {
  try {
    fsSync.writeFileSync(secFile(), JSON.stringify(sec));
  } catch {}
}
const cleanHost = (h) => String(h || '').replace(/^\[|\]$/g, '').toLowerCase();
const isLoopback = (h) => h === 'localhost' || h.endsWith('.localhost') || h === '::1' || /^127\.\d+\.\d+\.\d+$/.test(h);
function isPrivate(h) {
  if (isLoopback(h) || /\.(local|lan|internal|intranet|home\.arpa)$/.test(h)) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  return /^f[cd][0-9a-f]{2}:/.test(h) || /^fe[89ab][0-9a-f]:/.test(h);
}
const listed = (h, list) =>
  list.some((e) => {
    const x = cleanHost(e).replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
    if (x.startsWith('*.') || x.startsWith('.')) {
      const sfx = x.replace(/^\*/, '');
      return h.endsWith(sfx) || h === sfx.slice(1);
    }
    return !!x && h === x;
  });
/** Yêu cầu mạng có được phép không (chế độ bảo mật: chỉ máy này, máy chủ khai báo, tùy chọn cả mạng nội bộ). */
function allowedRequest(url) {
  if (!sec.on) return true;
  let h;
  try {
    h = cleanHost(new URL(url).hostname);
  } catch {
    return false;
  }
  return isLoopback(h) || listed(h, sec.hosts || []) || (!sec.strict && isPrivate(h));
}
const secStatus = () => ({ on: !!sec.on, forced: FORCED, blocked, hosts: sec.hosts || [], strict: sec.strict !== false });

function guardNetwork(ses) {
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (d, cb) => {
    if (allowedRequest(d.url)) return cb({});
    blocked++;
    cb({ cancel: true });
  });
}

/** Bản cài bảo mật: chỉ phục vụ mã web nằm trong bộ cài. */
function packagedFile(rel) {
  const f = path.normalize(path.join(WEB, rel));
  return f === WEB || f.startsWith(WEB + path.sep) ? f : null;
}

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
  // Bản cập nhật tại chỗ (nếu có) được ưu tiên, còn lại lấy từ bộ cài (bản cài bảo mật: chỉ lấy từ bộ cài).
  const file = FORCED ? packagedFile(rel) : updater.resolve(rel);
  if (!file) return new Response('Forbidden', { status: 403 });
  try {
    const body = await fs.readFile(file);
    return new Response(body, { headers: { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

const isExternal = (u) => /^(https?:|mailto:|tel:)/i.test(u) && !u.startsWith(ORIGIN);

let win = null;

/**
 * Bỏ chặn CORS cho các yêu cầu do chính trang ứng dụng gửi đi: máy chủ AI nội bộ (BionicGPT, LiteLLM, vLLM,
 * LocalAI, Open WebUI…) thường không gửi header CORS cho origin app://trolyvanban. Chỉ áp dụng cho yêu cầu
 * từ trang app:// (mã của chính ứng dụng), không ảnh hưởng trình duyệt hay ứng dụng khác.
 */
function allowCorsForApp(ses) {
  const fromApp = (d) => String(d.referrer || '').startsWith(ORIGIN) || String(d.frame?.url || '').startsWith(ORIGIN);
  const asked = new Map(); // id yêu cầu → header mà preflight xin phép
  const filter = { urls: ['http://*/*', 'https://*/*'] };
  ses.webRequest.onBeforeSendHeaders(filter, (d, cb) => {
    if (fromApp(d) && d.method === 'OPTIONS') {
      const h = Object.entries(d.requestHeaders).find(([k]) => k.toLowerCase() === 'access-control-request-headers');
      if (h) asked.set(d.id, h[1]);
    }
    cb({ requestHeaders: d.requestHeaders });
  });
  ses.webRequest.onHeadersReceived(filter, (d, cb) => {
    if (!fromApp(d)) return cb({});
    const headers = Object.fromEntries(Object.entries(d.responseHeaders || {}).filter(([k]) => !k.toLowerCase().startsWith('access-control-')));
    headers['Access-Control-Allow-Origin'] = [ORIGIN];
    headers['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS'];
    headers['Access-Control-Allow-Headers'] = [asked.get(d.id) || 'authorization, content-type'];
    headers['Access-Control-Max-Age'] = ['600'];
    asked.delete(d.id);
    // Máy chủ không hỗ trợ preflight (OPTIONS trả 404/405) → coi như cho phép.
    cb(d.method === 'OPTIONS' ? { responseHeaders: headers, statusLine: 'HTTP/1.1 204 No Content' } : { responseHeaders: headers });
  });
}

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
      // Cho phép gọi máy chủ AI trong mạng nội bộ qua http:// (vd: Ollama ở http://192.168.1.10:11434)
      // từ trang app:// (bảo mật). Trang chỉ nạp mã của chính ứng dụng, liên kết ngoài mở bằng trình duyệt.
      allowRunningInsecureContent: true,
    },
  });
  win.once('ready-to-show', () => win.show());

  // Liên kết ra ngoài (trang tải bộ cài, tài liệu nhà cung cấp AI…) mở bằng trình duyệt mặc định.
  // Chế độ bảo mật: không mở liên kết ra Internet.
  const openOut = (url) => {
    if (!isExternal(url)) return;
    if (sec.on && !/^(mailto|tel):/i.test(url) && !allowedRequest(url)) {
      dialog.showMessageBox(win, { type: 'info', message: 'Chế độ bảo mật: không mở liên kết ra Internet.', detail: url });
      return;
    }
    shell.openExternal(url);
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    openOut(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN)) {
      e.preventDefault();
      openOut(url);
    }
  });
  // Chế độ bảo mật: không cho mở công cụ nhà phát triển (xem được bộ nhớ, khóa đang mở).
  win.webContents.on('devtools-opened', () => {
    if (sec.on) win.webContents.closeDevTools();
  });

  // Bản vừa cập nhật phải báo “sẵn sàng” (mã web khởi động xong) — nếu không, quay về bản trước.
  win.webContents.on('did-finish-load', () => {
    if (!updater.isPending()) return;
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      if (updater.rollback()) {
        dialog.showMessageBox(win, { type: 'warning', message: 'Bản cập nhật không chạy được — đã quay về phiên bản trước.', detail: 'Dữ liệu không bị ảnh hưởng. Có thể tải bộ cài mới nhất ở menu Trợ giúp.' });
        win.reload();
      }
    }, WATCHDOG_MS);
  });

  win.loadURL(`${ORIGIN}/app.html`);
}

let watchdog = null;
function bindUpdater() {
  // Chế độ bảo mật: không liên lạc máy chủ phát hành trên Internet.
  ipcMain.handle('tlvb:update-check', () => (sec.on ? { available: false, disabled: true, latest: updater.activeVersion(), notes: [] } : updater.check()));
  ipcMain.handle('tlvb:update-apply', (e) => {
    if (sec.on) throw new Error('Chế độ bảo mật: không cập nhật qua Internet');
    return updater.apply((p) => !e.sender.isDestroyed() && e.sender.send('tlvb:update-progress', p));
  });
  ipcMain.handle('tlvb:security-status', () => secStatus());
  ipcMain.handle('tlvb:security-set', (e, p = {}) => {
    if (!String(e.senderFrame?.url || '').startsWith(ORIGIN)) return secStatus();
    sec = { on: FORCED || !!p.on, hosts: (Array.isArray(p.hosts) ? p.hosts : []).slice(0, 50).map(String), strict: p.strict !== false };
    saveSecurity();
    buildMenu();
    return secStatus();
  });
  ipcMain.handle('tlvb:version', () => ({ web: updater.activeVersion(), packaged: updater.packaged(), shell: app.getVersion() }));
  // Tải một tệp / trang (bản án, án lệ) từ mạng cho mã web — không vướng hạn chế tải chéo của trình duyệt; tuân theo
  // chế độ bảo mật như mọi yêu cầu khác (chỉ máy này, máy chủ khai báo). Trả base64 để mã web đọc như tệp người dùng chọn.
  ipcMain.handle('tlvb:fetch', async (e, url) => {
    if (!String(e.senderFrame?.url || '').startsWith(ORIGIN)) return { ok: false, error: 'Không được phép' };
    let u;
    try {
      u = new URL(String(url || ''));
    } catch {
      return { ok: false, error: 'Đường dẫn không hợp lệ' };
    }
    if (!/^https?:$/.test(u.protocol)) return { ok: false, error: 'Chỉ tải qua http:// hoặc https://' };
    if (!allowedRequest(u.href)) return { ok: false, error: 'Chế độ bảo mật: không tải từ Internet (chỉ máy này hoặc máy chủ đã khai báo)' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await net.fetch(u.href, { signal: ctrl.signal, redirect: 'follow' });
      const type = res.headers.get('content-type') || '';
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 25 * 1024 * 1024) return { ok: false, status: res.status, error: 'Tệp lớn hơn 25 MB' };
      const cd = res.headers.get('content-disposition') || '';
      const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
      let name = '';
      if (m) {
        try {
          name = decodeURIComponent(m[1] || m[2]).trim();
        } catch {
          name = (m[1] || m[2]).trim();
        }
      }
      if (!name) {
        const base = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
        const ext = { 'application/pdf': '.pdf', 'application/msword': '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx', 'text/plain': '.txt', 'text/html': '.html' }[type.split(';')[0].trim()] || '';
        name = /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base || 'tai-ve'}${ext || '.html'}`;
      }
      return { ok: res.ok, status: res.status, type, name, data: buf.toString('base64') };
    } catch (err) {
      return { ok: false, error: err?.name === 'AbortError' ? 'Quá thời gian chờ (45 giây)' : err?.message || String(err) };
    } finally {
      clearTimeout(timer);
    }
  });
  ipcMain.on('tlvb:ready', () => {
    clearTimeout(watchdog);
    updater.confirm().catch(() => {});
  });
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
        ...(sec.on ? [] : [{ role: 'toggleDevTools', label: 'Công cụ nhà phát triển' }]),
      ],
    },
    {
      label: 'Trợ giúp',
      submenu: [
        ...(sec.on ? [] : [{ label: 'Tải bản cài đặt mới nhất', click: () => shell.openExternal('https://github.com/ngovietdinh/trolyvanban/releases/latest') }]),
        { label: 'Mở thư mục dữ liệu', click: () => shell.openPath(app.getPath('userData')) },
        {
          label: 'Phiên bản',
          click: () => dialog.showMessageBox(win, { type: 'info', title: 'Trợ Lý Văn Bản AI', message: `Trợ Lý Văn Bản AI v${FORCED ? updater.packaged() : updater.activeVersion()}${FORCED ? ' — bản bảo mật' : ''}`, detail: `Bộ cài v${app.getVersion()}${!FORCED && updater.activeVersion() !== updater.packaged() ? ` · đã cập nhật tại chỗ lên v${updater.activeVersion()}` : ''}. Dữ liệu, tài khoản và API key chỉ lưu trên máy này.${sec.on ? ' Chế độ bảo mật: đang bật (chặn kết nối ra Internet, không tự cập nhật).' : ''}` }),
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
    loadSecurity();
    protocol.handle(SCHEME, serve);
    guardNetwork(session.defaultSession);
    allowCorsForApp(session.defaultSession);
    bindUpdater();
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
