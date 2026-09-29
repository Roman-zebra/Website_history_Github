# Claude → Codex 連絡

新しい連絡は下に追記する。Codex は各タスクの開始時にここを読む。

## 2026-09-30 01:00（1）計画 v3.1 の決定事項
- 無料エリアは **塔の周りのみ**（塔の外観と足元の通り・広場）。塔の中・ロープウェイ・白塔・ルナパーク・新世界の全域・建物の中は有料区画。無料エリアでも昼・夕・夜は切り替えられる（夜の塔の電飾を見どころにする）。
- 決済は **Stripe**。Stripe Checkout → Webhook（署名確認）を Cloudflare Worker で受ける → 購入を記録してライセンスキーを発行 → ブラウザに保存して有料区画を解放。有料区画のデータは Worker で購入を確かめた人だけに配る。復元はライセンスキー入力。まずテストモード。秘密鍵はコードに書かず、ユーザーが wrangler secret で設定する。
- 詳細は JTA-shinsekai\PLAN.md v3.1 の §1・§5・§11。

## 2026-09-30 01:00（2）Claude の予定
- C0 ツール導入を今から行う：Git、Node.js LTS、Blender（LTS）、KTX-Software、npm で gltfpack・gltf-validator・wrangler。終わったら claude-out\qa\tools.md に版と場所を書く。
- 続いて C1 動画の調査、C2 ログインが要る資料の調査。結果は claude-out\research\ に置き、要点をここに追記する。

## 2026-09-30 01:18（3）C0 完了（版の一覧は qa\tools.md）
- Git 2.55.0、Node.js 24.19.0（npm 11.17.0）、Blender 4.5.10 LTS、KTX-Software 4.4.2（toktx・ktx）、gltfpack 1.3、gltf-validator 2.0.0-dev.3.10、wrangler 4.143.1。
- Blender と KTX-Software は PATH に無いのでフルパスで呼ぶ（場所は tools.md）。KTX-Software は winget に無かったため Khronos 公式 GitHub のリリースから入れた。
- gltf-validator は npm のライブラリでコマンドが無い（Node からの呼び方は tools.md）。npm 11.17 は install script を既定で止めるので、wrangler を更新する時は `--allow-scripts=esbuild,workerd` を付ける。
- このPCの Chrome 154 で WebGPU が使える（NVIDIA Turing、texture-compression-bc・shader-f16・timestamp-query）。WebGL2 の圧縮テクスチャは s3tc・bptc が有り、etc・astc は無し。
- 次は C1 動画の調査。

## 2026-09-30 01:25（4）T0 依頼への回答と、GitHub 経由の公開（PLAN v3.2）
- requests-to-claude.md の T0：Blender 4.5.10 LTS は `C:\Program Files\Blender Foundation\Blender 4.5\blender.exe`（`--version` で確認、PATH には無い）。qa\tools.md も更新済み。
- 公開経路：各コミットの check-run「Workers Builds: japan-then-and-now」が success＝GitHub の main から Cloudflare が自動でビルド・公開している。PLAN.md v3.2 §7 に「完成したサイトは GitHub 経由で動かす」を追加（TASKS.md の記載と同じ内容）。
- 気づいた制約：公開に要るデータは全部リポジトリに入れる必要がある（GitHub は1ファイル 100MB まで、Cloudflare の静的アセットは1ファイル 25MiB まで。リポジトリは今 約267MB）。有料データも dist に入れて Worker が購入を確かめてから返す形なら、同じ経路で完結する。

## 2026-09-30 01:33（5）調査用の動画の置き場所
- あなた（ユーザー）の指示で、調査用の動画をこのPCに取得し、1秒ごとのコマにして確認する。置き場所は `JTA-shinsekai\video-work\`（claude-out の外）。**video-work\ はリポジトリに写さない**（動画・コマ画像は GitHub に上げない。容量と権利のため）。結果（場面・時刻・出典・権利）は従来どおり claude-out\research\ の video-index.md と ledger-claude.csv に書く。
- 追加したツール：yt-dlp 2026.08.19、FFmpeg（yt-dlp 版 N-125875、2026-07-31）、Deno 2.9.7（どれも winget、ユーザー領域）。

## 2026-09-30 01:40（6）ユーザーの新しい決まり：課金が要るものは止める（PLAN v3.3）
- Codex も Claude も、課金が必要な項目が出たらその作業を止めて、課金しない安全な方法を探す。見つからなければ requests-to-claude.md に書いてユーザーの判断を待つ。
- 当てはまりそうな例：Cloudflare Workers の有料プランが要る機能や上限超え、R2 など支払い方法の登録が要る機能、Git LFS の追加容量、有料の素材・フォント・音・API、Stripe Tax（有料の追加機能なので候補から外した）。GitHub Actions は公開リポジトリなら無料、Durable Objects は今の SQLite 型なら無料プランで使える。
- Stripe は作品の販売の仕組みで、開発側が前払いする費用は無い（手数料は売上から引かれる）ので、計画どおりテストモードから進めてよい。
