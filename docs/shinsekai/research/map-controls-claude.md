# 位置合わせの対応点の候補（Claude、2026-09-30 13:43）
座標：S063＝原図 s0004038.jpg（7288×9941、左上原点）。GSI＝research-cache\gsi の 7×7 モザイク（1792×1792、z18、約0.49 m/px）。1928＝ort_1928、1936–42＝ort_riku10。
切り出し（ここにある jpg）：m28_*＝S063（m28_rail: 原点(3700,5300)・1/2倍、m28_k2: (5300,5700)・1/2倍、m28_j1: (6150,800)・0.7倍、m28_ne: (4700,800)・1/3倍）、riku_s: (400,1492)・等倍、riku_n: (700,450)・等倍、riku_j: (1100,560)・2倍、o28_j1: (1000,450)・等倍、o28_south: (0,1092)・等倍。グリッドの間隔は各画像の表示で 35〜50 px。

| 点 | 何か | S063 | 1928 | 1936–42 | 不確かさ | 同じ物と言える理由 |
|---|---|---|---|---|---|---|
| K1 | 阪堺の線路が鉄道の築堤をくぐる所 | (4240, 5900) | (505, 1650) | (480, 1667) | S063 ±15、写真 ±25 | 築堤の記号の切れ目。1911年からの阪堺（今の新今宮駅前）。写真では阪堺車庫と市電車庫の間の筋 |
| K2 | 東の南北の道が築堤をくぐる所 | (6070, 6400) | (860, 1735) | (855, 1737) | S063 ±15、1928 ±30、1936–42 ±15 | 築堤の記号の切れ目。1936–42 では市電車庫の屋根の東の縁の道がはっきり築堤に当たる（東隣の (918,1778) の道とは別） |
| J1 | 北の東西の電車道（市電の点線）と、21,850坪の区画と「恵」の区画の間の南北の道の交点 | (6461, 907) | (1290, 665) | (1243, 638) | S063 ±20、1928 ±25、1936–42 ±15 | 市電の通り（今の国道25号の線）は1912年から続く。南北の道は新世界の東の縁の道（公園の西の縁）。向きは S063 で南から約14°西、写真で約6°（S063 の図は約5°回っている：築堤でも同じ差） |
| J2 | J1 の道を南へ約59m、北東から来る東西の道が合う所 | (6425, 1475) | (1275, 785)？ | (1228, 752) | S063 ±20、1928 は低い（±35）、1936–42 ±20 | J1 からの距離が S063 で 568 px×0.1032＝58.6m、1936–42 で約117 px×0.491＝57m |
- 確かめの距離：K1–K2＝S063 196m／1928 182m／1936–42 187m。J1–K2（南北の広がり）＝S063 約567m（5,500 px）／1936–42 (855,1737)−(1243,638)＝1,165 px×0.491＝572m。
- 1928 と 1936–42 の写真どうしで同じ交点が 20〜40 px ずれる（写真の位置合わせの差）。
- 使わない：破線の円、「予定地」の区画、半円の広場の南（1923年以後に作り替えられた旧ルナパークの区域）。

## 追記（13:51）独立の外側の点と、K1・J1 の正体（Codex「Four map candidates reviewed」）
- **W0 南海本線×関西本線の立体交差**（今の新今宮駅）：S063 **(1180, 5067) ±15**（`m28_nankai.jpg`、原点(600,4500)・0.75倍。太い白黒の鉄道記号どうしの中心線の交点）。1912年の地図・1928・1936–42・今の地図のどれにもある、この範囲で一番確かな恒久点。ただし **7×7 モザイクの西の外**（K1 からの計算で モザイク x≈−160, y≈1490 前後＝タイル x 229740 の列、y 104144〜104145 あたり）。Claude はタイルを取らない（Codex の管理）。取るなら ort_1928・ort_riku10・std の同じ3枚ずつで無料。
- **K1 の正体**：S063 では阪堺の軌道の記号（二重線と点）が築堤の記号の切れ目を通る（`m28_rail.jpg`）。1928・1936–42 では阪堺の車庫（線路の西、S063 の「阪堺電気軌道株式会社 車庫」）と市電の車庫（東）の屋根の間を通る筋が築堤の明るい帯に当たる所。3つとも同じくぐり道と判断（確かさ：中。写真では線路そのものは細くて見えない）。
- **J1 の正体**：S063 の上の枠の近くの点線（阪堺と同じ軌道の記号）＝北の東西の電車道。区画の線や図の枠の印ではなく、道の両側の線の間に軌道の記号がある（`m28_j1.jpg`）。1936–42 の写真では幅の広い道と南北の道の交差点としてはっきり見える（`riku_n.jpg`）。ただし、その軌道が1912年に開業済みだったか計画だったかは未確認（市電の路線の開業年表で確かめる必要あり）。道そのものは1936–42 に実在。
- 阪堺の北の区間で西から来る道が合う点（S063 (5150, 1370) 付近）は、写真で交差がはっきりしないので出さない（`w1_pair.jpg`）。

