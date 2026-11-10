"use client";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { IconButton } from "./ui";

export type ThemeMode = "light" | "dark" | "system";
const KEY = "theme";
const EVENT = "themechange";

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function readMode(): ThemeMode {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system"; // nothing stored = follow the device
  } catch {
    return "system";
  }
}

function apply(mode: ThemeMode): "light" | "dark" {
  const dark = mode === "dark" || (mode === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
  return dark ? "dark" : "light";
}

// Shared by the header button and the Settings picker; they stay in sync through a window event
export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const sync = () => {
      const m = readMode();
      setModeState(m);
      setResolved(apply(m));
    };
    sync();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync); // device switched while on "system"
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync); // changed in another tab
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    try {
      if (m === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, m);
    } catch {
      /* private mode: the theme still applies for this visit */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { mode, resolved, setMode };
}

export function ThemeToggle() {
  const { resolved, setMode } = useTheme();
  const dark = resolved === "dark";
  return (
    <IconButton
      icon={dark ? "sun" : "moon"}
      label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setMode(dark ? "light" : "dark")}
    />
  );
}

// Sets the theme before first paint to avoid a light/dark flash
export const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=(t==='light'||t==='dark')?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center font-bold tracking-tight ${className}`}>
      InvoiceFlow
    </span>
  );
}
