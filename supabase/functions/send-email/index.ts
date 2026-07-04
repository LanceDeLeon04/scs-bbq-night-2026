// Supabase Edge Function: send-email
//
// Sends transactional emails for the SCS BBQ Night order system via Gmail
// SMTP (using a Gmail App Password — never the real account password).
//
// This runs SERVER-SIDE ONLY. The Gmail credentials live in Edge Function
// secrets (GMAIL_USER / GMAIL_APP_PASSWORD) and are never bundled into the
// browser app, unlike everything under src/ which ships to every visitor.
//
// Deploy:
//   supabase functions deploy send-email
// Set secrets (one-time, from your machine — never commit these):
//   supabase secrets set GMAIL_USER=youraddress@gmail.com GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
//
// Invoked from the client via supabase.functions.invoke('send-email', { body }).
// Body shape:
//   { type: 'order_placed' | 'payment_validated' | 'claimed' | 'refund',
//     order: { ticket_number, name, email, department, section, id_no,
//               mobile, items, total, claimed_at?, refunded_at? },
//     refundProofUrl?: string }

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const GMAIL_USER = Deno.env.get('GMAIL_USER')
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')
const FROM_NAME = 'SCS BBQ Night'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: unknown) {
  return `₱${Number(n || 0).toFixed(0)}`
}

// ---------------------------------------------------------------------------
// Shared visual language — clean, light-first "system UI" look: a neutral
// paper background, a single warm BBQ-ember accent used sparingly, system
// font stack, and a matching dark-mode flip for clients that support
// prefers-color-scheme (Apple Mail, iOS/macOS Mail, some Outlook builds).
// Clients that ignore the media query simply keep the light theme, which is
// the safe default we want.
// ---------------------------------------------------------------------------

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

