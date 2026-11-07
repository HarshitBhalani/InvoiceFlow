require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { ZodError } = require("zod");
const connectDB = require("./config/db");
const { startInternalScheduler } = require("./lib/jobs");
const { ipKey } = require("./lib/clientIp");

for (const key of ["MONGO_URI", "JWT_SECRET", "CLIENT_URL"]) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET is too short. Use at least 32 random characters.");
  process.exit(1);
}
if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn("WARNING: STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is empty. Stripe webhooks will be rejected.");
  console.warn("         Payments still activate through the confirm-after-redirect fallback, but set the secret before deploying.");
}
let allowedOrigin;
try {
  allowedOrigin = new URL(process.env.CLIENT_URL).origin; // normalises a trailing slash or path
} catch {
  console.error("CLIENT_URL is not a valid URL");
  process.exit(1);
}

const app = express();
// Exactly one trusted hop: Render's load balancer. The real visitor IP behind Vercel is read in lib/clientIp.js,
// from a header that is only believed when it carries PROXY_SECRET. Do not raise this number: more hops would
// let anyone who calls the Render URL directly fake their IP with an X-Forwarded-For header.
app.set("trust proxy", 1);
if (process.env.NODE_ENV === "production" && !process.env.PROXY_SECRET) {
  console.warn("WARNING: PROXY_SECRET is not set. If this API is behind the Vercel /api proxy, all visitors will share ONE rate limit.");
}

const limitMessage = { error: "Too many requests. Please wait a moment and try again." };

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
// Stripe webhook must be mounted BEFORE express.json(): signature check needs the raw body
app.post(
  "/api/webhooks/stripe",
  rateLimit({ windowMs: 60 * 1000, limit: 300, keyGenerator: ipKey, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests" } }),
  express.raw({ type: "application/json" }),
  require("./webhooks/stripe")
);
// The logo upload carries a small base64 image, so it gets a larger body limit than the rest of the API
app.put("/api/auth/logo", express.json({ limit: "400kb" }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// API responses can contain personal data: never let a browser or proxy cache them
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// CSRF defence for cookie auth, two layers:
// 1) Browsers always send Origin on cross-site POSTs. Reject any state-changing request from another site.
// 2) State-changing requests must be application/json. A cross-site form cannot send that without a CORS preflight,
//    which the CORS policy above refuses.
app.use("/api", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && origin !== allowedOrigin) return res.status(403).json({ error: "Request blocked: untrusted origin" });
  if (req.path === "/cron/run") return next(); // server-to-server, protected by its secret header
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    return res.status(415).json({ error: "Content-Type must be application/json" });
  }
  next();
});

// General API limiter, plus a strict one for credential endpoints (brute force protection)
app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 300, keyGenerator: ipKey, standardHeaders: true, legacyHeaders: false, message: limitMessage }));
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: ipKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
});
// Per-account throttles stop one person being hammered from many IPs (credential stuffing, email bombing)
const byEmail = ({ name, limit, windowMs, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${name}:${String(req.body?.email || "").toLowerCase().slice(0, 254)}`,
    validate: { keyGeneratorIpFallback: false },
    message: { error: message },
  });
app.post(
  "/api/auth/login",
  byEmail({ name: "login", limit: 10, windowMs: 15 * 60 * 1000, skipSuccessfulRequests: true, message: "Too many failed attempts for this account. Try again in 15 minutes." }),
  authLimiter
);
app.post(
  "/api/auth/signup",
  rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, keyGenerator: ipKey, standardHeaders: true, legacyHeaders: false, message: { error: "Too many accounts created from this network. Try again later." } }),
  authLimiter
);
app.post(
  "/api/auth/forgot-password",
  byEmail({ name: "forgot", limit: 3, windowMs: 60 * 60 * 1000, message: "Too many reset requests for this email. Try again in an hour." })
);
app.post("/api/auth/change-password", authLimiter); // stops brute-forcing the current password
for (const p of ["forgot-password", "reset-password", "verify-email", "resend-verification"]) {
  app.post(`/api/auth/${p}`, authLimiter); // also stops email spam and token guessing
}
app.use("/api/public", rateLimit({ windowMs: 60 * 1000, limit: 60, keyGenerator: ipKey, standardHeaders: true, legacyHeaders: false, message: limitMessage }));
// Starting a Stripe checkout creates objects at Stripe, so it gets a much tighter limit than viewing an invoice
app.post(
  "/api/public/invoices/:token/pay",
  rateLimit({ windowMs: 10 * 60 * 1000, limit: 10, keyGenerator: ipKey, standardHeaders: true, legacyHeaders: false, message: { error: "Too many payment attempts. Please wait a few minutes." } })
);

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/clients", require("./routes/clients"));
app.use("/api/invoices", require("./routes/invoices"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/billing", require("./routes/billing"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/public", require("./routes/public"));
app.use("/api/cron", require("./routes/cron"));

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Central error handler: always JSON, never leaks internals
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0]?.message || "Invalid input", issues: err.issues });
  }
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
  if (err.name === "CastError") return res.status(400).json({ error: "Invalid id or value" });
  if (err.code === 11000) return res.status(409).json({ error: "That record already exists" });
  if (err.status === 503 || err.status === 502) return res.status(err.status).json({ error: err.message });
  // Stripe errors (e.g. bad price id) should not look like server crashes to the user
  if (err.type && String(err.type).startsWith("Stripe")) {
    console.error("Stripe error:", err.message);
    return res.status(502).json({ error: "Payment provider error. Please try again." });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

const port = process.env.PORT || 5000;
connectDB()
  .then(() => {
    // Timeouts are set when the server is created. Slow or stalled requests are dropped instead of holding a
    // connection open forever (slowloris-style attacks).
    //  - requestTimeout / headersTimeout: the whole request, headers included, must arrive within 30 seconds
    //  - connectionsCheckingInterval: how often Node looks for such requests (default 30s, so 5s is much tighter)
    //  - keepAliveTimeout: longer than the load balancer's idle timeout, otherwise it can reuse a connection we just
    //    closed and the visitor sees a random 502
    const server = http.createServer(
      { requestTimeout: 30_000, headersTimeout: 30_000, keepAliveTimeout: 65_000, connectionsCheckingInterval: 5_000 },
      app
    );
    server.listen(port, () => {
      console.log(`Server on :${port}`);
      startInternalScheduler();
    });
  })
  .catch((e) => {
    console.error("DB connection failed:", e.message);
    process.exit(1);
  });
