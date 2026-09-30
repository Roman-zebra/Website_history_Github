# Shinsekai task list

Baseline: `PLAN.md` (v3.6) and the later user decisions recorded in `research/to-codex.md`. The free area is the tower exterior and surrounding street/plaza only; Stripe remains the primary payment provider, with a membership-page alternative deferred to M5. Claude is working locally in the existing "JTA通天閣パーク作成" group; Codex alone writes `main`, while Claude may propose reviewed branches from its separate checkout. Free local/GitHub/Cloudflare work and routine decisions are authorized without repeated requests.

The final site is published from GitHub through the repository's existing Cloudflare Workers build/deploy route. Local files are for authoring and verification only.

| Task | Scope | Status |
| --- | --- | --- |
| T0 | Prepare the fixed clone, instructions, project records, handoff, and tool inventory | Done |
| T1 | Add the second, disabled Coming soon card to tab 06 in six languages | Done |
| T2 | Source research, rights ledger, 1912 layout, gimmicks, and colour evidence | In progress: 30 individually CC0-checked OML pictures plus two CC0 1912 survey sheets and their CC0 index; S063 matches the 1912 opening-period parcel topology rather than the 1911 star proposal, but georeferencing remains and the dashed circle is unidentified; the four-point affine fails an independent west-side crossing; a separate Taisho-period museum guide-map postcard is under label/topology review with image rights restricted; exact facility positions still need a dated, inspectable site plan |
| T3 | Source-based Blender geometry and photographic alignment | Preparation: editable first-tower v2 study has narrower roof-level legs, a wider/lower arch, deeper passage and lower turrets; 50-shaku roof level is sourced and total height remains adjustable; a 1940 contractor retrospective says 200 shaku while the 1924 table says 250 shaku, and Claude's photo fits remain camera-dependent; the study GLB imports in Blender and is not deployed, while production geometry remains |
| T4 | Browser engine and free tower exterior area; separate paid data | Planned |
| T5 | Historical moving features and rideable vehicles | Planned |
| T6 | Lazily generated paid interiors | Planned |
| T7 | Games, postcards, mysteries, photo mode, eras, and audio | Planned |
| T8 | Stripe test Checkout, signed webhook, license restoration, and protected paid delivery with encrypted payloads in the public GitHub repository | Planned; see `paid-content-architecture.md` and benchmark Workers Free limits before committing paid assets |
| T9 | Performance gates and Claude's Chrome/GPU check | Planned |
| T10 | Wallpaper, PDF, and soundtrack delivery | Planned |

Keep the free/paid split from the later user decision for T4 onward. Public titles must not contain the protected tower name; no people or real historical advertisements are included.
