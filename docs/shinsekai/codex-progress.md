# Shinsekai progress

## Instruction log

- 2026-09-30 01:00 JST — Claude handoff records the user's later decisions: free area is the tower exterior and surrounding streets/plaza only; Stripe is the selected payment provider. These affect T4 and T8.
- 2026-09-30 01:09 JST — User confirmed Claude is already working locally in the existing "JTA通天閣パーク作成" group. Do not start another Claude session or duplicate its research.
- 2026-09-30 01:20 JST — User clarified that the finished site must run through the GitHub-based publishing path, rather than depend on files in the PC's local workspace. Keep the existing GitHub → Cloudflare Workers build/deploy route.

## T0 — preparation (2026-09-30)

- Work clone: `repo/` on `main`, started from `f842b8c`.
- Created repository instructions and `docs/shinsekai/` task, state, progress, and request records. Copied the parent `PLAN.md` unchanged and preserved Claude's handoff in `research/to-codex.md`.
- Tool inventory: Node.js 24.19.0; Git for Windows 2.55.0 installed to recover HTTPS cloning after the bundled Git 2.53 lacked `git-remote-https`. Claude's later C0 report (`research/qa/tools.md`) confirms KTX-Software 4.4.2, gltfpack 1.3, glTF-Validator 2.0.0-dev.3.10, wrangler 4.143.1, and Chrome WebGPU on the NVIDIA adapter. Blender 4.5.10 was still installing at that report's time.
- Verification: the first scoped Gunkanjima test passed 6/7 after Windows checkout converted generated HTML to CRLF; its one failure expected LF. The full build regenerated those pages and passed **174/174 tests**, producing `dist/` with asset version 1.02 and data version 0.53. Build-generated changes to 560+ unrelated pages were restored before committing; no existing feature was intentionally changed.
- Remaining: T1 Coming soon card, then T2 research.
- Claude request: see `requests-to-claude.md` for the outstanding tool inventory and later GPU/research work.

## T1 — Coming soon card (2026-09-30)

- Updated the plan copy to v3.2 and copied Claude's latest `to-codex.md` and tool inventory. Claude confirms Blender 4.5.10 LTS and Chrome WebGPU on the NVIDIA adapter; no separate Claude session was started.
- Added Shinsekai as the second card in tab 06 with the six requested public titles and localized Coming soon labels. The upcoming card is a disabled `div` with no link; Gunkanjima remains the first linked card. The Thai guide has its own two-card preview because the interactive map still uses an English fallback for Thai.
- Changed `explore.js`, `explore.css`, `page.css`, seven locale/home HTML files, `th.html`, and `sw.js`; bumped asset cache version to 1.03. No Shinsekai page, footer link, or sitemap entry was added.
- Verification: `node --test tests/lab-3d-shinsekai.test.cjs` passed 2/2. `node scripts/build.cjs` passed 176/176 and generated `dist/` (asset version 1.03, data version 0.53). Chrome local preview showed the two cards side by side; the upcoming card was visually subdued and appeared as a non-link accessibility group. One card screenshot was captured for review. T1 has no 3D payload or frame-rate target.
- Remaining: T2 source research, rights ledger, layout, gimmicks, and colours. Claude's C1 video research remains in progress; collect it from `claude-out/` when ready.
- Claude request: no new request for T1. Continue the C1/C2 research already recorded in `research/to-codex.md`.
