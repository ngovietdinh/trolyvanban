// Cài đặt: AI (API key mã hóa theo tài khoản, đa nhà cung cấp), thông tin đơn vị, giao diện, cập nhật, dữ liệu.
import { $, $$, icon, toast, escapeHtml, setTheme, downloadBlob } from '../ui.js';
import { store, docsRepo, WIPE_KEYS } from '../lib/store.js';
import { PROVIDERS, MODELS, testApiKey, listModels } from '../lib/ai.js';
import { learnedBank } from '../legal/repo.js';
import { khoDb } from '../lib/kho-db.js';
import { relativeTime } from '../lib/vn-date.js';
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
  ['coQuan', 'Cơ quan điều tra (ghi trong câu “Tôi: …, Điều tra viên thuộc …”)', 'Cơ quan CSĐT Bộ Công an'],
  ['dieuTraVien', 'Họ tên điều tra viên', 'Trần Minh Đức'],
  ['chucDanh', 'Chức danh', 'Điều tra viên'],
  ['diaDiem', 'Địa điểm làm việc thường xuyên', 'Trụ sở Cơ quan Cảnh sát điều tra'],
  ['kyHieu', 'Ký hiệu cơ quan trong số văn bản (Số: …/QĐ-…)', 'VD: CSĐT'],
  ['diaDanh', 'Địa danh (ghi ngày tháng văn bản)', 'VD: Ninh Bình'],
  ['quyenKy', 'Quyền hạn ký (nếu ký thay)', 'VD: KT. THỦ TRƯỞNG'],
  ['chucVuKy', 'Chức vụ người ký quyết định, lệnh', 'VD: PHÓ THỦ TRƯỞNG'],
  ['nguoiKy', 'Họ tên người ký quyết định, lệnh', 'VD: Nguyễn Văn Nam'],
  ['thamQuyen', 'Thẩm quyền ban hành (dòng dưới tiêu đề quyết định)', 'Để trống: THỦ TRƯỞNG + tên cơ quan'],
  ['vks', 'Viện kiểm sát nhân dân cùng cấp', 'VD: tỉnh Ninh Bình'],
  ['mauSo', 'Mẫu số — biên bản ghi lời khai (gõ “-” để ẩn)', '140 (mặc định)'],
  ['mauSoHoiCung', 'Mẫu số — biên bản hỏi cung bị can (gõ “-” để ẩn)', 'Theo TT 128/2025/TT-BCA'],
  ['thongTu', 'Ban hành theo (in trong ô mẫu số)', 'TT số 128/2025/TT-BCA ngày 19/12/2025 (mặc định)'],
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
            <label class="check"><input type="checkbox" data-ai-fallback ${s.aiFallback !== false ? 'checked' : ''} />Tự chuyển sang nhà cung cấp khác (đã nhập key) khi AI lỗi, quá tải hoặc không phản hồi</label>
            <label class="check"><input type="checkbox" data-ai-cache ${s.aiCache !== false ? 'checked' : ''} />Ghi nhớ kết quả AI trên máy — yêu cầu giống hệt lần trước dùng lại kết quả, không gửi lại</label>
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
        <div class="panel-head"><h2>${icon('layers', 'ic-sm')}Bộ nhớ cục bộ &amp; nhật ký AI</h2></div>
        <div class="setting-row">
          <div><h3>Tự học, ghi nhớ trên máy</h3><p>Câu hỏi đã hỏi khi ghi lời khai, gợi ý đã chọn được tự động học và xuất hiện lại trong cây hỏi đáp (nhãn “Đã học”); kết quả AI được ghi nhớ để không phải gọi lại. Dữ liệu chỉ nằm trên máy, theo tài khoản.</p></div>
          <div class="setting-ctl" data-memory></div>
        </div>
        <div class="setting-row">
          <div><h3>Nhật ký AI</h3><p>Các lỗi và lần tự chuyển nhà cung cấp gần đây — giúp kiểm tra khi AI không phản hồi.</p></div>
          <div class="setting-ctl" data-ai-log></div>
        </div>
      </section>

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
        <div class="setting-row">
          <div><h3>Lịch sử trò chuyện</h3><p>Các cuộc trò chuyện với Trợ lý AI${ctx.can('legal') ? ' và Trợ lý hồ sơ' : ''} được lưu trên máy, riêng tài khoản này. Có thể xóa từng cuộc ngay trong màn hình trò chuyện.</p></div>
          <div class="setting-ctl"><div><button class="btn btn-sm" type="button" data-clear-chats>${icon('trash', 'ic-sm')}Xóa lịch sử trò chuyện</button><span class="hint" data-chat-n></span></div></div>
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
    const base = activeTab === 'anthropic' ? MODELS.map((m) => [m.id, m.label]) : p.models.map((m) => [m, m]);
    const fetched = (cur.models || []).filter((m) => !base.some(([v]) => v === m)).map((m) => [m, m]);
    const models = [...base, ...fetched];
    const curModel = cur.model || p.defaultModel;
    const custom = !models.some(([v]) => v === curModel);
    host.innerHTML = `
      <div class="field"><label for="ai-key">API key ${p.label} (${p.vendor})</label>
        <div class="input-pw"><input class="input" type="password" id="ai-key" placeholder="${p.keyHint}" value="${escapeHtml(cur.key ? '••••••••' + cur.key.slice(-4) : '')}" data-masked="${cur.key ? '1' : ''}" autocomplete="off" spellcheck="false" data-key /><button class="btn btn-ghost btn-sm btn-icon" type="button" aria-label="Hiện/ẩn khóa" data-reveal>${icon('eye', 'ic-sm')}</button></div>
        <span class="hint">Tạo khóa tại ${p.console}.${cur.key ? ' Đã lưu khóa kết thúc bằng …' + escapeHtml(cur.key.slice(-4)) + '.' : ''}</span></div>
      <div class="field"><label for="ai-model-sel">Mô hình</label>
        <div class="model-row">
          <select class="select" id="ai-model-sel" data-model-sel>${models.map(([v, l]) => `<option value="${escapeHtml(v)}" ${v === curModel ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('')}<option value="__custom" ${custom ? 'selected' : ''}>Khác — tự nhập tên mô hình…</option></select>
          <button class="btn btn-sm" type="button" data-list-models title="Lấy danh sách mô hình mà API key của bạn được dùng">${icon('refresh', 'ic-sm')}Tải danh sách</button>
        </div>
        <input class="input" id="ai-model" data-model value="${escapeHtml(curModel)}" placeholder="Tên mô hình, vd: ${escapeHtml(p.defaultModel)}" autocomplete="off" spellcheck="false" ${custom ? '' : 'hidden'} aria-label="Tên mô hình tự nhập" />
        <span class="hint" data-model-hint>${cur.models?.length ? `${cur.models.length} mô hình lấy từ tài khoản ${p.vendor}.` : `Bấm “Tải danh sách” để lấy đúng các mô hình tài khoản ${p.vendor} của bạn được dùng.`}${cur.key ? ' Đổi mô hình được lưu ngay.' : ''}</span></div>
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
    const modelSel = $('[data-model-sel]', host);
    const modelInput = $('[data-model]', host);
    const saveModelIfKey = async () => {
      const m = modelInput.value.trim();
      if (!cur.key || !m || m === cur.model) return;
      providers[activeTab] = { ...cur, model: m };
      await ctx.saveAiProviders(providers);
      Object.assign(cur, providers[activeTab]);
      syncState();
      toast(`Đã chọn mô hình ${m} cho ${p.label}`);
    };
    modelSel.addEventListener('change', () => {
      const custom = modelSel.value === '__custom';
      modelInput.hidden = !custom;
      if (custom) {
        modelInput.focus();
        modelInput.select();
      } else {
        modelInput.value = modelSel.value;
        saveModelIfKey();
      }
    });
    modelInput.addEventListener('change', saveModelIfKey);
    $('[data-list-models]', host).addEventListener('click', async (e) => {
      const k = readKey();
      if (!k) return toast(`Nhập API key ${p.label} trước để tải danh sách mô hình`, { type: 'error' });
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = `${icon('refresh', 'ic-sm spin')}Đang tải…`;
      try {
        const list = await listModels(activeTab, k);
        if (!list.length) throw new Error('Không có mô hình nào khả dụng cho API key này.');
        if (cur.key) {
          providers[activeTab] = { ...cur, models: list };
          await ctx.saveAiProviders(providers);
        } else cur.models = list;
        Object.assign(cur, providers[activeTab] || {});
        renderProvForm();
        toast(`Đã tải ${list.length} mô hình của ${p.label}`);
      } catch (err) {
        toast(err.message, { type: 'error', timeout: 6000 });
        btn.disabled = false;
        btn.innerHTML = `${icon('refresh', 'ic-sm')}Tải danh sách`;
      }
    });
    const save = async (k) => {
      providers[activeTab] = { ...cur, key: k, model: modelInput.value.trim() || p.defaultModel };
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
        await testApiKey(k, modelInput.value.trim(), activeTab);
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
  $('[data-ai-fallback]', root)?.addEventListener('change', (e) => {
    ctx.saveSettings({ aiFallback: e.target.checked });
    toast(e.target.checked ? 'Đã bật tự chuyển nhà cung cấp khi AI lỗi' : 'Đã tắt tự chuyển nhà cung cấp');
  });
  $('[data-ai-cache]', root)?.addEventListener('change', (e) => {
    ctx.saveSettings({ aiCache: e.target.checked });
    toast(e.target.checked ? 'Đã bật ghi nhớ kết quả AI' : 'Đã tắt ghi nhớ kết quả AI');
  });

  function renderMemory() {
    const host = $('[data-memory]', root);
    const nCache = Object.keys(store.get('ai-cache', {})).length;
    const nLearn = learnedBank.count();
    host.innerHTML = `<div class="mem-stats"><div><strong data-mem-learn>${nLearn}</strong><span>câu hỏi đã học</span></div><div><strong data-mem-cache>${nCache}</strong><span>kết quả AI đã ghi nhớ</span></div></div>
      <div class="inline"><button class="btn btn-sm btn-ghost" type="button" data-clear-learn ${nLearn ? '' : 'disabled'}>${icon('trash', 'ic-sm')}Xóa câu hỏi đã học</button><button class="btn btn-sm btn-ghost" type="button" data-clear-cache ${nCache ? '' : 'disabled'}>${icon('trash', 'ic-sm')}Xóa kết quả AI đã ghi nhớ</button></div>`;
    $('[data-clear-learn]', host).addEventListener('click', async () => {
      if (!(await ctx.confirm('Xóa toàn bộ câu hỏi hệ thống đã tự học?', { title: 'Xóa bộ nhớ', okText: 'Xóa', danger: true }))) return;
      learnedBank.clear();
      renderMemory();
      toast('Đã xóa câu hỏi đã học');
    });
    $('[data-clear-cache]', host).addEventListener('click', () => {
      store.remove('ai-cache');
      renderMemory();
      toast('Đã xóa kết quả AI đã ghi nhớ');
    });
    const logHost = $('[data-ai-log]', root);
    const log = store.get('ai-log', []).slice(0, 12);
    logHost.innerHTML = log.length
      ? `<ul class="ai-log">${log.map((l) => `<li class="${l.type}"><span class="badge ${l.type === 'error' ? 'badge-warning' : ''}">${{ error: 'Lỗi', retry: 'Thử lại' }[l.type] || 'Chuyển'}</span><span><strong>${escapeHtml(PROVIDERS[l.provider]?.label || l.provider || '')}</strong> — ${escapeHtml(l.message || '')}</span><small>${relativeTime(l.at)}</small></li>`).join('')}</ul><button class="btn btn-sm btn-ghost" type="button" data-clear-log>${icon('trash', 'ic-sm')}Xóa nhật ký</button>`
      : `<p class="hint">Chưa ghi nhận lỗi AI nào.</p>`;
    $('[data-clear-log]', logHost)?.addEventListener('click', () => {
      store.remove('ai-log');
      renderMemory();
    });
  }
  renderMemory();

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
    ctx.saveSettings({ legalOrg: { ...(ctx.settings().legalOrg || {}), ...Object.fromEntries(new FormData(e.target)) } });
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
    data.templates = store.get('tpl-custom', []);
    if (ctx.can('legal')) {
      for (const k of ['cases', 'records', 'plans']) data[k] = store.get(BACKUP_KEYS[k], []);
      data.legalDocs = store.get('legal-docs', []);
      data.customActs = store.get('legal-custom-acts', {});
    }
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
      if (Array.isArray(data.templates)) merge('tpl-custom', data.templates, (t) => t.docx && Array.isArray(t.fields));
      let extra = '';
      if (ctx.can('legal') && Array.isArray(data.cases)) {
        merge('cases', data.cases, () => true);
        merge('records', data.records || [], () => true);
        merge('plans', data.plans || [], () => true);
        merge('legal-docs', data.legalDocs || [], (d) => d.formId);
        if (data.customActs && typeof data.customActs === 'object') {
          const acts = store.get('legal-custom-acts', {});
          for (const [dieu, list] of Object.entries(data.customActs)) {
            if (!Array.isArray(list)) continue;
            const byId = new Map((acts[dieu] || []).map((a) => [a.id, a]));
            list.forEach((a) => a?.id && a.ten && byId.set(a.id, a));
            acts[dieu] = [...byId.values()];
          }
          store.set('legal-custom-acts', acts);
        }
        extra = `, ${data.cases.length} hồ sơ`;
      }
      document.dispatchEvent(new CustomEvent('docs-changed'));
      toast(`Đã khôi phục ${data.docs.length} tài liệu${extra}`);
    } catch (err) {
      toast(err.message || 'Không đọc được tệp', { type: 'error' });
    }
    e.target.value = '';
  });
  const chatCount = () => (store.get('chat-threads', []) || []).length + (store.get('chat', []).length ? 1 : 0) + (store.get('kho-chat', []).length ? 1 : 0) + (store.get('kho-threads', []) || []).length;
  const syncChatN = () => {
    const n = chatCount();
    $('[data-chat-n]', root).textContent = n ? ` ${n} cuộc trò chuyện` : ' Chưa có';
    $('[data-clear-chats]', root).disabled = !n;
  };
  syncChatN();
  $('[data-clear-chats]', root).addEventListener('click', async () => {
    if (!(await ctx.confirm(`Xóa toàn bộ ${chatCount()} cuộc trò chuyện? Văn bản, biên bản đã tạo vẫn giữ nguyên.`, { title: 'Xóa lịch sử trò chuyện', okText: 'Xóa', danger: true }))) return;
    ['chat-threads', 'chat', 'chat-current', 'kho-chat', 'kho-threads', 'kho-current'].forEach((k) => store.remove(k));
    syncChatN();
    toast('Đã xóa lịch sử trò chuyện');
  });
  $('[data-wipe]', root).addEventListener('click', async () => {
    if (!(await ctx.confirm('Toàn bộ văn bản, hồ sơ, biên bản và lịch sử của tài khoản này sẽ bị xóa vĩnh viễn. Tài khoản, API key và cài đặt được giữ lại.', { title: 'Xóa toàn bộ dữ liệu?', okText: 'Xóa vĩnh viễn', danger: true }))) return;
    WIPE_KEYS.forEach((k) => store.remove(k));
    await khoDb.clear().catch(() => {});
    audit('Xóa toàn bộ dữ liệu', ctx.user()?.email || '');
    document.dispatchEvent(new CustomEvent('docs-changed'));
    toast('Đã xóa toàn bộ dữ liệu (tài khoản được giữ lại)');
    ctx.navigate('#dashboard');
  });
}
