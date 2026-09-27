/* Visitors by country and the place pages each country opens, from Cloudflare's GraphQL Analytics API.
   This session had no Cloudflare credentials, so page 07 ranks districts on public proxies; run this
   with a read-only token to re-rank them on the site's own traffic:

     CF_API_TOKEN=... CF_ZONE_NAME=japantimeatlas.com node research/lab-07/scripts/cf-audience.cjs [days=30]

   Token: Cloudflare dashboard > My Profile > API Tokens > Create > "Read analytics and logs" template
   (Zone > Analytics > Read) limited to the japantimeatlas.com zone. Writes research/lab-07/cf-audience.json.
   Daily country totals come from httpRequests1dGroups (all plans). Country x path comes from
   httpRequestsAdaptiveGroups, whose look-back is short on the Free plan; the script asks for as many
   days as the plan allows and records the window it actually got. */
const fs = require('node:fs'), path = require('node:path');
const API = 'https://api.cloudflare.com/client/v4';
const token = process.env.CF_API_TOKEN;
if (!token) { console.error('Set CF_API_TOKEN (Zone Analytics Read).'); process.exit(1); }
const days = Number(process.argv[2] || 30);
const day = d => d.toISOString().slice(0, 10);
const until = new Date(), since = new Date(Date.now() - days * 864e5);

async function cf(url, body) {
  const res = await fetch(url, { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok || json.errors?.length) throw new Error(JSON.stringify(json.errors || json).slice(0, 400));
  return json;
}

async function zoneTag() {
  if (process.env.CF_ZONE_ID) return process.env.CF_ZONE_ID;
  const name = process.env.CF_ZONE_NAME || 'japantimeatlas.com';
  const j = await cf(API + '/zones?name=' + encodeURIComponent(name));
  if (!j.result?.length) throw new Error('zone not found: ' + name);
  return j.result[0].id;
}

async function main() {
  const tag = await zoneTag();
  const countries = await cf(API + '/graphql', { query: `query($tag:string,$s:Date,$u:Date){viewer{zones(filter:{zoneTag:$tag}){httpRequests1dGroups(limit:400,filter:{date_geq:$s,date_leq:$u}){dimensions{date} sum{pageViews countryMap{clientCountryName requests threats}}}}}}`, variables: { tag, s: day(since), u: day(until) } });
  const totals = {};
  for (const g of countries.data.viewer.zones[0].httpRequests1dGroups)
    for (const c of g.sum.countryMap) totals[c.clientCountryName] = (totals[c.clientCountryName] || 0) + c.requests - c.threats;
  let paths = [], window = null;
  for (const d of [days, 7, 3, 1]) {
    try {
      const s = new Date(Date.now() - d * 864e5).toISOString();
      const j = await cf(API + '/graphql', { query: `query($tag:string,$s:Time,$u:Time){viewer{zones(filter:{zoneTag:$tag}){httpRequestsAdaptiveGroups(limit:5000,orderBy:[count_DESC],filter:{datetime_geq:$s,datetime_leq:$u,requestSource:"eyeball",edgeResponseContentTypeName:"html"}){count dimensions{clientCountryName clientRequestPath}}}}}`, variables: { tag, s, u: until.toISOString() } });
      paths = j.data.viewer.zones[0].httpRequestsAdaptiveGroups.map(g => ({ country: g.dimensions.clientCountryName, path: g.dimensions.clientRequestPath, views: g.count }));
      window = d; break;
    } catch (e) { if (d === 1) console.warn('country x path unavailable:', e.message); }
  }
  /* which lab-07 candidate each place page belongs to (candidates.json "site" = place id) */
  const cands = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'candidates.json'), 'utf8')).candidates;
  const byPlace = Object.fromEntries(cands.filter(c => c.site).map(c => [c.site, c.id]));
  const perCandidate = {};
  for (const p of paths) {
    const m = /^\/place\/(?:[a-z-]+\/)?([a-z0-9-]+)$/.exec(p.path);
    const id = m && byPlace[m[1]];
    if (!id) continue;
    (perCandidate[id] ||= {})[p.country] = ((perCandidate[id] || {})[p.country] || 0) + p.views;
  }
  const out = { zone: tag, requestedDays: days, pathWindowDays: window, generated: new Date().toISOString(),
    countryRequests: Object.fromEntries(Object.entries(totals).sort((a, b) => b[1] - a[1])), perCandidate, topPaths: paths.slice(0, 500) };
  fs.writeFileSync(path.join(__dirname, '..', 'cf-audience.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('countries', Object.keys(totals).length, 'paths', paths.length, 'window', window);
}
main().catch(e => { console.error(e.message); process.exit(1); });
