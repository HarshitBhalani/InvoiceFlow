import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { Logo, ThemeToggle } from "@/components/ThemeToggle";
import { AuthCta } from "@/components/AuthCta";
import { HeroPreview } from "@/components/HeroPreview";

const features: { icon: IconName; title: string; text: string }[] = [
  { icon: "fileText", title: "Professional invoices", text: "Add line items, set a due date and get totals calculated for you. No spreadsheets, no mistakes." },
  { icon: "users", title: "Client list", text: "Keep every client in one place and create an invoice for any of them in a few clicks." },
  { icon: "trendingUp", title: "Revenue at a glance", text: "See paid, pending and overdue amounts plus a monthly revenue chart the moment you log in." },
  { icon: "clock", title: "Overdue tracking", text: "Invoices past their due date are flagged automatically so nothing slips through." },
  { icon: "printer", title: "Print or save as PDF", text: "Open any invoice in a clean print layout and save it as a PDF to send to your client." },
  { icon: "shield", title: "Private and secure", text: "Your data is only visible to you. Passwords are hashed and sessions use secure cookies." },
];

const steps = [
  { n: "1", title: "Add a client", text: "Save their name and email once." },
  { n: "2", title: "Create an invoice", text: "Add line items and a due date." },
  { n: "3", title: "Track payment", text: "Mark it paid and watch your revenue grow." },
];

const faqs = [
  { q: "Is it really free?", a: "Yes. The Free plan includes up to 5 invoices with every feature. Upgrade to Pro for unlimited invoices." },
  { q: "Can I cancel Pro any time?", a: "Yes. Manage or cancel your subscription from the billing page. You keep Pro until the end of the paid period." },
  { q: "Is my data safe?", a: "Each account only ever sees its own clients and invoices. Payments are handled by Stripe, so we never see your card details." },
  { q: "Can I try it without signing up?", a: "Yes. Use Try the demo account on the login page. It opens a private workspace with sample data. Emails and payments are switched off, and it is deleted after 24 hours." },
];

export default function Home() {
  return (
    <div className="flex-1">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" aria-label="InvoiceFlow home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#features" className="hover:text-fg">Features</a>
            <a href="#pricing" className="hover:text-fg">Pricing</a>
            <a href="#faq" className="hover:text-fg">FAQ</a>
            <Link href="/docs" className="hover:text-fg">Docs</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AuthCta />
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center md:pt-24">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Invoicing that gets you{" "}
            <span className="relative inline-block text-primary">
              paid faster
              {/* hand-drawn underline doodle */}
              <svg aria-hidden="true" viewBox="0 0 200 12" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-2.5 w-full" fill="none">
                <path d="M2 8 C 25 2, 50 11, 80 6 S 130 3, 160 8 S 190 6, 198 5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
            Create clean invoices, track who has paid and see your revenue in one simple dashboard. Built for freelancers and small teams.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-fg shadow-sm hover:bg-primary-hover">
              Create free account
            </Link>
            <Link href="/login" className="rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold hover:bg-surface-2">
              Try the demo
            </Link>
          </div>
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
            <svg aria-hidden="true" viewBox="0 0 36 28" className="h-6 w-8 -rotate-6 text-primary" fill="none">
              <path d="M3 24 C 14 26, 26 20, 30 5 M30 5 L22 9 M30 5 L33 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="italic">No credit card needed</span>
          </p>

          {/* Interactive product preview */}
          <HeroPreview />
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight">Everything you need, nothing you do not</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-line bg-surface p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon name={f.icon} className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight">Up and running in minutes</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-fg">
                  {s.n}
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight">Simple pricing</h2>
          <p className="mt-2 text-center text-muted">Start free. Upgrade only when you need more.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-line bg-surface p-6">
              <h3 className="font-semibold">Free</h3>
              <p className="mt-2 text-4xl font-bold">$0</p>
              <ul className="mt-5 space-y-2 text-sm">
                {["Up to 5 invoices", "Unlimited clients", "Dashboard and charts", "Print and PDF"].map((i) => (
                  <li key={i} className="flex items-center gap-2"><Icon name="check" className="h-4 w-4 text-success" />{i}</li>
                ))}
              </ul>
              <Link href="/signup" className="mt-6 block rounded-lg border border-line py-2.5 text-center text-sm font-semibold hover:bg-surface-2">
                Get started
              </Link>
            </div>
            <div className="relative rounded-xl border-2 border-primary bg-surface p-6">
              <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-fg">Most popular</span>
              <h3 className="font-semibold">Pro</h3>
              <p className="mt-2 text-4xl font-bold">$19<span className="text-base font-normal text-muted">/month</span></p>
              <ul className="mt-5 space-y-2 text-sm">
                {["Unlimited invoices", "Everything in Free", "Manage billing any time", "Cancel whenever you like"].map((i) => (
                  <li key={i} className="flex items-center gap-2"><Icon name="check" className="h-4 w-4 text-success" />{i}</li>
                ))}
              </ul>
              <Link href="/signup" className="mt-6 block rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-primary-fg hover:bg-primary-hover">
                Start with Pro
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight">Questions</h2>
          <div className="mt-8 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-xl border border-line bg-surface p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {f.q}
                  <span className="text-muted transition-transform group-open:rotate-45"><Icon name="plus" /></span>
                </summary>
                <p className="mt-2 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-4xl px-4 pb-20">
          <div className="rounded-2xl bg-primary p-10 text-center text-primary-fg">
            <h2 className="text-3xl font-bold tracking-tight">Send your first invoice today</h2>
            <p className="mt-2 opacity-90">No credit card needed.</p>
            <Link href="/signup" className="mt-6 inline-block rounded-lg bg-white px-6 py-3 text-sm font-semibold text-primary-hover hover:opacity-90">
              Create free account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        <Logo className="mb-2 justify-center" />
        <p>
          &copy; InvoiceFlow. Payments by Stripe. ·{" "}
          <Link href="/docs" className="underline hover:text-fg">Help and docs</Link>
        </p>
      </footer>
    </div>
  );
}
