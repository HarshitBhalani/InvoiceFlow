// Public (no login) endpoints used by the invoice link a client receives: /i/<token>
const router = require("express").Router();
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const Client = require("../models/Client");
const getStripe = require("../config/stripe");
const { clientUrl } = require("../lib/email");
const { markInvoicePaid } = require("../lib/stripeSync");
const { stripeMode } = require("../config/stripeMode");

const TOKEN_RE = /^[A-Za-z0-9_-]{10,64}$/;

async function loadByToken(token) {
  if (!TOKEN_RE.test(token)) return null;
  const invoice = await Invoice.findOne({ publicToken: token });
  if (!invoice) return null;
  const [client, seller] = await Promise.all([
    Client.findOne({ _id: invoice.clientId }),
    User.findById(invoice.userId).select("+logo"),
  ]);
  if (!seller || seller.banned) return null;
  return { invoice, client, seller };
}

// Only what the client needs to see. No internal ids, no seller account details beyond what is printed on the invoice.
router.get("/invoices/:token", async (req, res, next) => {
  try {
    const found = await loadByToken(req.params.token);
    if (!found) return res.status(404).json({ error: "This invoice link is not valid." });
    const { invoice, client, seller } = found;
    res.json({
      invoice: {
        number: invoice.number,
        currency: invoice.currency || "USD",
        items: invoice.items,
        subtotal: invoice.subtotal ?? invoice.total,
        taxRate: invoice.taxRate || 0,
        taxAmount: invoice.taxAmount || 0,
        total: invoice.total,
        status: invoice.isOverdue ? "overdue" : invoice.status,
        dueDate: invoice.dueDate,
        issuedAt: invoice.createdAt,
        paidAt: invoice.paidAt,
      },
      client: client ? { name: client.name, company: client.company, email: client.email } : null,
      seller: {
        name: seller.businessName || seller.name,
        contactName: seller.businessName ? seller.name : "",
        email: seller.email,
        address: seller.address,
        logo: seller.hasLogo ? seller.logo : "",
        accentColor: seller.accentColor || "#4f46e5",
        template: seller.template || "classic",
      },
      canPay: invoice.status !== "paid" && !!process.env.STRIPE_SECRET_KEY && invoice.total > 0,
      stripeMode: stripeMode(),
    });
  } catch (e) {
    next(e);
  }
});

// Creates a Stripe Checkout page for this invoice. The webhook (webhooks/stripe.js) marks it paid.
router.post("/invoices/:token/pay", async (req, res, next) => {
  try {
    const found = await loadByToken(req.params.token);
    if (!found) return res.status(404).json({ error: "This invoice link is not valid." });
    const { invoice, client, seller } = found;
    if (invoice.status === "paid") return res.status(400).json({ error: "This invoice is already paid." });
    if (!(invoice.total > 0)) return res.status(400).json({ error: "Nothing to pay on this invoice." });

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: client?.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (invoice.currency || "USD").toLowerCase(),
            unit_amount: Math.round(invoice.total * 100),
            product_data: { name: `Invoice #${invoice.number} from ${seller.businessName || seller.name}` },
          },
        },
      ],
      metadata: { invoiceId: String(invoice._id) },
      payment_intent_data: { metadata: { invoiceId: String(invoice._id) } },
      success_url: `${clientUrl()}/i/${invoice.publicToken}?paid=1`,
      cancel_url: `${clientUrl()}/i/${invoice.publicToken}`,
    });
    // Remember the session so /confirm can ask Stripe about it later (keep only the latest few)
    invoice.checkoutSessionIds = [...(invoice.checkoutSessionIds || []), session.id].slice(-5);
    await invoice.save();
    res.json({ url: session.url });
  } catch (e) {
    next(e);
  }
});

// Called by the invoice page after the client returns from Stripe. Asks Stripe directly whether the payment
// went through, so the invoice is marked paid even if the webhook is late or not running.
// The amount and currency are still verified, and only sessions this server created for this invoice are checked.
router.post("/invoices/:token/confirm", async (req, res, next) => {
  try {
    const found = await loadByToken(req.params.token);
    if (!found) return res.status(404).json({ error: "This invoice link is not valid." });
    const { invoice } = found;
    if (invoice.status !== "paid" && process.env.STRIPE_SECRET_KEY) {
      for (const id of [...(invoice.checkoutSessionIds || [])].reverse()) {
        const session = await getStripe().checkout.sessions.retrieve(id);
        if (String(session.metadata?.invoiceId) !== String(invoice._id)) continue;
        if (await markInvoicePaid(session)) break;
      }
    }
    const fresh = await Invoice.findById(invoice._id).select("status");
    res.json({ status: fresh.status });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
