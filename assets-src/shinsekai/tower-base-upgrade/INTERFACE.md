# Tower base upgrade: exterior / interior interface (v1.3, 2026-10-01 08:53 seams; v1.2 06:10, see the change log; v1.1 02:05, exterior agent; v1 01:10)

This file is the only contract between the exterior build (`exterior/`) and the interior build (`interior/`).
The exterior agent owns the shell: outer and passage walls with their openings, slabs, roof deck, turret heads, domes.
The interior agent owns everything inside the clear volumes below (finishes, stairs, counters, lift cage, props).
If you need a change, append a line under "Change requests" at the bottom; do not edit the tables in place.

## Frame and datums
- v4 coordinates (`tower-study/build-tower-v4.py`): metres, X east, Y north, Z up, origin = tower axis at street level.
- Street / passage paving top: **z = 0.00**. Interior ground floors: **z = 0.15** (one 150 mm step at every door; A: assumed).
- Roof garden deck top: **z = 15.15** (T: 1912 guide PID 946141 fr.268 「地上五十尺」).
- v4 constants reused: FACADE_HALF_WIDTH 14.5, PASSAGE_DEPTH 26 (facades at y = +/-13.0), ARCH_HALF_SPAN 10.05, ARCH_SPRING 2.9,
  ARCH_CROWN 10.9, TURRET 4.4 (built turret x-range +/-[10.05, 14.5] = flush with the passage wall, y-range +/-[8.6, 13.0]; centre x +/-12.275, y +/-10.8), TURRET_BODY_TOP 19.6, SHAFT_BASE_HALF 5.7.
- The arch screens (the facade between the turrets) stand 0.25 m behind the turret fronts: y = +/-12.75. Turret fronts: y = +/-13.0.
- Wall thickness: outer walls and passage walls **0.45 m** (rendered masonry, A:). All clear boxes below are **inside faces of the shell**.
  Walls are drawn by the exterior; the interior must not add geometry outside these boxes except door leaves/frames inside openings.
- Slabs 0.30 m thick; the value given as "floor" is the top of the slab, the ceiling is the next floor minus 0.30.

## Floor levels (side masses and turrets)
| level | floor z | ceiling z | clear height | notes |
|---|---|---|---|---|
| L0 ground | 0.15 | 4.60 | 4.45 | ticket hall, east hall, turret stair feet |
| L1 | 4.90 | 8.10 | 3.20 | upper rooms (no public access; seen through windows) |
| L2 | 8.40 | 11.50 | 3.10 | upper rooms |
| L3 | 11.80 | 14.80 | 3.00 | upper rooms |
| Roof | 15.15 | open sky | - | roof garden deck (exterior) |
| T4 turret head | 15.15 | 19.20 | 4.05 | stair heads = the four corner turrets above the roof (T: fr.268 「階段の昇降口自ら四隅の小塔を為す」) |
The passage between the side masses stays open (vault, exterior). The mass above the vault is solid (no rooms).

## Rooms: clear bounding boxes (x0..x1, y0..y1, z0..z1), metres
| id | owner of contents | x | y | z | source / notes |
|---|---|---|---|---|---|
| `ticket_hall` (west side mass, L0) | interior | -14.05..-10.50 | -8.60..8.60 | 0.15..4.60 | A: ticket hall under the arch (interior-directive §3); west side chosen so the SW stair and lift door line up (A:) |
| `east_hall` (east side mass, L0) | interior | 10.50..14.05 | -8.60..8.60 | 0.15..4.60 | A: foyer / exit hall, mirror of the ticket hall; use is open |
| `upper_rooms_W_L1..L3` | interior (may be interior-mapped) | -14.05..-10.50 | -8.60..8.60 | floor..ceiling of L1/L2/L3 | A: offices/stores; L3 has 3 windows on the outer E/W face; L1/L2 are windowless (vault on the passage side, wings outside) |
| `upper_rooms_E_L1..L3` | interior | 10.50..14.05 | -8.60..8.60 | same | A: |
| `stair_NW`, `stair_SW`, `stair_NE`, `stair_SE` (turret shafts) | interior builds the stairs | x: -14.05..-10.50 (W) / 10.50..14.05 (E) | y: 9.05..12.55 (N) / -12.55..-9.05 (S) | 0.15..19.20 | T: 「内側には各二個の階段ありて塔上に誘ふ」 = two stairs per side, one per turret. Clear plan 3.55 x 3.50 m. Suggested: dog-leg/newel stair, 0.95 m flights, 180 mm risers, 84 risers; the landing at each Ln floor is optional (turret windows sit at those levels). Stair must arrive at z 15.15 inside the turret head |
| `lift_landing_roof` | interior (cage, gate, landing enclosure, dial, bench) | -2.20..2.20 | -2.20..2.20 | 15.15..18.20 | T: fr.268 elevator from the roof garden; car/well from v4 LIFT (well half-size 0.742, car floor at 15.15). Exterior leaves this footprint empty (deck surface only) |
| `roof_garden` | exterior (deck, balustrade, paving, bed kerbs) | -14.50..14.50 minus turrets | -13.00..13.00 | 15.15..(open) | T: 200 tsubo: 29 x 26 m minus four 4.4 m turrets = 677 m2 = 205 tsubo, consistent |
| `roof_beds` (flower beds) | exterior draws kerbs 0.35 m high; interior/props agent may plant | four beds: x +/-[6.6, 9.4], y +/-[2.0, 7.5] | | 15.15..15.50 | T: 「四時の花卉を栽」; positions A: |

