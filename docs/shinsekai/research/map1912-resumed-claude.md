# 1912年の実測地図で見た新世界（先回り P11、Claude）

## 資料
- 『實測大阪地図』昇竜堂、**1912年**、分図110枚＋索引図、各図 55×80cm。大阪市立図書館デジタルアーカイブ。**各図の個別ページに CC0（申請不要・二次利用可）**。高解像度（7288×9941 px、約28〜30MB）が取れる。取得は Codex のスクリプトで：
  - **OSK0186828**（ファイル s0004038.jpg、原図の表記「第三行ノ八段ノ甲」）：**新世界の本体**（図の右上〜右下）。
  - OSK0186821（s0004031.jpg、「第二行ノ八段ノ乙」）：東隣。天王寺公園（競走場の楕円、武徳殿）、茶臼山、天王寺駅。
  - 元画像の URL：`https://image.oml.city.osaka.lg.jp/da/download/?id=0000000021-OSK0186828&size=org&type=image&file=%2F写真・絵はがき・古文書・地図%2Fs0004038.jpg`
- 性格：**地籍（土地の区画と地番・坪数）を実測した地図**。建物や遊園地の施設は描かれていない。道路の形と幅、区画の境、鉄道・軌道が正確に描かれているので、**配置図の位置合わせ（ジオリファレンス）の基準**に最適。

## 図 186828 の右半分で読めたこと（北が上）
- 西側を南北に通る**点線の軌道＝恵美須町の阪堺電車の線**（図の左寄りの二重の点線）。その東が新世界。
- 新世界の北半分：**北へ扇形に開く放射状の通り**（恵美須町の側へ）と、その南の端に**半円形に広がる広場（円街）**。通りと広場の縁の曲線がはっきり描かれている。
- 半円の広場の**すぐ南に、破線の円**が1つ（直径は周りの通りの幅の約2倍）。一点鎖線（町の境）が円の中心を東西に通る。→ **初代の塔の位置（予定地）を示す記号の可能性が高い**（半円の広場の南、通天通の上という文献の位置と合う）。凡例は未確認。
- 円の南に**大きな区画「1,563坪（九四〇番ノ二）」**（劇場の並びの区画か）、その東西にも区画。
- さらに南（霞町）：通りで区切られた区画が並び、南の端に**「大阪市電鉄車庫予定地」**（市電の車庫の予定地）。その南を**鉄道の築堤**（関西本線とみられる）が東西に走る。
- 東の端：**天王寺公園**と「天王寺水園町」。
- 大きな地番：北東の「21,850坪（恵美須…九七〇番ノ一）」は、新世界の土地をまとめた大きな地番の可能性（大阪土地建物の借地は約28,000坪）。
- **ルナパークの施設は描かれていない**（地籍図のため）。ルナパークの区画は、塔の南の街区（文献では塔の南、3,700〜4,000坪）。

## Codex への提案
1. 186828 を取得して、**1928・1942 の空中写真と道路の交点で位置合わせ**する（放射状の通りの交点、半円の広場の縁、阪堺の線、鉄道の築堤が対応点になる）。
2. 破線の円を**塔の中心の第一候補**にする（写真のカメラ合わせと突き合わせて確かめる）。
3. 区画の坪数と地番から、ルナパークの区画（3,700〜4,000坪）がどれかを絞る。
4. 同じ地図の凡例（索引図）で破線の円の意味を確かめる（索引図も OML にあるはず）。

