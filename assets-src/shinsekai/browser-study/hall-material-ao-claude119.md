# Hall material AO006 — Claude119/120 partial repair

This optional experiment repairs the source-null glass fidelity regression.
Contact shading and119 as a whole are still unfinished. Source115/aa030cd,
original maps, geometry, camera, exposure,2350K lamps, point.5 and wear remain.

AO004 replaced preparatory RenderPipeline with QuadMesh but the GPU near null
image still exactly matched the failed beauty isolation. No artistic candidate
was rendered. AO005 separated global main context from preparation. On both
WebGPU and WebGL2, preparation-only near/context PNGs exactly matched source;
context-only without preparation reproduced prior differences (GPUnear114520
pixels/max69,context44906/max162; GLnear114508/max69,context44893/max165).
Thus global main context is sufficient here and preparation is not necessary.
This corrects the earlier preparation-sufficiency inference; the private cache
mechanism is not claimed diagnosed. Eight native005 PNGs are retained.

AO006 keeps renderer.contextNode and alpha materials original. Only opaque hall
materials are independently cloned, retaining map references, scalar values,
RGB and existing color/normal/fragment nodes. Their AO context is applied just
during main rendering; finally restores exact original assignment references.
Source aliases, duplicate copies and lossy clones fail atomically; only owned
copies are disposed, leaving source textures and cache untouched.

`hallao=materialcontrol` uses constantAO1 through the same preparation and
material scope. Four near/context native PNGs exactly match original direct
images on both backends.54owned materials/77meshes;0newtextures/no geometry
change; public preparation/render states equal. This qualifies the source-null
route, not final artistic acceptance. `hallao=material` uses the same opaque
GTAO radius/thickness.35/resolutionScale.5 and canvas AA. Indirect light only;
unoccluded global sun/hemisphere fill remains a separate pending problem.

Actual AO differences from original: GPUnear398254pixels/max18,
context386068/max20,floor257307/max19; GLnear398178/max18,
context385811/max20,floor257548/max18. Bench underside/junctions darken; feet,
counter and shelf contacts remain weak and small dark speckles remain. Full
near maps/AA are retained. Multipass counters near760284tri/316draw,
context752092/294,floor736568/258 exceed provisional phone budgets; these are
desktop rendering counters, not iPhone14 timing or memory acceptance.

The pure material-scope tests cover ownership/alpha and array identity, map
preservation, rendering exceptions, failed/lossy clones, alias rejection and
idempotent cleanup. Full build346/346. Added TRIPO credits0, no new tools or
agents. Technical004/005 controls do not count as artistic revisions; actual
AO006 is hallart13. BuildingAart26/hybrid23/cloth7240 unchanged.

Retained evidence: parent research-cache/hall-ao-119-004/gate-result.md,
hall-ao-119-005/native-receipt.json and hall-ao-119-006/native-receipt.json.
Next: improve AO noise/contact strength with one changed factor at fixed views,
then interior fill/geometric shadows, finite4–6m range, haori and upper four
details.119 incomplete; observed120/processed118. No formal review request yet.
