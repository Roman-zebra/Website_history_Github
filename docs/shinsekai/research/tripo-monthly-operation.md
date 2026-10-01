# TRIPO Studio Pro: month of 2026-10-01 to 2026-10-31 (JST)

User instruction translated: resume the interrupted Shinsekai work, incorporate
the completed TRIPO prototype and public-article process, use the subscription
only for important buildings, check consumption and revise the plan daily for a
month. Claude remains an occasional supervisor/reviewer. The user clarified that
"MarblePro" means the existing TRIPO Studio Pro subscription. A later instruction
adds iPhone14 as the lightweight browser-world target.

## Verified account and limits

2026-10-01 Chrome membership UI: Pro (3000 credits), balance3200, displayed expiry
2026-11-01. No generation, refinement, paid retopology or API request was made
in this resumed session. Private observations live in
`../research-cache/tripo-budget/ledger.json`. Do not publish account screenshots.

`tripo-policy.json` sets a2250-credit monthly ceiling, minimum800-credit reserve,
and a cumulative daily allowance: floor(2250 × elapsed days /31). Today72 credits;
unused allowance accumulates, but is permission to spend only when useful.
Full spending of2250 from the observed3200 would leave950. Additional grants are
not automatically spendable. Account-wide consumption outside Codex counts too.

Eligible priorities: White Tower, principal Luna Park entrance, performance hall
and a major cinema. Existing tower/BuildingA assets are reused. Streets, repeated
windows/columns/props, collision, LOD, UV/texture optimization and repairs use
local Blender. The pilot column is retained as a private technical candidate;
its generic shape is not historic evidence or approved tower geometry.

Local pilot results: immutable60956656-byte source/1976386 triangles becomes
006:816428 bytes/1000 triangles or007:934944 bytes/4000 triangles. All3 maps
are512px, estimated4MiB RGBA with mipmaps, not measured GPU memory. Both have
zero glTF Validator errors/warnings. Texture-only round preserves exact reduced
geometry/UV/normal/tangent/index bytes. Unjoined-seam and failed-image-load trials
remain rejected.007 is a near-view candidate;006 fits the repeated-prop baseline.
Desktop Chrome WebGPU/WebGL2 load/disposal works; phone viewport override did
not actually resize this session. No narrow-layout or actual-iPhone claim.

Read the visible cost of the exact operation before each charge; do not infer it
from the marketing "models per month" figure. Maximum two charged attempts per
scoped brief including retries/refinements, then continue locally. No Studio
top-up, upgrade or separately billed API is authorized.

## Daily procedure

1. Read today's visible membership balance, expiry and usage history once.
2. Record `node scripts/shinsekai-tripo-budget.mjs observe --balance N --source 'visible UI evidence'`.
3. Read `node scripts/shinsekai-tripo-budget.mjs status`; log today's plan/results
   privately. Prioritize cached/local work. If the browser is unavailable, mark
   the observation unavailable and generate nothing; do not reuse yesterday's
   balance as today's measurement.
4. For an eligible candidate with a prepared brief and exact displayed cost,
   use `reserve --cost N --target white-tower --brief white-tower-001`. Generate
   only after successful reservation. One operation at a time. An ambiguous
   timeout leaves the reservation intact: inspect existing output/history before
   any retry. Afterwards use `finish --id UUID --balance N --source 'visible UI'`.
5. Consumption above cumulative pacing, reserve intrusion, unexplained balance
   increase or renewal disables generation. Local development continues. On
   2026-11-01 stop this month's automation and confirm a new cycle before spending.

The budget helper is a local guard, not a TRIPO API wrapper or provider-enforced
account spending limit. Browser operations must follow it; other human/service
spending can change the account independently. There is no guarantee about usage
outside this workflow or an unavailable machine.

## Production route and source process

Studio GLB → immutable numbered intake → local geometry/texture reduction →
LOD/collision/scale/rights checks → fixed-camera close/context review → WebGPU and
WebGL loading/disposal → occasional batched Claude review → production adoption.
`tripo-mobile-brief.json` applies the public research workflow and modelling
lessons to the existing column. Geometry and texture resolution are separate
rounds. The prototype's successful transport is reused; direct webpage-to-DCC
handshake remains unverified and is not required for file intake.

