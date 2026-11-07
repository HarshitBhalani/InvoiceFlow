const getStripe = require("../config/stripe");
const User = require("../models/User");
const Subscription = require("../models/Subscription");

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

// Single source of truth: mirror Stripe subscription state into our DB + user.plan
async function syncSubscription(sub) {
  const user = await findUser(sub);
  if (!user) return console.warn("Stripe webhook: no user for subscription", sub.id);

  await Subscription.findOneAndUpdate(
    { userId: user._id },
    {
      stripeSubId: sub.id,
      status: sub.status,
      currentPeriodEnd: periodEnd(sub),
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    },
    { upsert: true, new: true }
  );
  user.plan = ACTIVE.includes(sub.status) ? "pro" : "free";
  await user.save();
}

module.exports = async function stripeWebhook(req, res) {
  let event;
  try {
    // req.body is a raw Buffer here (express.raw), which signature verification requires
    event = getStripe().webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send("Webhook Error: invalid signature");
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const sub = await getStripe().subscriptions.retrieve(session.subscription);
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler failed:", err);
    res.status(500).send("Webhook handler error"); // Stripe will retry
  }
};
