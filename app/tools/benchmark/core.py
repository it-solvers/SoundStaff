import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract import parse
from staves import staves
import collections
PAGES=((1,68),(2,71),(3,74))
def load(n):
    g,l=parse(n); st=staves(l)
    out=[]
    for f,size,gid,x,y in g:
        if f!='/F1': continue
        i=min(range(len(st)), key=lambda i: abs((st[i][0]+st[i][4])/2-y))
        s=st[i]; sp=(s[4]-s[0])/4
        out.append(dict(staff=i,gid=gid,x=x,k=(s[4]-y)/(sp/2),y=y))
    # barlines: vertical lines covering a staff's extent
    bars=collections.defaultdict(set)
    for x1,y1,x2,y2,w in l:
        if abs(x1-x2)<0.01:
            lo,hi=min(y1,y2),max(y1,y2)
            for i,s in enumerate(st):
                if lo<=s[0]+1 and hi>=s[4]-1: bars[i].add(round(x1,1))
    return out,st,{i:sorted(v) for i,v in bars.items()}
if __name__=='__main__':
    for pg,n in PAGES:
        gl,st,bars=load(n)
        print('page',pg,'bars staff7',bars.get(7),'staff0',bars.get(0))
        near=collections.Counter()
        heads=[r for r in gl if r['gid'] in (157,)]
        for r in gl:
            if r['gid'] in (13,157,64,84,199,65,5,30): continue
            if any(h['staff']==r['staff'] and -2<=r['x']-h['x']<=14 for h in heads): near[r['gid']]+=1
        print(' near black heads:',near.most_common(12))
