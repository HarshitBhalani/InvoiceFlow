const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const User = require("../models/User");
const { CURRENCIES } = require("../models/User");
const { requireAuth, blockDemo } = require("../middleware/auth");
const { createDemoWorkspace, deleteExpiredDemos, MAX_ACTIVE_DEMOS } = require("../lib/demoData");
const { createToken, hash } = require("../lib/tokens");
const { sendEmail, layout, esc, clientUrl } = require("../lib/email");

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const HOUR = 60 * 60 * 1000;

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  email,
  // bcrypt only uses the first 72 bytes, so longer passwords would silently be truncated
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be at most 72 characters"),
});
const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(72, "Invalid email or password"),
});
const newPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

const cookieOptions = () => {
  const prod = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: prod,
    // "lax" is the safe default and works with the Vercel /api proxy (the cookie is first-party).
    // Only set COOKIE_SAMESITE=none if the browser talks to the API on a different domain directly.
    sameSite: prod && process.env.COOKIE_SAMESITE === "none" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};

const sendToken = (res, user, { expiresIn = "7d", maxAge } = {}) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn, algorithm: "HS256" });
  res.cookie("token", token, { ...cookieOptions(), ...(maxAge ? { maxAge } : {}) });
};

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  plan: u.plan,
  businessName: u.businessName || "",
  address: u.address || "",
  hasLogo: !!u.hasLogo,
  accentColor: u.accentColor || "#4f46e5",
  template: u.template || "classic",
  currency: u.currency || "USD",
  defaultTaxRate: u.defaultTaxRate || 0,
  autoReminders: !!u.autoReminders,
  // Accounts created before verification existed have no value and count as verified
  emailVerified: u.emailVerified !== false,
  isDemo: !!u.isDemo,
  tourDone: !!u.tourDone,
});

// Used to keep login timing similar whether or not the email exists
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

async function sendVerificationEmail(user) {
  const t = createToken(24 * HOUR);
  await User.updateOne({ _id: user._id }, { verifyTokenHash: t.hash, verifyExpires: t.expires });
  const url = `${clientUrl()}/verify-email?token=${t.raw}`;
  await sendEmail({
    to: user.email,
    subject: "Verify your InvoiceFlow email",
    text: `Hi ${user.name}, confirm your email: ${url} (valid for 24 hours)`,
    html: layout({
      title: "Confirm your email",
      bodyHtml: `<p>Hi ${esc(user.name)}, thanks for signing up. Please confirm your email address to start sending invoices.</p>`,
      button: { label: "Verify email", url },
      footer: "This link is valid for 24 hours. If you did not create an account, ignore this email.",
    }),
  });
}

router.post("/signup", async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);
    if (await User.findOne({ email: data.email })) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await User.create({ name: data.name, email: data.email, passwordHash, emailVerified: false });
    sendToken(res, user);
    // Do not make signup wait on (or fail because of) the email provider
    sendVerificationEmail(user).catch((e) => console.error("Verification email failed:", e.message));
    res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

// "Try the demo account": a fresh private workspace with sample data, no sign-up needed. Deleted after 24 hours.
router.post("/demo", async (req, res, next) => {
  try {
    deleteExpiredDemos().catch((e) => console.error("Demo cleanup failed:", e.message)); // tidy up in the background
    if ((await User.countDocuments({ isDemo: true })) >= MAX_ACTIVE_DEMOS) {
      return res.status(503).json({ error: "The demo is busy right now. Please try again in a few minutes, or create a free account." });
    }
    const user = await createDemoWorkspace();
    sendToken(res, user, { expiresIn: "24h", maxAge: 24 * 60 * 60 * 1000 });
    res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ email: data.email }).select("+passwordHash");
    const ok = await bcrypt.compare(data.password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: "Invalid email or password" });
    if (user.banned) return res.status(403).json({ error: "Your account has been suspended" });
    sendToken(res, user);
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post("/logout", (req, res) => {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie("token", opts);
  res.json({ ok: true });
});

