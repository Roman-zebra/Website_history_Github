# Stylised-nature video study and walking renderer v20 — 2026-09-26

## What was studied

The user asked for one video to be transcribed in full, sampled once per second, and for everything it describes to be tried in the Gunkanjima walk, with placeholder vegetation and textures allowed and no historical fidelity required.

- Video: 「Claude CodeとUnity MCPでアニメ調のオープンワールドは作れるのか？」, https://www.youtube.com/watch?v=QGaqvRLpx3U . A Japanese creator's devlog about building an anime-style open field in Unity 6 (URP), with Claude Code driving the editor through Unity MCP.
- Acquisition: the cloud browser's YouTube page demanded bot verification. That check was reported to the user and not bypassed. The user then supplied the file through a Google Drive share link.
- File: 3,883.1 s, H.264 640 × 360 at 30 fps with AAC audio, 151,792,213 bytes. SHA-256 `95eedbe27c833b48eb0c6a0b48524252a0f5dd7d34b4ba7cdf226c9b2aca29ef`.
- Transcript: made locally with kotoba-whisper v2.0 (faster-whisper) over the whole soundtrack. It has 1,455 timed segments, is machine-made and contains mis-hearings. The video has no speech after about 64:15.
- Frames: 3,883 JPEGs, one per second, laid out on 243 sixteen-frame contact sheets. Every sheet was inspected in eight time segments. On-screen text (Inspector values, chat logs) was read from upscaled crops, and from 4–30 fps re-extractions where text scrolled.
- Colours were sampled from compressed 640 × 360 frames. Treat them as approximate (about ±10 per channel); the Unity views clip the green channel.
- None of the video, audio, transcript or frames is committed to this repository or served by the site. They stayed in the session's temporary workspace. This note paraphrases; it does not quote the transcript.

## What the video says, in order (paraphrased)

| Time | Content |
|---|---|
| 00:00–02:12 | Teaser of the final field (grass manager, fences, rocks, airships) and the question: can an AI build an anime-style open world through MCP? |
| 02:13–08:15 | The creator gives the AI a reference illustration and one vague prompt. After about 30 minutes of autonomous work: a gradient sky, billboard clouds, grass, a pond and a path. He criticises the result: spiky "pixel-art" grass, a glossy ground, a white band on the horizon (fog tinted too white), and a water quad poking through the ground. |
| 08:16–16:31 | Fixes and additions: the sea-level pond, flowers facing up, a fence, soft path edges, distant mountains drawn in the sky shader, the final grade, flat-shaded low-poly trees and rocks sharing one material (about 2,200 triangles), and a stacked-tier conifer rebuilt from a pasted image. |
| 16:32–24:31 | The pivot, and the video's main lesson: instead of letting the AI paint the scene, have it build **tools with exposed parameters** and let a human tune the look by eye. Three AIs review the design. Noise, flower, cloud and plant textures are made. A slope-painted terrain tool arrives, and later quality presets (mobile 0.5 density / 60 m, mid 0.8 / 120 m, PC 1.0 / 200 m). |
| 24:32–32:31 | The "KT Grass Manager": ground and grass share **one world-space colour field**. It has a five-tint ramp with season presets and four scrolling overlays: teal mottling, yellow sheen, white glints and drifting teal cloud shadows. Distant grass thins out between 16 m and 39 m. A bug is found: grass looked darker than the ground. The fix is to light the grass with an up-facing normal. Then a path-sinking tool. |
| 32:32–40:31 | Tour of the finished demo meadow: a sunken path that keeps the relief, an anime water shader (Voronoi cells, star glints, four foam bands), a ring of cloud cards, petals, wind lines, sparkles and god rays. Then a live test: the AI turns a diorama image into a 200 m field and scatters about 90 trees in clusters. It removes trees within 5 m of the path centre, finds a broken shader, and notices fog washing out the field. |
| 40:32–48:31 | Tree clean-up. An out-of-palette lime tree is replaced; trees are scaled to about 6× the character with ×0.82–1.18 variation; overlapping canopies are culled at 0.65. Fog density is lowered. A horizon cloud bank and an invisible boundary are added, and the layout is rebuilt from the reference image. |
| 48:32–56:47 | Props. A realistic asset pack is rejected, and everything moves to one toon shader with tinted shadows and self-made low-poly models (mossy ruins, rocks). Fences get rope lashings and end posts. A plank bridge is arched, with posts only at its ends. Airships fly in a V with ring trails. The creator concludes that fine placement is faster by hand. |
| 56:48–64:42 | Manual fixes and slope soil auto-paint (28°, 10° blend). Colliders are made tighter (convex per object), and the pond walls are redone so the bridges connect. A small game layer is added (enemies, 9 switches, a portal). The verdict: mostly possible if you build tools first. A final montage shows the look: sky #6BC8F8→#BCE8F7, butter-yellow paths, grass tips #BBE762 over bases #55A014, saturated green shade, pale mint water with sparkles and a bright rim. |

## What was implemented (walking view only)

Everything below is **illustrative placeholder dressing** for the walk page. It is not evidence of Hashima's vegetation or scenery. The walk's help text and the new tuning panel both say so in all five languages. The orbit/reconstruction pages keep their look; of these changes they share only the shader-precision fix below.

