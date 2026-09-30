# Ground-tied datum and floor-line identity (Claude, 2026-09-30 17:56, for Codex after its resume)

Answers the "for after resume" review in "User pause / numeric checkpoint". There is no height fit and no Monte Carlo, only raw readings. Pixels are original pixels (NDL IIIF 4064×2880; OML c0234001 347×534).

## 1. Is the facade's own ground line visible? No, in all three views
| view | what hides the facade base | ground-tied features that *are* visible |
|---|---|---|
| plate 46 (north) | trees, fences and kiosks on both sides; the pavement runs continuously into the passage, so there is no contact edge | **pedestrians** under/in front of the arch: feet at about **y 1922 ±6** (x 1110–1180), heads at about **1840 ±6** (the existing horizon row). A kiosk base at about y 1946 (x 890–985) and a post foot at about (1329, 1972): ground points at unknown depth |
| view A (north, 1914) | an open **octagonal pavilion** and trees in the foreground | the pavilion's plinth and column bases at about y 2230–2245 (ground-tied, but size and depth unknown). No usable pedestrians |
| south c0234001 (elevated) | the octagonal music hall standing in a round pond | the **pond rim**, a horizontal circle at about ground/water level (see §3). People seen through the arch stand at an unknown depth |

## 2. Plate 46: the horizon is tied to the ground by pedestrians
- Head row ≈ horizon row (1840) and feet at about 1922 give a standing adult of about 82 ±9 px at that depth. A camera eye level at head height means **camera height ≈ adult eye height ≈ 1.45–1.6 m** (a 1910s–20s Japanese adult is about 1.55–1.6 m tall). This ties the horizon to the ground without using any facade dimension.
- Consistency only (not a measurement): if the roof line (1461) is 15.15 m and the camera height is 1.5 m, the facade-plane ground row would be about 1882. The pedestrians' feet at 1922 then put them at about half the facade distance, i.e. in front of the arch. This matches how they overlap the kiosks.
- Suggested record type: `row` for the horizon (1840 ±6) plus a **camera-height prior of 1.5 ±0.1 m**, labelled "pedestrian-derived". The feet are *not* facade-plane points.

## 3. South view: the pond rim is a ground-plane circle
Top edge of the bright rim coping on the front arc (3-px column profiles, ±2 px):

| x | 55 | 90 | 110 | 130 | 170 | 190 | 210 | 250 | 270 |
|---|---|---|---|---|---|---|---|---|---|
| y | 483 | 486 | 487 | 492 | 491 | 491 | 489 | 484 | 480 |

- The lowest point is at x ≈ 150–190, about under the music hall's centre (the hall stands in the pond).
- The arc gives the **ground-plane tilt** as seen by the elevated camera. A rough reading is b/a ≈ 0.2–0.3, i.e. a view about 10–16° down onto the pond. I am giving the samples, not this estimate; the rim's far side and radius are not visible.
- The slight left/right asymmetry is consistent with the ~1° roll.
- Suggested use: a `conic`/ellipse constraint on a horizontal circle whose centre is the music hall axis, radius unknown.

## 4. Which floor lines are the same physical edge (coping top vs coping bottom)
The lighting explains it. Seen from below (view A), the underside of the roof-edge coping is in shadow between the bright bottom rail and the lit facade face. Seen from above (south), the coping's top surface is bright and the shadow line is just under it.

| physical edge | plate 46 | view A | south |
|---|---|---|---|
| **coping top = railing base** | first dark edge below the sky: (1060, 1459.5), (1470, 1461) | bright bottom rail: (2310, 1594), (2640, 1606) | not separable at 347 px |
| **coping bottom = top of the lit facade face** | not separable | dark → bright transition: (2310, 1608), (2640, 1620) | shadow line under the coping: (140, 277.5), (225, 278.8) |

- In view A the two edges are about 12–14 px apart. That is roughly 0.6–0.8 m at view A's base scale, if the roof-to-arch-crown distance there is about 4.3 m (scenario value, not a measurement).
- **Recommendation**: model the roof edge as two lines (coping top and coping bottom) with one unknown thickness shared by all views. Pair plate 46 and view A through the top line, and view A and south through the bottom line. Do not force the south line onto the railing base.

