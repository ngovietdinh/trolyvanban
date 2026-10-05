import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DOMAINS, ALL_CRIMES, findCrime, searchCrimes, buildTree, generatePlan, planToText } from '../../assets/js/legal/engine.js';
import { EXPERTISE } from '../../assets/js/legal/expertise.js';
import { ROLES } from '../../assets/js/legal/roles.js';
import { newRecord, buildRecordDocument, buildPlanDocument, formatMoment, qaToText } from '../../assets/js/legal/record.js';
import { localSuggest, localContradictions, localCoverage, localNormalize, extractFacts } from '../../assets/js/legal/assist.js';
import { renderDocumentHtml } from '../../assets/js/lib/render-html.js';
import { buildDocumentXml, buildDocx, docxToText } from '../../assets/js/lib/docx.js';

test('dữ liệu điều luật: đủ 4 lĩnh vực, số điều không trùng, đúng phạm vi chương', () => {
  assert.equal(DOMAINS.length, 4);
  const ids = ALL_CRIMES.map((c) => c.dieu);
  assert.equal(new Set(ids).size, ids.length, 'trùng số điều');
  assert.ok(ALL_CRIMES.length >= 80, `chỉ có ${ALL_CRIMES.length} tội`);
  for (const c of ALL_CRIMES) {
    const n = parseInt(c.dieu, 10);
    if (/XVIII/.test(c.chuong)) assert.ok(n >= 188 && n <= 234, `Điều ${c.dieu} không thuộc Chương XVIII`);
    if (/XIX —/.test(c.chuong)) assert.ok(n >= 235 && n <= 246, `Điều ${c.dieu} không thuộc Chương XIX`);
    if (/XXIII/.test(c.chuong)) assert.ok(n >= 352 && n <= 366, `Điều ${c.dieu} không thuộc Chương XXIII`);
    if (/XXI —/.test(c.chuong)) assert.ok(n >= 295 && n <= 329, `Điều ${c.dieu} không thuộc Chương XXI`);
    assert.ok(c.ten.startsWith('Tội '), c.dieu);
    assert.ok(c.hanhVi.length >= 1 && c.dauHieu.length >= 1 && c.dinhKhung.length >= 1, `Điều ${c.dieu} thiếu dữ liệu`);
    assert.equal(new Set(c.hanhVi.map((h) => h.id)).size, c.hanhVi.length, `Điều ${c.dieu} trùng id hành vi`);
    for (const k of c.chuyenMon || []) assert.ok(EXPERTISE[k], `Điều ${c.dieu}: thiếu chuyên môn ${k}`);
  }
});

test('mỗi nhóm đều có tội danh; cây phân cấp đúng', () => {
  for (const d of DOMAINS) for (const g of d.groups) assert.ok(d.crimes.some((c) => c.nhom === g.id), `${d.id}/${g.id} rỗng`);
  for (const d of DOMAINS) for (const c of d.crimes) assert.ok(d.groups.some((g) => g.id === c.nhom), `Điều ${c.dieu} có nhóm lạ ${c.nhom}`);
  const tree = buildTree();
  const kt = tree.find((t) => t.id === 'kinh-te');
  const dt = kt.children.find((g) => g.id === 'kinh-te/dau-thau');
  assert.equal(dt.children[0].id, '222');
  assert.ok(dt.children[0].children.some((h) => h.ten.includes('Thông thầu')));
});

test('tìm kiếm không dấu, theo số điều và theo hành vi', () => {
  assert.equal(searchCrimes('222')[0].dieu, '222');
  assert.equal(searchCrimes('dieu 353')[0].dieu, '353');
  assert.equal(searchCrimes('nhan hoi lo')[0].dieu, '354');
  assert.ok(searchCrimes('thông thầu').some((c) => c.dieu === '222'));
  assert.deepEqual(searchCrimes(''), []);
});

