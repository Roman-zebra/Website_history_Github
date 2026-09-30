# Tower base, 1912: detailed exterior module (Claude, branch `claude/tower-base-upgrade`)

This module replaces the coarse base blocks of the v4 tower study at runtime. Its scope is the castle-like base: the arch passage, four corner turrets, the roof garden and the services on the facades. **The tower lattice, the cinema wings and the interiors are out of scope.** The interior agent builds the interiors in `../interior/`. The contract between the two builds is `../INTERFACE.md`.

The v4 files (`../../tower-study/build-tower-v4.py` and its GLBs) are **not edited**. The generator parses v4 with `ast` and reuses its constants:
- `ROOF_GARDEN_Z` 15.15, `FACE_Y` 13.0, `FACADE_HALF_WIDTH` 14.5
- `ARCH_HALF_SPAN` 10.05, `ARCH_SPRING` 2.9, `ARCH_CROWN` 10.9
- `TURRET` 4.4, `TURRET_BODY_TOP` 19.6, `TURRET_DOME_TOP` 22.1, `TURRET_FINIAL_TOP` 22.9
- `SHAFT_BASE_HALF` 5.7, `LATTICE_BASE` 15.85, and the `LIFT` landing metadata

If v4 changes, a rebuild follows it.

## Build

```
blender -b -P assets-src/shinsekai/tower-base-upgrade/exterior/build-tower-base-exterior.py -- [--passage-depth 26] [--renders all|street-arch,...] [--samples 128] [--no-export] [--iron redbrown|grey]
```

- **`build-tower-base-exterior.py`** is the parametric generator. It builds geometry, UVs, LODs, collision, interface empties, GLB export and `tower-base-exterior.parts.json`. Everything is built procedurally as mesh data: no booleans, no modifiers.
- **`render_setup.py`** is render-only and imported by the generator when `--renders` is given. It holds the Cycles look-dev (CC0 textures by path, procedural weathering), the render context and the cameras. The context is the v4 lattice with its base parts stripped, placeholder cinema-wing masses, distant town masses and a ground plane. **None of the context is exported.**

Outputs:
- **`tower-base-exterior.glb`**:
  - `TB_EXT_LOD0`, `TB_EXT_LOD1` and `TB_EXT_LOD2` roots (switch distances 0 / 25 / 80 m in extras), with one child mesh per material, `TB_EXT_LOD<n>_<material>`.
  - `TB_EXT_COLLISION` with 24 `COL_*` meshes (no material, extras `collision: true`). v1.2: `COL_turret_head_floor_<t>` is L-shaped (the head landing, 2 boxes), `COL_stair_proxy_<t>` is a ramp through the nosings of all 74 steps of the interior stair (mirrored per turret), and `COL_stairhead_guard_<t>` is a 1.0 m guard along each opening.
  - `TB_EXT_LOD0|1_stairhead_<NE|NW|SE|SW>`: placeholder guard rail round each stairwell opening. Hide it for a turret whose stair cell is loaded (the cell carries the real balustrade).
  - `TB_EXT_INTERFACE` with 16 `IF_*` opening empties.
  - UV0 (`UVMap`) is in **metres**: a world-planar projection per face, and sweeps and lathes are unwrapped as path length × profile length. UV1 is a Smart-UV unique unwrap for lightmaps and AO. The bulbs have UV0 only.
