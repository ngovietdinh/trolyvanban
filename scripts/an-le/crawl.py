#!/usr/bin/env python3
"""Quét Cổng thông tin điện tử về án lệ của TANDTC (anle.toaan.gov.vn) → thư mục làm việc:
  raw/detail/<id>.html  trang chi tiết từng án lệ (thuộc tính: số, tên, ngày thông qua / công bố / áp dụng, lĩnh vực…)
  raw/pdf/<id>.bin      tệp đính kèm (PDF, .doc, .docx) — toàn văn án lệ
  meta.json             { meta: {id: thuộc tính}, idfor: {số án lệ: id} }

Cách chạy (cần mạng tới anle.toaan.gov.vn; máy chủ của Tòa án gửi thiếu chứng thư trung gian GlobalSign RSA OV SSL CA 2018
nên ghép thêm vào bundle CA — KHÔNG tắt kiểm tra chứng thư):
  curl -sS -o gs.crt https://secure.globalsign.com/cacert/gsrsaovsslca2018.crt
  openssl x509 -inform DER -in gs.crt -out gs.pem && cat /etc/ssl/certs/ca-certificates.crt gs.pem > bundle.pem
  python3 crawl.py            # quét lan từ trang đầu qua bảng "Văn bản liên quan" của từng trang chi tiết
  python3 crawl.py TAND014320 # thêm điểm xuất phát (id cũ) nếu còn thiếu số nào
Sau đó: build.py (tách chữ → an-le-data.json) và gen.py (ghi assets/data/an-le.json + assets/js/legal/an-le-catalog.js).
"""
import html
import json
import os
import re
import subprocess
import sys
import time

BASE = 'https://anle.toaan.gov.vn'
CA = os.environ.get('TLVB_CA', 'bundle.pem')


def get(url, out):
    r = subprocess.run(['curl', '-sS', '-m', '60', '--cacert', CA, '-o', out, '-w', '%{http_code}', url], capture_output=True, text=True)
    return r.stdout.strip()


def parse(path):
    s = open(path, encoding='utf-8', errors='ignore').read()
    t = html.unescape(re.sub(r'<[^>]+>', '|', s))
    t = re.sub(r'(\|\s*)+', '|', t)

    def f(k):
        j = t.find('|' + k + '|')
        return re.sub(r'\s+', ' ', t[j + len(k) + 2 :].split('|', 1)[0].strip()) if j >= 0 else ''

    meta = {k: f(k) for k in ['Số án lệ', 'Tên án lệ', 'Ngày thông qua', 'Ngày công bố', 'Quyết định công bố', 'Ngày áp dụng', 'Nguồn án lệ', 'Trạng thái']}
    for k in list(meta):
        if meta[k] in ('Ngày áp dụng', 'Nguồn án lệ', 'Lĩnh vực', 'Từ khóa', 'Văn bản liên quan', 'Trạng thái'):
            meta[k] = ''
    # Lĩnh vực, từ khóa nằm trong khối thuộc tính sau "Trạng thái" (menu đầu trang cũng có chữ "Lĩnh vực").
    j = t.find('|Trạng thái|')
    seg = t[j : j + 600].split('|') if j >= 0 else []
    meta['Lĩnh vực'] = ''
    meta['Từ khóa'] = ''
    for i, x in enumerate(seg[:-1]):
        if x == 'Lĩnh vực':
            meta['Lĩnh vực'] = seg[i + 1].strip()
        if x == 'Từ khóa' and seg[i + 1].strip() != 'Văn bản liên quan':
            meta['Từ khóa'] = seg[i + 1].strip()
    rel = {}
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', s, re.S):
        cells = [html.unescape(re.sub(r'<[^>]+>', ' ', c)).strip() for c in re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)]
        ids = re.findall(r'UCMServer/(TAND\d+)', tr)
        if cells and re.match(r'^\d{1,3}/\d{4}/AL$', cells[0].strip()) and ids:
            rel[cells[0].strip()] = ids[0]
    return meta, rel


def main():
    os.makedirs('raw/detail', exist_ok=True)
    os.makedirs('raw/pdf', exist_ok=True)
    M = json.load(open('meta.json')) if os.path.exists('meta.json') else {'meta': {}, 'idfor': {}}
    meta, idfor = M['meta'], M['idfor']
    code = get(f'{BASE}/webcenter/portal/anle/anle', 'raw/home.html')
    if code != '200':
        sys.exit(f'Không tải được trang đầu ({code})')
    seeds = sorted(set(re.findall(r'chitietanle\?dDocName=(TAND\d+)', open('raw/home.html', encoding='utf-8', errors='ignore').read())))
    queue = seeds + sys.argv[1:] + list(idfor.values())
    seen = set()
    while queue:
        d = queue.pop(0)
        if d in seen:
            continue
        seen.add(d)
        p = f'raw/detail/{d}.html'
        if not os.path.exists(p):
            if get(f'{BASE}/webcenter/portal/anle/chitietanle?dDocName={d}', p) != '200':
                print('lỗi', d)
                continue
            time.sleep(0.4)
        m, rel = parse(p)
        if m['Số án lệ']:
            meta[d] = m
            idfor[m['Số án lệ']] = d
        for so, i in rel.items():
            idfor.setdefault(so, i)
            if i not in seen:
                queue.append(i)
    for so, d in idfor.items():
        out = f'raw/pdf/{d}.bin'
        if not os.path.exists(out):
            get(f'{BASE}/webcenter/ShowProperty?nodeId=/UCMServer/{d}', out)
            time.sleep(0.3)
    json.dump({'meta': meta, 'idfor': idfor}, open('meta.json', 'w'), ensure_ascii=False, indent=1)
    nums = sorted(int(s.split('/')[0]) for s in idfor)
    print('án lệ:', len(idfor), 'thiếu:', [n for n in range(1, max(nums) + 1) if n not in nums])


if __name__ == '__main__':
    main()
