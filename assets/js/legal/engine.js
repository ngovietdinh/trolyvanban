// Bộ máy sinh "vấn đề cần làm rõ" và "bộ câu hỏi" cho từng hành vi vi phạm.
// Mô hình kết hợp 4 lớp tri thức:
//   (1) Luật hình sự — cấu thành tội phạm của từng điều luật, tình tiết định khung, Điều 51, 52 BLHS;
//   (2) Luật tố tụng — các vấn đề phải chứng minh (Điều 85 BLTTHS), quyền của từng người tham gia tố tụng;
//   (3) Nghiệp vụ điều tra — kỹ thuật hỏi 5W1H, làm rõ đồng phạm, dòng tiền, tài liệu, vật chứng;
//   (4) Chuyên môn ngành — câu hỏi của chuyên gia tài chính, đấu thầu, xây dựng, môi trường, y tế…
// Kết quả luôn có thể chỉnh sửa; câu hỏi người dùng bổ sung được lưu thành “bộ câu hỏi của tôi”.

import { CRIMES_KINH_TE, GROUPS_KINH_TE } from './crimes-kinh-te.js';
import { CRIMES_CHUC_VU, GROUPS_CHUC_VU } from './crimes-chuc-vu.js';
import { CRIMES_MOI_TRUONG, GROUPS_MOI_TRUONG, CRIMES_Y_TE, GROUPS_Y_TE } from './crimes-moi-truong-y-te.js';
import { EXPERTISE, DOMAIN_QUESTIONS } from './expertise.js';
import { getRole } from './roles.js';
import { CATALOG, CHAPTERS, chapterOf } from './blhs-catalog.js';
import { NEW_DOMAINS, EXTRA_GROUPS, EXTRA_EXPERTISE, EXTRA_DOMAIN_QUESTIONS, generateCrime } from './crimes-generated.js';

Object.assign(EXPERTISE, EXTRA_EXPERTISE);
Object.assign(DOMAIN_QUESTIONS, EXTRA_DOMAIN_QUESTIONS);

/** Lĩnh vực có dữ liệu chuyên sâu (biên soạn chi tiết từng hành vi). */
const CURATED_DOMAINS = [
  { id: 'kinh-te', ten: 'Kinh tế', icon: 'chart', moTa: 'Trật tự quản lý kinh tế, sở hữu, thuế, ngân hàng, đấu thầu, đất đai', groups: GROUPS_KINH_TE, crimes: CRIMES_KINH_TE },
  { id: 'chuc-vu', ten: 'Chức vụ – Tham nhũng', icon: 'gavel', moTa: 'Tham ô, hối lộ, lạm dụng, lợi dụng chức vụ, thiếu trách nhiệm', groups: GROUPS_CHUC_VU, crimes: CRIMES_CHUC_VU },
  { id: 'moi-truong', ten: 'Môi trường', icon: 'layers', moTa: 'Ô nhiễm, chất thải, rừng, động vật hoang dã, dịch bệnh, thiên tai', groups: GROUPS_MOI_TRUONG, crimes: CRIMES_MOI_TRUONG },
  { id: 'y-te-an-toan', ten: 'Y tế – An toàn công cộng', icon: 'shield', moTa: 'Khám chữa bệnh, thực phẩm, lao động, xây dựng, PCCC, vũ khí, vật liệu nổ, khủng bố', groups: [...GROUPS_Y_TE, ...EXTRA_GROUPS['y-te-an-toan']], crimes: CRIMES_Y_TE },
];
const CURATED_CRIMES = Object.fromEntries(CURATED_DOMAINS.map((d) => [d.id, d.crimes]));

/** Thứ tự lĩnh vực theo các chương của Phần thứ hai Bộ luật Hình sự. */
const ORDER = ['an-ninh', 'tinh-mang', 'tu-do', 'so-huu', 'hon-nhan', 'kinh-te', 'moi-truong', 'ma-tuy', 'giao-thong', 'cong-nghe', 'y-te-an-toan', 'trat-tu', 'hanh-chinh', 'chuc-vu', 'tu-phap', 'quan-nhan', 'chien-tranh'];
const byId = Object.fromEntries([...CURATED_DOMAINS, ...NEW_DOMAINS].map((d) => [d.id, { ...d, crimes: [] }]));
export const DOMAINS = ORDER.map((id) => byId[id]);

