const router = require("express").Router();
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const Client = require("../models/Client");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const { FREQUENCIES } = require("../models/Invoice");
const { requireAuth, blockDemo } = require("../middleware/auth");
const { invoiceLimit } = require("../middleware/planLimit");
const { paginate, escapeRegex } = require("../utils");
const { calcTotals, createInvoice, ensurePublicToken, addInterval } = require("../lib/invoiceService");
const { emailInvoice } = require("../lib/invoiceMail");
const { renderInvoicePdf } = require("../lib/pdf");
const { clientUrl } = require("../lib/email");

const STATUSES = ["draft", "sent", "paid", "overdue"];

const dueDate = z.coerce
  .date({ error: "Enter a valid due date" })
  .refine((d) => d.getFullYear() >= 2000 && d.getFullYear() <= 2100, "Enter a valid due date");

const schema = z.object({
  clientId: z.string().refine((v) => mongoose.isValidObjectId(v), "Select a client"),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1, "Every line item needs a description").max(200, "Description is too long (max 200)"),
        quantity: z.coerce
          .number({ error: "Quantity must be a number" })
          .int("Quantity must be a whole number")
          .min(1, "Quantity must be at least 1")
          .max(100000, "Quantity is too large"),
        unitPrice: z.coerce
          .number({ error: "Price must be a number" })
          .min(0, "Price cannot be negative")
          .max(10000000, "Price is too large"),
      })
    )
    .min(1, "Add at least one line item")
    .max(50, "An invoice can have at most 50 line items"),
  taxRate: z.coerce
    .number({ error: "Tax rate must be a number" })
    .min(0, "Tax rate cannot be negative")
    .max(100, "Tax rate cannot exceed 100%")
    .default(0),
  status: z.enum(STATUSES, { error: "Invalid status" }).optional(),
  dueDate,
});

// paidAt follows status: set when paid, cleared otherwise
const paidFields = (status) => (status === "paid" ? { paidAt: new Date() } : { paidAt: null });

const notFound = (res) => res.status(404).json({ error: "Invoice not found" });
const validId = (id) => mongoose.isValidObjectId(id);

// Same rule as the dashboard: a "sent" invoice past its due date counts as overdue
function statusFilter(status) {
  const now = new Date();
  switch (status) {
    case "overdue":
      return { $or: [{ status: "overdue" }, { status: "sent", dueDate: { $lt: now } }] };
    case "sent":
      return { status: "sent", dueDate: { $gte: now } };
    case "draft":
    case "paid":
      return { status };
    default:
      return null;
  }
}

router.use(requireAuth);

// Emailing is rate limited per user so the app cannot be used to spam strangers
const sendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => String(req.user._id),
  validate: { keyGeneratorIpFallback: false },
  message: { error: "You have sent a lot of emails. Please try again later." },
});

router.get("/", async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const conditions = [{ userId: req.user._id }];

    const sf = statusFilter(req.query.status);
    if (sf) conditions.push(sf);

    if (req.query.search) {
      const term = String(req.query.search).trim().slice(0, 100);
      const clients = await Client.find({
        userId: req.user._id,
        name: new RegExp(escapeRegex(term), "i"),
      }).select("_id");
      const or = [{ clientId: { $in: clients.map((c) => c._id) } }];
      const n = Number(term.replace(/^#/, ""));
      if (Number.isInteger(n)) or.push({ number: n });
      conditions.push({ $or: or });
    }

    const filter = { $and: conditions };
    const [invoices, total] = await Promise.all([
      Invoice.find(filter).populate("clientId", "name email").sort({ createdAt: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(filter),
    ]);
    res.json({ invoices, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
  } catch (e) {
    next(e);
  }
});

// CSV export of all the user's invoices.
// Cells starting with = + - @ get a leading quote so spreadsheets cannot run them as formulas.
const csvCell = (v) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get("/export", async (req, res, next) => {
  try {
    const invoices = await Invoice.find({ userId: req.user._id })
      .populate("clientId", "name email")
      .sort({ number: 1 })
      .limit(5000);
    const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
    const rows = [["Invoice #", "Client", "Client email", "Status", "Issued", "Due", "Paid on", "Currency", "Subtotal", "Tax", "Total"]];
    for (const i of invoices) {
      rows.push([
        i.number,
        i.clientId?.name || "Deleted client",
        i.clientId?.email || "",
        i.isOverdue ? "overdue" : i.status,
        day(i.createdAt),
        day(i.dueDate),
        day(i.paidAt),
        i.currency || "USD",
        (i.subtotal ?? i.total).toFixed(2),
        (i.taxAmount || 0).toFixed(2),
        i.total.toFixed(2),
      ]);
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="invoices.csv"');
    res.send("﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return notFound(res);
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user._id }).populate(
      "clientId",
      "name email company"
    );
    if (!invoice) return notFound(res);
    res.json({ invoice });
  } catch (e) {
    next(e);
  }
});

// PDF generation uses CPU, so one user cannot render hundreds a minute
const pdfLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => String(req.user._id),
  validate: { keyGeneratorIpFallback: false },
  message: { error: "Too many PDF downloads. Please wait a moment." },
});

router.get("/:id/pdf", pdfLimiter, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return notFound(res);
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user._id });
    if (!invoice) return notFound(res);
    const [client, seller] = await Promise.all([
      Client.findOne({ _id: invoice.clientId, userId: req.user._id }),
      User.findById(req.user._id).select("+logo"),
    ]);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${invoice.number}.pdf"`);
    renderInvoicePdf(res, { invoice, client, seller, logo: seller.logo });
  } catch (e) {
    next(e);
  }
});

