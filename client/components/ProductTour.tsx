"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { placePopover, type Rect } from "@/lib/placement";
import type { TourStep } from "@/lib/tour";
import { Button, cx } from "./ui";

// A compact spotlight tour: dims the page, outlines one element at a time and shows a small card next to it.
// Skipping or finishing both call onClose, and the caller remembers that so it never opens by itself again.
export function ProductTour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const indexRef = useRef(0);
  const step = steps[index];
  const last = index === steps.length - 1;
  const target = step.target;

  useEffect(() => {
    indexRef.current = index;
  });

  // Find the highlighted element and follow it when the window changes
  const measure = useCallback(() => {
    const el = target ? document.querySelector<HTMLElement>(`[data-tour="${target}"]`) : null;
    const r = el?.getBoundingClientRect();
    if (!el || !r || (r.width === 0 && r.height === 0)) return setRect(null); // not on screen: show a centred card instead
    const pad = 6;
    setRect({ left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad });
  }, [target]);

  useLayoutEffect(() => {
    if (target) document.querySelector<HTMLElement>(`[data-tour="${target}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();
  }, [measure, target, index]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  // Put the card beside the element once both sizes are known
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const p = placePopover(rect, { w: el.offsetWidth, h: el.offsetHeight }, { w: document.documentElement.clientWidth, h: window.innerHeight });
    setPos({ left: p.left, top: p.top });
  }, [rect, index]);

  const goNext = useCallback(() => {
    if (indexRef.current >= steps.length - 1) onClose();
    else setIndex((i) => i + 1);
  }, [steps.length, onClose]);
  const goBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Keyboard: Esc skips, arrows move, Tab stays inside the card. Focus goes back to where it was when the tour ends.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goBack();
      else if (e.key === "Tab" && cardRef.current) {
        const f = cardRef.current.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!f.length) return;
        const first = f[0];
        const lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [goNext, goBack, onClose]);

  useEffect(() => {
    nextRef.current?.focus();
  }, [index]);

  function finish() {
    onClose();
    if (step.cta?.href) router.push(step.cta.href);
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] print:hidden" role="presentation">
      {/* Blocks clicks on the page behind, so nothing happens by accident mid-tour */}
      <div className="absolute inset-0" aria-hidden="true" />
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-xl ring-2 ring-primary motion-safe:transition-all motion-safe:duration-200"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.right - rect.left,
            height: rect.bottom - rect.top,
            boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.62)", // the "dimmed page" is this huge shadow around the hole
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-950/60" aria-hidden="true" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
        className="animate-fade-in fixed w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-surface p-4 shadow-2xl motion-safe:transition-[left,top] motion-safe:duration-200"
      >
        <p className="text-xs font-medium text-muted">
          Step {index + 1} of {steps.length}
        </p>
        <h2 id="tour-title" className="mt-1 text-base font-bold">
          {step.title}
        </h2>
        <p id="tour-body" className="mt-1 text-sm text-muted">
          {step.body}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {steps.map((s, i) => (
              <span key={s.id} className={cx("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-primary" : "w-1.5 bg-line")} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!last && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Skip
              </Button>
            )}
            {index > 0 && (
              <Button variant="secondary" size="sm" onClick={goBack}>
                Back
              </Button>
            )}
            <button
              ref={nextRef}
              onClick={last ? finish : goNext}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-fg shadow-sm hover:bg-primary-hover"
            >
              {last ? step.cta?.label ?? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
