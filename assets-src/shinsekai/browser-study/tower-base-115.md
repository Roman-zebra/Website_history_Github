# Tower base and wings: handoff 115 local assembly

Source: Claude branch `claude/tower-base-upgrade`, frozen revision `aa030cd`.
Open `/assets-src/shinsekai/browser-study/tower-base-115.html` with the local
study server; add `?webgl` or `?size=1080` as needed. The shared runtime retains
the 113 route and defaults. These routes and private generated GLBs are excluded
from the published Workers build. Dates, rights and inferred geometry retain
the author's INTERFACE/README distinctions; no reference-image pixels imported.

The 115 route loads base/wings LOD0 and at most one interior cell. Far view
releases that cell and both high-detail exteriors, then loads only both LOD2s.
Each wing has its actual 1.2s open/close clips; the lift uses its separate clips.
Selection is serialized with shader compilation, stale loads are released,
hidden pages pause playback and final page retirement releases all models.
W1's dark card disappears only when the cinema cell is loaded. Remaining
cinemas have placeholders and no room floors. Base backing meshes are grouped
by material and the preview still hides those groups while any cell is loaded;
production needs scoped masking. No walking/physics is certified here.

Private runtime manifest: parent `research-cache/tower-base-115-runtime/manifest.json`.
Fourteen extracted parts preserve all source vertex attributes, indices and
loaded-only animation sampler values. All fourteen, the 95,744,776-byte plain
rebuild and three author GLBs have zero validator errors/warnings. The plain
rebuild is used for interiors; standard validation of Draco does not certify
decoded quantization accuracy. Cinema parts are 26,650,952 / 27,250,888 bytes,
both over the 26,214,400-byte delivery cap; compression remains required.

Independent exported-geometry receipts are in parent `research-cache/`:

- `tower-base-115-split-equivalence.json` and `tower-115-split-validator-summary.json`.
- `tower-base-115-independent-rays.json`: 74 treads / 75 planned risers;
  222 tread probes per variant, min sampled headroom 2.347623m, max finish
  delta 9.000397mm. Landing/transfer/arrival samples all supported.
- `tower-base-115-independent-clips.json`: 91 poses per lift clip/variant,
  including interpolated frames; worst linkage error 0.005254mm, endpoints zero.
- `tower-base-115-independent-overlap.json`: 88 discrete lift poses, zero
  moving/static triangle overlaps. No continuous swept or enclosed-volume check.
- `tower-115-independent-assembly.json`: 9,243 street/exit/aisle/joint floor
  probes, missing zero, worst adjacent step 12.2905mm; 3,702 wing-threshold floor
  probes excluding closed leaves, missing zero, 0.15–0.165m heights; 6,726 exit
  aperture rays excluding the intentional leaves, blocked zero (casing kept).
  Four exported wing leaf pivots default closed/identity. 100 sampled actual
  open/close poses have zero wing/cinema triangle overlaps. Base hinge hardware,
  continuous sweep, coplanarity, roof/wire contacts are separate checks.

Found independently: the loaded ticket hall still blocks the west wing door.
`tower-115-hall-exit-rays.json` casts 13,635 rays from hall toward the base's
clear opening (exterior animated leaves excluded). 12,453 stop at hall geometry:
10,865 on `hall__walls`, 1,588 on `hall__benches`. The native WebGPU fully open
wing door shows the same obstruction. Captured PNG:
parent `research-cache/look-dev/tower-base-115/wingW-open-hall-blocked-webgpu.png`.
This is reported to Claude for source correction; Codex does not duplicate it.

The preview has simplified light and no shaft, AO, shadows, SSR or final
postprocessing. Qualified 1080p performance and visual acceptance remain open.
Use a true 1920×1080 browser viewport and check canvas client/buffer dimensions,
visibility, ready state, view revision and new errors when measuring. Source
triangle counts and actual drawn triangles differ; instancing reduces attribute
storage/draws, not the source triangle budget. Native checks continue.
