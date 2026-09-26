const SUPPORTER_STORE_NAME = 'japan-time-atlas-supporters';
const SUPPORTER_KEY_PREFIX = 'supporter:';
const KOFI_WEBHOOK_KEY_HASH = '54aa5296917c99cace6c714fb4dfcbda6a169d7b15b222c884cbf144b2d19a44';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/supporters') {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      return readSupporters(env);
    }
    if (url.pathname === '/api/kofi/webhook') {
      if (request.method !== 'POST') return methodNotAllowed('POST');
      return receiveKoFiWebhook(request, env);
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    return serveAssetRange(request, env);
  }
};

/* One strongly-consistent object owns the public supporter list. The SQLite-backed
   namespace is created by the migration in wrangler.jsonc; no donor email, amount or
   message is written to storage. */
export class SupporterStore {
  constructor(ctx) { this.storage = ctx.storage; }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/record' && request.method === 'POST') {
      const supporter = await request.json();
      const timestamp = String(new Date(supporter.supportedAt).getTime()).padStart(13, '0');
      const transaction = String(supporter.transactionId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 96);
      if (!/^\d{13}$/.test(timestamp) || !transaction) return json({ error: 'Invalid supporter' }, 400);
      await this.storage.put(SUPPORTER_KEY_PREFIX + timestamp + ':' + transaction, {
        name: supporter.name,
        supportedAt: supporter.supportedAt
      });
      return json({ ok: true });
    }
    if (url.pathname === '/list' && request.method === 'GET') {
      const entries = await this.storage.list({ prefix: SUPPORTER_KEY_PREFIX, reverse: true, limit: 500 });
      const supporters = [];
      const seen = new Set();
      for (const value of entries.values()) {
        const name = cleanSupporterName(value && value.name);
        if (!name) continue;
        const dedupe = name.normalize('NFKC').toLocaleLowerCase();
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        supporters.push({ name, supportedAt: value.supportedAt });
        if (supporters.length === 200) break;
      }
      return json({ supporters }, 200, { 'Cache-Control': 'public, max-age=30' });
    }
    return json({ error: 'Not found' }, 404);
  }
}

export function cleanSupporterName(value) {
  if (typeof value !== 'string') return '';
  const name = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return Array.from(name).slice(0, 50).join('');
}

export async function receiveKoFiWebhook(request, env) {
  if (!env.SUPPORTERS) return json({ error: 'Supporter storage is unavailable' }, 503);
  if (!(await validWebhookKey(new URL(request.url).searchParams.get('key'))))
    return json({ error: 'Unauthorized' }, 401);

  let payload;
  try {
    const form = await request.formData();
    payload = JSON.parse(String(form.get('data') || ''));
  } catch (error) {
    return json({ error: 'Invalid Ko-fi payload' }, 400);
  }

  /* A public Ko-fi tip is the donor's publication choice. Private tips, shop orders,
     commissions and memberships never enter the public supporter list. */
  if (payload.type !== 'Donation' || payload.is_public !== true)
    return json({ ok: true, published: false });

  const name = cleanSupporterName(payload.from_name);
  const transactionId = payload.kofi_transaction_id || payload.message_id;
  const time = Date.parse(payload.timestamp);
  if (!name || !transactionId || !Number.isFinite(time))
    return json({ error: 'Missing public supporter fields' }, 400);

  const response = await supporterStore(env).fetch('https://supporters.internal/record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, transactionId, supportedAt: new Date(time).toISOString() })
  });
  if (!response.ok) return json({ error: 'Could not record supporter' }, 502);
  return json({ ok: true, published: true });
}

async function readSupporters(env) {
  if (!env.SUPPORTERS) return json({ error: 'Supporter storage is unavailable' }, 503);
  const response = await supporterStore(env).fetch('https://supporters.internal/list');
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(response.body, { status: response.status, headers });
}

function supporterStore(env) {
  const id = env.SUPPORTERS.idFromName(SUPPORTER_STORE_NAME);
  return env.SUPPORTERS.get(id);
}

async function validWebhookKey(key) {
  if (!key || key.length > 128) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  let difference = actual.length ^ KOFI_WEBHOOK_KEY_HASH.length;
  for (let i = 0; i < Math.min(actual.length, KOFI_WEBHOOK_KEY_HASH.length); i++)
    difference |= actual.charCodeAt(i) ^ KOFI_WEBHOOK_KEY_HASH.charCodeAt(i);
  return difference === 0;
}

function methodNotAllowed(allow) {
  return json({ error: 'Method not allowed' }, 405, { Allow: allow });
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...extraHeaders }
  });
}

/* Byte ranges for the audio guide.
   Workers static assets answer a Range request with the whole file and status 200, and a browser
   that never sees a 206 marks the track as unseekable: every skip snaps back to 0:00. This script
   runs first for the paths listed in wrangler.jsonc (assets.run_worker_first), reads the asset
   through the ASSETS binding and answers the range itself. Everything else is passed through
   untouched, with Accept-Ranges added so the browser knows it may ask. */
async function serveAssetRange(request, env) {
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
