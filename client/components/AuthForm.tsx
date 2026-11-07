"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, errMsg } from "@/lib/api";
import { usePageTitle } from "@/lib/hooks";
import { Alert, Button, PasswordField, TextField, focusFirstInvalid } from "@/components/ui";

type Fields = { name: string; email: string; password: string };
type Errors = Partial<Record<keyof Fields, string>>;

function validate(mode: "login" | "signup", f: Fields): Errors {
  const e: Errors = {};
  if (mode === "signup" && f.name.trim().length < 2) e.name = "Enter your name (at least 2 characters)";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email address";
  if (mode === "signup") {
    if (f.password.length < 8) e.password = "Use at least 8 characters";
    else if (f.password.length > 72) e.password = "Use at most 72 characters";
  } else if (!f.password) e.password = "Enter your password";
  return e;
}

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const isSignup = mode === "signup";
  usePageTitle(isSignup ? "Create account" : "Log in");

  const [form, setForm] = useState<Fields>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  // Already logged in? Skip the form.
  // Next.js keeps a visited page alive in the background and shows it again with its OLD state when you come back.
  // After logging out that meant a spinner stuck on the demo button and the previously typed password still in the form.
  // So the form starts clean every time this page appears (effects run again when a hidden page becomes visible),
  // and also when the browser restores it with the Back button.
  useEffect(() => {
    const reset = () => {
      setForm({ name: "", email: "", password: "" });
      setErrors({});
      setFormError("");
      setLoading(false);
      setDemoLoading(false);
    };
    reset();
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) reset();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    api("/auth/me")
      .then(() => router.replace("/dashboard"))
      .catch(() => {});
  }, [router]);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };

  async function submit(path: string, body: object, setBusy: (b: boolean) => void) {
    setFormError("");
    setBusy(true);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      // Full page load on purpose: it wipes everything in memory from any previous account (see the note above)
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
    } catch (err) {
      setFormError(errMsg(err));
      setBusy(false); // keep the button disabled while redirecting; re-enable only on failure
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // double-submit guard
    const v = validate(mode, form);
    setErrors(v);
    if (Object.keys(v).length) return focusFirstInvalid(e.currentTarget);
    submit(
      `/auth/${mode}`,
      { ...form, email: form.email.trim(), name: form.name.trim() },
      setLoading
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        {isSignup ? "Start invoicing in under a minute. Free for your first 5 invoices." : "Log in to manage your invoices."}
      </p>

      {params.get("session") === "expired" && !formError && <Alert tone="warning">Your session expired. Please log in again.</Alert>}
      {formError && <Alert tone="danger">{formError}</Alert>}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {isSignup && (
          <TextField label="Name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} maxLength={80} />
        )}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={form.email}
          onChange={set("email")}
          error={errors.email}
          maxLength={254}
        />
        <PasswordField
          label="Password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          value={form.password}
          onChange={set("password")}
          error={errors.password}
          hint={isSignup ? "At least 8 characters" : undefined}
          help={isSignup ? "Use 8 to 72 characters. A mix of letters, numbers and symbols is safest." : undefined}
          maxLength={72}
        />
        {!isSignup && (
          <div className="-mt-2 text-right">
            <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        )}
        <Button type="submit" loading={loading} disabled={demoLoading} className="w-full">
          {loading ? "Please wait..." : isSignup ? "Create account" : "Log in"}
        </Button>
      </form>

      {!isSignup && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <Button
            variant="secondary"
            className="w-full"
            loading={demoLoading}
            disabled={loading}
            onClick={() => submit("/auth/demo", {}, setDemoLoading)}
          >
            Try the demo account
          </Button>
          <p className="mt-2 text-center text-xs text-muted">A private workspace with sample data. No sign-up needed.</p>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        {isSignup ? "Already have an account?" : "New to InvoiceFlow?"}{" "}
        <Link className="font-medium text-primary hover:underline" href={isSignup ? "/login" : "/signup"}>
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