- **`tower-base-exterior.parts.json`**: parameters, the v4 constants used, triangle counts per LOD and per part, material definitions (linear base colour, roughness, metallic, CC0 texture path, tile size in metres, source) and the per-element source list.
- Renders, all 1280×720, Cycles 128 spp with OIDN, AgX:
  - `street-arch.png`, `facade-closeup.png`, `turret-dome.png` and `roof-garden.png` are at dusk: sun 3.5° high in the WNW (aaa-look-study §1/2).
  - `night-outline.png` shows the bulb rails lit.
  - `prop-closeup.png` is a 0.7 m close-up.
  - `lod.png` is an orthographic north elevation with LOD0, LOD1 and LOD2 from left to right.
  - v1.2 review shots (placeholder room boxes hidden so the shell shows; the two interior views add one warm review fill light, not exported): `window-bevel.png` (SW turret L1 side window in the grazing dusk light: bevelled sashes, muntins, frame), `stairhead-open.png` (through the open NE stair-head door: landing, guard rail, opening), `turret-soffit.png` (NW head floor from the stair below: trimmer, header, slab edge). `roof-garden.png` was re-rendered with the v1.2 geometry.

**v1.2 fixes (2026-10-01, Claude Opus 5.5).** (1) Turret head floors with the stairwell opening and steel framing, placeholder rails and collision, see the Stair heads row and ../INTERFACE.md change log 1.2. (2) The lowest voussoirs of both arch rings reached |x| 11.07 and passed through the turret inner walls into all four stair shafts at z 2.9-4 m (hidden from outside behind the turret fronts, but inside the interior clear boxes); every ring point is now clamped at the shaft face |x| 10.50. ../verify finds no exterior LOD0 triangle inside the four stair shafts or the two halls except the head floors (and the NE stair-head leaves, which stand open onto their landing by design). (3) §6 bevels restored (budget 160k).

**Runtime replacement of v4** (listed in `parts.json` → `replacesInV4`):
- Hide `tower study - provisional pale masonry`, `tower study - dark unglazed opening` and `roof_garden_deck`.
- Clip `tower study - provisional trim` below z 16.6, and the turret crowns and domes (|x| or |y| > 8.5, z < 23.2).
- Clip the turret finials out of `tower study - provisional dark iron` (|x| > 8.5, z < 23.2).
- The v4 lattice legs land on this module's pedestals at (±5.7, ±5.7, 15.85).

## What is modelled, with sources

Tags: S: OML CC0 photo, T: 1912 text (PID 946141), P: plate 46 (1921; later period, used with care) or view A (1914), M: map, A: assumption (with reason).

