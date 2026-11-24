import os, sys, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core import load, PAGES
LETTERS='CDEFGAB'; BASE=[0,2,4,5,7,9,11]; KEYFLATS={'B','E','A'}
CLEF={9:'G',10:'F'}; NAMES={9:'PianoR',10:'PianoL'}
HEAD={157,84,199}; FLAT,NAT=64,75
def run():
    notes=[]; mg=0
    for pg,n in PAGES:
        gl,st,bars=load(n); b=bars[0]
        for mi in range(len(b)-1):
            x0,x1=b[mi],b[mi+1]
            if x1-x0<20: continue
            for s in (9,10):
                items=[r for r in gl if r['staff']==s and x0<r['x']<x1+0.1]
                heads=[r for r in items if r['gid'] in HEAD]
                accs=[r for r in items if r['gid'] in (FLAT,NAT)]
                if not heads: continue
                xs=sorted({round(h['x'],1) for h in heads})
                first=min(xs); span=(x1-first)*1.0
                for h in heads:
                    # 선형 근사: 첫 음 위치를 0박, 마디 끝에서 4박 (+패딩 보정)
                    beat=(h['x']-first)/(x1-first+ (first-x0)) * 4 + (first-x0)/(x1-x0)*4*0.0
                    beat=(h['x']-x0-6)/(x1-x0-6)*4
                    beat=max(0,round(beat*2)/2)
                    acc=None
                    for a in accs:
                        if 0<h['x']-a['x']<=14 and abs(a['k']-h['k'])<=0.7: acc=a['gid']
                    d=(30 if CLEF[s]=='G' else 18)+round(h['k'])
                    L=LETTERS[d%7]; alter=-1 if L in KEYFLATS else 0
                    if acc==FLAT: alter=-1
                    elif acc==NAT: alter=0
                    dur=4.0 if h['gid'] in (84,199) and False else (1.0)
                    if h['gid']==84: dur=4.0
                    elif h['gid']==199: dur=2.0
                    notes.append(dict(measure=mg+mi,staff=NAMES[s],start=beat,dur=dur,midi=12*(d//7+1)+BASE[d%7]+alter,L=L,acc=acc,k=round(h['k'])))
        mg+=sum(1 for i in range(len(b)-1) if b[i+1]-b[i]>=20)
    return notes
if __name__=='__main__':
    p=run(); print('piano notes',len(p))
    base=json.load(open(os.environ.get('TRUTH_JSON','truth_notes.json')))
    base=[x for x in base if not x['staff'].startswith('Piano')]
    json.dump(base+p,open(os.environ.get('TRUTH_ALL_JSON','truth_notes_all.json'),'w'))
    # 피아노 리듬은 음표 머리의 x 좌표를 마디 안에서 선형으로 늘려 8분음표에 맞춘 거친 근사다 (박 단위 평가에는 쓰지 말고 마디 단위로만 쓴다)
    NAME=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
    nm=lambda m:NAME[m%12]+str(m//12-1)
    for m in (0,1,7,9):
        row=sorted([(x['staff'],x['start'],nm(x['midi'])) for x in p if x['measure']==m], key=lambda r:(r[0],r[1]))
        print('m',m+1,row[:24])
