/* HTML -> A4 PDF with the preinstalled Playwright Chromium.
     node render_pdf.cjs <in.html> <out.pdf> [<in2.html> <out2.pdf> ...]
   One browser for the whole batch; every page gets a small running footer. */
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const args = process.argv.slice(2);
  if (!args.length || args.length % 2) throw new Error('usage: render_pdf.cjs in.html out.pdf [...]');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  for (let i = 0; i < args.length; i += 2) {
    const [inp, out] = [path.resolve(args[i]), path.resolve(args[i + 1])];
    const page = await context.newPage();
    await page.goto('file://' + inp, { waitUntil: 'networkidle' });
    const footer = await page.evaluate(() => document.documentElement.dataset.footer || '');
    await page.pdf({
      path: out, format: 'A4', printBackground: true, preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<div style="width:100%;font:7px Inter,Arial,sans-serif;color:#667;padding:0 14mm;display:flex;justify-content:space-between">' +
        '<span>' + footer.replace(/</g, '&lt;') + '</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
      margin: { top: '13mm', bottom: '14mm', left: '14mm', right: '14mm' }
    });
    await page.close();
    console.log('pdf', path.relative(process.cwd(), out));
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
