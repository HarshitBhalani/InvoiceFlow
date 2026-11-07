# InvoiceFlow

**A full-stack invoicing SaaS for freelancers and small businesses.** Create professional invoices, email them to clients, let clients pay online, track what is paid, pending or overdue, and see your profit, all in one place.

> Built as a complete, production-style SaaS project: authentication, subscription billing, online payments, background jobs, an admin panel and a security-hardened API.

**Live demo:** _add Vercel URL_  
**Demo login:** `demo@invoiceflow.com` / `demo1234` (Pro plan, pre-filled data)  
**Walkthrough video:** _add Loom link_

> Stripe runs in **test mode**. Use card `4242 4242 4242 4242`, any future expiry date, any CVC. Nothing is ever charged.

## Screenshots
_Add 3 or 4 screenshots here (dashboard, invoice page, public pay page, reports, dark mode)._

---

## What is this product for?

Freelancers, consultants and small agencies usually invoice from Word or Excel, then chase payments by hand. InvoiceFlow replaces that:

1. **Add a client** once.
2. **Create an invoice** with line items, tax and a due date. Totals are calculated for you.
3. **Email it** to the client. They open a clean invoice page and can **pay by card** right there.
4. The invoice flips to **Paid** automatically. Late invoices are flagged **Overdue**, and Pro users can send **automatic reminders**.
5. Your **dashboard and reports** show revenue, expenses and profit.

It is also a reference for how a real SaaS is put together end to end (auth, payments, webhooks, plans and limits, admin, security, deployment).

### Plans
| | Free | Pro ($19 / month) |
|---|---|---|
| Invoices | up to 5 | unlimited |
| Clients, dashboard, reports, PDF, CSV export | yes | yes |
| Email invoices and online payment links | yes | yes |
| Recurring invoices | no | yes |
| Automatic overdue reminders | no | yes |

---

## Features

> User guide: run the app and open `/docs` for the in-app help and documentation (getting started, invoices, payments, recurring, reports, plans, FAQ).

**Invoicing**
- Clients and invoices with full CRUD, search, status filters and pagination
- Line items with **tax (VAT / GST / sales tax)** and totals always calculated on the server
- Account currency: USD, EUR, GBP, INR, CAD, AUD
- Statuses: draft, sent, paid, overdue (a sent invoice past its due date becomes overdue automatically)
- **PDF download** with your logo, accent color and a choice of two templates
- Printable invoice page, duplicate invoice, CSV export

**Getting paid**
- **Email invoices** to clients (replies go to you)
- **Public invoice link** (`/i/<token>`): clients view the invoice and pay with **Stripe Checkout**, no account needed
- Payment is confirmed two ways (verified webhook and a direct check with Stripe), so a late or missing webhook never leaves an invoice unpaid
- **Recurring invoices** and **automatic overdue reminders** run by background jobs (Pro)

**Money overview**
- Dashboard: revenue, pending and overdue totals, monthly revenue chart, status chart, recent invoices
- **Expenses** with categories, plus a **profit and loss report** (revenue minus expenses by month and category)

**Accounts and billing**
- Sign up, log in, **forgot / reset password**, **email verification**
- **Free and Pro plans** with Stripe subscriptions, Customer Portal (change card, cancel) and plan limits
- Settings: profile, business name and address, logo, template, currency, default tax, reminders, change password

**Admin panel**
- User list with search, plan filter and ban / unban
- MRR, total and Pro users, conversion rate, signups chart

**Interface**
- Landing page, **light, dark and system theme**, responsive layout (tables become cards on phones)
- Toasts, confirm dialogs, skeleton loaders, empty and error states with retry
- Forms with inline validation, tooltip error messages, focus on the first invalid field, show / hide password

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS 4**, **Recharts** |
| Backend | **Node.js 20+**, **Express 5**, **Mongoose 9**, **Zod** (validation), **PDFKit** (PDF generation) |
| Database | **MongoDB** (Atlas free tier) |
| Auth | **JWT** in an `httpOnly` cookie, **bcrypt** password hashing |
| Security | **Helmet**, **express-rate-limit**, CORS, CSRF origin and content-type checks |
| Fonts | Inter (text) and Plus Jakarta Sans (headings) via `next/font` |

## Integrations

