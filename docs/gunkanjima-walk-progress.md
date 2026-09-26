# Gunkanjima walking experience — checkpoint 2026-09-26

The walk page is `/3d/gunkanjima-walk?lang=ja`. This repository deploys through its existing Cloudflare build; it is not a Sites project.

Implemented in renderer v10: first-person default, keyboard/pointer and touch controls, impassable coast checks inside and outside, five era choices, four processed GSI aerial images, linked library catalogue/photo sources, softer anime-inspired colour and light, labelled inferred multi-floor studies for 68 feasible building footprints across eras. The original 12 source-based scenes remain available in 1962. Equipment, too-narrow structures and footprints outside the coast are excluded. Inferred interiors are generated lazily. Stair location, room layout, objects and colours are not historically verified.

## Improvement and verification cycle

1. Found stair/landing seam gaps; added small support overlap and checked ascent and descent for every generated building.
2. Found black floor/ceiling surfaces in native GLES rendering; bounded shader hash inputs and used high-precision material calculations where supported.
3. Corrected the initial stair-facing direction and chose a clear initial view in existing scenes.
4. Retained terrain when indoors and removed the transparent host-building shell from the game view.
5. Added room partitions/furniture and reduced noisy surfaces; inspected outdoor, apartment, stairs and rooftop renders.
6. Added coast checks indoors and excluded unsafe inferred cores; tested real movement from ground floor to rooftop and back, keyboard-relative strafe, pause, era changes, source-scene entry/exit and both 16-/32-bit index paths. Spatial bins reduce collision work.

Validation at this checkpoint: 141/141 full-build tests passed; all four native GLES scenes compiled, linked and rendered without GL errors.

Run `node scripts/build.cjs` for the complete build/test gate. The generator rewrites unrelated tracked HTML; do not publish those incidental diffs over concurrent map/search work.

Optional Linux native graphics check (Pillow, Mesa EGL):

```sh
node scripts/qa/gunkanjima-capture-gl.cjs /tmp/jta-gl-qa
python scripts/qa/gunkanjima-render-gl.py /tmp/jta-gl-qa
```

This compiles and replays actual renderer GLSL/draw calls at 1280×800 on GLES2. It does not test browser input, mobile performance or the shadow-map extension. The cloud browser available in this session does not expose WebGL, so browser verification covers the fallback and page UI; it cannot establish real-device graphics performance.

## Remaining evidence and quality work

The 2015 housing study (1952/1970) and 2005 measured-survey volume were located in the NDL catalogue; their full plans/photos were not acquired. The 1986 Saiga photobook is restricted individual transmission. Showakan and museum originals are linked, not represented as incorporated measured data. See `3d/gunkanjima-research.json` for URLs and access notes.

All-building photographic precision, historical colour accuracy and a production-quality Genshin-like environment are not complete. The current study models must not be described as precise reconstructions. Replace each inferred building only after obtaining usable dimensioned plans and photographs, recording the source and confidence of every replacement.

If execution is interrupted, inspect the current GitHub main branch and this checkpoint, preserve concurrent changes, rerun the scoped tests, then publish with a non-forced fast-forward update. Chat transport cannot be restarted from the website or a scheduled job.

## Resume checkpoint — 2026-09-26, second pass

An hourly continuation automation is enabled from 22:30 Asia/Tokyo. It resumes saved work, not the chat transport. It checks for an active run before changing code. Future executions should write `status: in_progress` and an updated UTC timestamp in `docs/gunkanjima-walk-state.json`, refresh it at checkpoints, and clear the active run when done. Treat an unchanged active record older than 90 minutes as a possible interruption; inspect commits before resuming. Never overwrite concurrent map/search work.

A further navigation audit found 159 wall corners outside their host footprint and 633 blocked doorway paths in the previous inferred layout (counts include every floor). Replaced the insufficient room-fit clearance with sampled 2.1 m clearance, maintained a wider stair aisle, and checked coast containment. The revised layout has 1,362 inferred doorways: every tested doorway path is passable and no tested room-wall corner lies outside its footprint/coast. These room counts describe procedural study geometry, not historical dwelling counts. The all-building stair tests still apply.

