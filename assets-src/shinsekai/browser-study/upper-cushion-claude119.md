# Claude119: writing-table cushion, partial work

119 remains unfinished. The frozen Sonnet source contains **one** writing-table
cushion represented by two open surfaces and four corner blocks, not a stack of
two cushions. The source base is55mm above the actual wooden floor; the other
three puffed cushions are separate source objects and remain untouched. This
corrects the earlier informal upper-floor inventory. Floor3.455m and pose/yaw
come from source geometry; the filled profile and revised placement are inferred
art, not measured historic upholstery.

Source interior SHA256:
`a5c102f5c499eaca29a6dede27b5bf419c8296e1752ec1c88af281dee43bd935`.
Private numbered outputs are under parent `research-cache/upper-cushion-119-*`.

- 001 closes the original6x6 surfaces with24 side quads, compresses corner blocks
  into seam trim and places the bottom on the actual floor. Closed240 triangles,
  max80mm. **Rejected placement:**68 structural surface pairs include actual
  fusuma/black-frame intersections. Central floor rays did not qualify the full
  footprint. Source pose had the same frame problem. Candidate retained.
- 002 changes only placement:165mm rearward, centre(3.2,5.215), yaw0.4rad.
  All20 structural pairs are existing upward-facing wooden floor triangles at
  Z3.455; merged dressing and other neighbours have0 pairs. Native WebGPU/GL
  close/side images saved. Its thin straight perimeter still reads as a board;
  artistic acceptance remains open.
- 003 changes only seam elevation versus002: bottom/top18/21→40/43mm, keeping
  central thickness80mm, actual floor support patch and all24 closed side quads.
  Candidate SHA256:
  `36701f8fc57e103489747408f11f0d83214e707b7c72b95d523c9e79cd8ea564`.
  Native side/close still show a rigid straight outline in dark cloth. Preserve
  this diagnostic; do not claim that validator success proves better art.
  Rounded outline/fabric qualification remains necessary before acceptance.

The selective append-only adapter preserves the complete original binary prefix,
unrelated primitives/nodes/materials/UV/colour/wear data and original indices.
Only selected cushion positions/body normals/tangents change;48 new seam vertices
and48 triangles,0 extra draws/maps. The original source remains untouched.
Candidate25,994,668bytes versus25,846,956 source (+147,712 append-only bytes);
this is not a mobile transfer saving and it remains a private study.
Fixed oblique and added side cameras/light/AA are identical across each comparison.
The side camera is a diagnostic framing change, not an artistic round.

Blender4.5.10 import/welded closedness/positive volume/save-reopen checks pass.
003 volume0.01140122073m³, minZ3.4549999237/maxZ3.5350000858. Actual40/43mm
boundary elevations are asserted. All20 structural pairs are wooden floor top;
other merged dressing/neighbours0. Snapshot equality covers geometry, UV, colour,
material names and world matrices, not every shader/cache setting. Discrete
surface-pair checks are not continuous/containment certification. Initial001
floor-underside assertion was wrong for a solid floor; logs/scripts retained,
actual upper-floor rays and full material/normal/height contacts used instead.
No completed output was rerun because of an observation timeout.

GLB validator003:0 errors/0 warnings/551 informational messages (legacy custom
attributes/unused data included). Four preservation/contract tests pass and
full build359/359. Both001/002 are reproducible with their original SHA256s.
Pinned official4.5 documentation refetch returned402; no paid access/new tool.
Existing authoring method/installed APIs were used and actually exercised.

Study flag `uppercushion` selects003 only in the local BuildingA study. ExactGLB
200; private scene/receipt/traversal403. No source replacement, production
promotion, newTRIPO spend, texture/AA reduction, phone performance or full119
approval. See private `native-receipt.json` for saved images/lifecycle results.
Carry tatami weave/edging, actual plaster grain and shoji pools forward with
haori/hall remaining limitations; integrated1080p is not ready.