| element | detail | source |
|---|---|---|
| Massing | 29 × 26 m base; elliptical arch 20.1 m wide, springing 2.9 m, crown 10.9 m; four 4.45 m turrets; roof garden at 15.15 m. The net deck (29 × 26 m minus four turrets) is 677 m² = **205 tsubo**, which agrees with the text's 200 tsubo | P: plate 46 / v4; T: fr.268 (50 shaku, 200 tsubo) |
| Arch screens | Recessed 0.25 m behind the turret fronts, so the turrets read as towers. Scored ashlar render in 0.6 m courses on one grid from the springing, with 14 mm V-joints | S: 157437 (lit turret returns); A: depth and courses |
| Ground storey | 0.6 m granite-look plinth with a weathered top, banded rustication 0.6–4.6 m (0.5 m courses, 30 mm V-joints), then a moulded string course at 4.6–4.9 m | A: ("stone-look plastered") |
| Arch ring | 33 voussoirs with chamfered faces and alternately longer extrados, a keystone projecting 0.25 m with a scroll console, and the soffit of the ring | S: 158510, S: 157431 (bold archivolt); A: voussoir articulation. **Flag:** 158510 reads as a plain moulded archivolt; the voussoirs are the brief's request |
| Vault | Coffered elliptical barrel: 13 × 9 coffers 0.16 m deep with stepped sides, transverse bands every 2.7 m, rosettes on the crown line, and four pendant globes | S: 158223 (dark ribbed vault, 1938 photo, ribs only); A: coffer layout |
| Frieze and cornice | Frieze (13.1–14.35 m) of 9 lesenes and 10 green roundels. Main cornice with bed mould, corona, cyma and 41 modillions. The turret band continues the corona round each turret | S: 157431 (row of green roundels above the arch), S: 157437 (vertical strips); A: profiles |
| Turrets | Scored ashlar with alternating long and short quoins on the two front corners, L1–L3 windows with segmental heads, T4 paired round-headed lights, the turret cornice with modillions, **segmental gables with an oculus on all four faces**, a **bell cap** (square at the eaves, round at the neck) with 4 corner ribs, 4 face ribs and standing seams, an 8-post lantern, a lantern cap and a finial at the v4 heights (22.1 / 22.9 m) | S: 157431, S: 157437, S: 158510 (paired upper lights, curved gables with oculi, dark caps with lanterns and spikes); A: window sizes and levels (fitted to the INTERFACE floors), gable rise, cap profile |
| Roof garden | Terracotta paver deck; a balustrade 1.16 m above the deck (plinth, turned balusters, moulded rail, piers every ~2.5 m with ball caps); four flower beds with stone kerbs, clipped edging and flower clumps; moulded masonry pedestals with steel shoe plates, gussets and anchor nuts for the four legs | T: fr.268 (flower beds 四時の花卉); S: 157431 (piers along the roof edge); A: balusters (an iron railing is equally possible), pavers, bed positions |
| Stair heads | The four turret heads are the stair exits (T: fr.268 「階段の昇降口自ら四隅の小塔を為す」). Each has a double door with a segmental head and a bracketed sheet-metal hood (a "roofed opening"). The NE leaves stand open. **v1.2:** inside each turret head a 0.30 m head floor (tile top at 15.15, plaster soffit) with the stairwell opening of the interior stair (SW x -14.05..-11.45, y -12.55..-10.00, mirrored in the other turrets), framed by a riveted-type steel trimmer I 250 x 125 bearing in pockets in both end walls and a header framing into it with angle cleats; a placeholder guard rail `stairhead_<turret>` round the opening | T: fr.268; A: door and hood form, steel framing (period-typical), landing layout from ../interior |
| Lift transfer door | SW turret head, facing the lift landing: glazed double door with a hood, an electric bell push (porcelain rose, 2.5 mm brass push with a ring groove, two slotted screws), a blank navy enamel plate (no text) and a cloth-covered bell wire | A: position (brief); detail-spec §6; bell push † unverified for 1912 Osaka |
| Doors | Ticket-hall doors (one ajar), the ticket window, the east-hall window, turret street doors and wing doors. Panelled glazed leaves with raised chamfered panels, butt hinges, kick plates, brass knobs with roses and escutcheons, stone thresholds | A: positions (INTERFACE) |
| Windows (58) | See the detail-spec §1 table below | detail-spec §1 |
| Services | 8 cast-iron downpipes (hopper heads, holderbats every 1.8 m, shoes); 4 wall lamp brackets (back plates, arms, struts, spiral scrolls, frosted globes); 4 service brackets with crossarms, 16 porcelain pin insulators and sagging line wires | S: 158510 (lamp by a turret), S: 157218 / S: 157103 (wires); A: forms and positions |
| Night outline | 918 bulbs on rails: arch extrados, main cornice, E/W cornices, turret front corners, turret cornices, gable copings, cap corner ribs and pier tops. Warm emission (2200 K look) | S: 157871 (arch, cornice and turret outlines at night); T: fr.274 (五萬燈) |
| Passage floor | Cambered macadam carriageway, 1.5 m granite kerb stones and 1.6 m raised footways at z 0.15 (= the hall floor level) | A: (1912 streets were unpaved per S: 158514; footways assumed) |
| Interior shell | Slabs at L1–L3 and the roof, hall/shaft cross walls with the internal doors, inner faces of every outer wall holed at each opening, shaft floors and ceilings | ../INTERFACE.md |

### detail-spec §1: windows

