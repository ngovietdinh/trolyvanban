// Bot Zalo lấy nhanh biểu mẫu tố tụng (chạy trên Cloudflare Workers, miễn phí, 24/7).
//
// - Biểu mẫu đọc trực tiếp từ kho GitHub riêng (MAU_REPO) bằng token chỉ-đọc; bot không lưu bản sao nào.
// - Zalo Bot không gửi được tệp Word → bot trả LINK TẢI mã hóa, tự hết hạn (mặc định 15 phút).
// - Chỉ trả lời các tài khoản Zalo có trong ALLOWED_IDS; người lạ chỉ nhận lại mã tài khoản của họ.
// - Tìm mẫu: theo số mẫu, gõ không dấu, viết tắt (QĐ, BB, TB, ĐTV…). Câu hỏi mơ hồ → nhờ AI (Groq / OpenAI-compatible)
//   chọn trong ~20 mẫu ứng viên (vài trăm token mỗi lần). Không cấu hình AI vẫn dùng được.
//
// Biến môi trường (Cloudflare → Worker → Settings → Variables and Secrets):
//   ZALO_BOT_TOKEN   token bot Zalo (bí mật)
//   WEBHOOK_SECRET   chuỗi ngẫu nhiên — Zalo gửi kèm ở header X-Bot-Api-Secret-Token (bí mật)
//   LINK_SECRET      chuỗi ngẫu nhiên ≥ 32 ký tự để mã hóa link tải (bí mật)
//   MAU_GITHUB_TOKEN token GitHub fine-grained, chỉ quyền Contents: Read-only cho kho mẫu (bí mật)
//   MAU_REPO         vd "ngovietdinh/mau-bieu-mau"; MAU_DIR thư mục trong kho (mặc định gốc); MAU_REF nhánh (mặc định main)
//   ALLOWED_IDS      mã tài khoản Zalo được dùng, cách nhau dấu phẩy
//   AI_API_KEY       (tùy chọn) key Groq; AI_BASE (mặc định https://api.groq.com/openai/v1); AI_MODEL (mặc định openai/gpt-oss-120b)
//   LINK_MINUTES     (tùy chọn) số phút link còn hiệu lực, mặc định 15

const ZALO_BASE = (env) => (env.ZALO_API || 'https://bot-api.zaloplatforms.com').replace(/\/+$/, '');
const te = new TextEncoder();
const td = new TextDecoder();

/* ---------------- Chuẩn hóa chữ, viết tắt ---------------- */
export const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Viết tắt hay gặp trong tên tệp mẫu và khi nhắn tin.
const ABBR = {
  qd: 'quyet dinh', bb: 'bien ban', tb: 'thong bao', yc: 'yeu cau', cv: 'cong van', gcn: 'giay chung nhan', gm: 'giay moi',
  dtv: 'dieu tra vien', cbdt: 'can bo dieu tra', cqdt: 'co quan dieu tra', ptt: 'pho thu truong', ktv: 'kiem tra vien',
  vks: 'vien kiem sat', vksnd: 'vien kiem sat nhan dan', tp: 'toi pham', vahs: 'vu an hinh su', vadhs: 'vu an hinh su',
  ntvtp: 'nguon tin ve toi pham', ts: 'tai san', tsan: 'tai san', ng: 'nguoi', tt: 'than thich', tgiu: 'tam giu', tgiam: 'tam giam',
  ca: 'cong an', bp: 'bien phap', ad: 'ap dung', adbp: 'ap dung bien phap', qdad: 'quyet dinh ap dung', xlch: 'xu ly chuyen huong',
  kt: 'khoi to', dt: 'dieu tra', bc: 'bi can', bcan: 'bi can', lk: 'loi khai', bblk: 'bien ban ghi loi khai', hs: 'hinh su',
};
const STOP = new Set(['mau', 'so', 'cho', 'tao', 'toi', 'minh', 'xin', 'lay', 'can', 'gui', 'file', 'form', 'van', 'cua', 've', 'viec', 'cai', 'mot', 'nhe', 'nha', 'di', 'voi', 'the', 'la', 'va']);

export const expand = (s) =>
  fold(s)
    .split(' ')
    .flatMap((w) => (ABBR[w] || w).split(' '))
    .filter(Boolean);

