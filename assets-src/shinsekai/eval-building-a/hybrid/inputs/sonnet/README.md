# Building A (Sonnet) - two-storey shop-house, Ebisu-dori 1912

Blind model-evaluation entry. Everything is built by `build-building-a.py` (Blender 4.5, headless, one file, no external assets).
Rebuild: `blender -b -P assets-src/shinsekai/eval-building-a/sonnet/build-building-a.py -- [--no-render] [--no-export] [--only street|closeup|ground|upper|cutaway|lod] [--samples 96]`.
Outputs: `building-a.glb`, `street.png`, `window-closeup.png`, `interior-ground.png`, `interior-upper.png`, `cutaway.png`, `lod.png` (1280x720, Cycles, 128 spp + OIDN denoise).
Warm-up disclosed: the window/awning/sign/lantern/decal code descends from my own facade pilot in `assets-src/shinsekai/facade-kit/` (copied, not modified). Everything else (two-bay layout, side/back walls, hip roof, gutters, interior cell, all materials) is new for this task.

## Wall-clock / iterations
- Start 2026-09-30 23:26 (task start; first script run 23:33), end 2026-10-01 00:12 (`date` at start and after the final render+commit). About 46 min.
- 5 full render-and-read iterations (first build; materials/lighting; fills and coplanar fixes; decals/props; final 128 spp) plus 2 single-shot debug renders. No help from the supervisor during the run.

## Dimensions (metres) - ALL ASSUMPTIONS unless marked "photo"
Axes in Blender: X along frontage, Y depth (front face y=0, street -Y), Z up; the GLB is Y-up (front faces +Z).
- Footprint 6.0 x 9.0 (brief: about 6 x 9), two bays of 3.0, walls 0.25 thick. Heights: plinth/doma 0.5, shopfront head 2.75, string course 3.2, sills 3.9, window heads 5.4, plate 6.0, parapet 6.9, ridge 7.85.
- Ground floor: earth doma z=0.5 (y 0.25-4.6), raised floor z=0.95 (y 4.6-7.5), rear kitchen doma (y 7.5-8.75). Upper floor top z=3.6 (slab 0.3), ceiling z=6.0 (room height 2.4, ground clear height 2.8).
- Openings: two shopfronts 2.55 wide (z 0.5-2.75); four upper windows 0.85-1.0 wide, 1.5 tall; back door 0.9 x 1.9; stair 0.8 wide, 13 risers of 0.204 / treads 0.246 (opening in the upper floor 0.8 x 2.65 with a handrail); partition opening upstairs 2.75 wide.
- Roof: hip roof (ridge along Y), pitch 0.5, eaves 0.6 out at the sides and back, front slope hidden behind the parapet; gutters, four downpipes (one on the front right pier with a scupper).
- Tatami 1.8 x 0.9 mats (six-mat rooms), zabuton 0.55, low tables 0.9-1.0 x 0.6, counter 2.2 x 0.55 x 0.85.

## Photo-derived vs assumed
Photo-derived (OML CC0 158514, 157003, 157013, 157016, 157871; the 1912 target photo is 158514): two storeys, plastered upper storey with paired sash windows, small parapet, deep ground-floor awning shades, long horizontal fascia board, hanging disc sign, open shopfront with sliding lattice/glazed leaves, lantern rows under the awning (157871), small-pane display window and lattice type (157003/157013), overhead wires on insulators, posters.
Assumed (everything else): all dimensions above; hip roof (the photo shows only the front parapet); dentil cornice profile and irregular dentils; sash light counts (9/9/12/8 per sash) and colours; awning colours (faded ochre, bleached off-white with one repaired panel), noren indigo; every interior layout, prop and colour; roof pitch; gutter/downpipe layout; the side/back wall openings; the pole and neighbours in the renders (review-only).
Fictional marks only: ring + bars, diamond + strokes, disc mark, bar stack on the hanging board; no text, no brands, no crests, no people.

## Supervisor feedback applied
1 Too clean: four different frame paints (cream-grey, faded green-grey, sun-faded brown, ochre), upper/lower sash tone differences, AO-driven grime in corners and under ledges, silvered/bare patches, paint chips at edges, uneven plaster (large tone blotches decals, vertical run-off streaks, lime-wash repairs, chips to the lath), rain streaks under sills, soot band, splash zone.
2 Awning: no saturated stripes; bay A faded ochre plain canvas, bay B bleached off-white with a patched panel and different depth/height; indigo noren in the entrance.
3 Module repetition: the two bays differ in shopfront (leaves vs small-pane display window + entrance), awning, fascia board/mark, sills/heads, window sizes, sash lights and paint, shutter leaf on one window only, irregular dentils, different lantern sizes.
4 Roof and rainwater: tiled hip roof with stepped courses, eave tile rolls and round ends, rafters/soffit/eave board, ridge and hip rolls, generic oni-gawara at the ridge ends, half-round gutters with brackets, downpipes with clips and rain-water head.

