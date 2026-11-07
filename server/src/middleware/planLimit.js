const Invoice = require("../models/Invoice");

const FREE_LIMIT = () => parseInt(process.env.FREE_INVOICE_LIMIT) || 5;

// Blocks free users from creating more than FREE_INVOICE_LIMIT invoices
exports.invoiceLimit = async (req, res, next) => {
  try {
    if (req.user.plan === "pro") return next();
    const count = await Invoice.countDocuments({ userId: req.user._id });
    if (count >= FREE_LIMIT()) {
      return res.status(403).json({
        error: `Free plan limit reached (${FREE_LIMIT()} invoices). Upgrade to Pro for unlimited invoices.`,
        code: "PLAN_LIMIT",
      });
    }
    next();
  } catch (e) {
    next(e);
  }
};

exports.FREE_LIMIT = FREE_LIMIT;
