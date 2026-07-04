# Email Notifications Setup

The system now emails the guest automatically at four points:

| Event | Trigger | Email |
|---|---|---|
| Order placed | Guest submits the order form | Order ID + full order summary |
| Payment validated | Admin clicks "Mark Validated" (Dashboard) | Payment validated confirmation |
| Order claimed | Admin dispatches the order (Dispatch modal) **or** clicks "Mark Claimed" (Dashboard) | Pickup confirmation |
| Refund | Admin confirms a refund (Refund modal) | Refund confirmation + the refund proof screenshot attached |

Emails are sent via **Gmail SMTP**, using the Gmail App Password you provided:

- Gmail: `nulscsstudentcouncil@gmail.com`
- App Password: `twia vxsc rygc dkds`

## Why this needs a server-side function

This app is a static site that ships straight to the browser — anything in
`src/` (including anything read from a `VITE_...` env var) is visible to
literally anyone who opens dev tools on the live site. An email password
can never live there.

So sending is done from a **Supabase Edge Function** (`supabase/functions/send-email`),
which runs on Supabase's servers, not in the browser. The app calls it like
any other API — it never sees the Gmail password itself.

```
Guest's browser  →  supabase.functions.invoke('send-email', {...})
                        │
                        ▼
              Supabase Edge Function (send-email)
                        │  (holds GMAIL_USER / GMAIL_APP_PASSWORD as secrets)
                        ▼
                  smtp.gmail.com:465  →  guest's inbox
```

## One-time setup

You need the [Supabase CLI](https://supabase.com/docs/guides/cli) installed and
logged in (`supabase login`), and your project linked (`supabase link --project-ref <your-ref>`
— the ref is the subdomain in your project URL, e.g. `syhibugrxegajtyqdroy`).

1. **Deploy the function:**

   ```bash
   supabase functions deploy send-email
   ```

2. **Set the Gmail credentials as encrypted secrets** (this is the only place
   they should ever be stored — never put these in `.env`, `env.example`, or
   anything with a `VITE_` prefix):

   ```bash
   supabase secrets set GMAIL_USER="nulscsstudentcouncil@gmail.com" GMAIL_APP_PASSWORD="twia vxsc rygc dkds"
   ```

3. That's it. The client code already calls the function at the four
   trigger points above — no further wiring needed.

## Testing it

Quickest test is the order form itself: place a test order with your own
email address and you should get the "Order Received" email within a few
seconds. You can check function logs (including any send errors) with:

```bash
supabase functions logs send-email
```

## Notes

- If an order has no email on file, the function skips sending (no error) —
  this covers any legacy rows from before the `email` field was added.
- Sending never blocks or fails the action that triggered it (submitting an
  order, validating, dispatching, refunding all still succeed even if the
  email happens to fail) — failures are only logged.
- The refund email fetches the refund-proof screenshot from Supabase Storage
  and attaches it directly to the email, in addition to admins being able to
  view it from the Dashboard.
- Security note: your Gmail **App Password** is scoped to SMTP sending only
  from this one app — it can't log into your Google account or access
  anything else. You can revoke/rotate it any time from
  [Google Account → Security → App Passwords](https://myaccount.google.com/apppasswords)
  without affecting your normal Gmail login.
