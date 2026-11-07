const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

const cookieOptions = () => {
  const prod = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? "none" : "lax", // "none" needed when client/server are on different domains
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};

const sendToken = (res, user) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie("token", token, cookieOptions());
};

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, plan: u.plan });

router.post("/signup", async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);
    if (await User.findOne({ email: data.email })) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await User.create({ name: data.name, email: data.email, passwordHash });
    sendToken(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ email: data.email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    sendToken(res, user);
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", cookieOptions());
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

module.exports = router;
