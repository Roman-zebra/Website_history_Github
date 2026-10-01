# TRIPO Studio integration — 2026-10-01

User instruction translated: connect the monthly paid TRIPO Studio subscription
to the existing Shinsekai work; Chrome and code changes are authorized. The user
corrected the initially named Marble service to TRIPO. No Marble integration was
retained. This task does not resume the paused general modelling work or heartbeat.

## Working route

TRIPO Studio → GLB export → private candidate intake → Blender 4.5.10 / three.js r186.
The local review is `/assets-src/shinsekai/browser-study/tripo.html` on the existing
loopback study server, port 18765. Its saved-column button loads the actual private
candidate; other GLBs can be selected manually. Neither route sends input files
to a cloud service. Raw models and Blender snapshots stay in parent research-cache.

```
node scripts/shinsekai-tripo-intake.mjs <export.glb> <fresh-candidate-id> <studio-asset-url>
```

The intake preserves source bytes, hashes the GLB, records mesh-definition counts
and provenance, rejects external resource URIs and unsupported required decoders,
and refuses to overwrite a prior candidate. It is a transport check, not a full
Khronos validation, collision certificate, historical acceptance or optimization.
Review orientation is optional and does not change source bytes or calibrate metres.

## Actual verified input

The logged-in account showed Pro and 3,200 Studio credits. Exported the existing
column model labelled “Tripo Demo Model”, with prompt “marble baluster with square
bases and decorative neck, beige marble texture”. No generation or API request,
new subscription or credit purchase was made.

- Candidate: `../research-cache/tripo-intake/baluster-001/`.
- Original export: 60,956,656 bytes; 1,976,386 mesh-definition triangles, one mesh,
  one material, no animation, generator Tripo.
- SHA256: `6db7954dfd7cefbfac81985b7d94ad3ba80bef76f09f048224131bf0903ef9f5`.
- The original export rendered in native Chrome WebGPU and WebGL2 with no captured
  new console errors. Screenshots are private in `../research-cache/tripo-bridge/`.
- The official receiver imported this GLB through its documented-in-source
  WebSocket file-transfer protocol in a **local Node verification client**.
  Handshake, transfer acknowledgement and import-complete all succeeded; Blender
  contains one named mesh. The dedicated inbox saved a 183,842,980-byte `.blend`
  and a 61,386,132-byte GLB. This proves local reception/import/export, not a
  successful direct transfer from the TRIPO webpage.

This dense model is a connection test only. It exceeds the production per-prop
budget and is not adopted into the tower. Input rights, size calibration, LOD,
collision, visual fit and commercial entitlement of each future model remain
per-asset decisions in the existing modelling brief/review workflow.

## Official DCC Bridge

Installed the official Blender bridge from the download link visible in TRIPO.
The webpage advertises v1.0.3; the downloaded package reports `(1, 0, 34)`.
It requires Blender 4.1+, and registers a WebSocket listener on **127.0.0.1:60600**.
It is enabled only in a dedicated hidden Blender process, leaving regular authoring
scenes and saved global preferences untouched.

`scripts/start-shinsekai-tripo.ps1` starts that inbox; it checks for an occupied port
before launching. `scripts/shinsekai-tripo-receiver.py` writes connection status to
`../research-cache/tripo-bridge/receiver-status.json` and saves numbered cumulative
inbox snapshots under `received/`. The PID is also recorded there. Close this
dedicated process when reception is no longer needed; regular Blender modelling
does not need this inbox.

**Open limitation:** the TRIPO webpage's enabled Blender switch remained at
“connecting”; no webpage handshake reached the listener. Direct one-click sending
from Chrome is unverified. File export/intake works and is the verified route.
Browser automated file selection is unavailable because the Chrome extension
does not have file-URL access. The already-staged column button avoids that need;
the user can also use the ordinary file picker. No extension permission was changed.

## Cost and sources checked

TRIPO Studio subscription credits and API credits are independent. The selected
workflow uses the existing Studio subscription and local tools; no API key is needed.

- [TRIPO's Studio/API billing explanation](https://www.tripo3d.ai/ja/help/api-plugins/tripo-studiotripo-api)
- [Official Blender DCC Bridge guide](https://www.tripo3d.ai/ja/blog/tripo-dcc-bridge-for-blender)
- Official package: `https://tripo-public.tripo3d.ai/plugins/blender-bridge/Tripo3d_Blender_Bridge-latest.zip`.

Four meaningful transport tests pass, including corruption/external-resource/
decoder refusal and source-byte preservation. A full site build hit an unrelated
Windows file-write error in generated `ja.html`; its unrelated generated-page
rewrites were restored. Full site test results are recorded separately; no claim
of production/site acceptance follows from this integration study.

After restoring those generated pages, the full suite reports **313/315 passing**.
The two failures are existing generated-language assertions for the Gunkanjima
3D page and a Japanese spot page, outside the TRIPO source changes. The new four
tests pass. The model route answers HEAD 200 with `model/gltf-binary`; private
Blender/PID files and `.git/config` answer 403. Source changes pass syntax/diff checks.
