#!/usr/bin/env python3
"""Harvest executive headshots for Profiler dossiers.

Two permitted tracks (see PROFILER-SCHEMA.md "Photo policy"):
  first-party  -- the company's own leadership/management pages
  commons      -- Wikimedia Commons portraits of public figures, license-verified,
                  attribution captured into the profile's photoCredit field
LinkedIn, news-agency/wire photos and video frame-grabs are never used.

Subcommands
  gaps        write the list of execs still missing a photo
  firstparty  crawl company sites and stage candidates
  commons     resolve Wikipedia biography lead images and stage candidates
  sheet       build + screenshot a "WHO IT SHOULD BE" verification contact sheet
  wire        insert verified photos into the profile JSONs

Verification is NOT optional: run `sheet`, read the screenshot, and drop every
image that is not unmistakably the named person before running `wire`. Prior
sweeps have staged company logos, blog banners and group shots that passed
name scoring cleanly.

Environment notes (verified 2026-08-22, Claude Code web sandbox):
  * Playwright/Chromium cannot reach general internet hosts through the agent
    proxy; curl/requests reach the same hosts fine. JS-rendered leadership pages
    are therefore unreachable and only server-rendered pages harvest. This was
    diagnosed properly rather than assumed -- do not spend another session on it:
      - Chromium DOES honour the proxy: launching with a deliberately wrong
        proxy port yields ERR_PROXY_CONNECTION_FAILED, the real port does not.
      - Its NSS trust store starts EMPTY, so the proxy's re-terminated TLS fails
        as ERR_CERT_AUTHORITY_INVALID. Fixable, and worth fixing before any
        retest:  apt-get install -y libnss3-tools && certutil -d sql:$HOME/.pki/nssdb \
          -A -t "C,," -n ccr-agent-proxy -i /root/.ccr/agent-proxy-ca.crt
      - After that fix github.com returns a real HTTP status, but every other
        host still resets, with nothing logged in the proxy's recentRelayFailures
        and with --disable-quic/--disable-http2 making no difference. That is an
        upstream egress-policy behaviour, not a client bug: per /root/.ccr/README.md
        it must be reported to an administrator, never routed around.
  * Wikimedia's action API (/w/api.php) is blanket-HTTP-429 from here. The REST
    summary endpoint, Commons File: page HTML and Special:FilePath all work.
  * Regulatory filings (A-share/HKEX annual reports) carry no executive photos;
    only designed ESG/annual reports do, and those show boards rather than full
    executive teams. See the pdf track below.

Usage:
  python3 scripts/harvest-exec-photos.py gaps /tmp/gaps.json
  python3 scripts/harvest-exec-photos.py firstparty /tmp/gaps.json /tmp/cand
  python3 scripts/harvest-exec-photos.py commons /tmp/gaps.json /tmp/cand-cc
  python3 scripts/harvest-exec-photos.py sheet /tmp/cand/_candidates.json /tmp/sheets
  python3 scripts/harvest-exec-photos.py wire /tmp/accepted.json

"""
import glob
import html as htmllib
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse as up
from concurrent.futures import ThreadPoolExecutor

import requests

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(REPO, "live-site-pages", "profiler-data")
IMGDIR = os.path.join(REPO, "live-site-pages", "images", "execs")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
HDRS = {"User-Agent": UA}
TIMEOUT = 10
MIN_BYTES, MAX_BYTES = 4000, 12 * 1024 ** 2

# ---------------------------------------------------------------- names ----
HONOR = re.compile(r"^(dr\.?-?ing\.?|dr\.?|prof\.?|mr\.?|ms\.?|mrs\.?|ing\.?)\s+", re.I)
SUFFIX = re.compile(r",?\s+(jr\.?|sr\.?|iii|ii|iv|phd|ph\.d\.?|mba)\.?$", re.I)
CJK = re.compile(r"[㐀-鿿가-힯぀-ヿ]")
PAREN = re.compile(r"\(([^)]*)\)")
QUOTED = re.compile(r"[\"'‘“]([A-Za-z][A-Za-z .-]{1,28})[\"'’”]")


