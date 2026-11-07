const crypto = require("crypto");

// Raw token goes in the email link; only its SHA-256 hash is stored, so a DB leak cannot be used to reset accounts.
const hash = (raw) => crypto.createHash("sha256").update(raw).digest("hex");

function createToken(ttlMs) {
  const raw = crypto.randomBytes(32).toString("hex");
  return { raw, hash: hash(raw), expires: new Date(Date.now() + ttlMs) };
}

module.exports = { hash, createToken, randomId: () => crypto.randomBytes(18).toString("base64url") };
