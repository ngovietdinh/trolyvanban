// Lớp AI: hỗ trợ Claude (Anthropic), ChatGPT (OpenAI), Gemini (Google), Grok (xAI), Groq bằng API key
// của từng tài khoản, và AI chạy trên máy (Ollama, LM Studio, llama.cpp…) không cần key. Khi chưa có key hoặc không được cấp quyền, dùng "Trợ lý mẫu" chạy cục bộ.

import { moneyToWords, formatNumberVi, parseNumberInput } from './number-words.js';
import { summarize } from './summarize.js';
import { checkText, fixAll, ISSUE_LABELS } from './spellcheck.js';
import { DOC_TYPES, getDocType } from './doc-types.js';
import { planGroq, groqAdmit, groqReserve, estTokens } from './groq-quota.js';
import { splitCache, stripCache } from './cache-mark.js';

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — chất lượng cao nhất' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — nhanh, tiết kiệm' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — siêu tốc' },
];
export const DEFAULT_MODEL = 'claude-opus-5-5';

/** Nhà cung cấp AI. Tên mô hình của OpenAI/Google/xAI thay đổi thường xuyên nên cho phép nhập tự do. */
export const PROVIDERS = {
  anthropic: { label: 'Claude', vendor: 'Anthropic', keyHint: 'sk-ant-…', keyPrefix: /^sk-ant-/, console: 'console.anthropic.com', defaultModel: DEFAULT_MODEL, models: MODELS.map((m) => m.id), backup: ['claude-sonnet-5-5', 'claude-haiku-4-5'] },
  openai: { label: 'ChatGPT', vendor: 'OpenAI', keyHint: 'sk-…', keyPrefix: /^sk-/, console: 'platform.openai.com', backup: ['gpt-4o-mini', 'gpt-4.1-mini'], defaultModel: 'gpt-4o', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'], base: 'https://api.openai.com/v1' },
  gemini: { label: 'Gemini', vendor: 'Google', keyHint: 'AIza…', keyPrefix: /^AIza/, console: 'aistudio.google.com', defaultModel: 'gemini-2.5-flash', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'], backup: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'], base: 'https://generativelanguage.googleapis.com/v1beta' },
  grok: { label: 'Grok', vendor: 'xAI', keyHint: 'xai-…', keyPrefix: /^xai-/, console: 'console.x.ai', backup: ['grok-3-mini'], defaultModel: 'grok-3', models: ['grok-3', 'grok-3-mini', 'grok-4'], base: 'https://api.x.ai/v1' },
  // Groq: hạ tầng suy luận rất nhanh cho các mô hình mở (Llama, GPT-OSS, Qwen, Kimi…), giao thức tương thích OpenAI.
  groq: { label: 'Groq', vendor: 'Groq', keyHint: 'gsk_…', keyPrefix: /^gsk_/, console: 'console.groq.com', backup: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'], defaultModel: 'openai/gpt-oss-120b', models: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'qwen/qwen3-32b', 'moonshotai/kimi-k2-instruct', 'llama-3.1-8b-instant'], base: 'https://api.groq.com/openai/v1', maxTokens: 8192 },
  // OpenRouter: một API key dùng hàng trăm mô hình (GPT-OSS, Claude, Gemini, Llama, DeepSeek, Qwen…), có mô hình miễn phí
  // (đuôi “:free”), giao thức tương thích OpenAI.
  openrouter: { label: 'OpenRouter', vendor: 'OpenRouter', keyHint: 'sk-or-…', keyPrefix: /^sk-or-/, console: 'openrouter.ai/keys', backup: ['meta-llama/llama-3.3-70b-instruct', 'openai/gpt-oss-20b'], defaultModel: 'openai/gpt-oss-120b', models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'openai/gpt-oss-20b:free', 'google/gemini-2.5-flash', 'anthropic/claude-sonnet-4.5', 'meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-chat-v3.1', 'qwen/qwen3-235b-a22b-2507'], base: 'https://openrouter.ai/api/v1', maxTokens: 16000 },
  // AI chạy trên máy hoặc máy chủ nội bộ (Ollama, LM Studio, llama.cpp, Jan, vLLM…) — giao thức tương thích OpenAI.
  // Không cần API key; dữ liệu không rời khỏi máy / mạng nội bộ.
  local: { label: 'AI trên máy', vendor: 'Ollama, LM Studio…', local: true, keyHint: '(không bắt buộc)', keyPrefix: /.*/, console: 'ollama.com', defaultModel: '', models: [], backup: [], base: 'http://localhost:11434/v1', maxTokens: 8192 },
};

/** Phần mềm chạy AI trên máy phổ biến và địa chỉ mặc định của từng phần mềm. */
export const LOCAL_PRESETS = [
  { id: 'ollama', label: 'Ollama', base: 'http://localhost:11434/v1', site: 'ollama.com', hint: 'Cài Ollama, chạy lệnh: ollama pull qwen2.5:7b' },
  { id: 'lmstudio', label: 'LM Studio', base: 'http://localhost:1234/v1', site: 'lmstudio.ai', hint: 'Mở tab Developer → Start Server, bật “Enable CORS”' },
  { id: 'llamacpp', label: 'llama.cpp', base: 'http://localhost:8080/v1', site: 'github.com/ggml-org/llama.cpp', hint: 'Chạy: llama-server -m model.gguf --port 8080' },
  { id: 'jan', label: 'Jan', base: 'http://localhost:1337/v1', site: 'jan.ai', hint: 'Settings → Local API Server → Start Server' },
  // Nền tảng AI tự dựng cho cơ quan: kết nối nhiều mô hình, phân quyền, kho tài liệu. Cần khóa API.
  { id: 'bionic', label: 'BionicGPT', base: 'http://localhost:3000/v1', site: 'bionic-gpt.com', needKey: true, hint: 'Nhập địa chỉ máy chủ BionicGPT của cơ quan (thêm /v1). Tạo khóa: Admin Panel → API Keys → Create Assistant Key, dán vào “Khóa truy cập”' },
];

