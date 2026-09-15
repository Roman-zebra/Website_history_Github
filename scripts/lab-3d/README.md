# lab-3d：空中写真から端島（軍艦島）を立体にする（テスト）

トップの「06 3Dでよみがえる」タブと `/3d/gunkanjima`（英・日・韓・簡・繁の5ページ。`scripts/build-3d-pages.cjs` が `gunkanjima.template.html` から生成。canonical・hreflang・OGP・JSON-LD 付き、サイトマップ登録済み。旧 `/lab/gunkanjima-3d` は301）が読み込むファイルを作る手順です。
公開ビルドには含まれません（`scripts/build.cjs` は `scripts/` を公開しない）。

## できあがるもの（`3d/`）

| ファイル | 中身 |
|---|---|
| `gunkanjima-lab.json` | 座標系、格子、年代、スポットの位置、検算の数値 |
| `gunkanjima-{1947,1962,1975,2010,latest}.jpg` | 年代ごとの写真。1962年の切り出し座標にそろえた2,048px（1画素およそ0.4m） |
| `gunkanjima-1962-height.bin`、`gunkanjima-2010-height.bin` | 高さ（Uint16、0.1m単位、1画素およそ0.8m） |
| `gunkanjima-change.bin` | 1962→2010の高さの変化（Int8、m。±5m未満は0） |
| `gunkanjima-spots.json` | スポットの名前と説明（5言語）、出典、写真のクレジット |
| `gunkanjima-model.json`、`gunkanjima-terrain.bin` | **v4 復元モデル**：建物88棟（輪郭・棟割り・階数・階高・竣工年・崩壊年・様式・用途・出典。OSM 66棟＋30号棟＋1962年写真から輪郭を取った名称不明21棟）、護岸の線（104点・天端高さ）、海岸線、地形（地理院5m DEM を切り出し座標へ、Uint16 0.1m） |
| `gunkanjima-buildings.json` | 建物の輪郭（OpenStreetMap、1962年の切り出し座標）と、輪郭の内側で測った屋根の高さ（1962・2010）、外側の地面の高さ。30号棟だけは OSM に無いので高さ格子から輪郭を取った |
| `island-from-sea.jpg`、`island-north-2024.jpg`、`gunkanjima-card.jpg` | 海上から撮った現地写真（Wikimedia Commons、CC BY-SA 3.0 / CC BY 4.0。ページとカードにクレジット） |
| `spots/` | スポットごとの空中写真の切り抜き（1962年と最新）と写真 |
| `audio/gunkanjima-podcast-{en,ja}.mp3` と `.json` | 音声ガイド（v3: Microsoft のニューラル音声を edge-tts で合成。日本語は常体の会話、英語も同じ調子）と、時刻つきの台本・チャプター・立体を動かす合図 |
| `gunkanjima-3d.html`、`gunkanjima-3d.js`、`gunkanjima-podcast.js` | ページ、ビューア（WebGL、ライブラリなし）、音声プレーヤー |

## 入力（元データはリポジトリに入れていません）

国土地理院の空中写真は測量法の基本測量成果で、複製に承認が要る場合があるため、元の画像ファイルは置いていません。
サイトに載せているのは加工したもの（「国土地理院の空中写真を加工して作成」）です。同じ元データは次の番号で取り直せます。
このフォルダの横に置いてから手順を実行します。

- `photos/`（地図・空中写真閲覧サービス。規約に同意のうえ400dpi）
  - `USA-M185-38.jpg`（1947-03-26、約1:30,700）
  - `MKU628-C18-2.jpg`、`MKU628-C18-3.jpg`（1962-05-30、RMK c=152.67mm）
  - `CKU7420-C45-6.jpg`（1975-01-02、カラー）
  - `CKU20103-C44-12.jpg`、`CKU20103-C44-13.jpg`（2010-05-03、DMC デジタル f=120mm）
- `tiles/`：地理院タイル z17（`seamlessphoto`、`ort_old10`、`gazo1`）x 112770〜112773、y 52953〜52958
- `tiles18/`：`seamlessphoto` z18 x 225541〜225547、y 105910〜105917
- `dem/`：`dem5b_png` z15 x 28192〜28193、y 13238〜13239（無いタイルは404のまま）
- `osm.xml`：OpenStreetMap API `map?bbox=129.7345,32.6245,129.7425,32.6315`（© OpenStreetMap contributors、ODbL）
- `spots_src/`：Wikimedia Commons の写真（元ページ、撮影者、ライセンスは `lab/gunkanjima-spots.json` の `photos`）

タイル番号は暗算しないこと（手で出して2回まちがえた）。

## 手順

