/* The supporters page: the names people typed into the support form, shown on /supporters as they wrote them.

   Ko-fi posts every payment to POST /api/kofi (the address is set on https://ko-fi.com/manage/webhooks). The body
   is application/x-www-form-urlencoded with one field, data, holding JSON. That JSON carries the verification token
   shown on the same Ko-fi page, and it must equal the KOFI_VERIFICATION_TOKEN secret: a name only arrives with a
   real payment. Kept per payment: the name, the time and Ko-fi's transaction id, so a webhook Ko-fi sends again
   overwrites itself. Nothing is kept when the supporter chose private (is_public false) or gave no name, and the
   e-mail address, amount and message are never stored.

   The names live in one Durable Object with SQLite storage (SupporterBook). The migration in wrangler.jsonc creates
   it on deploy, so there is no id to paste anywhere, and SQLite Durable Objects are part of the Free plan.
   GET /supporters writes them into supporters.html between <!--supporters--> and <!--/supporters-->, newest first,
   each name once. POST /api/supporters/remove, with "Authorization: Bearer <the same token>" and a form field
   name, takes a name down. Setup and the Ko-fi side: SUPPORTERS.md. */

const ROUTES = { '/supporters': page, '/api/kofi': kofi, '/api/supporters/remove': remove };
/* Support given as a coffee or a monthly membership; a shop order or a commission is a purchase. */
const LISTED = ['Donation', 'Subscription'];
/* The transaction id of the sample payment sent by the test button on Ko-fi's webhook page. */
const KOFI_TEST = '00000000-1111-2222-3333-444444444444';
const NAME_MAX = 50;
const BODY_MAX = 64 * 1024;
const LIST = /<!--supporters-->[\s\S]*?<!--\/supporters-->/;

/* The response for one of this file's addresses, or null for everything else. */
export function route(request, env) {
  const handler = ROUTES[new URL(request.url).pathname];
  return handler ? handler(request, env) : null;
}

async function page(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);
  // A plain GET: passing on If-None-Match would get a 304 for the static file and keep an old list on screen.
  const upstream = await env.ASSETS.fetch(new Request(request.url));
  if (upstream.status !== 200) return upstream;
  let list = '';
  try { if (env.SUPPORTERS) list = renderList(await book(env).list()); }
  catch (err) { console.error('supporters: could not read the names', err); }   // the page opens without them
  const html = await upstream.text();
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', 'no-cache');
  for (const name of ['Content-Length', 'Content-Encoding', 'ETag', 'Last-Modified']) headers.delete(name);
  // a function, so that "$&" or "$'" in someone's name is not read as a replacement pattern
  const body = list ? html.replace(LIST, () => list) : html;
  return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers });
}

async function kofi(request, env) {
  if (request.method !== 'POST') return reply(405, 'POST only', { Allow: 'POST' });
  if (!env.KOFI_VERIFICATION_TOKEN || !env.SUPPORTERS) return reply(503, 'not set up');
  const payment = await readPayment(request);
  if (!payment) return reply(400, 'expected a Ko-fi webhook');
  if (!sameSecret(payment.verification_token, env.KOFI_VERIFICATION_TOKEN)) return reply(403, 'wrong verification token');
  if (payment.kofi_transaction_id === KOFI_TEST) return reply(200, 'test received, nothing listed');
  const supporter = supporterFrom(payment);
  if (!supporter) return reply(200, 'not listed');
  // Anything but 200 makes Ko-fi send the payment again later.
  try { await book(env).add(supporter); }
  catch (err) { console.error('supporters: could not save a name', err); return reply(500, 'not saved'); }
  return reply(200, 'listed');
}

async function remove(request, env) {
  if (request.method !== 'POST') return reply(405, 'POST only', { Allow: 'POST' });
  if (!env.KOFI_VERIFICATION_TOKEN || !env.SUPPORTERS) return reply(503, 'not set up');
  const auth = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get('Authorization') || '');
  if (!auth || !sameSecret(auth[1], env.KOFI_VERIFICATION_TOKEN)) return reply(403, 'wrong verification token');
  const name = displayName((await readForm(request))?.get('name'));
  if (!name) return reply(400, 'send the name as the form field name');
  let removed;
  try { removed = await book(env).remove(name); }
  catch (err) { console.error('supporters: could not remove a name', err); return reply(500, 'not removed'); }
  return reply(200, 'removed ' + removed + (removed === 1 ? ' entry' : ' entries'));
}