## Openings the interior must match (width x height, sill = bottom z; centre position)
| id | wall | centre (x, y) | width | sill z | head z | type |
|---|---|---|---|---|---|---|
| `door_ticket_hall_N` | passage wall x = -10.05 (wall -10.50..-10.05) | (-10.05, 4.60) | 1.80 | 0.00 | 2.60 | double door with a 150 mm step inside. Head kept below the vault springing (ARCH_SPRING 2.9): the passage wall is only 2.9 m tall before the vault soffit curves over |
| `door_ticket_hall_S` | passage wall x = -10.05 | (-10.05, -4.60) | 1.80 | 0.00 | 2.60 | same |
| `ticket_window` | passage wall x = -10.05 | (-10.05, 0.00) | 1.40 | 1.00 | 2.40 | counter window onto the passage; exterior has sill + frame, interior puts the brass grille and counter |
| `door_east_hall_N` / `_S` | passage wall x = +10.05 | (10.05, +/-4.60) | 1.80 | 0.00 | 2.60 | mirror (the east hall also has a window at y 0, same size as the ticket window) |
| `window_hall_W/E_L3` (x3 per side) | outer faces x = +/-14.5 | y = -5.0, 0.0, 5.0 | 1.00 | 12.60 | 14.10 (segmental head) | the only windows of the side-mass upper rooms (the vault covers the passage side; the wings cover the outer faces below ~10 m). L1/L2 upper rooms are windowless |
| turret windows | turret outer faces (N/S faces y = +/-13.0 and E/W faces x = +/-14.5), centred on the turret | per face | 1.00 (L1-L3) / 2 x 0.80 paired (T4) | L1 5.80, L2 9.30, L3 12.70, T4 16.10 | L1 7.60, L2 11.00, L3 14.40 (segmental heads), T4 18.40 (round heads) | S: 157431/157437 paired round-headed turret windows above the roof. Also: T4 pair on the turret inner face x = +/-10.05 above the deck (not SW, which has the lift door); one L0 window 0.90 wide, sill 1.50, head 3.30, on each turret E/W face; one oculus r 0.17 at z 19.93 in each gable (roof void) |
| `door_stair_NW/SW` (internal) | cross wall y = +/-[8.60, 9.05] (hall to turret) | (-12.275, +/-8.825) | 1.20 | 0.15 | 2.60 | exterior draws the 0.45 m cross wall (= turret inner wall) with this opening; the interior fits the door leaf |
| `door_stair_NE/SE` (internal) | cross wall y = +/-[8.60, 9.05] | (12.275, +/-8.825) | 1.20 | 0.15 | 2.60 | same |
| `door_turret_street_*` | turret outer faces y = +/-13.0 | (+/-12.275, +/-13.0) | 1.20 | 0.00 | 2.70 | A: direct stair exits to the street, one per turret (two steps up to 0.15 inside) |
| `door_wing_W` | west face x = -14.5 | (-14.50, 0.00) | 2.40 | 0.00 | 3.40 | into the west cinema wing (A: position) |
| `door_wing_E` | east face x = +14.5 | (14.50, 0.00) | 2.40 | 0.00 | 3.40 | into the east cinema wing |
| `door_stairhead_*` (4) | turret head inner face y = +/-8.6 | (+/-12.275, +/-8.60) | 1.40 | 15.15 | 17.65 | stair head onto the roof garden (roofed opening) |
| `door_lift_transfer_SW` | SW turret head, face x = -10.05 | (-10.05, -10.80) | 1.80 | 15.15 | 17.90 | A: lift transfer door; faces the lift landing across the deck |
| windows (all) | see exterior README | | 0.9-1.1 | per level +0.90 | | reveal 0.30, frame+sash+muntins, glass 40 mm behind the frame face; the interior may put curtains 0.10 m inside the glass plane |

