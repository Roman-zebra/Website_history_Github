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

## Handoff 55: modern leads require consistent landmark definitions

Claude supplied modern K1 (730,1700), J1 (1300,598), candidate W0 (78,1497), an out-of-frame approximate K2 near (1115,1800), and an E0 aerial↔modern check. J2 cannot be matched. Codex inspected the supplied crops and extended all three mosaics southward by one row (24 public GSI tiles, retrieved 2026-09-30); the new 8×8 mosaics retain the existing top-left pixel origin and stay in the local cache outside Git.

No modern fit is accepted. The earlier K1 wording/pick describes a corridor meeting the bright embankment or underpass mouth, whereas the modern pick describes the JR track-bundle centre. These definitions may differ, and widened railway corridors can move their centres. A source-layer offset cannot be inferred until that distinction is resolved visually. K2 needs the newly supplied southern row; E0 is outside S063 and must not become a 1912 control. Requested labelled point identities rather than moving readings to improve residuals.

## Revision after handoffs 56–57: K1 physical definition B

Codex inspected the labelled S063 and aerial crops and replaced K1 consistently by the historical double-track-band midpoint: S063 (4239,5915), 1928 (757,1675), 1936–42 (740,1676). The old table used an undefined source point and aerial tonal edges; those readings are withdrawn in the candidate's note. The original table/results above are a pre-revision record and are superseded by the following reproducible results. The new 8×8 mosaics keep the old pixel origin.

| Source → target | Model | Training RMS (px) | Withheld W0 error (px) |
| --- | --- | ---: | ---: |
| 1928 → 1936–42 | Similarity | 4.0 | 9.9 |
| 1928 → 1936–42 | Affine | 2.8 | 27.9 |
| S063 → 1928 | Similarity | 29.7 | 98.6 |
| S063 → 1928 | Affine | 9.3 | 107.5 |
| S063 → 1936–42 | Similarity | 27.6 | 94.7 |
| S063 → 1936–42 | Affine | 7.1 | 86.9 |

K1's corrected physical definition improves aerial-to-aerial agreement. It still does not establish a global 1912 transform or justify any tower coordinate. Similarity generalises better to withheld W0 than affine in the aerial comparison; these uncertainty ranges remain candidate reading estimates, not calibrated confidence intervals.

Handoff 56 also withdrew modern K2 (no common underpass), and K1/W0's widened modern railway bundle centres are not invariant point controls. Their surviving railway/tram **line segments** may support a future orientation/cross-track test, with endpoint identities and changes documented. Revised E0 std (1050,565) supersedes (1049,580); E0 is off S063. Do not force a modern transform from two nearby northern points. K2/W0 need the same explicit source-versus-historical-aerial definition audit before another global fit.

## Handoff 58: K2 C and withheld W0 B

Codex inspected the labelled source crops. K2 remains the directly read north-mouth candidate C (6070,6400) against existing historical aerial candidates, with conservative previous tolerances; its track-centre alternative is derived from the K1–W0 rail line and is excluded. W0 now uses the centre between Nankai tracks, source B (1152,5056), withdrawing (1180,5067) on the eastern track. No change was selected to reduce residuals.

| S063 → target | Model | Training RMS (px) | Withheld W0 error (px) |
| --- | --- | ---: | ---: |
| 1928 | Similarity | 29.7 | 99.7 |
| 1928 | Affine | 9.3 | 102.2 |
| 1936–42 | Similarity | 27.6 | 96.3 |
| 1936–42 | Affine | 7.1 | 81.7 |

These supersede the previous W0 results. Aerial→aerial results are unchanged because W0's historical aerial readings did not change. The surviving 1912 misfit remains far larger than the corrected source reading shift. No global map transform or tower coordinate is accepted.
