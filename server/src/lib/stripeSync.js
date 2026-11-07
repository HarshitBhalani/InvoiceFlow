// Turning Stripe state into app state. Used by the webhook AND by the "confirm after redirect" endpoints,
// so a late, failed or missing webhook never leaves a paying customer stuck on the Free plan.
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const { stripeMode } = require("../config/stripeMode");

const ACTIVE = ["active", "trialing"];

// Newer Stripe API versions moved current_period_end onto the subscription item
const periodEnd = (sub) => {
  const ts = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;
  return ts ? new Date(ts * 1000) : undefined;
};

async function findUser(sub) {
  if (sub.metadata?.userId) {
    const u = await User.findById(sub.metadata.userId);
    if (u) return u;
  }
  return User.findOne({ stripeCustomerId: sub.customer });
}

// Single source of truth: mirror Stripe subscription state into our DB + user.plan. Safe to run many times.
async function syncSubscription(sub) {
  const user = await findUser(sub);
  if (!user) {
    console.warn("Stripe sync: no user for subscription", sub.id);
    return null;
  }

  await Subscription.findOneAndUpdate(
    { userId: user._id },
    {
      stripeSubId: sub.id,
      status: sub.status,
      currentPeriodEnd: periodEnd(sub),
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    },
    { upsert: true, returnDocument: "after" }
  );
  user.plan = ACTIVE.includes(sub.status) ? "pro" : "free";
  await user.save();
  return user;
}

// A client paid an invoice through its public link. Only marks it paid if Stripe says paid AND the amount matches.
async function markInvoicePaid(session) {
  if (session.payment_status !== "paid") return false; // e.g. delayed payment methods: wait for the paid event
  if (typeof session.livemode === "boolean" && session.livemode !== (stripeMode() === "live")) {
    console.warn("Stripe sync: ignored a payment session from the other Stripe mode");
    return false;
  }
  const invoice = await Invoice.findById(session.metadata?.invoiceId);
  if (!invoice) {
    console.warn("Stripe sync: invoice not found", session.metadata?.invoiceId);
    return false;
  }
  if (invoice.status === "paid") return true; // already handled (Stripe can deliver an event more than once)

  const expected = Math.round(invoice.total * 100);
  if (session.amount_total !== expected || String(session.currency).toLowerCase() !== (invoice.currency || "USD").toLowerCase()) {
    console.error(
      `Stripe sync: amount mismatch for invoice ${invoice._id} (got ${session.amount_total} ${session.currency}, expected ${expected})`
    );
    return false;
  }
  invoice.status = "paid";
  invoice.paidAt = new Date();
  await invoice.save();
  return true;
}

module.exports = { syncSubscription, markInvoicePaid, ACTIVE };
