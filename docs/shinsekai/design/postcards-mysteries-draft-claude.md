# Postcard collection and three mysteries: text drafts (P22, Claude, 2026-09-30 17:59)

Drafts for T7. Captions are Claude's own short wording (EN + JA), not copied text. The rules: no people shown, no real trademarks, and the public name never uses the tower's current brand name. Only CC0 postcards (Osaka Municipal Library OML, each page marked CC0) are proposed. Final rights and ledger checks stay with Codex.

## 1. Postcard collection (found in the scene → opens the real card + commentary)
| # | OML id (file) | where the player finds it | EN caption | JA caption |
|---|---|---|---|---|
| 1 | 158888 (d0286001) | roof garden, ropeway landing | Two carrier ropes, two little cars: the first passenger ropeway in Japan crossed the park from here. | 二本の綱に二台の小さな車。日本で最初の客を乗せた索道は、ここから園を渡った。 |
| 2 | 157930 (c1188001) | inside the ropeway car | A four-seat "air ship" hangs from a two-wheel carriage. (The printer drew the rope thicker than it was.) | 四人乗りの「飛行船」は二つの車輪で綱を渡る。（綱は絵葉書で太く描き足されている） |
| 3 | 160199 (e0346001) | White Tower summit, at night | Lines of bulbs trace the White Tower's galleries and spire. The whole quarter was said to burn with 50,000 lamps. | 白塔の回廊と尖塔を電球の列がなぞる。街全体で「五萬燈」と書かれた光。 |
| 4 | 158232 (c1524001) | beside the waterfall | Water leapt from the White Tower's foot, struck the round rest-house roof and fell from its eaves like a bead curtain. | 白塔の足元から噴き出した水は、丸い休み処の屋根を打ち、軒から玉すだれのように落ちた。 |
| 5 | 158234 (c1526001) | stairs of the mound | The White Tower stood on the summit of a wooded mound, with stairs climbing from both sides. | 白塔は木の茂る築山の頂に立ち、両側から階段が登っていた。 |
| 6 | 158236 (c1528001) | aviary path | A great netted dome and a pond: the park kept waterfowl and peacocks. | 網を張った大きな円屋根と池。園には水鳥と孔雀がいた。 |
| 7 | 160197 (e0344001) | south-east corner | Opening-year card: the arched Seika-den and the Egyptian hall with its obelisks. | 開園の年の絵葉書。大アーチの清華殿と、オベリスクの立つ埃及館。 |
| 8 | 160194 (e0341001) | tower top, observation deck | The opening envelope showed the tower as a black silhouette against searchlight beams. | 開園記念の袋には、探照灯の光を背にした塔の黒い影。 |
| 9 | 157431 (c0313001) | tower base, arch | A hand-coloured card paints the ironwork a rusty red. (Printer's colour, not a measured one.) | 手彩色の絵葉書は鉄骨を赤茶に塗る。（職人の色で、測った色ではない） |
| 10 | 157352 (c0234001) | music hall | Seen from the White Tower: the octagonal music hall in its round pond, the tower arch beyond. | 白塔から見た八角形の音楽堂と丸い池、その向こうに塔のアーチ。 |
| 11 | 158510 (c1815001) | Ebisuchō approach | The arch, the tower, and a ropeway car sliding toward the park. | アーチと塔、そして園へ滑っていく索道の車。 |

- Excluded for now: 158880 and 158886 (1920s). A real advertiser's lettering is visible on the tower. Use them only after a trademark crop decision, or not at all.

## 2. Mysteries (each is a clue chain across places; the answers come from sources)
### A. The Vanished Tower 「消えた塔」
1. Clue in the observation deck: a plate reading "250 shaku" (1912 guide). *Q: was it really that tall?* The in-game "evidence mode" shows the photo-based range (about 58–66 m; conditional).
2. Clue at the base: a burned cinema ticket (fictional design) → the 1943 fire started in a cinema under the tower (Osaka Prefectural Archives bulletin No. 46).
3. Clue in the dream intro: an empty sky at the tower's place → the tower was taken down in wartime and its metal handed over (same bulletin).
4. Answer screen: timeline 1912 → 1943; the second tower is **not shown or named** (name rule).

### B. The Vanished Park 「消えた遊園地」
1. Clue at the 圓街 fountain: the 1912 guide calls the whole quarter "one enclosure" of 30,000 tsubo.
2. Clue at the SE corner: Seika-den; at the SW corner, a confectioner's branch (generic sign) and an automata hall.
3. Clue at the west gate: shops along the back fence.
4. Clue near the site of the later sumo hall: the 1912 guide already lists a permanent sumo hall as "phase two".
5. Answer: Luna Park closed in 1923; the ground became other uses (era switch shows the change).

### C. Where Did the Cable Car Go? 「ケーブルカーの行き先」
1. At the roof garden: 「ルーフガーデンに下れば二條の鐵索…白塔上に通ずる」 → it starts at the roof garden.
2. On the White Tower: 「塔上に上るもの…鐵索に寄り空中を橫斷して高塔に達する」 → the other end is at the White Tower.
3. Puzzle: were both ends at the same height? The game shows **both scenarios** (text vs a 1985 study) and lets the player compare views. It does not claim an answer; this is honest about the open question.
4. Bonus: a snapped-cable note (an accident is recorded; year unknown) is **not** dramatised; only a "service suspended" sign.

## Proposed next instructions for Codex (T7)
1. Store postcards as data (`postcards.json`: id, OML id, found-at feature id, captions EN/JA, rights = CC0 + page URL). The other four site languages can be machine-drafted and human-checked later.
2. Store mysteries as clue graphs (`mysteries.json`: nodes = feature ids from layout-1912.geojson, text keys, evidence links). Answers cite ledger ids.
3. The evidence mode shows scenario ranges (height, ropeway ends) instead of single numbers.
