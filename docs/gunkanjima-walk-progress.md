# Gunkanjima walking experience — checkpoint 2026-09-26

The walk page is `/3d/gunkanjima-walk?lang=ja`. This repository deploys through its existing Cloudflare build; it is not a Sites project.

Implemented in renderer v10: first-person default, keyboard/pointer and touch controls, impassable coast checks inside and outside, five era choices, four processed GSI aerial images, linked library catalogue/photo sources, softer anime-inspired colour and light, labelled inferred multi-floor studies for 68 feasible building footprints across eras. The original 12 source-based scenes remain available in 1962. Equipment, too-narrow structures and footprints outside the coast are excluded. Inferred interiors are generated lazily. Stair location, room layout, objects and colours are not historically verified.

## Improvement and verification cycle

1. Found stair/landing seam gaps; added small support overlap and checked ascent and descent for every generated building.
2. Found black floor/ceiling surfaces in native GLES rendering; bounded shader hash inputs and used high-precision material calculations where supported.
3. Corrected the initial stair-facing direction and chose a clear initial view in existing scenes.
4. Retained terrain when indoors and removed the transparent host-building shell from the game view.
5. Added room partitions/furniture and reduced noisy surfaces; inspected outdoor, apartment, stairs and rooftop renders.
6. Added coast checks indoors and excluded unsafe inferred cores; tested real movement from ground floor to rooftop and back, keyboard-relative strafe, pause, era changes, source-scene entry/exit and both 16-/32-bit index paths. Spatial bins reduce collision work.

Validation at this checkpoint: 141/141 full-build tests passed; all four native GLES scenes compiled, linked and rendered without GL errors.

Run `node scripts/build.cjs` for the complete build/test gate. The generator rewrites unrelated tracked HTML; do not publish those incidental diffs over concurrent map/search work.

Optional Linux native graphics check (Pillow, Mesa EGL):

```sh
node scripts/qa/gunkanjima-capture-gl.cjs /tmp/jta-gl-qa
python scripts/qa/gunkanjima-render-gl.py /tmp/jta-gl-qa
```

This compiles and replays actual renderer GLSL/draw calls at 1280×800 on GLES2. It does not test browser input, mobile performance or the shadow-map extension. The cloud browser available in this session does not expose WebGL, so browser verification covers the fallback and page UI; it cannot establish real-device graphics performance.

## Remaining evidence and quality work

The 2015 housing study (1952/1970) and 2005 measured-survey volume were located in the NDL catalogue; their full plans/photos were not acquired. The 1986 Saiga photobook is restricted individual transmission. Showakan and museum originals are linked, not represented as incorporated measured data. See `3d/gunkanjima-research.json` for URLs and access notes.

All-building photographic precision, historical colour accuracy and a production-quality Genshin-like environment are not complete. The current study models must not be described as precise reconstructions. Replace each inferred building only after obtaining usable dimensioned plans and photographs, recording the source and confidence of every replacement.

If execution is interrupted, inspect the current GitHub main branch and this checkpoint, preserve concurrent changes, rerun the scoped tests, then publish with a non-forced fast-forward update. Chat transport cannot be restarted from the website or a scheduled job.

## Resume checkpoint — 2026-09-26, second pass

An hourly continuation automation is enabled from 22:30 Asia/Tokyo. It resumes saved work, not the chat transport. It checks for an active run before changing code. Future executions should write `status: in_progress` and an updated UTC timestamp in `docs/gunkanjima-walk-state.json`, refresh it at checkpoints, and clear the active run when done. Treat an unchanged active record older than 90 minutes as a possible interruption; inspect commits before resuming. Never overwrite concurrent map/search work.

A further navigation audit found 159 wall corners outside their host footprint and 633 blocked doorway paths in the previous inferred layout (counts include every floor). Replaced the insufficient room-fit clearance with sampled 2.1 m clearance, maintained a wider stair aisle, and checked coast containment. The revised layout has 1,362 inferred doorways: every tested doorway path is passable and no tested room-wall corner lies outside its footprint/coast. These room counts describe procedural study geometry, not historical dwelling counts. The all-building stair tests still apply.

Second-pass validation: full build 142/142 tests passed; four native GLES views rendered without GL errors.
