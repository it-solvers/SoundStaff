import os, sys, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core import load, PAGES
NAMES=['Flute','Oboe','Trumpet','Horn','Trombone','Violin','Cello','Soprano','Bass','PianoR','PianoL']
CLEF={0:'G',1:'G',2:'G',3:'G',4:'F',5:'G',6:'F',7:'G',8:'F',9:'G',10:'F'}
KEYFLATS={'B','E','A'}          # Eb장조: Bb Eb Ab
LETTERS='CDEFGAB'; BASE=[0,2,4,5,7,9,11]
HEAD={157:1.0,199:2.0,84:4.0}   # 검은 머리=4분, 199=2분, 84=온음표
REST={156:1.0,135:4.0,177:0.5}
FLAT,NAT=64,75
def midi_of(clef,k,acc):
    d=(30 if clef=='G' else 18)+round(k)
    L=LETTERS[d%7]; alter=-1 if L in KEYFLATS else 0
    return d, L, alter
def run(staves_sel=(0,1,4,5,6,7,8)):
    notes=[]; problems=[]
    m_global=0
    for pg,n in PAGES:
        gl,st,bars=load(n)
        b=bars[0]            # 모든 보표의 마디선이 같다
        for mi in range(len(b)-1):
            x0,x1=b[mi],b[mi+1]
            if x1-x0<20: continue       # 겹줄(마지막) 제외
            for s in staves_sel:
                items=[r for r in gl if r['staff']==s and x0<r['x']<x1+0.1]
                heads=[r for r in items if r['gid'] in HEAD]
                rests=[r for r in items if r['gid'] in REST]
                accs=[r for r in items if r['gid'] in (FLAT,NAT)]
                dots=[r for r in items if r['gid']==13]
                flags=[r for r in items if r['gid'] in (71,40)]
                # 열(column)로 묶기
                cols=[]
                for h in sorted(heads+rests,key=lambda r:r['x']):
                    if cols and abs(h['x']-cols[-1][0]['x'])<=11 and (h['gid'] in HEAD)==(cols[-1][0]['gid'] in HEAD): cols[-1].append(h)
                    else: cols.append([h])
                t=0.0; seq=[]
                for c in cols:
                    g=c[0]['gid']
                    if g in HEAD:
                        base=min(HEAD[r['gid']] for r in c)
                        x=min(r['x'] for r in c)
                        if base==1.0 and any(f for f in flags if 0<=f['x']-x<=16): base=0.5
                        if any(d for d in dots if 2<=d['x']-max(r['x'] for r in c)<=18): base*=1.5
                        seq.append((c,base))
                    else:
                        base=REST.get(g,0.5)
                        if g in REST and any(d for d in dots if 2<=d['x']-c[0]['x']<=18): base*=1.5
                        seq.append((c,base))
                total=sum(b_ for _,b_ in seq)
                # 쉼표 길이 보정: 온쉼표가 있는 마디는 4박
                if any(r['gid']==135 for r in rests) and len(seq)==1: seq=[(seq[0][0],4.0)]; total=4.0
                if abs(total-4.0)>0.01: problems.append((pg,m_global+mi,NAMES[s],total,[(round(c[0]['x']),c[0]['gid'],b_) for c,b_ in seq]))
                t=0.0
                for c,dur in seq:
                    if c[0]['gid'] in HEAD:
                        for h in c:
                            # 임시표: 같은 높이 바로 왼쪽
                            acc=None
                            for a in accs:
                                if 0<h['x']-a['x']<=14 and abs(a['k']-h['k'])<=0.7: acc=a['gid']
                            d,L,alter=midi_of(CLEF[s],h['k'],None)
                            if acc==FLAT: alter=-1
                            elif acc==NAT: alter=0
                            midi=12*(d//7+1)+BASE[d%7]+alter
                            notes.append(dict(measure=m_global+mi,staff=NAMES[s],start=t,dur=dur,midi=midi,L=L,acc=acc,k=round(h['k'])))
                    t+=dur
        m_global+=sum(1 for i in range(len(b)-1) if b[i+1]-b[i]>=20)
    return notes,problems
if __name__=='__main__':
    notes,problems=run()
    print('notes',len(notes),'problems',len(problems))
    for p in problems: print(p)
    out=os.environ.get('TRUTH_JSON','truth_notes.json')
    json.dump(notes,open(out,'w'))
    print('정답 음표를 저장했습니다:',out)
