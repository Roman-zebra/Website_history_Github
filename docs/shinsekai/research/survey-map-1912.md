# 1912 measured Osaka map as a street and parcel control

The original *實測大阪地図* sheet 3-8-甲, published by 昇竜堂 in 1912, is available as an individually CC0-marked original from [Osaka Municipal Library](https://image.oml.city.osaka.lg.jp/da/detail?tilcod=0000000021-OSK0186828) (ledger S063). The adjoining 2-8-乙 [sheet](https://image.oml.city.osaka.lg.jp/da/detail?tilcod=0000000021-OSK0186821) is a Tennoji-side control (S064). The originals are under `assets-src/shinsekai/references/oml/maps/`; Claude's first-pass reading is archived as `map1912-claude.md`.

On direct visual inspection of 3-8-甲, the radial streets, semicircular frontage, parcels and their labels, tram corridor, and southern railway corridor are discernible. This is a land/road survey: it does **not** show which parcel held each Luna Park attraction or building. The dashed circle immediately south of the semicircular frontage is compatible with the expected first-tower area, but the map legend has not been checked and this symbol is **not yet identified as the tower**. The two sheets must first be oriented and scaled using the printed map scale and several persistent street/rail intersections; one visually plausible symbol is insufficient for a geographic coordinate.

Next alignment work:

1. Locate the map key/index and determine the dashed-circle convention and sheet boundaries.
2. Choose at least four surviving intersections or rail/street controls distributed around Shinsekai, and tie both sheets to the 1928 and 1942 GSI aerial layers and modern coordinates. Record source pixels, target coordinates, transform method and residual errors.
3. Compare the possible tower circle with the 1913 plan topology, the 1914 and CC0 north photographs, and the documented roughly 30 m displacement from the modern second tower. Only then replace `layout-1912.geojson`'s approximate first-tower point.
4. Continue seeking the original 1913 site/facility plan for actual attraction footprints. Parcel boundaries alone cannot supply those.

The map date is a publication year, not proof that every road or planned tram depot shown was complete on the opening day. The term `大阪市電鉄車庫予定地` explicitly describes a *planned* site. Do not promote it to a built 1912 feature.
