const Stripe = require("stripe");

// Created lazily so the server can still boot (auth, clients, invoices) before Stripe keys are added
let client;
module.exports = function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const err = new Error("Stripe is not configured");
    err.status = 503;
    throw err;
  }
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
};
