const router = require("express").Router();
const getStripe = require("../config/stripe");
const Invoice = require("../models/Invoice");
const Subscription = require("../models/Subscription");
const { requireAuth } = require("../middleware/auth");
const { FREE_LIMIT } = require("../middleware/planLimit");
const { syncSubscription } = require("../lib/stripeSync");
const User = require("../models/User");

router.use(requireAuth);

async function ensureCustomer(user) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await getStripe().customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: String(user._id) },
  });
  user.stripeCustomerId = customer.id;
  await user.save();
  return customer.id;
}

router.get("/status", async (req, res, next) => {
  try {
    const [used, sub] = await Promise.all([
      Invoice.countDocuments({ userId: req.user._id }),
      Subscription.findOne({ userId: req.user._id }),
    ]);
    res.json({
      plan: req.user.plan,
      usage: { invoices: used, limit: req.user.plan === "pro" ? null : FREE_LIMIT() },
      subscription: sub && {
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      },
    });
  } catch (e) {
    next(e);
  }
});

// Asks Stripe directly what this user's subscription looks like and updates the plan.
// Called right after returning from Checkout (and by a "refresh" button), so the plan updates
// even if the webhook is late, failed, or not running (e.g. local development).
// Safe: it only reads the Stripe customer that belongs to the logged-in user.
router.post("/sync", async (req, res, next) => {
  try {
    if (req.user.stripeCustomerId) {
      const subs = await getStripe().subscriptions.list({ customer: req.user.stripeCustomerId, status: "all", limit: 10 });
      const best = subs.data.find((s) => ["active", "trialing"].includes(s.status)) || subs.data[0];
      if (best) await syncSubscription(best);
    }
    const fresh = await User.findById(req.user._id).select("plan");
    res.json({ plan: fresh.plan });
  } catch (e) {
    next(e);
  }
});

router.post("/checkout", async (req, res, next) => {
  try {
    if (req.user.plan === "pro") return res.status(400).json({ error: "You are already on Pro" });
    if (!process.env.STRIPE_PRO_PRICE_ID) return res.status(503).json({ error: "Stripe price is not configured" });

    const customer = await ensureCustomer(req.user);
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: String(req.user._id),
      line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
      subscription_data: { metadata: { userId: String(req.user._id) } },
      success_url: `${process.env.CLIENT_URL}/billing?success=1`,
      cancel_url: `${process.env.CLIENT_URL}/billing?canceled=1`,
    });
    res.json({ url: session.url });
  } catch (e) {
    next(e);
  }
});

// Stripe-hosted page to update card, cancel, view invoices
router.post("/portal", async (req, res, next) => {
  try {
    if (!req.user.stripeCustomerId) return res.status(400).json({ error: "No billing account yet" });
    const session = await getStripe().billingPortal.sessions.create({
      customer: req.user.stripeCustomerId,
      return_url: `${process.env.CLIENT_URL}/billing`,
    });
    res.json({ url: session.url });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