function emailShell({
  eyebrow,
  title,
  bodyHtml,
}: {
  eyebrow: string
  title: string
  bodyHtml: string
}) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { background-color: #f4f4f5; }
      .card { background-color: #ffffff; border-color: #e4e4e7; }
      .header { background-color: #fff7ed; }
      .icon-badge { background-color: #ffedd5; }
      .eyebrow { color: #b45309; }
      .title { color: #18181b; }
      .body-text { color: #3f3f46; }
      .muted { color: #71717a; }
      .faint { color: #a1a1aa; }
      .divider { background-color: #e4e4e7; }
      .ticket-box { background-color: #fff7ed; border-color: #fed7aa; }
      .ticket-label { color: #a1621b; }
      .ticket-value { color: #c2410c; }
      .accent { color: #c2410c; }
      .notice { background-color: #fefce8; border-color: #fde68a; color: #854d0e; }
      a { color: #c2410c; }

      @media (prefers-color-scheme: dark) {
        body { background-color: #09090b !important; }
        .card { background-color: #18181b !important; border-color: #27272a !important; }
        .header { background-color: #1f1a14 !important; }
        .icon-badge { background-color: #3a2412 !important; }
        .eyebrow { color: #fb923c !important; }
        .title { color: #fafafa !important; }
        .body-text { color: #d4d4d8 !important; }
        .muted { color: #a1a1aa !important; }
        .faint { color: #71717a !important; }
        .divider { background-color: #27272a !important; }
        .ticket-box { background-color: #271a0f !important; border-color: #7c3d10 !important; }
        .ticket-label { color: #d99a5b !important; }
        .ticket-value { color: #fb923c !important; }
        .accent { color: #fb923c !important; }
        .notice { background-color: #241f0a !important; border-color: #4d4009 !important; color: #fde68a !important; }
        a { color: #fb923c !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card" style="max-width:480px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;font-family:${FONT_STACK};">
            <tr>
              <td class="header" style="background-color:#fff7ed;padding:28px 28px 24px;text-align:center;">
                <div class="icon-badge" style="display:inline-block;width:44px;height:44px;line-height:44px;border-radius:50%;background-color:#ffedd5;font-size:20px;">🔥</div>
                <p class="eyebrow" style="margin:14px 0 4px;color:#b45309;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">${escapeHtml(eyebrow)}</p>
                <h1 class="title" style="margin:0;color:#18181b;font-size:20px;font-weight:700;font-family:${FONT_STACK};">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td class="body-text" style="padding:26px 28px 8px;color:#3f3f46;font-size:14px;line-height:1.65;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 24px;">
                <div class="divider" style="height:1px;background-color:#e4e4e7;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 26px;text-align:center;">
                <p class="muted" style="margin:0;color:#71717a;font-size:11px;">SCS Student Council &middot; Orientation Week 2026</p>
                <p class="faint" style="margin:4px 0 0;color:#a1a1aa;font-size:10px;">This is an automated message — please don't reply directly to this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function ticketBadge(ticketNumber: string, label = 'Order ID') {
  return `<div class="ticket-box" style="margin:2px 0 20px;padding:16px 18px;border:1px solid #fed7aa;background-color:#fff7ed;border-radius:12px;text-align:center;">
    <p class="ticket-label" style="margin:0 0 6px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#a1621b;font-weight:600;">${escapeHtml(label)}</p>
    <p class="ticket-value" style="margin:0;font-size:22px;font-weight:700;letter-spacing:2px;color:#c2410c;font-family:${FONT_STACK};">${escapeHtml(ticketNumber)}</p>
  </div>`
}

function statusPill(text: string, tone: 'ember' | 'neutral' = 'ember') {
  const bg = tone === 'ember' ? '#ffedd5' : '#f4f4f5'
  const color = tone === 'ember' ? '#c2410c' : '#52525b'
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background-color:${bg};color:${color};font-size:11px;font-weight:700;letter-spacing:0.3px;">${escapeHtml(text)}</span>`
}

function noticeBox(html: string) {
  return `<div class="notice" style="margin:16px 0 0;padding:12px 14px;border:1px solid #fde68a;background-color:#fefce8;border-radius:10px;font-size:12.5px;line-height:1.55;color:#854d0e;">${html}</div>`
}

function detailRows(rows: Array<[string, string]>) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:13px;">
    ${rows
      .filter(([, v]) => v)
      .map(
        ([label, value]) => `<tr>
          <td class="muted" style="padding:4px 0;color:#71717a;">${escapeHtml(label)}</td>
          <td class="body-text" style="padding:4px 0;text-align:right;color:#3f3f46;">${escapeHtml(value)}</td>
        </tr>`
      )
      .join('')}
  </table>`
}

function itemsTable(order: any) {
  const items = Array.isArray(order.items) ? order.items : []
  const rows = items
    .map(
      (it: any) => `<tr>
        <td class="muted" style="padding:6px 0;color:#52525b;font-size:13px;">${escapeHtml(it.name)} &times; ${escapeHtml(it.qty)}</td>
        <td class="body-text" style="padding:6px 0;text-align:right;color:#3f3f46;font-size:13px;">${money(it.subtotal)}</td>
      </tr>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;">
    ${rows}
    <tr><td colspan="2" style="padding-top:10px;"><div class="divider" style="height:1px;background-color:#e4e4e7;"></div></td></tr>
    <tr>
      <td class="title" style="padding-top:10px;font-weight:700;color:#18181b;font-size:14px;">Total</td>
      <td class="accent" style="padding-top:10px;text-align:right;font-weight:700;color:#c2410c;font-size:15px;">${money(order.total)}</td>
    </tr>
  </table>`
}

function itemsText(order: any) {
  const items = Array.isArray(order.items) ? order.items : []
  return items.map((it: any) => `- ${it.name} x${it.qty}: ${money(it.subtotal)}`).join('\n')
}

// ---------------------------------------------------------------------------
// Per-event templates
// ---------------------------------------------------------------------------

function orderPlacedEmail(order: any) {
  const subject = `Order received — ${order.ticket_number}`
  const html = emailShell({
    eyebrow: 'SCS BBQ Night 2026',
    title: 'Order Received',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(order.name)}, thanks for your order! Here's your confirmation.</p>
      ${ticketBadge(order.ticket_number)}
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8074;">Order Summary</p>
      ${itemsTable(order)}
      ${detailRows([
        ['Name', order.name],
        ['Department', order.department],
        ['Section', order.section],
        ['ID No.', order.id_no],
        ['Mobile', order.mobile],
      ])}
      <p class="muted" style="margin:18px 0 0;font-size:13px;color:#71717a;">
        Status: ${statusPill('Pending Validation', 'neutral')}
      </p>
      <p class="muted" style="margin:16px 0 0;font-size:13px;color:#71717a;">
        An admin will validate your payment shortly — you'll get another email once that's done.
        Keep your Order ID handy; it's what you'll give at the pickup counter.
      </p>
      ${noticeBox(
        `<strong>Can't find this email later?</strong> Please check your Spam/Junk folder for this confirmation and mark it as "Not Spam" so future updates land in your inbox.`
      )}
    `,
  })
  const text = [
    `Hi ${order.name}, thanks for your order! Here's your confirmation.`,
    ``,
    `Order ID: ${order.ticket_number}`,
    ``,
    `Order Summary:`,
    itemsText(order),
    `Total: ${money(order.total)}`,
    ``,
    `Name: ${order.name}`,
    `Department: ${order.department || ''}`,
    `Section: ${order.section || ''}`,
    `ID No.: ${order.id_no || ''}`,
    `Mobile: ${order.mobile || ''}`,
    ``,
    `Status: Pending Validation`,
    `An admin will validate your payment shortly — you'll get another email once that's done. Keep your Order ID handy; it's what you'll give at the pickup counter.`,
    ``,
    `Can't find this email later? Please check your Spam/Junk folder for this confirmation and mark it as "Not Spam" so future updates land in your inbox.`,
  ].join('\n')
  return { subject, html, text }
}

function paymentValidatedEmail(order: any) {
  const subject = `Payment validated — ${order.ticket_number}`
  const html = emailShell({
    eyebrow: 'SCS BBQ Night 2026',
    title: 'Payment Validated',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(order.name)}, good news — an admin has validated your payment.</p>
      ${ticketBadge(order.ticket_number)}
      <p class="muted" style="margin:0 0 12px;font-size:13px;color:#71717a;">
        Status: ${statusPill('Validated')}
      </p>
      ${itemsTable(order)}
      <p class="muted" style="margin:16px 0 0;font-size:13px;color:#71717a;">
        Your order is confirmed. Bring your Order ID (or your name) to the pickup counter on BBQ Night to claim it.
      </p>
    `,
  })
  const text = [
    `Hi ${order.name}, good news — an admin has validated your payment.`,
    ``,
    `Order ID: ${order.ticket_number}`,
    `Status: Validated`,
    ``,
    itemsText(order),
    `Total: ${money(order.total)}`,
    ``,
    `Your order is confirmed. Bring your Order ID (or your name) to the pickup counter on BBQ Night to claim it.`,
  ].join('\n')
  return { subject, html, text }
}

function claimedEmail(order: any) {
  const subject = `Order claimed — ${order.ticket_number}`
  const claimedWhen = order.claimed_at
    ? new Date(order.claimed_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
    : ''
  const html = emailShell({
    eyebrow: 'SCS BBQ Night 2026',
    title: 'Order Claimed',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(order.name)}, your order has been picked up at the counter. Enjoy the BBQ Night! 🔥</p>
      ${ticketBadge(order.ticket_number)}
      <p class="muted" style="margin:0 0 12px;font-size:13px;color:#71717a;">
        Status: ${statusPill('Claimed')}
      </p>
      ${detailRows([['Claimed At', claimedWhen]])}
      <p class="muted" style="margin:16px 0 0;font-size:13px;color:#71717a;">
        Thanks for ordering, and see you at Orientation Week 2026!
      </p>
    `,
  })
  const text = [
    `Hi ${order.name}, your order has been picked up at the counter. Enjoy the BBQ Night!`,
    ``,
    `Order ID: ${order.ticket_number}`,
    `Status: Claimed`,
    claimedWhen ? `Claimed At: ${claimedWhen}` : '',
    ``,
    `Thanks for ordering, and see you at Orientation Week 2026!`,
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, html, text }
}

function refundEmail(order: any) {
  const subject = `Refund processed — ${order.ticket_number}`
  const refundedWhen = order.refunded_at
    ? new Date(order.refunded_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
    : ''
  const html = emailShell({
    eyebrow: 'SCS BBQ Night 2026',
    title: 'Refund Processed',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(order.name)}, your payment for this order has been refunded by an admin.</p>
      ${ticketBadge(order.ticket_number)}
      <p class="muted" style="margin:0 0 12px;font-size:13px;color:#71717a;">
        Status: ${statusPill('Refunded', 'neutral')}
      </p>
      ${detailRows([
        ['Amount', money(order.total)],
        ['Refunded At', refundedWhen],
      ])}
      <p class="muted" style="margin:16px 0 0;font-size:13px;color:#71717a;">
        Proof of the refund is attached to this email for your records.
      </p>
    `,
  })
  const text = [
    `Hi ${order.name}, your payment for this order has been refunded by an admin.`,
    ``,
    `Order ID: ${order.ticket_number}`,
    `Status: Refunded`,
    `Amount: ${money(order.total)}`,
    refundedWhen ? `Refunded At: ${refundedWhen}` : '',
    ``,
    `Proof of the refund is attached to this email for your records.`,
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, html, text }
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Missing GMAIL_USER / GMAIL_APP_PASSWORD secrets')
    return json({ error: 'Email is not configured on the server yet.' }, 500)
  }

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const { type, order, refundProofUrl } = payload || {}

  if (!order?.email) {
    // Not an error — plenty of test/legacy rows may lack an email. Skip quietly.
    return json({ skipped: true, reason: 'Order has no email on file.' })
  }

  let subject: string, html: string, text: string
  switch (type) {
    case 'order_placed':
      ;({ subject, html, text } = orderPlacedEmail(order))
      break
    case 'payment_validated':
      ;({ subject, html, text } = paymentValidatedEmail(order))
      break
    case 'claimed':
      ;({ subject, html, text } = claimedEmail(order))
      break
    case 'refund':
      ;({ subject, html, text } = refundEmail(order))
      break
    default:
      return json({ error: `Unknown email type: ${type}` }, 400)
  }

  const attachments: Array<{ filename: string; content: Uint8Array; encoding: 'binary'; contentType: string }> = []

  if (type === 'refund' && refundProofUrl) {
    try {
      const res = await fetch(refundProofUrl)
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer())
        const ext = (refundProofUrl.split('.').pop() || 'jpg').split('?')[0].toLowerCase()
        const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
        attachments.push({
          filename: `refund-proof-${order.ticket_number}.${ext}`,
          content: buf,
          encoding: 'binary',
          contentType,
        })
      } else {
        console.error('Could not fetch refund proof image:', res.status)
      }
    } catch (err) {
      console.error('Error fetching refund proof image:', err)
    }
  }

  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
    },
  })

  try {
    await client.send({
      from: `${FROM_NAME} <${GMAIL_USER}>`,
      to: order.email,
      subject,
      content: text,
      html,
      attachments,
    })
    return json({ sent: true })
  } catch (err) {
    console.error('Failed to send email:', err)
    return json({ error: String(err) }, 500)
  } finally {
    try {
      await client.close()
    } catch {
      // ignore
    }
  }
})
