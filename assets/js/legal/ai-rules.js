// Quy tắc gửi cho AI (dùng chung cho sơ đồ vụ việc, phân tích lời khai, phân tích vụ án).
// Mục tiêu: chính xác (không bịa, đúng nguyên văn, điều luật có căn cứ), không trùng lặp, nhanh, ít token.
// Các quy tắc đặt ở phần CỐ ĐỊNH của lời nhắc (system + đầu nội dung) để được đọc lại từ cache; kết quả AI vẫn được
// máy kiểm tra lại (verifyAiAgainstSource, lawGate) — quy tắc không thay thế việc kiểm tra.
export const RULE = {
  nguon: 'NGUỒN: chỉ dùng nội dung được cung cấp; không thêm diễn biến, tình tiết hay kiến thức bên ngoài; không đoán ý định, không suy luận thay người khai.',
  nguyenVan: 'NGUYÊN VĂN: họ tên đầy đủ (họ, tên đệm, tên), chức vụ, số tiền, thời gian, trích dẫn phải chép đúng như trong nội dung — không rút gọn, làm tròn, quy đổi hay tự điền; chưa có thì để trống. Người chỉ có tên gọi (“ông An”) mà nội dung chưa có họ tên đầy đủ thì KHÔNG đưa vào.',
  trung: 'KHÔNG TRÙNG LẶP: một sự việc một mục — gộp các câu, các lời khai cùng nói về một việc; khoản tiền được nhắc lại nhiều lần (nêu tổng rồi chi tiết, nhiều người cùng khai) chỉ ghi một lần và không cộng dồn; một người, một quan hệ chỉ xuất hiện một lần.',
  tien: 'DÒNG TIỀN: mỗi khoản = người đưa → người nhận + số tiền nguyên văn + (nếu có) thời điểm, mục đích + trích dẫn nguyên văn câu nói về khoản đó. Số tiền rút, thu, chi chung chưa nói đưa cho ai KHÔNG phải dòng tiền giữa hai người. Chỉ ghi khoản mà người khai nói đã xảy ra: lời phủ nhận (“không nhận…”) không phải dòng tiền; “nghe nói”, “hình như” không ghi; không suy ra tiền chuyển tiếp qua người khác nếu không ai khai như vậy. Hai lời khai nêu khác nhau về cùng khoản → ghi cả hai ở "chuaRo", không chọn bên nào.',
  luat: 'ĐIỀU LUẬT: chỉ chọn điều trong DANH MỤC. Chỉ gán một điều cho hành vi khi đủ cả ba: (1) hành vi trong nội dung khớp dấu hiệu khách quan của điều đó, (2) chủ thể phù hợp (tội về chức vụ cần người có chức vụ, quyền hạn được nêu trong nội dung), (3) có trích dẫn nguyên văn làm căn cứ. Thiếu một điều kiện → để "dieu" rỗng (không gán đại). Không liệt kê điều “để tham khảo”, không gán nhiều điều cho một hành vi trừ khi hành vi đó thật sự thỏa mãn từng điều; đọc mục PHÂN BIỆT để chọn đúng điều dễ nhầm.',
  banChat: 'BẢN CHẤT: nêu ai (họ tên đầy đủ, chức vụ nguyên văn) đã làm gì, với ai, bao nhiêu tiền, khi nào, bằng cách nào; phân biệt “theo lời khai của X” với điều nhiều nguồn cùng nêu; điều còn thiếu hoặc mâu thuẫn ghi ở "chuaRo", không đoán.',
  gon: 'GỌN: chỉ trả về JSON hợp lệ, không giải thích; mỗi hành vi ≤ 20 từ, trích dẫn ≤ 40 từ; không có thì để mảng rỗng.',
};

/** Ghép các quy tắc (đánh số) theo thứ tự đã chọn. */
export const rules = (...keys) => keys.map((k, i) => `${i + 1}. ${RULE[k]}`).join('\n');