## 追記（2026-09-30 13:16）S063 と博士論文 図3.1.15 の突き合わせ（Codex の依頼「1912 map versus later street grid」）
- 比べた図：佐々木葉 博士論文（1994、NDL 3082223 コマ43、ログイン不要・許諾公開。著作物なので事実の比較だけ、図は使わない）図3.1.15「新世界地区の計画の変遷」＝(1) 新世界計画案（1911、『大阪市会議事録』より）、(2) 新世界開業時（1912、『大阪新名所新世界写真帖』＝1913年の写真帖より）、(3) 昭和初期（『新世界興隆史』より）。北向きの矢印と 0–100m の縮尺つき。
- **(1) 1911年の計画案と違う点**：計画案の北の中心は**丸い広場（円）に8方向ほどの通りが集まる星形**。S063 は**半円の広場（南側が直線）に北の3本（北西・北・北東）が集まる形**で、計画案とは違う。
- **(2) 1912年の開業時の図と合う点**：半円の広場（南に開く）と北の3本の放射の通り／広場の南の縁に沿う幅の広い東西の通り（開業時の図では「通天閣」の文字がこの通りの上、中心の軸上）／その南の大きな区画（開業時の図の「ルナパーク」、S063 の「1,563坪 九四〇番ノ二」。どちらも角を落とした形）。
- **(1) と共通の点**：S063 の南端の「大阪市電鉄車庫予定地」＝計画案の「車庫敷地」。「予定地」と書かれているので、S063 は**計画の用途も書き込んだ地籍図**。
- **合わない点**：S063 の**破線の円**に当たる物は3つの図のどこにも無い。開業時の図では塔は半円の広場の中心の真南（東西の通りの上、中心の軸上）で、破線の円はそこから西にずれている（Claude の切り出しで約350 px。縮尺は未換算）。昭和初期の図の小さな円は半円の広場の**中**で、場所が違う。→ 円の正体は未確認のまま。
- 図3.1.18「新世界地区（左：1921、右：1929）」は地形図の切り出しで、閲覧画面の解像度では細い通りを追えない。本文によると、実際の街路では**北東の放射の通りの端が神社の境内に突き当たって抜けていない**。S063 の北東の通りは図の右の縁まで続いており、東隣の図（OSK0186821）で先を確かめる必要がある。
- **判定**：S063 は**1911年の計画案ではない**。北の半分（半円の広場・3本の放射・東西の通り・南の大区画）は**1912年の開業時の図と同じ形**。ただし地籍図なので、描かれた通りが1912年に全部できていたかどうかは分からない（区画の線と「予定地」の書き込みがあるため）。「計画」と「実際」のどちらかと言えば、**開業時（1912年）の区画割りを測った図**。

## 追記（13:34）位置合わせ用の恒久的な交点（Codex の依頼。破線の円と車庫は使わない）
S063＝原図 `s0004038.jpg`（7288×9941 px、左上原点）。GSI＝`research-cache\gsi\*-mosaic-7x7.png`（z18、タイル x 229741–229747・y 104139–104145、1792×1792 px、約0.49 m/px）。
| 記号 | 何か | S063（原図 px） | GSI 1928 モザイク（px） | 同じ物と言える理由 | 不確かさ |
|---|---|---|---|---|---|
| K1 | **阪堺の線路が鉄道の築堤（関西本線）の下をくぐる所**（築堤の三角の記号が途切れる） | (4240, 5900) ±15 | (505, 1650) ±25 | 阪堺は1911年開業から同じ位置（今の新今宮駅前停留場）。1928年の写真では阪堺の車庫（線路の西）と市電の車庫（東）の屋根の間を通る筋が築堤の明るい帯に当たる所。今の標準地図でも阪堺（点線）が JR を越える所 | 1928年の写真は細い線路が読みにくい。±25 px（約12 m） |
| K2 | **東側の南北の道が築堤の下をくぐる所**（築堤の記号の切れ目） | (6070, 6400) ±15 | (860, 1735) ±30 | 市電車庫予定地の区画の東の縁の道。1928年の写真では市電の車庫の屋根の東の縁に沿う道が築堤に当たる所、今の地図では浪速警察署の西の南北の道 | ±30 px。1928年の写真で東隣にもう1本の道（約 (918,1778)）があり、取り違えの可能性あり |
- 確かめ：K1–K2 の距離は S063 で 1,896 px×0.1032 m/px ≈ **196 m**、1928 で 372 px×0.491 m/px ≈ **182 m**（差 7%）。向きは S063 で東から約16°南、1928 で約17°（築堤の向きはどちらも約 11〜16°）。
- 恵美須町の交差点（阪堺の起点）は S063 の上の枠の外で使えない。

