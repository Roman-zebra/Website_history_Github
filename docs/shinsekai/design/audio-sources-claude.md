# Free audio sources for the 1912 scene (P23, Claude, 2026-09-30 17:57)

A list only. Nothing has been downloaded. Re-check each file's licence page when a sound is chosen, and record it in ledger.csv. The paid-content rule applies: nothing that needs payment, a paid plan or a card.

## Sounds the scene needs (no voices, no crowd: the "no people" policy)
| sound | where | notes |
|---|---|---|
| tram bell and wheels on grooved rail; trolley-pole hum | Ebisuchō crossing | a four-wheel single-truck car, DC 600 V (see t5-rides-vehicles-spec.md) |
| ropeway carriage wheels on a carrier rope; a small start bell | roof garden / White Tower | slow, light clatter |
| waterfall and fountains | White Tower 綾糸の瀧, 眞澄池, 圓街 fountain | three distinct water beds |
| band music from the octagonal music hall | Luna Park | brass band, 1910s style; must be a PD recording or newly made |
| Circling Wave machinery; merry-go-round organ | Luna Park | fairground organ (band organ) |
| wind at the tower top; flag ropes flapping | observation deck | loop |
| distant city: carts, geta on stone (no voices), temple bell from Shitennōji | everywhere | low-level bed |
| lamp hum at night (arc and incandescent) | illumination | subtle |

## Sources and licences
| source | licence (as stated by the source) | fit | caveat |
|---|---|---|---|
| **Sonniss #GameAudioGDC bundles** (sonniss.com/gameaudiogdc) | royalty-free, commercial use, **no attribution**, unlimited projects; no resale of the raw sounds; **no AI/ML training** | trams, rails, water, wind, machinery | large downloads (tens of GB per year). Pick specific files. Downloading needs no account on the official page (check at the time) |
| **Wikimedia Commons audio** (e.g. Category:Audio files of bells; pre-1925 recordings) | per file: PD or CC BY / CC BY-SA | bells; historic band recordings (PD in the US if published before 1925) | check each file. CC BY-SA would need share-alike on the audio file, so prefer PD/CC0. The Japanese status of foreign 1910s recordings: publication before 1968 is expired in Japan (check per file) |
| **Internet Archive, 78rpm collection** (Great 78 Project) | varies; many pre-1925 US recordings are PD in the US | brass-band and band-organ tunes of the period | rights metadata is often thin, so use only items with a clear PD basis |
| **Freesound** (freesound.org, filter "Creative Commons 0") | CC0 per file | field recordings of old trams (e.g. heritage trams), fountains, band organs | a **free account is needed to download**. Claude does not create accounts, so the user would create it if wanted |
| **Pixabay sound effects** | Pixabay Content License (free, commercial, no attribution; no standalone redistribution) | water and wind beds | not CC0. The licence forbids selling the sounds unaltered, which is fine inside a scene |
| Newly generated | ours | a band-organ tune played from a PD score (e.g. a Meiji–Taishō march) through a free synth/soundfont | needs a PD score and a free soundfont (e.g. GeneralUser GS, check its licence) |
| **Excluded**: BBC Sound Effects (RemArc) | personal/educational/research only | – | not usable on a paid site |

## Proposed next instructions for Codex (T7/T10 audio)
1. Define the audio layer as **three beds** (city, water, wind) plus **event sounds** (tram bell, ropeway start, music hall), with night variants. Keep total compressed audio small, e.g. Opus at 48–64 kbps with lazy loading per zone.
2. Add an `audio` block to ledger.csv with source URL, licence text snapshot date, and "PD basis" for any historic recording.
3. Prefer Sonniss/CC0 for effects and a newly synthesised band-organ tune from a PD score for music, so that no recording's rights chain needs proving.
4. Ask the user before any Freesound account is created (Claude will not create it).
