// Stripe has two worlds: TEST (sandbox, fake money) and LIVE (real money). Mixing them up is expensive,
// so this module decides, in one place, which world this server is allowed to talk to.
//
//   Key starts with        Where it may run
//   sk_test_ / rk_test_    anywhere (local, development, staging, production demo)
//   sk_live_ / rk_live_    ONLY when NODE_ENV=production AND STRIPE_ALLOW_LIVE=true
//
// A live key on a laptop or a dev server therefore stops the server from starting instead of charging real cards.

function stripeMode(env = process.env) {
  const key = env.STRIPE_SECRET_KEY || "";
  if (!key) return null; // Stripe not configured (the rest of the app still works)
  if (/^(sk|rk)_test_/.test(key)) return "test";
  if (/^(sk|rk)_live_/.test(key)) return "live";
  return "unknown";
}

// Returns "test", "live" or null. Throws a readable Error when the combination is not allowed.
function assertStripeModeAllowed(env = process.env) {
  const mode = stripeMode(env);
  if (mode === null || mode === "test") return mode;

  if (mode === "unknown") {
    throw new Error("STRIPE_SECRET_KEY does not look like a Stripe secret key (it should start with sk_test_ or sk_live_).");
  }

  if (env.NODE_ENV !== "production") {
    throw new Error(
      "Refusing to start: STRIPE_SECRET_KEY is a LIVE key (sk_live_...) but NODE_ENV is not 'production'.\n" +
        "Local and development must use Stripe TEST (sandbox) keys (sk_test_...). Real cards could be charged otherwise."
    );
  }
  if (env.STRIPE_ALLOW_LIVE !== "true") {
    throw new Error(
      "Refusing to start: STRIPE_SECRET_KEY is a LIVE key (sk_live_...). Live payments are off unless you explicitly set STRIPE_ALLOW_LIVE=true."
    );
  }
  return "live";
}

module.exports = { stripeMode, assertStripeModeAllowed };