| Service | Used for | Required? |
|---|---|---|
| **MongoDB Atlas** | Database | Yes |
| **Stripe** | Pro subscriptions (Checkout, webhooks, Customer Portal) and client invoice payments | Optional locally, needed for payments |
| **Resend** | Sending emails (invoices, reminders, verification, password reset) | Optional locally (emails print to the server console), needed in production |
| **Stripe CLI** | Forwarding webhooks to your machine while developing | Optional |
| **Vercel** | Hosting the Next.js frontend | For deployment |
| **Render** | Hosting the Express API | For deployment |
| **cron-job.org** (or similar) | Triggering background jobs when the host sleeps | For deployment on a free tier |

---

## Architecture

```
Browser ──> Next.js (Vercel) ──/api/* proxy──> Express API (Render) ──> MongoDB Atlas
                                                    ^         |
                                 Stripe webhooks ───┘         └──> Resend (email)
                                 (signature verified)         └──> Stripe API (Checkout, subscriptions)
```

- In production the browser only talks to the Vercel domain. A Next.js route handler (`client/app/api/[...path]/route.ts`) proxies `/api/*` to the backend, so the login cookie is first-party and works in Safari and Brave.
- The proxy also passes the visitor's real IP to the API together with a shared secret (`PROXY_SECRET`). The API only believes that IP when the secret matches, which is what makes per-IP rate limits correct and impossible to spoof.
- The Stripe webhook route is mounted **before** `express.json()` because signature verification needs the raw request body.
- Background jobs (recurring invoices, reminders) claim work with an atomic database update first, so running them twice never double-sends.

---

## Stripe test mode vs live mode (safety)
Locally and in development the app only ever talks to Stripe's **test (sandbox)** world, where no real money moves.

| Key you put in `STRIPE_SECRET_KEY` | What happens |
|---|---|
| `sk_test_...` | Works anywhere (local, development, a production demo) |
| `sk_live_...` outside production | **The server refuses to start**, with a clear message |
| `sk_live_...` in production | Refused too, unless you also set `STRIPE_ALLOW_LIVE=true` |

Extra protections: the server asks Stripe which mode the key belongs to and shuts down on a mismatch, ignores webhook events from the other mode, and only shows "test mode" hints in the UI when the key really is a test key. The Stripe CLI (`stripe listen`) forwards test events by default. Never use its `--live` flag locally.

When you eventually go live: use a **separate MongoDB database**, create the product and price again in live mode (price IDs differ between test and live), create a new live webhook endpoint with its own secret, and then set `STRIPE_ALLOW_LIVE=true`. Saved test customer IDs are replaced automatically the next time a user starts a checkout.

---

## Environment variables

**`server/.env`**

| Name | Required | Purpose |
|---|---|---|
| `MONGO_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Signs login tokens. At least 32 random characters |
| `CLIENT_URL` | yes | Frontend URL, no trailing slash (CORS, email links, Stripe redirects). Local: `http://localhost:3000` |
| `PORT` | no | API port (default 5000) |
| `NODE_ENV` | prod | Set to `production` when deployed |
| `STRIPE_SECRET_KEY` | for payments | Stripe secret key |
| `STRIPE_PRO_PRICE_ID` | for payments | Price ID of the Pro plan |
| `STRIPE_WEBHOOK_SECRET` | for payments | Webhook signing secret (`whsec_...`) |
| `STRIPE_ALLOW_LIVE` | no | Set to `true` **only in production** to allow a live Stripe key (`sk_live_...`). Without it a live key is refused |
| `FREE_INVOICE_LIMIT` | no | Invoices allowed on Free (default 5) |
| `PRO_PRICE_USD` | no | Pro price, only used to calculate MRR in the admin panel (default 19) |
| `RESEND_API_KEY` | for email | Resend API key. Empty in dev = emails print to the console |
| `EMAIL_FROM` | no | Sender, e.g. `InvoiceFlow <noreply@yourdomain.com>`. Resend's default sender can only email your own address until you verify a domain |
| `CRON_SECRET` | for jobs | Secret for `POST /api/cron/run` |
| `DISABLE_INTERNAL_JOBS` | no | `true` to turn off the hourly in-process job timer |
| `SEED_ADMIN_PASSWORD` | no | Admin password used by `npm run seed` (random if unset) |
| `PROXY_SECRET` | prod | Shared secret with the Vercel `/api` proxy (use the **same value** on Vercel). Without it all visitors behind Vercel share one rate limit |
| `COOKIE_SAMESITE` | no | Set `none` only if the browser calls the API on a different domain directly |

