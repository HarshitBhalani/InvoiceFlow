const router = require("express").Router();
const mongoose = require("mongoose");
const { z } = require("zod");
const Expense = require("../models/Expense");
const { CATEGORIES } = require("../models/Expense");
const { requireAuth } = require("../middleware/auth");
const { escapeRegex, paginate } = require("../utils");

const schema = z.object({
  date: z.coerce
    .date({ error: "Enter a valid date" })
    .refine((d) => d.getFullYear() >= 2000 && d.getFullYear() <= 2100, "Enter a valid date"),
  description: z.string().trim().min(1, "Add a description").max(200, "Description is too long (max 200)"),
  vendor: z.string().trim().max(100, "Vendor name is too long").default(""),
  category: z.enum(CATEGORIES, { error: "Pick a category" }).default("other"),
  amount: z.coerce.number({ error: "Amount must be a number" }).min(0.01, "Amount must be greater than 0").max(100000000, "Amount is too large"),
});

const notFound = (res) => res.status(404).json({ error: "Expense not found" });

router.use(requireAuth);

function buildFilter(req) {
  const filter = { userId: req.user._id };
  if (CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(String(req.query.search).trim().slice(0, 100)), "i");
    filter.$or = [{ description: rx }, { vendor: rx }];
  }
  return filter;
}

router.get("/", async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = buildFilter(req);
    const [expenses, total, sum] = await Promise.all([
      Expense.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit),
      Expense.countDocuments(filter),
      Expense.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    ]);
    res.json({ expenses, total, page, pages: Math.max(Math.ceil(total / limit), 1), sum: sum[0]?.total || 0 });
  } catch (e) {
    next(e);
  }
});

const csvCell = (v) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // block spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get("/export", async (req, res, next) => {
  try {
    const expenses = await Expense.find({ userId: req.user._id }).sort({ date: -1 }).limit(5000);
    const rows = [["Date", "Description", "Vendor", "Category", "Currency", "Amount"]];
    for (const x of expenses) {
      rows.push([x.date.toISOString().slice(0, 10), x.description, x.vendor, x.category, req.user.currency || "USD", x.amount.toFixed(2)]);
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="expenses.csv"');
    res.send("﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const expense = await Expense.create({ ...schema.parse(req.body), userId: req.user._id });
    res.status(201).json({ expense });
  } catch (e) {
    next(e);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      schema.parse(req.body),
      { returnDocument: "after", runValidators: true }
    );
    if (!expense) return notFound(res);
    res.json({ expense });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!expense) return notFound(res);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
