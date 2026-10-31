// Khớp cụm định tội theo ĐỘNG TỪ hành vi + ĐỐI TƯỢNG (v2.51.1): cụm của Bộ luật "làm giả tài liệu" được hiểu là nhóm động từ
// LÀM GIẢ (làm giả, giả mạo, làm sai lệch, sửa chữa, chỉnh sửa, tẩy xóa, thay đổi nội dung…) + nhóm đối tượng TÀI LIỆU (tài liệu,
// giấy tờ, hồ sơ, số liệu, dữ liệu, sổ sách…). Nội dung "chỉnh sửa dữ liệu quan trắc" vì thế khớp Điều 341 / 359 dù không trùng chữ.
// Khớp tương đương luôn là căn cứ PHỤ (không tự đủ, trọng số ≤ 2): phải đi cùng cụm khác, hoặc với nhóm LÀM GIẢ thì đi cùng dấu hiệu
// trái pháp luật trong cùng cảnh ("trái pháp luật", "khống", "không đúng thực tế", "dưới ngưỡng cho phép"…).
import { rx } from './lexicon.js';

const B = (alt) => `(?<![\\p{L}\\p{M}])(?:${alt})(?![\\p{L}\\p{M}])`;
const alt = (arr) => arr.map((w) => w.replace(/ /g, '\\s+')).join('|');

/** Dấu hiệu trái pháp luật đi kèm hành vi nhóm LÀM GIẢ (sửa dữ liệu có thể hợp pháp — chỉ là căn cứ khi có dấu hiệu này). */
export const ILLEGAL_CUE = /trái (?:pháp luật|quy định|quy trình)|không đúng (?:thực tế|sự thật|quy định|thẩm quyền)|sai (?:sự thật|lệch|quy định|thực tế)|\bgiả\b|khống|gian dối|che giấu|qua mặt|đối phó|hợp thức hóa|hợp thức hoá|dưới ngưỡng|đạt chuẩn|cho đạt|cho khớp|không có thật|không được phép|không ngăn chặn/iu;

