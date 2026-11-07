"use client";
import { Suspense, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Icon, type IconName } from "@/components/Icon";
import { ProductTour } from "@/components/ProductTour";
import { shouldAutoShowTour, tourKey, tourSteps } from "@/lib/tour";
import { Logo, ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, Button, ErrorState, IconButton, Skeleton, cx } from "@/components/ui";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  businessName: string;
  address: string;
  hasLogo: boolean;
  accentColor: string;
  template: "classic" | "modern";
  currency: string;
  defaultTaxRate: number;
  autoReminders: boolean;
  emailVerified: boolean;
  isDemo: boolean;
  tourDone: boolean;
};
export type Billing = {
  stripeMode?: "test" | "live" | null; // which Stripe world the server talks to
  plan: "free" | "pro";
  usage: { invoices: number; limit: number | null };
  subscription: { status: string; currentPeriodEnd?: string; cancelAtPeriodEnd: boolean } | null;
};

type Shell = { user: User; billing: Billing | null; refreshBilling: () => void; refreshUser: () => void };
const ShellContext = createContext<Shell | null>(null);

export const useShell = () => {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside the dashboard layout");
  return ctx;
};
export const useUser = () => useContext(ShellContext)?.user ?? null;

const nav: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/invoices", label: "Invoices", icon: "fileText" },
  { href: "/clients", label: "Clients", icon: "users" },
  { href: "/expenses", label: "Expenses", icon: "receipt" },
  { href: "/reports", label: "Reports", icon: "barChart" },
  { href: "/billing", label: "Billing", icon: "creditCard" },
  { href: "/settings", label: "Settings", icon: "user" },
];

function DemoBanner() {
  const [busy, setBusy] = useState(false);

  // A demo visitor who wants a real account must be logged out first, otherwise /signup would bounce them back here
  async function goSignup() {
    setBusy(true);
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/signup"); // full load: nothing from the demo stays in memory
    }
  }

  return (
    <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-info-soft px-4 py-3 text-sm text-info print:hidden">
      <span className="flex items-center gap-2">
        <Icon name="info" />
        You are in a demo workspace with sample data. Emails and payments are turned off, and it is deleted after 24 hours.
      </span>
      <Button size="sm" loading={busy} onClick={goSignup}>
        Create a free account
      </Button>
    </div>
  );
}

