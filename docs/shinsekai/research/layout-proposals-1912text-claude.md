# Layout proposals from the 1912 text (P20, Claude, 2026-09-30 17:24)

Source: 大久保高城『最近の大阪市 附・地図』増訂再版 1912, NDL PID 946141 (login-free, rights ruling of 2019), frames 266–274. Frames 267, 268, 269, 273 and 274 were read in the original viewer; the others are from the full-text snippets (research/lunapark-facilities.md). This file only proposes. Codex decides and edits `layout-1912.geojson`.

"Relative placement" says where each item sits in words only. None of these statements gives coordinates.

## A. Corrections or flags on existing features
| feature id | what the 1912 text says | proposal |
|---|---|---|
| `seikaen-garden` | The centre of the semicircle 圓街 holds a **pond with a large fountain**: 「中央に池ありて大噴水の高く飛沫を吐くを見る」 (frame 269). **清華殿** is a *building* in Luna Park's **south-east corner**: 「築山を下れば東南隅に清華殿と稱する…」 (frame 273). | Keep the north garden but add `pond+fountain` to it. Do **not** merge the name 清華殿 into it. 清華殿 is a separate Luna Park building (see B). Check the garden's own name (精華園?) against another source. |
| `engai` | 「通天通は塔前にありて大半圓を畫く所を圓街と云ふ」 | The 圓街 is the part of **通天通** that bends into a large semicircle in front of the tower. Add `street: 通天通` to it. |
| `ebisu-dori` / `gappo-dori` | 「惠比須通りは今宮に其口を開き合邦通りは天王寺に向つて走れる」; the same passage calls 惠比須 「東」 and 合邦 「西」. | Keep Codex's geography (Ebisu to the NW toward Imamiya/Ebisuchō; Gappō to the NE toward Tennōji). Note that the book's 東/西 words are reversed. |
| `ropeway` | Tower side: 「再びルーフガーデンに下れば二條の鐵索のルナパーク白塔上に通ずる」 (268). White Tower side: 「塔上に上るもの…鐵索に寄り空中を橫斷して高塔に達する」 (273). | Terminal wording is **roof garden (50 shaku) → the top of the White Tower (白塔上)**. The existing "roughly equal height" note is not what the text says. Keep it only as a scenario, together with the open reference level of the 150 shaku. Sag is not fixed. |
| `white-tower` | 「正面百五十尺の白塔は鬱然たる築山の絶頂に立つ、兩側より梯段ありて山上に到る」 | Add: stairs on **both sides** of the mound; wooded mound (鬱然). The height reference (ground or summit) is open. |
| `masumi-pond` | 「瀑下の地を眞澄池と云ふ、周圍廻らすに噴水を以てす、是亦電燈を水中に秘めて五彩を散せしむ」 | The pond is **below the waterfall**, **ringed by fountains** with **underwater coloured lamps**. |
| `white-tower-rest-house` | 「塔脚よりは飛瀑噴出して四散し、一度び塔下白雨亭の屋上に落ちて…圓形の白雨亭の椽檐を…玉簾を懸くるが如く」 | 白雨亭 is **round**, below the White Tower. The fall lands on its roof and pours off the eaves like a bead curtain. |
| `circling-wave` | 「高さ廿二尺直徑三十六尺の大なる圓輪が約八十人を乘せて」 | Size 6.7 m high × 10.9 m diameter, about 80 riders. |
| `first-tower` | 「脚側左右に翼を張ること各四十有餘間、右にありては二棟左にありては三棟の大活動寫眞館」 (267); 「塔翼両側の活動写真は…ルナパーク前通りに其前面を開き」 (270) | Add wings (see B). |

## B. New features to consider
| proposed id | statement | relative placement | confidence |
|---|---|---|---|
| `tower-wing-cinemas` | Each wing 40+ ken (about 73 m or more); **two** large cinema halls on one side and **three** on the other. Fronts open onto the Luna Park-mae street. | On both sides of the tower base, along the E–W 通天通. Which side has two halls is not stated. | medium (text) / low (position) |
| `tsutenkaku-dori` | 「塔下の一路東西に通ずるものを通天通と稱す」 | E–W road at the tower; it bends into the 圓街 semicircle in front of the tower. | medium |
| `engai-pond-fountain` | Pond with a large fountain at the centre of the 圓街 | Centre of the semicircle. Candidate identity for the round aerial mark (hypothesis only; not a control). | medium |
| `corner-tokyo-kan` | 觀商場東京館, a bazaar selling only Tokyo goods | Corner of 通天通 and 惠比須通 on the 圓街 | medium |
| `corner-western-restaurant` | A western restaurant (a real beer brand in its name: **generic sign**) | Corner of 惠比須通 and 玉水通 | medium |
| `corner-beer-hall` | Beer hall 井筒 | Corner of 玉水通 and 合邦通 | medium |
| `corner-japanese-restaurants` | Japanese restaurants 玉水 and 千とせ | Corner of 合邦通 and 通天通 | medium |
| `radial-shops` | 「數十の新式賣店其兩側に櫛比し」 | Both sides of the radial streets | medium |
| `seika-den` | 清華殿 hall | Luna Park **south-east corner**, reached by going down the mound | medium |
| `fugetsudo-branch` | Confectioner's branch (real brand: **generic sign**) | Luna Park **south-west corner**, next to an automata hall (自動器械) | medium |
| `automata-hall`, `bowling-hall`, `monkey-house`, `peacock-house`, `roller-rink`, `waterfowl-house` (60+ tsubo, 300+ birds) | Frames 272–273 | The same frames group them together; the automata hall is in the SW corner. Leave the others unplaced (no map). | text high / position low |
| `tea-house-hagi-no-to`, `tea-house-hototogisu` | 萩の戸 (east), 杜鵑亭 (west), both pure Japanese style | East and west inside Luna Park | medium |
| `saru-suberi` | 「猿滑り」, a novelty slide (人間轉がし) | Starts from the White Tower hilltop | medium |
| `flower-tunnel` | 花のトンネル | On the path near 白雨亭 (the Billiken shop next to it is **not reproduced**) | low |
| `west-gate` | 「ルナパークの裏面売店を一週して西門に出れば」 | Luna Park west gate, with shops along the back | medium |
| `egypt-hall-obelisks` | Two obelisks and a sphinx statue in front of the Egyptian hall | Next to the Mystery Hall | medium |
| `illumination-50000` | 「全廓五萬燈のイルミネーション」 | Most likely all of Shinsekai (the author calls the whole 30,000 tsubo 「新市街一廓」) | medium |

## C. Proposed next instructions for Codex
1. Add `pond+fountain` and `street: 通天通` to `seikaen-garden` / `engai`, and split 清華殿 (Luna Park SE corner) from the north garden name.
2. Add the B features as **unplaced or zone-only** records (no coordinates until a dated plan exists), each with the frame number as source and `relativePlacement` text. That way T5–T7 content can refer to them now.
3. Turn `ropeway` into two scenarios: terminal A = roof garden (text) → White Tower top (text) with the White Tower height reference open; terminal B = the older equal-height reading. Keep sag unfixed.
4. When the S063/aerial registration is ready, test whether the 圓街 pond and the aerial round mark coincide. Treat it as a check, not a control.
