"use client";

import { useState } from "react";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

const metrics = [
  { key: "revenue", label: "Revenue", total: 12480, text: "text-success", bar: "bg-success", data: [1250, 1880, 1590, 2500, 2170, 3090] },
  { key: "pending", label: "Pending", total: 3200, text: "text-info", bar: "bg-info", data: [300, 650, 420, 800, 480, 550] },
  { key: "overdue", label: "Overdue", total: 850, text: "text-danger", bar: "bg-danger", data: [50, 220, 90, 180, 120, 190] },
] as const;

const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

export function HeroPreview() {
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const m = metrics[active];
  const max = Math.max(...m.data);

  return (
    <div className="mx-auto mt-14 max-w-4xl rounded-2xl border border-line bg-surface p-4 text-left shadow-xl md:p-6">
      <div className="grid gap-3 sm:grid-cols-3" role="tablist" aria-label="Sample dashboard metrics">
        {metrics.map((x, i) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`rounded-lg border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
              i === active ? "border-primary ring-2 ring-primary/30" : "border-line"
            }`}
          >
            <p className="text-xs text-muted">{x.label}</p>
            <p className={`mt-1 text-2xl font-bold ${x.text}`}>{fmt(x.total)}</p>
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-line p-4">
        <p className="mb-2 h-5 text-sm text-muted">
          {hover === null ? (
            <>Monthly {m.label.toLowerCase()} · hover a bar</>
          ) : (
            <>
              {months[hover]}: <span className={`font-semibold ${m.text}`}>{fmt(m.data[hover])}</span>
            </>
          )}
        </p>
        <div className="flex h-28 items-end gap-2 md:h-36" onMouseLeave={() => setHover(null)}>
          {m.data.map((v, i) => (
            <div key={i} className="flex h-full flex-1 flex-col justify-end">
              <div
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${months[i]} ${fmt(v)}`}
                className={`cursor-pointer rounded-t transition-all duration-500 ${m.bar} ${
                  hover === null || hover === i ? "opacity-90" : "opacity-40"
                }`}
                style={{ height: `${(v / max) * 100}%` }}
              />
              <span className="mt-1 text-center text-[10px] text-muted">{months[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