function VerifyBanner({ email, onDone }: { email: string; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function resend() {
    setState("sending");
    setError("");
    try {
      await api("/auth/resend-verification", { method: "POST" });
      setState("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the email");
      setState("idle");
    }
  }

  return (
    <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning print:hidden">
      <span className="flex items-center gap-2">
        <Icon name="mail" />
        {state === "sent" ? `Verification email sent to ${email}. Check your inbox (and spam).` : `Please verify your email (${email}) to send invoices to clients.`}
        {error && <span className="font-medium"> {error}</span>}
      </span>
      <span className="flex items-center gap-3">
        {state !== "sent" && (
          <Button size="sm" variant="secondary" loading={state === "sending"} onClick={resend}>
            Resend email
          </Button>
        )}
        <button onClick={onDone} className="text-xs underline">I verified it</button>
      </span>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-64 border-r border-line bg-surface p-4 md:block">
        <Skeleton className="h-8 w-36" />
        <div className="mt-8 space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}
        </div>
      </div>
      <div className="flex-1 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-40" />
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loadError, setLoadError] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [compactTour, setCompactTour] = useState(false);
  const tourShownFor = useRef<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadUser = useCallback(() => {
    setLoadError("");
    api<{ user: User }>("/auth/me")
      .then((d) => setUser(d.user))
      .catch((e) => {
        // Logged out -> login page. Anything else (server down, network) -> a retry screen, not a logout.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          window.location.replace(e.status === 401 ? "/login?session=expired" : "/login");
        } else setLoadError(e instanceof Error ? e.message : "Could not load your account");
      });
  }, []);

  const refreshUser = useCallback(() => {
    api<{ user: User }>("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {});
  }, []);

  const openTour = useCallback(() => {
    setCompactTour(window.matchMedia("(max-width: 767px)").matches); // phones have no sidebar to point at
    setTourOpen(true);
  }, []);

  // Finishing and skipping both count as "seen": remember it on the server (so it follows the account to every
  // device) and in this browser (the demo, and a fallback if the save fails).
  const closeTour = useCallback(() => {
    setTourOpen(false);
    if (!user) return;
    try {
      window.localStorage.setItem(tourKey(user), "1");
    } catch {
      /* storage blocked: the server flag still covers real accounts */
    }
    api("/auth/tour-done", { method: "POST" })
      .then(refreshUser)
      .catch(() => {});
  }, [user, refreshUser]);

  // First visit only: open the tour once, shortly after the page has settled
  useEffect(() => {
    if (!user || tourShownFor.current === user.id) return;
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      /* ignore */
    }
    if (!shouldAutoShowTour(user, storage)) return;
    const t = setTimeout(() => {
      tourShownFor.current = user.id;
      openTour();
    }, 700);
    return () => clearTimeout(t);
  }, [user, openTour]);

  const refreshBilling = useCallback(() => {
    api<Billing>("/billing/status")
      .then(setBilling)
      .catch(() => {}); // usage meter is optional; never block the app on it
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);
  useEffect(() => {
    if (user) refreshBilling();
  }, [user, refreshBilling]);

  // Close drawer on navigation, menu on outside click / Escape
  useEffect(() => {
    setDrawer(false);
    setMenu(false);
  }, [pathname]);
  useEffect(() => {
    if (!menu) return;
    const onClick = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      // Full page load instead of a client-side navigation: Next.js would keep this account's pages alive in the
      // background, and the next person to log in on this computer could briefly see them.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <ErrorState message={loadError} onRetry={loadUser} />
      </div>
    );
  }

  if (!user) return <ShellSkeleton />;

  const items = user.role === "admin" ? [...nav, { href: "/admin", label: "Admin", icon: "shield" as IconName }] : nav;
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const used = billing?.usage.invoices ?? 0;
  const limit = billing?.usage.limit ?? null;

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" className="px-2 py-1 text-lg" aria-label="InvoiceFlow dashboard">
        <Logo />
      </Link>
      <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Main">
        {items.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? "page" : undefined}
            data-tour={`nav-${l.href.slice(1)}`}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(l.href) ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-fg"
            )}
          >
            <Icon name={l.icon} className="h-4 w-4" />
            {l.label}
          </Link>
        ))}
      </nav>

      <Link href="/docs" target="_blank" rel="noopener" className="mb-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
        <Icon name="info" className="h-4 w-4" /> Help and docs
      </Link>

      {billing && user.plan === "free" && limit !== null && (
        <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs">
          <div className="mb-1 flex justify-between font-medium">
            <span>Free plan</span>
            <span>{used}/{limit} invoices</span>
          </div>
          <div className="h-1.5 rounded-full bg-line" role="progressbar" aria-valuenow={used} aria-valuemax={limit} aria-label="Invoices used">
            <div
              className={cx("h-1.5 rounded-full", used >= limit ? "bg-danger" : "bg-primary")}
              style={{ width: `${Math.min((used / limit) * 100, 100)}%` }}
            />
          </div>
          <Link href="/billing" className="mt-2 inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            <Icon name="zap" className="h-3 w-3" /> Upgrade to Pro
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <ShellContext.Provider value={{ user, billing, refreshBilling, refreshUser }}>
      <div className="min-h-screen md:flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-surface p-4 md:block print:hidden">
          {sidebar}
        </aside>

        {/* Mobile drawer */}
        {drawer && (
          <div className="fixed inset-0 z-40 md:hidden print:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
            <aside className="animate-modal-in relative h-full w-72 max-w-[85%] bg-surface p-4 shadow-xl">{sidebar}</aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur md:px-8 print:hidden">
            <div className="flex items-center gap-2 md:hidden">
              <IconButton icon="menu" label="Open menu" onClick={() => setDrawer(true)} />
              <Logo className="text-base" />
            </div>
            <div className="hidden md:block" />
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenu(!menu)}
                  data-tour="user-menu"
                  aria-haspopup="menu"
                  aria-expanded={menu}
                  className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-surface-2"
                >
                  <Avatar name={user.name} />
                  <span className="hidden max-w-32 truncate text-sm font-medium sm:block">{user.name}</span>
                </button>
                {menu && (
                  <div role="menu" className="animate-modal-in absolute right-0 mt-2 w-60 rounded-xl border border-line bg-surface p-2 shadow-lg">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-medium">{user.name}</p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-primary">{user.plan} plan</p>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <Link href="/settings" role="menuitem" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
                      <Icon name="user" /> Settings
                    </Link>
                    <Link href="/billing" role="menuitem" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
                      <Icon name="creditCard" /> Billing
                    </Link>
                    <button
                      onClick={() => {
                        setMenu(false);
                        openTour();
                      }}
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"
                    >
                      <Icon name="sparkles" /> Product tour
                    </button>
                    <Link href="/docs" target="_blank" rel="noopener" role="menuitem" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
                      <Icon name="info" /> Help and docs
                    </Link>
                    <Button variant="ghost" onClick={logout} role="menuitem" className="w-full !justify-start !px-3 !text-danger">
                      <Icon name="logOut" /> Log out
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8 print:p-0">
            {user.isDemo && <DemoBanner />}
            {!user.emailVerified && <VerifyBanner email={user.email} onDone={refreshUser} />}
            {children}
          </main>
        </div>
      </div>
      {tourOpen && (
        <ProductTour steps={tourSteps({ name: user.name, isDemo: user.isDemo, compact: compactTour })} onClose={closeTour} />
      )}
    </ShellContext.Provider>
  );
}
