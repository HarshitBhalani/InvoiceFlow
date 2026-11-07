"use client";
import { useState } from "react";
import Link from "next/link";
import { api, errMsg } from "@/lib/api";
import { usePageTitle } from "@/lib/hooks";
import { Alert, Button, TextField, focusFirstInvalid } from "@/components/ui";
import { Icon } from "@/components/Icon";

export default function ForgotPasswordPage() {
  usePageTitle("Forgot password");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address");
      return focusFirstInvalid(e.currentTarget);
    }
    setLoading(true);
    setFormError("");
    try {
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      setSent(true);
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
          <Icon name="mail" className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          If an account exists for <b className="text-fg">{email.trim()}</b>, we sent a link to reset your password. It is valid for 1 hour.
        </p>
        <p className="mt-6 text-sm text-muted">
          Nothing arrived? Check spam, or{" "}
          <button className="font-medium text-primary hover:underline" onClick={() => setSent(false)}>
            try again
          </button>
          .
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Enter your email and we will send you a link to choose a new one.</p>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <form onSubmit={submit} noValidate className="space-y-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          error={error}
          maxLength={254}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
        />
        <Button type="submit" loading={loading} className="w-full">
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
