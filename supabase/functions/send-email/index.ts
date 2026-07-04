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
// Shared visual language — mirrors the app's dark "ember" theme (char/ember
// colors, monospace display font, gradient accents, glass cards) so the
// email feels like it came from the same product as the order form.
// ---------------------------------------------------------------------------

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
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0b0a09;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0a09;padding:32px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#131110;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;font-family:'Courier New',ui-monospace,SFMono-Regular,Menlo,monospace;">
            <tr>
              <td style="background:linear-gradient(135deg,#5eb1ff,#2f7de8 55%,#123f96);padding:30px 28px 26px;text-align:center;">
                <div style="display:inline-block;width:46px;height:46px;line-height:46px;border-radius:50%;background:rgba(255,255,255,0.16);font-size:22px;">🔥</div>
                <p style="margin:16px 0 4px;color:rgba(255,255,255,0.85);font-size:11px;letter-spacing:3px;text-transform:uppercase;">${escapeHtml(eyebrow)}</p>
                <h1 style="margin:0;color:#ffffff;font-size:19px;font-weight:700;font-family:'Courier New',ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 8px;color:#e7e2db;font-size:14px;line-height:1.65;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 24px;">
                <div style="height:1px;background:rgba(255,255,255,0.08);"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 26px;text-align:center;">
                <p style="margin:0;color:#8a8074;font-size:11px;">SCS Student Council &middot; Orientation Week 2026</p>
                <p style="margin:4px 0 0;color:#3a332c;font-size:10px;">This is an automated message — please don't reply directly to this email.</p>
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
  return `<div style="margin:2px 0 20px;padding:16px 18px;border:1px solid rgba(47,125,232,0.35);background:rgba(47,125,232,0.1);border-radius:14px;text-align:center;">
    <p style="margin:0 0 6px;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8a8074;">${escapeHtml(label)}</p>
    <p style="margin:0;font-size:24px;font-weight:700;letter-spacing:3px;color:#5eb1ff;font-family:'Courier New',ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(ticketNumber)}</p>
  </div>`
}

function statusPill(text: string, tone: 'ember' | 'neutral' = 'ember') {
  const bg = tone === 'ember' ? 'rgba(47,125,232,0.16)' : 'rgba(255,255,255,0.06)'
  const color = tone === 'ember' ? '#5eb1ff' : '#b9b0a3'
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${bg};color:${color};font-size:11px;font-weight:700;letter-spacing:0.5px;">${escapeHtml(text)}</span>`
}

function detailRows(rows: Array<[string, string]>) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:13px;">
    ${rows
      .filter(([, v]) => v)
      .map(
        ([label, value]) => `<tr>
          <td style="padding:4px 0;color:#8a8074;">${escapeHtml(label)}</td>
          <td style="padding:4px 0;text-align:right;color:#e7e2db;">${escapeHtml(value)}</td>
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
        <td style="padding:6px 0;color:#b9b0a3;font-size:13px;">${escapeHtml(it.name)} &times; ${escapeHtml(it.qty)}</td>
        <td style="padding:6px 0;text-align:right;color:#e7e2db;font-size:13px;">${money(it.subtotal)}</td>
      </tr>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;">
    ${rows}
    <tr><td colspan="2" style="padding-top:10px;"><div style="height:1px;background:rgba(255,255,255,0.08);"></div></td></tr>
    <tr>
      <td style="padding-top:10px;font-weight:700;color:#e7e2db;font-size:14px;">Total</td>
      <td style="padding-top:10px;text-align:right;font-weight:700;color:#5eb1ff;font-size:15px;">${money(order.total)}</td>
    </tr>
  </table>`
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
      <p style="margin:18px 0 0;font-size:13px;color:#b9b0a3;">
        Status: ${statusPill('Pending Validation', 'neutral')}
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#8a8074;">
        An admin will validate your payment shortly — you'll get another email once that's done.
        Keep your Order ID handy; it's what you'll give at the pickup counter.
      </p>
    `,
  })
  return { subject, html }
}

function paymentValidatedEmail(order: any) {
  const subject = `Payment validated — ${order.ticket_number}`
  const html = emailShell({
    eyebrow: 'SCS BBQ Night 2026',
    title: 'Payment Validated',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(order.name)}, good news — an admin has validated your payment.</p>
      ${ticketBadge(order.ticket_number)}
      <p style="margin:0 0 12px;font-size:13px;color:#b9b0a3;">
        Status: ${statusPill('Validated')}
      </p>
      ${itemsTable(order)}
      <p style="margin:16px 0 0;font-size:13px;color:#8a8074;">
        Your order is confirmed. Bring your Order ID (or your name) to the pickup counter on BBQ Night to claim it.
      </p>
    `,
  })
  return { subject, html }
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
      <p style="margin:0 0 12px;font-size:13px;color:#b9b0a3;">
        Status: ${statusPill('Claimed')}
      </p>
      ${detailRows([['Claimed At', claimedWhen]])}
      <p style="margin:16px 0 0;font-size:13px;color:#8a8074;">
        Thanks for ordering, and see you at Orientation Week 2026!
      </p>
    `,
  })
  return { subject, html }
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
      <p style="margin:0 0 12px;font-size:13px;color:#b9b0a3;">
        Status: ${statusPill('Refunded', 'neutral')}
      </p>
      ${detailRows([
        ['Amount', money(order.total)],
        ['Refunded At', refundedWhen],
      ])}
      <p style="margin:16px 0 0;font-size:13px;color:#8a8074;">
        Proof of the refund is attached to this email for your records.
      </p>
    `,
  })
  return { subject, html }
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

  let subject: string, html: string
  switch (type) {
    case 'order_placed':
      ;({ subject, html } = orderPlacedEmail(order))
      break
    case 'payment_validated':
      ;({ subject, html } = paymentValidatedEmail(order))
      break
    case 'claimed':
      ;({ subject, html } = claimedEmail(order))
      break
    case 'refund':
      ;({ subject, html } = refundEmail(order))
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
      content: 'auto',
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
