# 109 tower weathering study

`tower-weathering.html` (`?webgl` for fallback), served only by the loopback study server, shows three original24m samples: clean albedo, weathered albedo, and weathered albedo with explicitly synthetic AO bands. It uses no tower candidate GLB, photograph, video frame or external texture. It remains excluded from the Workers distribution.

`towerWeatherNodes` translates the `weather()` function at origin/claude/tower-base-upgrade36ec9ec, exterior/render_setup.py102–156. Metre heights are preserved with glTF Y-up: ragged splash0..0.85m, damp threshold.55m, runoff below the eleven ledges with1.6m fade, soot above9.9m with22m scale, mottle.92..1.08 and splash roughness+.1. Linear colour multipliers and mask strengths follow the source. Pattern shape uses MaterialX fractal noise instead of Blender Noise, so this is a method translation rather than pixel parity. Strength0 returns the supplied albedo/roughness unchanged; roughness stays.02..1 when weathered.

Local AO must be supplied by the caller. DefaultAO1 adds no crevice grime; the third sample's periodic bands are a test input, not a tower AO bake. Texture binding, scored joints, normal maps, material-specific settings and the accepted building integration remain separate work. Strength and dimensions/colours/weather are A:inferred; no measured1912 grime pattern is claimed.

WebGPU and WebGL2 both compile, draw and save actual1280×720 PNGs without new captured errors. Private images: parent research-cache/look-dev/tower-weathering-109/webgpu.png and webgl.png. Native hidden/pending-exit integration and qualified1920×1080 performance remain unverified. The36ec9ec building stays private because actual stair rays fail and the qualified performance gate is open. Scene resources in this material study are disposed after initialization completes when leaving the page.

Three.js r186 API signatures were checked against the existing primary package source: src/nodes/materialx/MaterialXNodes.js (`mx_fractal_noise_float`) and the vendored TSL exports. No new dependency was installed.