test('sinh kế hoạch hỏi cho Điều 222 — bị can: đủ vấn đề theo cấu thành và Điều 85', () => {
  const plan = generatePlan({ dieu: '222', hanhViIds: ['thong-thau', 'nang-gia'], dinhKhung: ['Vì vụ lợi'], roleId: 'bi-can' });
  const keys = plan.issues.map((i) => i.key);
  for (const k of ['nhan-than', 'hv-thong-thau', 'hv-nang-gia', 'hau-qua', 'chu-quan', 'dong-pham', 'dinh-khung', 'chuyen-mon', 'tai-lieu', 'tang-nang-giam-nhe', 'loai-tru', 'nguyen-nhan']) assert.ok(keys.includes(k), `thiếu ${k}`);
  assert.ok(!keys.includes('hv-can-thiep'), 'không chọn hành vi can thiệp');
  const tt = plan.issues.find((i) => i.key === 'hv-thong-thau');
  assert.ok(tt.cauHoi.some((c) => c.text.includes('quân xanh')));
  assert.ok(plan.issues.find((i) => i.key === 'chuyen-mon').cauHoi.some((c) => c.text.startsWith('[Đấu thầu')));
  assert.ok(plan.taiLieu.some((t) => t.includes('mạng đấu thầu')));
  assert.ok(plan.giamDinh.length > 0);
  assert.ok(plan.stats.questions > 40);
  const ids = plan.issues.flatMap((i) => i.cauHoi.map((c) => c.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.match(planToText(plan), /KẾ HOẠCH LẤY LỜI KHAI — BỊ CAN/);
});

test('câu hỏi thay đổi theo đối tượng lời khai', () => {
  const suspect = generatePlan({ dieu: '354', roleId: 'bi-can' });
  const witness = generatePlan({ dieu: '354', roleId: 'lam-chung' });
  const victim = generatePlan({ dieu: '174', roleId: 'bi-hai' });
  assert.ok(suspect.issues.some((i) => i.key === 'tang-nang-giam-nhe'));
  assert.ok(!witness.issues.some((i) => i.key === 'tang-nang-giam-nhe'));
  assert.ok(!witness.issues.some((i) => i.key === 'loai-tru'));
  assert.ok(victim.issues.some((i) => i.key === 'y-kien-bi-hai'));
  assert.ok(victim.issues.find((i) => i.key === 'hau-qua').cauHoi.some((c) => /yêu cầu bồi thường/.test(c.text)));
  assert.match(witness.issues.find((i) => i.key === 'nhan-than').cauHoi[1].text, /hoàn cảnh nào/);
  // tội vô ý: không hỏi về vụ lợi
  const voY = generatePlan({ dieu: '360', roleId: 'bi-can' });
  assert.ok(!voY.issues.find((i) => i.key === 'chu-quan').cauHoi.some((c) => /Mục đích, động cơ/.test(c.text)));
  // chủ thể đặc biệt
  assert.ok(suspect.issues.find((i) => i.key === 'nhan-than').cauHoi.some((c) => /chức vụ gì/.test(c.text)));
});

test('mọi tội × mọi đối tượng đều sinh được kế hoạch hợp lệ', () => {
  for (const c of ALL_CRIMES) for (const r of ROLES) {
    const p = generatePlan({ dieu: c.dieu, roleId: r.id, dinhKhung: c.dinhKhung.slice(0, 1) });
    assert.ok(p.issues.length >= 6, `${c.dieu}/${r.id}`);
    for (const is of p.issues) assert.ok(is.cauHoi.length > 0, `${c.dieu}/${r.id}/${is.key} rỗng`);
  }
});

test('câu hỏi tùy chỉnh đã lưu được ghép vào kế hoạch', () => {
  const p = generatePlan({ dieu: '222', roleId: 'bi-can', custom: { '222|dong-pham': ['Ai là người “bảo kê” cho nhóm nhà thầu?'] } });
  const q = p.issues.find((i) => i.key === 'dong-pham').cauHoi.at(-1);
  assert.equal(q.src, 'tuy-chinh');
  assert.match(q.text, /bảo kê/);
});

test('biên bản hỏi cung: đủ thể thức, hỏi – đáp, chữ ký; xuất Word hợp lệ', async () => {
  const plan = generatePlan({ dieu: '353', roleId: 'bi-can' });
  const rec = newRecord({ roleId: 'bi-can', plan, settings: { legalOrg: { coQuanCapTren: 'Công an tỉnh Ninh Bình', coQuan: 'Cơ quan Cảnh sát điều tra', diaDiem: 'Trụ sở Cơ quan CSĐT' } } });
  rec.nguoiKhai.hoTen = 'Nguyễn Văn Bình';
  rec.ngay = '2026-02-03';
  rec.gioBatDau = '08:05';
  rec.gioKetThuc = '10:30';
  rec.daThongBaoQuyen = true;
  rec.nguoiTienHanh = [{ hoTen: 'Trần Minh Đức', chucDanh: 'Điều tra viên' }];
  rec.qa = [{ q: 'Anh trình bày việc lập chứng từ chi khống?', a: 'Tôi đã lập 05 phiếu chi khống theo chỉ đạo của ông Lê Văn C.' }];
  const doc = buildRecordDocument(rec);
  assert.equal(doc.title.name, 'BIÊN BẢN HỎI CUNG BỊ CAN');
  const html = renderDocumentHtml(doc);
  assert.match(html, /Hồi 8 giờ 05 phút ngày 3 tháng 2 năm 2026 tại Trụ sở Cơ quan CSĐT\./);
  assert.match(html, /Tôi: <strong>Trần Minh Đức<\/strong>, Điều tra viên thuộc Cơ quan Cảnh sát điều tra\./);
  assert.equal(doc.layout, 'form');
  assert.deepEqual(doc.formNo, null); // hỏi cung: mẫu số chưa cấu hình → không in
  assert.match(html, /HỎI VÀ ĐÁP/);
  assert.match(html, /Đáp: <\/strong>Tôi đã lập/);
  assert.match(html, /Việc hỏi cung kết thúc hồi 10 giờ 30 phút cùng ngày\. Biên bản này đã cho bị can tự đọc lại/);
  assert.match(html, /Căn cứ Điều 178, Điều 183, Điều 184 Bộ luật Tố tụng hình sự, tiến hành hỏi cung bị can:/);
  assert.match(html, /Bị can đã được giải thích quyền và nghĩa vụ của mình theo quy định tại Điều 60 Bộ luật Tố tụng hình sự và cam đoan/);
  assert.match(html, /Tư cách tham gia tố tụng: Bị can\./);
  assert.match(html, /Điều 60 Bộ luật Tố tụng hình sự/);
  assert.match(html, /Họ tên: <strong>Nguyễn Văn Bình<\/strong>/);
  assert.match(html, /Hỏi: /);
  assert.match(html, /BỊ CAN/);
  assert.match(html, /ĐIỀU TRA VIÊN/);
  assert.match(html, /kết thúc hồi 10 giờ 30 phút/);
  const xml = buildDocumentXml(doc);
  const dir = mkdtempSync(join(tmpdir(), 'rec-'));
  writeFileSync(join(dir, 'd.xml'), xml);
  execFileSync('python3', ['-c', 'import sys,xml.dom.minidom as m; m.parse(sys.argv[1])', join(dir, 'd.xml')]);
  const text = await docxToText(buildDocx(doc));
  assert.match(text, /Độc lập - Tự do - Hạnh phúc/);
  assert.match(text, /Đáp: Tôi đã lập 05 phiếu chi khống/);
  assert.match(text, /^Mẫu số|CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/m);
  assert.match(text, /BIÊN BẢN HỎI CUNG BỊ CAN \(\)/);
  assert.match(qaToText(rec), /\[1\] Hỏi:/);
});

test('biên bản người làm chứng có cảnh báo Điều 382, 383 BLHS; kế hoạch xuất được', () => {
  const rec = newRecord({ roleId: 'lam-chung' });
  const html = renderDocumentHtml(buildRecordDocument(rec));
  assert.match(html, /BIÊN BẢN GHI LỜI KHAI/);
  assert.match(html, /Điều 382 và Điều 383/);
  assert.match(html, /NGƯỜI KHAI/);
  assert.match(html, /Tư cách tham gia tố tụng: Người làm chứng\./);
  assert.match(html, /Điều 178, Điều 185, Điều 186, Điều 187 Bộ luật Tố tụng hình sự, tiến hành lập biên bản ghi lời khai của:/);
  assert.match(html, /Mẫu số: 140/);
  assert.match(html, /BH theo TT số 128\/2025\/TT-BCA/);
  assert.match(html, /Điều 55 BLTTHS/);
  // Phiếu hỏi in sẵn: câu hỏi chưa trả lời → dòng chấm; mẫu số cấu hình được
  rec.qa = [{ q: 'Anh biết gì về vụ việc?', a: '' }];
  rec.mauSo = '140';
  rec.thongTu = 'Thông tư số 01/2025/TT-BCA';
  rec.canCu = 'Điều 186 Bộ luật Tố tụng hình sự';
  const doc2 = buildRecordDocument(rec);
  assert.deepEqual(doc2.formNo, ['Mẫu số: 140', 'BH theo Thông tư số 01/2025/TT-BCA']);
  const h2 = renderDocumentHtml(doc2);
  assert.match(h2, /Đáp: <\/strong>…{10,}/);
  assert.match(h2, /Căn cứ Điều 186 Bộ luật Tố tụng hình sự, tiến hành lập biên bản ghi lời khai của/);
  assert.match(buildDocumentXml(doc2), /Mẫu số: 140/);
  assert.match(buildDocumentXml(doc2), /w:framePr/);
  const plan = generatePlan({ dieu: '235', roleId: 'lam-chung' });
  const pdoc = buildPlanDocument(plan, { coQuan: 'Phòng Cảnh sát môi trường', dieuTraVien: 'Phạm An' });
  assert.match(renderDocumentHtml(pdoc), /KẾ HOẠCH LẤY LỜI KHAI/);
  assert.match(formatMoment('2026-10-05', '14:00'), /^Hồi 14 giờ 00 phút ngày 5 tháng 10 năm 2026$/);
});

test('phân tích cục bộ: trích xuất, gợi ý truy tiếp, mâu thuẫn, mức độ làm rõ, chuẩn hóa', () => {
  const f = extractFacts('Tôi đưa cho ông Nguyễn Văn Hùng 50 triệu đồng vào ngày 12/3/2025, khoảng 9 giờ.');
  assert.equal(f.money[0].value, 50e6);
  assert.deepEqual(f.names, ['Nguyễn Văn Hùng']);
  assert.equal(f.dates.length, 1);
  assert.equal(f.vague, true);

  const plan = generatePlan({ dieu: '354', roleId: 'bi-can' });
  const rec = newRecord({ roleId: 'bi-can', plan });
  const hv = plan.issues.find((i) => i.key.startsWith('hv-'));
  rec.qa = [
    { q: 'Anh nhận bao nhiêu tiền?', a: 'Tôi nhận 50 triệu đồng từ ông Trần Văn Nam tại quán cà phê.', issueId: hv.id },
    { q: 'Nhận lần nào?', a: 'Hình như tôi nhận 70 triệu đồng, không nhớ rõ.', issueId: hv.id },
  ];
  const s = localSuggest(rec);
  assert.ok(s.some((x) => /70 triệu/.test(x.text)));
  assert.ok(s.some((x) => /cụ thể hơn/.test(x.text)));
  const c = localContradictions(rec);
  assert.ok(c.some((x) => /50 triệu.*70 triệu/.test(x.moTa)));
  const cov = localCoverage(rec);
  assert.equal(cov.danhGia.find((d) => d.issueId === hv.id).mucDo, 'mot-phan');
  assert.equal(localNormalize('em có nhận tiền  của anh nam ,nhưng không nhớ ngày'), 'Tôi có nhận tiền của anh nam, nhưng không nhớ ngày.');
});
