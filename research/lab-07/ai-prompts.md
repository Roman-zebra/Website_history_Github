# ChatGPTで作る立ち寄り先の画像（プロンプト集）

写真が見つからなかった立ち寄り先（13か所）と、冊子に入れる「当時の想像図」を、ChatGPTの画像生成で作るための手順とプロンプトです。
作った画像は `research/lab-07/ai-images/<地区ID>/<番号>.png` に置くと、英語ドシエと日本語冊子に自動で入り、
「AI生成」と表示されます（写真と誤認させないため。景品表示法・販売サイトの規約対策）。

## 手順
1. ChatGPTに下のプロンプト（英語のまま）を貼り、横長 1536×1024 で生成する。
2. 実物に近づける：現地で自分が撮った写真、公式サイトの説明文（文章だけ）、下の「事実」をもとに、
   「屋根をもっと濃い瓦に」「丸窓を2つ」など言葉で修正を繰り返す。
3. PNGで保存し、GitHubの `research/lab-07/ai-images/<地区ID>/` にアップロード（Webの「Add file → Upload files」）。
   または Google ドライブに `JTA-ai-images/<地区ID>/` を作って入れ、場所を教えてください。こちらで取り込みます。
4. ファイル名は番号だけ：`3.png`（今の場所のイメージ）、`4-past.png`（当時の想像図）。

## ChatGPTに渡してよい参考画像・だめな参考画像
- 渡してよい：自分で撮った写真／国立国会図書館デジタルコレクションの「インターネット公開（保護期間満了）」の画像・浮世絵などパブリックドメインのもの／CC0の写真／国土地理院の空中写真（出典表示が必要）。
- 渡してはいけない：他人がウェブやSNS、Googleマップ・ストリートビューに載せた写真（その写真の模倣になり、著作権・利用規約の問題になる）。
  国立国会図書館の「個人送信」資料の画面やスクリーンショット（利用規約でアップロード禁止。アカウント停止のおそれ）。
- CC BY-SAの写真を参考にした場合は、できた画像にも出典表示とCC BY-SAが必要になるので、使うなら先に相談してください。
- 共通：人の顔がはっきり分かる人物、実在の店名・ロゴ、読める看板の文字（AIは文字を崩す）、軍の記章は入れない。

## プロンプト（今の場所のイメージ：`<番号>.png`）

### chatan（北谷）3 — 嘉手納飛行場のフェンス沿い
事実：1945年から農地を接収してできた基地。公共の場所から縁に沿って眺めるのがよい。
```
Photorealistic eye-level photo, Okinawa, Japan: a long chain-link fence topped with barbed wire runs beside a quiet two-lane road; beyond it a vast flat grassy airfield with a distant runway and low hangars under a humid subtropical sky; roadside hibiscus and sugar-cane plants; no people, no aircraft markings, no readable signs; natural daylight, 3:2 landscape.
```

### chatan 5 — 砂辺の護岸
事実：アメリカンビレッジの北、海岸道路と護岸。ダイビングスポットとして知られ、夜は嘉手納基地の滑走路の灯りが見える。
```
Photorealistic photo, Okinawa coast at Sunabe, Chatan: a low concrete seawall promenade runs along a rocky coral shore with clear turquoise shallow water; a coastal road and two- to four-storey houses and apartments behind it; late afternoon light; a few distant snorkel buoys in the water; no identifiable people, no readable text; 3:2 landscape.
```

### fujiyoshida（富士吉田）5 — 吉田のうどん
事実：昭和初期、織物の問屋街だった絹屋町で、仲買人に太くこしの強いうどんを出したのが始まり。
```
Photorealistic overhead-angle food photo: a bowl of Yoshida udon from Fujiyoshida, Japan — very thick, firm, slightly irregular wheat noodles in a light miso-and-soy broth, topped with boiled cabbage, simmered sliced meat and a small spoonful of red chili paste (suridane) on the side; on a worn wooden table of a simple noodle shop; soft window light; no text, no people; 3:2 landscape.
```

### kin（金武）2 — 當山記念館
事実：1935年築の鉄筋コンクリート造。曲面の梁のない天井と丸窓。平日9〜16時、無料。
※参考写真がないため形は想像。平日に自分で撮影するのが一番確実です。
```
Photorealistic photo of a small 1935 reinforced-concrete memorial hall in rural Okinawa: a single-storey white-plastered building with a gently curved roof line and a row of round porthole windows, a short flight of steps to the entrance, tropical trees and a well-kept lawn around it, bright daylight; no people, no readable signs; 3:2 landscape.
```

### mio（三尾・和歌山）1 — カナダミュージアム（旧野田家住宅）
事実：1934年ごろ、バンクーバー帰りの中津家が建てた和洋折衷の住宅。のち野田家。国登録有形文化財。
```
Photorealistic photo of a two-storey 1930s house in a Japanese fishing village in Wakayama, mixing Japanese and Western styles: grey Japanese clay-tile roof, painted wooden clapboard walls, tall Western-style sash windows with white frames, a small entrance porch; a narrow village lane in front; summer daylight; no people, no readable signs; 3:2 landscape.
```

