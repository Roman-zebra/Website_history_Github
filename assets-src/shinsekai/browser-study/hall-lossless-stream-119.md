# Hall full-resolution transport and partition audit119

2026-10-01, frozen115 aa030cd. User priority: retain attractive existing graphics;
reduce simultaneous visible scope and streamed work before reducing near maps or
silhouettes. Private authoring candidates only. No runtime/default/phone-quality
promotion, native picture comparison or actual iPhone14 performance acceptance.

## Full-resolution image encoding probe

`scripts/shinsekai-lossless-webp.py` uses the already installed Pillow12.3.0 to
try lossless WebP without resizing. Only smaller encodings are retained; decoded
RGBA must match exactly in Pillow. All non-image views remain byte-identical and
normalized scene JSON differs only in image encoding/required texture extension.
ICC/EXIF, high-bit-depth and animated sources remain encoded byte-for-byte rather
than silently losing colour interpretation, precision or motion. No ICCP/EXIF
metadata is written to WebP. Source JPEG decoding can differ between libraries;
Pillow equivalence does not replace a native source/candidate comparison.

Private `hall-lossless-webp-001` stopped at the colour-metadata guard, with no
completed GLBs. `002` corrects handling by retaining that original image. Three
images per variant receive smaller WebP; all dimensions remain1024/2048/512/etc.
Hall22,028,312 ->21,654,116B; dream22,025,768 ->21,651,572B. This is only~1.7%
saving and does not solve delivery. The desk's2048px JPEG6,068,466B becomes a
5,776,636B lossless WebP; the wall's2,700,600B JPEG/ICC/EXIF remains unchanged.
Original high JPEG quality (desk quantization tables all1) explains the large
pixel payload; trailing/metadata bytes are not the dominant cause. Do not
blindly recompress lossy or remove its full-resolution detail.

Both completed probe GLBs validate0errors/0warnings. Four Pillow authoring tests
cover exact transparent RGB/alpha, geometry/transforms/material bindings,
colour-profile retention, high-bit-depth retention and shared-view rejection.
This experiment is not selected for runtime until its native comparison passes.

References checked2026-10-01: [Khronos EXT_texture_webp](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_texture_webp/README.md),
[Pillow12.3.0 WebP options](https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html#webp).
Pinned three-r186 GLTFLoader implements the extension. No new tool installation.

## Exact authored-group partitions

`scripts/shinsekai-glb-partition.cjs` partitions complete authored mesh nodes
into explicit owners while retaining ancestor transforms and original binary
geometry/images through the existing cell extractor. Every mesh belongs to
exactly one part; missing/duplicate ownership and source hash drift reject the
plan. One part owns all lights; non-owned instanced meshes lose their instance
binding while retaining ancestor transforms. It does not clip triangles or
silently remove distant objects. The full partition union remains the source.

Four groups per base/dream: core(walls/ceilings/doors/finishes), desk/register,
lamps, furnishings(benches/props/telephone/clock). Original source images are
retained for this separate round; the WebP probe is not mixed into it. Existing
Meshopt packing is a lossless transport stage with permitted cyclic triangle
index rotation. Private `hall-stream-transport-001` is an incomplete two-part
qualification trial (image-free lamp accessor handling); `002` is complete.

| Part | Base encoded bytes | Dream encoded bytes |
| --- | ---: | ---: |
| Core | 5,940,432 | 6,412,936 |
| Desk | 7,855,572 | 7,836,648 |
| Lamps | 1,134,400 | 908,264 |
| Furnishings | 1,669,292 | 1,531,752 |
| Full union | 16,599,696 | 16,689,600 |

All8 encoded and8 independently decoded candidates validate0errors/0warnings.
Direct source-to-decoded-part verification compares170 primitives,850 vertex
attribute byte/schema bindings,170 materials/image/sampler bindings and48
ancestor nodes. All match;44 cyclic triangle rotations preserve order/winding.
Ownership and original geometry triangle totals verify exact union. Sources and
original images remain unchanged. Private manifest, source-equivalence receipt,
input plans, decoded artifacts and validator details are retained in
`../research-cache/hall-stream-transport-002/`.

With both exteriorLOD2s, conservative rendered geometry144,895(base)/144,675
(dream), draw calls165/166 and estimated decoded textures112MiB including
duplicated source texture objects across partitions. These fit the provisional
triangle/draw/memory ceilings, but texture residency is an estimate and includes
no browser/system overhead. Full transfer remains~16.6MB before exterior and
exceeds8MiB initial/4MiB cell budgets. Subdivision alone does not establish low
total transfer or solve rendering/FPS. Do not count each request separately to
claim the original cell budget passes.

Three partition tests cover source geometry/materials/ancestor preservation,
single light ownership, incomplete/duplicate/hash rejection and unloaded
instancing bindings. Four existing inventory/profile tests also pass. Previous
full static build323/323 belongs to the preceding runtime checkpoint; it is
not reported as a new build for these authoring-only changes.

From the repo (fresh output paths; use the existing configured Pillow runtime):

```powershell
python scripts/shinsekai-lossless-webp.py --manifest ../research-cache/tower-base-115-runtime/manifest.json --out-dir ../research-cache/hall-lossless-webp-NNN --parts cell_hall.glb cell_hall_dream.glb
node scripts/shinsekai-glb-partition.cjs ../research-cache/tower-base-115-runtime/cell_hall.glb ../research-cache/hall-partition-plan-001.json ../research-cache/hall-partition-NNN
node --test tests/shinsekai-glb-partition.test.cjs tests/shinsekai-mobile-inventory.test.cjs
python tests/shinsekai-lossless-webp.test.py
```

Private pack/qualification scripts: `pack-hall-partitions.mjs`,
`verify-hall-source-partitions.cjs`, `validate-hall-webp.cjs`; exact inputs and
their hashes remain in receipts. No source binary or private account image is
committed or published.

Next: an optional full-part assembly with unchanged camera/light/AA1280x720;
compare close and west-entry context on both native backends, base/dream and
unload/failure cleanup. Then design distance/portal prefetch and visibility
partitioning while preserving all nearby objects and avoiding holes/pop-in.
Do not expose an incomplete room or lower texture quality merely to pass a
number. Revisit provisional transfer budgeting explicitly if source quality
requires it; real-device measurements and qualified graphics are still open.
Original hall entry wall/bench obstruction remains a separate retained repair
proposal; do not mix its geometry into this source-equivalence round.
Cloth7240/art26/hybrid23 unchanged, spend0, no automatic Claude/agent calls.

2026-10-02 continuation: optional original-image full assembly now has scoped
native comparison/unload/failure evidence in `hall-stream-native-120.md`.
The independent WebP probe remains unadopted/native-unverified.
