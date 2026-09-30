# Tower cinema wings, 1912: exterior module (Claude, branch `claude/tower-base-upgrade`)

The two wings that stretch from the tower base to the east and the west and hold the five cinemas
(T: PID 946141 fr.267 「脚側左右に翼を張ること各四十有餘間、右にありては二棟左にありては三棟の大活動寫眞館」;
fr.270 the cinemas open their fronts on the Luna Park-mae street). The module attaches to the base without editing it:
`../exterior/` and `../interior/` are untouched. The contract is `../INTERFACE.md` v1.2 (envelopes, clear boxes,
`door_wing_W/E`); a clarification line was appended to its change log (no datum changed).

## Build

```
blender -b -P assets-src/shinsekai/tower-base-upgrade/wings/build-tower-wings.py -- [--renders all|cinema-street-west,...] [--samples 128] [--no-export] [--regen-atlas]
blender -b -P assets-src/shinsekai/tower-base-upgrade/wings/verify/verify-wings.py
```

- **`build-tower-wings.py`**: parametric generator (mesh data only, no booleans or modifiers). It reuses the base kit by
  executing `../exterior/build-tower-base-exterior.py` without its final `main()` (walls with openings, reveals, surrounds,
  sills, detail-spec §1 windows and doors, bevelled boxes, sweeps, lathes, bulb rows, lamp and insulator brackets, the
  material table and the UV conventions). Nothing of the base is written. The only overrides: `part()` splits the
  placeholders per hall and keeps bucket keys at the real LOD; `get_mat()` gives the signs material its atlas.
- **`make-sign-atlas.py`**: renders `tex/tw-signs.png` (4096², fictional lettering and pictures, Yu Mincho / Yu Gothic
  from Windows used only to rasterise) and `tex/tw-signs.json` (slot table used for the UVs). Run automatically when the
  PNG is missing or with `--regen-atlas`.
- **`render_wings.py`**: review renders only (Cycles, OptiX, OIDN, AgX). It builds the base LOD0 in memory, imports the
  v4 lattice and adds render-only context (ground, a rutted street strip, shop rows across the street and beyond the
  wing ends, distant masses). Look-dev reuses `../exterior/render_setup.py` (CC0 sets by path, world-position weathering)
  and adds shaders for the wing materials. None of the context is exported.
- **`verify/verify-wings.py`** → `verify/tower-wings-verify.json` (see Verification).

Outputs:
- **`tower-wings.glb`**: `TW_LOD0|1|2` roots (switch distances 0 / 25 / 80 m in extras), one child per material part
  `TW_LOD<n>_<part>`; `TW_COLLISION` with 32 `COL_wing_*` meshes (extras `collision: true`); `TW_INTERFACE` with 13
  `IF_wing_*` empties (opening centre at sill height, local +Y out of the wall, extras `{width, sill, head, kind, hall, door}`).
  UV0 = metres (world-planar, sweeps as path × profile length) except `TW_LOD*_signs`, whose UV0 is atlas space; UV1 =
  Smart-UV lightmap unwrap (bulbs UV0 only). The atlas is embedded as JPEG (q 88); every other texture is the CC0 set by
  path in `parts.json` → materials.
- **Placeholders to hide when a hall's interior cell loads:** `TW_LOD*_<hall>_backing`, `_backing_dark`, `_curtain`
  (hall = W1 for `cell_cinema`). `TW_LOD*_<hall>F_*` are the rooms behind the front-block windows (office / benshi room
  over the porch, outside every clear box): keep them until the front blocks get interiors. `TW_LOD*_W1_endwall` /
  `E1_endwall` are the hall-side faces of the wing wall at x ±14.95 (cell x = 0, "the exterior's" per ../interior/README):
  keep them.
- **`tower-wings.parts.json`**: datums, fronts, triangles per LOD and per part, materials (linear colour, roughness,
  metallic, CC0 path, tile), the per-element source notes, window list, collision / interface names and the instancing
  lists (bulbs, lanterns, nobori, poster frames, kerbs, footway slabs).
- Renders (1280×720, 128 spp, dusk = sun 3.5° in the WNW like the base): `cinema-street-west.png`,
  `cinema-street-east.png` (1.5 m eye on the street, along the fronts), `kiosk-closeup.png` (0.7 m from the W1 grille),
  `facade-closeup.png` (3 m, W1 porch), `whole-base-with-wings.png` (1.7 m eye, 66 m out on the axis), `night-cinemas.png`
  (bulbs, lanterns, lit posters and boards), `lod.png` (orthographic south elevation of the west wing, LOD0 / LOD1 / LOD2
  from the top).

