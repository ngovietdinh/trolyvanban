// Mục "Tòa án": đọc bản án / cáo trạng, phân tích hành vi phạm tội, kiểm tra tội danh – khung – mức hình phạt đã áp dụng,
// xem xét đơn khiếu nại / kháng cáo người khác gửi đến có căn cứ hay không.
//
// Nguyên tắc: chỉ dựa trên NỘI DUNG HIỆN CÓ — nguyên văn điều luật lấy từ sách Bình luận BLHS đã nạp (khung hình phạt,
// Điều 9, 38, 51, 52, 54, 65), dữ liệu cấu thành tội phạm của phần mềm, và câu trích nguyên văn trong tài liệu vụ án.
// Mọi kết luận đều kèm căn cứ (trích dẫn) và là gợi ý để người có thẩm quyền xem xét, không thay thế quyết định của Tòa án.
import { findCrime } from './engine.js';
import { findArticle } from './binh-luan.js';
import { assessCrime, lawCandidates, confusableHints, citedArticles } from './relevance.js';
import { amountsIn } from './terms.js';

/* ---------------- Đọc số, thời hạn ---------------- */
const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
// Chuẩn hóa NFC để so khớp (sách có chỗ gõ dấu tổ hợp); không đổi chữ hiển thị của sách.
const clean = (s) => String(s || '').normalize('NFC').replace(/\{\{fn:\d+\}\}/g, '').replace(/\*+\s*$/, '').trim();

/** "2.000.000 đồng" → 2000000; "500 triệu" → 500000000. */
export function parseMoney(s) {
  const v = amountsIn(String(s || ''))[0]?.v;
  return Number.isFinite(v) ? v : null;
}

/** "02 năm 06 tháng" → 30 (tháng); "06 tháng" → 6; "03 năm" → 36. */
export function parseDuration(s) {
  const t = fold(s);
  const y = /(\d{1,2})\s*nam/.exec(t);
  const m = /(\d{1,2})\s*thang/.exec(t);
  if (!y && !m) return null;
  return (y ? +y[1] * 12 : 0) + (m ? +m[1] : 0);
}
export const fmtMonths = (n) => {
  if (n == null) return '';
  const y = Math.floor(n / 12);
  const m = n % 12;
  return [y ? `${y} năm` : '', m ? `${m} tháng` : ''].filter(Boolean).join(' ') || '0 tháng';
};
export const fmtVnd = (v) => (v == null ? '' : `${Math.round(v).toLocaleString('vi-VN')} đồng`);

/** Hình phạt trong một câu điều luật: { tuMin, tuMax (tháng), chungThan, tuHinh, caiTaoMax, phatTien: {min,max} }. */
export function penaltyOf(text) {
  const t = clean(text);
  const out = {};
  const tu = /phạt tù\s+(?:từ\s+)?(\d{1,2}\s*(?:năm|tháng))(?:\s+đến\s+(\d{1,2}\s*(?:năm|tháng)))?/iu.exec(t);
  const tuDen = /phạt tù\s+đến\s+(\d{1,2}\s*(?:năm|tháng))/iu.exec(t);
  // Sách có chỗ gõ sót / lặp chữ ("phạt từ từ 01 năm đến 05 năm", "phạt từ tù 12 năm đến 20 năm") — đơn vị năm/tháng là phạt tù.
  const tuLoi = !tu && !tuDen ? /phạt\s+(?:từ\s+)?(?:từ|tù)\s+(?:tù\s+)?(\d{1,2}\s*(?:năm|tháng))\s+đến\s+(\d{1,2}\s*(?:năm|tháng))/iu.exec(t) : null;
  if (tuDen) out.tuMax = parseDuration(tuDen[1]);
  else if (tuLoi) {
    out.tuMin = parseDuration(tuLoi[1]);
    out.tuMax = parseDuration(tuLoi[2]);
  } else if (tu) {
    out.tuMin = parseDuration(tu[1]);
    out.tuMax = tu[2] ? parseDuration(tu[2]) : out.tuMin;
  }
  if (/tù chung thân/iu.test(t)) out.chungThan = true;
  if (/tử hình/iu.test(t)) out.tuHinh = true;
  const ct = /cải tạo không giam giữ\s+(?:từ\s+\d{1,2}\s*(?:năm|tháng)\s+)?đến\s+(\d{1,2}\s*(?:năm|tháng))/iu.exec(t);
  if (ct) out.caiTaoMax = parseDuration(ct[1]);
  const pt = /phạt tiền\s+từ\s+([\d.,]+\s*(?:đồng|triệu|tỷ))\s+đến\s+([\d.,]+\s*(?:đồng|triệu|tỷ))/iu.exec(t);
  if (pt) out.phatTien = { min: parseMoney(pt[1]), max: parseMoney(pt[2]) };
  return out;
}

/** Khoảng giá trị tài sản trong câu điều luật: [{ from, to }] ("từ X đồng đến dưới Y đồng", "X đồng trở lên"). */
export function moneyRanges(text) {
  const t = clean(text);
  const out = [];
  for (const m of t.matchAll(/(?:trị giá|số tiền|giá trị|thu lợi bất chính|gây thiệt hại(?: về tài sản)?|thiệt hại)?\s*(?:từ\s+)?([\d.]{5,})\s*đồng\s+(?:đến dưới\s+([\d.]{5,})\s*đồng|trở lên)/giu)) {
    out.push({ from: parseMoney(`${m[1]} đồng`), to: m[2] ? parseMoney(`${m[2]} đồng`) : null });
  }
  return out;
}

/** Tách nội dung một điều (dòng nguyên văn) thành khoản / điểm. */
export function parseArticle(lines = []) {
  const khoans = [];
  let cur = null;
  for (const raw of lines) {
    const line = clean(raw);
    const k = /^(\d{1,2})\.\s+(.*)$/u.exec(line);
    const d = /^([a-zđ])\)\s+(.*)$/u.exec(line);
    if (k) {
      cur = { k: +k[1], text: k[2], points: [] };
      khoans.push(cur);
    } else if (d && cur) cur.points.push({ d: d[1], text: d[2] });
    else if (cur && line) cur.text += `\n${line}`;
  }
  return khoans;
}

/** Khung hình phạt của một điều từ sách Bình luận: [{ k, text, points, penalty, money, boSung }] (null nếu sách chưa có điều). */
export function articleFrames(book, so) {
  const a = findArticle(book, so);
  if (!a) return null;
  return parseArticle(a.vb).map((x) => {
    const penalty = penaltyOf(x.text);
    // Khoản hình phạt bổ sung ("còn có thể bị…") và khoản dành cho pháp nhân thương mại không phải khung của cá nhân.
    const phapNhan = /^Pháp nhân/iu.test(x.text);
    const boSung = phapNhan || (/còn (?:có thể )?bị/iu.test(x.text) && !penalty.tuMin && !penalty.tuMax && !penalty.chungThan);
    const money = [...moneyRanges(x.text.split('\n')[0]), ...x.points.flatMap((p) => moneyRanges(p.text).map((r) => ({ ...r, d: p.d })))];
    return { ...x, penalty: boSung ? {} : penalty, money, boSung, phapNhan, head: a.head };
  });
}

/** Các quy định chung dùng để kiểm tra (nguyên văn từ sách; thiếu sách thì chỉ còn số liệu tối thiểu, có ghi rõ). */
export function generalRules(book) {
  const art = (so) => findArticle(book, so);
  const kh = (so) => (art(so) ? parseArticle(art(so).vb) : []);
  const a38 = art('38');
  const a65 = art('65');
  const t38 = a38 ? a38.vb.map(clean).join('\n') : '';
  const t65 = a65 ? clean(a65.vb[0]) : '';
  const k51 = kh('51');
  const k52 = kh('52');
  return {
    hasBook: !!book,
    a38: { min: +(/tối thiểu là (\d+) tháng/u.exec(t38)?.[1] || 3), max: (+(/tối đa là (\d+) năm/u.exec(t38)?.[1] || 20)) * 12, quote: a38 ? a38.vb.map(clean).find((l) => /tối thiểu/u.test(l)) || '' : '' },
    a65: { maxTu: (+(/không quá (\d+) năm/u.exec(t65)?.[1] || 3)) * 12, thuThachMin: (+(/từ (\d+) năm đến \d+ năm/u.exec(t65)?.[1] || 1)) * 12, thuThachMax: (+(/từ \d+ năm đến (\d+) năm/u.exec(t65)?.[1] || 5)) * 12, quote: t65 },
    a51: { k1: k51.find((k) => k.k === 1)?.points || [], k2: k51.find((k) => k.k === 2)?.text || '', k3: k51.find((k) => k.k === 3)?.text || '' },
    a52: { k1: k52.find((k) => k.k === 1)?.points || [], k2: k52.find((k) => k.k === 2)?.text || '' },
    a54: kh('54').map((k) => ({ k: k.k, text: k.text })),
    a9: (kh('9').find((k) => k.k === 1)?.points || []).map((p) => ({ d: p.d, text: p.text })),
  };
}

/** Loại tội phạm theo mức cao nhất của khung (Điều 9). */
export function crimeClass(penalty) {
  if (!penalty) return null;
  if (penalty.chungThan || penalty.tuHinh || (penalty.tuMax || 0) > 180) return 'đặc biệt nghiêm trọng';
  const max = penalty.tuMax ?? penalty.caiTaoMax ?? 0;
  if (max <= 36) return 'ít nghiêm trọng';
  if (max <= 84) return 'nghiêm trọng';
  return 'rất nghiêm trọng';
}

/* ---------------- Đọc bản án / cáo trạng ---------------- */
// Viện dẫn: "điểm b, s khoản 1, khoản 2 Điều 51" → [{ dieu: '51', khoan: 1, diem: ['b','s'] }, { dieu: '51', khoan: 2, diem: [] }].
export function parseCitations(text) {
  const out = [];
  const src = String(text || '');
  const re = /Điều\s+(\d{1,3}[a-zđ]?)\b/gu;
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    const seg = src.slice(last, m.index).split(/[;.]|Điều\s+\d+/u).pop();
    last = m.index + m[0].length;
    const items = [];
    let pend = [];
    for (const t of seg.matchAll(/(điểm\s+([a-zđ](?:\s*(?:,|và)\s*[a-zđ])*)\b)|(khoản\s+(\d{1,2}))/giu)) {
      if (t[1]) pend = t[2].split(/\s*(?:,|và)\s*/u).map((x) => x.trim().toLowerCase());
      else {
        items.push({ khoan: +t[4], diem: pend });
        pend = [];
      }
    }
    if (!items.length) items.push({ khoan: null, diem: pend });
    items.forEach((x) => out.push({ dieu: m[1].toLowerCase(), ...x }));
  }
  return out;
}

const NAME = '((?:[A-ZĐÀ-Ỹ][\\p{Ll}\\u0300-\\u036f]*)(?:\\s+[A-ZĐÀ-Ỹ][\\p{Ll}\\u0300-\\u036f]*){1,4})';

