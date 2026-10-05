// Trợ lý phân tích lời khai: gợi ý câu hỏi truy tiếp, phát hiện mâu thuẫn, đánh giá mức độ làm rõ, chuẩn hóa văn phong.
// Dùng Claude khi có API key; nếu không, dùng bộ phân tích cục bộ theo quy tắc nghiệp vụ.
import { streamClaude, extractJson } from '../lib/ai.js';
import { fixAll } from '../lib/spellcheck.js';
import { qaToText } from './record.js';

export const INVESTIGATOR_SYSTEM = `Bạn là chuyên gia cấp cao kiêm điều tra viên cao cấp của Cơ quan điều tra Công an nhân dân Việt Nam, am hiểu Bộ luật Hình sự 2015 (sửa đổi 2017, 2025), Bộ luật Tố tụng hình sự 2015 và kiến thức chuyên ngành kinh tế, tài chính, đấu thầu, xây dựng, môi trường, y tế.
Nguyên tắc:
- Câu hỏi khách quan, không mớm cung, không gợi ý câu trả lời, không truy bức; tôn trọng quyền không buộc phải khai chống lại chính mình.
- Bám sát cấu thành tội phạm của điều luật và các vấn đề phải chứng minh theo Điều 85 BLTTHS.
- Thu thập cả chứng cứ buộc tội và gỡ tội.
- Viết tiếng Việt chuẩn mực, văn phong nghiệp vụ, ngắn gọn.
- Không bịa đặt sự kiện ngoài nội dung lời khai được cung cấp.`;

function context(rec, crime) {
  const issues = (rec.plan?.issues || []).map((i) => `- [${i.id}] ${i.tieuDe}`).join('\n');
  return `Tội danh: ${crime ? `Điều ${crime.dieu} BLHS — ${crime.ten}` : 'chưa xác định'}
Tư cách người khai: ${rec.roleId}
Các vấn đề cần làm rõ:
${issues || '(chưa có kế hoạch)'}

NỘI DUNG LỜI KHAI ĐÃ GHI:
${qaToText(rec) || '(chưa có)'}`;
}

async function askJson({ provider, apiKey, model, prompt, signal }) {
  const out = await streamClaude({ provider, apiKey, model, system: INVESTIGATOR_SYSTEM, signal, messages: [{ role: 'user', content: prompt }] });
  const json = extractJson(out);
  if (!json) throw new Error('Không đọc được kết quả phân tích từ AI');
  return json;
}

/* ---------------- Claude ---------------- */

export async function aiSuggest({ provider, apiKey, model, rec, crime, signal }) {
  const j = await askJson({
    provider,
    apiKey,
    model,
    signal,
    prompt: `${context(rec, crime)}

Dựa trên câu trả lời gần nhất và toàn bộ lời khai, đề xuất 5–8 câu hỏi truy tiếp để đào sâu, làm rõ chi tiết còn mơ hồ, kiểm tra tính xác thực và lấp các vấn đề chưa được làm rõ.
Chỉ trả về JSON: {"cauHoi": [{"text": "câu hỏi", "lyDo": "vì sao cần hỏi", "issueId": "id vấn đề liên quan hoặc null"}]}`,
  });
  return (j.cauHoi || []).filter((x) => x?.text);
}

export async function aiContradictions({ provider, apiKey, model, rec, crime, others = [], signal }) {
  const prev = others.length ? `\n\nCÁC LỜI KHAI KHÁC TRONG HỒ SƠ (để đối chiếu):\n${others.map((o, i) => `--- Biên bản ${i + 1} (${o.nguoiKhai?.hoTen || 'không rõ'}):\n${qaToText(o)}`).join('\n')}` : '';
  const j = await askJson({
    provider,
    apiKey,
    model,
    signal,
    prompt: `${context(rec, crime)}${prev}

Phát hiện các mâu thuẫn, bất hợp lý, thiếu logic trong lời khai (về thời gian, địa điểm, số tiền, người tham gia, diễn biến) và giữa lời khai này với các lời khai khác (nếu có).
Chỉ trả về JSON: {"mauThuan": [{"moTa": "mô tả mâu thuẫn", "trichDan": ["trích dẫn ngắn kèm số câu [n]"], "mucDo": "cao|trung-binh|thap", "cauHoiLamRo": "câu hỏi để làm rõ"}]}. Nếu không có, trả về {"mauThuan": []}.`,
  });
  return j.mauThuan || [];
}

export async function aiCoverage({ provider, apiKey, model, rec, crime, signal }) {
  const j = await askJson({
    provider,
    apiKey,
    model,
    signal,
    prompt: `${context(rec, crime)}

Đánh giá từng vấn đề cần làm rõ đã được lời khai làm rõ đến mức nào.
Chỉ trả về JSON: {"tongQuan": "nhận xét chung 2-3 câu", "danhGia": [{"issueId": "id", "mucDo": "ro|mot-phan|chua", "nhanXet": "ngắn gọn", "conThieu": "nội dung còn thiếu"}]}`,
  });
  return { tongQuan: j.tongQuan || '', danhGia: j.danhGia || [] };
}

