# Joint tower and camera fit: reviewable formulation

Prepared 2026-09-30 from the supplied Claude fitting scripts and landmark tables. This is a method proposal, not a measured height or a production geometry approval.

## Input audit

| Input | What is observed | What is assumed or dependent |
| --- | --- | --- |
| 1921 plate 46, NDL 962657 canvas 48 | Image rows/edges, including near/far arch candidates and tower silhouette | A roof line denotes the 50-shaku floor; near/far bright crowns have equal height; standing heads approximate a horizon; camera eye height 1.3–1.7 m; pitch 0–3°; focal length 900–2000 px; passage length 20–31 m; shaft at midpoint |
| 1914 view A, NDL 952032 canvas 95 right, 890×1650 crop | Seven base landmark pixel pairs and upper tower rows | Base coordinates (facade width, dome height, arch height and passage depth) are derived from plate 46; crop centre is a principal-point scenario; pose/focal/pitch remain coupled |
| 1912/1913 roof statement | Roof garden reported at 50 shaku above ground | Approximate metric scale around 15.15 m; identifying the correct visible floor is separate from converting units |
| 1912/1914/1922/1924/1940 height statements | Conflicting reported height/elevation figures | No common measured ground-to-tip datum; none should be forced as ground-relative truth |
| OML north/south views | Separate camera sectors with individually checked CC0 rights | Camera station, focal length and exact exposure dates remain unknown; small scans limit tracing accuracy |

The old Monte Carlo percentiles are conditional on uniform scenario ranges. They are not observational confidence intervals. View A's fixed metric base landmarks are dependent on plate 46, so their good residuals do not constitute a second independent metric measurement.

## Shared geometry and projection

Use metres with X east, Y north and Z up. Fix the ground plane and the base centre to remove arbitrary world translation/rotation. Use the reported roof level to set the metric-scale scenario.

Shared geometry parameters include total height H, facade width W, passage depth L, turret/arch dimensions and shaft setback t. Relative to a north facade at Y=L/2, the shaft coordinate is Y=(0.5−t)L; t=0.5 is a symmetry scenario, not an established fact. Keep photo-derived base dimensions variable rather than using them as independent measured constraints.

For each view, fit camera centre C, heading, pitch, roll, focal length f and principal point (cx,cy). Define orthonormal right/up/forward axes R/U/F explicitly and use positive camera depth:

```
d = worldPoint − C
z = dot(d,F) > 0
u = cx + f * dot(d,R) / z
v = cy − f * dot(d,U) / z
```

Match the supplied crop coordinates exactly. Original-page and crop principal points must be transformed together; principal point cannot be silently reset to the crop centre. Pixel aspect, scan stretch, distortion or print retouching are unresolved alternatives, not additional free parameters to absorb every error.

## Objective and checks

1. Build a versioned landmark table with source/crop transforms, explicit physical feature identity, tracing tolerance, era and provenance of each 3D coordinate. Separate observed 2D values from inferred metric values. Retain alternative roof/crown labels as discrete scenarios.
2. Minimise shared multi-view pixel residuals with a robust loss. Weight tracing tolerances as working scales, not calibrated noise distributions. Record any bounds/priors as source-backed facts or chosen scenarios; do not present a chosen bound as a measurement.
3. Profile a range of H values and optimise nuisance parameters for each, from multiple deterministic initialisations. Include alternative shaft setbacks, principal points, roof labels and camera-height scenarios. Report residuals per view and per landmark, not only a pooled score.
4. Inspect the scaled residual Jacobian's singular values and parameter directions for weak constraints. Flag solutions at imposed bounds and near-equivalent camera/geometry combinations. A single minimum is insufficient when those directions remain weakly determined.
5. Withhold identifiable landmarks, and reserve an independent south-sector image for prediction before choosing a default. Its dimensions and camera must not be estimated by tracing the model being tested. Matching the two training images alone is insufficient.
6. Check that physically plausible cameras still fit the base perspective and silhouette, and compare publication-era modifications. Do not share a 1921 sign/parapet landmark with 1914/1912 without evidence of continuity.

## Outputs and next step

The first executable study should emit deterministic parameters, assumption scenarios, per-landmark residuals, held-out errors and a height-profile plot. Keep raw NDL photos/overlays outside Git until redistribution is cleared. No site coordinates or GLB default changes come from this formulation.

Next: obtain a clean, versioned table of raw landmark coordinates and crop transforms from Claude, explicitly marking the plate-derived view-A metric dependencies and roof/crown alternatives. Codex can then implement and test the shared projection/profile solver locally. The user-selected 6.1 High setting is sufficient for this input audit; consider requesting 6.1 Max or Astra only if a concrete geometry/identifiability decision remains after the data and diagnostic outputs are ready for review.
