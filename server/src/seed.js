// npm run seed                       admin account + sample users (so the admin charts have something to show)
// npm run seed -- --admin-only        just the admin account (use this on a real production database)
//
// "Try the demo account" does NOT need this script: it creates its own temporary workspace (lib/demoData.js).
// Safe to re-run: it only removes its own seed accounts first.
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Client = require("./models/Client");
const Invoice = require("./models/Invoice");
const Expense = require("./models/Expense");
const Subscription = require("./models/Subscription");

// The admin can ban users and see all accounts, so its password is never hard-coded.
// Set SEED_ADMIN_PASSWORD, or a random one is generated and printed once.
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || require("crypto").randomBytes(12).toString("base64url");
const ADMIN = { name: "Admin", email: "admin@invoiceflow.com", password: ADMIN_PASSWORD };
const LEGACY_DEMO_EMAIL = "demo@invoiceflow.com"; // older versions created this account with a public password: remove it
const SEED_DOMAIN = "@seed.invoiceflow.test";

const DAY = 864e5;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    throw new Error("Refusing to seed in production. Pass --force if you really mean it.");
  }
  const adminOnly = process.argv.includes("--admin-only");
  await mongoose.connect(process.env.MONGO_URI);

  // Clean previous seed data only
  const old = await User.find({
    $or: [{ email: ADMIN.email }, { email: LEGACY_DEMO_EMAIL }, { email: new RegExp(`${SEED_DOMAIN.replace(/\./g, "\\.")}$`) }],
  }).select("_id");
  const ids = old.map((u) => u._id);
  await Promise.all([
    Invoice.deleteMany({ userId: { $in: ids } }),
    Client.deleteMany({ userId: { $in: ids } }),
    Expense.deleteMany({ userId: { $in: ids } }),
    Subscription.deleteMany({ userId: { $in: ids } }),
    User.deleteMany({ _id: { $in: ids } }),
  ]);

  const hash = (p) => bcrypt.hash(p, 10);
  await User.create({ name: ADMIN.name, email: ADMIN.email, passwordHash: await hash(ADMIN.password), role: "admin", plan: "pro", createdAt: daysAgo(180) });

  if (!adminOnly) {
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
  }

  console.log("Seeded.\n  Admin: %s / %s%s", ADMIN.email, ADMIN.password, adminOnly ? "\n  (admin only)" : "\n  + 15 sample users for the admin panel");
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
