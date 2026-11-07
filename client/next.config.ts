import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers for every page. (Vercel adds HSTS automatically on HTTPS.)
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" }, // nobody can embed the app in an iframe (clickjacking)
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];
    return [
      { source: "/:path*", headers: [...common, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] },
      // Public invoice links contain a secret token: never leak it via the Referer header, never index it
      {
        source: "/i/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      // Private app and auth pages should not appear in search results
      ...["dashboard", "invoices", "clients", "expenses", "reports", "settings", "billing", "admin", "reset-password", "verify-email"].map((p) => ({
        source: `/${p}/:path*`,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
  devIndicators: false, // the floating dev-only badge covers the top-right of the app header
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
