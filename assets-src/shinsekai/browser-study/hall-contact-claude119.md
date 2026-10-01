# Hall static contact010 — partial Claude119/120 work

`hallcontact=0.8` with the existing normal hall `hallfloor=wear` adds a geometry
baked contact scalar to its two owned floor material copies. The512x2048
non-colour map comes from frozen normal core/desk/lamps/furnishings geometry,
not guessed support rectangles. Blender4.5.10 Cycles AO node distance.45m,
16node samples/16Cycles samples/seed119010 baked through Emit. Planar receiver
UV=(X/3.55,-Z/17.2) matches the glTF floorY.003. The imported coincident floor
is hidden in the private bake scene; its ceiling is4.444m away, outside the AO
radius. Browser geometry/UV0/source maps and all lights stay unchanged.

[Official Blender4.5 AO node](https://docs.blender.org/manual/en/4.5/render/shader_nodes/input/ao.html)
describes distance-limited geometric occlusion with OnlyLocal disabled.
[Official4.5 render-baking manual](https://docs.blender.org/UATEST/manual/en/4.5/render/cycles/baking.html)
supports UV/active target-image/Emit baking. The installed pinned API and saved
scene were verified. Source hashes stay unchanged; saved28,984,362byte scene
reopens with equal mesh positions/UVs/object transforms/packed image/settings.
PNG450,530bytes SHA2569f49be08544e95c191ff7fe5d06fabebb99b6f825e29563123d3c5e7d206942d.

Runtime gain.8 multiplies only existing floor colour nodes by the local scalar;
this provides static contact darkness under furniture and at wall edges. It is
not a moving-light shadow solution. Floor roughness/wear/maps, near woodgrain,
glass, AA, AO007/range5/fill009/2350K/point.5/exposure remain fixed. No new draw
or geometry. One owned texture adds4MiB RGBA, approximately5.33MiB with mips;
these are estimates, not measured GPU memory. Existing multipass AO remains,
so this study does not claim lower GPU cost or phone acceptance.

Gain0 returns the exact original floor colour node. Initial zero-multiply
WebGL context differed5pixels/max1; retained as a technical diagnostic. Current
four near/context controls exactly match matching source images: GPU retained
009, GL fresh source with the same view order. Fresh GLnear itself differs
3pixels/max1 from older009, also exactly matching the current disabled route.
Thus do not claim all current controls are bit exact to historical009 or infer
a specific private compiler/cache mechanism from the initial difference.

Both backends retain source detail and add soft foot/cabinet/wall contact
darkness. Versus009, GPU near3597pixels/max42,context43544/max50,floor112911/max42;
GL near3607/max43,context43504/max50,floor112878/max41. Near/context changes are
confined to visible floor; the close floor view retains its underlying pattern.
Both dream context images equal original direct source, and both re-entry near
images equal their first candidates. Both far38980tri75draw retire the owned
map, with no pending/resident room/reserved bytes/maps. Twenty native scene
PNGs retained including initial/fresh diagnostics; full351/351 tests pass.

One GLUI observation timed out after the selection had already completed;
same-handle inspection confirmed it ready and capture continued without restart.
The additional local endpoint exposes only the generated PNG, with scene/receipt/
traversal403. Original healthy18770 server remains;18771 runs the new explicit
asset route. Evidence: parent research-cache/hall-contact-119-010.

Static floor contacts are implemented and verified as a retained optional
candidate; final look approval/production adoption remains pending. Emitters
still clip; geometric moving-light shadows/upper surfaces and actual iPhone14
performance remain unverified. Default/dream/phone/far feature off. No new tool,
agent, paid generation or formal review call. Continue119 haori then upper4;
keep the whole PLAN/TASKS goal active. Observed120/processed118.
