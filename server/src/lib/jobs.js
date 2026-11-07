// Background jobs: recurring invoices and payment reminders.
// Triggered hourly by an in-process timer AND by POST /api/cron/run (for hosts that sleep, e.g. Render free tier).
// Both jobs "claim" work with an atomic update first, so running twice (or on two servers) never double-sends.
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const Client = require("../models/Client");
const { createInvoice, addInterval, calcTotals } = require("./invoiceService");
const { emailInvoice } = require("./invoiceMail");

const DAY = 864e5;

async function runRecurring(now = new Date()) {
  const templates = await Invoice.find({ "recurring.active": true, "recurring.nextRun": { $lte: now } }).limit(200);
  let created = 0;

  for (const tpl of templates) {
    const user = await User.findById(tpl.userId);
    if (!user || user.banned || user.plan !== "pro") {
      // Recurring billing is a Pro feature: stop it if the user is gone or downgraded
      await Invoice.updateOne({ _id: tpl._id }, { $set: { "recurring.active": false } });
      continue;
    }

    // Move nextRun past "now" (skipping missed periods instead of flooding the client), claiming atomically
    let next = new Date(tpl.recurring.nextRun);
    while (next <= now) next = addInterval(next, tpl.recurring.frequency);
    const claimed = await Invoice.findOneAndUpdate(
      { _id: tpl._id, "recurring.active": true, "recurring.nextRun": tpl.recurring.nextRun },
      { $set: { "recurring.nextRun": next } }
    );
    if (!claimed) continue; // another run got it

    const client = await Client.findOne({ _id: tpl.clientId, userId: tpl.userId });
    if (!client) {
      await Invoice.updateOne({ _id: tpl._id }, { $set: { "recurring.active": false } });
      continue;
    }

    const offsetDays = Math.max(1, Math.round((tpl.dueDate - tpl.createdAt) / DAY));
    const items = tpl.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice }));
    const invoice = await createInvoice(tpl.userId, {
      clientId: tpl.clientId,
      items,
      currency: tpl.currency,
      taxRate: tpl.taxRate,
      ...calcTotals(items, tpl.taxRate),
      dueDate: new Date(now.getTime() + offsetDays * DAY),
      status: tpl.recurring.autoSend ? "sent" : "draft",
      sentAt: tpl.recurring.autoSend ? now : undefined,
      recurringParentId: tpl._id,
    });
    created++;

    if (tpl.recurring.autoSend && user.emailVerified !== false) {
      emailInvoice({ invoice, client, seller: user }).catch((e) =>
        console.error(`Recurring invoice #${invoice.number}: email failed:`, e.message)
      );
    }
  }
  return created;
}

const REMINDER_START_DAYS = 1; // first reminder the day after the due date
const REMINDER_EVERY_DAYS = 7;
const MAX_REMINDERS = 3;

async function runReminders(now = new Date()) {
  const users = await User.find({ autoReminders: true, plan: "pro", banned: { $ne: true } }).limit(1000);
  let sent = 0;

  for (const user of users) {
    if (user.emailVerified === false) continue;
    const candidates = await Invoice.find({
      userId: user._id,
      status: "sent",
      dueDate: { $lt: new Date(now.getTime() - REMINDER_START_DAYS * DAY) },
      reminderCount: { $lt: MAX_REMINDERS },
      $or: [{ lastReminderAt: null }, { lastReminderAt: { $lt: new Date(now.getTime() - REMINDER_EVERY_DAYS * DAY) } }],
    }).limit(50);

    for (const inv of candidates) {
      const client = await Client.findOne({ _id: inv.clientId, userId: user._id });
      if (!client) continue;
      const prev = { count: inv.reminderCount, at: inv.lastReminderAt };
      const claimed = await Invoice.findOneAndUpdate(
        { _id: inv._id, reminderCount: prev.count, status: "sent" },
        { $inc: { reminderCount: 1 }, $set: { lastReminderAt: now } }
      );
      if (!claimed) continue;
      try {
        await emailInvoice({ invoice: inv, client, seller: user, kind: "reminder" });
        sent++;
      } catch (e) {
        // Could not send: undo the claim so it is retried next run
        await Invoice.updateOne({ _id: inv._id }, { $set: { reminderCount: prev.count, lastReminderAt: prev.at ?? null } });
        console.error(`Reminder for invoice #${inv.number} failed:`, e.message);
      }
    }
  }
  return sent;
}

async function runAll() {
  const out = { recurringCreated: 0, remindersSent: 0 };
  try {
    out.recurringCreated = await runRecurring();
  } catch (e) {
    console.error("Recurring job failed:", e);
  }
  try {
    out.remindersSent = await runReminders();
  } catch (e) {
    console.error("Reminder job failed:", e);
  }
  return out;
}

function startInternalScheduler() {
  if (process.env.DISABLE_INTERNAL_JOBS === "true") return;
  setTimeout(runAll, 30_000);
  setInterval(runAll, 60 * 60 * 1000).unref();
}

module.exports = { runRecurring, runReminders, runAll, startInternalScheduler };
