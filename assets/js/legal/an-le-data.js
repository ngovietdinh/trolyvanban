// Toàn văn 90 án lệ kèm phần mềm (assets/data/an-le.json) — lấy từ Cổng thông tin điện tử về án lệ của Tòa án nhân dân
// tối cao (anle.toaan.gov.vn): số, tên, lĩnh vực, ngày thông qua / công bố / áp dụng, nguồn án lệ, vị trí nội dung, tình
// huống, giải pháp pháp lý, quy định pháp luật liên quan, từ khóa và toàn văn. Án lệ là văn bản của Nhà nước, không thuộc
// phạm vi bảo hộ quyền tác giả. Tệp ~2 MB nên chỉ tải khi cần (trang Án lệ, tab Bản án tương tự) và giữ trong bộ nhớ.
let cache = null;
let pending = null;

/** Tải một lần: Map số án lệ → bản ghi. Lỗi mạng / thiếu tệp → Map rỗng (giao diện tự ghi "chưa có"). */
export function loadAnLeData() {
  if (cache) return Promise.resolve(cache);
  pending ??= fetch(new URL('../../data/an-le.json', import.meta.url))
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((arr) => {
      cache = new Map((Array.isArray(arr) ? arr : []).map((a) => [a.so, a]));
      return cache;
    });
  return pending;
}

/** Bản ghi đã tải (đồng bộ) hoặc null khi chưa tải. */
export const anLeDataSync = () => cache;

/** Bản ghi kho (loại 'an-le') dựng từ dữ liệu kèm phần mềm — cùng dạng với parseKhoDoc để thẩm tra dùng chung. */
export function khoDocFromData(a, dieu = []) {
  return {
    loai: 'an-le',
    so: a.so,
    ten: a.ten,
    khaiQuat: a.khaiQuat || [a.tinhHuong && `Tình huống án lệ: ${a.tinhHuong}`, a.giaiPhap && `Giải pháp pháp lý: ${a.giaiPhap}`].filter(Boolean).join('\n'),
    giaiPhap: a.giaiPhap || '',
    dieu: [...new Set([...(dieu || []), ...(a.dieu || [])])],
    name: `Án lệ ${a.so} (TANDTC)`,
    nguon: 'tandtc',
    url: a.url || '',
    text: a.text || '',
  };
}
