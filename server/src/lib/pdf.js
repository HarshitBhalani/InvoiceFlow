const PDFDocument = require("pdfkit");
const { formatMoney } = require("./invoiceService");

// PDFKit's built-in fonts only cover Latin-1, so replace anything else instead of printing garbage
const safe = (s) => String(s ?? "").replace(/[^\x20-\x7E -ÿ\n]/g, "?");
const day = (d) => new Date(d).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
// Currency code instead of symbol (Helvetica has no glyph for some symbols like the rupee sign)
const money = (n, c) => formatMoney(n, c, "code").replace(/ /g, " ");

function logoBuffer(dataUrl) {
  const m = /^data:image\/(?:png|jpeg);base64,(.+)$/.exec(dataUrl || "");
  return m ? Buffer.from(m[1], "base64") : null;
}

// Streams a PDF of the invoice to `stream` (e.g. an Express response).
function renderInvoicePdf(stream, { invoice, client, seller, logo }) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(seller.accentColor) ? seller.accentColor : "#4f46e5";
  const modern = seller.template === "modern";
  const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `Invoice ${invoice.number}` } });
  doc.pipe(stream);

  const W = doc.page.width - 100;
  const cur = invoice.currency || "USD";
  const grey = "#64748b";

  // Header
  if (modern) doc.rect(0, 0, doc.page.width, 110).fill(accent);
  const headColor = modern ? "#ffffff" : "#0f172a";
  const buf = logoBuffer(logo);
  let y = 40;
  if (buf) {
    try {
      doc.image(buf, 50, y, { fit: [120, 50] });
    } catch {
      /* ignore a corrupt logo, the invoice is still valid without it */
    }
  } else {
    doc.fillColor(headColor).font("Helvetica-Bold").fontSize(16).text(safe(seller.businessName || seller.name), 50, y + 8, { width: 260 });
  }
  doc.fillColor(headColor).font("Helvetica-Bold").fontSize(26).text("INVOICE", 50, y, { width: W, align: "right" });
  doc.font("Helvetica").fontSize(11).text(`#${invoice.number}`, 50, y + 32, { width: W, align: "right" });

  // Parties
  y = 140;
  const label = (t, x, yy) => doc.fillColor(grey).font("Helvetica-Bold").fontSize(8).text(t, x, yy, { characterSpacing: 1 });
  label("FROM", 50, y);
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text(safe(seller.businessName || seller.name), 50, y + 14, { width: 220 });
  doc.font("Helvetica").fontSize(10).fillColor("#334155");
  if (seller.businessName) doc.text(safe(seller.name), { width: 220 });
  doc.text(safe(seller.email), { width: 220 });
  if (seller.address) doc.fillColor(grey).text(safe(seller.address), { width: 220 });

  label("BILL TO", 320, y);
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text(safe(client?.name || "Deleted client"), 320, y + 14, { width: 225 });
  doc.font("Helvetica").fontSize(10).fillColor("#334155");
  if (client?.company) doc.text(safe(client.company), { width: 225 });
  if (client?.email) doc.fillColor(grey).text(safe(client.email), { width: 225 });

  y = Math.max(doc.y, 230) + 10;
  label("ISSUED", 50, y);
  label(invoice.status === "paid" ? "PAID" : "DUE", 200, y);
  label("STATUS", 350, y);
  const shown = invoice.isOverdue ? "OVERDUE" : String(invoice.status).toUpperCase();
  doc.fillColor("#0f172a").font("Helvetica").fontSize(10);
  doc.text(day(invoice.createdAt), 50, y + 13);
  doc.text(day(invoice.status === "paid" && invoice.paidAt ? invoice.paidAt : invoice.dueDate), 200, y + 13);
  doc.fillColor(invoice.isOverdue ? "#dc2626" : invoice.status === "paid" ? "#15803d" : "#0f172a").font("Helvetica-Bold").text(shown, 350, y + 13);

  // Items table
  y += 45;
  const col = { desc: 50, qty: 330, price: 390, amt: 470 };
  doc.rect(50, y, W, 22).fill(modern ? accent : "#f1f3f9");
  doc.fillColor(modern ? "#ffffff" : "#334155").font("Helvetica-Bold").fontSize(9);
  doc.text("DESCRIPTION", col.desc + 8, y + 7);
  doc.text("QTY", col.qty, y + 7, { width: 50, align: "right" });
  doc.text("PRICE", col.price, y + 7, { width: 70, align: "right" });
  doc.text("AMOUNT", col.amt, y + 7, { width: 75, align: "right" });
  y += 28;

  doc.font("Helvetica").fontSize(10).fillColor("#0f172a");
  for (const it of invoice.items) {
    const h = doc.heightOfString(safe(it.description), { width: 260 });
    if (y + h + 10 > doc.page.height - 160) {
      doc.addPage();
      y = 50;
    }
    doc.fillColor("#0f172a").text(safe(it.description), col.desc + 8, y, { width: 260 });
    doc.text(String(it.quantity), col.qty, y, { width: 50, align: "right" });
    doc.text(money(it.unitPrice, cur), col.price - 10, y, { width: 80, align: "right" });
    doc.text(money(it.quantity * it.unitPrice, cur), col.amt - 10, y, { width: 85, align: "right" });
    y += Math.max(h, 14) + 8;
    doc.moveTo(50, y - 4).lineTo(50 + W, y - 4).strokeColor("#e4e7ef").lineWidth(0.5).stroke();
  }

  // Totals
  if (y > doc.page.height - 150) {
    doc.addPage();
    y = 50;
  }
  y += 10;
  const subtotal = invoice.subtotal ?? invoice.total;
  const row = (l, v, bold) => {
    doc.fillColor(bold ? "#0f172a" : grey).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 13 : 10);
    doc.text(l, 330, y, { width: 100 });
    doc.text(v, 400, y, { width: 145, align: "right" });
    y += bold ? 22 : 16;
  };
  if (invoice.taxRate > 0) {
    row("Subtotal", money(subtotal, cur));
    row(`Tax (${invoice.taxRate}%)`, money(invoice.taxAmount || 0, cur));
  }
  doc.moveTo(330, y).lineTo(545, y).strokeColor(accent).lineWidth(1.5).stroke();
  y += 8;
  row("Total", money(invoice.total, cur), true);

  doc.fillColor(grey).font("Helvetica").fontSize(8).text("Generated with InvoiceFlow", 50, doc.page.height - 60, { width: W, align: "center" });
  doc.end();
}

module.exports = { renderInvoicePdf };
