// Rà soát chứng cứ cho thẩm tra: loại tài liệu, bút lục, ma trận "yếu tố cấu thành ↔ chứng cứ" theo từng tài liệu,
// phát hiện thiếu tài liệu / tài liệu không đọc được, yếu tố chỉ dựa vào lời nhận tội, mâu thuẫn (số tiền, nhân thân,
// nhận định – quyết định của bản án), lời khai không thừa nhận. Chống suy diễn: thiếu thì báo thiếu, không tự tạo chứng cứ.
import { findCrime } from './engine.js';
import { assessCrime } from './relevance.js';
import { amountsIn } from './terms.js';
import { sentencesOf, parseCitations, generalRules, articleFrames, moneyRanges, MITIGATE_CUES, AGGRAVATE_CUES, evidence, fmtVnd } from './court.js';

export const SOURCE_TYPES = [
  ['ban-an', 'Bản án'],
  ['cao-trang', 'Cáo trạng'],
  ['kl-dieu-tra', 'Kết luận điều tra'],
  ['loi-khai-bi-cao', 'Lời khai bị can, bị cáo'],
  ['loi-khai-bi-hai', 'Lời khai bị hại'],
  ['loi-khai-khac', 'Lời khai người làm chứng, người liên quan'],
  ['kl-giam-dinh', 'Kết luận giám định'],
  ['kl-dinh-gia', 'Kết luận định giá tài sản'],
  ['bien-ban', 'Biên bản (khám nghiệm, thu giữ, đối chất…)'],
  ['don', 'Đơn, kiến nghị, kháng nghị'],
  ['khac', 'Tài liệu khác'],
];
export const typeLabel = (id) => SOURCE_TYPES.find((x) => x[0] === id)?.[1] || 'Tài liệu khác';
const CONFESSION = new Set(['loi-khai-bi-cao']);

/** Đoán loại tài liệu theo tên tệp / đầu văn bản (người dùng sửa được). */
export function detectType(name = '', text = '') {
  const h = `${name}\n${String(text).slice(0, 800)}`.normalize('NFC');
  if (/bản án/iu.test(h) && /NHÂN DANH|Bản án số|HS-ST|HS-PT/iu.test(h)) return 'ban-an';
  if (/cáo trạng/iu.test(h)) return 'cao-trang';
  if (/KẾT LUẬN ĐIỀU TRA|kết luận điều tra/iu.test(h)) return 'kl-dieu-tra';
  if (/KẾT LUẬN ĐỊNH GIÁ|định giá tài sản/iu.test(h)) return 'kl-dinh-gia';
  if (/KẾT LUẬN GIÁM ĐỊNH|giám định/iu.test(h)) return 'kl-giam-dinh';
  if (/^Lời khai:|BIÊN BẢN (?:LẤY LỜI KHAI|HỎI CUNG|GHI LỜI KHAI)/imu.test(h)) {
    if (/BỊ CAN|BỊ CÁO|hỏi cung/iu.test(h)) return 'loi-khai-bi-cao';
    if (/BỊ HẠI/iu.test(h)) return 'loi-khai-bi-hai';
    return 'loi-khai-khac';
  }
  if (/BIÊN BẢN/u.test(h)) return 'bien-ban';
  if (/^ĐƠN|ĐƠN (?:KHÁNG CÁO|KHIẾU NẠI|ĐỀ NGHỊ|KIẾN NGHỊ)|QUYẾT ĐỊNH KHÁNG NGHỊ/mu.test(h)) return 'don';
  return 'khac';
}
/** "Tên tài liệu, BL 12–15" (khoảng bút lục của cả tài liệu). */
export function srcRange(s) {
  const start = Number.isFinite(+s.butLuc) && String(s.butLuc).trim() !== '' ? +s.butLuc : null;
  if (start == null) return '';
  const n = Array.isArray(s.pages) && s.pages.length > 1 ? s.pages.length : 1;
  return n > 1 ? `BL ${start}–${start + n - 1}` : `BL ${start}`;
}

/**
 * Ma trận yếu tố cấu thành ↔ chứng cứ cho một điều luật: mỗi yếu tố → các tài liệu chứng minh (câu trích + bút lục).
 * Chạy bộ nhận diện riêng trên từng tài liệu để biết yếu tố được NHIỀU nguồn hay chỉ một nguồn (lời nhận tội) chứng minh.
 */
