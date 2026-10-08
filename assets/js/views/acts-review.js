// Khối dùng chung: nhập tài liệu (tải tệp / dán chữ) và duyệt danh sách hành vi đề xuất (chọn, sửa tên, đổi điều
// luật, xem câu hỏi sẽ sinh), rồi lưu thành lựa chọn kế hoạch hỏi. Dùng ở hộp thoại “Thêm hành vi từ tài liệu”
// và luồng “Phân tích vụ việc” 4 bước.
import { $, $$, icon, toast, escapeHtml } from '../ui.js';
import { findCrime, crimeWithCustomActs } from '../legal/engine.js';
import { customActs } from '../legal/repo.js';
import { questionsForAct, taiLieuForAct, aiItems, analyzeRefinePrompt, ANALYZE_SYSTEM } from '../legal/analyze.js';
import { extractJson, streamAI } from '../lib/ai.js';
import { refineHtml, bindRefine } from './ai-refine.js';
import { extractText } from '../lib/extract.js';

export const MAX_FILE = 40 * 1024 * 1024;
export const lines = (v) => String(v || '').split('\n').map((x) => x.replace(/^\s*[-•\d.)]+\s*/, '').trim()).filter(Boolean);

/* ---------------- Nhập tài liệu ---------------- */

export const dropzoneHtml = (hint = 'Đơn tố giác, báo cáo xác minh, kết luận thanh tra, biên bản… (.pdf, .docx, ảnh chụp, .txt)') => `
  <label class="la-drop" data-drop>
    <input type="file" accept=".pdf,.docx,.txt,.md,.html,image/*" multiple data-file hidden />
    ${icon('upload')}<strong>Chọn hoặc kéo thả tài liệu (Word, PDF, ảnh)</strong>
    <small>${escapeHtml(hint)}</small>
    <span class="la-files" data-files></span>
  </label>`;

/** Gắn vùng kéo thả. Trả về { files() } — danh sách tệp đã chọn. */
export function bindDropzone(box, onChange = () => {}) {
  const files = [];
  const input = $('[data-file]', box);
  const drop = $('[data-drop]', box);
  const show = () => {
    $('[data-files]', box).innerHTML = files.map((f, i) => `<span class="badge">${icon('file', 'ic-sm')}${escapeHtml(f.name)}<button type="button" class="la-file-x" data-file-x="${i}" aria-label="Bỏ tệp ${escapeHtml(f.name)}">×</button></span>`).join('');
    onChange(files);
  };
  const add = (list) => {
    for (const f of list) {
      if (f.size > MAX_FILE) toast(`“${f.name}” lớn hơn 40 MB`, { type: 'error' });
      else files.push(f);
    }
    show();
  };
  input.addEventListener('change', () => add([...input.files]));
  drop.addEventListener('dragover', (e) => (e.preventDefault(), drop.classList.add('over')));
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    add([...e.dataTransfer.files]);
  });
  drop.addEventListener('click', (e) => {
    const x = e.target.closest('[data-file-x]');
    if (!x) return;
    e.preventDefault();
    files.splice(+x.dataset.fileX, 1);
    show();
  });
  return { files: () => files };
}

/** Đọc chữ từ các tệp (PDF có chữ / ảnh quét → OCR, Word, ảnh) và nối với phần dán. say(msg) báo tiến độ. */
export async function readAll(files, pasted, say = () => {}) {
  let text = String(pasted || '').trim();
  for (const f of files) {
    say(`Đang đọc “${f.name}”…`);
    const r = await extractText(f, { onProgress: (p) => say(`Nhận dạng chữ “${f.name}” — trang ${p.page}/${p.total}${p.pct ? ` ${Math.round(p.pct * 100)}%` : ''}`) });
    if (r.ocr) toast(`“${f.name}” là ảnh quét — đã nhận dạng chữ (OCR)`, { type: 'info' });
    text = `${text}\n\n${r.text}`.trim();
  }
  return text;
}

/* ---------------- Duyệt hành vi ---------------- */

export function genQuestions(r) {
  const c = crimeWithCustomActs(r.dieu);
  return r.cauHoiAi?.length ? r.cauHoiAi : questionsForAct(c, r.ten, r.trich);
}

