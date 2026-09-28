# 利用条件確認結果（Japan Time Atlas 有料英語PDF向け）

確認日：2026-09-27。各規約ページは原文（UTF-8/Shift_JIS）で取得し、原文の文言を確認しました。詳細・原文引用・URLは `licenses.json`（37件）にあります。

## 区分の定義

| 区分 | 意味 |
|---|---|
| **A** | 商用可。出典表示だけでよい（申請・継承なし） |
| **B** | 商用可だが条件あり（下の3種類） |
| B（軽） | 出典＋「加工した旨」の表示だけでよい。申請不要 |
| B（承認） | 測量法などの承認申請、または事前の問い合わせが必要な場合がある |
| B（個別） | 自治体・データごとに条件が違う |
| **C** | 引用・出典記載・自分の言葉での要約のみ（画像・原資料の転載は不可） |
| **D** | 使わない |

## 結論：国土地理院の空中写真は有料PDFに載せてよいか

- **載せてよい。出典と加工表示だけで足り、測量法第29条・第30条の承認は不要です。**
  - 対象タイル：ort_USA10（1945〜50年）、ort_old10（1961〜69年）、gazo1〜4、seamlessphoto など。
  - 地理院タイル一覧で「2. 基本測量成果以外で出典の記載のみで利用可能なもの」に分類されています。
  - 同ページに「出典を記載いただくことで、申請なくご利用いただけます」とあります。
  - 承認申請Q&AのQ1-19にも「基本測量成果以外の地理院タイル（白地図、写真等）等については国土地理院コンテンツ利用規約に従って」とあります。
  - 規約は2025-11-20の改正で公共データ利用規約PDL1.0になり、「商用利用も可能です」と明記されています。
- 切り出し・合成・色調補正は加工にあたります。加工したら、出典とは別に「…を加工して作成」と書きます（PDL1.0は加工した主体の記載も求めています）。
- 国土地理院が作成・承認したように見せてはいけません。
- 印刷物では、出典は画像のそばに書くのが原則です。巻末にまとめる場合は、該当ページ番号を併記します。
- **例外（基本測量成果にあたるもの）**：次のものは測量法の手続き（利用手続フロー）の対象です。
  - 購入した空中写真（紙焼き・高解像度スキャン、日本地図センター経由やGSIのデータ提供〔1枚¥5,000〕）
  - 標準地図・淡色地図のタイル
  - 土地条件図（lcm25k）
  - 旧版地図
- 地図が主役の有料商品は、出典明示だけで済む「書籍への挿入」扱いを受けられない可能性があります（Q1-9：「書籍のメインコンテンツが地図である場合は地図帳と同等」）。
- そのためdistrict PDFでは、次のような基本測量成果でないレイヤーだけで構成するのが安全です。
  - 空中写真タイル
  - 地形分類ベクトルタイル
  - 治水地形分類図
  - 白地図
  - OSM
- 基本測量成果を使う場合は、第29条の複製承認を取ります。無料で、処理期間は7〜14日、シリーズ物なら「承認後1年間」の包括承認も可能です（Q4-1）。

## 一覧表

