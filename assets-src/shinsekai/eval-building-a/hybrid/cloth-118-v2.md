# Simulated cloth candidate under Claude118

Claude118 temporarily transfers garment/bolt shape work to Codex during the
twelve-hour API economy window. This derivative starts from frozen111/e3dd4e7,
without consuming Claude's unfinished cloth-v2 directory or changing its source.

Run Blender4.5 with `--python-exit-code 1 --python build-cloth-v2.py` to build
privately in parent `research-cache/upper-118-cloth-v2/`. The current runtime
comparison is `building-a.html?clothv2`, with `&ao` / `&webgl` as needed;
`?cloth` keeps the prior111 comparison. The three source root names gain_v2.
Runtime attachment validates all source world matrices and rejects extra meshes
before hiding originals. The loaded interior owns all derivative resources.

Eleven woven panels settle for32 Blender cloth frames, quality8, mass.08,
with authored attachment groups and self collision. The loose bolt also uses
a private floor collider. The baked mesh is static in the browser, with inferred
1.2mm closed fabric thickness. Front opening, back, sleeves and folded collar
are distinct garment parts. Three folded laundry pieces retain the source pole.
The actual rolled winding has closed end annuli around the retained card core,
two geometric winding spirals and short edge fibres. Dimensions, patterns,
colour and worn state remain creative estimates, not surveyed1912 clothing.

Original rail, pegs, hat, bamboo, card core and shears retain all2,364 source
hardware triangles, UV0 and colours, including winding; UV1 packing is not a
byte-equivalence claim. The existing fine wrinkle normal uses the116 mixed
scales/rotation. Source cloth palette values and physical material settings
are retained for comparison; the white sheen remains visually strong.

The derivative is7,828 triangles; maximum active room with accepted petals is
149,770/150,000. Validator0errors/0warnings/14infos.100+ source tangent frames
are orthogonalized with no fallback or geometry changes; exact final count/hash
is in PROVENANCE.json. Position-welded edges of all12 fabric/roll bodies have
two incident triangles. This verifies closed surfaces, not cloth-to-cloth seams,
peg support, inter-object contact or collision safety. These joints and folds
still need further review. The winding detail fibres intentionally have open
tips, and are excluded from the closed fabric-body check.

Native review images belong in `research-cache/look-dev/cloth-118-v2/` with
the GLB hash and capture timestamps. The optional candidate is not visually
accepted. Cold readiness and qualified1080p after AO/final effects remain open;
Claude's source113 performance receipt does not cover this derivative.
