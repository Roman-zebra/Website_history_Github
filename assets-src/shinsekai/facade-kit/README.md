# Facade module A - 1912 Ebisu-dori shopfront (pilot kit piece)

Two-storey, one bay (3.0 m wide), built entirely by script: `build-facade-1912.py` (Blender 4.5, headless).
Rebuild: `blender -b -P assets-src/shinsekai/facade-kit/build-facade-1912.py -- [--no-render] [--only street|closeup|lod] [--samples 96]`.
Outputs: `facade-a-1912.glb`, `review-street.png`, `review-window-closeup.png`, `review-lod.png`. No people, no real brands or shop names.

## Dimensions (metres)
Axes in Blender: X along frontage, Y depth (front face y=0, street at -Y), Z up; origin = bottom-left-front. In the GLB (Y-up) the front faces +Z.
Bay 3.0 x 7.0 (+0.95 awning, +0.42 step). Plinth 0.5, opening 2.4 x 2.25, string course 3.2, sills 3.9, heads 5.4, cornice 5.95-6.3, parapet top 6.9. Wall 0.25 thick, window reveal 0.25 to the back face, frame front at 0.10 (sashes at 0.125 and 0.178).

## From photo 158514 (OML CC0, Ebisu-dori 1912) / 157003 / 157013
Two storeys with plastered upper storey; sash windows in pairs; small parapet; deep ground-floor awning; long horizontal fascia board; hanging disc signboard; open shopfront; lantern rows under the eaves (157871); small-pane glazed case and wooden lattice (157013/157003); overhead wires with insulators.
## Assumptions (all numbers above; nothing is measured)
Every dimension; 9-light sashes (3x3), double-hung with the lower sash of the right window raised 0.26; pane size; cornice/corbel profile (the photo shows only a plain small parapet, corbels are invented); stripe colours and all colours; door layout (4 sliding leaves, one open); interior contents; the rooms behind windows. Fictional marks only (ring, diamond); no text.

## Materials / slots
PLASTER, TIMBER, GLASS, FRAME, CANVAS, SIGN, IRON, INTERIOR + extras STONE (plinth, step, sills), POSTER, STAIN (alpha decals), INK (marks).
The GLB has constant-colour materials and no images (nothing copied into the repo). Review renders use CC0 textures from `research-cache\materials-93\` by absolute path: Plaster007 (ambientCG, https://ambientcg.com/view?id=Plaster007) for PLASTER, Metal041B (https://ambientcg.com/view?id=Metal041B) for IRON, large_sandstone_blocks (Poly Haven, https://polyhaven.com/a/large_sandstone_blocks) for STONE. All CC0 per download-receipt.json. PaintedPlaster006 and green_metal_rust were not used.
## Vertex data and UVs
- `COLOR_0` = true colour: interior albedo, canvas stripes, glass tint, STAIN alpha (white elsewhere).
- `_WEAR` (custom attribute, RGBA): R = dirt (bottom-up splash gradient + soot under the cornice + grime under ledges), G = edge wear (from edge angle, bevels), B = emissive mask (INTERIOR paper/lanterns), A unused. Codex: read `_WEAR` in TSL; do not multiply it into colour.
- UV0 world-scaled: 1 UV = 1 m (box-projected per face, timber grain along U). UV1 = lightmap pack, non-overlapping per part (unbaked).
## Tris (GLB, triangulated)
LOD0 6,493 (target 6-9k); LOD1 1,224 (target ~2k, below it: no muntins/lattice, reveal kept, sashes as slabs+rails); LOD2 222 (box wall, dark inset for reveals/shopfront, cornice block, awning, disc).
Nodes: `FAC_A_LOD0/1/2` (empties) with child meshes per part: shell, windows, shopfront, fascia, awning, sign, (LOD0: lanterns, interior, services, decals). Awning, sign and fascia are separate meshes so they can be swapped/varied. LOD0 parts: shell 638, windows 888, shopfront 948, fascia 124, awning 596, sign 424, lanterns 660, interior 1268, services 288, decals 659. Window LOD0 = ~444 each (budget 800).
Validation: `gltf-validator` is not on PATH, so it was skipped; the script parses the GLB and checks buffer ranges, node names, tri counts, attributes, alpha modes (STAIN, GLASS = BLEND).
## Interior mapping replacement
LOD0 interior is real geometry (rooms 1.5 x 2.15 x 2.6 behind each window, shop 2.3 x 1.8 x 2.0). For LOD1+/far, drop the `interior` mesh and use a TSL interior-mapping shader on the GLASS quad: ray/box test in tangent space against a room box (depth ~2 m, back wall at y=2.4), sample an atlas of baked room cubes (random per window via instance id), add a curtain layer and a warm emissive term from `_WEAR.B` conventions; night: 60-80 % lit.
## Integration for Codex
Instance FAC_A per bay on a 3.0 m grid; swap LODs by distance (0-15/15-40/40+ m) with dithered cross-fade. Override materials by name; apply per-instance tint to PLASTER and stripe hue to CANVAS. GLASS/CANVAS/STAIN/POSTER are double-sided; STAIN and GLASS are alpha-blended (decals: keep depth-write off). Set `vertexColors` handling deliberately: COLOR_0 is a real colour multiplier.
## Known gaps
No baked AO/lightmaps; no normal maps or trim sheet yet (only constant colours in the GLB); muntin alpha cards for LOD1 not made; glass waviness is small geometry noise (+ a bump in the render only); no gutters/downpipes, tile eaves or shutters; the awning does not deform; lantern glow and sign faces are not animated; no night look-dev render; window frames look uniformly cream; wall has no unique per-module shape variants (only a mirrored/tinted copy in the street render); street render neighbours are the same module.
Street render camera: 7.6 m from the wall (not 6 m) at 24 mm - at 6 m the 7 m facade does not fit the frame.