def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def basename_form(raw):
    """The plain 'Firstname Lastname' reading: honorifics/CJK/nicknames stripped."""
    b = QUOTED.sub(" ", PAREN.sub(" ", raw))
    b = re.split(r"[—–|]", b)[0]
    b = SUFFIX.sub("", HONOR.sub("", CJK.sub(" ", b).strip()))
    return re.sub(r"\s+", " ", b).strip(" ,-")


def aliases(raw):
    """Every plausible written form of a name, as (full, first, last) tuples.

    Profile names carry honorifics, CJK renderings and nicknames --
    'Wu Zuyu (...) -- "Jeff Wu"', 'James (Jim) Moos', "Thomas M. 'Tommy' Holder".
    Matching the raw string alone misses all of these.
    """
    extra = [q.strip() for q in QUOTED.findall(raw)]
    nick = [p.strip() for p in PAREN.findall(raw) if p.strip() and not CJK.search(p)]
    base = basename_form(raw)
    toks = [t for t in base.split() if t]

    cands = [base] + extra
    for nk in nick:
        if toks:
            cands += [" ".join([nk] + toks[1:]), f"{nk} {toks[-1]}"]
    if len(toks) > 2:
        cands.append(f"{toks[0]} {toks[-1]}")
    cands += [a for a in extra if len(a.split()) >= 2]

    forms = set()
    for c in cands:
        t = [x for x in norm(c).split() if len(x) > 1]
        if len(t) >= 2:
            forms.add((" ".join(t), t[0], t[-1]))
        elif t:
            forms.add((t[0], t[0], t[0]))
    return sorted(forms)


def filestem(raw):
    """Surname slug for image filenames, matching the existing <slug>-<last>."""
    toks = [t for t in norm(basename_form(raw)).split() if len(t) > 1]
    return (re.sub(r"[^a-z0-9]", "", toks[-1]) if toks
            else re.sub(r"[^a-z]", "", norm(raw))[:14] or "exec")


# ------------------------------------------------------------- fetching ----
def get(url, tries=1, **kw):
    for i in range(tries):
        try:
            r = requests.get(url, headers=HDRS, timeout=TIMEOUT,
                             allow_redirects=True, **kw)
        except Exception:
            time.sleep(2 * (i + 1))
            continue
        if r.status_code == 429 and i + 1 < tries:
            time.sleep(3 + 3 * i)
            continue
        return r
    return None


def is_html(r):
    return r is not None and r.ok and "html" in r.headers.get("content-type", "")


def download(url, dest_stem):
    r = get(url)
    if r is None or not r.ok or "image" not in r.headers.get("content-type", ""):
        return None
    if not (MIN_BYTES <= len(r.content) <= MAX_BYTES):
        return None
    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
           "image/avif": ".avif"}.get(
        r.headers["content-type"].split(";")[0].strip(), ".jpg")
    path = dest_stem + ext
    with open(path, "wb") as fh:
        fh.write(r.content)
    return path


# ----------------------------------------------------------------- gaps ----
def load_gaps():
    out = []
    for f in sorted(glob.glob(os.path.join(DATA, "*.profile.json"))):
        d = json.load(open(f, encoding="utf-8"))
        dm = d.get("decisionMakers") or []
        miss = [p for p in dm if isinstance(p, dict) and not p.get("photo")]
        if miss:
            out.append({"slug": d["slug"], "name": d.get("name"),
                        "website": d.get("website"),
                        "missing": [{"name": p.get("name"),
                                     "title": (p.get("title") or "")[:70]}
                                    for p in miss]})
    return out


def coverage():
    tot = have = 0
    for f in glob.glob(os.path.join(DATA, "*.profile.json")):
        dm = json.load(open(f, encoding="utf-8")).get("decisionMakers") or []
        dm = [p for p in dm if isinstance(p, dict)]
        tot += len(dm)
        have += sum(1 for p in dm if p.get("photo"))
    return have, tot


