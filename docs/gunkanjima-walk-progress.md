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
