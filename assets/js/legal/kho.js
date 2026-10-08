// Kho hồ sơ: nhận diện loại tài liệu, trích thông tin người khai, lời khai Hỏi – Đáp,
// chia đoạn và tìm kiếm cục bộ (không cần mạng) để làm dữ liệu cho hỏi đáp AI và tạo văn bản.
import { parsePastedQa, PERSON_FIELDS } from './record.js';
import { focusText } from '../lib/ai-chunk.js';
import { localContradictions } from './assist.js';
import { localFollowUps } from './engine.js';

export const LOAI_TL = {
  bblk: 'Biên bản ghi lời khai',
  'hoi-cung': 'Biên bản hỏi cung',
  'doi-chat': 'Biên bản đối chất',
  'bb-khac': 'Biên bản khác',
  qd: 'Quyết định',
  lenh: 'Lệnh',
  'kl-giam-dinh': 'Kết luận giám định',
  'kl-dinh-gia': 'Kết luận định giá',
  'kl-dieu-tra': 'Kết luận điều tra',
  'cao-trang': 'Cáo trạng',
  'ban-an': 'Bản án',
  don: 'Đơn, tố giác',
  'bao-cao': 'Báo cáo',
  tb: 'Thông báo',
  khac: 'Tài liệu khác',
};

const RULES = [
  ['hoi-cung', /BIÊN BẢN\s+HỎI CUNG/],
  ['bblk', /BIÊN BẢN\s+(GHI\s+)?LỜI KHAI|BIÊN BẢN LẤY LỜI KHAI/],
  ['doi-chat', /BIÊN BẢN\s+ĐỐI CHẤT/],
  ['kl-giam-dinh', /KẾT LUẬN GIÁM ĐỊNH/],
  ['kl-dinh-gia', /KẾT LUẬN ĐỊNH GIÁ/],
  ['kl-dieu-tra', /KẾT LUẬN ĐIỀU TRA/],
  ['cao-trang', /^CÁO TRẠNG/m],
  ['ban-an', /^BẢN ÁN/m],
  ['bb-khac', /^BIÊN BẢN/m],
  ['lenh', /^LỆNH\b/m],
  ['qd', /^QUYẾT ĐỊNH\b/m],
  ['don', /^ĐƠN\b/m],
  ['tb', /^THÔNG BÁO\b/m],
  ['bao-cao', /^BÁO CÁO\b/m],
];

const first = (re, text) => re.exec(text)?.[1]?.replace(/\s+/g, ' ').trim() || '';

/** Vai trò tố tụng từ dòng “Tư cách tham gia tố tụng: …”. */
export function roleFromText(s, loai = '') {
  const t = String(s || '').toLowerCase();
  if (loai === 'hoi-cung' || /bị can/.test(t)) return 'bi-can';
  if (/bị tố giác|kiến nghị khởi tố/.test(t)) return 'bi-to-giac';
  if (/tạm giữ|bị bắt|giữ trong trường hợp khẩn cấp/.test(t)) return 'tam-giu';
  if (/làm chứng/.test(t)) return 'lam-chung';
  if (/bị hại/.test(t)) return 'bi-hai';
  if (/tố giác|báo tin/.test(t)) return 'to-giac';
  if (/quyền lợi|nghĩa vụ liên quan/.test(t)) return 'lien-quan';
  return '';
}

