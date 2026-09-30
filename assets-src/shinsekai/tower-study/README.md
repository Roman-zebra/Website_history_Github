# First Tsutenkaku silhouette study

This is an editable **T3 preparation study**, not a production asset. `build-tower.py` creates the north-side orthographic render `north-study.png` and the four-mesh `tower-study.glb`. Neither is referenced by the website build or public page.

## Evidence and limits

- Overall height **75.76 m** follows the 1924 *メートル式度量衡便覧* cited in `docs/shinsekai/PLAN.md` §13. The period also used rounded and promotional heights; this is a working control, not a surveyed as-built measurement.
- The front arch, paired corner turrets, lattice shaft, observation room and crown are based on Osaka Municipal Library CC0 postcard `c0234001` ([record](https://image.oml.city.osaka.lg.jp/da/detail?tilcod=0000000021-OSK0157352)), with the larger 1921 *建築写真類聚* plate 46 ([NDL PID 962657, canvas 48](https://dl.ndl.go.jp/pid/962657/1/48)) as a later structural check. Plate 47/canvas 49 supplies underside detail. The 1921 plates do not establish exact 1912 paint or modifications.
- The White Tower viewpoint `d0285001` ([record](https://image.oml.city.osaka.lg.jp/da/detail?tilcod=0000000021-OSK0158887)) and Ebisudori view `c1819001` ([record](https://image.oml.city.osaka.lg.jp/da/detail?tilcod=0000000021-OSK0158514)) are the other two rights-cleared sectors for later camera matching.
- Every horizontal dimension, arch radius, intermediate level, roof detail and material colour in the script is **estimated**. The orthographic render is a silhouette aid; it has not been registered to any historical photo. No first-tower footprint or camera/lens coordinate has been established. The source images' catalogue dates are recorded in `docs/shinsekai/research/photo-controls.md`.
- Direct visual review against `c0234001` shows that the current crown is much simpler than the photographed open lattice, and the facade omits its small parapet, ornament and adjoining street buildings. The postcard's garden pavilion is a separate facility and is intentionally absent from this tower-only study. These remain T3 reconstruction work, rather than evidence that the simple shapes are historically exact.

## Rebuild and acceptance

Run `blender -b --python assets-src/shinsekai/tower-study/build-tower.py` from the repository root. Pass `-- --export-only` to regenerate only the GLB. The source keeps each part named and editable; export joins parts by material to keep the current GLB to four meshes/materials and about 0.55 MB. Blender 4.5.10 generated and re-imported the GLB. A standalone glTF-Validator pass remains outstanding because the reported global installation could not be found in this shell.

Before using this model in T4: establish the site plan and tower anchor, match at least the north and White Tower photos with an explicit camera model, replace guessed dimensions/colours, then run glTF validation and visual/performance checks. Do not interpret this study as a reconstruction of the 1912 opening state.
