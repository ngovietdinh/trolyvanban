// Nhận biết đang chạy trong bộ cài đặt máy tính (Windows/macOS) hay trên trình duyệt.
// Bản cài đặt nạp preload gắn `window.tlvbDesktop`; trên web giá trị này không tồn tại.
export const desktop = (typeof window !== 'undefined' && window.tlvbDesktop) || null;
export const isDesktop = !!desktop;