export function existingOf(r) {
  const c = crimeWithCustomActs(r.dieu);
  if (!c) return null;
  if (r.hanhViId && r.ten === r.tenGoc) return c.hanhVi.find((h) => h.id === r.hanhViId) || null;
  return c.hanhVi.find((h) => h.ten.trim().toLowerCase() === r.ten.trim().toLowerCase()) || null;
}

/** Hàng hành vi từ kết quả phân tích. planned: { [dieu]: [id hành vi đã có trong kế hoạch] } → bỏ chọn sẵn. */
export function toRows(items, planned = {}) {
  const rows = items.map((x, i) => ({ ...x, idx: i, tenGoc: x.ten, cauHoiAi: x.cauHoi || [], edited: false }));
  rows.forEach((r) => (r.q = r.hanhViId ? [] : genQuestions(r)));
  rows.forEach((r) => (planned[r.dieu] || []).includes(r.hanhViId) && ((r.checked = false), (r.daCo = true)));
  return rows;
}

export function newRow(rows, dieu) {
  return { idx: rows.length ? Math.max(...rows.map((x) => x.idx)) + 1 : 0, ten: '', tenGoc: '', dieu, hanhViId: null, trich: '', checked: true, nguon: 'tu-nhap', cauHoiAi: [], q: [] };
}

export function rowHtml(r, ds) {
  const known = existingOf(r);
  const c = findCrime(r.dieu);
  return `<div class="la-row ${r.checked ? 'on' : ''}" data-row="${r.idx}">
    <input type="checkbox" class="la-check" data-r-check ${r.checked ? 'checked' : ''} aria-label="Chọn hành vi" />
    <div class="la-main">
      <div class="la-line">
        <input class="input la-name" data-r-name value="${escapeHtml(r.ten)}" placeholder="Tên hành vi" aria-label="Tên hành vi" />
        ${
          r.askOther
            ? `<span class="la-other"><input class="input" data-r-other inputmode="numeric" placeholder="Số điều" aria-label="Số điều BLHS" /><button class="btn btn-sm" type="button" data-r-other-ok>Chọn</button></span>`
            : `<select class="select la-dieu" data-r-dieu aria-label="Điều luật">${ds.map((d) => `<option value="${d}" ${d === r.dieu ? 'selected' : ''}>Điều ${d}</option>`).join('')}<option value="__other">Điều khác…</option></select>`
        }
      </div>
      <div class="la-meta">
        ${known ? `<span class="badge badge-success" title="Dùng bộ câu hỏi có sẵn của hành vi này">Có trong hệ thống</span>` : `<span class="badge badge-accent" title="Sẽ được lưu thành hành vi tự thêm của Điều ${r.dieu}">Hành vi mới</span>`}
        ${r.daCo ? '<span class="badge">Đã có trong kế hoạch</span>' : ''}
        ${r.ngoaiDanhMuc ? `<span class="badge badge-warning">Điều ${escapeHtml(r.dieu)} chưa có trong hệ thống — chọn điều khác</span>` : ''}
        ${r.nguon === 'ai' ? `<span class="badge" title="${known ? 'AI xác định, đã khớp hành vi trong Bộ luật của phần mềm' : 'AI đề xuất — chưa có trong Bộ luật của phần mềm, kiểm tra kỹ'}">${known ? 'AI · khớp Bộ luật' : 'AI đề xuất'}</span>` : r.nguon === 'tu-nhap' ? '' : '<span class="badge" title="Xác định bằng đối chiếu với Bộ luật trong phần mềm">Đối chiếu Bộ luật</span>'}
        <small>${c ? escapeHtml(c.ten) : ''}</small>
      </div>
      ${r.trich ? `<blockquote class="la-quote">${icon('quote', 'ic-sm')}${escapeHtml(r.trich)}</blockquote>` : ''}
      ${r.lyDo ? `<p class="la-why">${escapeHtml(r.lyDo)}</p>` : ''}
      ${
        known
          ? `<small class="hint">${known.cauHoi.length} câu hỏi đặc thù có sẵn + câu hỏi theo cấu thành Điều ${r.dieu}.</small>`
          : `<details class="la-qs"><summary>Câu hỏi sẽ sinh (${r.q.length}) — sửa được</summary><textarea class="textarea" rows="${Math.min(10, r.q.length + 1)}" data-r-q>${escapeHtml(r.q.join('\n'))}</textarea></details>`
      }
    </div>
  </div>`;
}

