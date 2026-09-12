# Klook place cards

The account's registered website is JAPAN TIME ATLAS, https://japantimeatlas.com, AID 134890. The public ID is not an API secret.

The overview card sits between the source credit and About this site. It uses a normal sponsored link, with no third-party widget script or automatic affiliate requests when the map is opened.

## Selection

- The two largest marker sizes (`pop` 1 and 2) always choose the closest reviewed product, using its physical venue or departure point. This includes the featured Aneyoshi marker as explicitly requested by the owner. Cards show the prefecture and straight-line distance; they do not claim the product is within walking distance.
- Only `pop` sizes 1 and 2 display advertisements. Size 3, size 4, medium Wikipedia/memorial pins and tiny local pins do not. The owner's clarification refers to visual size, not the zoom `tier` field. Regional search remains a fallback for an eligible large marker only when no reviewed product is available.
- Additions in `data/regional-landmarks-v1.json` provide 92 historical and walking destinations across all 47 prefectures, at size 2. This brings the two largest sizes from 36 to 128 entries. These additions are editorial selections with source-backed coordinates, not fabricated pageview rankings. Decluttering still controls how many markers can fit on screen at a particular zoom.
- The expanded catalog contains 92 reviewed products. This does not mean 47 prefectures each have a reviewed product, or that the catalog contains every Klook product. No measured conversion-rate winner has been claimed.
- Product references were checked in the signed-in Product Explorer on September 12, 2026. They expire from selection after 180 days without another review. Prices and review scores are deliberately omitted because they change.

## Tracking and review

The link format follows https://affiliate.klook.com/custom_tag_guide:

- `aff_label1=jta_map`
- `aff_label2=JP-xx` identifies the product's prefecture (or the search region)
- `aff_label3=<product ID>` or `search`
- `k_site` is the final parameter and contains the encoded Klook destination URL.

These are editorial source tags, not user IDs or individual click IDs. The expanded setup uses at most 139 combinations, below the documented 2,000-tag account quota. Page languages do not create extra combinations. No private API credentials are needed.

Compare confirmed commission, clicks and EPC in Klook Performance before changing priorities. The nearest rule for the top two marker sizes must stay distance-first unless the owner requests a different rule.

## Account-side validation still required

During setup, both official custom-tag redirects and the documented direct `?aid=134890` format reached the correct Klook destination with attribution, but the test browser then reported `ERR_TOO_MANY_REDIRECTS`. The same product without tracking opened successfully; numeric product IDs also resolved to their canonical product pages. Therefore the error was not fixed by adding product slugs. Do not claim that completed-booking attribution or payouts have been verified. The owner has been asked to check an account-generated link in their browser. Financial and identity fields must be completed by the account owner when setting up payouts.

No test booking was placed. The automatic city widget was not embedded: its Sendai preview returned a Hokkaido product. The static widget and generated link used during account setup are also not required by these custom cards.

## Editing

Edit `affiliate-config.json`, then run `node scripts/build.cjs`. A product needs a verified product ID, physical coordinates, prefecture, localized names, review date and a sensible local radius. Update the asset version when publishing config or routing changes so cached installations receive the release. Do not store secrets in this public file.
