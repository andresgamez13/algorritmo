import json, sys, collections
g=json.load(open(sys.argv[1])); out=sys.argv[2]
N={n['id']:n for n in g['nodes']}
INF=['CoverOf','DirectlySamples','InterpolatesFrom','InStyleOf','LyricalReferenceTo']
works={i for i,n in N.items() if n['Node Type'] in('Song','Album')}
art={i for i,n in N.items() if n['Node Type'] in('Person','MusicalGroup')}
perf=collections.defaultdict(set); crew=collections.defaultdict(set)
for l in g['links']:
    if l['target'] in works:
        if l['Edge Type']=='PerformerOf': perf[l['target']].add(l['source'])
        if l['Edge Type'] in('PerformerOf','ComposerOf','LyricistOf','ProducerOf'): crew[l['target']].add(l['source'])
# influence: source work takes from target work
took_from=collections.defaultdict(list); influenced=collections.defaultdict(list)
for l in g['links']:
    if l['Edge Type'] in INF and l['source'] in works and l['target'] in works:
        influenced[l['target']].append((l['source'],l['Edge Type'])); took_from[l['source']].append((l['target'],l['Edge Type']))
yr=lambda w:int(N[w]['release_date'])
def wbrief(w,t=None):
    d={'id':w,'n':N[w]['name'],'y':yr(w),'g':N[w]['genre']}
    if t: d['t']=t
    return d
gc=collections.Counter(N[w]['genre'] for w in works)
genres=[x for x,_ in gc.most_common()]
TL={}
for G in genres:
    ws=[w for w in works if N[w]['genre']==G]
    ws.sort(key=lambda w:(-len(influenced[w]),-N[w]['notable'],yr(w)))
    top=ws[:32]
    TL[G]=[{'id':w,'n':N[w]['name'],'y':yr(w),'nt':bool(N[w]['notable']),'k':'Álbum' if N[w]['Node Type']=='Album' else 'Canción',
            'p':sorted(N[x]['name'] for x in perf[w])[:5],
            'out':[wbrief(s,t) for s,t in sorted(influenced[w],key=lambda x:yr(x[0]))],
            'inn':[wbrief(s,t) for s,t in sorted(took_from[w],key=lambda x:yr(x[0]))[:5]],
            'nout':len(influenced[w])} for w in sorted(top,key=yr)]
# artists
aw=collections.defaultdict(list)
for w,ps in perf.items():
    for p in ps: aw[p].append(w)
AR={}
for G in genres:
    lst=[]
    for a,ws in aw.items():
        gg=collections.Counter(N[w]['genre'] for w in ws).most_common(1)[0][0]
        if gg!=G or len(ws)<2 or not any(N[w]['notable'] for w in ws): continue
        inf=[[yr(s),t] for w in ws for s,t in influenced[w]]
        co=len({x for w in ws for x in crew[w]}-{a})
        lst.append({'id':a,'n':N[a]['name'],'k':'Grupo' if N[a]['Node Type']=='MusicalGroup' else 'Persona','w':[[yr(w),int(bool(N[w]['notable']))] for w in sorted(ws,key=yr)],'inf':inf,'co':co})
    lst.sort(key=lambda d:-(sum(x[1] for x in d['w'])*2+len(d['inf'])))
    AR[G]=lst[:150]
json.dump({'genres':[{'g':x,'n':gc[x]} for x in genres],'tl':TL,'ar':AR},open(out,'w'),ensure_ascii=False,separators=(',',':'))
print(len(genres),genres[:8]); print({G:len(AR[G]) for G in genres})
print(TL['Oceanus Folk'][0])
