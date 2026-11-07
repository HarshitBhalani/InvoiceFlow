// Who is really calling? Everything that rate limits by IP goes through here.
//
// The problem: in production the API sits behind Vercel (which proxies /api) and Render's load balancer.
//  - If we trusted X-Forwarded-For too far, anyone hitting the Render URL directly could send a fake
//    X-Forwarded-For and dodge every rate limit.
//  - If we trusted it too little, all users coming through Vercel would look like ONE IP and be throttled together.
//
// The fix: the Vercel proxy sends the real client IP together with a shared secret (PROXY_SECRET).
// We only believe that IP when the secret matches. Everyone else is identified by the address the
// Render load balancer saw (req.ip with "trust proxy" = 1), which a client cannot fake.
const crypto = require("crypto");
const net = require("net");
const { ipKeyGenerator } = require("express-rate-limit");

function fromTrustedProxy(req) {
  const secret = process.env.PROXY_SECRET;
  if (!secret) return false;
  const given = Buffer.from(String(req.headers["x-proxy-secret"] || ""));
  const expected = Buffer.from(secret);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function clientIp(req) {
  if (fromTrustedProxy(req)) {
    const ip = String(req.headers["x-client-ip"] || "").trim();
    if (net.isIP(ip)) return ip;
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

// Key generator for express-rate-limit (also groups IPv6 addresses by /56 so one person cannot use a whole range)
const ipKey = (req) => ipKeyGenerator(clientIp(req));

module.exports = { clientIp, ipKey, fromTrustedProxy };
