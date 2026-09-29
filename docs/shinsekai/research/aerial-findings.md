# Osaka aerial photo controls — 2026-09-30

Three official GSI layers were inspected in Chrome and cached as 3×3 tile sets around the **current second tower**, outside Git at `../research-cache/gsi/`. Run `node scripts/fetch-shinsekai-gsi.cjs` to fill missing tiles. The [GSI tile list](https://cyberjapandata.gsi.go.jp/development/ichiran.html) gives layer URLs and zoom limits; the [GSI content rules](https://web1.gsi.go.jp/kikakuchousei/kikakuchousei40182.html) require source credit and a processing note, and warn of third-party rights. No aerial image is copied into the product or repository. Ledger S020, S022–S024.

| Layer | Official date/coverage | Observation and use |
| --- | --- | --- |
| `ort_1928`, z18 | [Osaka City](https://www.city.osaka.lg.jp/kyoiku/cmsfiles/contents/0000674/674649/12.pdf) dates its underlying aerial survey to six days from 1928-10-11. | The three north-district radial streets and semicircular frontage are clearly legible. The first tower existed in 1928, but Luna Park had closed in 1923 and the southern blocks had changed. Use persistent street axes as later georeference controls, not as opening-day building inventory. |
| `ort_riku10`, z18 | GSI labels its series 1936–1942; [Osaka City](https://www.city.osaka.lg.jp/kyoiku/cmsfiles/contents/0000674/674649/13.pdf) describes its 1942 city survey. | Better contrast for radial streets and the semicircle. A dark/bright mass south of the semicircle may contain the first tower, but its footprint cannot be isolated confidently from these ortho tiles alone. Osaka City notes that military censorship removed some public-facility locations from the 1942 photographs. |
| `ort_USA10`, z17 | GSI dates the layer 1945–1950; exact local exposure date not established. | The first tower is gone and the area shows major wartime/postwar change. Use only as a broad change check; do not align 1912 building footprints to it. |

The main correction is that the modern tower coordinate at `34.6525393, 135.5063098` falls at the historical semicircular garden/円街 convergence, not the first tower. The 1913 plan, [Shinsekai Fest's approximately 30 m south estimate](https://www.shinsekaifes.jp/%E3%83%92%E3%82%B9%E3%83%88%E3%83%AA%E3%83%BC), and the 1928/1942 street pattern agree qualitatively. The exact first-tower centre, arch orientation, original park boundary, and facility footprints remain unresolved; do **not** turn this visual reading into surveyed coordinates. `layout-1912.geojson` intentionally retains only an approximate first-tower point and null geometries elsewhere.

GSI views checked:

- [1928 aerial around current tower](https://maps.gsi.go.jp/#18/34.6525393/135.5063098/&base=std&ls=std%7Cort_1928&blend=0&disp=11&lcd=ort_1928&vs=c1g1j0h0k0l0u0t0z0r0s0m0f1&d=m)
- [1936–1942 aerial](https://maps.gsi.go.jp/#18/34.6525393/135.5063098/&base=std&ls=std%7Cort_riku10&blend=0&disp=11&lcd=ort_riku10&vs=c1g1j0h0k0l0u0t0z0r0s0m0f1&d=m)
- [1945–1950 aerial](https://maps.gsi.go.jp/#17/34.6525393/135.5063098/&base=std&ls=std%7Cort_USA10&blend=0&disp=11&lcd=ort_USA10&vs=c1g1j0h0k0l0u0t0z0r0s0m0f1&d=m)
