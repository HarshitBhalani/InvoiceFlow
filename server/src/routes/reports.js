const router = require("express").Router();
const Invoice = require("../models/Invoice");
const Expense = require("../models/Expense");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);

const MONTHS = 12;
const round2 = (n) => Math.round(n * 100) / 100;
const key = (y, m) => `${y}-${String(m).padStart(2, "0")}`;

// Profit & loss for the last 12 months: paid invoices (revenue) minus expenses.
// Everything is in the account currency (invoices keep the currency they were created in).
router.get("/pnl", async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1));

    const [revenue, expenses, byCategory, outstanding] = await Promise.all([
      Invoice.aggregate([
        { $match: { userId, status: "paid" } },
        { $addFields: { paidDate: { $ifNull: ["$paidAt", "$createdAt"] } } },
        { $match: { paidDate: { $gte: start } } },
        { $group: { _id: { y: { $year: "$paidDate" }, m: { $month: "$paidDate" } }, amount: { $sum: "$total" }, tax: { $sum: { $ifNull: ["$taxAmount", 0] } } } },
      ]),
      Expense.aggregate([
        { $match: { userId, date: { $gte: start } } },
        { $group: { _id: { y: { $year: "$date" }, m: { $month: "$date" } }, amount: { $sum: "$amount" } } },
      ]),
      Expense.aggregate([
        { $match: { userId, date: { $gte: start } } },
        { $group: { _id: "$category", amount: { $sum: "$amount" } } },
        { $sort: { amount: -1 } },
      ]),
      Invoice.aggregate([
        { $match: { userId, status: { $in: ["sent", "overdue"] } } },
        { $group: { _id: null, amount: { $sum: "$total" } } },
      ]),
    ]);

    const rev = new Map(revenue.map((r) => [key(r._id.y, r._id.m), r]));
    const exp = new Map(expenses.map((r) => [key(r._id.y, r._id.m), r.amount]));
    const months = [];
    for (let i = 0; i < MONTHS; i++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
      const k = key(d.getUTCFullYear(), d.getUTCMonth() + 1);
      const revenueAmt = round2(rev.get(k)?.amount || 0);
      const expenseAmt = round2(exp.get(k) || 0);
      months.push({
        month: d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
        revenue: revenueAmt,
        expenses: expenseAmt,
        profit: round2(revenueAmt - expenseAmt),
      });
    }

    const totalRevenue = round2(months.reduce((s, m) => s + m.revenue, 0));
    const totalExpenses = round2(months.reduce((s, m) => s + m.expenses, 0));
    res.json({
      currency: req.user.currency || "USD",
      months,
      totals: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: round2(totalRevenue - totalExpenses),
        taxCollected: round2(revenue.reduce((s, r) => s + r.tax, 0)),
        outstanding: round2(outstanding[0]?.amount || 0),
      },
      byCategory: byCategory.map((c) => ({ category: c._id, amount: round2(c.amount) })),
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
