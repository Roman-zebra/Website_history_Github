GetYourGuide product pins
========================

`gyg-products-data.js` contains reviewed product facts and the public product page's own meeting-point coordinate links. It is not a full or live Japan inventory. The first release checked the 28 products shown in the public Japan landing-page selection on 2026-09-13: 18 have usable published meeting coordinates; 10 remain pending. Do not infer pickup coordinates from a city name or the destination of a bus tour.

To add products, verify the product ID, canonical URL, Japanese venue/meeting location and every offered departure option against an authorized product feed or the official product page. Add each distinct meeting option in `points`; keep its original coordinate link in `mapSource`, Japanese/English labels, source and review dates. The runtime has no product-count whitelist or limit. Disabled products, invalid locations and overdue reviews are excluded. `reviewBefore` is an editorial review deadline, not a supplier availability date. Recheck existing entries before 2026-12-12. No automated supplier inventory refresh is configured.

Run `node scripts/build.cjs` after edits, update the asset version and deploy through the repository's existing Cloudflare build. Keep product facts separate from display code; do not publish API credentials. The static cards do not claim live price or availability, and their display count is not an official widget impression count.

Direct links obtain the registered partner ID from `affiliate-config.json` and include a `jta_pin_PRODUCT_POINT` campaign. Booking attribution is reported by GetYourGuide; local rendering and correct link parameters alone do not prove a completed/commissionable booking.

Official API eligibility: https://partner.getyourguide.support/hc/en-us/articles/13981133907613-API-integration-and-requirements . Access was not confirmed for this account. Do not state that all Japan products have been imported until an authoritative complete inventory has been reconciled, including removals and location updates.
