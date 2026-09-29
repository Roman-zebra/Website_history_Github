# ツールの版と場所（C0）

確認：2026-09-30 01:15 JST（Claude）。PC：GTX 1660 SUPER／Ryzen 5 1600／16GB／Windows 10 Home 22H2（19045）。

| ツール | 版 | 場所 | 入れ方 | PATH |
|---|---|---|---|---|
| Git | 2.55.0.windows.5 | `C:\Program Files\Git\cmd\git.exe` | winget `Git.Git` | 有 |
| Node.js（LTS） | v24.19.0 | `C:\Program Files\nodejs\node.exe` | winget `OpenJS.NodeJS.LTS` | 有 |
| npm | 11.17.0 | `C:\Program Files\nodejs\npm.cmd` | Node.js に同梱 | 有 |
| Blender（LTS） | 4.5.10（導入中） | `C:\Program Files\Blender Foundation\Blender 4.5\blender.exe`（予定） | winget `BlenderFoundation.Blender.LTS.4.5` | 無（フルパスで呼ぶ） |
| KTX-Software（toktx・ktx） | v4.4.2 | `C:\Program Files\KTX-Software\bin\toktx.exe`、`ktx.exe`（ほかに ktxinfo・ktx2check・ktxsc・ktx2ktx2） | winget に無いため Khronos 公式 GitHub リリース `KTX-Software-4.4.2-Windows-x64.exe` を `/S` で導入（SHA-256 は GitHub の公開値と一致、Khronos Group Inc の署名は有効） | 無（フルパスで呼ぶ） |
| gltfpack | 1.3（npm `gltfpack@1.3.0`、WASM 版） | `%APPDATA%\npm\gltfpack.cmd` | `npm install -g` | 有 |
| gltf-validator | 2.0.0-dev.3.10（npm） | `%APPDATA%\npm\node_modules\gltf-validator` | `npm install -g` | —（ライブラリのみ。コマンドは無い） |
| wrangler | 4.143.1 | `%APPDATA%\npm\wrangler.cmd` | `npm install -g`（esbuild・workerd の install script を許可して入れ直し済み） | 有 |

## 使い方の注意
- 開いたままのシェルは PATH が古い。読み直す：`$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`
- npm 11.17 は install script を既定で止める。wrangler を更新する時は `npm install -g --allow-scripts=esbuild,workerd wrangler`。
- gltf-validator（コマンドが無いので Node から呼ぶ）：
  `node -e "const v=require(process.env.APPDATA+'/npm/node_modules/gltf-validator');v.validateBytes(new Uint8Array(require('fs').readFileSync(process.argv[1]))).then(r=>console.log(JSON.stringify(r.issues,null,1)))" model.glb`
- gltfpack のヘルプには `-tc`（KTX2／BasisU）と `-tw`（WebP）がある。npm（WASM）版で `-tc` が実際に動くかは未確認。動かなければ `toktx` か `ktx create` で KTX2 を作る。

## ブラウザ（このPCの Chrome）
- Chrome 154.0.8037.57。
- WebGPU：使える。アダプター vendor nvidia／architecture turing（フォールバックではない）。preferredCanvasFormat bgra8unorm、maxTextureDimension2D 16384、maxBufferSize 2 GiB。features：texture-compression-bc（bc-sliced-3d も）、shader-f16、timestamp-query、subgroups、float32-filterable、float32-blendable、dual-source-blending、clip-distances、indirect-first-instance、depth-clip-control、depth32float-stencil8、rg11b10ufloat-renderable、bgra8unorm-storage、primitive-index、texture-formats-tier1／tier2、texture-component-swizzle、core-features-and-limits。
- WebGL2：ANGLE（NVIDIA GeForce GTX 1660 SUPER、Direct3D11）、MAX_TEXTURE_SIZE 16384。圧縮テクスチャは s3tc・bptc が有り、etc・astc は無し（KTX2／Basis はこの PC では BC7／BC1〜3 に変換される）。
