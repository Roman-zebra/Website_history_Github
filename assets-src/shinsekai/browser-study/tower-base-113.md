# Tower-base 113 local integration study

Run `node scripts/serve-shinsekai-study.cjs`, then open
`http://127.0.0.1:18765/assets-src/shinsekai/browser-study/tower-base-113.html`.
`?webgl` selects the fallback; `?size=1080` selects a 1920 × 1080 drawing buffer.
The browser viewport must also be checked separately. The private generated
`research-cache/tower-base-113-runtime/` folder is required; it is not published.

## Source and extraction

Claude handoff 113, revision `cb8231d`, supplies the exterior and articulated
interior. The source remains in the parent review cache. A private uncompressed
rebuild redirects exports without changing the author checkout. Run
`node scripts/shinsekai-glb-cell.cjs input.glb root output.glb` to extract a
single scene subtree, keeping geometry, materials, embedded images and only
animation tracks targeting that subtree. Collision/camera nodes are omitted;
cell authoring translations are reset by the CLI. Unsupported compressed
geometry, textures or skinning fail explicitly rather than silently degrading.

Independent checks compare all extracted attributes/indices and clip values
with the original. Eleven extracted GLBs validate with zero errors/warnings.
The normal/dream cinema files are 26,746,088/27,360,904 bytes, above the
26,214,400-byte delivery limit. Compression and production packaging remain
open. The other cells and exterior LODs are also private study assets.

## Runtime behavior

Only one selected interior is loaded. The exterior backing/curtains are hidden
while it is loaded; the SW stair-head placeholder is hidden only for the stair
cell. The other three guards remain. Returning to the north view retires the
interior, mixers and GPU resources. Selection/compilation is serialized;
obsolete responses are disposed, and page exit waits for outstanding work.

Both gates use the actual exported open **and close** clips. Closing has its
own latch timing. Each mixer is confined to the loaded normal or dream cell.
The sliders scrub opening; the play buttons run opening followed by closing.
Hidden pages stop drawing and pause playback. This is a mechanism preview;
elevator travel, interaction interlocks and walking/collision are separate work.

918 bulb instances preserve 7,344 triangles. 150 baluster instances preserve
7,500 triangles; the retained trim keeps 36,268 triangles. The original UV1
is omitted from the repeated template only if no bound texture uses it; any
UV1-bound material rejects conversion. The remaining trim preserves its UV1.
Combined raw drawing attribute/index/matrix storage falls by 1,342,776 bytes.
This excludes parser copies, mipmaps/driver allocation and download bytes,
and is not a triangle reduction or frame-rate result.

## Verification limits

Actual exported rays clear both stair variants, including all 74 physical
treads, supported head landings and thresholds. Minimum headroom is 2.347623m.
91 interpolated poses per clip/variant give a worst pin deviation of 0.005254mm.
Independent triangle BVHs find zero intersections in 88 sampled poses. These
are discrete geometry checks, not swept-volume or structural certification.

Native WebGPU and WebGL verify head/lift cells, independent gate scrubbing,
playback and retirement. Private PNGs are in `research-cache/look-dev/tower-base-113/`.
An earlier `head-before-placeholder-fix-webgpu.png` is stale and excluded.

A documented viewport override matched buffer and client at 1920 × 1080.
154 visible-page RAF samples over 143,407.9ms ran at about 1.074 RAF/s
(median 1009.9ms); the pacing cause is unverified. This does **not** qualify
the 60fps gate or measure GPU capacity. This route also omits the tower shaft,
shadows, AO, SSR and final postprocessing.

Claude116 subsequently accepted this scoped source113 gate using the dedicated
Chrome107 measurement setup on GTX1660SUPER/Ryzen5 1600/Chrome154: 240 visible
RAF intervals for each of six views on each backend, 1920x1080 render buffer,
CSS client1904x1105. Mean100fps, median10ms, p95<=10.2ms, max<=16.3ms; ready,
cell, revision and error fields were checked. The original receipt is retained
in `docs/shinsekai/research/perf-tower-base-113-claude.json`. This is Claude's
measurement, not an independent Codex rerun or evidence of GPU headroom beyond
the ~100Hz display limit. Combined115 wings/cells and new lighting/AO/effects
require their own performance checks; final production60fps remains open.

Color, room equipment and lighting are estimates. No source-photo/video pixels,
production entitlement or payment flow are included. Claude owns the subsequent
cinema entry-wall/shell and base downpipe/wire/door repairs under handoff 114.
