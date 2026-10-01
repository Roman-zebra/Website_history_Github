# Building A hybrid integration — Claude104/105

Current111 checkpoint: the later add-on integration below supersedes the round6
counts and pending upper-room ownership described in the historical sections.

Opus's sourced envelope and inferred floors/stair, with Sonnet's interior dressing adapted by Codex. The blind comparison was closed by Claude104; no competitor files were read before the Codex v1 submission. Claude's original entries/pilot are not merged wholesale. Frozen source scripts/notes in inputs are reproducible authoring dependencies, checked against the pushed branch1e2e773 with LF normalization per105.

Run Blender4.5 `--python-exit-code 1 --python assets-src/shinsekai/eval-building-a/hybrid/build.py`; `-- --no-render` exports only. Outputs are a source-only GLB and28 Eevee1280x720 review PNGs: axis,1.5m corner, ceiling, window wall and street-through-window for each storey, plus four hero close-ups at0.5–1m, repeated with separate dream staging. Render staging, dream colour/flowers/spheres, camera and sky/fill lights are excluded from GLB. This is not a published experience or a performance measurement.

Exterior19,671/1,142/112triangles, separate15m interior78,078triangles, collision240triangles; GLB15,268,084bytes before compression. Validator0errors/0warnings/522infos (unused attributes). Meshes carry UV0/UV1; normal-mapped parts carry exported tangents after explicit triangulation. CC0 photo textures named by the authors affect Blender renders only; GLB carries generated roof/glass maps, original micro-prop maps, constant PBR factors and vertex wear. Full texture binding, baked AO/lightmaps, meshopt/KTX2 and instancing remain open. Source-only LOD/cell connection is described below.

The two originals disagree on floors and windows. Opus floors0/.455/3.455m and two upper sashes are retained. Sonnet shop props move down0.50m; rear-room props fit into6.02..8.85m; upper props rebuild at3.455m. Duplicate tatami, incompatible kitchen, duplicate stair and four-window dressing are excluded. A centre post supports the otherwise floating Sonnet clock/coat. A source defect was repaired: rear upper boards/stripes covered the stairwell. They are split around5.10..5.82×6.35..8.27m. Ray tests check rendered floors, solid open-leaf aperture below flexible noren, all12 stair treads and three new15/15/15.5cm platform approach steps with≥1.8m headroom. New approach and under-stair storage cavity are explicit assumptions. The original coarse collision proxy has not yet been rebuilt; this is not a full capsule/walkability certificate.

Each exterior part carries sourceTags: S:OML158514(1912) visible massing/front/cornice/awning/signboard; S:OML157003/157013(1905 Osaka typology) windows/shopfront/roof; A:unseen side/rear/services. Every number, exact trim profile, hidden roof, colour and fictional mark remains an assumption. Interior layout, props, light and dream staging are A:invented period-plausible art direction; no historic floor plan was supplied. Sources are photo shapes, not copied image pixels. Signs retain Opus's fictional lettering; no people or real brands.

Five artistic rounds: Codex standalone1 (iter-001), hybrid setup+revision2/3 (iter-002), assembled counter/drawers4 (iter-003), andon/glazed jar5 (iter-004). Camera/edge/export repairs are not extra artistic rounds. Parent research-cache/look-dev stores before/after and critiques. Contact-sheet review still finds three gaps: cloudy glass hides the room from street; upper walls/floor lighting and old primitive stock remain sparse; dream flowers/spheres need finer shapes and distribution. No dreamcore/AAA parity claim. Claude107 now has a dedicated near1080p harness (1904×929); Codex's connected browser remains throttled, so the1920×1080/60fps gate remains open.

Original micro_props.py implements bevelled assembled counter panels/posts, slotted plate screws, hollow cash/stair drawers with rails/contents and bounded one-axis animation (28/24cm). The under-stair door has a physical cavity in the source structure. Oil-lamp base/frame/separate fibrous screens/reservoir/collar/wick and hollow glazed jar/foot/lip/lid/grip are separate parts. Generated maps use a0.5m UV repeat:1024 colour/roughness maps give2048px/m;2048 normal detail gives4096px/m. Varnish roughness~.27, brass.24, ceramic~.10, paper.9. Paper uses transmission; no real historic merchant/hardware/currency model is claimed. Current access screen is statically open105°, not a runtime hinge action. Wood grain is too regular; fingerprints/dust/warp/contact-shadow and all remaining stock still need work under106.

