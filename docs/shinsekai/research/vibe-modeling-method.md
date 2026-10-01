# Research-led modelling workflow for Shinsekai

Adopted 2026-10-01 at the user's request. Reference: [KOBATAKA, AI × Blender modelling process](https://x.com/shion_takk/status/2105302605719347253), public article dated 2026-09-30, read directly in the browser. This is a project-specific implementation of its public advice, not a copy of its paid material.

The applicable idea is to research established methods before authoring, define the work and its verification, and review controlled visual revisions. Our existing Blender scripts are already an AI-to-modelling-tool connection. A different connection alone is not evidence of better art.

Follow-up 2026-10-01: the public [note article](https://note.com/its_kobataka/n/nc7cb65776c0f), including chapters1–3 and the exposed chapter4 introduction up to the purchase boundary, was read. Restricted continuation remains unread. The public process-reuse advice is now implemented in `modeling-lessons.md` and `workflow/verify-scene-reopen.py`. Read the applicable lesson before the next asset round and record verified reusable settings in the round template. Scene persistence checks were run on the existing cloth/hat candidate and Building A interior; see the lesson file for scoped results.

## Before changing an asset

Write a short brief using `assets-src/shinsekai/workflow/round-template.json`:

1. Name the object, intended visual result, reference and current input revision.
2. Bound this round to a particular issue. Record what must remain fixed.
3. Declare metres, coordinate system, origin, dimensions and source status. Distinguish documented historical facts, model measurements and artistic assumptions.
4. Research the relevant expert method and official documentation. Record the claim each reference supports and check compatibility with Blender 4.5 LTS / three.js r186. A current manual is not automatically a manual for our pinned version.
5. Choose fixed views and technical checks before implementing. Keep before/after camera, light, exposure, pose, backend and output size equal.

## Execute and review one round

Save the baseline and create an optional derivative. Change one visual cause at a time. Material colour, roughness, normal strength, lighting, geometry and camera each need separate comparisons when diagnosing an issue. Technical export or camera corrections do not count as artistic improvements.

Compare saved PNGs directly, including a close view and a context view. Mark the location of a remaining defect and record a specific next change. A changed pixel hash confirms an image changed; it does not confirm improved quality. If a change is invisible, verify object/material selection before increasing its strength.

Run checks appropriate to the change: GLB validation and preservation of affected geometry, UVs, colours, supports, joints, pivots and clips; relevant collision/ray tests; actual WebGPU and WebGL loading, rendering, image saving, animation and disposal. Run `.blend` save/reopen checks when editing saved Blender scenes. Browser-only shader revisions need repeatable source plus reload checks rather than a fabricated `.blend` change. Never replace visual inspection with triangle counts or validator success.

Record retained/rejected candidates, actual results, open issues and a next step. Use the existing Claude batch and ownership policy; this workflow does not request extra reviews, agents or model changes. Qualified performance and historical acceptance remain distinct from local render success.

## Current application: Building A timber

See `assets-src/shinsekai/workflow/timber-wear-brief.json`. The active implementation is `assets-src/shinsekai/browser-study/shop-wood-wear.mjs` and its connection in `building-a.mjs`.

The working candidate contains both colour and roughness variation. For a meaningful diagnosis, compare baseline versus roughness-only with colour fixed, then baseline versus colour-only with roughness fixed; combine only after reviewing both. Keep the existing grain, normal maps, UVs, vertex colours, floor calibration, hardware, lighting and cameras fixed. Numeric noise coefficients are inferred art settings, not measured historic timber properties.

Technical references checked 2026-10-01:

| Reference | What it supports | How it applies |
|---|---|---|
| [three.js MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html) and [r186 source](https://github.com/mrdoob/three.js/blob/r186/src/materials/MeshStandardMaterial.js) | Metallic/roughness shading, map multiplication, wood as a dielectric, roughness map green channel | Preserve existing maps and use the pinned renderer's material semantics. |
| [three.js colour management](https://threejs.org/manual/pages/color-management.html) | Linear working/vertex colours, sRGB colour textures, non-colour normal/roughness data | Preserve loader interpretation and avoid correcting a colour-space error with lights. |
| [three.js physical node material](https://threejs.org/docs/pages/MeshPhysicalNodeMaterial.html) | Physical material node inputs | Check the actual r186 node implementation before porting colour/roughness or cloth sheen. |
| [Khronos glTF 2.0 specification](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc) | Asset material and coordinate contract | Use metre units; account for Blender Z-up to glTF/browser Y-up conversion. |

Blender 4.5 manual pages could not be fetched through the web reader during this integration. Treat them as unverified references until read successfully; there is no documentation fee or purchase to authorize. Current timber work is a runtime shader change and is supported by the renderer references above.

## Tools and cost

`C:/Program Files/Blender Foundation/Blender 4.5/blender.exe --version` confirms 4.5.10 LTS. The existing local `--background --python` route already generates and revises assets. No tool download is required for this timber round.

The article's optional [MCP for Blender](https://github.com/ahujasid/mcp-for-blender) Quickstart was checked. It is a community integration; current instructions use `uvx mcp-for-blender` and a Blender add-on. Keep it as an optional route when a persistent interactive scene is useful. Do not run its automatic setup just to adopt the method: that changes client configuration and add-on state beyond this round. Inspect distribution, dependencies and connection scope before enabling it. Continue with the working local script route now.

Only free local tools and already authorized services are allowed. The reference's Rhino, external mesh-generation services, paid note chapters and different model tiers are not required to implement this workflow. Preserve the existing browser-only product, era/source rules and private study/publication distinction.

The active production thread was notified directly under the user's instruction to integrate this method. It remains the sole writer of shared progress/state, task history, existing Claude batch and Git commits while it is running.
