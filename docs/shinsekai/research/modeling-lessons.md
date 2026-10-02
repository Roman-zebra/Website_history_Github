# Reusable modelling lessons from completed Shinsekai work

2026-10-01. Project-specific lessons extracted from our actual production records.
Read this before a related revision. Add a lesson after a failure is understood
and a fix is verified. Do not turn every successful run into a new requirement.

The user's follow-up requested reading [Vibe Modeling大全](https://note.com/its_kobataka/n/nc7cb65776c0f)
up to its paid-content boundary. Public chapters 1–3 and the exposed chapter 4
introduction were read. The restricted continuation was not accessed or bought.
The public advice to preserve successful procedures and reusable production
notes prompted this file; the technical entries below come from our own work.

| Trigger | Earlier failure and verified correction | Reuse next time | Local evidence / code |
|---|---|---|---|
| A material revision is invisible | Initial wall selection targeted interior props while the visible upper wall belonged to the outer shell. The PNG was unchanged. Corrected selection reached `M_Plaster_Int` / `UD_plaster`. | Inspect actual mesh/material assignments, then report changed material count and take a near/context pair before tuning strength. | `requests-to-claude.md` wallwear118 batch; private `research-cache/look-dev/wallwear-118/`; `assets-src/shinsekai/browser-study/shop-wall-wear.mjs` |
| Imported interior clips white | Source Blender light intensity did not match runtime staging. Explicit inferred runtime gain restored readability. Later daylight-only lamp balance kept window-grid shadows. | Record source/runtime light units and exposure. Establish a baseline before changing surface colour. Keep base/dream light settings explicit. | `eval-building-a/hybrid/README.md` runtime108 and later lighting notes; `browser-study/building-a.mjs`; private `window-light-118/` |
| Cloth collides despite enabled collision | Adding the hat collider alone increased final intersections from58 to474. Correcting initial overlap with pins fixed produced0 discrete exported surface intersections. | Check the initial pattern against colliders before increasing solver quality. Hold fabric settings fixed when comparing collider/initial-clearance changes. Verify the exported result. | `eval-building-a/hybrid/cloth-hat-contact-118.md`; `haori_sewn.py`; `build-cloth-v2.py`; private `cloth-hat-118/` |
| Valid GLB still looks wrong | A connected, closed garment still had collapsed sleeves. A near render exposed what topology validation could not. | Inspect silhouette and supports in fixed close/context images as well as running validator and mesh tests. Keep remaining visual defects explicit. | `eval-building-a/hybrid/cloth-118-sewn.md`, `cloth-118-v2.md`; private cloth comparisons |
| GLB import/export changes unrelated parts | Re-export changed vertex order, triangulation or colours; material/property edits can also exceed glTF ranges. Exact triangle/attribute preservation and portability adapters caught this. | For local repairs, preserve untouched attributes and clip bytes where possible. Validate output bounds/encoding; never infer losslessness from validator success. | `eval-building-a/hybrid/upper_portable.py`; lift118 and cinema115 production receipts |
| Reflective-floor capture fails | Physical transmission combined with nested reflection rendering caused destroyed-framebuffer errors. Fixed sizes and GPU waits alone did not solve it; the runtime study used an explicitly approximate thin-sheet alpha derivative. | Preserve source material and mark runtime approximations. Test reload, base/dream, save and disposal on WebGPU and WebGL after changing transparency. | `eval-building-a/hybrid/README.md` runtime002; private `runtime-002/`; `browser-study/building-a.mjs` |
| A detail is absent from a render | Counter handle was cut off and the andon view missed its target. Reframing exposed the authored details. | Confirm the defect is visible in the baseline. Correct the camera as a technical step, then freeze it before artistic comparison. | `requests-to-claude.md`106; `eval-building-a/hybrid/review-cameras.json`; private `iter-003/`, `iter-004/` |
| A floor connection appears aligned | Roof datum was aligned but the14cm front cage rail crossed the doorway. Actual upper surfaces and sampled rays isolated the obstruction. Removing only44 rail triangles reduced the doorway maximum adjacent step from114.499mm to23.100mm. | Measure rendered contact surfaces and intervening obstructions, not object origins. Retain explicit distinctions between doorway sampling and whole-route/capsule certification. | `requests-to-claude.md` lift118 batch; private `lift-threshold-118/` and doorway receipts |
| A fixed garment appears hidden by a post | Hat-only checks missed164 post/166 rail surface pairs. More colliders/distance alone left crossings; moving the initial shoulder in front of peg shafts cleared the initial mesh, and collision quality6 cleared final exported rail/post/hat pairs. Bending0.2 later reintroduced contacts despite passing topology/validator. | Inspect all actual neighbouring objects before tuning softness. Check initial rest shape, retain pins/hardware, then re-audit the exported result after changing even one cloth setting. The2.4mm/quality6 values are specific inferred settings for this candidate, not a general fabric recipe. | `hybrid/haori-rail-contact-118.md`; private `haori-baseline-neighbours.json`, `upper-118-cloth-v2-sewn-rail*`, `look-dev/haori-rail-118/` |