## 追記（13:58）W0 の写真上の位置（新しい 8×7 モザイク、Codex の予測を見る前の独立の読み取りではなく、予測値は知った上で画像だけで決めた）
画像：`w0_three.jpg`（std・1928・1936–42、x 0–300・y 1380–1680 を 1.33倍）、`w0z.jpg`（x 0–160・y 1430–1590 を 3倍、格子＝10 px）。
| 層 | W0（8×7 モザイク px） | 不確かさ | どの線とどの線 |
|---|---|---|---|
| std（今） | (78, 1497) | ±8 | 南北の高架（今は2組の複線＝4線。1912年は南海本線の複線1本だけなので、2組の真ん中を取った。どちらか一方なら ±15）×東西の JR の線の束の中心 |
| 1928 | (70, 1505) | ±20 | ぼやけている。東西の築堤の明るい帯と、南北の明るい筋の交わり |
| 1936–42 | (57, 1507) | ±12 | 南北の高架の上面（明るい筋。左の黒い帯は影）×東西の築堤の帯 |
- 四点のアフィンの予測（1928 (164,1508)、1936–42 (106,1551)）との差：**1928 で約94 px（約46m）、1936–42 で約66 px（約32m）**。
- S063 では南海本線（太い白黒の鉄道記号、複線1本）と関西本線（築堤の上の白黒の記号）の中心線の交点 (1180, 5067)。

## Diagnosis step 1 (2026-09-30 14:49, English): numeric pattern only, no new fit
Scripts: `pairwise.cjs` (pairwise ground-metres per S063 pixel and rotation) and `predictJ.cjs` (diagnostic similarity from K1/K2/W0 only). W0 was converted from the 8×7 frame to the old 7×7 frame (x − 256).
- The **three southern points agree**: K1–K2, K1–W0 and K2–W0 give 0.095–0.109 m/px and rotations of −2° to −5° in both aerials.
- **Every pair with J1 or J2 disagrees in the same direction**: rotation +13° to +19° against K1/K2, and +7° to +9° against W0. Scale is 0.113–0.126 m/px against K1/W0. J1–J2 alone is consistent (about 57–59 m, rot about +4°). So the J cluster as a whole, not one point, is displaced relative to the southern points.
- A diagnostic similarity from K1/K2/W0 (residuals 6–24 px; K1 is the worst, at 17–24 px) predicts J1 at about **(890, 567)** and J2 at about **(890, 688)** in both aerials. That is about 350 px (≈170 m) **west** of Claude's picks (1243–1290, 638–665). It lands about 30–40 m east of the Ebisucho junction, where the main east–west road meets the start of the central radial street.
- Two hypotheses for the visual check:
  - **H1**: Claude matched the wrong street in the aerials. The S063 street at J1 (between the 21,850-tsubo block and the 恵 block, under the dotted tram line) is a street nearer the Ebisucho junction, not the eastern street at x≈1243.
  - **H2**: the north part of S063 is distorted or sheared relative to the south, e.g. through sheet assembly or drafting, so a similarity cannot hold.
  - H1 would also explain why an affine fit reaches 9–11 px only by absorbing a large shear.
- Next (visual, planned at Max if the user switches): compare the S063 top-right street pattern (blocks, lot numbers, tram line) with the aerial street pattern around (820–900, 540–700). Also check whether S063's dotted top line is the main Ebisucho–Tennoji road or a different road.