export function elementMatrix(dieu, sources = []) {
  if (!findCrime(dieu)) return [];
  const all = assessCrime(dieu, '', { sentences: sentencesOf(sources) });
  const els = (all?.yeuTo || []).map((y) => ({ id: y.id, label: y.label, req: !!y.req, support: [] }));
  for (const s of sources) {
    if (s.loai === 'don') continue; // đơn không phải chứng cứ
    const sents = sentencesOf([s]);
    const r = assessCrime(dieu, '', { sentences: sents });
    for (const y of r?.yeuTo || []) {
      if (!y.ok || !y.quote) continue;
      const el = els.find((e) => e.id === y.id);
      const hit = sents.find((x) => x.t === y.quote);
      if (el) el.support.push({ quote: y.quote, src: hit?.src || s.name, loai: s.loai || 'khac' });
    }
  }
  for (const e of els) e.onlyConfession = e.support.length > 0 && e.support.every((x) => CONFESSION.has(x.loai));
  return els;
}

const moneySents = (sents) => sents.filter((x) => /(chiếm đoạt|thiệt hại|trị giá|chiếm giữ|thu lợi|nhận hối lộ|tham ô|chiếm hưởng)/iu.test(x.t)).flatMap((x) => amountsIn(x.t).filter((a) => a.v >= 100000).map((a) => ({ v: a.v, quote: x.t, src: x.src, name: x.name })));
const CHAPTER_PROPERTY = (d) => +d >= 168 && +d <= 180;

/**
 * Rà soát chứng cứ của hồ sơ xét xử. Trả về [{ id, muc: 'thieu'|'mau-thuan'|'canh'|'dat', title, detail, facts, law }].
 */
