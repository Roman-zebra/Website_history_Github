# Photo landmark table v1 (Claude, 2026-09-30 16:27) for Codex's joint camera fit

- Machine-readable table: `landmarks-v1.csv` (same folder).
- Coordinates are in the **original NDL IIIF full-resolution** pixels, with origin at top-left and y pointing down. Both scans are 4064×2880.
- Scans and overlays stay local (`refs-claude/ndl-public/`, `claude-out/qa/photomatch/`) and are never committed.

## Crop and scale transforms used in earlier work
| File | Transform to original |
|---|---|
| `refs-claude/ndl-public/p46_photo.jpg` (1391×1860) | IIIF region (560,440,1391,1860), scale 1: original = crop + (560,440) |
| `refs-claude/ndl-public/p46_full.jpg` (650×930) | Older reduced crop (§12 "×≈0.5, 1 px ≈ 2 original px"). The earlier half-scale readings are superseded by the full-resolution table |
| `refs-claude/ndl-public/A_full.jpg` (890×1650) | **IIIF region (2090,660,890,1650), scale 1** (verified by image matching, MSE 0.7): original = crop + (2090,660) |
| photomatch configs (`p46_*.json`, `A_*.json`) | Crop coordinates as above |

## Which 3D values come from plate 46 (not independent)
- Only the **roof-garden floor, 15.15 m (50 shaku), is sourced** (1912/1913 texts).
- From plate 46 at the roof scale (≈27.7 px/m):
  - facade outer width 28–29.6 m;
  - arch intrados crown ≈10.9 m;
  - arch span ≈20.1 m, feet ≈2.9 m;
  - turret dome crowns ≈22.1 m;
  - tower leg spread at the roof ≈11.4 m;
  - base depth 20.7–30.5 m, from the near/far arch ratio r, which assumes the far exit is a same-height crown.
- **Assumed:**
  - the arch outer moulding is 0.7 m above the intrados;
  - turret plan 4.4 m and centre offset 2.2 m from the face.
- **View A's camera fits (`towerfit-viewA.cjs`) used these plate-46-derived base points.** They are therefore **not an independent measurement** of those dimensions. View A only adds independent information on upper-tower proportions, conditional on the base.

## Alternatives to carry in the fit
- **Plate 46 roof floor:**
  - 1462 is the railing base / eave top.
  - 1394 is the railing top.
  - The 1921 sign band is inside the railing. The ratio floor→outer arch crown / facade width is 0.113 in plate 46 against 0.115 in view A, so it does not hide the floor.
- **Far exit crown:** 1661–1692.
- **Horizon:** ±12 px.
- **View A:**
  - roof floor 1605 against railing top 1567;
  - "box bottom" 955 might be the lower gallery rim.
- **Identity:** view A is 1914 and plate 46 is 1921. Upper-tower features may have changed; ropeway and flags are ignored.

## South-sector check (CC0)
- `c0234001` (OML, 347×534 px) gives **ratios only**, recorded in tower-study-review §15:
  - floor→arch intrados crown 0.145 W;
  - arch width 0.63 W;
  - floor→dome 0.255 W (W = outer turret width).
- At this resolution pixel landmarks are ±3–5 px, so it is useful only as a consistency check of base proportions, not for camera solving. No pixel table is provided for it in v1.
