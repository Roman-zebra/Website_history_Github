# Claude119 haori support construction — partial,2026-10-02

119 remains unfinished. The optional `building-a.html?clothsupport&clothlook`
loads private `haori-support-119-003/upper-cloth-support.glb`; `clothrail&clothlook`
keeps frozen7240. Default/public world is unchanged. Local current server18773.

The garment now wraps a real bamboo bar through the sleeves, with two cords
anchored to unchanged original peg surfaces. Connected front/back/armholes,
curved sleeve underside, folded collar and inward hem retain original cloth
colour, maps and roughness.32-frame Blender4.5.10 local cloth settlement used
the original hardware plus added bamboo as colliders.003 translates that settled
shape/bar80mm downward and lengthens cords; it was not resimulated. Gravity-
relative shape stays fixed; exported neighbours were re-audited before rendering.

Numbered history is preserved.001 first export lacked support-cap tangents;
technical r2 triangulates caps/metric UV and exports with tangent repair0/0.
001 cords intersected cloth30/32 pairs, rejected before native rendering.
002 attaches cords to exposed bar ends, exported neighbour pairs0 and source
anchor distance0, but seven nativeGPU images show its short cords hidden behind
the shoulder.003 lowers support, preserving garment shape. Both fixed complete
front/side views now show bar/cords and sleeve volume. Earlier cropped views and
the initial003 framing diagnostic remain saved; camera changes are technical
qualification, not additional artistic improvements.

003 has one connected closed1.2mm fabric body,1916 garment triangles plus100
support triangles. Replacement total7764 vs7456, maximum active interior with
petals149706 by the existing room formula. This is not an iPhone performance
measurement. GLB3582776bytes vs3473404; original3444468-byte binary prefix and
all unrelated mesh/material/image/texture/node/transform/clip bindings remain
exact. New data appended105036binary bytes; no new texture or lowered map/AA.
Validator0errors/0warnings(20info, including retained unused old accessors).

Exported discrete neighbour audit finds0 surface pairs for bamboo/cords and no
intersecting source interior/exterior/hardware bounding-box neighbours. This
does not certify containment, continuous collision or physical mounting. Scene
save/reopen matches all mesh positions/faces/UV/vertex colours/material names/
world matrices; shader nodes/physics-cache equality is outside that snapshot.
001 pin drift0; original settlement offset including Solidify43.8mm.003 offset
95.6mm also includes its80mm translation and is not a new simulation result.

Saved003 measurements: sleeve underside sag107.275/109.809mm relative to inner
underarm,27.5065/28.1562% of390mm sleeve depth. Collar front projection8.202–
9.713mm across sampled rows; this is folded profile, not8mm fabric thickness.
The rest pattern has four22mm peak-to-trough waves. Final front row X range41–
57mm includes broad body deformation and cannot certify each requested10–25mm
crease. Local crease amplitude/count and final hem curl remain to qualify.
Roughness.94 is unchanged; browser `clothlook` retains existing tinted sheen
gain.35/roughness.85. Wall contactAO and final weak-sheen acceptance remain open.

Matching1280x720 native WebGPU/WebGL2 complete front/side comparisons retain
fine weave, room grain/props and antialiased edges.003 folder has15scenePNGs:
12source/candidate front/side/upper-corner,2reentry,1initial framing diagnostic.
GPU upper-corner baseline is explicitly reused from002, not a fresh003 capture.
That opposite-room view leaves the garment offscreen and is a regression control,
not evidence of haori appearance. GPU context exact; GL context14pixels/max1;
no cause asserted. Front GPU223666pixels/max182, GL223673/max182; side GPU116060/
max179, GL116063/max179 (GL bbox includes small changes outside garment).
Both reentry front captures are exactly equal to first candidate; both far views
have interior/cloth empty. Observed console warnings/errors0. DOM retirement is
not a direct GPU memory measurement. Full build353/353 passed.

Evidence lives in parent `research-cache/haori-support-119-001`,002,003.003:
`native-receipt.json`, `validation.json`, `neighbours.json`, `scene-reopen.json`,
`shape-measurements.json`, `topology-material.json`, `differences.json`,
`captures.jsonl`, `build.log`, `settled.blend`. Authoring/technical repairs and
measure/reopen helpers are retained under `assets-src/shinsekai/workflow/`.

Next qualify local body folds/hem, then isolated wallAO and sheen comparison,
BuildingA upper4, integrated1080p handoff, production/full world/phone. Hall
contact010 remains partial static shading; moving-light/upper shadows and clipped
emitters remain limitations. No full119 completion or formal review request.
TRIPO additional0; no new tools/agents. Goal remainsACTIVE.
