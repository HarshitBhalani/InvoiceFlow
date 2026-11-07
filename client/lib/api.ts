const API = process.env.NEXT_PUBLIC_API_URL || "/api"; // "/api" = the same-origin proxy used in production

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Calls that are allowed to return 401 without kicking the user to the login page
const AUTH_PATHS = ["/auth/login", "/auth/signup", "/auth/me"];

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      credentials: "include", // send the httpOnly cookie
      headers: { "Content-Type": "application/json", ...options.headers },
      // Render's free tier can take ~30-50s to wake up, so be generous
      signal: options.signal ?? AbortSignal.timeout(60_000),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
    throw new ApiError(
      timedOut
        ? "The server is taking too long to respond. Please try again."
        : "Can't reach the server. Check your connection and try again.",
      0
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && !AUTH_PATHS.some((p) => path.startsWith(p)) && typeof window !== "undefined") {
      // Hard navigation on purpose: also clears any stale in-memory state
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login?session=expired");
    }
    const fallback =
      res.status >= 500 ? "Something went wrong on our side. Please try again." : "Request failed. Please try again.";
    throw new ApiError(data.error || fallback, res.status, data.code);
  }
  return data as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

// Downloads a file the API returns (e.g. CSV). Uses fetch so the auth cookie is sent and errors can be shown.
export async function downloadFile(path: string, filename: string) {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { credentials: "include", signal: AbortSignal.timeout(60_000) });
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection and try again.", 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || "Download failed. Please try again.", res.status);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
