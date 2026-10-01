# Free local tool decisions — 2026-10-01

User instruction translated: consult the recent ChatGPT discussion of world
creation tools; actively use free tools without service usage quotas. Paid or
quota-limited additions are excluded. Before incorporating newly found Reddit
or GitHub tools, report their purpose and ask the user for permission.

Read the recent chats "CODEX連携方法" and "3D AI連携費用比較". Their paid
recommendations do not authorize additional subscriptions or APIs. The actual
subscribed service was subsequently clarified as TRIPO Studio Pro. The already
authorized TRIPO monthly budget remains the sole exception to the new-addition
rule; routine work uses existing local tools.

Existing usable local tools: Blender4.5.10, three.js r186, glTF Validator,
gltfpack/meshoptimizer, KTX-Software and FFmpeg. Reuse their installed copies.
Service "free credits", trials and revenue-conditioned free plans do not qualify
as unlimited additions under this instruction. No extra agents/model escalation.

## Material Maker1.7 — user explicitly authorized

- Purpose: original procedural PBR wood/plaster/rust maps and local model painting;
  no cloud-generation credit pool. Static texture exports suit the existing
  Blender/glTF/three.js pipeline and phone texture budgets.
- Source: [author's repository](https://github.com/RodZill4/material-maker),
  [stable release1.7](https://github.com/RodZill4/material-maker/releases/tag/1.7),
  [MIT licence](https://raw.githubusercontent.com/RodZill4/material-maker/master/LICENSE.md).
  [Author's download page](https://rodzilla.itch.io/material-maker) explicitly
  permits choosing$0; avoid paid Steam/donation routes.
- Authorized directly by user in this chat: "Material Makerの導入を許可".
- Downloaded official `material_maker_1_7_windows.zip`,109821136 bytes.
  SHA256 `deb4416bc939861d48097a866a8b2bf0363c29ff64874f2e04478658ff900808`.
  This is a locally measured archive hash, not an independently supplied signature.
- Portable installation: parent `research-cache/tools/material-maker-1.7/app/`;
  no system installer, donation, account or subscription. Godot engine reports
  4.7 stable; actual start initializes Vulkan onGTX1660SUPER, node/brush libraries
  and bundled HDR environment. The briefly launched test process was retired.
- Existing supplied-example CLI export attempts are recorded privately in
  `research-cache/material-maker-smoke-*`. Do not claim successful export merely
  from exit status or "Exporting" text; verify actual generated maps first.
- Use original material graphs; public/shared assets require their own provenance
  and licence check. Preserve MIT notices if redistributing tool/source code.

Future GitHub/Reddit candidates stay uninstalled until user permission. Prefer
upstream releases and inspect licensing, dependencies, network behaviour and
resource demands before requesting that permission. Tool adoption should solve
a current limitation, not replace functioning local work without evidence.
