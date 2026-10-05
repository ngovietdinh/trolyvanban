// Lưu trữ hồ sơ vụ án, người tham gia tố tụng, kế hoạch hỏi và biên bản (trên trình duyệt).
import { store, uid } from '../lib/store.js';

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

export function deleteCase(id) {
  recordsRepo.list((r) => r.caseId === id).forEach((r) => recordsRepo.remove(r.id));
  plansRepo.list((p) => p.caseId === id).forEach((p) => plansRepo.remove(p.id));
  casesRepo.remove(id);
}