/** Phân tích nội dung tài liệu. */
export function analyzeDoc(text) {
  const t = String(text || '');
  const head = t.split('\n').slice(0, 60).join('\n').toLocaleUpperCase('vi-VN');
  const loai = RULES.find(([, re]) => re.test(head))?.[0] || 'khac';
  const titleLine = t.split('\n').map((l) => l.trim()).find((l) => /^(BIÊN BẢN|QUYẾT ĐỊNH|LỆNH|KẾT LUẬN|CÁO TRẠNG|BẢN ÁN|ĐƠN|THÔNG BÁO|BÁO CÁO)/i.test(l) && l === l.toLocaleUpperCase('vi-VN')) || '';
  const d = /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i.exec(t);
  const nguoi = {
    hoTen: first(/Họ (?:và )?tên\s*:\s*([^\t;,\n]+?)(?=\s{2,}|\t|;|,|\n|Giới tính|$)/i, t),
    gioiTinh: first(/Giới tính\s*:\s*([^;,.\n]+)/i, t),
    tenGoiKhac: first(/Tên gọi khác\s*:\s*([^;\n]+)/i, t),
    ngaySinh: first(/Sinh ngày\s*:?\s*([\d/.\s]+(?:tháng\s+\d+\s+năm\s+\d{4})?)/i, t),
    noiSinh: first(/Sinh ngày[^\n]*?\btại\s+([^;\n]+)/i, t),
    quocTich: first(/Quốc tịch\s*:\s*([^;,\n]+)/i, t),
    danToc: first(/Dân tộc\s*:\s*([^;,\n]+)/i, t),
    tonGiao: first(/Tôn giáo\s*:\s*([^;,\n]+)/i, t),
    ngheNghiep: first(/Nghề nghiệp(?:,? chức vụ)?\s*:\s*([^;\n]+)/i, t),
    soDinhDanh: first(/(?:Thẻ CCCD|CCCD|Căn cước(?: công dân)?|định danh cá nhân|CMND)[^:\n]*:\s*([0-9]{9,12})/i, t),
    ngayCap: first(/cấp ngày\s*:?\s*([\d/.]+)/i, t),
    noiCap: first(/Nơi cấp\s*:\s*([^;\n]+)/i, t),
    noiCuTru: first(/(?:Nơi thường trú|Nơi cư trú|HKTT)\s*:\s*([^;\n]+)/i, t),
    noiOHienTai: first(/Nơi ở hiện (?:tại|nay)\s*:\s*([^;\n]+)/i, t),
    soDienThoai: first(/(?:Số điện thoại|Điện thoại|SĐT)[^:\n]*:\s*([0-9 .]{9,14})/i, t).replace(/[ .]/g, ''),
  };
  for (const k of Object.keys(nguoi)) nguoi[k] = nguoi[k].replace(/[.;,]+$/, '').trim();
  const tuCach = first(/Tư cách tham gia tố tụng\s*:\s*([^.\n]+)/i, t);
  const isStatement = ['bblk', 'hoi-cung', 'doi-chat'].includes(loai);
  const qa = isStatement ? parsePastedQa(t).pairs.filter((p) => p.q && p.a) : [];
  return {
    loai,
    tieuDe: titleLine.replace(/\s*\(\s*\d*\s*\)\s*$/, '').trim(),
    ngay: d ? `${d[1].padStart(2, '0')}/${d[2].padStart(2, '0')}/${d[3]}` : '',
    nguoi,
    tuCach,
    roleId: roleFromText(tuCach, loai),
    qa,
  };
}

/* ---------------- Chia đoạn và tìm kiếm ---------------- */
export const normVi = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
const STOP = new Set('va la cua co cac nhung mot cho voi duoc trong khi thi de nay do ve tai tu den theo nhu hay hoac anh chi ong ba toi gi nao the'.split(' '));
export const tokens = (s) =>
  normVi(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));

/** Chia văn bản thành các đoạn ~size ký tự, giữ ranh giới đoạn văn. */
export function chunkText(text, size = 900) {
  const paras = String(text || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out = [];
  let cur = '';
  for (const p of paras) {
    if (cur && cur.length + p.length > size) {
      out.push(cur);
      cur = '';
    }
    if (p.length > size * 1.6) {
      for (let i = 0; i < p.length; i += size) out.push(p.slice(i, i + size));
      continue;
    }
    cur = cur ? `${cur}\n${p}` : p;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Tìm các đoạn liên quan nhất (chấm điểm theo tần suất từ khóa × độ hiếm, cộng điểm cụm từ).
 * docs: [{ id, ten, text }] → [{ docId, ten, idx, text, score }]
 */
export function searchDocs(query, docs, { limit = 8 } = {}) {
  const qt = [...new Set(tokens(query))];
  const chunks = docs.flatMap((d) => chunkText(d.text).map((text, idx) => ({ docId: d.id, ten: d.ten, idx, text, tk: tokens(text) })));
  if (!chunks.length) return [];
  if (!qt.length) return chunks.slice(0, limit).map(({ tk, ...c }) => ({ ...c, score: 0 }));
  const df = Object.fromEntries(qt.map((w) => [w, chunks.filter((c) => c.tk.includes(w)).length]));
  const N = chunks.length;
  const qn = normVi(query).replace(/\s+/g, ' ').trim();
  const scored = chunks.map((c) => {
    let s = 0;
    for (const w of qt) {
      const tf = c.tk.filter((x) => x === w).length;
      if (tf) s += (1 + Math.log(tf)) * Math.log(1 + N / (df[w] || 1));
    }
    const cn = normVi(c.text);
    if (qn.length > 6 && cn.includes(qn)) s += 6;
    for (let i = 0; i < qt.length - 1; i++) if (cn.includes(`${qt[i]} ${qt[i + 1]}`)) s += 1.5;
    return { ...c, score: s / Math.sqrt(1 + c.tk.length / 120) };
  });
  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ tk, ...c }) => c);
}

/** Ngữ cảnh gửi AI: các đoạn đánh số [n] kèm tên tài liệu. */
export function buildContext(hits, max = 14000) {
  let out = '';
  hits.forEach((h, i) => {
    const block = `[${i + 1}] (${h.ten} — đoạn ${h.idx + 1})\n${h.text}\n\n`;
    if (out.length + block.length <= max) out += block;
  });
  return out.trim();
}

