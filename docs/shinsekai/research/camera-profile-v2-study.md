# Two-line coping and refined upper features — conditional v2

2026-09-30. This research comparison changes no GLB height or site position.

## Inputs and model

`camera-scenario-v2.json` preserves every raw v2 photographic record and the hash-checked floor snapshot. It adds a shared coping thickness, assigns plate46 and viewA rail samples to the top, and viewA lit-face and south shadow samples to the bottom. All eight visible samples keep their original x/y/roll. Bounds0.05–3m and the50-shaku roof level's association with the coping top are declared scenarios.

The hash-checked `datum-refinements-v2-claude.md` supports explicit y-only upper updates: viewA846/958, south54/76/106.5. The91–92 south gallery-floor edge is a different feature and is not substituted for the band bottom. Raw x and conservative v2 isotropic weights are retained; the newly reported y precision does not imply a new x precision. No anthropometric height prior, head-row horizon or pond conic is imposed.

The54.5m comparison is approximate conversion of a180-shaku1980 caption, which disagrees with250shaku in that book's body. It has weak secondary provenance and is not a measured lower bound, default or instruction to alter geometry.

## Results and controlled sensitivities

| Assumed tip height m | Conditional coping thickness m | North convergence | South withheld RMS px |
| --- | --- | --- | --- |
|54.5|0.565|No|26.55|
|60|0.625|No|28.59|
|68|0.704|Yes|31.26|
|75.76|0.762|Yes|30.76|
|85|0.769|No|26.95|

Every north profile hits imposed bounds. The height-augmented Jacobian has rank29/30. A direct test rescales coping thickness, horizontal dimensions, upper segments and cameras around the fixed roof plane while preserving every training projection. Adding a second floor line therefore **does not remove the metric-scale ambiguity**. Neither the profile minimum nor these thicknesses are historical measurements.

At75.76m, one-factor comparisons yield:

| Roof model / upper readings | South withheld RMS px |
| --- | --- |
|Old one-line / original upper|23.716|
|Two-line / original upper|30.870|
|Old one-line / refined upper|23.644|
|Two-line / refined upper|30.764|

This local comparison isolates the larger discrepancy to the two-line/common-base scenario in these solutions; it does **not prove the physically different roof edges should be made coincident**. Shape, common north/south geometry, camera sector, setbacks, retouching and correspondence still need independent evidence. Training costs have different residual counts between one-line and two-line cases, so do not compare them as common likelihoods. South cameras still fit only declared base/floor calibration; shared geometry and upper holdouts remain excluded from that calibration.

## Reproduce and review

```
node scripts/profile-shinsekai-camera.cjs --scenario docs/shinsekai/research/camera-scenario-v2.json --output ../research-cache/camera-profile-v2.json
node scripts/render-shinsekai-camera-review.cjs ../research-cache/camera-profile-v2.json ../research-cache/camera-review-v2.html --serve
```

The compact JSON records profile metrics and one-factor summaries; full results, sensitivity configs and protected JPEG overlays remain in local `research-cache`. Port18766 now displays v2. Chrome confirmed separate top/bottom rows and the visible comparison. Sparse anchors are not a whole-GLB silhouette check.

Three additional tests cover versioned raw-input/role integrity, recovery of both rolled floor lines on a synthetic known scene, and the exact remaining scale gauge. Production height/site/photographic gates remain open. Further repetition of the same height profile will not remove this ambiguity; T5 can proceed independently with local parameterised motion and explicitly assumed geometry/timing.
