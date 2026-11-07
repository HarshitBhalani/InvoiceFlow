const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"];

const invoiceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    number: { type: Number, required: true },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    currency: { type: String, default: "USD" },
    taxRate: { type: Number, min: 0, max: 100, default: 0 }, // percent
    subtotal: { type: Number },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, required: true }, // subtotal + tax
    status: { type: String, enum: ["draft", "sent", "paid", "overdue"], default: "draft" },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date }, // set when status becomes "paid"; drives the revenue chart

    // Public pay link: /i/<publicToken>. Random, unguessable, created on first send.
    publicToken: { type: String, index: { unique: true, sparse: true } },
    sentAt: Date,
    checkoutSessionIds: { type: [String], default: [] }, // latest Stripe sessions, so the paid status can be confirmed without a webhook

    // Payment reminders
    reminderCount: { type: Number, default: 0 },
    lastReminderAt: Date,

    // Recurring billing: this invoice acts as the template for future copies
    recurring: {
      active: { type: Boolean, default: false },
      frequency: { type: String, enum: FREQUENCIES },
      nextRun: Date,
      autoSend: { type: Boolean, default: false },
    },
    recurringParentId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

invoiceSchema.index({ userId: 1, number: 1 }, { unique: true });
invoiceSchema.index({ "recurring.active": 1, "recurring.nextRun": 1 });

// A "sent" invoice past its due date is overdue even if nobody changed its status.
// The UI shows this, and the dashboard totals use the same rule.
invoiceSchema.virtual("isOverdue").get(function () {
  return this.status === "overdue" || (this.status === "sent" && this.dueDate < new Date());
});

module.exports = mongoose.model("Invoice", invoiceSchema);
module.exports.FREQUENCIES = FREQUENCIES;