/** Hình phạt trong câu "Xử phạt bị cáo … 05 (năm) năm tù, nhưng cho hưởng án treo, thời gian thử thách 04 năm". */
export function parseSentence(s) {
  const t = String(s || '').replace(/\s*\([^()]{1,30}\)/g, '');
  const p = {};
  if (/tử hình/iu.test(t)) p.loai = 'tu-hinh';
  else if (/tù chung thân/iu.test(t)) p.loai = 'chung-than';
  else if (/cải tạo không giam giữ/iu.test(t)) {
    p.loai = 'cai-tao';
    p.thang = parseDuration(/cải tạo không giam giữ\s+(?:thời hạn\s+)?(\d{1,2}\s*(?:năm|tháng)(?:\s*\d{1,2}\s*tháng)?)/iu.exec(t)?.[1]) ?? parseDuration(/(\d{1,2}\s*năm(?:\s*\d{1,2}\s*tháng)?|\d{1,2}\s*tháng)\s+cải tạo không giam giữ/iu.exec(t)?.[1]);
  } else {
    const tu = /(\d{1,2}\s*năm(?:\s*\d{1,2}\s*tháng)?|\d{1,2}\s*tháng)\s+tù/iu.exec(t);
    if (tu) {
      p.loai = 'tu';
      p.thang = parseDuration(tu[1]);
    }
  }
  if (/án treo/iu.test(t)) {
    p.anTreo = true;
    p.thuThach = parseDuration(/thử thách\s+(?:là\s+)?(\d{1,2}\s*(?:năm|tháng)(?:\s*\d{1,2}\s*tháng)?)/iu.exec(t)?.[1]);
  }
  const ptien = /phạt tiền\s+(?:bị cáo\s+[^\d]{0,40})?([\d.,]+\s*(?:đồng|triệu|tỷ))/iu.exec(t);
  if (ptien) {
    p.phatTien = parseMoney(ptien[1]);
    if (!p.loai) p.loai = 'phat-tien';
  }
  return p;
}

/**
 * Đọc bản án / cáo trạng → danh sách bị cáo với tội danh (điều, khoản, điểm), tình tiết (Điều 51, 52), Điều 54 / 65,
 * hình phạt đã tuyên, số tiền. Chỉ lấy đúng chữ có trong văn bản; thiếu thì để trống cho người dùng điền.
 */
export function parseVerdict(text) {
  const src = String(text || '').replace(/\r/g, '');
  const people = new Map();
  const get = (hoTen) => {
    const k = hoTen.trim();
    if (!people.has(k)) people.set(k, { hoTen: k, toiDanh: [], giamNhe: [], giamNheK2: false, tangNang: [], dieu54: false, dieu65: false, dieu58: false, hinhPhat: {} });
    return people.get(k);
  };
  // Mỗi đoạn "Áp dụng … Xử phạt bị cáo NAME …" (hoặc "Áp dụng … đối với bị cáo NAME").
  const sents = src.split(/(?<=[.;:])\s+|\n+/u);
  let pendingCites = [];
  for (let i = 0; i < sents.length; i++) {
    const s = sents[i];
    if (/^(?:căn cứ|áp dụng)(?![\p{L}])/iu.test(s.trim()) || /Điều\s+\d/u.test(s)) {
      const cites = parseCitations(s);
      if (cites.length) pendingCites = /^(?:căn cứ|áp dụng)(?![\p{L}])/iu.test(s.trim()) ? cites : [...pendingCites, ...cites];
    }
    const xp = new RegExp(`(?:Xử phạt|xử phạt|Phạt)\\s+bị cáo\\s+${NAME}`, 'u').exec(s);
    if (xp) {
      const d = get(xp[1]);
      const rest = [s, sents[i + 1] || ''].join(' ');
      d.hinhPhat = { ...d.hinhPhat, ...parseSentence(rest.slice(rest.indexOf(xp[0]))) };
      for (const c of pendingCites) {
        if (c.dieu === '51') {
          if (c.khoan === 1 || c.khoan == null) d.giamNhe.push(...c.diem);
          if (c.khoan === 2) d.giamNheK2 = true;
        } else if (c.dieu === '52') d.tangNang.push(...c.diem);
        else if (c.dieu === '54') d.dieu54 = true;
        else if (c.dieu === '65') d.dieu65 = true;
        else if (c.dieu === '58' || c.dieu === '17') d.dieu58 = true;
        else if (findCrime(c.dieu)) d.toiDanh.push({ dieu: c.dieu, khoan: c.khoan, diem: c.diem });
      }
      pendingCites = [];
    }
  }
  // Tội danh tuyên: “Tuyên bố bị cáo X phạm tội "Lừa đảo chiếm đoạt tài sản"”.
  for (const m of src.matchAll(new RegExp(`Tuyên bố (?:các )?bị cáo\\s+${NAME}[^.\\n]{0,120}?phạm (?:tội|các tội)\\s*[“"]([^”"]+)[”"]`, 'gu'))) get(m[1]).tenToi = m[2].trim();
  const out = [...people.values()].map((d) => ({
    ...d,
    giamNhe: [...new Set(d.giamNhe)],
    tangNang: [...new Set(d.tangNang)],
    toiDanh: d.toiDanh.filter((x, i, a) => a.findIndex((y) => y.dieu === x.dieu && y.khoan === x.khoan) === i),
  }));
  // Số tiền chiếm đoạt / thiệt hại nêu trong văn bản.
  const money = [];
  for (const s of sents) if (/(chiếm đoạt|thiệt hại|trị giá|chiếm giữ|thu lợi|nhận hối lộ|tham ô)/iu.test(s)) for (const a of amountsIn(s)) if (a.v >= 100000) money.push({ v: a.v, quote: s.trim().slice(0, 300) });
  return { defendants: out, money };
}

/* ---------------- Căn cứ thực tế trong tài liệu (câu trích nguyên văn) ---------------- */
export function sentencesOf(sources = []) {
  const out = [];
  for (const s of sources) for (const t of String(s.text || '').replace(/\r/g, '').split(/(?<=[.!?;])\s+|\n+/u)) if (t.trim().length >= 12) out.push({ t: t.trim(), src: s.name || '' });
  return out;
}
/** Tìm câu chứng minh: re khớp, không phải câu phủ định / câu hỏi. */
function evidence(sents, re, { name = '' } = {}) {
  const nk = fold(name).split(' ').filter(Boolean).slice(-2).join(' ');
  const hits = sents.filter((x) => re.test(x.t) && !/^(hỏi|h)\s*[:.]/iu.test(x.t) && !/\b(không|chưa|chối|phủ nhận)\b[^,.;]{0,12}$/iu.test(x.t.split(re)[0] || ''));
  const pref = nk ? hits.filter((x) => fold(x.t).includes(nk)) : [];
  return (pref.length ? pref : hits)[0] || null;
}

// Dấu hiệu trong tài liệu gợi ý tình tiết giảm nhẹ (khớp theo NỘI DUNG điểm của Điều 51 trong sách, không theo chữ cái).
const MITIGATE_CUES = [
  [/sửa chữa, bồi thường|khắc phục hậu quả/u, /(?:đã|tự nguyện|gia đình[^.]{0,30})\s*(?:bồi thường|khắc phục|nộp lại|nộp (?:số )?tiền|trả lại|hoàn trả|nộp khắc phục)/iu],
  [/thành khẩn khai báo/u, /thành khẩn|ăn năn|hối cải|thừa nhận (?:toàn bộ )?hành vi|khai nhận (?:toàn bộ )?hành vi/iu],
  [/tự thú/u, /tự thú/iu],
  [/lần đầu/u, /lần đầu|chưa có tiền án|nhân thân tốt|chưa (?:từng )?bị (?:kết án|xử lý)/iu],
  [/phụ nữ có thai/u, /đang (?:có|mang) thai|có thai/iu],
  [/70 tuổi/u, /\b(?:7\d|8\d|9\d)\s*tuổi/iu],
  // Điểm x: BẢN THÂN bị cáo là người có công, hoặc là cha, mẹ, vợ, chồng, con của liệt sĩ (người thân khác có công → khoản 2).
  [/có công với cách mạng|liệt sĩ/u, /(?:bị cáo|bản thân)(?:(?!bố|mẹ|cha|ông|bà|anh|chị|vợ|chồng|con|gia đình)[^.]){0,20}(?:là )?(?:người có công|thương binh|bệnh binh)|(?:là\s+)(?:cha|mẹ|bố|vợ|chồng|con)(?:\s+đẻ)?\s+(?:của\s+)?liệt sĩ/iu],
  [/thành tích xuất sắc/u, /bằng khen|giấy khen|chiến sĩ thi đua|thành tích xuất sắc/iu],
  [/tích cực hợp tác|giúp đỡ/u, /tích cực hợp tác|giúp đỡ cơ quan|tố giác (?:đồng phạm|người khác)|cung cấp thông tin (?:về )?(?:đồng phạm|đối tượng)/iu],
  [/hoàn cảnh đặc biệt khó khăn/u, /hoàn cảnh (?:gia đình )?(?:đặc biệt )?khó khăn|hộ nghèo|hộ cận nghèo/iu],
  [/chưa gây thiệt hại|thiệt hại không lớn/u, /chưa gây thiệt hại|thiệt hại không lớn/iu],
  [/đe dọa hoặc cưỡng bức/u, /bị (?:đe dọa|ép buộc|cưỡng bức|khống chế)/iu],
  [/khuyết tật/u, /khuyết tật/iu],
  [/hạn chế khả năng nhận thức hoặc khả năng điều khiển/u, /tâm thần|hạn chế khả năng nhận thức/iu],
  [/lập công/u, /lập công/iu],
];
const K2_CUE = /đầu thú|gia đình (?:có công|chính sách)|hoàn cảnh (?:gia đình )?(?:đặc biệt )?khó khăn|lao động chính|(?:bố|mẹ|cha|ông|bà|anh|chị)[^.]{0,40}(?:có công|liệt sĩ|huân chương|huy chương)|bị hại (?:có đơn )?(?:xin giảm nhẹ|bãi nại)|đơn xin giảm nhẹ/iu;
// Tình tiết tăng nặng đã áp dụng cần có căn cứ trong tài liệu.
const AGGRAVATE_CUES = [
  [/có tổ chức/u, /có tổ chức|bàn bạc|phân công|câu kết chặt chẽ/iu],
  [/chuyên nghiệp/u, /chuyên nghiệp|nhiều lần|nguồn sống chính|lấy[^.]{0,20}làm nguồn sống/iu],
  [/02 lần trở lên/u, /\b(?:0?2|hai|ba|nhiều)\s*lần\b/iu],
  [/tái phạm/u, /tiền án|đã bị kết án|tái phạm|chưa được xóa án tích/iu],
  [/côn đồ/u, /côn đồ|hung hãn|vô cớ/iu],
  [/tinh vi, xảo quyệt/u, /xảo quyệt|tinh vi|tàn ác/iu],
  [/xảo quyệt hoặc hung hãn nhằm trốn tránh/u, /(?:trốn tránh|che giấu|tiêu hủy)[^.]{0,30}(?:tội phạm|chứng cứ|tang vật)|bỏ trốn/iu],
  [/chức vụ, quyền hạn/u, /chức vụ|quyền hạn|giám đốc|chủ tịch|trưởng|kế toán|thủ quỹ/iu],
];

/* ---------------- Kiểm tra quyết định đã áp dụng ---------------- */
/** Gộp các yếu tố có cùng câu trích: [{ quote, src: 'yếu tố 1; yếu tố 2' }]. */
const groupQuotes = (els) => {
  const m = new Map();
  for (const y of els) if (y.quote) m.set(y.quote, [...(m.get(y.quote) || []), y.label]);
  return [...m].map(([quote, labels]) => ({ quote, src: labels.join('; ') }));
};
const L = { loi: 'Có dấu hiệu sai', canh: 'Cần xem lại', goi: 'Có thể đề nghị', dung: 'Phù hợp' };
export const LEVELS = L;
const bl = (so, k, d) => `${d ? `điểm ${d} ` : ''}${k ? `khoản ${k} ` : ''}Điều ${so} BLHS`;

/**
 * Kiểm tra một bị cáo. d: { hoTen, tuoi, toiDanh: [{dieu, khoan, diem}], soTien, giamNhe[], giamNheK2, tangNang[],
 * dieu54, dieu65, vaiTro, hinhPhat: { loai, thang, anTreo, thuThach } }.
 * Trả về findings: [{ id, level ('loi'|'canh'|'goi'|'dung'), nhom, title, detail, law: [{ ref, quote }], facts: [{ quote, src }], yeuCau }].
 */
