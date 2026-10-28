// Gói toàn văn án lệ kèm phần mềm (assets/data/an-le.json) và danh mục sinh từ cổng án lệ: đủ 90, khớp số, có nội dung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AN_LE, LINH_VUC, anLeForDieu } from '../../assets/js/legal/an-le-catalog.js';
import { khoDocFromData } from '../../assets/js/legal/an-le-data.js';

const data = JSON.parse(readFileSync(new URL('../../assets/data/an-le.json', import.meta.url), 'utf8'));

test('gói án lệ: 90 bản ghi, số duy nhất và trùng danh mục, toàn văn đủ dài, thuộc tính theo cổng án lệ', () => {
  assert.equal(data.length, 90);
  assert.deepEqual(
    data.map((a) => a.so),
    AN_LE.map((a) => a.so),
  );
  for (const a of data) {
    assert.ok(a.text.length > 3000, `${a.so} toàn văn quá ngắn (${a.text.length})`);
    assert.ok(a.ten && !/^(Quyết định|Bản án)\s/.test(a.ten), `${a.so} tên án lệ: ${a.ten}`);
    assert.ok(LINH_VUC[a.linhVuc], `${a.so} lĩnh vực`);
    assert.match(a.thongQua, /^\d{2}\/\d{2}\/\d{4}$/, `${a.so} ngày thông qua`);
    assert.match(a.apDung, /^\d{2}\/\d{2}\/\d{4}$/, `${a.so} ngày áp dụng`);
    assert.match(a.qdCongBo, /^\d+[A-Za-z]?\/QĐ-CA$/, `${a.so} quyết định công bố: ${a.qdCongBo}`);
    assert.match(a.url, /^https:\/\/anle\.toaan\.gov\.vn\/.*dDocName=TAND\d+$/, `${a.so} liên kết`);
    assert.match(a.text, new RegExp(`${a.so.replace(/^0/, '0?')}`), `${a.so} toàn văn không chứa số án lệ`);
  }
  // Án lệ hình sự (theo phân loại của cổng) ghi điều luật BLHS liên quan; phần lớn có tình huống + giải pháp.
  const hs = data.filter((a) => a.linhVuc === 'hs');
  assert.equal(hs.length, 21);
  for (const a of hs) assert.ok(a.dieu.length, `${a.so} thiếu điều luật`);
  const coKhaiQuat = data.filter((a) => a.tinhHuong || a.khaiQuat).length;
  assert.ok(coKhaiQuat >= 80, `chỉ ${coKhaiQuat} án lệ đọc được khái quát / tình huống`);
  const a47 = data.find((a) => a.so === '47/2021/AL');
  assert.match(a47.tinhHuong, /hung khí nguy hiểm/);
  assert.match(a47.giaiPhap, /Giết người/);
  assert.match(a47.tuKhoa, /Dùng dao đâm/);
  assert.deepEqual(a47.dieu, ['123', '134', '15'], 'Điều 123, 134 (biên tập) + Điều 15 BLHS 2015 (phạm tội chưa đạt) đọc từ mục quy định pháp luật');
});

test('danh mục sinh từ cổng: tên, ngày, quyết định công bố; điều luật liên quan; dựng bản ghi kho từ gói', () => {
  const a73 = AN_LE.find((a) => a.so === '73/2025/AL');
  assert.equal(a73.qdCongBo, '339a/QĐ-CA');
  assert.equal(a73.apDung, '01/02/2026');
  assert.match(a73.ten, /^Án lệ số 73\/2025\/AL về /);
  assert.deepEqual(anLeForDieu(['174']).map((a) => a.so), ['75/2025/AL']);
  assert.ok(anLeForDieu(['123']).length >= 7);
  const d = khoDocFromData(data.find((a) => a.so === '75/2025/AL'), ['173']);
  assert.equal(d.loai, 'an-le');
  assert.equal(d.so, '75/2025/AL');
  assert.match(d.khaiQuat, /Tình huống án lệ:.*\n.*Giải pháp pháp lý:/s);
  assert.deepEqual(d.dieu, ['173', '174']);
  assert.equal(d.nguon, 'tandtc');
});