/* ---------------- Danh mục mẫu từ GitHub ---------------- */
// Tên tệp: "140. Biên bản ghi lời khai.doc", "257A. Quyết định …doc", "196.Thông báo …doc".
export function parseName(name) {
  const m = /^\s*(\d{1,3}[A-Za-z]?)\s*\.\s*(.+?)\.(docx?)$/i.exec(name);
  if (!m) return null;
  return { so: m[1].toUpperCase(), ten: m[2].replace(/\s+/g, ' ').trim(), ext: m[3].toLowerCase() };
}

let cache = { at: 0, list: null };
export const resetCache = () => (cache = { at: 0, list: null });

function ghHeaders(env, accept = 'application/vnd.github+json') {
  return { Authorization: `Bearer ${env.MAU_GITHUB_TOKEN}`, Accept: accept, 'User-Agent': 'tlvb-zalo-bot', 'X-GitHub-Api-Version': '2022-11-28' };
}
const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');

export async function catalog(env) {
  if (cache.list && Date.now() - cache.at < 10 * 60000) return cache.list;
  const dir = (env.MAU_DIR || '').replace(/^\/+|\/+$/g, '');
  const url = `https://api.github.com/repos/${env.MAU_REPO}/contents/${encPath(dir)}?ref=${encodeURIComponent(env.MAU_REF || 'main')}`;
  const r = await fetch(url, { headers: ghHeaders(env) });
  if (!r.ok) throw new Error(`GitHub ${r.status}: không đọc được kho mẫu (kiểm tra MAU_REPO, MAU_GITHUB_TOKEN)`);
  const items = await r.json();
  const list = items
    .filter((x) => x.type === 'file')
    .map((x) => {
      const p = parseName(x.name);
      return p && { ...p, path: x.path, size: x.size, key: expand(p.ten) };
    })
    .filter(Boolean)
    .sort((a, b) => parseInt(a.so, 10) - parseInt(b.so, 10) || a.so.localeCompare(b.so));
  cache = { at: Date.now(), list };
  return list;
}

/* ---------------- Tìm mẫu trên máy chủ (không tốn token) ---------------- */
export function search(list, query, limit = 20) {
  const q = expand(query).filter((w) => !STOP.has(w));
  if (!q.length) return [];
  const scored = list.map((f) => {
    const words = new Set(f.key);
    const hay = ` ${f.key.join(' ')} `;
    let s = 0;
    for (const w of q) {
      if (words.has(w)) s += w.length > 2 ? 3 : 1.5;
      else if (w.length >= 3 && hay.includes(` ${w}`)) s += 1.5;
    }
    // Cụm từ liền nhau (vd "ghi loi khai", "khoi to bi can") được cộng thêm.
    for (let i = 0; i + 1 < q.length; i++) if (hay.includes(` ${q[i]} ${q[i + 1]} `)) s += 2;
    return { f, s: s / Math.sqrt(q.length) - f.key.length * 0.01 };
  });
  return scored
    .filter((x) => x.s > 1)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit);
}

/* ---------------- AI chọn mẫu khi câu hỏi mơ hồ ---------------- */
export async function aiPick(env, query, candidates) {
  if (!env.AI_API_KEY || !candidates.length) return null;
  const base = (env.AI_BASE || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
  const model = env.AI_MODEL || 'openai/gpt-oss-120b';
  const body = {
    model,
    temperature: 0,
    max_tokens: 300,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Bạn chọn biểu mẫu tố tụng hình sự phù hợp yêu cầu. Chỉ chọn trong danh sách được cho (ghi đúng số mẫu), không bịa. Trả về JSON {"so":["số mẫu phù hợp nhất trước, tối đa 5"],"hoi":"câu hỏi lại ngắn nếu yêu cầu chưa đủ rõ để chọn 1 mẫu, ngược lại để rỗng"}.',
      },
      { role: 'user', content: `Danh sách:\n${candidates.map((c) => `${c.so}. ${c.ten}`).join('\n')}\n\nYêu cầu: ${query}` },
    ],
  };
  if (/gpt-oss|o\d|reason/i.test(model)) body.reasoning_effort = 'low';
  try {
    const r = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return null;
    const j = await r.json();
    const out = JSON.parse(j.choices?.[0]?.message?.content || '{}');
    const valid = new Set(candidates.map((c) => c.so));
    const so = (Array.isArray(out.so) ? out.so : []).map((x) => String(x).toUpperCase().trim()).filter((x) => valid.has(x));
    return { so: [...new Set(so)].slice(0, 5), hoi: typeof out.hoi === 'string' ? out.hoi.trim().slice(0, 300) : '' };
  } catch {
    return null;
  }
}