**`client/.env.local`**

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000/api` locally, `/api` in production |
| `BACKEND_URL` | Production only: the Render URL the `/api` proxy forwards to |
| `PROXY_SECRET` | Production only: same value as on the API |

Never commit `.env` files. They are in `.gitignore`.

---

## API overview

All routes are under `/api`. Everything except `auth`, `public`, `webhooks` and `health` needs a logged-in session.

| Area | Routes |
|---|---|
| Auth | `POST /auth/signup`, `/auth/login`, `/auth/logout`, `GET /auth/me`, `POST /auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/change-password`, `PATCH /auth/profile`, `GET/PUT/DELETE /auth/logo` |
| Clients | `GET/POST /clients`, `PUT/DELETE /clients/:id`, `GET /clients/options` |
| Invoices | `GET/POST /invoices`, `GET/PUT/DELETE /invoices/:id`, `PATCH /invoices/:id/status`, `POST /invoices/:id/send`, `POST /invoices/:id/link`, `PUT /invoices/:id/recurring`, `GET /invoices/:id/pdf`, `GET /invoices/export` |
| Expenses | `GET/POST /expenses`, `PUT/DELETE /expenses/:id`, `GET /expenses/export` |
| Reports | `GET /dashboard/stats`, `GET /reports/pnl` |
| Billing | `GET /billing/status`, `POST /billing/checkout`, `/billing/portal`, `/billing/sync` |
| Public (no login) | `GET /public/invoices/:token`, `POST /public/invoices/:token/pay`, `/public/invoices/:token/confirm` |
| Admin | `GET /admin/users`, `PATCH /admin/users/:id/ban`, `GET /admin/stats` |
| System | `POST /webhooks/stripe`, `POST /cron/run`, `GET /health` |

---

## Project structure

```
InvoiceFlow/
├── client/                      Next.js frontend
│   ├── app/
│   │   ├── (auth)/              login, signup, forgot / reset password, verify email
│   │   ├── (dashboard)/         dashboard, invoices, clients, expenses, reports, billing, settings, admin
│   │   └── i/[token]/           public invoice and pay page
│   ├── components/              UI kit (fields, modal, tooltip, toasts), invoice form, theme toggle
│   └── lib/                     API client, formatting, data hooks
└── server/                      Express API
    └── src/
        ├── routes/              auth, clients, invoices, expenses, reports, billing, public, admin, cron
        ├── models/              User, Client, Invoice, Expense, Subscription
        ├── middleware/          auth, plan limits
        ├── webhooks/            Stripe webhook
        ├── lib/                 email, PDF, background jobs, Stripe sync, tokens
        └── seed.js              demo data
```

---

## Deploy

1. **MongoDB Atlas:** free M0 cluster, add a database user, allow your host in Network Access (`0.0.0.0/0` if the host has no fixed IP, with a long database password).
2. **Render (API):** new Web Service, root directory `server`, build `npm install`, start `npm start`. Add the server env vars, with `NODE_ENV=production`, `CLIENT_URL=<your Vercel URL>` and a long random `PROXY_SECRET` (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
3. **Vercel (frontend):** import the repo, root directory `client`, set `NEXT_PUBLIC_API_URL=/api`, `BACKEND_URL=<your Render URL>` and `PROXY_SECRET=<the same value as on Render>`. Then set `CLIENT_URL` on Render to the Vercel URL and redeploy.
4. **Stripe:** add a webhook endpoint `https://<render-url>/api/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `customer.subscription.created / updated / deleted`. Put its signing secret in Render as `STRIPE_WEBHOOK_SECRET`.
5. **Email:** add `RESEND_API_KEY`, and verify your domain in Resend so you can email clients.
6. **Background jobs on a sleeping host (Render free tier):** the server runs jobs hourly in-process, but a sleeping server cannot. On cron-job.org create a job that sends `POST https://<render-url>/api/cron/run` every hour with the header `x-cron-secret: <CRON_SECRET>`. This also keeps the API awake.
7. **Demo data:** run `npm run seed -- --force` once against production (it only touches its own seed accounts).

Render's free tier sleeps after inactivity, so the first request can take around 30 seconds.

**Online payments note:** client payments go to the Stripe account whose keys are on the server. A real multi-seller marketplace would use Stripe Connect so each user is paid directly. This project does not.

---

## Security

