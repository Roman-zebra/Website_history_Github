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
