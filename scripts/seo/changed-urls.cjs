/* Turn the files a push changed into the canonical URLs to announce.
     node scripts/seo/changed-urls.cjs <path> [path ...]        (paths as git prints them)
   Only pages count: a changed script or stylesheet touches every page, and telling the engines that
   the whole site changed on every push is how a site stops being believed. A URL is announced only
   when it is in sitemap.xml, so nothing unlisted or redirected is ever sent. */
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..', '..'), SITE = 'https://japantimeatlas.com';
const LIMIT = 200;

function urlFor(file) {
  if (!file.endsWith('.html')) return null;
  const parts = file.split('/');
  if (parts[0] === 'dist' || parts[0] === 'tests' || parts[0] === 'scripts') return null;
  let url = file.slice(0, -'.html'.length);
  if (url === 'index') return SITE + '/';
  if (url.endsWith('/index')) return SITE + '/' + url.slice(0, -'index'.length);   // 3d/ja/index -> /3d/ja/
  return SITE + '/' + url;
}

function announce(files, sitemap) {
  const listed = new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]));
  const urls = [];
  for (const f of files) {
    const u = urlFor(f.trim().split(path.sep).join('/'));
    if (u && listed.has(u) && !urls.includes(u)) urls.push(u);
  }
  return urls.slice(0, LIMIT);
}

if (require.main === module) {
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  console.log(announce(process.argv.slice(2), sitemap).join(' '));
}
module.exports = { urlFor, announce };
