const router = require("express").Router();
const getStripe = require("../config/stripe");
const Invoice = require("../models/Invoice");
const Subscription = require("../models/Subscription");
const { requireAuth } = require("../middleware/auth");
const { FREE_LIMIT } = require("../middleware/planLimit");

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
