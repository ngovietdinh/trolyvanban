// Tải biên bản lời khai đã có (Word, PDF, ảnh chụp, dán chữ) vào hệ thống: tự tách phần Hỏi – Đáp, nhận họ tên,
// ngày, lần; gắn hồ sơ, người khai, kế hoạch hỏi để đánh dấu các câu hỏi đã được trả lời và đưa vào theo dõi.
import { $, icon, toast, escapeHtml } from '../ui.js';
import { casesRepo, recordsRepo, plansRepo, customBank, learnedBank } from '../legal/repo.js';
import { newRecord, parsePastedQa } from '../legal/record.js';
import { generatePlan, findCrime } from '../legal/engine.js';
import { ROLES, getRole } from '../legal/roles.js';
import { parseRecordText, linkPairsToPlan, planFromSaved, qKey } from '../legal/tracking.js';
import { dropzoneHtml, bindDropzone, readAll } from './acts-review.js';
import { uid } from '../lib/store.js';

const today = () => new Date().toISOString().slice(0, 10);

export function openRecordUpload(ctx, { caseId = null, onSaved = () => {} } = {}) {
  const cases = casesRepo.list();
  ctx.modal(
    `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
    <h2 class="modal-title">Tải biên bản lên</h2>
    <p class="hint">Biên bản ghi lời khai, hỏi cung đã lập bên ngoài (Word, PDF, ảnh chụp) hoặc dán nội dung. Hệ thống tự tách các lượt <strong>Hỏi – Đáp</strong>, đối chiếu với kế hoạch hỏi để đánh dấu câu hỏi đã được trả lời và đưa vào phần theo dõi, báo cáo.</p>
    <div class="ru-grid">
      <div class="ru-src">
        ${dropzoneHtml('Mỗi lần một biên bản — có thể chọn nhiều ảnh/trang của cùng biên bản (.docx, .pdf, ảnh, .txt)')}
        <div class="field"><label for="ru-text">Hoặc dán nội dung biên bản</label><textarea class="textarea" id="ru-text" rows="5" data-ru-text placeholder="Hỏi: …&#10;Đáp: …"></textarea></div>
        <button class="btn btn-sm" type="button" data-ru-read>${icon('search', 'ic-sm')}Đọc biên bản</button>
        <p class="hint" data-ru-say aria-live="polite"></p>
      </div>
      <form class="ru-meta" data-ru-form novalidate>
        <div class="field"><label for="ru-case">Hồ sơ vụ án</label><select class="select" id="ru-case" name="caseId"><option value="">— Không gắn hồ sơ —</option>${cases.map((c) => `<option value="${c.id}" ${c.id === caseId ? 'selected' : ''}>${escapeHtml(c.ten)}</option>`).join('')}</select></div>
        <div class="field"><label for="ru-person">Người khai</label><select class="select" id="ru-person" name="personId"></select></div>
        <div class="grid-2" data-ru-new>
          <div class="field"><label for="ru-name">Họ tên người khai</label><input class="input" id="ru-name" name="hoTen" /></div>
          <div class="field"><label for="ru-role">Tư cách</label><select class="select" id="ru-role" name="roleId">${ROLES.map((r) => `<option value="${r.id}">${escapeHtml(r.ten.split('/')[0].trim())}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label for="ru-plan">Đối chiếu với kế hoạch hỏi</label><select class="select" id="ru-plan" name="plan"></select></div>
        <div class="grid-2">
          <div class="field"><label for="ru-date">Ngày lập</label><input class="input" type="date" id="ru-date" name="ngay" value="${today()}" /></div>
          <div class="field"><label for="ru-lan">Lần</label><input class="input" type="number" min="1" id="ru-lan" name="lan" value="1" /></div>
        </div>
        <div class="field"><label for="ru-status">Tình trạng biên bản</label><select class="select" id="ru-status" name="status"><option value="hoan-thanh">Đã hoàn thành (đã ký)</option><option value="dang-ghi">Đang ghi / còn bổ sung</option></select></div>
      </form>
    </div>
    <div class="ru-preview" data-ru-preview hidden></div>
    <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="button" data-ru-save disabled>${icon('save', 'ic-sm')}Lưu biên bản</button></div>`,
    {
      className: 'modal-wide ru-modal',
      label: 'Tải biên bản lên',
      onMount(box, close) {
        const f = $('[data-ru-form]', box);
        const say = (t) => ($('[data-ru-say]', box).textContent = t);
        const drop = bindDropzone(box);
        let parsed = null;
        let files = [];

        const fillCase = () => {
          const c = casesRepo.get(f.caseId.value);
          f.personId.innerHTML = `<option value="">— Người khai mới —</option>${(c?.persons || []).map((p) => `<option value="${p.id}">${escapeHtml(p.hoTen)} (${escapeHtml(getRole(p.roleId).ten.split('/')[0].trim())})</option>`).join('')}`;
          const plans = plansRepo.list((p) => (c ? p.caseId === c.id : !p.caseId));
          const crimes = (c?.toiDanh || []).map(findCrime).filter(Boolean);
          f.plan.innerHTML = `${plans.map((p) => `<option value="plan:${p.id}">Kế hoạch đã lưu: ${escapeHtml(p.title)}</option>`).join('')}${crimes.map((cr) => `<option value="auto:${cr.dieu}">Tự động — Điều ${cr.dieu} ${escapeHtml(cr.ten.replace(/^Tội /, ''))}</option>`).join('')}<option value="">Không đối chiếu kế hoạch</option>`;
          syncPerson();
        };
        const syncPerson = () => {
          const c = casesRepo.get(f.caseId.value);
          const p = c?.persons?.find((x) => x.id === f.personId.value);
          $('[data-ru-new]', box).hidden = !!p;
          // Ưu tiên kế hoạch đúng tư cách người khai.
          const roleId = p?.roleId || f.roleId.value;
          const match = [...f.plan.options].find((o) => o.value.startsWith('plan:') && plansRepo.get(o.value.slice(5))?.roleId === roleId);
          if (match) f.plan.value = match.value;
          if (p) f.lan.value = recordsRepo.list((r) => r.caseId === c.id && r.personId === p.id).length + 1;
        };
        f.caseId.addEventListener('change', fillCase);
        f.personId.addEventListener('change', syncPerson);
        f.roleId.addEventListener('change', syncPerson);
        fillCase();

        const planFor = (roleId) => {
          const v = f.plan.value;
          if (v.startsWith('plan:')) {
            const saved = plansRepo.get(v.slice(5));
            return { saved, plan: planFromSaved(saved, { roleId, custom: customBank.all(), learned: learnedBank.all() }) };
          }
          if (v.startsWith('auto:')) return { saved: null, plan: generatePlan({ dieu: v.slice(5), roleId }) };
          return { saved: null, plan: null };
        };
        const roleNow = () => casesRepo.get(f.caseId.value)?.persons?.find((x) => x.id === f.personId.value)?.roleId || f.roleId.value;

        const preview = () => {
          const out = $('[data-ru-preview]', box);
          if (!parsed) return (out.hidden = true);
          const { plan } = planFor(roleNow());
          const qa = linkPairsToPlan(parsed.pairs, plan, uid);
          const linked = qa.filter((x) => x.planQ).length;
          out.hidden = false;
          out.innerHTML = `<div class="ru-sum">${icon('check-circle', 'ic-sm')}<span>Đọc được <strong>${qa.length}</strong> lượt hỏi – đáp${plan ? ` · <strong>${linked}</strong> khớp câu hỏi của kế hoạch` : ''}${parsed.hoTen ? ` · người khai: <strong>${escapeHtml(parsed.hoTen)}</strong>` : ''}${parsed.ngay ? ` · ngày ${parsed.ngay.split('-').reverse().join('/')}` : ''}</span></div>
            ${qa.length ? `<ol class="ru-qa">${qa.slice(0, 6).map((x) => `<li><p><strong>Hỏi:</strong> ${escapeHtml(x.q)}${x.planQ ? ' <span class="badge badge-success">Khớp kế hoạch</span>' : ''}</p><p><strong>Đáp:</strong> ${escapeHtml(x.a || '(chưa trả lời)')}</p></li>`).join('')}</ol>${qa.length > 6 ? `<p class="hint">… và ${qa.length - 6} lượt khác.</p>` : ''}` : `<p class="note warn">${icon('alert', 'ic-sm')}<span>Không tìm thấy dòng “Hỏi:” / “Đáp:” (hoặc “H:”, “TL:”, “Trả lời:”). Kiểm tra lại nội dung biên bản.</span></p>`}`;
          $('[data-ru-save]', box).disabled = !qa.length;
        };
        f.plan.addEventListener('change', preview);

        $('[data-ru-read]', box).addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          files = drop.files();
          if (!files.length && !$('[data-ru-text]', box).value.trim()) return toast('Chọn tệp biên bản hoặc dán nội dung', { type: 'error' });
          btn.disabled = true;
          try {
            const text = await readAll(files, $('[data-ru-text]', box).value, say);
            parsed = parseRecordText(text, parsePastedQa);
            say('');
            // Điền sẵn thông tin đọc được.
            if (parsed.ngay) f.ngay.value = parsed.ngay;
            if (parsed.lan) f.lan.value = parsed.lan;
            if (parsed.hoTen) {
              const c = casesRepo.get(f.caseId.value);
              const p = c?.persons?.find((x) => qKey(x.hoTen) === qKey(parsed.hoTen));
              if (p) f.personId.value = p.id;
              else if (!f.hoTen.value) f.hoTen.value = parsed.hoTen;
            }
            if (parsed.roleId && !f.personId.value) f.roleId.value = parsed.roleId;
            syncPerson();
            if (parsed.lan) f.lan.value = parsed.lan;
            preview();
          } catch (err) {
            say('');
            toast(err.message, { type: 'error', timeout: 5000 });
          } finally {
            btn.disabled = false;
          }
        });

        $('[data-ru-save]', box).addEventListener('click', () => {
          if (!parsed?.pairs.length) return;
          let caseItem = casesRepo.get(f.caseId.value) || null;
          let person = caseItem?.persons?.find((x) => x.id === f.personId.value) || null;
          const roleId = person?.roleId || f.roleId.value;
          // Người khai mới thuộc hồ sơ → thêm vào danh sách người tham gia tố tụng.
          if (!person && caseItem && f.hoTen.value.trim()) {
            person = { id: uid(), hoTen: f.hoTen.value.trim(), roleId, quocTich: 'Việt Nam' };
            caseItem = casesRepo.save({ ...caseItem, persons: [...(caseItem.persons || []), person] });
          }
          const { saved, plan } = planFor(roleId);
          const rec = newRecord({ caseItem, person, roleId, plan, settings: ctx.settings() });
          rec.roleId = roleId;
          if (!person) rec.nguoiKhai.hoTen = f.hoTen.value.trim();
          if (saved) rec.planId = saved.id;
          rec.ngay = f.ngay.value || today();
          rec.gioBatDau = '';
          rec.lan = Math.max(1, +f.lan.value || 1);
          rec.status = f.status.value;
          rec.qa = linkPairsToPlan(parsed.pairs, plan, uid);
          rec.coverage = Object.fromEntries([...new Set(rec.qa.filter((x) => x.issueId && x.a).map((x) => x.issueId))].map((k) => [k, 'mot-phan']));
          rec.nguon = { loai: 'tai-len', tep: files.map((x) => x.name), at: Date.now() };
          const out = recordsRepo.save(rec);
          close();
          toast(`Đã lưu biên bản (${rec.qa.length} lượt hỏi – đáp${plan ? `, ${rec.qa.filter((x) => x.planQ).length} khớp kế hoạch` : ''})`);
          onSaved(out);
        });
      },
    },
  );
}