/** Gắn sự kiện cho các hàng trong box. rerender(): vẽ lại; onCount(): cập nhật số đã chọn. */
export function bindRows(box, rows, { rerender, onCount }) {
  $$('[data-row]', box).forEach((el) => {
    const r = rows.find((x) => x.idx === +el.dataset.row);
    if (!r) return;
    $('[data-r-check]', el).addEventListener('change', (e) => {
      r.checked = e.target.checked;
      el.classList.toggle('on', r.checked);
      onCount();
    });
    $('[data-r-name]', el).addEventListener('change', (e) => {
      r.ten = e.target.value.trim();
      if (!r.edited) r.q = genQuestions({ ...r, cauHoiAi: [] });
      if (!r.checked && r.ten) r.checked = true;
      rerender();
    });
    const setDieu = (d) => {
      r.dieu = d;
      r.askOther = false;
      r.ngoaiDanhMuc = false;
      if (r.hanhViId && !crimeWithCustomActs(d)?.hanhVi.some((h) => h.id === r.hanhViId)) r.hanhViId = null;
      if (!r.edited) r.q = genQuestions({ ...r, cauHoiAi: [] });
      rerender();
    };
    $('[data-r-dieu]', el)?.addEventListener('change', (e) => {
      if (e.target.value !== '__other') return setDieu(e.target.value);
      r.askOther = true;
      rerender();
      $(`[data-row="${r.idx}"] [data-r-other]`, box)?.focus();
    });
    const pickOther = () => {
      const v = $('[data-r-other]', el).value.trim();
      const c = v && findCrime(v);
      if (!c) return toast(v ? `Hệ thống chưa có Điều ${v} của Bộ luật Hình sự` : 'Nhập số điều, vd: 174', { type: 'error' });
      setDieu(c.dieu);
    };
    $('[data-r-other-ok]', el)?.addEventListener('click', pickOther);
    $('[data-r-other]', el)?.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), pickOther()));
    $('[data-r-q]', el)?.addEventListener('input', (e) => {
      r.q = lines(e.target.value);
      r.edited = true;
    });
  });
}

/**
 * Lưu lựa chọn: hành vi có sẵn dùng id có sẵn (kèm câu hỏi bám đoạn trích), hành vi mới lưu thành hành vi tự thêm.
 * Trả về { byDieu: Map(dieu → [id]), quotes: [{ dieu, id, text }], created, skipped }.
 */
export function commitRows(rows) {
  const byDieu = new Map();
  const quotes = [];
  let created = 0;
  let skipped = 0;
  for (const r of rows.filter((x) => x.checked && x.ten.trim())) {
    const c = crimeWithCustomActs(r.dieu);
    if (!c) {
      skipped++;
      continue;
    }
    let id = existingOf(r)?.id;
    if (id && r.trich) quotes.push({ dieu: c.dieu, id, text: questionsForAct(c, r.ten, r.trich)[0] });
    if (!id) {
      const q = r.q?.length ? r.q : genQuestions(r);
      id = customActs.save(c.dieu, { ten: r.ten.trim(), cauHoi: q, taiLieu: r.taiLieu?.length ? r.taiLieu : taiLieuForAct(r.ten), nguon: r.nguon === 'tu-nhap' ? 'tu-nhap' : 'tai-lieu', trich: r.trich || '' }).id;
      created++;
    }
    byDieu.set(c.dieu, [...new Set([...(byDieu.get(c.dieu) || []), id])]);
  }
  return { byDieu, quotes, created, skipped };
}

/* ---------------- Yêu cầu AI làm tiếp trên danh sách hành vi ---------------- */

const lkey = (t) => String(t || '').normalize('NFC').toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();

/**
 * Áp kết quả AI làm tiếp lên danh sách hàng (sửa trực tiếp rows): hành vi mới → thêm hàng (đã chọn); hành vi sửa
 * (tenCu khớp) → cập nhật; “bo” → bỏ chọn (không xóa, người dùng vẫn chọn lại được).
 */
