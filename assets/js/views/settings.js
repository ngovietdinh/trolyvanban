// Cài đặt: AI (API key, mô hình), thông tin đơn vị mặc định, giao diện, dữ liệu.
import { $, $$, icon, toast, escapeHtml, setTheme, downloadBlob } from '../ui.js';
import { store, docsRepo } from '../lib/store.js';
import { MODELS, testApiKey } from '../lib/ai.js';

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
  const org = s.org || {};
  const legalOrg = s.legalOrg || {};
  const theme = document.documentElement.dataset.theme || 'system';

  ctx.view.innerHTML = `
  <div class="page page-narrow">
    <div class="page-head"><div><h1 class="page-title">Cài <em>đặt</em></h1><p class="page-sub">Cá nhân hóa trải nghiệm và kết nối trí tuệ nhân tạo.</p></div></div>
    <div class="settings-grid">
      <section class="panel">
        <div class="panel-head"><h2>${icon('sparkles', 'ic-sm')}Trí tuệ nhân tạo</h2><span class="badge ${ctx.hasAI() ? 'badge-success' : 'badge-warning'}" data-ai-state>${ctx.hasAI() ? 'Đã kết nối' : 'Chưa kết nối'}</span></div>
        <div class="setting-row">
          <div><h3>API key Anthropic</h3><p>Dùng để soạn thảo, trò chuyện và tóm tắt bằng Claude. Khóa chỉ lưu trên trình duyệt này.</p></div>
          <div class="setting-ctl">
            <div class="inline">
              <div class="input-pw"><input class="input" type="password" placeholder="sk-ant-…" value="${escapeHtml(s.apiKey)}" autocomplete="off" spellcheck="false" aria-label="API key" data-key /><button class="btn btn-ghost btn-sm btn-icon" type="button" aria-label="Hiện/ẩn khóa" data-reveal>${icon('eye', 'ic-sm')}</button></div>
            </div>
            <div class="inline">
              <button class="btn btn-primary btn-sm" type="button" data-save-key>${icon('save', 'ic-sm')}Lưu</button>
              <button class="btn btn-sm" type="button" data-test-key>${icon('zap', 'ic-sm')}Kiểm tra kết nối</button>
              <button class="btn btn-ghost btn-sm" type="button" data-remove-key>${icon('trash', 'ic-sm')}Gỡ khóa</button>
            </div>
            <div class="note">${icon('info', 'ic-sm')}<span>Tạo khóa tại console.anthropic.com. Yêu cầu AI được gửi trực tiếp từ trình duyệt tới Anthropic qua HTTPS, không đi qua máy chủ trung gian.</span></div>
          </div>
        </div>
        <div class="setting-row">
          <div><h3>Mô hình</h3><p>Chọn cân bằng giữa chất lượng và tốc độ.</p></div>
          <div class="setting-ctl"><select class="select" data-model aria-label="Mô hình AI">${MODELS.map((m) => `<option value="${m.id}" ${m.id === s.model ? 'selected' : ''}>${m.label}</option>`).join('')}</select></div>
        </div>
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

      <section class="panel">
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
        <div class="panel-head"><h2>${icon('folder', 'ic-sm')}Dữ liệu</h2></div>
        <div class="setting-row">
          <div><h3>Sao lưu &amp; khôi phục</h3><p>Xuất toàn bộ tài liệu thành tệp JSON để lưu trữ hoặc chuyển sang thiết bị khác.</p></div>
          <div class="setting-ctl"><div class="inline">
            <button class="btn btn-sm" type="button" data-backup>${icon('download', 'ic-sm')}Xuất sao lưu</button>
            <label class="btn btn-sm" style="position:relative;overflow:hidden">${icon('upload', 'ic-sm')}Khôi phục<input type="file" accept="application/json,.json" data-restore style="position:absolute;inset:0;opacity:0;cursor:pointer" aria-label="Chọn tệp sao lưu" /></label>
          </div></div>
        </div>
        <div class="setting-row danger-zone">
          <div><h3>Xóa dữ liệu</h3><p>Xóa toàn bộ tài liệu, lịch sử trò chuyện và cài đặt trên trình duyệt này.</p></div>
          <div class="setting-ctl"><div><button class="btn btn-sm" type="button" data-wipe>${icon('trash', 'ic-sm')}Xóa toàn bộ dữ liệu</button></div></div>
        </div>
      </section>
    </div>
  </div>`;

  const root = ctx.view;
  const keyInput = $('[data-key]', root);
  const syncState = () => {
    const b = $('[data-ai-state]', root);
    b.className = `badge ${ctx.hasAI() ? 'badge-success' : 'badge-warning'}`;
    b.textContent = ctx.hasAI() ? 'Đã kết nối' : 'Chưa kết nối';
  };

  $('[data-reveal]', root).addEventListener('click', () => (keyInput.type = keyInput.type === 'password' ? 'text' : 'password'));
  $('[data-save-key]', root).addEventListener('click', () => {
    const k = keyInput.value.trim();
    if (k && !/^sk-ant-/.test(k)) return toast('API key Anthropic thường bắt đầu bằng “sk-ant-”', { type: 'error' });
    ctx.saveSettings({ apiKey: k });
    syncState();
    toast(k ? 'Đã lưu API key — AI Claude đã sẵn sàng' : 'Đã xóa API key');
  });
  $('[data-remove-key]', root).addEventListener('click', () => {
    keyInput.value = '';
    ctx.saveSettings({ apiKey: '' });
    syncState();
    toast('Đã gỡ API key');
  });
  $('[data-test-key]', root).addEventListener('click', async (e) => {
    const k = keyInput.value.trim();
    if (!k) return toast('Vui lòng nhập API key', { type: 'error' });
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `${icon('refresh', 'ic-sm spin')}Đang kiểm tra…`;
    try {
      await testApiKey(k, $('[data-model]', root).value);
      ctx.saveSettings({ apiKey: k });
      syncState();
      toast('Kết nối thành công!');
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 5000 });
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('zap', 'ic-sm')}Kiểm tra kết nối`;
    }
  });
  $('[data-model]', root).addEventListener('change', (e) => {
    ctx.saveSettings({ model: e.target.value });
    toast('Đã đổi mô hình');
  });

  $('[data-legal-org]', root).addEventListener('submit', (e) => {
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
    const data = { app: 'tro-ly-van-ban', version: 1, exportedAt: new Date().toISOString(), docs: docsRepo.list() };
    downloadBlob(JSON.stringify(data, null, 2), `tro-ly-van-ban-sao-luu-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    toast(`Đã xuất ${data.docs.length} tài liệu`);
  });
  $('[data-restore]', root).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'tro-ly-van-ban' || !Array.isArray(data.docs)) throw new Error('Tệp sao lưu không hợp lệ');
      const existing = new Map(store.get('docs', []).map((d) => [d.id, d]));
      data.docs.forEach((d) => d.id && d.typeId && existing.set(d.id, d));
      store.set('docs', [...existing.values()]);
      document.dispatchEvent(new CustomEvent('docs-changed'));
      toast(`Đã khôi phục ${data.docs.length} tài liệu`);
    } catch (err) {
      toast(err.message || 'Không đọc được tệp', { type: 'error' });
    }
    e.target.value = '';
  });
  $('[data-wipe]', root).addEventListener('click', async () => {
    if (!(await ctx.confirm('Toàn bộ tài liệu, lịch sử và cài đặt trên trình duyệt này sẽ bị xóa vĩnh viễn.', { title: 'Xóa toàn bộ dữ liệu?', okText: 'Xóa vĩnh viễn', danger: true }))) return;
    ['docs', 'chat', 'settings', 'cases', 'records', 'plans', 'legal-custom', 'legal-selection', 'compose-draft', 'usage', 'spell-text', 'summary-text', 'number-history', 'session', 'users'].forEach((k) => store.remove(k));
    document.dispatchEvent(new CustomEvent('docs-changed'));
    toast('Đã xóa toàn bộ dữ liệu');
    ctx.navigate('#dashboard');
  });
}
