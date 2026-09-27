# Page 07 — progress (for resuming after an interruption)

Branch `claude/compassionate-allen-6kj1jh`. Preview after push:
https://claude-compassionate-allen-6kj1jh-japan-then-and-now.hiddenjapan.workers.dev/lab/07/

- [x] Audience proxies (JNTO / JTA) → `audience.json`; Cloudflare script `scripts/cf-audience.cjs` (needs `CF_API_TOKEN`)
- [x] Licences → `licenses.json`, `licenses.md`
- [x] Long list (36) → `candidates.json`; readiness → `readiness.json`; selection (20) → `districts.json` (`scripts/select.py`)
- [x] NDL Search harvest for all 20 → `ndl/<id>.json` (`scripts/ndl_harvest.py`)
- [x] NDL Digital Collections full-text survey for all 20 → `ndl-fulltext/<id>.json` (`scripts/ndl_fulltext.py`)
- [x] English memorial notes → `monuments-en.json` (subagent)
- [x] Final Basic PDFs for all 20 (`scripts/basic.py all`, fonts in $LAB07_FONTS) → `lab/07/pdf/basic-<id>.pdf`
- [ ] Dossier JSONs (7 research agents) → `dossier/<id>.json`; PDFs via `scripts/dossier.py all`
- [ ] Deep Research sample → `deep/sample-suo-oshima-kuka.json`; PDF via `scripts/deep.py`
- [ ] Page → `scripts/page.py` writes `lab/07/index.html`
- [x] First push of /lab/07/ with the 20 Basic PDFs (commit 285307a)
- [ ] Final: dossier + deep PDFs, page regenerated, `node scripts/build.cjs` passes (revert the generated place/3d/visit pages it rewrites), commit, push, preview verified

Fonts for the PDFs (Source Serif 4, Inter, Noto Sans JP; OFL) are downloaded from Google Fonts into the scratchpad, not
committed. Chromium needs the agent proxy CA in `~/.pki/nssdb` (certutil) to open NDL pages.
