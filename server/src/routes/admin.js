const router = require("express").Router();
const mongoose = require("mongoose");
const { z } = require("zod");
const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/auth");
const { escapeRegex, paginate } = require("../utils");

router.use(requireAuth, requireRole("admin"));

const MONTHS = 6;
const PRO_PRICE = () => parseFloat(process.env.PRO_PRICE_USD) || 19;

router.get("/users", async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = { isDemo: { $ne: true } };
    if (["free", "pro"].includes(req.query.plan)) filter.plan = req.query.plan;
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(String(req.query.search)), "i");
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select("name email role plan banned createdAt"),
      User.countDocuments(filter),
    ]);
    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    next(e);
  }
});

router.patch("/users/:id/ban", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Not found" });
    const { banned } = z.object({ banned: z.boolean() }).parse(req.body);
    if (String(req.user._id) === req.params.id) return res.status(400).json({ error: "You cannot ban yourself" });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.role === "admin") return res.status(400).json({ error: "You cannot ban an admin" });
    target.banned = banned;
    await target.save();
    res.json({ user: { _id: target._id, banned: target.banned } });
  } catch (e) {
    next(e);
  }
});

router.get("/stats", async (req, res, next) => {
  try {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1));

    const [plans, signups] = await Promise.all([
      User.aggregate([{ $match: { isDemo: { $ne: true } } }, { $group: { _id: "$plan", count: { $sum: 1 } } }]),
      User.aggregate([
        { $match: { createdAt: { $gte: start }, isDemo: { $ne: true } } },
        { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } }, signups: { $sum: 1 } } },
      ]),
    ]);

    const count = (p) => plans.find((x) => x._id === p)?.count || 0;
    const free = count("free");
    const pro = count("pro");
    const users = free + pro;

    const found = new Map(signups.map((s) => [`${s._id.y}-${s._id.m}`, s.signups]));
    const signupsByMonth = [];
    for (let i = 0; i < MONTHS; i++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
      signupsByMonth.push({
        month: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
        signups: found.get(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`) || 0,
      });
    }

    res.json({
      totals: {
        users,
        pro,
        free,
        mrr: Math.round(pro * PRO_PRICE() * 100) / 100, // MRR = active Pro users x plan price
        conversion: users ? Math.round((pro / users) * 1000) / 10 : 0,
      },
      planSplit: [
        { plan: "free", count: free },
        { plan: "pro", count: pro },
      ],
      signupsByMonth,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
