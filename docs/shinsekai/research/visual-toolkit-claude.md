# Visual-quality toolkit for a Cyberpunk/GTA-like night look, all free (Claude, 2026-09-30 16:48) — P17 (32nd-instruction trigger)

## Goal and constraints
- **What "Cyberpunk/GTA-like" means here:**
  - dense night lighting with strong bloom;
  - wet-ground reflections;
  - haze and volumetric light;
  - physically based (PBR) materials with weathering;
  - lots of small props.
- **The 1912 constraints stay:**
  - warm carbon-filament bulbs (2000–2400 K), about **50,000 lamps** park-wide per the 1912 text, and no neon;
  - no people;
  - no real brands or ads;
  - browser only (three.js r186 WebGPU with WebGL 2 fallback);
  - target: 60 fps on the GTX 1660 SUPER.

## Recommended stack (licences checked 2026-09-30)
| Need | Tool / source | Licence | Status on this PC |
|---|---|---|---|
| Modelling, UVs, baking | Blender 4.5 LTS | GPL (outputs are ours) | Installed |
| PBR textures (brick, plaster, rusted iron, wet earth, cobbles, wood) | **ambientCG** (docs.ambientcg.com/license) | **CC0 1.0**, no credit required | Web download at M2–M4 |
| PBR textures, HDRI skies (dusk and night lighting reference), some models | **Poly Haven** (polyhaven.com/license) | **CC0**, no credit required | Web download at M2–M4 |
| Procedural materials (tileable weathering, painted ironwork, rain wetness masks) | **Material Maker** (github.com/RodZill4/material-maker) | **MIT** | Not installed; portable build from GitHub releases when needed |
| GPU textures | KTX-Software (toktx, UASTC/ETC1S) | Apache-2.0 | Installed |
| Mesh compression | gltfpack (meshopt) | MIT | Installed (see qa/compress-test.md: `-cc` → 14%) |
| Validation | glTF-Validator | Apache-2.0 | Installed |

## Renderer techniques (three.js r186, all in the free library)
- **50,000 bulbs:**
  - one `InstancedMesh`, or points, with an emissive material and bloom;
  - a few real lights, plus baked light maps for the pools of light on walls and ground.
  
  Do not use 50,000 real lights.
- **Bloom:** the WebGPU `BloomNode` post-processing chain, kept with the existing AgX tone mapping.
- **Wet ground:** a roughness and puddle mask from Material Maker, plus an environment map. Screen-space reflections (the `SSRNode` in the examples) only if the fps budget allows.
- **Haze:** exponential height fog; light shafts only at the key camera positions.
- **Detail at low cost:** instancing for repeated props (lamp posts, flags, railings), LODs, and KTX2 textures.
- **Performance gate:** measure with the study's Measure button and `qa/perf-probe.js` on this PC at each milestone.

## Avoid (paid, restrictive, or wrong era)
- Substance 3D and Quixel Megascans: paid, or licensed for Unreal only.
- BlenderKit paid tiers.
- Random Sketchfab models: mixed licences and modern or branded content.
- Anything needing an account purchase stops under the v3.3 rule.

## When to install
Material Maker and the texture downloads should come at the start of detailed asset modelling (M2–M4), or earlier if Codex's script-built Blender models need texture work. Claude will tell the user at that point, as the 32nd instruction asks. Nothing is installed now.
