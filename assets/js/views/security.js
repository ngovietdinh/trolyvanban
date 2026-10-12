// Bảo mật & an toàn thông tin: tình trạng chế độ bảo mật, kiểm tra an toàn (có thể xuất báo cáo), mã hóa dữ liệu
// của tài khoản (mã khôi phục), cấu hình chính sách của máy (quản trị tối cao).
import { $, icon, toast, escapeHtml, downloadBlob, copyText } from '../ui.js';
import { accounts, audit, auditLog } from '../lib/accounts.js';
import { cipher } from '../lib/cipher.js';
import { khoDb } from '../lib/kho-db.js';
import { mauDb } from '../legal/mau-pack.js';
import { securityPolicy, saveSecurityPolicy, selfTestBlock, cspActive, desktopSecurityStatus, allowedHosts, aiEndpointAllowed, checkUrl } from '../lib/security.js';
import { listModels, PROVIDERS, assertAiAllowed } from '../lib/ai.js';
import { APP_VERSION } from '../version.js';
import { isDesktop, desktop } from '../lib/platform.js';

const MARK = { ok: '✓', warn: '!', fail: '✗', info: '•' };

/** Chạy toàn bộ kiểm tra an toàn. Trả về [{ status, title, detail }]; onAdd nhận từng mục ngay khi có kết quả. */
export async function runChecks(ctx, onAdd = null) {
  const p = securityPolicy();
  const me = ctx.user();
  const out = [];
  const add = (status, title, detail) => {
    const c = { status, title, detail };
    out.push(c);
    onAdd?.(c);
  };

  add(p.on ? 'ok' : 'warn', 'Chế độ bảo mật', p.on ? (p.forced ? 'Đang bật — bản cài đặt bảo mật (cưỡng chế, không tắt được)' : `Đang bật — do quản trị tối cao cấu hình${p.by ? ` (${p.by})` : ''}`) : 'Đang tắt: dữ liệu chưa bắt buộc mã hóa, vẫn có thể dùng dịch vụ AI công cộng nếu được cấp quyền');

  // Mã hóa dữ liệu của tài khoản đang dùng.
  const st = cipher.stats(me.id);
  const kho = await khoDb.stats().catch(() => ({ enc: 0, plain: 0 }));
  const mau = await mauDb.sealed().catch(() => null);
  if (me.encrypted && cipher.active()) {
    const plain = st.plain + kho.plain + (mau === false ? 1 : 0);
    add(plain ? 'warn' : 'ok', 'Mã hóa dữ liệu tài khoản (AES-256-GCM)', `${st.enc} mục dữ liệu, ${kho.enc} tài liệu trong kho${mau ? ', gói biểu mẫu' : ''} đã mã hóa${plain ? ` · còn ${plain} mục dạng rõ (sẽ được mã hóa ở lần ghi tới)` : ''}. Khóa dữ liệu chỉ nằm trong bộ nhớ khi đang mở, không xuất được.`);
  } else add(p.on ? 'fail' : 'info', 'Mã hóa dữ liệu tài khoản', p.on ? 'Chưa mã hóa — đăng xuất rồi đăng nhập lại để bật' : 'Chưa bật (bật chế độ bảo mật để mã hóa)');
  if (me.encrypted) add(me.recAt ? 'ok' : 'warn', 'Mã khôi phục dữ liệu', me.recAt ? `Đã cấp ngày ${new Date(me.recAt).toLocaleDateString('vi-VN')} — người dùng tự cất giữ, phần mềm không lưu mã` : 'Chưa có');

  // Chặn kết nối ra ngoài.
  if (p.on) {
    const t = await selfTestBlock();
    add(t.blocked ? 'ok' : 'fail', 'Chặn kết nối ra Internet (trong ứng dụng)', t.blocked ? 'Thử gọi api.anthropic.com: bị chặn trước khi gửi, không có dữ liệu đi ra' : `KHÔNG chặn được: ${t.message || 'yêu cầu đã được gửi'}`);
    add(cspActive() ? 'ok' : 'warn', 'Chính sách bảo mật nội dung (CSP)', cspActive() ? `Chỉ cho phép kết nối tới chính ứng dụng, máy này và: ${allowedHosts(p).join(', ') || '(chưa khai báo máy chủ)'}` : 'Chưa áp dụng — tải lại ứng dụng');
    try {
      assertAiAllowed('anthropic');
      add('fail', 'Dịch vụ AI công cộng', 'Vẫn gọi được — kiểm tra lại cấu hình');
    } catch {
      add('ok', 'Dịch vụ AI công cộng (Claude, ChatGPT, Gemini, Groq…)', 'Bị khóa ở lớp gọi AI: không gửi lời khai, hồ sơ ra ngoài');
    }
  } else add('warn', 'Chặn kết nối ra Internet', 'Chưa bật (chỉ bật trong chế độ bảo mật)');

  const ds = await desktopSecurityStatus();
  if (isDesktop) add(ds.supported ? (ds.on || !p.on ? 'ok' : 'warn') : p.on ? 'warn' : 'info', 'Chặn mạng ở tầng ứng dụng máy tính', ds.supported ? (ds.on ? `Vỏ ứng dụng hủy mọi yêu cầu ra ngoài${ds.blocked ? ` (đã chặn ${ds.blocked} yêu cầu từ khi mở)` : ''}; tắt cập nhật qua Internet, công cụ nhà phát triển, mở liên kết ngoài` : 'Đang tắt') : 'Bộ cài cũ chưa hỗ trợ — cài bộ cài mới (bản bảo mật) để có thêm lớp chặn này');
  else add('info', 'Bản web', p.on ? 'Nên đặt trên máy chủ nội bộ của đơn vị (không đưa ra Internet); với máy trạm nên dùng bản cài đặt bảo mật' : 'Đang chạy bản web');

  // AI nội bộ.
  const ai = ctx.ai('legal') || ctx.ai();
  if (p.on) {
    if (!p.aiBase) add('warn', 'Máy chủ AI nội bộ', 'Quản trị chưa khai báo máy chủ AI nội bộ — chỉ dùng được AI trên chính máy này (localhost)');
    else add(checkUrl(p.aiBase, p).ok ? 'ok' : 'fail', 'Máy chủ AI nội bộ', `${p.aiBase}${p.aiModel ? ` · mô hình mặc định ${p.aiModel}` : ''}`);
    if (ai) {
      try {
        const models = await Promise.race([listModels('local', ai.apiKey || 'local'), new Promise((_, rej) => setTimeout(() => rej(new Error('quá 6 giây không phản hồi')), 6000))]);
        add('ok', 'Kết nối AI nội bộ', `${PROVIDERS.local.base} phản hồi — ${models.length} mô hình; đang dùng ${ai.model}`);
      } catch (err) {
        add('warn', 'Kết nối AI nội bộ', `Chưa kết nối được ${PROVIDERS.local.base}: ${err.message}. Các chức năng phân tích trên máy (không cần AI) vẫn dùng được.`);
      }
    } else add('info', 'Kết nối AI nội bộ', 'Tài khoản chưa cấu hình mô hình (Cài đặt → AI nội bộ). Chức năng phân tích trên máy vẫn dùng được.');
  } else add(ai && !ai.local ? 'warn' : 'info', 'Trí tuệ nhân tạo', ai ? `${ai.label} (${ai.local ? 'trên máy / nội bộ' : 'dịch vụ trực tuyến — dữ liệu gửi ra Internet'})` : 'Chưa kết nối');

  add(p.on ? 'ok' : 'info', 'Tự khóa khi không thao tác', p.on ? `Sau ${p.idleMin} phút: xóa khóa khỏi bộ nhớ, phải nhập lại mật khẩu` : 'Chỉ áp dụng trong chế độ bảo mật');
  add(p.on ? 'ok' : 'info', 'Mật khẩu và đăng nhập', p.on ? 'Mật khẩu ≥ 10 ký tự, có chữ và số; sai 5 lần → tạm khóa 5 phút (tăng gấp đôi mỗi lần); băm PBKDF2-SHA256 310.000 vòng' : 'Mật khẩu ≥ 8 ký tự; băm PBKDF2-SHA256 310.000 vòng');
  add(p.on ? 'ok' : 'info', 'Cập nhật phần mềm', p.on ? (isDesktop ? 'Không tự tải bản cập nhật từ Internet — cài bộ cài do đơn vị phát hành' : 'Chỉ nhận bản cập nhật từ chính máy chủ đặt ứng dụng') : 'Tự kiểm tra bản mới');
  add('ok', 'Nhật ký hoạt động', `${auditLog().length} mục gần nhất (đăng nhập, khóa / mở khóa, phân quyền, chặn kết nối, thay đổi cấu hình)`);

  if (me.role === 'superadmin') {
    const list = accounts.list();
    const notEnc = list.filter((u) => !u.encrypted);
    const rec = list.filter((u) => u.needsRecovery);
    add(!p.on || !notEnc.length ? 'ok' : 'warn', 'Tài khoản trên máy', `${list.length} tài khoản · ${list.length - notEnc.length} đã mã hóa${notEnc.length ? ` · chưa mã hóa: ${notEnc.map((u) => u.email).join(', ')} (tự mã hóa ở lần đăng nhập tới)` : ''}${rec.length ? ` · chờ mã khôi phục: ${rec.map((u) => u.email).join(', ')}` : ''}`);
  }
  return out;
}

