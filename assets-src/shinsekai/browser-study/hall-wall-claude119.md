# Claude119 hall wall transition — controlled source-preserving repair

2026-10-02, baseline8177a4a/source115 aa030cd. Scope: colour grime only at
the waist-stone/plaster transition. Keep qualified exposure-1.25EV/directional
gain.01 and floor wear fixed; original maps, UVs, vertex colours, normals,
roughness, geometry, glass, lights and1280x720 beauty AA remain. No AO substitution
or new textures/geometry. Original GLBs stay immutable.

Source audit in parent `research-cache/hall-wall-119-001/source-audit.json`
identifies `sandstone`/.7 and `plaster_dk`/.85 on `hall__walls`. Source vertical
vertices include stone1.204m and plaster1.215m; inferred band centre1.21m.
The same sandstone also belongs to window/door sills. Temporary independent
copies apply only to measured wall-mesh names; source assignments restore before
cache reuse/release, and copies alone are disposed. Shared sill material remains
untouched. Two meaningful tests cover this boundary, maps/roughness preservation,
idempotent restore and atomic failed-decoration cleanup.

Local coordinates are baked glTF X/Y/Z metres; room translation[-14.05,.15,8.6].
Grime uses vertical-face gating and a continuous height fade(.015–.14m) around
the boundary, with two deterministic local noise scales. Strength.18, heights,
colour bias and noise are artistic estimates, not historical observations.
The local normal gates colour coverage without changing source normals/maps.

Source URL: `tower-base-115.html?hallstream&hallprefetch&hallexposure&halldirectional&hallfloor=wear&hallwallview`.
Replace `hallwallview` with `hallwall=control` or `hallwall=wear`; append`&webgl`
for the fallback. Default production/source and phone routes stay unchanged.
The source/node-copy comparison qualifies the material class before colour wear.

Fixed context `hall`: position[-12.275,1.65,6.9],target[-12.275,1.8,-3].
Close `hallWall`: position[-12.35,1.65,5.2],target[-14.035,1.41,3.5]. Close camera
was framed on the unmodified transition before the artistic change.
Native evidence is retained in `research-cache/hall-wall-119-001/`.

WebGPU source/node-copy near/context PNGs are exact. Colour-only differences
are confined to the transition: close49451pixels/max6 of255, context19212/max6.
The near image shows a faint irregular film while retaining joints/stone pattern
and the plaster border; the effect is deliberately subtle. Pixel changes confirm
application, not artistic approval. Wall selection reports2materials/2meshes.
Close369574tri/context377944tri unchanged. Dream source PNG hash exact
f14291419ef673c4b4c0d9cd80dd95c043682b45310b3405e45cd2bff07565d1;
wall/floor metadata absent, EV0/source directional restored. Healthy errors0.
Far exterior38980tri/75draw and cache reservation0 verified on both backends;
wall metadata absent. Initial GPU metadata observation timed out. After completing
the other backend, fresh GPU room-entry/far inspection confirmed retirement;
the initial metadata observation itself remains unresolved. No terminal renderer
state was inferred from that observation timeout.
Full static340/340 passes; generated output patch retained and unrelated outputs
restored. Previous8177a4a exact Workers success2026-10-01 17:41:59UTC verified.

WebGL2 close/context colour wear renders without warnings/errors; source/copy
close exact, context differs at8pixels/max1 of255. Across both backends the
four controls are3exact plus this tiny rounding difference. GL colour-only
close49371pixels/max6 and context19204/max6, same transition region. GL dream
source PNG hash exact a73b0050b5ae64d9660d1d96dab563a8b2dc44da6d70b6bad4c81bf288e9ba3b.
Fourteen native PNGs retained, four encoded input hashes rechecked unchanged;
qualified partial119 reply posted promptly through requests-to-claude.md.
Hall art trial7; BuildingAart26/hybrid23/cloth7240 unchanged.

Do not infer completed119, art acceptance,
iPhone14 speed/heat/memory, qualified GTAO or production readiness from tests.
Remaining119 includes local warm lamp pools/dark timber, GTAO restoration,
haori support/gravity/folds/collar/contact and the four upper-floor details.
TRIPO added spend0; no new tools, agents or model/review calls.