/** Chuẩn hóa địa chỉ máy chủ AI cục bộ: bỏ “/” cuối, thêm “/v1” nếu chỉ nhập máy và cổng. */
export function normalizeLocalBase(url) {
  let s = String(url || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  try {
    const u = new URL(s);
    if (u.pathname === '/' || u.pathname === '') s = `${u.origin}/v1`;
  } catch {
    return '';
  }
  return s;
}

/** Địa chỉ thuộc máy này hoặc mạng nội bộ (dữ liệu không ra Internet). */
export function isPrivateEndpoint(url) {
  let host;
  try {
    host = new URL(normalizeLocalBase(url)).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    return false;
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '::1') return true;
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [+m[1], +m[2]];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

/** Trình duyệt báo đang mất mạng. */
export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Ứng dụng gọi khi đọc / lưu cấu hình AI của tài khoản. */
export function setLocalEndpoint(url) {
  PROVIDERS.local.base = normalizeLocalBase(url) || 'http://localhost:11434/v1';
}

export const SYSTEM_PROMPT = `Bạn là "Trợ Lý Văn Bản", chuyên gia văn thư - hành chính nhà nước Việt Nam với nhiều năm kinh nghiệm.
- Luôn trả lời bằng tiếng Việt chuẩn mực, lịch sự, súc tích.
- Khi soạn văn bản hành chính: tuân thủ thể thức và kỹ thuật trình bày theo Nghị định 30/2020/NĐ-CP; văn phong hành chính công vụ, chính xác, phổ thông, khách quan; không dùng từ địa phương, khẩu ngữ.
- Không bịa đặt số hiệu văn bản pháp luật, số liệu; nếu cần thông tin chưa có, để chỗ trống dạng "[...]" để người dùng điền.
- Có thể dùng Markdown nhẹ (in đậm, danh sách) khi trò chuyện.`;

/* ---------------- Claude ---------------- */

let sdkPromise;
const loadSdk = () => (sdkPromise ??= import('../../vendor/anthropic-sdk.mjs').then((m) => m.default));

export function friendlyError(err, Anthropic) {
  if (err?.name === 'AbortError' || (Anthropic && err instanceof Anthropic.APIUserAbortError)) return 'Đã dừng tạo nội dung.';
  if (Anthropic) {
    if (err instanceof Anthropic.AuthenticationError) return 'API key không hợp lệ. Vui lòng kiểm tra lại trong Cài đặt.';
    if (err instanceof Anthropic.PermissionDeniedError) return 'API key không có quyền dùng mô hình này.';
    if (err instanceof Anthropic.NotFoundError) return 'Không tìm thấy mô hình đã chọn. Hãy chọn mô hình khác trong Cài đặt.';
    if (err instanceof Anthropic.RateLimitError) return 'Hệ thống đang quá tải hoặc vượt hạn mức. Vui lòng thử lại sau ít phút.';
    if (err instanceof Anthropic.APIConnectionError) return 'Không kết nối được tới máy chủ AI. Kiểm tra kết nối mạng.';
    if (err instanceof Anthropic.APIError) return `Lỗi từ máy chủ AI (${err.status ?? 'không rõ'}). Vui lòng thử lại.`;
  }
  return err?.message || 'Đã xảy ra lỗi không xác định.';
}

/**
 * Gọi Claude ở chế độ streaming. onText nhận từng đoạn chữ.
 * Trả về toàn bộ văn bản. Ném lỗi với thông điệp tiếng Việt thân thiện.
 */
function streamOnce(opts) {
  const provider = opts.provider || 'anthropic';
  if (provider === 'openai' || provider === 'grok' || provider === 'groq' || provider === 'openrouter' || provider === 'local') return streamOpenAICompatible({ ...opts, provider });
  if (provider === 'gemini') return streamGemini(opts);
  return streamAnthropic(opts);
}

/* ---------------- Độ tin cậy: chuyển nhà cung cấp, hết thời gian chờ, ghi nhớ kết quả ---------------- */

/**
 * Móc nối do ứng dụng đăng ký:
 * - chain(): danh sách nhà cung cấp khác của tài khoản [{ provider, apiKey, model, label }] để dự phòng;
 * - options(): { fallback: bool, cache: bool };
 * - event({ type: 'switch' | 'error' | 'cache', ... }): thông báo / ghi nhật ký;
 * - cacheGet(key) / cacheSet(key, value): kho ghi nhớ cục bộ.
 */
let hooks = {};
export function setAIHooks(h) {
  hooks = { ...hooks, ...h };
}

export const AI_TIMEOUT = { first: 90000, idle: 60000 };
/** AI trên máy: lần đầu phải nạp mô hình vào bộ nhớ, máy không có GPU chạy chậm — chờ lâu hơn. */
export const LOCAL_TIMEOUT = { first: 300000, idle: 120000 };

/** Băm ngắn (FNV-1a 53 bit) để làm khóa ghi nhớ. */
export function hashText(str) {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Một lần gọi có giới hạn thời gian chờ (chưa có chữ đầu tiên / ngừng giữa chừng). */
async function streamWithTimeout(opts, timeout = opts.timeout || (opts.provider === 'local' ? LOCAL_TIMEOUT : AI_TIMEOUT)) {
  const ctl = new AbortController();
  let timedOut = false;
  let timer;
  const arm = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      ctl.abort();
    }, ms);
  };
  const onUserAbort = () => ctl.abort();
  opts.signal?.addEventListener('abort', onUserAbort, { once: true });
  arm(timeout.first);
  try {
    return await streamOnce({
      ...opts,
      signal: ctl.signal,
      // Đang xếp hàng chờ hạn mức (Groq): chưa tính giờ chờ phản hồi.
      onQueue: () => arm(timeout.first),
      onText: (d, all) => {
        arm(timeout.idle);
        opts.onText?.(d, all);
      },
    });
  } catch (err) {
    if (timedOut) throw aiError(`${PROVIDERS[opts.provider || 'anthropic']?.label || 'AI'} không phản hồi sau ${Math.round(timeout.first / 1000)} giây.`, -2);
    throw err;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onUserAbort);
  }
}

/**
 * Gọi AI: nếu nhà cung cấp đang chọn lỗi (mạng, key, hạn mức, mô hình, hết thời gian chờ)
 * thì tự chuyển sang nhà cung cấp khác đã cấu hình. opts.cache = true để dùng lại kết quả
 * đã ghi nhớ cho đúng yêu cầu này (không gửi lại). opts.meta (nếu có) nhận { provider, cached, switched }.
 */
