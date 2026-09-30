# Feature continuity review (handoff 64)

Reviewed immediately on arrival, 2026-09-30. Inputs: `photo-continuity-claude.md` and `photo-landmarks-v3-claude.csv` (exact received SHA-256 `20cd7e21ff88d46172d7571139cd756eedc1a89d3f408a66b7f15164e3d74bdb`). Python's independent CSV reader verified **41 records / 16 fields**, with every v2 coordinate, observation type, tolerance and note unchanged; only version and two identity/scenario columns differ. The existing executable audit still consumes normalized **v2**. v3 annotations are additional source review, not automatic metric bindings or reclassified constraints.

## Direct image comparison

Codex inspected the local original-scale plate-46 crop (1391×1860), view-A crop (890×1650) and the CC0 south card (347×534). The 1914-published view has a clearly open ribbed crown above a relatively short box/gallery. The 1921-published plate has a low cap above a visibly different upper box. This supports **per-image upper-geometry alternatives** and rejects assuming the named crown records are homologous just because both say "top".

Claude states a rebuild occurred between 1914 and 1921. These publication years are not independently established photograph exposure dates; reproduction/retouching differences remain possible. **The precise alteration history/date and unchanged shaft-top hypothesis are not proven by this comparison.** Do not enter a dated rebuild into the historical timeline without corroboration.

| Observation | Treatment in the forthcoming fit |
| --- | --- |
| Plate 46 row 560 | Cap/rod-foot alternative, not the open crown apex seen in view A. Do not force it to share a crown height. |
| Plate 46 rod tip and box underside | Per-image upper geometry by default; sharing shaft-top height is an explicit alternative only. |
| View A box-base row 955 vs south row 105 | Medium-confidence proposed correspondence; south gallery-floor row 92 is an alternative. No surveyed equality. |
| South crown row 50 | Finial/rib-end reading; apex-ring alternative 53–55. Preserve both readings as scenarios. |
| Roof-floor centre in all three images | The line is visible but its centre is occluded; supplied x is inferred from symmetry. Do not count it as an independent observed point. Obtain measured line samples or explicitly evaluate a row at its declared reference x; never silently discard roll. |
| View A turret asymmetry / near-2° roll proposal | Free roll already exists in Codex's projection. Estimate it in the fit; tilted cameras, perspective and page curl are alternatives to structural asymmetry. The proposed angle is an initial scenario, not a fixed measurement. |

## Next step

Before metric binding, incorporate v3 identity/scenario annotations into a separately versioned model configuration. Reclassify/exclude inferred floor-centre x constraints and keep per-image upper forms explicit. Generic bounded optimisation and rank/profile diagnostics can proceed independently of additional source replies. Total model height stays adjustable; no south prediction or historical-height gate is satisfied yet.
