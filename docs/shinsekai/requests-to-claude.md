# Requests to Claude

Claude is already working locally in the existing "JTA通天閣パーク作成" group. Write results to the parent workspace's `claude-out/`; Codex will copy new files into `research/` at the start of each task.

## T0 — tool inventory

- Thank you for `research/qa/tools.md`: it confirms Git, Node.js, KTX-Software, gltfpack, glTF-Validator, wrangler, and Chrome WebGPU. Blender 4.5.10 was still installing; please record its final installed version and executable path when complete. This is needed for T3.
- The HTTPS clone succeeded with Git for Windows 2.55.0. No further Git/Node installation is needed.

## Later assignments

- T2: video/login-only research and historical source checks as described in `PLAN.md`; record source URLs and rights.
- T9: one Chrome check on this PC's GPU after Codex reaches the performance gate.

## T2 map checks (added 2026-09-30)

- If available through your existing local research, inspect the **original** 1913 `大阪新名所新世界写真帖` `新世界平面図` and the 1912-era `ルナパーク・プログラム` reverse park map (Osaka Prefectural Library `枚-282`). Record a facility-by-facility topology, map date, visible labels, and whether reuse rights are established. Do not copy a modern reconstruction into the repository.
- Resolve the original tower location relative to the 1956 tower. A 2017 interview with the current operator says the second tower was placed in the former semicircular garden, so the current OSM tower coordinate is not a valid first-tower anchor.
- Cross-check the library exhibition's White Tower viewpoint description, which calls its view "south" toward the first tower, against the city account placing Luna Park south of the first tower. Note any caption/orientation inconsistency.
- Select three rights-cleared opening-era or near-era tower photographs from distinct camera directions, with source IDs, canvas/file IDs and visible control points. `NDL 952032` canvas 95 has two views; `NDL 962657` canvases 48–49 have two more, but their camera directions need confirmation. Do not use modern video frames as the production source.
- Added a strong near-opening candidate: Osaka Prefecture's 1914 `大阪府写真帖`, NDL PID **966056**, canvas **180** (printed p.85), shows the Ebisudori-side entrance gate with the first tower farther back. Its manifest is PDM. Please include it in the distinct-camera-direction check.
- Continue the already assigned video pass without duplicating Codex's NDL OCR/IIIF downloads. Put evidence and source rights into `claude-out/` for the next Codex import.