Timing is in run-record.json; buildSeconds is tool runtime, not total authoring/API cost. Next: runtime material/cell/animation validation and those visual gaps. Claude owns tower-base-upgrade under107; Codex does not duplicate that shell/ticket-hall work.

## Local runtime split and viewer (108, technical integration)

Add `-- --no-render --runtime-splits` to export runtime/exterior-lod0/1/2.glb and interior.glb, plus byte/hash/triangle manifest. Current split sizes3,511,908 /624,048 /454,748 /11,508,820bytes; validators0errors/0warnings,148/38/19/315infos respectively. Geometry counts match the combined source; the interior contains both original bounded drawer tracks and no exterior/collision proxy. Closed and24cm-open drawer rays retain guide contact at.650m; the apparent tilt in the prior camera is not a rotation in the asset.

`node scripts/serve-shinsekai-study.cjs`, then browser-study/building-a.html (`?webgl` forces fallback). Loopback server allows only these derivative files and camera metadata, not arbitrary eval/source folders. The page starts withLOD2 only, loads the room within15m, retains it to18m, disposes late/unloaded cells and chooses exterior LOD with hysteresis. Fixed source cameras, independent drawer controls and1280×720 PNG export are connected. Current glass tuning uses separate slightly wavy alpha glass (roughness.035 with dirtier edges); it stops casting an opaque shadow while its separate frame still casts. Actual optical refraction and distant parallax are pending. Source GLBs and the public site are not modified by that material toggle.

Browser lighting is a separate inferred study: warm directional light/cast shadows, hemisphere and original procedural PMREM studio reflections. Imported Blender review lights are scaled by.003 and bounded to8m (about.33–24.46candela). Unscaled source lights caused white clipping in the initial runtime view; calibrated output has been visually checked. There is no surveyed illuminance or sun ephemeris. Local reflection/planar floor treatment, AO/lightmaps and108 dream grade/wood variation remain pending. Runtime integration does not increment the artistic-round counter without its before/after critique. Claude108 owns upper-room dressing and era-specific dream objects/flowers; Codex owns glass, lighting/reflective floor, grade and material wear.

## Round6 /108 material and browser light pass

Round6 adds four bevelled storage-opening reveals, original bent grain/two knots/per-piece UV phases, stylised touch/dust roughness and0.8–1mm decorative panel twist. Drawer guides/contact faces stay straight; the existing rendered-geometry support/cavity/headroom tests pass. These are invented wear patterns, not a person's fingerprint or measured historical joinery. The third physical window layer is two folded translucent curtains behind the display glazing, with the actual room behind; the door and Claude-owned upper dressing stay clear. Two removable polished runner areas preserve the original doma/tatami underneath. Exported varnish roughness is the original~.27 map multiplied by.89 (~.24), within108's.15–.30 target.

Six artistic rounds total; before/after28 renders, unchanged subjective scores and three gaps are in parent research-cache/look-dev/iter-005. Blender renders still use authored cloudy glazing and earlier review lighting, so they do not demonstrate the runtime clear-window result or dream post-processing. Upper-room density and dream objects/flower abundance remain Claude's work.

The browser study has fixed1280×720 letterboxed rendering and matching PNG export, including a separate inferred floor inspection camera. A warmer36-degree directional study light, reduced hemisphere fill, and35%-resolution mip-blurred planar reflection show window-grid light/shadow and broad glazing reflections on the runner. This is a single-plane approximation, not SSR or a1920×1080 performance result. Far-cell disposal removes the reflector and all its targets. The optional dream grade uses an original16³ LUT: black.07/white.95, saturation*.85, attraction toward coral10°/teal185°; bloom strength.2/radius.6/threshold.7 (30% below1); grain±.02, reseeded at24Hz when drawing. Idle demand rendering remains stopped. No new dream props or copied video pixels are added.

