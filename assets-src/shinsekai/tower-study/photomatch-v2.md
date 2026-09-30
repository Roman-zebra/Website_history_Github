# v2 shape corrections: camera-matched residuals (Claude, 2026-09-30)

Branch `claude/tower-shape-fix` proposes shape corrections to `build-tower.py`. The previous study is kept for comparison as `tower-study-v1.glb` and `north-study-v1.png` (the v1 script is in Git history). **The roof garden stays at the sourced 15.15 m. Total height (`--height`, default 75.76 m) and base depth along the passage (`--passage-depth`, default 26 m) are parameters, not findings.**

The overlay images contain historical photographs, so they are **not committed**. They remain in Claude's local workspace (`claude-out/qa/photomatch/cmp_*_overlay.png`, `cmp_grid_small.jpg`). The photographs are NDL login-free images: the 1921 *建築写真類聚* plate 46 ([PID 962657, canvas 48](https://dl.ndl.go.jp/pid/962657/1/48); crop x 560–1951, y 440–2300 of the IIIF full image) and the 1914 *大阪独案内* view A ([PID 952032, canvas 95](https://dl.ndl.go.jp/pid/952032/1/95), right photo, 890 × 1650 px).

## What changed (v1 → v2) and why

| Element | v1 | v2 | Evidence (all photo-derived at the 15.15 m roof scale; plate 46 is **1921**, so facade details are later-period candidates) |
| --- | --- | --- | --- |
| Base depth / tower axis | 10.65 m; axis 5.3 m behind the north face | **parameter**, default 26 m; axis at the middle (assumed front–back symmetry) | Plate 46 near/far arch ratio gives 20.7–30.5 m; the 1939 retrospective's 「中段二百二十五坪、十五間四角」 would be about 27.3 m (secondary source) |
| Passage | two thin facades, open between | vaulted passage through the full depth | The far exit and dark vault are visible through the arch in plate 46 and view A |
| Arch | semicircle, 17 m span, crown 13.5 m | elliptical, **about 20.1 m** span, **crown about 10.9 m**, springing about 2.9 m | Plate 46 near arch feet and intrados crown |
| Facade outer width | 32.2 m | **29.0 m** | Plate 46 turret outer edges (28–29.6 m) |
| Turrets | dome top 26.55 m, finial 28.3 m | dome top **about 22.1 m**, finial about 22.9 m, flush with the facade | Plate 46 dome crowns; view A agrees within about 0.3 m |
| Legs at roof level | about 22 m apart | **about 11.4 m** apart, square plan (assumed), concave taper to the observation box | Plate 46: 36–42% of the facade width; the plan depth is not visible in any view |
| Observation box and crown | fixed levels 67.5–75.76 m | fractions of the height above the roof: box 0.72–0.86, crown apex 0.955 | Both north views: box bottom 0.72–0.73, box top about 0.86, crown top 0.94–0.96 |

## Cameras (assumptions)

- **Plate 46**: pinhole, f = 1264 px, principal point (702, 1359.7) in the crop (rising front allowed), pitch up 1.83° (from the 0.6° convergence of the turret edges), camera height 1.5 m (people's heads at row 1400), heading due south on the axis, 45.29 m in front of the north face. This is the median solution of the earlier plate-46 fit, **not** an independently calibrated camera.
- **View A**: fitted to seven base landmarks (roof, turret edges, dome tops and arch crown), with pitch fixed level and the principal-point row free, f = 1100 px. Position is 2.9 m east and 47.8 m north of the north face, 25.7 m high, with 2.0° roll. The camera is **weakly determined**: height, distance and lens trade off with 4–7 px residuals. Its 25.7 m height puts the roof deck in view, which the photograph does not clearly show.

## Residuals (model − photo, px; metres at the point's depth in parentheses)

Plate 46 (turret outer edges compared in x only):

| Point | v1 (75.76 m) | v2 (75.76 m) | v2 at `--height 63` |
| --- | --- | --- | --- |
| tip | 0, −433 (17.4) | 0, −209 (9.6) | 0, +49 (2.2) |
| crown apex | 0, −486 (19.5) | 0, −214 (9.9) | 0, +32 (1.5) |
| box bottom | 0, −544 (21.8) | 0, −166 (7.6) | 0, +23 (1.1) |
| roof edge | 0, −6 (0.2) | 0, −7 (0.2) | same |
| turret outer E / W (x) | −56 / +50 (2.1 / 1.8) | +6 / −12 (0.2 / 0.5) | same |
| dome E / W | −32,−115 / +26,−115 (4.5 / 4.4) | +18,+27 / −24,+27 (1.3 / 1.4) | same |
| arch crown near / far | −72 / −95 (2.6 / 4.2) | −1 / +9 (0.0 / 0.5) | same |
| arch feet E / W | +42,−58 / −41,−58 (2.6) | −1,+1 / +2,+1 (0.1) | same |
| **base RMS** | **80.3 px** | **17.1 px** | 17.1 px |

View A:

| Point | v1 (75.76 m) | v2 (75.76 m) | v2 at `--height 63` |
| --- | --- | --- | --- |
| tip | +12, −389 (18.8) | 0, −259 (14.3) | −8, −29 (1.6) |
| crown apex | +12, −420 (20.3) | −1, −247 (13.7) | −9, −27 (1.6) |
| box top / bottom | −444 / −458 (21.5 / 22.2) | −223 / −193 (12.3 / 10.7) | −28 / −27 (1.7) |
| roof edge | +10, −8 (0.6) | +10, −8 (0.6) | same |
| turret outer E / W | −64 / +66 (2.8 / 3.0) | −13 / +15 (0.7) | same |
| dome E / W | −43,−97 / +43,−101 (4.8 / 5.1) | −5,+5 / −3,−6 (0.3) | same |
| arch crown | −1, −56 (2.5) | −3, +3 (0.2) | same |
| **base RMS** | **76.7 px** | **11.2 px** | 11.2 px |

- The `--height 63` column only demonstrates the parameter. At 63 m, plate 46 puts the tip about 2 m higher and view A about 1.6 m lower. **This is not a height determination.** Both cameras depend on the assumptions above, and the plate-46 camera was fit with the same roof scale.
- **Silhouettes that are still wrong or uncertain**: turret domes are about 1.3 m off in plate 46 (plan size and dome shape are estimates). The 1921 sign band on the base parapet is **not** modelled; it is a later-period candidate. The lattice column under the tower in the 1921 passage is **not** modelled, because its purpose and date are unknown. The shaft plan depth is assumed square. The view A camera sees the roof deck from above, which may be a camera artefact. No residual worsened from v1 to v2 at any listed landmark.

## Rebuild

```
blender -b --python assets-src/shinsekai/tower-study/build-tower.py -- --height 75.76 --passage-depth 26
```

The GLB is still four meshes/materials (11,192 triangles, 714,816 bytes). glTF-Validator 2.0.0-dev.3.10 reports 0 errors, 0 warnings and 4 infos (unused UVs).