Second-pass validation: full build 142/142 tests passed; four native GLES views rendered without GL errors.

## Visual continuation — 2026-09-26, renderer v11

Added procedural window frames, mullions and glass variation to the stylised walking view, distance-fading fine details. Restored hemisphere ambient lighting for interior boxes so ceilings and stair undersides are visibly darker. These are aesthetic inferred details, not new historical evidence. High-precision facade shaders retain a mediump fallback and the year uniform's explicit precision; per-building style, floor height and random seeds are quantised before use to prevent interpolation-induced speckling.

Validation: 143/143 full-build tests passed, including all-building stair round trips, 1,362 doorways and both index paths. Four native GLES scenes rendered successfully at normal precision and with the fragment mediump fallback forced. Visual inspection covered outdoor, apartment, stairs and roof. Real browser/device performance and depth-texture shadows remain unverified. No new geometry or downloaded textures were added.

The existing hourly automation `6ab7ba457d548191b74af1d0222b0b92` is enabled, first scheduled at 2026-09-26 22:30 Asia/Tokyo; no duplicate was created. Check `release.json`, the renderer's `const V = '11'`, and the walk HTML's `?v=11` before describing this pass as published.

Next concrete visual issue: the existing source scene `no65flat` opens toward an exposed exterior rather than giving a convincing room view. Improve and visually verify its entry viewpoint, preserving supported movement. Terrain remains coarse and the landscape is still a stylised study, not a finished game-quality reconstruction.

Publication is BLOCKED by automatic approval review: creating the GitHub tree was rejected twice, including after verifying repository ownership/admin rights and the exact published baseline. No v11 source was uploaded. Ask the user to explicitly approve publishing this scoped update to Roman-zebra/Website_history_Github and its existing Cloudflare site before retrying. Local implementation and the 143-test build remain complete.

Publication approval received from the user at 2026-09-26 21:44:57 Asia/Tokyo: reflect and publish the update, and continue. The preceding approval block is resolved.

## Room entry continuation — renderer v12

Verified renderer v11 live: release.json names 5dae01653a586a6b51b11d3653f9fe876e770ca4. Corrected the no65flat walking entry to a supported threshold facing the tatami, table and television, with a downward pitch suitable for the low furnishings. The orbit camera and model geometry are unchanged; this is a curated viewing position, not a historical claim.

143/143 full-build tests passed again, including an explicit entry-position, facing-direction and forward-movement regression under both index paths. Four native GLES scenes rendered with no errors; visually inspected the improved apartment frame. Next work: terrain/environment detail and device interaction verification, plus historical geometry replacements as usable source material arrives.

## Demo checkpoint — renderer v13, 2026-09-26

The user requested immediate repair of transparent/open interior walls, richer interior structures, maximum-stick running, the name デモ版, and a player-centred minimap. The earlier express publication approval remains applicable.

- Walk-only enclosure completion closes cutaway walls and adds ceilings, real window openings, frames, skirting, pilasters, beams and warm lamps in nine source scenes. Outdoor shrine, roof garden and street scenes remain outdoor. The orbital source viewer keeps its cutaways. These additions are explicitly inferred, not measured historical evidence.
- Generated apartments gain glass, crossbars, sills, wall trim, tea utensils and lamps. Gym gains court markings, benches and stage steps. Four nearby warm light pools shade interiors without new image assets.
- Full joystick tilt automatically sprints, with a dead zone and proportional response. Indoor walk/run speeds are 2.8/5.6 m/s and outdoor 4.5/9 m/s. Collision substeps prevent sprinting through thin walls on slow frames. Release, cancellation, lost capture, blur and pause clear movement.
- Minimap keeps the player at its centre at a local scale, pans the coast/buildings, and displays facing direction. Era filtering matches available buildings. Updates at 20 Hz.
- Demo naming is applied to the page and five-language entry links.