| 区分 | ソース | 商用 | 有料PDFへの掲載 | 必要な表示・手続・注意 |
|---|---|---|---|---|
| B（軽） | 地理院タイル 空中写真（ort_USA10, ort_old10, gazo1〜4, seamlessphoto, nendophoto, ort_riku10, ort_1928, ort） | 可 | 可（加工可） | 「国土地理院」／「地理院タイル」＋一覧URL＋加工表示。承認不要。1945〜50年分は主に米軍撮影なので「国土地理院撮影」とは書かない（閲覧サービスで撮影機関を確認） |
| B（軽） | 地形分類ベクトルタイル（experimental_landformclassification1/2） | 可 | 可 | コンテンツ利用規約が適用され、基本測量成果ではない（README）。旧河道・埋立地をこれで表示するのが最も安全。提供実験なので取得日を明記 |
| B（軽） | 治水地形分類図（lcmfc2）・明治期の低湿地（swale） | 可 | 可 | タイル一覧の区分2（基本測量成果以外）。出典＋加工表示 |
| B（承認） | 土地条件図（lcm25k／lcm25k_2012）・標準地図・淡色地図 | 可 | 条件付き | 基本測量成果。報告書内の見開き以内の挿図なら申請不要。地図が主役の商品や経緯度付きなら第29条承認（無料）を取り、承認番号を表示 |
| B（軽） | 自然災害伝承碑データ（CSV/GeoJSON） | 可 | 可 | 出典＋「翻訳・要約して作成」。各データの「制限事項」欄を確認。現代の碑文は第32条の範囲で引用 |
| B（個別） | 自然災害伝承碑の写真 | 原則可 | 要確認 | 掲載市区町村一覧（2026-09-24版）で確認。約27件は自治体への利用申請が必要、江東区13108-003などは禁止。写真のダウンロード提供なし。自社撮影を推奨 |
| B（承認） | 旧版地図 | 可 | 条件付き | 基本測量成果（1890年以降）。見開き以内の挿図なら申請不要。地図が主役なら第29条承認。全図葉をそのまま複製するのは不可 |
| B（軽） | 地図・空中写真閲覧サービスでダウンロードした写真（400dpi） | 可 | 可 | 基本測量成果ではない（Q1-20）。一括ダウンロード不可 |
| A | NDLデジタルコレクション「インターネット公開（保護期間満了）」 | 可 | 可 | 申請不要・無料。「国立国会図書館デジタルコレクションより」と書くよう依頼あり。画像ごとに公開範囲を確認 |
| C | NDL「図書館・個人送信限定」「館内限定」 | 不可 | 引用のみ | 原則として著作権者の許諾が必要。個人送信では閲覧と自分用の印刷（透かし入り）のみ。ファイルやスクリーンショットの送信・転載は規約で禁止。本文を打ち直して引用し、要約する |
| A | NDLサーチの書誌（NDL作成分） | 可 | 可 | CC BY互換（PDL1.0）。API提供元一覧で「営利△」の提供元（例：ndl-dl）は、APIでの商用利用に申請が必要 |
| C | 著作権法第32条（引用） | ― | 引用のみ | 要件：①公表済み、②必然性＋引用部分の明瞭区別、③主従関係＋必要最小限、④出所明示。翻訳での引用も可（文化庁『著作権テキスト』令和8年度版 p.75） |
| B（個別） | ジャパンサーチ | コード次第 | cc0/pdm/ccby/ccbysaは可。ccbyndは改変しなければ可 | ccbync系・incr・incr_edu・uneval・undet・nocr_* は不可。com/noncom/eduは利用目的別の絞り込み用コード |
| A | e-Stat（政府標準利用規約2.0、CC BY互換） | 可 | 可 | 出典（加工時は加工表示）。数値や簡単な表は著作権の対象外。APIを使う場合は所定のクレジット文を表示 |
| B（個別） | 国土数値情報：洪水浸水想定（A31a/A31b）・内水（A51）・多段階（A53）・高潮（A49） | 可（CC BY 4.0） | 可 | 出典＋加工者名。2012年度版は非商用。A49は千葉県の注記あり。2026-03-23からPDL1.0 |
| B（個別）／D | 国土数値情報：土砂災害警戒区域（A33） | 可。**京都府は商用不可** | 京都府以外は可 | 鳥取・広島・長崎は各県のCC BY表示が必要。重要事項説明の根拠には使えない |
| B（個別） | 国土数値情報：津波浸水想定（A40） | 可 | 可 | 京都府・長崎県は商用利用前に連絡、宮城・三重・島根・大分は各県規約に従う、千葉県は県の解説を確認、香川県は提供なし |
| B（承認） | 国土数値情報：行政区域（N03） | 表示はCC BY | 要確認 | 測量法の承認済み複製物。「本製品を複製する場合には、国土地理院の長の承認を得なければなりません」とある。e-Stat境界データかOSMで代替を推奨 |
| D | 国土数値情報「非商用」データ（避難施設P20など） | 不可 | 不可 | 代わりに自治体オープンデータを使う |
| B（承認） | 国土調査：土地分類・土地履歴調査 | 可（PDL1.0） | 主題部分のみ可 | 背景図（地理院の基本測量成果）ごと複製する場合は測量法の承認が必要 |
| B（軽） | 重ねるハザードマップ（〇のレイヤー） | 可（PDL1.0） | 可 | 「出典：『ハザードマップポータルサイト』」＋加工表示。「-」のレイヤー（ため池・液状化・盛土・地形分類基本調査）と背景地図は使わない。「重要事項説明に使用不可」と注記 |
| B（承認） | J-SHIS（防災科研） | 条件付き | 問い合わせ後 | 「成果物の販売を予定されている方は…お問い合わせください」。生データをそのまま再配布するのは禁止 |
| A | Wikidata | 可（CC0） | 可 | クレジットは任意。Commonsの画像やWikipediaの本文は別ライセンス（CC BY-SA） |
| B（軽） | Wikimedia Commons の写真（立ち寄り先） | 可（CC0・PD・CC BY・CC BY-SAのみ） | 可 | 写真の横に作品名・撮影者・ライセンス（リンク）・Commonsのファイルページを表示（TASL）。縮小のみで加工しない（CC BY-SAでもPDF全体は継承対象外の「収集物」）。NC・ND・GFDLのみの写真と肖像権警告つきの写真は使わない。説明している地点そのものが写っているかを目で確認して採用 |
| B（継承） | OpenStreetMap | 可（ODbL） | 可 | 「© OpenStreetMap contributors」と openstreetmap.org/copyright のURLを地図のそばかクレジット欄に印字。データベースを派生させて公開する場合はODbLで公開。OSMのタイルの一括取得・オフライン利用は禁止（自前で描画する） |
| A | UT Austin PCLのAMS地図（Japan City Plans 1:12,500、1945〜46年、L771/L772） | 可（PD） | 可 | "Courtesy of the University of Texas Libraries" と書くよう依頼あり。米政府の印章は使わない |
| A | NARA（米国連邦政府の記録） | 可（PD） | 可 | 各記録の「Use Restriction(s)」欄を確認。寄贈資料や写真は著作権ありの場合がある |
| A | JACAR（A・B符号） | 可 | 可 | 「アジア歴史資料センター（原本所蔵：…）Ref.…」。C符号（防衛研究所）は掲載前に所蔵館へ問い合わせ |
| A | 国立公文書館デジタルアーカイブ | 可 | 可 | 申請不要。「国立公文書館所蔵」＋件名・請求番号・URIの表示を推奨。加工した場合はその旨を明示するよう依頼あり。目録はCC0 |
| C | 外務省外交史料館（旅券下付表・渡航者名簿） | 手続き次第 | 画像は条件付き | 画像はJACARのB符号経由か、特別撮影申込書（「二次利用」と明記）を出した後に限る。それ以外は引用・要約のみ。個人情報に配慮。**MOFAのサイトはHTTP 403のため未確認** |
| B（承認） | 海上保安庁 海図アーカイブ | サイトは可（政府標準利用規約2.0） | 要確認 | 有償の刊行物は「水路図誌等利用申請」が必要。1948年以前の旧海図に適用されるか不明なので海洋情報部企画課に照会 |
| C | ハワイ州公文書館（Digital Archives of Hawaiʻi） | 不可 | 画像不可 | ポータル規約で「commercial purposes … is prohibited」。書面合意がない限り、事実を自分の言葉で要約する。1900年以降の分はNARAの原本（PD）を使う |
| C | Densho Digital Repository | 原則不可（CC BY-NC-SA 4.0） | PD表示の資料のみ可 | 商用はDenshoの許諾が必要。**Cloudflareのため検索結果の抜粋で確認** |
| C | FamilySearch | 不可 | 不可 | 私的・非商用のみ。Deep Researchで依頼者の私的利用のために資料を渡すことは可（規約に明記） |
| B（個別） | 自治体オープンデータ | 概ね可 | 可 | オープンデータ基本指針はPDL1.0を推奨。データごとにライセンスを確認（例：鳥取県はCC BY 2.1 JP） |