/* ---------------- Lập biên bản lời khai mới từ các biên bản cũ (ngoại tuyến) ---------------- */
const VAGUE = /không nhớ|không biết|khoảng|hình như|có lẽ|chắc là|không rõ|quên/i;

/**
 * Phân tích các lời khai cũ → các vấn đề cần làm rõ và câu hỏi (chạy trên máy).
 * olds: [{ ten, nguoiKhai: { hoTen }, qa: [{ q, a }] }]
 */
export function localInterviewPlan(olds, { focus = '', roleId = 'bi-can' } = {}) {
  const issues = [];
  issues.push({
    tieuDe: 'Mở đầu, xác nhận lời khai trước',
    cauHoi: [
      'Anh/chị cho biết tình trạng sức khỏe, trạng thái tâm lý trong buổi làm việc hôm nay như thế nào?',
      `Anh/chị có thay đổi những nội dung đã khai báo với Cơ quan điều tra trong ${olds.length > 1 ? `${olds.length} lần làm việc` : 'buổi làm việc'} trước không?`,
    ],
  });
  const [main, ...others] = olds.map((o) => ({ qa: o.qa || [], nguoiKhai: o.nguoiKhai || {} }));
  const contra = main ? localContradictions({ qa: [...main.qa, ...others.flatMap((o) => o.qa)] }, []) : [];
  const cq = contra.map((c) => c.cauHoiLamRo).filter(Boolean);
  if (cq.length) issues.push({ tieuDe: 'Làm rõ điểm mâu thuẫn giữa các lần khai', cauHoi: [...new Set(cq)].slice(0, 8) });
  const vague = olds.flatMap((o) => (o.qa || []).filter((x) => VAGUE.test(x.a)).map((x) => ({ ...x, ten: o.ten })));
  if (vague.length)
    issues.push({
      tieuDe: 'Làm rõ nội dung khai chưa cụ thể',
      cauHoi: vague.slice(0, 8).map((x) => `Lần trước khi được hỏi “${x.q.replace(/[?？]+$/, '')}”, anh/chị khai: “${x.a.length > 120 ? x.a.slice(0, 117) + '…' : x.a}”. Đề nghị trình bày cụ thể, chính xác lại nội dung này.`),
    });
  const facts = olds.flatMap((o) => (o.qa || []).filter((x) => /\d[\d.,]*\s*(triệu|tỷ|đồng|nghìn)|ngày\s+\d|\d{1,2}\/\d{1,2}/i.test(x.a)));
  if (facts.length)
    issues.push({
      tieuDe: 'Kiểm tra lại số liệu, thời gian đã khai',
      cauHoi: facts.slice(0, 6).map((x) => `Về nội dung đã khai: “${x.a.length > 110 ? x.a.slice(0, 107) + '…' : x.a}” — căn cứ, tài liệu nào chứng minh; ai biết, ai chứng kiến?`),
    });
  if (focus.trim()) issues.push({ tieuDe: `Trọng tâm cần làm rõ: ${focus.trim()}`, cauHoi: localFollowUps(focus, roleId) });
  issues.push({ tieuDe: 'Kết thúc', cauHoi: ['Ngoài nội dung trên, anh/chị có trình bày gì thêm không? Cam đoan như thế nào về lời khai của mình?'] });
  return { tomTat: `${olds.length} biên bản cũ · ${olds.reduce((n, o) => n + (o.qa || []).length, 0)} lượt hỏi – đáp · ${cq.length} điểm mâu thuẫn · ${vague.length} nội dung chưa cụ thể`, issues };
}

/** Kế hoạch (dạng rec.plan) cho biên bản mới từ danh sách vấn đề. */
export function planFromIssues(issues, uidFn) {
  return {
    dieu: null,
    roleId: null,
    issues: issues.map((is, i) => ({ id: `kho-${i + 1}`, key: `kho-${i + 1}`, tieuDe: is.tieuDe, canCu: is.canCu || 'Lời khai trước', moTa: '', cauHoi: (is.cauHoi || []).filter(Boolean).map((text) => ({ id: uidFn(), text, src: 'kho', priority: 'normal' })) })),
  };
}

/** Thông tin người khai cho biên bản mới (từ biên bản cũ). */
export function personFromOlds(olds) {
  const out = {};
  for (const o of olds) for (const [k] of PERSON_FIELDS) if (!out[k] && o.nguoi?.[k]) out[k] = o.nguoi[k];
  return out;
}

