# Inferred front-window light comparison

Use `building-a.html?clothsewn&clothlook&ao&windowlight` locally; append
`&webgl` for WebGL2. The source comparison omits `windowlight`.

The candidate moves the existing directional light from `[3,12,12]` to
`[-5,9,18]`, keeping its target `[3,0,-4.5]`, gain, colour and 2048-square
shadow map. Interior hemisphere fill changes .45 to .22 and studio environment
intensity .45 to .14; environment intensity returns to .45 after cell retirement.
The source side walls contain no windows; no new openings, lights or geometry
are added. Sun angle and lighting gains are artistic estimates, not measured
1912 Osaka illumination or a location/date-specific solar solution.

Interior window paper uses the source material name `SHOJI`; the pre-existing
exterior helper selected only `M_Paper_Shoji`. This opt-in comparison gives
`SHOJI` the same inferred RGB shadow transmission [.40,.37,.32]. Visible paper
stays opaque and retains its source colour/texture. Fusuma partitions and
paper props remain outside this selection. Frames and opaque objects retain
their geometry shadows. This is single-layer attenuation, not volumetric
scattering or measured paper optics.

Private comparison evidence is in parent
`research-cache/look-dev/window-light-118/receipt.json`. Two actual lighting
passes bring the artistic counter to16/hybrid14: first the lower sun/fill and
paper selection, then reduced environment fill. Technical retries are excluded.
Both native1280x720 backends saved base/dream views and retired the interior,
cloth and dream cells at far LOD2 with no new console errors or warnings.
Material-selection checks and the complete293-test build pass.

The environment reduction darkens the cloth/floor somewhat, but the upper room
still reads too flat and warm. The broad source point lights and wall material
need further tuning. No visual approval or final1080p performance claim is made.
An unmatched WebGL cold first submission took23.454s versus2.8603s on WebGPU;
these observations are not frame-rate measurements or a controlled regression
comparison. Source defaults and public site content are unchanged.

A private conservative geometric audit samples176 potential floor-to-sun rays
per profile over137055 source triangles, treating other textured alpha surfaces
as opaque and ignoring glass/exterior paper; candidate interior paper is treated
as traversable. Six candidate samples and zero source samples are unobstructed
under those assumptions. This uses the old companion cloth and does not model
attenuation, shadow filtering or photometry; it cannot certify floor coverage
or explain all visible shadows. The source exporter already removes painted
sun-pool decals; this change does not add or remove such decals.

No external image pixels, new historical evidence, paid service or Claude model
call are used. Review remains deferred under handoff118 conservation.