# ---------------------------------------------------------- first party ----
IMG_RE = re.compile(r"<img\b[^>]*>", re.I)
ATTR_RE = re.compile(r'([a-zA-Z_:-]+)\s*=\s*["\']([^"\']*)["\']')
TAG_RE = re.compile(r"<[^>]+>")
A_RE = re.compile(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.{0,120}?)</a>', re.I | re.S)
SKIP_IMG = re.compile(
    r"(logo|icon|sprite|placeholder|banner|hero|badge|award|arrow|social|facebook|"
    r"twitter|linkedin|youtube|instagram|favicon|spacer|bg-|background|pattern|"
    r"template|default)", re.I)
HUB = re.compile(r"(about|company|corporate|who-we-are|investor|governance|"
                 r"leadership|management|team|people|organization)", re.I)
LEAF = re.compile(r"(leadership|management|executive|board|our-team|our-people|"
                  r"senior|directors|officers|team)", re.I)


def same_site(u, base):
    def reg(h):
        p = h.split(":")[0].split(".")
        return ".".join(p[-2:]) if len(p) >= 2 else h
    return reg(up.urlparse(u).netloc) == reg(up.urlparse(base).netloc)


def links(page_html, base):
    out = []
    for href, label in A_RE.findall(page_html):
        u = up.urljoin(base, htmllib.unescape(href)).split("#")[0].rstrip("/")
        if u.startswith("http") and same_site(u, base):
            out.append((u, re.sub(r"\s+", " ", TAG_RE.sub(" ", label)).strip()))
    return out


def leadership_pages(site, cap=30):
    """Walk the site's own links: homepage -> about/company hubs -> leaf pages.

    Blind path-guessing was tried first and mostly missed: global.abb, byd.com
    and jinkosolar.com all serve 200 but put leadership outside any common
    pattern, so the crawl follows real navigation instead.
    """
    r = get(site.rstrip("/"))
    if not is_html(r):
        return []
    hubs, leaves, seen = [], [], {r.url}
    for u, lbl in links(r.text, r.url):
        if u in seen:
            continue
        seen.add(u)
        if LEAF.search(u) or LEAF.search(lbl):
            leaves.append(u)
        elif HUB.search(u) or HUB.search(lbl):
            hubs.append(u)

    def expand(u):
        rr = get(u)
        return ([x for x, lbl in links(rr.text, rr.url)
                 if LEAF.search(x) or LEAF.search(lbl)] if is_html(rr) else [])

    with ThreadPoolExecutor(max_workers=6) as ex:
        for got in ex.map(expand, hubs[:14]):
            for u in got:
                if u not in seen:
                    seen.add(u)
                    leaves.append(u)
    leaves.sort(key=lambda u: (0 if re.search(r"(leadership|management|executive)",
                                              u, re.I) else 1, len(u)))
    return leaves[:cap]


def img_records(page_html, base):
    """(src, alt, context) for every plausible headshot <img> on a page."""
    recs = []
    for m in IMG_RE.finditer(page_html):
        attrs = {k.lower(): v for k, v in ATTR_RE.findall(m.group(0))}
        src = (attrs.get("src") or attrs.get("data-src") or attrs.get("data-lazy-src")
               or attrs.get("data-original") or "")
        if not src and attrs.get("srcset"):
            src = attrs["srcset"].split(",")[0].strip().split(" ")[0]
        if not src or src.startswith("data:") or SKIP_IMG.search(src):
            continue
        alt = " ".join(filter(None, [attrs.get("alt", ""), attrs.get("title", "")]))
        lo, hi = max(0, m.start() - 700), min(len(page_html), m.end() + 700)
        ctx = re.sub(r"\s+", " ", TAG_RE.sub(" ", page_html[lo:hi]))
        recs.append((up.urljoin(base, htmllib.unescape(src)), alt, ctx))
    return recs


