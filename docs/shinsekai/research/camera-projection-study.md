# Typed photographic projection study

Implemented 2026-09-30 after Claude handoff 59. This is executable research infrastructure; it has not fitted a historical height or approved geometry.

## Inputs and reproducibility

- `photo-inputs-v2.json` records original dimensions, crop transforms, camera sectors, dates, rights and roles. Original NDL metadata was independently checked in the previous audit. Crop translations remain Claude's supplied/image-matched result.
- `photo-landmarks-v2-claude.csv` is the exact received snapshot. Its data row 15 has unquoted commas inside the final crop note, yielding 17 fields instead of 14. `photo-landmarks-v2.csv` quotes that note correctly. No numeric value or observation was changed. Both hashes and a parsed-cell comparison are checked by the audit.
- There are **41 records**: plate 46 has 10 points, two lines and two rows; view A has nine points and four edge samples; the probable south view has 10 points and four edge samples. Missing x values remain `null`.
- v1's plate-46 arch feet were mislabelled. v2 explicitly identifies east at (983,1800), west at (1540,1800). The north cameras face south; the probable southern camera faces north, so image-left changes physical side.
- Claude's summary says all south tolerances are ±3 px, but its two leg-edge records actually say **4 px**. The code preserves those values. They are tracing weights, not calibrated measurement uncertainties.
- The 347×534 CC0 south card was visually inspected again. Its face, turret centres, arch and upper silhouette can support a weak comparison, but its camera station, print distortion and exact exposure date are unknown.

Run from the repository:

```
node scripts/audit-shinsekai-photos.cjs
node --test tests/shinsekai-camera.test.cjs
```

## Projection and residuals

`scripts/shinsekai-camera.cjs` uses X east, Y north, Z up; angles are radians, heading zero faces north and positive pitch looks up. Its orthonormal right/up/forward basis includes roll. Known world points must lie in front of the camera plane. Cropping and isotropic resizing transform the principal point, focal length, observed pixels and tracing tolerance together.

| Observation | Prediction / residual | Excluded shortcut |
| --- | --- | --- |
| Point | Signed x/y reprojection error | Assuming a pixel is a metric control just because it was used in an earlier fit |
| Line | Signed perpendicular distances of both observed endpoints to a projected infinite 3D line | Assigning endpoint rows to roof-height Z values |
| Edge sample | Predicted x where a projected 3D line intersects the observed y | Counting the sampled y as an extra known-height constraint |
| Row | One predicted-y error, with an explicit scenario binding | Converting a missing x to zero or treating a far-width note as a measured width |

Infinite vertical lines use a world origin and direction, so their projected identity does not depend on an arbitrary anchor height. The anchor must be visible; a line projecting to a point or having no unique x at the requested row is rejected. Line endpoint residuals are not claimed statistically independent. Huber loss is available for working weighted residuals; a historical noise distribution is not assumed.

Eleven tests cover opposite-sector handedness, camera axes, invalid depth, crop invariance, line/edge semantics, explicit rows, robust loss, real snapshot integrity and malformed CSV/numeric/side inputs. The scale-ambiguity example gives identical pixels after uniformly scaling cameras and all geometry, demonstrating why an external scale scenario is necessary. These are mathematical/input checks, not a historical fit or GPU test.

## Next executable step

Build an explicit scenario mapping physical features to variable shared geometry; include roof scale, crown/gallery alternatives, era/face continuity and shaft setback. Then implement deterministic bounded nuisance optimisation and height profiles with scaled-Jacobian rank diagnostics. Never use the old plate-derived dimensions as independent view-A measurements.

Reserve the south image's shared geometry for prediction. Its unknown camera needs an explicitly declared calibration subset; keep other features withheld. Optimising all south landmarks and calling the resulting training residual a prediction would not satisfy this gate. Neither the independent south prediction gate nor height adoption is complete.
