require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { ZodError } = require("zod");
const connectDB = require("./config/db");

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
// Stripe webhook must be mounted BEFORE express.json(): signature check needs the raw body
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), require("./webhooks/stripe"));
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/clients", require("./routes/clients"));
app.use("/api/invoices", require("./routes/invoices"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/billing", require("./routes/billing"));
app.use("/api/admin", require("./routes/admin"));

app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0].message, issues: err.issues });
  }
  if (err.status === 503) return res.status(503).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

const port = process.env.PORT || 5000;
connectDB()
  .then(() => app.listen(port, () => console.log(`Server on :${port}`)))
  .catch((e) => {
    console.error("DB connection failed:", e.message);
    process.exit(1);
  });
