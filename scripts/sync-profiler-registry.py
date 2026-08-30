#!/usr/bin/env python3
"""Sync denormalized per-company summary fields in profiler-companies.json
from the individual <slug>.profile.json dossiers.

The roster deliberately renders from the registry alone (one fetch, no
per-card profile loads — see "Recall design" in .claude/rules/profiler-app.md),
so anything the roster displays about a dossier must be denormalized here.
Denormalized data drifts; this script is the reconciliation. Run it after any
pass that adds or revises profiles, and any time the roster looks out of step:

    python3 scripts/sync-profiler-registry.py          # write changes
    python3 scripts/sync-profiler-registry.py --check  # report drift, exit 1 if any

Fields synced per company:
    lastUpdated  — copied from the profile
    srcTotal     — number of cited sources
    srcFirstPct  — first-party share (company + disclosure), percent, rounded
    kpiNorm      — true when a schema-v4 normalized annual revenue exists

The provenance classification below MIRRORS ovSourceParty in Profiler.html
(registry `domains` match -> company; filing/wire hosts -> disclosure;
per-source `party` overrides everything). If one changes, change both.
"""
import json, sys, re

REG_PATH = 'live-site-pages/profiler-data/profiler-companies.json'
PROFILE_PATH = 'live-site-pages/profiler-data/{slug}.profile.json'

WIRE_HOSTS = ['prnewswire.com', 'businesswire.com', 'globenewswire.com', 'newswire.ca',
              'accesswire.com', 'prnasia.com', 'acnnewswire.com', 'jcnnewswire.com', 'presseportal.de']
FILING_HOSTS = ['sec.gov', 'hkexnews.hk', 'hkex.com.hk', 'sse.com.cn', 'szse.cn',
                'cninfo.com.cn', 'dart.fss.or.kr', 'tdnet.info', 'jpx.co.jp', 'six-group.com',
                'londonstockexchange.com', 'sedar.com', 'asx.com.au']

def host_of(url):
    m = re.match(r'^https?://([^/?#]+)', str(url or ''), re.I)
    if not m: return ''
    h = m.group(1).lower()
    h = re.sub(r':\d+$', '', h)
    return h[4:] if h.startswith('www.') else h

def host_in(host, hosts):
    return any(host == d or host.endswith('.' + d) for d in hosts)

def source_party(src, domains):
    declared = (src or {}).get('party') or ''
    if declared in ('company', 'disclosure', 'independent'): return declared
    h = host_of((src or {}).get('url'))
    if not h: return 'independent'
    if host_in(h, domains): return 'company'
    if host_in(h, FILING_HOSTS) or host_in(h, WIRE_HOSTS): return 'disclosure'
    return 'independent'

def has_norm_revenue(profile):
    for per in (profile.get('financials') or {}).get('periods') or []:
        if per.get('periodType') != 'annual': continue
        for m in per.get('metrics') or []:
            if m.get('kpi') == 'revenue' and isinstance(m.get('usdMillions'), (int, float)):
                return True
    return False

def main():
    check = '--check' in sys.argv
    reg = json.load(open(REG_PATH))
    changed = []
    for c in reg['companies']:
        slug = c['slug']
        try:
            p = json.load(open(PROFILE_PATH.format(slug=slug)))
        except FileNotFoundError:
            print(f'  WARN  {slug}: no profile file — skipped')
            continue
        domains = c.get('domains') or []
        srcs = p.get('sources') or []
        fp = sum(1 for s in srcs if source_party(s, domains) in ('company', 'disclosure'))
        want = {
            'lastUpdated': p.get('lastUpdated') or c.get('lastUpdated'),
            'srcTotal': len(srcs),
            'srcFirstPct': round(fp / len(srcs) * 100) if srcs else 0,
            'kpiNorm': has_norm_revenue(p),
        }
        diffs = {k: (c.get(k), v) for k, v in want.items() if c.get(k) != v}
        if diffs:
            changed.append((slug, diffs))
            c.update(want)
    if changed:
        for slug, diffs in changed:
            print(f'  {slug}: ' + ', '.join(f'{k} {a!r} -> {b!r}' for k, (a, b) in diffs.items()))
    print(f'{len(changed)} of {len(reg["companies"])} entries ' + ('out of sync' if check else 'updated'))
    if check:
        sys.exit(1 if changed else 0)
    if changed:
        with open(REG_PATH, 'w') as f:
            json.dump(reg, f, indent=2, ensure_ascii=False)
            f.write('\n')

if __name__ == '__main__':
    main()
# Developed by: LightAISolutions
