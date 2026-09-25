# Pictorial landmark markers — 2026-09-25

The map now uses 124 distinct illustrations for all 128 records with numeric `pop === 1` or `pop === 2`: 19 featured places, 17 established landmarks and 92 regional landmarks. Four duplicate records share their corresponding art. `tier` controls the first zoom and never determines icon size. All lower-size markers retain the existing appearance. The image fallback, collisions, titles and click behavior are unchanged.

The full selected artwork, exact record mapping, photo review ledger, prompt history and validation results are saved in this task's deliverables under `outputs/landmark-icons`. The site receives only the 192×192 transparent WebP images. The three approved pilot files retain their published bytes. New artwork filenames are unique per landmark and version, including the eight corrected assets. Only the original three pilot images are precached; the other icons load when their markers enter the visible map.

## Visual references actually inspected

- Himeji Castle: official [Photo Library](https://www.himejicastle.jp/en/guide/photo/), images `photo_p002.png` (west bailey), `photo_p005.png` (Sangoku moat), `photo_p008.png` (Bizen bailey). Confirmed white plaster, gray tiled roofs, layered gables, connected smaller keep and stone base. The miniature simplifies the full complex; it is not a measured reconstruction.
- Mount Fuji: Geological Survey of Japan [plate 8](https://gbank.gsj.jp/volcano/Act_Vol/fujisan/fig/fp8p.html). Reviewed views A–D: west from Lake Tanuki, east-northeast from Lake Yamanaka, south-southeast from Kurodake, and north from Kenashiyama. Confirmed broad concave slopes, irregular summit and directional differences. The icon uses a snow-capped representative silhouette, not live seasonal conditions.
- Tokyo Tower: Minato City tourism association [Tokyo Tower views](https://visit-minato-city.tokyo/ja-jp/articles/487). Reviewed the skyline image, two views from the base and the Shiba Park front view. Confirmed splayed lattice legs, large Main Deck, smaller upper deck, orange/white structure and antenna. Small steelwork is simplified.

These are multiple viewpoints, not an assertion that every possible angle has been verified. Reference photographs are not distributed as project assets. The three illustrations were created independently with the built-in image generation tool.

## Delivery

The WebP assets are in `icons/landmarks/`; the explicit `LANDMARK_ART_BY_ID` and `LANDMARK_ART_BY_WIKI` tables in `explore.js` cover every p1/p2 data row. The image remains decorative and the marker keeps its localized title. Failed image loading retains the clickable emoji marker. Map visuals were checked for Himeji and Dōgo Onsen on desktop, and for Dōgo Onsen at phone width.
