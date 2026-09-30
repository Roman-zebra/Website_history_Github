# Historical image-layer registration (2026-09-30)

Research pixels only. This is not a tower coordinate, a map datum correction or an accepted production transform. Both mosaics use the same z18, 8×7 tile extent, including the western column; the five candidate readings come from `map-control-candidates.json`. J1/J2 use Claude's corrected street identity from handoff 49.

Run `node scripts/fit-shinsekai-map.cjs --source-layer 1928` to compare the 1928 aerial pixels directly with 1936–42 aerial pixels, rather than predicting them from S063. K1/K2/J1/J2 train the fit; W0 remains withheld. Without the flag, the existing S063 comparison still runs.

| 1928 → 1936–42 model | Training RMS (px) | Withheld W0 error (px) | W0 predicted | W0 observed |
| --- | ---: | ---: | --- | --- |
| Similarity | 7.3 | 22.6 | (37.3, 1518.0) | (57, 1507) |
| Affine | 3.0 | 66.2 | (6.6, 1549.9) | (57, 1507) |

The affine's lower training error accompanies a much worse western prediction. Four controls include a short northern pair on one street and lack broad western coverage. Do not prefer affine from training RMS alone. Similarity still misses W0 by about 11 m at this latitude; candidate reading uncertainty and centreline changes remain possible. The stated ± pixel ranges are not calibrated statistical standard deviations, so they do not establish a confidence interval or acceptance threshold.

This calculation isolates aerial-to-aerial disagreement from S063 distortion. It **does not register the modern standard map**: only J1's approximate modern reading and W0's candidate modern reading are currently available, which would fit a two-point similarity exactly without an independent check. C1/C2 are modern-topology leads, not historical-aerial controls. Obtain distributed, visually matched modern readings and reserve a separate check before comparing C1/C2 offsets. The dark circular mark remains unidentified.

The affine solver now centres/scales source pixels before solving, and RMS uses unrounded distances. Synthetic tests cover known rotation/translation, shear with large pixel offsets, collinear rejection and independent holdout selection. These numerical checks do not establish historical feature identity.
