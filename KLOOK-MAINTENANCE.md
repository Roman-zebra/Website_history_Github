# Klook place cards

Registered website: JAPAN TIME ATLAS, https://japantimeatlas.com, public AID 134890.
The overview card sits between the source credit and About this site. It is a disclosed sponsored link; no third-party widget, tracking script or automatic affiliate request runs when the map opens.

## Selection

- Sizes 1 and 2 choose the nearest reviewed physical product, including Aneyoshi. Cards show prefecture and straight-line distance, not a walking-distance claim. The 128 editorial markers (36 existing plus 92 regional additions) are not measured popularity rankings.
- Sizes 3 and 4, including Wikipedia, memorial, liminal and local pins, choose the nearest physical product only within one international mile: 1.609344 km. The zoom appearance field is separate from visual size. There is no distant regional-search fallback for small pins.
- If no physical product is within one mile, a verified international airport can show a Japan eSIM. An identified JR station can show a nationwide JR pass; Tokyo Metro/Toei subway stations can show a Tokyo Subway ticket. These are context-based alternatives with no artificial venue coordinates. Nearby physical products take precedence. Station operators and eligibility matter: private railways and unknown operators receive no generic JR recommendation. A station card does not claim tickets can be exchanged at that station.
- Transport data includes 9,071 named OSM station nodes (not a count of unique operating stations), 32 airports with scheduled international services and 416 named ski-area ways. The airport scope follows the MLIT summer 2026 timetable; charter-only airports are outside this verified set. Both large and small JR stations can receive fallback cards; unknown stopping-service data is not used to invent Shinkansen classifications.
- The catalog has 94 physical products and 3 travel products. It is partial. Japan-wide product inventory, availability and coordinates could not be exported from Product Explorer; an official all-product API/feed was not confirmed. The owner declined a support inquiry. No message was sent. Do not claim all Klook Japan products, every prefecture's products, or a highest-conversion winner are covered.
- Review dates expire after 180 days. Changed availability, prices and schedules are checked on Klook; live inventory is not synchronized. Umeda Sky Building and GALA Yuzawa were added in this release. All 128 large markers are checked against the available reviewed catalog by the regression tests.

## Sources and refresh

Klook product references and physical coordinate sources are stored on individual offers. Travel references:
- https://www.klook.com/activity/109393-japan-esim-high-speed-internet-qr-code-voucher/
- https://www.klook.com/en-US/activity/1420-7-day-whole-japan-rail-pass-jr-pass/
- https://www.klook.com/en-US/activity/1552-subway-ticket-tokyo/

Facilities were retrieved September 12, 2026 from OpenStreetMap via https://overpass-api.de/api/interpreter. Station nodes use railway=station; ski ways use landuse=winter_sports and their center coordinates. International airport IATA codes were checked against https://www.mlit.go.jp/koku/content/002000598.pdf (March 29–October 24, 2026). See data/facilities-index-v1.json and LICENSE-DATA.md. Refresh these datasets when international schedules or operator data change; no recurring automation was installed.

## Nationwide search

search-worker.js builds a local searchable index from every regional file, curated markers, monuments and facilities. Names, aliases, categories and multilingual category synonyms support partial and combined words. All matches are sent to the map; only the accessible result list is paginated. A canvas displays every in-view match without the normal marker cap. One match opens at street level; multiple matches fit the map. Loading failures do not silently report a partial index as complete. This searches the site's recorded places, not Google's or all real-world places. First indexing requires downloading the dataset; the worker caches the completed index locally.

## Tracking

The link format follows https://affiliate.klook.com/custom_tag_guide. aff_label1=jta_map; aff_label2 is the venue prefecture or JP for country-wide travel products; aff_label3 is the product ID or search. k_site is last. These are bounded editorial tags, not visitor or click identifiers. Languages do not create extra tags. No private API credentials are needed.

Compare confirmed commission, clicks and EPC in Klook Performance before changing priorities. During setup both official custom redirects and direct aid links reached the destination with attribution, then the test browser reported ERR_TOO_MANY_REDIRECTS. The untracked product opened successfully, and adding product slugs did not fix the error. Completed-booking attribution and payouts remain unverified. No test booking was placed. The account owner must complete financial and identity fields.

## Editing and verification

Edit affiliate-config.json, then run node scripts/build.cjs. Physical offers need verified product IDs, coordinates, prefectures, localized copy and review dates. Travel offers need valid operator/airport scope and eligibility notes. Keep catalogCoverage.complete false until an authoritative complete inventory has been reconciled. Bump asset versions on publishing; keep data versions consistent. Do not store secrets in public files.