export async function streamClaude(opts) {
  const meta = opts.meta || {};
  const o = hooks.options?.() || { fallback: true, cache: true };
  let cacheKey = null;
  if (opts.cache && o.cache !== false) {
    cacheKey = hashText(JSON.stringify([opts.system || SYSTEM_PROMPT, opts.messages, opts.maxTokens || 0]));
    const hit = opts.fresh ? null : hooks.cacheGet?.(cacheKey);
    if (hit?.text) {
      Object.assign(meta, { provider: hit.provider, cached: true, switched: false });
      opts.onText?.(hit.text, hit.text);
      hooks.event?.({ type: 'cache', provider: hit.provider });
      return hit.text;
    }
  }
  const first = { provider: opts.provider || 'anthropic', apiKey: opts.apiKey, model: opts.model || PROVIDERS[opts.provider || 'anthropic']?.defaultModel };
  // AI trên máy không bao giờ tự chuyển sang dịch vụ trực tuyến: người dùng chọn nó để dữ liệu không rời khỏi máy
  // (phân hệ Tố tụng dựa vào điều này).
  const allowFallback = !opts.noFallback && o.fallback !== false && first.provider !== 'local';
  const chain = (hooks.chain?.() || []).filter((c) => c.apiKey);
  const others = allowFallback ? chain.filter((c) => c.provider !== first.provider) : [];
  // Mất mạng → AI trên máy. Dữ liệu không rời khỏi máy nên luôn được phép, kể cả khi tắt “tự chuyển nhà cung cấp”.
  const localEntry = first.provider !== 'local' && !opts.noFallback ? chain.find((c) => c.provider === 'local') || null : null;
  let queue = [first, ...others];
  if (localEntry && isOffline()) {
    queue = [localEntry];
    hooks.event?.({ type: 'offline', from: first.provider, to: 'local' });
  }
  const errors = [];
  const label = (p) => PROVIDERS[p]?.label || p;
  // Lần lượt: nhà cung cấp đang chọn → mô hình dự phòng cùng nhà cung cấp → nhà cung cấp khác.
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    let netDown = false;
    const models = [c.model, ...(allowFallback ? (PROVIDERS[c.provider]?.backup || []).filter((m) => m !== c.model) : [])];
    for (let mi = 0; mi < models.length; mi++) {
      const model = models[mi];
      // Có AI trên máy dự phòng: lỗi mạng thì không chờ thử lại, chuyển ngay.
      const r = await tryWithRetry({ ...opts, provider: c.provider, apiKey: c.apiKey, model, quickNetFail: !!localEntry && c.provider !== 'local' });
      if (r.ok && r.truncated) r.text = await continueTruncated({ ...opts, provider: c.provider, apiKey: c.apiKey, model }, r.text);
      if (r.ok) {
        Object.assign(meta, { provider: c.provider, model, cached: false, switched: c !== first || mi > 0 });
        if (cacheKey && r.text && r.text.trim()) hooks.cacheSet?.(cacheKey, { text: r.text, provider: c.provider, at: Date.now() });
        return r.text;
      }
      const err = r.err;
      const msg = err?.message || String(err);
      if (opts.signal?.aborted || /^Đã dừng/.test(msg)) throw new Error('Đã dừng tạo nội dung.');
      hooks.event?.({ type: 'error', provider: c.provider, message: `${model}: ${msg}` });
      errors.push(`${label(c.provider)} (${model}): ${msg}`);
      if (/không thể xử lý/.test(msg)) break; // từ chối nội dung: không thử tiếp
      netDown = err?.status === -1 && c.provider !== 'local';
      // Quá tải / lỗi máy chủ / sai tên mô hình → thử mô hình dự phòng của cùng nhà cung cấp.
      // Yêu cầu đã chia nhỏ (timeoutRetry: false): hết giờ chờ thì không gửi lại cùng nội dung cho mô hình khác.
      const capacity = [404, 429, 500, 502, 503, 504, ...(opts.timeoutRetry === false ? [] : [-2])].includes(err?.status);
      const nextModel = capacity ? models[mi + 1] : undefined;
      if (nextModel) {
        hooks.event?.({ type: 'switch', from: c.provider, to: c.provider, message: `${model} lỗi → thử ${nextModel}` });
        opts.onText?.('', '');
        continue;
      }
      break;
    }
    // Không kết nối được dịch vụ trực tuyến (mất mạng): các dịch vụ trực tuyến khác cũng sẽ lỗi → sang AI trên máy.
    if (netDown && localEntry) {
      queue = [...queue.slice(0, qi + 1), localEntry];
      hooks.event?.({ type: 'offline', from: c.provider, to: 'local' });
      opts.onSwitch?.(c.provider, 'local', errors.at(-1));
      opts.onText?.('', '');
      continue;
    }
    const next = queue[qi + 1];
    if (next) {
      hooks.event?.({ type: 'switch', from: c.provider, to: next.provider, message: errors.at(-1) });
      opts.onSwitch?.(c.provider, next.provider, errors.at(-1));
      opts.onText?.('', '');
    }
  }
  const e = new Error(errors.length > 1 ? `AI đều lỗi sau khi thử lại — ${errors.join(' | ')}` : errors[0] || 'AI không phản hồi.');
  e.aiErrors = errors;
  throw e;
}

export const AI_RETRY = { delays: [1500, 4000] };
const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
  });

/**
 * Câu trả lời bị cắt vì chạm giới hạn độ dài: tự yêu cầu viết tiếp đúng chỗ dừng (tối đa opts.maxContinue lần,
 * mặc định 3) rồi ghép lại — bảo đảm kết quả về đủ (kể cả JSON dài). Lỗi khi viết tiếp: giữ phần đã có.
 */
