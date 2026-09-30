# Blind Building A comparison — Codex

Original Blender4.5 source; no competing repo-claude/pilot/Opus/Sonnet files were read. Shared briefs/photos only. This is a source-only comparison asset, excluded from the public Workers build and not a historic/AAA-accepted facade.

Build: Blender4.5 `-b --python-exit-code 1 --python assets-src/shinsekai/eval-building-a/codex/build.py`. `--no-ao` skips the original ray AO; `--no-render` skips review images. No downloads, paid services or add-ons are needed. All textures are original procedural PNGs; no reference photograph, real lettering, trademarks or people are embedded.

Coordinates: BlenderX across the6m frontage, +Y toward the9m rear, Z up; glTFY is up. Three exteriorLOD roots overlap at the same placement; load only one (thresholds25/80m are assumptions). The interior is a separate stable cell with15m loading metadata; actual streaming/controller integration is separate. ExteriorLOD triangles7792/2896/1524; interior6736. GLB4,102,412bytes. Primary metric UV and separate AO atlas UV are present. Validator0errors/0warnings/61informational (unused UVs/empty anchors). Geometry-ray regression checks real stair void, upper landing, floor surfaces and open door, without claiming a complete walk-controller certification.

Exterior: true22cm window reveals, recessed rails/muntins, six separate slightly wavy glass panes/window, sill/drip/lintel, cornice/parapet, tiled roof/eaves, canvas awning, fascia, fictional disc mark, plinth/streaks, downpipe/service insulators. Door slides aside; clear passage1.32m after frame thickness. Upper windows have separate shoji and a furnished room behind; ground glazing looks into the shop.

Interior: counter, open ledger/pen/cup, goods shelves/jars, crates, empty sandals, folded cloth, raised rear tatami and ramp,18-tread stair/real slab void/railings, upper tatami/shoji/andon/low table/tray/futon chest, ceiling/beams. Structure, dimensions, colours and furnishing placement are inferred. Story: an order is unfinished; the ledger is open and tea has been left on the table.

Source tags (typology and dimensions stay distinct):

| Element | Source / assumption |
| --- | --- |
| Two-storey shop massing, plaster upper front, parapet/cornice, deep awning, fascia/disc sign | S:OML158514,c1819001,1912. A:6x9m from shared brief; exact profiles/opening positions inferred |
| Small-pane sash/glazed shopfront and recessed timber frame | S:OML157003/157013,1905 Osaka typology. A:pane count,22cm reveal,4cm glass gap and all dimensions inferred |
| Roof tiles/eaves | S:OML157003,1905 typology. A:concealed pitch/ridge/profile inferred |
| Service bracket/insulators | S:OML157101,1915 secondary typology. A:placement/1912 applicability unverified |
| Plinth, wear, colours and fictional sign marks | A:generic art direction/material behaviour; no source identifies this shop's colours/signs |
| Rooms, stair, ceilings, furniture and props | A:generic period-plausible invented interior; no inspectable floor plan was supplied |

Canonical OML pages follow `https://image.oml.city.osaka.lg.jp/da/detail?tilcod=0000000021-OSK0` + the six-digitid. Shared Claude98 board records CC0 page checks. Local photos were viewed for shapes only and are not copied into the output.

Six1280x720 Eevee/AgX review renders: street at1.5m eye, window-closeup, interior-ground, interior-upper, cutaway, lod. Lighting/palette are art assumptions. These are Blender renders, not runtime1080p performance proof. Original AO uses Blender BVH,8 cosine hemisphere rays,.7m radius; preview65%blend, glTF separate occlusion channel. Full lightmaps/KTX2/meshopt are pending.

Timing: authoring boundary2026-09-30T14:17:36.269Z (last clock read before planning); first Blender execution14:27:08.594Z. First six-render/validator checkpoint14:49:57.184Z (~32m21s including planning/other project work). Execution passes5: pass1 fixed stale join references; pass2 six no-AO renders; pass3/4 Cycles/OpenImageIO native crashes; pass5 successful original BVH AO. Tokens/API cost are unavailable, not estimated. These passes are not five completed artistic tuning loops. `run-record.json` retains machine-readable boundaries/status.

New shared Claude101–103 directive arrived during this build. Baseline is frozen outside Git at research-cache/eval-building-a/codex-v1. It needs work on six-surface dressing, receding prop/ceiling rows and daylight/reflective floor cues; dream staging/extra cameras are not yet implemented. The blind build continues under the shared directive; no comparison score or parity claim is made.