export function reportText(ctx, checks) {
  const p = securityPolicy();
  const head = [
    'BÁO CÁO KIỂM TRA AN TOÀN THÔNG TIN — TRỢ LÝ VĂN BẢN AI',
    `Thời điểm: ${new Date().toLocaleString('vi-VN')}`,
    `Phiên bản: v${APP_VERSION} · ${isDesktop ? `bản cài đặt ${desktop?.os || ''}${p.forced ? ' (bản bảo mật)' : ''}` : 'bản web'}`,
    `Người kiểm tra: ${ctx.user().name} <${ctx.user().email}>`,
    `Chế độ bảo mật: ${p.on ? 'BẬT' : 'TẮT'}`,
    '',
  ];
  const ok = checks.filter((c) => c.status === 'ok').length;
  return [...head, ...checks.map((c) => `[${MARK[c.status]}] ${c.title}: ${c.detail}`), '', `Kết quả: ${ok}/${checks.length} mục đạt.`].join('\n');
}

function passwordPrompt(ctx, title, text) {
  return new Promise((resolve) => {
    ctx.modal(
      `<h2 class="modal-title">${escapeHtml(title)}</h2><p class="hint">${escapeHtml(text)}</p>
       <form class="auth-form" data-f novalidate><div class="field"><label for="sp-pw">Mật khẩu hiện tại</label><input class="input" type="password" id="sp-pw" name="pw" autocomplete="current-password" /></div>
       <div class="auth-err" role="alert" hidden></div>
       <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit">Tiếp tục</button></div></form>`,
      {
        label: title,
        onMount(box, close) {
          box.querySelector('[data-close]')?.addEventListener('click', () => resolve(null));
          box.querySelector('[data-f]').addEventListener('submit', (e) => {
            e.preventDefault();
            const pw = box.querySelector('[name="pw"]').value;
            close();
            resolve(pw);
          });
        },
      },
    );
  });
}

