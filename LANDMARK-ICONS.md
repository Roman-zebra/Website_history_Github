# Pictorial landmark marker pilot — 2026-09-25

Status: the user approved the three-icon visual direction on 2026-09-25. This release applies the approved Himeji Castle, Mount Fuji and Tokyo Tower artwork; the remaining targets still require photo review and separate illustrations.

## Scope

Only records with numeric `pop === 1` or `pop === 2` are eligible. `tier` only controls the first zoom at which a place appears. Preserve all four sizes and the existing collision, tap and label behavior.

The current three datasets contain 128 eligible records: 19 featured places, 17 established landmarks and 92 regional landmarks. The pilot covers 4 records for 3 distinct places, because Himeji exists in both the featured and landmark datasets. The remaining 124 records have not yet received the required photo review or artwork.

`LANDMARK_ART` in `explore.js` is an explicit whitelist. Add an identity only after review. Do not map whole categories such as “castle” to a single building's icon. Never infer popularity from `tier`.

## Visual references actually inspected

- Himeji Castle: official [Photo Library](https://www.himejicastle.jp/en/guide/photo/), images `photo_p002.png` (west bailey), `photo_p005.png` (Sangoku moat), `photo_p008.png` (Bizen bailey). Confirmed white plaster, gray tiled roofs, layered gables, connected smaller keep and stone base. The miniature simplifies the full complex; it is not a measured reconstruction.
- Mount Fuji: Geological Survey of Japan [plate 8](https://gbank.gsj.jp/volcano/Act_Vol/fujisan/fig/fp8p.html). Reviewed views A–D: west from Lake Tanuki, east-northeast from Lake Yamanaka, south-southeast from Kurodake, and north from Kenashiyama. Confirmed broad concave slopes, irregular summit and directional differences. The icon uses a snow-capped representative silhouette, not live seasonal conditions.
- Tokyo Tower: Minato City tourism association [Tokyo Tower views](https://visit-minato-city.tokyo/ja-jp/articles/487). Reviewed the skyline image, two views from the base and the Shiba Park front view. Confirmed splayed lattice legs, large Main Deck, smaller upper deck, orange/white structure and antenna. Small steelwork is simplified.

These are multiple viewpoints, not an assertion that every possible angle has been verified. Reference photographs are not distributed as project assets. The three illustrations were created independently with the built-in image generation tool.

## Delivery

`icons/landmarks/*-v1.webp`: 192 × 192, transparent alpha; total 37,348 bytes. Full generation prompts and original PNGs are retained with the task deliverables. Web processing only removes transparent outer margins and resizes/encodes the supplied images.

Until an image loads successfully, the emoji marker remains visible. Images are decorative; the marker keeps its existing localized title. Only the three reviewed assets are precached. New artwork must use a new filename to avoid stale caches.

Check the pilot at national and city zoom levels, on light map tiles and aerial imagery, at phone and desktop widths. Verify click/keyboard behavior, image failure fallback and the p3/p4 exclusion before extending it.
