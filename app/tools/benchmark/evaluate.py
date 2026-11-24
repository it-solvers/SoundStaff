import sys, json, collections
import xml.etree.ElementTree as ET
import os
TRUTH=os.environ.get('TRUTH_JSON','truth_notes.json')
STEP={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def truth_sets(staffs=None):
    """정답: 16분음표 칸마다 울리는 음(midi) 집합"""
    n=json.load(open(TRUTH))
    sets=collections.defaultdict(set)
    for x in n:
        if staffs and x['staff'] not in staffs: continue
        s0=x['measure']*16+round(x['start']*4); s1=s0+round(x['dur']*4)
        for s in range(s0,s1): sets[s].add(x['midi'])
    return sets
def mine_sets(path):
    r=ET.parse(path).getroot(); sets=collections.defaultdict(set); base=0
    for part in r.iter('part'):
        base=0
        for m in part.iter('measure'):
            pos=0; last=0; mx=0
            for e in m:
                if e.tag=='note':
                    dur=int(e.findtext('duration','0')); chord=e.find('chord') is not None
                    st=last if chord else pos
                    p=e.find('pitch')
                    if p is not None:
                        midi=12*(int(p.findtext('octave'))+1)+STEP[p.findtext('step')]+int(float(p.findtext('alter') or 0))
                        for s in range(base+st,base+st+dur): sets[s].add(midi)
                    if not chord: last=pos; pos+=dur; mx=max(mx,pos)
                elif e.tag=='backup': pos-=int(e.findtext('duration'))
                elif e.tag=='forward': pos+=int(e.findtext('duration')); mx=max(mx,pos)
            base+=max(mx,16)
    return sets
def f1(p,r): return 0 if p+r==0 else 2*p*r/(p+r)
def score(T,M,shift=0,step=2,end=192):
    pcs=lambda S:{m%12 for m in S}
    P=R=0; n=0; Pe=Re=0; bass=0; nb=0
    for t in range(0,end,step):
        a=T.get(t,set()); b=M.get(t+shift,set())
        if not a and not b: continue
        n+=1
        A,B=pcs(a),pcs(b)
        if B: P+=len(A&B)/len(B)
        if A: R+=len(A&B)/len(A)
        if b: Pe+=len(a&b)/len(b)
        if a: Re+=len(a&b)/len(a)
        if a and b:
            nb+=1; bass+= (min(a)%12==min(b)%12)
    P/=n; R/=n; Pe/=n; Re/=n
    return dict(pc_precision=round(P,3),pc_recall=round(R,3),pc_f1=round(f1(P,R),3),pitch_f1=round(f1(Pe,Re),3),bass_ok=round(bass/max(nb,1),3))
def segments(S,end=192):
    segs=0; prev=None
    for t in range(0,end):
        c=frozenset(S.get(t,set()))
        if c!=prev and c: segs+=1
        prev=c
    return segs
def best(T,M):
    out=None
    for sh in range(-6,7):
        s=score(T,M,sh)
        if out is None or s['pc_f1']>out[1]['pc_f1']: out=(sh,s)
    return out
if __name__=='__main__':
    T=truth_sets({'Flute','Oboe','Trombone','Violin','Cello','Soprano','Bass'})
    Tc=truth_sets({'Soprano','Bass'})
    for path in sys.argv[1:]:
        M=mine_sets(path)
        sh,s=best(T,M); shc,sc=best(Tc,M)
        print(path.split('/')[-1][:40].ljust(40),'shift',sh,'ALL7',s,'| CHOIR',shc,sc,'| chord segments mine',segments(M),'truth',segments(T),'choir',segments(Tc))