def score(rec, forms):
    """Best 0-100 confidence across a name's alias forms."""
    src, alt, ctx = rec
    nalt, nctx = norm(alt), norm(ctx)
    slug = norm(up.unquote(up.urlparse(src).path.rsplit("/", 1)[-1]))
    best = 0
    for full, first, last in forms:
        if full and full in nalt:
            best = max(best, 100)
        if f"{first} {last}" in slug or f"{last} {first}" in slug:
            best = max(best, 95)
        if last in nalt.split() and first in nalt:
            best = max(best, 85)
        if len(last) >= 6 and last in slug.split():
            best = max(best, 70)
        if len(last) >= 5 and re.search(rf"\b{re.escape(last)}\b", slug):
            best = max(best, 62)
        if full and full in nctx:
            best = max(best, 55)
    return best


def run_firstparty(gaps, outdir, threshold=62):
    """Stage the best first-party candidate per missing exec.

    Threshold defaults above the context-only tier: bare page-text proximity
    produced logos and blog banners, so a match needs alt-text or filename
    evidence to be staged at all.
    """
    os.makedirs(outdir, exist_ok=True)
    flat = []

    def one(co):
        site = (co.get("website") or "").strip()
        if not site:
            return co["slug"], {}, 0
        targets = {p["name"]: aliases(p["name"]) for p in co["missing"]}
        best, seen = {}, 0
        pages = leadership_pages(site)
        with ThreadPoolExecutor(max_workers=6) as ex:
            for r in ex.map(get, pages):
                if not is_html(r):
                    continue
                seen += 1
                recs = img_records(r.text, r.url)
                for ename, forms in targets.items():
                    for rec in recs:
                        s = score(rec, forms)
                        if s >= threshold and s > best.get(ename, (0,))[0]:
                            best[ename] = (s, rec[0], r.url, rec[1][:90])
        return co["slug"], best, seen

    with ThreadPoolExecutor(max_workers=5) as ex:
        for slug, best, npages in ex.map(one, gaps):
            used = set()
            for ename, (s, img, page, alt) in sorted(best.items()):
                stem = filestem(ename)
                if stem in used:                 # two execs, one surname
                    stem = f"{stem}-{norm(ename).split()[0]}"
                used.add(stem)
                path = download(img, os.path.join(outdir, f"{slug}-{stem}"))
                if path:
                    flat.append({"exec": ename, "slug": slug, "score": s, "file": path,
                                 "img": img, "page": page, "alt": alt})
            print(f"[{len(best):2d}] {slug:24s} pages={npages}", flush=True)
    json.dump(flat, open(os.path.join(outdir, "_candidates.json"), "w"), indent=1)
    print(f"\nfirst-party staged: {len(flat)}")
    return flat


# -------------------------------------------------------------- commons ----
REST = "https://en.wikipedia.org/api/rest_v1/page/summary/"
FILEPAGE = "https://commons.wikimedia.org/wiki/File:"
FILEPATH = "https://commons.wikimedia.org/wiki/Special:FilePath/"
ROLE = re.compile(r"\b(executive|officer|ceo|cfo|coo|cto|chief|president|chair|"
                  r"founder|businessman|businesswoman|entrepreneur|engineer|"
                  r"director|manager)\b", re.I)
BAD_LIC = re.compile(r"(fair\s*use|non[- ]?free|no derivatives|\bND\b|"
                     r"NonCommercial|\bNC\b|all rights reserved)", re.I)
GOOD_LIC = re.compile(r"(CC[ -]BY[ -]SA[ -][0-9.]+|CC[ -]BY[ -][0-9.]+|CC0|"
                      r"public domain)", re.I)


def find_article(raw_name, company):
    """A biography summary whose own text corroborates the company and a role.

    Uses the article's lead image rather than a Commons filename search: a
    biography's lead image depicts its subject, whereas filename scoring once
    matched a cottage window to an executive's name.
    """
    key = re.sub(r"[^a-z ]", "", (company or "").lower()).split()
    if not key:
        return None
    key = key[0]
    tried = set()
    for full, first, last in aliases(raw_name):
        for cand in (basename_form(raw_name), full.title(),
                     f"{first.title()} {last.title()}"):
            cand = cand.strip()
            if not cand or cand.lower() in tried:
                continue
            tried.add(cand.lower())
            r = get(REST + cand.replace(" ", "_"), tries=3)
            time.sleep(0.7)
            if r is None or not r.ok:
                continue
            try:
                d = r.json()
            except Exception:
                continue
            if d.get("type") == "disambiguation":
                continue
            ex = (d.get("extract") or "") + " " + (d.get("description") or "")
            if key not in ex.lower() or not ROLE.search(ex):
                continue
            img = ((d.get("originalimage") or {}).get("source")
                   or (d.get("thumbnail") or {}).get("source"))
            if img:
                return {"title": d.get("title"), "img": img.split("?")[0],
                        "url": (d.get("content_urls", {}).get("desktop", {})
                                or {}).get("page", "")}
    return None