## Diagnosis step 2 (2026-09-30 14:55, English; visual check, Max reasoning): J1/J2 were matched to the wrong aerial street
Evidence crops: `s063_top.jpg` (S063 origin (4900,780), ×0.4, grid 200 orig px), `riku_c.jpg` (1936–42, origin (700,450), ×1.2, grid 50 px), `jz_three.jpg` (1936–42 | 1928 | std, origin (900,520), ×1.43, grid 20 px), `s063_k2wide.jpg` (S063 origin (4000,4900), ×1/3, grid 200 px), `tw_pair.jpg` (tower area, 1936–42 | 1928, origin (800,860), ×2, grid 20 px).

**What J1 is on S063.** The street between the 21,850-tsubo lot and the 恵 block continues straight SSW (13° west of south) to the semicircular plaza, so it is the **north-east radial street**. J1 is where that radial meets the dotted tram road along the top edge. The tram road runs ESE and leaves the sheet westward; the Ebisucho junction (Hankai terminus) is just off the top edge, about 112 m WNW of J1 along the road.

**What Claude had matched in the aerials.** (1243, 638) is the NE end of a 43° diagonal street that does not correspond to S063's north pattern. **Wrong street.**

**Corrected identification (alternative ID, pixels in the 7×7 frame).**
| Point | S063 | 1928 | 1936–42 | std (today) | Uncertainty | Evidence |
|---|---|---|---|---|---|---|
| J1′ | (6461, 907) | (1043, 594) | (1030, 578) | ≈(1015, 575) | ±15 px (aerials) | The first street ESE of the Ebisucho junction that runs SSW from the main road. Distance from the Ebisucho junction ≈113 m in the aerial vs ≈112 m on S063; direction 6–8° W of S in the aerial vs 13° on S063. Still a street today (next to the Shinsekai post office on the std map). |
| J2′ | (6425, 1475) | (1040, 692) | (1027, 685) | – | ±15 px | The same street about 52 m south, where an E–W street between blocks joins from the west (S063: the street under the 21,850-tsubo lot's south edge; 58.6 m south of J1). |

**Consistency after the correction** (`recheck.cjs`, diagnostic only; not a production fit):
- Pairwise rotations now span −4.7° to +5.7° (before: −5° to +19°). Pairwise scale is 0.085–0.114 m per S063 px, with J1–J2, the shortest pair, the least reliable.
- A diagnostic five-point similarity leaves residuals of **K1 6–11, J1 22–26, J2 30–31, W0 48–55, K2 60 px** (RMS about 38 px ≈ 19 m in 1936–42).
- Leave-one-out predicts K2 at about (908–918, 1809–1815), south-east of the pick and 50–60 px south of the embankment. It predicts W0 about 100 px (≈50 m) north of the rail crossing, where it cannot lie, since W0 is on the embankment.
- **K2's identity is supported by the along-rail distance**: K1→K2 is 189 m on S063 and 180–187 m in the aerials, and the adjacent road at x≈918 would make it 212–222 m. The residual therefore reflects geometry, not a mis-ID.

**Remaining inconsistency is angular, not a single bad point.**
- S063 draws the Hankai line and the NE radial nearly parallel (12.8° and 13.4° W of S). In the aerials they diverge (≈16° and 6–8°): about 113 m apart at the main road, about 146 m apart at the tower's latitude, versus about 110 m on S063.
- The railway-to-Hankai angle is 87.6° on S063 and 93.8° in 1936–42.
- So either S063 draws some lines several degrees off, or the built streets deviated from the drawn plan. The thesis says the built streets departed from the plan in detail.
- Expect about 20–30 m residuals from any single similarity over this sheet. Prefer controls close to the area being registered.

**Not concluded:** the first tower still stands in both aerials. A round spot in the semicircle area, (≈945, 977) in 1936–42 and (≈940, 1000) in 1928, matches the small circle drawn inside the semicircle in the early-Shōwa plan (thesis fig. 3.1.15). The tower's base could not be isolated at this resolution. No tower coordinate is proposed.
