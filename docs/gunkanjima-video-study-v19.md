# Gameplay study and walking renderer v19 — 2026-09-27 JST

## Actual video inspected

Publisher page: https://www.gamersyde.com/video_genshin_impact_pc_gameplay_video_1_4k-45293_en.html
Article: https://www.gamersyde.com/news_genshin_impact_4k_videos-21859_en.html

Gamersyde / Driftwood, Genshin Impact PC gameplay video 1, published 2020-10-01. The ordinary public HTML video source supplied the downloaded reference. No YouTube/Vimeo verification bypass was used. Full file: 882.197 seconds, H.264, 960 × 540, 30 encoded frames/second, 216,484,149 bytes. SHA-256: `56b3aaea71b222972b738d54c2a9fd424bbcd9e9e02d797d18444270b8e5afdc`.

FFmpeg/ffprobe were already installed. `scripts/qa/gunkanjima-video-frames.cjs <local-file> 0 1 600` extracted **600 JPEGs in one-second bins over the first ten minutes**. All ten 60-image contact sheets were visually inspected. These include gameplay, menus, dialogue and cutscenes; they are not ten minutes of uninterrupted walking. Exact original-frame timestamps were not measured. The helper now permits up to 900 samples and still accepts local files only.

The publisher's separate 4K stream was probed as 3840 × 2160 / 60 fps / 882.197 seconds. A subsequent 4K still acquisition was cancelled by the network approval layer and was not completed. Composition/motion study therefore uses the downloaded 540p stream, not a verified 4K image. Encoded resolution does not establish internal game rendering resolution, texture dimensions or runtime FPS. One-second samples do not establish frame pacing or smoothness at 60 fps. No publisher video/images are redistributed with the website.

Observed examples (approximate sample times):

- 00:03–00:34: clear beach rocks, shallow-water colour transition and readable shadow shapes.
- 00:45–01:20: layered foreground rocks, vegetation and distant terrain; environmental light gradients remain continuous.
- 02:24–02:36 and 03:01–03:23: distant city/mountains become cooler and lower contrast while nearby rocks retain definition.
- 03:27–03:41: animated water and traversal ripples.
- 04:21–05:10: relatively stable dialogue camera provides a reference for restrained background motion.
- 05:18–06:26: traversal/combat UI occupies the edges, preserving the central scene.
- 07:25–08:48: dialogue and repeated choice frames; avoid treating repeated frames as distinct visual evidence.

## Public technical references actually read

- Pavel Kornev / Anfin3D's own renderer analysis: https://habr.com/ru/articles/874866/ . Describes separate environment/character rendering, sky/fog coupling, vegetation and pass ordering. This is an individual's non-official analysis of a particular implementation, not the game's released source. Profiling/bypass instructions in that article were not executed.
- Godot's actual public shader: https://github.com/godotengine/godot/blob/master/servers/rendering/renderer_rd/shaders/environment/sky.glsl . Read `fog_process`, including sky-coloured fog and directional sun scattering. The walking shader uses a small, original WebGL-compatible implementation informed by this method; it is not a Godot engine port. MIT notice retained in `3d/licenses/godot-MIT.txt` and linked in Help.
- Crytek / Tiago Sousa, GPU Gems 3, chapter 16: https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-16-vegetation-procedural-animation-and-shading-crysis . Read height-dependent vertex bending and phase separation. JTA uses original bounded sine displacement; no proprietary Crysis code/assets imported.
- Existing NiloCat MIT lighting adaptation and notice remain. No Genshin/APEX private source, extracted game assets or hidden command set was obtained or claimed.

## Applied changes

- Broadened environmental light response to keep continuous shading across concrete, wood and rocks instead of saturating the bright band early.
- Walking-only, distance-based atmospheric perspective begins beyond 24 m, using sky colour and mild sun-facing warmth. The source photo viewer retains its previous fog curve.
- Existing foliage uses an additional per-vertex normalized canopy-height attribute; its base stays fixed. X-axis sway amplitude is 3.5 cm in normal weather and 7.5 cm in rain; Z amplitude is 55% of that. Non-foliage geometry remains stationary. Reduced-motion preference sets amplitude and animation time to zero. Wind buffers are freed when changing scenes.
- English archive/help/source captions, initial era, loading/weather fallback and accessible labels now pass through translations. Native language names remain native in the selector.
- Pinch uses incremental distance so reversing from a zoom clamp responds immediately; lost capture and blur clear gesture state. Ctrl/Cmd browser zoom is no longer intercepted. Walking canvas permits browser pinch zoom; coarse-pointer selects use 16 px text to avoid Safari focus zoom. No disabling of user zoom.

Unresolved: actual iPhone Safari gesture verification and mobile GPU performance; measured historical interior plans; the broader terrain still uses a simplified reconstruction. This is an incremental demo improvement, not a claim of matching the commercial game's asset quality.
