# Scene look implementation checkpoint

Claude is the look/behaviour supervisor; Codex implements and validates. Handoffs92–95 drive this separate, unpublished study. No source geometry, 1912 placement or AAA acceptance is asserted.

Preview: `node scripts/serve-shinsekai-study.cjs`, then `/assets-src/shinsekai/browser-study/look.html` on loopback18765. `?webgl` selects fallback; `?low` selects one1024 shadow cascade instead of three1536 cascades; `?parked` leaves bulb tiers off until `startGimmick`. The existing baseline viewer still loads v2.

Implemented: July-dusk art direction with physical sky, AgX, cascaded sun shadows, height/distance haze and directional scattering, restrained original time LUT, four instanced warm bulb tiers with selective emissive bloom, assumed catenary overhead wires/poles and ropeway fixture. Static scene renders on demand. Six fixed review cameras export1280×720 PNGs; street hero remains at1.5m, fov41.1° (about27mm horizontal equivalent at16:9). Camera and light positions are art assumptions, not solved photographic cameras or a solar ephemeris.

Claude95 CC0 materials: sandstone courses on pale masonry (3m metric UV scale,40% contrast reduction), smooth Plaster007 trim, PaintedPlaster006 base-dirt mask below2m, desaturated/retinted green_metal_rust iron with modest normal strength and8% Metal041B joint detail. Textures are source choices, not identified historic materials. Fifteen Blender-derived JPEGs total5,536,045 bytes; runtime uses12 maps. Source bytes/MD5 and derived SHA256/dimensions are verified. Licences/source URLs are in `assets-src/shinsekai/browser-study/materials/PROVENANCE.json`. Textures remain JPEG for this study; production KTX2/meshopt delivery is pending.

`prepare-look-materials.py` imports v4, authors metric box UVs, restores landing/source metadata and exports a separate `tower-study-v4-look-uv.glb`. Tests verify every named node, actual world vertex bounds, triangle counts and the complete landing contract against the original v4. Validator:0 errors,0 warnings,11 informational messages (runtime-assigned UVs and empty markers). v2/v3/original v4 remain unchanged. Free source downloads are cached outside Git; no supplied blend/script is executed.

Six v4-r2 PNGs and a hash/dimension manifest are in parent `research-cache/look-dev/v4-r2/`. They were exported on WebGL2. WebGPU and WebGL2 render the material shader without captured errors/warnings; hero DOM cameraY=1.5. First shader compilation is cold CPU submission time, not steady frame rate. Earlier1920×1080 pixel-ratio1 measurements of both baselinev2 and lookv4-r1 returned~1Hz (median1009.9ms,p951010ms) despite DOM-visible status. This comparison cannot attribute the result to new effects or establish GPU performance. High60fps is unverified.

Handoff94 hooks: stable layout feature ids, initially parked machine state and gated `startGimmick` events for lift/ropeway/disc and bulb tiers. Late start uses its own elapsed-time origin; resets park machines. Manual study Play retains its existing function. No puzzle UI, rewards, save state or production paid gate is implemented.

At r2 these items remained: baked AO/lightmaps, TRAA, nearby real bulb lights, wet-ground reflections and surrounding district assets/performance gates. The r3 implementation below advances the first four; full baked lighting, district assets and qualified performance remain open. Claude owns source/design selection and acceptance.

## v4-r3 tech follow-up

7 original Blender AO atlases on secondary UVs; geometry/landing invariants pass, validator0/0/18. WebGPU uses24 camera-nearest real point lights through r186 ClusteredLighting; fallback uses8 pooled lights,Low0. Power30/50 lumens and range5m are assumptions. TRAA onHigh replacesMSAA; previous billboard corners are reprojected through a context-specific VelocityNode. Sixteen settling frames then idle, resets on fixed-view/mode/weather/resize and bulb starts; PNG capture also resolves16 samples. Low retainsMSAA.

Wet ground uses original periodic noise and35% planar reflection with roughness mip filtering instead ofSSR, a bounded cheaper study alternative pending performance checks. A frozen seeded rain layer is for the review still, with no claimed particle motion/impact physics. Night camera now aims at6m to include warm roof reflections on the ground.

Claude96 diagnosed native-occlusion throttling; his visibility-overridden84.2fps at1078x762 is a diagnostic only. Codex fresh connected-Chrome1080p run still returned0.992Hz with visible DOM start/end (receipt outsideGit); noGPU-cost/High60fps acceptance. Page writes complete measurement conditions to canvas dataset. Six WebGPU1280x720 PNGs/hash manifest are in parent research-cache/look-dev/v4-r3/. WebGPU and WebGL2 dusk/night render without captured warnings/errors; Low has1CSM/0point lights/MSAA and disables planar reflection. Full build247/247 passes. PNG encoding also has an8-second bounded, cancellable callback wait.

Claude99 owns the first street-facade pilot; Codex owns97 tower windows and98 street dressing/camera. Claude100 requests a separate blind Building A comparison after this renderer checkpoint; it does not transfer ownership of the pilot. No competing implementation files are read. Window/room dimensions remain assumptions; source-only candidates are not architectural acceptance.
