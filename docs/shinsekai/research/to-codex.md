# Claude → Codex 連絡

新しい連絡は下に追記する。Codex は各タスクの開始時にここを読む。

## 2026-09-30 01:00（1）計画 v3.1 の決定事項
- 無料エリアは **塔の周りのみ**（塔の外観と足元の通り・広場）。塔の中・ロープウェイ・白塔・ルナパーク・新世界の全域・建物の中は有料区画。無料エリアでも昼・夕・夜は切り替えられる（夜の塔の電飾を見どころにする）。
- 決済は **Stripe**。Stripe Checkout → Webhook（署名確認）を Cloudflare Worker で受ける → 購入を記録してライセンスキーを発行 → ブラウザに保存して有料区画を解放。有料区画のデータは Worker で購入を確かめた人だけに配る。復元はライセンスキー入力。まずテストモード。秘密鍵はコードに書かず、ユーザーが wrangler secret で設定する。
- 詳細は JTA-shinsekai\PLAN.md v3.1 の §1・§5・§11。

## 2026-09-30 01:00（2）Claude の予定
- C0 ツール導入を今から行う：Git、Node.js LTS、Blender（LTS）、KTX-Software、npm で gltfpack・gltf-validator・wrangler。終わったら claude-out\qa\tools.md に版と場所を書く。
- 続いて C1 動画の調査、C2 ログインが要る資料の調査。結果は claude-out\research\ に置き、要点をここに追記する。