export const CONTINUE_PROMPT = 'Câu trả lời trước bị cắt giữa chừng do giới hạn độ dài. Hãy viết tiếp NGAY từ ký tự bị cắt, không lặp lại phần đã viết, không thêm lời dẫn, giữ đúng định dạng (nếu là JSON thì viết tiếp phần còn lại của JSON).';
/** Ghép phần viết tiếp, bỏ đoạn bị lặp lại ở chỗ nối. */
export function stitch(a, b) {
  const tail = a.slice(-200);
  for (let n = Math.min(tail.length, b.length); n >= 12; n--) if (tail.endsWith(b.slice(0, n))) return a + b.slice(n);
  return a + b.replace(/^```(?:json)?\s*/i, '');
}
async function continueTruncated(opts, text) {
  let all = text;
  for (let round = 0; round < (opts.maxContinue ?? 3); round++) {
    if (opts.signal?.aborted) break;
    const r = await tryWithRetry({
      ...opts,
      messages: [...opts.messages, { role: 'assistant', content: all }, { role: 'user', content: CONTINUE_PROMPT }],
      onText: (d, part) => opts.onText?.(d, stitch(all, part)),
    });
    if (!r.ok || !r.text) break;
    all = stitch(all, r.text);
    hooks.event?.({ type: 'continue', provider: opts.provider, message: `Viết tiếp lần ${round + 1}` });
    if (!r.truncated) return all;
  }
  return all;
}

/** Gọi một mô hình; tự thử lại khi quá tải tạm thời (429/5xx/mạng/hết giờ) nếu chưa có chữ nào hiện ra. */
async function tryWithRetry(opts) {
  let lastErr;
  for (let attempt = 0; attempt <= AI_RETRY.delays.length; attempt++) {
    let gotText = false;
    const out = {};
    try {
      const text = await streamWithTimeout({
        ...opts,
        out,
        onText: (d, all) => {
          if (d) gotText = true;
          opts.onText?.(d, all);
        },
      });
      return { ok: true, text, truncated: !!out.truncated };
    } catch (err) {
      lastErr = err;
      if (opts.signal?.aborted) break;
      // Hết giờ chờ với yêu cầu lớn: gửi lại nguyên khối chỉ làm chờ lâu thêm — phần gọi đã chia nhỏ tự xử lý.
      const transient = [429, 500, 502, 503, 504, ...(opts.timeoutRetry === false ? [] : [-2]), ...(opts.quickNetFail ? [] : [-1])].includes(err?.status);
      if (!transient || gotText || attempt === AI_RETRY.delays.length) break;
      // Máy chủ báo phải chờ bao lâu (Retry-After, vd Groq hết hạn mức phút): chờ đúng chừng đó, quá 65 giây thì thôi.
      if (err?.retryAfter > 65) break;
      const wait = err?.retryAfter ? Math.ceil(err.retryAfter * 1000) + 300 : AI_RETRY.delays[attempt];
      hooks.event?.({ type: 'retry', provider: opts.provider, message: `${err.message} — thử lại lần ${attempt + 1}${err?.retryAfter ? ` sau ${Math.ceil(err.retryAfter)} giây` : ''}` });
      await sleep(wait, opts.signal);
    }
  }
  return { ok: false, err: lastErr };
}

/** Tên trung tính cho mọi nhà cung cấp. */
export const streamAI = streamClaude;

/*
 * Tin nhắn có ảnh (dạng trung tính): content = [{ type: 'text', text }, { type: 'image', mime, data (base64) }].
 * Mỗi nhà cung cấp có cách biểu diễn riêng — chuyển đổi tại đây.
 */
const parts = (content) => (Array.isArray(content) ? content : [{ type: 'text', text: String(content ?? '') }]);
/*
 * Prompt caching: lời nhắc có dấu CACHE_BREAK (cache-mark.js) → phần cố định gắn cache_control (Claude; OpenRouter với
 * mô hình Claude / Gemini). Hội thoại nhiều lượt (cacheHistory): gắn thêm ở lượt trả lời gần nhất để lần hỏi sau đọc
 * lại toàn bộ lịch sử từ cache. Nhà cung cấp tự cache theo phần đầu (Groq, OpenAI, Gemini…): bỏ dấu, giữ thứ tự.
 */
const EPHEMERAL = { type: 'ephemeral' };
function cachedText(text) {
  const sp = splitCache(text);
  if (!sp) return null;
  return [{ type: 'text', text: sp[0], cache_control: EPHEMERAL }, ...(sp[1] ? [{ type: 'text', text: sp[1] }] : [])];
}
function markHistory(list) {
  // Lượt áp chót (trả lời gần nhất của AI): đánh dấu khối cuối để cache cả lịch sử phía trước.
  const i = list.length - 2;
  if (i < 1 || list.some((m) => Array.isArray(m.content) && m.content.some((p) => p.cache_control))) return list;
  const m = list[i];
  const content = Array.isArray(m.content) ? m.content.map((p) => ({ ...p })) : [{ type: 'text', text: String(m.content ?? '') }];
  const last = content[content.length - 1];
  if (last && (last.type !== 'text' || last.text)) last.cache_control = EPHEMERAL;
  return list.map((x, k) => (k === i ? { ...m, content } : x));
}
function toAnthropic(messages, { cacheHistory = false } = {}) {
  const list = messages.map((m) => {
    if (!Array.isArray(m.content)) return cachedText(m.content) ? { ...m, content: cachedText(m.content) } : m;
    return { ...m, content: m.content.map((p) => (p.type === 'image' ? { type: 'image', source: { type: 'base64', media_type: p.mime || 'image/jpeg', data: p.data } } : { type: 'text', text: stripCache(p.text) })) };
  });
  return cacheHistory ? markHistory(list) : list;
}
function toOpenAI(messages, { cacheControl = false, cacheHistory = false } = {}) {
  const list = messages.map((m) => {
    if (!Array.isArray(m.content)) return { ...m, content: (cacheControl && cachedText(m.content)) || stripCache(m.content) };
    // Chỉ có chữ → một chuỗi (mô hình chỉ đọc chữ không nhận mảng nội dung).
    if (m.content.every((p) => p.type !== 'image')) return { ...m, content: m.content.map((p) => stripCache(p.text)).join('\n') };
    return { ...m, content: m.content.map((p) => (p.type === 'image' ? { type: 'image_url', image_url: { url: `data:${p.mime || 'image/jpeg'};base64,${p.data}` } } : { type: 'text', text: stripCache(p.text) })) };
  });
  return cacheControl && cacheHistory ? markHistory(list) : list;
}
const toGeminiParts = (content) => parts(content).map((p) => (p.type === 'image' ? { inline_data: { mime_type: p.mime || 'image/jpeg', data: p.data } } : { text: stripCache(p.text) }));

/** Mô hình suy luận nhận tham số mức suy nghĩ (token suy nghĩ tính như token trả lời — mức thấp tiết kiệm nhiều). */
export const isReasoningModel = (provider, model = '') => /gpt-oss/i.test(model) || (provider === 'openai' && /^(o\d|gpt-5)/i.test(model));
/** OpenRouter: mô hình Claude / Gemini cần cache_control tường minh (các mô hình khác tự cache). */
const openRouterCacheControl = (model = '') => /^(anthropic|google)\//i.test(model);

async function streamAnthropic({ apiKey, model = DEFAULT_MODEL, system = SYSTEM_PROMPT, messages, onText, signal, maxTokens = 16000, quickNetFail = false, out = null, cacheHistory = false, effort = 'low' }) {
  const Anthropic = await loadSdk();
  // quickNetFail: có AI trên máy dự phòng → không để thư viện tự thử lại khi mất mạng.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, ...(quickNetFail ? { maxRetries: 0 } : {}) });
  const params = { model, max_tokens: maxTokens, system, messages: toAnthropic(messages, { cacheHistory }) };
  // Mức suy nghĩ (effort): việc thường để thấp cho tiết kiệm, phân tích tố tụng truyền 'medium'.
  if (effort && /^claude-(opus-5|sonnet-5|haiku-5|fable-5|opus-4-[5-8])/.test(model)) params.output_config = { effort };
  // Opus 5.5 / Sonnet 5.5: bật cơ chế dự phòng phía máy chủ khi yêu cầu bị bộ lọc an toàn từ chối.
  const withFallback = model === 'claude-opus-5-5' || model === 'claude-sonnet-5-5';
  let stream;
  try {
    stream = withFallback ? client.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }) : client.messages.stream(params);
    signal?.addEventListener('abort', () => stream.abort(), { once: true });
    let text = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        text += event.delta.text;
        onText?.(event.delta.text, text);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new Error('Yêu cầu này không thể xử lý. Vui lòng diễn đạt lại nội dung.');
    if (final.stop_reason === 'max_tokens') {
      if (out) out.truncated = true;
      else text += '\n\n[Nội dung đã đạt giới hạn độ dài.]';
    }
    return text;
  } catch (err) {
    // Lỗi kết nối (mất mạng) → -1 như các nhà cung cấp khác, để chuyển ngay sang AI trên máy.
    const st = err?.status === 529 ? 503 : err?.status || (quickNetFail && err instanceof Anthropic.APIConnectionError && !(err instanceof Anthropic.APIUserAbortError) ? -1 : 0);
    throw aiError(st === 503 ? 'Claude đang quá tải (529/503). Hệ thống sẽ tự thử lại hoặc chuyển mô hình.' : friendlyError(err, Anthropic), st);
  }
}

/* ---------------- OpenAI / xAI (giao thức tương thích OpenAI) và Google Gemini ---------------- */

/** Lỗi AI kèm mã trạng thái HTTP để quyết định thử lại / chuyển mô hình / chuyển nhà cung cấp. */
export function aiError(message, status = 0) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function httpError(status, provider, bodyText = '') {
  const label = PROVIDERS[provider]?.label || 'AI';
  if (provider === 'local') {
    if (status === 404 || /not found|no such model|model .* not/i.test(bodyText)) return `AI trên máy chưa có mô hình đã chọn. Bấm “Tải danh sách” để chọn mô hình đã cài (Ollama: chạy “ollama pull qwen2.5:7b”).`;
    if (status === 401 || status === 403) return `Máy chủ AI từ chối (${status}): khóa truy cập sai hoặc thiếu (BionicGPT: Admin Panel → API Keys), hoặc chưa cho phép CORS (Ollama: OLLAMA_ORIGINS=*).`;
    if (status === 500 && /memory|out of memory|CUDA|alloc/i.test(bodyText)) return 'Máy không đủ bộ nhớ để chạy mô hình này. Chọn mô hình nhỏ hơn (vd: qwen2.5:3b, llama3.2:3b).';
    return `AI trên máy báo lỗi (${status}). ${bodyText.slice(0, 160)}`;
  }
  if (status === 503 || /UNAVAILABLE|overloaded/i.test(bodyText)) return `${label} đang quá tải (503 — máy chủ tạm thời không phục vụ). Hệ thống sẽ tự thử lại hoặc chuyển mô hình.`;
  if (status === 401 || status === 403 || /API_KEY_INVALID|invalid api key|incorrect api key/i.test(bodyText)) return `API key ${label} không hợp lệ hoặc không có quyền. Vui lòng kiểm tra trong Cài đặt.`;
  if (status === 404) return `Không tìm thấy mô hình ${label} đã chọn. Kiểm tra lại tên mô hình trong Cài đặt.`;
  if (provider === 'groq' && (status === 413 || /tokens per (minute|day)|TPM|TPD|rate_limit|too large/i.test(bodyText))) {
    if (/per day|TPD|RPD|requests per day/i.test(bodyText)) return 'Groq: đã hết hạn mức sử dụng trong ngày của gói hiện tại. Dùng nhà cung cấp khác hoặc chờ sang ngày mới.';
    if (status === 413 || /too large/i.test(bodyText)) return 'Groq: nội dung gửi đi lớn hơn hạn mức token mỗi phút — cần chia nhỏ hơn.';
    return 'Groq: vượt hạn mức token / yêu cầu mỗi phút — đang chờ rồi gửi lại.';
  }
  if (status === 429) return `${label} đang quá tải hoặc vượt hạn mức sử dụng. Vui lòng thử lại sau.`;
  if (status === 400) return `Yêu cầu tới ${label} không hợp lệ (400). ${bodyText.slice(0, 160)}`;
  return `Lỗi từ máy chủ ${label} (${status}). Vui lòng thử lại.`;
}

/** Đọc luồng SSE, gọi onEvent(dataString) cho từng sự kiện. */
async function readSSE(res, onEvent) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (line.startsWith('data:')) onEvent(line.slice(5).trim());
    }
  }
  if (buf.startsWith('data:')) onEvent(buf.slice(5).trim());
}

async function doFetch(url, init, provider, signal) {
  let res;
  try {
    res = await fetch(url, { ...init, signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Đã dừng tạo nội dung.');
    if (provider === 'local') throw aiError(`Không kết nối được tới AI trên máy (${PROVIDERS.local.base}). Kiểm tra phần mềm (Ollama, LM Studio…) đang chạy, đúng địa chỉ và đã cho phép CORS.`, -1);
    throw aiError(`Không kết nối được tới ${PROVIDERS[provider].label}. Kiểm tra mạng hoặc dịch vụ có cho phép gọi từ trình duyệt không.`, -1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = aiError(httpError(res.status, provider, body), res.status);
    const ra = parseFloat(res.headers?.get?.('retry-after'));
    if (Number.isFinite(ra)) err.retryAfter = ra;
    throw err;
  }
  return res;
}

async function streamOpenAICompatible({ provider, apiKey, model, system = SYSTEM_PROMPT, messages, onText, signal, maxTokens = 16000, out = null, onQueue, effort = 'low', cacheHistory = false }) {
  const cfg = PROVIDERS[provider];
  // Groq: canh hạn mức token / yêu cầu mỗi phút, mỗi ngày (gói miễn phí rất chặt) — xem groq-quota.js.
  let settle = null;
  if (provider === 'groq') {
    model = model || cfg.defaultModel;
    const plan = planGroq({ system, messages, model, maxTokens: Math.min(maxTokens, 4096) });
    maxTokens = plan.maxTokens;
    await groqAdmit(plan.input + maxTokens, {
      model,
      signal,
      onWait: (sec) => {
        onQueue?.();
        hooks.event?.({ type: 'retry', provider, message: `chờ ${sec} giây cho đủ hạn mức token mỗi phút` });
      },
    });
    if (signal?.aborted) throw new Error('Đã dừng tạo nội dung.');
    onQueue?.();
    settle = groqReserve(plan.input + maxTokens, model);
    settle.input = plan.input;
  }
  let usage = 0;
  let res;
  try {
    res = await doFetch(
      `${cfg.base}/chat/completions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(apiKey && apiKey !== 'local' ? { authorization: `Bearer ${apiKey}` } : {}), ...(provider === 'openrouter' ? { 'X-Title': 'Tro Ly Van Ban AI' } : {}) },
        body: JSON.stringify(openAIBody({ provider, cfg, model: model || cfg.defaultModel, system, messages, maxTokens, effort, cacheHistory })),
      },
      provider,
      signal,
    );
  } catch (err) {
    // Bị từ chối (vd 429 hết hạn mức): không tính vào hạn mức phút; ngày vẫn ghi 1 yêu cầu.
    settle?.(0);
    throw err;
  }
  let text = '';
  try {
    await readSSE(res, (data) => {
      if (!data || data === '[DONE]') return;
      const j = JSON.parse(data);
      if (j.error) throw aiError(httpError(+j.error.code || +j.error.status || 500, provider, JSON.stringify(j.error)), +j.error.code || 500);
      if (j.choices?.[0]?.finish_reason === 'length' && out) out.truncated = true;
      const u = j.x_groq?.usage || j.usage;
      // Token đọc từ cache không tính vào hạn mức của Groq.
      if (u?.total_tokens) usage = { total: u.total_tokens, cached: u.prompt_tokens_details?.cached_tokens || 0 };
      const d = j.choices?.[0]?.delta?.content;
      if (d) {
        text += d;
        onText?.(d, text);
      }
    });
  } catch (err) {
    settle?.(settle.input + estTokens(text));
    if (err?.name === 'AbortError') throw new Error('Đã dừng tạo nội dung.');
    throw err;
  }
  if (settle) usage ? settle(Math.max(0, usage.total - usage.cached), usage.cached) : settle(settle.input + estTokens(text));
  return text;
}

