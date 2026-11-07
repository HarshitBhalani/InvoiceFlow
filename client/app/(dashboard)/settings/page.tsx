"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, errMsg } from "@/lib/api";
import { usePageTitle } from "@/lib/hooks";
import { CURRENCIES } from "@/lib/format";
import { useToast } from "@/components/providers";
import {
  Alert, Badge, Button, Card, FieldLabel, PageHeader, PasswordField, SelectField, TextField, TextareaField, cx, focusFirstInvalid,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { useTheme, type ThemeMode } from "@/components/ThemeToggle";
import { useShell, type User } from "../layout";

// The profile endpoint replaces every field it receives, so always send the full set
const profilePayload = (u: User, patch: Partial<User>) => {
  const m = { ...u, ...patch };
  return {
    name: m.name,
    businessName: m.businessName,
    address: m.address,
    currency: m.currency,
    defaultTaxRate: m.defaultTaxRate,
    accentColor: m.accentColor,
    template: m.template,
    autoReminders: m.autoReminders,
  };
};

function ProfileCard() {
  const { user, refreshUser } = useShell();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, businessName: user.businessName, address: user.address });
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = form.name !== user.name || form.businessName !== user.businessName || form.address !== user.address;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (form.name.trim().length < 2) {
      setErrors({ name: "Enter your name (at least 2 characters)" });
      return focusFirstInvalid(e.currentTarget);
    }
    setSaving(true);
    setFormError("");
    try {
      await api("/auth/profile", { method: "PATCH", body: JSON.stringify(profilePayload(user, form)) });
      toast.success("Profile saved");
      refreshUser();
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Profile and business details</h2>
      <p className="mb-5 mt-1 text-sm text-muted">These details appear in the &ldquo;From&rdquo; section of your invoices.</p>
      <form onSubmit={save} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <TextField label="Your name" value={form.name} error={errors.name} maxLength={80} autoComplete="name"
          onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors({}); }} />
        <div>
          <TextField label="Email" value={user.email} readOnly disabled help="Your login email. It cannot be changed here." />
          <p className="mt-1 text-xs">{user.emailVerified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Not verified yet</Badge>}</p>
        </div>
        <TextField label="Business name" optional value={form.businessName} maxLength={100} autoComplete="organization"
          help="Shown instead of your name at the top of each invoice."
          onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
        <TextareaField label="Business address" optional value={form.address} maxLength={300} autoComplete="street-address"
          help="Street, city, country, tax ID, anything your clients should see."
          onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted">{dirty ? "You have unsaved changes" : ""}</span>
          <Button type="submit" loading={saving} disabled={!dirty}>{saving ? "Saving..." : "Save changes"}</Button>
        </div>
      </form>
    </Card>
  );
}

