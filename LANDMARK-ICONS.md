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

# Tabs 03/04/05 and panel photographs — 2026-09-29

The 27 liminal places (tab 03), 18 food places (04) and 18 shopping streets (05) now use the same kind of pictorial marker. 58 new illustrations were made with ChatGPT image generation from written descriptions of each place, after looking at reference photographs of it (the Commons photographs listed in `data/spot-photos-v1.json`, and press photographs for Qua Palace, which has no free photograph). The references were not given to the generator and are not distributed. Every result was checked by eye against its subject; two were redone (Zaō's file had picked up another picture, and Dōtonbori's billboards resembled real advertising characters, so it was redrawn with abstract signs only). Four activities share an existing landmark picture because they are the same place (Akihabara, Shibuya, Higashi Chaya, Kurashiki), and Nakano Broadway is shared by the liminal and shopping records.

- Files: `icons/landmarks/<name>-v1.webp`, 192×192 transparent WebP, trimmed to the same 94% fill as the earlier set.
- Mapping: `SPOT_ART` in `explore.js`, keyed `l:<liminal id>` / `a:<activity id>`. These pins keep their p3 size (an editorial choice, not a measured rank); the art is looked up by key, not by `pop`, at p1–p3 sizes and on the selected pin.
- Tests: `tests/spot-photos.test.cjs`.

## Panel photographs

The panels of the larger pins (p1–p3: 17 featured places, 31 landmarks, 92 regional landmarks) and of tabs 03/04/05 show a ground-level photograph of the whole building or place — from the front or another angle — instead of the aerial tile. 202 Wikimedia Commons files were chosen by eye from contact sheets on 2026-09-29, preferring the subject of the pin's picture (for example Senkō-ji for Onomichi, the lighthouse for Cape Muroto). Underground places (the discharge channel, the Ōya quarry, Ryūsendō, Tenjin underground mall) show their main hall, which is what a visitor sees.

- Data: `data/spot-photos-v1.json` (file, 500px thumbnail, author, licence; the 960px thumbnail and the file page are derived). Only CC0, public-domain, CC BY and CC BY-SA files; the caption names the author and licence and links to the Commons page.
- Unchanged: p4 landmarks, Wikipedia/stone/local pins, and the two featured places whose panel shows their disaster-memorial stone (Okayama, Aneyoshi). Qua Palace keeps the aerial tile because no free photograph of it exists.
- The liminal home cards use the same photographs (the old Shime card showed the town hall). The food and shopping cards stay labelled map previews.
