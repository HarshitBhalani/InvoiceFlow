const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.requireAuth = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Please log in to continue" });

  let id, iat;
  try {
    // Pin the algorithm so a forged token cannot pick a weaker one
    ({ id, iat } = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] }));
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }

  try {
    const user = await User.findById(id);
    if (!user) return res.status(401).json({ error: "Your session has expired. Please log in again." });
    if (user.banned) return res.status(403).json({ error: "Your account has been suspended" });
    // Changing or resetting the password logs out every other session
    if (user.passwordChangedAt && iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      return res.status(401).json({ error: "Your session has expired. Please log in again." });
    }
    req.user = user;
    next();
  } catch (e) {
    next(e); // a database problem is a 500, not a "logged out" 401
  }
};

exports.requireRole = (role) => (req, res, next) =>
  req.user?.role === role ? next() : res.status(403).json({ error: "You do not have access to this" });