def license_of(img_url):
    """(ok, license, attribution, filename) parsed off the Commons File: page."""
    fn = re.sub(r"^\d+px-", "", img_url.rsplit("/", 1)[-1])
    r = get(FILEPAGE + fn, tries=3)
    if r is None or not r.ok:
        return False, "file page unreachable", "", fn
    page = r.text
    blk = re.search(r'(?is)id="Licensing".{0,6000}', page)
    if blk and BAD_LIC.search(blk.group(0)):
        return False, "restricted license", "", fn
    m = GOOD_LIC.search(page)
    if not m:
        return False, "no free license found", "", fn
    lic = re.sub(r"\s+", " ", m.group(0)).upper().replace("PUBLIC DOMAIN", "Public domain")
    # Wikimedia's own attribution style, matching credits already in the repo
    lic = re.sub(r"\bCC-BY-SA-([0-9.]+)", r"CC BY-SA \1", lic)
    lic = re.sub(r"\bCC-BY-([0-9.]+)", r"CC BY \1", lic)
    au = re.search(r'(?is)<td[^>]*>\s*(?:<[^>]+>\s*)*Author\s*</td>\s*<td[^>]*>(.{0,400}?)</td>',
                   page)
    artist = (re.sub(r"\s+", " ", TAG_RE.sub(" ", au.group(1))).strip()[:70]
              if au else "") or "Unknown author"
    return True, lic, f"{artist}, {lic}, via Wikimedia Commons", fn


def run_commons(gaps, outdir):
    """Serial by design -- Wikimedia rate-limits this egress hard."""
    os.makedirs(outdir, exist_ok=True)
    out, rej = [], 0
    for co in gaps:
        used = set()
        for p in co["missing"]:
            art = find_article(p["name"], co["name"])
            if not art:
                continue
            ok, lic, credit, fn = license_of(art["img"])
            time.sleep(0.6)
            if not ok:
                rej += 1
                print(f"  rej  {co['slug']:20s} {p['name'][:24]:24s} {lic[:28]}", flush=True)
                continue
            stem = filestem(p["name"])
            if stem in used:
                stem = f"{stem}-{norm(p['name']).split()[0]}"
            used.add(stem)
            r = get(FILEPATH + fn + "?width=600", tries=3)
            time.sleep(0.6)
            if r is None or not r.ok or "image" not in r.headers.get("content-type", ""):
                rej += 1
                continue
            ext = {"image/jpeg": ".jpg", "image/png": ".png",
                   "image/webp": ".webp"}.get(
                r.headers["content-type"].split(";")[0].strip(), ".jpg")
            path = os.path.join(outdir, f"{co['slug']}-{stem}{ext}")
            with open(path, "wb") as fh:
                fh.write(r.content)
            out.append({"exec": p["name"], "slug": co["slug"], "score": 90,
                        "file": path, "img": art["img"], "page": art["url"],
                        "alt": art["title"], "photoCredit": credit})
            print(f"  OK   {co['slug']:20s} {p['name'][:24]:24s} {credit[:48]}", flush=True)
            json.dump(out, open(os.path.join(outdir, "_candidates.json"), "w"), indent=1)
    json.dump(out, open(os.path.join(outdir, "_candidates.json"), "w"), indent=1)
    print(f"\ncommons staged: {len(out)}  rejected: {rej}")
    return out


