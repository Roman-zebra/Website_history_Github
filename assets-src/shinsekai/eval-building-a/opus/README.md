# Building A — Opus build (model evaluation, blind)

A two-bay, two-storey shop-house on Ebisu-dōri in 1912, built to `claude-out/design/model-eval-plan.md`
(Task 1). One Blender script makes everything: `build-building-a.py`.

```
blender -b --python assets-src/shinsekai/eval-building-a/opus/build-building-a.py -- [--samples 160]
        [--renders street,window-closeup,interior-ground,interior-upper,cutaway,lod] [--no-render] [--no-export]
        [--materials <research-cache/materials-93>]
```
Full run (6 renders at 160 samples plus the GLB) takes about 6 min on the GTX 1660 SUPER (Cycles/OptiX).
`--no-render` makes only the GLB, in about 7 s.

## Files
| file | what |
|---|---|
| `build-building-a.py` | parametric build, render and export script (house style of `tower-study/build-tower.py`) |
| `building-a.glb` | LOD0/1/2 exterior, interior cell, lights, collision (5.6 MB, not compressed) |
| `building-a.stats.json` | triangle counts per part and LOD, written on every run |
| `street.png` `window-closeup.png` `interior-ground.png` `interior-upper.png` `cutaway.png` `lod.png` | 1280×720, Cycles, dusk (warm low sun and a cool sky), interiors lit by warm lamps |

## GLB structure (glTF 2.0, Y-up)
```
BuildingA                (extras: source, assumptions, frontage_m, depth_m)
├─ BldgA_LOD0            (extras lod=0, lod_range_m 0-25)  └─ BldgA_LOD0_Exterior
├─ BldgA_LOD1            (lod=1, 25-80 m)                 └─ BldgA_LOD1_Exterior
├─ BldgA_LOD2            (lod=2, >80 m)                   └─ BldgA_LOD2_Exterior
├─ BldgA_InteriorCell    (cell=interior, stream_radius_m=15)
│   ├─ BldgA_Interior_Structure   floors, stair, beams, joists, partitions, ceilings, roof framing
│   ├─ BldgA_Interior_Props       shop and room props
│   └─ BldgA_Light_* ×7           KHR_lights_punctual (5 interior lamps, andon, street lantern)
└─ BldgA_Collision       (collision=true, render=false)  └─ BldgA_Collision_Mesh (boxes + stair ramp)
```
- Every mesh has `TEXCOORD_0` (world-scaled 1 unit = 1 m box projection, for tiling CC0 sets; glass panes
  0..1 per pane), `TEXCOORD_1` (`UV2_Lightmap`, smart-projected, non-overlapping) and `COLOR_0` (baked wear).
- `COLOR_0` multiplies the base colour (as the glTF spec says). It holds splash dirt (0–0.75 m), a damp line,
  soot under the cornice, rain streaks under the sills, low-frequency mottling, and per-face variation
  for tatami, boards, stone and tiles.
- Materials: 45 named `M_*` materials with PBR factors. Glass uses `KHR_materials_transmission` + IOR.
  Shoji paper uses partial transmission. Bulbs use emissive strength. Each material carries
  `extras.cc0_texture_set` where a CC0 set should be bound in the engine.
- Embedded images are **our own generated textures only** (made with numpy in the script):
  `T_Glass_Wave_N` (cylinder-glass waviness normal, 256²), `T_Roof_Tile_N` and `T_Roof_Tile_C`
  (tile courses, 512²).
- Validation: `gltf-validator` is **not on PATH** (nothing was installed), so it was not run. A structural
  check with Node found glTF 2.0, 19 named nodes, no empty accessors, and extensions
  KHR_materials_transmission / emissive_strength / ior / lights_punctual.

