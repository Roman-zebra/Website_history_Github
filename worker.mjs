/* Runs before the static files for the paths listed in wrangler.jsonc (assets.run_worker_first).

   The supporters page and the Ko-fi webhook (/supporters, /api/*) are answered by supporters.mjs.

   Byte ranges for the audio guide.
   Workers static assets answer a Range request with the whole file and status 200, and a browser
   that never sees a 206 marks the track as unseekable: every skip snaps back to 0:00. For the audio
   files this script reads the asset through the ASSETS binding and answers the range itself.
   Everything else is passed through untouched, with Accept-Ranges added so the browser knows it may ask. */
import { route, SupporterBook } from './supporters.mjs';

export { SupporterBook };

export default {
  async fetch(request, env) {
    const own = route(request, env);
    if (own) return own;
    const upstream = await env.ASSETS.fetch(request);
    if (request.method !== 'GET' || upstream.status !== 200) return withAcceptRanges(upstream);
    const range = parseRange(request.headers.get('Range'));
    if (!range) return withAcceptRanges(upstream);
    const ifRange = request.headers.get('If-Range');
    if (ifRange && ifRange !== upstream.headers.get('ETag')) return withAcceptRanges(upstream);
    const body = await upstream.arrayBuffer();
    const size = body.byteLength;
    let start, end;
    if (range.start === null) { start = Math.max(0, size - range.suffix); end = size - 1; }
    else { start = range.start; end = range.end === null ? size - 1 : Math.min(range.end, size - 1); }
    if (size === 0 || start >= size || start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size, 'Accept-Ranges': 'bytes' } });
    }
    const headers = new Headers(upstream.headers);
    headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + size);
    headers.set('Content-Length', String(end - start + 1));
    headers.set('Accept-Ranges', 'bytes');
    headers.delete('Content-Encoding');
    return new Response(body.slice(start, end + 1), { status: 206, headers });
  }
};

/* "bytes=a-b", "bytes=a-" or "bytes=-n"; anything else (several ranges, other units) is ignored
   and the whole file goes back, which is what the spec allows. */
export function parseRange(value) {
  const m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/.exec(value || '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  if (m[1] === '') return { start: null, end: null, suffix: parseInt(m[2], 10) || 0 };
  return { start: parseInt(m[1], 10), end: m[2] === '' ? null : parseInt(m[2], 10), suffix: 0 };
}

function withAcceptRanges(res) {
  if (res.headers.get('Accept-Ranges')) return res;
  const headers = new Headers(res.headers);
  headers.set('Accept-Ranges', 'bytes');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