/* ---------------- Link tải mã hóa, tự hết hạn ---------------- */
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function linkKey(env) {
  if (!env.LINK_SECRET || env.LINK_SECRET.length < 16) throw new Error('Thiếu LINK_SECRET (≥ 16 ký tự)');
  const h = await crypto.subtle.digest('SHA-256', te.encode(`tlvb-link:${env.LINK_SECRET}`));
  return crypto.subtle.importKey('raw', h, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function makeToken(env, data, now = Date.now()) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const exp = now + (Number(env.LINK_MINUTES) || 15) * 60000;
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await linkKey(env), te.encode(JSON.stringify({ ...data, exp }))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return b64u(out);
}
export async function readToken(env, token, now = Date.now()) {
  try {
    const raw = unb64u(token);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, await linkKey(env), raw.subarray(12));
    const data = JSON.parse(td.decode(pt));
    return data.exp > now ? data : { expired: true };
  } catch {
    return null;
  }
}

/* ---------------- Zalo ---------------- */
async function zalo(env, method, payload) {
  const r = await fetch(`${ZALO_BASE(env)}/bot${env.ZALO_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false, status: r.status }));
}
// Zalo giới hạn độ dài tin nhắn → cắt thành nhiều tin.
async function send(env, chatId, text) {
  const parts = [];
  let rest = text;
  while (rest.length > 1800) {
    const cut = rest.lastIndexOf('\n', 1800);
    parts.push(rest.slice(0, cut > 200 ? cut : 1800));
    rest = rest.slice(cut > 200 ? cut + 1 : 1800);
  }
  parts.push(rest);
  for (const p of parts) await zalo(env, 'sendMessage', { chat_id: chatId, text: p });
}

/** Lấy tin nhắn từ nhiều dạng dữ liệu Zalo gửi về: { ok, result: { event_name, message } } hoặc { message }. */
export function extractMessage(payload) {
  const r = payload?.result && typeof payload.result === 'object' ? payload.result : payload;
  const m = Array.isArray(r) ? r[0]?.message : r?.message;
  if (!m) return null;
  return { chatId: String(m.chat?.id ?? m.from?.id ?? ''), userId: String(m.from?.id ?? ''), name: m.from?.display_name || '', text: typeof m.text === 'string' ? m.text.trim() : '' };
}

const allowed = (env, id) =>
  String(env.ALLOWED_IDS || '')
    .split(/[,\s]+/)
    .filter(Boolean)
    .includes(id);

const HELP = `📄 Bot biểu mẫu tố tụng
• Nhắn SỐ MẪU để lấy file: 140   hoặc   mẫu 257A
• Nhắn tên / mô tả để tìm: biên bản ghi lời khai người làm chứng · qd khoi to bi can
• ds 100 — xem các mẫu từ số 100
Link tải hết hạn sau ít phút, mở bằng Word / WPS trên điện thoại.`;

/** Xử lý một tin nhắn → nội dung trả lời (chuỗi). origin: địa chỉ Worker để dựng link tải. */
export async function reply(env, text, origin) {
  const t = text.trim();
  if (!t || /^(\/?start|\/?help|hd|huong dan|hướng dẫn|\?|menu|chao|chào|hi|hello)$/i.test(t)) return HELP;
  const list = await catalog(env);
  const link = async (f) => `📄 Mẫu ${f.so}. ${f.ten}\n⬇️ ${origin}/f/${await makeToken(env, { p: f.path })}\n(link hết hạn sau ${Number(env.LINK_MINUTES) || 15} phút)`;
  const lines = (fs) => fs.map((f) => `• ${f.so}. ${f.ten}`).join('\n');

  // Danh sách theo số: "ds 100".
  const ds = /^(?:ds|danh sach|danh sách|list)\s*(\d{1,3})?$/i.exec(t);
  if (ds) {
    const from = +(ds[1] || 1);
    const page = list.filter((f) => parseInt(f.so, 10) >= from).slice(0, 25);
    return page.length ? `Có ${list.length} mẫu. Từ số ${from}:\n${lines(page)}\n\nNhắn số mẫu để lấy file · ds ${parseInt(page.at(-1).so, 10) + 1} để xem tiếp` : `Không có mẫu từ số ${from}.`;
  }

  // Số mẫu: "140", "mẫu 257a", "mau so 26B".
  const num = /^(?:m[aẫ]u\s*)?(?:s[oố]\s*)?(\d{1,3}[a-z]?)\s*$/i.exec(t);
  if (num) {
    const so = num[1].toUpperCase();
    const f = list.find((x) => x.so === so);
    if (f) return link(f);
    const near = list.filter((x) => x.so.startsWith(so.replace(/[A-Z]$/, ''))).slice(0, 8);
    return `Không có mẫu số ${so}.${near.length ? `\nCó thể là:\n${lines(near)}` : ''}`;
  }

  // Tìm theo tên / mô tả.
  const hits = search(list, t);
  const top = hits[0];
  if (top && (hits.length === 1 || top.s >= hits[1].s * 1.6) && top.s >= 4) return link(top.f);
  const cand = hits.length ? hits.map((h) => h.f) : list.filter((f) => expand(t).some((w) => w.length > 3 && f.key.includes(w))).slice(0, 20);
  const ai = await aiPick(env, t, cand.length ? cand : list);
  if (ai?.so.length) {
    const picked = ai.so.map((so) => list.find((f) => f.so === so)).filter(Boolean);
    if (picked.length === 1 && !ai.hoi) return link(picked[0]);
    return `${ai.hoi ? `${ai.hoi}\n` : 'Có thể là:\n'}${lines(picked)}\n\nNhắn số mẫu để lấy file.`;
  }
  if (hits.length) return `Có thể là:\n${lines(hits.slice(0, 8).map((h) => h.f))}\n\nNhắn số mẫu để lấy file.`;
  return 'Không tìm thấy mẫu phù hợp. Thử từ khóa khác (vd: “lệnh bắt”, “khởi tố bị can”) hoặc nhắn “ds” để xem danh sách.';
}

/* ---------------- Tải tệp qua link ---------------- */
async function download(env, token) {
  const data = await readToken(env, token);
  if (!data) return new Response('Link không hợp lệ.', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  if (data.expired) return new Response('Link đã hết hạn — nhắn lại số mẫu cho bot để lấy link mới.', { status: 410, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const r = await fetch(`https://api.github.com/repos/${env.MAU_REPO}/contents/${encPath(data.p)}?ref=${encodeURIComponent(env.MAU_REF || 'main')}`, { headers: ghHeaders(env, 'application/vnd.github.raw') });
  if (!r.ok) return new Response('Không lấy được tệp mẫu.', { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const name = data.p.split('/').pop();
  const ascii = fold(name.replace(/\.(docx?)$/i, '')).replace(/ /g, '-') + (/\.docx$/i.test(name) ? '.docx' : '.doc');
  return new Response(r.body, {
    headers: {
      'Content-Type': /\.docx$/i.test(name) ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/msword',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

/* ---------------- Điểm vào ---------------- */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/f/')) return download(env, url.pathname.slice(3));

    if (url.pathname === '/webhook' && request.method === 'POST') {
      if (!env.WEBHOOK_SECRET || request.headers.get('X-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
      const payload = await request.json().catch(() => null);
      const msg = extractMessage(payload);
      if (!msg?.chatId) return new Response('ok');
      // Trả lời Zalo ngay, xử lý phía sau (tìm mẫu, gọi AI) để không bị hết giờ chờ.
      ctx.waitUntil(
        (async () => {
          if (!allowed(env, msg.userId)) return send(env, msg.chatId, `Bot riêng — tài khoản chưa được cấp quyền.\nMã tài khoản Zalo của bạn: ${msg.userId}`);
          if (!msg.text) return send(env, msg.chatId, 'Bot chỉ đọc tin nhắn chữ. Nhắn số mẫu hoặc tên mẫu cần lấy.');
          try {
            await send(env, msg.chatId, await reply(env, msg.text, url.origin));
          } catch (e) {
            await send(env, msg.chatId, `Lỗi: ${e.message}`);
          }
        })(),
      );
      return new Response('ok');
    }

    // Đăng ký webhook với Zalo (chạy một lần sau khi triển khai): POST /setup kèm header X-Setup-Key = LINK_SECRET.
    if (url.pathname === '/setup' && request.method === 'POST') {
      if (request.headers.get('X-Setup-Key') !== env.LINK_SECRET) return new Response('forbidden', { status: 403 });
      const me = await zalo(env, 'getMe', {});
      const hook = await zalo(env, 'setWebhook', { url: `${url.origin}/webhook`, secret_token: env.WEBHOOK_SECRET });
      let mau = null;
      try {
        mau = (await catalog(env)).length;
      } catch (e) {
        mau = e.message;
      }
      return Response.json({ bot: me, webhook: hook, soMau: mau });
    }
    return new Response('Bot biểu mẫu đang chạy.', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  },
};
