# Klook place cards

The account's registered website is JAPAN TIME ATLAS, https://japantimeatlas.com, AID 134890. The public ID is not an API secret.

The overview card sits between the source credit and About this site. It uses a normal sponsored link, with no third-party widget script or automatic affiliate requests when the map is opened.

## Selection

- The two largest marker sizes (`pop` 1 and 2) always choose the closest reviewed product, using its physical venue or departure point. This includes the featured Aneyoshi marker as explicitly requested by the owner. Cards show the prefecture and straight-line distance; they do not claim the product is within walking distance.
- Other markers use the configured local radius, place-name match and a small topic preference. If no local product matches, a Japanese prefecture and municipality from the existing reverse geocoder produce a clearly labelled regional search card. All 47 prefectures are configured. A failed or unknown geocode leaves this fallback hidden rather than guessing a region.
- Small disaster memorial markers remain excluded. The largest two sizes override this exclusion according to the owner's September 12 request.
- The initial catalog contains 31 reviewed products. This does not mean 47 prefectures each have a reviewed product, or that the catalog contains every Klook product. No measured conversion-rate winner has been claimed.
- Product references were checked in the signed-in Product Explorer on September 12, 2026. They expire from selection after 180 days without another review. Prices and review scores are deliberately omitted because they change.

## Tracking and review

The link format follows https://affiliate.klook.com/custom_tag_guide:

- `aff_label1=jta_map`
- `aff_label2=JP-xx` identifies the product's prefecture (or the search region)
- `aff_label3=<product ID>` or `search`
- `k_site` is the final parameter and contains the encoded Klook destination URL.

These are editorial source tags, not user IDs or individual click IDs. The initial setup uses 78 combinations, below the documented 2,000-tag account quota. Page languages do not create extra combinations. No private API credentials are needed.

Compare confirmed commission, clicks and EPC in Klook Performance before changing priorities. The nearest rule for the top two marker sizes must stay distance-first unless the owner requests a different rule.

## Account-side validation still required

During setup, both official custom-tag redirects and the documented direct `?aid=134890` format reached the correct Klook destination with attribution, but the test browser then reported `ERR_TOO_MANY_REDIRECTS`. The same product without tracking opened successfully; numeric product IDs also resolved to their canonical product pages. Therefore the error was not fixed by adding product slugs. Do not claim that completed-booking attribution or payouts have been verified. The owner has been asked to check an account-generated link in their browser. Financial and identity fields must be completed by the account owner when setting up payouts.

No test booking was placed. The automatic city widget was not embedded: its Sendai preview returned a Hokkaido product. The static widget and generated link used during account setup are also not required by these custom cards.

## Editing

Edit `affiliate-config.json`, then run `node scripts/build.cjs`. A product needs a verified product ID, physical coordinates, prefecture, localized names, review date and a sensible local radius. Update the asset version when publishing config or routing changes so cached installations receive the release. Do not store secrets in this public file.