const ALL = [];
export const ALL_CRIMES = ALL;
/** Điều luật có trong danh mục nhưng chưa có tên (chờ nạp văn bản luật) và điều đã bãi bỏ. */
export const CATALOG_STATUS = { hidden: [], repealed: [], official: null };

/**
 * Dựng (lại) toàn bộ cây: dữ liệu chuyên sâu + danh mục Bộ luật (+ nguyên văn chính thức nếu đã nạp).
 * Mảng DOMAINS[*].crimes và ALL_CRIMES được cập nhật tại chỗ để các màn hình dùng chung tham chiếu.
 */
export function rebuildCatalog(official = null) {
  const arts = official?.articles || {};
  const curatedIds = new Set(Object.values(CURATED_CRIMES).flatMap((l) => l.map((c) => c.dieu)));
  for (const d of DOMAINS) d.crimes.length = 0;
  CATALOG_STATUS.hidden = [];
  CATALOG_STATUS.repealed = [];
  CATALOG_STATUS.official = official ? { importedAt: official.importedAt, source: official.source, count: Object.keys(arts).length } : null;
  // 1. Dữ liệu chuyên sâu — gắn nguyên văn điều luật nếu có.
  for (const [domainId, list] of Object.entries(CURATED_CRIMES)) {
    for (const c of list) byId[domainId].crimes.push(arts[c.dieu] ? { ...c, nguyenVan: arts[c.dieu].text, tenChinhThuc: arts[c.dieu].ten } : c);
  }
  // 2. Danh mục Bộ luật + điều chỉ có trong văn bản chính thức (vd: điều mới bổ sung).
  const entries = new Map(CATALOG.map((e) => [e[0], e]));
  for (const dieu of Object.keys(arts)) {
    if (!entries.has(dieu) && chapterOf(dieu)) {
      const dom = byId[CHAPTERS[chapterOf(dieu)].linhVuc];
      entries.set(dieu, [dieu, arts[dieu].ten, dom.groups[0].id, '']);
    }
  }
  for (const e of entries.values()) {
    const [dieu, ten, , flags = ''] = e;
    if (curatedIds.has(dieu)) continue;
    const off = arts[dieu];
    if (off?.baiBo || (!off && flags.includes('b'))) {
      CATALOG_STATUS.repealed.push(dieu);
      continue;
    }
    if (!ten && !off?.ten) {
      CATALOG_STATUS.hidden.push(dieu);
      continue;
    }
    const domainId = CHAPTERS[chapterOf(dieu)]?.linhVuc;
    if (!byId[domainId]) continue;
    const crime = generateCrime(e, off || null);
    if (off) crime.nguyenVan = off.text;
    if (!byId[domainId].groups.some((g) => g.id === crime.nhom)) crime.nhom = byId[domainId].groups[0].id;
    byId[domainId].crimes.push(crime);
  }
  const num = (d) => parseInt(d, 10) + (/[a-z]$/.test(d) ? 0.5 : 0);
  for (const d of DOMAINS) d.crimes.sort((a, b) => num(a.dieu) - num(b.dieu));
  ALL.length = 0;
  for (const d of DOMAINS) for (const c of d.crimes) ALL.push({ ...c, linhVuc: d.id });
  return ALL.length;
}
rebuildCatalog();

export const findCrime = (dieu) => ALL.find((c) => c.dieu === String(dieu)) || null;
export const getDomain = (id) => DOMAINS.find((d) => d.id === id) || null;
export const crimesOfGroup = (domainId, groupId) => (getDomain(domainId)?.crimes || []).filter((c) => c.nhom === groupId);

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