Actual later-draw tests exposed r186 destroyed-framebuffer errors when physical transmission and the nested reflector were combined; GPU waiting and fixed sizing alone did not fix them. This browser derivative now uses explicitly approximate thin-sheet alpha for imported glass/paper/cloth while retaining authored transmission in the source GLB. Clear glazing remains a separate low-roughness alpha shader. Corrected WebGPU base/dream draw, both PNG exports and far-cell disposal have no new captured errors; receipts and images are in parent research-cache/look-dev/runtime-002. WebGL also verifies both independent drawers open1/1 and closed0/0, dream PNG saved, then empty/disabled after leaving. No new captured WebGL errors. WebGL cold interior CPU submission5,024.6ms at1280×720 versus later6–14ms submissions is not a GPU-frame or qualified performance result; earlier8,570ms was at1920×863, so no like-for-like speedup claim. Physical optical refraction, full baked AO/lightmaps, material texture binding and qualified High60fps remain open.

## 110 shader preparation experiment

The source viewer offers explicit `?precompile` (`?webgl&precompile` for WebGL) to compare queued `compileAsync` before rendering attached cells/LODs. It paints a preparation message and object progress, locks scene controls during preparation, pauses before starting hidden work and defers page-exit disposal until queued compilation finishes. Default remains the original path: preparation made total readiness longer. Canvas datasets separate GLB load/decode, compile history and the first whole-scene CPU submission with an attached interior; these are not GPU timings.

One sequential same-view WebGL1280×720 trial: control load/decode417.8ms and first submission2345.6ms; candidate276.4ms load/decode,8111.8ms interior compilation,883.2ms first submission. Driver cache was not cleared. WebGPU candidate413.1ms load/decode,1733.5ms compile and846.5ms first submission; no matched control, so no comparative speedup claim. Both complete73/73 jobs without new captured errors; prepared WebGL drawers reach1/1 then0/0 and leaving unloads the room. Parent receipt: look-dev/runtime-002/shader-preparation-110.json. First-frame driver work remains substantial, and native page hiding/pending-exit integration needs further observation. No qualified1080p/60fps claim.

## 111 upper-room add-on and separate dream delivery

Three frozen source files from claude/building-a-upper-dream e3dd4e7 are under
inputs/upper, verified against exact Git blob bytes. Source archive CRLF was
normalized to upstream LF without changing content. No upstream GLB, video
comparison frames, make-compare.py or render images are imported. A process-local
text-render basename prevents concurrent authoring from sharing the original
temporary PNG. All room/prop/layout/colour values remain A assumptions; electric
pendant, cylinder phonograph and rubber balloon retain unchecked-era dagger tags.

MERGE removes1,053 whole Sonnet upper faces (1,894 triangulated faces), retains
the floor/envelope/stair and adds41,586 base triangles. Upper lamp moves to
Blender(3,2.4,5.50), andon light to(5.15,1.15,3.95). Optional lantern light uses
the existing browser.003 gain. The4-triangle emissive sun-pool cards are omitted;
the browser's36-degree directional light and actual window grid provide shadows.

upper_portable.py fixes four roughness factors>1 by multiplying their own
Non-Color texture copies and clamping the resulting roughness; it does not
flatten the intended texture variation.1,116 invalid float colour components
are clamped. Authored triangulation and36 custom-normal meshes are preserved;
UV1 is packed and tangents are exported. Independent tests found non-orthogonal
MikkTSpace frames despite standard validator success. Gram-Schmidt fixes994
base and829 dream frames without changing normals/positions/UVs;12 parallel
dream frames use a stable fallback direction, not a claim of meaningful UV
orientation. All six generated GLBs validate0 errors/0 warnings.

Base interior117,770 triangles/25,846,956bytes. Separate dream33,494 triangles/
9,585,328bytes is fetched only when dream is enabled in a loaded room, retired
on disable/room exit, and late responses are released. The four flower nodes
total22,464 triangles; at most one impossible object is visible per specified
review view. Maximum active interior143,710 triangles stays below150k; loading
all dream objects simultaneously would exceed that budget. Unspecified hero/floor
views show flowers only. Production proximity/time staging remains pending.
The combined base-only study GLB is29,606,188bytes (<40MB local study limit),
above25MiB asset delivery size and excluded from Workers like all assets-src.
Runtime parts and hashes are in runtime/manifest.json; dream is a fifth part.

The runtime keeps the existing LUT/bloom/grain/reflection, with new geometry
independent from the colour toggle's rendering path. Only M_Glass exterior
glazing gets the clear-window replacement; opal shades and authored glassware
are preserved. New tests cover actual visible-node budgets, late-load retirement,
normal/tangent frames, vertex-colour range and UV1. Artistic-round counter stays6:
this is delivery/validation of Claude's completed arrangement. Flower atlas/
instances and stronger petal volume, cloth hem thickness/wrinkle detail, and
qualified1920×1080 performance remain subsequent Codex work.

