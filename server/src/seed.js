// Demo data: npm run seed
// Creates an admin, a demo user with clients/invoices over 6 months, and sample users for the admin panel.
// Safe to re-run: it only removes its own seed accounts first.
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Client = require("./models/Client");
const Invoice = require("./models/Invoice");
const Subscription = require("./models/Subscription");

// The admin can ban users and see all accounts, so its password is never hard-coded.
// Set SEED_ADMIN_PASSWORD, or a random one is generated and printed once.
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || require("crypto").randomBytes(12).toString("base64url");
const ADMIN = { name: "Admin", email: "admin@invoiceflow.com", password: ADMIN_PASSWORD };
const DEMO = { name: "Demo User", email: "demo@invoiceflow.com", password: "demo1234" };
const SEED_DOMAIN = "@seed.invoiceflow.test";

const DAY = 864e5;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    throw new Error("Refusing to seed in production. Pass --force if you really mean it.");
  }
  await mongoose.connect(process.env.MONGO_URI);

  // Clean previous seed data only
  const old = await User.find({
    $or: [{ email: ADMIN.email }, { email: DEMO.email }, { email: new RegExp(`${SEED_DOMAIN.replace(/\./g, "\\.")}$`) }],
  }).select("_id");
  const ids = old.map((u) => u._id);
  await Promise.all([
    Invoice.deleteMany({ userId: { $in: ids } }),
    Client.deleteMany({ userId: { $in: ids } }),
    Subscription.deleteMany({ userId: { $in: ids } }),
    User.deleteMany({ _id: { $in: ids } }),
  ]);

  const hash = (p) => bcrypt.hash(p, 10);
  await User.create({ name: ADMIN.name, email: ADMIN.email, passwordHash: await hash(ADMIN.password), role: "admin", plan: "pro", createdAt: daysAgo(180) });

  // Demo user: Pro plan so the invoice limit does not get in the way of a live demo
  const demo = await User.create({ name: DEMO.name, email: DEMO.email, passwordHash: await hash(DEMO.password), plan: "pro", createdAt: daysAgo(170) });
  const companies = [["Acme Corp", "billing@acme.test"], ["Globex", "ap@globex.test"], ["Initech", "pay@initech.test"], ["Umbrella Ltd", "finance@umbrella.test"], ["Stark Labs", "accounts@stark.test"]];
  const clients = await Client.insertMany(
    companies.map(([company, email]) => ({ userId: demo._id, name: company.split(" ")[0] + " Team", email, company }))
  );

  const services = ["Website design", "Monthly retainer", "API integration", "Consulting (hours)", "Logo & branding", "SEO audit"];
  let number = 1;
  const invoices = [];
  for (let monthsBack = 5; monthsBack >= 0; monthsBack--) {
    for (let k = 0; k < rand(3, 5); k++) {
      const created = daysAgo(monthsBack * 30 + rand(1, 25));
      const due = new Date(created.getTime() + 14 * DAY);
      const items = Array.from({ length: rand(1, 3) }, () => ({ description: pick(services), quantity: rand(1, 4), unitPrice: rand(5, 40) * 25 }));
      const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      // Older invoices are mostly paid; recent ones are a mix
      const status = monthsBack >= 2 ? pick(["paid", "paid", "paid", "overdue"]) : pick(["paid", "sent", "sent", "draft", "overdue"]);
      invoices.push({
        userId: demo._id, clientId: pick(clients)._id, number: number++, items, currency: "USD", subtotal: total, taxAmount: 0, total, status, dueDate: due,
        createdAt: created, ...(status === "paid" ? { paidAt: new Date(created.getTime() + rand(2, 12) * DAY) } : {}),
      });
    }
  }
  await Invoice.insertMany(invoices);

  // Sample users spread over 6 months for the admin panel charts
  const names = ["Alice Johnson", "Bob Smith", "Carla Gomez", "Dev Patel", "Emma Brown", "Farid Khan", "Grace Lee", "Hiro Tanaka", "Ivy Chen", "Jack Wilson", "Kara Novak", "Liam Murphy", "Maya Rossi", "Noah Kim", "Olivia Park"];
  const sampleHash = await hash("sample1234");
  await User.insertMany(
    names.map((name, i) => ({
      name,
      email: `${name.toLowerCase().replace(" ", ".")}${SEED_DOMAIN}`,
      passwordHash: sampleHash,
      plan: i % 3 === 0 ? "pro" : "free",
      banned: i === 7,
      createdAt: daysAgo(rand(1, 170)),
    }))
  );

  console.log("Seeded.\n  Admin: %s / %s\n  Demo:  %s / %s", ADMIN.email, ADMIN.password, DEMO.email, DEMO.password);
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
