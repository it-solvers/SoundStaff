import re, zlib, json, collections, sys
import os
PDF=os.environ.get('SCORE_PDF') or (sys.argv[1] if len(sys.argv)>1 else None)
if not PDF: raise SystemExit('사용법: SCORE_PDF=악보.pdf python3 build_truth.py')
d=open(PDF,'rb').read()
objs={int(n):b for n,b in re.findall(rb'(\d+) 0 obj(.*?)endobj', d, re.S)}
def stream(n):
    m=re.search(rb'stream\r?\n(.*?)\r?\nendstream', objs[n], re.S)
    return zlib.decompress(m.group(1))
def parse(n):
    s=stream(n).decode('latin1')
    glyphs=[]; lines=[]
    font=None; size=None; tm=None; lw=None; cur=None
    for blk in s.split('\n'):
        t=blk.split()
        if not t: continue
        op=t[-1]
        if op=='Tf': font=t[0]; size=float(t[1])
        elif op=='Tm': tm=[float(x) for x in t[:6]]
        elif op=='TJ':
            hexes=re.findall(r'<([0-9A-Fa-f]+)>', blk)
            x=tm[4]
            for h in hexes:
                for i in range(0,len(h),4):
                    glyphs.append((font,size,int(h[i:i+4],16),tm[4],tm[5]))
        elif op=='w': lw=float(t[0])
        elif op=='m': cur=(float(t[0]),float(t[1]))
        elif op=='l' and cur: lines.append((cur[0],cur[1],float(t[0]),float(t[1]),lw)); cur=(float(t[0]),float(t[1]))
    return glyphs, lines
if __name__=='__main__':
    for pg,n in enumerate((68,71,74),1):
        g,l=parse(n)
        c=collections.Counter((f,gid) for f,_,gid,_,_ in g)
        print('page',pg,'glyphs',len(g),'lines',len(l))
        print(' top glyphs',c.most_common(25))
        hl=[x for x in l if abs(x[1]-x[3])<0.01]; vl=[x for x in l if abs(x[0]-x[2])<0.01]
        print(' horizontal',len(hl),'vertical',len(vl))
        print(' widths',collections.Counter(x[4] for x in l).most_common(6))
