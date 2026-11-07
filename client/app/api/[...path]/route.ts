// Production API proxy: the browser only ever talks to this app's own domain (/api/...), and this handler
// forwards the request to the Express API. That keeps the login cookie first-party (works in Safari / Brave).
//
// It also tells the API who the real visitor is: it sends the visitor's IP together with PROXY_SECRET, and the API
// only believes that IP when the secret matches (server/src/lib/clientIp.js). That is what makes per-IP rate limits
// work correctly and impossible to spoof.
//
// Not used in local development: there NEXT_PUBLIC_API_URL points straight at http://localhost:5000/api.
import type { NextRequest } from "next/server";
import { isIP } from "node:net";

const BACKEND = process.env.BACKEND_URL?.replace(/\/$/, "");
const SECRET = process.env.PROXY_SECRET;

// Only these request headers are passed on. Anything else, including a client-supplied x-proxy-secret
// or x-client-ip, is dropped.
const FORWARD_REQUEST = ["content-type", "cookie", "accept", "accept-language", "origin", "user-agent"];
const FORWARD_RESPONSE = ["content-type", "content-disposition", "cache-control", "retry-after", "ratelimit-limit", "ratelimit-remaining", "ratelimit-reset", "ratelimit-policy"];

// The largest legitimate request is the logo upload (about 300 KB). Refuse bigger ones before they reach the API.
const MAX_BODY_BYTES = 450_000;

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!BACKEND || !SECRET) return fail(503, "The API is not configured. Set BACKEND_URL and PROXY_SECRET.");

  const { path } = await ctx.params;
  const joined = path.join("/");
  // Stripe webhooks and cron jobs call the API directly. They must never be reachable through this public proxy.
  if (/^(webhooks|cron)(\/|$)/.test(joined)) return fail(404, "Not found");

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  if (hasBody && Number(req.headers.get("content-length") || 0) > MAX_BODY_BYTES) return fail(413, "Request body too large");

  const headers = new Headers();
  for (const name of FORWARD_REQUEST) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-proxy-secret", SECRET);
  // Vercel sets x-real-ip / x-forwarded-for itself and ignores what the client sent
  const ip = (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "").trim();
  if (isIP(ip)) headers.set("x-client-ip", ip);

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/api/${joined}${req.nextUrl.search}`, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      // @ts-expect-error: required by Node's fetch when streaming a request body
      duplex: "half",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(55_000), // Render's free tier can take ~30-50s to wake up
    });
  } catch {
    return fail(502, "The server is not responding. Please try again in a moment.");
  }

  const out = new Headers();
  for (const name of FORWARD_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  for (const cookie of upstream.headers.getSetCookie()) out.append("set-cookie", cookie);
  out.set("Cache-Control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
