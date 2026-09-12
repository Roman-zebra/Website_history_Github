# GetYourGuide map advertising

The registered partner portal generated partner ID BHO3FAQ and confirmed the official link format:
`https://www.getyourguide.com/.../?partner_id=BHO3FAQ&utm_medium=online_publisher&cmp=jta_map_...`
Do not substitute the different ID found in generic resource-center referral links.

## Scope and priority

The 36 curated food/shopping collection destinations (`a-` IDs) use their explicitly selected Klook products. They bypass the geographical widget, including downtown matches such as Shibuya, to preserve the approved spot-specific advertisements. Other eligible places keep the GetYourGuide priority described below.

GetYourGuide is the first advertisement at the largest two actual icon sizes, verified international airports, Shinkansen station hubs and curated downtown identities. At the same eligible point it replaces the Klook card instead of alternating the two providers. Other small pins keep the reviewed Klook physical-product limit of 1.609344 km. Airfield names alone do not prove an international airport. Existing station identity/service and downtown matching are reused.

The official coordinate activity widget chooses one item from GetYourGuide's own marketplace. There is no fixed local whitelist of GetYourGuide products. This is NOT a downloaded complete Japan catalog, a verified nearest-product ranking, a one-mile filter, or a guarantee that the result is a guided tour rather than a ticket. The UI describes regional experiences and asks readers to verify meeting place, language and pickup. Reviewed airport-to-city mappings improve arrival-hub relevance without implying an airport pickup.

## Official integration

The signed-in builder at https://partner.getyourguide.com/en-us/solutions/activities produced these attributes: data-gyg-href=https://widget.getyourguide.com/default/activities.frame, data-gyg-widget=activities, data-gyg-number-of-items=1, data-gyg-partner-id, data-gyg-cmp, data-gyg-lat, data-gyg-lon and data-gyg-locale-code. Supported map codes were checked in the actual selector: en-US, ja-JP, ko-KR, zh-CN, zh-TW.

The mandatory analyzer https://widget.getyourguide.com/dist/pa.umd.production.min.js is initialized in the head of a dedicated same-origin advert document, gyg-frame.html. Each new coordinate/language has its own document lifecycle, avoiding unsupported SPA refresh methods and whole-page automatic text inference. The main map does not load the analyzer globally. Widget/campaign results may be grouped under advert-frame URLs in the partner report. Campaigns identify rounded public map coordinates, not a user identifier. The provider may add its own tracking parameters.

The overview preserves an unchanged widget through configuration/data refresh. Frame-size and startup-failure messages must come from the current frame window and exact site origin. SDK loading errors or a startup timeout restore the existing Klook fallback for that opening. The provider iframe is cross-origin; internal inventory/booking state and every kind of empty/error response are not inspected. Closing the overview removes the frame. About advertising explains provider communication and links to GetYourGuide's privacy notice in six languages.

## API and inventory limits

Official requirements, updated September 4, 2026:
https://partner.getyourguide.support/hc/en-us/articles/13981133907613-API-integration-and-requirements

Basic API: at least 100,000 monthly website visits or 50,000 app downloads. Reading API: at least one million monthly visits and 300 monthly bookings for existing Basic API partners. Technical integration capability is required. No API credentials or account approval were verified; do not claim full-catalog reconciliation or precise geocoded coverage. No support inquiry was sent.

Widget and analyzer references:
- https://partner.getyourguide.support/hc/en-us/articles/13981142981789-Widgets-101
- https://partner.getyourguide.support/hc/en-us/articles/13980983394333-How-to-install-the-Integration-Analyzer

Local advertising QA displayed an actual Hakodate tour, product 1167180, with BHO3FAQ and the point campaign. This verifies rendering and outbound-link construction, not completed-booking attribution or earned commission. Do not copy provider-generated visitor IDs into source or reports. No booking or payment-settings change was made.

Run `node scripts/build.cjs` before publishing and increment asset versions without changing coordinates or vendor files.
