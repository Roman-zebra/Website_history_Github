# Original inner-wall surface comparison

Opt in with `?clothsewn&clothlook&ao&daylight&wallwear`; add `&webgl`
for WebGL2. It also works independently of the lamp/daylight comparisons.

Only `M_Plaster_Int` in the LOD0 shell and `UD_plaster` in the interior are
selected. Existing normal/bump maps take precedence. Paper, timber, outer
plaster, decals and the general `INTERIOR` prop material remain unchanged.
The original materials are retained for disposal; shared source materials keep
one shared replacement. Original geometry, vertex colours and material maps
are not rewritten. Node colour modulation still includes the original vertex
colours through the pinned r186 diffuse-colour setup.

Original procedural noise in local metres supplies broad colour variation
(gain .03), grain roughness variation (.06 before .8–.96 clamp) and two height
components (.1mm at420/m and .3mm at20/m). These are inferred artistic settings,
not a survey or historic plaster measurement. No external texture pixels or
new texture allocation are used. Screen derivatives of the procedural height
drive a view-space surface gradient. The pinned Three r186 texture bump helper
offsets UV samples and therefore cannot differentiate this position-based
noise; it is not used for the final normal expression.

The first technical selection targeted `INTERIOR`/`UD_plaster` in the interior
cell and left the visible wall untouched: its PNG SHA matched the daylight
control exactly. Source primitive inspection established that the wall belongs
to the shell's `M_Plaster_Int`. The corrected candidate is one artistic pass
(total19/hybrid17); the selection retry is excluded. Private captures and
receipts live in parent `research-cache/look-dev/wallwear-118/`.

The fixed upper-room image shows subtle colour variation, and a closer window
view is saved. This is a surface comparison, not visual acceptance or final
combined1080p performance qualification. The dark corner/cloth, timber grain,
left sleeve/hat contact and larger staging issues remain. Full295-test build
passes. No historical/rights claims are added; no Claude review is requested
during conservation.
