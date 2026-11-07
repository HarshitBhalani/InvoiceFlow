const router = require("express").Router();
const mongoose = require("mongoose");
const { z } = require("zod");
const Client = require("../models/Client");
const Invoice = require("../models/Invoice");
const { requireAuth } = require("../middleware/auth");
const { escapeRegex, paginate } = require("../utils");

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  company: z.string().optional().default(""),
});

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = { userId: req.user._id };
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(String(req.query.search)), "i");
      filter.$or = [{ name: rx }, { email: rx }, { company: rx }];
    }
    const [clients, total] = await Promise.all([
      Client.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Client.countDocuments(filter),
    ]);
    res.json({ clients, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const client = await Client.create({ ...schema.parse(req.body), userId: req.user._id });
    res.status(201).json({ client });
  } catch (e) {
    next(e);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Not found" });
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      schema.parse(req.body),
      { new: true }
    );
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json({ client });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Not found" });
    const used = await Invoice.exists({ clientId: req.params.id, userId: req.user._id });
    if (used) return res.status(409).json({ error: "Client has invoices. Delete them first." });
    const client = await Client.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
