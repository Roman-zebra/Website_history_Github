# Sengoku-realism video study and walking renderer v22 — 2026-09-27

## What was studied

The user asked for every visual element of one gameplay recording to be applied to the whole Gunkanjima walk: all structures and spaces, iterated until the island reads like that game's world and graphics. The extraction method was to match the previous study: one frame per second plus a full transcription.

- Source: a 39:45 gameplay recording of *SEKIRO: Shadows Die Twice* (boss fights across most of the game's areas), supplied by the user as `20260927052408.mp4` through a Google Drive share link. The Drive connector could not see the file, so it was downloaded from the public share link.
- File: 2,385.4 s, H.264 640 × 360 at 30 fps with AAC audio, 171,844,632 bytes. SHA-256 `d644d8916147fe6073e482678a960214b7888a9c3cd0768036c541106c879021`.
- Transcript: made locally with faster-whisper `large-v3-turbo` (Japanese, no voice-activity filter) over the whole soundtrack. It has 157 timed segments. The recording is mostly combat sound and music, so the transcript holds little beyond occasional lines and on-screen banners, and it contains mis-hearings. It informed nothing visual and is not quoted.
- Frames: 2,385 JPEGs, one per second, laid out on 150 sixteen-frame contact sheets. Every sheet was inspected in five time ranges, and single frames were viewed at 2–5× for materials and light.
- Colours were measured on HUD-masked frames (k-means palettes, medians of material regions, luminance percentiles, split-tone means). The stream is soft and compressed and loses saturation in reds, so treat hex values as about ±10 per channel and trust relationships (darker, warmer, lower contrast) over absolute values.
- None of the video, audio, transcript or frames is committed to this repository or served by the site; they stayed in the session's temporary workspace. No game asset, texture, shader or code was used. Everything in the renderer is original procedural code that follows the visual principles below. The public UI names the look neutrally, 戦国・写実 (Sengoku, realistic).

## What the recording shows, in order

| Time | Places and light |
|---|---|
| 00:00–04:47 | A snowy battlefield below a castle gate under a peach haze, a burning hall lit only by its roof, then a castle keep top in clear weather and in a slate-blue storm. |
| 04:48–08:00 | A temple complex in milky white fog (snow-striped tile roofs, red maples, lattice scaffolds), dark lattice rooms, then a forest pond in teal mist with pale dead trees and leaf mats. |
| 08:00–12:45 | A snow-dusted gorge pond and a dim gorge floor below cliffs: cold teal-grey, very low contrast. |
| 12:46–15:59 | A forest clearing with stone terraces and lanterns; the keep's open top hall at sunset (warm low sun, long hard shadows, a snowy mountain panorama), then the same hall on fire. |
| 16:00–23:59 | The keep gallery at sunset, a burning estate courtyard at night ringed by stone walls, and snowy temple grounds with a vermilion bridge and maples on an overcast day. |
| 24:00–31:59 | An arched bridge under an old maple, a sea of clouds under a moonlit overcast sky, a lightning storm, and a night battlefield below the castle walls with palisades, banners and bonfires. |
| 32:00–39:44 | The burning snowy battlefield at night (cold teal ambient against hot fire), then a silver-grass field at night through overcast, storm and a cold post-fight grade. |

## Visual rules drawn from it

1. One sky sets one hue family for the whole frame: sky, fog, ambient light and grade move together (rose-grey dusk, slate storm, milky white fog, teal forest, blue-black night).
2. Blacks are lifted and tinted; true black appears only in fades. Highlights roll off softly; only fire, the sun disc and effects clip.
3. Environments are muted (saturation about 0.07–0.19). Colour is kept for accents: red maples, fire, banners.
4. Strong fog that matches the sky: contrast halves within 20–60 m and the distance breaks into two to four flat silhouette layers. Distant ranges keep under 20% contrast.
5. Height fog and bright ground-mist bands hug water and floors.
6. Clear weather means hard sun with long shadows and warm light over neutral-to-cool shade; overcast and fog are shadowless.
7. Snow is a layer on what faces up (never pure white): tile ribs, rails, ledges, drifts against walls. Wetness shows as gloss and blurred sky reflections.
8. Everything is worn: bleached or charred timber, stained plaster, moss and grass on tiles and ledges.
9. Architecture is repetition: posts, beams, railings, lattice windows, tiled eaves, stone bases (ishigaki).
10. Vegetation is dry and soft: tan pampas and straw, black pines, red maples, bare trees. The only greens are muted olive moss.
11. Sparse particles are always present (ash, leaves, embers, snow). Post-processing is restrained: bloom on fire and sun, no visible grain, no chromatic aberration.

## What was implemented (walking view, 戦国・写実 look)

The look is the walking view's default. The previous look stays available as アニメ調 in the look menu and renders pixel for pixel as in v21. The orbit view is unchanged.

- Lighting and grade: linear light (gamma 2) with a filmic curve, a sky/ground hemisphere ambient, warm bounce, lift/gamma/gain per sky, exponential height fog with drifting banks and sun in-scatter, cloud shadows computed once per fragment. Six skies: dusk, overcast, rain, mist, snow and night.
- Sky: horizon colours by azimuth, a sun or moon disc, stars at night, a lit cloud deck and cirrus, and three layered ranges to the north-east with sharp summits; only the highest peaks carry snow.
- Buildings (rule 9): the apartments, the 1918 housing and the school become a castle quarter. Each has old white plaster between dark timber posts and beams, black clapboard on the ground storey over a stone base, a tiled pent roof along every floor line with its dark underside and sun shadow, and a tiled coping. Openings are wooden lattice or paper screens with torn holes, a few glowing at dusk and night in the inhabited years; there is no glass. Workshops become board-and-batten storehouses on a rubble plinth. Wooden houses keep dark clapboard under plaster; the shrine is plaster and timber. Weathering follows rule 8: rain streaks, small ragged patches of fallen plaster showing clay and lath, sparse wandering hairline cracks, moss at the foot and on the tiles.
- Ground: worn stone slabs with mossy joints, dark rock, packed earth and straw grass, fallen leaves, paths with dusty and damp patches, fine grit and a few pebbles near the walker, snow on what faces up, wet sheen and puddles that mirror the sky.
- Sea and sea wall: dark slate water, sky by Fresnel, a glitter path under a low sun, fine ripples near the walker, and lacy foam at the wall. The sea wall has staggered dark blocks, a black-green tide band and dry grass on the crest.
- Vegetation (rule 10): straw grass gathered into tussocks, pampas plumes on visible stems, maples in three tiers, black pines with cloud pads, dead trees, dark shrubs. Near the walker, leaves and needle tufts are drawn individually and cut out along the silhouette.
- Props and fire: bonfires and braziers with flame, ember, smoke and glow sprites that light what faces them (the four nearest fires), stone lanterns, jizo with red bibs, and nobori banners. Fires, lanterns and jizo block walking.
- Particles: tumbling leaves, drifting ash and crows; snowfall in the snow sky.
- Interiors: lamplight pools, a little daylight through the openings, and dark corners.

### Adapted

- The recording's castle keeps have pitched multi-tier roofs. The island's buildings keep their real outlines, heights and flat roofs, so the pent roofs, lattice and plaster are painted on the walls with depth taken from the real sun direction ("depth without geometry").
- Fire light is limited to the four nearest fires, and smoke is a few soft sprites rather than volumetric columns.

### Not implemented, and why

- Characters, combat effects, blood, the HUD and the calligraphy banners: they are not part of the world.
- Motion blur, depth of field and lens flares: they cost too much for the walk and are absent from most of the recording's quiet frames.
- Any game asset or likeness of a specific place in the game: the look follows general principles only.

## Rendering fixes made along the way

- Per-look shader variants. The first version chose between the two looks with a uniform branch. GPUs that flatten such branches (SwiftShader did) then ran both looks for every fragment, and a frame cost about 1.9× v21. Each look now compiles its own programs (`#define SENGOKU`), which are rebuilt in place when the look changes. A GPU that cannot build the sengoku variant falls back to the anime look instead of losing the 3D view.
- Wall top. `vWall.z` is interpolated up each wall face like `y`, so in the fragment shader "height of the wall" always equalled the current height. Every top-of-wall effect therefore covered whole walls, including snow in the snow sky. The sengoku look now uses the storeys from `vTop`.

## Performance

Chromium with SwiftShader at 1100 × 680 (a software renderer, so compare ratios and ignore the absolute times):

| Build | Median frame |
|---|---|
| v21 (published) | 1,258 ms |
| v22, anime look | 1,251 ms |
| v22, sengoku look before per-look variants | about 1.9× v21 |
| v22, sengoku look | 1,709 ms (1.36×) |

The look's detail is faded out with distance (grit, pebbles, leaves, cracks, fallen plaster), and the quality tiers still cap the render scale. Real phone GPU frame rates remain unverified.

## Colour check against the recording

Split-tone means (Lab) over twelve survey views at dusk, against the recording's sunset frames (13:50–16:49):

| | Shadows L / b | Mid-tones L / b | Highlights L / b | Local contrast |
|---|---|---|---|---|
| Recording, sunset | 13.8 / 4.8 | 30.0 / 9.5 | 55.7 / 15.3 | 2.6 |
| v22 dusk | 17.2 / 6.7 | 34.4 / 10.3 | 60.0 / 14.5 | 1.3 |

Hue and warmth match. The walk is still a little lighter in the shadows and has about half the recording's fine local contrast, which geometry detail and textures give the game. That is the main gap left.

## Validation

- 168/168 tests in `node --test tests/*.test.cjs`, including new checks that the walk opens in the sengoku look with six skies, that props are placed on land away from footprints, paths and each other, that the sengoku meshes fit 16-bit indices, and that switching looks rebuilds the programs with and without the variant define.
- Native GLES2 replays of the real shader and draw calls (Mesa llvmpipe) without GL errors: the island survey, streets and coast, nature and sky views, all six skies, the props at dusk and night, ten interiors and the anime look.
- The anime look's replay is byte-identical to its render before this round.
- A private demo of the branch was prepared for the user's review before any publication.
