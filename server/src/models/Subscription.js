const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    stripeSubId: { type: String, required: true, unique: true },
    status: { type: String, required: true }, // active, trialing, past_due, canceled, ...
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
