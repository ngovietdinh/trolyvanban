// Quản trị tài khoản: tạo, phân vai trò, cấp quyền chi tiết, khóa, đặt lại mật khẩu, nhật ký.
import { $, $$, icon, toast, escapeHtml } from '../ui.js';
import { accounts, PERMS, ROLES, effectivePerms, systemConfig, setSystemConfig, auditLog, audit, SUPER_EMAIL } from '../lib/accounts.js';
import { relativeTime } from '../lib/vn-date.js';

function permEditor(user, roleId, canGrantUsers) {
  const base = new Set(ROLES[roleId].perms);
  const eff = user ? effectivePerms({ ...user, role: roleId }) : base;
  return `<div class="perm-list">${PERMS.map((p) => {
    const locked = roleId === 'superadmin' || (p.id === 'users' && !canGrantUsers);
    const isDefault = base.has(p.id);
    return `<label class="perm ${p.id === 'legal.ai' ? 'perm-warn' : ''}">
      <input type="checkbox" name="perm" value="${p.id}" ${eff.has(p.id) ? 'checked' : ''} ${locked ? 'disabled' : ''}/>
      <span><strong>${escapeHtml(p.label)}</strong><small>${escapeHtml(p.desc)}</small></span>
      <em class="perm-def">${isDefault ? 'Mặc định của vai trò' : ''}</em>
    </label>`;
  }).join('')}</div>`;
}

