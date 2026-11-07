// Email sending through Resend (https://resend.com). No SDK needed, just fetch.
// Without RESEND_API_KEY, emails are printed to the console in development so flows can still be tested.

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const configured = () => !!process.env.RESEND_API_KEY;

// "Jane's Studio via InvoiceFlow <noreply@yourdomain.com>": shows who the invoice is really from.
// Header-unsafe characters are stripped so a business name cannot inject extra headers.
function fromAddress(displayName) {
  const base = process.env.EMAIL_FROM || "InvoiceFlow <onboarding@resend.dev>";
  const address = (base.match(/<([^>]+)>/) || [null, base])[1].trim();
  if (!displayName) return base;
  const safe = displayName.replace(/[<>"\r\n,;]/g, "").trim().slice(0, 60);
  return safe ? `${safe} via InvoiceFlow <${address}>` : base;
}

async function sendEmail({ to, subject, html, text, replyTo, fromName }) {
  const from = fromAddress(fromName);

  if (!configured()) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error("Email is not configured");
      err.status = 503;
      throw err;
    }
    console.log(`\n[email:dev] to=${to}\n  subject: ${subject}\n  ${text}\n`);
    return { skipped: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Resend error:", res.status, body);
    const err = new Error("Could not send email. Please try again.");
    err.status = 502;
    throw err;
  }
  return { sent: true };
}

// Simple, client-safe HTML wrapper. All dynamic values must go through esc() before reaching here.
function layout({ title, bodyHtml, button, footer }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:520px;background:#fff;border-radius:12px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#334155">${bodyHtml}</div>
${button ? `<p style="margin:28px 0"><a href="${esc(button.url)}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;display:inline-block">${esc(button.label)}</a></p>` : ""}
${footer ? `<p style="font-size:12px;color:#94a3b8;margin-top:24px">${footer}</p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

const clientUrl = () => (process.env.CLIENT_URL || "").replace(/\/$/, "");

module.exports = { sendEmail, layout, esc, configured, clientUrl };