## Cinema wings (T: fr.267 「脚側左右に翼を張ること各四十有餘間、右にありては二棟左にありては三棟の大活動寫眞館」; fr.270 fronts open on the Luna Park-mae street)
Only the envelope is fixed here; the exterior agent does NOT build the wings (a placeholder stub may appear in renders only).
| id | x | y | z | notes |
|---|---|---|---|---|
| `wing_W` envelope | -87.2..-14.5 | -9.0..9.0 | 0..9.5 eaves | 40 ken = 72.7 m (T:); depth 18 m and eaves A:. "Right" read as west (visitor approaching from the north, A:) -> 2 halls |
| `cinema_W1`, `cinema_W2` | W1 -50.8..-14.95, W2 -86.75..-51.25 | -8.55..8.55 | 0.15..9.0 | 36 m halls, fronts on the south face y = -9.0 (A:) |
| `wing_E` envelope | 14.5..87.2 | -9.0..9.0 | 0..9.5 | 3 halls |
| `cinema_E1..E3` | E1 14.95..38.85, E2 39.3..63.1, E3 63.55..86.75 | -8.55..8.55 | 0.15..9.0 | 24 m halls |
The base E/W faces are party walls up to z 9.5 (no windows below 10.0); `door_wing_W/E` link each hall to the first cinema.

## Node naming in the exterior GLB (for runtime replacement)
`TB_EXT_LOD0|LOD1|LOD2` roots; children `TB_EXT_LOD<n>_<part>`, one per material (wall, trim, reveal, vault, plinth, sill, kerb, paving, deck, roof_sheet, iron, wire, joinery, glass, brass, porcelain, enamel, bulb, lamp_glass, medallion, soil, foliage, flowers, inner, backing, backing_dark, curtain). **Placeholders to hide when an interior cell is loaded:** `*_backing`, `*_backing_dark`, `*_curtain` (a shallow room box + curtain behind every window, a dark card behind every door). `*_inner` is the plain inner face of the shell (slabs, cross walls, hall and shaft walls) that the interior may cover. Collision meshes `COL_*` (hidden, no material): `COL_passage_floor`, `COL_roof_deck`, `COL_steps_*`, `COL_turret_head_floor_*`, `COL_stair_proxy_*` (a ramp proxy per turret, replace when the interior stairs land). Empties under `TB_EXT_INTERFACE` (`IF_door_hall`, `IF_door_hall_2..4`, `IF_ticket_window`, `IF_door_turret_street_<NE|NW|SE|SW>`, `IF_door_stairhead_<..>`, `IF_door_lift_transfer_SW`, `IF_door_wing_<E|W>`) mark each opening centre at sill height; the empty's local +Y points out of the wall, +Z up. Extras carry {width, sill, head, kind}.

