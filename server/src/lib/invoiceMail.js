const { sendEmail, layout, esc, clientUrl } = require("./email");
const { ensurePublicToken, formatMoney } = require("./invoiceService");

const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });

// Sends the invoice (or a payment reminder) to the client with a link to the public invoice page.
// `invoice` must be a Mongoose document; `client` and `seller` are plain documents.
async function emailInvoice({ invoice, client, seller, message = "", kind = "invoice" }) {
  const token = await ensurePublicToken(invoice);
  const url = `${clientUrl()}/i/${token}`;
  const from = seller.businessName || seller.name;
  const amount = formatMoney(invoice.total, invoice.currency);
  const isReminder = kind === "reminder";

  const subject = isReminder
    ? `Reminder: invoice #${invoice.number} from ${from} is overdue`
    : `Invoice #${invoice.number} from ${from} (${amount})`;

  const note = message.trim()
    ? `<p style="white-space:pre-line;background:#f1f3f9;border-radius:8px;padding:12px">${esc(message.trim())}</p>`
    : "";

  const intro = isReminder
    ? `<p>Hi ${esc(client.name)}, this is a friendly reminder that invoice <b>#${invoice.number}</b> for <b>${esc(amount)}</b> was due on ${esc(fmtDate(invoice.dueDate))} and is still unpaid.</p>`
    : `<p>Hi ${esc(client.name)}, ${esc(from)} sent you invoice <b>#${invoice.number}</b> for <b>${esc(amount)}</b>, due on <b>${esc(fmtDate(invoice.dueDate))}</b>.</p>`;

  await sendEmail({
    to: client.email,
    subject,
    replyTo: seller.email,
    fromName: from,
    text: `${isReminder ? "Reminder: " : ""}Invoice #${invoice.number} from ${from}, ${amount}, due ${fmtDate(invoice.dueDate)}.\n${message.trim()}\nView and pay: ${url}`,
    html: layout({
      title: isReminder ? "Payment reminder" : `Invoice #${invoice.number}`,
      bodyHtml: intro + note,
      button: { label: "View invoice", url },
      footer: `Sent on behalf of ${esc(from)}. Reply to this email to contact them.`,
    }),
  });
  return url;
}

module.exports = { emailInvoice };
