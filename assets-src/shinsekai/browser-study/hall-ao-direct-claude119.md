# Claude119/120: separate AO preparation003

Optional unapproved diagnostic `hallao=direct`; `hallao=directcontrol` runs the
same preparation and main context with constantAO1. Source/default/phone paths
stay unchanged. Baseline3b03c9a/source115 aa030cd, point.5/2350K/EV-1.25/
source directional.01/floorwallwear, fixed1280x720 cameras and full maps/AA.

The opaque normal/depth pass and GTAO run in a separate RenderPipeline. Main
beauty uses renderer.render and a temporary merged builtinAOContext, restored
with finally. A plain texture node samples the prepared output, avoiding nested
pass scheduling in the main draw. Pinnedr186 builtinAOContext skips transparent
materials; no material/map/geometry/light changes are made by this helper.

Both backends normal near/context/floor images, dream after disposal, re-entry
near, far retirement and native capture pass without observed warnings/errors.
Dream SHA matches the original source exactly on both backends, and re-entry
near is byte-identical to the first candidate. Public target/MRT/context/tone/
exposure/flags/glass material snapshots restore; preparation and disposal are
also equal. Far room/map reservations0; GLfar38980tri/75draw. GPUfar reservations
were observed but its counters were not reread this round. Main multipass counts:
near760283tri/315draw, context752091/293, floor736567/257; these are renderer
counters, not qualified phone timing. Full build343/343 after the control edit.

**Normal glass preservation fails.** ConstantAO1 versus original direct source:

| Backend | Near changed pixels / max | Context changed pixels / max |
| --- | ---: | ---: |
| WebGPU |114520 /69 |44906 /162 |
| WebGL2 |114508 /69 |44893 /165 |

All four null-control PNGs exactly match the preceding beauty-only isolation
PNGs. Near bounds[174,0,617,368], context[423,134,1280,541]. Even without AO or a
transparent beauty pass, the preparatory pipeline is sufficient for the normal
glass difference. Dream restoration is repaired, but this is not an accepted
GTAO route or contact-shadow completion. Public restoration does not identify or
prove a private renderer cache mechanism.

Isolated AO versus the null control: GPUnear495649pixels/max18, context522887/max25;
GLnear495672/max18, context522563/max25. Floor versus its fresh direct control:
GPU266871/max31, GL267193/max30. Bench underside/wall junctions darken; feet and
desk/shelf floor contact remain weak. Some small dark speckles remain visible.
Near maps/edges and source assignments persist; visual quality still needs work.

Sixteen unchanged native PNGs, numeric differences and four unchanged encoded
input hashes in parent research-cache/hall-ao-119-003/native-receipt.json.
Named directAO-webgpu-hallFloor-base.png, directAO-webgl-hallDesk-base.png and
nullAO-webgpu-hall-base.png. Hallart12 (this actual AO candidate), technical
repair003; BuildingAart26/hybrid23/cloth7240 unchanged. TRIPO added0.

Next changed repair: replace the preparation RenderPipeline with an explicit
QuadMesh/NodeMaterial scheduling the same opaque prepass/GTAO, avoiding its global
tone/color-space switch. Keep constantAO1 controls and require source near/context
equality before judging contact shading. This is an experimental adaptation to
verify against pinnedr186, not a proven repair. No unchanged retry. After the
route qualifies, address contact strength/noise and unoccluded interior fill/
shadow balance, then finite4–6m range, haori and upper four details.119 incomplete;
observed120/processed118, no additional review request or phone acceptance.
