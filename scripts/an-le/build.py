import json,re,os,unicodedata
M=json.loads(unicodedata.normalize('NFC',open('meta.json',encoding='utf-8').read())); meta=M['meta']; idfor=M['idfor']
LV={'Hình sự':'hs','Dân sự':'ds','Hôn nhân và gia đình':'hngd','Hôn nhân gia đình':'hngd','Kinh doanh thương mại':'kdtm','Kinh doanh, thương mại':'kdtm','Lao động':'ld','Hành chính':'hc'}
def norm(t):
    t=unicodedata.normalize('NFC',t)
    t=t.replace('﻿','').replace('\r','')
    t=re.sub(r'[ \t ]+',' ',t)
    t=re.sub(r' *\n *','\n',t)
    t=re.sub(r'\n{3,}','\n\n',t)
    # bỏ số chú thích dính sau số án lệ: "75/2025/AL1"
    t=re.sub(r'(\d{1,3}/\d{4}/AL)1\b',r'\1',t,count=1)
    return t.strip()
HEADS=[('nguon',r'Nguồn án lệ'),('viTri',r'Vị trí nội dung (?:của )?án lệ'),('khaiQuat',r'Khái quát nội dung (?:của )?án lệ'),('tinhHuong',r'-?\s*Tình huống án lệ'),('giaiPhap',r'-?\s*Giải pháp pháp lý'),('quyDinh',r'Quy định của pháp luật liên quan đến án lệ'),('tuKhoa',r'Từ kh(?:óa|oá) của án lệ'),('noiDung',r'NỘI DUNG VỤ ÁN'),('nhanDinh',r'NHẬN ĐỊNH CỦA (?:TÒA ÁN|HỘI ĐỒNG[^\n:]*)'),('quyetDinh',r'QUYẾT ĐỊNH')]
def sections(t):
    # vị trí từng tiêu đề (lần đầu, theo thứ tự xuất hiện sau tiêu đề trước)
    pos=[]; start=0
    for key,pat in HEADS:
        pat=pat.replace(' ','\\s+')
        m=re.search(r'(?im)(?:^\s*'+pat+r'\s*:?\s*$)|(?:'+pat+r'\s*:)',t[start:])
        if not m: continue
        a=start+m.start(); b=start+m.end(); pos.append((key,a,b)); start=b
    out={}
    for i,(key,a,b) in enumerate(pos):
        end=pos[i+1][1] if i+1<len(pos) else len(t)
        out[key]=t[b:end].strip()
    return out
def dieu_blhs(q):
    # các điều BLHS 2015 (kể cả "tương ứng với ...") — số điều đứng sau "Điều"
    out=[]
    for seg in re.split(r'Bộ luật Hình sự',q):
        pass
    # lấy cụm "... Bộ luật Hình sự năm 2015" và "tương ứng với ..."
    cands=re.findall(r'((?:[^.;\n]*?)Bộ luật Hình sự (?:năm )?2015)',q)
    cands+=re.findall(r'tương ứng với([^)]*)',q)
    if not cands and 'Bộ luật Hình sự' in q: cands=[q]
    for c in cands:
        for d in re.findall(r'Điều (\d{1,3})',c): out.append(d)
    seen=[];
    for d in out:
        if d not in seen: seen.append(d)
    return seen
OCR=set(json.load(open('ocr-list.json'))) if os.path.exists('ocr-list.json') else set()
data=[]
for so,d in sorted(idfor.items(), key=lambda x:int(x[0].split('/')[0])):
    m=meta[d]; t=norm(open(f'txt/{d}.txt',encoding='utf-8',errors='ignore').read())
    s=sections(t)
    ten=re.sub(r'^\s*Án lệ số\s*\d{1,3}/\d{4}/AL\s*','',m['Tên án lệ'] or '').strip()
    ten=ten[:1].upper()+ten[1:]
    lvraw=m['Lĩnh vực']
    lv='hs' if 'Hình sự' in lvraw else 'hngd' if 'Hôn nhân' in lvraw else 'ld' if 'Lao động' in lvraw else 'kdtm' if 'Kinh doanh' in lvraw else 'hc' if 'Hành chính' in lvraw else 'ds' if 'Dân sự' in lvraw else ''
    rec={'so':so,'num':int(so.split('/')[0]),'id':d,'ten':ten,'linhVuc':lv,'thongQua':m['Ngày thông qua'],'ngayCongBo':m['Ngày công bố'],'qdCongBo':m['Quyết định công bố'],'apDung':m['Ngày áp dụng'],'trangThai':m['Trạng thái'],'nguon':s.get('nguon',''),'viTri':s.get('viTri',''),'khaiQuat':s.get('khaiQuat',''),'tinhHuong':s.get('tinhHuong',''),'giaiPhap':s.get('giaiPhap',''),'quyDinh':s.get('quyDinh',''),'tuKhoa':s.get('tuKhoa',''),'text':t}
    if not rec['khaiQuat'] and (rec['tinhHuong'] or rec['giaiPhap']): rec['khaiQuat']=''
    mm=re.search(r'([0-9]+[A-Za-z]?/QĐ-CA)',rec['qdCongBo']) or re.search(r'Quyết định số\s*([0-9]+[A-Za-z]?/QĐ-CA)',t)
    rec['qdCongBo']=mm.group(1) if mm else ''
    rec['linhVucText']=lvraw
    if not re.match(r'^\d{2}/\d{2}/\d{4}$',rec['ngayCongBo']):
        mm=re.search(r'công\s+bố\s+theo\s+Quyết\s+định\s+số\s*[0-9A-Za-z]+/QĐ-CA\s+ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})',t)
        rec['ngayCongBo']=f'{int(mm.group(1)):02d}/{int(mm.group(2)):02d}/{mm.group(3)}' if mm else ''
    rec['url']=f'https://anle.toaan.gov.vn/webcenter/portal/anle/chitietanle?dDocName={d}'
    rec['ocr']=d in OCR
    rec['dieu']=dieu_blhs(rec['quyDinh']) if lv=='hs' else []
    data.append(rec)
json.dump(data,open('an-le-data.json','w'),ensure_ascii=False)
miss={k:[r['so'] for r in data if not r[k]] for k in ['ten','linhVuc','thongQua','qdCongBo','apDung','nguon','khaiQuat','giaiPhap','quyDinh','tuKhoa','noiDung' if False else 'text']}
for k,v in miss.items(): print(k,len(v),v[:12])
print('hs',[(r['so'],r['dieu']) for r in data if r['linhVuc']=='hs'])
print('size',os.path.getsize('an-le-data.json'))
