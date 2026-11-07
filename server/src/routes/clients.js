const router = require("express").Router();
const mongoose = require("mongoose");
const { z } = require("zod");
const Client = require("../models/Client");
const Invoice = require("../models/Invoice");
const { requireAuth } = require("../middleware/auth");
const { escapeRegex, paginate } = require("../utils");

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  company: z.string().trim().max(100, "Company name is too long").optional().default(""),
});

router.use(requireAuth);

const notFound = (res) => res.status(404).json({ error: "Client not found" });

// Lightweight list for dropdowns (invoice form). Not paginated, capped for safety.
router.get("/options", async (req, res, next) => {
  try {
    const clients = await Client.find({ userId: req.user._id }).sort({ name: 1 }).limit(500).select("name");
    res.json({ clients });
  } catch (e) {
    next(e);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = { userId: req.user._id };
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(String(req.query.search).slice(0, 100)), "i");
      filter.$or = [{ name: rx }, { email: rx }, { company: rx }];
    }
    const [clients, total] = await Promise.all([
      Client.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Client.countDocuments(filter),
    ]);
    res.json({ clients, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    if (await Client.exists({ userId: req.user._id, email: data.email })) {
      return res.status(409).json({ error: "You already have a client with this email" });
    }
    const client = await Client.create({ ...data, userId: req.user._id });
    res.status(201).json({ client });
  } catch (e) {
    next(e);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const data = schema.parse(req.body);
    const clash = await Client.exists({ userId: req.user._id, email: data.email, _id: { $ne: req.params.id } });
    if (clash) return res.status(409).json({ error: "You already have a client with this email" });
    const client = await Client.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, data, { returnDocument: "after" });
    if (!client) return notFound(res);
    res.json({ client });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const used = await Invoice.countDocuments({ clientId: req.params.id, userId: req.user._id });
    if (used > 0) {
      return res.status(409).json({
        error: `This client has ${used} invoice${used === 1 ? "" : "s"}. Delete those invoices first.`,
      });
    }
    const client = await Client.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!client) return notFound(res);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
