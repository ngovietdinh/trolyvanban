// Xóa có xác nhận và nút “Hoàn tác” trên thông báo — dùng chung cho mọi loại văn bản đã tạo.
import { toast } from '../ui.js';
import { audit } from './accounts.js';

/**
 * @param ctx  ngữ cảnh ứng dụng (ctx.confirm)
 * @param {{ title?: string, message: string, items: {item: object, remove: Function, restore: Function}[], log?: string, after?: (undone?: boolean) => void, confirm?: boolean }} o
 * @returns {Promise<boolean>} đã xóa hay chưa
 */
export async function deleteWithUndo(ctx, o) {
  const items = o.items.filter((x) => x.item);
  if (!items.length) return false;
  if (o.confirm !== false && !(await ctx.confirm(o.message, { title: o.title || 'Xóa', okText: 'Xóa', danger: true }))) return false;
  items.forEach((x) => x.remove(x.item));
  if (o.log) audit(o.log, items.map((x) => x.item.title || x.item.ten || x.item.id).join(', '));
  o.after?.(false);
  toast(items.length === 1 ? 'Đã xóa' : `Đã xóa ${items.length} mục`, {
    timeout: 8000,
    action: {
      label: 'Hoàn tác',
      onClick: () => {
        items.forEach((x) => x.restore(x.item));
        o.after?.(true);
        toast('Đã khôi phục');
      },
    },
  });
  return true;
}

/** Bộ xóa/khôi phục cho một kho lưu trữ dạng { remove(id), restore(item) } hoặc { remove(id), save(item) }. */
export const repoOps = (repo) => ({
  remove: (item) => repo.remove(item.id),
  restore: (item) => (repo.restore ? repo.restore(item) : repo.save(item)),
});