function showCode(ctx, code) {
  ctx.modal(
    `<h2 class="modal-title">${icon('key', 'ic-sm')} Mã khôi phục mới</h2>
     <p class="hint">Mã cũ đã hết hiệu lực. Ghi lại và cất giữ theo quy định bảo mật của đơn vị — mã chỉ hiện một lần.</p>
     <div class="rec-code">${escapeHtml(code)}</div>
     <div class="modal-actions"><button class="btn btn-primary" type="button" data-close>Tôi đã ghi lại</button></div>`,
    { label: 'Mã khôi phục mới', className: 'modal-rec' },
  );
}

export function render(ctx) {
  const me = ctx.user();
  const isSuper = me.role === 'superadmin';
  let checks = null;

  function draw() {
    const p = securityPolicy();
    const user = ctx.user();
    ctx.view.innerHTML = `
    <div class="page page-narrow sec-page">
      <div class="page-head"><div><h1 class="page-title">Bảo mật &amp; <em>an toàn thông tin</em></h1><p class="page-sub">Dữ liệu chỉ lưu trên máy, mã hóa theo từng tài khoản; chế độ bảo mật chỉ dùng AI nội bộ và chặn mọi kết nối ra Internet.</p></div></div>
      <section class="sec-hero ${p.on ? 'on' : ''}">
        <span class="sec-hero-ic">${icon(p.on ? 'shield' : 'alert')}</span>
        <div><h2>Chế độ bảo mật: ${p.on ? 'ĐANG BẬT' : 'ĐANG TẮT'}${p.forced ? ' <span class="badge badge-accent">Bản cài bảo mật</span>' : ''}</h2>
        <p>${p.on ? `Mã hóa dữ liệu AES-256-GCM · chỉ AI nội bộ${p.aiBase ? ` (${escapeHtml(p.aiBase)})` : ''} · chặn kết nối ra Internet · tự khóa sau ${p.idleMin} phút` : 'Bật chế độ bảo mật trước khi xử lý dữ liệu nghiệp vụ thật. Chỉ quản trị tối cao bật / tắt được.'}</p></div>
        ${p.on || user.encrypted ? `<button class="btn btn-sm" type="button" data-lock-now>${icon('lock', 'ic-sm')}Khóa ngay</button>` : ''}
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('check-circle', 'ic-sm')}Kiểm tra an toàn</h2>
          <div class="inline"><button class="btn btn-sm" type="button" data-run>${icon('refresh', 'ic-sm')}Kiểm tra lại</button><button class="btn btn-sm" type="button" data-copy>${icon('copy', 'ic-sm')}Sao chép</button><button class="btn btn-sm" type="button" data-export>${icon('download', 'ic-sm')}Xuất báo cáo</button></div></div>
        <ul class="sec-checks" data-checks><li class="muted">Đang kiểm tra…</li></ul>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('key', 'ic-sm')}Mã hóa dữ liệu của tôi</h2><span class="badge ${user.encrypted ? 'badge-success' : 'badge-warning'}">${user.encrypted ? 'Đã mã hóa' : 'Chưa mã hóa'}</span></div>
        <div class="panel-body sec-body">
          <p>${user.encrypted ? `Dữ liệu của tài khoản (văn bản, hồ sơ, biên bản, lời khai, sơ đồ, kho tài liệu, gói biểu mẫu, lịch sử AI) được mã hóa bằng khóa riêng 256 bit. Khóa được bảo vệ bằng mật khẩu và mã khôi phục${user.recAt ? ` (cấp ngày ${new Date(user.recAt).toLocaleDateString('vi-VN')})` : ''}.` : 'Dữ liệu sẽ được mã hóa khi chế độ bảo mật bật và bạn đăng nhập lại.'}</p>
          ${user.encrypted ? `<div class="inline"><button class="btn btn-sm" type="button" data-new-rec>${icon('key', 'ic-sm')}Tạo mã khôi phục mới</button></div>` : ''}
        </div>
      </section>

      ${isSuper ? policyHtml(p) : ''}
    </div>`;
    bind();
    paintChecks();
  }

  function policyHtml(p) {
    return `<section class="panel" data-policy-panel>
      <div class="panel-head"><h2>${icon('settings', 'ic-sm')}Chính sách bảo mật của máy</h2><span class="badge">Quản trị tối cao</span></div>
      <form class="panel-body sec-form" data-policy>
        <label class="check"><input type="checkbox" name="on" ${p.on ? 'checked' : ''} ${p.forced ? 'disabled' : ''} /> <strong>Bật chế độ bảo mật</strong> — áp dụng cho mọi tài khoản trên máy này</label>
        <div class="grid-2">
          <div class="field"><label for="sp-ai">Máy chủ AI nội bộ</label><input class="input" id="sp-ai" name="aiBase" value="${escapeHtml(p.aiBase)}" placeholder="http://10.0.0.5:11434/v1" autocomplete="off" spellcheck="false" /><span class="hint">Ollama, vLLM, LM Studio, BionicGPT… trong mạng nội bộ (chuẩn OpenAI /v1). Để trống: chỉ dùng AI trên chính máy (localhost).</span></div>
          <div class="field"><label for="sp-model">Mô hình mặc định</label><input class="input" id="sp-model" name="aiModel" value="${escapeHtml(p.aiModel)}" placeholder="vd: qwen2.5:14b" autocomplete="off" spellcheck="false" /></div>
        </div>
        <div class="field"><label for="sp-hosts">Máy chủ nội bộ khác được phép kết nối</label><textarea class="textarea" id="sp-hosts" name="allowHosts" rows="3" placeholder="Mỗi dòng một máy chủ: may-chu-ai.noibo hoặc *.noibo.ca">${escapeHtml(p.allowHosts.join('\n'))}</textarea></div>
        <label class="check"><input type="checkbox" name="strictHosts" ${p.strictHosts ? 'checked' : ''} /> Chỉ cho phép máy chủ đã khai báo (khuyến nghị). Bỏ chọn: cho phép mọi địa chỉ trong dải mạng nội bộ (10.x, 172.16–31.x, 192.168.x).</label>
        <div class="field sec-idle"><label for="sp-idle">Tự khóa sau (phút không thao tác)</label><input class="input" id="sp-idle" name="idleMin" type="number" min="1" max="120" value="${p.idleMin}" /></div>
        <div class="note">${icon('info', 'ic-sm')}<span>Khi bật: ứng dụng tải lại; mỗi tài khoản đăng nhập lại sẽ được mã hóa dữ liệu và nhận <strong>mã khôi phục</strong>. Dữ liệu đã mã hóa vẫn được mã hóa nếu sau này tắt chế độ. Triển khai chính thức nên dùng <strong>bản cài đặt bảo mật</strong> (chế độ luôn bật, không tắt được).</span></div>
        <div><button class="btn btn-primary btn-sm" type="submit">${icon('save', 'ic-sm')}Lưu chính sách</button></div>
      </form>
    </section>`;
  }

  async function paintChecks() {
    const host = $('[data-checks]', ctx.view);
    if (!host) return;
    host.innerHTML = '<li class="muted" data-pending>Đang kiểm tra…</li>';
    checks = null;
    const item = (c) => `<li class="sec-check s-${c.status}"><span class="sec-mark" aria-hidden="true">${MARK[c.status]}</span><div><strong>${escapeHtml(c.title)}</strong><small>${escapeHtml(c.detail)}</small></div></li>`;
    const result = await runChecks(ctx, (c) => host.isConnected && $('[data-pending]', host)?.insertAdjacentHTML('beforebegin', item(c)));
    if (!host.isConnected) return;
    $('[data-pending]', host)?.remove();
    checks = result;
  }

  function bind() {
    const v = ctx.view;
    $('[data-run]', v).addEventListener('click', paintChecks);
    $('[data-copy]', v).addEventListener('click', async () => {
      if (!checks) return;
      await copyText(reportText(ctx, checks));
      toast('Đã sao chép kết quả kiểm tra');
    });
    $('[data-export]', v).addEventListener('click', () => {
      if (!checks) return;
      downloadBlob(reportText(ctx, checks), `bao-cao-kiem-tra-an-toan-${new Date().toISOString().slice(0, 10)}.txt`, 'text/plain;charset=utf-8');
      audit('Xuất báo cáo kiểm tra an toàn');
    });
    $('[data-lock-now]', v)?.addEventListener('click', () => ctx.lock('Khóa phiên làm việc'));
    $('[data-new-rec]', v)?.addEventListener('click', async () => {
      const pw = await passwordPrompt(ctx, 'Tạo mã khôi phục mới', 'Mã khôi phục cũ sẽ hết hiệu lực.');
      if (!pw) return;
      try {
        showCode(ctx, await accounts.regenerateRecovery(pw));
        draw();
      } catch (err) {
        toast(err.message, { type: 'error' });
      }
    });
    $('[data-policy]', v)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const before = securityPolicy();
      const patch = {
        on: before.forced ? true : f.on.checked,
        aiBase: f.aiBase.value.trim(),
        aiModel: f.aiModel.value.trim(),
        allowHosts: f.allowHosts.value.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean),
        strictHosts: f.strictHosts.checked,
        idleMin: +f.idleMin.value || 10,
      };
      if (patch.on && patch.aiBase && !aiEndpointAllowed(patch.aiBase, { ...before, ...patch, on: true })) return toast('Máy chủ AI nội bộ không hợp lệ', { type: 'error' });
      if (patch.on !== before.on) {
        const msg = patch.on
          ? 'Bật chế độ bảo mật: chặn mọi kết nối ra Internet, chỉ dùng AI nội bộ, mã hóa dữ liệu từng tài khoản (mỗi người nhận mã khôi phục khi đăng nhập lại), tự khóa khi không thao tác. Ứng dụng sẽ tải lại và yêu cầu nhập lại mật khẩu.'
          : 'Tắt chế độ bảo mật: cho phép lại dịch vụ AI công cộng (nếu được cấp quyền) và kết nối Internet. Dữ liệu đã mã hóa vẫn giữ mã hóa. Ứng dụng sẽ tải lại.';
        if (!(await ctx.confirm(msg, { title: patch.on ? 'Bật chế độ bảo mật?' : 'Tắt chế độ bảo mật?', okText: patch.on ? 'Bật và tải lại' : 'Tắt và tải lại', danger: !patch.on }))) return;
      }
      try {
        saveSecurityPolicy(patch, me.email);
      } catch (err) {
        return toast(err.message, { type: 'error' });
      }
      audit(patch.on !== before.on ? (patch.on ? 'Bật chế độ bảo mật' : 'Tắt chế độ bảo mật') : 'Cập nhật chính sách bảo mật', `AI nội bộ: ${patch.aiBase || 'localhost'}; máy chủ khác: ${patch.allowHosts.join(', ') || 'không'}; tự khóa ${patch.idleMin} phút`);
      // Chính sách mạng (CSP) chỉ áp dụng chắc chắn sau khi tải lại.
      if (patch.on !== before.on || patch.aiBase !== before.aiBase || patch.allowHosts.join() !== before.allowHosts.join() || patch.strictHosts !== before.strictHosts) {
        await ctx.lock?.('Áp dụng chính sách bảo mật');
        location.reload();
        return;
      }
      toast('Đã lưu chính sách bảo mật');
      draw();
    });
  }

  draw();
}