export function checkDefendant(d, { book, sources = [], rules = generalRules(book) } = {}) {
  const F = [];
  const add = (f) => F.push({ law: [], facts: [], ...f });
  const sents = sentencesOf(sources);
  const facts = sources.map((s) => s.text).join('\n');
  const main = d.toiDanh?.[0];
  const hp = d.hinhPhat || {};
  if (!main?.dieu) {
    add({ id: 'thieu-toi-danh', level: 'canh', nhom: 'toi-danh', title: 'Chưa có tội danh đã áp dụng', detail: 'Nhập điều, khoản đã áp dụng (hoặc tải bản án để phần mềm tự đọc) để kiểm tra.' });
    return F;
  }
  const crime = findCrime(main.dieu);
  const frames = articleFrames(book, main.dieu);
  const fr = frames?.filter((x) => !x.boSung) || [];
  const applied = fr.find((x) => x.k === main.khoan);
  const lawQ = (x) => ({ ref: bl(main.dieu, x.k), quote: x.text.split('\n')[0] });

  /* 1. Tội danh: nội dung có đủ yếu tố cấu thành của điều đã áp dụng? Có điều khác phù hợp hơn? */
  if (crime && facts.trim()) {
    const cited = new Set([main.dieu]);
    const a = assessCrime(main.dieu, facts, { ctxText: facts });
    const okEls = (a?.yeuTo || []).filter((y) => y.ok);
    const miss = (a?.yeuTo || []).filter((y) => y.req && !y.ok);
    if (a?.show && !miss.length)
      add({ id: 'toi-danh-ok', level: 'dung', nhom: 'toi-danh', title: `Tội danh Điều ${main.dieu} (${crime.ten}) có căn cứ trong tài liệu`, detail: a.why, facts: groupQuotes(okEls).slice(0, 3) });
    else if (miss.length)
      add({ id: 'toi-danh-thieu', level: 'canh', nhom: 'toi-danh', title: `Tài liệu chưa thể hiện đủ yếu tố cấu thành Điều ${main.dieu}`, detail: `Còn thiếu: ${miss.map((y) => y.label).join('; ')}.`, facts: groupQuotes(okEls).slice(0, 2), yeuCau: `Đề nghị làm rõ yếu tố ${miss.map((y) => y.label.toLowerCase()).join(', ')} trước khi kết luận bị cáo phạm tội theo Điều ${main.dieu} BLHS.` });
    const alts = lawCandidates(facts, { primary: null, cited: null, limit: 6 }).filter((x) => x.dieu !== main.dieu && x.show && x.muc === 'cao' && findCrime(x.dieu)?.nhom === crime.nhom);
    for (const x of alts.slice(0, 2)) {
      const hint = confusableHints([main.dieu, x.dieu]).replace(/^\s*PHÂN BIỆT CÁC ĐIỀU DỄ NHẦM:\s*/u, '').replace(/^- /u, '');
      add({ id: `toi-danh-khac-${x.dieu}`, level: 'canh', nhom: 'toi-danh', title: `Nội dung cũng có dấu hiệu Điều ${x.dieu} (${x.ten})`, detail: [x.why, hint].filter(Boolean).join(' — '), facts: x.trich ? [{ quote: x.trich, src: 'Tài liệu' }] : [], yeuCau: `Đề nghị xem xét lại việc định tội: hành vi có dấu hiệu của Điều ${x.dieu} BLHS (${x.ten.replace(/^Tội /, 'tội ')}) thay vì Điều ${main.dieu} BLHS.` });
    }
    void cited;
  }

  if (!frames) {
    add({ id: 'chua-co-sach', level: 'canh', nhom: 'khung', title: 'Chưa có nguyên văn điều luật để kiểm tra khung, mức hình phạt', detail: 'Nạp sách Bình luận khoa học BLHS (mục Bình luận BLHS) — phần mềm lấy nguyên văn khung hình phạt, Điều 51, 52, 54, 65 từ sách để đối chiếu.' });
  } else if (!applied) {
    add({ id: 'khoan-khong-co', level: main.khoan ? 'loi' : 'canh', nhom: 'khung', title: main.khoan ? `Điều ${main.dieu} không có khoản ${main.khoan} quy định hình phạt` : `Chưa rõ khoản đã áp dụng của Điều ${main.dieu}`, detail: `Các khoản có hình phạt: ${fr.map((x) => `khoản ${x.k}`).join(', ')}.` });
  }

  /* 2. Khung theo giá trị tài sản. */
  const amount = d.soTien ?? null;
  if (applied && amount != null && fr.some((x) => x.money.length)) {
    const fit = fr.filter((x) => x.money.some((r) => amount >= r.from && (r.to == null || amount < r.to)));
    const best = fit.sort((a, b) => b.k - a.k)[0];
    if (best && best.k !== applied.k) {
      const r = best.money.find((q) => amount >= q.from && (q.to == null || amount < q.to));
      const point = r?.d ? best.points.find((p) => p.d === r.d) : null;
      const heavier = best.k > applied.k;
      add({
        id: 'khung-tien',
        level: 'loi',
        nangHon: heavier,
        khoanDung: best.k,
        nhom: 'khung',
        title: `Giá trị ${fmtVnd(amount)} thuộc khoản ${best.k}, không phải khoản ${applied.k} Điều ${main.dieu}`,
        detail: heavier ? 'Theo giá trị tài sản, khung đã áp dụng NHẸ hơn quy định (căn cứ để Viện kiểm sát kháng nghị / bị hại kháng cáo tăng nặng).' : 'Theo giá trị tài sản, khung đã áp dụng NẶNG hơn quy định (căn cứ để bị cáo kháng cáo).',
        law: [{ ref: bl(main.dieu, best.k, point?.d), quote: point ? point.text : best.text.split('\n')[0] }],
        yeuCau: heavier ? `Đề nghị áp dụng khoản ${best.k} Điều ${main.dieu} BLHS tương ứng giá trị ${fmtVnd(amount)}.` : `Đề nghị xét xử bị cáo theo khoản ${best.k} Điều ${main.dieu} BLHS (giá trị tài sản ${fmtVnd(amount)}), không phải khoản ${applied.k}.`,
      });
    } else if (best)
      add({ id: 'khung-tien-ok', level: 'dung', nhom: 'khung', title: `Khoản ${applied.k} phù hợp giá trị ${fmtVnd(amount)}`, law: [lawQ(applied)] });
  }

  /* 3. Mức hình phạt so với khung, Điều 38, 54. */
  const nK1 = (d.giamNhe || []).length;
  const k51 = rules.a51.k1;
  const k51Text = (letter) => k51.find((p) => p.d === letter)?.text || '';
  if (applied && hp.loai === 'tu' && hp.thang != null) {
    const pen = applied.penalty;
    const min = pen.tuMin ?? rules.a38.min;
    const max = pen.tuMax ?? rules.a38.max;
    if (hp.thang < rules.a38.min || hp.thang > rules.a38.max)
      add({ id: 'dieu-38', level: 'loi', nhom: 'muc', title: `Mức tù ${fmtMonths(hp.thang)} ngoài giới hạn tù có thời hạn`, law: rules.a38.quote ? [{ ref: 'khoản 1 Điều 38 BLHS', quote: rules.a38.quote }] : [] });
    if (hp.thang > max && !(pen.chungThan || pen.tuHinh))
      add({ id: 'tren-khung', level: 'loi', nhom: 'muc', title: `Mức tù ${fmtMonths(hp.thang)} cao hơn mức cao nhất của khoản ${applied.k} (${fmtMonths(max)})`, law: [lawQ(applied)], yeuCau: `Đề nghị quyết định hình phạt trong khung khoản ${applied.k} Điều ${main.dieu} BLHS (tối đa ${fmtMonths(max)}).` });
    else if (hp.thang < min) {
      const lighter = fr.filter((x) => x.k < applied.k && (x.penalty.tuMax || x.penalty.caiTaoMax)).sort((a, b) => b.k - a.k)[0];
      if (!d.dieu54)
        add({ id: 'duoi-khung-khong-54', level: 'loi', nhom: 'muc', title: `Mức tù ${fmtMonths(hp.thang)} thấp hơn mức thấp nhất của khoản ${applied.k} (${fmtMonths(min)}) nhưng không áp dụng Điều 54`, law: [lawQ(applied), ...rules.a54.slice(0, 1).map((x) => ({ ref: `khoản ${x.k} Điều 54 BLHS`, quote: x.text }))] });
      else if (nK1 < 2 && d.vaiTro !== 'giup-suc-khong-dang-ke')
        add({ id: 'dieu-54-thieu', level: 'loi', nhom: 'muc', title: `Áp dụng Điều 54 nhưng chỉ có ${nK1} tình tiết giảm nhẹ khoản 1 Điều 51`, detail: 'Khoản 1 Điều 54 đòi hỏi ít nhất hai tình tiết giảm nhẹ quy định tại khoản 1 Điều 51.', law: rules.a54.slice(0, 1).map((x) => ({ ref: `khoản ${x.k} Điều 54 BLHS`, quote: x.text })) });
      else if (lighter && lighter.penalty.tuMin != null && hp.thang < lighter.penalty.tuMin && d.vaiTro !== 'giup-suc-khong-dang-ke')
        add({ id: 'dieu-54-lien-ke', level: 'canh', nhom: 'muc', title: `Mức tù ${fmtMonths(hp.thang)} thấp hơn cả khung liền kề nhẹ hơn (khoản ${lighter.k}: từ ${fmtMonths(lighter.penalty.tuMin)})`, detail: 'Khoản 1 Điều 54 chỉ cho phép trong khung liền kề nhẹ hơn; ngoài khung liền kề chỉ áp dụng cho người giúp sức có vai trò không đáng kể (khoản 2).', law: rules.a54.slice(0, 2).map((x) => ({ ref: `khoản ${x.k} Điều 54 BLHS`, quote: x.text })) });
      else add({ id: 'dieu-54-ok', level: 'dung', nhom: 'muc', title: `Mức dưới khung có căn cứ Điều 54 (${nK1} tình tiết giảm nhẹ khoản 1 Điều 51)` });
    } else add({ id: 'trong-khung', level: 'dung', nhom: 'muc', title: `Mức tù ${fmtMonths(hp.thang)} nằm trong khung khoản ${applied.k} (${fmtMonths(min)} – ${pen.chungThan ? 'tù chung thân' : fmtMonths(max)})`, law: [lawQ(applied)] });
  }
  if (applied && hp.loai === 'chung-than' && !applied.penalty.chungThan)
    add({ id: 'chung-than', level: 'loi', nhom: 'muc', title: `Khoản ${applied.k} Điều ${main.dieu} không quy định tù chung thân`, law: [lawQ(applied)] });
  if (applied && hp.loai === 'tu-hinh' && !applied.penalty.tuHinh)
    add({ id: 'tu-hinh', level: 'loi', nhom: 'muc', title: `Khoản ${applied.k} Điều ${main.dieu} không quy định tử hình`, law: [lawQ(applied)] });

  /* 4. Án treo (Điều 65). */
  if (hp.anTreo) {
    const lawQ65 = rules.a65.quote ? [{ ref: 'khoản 1 Điều 65 BLHS', quote: rules.a65.quote }] : [];
    if (hp.loai === 'tu' && hp.thang > rules.a65.maxTu) add({ id: 'an-treo-qua-3', level: 'loi', nhom: 'an-treo', title: `Cho hưởng án treo với mức tù ${fmtMonths(hp.thang)} (quá ${fmtMonths(rules.a65.maxTu)})`, law: lawQ65 });
    if (hp.thuThach != null && (hp.thuThach < rules.a65.thuThachMin || hp.thuThach > rules.a65.thuThachMax)) add({ id: 'thu-thach', level: 'loi', nhom: 'an-treo', title: `Thời gian thử thách ${fmtMonths(hp.thuThach)} ngoài khoảng ${fmtMonths(rules.a65.thuThachMin)} – ${fmtMonths(rules.a65.thuThachMax)}`, law: lawQ65 });
    if ((d.tangNang || []).length) add({ id: 'an-treo-tang-nang', level: 'canh', nhom: 'an-treo', title: 'Hưởng án treo trong khi có tình tiết tăng nặng', detail: 'Điều 65 căn cứ vào nhân thân và các tình tiết giảm nhẹ — cần xem lại việc cho hưởng án treo khi có tình tiết tăng nặng.', law: lawQ65 });
  } else if (hp.loai === 'tu' && hp.thang != null && hp.thang <= rules.a65.maxTu && nK1 >= 2 && !(d.tangNang || []).length) {
    const tot = evidence(sents, /nhân thân tốt|chưa có tiền án|nơi cư trú rõ ràng/iu, { name: d.hoTen });
    add({ id: 'de-nghi-an-treo', level: 'goi', nhom: 'an-treo', title: `Mức tù ${fmtMonths(hp.thang)} không quá ${fmtMonths(rules.a65.maxTu)}, có ${nK1} tình tiết giảm nhẹ, không có tình tiết tăng nặng`, detail: 'Có thể đề nghị cho hưởng án treo nếu nhân thân tốt, có nơi cư trú rõ ràng và xét thấy không cần bắt chấp hành hình phạt tù.', law: rules.a65.quote ? [{ ref: 'khoản 1 Điều 65 BLHS', quote: rules.a65.quote }] : [], facts: tot ? [{ quote: tot.t, src: tot.src }] : [], yeuCau: `Đề nghị cho bị cáo ${d.hoTen || ''} được hưởng án treo theo Điều 65 BLHS.`.replace('  ', ' ') });
  }

  /* 5. Tình tiết: trùng dấu hiệu định khung (Điều 51 khoản 3, Điều 52 khoản 2); tăng nặng không có căn cứ; giảm nhẹ bị bỏ sót. */
  const appliedText = applied ? `${applied.text} ${(main.diem || []).map((x) => applied.points.find((p) => p.d === x)?.text || '').join(' ')}` : '';
  const k52 = rules.a52.k1;
  for (const letter of d.tangNang || []) {
    const p = k52.find((x) => x.d === letter);
    if (!p) continue;
    const core = fold(p.text).replace(/^pham toi\s+|\s*de pham toi$|;$/g, '').replace(/[.;]$/, '');
    const dup = appliedText && core.split(/\s+/).length >= 2 && fold(appliedText).includes(core.replace(/^co tinh chat /, 'co tinh chat ').slice(0, 22));
    if (dup)
      add({ id: `trung-52-${letter}`, level: 'loi', nhom: 'tinh-tiet', title: `Tình tiết tăng nặng điểm ${letter} khoản 1 Điều 52 trùng dấu hiệu định khung đã áp dụng`, detail: `“${p.text}” đã là dấu hiệu của khoản ${applied.k}${main.diem?.length ? ` (điểm ${main.diem.join(', ')})` : ''} Điều ${main.dieu}.`, law: [{ ref: 'khoản 2 Điều 52 BLHS', quote: rules.a52.k2 }, { ref: `điểm ${letter} khoản 1 Điều 52 BLHS`, quote: p.text }], yeuCau: `Đề nghị không áp dụng tình tiết tăng nặng điểm ${letter} khoản 1 Điều 52 BLHS vì đã là dấu hiệu định khung.` });
    const cue = AGGRAVATE_CUES.find(([k]) => k.test(p.text));
    if (cue && !dup && !evidence(sents, cue[1], { name: d.hoTen }))
      add({ id: `can-cu-52-${letter}`, level: 'canh', nhom: 'tinh-tiet', title: `Chưa thấy căn cứ trong tài liệu cho tình tiết tăng nặng điểm ${letter} khoản 1 Điều 52`, detail: `“${p.text}” — tài liệu đã nạp không có câu nào thể hiện tình tiết này.`, law: [{ ref: `điểm ${letter} khoản 1 Điều 52 BLHS`, quote: p.text }], yeuCau: `Đề nghị không áp dụng tình tiết tăng nặng điểm ${letter} khoản 1 Điều 52 BLHS do không có căn cứ.` });
  }
  for (const letter of d.giamNhe || []) {
    const t = k51Text(letter);
    if (t && appliedText && fold(appliedText).includes(fold(t).replace(/^(nguoi )?pham toi\s+/, '').slice(0, 24)))
      add({ id: `trung-51-${letter}`, level: 'canh', nhom: 'tinh-tiet', title: `Tình tiết giảm nhẹ điểm ${letter} khoản 1 Điều 51 có thể trùng dấu hiệu định tội / định khung`, law: [{ ref: 'khoản 3 Điều 51 BLHS', quote: rules.a51.k3 }] });
  }
  // Giảm nhẹ có dấu hiệu trong tài liệu nhưng chưa được áp dụng → căn cứ đề nghị giảm nhẹ.
  const used = new Set(d.giamNhe || []);
  for (const p of k51) {
    if (used.has(p.d)) continue;
    const cue = MITIGATE_CUES.find(([k]) => k.test(p.text));
    if (!cue) continue;
    if (/70 tuổi/u.test(p.text) && !(d.tuoi >= 70)) {
      if (d.tuoi != null) continue;
    }
    const ev = evidence(sents, cue[1], { name: d.hoTen });
    if (!ev) continue;
    if (/lần đầu/u.test(p.text) && applied && crimeClass(applied.penalty) !== 'ít nghiêm trọng') continue; // điểm i chỉ cho tội ít nghiêm trọng
    add({ id: `bo-sot-51-${p.d}`, level: 'goi', nhom: 'tinh-tiet', title: `Chưa áp dụng tình tiết giảm nhẹ điểm ${p.d} khoản 1 Điều 51`, detail: `Tài liệu có nội dung thể hiện tình tiết “${p.text.replace(/;$/, '')}”.`, law: [{ ref: `điểm ${p.d} khoản 1 Điều 51 BLHS`, quote: p.text }], facts: [{ quote: ev.t, src: ev.src }], yeuCau: `Đề nghị áp dụng tình tiết giảm nhẹ điểm ${p.d} khoản 1 Điều 51 BLHS cho bị cáo${d.hoTen ? ` ${d.hoTen}` : ''}.` });
  }
  if (!d.giamNheK2 && rules.a51.k2) {
    const ev = evidence(sents, K2_CUE, { name: d.hoTen });
    if (ev) add({ id: 'bo-sot-51-k2', level: 'goi', nhom: 'tinh-tiet', title: 'Có thể đề nghị áp dụng khoản 2 Điều 51 (đầu thú hoặc tình tiết khác)', law: [{ ref: 'khoản 2 Điều 51 BLHS', quote: rules.a51.k2 }], facts: [{ quote: ev.t, src: ev.src }], yeuCau: 'Đề nghị Tòa án coi tình tiết nêu trên là tình tiết giảm nhẹ theo khoản 2 Điều 51 BLHS.' });
  }
  // Có thêm tình tiết giảm nhẹ → khi đủ ≥ 2 tình tiết khoản 1 có thể đề nghị Điều 54.
  const extra = F.filter((f) => /^bo-sot-51-[a-zđ]$/.test(f.id)).length;
  if (applied && !d.dieu54 && nK1 + extra >= 2 && applied.k > 1 && hp.loai === 'tu' && hp.thang != null && hp.thang >= (applied.penalty.tuMin ?? 0))
    add({ id: 'de-nghi-54', level: 'goi', nhom: 'muc', title: `Có ${nK1 + extra} tình tiết giảm nhẹ khoản 1 Điều 51${extra ? ` (gồm ${extra} tình tiết chưa được áp dụng)` : ''} — có thể đề nghị xử dưới mức thấp nhất của khung`, law: rules.a54.slice(0, 1).map((x) => ({ ref: `khoản ${x.k} Điều 54 BLHS`, quote: x.text })), yeuCau: `Đề nghị áp dụng khoản 1 Điều 54 BLHS, quyết định hình phạt dưới mức thấp nhất của khoản ${applied.k} Điều ${main.dieu} BLHS.` });
  return F.map((f) => ({ ...f, chieu: chieuOf(f) }));
}