/** Tìm tội danh theo số điều, tên tội, tên hành vi (không phân biệt dấu). */
export function searchCrimes(q) {
  const n = norm(q).trim();
  if (!n) return [];
  const num = n.replace(/^dieu\s*/, '');
  return ALL.map((c) => {
    let score = 0;
    if (c.dieu === num) score += 100;
    if (norm(c.ten).includes(n)) score += 40;
    if (c.hanhVi.some((h) => norm(h.ten).includes(n))) score += 20;
    if (norm(c.dauHieu.join(' ')).includes(n)) score += 5;
    return { c, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

/** Cấu trúc cây: lĩnh vực → nhóm → tội danh → hành vi. */
export function buildTree() {
  return DOMAINS.map((d) => ({
    id: d.id,
    ten: d.ten,
    icon: d.icon,
    children: d.groups
      .map((g) => ({
        id: `${d.id}/${g.id}`,
        ten: g.ten,
        moTa: g.moTa,
        children: d.crimes.filter((c) => c.nhom === g.id).map((c) => ({ id: c.dieu, ten: `Điều ${c.dieu}. ${c.ten.replace(/^Tội /, '')}`, children: c.hanhVi.map((h) => ({ id: `${c.dieu}:${h.id}`, ten: h.ten })) })),
      }))
      .filter((g) => g.children.length),
  }));
}

/* ------------------------------------------------------------------ */
/* Mẫu câu hỏi theo nhóm vấn đề, có biến thể theo đối tượng lời khai.  */
/* ------------------------------------------------------------------ */

const isSuspect = (role) => role.nhom === 'nghi-pham';
const isVictim = (role) => role.nhom === 'bi-hai';
const rv = (role, { suspect, witness, victim }) => (isSuspect(role) ? suspect : isVictim(role) ? victim ?? witness : witness);

let seq = 0;
const q = (text, src = 'nghiep-vu', priority = 'normal') => ({ id: `q${++seq}`, text, src, priority });
const issue = (key, tieuDe, canCu, moTa, cauHoi) => ({ id: key, key, tieuDe, canCu, moTa, cauHoi: cauHoi.filter(Boolean) });

function issueNhanThan(crime, role) {
  const list = [];
  if (isSuspect(role)) {
    list.push(q('Đề nghị trình bày lý lịch: họ tên, ngày sinh, nơi sinh, nơi cư trú, trình độ học vấn, nghề nghiệp, hoàn cảnh gia đình.', 'tu-tung'));
    list.push(q('Bản thân đã từng bị xử phạt vi phạm hành chính, xử lý kỷ luật, bị kết án lần nào chưa? Đã được xóa án tích chưa?', 'luat', 'high'));
    list.push(q('Tình trạng sức khỏe hiện nay; có mắc bệnh làm mất khả năng nhận thức, điều khiển hành vi không?', 'luat'));
    if (/chức vụ|có trách nhiệm|chủ thể đặc biệt|người được giao/i.test(crime.chuThe)) {
      list.push(q('Quá trình công tác; tại thời điểm xảy ra sự việc giữ chức vụ gì, được phân công nhiệm vụ, quyền hạn cụ thể nào, theo văn bản nào?', 'luat', 'high'));
    }
    if (crime.phapNhan) list.push(q('Vai trò của bản thân trong pháp nhân thương mại (người đại diện theo pháp luật, người quản lý, người được ủy quyền); hành vi được thực hiện nhân danh và vì lợi ích của pháp nhân hay cá nhân?', 'luat'));
  } else {
    list.push(q(rv(role, { witness: 'Đề nghị trình bày lý lịch; mối quan hệ của anh/chị với những người liên quan đến vụ việc (họ hàng, đồng nghiệp, đối tác…)?', victim: 'Đề nghị trình bày lý lịch; anh/chị (hoặc cơ quan, tổ chức anh/chị đại diện) có quan hệ thế nào với người gây thiệt hại?' }), 'tu-tung'));
    list.push(q('Anh/chị biết được sự việc trong hoàn cảnh nào: trực tiếp chứng kiến, tham gia, hay được người khác kể lại (ai kể, khi nào)?', 'tu-tung', 'high'));
  }
  return issue('nhan-than', isSuspect(role) ? 'Nhân thân và năng lực trách nhiệm hình sự' : 'Nhân thân, mối quan hệ và nguồn gốc hiểu biết', isSuspect(role) ? 'Điều 85 khoản 2, 3 BLTTHS; Điều 12, 21 BLHS' : 'Điều 85 BLTTHS', isSuspect(role) ? 'Xác định chủ thể của tội phạm: tuổi, năng lực TNHS, dấu hiệu chủ thể đặc biệt.' : 'Đánh giá giá trị chứng minh và độ tin cậy của lời khai.', list);
}

function issueHanhVi(crime, hanhVi, role) {
  const list = [
    q(rv(role, { suspect: `Anh/chị trình bày toàn bộ diễn biến việc “${hanhVi.ten.toLowerCase()}”: thời gian, địa điểm, cách thức thực hiện, theo trình tự từ đầu đến cuối.`, witness: `Anh/chị biết gì về việc “${hanhVi.ten.toLowerCase()}”? Trình bày cụ thể thời gian, địa điểm, những người tham gia và cách thức thực hiện.`, victim: `Anh/chị trình bày diễn biến sự việc “${hanhVi.ten.toLowerCase()}” mà anh/chị là người bị thiệt hại: thời gian, địa điểm, ai thực hiện, thực hiện ra sao.` }), 'nghiep-vu', 'high'),
    ...hanhVi.cauHoi.map((t) => q(t, 'luat', 'high')),
    q(rv(role, { suspect: 'Ai là người đề xuất, ai quyết định, ai trực tiếp thực hiện từng phần việc nêu trên?', witness: 'Những ai đã tham gia, mỗi người làm gì; ai là người chỉ đạo?' }), 'nghiep-vu'),
    q('Có tài liệu, tin nhắn, email, ghi âm, hình ảnh nào ghi nhận lại việc này không? Hiện ai đang lưu giữ?', 'nghiep-vu'),
  ];
  return issue(`hv-${hanhVi.id}`, `Hành vi: ${hanhVi.ten}`, `Điều ${crime.dieu} BLHS — mặt khách quan`, 'Làm rõ thời gian, địa điểm, phương thức, thủ đoạn, công cụ, diễn biến của hành vi phạm tội (Điều 85 khoản 1 BLTTHS).', list);
}

function issueHauQua(crime, role) {
  const list = [
    q(rv(role, { suspect: 'Theo anh/chị, việc làm trên đã gây ra thiệt hại gì, cho ai, giá trị bao nhiêu? Căn cứ nào để xác định?', witness: 'Anh/chị biết việc làm trên gây ra thiệt hại gì, cho ai, giá trị bao nhiêu?', victim: 'Anh/chị (hoặc cơ quan, tổ chức) bị thiệt hại những gì: tiền, tài sản, sức khỏe, uy tín? Giá trị cụ thể, căn cứ xác định?' }), 'luat', 'high'),
    q('Thiệt hại phát sinh vào thời điểm nào; đã được khắc phục (nộp lại, bồi thường, thu hồi) đến đâu?', 'luat'),
    ...crime.dauHieu.filter((d) => /thiệt hại|giá trị|trị giá|khối lượng|hậu quả|chết người|thương tích|diện tích|số tiền|vượt/i.test(d)).map((d) => q(`Làm rõ dấu hiệu định tội: ${d.charAt(0).toLowerCase() + d.slice(1)}.`, 'luat', 'high')),
  ];
  if (isVictim(role)) list.push(q('Anh/chị có yêu cầu bồi thường không? Mức yêu cầu và căn cứ? Có đề nghị áp dụng biện pháp bảo đảm bồi thường không?', 'tu-tung', 'high'));
  return issue('hau-qua', 'Hậu quả, thiệt hại và mối quan hệ nhân quả', 'Điều 85 khoản 4 BLTTHS', 'Tính chất, mức độ thiệt hại do hành vi gây ra; mối quan hệ nhân quả giữa hành vi và hậu quả — căn cứ định tội và định khung.', list);
}

function issueChuQuan(crime, role) {
  const voY = /vô ý/i.test(crime.loi) && !/cố ý/i.test(crime.loi.replace(/vô ý/gi, ''));
  const list = isSuspect(role)
    ? [
        voY
          ? q('Khi thực hiện công việc, anh/chị có biết quy định, quy trình phải tuân thủ không? Vì sao không thực hiện đúng? Anh/chị có thấy trước được hậu quả có thể xảy ra không?', 'luat', 'high')
          : q('Tại thời điểm thực hiện, anh/chị có biết việc làm đó là trái quy định không? Quy định nào? Ai đã phổ biến, nhắc nhở?', 'luat', 'high'),
        voY ? null : q('Mục đích, động cơ của anh/chị khi thực hiện hành vi là gì? Bản thân được hưởng lợi gì (tiền, tài sản, lợi ích khác), nhận khi nào, từ ai?', 'luat', 'high'),
        q('Có ai chỉ đạo, ép buộc, đe dọa hoặc hứa hẹn lợi ích để anh/chị thực hiện không?', 'luat'),
      ]
    : [
        q('Theo anh/chị biết, người thực hiện có biết việc làm đó là trái quy định không? Căn cứ vào đâu anh/chị cho là như vậy?', 'luat'),
        q('Người thực hiện được hưởng lợi gì từ việc làm đó; anh/chị có chứng kiến việc giao nhận tiền, tài sản, lợi ích không?', 'luat', 'high'),
      ];
  return issue('chu-quan', 'Lỗi, động cơ, mục đích', `Điều 85 khoản 2 BLTTHS; Điều 10, 11 BLHS — ${crime.loi}`, 'Xác định lỗi (cố ý/vô ý), động cơ (vụ lợi, cá nhân khác), mục đích phạm tội.', list);
}

function issueDongPham(role) {
  const list = isSuspect(role)
    ? [
        q('Những ai cùng tham gia? Đã bàn bạc, thống nhất với nhau từ khi nào, ở đâu, nội dung bàn bạc?', 'luat', 'high'),
        q('Vai trò của từng người: ai khởi xướng, ai chỉ đạo, ai thực hiện, ai giúp sức? Lợi ích được phân chia thế nào?', 'luat', 'high'),
        q('Cấp trên, người có thẩm quyền có biết, chỉ đạo hoặc chấp thuận việc làm này không?', 'nghiep-vu'),
      ]
    : [q('Theo anh/chị biết, những ai cùng tham gia, vai trò của từng người ra sao?', 'nghiep-vu', 'high'), q('Còn ai khác biết về sự việc mà cơ quan điều tra cần lấy lời khai?', 'nghiep-vu')];
  return issue('dong-pham', 'Đồng phạm và người liên quan', 'Điều 17, 58 BLHS', 'Xác định có đồng phạm hay không; vai trò, tính chất, mức độ tham gia của từng người.', list);
}

function issueDinhKhung(crime, dinhKhung, role) {
  if (!dinhKhung.length) return null;
  const list = dinhKhung.map((d) => q(`Làm rõ tình tiết “${d}”: ${isSuspect(role) ? 'anh/chị trình bày cụ thể' : 'anh/chị biết những gì về'} các sự kiện, số liệu liên quan.`, 'luat', 'high'));
  return issue('dinh-khung', 'Tình tiết định khung tăng nặng', `Điều ${crime.dieu} BLHS — các khoản 2, 3, 4`, 'Các tình tiết làm thay đổi khung hình phạt cần được chứng minh hoặc loại trừ.', list);
}

function issueTangNangGiamNhe(role) {
  if (isVictim(role)) {
    return issue('y-kien-bi-hai', 'Ý kiến, yêu cầu của bị hại', 'Điều 62 BLTTHS; Điều 51 BLHS', 'Yêu cầu bồi thường, việc đã được khắc phục, đề nghị về xử lý.', [
      q('Người gây thiệt hại đã bồi thường, khắc phục cho anh/chị chưa? Số tiền, thời điểm?', 'luat'),
      q('Anh/chị có đề nghị gì về việc xử lý người gây thiệt hại?', 'tu-tung'),
    ]);
  }
  if (!isSuspect(role)) return null;
  return issue('tang-nang-giam-nhe', 'Tình tiết tăng nặng, giảm nhẹ, nhân thân', 'Điều 85 khoản 3 BLTTHS; Điều 51, 52 BLHS', 'Thu thập tình tiết có lợi và bất lợi cho người bị buộc tội một cách khách quan.', [
    q('Anh/chị đã tự nguyện khắc phục hậu quả, nộp lại tiền, tài sản chưa? Số tiền, thời điểm, nộp ở đâu?', 'luat'),
    q('Anh/chị có thành khẩn khai báo, ăn năn hối cải; có tự thú hoặc tích cực giúp đỡ cơ quan điều tra phát hiện tội phạm không?', 'luat'),
    q('Bản thân hoặc gia đình có thành tích, khen thưởng, có công với cách mạng, hoàn cảnh đặc biệt khó khăn không? Có giấy tờ chứng minh không?', 'luat'),
    q('Trước đó anh/chị đã thực hiện hành vi tương tự lần nào chưa (phạm tội nhiều lần, có tính chất chuyên nghiệp)?', 'luat'),
  ]);
}

function issueTaiLieu(crime, hanhViList, experts, role) {
  const docs = [...new Set([...hanhViList.flatMap((h) => h.taiLieu || []), ...experts.flatMap((e) => e.taiLieu)])];
  const list = [
    q(rv(role, { suspect: 'Anh/chị có tài liệu, đồ vật, chứng cứ nào liên quan muốn giao nộp hoặc đề nghị cơ quan điều tra thu thập không?', witness: 'Anh/chị có giữ tài liệu, hình ảnh, tin nhắn nào liên quan và đồng ý giao nộp cho cơ quan điều tra không?' }), 'tu-tung'),
    q('Tiền, tài sản có được từ vụ việc hiện ở đâu, do ai quản lý, đã chuyển đổi thành tài sản gì?', 'nghiep-vu', 'high'),
    ...docs.slice(0, 6).map((d) => q(`Xác định nơi lưu giữ, người quản lý tài liệu: ${d.charAt(0).toLowerCase() + d.slice(1)}.`, 'chuyen-mon')),
  ];
  return issue('tai-lieu', 'Tài liệu, vật chứng, tài sản và dòng tiền', 'Điều 85 BLTTHS; Điều 47, 48 BLHS', 'Định hướng thu thập chứng cứ, truy vết tài sản để thu hồi.', list);
}

function issueChuyenMon(crime, experts) {
  if (!experts.length) return null;
  const domainQ = (DOMAIN_QUESTIONS[crime.linhVuc] || []).map((t) => q(t, 'chuyen-mon'));
  const list = [...domainQ, ...experts.flatMap((e) => e.cauHoi.map((t) => q(`[${e.ten}] ${t}`, 'chuyen-mon')))];
  return issue('chuyen-mon', 'Vấn đề chuyên môn – kỹ thuật', experts.map((e) => e.ten).join('; '), 'Câu hỏi của chuyên gia ngành giúp làm rõ bản chất kỹ thuật, nghiệp vụ của hành vi.', list);
}

function issueNguyenNhan(role) {
  return issue('nguyen-nhan', 'Nguyên nhân, điều kiện phạm tội', 'Điều 85 khoản 5 BLTTHS', 'Phục vụ kiến nghị khắc phục sơ hở trong quản lý.', [
    q(rv(role, { suspect: 'Theo anh/chị, sơ hở nào trong quy trình quản lý, kiểm tra, giám sát đã tạo điều kiện cho việc này xảy ra?', witness: 'Theo anh/chị, vì sao sự việc có thể xảy ra mà không bị phát hiện kịp thời?' }), 'nghiep-vu'),
  ]);
}

function issueLoaiTru(crime, role) {
  if (!isSuspect(role)) return null;
  return issue('loai-tru', 'Căn cứ loại trừ, miễn trách nhiệm hình sự', 'Điều 85 khoản 6 BLTTHS; Điều 20–26, 29 BLHS', 'Kiểm tra các tình tiết loại trừ trách nhiệm hình sự, miễn trách nhiệm hình sự, miễn hình phạt.', [
    q('Việc làm của anh/chị có được thực hiện theo mệnh lệnh của người chỉ huy/cấp trên không? Mệnh lệnh đó được truyền đạt thế nào; anh/chị đã có ý kiến phản đối chưa?', 'luat'),
    /rủi ro|nghiên cứu|kỹ thuật|công nghệ|đầu tư|kinh doanh/i.test(crime.ten + crime.khachThe) ? q('Hành vi có thuộc trường hợp rủi ro trong nghiên cứu, thử nghiệm, áp dụng tiến bộ khoa học, kỹ thuật và công nghệ đã tuân thủ đúng quy trình không?', 'luat') : null,
  ]);
}

/* ---------------- Hành vi do người dùng tự thêm ---------------- */
let actsProvider = () => ({});
/** Đăng ký nguồn hành vi tự thêm: fn() → { [dieu]: [{ id, ten, cauHoi[], taiLieu[] }] }. */
export function registerCustomActs(fn) {
  actsProvider = fn;
}
/** Tội danh kèm hành vi tự thêm (đánh dấu custom: true). */
export function crimeWithCustomActs(dieu, customActs) {
  const base = findCrime(dieu);
  if (!base) return null;
  const extra = (customActs ?? actsProvider()[base.dieu] ?? []).map((h) => ({ cauHoi: [], taiLieu: [], ...h, custom: true }));
  return extra.length ? { ...base, hanhVi: [...base.hanhVi, ...extra] } : base;
}

/** Gợi ý câu hỏi truy tiếp cho một câu hỏi — chạy cục bộ, không cần AI. */
export function localFollowUps(question, role = 'bi-can') {
  const qtext = String(question || '').trim().replace(/[?？]+$/, '');
  const core = qtext.replace(/^(anh\/chị|anh|chị|ông|bà)\s+/i, '').replace(/^(trình bày|cho biết|hãy)\s+/i, '');
  const susp = ['bi-can', 'tam-giu', 'bi-to-giac'].includes(role);
  return [
    `Việc này diễn ra vào thời gian nào, ở đâu cụ thể; có những ai cùng có mặt?`,
    `Căn cứ, tài liệu nào chứng minh nội dung ${susp ? 'anh/chị vừa khai' : 'anh/chị vừa trình bày'}; hiện ai đang lưu giữ?`,
    core.length > 70 ? 'Ngoài anh/chị, còn những ai biết rõ về nội dung này; họ biết trong hoàn cảnh nào?' : `Ngoài anh/chị, còn ai biết rõ về việc: ${core.charAt(0).toLowerCase() + core.slice(1)}?`,
    susp ? `Vì sao anh/chị lại làm như vậy; có ai chỉ đạo, gợi ý hoặc hứa hẹn lợi ích không?` : `Vì sao anh/chị biết được nội dung này; anh/chị trực tiếp chứng kiến hay nghe người khác kể lại?`,
    `Nếu có tiền, tài sản liên quan: số lượng, giá trị bao nhiêu, giao nhận bằng hình thức nào, hiện ở đâu?`,
  ];
}

/**
 * Sinh kế hoạch hỏi.
 * @param {object} opts { dieu, hanhViIds: string[], dinhKhung: string[], roleId, custom: {[key]: string[]} }
 * @returns { crime, role, hanhVi, issues, taiLieu, giamDinh, stats }
 */
/**
 * Kế hoạch hỏi. lienQuan: các điều luật khác cùng vụ việc [{ dieu, hanhViIds }] — một người có thể thực hiện
 * nhiều hành vi thuộc nhiều điều (vd: tham ô + làm giả tài liệu). Vấn đề riêng của từng điều liên quan
 * (hành vi, mặt chủ quan) được thêm vào với khóa có tiền tố “d<điều>:”; vấn đề chung không lặp lại.
 */
export function generatePlan({ dieu, hanhViIds = [], dinhKhung = [], roleId = 'bi-can', custom = {}, customActs, learned = {}, lienQuan = [] } = {}) {
  const crime = crimeWithCustomActs(dieu, customActs);
  if (!crime) throw new Error(`Không tìm thấy Điều ${dieu}`);
  const role = getRole(roleId);
  const hanhViList = hanhViIds.length ? crime.hanhVi.filter((h) => hanhViIds.includes(h.id)) : crime.hanhVi;
  const related = (lienQuan || [])
    .filter((l) => l && String(l.dieu) !== crime.dieu)
    .map((l) => {
      const c = crimeWithCustomActs(l.dieu, customActs);
      if (!c) return null;
      const hv = (l.hanhViIds || []).length ? c.hanhVi.filter((h) => l.hanhViIds.includes(h.id)) : c.hanhVi;
      return { crime: c, hanhVi: hv };
    })
    .filter(Boolean);
  const tag = (c, is) => is && { ...is, key: `d${c.dieu}:${is.key}`, tieuDe: `[Điều ${c.dieu}] ${is.tieuDe}`, dieu: c.dieu };
  const relatedIssues = related.flatMap(({ crime: c, hanhVi }) => [...hanhVi.map((h) => tag(c, issueHanhVi(c, h, role))), tag(c, issueChuQuan(c, role))]);
  const experts = [...new Set([crime, ...related.map((r) => r.crime)].flatMap((c) => c.chuyenMon || []))].map((k) => EXPERTISE[k]).filter(Boolean);

  const issues = [
    issueNhanThan(crime, role),
    ...hanhViList.map((h) => issueHanhVi(crime, h, role)),
    ...relatedIssues,
    issueHauQua(crime, role),
    issueChuQuan(crime, role),
    issueDongPham(role),
    issueDinhKhung(crime, dinhKhung, role),
    issueChuyenMon(crime, experts),
    issueTaiLieu(crime, hanhViList, experts, role),
    issueTangNangGiamNhe(role),
    issueLoaiTru(crime, role),
    issueNguyenNhan(role),
  ].filter(Boolean);

  // Câu hỏi tùy chỉnh đã lưu của người dùng.
  for (const is of issues) {
    const saved = custom[`${crime.dieu}|${is.key}`] || [];
    saved.forEach((t) => is.cauHoi.push(q(t, 'tuy-chinh', 'high')));
    // Câu hỏi đã học từ các lần làm trước (tối đa 10 câu mỗi vấn đề, không trùng).
    const have = new Set(is.cauHoi.map((c) => c.text.toLowerCase()));
    (learned[`${crime.dieu}|${is.key}`] || [])
      .slice()
      .sort((a, b) => b.n - a.n || b.at - a.at)
      .filter((x) => !have.has(x.text.toLowerCase()))
      .slice(0, 10)
      .forEach((x) => is.cauHoi.push({ ...q(x.text, 'hoc', x.n > 1 ? 'high' : 'normal'), uses: x.n }));
  }

  const allActs = [...hanhViList, ...related.flatMap((r) => r.hanhVi)];
  const taiLieu = [...new Set([...allActs.flatMap((h) => h.taiLieu || []), ...experts.flatMap((e) => e.taiLieu)])];
  const giamDinh = [...new Set(experts.flatMap((e) => e.giamDinh))];
  const total = issues.reduce((s, i) => s + i.cauHoi.length, 0);
  const hanhVi = [...hanhViList, ...related.flatMap((r) => r.hanhVi.map((h) => ({ ...h, ten: `${h.ten} (Điều ${r.crime.dieu})`, dieu: r.crime.dieu })))];
  return { crime, role, hanhVi, lienQuan: related, dinhKhung, issues, taiLieu, giamDinh, stats: { issues: issues.length, questions: total } };
}

/** Văn bản thuần của kế hoạch hỏi (để in, sao chép, gửi AI). */
export function planToText(plan) {
  const out = [`KẾ HOẠCH LẤY LỜI KHAI — ${plan.role.ten.toUpperCase()}`, `Tội danh: Điều ${plan.crime.dieu} BLHS — ${plan.crime.ten}`];
  (plan.lienQuan || []).forEach((r) => out.push(`Điều liên quan: Điều ${r.crime.dieu} BLHS — ${r.crime.ten}`));
  out.push('');
  out.push('HÀNH VI CẦN LÀM RÕ:', ...plan.hanhVi.map((h) => `- ${h.ten}`), '');
  plan.issues.forEach((is, i) => {
    out.push(`${i + 1}. ${is.tieuDe} (${is.canCu})`);
    is.cauHoi.forEach((c, j) => out.push(`   ${i + 1}.${j + 1}. ${c.text}`));
    out.push('');
  });
  if (plan.taiLieu.length) out.push('TÀI LIỆU CẦN THU THẬP:', ...plan.taiLieu.map((t) => `- ${t}`), '');
  if (plan.giamDinh.length) out.push('TRƯNG CẦU GIÁM ĐỊNH, ĐỊNH GIÁ:', ...plan.giamDinh.map((t) => `- ${t}`));
  return out.join('\n').trim();
}

export const SOURCE_LABELS = { luat: 'Luật', 'tu-tung': 'Tố tụng', 'nghiep-vu': 'Nghiệp vụ', 'chuyen-mon': 'Chuyên môn', 'tuy-chinh': 'Của tôi', ai: 'AI gợi ý', hoc: 'Đã học' };
export const LEGAL_DISCLAIMER = 'Dữ liệu điều luật được biên soạn theo Bộ luật Hình sự 2015 (sửa đổi, bổ sung 2017, 2025) và Bộ luật Tố tụng hình sự 2015 nhằm hỗ trợ nghiệp vụ. Người sử dụng cần đối chiếu nguyên văn văn bản pháp luật hiện hành và hướng dẫn áp dụng trước khi sử dụng chính thức.';
