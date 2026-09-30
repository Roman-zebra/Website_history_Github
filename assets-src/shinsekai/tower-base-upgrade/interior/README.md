# Tower base interiors (1912): ticket hall, turret stair, lift landing + cage car, tower-wing cinema (+ dream variants)

Author: Claude Sonnet 5.5 (interior set-dressing). Built 2026-10-01 01:04 - 03:25 (`date`; about 2 h 20 min, 13 render passes, about 8 design iterations).

Files
- `build-tower-base-interiors.py`: one script, Blender 4.5. `blender -b -P build-tower-base-interiors.py -- --room all --variant both --render cams --export`. Flags: `--room hall|stair|lift|cinema`, `--variant base|dream`, `--cam <prefix>`, `--samples`, `--scale`, `--iter`, `--no-draco`, `--regen-tex`.
- `tower-base-interiors.glb`: Draco-compressed, 21 MB (`--no-draco` writes the plain 95 MB file; flat-shaded faces are not welded).
- `tex/`: generated textures (CC0 sandstone and steel are referenced from research-cache and embedded).
- `renders/`: 1280x720 JPEG, final pass iter 13, 64 spp, every camera plus dream variants. `renders/compare/*-compare.jpg`: render | matched dreamcore frame (00012, 00027, 00033, 00044).
- `prop-closeup.png` (three props) plus `prop-closeup-ticket-window.png`, `prop-closeup-lift-gate.png`, `prop-closeup-projector.png`.
- Materials are PBR (Principled, image texture x COLOR_0 tint). UV0 = metres / tile (box projection), UV1 = smart-project lightmap pack. Every cell has a collision mesh `*__col_floor` (extras `collision:1`).

## Coordinates and placement (INTERFACE.md v1.1 adopted; read at 01:28 and again after the 02:05 revision)
glb is Y-up. Every cell is a node `cell_<room>[_dream]`; cell coordinates below are Blender Z-up (glTF y = cell z, glTF z = -cell y). Dream cells are 60 m apart in Blender only; place each by its own rule.

| cell | clear box it fills | cell to v4 world |
|---|---|---|
| `cell_hall` | `ticket_hall` x -14.05..-10.50, y -8.60..8.60, z 0.15..4.60 (3.55 x 17.2 x 4.45) | world = cell + (-14.05, -8.60, +0.15) |
| `cell_stair` | `stair_SW` x -14.05..-10.50, y -12.55..-9.05, z 0.15..19.20 | world = cell + (-14.05, -12.55, +0.15) |
| `cell_lift` | `lift_landing_roof` x,y -2.2..2.2, z 15.15..18.20 (0.25 walls inside the 4.4 footprint) | world = cell + (-2.2, -2.2, +15.15) |
| `cell_cinema` | `cinema_W1` x -50.8..-14.95, y -8.55..8.55, z 0.15..9.0; entrance end = tower end | rotate 180 deg about z: X = -14.95 - x, Y = 8.55 - y, Z = z + 0.15 |

Rules followed
- No geometry outside the clear boxes except door and window frames inside openings. Shell walls and slabs of hall and stair are render-only (`ref_*` groups are not exported). The glb carries floor finishes (`shell_finish`, 3 mm above the slab top), ceiling skins and everything inside.
- Leaves of exterior doors (hall doors, turret street door, stair heads, lift transfer, wing door) are `ref_doors`, render-only, because the exterior owns them (the north hall door is ajar 0.35 rad in both). The hall-to-stair doors are interior and sit in `cell_hall`.
- Hide the exterior `*_backing`, `*_backing_dark`, `*_curtain` placeholders when a cell loads. `*_inner` faces can stay (nothing of ours coincides).
- Openings match the INTERFACE rows: door heads 2.60 world, ticket window 1.40 wide, sill 1.00, head 2.40, turret windows, L0 windows, stair-head 1.4 and lift-transfer 1.8 openings.
- Runtime nodes: `var_*` are unverified swappable variants. `anim_*` are moving parts with the pivot as node origin: `anim_clock_pendulum_w`, `anim_car_gate`, `anim_dial_needle`, `anim_shutter_p`, `anim_crank_p`, `anim_reel_upper_p`, `anim_reel_lower_p`. Lights (KHR point, sun, spot) and cameras `cam_<cell>_<name>` are included. Area lights cannot be exported, so sky, vestibule and screen fills are render-only.

