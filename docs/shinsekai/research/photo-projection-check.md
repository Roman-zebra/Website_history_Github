# Roof-garden height versus apparent photograph proportion

Claude's updated tower review measures the roof-garden edge at roughly 36–40% of the visible ground-to-top span in the 1914 and 1921 north photographs. The provisional model uses the 1913 album statement **“地上五十尺の所にはルーフガーデンあり”** ([Osaka Prefectural Library reference answer](https://crd.ndl.go.jp/reference/entry/reference/show?id=1000291784)), or about 15.15 m above ground, and a separate 75.76 m total-height control. Their height ratio is about 20%. This apparent discrepancy is a **camera-calibration problem**, not evidence by itself that either source number should be changed.

For a simple pinhole camera at height 1.6 m, horizontal distance `D` from a vertical facade, and upward pitch `a`, projected vertical coordinate before focal length and image offset is:

`v(h) = [cos(a) (h - 1.6) - sin(a) D] / [sin(a) (h - 1.6) + cos(a) D]`.

The apparent roof fraction is `[v(15.15) - v(0)] / [v(75.76) - v(0)]`. Illustrative values with facade and apex at the same depth:

| Camera distance | Pitch 0° | Pitch 20° | Pitch 35° |
| --- | ---: | ---: | ---: |
| 20 m | 20.0% | 37.7% | 48.8% |
| 30 m | 20.0% | 32.6% | 41.5% |
| 40 m | 20.0% | 29.8% | 37.1% |
| 60 m | 20.0% | 26.8% | 32.2% |

Thus an apparent 36–40% edge is mathematically possible with the sourced 50-shaku level under a steep upward view. **These rows are examples, not inferred historical camera locations.** The real photographs may place the tower shaft behind the front facade, use unknown lenses, have prints cropped or retouched, and show a later parapet. A plausible fit must also reproduce turret width convergence, arch shape, and multiple landmark positions in at least two independent views. We should not raise the roof deck or alter the 75.76 m control just to match one screen-space percentage.

Next measurement: on 1914 view A and CC0 `c1815001`, record image coordinates for the ground at each arch pier, roof-garden edge, turret tops, observation underdeck and apex, plus left/right turret widths at two heights. Then fit distance, pitch, focal length and image offset jointly. Keep photographed landmarks with uncertain identity out of the fit. The 1921 plate tests geometry but its added name band may change the chosen roof edge.
