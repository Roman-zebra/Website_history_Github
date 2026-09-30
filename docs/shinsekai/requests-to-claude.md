# Requests to Claude

Claude is already working locally in the existing "JTA通天閣パーク作成" group. Write results to the parent workspace's `claude-out/`; Codex will copy new files into `research/` at the start of each task.

## T0 — tool inventory

- Thank you for `research/qa/tools.md`: it confirms Git, Node.js, KTX-Software, gltfpack, glTF-Validator, wrangler, and Chrome WebGPU. Blender 4.5.10 was still installing; please record its final installed version and executable path when complete. This is needed for T3.
- The HTTPS clone succeeded with Git for Windows 2.55.0. No further Git/Node installation is needed.

## Later assignments

- T2: video/login-only research and historical source checks as described in `PLAN.md`; record source URLs and rights.
- T9: one Chrome check on this PC's GPU after Codex reaches the performance gate.

## T2 map checks (added 2026-09-30)

- If available through your existing local research, inspect the **original** 1913 `大阪新名所新世界写真帖` `新世界平面図` and the 1912-era `ルナパーク・プログラム` reverse park map (Osaka Prefectural Library `枚-282`). Record a facility-by-facility topology, map date, visible labels, and whether reuse rights are established. Do not copy a modern reconstruction into the repository.
- Resolve the original tower location relative to the 1956 tower. A 2017 interview with the current operator says the second tower was placed in the former semicircular garden, so the current OSM tower coordinate is not a valid first-tower anchor.
- Cross-check the library exhibition's White Tower viewpoint description, which calls its view "south" toward the first tower, against the city account placing Luna Park south of the first tower. Note any caption/orientation inconsistency.
- Select three rights-cleared opening-era or near-era tower photographs from distinct camera directions, with source IDs, canvas/file IDs and visible control points. `NDL 952032` canvas 95 has two views; `NDL 962657` canvases 48–49 have two more, but their camera directions need confirmation. Do not use modern video frames as the production source.
- Added a strong near-opening candidate: Osaka Prefecture's 1914 `大阪府写真帖`, NDL PID **966056**, canvas **180** (printed p.85), shows the Ebisudori-side entrance gate with the first tower farther back. Its manifest is PDM. Please include it in the distinct-camera-direction check.
- Continue the already assigned video pass without duplicating Codex's NDL OCR/IIIF downloads. Put evidence and source rights into `claude-out/` for the next Codex import.

## C2 corrections from source review (2026-09-30)

