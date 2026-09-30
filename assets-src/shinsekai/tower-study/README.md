# First Tsutenkaku silhouette study

This is an editable **T3 preparation study**, not a production asset. `build-tower.py` creates the north-side orthographic render `north-study.png` and the four-mesh `tower-study.glb`. Neither is referenced by the website build or public page.

## v2 study (reviewed and merged from `claude/tower-shape-fix`)

- `build-tower.py` v2 corrects large forms against camera-matched overlays of the 1921 plate 46 and 1914 view A. The corrections cover narrower roof-level legs, an elliptical arch about 20 m wide with a crown of about 10.9 m, a 29 m facade, turret domes at about 22 m, a vaulted passage and upper levels placed by photo fractions. Total height (`--height`, default 75.76 m) and base depth (`--passage-depth`, default 26 m) are **parameters**. The roof garden stays at 15.15 m. The v1 study is kept as `tower-study-v1.glb` / `north-study-v1.png`. Camera assumptions, residuals (base RMS 80→17 px in plate 46, 77→11 px in view A) and remaining mismatches are in `photomatch-v2.md`. Plate-46 facade details are 1921 later-period candidates. The bullets below describe v1 and still apply unless `photomatch-v2.md` says otherwise.

## Evidence and limits

- The model's **75.76 m** overall height is an adjustable scenario, supported as a reported figure by the [1924 *メートル式度量衡便覧* table](https://dl.ndl.go.jp/pid/917132/1/25) (`75米76糎（250尺）`) and the directly inspected [1912 description](https://dl.ndl.go.jp/pid/946141/1/267) (`高さ二百五十尺に達し`). Neither establishes a measured ground-to-tip datum. The [1914 guide](https://dl.ndl.go.jp/pid/952032) reports both 250 and 300 shaku; a [1922 book](https://dl.ndl.go.jp/pid/964429/1/170) calls 250 shaku **sea-level elevation**, and the [1940 contractor retrospective](https://www.obayashi.co.jp/chronicle/yoshigoroden/t5c3s5.html) reports a rounded 200 shaku. Keep these conflicting dates and reference levels distinct. The roof garden remains near **50 shaku (about 15.15 m) above ground**, corroborated by the [1913 album cited by Osaka Prefectural Library](https://crd.ndl.go.jp/reference/entry/reference/show?id=1000291784) and a [1912 description](https://dl.ndl.go.jp/pid/946141/1/268).
- The north-side control is the [1914 *大阪独案内* view A (NDL PID 952032, canvas 95, right photo)](https://dl.ndl.go.jp/pid/952032/1/95). The larger 1921 *建築写真類聚* plate 46 ([NDL PID 962657, canvas 48](https://dl.ndl.go.jp/pid/962657/1/48)) supplies later structural detail; plate 47/canvas 49 supplies underside detail. Osaka Municipal Library CC0 postcard `c0234001` ([record](https://image.oml.city.osaka.lg.jp/da/detail?tilcod=0000000021-OSK0157352)) is now a **probable south-side camera sector**, based on comparison of its foreground pavilion with the music hall on the opening commemorative card. Its exact station remains unknown. The 1921 plates do not establish exact 1912 paint or modifications.
- The north entrance `c1815001` ([record](https://image.oml.city.osaka.lg.jp/da/detail?tilcod=0000000021-OSK0158510)) is a rights-cleared north sector: the park sign is visible through the arch and the cabin is on image right. The White Tower viewpoint `d0285001` ([record](https://image.oml.city.osaka.lg.jp/da/detail?tilcod=0000000021-OSK0158887)) and Ebisudori view `c1819001` ([record](https://image.oml.city.osaka.lg.jp/da/detail?tilcod=0000000021-OSK0158514)) supply the other two sectors for later camera matching.
- Every horizontal dimension, arch radius, intermediate level **other than the approximate roof garden**, roof detail and material colour in the script is **estimated**. The orthographic render is a silhouette aid; it has not been registered to any historical photo. No first-tower footprint or camera/lens coordinate has been established. The source images' catalogue dates are recorded in `docs/shinsekai/research/photo-controls.md`.
- Claude observed that the photographic roof edge occupies a much larger fraction of image height than the provisional 50-shaku/75.76 m numerical ratio. `docs/shinsekai/research/photo-projection-check.md` shows that camera pitch can create such a ratio; it does not fit either actual photograph. Keep the 50-shaku level and jointly fit the camera and ground-relative total height to multiple landmarks before replacing this blockout.
- Direct visual review against 1914 view A and the 1921 plate led to rounded turret cupolas, two observation galleries and a taller open crown in this revision. The lattice, room proportions, parapet and facade ornament are still schematic, and adjoining street buildings are absent. The pavilion in `c0234001` is a separate facility and is absent from this tower-only study; it probably matches the music hall, with a southern camera sector (see `docs/shinsekai/research/photo-controls.md`). These remain T3 reconstruction work, rather than evidence that the simple shapes are historically exact.

## Rebuild and acceptance

For the preserved v2 baseline, run `blender -b --python assets-src/shinsekai/tower-study/build-tower-v2.py` from the repository root. Pass `-- --export-only` to regenerate only the GLB. The source keeps each part named and editable; export joins parts by material to keep the current GLB to four meshes/materials and about 0.71 MB. Blender 4.5.10 generated the render and GLB. The current GLB passed glTF-Validator 2.0.0-dev.3.10 with **0 errors, 0 warnings, 4 unused-UV infos** on 2026-09-30; the validator was installed free in a temporary directory because Claude's reported global path was unavailable in this shell.

Before using this model in T4: establish the site plan and tower anchor, match at least the north and White Tower photos with an explicit camera model, replace guessed dimensions/colours, then rerun glTF validation and visual/performance checks. Do not interpret this study as a reconstruction of the 1912 opening state.

## v3 conditional study (reviewed from Claude branch19025f7)

The v2 study is unchanged: `build-tower-v2.py`, `north-study.png` and `tower-study.glb` are the files from main. v3 writes separate files.

Reproducible builds (Blender 4.5.10, from the repository root):

```
blender -b --python assets-src/shinsekai/tower-study/build-tower.py -- --top open-crown
blender -b --python assets-src/shinsekai/tower-study/build-tower.py -- --top enclosed-box
blender -b --python assets-src/shinsekai/tower-study/build-tower.py -- --top open-crown --iron redbrown
```

Every value below is a **conditional parameter**, not a measured world dimension:
- `--height` (75.76) and `--passage-depth` (26) are unchanged from v2.
- `--ratio-box 0.47`, `--ratio-mid 0.59` and `--flare-start 0.55` set the flared leg profile. They are plate-46 outer-width ratios in one perspective photo; camera pitch is not removed.
- `--lace-cell 1.6` sets the diamond lacing density (visual reading).
- `--well-fraction 0.28` sets the central elevator well size.
- The open-crown band : gallery : crown split uses south-view pixel proportions.

Parts and forms:
- **Top forms** are named by what the photos show, with no date implied:
  - `open-crown`: solid band, open railed gallery and openwork ribbed crown (view A; south c0234001; OML 158510).
  - `enclosed-box`: two-tier enclosed box and low cap (plate 46; OML 158880/158886).
  - The shaft-top height is shared between the two forms, as a scenario.
- **Elevator interface for T5**: a separate unmerged node `elevator_car` at the bottom stop, and empties `elevator_well_bottom` (roof garden) and `elevator_well_top` (box underside). The opening-era well does not reach the ground; the ground-level shaft is the 1938 alteration.
- **Per-part metadata**: `tower-study-v3-<top>.parts.json` lists evidence and assumptions for each part, plus the parameters and the build command. The GLB scene extras carry a short `study` record.
- **Not modelled**, with scenarios kept open: the ropeway landing, roof planters, cinema wings and coping thickness. The iron colour stays an option: grey (provisional) or red-brown (postcard candidate).

Outputs and budget (glTF-Validator 2.0.0-dev.3.10):

| file | errors / warnings / infos | material primitives | vertices | triangles |
|---|---|---|---|---|
| tower-study-v3-open-crown.glb | 0 / 0 / 7 | 5 | 44,064 | 23,924 |
| tower-study-v3-enclosed-box.glb | 0 / 0 / 7 | 5 | 39,936 | 21,660 |

- Renders: `north-study-v3-open-crown.png`, `north-study-v3-enclosed-box.png`, `north-study-v3-open-crown-redbrown.png`. The red-brown GLB is not committed.
- Instancing the lacing and an LOD card are still to do.

Photo projections:
- Before/after overlays of v2 and v3 in all three photos use the unchanged Codex camera settings for 75.76 m from `camera-profile-v2.json`. They are kept outside Git in `research-cache/claude-v3-overlays/`.
- The base does not match in either version, because those cameras were fitted with the anchor-model base of the camera study (about 35.3 m × 15.2 m), not the study base. Only the shaft difference between v2 and v3 is meaningful there.

Codex independently rebuilt both forms with Blender4.5.10 and validated both supplied GLBs (0 errors/0 warnings/7 infos). Rebuild JSON and all floating-point accessor bytes are identical; triangle ordering differs, but the oriented triangle sets are identical. These are reproducible geometry results, not byte-identical GLBs or a photographic acceptance. Both old GLB/render and archived v2 generator were checked against main. No public viewer/default changed.

Generator guards reject non-finite/infeasible parameters before editing the scene. The lacing-cell range0.25–5m is a local build budget constraint, not source evidence. Red-brown metadata writes to its own suffix rather than overwriting grey metadata. Travel markers delimit the well (15.85..58.7892m in this scenario), not permissible car-centre heights: a motion adapter must subtract the car half-height and clearance from the upper limit and add them at the bottom. Instancing/LOD, shape/camera consistency and three-photo acceptance remain open.
