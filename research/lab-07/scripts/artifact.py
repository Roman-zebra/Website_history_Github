"""Private claude.ai Artifact version of page 07, made from lab/07/index.html.

    python3 research/lab-07/scripts/artifact.py <out.html>

Branch previews of the site are not deployed (the Worker has a Durable Object), so the unpublished page is
shared as a private Artifact instead. The Artifact host wraps the page in its own document and serves pdf/
and img/ next to it, so this drops the document head, points the site-relative links at japantimeatlas.com
and adds an in-page PDF viewer (PDF.js from cdnjs, run on the main thread) because the sandboxed frame cannot
show PDFs itself. Prints the list of files to publish next to the page."""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(ROOT, 'lab', '07', 'index.html')
PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/'

VIEWER_CSS = """
.pv{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;background:var(--bg);padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
.pv-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--card)}
.pv-bar b{flex:1 1 14rem;min-width:0;font-size:15px;line-height:1.4}
.pv-bar span{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}
.pv-bar a{font-size:14px}
.pv-bar button{font:inherit;font-size:14px;line-height:1;padding:10px 16px;min-height:40px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);cursor:pointer}
.pv-bar button:hover{border-color:var(--accent)}
.pv-bar button:focus-visible,.pv-bar a:focus-visible,.pdfs a:focus-visible,.gallery a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.pv-pages{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;align-items:center;gap:14px;padding:16px}
.pv-page{display:block;width:100%;max-width:52rem;height:auto;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.2)}
.pv-err{max-width:40rem;margin:24px 0}
html.pv-on,html.pv-on body{overflow:hidden}
"""

VIEWER_HTML = """<div id="pv" class="pv" role="dialog" aria-modal="true" aria-labelledby="pv-title" hidden>
<div class="pv-bar"><b id="pv-title"></b><span id="pv-info"></span><a id="pv-open" href="#" target="_blank" rel="noopener">新しいタブで開く</a><button type="button" id="pv-close">閉じる</button></div>
<div id="pv-pages" class="pv-pages" tabindex="-1"></div></div>
<script>
(function () {
  var BASE = '""" + PDFJS + """';
  var pv = document.getElementById('pv'), pages = document.getElementById('pv-pages');
  var title = document.getElementById('pv-title'), info = document.getElementById('pv-info');
  var openLink = document.getElementById('pv-open'), closeBtn = document.getElementById('pv-close');
  var loading = null, current = null, observer = null, lastFocus = null;

  function script(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = function () { fail(new Error('PDF.js を読み込めませんでした')); };
      document.head.appendChild(s);
    });
  }
  // The worker build is loaded as a plain script so PDF.js runs it on the main thread (no cross-origin Worker).
  function pdfjs() {
    if (!loading) loading = script(BASE + 'pdf.worker.min.js').then(function () { return script(BASE + 'pdf.min.js'); })
      .then(function () { return window.pdfjsLib; });
    return loading;
  }
  function draw(doc, token, canvas) {
    doc.getPage(+canvas.dataset.n).then(function (page) {
      if (token !== current) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var unit = page.getViewport({ scale: 1 });
      var vp = page.getViewport({ scale: (canvas.clientWidth || pages.clientWidth) / unit.width * dpr });
      canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
      return page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    }).catch(function () { canvas.dataset.done = ''; });
  }
  function layout(doc, token) {
    doc.getPage(1).then(function (first) {
      if (token !== current) return;
      var vp = first.getViewport({ scale: 1 });
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !e.target.dataset.done) { e.target.dataset.done = '1'; draw(doc, token, e.target); }
        });
      }, { root: pages, rootMargin: '800px 0px' });
      for (var i = 1; i <= doc.numPages; i++) {
        var c = document.createElement('canvas');
        c.className = 'pv-page'; c.dataset.n = i; c.style.aspectRatio = vp.width + ' / ' + vp.height;
        c.setAttribute('role', 'img'); c.setAttribute('aria-label', i + 'ページ目');
        pages.appendChild(c); observer.observe(c);
      }
    });
  }
  function show(href, name) {
    lastFocus = document.activeElement;
    var token = current = {};
    title.textContent = name; info.textContent = '読み込み中…'; openLink.href = href; pages.textContent = '';
    pv.hidden = false; document.documentElement.classList.add('pv-on'); closeBtn.focus();
    pdfjs().then(function (lib) { return fetch(href).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    }).then(function (buf) { return lib.getDocument({ data: buf, isEvalSupported: false }).promise; }); })
      .then(function (doc) {
        if (token !== current) { doc.destroy(); return; }
        token.doc = doc; info.textContent = doc.numPages + 'ページ'; layout(doc, token);
      })
      .catch(function (err) {
        if (token !== current) return;
        info.textContent = '';
        var p = document.createElement('p'); p.className = 'pv-err';
        p.textContent = 'このPDFをページ内で表示できませんでした（' + (err && err.message || err) + '）。「新しいタブで開く」をお試しください。';
        pages.appendChild(p);
      });
  }
  function hide() {
    if (observer) observer.disconnect();
    if (current && current.doc) current.doc.destroy();
    current = null; observer = null; pages.textContent = '';
    pv.hidden = true; document.documentElement.classList.remove('pv-on');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  closeBtn.addEventListener('click', hide);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pv.hidden) hide(); });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="pdf/"]');
    if (!a || a.id === 'pv-open' || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    var label = a.querySelector('b') || a.querySelector('span') || a;
    show(a.getAttribute('href'), label.textContent.trim() || a.getAttribute('href').slice(4));
  });
})();
</script>"""


def convert(src_html):
    head, body = src_html.split('<body>', 1)
    css = re.search(r'<style>(.*?)</style>', head, re.S).group(1)
    body = body.replace('</body></html>', '')
    body = body.replace('href="/about"', 'href="https://japantimeatlas.com/about"').replace('href="/support"', 'href="https://japantimeatlas.com/support"')
    body = re.sub(r'<a href="(pdf/[^"]+)"', r'<a href="\1" target="_blank" rel="noopener"', body)
    if re.search(r'(href|src)="/(?!/)', body):
        raise SystemExit('site-relative link left in the page: ' + re.search(r'(href|src)="/[^"]*"', body).group(0))
    title = '<title>Time Atlas ページ07</title>'
    return f'{title}\n<style>{css}{VIEWER_CSS}</style>\n<div lang="ja">{body}</div>\n{VIEWER_HTML}\n'


def main():
    out = sys.argv[1]
    html = convert(open(SRC, encoding='utf-8').read())
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    refs = sorted(set(re.findall(r'(?:href|src)="((?:pdf|img)/[^"]+)"', html)))
    missing = [r for r in refs if not os.path.exists(os.path.join(ROOT, 'lab', '07', r))]
    files = {r: os.path.relpath(os.path.join(ROOT, 'lab', '07', r), ROOT) for r in refs if r not in missing}
    print(json.dumps({'bytes': len(html.encode('utf-8')), 'files': files, 'missing': missing}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