## Interface requests (nothing in INTERFACE.md or exterior/ was edited)
1. The turret clear plan is 3.55 x 3.50 (v1.1). The stair is a 3.5 m square at x 0.05..3.55 (a 5 cm timber gap on the west wall). Please keep 3.55 x 3.50.
2. Both ground doors of the turret (hall door x 1.175..2.375 head 2.45, street door head 2.55) need 2.5 m clearance. The first flight climbs the east strip (14 risers) so nothing crosses them lower than 2.68 m. If the doors move, the stair needs a new layout.
3. The cinema walls and ceiling are in `cell_cinema` because the exterior does not build the wings. The wall at cell x 0 (tower party wall with door_wing_W) is the exterior's. The exit door (ajar, sun shaft) is on the south long wall; please confirm it.
4. Hall sun pools come through the north door from the passage. The vault must leave a low sun path, otherwise add a bounce light outside (the render assumes an open passage).

## Rooms: story line, parity notes, sources
Sources: S7 / crd 1000291784 (1913 album: roof garden 50 shaku, Siemens wire-mesh cage, stairs then lift); 1912 guide PID 946141 fr.267-270 (two stairs per side, four corner turrets, cinemas 2 + 3 in the wings, wing 40+ ken, fronts on the street); tower-study-review (15.15 m); interior-sources A1 / A6 / A7 / A8; detail-spec s1 and s6. Everything else is `A:` (assumed).

- **Ticket hall.** Hero: the brass-grilled ticket window seen from the clerk side (sash half raised, 17-bar grille with a speaking oval, stone sill with brass dip tray, bell push with a raised button, roller blind as the middle layer of the three-layer window), desk with drawers, abacus showing a sum, punch, ticket rack, ledger, lamp, pigeonholes. Story: the clerk stepped out. The ticket roll hangs from the desk to the floor, an umbrella lies in a puddle, a ticket is on the floor, the north door is ajar and the sun walks across the glossy floor. Six surfaces dressed (slab floor with wear lane, dado and wallpaper fields, coffered ceiling with vents). Receding rows: benches, pilasters, pendants, pigeonholes. Over-abundance: pendant bulbs (33 at three heights). Dream: 34.4 m hall, pastel coral, teal runner, **one red balloon tethered to the desk**, bouquets.
- **Turret stair (SW).** 84 risers of 178.6 mm, winder corners round a 1.6 m eyewell, runner with brass rods, iron balusters, teak rails, sloped soffits, windows on S and W faces at every level with sun pools, stair-head and lift-transfer openings. Story: the cleaner stopped mid-sweep (broom on the newel, dustpan with a heap, bucket and a wet stripe on three steps). Over-abundance: 22 pendants falling down the eyewell. Dream: petals and bouquets at every turn, teal runner, **an upside-down stair hanging from the ceiling**.
- **Lift landing + cage car.** Siemens-type 金網張り car (woven diamond wire mesh, angle-iron frame, brass waist rail). Hero mechanism: scissor gate (flat links, about 70 pivot rivets, top rollers, bottom track, brass pull, hook latch), landing gate, floor dial with needle, call plate with raised button in a ring groove, hand lever on a quadrant, control rope, four hoist ropes, guide rails, counterweight plates. Story: gate half drawn, car standing with a dropped bouquet, needle at "down". Mesh and skylight throw lattice shadows on the encaustic tile. Over-abundance: potted flowers (四時の花卉). Dream: **the car hovers 0.45 m over a teal pool, cables frayed**, petals.
- **Cinema (W1).** 35.85 x 17.1 x 8.85 m: barrel vault with ribs, tie-rods and battens, pendants, 12 bays of pilasters, wainscot and brackets, 25 rows x 3 bench blocks, proscenium, pelmet and tied curtains, orchestra pit (chairs, music stands), empty benshi dais (lectern, tea cup, clappers), screen, exit door ajar with a sun shaft, foyer with shelves of film cans, booth (z 3.9-7.1) with the hand-cranked carbon-arc projector (lamp house with chimney, mica window and feed wheels, head casting, gate, brass lens, shutter, crank and gears, two reels, film path, resistance coils), rewind bench, cans, knife switch, drop shutters. Story: the film runs in an empty house (beam with dust, cushions, programmes). Over-abundance: film cans and reels. Dream: 58 m house, teal curtains, looping procedural sea on the screen (placeholder, not a PD clip), **a white rabbit statue in the front row**.

