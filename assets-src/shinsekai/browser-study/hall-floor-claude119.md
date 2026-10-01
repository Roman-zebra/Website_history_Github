# Claude119 hall floor — source-preserving staged repair

2026-10-02. Source115 aa030cd, original normal hall SHA256
4a22e2fed1db757ae884d40e86a378715afbcf7099511d583788dc83d5387218.
Source GLBs remain unchanged. The baseline uses qualified -1.25EV and source
directional gain.01, full-resolution original maps,1280x720 beauty AA and no
unapproved GTAO. Lamp colours/ranges and other materials remain fixed.

Local URL `tower-base-115.html?hallstream&hallprefetch&hallexposure&halldirectional&hallfloorview`
is the original floor control. Replace `hallfloorview` with `hallfloor=control`,
`hallfloor=roughness` or `hallfloor=wear`; add `&webgl` for fallback.

## Measured selection and ownership

Only `stone_floor` and `stone_floor_worn` on two floor meshes are temporarily
copied. Source factors are.10000000149/.34000000358, with original colour maps
and no roughness map. Node-copy control retains these values and is qualified
separately from artistic changes. Original assignments, including shared material
arrays, are restored before cache re-entry/release; only the copies are disposed.
Two meaningful tests cover ownership/restoration and atomic failed-copy cleanup.

Floor geometry is baked hall-local X[0,3.55],Z[-17.2,0],Y.003 metres. Runtime
room translation is[-14.05,.15,8.6]. Seven cast-iron support contacts were
measured from source geometry atY0/X.31; their Z positions and source hashes
are retained in `research-cache/hall-floor-119-001/source-foot-audit.json`.
Grime radii/intensities are inferred art settings, not historical observations.

## One-factor comparisons

The fixed `hall` context camera remains unchanged. A separate close camera
`hallFloor` at[-12.35,.8,6.25] toward[-13.2,.153,4.5] shows floor joints,
bench feet and wall edge in the baseline before any revision.

First verify source versus node-copy control. Then change roughness only to
.72/.76, inside Claude's.6–.8 range. Against this same roughness, add only colour
wear: continuous walking and edge fades plus seven measured support-foot masks,
with broad local noise. Source joints/veining, UVs, normals and geometry remain;
no new textures or geometry. Grime is surface colour, not a replacement for AO.

Private comparison folders: `research-cache/hall-floor-119-001/` for original,
node-copy and roughness; `research-cache/hall-floor-119-002/` for colour wear and
dream controls. Source materials and GLBs are not overwritten.

WebGPU node-copy near/context PNGs match source hashes exactly. Roughness removes
the strong white floor highlights while source floor pattern remains visible.
Colour wear produces subtle darker walking/edge/foot marks; near colour-only
difference463309pixels/max13 confirms application, not artistic approval.
Near370042tri/137draw and context377944/156 remain unchanged. Dream PNG hash
matches original source f14291419ef673c4b4c0d9cd80dd95c043682b45310b3405e45cd2bff07565d1;
floor metadata clears, EV0/source directional restored. Far empty/LOD2 with
38980tri/75draw and prefetch reservation0. Healthy warnings/errors0.

WebGL2 near/context roughness and colour wear also render without warnings/errors.
Four source/node-copy control pairs are PNG-hash exact. WebGL context uses a
fresh source with the same exterior→hallFloor→hall view sequence (hash
0c47c0952f7281ba0e35115acb08bcb90a9b33e4553e002de1c1758fde8ceb04);
the older direct-context reference differs at only3pixels/max1 of255, so view-order-independent framebuffer
behaviour remains unqualified. WebGL dream source hash is exact a73b0050b5ae64d9660d1d96dab563a8b2dc44da6d70b6bad4c81bf288e9ba3b.
Both far controls are empty/reservation0, floor metadata absent. Seventeen native
PNGs retained including the fresh source context; four encoded input hashes
rechecked unchanged. Full static build338/338 passes after these runtime
changes; generated output patch is retained privately and unrelated outputs
restored. Original-source phone transfer limits still fail; no actual iPhone14
FPS/heat/memory claim or production/final artistic approval follows from this.

Remaining119 includes wall stone/plaster-transition grime, warm lamp calibration,
dark timber, qualified GTAO, haori support/gravity/collar/contact, and four upper
floor details. Observed119/last closed118 remains. Verified partial floor reply posted promptly through the
agreed Claude file; no premature full119 completion. Hall art trials5/6;
BuildingAart26/hybrid23 and cloth7240 unchanged.
TRIPO added spend0; no new tools, agents or model calls.