function InvoiceDefaultsCard() {
  const { user, refreshUser } = useShell();
  const toast = useToast();
  const [form, setForm] = useState({
    currency: user.currency,
    defaultTaxRate: user.defaultTaxRate,
    template: user.template,
    accentColor: user.accentColor,
    autoReminders: user.autoReminders,
  });
  const [taxError, setTaxError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const pro = user.plan === "pro";
  const dirty = (Object.keys(form) as (keyof typeof form)[]).some((k) => form[k] !== user[k]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!(form.defaultTaxRate >= 0 && form.defaultTaxRate <= 100)) {
      setTaxError("Enter a rate between 0 and 100");
      return focusFirstInvalid(e.currentTarget);
    }
    setSaving(true);
    setFormError("");
    try {
      await api("/auth/profile", { method: "PATCH", body: JSON.stringify(profilePayload(user, form)) });
      toast.success("Invoice settings saved");
      refreshUser();
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Invoice settings</h2>
      <p className="mb-5 mt-1 text-sm text-muted">Defaults for new invoices, and how they look to your clients.</p>
      <form onSubmit={save} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Currency" value={form.currency} help="Used for all new invoices, expenses and reports. Existing invoices keep the currency they were created in."
            onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectField>
          <TextField label="Default tax rate (%)" type="number" inputMode="decimal" min={0} max={100} step="0.01"
            value={form.defaultTaxRate === 0 ? "" : form.defaultTaxRate} placeholder="0" error={taxError}
            help="Pre-filled on new invoices (VAT / GST / sales tax). You can change it per invoice."
            onChange={(e) => { setForm({ ...form, defaultTaxRate: e.target.value === "" ? 0 : Number(e.target.value) }); setTaxError(""); }} />
        </div>

        <div>
          <FieldLabel htmlFor="tpl" label="Template" help="Used for the PDF and the page your client opens." />
          <div id="tpl" role="radiogroup" className="grid grid-cols-2 gap-3">
            {(["classic", "modern"] as const).map((t) => (
              <button type="button" key={t} role="radio" aria-checked={form.template === t} onClick={() => setForm({ ...form, template: t })}
                className={cx("rounded-lg border p-3 text-left text-sm transition-colors", form.template === t ? "border-primary ring-2 ring-primary/25" : "border-line hover:bg-surface-2")}>
                <span className="mb-2 block h-10 rounded border border-line bg-surface-2">
                  <span className={cx("block h-3 rounded-t", t === "modern" ? "" : "opacity-0")} style={{ background: form.accentColor }} />
                </span>
                <span className="font-medium capitalize">{t}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="accent" label="Accent color" help="Used for headings and the pay button on your invoices." />
          <div className="flex items-center gap-3">
            <input id="accent" type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
              className="h-9 w-14 cursor-pointer rounded-lg border border-line bg-surface p-1" />
            <span className="font-mono text-sm text-muted">{form.accentColor}</span>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={form.autoReminders} disabled={!pro} onChange={(e) => setForm({ ...form, autoReminders: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
          <span>
            Automatically remind clients about overdue invoices {!pro && <Badge tone="primary">Pro</Badge>}
            <span className="block text-xs text-muted">
              Up to 3 emails: the day after the due date, then weekly.{" "}
              {!pro && <Link href="/billing" className="font-medium text-primary hover:underline">Upgrade to turn this on</Link>}
            </span>
          </span>
        </label>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted">{dirty ? "You have unsaved changes" : ""}</span>
          <Button type="submit" loading={saving} disabled={!dirty}>{saving ? "Saving..." : "Save settings"}</Button>
        </div>
      </form>
    </Card>
  );
}

function LogoCard() {
  const { user, refreshUser } = useShell();
  const toast = useToast();
  const [logo, setLogo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user.hasLogo) return;
    api<{ logo: string }>("/auth/logo").then((d) => setLogo(d.logo)).catch(() => {});
  }, [user.hasLogo]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setError("");
    if (!["image/png", "image/jpeg"].includes(file.type)) return setError("Logo must be a PNG or JPEG image.");
    if (file.size > 200 * 1024) return setError("Logo is too large. Please use an image under 200 KB.");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Could not read the file"));
      r.readAsDataURL(file);
    }).catch((err) => {
      setError(errMsg(err));
      return "";
    });
    if (!dataUrl) return;
    setBusy(true);
    try {
      await api("/auth/logo", { method: "PUT", body: JSON.stringify({ dataUrl }) });
      setLogo(dataUrl);
      toast.success("Logo saved");
      refreshUser();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api("/auth/logo", { method: "DELETE" });
      setLogo("");
      toast.success("Logo removed");
      refreshUser();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Logo</h2>
      <p className="mb-4 mt-1 text-sm text-muted">Shown at the top of your PDF invoices and the page your clients open. PNG or JPEG, up to 200 KB.</p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-40 items-center justify-center rounded-lg border border-dashed border-line bg-surface-2">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Your logo" className="max-h-16 max-w-36 object-contain" />
          ) : (
            <span className="text-xs text-muted">No logo</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onFile} />
          <Button variant="secondary" size="sm" loading={busy} onClick={() => input.current?.click()}>{logo ? "Replace logo" : "Upload logo"}</Button>
          {logo && <Button variant="ghost" size="sm" className="hover:!text-danger" disabled={busy} onClick={remove}>Remove</Button>}
        </div>
      </div>
    </Card>
  );
}

const THEMES: { value: ThemeMode; label: string; icon: IconName; hint: string }[] = [
  { value: "light", label: "Light", icon: "sun", hint: "Always light" },
  { value: "dark", label: "Dark", icon: "moon", hint: "Always dark" },
  { value: "system", label: "System", icon: "monitor", hint: "Match your device" },
];

function AppearanceCard() {
  const { mode, setMode } = useTheme();
  return (
    <Card className="p-6">
      <h2 className="font-semibold">Appearance</h2>
      <p className="mb-4 mt-1 text-sm text-muted">Choose how InvoiceFlow looks on this device.</p>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={mode === t.value}
            onClick={() => setMode(t.value)}
            className={cx(
              "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors",
              mode === t.value ? "border-primary bg-primary-soft text-primary ring-2 ring-primary/25" : "border-line hover:bg-surface-2"
            )}
          >
            <Icon name={t.icon} className="h-5 w-5" />
            <span className="font-medium">{t.label}</span>
            <span className="text-center text-xs text-muted">{t.hint}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const v: Partial<typeof form> = {};
    if (!form.currentPassword) v.currentPassword = "Enter your current password";
    if (form.newPassword.length < 8) v.newPassword = "Use at least 8 characters";
    else if (form.newPassword.length > 72) v.newPassword = "Use at most 72 characters";
    else if (form.newPassword === form.currentPassword) v.newPassword = "Choose a password different from the current one";
    if (form.confirm !== form.newPassword) v.confirm = "Passwords do not match";
    setErrors(v);
    if (Object.keys(v).length) return focusFirstInvalid(e.currentTarget);

    setSaving(true);
    setFormError("");
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      toast.success("Password changed");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      const msg = errMsg(err);
      if (/current password is incorrect/i.test(msg)) {
        setErrors({ currentPassword: msg });
        focusFirstInvalid(e.currentTarget);
      } else setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Change password</h2>
      <p className="mb-5 mt-1 text-sm text-muted">Use a password you do not use anywhere else.</p>
      <form onSubmit={save} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <PasswordField label="Current password" autoComplete="current-password" maxLength={72}
          value={form.currentPassword} error={errors.currentPassword} onChange={set("currentPassword")} />
        <PasswordField label="New password" autoComplete="new-password" maxLength={72}
          help="Use 8 to 72 characters. A mix of letters, numbers and symbols is safest."
          value={form.newPassword} error={errors.newPassword} onChange={set("newPassword")} />
        <PasswordField label="Confirm new password" autoComplete="new-password" maxLength={72}
          value={form.confirm} error={errors.confirm} onChange={set("confirm")} />
        <div className="flex justify-end pt-1">
          <Button type="submit" loading={saving}>{saving ? "Updating..." : "Update password"}</Button>
        </div>
      </form>
    </Card>
  );
}

export default function SettingsPage() {
  usePageTitle("Settings");
  const { user } = useShell();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account and how your invoices look."
        actions={<Badge tone="primary">{user.plan.toUpperCase()} plan</Badge>}
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ProfileCard />
          <LogoCard />
          <AppearanceCard />
        </div>
        <div className="space-y-6">
          <InvoiceDefaultsCard />
          <PasswordCard />
        </div>
      </div>
    </div>
  );
}