## Layout (INTERFACE v1.2 datums; A: where marked)

| item | value | source |
|---|---|---|
| Wings | W: x -87.2..-14.5, E: 14.5..87.2, y -9.0..9.0, eaves 9.5 | INTERFACE (T: 40 ken; depth, eaves A:) |
| Halls | W2 -87.2..-51.025, W1 -51.025..-14.5, E1 14.5..39.075, E2 39.075..63.325, E3 63.325..87.2 (cross walls split on their centre lines) | INTERFACE clear boxes; "right = west" A: (INTERFACE) |
| Fronts | on the south face y = -9.0; one front block per hall, projecting 1.2 m (A:) | T: fr.270; face A: (INTERFACE) |
| Footway | granite slabs, top 0.15 = every floor and porch (no step at any street door), kerb at y -12.45..-12.75, open stone gutter beyond | A: (1912 streets unpaved, S:158514) |
| W1 street door | x -29.45, 1.2 × 0.15..2.65 = the interior's own south exit door (cell x 14.5); the W1 front is centred on it | ../interior build script (door_x 14.5, 1.2 × 2.5), verified below |
| Wing zone at the base | x ±(14.50..14.95): reveal of door_wing_W/E (2.4 × 0.15..3.40), threshold at 0.15 with a riser to the base stone (0.03), hall-side face | INTERFACE, ../interior (cell hole 2.4 × 3.25 cell) |
| Roofs | one barrel per hall (二棟 / 三棟 = separate buildings), crown 12.1, fire-wall parapets between halls, arched gable parapets at the free ends, lead flashing on the base walls (top 12.3 < L3 sills 12.6) | S:157674, T: fr.267; A: rise, crown |

## The five fronts (no two alike)

| hall | front | colours | porch / door | canopy | kiosk | sources |
|---|---|---|---|---|---|---|
| W1 光雲館 | arched parapet (R 4.6 m, crown 14.6) with a 15-ray fan in ochre / cream and a gilt half-disc, archivolt band, springer piers with ball finials, keystone | cream-ochre render, cream trim | round arch 3.0 m; the interior's exit door (leaves stay with `cell_cinema`), exit plate | iron and glass on tie rods and scroll brackets, gilt band, bulb row, 6 paper lanterns | pyramid roof, green | S:158045 inset (arched parapet with a ray pattern, banners, lanterns); A: proportions. The rays are deliberately not a flag motif |
| W2 千鳥館 | stepped gable (3 steps + segmental cap), spike and ball finials, green medallion roundel, flag pole with a plain pennant | rose render, white trim | segmental arch 2.8 m, double glazed doors | timber-bracketed sheet awning (庇) with rafters and battens | bell roof, cream | A: (variation); S:158225 parapet fronts |
| E1 銀波館 | twin pylons with panels and gilt ball finials, segmental pediment, bulb festoon | sage render, white trim | square-headed 3.2 m, doors (one leaf ajar) | bullnose sheet verandah on two cast-iron columns at the kerb, 5 lanterns | flat roof with iron cresting, red | A: (variation); S:158225 |
| E2 鶴鳴座 | 唐破風-type cusped gable: timber barge boards, gegyo, gilt studs, small hoods at the feet | buff render, cream trim | round arch 3.0 m, doors | timber beam with 8 large paper lanterns and a small sheet hood | Japanese hip roof, natural timber | S:157871 (lantern rows); A: form |
| E3 月華館 | twin domed turrets (square-to-round lathe domes, louvred drums, spike finials), semicircular crest with a medallion | salmon render, white trim | round arch 3.2 m, doors | glazed canopy with a scalloped sheet valance | dome roof, navy | S:158225 / S:158514 (domed corner buildings); A: form |

Every front also has: plinth, V-jointed rustication or banded upper storey (per front), string course, cornice with
modillions, a name board (fictional names from the atlas), a coping swept along the parapet outline with a bulb row,
iron raking stays behind the parapet, upper-storey windows (§1), a painted board (絵看板) with reflector lamps on W1 / E1 /
E2, posters in glazed frames on the front and in the porch sides, a programme strip, lamps (base-style bracket lamps on
W1 / E3, goosenecks on W2 / E1), a tiled porch floor and a porch pendant, and 4–6 nobori at the kerb.

