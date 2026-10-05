// Tóm tắt văn bản: cục bộ (trích xuất) hoặc AI Claude (diễn giải).
import { $, icon, toast, escapeHtml, copyText, renderMarkdown } from '../ui.js';
import { summarize, textStats } from '../lib/summarize.js';
import { docxToText } from '../lib/docx.js';
import { store, usage } from '../lib/store.js';
import { streamClaude } from '../lib/ai.js';

const SAMPLE = `Thực hiện Kế hoạch số 45/KH-UBND ngày 12/02/2026 của Ủy ban nhân dân phường về triển khai chuyển đổi số năm 2026, trong quý III, Ủy ban nhân dân phường đã tập trung chỉ đạo quyết liệt các nhiệm vụ trọng tâm. Bộ phận Một cửa tiếp nhận 1.245 hồ sơ thủ tục hành chính, giải quyết đúng hạn 1.240 hồ sơ, đạt tỷ lệ 99,6%. Tỷ lệ hồ sơ trực tuyến toàn trình đạt 78%, tăng 12% so với quý II. Phường đã tổ chức 06 đợt hướng dẫn người dân cài đặt và kích hoạt tài khoản định danh điện tử mức độ 2 với hơn 2.000 lượt người tham gia. Hệ thống camera an ninh được lắp đặt bổ sung tại 15 tuyến phố, góp phần giữ gìn trật tự an toàn xã hội.
Tuy nhiên, công tác cập nhật dữ liệu dân cư tại một số tổ dân phố còn chậm; trang thiết bị công nghệ thông tin tại Bộ phận Một cửa đã xuống cấp, ảnh hưởng đến tiến độ giải quyết hồ sơ. Một bộ phận người dân cao tuổi còn gặp khó khăn khi sử dụng dịch vụ công trực tuyến.
Trong quý IV, Ủy ban nhân dân phường đề ra nhiệm vụ trọng tâm là hoàn thành 100% chỉ tiêu chuyển đổi số năm 2026. Phường sẽ đề xuất Ủy ban nhân dân quận bố trí kinh phí mua sắm thiết bị mới, đồng thời tăng cường lực lượng tổ công nghệ số cộng đồng hỗ trợ người dân. Giao Văn phòng chủ trì theo dõi, đôn đốc và báo cáo kết quả định kỳ hằng tháng.`;

