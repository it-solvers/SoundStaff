import sys; sys.path.insert(0,'truth')
from extract import parse
import collections
def staves(lines):
    hl=sorted({(round(y1,2),round(min(x1,x2),1),round(max(x1,x2),1)) for x1,y1,x2,y2,w in lines if abs(y1-y2)<0.01 and abs(x2-x1)>150})
    ys=sorted({h[0] for h in hl})
    groups=[]; 
    for y in ys:
        if groups and abs(y-groups[-1][-1]-(groups[-1][-1]-groups[-1][-2] if len(groups[-1])>1 else 0))<0.5 or (groups and len(groups[-1])<5 and 5<y-groups[-1][-1]<12):
            groups[-1].append(y)
        else: groups.append([y])
    return [g for g in groups if len(g)==5]
for pg,n in enumerate((68,71,74),1):
    g,l=parse(n)
    st=staves(l)
    print('page',pg,'staves',len(st), [ (round(s[0],1),round(s[4],1)) for s in st][:12], 'spacing', round(st[0][1]-st[0][0],2))

def assign(glyphs, st):
    """각 글리프를 가장 가까운 보표에 붙인다 -> (staff_idx, gid, x, k(반칸 단위, 맨 아래 줄=0), residual)"""
    out=[]
    for f,size,gid,x,y in glyphs:
        if f!='/F1': continue
        best=min(range(len(st)), key=lambda i: abs((st[i][0]+st[i][4])/2-y))
        s=st[best]; sp=(s[4]-s[0])/4
        k=(s[4]-y)/(sp/2)
        out.append((best,gid,x,round(k,2),round(k-round(k),2)))
    return out
if __name__=='__main__' and len(sys.argv)>1:
    g,l=parse(68); st=staves(l); a=assign(g,st)
    for row in sorted([r for r in a if r[0]==int(sys.argv[1])], key=lambda r:(r[2],r[1])): print(row)