export function reviewEvidence(rec = {}, { book = null } = {}) {
  const sources = (rec.sources || []).filter((s) => s.loai !== 'don');
  const F = [];
  const add = (f) => F.push({ facts: [], law: [], ...f });
  const types = new Set(sources.map((s) => s.loai || 'khac'));
  const defs = (rec.defendants || []).filter((d) => d.hoTen || d.toiDanh?.[0]?.dieu);
  if (!sources.length) {
    add({ id: 'khong-tai-lieu', muc: 'thieu', title: 'Chưa có tài liệu hồ sơ', detail: 'Tải bản án, cáo trạng, kết luận điều tra, lời khai, kết luận giám định… ở tab Tài liệu & bị cáo. Không có tài liệu thì không đánh giá được chứng cứ.' });
    return F;
  }
  // 1. Tài liệu cần có nhưng chưa có trong hồ sơ đã nạp.
  const need = [];
  const checkingVerdict = rec.cap === 'phuc-tham' || rec.banAn?.so || defs.some((d) => d.hinhPhat?.loai);
  if (checkingVerdict) need.push(['ban-an', 'Bản án bị kháng cáo, kháng nghị / đề nghị xem xét']);
  need.push(['cao-trang', 'Cáo trạng'], ['loi-khai-bi-cao', 'Lời khai bị can, bị cáo']);
  const dieus = [...new Set(defs.map((d) => d.toiDanh?.[0]?.dieu).filter(Boolean))];
  if (dieus.some((d) => CHAPTER_PROPERTY(d) || d === '134')) need.push(['loi-khai-bi-hai', 'Lời khai bị hại']);
  if (dieus.some((d) => d === '134' || (+d >= 248 && +d <= 252))) need.push(['kl-giam-dinh', dieus.includes('134') ? 'Kết luận giám định tỷ lệ tổn thương cơ thể' : 'Kết luận giám định']);
  const money = moneySents(sentencesOf(sources));
  if (dieus.some(CHAPTER_PROPERTY) && money.length && !money.some((m) => /tiền/iu.test(m.quote))) need.push(['kl-dinh-gia', 'Kết luận định giá tài sản (tài sản không phải tiền)']);
  for (const [id, label] of need) if (!types.has(id)) add({ id: `thieu-${id}`, muc: 'thieu', title: `Hồ sơ đã nạp chưa có: ${label}`, detail: 'Đề nghị bổ sung tài liệu trước khi kết luận (hoặc gán đúng loại cho tài liệu đã nạp).' });
  // 2. Tài liệu đọc không được / quá ngắn.
  for (const s of sources) {
    const len = String(s.text || '').replace(/\s/g, '').length;
    if (len < 150 || (s.ocrConf != null && s.ocrConf < 0.6)) add({ id: `khong-doc-${s.name}`, muc: 'canh', title: `Tài liệu “${s.name}” đọc không đầy đủ`, detail: s.ocrConf != null ? `Nhận dạng chữ (OCR) độ tin cậy ${Math.round(s.ocrConf * 100)}% — đối chiếu bản gốc.` : 'Nội dung quá ngắn — kiểm tra tệp gốc (bản quét mờ, thiếu trang).' });
  }
  // 3. Yếu tố cấu thành: chưa có chứng cứ / chỉ dựa vào lời nhận tội (khoản 2 Điều 98 BLTTHS).
  for (const dieu of dieus) {
    const crime = findCrime(dieu);
    for (const e of elementMatrix(dieu, sources)) {
      if (e.req && !e.support.length) add({ id: `chua-chung-cu-${dieu}-${e.id}`, muc: 'thieu', title: `Điều ${dieu} (${crime.ten}): chưa thấy chứng cứ cho yếu tố “${e.label}”`, detail: 'Tài liệu đã nạp không có câu nào thể hiện yếu tố này — cần đối chiếu hồ sơ gốc hoặc bổ sung.' });
      else if (e.req && e.onlyConfession) add({ id: `chi-nhan-toi-${dieu}-${e.id}`, muc: 'canh', title: `Yếu tố “${e.label}” chỉ dựa vào lời khai của bị can, bị cáo`, detail: 'Lời nhận tội chỉ được coi là chứng cứ nếu phù hợp với các chứng cứ khác; không được dùng làm chứng cứ duy nhất để kết tội (khoản 2 Điều 98 BLTTHS).', facts: e.support.slice(0, 2) });
    }
  }
  // 4. Mâu thuẫn số tiền giữa các tài liệu.
  const byVal = new Map();
  for (const m of money) if (!byVal.has(m.v)) byVal.set(m.v, m);
  const distinctSrc = new Set(money.map((m) => m.name));
  if (byVal.size > 1 && distinctSrc.size > 1) {
    const vals = [...byVal.values()].sort((a, b) => b.v - a.v);
    add({ id: 'mau-thuan-tien', muc: 'mau-thuan', title: `Số tiền / giá trị được nêu khác nhau giữa các tài liệu: ${vals.map((x) => fmtVnd(x.v)).join('; ')}`, detail: 'Có thể là các khoản khác nhau hoặc mâu thuẫn — xác định đúng giá trị dùng để định khung.', facts: vals.slice(0, 4).map((x) => ({ quote: x.quote, src: x.src })) });
  }
  // 5. Nhân thân bị cáo không thống nhất (đúng người).
  for (const d of defs) {
    if (!d.hoTen) continue;
    const re = new RegExp(`${d.hoTen.replace(/\s+/g, '\\s+')}[^.;\\n]{0,40}?sinh (?:ngày\\s*\\d{1,2}[/-]\\d{1,2}[/-](\\d{4})|năm\\s*(\\d{4}))`, 'u');
    const seen = new Map();
    for (const x of sentencesOf(sources)) {
      const m = re.exec(x.t);
      if (m) seen.set(m[1] || m[2], { quote: x.t, src: x.src });
    }
    if (d.namSinh && ![...seen.keys()].every((y) => y === String(d.namSinh))) seen.set(`nhập: ${d.namSinh}`, { quote: `Năm sinh đã nhập: ${d.namSinh}`, src: 'Hồ sơ xét xử' });
    if (seen.size > 1) add({ id: `nhan-than-${d.hoTen}`, muc: 'mau-thuan', title: `Năm sinh của bị cáo ${d.hoTen} không thống nhất giữa các tài liệu`, detail: 'Kiểm tra căn cước, lý lịch bị cáo (đúng người; tuổi chịu trách nhiệm hình sự).', facts: [...seen.values()].slice(0, 3) });
  }
  // 6. Lời khai không thừa nhận hành vi (chứng cứ gỡ tội).
  for (const x of sentencesOf(sources.filter((s) => s.loai === 'loi-khai-bi-cao'))) {
    if (/(không thừa nhận|không nhận tội|kêu oan|phủ nhận|không thực hiện hành vi|không có hành vi|bị ép|bị đánh)/iu.test(x.t) && !/^hỏi\s*:/iu.test(x.t)) {
      add({ id: `go-toi-${x.src}`, muc: 'canh', title: 'Có lời khai không thừa nhận hành vi / khai bị ép buộc', detail: 'Chứng cứ gỡ tội — phải được xem xét, đánh giá cùng các chứng cứ buộc tội.', facts: [{ quote: x.t, src: x.src }] });
      break;
    }
  }
  // 7. Bản án: nhận định và quyết định không thống nhất về điều, khoản, tình tiết.
  for (const s of sources.filter((x) => x.loai === 'ban-an')) {
    const t = String(s.text || '');
    const iQd = t.search(/\n\s*(?:Vì các lẽ trên,?\s*)?QUYẾT ĐỊNH\s*:?/u);
    const iNd = t.search(/NHẬN ĐỊNH CỦA TÒA ÁN|XÉT THẤY|NHẬN THẤY/u);
    if (iQd < 0 || iNd < 0 || iNd > iQd) continue;
    const nd = parseCitations(t.slice(iNd, iQd));
    const qd = parseCitations(t.slice(iQd));
    for (const c of nd.filter((x) => findCrime(x.dieu) && x.khoan)) {
      const q = qd.find((x) => x.dieu === c.dieu && x.khoan);
      if (q && q.khoan !== c.khoan) add({ id: `nd-qd-${c.dieu}`, muc: 'mau-thuan', title: `Bản án: phần nhận định nêu khoản ${c.khoan} nhưng phần quyết định áp dụng khoản ${q.khoan} Điều ${c.dieu}`, detail: 'Nhận định và quyết định của bản án phải thống nhất.', facts: [{ quote: `“${s.name}”: nhận định — khoản ${c.khoan} Điều ${c.dieu}; quyết định — khoản ${q.khoan} Điều ${c.dieu}`, src: srcRange(s) || s.name }] });
    }
    const qd51 = new Set(qd.filter((x) => x.dieu === '51' && x.khoan === 1).flatMap((x) => x.diem));
    const nd51 = nd.filter((x) => x.dieu === '51' && x.khoan === 1).flatMap((x) => x.diem).filter((x) => !qd51.has(x));
    if (nd51.length) add({ id: 'nd-qd-51', muc: 'mau-thuan', title: `Bản án: nhận định nêu tình tiết giảm nhẹ điểm ${nd51.join(', ')} khoản 1 Điều 51 nhưng phần quyết định không áp dụng`, detail: 'Có thể bỏ sót khi viện dẫn trong phần quyết định.' });
  }
  if (!F.some((f) => f.muc !== 'dat')) add({ id: 'khong-phat-hien', muc: 'dat', title: 'Chưa phát hiện thiếu sót, mâu thuẫn trong tài liệu đã nạp', detail: 'Kết quả chỉ trong phạm vi tài liệu đã nạp vào phần mềm.' });
  return F;
}

