# MERGE.md — Building A upper room + dream layer add-on (handoff 108, Claude)

Add-on only. Nothing in `eval-building-a/hybrid/` was edited. Coordinates are the hybrid's Blender coordinates (X along the street 0..6, Y into the plot, Z up; upper floor Z 3.455, board ceiling 5.90). The add-on GLB is exported with the same glTF settings as `building-a.glb`, so the Blender Z-up to glTF Y-up conversion is identical: **no extra transform is needed**. The add-on root `UpperDream_Addon` has identity transform.

## 1. Files
- `upper-dream-addon.glb` — 37 named mesh nodes, 75,084 triangles, UV0 + UV1 (lightmap pack) on every mesh, `COLOR_0` (albedo tint for the shared neutral textures), 54 materials / 29 generated PNG images (about 5.3 MB of the 17.8 MB; KTX2/meshopt not applied). Materials are glTF PBR (Principled BSDF exported; clearcoat, sheen, specular, emissive_strength extensions; alpha BLEND only on decals/sudare/wire/glass).
- `build-upper-dream.py` — regenerates the GLB and the review renders (`blender -b -P build-upper-dream.py -- --export` ; `-- --render --variants base0,base,dream --views upper-axis,...`). The render path exec's the frozen `hybrid/build.py` up to its camera block (read only) and uses its cameras/lights/world.
- `make-compare.py` — builds `renders/compare-*.png`.

## 2. Node tree in the add-on GLB
```
UpperDream_Addon            (empty, parent it under Hybrid_InteriorCell, identity)
  UD_Base_Upper             28 nodes: the dressed upper room (always on)
  UD_Dream                   9 nodes: dream layer only (extras dreamLayer=true; each has extras dreamObject = bed|rabbit|balloon|phonograph|flowers)
  UD_Lights                  1 light UDLamp_lanterns (POINT, parented; optional)
```
Base nodes (all in `UD_Base_Upper`): UD_Ceiling_Skin, UD_Ceiling_Decals, UD_Pendant_Lamp (dagger), UD_DryingPole_Cloths, UD_LanternRow, UD_Tokonoma, UD_Chigaidana, UD_CoatRail_Haori, UD_WallClock, UD_WallCalendar, UD_FramedPrint, UD_NageshiHooks, UD_WestBay2_Signboard_Shelf, UD_Tansu_Futon, UD_Wall_Decals, UD_ShojiTear_Patch, UD_Sudare_Window2, UD_SunPool_Decals, UD_Zabuton_Set, UD_Zabuton_Set2, UD_Chabudai, UD_Ledgers_Inkstone, UD_ClothBolt_Spread, UD_Mending_Piece, UD_SewingBox_Mending, UD_TobaccoTray, UD_Hibachi_Kettle, UD_TeaTray.
Dream nodes: UD_Dream_HospitalBed (bed), UD_Dream_RabbitStatue (rabbit), UD_Dream_Balloon_Stair and UD_Dream_Balloon_UpperCeiling (balloon), UD_Dream_Phonograph (phonograph, dagger), UD_Dream_Flowers_Tokonoma / _Window / _ShopFloor / _ShopHanging (flowers).

## 3. Existing hybrid content to hide/replace (upper floor)
The add-on replaces Sonnet's upper dressing that collides with it. In `hybrid/build.py` the simplest route is to run this after `p=make()` for `kind=='upper'` (before `p.finish()`), exactly what `build-upper-dream.py::apply_hides` does to the built mesh `Hybrid_Sonnet_upper`:

Delete every face whose **all vertices** lie inside one of these boxes (tolerance 4 mm); 1,053 of 1,957 faces go:

| what | min (x,y,z) | max (x,y,z) |
|---|---|---|
| Sonnet chabudai + tea set | 2.45, 1.93, 3.49 | 3.55, 2.67, 4.02 |
| Sonnet zabuton a | 2.40, 1.05, 3.49 | 3.40, 1.95, 3.67 |
| Sonnet zabuton b | 3.60, 1.85, 3.49 | 4.60, 2.85, 3.67 |
| Sonnet zabuton c | 1.40, 1.95, 3.49 | 2.40, 2.85, 3.67 |
| Sonnet hibachi | 4.35, 2.85, 3.49 | 4.86, 3.36, 3.90 |
| Sonnet paper lantern (it poked through the ceiling board) | 2.78, 2.08, 5.50 | 3.22, 2.52, 6.06 |

