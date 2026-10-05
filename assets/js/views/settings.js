// Cài đặt: AI (API key mã hóa theo tài khoản, đa nhà cung cấp), thông tin đơn vị, giao diện, cập nhật, dữ liệu.
import { $, $$, icon, toast, escapeHtml, setTheme, downloadBlob } from '../ui.js';
import { store, docsRepo, WIPE_KEYS } from '../lib/store.js';
import { PROVIDERS, MODELS, testApiKey } from '../lib/ai.js';
import { audit } from '../lib/accounts.js';
import { APP_VERSION } from '../version.js';
import { checkForUpdate, applyUpdate } from '../update.js';

const BACKUP_KEYS = { docs: 'docs', cases: 'cases', records: 'records', plans: 'plans' };

const ORG_FIELDS = [
  ['coQuan', 'Cơ quan ban hành', 'ỦY BAN NHÂN DÂN PHƯỜNG ĐIỆN BIÊN'],
  ['coQuanChuQuan', 'Cơ quan chủ quản', 'UBND QUẬN BA ĐÌNH'],
  ['vietTat', 'Viết tắt', 'UBND'],
  ['diaDanh', 'Địa danh', 'Hà Nội'],
  ['tapThe', 'Tập thể lãnh đạo', 'ỦY BAN NHÂN DÂN'],
  ['chucVu', 'Chức vụ người ký', 'CHỦ TỊCH'],
  ['nguoiKy', 'Họ tên người ký', 'Nguyễn Văn An'],
];

const LEGAL_FIELDS = [
  ['coQuanCapTren', 'Cơ quan cấp trên', 'CÔNG AN TỈNH NINH BÌNH'],
  ['coQuan', 'Cơ quan điều tra', 'CƠ QUAN CẢNH SÁT ĐIỀU TRA'],
  ['dieuTraVien', 'Họ tên điều tra viên', 'Trần Minh Đức'],
  ['chucDanh', 'Chức danh', 'Điều tra viên'],
  ['diaDiem', 'Địa điểm làm việc thường xuyên', 'Trụ sở Cơ quan Cảnh sát điều tra'],
];

