# Shop materials after Claude116/117

The study uses the accepted curved chrysanthemum geometry by default. Use
`?legacyflowers` for the earlier blossom comparison. The237 anchors, source
placement and palette remain unchanged. These flowers add no reference pixels.

`?cloth` retains the111 companion geometry, including its current flat garment
silhouettes. One material mixes the original wrinkle normal at scales1/.37,
37-degree rotation, .68/.32 weights, rotating slopes back into the UV tangent
frame. The original texture, UVs, colour, roughness and sheen remain unchanged.
The cloth test checks these properties and shared material ownership. Under118,
Codex now owns separate simulated_v2 garment and rolled-bolt derivatives;
the117 silhouette criticism is still open.

The existing geometry sun shadow now keeps glazing from casting an opaque
shadow. Paper shoji retains its opaque visible PBR appearance, while an inferred
single-layer shadow transmittance(.40,.37,.32) allows the timber grid to light
the floor. This is an approximate paper model, not measured1912 material data.
Interior hemisphere gain is .45; the exterior-only gain is .8.

`?ao` enables the candidate r186 GTAO indirect-light context: half resolution,
.35m radius/thickness, normal/depth prepass and one shared beauty pass. Only
the depth prepass uses samples0: multisampled depth cannot be gathered by this
implementation. AO affects indirect lighting, not direct sun or emissive lights.
It adds GPU work and remains optional pending performance/visual review.
The original official GTAONode.js is retained with MIT provenance and its hash.

Dream LUT black lift is .035, bloom threshold1.05, exposure-.3EV relative to
base. LUT hue/chroma, bloom strength/radius and grain remain as previously
directed. With AO, base and dream share the beauty pass; resources are disposed
once by their owner.

Full build283/283 passes. Native1280x720 WebGPU/WebGL load the revised normal,
paper shadows and AO; base/dream captures and far-cell retirement are recorded
privately in `research-cache/look-dev/shop-116-117/`. First CPU submission was
2681.3ms GPU /19182.7ms GL, with unmatched caches/warm states. These are not
frame-rate results. Cold readiness remains slow; added lighting/effects need
qualified1080p measurement after conservation mode. No visual acceptance or
final production performance claim is made. AO detail remains noisy in places,
and room lighting still needs further work.