/** Nhóm động từ hành vi: id → các cách nói tương đương (thứ tự không quan trọng; khớp dài trước). */
export const VERB_CLASSES = {
  lam_gia: ['làm giả', 'giả mạo', 'ngụy tạo', 'làm khống', 'lập khống', 'ký khống', 'kê khống', 'làm sai lệch', 'sửa chữa', 'chỉnh sửa', 'sửa đổi', 'sửa', 'tẩy xóa', 'tẩy', 'thay đổi nội dung', 'thay đổi', 'điều chỉnh', 'can thiệp vào', 'can thiệp', 'bóp méo', 'làm sai', 'cạo sửa', 'ghép', 'chế'],
  su_dung: ['sử dụng', 'dùng', 'xài', 'đem dùng', 'xuất trình', 'nộp'],
  chiem_doat: ['chiếm đoạt', 'chiếm giữ', 'biển thủ', 'rút ruột', 'bỏ túi', 'lấy trộm', 'lấy cắp', 'cuỗm', 'không trả lại', 'chiếm hữu'],
  huy_hoai: ['hủy hoại', 'phá hủy', 'đập phá', 'phá hoại', 'làm hư hỏng', 'đốt cháy', 'đốt', 'đập nát', 'cắt phá'],
  de_doa: ['đe dọa', 'dọa', 'uy hiếp', 'hăm dọa', 'dọa nạt', 'khống chế', 'dọa giết'],
  dua_hoi_lo: ['đưa hối lộ', 'chung chi', 'lót tay', 'đưa phong bì', 'biếu', 'bồi dưỡng', 'chi tiền cho', 'đưa tiền cho'],
  nhan_hoi_lo: ['nhận hối lộ', 'nhận phong bì', 'vòi tiền', 'đòi tiền', 'nhận bồi dưỡng', 'nhận tiền của', 'nhận quà của'],
  mua_ban: ['mua bán', 'buôn bán', 'bán', 'tiêu thụ', 'rao bán', 'giao bán', 'phân phối', 'bán lại', 'cung cấp'],
  van_chuyen: ['vận chuyển', 'chở', 'đưa đi', 'chuyển', 'mang theo', 'mang', 'đem'],
  tang_tru: ['tàng trữ', 'cất giấu', 'cất giữ', 'giấu', 'lưu giữ'],
  lua_doi: ['lừa dối', 'lừa đảo', 'lừa gạt', 'lừa', 'gian dối', 'nói dối', 'bịa đặt', 'bịa', 'đưa thông tin sai'],
  can_tro: ['cản trở', 'ngăn cản', 'chống đối', 'chống lại', 'không chấp hành', 'không cho'],
  loi_dung_chuc_vu: ['lợi dụng chức vụ', 'lợi dụng quyền hạn', 'lạm dụng chức vụ', 'lạm quyền', 'vượt quá quyền hạn', 'lợi dụng vị trí'],
  xam_nhap: ['xâm nhập', 'truy cập trái phép', 'đột nhập', 'hack', 'bẻ khóa'],
  phat_tan: ['phát tán', 'lan truyền', 'đăng tải', 'đăng', 'tung', 'chia sẻ', 'rải', 'phát'],
};
/** Nhóm đối tượng: nhóm nhỏ, cùng bản chất (hồ sơ/số liệu ≠ con dấu ≠ chữ ký) để "chỉnh sửa dữ liệu" không bị coi là "làm giả con dấu". */
export const OBJECT_CLASSES = {
  ho_so: ['tài liệu', 'giấy tờ', 'hồ sơ', 'văn bản', 'sổ sách', 'chứng từ', 'hóa đơn', 'báo cáo', 'biên bản', 'số liệu', 'dữ liệu', 'kết quả', 'thông số', 'chỉ số', 'nhật ký', 'bảng kê', 'danh sách', 'phiếu'],
  con_dau: ['con dấu', 'dấu'],
  chu_ky: ['chữ ký'],
  giay_to_tuy_than: ['bằng cấp', 'bằng', 'chứng chỉ', 'giấy phép', 'giấy chứng nhận', 'sổ hộ khẩu', 'căn cước', 'chứng minh nhân dân', 'hộ chiếu', 'biển số', 'giấy khám sức khỏe', 'sổ đỏ'],
  tai_san: ['tài sản', 'tiền', 'tiền bạc', 'xe', 'xe máy', 'ô tô', 'điện thoại', 'vàng', 'đất', 'nhà', 'hàng hóa', 'hàng', 'tài khoản', 'túi xách', 'ví', 'máy tính', 'laptop'],
  hang_cam: ['ma túy', 'ma tuý', 'heroin', 'thuốc phiện', 'cần sa', 'ma túy đá', 'ma túy tổng hợp', 'vũ khí', 'súng', 'đạn', 'vật liệu nổ', 'thuốc nổ', 'pháo', 'hàng cấm', 'hàng giả', 'hàng lậu', 'động vật hoang dã', 'gỗ', 'thuốc lá lậu'],
  nguoi: ['người', 'bị hại', 'nạn nhân', 'chị', 'anh', 'ông', 'bà', 'cháu', 'em', 'con', 'vợ', 'chồng', 'cán bộ'],
  mang: ['mạng', 'hệ thống', 'máy chủ', 'tài khoản', 'website', 'phần mềm', 'cơ sở dữ liệu', 'camera', 'thiết bị'],
  thong_tin: ['thông tin', 'hình ảnh', 'video', 'clip', 'bài viết', 'tin', 'nội dung', 'bí mật'],
};
// Từ trung tính trong phần đối tượng (bỏ qua khi xét đối tượng có bị giới hạn thêm hay không): "nội dung giấy tờ" = giấy tờ.
const NEUTRAL = new Set(['nội dung', 'của', 'khác', 'các', 'những', 'một', 'số', 'về', 'trong', 'cho', 'đó', 'này']);

const VC = Object.entries(VERB_CLASSES).map(([id, ws]) => ({ id, ws: [...ws].sort((a, b) => b.length - a.length) }));
const OC = Object.entries(OBJECT_CLASSES).map(([id, ws]) => ({ id, ws: [...ws].sort((a, b) => b.length - a.length) }));
const norm = (s) => String(s || '').normalize('NFC').toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();

/**
 * Phân tích cụm định tội "động từ + đối tượng": "làm giả con dấu" → { v: 'lam_gia', o: 'tai_lieu', verb: 'làm giả', obj: 'con dấu' }.
 * Trả về null khi cụm không bắt đầu bằng động từ của một nhóm hoặc phần còn lại không chứa đối tượng của nhóm nào.
 */
