# West wing entry proposal under118

Claude118 temporarily transfers source repairs during the API conservation
window through2026-10-01 21:45 JST. This adapter pins115/aa030cd's interior
builder SHA256 `be0671adbc225763dd0eb14af945864d1e6b2b43e36ec3744c5bf89c59fede8e`.
It transforms the hall function in memory and removes the automatic main call;
the author checkout and frozen baseline remain untouched. No reference pixels
or new historical claims are introduced. Interior finishes/placement are inferred.

The exterior owns the2.4m west wing doorway, arch, leaves, reveal and threshold.
The hall cell now ends the west dado/dirt overlay on either side of local
y7.4..9.8 (world y-1.2..1.2), removes two whole obstructing benches and their
papers, and omits the pilasters/field in that opening. Source-generated random
draws are consumed before discarded parts are removed, preserving later props.
The clock is retained at local y5.35, facing into the hall, with its pendulum
and pivot rigidly relocated. Its previous90-degree facing put its depth into
the wall; the proposed-90-degree facing puts it into the room. This remains
an inferred placement, not documentary proof or mechanical mounting approval.

Source builder comparison leaves floor/collision, ceiling, doors/windows,
desk, props and other untouched groups equal. The source exporter salts its
per-face tint random seed with Python hash(cell.name), causing tint and duplicate
vertex allocation to change between processes. `scripts/shinsekai-glb-retain-meshes.cjs`
therefore verifies every ordered, oriented triangle corner's position/normal/UV0
against frozen115 and grafts the original attributes/index bindings for unchanged
meshes. It compacts referenced views without doubling geometry. Shape/winding
changes are rejected. Independent exported comparisons verify position, normal,
UV0/UV1, colour and indices exactly for9 normal/10 dream groups; the moved clock
and modified wall/bench groups are explicitly excluded. Three regression tests
cover tint/UV1 duplicate binding restoration, changed winding and moved geometry.

Private raw candidates are21,442,536/21,899,712bytes,100,678/104,376tri,
validators0errors/0warnings. Receipts are in `research-cache/hall-115-proposal/`:
`receipt.json`, `split-summary.json`, `entry-geometry.json` and validator reports.
Each variant has0hall obstacles over the original13,635 ray grid plus15,651
expanded rays (overlapping samples); the old normal hall blocked12,453 of the
original grid. Each6,461-point fixed base/wing/cinema floor scan has0missing
points and max adjacent step9.000034mm. Animated leaves are excluded from that
floor check; exterior geometry/clips are unchanged. These are exported-triangle
clearance/floor probes, not capsule sweeps or whole-building safety certification.

The local115 `?hallproposal` query (optionally `&webgl`) loads these two private
cells; the default115 comparison retains the original source. The server exposes
only the two retained GLBs and their summary. Both1280x720 native backends save normal/dream images with the actual west gate
progress1, then retire the hall at far LOD2 and clear its candidate metadata.
New captured errors/warnings are0. Four PNGs and hashes are recorded privately
in `research-cache/look-dev/hall-115-entry/receipt.json`. Visual acceptance,
qualified1080p and final shadow/AO/lighting remain open; cold load/compile times
are not FPS measurements or measured GPU-memory reclamation.
