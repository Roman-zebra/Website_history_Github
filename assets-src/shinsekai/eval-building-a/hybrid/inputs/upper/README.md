# Building A — upper tatami room, six-surface dressing + dream layer (Claude, handoff 108)

Add-on to the Codex hybrid (`eval-building-a/hybrid/`, untouched). Merge steps: `MERGE.md`. Everything here is an **A:** assumption (period-plausible invention, no surveyed plan, no real brands, no people or person-like figures; all text is fictional: shop name 新榮堂, a generic ink scroll phrase, a blank-ledger label 大福帳, a signboard 千客萬来).

## Story (base layer)
Someone stepped out mid-mending. The hibachi still glows, the kettle lid sits askew, one cup is tipped over mid-pour beside a tray of tea, the needle is still in the half-patched indigo sleeve, the sewing box is open, a bolt of cloth is half unrolled with shears lying on it, the clock stopped-looking at 4:20 while its pendulum is mid-swing, and a dented zabuton is still turned toward the window.

## What was added (interior-directive s0 checklist)
| surface | dressing |
|---|---|
| ceiling | aged cedar board skin with 5-board seams (texture + normal), soot halo + water stains, **opal-glass pendant with porcelain ceiling rose, twisted cord, brass socket and bulb** (dagger), **iron screw-eye hooks + bamboo drying pole with an indigo yukata, two tenugui** (and a recess over the ranma), **a receding row of six festival lanterns on a sagging string** |
| north/fusuma wall + tokonoma (east) | tokonoma alcove: sand-wall, tokobashira with bark edges, black-lacquer kamachi, hanging beam, **silk-mount scroll with ink landscape + seal, roller knobs, wind bands, cord and nail**, celadon vase with kiku, brass incense burner |
| west wall | **chigaidana** (cupboard with sliding doors, staggered shelves, hanging cabinet; books, jar, fan, caddy, cups, bell), **peg rail with indigo haori + sedge hat**, **hakkake clock with visible swinging pendulum**, **wall calendar (fictional text, curled corner, torn-off stubs)**, **framed wave print**, nageshi hooks with **uchiwa, key ring, kinchaku pouch**, **signboard + bracketed jar/bottle shelf** in bay 2, east wall **tansu with 4 drawers, iron drop handles, keyhole plates, screws** |
| floor | dented zabuton x3 (piped, tufted), **hibachi + kettle + tongs** (hero), **sewing box with hinges, tray, spools, scissors, pin cushion, measure** (hero) and the half-mended sleeve, tobacco tray with kiseru, **tea tray mid-use**, chabudai with ledgers and inkstone, bolt of cloth with shears, futon folded on the tansu, tatami traffic lane, skirting dirt |
| window wall | hybrid shoji kept; **slightly torn pane (jagged hole to sky, two curled flaps) + older paste patch**; **half-rolled sudare on window 2** with cords; **sun pools on the tatami** (shoji-diffused pool with the kumiko lattice shadow + a hard spot through the tear) |
| wall wear | stains, soot, plaster crack, faded print ghost + nail holes, skirting dirt |

Hero props (bevels 0.4-4 mm by material, weighted/custom split normals, separate parts with 1-2 mm seams, raised slotted screws, roughness by material from detail-spec s6): hibachi + kettle, sewing box (contents), tokonoma scroll. Others get the same treatment at lower density.

## Dream layer (period out-of-place objects, one per view; flowers as the separate abundance category)
Meiji iron hospital bed (white enamel, brass sockets, casters, wire-mesh deck, teal blanket) on the tatami; white porcelain rabbit statue on the shop counter; red balloon tethered to the stair foot / to the lantern-row hook; horn phonograph† with wax cylinder by window 1. Replaces the two teal spheres and the hybrid's pot/cone flowers. Flowers: chrysanthemum (kiku) heaps from the tokonoma platform across the tatami, irises at the alcove foot and along the shop step, morning-glory (asagao) vines up the window wall and hanging from the shop beams, kiku pots in a receding row along the shop floor. Grade = the dreamcore-study numeric start values (see MERGE.md s4).

