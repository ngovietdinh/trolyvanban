// Service worker: cho phép dùng ngoại tuyến và cập nhật phiên bản mới.
// Khi phát hành bản mới, VERSION thay đổi → trình duyệt cài service worker mới → ứng dụng báo "Có bản cập nhật".
// Dữ liệu người dùng nằm trong localStorage, không bị ảnh hưởng khi cập nhật.
const VERSION = '2.20.0';
const CACHE = `tlvb-${VERSION}`;
const CORE = [
  './',
  'index.html',
  'app.html',
  'assets/css/base.css',
  'assets/css/fonts.css',
  'assets/css/landing.css',
  'assets/css/app.css',
  'assets/css/document.css',
  'assets/css/legal.css',
  'assets/css/help.css',
  'assets/css/mobile.css',
  'assets/icons.svg',
  'assets/favicon.svg',
  'assets/js/app.js',
  'assets/js/landing.js',
  'assets/js/ui.js',
  'assets/js/update.js',
  'assets/js/version.js',
];

// Luôn tải bản mới từ máy chủ (bỏ qua bộ nhớ đệm HTTP của trình duyệt) — tránh trường hợp service worker
// mới lại lưu tệp cũ, khiến ứng dụng vẫn chạy bản cũ và báo “có bản cập nhật” mãi.
const fresh = (req) => fetch(new Request(req, { cache: 'reload' }));

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.all(CORE.map((u) => fresh(u).then((res) => res.ok && c.put(u, res)).catch(() => {}))))
      .catch(() => {}),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tlvb-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Tệp phiên bản luôn lấy từ mạng để phát hiện bản mới.
  if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/sw.js')) return;
  if (req.mode === 'navigate') {
    // Trang HTML: ưu tiên bản trong bộ nhớ đệm của phiên bản hiện tại, dự phòng mạng.
    e.respondWith(caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true })).then((hit) => hit || fetch(req).catch(() => caches.match('app.html'))));
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(new Request(req, { cache: 'no-cache' }));
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }),
  );
});