## What is modelled, with sources

Tags: S: OML CC0 photo, T: 1912 text (PID 946141), A: assumption with the reason. Colours are estimates (v3 rule).

| element | detail | source |
|---|---|---|
| Long walls | per-hall render tint, plinth, string course, eaves cornice, pilasters on the interior's rib lines (W1: int(35.85/3) = 11 bays), painted boards and poster pairs; W1 has **no windows** (its house is dark and the cell has none) | T: fr.267; ../interior; A: bays |
| Windows (50) | clerestory windows with segmental heads on W2 / E1-E3 (1.1 × 6.30..7.95), front-block windows, end-wall windows; louvred shutters (open / half / closed per window) on the street side | detail-spec §1; A: positions |
| Doors (11 + 2 wing zones) | street doors, side exits (W2, E2), rear doors (W2, E1-E3) with stone steps to the yard | A: positions (INTERFACE appended) |
| Roofs | segmental barrel of galvanised sheet on roll battens (1.8 m), fascia, curved boarded soffit, half-round gutters (inside and outside surfaces) on brackets every 2 m, 12 louvred ridge ventilators with curved caps, W1 booth vent pipe with guy stays (over the interior's projection booth) | S:157674; A: sheet, ventilators |
| Fire walls | cross walls 0.55 m proud of both roofs, coping, bulb row, flush end piers with caps and finials on both faces | T: 二棟 / 三棟; A: |
| Services | 20 cast-iron downpipes (swan neck, hopper, holderbats, shoe), 8 wooden street poles with two crossarms, 64 porcelain pin insulators, catenary wires pole to pole, service drops to 5 wall brackets, pole reflector lamps | S:157101 S:157103 S:157218; A: positions |
| Night | 746 bulbs on rails: parapet outlines, eaves of every street wall, fire-wall copings, canopies, kiosks; 19 paper lanterns; bracket, gooseneck and porch lamps | S:157871; T: fr.274 五萬燈 |
| Street edge | footway slabs (1.8 m, 6 mm bevel, 6 mm joints over a mortar bed), kerb stones, open gutter channel bridged by slabs at the porches | A: |
| Implied events (§7.5) | W1: the sign painter's ladder against a board, a paint pot and brush, a drop sheet; E1: a handcart resting on its shafts, crates of film cans half unloaded; kiosk: back door ajar, a coin in the tray, a punched ticket on the counter; E1: one nobori leaning; E1: a door leaf ajar | A: (no figures) |
| Queue furniture | two benches (縁台), two A-frame programme boards | A: |

### detail-spec §1: windows

| | LOD0 | LOD1 | LOD2 |
|---|---|---|---|
| Reveal | 0.45 m modelled | modelled | modelled (depth never drops) |
| Frame, sash | base kit: swept frame with a 7 mm arris, double-hung sashes 3 × 2 lights, 20 mm muntins, 4 mm bevels, fanlight bars | frame + meeting rail | frame |
| Glass | separate plane 35–45 mm behind the sash face | same | dark value quad |
| Sill / surround | stone sill with a drip groove; moulded architrave with keystone | plain sill | plain |
| Behind | a shallow room box + curtain (placeholder, per hall) | same | lit / dark |
| Shutters | louvred, per-window state (street side) | flat panel | none |

**Exception (A:):** the yard-side (north) windows and rear doors use the LOD1 kit also in LOD0 (reveal depth, frame,
meeting rail, glass and backing kept). The yard is not public and is seen only from ≥ 20 m (the roof garden); this pays
for the kiosks and props within 150k.

### detail-spec §6: micro-realism

- **Kiosks (5, from parts):** stone plinth, panelled body with fielded panels and rails, chamfered corner posts, a
  counter on brackets with a raised brass money tray (a coin in it) and a ticket on it, a brass grille (15 bars, a speaking
  oval, a money arch, a transom bar) in front of glass, a porcelain bell push with a 2.5 mm raised brass push in a ring
  groove and two slotted screws, glazed sides with muntins, a sign frieze (atlas), a cornice with bulbs, an inner shelf,
  a ticket roll on a spindle, a cash box, a lamp, a panelled back door (ajar) with butt hinges and a knob, one of five
  roofs with finials or cresting.
- **Doors:** base kit leaves (raised chamfered panels, 3 mm arrises, hinge knuckles, kick plates, knobs with roses and
  escutcheons), stone thresholds, exit plates on iron frames.
- **Hardware:** poster frames with glass and brass screw heads (front and porch frames), gooseneck lamps with wall
  plates, enamel shades and bulbs, canopy tie rods with eye plates, scroll brackets, nobori loops, iron guttering.
- **Edges:** bevels on masonry boxes, pilasters, sills, kerbs, slabs, joinery, kiosk parts and props (lower-detail
  plain boxes only on distant hall-wall poster frames and shutters, as listed in the code).
- **Gloss (render shaders):** brass with tarnish in crevices (AO) and a wear roughness field; lacquered kiosk paint 0.32;
  glass 0.03 with waviness and dust; paper and cloth 0.85–0.9; encaustic tile 0.3.
- **Weathering** (world-position functions from `../exterior/render_setup.py`, stronger on the wings): splash dirt and a
  damp line on the plinth, AO grime, rain streaks under every ledge, soot above ~10 m, mottling; the signs get grime and
  soot too. **Not baked into the GLB**, like the base.

## Numbers

Triangles (glTF triangles after export; bulbs, lanterns and nobori counted):

| LOD | triangles | meshes |
|---|---|---|
| LOD0 | **147,159** (budget 150,000 for both wings) | 72 |
| LOD1 | 69,971 | 72 |
| LOD2 | 22,247 | 53 |

Largest LOD0 parts: joinery 25.4k, iron 20.9k, brass 14.7k, trim 14.0k, timber 7.5k, roof sheet 6.7k, bulbs 6.3k, footway 4.8k, shutters (paint_green) 4.3k.

- Instancing (parts.json → `instancing`): 746 bulbs (8 tris), 19 lanterns, 25 nobori, 54 poster frames, 80 kerb stones and
  160 footway slabs with their placements, so the runtime can draw them as instances (the baked copies are counted above).
- GLB: 20.0 MB (3 LODs, uncompressed geometry, the 4k atlas embedded as JPEG). Run it through gltfpack / meshopt in the
  Codex pipeline.
- Timings (`date`, GTX 1660 SUPER): start 06:40:01; atlas 06:52 (41 s); first build 07:14; build + UV1 + export ≈ 15 s;
  a 1280×720 render ≈ 25 s at 24 spp and 73 s at 128 spp; final batch 07:50–08:00; verification 15 s.

## Verification (`verify/tower-wings-verify.json`, read from the exported GLBs)

Read back from the exported `tower-wings.glb`, `../exterior/tower-base-exterior.glb` and `../interior/tower-base-interiors.glb`
(`cell_cinema` placed by its rule), 15.7 s:

- **Entrances (11 doors, 3 lanes, a sample every 2 cm, downward rays).** Collision and visible surfaces support every sample
  from the kerb (y -12.3) through each porch or reveal: 0 missing samples and 0.000 m longest unsupported run on every street
  door and exit. Visible heights stay in 0.14–0.18 m (footway 0.15, porch tile 0.154, thresholds 0.18 in front of closed
  leaves); the largest step between neighbours is 0.016–0.02 m. **W1:** the line continues 1 m into `cell_cinema`: collision
  0.150 everywhere (714 samples), visible porch tile → wing threshold 0.150 → cell 0.151, no gap. Rear doors: the step and
  threshold are supported (visible 0 missing); collision there is the yard's, outside this module (54 missing by design).
- **door_wing_W / E:** from 1 m inside the cell across the 0.45 m wing zone onto the base threshold stone: visible surface
  continuous (0 missing), 0.15 → 0.03 at the drawn riser (step 0.12); the last 0.1 m on the base side has no collision (the
  hall floor collision belongs to `cell_hall`).
- **W1 street door vs the interior's opening (7,375 horizontal rays on a 2 cm grid):** 0 wing hits in the wall zone
  (y -9.00..-8.55). Edges measured on the outer face by bisection: wing jambs -30.0500 / -28.8500, head 2.6500; cell jambs
  -30.0497 / -28.8496, head 2.6495 → **differences 0.3 / 0.4 / 0.5 mm**.
- **Intrusion (exact triangle / box SAT test, boxes shrunk 1 mm):** **0** solid wing LOD0 triangles inside any of the 13
  clear boxes (five cinemas, both halls, the upper rooms, four stair shafts). The per-hall placeholders (`*_backing`,
  `*_backing_dark`, `*_curtain`) are listed separately in the JSON (inside W2 / E1-E3, and W1's dark card behind its door).
- **Party wall:** highest wing point within 1 m of the base E/W faces 12.30 (lead flashing), base L3 sills 12.60 → 0.30 m.
- **Footway:** 1,160 collision samples along both wings at y -10.9 and -12.1: 0 missing, 0 off level (0.150).
- **Found in the interior (reported below):** from the porch, horizontal rays through the W1 door stop at y -8.55 on
  `cinema__walls` for every height up to 1.45 m, i.e. the house's wainscot runs across the exit door (3,835 of the 7,375
  grid rays). The walking line meets its top (1.449 m) 3.76 m along the line.

## Iterations (renders read after each)

1. **07:16–07:18, first build and four shots at 16 spp.** LOD0 170k (over budget). The sun-ray parapet read as a flag
   motif; the far end of the street was void; the street was a flat plane; banners faced the wrong way on the east wing.
   Cuts: hero-only screws and bevels on poster frames, plain shutter frames, plain rear pilasters, lighter insulators
   (→ 152k).
2. **07:20–07:25.** Fan rays recoloured ochre / cream with a gilt disc; a render tint per long wall; LOD sheet rows moved
   apart (the upper row shadowed the lower); render-only shop rows across the street and beyond the ends; a rutted
   street; cameras aimed so the parapets are in frame; east nobori turned to face the approach.
3. **07:25–07:27, close-ups and night.** Porch arches 20 segments (were 8); raised money tray; brass tarnish shader;
   stronger weathering.
4. **07:31–07:34, export + verification.** Found and fixed: the wing-zone reveal at the base was built facing the wrong
   way (into the cell); the W1 door check first measured the cell's room-side casing (re-measured on the outer face);
   footway joints were holes (mortar bed added); the roof crown lowered 12.2 → 12.1 for more clearance under the base
   sills; LOD0 trimmed to 149k.
5. **07:35–07:39, full set at 24 spp.** Banner lettering read mirrored: at 2 mm the far face bled through in Cycles;
   faces now 8 mm apart with mirrored mappings so both sides read.
6. **07:45–07:47.** Props (benches, the handcart event), the LOD1 kit on the yard side (bucket-key bug found and fixed:
   the kit switch had created `TW_LOD1_*` meshes under the LOD0 root), night camera showing the lit arch and the tower.
7. **07:48–07:50.** Lattice shopfronts with lit interiors and noren across the street; the facade camera lowered to show
   the tiled porch floor, threshold and plinth; encaustic tile shader; kiosk tray and speaking oval smoother; a ticket on
   the counter.
8. **07:50–08:00, final export and renders at 128 spp.**

## Requests

**Base (`../exterior`, not edited):**
1. The two E/W downpipes at x ±14.6, y ±8.25 run from 14.3 m down to the ground inside the wing wall zone and through
   the wing roofs. Stop them on the wing roof (discharge onto the flashing / a spreader) at about z 12.
2. The base E/W walls below 9.5 m (plinth, rustication, string course) are now covered by the wings: they can be
   dropped from the base LOD0 (about 1.5k triangles) or kept as the party-wall face.
3. The base service brackets at x ±14.5, y ±10.2, z 13.8 send their wires 9 m out and end in mid-air over the wing
   roofs; retarget them to the wing street poles (x ±20.5, y -13.3, arms at 9.25 / 8.55) or shorten them.
4. `door_wing_W` leaves are closed in the base but stand open in the interior renders (`ref_doors`, 75°): open them in
   the base to match the cinema story, or say which one is canonical.
5. Threshold heights: base stone top 0.03, wing zone and cell floor 0.15. The wings draw the 0.12 m riser at x ±14.5;
   a sloped base threshold would remove the step.

**Interior (`../interior`):**
1. `cinema__shell` still carries walls in the wing wall zone (y ±8.55..9.00, x -50.80..-51.25) and a ceiling slab to
   z 9.3; their outer faces coincide with the wing walls (y = -9.00) and would z-fight when both load. Trim the cell
   shell to its inner faces now that the wings exist.
2. **`cinema__walls` (the wainscot, floor to 1.45 m) runs across the south exit door** at y -8.55 (world): the door is blocked
   below 1.45 m (verification). Cut the hole through the wainscot like the wall (cell x 13.9..15.1, z 0..2.5).
3. `cinema__seating` stands about 1 m inside that door (centre lane, 0.59 m): check the exit path.

## Assumptions (all A: unless tagged)

- "Right" = west (2 halls) and fronts on the south face (both from INTERFACE).
- Front blocks project 1.2 m; five invented front types, one per hall, to meet "no two alike"; hall names, film titles,
  slogans and pictures are fictional; no real studio, brand or trademark; no figures.
- W1's street door is the interior's exit door (the interior foyer is entered from the base ticket hall through
  `door_wing_W`), so the W1 porch serves it; the name "非常口" plate follows the interior's exit lamp.
- Footway at 0.15 = floor level; kerb, gutter channel and slab sizes; street poles and their positions.
- Roof sheet, crown 12.1, battens, ventilators; eaves cornice and gutters; downpipe positions.
- Kiosk type, grille, bell push († unverified for 1912 Osaka, like the base); lantern forms; nobori sizes.
- Yard-side openings (north) and the LOD1 kit there.

## Gaps and weakest points (honest)

1. **Evidence is thin for the fronts.** Only the 158045 inset (arched parapet with rays, banners, lanterns) and 157674
   (a curved ribbed roof and an arched gable beside the base) show the wings at all, both tiny. Four of the five fronts
   are invented types, the placement on the long south face is INTERFACE's assumption, and no 1912 view shows how the
   fronts sat on the wings. A larger print of 158045 or the NDL 1913 album would settle it.
2. **Repetition and cleanliness at street level.** Between the fronts the long walls repeat one bay (pilaster, poster
   pair, board or window) and the 20 posters / 6 boards come from one atlas, which shows in `lod.png`. The weathering is
   shader-only (not baked into the GLB), so the runtime look will be cleaner than the renders until it is ported to TSL
   or baked to UV1. The atlas is 4k JPEG: lettering is crisp at 1–3 m, soft in the 0.7 m kiosk shot.
3. **Budget pressure.** LOD0 sits just under 150k: bulbs, lanterns, nobori, poster frames, kerbs and slabs are still
   baked (instancing lists are provided), the yard side uses the LOD1 window kit, kiosk grille bars are 5-sided and
   distant poster frames and shutters are plain boxes. The render context (street, shop rows) is not a deliverable.

Further gaps: no interiors for W2 / E1-E3 (their openings are fixed in INTERFACE for later cells); the rear yard has no
ground or collision; no glTF-Validator run (nothing installed; the GLB re-imports cleanly into Blender 4.5 in the
verification with all LODs, 32 collision meshes and 13 empties).

## v1.1 (2026-10-01 08:05–08:55, Claude): seams with the base and the interior

The requests above were resolved in their owning modules (INTERFACE change log 1.3; receipt `../verify/seams-verify.json`):
base 1 (the downpipes discharge into the wing eaves gutters via a 45° offset), base 3 (the service drops end on the base-side
insulators of the end poles at x ±20.5, with tie wires and entrance tubes; the yard-side brackets are removed), base 4
(door_wing_E/W leaves are stated nodes, default closed, clips `door_wing_<E|W>_open` / `_close`), base 5 (finished threshold 0.15
+ 15 mm saddle: the 0.12 m riser this module draws at x ±14.50 is now buried under the base threshold, no step), interior 1–3
(single-owner shell, door casing and wainscot cut, cross aisle at the exit door). Base request 2 (drop the base E/W dressing under
the wings) is still open.
- Changed here: the W1 / E-front service drops started 10 mm above their wall insulators; they now start on the insulator apex
  (`street_poles`, 8.73 → 8.72). Rebuilt and re-exported; triangles unchanged (147,159 / 69,971 / 22,247).
- `render_wings.py`: six seam shots (`seam-*`, written to `../verify/seams-renders/`); the W1 door shots import `cell_cinema` from
  the interiors GLB and hide `TW_LOD0_W1_backing_dark`.
- `verify/verify-wings.py`: the cell's W1 door edges are measured on its hall face (the cell no longer draws the wall zone).
  Re-run: 0 cell hits in the W1 door's wall zone (v1.0: 3,835), edges 0.2 / 0.2 / 0.0 mm; door_wing_W / E visible step 0.12 → 0.0.
