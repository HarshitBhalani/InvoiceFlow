const router = require("express").Router();
const mongoose = require("mongoose");
const { z } = require("zod");
const Client = require("../models/Client");
const Invoice = require("../models/Invoice");
const { requireAuth } = require("../middleware/auth");
const { invoiceLimit } = require("../middleware/planLimit");
const { paginate, escapeRegex } = require("../utils");

const STATUSES = ["draft", "sent", "paid", "overdue"];

const schema = z.object({
  clientId: z.string().refine((v) => mongoose.isValidObjectId(v), "Invalid client"),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
        unitPrice: z.coerce.number().min(0),
      })
    )
    .min(1, "Add at least one item"),
  status: z.enum(STATUSES).optional(),
  dueDate: z.coerce.date(),
});

const calcTotal = (items) =>
  Math.round(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * 100) / 100;

// paidAt follows status: set when paid, cleared otherwise
const paidFields = (status) => (status === "paid" ? { paidAt: new Date() } : { paidAt: null });

const badId = (res) => res.status(404).json({ error: "Not found" });

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = { userId: req.user._id };
    if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
    if (req.query.search) {
      const term = String(req.query.search);
      const clients = await Client.find({
        userId: req.user._id,
        name: new RegExp(escapeRegex(term), "i"),
      }).select("_id");
      filter.$or = [{ clientId: { $in: clients.map((c) => c._id) } }];
      const n = parseInt(term);
      if (!Number.isNaN(n)) filter.$or.push({ number: n });
    }
    const [invoices, total] = await Promise.all([
      Invoice.find(filter).populate("clientId", "name email").sort({ createdAt: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(filter),
    ]);
    res.json({ invoices, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user._id });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json({ invoice });
  } catch (e) {
    next(e);
  }
});

router.post("/", invoiceLimit, async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    const client = await Client.findOne({ _id: data.clientId, userId: req.user._id });
    if (!client) return res.status(400).json({ error: "Client not found" });
    const last = await Invoice.findOne({ userId: req.user._id }).sort({ number: -1 }).select("number");
    const invoice = await Invoice.create({
      ...data,
      userId: req.user._id,
      number: (last?.number || 0) + 1,
      total: calcTotal(data.items),
      ...(data.status === "paid" ? paidFields("paid") : {}),
    });
    res.status(201).json({ invoice });
  } catch (e) {
    next(e);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const data = schema.parse(req.body);
    const client = await Client.findOne({ _id: data.clientId, userId: req.user._id });
    if (!client) return res.status(400).json({ error: "Client not found" });
    const existing = await Invoice.findOne({ _id: req.params.id, userId: req.user._id }).select("status");
    if (!existing) return res.status(404).json({ error: "Invoice not found" });
    const nextStatus = data.status || existing.status;
    const statusChanged = nextStatus !== existing.status;
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { ...data, total: calcTotal(data.items), ...(statusChanged ? paidFields(nextStatus) : {}) },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json({ invoice });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const { status } = z.object({ status: z.enum(STATUSES) }).parse(req.body);
    const existing = await Invoice.findOne({ _id: req.params.id, userId: req.user._id }).select("status");
    if (!existing) return res.status(404).json({ error: "Invoice not found" });
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status, ...(status !== existing.status ? paidFields(status) : {}) },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json({ invoice });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
