"use client";
import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";
import { initials } from "@/lib/format";
import { placeTooltip, type Anchor } from "@/lib/placement";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------- Buttons ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover shadow-sm",
  secondary: "border border-line bg-surface text-fg hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger text-white hover:opacity-90 shadow-sm",
};

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        variants[variant],
        className
      )}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

/* ---------- Tooltip ---------- */
// Rendered in a portal with fixed positioning, so it is never clipped by overflow-hidden cards or tables.
// Position comes from placeTooltip (lib/placement.ts): centred on the element, flipped below near the top of the
// screen, and kept inside the viewport at the sides. It is measured while hidden and only then shown, and it uses
// plain left/top (no transform), so the measurement can never be thrown off by an animation.
function TooltipBubble({ id, text, anchor }: { id: string; text: string; anchor: Anchor }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { left, top } = placeTooltip(anchor, { w: el.offsetWidth, h: el.offsetHeight }, document.documentElement.clientWidth);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = "visible";
  }, [anchor, text]);

  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      style={{ left: 0, top: 0, visibility: "hidden" }}
      className="animate-fade-in pointer-events-none fixed z-[100] w-max max-w-[min(15rem,calc(100vw-1rem))] rounded-md bg-fg px-2.5 py-1.5 text-xs font-medium text-bg shadow-lg"
    >
      {text}
    </div>
  );
}

export function Tooltip({ text, children, className }: { text: string; children: ReactNode; className?: string }) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({ x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
  };

  // A tooltip that is open while the page scrolls or resizes would point at the wrong place: close it
  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor]);

  return (
    <span
      ref={ref}
      className={cx("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={() => setAnchor(null)}
      onFocus={show}
      onBlur={() => setAnchor(null)}
      aria-describedby={anchor ? id : undefined}
    >
      {children}
      {anchor && createPortal(<TooltipBubble id={id} text={text} anchor={anchor} />, document.body)}
    </span>
  );
}

export function IconButton({
  icon,
  label,
  tone,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; tone?: "danger" }) {
  return (
    <Tooltip text={label}>
      <button
        {...props}
        aria-label={label}
        className={cx(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 disabled:opacity-50",
          tone === "danger" ? "hover:text-danger" : "hover:text-fg",
          className
        )}
      >
        <Icon name={icon} />
      </button>
    </Tooltip>
  );
}

/* ---------- Form fields ---------- */
const inputBase =
  "w-full rounded-lg border bg-surface px-3 py-2 text-sm text-fg outline-none transition-colors placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-60";

export const inputCls = cx(inputBase, "border-line");
export const fieldCls = (error?: string, extra?: string) => cx(inputBase, error ? "border-danger pr-9" : "border-line", extra);

// Validation message as a tooltip bubble under the field. Shown while the field is hovered or focused;
// on a failed submit the first invalid field is focused (see focusFirstInvalid), so its bubble opens by itself.
export function ErrorBubble({ id, message }: { id: string; message: string }) {
  return (
    <span
      id={id}
      role="alert"
      className={cx(
        "pointer-events-none absolute left-0 top-full z-40 mt-2 w-max max-w-[min(20rem,100%)] rounded-md bg-danger px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity",
        "group-hover/field:opacity-100 group-focus-within/field:opacity-100"
      )}
    >
      <span className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-danger" aria-hidden="true" />
      {message}
    </span>
  );
}

// Wraps any control: adds the invalid icon and the tooltip bubble.
export function FieldShell({
  id,
  error,
  iconRight = "right-3",
  icon = true,
  children,
}: {
  id: string;
  error?: string;
  iconRight?: string;
  icon?: boolean; // hide the inline icon in very narrow inputs (the red border and bubble still show)
  children: ReactNode;
}) {
  return (
    <div className="group/field relative">
      {children}
      {error && (
        <>
          {icon && (
            <span className={cx("pointer-events-none absolute top-1/2 -translate-y-1/2 text-danger", iconRight)}>
              <Icon name="alertCircle" />
            </span>
          )}
          <ErrorBubble id={`${id}-err`} message={error} />
        </>
      )}
    </div>
  );
}

export function FieldLabel({ htmlFor, label, help, optional }: { htmlFor: string; label: string; help?: string; optional?: boolean }) {
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {optional && <span className="text-xs text-muted">(optional)</span>}
      {help && (
        <Tooltip text={help}>
          <span tabIndex={0} className="text-muted hover:text-fg" aria-label={`Help: ${help}`}>
            <Icon name="info" className="h-3.5 w-3.5" />
          </span>
        </Tooltip>
      )}
    </div>
  );
}

