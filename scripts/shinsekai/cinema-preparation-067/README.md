# Cinema preparation candidate 067

This is the source handoff for revision I of the protected hall cinema preparation experiment. The six engine modules retain the exact bytes tested in Chrome. It is a candidate package; production callers and the site build do not load it.

The fixed Three.js r186 renderer queues material sides for each transparent pass. The patch carries the captured side through asynchronous node preparation for `cinema__projector_7`, restoring material side and renderer preparation state in `finally`. Other node inputs retain their original behavior. The queue and pipeline preparation changes are exactly reversible.

## Reproduce the CPU checks

From the repository root, run:

```sh
node --test tests/shinsekai-cinema-preparation.test.cjs
```

The checks cover the exact vendor and compiled queue/loop formats, 56 side/restoration cases, original return/promise/error identity, bounded observation, inherited property restoration, reload generations, late projector observation, and diagnostic compaction. Backend and object factories in these tests are synthetic. They do not establish native cache reuse or frame rate.

`provenance.json` pins the six engine modules, existing vendor, historical H observer, and compiled renderer fragments. The fragment file preserves only the original queue method and compilation tail; it is not a standalone renderer. Its source offsets/hash identify the original compiled input, which is not distributed here. Three.js fragments retain the MIT license in `fixtures/THREE-LICENSE.txt`.

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

Revision I was checked in Chrome on WebGL2 and WebGPU: initial load, same-document cinema reload, normal exit, and exit during pending preparation. Initial/reload preparation was approximately 8.1/6.5 ms on WebGL2 and 8.1/6.0 ms on WebGPU, with zero new pipeline calls observed in the specified first-ready callbacks. The late WebGPU projector callback was observed separately at 3.5 ms with zero new pipeline/program calls. Initial and late callbacks must not be conflated.

The two fixed rear images matched exactly on WebGPU; WebGL2 differed at 25 pixels by at most one channel level. Revision I's first WebGPU reload draw exposed five of the six tracked objects; broader six-object coverage belongs to the preceding H evidence. H's parent receipt overflow remains a recorded failed case. I removes duplicate shader diagnostics while retaining the full pipeline-after hashes, within the unchanged receipt ceiling.

The complete native receipts, images, failures, and input manifest remain in the internal evidence archive. These observations do not establish controlled performance improvement, GPU completion timing, HD 60 FPS, mobile acceptance, art/rights acceptance, payment protection, or whole-city completion. Mainline adoption requires its own integration and acceptance evidence.
