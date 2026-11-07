"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { Button, Modal, cx } from "./ui";

/* ---------- Toasts ---------- */
type ToastItem = { id: number; type: "success" | "error" | "info"; message: string };
type ToastApi = { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };

const ToastContext = createContext<ToastApi | null>(null);
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <Providers>");
  return ctx;
};

/* ---------- Confirm dialog (promise based, replaces window.confirm) ---------- */
type ConfirmOptions = { title: string; message?: string; confirmText?: string; danger?: boolean };
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);
export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <Providers>");
  return ctx;
};

export function Providers({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const push = useCallback((type: ToastItem["type"], message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-3), { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 6000 : 3500);
  }, []);

  const toast = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push]
  );

  const confirm = useCallback<ConfirmFn>(
    (o) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })),
    []
  );

  const answer = useCallback(
    (v: boolean) => {
      pending?.resolve(v);
      setPending(null);
    },
    [pending]
  );

  // Resolve as "cancelled" if the provider unmounts while a dialog is open
  useEffect(() => () => pending?.resolve(false), [pending]);

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}

        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 print:hidden"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role={t.type === "error" ? "alert" : "status"}
              className={cx(
                "animate-toast-in pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-sm shadow-lg",
                t.type === "error" ? "border-danger/40" : t.type === "success" ? "border-success/40" : "border-line"
              )}
            >
              <Icon
                name={t.type === "error" ? "alert" : t.type === "success" ? "checkCircle" : "alertCircle"}
                className={cx(
                  "mt-0.5 h-4 w-4 shrink-0",
                  t.type === "error" ? "text-danger" : t.type === "success" ? "text-success" : "text-info"
                )}
              />
              <span>{t.message}</span>
            </div>
          ))}
        </div>

        {pending && (
          <Modal title={pending.title} onClose={() => answer(false)}>
            {pending.message && <p className="mb-5 text-sm text-muted">{pending.message}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => answer(false)}>
                Cancel
              </Button>
              <Button variant={pending.danger ? "danger" : "primary"} onClick={() => answer(true)}>
                {pending.confirmText || "Confirm"}
              </Button>
            </div>
          </Modal>
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}
