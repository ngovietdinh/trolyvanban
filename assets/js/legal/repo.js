// Lưu trữ hồ sơ vụ án, người tham gia tố tụng, kế hoạch hỏi và biên bản (trên trình duyệt).
import { store, rawStore, uid } from '../lib/store.js';
import { registerCustomActs, rebuildCatalog } from './engine.js';

function collection(key) {
  return {
    list(filter) {
      const all = store.get(key, []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return filter ? all.filter(filter) : all;
    },
    get(id) {
      return store.get(key, []).find((x) => x.id === id) || null;
    },
    save(item) {
      const all = store.get(key, []);
      const now = Date.now();
      const rec = { ...item, id: item.id || uid(), createdAt: item.createdAt || now, updatedAt: now };
      const i = all.findIndex((x) => x.id === rec.id);
      if (i >= 0) all[i] = rec;
      else all.push(rec);
      store.set(key, all);
      return rec;
    },
    remove(id) {
      store.set(
        key,
        store.get(key, []).filter((x) => x.id !== id),
      );
    },
    /** Khôi phục nguyên trạng một bản ghi đã xóa (hoàn tác). */
    restore(item) {
      const all = store.get(key, []).filter((x) => x.id !== item.id);
      store.set(key, [...all, item]);
    },
  };
}

export const casesRepo = collection('cases');
export const recordsRepo = collection('records');
export const plansRepo = collection('plans');

/** Câu hỏi người dùng lưu vào “bộ câu hỏi của tôi”, khóa theo `${dieu}|${issueKey}`. */
export const customBank = {
  all() {
    return store.get('legal-custom', {});
  },
  add(dieu, issueKey, text) {
    const all = this.all();
    const k = `${dieu}|${issueKey}`;
    all[k] = [...new Set([...(all[k] || []), text.trim()])];
    store.set('legal-custom', all);
  },
  remove(dieu, issueKey, text) {
    const all = this.all();
    const k = `${dieu}|${issueKey}`;
    all[k] = (all[k] || []).filter((t) => t !== text);
    store.set('legal-custom', all);
  },
};

/** Xóa các biên bản lời khai; trả về bản sao để hoàn tác. */
export function deleteRecords(ids) {
  const removed = ids.map((id) => recordsRepo.get(id)).filter(Boolean);
  removed.forEach((r) => recordsRepo.remove(r.id));
  return removed;
}
export function restoreRecords(list) {
  list.forEach((r) => recordsRepo.restore(r));
}

export function deleteCase(id) {
  recordsRepo.list((r) => r.caseId === id).forEach((r) => recordsRepo.remove(r.id));
  plansRepo.list((p) => p.caseId === id).forEach((p) => plansRepo.remove(p.id));
  casesRepo.remove(id);
}

/** Hành vi vi phạm do người dùng tự thêm cho từng điều luật. */
export const customActs = {
  all: () => store.get('legal-custom-acts', {}),
  of: (dieu) => store.get('legal-custom-acts', {})[dieu] || [],
  save(dieu, act) {
    const all = this.all();
    const list = all[dieu] || [];
    const rec = { ...act, id: act.id || `tt-${uid()}` };
    const i = list.findIndex((x) => x.id === rec.id);
    if (i >= 0) list[i] = rec;
    else list.push(rec);
    all[dieu] = list;
    store.set('legal-custom-acts', all);
    return rec;
  },
  remove(dieu, id) {
    const all = this.all();
    all[dieu] = (all[dieu] || []).filter((x) => x.id !== id);
    store.set('legal-custom-acts', all);
  },
};
registerCustomActs(() => customActs.all());

/**
 * Câu hỏi hệ thống tự học trên máy: câu hỏi đã thực sự hỏi khi ghi lời khai và gợi ý (AI/ngoại tuyến)
 * đã được chọn dùng. Khóa `${dieu}|${issueKey}` → [{ text, n (số lần dùng), at }].
 */
const LEARN_KEY = 'legal-learned';
const normQ = (t) => String(t || '').trim().replace(/\s+/g, ' ');
export const learnedBank = {
  all: () => store.get(LEARN_KEY, {}),
  of(dieu, issueKey) {
    return [...(this.all()[`${dieu}|${issueKey}`] || [])].sort((a, b) => b.n - a.n || b.at - a.at);
  },
  learn(dieu, issueKey, text) {
    const t = normQ(text);
    if (!dieu || t.length < 6) return;
    const all = this.all();
    const k = `${dieu}|${issueKey || '_chung'}`;
    const list = all[k] || [];
    const hit = list.find((x) => x.text.toLowerCase() === t.toLowerCase());
    if (hit) {
      hit.n += 1;
      hit.at = Date.now();
    } else list.push({ text: t, n: 1, at: Date.now() });
    // Giữ tối đa 40 câu mỗi vấn đề — bỏ câu ít dùng, cũ nhất.
    all[k] = list.sort((a, b) => b.n - a.n || b.at - a.at).slice(0, 40);
    store.set(LEARN_KEY, all);
  },
  forget(dieu, issueKey, text) {
    const all = this.all();
    const k = `${dieu}|${issueKey}`;
    all[k] = (all[k] || []).filter((x) => x.text !== normQ(text));
    store.set(LEARN_KEY, all);
  },
  count() {
    return Object.values(this.all()).reduce((s, l) => s + l.length, 0);
  },
  clear: () => store.remove(LEARN_KEY),
};

/**
 * Nguyên văn Bộ luật Hình sự do người dùng nạp (dữ liệu tham chiếu dùng chung cho mọi tài khoản trên máy).
 * Sau khi nạp, cây hỏi đáp dùng tên điều chính thức, nội dung khoản, tình tiết định khung theo văn bản.
 */
const BLHS_KEY = 'blhs-official';
export const officialBlhs = {
  get: () => rawStore.get(BLHS_KEY, null),
  save(parsed, source = '') {
    const data = { importedAt: Date.now(), source, articles: parsed.articles, chapters: parsed.chapters };
    rawStore.set(BLHS_KEY, data);
    rebuildCatalog(data);
    return data;
  },
  clear() {
    rawStore.remove(BLHS_KEY);
    rebuildCatalog(null);
  },
};
{
  const saved = officialBlhs.get();
  if (saved?.articles) rebuildCatalog(saved);
}
