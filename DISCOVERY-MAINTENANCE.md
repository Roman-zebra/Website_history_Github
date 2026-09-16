# Search and international discovery

The September 2026 release follows the visibility analysis: give places standalone URLs, explain what visitors can compare, make the content accessible in their language, and connect it to the map. Social account operation is outside this change.

## Audience evidence

The ten market choices follow the existing inbound-tourism analysis (2025 JNTO arrivals and Japan Tourism Agency spending). They are **not measured visitor demographics for this website**, and the route selections are editorial suggestions, not claims about national preferences or conversion rates.

Sources retained from that analysis:
- https://www.jnto.go.jp/statistics/data/_files/20260819_1615-6.pdf
- https://www.mlit.go.jp/kankocho/content/001992584.pdf

English guides cover the USA, Australia, Canada, UK and Singapore. Korea uses Korean; mainland China Simplified Chinese; Taiwan and Hong Kong Traditional Chinese with separate trip-planning entries; Thailand Thai articles with an explicitly English interactive map. The 19 main place guides also have Japanese versions. Users can choose any language; there is no geographic redirect.

## Content source of truth

- `data/places-world.json`: curated locations, map summaries, existing English/Japanese histories and series labels.
- `scripts/discovery-copy.cjs`: six-language comparison prompts and guide UI.
- `scripts/market-copy.cjs`: eleven guides, including the Japanese domestic walking entry at `/visit/jp`.
- `scripts/build-discovery.cjs`: generates 114 place guides, 11 market guides, the market index, locale links, shared icon metadata and sitemap before the existing build tests run.
- `scripts/build-icons.cjs`: generates original clock-and-map-pin PNG/SVG icons without dependencies. The 96px PNG is the stable search favicon; 180px is the Apple touch icon. Do not add query versions to these URLs; their HTTP cache revalidates daily.
- `explore.js`: `DISCOVERY_ENTRY` localizes the home-page guide and country links in five map languages. Thai remains a static guide with an explicitly English map.

Edit these sources, then run `node scripts/build.cjs`. Do not hand-edit generated place or market pages. The build must remain network independent. New canonical routes must be included in the sitemap and internal links; update the route-count regression check when adding pages.

The background cache installer runs at most four requests at a time and reuses browser-cached versioned assets. Regression tests cover its concurrency and failure handling, as well as Chinese hero repainting without extra image downloads. Browser checks use 390px and 1440px widths; these are layout checks, not field Core Web Vitals measurements.

## Canonical links (September 2026)

- Every crawlable link to a place names its article: `/place/<id>`, `/place/<lang>/<id>` or `/place/l-<id>`. Build them with `placeURL()` / `liminalURL()` in `explore.js` or `route()` in `build-discovery.cjs`. Never write `#<id>` or a `.html` spelling into a page.
- Home cards for featured and liminal places are `<a>` links to the article. A plain click still opens the map as before; Ctrl/⌘ or middle click opens the article.
- Links that open the map from another page use `/?lang=<lang>&place=<id>` (landmarks: `&spot=lat,lon`). `consumeMapQuery()` turns the query into the in-app hash, and old `#hiroshima` bookmarks keep working. A #fragment never reaches the server, so it cannot be redirected with a 301.
- `_redirects` (copied by `build.cjs`) answers `.html` and trailing-slash spellings of the entry pages with 301. Keep it to static rules: rules are matched against the requested path before html_handling, and a placeholder rule that lost its `.html` would loop. `/?lang=ja` cannot be matched there (no query matching), and it is the Japanese map itself, so it stays with its canonical pointing at `/`.
- `tests/canonical-links.test.cjs` fails when a crawlable page or the rendered home directory links to a place by #hash or to a `.html` duplicate, and when any crawlable page carries tour or affiliate links.

## In-depth place guides

- `scripts/place-guides.cjs` holds the long English and Japanese sections for Hiroshima, Himeji and Aneyoshi (generated pages) and for Doai Station and Hashima (older liminal pages, patched between `<!--GUIDE-->` markers). Every sentence was checked against the source listed with it on 14 September 2026; photo descriptions come from the GSI tiles at zoom 16–17.
- `fieldNotes` is for notes from an actual visit: the year and season, how busy it was, what you noticed on the ground. Leave it empty rather than write one nobody made.
- Corrected against official sources in the same release: Hashima (about 5,300 people in 1960 on about 6.3 ha; "nine hectares" and "sixteen storeys" removed), Doai (about five trains each way a day, not four), Himeji (air raids in June and July 1945) and Nakano Broadway (an escalator sentence that the English and Japanese texts disagreed on, and that could not be confirmed, removed).
- Home tabs: `MODE_INTRO` in `explore.js` explains each list in five languages. The static English copy of the first tab in `index.html` and `explore.html` is what crawlers see before scripts run. `tests/content-depth.test.cjs` checks the guides, the tab copy, the spot notes and the corrections.

## Imagery and accuracy

GSI's `ort_USA10` and `ort_old10` use PNG, while `gazo1` and `seamlessphoto` use JPEG. Guide previews use the same tile coordinates for old and recent imagery. Both photographs are lazy loaded, with dimensions reserved. Keep visible GSI attribution and the series period; never describe all photographs as taken in 1945, and never imply recent imagery is live.

- https://maps.gsi.go.jp/development/ichiran.html
- https://www.city.hiroshima.lg.jp/english/peace/1029869/1009931.html
- https://www.city.hiroshima.lg.jp/faq/atomicbomb-peace/1001613/1028187/1002368.html

The Atomic Bomb Dome is one surviving atomic-bombed structure, not the only remaining building. Check current Shurijo Castle access on its official website rather than hard-coding a restoration countdown. Nearby distances are straight-line distances, not itineraries.

## Loading and caching

Leaflet 1.9.4 is served locally under `vendor/leaflet-1.9.4`, with upstream license and SHA-256 provenance. Core map code no longer needs the cdnjs host. Map tiles and Wikipedia still require external services: local hosting does not prove availability on every mainland Chinese network. Asset cache is 0.71; corrected data cache is 0.47. Keep app, explore and service-worker data versions aligned.

## Measuring results

The previously submitted Search Console sitemap URL stays `/sitemap.xml`; its content now lists 196 canonical URLs. Sitemap inclusion does not guarantee indexing or ranking. Compare country, landing page, search impressions, clicks and CTR over comparable periods after crawling. For conversion, use actual Klook reports; the pre-existing affiliate redirect/attribution issue is not resolved by these search changes. No new tracking IDs or third-party analytics were invented or installed.

Google guidance: https://developers.google.com/search/docs/specialty/international/localized-versions

Registration with Naver/Baidu/Bing and country-specific search performance checks require access to the relevant webmaster accounts. This release makes no claim to have registered those services.