## Change log / change requests (append only)
- 02:05 exterior v1.1: passage-wall door heads 2.70 -> 2.60 (impost course 2.90-3.12 sits above); E/W L3 windows 12.70-14.40 -> 12.60-14.10 (main cornice starts at 14.35); turret shafts x 10.55 -> 10.50 so every wall is 0.45 m; turret centre 12.30 -> 12.275; lift door plane -10.10 -> -10.05; added the turret L0 side windows, inner-face T4 pairs and gable oculi. The exterior owns the leaves of the exterior doors (hall doors, turret street doors, stair heads, lift transfer, wing doors); the internal hall-to-shaft doors stay with the interior. Stair-head NE leaves stand open (implied event) and the north ticket-hall door is ajar (0.35 rad).
- 2026-10-01 06:10 v1.2 (Claude, repair after Codex review 109; both builds). **All datums above are unchanged** (floors, 15.15 head floor, every opening row). Changes:
  - Turret stairs: **75 risers of 200 mm** (supersedes the "suggested 84 x 180 mm" note in the rooms table). The last flight rises along the outer front wall and arrives on a **head landing at 15.15** = the L of the strip along the passage-side wall (SW world x -11.45..-10.50, y -12.55..-9.05) and the strip along the deck-side wall (x -14.05..-10.50, y -10.00..-9.05). Both `door_stairhead_SW` (y -8.60 face) and `door_lift_transfer_SW` (x -10.05 face) open onto that landing with the whole threshold supported (threshold stone 25 mm above the landing finish).
  - **Stairwell opening in the head floor**: SW world x -14.05..-11.45, y -12.55..-10.00 (stair cell x 0..2.60, y 0..2.55). The other three turrets are the mirror images of the SW cell: X = sx (14.05 - x), Y = sy (12.55 - y), Z = z + 0.15.
  - Exterior now draws the turret head floor (was collision only): 0.30 m slab (top 15.15, soffit 14.85) with the opening, a riveted steel trimmer I 250 x 125 along the opening edge parallel to the passage wall (bearing in pockets in both end walls) and a header along the edge parallel to the deck-side wall framing into it with angle cleats; bottom flanges at 14.60 world. The interior owns finishes, nosings, the fascia and the balustrade round the opening.
  - New exterior nodes: `TB_EXT_LOD0|1_stairhead_<NE|NW|SE|SW>` = placeholder guard rail round each opening (**hide it for a turret whose stair cell is loaded**, like `*_backing`). `COL_turret_head_floor_<t>` is now L-shaped (2 boxes), `COL_stair_proxy_<t>` is now a ramp through the nosings of all 74 steps (same plan as the interior cell), new `COL_stairhead_guard_<t>` (1.0 m guard along the opening).
  - Exterior fix: the springing voussoirs of both arch rings reached |x| 11.07 and passed through the turret inner walls into the four stair shafts (z 2.9..4); clamped at |x| 10.50 (no change seen from outside).
  - Exterior LOD0 budget 120k -> **160k** (Claude supervisor decision): bevels restored on sash stiles/rails, muntins, transoms, circle-light bars, door frames and leaves, hinge plates, footway slabs and inner-corner quoins. LOD0 = 140,311.
  - Interior lift: the single static `anim_car_gate` is replaced by two articulated gates (`anim_car_gate_*`, `anim_landing_gate_*` parts with pivots, rivet empties `*_<gate>_pin_b<band>_<i><c|t|b>`, glTF clips `car_gate_open`, `car_gate_close`, `landing_gate_open`, `landing_gate_close`, 1.5 s each).
  - Receipts: `verify/tower-base-verify.json` (headroom, landing, thresholds, gate kinematics), `interior/stair-plan.json` (step polygons, heights and walking samples).
- 2026-10-01 07:55 wings v1.0 (Claude, `wings/`, clarification only: **no datum or opening row above changed**; the base and interior files are not edited).
  - W1 street door = the cell's own south exit door: world x -29.45 (cell x 14.5), 1.20 wide, sill 0.15 (cell floor), head 2.65; the wing front and porch are centred on it and the interior keeps the leaves. The wing draws the casing, a 0.15 threshold and a hideable dark card `TW_LOD*_W1_backing_dark` behind it. Measured edges agree within 0.5 mm (`wings/verify/tower-wings-verify.json`).
  - The 0.45 m zone x ±(14.50..14.95) between the base party walls and the first halls is the wing's end wall: it carries the reveal of `door_wing_W/E` (2.40 × 0.15..3.40, the cell's hole), a threshold at 0.15 with a 0.12 riser down to the base stone (0.03) at x ±14.50, and the hall-side face at x ±14.95 (`TW_LOD*_W1_endwall` / `E1_endwall` = "the wall at cell x 0").
  - Openings fixed for future cells (sill 0.15 = floor, all rect): street doors 2.20 × 2.95 head at W2 x -69.00, E1 26.90, E2 51.20, E3 75.30 (y -9.00 face); side exits 1.20 × 2.65 head at W2 x -81.91, E2 58.00; rear doors 1.20 × 2.70 head on y +9.00 at W2 -65.77, E1 30.31, E2 54.60, E3 78.46; clerestory windows 1.10 wide, sill 6.30, segmental head 7.95 in the bays of W2 / E1-E3 (list with centres in `wings/tower-wings.parts.json` → windows). W1 has no windows (matches cell_cinema). `IF_wing_*` empties mark every door.
  - Fronts on the south face (y -9.00 per the table) project 1.20 m (to y -10.20) outside the envelope, with footway, kerb and gutter channel to y -13.41; roofs rise over the 9.5 eaves to a 12.10 crown (base L3 sills 12.60 keep 0.30 m over the lead flashings).