/** Thân yêu cầu kiểu OpenAI: mức suy nghĩ cho mô hình suy luận, cache_control cho OpenRouter (Claude / Gemini). */
function openAIBody({ provider, cfg, model, system, messages, maxTokens, effort, cacheHistory }) {
  const cacheControl = provider === 'openrouter' && openRouterCacheControl(model);
  const sys = cacheControl && system ? [{ type: 'text', text: system, cache_control: EPHEMERAL }] : system;
  const body = { model, stream: true, max_tokens: Math.min(maxTokens, cfg.maxTokens || 16000), messages: [{ role: 'system', content: sys }, ...toOpenAI(messages, { cacheControl, cacheHistory })] };
  if (effort && isReasoningModel(provider, model)) {
    if (provider === 'openrouter') body.reasoning = { effort };
    else if (provider === 'groq' || provider === 'openai') body.reasoning_effort = effort;
  }
  if (provider === 'openrouter') body.usage = { include: true };
  return body;
}

async function streamGemini({ apiKey, model, system = SYSTEM_PROMPT, messages, onText, signal, maxTokens = 16000, out = null }) {
  const cfg = PROVIDERS.gemini;
  const contents = messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: toGeminiParts(m.content) }));
  const res = await doFetch(
    `${cfg.base}/models/${encodeURIComponent(model || cfg.defaultModel)}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: Math.min(maxTokens, 16000) } }),
    },
    'gemini',
    signal,
  );
  let text = '';
  try {
    await readSSE(res, (data) => {
      if (!data) return;
      const j = JSON.parse(data);
      if (j.error) throw aiError(httpError(+j.error.code || 500, 'gemini', JSON.stringify(j.error)), +j.error.code || 500);
      if (j.candidates?.[0]?.finishReason === 'MAX_TOKENS' && out) out.truncated = true;
      const d = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      if (d) {
        text += d;
        onText?.(d, text);
      }
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Đã dừng tạo nội dung.');
    throw err;
  }
  return text;
}

/** Kiểm tra nhanh API key bằng một yêu cầu rất ngắn. */
export async function testApiKey(apiKey, model, provider = 'anthropic') {
  if (provider !== 'anthropic') {
    await streamOnce({ provider, apiKey, model, system: 'Trả lời ngắn.', messages: [{ role: 'user', content: 'Chào' }], maxTokens: 16 });
    return true;
  }
  model = model || DEFAULT_MODEL;
  const Anthropic = await loadSdk();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    await client.messages.create({ model, max_tokens: 16, messages: [{ role: 'user', content: 'Chào' }] });
    return true;
  } catch (err) {
    throw new Error(friendlyError(err, Anthropic));
  }
}

/** Lấy danh sách mô hình khả dụng của tài khoản từ nhà cung cấp (dùng API key). */
export async function listModels(provider, apiKey) {
  const cfg = PROVIDERS[provider];
  let res;
  try {
    if (provider === 'anthropic') res = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } });
    else if (provider === 'gemini') res = await fetch(`${cfg.base}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } });
    else res = await fetch(`${cfg.base}/models`, { headers: apiKey && apiKey !== 'local' ? { authorization: `Bearer ${apiKey}` } : {} });
  } catch {
    if (provider === 'local') throw new Error(`Không kết nối được tới ${cfg.base}. Kiểm tra phần mềm AI trên máy đang chạy và đã cho phép CORS (Ollama: OLLAMA_ORIGINS=*; LM Studio: bật “Enable CORS”).`);
    throw new Error(`Không kết nối được tới ${cfg.label} để lấy danh sách mô hình.`);
  }
  if (!res.ok) throw new Error(httpError(res.status, provider, await res.text().catch(() => '')));
  const j = await res.json();
  let ids;
  if (provider === 'gemini') ids = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => String(m.name).replace(/^models\//, ''));
  else ids = (j.data || []).map((m) => m.id);
  if (provider === 'openai') ids = ids.filter((id) => /^(gpt|o\d|chatgpt)/.test(id) && !/(audio|realtime|transcribe|tts|image|search|embedding)/.test(id));
  if (provider === 'local') ids = ids.filter((id) => !/(embed|bge-|nomic-embed|rerank|whisper)/i.test(id));
  if (provider === 'groq') ids = (j.data || []).filter((m) => m.active !== false).map((m) => m.id).filter((id) => !/(whisper|tts|guard|playai|distil|orpheus)/i.test(id));
  return [...new Set(ids.filter(Boolean))].sort((a, b) => (provider === 'local' ? a.localeCompare(b) : b.localeCompare(a)));
}

