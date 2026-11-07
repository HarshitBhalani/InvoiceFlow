"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, errMsg } from "@/lib/api";
import { usePageTitle } from "@/lib/hooks";
import { Alert, Button, PasswordField, focusFirstInvalid } from "@/components/ui";
import { Icon } from "@/components/Icon";

function ResetForm() {
  usePageTitle("Reset password");
  const token = useSearchParams().get("token") || "";
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div>
        <Alert tone="danger">This reset link is incomplete. Request a new one.</Alert>
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">Request a new link</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
          <Icon name="checkCircle" className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Password updated</h1>
        <p className="mt-2 text-sm text-muted">You can now log in with your new password.</p>
        <Link href="/login" className="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg hover:bg-primary-hover">
          Go to log in
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const v: Partial<typeof form> = {};
    if (form.password.length < 8) v.password = "Use at least 8 characters";
    else if (form.password.length > 72) v.password = "Use at most 72 characters";
    if (form.confirm !== form.password) v.confirm = "Passwords do not match";
    setErrors(v);
    if (Object.keys(v).length) return focusFirstInvalid(e.currentTarget);

    setLoading(true);
    setFormError("");
    try {
      await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password: form.password }) });
      setDone(true);
    } catch (err) {
      setFormError(errMsg(err));
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Pick something you do not use anywhere else.</p>
      {formError && (
        <Alert tone="danger" action={<Link href="/forgot-password" className="font-semibold underline">New link</Link>}>
          {formError}
        </Alert>
      )}
      <form onSubmit={submit} noValidate className="space-y-4">
        <PasswordField label="New password" autoComplete="new-password" maxLength={72} value={form.password} error={errors.password}
          help="Use 8 to 72 characters. A mix of letters, numbers and symbols is safest."
          onChange={(e) => { setForm({ ...form, password: e.target.value }); setErrors({ ...errors, password: undefined }); }} />
        <PasswordField label="Confirm new password" autoComplete="new-password" maxLength={72} value={form.confirm} error={errors.confirm}
          onChange={(e) => { setForm({ ...form, confirm: e.target.value }); setErrors({ ...errors, confirm: undefined }); }} />
        <Button type="submit" loading={loading} className="w-full">{loading ? "Saving..." : "Update password"}</Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