Five cameras per room (axis, corner, ceiling 45 deg, window/sun wall, street view) plus `cam6_impossible` and a closeup. For the stair and cinema the "street" camera looks through a window or doorway from outside; the cinema has no window wall, so cam4 looks at the ajar exit door.

## Unverified (+) items
Swappable nodes: pressed ceiling panels (`var_pressed_ceiling`), crank wall telephone (`var_crank_telephone`), mechanical cash register (`var_cash_register`), projector drop shutters with fusible link (`var_drop_shutters`), fire buckets (`var_fire_buckets`). Also unverified: fixture types of the electric lamps (milk-glass pendants, sconces, desk lamp), knob-and-tube cleat wiring, pendulum regulator clock, hand-cranked projector details, benshi dais props, film can and reel design, the 2 sen fare (secondary source; only fictional digits are shown). No fluorescent light, AC or CRT. No people or person-like figures (the rabbit is an animal statue). All signs are digits or abstract marks.

## Triangles (exported, worst case including var_* nodes; budget 150 k per cell) and timings
hall 105 494, hall_dream 105 390, stair 44 336, stair_dream 53 354, lift 43 654, lift_dream 56 006, cinema 138 148, cinema_dream 143 918. Script build 5-18 s per cell, glb export 86 s, 64 spp Cycles render of 50 cameras 1219 s (GTX 1660 SUPER, OIDN).

## Iterations (renders read against interior-directive s0 and dreamcore 00012 / 00027 / 00033 / 00044)
1. Hall standalone (8 m hall); found the black floor (collision mesh was rendering) and validated the glb.
2-3. Sun pools, curtains, wall fields, grime.
4. INTERFACE.md read: hall rebuilt as the 3.55 x 17.2 gallery; stair, lift and cinema built to their boxes.
5-6. All rooms plus the dream pass (teal counter colour, balloon, rabbit, inverted stair, hovering car).
7. Cinema ceiling, beam as nested frusta, pendants, triangle trimming.
8-9. INTERFACE v1.1 (door heads, ref_ leaves, 3.55 stair), closeups.
10-11. Full pass.
12-13. Exposure +0.7 to +1.0 EV and a paler dream palette; final pass.

## Weakest three points against the dreamcore frames
1. **Airiness and colour.** The reference rooms are bright, pale and pastel with huge flower masses and mirror-glossy pink floors. Ours are warmer and moodier (hall, cinema), the dream variants are coral rather than pastel, and flower abundance is modest (bouquets, no overgrowth walls). Next: more exposure and bloom, flower mass instancing.
2. **Stiffness and repetition.** Stair treads read as slabs on a sloped soffit (no stringers or newel brackets), wall bays repeat one moulding, cinema benches are dark and uniform, the projector beam is nested frusta rather than a volume, the screen is a flat emissive card, and the dream sea is procedural. The projector is convincing only in its closeup.
3. **Street and three-layer checks.** Camera 5 views use stand-in exterior skins (`ref_outside`, not the exterior agent's facade), glass reflects a bright sky to milky white, the cinema vestibule is a bare stand-in, interior mapping was not used, and there is no grain or bloom beyond a fog-glow glare. The exterior `*_backing` placeholders were not tested together with these cells.
