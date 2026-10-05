// Lớp AI: dùng Claude (Anthropic) khi người dùng cấu hình API key, ngược lại dùng
// "Trợ lý mẫu" chạy cục bộ dựa trên quy tắc — bảo đảm mọi tính năng luôn sử dụng được.

import { moneyToWords, formatNumberVi, parseNumberInput } from './number-words.js';
import { summarize } from './summarize.js';
import { checkText, fixAll, ISSUE_LABELS } from './spellcheck.js';
import { DOC_TYPES, getDocType } from './doc-types.js';

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — chất lượng cao nhất' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — nhanh, tiết kiệm' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — siêu tốc' },
];
export const DEFAULT_MODEL = 'claude-opus-5-5';

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
export async function streamClaude({ apiKey, model = DEFAULT_MODEL, system = SYSTEM_PROMPT, messages, onText, signal, maxTokens = 16000 }) {
  const Anthropic = await loadSdk();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const params = { model, max_tokens: maxTokens, system, messages };
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
    if (final.stop_reason === 'max_tokens') text += '\n\n[Nội dung đã đạt giới hạn độ dài.]';
    return text;
  } catch (err) {
    throw new Error(friendlyError(err, Anthropic));
  }
}

/** Kiểm tra nhanh API key bằng một yêu cầu rất ngắn. */
export async function testApiKey(apiKey, model = DEFAULT_MODEL) {
  const Anthropic = await loadSdk();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    await client.messages.create({ model, max_tokens: 16, messages: [{ role: 'user', content: 'Chào' }] });
    return true;
  } catch (err) {
    throw new Error(friendlyError(err, Anthropic));
  }
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