1. `python mosaic.py` — タイルをレイヤーごとにつなぐ
2. `python stereo.py --year 1962`、`python stereo.py --year 2010` — SIFTで照合し、平面のホモグラフィで重ね、エピポールの向きに回して StereoSGBM（左右一致チェックつき）
3. `python georef.py --year 1962`、`--year 2010` — 切り出しを地理院タイルに合わせる（1画素の大きさと北の向き）
4. `python calibrate.py --year 1962`、`--year 2010` — 視差を高さに直す（h = H(1 − P_sea/P)）。海面の視差は、現在の5m標高のうち開けた地面の下包絡に平面で合わせる。外れ値、細い針、小さな塔を除いたあと、写真の輪郭に沿って平滑化（ガイデッドフィルタ）
5. `python osm_extract.py`、`python osm_overlay.py` — OpenStreetMap の建物の位置を1962年の切り出し座標へ。`out/debug_osm_overlay.jpg` で目で確かめる
6. `python export_web.py` — `web/` に全部を書き出す。**v4**: `python terrain.py`（DEMタイル→`out/dem_crop.npy`）→ `python trace_1962.py`（OSMに無い1962年の建物を高さ格子から矩形で抽出）→ `python model.py`（`buildings_facts.json`＝Wikipedia「端島」の建物一覧と合わせて `web/gunkanjima-model.json`・`web/gunkanjima-terrain.bin`）。続けて `python buildings.py` で OpenStreetMap の建物輪郭ごとに屋根と地面の高さを付けて `web/gunkanjima-buildings.json` を作る（ビューア v3 の壁。窓の並びは階数からの模式で、写真には写っていない）。1975年は1月の長い影でSIFTが効かないので島の輪郭＋ECC、1947年は向きと縮尺の探索＋ECC（`register_photo.py`）
7. `python podcast/build_podcast.py --lang en`、`--lang ja` — 既定は `--engine edge`（`pip install edge-tts`。Microsoft のニューラル音声をネット経由で1行ずつ合成し `podcast/cache_edge/` に貯める）。`--engine winrt` で以前の Windows 標準音声（`tts_build.ps1`）。ffmpeg でラウドネスをそろえて MP3。台本は `podcast/podcast_{en,ja}.json`（`say` が読み仮名つきの読み上げ用、`t` が表示用）
8. `python podcast/verify_podcast.py --lang en`、`--lang ja` — 手元の音声認識（faster-whisper、キャッシュ済みモデル）で聞き取り、台本と行ごとに比べる
9. `web/` を `lab/` に、`podcast/out/` の mp3 と json を `lab/audio/` にコピー

## 検算（2026-09-14）

- 1962年：地図の縮尺から出した飛行高度1,950m は、写真のふちの高度計「ALT 1950」と一致。浮き桟橋は海面+2.5m。海面をオフセットだけで合わせると同じ桟橋が+11m になった（重ねに使った平面が500pxで約29m傾いていた）。下包絡の残差 RMS 0.81m（63ブロック）。照合できず埋めた点16.3%。高さは中央値12.6m、上位1%で43.2m、最大49.7m。
- 2010年：地図の縮尺から2,022m、写真の記録は2,008m。平面の傾きは500pxで3.3m。残差 RMS 0.99m（177ブロック）。埋めた点5.8%。高さは中央値9.6m、上位1%で43.9m、最大47.5m。
- 変化：2010年に5m以上低くなった面積6,941m²（島72,557m²のおよそ1割）、5m以上高くなった面積503m²、10m以上低くなった面積912m²。護岸に沿った細い帯は位置合わせのずれの可能性がある。
- 位置合わせ：2010年は地図経由の連結（直接の照合は15点しか取れず、補正には使っていない）。1975年は輪郭の重なり0.915、ECC相関0.463。1947年は探索でNCC 0.344、ECC相関0.449（回転0°、縮尺0.91）。
- 音声（v3, 2026-09-14）：英語7分53秒、日本語8分54秒（どちらも59行、10章）。faster-whisper の聞き取り照合は英0.97・日0.90（日本語の差はほぼ同音の漢字違い。「30年」が「10年」に聞こえたので読み仮名を付けて作り直した）。
- 壁（v3）：OSM の建物66棟＋30号棟。屋根の高さは輪郭内の格子の上位30%点、地面は輪郭のすぐ外側の輪の下位25%点。65号棟 壁17m（実際は9階）、小中学校 壁24m（7階）。影は5月30日10時ごろの太陽で、1962年写真の影と向きを合わせた。

## v4（復元モデル）の考え方

- 写真測量の凸凹（1画素0.8m・壁面は写らない）を見せるのをやめ、建物ごとに「輪郭×階数×竣工年」の角柱にした。年スライダーは建物の竣工年・崩壊年に連動し、1947年も（竣工年が分かる建物だけで）立体になる。
- 壁面は様式ごとの模式（日給社宅=連続外廊下、アパート=窓列＋階帯、学校=横連窓、工場、木造、神社）。ページに「写真ではない」と明記。
- 参考写真は `refphotos/catalog.json`（Commons「Category:Hashima (Nagasaki)」配下 298点、ライセンス付き）と `refphotos/sheets/`（建物番号ごとの一覧）。
- 音声は冒頭のチャイム・波音を廃止。プレーヤーに±15秒・章送りを追加し、シークは loadedmetadata を待つ。ローカル確認サーバは Range 対応（無いと MP3 内をシークできない）。

## 限界

- 写真2枚ずつのステレオです。場所によって高さが数メートルずれます。
- 上から奥が見えない路地は埋まり、壁は斜面になります。煙突のような細いものは消しています。
- 1975年と最新は別の年の形を借りています。1947年は平面です。
- 海面の基準は現在の標高データで、当時の測量値ではありません。
- 声は Microsoft のニューラル合成音声（edge-tts）です。合成にはネット接続が要ります。
- 壁の窓は階数から描いた模式で、写真の解像度（1画素約0.8m）では壁面は写りません。壁は今の輪郭（OSM）なので、1962年にあった木造の建物には壁が付きません。