† items: phonograph (swap: hand-cranked music box / hand bell), rubber balloon (swap: paper/silk balloon), electric pendant (swap: hanging oil lamp). Flags are in node extras (`dagger`, `variant`).

## Sources
interior-directive.md (s0 six surfaces / rows / light / abundance / one impossible object / hue, s3 inn room, s5 prompts), detail-spec.md s6 (micro-realism table: edge radii, seams, raised hardware, roughness, cubic structures), dreamcore-study.md (numeric grade, objects), interior-sources.md (Smith & Worch storytelling; Level Design Book tiers: 1 hero, 3-6 secondary, asymmetric tertiary clusters). Reference frames `video-work/mZX2Xqb13xc/frames/00012, 00033, 00044, 00059` (method only). Period photos OML 157003/157013/157016 (lattice/shop typology; read for type only). Hybrid code read for coordinates: `build.py`, `micro_props.py`, `inputs/opus|sonnet`.

## Numbers
- Added triangles: **75,084** (limit 80,000). Biggest: ShopFloor flowers ~8k, Tokonoma flowers ~7.5k, hibachi 4.7k, sewing box 4.4k, lanterns 4k. Base 59k, dream 16k.
- GLB: 37 meshes / 54 materials / 29 generated PNGs, 17.8 MB uncompressed (KTX2/meshopt open). UV0 (world-metric box or patch UV) + UV1 (lightmap pack) on every mesh.
- Materials use generated tileable textures (grain, weave, washi, plank, speckle) tinted by `COLOR_0`; no CC0 photo sets were needed, so nothing external is referenced.
- Timings (`date`): start 03:27 -> final renders and export 05:12 (about 1 h 45 min wall, 45 min of it Blender render/export). Eevee 1280x720 per frame 35-50 s upper, 10-20 s ground. Add-on build 16-18 s.

## Iterations
About 9 draft loops (640x360 Eevee reading) + two full 1280x720 passes: (1) first in-room look: furniture too far from the walls, dark lacquer blown, cloth rim normal artifacts; (2) custom split normals + sRGB/Non-Color image fix (flat black boxes found and fixed in the kit), glass as alpha; (3) plank ceiling too dark/stripey, timber desaturated; (4) dream pass: flowers too small, petal shapes; (5) zabuton dome, garment proportions, scroll mirrored, shadow pool setting; (6) window-wall decals, tear patch; (7) ground dream views, rabbit placement, balloons; (8) hero close-ups; (9) film grain was 3x too strong (now 0.65 % luminance), compare sheets. Claude-only visual judgement; no browser/fps test.

## Gaps / weakest points (my own scoring vs interior-directive s0)
1. **Dream grade is a compositor proxy**, not the final LUT/fog/haze: the ground dream views are warm-beige more than coral-pink, there is no glossy reflective floor (tatami/earth stay matte) and no teal water counter-colour beyond the vase/blanket/teapot accents. Reference frames 00012/00044 are much more saturated and reflective (the upstairs fails §0.3 "glossy floor" and partly §0.6).
2. **Flowers read as stylised paper blooms** at close range (flat petal polygons, no volume, no per-petal normal); over-abundance is present but still sparser and less varied than frame 00044/00059; morning glories are 8-sided trumpets. Needs a real petal atlas / instancing.
3. **Soft-goods are sheet patches** (haori, yukata, tenugui, blanket, bolt): folds are procedural sine waves, hems have no thickness, no cloth sim. The haori reads as flat stripes at 1 m. Ceiling is still tonally brown and quiet, no fixtures beyond the pendant and lanterns; no vents/coves as in frame 00012/00033 (period rules forbid fans/AC; a gas-lamp bracket/ventilation grille could be added).
Also: sun pools are alpha cards (not lit); the sun and lights are the hybrid's review rig; the upper-street (through window) view was not re-rendered with the add-on; the hybrid's own surrounding details (fusuma, ranma) are unchanged; tangents not exported.