Validation: 145/145 full build tests; all generated stairs and 1362 doorway paths; sampled opaque coverage of nine enclosures excluding window/door openings; actual engine run-speed and high-speed wall collisions; touch input and minimap centring/panning/heading checks. Nine native GLES2 scenes render without shader/link/GL errors; gym, school and apartment images inspected. Native replay is not a real iPhone/iPad browser performance test.

Design references searched and read (no extracted game assets):
- GDC 2021, miHoYo producer presentation, *Crafting an Anime Style Open World*: https://www.gdcvault.com/play/1027539 and https://www.youtube.com/watch?v=-JFyAdI_rO8 (presentation listing/summary; not a claim of full video playback).
- Developer interview on composition, framing real-world motifs and edge-based UI: https://apps.apple.com/cn/iphone/story/id1576338984
- PlayStation gameplay preview and embedded play-video listing: https://blog.ja.playstation.com/?p=152914 (article and captures, not a claim of watching the complete video).
- User's interior reference: https://gamewith.jp/genshin/article/show/572711

Applied: layered architectural details, warm/cool interior shading, clear window framing, local navigation and directional feedback. Quality remains a schematic demo, below the reference's production art quality. Next visual pass should target room-specific props, entry-view composition and terrain rather than presenting this as completed photorealistic or Genshin-equivalent reconstruction.

## Classroom visual pass — renderer v14, 2026-09-26

Confirmed v13 production via release.json at a3cb96cb1e5086d0f066e6b5169ff58e0b347e35 before starting. Added inferred notebooks, pencils, shelf books, chalk tray/eraser and abstract chalk strokes on existing school furniture; desk/chair locations and original source scene data are preserved. The walking entry now starts in a supported rear aisle facing the blackboard, showing the full classroom rather than only its windows. The scene explicitly labels these props and strokes as inferred, not historical lesson content.

Validation: 146/146 full-build tests passed. Regression checks keep notebook/page/pencil footprints within supporting desktops, preserve the rear/window/front aisle route, verify entry orientation and actual forward input under both index paths, and retain the all-building stair/doorway tests. All nine native GLES scenes rendered without GL errors; before/after school views visually inspected. No new measured sources were obtained. Browser/device performance remains unverified. This is still a schematic demo, not a Genshin-equivalent finished environment.

Next bounded work: improve one remaining terrain or room-specific visual issue; avoid repeating the school entry/props pass. Check v14 deployment before reporting this checkpoint as live.
## Sky and compact HUD checkpoint — renderer v15, 2026-09-26

User requested published Genshin rendering/programming references, techniques from comparable games, more natural sky movement, and smaller on-screen tap items. Implemented original GLSL based on general public techniques, without importing game code or assets:

- Replaced screen-position cloud blobs with a camera-direction sky ray using azimuth, elevation, aspect ratio and the walking camera FOV. Wind moves two procedural cloud layers at different speeds. Density, underside colour and edge lighting vary with weather; horizon haze and a sun halo support distance perception. This is a lightweight layered approximation, not the full volumetric ray-marching renderer in Horizon.
- Water uses camera-dependent Fresnel-like horizon reflection and subtler ripples/glints instead of strong cyan stripes. Reduced-motion settings freeze procedural sky/water time.
- A compact menu starts closed and groups travel, era, photos, weather, help, view and reset actions. It closes after travel/reset/era changes, opening dialogs, or tapping the world. Smaller header/map/stick/run/interaction items keep more of the world visible. Japanese location/action labels no longer fall back to English.
- Renderer cache version 15, walk UI/CSS version 4; all five entry pages use the current renderer.

Public primary sources inspected:
- miHoYo technical director / Unity Japan, console rendering talk and slides: https://learning.unity3d.jp/7260/ and https://docswell.com/s/UnityJapan/KWRPQ5-210617-unity-dojo20211mihoyozhenzhongyi . Describes shadow/AO, fog, reflections and separate indoor/outdoor lighting. This is methodology, not evidence that Genshin's full source code is public.
- Guerrilla, Nubis production clouds: https://www.guerrilla-games.com/read/nubis-authoring-real-time-volumetric-cloudscapes-with-the-decima-engine . Discusses animation, transitions, atmospheric integration and performance. The previously saved GDC art talk and PlayStation gameplay reference still guide composition/UI; no claim of full video viewing.