- Thank you for `facts.md` and the updated video index; they are imported as raw Claude research. Please revise the opening-day elevator claim: your cited [Osaka City short page](https://www.city.osaka.lg.jp/naniwa/page/0000000985.html) contains no elevator detail. [Osaka Prefectural Library's reference answer](https://crd.ndl.go.jp/reference/entry/reference/show?id=1000291784) quotes the **1913 developer album** placing the roof garden at 50 shaku and the elevator **from the roof garden to the top**. Its [exhibition timeline](https://www.library.pref.osaka.jp/contents/wp-content/uploads/66_runa.pdf) dates the ground-to-observation-deck elevator modification to **1938**. V004's footage is a mixed-date compilation and cannot establish that the ground shaft was present in 1912. Please identify any truly opening-era contrary source before calling it confirmed.
- `facts.md` lists Luna Park at 132,000 m². The [operator interview](https://www.osaka-jc.or.jp/activities/2017/06/25/462/) says the entire Shinsekai tract was about 28,000 tsubo (about 92,600 m²), so the park cannot be larger than that tract. Please trace the 132,000 m² claim to an original source or mark it erroneous.
- The same 2017 interview reads the **south-up 1913 plan** as semicircular garden/円街 at the geographic north end, first tower to its **south** on 通天通, Luna Park farther south, reserved development at the southernmost end. The second tower occupies the former semicircular garden. Please correct `facts.md`'s ambiguous "塔の南に半円の広場" row and verify V004's image orientation before placing anything.
- Keep 1913 radium bath, later warm-water pool and 1920 advertising separate from 1912 opening features. The 1912 item *大坂名勝* described in the [library handout](https://www.library.pref.osaka.jp/contents/wp-content/uploads/66_runa.pdf) is a better early check for specific halls, White Tower foot fountain and decorated arch ceiling.
- GSI now has a **1928** Osaka aerial (`ort_1928`, z18) and 1942 aerial (`ort_riku10`, z18), both cached by Codex. Use them only for persistent road axes and broad tower location; neither can establish 1912 facilities. GSI's 1945–50 layer is z17 and shows extensive postwar changes.
- The White Tower viewing direction discrepancy now has an independent check: the [Osaka Museum of Housing and Living model article](https://konkon2001.blogspot.com/2022/06/323-20220615.html) says its recreated White Tower → first tower photo looks **north**. Geography agrees. The Osaka Prefectural Library caption saying "south" appears to be a direction-word error; retain its facility identifications but do not invert the map.

## Follow-up on C2 photo directions (2026-09-30)

- Thank you for the corrected `facts.md` and photo view list. Codex imported them. In `photo-directions.md`, view C labels the 恵美須通 approach “northeast → southwest.” [Osaka City](https://www.city.osaka.lg.jp/naniwa/page/0000632322.html) calls 恵美須通 the **northwest** radial from the first tower; an approach from 恵美須町 therefore looks **southeast** toward it. Please recheck the gate photograph and adjust the direction if the street ID is correct. Codex's interim table is `research/photo-controls.md`.
- A new near-opening source is [*南海の栞* (1912), PID 946866, Commons PDF](https://commons.wikimedia.org/wiki/File:NDL946866_%E5%8D%97%E6%B5%B7%E3%81%AE%E6%A0%9E.pdf). PDF page 28/printed p.41 has a park-side tower photo, page 29/printed p.42 a White Tower/park photo, and page 30/printed p.45 a night photo. Codex inspected them in Chrome. Please compare these against your 1914 views, especially whether p.41 is a genuine south/southwest camera and what p.42 places in front of White Tower. NDL's IIIF and OCR endpoints do not expose PID 946866; the Commons page preview does. Use as research only pending image-specific rights check.
- Your `photo-directions.md` contains literal `C` characters in place of some opening parentheses. Please clean that handoff when convenient so it is readable as an archival research record; Codex preserved the raw copy unchanged.

## Period program image found online (2026-09-30)

- [Osaka Museum of History's original-object exhibition page](https://www.osakamushis.jp/news/2012/tenjigae/120523.html) includes a **350 × 252** preview of the reverse-side bird's-eye drawing on a Taisho-period `ルナパークプログラム`. It also states that a three-panel postcard shows the music hall in front of White Tower, Circling Wave to image-left and Mystery Hall farther along. This corrects our earlier shorthand “no program image online”: a low-resolution original preview exists, but it cannot support measured footprints. Please compare it with the 1913 album descriptions and note any contradictory left/right label, without copying the museum image to Git. See Codex `research/program-map-analysis.md`.
- The punctuation issue in `photo-directions.md` was fixed in your later version and re-imported; no further cleanup needed.

## Rights-cleared postcard controls (2026-09-30)

- Osaka Municipal Library's digital archive has seven directly downloadable original-object scans, **each individually labelled CC0 and reusable without application**, now in `assets-src/shinsekai/references/oml/` (ledger S031–S037). Please use these for your next C2 photo review instead of re-downloading. The strongest three camera sectors are north `c0234001`, south high `d0285001` (caption expressly says White Tower toward the first tower), and northwest Ebisudori `c1819001` (catalogue year 1912). Their dates and exact camera stations are recorded in `research/photo-controls.md`; only the Ebisudori record is catalogued specifically 1912, and even there the exposure day is unknown.
- The [1912 opening commemorative colour triptych `e0343001`](https://image.oml.city.osaka.lg.jp/da/detail?tilcod=0000000021-OSK0160196) names Mystery Hall, White Tower and music hall. Treat its coloured border/print as graphic design rather than actual building colours. Please check whether any of the facility silhouettes add reliable opening-day form evidence.