/* ---------------- Nhận diện yêu cầu (khi không dùng AI) ---------------- */
export function localIntent(text, forms) {
  const n = normVi(text);
  if (/(tao|lap|soan|lam).{0,40}(bien ban (ghi )?loi khai|bblk|bien ban hoi cung|loi khai moi|hoi cung)/.test(n)) return { action: 'bblk', focus: text.replace(/.*?(để|nhằm|làm rõ)\s*/i, '').trim() };
  if (/(tao|lap|soan|lam|viet)\s/.test(n)) {
    let best = null;
    let bestScore = 0;
    const qt = new Set(tokens(text));
    for (const f of forms) {
      const ft = tokens(f.ten);
      const s = ft.filter((w) => qt.has(w)).length / Math.max(3, ft.length);
      if (s > bestScore) {
        best = f;
        bestScore = s;
      }
    }
    if (best && bestScore >= 0.34) return { action: 'form', formId: best.id };
  }
  return { action: 'answer' };
}

/* ---------------- Lời nhắc AI ---------------- */
export const KHO_SYSTEM = `Bạn là trợ lý nghiệp vụ của Điều tra viên, làm việc trên kho hồ sơ vụ án do người dùng cung cấp.
- Chỉ dựa vào nội dung tài liệu được trích dẫn; ghi nguồn bằng số [n] sau mỗi ý.
- Không bịa đặt tình tiết, số liệu, tên người; thông tin không có trong tài liệu thì nói rõ "chưa có trong tài liệu".
- Văn phong nghiệp vụ, chính xác, ngắn gọn, tiếng Việt chuẩn.`;

export const answerPrompt = (question, context) => `Câu hỏi: ${question}\n\nTÀI LIỆU TRÍCH DẪN:\n${context || '(không tìm thấy đoạn phù hợp)'}`;

export const intentPrompt = (text, forms) => `Phân loại yêu cầu của Điều tra viên:
- "bblk": lập biên bản ghi lời khai / hỏi cung mới (dựa vào lời khai cũ);
- "form": tạo một văn bản tố tụng theo mẫu (chọn formId trong danh sách);
- "answer": hỏi đáp, tra cứu, tóm tắt, phân tích hồ sơ.
Danh sách mẫu (formId: tên):
${forms.map((f) => `${f.id}: ${f.ten}`).join('\n')}

Yêu cầu: ${text}
Chỉ trả về JSON: {"action":"bblk|form|answer","formId":"…hoặc rỗng","nguoi":"họ tên người liên quan nếu có","focus":"nội dung trọng tâm cần làm rõ nếu có"}`;

export const interviewPrompt = (olds, { focus, nguoi, roleName, max = 24000 }) => `Dựa vào các biên bản lời khai cũ dưới đây${nguoi ? ` của ${nguoi}` : ''} (tư cách: ${roleName}), lập kế hoạch cho buổi lấy lời khai TIẾP THEO nhằm làm rõ hơn vụ việc${focus ? `, trọng tâm: ${focus}` : ''}.
Yêu cầu: chỉ ra điểm mâu thuẫn giữa các lần khai, nội dung khai chưa cụ thể, tình tiết còn thiếu theo cấu thành tội phạm (Điều 85 BLTTHS); câu hỏi ngắn, rõ, không mớm cung, đúng tư cách tố tụng; mở đầu bằng câu hỏi về sức khỏe và việc có thay đổi lời khai trước không; kết thúc bằng câu hỏi "Ngoài nội dung trên, anh/chị có trình bày gì thêm không? Cam đoan như thế nào về lời khai của mình?".
Chỉ trả về JSON: {"tomTat":"tóm tắt ngắn các lần khai và điểm cần làm rõ","vanDe":[{"tieuDe":"…","canCu":"căn cứ (biên bản ngày…, mâu thuẫn…)","cauHoi":["…"]}]}

CÁC BIÊN BẢN CŨ:
${olds.map((o, i) => `=== [${i + 1}] ${o.ten}${o.ngay ? ` (ngày ${o.ngay})` : ''}\n${focusText(o.text, { min: Math.round(max / olds.length) }).slice(0, Math.max(2000, Math.round(max / olds.length)))}`).join('\n\n').slice(0, max)}`;

export const formPrompt = (form, keys, labels, context, request) => `Điền văn bản tố tụng "${form.ten}" dựa trên tài liệu hồ sơ được trích dẫn và yêu cầu của Điều tra viên.
Yêu cầu: ${request}
Các trường cần điền (khóa: nhãn):
${keys.map((k) => `${k}: ${labels[k]}`).join('\n')}
Quy tắc: chỉ dùng thông tin có trong tài liệu; trường không có thông tin để rỗng ""; văn phong văn bản tố tụng; nhân thân viết liền một dòng (sinh ngày…; nơi cư trú…; số định danh…).
Chỉ trả về JSON: {"values":{"khóa":"giá trị"}}

TÀI LIỆU TRÍCH DẪN:
${context || '(không có)'}`;