Validation: 146/146 full-build tests after merging the concurrent classroom and Japan-map changes. Native GLES2 renders nine world/interior scenes plus four sky states (start, 30 seconds wind, turned view, rain). Sky image differences confirm time/view/weather changes. All 13 compile/link/render without GL errors in both highp and forced-mediump sky paths. Menu open/close plus prior sprint/map interaction tests pass. The cloud browser cannot open the local preview, and its public-site WebGL fallback prevents GPU/performance verification there. Actual iPad/iPhone frame rate remains unverified. Terrain mesh/detail and production-quality building art remain open work.

## Ground material and video research checkpoint — renderer v16, 2026-09-26

Verified v15 live at 9a6db7c25fc471b220a26ee4d26a4769d346fe7b before continuing. User renewed the request to research Hashima walking and Genshin gameplay videos. Found NipponWalkingTour's 2020 4K walk, NCC's 2013 visit with a former resident, Hachiyo's 2024 survey drone footage and Genshin's official Gamescom 2023 Fontaine gameplay listing; URLs and access states are in gunkanjima-research.json. YouTube explicitly required bot verification in the cloud browser, which was reported; no video was watched, downloaded through alternate routes or measured. NCC/Hachiyo publisher descriptions and Hachiyo building-number errata were read. NBC's public 1968 rooftop-garden description documents the largely concrete island and scarcity of natural greenery; subscriber-only footage was not accessed.

Replaced the walking terrain's grass-like aerial-luminance palette with inferred concrete on shallow slopes and rock on steep slopes. Added subtle near-distance paving joints, mottling and continuous diffuse shading; post-1974 surface growth is an inferred visual transition using the renderer's year-minus-1900 convention. Terrain mesh, building footprints and collision dimensions remain unchanged. The huge simplified hillside still needs a source-grounded geometry pass. Added a collapsed video-reference section inside Photo archive and explicit inferred paving/colour notes. Renderer version 16, walk JS version 5, CSS version 4.

Validation: full build passed 146/146 tests; after final year-offset/caveat corrections, all 38 lab-3d tests passed again. Native GLES2 replay compiled, linked and rendered 10 states (nine existing scenes plus 2010 outdoors) without errors. Visually reviewed ground and rooftop views. This is not verification of mobile WebGL performance or precise historic reconstruction.

Next: verify v16 on Cloudflare if publication was interrupted; improve terrain retaining structures/circulation only with usable plans/photos; continue bounded room-specific detail. Do not repeat blocked YouTube playback unless access changes. Preserve concurrent map/search work.

## Terrain penetration, materials and first-person UI — renderer v17, 2026-09-26

User supplied a 14号棟 screenshot and requested a fix for buildings buried in terrain, richer materials, desktop WASD with no stick, removal of third person and Pause, and moving central contextual controls to the top.

The coarse DEM was drawn through building floors. Added a walk-only cut beneath each existing footprint, covering the diagonal of every touching grid cell and blending over a short exterior margin. Render buffers, normals and outdoor collision use the same corrected heights. Original DEM bytes, building footprints/heights and the orbital source viewer remain untouched. This is an inferred clearance correction, not surveyed terrain or a complete reconstruction of retaining walls; tall slopes outside windows can still exist.

Removed third-person chase-camera/avatar code and its API/control. Removed the pause button/dialog; Escape still releases movement and closes controls, and blur/visibility still clears held input. Touch controls follow coarse pointers; fine-pointer desktop layouts hide the stick even in narrow windows. Existing WASD events now have actual movement/release regressions in both index paths. Context buttons, evidence and status occupy a top strip beside the minimap.