/** Phát hiện có lợi cho bị cáo ('giam') hay theo hướng nặng hơn ('tang') — dùng khi xem xét đơn của từng bên. */
function chieuOf(f) {
  if (f.level === 'dung') return null;
  if (f.id === 'khung-tien') return f.nangHon ? 'tang' : 'giam';
  if (/^(tren-khung|chung-than|tu-hinh|trung-52-|can-cu-52-|bo-sot-51|de-nghi-54|de-nghi-an-treo|toi-danh-thieu)/.test(f.id)) return 'giam';
  if (/^(duoi-khung-khong-54|dieu-54-thieu|dieu-54-lien-ke|an-treo-qua-3|an-treo-tang-nang|trung-51-)/.test(f.id)) return 'tang';
  return null;
}

/* ---------------- Phân tích hành vi & hướng giải quyết ---------------- */
/**
 * Từ tài liệu vụ án: điều luật có căn cứ (yếu tố đủ / thiếu, câu trích), khung theo giá trị tài sản và dấu hiệu định khung,
 * tình tiết giảm nhẹ / tăng nặng có dấu hiệu, hướng giải quyết (định tội, khung, khả năng Điều 54 / 65, biện pháp tư pháp,
 * vấn đề cần làm rõ).
 */
export function analyzeCase({ sources = [], book = null, primary = null, defendants = [], amount = null } = {}) {
  const facts = sources.map((s) => s.text).join('\n');
  const sents = sentencesOf(sources);
  const cited = citedArticles(facts);
  // Điều có căn cứ: được viện dẫn / đang xét, hoặc đủ yếu tố mức cao; điều khớp yếu chỉ lấy khi chưa có điều nào.
  const all = lawCandidates(facts, { primary, cited, limit: 6 }).filter((x) => x.show || x.isPrimary || x.isCited);
  const strong = all.filter((x) => x.isPrimary || x.isCited || x.muc === 'cao');
  const cands = strong.length ? strong : all.slice(0, 2);
  const rules = generalRules(book);
  const money = amount ?? parseVerdict(facts).money.sort((a, b) => b.v - a.v)[0]?.v ?? null;
  const crimes = cands.map((c) => {
    const fr = (articleFrames(book, c.dieu) || []).filter((x) => !x.boSung);
    const byMoney = money != null ? fr.filter((x) => x.money.some((r) => money >= r.from && (r.to == null || money < r.to))).sort((a, b) => b.k - a.k)[0] : null;
    // Dấu hiệu định khung (điểm không phải giá trị tiền) có câu chứng minh trong tài liệu.
    const signs = [];
    for (const k of fr.filter((x) => x.k > 1))
      for (const p of k.points) {
        if (/đồng/u.test(p.text)) continue;
        const words = fold(p.text).replace(/[;.]/g, '').split(/\s+/).filter((w) => w.length > 2);
        if (words.length < 2) continue;
        const key = words.slice(0, 4).join(' ');
        const ev = sents.find((x) => fold(x.t).includes(key));
        if (ev) signs.push({ k: k.k, d: p.d, text: p.text, quote: ev.t, src: ev.src });
      }
    const khung = Math.max(byMoney?.k || 0, ...signs.map((s) => s.k), fr.length ? 1 : 0) || null;
    const frame = fr.find((x) => x.k === khung) || null;
    return { dieu: c.dieu, ten: c.ten, muc: c.muc, why: c.why, yeuTo: c.yeuTo || [], thieu: c.thieu || [], trich: c.trich, byMoney: byMoney?.k || null, signs, khung, frame, hint: '' };
  });
  if (crimes.length > 1) {
    const h = confusableHints(crimes.map((c) => c.dieu));
    if (h) crimes[0].hint = h.replace(/^\s*PHÂN BIỆT CÁC ĐIỀU DỄ NHẦM:\s*/u, '');
  }
  // Tình tiết có dấu hiệu trong tài liệu (chung cho vụ; theo bị cáo xem phần kiểm tra).
  const mitig = rules.a51.k1.map((p) => {
    const cue = MITIGATE_CUES.find(([k]) => k.test(p.text));
    const ev = cue ? evidence(sents, cue[1]) : null;
    return ev ? { d: p.d, text: p.text, quote: ev.t, src: ev.src } : null;
  }).filter(Boolean);
  const aggr = rules.a52.k1.map((p) => {
    const cue = AGGRAVATE_CUES.find(([k]) => k.test(p.text));
    const ev = cue ? evidence(sents, cue[1]) : null;
    return ev ? { d: p.d, text: p.text, quote: ev.t, src: ev.src } : null;
  }).filter(Boolean);
  // Hướng giải quyết.
  const huong = [];
  const top = crimes[0];
  if (top) {
    huong.push({ t: 'Định tội danh', d: `Hành vi có dấu hiệu tội “${top.ten.replace(/^Tội /, '')}” theo Điều ${top.dieu} BLHS${top.thieu.length ? `; còn cần làm rõ: ${top.thieu.map((x) => x.label || x).join('; ')}` : ''}.` });
    if (top.frame) {
      const p = top.frame.penalty;
      huong.push({ t: 'Khung hình phạt', d: `Khoản ${top.khung} Điều ${top.dieu}${top.byMoney ? ` (giá trị ${fmtVnd(money)})` : ''}${top.signs.length ? `; dấu hiệu định khung: ${top.signs.map((s) => `điểm ${s.d} khoản ${s.k}`).join(', ')}` : ''} — ${p.tuMin != null ? `phạt tù từ ${fmtMonths(p.tuMin)} đến ${fmtMonths(p.tuMax)}` : p.tuMax ? `phạt tù đến ${fmtMonths(p.tuMax)}` : 'xem nguyên văn khoản'}${p.chungThan ? ', tù chung thân' : ''}${p.tuHinh ? ', tử hình' : ''}.` });
      huong.push({ t: 'Mức hình phạt', d: mitig.length >= 2 && !aggr.length ? `Có ${mitig.length} tình tiết giảm nhẹ khoản 1 Điều 51 có dấu hiệu trong tài liệu, chưa thấy tình tiết tăng nặng → có thể xem xét mức thấp của khung hoặc dưới mức thấp nhất theo Điều 54${(p.tuMin ?? 99) <= rules.a65.maxTu ? '; nếu mức tù không quá ' + fmtMonths(rules.a65.maxTu) + ' có thể xem xét án treo (Điều 65)' : ''}.` : aggr.length > mitig.length ? `Tình tiết tăng nặng (${aggr.map((x) => `điểm ${x.d}`).join(', ')} khoản 1 Điều 52) nhiều hơn giảm nhẹ → mức hình phạt nghiêng về phần cao của khung.` : 'Cân nhắc các tình tiết giảm nhẹ, tăng nặng đã nêu khi quyết định mức hình phạt trong khung (Điều 50 BLHS).' });
    } else if (!book) huong.push({ t: 'Khung hình phạt', d: 'Nạp sách Bình luận khoa học BLHS để phần mềm lấy nguyên văn khung hình phạt của điều này.' });
    if (money) huong.push({ t: 'Trách nhiệm dân sự, biện pháp tư pháp', d: `Giải quyết việc trả lại tài sản, bồi thường thiệt hại (giá trị nêu trong tài liệu: ${fmtVnd(money)}) theo Điều 48 BLHS; tịch thu vật, tiền liên quan đến tội phạm theo Điều 47 BLHS nếu có.` });
    const lamRo = [...new Set(crimes.flatMap((c) => c.thieu.map((x) => x.label || x)))];
    if (lamRo.length) huong.push({ t: 'Vấn đề cần làm rõ', d: lamRo.join('; ') + '.' });
  } else huong.push({ t: 'Chưa xác định được tội danh', d: 'Tài liệu chưa đủ dấu hiệu cấu thành của điều luật nào — bổ sung bản án, cáo trạng, kết luận điều tra hoặc lời khai.' });
  return { crimes, mitig, aggr, huong, money, defendants };
}


