# Ropeway reconstruction constraints

Status: T2 source synthesis for later T5 implementation. No ropeway model or animation is public yet.

| Constraint | Evidence | Modelling consequence |
| --- | --- | --- |
| First boarding point is the first tower's base-building **roof garden**, about 50 shaku above ground | [Osaka Prefectural Library reference](https://crd.ndl.go.jp/reference/entry/reference/show?id=1000254008), [1913 album citation](https://crd.ndl.go.jp/reference/entry/reference/show?id=1000291784), Claude's 1934 source review | A passenger does not embark from the observation deck. Keep elevator and ropeway routes distinct. |
| White Tower is about **45 m tall** and white-painted; its ropeway station faces the first tower at roughly the **roof-garden elevation** | Same library ropeway reference, quoting Saito (1985) | The cable does not terminate at the White Tower summit. Base elevation, station height and tower footprint remain unsurveyed. |
| Route length is approximately **100 m**; operation is **double-track shuttle** with **two four-seat cabins** | Same library answer; Claude's inspection of Saito pp.15–20 | Animate the cabins passing one another on separate tracks, subject to station stop intervals. A normalized prototype can place cabin A at `u` and cabin B at `1-u`; this is a motion sketch, not a historical speed curve. |
| Cabins are open, boat-like, under fabric-covered frames and a wheeled running carriage | Claude's Saito reading and period photographs `S003`, `S034` | Use broad silhouette only until side/elevation reference and fabric colours are resolved. Do not infer exact cable count or drive layout from the 1914 phrase “二條の鐵索”. |
| The cable axis likely runs toward the southwest White Tower sector | 1912 *南海の栞* photo review, museum program preview and `layout-1912.geojson` | Keep the axis provisional; the 100 m figure is route length, not a surveyed horizontal separation or a precise world-space anchor. |

Rights: Saito's 1985 book and the 1934 volume were viewed through NDL personal transmission by Claude. The book images and prose are not product assets. The public library reference supports the core technical facts; individual period postcard reuse follows `ledger.csv`.

Remaining checks: original 1913 plan or measured park program, terminal photographs, cabin count in a contemporary source, service speed, cable sag and sheave form. Do not move these provisional values into the final scene as measured geometry.
