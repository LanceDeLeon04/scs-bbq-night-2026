import { useState } from 'react'
import {
  X, Undo2, Upload, Loader2, AlertCircle, CheckCircle2, Image as ImageIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { emailRefund } from '../lib/email.js'

/**
 * Confirms a refund for a single order. Requires a proof-of-refund
 * screenshot (e.g. the GCash "money sent" confirmation) before the order
 * can be marked as refunded — mirrors how payment itself is verified.
 */
export default function RefundModal({ order, onClose, onRefunded }) {
  const [proof, setProof] = useState(null)
  const [proofPreview, setProofPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (screenshot) as proof of refund.')
      return
    }
    setError('')
    setProof(file)
    setProofPreview(URL.createObjectURL(file))
  }

  const confirmRefund = async () => {
    if (!proof) {
      setError('Attach a screenshot showing proof the refund was sent.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const ext = proof.name.split('.').pop() || 'jpg'
      const path = `refunds/${order.ticket_number}-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('payment-screenshots')
        .upload(path, proof, { upsert: false })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('payment-screenshots')
        .getPublicUrl(path)

      const refundedAt = new Date().toISOString()
      let { error: updateError } = await supabase
        .from('orders')
        .update({
          refunded: true,
          refund_proof_url: urlData.publicUrl,
          refunded_at: refundedAt,
        })
        .eq('id', order.id)

      // Older projects that haven't re-run schema.sql yet won't have these
      // columns — fall back to just `refunded` so the action still succeeds.
      if (updateError) {
        const retry = await supabase
          .from('orders')
          .update({ refunded: true })
          .eq('id', order.id)
        updateError = retry.error
      }
      if (updateError) throw updateError

      const updated = {
        ...order,
        refunded: true,
        refund_proof_url: urlData.publicUrl,
        refunded_at: refundedAt,
      }
      onRefunded(updated)
      emailRefund(updated, urlData.publicUrl)
      setDone(true)
    } catch (err) {
      console.error(err)
      setError(
        err?.message?.includes('Bucket not found')
          ? 'Storage is not set up yet. Ask the admin to run the Supabase setup (see README).'
          : 'Something went wrong recording the refund. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="glass-strong animate-rise flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <Undo2 size={18} className="text-ember-500" />
            <h2 className="font-display text-base font-semibold text-smoke-200">
              Process Refund
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ember-ring rounded-full p-1.5 text-smoke-500 transition hover:bg-white/5 hover:text-smoke-300"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {done ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-ember-600/30 bg-ember-600/10 px-4 py-3.5 text-sm text-ember-300">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-ember-200">Refund recorded</p>
                <p className="mt-0.5 text-ember-300/80">
                  {order.name} ({order.ticket_number}) has been marked as refunded.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                <p className="font-mono text-sm font-semibold text-ember-400">
                  {order.ticket_number}
                </p>
                <p className="mt-0.5 text-sm text-smoke-300">{order.name}</p>
                <p className="mt-1 text-xs text-smoke-500">
                  Total ₱{Number(order.total).toFixed(0)}
                </p>
              </div>

              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-smoke-500">
                Attach proof the refund was sent
              </p>
              <label
                htmlFor="refund-proof"
                className="ember-ring flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-center transition hover:border-ember-500/50"
              >
                {proofPreview ? (
                  <img
                    src={proofPreview}
                    alt="Refund proof preview"
                    className="max-h-52 rounded-lg border border-white/10 object-contain"
                  />
                ) : (
                  <>
                    <Upload size={22} className="text-ember-500" />
                    <span className="text-sm text-smoke-400">
                      Tap to upload refund screenshot
                    </span>
                    <span className="text-xs text-smoke-500">PNG or JPG</span>
                  </>
                )}
                <input
                  id="refund-proof"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary flex-1"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRefund}
                  disabled={submitting || !proof}
                  className="btn-primary flex flex-1 items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ImageIcon size={16} />
                  )}
                  Mark as Refunded
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
