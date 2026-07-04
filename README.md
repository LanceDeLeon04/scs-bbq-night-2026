# SCS BBQ Night 2026 — Order Form

Order form + admin dashboard for the School of Computer Studies BBQ Night, O'Week 2026.
React + Vite + Tailwind on the frontend, Supabase (Postgres + Storage) on the backend.

## 1. What's included

- **Order form** (`/`) — 3-step flow: pick items → pay via GCash QR + upload screenshot → get a ticket number.
- **Admin dashboard** (`/admin` → `/admin/dashboard`) — sign in, view all orders, sort by ticket or item,
  filter by validation status and section, validate payments, mark orders claimed.
- **Supabase schema** (`schema.sql`) — `orders` table + a public storage bucket for payment screenshots.
- **Email notifications** — guests are emailed automatically when their order is placed, when
  payment is validated, when the order is claimed, and when a refund is processed (with the
  refund proof screenshot attached). Sent server-side via Gmail SMTP — see `EMAIL_SETUP.md`.

## 2. Add your item photos

Drop these files into `public/Resources/` (exact names, referenced in `src/lib/menu.js`):

```
porkbbq.png   porktaba.png   dugo.png   paa.png   ulo.png
isaw.png      hotdog.png     uling.png  coke.png
gcash-qr.png   ← your GCash QR code
favicon.png    ← optional, browser tab icon
```

If an image is missing the form still works — it just leaves that spot blank.

## 3. Set up Supabase

1. Go to your Supabase project → **SQL Editor** → paste the contents of `schema.sql` → **Run**.
   This creates the `orders` table, row-level security policies, and the `payment-screenshots`
   storage bucket.
2. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key (never use the `service_role` key or your DB password in this app —
     both would be shipped to every visitor's browser).

## 4. Configure environment variables

Copy `env.example` to `.env` and fill in your values:

```bash
cp env.example .env
```

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_ADMIN_USERNAME=lance.deleon
VITE_ADMIN_PASSWORD=SCS2026-2025
```

> **Security note:** the admin login here is a simple client-side gate meant for a small,
> single-event tool — the username/password are compiled into the JS bundle and the
> `orders` table is readable/writable by the public `anon` key (needed so the dashboard
> can work without a full auth system). Don't reuse this password anywhere important.
> For a stronger setup later, swap this for Supabase Auth + a policy that checks
> `auth.uid()` against an `admins` table.

## 5. Run locally

```bash
npm install
npm run dev
```

Open the printed local URL. The order form is at `/`, admin login at `/admin`.

## 6. Deploy via GitHub

**Option A — GitHub Pages (included workflow)**

1. Push this project to a new GitHub repo.
2. In the repo, go to **Settings → Secrets and variables → Actions → New repository secret**
   and add: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_USERNAME`, `VITE_ADMIN_PASSWORD`.
3. If this is a project page (`https://<user>.github.io/<repo>/`), also add a repo **variable**
   named `VITE_BASE_PATH` set to `/<repo>/`. Skip this if using a custom domain.
4. Go to **Settings → Pages** and set **Source** to "GitHub Actions".
5. Push to `main` — the included workflow (`.github/workflows/deploy.yml`) builds and deploys
   automatically. Your site goes live at the URL shown in the Pages settings.

**Option B — Vercel / Netlify**

1. Push to GitHub, then import the repo in Vercel or Netlify.
2. Build command: `npm run build`, output directory: `dist`.
3. Add the same four environment variables in the project's dashboard settings.
4. Deploy — no `VITE_BASE_PATH` needed for these (they serve from the domain root).

## 7. Set up email notifications

Guests get automatic emails at each order milestone (placed, validated, claimed, refunded).
This requires a one-time Supabase Edge Function deploy + secret setup — see **`EMAIL_SETUP.md`**
for the full walkthrough. Don't skip the "why this needs a server-side function" note in there
before configuring anything.

## 8. Using it on the night

- Students fill out the form, pay via GCash, upload their screenshot, and get a ticket
  number (`SCS-XXXXXX`) — tell them to screenshot it and present it at pickup.
- Admins sign in at `/admin`, validate each payment against the uploaded screenshot,
  and mark orders claimed as they're handed out. Filters make it fast to work section
  by section or item by item during rush.

## Tech stack

React 18 · Vite · Tailwind CSS · React Router · Supabase (Postgres + Storage) · lucide-react icons
