# Preserve unloaded-room window backing

2026-10-01, handoff118 conservation. Tower113/115 previously hid every base
`_backing`, `_backing_dark` and `_curtain` mesh whenever any interior loaded.
Those material meshes combine windows/doors across the entire building.
Loading one room therefore removed shallow rooms behind unrelated windows.

`tower-placeholder-mask.mjs` classifies complete connected components, joining
only exact equal source positions across exported normal/UV splits. Each
component's box centre is tested against the frozen115/aa030cd INTERFACE
room bounds with inferred0.5m horizontal/0.1m vertical boundary allowances.
BlenderY becomes negative runtimeZ; runtimeY is height. Unowned components
stay visible. This is an authored placement rule, not surveyed dimensions or
player collision. The supported stair cell is SW only; east/north turret and
upper hall/roof-void windows stay backed. No base placeholders belong to the
central roof lift or current cinema volume. WingW1 backing is still hidden
only for the loaded cinema; SW stairhead replacement remains stair-only.

Only the selected component indices are temporarily omitted. One index-buffer
object is reused and its original source array retained for exact unload/room
switch restoration. Positions, normals, UV, colours, materials, images,
animation and transforms are unchanged; no asset re-export or new mesh/material.
Keeping unrelated windows visible can restore draws previously suppressed by
the buggy whole-mesh hiding; it is not a draw-count or performance improvement.
The pinned local r186 implementation was checked against the official
[BufferGeometry draw-range documentation](https://threejs.org/docs/pages/BufferGeometry.html):
indexed ranges count indices. `needsUpdate` uploads the reused buffer;
`setDrawRange` limits it without replacing the geometry. Original visibility
and draw range restore when the mask is disposed before asset release.

| Base LOD | Original placeholder triangles | Hall omitted / retained | SW stair omitted / retained | Lift/cinema base omitted |
|---|---:|---:|---:|---:|
|0|2042|40 /2002|380 /1662|0|
|1|1346|28 /1318|248 /1098|0|
|2|124|2 /122|22 /102|0|

These counts are independently checked against both frozen113 and115 assets.
LOD0/1 have151 components, LOD2 has62. Complete components prevent partial
window boxes being cut at room boundaries. Retained oriented index triplets
stay a source subsequence; original order/attribute bytes restore exactly.
Private `research-cache/tower-placeholder-mask-audit.json` records every room,
dream/unload state, component bounds, source hashes and restoration assertions.

Four meaningful tests cover room isolation, source attribute preservation,
split components, transformed roots, dream/room switch/unload/dispose,
unknown room, invalid index and same index-buffer identity. Ten related
mask/instance tests pass; full build311/311 passes. Native backend verification
is tracked separately in the round brief and private look-dev receipt; this
change does not qualify final1080p performance or visual/historical acceptance.
No art pass, extra Claude model/agent/review/acknowledgement call or new batch
heading is requested during conservation through21:45JST.

Native115 WebGPU/WebGL2 now pass all four cells in base/dream plus far
unload. Five fresh1280x720 captures inspected; no new console warning/error.
113 native smoke remains explicitly deferred for the human-requested update
stop. Both113/115 raw assets have already passed the independent audit.
