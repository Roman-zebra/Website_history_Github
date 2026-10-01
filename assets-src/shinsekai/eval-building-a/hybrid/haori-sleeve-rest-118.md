# Initial sleeve-drop diagnostic, handoff118

2026-10-01. One variable: initial outer sleeve drop0.035m(control),0.09m,
0.14m. Same bending0.6, source placement, pins, mass/damping/springs,
32frames/quality10,770 collider triangles, initial clearance,2.4mm collision
distance/quality6 and1.2mm closed fabric. These are inferred dimensions and
settings, not measured1912 clothing.

The scoped brief preceded authoring. Blender4.5.10 runs serialized, threads2:
`blender -b --threads 2 --python-exit-code 1 --python build-cloth-v2.py -- --sewn --hat-contact --rail-contact --haori-bending 0.6 --sleeve-drop VALUE`.
Outputs have distinct private `research-cache/upper-118-cloth-v2-sewn-rail-bend-0p6-sleeve-*`
directories. Official Blender4.5 shape/collision references and hashes are
in `assets-src/shinsekai/workflow/haori-sleeve-rest-brief.json`.

Raw control differed from the retained asset only in unrelated normals/tangents,
maximum component difference0.00029027462005615234; cause unverified. All
positions/UVs/colours/images and the entire connected garment were exact.
The narrow `scripts/shinsekai-glb-retain-cloth.cjs` adapter rejects unrelated
geometry/UV/colour/material/transform/clip changes, bounds discarded normal
drift at0.0005, and retains original normals exactly. It never applies the
approximation. For unchanged garment it returns the original file exactly;
otherwise it keeps the entire original binary prefix and appends only target
attributes/indices. Exported vertex split counts can differ, so triangle and
attribute contracts plus a separate connected/closed-body audit are used.

Restored control SHA256 is exactly
`7240ebf2851bc40a80e5bb2fc95644b2c4f372a08935a597d8c04f730f0b0f30`.
This is restored-control equivalence, not raw-export determinism.

| Initial drop | Initial midsurface/collider pairs | Exported wall pairs | Exported timber-post pairs | Exported rail/hat pairs | Decision |
|---|---:|---:|---:|---:|---|
|0.035m|0|0 neighbours found in prior audit|0|0|Existing baseline retained|
|0.09m|0|40|0|326 (hat288)|Rejected before render|
|0.14m|0|122|0|439 (hat340)|Rejected before render|

Both rejected derivatives pass validator0errors/0warnings/20infos, source
hardware2364 oriented position/UV0/colour triangles exact, six closed fabric
bodies/one connected garment. Pins stay0 displacement,0.600338mm from retained
hardware. The adapter also retains non-target normal/tangent and image bytes.
These passing checks do not override the failed exported contact audit.
Surface-pair counts are discrete triangle intersections; they are not unique
contact points or containment/continuous/mounting certification.

No candidate was loaded in the browser, no new image or art pass is counted,
and the runtime asset stays unchanged. Private raw and retained GLBs, solver
receipts, validator and neighbour reports are preserved; source hashes and
decisions are in `research-cache/haori-sleeve-rest-receipt.json`.
Large sleeve-drop tuning is closed. Next inspect supported shoulder/armhole
construction before another bounded rest-shape comparison. No Claude call,
new heading or review request during conservation through21:45JST.
