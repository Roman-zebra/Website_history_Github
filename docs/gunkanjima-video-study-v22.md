# Realistic-look video study and walking renderer v22 — 2026-09-27

## What was studied

The user asked for every visual element of one gameplay recording to be applied to the whole Gunkanjima walk: all structures and spaces, iterated until the island reads like that game's world and graphics. The extraction method was to match the previous study: one frame per second plus a full transcription.

- Source: a 39:45 gameplay recording of *SEKIRO: Shadows Die Twice* (boss fights across most of the game's areas), supplied by the user as `20260927052408.mp4` through a Google Drive share link. The Drive connector could not see the file, so it was downloaded from the public share link.
- File: 2,385.4 s, H.264 640 × 360 at 30 fps with AAC audio, 171,844,632 bytes. SHA-256 `d644d8916147fe6073e482678a960214b7888a9c3cd0768036c541106c879021`.
- Transcript: made locally with faster-whisper `large-v3-turbo` (Japanese, no voice-activity filter) over the whole soundtrack. It has 157 timed segments. The recording is mostly combat sound and music, so the transcript holds little beyond occasional lines and on-screen banners, and it contains mis-hearings. It informed nothing visual and is not quoted.
- Frames: 2,385 JPEGs, one per second, laid out on 150 sixteen-frame contact sheets. Every sheet was inspected in five time ranges, and single frames were viewed at 2–5× for materials and light.
- Colours were measured on HUD-masked frames (k-means palettes, medians of material regions, luminance percentiles, split-tone means). The stream is soft and compressed and loses saturation in reds, so treat hex values as about ±10 per channel and trust relationships (darker, warmer, lower contrast) over absolute values.
- None of the video, audio, transcript or frames is committed to this repository or served by the site; they stayed in the session's temporary workspace. No game asset, texture, shader or code was used. Everything in the renderer is original procedural code that follows the visual principles below. The UI calls the look 写実 (realistic). Its first version, 戦国・写実, reinterpreted the island as a Sengoku castle town; after the first review it was changed to the island's own era (see below).

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

## What was implemented (walking view, 写実 look)

The look is the walking view's default. The previous look stays available as アニメ調 in the look menu. The orbit (aerial) view is unchanged.

- Lighting and grade: linear light (gamma 2) with a filmic curve, a sky/ground hemisphere ambient, warm bounce, lift/gamma/gain per sky, exponential height fog with drifting banks and sun in-scatter, cloud shadows computed once per fragment. Six skies: dusk, overcast, rain, mist, snow and night.
- Sky: horizon colours by azimuth, a sun or moon disc, stars at night, a lit cloud deck and cirrus, and three layered ranges to the north-east with sharp summits; only the highest peaks carry snow.
- Buildings, in the island's own materials and years (rules 8 and 9 applied to period architecture):
  - The housing blocks and the school are weathered grey-beige reinforced concrete: floor-slab edges with a shadow line, rain streaks and soft water stains under the sills, pale leaching, thin rust lines from rebar, a few spalled patches showing aggregate and a rusted bar (more after 1974), sparse hairline cracks, moss at the foot and on ledges.
  - Windows are recessed period sashes: painted wooden frames on the housing, a finer steel grid on the school and the mine, glass that mirrors the sky, curtains or paper screens behind in the inhabited years, dark rooms with broken or boarded panes after 1974, and a few rooms lit at dusk and night. Laundry hangs from poles at some window heads until 1974, with folds and a soft shadow.
  - The mine uses the model's structure field: brick for the brick winding house, corrugated iron on a steel frame (faded paint, rust from the laps), otherwise concrete sheds. Wooden houses are weatherboarded or rendered in mortar; the shrine is plaster and timber.
  - Below ground level and on the foundations that now reach down slopes, board-marked concrete.
- Ground: worn stone slabs with mossy joints, packed earth and grass, paths with dusty and damp patches, fine grit and a few pebbles near the walker, a fine bump in the lighting so low sun shows relief, snow on what faces up, wet sheen and puddles. Steep cuts in the hill are coursed masonry retaining walls.
- Sea and sea wall: dark slate water, sky by Fresnel, a glitter path under a low sun, fine ripples near the walker, lacy foam at the wall; the wall has staggered dark blocks, a black-green tide band and grass on the crest.
- Vegetation (rule 10, in late-summer greens by default; autumn, winter, spring and a fantasy palette remain in the menu): grass gathered into tussocks, each blade with its own rounded two-sided normal, sheen and back-light; pampas plumes on visible stems; trees and shrubs with individual leaves and needle tufts near the walker, cut out along the silhouette.
- Props of the period: drum-can fires and a few open fires that light what faces them (the four nearest), wooden utility poles with street lamps, and a few jizo. Fires, poles and jizo block walking.
- Particles: tumbling leaves, drifting ash and crows; snowfall in the snow sky.
- Interiors: lamplight pools, a little daylight through the openings, and dark corners.

### Adapted

- The recording's world is castle and temple architecture. At the user's request the island keeps its own architecture and period materials; what carries over is the recording's treatment of light, air and wear: one hue family per sky, fog that matches the sky, soft highlights, worn and stained surfaces, and depth in every opening.
- The island's buildings keep their real outlines, heights and flat roofs. Depth in the facades (window recesses, slab edges, galleries) is taken from the real sun direction rather than modelled ("depth without geometry").
- Fire light is limited to the four nearest fires, and smoke is a few soft sprites rather than volumetric columns.

### Not implemented, and why

- Characters, combat effects, blood, the HUD and the calligraphy banners: they are not part of the world.
- Sengoku architecture and props (castle facades, war banners, braziers): tried in the first version and removed after the review, because they do not fit the island's era.
- Motion blur, depth of field and lens flares: they cost too much for the walk and are absent from most of the recording's quiet frames.
- Any game asset or likeness of a specific place in the game: the look follows general principles only.

## First review and what changed

The user reviewed a private demo of the first version and asked for three things: colours that fit the island's era instead of a Sengoku reinterpretation; flat-looking fine surfaces such as grass to be fixed; and buildings that looked joined, stuck out of the hill or overlapped to be fixed. What changed:

- Period instead of Sengoku: the castle-quarter facades (plaster between timber, pent roofs, lattice and paper-screen openings) became the period concrete, brick, corrugated iron and weatherboard described above; nobori banners and tripod braziers were removed; stone lanterns became utility poles with street lamps; bonfires became mostly drum-can fires; the default season became late summer; the look was renamed 写実 in all five languages.
- Geometry, measured on the model: in 1962 eleven pairs of buildings standing at the same time have overlapping footprints (up to about 30 m², for example Building 30 with an unnamed annex, and the belt conveyor and a crane with wooden houses), and adjoining blocks share walls. Thirty-five buildings have terrain more than 1.5 m above their floor under the footprint (up to 19 m), and twelve stood more than 1 m above the terrain on their downhill side (up to 6 m). Now a wall face whose outer side lies inside another building standing in the same years is cut down to that building's roof, with separate pieces for the years when the other building did not stand; walls on slopes reach down to the lowest terrain along and in front of them as a foundation; and the steep faces left by the terrain cuts are drawn as masonry retaining walls.
- Wall normals: the stored wall normals pointed into the buildings (the winding, not the normal, decides which side is drawn). The walking view now stores outward normals, so walls are lit on the side that faces the sun, and window recesses show the correct jambs, soffits and sills. The aerial views keep their old normals; this is noted for a later fix.
- Flat surfaces: grass blades had all been lit with an up-facing normal, like paper; they now have their own rounded normals. The ground near the walker gets a fine bump in its lighting normal.

## Rendering fixes made along the way

- Per-look shader variants. The first version chose between the two looks with a uniform branch. GPUs that flatten such branches (SwiftShader did) then ran both looks for every fragment, and a frame cost about 1.9× v21. Each look now compiles its own programs (`#define SENGOKU`), which are rebuilt in place when the look changes. A GPU that cannot build the sengoku variant falls back to the anime look instead of losing the 3D view.
- Wall top. `vWall.z` is interpolated up each wall face like `y`, so in the fragment shader "height of the wall" always equalled the current height. Every top-of-wall effect therefore covered whole walls, including snow in the snow sky. The realistic look now uses the storeys from `vTop`.
- Wall normals pointed inwards (see the first review above).

## Performance

Chromium with SwiftShader at 1100 × 680 (a software renderer, so compare ratios and ignore the absolute times):

| Build | Median frame |
|---|---|
| v21 (published) | 1,258 ms |
| v22, anime look | 1,225–1,251 ms |
| v22, first realistic look before per-look variants | about 1.9× v21 |
| v22, first realistic look (castle facades) | 1,709 ms (1.36×) |
| v22, realistic look after the review | 1,866 ms (1.48×) |

The look's detail is faded out with distance (grit, pebbles, leaves, cracks, fallen plaster), and the quality tiers still cap the render scale. Real phone GPU frame rates remain unverified.

## Colour check against the recording

Split-tone means (Lab) over twelve survey views at dusk, against the recording's sunset frames (13:50–16:49):

| | Shadows L / b | Mid-tones L / b | Highlights L / b | Local contrast |
|---|---|---|---|---|
| Recording, sunset | 13.8 / 4.8 | 30.0 / 9.5 | 55.7 / 15.3 | 2.6 |
| v22 dusk, first version | 17.2 / 6.7 | 34.4 / 10.3 | 60.0 / 14.5 | 1.3 |
| v22 dusk, after the review | 14.0 / 5.9 | 27.8 / 9.8 | 48.0 / 12.5 | 1.5 |

After the review the shadows and mid-tones match the recording (the corrected wall normals put facades turned away from the sun into shade). Highlights are a little darker and the fine local contrast is still about 60% of the recording's, which geometry detail and textures give the game. The survey viewpoints differ between the two rows because the new props changed which places are walkable.

## Validation

- 168/168 tests in `node --test tests/*.test.cjs`, including checks that the walk opens in the realistic look with six skies, that the period props are placed on land away from footprints, paths and each other (and that no banners are placed), that the prop meshes fit 16-bit indices, and that switching looks rebuilds the programs with and without the variant define.
- Native GLES2 replays of the real shader and draw calls (Mesa llvmpipe) without GL errors: 71 views (the island survey, nature, streets and coast, sky and interiors, all six skies, the props at dusk and night, the anime look), plus 23 inspection views of the hillside and overlapping buildings from below and from the air.
- Before the review the anime look's replay was byte-identical to v21. The wall-normal and geometry fixes apply to both walking looks, so the anime look now changes where walls face the sun, overlap or stand on slopes.
- Private demos of the branch were prepared for the user's review before any publication.