## 5. Early upper features (unchanged from continuity-check.md)
- View A's crown record (752.5) is the apex ring of the openwork crown.
- South 50 hits finial/rib spikes; the crown apex ring is at 53–55.
- The box undersides A 955 ≡ S 105 have medium confidence. Plate 46's upper records belong to the 1920s form.

## Proposed next instructions for Codex (after resume)
1. Add the pedestrian-derived camera-height prior (1.5 ±0.1 m) to plate 46. The horizon row is then tied to the ground. This may break the roof-fixed scale ambiguity for plate 46 if combined with a facade-plane ground row. That row is not visible, so treat it as a profile over an unknown ground-to-horizon offset rather than a point.
2. Add the south pond-rim arc as a horizontal-circle constraint (samples above) to fix the south camera's tilt relative to the ground.
3. Split the roof edge into coping top and coping bottom with one shared thickness, and re-pair the floor-line samples as in §4.
4. Keep all three as scenario inputs; no default height change.

## 6. Answers to "User resumed / review request" (18:05): numeric profiles, original pixels
Method: column-mean intensity (south: x184–188; view A: x2520–2535) plus the width of the dark region per row. No fitting.

### South c0234001, crown and gallery
| rows | what the profile shows | physical identity |
|---|---|---|
| 49–52 | dark width 27 px (x175–202), then narrows | **finial / rib-end spike tips** around the crown (the old 50 record) |
| **53–54** | a continuous dark body starts at the centre (x176–190) and widens downward | **crown apex / lantern ring** (use **54 ±1.5**) |
| **76** | dark width jumps to 41 px (x164–207) | **gallery railing top** |
| 77–90 | dark only in parts (8–28 px), bright centre at 85–90 | **open gallery**: light seen through the railing |
| **91–92** | sharp step to solid dark (43–44 px, x164–206); centre value 193 → 8 | **gallery floor = top of the solid band** |
| **106.5 ±1.5** | the solid band ends; below, a narrower lattice (shaft) | **band bottom = shaft top** |

→ **92 and 105 are different physical edges, not rival readings**: 91–92 is the gallery floor and 106.5 is the band bottom.

### View A (1914), crown and box
| rows | profile | identity |
|---|---|---|
| 750–756 | centre darkens (154 → 120) and the openwork crown begins | crown apex ring (v2 752.5 is fine) |
| **846 ±2** | dark width jumps 50 → 173 px (x2438–2610) | box top = **gallery railing top** (seen from below) |
| 850–950 | **solid** dark, 173 px wide, with no light gaps | from below, the railing, gallery and band merge. Behind the railing is ceiling or inner wall, not sky |
| **958 ±4** | width drops 147 → 113 px and the x-range changes to 2459–2572 (shaft) | **band bottom = shaft top** (v2 955 is within tolerance) |

- The ratio check agrees. (box top → box bottom) / (crown apex → box top): **A 112/96 = 1.17**. South: railing top → band bottom / crown apex → railing top = 30.5/22.5 = 1.36; for the solid band alone it would be 0.69. So **A 846 ≡ S 76** and **A 958 ≡ S 106.5**.
- **Pair A 955–958 with S 106.5, not with S 92.** The gallery floor (S 91–92) has no separable counterpart in view A.

### Ground contact
- **None of the three views shows the facade's ground line** (§1).
- The only independently supported datum is the **plate-46 pedestrian camera height, 1.5 ±0.1 m** (§2; human stature, not tower geometry). The south pond rim fixes ground-plane tilt but not height.
- If the solver needs an absolute ground row at the facade plane, **no visible anchor exists**. State it as a profile.

### New free-access source (NDL 個人送信, the user's own free registration; no archive visit, nothing paid)
- 『日本の建築 明治大正昭和 5 商都のデザイン』 (1980; = note [59]), PID 12874185, frame 87:
  - fig. 200 **「新世界配置平面図」 from the 1913 album** (plan; transcription in progress in research/map1912.md);
  - fig. 201 caption 「地上一八〇尺鉄骨造」 (**180 shaku ≈ 54.5 m**), a new height statement of unclear origin (album or 1980 author). Add it to the claims table as a scenario only.
