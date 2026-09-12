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
- `scripts/market-copy.cjs`: ten country/region guides.
- `scripts/build-discovery.cjs`: generates 114 place guides, 10 market guides, the market index, locale links and sitemap before the existing build tests run.

Edit these sources, then run `node scripts/build.cjs`. Do not hand-edit generated place or market pages. The build must remain network independent. New canonical routes must be included in the sitemap and internal links; update the route-count regression check when adding pages.

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