| Video technique | Implementation |
|---|---|
| One colour field for ground and grass; five-tint ramp; season presets | `meadowColor()` is shared by the terrain, every blade, wall-base creep and tufts. Five presets (spring, summer, autumn, winter, magic) recolour the ground, grass, trees, bushes, ivy and fern accents together. Vegetation shade takes the palette's darkest hue. |
| Four overlays | Teal mottling (multiply), pale-yellow sheen (add), white wind streaks (ground; kept off steep banks), and drifting cloud shadows projected along the sun. The shadows are teal, never grey, and sweep over the ground, walls and roofs alike. |
| Grass lit like the ground | Blades are lit with the up normal through the same toon light. They have a root-to-tip gradient, travelling gust highlights, touch response around the walker, and clumps of three with ×0.64–1.9 scale and dark fern accents. |
| Distance thinning, quality tiers | A dense camera-centred patch (38 m; 30 m on low-end devices) plus a sparser far ring to 84 m on desktop. Quality tiers: auto; light (half density, no far ring, no bloom); standard (0.8); high. |
| Flowers facing up | Cosmos-like heads on stems, facing up and tilted toward the walker, with outlines. Round flower speckles on gentle ground at mid distance. |
| Sunken paths, soft edges, slope soil | Worn butter-cream paths are lowered 0.22 m relative to the existing surface, with darker feathered banks. Slopes steeper than 28° (10° blend) turn olive-yellow soil; the angle is adjustable. |
| Anime water | Sea: turquoise shallows, drifting Voronoi cells, star glints, a foam line and four travelling bands. Pond: mint gradient, twinkles, a pale band, an inner ring and a white foam line at the rim. |
| Sky, distance, clouds | A four-stop gradient (exponent 1.4, horizon sharpness 3), cel cumulus puffs, a warm-white horizon cumulus bank, pale distant ridges and sea drawn in the sky shader, and cyan aerial haze. |
| Trees, rocks, props in one toon material | Round clustered canopies and five-tier zig-zag conifers, flat-shaded from dark green at the bottom to yellow-green at the tip. Bushes, some flowering. Light warm-grey faceted rocks with moss and crack strokes. Mossy concrete pillars and a fallen gear as an overgrown ruin. |
| Scale, overlap culling, exclusions | Trees ×0.82–1.18 with occasional ×1.45 hero trees, and canopy overlap culling at 0.65. Nothing is placed inside any building footprint of any era, in the sea, at the arrival point, or on paths; tree canopies keep at least 3 m from worn paths. |
| Fences, bridge, colliders | Post-and-two-rail fences with rope lashings and taller end posts, along coastal drop-offs and beside worn paths. An arched plank bridge with posts only at its ends and a deck flush with the banks. The walker stands on the real deck height; trunks, large rocks, ruins, fence rails and the pond (except under the deck) block walking. |
| Ambient life, light | Drifting petals, twinkling motes, butterflies (white, yellow, lilac, blue), god rays when facing the sun, an occasional wind swirl, a light bloom pass, a warm high-key grade and faint film grain. |
| Tuning panel (the main lesson) | Menu → 見た目の調整: season presets, quality, 19 sliders (brightness, saturation, contrast, warmth, grass, flowers, cloud shadows, distant hills, haze, wind, meadow mottling/sheen, wind streaks, slope angle, water pattern size, sparkle, particles, bloom, grain), reset, and copy/paste as JSON. The renderer accepts only known keys and clamps every value. Settings are kept only in the viewer's browser. |
| Barren walls | Rain streaks under sills, balcony laundry and pots, meadow-coloured creep at wall bases, painted brush strokes, hairline cracks, mossy sills, and ivy drawn as overlapping leaves. Roofs get rooftop vegetable beds. |

### Adapted

- Airships in a V formation became five seabirds crossing at about 58 m (same spacing and timing idea); airship ring trails were not carried over.
- The video's cave, shrine and tower landmarks became a row of mossy concrete pillars and a fallen gear, which suit an abandoned mining island.
- Unity's per-object convex colliders became circles for trunks, rocks and pillars, segments for fence rails, and an explicit pond disc with the bridge deck as the opening.

### Not implemented, and why

- Combat, enemies, the nine-switch objective, the portal gate, warp rings and the player mascot: gameplay unrelated to scenery, and out of place on a historical site.
- AI-generated sprite atlases and Tripo meshes: vegetation and props are generated procedurally in code, so no third-party or generated image assets are shipped.
- Level-of-detail meshes: the placeholder meshes are already small and batched.
- Debug colour-coding of layers and collider wireframes: developer aids; the QA scripts and tests cover the same checks.
- The three-AI design review and hand-placement workflow: process advice rather than features.

## Rendering fixes made along the way

- While walking, the shadow box follows the walker (150 m, or 110 m on low-end devices), reaches further ahead than behind and is snapped to whole texels. Near shadows are about three times sharper, and they fade out at the box edge.
- The ground, roof, sea-wall and grass fragment shaders use high precision where available. World-space patterns a few hundred metres from the origin no longer turn blocky at mediump on phones.

## Validation

- `node scripts/build.cjs`: 161/161 tests pass. The new checks cover the tuning panel's restore, save, preset, paste and reset paths; renderer-side key filtering and clamping; the bridge deck height and the pond and fence blocking; fences off paths and beside them; and tree canopies clear of paths.
- Native GLES2 replay (`scripts/qa/gunkanjima-capture-gl.cjs` with `--nature` and `--sky`, then `gunkanjima-render-gl.py`): 21 renders compile, link and draw without GL errors. They cover the bridge, a conifer, a path fence, the ruins, the arrival point, the sky while turning and in rain, and the interiors.
- Chromium with SwiftShader, at desktop 1100 × 680 in Japanese and phone 390 × 780 in English: the scene loads, the panel builds 19 sliders from the renderer's ranges, the autumn preset recolours the scene, the setting is stored, and no page errors are logged.
- Not verified: frame rate and appearance on a real phone GPU.