export function render(ctx) {
  const s = ctx.settings();
  const providers = { ...ctx.aiProviders() };
  let activeTab = s.aiProvider && PROVIDERS[s.aiProvider] ? s.aiProvider : 'anthropic';
  const org = s.org || {};
  const legalOrg = s.legalOrg || {};
  const theme = document.documentElement.dataset.theme || 'system';

  ctx.view.innerHTML = `
  <div class="page page-narrow">
    <div class="page-head"><div><h1 class="page-title">Cài <em>đặt</em></h1><p class="page-sub">Cá nhân hóa trải nghiệm và kết nối trí tuệ nhân tạo.</p></div></div>
    <div class="settings-grid">
      <section class="panel" data-ai-panel>
        <div class="panel-head"><h2>${icon('sparkles', 'ic-sm')}Trí tuệ nhân tạo</h2><span class="badge ${ctx.hasAI() ? 'badge-success' : 'badge-warning'}" data-ai-state>${ctx.hasAI() ? `Đang dùng ${escapeHtml(ctx.ai().label)}` : 'Chưa kết nối'}</span></div>
        ${
          ctx.can('ai') || ctx.can('legal.ai')
            ? `<div class="setting-row">
          <div><h3>API key của tôi</h3><p>Mỗi tài khoản tự nhập API key. Khóa được mã hóa (AES-GCM) bằng mật khẩu của bạn — quản trị viên và tài khoản khác không xem được.</p></div>
          <div class="setting-ctl">
            <div class="seg prov-tabs" role="tablist" aria-label="Nhà cung cấp AI">${Object.entries(PROVIDERS).map(([id, p]) => `<button type="button" role="tab" data-prov="${id}" aria-pressed="${id === activeTab}">${p.label}${providers[id]?.key ? ' <span class="dot" style="color:var(--success)"></span>' : ''}</button>`).join('')}</div>
            <div data-prov-form></div>
            <div class="field"><label for="ai-default">Nhà cung cấp mặc định</label><select class="select" id="ai-default" data-default-prov>${Object.entries(PROVIDERS).map(([id, p]) => `<option value="${id}" ${id === (s.aiProvider || 'anthropic') ? 'selected' : ''}>${p.label} (${p.vendor})</option>`).join('')}</select></div>
            <div class="note">${icon('info', 'ic-sm')}<span>Yêu cầu AI được gửi trực tiếp từ trình duyệt tới nhà cung cấp qua HTTPS. ${ctx.can('legal') ? (ctx.can('legal.ai') ? 'Bạn được phép dùng AI trực tuyến trong phân hệ Tố tụng.' : '<strong>Phân hệ Tố tụng luôn chạy ngoại tuyến</strong> — không gửi lời khai, hồ sơ ra ngoài (chưa được cấp quyền AI trực tuyến).') : ''}</span></div>
          </div>
        </div>`
            : `<div class="panel-body"><p class="note">${icon('lock', 'ic-sm')}<span>Tài khoản chưa được cấp quyền dùng AI trực tuyến. Các tính năng vẫn hoạt động ở chế độ cơ bản, chạy hoàn toàn trên máy.</span></p></div>`
        }
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('building', 'ic-sm')}Thông tin đơn vị mặc định</h2></div>
        <div class="setting-row">
          <div><h3>Tự động điền</h3><p>Các thông tin này được điền sẵn khi bạn tạo văn bản mới.</p></div>
          <form class="setting-ctl" data-org>
            <div class="grid-2">
              ${ORG_FIELDS.map(([k, l, p]) => `<div class="field ${k === 'coQuan' ? 'span-2' : ''}"><label for="o-${k}">${l}</label><input class="input" id="o-${k}" name="${k}" value="${escapeHtml(org[k] || '')}" placeholder="${escapeHtml(p)}" autocomplete="off" /></div>`).join('')}
            </div>
            <div><button class="btn btn-primary btn-sm" type="submit">${icon('save', 'ic-sm')}Lưu thông tin đơn vị</button></div>
          </form>
        </div>
      </section>

      ${ctx.can('legal') ? '' : '<!--'}<section class="panel">
        <div class="panel-head"><h2>${icon('shield', 'ic-sm')}Cơ quan điều tra (biên bản tố tụng)</h2></div>
        <div class="setting-row">
          <div><h3>Thông tin mặc định</h3><p>Điền sẵn vào biên bản ghi lời khai, kế hoạch hỏi và hồ sơ vụ án mới.</p></div>
          <form class="setting-ctl" data-legal-org>
            <div class="grid-2">
              ${LEGAL_FIELDS.map(([k, l, p]) => `<div class="field"><label for="lo-${k}">${l}</label><input class="input" id="lo-${k}" name="${k}" value="${escapeHtml(legalOrg[k] || '')}" placeholder="${escapeHtml(p)}" autocomplete="off" /></div>`).join('')}
            </div>
            <div><button class="btn btn-primary btn-sm" type="submit">${icon('save', 'ic-sm')}Lưu thông tin cơ quan</button></div>
          </form>
        </div>
      </section>${ctx.can('legal') ? '' : '-->'}

      <section class="panel">
        <div class="panel-head"><h2>${icon('sun', 'ic-sm')}Giao diện</h2></div>
        <div class="setting-row">
          <div><h3>Chế độ hiển thị</h3><p>Sáng, tối hoặc theo hệ điều hành.</p></div>
          <div class="setting-ctl"><div class="seg" role="group" aria-label="Chế độ hiển thị">
            <button type="button" data-theme="light" aria-pressed="${theme === 'light'}">${icon('sun', 'ic-sm')}Sáng</button>
            <button type="button" data-theme="dark" aria-pressed="${theme === 'dark'}">${icon('moon', 'ic-sm')}Tối</button>
            <button type="button" data-theme="system" aria-pressed="${theme === 'system'}">${icon('settings', 'ic-sm')}Hệ thống</button>
          </div></div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('refresh', 'ic-sm')}Phiên bản &amp; cập nhật</h2><span class="badge" data-version>v${APP_VERSION}</span></div>
        <div class="setting-row">
          <div><h3>Cập nhật phần mềm</h3><p>Ứng dụng chạy cục bộ và lưu bộ nhớ đệm để dùng ngoại tuyến. Cập nhật chỉ thay mã nguồn — tài khoản, API key và dữ liệu trên máy được giữ nguyên.</p></div>
          <div class="setting-ctl">
            <div class="inline"><button class="btn btn-sm" type="button" data-check-update>${icon('refresh', 'ic-sm')}Kiểm tra cập nhật</button></div>
            <div data-update-out></div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('folder', 'ic-sm')}Dữ liệu</h2></div>
        <div class="setting-row">
          <div><h3>Sao lưu &amp; khôi phục</h3><p>Xuất dữ liệu của tài khoản (văn bản${ctx.can('legal') ? ', hồ sơ vụ án, biên bản, kế hoạch hỏi' : ''}) thành tệp JSON. Tệp sao lưu không chứa mật khẩu và API key.</p></div>
          <div class="setting-ctl"><div class="inline">
            <button class="btn btn-sm" type="button" data-backup>${icon('download', 'ic-sm')}Xuất sao lưu</button>
            <label class="btn btn-sm" style="position:relative;overflow:hidden">${icon('upload', 'ic-sm')}Khôi phục<input type="file" accept="application/json,.json" data-restore style="position:absolute;inset:0;opacity:0;cursor:pointer" aria-label="Chọn tệp sao lưu" /></label>
          </div></div>
        </div>
        <div class="setting-row danger-zone">
          <div><h3>Xóa dữ liệu</h3><p>Xóa toàn bộ văn bản, hồ sơ, biên bản, lịch sử trò chuyện của tài khoản này. <strong>Tài khoản, API key và cài đặt được giữ lại.</strong></p></div>
          <div class="setting-ctl"><div><button class="btn btn-sm" type="button" data-wipe>${icon('trash', 'ic-sm')}Xóa toàn bộ dữ liệu</button></div></div>
        </div>
      </section>
    </div>
  </div>`;

  const root = ctx.view;
  const syncState = () => {
    const b = $('[data-ai-state]', root);
    b.className = `badge ${ctx.hasAI() ? 'badge-success' : 'badge-warning'}`;
    b.textContent = ctx.hasAI() ? `Đang dùng ${ctx.ai().label}` : 'Chưa kết nối';
    $$('[data-prov]', root).forEach((t) => {
      const id = t.dataset.prov;
      t.innerHTML = `${PROVIDERS[id].label}${providers[id]?.key ? ' <span class="dot" style="color:var(--success)"></span>' : ''}`;
      t.setAttribute('aria-pressed', String(id === activeTab));
    });
  };

  function renderProvForm() {
    const host = $('[data-prov-form]', root);
    if (!host) return;
    const p = PROVIDERS[activeTab];
    const cur = providers[activeTab] || {};
    const models = activeTab === 'anthropic' ? MODELS.map((m) => [m.id, m.label]) : p.models.map((m) => [m, m]);
    host.innerHTML = `
      <div class="field"><label for="ai-key">API key ${p.label} (${p.vendor})</label>
        <div class="input-pw"><input class="input" type="password" id="ai-key" placeholder="${p.keyHint}" value="${escapeHtml(cur.key ? '••••••••' + cur.key.slice(-4) : '')}" data-masked="${cur.key ? '1' : ''}" autocomplete="off" spellcheck="false" data-key /><button class="btn btn-ghost btn-sm btn-icon" type="button" aria-label="Hiện/ẩn khóa" data-reveal>${icon('eye', 'ic-sm')}</button></div>
        <span class="hint">Tạo khóa tại ${p.console}.${cur.key ? ' Đã lưu khóa kết thúc bằng …' + escapeHtml(cur.key.slice(-4)) + '.' : ''}</span></div>
      <div class="field"><label for="ai-model">Mô hình</label><input class="input" id="ai-model" list="ai-models" value="${escapeHtml(cur.model || p.defaultModel)}" data-model autocomplete="off" /><datalist id="ai-models">${models.map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`).join('')}</datalist><span class="hint">Có thể nhập tên mô hình khác do ${p.vendor} cung cấp.</span></div>
      <div class="inline">
        <button class="btn btn-primary btn-sm" type="button" data-save-key>${icon('save', 'ic-sm')}Lưu</button>
        <button class="btn btn-sm" type="button" data-test-key>${icon('zap', 'ic-sm')}Kiểm tra kết nối</button>
        ${cur.key ? `<button class="btn btn-ghost btn-sm" type="button" data-remove-key>${icon('trash', 'ic-sm')}Gỡ khóa</button>` : ''}
      </div>`;
    const keyInput = $('[data-key]', host);
    keyInput.addEventListener('focus', () => {
      if (keyInput.dataset.masked) {
        keyInput.value = '';
        keyInput.dataset.masked = '';
      }
    });
    $('[data-reveal]', host).addEventListener('click', () => (keyInput.type = keyInput.type === 'password' ? 'text' : 'password'));
    const readKey = () => (keyInput.dataset.masked ? cur.key : keyInput.value.trim());
    const save = async (k) => {
      providers[activeTab] = { key: k, model: $('[data-model]', host).value.trim() || p.defaultModel };
      await ctx.saveAiProviders(providers);
      if (!ctx.settings().aiProvider || !providers[ctx.settings().aiProvider]?.key) {
        ctx.saveSettings({ aiProvider: activeTab });
        $('[data-default-prov]', root).value = activeTab;
      }
    };
    $('[data-save-key]', host).addEventListener('click', async () => {
      const k = readKey();
      if (!k) return toast('Vui lòng nhập API key', { type: 'error' });
      if (!p.keyPrefix.test(k)) return toast(`API key ${p.label} thường bắt đầu bằng “${p.keyHint.replace('…', '')}”`, { type: 'error' });
      try {
        await save(k);
        audit('Cập nhật API key', p.label);
        renderProvForm();
        syncState();
        toast(`Đã lưu API key ${p.label} (đã mã hóa)`);
      } catch (err) {
        toast(err.message, { type: 'error' });
      }
    });
    $('[data-test-key]', host).addEventListener('click', async (e) => {
      const k = readKey();
      if (!k) return toast('Vui lòng nhập API key', { type: 'error' });
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = `${icon('refresh', 'ic-sm spin')}Đang kiểm tra…`;
      try {
        await testApiKey(k, $('[data-model]', host).value.trim(), activeTab);
        await save(k);
        renderProvForm();
        syncState();
        toast(`Kết nối ${p.label} thành công!`);
      } catch (err) {
        toast(err.message, { type: 'error', timeout: 5000 });
        btn.disabled = false;
        btn.innerHTML = `${icon('zap', 'ic-sm')}Kiểm tra kết nối`;
      }
    });
    $('[data-remove-key]', host)?.addEventListener('click', async () => {
      delete providers[activeTab];
      await ctx.saveAiProviders(providers);
      audit('Gỡ API key', p.label);
      renderProvForm();
      syncState();
      toast(`Đã gỡ API key ${p.label}`);
    });
  }

  $$('[data-prov]', root).forEach((t) =>
    t.addEventListener('click', () => {
      activeTab = t.dataset.prov;
      renderProvForm();
      syncState();
    }),
  );
  $('[data-default-prov]', root)?.addEventListener('change', (e) => {
    ctx.saveSettings({ aiProvider: e.target.value });
    syncState();
    toast(`Nhà cung cấp mặc định: ${PROVIDERS[e.target.value].label}`);
  });
  renderProvForm();

  $('[data-check-update]', root).addEventListener('click', async (e) => {
    const out = $('[data-update-out]', root);
    const btn = e.currentTarget;
    btn.disabled = true;
    out.innerHTML = `<p class="hint">Đang kiểm tra…</p>`;
    try {
      const r = await checkForUpdate();
      out.innerHTML = r.available
        ? `<div class="note">${icon('info', 'ic-sm')}<span>Có phiên bản mới <strong>v${escapeHtml(r.latest)}</strong>.${r.notes?.length ? `<br>${r.notes.map((n) => '• ' + escapeHtml(n)).join('<br>')}` : ''}</span></div><button class="btn btn-primary btn-sm" type="button" data-apply-update>${icon('download', 'ic-sm')}Cập nhật ngay</button>`
        : `<p class="note">${icon('check-circle', 'ic-sm')}<span>Bạn đang dùng phiên bản mới nhất (v${APP_VERSION}).</span></p>`;
      $('[data-apply-update]', out)?.addEventListener('click', applyUpdate);
    } catch (err) {
      out.innerHTML = `<p class="note warn">${icon('alert', 'ic-sm')}<span>${escapeHtml(err.message)}</span></p>`;
    } finally {
      btn.disabled = false;
    }
  });

  $('[data-legal-org]', root)?.addEventListener('submit', (e) => {
    e.preventDefault();
    ctx.saveSettings({ legalOrg: Object.fromEntries(new FormData(e.target)) });
    toast('Đã lưu thông tin cơ quan điều tra');
  });

  $('[data-org]', root).addEventListener('submit', (e) => {
    e.preventDefault();
    ctx.saveSettings({ org: Object.fromEntries(new FormData(e.target)) });
    toast('Đã lưu thông tin đơn vị');
  });

  $$('[data-theme]', root).forEach((b) =>
    b.addEventListener('click', () => {
      setTheme(b.dataset.theme);
      $$('[data-theme]', root).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }),
  );

  $('[data-backup]', root).addEventListener('click', () => {
    const data = { app: 'tro-ly-van-ban', version: 2, exportedAt: new Date().toISOString(), docs: docsRepo.list() };
    if (ctx.can('legal')) for (const k of ['cases', 'records', 'plans']) data[k] = store.get(BACKUP_KEYS[k], []);
    downloadBlob(JSON.stringify(data, null, 2), `tro-ly-van-ban-sao-luu-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    toast(`Đã xuất ${data.docs.length} tài liệu${data.cases ? `, ${data.cases.length} hồ sơ, ${data.records.length} biên bản` : ''}`);
  });
  $('[data-restore]', root).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'tro-ly-van-ban' || !Array.isArray(data.docs)) throw new Error('Tệp sao lưu không hợp lệ');
      const merge = (key, items, ok) => {
        const existing = new Map(store.get(key, []).map((d) => [d.id, d]));
        items.forEach((d) => d?.id && ok(d) && existing.set(d.id, d));
        store.set(key, [...existing.values()]);
      };
      merge('docs', data.docs, (d) => d.typeId);
      let extra = '';
      if (ctx.can('legal') && Array.isArray(data.cases)) {
        merge('cases', data.cases, () => true);
        merge('records', data.records || [], () => true);
        merge('plans', data.plans || [], () => true);
        extra = `, ${data.cases.length} hồ sơ`;
      }
      document.dispatchEvent(new CustomEvent('docs-changed'));
      toast(`Đã khôi phục ${data.docs.length} tài liệu${extra}`);
    } catch (err) {
      toast(err.message || 'Không đọc được tệp', { type: 'error' });
    }
    e.target.value = '';
  });
  $('[data-wipe]', root).addEventListener('click', async () => {
    if (!(await ctx.confirm('Toàn bộ văn bản, hồ sơ, biên bản và lịch sử của tài khoản này sẽ bị xóa vĩnh viễn. Tài khoản, API key và cài đặt được giữ lại.', { title: 'Xóa toàn bộ dữ liệu?', okText: 'Xóa vĩnh viễn', danger: true }))) return;
    WIPE_KEYS.forEach((k) => store.remove(k));
    audit('Xóa toàn bộ dữ liệu', ctx.user()?.email || '');
    document.dispatchEvent(new CustomEvent('docs-changed'));
    toast('Đã xóa toàn bộ dữ liệu (tài khoản được giữ lại)');
    ctx.navigate('#dashboard');
  });
}
