# Cinema preparation candidate 067

This is the source handoff for engine revision K and capture observers N/R/S of the protected hall cinema preparation experiment. The six engine modules retain the exact bytes verified in the scoped WebGPU and WebGL2 native review. The review used Codex In-app Browser; external Chrome and physical devices are unqualified. This candidate adds no production callers. The site build runs its CPU checks and excludes this scripts package from copied static assets.

The fixed Three.js r186 renderer queues material sides for each transparent pass. The patch carries the captured side through asynchronous node preparation for `cinema__projector_7`, restoring material side and renderer preparation state in `finally`. Other node inputs retain their original behavior. The queue and pipeline preparation changes are exactly reversible.

## Reproduce the CPU checks

From the repository root, run:

```sh
node --test tests/shinsekai-cinema-preparation.test.cjs
```

The checks cover the exact vendor and compiled queue/loop formats, 56 side/restoration cases, original return/promise/error identity, bounded observation, inherited property restoration, reload generations, late projector observation, diagnostic compaction, and six objects whose first visible draws occur in different callbacks. The prior revision I fixture must fail that last regression. Backend and object factories in these tests are synthetic. They do not establish native cache reuse or frame rate.

`provenance.json` pins the six engine modules, existing vendor, historical H and I observers, compiled renderer fragments, and the capture-only observer/original capture fragments. The fragment file preserves only the original queue method and compilation tail; it is not a standalone renderer. Its source offsets/hash identify the original compiled input, which is not distributed here. Three.js fragments retain the MIT license in `fixtures/THREE-LICENSE.txt`.

To create a separate patched vendor copy:

```sh
node scripts/shinsekai/cinema-preparation-067/patch-fixed-renderer.mjs vendor/three-r186/build/three.webgpu.js /path/to/new-three.webgpu.js
```

The command rejects a different input hash, identical input/output paths, and an existing output file. Do not substitute an unpinned Three.js release.

## Integration contract

Use `observeCompile067(renderer, scene, camera, {owner: 'cinema'}, () => renderer.compileAsync(scene, camera))` around the existing compile call after renderer initialization. Preserve the returned promise and the original room lifecycle. Admission requires `cell_cinema`, the fixed projector, and all six named double-pass objects. Unknown transparent double-pass objects retain their original frustum behavior. Temporary admission restores original own/inherited descriptors before awaiting; normal draw culling is unchanged.

Keep the original simulation and UI callbacks running. Gate GPU submission with `shouldSubmitScheduledDraw067()` while preparation is pending. Call `requirePreparedCapture067()` before capture. No replacement frames are scheduled. The targeted material side remains set across asynchronous node preparation, so concurrent compilation or rendering is unqualified.

Retain and drain the existing pending compile promise before releasing models or disposing the renderer. Restore observer ownership with `restoreResourcePreparation067(renderer)` after the drain. The package does not add a disposal or lifecycle replacement. The optional parent preparation notification is the existing QA hook; it does not prove a production integration.

## Native evidence and remaining gates

Revision I was checked in Codex In-app Browser on actual WebGL2 and WebGPU: initial load, same-document cinema reload, normal exit, and exit during pending preparation. Initial/reload preparation was approximately 8.1/6.5 ms on WebGL2 and 8.1/6.0 ms on WebGPU, with zero new pipeline calls observed in the specified first-ready callbacks. The late WebGPU projector callback was observed separately at 3.5 ms with zero new pipeline/program calls. Initial and late callbacks must not be conflated.

The two fixed rear images matched exactly on WebGPU; WebGL2 differed at 25 pixels by at most one channel level. Revision I's first WebGPU reload draw exposed five of the six tracked objects; broader six-object coverage belongs to the preceding H evidence. H's parent receipt overflow remains a recorded failed case. I removes duplicate shader diagnostics while retaining the full pipeline-after hashes, within the unchanged receipt ceiling.