Actual111 browser checks: WebGPU and WebGL2 both draw/capture base and dream
upper-axis1280×720, select phonograph then bed independently, and far-camera
retirement reaches interior/dream empty/LOD2 with drawers disabled. WebGPU also
selects the ceiling balloon alone. No new captured errors. Parent runtime-003
contains five verified PNGs and receipt.json (Chrome's same-name suffix files
were checked by timestamp before copying; WebGL is not the earlier WebGPU file).
WebGPU upper GLB load/decode850.3ms/first whole-scene CPU2072.1ms; WebGL699ms/
17190.8ms. These different-backend observations are not like-for-like performance
comparisons or GPU frame rates. Additional materials make cold readiness a
remaining problem; optional compileAsync remains opt-in. Visual self-review:
upper density improved, but lighting stays flat, cloth lacks edge thickness and
the chrysanthemum petals read as flat stars. No visual acceptance claimed.
## 111 runtime chrysanthemum candidate (Codex artistic round7)

`building-a.html?petals` selects the separate `runtime/dream-petals.glb`; `?webgl&petals` exercises the fallback. Claude116 accepted this blossom; it is now the default dream geometry. Use `?legacyflowers` for the111 comparison. `chrysanthemum-study.html` compares a ring silhouette proxy with the original procedural atlas candidate; the proxy does not reproduce the source's jitter, materials or stems.

All237 original flower matrices, palette values, pots, stems and RNG sequence are retained. Only16,116 blossom triangles are removed. Three curved rings of eight petals, three triangles each, plus an eight-triangle core give80tri per blossom:18,960 rendered triangles in two main colour-pass instance draws (shadow passes add draws). Four original128px alpha/relief tiles form a512×128 atlas; no photo/video pixels. Atlas raw arrays524,288bytes and instance/attribute/index arrays473,998bytes exclude mipmaps, driver allocation and download overhead. Instancing is not a claim of fewer rendered triangles.

Candidate GLB6,292,272bytes /17,378 retained dream triangles; maximum active interior146,554tri including one impossible object, below150k. Standard validator0errors/0warnings/63infos. Eight zero-length tangents required a stable fallback alongside the existing non-orthogonal frame repair;20fallbacks total, no precise UV direction claim at degenerate vertices. Rebuilding independently preserved all anchors and counts; UV packing/serialization are not byte reproducible.

Both actual1280×720 backends rendered/captured the upper-axis scene, with237blooms /5688petal instances; GPU dream-off and WebGL far-view release the dream scene. New captured console warnings/errors0. Captures: parent `research-cache/look-dev/flowers-111/upper-axis-petals-webgpu.png` and `upper-axis-petals-webgl.png`; baseline is `look-dev/runtime-003`. WebGL upper load/decode2578.4ms /first whole-scene CPU18,731.5ms, WebGPU1009.5ms /1893.4ms; these are unmatched readiness observations, not GPU FPS or performance improvement. Full build273/273 passes.

Self-review: curved petals and four profiles improve the coarse ring silhouette, but the flower still looks stylized in close-up, upper light is flat and cloth edges remain thin. This is an opt-in candidate for Claude's acceptance, not a completed look or qualified1080p gate. Shape, colour and placement are A: inferred creative detail. The generator changes only the optional derivative, never the frozen upstream source or normal runtime GLBs.

## Claude116/117 material revision

Accepted petals are default; cloth silhouettes remain optional and rejected under117. Mixed normal scales, inferred paper shadow attenuation, corrected glazing shadows and dream colour revision are implemented. `?ao` is a performance-unqualified indirect GTAO candidate. See `../../browser-study/shop-materials-116.md`. Under118 the simulated_v2 cloth shape work transfers to Codex during the twelve-hour economy window.

## Claude118 simulated cloth candidate (artistic round10)

`?clothv2` adds a separate simulated garment/bolt derivative with_v2 names, retaining source hardware and placement. All12 fabric/roll surfaces are closed, runtime attachment/capture/dream/far retirement works on both backends. Max active149770/150000. See `cloth-118-v2.md` and PROVENANCE.json. The preceding116 material/light pass is round9; total10/hybrid9, with review deferred during API conservation. Pin support, sleeve/collar seams and strong white sheen still need work; no acceptance claimed.
