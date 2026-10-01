# Inferred lift doorway repair under118

The frozen115 assembly places the roof deck at15.15m. This is the existing
source-relative study datum (about50shaku); the ground reference is unresolved.
It is not a newly measured historical height. The v4 schematic already aligns
its lower landing and car floor with that datum; its enclosed top still has no
invented upper stop. The115 detailed cage is a separate assumed interior.

In the detailed base variant, the plank floor top is15.168m and the brass sill
top15.174m. A steel lower frame rail crosses the open doorway at15.29m.
This is an obstacle above the floor, rather than a14cm error in the floor datum.
The dream variant deliberately raises the cage45cm and is not a docked ride.

`?liftproposal` on `tower-base-115.html` selects a private derivative for the
lift cell only. The additional “昇降機入口の敷居” view looks at the original
doorway from above the landing. Both exported gate sliders/clips remain usable.
The default source route and unresolved historical upper landing stay intact.

The pinned `lift-threshold-patch.py` omits only the lower front steel rail in
`cage_car`. It executes/discards that box to preserve random draws. Source
hash `be0671adbc225763dd0eb14af945864d1e6b2b43e36ec3744c5bf89c59fede8e`
is required; a changed source is rejected. The underfloor frame, plank floor,
brass sill, side/back lower rails, upper rails, gate parts/pivots and collision
polygon remain. This is an inferred modelling repair, not a1912 mechanism claim.

The first whole export was unsuitable for byte retention: the car's triangle
partition differed. The final derivative uses the frozen source GLB, removes
only44 steel triangles matching omitted source face corners within0.0005mm
float32 roundoff tolerance, and appends their retained index list. There is no
vertex resampling. All source vertex, normal, UV0, UV1, colour, image and
animation binary bytes remain identical; nodes, materials and clip JSON remain.
Unused original index bytes are retained, accounting for extra validator infos.

Private `research-cache/lift-115-proposal/split-summary.json` records:

| Variant | Bytes | Triangles | Validator errors/warnings |
| --- | ---: | ---: | --- |
| base |15,895,328|50,926|0/0|
| dream |17,386,884|63,278|0/0|

The source/candidate world-space ray audit uses the viewer's cell placements,
actual mesh triangles and visible shell finish/sills. Animated gate leaves and
hidden backing/guard placeholders are excluded. Near-floor support rays start
at15.19m; separate obstacle rays start at15.45m, avoiding the false conclusion
that a floor underneath a crossing rail proves a clear doorway.

| Base-variant path | Probes | Missing | Observed heights/steps |
| --- | ---: | ---: | --- |
| stair portal → roof |1,962|0|15.15–15.182601m; max adjacent22.201mm|
| roof → lift vicinity |3,669|0|15.15m|
| landing → car support |4,620|0|15.15–15.19m, includes small props/sills|
| doorway low obstacles, source |1,389|0|max15.29m; adjacent114.499mm|
| doorway low obstacles, candidate |1,389|0|max15.19m; adjacent23.100mm|

The longer route into the car still encounters flower/prop geometry up to
15.254207m. The local doorway repair does not certify that route, walking
capsules, continuous travel, gate clearance, load-bearing strength or safety.
Receipts: parent `roof-lift-{inventory,proposal}.json`, adapter receipt and
private native PNG/receipt folder `look-dev/lift-threshold-118`.

The runtime remains local-only. Neither source geometry nor reference media is
added to the published site; no new reference pixels, rights or dates are implied.
Visual acceptance and final effects/combined1080p performance remain open.

Native WebGPU and WebGL both loaded the exact candidate receipts, set both
gate sliders to1, saved base/dream PNGs, and retired the cell and candidate
metadata at far LOD2. New errors/warnings were0. Buffers were1280×720 with
1920×863 CSS dimensions; this is not the1080p performance gate. Four PNGs and
their hashes are in the private native receipt. Full site build:298/298 tests.
This is one actual tower repair pass (total21 artistic/18 hybrid); technical
export/attribute matching retries are excluded. No Claude call is requested.