export function render(ctx) {
  const me = ctx.user();
  const isSuper = me.role === 'superadmin';
  let q = '';

  function draw() {
    const cfg = systemConfig();
    const list = accounts.list().filter((u) => !q || (u.name + ' ' + u.email).toLowerCase().includes(q.toLowerCase()));
    const all = accounts.list();
    const counts = Object.fromEntries(Object.keys(ROLES).map((r) => [r, all.filter((u) => u.role === r).length]));
    ctx.view.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1 class="page-title">Quản trị <em>tài khoản</em></h1><p class="page-sub">Phân vai trò và cấp quyền cho từng tài khoản trên máy này. Quản trị viên không xem được API key hay dữ liệu của tài khoản khác.</p></div>
        <button class="btn btn-primary" type="button" data-new-user>${icon('plus', 'ic-sm')}Tạo tài khoản</button>
      </div>
      <div class="admin-stats">${Object.entries(ROLES).map(([r, v]) => `<div class="metric"><strong>${counts[r]}</strong><span>${v.label}</span></div>`).join('')}</div>
      <section class="panel">
        <div class="panel-head">
          <h2>${icon('user', 'ic-sm')}Danh sách tài khoản</h2>
          <div class="search-box" style="max-width:280px">${icon('search', 'ic-sm')}<input class="input" type="search" placeholder="Tìm tên, email…" value="${escapeHtml(q)}" aria-label="Tìm tài khoản" data-q /></div>
        </div>
        <div class="table-wrap"><table class="users-table">
          <thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Quyền</th><th>Đăng nhập gần nhất</th><th>Trạng thái</th><th><span class="sr-only">Thao tác</span></th></tr></thead>
          <tbody>${list
            .map((u) => {
              const perms = PERMS.filter((p) => u.permSet.has(p.id));
              return `<tr data-uid="${u.id}">
                <td><div class="u-cell"><span class="avatar">${escapeHtml((u.name.split(/\s+/).pop() || '?')[0])}</span><div><strong>${escapeHtml(u.name)}${u.id === me.id ? ' <span class="badge">Bạn</span>' : ''}</strong><small>${escapeHtml(u.email)}</small></div></div></td>
                <td><span class="badge ${u.role === 'superadmin' ? 'badge-accent' : ''}">${escapeHtml(u.roleLabel)}</span></td>
                <td><div class="perm-chips">${perms.map((p) => `<span class="pchip ${p.id === 'legal.ai' ? 'warn' : ''}" title="${escapeHtml(p.desc)}">${escapeHtml(p.label)}</span>`).join('')}</div></td>
                <td>${u.lastLogin ? relativeTime(u.lastLogin) : '<span class="muted">Chưa đăng nhập</span>'}</td>
                <td>${u.locked ? '<span class="badge badge-warning">Đã khóa</span>' : '<span class="badge badge-success">Hoạt động</span>'}</td>
                <td class="u-actions">${u.role === 'superadmin' && !isSuper ? '' : `<button class="btn btn-sm" type="button" data-edit>${icon('wand', 'ic-sm')}Phân quyền</button>`}</td>
              </tr>`;
            })
            .join('')}</tbody>
        </table></div>
      </section>

      <div class="admin-grid">
        <section class="panel">
          <div class="panel-head"><h2>${icon('settings', 'ic-sm')}Cấu hình hệ thống</h2></div>
          <div class="panel-body" style="display:grid;gap:12px">
            <label class="check"><input type="checkbox" data-allow-signup ${cfg.allowSignup ? 'checked' : ''} ${isSuper ? '' : 'disabled'}/>Cho phép tự đăng ký tài khoản mới (vai trò Người dùng)</label>
            <p class="hint">Tài khoản quản trị tối cao: <strong>${SUPER_EMAIL}</strong> — toàn quyền, không thể bị hạ quyền, khóa hay xóa.</p>
            <p class="hint">Phân hệ Tố tụng chỉ hiện với tài khoản có quyền “Phân hệ Tố tụng hình sự”. Quyền “AI trực tuyến trong Tố tụng” mặc định tắt với mọi vai trò.</p>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>${icon('clock', 'ic-sm')}Nhật ký hoạt động</h2></div>
          <ul class="audit-list">${auditLog()
            .slice(0, 40)
            .map((a) => `<li><span>${escapeHtml(a.action)}</span><small>${escapeHtml(a.detail)}</small><em>${escapeHtml(a.by)} · ${relativeTime(a.at)}</em></li>`)
            .join('') || '<li class="muted">Chưa có hoạt động.</li>'}</ul>
        </section>
      </div>
    </div>`;

    const v = ctx.view;
    $('[data-q]', v).addEventListener('input', (e) => {
      q = e.target.value;
      const pos = e.target.selectionStart;
      draw();
      const inp = $('[data-q]', ctx.view);
      inp.focus();
      inp.setSelectionRange(pos, pos);
    });
    $('[data-new-user]', v).addEventListener('click', createDialog);
    $$('[data-edit]', v).forEach((b) => b.addEventListener('click', () => editDialog(b.closest('[data-uid]').dataset.uid)));
    $('[data-allow-signup]', v).addEventListener('change', (e) => {
      setSystemConfig({ allowSignup: e.target.checked });
      audit('Cấu hình hệ thống', `Tự đăng ký: ${e.target.checked ? 'bật' : 'tắt'}`);
      toast(e.target.checked ? 'Đã cho phép tự đăng ký' : 'Đã tắt tự đăng ký');
    });
  }

  const roleOptions = (current) =>
    Object.entries(ROLES)
      .filter(([r]) => r !== 'superadmin' && (isSuper || r !== 'admin'))
      .map(([r, v]) => `<option value="${r}" ${r === current ? 'selected' : ''}>${v.label}</option>`)
      .join('');

  const readPerms = (box) => Object.fromEntries($$('input[name="perm"]', box).filter((i) => !i.disabled).map((i) => [i.value, i.checked]));

  function bindRoleSwitch(box, user) {
    const sel = box.querySelector('[name="role"]');
    sel?.addEventListener('change', () => {
      box.querySelector('[data-perms]').innerHTML = permEditor(null, sel.value, isSuper);
    });
  }

  function createDialog() {
    ctx.modal(
      `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
      <h2 class="modal-title">Tạo tài khoản</h2>
      <form class="iv-info" data-f novalidate>
        <div class="grid-2">
          <div class="field"><label for="nu-name">Họ và tên</label><input class="input" id="nu-name" name="name" /></div>
          <div class="field"><label for="nu-email">Email</label><input class="input" id="nu-email" name="email" type="email" /></div>
          <div class="field"><label for="nu-pw">Mật khẩu ban đầu</label><input class="input" id="nu-pw" name="password" type="text" autocomplete="off" /><span class="hint">Tối thiểu 8 ký tự; người dùng nên đổi sau khi đăng nhập.</span></div>
          <div class="field"><label for="nu-role">Vai trò</label><select class="select" id="nu-role" name="role">${roleOptions('user')}</select></div>
        </div>
        <fieldset class="fieldset" style="margin-top:14px"><legend>Quyền</legend><div data-perms>${permEditor(null, 'user', isSuper)}</div></fieldset>
        <div class="auth-err" role="alert" hidden></div>
        <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit">${icon('plus', 'ic-sm')}Tạo tài khoản</button></div>
      </form>`,
      {
        className: 'modal-wide',
        label: 'Tạo tài khoản',
        onMount(box, close) {
          bindRoleSwitch(box);
          box.querySelector('[data-f]').addEventListener('submit', async (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.target));
            const err = box.querySelector('.auth-err');
            try {
              await accounts.createUser({ name: f.name, email: f.email, password: f.password, role: f.role, perms: readPerms(box) });
              close();
              toast('Đã tạo tài khoản');
              draw();
            } catch (ex) {
              err.textContent = ex.message;
              err.hidden = false;
            }
          });
        },
      },
    );
  }

  function editDialog(id) {
    const u = accounts.list().find((x) => x.id === id);
    if (!u) return;
    const sup = u.role === 'superadmin';
    ctx.modal(
      `<button class="btn btn-ghost btn-sm btn-icon modal-close" type="button" aria-label="Đóng" data-close>${icon('x')}</button>
      <h2 class="modal-title">Phân quyền: ${escapeHtml(u.name)}</h2>
      <p class="hint" style="margin-bottom:14px">${escapeHtml(u.email)}${u.hasVault ? ' · Đã lưu API key (được mã hóa, quản trị không xem được)' : ''}</p>
      <form class="iv-info" data-f novalidate>
        <div class="grid-2">
          <div class="field"><label for="eu-name">Họ và tên</label><input class="input" id="eu-name" name="name" value="${escapeHtml(u.name)}" /></div>
          <div class="field"><label for="eu-role">Vai trò</label>${sup ? `<input class="input" id="eu-role" value="${ROLES.superadmin.label}" disabled />` : `<select class="select" id="eu-role" name="role">${roleOptions(u.role)}</select>`}</div>
        </div>
        <fieldset class="fieldset" style="margin-top:14px"><legend>Quyền</legend><div data-perms>${permEditor(u, u.role, isSuper)}</div></fieldset>
        ${sup ? '' : `<label class="check"><input type="checkbox" name="locked" ${u.locked ? 'checked' : ''} ${u.id === me.id ? 'disabled' : ''}/>Khóa tài khoản (không đăng nhập được)</label>`}
        <div class="auth-err" role="alert" hidden></div>
        <div class="modal-actions spread">
          <div class="inline">
            <button class="btn btn-sm btn-ghost" type="button" data-reset>${icon('key', 'ic-sm')}Đặt lại mật khẩu</button>
            ${sup || u.id === me.id ? '' : `<button class="btn btn-sm btn-ghost" type="button" data-del>${icon('trash', 'ic-sm')}Xóa tài khoản</button>`}
          </div>
          <div class="inline"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit">${icon('save', 'ic-sm')}Lưu</button></div>
        </div>
      </form>`,
      {
        className: 'modal-wide',
        label: 'Phân quyền tài khoản',
        onMount(box, close) {
          bindRoleSwitch(box, u);
          const err = box.querySelector('.auth-err');
          const show = (ex) => {
            err.textContent = ex.message;
            err.hidden = false;
          };
          box.querySelector('[data-f]').addEventListener('submit', (e) => {
            e.preventDefault();
            const f = new FormData(e.target);
            try {
              accounts.updateUser(u.id, { name: f.get('name'), role: sup ? undefined : f.get('role'), perms: sup ? undefined : readPerms(box), locked: sup ? undefined : f.get('locked') === 'on' });
              close();
              toast('Đã cập nhật phân quyền');
              ctx.refreshChrome();
              draw();
            } catch (ex) {
              show(ex);
            }
          });
          box.querySelector('[data-reset]').addEventListener('click', () => {
            close();
            resetDialog(u);
          });
          box.querySelector('[data-del]')?.addEventListener('click', async () => {
            close();
            if (!(await ctx.confirm(`Xóa vĩnh viễn tài khoản ${u.email} cùng toàn bộ dữ liệu của tài khoản này?`, { title: 'Xóa tài khoản', okText: 'Xóa vĩnh viễn', danger: true }))) return;
            try {
              accounts.deleteUser(u.id);
              toast('Đã xóa tài khoản');
            } catch (ex) {
              toast(ex.message, { type: 'error' });
            }
            draw();
          });
        },
      },
    );
  }

  function resetDialog(u) {
    ctx.modal(
      `<h2 class="modal-title">Đặt lại mật khẩu</h2>
       <p class="hint" style="margin-bottom:12px">${escapeHtml(u.email)} — API key đã lưu của tài khoản này sẽ bị xóa vì được mã hóa bằng mật khẩu cũ.</p>
       <form class="auth-form" data-f novalidate>
         <div class="field"><label for="rp-pw">Mật khẩu mới</label><input class="input" id="rp-pw" name="pw" type="text" autocomplete="off" /><span class="hint">Tối thiểu 8 ký tự</span></div>
         <div class="auth-err" role="alert" hidden></div>
         <div class="modal-actions"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-primary" type="submit">${icon('key', 'ic-sm')}Đặt lại</button></div>
       </form>`,
      {
        label: 'Đặt lại mật khẩu',
        onMount(box, close) {
          box.querySelector('[data-f]').addEventListener('submit', async (e) => {
            e.preventDefault();
            const err = box.querySelector('.auth-err');
            try {
              await accounts.resetPassword(u.id, new FormData(e.target).get('pw'));
              close();
              toast('Đã đặt lại mật khẩu');
              draw();
            } catch (ex) {
              err.textContent = ex.message;
              err.hidden = false;
            }
          });
        },
      },
    );
  }

  draw();
}
