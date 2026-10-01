# Daylight lamp balance comparison

Opt in with `?clothsewn&clothlook&ao&daylight`; add `&webgl` for WebGL2.
This includes the windowlight comparison. The original defaults remain a
separate comparison. No geometry, historical source or public scene changes.

Eight interior point lights retain their existing calibrated intensities and
ranges before the daytime adjustment. Daytime uses30% of that light gain
(.0009 of exported source intensity), with4.5m range for HybridLamp_upper_room
and2.5m for the other lamps. Dream mode restores the existing .003/8m settings.
Repeated draws always calculate from retained values, avoiding cumulative
dimming. Cell retirement disposes the adapter and clears its UI metadata.
Colours, lamp meshes and emitted surface colours remain unchanged. No extra
point-light cubemap/shadow passes are introduced.

This is an inferred artistic calibration. Finite ranges reduce broad warm fill
and cross-floor spill but do not make the lamps physically occluded by floors
or walls. Measured historic lamp output and photometric accuracy are not claimed.
The first15%/3.5m/2m trial was too dark and is saved privately; the30% trial
retains visible window-grid shadows and improves some wall/prop readability.
The cloth and room corner still need more light/material work. Supervisor
visual approval and combined final1080p performance remain outstanding.

Evidence and exact captures are recorded privately in parent
`research-cache/look-dev/daylight-118/`. Two actual visual trials bring the
counter to18/hybrid16. No Claude review is requested during the12h conservation
window; results accumulate under the existing batching heading.
