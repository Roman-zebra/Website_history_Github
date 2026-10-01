# Hall AO007 denoise — partial Claude119/120 work

The optional candidate filters only the existing opaque GTAO result. Full beauty
maps/AA, source RGB/geometry/cameras/light/exposure, alpha material identities and
global renderer context stay original. It uses the existing three-r186 package
DenoiseNode with radius/lumaPhi/depthPhi/normalPhi5 and16samples, depth and signed
normalView. An owned640x360 red unsigned-byte no-depth target carries the filtered
AO. Its texture is sampled only by independent opaque hall material copies during
main rendering; exact source assignments restore in finally as in006.

The public noiseNode uses an owned deterministic64x64 RGBA DataTexture. The
filter still owns/disposes its default noise; seed texture and output target are
disposed separately. Three additional effect texture objects are created, with
zero cloned asset maps. Object counts are not measured GPU allocation. Desktop
multipass counters near760283tri315draw/context752091293/floor736567257; the
frame counter does not prove extra filtering is free. Its16samples/pixel add
shader cost. Do not enable it by default or claim phone performance acceptance.

`hallao=denoisecontrol` (constantAO1) has four near/context1280x720 native PNGs
exactly equal to original direct images on both WebGPU and WebGL2. Public render
and preparation states restore. `hallao=denoise` applies the filtered AO. GPU
differences versus raw006: near185978pixels/max7,context186876/max9,
floor168033/max7; GLnear186122/max7,context187264/max9,floor168088/max7.
Small AO speckles are reduced and visible source maps/edges are
retained; feet/counter/shelf contact remains weak, so119 is not complete.

A read-only floor ROI source-minus-result proxy in parent007
floor-residual-statistics.json compares adjacent residual variation, not whole
image quality. GPU flat-floor ROI[450,430,1080,670] variation .03898→.03457 with
mean darkening .04984→.04877 RGB levels. GLvariation .03916→.03478 with mean
darkening .04986→.04882. This narrow proxy supports smoothing,
not final contact/phone acceptance. Both dream images match original exactly; GPU
re-entry differs by1pixel/max1 at[291,97,292,98], so do not claim exact re-entry.
GL re-entry is exact to the first candidate. Both far paths38980tri75draw have
no pending/resident room and zero reserved bytes/maps; disposal public state
restores. This is cache/reservation evidence, not measured GPU memory recovery.
Four original encoded inputs are rehashed unchanged;14native PNGs retained.

The first module import failed because two already-installed package files were
absent from the selected vendor subset. DenoiseNode.js and SimplexNoise.js were
copied unchanged from the existing verified0.186.0 npm archive, with matching
archive/vendor/provenance SHA256. No install, new tool or vendor source editing.
Provenance metadata is normalized to LF; all existing recorded values remain.
The initial import error is retained in logs; no new error after the repair.
Full build346/346; TRIPO added0. Hallart14 for the actual007 candidate;
BuildingAart26/hybrid23/cloth7240 unchanged. Retained evidence: parent
research-cache/hall-ao-119-007/native-receipt.json and numbered PNGs.

Next changed work: add actual occlusion to the unshadowed interior directional
fill after checking pinned public shadow APIs, at fixed close/context/floor views.
Scope geometry cast/receive flags and light/renderer shadow state with restoration;
preserve glass and camera/source/default/dream behavior. AO strength alone cannot
occlude direct sun3. Hemisphere1.2 remains indirect fill. Then finite4–6m local
light reach, haori and upper four details.119 incomplete,observed120/processed118;
no formal review request yet or phone/production adoption.
