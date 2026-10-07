// Thêm hành vi từ tài liệu: tải đơn tố giác, báo cáo, kết luận thanh tra, biên bản… → đọc, tóm tắt, liệt kê
// hành vi có dấu hiệu tội phạm theo điều luật trong hệ thống (một vụ việc có thể liên quan nhiều điều).
// Người dùng chọn / bỏ chọn, sửa tên, đổi điều luật, xem câu hỏi sẽ sinh → bấm “Thêm hành vi”.
import { $, $$, icon, toast, escapeHtml } from '../ui.js';
import { findCrime, crimeWithCustomActs } from '../legal/engine.js';
import { customActs } from '../legal/repo.js';
import { getRole } from '../legal/roles.js';
import { analyzeOffline, analyzeWithAi, questionsForAct, taiLieuForAct } from '../legal/analyze.js';
import { extractText } from '../lib/extract.js';
import { streamAI } from '../lib/ai.js';

const MAX_FILE = 40 * 1024 * 1024;
const lines = (v) => String(v || '').split('\n').map((x) => x.replace(/^\s*[-•\d.)]+\s*/, '').trim()).filter(Boolean);

/**
 * opts: { crime (điều đang mở), roleId, selected (id hành vi đã chọn), onAdd({ primaryIds, related: [{ dieu, hanhViIds }], quotes: [{ dieu, id, text }] }) }
 */
