const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(id);
    if (!user) return res.status(401).json({ error: "User not found" });
    if (user.banned) return res.status(403).json({ error: "Your account has been suspended" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

exports.requireRole = (role) => (req, res, next) =>
  req.user?.role === role ? next() : res.status(403).json({ error: "Forbidden" });
