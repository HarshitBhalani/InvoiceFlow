import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Logo, ThemeToggle } from "@/components/ThemeToggle";

const points = ["Create invoices in seconds", "Track paid, pending and overdue", "See your revenue at a glance"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-fg lg:flex">
        <Link href="/" className="text-lg">
          <Logo />
        </Link>
        <div>
          <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">Get paid faster with invoices your clients understand.</h2>
          <ul className="mt-8 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                  <Icon name="check" className="h-3.5 w-3.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm opacity-80">Free for your first 5 invoices.</p>
      </aside>

      <main className="relative flex items-center justify-center p-4">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 block lg:hidden" aria-label="InvoiceFlow home">
            <Logo />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