/** Tìm khối JSON đầu tiên trong câu trả lời của mô hình. */
export function extractJson(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      try {
        return JSON.parse(s.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  // JSON bị cắt giữa chừng (AI chạm giới hạn độ dài): giữ các phần tử đã trọn vẹn.
  return repairJson(s.slice(start));
}

/** Cứu JSON bị cắt: cắt về phần tử trọn vẹn gần nhất rồi đóng các ngoặc còn mở. */
export function repairJson(s) {
  const safe = []; // [vị trí cắt, chuỗi ngoặc đóng cần thêm]
  const stack = [];
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    else if (ch === '}' || ch === ']') {
      stack.pop();
      safe.push([i + 1, stack.slice().reverse().join('')]);
      // Chỉ cắt giữa các phần tử của mảng hoặc các trường cấp ngoài cùng — không giữ một đối tượng thiếu trường.
    } else if (ch === ',' && (stack.at(-1) === ']' || stack.length === 1)) safe.push([i, stack.slice().reverse().join('')]);
  }
  for (let k = safe.length - 1, n = 0; k >= 0 && n < 400; k--, n++) {
    const [pos, close] = safe[k];
    try {
      const v = JSON.parse(s.slice(0, pos) + close);
      if (v && typeof v === 'object') return v;
    } catch {}
  }
  return null;
}

export function composePrompt(typeId, brief, values = {}) {
  const type = getDocType(typeId);
  const extra = {
    'quyet-dinh': 'Trường "noiDung": mỗi dòng là nội dung một Điều (không ghi chữ "Điều 1."), thường 3 điều; điều cuối quy định hiệu lực và trách nhiệm thi hành. Thêm trường "canCu": mảng các căn cứ pháp lý chung, không bịa số hiệu cụ thể nếu không chắc chắn.',
    'bien-ban': 'Trường "noiDung": diễn biến cuộc họp theo các ý đánh số 1., 2., 3., có phần kết luận.',
    'giay-moi': 'Trường "noiDung": một câu nêu nội dung cuộc họp/sự kiện.',
    'ke-hoach': 'Trường "noiDung": gồm các phần I. MỤC ĐÍCH, YÊU CẦU; II. NỘI DUNG; III. TỔ CHỨC THỰC HIỆN.',
    'bao-cao': 'Trường "noiDung": gồm I. KẾT QUẢ ĐẠT ĐƯỢC; II. TỒN TẠI, HẠN CHẾ; III. PHƯƠNG HƯỚNG, NHIỆM VỤ.',
  }[typeId] || 'Trường "noiDung": các đoạn văn phân tách bằng xuống dòng; có thể dùng đề mục I., 1. khi phù hợp.';
  return `Soạn phần nội dung cho một ${type.name.toLowerCase()} của cơ quan "${values.coQuan || '[cơ quan]'}".
Yêu cầu của người dùng: ${brief}

Chỉ trả về đúng một đối tượng JSON, không kèm giải thích, dạng:
{"trichYeu": "trích yếu ngắn gọn, không có tiền tố V/v hay Về việc", "noiDung": "..."}
${extra}
Không lặp lại phần quốc hiệu, tiêu ngữ, chữ ký, nơi nhận.`;
}

/* ---------------- Trợ lý mẫu (offline) ---------------- */

const cap = (s) => (s ? s.charAt(0).toLocaleUpperCase('vi-VN') + s.slice(1) : s);
const lowerOrg = (org) => {
  const s = String(org || '').trim();
  return s ? s.charAt(0) + s.slice(1).toLocaleLowerCase('vi-VN') : 'Cơ quan';
};

/** Soạn nội dung mẫu dựa trên mô tả ngắn — dùng khi chưa có API key. */
export function localCompose(typeId, brief, values = {}) {
  const b = String(brief || '').trim().replace(/[.。]+$/, '');
  const topic = b.replace(/^(soạn|viết|lập|làm|tạo)\s+(một\s+)?(công văn|quyết định|tờ trình|báo cáo|thông báo|kế hoạch|giấy mời|biên bản)\s*(về việc|về|v\/v)?\s*/i, '') || b;
  const org = lowerOrg(values.coQuan);
  const trichYeu = topic.length > 110 ? topic.slice(0, 107) + '…' : topic;

  const T = {
    'cong-van': `Căn cứ chức năng, nhiệm vụ được giao và tình hình thực tế tại đơn vị, ${org} trân trọng đề nghị Quý cơ quan quan tâm, phối hợp giải quyết nội dung liên quan đến việc ${topic}, cụ thể như sau:
1. Rà soát, tổng hợp các thông tin, số liệu có liên quan đến nội dung nêu trên.
2. Phối hợp cung cấp hồ sơ, tài liệu và cử cán bộ đầu mối để trao đổi, thống nhất phương án thực hiện.
3. Gửi văn bản phản hồi về ${org} trước ngày [...] để tổng hợp, báo cáo cấp có thẩm quyền.
${org} rất mong nhận được sự quan tâm, phối hợp của Quý cơ quan.`,
    'quyet-dinh': `${cap(topic)}.
Giao [đơn vị/cá nhân] chủ trì, phối hợp với các đơn vị có liên quan tổ chức triển khai thực hiện theo đúng quy định.
Quyết định này có hiệu lực kể từ ngày ký. Chánh Văn phòng, Thủ trưởng các đơn vị và cá nhân có liên quan chịu trách nhiệm thi hành Quyết định này.`,
    'to-trinh': `I. SỰ CẦN THIẾT
Xuất phát từ yêu cầu thực tiễn công tác, việc ${topic} là cần thiết nhằm nâng cao hiệu quả hoạt động của đơn vị và đáp ứng yêu cầu nhiệm vụ được giao.
II. NỘI DUNG ĐỀ XUẤT
1. Phạm vi, quy mô: [...].
2. Kinh phí dự kiến: [...] đồng, từ nguồn [...].
3. Thời gian thực hiện: [...].
III. KIẾN NGHỊ
${org} kính trình cấp có thẩm quyền xem xét, phê duyệt.`,
    'bao-cao': `Thực hiện yêu cầu của cấp trên, ${org} báo cáo ${topic} như sau:
I. KẾT QUẢ ĐẠT ĐƯỢC
1. Công tác chỉ đạo, điều hành được triển khai kịp thời, bám sát kế hoạch đề ra.
2. Các chỉ tiêu chủ yếu cơ bản hoàn thành; kết quả cụ thể: [...].
II. TỒN TẠI, HẠN CHẾ VÀ NGUYÊN NHÂN
Một số nhiệm vụ còn chậm tiến độ do [...].
III. PHƯƠNG HƯỚNG, NHIỆM VỤ THỜI GIAN TỚI
Tiếp tục tập trung chỉ đạo, khắc phục hạn chế, phấn đấu hoàn thành toàn diện các chỉ tiêu được giao.`,
    'thong-bao': `${org} thông báo về việc ${topic} như sau:
1. Nội dung: [...].
2. Thời gian, địa điểm thực hiện: [...].
3. Đối tượng áp dụng: các cơ quan, đơn vị, cá nhân có liên quan.
${org} thông báo để các cơ quan, đơn vị, cá nhân biết, thực hiện.`,
    'ke-hoach': `I. MỤC ĐÍCH, YÊU CẦU
1. Mục đích: Tổ chức thực hiện hiệu quả việc ${topic}.
2. Yêu cầu: Bảo đảm thiết thực, đúng tiến độ, phân công rõ người, rõ việc, rõ trách nhiệm.
II. NỘI DUNG, THỜI GIAN THỰC HIỆN
1. Nội dung 1: [...]; thời gian: [...].
2. Nội dung 2: [...]; thời gian: [...].
III. KINH PHÍ
Từ nguồn ngân sách được giao năm [...] và các nguồn hợp pháp khác.
IV. TỔ CHỨC THỰC HIỆN
Giao [đơn vị] chủ trì, phối hợp với các đơn vị liên quan triển khai; định kỳ báo cáo kết quả về ${org}.`,
    'giay-moi': `${cap(topic)}.`,
    'bien-ban': `1. Chủ trì cuộc họp quán triệt mục đích, yêu cầu về việc ${topic}.
2. Các thành viên dự họp thảo luận, đóng góp ý kiến: [...].
3. Kết luận: Thống nhất triển khai thực hiện; giao [đơn vị/cá nhân] tổng hợp, theo dõi và báo cáo kết quả.`,
  };
  const out = { trichYeu, noiDung: T[typeId] || T['cong-van'] };
  if (typeId === 'quyet-dinh') out.canCu = ['Căn cứ chức năng, nhiệm vụ, quyền hạn của cơ quan', 'Căn cứ [văn bản quy phạm pháp luật liên quan]'];
  return out;
}

const KNOWLEDGE = [
  {
    re: /(phông|font|cỡ chữ|kiểu chữ)/i,
    a: '**Phông chữ theo NĐ 30/2020/NĐ-CP:** dùng phông Times New Roman (bộ mã Unicode TCVN 6909:2001), màu đen.\n- Nội dung văn bản: cỡ chữ **13–14**.\n- Quốc hiệu: in hoa, đứng, đậm, cỡ 12–13; Tiêu ngữ: in thường, đậm, cỡ 13–14.\n- Tên loại văn bản: in hoa, đứng, đậm, cỡ 13–14.\n- Nơi nhận: chữ “Nơi nhận” cỡ 12 nghiêng đậm; danh sách cỡ 11.',
  },
  {
    re: /(lề|căn lề|khổ giấy|a4)/i,
    a: '**Khổ giấy và lề trang:** khổ A4 (210 × 297 mm), trình bày theo chiều dài.\n- Lề trên, lề dưới: 20–25 mm.\n- Lề trái: 30–35 mm.\n- Lề phải: 15–20 mm.\n- Số trang: giữa lề trên, cỡ 13–14, không hiển thị ở trang thứ nhất.',
  },
  {
    re: /(ngày tháng|số 0|thêm số 0|ghi ngày)/i,
    a: '**Ghi ngày tháng:** “Địa danh, ngày … tháng … năm …”. Với ngày nhỏ hơn 10 và tháng 1, 2 phải ghi thêm số 0 phía trước, ví dụ: *Hà Nội, ngày 05 tháng 02 năm 2026*. Phần này in nghiêng, cỡ 13–14, đặt dưới Quốc hiệu và Tiêu ngữ.',
  },
  {
    re: /(viết tắt|tm\.|kt\.|ký thay|thay mặt|thẩm quyền ký)/i,
    a: '**Quyền hạn ký:**\n- **TM.** (thay mặt): ký thay mặt tập thể lãnh đạo (VD: TM. ỦY BAN NHÂN DÂN).\n- **KT.** (ký thay): cấp phó ký thay cấp trưởng.\n- **Q.** (quyền): quyền cấp trưởng ký.\n- **TL.** (thừa lệnh): ký thừa lệnh người đứng đầu.\n- **TUQ.** (thừa ủy quyền): ký thừa ủy quyền.',
  },
  {
    re: /(nghị định 30|nđ 30|thể thức|thành phần)/i,
    a: '**Thể thức văn bản hành chính (NĐ 30/2020/NĐ-CP)** gồm 9 thành phần chính: (1) Quốc hiệu và Tiêu ngữ; (2) Tên cơ quan ban hành; (3) Số, ký hiệu; (4) Địa danh và thời gian ban hành; (5) Tên loại và trích yếu nội dung; (6) Nội dung; (7) Chức vụ, họ tên, chữ ký người có thẩm quyền; (8) Dấu, chữ ký số của cơ quan; (9) Nơi nhận. Trợ Lý Văn Bản tự động trình bày đúng các thành phần này.',
  },
];

/** Trả lời cục bộ cho khung trò chuyện. Trả về { text, action? }. */
export function localChat(message) {
  const msg = String(message || '').trim();
  const lower = msg.toLocaleLowerCase('vi-VN');
  const afterColon = msg.includes(':') ? msg.slice(msg.indexOf(':') + 1).trim() : '';

  if (!msg) return { text: 'Bạn cần hỗ trợ gì hôm nay?' };

  // Đọc số tiền
  const numMatch = msg.match(/-?\d[\d.,\s]*\d|\d/);
  if (numMatch && /(bằng chữ|thành chữ|đọc số|đọc tiền|viết số)/i.test(lower)) {
    const raw = numMatch[0].replace(/\s/g, '');
    if (parseNumberInput(raw)) return { text: `**${formatNumberVi(raw)}** viết bằng chữ là:\n\n> ${moneyToWords(raw)}`, action: { tool: 'number', input: raw } };
  }

  // Tóm tắt
  if (/tóm tắt/i.test(lower)) {
    if (afterColon.length > 80) {
      const r = summarize(afterColon, { ratio: 0.35, maxSentences: 5 });
      return { text: `**Tóm tắt:**\n${r.sentences.map((s) => `- ${s}`).join('\n')}\n\n**Từ khóa:** ${r.keywords.join(', ') || '—'}` };
    }
    return { text: 'Hãy dán văn bản cần tóm tắt sau dấu hai chấm, ví dụ: *Tóm tắt: [nội dung văn bản]*. Hoặc dùng công cụ **Tóm tắt** ở thanh bên để tải lên tệp .docx/.txt.', action: { tool: 'summary' } };
  }

  // Chính tả
  if (/(chính tả|soát lỗi|kiểm tra lỗi|sửa lỗi)/i.test(lower)) {
    if (afterColon.length > 5) {
      const issues = checkText(afterColon);
      if (!issues.length) return { text: '✅ Không phát hiện lỗi chính tả, dấu câu hay thể thức nào.' };
      const list = issues.slice(0, 10).map((i) => `- **${ISSUE_LABELS[i.type]}:** ${i.message}${i.suggestion != null ? ` → “${i.suggestion.trim() || '␣'}”` : ''}`);
      return { text: `Phát hiện **${issues.length}** vấn đề:\n${list.join('\n')}\n\n**Bản đã sửa:**\n> ${fixAll(afterColon)}` };
    }
    return { text: 'Dán đoạn văn cần kiểm tra sau dấu hai chấm, ví dụ: *Kiểm tra chính tả: …*. Hoặc mở công cụ **Kiểm tra chính tả**.', action: { tool: 'spell' } };
  }

  // Soạn văn bản
  const type = DOC_TYPES.find((t) => lower.includes(t.name.toLocaleLowerCase('vi-VN')));
  if (type && /(soạn|viết|lập|làm|tạo|mẫu)/i.test(lower)) {
    const draft = localCompose(type.id, msg);
    return {
      text: `Tôi đã soạn bản nháp **${type.name}** với trích yếu: *${draft.trichYeu}*.\n\n${draft.noiDung}\n\nNhấn **Mở trong trình soạn thảo** để hoàn thiện thể thức, xem trước trang A4 và xuất file Word.`,
      action: { tool: 'compose', typeId: type.id, draft },
    };
  }

  for (const k of KNOWLEDGE) if (k.re.test(lower)) return { text: k.a };

  if (/^(xin )?chào|^hello|^hi\b/i.test(lower)) {
    return { text: 'Xin chào! Tôi là **Trợ Lý Văn Bản**. Tôi có thể giúp bạn:\n- Soạn công văn, quyết định, tờ trình, báo cáo… đúng thể thức NĐ 30/2020\n- Tóm tắt văn bản dài\n- Kiểm tra chính tả, dấu câu\n- Đọc số tiền thành chữ\n\nHãy thử: *Soạn công văn về việc tổ chức tập huấn chuyển đổi số*.' };
  }

  return {
    text: 'Ở **chế độ cơ bản** (chưa kết nối AI), tôi hỗ trợ các yêu cầu như:\n- *Soạn tờ trình về việc mua sắm thiết bị*\n- *Tóm tắt: [văn bản]*\n- *Kiểm tra chính tả: [đoạn văn]*\n- *Đọc số 1.250.000 thành chữ*\n- Hỏi về thể thức: phông chữ, căn lề, ký thay…\n\nĐể trò chuyện tự do và soạn thảo thông minh hơn, hãy thêm **API key Claude** trong mục Cài đặt.',
  };
}
