# Cloudflare Worker: Edge Redirects

One Worker that replaces a pile of `.htaccess`/nginx redirect rules — bulk 301 redirects, www ↔ apex canonicalisation, trailing-slash normalisation, and a year of edge caching for static assets. Runs before your origin is ever hit, on any Cloudflare plan (free tier included).

## Files

| File | What it does |
|---|---|
| `worker.js` | The Worker — edit the config block at the top, deploy, done |
| `wrangler.example.toml` | Example wrangler config (copy to `wrangler.toml`, add your zone ID) |

## Deploy

```bash
npm install -g wrangler
cp wrangler.example.toml wrangler.toml   # fill in your zone_id / routes
wrangler deploy
```

Then edit `REDIRECTS` in `worker.js` whenever marketing renames a page:

```js
const REDIRECTS = new Map([
  ["/old-services", "/services"],
  ["/promo", "https://shop.example.com/sale"],
]);
```

## Why a Worker instead of redirect rules

- **One place, unlimited redirects** — Cloudflare's dashboard redirect rules are capped per plan; a Map in code has no practical limit.
- **Query strings preserved** — `/old-services?utm_source=x` lands on `/services?utm_source=x` automatically.
- **No origin round-trip** — redirects are answered at the edge, ~10–50 ms worldwide.
- **301 vs 302** — flip `REDIRECT_STATUS` to `302` while testing so browsers don't cache your mistakes, then switch to `301` (permanent, SEO-safe) once verified.

MIT licensed.