| | LOD0 | LOD1 | LOD2 |
|---|---|---|---|
| Reveal | 0.45 m modelled, frame at 0.28 m | modelled | modelled (the depth never drops) |
| Frame | swept frame with a 7 mm arris | swept | swept |
| Sash | double-hung: two sashes offset by 40 mm, 3 × 2 lights each, muntins 20 mm; transom and fanlight (radial bars in round heads) | meeting rail only | none |
| Glass | separate plane 35–45 mm behind the sash face | same | dark value quad |
| Sill | stone sill with a weathered top and a **drip groove** | plain sill | plain sill |
| Surround | 6-step architrave and a keystone | simpler | 3-step |
| Behind | a shallow room box (1.35 m) plus a folded curtain at a random draw. **These are placeholders**: `*_backing` and `*_curtain` are hidden when the interior cell loads. At night they are lit at random (70 % in the night render) | same | lit or dark per window |

### detail-spec §6: micro-realism

- **Edges:** chamfers on all masonry blocks, quoins (outer corner), voussoirs, sills, kerbs, pedestals, piers and panels; a 7 mm arris on window frames; 1.5 mm on the enamel plate; lathe profiles are bevelled.
  - The rustication and the ashlar are real V-grooves, which catch the dusk light in `facade-closeup.png`.
  - v1.2 (LOD0 budget raised to 160k by the Claude supervisor): the v1 plain boxes are bevelled now: sash stiles and rails 4 mm, muntins 3 mm, transoms 4 mm, circle-light bars 3 mm, door frames 5 mm, door stiles and rails 3 mm, hinge plates 1 mm, footway slabs 6 mm, inner-corner quoins 18 mm like the outer ones. `cbox` no longer emits the bevel strips and corners of a skipped (buried) face, which pays for most of it (joinery 17k -> 31k instead of 52k).
- **Seams and gaps:** 12 mm voussoir joints; 24 mm quoin joints; 4 mm kerb joints; 6 mm door meeting gap; standing seams on the caps; separate hinge knuckles, kick plates and escutcheons.
- **Raised control:** the bell push, with a porcelain rose, a raised brass push, a ring groove and slotted screws (`prop-closeup.png`).
- **Material roughness:** in `parts.json` and the render shaders.
  - plaster 0.82–0.9, stone 0.72–0.75
  - brass 0.24–0.26, porcelain 0.08, enamel 0.1–0.12
  - painted joinery 0.34, iron 0.45–0.55, glass 0.03 with waviness and dust
- **Weathering:** implemented as world-position shader functions in `render_setup.py:weather()`. **They are not baked into the GLB.**
  - splash dirt up to 0.7 m with a ragged edge, and a damp line
  - AO grime in crevices
  - rain streaks that start under every ledge height (cornices, string courses, sills) and fade over 1.6 m
  - soot above about 10 m
  - ±8 % mottling
  - scored-ashlar vertical joints from UV0 (u) and world z, on the same course grid as the geometry
  - All of these are simple enough to port to TSL, or to bake into UV1.
- **Glass:** thin-glass shading (Fresnel mix of glossy and transparent), a noise normal for cylinder-glass waviness, and a dust term.

## Numbers

**Triangles** (glTF triangles after export; the bulbs are counted):

| LOD | triangles | meshes | largest parts |
|---|---|---|---|
| LOD0 | **140,311** (budget 160,000 from v1.2; v1 118,905 / 120,000) | 31 | trim 43.8k, joinery 30.6k, iron 11.6k, bulbs 7.3k, wall 7.3k, brass 6.6k, roof sheet 5k, stair-head rails 4 x 0.6k |
| LOD1 | 64,827 | 29 | |
| LOD2 | 16,656 | 17 | |

- **Instancing (v1.2):** the 918 bulbs and 150 balusters are still baked into `TB_EXT_LOD0_bulb` / `_trim` and counted above. `parts.json` → `instancing` lists every bulb position and every baluster placement (x, y, base z, height) with its prototype, so Codex can draw them as instances (about 14.8k LOD0 triangles become 2 prototypes of 8 and 50).