# ------------------------------------------------------- contact sheet ----
CARD = """<div class=c><img src="file://{f}">
 <div class=n>{i}. {name}</div><div class=t>{title}</div>
 <div class=m>{slug} &middot; score {score}{cc}</div></div>"""

SHEET = """<html><head><meta charset=utf-8><style>
body{{background:#12151b;color:#eaeef5;font:14px/1.35 system-ui,sans-serif;margin:0;padding:14px}}
h1{{font-size:17px;margin:0 0 12px}}
.g{{display:grid;grid-template-columns:repeat({cols},1fr);gap:12px}}
.c{{background:#1c2230;border:1px solid #2c3648;border-radius:8px;padding:8px;text-align:center}}
.c img{{width:100%;height:210px;object-fit:contain;background:#0b0e13;border-radius:5px}}
.n{{font-weight:700;color:#ffd166;margin-top:6px;font-size:15px}}
.t{{color:#9fb0c8;font-size:12px;min-height:30px}}
.m{{color:#6f8099;font-size:11px;margin-top:3px}}
</style></head><body>
<h1>WHO IT SHOULD BE &mdash; reject any face that is not unmistakably the yellow name
({n} candidates, page {pg})</h1><div class=g>{cards}</div></body></html>"""


def build_sheets(cands, outdir, per=16, cols=4):
    from playwright.sync_api import sync_playwright
    os.makedirs(outdir, exist_ok=True)
    made = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium",
                              args=["--no-sandbox"])
        for i in range(0, len(cands), per):
            chunk, n = cands[i:i + per], i // per + 1
            cards = "\n".join(
                CARD.format(f=c["file"], i=j + 1, name=htmllib.escape(c["exec"]),
                            title=htmllib.escape(c.get("title", ""))[:70],
                            slug=c["slug"], score=c["score"],
                            cc=" &middot; CC" if c.get("photoCredit") else "")
                for j, c in enumerate(chunk))
            hp = os.path.join(outdir, f"sheet{n}.html")
            open(hp, "w").write(SHEET.format(cols=cols, cards=cards,
                                             n=len(chunk), pg=n))
            pg = b.new_page(viewport={"width": 300 * cols + 60, "height": 1000})
            pg.goto("file://" + os.path.abspath(hp))
            pg.wait_for_timeout(1200)
            png = os.path.join(outdir, f"sheet{n}.png")
            pg.screenshot(path=png, full_page=True)
            pg.close()
            made.append(png)
            print("built", png, f"({len(chunk)} cards)", flush=True)
        b.close()
    return made


# ------------------------------------------------------------ pdf track ----
# Regulatory filings (A-share / HKEX annual reports) are text-only -- verified
# on CATL's 2025 annual report: every page naming multiple executives carried
# zero images. Designed ESG/sustainability reports DO carry portraits, usually
# a CEO-message photo plus a board-of-directors grid. PDFs have no alt text, so
# an image is matched to a person by the caption printed directly beneath it.

PDF_MIN_PT = 28          # ignore rules, bullets and icons
PDF_ZOOM = 3.0           # render clip regions rather than extracting the raw
                         # xref, so masks/alpha composite as a reader sees them


def pdf_captions(page, rect):
    """Candidate caption strings around an image, one per layout convention.

    Two layouts both occur in practice: a name printed under a grid portrait
    (Samsung SDI's board page) and a name printed to the right of a small
    portrait heading a bio block (Huawei's director pages). Both are returned
    and scored -- checking only one silently misses the other.
    """
    words = page.get_text("words")
    out = []

    below = [w for w in words
             if w[1] >= rect.y1 - 6 and w[1] <= rect.y1 + 46
             and not (w[2] < rect.x0 - 26 or w[0] > rect.x1 + 26)]
    if below:
        below.sort(key=lambda w: (round(w[1]), w[0]))
        out.append(" ".join(w[4] for w in below[:14]))

    right = [w for w in words
             if w[0] >= rect.x1 - 4 and w[0] <= rect.x1 + 220
             and w[3] >= rect.y0 - 12 and w[1] <= rect.y1 + 12]
    if right:
        right.sort(key=lambda w: (round(w[1]), w[0]))
        # only the first line or two -- bio prose below often names other people
        out.append(" ".join(w[4] for w in right[:10]))

    above = [w for w in words
             if w[3] <= rect.y0 + 6 and w[3] >= rect.y0 - 34
             and not (w[2] < rect.x0 - 26 or w[0] > rect.x1 + 26)]
    if above:
        above.sort(key=lambda w: (round(w[1]), w[0]))
        out.append(" ".join(w[4] for w in above[-10:]))
    return out


