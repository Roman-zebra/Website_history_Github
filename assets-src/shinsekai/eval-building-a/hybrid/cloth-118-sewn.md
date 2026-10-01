# Connected haori comparison under118

Generate privately with Blender4.5:

```text
blender -b --python-exit-code 1 --python build-cloth-v2.py -- --sewn
```

Output is in the parent `research-cache/upper-118-cloth-v2-sewn/`; the older
`clothv2` build and source111 arrangement remain available. `haori_sewn.py`
authors one connected midsurface: front/back body, shoulder strips, two sleeves
with open wrists and folded collar extensions share vertices at their joints.
It settles32 cloth frames at quality10 before a1.2mm closed thickness is baked.
The browser uses an optional `?clothsewn&clothlook` comparison, with the same
`_v2` roots and the previously qualified source-RGB fibre sheen.

Two fixed vertices at source peg-head coordinates x.284/y1.97,2.32 retain their
positions exactly; nearest retained hardware triangles are.600338mm away from
the midsurface. Collision uses200 retained support triangles and self collision.
The neighbouring hat is excluded. The first connected attempt used the whole
rail/hat collision mesh and heavier, softer cloth; its sleeves folded badly
around the hat. That image/GLB remain private as a rejected visual comparison.
The revised parameters mass.008, air damping5, tension/compression60, shear40,
bending2 reduce maximum displacement from228.94 to46.33mm. These are creative
simulation settings, not measured garment fabric or mounting approval.

Exported cloth has6 closed fabric/roll bodies; the haori is one connected body.
All2,364 original hardware triangles preserve positions, UV0 and colours exactly
(cyclic corner canonicalization retains winding). Root placement is unchanged.
Derivative7,456triangles, maximum room with petals149,398/150,000; GLB3,465,840
bytes. Validator0errors/0warnings/14infos. Tangent repair orthogonalizes109 frames
with0fallbacks. These checks do not certify all inter-object contacts, cloth
self-intersections, whole-room walking or mechanical support safety.

Native images and the final asset SHA belong in the private
`research-cache/look-dev/cloth-sewn-118/receipt.json`. Visual acceptance and
qualified1080p performance remain open; geometry checks alone cannot accept
the silhouette. No supervisor review is requested during the conservation window.

Both1280x720 native backends save base/dream at the same haori camera and
retire interior/cloth/dream at far view with no new errors/warnings. The
intentional missing-GLB404 check shows the failure and disables capture; the
asset was restored before normal verification. Fullbuild293/293. Left sleeve
still overlaps the retained hat; this is an open contact/appearance issue.
Two actual garment visual passes bring total14/hybrid12; UV/RGB handle repair
and transport/validation retries are excluded. No review call during conservation.
