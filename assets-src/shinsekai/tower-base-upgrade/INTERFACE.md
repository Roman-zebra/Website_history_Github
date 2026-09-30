# Tower base upgrade: exterior / interior interface (v1, 2026-10-01 01:10, exterior agent)

This file is the only contract between the exterior build (`exterior/`) and the interior build (`interior/`).
The exterior agent owns the shell: outer and passage walls with their openings, slabs, roof deck, turret heads, domes.
The interior agent owns everything inside the clear volumes below (finishes, stairs, counters, lift cage, props).
If you need a change, append a line under "Change requests" at the bottom; do not edit the tables in place.

## Frame and datums
- v4 coordinates (`tower-study/build-tower-v4.py`): metres, X east, Y north, Z up, origin = tower axis at street level.
- Street / passage paving top: **z = 0.00**. Interior ground floors: **z = 0.15** (one 150 mm step at every door; A: assumed).
- Roof garden deck top: **z = 15.15** (T: 1912 guide PID 946141 fr.268 「地上五十尺」).
- v4 constants reused: FACADE_HALF_WIDTH 14.5, PASSAGE_DEPTH 26 (facades at y = +/-13.0), ARCH_HALF_SPAN 10.05, ARCH_SPRING 2.9,
  ARCH_CROWN 10.9, TURRET 4.4 (turret x-range +/-[10.1, 14.5], y-range +/-[8.6, 13.0]), TURRET_BODY_TOP 19.6, SHAFT_BASE_HALF 5.7.
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
| `upper_rooms_W_L1..L3` | interior (may be interior-mapped) | -14.05..-10.50 | -8.60..8.60 | floor..ceiling of L1/L2/L3 | A: offices/stores; windows on the passage side only |
| `upper_rooms_E_L1..L3` | interior | 10.50..14.05 | -8.60..8.60 | same | A: |
| `stair_NW`, `stair_SW`, `stair_NE`, `stair_SE` (turret shafts) | interior builds the stairs | x: -14.05..-10.55 (W) / 10.55..14.05 (E) | y: 9.05..12.55 (N) / -12.55..-9.05 (S) | 0.15..19.20 | T: 「内側には各二個の階段ありて塔上に誘ふ」 = two stairs per side, one per turret. Clear plan 3.50 x 3.50 m. Suggested: dog-leg/newel stair, 0.95 m flights, 180 mm risers, 84 risers; the landing at each Ln floor is optional (turret windows sit at those levels). Stair must arrive at z 15.15 inside the turret head |
| `lift_landing_roof` | interior (cage, gate, landing enclosure, dial, bench) | -2.20..2.20 | -2.20..2.20 | 15.15..18.20 | T: fr.268 elevator from the roof garden; car/well from v4 LIFT (well half-size 0.742, car floor at 15.15). Exterior leaves this footprint empty (deck surface only) |
| `roof_garden` | exterior (deck, balustrade, paving, bed kerbs) | -14.50..14.50 minus turrets | -13.00..13.00 | 15.15..(open) | T: 200 tsubo: 29 x 26 m minus four 4.4 m turrets = 677 m2 = 205 tsubo, consistent |
| `roof_beds` (flower beds) | exterior draws kerbs 0.35 m high; interior/props agent may plant | four beds: x +/-[6.6, 9.4], y +/-[2.0, 7.5] | | 15.15..15.50 | T: 「四時の花卉を栽」; positions A: |

## Openings the interior must match (width x height, sill = bottom z; centre position)
| id | wall | centre (x, y) | width | sill z | head z | type |
|---|---|---|---|---|---|---|
| `door_ticket_hall_N` | passage wall x = -10.05 (wall -10.50..-10.05) | (-10.05, 4.60) | 1.80 | 0.00 | 2.70 | double door with a 150 mm step inside. Head kept below the vault springing (ARCH_SPRING 2.9): the passage wall is only 2.9 m tall before the vault soffit curves over |
| `door_ticket_hall_S` | passage wall x = -10.05 | (-10.05, -4.60) | 1.80 | 0.00 | 2.70 | same |
| `ticket_window` | passage wall x = -10.05 | (-10.05, 0.00) | 1.40 | 1.00 | 2.40 | counter window onto the passage; exterior has sill + frame, interior puts the brass grille and counter |
| `door_east_hall_N` / `_S` | passage wall x = +10.05 | (10.05, +/-4.60) | 1.80 | 0.00 | 2.70 | mirror |
| `window_hall_W/E_L3` (x3 per side) | outer faces x = +/-14.5 | y = -5.0, 0.0, 5.0 | 1.00 | 12.70 | 14.40 | the only windows of the side-mass upper rooms (the vault covers the passage side; the wings cover the outer faces below ~10 m). L1/L2 upper rooms are windowless |
| turret windows | turret outer faces (N/S faces y = +/-13.0 and E/W faces x = +/-14.5), centred on the turret | per face | 1.00 (L1-L3) / 2 x 0.80 paired (T4) | L1 5.80, L2 9.30, L3 12.70, T4 16.10 | L1 7.60, L2 11.00, L3 14.40, T4 18.40 (round heads) | S: 157431/157437 paired round-headed turret windows above the roof |
| `door_stair_NW/SW` (internal) | cross wall y = +/-[8.60, 9.05] (hall to turret) | (-12.30, +/-8.825) | 1.20 | 0.15 | 2.60 | exterior draws the 0.45 m cross wall (= turret inner wall) with this opening; the interior fits the door leaf |
| `door_stair_NE/SE` (internal) | cross wall y = +/-[8.60, 9.05] | (12.30, +/-8.825) | 1.20 | 0.15 | 2.60 | same |
| `door_turret_street_*` | turret outer faces y = +/-13.0 | (+/-12.30, +/-13.0) | 1.20 | 0.00 | 2.70 | A: direct stair exits to the street, one per turret (two steps up to 0.15 inside) |
| `door_wing_W` | west face x = -14.5 | (-14.50, 0.00) | 2.40 | 0.00 | 3.40 | into the west cinema wing (A: position) |
| `door_wing_E` | east face x = +14.5 | (14.50, 0.00) | 2.40 | 0.00 | 3.40 | into the east cinema wing |
| `door_stairhead_*` (4) | turret head inner face y = +/-8.6 | (+/-12.30, +/-8.60) | 1.40 | 15.15 | 17.65 | stair head onto the roof garden (roofed opening) |
| `door_lift_transfer_SW` | SW turret head, face x = -10.10 | (-10.10, -10.80) | 1.80 | 15.15 | 17.90 | A: lift transfer door; faces the lift landing across the deck |
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
`TB_EXT_LOD0|LOD1|LOD2` roots; children `TB_EXT_<part>` per material. Collision meshes `COL_*` (hidden, no material): `COL_passage_floor`, `COL_roof_deck`, `COL_steps_*`, `COL_turret_head_floor_*`, `COL_stair_proxy_*` (a ramp proxy per turret, replace when the interior stairs land). Empties `IF_door_*` mark every opening centre at sill height, +Y of the empty points outward.

## Change requests (append only)
- (none yet)
