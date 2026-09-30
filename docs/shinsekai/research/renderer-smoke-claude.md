# Renderer study smoke review (Claude, 2026-09-30 15:38) — partial

Target: Codex's local-only `assets-src/shinsekai/browser-study/` (three.js r186 WebGPURenderer with a WebGL 2 fallback), served by `scripts/serve-shinsekai-study.cjs`. Nothing in the repo was edited.

## Environment
- This PC: GTX 1660 SUPER (WebGPU adapter reports "nvidia turing"), Chrome 154, 958×862 viewport, DPR 1. The Claude desktop in-app browser was also tried.

## Findings
1. **Port collision with a stale service worker (blocking in Chrome).**
   - What happens: in this Chrome profile, `http://127.0.0.1:8765/` has a registered service worker (`/sw.js`, scope `/`), left over from an earlier local run of the main JTA site on the same port. It intercepts the study URL and serves the JTA home page, titled "Japan Time Atlas | Historic Maps…", with no canvas.
   - Workaround used: the same script on another port (`JTA_STUDY_PORT=8766`), which works.
   - Suggested fix (Codex): give the study server its own default port, e.g. 8766, different from any local site preview. Alternatively add a note to the README: "if you see the JTA home page, unregister the service worker for 127.0.0.1:8765 or use another port."
   - The in-app browser did not have this worker and showed the study on 8765.
2. **Both backends render the tower study.** WebGPU (status line "WebGPU · 75.8 m study height · 4 top-level parts") and `?webgl` ("WebGL 2 fallback …") both draw the v2 study correctly in Chrome. No console errors were captured for the `?webgl` load.
3. **First-load size is 4.45 MB over 9 requests**:
   - `three.webgpu.js` 2.18 MB and `three.core.js` 1.39 MB (served unminified from `vendor/`)
   - `tower-study.glb` 0.68 MB
   - GLTFLoader, OrbitControls and utilities about 0.2 MB
   
   JS heap is about 16 MB after load. Suggestions for the eventual public build (not needed for this study):
   - Minified or tree-shaken three.js through a bundler, plus Brotli from Cloudflare.
   - The meshopt-compressed GLB (`-cc`, 14% of size per `claude-out/qa/compress-test.md`) with MeshoptDecoder.
4. **Not yet measured: fps, frame-time percentiles, and Day/Dusk/Night switching.**
   - Claude-controlled Chrome tabs are background tabs, and the in-app browser pane was hidden, so `requestAnimationFrame` did not run (0 frames).
   - The next step needs the study tab shown in the foreground for about 15 s. Claude will ask the user.

## Revision check on port 18765 (Chrome 154, GTX 1660 SUPER, visible tab; 15:51)
| Check | WebGPU | WebGL 2 (`?webgl`) |
|---|---|---|
| Loads and renders the v2 study | yes | yes |
| First frame (panel: "last CPU submission") | 157 ms | 351 ms |
| Idle at rest (counter unchanged over 2.5–4 s) | yes (1 → 1; 781 → 781) | yes (1 → 1) |
| Measure 5 seconds, visible tab, 958×862 canvas | 100.0 frames/s, median 10.0 ms, p95 10.1 ms (twice) | 100.0 frames/s, median 10.0 ms, p95 10.1 ms |
| Day / Dusk / Night | all render; a switch draws about 2 frames, then idles | Day checked |
| Drag orbit, wheel zoom | works; the counter stops after damping settles | – |
| Resize to 700×700 window | canvas follows (684×515 css = backing, DPR 1) | – |
- **Measured values are the display refresh interval** (about 100 Hz on this monitor), not GPU time, as the panel says.
- **Bug: a measurement started while the tab is already hidden never ends.**
  - What happens: in a background tab the button shows "Measuring… Keep this tab visible." and stays disabled for more than 20 s, and the measurement is not cancelled.
  - Likely cause: cancellation listens for `visibilitychange`, which never fires if the tab was hidden from the start.
  - Suggested fix: refuse to start when `document.hidden`, and add a timeout (for example 10 s) that cancels and re-enables the button.
  - Not tested: hiding a visible tab in the middle of a measurement. Claude's tools cannot switch the active tab.
- **UX: at small windows the info panel covers about half the view** (684×515), hiding part of the tower. Suggest a collapsible panel, or reframing the camera to the model's bounds on resize.
- No rendering artefacts were seen: no missing faces and no z-fighting on the passage vault or turrets at the viewed angles. Dusk is purple-grey and Night dark blue, and the tower reads as a silhouette. Colours are not reviewed; this is a technology study.
