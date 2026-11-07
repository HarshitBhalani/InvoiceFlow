// The first-run product tour: which steps it has, and when it should appear on its own.
// Pure logic with no React or DOM, so it can be tested on its own (and uses only erasable TypeScript syntax,
// so Node can run this file directly in tests).

export type TourStep = {
  id: string;
  target?: string; // matches a data-tour="..." attribute in the app; no target = a centred card
  title: string;
  body: string;
  cta?: { label: string; href?: string }; // only used on the last step
};

export type TourUser = { id: string; name: string; isDemo?: boolean; tourDone?: boolean };
type Reader = { getItem(key: string): string | null } | null | undefined;

const PREFIX = "invoiceflow:tour:";

// Real accounts are remembered per user id. Demo workspaces are brand new on every click, so they are remembered
// per browser instead (otherwise every demo click would show the tour again).
export const tourKey = (u: Pick<TourUser, "id" | "isDemo">) => PREFIX + (u.isDemo ? "demo" : u.id);

// The tour opens on its own only the first time.
//   real account: the server flag `tourDone`, plus a browser copy in case saving it to the server failed
//   demo:         the browser copy only
export function shouldAutoShowTour(user: TourUser, storage: Reader): boolean {
  let seenHere = false;
  try {
    seenHere = !!storage?.getItem(tourKey(user));
  } catch {
    /* storage blocked (private mode): rely on the server flag */
  }
  if (user.isDemo) return !seenHere;
  return !user.tourDone && !seenHere;
}

export function tourSteps({ name, isDemo, compact }: { name: string; isDemo: boolean; compact: boolean }): TourStep[] {
  const first = name.trim().split(/\s+/)[0] || "there";

  const welcome: TourStep = {
    id: "welcome",
    title: `Welcome, ${first}`,
    body: isDemo
      ? "This is a demo workspace with sample data. Here is a 30-second look around."
      : "Here is a 30-second look at where everything is.",
  };
  const done: TourStep = {
    id: "done",
    title: "You are all set",
    body: isDemo ? "Explore freely. Emails and payments are switched off in the demo." : "A good first step: add your first client.",
    cta: isDemo ? { label: "Start exploring" } : { label: "Add a client", href: "/clients" },
  };

  // Phones: the sidebar is hidden behind a menu button, so there is nothing to point at. Short centred cards instead.
  if (compact) {
    return [
      welcome,
      {
        id: "menu",
        title: "Find your way around",
        body: "Open the menu at the top left to reach Clients, Invoices, Expenses, Reports and Settings.",
      },
      {
        id: "settings",
        title: "Make it yours",
        body: "In Settings add your business name, logo and tax rate so your invoices look professional.",
      },
      done,
    ];
  }

  return [
    welcome,
    {
      id: "clients",
      target: "nav-clients",
      title: "Clients",
      body: "Add the people and companies you bill. Every invoice starts with a client.",
    },
    {
      id: "invoices",
      target: "nav-invoices",
      title: "Invoices",
      body: "Create invoices, email them, and let clients pay online. Overdue ones are flagged for you.",
    },
    {
      id: "reports",
      target: "nav-reports",
      title: "Expenses and reports",
      body: "Log your costs under Expenses. Reports show your real profit, month by month.",
    },
    {
      id: "settings",
      target: "nav-settings",
      title: "Settings",
      body: "Add your business name, logo and tax rate so your invoices look professional.",
    },
    {
      id: "menu",
      target: "user-menu",
      title: "Your menu",
      body: "Switch light or dark mode, open Help and docs, and replay this tour any time.",
    },
    done,
  ];
}
