# Compact conversation handoff

Use this with `AGENTS.md`, `codex-state.json`, `TASKS.md` and `PLAN.md`; state is the current restart point. Last updated 2026-09-30. Do not reread the entire earlier conversation by default.

**RESUMED by the user in the new conversation on 2026-09-30.** Existing heartbeat jta is ACTIVE and targets 01a0f17d-ce83-7780-869a-56bc0755bbf7; the old conversation has no heartbeat. Do not create another writer.

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
- Immediate handoff 64 adds `photo-landmarks-v3-claude.csv` and `photo-continuity-review.md`: all v2 values unchanged. Roof-centre x is inferred and upper forms differ between photographs; exclude/reclassify those inferred components in model bindings and use separate upper-geometry scenarios. A rebuild date is not established from publication years. v3 annotations are archived but not automatically applied by the executable v2 audit.
- The numerical profile/optimiser and explicit geometry/role configuration are now implemented; see `research/camera-profile-study.md` and its compact JSON. Full build:205 tests. Height-augmented rank28/29 plus an exact roof-fixed similarity test show a remaining scale ambiguity. Every north fit hits chosen bounds; withheld south upper predictions miss ~19–24px. No height/production geometry adopted. Some profile fits did not converge.
- **Current:** handoffs66–69 are reviewed; topology records relative null-geometry candidates, two ropeway landing scenarios and lamp scope. Local sparse-anchor photo review is available at research-cache/camera-review-v1.html; regenerate/serve with scripts/render-shinsekai-camera-review.cjs using camera-profile-v1-reviewed.json on port18766. Review physical ground/datum and floor/upper identity alternatives with Claude. Model switches alone cannot remove the demonstrated ambiguity. Further camera Monte Carlo is unnecessary.
- New facility/ropeway/toolkit leads: `facility-handoff-review.md`. OCR fragments remain distinct from direct page reading. Equal-height ropeway terminals and precise sag are assumptions; pond names/outlines and circle identity are unresolved. No assets installed/downloaded in this review.
- T4: local-only demand-rendered WebGPU/WebGL2 study under `assets-src/shinsekai/browser-study/`, pinned three r186; preview server command `node scripts/serve-shinsekai-study.cjs`, loopback port **18765**. Claude verified both backends and visible frame-cadence measurement; actual browser hiding-event integration is open. ~100 Hz static sample is not GPU timing or T9 production performance.
- The tower viewer on18765 remains stopped. The separate photo-review server on18766 is running for Claude review; its single HTML artifact remains outside Git.

## Efficient checks and publication

1. Read compact state and check parent `claude-out/claude-status.json` / `to-codex.md`; fetch GitHub claude branches. Latest processed handoff is in state.
2. `node scripts/audit-shinsekai-photos.cjs`; relevant numeric tests; `node scripts/build.cjs` to a log under parent `research-cache/`.
3. Build regenerates tracked unrelated pages. If these paths were clean before the build, restore only `3d`, `place`, `visit`, `visit.html`, `sitemap.xml` after verification. Research, raw protected scans and caches stay outside dist; preserve snapshot bytes/hashes.
4. Commit scoped work; `git pull --rebase origin main`, then push. Check public GitHub check-runs and live `/release.json` against the pushed head. Node is in PATH; npm/gh may not be. Public GitHub REST works.
5. Update state with the concrete next step. No repeated diary-only deploys for unchanged status. The projection/handoff batch 794e17b was verified Workers/live before the immediate continuity follow-up; resolve current main and release directly rather than assuming that remains latest.

## Recurring work / later conversation transfer

Heartbeat `jta` retains its 10-minute schedule and is **ACTIVE in the resumed conversation** 01a0f17d-ce83-7780-869a-56bc0755bbf7. The tool update and saved target/status were verified. Notify only for meaningful progress/failure/action needed; stop when T0–T10 actually finish. Do not duplicate it or resume work in the old conversation.

## Immediate follow-up through73

See research/datum-and-drafts-review.md and current state. Facade ground hidden; pedestrian stature/horizon is an assumed prior, not a surveyed metric. Next T3 scenario: separate coping top/bottom with shared thickness; preserve rawv2 and explicitly version refined gallery/crown readings. PID12874185/frame87 reproduces the1913 plan under personal-transmission access; facts-only lead, no coordinates or scan reuse adopted. Audio/postcard drafts are archived, with unsupported measured-height/caption claims flagged.

## Two-line checkpoint through77

T3v2 is implemented; see camera-profile-v2-study.md and summary. Eight rolled floor samples, shared unknown coping thickness and explicit refined y readings preserve rawv2. Five height scenarios including weak1980-caption54.5m, plus one-factor sensitivities, still fail (rank29/30, south26.5-31.3px). Exact scale gauge test passes; no production geometry/default accepted.18766 now serves local camera-review-v2.html. T2 plan topological sequence/design-date claims are recorded with no changed coordinates. Next independent task: parameterised T5 local motion, while physical camera-sector/base-shape evidence is checked.


## Shape review through78 / validation

Full build212/212 passed. See research/tower-shaft-review.md and requests-to-claude.md: Claude prototype requested on claude/tower-shaft-v3 in its separate checkout; Codex validates before main. Photograph width ratios are perspective/occlusion-dependent, form variants remain undated and defaults/site placement unchanged. Next Codex work: independent local T5 motion with explicit timing/span/terminal assumptions. Inspect Claude branches promptly when new commits arrive.

Immediate79: cc69851 GLBs independently validate, but merge deferred for concrete export/provenance/baseline fixes (see tower-shaft-review.md and requests). Existing solver already frees south east/roll; no new datum supplied. Next independent T5 motion remains.966522c Workers/live verified.
