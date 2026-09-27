# Page 07 — paid-product experiment: 20 districts researched in NDL Search

Unpublished lab page: `/lab/07/` (noindex, not in the sitemap, not linked from the site). It tests three
English products for foreign visitors:

| Product | Contents | Price idea |
|---|---|---|
| Basic | Automatic English PDF: then/now GSI aerial photographs, landforms (former river channels, filled/reclaimed ground), Meiji-era lowland, nearby natural-disaster memorials | — |
| Area Dossier | Basic + a 4–8 page English history of the district, researched once and reused | US$29–39 |
| Deep Research | One hamlet or street address researched in libraries and archives, limited numbers | US$190–390 |

## Files

- `candidates.json` — the long list (36 districts) with study-area centres and NDL query terms.
- `readiness.json` — per candidate: GSI photo-series coverage, landform shares, memorials within 3/10 km, NDL hit counts (`scripts/readiness.py`).
- `districts.json` — the 20 selected districts, with the reasons and target markets (`scripts/select.py`).
- `ndl/<id>.json` — NDL Search harvest per district (`scripts/ndl_harvest.py`): bibliographic records with the access class
  of the digital copy, NDL Lab table-of-contents hits with frame numbers, Collaborative Reference Database questions,
  and Japan Search items whose rights code allows commercial reuse. Bibliographic data and links only — no page images,
  no full text.
- `dossier/<id>.json` — the English history report of a district (schema below), cited source by source.
- `monuments-en.json` — English names and short summaries of the natural-disaster memorials used in the briefs.
- `scripts/basic.py` → `lab/07/pdf/basic-<id>.pdf`; `scripts/dossier.py` → `lab/07/pdf/dossier-<id>.pdf`.
- `scripts/cf-audience.cjs` — pulls visitors by country and place page from Cloudflare (needs a read-only token; this
  session had none, so the selection uses public proxies instead).

## Rules carried over from `research/ndl` (content-ndl-20260925 branch)

1. A digitised book counts as a source only if its text was actually opened (NDL Lab OCR or the NDL viewer) and it is
   open without login ("インターネット公開"). Items for registered users ("図書館・個人送信") or NDL premises only are
   listed as further reading or Deep Research leads, never as the source of a sentence.
2. Summarise in our own words; quote at most a short phrase, translated and attributed. Never re-upload page images or
   PDFs from NDL or any archive. Record pid and frame numbers instead.
3. Separate the publication year of a source from the period it describes. Current facilities and access come from
   official sources with a check date.
4. Contested subjects (war, colonial rule, forced labour, bases) are stated within the scope the sources support.

## Dossier schema (`dossier/<id>.json`)

```json
{"id":"…","title":"…","standfirst":"40–60 words",
 "sections":[{"heading":"…","paragraphs":[{"text":"… (<i> allowed)","cite":["S1","S3"]}]}],
 "timeline":[{"when":"1657","what":"…","cite":["S2"]}],
 "walk":[{"name":"…","ja":"…","what":"…","cite":["S4"]}],
 "sources":[{"id":"S1","kind":"ndl","title":"…","titleEn":"…","author":"…","year":1930,"pid":"1234567","frames":[12,13],
             "url":"https://dl.ndl.go.jp/pid/1234567/1/12","access":"internet","used":"…"},
            {"id":"S2","kind":"official","title":"…","publisher":"…","url":"…","checked":"2026-09-27","used":"…"}],
 "furtherReading":[{"title":"…","url":"…","access":"transmission","why":"…"}],
 "deepResearchLeads":[{"what":"…","where":"…","how":"…"}],
 "caveats":["…"]}
```
