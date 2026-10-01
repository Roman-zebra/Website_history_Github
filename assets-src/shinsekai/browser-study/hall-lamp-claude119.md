# Claude119 hall lamp colour — isolated2350K comparison

2026-10-02, baseline58aafe2/source115 aa030cd. Hall art trial8 changes only
the11 original point-light colours and six bulb/lamp_milk emission colours.
Keep exposure-1.25EV, directional gain.01, qualified floor/wall wear, point
intensity/distance/decay, emission strengths40/5, source maps/material fields,
geometry and1280x720 beauty AA fixed. Curtain emission stays untouched.
This optional source-quality stream route does not change production defaults
or phone texture/resolution settings.

Existing Blender4.5.10 LTS Blackbody node was probed in a fresh scratch scene
with CyclesCPU/one sample, emission-only plane, three native32bit16x16 EXRs.
Scene-linear role and EXR space are Linear Rec.709; installed OCIO SHA256
eaeb3b633cfc1ab190e0e7e1c9d6155ef43a08bb3b2e94fd5db7060bbfe59416.
Native2350K RGB is [2.1790616512298584,.7413240075111389,.1008404791355133].
Probe/source/emission audits and original EXRs are retained privately in parent
research-cache/hall-lamp-119-001/. Requested2350K is an artistic estimate,
not measured historical lamp temperature or spectrum.

Each colour is scaled to preserve its own original linear luminance with
weights .2126/.7152/.0722 before AgX/display. HDR red components may exceed1;
this does not mean perceived display brightness is identical. Source points
remain2.282759348767055 or4.56551869753411, distance0, decay2. Source bulb
emission40 and milk-glass5 remain. Reducing intensity and finite range require
separate fixed-camera comparisons; no completed local-pool criterion yet.

Temporary emitter copies own independent emission colours but share original
maps. All copies are staged/validated before point-colour or assignment changes.
On retirement, point colours and material assignments restore before cached
source reuse, and only temporary materials are disposed. Two meaningful tests
cover scope, original fields/maps/geometry, idempotent restore/re-entry and
atomic failed-copy cleanup, including accidentally aliased emitter colours.

Primary Three.js [PointLight documentation](https://threejs.org/docs/pages/PointLight.html)
and [colour management](https://threejs.org/manual/pages/color-management.html)
were checked alongside pinnedr186 loader source. Blender4.5 manual fetch failed
with402; it was not read or treated as a verified reference. Actual pinned
native colour probe is the evidence. No new tools, agents, model calls or fees.

Source URL: tower-base-115.html?hallstream&hallprefetch&hallexposure&halldirectional&hallfloor=wear&hallwall=wear.
Add &halllamp=control or &halllamp=colour; append &webgl for fallback.
Context hall position[-12.275,1.65,6.9],target[-12.275,1.8,-3].
Near hallDesk position[-12.65,1.65,.7],target[-10.85,1.2,.7].
Both cameras were captured on the original scene before authoring.

WebGPU source/copy near/context PNGs are exact. Native colour candidate shows
warmer emission and local cast while preserving near surface detail and shape.
Emission globes still approach white because intensity is deliberately fixed;
this comparison does not finish Claude119's lighting/depth request. Re-entry
reports original source colours again, without compounding. Dream source PNG
hash is exact f14291419ef673c4b4c0d9cd80dd95c043682b45310b3405e45cd2bff07565d1,
lamp metadata absent, EV0/directional restored. Far38980tri/75draw, cache and
texture reservation0; observed warnings/errors0. Near381746tri/165draw and
context377944tri/156draw remain. Full static342/342 passes.

WebGL2 source/copy near is exact; context differs at7pixels/max1 of255.
The four source/copy controls therefore give3exact plus this tiny rounding
difference, not full framebuffer view-order invariance. Colour-only native
differences: GPU near886505pixels/max30/context893326/max34; GL near886483/
max30/context893270/max34. All cover the frame because original distance0
points still contribute broadly: a finite local-pool distribution is pending.
Both near/context images were inspected; maps/joints/edges remain readable.
GL dream source PNG hash exact
a73b0050b5ae64d9660d1d96dab563a8b2dc44da6d70b6bad4c81bf288e9ba3b,
lamp metadata absent, EV0/directional restored. Fourteen native unchanged PNGs,
controls/difference counts and four encoded input hashes are in the private
native-receipt.json. One GL control capture was attempted before loading ended;
the disabled button prevented it. Ready was then observed and one fresh image
saved; no browser/process restart or stale image reuse.

Remaining119: separately reduced lamp intensity/range, darker timber, qualified
GTAO, haori support/gravity/folds/collar/contact, upper earth-wall/tatami/cushion/
shoji details. Original source GLBs are immutable. Actual iPhone14 performance
and artistic/production acceptance remain unqualified; no full119 completion.
TRIPO added spend0; last liveOct1 balance3200 is not a freshOct2 check.
Previous58aafe2 exact Workers success2026-10-01 18:12:32UTC was verified.
