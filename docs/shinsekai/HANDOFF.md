# Compact conversation handoff

Use this with `AGENTS.md`, `codex-state.json`, `TASKS.md` and `PLAN.md`; state is the current restart point. Last updated 2026-09-30. Do not reread the entire earlier conversation by default.

## Workspace and authority

- Codex repository: `C:\Users\NULL\Documents\Codex\JTA-shinsekai\repo`; remote `Roman-zebra/Website_history_Github`, branch `main`.
- User authorizes routine free local/GitHub/existing Cloudflare work and publication without repeated confirmation. No new paid API/tool/service or live payment. Keep small English commits, build checks, pull with rebase before push and verify Workers/live release.
- Public path: GitHub → existing Cloudflare Workers Builds → `https://japantimeatlas.com`. Never rely on local folders for published assets. Preserve map/search/Gunkanjima.
- Claude works in a separate checkout/group. Parent `PLAN.md` and `claude-out/` are read-only. Requests go in `docs/shinsekai/requests-to-claude.md`; review Claude branches before main integration. Only Codex writes this repo.
- User uses GPT Sol 6.1 High; request Max/Astra only for a concrete unresolved judgment after diagnostics. No need to change models for ordinary code/input validation. Japanese user updates; English working records per PLAN v3.6.

## Current work

- T0/T1 done; T2–T10 incomplete. Site has the disabled Coming soon card, not a public Shinsekai scene.
- T2: 30 CC0 OML cards + 1912 survey sheets are archived. Research control fits still fail independent W0 by ~82–102 px; no global 1912 transform/tower position accepted. Modern widened railway centres are not invariant points. Details in `research/map-control-candidates.json` and `map-layer-registration.md`; caches are outside Git.
- T3: v2 study GLB exists, default height 75.76 m remains an adjustable scenario. Roof statement ~15.15 m provides an approximate scale scenario. Published heights conflict and lack a common measured datum. Do not adopt 62–68 m photo scenarios as measurements.
- New v2 photos: 41 typed observations in `research/photo-landmarks-v2.csv`, exact Claude raw snapshot retained, one declared quoting repair, manifest in `photo-inputs-v2.json`. See `camera-projection-study.md` and `scripts/shinsekai-camera.cjs`. Eleven tests cover projection, line/edge semantics, crop transforms, scale ambiguity and input integrity.
- **Next independent coding work:** explicit shared variable geometry scenarios, bounded deterministic multi-start nuisance optimisation, height profiles and scaled-Jacobian rank diagnostics. Source-feature continuity is being checked by Claude. Keep alternatives explicit; do not block the generic optimiser on that reply. Calibrate the reserved south camera on a declared subset and predict other points; fitting all south points is not a prediction gate.
- New facility/ropeway/toolkit leads: `facility-handoff-review.md`. OCR fragments remain distinct from direct page reading. Equal-height ropeway terminals and precise sag are assumptions; pond names/outlines and circle identity are unresolved. No assets installed/downloaded in this review.
- T4: local-only demand-rendered WebGPU/WebGL2 study under `assets-src/shinsekai/browser-study/`, pinned three r186; preview server command `node scripts/serve-shinsekai-study.cjs`, loopback port **18765**. Claude verified both backends and visible frame-cadence measurement; actual browser hiding-event integration is open. ~100 Hz static sample is not GPU timing or T9 production performance.

## Efficient checks and publication

1. Read compact state and check parent `claude-out/claude-status.json` / `to-codex.md`; fetch GitHub claude branches. Latest processed handoff is in state.
2. `node scripts/audit-shinsekai-photos.cjs`; relevant numeric tests; `node scripts/build.cjs` to a log under parent `research-cache/`.
3. Build regenerates tracked unrelated pages. If these paths were clean before the build, restore only `3d`, `place`, `visit`, `visit.html`, `sitemap.xml` after verification. Research, raw protected scans and caches stay outside dist; preserve snapshot bytes/hashes.
4. Commit scoped work; `git pull --rebase origin main`, then push. Check public GitHub check-runs and live `/release.json` against the pushed head. Node is in PATH; npm/gh may not be. Public GitHub REST works.
5. Update state with the concrete next step. No repeated diary-only deploys for unchanged status. The latest published commit before this handoff batch was 920757e, verified Workers/live; resolve current main and release directly rather than assuming that remains latest.

## Recurring work / later conversation transfer

Heartbeat `jta` is active every 10 minutes in the current conversation. Notify only meaningful progress/failure/action needed; stop when T0–T10 actually finish. Do not duplicate it in a new conversation. When a transfer is actually made, arrange its destination/status so the old and new chats do not both write main. The user permits later conversation handoff to save context, but this file alone does not create or migrate a conversation.