def caption_match(caption, forms):
    """Confidence that a caption names the person described by `forms`."""
    n = norm(caption)
    best = 0
    for full, first, last in forms:
        if full and full in n:
            best = max(best, 100)
        elif first in n.split() and last in n.split():
            best = max(best, 88)
    return best


def run_pdfs(gaps, outdir, manifest):
    """Harvest headshots out of company-published PDF reports."""
    import pymupdf
    os.makedirs(outdir, exist_ok=True)
    cache = os.path.join(outdir, "_pdfcache")
    os.makedirs(cache, exist_ok=True)
    by_slug = {c["slug"]: c for c in gaps}
    flat = []
    for slug, urls in manifest.items():
        co = by_slug.get(slug)
        if not co:
            print(f"  --   {slug}: no remaining gaps, skipped", flush=True)
            continue
        targets = {p["name"]: aliases(p["name"]) for p in co["missing"]}
        used, found = set(), 0
        for url in urls:
            local = os.path.join(cache, re.sub(r"[^A-Za-z0-9.]+", "_", url)[-90:])
            if not os.path.exists(local):
                r = get(url, tries=2)
                if r is None or not r.ok or "pdf" not in r.headers.get(
                        "content-type", "application/pdf"):
                    print(f"  !!   {slug}: unreachable {url[:70]}", flush=True)
                    continue
                open(local, "wb").write(r.content)
            try:
                doc = pymupdf.open(local)
            except Exception as e:
                print(f"  !!   {slug}: unreadable pdf ({e})", flush=True)
                continue
            for pno in range(len(doc)):
                page = doc[pno]
                images = page.get_images(full=True)
                if not images:
                    continue
                for info in images:
                    for rect in page.get_image_rects(info[0]):
                        if rect.width < PDF_MIN_PT or rect.height < PDF_MIN_PT:
                            continue
                        caps = pdf_captions(page, rect)
                        if not caps:
                            continue
                        for ename, forms in targets.items():
                            sc = max((caption_match(c, forms) for c in caps),
                                     default=0)
                            cap = next((c for c in caps
                                        if caption_match(c, forms) == sc), "")
                            if sc < 88 or ename in used:
                                continue
                            stem = filestem(ename)
                            pix = page.get_pixmap(
                                clip=rect, matrix=pymupdf.Matrix(PDF_ZOOM, PDF_ZOOM))
                            path = os.path.join(outdir, f"{slug}-{stem}.png")
                            pix.save(path)
                            used.add(ename)
                            found += 1
                            flat.append({"exec": ename, "slug": slug, "score": sc,
                                         "file": path, "img": f"{url}#page={pno+1}",
                                         "page": url, "alt": cap[:90]})
                            print(f"  OK   {slug:20s} {ename[:24]:24s} "
                                  f"p{pno+1} cap={cap[:34]!r}", flush=True)
            doc.close()
        if not found:
            print(f"  --   {slug:20s} no caption matches", flush=True)
    json.dump(flat, open(os.path.join(outdir, "_candidates.json"), "w"), indent=1)
    print(f"\npdf staged: {len(flat)}")
    return flat


