# Connected garment / retained hat contact comparison

Build privately with Blender4.5:
`-b --python-exit-code 1 --python build-cloth-v2.py -- --sewn --hat-contact`.
Output is parent `research-cache/upper-118-cloth-v2-sewn-hat/`; the original
sewn/default candidates are retained. The browser opts in with
`?clothhat&clothlook`; append `&webgl` for WebGL2. The same `_v2` nodes and
source root transforms are used. Source111 hardware is not repositioned.

The existing mass/stiffness,32-frame quality10 simulation, two fixed peg pins
and1.2mm thick connected pattern remain. The collider adds252 retained hat
triangles to200 peg triangles. A first attempt with that collider alone leaves
474 intersecting exported hat/cloth triangle pairs (versus58 in the original
sewn comparison), and is rejected privately before runtime adoption.

The successful comparison clears the initial overlap region before settlement:
both layers translate by the same inferred X displacement, max.12m, fading
over.05m in Y and.03m at the hat's upper/lower bounds. The fixed pins are
excluded. This preserves front/back spacing while letting collision settlement
rest around the hat, rather than starting inside its thin shell. Initial shape
adjustment and fabric parameters are artistic estimates, not a measured garment.
The max.074864m simulation displacement is measured from this adjusted pattern;
it must not be compared directly to an unadjusted pattern's displacement.

After export/reimport in world coordinates, the252 hat triangles and1708
garment triangles have0 intersecting pairs. Both pin displacements are0 and
nearest retained hardware distances stay.600338mm. All2364 source hardware
oriented position/UV0/colour triangles match exactly. Six exported fabric bodies
are closed and the haori remains one connected component. Replacement7456tri,
max149398/150000 active interior triangles. Validator0errors/0warnings/14infos.
GLB3,471,364bytes, SHA256
`e3da5405d002a9bfc25e4a0e0ac217558c1ea944458aa0370668ebe0179d69a2`.

The contact audit is discrete final surface intersection testing. It excludes
the chin cord, other room objects, containment, continuous simulation contacts
and physical mounting certification. Native same-camera source-light comparison
shows the sleeve's hat protrusion removed; the broad silhouette and right-side
post occlusion still need visual review. No final visual or1080p/FPS approval.

Private evidence: `research-cache/look-dev/cloth-hat-118/` and the build,
validator, exact geometry and exported-contact receipts in the output folder.
Full298-test build passes. One actual visual pass brings total20/hybrid18;
geometric/transport retries are excluded. The every-five packet remains queued
under the existing batch, without requesting a Claude review during conservation.
