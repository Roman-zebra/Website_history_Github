# Page 07 — checks that needed a real browser

Branch `claude/lab07-chrome-checks`, cut from `claude/compassionate-allen-6kj1jh` at fe31a55. It only adds files under
`research/lab-07/chrome/`, so it merges into the Page 07 branch without touching the dossiers.

A second session ran these in the site owner's desktop Chrome on a connection in Japan, in parallel with the
Page 07 session, and took only what that session could not reach: pages that answered HTTP 403/503 or failed DNS,
and NDL pages that had to be read as images.

`findings.json` — one entry per caveat or claim, with the target file, a status, the evidence, suggested text and
sources in the dossier schema:

| id | target | status |
|---|---|---|
| C01 | suo-oshima — 1916–1920 departures/returns table | resolved (full table; 1920 column does not add up in the book itself) |
| C02 | osaka-namba — 1626 theatres and pleasure quarter | resolved (大阪市史 第1, frame 203) |
| C03 | nagasaki-dejima — 1997 Tojin Yashiki study | omission confirmed (NDL image service refuses pid 3135802) |
| C04 | kin — Camp Hansen's name | resolved (USMC article + DVIDS + Medal of Honor Society) |
| C05 | yokosuka — US Navy base figures | corrected (Navy's own figure: about 24,000, 568 acres) |
| C06 | yokosuka — Mikasa's postwar neglect and restoration | resolved (preservation society's Japanese page) |
| C07 | hakodate — Old British Consulate dates | resolved (Cultural Heritage Online + the consulate's site) |
| C08 | tokyo-asakusa — Kokugikan building history | resolved (Sumida City chronology + Japan Sumo Association) |
| C09 | tokyo-asakusa — Ryogoku Bridge "built in 1658" | correction suggested (Sumida's chronology: completed 1659) |
| C10 | deep sample — Diplomatic Archives procedure and passport registers | resolved |
| C11 | deep sample — GSI old maps for Kuka | partly resolved (service moved on 2026-03-07; sheet names found; edition dates open) |

Not done here: anything behind a terms-of-use or login screen that the owner has not approved (GSI edition history),
and personal-transmission (個人送信) NDL items, which the Page 07 rules exclude as sources anyway.