## 推奨運用ルール

1. **district PDFの構成**は、空中写真タイル、地形分類ベクトル（または治水地形分類図）、伝承碑データ（本文テキスト）にとどめる。この構成なら申請は一切不要です。背景地図が必要なら、白地図タイルか自前で描画したOSMを使う。
2. **基本測量成果**（標準地図・淡色地図・土地条件図・旧版地図・N03）を入れる場合は、第29条の包括承認（1年）を取る。その上で、各図に承認番号と出典を表示する。
3. **加工表示は必ず入れる。** クレジットは画像のそば（または頁番号付きのクレジット頁）に置く。「GSI/MLITが作成・監修したものではない」「公式ハザードマップではない」と注記する。
4. **事前ダウンロード**：加工のためにキャッシュするのは可です。ただし原ファイルはそのまま再公開しない（社内ルール）。自動取得では次の点に注意する。
   - 取得頻度を抑える。
   - OSMのタイルサーバー、FamilySearch、ハワイ州ポータルでは自動取得・一括取得をしない。
   - GSI閲覧サービスには一括ダウンロード機能がない。
5. **図書館資料**（NDLの制限資料、外交史料館、Densho、FamilySearch、ハワイ州）は、社内ルールどおり「引用＋要約」にとどめ、画像は載せない。

