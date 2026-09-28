# Page 07 — progress (for resuming after an interruption)

Branch `claude/compassionate-allen-6kj1jh`. Branch previews are not deployed for this Worker (its
`wrangler.jsonc` declares a Durable Object, and Cloudflare does not create preview URLs for such versions), so the
unpublished page is shared as a private claude.ai Artifact: https://claude.ai/artifact/1sq84fDmvCUsA48WSrrRX6
(`scripts/artifact.py <out.html>` makes that version and lists the pdf/ and img/ files to publish with it).
On the site itself it appears at japantimeatlas.com/lab/07/ (noindex, unlinked) only once the branch is merged.

- [x] Audience proxies (JNTO / JTA) → `audience.json`; Cloudflare script `scripts/cf-audience.cjs` (needs `CF_API_TOKEN`)
- [x] Licences → `licenses.json`, `licenses.md`
- [x] Long list (36) → `candidates.json`; readiness → `readiness.json`; selection (20) → `districts.json` (`scripts/select.py`)
- [x] NDL Search harvest for all 20 → `ndl/<id>.json` (`scripts/ndl_harvest.py`)
- [x] NDL Digital Collections full-text survey for all 20 → `ndl-fulltext/<id>.json` (`scripts/ndl_fulltext.py`)
- [x] English memorial notes → `monuments-en.json` (subagent)
- [x] Final Basic PDFs for all 20 (`scripts/basic.py all`, fonts in $LAB07_FONTS) → `lab/07/pdf/basic-<id>.pdf`
- [x] Dossier JSONs for all 20 districts → `dossier/<id>.json`, each fact-checked against its cited sources (`scripts/fetch_sources.py`, `scripts/verify_sources.py`, reports in the session scratchpad) and dated with `"checked"`; PDFs via `scripts/dossier.py all`
- [x] Deep Research sample → `deep/sample-suo-oshima-kuka.json` (checked); PDF via `scripts/deep.py`
- [x] Page → `scripts/page.py` writes `lab/07/index.html`; Artifact version via `scripts/artifact.py` (published 2026-09-28)
- [x] First push of /lab/07/ with the 20 Basic PDFs (commit 285307a)
- [x] Final: dossier + deep PDFs rendered, page regenerated, private Artifact republished. Browser findings from `claude/lab07-chrome-checks` (`chrome/findings.json`) C04-C09, C13, C17, C20, C21 applied.

Fonts for the PDFs (Source Serif 4, Inter, Noto Sans JP; OFL) are downloaded from Google Fonts into the scratchpad, not
committed. Chromium needs the agent proxy CA in `~/.pki/nssdb` (certutil) to open NDL pages.
