export const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD"] as const;

export const money = (n: number, currency: string = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n || 0);

export const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" });

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

// Whole days from today to a date (negative = in the past)
export const daysUntil = (d: string | Date) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 864e5);
};

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
