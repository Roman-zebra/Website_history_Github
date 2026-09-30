# Original cloth detail study under Claude handoff 111

`building-a.html?cloth` opts into the replacement; add `&petals` for the original
flower prototype or `&webgl` for fallback. The default 111 scene is kept for
paired comparison. Three new review views cover the haori, drying garments and
unrolled cloth. Arrangement, period labels and original palette stay authored.

`upper_cloth.py` wraps only the author's cloth patches with at least two grid
segments in both directions on `UD_CoatRail_Haori`, `UD_DryingPole_Cloths` and
`UD_ClothBolt_Spread`. Narrow collar, lining, border strips, supports and other
furnishings remain unchanged. The wrapper invokes the original patch with its
original RNG calls, then preserves its front faces. It adds a reverse surface
1.2mm behind and a closed edge, increasing the offset to 3mm over the final
8mm at the lower hem. These dimensions are artistic estimates, not historical
measurements. Draped silhouettes come from Claude's existing displaced grids.

A new original periodic 256² normal tile combines fine folds and a woven relief
over 12cm, replacing the selected patches' normal input at strength .7. Their
base colour/roughness/sheen remain copied from the authored material. It has no
photographic pixels. This is fine relief, not dynamic cloth simulation.

Reproduce privately with Blender4.5:

```
blender -b --python-exit-code 1 --python assets-src/shinsekai/eval-building-a/hybrid/build-cloth.py -- --no-render --review-only
```

This emits only `research-cache/upper-111-cloth/` in the parent workspace. It
does not overwrite frozen author inputs or default scene GLBs. UV1 packing can
change serialized hashes between runs; compare actual geometry/UV0/colour and
validation receipts. The browser asset is copied deliberately after validation.

The three original objects contain 4,612 triangles; replacement contains 7,284,
an increase of 2,672. All original position/UV0/colour triangles match the
baseline, including winding. The thickened patches alone have 4,464 triangles
and 6,696 position-welded edges, all with exactly two incident triangles.
This checks closed surfaces; it does not certify all contact/overlap behavior.
The derivative is 4,256,416 bytes and validates with zero errors/warnings.
108 non-orthogonal tangent frames were repaired without moving vertices or UVs.
Maximum active room geometry with the flower prototype is 149,226/150,000.

Runtime checks all three names and complete world matrices before hiding any
original. Only these three mesh subtrees are accepted. The companion is loaded
with the interior and belongs to its lifetime, so obsolete loads and far-cell
retirement dispose the replacement too. Original hidden geometry is retained
for the study; these counts are not CPU/GPU memory or download reductions.
Load/decode readiness includes the companion dependency. Production packing,
compression, lighting/AO and qualified 1080p performance remain separate work.

Native paired PNGs and capture receipts belong in the private parent
`research-cache/look-dev/cloth-111/`. An early haori close-up crops the lower
hem and is a material inspection, not the whole-garment comparison. Visual
acceptance remains with Claude; lighting is still flat.
