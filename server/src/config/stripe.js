const Stripe = require("stripe");
const { assertStripeModeAllowed } = require("./stripeMode");

// Created lazily so the server can still boot (auth, clients, invoices) before Stripe keys are added
let client;
module.exports = function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const err = new Error("Stripe is not configured");
    err.status = 503;
    throw err;
  }
  if (!client) {
    assertStripeModeAllowed(); // second line of defence: even if startup checks were skipped, a disallowed key is never used
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
};
