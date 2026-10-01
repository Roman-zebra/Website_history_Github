# Wood surface comparison under118

Specification recorded before the native comparison,2026-10-01. Scope: runtime
wood colour/roughness variation in the existing Building A study. Preserve the
frozen geometry, metre units, Y-up runtime origin/transforms, UV0/UV1, vertex
colours, normal maps/scales, hardware, clips and reflective floor treatment.

Method basis: [Khronos glTF2 material specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials).
Base colour and roughness retain their source factor/map multiplication;
COLOR_0 remains an additional linear colour multiplier. Roughness uses the
green channel; normal maps and their scale remain separate from this change.
These are format rules, not recommendations for a measured1912 wood finish.
The installed official r186 implementation is the version-specific reference:
`vendor/three-r186/build/three.webgpu.js`, `MaterialNode.ROUGHNESS` multiplies
the current material roughness by its roughnessMap green channel. The helper
builds on `materialColor`/`materialRoughness`, rather than replacing those maps.

Selected materials: unpainted `M_Timber_{Dark,Light,Aged,Natural}` and existing
`UD_wood`/`UD_wood_raw`. Excluded: painted timber, signs, paper, mixed general
prop materials and separately calibrated hero floor/varnish materials. The
companion cloth is outside this helper's load scope. Existing physical fields
are copied into the matching Standard/Physical node material type.

Diagnose roughness and colour separately before combining the treatment:
`woodwear=roughness`, `woodwear=colour`, then `woodwear` (combined). Local metre
position noise at0.7/m gives colour gain amplitude0.04;35/m gives roughness
gain amplitude0.12, with final roughness clamped0.35–1. These are inferred art
parameters. No new texture, displacement, extra normal map or historical claim.
Repeated application skips already revised materials. Original materials remain
reachable for the cell's disposal; shared source materials share one clone.

Native comparison protocol: fixed `upper-window` camera, clear-glass enabled,
1280×720 buffer, identical `wallwear&daylight&clothhat&clothlook&ao` options.
The existing shot converts from Blender camera[3.2,3.9,4.955] and
target[1.5,0.25,4.5] to runtime[3.2,4.955,-3.9]/[1.5,4.5,-0.25]; lens24.
The control omits `woodwear`; each diagnostic selects just one channel. The front-window sun remains[-5,9,18] with
the same target, shadow map, environment/fill and base lamp balance. Capture
the control and candidate separately on the same backend before assessing the
wood change. Normal/dream saves and far retirement are separate lifecycle
checks on both WebGPU and WebGL, not a combined1080p performance claim.

Validation: map identity/normal scale/physical fields/shared geometry and source
colours retained; painted timber/sign/paper/hero floor excluded; no cumulative
application. Seven material tests pass and the full build passes300/300.

The fixed WebGPU control and source-reloaded control have the identical PNG
SHA256 `6c9f57631c35ebdb61f0a9b6e56d56817e261c8abe4a9b55c95823609689c049`.
Actual selected counts are exterior4/interior6. The three isolated/combined
upper-window images were directly inspected. Roughness changes36297pixels,
maximum9/255 per channel; colour changes91223pixels, maximum1/255; combined
changes100222pixels, maximum9/255. These differences are small and are not
evidence of better art. Retain the optional diagnostic modes; no default or
visual acceptance is changed. Existing grain remains; dark corners, flat timber
silhouette and the garment's broad silhouette/post occlusion remain open.

Counter close-up is an exclusion control: the hero varnished counter is outside
the selected material set and its baseline/candidate PNGs are byte-identical.
Do not describe this no-op as a changed wood close-up. Targeted cabinet/beam
detail is inspected in the full-resolution upper-window frames. A colour-only
save failed once after initial loading, with no console GPU error; its warmed
retry saved successfully. Only the fresh completed PNG is comparison evidence.
Private evidence: `research-cache/look-dev/woodwear-118/`, including unchanged
controls and amplified difference sheets labelled diagnostic-only. This runtime
source reload is separate from the existing cloth/interior Blender save/reopen
receipts; no browser-only shader persistence is inferred from those `.blend`s.

Both backends saved the combined normal/dream candidate and retired the
interior/dream cells at far LOD2, active wood metadata0/new console warnings or
errors0. WebGL combined/control mean absolute RGB differences are
[0.06851,0.05677,0.04655]/255. Dream captures at counter(WebGPU) and upper-window
(WebGL) are lifecycle evidence, not matched pixel comparisons. Cold combined
load/first-submit: WebGPU4596.2/3980.8ms, WebGL1886.8/8823.5ms; WebGL control
2820.3/24654.4ms. These are readiness, not FPS. CSS1920×863/buffer1280×720.
Far retires active interior/material references; exterior LOD caches remain
until page cleanup. Eleven fresh direct PNGs, exact source hashes and scoped
results are in the private receipt. Three actually inspected diagnostic material
trials bring total24/hybrid21; control/reload/capture retries do not count.

Next hypothesis: the garment's collapsed sleeve/post-hidden silhouette needs
an initial-pattern or support correction with source hardware and fixed pins
retained, rather than more wood-noise strength. Consult the initial-intersection
and valid-GLB/poor-silhouette lessons before that cloth round.
