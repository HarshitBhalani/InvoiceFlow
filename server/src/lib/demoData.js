// "Try the demo account": every click creates a private, temporary workspace with sample data.
//  - Nothing is shared between visitors and there is no shared password (nobody can log in to a demo user normally).
//  - It is deleted after 24 hours.
//  - Emails, payment links, recurring billing and Stripe are switched off for demo users (see blockDemo).
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Client = require("../models/Client");
const Invoice = require("../models/Invoice");
const Expense = require("../models/Expense");
const Subscription = require("../models/Subscription");
const { calcTotals } = require("./invoiceService");

const DAY = 864e5;
const DEMO_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_DEMOS = 300; // keeps a flood of demo clicks from filling the database

const daysAgo = (n) => new Date(Date.now() - n * DAY);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const COMPANIES = [
  ["Acme Corp", "billing@acme.example"],
  ["Globex", "ap@globex.example"],
  ["Initech", "pay@initech.example"],
  ["Umbrella Ltd", "finance@umbrella.example"],
  ["Stark Labs", "accounts@stark.example"],
];
const SERVICES = ["Website design", "Monthly retainer", "API integration", "Consulting (hours)", "Logo and branding", "SEO audit"];
const EXPENSES = [
  ["Figma subscription", "Figma", "software", 15],
  ["Hosting", "Vercel", "software", 20],
  ["Flight to client meeting", "Airline", "travel", 240],
  ["Co-working desk", "WorkSpace", "office", 120],
  ["Facebook ads", "Meta", "marketing", 180],
  ["Freelance designer", "Jane D.", "contractors", 400],
  ["Accounting software", "QuickLedger", "software", 30],
];

async function createDemoWorkspace() {
  const id = crypto.randomBytes(6).toString("hex");
  // A random password nobody knows: demo users can only be entered through POST /auth/demo
  const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 4);

  const user = await User.create({
    name: "Demo User",
    email: `demo-${id}@demo.invoiceflow.invalid`, // .invalid can never be a real address
    passwordHash,
    plan: "pro", // so every feature can be explored
    emailVerified: true,
    isDemo: true,
    demoExpiresAt: new Date(Date.now() + DEMO_TTL_MS),
    businessName: "Demo Studio",
    address: "12 Sample Street\nExample City",
  });

  const clients = await Client.insertMany(
    COMPANIES.map(([company, email]) => ({ userId: user._id, name: `${company.split(" ")[0]} Team`, email, company }))
  );

  let number = 1;
  const invoices = [];
  for (let monthsBack = 5; monthsBack >= 0; monthsBack--) {
    for (let k = 0; k < rand(3, 5); k++) {
      const created = daysAgo(monthsBack * 30 + rand(1, 25));
      const items = Array.from({ length: rand(1, 3) }, () => ({
        description: pick(SERVICES),
        quantity: rand(1, 4),
        unitPrice: rand(5, 40) * 25,
      }));
      const taxRate = pick([0, 0, 10]);
      // Older invoices are mostly paid; recent ones are a mix, so every status and chart has something to show
      const status = monthsBack >= 2 ? pick(["paid", "paid", "paid", "overdue"]) : pick(["paid", "sent", "sent", "draft", "overdue"]);
      invoices.push({
        userId: user._id,
        clientId: pick(clients)._id,
        number: number++,
        items,
        currency: "USD",
        taxRate,
        ...calcTotals(items, taxRate),
        status,
        dueDate: new Date(created.getTime() + 14 * DAY),
        createdAt: created,
        ...(status === "paid" ? { paidAt: new Date(created.getTime() + rand(2, 12) * DAY) } : {}),
      });
    }
  }
  await Invoice.insertMany(invoices);

  await Expense.insertMany(
    EXPENSES.flatMap(([description, vendor, category, amount], i) =>
      [rand(1, 20), rand(40, 80), rand(100, 160)].slice(0, i % 3 === 0 ? 3 : 2).map((d) => ({
        userId: user._id,
        date: daysAgo(d),
        description,
        vendor,
        category,
        amount,
      }))
    )
  );

  return user;
}

// Removes expired demo workspaces together with everything they own
async function deleteExpiredDemos(now = new Date()) {
  const expired = await User.find({ isDemo: true, demoExpiresAt: { $lt: now } }).select("_id").limit(200);
  if (!expired.length) return 0;
  const ids = expired.map((u) => u._id);
  await Promise.all([
    Invoice.deleteMany({ userId: { $in: ids } }),
    Client.deleteMany({ userId: { $in: ids } }),
    Expense.deleteMany({ userId: { $in: ids } }),
    Subscription.deleteMany({ userId: { $in: ids } }),
  ]);
  await User.deleteMany({ _id: { $in: ids }, isDemo: true });
  return ids.length;
}

module.exports = { createDemoWorkspace, deleteExpiredDemos, MAX_ACTIVE_DEMOS, DEMO_TTL_MS };
