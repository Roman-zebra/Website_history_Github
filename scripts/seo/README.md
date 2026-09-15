# Titles of the 3D pages, chosen from search data

Every Monday `.github/workflows/seo-3d-titles.yml` reads Search Console for the five Gunkanjima 3D pages
and keeps or changes each page's `<title>` and meta description. It only ever chooses among the
hand-written candidates in `titles-3d.json`, so a title can never say something the page does not.
The rules are at the top of `titles.cjs`; `state-3d.json` records what is live, since when and why.

- Until a page has 100 impressions in 28 days, nothing changes. Before the first Search Console decision the
  choice comes from `suggest-2026-09-15.json` (autocomplete lists from Google, Bing, Naver, Baidu, DuckDuckGo).
- The English, Korean and Chinese pages count searchers outside Japan only (`exclude` in `titles-3d.json`).
- A change waits 28 days after the previous one and needs a 25% better match to the queries.
- A new title that earns significantly fewer clicks than the previous one at the same positions
  (binomial test, p < 0.05, at least 20 clicks) is rolled back and kept out for 90 days.
- To add a candidate, append it to `titles-3d.json`; `node --test tests/seo-titles.test.cjs` checks it.

## Connect Search Console (once)

1. Google Cloud console: create a project and enable the **Google Search Console API**.
2. IAM & Admin > Service accounts: create one (no roles), then Keys > Add key > JSON. Keep the file private.
3. Search Console > japantimeatlas.com > Settings > Users and permissions > Add user:
   the service account's e-mail address, permission **Restricted**.
4. GitHub > Settings > Secrets and variables > Actions: new repository secret
   `GSC_SERVICE_ACCOUNT_JSON` with the whole JSON file. If several properties match, add the variable
   `GSC_SITE_URL`, for example `sc-domain:japantimeatlas.com`.
5. Actions > "3D page titles from Search Console" > Run workflow. The log shows the property and row counts.

Locally: `GSC_SERVICE_ACCOUNT_FILE=key.json node scripts/seo/gsc.cjs --out .seo-cache/gsc-3d.json`,
then `node scripts/seo/update-titles.cjs --gsc .seo-cache/gsc-3d.json --dry-run`.

## Other search engines

- **Bing** (also Yahoo! Taiwan, DuckDuckGo, Ecosia and the Edge address bar): Bing Webmaster Tools >
  Import from Google Search Console. Changed pages are announced through IndexNow after each deploy.
- **Naver**: Search Advisor > add the site > HTML tag: put the code under `naver-site-verification`
  in `verification.json`, deploy, verify, then submit `https://japantimeatlas.com/sitemap.xml`.
  Naver also takes the IndexNow announcements.
- **Baidu**: 百度搜索资源平台 > add the site > HTML tag: `baidu-site-verification`. For pushes, add the
  API token as the secret `BAIDU_PUSH_TOKEN`.
- **Google**: every page lists its five language versions with hreflang (`en`, `ja`, `ko`, `zh-Hans`,
  `zh-Hant`, `x-default`). Google takes no pings.
