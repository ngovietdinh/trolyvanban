// Đọc số / số tiền thành chữ.
import { $, icon, toast, escapeHtml, copyText, debounce } from '../ui.js';
import { numberToWords, moneyToWords, formatNumberVi, capitalize } from '../lib/number-words.js';
import { store } from '../lib/store.js';

export function render(ctx) {
  const opts = { money: true, suffix: true, ...store.get('number-opts', {}) };
  ctx.view.innerHTML = `
  <div class="page page-narrow">
    <div class="page-head">
      <div><h1 class="page-title">Đọc số <em>thành chữ</em></h1><p class="page-sub">Chuẩn cách đọc trên chứng từ kế toán, hợp đồng, quyết định chi.</p></div>
    </div>
    <section class="panel number-hero">
      <label class="label" for="num-input">Nhập số hoặc số tiền</label>
      <input class="input" id="num-input" inputmode="decimal" autocomplete="off" placeholder="VD: 1.250.000 hoặc 2500000,5" value="${escapeHtml(store.get('number-last', '1250000'))}" data-input style="margin-top:8px" />
      <div class="opt-row">
        <label class="check"><input type="checkbox" data-opt="money" ${opts.money ? 'checked' : ''}/>Đọc là số tiền (đồng)</label>
        <label class="check"><input type="checkbox" data-opt="suffix" ${opts.suffix ? 'checked' : ''}/>Thêm “chẵn” khi không có số lẻ</label>
      </div>
      <div class="number-out" aria-live="polite">
        <div class="lbl">Bằng chữ</div>
        <p class="words" data-words></p>
        <div class="inline" style="margin-top:16px">
          <span class="badge" data-formatted></span>
          <span style="flex:1"></span>
          <button class="btn btn-sm" type="button" data-copy>${icon('copy', 'ic-sm')}Sao chép</button>
          <button class="btn btn-sm btn-dark" type="button" data-keep>${icon('star', 'ic-sm')}Lưu lịch sử</button>
        </div>
      </div>
    </section>
    <section class="panel" style="margin-top:18px">
      <div class="panel-head"><h2>${icon('clock', 'ic-sm')}Lịch sử</h2><button class="btn btn-ghost btn-sm" type="button" data-clear-hist>${icon('trash', 'ic-sm')}Xóa lịch sử</button></div>
      <ul class="hist-list" data-hist></ul>
    </section>
  </div>`;

  const root = ctx.view;
  const input = $('[data-input]', root);
  const words = $('[data-words]', root);
  let current = '';

  function compute() {
    const v = input.value.trim();
    store.set('number-last', v);
    if (!v) {
      current = '';
      words.textContent = 'Nhập một số để xem kết quả.';
      words.classList.add('error');
      $('[data-formatted]', root).textContent = '—';
      return;
    }
    try {
      current = opts.money ? moneyToWords(v, { suffix: opts.suffix }) : capitalize(numberToWords(v)) + '.';
      words.textContent = current;
      words.classList.remove('error');
      $('[data-formatted]', root).textContent = formatNumberVi(v) + (opts.money ? ' đ' : '');
    } catch {
      current = '';
      words.textContent = 'Số không hợp lệ. Ví dụ hợp lệ: 1.250.000 · 2500000 · 12,5';
      words.classList.add('error');
      $('[data-formatted]', root).textContent = '—';
    }
  }

  function renderHist() {
    const hist = store.get('number-history', []);
    $('[data-hist]', root).innerHTML = hist.length
      ? hist.map((h, i) => `<li><button type="button" data-h="${i}"><strong>${escapeHtml(h.formatted)}</strong><span>${escapeHtml(h.words)}</span></button></li>`).join('')
      : `<li class="empty" style="padding:28px">Chưa có mục nào được lưu.</li>`;
  }

  input.addEventListener('input', debounce(compute, 60));
  root.querySelectorAll('[data-opt]').forEach((c) =>
    c.addEventListener('change', () => {
      opts[c.dataset.opt] = c.checked;
      store.set('number-opts', opts);
      compute();
    }),
  );
  $('[data-copy]', root).addEventListener('click', async () => {
    if (!current) return toast('Chưa có kết quả để sao chép', { type: 'error' });
    await copyText(current);
    toast('Đã sao chép');
  });
  $('[data-keep]', root).addEventListener('click', () => {
    if (!current) return toast('Chưa có kết quả để lưu', { type: 'error' });
    store.update('number-history', (h) => [{ formatted: $('[data-formatted]', root).textContent, raw: input.value, words: current }, ...h.filter((x) => x.words !== current)].slice(0, 12), []);
    renderHist();
    toast('Đã lưu vào lịch sử');
  });
  $('[data-hist]', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-h]');
    if (!b) return;
    input.value = store.get('number-history', [])[+b.dataset.h].raw;
    compute();
    input.focus();
  });
  $('[data-clear-hist]', root).addEventListener('click', () => {
    store.set('number-history', []);
    renderHist();
  });

  compute();
  renderHist();
  input.focus();
  input.select();
}