Materials: restored procedural detail that the walk shader previously blended down to 35%; improved concrete joints/mottling, plaster variation and continuous diffuse lighting. Replaced a noise hash whose large multiplier lost fractional precision on mediump with bounded arithmetic, restoring variation on that path. These are original inferred materials, not copied game art.

References: Godot official TPS repository tree, licence and tile_painted_gun_metal.tres source read (separate albedo/normal/ORM, roughness/metallic channels and AO); official material-detail/world-space documentation read. No Godot code/assets imported and no claim of implementing the full PBR renderer. Respawn's Broken Moon level-designer article and HoYoverse's Fontaine PlayStation Blog article reviewed. Vimeo Apex gameplay listing found, but human verification blocked playback and was reported; PlayStation browser navigation timed out. No full new gameplay-video viewing claimed. Genshin/Apex full official source release was not confirmed.

Validation: 150/150 full-build tests. For grid strides 1/2/4, 116,918 interior footprint samples each assert that all four interpolation vertices lie below the corresponding floor; far terrain remains unchanged and no heights are raised. WASD moves and stops in the actual engine. Native GLES renders 14 states including all four 14号棟 entry directions and its third floor, plus existing world/interior scenes, with no GL errors in both normal and forced-mediump fragment paths. Visually reviewed 14号棟, stairs and outdoors. Real mobile GPU performance remains unverified.

Cache versions: renderer17, walk JS6/CSS5, buildings4, interiors2. Verify production after deployment, then continue source-grounded retaining walls/terrain and room-specific art. Preserve the requested first-person-only controls in future passes.

## Licensed lighting adaptation and material pass — renderer v18, 2026-09-26

Confirmed renderer v17 live at 8f9c104499e84b6b92f6ed8d9a90e6d505dbb589, including byte-identical renderer/CSS/building files and public desktop DOM checks. Fine-pointer desktop hides the stick, top contextual actions remain, and Pause/third-person controls are absent.

User supplied playlist PLSm8CRLt6aPX_iBhVHL7e1YyLLJGERO2U and video 9xooh3ciIis. Search identified ねみゅさん's 原神～メインストーリー空Ver and episode 2, 序章 第一幕 風を捕まえる異邦人 Part2. Full playback remains unverified because of the unchanged YouTube verification block. No bypass, downloader or extracted video assets were used. The playlist is linked as a future visual reference, not as viewed footage or Hashima historical evidence.

Reviewed all 74 lines of NiloCat's public MIT-licensed SimpleURPToonLitOutlineExample_LightingEquation.hlsl and its full licence. Adapted the soft light threshold and indirect/direct-light maximum composition to the existing WebGL GLSL, with original environment-specific warm sunlight, cool shadow and hemisphere fill. This is an independent tutorial implementation, not leaked, decompiled or official Genshin/Apex source. The shipped licence at 3d/licenses/nilocat-toon-MIT.txt is linked in Help; the reviewed source hash and URLs are recorded in gunkanjima-research.json.

The walking view now separates neutral concrete/wood base colours from lighting, reduces yellow facade bias and excessive mottling, and gives interior lamps warmer local pools against a cooler fill. An original, bounded contact-shade approximation darkens floors below four nearby same-floor furnishings. It is not full SSAO, and does not add meshes or change navigation. Existing terrain clearance, first-person controls, compact HUD, moving sky and player-centred minimap are preserved.

Validation: 150/150 full-build tests; 41 focused tests before the full build. Native GLES compiles/links/renders 18 states (outdoors, four 14号棟 headings and its third floor, four sky/weather states, and eight room/stair/roof views), with no GL errors at normal and forced-mediump fragment precision. Visually inspected outdoor and apartment results. An actual-GPU contacts-enabled/disabled comparison changes 113,254 apartment pixels and 32,683 school pixels, darkening only; the outdoor, stairs and roof sample views are unchanged. Real mobile/browser GPU performance remains unverified. This remains schematic art, not Genshin-equivalent production geometry or measured historic colours.