// Focus the first invalid field of a form so its validation tooltip opens. Call right after setting errors.
export function focusFirstInvalid(form: Element | null) {
  requestAnimationFrame(() => {
    const el = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

type FieldProps = { label: string; error?: string; hint?: string; help?: string; optional?: boolean; className?: string };

export const TextField = forwardRef<
  HTMLInputElement,
  FieldProps & InputHTMLAttributes<HTMLInputElement> & { rightSlot?: ReactNode }
>(function TextField({ label, error, hint, help, optional, className, rightSlot, ...props }, ref) {
  const id = useId();
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} help={help} optional={optional} />
      <FieldShell id={id} error={error} iconRight={rightSlot ? "right-10" : "right-3"}>
        <input
          ref={ref}
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          {...props}
          className={fieldCls(error, rightSlot ? "pr-10" : undefined)}
        />
        {rightSlot}
      </FieldShell>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
});

// Password input with an eye button to reveal / hide what you typed
export const PasswordField = forwardRef<HTMLInputElement, FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(
  function PasswordField(props, ref) {
    const [show, setShow] = useState(false);
    return (
      <TextField
        {...props}
        ref={ref}
        type={show ? "text" : "password"}
        rightSlot={
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Icon name={show ? "eyeOff" : "eye"} />
          </button>
        }
      />
    );
  }
);

export function TextareaField({
  label,
  error,
  hint,
  help,
  optional,
  className,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const len = typeof props.value === "string" ? props.value.length : 0;
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} help={help} optional={optional} />
      <FieldShell id={id} error={error}>
        <textarea
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          rows={3}
          {...props}
          className={fieldCls(error, "resize-y")}
        />
      </FieldShell>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{!error && hint}</span>
        {props.maxLength && <span>{len}/{props.maxLength}</span>}
      </div>
    </div>
  );
}

export function SelectField({
  label,
  error,
  help,
  className,
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} help={help} />
      <FieldShell id={id} error={error} iconRight="right-9">
        <select
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          {...props}
          className={fieldCls(error, "ui-select")}
        >
          {children}
        </select>
      </FieldShell>
    </div>
  );
}

/* ---------- Layout bits ---------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-xl border border-line bg-surface", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-surface-2", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

type Tone = "success" | "danger" | "warning" | "info" | "neutral" | "primary";
const tones: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

const statusTone: Record<string, Tone> = { draft: "neutral", sent: "info", paid: "success", overdue: "danger" };

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={statusTone[status] || "neutral"}>
      <span className="capitalize">{status}</span>
    </Badge>
  );
}

export function Alert({
  tone = "info",
  children,
  action,
}: {
  tone?: "info" | "danger" | "warning" | "success";
  children: ReactNode;
  action?: ReactNode;
}) {
  const icon: IconName = tone === "success" ? "checkCircle" : tone === "info" ? "alertCircle" : "alert";
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx("mb-4 flex items-start gap-3 rounded-lg px-4 py-3 text-sm", tones[tone])}
    >
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert tone="danger" action={onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button>}>
      {message}
    </Alert>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary",
        className
      )}
    >
      {initials(name)}
    </span>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
        <Icon name="search" />
      </span>
      <input
        type="search"
        aria-label={placeholder}
        className={cx(inputCls, "pl-9")}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({
  title,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Keep the latest onClose without re-running the focus/scroll-lock effect on every parent render
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      // Keep Tab focus inside the dialog
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])'
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden"; // lock background scroll
    ref.current?.querySelector<HTMLElement>("input,select,textarea")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          "animate-modal-in max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-2xl sm:rounded-2xl sm:p-6",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
      <span className="text-muted">
        {total} result{total === 1 ? "" : "s"}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
            <Icon name="chevronLeft" className="h-3.5 w-3.5" /> Prev
          </Button>
          <span className="text-muted">
            {page} / {pages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
            Next <Icon name="chevronRight" className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