The complete native receipts, images, failures, and input manifest remain in the internal evidence archive. These observations do not establish controlled performance improvement, GPU completion timing, HD 60 FPS, mobile acceptance, art/rights acceptance, payment protection, or whole-city completion. Mainline adoption requires its own integration and acceptance evidence.

The revision K observer records the first scheduled draw for each eligible object name, bounded to32 names and32 rows per phase. It clears these records per cinema generation and keeps the first-ready and first-projector metrics separate. It makes no additional render or compile calls. Native reload evidence retains all six double-pass objects across six different callbacks; normal and pending-compile closure passed in both backends. These observations do not establish frame rate, controlled visual parity, physical-device performance, or production acceptance.


## Fixed PNG capture observations

The separate N observer samples immutable primitive camera pose/quaternion, near/far and projection/world matrices, complete bounded light state, scene/render settings and canvas resolution immediately after each original PNG render. It traverses only at capture, caps16384 nodes/64 lights/160-character names, reports incomplete critical fields or truncation, retains no scene/renderer owners and changes no camera/light/movement. Callbacks, native toBlob results and errors retain their original behavior. The CPU check also applies and exactly reverses the two capture seams in pinned original compiled capture fragments.

Use patchCaptureControlN067(source,[originalCaptureRenderAnchor,nativeCaptureRenderAnchor]) only on the exact candidate capture paths. The result adds numerical receipt data after the existing capture render; it schedules no frame or compile. The fragment fixture contains only the two original capture methods, not an executable runtime or the protected model assets.

The existing private QA PNG handler may call saveCaptureControlPNG_N067(result,{sessionID,backend,nativeFetch}) after a successful PNG upload. It saves a small separate receipt through the existing private /api/__qa/receipt collector, binding the numeric record to the actual blob SHA256. Upload failures are reported without changing the original capture result. Neither this synthetic collector nor any protected issuer/worker/keys is added to the public site. The128000-character collector ceiling is unchanged; native capture records were approximately45KB, separate from the detailed source receipt.

N compared independent frozen066 and K rear captures on both actual backends. All464 shared model/vendor/protocol inputs match; all482 candidate inputs were pinned. Camera/light/projection/canvas/renderer/scene numbers match exactly within each backend. WebGPU PNG bytes and all2073600 pixels match exactly. WebGL2 differs at20 pixels by at most1 channel level. Different backend projection matrices are retained separately. No visual acceptance tolerance was invented. Both candidate images were inspected; all4 captures ended with zero resources, original backend retirement and trusted native pagehide. Both private runtimes/tabs were closed and console warn/error lists were empty.

These are fixed rear-view observations only. Cross-backend pixel differences, repeated/forward/close views, abrupt detach, physical devices,60FPS, art/rights, production integration and the full city remain unqualified. No capture observation or synthetic factory test establishes those gates. Internal PNGs/native receipts are referenced by hashes in provenance and are not published in this source package.


## R draw-state observations

`capture-draw-state-R067.mjs` reads primitive visible/layer-eligible mesh transforms, geometry attribute/index/group/drawRange counts and versions, selected material scalars/colors/flags and texture metadata after each original PNG render. No scene methods, model/renderer mutation, hot-frame hook, extra draw or compile, UUID equality, geometry/source pixel copying or retained owners. Actual draw-list, shader/uniform completeness and geometry buffer-byte equality remain unqualified. Unknown critical fields, custom shaders/skeletons, getter failures, cycles or limits return incomplete evidence.

The snapshot is deeply frozen and attached non-enumerably to this capture receipt only; a small summary remains serializable. After the unchanged original PNG upload, standalone private receipt parts stay below120000 characters/bytes and an index binds ordered part hashes, reconstructed snapshot SHA256 and actualPNG SHA256. A1MiB snapshot and64part ceiling fail closed. Collector128000 ceiling stays unchanged. Upload failures preserve originalPNG results. Synthetic CPU checks cover actual owner garbage collection, immutability/nonmutation, bounded malformed states, multipartUnicode/hash reconstruction and exact reversibility of the two frozen capture seams including promise/blob/error behavior. Native backend evidence is a separate next gate.

