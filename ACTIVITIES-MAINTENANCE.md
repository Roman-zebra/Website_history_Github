# Food and shopping collections

The home background changes every 4.5 seconds after its image is ready. Pause, reduced-motion, slow-connection and hidden-tab handling remain active.

The two new categories follow Japan Tourism Agency's 2025 annual inbound visitor survey (page 24 / PDF page 30): eating Japanese food and shopping were the top two activities both undertaken and intended for a next visit. These are participation/intent measures across nationalities and travel purposes, not satisfaction scores or a ranking of individual destinations.

Source: https://www.mlit.go.jp/kankocho/content/002003329.pdf

activities-data.js holds 18 food and 18 shopping destinations. Spots are editorial selections ordered from north to south, not a claimed popularity ranking. The food category includes Japanese regional food culture and regional ramen at the Shin-Yokohama Ramen Museum. Five language names and descriptions, representative area coordinates and official visitor links are stored with each spot. Do not publish volatile prices or operating hours without checking the operator.

Cards use the atlas's existing GSI aerial-map preview, with GSI labels. They are not photographs of dishes or products. Map panels share the existing compare, save and share controls. Activity deep links use #a-<id>; map search and saved places also resolve these records. The cache release is 0.73; the unchanged geographic-data release remains 0.47.

Edit source and run node scripts/build.cjs. The build runs the regression suite and regenerates the existing guides. Keep the current Cloudflare custom-domain deployment; do not create a replacement Site or migrate hosting.
