import { supabase } from './supabaseClient.js'

// Fire-and-forget email notifications via the `send-email` Supabase Edge
// Function (Gmail SMTP). Sending an email should never block or fail the
// action that triggered it (submitting an order, validating payment,
// dispatching, or refunding) — so failures here are only logged.
async function notify(type, order, extra = {}) {
  if (!order?.email) return
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: { type, order, ...extra },
    })
    if (error) console.error(`send-email (${type}) failed:`, error)
  } catch (err) {
    console.error(`send-email (${type}) failed:`, err)
  }
}

export const emailOrderPlaced = (order) => notify('order_placed', order)
export const emailPaymentValidated = (order) => notify('payment_validated', order)
export const emailClaimed = (order) => notify('claimed', order)
export const emailRefund = (order, refundProofUrl) => notify('refund', order, { refundProofUrl })
