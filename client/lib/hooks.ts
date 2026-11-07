import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMsg, isAbort } from "./api";

export function useDebounce<T>(value: T, delay = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

// Fetches `path` and refetches when it changes. Keeps the previous data on screen while loading
// (smooth pagination) and ignores responses from outdated requests (no out-of-order results).
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({
    data: null,
    error: "",
    loading: !!path,
  });
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++reqId.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = await api<T>(path);
      if (id === reqId.current) setState({ data, error: "", loading: false });
    } catch (e) {
      if (id === reqId.current && !isAbort(e)) setState((s) => ({ ...s, error: errMsg(e), loading: false }));
    }
  }, [path]);

  useEffect(() => {
    load();
    const ref = reqId;
    return () => {
      ref.current++; // invalidate in-flight request on change/unmount
    };
  }, [load]);

  return { ...state, reload: load };
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · InvoiceFlow`;
  }, [title]);
}
