import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numberToWords, moneyToWords, formatNumberVi, parseNumberInput } from '../../assets/js/lib/number-words.js';

const cases = [
  [0, 'không'], [5, 'năm'], [10, 'mười'], [11, 'mười một'], [15, 'mười lăm'], [21, 'hai mươi mốt'],
  [24, 'hai mươi tư'], [25, 'hai mươi lăm'], [55, 'năm mươi lăm'], [100, 'một trăm'], [101, 'một trăm linh một'],
  [105, 'một trăm linh năm'], [110, 'một trăm mười'], [115, 'một trăm mười lăm'], [1000, 'một nghìn'],
  [1005, 'một nghìn không trăm linh năm'], [1234567, 'một triệu hai trăm ba mươi tư nghìn năm trăm sáu mươi bảy'],
  [1000000000, 'một tỷ'], [2000001, 'hai triệu không trăm linh một'], [1000000000000, 'một nghìn tỷ'],
  ['1.000.000.000.000.000.000', 'một tỷ tỷ'], [-35, 'âm ba mươi lăm'], [31, 'ba mươi mốt'], [14, 'mười bốn'],
];
for (const [n, w] of cases) test(`đọc ${n}`, () => assert.equal(numberToWords(n), w));

test('đọc số thập phân', () => {
  assert.equal(numberToWords('12,5'), 'mười hai phẩy năm');
  assert.equal(numberToWords('3.14'), 'ba phẩy mười bốn');
  assert.equal(numberToWords('1,05'), 'một phẩy không năm');
});

test('phân tích định dạng số kiểu Việt Nam', () => {
  assert.deepEqual(parseNumberInput('1.234.567'), { negative: false, intPart: '1234567', fracPart: '' });
  assert.deepEqual(parseNumberInput('1.234,50'), { negative: false, intPart: '1234', fracPart: '5' });
  assert.deepEqual(parseNumberInput('1,234,567.89'), { negative: false, intPart: '1234567', fracPart: '89' });
  assert.deepEqual(parseNumberInput('2 500 000 đ'), { negative: false, intPart: '2500000', fracPart: '' });
  assert.equal(parseNumberInput('abc'), null);
  assert.equal(parseNumberInput(''), null);
});

test('đọc số tiền chuẩn chứng từ', () => {
  assert.equal(moneyToWords('1.250.000'), 'Một triệu hai trăm năm mươi nghìn đồng chẵn.');
  assert.equal(moneyToWords(350000000), 'Ba trăm năm mươi triệu đồng chẵn.');
  assert.throws(() => moneyToWords('x'));
});

test('định dạng số', () => {
  assert.equal(formatNumberVi('1234567.5'), '1.234.567,5');
  assert.equal(formatNumberVi(1000), '1.000');
});