export function parseAct(phrase) {
  const p = norm(phrase);
  for (const vc of VC) {
    for (const v of vc.ws) {
      if (p === v || !p.startsWith(v + ' ')) continue;
      const rest = p.slice(v.length + 1);
      for (const oc of OC) {
        for (const o of oc.ws) {
          if (!new RegExp(`(?:^|\\s)${o.replace(/ /g, '\\s+')}(?:\\s|$)`, 'u').test(rest)) continue;
          // Đối tượng có giới hạn thêm ("chứng từ thanh toán", "kết quả bầu cử", "con dấu của cơ quan") → chỉ đổi động từ, giữ nguyên
          // đối tượng; đối tượng trần ("tài liệu", "giấy tờ") → chấp nhận cả nhóm đối tượng.
          let extra = ` ${rest.replace(o, ' ')} `;
          for (const n of NEUTRAL) extra = extra.replace(new RegExp(`\\s${n.replace(/ /g, '\\s+')}(?=\\s)`, 'gu'), ' ');
          const bare = !extra.trim();
          return { v: vc.id, o: oc.id, verb: v, obj: o, literal: bare ? null : rest };
        }
      }
      return null;
    }
  }
  return null;
}
// Động từ "yếu" của nhóm làm giả: tự nó có thể hợp pháp (sửa hồ sơ, điều chỉnh số liệu) → chỉ tính khi cùng câu/cảnh có dấu hiệu trái pháp luật.
export const WEAK_FALSIFY = new Set(['sửa chữa', 'chỉnh sửa', 'sửa đổi', 'sửa', 'thay đổi nội dung', 'thay đổi', 'điều chỉnh', 'can thiệp vào', 'can thiệp', 'ghép', 'chế', 'làm sai']);
const STRONG_FALSIFY = VERB_CLASSES.lam_gia.filter((v) => !WEAK_FALSIFY.has(v));
/** Động từ vừa khớp có cần dấu hiệu trái pháp luật đi kèm không. */
export const needsCue = (v, matchedText) => v === 'lam_gia' && !new RegExp(`^(?:${alt(STRONG_FALSIFY)})(?![\\p{L}])`, 'iu').test(String(matchedText || '').trim());
const RE_CACHE = new Map();
export const verbAlt = (v) => alt(VERB_CLASSES[v]);
/** Nguồn regex cho bộ nhận diện: nhóm làm giả + đối tượng; động từ yếu phải có dấu hiệu trái pháp luật trong cùng câu. */
export function falsifySrc(objIds) {
  const objs = objIds.map((o) => objAlt(o)).join('|');
  const gap = `(?:\\s+[\\p{L}\\p{N}]+){0,3}?\\s+`;
  const cue = ILLEGAL_CUE.source;
  return `(?:${B(alt(STRONG_FALSIFY))}${gap}${B(objs)}|(?:(?<=(?:${cue})[\\s\\S]*)|(?=[\\s\\S]*(?:${cue})))${B(alt([...WEAK_FALSIFY]))}${gap}${B(objs)})`;
}
export const objAlt = (o) => alt(OBJECT_CLASSES[o]);
/** Biểu thức khớp "động từ nhóm v + (tối đa 3 từ) + đối tượng" (nhóm o, hoặc nguyên văn literal khi đối tượng có giới hạn thêm). */
export function actRegex(act) {
  const k = `${act.v}|${act.literal || act.o}`;
  if (!RE_CACHE.has(k)) RE_CACHE.set(k, rx(`${B(verbAlt(act.v))}(?:\\s+[\\p{L}\\p{N}]+){0,3}?\\s+${act.literal ? B(act.literal.replace(/ /g, '\\s+')) : B(objAlt(act.o))}`, 'iu'));
  return RE_CACHE.get(k);
}
export const ACT_LABEL = { lam_gia: 'làm giả / làm sai lệch', su_dung: 'sử dụng', chiem_doat: 'chiếm đoạt', huy_hoai: 'hủy hoại', de_doa: 'đe dọa', dua_hoi_lo: 'đưa hối lộ', nhan_hoi_lo: 'nhận hối lộ', mua_ban: 'mua bán', van_chuyen: 'vận chuyển', tang_tru: 'tàng trữ', lua_doi: 'lừa dối', can_tro: 'cản trở', loi_dung_chuc_vu: 'lợi dụng chức vụ, quyền hạn', xam_nhap: 'xâm nhập', phat_tan: 'phát tán' };
