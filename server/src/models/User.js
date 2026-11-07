const mongoose = require("mongoose");

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    plan: { type: String, enum: ["free", "pro"], default: "free" },
    stripeCustomerId: String,
    banned: { type: Boolean, default: false },

    // Business details shown on invoices
    businessName: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    logo: { type: String, default: "", select: false }, // small data URL; loaded only when needed
    hasLogo: { type: Boolean, default: false },
    accentColor: { type: String, default: "#4f46e5" },
    template: { type: String, enum: ["classic", "modern"], default: "classic" },

    // Invoicing defaults
    currency: { type: String, enum: CURRENCIES, default: "USD" },
    defaultTaxRate: { type: Number, min: 0, max: 100, default: 0 },
    autoReminders: { type: Boolean, default: false },

    // Email verification / password reset. Only hashes are stored, never the raw tokens.
    // Accounts created before verification existed have emailVerified undefined and count as verified.
    emailVerified: { type: Boolean }, // no default on purpose: signup sets false explicitly, legacy accounts stay undefined
    verifyTokenHash: { type: String, select: false },
    verifyExpires: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
    passwordChangedAt: Date, // tokens issued before this moment are rejected
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
module.exports.CURRENCIES = CURRENCIES;