- **Window LOD0:** about 300 triangles per window plus surround, sill and backing, well under the 800 limit.
- **GLB size:** 14.5 MB. It carries 3 LODs, is uncompressed and has no embedded textures. Run it through gltfpack or meshopt in the Codex pipeline. The textures are the CC0 sets in `research-cache/materials-93/` by path, tiled in metres per `parts.json`.
- **Timings** (from `date`, on the GTX 1660 SUPER):
  - The work started at 01:04:28.
  - INTERFACE.md was committed at 01:08 (`ed31aaa`).
  - Building and exporting the GLB takes about 15 s: geometry 7 s, UV1 2 s, export 1 s.
  - Each 1280×720 render takes about 1–1.5 min at 128 spp with OptiX.
  - The final render batch ran from 02:02:33 to 02:09:03.

### Iterations (renders read after each)

1. **01:34–01:41, first build and all shots at 24 spp.** The geometry was sound, but LOD0 had **290k** triangles. Problems found:
   - The turret caps were hidden behind gables that were too tall.
   - The turret-dome camera was blocked by a tower leg.
   - The plaster normal was blotchy and the colour pale.
   - The pedestals were blank.
   - The prop close-up showed only a knob.
2. **01:42–01:48, triangle budget and first fixes.**
   - Cuts brought LOD0 to 158k, then 134k, then 120k: bulbs, flowers, balusters, hidden frame faces, sash and muntin faces, modillions, quoin chamfers, seams and insulators.
   - The bell cap was made fuller and the gables lower. The pedestals got mouldings and shoe gussets.
   - The bell push and plate were added and the turret-dome camera was moved.
   - The render colour was changed to the postcard ochre, the plaster normal softened, and distant context added.
3. **01:49–01:53, turret faces scored on the same 0.6 m grid as the screens.**
   - A glowing placeholder behind the open stair-head door was replaced with a dark card.
   - A bright triangle inside the NE stair head was debugged: it is the sun patch through the opposite T4 window, which is correct.
4. **01:55–01:57, weathering and LOD sheet.**
   - Rain streaks now start under the ledges.
   - `lod.png` got neutral light and LOD0→2 ordered left to right.
   - LOD2 windows got a dark value quad, and the bell wire was rerouted.
5. **01:58–02:00, final polish.**
   - The facade close-up was reframed onto the turret front, lamp and passage.
   - The globe profile was smoothed and the back plate given a second layer.
   - The placeholder wings got glazed windows, and the axis through the arch was kept clear.
6. **02:05–02:09:03, final 1k-triangle trim and final renders at 128 spp.**

## Gaps and weakest points (honest)

1. **Much of the facade ornament is assumed.** The OML postcards are ~350 px wide, so the ornament is taken from them only as a type:
   - voussoirs versus the plain moulded archivolt that 158510 shows
   - the number of roundels, the modillion rhythm, the window heads
   - balusters versus an iron railing
   - turret window levels, the gable rise and the cap profile
   - Plate 46 (1921) was not used for details. Colours are estimates from hand-coloured postcards, as the v3 policy allows.
2. **The weathering and scored joints exist only in the render shaders.** The GLB has UV0 in metres and UV1, but no baked AO or dirt maps and no textures. Until Codex ports `weather()` to TSL or bakes to UV1, the runtime look will be cleaner than these renders.
3. **Budget (v1.2: LOD0 140,311 / 160k).** The §6 bevels are restored. The 918 bulbs are still 8-triangle bipyramids, which read only when emissive; their positions and the baluster placements are in `parts.json` → `instancing` for runtime instancing.

Further gaps:
- The E/W faces are dressed as if exposed, but in reality the cinema wings abut them below about 9.5 m. The wings are not built; the envelope is in INTERFACE.
- The "right = west" reading of the 2 / 3 cinemas is an assumption.
- The lift landing footprint on the deck is left empty for the interior agent, and the v4 elevator car was hidden in the renders.
- The sign band on the parapet (1921, plate 46) is deliberately **not** modelled, as a later period.
- There are no flags, pennant strings or wires in the sky zone. That belongs to the street pass.
- The collision stair proxies follow the interior stair plan (v1.2) as a ramp through the nosings; the interior cell's own collision has the same ramp.
- The GLB has not been run through glTF-Validator here (no validator is installed; install nothing). It re-imports cleanly into Blender 4.5 with both UV sets, all 74 LOD meshes, 20 collision meshes and 16 interface empties.

