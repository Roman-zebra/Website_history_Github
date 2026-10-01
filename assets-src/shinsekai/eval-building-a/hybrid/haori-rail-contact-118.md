# Haori / retained rail and neighbouring post comparison

Optional runtime `?clothrail&clothlook`, with `&webgl` for WebGL2. Existing
`clothhat` and older defaults remain. Retained candidate is generated privately:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' -b --threads 2 --python-exit-code 1 --python assets-src/shinsekai/eval-building-a/hybrid/build-cloth-v2.py -- --sewn --hat-contact --rail-contact --haori-bending 0.6
```

Output `research-cache/upper-118-cloth-v2-sewn-rail-bend-0p6/upper-cloth-v2.glb`
is the source of runtime `upper-cloth-v2-sewn-rail.glb`. The same command without
the bending option preserves the separately reviewed bending2 control.

Before revision, the exported garment intersects the actual neighbouring timber
post164 triangle pairs and retained rail/pegs166 pairs. Post extent in authoring
metres: x0.18–0.30/y2.45–2.57/z3.461–5.854. These are measurements of invented
model geometry, not surveyed1912 construction. Initial pegs/hat-only collision
does not include that post or the two other pegs. A first full collider trial
cleared the post but increased peg crossings203; larger collision distance alone
still left163 and66 initial midsurface intersections. Both remain rejected/private.

Initial correction retains two exact pin positions. The right sleeve moves
forward max0.07m over Y2.37–2.43. The shoulder moves forward max0.065m, fading
from Z(peg centre−0.08) to(peg centre−0.02); both layers receive the field while
pins are excluded. The previous hat field(max0.12m) remains separate; do not sum
these maxima into a claimed measured garment displacement. Initial collider
midsurface intersections are now0. New collider:508 source rail/four-peg
triangles,252 retained hat triangles and10 bounded neighbouring post triangles.
Source hardware and post geometry are untouched. Collision distance2.4mm and
collision quality6 reduce final exported peg crossings10→0(quality2→6), with
post/hat0. Collider/body surface checks are discrete and omit chin cord,
containment, continuous contact, unbounded room geometry and mounting safety.

Official pinned references read from downloaded4.5 HTML after the web reader
failed402: [cloth shape](https://docs.blender.org/manual/en/4.5/physics/cloth/settings/shape.html),
[collisions](https://docs.blender.org/manual/en/4.5/physics/cloth/settings/collisions.html),
[physical properties](https://docs.blender.org/manual/en/4.5/physics/cloth/settings/physical_properties.html).
Pin weights constrain cloth; initial geometry normally supplies its rest state.
Object and cloth collision settings both matter; larger distance can produce
visible floating. Bending affects fold scale and requires actual visual comparison.
Our shared seam vertices are connected topology, not Blender sewing springs.

With corrected contact held fixed, bending2 and0.6 are directly inspected at
the same source-light haori close-up and upper-window context views. Bending0.2
passes topology/validator but reintroduces9 post/23 rail triangle pairs; rejected
before rendering, not an artistic pass. Retain0.6 as the optional contact
candidate: the right sleeve is in front of the post, shoulders remain fully in
the close frame, but broad planar sleeves and limited visible folds remain.
No further bending-only tuning is justified by these comparisons; inspect the
initial sleeve shape and hanging support arrangement next.

Other settings remain mass0.008/air damping5/tension60/compression60/shear40,
32frames/quality10,1.2mm thick body. Fixed pins move0, nearest retained head
distance0.600338mm. The0.043015m settled displacement is from the corrected
initial pattern; it is not comparable to the old hat-only initial pattern.
All2364 original hardware position/UV0/colour oriented triangles and root TRS
match exactly. Six closed fabric bodies, one connected haori;7456 replacement
triangles,149398/150000 active interior maximum; validator0errors/0warnings/14infos.
GLB3,473,404bytes, SHA256
`7240ebf2851bc40a80e5bb2fc95644b2c4f372a08935a597d8c04f730f0b0f30`.
Source garment placement/colour/mounting and all new parameters are artistic
inferences. No visual, historical, mechanical or qualified1080p approval.

Private numbered GLBs/receipts, exported neighbour audits and direct native
images are in `research-cache/upper-118-cloth-v2-sewn-rail*` and
`look-dev/haori-rail-118/`. The pre-correction baseline PNG was reloaded and
saved again with its prior exact SHA. Final backend lifecycle results are
recorded after both actually finish. No Claude review/model call is requested
during conservation; consult the initial-overlap and valid-GLB/poor-silhouette
lessons before the next pattern revision.

Both native backends now pass same-camera base/dream saves, far LOD2 with
interior/cloth/dream empty and no new console warnings/errors. Final0.6 cold
load/first-submit: WebGPU507.7/982.5ms, WebGL390.4/8056.4ms. No FPS claim.
Buffer1280×720; measured canvas CSS1534.21875×863, browser viewport1920×863.
Private Blender4.5.10 save/reopen preserves snapshot/source SHA,14objects/
10meshes/actions0, source unchanged; no full shader/animation/visual certificate.
The retained-candidate full build passes303/303. Two directly inspected cloth
trials(contact+bending0.6) bring total26/hybrid23; rejected0.2 and technical
contact iterations were not rendered and do not count. Next: initial sleeve
rest-shape comparison, with this source placement/pins/hardware/contact held.
