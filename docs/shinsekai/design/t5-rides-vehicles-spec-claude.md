# T5 rides and vehicles: one-sheet spec (P21, Claude, 2026-09-30 17:25)

Consolidates facts.md, gimmicks-spec.md, tower-study-review.md and the 1912 text (PID 946141, read in the original viewer). "Source" = evidence; "Default" = a proposal for animation where no source exists (marked *assumed*). No people are shown: vehicles run empty or with abstract seat cushions.

## 1. Ropeway 「索道飛行船」 (1912–1923)
| item | value | source / status |
|---|---|---|
| Ends | tower **roof garden** (地上五十尺 ≈ 15.15 m) → **White Tower** | 1912 text: 「ルーフガーデンに下れば二條の鐵索のルナパーク白塔上に通ずる」 (fr.268); 「塔上に上るもの…鐵索に寄り空中を橫斷して高塔に達する」 (fr.273) |
| White Tower end height | **open, two scenarios**: (a) the White Tower top (1912 wording; its 150-shaku reference level is open); (b) roughly equal height on the tower-facing side (Saitō 1985, B002 p.18) | conflict kept; sag not fixed (Codex rule) |
| Length | about 100 m | B002 (1985). The contractor's 1940 retrospective says 200 shaku ≈ 61 m (loose) |
| System | double-track reversible (複線交走式): two carrier ropes, **two cars pass mid-span** | B002; 「二條の鐵索」 (1912, 1914) |
| Maker | Ceretti & Tanfani (Milan) | B002 and others |
| Car | 4 seats, boat-shaped, steel frame roof with a **striped awning**, seat hung by 4 rods, 2-wheel carriage on top; English postcard name "The air ship"; 1912 text 「四人乘飛行機型の鐵車」 | B002, V004 0:19, V005, OML CC0 postcards |
| Colour | red car body (hand-coloured postcards 157431, 159201), striped awning | low–medium |
| Trip | 60–70 s one way, soft start and stop, slight fore-aft swing | *assumed*; the swing is visible in V004 |
| Night | a small lamp at the car side | *assumed* (V004 shows a round light) |
| Incident | a cable-break accident happened (year unknown) | 『大阪モダン』 1996; not reproduced |

## 2. Tower elevator (1912 layout)
| item | value | source |
|---|---|---|
| Path | **roof garden → top** only; visitors climb stairs to the roof garden (four corner turrets = stair exits) | 1912 fr.268; S7 (1913 album) |
| Maker, cage | Siemens (Germany), wire-mesh cage | S7 reference answer (secondary) |
| Fare | 2 sen per ride | 日本エレベータ協会 50-year history (secondary) |
| Ground-level elevator | only after the **1938** alteration (a shaft down the arch centre) → era switch only | S8 |
| Speed | 0.5–1 m/s | *assumed* (early electric passenger lift) |

## 3. City tram at Ebisuchō (Osaka city tram, 1912)
| item | value | source |
|---|---|---|
| Car | single-truck four-wheel car, Brill 21-E; body 25 shaku (7.6 m) × 6 ft 4 in (1.93 m) × 11 shaku (3.3 m); 42 riders (26 seated); 200 cars | 『日本電業者一覧 明治45年』 (P9, facts.md) |
| Power | **double overhead wire** (two trolley wires, DC 600 V) on centre and side poles → **two trolley poles** on the roof | same |
| Colour | single red 「ため色」 | Wikipedia (one source) |
| Lines | north–south line to Ebisuchō from 1907; the 堺筋 line opened 1912-05-01 | facts.md |
| Hankai tram | 65-seat cars planned; depot west of the Hankai line | P9; S063 map |
| Speed in scene | 10–15 km/h, bell at the crossing | *assumed* |

## 4. Luna Park rides
| ride | value | source |
|---|---|---|
| Circling Wave | ring **22 shaku high (6.7 m), 36 shaku across (10.9 m)**, about **80 riders**; tilted ring rises and falls "like sea waves" while turning | 1912 fr.274; V004 3:53–4:07 |
| 猿滑り (a 人間轉がし) | novelty slide from the White Tower hilltop | 1912 fr.273; shape unknown → a simple wooden chute, *assumed* |
| Roller-skating rink | in Luna Park, grouped with the automata / bowling halls | 1912 fr.272–273 |
| Merry-go-round | listed among the facilities | facts.md (secondary list) |
| Waterfall and fountains | the waterfall from the White Tower's foot hits the **round 白雨亭 roof** and falls from its eaves like a bead curtain; 眞澄池 is ringed by fountains with **underwater coloured lamps**; a large fountain in the 圓街 pond (north) | 1912 fr.269, 273 |

## 5. Proposed next instructions for Codex (T5)
1. Build the ropeway as a **parametric rig**: the two end heights are parameters (scenario a / b), span about 100 m, two cars moving in opposite directions on two carrier ropes, and a catenary sag parameter left at a placeholder. Then the model does not depend on the unresolved height.
2. Make the tram a four-wheel single-truck car (7.6 × 1.93 × 3.3 m, red, two trolley poles, double overhead wire) running past Ebisuchō at 10–15 km/h. It needs only primitives plus one decal-free texture.
3. Make the Circling Wave a 10.9 m ring with a tilted, rotating wobble (height 6.7 m). The wobble and rotation periods are exposed as parameters.
4. The 1912 elevator runs only from the roof garden to the top (not visible from the ground). Keep the ground-level shaft for the 1938 era switch.
5. Keep everything unpeopled and brand-free, and show the unresolved values in the model's metadata so a later source can replace them.