## v1.3 seams with the cinema wings (2026-10-01 08:05–08:55, Claude; INTERFACE change log 1.3)

Receipt: `../verify/seams-verify.json` (`../verify/seams-verify.py`, reads the exported GLBs). Renders: `../verify/seams-renders/`.
- **Downpipes** (own node `TB_EXT_LOD<n>_downpipe`, iron): the two E/W pipes beside the side-mass walls ran from their hoppers
  (y ±8.25, 14.3) straight to the ground through the wing roofs. They now take a 45° offset with two swan-neck bends along the
  wall face (x ±14.6, 50 mm off the render) to y ±9.55, the centre line of the wing eaves gutter, and end in a shoe 70 mm above
  its rim (discharge into the gutter, which drains to the wing's own pipes). Holderbats on each run, one strapped round the rake.
  The four full-height turret pipes (y ±12.65) stand clear of the wings and are unchanged. Wing datums are read, not drawn:
  `WING_ROOF` (roof curve, edge ±9.45, gutter ±9.55 / -0.12).
- **Service entry:** the four brackets sent their wires 9 m out into mid-air. The two street-side brackets (SW / SE turret outer
  faces, 13.8) now take a four-wire service drop from the wing end pole (x ±20.5, y -13.3: the insulators at 0.36 / 0.72 on the
  base side of both crossarms, `WING_POLE`). Plan order is kept so no span crosses another; sag 0.05 m + 1.5 % of the span; tie
  wires at both ends (at the pole following the wing insulator's 5 / 4-sided lathe, 0.5 mm clear); drip loops from each insulator
  into sloping porcelain entrance tubes 0.44–0.49 m under the bracket. The yard-side brackets (NW / NE) are removed: nothing feeds
  them (no poles on the yard side). Nodes `_service_iron`, `_service_porcelain`, `_service_wire`; every span in parts.json →
  `serviceDrops`.
- **door_wing_E/W:** finished threshold 0.15 (flush with the ticket hall, the wing zone and the cinema; the v1.2 stone at 0.03 left
  a 0.12 m step on each side and would have stopped the leaves) and a 15 mm oak saddle under the leaves; the frame starts at 0.15.
  The leaves are stated nodes: `door_fill(..., leaf_node=...)` builds them closed with 3 mm joints, `make_leaf_pivots()` puts each
  on an empty at its hinge knuckle axis (`TB_EXT_LOD<0|1>_door_wing_<E|W>_leaf<S|N>`, extras `defaultState` closed,
  `openAngleDeg`, `clips`) and writes the NLA tracks that the exporter turns into the glTF clips `door_wing_<E|W>_open` / `_close`
  (1.2 s, 30 fps, eased; 0 → ±90°, into the wing). `IF_door_wing_<E|W>` carries `state` = "closed" and `door` (leaves, clips,
  rule). LOD2 keeps a closed flat face. parts.json → `statedDoors`.
- Numbers: LOD0 **140,867** (v1.2 140,311: +556), LOD1 64,863 (+36), LOD2 16,676 (+20); 47 / 40 / 19 meshes. Build 9.7 s.
- Checks: 0 base triangles intersect any wing mesh (roofs, gutters, fascia, porcelain; v1.2: 208 with the roofs); every base wire
  end lies within 6.0 mm of a support (v1.2: 32 of 34 ends in mid-air); the leaves swept through the open clips touch nothing.
  Informational: 124 back-to-back contacts remain where wing members butt against the base wall (fascia and cornice end caps).