Cache versions: renderer18, walk JS6/CSS5, buildings4, interiors2. Verify Cloudflare publication and the served MIT notice if interrupted. Next bounded work should improve authored room/terrain detail using usable historical references, not repeat this lighting pass or claim the playlist was watched. Preserve concurrent map/search changes and all first-person-only UI decisions.

## Video-reading tools and verified publication — 2026-09-26

Renderer v18 is verified live at 4cdf210ed7a6a8c13248ff39f0fdb76f958f881f through release.json, byte-identical renderer and MIT licence downloads, and the public browser DOM. The browser loads renderer18 and both new reference/credit links; fine-pointer desktop still hides touch controls, the context strip is at y=68, the menu starts closed and Pause/third-person buttons remain absent. Browser GPU testing is still unavailable.

User additionally requested a downloadable video-reading tool. FFmpeg/ffprobe 6.1.1 are already installed in the current runtime, so no additional download was needed. Added `scripts/qa/gunkanjima-video-frames.cjs` to inspect locally supplied, authorized clips and extract a bounded set of JPEG frames plus metadata into a fresh temporary directory. It accepts no website URL, passes only file/pipe protocols to FFmpeg and has no cookie, downloader or verification-bypass feature. Official tool documentation: https://ffmpeg.org/ffmpeg.html and https://ffmpeg.org/ffprobe.html .

Usage: `node scripts/qa/gunkanjima-video-frames.cjs /absolute/path/clip.mp4 0 5 12` (start seconds, sample interval seconds, maximum frames). Inspect the actual output images before making visual claims. Sampling does not mean the complete video was watched; the manifest does not claim exact original-frame timestamps. Do not publish extracted game art without appropriate reuse rights. If the runtime changes, check for ffmpeg/ffprobe before use.

Validation used a generated three-second H.264 test clip, not the user's YouTube video: metadata read successfully and six 640x360 frames extracted at 0.5-second sample intervals. Website URLs and start times outside the clip are rejected. The YouTube playlist remains unviewed; uploaded clips/frames or a change in authorized playback access are still needed for direct visual analysis of it. This developer utility does not add a video-upload feature to the public site.

## Source-labelled circulation pass — Jigokudan, 2026-09-26

Renderer v18 was first verified live at 4cdf210ed7a6a8c13248ff39f0fdb76f958f881f. The official Nagasaki City restoration/public-use plan and its summary confirm island-wide 3D laser recording and treat seawalls and retaining walls as separate conservation components, but the published diagrams do not provide reusable dimensioned stair or retaining-wall geometry. No new large retaining wall or measured route was invented from them.

The existing shrine scene already contains 46 translucent steps for the documented Jigokudan route and cites 1992 shrine photographs, the Hashima record site and Gunkanjima Digital Museum. It also already labels the exact line as inferred. The source scene is preserved. For the walking page only, tread heights are evenly interpolated between the existing endpoints so every rise fits the collision limit; authored horizontal positions, count and box dimensions remain unchanged. On the route, the nearest labelled tread takes priority over the overlapping terrace, and two intersections with a coarse decorative rock volume no longer block movement. The rock remains visible. Position, step count, gradient and rock shape are not claimed as measured reconstruction.

Validation: 151/151 full-build tests. A new regression walks all 46 tread centres downward and back upward, verifies sub-0.4 m transitions, preserves the source object and checks walking adjustment idempotence. The existing 68-building stair round trips, 1,362 doorway paths, sea boundary, first-person input and both index paths still pass. Native GLES2 compiled, linked and rendered 11 views including the shrine and an oblique stair inspection without GL errors; the rejected translucent-rock experiment was reverted after it obscured the frame. Real mobile/browser GPU performance remains unverified.

Cache versions: renderer18, walk JS6/CSS5, buildings4, interiors3, navigation3. Cloudflare release.json reached 655ab4f58decd932877648acd372884c70978966; the public HTML requests both v3 assets and their served bytes match the tested local files. A dimensioned shrine stair survey is still required before replacing the inferred route with a measured reconstruction.
