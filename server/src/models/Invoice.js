const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    number: { type: Number, required: true },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    total: { type: Number, required: true },
    status: { type: String, enum: ["draft", "sent", "paid", "overdue"], default: "draft" },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date }, // set when status becomes "paid"; drives the revenue chart
  },
  { timestamps: true }
);

invoiceSchema.index({ userId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("Invoice", invoiceSchema);
