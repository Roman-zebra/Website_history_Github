# Tower115 optional phone derivative, 2026-10-01

Private technical candidate; whole-world delivery, historical appearance and real iPhone14 performance are not accepted. Original frozen115 aa030cd files remain unchanged. The local115 viewer selects this profile with `?mobile` or coarse input at a short viewport edge <=600px; `?webgl` selects the fallback. `?mobiletextures` isolates texture resolution at the original1280x720 camera/light/LOD. Desktop113/115 retain their source route.

## Results

All14 source parts received an image-only512px derivative in `../research-cache/tower-mobile-textures-001`. Pillow12.3.0 preserves small image bytes, alpha and all non-image bufferViews exactly; normalized scene JSON is unchanged. The separate `tower-mobile-transport-001` stage uses existing lossless Meshopt encoding: decoded attributes/animations and resized images are exact, triangle order and winding are preserved, but cyclic rotation of a triangle's indices is allowed. Index bytes must not be described as identical after encoding. All14 compressed and14 decoded files validate with0 errors/0 warnings. Source hashes remain unchanged.

| Part | Compressed transfer | Status against phone assembly budgets |
| --- | ---: | --- |
| Exterior base+wing LOD2 | 1,982,896B | Initial transfer passes8MiB |
| Stair base | 3,292,372B | Passes4MiB cell |
| Stair dream | 3,583,112B | Passes4MiB cell |
| Hall base/dream | 7,621,616 /7,706,444B | Stream budget fails |
| Lift base/dream | 4,641,252 /5,450,252B | Stream and combined draw budgets fail |
| Cinema base/dream | 10,076,420 /10,558,764B | Stream and combined triangle budgets fail |

The wing's4096px image becomes512px: estimated RGBA8+mips residency85.33MiB ->1.33MiB. These are estimates per referenced texture object, not actual GPU-memory measurements. Conservative assembly accounting includes both passes of double-sided BLEND materials. Stair base assembly79,693tri/123draws, dream83,969tri/129draws, estimated18.33MiB textures. Actual fixed stair camera reports76,918tri/91draws and dream81,022tri/96draws on both WebGPU/WebGL2; culling and runtime batching explain the lower figures.

Mobile forces both exterior LOD2s, DPR1, maximum720px buffer edge, no antialiasing and at most4 local lights. Unknown or over-budget room metadata blocks the room before its GLB load and preserves the closed backing. Actual rendered triangles/draw calls also have a guard. Existing hidden-page pause and cell disposal remain in force. Hall/lift/cinema are temporarily unavailable in this optional study until bounded derivatives fit; this is not a finished visitor experience.

## Verification and reproduction

Native desktop Chrome checks on both backends: north, stair base/dream, roof landing, over-budget hall and far/unload. Actual viewport remained1920x863 with720x324 buffer. Portrait buffer function390x844 ->333x720 is unit-tested, but narrow-layout and actual Safari/iPhone14 sustained FPS, heat and memory are unmeasured. Full static build323/323 tests passed. No paid generation or new external tool was used.

Fresh1280x720 hall source/texture-only captures use the same camera/light/LOD0. The inspected pair retains silhouettes and layout; texture resizing introduces no visible new gaps in this view. Hall looks flat/bright in the existing lighting; this is not look acceptance. Other texture comparison cameras remain pending. Native phone dream stair PNG also inspected; retain private `look-dev/` outputs and hashes.

Read-only inventories: `tower-mobile-audit-001` (original), `002` (image derivative), `003` (corrected conservative two-pass rendering). Selected roof/wire/shell exact-position duplicate faces at1µm precision are0; near-coplanar surfaces, physical contacts and flicker remain open. Instanced bounds exclude individual instance transforms, which is explicitly noted; costs include instances.

From the repo, use fresh numbered output directories:

```powershell
node scripts/shinsekai-asset-inventory.mjs ../research-cache/tower-base-115-runtime/manifest.json ../research-cache/tower-mobile-audit-NNN
python scripts/shinsekai-mobile-textures.py --manifest ../research-cache/tower-base-115-runtime/manifest.json --out-dir ../research-cache/tower-mobile-textures-NNN --edge 512
node --test tests/shinsekai-mobile-inventory.test.cjs
node scripts/serve-shinsekai-study.cjs
```

Use the configured existing Pillow runtime if system Python lacks it. Transport packaging and independent qualification scripts are retained privately as `../research-cache/build-mobile-transport.mjs` and `qualify-mobile-transport.cjs`; audit receipts record exact attributes/images and cyclic index counts. The server exposes only named GLBs/manifests under `/study/tower-mobile-115/`, never decoded candidates, receipts or arbitrary private paths. No derivative binary is committed or published.

Next: scoped hall geometry/streaming round first, then lift batching and cinema geometry; preserve room dimensions, interactions and unrelated geometry. Do not globally decimate or adopt generic TRIPO columns as historical geometry. Roof/wire contact diagnosis can proceed independently. Cloth7240 and art26/hybrid23 unchanged; this technical round is not an art trial. Material Maker export remains unverified. Claude review remains an occasional milestone packet only.
