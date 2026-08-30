#!/usr/bin/env python3
"""Build the Profiler ecosystem relationship graph (profiler-graph.json).

Merges every dossier's curated relationships[] and derived cross-mentions into
unified bidirectional edges (schema: repository-information/PROFILER-SCHEMA.md
→ Relationship graph). The app's Relationships tab reads this to show INBOUND
evidence — what other dossiers record about a company — alongside the
dossier's own outbound account, and the Network explorer queries it whole.

    python3 scripts/build-profiler-graph.py          # rebuild the graph
    python3 scripts/build-profiler-graph.py --check  # report drift, exit 1 if stale

REQUIRED after any profile write (sibling of sync-profiler-registry.py): a
stale graph silently hides new relationships from every tab.

The derivation below MIRRORS ovRelDerive/ovRelSentences in Profiler.html
(name scan over summary / ecosystemRole / strategyRead / product description
and positioning / developments; word-boundary match; ambiguous one-word names
dropped at sentence starts). If one changes, change both.
"""
import json, re, sys, datetime

DATA = 'live-site-pages/profiler-data'
OUT = f'{DATA}/profiler-graph.json'

# Excluded pairs (developer directive 2026-08-29): derived-only edges whose
# entire evidence is an anti-relationship sentence ("no X ties found") carry
# no intelligence value — the sentence explicitly denies a link. Both pairs
# below exist solely on Terra-Gen's "No Hithium history or contact found; no
# CATL/EVE/Sungrow/Tesla ties found" line. Curated links are never excluded;
# add a pair here only when every evidence sentence is a denial.
EXCLUDED_PAIRS = {
    ('catl', 'terra-gen'),
    ('sungrow', 'terra-gen'),
}

def sentences(text, rx, ambiguous):
    out = []
    for m in rx.finditer(text):
        if ambiguous and re.search(r'(^|[.!?:]\s*)$', text[:m.start()]):
            continue
        s = 0
        for i in range(m.start(), 0, -1):
            ch = text[i - 1]
            if ch in '.!?' and (i >= len(text) or text[i].isspace()):
                s = i; break
        e = len(text)
        for i in range(m.start(), len(text)):
            ch = text[i]
            if ch in '.!?' and (i + 1 >= len(text) or text[i + 1].isspace()):
                e = i + 1; break
        sent = text[s:e].strip()
        if sent and sent not in out:
            out.append(sent)
    return out

SEC_LABELS = {'snapshot': 'Summary', 'strategy': 'Key Judgments', 'products': 'Capabilities', 'devs': 'Recent Reporting'}

def strat_text(b):
    return b if isinstance(b, str) else str(b)

def derive_pair_evidence(slug, p, names):
    """All derived mentions in `p` of other covered companies, keyed by slug."""
    prose = []
    if p.get('summary'): prose.append((SEC_LABELS['snapshot'], str(p['summary'])))
    if p.get('ecosystemRole'): prose.append((SEC_LABELS['snapshot'], str(p['ecosystemRole'])))
    for b in p.get('strategyRead') or []:
        prose.append((SEC_LABELS['strategy'], strat_text(b)))
    for prod in p.get('productsAndServices') or []:
        for k in ('description', 'positioning'):
            if prod.get(k):
                prose.append((SEC_LABELS['products'] + (' · ' + prod['name'] if prod.get('name') else ''), str(prod[k])))
    devs = [{'date': ev.get('date') or '', 'src': ev.get('source') or '',
             'text': ' — '.join(x for x in (ev.get('headline') or '', ev.get('read') or '') if x)}
            for ev in p.get('recentDevelopments') or []]
    out = {}
    for other, name in names.items():
        if other == slug: continue
        rx = re.compile(r'\b' + re.escape(name) + r'\b')
        ambiguous = ' ' not in name and re.match(r'^[A-Z][a-z]+$', name) is not None
        evid = []
        for where, text in prose:
            for sent in sentences(text, rx, ambiguous):
                evid.append({'where': where, 'date': '', 'text': sent, 'src': ''})
        for d in devs:
            m = rx.search(d['text'])
            if not m: continue
            if ambiguous and re.search(r'(^|[.!?:]\s*)$', d['text'][:m.start()]): continue
            evid.append({'where': SEC_LABELS['devs'], 'date': d['date'], 'text': d['text'], 'src': d['src']})
        if evid: out[other] = evid
    return out

def main():
    check = '--check' in sys.argv
    reg = json.load(open(f'{DATA}/profiler-companies.json'))
    names = {c['slug']: c['name'] for c in reg['companies']}
    profs = {}
    for slug in names:
        try:
            profs[slug] = json.load(open(f'{DATA}/{slug}.profile.json'))
        except FileNotFoundError:
            print(f'  WARN  {slug}: no profile file — skipped')
    edges = {}
    def edge(x, y):
        key = (min(x, y), max(x, y))
        if key not in edges:
            edges[key] = {'a': key[0], 'b': key[1], 'curated': {}, 'evid': [], 'last': ''}
        return edges[key]
    CURATED_FIELDS = ('type', 'note', 'context', 'source', 'status', 'since', 'scale')
    for slug, p in profs.items():
        for r in p.get('relationships') or []:
            if r.get('slug') not in names: continue
            e = edge(slug, r['slug'])
            side = 'a' if e['a'] == slug else 'b'
            e['curated'][side] = {k: r[k] for k in CURATED_FIELDS if r.get(k)}
        for other, evid in derive_pair_evidence(slug, p, names).items():
            e = edge(slug, other)
            side = 'a' if e['a'] == slug else 'b'
            for item in evid:
                e['evid'].append(dict(item, **{'from': side}))
    edges = {k: v for k, v in edges.items() if k not in EXCLUDED_PAIRS}
    for e in edges.values():
        dates = [i['date'] for i in e['evid'] if i.get('date')]
        for side in e['curated'].values():
            if side.get('since'): dates.append(side['since'])
        e['last'] = max(dates) if dates else ''
        if not e['curated']: del e['curated']
    graph = {'schemaVersion': 1,
             'built': datetime.date.today().isoformat(),
             'companies': len(profs),
             'edges': sorted(edges.values(), key=lambda e: (e['a'], e['b']))}
    new = json.dumps(graph, indent=1, ensure_ascii=False) + '\n'
    try:
        old = open(OUT).read()
    except FileNotFoundError:
        old = ''
    def canon(s):  # ignore the build date when comparing
        return re.sub(r'"built": "[0-9-]+"', '"built": ""', s)
    if check:
        stale = canon(old) != canon(new)
        print(('STALE — rebuild with python3 scripts/build-profiler-graph.py' if stale else 'graph is current')
              + f' ({len(edges)} edges)')
        sys.exit(1 if stale else 0)
    open(OUT, 'w').write(new)
    n_cur = sum(1 for e in edges.values() if e.get('curated'))
    print(f'wrote {OUT}: {len(edges)} edges ({n_cur} curated), {sum(len(e["evid"]) for e in edges.values())} evidence items')

if __name__ == '__main__':
    main()
# Developed by: LightAISolutions
