const getStripe = require("../config/stripe");
const { syncSubscription, markInvoicePaid } = require("../lib/stripeSync");

async function stripeWebhook(req, res) {
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
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const sub = await getStripe().subscriptions.retrieve(session.subscription);
          await syncSubscription(sub);
        } else if (session.mode === "payment" && session.metadata?.invoiceId) {
          await markInvoicePaid(session);
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
}

module.exports = stripeWebhook;
module.exports.markInvoicePaid = markInvoicePaid;
module.exports.syncSubscription = syncSubscription;