| Cloth export drifts outside the revised garment | Raw0.035 control reproduced the garment exactly but unrelated normals/tangents differed by up to0.000290275. Narrow retention restored the original asset byte-for-byte; no approximation was applied. | Reject unrelated positions/UVs/colour/material/transforms. Preserve original non-target binary bytes and discard only bounded transport drift; call it restored control, not raw determinism. Re-exported split counts can differ without changing closed-body connectivity. | `hybrid/haori-sleeve-rest-118.md`; `scripts/shinsekai-glb-retain-cloth.cjs`; four retention tests; private sleeve-rest receipt |
| An initially clear pattern settles through hardware | Sleeve-drop0.09/0.14 both began with0 collider pairs but ended with rail/hat326/439 and wall40/122 pairs. Both passed validator and connected/closed topology. Existing0.035 retained. | Check exported neighbours before native rendering. Stop this failed parameter family; inspect supported shoulder/armhole construction rather than counting invalid trials as art progress. | `hybrid/haori-sleeve-rest-118.md`; private `upper-118-cloth-v2-sewn-rail-bend-0p6-sleeve-*` |

## How to use the notes

Choose the applicable row when writing a round brief. State the suspected cause,
the evidence that would distinguish it, and one concrete revision. Link the
matching code and receipt. Preserve failures as rejected candidates rather than
silently overwriting the baseline. After verification, record which values are
reusable and which are only inferred settings for that asset.

Use the existing `workflow/round-template.json` and current Claude batch. This
does not authorize extra agents, periodic reviews, paid mesh generation or
changes to the user-approved division of work.

## Scene save/reopen verification

`assets-src/shinsekai/workflow/verify-scene-reopen.py` imports an uncompressed
authoring GLB into a private Blender scene, saves a `.blend`, opens it again,
and compares persistence snapshots. It also rehashes the source GLB to confirm
the source was not changed. Pass a fresh private output directory; nothing in
the source model or production renderer is edited.

This checks whether the imported working scene survives save/reopen. It does
not certify lossless GLB import/re-export, full shader node or keyframe semantics,
visual quality, history, collision safety or performance. For browser-only
shader changes use source/page reload and actual rendering instead.