## Triangle counts
| part | tris | budget |
|---|---|---|
| **LOD0 exterior** | **19,671** | ≤ 20,000 |
| of which: walls (fine grid for wear) 3,084 · roof 2,768 · signs (mesh letters) 2,721 · windows 2,360 · shopfront 2,344 · trim 1,850 · rear 1,588 · awning 1,206 · services 834 · side walls 916 | | |
| LOD1 exterior | 1,142 | |
| LOD2 exterior | 112 | |
| **Interior cell** (structure 5,310 + props 23,161) | **28,471** | ≤ 150,000 |
| collision | 240 | |

LOD rules (detail-spec §1): LOD0 has modelled reveals, frames, sashes, muntins, per-pane glass, and shoji behind
the glass. LOD1 keeps real reveals and frames with a meeting rail and a cross muntin, one glass quad and a paper
plane behind. LOD2 is a massing box with inset window quads, a roof prism, the awning, fascia and disc.

## What comes from the photos, and what is assumed
Photos (all CC0, Osaka Municipal Library, `refs-claude/oml-cc0-streets`):
- **158514 (Ebisu-dōri, 1912)**: a two-storey row with a plastered upper storey; one sash window per bay; a
  small parapet over a cornice; a deep ground-floor awning; a long horizontal fascia board; a **hanging disc
  signboard** on an iron bracket; overhead wires; the young street pine propped with bamboo (render set).
- **157003**: wooden-framed windows set in plaster, dark timber ground-floor posts, a lamp on a bracket.
- **157013**: a glazed display window of small panes (4×3 plus transom) and a lantern on a bracket.
- **157016**: fascia lettering read right-to-left, noren at the entrance, lattice (used for the door transom).

**Assumptions (no scale in any photo; every number is ours):** frontage 6.0 m (two 3.0 m bays), depth 9.0 m;
front wall 25 cm, side walls 18 cm, rear wall 15 cm; ground-floor head beam 2.62–2.95 m; fascia 2.96–3.52 m;
upper floor 3.455 m; sash opening 1.0 × 1.45 m (sill 4.05 m), double-hung 6-over-6, frame set back 10 cm;
cornice 6.05–6.35 m; parapet top 7.0 m with a stepped central pediment; ridge parallel to the street at
8.10 m, 4.5-sun pitch (0.45), rear eave overhang 0.75 m; sanwa-type pan tiles at 0.28 m roll pitch; awning
projecting 1.05 m with a scalloped valance; disc sign 0.8 m in diameter; a raised tatami floor 0.455 m high
at the back of the shop; a box stair (hako-kaidan, 13 risers of 0.23 m, going 0.21 m) against the right wall;
tatami about 1.88 × 0.91 m in a staggered layout; upper room with exposed posts, nageshi band, board ceiling
with battens; roof framing as wagoya (tie beams, struts, purlins, 0.45 m rafters). All colours are
estimates (plaster warm cream, dark stained timber, black lacquer fascia with gilt letters, silver-grey tiles).

**Signs are fictional**: shop name 新榮堂, 「小間物化粧品」, disc 「榮」, house plate 「二丁目」, stand sign
「御化粧品」, noren ring-and-bar mark. No real brand, crest or trademark. No people.

## Interior contents (plan list and extras)
- Ground-floor shop: earth doma floor; **counter** (a wood display case with a glass top and front, goods on red
  felt, an abacus, an open ledger and a left-behind teacup); **wall shelves** (6 levels, seeded random goods:
  paper-wrapped boxes, bottles, cloth bolts and jars, with hanging price tags); a stepped display stand behind the
  shop window; a tall glass cabinet; a wall clock with a pendulum; **lamps** (3 enamel-shade pendants and a
  kerosene wall lamp); an umbrella stand with two wagasa, a broom, a bucket and a crate; a stepping stone with a
  pair of geta.
- **Raised tatami area**: a lacquered edge beam, a board strip, a chōba desk with a ledger, a lattice screen,
  a long brazier with a kettle, a cushion, a tansu.
