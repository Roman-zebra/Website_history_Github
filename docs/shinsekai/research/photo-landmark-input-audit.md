# Joint camera landmark input audit (handoff 58)

Checked 2026-09-30. Immutable Claude inputs are `photo-landmarks-v1-claude.csv` and its accompanying Markdown note. They contain factual observations and assumptions, not scans. Protected NDL photos and overlays stay outside Git.

## Checks completed

- Both original IIIF images independently report **4064×2880** in official image metadata: [plate 46](https://dl.ndl.go.jp/api/iiif/962657/R0000048/info.json) and [view A](https://dl.ndl.go.jp/api/iiif/952032/R0000095/info.json).
- The supplied local `p46_photo.jpg` is 1391×1860 and `A_full.jpg` is 890×1650, matching the declared crop sizes. Their declared translations are (560,440) and (2090,660). Translation offsets are Claude's image-matching result; this check does not independently reproduce that matching.
- Local full-page previews `p962657_48.jpg` and `p952032_95.jpg` are only **1400×992**. Never treat their display pixels as original IIIF pixels.
- A CSV audit found **21 records, 25 coordinate pairs and two row-only constraints**. Coordinates are within the declared image bounds, tolerance values are positive, and each paired row has either one shared y or matching x/y cardinality. No empty x value is converted to zero.
- The handoff explicitly marks plate-derived metric dimensions. Those values remain dependent inputs in view A, rather than a second independent metric measurement.

## Clarifications needed before solving shared geometry

1. The plate-46 arch-feet record labels the pair **W/E**, while its note says **image-left = east** and the other paired records use E/W. Preserve the raw order and obtain explicit per-point side labels before assigning signed 3D X values.
2. Plate-46 turret outer edges are measured at **row 1365**, while its roof-floor row is **1462**. They cannot be treated as two known roof-height points merely because they help measure facade width. Use confirmed intersections with the roof line, or model them as edges/line constraints with unknown position along the vertical surface.
3. The two missing-x observations are a head-row horizon proxy and a far-exit width note. They are not ordinary 2D point correspondences. The head row depends on camera/head heights and terrain; the far width is approximately 320 px with occluded sides.
4. Roof-floor versus railing-top, far-crown versus bright-vault edge, and box-bottom versus gallery-rim alternatives must remain separate scenarios. The 1921 and 1914 landmarks also require an explicit continuity check.
5. The south-sector CC0 observation is ratio-only; no raw 2D landmarks or camera station are supplied. It can check base proportions but is not yet the independent south-view reprojection gate.

Next: a point table with explicit side/role labels, plus separate line/row/width constraints and crop metadata. Implement the shared projection and deterministic height-profile study after these mappings are explicit. Keep total height adjustable and do not turn working pixel tolerances into historical confidence intervals.
