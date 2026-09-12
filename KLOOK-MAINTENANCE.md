# Klook place cards

Registered website: JAPAN TIME ATLAS, https://japantimeatlas.com, public AID 134890.
The overview card sits between the source credit and About this site. It is a disclosed sponsored link; no third-party widget, tracking script or automatic affiliate request runs when the map opens.

## Selection

- The 36 food/shopping destinations use 34 reviewed products in `klook.activityOffers`, matched by explicit `a-` place ID. They do not receive nearest-distance, station or regional-search fallbacks. A multi-stop itinerary can serve more than one destination without inventing venue coordinates. All five interface languages have names and booking notes; booking-page language does not promise that the guide speaks that language.
- Some offers are related local alternatives rather than a guaranteed stop: Hachinohe coastal/seafood Plan 3 departs from Aomori (confirm the market), Sendai is a city food tour, Pier Bandai uses the separate Kura restaurant at ANA Crowne Plaza Niigata, Hiroshima uses a city okonomiyaki/bar tour, and Kobe uses a customizable city walk. These have `match: area` and explanatory notes. Nakano's personalized route must be confirmed. Shibuya requires selecting the Shibuya package. Karato departs from Fukuoka; Miyagawa's itinerary departs from Takayama and also visits Shirakawa-go.
- The ramen museum offer covers admission, with food charged separately. The Kochi itinerary includes Hirome Market with meals charged separately. The Tenjinbashisuji visit is a brief stop on a bicycle tour. Kokusai Street's workshop lists Japanese instruction. Coupons require checking participating shops, redemption, eligible purchases and expiry; the Ohga coupon's published December 31, 2026 expiry is enforced in the catalog.
- The affiliate configuration can load after a shared spot opens. Once loaded, it refreshes the currently visible panel without reopening a panel that the visitor has closed.

- Sizes 1 and 2 choose the nearest reviewed physical product, including Aneyoshi. Cards show prefecture and straight-line distance, not a walking-distance claim. The 128 editorial markers (36 existing plus 92 regional additions) are not measured popularity rankings.
- Sizes 3 and 4, including Wikipedia, memorial, liminal and local pins, choose the nearest physical product only within one international mile: 1.609344 km. The zoom appearance field is separate from visual size. There is no distant regional-search fallback for small pins.
- If no physical product is within one mile, a verified international airport can show a Japan eSIM. An identified JR station can show a nationwide JR pass; Tokyo Metro/Toei subway stations can show a Tokyo Subway ticket. These are context-based alternatives with no artificial venue coordinates. Nearby physical products take precedence. Station operators and eligibility matter: private railways and unknown operators receive no generic JR recommendation. A station card does not claim tickets can be exchanged at that station.
- Transport data includes 9,071 named OSM station nodes (not a count of unique operating stations), 32 airports with scheduled international services and 416 named ski-area ways. The airport scope follows the MLIT summer 2026 timetable; charter-only airports are outside this verified set. Both large and small JR stations can receive fallback cards; unknown stopping-service data is not used to invent Shinkansen classifications.
- The catalog has 94 physical products (one disabled for zero commission), 3 travel products and 8 regional tours. It is partial. Japan-wide product inventory, availability and coordinates could not be exported from Product Explorer; the signed-in FAQ confirms an activity search API and product feed for selected partners, but account access and full Japan inventory/geocoding are unconfirmed. The owner declined a support inquiry. No message was sent. Do not claim all Klook Japan products, every prefecture's products, or a highest-conversion winner are covered.
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

## Search and advertising review, 2026-09-12

Search now recognizes 36 semantic categories with 24 localized category suggestions. A category word uses classification rather than arbitrary substrings: a zoo-named station is not classified as a zoo, and generic viewpoints do not imply verified nighttime access. Users can filter the complete result set to the current map bounds and return to All Japan. Regions are not inferred from data filenames because extraction boxes overlap prefectural borders. Explicit address fields remain searchable.