/**
 * Bảng đối chiếu chứng cứ theo bút lục (cho Excel / phụ lục báo cáo):
 * [{ bc, van: vấn đề cần chứng minh, quote, src, loai, ghiChu }].
 */
export function evidenceRows(rec = {}, { book = null } = {}) {
  const sources = (rec.sources || []).filter((s) => s.loai !== 'don');
  const sents = sentencesOf(sources);
  const rows = [];
  const R = generalRules(book);
  for (const d of (rec.defendants || []).filter((x) => x.hoTen || x.toiDanh?.[0]?.dieu)) {
    const name = d.hoTen || '(chưa ghi tên)';
    for (const t of (d.toiDanh || []).filter((x) => x.dieu)) {
      const crime = findCrime(t.dieu);
      for (const e of elementMatrix(t.dieu, sources)) {
        if (!e.support.length) rows.push({ bc: name, van: `Điều ${t.dieu}${crime ? ` (${crime.ten})` : ''} — ${e.label}`, quote: '', src: '', loai: '', ghiChu: e.req ? 'CHƯA CÓ CHỨNG CỨ trong tài liệu đã nạp' : 'Chưa thấy trong tài liệu' });
        for (const x of e.support) rows.push({ bc: name, van: `Điều ${t.dieu}${crime ? ` (${crime.ten})` : ''} — ${e.label}`, quote: x.quote, src: x.src, loai: typeLabel(x.loai), ghiChu: e.onlyConfession ? 'Chỉ có lời khai của bị can, bị cáo' : 'Buộc tội' });
      }
      // Dấu hiệu định khung có câu chứng minh.
      const fr = (articleFrames(book, t.dieu) || []).find((x) => x.k === +t.khoan);
      if (fr) for (const p of fr.points.filter((x) => (t.diem || []).includes(x.d))) {
        const van = `Dấu hiệu định khung: điểm ${p.d} khoản ${fr.k} Điều ${t.dieu} — ${p.text.replace(/;$/, '')}`;
        const ranges = moneyRanges(p.text);
        if (ranges.length) {
          // Định khung theo giá trị: chỉ đối chiếu với số tiền thực có trong tài liệu.
          const ms = moneySents(sents);
          const fit = ms.find((m) => ranges.some((r) => m.v >= r.from && (r.to == null || m.v < r.to)));
          const top = [...ms].sort((a, b) => b.v - a.v)[0];
          if (fit) rows.push({ bc: name, van, quote: fit.quote, src: fit.src, loai: '', ghiChu: 'Định khung' });
          else rows.push({ bc: name, van, quote: top?.quote || '', src: top?.src || '', loai: '', ghiChu: top ? `Giá trị trong tài liệu (${fmtVnd(top.v)}) KHÔNG thuộc khoảng của điểm này` : 'CHƯA CÓ CHỨNG CỨ về giá trị trong tài liệu đã nạp' });
          continue;
        }
        const fold = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const words = fold(p.text).replace(/[;.,]/g, '').split(/\s+/).filter((w) => w.length > 1);
        const key = words.slice(0, 5).join(' ');
        const ev = words.length >= 3 ? sents.find((x) => !/^(quyet dinh|ap dung|tuyen bo|can cu)/.test(fold(x.t)) && fold(x.t).includes(key)) : null;
        rows.push({ bc: name, van, quote: ev?.t || '', src: ev?.src || '', loai: '', ghiChu: ev ? 'Định khung' : 'CHƯA CÓ CHỨNG CỨ trong tài liệu đã nạp' });
      }
    }
    for (const p of R.a51.k1) {
      const cue = MITIGATE_CUES.find(([k]) => k.test(p.text));
      const ev = cue ? evidence(sents, cue[1], { name: d.hoTen }) : null;
      if (ev) rows.push({ bc: name, van: `Tình tiết giảm nhẹ điểm ${p.d} khoản 1 Điều 51 — ${p.text.replace(/;$/, '')}`, quote: ev.t, src: ev.src, loai: '', ghiChu: (d.giamNhe || []).includes(p.d) ? 'Đã áp dụng' : 'Chưa được áp dụng' });
    }
    for (const p of R.a52.k1) {
      const cue = AGGRAVATE_CUES.find(([k]) => k.test(p.text));
      const ev = cue ? evidence(sents, cue[1], { name: d.hoTen }) : null;
      if (ev || (d.tangNang || []).includes(p.d)) rows.push({ bc: name, van: `Tình tiết tăng nặng điểm ${p.d} khoản 1 Điều 52 — ${p.text.replace(/;$/, '')}`, quote: ev?.t || '', src: ev?.src || '', loai: '', ghiChu: (d.tangNang || []).includes(p.d) ? (ev ? 'Đã áp dụng' : 'Đã áp dụng nhưng CHƯA THẤY CĂN CỨ') : 'Chưa được áp dụng' });
    }
  }
  // Gắn loại tài liệu từ tên nguồn.
  for (const r of rows) if (!r.loai && r.src) r.loai = typeLabel(sources.find((s) => r.src.startsWith(s.name))?.loai);
  return rows;
}