/* ---------------- Xem xét đơn khiếu nại / kháng cáo (đơn do người khác gửi đến) ---------------- */
// Lời trình bày trong đơn KHÔNG phải chứng cứ: chỉ tài liệu vụ án đã nạp (bản án, cáo trạng, lời khai…) và nguyên văn điều
// luật mới là căn cứ để kết luận từng yêu cầu của đơn có căn cứ hay không. Tình tiết chỉ có trong đơn → "cần xác minh".
export const KET_LUAN = { co: 'Có căn cứ', 'mot-phan': 'Có căn cứ một phần', 'xac-minh': 'Cần xác minh thêm', khong: 'Không có căn cứ' };
export const LOAI_DON = { 'khang-cao': 'Đơn kháng cáo', 'giam-doc-tham': 'Đơn đề nghị giám đốc thẩm, tái thẩm', 'khieu-nai': 'Đơn khiếu nại', 'to-cao': 'Đơn tố cáo', 'kien-nghi': 'Đơn kiến nghị, đề nghị' };

// Các loại yêu cầu thường gặp trong đơn (khớp theo câu trong đơn).
const YEU_CAU = [
  { type: 'keu-oan', label: 'Kêu oan, cho rằng không phạm tội', re: /kêu oan|bị oan|oan sai|không phạm tội|vô tội|không (?:hề )?(?:có|thực hiện) hành vi|đình chỉ (?:vụ án|điều tra|bị can)/iu },
  { type: 'huy-an', label: 'Hủy bản án, điều tra / xét xử lại', re: /hủy (?:bỏ )?(?:toàn bộ |một phần )?(?:bản )?án(?! treo)|điều tra lại|xét xử lại|điều tra bổ sung/iu },
  { type: 'doi-toi', label: 'Xem xét lại tội danh', re: /(?:chuyển|đổi|thay đổi|xem xét lại|xác định lại) tội danh|tội danh (?:khác|không đúng|chưa đúng|sai)|định tội (?:sai|chưa đúng|không đúng)|(?:sang|thành) tội\s/iu },
  { type: 'doi-khoan', label: 'Áp dụng khoản (khung hình phạt) khác', re: /khoản\s+\d+\s+Điều\s+\d+|khung (?:hình phạt )?(?:nặng|cao|nhẹ|thấp) hơn|(?:sai|không đúng|chưa đúng) khung/iu },
  { type: 'bo-tang-nang', label: 'Không áp dụng tình tiết tăng nặng', re: /(?:không|bỏ)[^.;]{0,30}(?:áp dụng )?tình tiết tăng nặng|tình tiết tăng nặng[^.;]{0,50}(?:không đúng|không có căn cứ|sai|chưa đúng)|Điều 52[^.;]{0,40}(?:không đúng|không có căn cứ|sai)/iu },
  { type: 'them-giam-nhe', label: 'Áp dụng thêm tình tiết giảm nhẹ', re: /(?:áp dụng|xem xét|bổ sung|chưa (?:được )?(?:xem xét|áp dụng)|không (?:được )?(?:xem xét|áp dụng))[^.;]{0,40}tình tiết giảm nhẹ|khoản\s+[12]\s+Điều\s+51/iu },
  { type: 'an-treo', label: 'Cho hưởng án treo', re: /án treo|cải tạo (?:tại|ở) (?:địa phương|nhà|gia đình)|không (?:phải )?(?:đi |chấp hành (?:hình phạt )?)tù/iu },
  { type: 'giam-an', label: 'Giảm hình phạt', re: /giảm (?:nhẹ )?(?:một phần )?(?:hình phạt|án|mức án|mức hình phạt)|xin (?:được )?(?:xem xét )?giảm|xử (?:nhẹ|giảm)|(?:mức án|hình phạt)[^.;]{0,25}(?:quá )?(?:nặng|cao|nghiêm khắc)|khoan hồng|dưới mức thấp nhất/iu },
  { type: 'tang-an', label: 'Tăng hình phạt, không cho hưởng án treo', re: /tăng (?:nặng )?(?:hình phạt|mức án|án)|xử (?:nặng|nghiêm|thật nghiêm)|(?:mức án|hình phạt)[^.;]{0,25}(?:quá )?(?:nhẹ|thấp|chưa tương xứng|không tương xứng)|không (?:cho )?(?:bị cáo )?(?:được )?hưởng án treo|hủy (?:phần )?(?:quyết định )?(?:cho hưởng )?án treo/iu },
  { type: 'dan-su', label: 'Bồi thường, phần dân sự, tài sản', re: /(?:buộc|yêu cầu|đề nghị)[^.;]{0,40}(?:bồi thường|trả lại|hoàn trả)|trách nhiệm dân sự|phần dân sự|mức bồi thường|kê biên|tài sản bị (?:tịch thu|thu giữ|tạm giữ)|xử lý vật chứng/iu },
  { type: 'thu-tuc', label: 'Vi phạm thủ tục tố tụng', re: /vi phạm (?:nghiêm trọng )?(?:thủ tục )?tố tụng|ép cung|bức cung|mớm cung|nhục hình|đánh đập|không (?:được )?(?:có |mời |chỉ định )?(?:luật sư|người bào chữa)|không (?:được )?(?:tống đạt|giao|nhận)[^.;]{0,25}(?:bản án|cáo trạng|quyết định|giấy triệu tập)|không (?:được )?triệu tập|không (?:được )?(?:đối chất|thực nghiệm)|thiếu khách quan|không khách quan|(?:thay đổi|từ chối) (?:thẩm phán|kiểm sát viên|điều tra viên|người tiến hành)/iu },
];
const NAME_ANY = '((?:[A-ZĐÀ-Ỹ][\\p{L}\\u0300-\\u036f]*)(?:\\s+[A-ZĐÀ-Ỹ][\\p{L}\\u0300-\\u036f]*){1,4})';
const vnDate = (d, m, y) => `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
const toDate = (s) => {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s || ''));
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
};
const splitSents = (text) =>
  String(text || '')
    .replace(/\r/g, '')
    .split(/(?<=[.!?;])\s+|\n+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 8);

/**
 * Đọc đơn: loại đơn, người gửi (họ tên, năm sinh, nơi cư trú, tư cách), ngày đơn, bản án bị kháng cáo / khiếu nại,
 * các yêu cầu (loại + câu nguyên văn), tình tiết đơn nêu (theo nội dung điểm Điều 51), điều luật đơn viện dẫn.
 */
export function parseComplaint(text, { book = null } = {}) {
  const src = String(text || '').replace(/\r/g, '');
  const head = src.slice(0, 600);
  const sents = splitSents(src);
  const loai = /giám đốc thẩm|tái thẩm/iu.test(head) ? 'giam-doc-tham' : /kháng cáo/iu.test(head) ? 'khang-cao' : /tố cáo/iu.test(head) ? 'to-cao' : /khiếu nại/iu.test(head) ? 'khieu-nai' : /kháng cáo/iu.test(src) ? 'khang-cao' : /khiếu nại/iu.test(src) ? 'khieu-nai' : /kiến nghị|đề nghị/iu.test(head) ? 'kien-nghi' : null;
  const nguoi = {};
  const nm = new RegExp(`(?:Tôi\\s+(?:tên\\s+)?là|Họ (?:và )?tên(?: người (?:làm|viết|gửi) đơn)?)\\s*:?\\s*(?:ông|bà|anh|chị)?\\s*${NAME_ANY}`, 'u').exec(src);
  if (nm) nguoi.hoTen = nm[1].trim();
  const ns = /sinh (?:năm|ngày)[^0-9\n]{0,5}(?:\d{1,2}[/-]\d{1,2}[/-])?(\d{4})/iu.exec(src);
  if (ns) nguoi.namSinh = ns[1];
  const dc = /(?:Nơi cư trú|Địa chỉ|Trú tại|Thường trú|HKTT)\s*:?\s*([^\n]{5,150}?)(?:[.;]?\s*(?:\n|$|Số điện thoại|Điện thoại|Là\b))/iu.exec(src);
  if (dc) nguoi.diaChi = dc[1].trim().replace(/[.,;]$/, '');
  const tc = /tư cách[^:\n]{0,40}:\s*([^\n.;]{3,80})/iu.exec(src);
  const than = new RegExp(`là (bố|mẹ|cha|vợ|chồng|con|anh|chị|em)(?: đẻ| ruột)? của bị cáo\\s+${NAME_ANY}`, 'iu').exec(src);
  const role = /(người bị hại|bị hại|bị cáo|người bào chữa|luật sư|người đại diện hợp pháp|nguyên đơn dân sự|bị đơn dân sự|người có quyền lợi, nghĩa vụ liên quan)/iu.exec(src.slice(0, 1200));
  nguoi.tuCach = tc ? tc[1].trim() : than ? `${than[1].charAt(0).toUpperCase()}${than[1].slice(1)} của bị cáo ${than[2]}` : role ? role[1].charAt(0).toUpperCase() + role[1].slice(1) : '';
  // Ngày đơn: dòng "Địa danh, ngày … tháng … năm …"; không có thì ngày đầu tiên dạng đó.
  const dm = /,\s*ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/iu.exec(src) || /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/iu.exec(src);
  const ngay = dm ? vnDate(dm[1], dm[2], dm[3]) : '';
  const ba = /bản án[^.\n]{0,50}?số\s*:?\s*([0-9]{1,5}\/[0-9]{4}\/[A-ZĐ][A-ZĐ\-]*)/iu.exec(src);
  let banAnNgay = '';
  if (ba) {
    const after = src.slice(ba.index + ba[0].length, ba.index + ba[0].length + 60);
    const d1 = /ngày\s+(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/u.exec(after) || /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/u.exec(after);
    if (d1) banAnNgay = vnDate(d1[1], d1[2], d1[3]);
  }
  const biCao = [...new Set([...src.matchAll(new RegExp(`bị cáo\\s+${NAME_ANY}`, 'gu'))].map((m) => m[1].trim()))];

  // Yêu cầu: loại + câu nguyên văn (một câu có thể có nhiều yêu cầu).
  const yeuCau = [];
  for (const t of sents) {
    for (const y of YEU_CAU) {
      if (!y.re.test(t)) continue;
      if (y.type === 'keu-oan' && /không\s+(?:hề\s+)?kêu oan|(?<!không\s)thừa nhận/iu.test(t)) continue;
      if (y.type === 'an-treo' && YEU_CAU.find((x) => x.type === 'tang-an').re.test(t) && /án treo/iu.test(t)) continue;
      if (y.type === 'doi-khoan' && !/khung/iu.test(t) && !parseCitations(t).some((c) => c.khoan && findCrime(c.dieu))) continue;
      const cur = yeuCau.find((x) => x.type === y.type);
      if (cur) cur.quotes.length < 3 && !cur.quotes.includes(t) && cur.quotes.push(t);
      else yeuCau.push({ type: y.type, label: y.label, quotes: [t] });
    }
  }
  // Tình tiết giảm nhẹ đơn nêu (theo nội dung điểm của khoản 1 Điều 51 trong sách) và điều luật đơn viện dẫn.
  const rules = generalRules(book);
  const giamNhe = [];
  for (const p of rules.a51.k1) {
    const cue = MITIGATE_CUES.find(([k]) => k.test(p.text));
    const q = cue && sents.find((t) => cue[1].test(t));
    if (q) giamNhe.push({ d: p.d, text: p.text, quote: q });
  }
  const cites = parseCitations(src);
  for (const c of cites.filter((x) => x.dieu === '51' && x.khoan === 1))
    for (const d of c.diem) if (!giamNhe.some((g) => g.d === d)) giamNhe.push({ d, text: rules.a51.k1.find((p) => p.d === d)?.text || '', quote: sents.find((t) => new RegExp(`điểm[^.;]*\\b${d}\\b[^.;]*Điều 51`, 'iu').test(t)) || '' });
  const k2 = sents.find((t) => K2_CUE.test(t)) || (cites.some((c) => c.dieu === '51' && c.khoan === 2) ? sents.find((t) => /khoản 2 Điều 51/iu.test(t)) || '' : null);
  const tangNang = [...new Set(cites.filter((x) => x.dieu === '52').flatMap((x) => x.diem))];
  const dieuLuat = cites.filter((c) => findCrime(c.dieu));
  // Đơn nêu tình tiết giảm nhẹ (lý do) mà không có câu yêu cầu riêng → vẫn xem xét như yêu cầu áp dụng tình tiết giảm nhẹ.
  if ((giamNhe.length || k2) && !yeuCau.some((x) => x.type === 'them-giam-nhe')) {
    const quotes = [...new Set([...giamNhe.map((g) => g.quote), k2].filter(Boolean))].slice(0, 3);
    yeuCau.push({ type: 'them-giam-nhe', label: YEU_CAU.find((x) => x.type === 'them-giam-nhe').label, quotes });
  }
  return { loai, nguoi, ngay, banAn: { so: ba?.[1] || '', ngay: banAnNgay }, biCao, yeuCau, giamNhe, k2: k2 ?? null, tangNang, dieuLuat, sents };
}

/** Bị cáo mà đơn đề cập (theo tên trong đơn / tên người gửi); không rõ thì bị cáo đầu tiên. */
function targetOf(defendants, parsed) {
  const key = (n) => fold(n).split(' ').filter(Boolean).slice(-2).join(' ');
  const names = [...parsed.biCao, parsed.nguoi.hoTen].filter(Boolean).map(key);
  return defendants.find((d) => d.hoTen && names.includes(key(d.hoTen))) || defendants.find((d) => d.hoTen && fold(parsed.sents.join(' ')).includes(key(d.hoTen))) || defendants[0] || null;
}

/**
 * Xem xét đơn: mỗi yêu cầu → kết luận (Có căn cứ / Có căn cứ một phần / Cần xác minh thêm / Không có căn cứ), lý do,
 * căn cứ pháp lý (nguyên văn điều luật) và căn cứ thực tế (trích tài liệu vụ án); kết luận chung của đơn; lưu ý thời hạn.
 */
export function assessComplaint({ text = '', defendants = [], sources = [], book = null, banAn = {} } = {}) {
  const parsed = parseComplaint(text, { book });
  const d = targetOf(defendants, parsed);
  const rules = generalRules(book);
  const sents = sentencesOf(sources);
  const facts = sources.map((s) => s.text).join('\n');
  const F = d ? checkDefendant(d, { book, sources, rules }) : [];
  const main = d?.toiDanh?.[0] || {};
  const hp = d?.hinhPhat || {};
  const frames = main.dieu ? (articleFrames(book, main.dieu) || []).filter((x) => !x.boSung) : [];
  const applied = frames.find((x) => x.k === main.khoan) || null;
  const lawK = (x) => ({ ref: bl(main.dieu, x.k), quote: x.text.split('\n')[0] });
  const law51 = (p) => ({ ref: `điểm ${p.d} khoản 1 Điều 51 BLHS`, quote: p.text });
  const law65 = rules.a65.quote ? [{ ref: 'khoản 1 Điều 65 BLHS', quote: rules.a65.quote }] : [];
  const fromF = (f) => ({ text: [f.title, f.detail].filter(Boolean).join('. '), law: f.law || [], facts: f.facts || [] });
  const giamF = F.filter((f) => f.chieu === 'giam' && !/^(de-nghi-an-treo|toi-danh-thieu)$/.test(f.id));
  const tangF = F.filter((f) => f.chieu === 'tang');
  const ev = (re) => evidence(sents, re, { name: d?.hoTen || '' });
  const hpText = hp.loai === 'tu' && hp.thang != null ? `${fmtMonths(hp.thang)} tù${hp.anTreo ? ' (án treo)' : ''}` : hp.loai === 'cai-tao' ? `${fmtMonths(hp.thang)} cải tạo không giam giữ` : hp.loai === 'chung-than' ? 'tù chung thân' : hp.loai === 'tu-hinh' ? 'tử hình' : '';
  const baseline = () => {
    const tk = F.find((f) => f.id === 'trong-khung');
    if (!tk) return null;
    const used = (d.giamNhe || []).map((x) => `điểm ${x}`).join(', ');
    return { text: `${tk.title}; ${used ? `bản án đã áp dụng tình tiết giảm nhẹ ${used} khoản 1 Điều 51` : 'tài liệu không thể hiện tình tiết giảm nhẹ chưa được áp dụng'}${(d.tangNang || []).length ? `, tăng nặng điểm ${d.tangNang.join(', ')} khoản 1 Điều 52` : ''}.`, law: tk.law };
  };
  // Tình tiết giảm nhẹ đơn nêu: đã áp dụng / có chứng cứ trong tài liệu / chỉ có trong đơn.
  const claimed51 = () => {
    const out = { co: [], khong: [], xacMinh: [] };
    for (const g of parsed.giamNhe) {
      const p = rules.a51.k1.find((x) => x.d === g.d) || { d: g.d, text: g.text };
      const lq = p.text ? [law51(p)] : [];
      if ((d.giamNhe || []).includes(g.d)) out.khong.push({ text: `Tình tiết “${p.text.replace(/;$/, '')}” (điểm ${g.d} khoản 1 Điều 51) mà đơn nêu đã được bản án áp dụng.`, law: lq, don: g.quote });
      else {
        const cue = MITIGATE_CUES.find(([k]) => k.test(p.text || ''));
        const e = cue ? ev(cue[1]) : null;
        if (e) out.co.push({ text: `Tình tiết “${p.text.replace(/;$/, '')}” (điểm ${g.d} khoản 1 Điều 51) có trong tài liệu nhưng bản án chưa áp dụng.`, law: lq, facts: [{ quote: e.t, src: e.src }], don: g.quote });
        else out.xacMinh.push({ text: `Đơn nêu tình tiết “${(p.text || `điểm ${g.d}`).replace(/;$/, '')}” (điểm ${g.d} khoản 1 Điều 51) nhưng tài liệu đã nạp chưa có chứng cứ — yêu cầu người gửi đơn cung cấp tài liệu chứng minh (nếu là tình tiết mới phát sinh sau xét xử sơ thẩm thì xem xét tại phúc thẩm).`, law: lq, don: g.quote });
      }
    }
    if (parsed.k2 != null) {
      const lq = rules.a51.k2 ? [{ ref: 'khoản 2 Điều 51 BLHS', quote: rules.a51.k2 }] : [];
      if (d.giamNheK2) out.khong.push({ text: 'Tình tiết đơn nêu thuộc khoản 2 Điều 51 — bản án đã áp dụng khoản 2 Điều 51.', law: lq, don: parsed.k2 });
      else {
        const e = ev(K2_CUE);
        if (e) out.co.push({ text: 'Tài liệu có tình tiết có thể coi là giảm nhẹ theo khoản 2 Điều 51 (đầu thú, gia đình có công, bị hại xin giảm nhẹ…) nhưng bản án chưa áp dụng.', law: lq, facts: [{ quote: e.t, src: e.src }], don: parsed.k2 });
        else out.xacMinh.push({ text: 'Đơn nêu tình tiết thuộc khoản 2 Điều 51 nhưng tài liệu đã nạp chưa có chứng cứ — cần tài liệu chứng minh (giấy chứng nhận, đơn xin giảm nhẹ của bị hại…).', law: lq, don: parsed.k2 });
      }
    }
    return out;
  };

  const items = parsed.yeuCau.map((y) => {
    const it = { ...y, co: [], khong: [], xacMinh: [], kl: null };
    if (!d || !main.dieu) {
      it.xacMinh.push({ text: 'Chưa có quyết định của bản án để đối chiếu — đọc bản án (phần 1) hoặc nhập tội danh, hình phạt ở phần Bị cáo.' });
      return it;
    }
    switch (y.type) {
      case 'giam-an': {
        it.co.push(...giamF.filter((f) => !parsed.giamNhe.some((g) => f.id === `bo-sot-51-${g.d}`) && !(f.id === 'bo-sot-51-k2' && parsed.k2 != null)).map(fromF));
        const c = claimed51();
        it.co.push(...c.co);
        it.khong.push(...c.khong);
        it.xacMinh.push(...c.xacMinh);
        if (applied && hp.loai === 'tu' && hp.thang != null && hp.thang === applied.penalty.tuMin && !d.dieu54 && (d.giamNhe || []).length < 2)
          it.khong.push({ text: `Mức ${fmtMonths(hp.thang)} tù đã là mức thấp nhất của khoản ${applied.k}; chỉ xử dưới mức này khi đủ điều kiện Điều 54 (ít nhất hai tình tiết giảm nhẹ khoản 1 Điều 51).`, law: [lawK(applied), ...rules.a54.slice(0, 1).map((x) => ({ ref: `khoản ${x.k} Điều 54 BLHS`, quote: x.text }))] });
        if (!it.co.length && !it.khong.length && !it.xacMinh.length) {
          const b = baseline();
          if (b) it.khong.push(b);
          else it.xacMinh.push({ text: 'Chưa đủ dữ liệu để đối chiếu mức hình phạt (cần nguyên văn khung từ sách Bình luận và mức án đã tuyên).' });
        }
        break;
      }
      case 'an-treo': {
        if (hp.anTreo) it.khong.push({ text: 'Bản án đã cho bị cáo hưởng án treo.', law: law65 });
        else if (hp.loai !== 'tu' || hp.thang == null) it.xacMinh.push({ text: 'Chưa có mức phạt tù đã tuyên để đối chiếu điều kiện Điều 65.', law: law65 });
        else if (hp.thang > rules.a65.maxTu) {
          if (giamF.length) it.xacMinh.push({ text: `Mức tù đã tuyên ${fmtMonths(hp.thang)} quá ${fmtMonths(rules.a65.maxTu)} — chỉ xem xét án treo nếu mức tù được giảm xuống không quá ${fmtMonths(rules.a65.maxTu)} (đơn/tài liệu có căn cứ giảm hình phạt, xem yêu cầu giảm hình phạt).`, law: law65 });
          else it.khong.push({ text: `Mức tù đã tuyên ${fmtMonths(hp.thang)} quá ${fmtMonths(rules.a65.maxTu)} — không đủ điều kiện cho hưởng án treo.`, law: law65 });
        } else {
          const nMit = (d.giamNhe || []).length + F.filter((f) => /^bo-sot-51-[a-zđ]$/.test(f.id)).length;
          const aggr = (d.tangNang || []).filter((x) => !F.some((f) => f.id === `trung-52-${x}` || f.id === `can-cu-52-${x}`));
          const tot = ev(/nhân thân tốt|chưa có tiền án|nơi cư trú rõ ràng/iu);
          if (nMit >= 2) it.co.push({ text: `Mức tù ${fmtMonths(hp.thang)} không quá ${fmtMonths(rules.a65.maxTu)}; có ${nMit} tình tiết giảm nhẹ khoản 1 Điều 51.`, law: law65, facts: tot ? [{ quote: tot.t, src: tot.src }] : [] });
          else it.khong.push({ text: `Chỉ có ${nMit} tình tiết giảm nhẹ khoản 1 Điều 51 — chưa thể hiện điều kiện “nhiều tình tiết giảm nhẹ” để xem xét án treo.`, law: law65 });
          if (aggr.length) it.khong.push({ text: `Bị cáo có tình tiết tăng nặng điểm ${aggr.join(', ')} khoản 1 Điều 52 (có căn cứ trong tài liệu).`, law: aggr.map((x) => rules.a52.k1.find((p) => p.d === x)).filter(Boolean).map((p) => ({ ref: `điểm ${p.d} khoản 1 Điều 52 BLHS`, quote: p.text })) });
          if (!tot) it.xacMinh.push({ text: 'Cần xác minh nhân thân, nơi cư trú rõ ràng của bị cáo (tài liệu đã nạp chưa thể hiện).' });
        }
        break;
      }
      case 'keu-oan': {
        const ok = F.find((f) => f.id === 'toi-danh-ok');
        const thieu = F.find((f) => f.id === 'toi-danh-thieu');
        if (thieu) it.xacMinh.push({ text: `${thieu.title}. ${thieu.detail} — cần đối chiếu hồ sơ gốc; nếu hồ sơ cũng không có chứng cứ thì yêu cầu kêu oan có căn cứ.`, facts: thieu.facts });
        else if (ok) it.khong.push({ text: `${ok.title}: tài liệu thể hiện đủ các yếu tố cấu thành tội phạm.`, facts: ok.facts });
        else it.xacMinh.push({ text: 'Tài liệu đã nạp chưa đủ để đánh giá yếu tố cấu thành — bổ sung bản án, cáo trạng, lời khai.' });
        break;
      }
      case 'doi-toi': {
        const targets = [...new Set(parsed.dieuLuat.map((c) => c.dieu).filter((x) => x !== main.dieu))];
        const alts = F.filter((f) => /^toi-danh-khac-/.test(f.id));
        if (targets.length) {
          for (const x of targets) {
            const alt = alts.find((f) => f.id === `toi-danh-khac-${x}`);
            const cr = findCrime(x);
            if (alt) it.co.push(fromF(alt));
            else {
              const a = assessCrime(x, facts, { ctxText: facts });
              const miss = (a?.yeuTo || []).filter((e) => e.req && !e.ok);
              if (a?.show && !miss.length) it.co.push({ text: `Tài liệu có đủ dấu hiệu Điều ${x} (${cr?.ten || ''}) mà đơn đề nghị.`, facts: groupQuotes((a.yeuTo || []).filter((e) => e.ok)).slice(0, 2) });
              else it.khong.push({ text: `Tài liệu chưa thể hiện dấu hiệu Điều ${x}${cr ? ` (${cr.ten})` : ''} mà đơn đề nghị${miss.length ? `: thiếu ${miss.map((e) => e.label).join('; ')}` : ''}.` });
            }
          }
        } else if (alts.length) it.co.push(...alts.map(fromF));
        const ok = F.find((f) => f.id === 'toi-danh-ok');
        if (!it.co.length && ok) it.khong.push({ text: `${ok.title}.`, facts: ok.facts });
        if (!it.co.length && !it.khong.length) it.xacMinh.push({ text: 'Tài liệu đã nạp chưa đủ để đánh giá lại tội danh.' });
        break;
      }
      case 'doi-khoan': {
        const kt = F.find((f) => f.id === 'khung-tien');
        const ktOk = F.find((f) => f.id === 'khung-tien-ok');
        const req = [...new Set(parsed.dieuLuat.filter((c) => c.dieu === main.dieu && c.khoan && c.khoan !== main.khoan).map((c) => c.khoan))];
        if (kt && (!req.length || req.includes(kt.khoanDung))) it.co.push(fromF(kt));
        else if (kt) it.khong.push({ text: `Theo giá trị tài sản, khoản phù hợp là khoản ${kt.khoanDung}, không phải khoản ${req.join(', ')} như đơn đề nghị.`, law: kt.law });
        else if (ktOk) it.khong.push({ text: `${ktOk.title} — đơn đề nghị ${req.length ? `khoản ${req.join(', ')}` : 'khung khác'} không phù hợp giá trị tài sản.`, law: ktOk.law });
        else if (applied) it.xacMinh.push({ text: `Chưa có giá trị tài sản / dấu hiệu định khung để đối chiếu khoản ${applied.k} đã áp dụng.`, law: [lawK(applied)] });
        else it.xacMinh.push({ text: 'Chưa có nguyên văn khung hình phạt (nạp sách Bình luận) hoặc khoản đã áp dụng.' });
        break;
      }
      case 'bo-tang-nang': {
        const ds = parsed.tangNang.length ? parsed.tangNang : d.tangNang || [];
        if (!(d.tangNang || []).length) it.khong.push({ text: 'Bản án không áp dụng tình tiết tăng nặng nào (khoản 1 Điều 52).' });
        for (const x of ds) {
          const p = rules.a52.k1.find((q) => q.d === x);
          const lq = p ? [{ ref: `điểm ${x} khoản 1 Điều 52 BLHS`, quote: p.text }] : [];
          const f = F.find((q) => q.id === `trung-52-${x}` || q.id === `can-cu-52-${x}`);
          if (!(d.tangNang || []).includes(x)) continue;
          if (f) it.co.push(fromF(f));
          else {
            const cue = p && AGGRAVATE_CUES.find(([k]) => k.test(p.text));
            const e = cue ? ev(cue[1]) : null;
            if (e) it.khong.push({ text: `Tình tiết tăng nặng điểm ${x} khoản 1 Điều 52 có căn cứ trong tài liệu.`, law: lq, facts: [{ quote: e.t, src: e.src }] });
            else it.xacMinh.push({ text: `Cần kiểm tra căn cứ áp dụng tình tiết tăng nặng điểm ${x} khoản 1 Điều 52.`, law: lq });
          }
        }
        break;
      }
      case 'them-giam-nhe': {
        const c = claimed51();
        it.co.push(...c.co);
        it.khong.push(...c.khong);
        it.xacMinh.push(...c.xacMinh);
        if (!parsed.giamNhe.length && parsed.k2 == null) {
          const bs = F.filter((f) => /^bo-sot-51/.test(f.id));
          if (bs.length) it.co.push(...bs.map(fromF));
          else it.khong.push({ text: `Các tình tiết giảm nhẹ có dấu hiệu trong tài liệu đã được bản án áp dụng${(d.giamNhe || []).length ? ` (điểm ${d.giamNhe.join(', ')} khoản 1 Điều 51)` : ''}.` });
        }
        break;
      }
      case 'tang-an': {
        it.co.push(...tangF.map(fromF));
        const kt = F.find((f) => f.id === 'khung-tien' && f.nangHon);
        if (kt && !it.co.some((x) => x.text.startsWith(kt.title))) it.co.push(fromF(kt));
        // Giảm nhẹ đã áp dụng nhưng tài liệu không có căn cứ; tăng nặng có căn cứ nhưng chưa áp dụng.
        for (const x of d.giamNhe || []) {
          const p = rules.a51.k1.find((q) => q.d === x);
          const cue = p && MITIGATE_CUES.find(([k]) => k.test(p.text));
          if (cue && sources.length && !ev(cue[1])) it.co.push({ text: `Chưa thấy căn cứ trong tài liệu cho tình tiết giảm nhẹ điểm ${x} khoản 1 Điều 51 mà bản án đã áp dụng.`, law: [law51(p)] });
        }
        for (const p of rules.a52.k1) {
          if ((d.tangNang || []).includes(p.d)) continue;
          const cue = AGGRAVATE_CUES.find(([k]) => k.test(p.text));
          const e = cue ? ev(cue[1]) : null;
          if (e && !/chức vụ/u.test(p.text)) it.co.push({ text: `Tài liệu thể hiện tình tiết tăng nặng “${p.text.replace(/;$/, '')}” (điểm ${p.d} khoản 1 Điều 52) nhưng bản án chưa áp dụng (trừ khi đã là dấu hiệu định tội, định khung).`, law: [{ ref: `điểm ${p.d} khoản 1 Điều 52 BLHS`, quote: p.text }], facts: [{ quote: e.t, src: e.src }] });
        }
        if (!it.co.length) {
          const b = baseline();
          if (b) it.khong.push(b);
          else it.xacMinh.push({ text: 'Chưa đủ dữ liệu để đối chiếu mức hình phạt (cần nguyên văn khung và mức án đã tuyên).' });
        }
        break;
      }
      case 'dan-su': {
        const money = parseVerdict(facts).money.sort((a, b) => b.v - a.v).slice(0, 2);
        it.xacMinh.push({ text: 'Yêu cầu về bồi thường, tài sản, vật chứng — đối chiếu chứng cứ về thiệt hại, biên bản thu giữ, thỏa thuận bồi thường (Điều 47, 48 BLHS và quy định dân sự); phần mềm chỉ kiểm tra phần hình sự.', facts: money.map((m) => ({ quote: m.quote, src: 'Tài liệu' })) });
        break;
      }
      case 'thu-tuc': {
        const q = y.quotes.join(' ');
        const hints = [];
        if (/ép cung|bức cung|mớm cung|nhục hình|đánh đập/iu.test(q)) hints.push('đối chiếu các biên bản lấy lời khai, ghi âm ghi hình có âm thanh (nếu có), lời khai các lần, kết quả giám định thương tích (nếu có)');
        if (/luật sư|người bào chữa/iu.test(q)) hints.push('kiểm tra việc chỉ định, tham gia của người bào chữa (trường hợp bắt buộc có người bào chữa)');
        if (/tống đạt|giao|nhận|triệu tập/iu.test(q)) hints.push('kiểm tra biên bản giao, tống đạt, giấy triệu tập');
        if (/khách quan|thay đổi|từ chối/iu.test(q)) hints.push('kiểm tra căn cứ thay đổi người tiến hành tố tụng');
        const e = sents.find((x) => /bào chữa|luật sư|tống đạt|triệu tập|ghi âm|ghi hình/iu.test(x.t));
        it.xacMinh.push({ text: `Cần kiểm tra hồ sơ tố tụng: ${hints.join('; ') || 'đối chiếu hồ sơ về thủ tục đơn nêu'}.`, facts: e ? [{ quote: e.t, src: e.src }] : [] });
        break;
      }
      case 'huy-an': {
        const thieu = F.find((f) => f.id === 'toi-danh-thieu');
        const loi = F.filter((f) => f.level === 'loi');
        if (thieu) it.xacMinh.push({ text: `${thieu.title} — nếu hồ sơ không bổ sung được tại phiên tòa thì có căn cứ hủy án để điều tra lại.`, facts: thieu.facts });
        if (loi.length) it.xacMinh.push({ text: `Có sai sót về áp dụng pháp luật (${loi.map((f) => f.title).join('; ')}) — thường được sửa tại phúc thẩm, chỉ hủy án khi không sửa được.` });
        it.xacMinh.push({ text: 'Hủy án khi có vi phạm nghiêm trọng thủ tục tố tụng hoặc cần điều tra, xét xử lại — cần kiểm tra hồ sơ.' });
        break;
      }
      default:
        it.xacMinh.push({ text: 'Đối chiếu thủ công nội dung yêu cầu với hồ sơ.' });
    }
    it.kl = it.co.length && !it.khong.length ? 'co' : it.co.length ? 'mot-phan' : it.xacMinh.length ? 'xac-minh' : 'khong';
    return it;
  });
  if (!items.length) items.push({ type: 'khac', label: 'Chưa nhận ra yêu cầu cụ thể', quotes: [], co: [], khong: [], xacMinh: [{ text: 'Đơn không có câu yêu cầu rõ (giảm án, án treo, kêu oan, đổi tội danh, khung, tình tiết, dân sự, thủ tục…) — đọc đơn và đối chiếu thủ công.' }], kl: 'xac-minh' });

  // Lưu ý: thời hạn kháng cáo (Điều 333 BLTTHS: 15 ngày kể từ ngày tuyên án), bị cáo đơn đề cập.
  const notes = [];
  const tuyen = toDate(parsed.banAn.ngay || banAn.ngay);
  const ngayDon = toDate(parsed.ngay);
  if (parsed.loai === 'khang-cao' && tuyen && ngayDon) {
    const days = Math.round((ngayDon - tuyen) / 86400000);
    notes.push(days > 15 ? { level: 'canh', text: `Đơn đề ngày ${parsed.ngay}, sau ngày tuyên án ${parsed.banAn.ngay || banAn.ngay} là ${days} ngày — quá thời hạn kháng cáo 15 ngày (Điều 333 BLTTHS); kiểm tra ngày gửi đơn thực tế (dấu bưu điện) và lý do kháng cáo quá hạn.` } : { level: 'dung', text: `Đơn đề ngày ${parsed.ngay}, ${days} ngày sau ngày tuyên án — trong thời hạn kháng cáo 15 ngày (Điều 333 BLTTHS), tính theo ngày ghi trên đơn.` });
  }
  if (d && defendants.length > 1) notes.push({ level: 'goi', text: `Đơn được đối chiếu với quyết định của bị cáo ${d.hoTen || '(chưa ghi tên)'}.` });
  if (!book) notes.push({ level: 'canh', text: 'Chưa nạp sách Bình luận BLHS — chưa đối chiếu được khung, mức hình phạt, Điều 51, 52, 54, 65.' });

  const kls = items.map((x) => x.kl);
  const overall = kls.every((k) => k === 'khong') ? 'khong' : kls.every((k) => k === 'co') ? 'co' : kls.some((k) => k === 'co' || k === 'mot-phan') ? 'mot-phan' : kls.some((k) => k === 'khong') && !kls.some((k) => k === 'xac-minh') ? 'khong' : 'xac-minh';
  return { parsed, defendant: d, hinhPhat: hpText, items, notes, overall };
}

/* ---------------- Phiếu xem xét đơn (Word) ---------------- */
const run = (text, o = {}) => ({ text, ...o });
const para = (runs, o = {}) => ({ runs: Array.isArray(runs) ? runs : [run(runs)], align: 'justify', indent: true, ...o });
const head = (t) => para([run(t, { bold: true })], { indent: false, spaceBefore: true });

/** Phiếu xem xét đơn (doc model): thông tin đơn, kết luận chung, từng yêu cầu với lý do và căn cứ, lưu ý, đề xuất. */
export function buildReviewDocument(result, { banAn = {}, org = {}, ten = '' } = {}) {
  const { parsed, items, notes, overall, defendant, hinhPhat } = result;
  const n = parsed.nguoi;
  const d = new Date();
  const body = [];
  body.push(head('I. THÔNG TIN ĐƠN'));
  body.push(para(`Loại đơn: ${LOAI_DON[parsed.loai] || 'Đơn'}${parsed.ngay ? `, đề ngày ${parsed.ngay}` : ''}.`));
  body.push(para(`Người gửi: ${n.hoTen || '…………………'}${n.namSinh ? `, sinh năm ${n.namSinh}` : ''}${n.diaChi ? `; nơi cư trú: ${n.diaChi}` : ''}${n.tuCach ? `; tư cách: ${n.tuCach}` : ''}.`));
  const so = parsed.banAn.so || banAn.so;
  body.push(para(`Bản án bị kháng cáo / khiếu nại: ${so ? `số ${so}` : '…………'}${parsed.banAn.ngay || banAn.ngay ? ` ngày ${parsed.banAn.ngay || banAn.ngay}` : ''}${banAn.toa ? ` của ${banAn.toa}` : ''}${defendant?.hoTen ? `; bị cáo ${defendant.hoTen}` : ''}${defendant?.toiDanh?.[0]?.dieu ? `, ${defendant.toiDanh[0].khoan ? `khoản ${defendant.toiDanh[0].khoan} ` : ''}Điều ${defendant.toiDanh[0].dieu} BLHS` : ''}${hinhPhat ? `, ${hinhPhat}` : ''}.`));
  body.push(head('II. KẾT LUẬN CHUNG'));
  body.push(para([run(`Đơn ${KET_LUAN[overall].toLowerCase()}`, { bold: true }), run(` — ${items.length} yêu cầu: ${Object.keys(KET_LUAN).map((k) => [k, items.filter((x) => x.kl === k).length]).filter(([, c]) => c).map(([k, c]) => `${c} ${KET_LUAN[k].toLowerCase()}`).join(', ')}.`)]));
  body.push(head('III. XEM XÉT TỪNG YÊU CẦU'));
  items.forEach((it, i) => {
    body.push(para([run(`${i + 1}. ${it.label}: `, { bold: true }), run(KET_LUAN[it.kl], { bold: true, italic: true })], { indent: false, spaceBefore: true }));
    it.quotes.forEach((q) => body.push(para([run('Nội dung đơn: ', { italic: true }), run(`“${q}”`)])));
    const block = (title, list) => {
      list.forEach((r) => {
        body.push(para([run(`${title}: `, { italic: true }), run(r.text)]));
        (r.law || []).forEach((l) => body.push(para([run('Căn cứ pháp lý: ', { italic: true }), run(`${l.ref}${l.quote ? `: “${l.quote}”` : ''}`)])));
        (r.facts || []).forEach((f) => body.push(para([run('Căn cứ thực tế: ', { italic: true }), run(`“${f.quote}”${f.src ? ` (${f.src})` : ''}`)])));
      });
    };
    block('Có căn cứ', it.co);
    block('Không có căn cứ', it.khong);
    block('Cần xác minh', it.xacMinh);
  });
  if (notes.length) {
    body.push(head('IV. LƯU Ý'));
    notes.forEach((x) => body.push(para(`- ${x.text}`)));
  }
  body.push(head(`${notes.length ? 'V' : 'IV'}. ĐỀ XUẤT`));
  const xm = items.filter((x) => x.kl === 'xac-minh').map((x) => x.label.toLowerCase());
  const co = items.filter((x) => x.kl === 'co' || x.kl === 'mot-phan').map((x) => x.label.toLowerCase());
  if (co.length) body.push(para(`Xem xét chấp nhận (toàn bộ hoặc một phần) các yêu cầu: ${co.join('; ')}.`));
  if (xm.length) body.push(para(`Yêu cầu bổ sung tài liệu, xác minh đối với: ${xm.join('; ')}.`));
  const kh = items.filter((x) => x.kl === 'khong').map((x) => x.label.toLowerCase());
  if (kh.length) body.push(para(`Không chấp nhận các yêu cầu: ${kh.join('; ')} (lý do nêu tại mục III).`));
  body.push(para([run('Phiếu lập trên cơ sở tài liệu đã nạp vào phần mềm; người có thẩm quyền đối chiếu hồ sơ gốc trước khi quyết định.', { italic: true })], { indent: false, spaceBefore: true }));
  return {
    typeId: 'phieu-xem-xet-don',
    header: { parent: org.coQuanCapTren || '', org: org.coQuan || '', number: '', subject: null, placeDate: `${org.diaDanh ? `${org.diaDanh}, ` : ''}ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}` },
    title: { name: 'PHIẾU XEM XÉT ĐƠN', subject: `${LOAI_DON[parsed.loai] || 'Đơn'}${n.hoTen ? ` của ${n.hoTen}` : ''}${ten ? ` — ${ten}` : ''}` },
    authority: null,
    recipients: null,
    body,
    sign: null,
    dualSign: null,
    signers: [{ title: 'NGƯỜI LẬP PHIẾU', hint: '(Ký, ghi rõ họ tên)', name: '' }],
  };
}