A production browser check reproduced missing advertising when a place hash opened before affiliate-config finished loading. setAffiliateConfig now repaints only the latest active overview when configuration arrives; it does not require another marker click. Regression tests cover delayed configuration and navigation.

Official signed-in help: https://affiliate.klook.com/ja/help/ — Tools/ads confirms selected-partner activity-search API and product feeds, available by inquiry. Tracking confirms a maximum 30-day cookie window, last-affiliate attribution and ineligible promo codes. The owner instructed us not to contact support. No inquiry or test booking was sent.

The site's actual Goryokaku ad (45064) rendered a disclosed sponsored link with AID 134890 and the configured labels. Clicking it was blocked by the device's NordVPN Threat Protection Pro advertising interstitial. No protection was disabled or bypassed. Therefore successful landing and completed-booking attribution remain unverified. This observation does not prove that the public Klook destination is malicious or that every visitor is blocked.

Performance tools report clicks, tickets, sales and commissions; static custom cards do not send Klook widget-impression beacons, so the portal's impression count is not a measure of card views. Do not invent conversions or infer a measured conversion rate from zero/missing observations.

## Individual commission audit

All 97 local product IDs were checked individually in the signed-in commission table at https://affiliate.klook.com/ja/help/special_activity on September 12, 2026. 92 returned 5%, four returned 2% (49191, 7254, 1420, 1552), and Osaka Aquarium Kaiyukan 598 returned 0%. Product 598 is disabled as a revenue advertisement; the router also excludes any known zero-commission physical or travel offer even if enabled accidentally. There are now 96 active products. Commission fields are dated observations, not guaranteed future rates or booking availability. The nearest rule uses eligible products only. The location itself remains searchable.

## Hub tours and rotation

Eight individually verified, currently 5%-commission tours cover nine departure regions: Sapporo, Tokyo, Osaka, Kyoto, Nagoya, Kanazawa, Hiroshima, Fukuoka and Naha. Region centers come from the existing attributed OSM facility dataset and are matching bounds, not invented meeting-point coordinates. Only highspeed=yes stations, exact curated downtown names within their city bounds, and specifically assigned airport IATA codes receive regional tours. Unknown and uncovered hubs keep their existing eligible advertisement; no distant tour is substituted. This is a partial catalog, not nationwide tour inventory. Every tour names its actual departure area and asks readers to check their meeting point, date and guide language. Airport cards do not imply airport pickup.

The overview has one card. Relevant tours and the existing eligible experience or travel fallback rotate on each actual opening of that point, with an additional localized Another option button. Language, metadata and configuration refreshes preserve the selection; there is no automatic carousel timer or persistent visitor tracking. Normal small-marker physical products retain the one-mile limit.

The expanded commission audit covers 105 product IDs: 100 at 5%, four at 2%, one at 0% disabled; 104 active products. These are observed base rates, not guaranteed commission or availability. No published minimum traffic, tenure or new-affiliate API approval criteria were located. Selected-partner API/feed access must not be inferred from ordinary affiliate registration.

Major departure stations with incomplete OSM service tags are also matched by exact station identity within 800 m of the attributed station center. Service reference: https://japanrailpass.net/assets/pdf/Shinkansen_En_web_20260324.pdf . This does not turn arbitrary nearby landmarks into station hubs. New food/shopping collection pins retain their third visual size. Their dedicated activityOffers now take precedence by exact destination ID; the hub rotation policy continues for the other places.

Activity offers additionally need exact destination IDs, a Klook product reference, five localized names/notes, review dates and known expiry dates. Remove or disable an offer if its named itinerary or location changes. The September 12, 2026 activity review covers 34 product pages, not a live inventory feed; future dates, availability and commission eligibility remain subject to Klook. Free coupons do not imply a commission payment. `tests/activity-offers.test.cjs` checks all 36 destinations in five languages, expired/invalid/unmatched offers, stale asynchronous lookups, and loading the configuration after opening or closing a panel.

Existing commission observations and known-zero exclusions are preserved. Rates for newly added products have not been audited individually; product relevance is not a claim of guaranteed revenue.