export function refineRows(rows, raw, primary) {
  const j = typeof raw === 'string' ? extractJson(raw) : raw;
  if (!j || (!Array.isArray(j.hanhVi) && !Array.isArray(j.bo))) throw new Error('AI trả về kết quả không đúng định dạng — danh sách hành vi giữ nguyên.');
  const items = aiItems(j.hanhVi, primary);
  let added = 0;
  let updated = 0;
  let removed = 0;
  items.forEach((it, i) => {
    const old = (j.hanhVi[i]?.tenCu && rows.find((r) => lkey(r.ten) === lkey(j.hanhVi[i].tenCu))) || rows.find((r) => lkey(r.ten) === lkey(it.ten) || (it.hanhViId && r.hanhViId === it.hanhViId && r.dieu === it.dieu));
    if (old) {
      Object.assign(old, { ten: it.ten, dieu: it.dieu || old.dieu, hanhViId: it.hanhViId ?? old.hanhViId, trich: it.trich || old.trich, lyDo: it.lyDo || old.lyDo, cauHoiAi: it.cauHoi?.length ? it.cauHoi : old.cauHoiAi, checked: true, edited: true });
      old.q = old.hanhViId ? [] : genQuestions(old);
      updated++;
      return;
    }
    const r = { ...it, idx: rows.length ? Math.max(...rows.map((x) => x.idx)) + 1 : 0, tenGoc: it.ten, cauHoiAi: it.cauHoi || [], edited: false };
    r.q = r.hanhViId ? [] : genQuestions(r);
    rows.push(r);
    added++;
  });
  for (const t of j.bo || []) {
    const r = rows.find((x) => lkey(x.ten) === lkey(t));
    if (r && r.checked) {
      r.checked = false;
      removed++;
    }
  }
  return { added, updated, removed, tomTat: j.tomTat || null, note: String(j.ghiChu || '').slice(0, 300) };
}

/**
 * Gắn hộp “Yêu cầu AI làm tiếp” dưới danh sách hành vi. opts: { text, primary, role, candidates, rows (mảng — sửa
 * trực tiếp), result (kết quả phân tích — cập nhật tóm tắt), rerender(), state ({history, undo} dùng lại giữa các lần vẽ) }.
 */
export function mountRowsRefine(host, ctx, { text, primary, role, candidates, rows, result, rerender, state }) {
  if (!host) return null;
  const ai = ctx.hasAI('legal') ? ctx.ai('legal') : null;
  host.innerHTML = refineHtml({
    ai,
    title: 'Yêu cầu AI làm tiếp',
    placeholder: 'Ví dụ: tìm thêm hành vi lập chứng từ khống, tách hành vi nhận tiền theo từng lần, xem lại điều luật của hành vi 2…',
    hint: 'AI xem lại tài liệu theo yêu cầu: thêm hành vi còn thiếu, sửa hành vi đã có, bỏ chọn hành vi không phù hợp.',
    offlineHint: 'Kết nối AI trong Cài đặt để yêu cầu AI tìm thêm, sửa hành vi theo ý muốn.',
  });
  if (!ai) return null;
  return bindRefine(host, {
    history: state.history,
    undo: state.undo,
    context: () => ({ extra: ['Tìm thêm hành vi còn thiếu trong tài liệu', 'Xem lại điều luật áp dụng cho từng hành vi', 'Tách hành vi gộp thành từng hành vi riêng'] }),
    snapshot: () => JSON.stringify({ rows, tomTat: result.tomTat }),
    restore: (snap) => {
      const o = JSON.parse(snap);
      rows.splice(0, rows.length, ...o.rows);
      result.tomTat = o.tomTat;
    },
    onDone: rerender,
    run: async (request, { signal, say }) => {
      const max = ai.local ? 5000 : 12000;
      say(`${ai.local ? 'AI trên máy' : ai.label} đang thực hiện yêu cầu…`);
      const out = await streamAI({ ...ai, system: ANALYZE_SYSTEM, cache: true, maxTokens: 4000, signal, messages: [{ role: 'user', content: analyzeRefinePrompt(text, request, { primary, candidates, role, current: rows.filter((r) => r.ten.trim()), max }) }] });
      const r = refineRows(rows, out, primary);
      if (r.tomTat) result.tomTat = r.tomTat;
      const parts = [r.added && `thêm ${r.added}`, r.updated && `sửa ${r.updated}`, r.removed && `bỏ chọn ${r.removed}`].filter(Boolean);
      toast(parts.length ? `AI đã ${parts.join(', ')} hành vi` : 'AI không thay đổi danh sách hành vi', { type: parts.length ? 'success' : 'info' });
      return [r.note, parts.length ? `${parts.join(', ')} hành vi` : 'Không thay đổi'].filter(Boolean).join(' · ');
    },
  });
}
