// Mục "Tòa án": đọc bản án / cáo trạng, phân tích hành vi phạm tội, kiểm tra tội danh – khung – mức hình phạt đã áp dụng,
// lập các yêu cầu khiếu nại / kháng cáo có căn cứ.
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
const K2_CUE = /đầu thú|gia đình (?:có công|chính sách)|(?:bố|mẹ|cha|ông|bà|anh|chị)[^.]{0,40}(?:có công|liệt sĩ|huân chương|huy chương)|bị hại (?:có đơn )?(?:xin giảm nhẹ|bãi nại)|đơn xin giảm nhẹ/iu;
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
  return F;
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

/* ---------------- Yêu cầu khiếu nại / kháng cáo có căn cứ ---------------- */
export const DON = {
  'khang-cao': { ten: 'ĐƠN KHÁNG CÁO', ve: 'Kháng cáo bản án sơ thẩm', gui: 'Tòa án nhân dân đã xét xử sơ thẩm' },
  'giam-doc-tham': { ten: 'ĐƠN ĐỀ NGHỊ XEM XÉT THEO THỦ TỤC GIÁM ĐỐC THẨM', ve: 'Đề nghị xem xét lại bản án đã có hiệu lực pháp luật', gui: 'Chánh án Tòa án nhân dân / Viện trưởng Viện kiểm sát nhân dân có thẩm quyền' },
  'khieu-nai': { ten: 'ĐƠN KHIẾU NẠI', ve: 'Khiếu nại quyết định, hành vi tố tụng', gui: 'Cơ quan, người có thẩm quyền giải quyết khiếu nại' },
};

/** Gom các phát hiện có yêu cầu thành căn cứ khiếu nại / kháng cáo (sai rõ trước, rồi đề nghị). */
export function appealGrounds(findings = []) {
  const order = { loi: 0, canh: 1, goi: 2 };
  return findings
    .filter((f) => f.yeuCau && f.level !== 'dung')
    .sort((a, b) => order[a.level] - order[b.level])
    .map((f) => ({ id: f.id, level: f.level, yeuCau: f.yeuCau, lyDo: [f.title, f.detail].filter(Boolean).join('. '), law: f.law || [], facts: f.facts || [] }));
}

const run = (text, o = {}) => ({ text, ...o });
const para = (runs, o = {}) => ({ runs: Array.isArray(runs) ? runs : [run(runs)], align: 'justify', indent: true, ...o });
const head = (t) => para([run(t, { bold: true })], { indent: false, spaceBefore: true });

/** Đơn kháng cáo / đề nghị giám đốc thẩm / khiếu nại (doc model) từ các căn cứ đã chọn. */
export function buildAppealDocument({ kind = 'khang-cao', nguoi = {}, banAn = {}, grounds = [], diaDanh = '' } = {}) {
  const k = DON[kind] || DON['khang-cao'];
  const d = new Date();
  const body = [];
  body.push(para([run('Kính gửi: ', { bold: true }), run(banAn.toa || k.gui)], { indent: false }));
  body.push(para(`Tôi là: ${nguoi.hoTen || '…………………'}${nguoi.namSinh ? `, sinh năm ${nguoi.namSinh}` : ''}.`));
  body.push(para(`Nơi cư trú: ${nguoi.diaChi || '…………………………………………'}.`));
  body.push(para(`Tư cách tham gia tố tụng: ${nguoi.tuCach || '…………………'}.`));
  body.push(para(`${k.ve}${banAn.so ? ` số ${banAn.so}` : ''}${banAn.ngay ? ` ngày ${banAn.ngay}` : ''}${banAn.toa ? ` của ${banAn.toa}` : ''}${banAn.biCao ? ` xét xử bị cáo ${banAn.biCao}` : ''}.`));
  body.push(head('I. NỘI DUNG YÊU CẦU'));
  grounds.forEach((g, i) => body.push(para(`${i + 1}. ${g.yeuCau}`)));
  body.push(head('II. LÝ DO VÀ CĂN CỨ'));
  grounds.forEach((g, i) => {
    body.push(para([run(`${i + 1}. `, { bold: true }), run(g.lyDo)]));
    g.law.forEach((l) => body.push(para([run('Căn cứ pháp lý: ', { italic: true }), run(`${l.ref}${l.quote ? `: “${l.quote}”` : ''}`)])));
    g.facts.forEach((f) => body.push(para([run('Căn cứ thực tế: ', { italic: true }), run(`“${f.quote}”${f.src ? ` (${f.src})` : ''}`)])));
  });
  body.push(para('Vì các lý do trên, kính đề nghị cơ quan có thẩm quyền xem xét, giải quyết theo quy định của pháp luật.'));
  body.push(para('Tài liệu kèm theo (nếu có): …………………………………………', { indent: false }));
  const placeDate = `${diaDanh ? `${diaDanh}, ` : '……………, '}ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
  body.push(para([run(placeDate, { italic: true })], { indent: false, align: 'right', spaceBefore: true }));
  // Đơn của công dân: bố cục mẫu (quốc hiệu giữa trang, không có ô cơ quan ban hành); người làm đơn ký bên phải.
  return {
    typeId: 'don-toa-an',
    layout: 'form',
    header: { parent: '', org: '', number: '', subject: null, placeDate },
    title: { name: k.ten, subject: `(V/v ${k.ve.toLowerCase()})` },
    authority: null,
    recipients: null,
    body,
    sign: null,
    dualSign: null,
    signers: [{ title: '', name: '' }, { title: 'NGƯỜI LÀM ĐƠN', hint: '(Ký, ghi rõ họ tên)', name: nguoi.hoTen || '' }],
  };
}