/* ---------- Email verification ---------- */
router.post("/verify-email", async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(10).max(200) }).parse(req.body);
    const user = await User.findOne({ verifyTokenHash: hash(token), verifyExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ error: "This verification link is invalid or has expired." });
    user.emailVerified = true;
    user.verifyTokenHash = undefined;
    user.verifyExpires = undefined;
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/resend-verification", requireAuth, async (req, res, next) => {
  try {
    if (req.user.emailVerified !== false) return res.json({ ok: true, alreadyVerified: true });
    // At most one verification email per minute (the token expiry tells us when the last one was issued)
    const u = await User.findById(req.user._id).select("+verifyExpires");
    if (u?.verifyExpires && Date.now() - (u.verifyExpires.getTime() - 24 * HOUR) < 60 * 1000) {
      return res.status(429).json({ error: "Please wait a minute before requesting another email." });
    }
    await sendVerificationEmail(req.user);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------- Forgot / reset password ---------- */
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email: addr } = z.object({ email }).parse(req.body);
    const user = await User.findOne({ email: addr });
    if (user && !user.banned) {
      const t = createToken(HOUR);
      await User.updateOne({ _id: user._id }, { resetTokenHash: t.hash, resetExpires: t.expires });
      const url = `${clientUrl()}/reset-password?token=${t.raw}`;
      sendEmail({
        to: user.email,
        subject: "Reset your InvoiceFlow password",
        text: `Reset your password: ${url} (valid for 1 hour). If you did not ask for this, ignore this email.`,
        html: layout({
          title: "Reset your password",
          bodyHtml: `<p>Hi ${esc(user.name)}, we received a request to reset your password.</p>`,
          button: { label: "Choose a new password", url },
          footer: "This link is valid for 1 hour. If you did not request it, you can ignore this email.",
        }),
      }).catch((e) => console.error("Reset email failed:", e.message));
    }
    // Same answer whether or not the account exists, so this cannot be used to find registered emails
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const data = z.object({ token: z.string().min(10).max(200), password: newPassword }).parse(req.body);
    const user = await User.findOne({ resetTokenHash: hash(data.token), resetExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one." });
    user.passwordHash = await bcrypt.hash(data.password, 12);
    user.passwordChangedAt = new Date(); // signs out every existing session
    user.resetTokenHash = undefined;
    user.resetExpires = undefined;
    if (user.emailVerified === false) user.emailVerified = true; // they proved they own the mailbox
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------- Profile ---------- */
const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  businessName: z.string().trim().max(100, "Business name is too long").default(""),
  address: z.string().trim().max(300, "Address is too long (max 300 characters)").default(""),
  currency: z.enum(CURRENCIES, { error: "Unsupported currency" }).default("USD"),
  defaultTaxRate: z.coerce.number({ error: "Tax rate must be a number" }).min(0, "Tax rate cannot be negative").max(100, "Tax rate cannot exceed 100%").default(0),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid color").default("#4f46e5"),
  template: z.enum(["classic", "modern"], { error: "Unknown template" }).default("classic"),
  autoReminders: z.boolean().default(false),
});

router.patch("/profile", requireAuth, async (req, res, next) => {
  try {
    const data = profileSchema.parse(req.body);
    // Automatic reminders are a Pro feature
    if (data.autoReminders && req.user.isDemo) {
      return res.status(403).json({ error: "Automatic reminders are not available in the demo.", code: "DEMO_MODE" });
    }
    if (data.autoReminders && req.user.plan !== "pro") {
      return res.status(403).json({ error: "Automatic reminders are a Pro feature", code: "PLAN_LIMIT" });
    }
    Object.assign(req.user, data);
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  } catch (e) {
    next(e);
  }
});

// Logo is stored as a small data URL (max ~200 KB) so no file storage service is needed
const logoSchema = z.object({
  dataUrl: z
    .string()
    .max(300_000, "Logo is too large (max about 200 KB)")
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, "Logo must be a PNG or JPEG image"),
});

router.get("/logo", requireAuth, async (req, res, next) => {
  try {
    const u = await User.findById(req.user._id).select("+logo");
    res.json({ logo: u?.hasLogo ? u.logo : "" });
  } catch (e) {
    next(e);
  }
});

router.put("/logo", requireAuth, async (req, res, next) => {
  try {
    const { dataUrl } = logoSchema.parse(req.body);
    await User.updateOne({ _id: req.user._id }, { logo: dataUrl, hasLogo: true });
    req.user.hasLogo = true;
    res.json({ user: publicUser(req.user) });
  } catch (e) {
    next(e);
  }
});

router.delete("/logo", requireAuth, async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { logo: "", hasLogo: false });
    req.user.hasLogo = false;
    res.json({ user: publicUser(req.user) });
  } catch (e) {
    next(e);
  }
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(72),
  newPassword: newPassword.refine(() => true),
});

router.post("/change-password", requireAuth, blockDemo("Changing the password"), async (req, res, next) => {
  try {
    const { currentPassword, newPassword: next_ } = passwordSchema.parse(req.body);
    const user = await User.findById(req.user._id).select("+passwordHash");
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(400).json({ error: "Current password is incorrect", field: "currentPassword" });
    }
    if (currentPassword === next_) {
      return res.status(400).json({ error: "New password must be different from the current one", field: "newPassword" });
    }
    user.passwordHash = await bcrypt.hash(next_, 12);
    user.passwordChangedAt = new Date(); // other devices are signed out, this one gets a fresh token below
    await user.save();
    sendToken(res, user);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// The product tour was finished or skipped: do not open it by itself again
router.post("/tour-done", requireAuth, async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { tourDone: true });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get("/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

module.exports = router;
module.exports.publicUser = publicUser;
