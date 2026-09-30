# P14 圧縮と検証の試し（Claude、2026-09-30）

対象：Codex の `tower-study.glb`（11:13 版、710,920 バイト）の**コピー**（`claude-out\qa\compress\in.glb`）。元のファイルは触っていない。道具はこのPCの gltfpack 1.3（npm の WASM 版）、glTF-Validator 2.0.0-dev.3.10（`validate-gltf.cjs`）、Blender 4.5.10。どれも無料・ローカル。

| 出力 | gltfpack の指定 | バイト | 元との比 | 描画の回数（primitive） | 三角形 | 検証 | 必要な拡張 |
|---|---|---|---|---|---|---|---|
| in | – | 710,920 | 100% | 4 | 11,056 | 誤り0・警告0・情報4 | なし |
| a | （既定：量子化のみ） | 309,176 | 43% | 4 | 11,056 | 誤り0・警告0 | KHR_mesh_quantization |
| b | `-c` | 107,960 | 15% | 4 | 11,056 | – | + EXT_meshopt_compression |
| **c** | **`-cc`** | **100,180** | **14%** | 4 | 11,056 | 誤り0・警告0・情報2 | + EXT_meshopt_compression |
| d | `-cc -si 0.5` | 82,804 | 12% | 4 | 8,868 | 誤り0・警告0・情報2 | 同上（形が少し減る） |
| e | `-cc -vp 12` | 87,376 | 12% | 4 | 11,056 | 誤り0・警告0・情報2 | 同上（位置の精度 12bit） |

- 形が壊れていないかの確かめ：a を Blender で読み、図版46 のカメラ（photomatch）で描いて元と比べた。**輪郭の差は平均 0.1/255**（縁のにじみだけ）。
- c〜e（meshopt 圧縮）は **Blender 4.5 の取り込みでは読めない**（「EXT_meshopt_compression is not available」）。three.js では `GLTFLoader.setMeshoptDecoder(MeshoptDecoder)`（three に同梱の `examples/jsm/libs/meshopt_decoder.module.js`、無料）で読める。ブラウザでの見た目の確かめは C5（実機）で行う。
- テクスチャが無いので KTX2（toktx）は今回は試していない。テクスチャが入ったら `gltfpack -tc`（WASM 版で動くか未確認）か `toktx --t2 --encode uastc` で試す。
- 勧め：公開用は **`-cc`**（14%、形はそのまま）。編集用の元ファイルは圧縮しないまま残す。`-si`（間引き）は細い格子が抜けることがあるので、遠景用の LOD にだけ使う。Cloudflare の1ファイル 25MiB の上限にはまったく届かない。
- 注意：描画の回数は 4 のまま（材質ごとにまとめ済み）。今の段階では圧縮より**形の修正（photomatch の README）が先**。
