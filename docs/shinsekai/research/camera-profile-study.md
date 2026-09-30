# Conditional camera/geometry profile — pause checkpoint

2026-09-30. The user asked to pause at a clean checkpoint. The 10-minute heartbeat is **PAUSED**. This study does not approve a historical height or alter any GLB/site coordinate.

## Implementation and input

- `shinsekai-least-squares.cjs`: deterministic scaled, bounded robust least squares with active-bound handling, feasible numerical derivatives, multiple initialisations and one-sided Jacobi SVD. Invalid domains return null; programming/shape errors fail explicitly.
- `profile-shinsekai-camera.cjs` / `camera-scenario-v1.json`: shared variable base, early upper form, separate cameras including roll and principal point, fixed-height profiles, training/holdout separation and camera-only south calibration. The later photographed plate-46 upper form is excluded from early-form fitting.
- Handoff 65's eight raw floor samples are preserved with SHA-256 `ec74321b6eebe76a02e1070c18ac4aa57e8eac2f52ed4135e10d97c3a57c5e1b`. The primary case selects six; the view-A cornice alternative selects the other pair. Each sample is compared with the projected floor line using its x/y tracing weights. No occluded centre x, known endpoint Z or flattened row is substituted.
- All geometry bounds, focal/principal-point ranges, symmetry, shaft setback, square turret, equal near/far crown and upper segment choices are **declared scenarios**. Old plate-derived dimensions are initial guesses, not independent constraints. The south coping and north floor-line equivalence remain uncertain.
- The south crown prediction uses the **54 px apex-ring alternative** from the v3 53–55 px range, rather than the raw 50 px finial/rib-end point. Its gallery-base comparison uses the primary 105 px reading; 92 px remains an unrun alternative. These choices need sensitivity review after resume.

Reproduce after resuming:

```
node scripts/profile-shinsekai-camera.cjs --output ../research-cache/camera-profile-v1.json
node --test tests/shinsekai-least-squares.test.cjs tests/shinsekai-camera-profile.test.cjs
```

The compact committed output is `camera-profile-v1-summary.json`; full per-landmark results/parameters are in the local cache. No protected photograph or overlay is committed.

## Results that prevent height adoption

| Early rod-tip scenario (m) | Best working cost | Converged | Joint rank / parameters | Withheld south RMS (px) |
| --- | --- | --- | --- | --- |
| 60 | 0.137 | No | 28 / 29 | 21.0 |
| 68 | 0.157 | Yes | 28 / 29 | 24.0 |
| 75.76 | 0.262 | Yes | 28 / 29 | 23.7 |
| 85 | 0.478 | No | 28 / 29 | 18.9 |

Costs use Huber loss on tracing-weighted components, not historical likelihoods. These are bounded local solutions among three deterministic starts, not certified global minima. All north solutions hit chosen bounds. South cameras are calibrated on base landmarks/floor only; the withheld upper/outer-arch points have 19–24 px RMS in a 347×534 scan (working tolerances around 3 px). This **does not pass** the independent prediction check and does not identify which historical assumption is wrong.

Crucially, the augmented Jacobian includes height; reporting fixed-height nuisance rank alone would hide the missing direction. The joint rank is 28/29 at relative threshold 1e-7, with a very small singular value. A direct regression test demonstrates the exact ambiguity:

1. Scale all X/Y lengths, cameras and shared segment lengths by s.
2. Transform observed Z values and camera elevation about the fixed roof level R: Z′ = R + s(Z−R), including H′ = R + s(H−R).
3. The training projections, including the fixed-height floor line and infinite vertical edges, remain identical. No observed ground-level point anchors the remaining scale direction. The outer arch offset is fixed by a guess and its north sample is withheld, so it does not resolve the training gauge.

Thus a lower profile cost near 60 m cannot be adopted as a measured height; chosen bounds, approximate datum and geometry assumptions determine the remaining variation. More optimisation or a stronger model alone cannot remove this mathematical ambiguity.

## Tests and restart point

Nine new tests cover nonlinear recovery, coupled active bounds, outliers, singular directions, infeasible/shape errors, typed role/input integrity, tilted floor alternatives, nine-parameter camera recovery on a synthetic noncoplanar surveyed scene, and the actual roof-fixed height ambiguity.

Full build passed **205/205 tests** at the pause checkpoint. The new solver is research-only and excluded from dist.

After the user explicitly resumes: review Claude handoffs 66 onward, then seek a genuinely visible ground/datum landmark or independently justified camera metric. Review model/correspondence/era and floor-offset alternatives before another profile. Improve diagnostic visualisations/overlays locally for Claude's visual check, without treating a bound-driven minimum as historical evidence. T2/T3/T9 gates remain open; T0/T1 only are complete.
