# Claude119/120: beauty-pass isolation001

Technical diagnostic, not an artistic revision or accepted AO. Baseline2be6ade,
source115/aa030cd. Optional desktop `hallpass=direct|beauty` requires hallstream;
phone/default paths remain unchanged and hallao cannot be combined with this probe.
2350K, point.5, floor/wall wear, EV-1.25, source directional.01, full maps,
geometry, camera and antialiasing remain fixed. Beauty mode has one transparent
antialiased scene pass and output transform, with no normal/depth prepass or AO.

Both native1280x720 backends: all six direct controls match the preceding point.5
near/context and original dream PNG hashes exactly. Twelve unchanged native PNGs
are retained in parent research-cache/hall-pass-119-001/. Beauty versus direct:

| Backend | View | Changed pixels | Maximum channel difference /255 |
| --- | --- | ---: | ---: |
| WebGPU | near | 114520 | 69 |
| WebGPU | context | 44906 | 162 |
| WebGPU | dream after disposal | 37215 | 164 |
| WebGL2 | near | 114508 | 69 |
| WebGL2 | context | 44893 | 165 |
| WebGL2 | dream after disposal | 37202 | 164 |

Near differences bound[174,0,617,368], context[423,134,1280,541], dream
[423,134,1280,477]. Inspected near/context images retain opaque surface detail;
glass appearance changes. This establishes that the general beauty-pass route
is sufficient for the regression; AO and its opaque depth prepass are unnecessary
to reproduce it. It does not identify a single private renderer cache defect.

Public renderer snapshots are equal before/after render and disposal: target/MRT
null, context990, outputType1016, toneMapping6, srgb, expected exposure, clear/
transparent/opaque/lighting flags, camera layers1, no override. Eight unique
transparent materials include alpha-blended tb_glass/glass/glass_smoke/water and
grime/dirt. All have transmission0; side2 and their source opacities remain.
Do not infer physical transmission or that restored public fields prove private
framebuffer/node caches unchanged. First GPUnear capture predates expanded alpha
diagnostics; explicit reload supplied the expanded GPUcontext/dream diagnostics.

Both beauty paths retire to38980tri/75draw, no resident/pending room, reserved
asset/map bytes0; observed warnings/errors0. Four normal encoded source hashes
remain unchanged. Full static build343/343 after final diagnostic edit; syntax
checks pass. No accepted contact/GTAO, no real-phone timing or production claim.

Next changed repair: opaque-only AO prepass plus direct beauty rendering with a
scoped AO context, preserving the original alpha draw/output path. Verify normal
near/context, dream source equality, re-entry and retirement on both backends.
Retain failed AO001/002 and this technical trial; no unchanged retry. Then finite
4–6m range, haori and upper details. Hall art count stays11; TRIPO added0.
