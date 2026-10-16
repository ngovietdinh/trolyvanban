// Điện thoại chủ yếu để XEM, TRA CỨU (không phải nơi làm việc trực tiếp).
// viewMode(): đang ở chế độ xem trên điện thoại — ẩn nút sửa / xóa / thêm, mở biên bản, văn bản dạng bản đọc.
import { store } from './store.js';

export const PHONE_QUERY = '(max-width: 760px)';
export const isPhone = () => typeof matchMedia === 'function' && matchMedia(PHONE_QUERY).matches;
export const viewMode = () => isPhone() && store.get('phone-mode', 'xem') !== 'sua';