## Interior cell (node `BLD_A_INTERIOR`, load within about 15 m)
Ground: earth doma, shop counter with abacus, open ledger, brush, inkstone, cash box, scale, half-drunk cup; wall shelves with goods (jars, bolts of cloth, tins, bottles, bowls, boxes), display table with cloths and jars, window display stand behind the small panes, stool with cushion, sake barrel with ladle, rice bales and sacks, umbrella barrel, pendulum clock and a coat on the daikoku post, price-tag board, geta on the step, hanging straw sandals, chochin and a bare bulb; raised tatami room (six mats, low table with tea things, zabuton, hibachi with kettle and embers, andon lamp, tansu chest, sewing box, folded kimono); kaidan stair with handrail; rear kitchen (kamado with two pots, water jar, sink, firewood, crockery shelves, hooks); shoji partition (one leaf ajar).
Upper: front room (eight-plus-four mats), tokonoma with scroll and vase, low table with teapot and cups, zabuton, hibachi, andon, chochin; shoji partition (two leaves closed, glowing) into the back room (six mats, tansu chests, futon stack, kimono rack, writing table with open book, bulb); window dressing behind all four windows (half-drawn curtain, rolled bamboo blind, tied check cloth with a plant pot, drying cloth). No people; traces of use throughout.
Walkability: floors are `FLOOR`/`EARTH`/`TATAMI` slabs at fixed heights (0.5, 0.95, 3.6), clear openings listed above; no collision proxy meshes were made (known gap).

## Tri counts (GLB, triangulated)
| node | tris | notes |
|---|---|---|
| `BLD_A_LOD0` exterior | 19,014 (19,002 + 12 backdrop) | budget 20 k. wall_front 900, windows 1,916, walls right/left/back 616/480/1,180, shopfront 1,704, fascia 258, awning 580, sign 504, roof 4,640, gutters 824, lanterns 1,556, noren 292, services 440, decals 1,988, streetprops 1,124, backdrop 12 |
| `BLD_A_LOD1` | 3,580 | muntins dropped (mid rail only), simple roof (7 courses), backdrop 0.34 m behind the reveals |
| `BLD_A_LOD2` | 722 | boxes, recessed dark insets, awning slabs, disc, roof planes |
| `BLD_A_INTERIOR` | 41,734 | budget 150 k. structure 1,842, shop 28,092, ground back 6,658, upper 4,310, window dressing 832 |
LOD0 openings are open onto the interior cell; `BLD_A_LOD0_backdrop` (12 tris) is the stand-in when the cell is not loaded (LOD1/2 have it built in). LOD ranges 0-15 / 15-40 / 40+ m.

## Files and technical notes
- GLB 8.96 MB, 47 nodes, 20 materials, 0 images (nothing copied into the repo). Root `BLD_A` with children `BLD_A_LOD0/1/2` and `BLD_A_INTERIOR` (empties with extras); meshes named `BLD_A_<node>_<part>` so parts can be swapped or hidden (`wall_left`, `gutters`, `awning`, `sign` are separate).
- `COLOR_0` = albedo/paint tint (STAIN carries alpha); custom `_WEAR` (R dirt, G edge wear, B emissive mask); `TEXCOORD_0` world-scaled metres (1 UV = 1 m); `TEXCOORD_1` lightmap pack (unbaked, no overlap per mesh).
- GLB materials are constant-colour (Col-driven ones are white so COLOR_0 is the albedo). GLASS and STAIN are alpha blended; CANVAS, CLOTH, SHOJI, POSTER double sided.
- Validation: `gltf-validator` is not installed; the script parses the GLB (buffer ranges, accessors, node names, tri counts, attributes, alpha modes) and passed. Tris per node group are printed at export.

## Texture provenance (all CC0, referenced by path, not copied)
- Plaster007 (ambientCG, https://ambientcg.com/view?id=Plaster007): PLASTER and WALLIN colour/roughness/normal in the review renders.
- Metal041B (ambientCG, https://ambientcg.com/view?id=Metal041B): IRON roughness/normal.
- large_sandstone_blocks (Poly Haven, https://polyhaven.com/a/large_sandstone_blocks): STONE.
- All other looks are procedural Cycles nodes (timber grain, floor boards, tatami weave, kawara, earth, cloth, paper); none of them are in the GLB. Receipt: `research-cache/materials-93/download-receipt.json`.

## Known gaps (3 weakest points are marked *)
- * Props are still simple primitives and lathes (boxy cushions, blob sacks, flat cloth stacks); no hero-quality sculpting, no fabric simulation, no baked AO/lightmaps so the GLB itself looks flatter than the renders.
- * The GLB has no normal maps, trim sheet or emissive channel (only vertex colour + `_WEAR`); the tile relief, plaster relief, weave and grain exist only in the render shaders.
- * Roof space and roof framing are not modelled (the ceiling closes the upper room); the hip roof is an assumption; no floor/collision proxy meshes; no interior mapping for LOD1.
- Other: glass is thin geometry with a bump only in the render; noren, awnings and curtains are static; the wires end at the review-only pole; side walls have few windows; LOD1 has no muntins/cards; no gltf-validator run.