router.post("/", invoiceLimit, async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    const client = await Client.findOne({ _id: data.clientId, userId: req.user._id });
    if (!client) return res.status(400).json({ error: "Selected client no longer exists" });

    const invoice = await createInvoice(req.user._id, {
      ...data,
      currency: req.user.currency || "USD",
      ...calcTotals(data.items, data.taxRate),
      ...(data.status === "paid" ? paidFields("paid") : {}),
    });
    res.status(201).json({ invoice });
  } catch (e) {
    next(e);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return notFound(res);
    const data = schema.parse(req.body);
    const client = await Client.findOne({ _id: data.clientId, userId: req.user._id });
    if (!client) return res.status(400).json({ error: "Selected client no longer exists" });
    const existing = await Invoice.findOne({ _id: req.params.id, userId: req.user._id }).select("status");
    if (!existing) return notFound(res);
    const nextStatus = data.status || existing.status;
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { ...data, ...calcTotals(data.items, data.taxRate), ...(nextStatus !== existing.status ? paidFields(nextStatus) : {}) },
      { returnDocument: "after", runValidators: true }
    );
    if (!invoice) return notFound(res);
    res.json({ invoice });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return notFound(res);
    const { status } = z.object({ status: z.enum(STATUSES, { error: "Invalid status" }) }).parse(req.body);
    const existing = await Invoice.findOne({ _id: req.params.id, userId: req.user._id }).select("status");
    if (!existing) return notFound(res);
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status, ...(status !== existing.status ? paidFields(status) : {}) },
      { returnDocument: "after" }
    );
    if (!invoice) return notFound(res);
    res.json({ invoice });
  } catch (e) {
    next(e);
  }
});

// Email the invoice to the client with a public link where they can view and pay it
router.post("/:id/send", blockDemo("Emailing invoices"), sendLimiter, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return notFound(res);
    const { message } = z.object({ message: z.string().trim().max(1000, "Message is too long (max 1000 characters)").default("") }).parse(req.body ?? {});
    if (req.user.emailVerified === false) {
      return res.status(403).json({ error: "Verify your email address before sending invoices.", code: "EMAIL_UNVERIFIED" });
    }
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user._id });
    if (!invoice) return notFound(res);
    if (invoice.status === "paid") return res.status(400).json({ error: "This invoice is already paid" });
    const client = await Client.findOne({ _id: invoice.clientId, userId: req.user._id });
    if (!client) return res.status(400).json({ error: "This invoice's client no longer exists" });

    const url = await emailInvoice({ invoice, client, seller: req.user, message });
    if (invoice.status === "draft") invoice.status = "sent";
    invoice.sentAt = new Date();
    await invoice.save();
    res.json({ invoice, url, sentTo: client.email });
  } catch (e) {
    next(e);
  }
});

// Just the shareable link (no email), for copy / WhatsApp / etc.
router.post("/:id/link", blockDemo("Shareable payment links"), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return notFound(res);
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user._id });
    if (!invoice) return notFound(res);
    const token = await ensurePublicToken(invoice);
    res.json({ url: `${clientUrl()}/i/${token}` });
  } catch (e) {
    next(e);
  }
});

// Recurring billing (Pro): this invoice becomes the template for future copies
router.put("/:id/recurring", blockDemo("Recurring invoices"), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return notFound(res);
    const body = z
      .object({
        frequency: z.enum(["none", ...FREQUENCIES], { error: "Choose how often to repeat" }),
        autoSend: z.boolean().default(false),
      })
      .parse(req.body);
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user._id });
    if (!invoice) return notFound(res);

    if (body.frequency === "none") {
      invoice.recurring = { active: false };
    } else {
      if (req.user.plan !== "pro") {
        return res.status(403).json({ error: "Recurring invoices are a Pro feature", code: "PLAN_LIMIT" });
      }
      invoice.recurring = {
        active: true,
        frequency: body.frequency,
        autoSend: body.autoSend,
        nextRun: addInterval(new Date(), body.frequency),
      };
    }
    await invoice.save();
    res.json({ invoice });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return notFound(res);
    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!invoice) return notFound(res);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
