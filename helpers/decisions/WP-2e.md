# WP-2e — Real Google maps and place photos in the brochure: decisions

Owner ask (2026-10-01, rating the Phase 2 sample 9/10): "I want the attached map to actually be a screenshot of Google map in the final product", 10/10 once the map is fixed. The owner created `MAPS_STATIC_KEY` and set it in Claude HQ. Choices made without asking (common rule: record the default taken).

| # | Choice | Default taken | Why |
|---|---|---|---|
| 1 | How to get a "screenshot of Google Maps" | Maps Static API images, not browser screenshots of maps.google.com | Screenshots of the consumer site are not licensed for reuse; the Static API is the product built for embedding a map image |
| 2 | Key | `MAPS_STATIC_KEY`, appended as `key=` at send time; never returned, logged or put in an error | The egress proxy injects no key for `maps.googleapis.com` (a header key answers 403, verified live) |
| 3 | Markers | Google draws the route lines; the brochure draws its own numbered badges, meal rings and lodging house on top | Static Maps labels are one character, so day numbers over 9 and meal icons cannot be Google markers. The map is requested at a computed centre and zoom so the Web Mercator overlay is exact |
| 4 | Google's attribution | Bottom padding of 40 px keeps the logo and copyright clear of every marker; captions add "Map data © Google"; the sources page and colophon say the maps are Google Maps with markers added | The geo guidelines forbid cropping or covering the attribution |
| 5 | Map clutter | `style=` hides business and medical POIs, every other POI pin icon and road shield icons; place, station and park names stay | Google's own pins competed with the brochure's numbered stops, and in the live Tokyo sample Google's green numbered highway shields read as Day 3's green numbered stops |
| 6 | Route lines | Compute Routes polylines for walk/drive/bike/transit legs without one (Essentials, one call per leg); straight line kept on failure | A straight line across water or blocks on a real map looks wrong |
| 7 | Place photos | Place Photos (New) through the existing proxy-injected Places key; the place's own image wins; credited "Photo by <author> · Google Maps" with the author's link; 5:2 strip on the card | Places policy requires the author attribution; the short strip keeps long cards inside one page |
| 8 | Caching | Images inlined as data URIs during the build only; photo names never cached; nothing written to disk | Google content is build-scoped (Maps terms) |
| 9 | Street View | Not offered | Google forbids Street View imagery in print |
| 10 | Without a key or on any failure | Warning, then the drawn sketch / no photo / straight line | A brochure must always build |
| 11 | Cost per brochure (3 days) | 4 static maps + up to ~15 photos + a handful of route calls | Free tiers: Static Maps 10,000/month, Place Details Photos 1,000/month (kit ceilings 8,000 and 800) |
| 12 | Photo names | Pattern accepts photo ids up to 2,000 characters (was 400) | Real Place Photo ids from the live Tokyo sample run 400–460 characters; the old cap rejected all 19 |
| 13 | Transit in Japan | Live sample shows taxi times for hops over 2 km, with a note that a train is usually as quick | Compute Routes returned no TRANSIT route for any Tokyo pair tried (WALK and DRIVE work). Carried to the planner as a request (`TG-PHASE-2.md` §4) |
| 14 | Pack integration | Not done here: the tour-guide snapshot and `toBrochureModel` do not yet carry photo names or polylines | Phase 4 is changing the pack's callers in the private repo; carried to Phase 4b/5 as a request (`TG-PHASE-2.md` §4) |
| 15 | Train routing in Japan (owner, 2026-10-01: "100% how I plan Japan trips") | Owner chose both: a Google Maps directions link on every leg (taxi legs open the train options) now; NAVITIME Route (totalnavi) through RapidAPI for real train legs once the owner adds the key | Google licenses Japan transit to its own app only; Maps URLs open it with no key. NAVITIME returns lines, transfers, times, fares and shapes. Ekispert (links-only free plan), scraping Google Maps (terms) and a self-built open-data router (coverage, effort) rejected |

Open terms question (default taken: proceed). Google's geo guidelines allow maps in printed promotional and personal material but prohibit Google Maps as "the core part of printed navigational material (guide books)". A private itinerary for one household with per-day overview maps is read here as supplemental, not a guide book for sale. Revisit before any brochure is sold or distributed widely.

Developed by: LightAISolutions