## iPhone14 production targets (provisional budgets, not measured results)

Use a720-pixel maximum render-buffer edge and DPR1 initially. Aim for60fps;
adapt resolution/effects if needed, with30fps as the minimum acceptance floor.
Keep visible geometry at160k triangles, draw calls at200, first-load transfer
at8MiB, additional streamed cell at4MiB, and estimated live decoded textures at
128MiB. Only one nearby interior loads; dispose it and its effects when leaving.
Repeated details use instances or lower LOD; full-resolution private source
exports never enter mobile delivery. Per repeated prop starts at1000 triangles,
512px texture maximum,1MiB file maximum; scene totals still govern.

Default mobile effects: baked light/AO, emissive bulbs, no real-time planar/SSR
reflection, GTAO, depth of field or dynamic shadows; at most4 local point lights.
Pause hidden pages; draw static scenes on demand. Preserve movement/interaction
and offer reduced effects before removing scene content. Existing desktop study
captures remain1280×720. A narrow phone viewport on desktop verifies layout and
profile selection only: Safari/iOS/iPhone14 thermal, memory and sustained motion
performance need real-device measurements before claiming the world is light.

Current gap: frozen115 source interiors transfer8.2–27.3MB each, above4MiB;
113 cinema dream view reports241825 triangles, above160k. These are desktop
study assets. Audit source costs and author a separately preserved mobile LOD/
texture derivative before mobile delivery; do not silently globally decimate.

Sources checked: [official Studio pricing](https://www.tripo3d.ai/pricing) and
[Studio/API separation](https://www.tripo3d.ai/ja/help/api-plugins/tripo-studiotripo-api).
Scheduled local work uses the [Codex scheduled-task facility](https://learn.chatgpt.com/docs/automations?surface=app).

## Later continuation update, 2026-10-01

The user explicitly requested continued development after result messages.
Existing automation jta is ACTIVE every10 minutes in chat01a0f756-8ab2-7111-a287-46e329330319,
throughOct31; do not create a duplicate. The first run after09:00JST observes
balance and revises the daily plan once per day, not every10 minutes. Exact
cost/before-after balance checks still apply to every charged operation. Skip
duplicate concurrent development and remain quiet for unchanged/non-actionable
state; notify meaningful progress, completion, failure or required user action.
The SNS organization wait gate is released after verified junction/source safety.
Local app/machine availability governs scheduled execution; this is not a
provider-enforced spending guarantee. Stop the monthly automation onNov1.

Current optional115 derivative: exterior1.98MB, stairs3.29/3.58MB, local spend0.
Both desktop rendering backends load/switch/unload within provisional budgets;
hall/lift/cinema still fail stream/draw/triangle budgets and are blocked before
loading in the phone study. See tower-mobile-115.md for exact costs/limits.
Real iPhone14 Safari sustained motion, memory and heat remain unmeasured.

Latest user instruction2026-10-01 supersedes the10-minute development cadence:
ACTIVE continuous Goal now follows PLAN/TASKS to world completion in this chat,
with useful work continuing after result messages without scheduled waiting.
Existing jta returned to daily09:00JST for balance/consumption/plan only, through
Oct31; no duplicate development injection. OnNov1 stop that October schedule
and TRIPO paid use while free local Goal work continues. Runtime availability,
usage limits and required external input remain constraints; no completion
claim until required functionality and qualified checks have evidence.
Official Goal reference: https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex

Latest visual-quality constraint: preserve existing attractive graphics during
phone optimization. Jagged edges/blurred near surfaces/lost details fail visual
acceptance even within numeric budgets. Prefer reduced simultaneous visible
range, streamed cells, offscreen work and distant detail before cutting nearby
maps or silhouettes. Current512px/noAA720px candidate is not approved for look;
qualify close/context against matching source camera/light and adjust provisional
resolution/AA budgets when needed. Next hall visibility/stream partition audit
before geometric decimation. Real-device performance remains unmeasured.