/* What goes on the page for one Ko-fi payment, or null when nothing should. */
export function supporterFrom(payment) {
  if (payment.is_public !== true || !LISTED.includes(payment.type)) return null;
  const name = displayName(payment.from_name);
  // "Someone" is how Ko-fi shows a supporter who gave no name: nobody to thank by name.
  if (!name || /^someone$/i.test(name)) return null;
  const id = String(payment.kofi_transaction_id || payment.message_id || '').slice(0, 128);
  if (!id) return null;
  const at = Date.parse(payment.timestamp);
  return { id, name, at: Number.isFinite(at) ? at : Date.now() };
}

/* The name as typed. Only what cannot be shown is taken out: control characters, zero-width spaces and the bidi
   controls that would turn the text around, runs of spaces, and anything past NAME_MAX characters. */
export function displayName(raw) {
  if (typeof raw !== 'string') return '';
  const name = raw.normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b\u202a-\u202e\u2066-\u2069\ufeff]/g, ' ')
    .replace(/\s{2,}/g, ' ').trim();
  const chars = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(name)].map(s => s.segment)
    : [...name];
  return chars.length <= NAME_MAX ? name : chars.slice(0, NAME_MAX - 1).join('').trimEnd() + '\u2026';
}

/* Newest first, each name once, as HTML. Empty when there is nobody to list. */
export function renderList(records) {
  const seen = new Set(), items = [];
  for (const r of [...records].sort((a, b) => b.at - a.at)) {
    if (typeof r?.name !== 'string' || !r.name || seen.has(r.name)) continue;
    seen.add(r.name);
    items.push('<li dir="auto">' + escapeHTML(r.name) + '</li>');
  }
  return items.length ? '<ul class="supporter-list">' + items.join('') + '</ul>' : '';
}

const escapeHTML = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* The fields of a small application/x-www-form-urlencoded body, or null. */
async function readForm(request) {
  if (Number(request.headers.get('Content-Length')) > BODY_MAX) return null;
  try {
    const body = await request.text();
    return body.length > BODY_MAX ? null : new URLSearchParams(body);
  } catch (err) { return null; }
}

async function readPayment(request) {
  try {
    const payment = JSON.parse((await readForm(request))?.get('data') ?? 'null');
    return payment && typeof payment === 'object' ? payment : null;
  } catch (err) { return null; }
}

/* Compares every byte, so the time taken does not reveal how much of a guessed token was right. */
function sameSecret(given, secret) {
  if (typeof given !== 'string' || !given || typeof secret !== 'string') return false;
  const a = new TextEncoder().encode(given), b = new TextEncoder().encode(secret);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] | 0) ^ b[i];
  return diff === 0;
}

function reply(status, text, headers = {}) {
  return new Response(text + '\n', { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}

function book(env) {
  const stub = env.SUPPORTERS.get(env.SUPPORTERS.idFromName('supporters'));
  const call = async (path, body) => {
    const res = await stub.fetch('https://supporters' + path, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) throw new Error('supporters' + path + ' answered ' + res.status);
    return res.json();
  };
  return { list: () => call('/list'), add: supporter => call('/add', supporter), remove: name => call('/remove', { name }).then(r => r.removed) };
}

/* One entry per payment under "s:<transaction id>". The Worker above is the only caller. */
export class SupporterBook {
  constructor(state) { this.storage = state.storage; }

  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (request.method === 'GET' && pathname === '/list') return Response.json([...(await this.storage.list({ prefix: 's:' })).values()]);
    if (request.method !== 'POST') return new Response('not found', { status: 404 });
    const body = await request.json();
    if (pathname === '/add') {
      await this.storage.put('s:' + body.id, { name: body.name, at: body.at });
      return Response.json({ ok: true });
    }
    if (pathname === '/remove') {
      const keys = [...(await this.storage.list({ prefix: 's:' }))].filter(([, v]) => v.name === body.name).map(([k]) => k);
      for (let i = 0; i < keys.length; i += 128) await this.storage.delete(keys.slice(i, i + 128));   // at most 128 keys a call
      return Response.json({ removed: keys.length });
    }
    return new Response('not found', { status: 404 });
  }
}