export function render(ctx) {
  let controller = null;
  ctx.view.innerHTML = `
  <div class="page">
    <div class="page-head">
      <div><h1 class="page-title">Tóm tắt <em>văn bản</em></h1><p class="page-sub">Rút gọn văn bản dài thành các ý chính, kèm từ khóa và thống kê.</p></div>
      <button class="btn" type="button" data-sample>${icon('wand', 'ic-sm')}Văn bản mẫu</button>
    </div>
    <div class="tool-grid">
      <section class="panel">
        <div class="panel-head"><h2>${icon('file', 'ic-sm')}Văn bản gốc</h2><button class="btn btn-ghost btn-sm" type="button" data-clear>${icon('trash', 'ic-sm')}Xóa</button></div>
        <div class="panel-body" style="display:grid;gap:14px">
          <label class="dropzone">
            <input type="file" accept=".txt,.docx" data-file aria-label="Tải lên tệp .docx hoặc .txt" />
            <span class="dz-icon">${icon('upload')}</span>
            <span><strong>Tải lên tệp .docx hoặc .txt</strong><small>Nội dung được xử lý ngay trên trình duyệt</small></span>
          </label>
          <textarea class="textarea" rows="13" placeholder="Dán văn bản cần tóm tắt…" aria-label="Văn bản cần tóm tắt" data-input>${escapeHtml(store.get('summary-text', ''))}</textarea>
          <div class="field">
            <label for="ratio">Độ dài bản tóm tắt</label>
            <div class="range-row"><input type="range" id="ratio" min="10" max="60" step="5" value="${store.get('summary-ratio', 30)}" data-ratio /><output data-ratio-out></output></div>
          </div>
          <div class="inline">
            <button class="btn btn-primary" type="button" data-run>${icon('book', 'ic-sm')}Tóm tắt nhanh</button>
            <button class="btn" type="button" data-ai ${ctx.hasAI() ? '' : 'title="Cần API key — xem Cài đặt"'}>${icon('sparkles', 'ic-sm')}Tóm tắt bằng AI</button>
          </div>
        </div>
      </section>
      <section class="panel" data-result>
        <div class="empty"><div class="empty-icon">${icon('book', 'ic-lg')}</div><h3>Chưa có bản tóm tắt</h3><p>Dán văn bản và nhấn “Tóm tắt nhanh”.</p></div>
      </section>
    </div>
  </div>`;

  const root = ctx.view;
  const input = $('[data-input]', root);
  const ratio = $('[data-ratio]', root);
  const out = $('[data-ratio-out]', root);
  const result = $('[data-result]', root);

  const updateRatio = () => (out.textContent = `${ratio.value}% số câu`);
  ratio.addEventListener('input', () => {
    updateRatio();
    store.set('summary-ratio', +ratio.value);
  });
  updateRatio();
  input.addEventListener('input', () => store.set('summary-text', input.value));

  function statsHtml(text) {
    const s = textStats(text);
    return `<div class="stats-row"><div><strong>${s.words.toLocaleString('vi-VN')}</strong><span>từ</span></div><div><strong>${s.sentences}</strong><span>câu</span></div><div><strong>${s.paragraphs}</strong><span>đoạn</span></div><div><strong>${s.readingMinutes}′</strong><span>thời gian đọc</span></div></div>`;
  }

  function runLocal() {
    const text = input.value.trim();
    if (text.length < 40) {
      toast('Văn bản quá ngắn để tóm tắt', { type: 'error' });
      return input.focus();
    }
    const r = summarize(text, { ratio: +ratio.value / 100, minSentences: 2 });
    usage.track('summary');
    result.innerHTML = `
      <div class="panel-head"><h2>${icon('check-circle', 'ic-sm')}Ý chính</h2><button class="btn btn-ghost btn-sm" type="button" data-copy>${icon('copy', 'ic-sm')}Sao chép</button></div>
      ${statsHtml(text)}
      <div class="panel-body" style="display:grid;gap:20px">
        <ol class="summary-list">${r.sentences.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
        ${r.keywords.length ? `<div><div class="label" style="margin-bottom:8px">Từ khóa</div><div class="kw-list">${r.keywords.map((k) => `<span class="kw">${escapeHtml(k)}</span>`).join('')}</div></div>` : ''}
        <p class="hint">Giữ lại ${r.sentences.length} câu tiêu biểu nhất · rút gọn ${Math.max(0, Math.round((1 - r.summary.length / text.length) * 100))}% độ dài.</p>
      </div>`;
    result.querySelector('[data-copy]').addEventListener('click', async () => {
      await copyText(r.sentences.map((s, i) => `${i + 1}. ${s}`).join('\n'));
      toast('Đã sao chép bản tóm tắt');
    });
  }

  async function runAI() {
    if (controller) return controller.abort();
    if (!ctx.hasAI()) {
      toast(ctx.can('ai') ? 'Thêm API key (ChatGPT, Gemini, Grok hoặc Claude) trong Cài đặt để dùng tóm tắt bằng AI' : 'Tài khoản chưa được cấp quyền dùng AI trực tuyến', { type: 'info' });
      return ctx.navigate('#settings');
    }
    const text = input.value.trim();
    if (text.length < 40) {
      toast('Văn bản quá ngắn để tóm tắt', { type: 'error' });
      return input.focus();
    }
    const { provider, apiKey, model } = ctx.ai();
    const btn = $('[data-ai]', root);
    controller = new AbortController();
    btn.innerHTML = `${icon('stop', 'ic-sm')}Dừng`;
    result.innerHTML = `<div class="panel-head"><h2>${icon('sparkles', 'ic-sm')}Tóm tắt bằng AI</h2></div>${statsHtml(text)}<div class="panel-body ai-output msg-content" data-ai-out><span class="typing"><span></span><span></span><span></span></span></div>`;
    const target = $('[data-ai-out]', result);
    usage.track('ai');
    try {
      const all = await streamClaude({
        provider,
        apiKey,
        model,
        signal: controller.signal,
        cache: true,
        messages: [{ role: 'user', content: `Tóm tắt văn bản sau thành khoảng ${Math.max(3, Math.round(+ratio.value / 8))} ý chính (gạch đầu dòng), sau đó nêu "Kết luận/kiến nghị" (nếu có) và "Từ khóa". Viết tiếng Việt chuẩn mực, không thêm thông tin ngoài văn bản.\n\n---\n${text}` }],
        onText: (_, s) => (target.innerHTML = renderMarkdown(s)),
      });
      target.innerHTML = renderMarkdown(all);
    } catch (err) {
      target.innerHTML = `<p style="color:var(--danger)">${escapeHtml(err.message)}</p>`;
    } finally {
      controller = null;
      btn.innerHTML = `${icon('sparkles', 'ic-sm')}Tóm tắt bằng AI`;
    }
  }

  $('[data-run]', root).addEventListener('click', runLocal);
  $('[data-ai]', root).addEventListener('click', runAI);
  $('[data-sample]', root).addEventListener('click', () => {
    input.value = SAMPLE;
    store.set('summary-text', SAMPLE);
    runLocal();
  });
  $('[data-clear]', root).addEventListener('click', () => {
    input.value = '';
    store.set('summary-text', '');
    input.focus();
  });
  $('[data-file]', root).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      input.value = /\.docx$/i.test(file.name) ? await docxToText(buf) : new TextDecoder().decode(buf);
      store.set('summary-text', input.value);
      toast(`Đã tải “${file.name}”`);
      runLocal();
    } catch (err) {
      toast(err.message || 'Không đọc được tệp', { type: 'error' });
    }
  });

  return () => controller?.abort();
}