## 1913 developer album site plan, found reproduced (Claude, 18:04) — fact notes only (NDL 個人送信, no image saved)
- Where: 『日本の建築 明治大正昭和 5 商都のデザイン』 (坂本勝比古, 三省堂 1980; this is **note [59]**, earlier marked "not in NDL"). It is now readable via NDL 個人送信: PID 12874185, frame 87 (right page), **figure 200 「新世界配置平面図」, credited to 『大阪新名所新世界写真帖』** (大阪土地建物, 1913).
  - Fig. 201 is 「新世界通天閣」, 竣工=明治四五年五月, same album credit. Its caption: 「地上一八〇尺鉄骨造のこの建物は…」. **180 shaku ≈ 54.5 m**, a new height statement. It is unclear whether this is the album's number or Sakamoto's.
  - Fig. 202 is 「新世界大正館」 (a cinema, same album).
  - The body text says the steel came to about 350 t (same as the 1912 guide).
- Plan orientation (reading in progress): **north = left** (the 逢坂通 frontage along the left edge), so the plan is rotated 90° CCW from north-up.
  - The three radials fan out to the left from a **semicircle hub**. The upper radial = east = 合邦通 (toward Tennōji), the middle = 玉水通, and the lower = west = 恵美須通.
  - 「通天閣」 is written just right of (south of) the semicircle.
  - Further right: a column of lots, then **Luna Park** drawn as a rounded octagon labelled 「ルナパーク」 with a central circular feature. At the far right are two columns of lots and a large empty rectangle (labels 「…地」, probably planned sites).
  - The bottom edge (west) is labelled 「…町」.
- Fig. 201 photo: an elevated view from the south with the octagonal music hall, the Circling Wave on the right, and the full south facade with both wings (useful for wing extents).
- Still to do: read the lot labels in Luna Park and the lots (legible at maximum viewer zoom).

### 1913 album plan: transcription (18:08; legible at maximum viewer zoom; small labels limited by the scan)
Orientation check: the plan is rotated 90° CCW, so **north = left, east = top, south = right, west = bottom**. Three checks agree: the left-edge frontage 逢坂通 (the 1912 guide: 「東逢阪通二丁餘の延長を前面とし」), the upper radial = 合邦通 toward Tennōji (east), and the bottom edge 「…町」 toward Ebisuchō (west).

| zone (true direction) | what the plan shows | legibility |
|---|---|---|
| North district | three radials (E 合邦通, centre 玉水通, W 恵美須通) fanning north from a **semicircle hub**; lot blocks between them; the corner lots on the semicircle are labelled | radial names medium; lot labels low |
| Hub, south side | a column of lots running E–W directly south of the semicircle. The **middle lot is labelled 「通天閣」**. East of it two lots; west of it the lots include **「大正館」** (the westernmost next to Luna Park's NW corner). One east-side lot reads 「第十…館」 (a numbered hall) | 通天閣 high; 大正館 medium; others low |
| → Interpretation | this column is the **tower plus its cinema wings along the E–W road**, matching the 1912 guide's 「脚側左右に翼…右二棟左三棟の大活動寫眞館」 | medium |
| Luna Park | south of the column: a **rounded-corner rectangle** labelled 「ルナパーク」 diagonally. Inside: a **large central circle** toward the south-centre (small label ending 「…楽堂」? → music hall), a small **square building just south-west of that circle** (White Tower candidate), a **long octagon** in the north-west part (label unreadable; ride or hall), and several small circles (fountains/kiosks) | outline high; interior labels low |
| West of Luna Park | an L-shaped lot 「…館建設地」 | medium |
| South of Luna Park | **two lots 「興行館建設地」** (planned entertainment halls) | high |
| South-east | 「旅館料理屋建設地」 (planned inns and restaurants), and a small corner lot with an unreadable label | high / low |
| Far south | a **large empty rectangle**, unlabelled (later the sumo hall or Radium bath area? hypothesis only) | – |

- This is a **1913 plan-level topology source**: tower column → Luna Park → planned lots, from north to south. It matches Codex's layout (Luna Park south of the tower; radials to the north).
- There is **no scale bar or north arrow visible** at this resolution, so it is not a georeferencing control. It is a topology check.
- Better legibility needs the album itself. The Osaka Prefectural Nakanoshima Library holds 『大阪新名所新世界写真帖』 (call no. あ-23, per its 1968 accessions list). Visiting is the user's decision.
