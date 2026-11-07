const API = process.env.NEXT_PUBLIC_API_URL;

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    credentials: "include", // send the httpOnly cookie
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
