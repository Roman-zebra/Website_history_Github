# Japan Time Atlas

[Explore Japan Time Atlas](https://japantimeatlas.com/) — a free map for comparing Japan's historical aerial photographs with the present-day map and finding places for a walk.

- Compare available aerial-photo series from 1945–1950, the 1960s, and later periods. Coverage varies by location; recent imagery is not live.
- Read sourced place guides, browse landmarks, markets, shopping streets and liminal places, and explore the Gunkanjima 3D reconstruction.
- Map languages: English, Japanese, Korean, Simplified Chinese and Traditional Chinese. Thai reading guides open the interactive map in English.
- Saved places stay in the current browser.

## Start exploring

[Place guides](https://japantimeatlas.com/places) · [Historical maps guide](https://japantimeatlas.com/guides/japan-historical-maps) · [Gunkanjima in 3D](https://japantimeatlas.com/3d/gunkanjima)

[United States](https://japantimeatlas.com/visit/us) · [United Kingdom](https://japantimeatlas.com/visit/gb) · [Australia](https://japantimeatlas.com/visit/au) · [Canada](https://japantimeatlas.com/visit/ca) · [Singapore](https://japantimeatlas.com/visit/sg) · [한국어](https://japantimeatlas.com/visit/kr) · [台灣](https://japantimeatlas.com/visit/tw) · [香港](https://japantimeatlas.com/visit/hk) · [ไทย](https://japantimeatlas.com/visit/th)

## Build

Use Node.js 22 or newer and run `node scripts/build.cjs`. The build generates static pages, runs the tests, and prepares `dist/` for the existing Cloudflare Workers deployment. No network request is required during the build.

Content editing: [DISCOVERY-MAINTENANCE.md](DISCOVERY-MAINTENANCE.md). Pictorial map-marker pilot: [LANDMARK-ICONS.md](LANDMARK-ICONS.md).

Support: every ☕ link opens [/support](https://japantimeatlas.com/support) (`support.html`) in the reader's language. Before the Ko-fi button, it says in six languages what reaches the site owner (email, name, message, card or PayPal details) and what never does. If the payment service changes, rewrite those lists in all six sections. `tests/support-link.test.cjs` checks that no other page links to Ko-fi directly.

## Data and attribution

Historical and recent aerial imagery: [Geospatial Information Authority of Japan](https://maps.gsi.go.jp/development/ichiran.html). Map data: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Other sources and attribution are shown on individual pages. See [LICENSE-DATA.md](LICENSE-DATA.md).