### mio 2 — カナダガーデン
事実：博物館の隣。カナダ製のトーテムポール、2022年に建った工野儀兵衛の銅像、日ノ御埼灯台2代目のフレネルレンズ。
```
Photorealistic photo of a small garden beside a village museum on the Wakayama coast: a tall carved and painted cedar totem pole in the Pacific Northwest style stands on a lawn; to one side a large glass lighthouse Fresnel lens is displayed under a small protective roof; a bronze statue of a man in early-1900s clothes is seen from a distance in the background (face not detailed); blue sky; no people, no readable text; 3:2 landscape.
```

### mio 3 — 旧三尾小学校
事実：学校としては閉校。1909年の校舎は一部を北米の移民の寄付で建てた。いまは子どもが英語で案内する活動の拠点。
```
Photorealistic photo of a closed elementary school in a small fishing village on the Wakayama coast: modest school buildings around a sandy schoolyard, a hillside and the sea glimpsed behind; quiet summer afternoon; no people, no readable signs; 3:2 landscape.
```

### niseko（ニセコ・倶知安）2 — 羊蹄山 倶知安コース登山口
事実：1924年の案内書が比羅夫駅から歩く道として紹介した西側の登山道。
```
Photorealistic photo of a mountain trailhead in Hokkaido in early summer: a narrow dirt trail enters a forest of birch and fir from a small gravel parking area, with a plain wooden trail signpost; above the trees rises the symmetrical volcanic cone of Mount Yotei with thin snow patches near the summit; clear morning light; no people, no readable text; 3:2 landscape.
```

### niseko 3 — 比羅夫神社
事実：1912年の創建。7世紀の武将・阿倍比羅夫にちなむ地元の伝承（ほかの町にも同様の伝承がある）。
```
Photorealistic photo of a small rural Shinto shrine in Hokkaido: a plain wooden torii gate, a short gravel approach and a small wooden shrine hall, surrounded by tall birch and pine trees; potato fields and a distant mountain beyond; soft summer light; no people, no readable text; 3:2 landscape.
```

### osaka-namba 5 — 千島町附近の木津川護岸
事実：1898〜99年に大阪の築港工事の一部として石と土で護岸が築かれ、1854年の津波で越えられた岸に代わった。
```
Photorealistic photo of a wide urban river in Osaka (the Kizu River near Taisho ward): tall grey concrete and stone embankment walls line both banks, with warehouses, small factories and a steel bridge in the distance; a small work boat on the water; overcast daylight; no people, no readable text; 3:2 landscape.
```

### suo-oshima（周防大島）3 — 斜面のみかん畑
事実：東屋代・西屋代の斜面。江戸後期から続くとされ、1923年の郡誌は畑には急すぎる土地と書いた。
```
Photorealistic photo of steep terraced mandarin-orange orchards on a hillside of Suo-Oshima island, Yamaguchi: dry-stone terrace walls, dark-green citrus trees heavy with ripe orange fruit, a small farm track, and the calm Seto Inland Sea with small islands below; clear winter sunlight; no people; 3:2 landscape.
```

### suo-oshima 4 — 東屋代の海岸
事実：島のこちら側から北の海の向こうに広島県を望む景色。1923年の郡誌も同じ眺めを書いている。
```
Photorealistic photo of a quiet shoreline on the north side of Suo-Oshima island, Yamaguchi: a low seawall and pebble beach, calm Seto Inland Sea, and across the water to the north a line of hazy blue mountains and small islands; a few small fishing boats; soft morning light; no people, no readable text; 3:2 landscape.
```

## プロンプト（当時の想像図：`<番号>-past.png`、日本語冊子用）
想像図は写真に見えないよう、絵の画風にします。

### chatan（北谷）2 — 北谷ターブックヮ（戦前の水田）→ ファイル名は `2.png`（英語ドシエにも入る）
事実：旧村の中心の内陸の低地に、沖縄三大美田の一つとされた水田が広がっていた。基地建設とその後の開発で失われた。
```
Painterly watercolor illustration (not a photograph) of lowland rice paddies in Chatan, Okinawa, before 1945: flooded green paddies divided by narrow earthen banks, a few farmers in straw hats as tiny distant figures, a village of red-tiled Okinawan houses sheltered by fukugi trees at the edge, low limestone hills behind, and a glimpse of the sea; soft morning light; 3:2 landscape.
```

### tokyo-asakusa（浅草）4-past — 江戸時代の浅草御蔵
事実：隅田川沿いに幕府の米蔵「浅草御蔵」が並び、蔵前の札差が武士の家計に金を貸した。
参考に渡してよいもの：国立国会図書館デジタルコレクションの『江戸名所図会』など、保護期間満了の浮世絵・挿絵。
```
Detailed Japanese woodblock-print style illustration (ukiyo-e inspired, not a photograph) of the Edo-period shogunate rice granaries at Asakusa (Asakusa Okura) on the Sumida River, 18th century: long rows of white-plastered storehouses with black tiled roofs behind a stone embankment, flat-bottomed boats unloading straw rice bales at small docks, merchants and porters as small figures, the wide river with sailing boats; soft muted colors; 3:2 landscape.
```
