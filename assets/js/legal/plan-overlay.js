// Lớp chỉnh sửa của người dùng áp lên kế hoạch hỏi do hệ thống sinh — dùng chung cho Cây hỏi đáp, Theo dõi,
// Hồ sơ vụ án, lời khai.
//
// overlay = {
//   mode: 'pick'  — câu hỏi hệ thống / AI sinh ra chỉ là GỢI Ý; người dùng bấm “Thêm” mới đưa vào kế hoạch
//                   (kế hoạch cũ không có mode: mọi câu sinh ra đều nằm trong kế hoạch như trước);
//   picked: { [issueKey]: [văn bản gốc] }   — gợi ý đã đưa vào kế hoạch;
//   removed: [văn bản gốc]                   — gợi ý / câu hỏi đã bỏ;
//   edited:  { [văn bản gốc]: văn bản mới }  — câu đã sửa;
//   added:   { [issueKey]: [văn bản] }        — câu tự thêm (luôn nằm trong kế hoạch);
//   ai:      { [issueKey]: [văn bản] }        — câu AI gợi ý (chế độ chọn: vào danh sách gợi ý);
//   track:   { [qKey]: trạng thái }           — trạng thái theo dõi (xem tracking.js)
// }

export const newOverlay = () => ({ removed: [], edited: {}, added: {}, ai: {}, mode: 'pick', picked: {} });
export const isPickMode = (o) => o?.mode === 'pick';

let n = 0;
const nid = () => `o${Date.now().toString(36)}${(++n).toString(36)}`;

/**
 * Áp lớp chỉnh sửa lên kế hoạch vừa sinh (sửa trực tiếp p.issues). Mỗi câu có `origin` (văn bản gốc để nhớ chọn /
 * sửa / bỏ). Chế độ chọn: is.cauHoi = câu đã chọn + câu tự thêm; is.goiY = gợi ý chưa chọn.
 */
export function applyPlanOverlay(p, overlay = {}, { uid = nid } = {}) {
  const o = { removed: [], edited: {}, added: {}, ai: {}, ...overlay };
  const pick = isPickMode(o);
  for (const is of p.issues) {
    let pool = is.cauHoi
      .filter((c) => !o.removed.includes(c.text))
      .map((c) => (o.edited[c.text] ? { ...c, text: o.edited[c.text], editedFrom: c.text, origin: c.text } : { ...c, origin: c.text }));
    // Câu đã có (vd: vừa được học) thì không thêm trùng.
    const has = (list, t) => list.findIndex((c) => c.text.toLowerCase() === t.toLowerCase());
    for (const t of o.ai[is.key] || []) {
      if (o.removed.includes(t)) continue;
      const i = has(pool, t);
      const item = { id: uid(), text: t, src: 'ai', priority: 'normal', buoc: 'cu-the', origin: t };
      if (i >= 0 && pool[i].src === 'hoc') pool[i] = item;
      else if (i < 0) pool.push(item);
    }
    const manual = (o.added[is.key] || []).map((t) => ({ id: uid(), text: t, src: 'tuy-chinh', priority: 'high', local: true, buoc: 'cu-the', origin: t }));
    if (pick) {
      const picked = new Set(o.picked?.[is.key] || []);
      const inPlan = pool.filter((c) => picked.has(c.origin));
      is.goiY = pool.filter((c) => !picked.has(c.origin));
      is.cauHoi = [...inPlan, ...manual.filter((m) => has(inPlan, m.text) < 0)];
    } else {
      for (const m of manual) {
        const i = has(pool, m.text);
        if (i >= 0 && pool[i].src === 'hoc') pool[i] = m;
        else if (i < 0) pool.push(m);
      }
      is.cauHoi = pool;
      is.goiY = [];
    }
  }
  p.stats = { ...(p.stats || {}), questions: p.issues.reduce((s, i) => s + i.cauHoi.length, 0), suggestions: p.issues.reduce((s, i) => s + (i.goiY?.length || 0), 0) };
  return p;
}

/** Đưa gợi ý vào kế hoạch (origins: văn bản gốc). */
export function pickQuestions(overlay, issueKey, origins) {
  const cur = overlay.picked?.[issueKey] || [];
  overlay.picked = { ...(overlay.picked || {}), [issueKey]: [...new Set([...cur, ...origins])] };
  return overlay;
}
/** Chuyển câu trong kế hoạch về lại gợi ý. */
export function unpickQuestion(overlay, issueKey, origin) {
  overlay.picked = { ...(overlay.picked || {}), [issueKey]: (overlay.picked?.[issueKey] || []).filter((t) => t !== origin) };
  return overlay;
}
/** Kế hoạch cũ (mọi câu đều trong kế hoạch) → chế độ chọn, giữ nguyên các câu đang có. */
export function toPickMode(overlay, plan) {
  overlay.mode = 'pick';
  overlay.picked = Object.fromEntries(plan.issues.map((is) => [is.key, is.cauHoi.filter((c) => !c.local).map((c) => c.origin || c.text)]));
  return overlay;
}