export function openAnalyzeDialog(ctx, { crime, roleId, selected = [], onAdd }) {
  const ai = ctx.ai('legal');
  let result = null;
  let rows = [];
  let controller = null;

  ctx.modal(
    `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
    <h2 class="modal-title">Thêm hành vi từ tài liệu</h2>
    <p class="hint">Điều đang làm việc: <strong>Điều ${crime.dieu}</strong> — ${escapeHtml(crime.ten)}. Hệ thống đọc tài liệu, tóm tắt và đối chiếu từng hành vi với các điều luật đang có; một vụ việc có thể thuộc nhiều điều cùng lúc.</p>
    <div class="la-body" data-step="input">
      <label class="la-drop" data-drop>
        <input type="file" accept=".pdf,.docx,.txt,.md,.html,image/*" multiple data-file hidden />
        ${icon('upload')}<strong>Chọn hoặc kéo thả tài liệu</strong>
        <small data-drop-hint>Đơn tố giác, báo cáo xác minh, kết luận thanh tra, biên bản… (.pdf, .docx, ảnh chụp, .txt)</small>
        <span class="la-files" data-files></span>
      </label>
      <div class="field"><label for="la-text">Hoặc dán nội dung</label><textarea class="textarea" rows="5" id="la-text" data-text placeholder="Dán nội dung đơn, báo cáo, lời khai…"></textarea></div>
      <div class="la-mode">${
        ai
          ? `<label class="check"><input type="checkbox" data-use-ai checked />Phân tích sâu bằng <strong>${escapeHtml(ai.local ? 'AI trên máy' : ai.label)}</strong>${ai.local ? ' — tài liệu không ra khỏi máy / mạng nội bộ' : ' — nội dung tài liệu sẽ được gửi tới dịch vụ AI'}</label>`
          : `<p class="note">${icon('lock', 'ic-sm')}<span>Phân tích chạy hoàn toàn trên máy (đối chiếu tên tội danh, điều luật được viện dẫn, hành vi trong hệ thống). Kết nối <a class="link" href="#settings">AI chạy trên máy</a> để phân tích sâu hơn mà không gửi dữ liệu ra ngoài.</span></p>`
      }</div>
      <p class="hint" data-progress hidden></p>
    </div>
    <div class="la-body" data-step="review" hidden></div>
    <div class="modal-actions" data-actions>
      <button class="btn" type="button" data-close>Hủy</button>
      <button class="btn btn-primary" type="button" data-analyze>${icon('sparkles', 'ic-sm')}Phân tích</button>
    </div>`,
    {
      className: 'modal-wide la-modal',
      label: 'Thêm hành vi từ tài liệu',
      onMount(box, close) {
        let files = [];
        const fileInput = $('[data-file]', box);
        const drop = $('[data-drop]', box);
        const progress = $('[data-progress]', box);
        const showFiles = () => ($('[data-files]', box).innerHTML = files.map((f) => `<span class="badge">${icon('file', 'ic-sm')}${escapeHtml(f.name)}</span>`).join(''));
        const addFiles = (list) => {
          for (const f of list) {
            if (f.size > MAX_FILE) toast(`“${f.name}” lớn hơn 40 MB`, { type: 'error' });
            else files.push(f);
          }
          showFiles();
        };
        fileInput.addEventListener('change', () => addFiles([...fileInput.files]));
        drop.addEventListener('dragover', (e) => (e.preventDefault(), drop.classList.add('over')));
        drop.addEventListener('dragleave', () => drop.classList.remove('over'));
        drop.addEventListener('drop', (e) => {
          e.preventDefault();
          drop.classList.remove('over');
          addFiles([...e.dataTransfer.files]);
        });
        const say = (t) => {
          progress.hidden = !t;
          progress.innerHTML = t ? `${icon('refresh', 'ic-sm spin')}${escapeHtml(t)}` : '';
        };

        const actions = $('[data-actions]', box);
        const setActions = (html) => {
          actions.innerHTML = html;
          $$('[data-close]', actions).forEach((b) => b.addEventListener('click', close));
        };

        async function analyze() {
          const btn = $('[data-analyze]', box);
          let text = $('[data-text]', box).value.trim();
          if (!files.length && !text) return toast('Chọn tài liệu hoặc dán nội dung cần phân tích', { type: 'error' });
          btn.disabled = true;
          try {
            for (const f of files) {
              say(`Đang đọc “${f.name}”…`);
              const r = await extractText(f, { onProgress: (p) => say(`Nhận dạng chữ “${f.name}” — trang ${p.page}/${p.total}${p.pct ? ` ${Math.round(p.pct * 100)}%` : ''}`) });
              if (r.ocr) toast(`“${f.name}” là ảnh quét — đã nhận dạng chữ (OCR)`, { type: 'info' });
              text = `${text}\n\n${r.text}`.trim();
            }
            if (text.replace(/\s/g, '').length < 40) throw new Error('Tài liệu quá ngắn hoặc không đọc được chữ.');
            say('Đang đối chiếu với các điều luật trong hệ thống…');
            const offline = analyzeOffline(text, { primary: crime.dieu });
            result = offline;
            if (ai && $('[data-use-ai]', box)?.checked) {
              say(`${ai.local ? 'AI trên máy' : ai.label} đang phân tích tài liệu… (có thể mất 1–2 phút)`);
              controller = new AbortController();
              setActions(`<span class="spacer"></span><button class="btn" type="button" data-stop>${icon('stop', 'ic-sm')}Dừng, dùng kết quả trên máy</button>`);
              $('[data-stop]', actions).addEventListener('click', () => controller.abort());
              try {
                result = await analyzeWithAi((o) => streamAI({ ...ctx.ai('legal'), ...o }), text, { primary: crime.dieu, offline, role: getRole(roleId).ten, signal: controller.signal });
              } catch (err) {
                if (!controller.signal.aborted) toast(`${err.message} — dùng kết quả phân tích trên máy.`, { type: 'info', timeout: 6000 });
              }
            }
            say('');
            showReview();
          } catch (err) {
            say('');
            toast(err.message, { type: 'error', timeout: 6000 });
            setActions(`<button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="button" data-analyze>${icon('sparkles', 'ic-sm')}Phân tích</button>`);
            $('[data-analyze]', actions).addEventListener('click', analyze);
          }
        }
        $('[data-analyze]', box).addEventListener('click', analyze);

        /* ---------- Duyệt kết quả ---------- */
        const dieuOptions = () => {
          const ds = [...new Set([crime.dieu, ...result.crimes.map((c) => c.dieu), ...rows.map((r) => r.dieu)])].filter((d) => findCrime(d));
          return ds;
        };
        const genQuestions = (r) => {
          const c = crimeWithCustomActs(r.dieu);
          return r.cauHoiAi?.length ? r.cauHoiAi : questionsForAct(c, r.ten, r.trich);
        };
        const existingOf = (r) => {
          const c = crimeWithCustomActs(r.dieu);
          if (!c) return null;
          if (r.hanhViId && r.ten === r.tenGoc) return c.hanhVi.find((h) => h.id === r.hanhViId) || null;
          return c.hanhVi.find((h) => h.ten.trim().toLowerCase() === r.ten.trim().toLowerCase()) || null;
        };

        function showReview() {
          rows = result.items.map((x, i) => ({ ...x, idx: i, tenGoc: x.ten, cauHoiAi: x.cauHoi || [], edited: false }));
          rows.forEach((r) => (r.q = r.hanhViId ? [] : genQuestions(r)));
          // Hành vi đã có trong kế hoạch thì bỏ chọn sẵn.
          rows.forEach((r) => r.dieu === crime.dieu && selected.includes(r.hanhViId) && ((r.checked = false), (r.daCo = true)));
          $('[data-step="input"]', box).hidden = true;
          renderReview();
        }

        function rowHtml(r, ds) {
          const known = existingOf(r);
          const c = findCrime(r.dieu);
          return `<div class="la-row ${r.checked ? 'on' : ''}" data-row="${r.idx}">
            <input type="checkbox" class="la-check" data-r-check ${r.checked ? 'checked' : ''} aria-label="Chọn hành vi" />
            <div class="la-main">
              <div class="la-line">
                <input class="input la-name" data-r-name value="${escapeHtml(r.ten)}" aria-label="Tên hành vi" />
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
                ${r.nguon === 'ai' ? '<span class="badge">AI</span>' : ''}
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

        function renderReview() {
          const step = $('[data-step="review"]', box);
          step.hidden = false;
          const ds = dieuOptions();
          const groups = ds.map((d) => ({ d, items: rows.filter((r) => r.dieu === d) })).filter((g) => g.items.length);
          const orphan = rows.filter((r) => !ds.includes(r.dieu));
          step.innerHTML = `
            ${result.tomTat ? `<section class="la-sum"><h3>${icon('file', 'ic-sm')}Tóm tắt tài liệu${result.ai ? ' <span class="badge">AI</span>' : ''}</h3><p>${escapeHtml(result.tomTat)}</p></section>` : ''}
            <section class="la-crimes"><h3>${icon('book', 'ic-sm')}Điều luật liên quan (${result.crimes.length})</h3>
              <div class="la-chips">${result.crimes.map((c) => `<span class="la-chip ${c.dieu === crime.dieu ? 'primary' : ''}" title="${escapeHtml((c.reasons || []).join(' · '))}"><strong>Điều ${c.dieu}</strong> ${escapeHtml(c.ten.replace(/^Tội /, ''))}${c.dieu === crime.dieu ? ' <em>(đang mở)</em>' : ''}</span>`).join('') || '<small class="hint">Chưa xác định được điều luật nào — chọn điều cho từng hành vi bên dưới.</small>'}</div>
            </section>
            <section class="la-list"><h3>${icon('check-circle', 'ic-sm')}Hành vi phát hiện <small data-count></small></h3>
              ${rows.length ? '' : '<p class="hint">Không tìm thấy hành vi nào phù hợp. Thêm hành vi tự nhập bên dưới.</p>'}
              ${[...groups, ...(orphan.length ? [{ d: null, items: orphan }] : [])]
                .map((g) => `<div class="la-group"><h4>${g.d ? `Điều ${g.d} — ${escapeHtml(findCrime(g.d).ten)}${g.d === crime.dieu ? ' <em>(điều đang mở)</em>' : ' <em>(sẽ thêm làm điều liên quan)</em>'}` : 'Cần chọn điều luật'}</h4>${g.items.map((r) => rowHtml(r, ds)).join('')}</div>`)
                .join('')}
              <button class="btn btn-ghost btn-sm" type="button" data-add-row>${icon('plus', 'ic-sm')}Thêm hành vi tự nhập</button>
            </section>`;
          bindReview();
          updateCount();
        }

        function updateCount() {
          const n = rows.filter((r) => r.checked && r.ten.trim()).length;
          $('[data-count]', box).textContent = `${n}/${rows.length} đã chọn`;
          setActions(`<button class="btn btn-ghost" type="button" data-back>${icon('chevron-left', 'ic-sm')}Tài liệu khác</button><span class="spacer"></span><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="button" data-commit ${n ? '' : 'disabled'}>${icon('plus', 'ic-sm')}Thêm ${n} hành vi</button>`);
          $('[data-back]', actions).addEventListener('click', () => {
            $('[data-step="review"]', box).hidden = true;
            $('[data-step="input"]', box).hidden = false;
            setActions(`<button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="button" data-analyze>${icon('sparkles', 'ic-sm')}Phân tích</button>`);
            $('[data-analyze]', actions).addEventListener('click', analyze);
          });
          $('[data-commit]', actions).addEventListener('click', commit);
        }

        function bindReview() {
          $$('[data-row]', box).forEach((el) => {
            const r = rows.find((x) => x.idx === +el.dataset.row);
            $('[data-r-check]', el).addEventListener('change', (e) => {
              r.checked = e.target.checked;
              el.classList.toggle('on', r.checked);
              updateCount();
            });
            $('[data-r-name]', el).addEventListener('change', (e) => {
              r.ten = e.target.value.trim();
              if (!r.edited) r.q = genQuestions({ ...r, cauHoiAi: [] });
              if (!r.checked && r.ten) r.checked = true;
              renderReview();
            });
            const setDieu = (d) => {
              r.dieu = d;
              r.askOther = false;
              r.ngoaiDanhMuc = false;
              if (r.hanhViId && !crimeWithCustomActs(d)?.hanhVi.some((h) => h.id === r.hanhViId)) r.hanhViId = null;
              if (!r.edited) r.q = genQuestions({ ...r, cauHoiAi: [] });
              renderReview();
            };
            $('[data-r-dieu]', el)?.addEventListener('change', (e) => {
              if (e.target.value !== '__other') return setDieu(e.target.value);
              r.askOther = true;
              renderReview();
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
          $('[data-add-row]', box).addEventListener('click', () => {
            const r = { idx: rows.length ? Math.max(...rows.map((x) => x.idx)) + 1 : 0, ten: '', tenGoc: '', dieu: crime.dieu, hanhViId: null, trich: '', checked: true, nguon: 'tu-nhap', cauHoiAi: [], q: [] };
            rows.push(r);
            renderReview();
            $(`[data-row="${r.idx}"] [data-r-name]`, box)?.focus();
          });
        }

        function commit() {
          const chosen = rows.filter((r) => r.checked && r.ten.trim());
          const primaryIds = [];
          const related = new Map();
          let created = 0;
          const skipped = [];
          const quotes = [];
          for (const r of chosen) {
            const c = crimeWithCustomActs(r.dieu);
            if (!c) {
              skipped.push(r.ten);
              continue;
            }
            let id = existingOf(r)?.id;
            // Hành vi có sẵn: thêm câu hỏi bám đúng nội dung tài liệu (đoạn trích) vào vấn đề của hành vi.
            if (id && r.trich) quotes.push({ dieu: c.dieu, id, text: questionsForAct(c, r.ten, r.trich)[0] });
            if (!id) {
              const q = r.q?.length ? r.q : genQuestions(r);
              id = customActs.save(c.dieu, { ten: r.ten.trim(), cauHoi: q, taiLieu: r.taiLieu?.length ? r.taiLieu : taiLieuForAct(r.ten), nguon: 'tai-lieu', trich: r.trich || '' }).id;
              created++;
            }
            if (c.dieu === crime.dieu) primaryIds.push(id);
            else related.set(c.dieu, [...(related.get(c.dieu) || []), id]);
          }
          if (skipped.length) toast(`Bỏ qua ${skipped.length} hành vi chưa chọn được điều luật trong hệ thống`, { type: 'info' });
          if (!primaryIds.length && !related.size) return;
          onAdd({ primaryIds, related: [...related].map(([dieu, hanhViIds]) => ({ dieu, hanhViIds })), quotes });
          close();
          const parts = [primaryIds.length && `Điều ${crime.dieu}: ${primaryIds.length}`, ...[...related].map(([d, ids]) => `Điều ${d}: ${ids.length}`)].filter(Boolean);
          toast(`Đã thêm ${primaryIds.length + [...related.values()].flat().length} hành vi (${parts.join(', ')})${created ? ` — ${created} hành vi mới đã sinh câu hỏi` : ''}`, { timeout: 6000 });
        }
      },
    },
  );
}
