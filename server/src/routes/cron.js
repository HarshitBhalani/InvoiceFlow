const router = require("express").Router();
const crypto = require("crypto");
const { runAll } = require("../lib/jobs");

// POST /api/cron/run with header "x-cron-secret: <CRON_SECRET>". Call it hourly from cron-job.org or similar.
// This also wakes a sleeping free-tier host, which is when the in-process timer cannot run.
router.post("/run", async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(404).json({ error: "Not found" });
    const given = String(req.headers["x-cron-secret"] || "");
    const a = Buffer.from(given);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "Unauthorized" });
    res.json(await runAll());
  } catch (e) {
    next(e);
  }
});

module.exports = router;