export async function aiNormalize({ provider, apiKey, model, question, answer, signal }) {
  const out = await streamClaude({
    provider,
    apiKey,
    model,
    system: INVESTIGATOR_SYSTEM,
    signal,
    messages: [{ role: 'user', content: `Chuẩn hóa câu trả lời dưới đây thành lời văn biên bản: ngôi thứ nhất (“Tôi…”), câu đầy đủ, đúng chính tả, dấu câu. Giữ nguyên tuyệt đối ý, số liệu, tên riêng, mức độ chắc chắn của người khai; không thêm thông tin. Chỉ trả về đoạn văn đã chuẩn hóa.\n\nCâu hỏi: ${question}\nCâu trả lời ghi nhanh: ${answer}` }],
  });
  return out.trim();
}

/* ---------------- Phân tích cục bộ ---------------- */

const MONEY_RE = /(\d[\d.,]*)\s*(tỷ|tỉ|triệu|nghìn|ngàn|đồng|usd|đô)/gi;
const DATE_RE = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b|ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})(?:\s+năm\s+(\d{4}))?/gi;
const NAME_RE = /(?<![\p{L}])(?:ông|bà|anh|chị|em|cô|chú|bác|giám đốc|chủ tịch|trưởng phòng|phó giám đốc|kế toán|thủ quỹ)\s+((?:[A-ZÀ-ỸĐ][\p{Ll}]+\s?){1,4})/gu;
const VAGUE_RE = /(không nhớ|không rõ|không biết|quên|khoảng|chắc là|hình như|có lẽ|đâu đó|không để ý|không chắc)/i;

function moneyValue(num, unit) {
  const n = parseFloat(String(num).replace(/\./g, '').replace(',', '.')) || 0;
  const u = unit.toLowerCase();
  return n * ({ tỷ: 1e9, tỉ: 1e9, triệu: 1e6, nghìn: 1e3, ngàn: 1e3, đồng: 1, usd: 25000, đô: 25000 }[u] || 1);
}

export function extractFacts(text) {
  const s = String(text || '');
  const money = [...s.matchAll(MONEY_RE)].map((m) => ({ raw: m[0], value: moneyValue(m[1], m[2]) }));
  const dates = [...s.matchAll(DATE_RE)].map((m) => m[0]);
  const names = [...new Set([...s.matchAll(NAME_RE)].map((m) => m[1].trim()))];
  return { money, dates, names, vague: VAGUE_RE.test(s) };
}

/** Gợi ý câu hỏi truy tiếp từ câu trả lời gần nhất. */
export function localSuggest(rec) {
  const answered = (rec.qa || []).filter((x) => String(x.a || '').trim());
  const last = answered.at(-1);
  const out = [];
  if (last) {
    const f = extractFacts(last.a);
    f.money.forEach((m) => out.push({ text: `Khoản tiền ${m.raw} được giao nhận cụ thể vào thời gian nào, ở đâu, bằng hình thức gì (tiền mặt hay chuyển khoản), có ai chứng kiến?`, lyDo: 'Làm rõ chi tiết giao nhận tiền vừa được khai.' }));
    f.names.forEach((n) => out.push({ text: `${n} có vai trò gì trong sự việc; anh/chị biết ${n} từ khi nào, quan hệ thế nào?`, lyDo: `Người khai nhắc đến ${n}.` }));
    f.dates.forEach((d) => out.push({ text: `Căn cứ vào đâu anh/chị nhớ chính xác thời điểm ${d}? Có tài liệu, sự kiện nào gắn với thời điểm đó không?`, lyDo: 'Kiểm tra tính xác thực của mốc thời gian.' }));
    if (f.vague) out.push({ text: 'Anh/chị trình bày cụ thể hơn: những chi tiết nào anh/chị nhớ chắc chắn, chi tiết nào không nhớ rõ và vì sao?', lyDo: 'Câu trả lời có biểu hiện mơ hồ, né tránh.' });
    if (String(last.a).trim().length < 40) out.push({ text: 'Đề nghị anh/chị trình bày chi tiết hơn về nội dung vừa khai.', lyDo: 'Câu trả lời quá ngắn.' });
  }
  // Câu hỏi quan trọng trong kế hoạch chưa được hỏi.
  const askedTexts = new Set((rec.qa || []).map((x) => x.q));
  for (const is of rec.plan?.issues || []) {
    const next = is.cauHoi.find((c) => c.priority === 'high' && !askedTexts.has(c.text));
    if (next && (rec.coverage?.[is.id] || 'chua') !== 'ro') out.push({ text: next.text, lyDo: `Chưa làm rõ: ${is.tieuDe}`, issueId: is.id });
    if (out.length >= 8) break;
  }
  return out.slice(0, 8);
}