- **Staircase**: a box stair with drawers and a cupboard, a stairwell with a railing upstairs.
- **Upper room**: tatami, **shoji** behind both sashes (one slid open), an **andon** (lit), a **low table**
  with a teapot, cups (one tipped) and a folded paper, cushions, a smoking box with a pipe, a tansu, a
  clothes stand with a coat, a hanging scroll (a generic ink landscape), fusuma (one slid open), an open lattice
  ranma, and a back room with bedding and boxes.
- Walkability: real floors at 0 / 0.455 / 3.455 m, an open door leaf (1.2 m clear), the stair, the
  stairwell, and an open fusuma. `BldgA_Collision` gives the walk surfaces, with the stair as a ramp.

## Texture provenance
- Renders only (referenced from `research-cache/materials-93`, **not copied, not embedded**):
  ambientCG Plaster007 and PaintedPlaster006 (CC0) for plaster; Poly Haven large_sandstone_blocks (CC0) for
  granite sills, plinths and slabs. Metal041B is listed in the material extras for iron but was not
  sampled in the renders. Wood, earth, canvas, tatami, paper, metal and glass dust are procedural nodes.
- GLB: only the three generated textures above.

## Renders and lighting
Cycles, OptiX, OIDN denoise, AgX Medium High Contrast, compositor fog glow. Nishita sky (cool fill) plus a
warm sun lamp about 6° high, raking along the street. A light volume haze in the street shot.
Render-only set (not exported): street plane with ruts and damp patches, granite apron slabs, a stone gutter with
cover boards, neighbours as linked duplicates of LOD0 (tint, width, height and awning varied, no signs, with a
warm lit backdrop each), an opposite row, poles with cross-arms and insulators and catenary wires, a service
drop to the building's insulators, a bench, fire buckets, barrels, a stand sign, potted pines, and the propped
young pine.

## Timing and iterations
- Wall clock (from `date`): start **2026-09-30 23:03:45**, end **2026-10-01 00:04:46** (committed right after).
- 6 render passes: 5 look iterations and 1 bug-fix pass. The fixes by pass:
  (1) exposure, sky and interior light levels, a blob-like crest replaced with a stepped pediment, aged copper,
  the tri budget;
  (2) street framing, lights moved out of the opaque bulbs, the cutaway occluder, Japanese framing (posts and
  nageshi) upstairs;
  (3) street ruts and puddles, per-face tatami and board variation, a scroll, the pine placement, the sun angle;
  (4) fuller pine tufts, a darker cushion, the scroll motif, a smoking box;
  (5) final quality at 160 samples;
  (6) fixed a dust-tint bug that coloured whole large faces tan (now a world-height mask).
- Line-level edits were made with the Edit tool and small sed/perl substitutions. No outside help.

## Known gaps
1. **The GLB carries no photo textures.** In the engine it shows flat PBR factors × vertex-colour wear until
   the CC0 sets named in the material extras are bound. The plaster and stone look in the renders comes from
   the CC0 images and procedural nodes that do not export. It has 45 materials (27 primitives in LOD0), so draw
   calls are high: a trim sheet/atlas pass is the next step.
2. **Neighbours are copies of the same facade** (only tint, width and height vary), so the street reads
   repetitive, and the far street plane with damp patches looks like water at the horizon in `lod.png` and
   `cutaway.png`. This is render set only, but it weakens the street shot.
3. **Props are low in detail** (box goods with no labels, a basic pine, a stair seen mostly from the side),
   and the enamel pendant shades blow out to bright ellipses. There is no kitchen or rear annex (assumed to be
   outside the plot). The interior is one merged props mesh (not per-prop instances). There is no
   interior-mapping shader for LOD1 windows (a paper plane stands in).
4. No gltf-validator run (not installed). The GLB is not Draco/meshopt compressed (5.6 MB).
   Vertex colours are float (COLOR_0 as float VEC4).