## district PDF 推奨クレジット

### 画像キャプション（各図の直下）

- EN: *Aerial photo (1947, US military photography; GSI orthophoto): GSI Tiles, Geospatial Information Authority of Japan — cropped and annotated by Japan Time Atlas.*
- JA: 空中写真（1947年、米軍撮影・国土地理院オルソ画像）：出典 国土地理院「地理院タイル」を加工して作成
- EN: *Landform classification: GSI vector-tile experiment "Landform Classification" — restyled, legend translated by Japan Time Atlas.*
- JA: 地形分類：国土地理院ベクトルタイル提供実験（地形分類）を加工して作成

### クレジット頁（英語）

```
Sources & credits
• Aerial photographs (pp. __–__): Geospatial Information Authority of Japan (GSI),
  GSI Tiles — "Aerial photos 1945–1950", "Aerial photos 1961–1969",
  "Latest nationwide photo (seamless)", https://maps.gsi.go.jp/development/ichiran.html.
  Cropped, co-registered, colour-adjusted and annotated by Japan Time Atlas.
• Landform classification (p. __): GSI vector-tile experiment "Landform Classification
  (natural / artificial landforms)", https://github.com/gsi-cyberjapan/experimental_landformclassification;
  GSI Tiles "Flood-control Landform Classification Map". Restyled; legend translated by Japan Time Atlas.
• Natural-disaster memorial stones (p. __): GSI "Natural Disaster Memorial Monuments"
  (自然災害伝承碑) data, registered by municipalities, https://www.gsi.go.jp/bousaichiri/denshouhi.html.
  Descriptions translated and summarised by Japan Time Atlas. Photos: Japan Time Atlas.
• [if used] Hazard layers: Hazard Map Portal Site (MLIT/GSI), https://disaportal.gsi.go.jp/ —
  data by MLIT regional bureaus and prefectures; processed by Japan Time Atlas.
• [if used] Base map: © OpenStreetMap contributors, Open Database License —
  https://www.openstreetmap.org/copyright
• GSI and Hazard Map Portal content is used under the Public Data License v1.0 (PDL1.0),
  https://www.digital.go.jp/resources/open_data/public_data_license_v1.0 (CC BY 4.0-compatible).
  Data retrieved: 20__-__-__.
• Compiled by Japan Time Atlas. Not produced, reviewed or endorsed by GSI, MLIT or any
  Japanese government agency. Not an official hazard map; not for statutory real-estate disclosure.
```