The scoped R native review captured twelve distinct PNG/state pairs (rear repeats and a forward original walking route, candidate and baseline, each backend). All recorded N numeric inputs matched except the disclosed source frame counters. All recorded R fields matched in WebGL2, but PNG comparisons differed at15–38 pixels with maximum channel difference1; the cause and an acceptance tolerance remain unqualified. WebGPU PNGs matched exactly while25 index array types differed: candidate Uint32Array, baseline Uint16Array. All other recorded R fields matched. The pinned vendor contains an index-widening path, but index values and the causal path have not yet been compared. Do not claim full geometry equality from these observations. Four original-close/trusted-pagehide cases released the measured resources; external Chrome, physical devices, actual draw lists, full shader state and60FPS remain unqualified. The immutable private native metrics hash is recorded in provenance; the next scoped audit compares bounded index bytes and explicit numeric values.

## Bounded index values (S)

`capture-index-state-S067.mjs` copies eligible mesh index arrays immediately after the two original PNG renders, without changing source geometry or invoking scene/renderer methods. Attribute identities deduplicate copies only within one capture. The private copied bytes retain no source owners. Limits bound nodes, meshes, attributes, counts,16MiB per capture,32MiB across pending results and16 pending records. After the original PNG upload, async SHA256 records raw width/byte order and explicit Uint32 little-endian numeric values. Values0xffff and0xffffffff remain distinct; counts/min/max/sentinel counts are disclosed. Copied bytes are released after digest, including failures, and abandoned capture records are weakly held. Original PNG/promise/error behavior and upload limits remain unchanged. This observes index values only; all other geometry bytes, actual draw lists, shader/texture state and visual/device acceptance remain unqualified.

The S scoped native review captured eight distinct candidate/baseline rear/forward PNG/index-state pairs in Codex In-app Browser. All319 eligible indexed mesh numeric digests match within each backend. The25 WebGPU width differences share21 attributes/7500 values; raw copies increase15000bytes and sentinel counts do not change. WebGL2 raw index bytes match. Selected N inputs match except frame counters, and R differences remain the25 WebGPU index types. WebGPU rear has one differing pixel at(1781,112), maximum channel difference15; forward pixels match. WebGL2 rear/forward differ at30/16 pixels, maximum1. These observations qualify the recorded index values only; the pixel cause, other geometry/shader/texture state and full visual acceptance remain unqualified. Four original-close/pagehide releases and both owned server disposals passed. Native metrics are hash-pinned in provenance; raw private evidence is kept separately.

## Abrupt pagehide observation and diagnostic copy repair (T)

The QA-only surviving parent removes the original iframe through an ordinary button without calling gate/source/lease close or the original end button. Its bounded controller requires trusted native pagehide and strict release observations, preserves the same pending record on timeout, and uses weak identities for reuse checks. Parent patching corrects the expected build identifier to the explicitly frozen original source and proves exact reversibility. The controller remains unqualified for complete native lifecycle/reopen.

Direct native iframe removal exposed a real failure: the backend diagnostic snapshot lost its value, and retirement failed in drain with an actualBackend TypeError, leaving2 models/2 texture leases. A one-line candidate source seam uses ECMAScript JSON for this bounded primitive diagnostic instead of the detached-window structuredClone call. CPU checks exercise the exact frozen function with a missing clone result. In two independent native ready cases, WebGPU and WebGL2 original retirement now reaches done and measured models, texture leases, pending requests/compiles, viewport/backend owners and renderer memory reach zero. No caller-forced retirement was added. The host lease still reports open; native GPU device loss is unconfirmed; GPU console has one MutationObserver error with unqualified origin. Complete release, same-parent reopen, pending cinema, visual/device acceptance and city completion remain false. Native evidence and the next concrete repair are hash-pinned privately.