- **Sessions:** JWT (HS256 pinned) in an `httpOnly`, `Secure`, `SameSite=Lax` cookie. Changing or resetting a password signs out every other device. Banned users are cut off immediately.
- **CSRF:** state-changing requests must come from the app's own origin and be `application/json`.
- **Rate limits:** 300 requests per minute per IP overall; login 10 failures per account per 15 minutes plus 30 per IP; forgot-password 3 per email per hour; verification email 1 per minute; 30 invoice emails per user per hour; public invoice endpoints 60 per minute per IP.
- **Passwords:** bcrypt (cost 12), 8 to 72 characters. Login and reset do not reveal whether an account exists.
- **Tokens:** reset and verification tokens are random, single-use, expire, and only their SHA-256 hash is stored.
- **Data isolation:** every query is scoped to the logged-in user. Invoice pay links use 144-bit random tokens.
- **Payments:** Stripe webhook signature is verified; an invoice is only marked paid if the amount and currency match. Live Stripe keys are refused outside production, and events from the other Stripe mode are ignored.
- **Input:** Zod validation on every endpoint, escaped regex search, size-limited request bodies, escaped HTML in emails.
- **Headers:** Helmet on the API. The web app sends `X-Frame-Options`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`. Pay links are `noindex` and send no referrer.
- **Real visitor IP:** rate limits use the IP passed by the Vercel proxy only when it carries `PROXY_SECRET`; otherwise the address the Render load balancer saw. Faking `X-Forwarded-For` or `x-client-ip` does not help.
- **Abuse limits:** signup 10 per hour per IP; starting a Stripe payment 10 per 10 minutes per IP; PDF downloads 20 per minute per user; request bodies 100 KB (logo upload 400 KB, refused earlier at the proxy); stalled uploads are cut off after 30 seconds; Stripe webhooks and cron are not reachable through the public proxy.
- **Deploy checklist:** `NODE_ENV=production`, a `JWT_SECRET` of 32+ random characters, the **same** `PROXY_SECRET` on Render and Vercel, `CLIENT_URL` exactly equal to your public frontend URL, a strong database password.

**What this does not protect against:** a large *distributed* flood (thousands of different IPs) can still exhaust a small free-tier server, because no application code can stop that. Put the site behind Vercel's firewall / bot protection (or Cloudflare) for that, and consider a CAPTCHA on signup if you see bot signups.

Known trade-offs: signup reveals whether an email is already registered, rate limits are kept in memory (fine for one server instance), and logging out clears the cookie but does not revoke the token (changing the password does).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `querySrv ECONNREFUSED` when the API starts | Your computer's DNS refuses SRV lookups. The API already uses public DNS in development. If it still fails, check your network or VPN |
| `bad auth: Authentication failed` | Wrong username or password in `MONGO_URI`. Special characters in the password must be URL-encoded (`@` becomes `%40`) |
| Server exits with `Refusing to start: STRIPE_SECRET_KEY is a LIVE key` | You pasted a live key. Use the `sk_test_...` key from the Stripe dashboard in Test mode / a sandbox. Live keys are only allowed in production with `STRIPE_ALLOW_LIVE=true` |
| `stripe listen` says `must specify events to forward` | Add `--events checkout.session.completed,checkout.session.async_payment_succeeded,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted` to the command |
| Paid, but the plan still shows Free | Click **Already paid? Refresh plan status** on the Billing page. Make sure `STRIPE_SECRET_KEY` belongs to the same Stripe account as your CLI login |
| Webhook returns `400` | `STRIPE_WEBHOOK_SECRET` is empty or from a different `stripe listen` session. Copy it again and restart the server |
| No emails arrive | Without `RESEND_API_KEY` emails only print in the server terminal. With the default sender, Resend only delivers to your own address |
| Everyone gets "too many requests" in production | `PROXY_SECRET` is missing or different on Vercel and Render, so every visitor looks like one IP. Set the same value on both and redeploy |
| Every request fails with "untrusted origin" in production | `CLIENT_URL` on Render does not exactly match the URL in the browser (https, no trailing slash, same domain) |
| `Hydration failed` warning mentioning `cz-shortcut-listen` | A browser extension (ColorZilla) edits the page. Harmless, and already suppressed |

---

## Roadmap

Not built yet: Stripe Connect (pay each freelancer directly), team members and roles, bank sync, a native mobile app, multi-currency conversion.