Kept from the hybrid: tatami, shoji, fusuma, ranma partition, andon at (5.15, 1.15), kimono rack, futon stack, tansu and back-room goods, the Opus structure, the two inner-shoji windows and sashes.
Review-only objects of `hybrid/build.py` to drop (they were never in the GLB): `Dream floating sphere`, `Dream repeated flower pot`, `Dream original flower cluster`, and the coral material clones. The add-on GLB replaces them.

Lights (existing `HybridLamp_*` in the Hybrid_InteriorCell):
- `HybridLamp_upper_room` (POINT 55 W) move from (3.0, 2.4, 5.03) to **(3.0, 2.4, 5.50)** (inside the new opal pendant shade).
- `HybridLamp_andon` is at (1.0, 1.05, 3.90) in the hybrid, where no andon exists (Opus's own andon was not merged). Move it to **(5.15, 1.15, 3.95)** where Sonnet's andon geometry is.
- New optional light in the add-on: `UDLamp_lanterns` (POINT 10 W, (2.02, 2.5, 5.43), warm) for the lantern row.
- Sun: the sun pool decals assume the hybrid review sun (elevation 18 deg, azimuth 220 deg, travel direction (0.611, 0.729, -0.309)). If the runtime sun differs, regenerate with `hit()` in `sun_decals()` or drop `UD_SunPool_Decals` and let real shadows do it. The decals are alpha-blended emissive cards, 1.5 mm above the tatami; drop them once the runtime has lightmaps/probes.

## 4. Dream layer staging (one impossible object per review view, never two)
`UD_Dream` children carry `dreamObject`. Show all `flowers` nodes whenever dream is on (over-abundance is a separate category, not the impossible object). Show **one** of the others per view:

| review view | impossible object |
|---|---|
| ground-axis, ground-ceiling | red balloon: `UD_Dream_Balloon_Stair` (tethered to the stair foot at (5.10, 5.75, 0.66)). Hide `UD_Dream_Balloon_UpperCeiling` (it sits above the ground ceiling anyway) |
| ground-corner, ground-window, ground-street | white rabbit statue on the shop counter: `UD_Dream_RabbitStatue` at (2.05, 2.86, 0.845) |
| upper-axis, upper-window, upper-street | phonograph by window 1: `UD_Dream_Phonograph` at (2.56, 0.66) |
| upper-corner | Meiji iron hospital bed on the tatami: `UD_Dream_HospitalBed` at (2.35, 3.60) |
| upper-ceiling | red balloon: `UD_Dream_Balloon_UpperCeiling` (tethered to the lantern-row hook at (2.02, 4.62, 5.74)) |

In the game, pick the object by proximity/time, not by camera; at most one of {bed, rabbit, phonograph, balloon} active per view. Dagger swaps: phonograph variant = cylinder phonograph now (alt: hand-cranked music box or a hand bell), balloon = rubber toy balloon (alt: paper or silk balloon), pendant = electric (alt: hanging oil lamp, then hide UD_Pendant_Lamp's light coupling and move the hybrid lamp back to 5.03).

Dream grade (review proxy, compositor only, not in the GLB): coral midtones (R slope 1.0, G 0.80, B 0.80, power 1.0/1.06/1.08), saturation x0.92, blacks lifted 6 %, white rolled ~92 %, fog-glow bloom threshold 0.84 (vs 1.2 base = -30 %), 1.8 % luminance grain, exposure +0.38 vs +0.05. Numeric starting values are from dreamcore-study.md; the LUT/fog/grain itself stays Codex's grade.

## 5. Ceiling note
`UD_Ceiling_Skin` is a 2-triangle textured skin 1.2 mm below the hybrid's ceiling board (y 0.32..4.69, x 0.24..5.76). The hybrid battens stay as they are. `UD_Ceiling_Decals` are soot/stain cards 2 mm below it.

## 6. Checks
Validator (gltf-validator) not run here (not installed); the GLB was produced by Blender 4.5.10's exporter with the same flags as the hybrid, except `export_tangents=False` (the add-on uses the normal maps with Blender-generated bitangents in the runtime; set tangents on if the shader needs them). Triangle count 75,084 meets the 80k brief. Together with the hybrid interior (69,090 tris, minus the 1,053 hidden faces) the cell is about 142k tris: inside the 150k budget but tight, so instancing (zabuton, lanterns, chrysanthemum heads) and dream-node streaming are recommended.
