# Roof-garden height versus apparent photograph proportion

Claude's updated tower review measures the roof-garden edge at roughly 36–40% of the visible ground-to-top span in the 1914 and 1921 north photographs. The 1913 album states **“地上五十尺の所にはルーフガーデンあり”** ([Osaka Prefectural Library reference answer](https://crd.ndl.go.jp/reference/entry/reference/show?id=1000291784)), or about 15.15 m above ground. The [1924 *メートル式度量衡便覧* table](https://dl.ndl.go.jp/pid/917132/1/25) explicitly labels the tower's **height** as 75 m 76 cm (250 shaku), but a [1922 contemporary description](https://dl.ndl.go.jp/pid/964429/1/170) calls 250 shaku **“海拔”** (above sea level). These sources disagree on the reference level; neither page resolves the conflict. This numerical example tests only whether perspective *can* account for the apparent ratio; it is not a fitted camera or an adopted as-built height.

For a simple pinhole camera at height 1.6 m, horizontal distance `D` from a vertical facade, and upward pitch `a`, projected vertical coordinate before focal length and image offset is:

`v(h) = [cos(a) (h - 1.6) - sin(a) D] / [sin(a) (h - 1.6) + cos(a) D]`.

If ground-relative tower height is provisionally 75.76 m, the apparent roof fraction is `[v(15.15) - v(0)] / [v(75.76) - v(0)]`. Illustrative values with facade and apex at the same depth:

| Camera distance | Pitch 0° | Pitch 20° | Pitch 35° |
| --- | ---: | ---: | ---: |
| 20 m | 20.0% | 37.7% | 48.8% |
| 30 m | 20.0% | 32.6% | 41.5% |
| 40 m | 20.0% | 29.8% | 37.1% |
| 60 m | 20.0% | 26.8% | 32.2% |

Thus an apparent 36–40% edge is mathematically possible with the sourced 50-shaku level under a steep upward view. **These rows are examples, not inferred historical camera locations.** The real photographs may place the tower shaft behind the front facade, use unknown lenses, have prints cropped or retouched, and show a later parapet. A plausible fit must also reproduce turret width convergence, arch shape, and multiple landmark positions in at least two independent views. Keep the 50-shaku roof level as the documented control; estimate ground-relative total height and camera jointly, then test the 1922 and 1924 readings against a contemporary ground elevation.

Next analysis: assemble comparable landmark coordinates from 1914 view A, the high-resolution 1921 plate 46 and a White Tower-side view, including ground at each arch pier, actual roof-garden floor (if visible), turret tops, observation underdeck and apex. Fit distance, pitch, focal length, setback and image offset jointly. Keep landmarks with uncertain identity out of the fit. The 1921 plate tests large geometry but its added name band can conceal or change the chosen roof edge.

The library's “high-definition” viewer for `c1815001` loads the same **345 × 537 px** original as its download (checked in Chrome on 2026-09-30). Zooming does not reveal additional pixels. A 1%-of-tower-image-height target is only a few source pixels, so record landmark uncertainty and print/crop effects rather than treating every traced edge as exact.

Claude's later reading in `tower-study-review-claude.md` §§11–12 finds the short turret verticals in `c1815001` nearly upright and a small inward lean in the higher-resolution 1921 plate 46. The latter has an estimated 33% apparent floor-to-top ratio but the **floor identity is uncertain** because of its later sign band. The reported 2–5° camera pitch depends on an assumed field of view and hand-picked edges; it has not been independently fit to a camera model. These observations challenge the steep-pitch illustration above but do not resolve the ground-relative total height. The north entrance postcard also hides the ground. Use at least two views and explicitly test the floor-line alternative before changing model dimensions.

Claude's subsequent plate-46 calculation (§13 of the archived review) uses the near and far arch crowns as two depth markers and holds the roof-garden floor at the documented 50-shaku level. It gives a **conditional** tip estimate near 65 m, with simulated 5th–95th percentiles of about 61–70 m. Those percentiles describe the chosen ranges of image rows, camera pitch, focal length, eye height and a 20–31 m passage depth; they are **not** a measured confidence interval for the 1912 tower. The far bright edge must represent the same-height arch crown, the roof line must be correctly identified, and the shaft must stand near the passage midpoint for the calculation to apply. Plate 46 was published in 1921 and may show changes since opening. Keep the tower study dimensions provisional until a shared model also fits the 1914 north photograph and an independent south-side view. The 1922 sea-elevation wording and the 1924 height table remain conflicting source statements; the calculation alone does not establish why they differ.
