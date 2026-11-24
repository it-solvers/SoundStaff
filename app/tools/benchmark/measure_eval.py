import os, sys, json, collections, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from evaluate import mine_sets
NAME=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
nm=lambda m:NAME[m%12]+str(m//12-1)
def truth_by_measure(path=None):
    path=path or os.environ.get('TRUTH_ALL_JSON','truth_notes_all.json')
    n=json.load(open(path)); d=collections.defaultdict(set)
    for x in n: d[x['measure']].add(x['midi'])
    return d
def mine_by_measure(M):
    d=collections.defaultdict(set)
    for t,s in M.items(): d[t//16]|=s
    return d
def evaluate(path, shift=0):
    TM=truth_by_measure(); M=mine_sets(path); MM=mine_by_measure({t:s for t,s in M.items()})
    P=R=n=0; octerr=0; phantom=0; tot=0; hi=[0,0]; lo=[0,0]
    for m in range(12):
        a=TM[m]; b=MM[m]
        if not a and not b: continue
        n+=1
        P+=len(a&b)/max(len(b),1); R+=len(a&b)/max(len(a),1)
        for x in b:
            tot+=1
            if x not in a:
                if x%12 in {y%12 for y in a}: octerr+=1
                else: phantom+=1
    P/=n; R/=n
    return dict(measure_precision=round(P,3),measure_recall=round(R,3),f1=round(2*P*R/(P+R),3),octave_errors=octerr,wrong_pitchclass=phantom,my_notes=tot)
if __name__=='__main__':
    for p in sys.argv[1:]: print(p.split('/')[-1][:30].ljust(30),evaluate(p))