Command from `repo/`:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' -b --threads 2 --python-exit-code 1 --python assets-src/shinsekai/workflow/verify-scene-reopen.py -- --input assets-src/shinsekai/eval-building-a/hybrid/runtime/upper-cloth-v2-sewn-hat.glb --out-dir ../research-cache/scene-reopen-20261001-clothhat
```

Results are reported in the private output directory's `receipt.json`, with
`before.json`, `after.json` and the saved `.blend`. Record actual pass/fail
results after running; the example alone is not evidence of completion.

### Verified on 2026-10-01, Blender4.5.10 LTS

| Input | Saved/reopened snapshot | Objects / meshes | Actions present | Private receipt |
|---|---|---|---|---|
| `runtime/upper-cloth-v2-sewn-hat.glb` | Equal; source SHA unchanged |14 /10 |0 | `research-cache/scene-reopen-20261001-clothhat/receipt.json` |
| `runtime/interior.glb` | Equal; source SHA unchanged |189 /168 |2 | `research-cache/scene-reopen-20261001-building-a/receipt.json` |

Inputs are under `assets-src/shinsekai/eval-building-a/hybrid/`.
Source SHA256: cloth/hat `e3da5405d002a9bfc25e4a0e0ac217558c1ea944458aa0370668ebe0179d69a2`;
interior `a5c102f5c499eaca29a6dede27b5bf419c8296e1752ec1c88af281dee43bd935`.
Action presence and assignment are checked, but keyframe-value equivalence is
outside this audit. The private saved scenes can be opened for continued work;
production GLBs and the active renderer were not modified by these checks.

## Hall AO preparation003 (2026-10-02, unapproved)
The beauty-only pass isolated a normal/dream alpha regression without AO.
Opaque AO preparation plus direct main rendering now restores dream PNGs exactly
on both backends, but constantAO1 normal controls still match the failed beauty
images. Restored public RT/MRT/context/tone/alpha material fields do not establish
that the rendered result or private renderer caches are correct. Always compare
a null effect through the same route with source near/context, and verify dream
and re-entry separately. Next remove the preparatory RenderPipeline global tone/
colour switch using explicit QuadMesh/NodeMaterial while holding the effect and
main draw fixed; the proposed change remains unverified. Evidence: parent
research-cache/hall-ao-119-003/native-receipt.json; browser-study/hall-ao-direct-
claude119.md. Do not adopt this candidate or diagnose a particular private cache
from the PNG bounds alone. AO contact is weak and dark speckles remain.

## Hall material AO006 (2026-10-02, fidelity gate passed; look unfinished)
AO004 removed RenderPipeline from preparation but kept the failed constantAO1
near result. AO005 then isolated global main context from opaque preparation.
On both backends, preparation-only near/context exactly matched source;
context-only without preparation reproduced the glass regression. Thus the
earlier RenderPipeline-sufficiency inference was incorrect. Do not change vendor
cache internals based on equal public state or these image bounds.
AO006 keeps global renderer context original and uses independent opaque hall
material copies during the main draw only. Alpha materials/maps/geometry remain
original; try/finally restores exact assignment references, including arrays.
Four null-control near/context native PNGs exactly match original images on
WebGPU and WebGL2. Ownership, source-alias rejection, lossy-copy/failure cleanup
and render-throw restoration have meaningful tests; full build346/346.
This qualifies the source-null route, not the final contact shading or phone
performance. Actual AO still has weak feet contacts/small dark speckles and
unoccluded global interior fill. Keep maps/AA and scope later tuning separately.
Evidence: parent research-cache/hall-ao-119-005/differences.json and
hall-ao-119-006/differences.json; workflow/hall-ao-119-006-brief.json.

## Hall AO denoise007 (2026-10-02, optional; contacts unfinished)
Filter the AO buffer with depth/normal similarity; never denoise the source
beauty image to hide speckles. Existing r186 DenoiseNode can be prepared in an
owned half-resolution red target and sampled by006 opaque material copies.
Source-null four near/context PNGs remain exactly equal on both backends.
The source package includes DenoiseNode/SimplexNoise even when our selected
vendor subset does not: verify existing npm archive and byte-identical copies,
record provenance, then explicitly reload after a failed module import. Do not
restart a healthy server or add a tool installation for this missing-file case.
Use public deterministic noiseNode and dispose its owned texture separately from
the filter's default noise. Seeded noise does not guarantee bit-exact rendered
output: GPU re-entry differs1pixel/max1; preserve and report that result.
AO speckles are reduced, but foot/counter/shelf contact remains weak because
direct global sun3 is still unshadowed. Extra filtering costs16samples/pixel;
similar renderer counters do not demonstrate free GPU work or phone acceptance.
Next inspect pinned public shadow APIs and add actual geometric occlusion with
scoped/restorable geometry/light/shadow state. Keep maps/AA/glass/cameras fixed.
Evidence: parent research-cache/hall-ao-119-007/differences.json,
vendor-receipt.json and floor-residual-statistics.json; hall-denoise-claude119.md.

## Hall shadow008 fidelity rejection and finite range003 (2026-10-02)
An independently cloned shadow light, original light with owned shadow, preserved
alpha flags, consistent preparation/main shadow state and split opaque/alpha
passes all fail the no-shadow glass fidelity comparison. Retain seven technical
PNGs and changed code privately; do not call null controls artistic trials or
adopt an unqualified route because ownership tests pass. Exact private renderer
cache mechanism remains unproven. Initial348/private final349 tests pass, but
public shadow helper/routes are removed and qualified007 source is restored.

Continue useful120 work with existing PointLight.distance:0 preserves exact
source range; optional4/5/6m modifies only local reach. Keep decay2, intensity,
RGB/emission/maps/AA and restore each original distance, including nonuniform
ones, before cache re-entry. Validate failure before mutation and disposal twice.
Finite range reduces remote specular glow, but global unshadowed sun3/hemi1.2
still keep the hall flat. Do not claim finite range fixes contacts/beam shadows.
Next isolate global interior fill with fixed near/context/floor and null control,
without changing shadow/cache state, then revisit a changed geometric route.
Evidence: parent hall-shadow-119-008 and hall-range-119-003; browser-study
hall-shadow-claude119.md / hall-range-claude119.md. No new tool or TRIPO use.

## Hall original-light fill009 (2026-10-02, partial)
Changing only the original directional intensity uniform during synchronous
normal hall renders passes four gain1 native source-null controls on both
backends. Restore each frame's borrowed intensity in finally, including failure;
never clone the light or toggle shadow/cache/global context for this diagnostic.
Gain.1 darkens beam gaps and depth while preserving near maps/AA/glass. Both
dream source and candidate re-entry images are exact; fourteen native PNGs and
349 tests retained. Contact shading still needs work: a darker image does not
prove geometric occlusion, and unchanged counters do not qualify phone cost.
Read-only merged material bounds locate floorY.003 and bench iron/desk teak
minima0. They do not identify every support; audit components/nearest floor
triangles before snapping geometry or baking contact AO. No blanket offset.
Evidence: parent hall-fill-119-009; browser-study/hall-fill-claude119.md.

## Hall static floor contact010 (2026-10-02, optional retained candidate)
Before moving apparently floating furniture, inspect decoded world geometry and
floor triangle coverage. Thirteen floor-near material components have minima
3–4.91mm below the floor. This does not identify every support, but it rejects
a blanket downward offset. Bake actual frozen geometry AO to a planar receiver
with Blender4.5 Cycles AO-node distance.45/OnlyLocal false/Emit target, preserving
browser UV0/maps/geometry. Hide only the coincident source receiver; its ceiling
is4.444m away and irrelevant to the local radius.512x2048 data map preserves
source near detail and anchors feet/cabinet/wall floor contact with gain.8.
This adds one texture/~5.33MiB with mips; existing AO007 still costs multipass
work. Do not claim moving-light shadows, free GPU cost or phone qualification.

Gain0 should return the original floor colour node instead of multiplying a
sampled texture by zero. Initial GLcontext5pixels/max1 is retained. Current four
nulls exactly match matching source; fresh GLnear has the same3pixels/max1
historical residual as disabled candidate after equal view order. Do not infer
a private compiler/cache cause, hide that residual or claim historical bitwise
equality for all views. Actual near/context changes stay confined to visible
floor; both dream source and candidate re-entry are exact, far map retired.
Use explicit UTF8 for Python text reads/writes on Windows and normalize decoded
CRLF before writing; system CP932 can fail or damage Unicode state files. JSON
requires leading zero for fractional numeric literals. The first integration
failed before editing and the brief/state were corrected before351-test build.
Evidence: parent hall-contact-119-010/native-receipt.json and bake-receipt.json;
browser-study/hall-contact-claude119.md. Continue haori/upper4, not full119 review.


## Visible support needs a geometric and a native check -2026-10-02
119 haori001 connected bamboo-supported construction cleared bar/hardware, but
two new cords crossed cloth30/32 exported pairs.002 cords moved to exposed bar
ends and original peg surface anchors(0distance), clearing all exported neighbour
pairs; native fixed front/side still hid the short cords behind the shoulder.
003 lowered settled cloth/bar80mm and lengthened cords, preserving gravity-relative
shape without claiming a new simulation. Re-audit changed neighbours before native
rendering. Both complete front/side backends now expose bar/cords and sleeve sag.
Save original cramped views and qualify fixed full-garment views before claiming
visibility. Sag27.5/28.2% and collar projection8.2-9.7mm are measured; rest22mm
fold seed is not proof of final local creases. Whole-row41-57mm range includes
macro deformation; measure individual folds separately. Source maps/materials
and unrelated binary are exact; no new texture/AA reduction.353tests/reopen0/0
validator, both reentry exact. GLcontext14pixelsmax1 retained without cause claim.
Evidence: workflow/haori-support-119-001/003-brief.json, browser-study/haori-support-
claude119.md and parent research-cache/haori-support-119-001/002/003. WallAO, final
sheen/local crease/hem, upper4 and full119 remain unfinished.


## Bound AO casters and freeze existing animated grain for comparison —2026-10-02
Wall119 receiver is exterior sideL atBlenderX.18, not the interior shell. An
interior-lifetime shader must restore cached exterior assignments before map
and material disposal. Exact null gain bypasses copying; temporary dream
restoration plus glass array reconciliation are tested.005 combined coat-root
hardware gives a broad AO halo/stripe;006 excludes that original combined
pegboard/hat, retaining unchanged garment/support. Finite radius.55/32samples/
Cycles16/seed119005, noncolour512x512 map90058bytes. Additional~1.33MiB with
mips is a cost, not phone qualification. Blender Object wrappers become invalid
after reopen: snapshot caster names before it; preserve completed PNG/blend
and recover receipt only instead of rebaking after a serialization failure.
Read saved state before retrying any capture observer timeout or navigating.

Timed dream grain.04 changes PNGs even for consecutive source captures. Wait
for loaded dream geometry and use explicit reviewtime0 only for repeatable
comparison. Both backend dream controls nowexact, defaults remain timed.
Four source-null views exact; GPUreentry exact/GL6pixelsmax1 residual retained
without guessed cause. Native image changes alone do not prove better art;
006 is optional, frontal wall contact subtle and full119 remains unfinished.
004 custom local crest audit gives three complete back crests11.3–23.0mm, but
boundary brackets/coarse90.1mm sampling limit final count acceptance. Hem
inward projection includes taper. Do not promote seeded values to proof.


## Full footprint and actual art qualify a cushion —2026-10-02
Frozen Sonnet zabuton is one cushion with two disconnected open grids/four
corner blocks. It is above wooden floor, not tatami; source component inventory
alone gave misleading interpretation. Close/source hash tests are not placement
approval. Five central rays miss the fusuma-edge crossing; qualify every full
triangle contact by material + world normal + exact floor height, not just a
structural-node whitelist.001 has real68wall/frame contacts;002 moves165mm and
reduces them to20wood-floor-only contacts. Audit SAME merged mesh neighbours
(writing-table legs) as well as other objects. Preserve rejected numbered output.

003 filled80mm/40-43mm seam is closed/reopened/0-0validator and source data exact,
but native dark straight outline still reads as a board. Numeric positive volume
does not prove fabric art. Keep rounded outline/weave qualification pending;
two attempted profiles remain for next occasional milestone review without
additional agents/review calls. Full359tests, both actual near/side/context saved,
source/candidate GLshelf bands are an existing quality issue. A far select value
before rAF is not released residency: wait for actual LOD2 and empty interior/
cloth/dream before claiming reentry. First unsettled GPUreturn PNG diagnostic
retained; correct GPUreentry exact, GL12pixels/max1 residual recorded.20PNGs
including7reused controls/two fresh sourceGL/one diagnostic. Source binary prefix
retention adds147,712bytes, not mobile savings;48tri/0maps/0draws, TRIPO0.
Evidence: browser-study/upper-cushion-claude119.md, workflow003 brief/verifier,
parent upper-cushion-119-001/002/003 receipts. Continue119 upper4 and existing
haori/hall/integrated1080p limitations, not full119 or iPhone approval.

## Verify actual GLTF hierarchy before increasing invisible normals —2026-10-02
Tatami001 initially cloned0 materials despite a passing Mesh-only fixture:
multi-primitive GLTFLoader creates the named structure as a Group. Retain that
diagnostic, select descendants of the exact root, test matching Group hierarchy,
and reject gain1 empty binding. Technical repair is not an art parameter trial.
Read actual normal/UV/material/top coordinates before a mask; source floor
contains both levels. Filter each procedural frequency with unconditional UV
derivatives; do not reduce near AA/maps to hide aliasing. Declare macro camera
diagnostic and compare BOTHsource/candidate there before increasing amplitude.
Fine close rows/contextmax1 retain optional study, not art/historical/phone or
motion-shimmer acceptance. Actualfar releasecopy1+original1 verified, GPUreentry
exact/GL9pixelsmax1 residual not guessed.23freshPNGs/361tests; sourceaudit helper
hash is explicitly initial, qualified hash retained separately. SourceGPUdream
capture failed once, healthy loaded state retry saved without restart. No scene
editing/export invented for a browser-only shader. Evidence:tatami-claude119.md.

## Preserve qualified controls explicitly and distinguish observation deadlines —2026-10-02
Heri001 reused8tatami001 frames only with exact source/cushion/shader hashes,
samecamera/light/AA/flags/reviewtime0 and gain0nocopy tests. FreshsourceGPUcontext
matchesexact; GLresidual recorded, source macros fresh. Preserve reuse ledger,
not a false fresh-capture claim. Metric box-face UV verified rather than assumed.
Normal-only upper fabric at original dark colour/roughness.9 keeps30mmgeometry.
View actual macro before increasing amplitude; ordinary distance almost unchanged
by declared frequency filter. No art/historical/motion/mobile approval from PNG
changes/tests. Browser waits may enforce shorter observation deadlines; GPU
capture and GL first-render observations expired but actual samehandle later
saved/loaded. No restart on timeout; confirm captureabsent before clicking again.
Persist captureError because resumed draw overwrites status and hides failure
reason. SourceGPUfirstsavefailed, healthyretry recorded/causeunknown; no guessed
failure.363tests and actualfar1copy+1originaldisposed. ExistingGLshelf bands must
be isolated before further wall/light qualification. Evidence:heri-claude119.md.

## Inspect near-coplanar dressing before weakening light or wood detail —2026-10-02
Cabinet ink001 found four full black gap boxes covering wood drawer fronts,
only0.95micrometres apart. Actual GTAOoff and sunshadowoff GL frames retained
bands; source geometry and authoring script then identified the overlap.
Translate complete closed gap components4mm behind the3mm bevel, rather than
remove all ink or reduce normals/AO/shadows. Both actual native source/candidate
near views clear interference and retain woodgrain. All other attributes,
materials, JSON and full binary prefix exact; meaningful tests and independent
Blender import/closed topology/outside contacts/save-reopen/validator0-0 verify
scope. Append-only8640POSITION/8904GLB bytes are not savings.18PNGs includes6
explicit reused controls. Both reentry exact/groundGPUexact/GL14pixmax1;
dream postprocessing spreads image differences beyond edited drawer. No
history/art/motion/device or full119 acceptance. PlannedGPUshadowoff explicitly
superseded/unperformed. A saved capture dataset can belong to a prior view:
after an observer timeout check whether click actually happened, reject stale
downloads, then capture once ready. ActualGPUwait failure reason now survives
status redraw; healthy same-action retry saved, no restart or guessed cause.
Evidence:browser-study/cabinet-claude119.md and private cabinet-ink-119-001.

## Resolve front folds across their curvature, then view the whole body —2026-10-02
Correct the earlier sampling shorthand:90mm is the back central gap; original
front intervals are31.1–33.6mm.007's four22mm measured midbody crests did not
make its upper half read as hanging cloth.008 extends those crests below the
shoulder while refining only horizontal edges:3212 garment triangles versus
007's5780, without a phone performance claim. Preserve original pins, sleeves,
collar, back, hem, support attributes and source UV/colour. Added geometry is
an inferred post-settlement correction, not a new simulation or art acceptance.

BMesh layer creation/subdivision can invalidate old BMVert wrappers. Snapshot
source coordinates/IDs and remap fresh vertices after the operation; retain
technical failures instead of silently restarting. Transition ngons prevented
Mikk tangents; triangulating only those ngons preserved positions/triangle count
and exported validator0/0. An UD-only repair helper does not repair this garment.
Independent closed shell/neighbours/save-reopen and source-retention checks
remain necessary even when four numeric peaks pass.

Actual full-feature daylight frames were too dark to judge007. AOoff alone
stayed dark; original-source lighting exposed folds. Treat that as a lighting
profile diagnostic, not evidence of a particular light's cause. Fresh matched
source/candidate cameras/light/AA/time are required for geometry comparison;
the readable diagnostic cannot qualify combined daylight/AO art. Do not reuse
006's old contact bake on altered geometry. Evidence:haori-frontfold-claude119.md
and private007/008 retained briefs/technical scripts/scenes/native frames.

## Isolate a retained lamp after a failed global fill —2026-10-02
Global environment0.14->0.35 brightened the room but left008 cloth unreadable
in both actual front pairs; remove that trial rather than stack it into a new
comparison. The original sun has directionX0, daylightXnegative, neither
directly illuminates an ideal planarpositiveX front. Actual light-node world
transforms need real Quaternion instances: a plain object produced invalid
NaN/null values in technicalr1; finite-transform assertions exposed it.
Existing upper lamp is2.802m from declared garment target and remains within
its4.5m cutoff. Restoring only its daytime gain0.3->1 improved both front
views while retaining geometry/maps/AA and all other lamps. This is inferred
art balance, not physical occlusion, source irradiance or historic calibration.
Source intensity snapshots avoid compounding across repeated apply calls;
missing/duplicate exact target names must reject before any mutation.

Native view coverage is still partial:13fresh frames and GPUfar/exactreentry,
not all backend/view pairs. Capture failure, observer deadline and replacement
tab binding failure are distinct; inspect actual saved result and fresh download.
Do not adopt an old saved state after changing viewpoint, infer a hardware cause,
kill the browser, or declare qualification because a front pair improved.
Contact009 uses008 geometry with retained006 finiteAO bake settings and real
save/reopen equality; old006 cannot serve changed geometry. New map preparation
alone is not native contact acceptance. Evidence:haori-light-claude119.md,
workflow lighting001/contact009 briefs and private native/bake receipts.

## Pair baked contacts with the geometry they actually used —2026-10-02
009 is008's bake,006 is003's bake. Reject incompatible nonzero pairs before
asset loading; a filename or matching512 resolution does not prove correct
geometry. Retain the old null diagnostic and optional defaultoff behaviour.
Explicitly allowlist the new PNG without exposing its blend/receipt/cache tree.
Exact HTTP hashes/HEAD lengths and ownership tests validate routing/lifetime,
not native visual acceptance.369 tests pass; all009 native views remain pending.

In this CUA session an inherited helper kept naming old2855 after an apparent
active-tab variable reassignment. Pass the current tab as an explicit function
argument rather than rely on that helper closure. Separately, direct current
AX/DOM reported Debugger unattached and binding timed out. Do not call all
failures a stale helper, guess a GPU cause, restart the browser, or adopt an
unconfirmed PNG. Ask for visible user status while pursuing independent work.
Evidence:haori-contact-claude119.md and private009-runtime001 receipts.

The user cannot inspect Chrome now. Proceed with independent source audits and
offline asset preparation; retain every native gate, rather than wait without
progress or treat the unavailable user observation as approval.
