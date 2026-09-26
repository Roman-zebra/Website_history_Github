# Supporters page

`/supporters` thanks the people who supported the site on Ko-fi, by the name they typed into the name box of the Ko-fi support form. Each name appears exactly as written, newest first, once. The page itself and the About page say so, in all six languages, just above every ☕ button: the name is published on this site for anyone to read, and choosing private (or leaving the name empty) keeps it off.

## How a name gets there

1. Ko-fi posts every payment to `POST /api/kofi` (a webhook).
2. `supporters.mjs` accepts it only when the verification token in the payment equals the `KOFI_VERIFICATION_TOKEN` secret, so a name can only arrive with a real payment.
3. Listed: donations and memberships (`Donation`, `Subscription`) that are public (`is_public: true`) and carry a name. Not listed: private support, an empty name, Ko-fi's "Someone", shop orders, commissions, and the sample payment from Ko-fi's test button.
4. Stored, in the `SupporterBook` Durable Object: the name and the time, under Ko-fi's transaction id (a webhook Ko-fi sends again overwrites itself). E-mail address, amount and message are never stored.
5. `GET /supporters`: the Worker writes the names into `supporters.html` between `<!--supporters-->` and `<!--/supporters-->`, sent with `Cache-Control: no-cache`. If the names cannot be read, the page still opens with its "nobody yet" line.

The Durable Object uses SQLite storage: the `v1` migration in `wrangler.jsonc` creates it on deploy (no id to create or paste), and it runs on the Workers Free plan. `wrangler.jsonc` runs the Worker first for `/supporters` and `/api/*`; every other page is still served straight from the static files.

## Set up once

1. **Ko-fi**: open https://ko-fi.com/manage/webhooks, enter `https://japantimeatlas.com/api/kofi` as the webhook URL and save. Copy the **Verification Token** shown on the same page (under Advanced).
2. **Cloudflare**: Workers & Pages → `japan-then-and-now` → Settings → Variables and Secrets → Add. Type **Secret**, name `KOFI_VERIFICATION_TOKEN`, value: the token from step 1. (From a terminal: `npx wrangler secret put KOFI_VERIFICATION_TOKEN`.) A secret survives deploys. Never put the token in `wrangler.jsonc` or anywhere in this repository.
3. **Deploy from main.** The production `wrangler deploy` applies the migration. A preview upload (`wrangler versions upload`) may refuse a new Durable Object migration; that only affects the preview.
4. **Check**: Ko-fi's test button should get `200 test received, nothing listed`. The first real support shows its name at https://japantimeatlas.com/supporters within seconds. Until the secret is set, the webhook answers 503 and nothing is stored.
5. **The Ko-fi page itself**: the ☕ links in the site header and footers go straight to Ko-fi, so those supporters never see this site's notice. Add one line to the Ko-fi page description and to the Ko-fi thank-you message, for example: "The name you enter is listed on https://japantimeatlas.com/supporters exactly as written. Choose private to stay off the list." / 「名前の欄に書いた名前は https://japantimeatlas.com/supporters にそのまま載ります。載せたくない場合は非公開を選んでください。」

## Take a name down

```
curl -X POST https://japantimeatlas.com/api/supporters/remove \
  -H "Authorization: Bearer <the Ko-fi verification token>" \
  --data-urlencode "name=<the name exactly as shown on the page>"
```

It answers `removed N entries` and takes out every entry with that name. If the same person supports again, publicly and under the same name, it appears again.

## Changing the wording

The notice lives in `supporters.html` (six language sections and the six blocks with `data-lang`, switched by `about.js`) and in `about.html` (one line above each ☕ button). `tests/supporters.test.cjs` fails if a language loses the notice, if it moves below its button, or if the Worker stops escaping names, checking the token or respecting private support.
