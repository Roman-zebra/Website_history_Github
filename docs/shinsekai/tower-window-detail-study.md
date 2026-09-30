# Recessed tower window candidates

Claude97 owns the detail standard; Codex authors these separate candidates. Claude99's first street-facade pilot remains Claude-owned. Original v2/v3/v4 and default/boarding/look viewers are preserved.

Run Blender4.5 with `--python-exit-code 1 --python assets-src/shinsekai/tower-study/build-tower-v4.py -- --detail-windows --window-lod 0 --export-only`; repeat with1/2. Output: tower-study-v5-detail-lodN-open-gallery.glb and matching parts.json. No enclosed-box candidate is implied.

Sixteen existing bay centres remain. True boolean wall apertures connect to assumed3.4x2.8x2.8m room voids; reveal30cm, frame front8cm inside, separate glass4cm farther inside. LOD0 has six individually modelled panes/muntins, bevelled frame/sill/drip edge/lintel. LOD1 keeps the recess/frame/sill with muntin cards; LOD2 keeps genuine recess/frame/glass and a dark back plane. Shared mesh datablocks support future instancing.

Dimensions, pane pattern, glass tint, room cuts and colours are art/interaction assumptions. These are not historic interior plans. Current back planes are dark placeholders: the required parallax-room shader, wavy-glass runtime treatment, streamed furnished rooms, automatic LOD/instancing and a near-window review camera are still pending. Doors are not placed without a justified tower-opening interface. These candidates do not pass the complete97 standard yet and are not served by the preview or included in dist.

The landing contract is unchanged. Regression verifies16 stable feature/cell IDs, separate pane counts, assumptions and decreasing LOD triangle counts/window800-triangle budget. All three rebuilt GLBs independently validate with0errors/0warnings (21/21/16 informational). Per-window triangles:470/142/100; sixteen windows total7520/2272/1600. Files1,680,288/1,652,716/1,634,456bytes. Receipts: parent research-cache/tower-window-detail-validation.json. Integration/close-view acceptance remains pending.

The optional metric UV derivative tower-study-v5-detail-look-uv.glb reuses the verified texture set and skips window per-pane UVs. Actual triangle positions,16 bays, node transforms and the landing contract are regression checked; UV seams legitimately split vertices. Validator0errors/0warnings/21infos. interior-mapping.mjs authors original TSL box-ray room mapping and conservative wavy alpha glass, but has only a syntax check: it is not shader compiled, connected or visually accepted. The v4 AO atlases must not be assigned to this different geometry. Default look viewer still loads v4.
