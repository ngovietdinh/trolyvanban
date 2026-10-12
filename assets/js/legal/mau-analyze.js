// Phân tích biểu mẫu Word chính thức (Thông tư 128/2025/TT-BCA): tìm mọi chỗ điền (dòng chấm "……", tab dẫn chấm),
// đặt tên trường theo ngữ cảnh và chú thích (n), nhận diện trường dùng chung (cơ quan, số, ngày, tội danh)
// và trường thuộc người (họ tên, ngày sinh, nơi cư trú…) để tự điền từ hồ sơ vụ án.
// Chạy được cả trên Node (công cụ dựng gói mẫu) lẫn trình duyệt.

export const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ');

const DOTS_RE = /(?:[.…·]{2,}|…)(?:[  ]*(?:[.…·]{2,}|…))*/gu;
const MARK_RE = /\((\d{1,2}|\*)\)/g;

/** 13 nhóm biểu mẫu theo Danh mục ban hành kèm Thông tư. */
export const MAU_GROUPS = [
  { id: 1, ten: 'Tiếp nhận, giải quyết nguồn tin về tội phạm', icon: 'message' },
  { id: 2, ten: 'Phân công điều tra, khởi tố vụ án, khởi tố bị can', icon: 'gavel' },
  { id: 3, ten: 'Biện pháp ngăn chặn, cưỡng chế, bắt buộc chữa bệnh', icon: 'lock' },
  { id: 4, ten: 'Biện pháp điều tra', icon: 'search' },
  { id: 5, ten: 'Biện pháp điều tra tố tụng đặc biệt', icon: 'eye' },
  { id: 6, ten: 'Tạm đình chỉ điều tra và kết thúc điều tra', icon: 'check-circle' },
  { id: 7, ten: 'Người bào chữa', icon: 'shield' },
  { id: 8, ten: 'Biện pháp xử lý chuyển hướng (người chưa thành niên)', icon: 'user' },
  { id: 9, ten: 'Thủ tục rút gọn', icon: 'zap' },
  { id: 10, ten: 'Bảo vệ người tố giác, người làm chứng, bị hại', icon: 'shield' },
  { id: 11, ten: 'Truy cứu trách nhiệm hình sự pháp nhân', icon: 'layers' },
  { id: 12, ten: 'Bìa hồ sơ vụ án', icon: 'folder' },
  { id: 13, ten: 'Sổ sách về điều tra hình sự', icon: 'file' },
];

/** Loại văn bản theo tên mẫu. */
export function loaiOf(ten) {
  const n = norm(ten);
  if (/^(quyet dinh|qd)\b/.test(n)) return 'qd';
  if (/^lenh\b/.test(n)) return 'lenh';
  if (/^bien ban\b/.test(n)) return 'bb';
  if (/^(thong bao|tb)\b/.test(n)) return 'tb';
  if (/^giay\b/.test(n)) return 'giay';
  if (/^(yeu cau|phieu yeu cau)\b/.test(n)) return 'yc';
  if (/^de nghi\b/.test(n)) return 'dn';
  if (/^ban ket luan\b/.test(n)) return 'kl';
  if (/^(bia|so|thong ke|chi ban|danh ban|bao cao|phieu|ban )/.test(n)) return 'khac';
  return 'khac';
}

/** Mẫu dạng khung/bảng (bìa, sơ đồ, bản ảnh, sổ…) chỉ điền phần đầu mẫu, còn lại xuất như bản gốc. */
export function isFrameForm(ten) {
  return /^(bia ho so|so do|ban anh|thong ke tai lieu|danh ban|chi ban|so theo doi|so dang ky|muc luc|bang |phu luc)/.test(norm(ten));
}