# ----------------------------------------------------------------- wire ----
def wire(entries, apply=True):
    """Insert "photo"/"photoCredit" after the exec's "title" line.

    Older-vintage profiles must never be JSON round-tripped -- a re-dump
    reformats ~800 lines -- so this edits the file's lines in place and keeps
    the existing formatting byte-for-byte everywhere else.
    """
    by_slug = {}
    for e in entries:
        by_slug.setdefault(e["slug"], []).append(e)
    done, failed = [], []
    for slug, items in sorted(by_slug.items()):
        path = os.path.join(DATA, f"{slug}.profile.json")
        lines = open(path, encoding="utf-8").read().split("\n")
        for e in items:
            target = json.dumps(e["exec"], ensure_ascii=False)
            idx = next((i for i, l in enumerate(lines)
                        if l.strip().startswith(f'"name": {target}')), None)
            if idx is None:
                # older-vintage profiles pack the whole exec object onto one line
                cidx = next((i for i, l in enumerate(lines)
                             if f'"name": {target}' in l), None)
                if cidx is None:
                    failed.append((slug, e["exec"], "name line not found"))
                    continue
                if '"photo"' in lines[cidx]:
                    failed.append((slug, e["exec"], "already has photo"))
                    continue
                m = re.search(r'"title":\s*"(?:[^"\\]|\\.)*"', lines[cidx])
                if not m:
                    failed.append((slug, e["exec"], "title not found on compact line"))
                    continue
                ins = f', "photo": "{e["dest"]}"'
                if e.get("photoCredit"):
                    ins += (', "photoCredit": '
                            + json.dumps(e["photoCredit"], ensure_ascii=False))
                lines[cidx] = lines[cidx][:m.end()] + ins + lines[cidx][m.end():]
                done.append((slug, e["exec"], e["dest"]))
                continue
            tidx = next((j for j in range(idx + 1, min(idx + 4, len(lines)))
                         if lines[j].strip().startswith('"title":')), None)
            if tidx is None:
                failed.append((slug, e["exec"], "title line not found"))
                continue
            if any('"photo"' in lines[k] for k in range(idx, min(idx + 6, len(lines)))):
                failed.append((slug, e["exec"], "already has photo"))
                continue
            indent = re.match(r"\s*", lines[tidx]).group(0)
            if not lines[tidx].rstrip().endswith(","):
                lines[tidx] = lines[tidx].rstrip() + ","
            ins = [f'{indent}"photo": "{e["dest"]}",']
            if e.get("photoCredit"):
                ins.append(f'{indent}"photoCredit": '
                           f'{json.dumps(e["photoCredit"], ensure_ascii=False)},')
            lines[tidx + 1:tidx + 1] = ins
            done.append((slug, e["exec"], e["dest"]))
        if apply:
            open(path, "w", encoding="utf-8").write("\n".join(lines))
            json.load(open(path, encoding="utf-8"))   # fail loudly on corruption
    return done, failed


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    cmd = sys.argv[1]
    if cmd == "gaps":
        g = load_gaps()
        dest = sys.argv[2] if len(sys.argv) > 2 else "gaps.json"
        json.dump(g, open(dest, "w"), indent=1)
        have, tot = coverage()
        print(f"coverage {have}/{tot} execs; {sum(len(c['missing']) for c in g)} "
              f"missing across {len(g)} companies -> {dest}")
    elif cmd == "pdfs":
        gaps = json.load(open(sys.argv[2]))
        run_pdfs(gaps, sys.argv[3], json.load(open(sys.argv[4])))
    elif cmd in ("firstparty", "commons"):
        gaps = json.load(open(sys.argv[2]))
        if len(sys.argv) > 4:
            only = set(sys.argv[4].split(","))
            gaps = [c for c in gaps if c["slug"] in only]
        (run_firstparty if cmd == "firstparty" else run_commons)(gaps, sys.argv[3])
    elif cmd == "sheet":
        build_sheets(json.load(open(sys.argv[2])), sys.argv[3])
        print("Now READ each screenshot and drop every image that is not "
              "unmistakably the named person before wiring.")
    elif cmd == "wire":
        done, failed = wire(json.load(open(sys.argv[2])))
        for s, n, d in done:
            print(f"  OK   {s:22s} {n:28s} -> {d}")
        for s, n, why in failed:
            print(f"  FAIL {s:22s} {n:28s} ({why})")
        print(f"\nwired {len(done)}, failed {len(failed)}")
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

# Developed by: LightAISolutions