/** Phát hiện mâu thuẫn đơn giản: cùng loại sự kiện nhưng số tiền/ngày khác nhau; phủ nhận điều đã khai. */
export function localContradictions(rec, others = []) {
  const items = [];
  const all = [...(rec.qa || []).map((x, i) => ({ ...x, n: i + 1, src: 'Biên bản này' })), ...others.flatMap((o) => (o.qa || []).map((x, i) => ({ ...x, n: i + 1, src: `Lời khai ${o.nguoiKhai?.hoTen || 'khác'}` })))];
  const verbs = ['nhận', 'đưa', 'chuyển', 'chi', 'trả', 'vay', 'cho'];
  for (const v of verbs) {
    const hits = [];
    all.forEach((x) => {
      String(x.a || '')
        .split(/[.;\n]/)
        .filter((sent) => new RegExp(`(^|\\s)${v}(\\s|$)`, 'i').test(sent))
        .forEach((sent) => extractFacts(sent).money.forEach((m) => hits.push({ ...m, n: x.n, src: x.src, sent: sent.trim() })));
    });
    const distinct = [...new Map(hits.map((h) => [h.value, h])).values()];
    if (distinct.length > 1) {
      items.push({
        moTa: `Số tiền liên quan đến việc “${v}” được khai không thống nhất: ${distinct.map((d) => d.raw).join(' / ')}.`,
        trichDan: distinct.map((d) => `${d.src} [${d.n}]: “${d.sent.slice(0, 90)}”`),
        mucDo: 'cao',
        cauHoiLamRo: `Tại sao số tiền ${v} được khai khác nhau (${distinct.map((d) => d.raw).join(', ')})? Đề nghị trình bày chính xác số tiền và giải thích sự khác biệt.`,
      });
    }
  }
  // Phủ nhận sau khi đã thừa nhận.
  const own = rec.qa || [];
  own.forEach((x, i) => {
    if (/(không hề|chưa từng|không có việc|không nhận|không biết)/i.test(x.a || '')) {
      const key = (x.q || '').split(/\s+/).filter((w) => w.length > 3).slice(0, 4);
      const earlier = own.slice(0, i).find((y) => key.some((k) => (y.a || '').toLowerCase().includes(k.toLowerCase())) && /(có|đã)\s/i.test(y.a || '') && !/(không|chưa)/i.test(y.a || ''));
      if (earlier) items.push({ moTa: 'Có dấu hiệu phủ nhận nội dung đã khai trước đó.', trichDan: [`[${own.indexOf(earlier) + 1}]: “${String(earlier.a).slice(0, 90)}”`, `[${i + 1}]: “${String(x.a).slice(0, 90)}”`], mucDo: 'trung-binh', cauHoiLamRo: 'Hai nội dung khai này khác nhau, anh/chị giải thích lý do và khẳng định nội dung nào đúng?' });
    }
  });
  return items;
}

/** Đánh giá mức độ làm rõ dựa trên câu hỏi trong kế hoạch đã được trả lời. */
export function localCoverage(rec) {
  const danhGia = (rec.plan?.issues || []).map((is) => {
    const qs = (rec.qa || []).filter((x) => x.issueId === is.id);
    const good = qs.filter((x) => String(x.a || '').trim().length >= 25 && !VAGUE_RE.test(x.a));
    const any = qs.filter((x) => String(x.a || '').trim());
    const mucDo = good.length >= Math.min(2, is.cauHoi.length) ? 'ro' : any.length ? 'mot-phan' : 'chua';
    return { issueId: is.id, mucDo, nhanXet: `${any.length}/${is.cauHoi.length} câu đã có trả lời`, conThieu: mucDo === 'ro' ? '' : 'Cần hỏi thêm các câu ưu tiên chưa hỏi hoặc câu trả lời còn mơ hồ.' };
  });
  const done = danhGia.filter((d) => d.mucDo === 'ro').length;
  return { tongQuan: `Đã làm rõ ${done}/${danhGia.length} vấn đề (đánh giá sơ bộ theo số câu trả lời).`, danhGia };
}

/** Chuẩn hóa cục bộ: chính tả, dấu câu, viết hoa, chuyển “em/cháu” đầu câu thành “Tôi”. */
export function localNormalize(answer) {
  let s = String(answer || '').trim().replace(/\s+/g, ' ');
  if (!s) return s;
  s = s.replace(/(^|[.!?]\s+)(em|cháu|con|mình|tui|tao)\s/gi, (m, p) => `${p}Tôi `);
  s = fixAll(s);
  s = s.charAt(0).toLocaleUpperCase('vi-VN') + s.slice(1);
  if (!/[.!?…]$/.test(s)) s += '.';
  return s;
}
