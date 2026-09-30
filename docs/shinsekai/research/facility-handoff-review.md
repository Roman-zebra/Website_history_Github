# Facility and visual toolkit review (handoffs 60–62)

Reviewed 2026-09-30. Archived Claude inputs are `lunapark-facilities-claude.md`, `visual-toolkit-claude.md` and `../design/gimmicks-spec-claude.md`. They are source leads and implementation proposals, not approved geometry or licensing for downloaded assets.

## Contemporary text leads

Claude read fragments of the NDL full-text SNIPPET API for the 1912 *最近の大阪市* (PID 946141), frames 266–274. Codex previously read the height statement on frame 267 directly, but has **not independently read all these new facility passages on the original pages**. Keep their observation method distinct from direct transcription.

| Candidate | Source / method | Consequence for the study |
| --- | --- | --- |
| Central pond and large fountain in the semicircular 円街 | 1912 frame 269, Claude OCR fragments | A plausible alternative identity for a round mark; neither a tower control nor an accepted aerial identification. Map outline, location and era still need comparison. |
| Cinema wings on both sides of the tower | 1912 frame 270, Claude OCR fragments | A source-backed candidate for the free-zone surroundings; building extents and entrances still need a plan/photo check. |
| White Tower reported 150 shaku on a mound | 1912 frame 273, Claude OCR fragments | Reported approximate height (~45.5 m), with unknown reference level and mound elevation. Do not set a surveyed ground-to-tip height. |
| Ropeway to White Tower upper stage | 1912 frame 268, Claude OCR fragments; CC0 postcards c1188001/d0286001 | Supports testing an upper landing; it does not establish two endpoints at equal elevation. Exact support/haul ropes and terminal elevation remain open. |
| Water over a lower pavilion roof into a lit pond | 1912 frame 273, Claude OCR fragments | Strengthens an opening-period effect candidate. Pavilion outline and pool geometry remain unresolved. |
| Circling Wave dimensions and illumination count | 1912 frame 274, Claude OCR fragments | Record as reported 22-shaku height / 36-shaku diameter and 50,000 lamps; mechanism/measurement datum and the geographic meaning of the count need full-page context. |
| Permanent sumo hall planned in 1912 | 1912 frame 266, Claude OCR fragments | Its unbuilt plot label cannot establish a narrow guide-map date. Preserve the museum's Taisho-period attribution. |

The 1914 view-A page reportedly calls the waterfall receiving basin **夫婦池**, while the 1912 fragments name **真澄池**. Shared waterfall context is useful, but does not distinguish a rename, connected basins or author variation. Keep both names recorded without creating two physical pools or merging their geometry until the outline is identified.

## Corrections to carry into design

- The older ropeway proposal assumes both terminals at ~15 m and a 1–2 m sag. The new upper-White-Tower wording leaves terminal datum uncertain. **Equal-height endpoints and numerical sag remain scenarios**, not source constraints. No ropeway mesh is placed from these values.
- A report of two iron cables does not establish every support/traction cable or its mechanism. Claude's proposed 2 + 1–2 rope model needs further evidence.
- Hand-tinted/retouched postcards suggest colours, not measured paint. Red cabins, warm bulb temperature, wet ground and haze remain art-direction choices with their own provenance.
- New snippet wording does not clear scans, original music, films, figures or branded decorations for product use.

## Toolkit scope

The free texture/procedural/compression toolkit is useful for later detailing, but no new tool or asset was downloaded/installed in this pass. Individual official licences and file provenance must be checked when an asset is actually selected. Do not rely on a broad claim about a marketplace's current licence.

Emissive instancing, baked light and optional bloom are candidates for a dense night scene. The study's 100 Hz frame-cadence sample does **not** validate a 50,000-bulb scene, bloom cost, target 1080p performance or mobile capability. Actual full-scene measurements remain T9 work.

## Resumed review of handoffs 66–69 (2026-09-30)

Archived the latest facility transcription, layout proposal and ride sheet with exact hashes in handoffs-66-69-inputs.json. Claude now reports original-viewer readings for S065 frames267/268/269/273/274. Codex has not independently read every passage; the earlier OCR-only qualification now applies to the remaining snippet frames, not to Claude's reported method for these five.

The topology now records the pond/fountain at the semicircle centre, a separate southeast 清華殿 hall, southwest shop/automata group, cinema wings and unplaced relative features. Every new feature has null geometry; existing coordinates remain unchanged. The northern garden's spelling is unresolved, and its pond is a separate candidate feature rather than an automatically identified garden outline. Text compass labels conflict with destinations, so destination relationships govern provisional descriptions.

Ropeway endpoints have explicit contemporary-top versus later-equal-level scenarios. The White Tower's 150-shaku datum, mound elevation, cable span and sag remain open. The 50,000-lamp sentence may refer to the whole district; it does not allocate that count to the tower or Luna Park. The ride sheet's trip time, vehicle speed, wobble, chute shape and paint defaults remain assumptions. Existing tram-source-check.md distinguishes 1910–11 fleet data from a July1912 operating inventory; double overhead wiring alone does not independently prove the precise roof collectors on every depicted vehicle.

Handoff69 found no readily accessible contemporary alteration statement; this is a search boundary, not proof no rebuild occurred. H2-0060-124's eight July1912 archive photographs are an unverified catalogue lead requiring a separate access decision; no reservation or user travel is initiated. The uncited 64m bulletin value is not a control. Photo forms remain grouped without a dated rebuild boundary in photo-top-form-evidence.json.