### クレジット頁（日本語）

```
出典・クレジット
・空中写真（p.__–__）：国土地理院ウェブサイト「地理院タイル」（空中写真〔1945〜1950年〕〔1961〜1969年〕、
  全国最新写真（シームレス））https://maps.gsi.go.jp/development/ichiran.html を加工
  （切り出し・位置合わせ・色調補正・注記追加）して Japan Time Atlas 作成
・地形分類（p.__）：国土地理院「ベクトルタイル提供実験（地形分類）」
  https://github.com/gsi-cyberjapan/experimental_landformclassification 及び地理院タイル「治水地形分類図」を
  加工して作成（凡例を英訳）
・自然災害伝承碑（p.__）：国土地理院「自然災害伝承碑」（各市区町村提供）
  https://www.gsi.go.jp/bousaichiri/denshouhi.html のデータをもとに Japan Time Atlas が翻訳・要約
・（使用時）ハザード情報：「ハザードマップポータルサイト」https://disaportal.gsi.go.jp/ を加工して作成
・（使用時）背景地図：© OpenStreetMap contributors（ODbL）https://www.openstreetmap.org/copyright
・利用規約：公共データ利用規約（第1.0版）（PDL1.0）
  https://www.digital.go.jp/resources/open_data/public_data_license_v1.0 ／ 取得日：20__年__月__日
・本資料は Japan Time Atlas が独自に作成したもので、国土地理院・国土交通省その他の行政機関が作成・監修・保証した
  ものではありません。法定のハザードマップではなく、重要事項説明等には使用できません。
```

### Dossier・Deep Research 用の追加クレジット例

- NDL：「国立国会図書館デジタルコレクションより『書名』（年）https://dl.ndl.go.jp/pid/…」
- 国立公文書館：「国立公文書館所蔵『件名』（請求番号）URI」
- JACAR：「アジア歴史資料センター（原本所蔵：外務省外交史料館）Ref.B…」
- UT PCL：「U.S. Army Map Service, *Tokyo* (1:12,500), 1945 — Courtesy of the University of Texas Libraries, The University of Texas at Austin.」
- NARA："National Archives and Records Administration, RG __, NAID __."

## 曖昧な点と、安全側の解釈

- **旧版地図**：2025-09-01から1:25k・1:50kの旧版地形図がTIFFとして「刊行」されています（日本地図センター、1図葉¥610）。そのため、刊行中の地図に適用される規定（全図葉のデッドコピー不可、有償承認）が及ぶ可能性があります。図葉を切り出し、独自の情報を付加したうえで、事前に国土地理院の審査係に照会するか、承認を取ってください。
  - 2022年のパンフレットは「地図・空中写真閲覧サービスの地図」を「基本測量成果に該当しない」としています。これは旧版地図を承認対象とするQ1-18と矛盾するため、旧版地図は承認対象として扱います。
- **国土数値情報 N03**：「CC BY」の表示と「複製には国土地理院長の承認が必要」という記載が併存しています。国土地理院に照会するか、e-Stat境界データやOSMで代替してください。
- **土砂災害警戒区域（京都府）**：国土数値情報では商用不可、ハザードマップポータルでは〇（商用可）となっており、食い違っています。厳しい方（商用不可）に従ってください。
- **未確認の項目**：原ページを直接確認できなかったものがあります。公開前にブラウザで再確認してください。
  - 外務省の各ページ：HTTP 403
  - Densho、UT PCL本体：ボット対策のため
  - FamilySearch、海上保安庁の申請ページ：WebFetch（要約による取得）で確認
- **J-SHIS・海上保安庁（海図）**：販売や有償刊行物への掲載については、事前に問い合わせてください。