- 2026-10-01 08:53 v1.3 seams (Claude; base, interior and wings builds; receipt `verify/seams-verify.json` from `verify/seams-verify.py`). **No datum or opening row above changed.** Rules added:
  - **Single owner per surface.** The exterior modules own every face in the wall zones: outer faces, reveals through the full wall depth, thresholds and sills in the zone, parapets, roofs. An interior cell draws only inner finish faces lying ON its clear-box boundary planes and facing into the room, plus its dressing inside the box; no interior face may lie in a wall zone except door leaves hung in an opening. Faces that would lie on a boundary plane facing out of the room are culled by the interior build (`cull_boundary`, 1 mm). Where the exterior already draws the inner face (base `*_inner`; wings `TW_LOD*_W1_endwall` / `E1_endwall` at x ±14.95) the cell draws nothing on that plane. Check: coplanar overlapping faces (planes within 1 mm, overlap > 1 mm²) between `cell_cinema` and the wings / the base = **0 / 0** (v1.2: 233 same-facing + 113 back-to-back with the wings, 313 back-to-back with the base).
  - **W1 street door** (wings `IF_wing_W1_door_main`, world x -30.05..-28.85, 0.15..2.65): the wings own the reveal and the stone threshold in y -9.00..-8.55; `cell_cinema` owns, on the hall face (y -8.55), the opening in its wall face, a mitred teak architrave whose return face lines the opening edge (profile 0.15 wide, backband 0.10 proud), oak plinth blocks, a flush oak threshold plate (6 mm) and both leaves (hung on the hall-side edge of the reveal, opening into the house, 75° ajar). The wainscot and dado rail stop against the casing. Edges hall face vs street face: 0.17 / 0.18 / 0.05 mm.
  - **door_wing_E/W is a stated door.** Finished threshold 0.15 (masonry sill stays 0.00) with a 15 mm oak saddle under the leaves (the v1.2 base stone at 0.03 left a 0.12 m step on both sides and would have stopped the leaves). The leaves are nodes `TB_EXT_LOD<0|1>_door_wing_<E|W>_leaf<S|N>` (origin = hinge knuckle axis at world x ∓14.354, y ±1.117; children = the leaf meshes per material), rest pose **closed**, opening 90° into the wing, glTF clips `door_wing_<E|W>_open` / `_close` (1.2 s, eased); `IF_door_wing_<E|W>` extras `state` ("closed") and `door` (leaves, clips, rule). LOD2 keeps a closed flat face. The interior's render-only copies (`ref_doors`) use the same hinges and default closed (`--door-wing-w 90` = end pose of the open clip).
  - **Base services on the wings:** the E/W downpipes (hoppers y ±8.25, 14.3) take a 45° offset with two swan necks along the wall face to y ±9.55 and discharge through a shoe 70 mm above the rim of the wing eaves gutter (none passes through a wing roof); the street-side service brackets (x ±14.5, y -10.2, 13.8) are fed by a four-wire drop from the wing end pole (x ±20.5, y -13.3; the four insulators on the base side of both crossarms), with tie wires at both ends, drip loops and porcelain entrance tubes; the yard-side brackets are removed (no line reaches them). The base reads these wing datums (roof curve, gutter, pole, insulator shape) as constants `WING_ROOF` / `WING_POLE`; if the wings move them, the base must be rebuilt.
  - New base nodes: `TB_EXT_LOD<n>_downpipe`, `_service_iron`, `_service_porcelain`, `_service_wire` (material in the mesh as before; the "one node per material" rule now has these named exceptions plus the leaf nodes).