const cap = (s) => (s ? s.charAt(0).toLocaleUpperCase('vi-VN') + s.slice(1) : s);
const tailWords = (s, n) => s.trim().split(/\s+/).slice(-n).join(' ');
/** Nhãn ngắn: quá dài thì giữ phần cuối và thêm “…” (không viết hoa giữa câu). */
const lastWords = (s, n) => {
  const w = String(s).trim().split(/\s+/).filter(Boolean);
  return w.length <= n ? cap(w.join(' ')) : `… ${w.slice(-n).join(' ')}`;
};
const clean = (s) => s.replace(MARK_RE, ' ').replace(/[\t\n]+/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------------- Nhận diện ngữ nghĩa ---------------- */

const PERSON_RULES = [
  ['hoTen', 'Họ và tên', /(?:^|\s)(?:ho va ten|ho ten|ho, ten|ten toi la|ho va ten khai sinh|ho ten khai sinh)$/],
  ['gioiTinh', 'Giới tính', /gioi tinh$/],
  ['tenKhac', 'Tên gọi khác', /(?:ten goi khac|bi danh|ten khac)$/],
  ['noiSinh', 'Nơi sinh', /(?:noi sinh|sinh ra tai|noi sinh ra)$/],
  ['quocTich', 'Quốc tịch', /quoc tich$/],
  ['danToc', 'Dân tộc', /dan toc$/],
  ['tonGiao', 'Tôn giáo', /ton giao$/],
  ['ngheNghiep', 'Nghề nghiệp', /nghe nghiep(?:, noi lam viec)?$/],
  ['soDinhDanh', 'Số định danh / CMND / CCCD / hộ chiếu', /(?:cmnd|cccd|can cuoc|ho chieu|dinh danh|giay to tuy than)[^:]{0,40}$/],
  ['noiCap', 'Nơi cấp', /noi cap$/],
  ['noiCuTru', 'Nơi cư trú / thường trú', /(?:noi thuong tru|noi cu tru|thuong tru|ho khau thuong tru|noi dang ky ho khau thuong tru)$/],
  ['noiTamTru', 'Nơi tạm trú', /tam tru$/],
  ['noiOHienTai', 'Nơi ở hiện tại', /(?:noi o hien tai|noi o hien nay|cho o hien nay|cho o hien tai|noi o)$/],
  ['noiLamViec', 'Nơi làm việc / công tác', /(?:noi lam viec|noi cong tac|don vi cong tac)$/],
  ['chucVu', 'Chức vụ', /chuc vu$/],
];

export const PERSON_SEMS = new Set(['hoTen', 'gioiTinh', 'tenKhac', 'ngaySinh', 'noiSinh', 'quocTich', 'danToc', 'tonGiao', 'ngheNghiep', 'soDinhDanh', 'ngayCap', 'noiCap', 'noiCuTru', 'noiTamTru', 'noiOHienTai', 'noiLamViec', 'chucVu']);
/** Trường dùng chung toàn mẫu: nhiều chỗ cùng nội dung → chỉ nhập một lần. */
const SHARED = new Set(['coQuanCapTren', 'coQuan', 'so', 'kyHieuCq', 'diaDanh', 'ngayVb', 'vks', 'chucDanhKy', 'toiTen', 'dieuBLHS', 'khoanBLHS', 'noiXayRa', 'tenVu', 'kinhGui', 'diaDiem', 'coQuanDT']);

const LONG_LABEL = /(noi dung|trich yeu|xet thay|can cu|ly do|dien bien|ket qua|hanh vi|tinh tiet|gom|nhu sau|ke tu)/;

/** Văn bản đầy đủ của từng chú thích (n) ở cuối thân mẫu hoặc ở chân trang. */
function findNotes(paragraphs) {
  const parts = [...new Set(paragraphs.map((p) => p.part))];
  const order = [...parts.filter((x) => x.includes('document')), ...parts.filter((x) => x.includes('footer')), ...parts.filter((x) => x.includes('footnotes'))];
  for (const part of order) {
    const r = findNotesIn(paragraphs, part);
    if (r.count) return r;
  }
  return { notes: {}, paras: [], count: 0 };
}

function findNotesIn(paragraphs, part) {
  const body = paragraphs.map((p, k) => ({ p, k })).filter(({ p }) => p.part === part);
  let start = -1;
  for (let j = body.length - 1; j >= 0; j--) {
    if (/^\s*\((?:1|\*)\)\s*[\p{L}]/u.test(body[j].p.text) && /\p{L}{3}/u.test(body[j].p.text.replace(/[.…]/g, ''))) {
      start = j;
      break;
    }
  }
  if (start < 0 || body.length - start > 40) return { notes: {}, paras: [], count: 0 };
  const notes = {};
  let last = '';
  const paras = [];
  for (let j = start; j < body.length; j++) {
    const { p } = body[j];
    paras.push({ part: p.part, i: p.i, k: body[j].k });
    const m = /^\s*\((\d{1,2}|\*)\)\s*(.*)$/su.exec(p.text);
    if (m) {
      last = m[1];
      notes[last] = clean(m[2]);
    } else if (last) notes[last] = `${notes[last]} ${clean(p.text)}`.trim();
  }
  return { notes, paras, count: Object.keys(notes).length };
}

/** Tìm vị trí chỗ điền trong một đoạn: dòng chấm và tab dẫn chấm (gộp các đoạn liền kề). */
function slotsOf(p) {
  const t = p.text;
  const found = [];
  for (const m of t.matchAll(DOTS_RE)) found.push({ s: m.index, e: m.index + m[0].length, kind: 'dot', len: m[0].length });
  if (p.leader) {
    for (const m of t.matchAll(/\t+/g)) {
      const rest = t.slice(m.index + m[0].length);
      if (/^[\s;,.]*$/.test(rest) || /^\s*(\((?:\d{1,2}|\*)\)|[.…])/u.test(rest) || /:\s*$/.test(t.slice(0, m.index))) found.push({ s: m.index, e: m.index + m[0].length, kind: 'tab', len: 60 });
    }
  }
  found.sort((a, b) => a.s - b.s);
  const merged = [];
  for (const f of found) {
    const prev = merged.at(-1);
    if (prev && prev.e <= f.s && /^[ \t ]*$/.test(t.slice(prev.e, f.s)) && f.s - prev.e <= 4) {
      prev.e = f.e;
      prev.len += f.len;
      if (f.kind === 'tab') prev.kind = 'tab';
    } else merged.push({ ...f });
  }
  return merged;
}

/**
 * Phân tích một mẫu. paragraphs: kết quả parseTemplateDocx(...).paragraphs.
 * Trả về { fields, persons, notes: { marks, paras }, stats }.
 */
export function analyzeMau(paragraphs, { ten = '', frame = false } = {}) {
  const { notes, paras: noteParas, count: noteCount } = findNotes(paragraphs);
  const noteSet = new Set(noteParas.map((n) => n.k));
  const lastBody = paragraphs.reduce((m, p, k) => (p.part.includes('document') && !noteSet.has(k) ? k : m), -1);
  const marks = [];
  const fields = [];
  const persons = [];
  let firstTitleSeen = false;
  let headerLines = 0;
  let curPerson = -1;
  let lastFieldInPara = null;
  const used = new Set();
  const uniqueKey = (base) => {
    let key = base;
    for (let n = 2; used.has(key); n++) key = `${base}_${n}`;
    used.add(key);
    return key;
  };

  const limitFrame = frame ? 16 : Infinity;
  let docParaCount = 0;
  const addField = (f) => {
    const sem = f.sem && (SHARED.has(f.sem) || (PERSON_SEMS.has(f.sem) && f.person !== undefined)) ? f.sem : null;
    if (sem) {
      const key = f.person !== undefined ? `p${f.person}.${sem}` : sem;
      const same = fields.find((x) => x.key === key);
      if (same) {
        same.slots.push(...f.slots);
        return same;
      }
      f.key = key;
      used.add(key);
    } else f.key = uniqueKey(f.sem ? `${f.sem}` : `k${fields.length + 1}`);
    fields.push(f);
    return f;
  };

  paragraphs.forEach((p, k) => {
    if (noteSet.has(k)) return;
    const isBody = p.part.includes('document');
    if (isBody) docParaCount++;
    // Dấu chú thích (n) còn nằm trong thân mẫu → xóa khi xuất (tùy chọn).
    if (noteCount) {
      for (const m of p.text.matchAll(MARK_RE)) {
        if (!(m[1] in notes)) continue;
        let s = m.index;
        const e = m.index + m[0].length;
        if (s > 0 && p.text[s - 1] === ' ' && (e >= p.text.length || /[\s,;.:)]/.test(p.text[e]))) s -= 1;
        marks.push({ part: p.part, i: p.i, s, e, n: m[1] });
      }
    }
    if (/CỘNG HÒA|CỘNG HOÀ/i.test(p.text)) firstTitleSeen = true;
    if (!isBody || docParaCount > limitFrame) return;
    const slots = slotsOf(p);
    if (isBody && /^[\s.…]*$/.test(p.text) && (k === lastBody || /^\s*-/.test(paragraphs[k - 1]?.text || '')) && p.text.length >= 60) return; // dòng chấm kẻ cuối mẫu, không phải chỗ điền
    if (!slots.length) {
      lastFieldInPara = null;
      return;
    }
    const text = p.text;
    // Văn bản trước/sau từng chỗ điền, bỏ dấu chú thích nhưng nhớ số chú thích kề bên.
    const info = slots.map((sl, idx) => {
      const prevEnd = idx ? slots[idx - 1].e : 0;
      const nextStart = idx + 1 < slots.length ? slots[idx + 1].s : text.length;
      const preRaw = text.slice(prevEnd, sl.s);
      const postRaw = text.slice(sl.e, nextStart);
      const markBefore = /\((\d{1,2}|\*)\)\s*$/.exec(preRaw);
      const markAfter = /^\s*\((\d{1,2}|\*)\)/.exec(postRaw);
      return { sl, preRaw, postRaw, pre: clean(preRaw), post: clean(postRaw), noteRef: markBefore?.[1] || markAfter?.[1] || '' };
    });
    const emitted = [];
    // Giữ khoảng cách với chữ liền kề khi điền (mẫu thường để dòng chấm sát chữ).
    const mk = (sl, extra = {}) => {
      const o = { part: p.part, i: p.i, s: sl.s, e: sl.e, ...extra };
      if (sl.s > 0 && /[^\s(]/u.test(text[sl.s - 1])) o.sp = 1;
      if (sl.e < text.length && /[\p{L}\p{N}]/u.test(text[sl.e])) o.sa = 1;
      if (p.align === 'both') o.j = 1; // đoạn căn đều hai bên: xuống dòng cưỡng bức làm giãn dòng
      return o;
    };
    for (let idx = 0; idx < info.length; idx++) {
      const it = info[idx];
      const preFull = norm(it.pre).trim();
      const preN = preFull.replace(/[\s:;,.\-–]+$/, '');
      const nText = norm(text);
      const blhs = /bo luat hinh su/.test(nText) && !/to tung/.test(nText);
      const postN = norm(it.post);
      const slot = mk(it.sl);
      const whole = !it.pre && !it.post; // chỗ điền chiếm cả đoạn
      let f = null;

      // Ngày – tháng – năm.
      if (/(?:^|[\s,])ngay$/.test(preN) && info[idx + 1] && norm(info[idx + 1].pre).replace(/[\s:;,.\-–]+$/, '') === 'thang') {
        const parts = [mk(it.sl, { role: 'd' })];
        let j = idx + 1;
        parts.push(mk(info[j].sl, { role: 'm' }));
        if (info[j + 1] && norm(info[j + 1].pre).replace(/[\s:;,.\-–]+$/, '') === 'nam') {
          j++;
          parts.push(mk(info[j].sl, { role: 'y' }));
        }
        const leadRaw = it.pre.replace(/ngày\s*$/iu, '');
        const lead = norm(leadRaw).trim();
        let sem = null;
        let label = 'Ngày';
        if (/sinh$/.test(lead)) ((sem = 'ngaySinh'), (label = 'Ngày sinh'));
        else if (/cap$/.test(lead)) ((sem = 'ngayCap'), (label = 'Ngày cấp giấy tờ'));
        else if (emitted.at(-1)?.sem === 'diaDanh' || (idx === 0 && /,\s*$/.test(leadRaw))) ((sem = 'ngayVb'), (label = 'Ngày ban hành văn bản'));
        else {
          label = /ket thuc/.test(norm(clean(text.slice(0, it.sl.s)))) ? 'Ngày kết thúc' : 'Ngày';
        }
        f = { sem, label, kind: 'date', slots: parts, hint: '' };
        if (sem === 'ngaySinh' || sem === 'ngayCap') f.person = Math.max(curPerson, 0);
        idx = j;
        info[idx].skip = true;
      }
      // Giờ – phút.
      else if (/(?:^|\s)(?:hoi|luc|vao hoi|vao luc)$/.test(preN) && /^gio\b/.test(postN.replace(/^[\s,]+/, '')) && !emitted.some((e) => e.kind === 'time' && e.tmp === idx)) {
        const parts = [mk(it.sl, { role: 'h' })];
        let j = idx;
        if (info[idx + 1] && norm(info[idx + 1].pre).replace(/[\s:;,.\-–]+$/, '') === 'gio') {
          j = idx + 1;
          parts.push(mk(info[j].sl, { role: 'min' }));
        }
        const before = norm(clean(text.slice(0, it.sl.s)));
        f = { sem: null, label: /ket thuc/.test(before) ? 'Giờ kết thúc' : 'Giờ', kind: 'time', slots: parts, hint: '' };
        idx = j;
        info[idx].skip = true;
      } else if (/(?:^|\s)gio$/.test(preN) && info[idx - 1]?.skip !== true && !/ngay|thang/.test(postN.slice(0, 6))) {
        f = { sem: null, label: 'Số giờ / phút', kind: 'text', slots: [slot], hint: '' };
      }
      // Số hiệu văn bản: "Số: …… /QĐ-……".
      else if (/(?:^|\s)so$/.test(preN) && /^\//.test(it.post) && !emitted.some((e) => e.sem === 'so')) f = { sem: 'so', label: 'Số văn bản (để trống nếu ghi tay)', kind: 'text', slots: [slot], hint: 'Chỉ số thứ tự, ký hiệu loại văn bản đã có sẵn' };
      else if (/\/[a-z0-9]{1,10}\s*-$/.test(preFull)) f = { sem: 'kyHieuCq', label: 'Ký hiệu cơ quan ban hành', kind: 'text', slots: [slot], hint: 'VD: PC01' };
      // Địa danh trước ", ngày … tháng … năm".
      else if (/^,?\s*ngay\b/.test(postN) && idx === 0 && !it.pre && /thang/.test(nText)) f = { sem: 'diaDanh', label: 'Địa danh', kind: 'text', slots: [slot], hint: '' };
      // Hai dòng chấm đầu mẫu: cơ quan chủ quản, cơ quan ban hành.
      else if (whole && !firstTitleSeen && isBody && headerLines < 2 && /^[\s.…]*$/.test(text)) {
        headerLines++;
        f = headerLines === 1 ? { sem: 'coQuanCapTren', label: 'Cơ quan chủ quản (dòng 1 đầu mẫu)', kind: 'text', slots: [slot], hint: '' } : { sem: 'coQuan', label: 'Cơ quan ban hành (dòng 2 đầu mẫu)', kind: 'text', slots: [slot], hint: '' };
      } else if (preN === 'tai' && idx > 0 && emitted.some((e) => e.kind === 'date' || e.kind === 'time') && !/sinh/.test(norm(text.slice(0, it.sl.s)))) f = { sem: 'diaDiem', label: 'Địa điểm tiến hành', kind: 'long', slots: [slot], hint: '' };
      else if (/kinh gui$/.test(preN)) f = { sem: 'kinhGui', label: 'Kính gửi', kind: 'text', slots: [slot], hint: '' };
      else if (/(?:^|\s)(?:vks|vien kiem sat(?: nhan dan)?)$/.test(preN)) f = { sem: 'vks', label: 'Viện kiểm sát nhân dân', kind: 'text', slots: [slot], hint: 'VD: tỉnh Ninh Bình' };
      else if (/(?:^|\s)vu an hinh su$/.test(preN) && !it.post) f = { sem: 'tenVu', label: 'Vụ án (tên vụ án)', kind: 'long', slots: [slot], hint: 'VD: Tham ô tài sản xảy ra tại Công ty X' };
      else if (/xay ra tai$/.test(preN)) f = { sem: 'noiXayRa', label: 'Nơi xảy ra vụ án', kind: 'long', slots: [slot], hint: '' };
      else if (/(?:^|\s)thuoc co quan$/.test(preN)) f = { sem: 'coQuanDT', label: 'Cơ quan của người tiến hành', kind: 'text', slots: [slot], hint: '' };
      else if (/phan cong(?: ong\/ba| ong ba)?$/.test(preN)) f = { sem: 'dtv1', label: 'Điều tra viên được phân công', kind: 'text', slots: [slot], hint: '' };
      else if (/(?:^|\s)(?:toi(?: danh)?|dau hieu (?:cua )?toi(?: pham)?)$/.test(preN)) f = { sem: 'toiTen', label: 'Tội danh', kind: 'text', slots: [slot], hint: 'Tên tội theo Bộ luật Hình sự' };
      else if (/(?:^|\s)dieu$/.test(preN) && /bo luat hinh su/.test(postN) && !/to tung/.test(postN) && blhs) f = { sem: 'dieuBLHS', label: 'Điều (Bộ luật Hình sự)', kind: 'text', slots: [slot], hint: '' };
      else if (/(?:^|\s)khoan$/.test(preN) && /dieu/.test(postN) && blhs) f = { sem: 'khoanBLHS', label: 'Khoản (Bộ luật Hình sự)', kind: 'text', slots: [slot], hint: '' };
      else if (/chuc danh tu phap/.test(norm(notes[it.noteRef] || ''))) f = { sem: 'chucDanhKy', label: 'Chức danh tư pháp của người ký', kind: 'text', slots: [slot], hint: cap(notes[it.noteRef]) };
      else {
        // Quy tắc về người.
        let hit = null;
        for (const [sem, label, re] of PERSON_RULES) {
          if (re.test(preN)) {
            hit = { sem, label };
            break;
          }
        }
        if (!hit && curPerson >= 0 && /(?:^|[\s,])(?:ong\/ba|ong ba|ong, ba)$/.test(preN) && !/chuc (?:danh|vu)|dai dien|phan cong|giao cho|yeu cau|uy quyen|chung kien|tham gia/.test(nText)) hit = { sem: 'hoTen', label: 'Họ và tên' };
        if (!hit && /^tai$/.test(preN) && emitted.some((e) => e.sem === 'ngaySinh')) hit = { sem: 'noiSinh', label: 'Nơi sinh' };
        if (!hit && /^tai$/.test(preN) && /sinh/.test(norm(text.slice(0, it.sl.s)))) hit = { sem: 'noiSinh', label: 'Nơi sinh' };
        if (hit) {
          if (hit.sem === 'hoTen' && !/ong/.test(preN)) {
            curPerson++;
            const own = clean(text.slice(0, it.sl.s)).replace(/(?:họ\s*(?:và\s*)?tên|ông\/bà)\s*:?\s*$/iu, '').trim();
            persons.push({ ctx: tailWords(own.split(/\s+/).length >= 3 ? own : clean(paragraphs[k - 1]?.text || ''), 12) });
          }
          if (curPerson < 0) {
            curPerson = 0;
            persons.push({ ctx: '' });
          }
          f = { sem: hit.sem, label: hit.label, kind: 'text', slots: [slot], hint: '', person: curPerson };
        } else if (/^\d{1,2}$/.test(preN.replace(/[.)\s]/g, '')) && /\d/.test(preN)) {
          // Mục đánh số "1. ……" → danh sách nhiều dòng.
          const prevPara = paragraphs[k - 1];
          const lastAny = fields.at(-1);
          if (lastAny && lastAny.kind === 'lines' && lastAny.slots.at(-1).i === p.i - 1 && lastAny.slots.at(-1).part === p.part) {
            lastAny.slots.push(slot);
            emitted.push(lastAny);
            continue;
          }
          const headN = norm(clean(prevPara?.text || ''));
          const sem = /dieu tra vien|can bo dieu tra/.test(headN) ? 'dtv' : /chung toi gom|thanh phan/.test(headN) ? 'thanhPhan' : null;
          f = { sem, label: sem === 'dtv' ? 'Điều tra viên, cán bộ điều tra' : sem === 'thanhPhan' ? 'Thành phần tiến hành (Chúng tôi gồm)' : lastWords(clean(prevPara?.text || '').replace(/[:;,.]+$/, ''), 8) || 'Danh sách', kind: 'lines', slots: [slot], hint: 'Mỗi dòng một mục, theo thứ tự các mục 1., 2., 3.… của mẫu' };
        }
      }

      // Còn lại: trường tự do, tên lấy từ chữ đứng trước hoặc chú thích.
      if (!f) {
        const note = notes[it.noteRef] || '';
        let note0 = '';
        let label = it.pre ? lastWords(it.pre.replace(/[:;,.\s]+$/, '').split(/[:;]\s*/).filter(Boolean).at(-1) || it.pre, 7) : '';
        label = label.replace(/[.…]{2,}/gu, ' ').replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').replace(/^[\s,;.:\-–]+/, '').trim();
        if (!/\p{L}{2}/u.test(label)) label = '';
        if (!label) {
          const above = clean(paragraphs[k - 1]?.text || '');
          label = whole || !it.pre ? lastWords(above.replace(/[:;,.\s]+$/, ''), 7) : '';
        }
        if (!label && note) label = cap(note.replace(/[;.]+$/, '').slice(0, 70));
        if (/^(của|tại|do|bởi|là|và|với|cho|ở|từ|đến)$/iu.test(label)) {
          note0 = clean(`${paragraphs[k - 1]?.text || ''} ${text.slice(0, it.sl.s)}`.replace(DOTS_RE, '…'));
          label = (emitted.at(-1) || fields.at(-1))?.kind === 'date' && /^của$/iu.test(label) ? 'Cơ quan, người ban hành (của)' : `Nội dung sau “${label.toLowerCase()}”`;
        }
        if (/^-+$/.test(it.pre)) label = 'Nơi nhận (thêm)';
        if (!label) label = it.post ? lastWords(clean(it.post).replace(/[.…]{2,}/gu, ' ').split(/[:;]/)[0], 6) : 'Nội dung';
        if (!label) label = 'Nội dung';
        label = label.replace(/^[(\s]+/, '');
        const lg = norm(label + ' ' + it.pre);
        const kind = whole || (!it.post && it.sl.len >= 70) || LONG_LABEL.test(lg) ? (it.sl.len >= 40 || whole ? 'long' : 'text') : 'text';
        const ctxText = clean(text.slice(0, it.sl.s).replace(DOTS_RE, '…'));
        f = { sem: null, label, kind, slots: [slot], hint: note ? cap(note.slice(0, 160)) : note0 ? note0.slice(-120) : ctxText.length > label.length + 6 ? (ctxText.length > 110 ? ctxText.slice(-110).replace(/^\S*\s/, '… ') : ctxText) : '' };
      }

      // Dòng chấm nối tiếp trên đoạn sau (cả đoạn chỉ có dòng chấm) → gộp vào trường trước.
      if (whole && f.kind !== 'lines' && !f.sem && f.person === undefined) {
        const prev = fields.at(-1);
        const prevSlot = prev?.slots.at(-1);
        if (prev && (prev.kind === 'long' || prev.kind === 'text') && !['coQuanCapTren', 'coQuan', 'so', 'kyHieuCq', 'diaDanh', 'kinhGui'].includes(prev.sem) && prevSlot && prevSlot.part === p.part && prevSlot.i === p.i - 1 && paragraphs[k - 1] && prevSlot.e >= paragraphs[k - 1].text.replace(/\s+$/, '').length) {
          prev.kind = 'long';
          prev.slots.push({ ...slot, drop: true });
          emitted.push(prev);
          continue;
        }
      }
      if (f.noteSrc === undefined && it.noteRef) f.noteRef = it.noteRef;
      const added = addField(f);
      emitted.push(added);
      lastFieldInPara = added;
    }
  });

  // Mẫu dạng khung/bảng: chỉ giữ phần đầu mẫu (cơ quan, số, ngày); phần còn lại xuất như bản gốc.
  if (frame) {
    const keep = fields.filter((f) => ['coQuanCapTren', 'coQuan', 'so', 'kyHieuCq', 'diaDanh', 'ngayVb'].includes(f.sem));
    fields.splice(0, fields.length, ...keep);
    persons.length = 0;
  }
  // Khối người không có ô “Họ tên” riêng: ô chữ ngay trước thuộc tính đầu tiên (“Đối với bị can …”, “Ông/bà …”) chính là họ tên.
  for (let n = 0; n < persons.length; n++) {
    if (fields.some((f) => f.key === `p${n}.hoTen`)) continue;
    const at = fields.findIndex((f) => f.person === n);
    for (let k = at - 1; k >= Math.max(0, at - 3); k--) {
      const c = fields[k];
      if (c.person !== undefined || c.sem || c.kind === 'date' || c.kind === 'time' || c.kind === 'lines') continue;
      if (!/(ong\/ba|bi can|bi cao|nguoi bi|bi hai|nguoi lam chung|nguoi to giac|doi voi|ho ten|cua ong)/.test(norm(c.label))) continue;
      c.sem = 'hoTen';
      c.person = n;
      c.key = `p${n}.hoTen`;
      c.label = 'Họ và tên';
      c.kind = 'text';
      break;
    }
  }
  const seen = new Map();
  for (const f of fields) {
    if (f.person !== undefined) continue;
    const c = (seen.get(f.label) || 0) + 1;
    seen.set(f.label, c);
    if (c > 1) f.label = `${f.label} (${c})`;
  }

  const outFields = fields.map((f, n) => {
    const o = { key: f.key, label: f.label, kind: f.kind, slots: f.slots };
    if (f.sem) o.sem = f.sem;
    if (f.person !== undefined) o.person = f.person;
    if (f.hint) o.hint = f.hint;
    o.n = n;
    return o;
  });
  return {
    fields: outFields,
    persons: persons.map((p, n) => ({ id: n, label: `Người ${n + 1}`, ctx: p.ctx })),
    notes: { marks, paras: noteParas.map(({ part, i }) => ({ part, i })), count: noteCount },
    stats: { slots: outFields.reduce((t, f) => t + f.slots.length, 0), fields: outFields.length },
  };
}
