import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Logo, ThemeToggle } from "@/components/ThemeToggle";
import { AuthCta } from "@/components/AuthCta";

export const metadata: Metadata = {
  title: "Help and docs",
  description: "How to use InvoiceFlow: create invoices, get paid online, set up recurring billing and reminders, track expenses, and manage your plan.",
};

type Section = { id: string; title: string; body: React.ReactNode };

const Steps = ({ items }: { items: React.ReactNode[] }) => (
  <ol className="my-3 space-y-2">
    {items.map((it, i) => (
      <li key={i} className="flex gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg">{i + 1}</span>
        <span>{it}</span>
      </li>
    ))}
  </ol>
);

const Note = ({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warning" }) => (
  <p className={`my-3 flex gap-2 rounded-lg px-4 py-3 text-sm ${tone === "warning" ? "bg-warning-soft text-warning" : "bg-info-soft text-info"}`}>
    <Icon name={tone === "warning" ? "alert" : "info"} className="mt-0.5 h-4 w-4 shrink-0" />
    <span>{children}</span>
  </p>
);

const Statuses = () => (
  <dl className="my-3 grid gap-2 sm:grid-cols-2">
    {[
      ["Draft", "You are still working on it. The client has not been told."],
      ["Sent", "The client has it and the due date has not passed yet."],
      ["Paid", "The money arrived. Paid invoices count towards your revenue."],
      ["Overdue", "Still unpaid after the due date. An invoice marked Sent turns Overdue by itself the day after it is due."],
    ].map(([k, v]) => (
      <div key={k} className="rounded-lg border border-line bg-surface p-3">
        <dt className="font-semibold">{k}</dt>
        <dd className="mt-0.5 text-sm text-muted">{v}</dd>
      </div>
    ))}
  </dl>
);

const sections: Section[] = [
  {
    id: "getting-started",
    title: "Getting started",
    body: (
      <>
        <p>You can send your first invoice in about five minutes.</p>
        <Steps
          items={[
            <><b>Create your account</b> and confirm your email. We send a link to your inbox. You need to confirm it before you can email invoices.</>,
            <>Open <b>Settings</b> and add your <b>business name, address and logo</b>. They appear at the top of every invoice.</>,
            <>Pick your <b>currency</b> and a default <b>tax rate</b> in Settings if you charge VAT, GST or sales tax.</>,
            <>Go to <b>Clients</b> and add the person or company you bill.</>,
            <>Go to <b>Invoices, New invoice</b>, choose the client, add line items and a due date, then save.</>,
          ]}
        />
        <Note>Want to look around first? Use <b>Try the demo account</b> on the login page. It comes with sample data.</Note>
      </>
    ),
  },
  {
    id: "invoices",
    title: "Invoices",
    body: (
      <>
        <p>Each invoice has a client, line items, an optional tax rate and a due date. Totals are always calculated for you.</p>
        <h3 className="mt-5 text-base font-semibold">Statuses</h3>
        <Statuses />
        <h3 className="mt-5 text-base font-semibold">Useful actions</h3>
        <ul className="my-2 list-disc space-y-1 pl-5">
          <li><b>Mark paid</b> when a client pays you by bank transfer or cash.</li>
          <li><b>Duplicate</b> an invoice to reuse its client and items for a new one.</li>
          <li><b>PDF</b> downloads a document with your logo, colors and chosen template. <b>Export CSV</b> gives you all invoices for your accountant.</li>
          <li>Use the <b>search box and status tabs</b> to find an invoice quickly. You can search by client name or invoice number.</li>
        </ul>
        <Note>Every invoice keeps the currency it was created in. Changing your currency in Settings only affects new invoices.</Note>
      </>
    ),
  },
  {
    id: "get-paid",
    title: "Sending an invoice and getting paid",
    body: (
      <>
        <Steps
          items={[
            <>Open an invoice and click <b>Send</b>. Add a short personal message if you like.</>,
            <>Your client gets an email with a <b>View invoice</b> button. They do not need an account. If they reply, it goes to your email address.</>,
            <>On the invoice page they can read the details and click <b>Pay now</b> to pay by card.</>,
            <>When the payment goes through, the invoice becomes <b>Paid</b> automatically.</>,
          ]}
        />
        <p>Prefer WhatsApp or another app? Use <b>Copy link</b> and share the invoice link yourself. Anyone with the link can view and pay that one invoice, so only share it with your client.</p>
        <Note tone="warning">Payments are processed by Stripe. In the test version of this app no real money moves. Use the test card 4242 4242 4242 4242.</Note>
      </>
    ),
  },
  {
    id: "recurring",
    title: "Recurring invoices and reminders (Pro)",
    body: (
      <>
        <h3 className="text-base font-semibold">Recurring invoices</h3>
        <p>For a monthly retainer or subscription, open an invoice and click <b>Recurring</b>. Choose how often it repeats (weekly, monthly, every 3 months or yearly).</p>
        <ul className="my-2 list-disc space-y-1 pl-5">
          <li>A new copy is created on each repeat with the same client, items and tax.</li>
          <li>Turn on <b>Email each new invoice automatically</b> to send it for you. If it is off, copies wait as drafts for you to review.</li>
          <li>Click <b>Stop recurring</b> at any time.</li>
        </ul>
        <h3 className="mt-5 text-base font-semibold">Automatic reminders</h3>
        <p>Turn this on in <b>Settings, Invoice settings</b>. If an invoice is still unpaid, your client gets a friendly reminder the day after the due date, then weekly, up to 3 reminders.</p>
        <Note>Both features need the Pro plan. Jobs run in the background every hour, so a new invoice or reminder can arrive up to an hour after it is due.</Note>
      </>
    ),
  },
  {
    id: "expenses",
    title: "Expenses and reports",
    body: (
      <>
        <p>Add your business costs under <b>Expenses</b> (software, travel, contractors and so on). Give each one a category.</p>
        <p><b>Reports</b> then show your <b>profit</b>: the money you received (paid invoices) minus your expenses, month by month for the last 12 months, plus spending by category and the tax you collected.</p>
        <Note>Revenue only counts invoices that are marked <b>Paid</b>. Unpaid invoices show up as money still owed to you.</Note>
      </>
    ),
  },
  {
    id: "plans",
    title: "Plans and billing",
    body: (
      <>
        <ul className="my-2 list-disc space-y-1 pl-5">
          <li><b>Free:</b> up to 5 invoices, everything else included.</li>
          <li><b>Pro ($19 per month):</b> unlimited invoices, recurring invoices and automatic reminders.</li>
        </ul>
        <p>Open <b>Billing</b> and click <b>Upgrade to Pro</b>. You pay on a secure Stripe page. Use <b>Manage subscription</b> to change your card, see receipts or cancel. If you cancel, you keep Pro until the end of the period you paid for.</p>
        <Note>Paid but still see the Free plan? Open Billing and click <b>Already paid? Refresh plan status</b>. It checks directly with Stripe.</Note>
      </>
    ),
  },
  {
    id: "account",
    title: "Your account and security",
    body: (
      <>
        <ul className="my-2 list-disc space-y-1 pl-5">
          <li><b>Forgot your password?</b> Use the link on the login page. We email a reset link that works once and expires after an hour.</li>
          <li><b>Change your password</b> in Settings. This signs you out on all other devices.</li>
          <li>Pick <b>Light, Dark or System</b> theme in Settings, or with the moon / sun button at the top.</li>
          <li>Your clients, invoices and expenses are private to your account.</li>
        </ul>
      </>
    ),
  },
];

const faqs: [string, string][] = [
  ["I did not get the verification or invoice email.", "Check your spam folder first. For the verification email, use the Resend email button on the yellow banner at the top of the app. You can request one per minute."],
  ["Why can't I send invoices?", "You need to confirm your email address first. A banner at the top of the app has a Resend email button if you lost the link."],
  ["A client says the invoice link does not work.", "Links stop working if the invoice is deleted. Open the invoice and use Copy link to get a fresh link to the same invoice."],
  ["I reached the limit of 5 invoices.", "Upgrade to Pro on the Billing page, or delete invoices you no longer need."],
  ["The client paid but the invoice still says Sent.", "It normally updates within seconds. If the client was charged and it has been a few minutes, open the invoice page they paid on and refresh it. You can also mark the invoice paid yourself."],
  ["Can my clients pay in another currency?", "Each invoice uses one currency, the one you had selected when you created it. Pick your currency in Settings before creating invoices."],
  ["How do I delete a client?", "A client who still has invoices cannot be deleted. Delete or move those invoices first."],
];

export default function DocsPage() {
  return (
    <div className="flex-1">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" aria-label="InvoiceFlow home"><Logo /></Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AuthCta />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[14rem_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">On this page</p>
          <nav aria-label="Documentation" className="flex flex-wrap gap-x-4 gap-y-1 text-sm lg:flex-col lg:gap-1">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="py-1 text-muted hover:text-fg">{s.title}</a>
            ))}
            <a href="#faq" className="py-1 text-muted hover:text-fg">Questions and fixes</a>
          </nav>
        </aside>

        <main className="min-w-0 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight">Help and docs</h1>
          <p className="mt-2 text-muted">Everything you need to send invoices, get paid and keep track of your money.</p>

          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 border-b border-line py-8 last:border-0 [&_p]:my-3 [&_p]:leading-relaxed">
              <h2 className="text-2xl font-bold tracking-tight">{s.title}</h2>
              <div className="mt-3 text-[15px]">{s.body}</div>
            </section>
          ))}

          <section id="faq" className="scroll-mt-24 py-8">
            <h2 className="text-2xl font-bold tracking-tight">Questions and fixes</h2>
            <div className="mt-4 space-y-3">
              {faqs.map(([q, a]) => (
                <details key={q} className="group rounded-xl border border-line bg-surface p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                    {q}
                    <span className="shrink-0 text-muted transition-transform group-open:rotate-45"><Icon name="plus" /></span>
                  </summary>
                  <p className="mt-2 text-sm text-muted">{a}</p>
                </details>
              ))}
            </div>
            <p className="mt-8 text-sm text-muted">Still stuck? Email the person who sent you the invoice, or the owner of your InvoiceFlow account.</p>
          </section>
        </main>
      </div>
    </div>
  );
}
