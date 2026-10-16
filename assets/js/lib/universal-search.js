// Tìm chung một ô cho mọi dữ liệu trên máy: hồ sơ vụ án, người tham gia, biên bản (cả nội dung hỏi – đáp), văn bản
// đã lập, văn bản tố tụng, kế hoạch hỏi, kho tài liệu, điều luật, sách Bình luận, biểu mẫu.
// Tìm không dấu, mọi từ khóa đều phải có (AND); kết quả có trích đoạn quanh chỗ khớp.

// Bỏ dấu từng ký tự, GIỮ độ dài chuỗi → vị trí khớp trên chuỗi đã bỏ dấu trùng vị trí trên bản gốc.
const foldChar = (c) => (c === 'đ' || c === 'Đ' ? 'd' : c.normalize('NFD')[0].toLowerCase());
export const foldKeep = (s) => [...String(s || '')].map(foldChar).join('');
export const tokens = (q) =>
  foldKeep(q)
    .replace(/[^a-z0-9/.\- ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

// Khớp ĐẦU TỪ (gõ "an" khớp "An", "Anh" — không khớp "Ban", "sản") để kết quả gọn, đúng ý.
const isWordChar = (c) => /[a-z0-9]/.test(c || '');
/** Vị trí các lần khớp đầu từ của t trong chuỗi đã bỏ dấu f. */
export function matchAt(f, t) {
  const out = [];
  if (!t) return out;
  let i = f.indexOf(t);
  while (i >= 0) {
    if (!isWordChar(f[i - 1]) || !isWordChar(t[0])) out.push(i);
    i = f.indexOf(t, i + 1);
  }
  return out;
}
const hasAll = (folded, toks) => toks.every((t) => matchAt(folded, t).length);

/** Trích đoạn ~110 ký tự quanh từ khóa đầu tiên tìm thấy. */
export function snippetOf(text, toks, span = 110) {
  const s = String(text || '').replace(/\s+/g, ' ');
  const f = foldKeep(s);
  let at = -1;
  for (const t of toks) {
    at = matchAt(f, t)[0] ?? -1;
    if (at >= 0) break;
  }
  if (at < 0) return s.slice(0, span) + (s.length > span ? '…' : '');
  const chars = [...s];
  const start = Math.max(0, at - Math.floor(span / 3));
  const end = Math.min(chars.length, start + span);
  return `${start ? '…' : ''}${chars.slice(start, end).join('')}${end < chars.length ? '…' : ''}`;
}

const flat = (v) => (v == null ? '' : typeof v === 'object' ? Object.values(v).map(flat).join(' ') : String(v));
const vnDate = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');

export const GROUPS = [
  { id: 'cases', label: 'Hồ sơ vụ án', icon: 'folder' },
  { id: 'persons', label: 'Người tham gia', icon: 'user' },
  { id: 'records', label: 'Biên bản lời khai', icon: 'message' },
  { id: 'kho', label: 'Kho hồ sơ', icon: 'sparkles' },
  { id: 'ldocs', label: 'Văn bản tố tụng', icon: 'file' },
  { id: 'docs', label: 'Văn bản đã soạn', icon: 'file' },
  { id: 'plans', label: 'Kế hoạch hỏi', icon: 'layers' },
  { id: 'crimes', label: 'Điều luật (Cây hỏi đáp)', icon: 'gavel' },
  { id: 'binhluan', label: 'Bình luận BLHS', icon: 'book' },
  { id: 'forms', label: 'Biểu mẫu', icon: 'clipboard' },
];

/**
 * src: { cases, records, docs, ldocs, plans, kho, crimes, book, forms, mauForms, roleName(id), formName(id) }
 * Trả về [{ id, label, icon, total, items: [{ title, sub, snippet, href, score }] }] — chỉ nhóm có kết quả.
 */
export function searchAll(q, src = {}, { limit = 6 } = {}) {
  const toks = tokens(q);
  if (!toks.length) return [];
  const num = /^\d{1,3}[a-zđ]?$/.test(toks[0]) && toks.length === 1 ? toks[0] : null;
  const roleName = src.roleName || (() => '');
  const out = Object.fromEntries(GROUPS.map((g) => [g.id, []]));
  const add = (g, title, extra, item) => {
    const ft = foldKeep(title);
    const hay = `${ft} ${foldKeep(extra)}`;
    if (!hasAll(hay, toks)) return false;
    out[g].push({ title, score: (hasAll(ft, toks) ? 10 : 0) + (item.at || 0) / 1e13, ...item });
    return true;
  };

  for (const c of src.cases || []) {
    const sub = [c.soHoSo && `Số ${c.soHoSo}`, (c.toiDanh || []).map((d) => `Điều ${d}`).join(', '), `${(c.persons || []).length} người`].filter(Boolean).join(' · ');
    add('cases', c.ten || '(chưa đặt tên)', `${c.soHoSo || ''} ${(c.toiDanh || []).join(' ')} ${(c.persons || []).map((p) => p.hoTen).join(' ')} ${c.ghiChu || ''}`, { sub, href: `#cases/${c.id}`, at: c.updatedAt });
    for (const p of c.persons || []) add('persons', p.hoTen || '', `${roleName(p.roleId)} ${p.ngaySinh || p.namSinh || ''} ${p.noiCuTru || p.diaChi || ''}`, { sub: `${roleName(p.roleId)} · ${c.ten}`, href: `#cases/${c.id}`, at: c.updatedAt });
  }
  const caseName = (id) => (src.cases || []).find((c) => c.id === id)?.ten || '';
  for (const r of src.records || []) {
    const name = r.nguoiKhai?.hoTen || 'Chưa ghi tên';
    const qa = (r.qa || []).map((x) => `Hỏi: ${x.q} — Đáp: ${x.a || ''}`);
    const hit = qa.find((t) => hasAll(foldKeep(t), toks)) || qa.find((t) => toks.some((k) => matchAt(foldKeep(t), k).length));
    add('records', `${name} — lần ${r.lan || 1}`, `${roleName(r.roleId)} ${caseName(r.caseId)} ${qa.join(' ')}`, {
      sub: [roleName(r.roleId), vnDate(r.ngay), caseName(r.caseId)].filter(Boolean).join(' · '),
      snippet: hit ? snippetOf(hit, toks) : '',
      href: `#interview/${r.id}`,
      at: r.updatedAt,
    });
  }
  for (const d of src.kho || []) {
    if (d.app) continue; // biên bản / văn bản trong phần mềm đã có nhóm riêng
    add('kho', d.ten || '', `${d.text || ''}`, { sub: [d.ngay, caseName(d.caseId)].filter(Boolean).join(' · '), snippet: d.text && !hasAll(foldKeep(d.ten), toks) ? snippetOf(d.text, toks) : '', href: `#kho/xem/${encodeURIComponent(d.id)}`, at: d.updatedAt });
  }
  for (const d of src.ldocs || []) add('ldocs', d.title || '', flat(d.values), { sub: caseName(d.caseId), href: `#forms/doc/${d.id}`, at: d.updatedAt });
  for (const d of src.docs || []) {
    const body = d.text || flat(d.values);
    add('docs', d.title || '(không tên)', body, { sub: src.formName?.(d.typeId || d.type) || '', snippet: hasAll(foldKeep(d.title), toks) ? '' : snippetOf(body, toks), href: `#compose/doc/${d.id}`, at: d.updatedAt });
  }
  for (const p of src.plans || []) add('plans', p.title || 'Kế hoạch hỏi', `${caseName(p.caseId)} ${p.dieu || ''}`, { sub: caseName(p.caseId), href: `#legal/plan/${p.id}`, at: p.updatedAt });
  for (const c of src.crimes || []) {
    const item = { sub: c.chuong || '', href: `#legal/${c.dieu}` };
    if (!num) add('crimes', `Điều ${c.dieu}. ${c.ten}`, c.chuong || '', item);
    else if (c.dieu === num) out.crimes.push({ title: `Điều ${c.dieu}. ${c.ten}`, ...item, score: 20 });
  }
  if (src.book) {
    for (const a of src.book.articles || []) {
      const title = `Điều ${a.so}. ${a.ten}`;
      if (num) {
        if (a.so === num) out.binhluan.push({ title, sub: a.chuong || '', href: `#binh-luan/${a.so}`, score: 20 });
        continue;
      }
      if (hasAll(foldKeep(title), toks)) {
        out.binhluan.push({ title, sub: a.chuong || '', href: `#binh-luan/${a.so}`, score: 10 });
        continue;
      }
      const line = [...a.vb, ...a.bl].find((l) => hasAll(foldKeep(l), toks));
      if (line) out.binhluan.push({ title, sub: a.chuong || '', snippet: snippetOf(line.replace(/\{\{fn:\d+\}\}/g, ''), toks), href: `#binh-luan/${a.so}`, score: 1 });
    }
  }
  for (const f of src.mauForms || []) {
    const item = { sub: f.nhom || 'Mẫu chính thức', href: `#forms/${f.id}` };
    if (!num) add('forms', `Mẫu ${f.so}. ${f.ten}`, f.nhom || '', item);
    else if (String(f.so).toLowerCase() === num) out.forms.push({ title: `Mẫu ${f.so}. ${f.ten}`, ...item, score: 20 });
  }
  if (!num) for (const f of src.forms || []) add('forms', f.ten, f.loai || '', { sub: 'Mẫu trong phần mềm', href: `#forms/${f.id}` });

  return GROUPS.map((g) => {
    const items = out[g.id].sort((a, b) => b.score - a.score);
    return { ...g, total: items.length, items: items.slice(0, limit) };
  }).filter((g) => g.total);
}
