// Cập nhật tại chỗ cho bản cài đặt: chỉ tải các tệp mã web đã thay đổi (thường vài MB) thay vì cả bộ cài.
//
// - Mỗi lần phát hành, GitHub Actions đăng kèm web-manifest.json: { version, notes, commit, shell, files: [{ p, h (sha256), s }] }.
// - Tệp khác với bản đóng gói trong bộ cài được tải từ raw.githubusercontent.com/<repo>/<commit>/… (cố định theo
//   commit, không đổi), kiểm tra sha256, lưu vào <thư mục dữ liệu>/web-updates/<phiên bản>/.
// - Khi phục vụ trang: tệp có trong bản cập nhật được ưu tiên, còn lại lấy từ bộ cài.
// - Bản mới cần vỏ ứng dụng mới hơn (manifest.shell > SHELL_API) → phải tải bộ cài.
// - An toàn: bản vừa cập nhật phải báo “sẵn sàng” trong 25 giây sau khi tải trang, nếu không tự quay về bản trước.
const { app, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');

const SHELL_API = 1; // tăng khi main.cjs / preload.cjs thay đổi cách mã web gọi vào
const REPO = 'ngovietdinh/trolyvanban';
// Nguồn tải có dự phòng: mạng cơ quan hay chặn raw.githubusercontent.com → thử jsDelivr, github.com/raw.
// Biến môi trường chỉ dùng cho kiểm thử tự động (máy chủ giả lập; nhiều nguồn cách nhau bằng dấu phẩy).
const MANIFEST_URLS = process.env.TLVB_UPDATE_MANIFEST ? process.env.TLVB_UPDATE_MANIFEST.split(',') : [`https://github.com/${REPO}/releases/latest/download/web-manifest.json`, `api:https://api.github.com/repos/${REPO}/releases/latest`];
const RAW_BASES = process.env.TLVB_UPDATE_RAW
  ? process.env.TLVB_UPDATE_RAW.split(',').map((b) => (commit, p) => `${b}${commit}/${p}`)
  : [(commit, p) => `https://raw.githubusercontent.com/${REPO}/${commit}/${p}`, (commit, p) => `https://cdn.jsdelivr.net/gh/${REPO}@${commit}/${p}`, (commit, p) => `https://github.com/${REPO}/raw/${commit}/${p}`];
const WATCHDOG_MS = +process.env.TLVB_UPDATE_WATCHDOG_MS || 25000;

const cmp = (a, b) => {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function createUpdater(WEB) {
  const ROOT = () => path.join(app.getPath('userData'), 'web-updates');
  const STATE = () => path.join(ROOT(), 'state.json');
  let packaged = '0.0.0';
  try {
    packaged = JSON.parse(fs.readFileSync(path.join(WEB, 'version.json'), 'utf8')).version;
  } catch {}

  const readState = () => {
    try {
      return JSON.parse(fs.readFileSync(STATE(), 'utf8'));
    } catch {
      return {};
    }
  };
  const writeState = (s) => {
    fs.mkdirSync(ROOT(), { recursive: true });
    fs.writeFileSync(STATE(), JSON.stringify(s, null, 2));
  };
  const dirOf = (v) => path.join(ROOT(), v);
  const usable = (v) => v && cmp(v, packaged) > 0 && fs.existsSync(path.join(dirOf(v), '.complete'));

  let state = readState();
  /** Bản cập nhật đang dùng (null = dùng nguyên bản trong bộ cài). Bộ cài mới hơn bản cập nhật → bỏ bản cập nhật. */
  let active = usable(state.version) ? state.version : null;

  const activeVersion = () => active || packaged;

  /** Đường dẫn tệp cần phục vụ: bản cập nhật trước, rồi bộ cài. Trả về null nếu đường dẫn ra ngoài thư mục. */
  function resolve(rel) {
    const pick = (base) => {
      const f = path.normalize(path.join(base, rel));
      return f === base || f.startsWith(base + path.sep) ? f : null;
    };
    if (active) {
      const f = pick(dirOf(active));
      if (f && fs.existsSync(f)) return f;
    }
    return pick(WEB);
  }

  async function fetchManifestFrom(url) {
    if (url.startsWith('api:')) {
      // Dự phòng qua GitHub API: tìm tệp web-manifest.json trong bản phát hành mới nhất.
      const rel = await net.fetch(url.slice(4), { cache: 'no-store', headers: { accept: 'application/vnd.github+json' } });
      if (!rel.ok) throw new Error(`GitHub API ${rel.status}`);
      const asset = ((await rel.json()).assets || []).find((a) => a.name === 'web-manifest.json');
      if (!asset) throw new Error('Bản phát hành chưa có web-manifest.json');
      url = asset.browser_download_url;
    }
    const res = await net.fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`(${res.status})`);
    const m = await res.json();
    if (!m?.version || !Array.isArray(m.files) || !m.commit) throw new Error('Thông tin bản cập nhật không hợp lệ.');
    return m;
  }
  async function fetchManifest() {
    let last;
    for (const url of MANIFEST_URLS) {
      try {
        return await fetchManifestFrom(url);
      } catch (err) {
        last = err;
      }
    }
    throw new Error(`Không lấy được thông tin bản cập nhật ${last?.message || ''} — kiểm tra kết nối Internet (mạng cơ quan có thể chặn github.com).`.replace(/\s+/g, ' '));
  }

  async function check() {
    const m = await fetchManifest();
    return { current: activeVersion(), latest: m.version, notes: m.notes || [], available: cmp(m.version, activeVersion()) > 0, needInstaller: (m.shell || 1) > SHELL_API };
  }

  const packagedHash = new Map();
  async function hashOf(file) {
    if (!packagedHash.has(file)) packagedHash.set(file, fsp.readFile(file).then(sha256).catch(() => null));
    return packagedHash.get(file);
  }

  /** Tải bản mới. onProgress({ done, total, bytes }). */
  async function apply(onProgress = () => {}) {
    const m = await fetchManifest();
    if ((m.shell || 1) > SHELL_API) return { ok: false, needInstaller: true, latest: m.version };
    if (cmp(m.version, activeVersion()) <= 0) return { ok: true, upToDate: true, version: activeVersion() };
    const target = dirOf(m.version);
    const tmp = `${target}.part`;
    await fsp.rm(tmp, { recursive: true, force: true });
    await fsp.mkdir(tmp, { recursive: true });

    // Chỉ giữ tệp khác bản trong bộ cài; tệp đã có ở bản cập nhật trước thì chép lại thay vì tải.
    const need = [];
    for (const f of m.files) {
      const p = path.normalize(f.p);
      if (p.startsWith('..') || path.isAbsolute(p)) throw new Error('Danh sách tệp cập nhật không hợp lệ.');
      if ((await hashOf(path.join(WEB, p))) !== f.h) need.push({ ...f, p });
    }
    let done = 0;
    let bytes = 0;
    const total = need.length;
    onProgress({ done, total, bytes });
    const one = async (f) => {
      let buf = null;
      if (active) {
        const old = path.join(dirOf(active), f.p);
        const b = await fsp.readFile(old).catch(() => null);
        if (b && sha256(b) === f.h) buf = b;
      }
      if (!buf) {
        // Thử lần lượt các nguồn, mỗi nguồn 2 lần; tệp phải khớp sha256 mới được dùng.
        const rel = f.p.split(path.sep).map(encodeURIComponent).join('/');
        let lastErr = null;
        for (const src of RAW_BASES) {
          for (let k = 0; k < 2 && !buf; k++) {
            try {
              const res = await net.fetch(src(m.commit, rel), { cache: 'no-store' });
              if (!res.ok) throw new Error(`Tải “${f.p}” lỗi (${res.status}).`);
              const b = Buffer.from(await res.arrayBuffer());
              if (sha256(b) !== f.h) throw new Error(`Tệp “${f.p}” tải về không khớp mã kiểm tra — đã hủy cập nhật.`);
              buf = b;
            } catch (err) {
              lastErr = err;
            }
          }
          if (buf) break;
        }
        if (!buf) throw lastErr || new Error(`Không tải được “${f.p}”.`);
        bytes += buf.length;
      }
      const out = path.join(tmp, f.p);
      await fsp.mkdir(path.dirname(out), { recursive: true });
      await fsp.writeFile(out, buf);
      done++;
      onProgress({ done, total, bytes });
    };
    try {
      const queue = [...need];
      let failed = null;
      await Promise.all(
        Array.from({ length: 6 }, async () => {
          while (queue.length && !failed) {
            try {
              await one(queue.shift());
            } catch (err) {
              failed = failed || err;
            }
          }
        }),
      );
      if (failed) throw failed;
      await fsp.writeFile(path.join(tmp, '.complete'), m.version);
      await fsp.rm(target, { recursive: true, force: true });
      await fsp.rename(tmp, target);
    } catch (err) {
      await fsp.rm(tmp, { recursive: true, force: true });
      throw err;
    }
    state = { version: m.version, prev: active, pending: true, at: Date.now() };
    writeState(state);
    active = m.version;
    return { ok: true, version: m.version, changed: total, bytes };
  }

  /** Mã web báo đã chạy được → xác nhận bản cập nhật, dọn bản cũ. */
  async function confirm() {
    if (!state.pending) return;
    state = { version: active, prev: null, pending: false, at: Date.now() };
    writeState(state);
    const keep = new Set([active, 'state.json']);
    for (const name of await fsp.readdir(ROOT()).catch(() => [])) if (!keep.has(name)) await fsp.rm(path.join(ROOT(), name), { recursive: true, force: true });
  }

  /** Bản cập nhật không chạy được → quay về bản trước. Trả về true nếu đã quay về. */
  function rollback() {
    if (!state.pending) return false;
    const bad = active;
    active = usable(state.prev) ? state.prev : null;
    state = { version: active, prev: null, pending: false, failed: bad, at: Date.now() };
    writeState(state);
    if (bad) fs.rmSync(dirOf(bad), { recursive: true, force: true });
    return true;
  }

  return { resolve, check, apply, confirm, rollback, activeVersion, isPending: () => !!state.pending, packaged: () => packaged };
}

module.exports = { createUpdater, SHELL_API, WATCHDOG_MS, cmp };
