import json,re
data=json.load(open('an-le-data.json'))
js=open('/home/user/trolyvanban/assets/js/legal/an-le-catalog.js',encoding='utf-8').read()
cur={}
for m in re.finditer(r"\[(\d+), (\d{4}), '([a-z]+)', '([^']*)'(?:, \[([^\]]*)\])?\]",js):
    cur[int(m.group(1))]={'ten':m.group(4),'lv':m.group(3),'dieu':[x.strip().strip("'") for x in m.group(5).split(',')] if m.group(5) else []}
CUR_TEN={1:'Về vụ án “Giết người”',2:'Về vụ án “Tranh chấp đòi lại tài sản”',3:'Về vụ án “Ly hôn”',4:'Về vụ án “Tranh chấp hợp đồng chuyển nhượng quyền sử dụng đất”',5:'Về vụ án “Tranh chấp di sản thừa kế”',6:'Về vụ án “Tranh chấp thừa kế”',7:'Về công nhận hợp đồng mua bán nhà được xác lập trước ngày 01/7/1991',8:'Về xác định lãi suất, việc điều chỉnh lãi suất trong hợp đồng tín dụng kể từ thời điểm tiếp theo của kỳ hạn thanh toán',9:'Về xác định lãi suất nợ quá hạn trung bình trên thị trường và việc trả lãi trên số tiền phạt vi phạm, bồi thường thiệt hại',10:'Về quyết định hành chính là đối tượng khởi kiện vụ án hành chính'}
CUR_DIEU={1:['123','134'],17:['123'],18:['123'],19:['353'],28:['125'],29:['168'],30:['123'],45:['123','15'],46:['146'],47:['123','134'],48:['51'],57:['171'],58:['244'],59:['123'],64:['169'],65:['150'],66:['150'],73:['52'],74:['173'],75:['173','174'],76:['47']}
out=[]
for r in data:
    n=r['num']; c={'ten':CUR_TEN.get(n,''),'dieu':CUR_DIEU.get(n,[])}
    ten=r['ten']
    if re.match(r'^\W*(Quyết định|Bản án)\s',ten):
        m=re.match(r'^\W*Án lệ số \d{1,3}/\d{4}/AL\s+(về[^\n]+)',r['text'])
        ten=(m.group(1).strip() if m else c.get('ten','')).strip()
        ten=ten[:1].upper()+ten[1:]
    r['ten']=ten
    # điều BLHS: danh sách tay + số điều BLHS 2015 đọc từ "Quy định của pháp luật" (chỉ án lệ hình sự)
    dieu=list(c.get('dieu',[]))
    if r['linhVuc']=='hs':
        q=r['quyDinh']
        for cl in re.split(r'[;\n]',q):
            if 'Bộ luật Hình sự' not in cl or 'Tố tụng' in cl: continue
            segs=re.findall(r'tương ứng với([^)]*)',cl) if '1999' in cl else [cl]
            for seg in segs:
                for d in re.findall(r'Điều (\d{1,3})',seg):
                    if int(d)>=15 and d not in dieu: dieu.append(d)
    r['dieu']=dieu
json.dump(data,open('an-le-final.json','w'),ensure_ascii=False)
slim=[{k:v for k,v in r.items() if k not in ('id','linhVucText','trangThai')} for r in data]
json.dump(slim,open('/home/user/trolyvanban/assets/data/an-le.json','w'),ensure_ascii=False,separators=(',',':'))
# danh mục JS sinh lại từ dữ liệu cổng
lines=[]
for r in data:
    d=", ["+", ".join(f"'{x}'" for x in r['dieu'])+"]" if r['dieu'] else ''
    t=r['ten'].replace("'","\\'")
    lines.append(f"  [{r['num']}, {r['so'].split('/')[1]}, '{r['linhVuc']}', '{t}', '{r['thongQua']}', '{r['qdCongBo']}', '{r['ngayCongBo']}', '{r['apDung']}'{d}],")
open('ds.js','w').write('\n'.join(lines))
print(len(lines)); print([ (r['so'],r['ten'][:70]) for r in data if r['num'] in (1,6,10,19,33)]); print([(r['so'],r['dieu']) for r in data if r['linhVuc']=='hs'])
import os; print('json', os.path.getsize('/home/user/trolyvanban/assets/data/an-le.json'))

head=open('/home/user/trolyvanban/assets/js/legal/an-le-catalog.js',encoding='utf-8').read()
tail=head[head.index("const pad = (n)"):]
newhead="""// Danh mục án lệ do Hội đồng Thẩm phán Tòa án nhân dân tối cao thông qua (01/2016/AL → 90/2026/AL), sinh từ dữ liệu
// Cổng thông tin điện tử về án lệ (anle.toaan.gov.vn, tháng 10/2026): số, tên, lĩnh vực, ngày thông qua, quyết định
// công bố, ngày công bố, ngày áp dụng; án lệ hình sự ghi điều luật BLHS 2015 liên quan (đọc từ mục "Quy định của pháp
// luật liên quan đến án lệ", có rà tay). TOÀN VĂN nằm ở assets/data/an-le.json (xem an-le-data.js). Khi cổng công bố án lệ
// mới: chạy lại bộ sinh dữ liệu (scripts/an-le/) rồi cập nhật cả hai tệp.
export const LINH_VUC = { hs: 'Hình sự', ds: 'Dân sự', hngd: 'Hôn nhân và gia đình', kdtm: 'Kinh doanh, thương mại', ld: 'Lao động', hc: 'Hành chính' };

/** [số, năm, lĩnh vực, tên (sau chữ "Về"), ngày thông qua, quyết định công bố, ngày công bố, ngày áp dụng, điều BLHS liên quan]. */
const DS = [
"""+'\n'.join(lines)+"""
];

"""
tail=tail.replace("""export const AN_LE = DS.map(([num, nam, linhVuc, ten, dieu = []]) => {
  const d = DOT.find(([a, b]) => num >= a && num <= b) || [];
  return { so: `${pad(num)}/${nam}/AL`, num, nam, linhVuc, ten: `Án lệ số ${pad(num)}/${nam}/AL ${ten}`, tenNgan: ten, dieu, thongQua: d[2] || '', qdCongBo: d[3] || '', ngayCongBo: d[4] || '', apDung: d[5] || '' };
});""","""export const AN_LE = DS.map(([num, nam, linhVuc, ten, thongQua, qdCongBo, ngayCongBo, apDung, dieu = []]) => ({
  so: `${pad(num)}/${nam}/AL`,
  num,
  nam,
  linhVuc,
  ten: `Án lệ số ${pad(num)}/${nam}/AL ${ten[0].toLowerCase()}${ten.slice(1)}`,
  tenNgan: ten,
  dieu,
  thongQua,
  qdCongBo,
  ngayCongBo,
  apDung,
}));""")
assert 'DOT' not in tail
open('/home/user/trolyvanban/assets/js/legal/an-le-catalog.js','w',encoding='utf-8').write(newhead+tail)
print('catalog written')
