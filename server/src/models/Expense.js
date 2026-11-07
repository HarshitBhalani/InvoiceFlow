const mongoose = require("mongoose");

const CATEGORIES = ["software", "travel", "office", "marketing", "contractors", "taxes", "other"];

const expenseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true },
    description: { type: String, required: true, trim: true },
    vendor: { type: String, trim: true, default: "" },
    category: { type: String, enum: CATEGORIES, default: "other" },
    amount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

expenseSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model("Expense", expenseSchema);
module.exports.CATEGORIES = CATEGORIES;
