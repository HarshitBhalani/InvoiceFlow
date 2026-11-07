const router = require("express").Router();
const Invoice = require("../models/Invoice");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);

const MONTHS = 6;
const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

router.get("/stats", async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1));

    const [byStatus, monthly] = await Promise.all([
      // Totals per *effective* status: a "sent" invoice past its due date counts as overdue
      Invoice.aggregate([
        { $match: { userId } },
        {
          $addFields: {
            effectiveStatus: {
              $cond: [
                { $and: [{ $eq: ["$status", "sent"] }, { $lt: ["$dueDate", now] }] },
                "overdue",
                "$status",
              ],
            },
          },
        },
        { $group: { _id: "$effectiveStatus", count: { $sum: 1 }, amount: { $sum: "$total" } } },
      ]),
      // Paid revenue per month (falls back to createdAt for older invoices without paidAt)
      Invoice.aggregate([
        { $match: { userId, status: "paid" } },
        { $addFields: { paidDate: { $ifNull: ["$paidAt", "$createdAt"] } } },
        { $match: { paidDate: { $gte: start } } },
        {
          $group: {
            _id: { y: { $year: "$paidDate" }, m: { $month: "$paidDate" } },
            revenue: { $sum: "$total" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const statuses = { draft: { count: 0, amount: 0 }, sent: { count: 0, amount: 0 }, paid: { count: 0, amount: 0 }, overdue: { count: 0, amount: 0 } };
    for (const s of byStatus) if (statuses[s._id]) statuses[s._id] = { count: s.count, amount: s.amount };

    // Fill months with no revenue so the chart line is continuous
    const found = new Map(monthly.map((m) => [`${m._id.y}-${String(m._id.m).padStart(2, "0")}`, m.revenue]));
    const revenueByMonth = [];
    for (let i = 0; i < MONTHS; i++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
      revenueByMonth.push({
        month: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
        revenue: Math.round((found.get(monthKey(d)) || 0) * 100) / 100,
      });
    }

    const totalCount = Object.values(statuses).reduce((s, v) => s + v.count, 0);
    res.json({
      totals: {
        revenue: statuses.paid.amount,
        pending: statuses.sent.amount,
        overdue: statuses.overdue.amount,
        paidCount: statuses.paid.count,
        invoiceCount: totalCount,
      },
      statusSplit: Object.entries(statuses).map(([status, v]) => ({ status, count: v.count })),
      revenueByMonth,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
