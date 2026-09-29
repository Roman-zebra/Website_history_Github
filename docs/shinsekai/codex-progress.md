# Shinsekai progress

## Instruction log

- 2026-09-30 01:00 JST — Claude handoff records the user's later decisions: free area is the tower exterior and surrounding streets/plaza only; Stripe is the selected payment provider. These affect T4 and T8.
- 2026-09-30 01:09 JST — User confirmed Claude is already working locally in the existing "JTA通天閣パーク作成" group. Do not start another Claude session or duplicate its research.

## T0 — preparation (2026-09-30)

- Work clone: `repo/` on `main`, started from `f842b8c`.
- Created repository instructions and `docs/shinsekai/` task, state, progress, and request records. Copied the parent `PLAN.md` unchanged and preserved Claude's handoff in `research/to-codex.md`.
- Tool inventory: Node.js 24.19.0; Git for Windows 2.55.0 installed to recover HTTPS cloning after the bundled Git 2.53 lacked `git-remote-https`. Claude's later C0 report (`research/qa/tools.md`) confirms KTX-Software 4.4.2, gltfpack 1.3, glTF-Validator 2.0.0-dev.3.10, wrangler 4.143.1, and Chrome WebGPU on the NVIDIA adapter. Blender 4.5.10 was still installing at that report's time.
- Verification: the first scoped Gunkanjima test passed 6/7 after Windows checkout converted generated HTML to CRLF; its one failure expected LF. The full build regenerated those pages and passed **174/174 tests**, producing `dist/` with asset version 1.02 and data version 0.53. Build-generated changes to 560+ unrelated pages were restored before committing; no existing feature was intentionally changed.
- Remaining: T1 Coming soon card, then T2 research.
- Claude request: see `requests-to-claude.md` for the outstanding tool inventory and later GPU/research work.
