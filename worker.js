/**
 * Cloudflare Worker — edge redirects & canonicalisation.
 *
 * Runs before your origin is ever hit: bulk 301 redirects, www ↔ apex
 * canonicalisation, trailing-slash normalisation, query-string-preserving
 * redirects, and long-lived caching for static assets. One deploy replaces
 * a pile of .htaccess/nginx redirect rules and works on any plan.
 *
 * Deploy with wrangler:
 *   wrangler deploy
 * (see wrangler.example.toml — copy to wrangler.toml and fill in your zone)
 */

// ------------------------------------------------------------------ config
// Old path  →  new destination. Match is exact on the path (no query string).
// Values may be absolute URLs or root-relative paths.
const REDIRECTS = new Map([
  ["/old-services", "/services"],
  ["/blog/2023/hello-world", "/blog/hello-world"],
  ["/promo", "https://shop.example.com/sale"],
  ["/contact-us", "/contact"],
]);

// Which host is canonical: "apex" redirects www → root, "www" the reverse,
// "none" disables host canonicalisation.
const CANONICAL_HOST = "apex"; // "apex" | "www" | "none"

// Redirect status for the REDIRECTS map above. 301 = permanent (SEO-safe,
// cached by browsers); use 302 while testing so you don't cache mistakes.
const REDIRECT_STATUS = 301;

// Normalise trailing slashes: "/about/" → "/about". Skipped for the root
// path and for anything that looks like a file (has an extension).
const NORMALISE_TRAILING_SLASH = true;

// ------------------------------------------------------------------ worker
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // 1. Canonicalise the host (www ↔ apex).
    if (CANONICAL_HOST !== "none") {
      const isWww = url.hostname.startsWith("www.");
      const apex = isWww ? url.hostname.slice(4) : url.hostname;
      if (CANONICAL_HOST === "apex" && isWww) {
        url.hostname = apex;
        return Response.redirect(url.toString(), 301);
      }
      if (CANONICAL_HOST === "www" && !isWww) {
        url.hostname = "www." + apex;
        return Response.redirect(url.toString(), 301);
      }
    }

    // 2. Bulk redirect map (query string is preserved automatically —
    //    we only ever replace origin+pathname, never url.search).
    const target = REDIRECTS.get(url.pathname);
    if (target !== undefined) {
      const dest = new URL(target, url.origin);
      dest.search = url.search; // keep ?utm=… etc.
      return Response.redirect(dest.toString(), REDIRECT_STATUS);
    }

    // 3. Trailing-slash normalisation.
    if (
      NORMALISE_TRAILING_SLASH &&
      url.pathname.length > 1 &&
      url.pathname.endsWith("/") &&
      !/\.[a-z0-9]{2,5}$/i.test(url.pathname) // leave /files/report.pdf alone
    ) {
      url.pathname = url.pathname.replace(/\/+$/, "");
      return Response.redirect(url.toString(), 301);
    }

    // 4. Not a redirect — fetch from origin, but cache static assets at the
    //    edge for a year (immutable filenames like app.abc123.css).
    const response = await fetch(request);
    const res = new Response(response.body, response);
    if (/\.(css|js|png|jpg|jpeg|webp|avif|gif|svg|ico|woff2?|ttf|eot)$/i.test(url.pathname)) {
      res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    }
    return res;
  },
};
