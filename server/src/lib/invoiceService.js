const Invoice = require("../models/Invoice");
const { randomId } = require("./tokens");

const round2 = (n) => Math.round(n * 100) / 100;

// subtotal + tax = total, always computed on the server
function calcTotals(items, taxRate = 0) {
  const subtotal = round2(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const taxAmount = round2((subtotal * (Number(taxRate) || 0)) / 100);
  return { subtotal, taxAmount, total: round2(subtotal + taxAmount) };
}

// Invoice numbers are per-user and sequential. The unique index guards races; retry on collision.
async function createInvoice(userId, data) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await Invoice.findOne({ userId }).sort({ number: -1 }).select("number");
    try {
      return await Invoice.create({ ...data, userId, number: (last?.number || 0) + 1 });
    } catch (err) {
      if (err.code !== 11000 || attempt === 2) throw err;
    }
  }
}

// Gives the invoice its public pay-link token the first time it is needed
async function ensurePublicToken(invoice) {
  if (invoice.publicToken) return invoice.publicToken;
  for (let i = 0; i < 3; i++) {
    try {
      invoice.publicToken = randomId();
      await invoice.save();
      return invoice.publicToken;
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }
  throw new Error("Could not create invoice link");
}

function addInterval(date, frequency) {
  const d = new Date(date);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

const formatMoney = (n, currency = "USD", display = "symbol") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: display }).format(n || 0);

module.exports = { calcTotals, createInvoice, ensurePublicToken, addInterval, formatMoney, round2 };
